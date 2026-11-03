// Starter prompts grow with the lifter's rank — the same tier that picks the
// coach. A day-one Mortal gets "where do I even start?"; a Sovereign gets
// meet-prep energy.
export const STARTER_PROMPTS_BY_TIER: Record<string, string[]> = {
  mortal: [
    "I'm new and honestly a little nervous. Where do I start?",
    'How do I know if my form is right without a trainer?',
    'How many days a week should I train?',
    'What gym etiquette should I know so I fit right in?',
  ],
  awakened: [
    'How do I keep progressing now that newbie gains are slowing?',
    'Should I add weight or reps first?',
    'How sore is too sore to train?',
    'What should I eat to actually build muscle?',
  ],
  ascendant: [
    'What muscle groups am I neglecting?',
    'Teach me how to actually use RPE',
    "How's my volume trending this month?",
    'How do I bring up a lagging lift?',
  ],
  phantom: [
    'Any signs of overtraining in my recent logs?',
    "What's my strongest lift relative to bodyweight?",
    'How should I structure my next deload?',
    'Where are my sticking points costing me?',
  ],
  sovereign: [
    'Read my logs — where am I leaving strength on the table?',
    'Plan the shape of my next peaking block',
    'Critique my volume distribution like a meet-prep coach',
    'What is my RPE trend telling you?',
  ],
};
STARTER_PROMPTS_BY_TIER.godhand = STARTER_PROMPTS_BY_TIER.sovereign;
