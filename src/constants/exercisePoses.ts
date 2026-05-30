// Joint indices for the stick figure (side view, right side facing right)
// 0:head, 1:neck, 2:shoulder, 3:elbow, 4:wrist,
// 5:spine, 6:hips, 7:knee, 8:ankle, 9:toe
// 10:rear_shoulder, 11:rear_elbow, 12:rear_wrist (optional far arm)

export type Joints = [number, number][]; // [x, y] for each joint

export interface ExercisePose {
  start: Joints;
  end: Joints;
  speed?: number; // animation duration multiplier (default 1)
  mirror?: boolean; // reverse start/end for eccentric-first exercises
}

// Canvas: 120 wide, 180 tall, side view facing right
// Joints: head(0) neck(1) shoulder(2) elbow(3) wrist(4)
//         spine(5) hips(6) knee(7) ankle(8) toe(9)
//         rear_shoulder(10) rear_elbow(11) rear_wrist(12)

const STANDING: Joints = [
  [60, 12],  // 0 head
  [60, 24],  // 1 neck
  [50, 34],  // 2 shoulder (near)
  [44, 52],  // 3 elbow (near)
  [42, 68],  // 4 wrist (near)
  [60, 58],  // 5 spine mid
  [60, 78],  // 6 hips
  [58, 110], // 7 knee (near)
  [56, 142], // 8 ankle (near)
  [56, 150], // 9 toe (near)
  [68, 34],  // 10 rear shoulder
  [74, 52],  // 11 rear elbow
  [76, 68],  // 12 rear wrist
];

export const EXERCISE_POSES: Record<string, ExercisePose> = {

  // ── SQUAT ──────────────────────────────────────────────────────────────────
  squat: {
    start: [ // standing with bar on back
      [60, 12], [60, 24], [46, 32], [46, 44], [46, 56],
      [60, 56], [60, 76], [58, 108], [56, 140], [54, 148],
      [72, 32], [72, 44], [72, 56],
    ],
    end: [ // bottom of squat
      [60, 54], [60, 64], [44, 72], [32, 80], [32, 90],
      [56, 82], [52, 100], [30, 124], [42, 148], [48, 154],
      [70, 72], [80, 80], [80, 90],
    ],
    speed: 1.4,
  },

  // ── DEADLIFT ────────────────────────────────────────────────────────────────
  deadlift: {
    start: [ // bent over, bar at shins
      [50, 72], [54, 62], [44, 52], [44, 80], [50, 100],
      [62, 64], [68, 84], [66, 116], [64, 148], [62, 156],
      [72, 50], [72, 78], [68, 98],
    ],
    end: [ // lockout standing
      [62, 14], [62, 26], [52, 36], [46, 54], [44, 70],
      [62, 58], [62, 78], [60, 110], [58, 142], [56, 150],
      [70, 36], [74, 54], [76, 70],
    ],
    speed: 1.2,
  },

  // ── BENCH PRESS (side view, lying) ─────────────────────────────────────────
  bench: {
    start: [ // arms bent, bar at chest
      [22, 78], [34, 78], [52, 68], [68, 52], [80, 40],
      [70, 80], [90, 80], [105, 75], [116, 70], [118, 74],
      [52, 88], [68, 104], [80, 116],
    ],
    end: [ // arms extended up
      [22, 78], [34, 78], [52, 68], [66, 44], [72, 28],
      [70, 80], [90, 80], [105, 75], [116, 70], [118, 74],
      [52, 88], [66, 112], [72, 128],
    ],
    speed: 1.0,
  },

  // ── OVERHEAD PRESS ──────────────────────────────────────────────────────────
  ohp: {
    start: [ // bar at shoulders
      [60, 12], [60, 24], [48, 34], [42, 46], [44, 34],
      [60, 56], [60, 76], [58, 108], [56, 140], [54, 148],
      [70, 34], [76, 46], [74, 34],
    ],
    end: [ // bar overhead locked out
      [60, 12], [60, 24], [48, 34], [48, 18], [50, 4],
      [60, 56], [60, 76], [58, 108], [56, 140], [54, 148],
      [70, 34], [70, 18], [68, 4],
    ],
    speed: 0.9,
  },

  // ── PULL-UP ─────────────────────────────────────────────────────────────────
  pullup: {
    start: [ // dead hang
      [60, 100], [60, 110], [50, 116], [44, 138], [44, 156],
      [60, 128], [60, 148], [58, 168], [56, 174], [54, 176],
      [68, 116], [74, 138], [74, 156],
    ],
    end: [ // chin at bar
      [60, 30], [60, 40], [48, 18], [42, 10], [42, 4],
      [60, 62], [60, 80], [58, 112], [56, 144], [54, 152],
      [70, 18], [76, 10], [76, 4],
    ],
    speed: 1.3,
  },

  // ── BARBELL ROW ─────────────────────────────────────────────────────────────
  row: {
    start: [ // arms extended down, bar hanging
      [52, 70], [56, 60], [46, 50], [46, 78], [46, 100],
      [62, 62], [68, 82], [66, 114], [64, 146], [62, 154],
      [72, 48], [72, 76], [72, 98],
    ],
    end: [ // bar pulled to stomach
      [52, 70], [56, 60], [46, 50], [36, 64], [38, 78],
      [62, 62], [68, 82], [66, 114], [64, 146], [62, 154],
      [72, 48], [80, 62], [80, 76],
    ],
    speed: 1.0,
  },

  // ── BICEP CURL ──────────────────────────────────────────────────────────────
  curl: {
    start: [ // arm extended down
      [60, 12], [60, 24], [50, 34], [48, 54], [48, 74],
      [60, 56], [60, 76], [58, 108], [56, 140], [54, 148],
      [68, 34], [70, 54], [70, 74],
    ],
    end: [ // arm fully curled
      [60, 12], [60, 24], [50, 34], [40, 46], [46, 30],
      [60, 56], [60, 76], [58, 108], [56, 140], [54, 148],
      [68, 34], [76, 46], [70, 30],
    ],
    speed: 0.8,
  },

  // ── TRICEP PUSHDOWN ─────────────────────────────────────────────────────────
  pushdown: {
    start: [ // arms up, elbows bent
      [60, 12], [60, 24], [50, 34], [42, 46], [48, 30],
      [60, 56], [60, 76], [58, 108], [56, 140], [54, 148],
      [68, 34], [76, 46], [70, 30],
    ],
    end: [ // arms pushed down
      [60, 12], [60, 24], [50, 34], [44, 48], [44, 68],
      [60, 56], [60, 76], [58, 108], [56, 140], [54, 148],
      [68, 34], [74, 48], [74, 68],
    ],
    speed: 0.7,
  },

  // ── PUSH-UP ─────────────────────────────────────────────────────────────────
  pushup: {
    start: [ // chest to floor
      [20, 74], [32, 72], [48, 66], [58, 80], [68, 88],
      [68, 72], [88, 76], [104, 76], [116, 74], [118, 78],
      [50, 76], [58, 90], [66, 100],
    ],
    end: [ // arms extended
      [20, 56], [30, 56], [46, 52], [60, 40], [70, 32],
      [66, 58], [86, 62], [102, 64], [116, 64], [118, 68],
      [48, 60], [60, 76], [70, 86],
    ],
    speed: 0.9,
  },

  // ── LUNGE ───────────────────────────────────────────────────────────────────
  lunge: {
    start: STANDING,
    end: [ // split stance, front knee bent
      [52, 18], [54, 30], [44, 40], [40, 58], [40, 74],
      [56, 62], [54, 82], [36, 108], [34, 140], [36, 148],
      [70, 40], [74, 58], [76, 74],
    ],
    speed: 1.1,
  },

  // ── LEG PRESS (seated) ──────────────────────────────────────────────────────
  legpress: {
    start: [ // legs bent, feet on plate
      [20, 52], [28, 50], [44, 44], [50, 56], [62, 62],
      [48, 58], [64, 68], [90, 62], [110, 56], [114, 60],
      [46, 62], [56, 72], [68, 78],
    ],
    end: [ // legs extended
      [20, 52], [28, 50], [44, 44], [50, 56], [62, 62],
      [48, 58], [60, 70], [80, 88], [100, 80], [108, 82],
      [46, 62], [56, 72], [68, 78],
    ],
    speed: 1.0,
  },

  // ── LATERAL RAISE ───────────────────────────────────────────────────────────
  lateralraise: {
    start: [ // arms at sides
      [60, 12], [60, 24], [50, 34], [44, 52], [42, 68],
      [60, 56], [60, 76], [58, 108], [56, 140], [54, 148],
      [68, 34], [74, 52], [76, 68],
    ],
    end: [ // arms raised to 90°
      [60, 12], [60, 24], [50, 34], [34, 34], [22, 34],
      [60, 56], [60, 76], [58, 108], [56, 140], [54, 148],
      [68, 34], [82, 34], [94, 34],
    ],
    speed: 0.8,
  },

  // ── HIP THRUST ──────────────────────────────────────────────────────────────
  hipthrust: {
    start: [ // hips low, seated against bench
      [30, 52], [36, 54], [48, 50], [56, 62], [66, 70],
      [54, 68], [72, 82], [96, 84], [112, 76], [116, 80],
      [50, 60], [60, 72], [70, 80],
    ],
    end: [ // hips at full extension
      [28, 36], [34, 42], [44, 40], [52, 54], [62, 64],
      [50, 54], [66, 56], [90, 62], [108, 70], [112, 76],
      [46, 50], [56, 64], [66, 74],
    ],
    speed: 1.0,
  },

  // ── RDL / HINGE ─────────────────────────────────────────────────────────────
  hinge: {
    start: [ // top of movement, standing
      [62, 14], [62, 26], [52, 36], [46, 54], [44, 70],
      [62, 58], [62, 78], [60, 110], [58, 142], [56, 150],
      [70, 36], [74, 54], [76, 70],
    ],
    end: [ // hinge, bar at shins
      [50, 72], [54, 62], [44, 54], [44, 80], [48, 100],
      [60, 66], [66, 86], [66, 118], [64, 150], [62, 158],
      [72, 52], [72, 78], [68, 98],
    ],
    speed: 1.2,
  },

  // ── GENERIC PUSH (default for push exercises) ───────────────────────────────
  generic_push: {
    start: STANDING,
    end: [ // arms extended forward
      [60, 12], [60, 24], [50, 34], [44, 44], [32, 44],
      [60, 56], [60, 76], [58, 108], [56, 140], [54, 148],
      [68, 34], [74, 44], [86, 44],
    ],
    speed: 0.9,
  },

  // ── GENERIC PULL ────────────────────────────────────────────────────────────
  generic_pull: {
    start: [ // arms reaching
      [60, 12], [60, 24], [50, 34], [44, 44], [32, 44],
      [60, 56], [60, 76], [58, 108], [56, 140], [54, 148],
      [68, 34], [74, 44], [86, 44],
    ],
    end: STANDING,
    speed: 0.9,
  },
};

// Map exercise names and categories to pose keys
export function getPoseKey(exerciseName: string, muscleGroup: string, equipmentType?: string): string {
  const n = exerciseName.toLowerCase();
  const m = muscleGroup.toLowerCase();
  const e = (equipmentType ?? '').toLowerCase();

  // Specific exercises first
  if (n.includes('squat') && !n.includes('leg press') && !n.includes('goblet')) return 'squat';
  if (n.includes('deadlift') && !n.includes('rdl') && !n.includes('romanian')) return 'deadlift';
  if (n.includes('bench press') && !n.includes('close grip')) return 'bench';
  if (n.includes('floor press')) return 'bench';
  if (n.includes('overhead press') || n.includes('ohp') || n.includes('military')) return 'ohp';
  if (n.includes('pull-up') || n.includes('pullup') || n.includes('chin-up') || n.includes('pull up')) return 'pullup';
  if (n.includes('muscle-up') || n.includes('muscle up')) return 'pullup';
  if (n.includes('push-up') || n.includes('push up')) return 'pushup';
  if (n.includes('hip thrust') || n.includes('glute bridge') || n.includes('kas glute')) return 'hipthrust';
  if (n.includes('rdl') || n.includes('romanian') || n.includes('good morning')) return 'hinge';
  if (n.includes('lunge') || n.includes('split squat') || n.includes('step-up')) return 'lunge';
  if (n.includes('leg press')) return 'legpress';
  if (n.includes('lateral raise')) return 'lateralraise';
  if (n.includes('curl') && !n.includes('glute')) return 'curl';
  if (n.includes('pushdown') || n.includes('extension') && m.includes('tricep')) return 'pushdown';
  if (n.includes('row') || n.includes('pulldown') || n.includes('pull down')) return 'row';
  if (n.includes('t-bar') || n.includes('pendlay')) return 'row';
  if (n.includes('swing') || n.includes('hinge')) return 'hinge';

  // Category fallbacks
  if (m.includes('chest') || m.includes('tricep') || m.includes('shoulder')) return 'generic_push';
  if (m.includes('back') || m.includes('lat') || m.includes('bicep')) return 'generic_pull';
  if (m.includes('quad') || m.includes('hamstring') || m.includes('glute')) return 'squat';

  return 'generic_push';
}
