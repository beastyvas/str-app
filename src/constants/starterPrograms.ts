// Opinionated starter programs for new lifters — the answer to "I don't know
// what to do, just tell me." Exercise names must match the seeded exercise
// library exactly (resolved to ids by name at start time).

export interface StarterProgramDay {
  key: string;
  name: string;          // becomes the workout name
  focus: string;         // one-line "what today is"
  exerciseNames: string[];
  guidance: string;      // sets×reps cue shown on the card
}

export interface StarterProgram {
  key: string;
  title: string;
  tagline: string;
  schedule: string;
  days: StarterProgramDay[];
}

export const STARTER_PROGRAMS: StarterProgram[] = [
  {
    key: 'full_body',
    title: 'Full Body Starter',
    tagline: 'The simplest way to get strong. Alternate A and B, three days a week.',
    schedule: '3 days/week · alternate A and B',
    days: [
      {
        key: 'fb_a',
        name: 'Full Body A',
        focus: 'Squat · press · pull',
        exerciseNames: [
          'Barbell Back Squats',
          'Barbell Bench Press',
          'Seated Cable Row',
          'Dumbbell Lateral Raise',
          'Cable Crunch',
        ],
        guidance: '3 sets of 8–10 each · rest 2–3 min on the big lifts',
      },
      {
        key: 'fb_b',
        name: 'Full Body B',
        focus: 'Hinge · press · pull',
        exerciseNames: [
          'Deadlifts',
          'Overhead Press',
          'Lat Pulldowns',
          'Leg Curl',
          'Bicep Curl',
        ],
        guidance: '3 sets of 8–10 each · deadlifts 3 sets of 5',
      },
    ],
  },
  {
    key: 'ppl',
    title: 'Push · Pull · Legs',
    tagline: 'The classic split. Run it once a week to start, twice when you’re hooked.',
    schedule: '3–6 days/week · rotate in order',
    days: [
      {
        key: 'ppl_push',
        name: 'Push Day',
        focus: 'Chest · shoulders · triceps',
        exerciseNames: [
          'Barbell Bench Press',
          'Overhead Press',
          'Incline Barbell Bench Press',
          'Dumbbell Lateral Raise',
          'Rope Pushdown',
        ],
        guidance: '3 sets of 8–12 each · leave 1–2 reps in the tank',
      },
      {
        key: 'ppl_pull',
        name: 'Pull Day',
        focus: 'Back · rear delts · biceps',
        exerciseNames: [
          'Lat Pulldowns',
          'Seated Cable Row',
          'Face Pulls',
          'Bicep Curl',
          'Hammer Curl',
        ],
        guidance: '3 sets of 8–12 each · control the negative',
      },
      {
        key: 'ppl_legs',
        name: 'Leg Day',
        focus: 'Quads · hamstrings · calves',
        exerciseNames: [
          'Barbell Back Squats',
          'Leg Press',
          'Barbell RDLs',
          'Leg Curl',
          'Standing Calf Raise',
        ],
        guidance: '3 sets of 8–12 each · squats first while you’re fresh',
      },
    ],
  },
];
