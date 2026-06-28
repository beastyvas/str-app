import { View, Text } from 'react-native';
import Svg, { Ellipse, Rect, Path } from 'react-native-svg';
import { Colors } from '@/constants/colors';

// Separate from MuscleMap (which highlights a single exercise's muscles on the
// exercise-detail screen). This one shades the WHOLE body by how much volume
// each muscle group has seen over a window — a training heatmap, Hevy-style.
// The SVG art is intentionally a standalone copy so the exercise-detail
// MuscleMap stays completely untouched.

interface MuscleHeatmapProps {
  // muscle_group (as stored on exercises.muscle_group) → aggregated work
  // (we pass set counts). Higher = brighter accent.
  volumeByGroup: Record<string, number>;
}

// muscle_group name → which SVG body regions to shade. Region ids match the
// shapes drawn below. 'Overall' (full-body/compound/cardio) is intentionally
// left unmapped so it doesn't light up the entire silhouette.
const GROUP_REGIONS: Record<string, string[]> = {
  'Chest': ['chest'],
  'Shoulders': ['shoulder_l', 'shoulder_r'],
  'Quads': ['quad_l', 'quad_r'],
  'Lats': ['lat_l', 'lat_r'],
  'Glutes': ['glute_l', 'glute_r'],
  'Core': ['core'],
  'Mid-Upper Back': ['trap', 'upper_back'],
  'Biceps': ['bicep_l', 'bicep_r'],
  'Triceps': ['tricep_l', 'tricep_r'],
  'Hamstrings': ['ham_l', 'ham_r'],
  'Calves': ['calf_l', 'calf_r'],
  'Traps': ['trap'],
  'Forearms': ['forearm_l', 'forearm_r'],
  'Lower Back': ['lower_back'],
  'Hip Flexors': ['hip_l', 'hip_r'],
  'Adductors': ['quad_l', 'quad_r'],
  'Tibialis': ['calf_l', 'calf_r'],
};

function alphaHex(t: number): string {
  const a = Math.round(Math.max(0, Math.min(1, t)) * 255);
  return a.toString(16).padStart(2, '0');
}

export function MuscleHeatmap({ volumeByGroup }: MuscleHeatmapProps) {
  // Normalize against the busiest mapped group so the scale is relative to the
  // user's own training, not an absolute number.
  const mapped = Object.entries(volumeByGroup).filter(([g]) => GROUP_REGIONS[g]);
  const maxVal = Math.max(1, ...mapped.map(([, v]) => v));

  // Region → normalized intensity 0..1 (max when several groups share a region)
  const intensity: Record<string, number> = {};
  for (const [group, val] of mapped) {
    const t = val / maxVal;
    for (const region of GROUP_REGIONS[group]) {
      intensity[region] = Math.max(intensity[region] ?? 0, t);
    }
  }

  const fill = (region: string): string => {
    const t = intensity[region] ?? 0;
    if (t <= 0) return Colors.surface3; // untrained = dim grey
    // 0.25→1.0 alpha so even light work is visible above the grey base
    return Colors.accent + alphaHex(0.25 + 0.75 * t);
  };
  const stroke = (region: string): string =>
    (intensity[region] ?? 0) > 0 ? Colors.accent + '90' : Colors.border;
  const sw = (region: string): number => ((intensity[region] ?? 0) > 0 ? 1.5 : 1);

  const W = 132;

  return (
    <View style={{ alignItems: 'center' }}>
      <View style={{ flexDirection: 'row', gap: 14, alignItems: 'flex-start' }}>
        {/* FRONT VIEW */}
        <View style={{ alignItems: 'center' }}>
          <Text style={{ color: Colors.textMuted, fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 6 }}>
            Front
          </Text>
          <Svg width={W} height={244} viewBox="0 0 100 185">
            <Ellipse cx={50} cy={10} rx={12} ry={10} fill={Colors.surface2} stroke={Colors.border} strokeWidth={1} />
            <Rect x={46} y={19} width={8} height={9} fill={Colors.surface2} stroke={Colors.border} strokeWidth={1} />

            <Path d="M38,28 Q50,24 62,28 L64,36 Q50,32 36,36 Z"
              fill={fill('trap')} stroke={stroke('trap')} strokeWidth={sw('trap')} />

            <Ellipse cx={28} cy={36} rx={12} ry={9} fill={fill('shoulder_l')} stroke={stroke('shoulder_l')} strokeWidth={sw('shoulder_l')} />
            <Ellipse cx={72} cy={36} rx={12} ry={9} fill={fill('shoulder_r')} stroke={stroke('shoulder_r')} strokeWidth={sw('shoulder_r')} />

            <Path d="M36,28 Q50,30 64,28 L67,52 Q50,56 33,52 Z"
              fill={fill('chest')} stroke={stroke('chest')} strokeWidth={sw('chest')} />

            <Rect x={16} y={38} width={11} height={30} rx={5}
              fill={fill('bicep_l')} stroke={stroke('bicep_l')} strokeWidth={sw('bicep_l')} />
            <Rect x={73} y={38} width={11} height={30} rx={5}
              fill={fill('bicep_r')} stroke={stroke('bicep_r')} strokeWidth={sw('bicep_r')} />

            <Rect x={13} y={40} width={6} height={26} rx={3}
              fill={fill('tricep_l')} stroke={stroke('tricep_l')} strokeWidth={sw('tricep_l')} />
            <Rect x={81} y={40} width={6} height={26} rx={3}
              fill={fill('tricep_r')} stroke={stroke('tricep_r')} strokeWidth={sw('tricep_r')} />

            <Rect x={14} y={70} width={10} height={28} rx={4}
              fill={fill('forearm_l')} stroke={stroke('forearm_l')} strokeWidth={sw('forearm_l')} />
            <Rect x={76} y={70} width={10} height={28} rx={4}
              fill={fill('forearm_r')} stroke={stroke('forearm_r')} strokeWidth={sw('forearm_r')} />

            <Rect x={35} y={52} width={30} height={32} rx={4}
              fill={fill('core')} stroke={stroke('core')} strokeWidth={sw('core')} />

            <Path d="M33,52 L27,80 L35,84 L35,84 Z"
              fill={fill('lat_l')} stroke={stroke('lat_l')} strokeWidth={sw('lat_l')} />
            <Path d="M67,52 L73,80 L65,84 L65,84 Z"
              fill={fill('lat_r')} stroke={stroke('lat_r')} strokeWidth={sw('lat_r')} />

            <Rect x={34} y={84} width={32} height={14} rx={5}
              fill={fill('hip_l')} stroke={stroke('hip_l')} strokeWidth={sw('hip_l')} />

            <Ellipse cx={38} cy={98} rx={10} ry={7}
              fill={fill('glute_l')} stroke={stroke('glute_l')} strokeWidth={sw('glute_l')} />
            <Ellipse cx={62} cy={98} rx={10} ry={7}
              fill={fill('glute_r')} stroke={stroke('glute_r')} strokeWidth={sw('glute_r')} />

            <Rect x={32} y={104} width={16} height={44} rx={7}
              fill={fill('quad_l')} stroke={stroke('quad_l')} strokeWidth={sw('quad_l')} />
            <Rect x={52} y={104} width={16} height={44} rx={7}
              fill={fill('quad_r')} stroke={stroke('quad_r')} strokeWidth={sw('quad_r')} />

            <Rect x={33} y={152} width={14} height={30} rx={6}
              fill={fill('calf_l')} stroke={stroke('calf_l')} strokeWidth={sw('calf_l')} />
            <Rect x={53} y={152} width={14} height={30} rx={6}
              fill={fill('calf_r')} stroke={stroke('calf_r')} strokeWidth={sw('calf_r')} />
          </Svg>
        </View>

        {/* BACK VIEW */}
        <View style={{ alignItems: 'center' }}>
          <Text style={{ color: Colors.textMuted, fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 6 }}>
            Back
          </Text>
          <Svg width={W} height={244} viewBox="0 0 100 185">
            <Ellipse cx={50} cy={10} rx={12} ry={10} fill={Colors.surface2} stroke={Colors.border} strokeWidth={1} />
            <Rect x={46} y={19} width={8} height={9} fill={Colors.surface2} stroke={Colors.border} strokeWidth={1} />

            <Path d="M38,28 Q50,22 62,28 L64,44 Q50,40 36,44 Z"
              fill={fill('trap')} stroke={stroke('trap')} strokeWidth={sw('trap')} />

            <Ellipse cx={28} cy={36} rx={12} ry={9} fill={fill('shoulder_l')} stroke={stroke('shoulder_l')} strokeWidth={sw('shoulder_l')} />
            <Ellipse cx={72} cy={36} rx={12} ry={9} fill={fill('shoulder_r')} stroke={stroke('shoulder_r')} strokeWidth={sw('shoulder_r')} />

            <Rect x={36} y={44} width={28} height={20} rx={4}
              fill={fill('upper_back')} stroke={stroke('upper_back')} strokeWidth={sw('upper_back')} />

            <Rect x={15} y={38} width={12} height={32} rx={5}
              fill={fill('tricep_l')} stroke={stroke('tricep_l')} strokeWidth={sw('tricep_l')} />
            <Rect x={73} y={38} width={12} height={32} rx={5}
              fill={fill('tricep_r')} stroke={stroke('tricep_r')} strokeWidth={sw('tricep_r')} />

            <Rect x={14} y={72} width={10} height={28} rx={4}
              fill={fill('forearm_l')} stroke={stroke('forearm_l')} strokeWidth={sw('forearm_l')} />
            <Rect x={76} y={72} width={10} height={28} rx={4}
              fill={fill('forearm_r')} stroke={stroke('forearm_r')} strokeWidth={sw('forearm_r')} />

            <Path d="M36,44 L24,76 L36,82 L36,64 Z"
              fill={fill('lat_l')} stroke={stroke('lat_l')} strokeWidth={sw('lat_l')} />
            <Path d="M64,44 L76,76 L64,82 L64,64 Z"
              fill={fill('lat_r')} stroke={stroke('lat_r')} strokeWidth={sw('lat_r')} />

            <Rect x={36} y={64} width={28} height={22} rx={3}
              fill={fill('lower_back')} stroke={stroke('lower_back')} strokeWidth={sw('lower_back')} />

            <Ellipse cx={40} cy={96} rx={12} ry={10}
              fill={fill('glute_l')} stroke={stroke('glute_l')} strokeWidth={sw('glute_l')} />
            <Ellipse cx={60} cy={96} rx={12} ry={10}
              fill={fill('glute_r')} stroke={stroke('glute_r')} strokeWidth={sw('glute_r')} />

            <Rect x={33} y={105} width={15} height={44} rx={7}
              fill={fill('ham_l')} stroke={stroke('ham_l')} strokeWidth={sw('ham_l')} />
            <Rect x={52} y={105} width={15} height={44} rx={7}
              fill={fill('ham_r')} stroke={stroke('ham_r')} strokeWidth={sw('ham_r')} />

            <Rect x={34} y={153} width={13} height={30} rx={6}
              fill={fill('calf_l')} stroke={stroke('calf_l')} strokeWidth={sw('calf_l')} />
            <Rect x={53} y={153} width={13} height={30} rx={6}
              fill={fill('calf_r')} stroke={stroke('calf_r')} strokeWidth={sw('calf_r')} />
          </Svg>
        </View>
      </View>

      {/* Legend — dim grey (none) → bright accent (most) */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 }}>
        <Text style={{ color: Colors.textMuted, fontSize: 10 }}>Less</Text>
        {[0, 0.25, 0.5, 0.75, 1].map((t, i) => (
          <View
            key={i}
            style={{
              width: 18, height: 10, borderRadius: 2,
              backgroundColor: t <= 0 ? Colors.surface3 : Colors.accent + alphaHex(0.25 + 0.75 * t),
            }}
          />
        ))}
        <Text style={{ color: Colors.textMuted, fontSize: 10 }}>More</Text>
      </View>
    </View>
  );
}
