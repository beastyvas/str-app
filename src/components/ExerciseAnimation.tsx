import { useEffect } from 'react';
import { View, Text } from 'react-native';
import Svg, { Circle, Line, G } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
  interpolate,
} from 'react-native-reanimated';
import { Colors } from '@/constants/colors';
import { getPoseKey, EXERCISE_POSES, Joints } from '@/constants/exercisePoses';

// Animated SVG components
const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedLine = Animated.createAnimatedComponent(Line);

// Skeleton connections: pairs of joint indices
const CONNECTIONS: [number, number][] = [
  [0, 1],   // head → neck
  [1, 2],   // neck → near shoulder
  [1, 10],  // neck → far shoulder
  [1, 5],   // neck → spine
  [5, 6],   // spine → hips
  [2, 3],   // near shoulder → near elbow
  [3, 4],   // near elbow → near wrist
  [10, 11], // far shoulder → far elbow
  [11, 12], // far elbow → far wrist
  [6, 7],   // hips → near knee
  [7, 8],   // near knee → near ankle
  [8, 9],   // near ankle → near toe
];

// Far side connections (slightly faded)
const FAR_CONNECTIONS: [number, number][] = [
  [10, 11],
  [11, 12],
];

interface Props {
  exerciseName: string;
  muscleGroup: string;
  equipmentType?: string;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function interpolateJoints(start: Joints, end: Joints, t: number): Joints {
  return start.map((j, i) => [
    lerp(j[0], end[i][0], t),
    lerp(j[1], end[i][1], t),
  ]) as Joints;
}

// Animated line that gets its positions from interpolated joints
function SkeletonLine({
  startJoint, endJoint, progress, start, end, opacity = 1, strokeWidth = 3,
}: {
  startJoint: number;
  endJoint: number;
  progress: Animated.SharedValue<number>;
  start: Joints;
  end: Joints;
  opacity?: number;
  strokeWidth?: number;
}) {
  const animatedProps = useAnimatedProps(() => {
    const t = progress.value;
    const sx = interpolate(t, [0, 1], [start[startJoint][0], end[startJoint][0]]);
    const sy = interpolate(t, [0, 1], [start[startJoint][1], end[startJoint][1]]);
    const ex = interpolate(t, [0, 1], [start[endJoint][0], end[endJoint][0]]);
    const ey = interpolate(t, [0, 1], [start[endJoint][1], end[endJoint][1]]);
    return { x1: sx, y1: sy, x2: ex, y2: ey };
  });

  return (
    <AnimatedLine
      animatedProps={animatedProps}
      stroke={Colors.accent}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      opacity={opacity}
    />
  );
}

function JointCircle({
  jointIdx, progress, start, end, r = 3.5, opacity = 1,
}: {
  jointIdx: number;
  progress: Animated.SharedValue<number>;
  start: Joints;
  end: Joints;
  r?: number;
  opacity?: number;
}) {
  const animatedProps = useAnimatedProps(() => {
    const t = progress.value;
    return {
      cx: interpolate(t, [0, 1], [start[jointIdx][0], end[jointIdx][0]]),
      cy: interpolate(t, [0, 1], [start[jointIdx][1], end[jointIdx][1]]),
    };
  });

  return (
    <AnimatedCircle
      animatedProps={animatedProps}
      r={r}
      fill={Colors.accent}
      opacity={opacity}
    />
  );
}

export function ExerciseAnimation({ exerciseName, muscleGroup, equipmentType }: Props) {
  const poseKey = getPoseKey(exerciseName, muscleGroup, equipmentType);
  const pose = EXERCISE_POSES[poseKey] ?? EXERCISE_POSES['generic_push'];
  const { start, end, speed = 1 } = pose;

  const progress = useSharedValue(0);
  const duration = Math.round(1200 / speed);

  useEffect(() => {
    progress.value = withRepeat(
      withSequence(
        withTiming(1, { duration, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );
  }, [poseKey]);

  const isBench = poseKey === 'bench';
  const isPushup = poseKey === 'pushup';
  const isLegPress = poseKey === 'legpress';
  const isHipThrust = poseKey === 'hipthrust';
  const isLying = isBench || isPushup || isLegPress || isHipThrust;

  // ViewBox adapts based on exercise orientation
  const viewBox = isLying ? "0 0 140 120" : "0 0 120 175";
  const svgHeight = isLying ? 130 : 210;

  return (
    <View style={{ alignItems: 'center' }}>
      <Text style={{
        color: Colors.textMuted, fontSize: 9, letterSpacing: 1.5,
        textTransform: 'uppercase', marginBottom: 8,
      }}>
        {exerciseName}
      </Text>

      <View style={{
        backgroundColor: Colors.surface2,
        borderRadius: 16,
        padding: 12,
        borderWidth: 1,
        borderColor: Colors.border,
        alignItems: 'center',
      }}>
        <Svg width={200} height={svgHeight} viewBox={viewBox}>
          {/* Ground line for standing exercises */}
          {!isLying && (
            <AnimatedLine
              x1={10} y1={158} x2={110} y2={158}
              stroke={Colors.border} strokeWidth={1.5} strokeLinecap="round"
            />
          )}

          {/* Far side limbs (faded) */}
          {CONNECTIONS.filter(([a]) => a === 10 || a === 11).map(([a, b], i) => (
            <SkeletonLine
              key={`far-${i}`}
              startJoint={a} endJoint={b}
              progress={progress} start={start} end={end}
              opacity={0.35} strokeWidth={2.5}
            />
          ))}

          {/* Main skeleton connections */}
          {CONNECTIONS.filter(([a]) => a !== 10 && a !== 11).map(([a, b], i) => (
            <SkeletonLine
              key={`conn-${i}`}
              startJoint={a} endJoint={b}
              progress={progress} start={start} end={end}
              strokeWidth={3.5}
            />
          ))}

          {/* Head (special — bigger circle) */}
          <JointCircle jointIdx={0} progress={progress} start={start} end={end} r={10} />

          {/* Other joints */}
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(i => (
            <JointCircle key={i} jointIdx={i} progress={progress} start={start} end={end} r={3} />
          ))}
          {/* Far joints faded */}
          {[10, 11, 12].map(i => (
            <JointCircle key={i} jointIdx={i} progress={progress} start={start} end={end} r={2.5} opacity={0.35} />
          ))}
        </Svg>
      </View>

      <Text style={{ color: Colors.accent, fontSize: 9, marginTop: 6, fontWeight: '700', letterSpacing: 1 }}>
        {poseKey.replace('_', ' ').toUpperCase()} ANIMATION
      </Text>
    </View>
  );
}
