import { View, Text } from 'react-native';
import Svg, { Ellipse, Rect, Path, G } from 'react-native-svg';
import { Colors } from '@/constants/colors';

interface MuscleMapProps {
  primaryMuscle: string;
  secondaryMuscle?: string | null;
}

// Map muscle group names → which SVG regions to highlight
const MUSCLE_REGIONS: Record<string, string[]> = {
  'Chest': ['chest'],
  'Shoulders': ['shoulder_l', 'shoulder_r', 'front_delt_l', 'front_delt_r'],
  'Triceps': ['tricep_l', 'tricep_r'],
  'Biceps': ['bicep_l', 'bicep_r'],
  'Mid-Upper Back': ['trap', 'upper_back'],
  'Lats': ['lat_l', 'lat_r'],
  'Quads': ['quad_l', 'quad_r'],
  'Hamstrings': ['ham_l', 'ham_r'],
  'Glutes': ['glute_l', 'glute_r'],
  'Core': ['core'],
  'Calves': ['calf_l', 'calf_r'],
  'Forearms': ['forearm_l', 'forearm_r'],
  'Overall': ['chest', 'quad_l', 'quad_r', 'lat_l', 'lat_r', 'ham_l', 'ham_r', 'glute_l', 'glute_r'],
  'Upper Traps': ['trap'],
  'Rear Delts': ['trap', 'upper_back'],
  'Lower Back': ['lower_back'],
  'Adductors': ['inner_quad_l', 'inner_quad_r'],
  'Brachialis': ['bicep_l', 'bicep_r'],
  'Brachioradialis': ['forearm_l', 'forearm_r'],
  'TFL': ['hip_l', 'hip_r'],
  'Hip Flexors': ['hip_l', 'hip_r'],
};

function getMuscleRegions(muscleStr: string): string[] {
  const regions: string[] = [];
  const parts = muscleStr.split(/[,\/]/).map(s => s.trim());
  for (const part of parts) {
    const key = Object.keys(MUSCLE_REGIONS).find(k =>
      k.toLowerCase() === part.toLowerCase() ||
      part.toLowerCase().includes(k.toLowerCase()) ||
      k.toLowerCase().includes(part.toLowerCase())
    );
    if (key) regions.push(...MUSCLE_REGIONS[key]);
  }
  return [...new Set(regions)];
}

export function MuscleMap({ primaryMuscle, secondaryMuscle }: MuscleMapProps) {
  const primary = new Set(getMuscleRegions(primaryMuscle));
  const secondary = new Set(getMuscleRegions(secondaryMuscle ?? ''));

  const fill = (region: string): string => {
    if (primary.has(region)) return Colors.accent;
    if (secondary.has(region)) return Colors.accent + '50';
    return Colors.surface3;
  };

  const stroke = (region: string): string => {
    if (primary.has(region)) return Colors.accent;
    if (secondary.has(region)) return Colors.accent + '80';
    return Colors.border;
  };

  const sw = (region: string): number => primary.has(region) || secondary.has(region) ? 1.5 : 1;

  const W = 160;

  return (
    <View style={{ alignItems: 'center' }}>
      <View style={{ flexDirection: 'row', gap: 16, alignItems: 'flex-start' }}>
        {/* FRONT VIEW */}
        <View style={{ alignItems: 'center' }}>
          <Text style={{ color: Colors.textMuted, fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 6 }}>
            Front
          </Text>
          <Svg width={W} height={300} viewBox="0 0 100 185">
            {/* Head */}
            <Ellipse cx={50} cy={10} rx={12} ry={10} fill={Colors.surface2} stroke={Colors.border} strokeWidth={1} />
            {/* Neck */}
            <Rect x={46} y={19} width={8} height={9} fill={Colors.surface2} stroke={Colors.border} strokeWidth={1} />

            {/* Trap / upper back (visible from front) */}
            <Path d="M38,28 Q50,24 62,28 L64,36 Q50,32 36,36 Z"
              fill={fill('trap')} stroke={stroke('trap')} strokeWidth={sw('trap')} />

            {/* Left shoulder */}
            <Ellipse cx={28} cy={36} rx={12} ry={9} fill={fill('shoulder_l')} stroke={stroke('shoulder_l')} strokeWidth={sw('shoulder_l')} />
            {/* Right shoulder */}
            <Ellipse cx={72} cy={36} rx={12} ry={9} fill={fill('shoulder_r')} stroke={stroke('shoulder_r')} strokeWidth={sw('shoulder_r')} />

            {/* Chest */}
            <Path d="M36,28 Q50,30 64,28 L67,52 Q50,56 33,52 Z"
              fill={fill('chest')} stroke={stroke('chest')} strokeWidth={sw('chest')} />

            {/* Left bicep */}
            <Rect x={16} y={38} width={11} height={30} rx={5}
              fill={fill('bicep_l')} stroke={stroke('bicep_l')} strokeWidth={sw('bicep_l')} />
            {/* Right bicep */}
            <Rect x={73} y={38} width={11} height={30} rx={5}
              fill={fill('bicep_r')} stroke={stroke('bicep_r')} strokeWidth={sw('bicep_r')} />

            {/* Left tricep (slightly behind, shown faintly) */}
            <Rect x={13} y={40} width={6} height={26} rx={3}
              fill={fill('tricep_l')} stroke={stroke('tricep_l')} strokeWidth={sw('tricep_l')} />
            {/* Right tricep */}
            <Rect x={81} y={40} width={6} height={26} rx={3}
              fill={fill('tricep_r')} stroke={stroke('tricep_r')} strokeWidth={sw('tricep_r')} />

            {/* Left forearm */}
            <Rect x={14} y={70} width={10} height={28} rx={4}
              fill={fill('forearm_l')} stroke={stroke('forearm_l')} strokeWidth={sw('forearm_l')} />
            {/* Right forearm */}
            <Rect x={76} y={70} width={10} height={28} rx={4}
              fill={fill('forearm_r')} stroke={stroke('forearm_r')} strokeWidth={sw('forearm_r')} />

            {/* Core / abs */}
            <Rect x={35} y={52} width={30} height={32} rx={4}
              fill={fill('core')} stroke={stroke('core')} strokeWidth={sw('core')} />

            {/* Lat left */}
            <Path d="M33,52 L27,80 L35,84 L35,84 Z"
              fill={fill('lat_l')} stroke={stroke('lat_l')} strokeWidth={sw('lat_l')} />
            {/* Lat right */}
            <Path d="M67,52 L73,80 L65,84 L65,84 Z"
              fill={fill('lat_r')} stroke={stroke('lat_r')} strokeWidth={sw('lat_r')} />

            {/* Hip / lower abs */}
            <Rect x={34} y={84} width={32} height={14} rx={5}
              fill={fill('hip_l')} stroke={Colors.border} strokeWidth={1} />

            {/* Left glute (hip area front) */}
            <Ellipse cx={38} cy={98} rx={10} ry={7}
              fill={fill('glute_l')} stroke={stroke('glute_l')} strokeWidth={sw('glute_l')} />
            {/* Right glute */}
            <Ellipse cx={62} cy={98} rx={10} ry={7}
              fill={fill('glute_r')} stroke={stroke('glute_r')} strokeWidth={sw('glute_r')} />

            {/* Left quad */}
            <Rect x={32} y={104} width={16} height={44} rx={7}
              fill={fill('quad_l')} stroke={stroke('quad_l')} strokeWidth={sw('quad_l')} />
            {/* Right quad */}
            <Rect x={52} y={104} width={16} height={44} rx={7}
              fill={fill('quad_r')} stroke={stroke('quad_r')} strokeWidth={sw('quad_r')} />

            {/* Left calf */}
            <Rect x={33} y={152} width={14} height={30} rx={6}
              fill={fill('calf_l')} stroke={stroke('calf_l')} strokeWidth={sw('calf_l')} />
            {/* Right calf */}
            <Rect x={53} y={152} width={14} height={30} rx={6}
              fill={fill('calf_r')} stroke={stroke('calf_r')} strokeWidth={sw('calf_r')} />
          </Svg>
        </View>

        {/* BACK VIEW */}
        <View style={{ alignItems: 'center' }}>
          <Text style={{ color: Colors.textMuted, fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 6 }}>
            Back
          </Text>
          <Svg width={W} height={300} viewBox="0 0 100 185">
            {/* Head */}
            <Ellipse cx={50} cy={10} rx={12} ry={10} fill={Colors.surface2} stroke={Colors.border} strokeWidth={1} />
            <Rect x={46} y={19} width={8} height={9} fill={Colors.surface2} stroke={Colors.border} strokeWidth={1} />

            {/* Traps (prominent from back) */}
            <Path d="M38,28 Q50,22 62,28 L64,44 Q50,40 36,44 Z"
              fill={fill('trap')} stroke={stroke('trap')} strokeWidth={sw('trap')} />

            {/* Left shoulder (back) */}
            <Ellipse cx={28} cy={36} rx={12} ry={9} fill={fill('shoulder_l')} stroke={stroke('shoulder_l')} strokeWidth={sw('shoulder_l')} />
            {/* Right shoulder (back) */}
            <Ellipse cx={72} cy={36} rx={12} ry={9} fill={fill('shoulder_r')} stroke={stroke('shoulder_r')} strokeWidth={sw('shoulder_r')} />

            {/* Upper back / rhomboids */}
            <Rect x={36} y={44} width={28} height={20} rx={4}
              fill={fill('upper_back')} stroke={stroke('upper_back')} strokeWidth={sw('upper_back')} />

            {/* Left tricep (prominent from back) */}
            <Rect x={15} y={38} width={12} height={32} rx={5}
              fill={fill('tricep_l')} stroke={stroke('tricep_l')} strokeWidth={sw('tricep_l')} />
            {/* Right tricep */}
            <Rect x={73} y={38} width={12} height={32} rx={5}
              fill={fill('tricep_r')} stroke={stroke('tricep_r')} strokeWidth={sw('tricep_r')} />

            {/* Left forearm back */}
            <Rect x={14} y={72} width={10} height={28} rx={4}
              fill={fill('forearm_l')} stroke={stroke('forearm_l')} strokeWidth={sw('forearm_l')} />
            {/* Right forearm back */}
            <Rect x={76} y={72} width={10} height={28} rx={4}
              fill={fill('forearm_r')} stroke={stroke('forearm_r')} strokeWidth={sw('forearm_r')} />

            {/* Lats */}
            <Path d="M36,44 L24,76 L36,82 L36,64 Z"
              fill={fill('lat_l')} stroke={stroke('lat_l')} strokeWidth={sw('lat_l')} />
            <Path d="M64,44 L76,76 L64,82 L64,64 Z"
              fill={fill('lat_r')} stroke={stroke('lat_r')} strokeWidth={sw('lat_r')} />

            {/* Lower back */}
            <Rect x={36} y={64} width={28} height={22} rx={3}
              fill={fill('lower_back')} stroke={stroke('lower_back')} strokeWidth={sw('lower_back')} />

            {/* Glutes */}
            <Ellipse cx={40} cy={96} rx={12} ry={10}
              fill={fill('glute_l')} stroke={stroke('glute_l')} strokeWidth={sw('glute_l')} />
            <Ellipse cx={60} cy={96} rx={12} ry={10}
              fill={fill('glute_r')} stroke={stroke('glute_r')} strokeWidth={sw('glute_r')} />

            {/* Hamstrings */}
            <Rect x={33} y={105} width={15} height={44} rx={7}
              fill={fill('ham_l')} stroke={stroke('ham_l')} strokeWidth={sw('ham_l')} />
            <Rect x={52} y={105} width={15} height={44} rx={7}
              fill={fill('ham_r')} stroke={stroke('ham_r')} strokeWidth={sw('ham_r')} />

            {/* Calves back */}
            <Rect x={34} y={153} width={13} height={30} rx={6}
              fill={fill('calf_l')} stroke={stroke('calf_l')} strokeWidth={sw('calf_l')} />
            <Rect x={53} y={153} width={13} height={30} rx={6}
              fill={fill('calf_r')} stroke={stroke('calf_r')} strokeWidth={sw('calf_r')} />
          </Svg>
        </View>
      </View>

      {/* Legend */}
      <View style={{ flexDirection: 'row', gap: 16, marginTop: 4 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: Colors.accent }} />
          <Text style={{ color: Colors.textMuted, fontSize: 10 }}>Primary</Text>
        </View>
        {secondaryMuscle && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: Colors.accent + '50' }} />
            <Text style={{ color: Colors.textMuted, fontSize: 10 }}>Secondary</Text>
          </View>
        )}
      </View>
    </View>
  );
}
