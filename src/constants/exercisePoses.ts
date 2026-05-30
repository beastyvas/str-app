// Exercise animation pose system
// Canvas: 120×175 viewBox for standing, 140×120 for lying exercises
// Joints: head(0) neck(1) near_shoulder(2) near_elbow(3) near_wrist(4)
//         spine(5) hips(6) near_knee(7) near_ankle(8) near_toe(9)
//         far_shoulder(10) far_elbow(11) far_wrist(12)

export type Joints = [number, number][];

export interface ExercisePose {
  start: Joints;
  end: Joints;
  speed?: number;
}

// ── STANDING BASELINE ──────────────────────────────────────────────────────
const STANDING: Joints = [
  [60, 12],  // 0 head
  [60, 24],  // 1 neck
  [46, 34],  // 2 near shoulder
  [38, 56],  // 3 near elbow
  [34, 72],  // 4 near wrist
  [60, 58],  // 5 spine
  [60, 80],  // 6 hips
  [54, 114], // 7 near knee
  [52, 148], // 8 near ankle
  [50, 158], // 9 near toe
  [72, 34],  // 10 far shoulder
  [80, 56],  // 11 far elbow
  [84, 72],  // 12 far wrist
];

export const EXERCISE_POSES: Record<string, ExercisePose> = {

  // ── SQUAT ──────────────────────────────────────────────────────────────────
  squat: {
    start: [ // standing, bar on back
      [60, 10], [60, 22], [46, 32], [46, 46], [46, 58],
      [60, 54], [60, 76], [56, 110], [54, 144], [52, 154],
      [72, 32], [72, 46], [72, 58],
    ],
    end: [ // bottom of squat — knees out, hips back, upright torso
      [58, 50], [58, 62], [44, 72], [30, 88], [28, 100],
      [58, 84], [52, 102], [28, 124], [38, 150], [44, 158],
      [70, 72], [82, 88], [86, 100],
    ],
    speed: 1.3,
  },

  // ── DEADLIFT ────────────────────────────────────────────────────────────────
  deadlift: {
    start: [ // bottom — bent over, bar at shins
      [46, 68], [50, 58], [40, 48], [44, 76], [50, 98],
      [60, 62], [66, 84], [62, 116], [60, 150], [58, 158],
      [70, 46], [74, 74], [78, 96],
    ],
    end: [ // lockout — standing tall
      [60, 12], [60, 24], [46, 34], [40, 56], [36, 74],
      [60, 58], [60, 80], [54, 114], [52, 148], [50, 158],
      [72, 34], [78, 56], [82, 74],
    ],
    speed: 1.2,
  },

  // ── BENCH PRESS (lying, side view) ─────────────────────────────────────────
  bench: {
    start: [ // arms bent, bar at chest
      [18, 80],  // head lying left
      [30, 80],  // neck
      [44, 80],  // near shoulder (at bench level)
      [50, 62],  // near elbow (flared up and out)
      [44, 46],  // near wrist (bar at chest)
      [62, 82],  // spine
      [82, 82],  // hips
      [102, 76], // knee (feet flat)
      [118, 70], // ankle
      [122, 76], // toe
      [44, 92],  // far shoulder
      [50, 108], // far elbow
      [44, 116], // far wrist
    ],
    end: [ // arms locked out — bar straight up
      [18, 80],
      [30, 80],
      [44, 80],
      [44, 52],  // elbow straightening
      [44, 18],  // wrist — bar fully overhead!
      [62, 82],
      [82, 82],
      [102, 76],
      [118, 70],
      [122, 76],
      [44, 92],
      [44, 108],
      [44, 116],
    ],
    speed: 0.9,
  },

  // ── OVERHEAD PRESS ──────────────────────────────────────────────────────────
  ohp: {
    start: [ // bar at shoulders, elbows forward
      [60, 12], [60, 24], [46, 34], [44, 46], [46, 34],
      [60, 58], [60, 80], [54, 114], [52, 148], [50, 158],
      [72, 34], [74, 46], [72, 34],
    ],
    end: [ // bar locked out overhead — arms fully extended
      [60, 12], [60, 24], [46, 34], [46, 20], [46, 4],
      [60, 58], [60, 80], [54, 114], [52, 148], [50, 158],
      [72, 34], [72, 20], [72, 4],
    ],
    speed: 0.9,
  },

  // ── PULL-UP ─────────────────────────────────────────────────────────────────
  pullup: {
    start: [ // dead hang — arms straight overhead
      [60, 110], [60, 120], [50, 108], [46, 90], [46, 72],
      [60, 136], [60, 156], [56, 168], [54, 172], [52, 174],
      [68, 108], [72, 90], [72, 72],
    ],
    end: [ // chin above bar — body pulled up
      [60, 30], [60, 42], [50, 16], [46, 8], [46, 4],
      [60, 68], [60, 88], [58, 120], [56, 154], [54, 164],
      [68, 16], [72, 8], [72, 4],
    ],
    speed: 1.3,
  },

  // ── ROW (barbell / cable) ───────────────────────────────────────────────────
  row: {
    start: [ // hinged, arms hanging straight down
      [44, 62], [50, 52], [40, 44], [42, 72], [44, 96],
      [60, 62], [66, 84], [62, 116], [60, 150], [58, 158],
      [70, 42], [72, 70], [74, 94],
    ],
    end: [ // bar pulled to stomach, elbows back
      [44, 62], [50, 52], [40, 44], [30, 58], [32, 72],
      [60, 62], [66, 84], [62, 116], [60, 150], [58, 158],
      [70, 42], [82, 56], [84, 70],
    ],
    speed: 1.0,
  },

  // ── LAT PULLDOWN ────────────────────────────────────────────────────────────
  pulldown: {
    start: [ // arms overhead reaching for bar
      [60, 14], [60, 26], [46, 18], [44, 6], [44, 2],
      [60, 58], [60, 78], [54, 110], [52, 140], [50, 150],
      [72, 18], [74, 6], [74, 2],
    ],
    end: [ // bar pulled to upper chest, elbows driven down
      [60, 14], [60, 26], [46, 34], [38, 54], [44, 42],
      [60, 58], [60, 78], [54, 110], [52, 140], [50, 150],
      [72, 34], [80, 54], [74, 42],
    ],
    speed: 1.0,
  },

  // ── BICEP CURL ──────────────────────────────────────────────────────────────
  curl: {
    start: [ // arm hanging straight down
      [60, 12], [60, 24], [46, 34], [40, 58], [38, 80],
      [60, 58], [60, 80], [54, 114], [52, 148], [50, 158],
      [72, 34], [78, 58], [80, 80],
    ],
    end: [ // arm fully curled — wrist near shoulder
      [60, 12], [60, 24], [46, 34], [36, 50], [42, 30],
      [60, 58], [60, 80], [54, 114], [52, 148], [50, 158],
      [72, 34], [82, 50], [76, 30],
    ],
    speed: 0.8,
  },

  // ── TRICEP PUSHDOWN ─────────────────────────────────────────────────────────
  pushdown: {
    start: [ // elbows at sides, forearms bent up (rope at face)
      [60, 12], [60, 24], [48, 34], [44, 52], [48, 34],
      [60, 58], [60, 80], [54, 114], [52, 148], [50, 158],
      [70, 34], [74, 52], [70, 34],
    ],
    end: [ // arms pushed straight down — full extension
      [60, 12], [60, 24], [48, 34], [44, 52], [42, 76],
      [60, 58], [60, 80], [54, 114], [52, 148], [50, 158],
      [70, 34], [74, 52], [76, 76],
    ],
    speed: 0.8,
  },

  // ── CABLE KICKBACK ──────────────────────────────────────────────────────────
  kickback: {
    start: [ // hinged forward, upper arm parallel to floor, forearm hanging down 90°
      [30, 44], [42, 48], [56, 50], [78, 50], [74, 68],
      [58, 66], [62, 84], [56, 116], [52, 148], [50, 156],
      [60, 60], [80, 60], [76, 78],
    ],
    end: [ // arm fully extended BACK — forearm parallel to floor
      [30, 44], [42, 48], [56, 50], [78, 50], [98, 46],
      [58, 66], [62, 84], [56, 116], [52, 148], [50, 156],
      [60, 60], [80, 60], [100, 56],
    ],
    speed: 0.8,
  },

  // ── PUSH-UP ─────────────────────────────────────────────────────────────────
  pushup: {
    start: [ // chest near floor
      [18, 78], [28, 76], [44, 72], [60, 78], [74, 96],
      [66, 70], [86, 66], [104, 68], [118, 70], [122, 76],
      [46, 82], [62, 88], [76, 104],
    ],
    end: [ // arms extended — body raised
      [18, 58], [28, 58], [44, 54], [60, 50], [74, 86],
      [66, 52], [86, 50], [104, 54], [118, 58], [122, 64],
      [46, 64], [62, 60], [76, 94],
    ],
    speed: 0.9,
  },

  // ── LUNGE ───────────────────────────────────────────────────────────────────
  lunge: {
    start: STANDING,
    end: [ // front knee bent deep, back knee near floor
      [52, 16], [54, 28], [42, 38], [36, 58], [34, 74],
      [54, 62], [50, 84], [26, 112], [30, 148], [36, 156],
      [68, 38], [76, 58], [80, 74],
    ],
    speed: 1.1,
  },

  // ── LEG PRESS (seated, reclined) ────────────────────────────────────────────
  legpress: {
    start: [ // legs bent, feet on plate
      [16, 56], [26, 56], [40, 50], [48, 62], [60, 68],
      [46, 64], [60, 76], [86, 68], [108, 62], [116, 66],
      [42, 64], [54, 74], [66, 80],
    ],
    end: [ // legs extended on plate
      [16, 56], [26, 56], [40, 50], [48, 62], [60, 68],
      [46, 64], [58, 78], [82, 94], [106, 84], [116, 88],
      [42, 64], [54, 74], [66, 80],
    ],
    speed: 1.0,
  },

  // ── HIP THRUST ──────────────────────────────────────────────────────────────
  hipthrust: {
    start: [ // hips low, shoulders on bench
      [22, 58], [30, 62], [44, 60], [56, 72], [68, 80],
      [52, 74], [68, 90], [90, 96], [108, 86], [116, 90],
      [46, 68], [60, 80], [72, 88],
    ],
    end: [ // hips fully extended, body in straight line
      [22, 44], [30, 50], [42, 48], [54, 60], [66, 70],
      [48, 60], [62, 64], [86, 70], [108, 76], [116, 80],
      [44, 56], [58, 68], [70, 78],
    ],
    speed: 1.0,
  },

  // ── LATERAL RAISE ───────────────────────────────────────────────────────────
  lateralraise: {
    start: [ // arms at sides
      [60, 12], [60, 24], [46, 34], [40, 56], [38, 74],
      [60, 58], [60, 80], [54, 114], [52, 148], [50, 158],
      [72, 34], [78, 56], [80, 74],
    ],
    end: [ // arms raised to shoulder height — T-pose
      [60, 12], [60, 24], [46, 34], [24, 34], [10, 34],
      [60, 58], [60, 80], [54, 114], [52, 148], [50, 158],
      [72, 34], [92, 34], [106, 34],
    ],
    speed: 0.8,
  },

  // ── RDL / HIP HINGE ─────────────────────────────────────────────────────────
  hinge: {
    start: STANDING,
    end: [ // hinged forward, bar at shin level
      [44, 66], [50, 56], [38, 46], [40, 74], [44, 96],
      [58, 62], [62, 84], [58, 118], [56, 152], [54, 160],
      [68, 44], [70, 72], [74, 94],
    ],
    speed: 1.1,
  },

  // ── GENERIC PUSH ────────────────────────────────────────────────────────────
  generic_push: {
    start: STANDING,
    end: [ // arms punching forward — clear movement
      [60, 12], [60, 24], [48, 34], [40, 44], [22, 44],
      [60, 58], [60, 80], [54, 114], [52, 148], [50, 158],
      [70, 34], [78, 44], [94, 44],
    ],
    speed: 0.9,
  },

  // ── GENERIC PULL ────────────────────────────────────────────────────────────
  generic_pull: {
    start: [ // arms reaching forward
      [60, 12], [60, 24], [48, 34], [40, 44], [22, 44],
      [60, 58], [60, 80], [54, 114], [52, 148], [50, 158],
      [70, 34], [78, 44], [94, 44],
    ],
    end: STANDING,
    speed: 0.9,
  },
};

// ── EXERCISE → POSE KEY MAPPING ────────────────────────────────────────────
export function getPoseKey(exerciseName: string, muscleGroup: string, equipmentType?: string): string {
  const n = exerciseName.toLowerCase();
  const m = muscleGroup.toLowerCase();

  // Specific name matches (order matters — most specific first)
  if (n.includes('kickback'))                                               return 'kickback';
  if (n.includes('squat') && !n.includes('leg press'))                     return 'squat';
  if (n.includes('deadlift') && !n.includes('rdl') && !n.includes('romanian')) return 'deadlift';
  if (n.includes('bench press') || n.includes('floor press'))              return 'bench';
  if (n.includes('overhead press') || n.includes('ohp') || n.includes('military press')) return 'ohp';
  if (n.includes('pull-up') || n.includes('pullup') || n.includes('chin'))return 'pullup';
  if (n.includes('muscle-up') || n.includes('muscle up'))                  return 'pullup';
  if (n.includes('push-up') || n.includes('push up'))                      return 'pushup';
  if (n.includes('hip thrust') || n.includes('glute bridge') || n.includes('kas glute')) return 'hipthrust';
  if (n.includes('rdl') || n.includes('romanian') || n.includes('good morning')) return 'hinge';
  if (n.includes('lunge') || n.includes('split squat') || n.includes('step-up')) return 'lunge';
  if (n.includes('leg press'))                                              return 'legpress';
  if (n.includes('lateral raise') || n.includes('side raise'))             return 'lateralraise';
  if (n.includes('pulldown') || n.includes('pull down') || n.includes('lat pulldown')) return 'pulldown';
  if (n.includes('curl') && !n.includes('glute'))                          return 'curl';
  if (n.includes('pushdown') || n.includes('extension') && m.includes('tricep')) return 'pushdown';
  if (n.includes('row') || n.includes('pendlay') || n.includes('t-bar'))   return 'row';
  if (n.includes('swing') || n.includes('back extension'))                  return 'hinge';

  // Category fallbacks
  if (m.includes('chest') || m.includes('tricep'))                         return 'generic_push';
  if (m.includes('back') || m.includes('lat') || m.includes('bicep'))      return 'generic_pull';
  if (m.includes('quad') || m.includes('hamstring') || m.includes('glute')) return 'squat';
  if (m.includes('shoulder'))                                               return 'lateralraise';

  return 'generic_push';
}
