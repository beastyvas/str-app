import { useEffect, useState, useRef } from 'react';
import { View, Text } from 'react-native';
import Svg, { Circle, Line } from 'react-native-svg';
import { Colors } from '@/constants/colors';
import { getPoseKey, EXERCISE_POSES, Joints } from '@/constants/exercisePoses';

// Skeleton bone connections: [jointA, jointB]
const BONES: [number, number][] = [
  [0, 1],   // head → neck
  [1, 2],   // neck → near shoulder
  [1, 5],   // neck → spine
  [5, 6],   // spine → hips
  [2, 3],   // near shoulder → near elbow
  [3, 4],   // near elbow → near wrist
  [6, 7],   // hips → near knee
  [7, 8],   // near knee → near ankle
  [8, 9],   // near ankle → toe
];

const FAR_BONES: [number, number][] = [
  [10, 11], // far shoulder → far elbow
  [11, 12], // far elbow → far wrist
];

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpJoints(start: Joints, end: Joints, t: number): Joints {
  return start.map((j, i) => [
    lerp(j[0], end[i][0], t),
    lerp(j[1], end[i][1], t),
  ]) as Joints;
}

interface Props {
  exerciseName: string;
  muscleGroup: string;
  equipmentType?: string;
}

export function ExerciseAnimation({ exerciseName, muscleGroup, equipmentType }: Props) {
  const poseKey = getPoseKey(exerciseName, muscleGroup, equipmentType);
  const pose = EXERCISE_POSES[poseKey] ?? EXERCISE_POSES['generic_push'];
  const { start, end, speed = 1 } = pose;

  const [joints, setJoints] = useState<Joints>(start);
  const tRef = useRef(-Math.PI / 2); // start at p=0

  useEffect(() => {
    tRef.current = -Math.PI / 2;
    setJoints(start);

    const totalDuration = 1200 / speed; // ms for one full out-and-back
    const intervalMs = 33; // ~30fps
    const increment = (2 * Math.PI) / (totalDuration / intervalMs);

    const id = setInterval(() => {
      tRef.current += increment;
      const p = (Math.sin(tRef.current) + 1) / 2; // smooth 0→1→0
      setJoints(lerpJoints(start, end, p));
    }, intervalMs);

    return () => clearInterval(id);
  }, [poseKey]);

  const isLying = ['bench', 'pushup', 'legpress', 'hipthrust'].includes(poseKey);
  const viewBox = isLying ? '0 0 140 120' : '0 0 120 175';
  const svgH = isLying ? 130 : 200;

  return (
    <View style={{ alignItems: 'center' }}>
      <View style={{
        backgroundColor: Colors.surface2,
        borderRadius: 16,
        padding: 12,
        borderWidth: 1,
        borderColor: Colors.border,
        alignItems: 'center',
      }}>
        <Svg width={200} height={svgH} viewBox={viewBox}>
          {/* Ground line */}
          {!isLying && (
            <Line x1={8} y1={158} x2={112} y2={158}
              stroke={Colors.border} strokeWidth={1.5} strokeLinecap="round" />
          )}

          {/* Far arm (faded) */}
          {FAR_BONES.map(([a, b], i) => (
            <Line
              key={`far-${i}`}
              x1={joints[a][0]} y1={joints[a][1]}
              x2={joints[b][0]} y2={joints[b][1]}
              stroke={Colors.accent} strokeWidth={2.5}
              strokeLinecap="round" opacity={0.3}
            />
          ))}

          {/* Main skeleton */}
          {BONES.map(([a, b], i) => (
            <Line
              key={`bone-${i}`}
              x1={joints[a][0]} y1={joints[a][1]}
              x2={joints[b][0]} y2={joints[b][1]}
              stroke={Colors.accent} strokeWidth={3.5}
              strokeLinecap="round"
            />
          ))}

          {/* Head */}
          <Circle cx={joints[0][0]} cy={joints[0][1]} r={10}
            fill={Colors.accent} />

          {/* Key joints */}
          {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
            <Circle key={i} cx={joints[i][0]} cy={joints[i][1]}
              r={3} fill={Colors.accent} />
          ))}

          {/* Far arm joints */}
          {[10, 11, 12].map(i => (
            <Circle key={i} cx={joints[i][0]} cy={joints[i][1]}
              r={2.5} fill={Colors.accent} opacity={0.3} />
          ))}
        </Svg>
      </View>
    </View>
  );
}
