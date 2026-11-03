// Cameo lines: original fan lines in each character's voice (not script
// quotes, apart from tiny well-known nods). Keep each under ~90 characters.
//
// Template vars: {name} {lift} {weight} {reps} {power} {delta} {rank} {sub}
// {days} {streak} {weakest} {nextChar} {prevChar}. The engine only picks a
// line whose vars are all available, so every list keeps at least one line
// that needs nothing beyond {name}.
//
// Authored per character for readability; exported trigger → character →
// lines (CAMEO_LINES) for the engine.
import type { CharacterId } from './cast';

export type CameoTrigger =
  | 'workout_finished'
  | 'pr_hit'
  | 'rest_dropin'
  | 'heavy_day'
  | 'power_jump'
  | 'sub_rank_up'
  | 'rank_up_goodbye'
  | 'rank_up_intro'
  | 'over_9000'
  | 'comeback'
  | 'home_dropin'
  | 'onboarding_reveal';

/** The Solo Leveling `[ SYSTEM ]` window speaks too, in Jinwoo's world only. */
export type Speaker = CharacterId | 'system';

type Lines = Partial<Record<CameoTrigger, string[]>>;

const BY_CHARACTER: Record<Speaker, Lines> = {
  // ── Mortal · Demon Slayer ──────────────────────────────────────────────────
  urokodaki: {
    workout_finished: [
      'Your judgment was slow, but your effort was honest. Again tomorrow.',
      'Breathe. Recover. The mountain will still be here tomorrow, {name}.',
      'Good. The body learns what the mind repeats. Come back and repeat it.',
    ],
    pr_hit: [
      '{weight} on {lift}. Hm. The boulder moved a little today.',
      'That {lift} was clean. Do not let it make you careless.',
      'A new mark. Remember how it felt, then forget it and train.',
    ],
    rest_dropin: [
      'Use your rest to breathe properly. Total concentration.',
      'Rest is part of the training. Do not waste it on your phone.',
      'Calm the breath before the next set. Then cut through it.',
    ],
    power_jump: [
      '+{delta}. Slow progress is still progress. I am watching.',
      '{power}. You are sharper than last week. Stay humble.',
      'Your power rose. So will the weight. Do not flinch.',
    ],
    home_dropin: [
      'Your {weakest} lags behind. A blade is only as strong as its weakest edge.',
      '{streak} days of training. Discipline is a quiet kind of strength.',
      'Have you trained today, {name}? The mountain does not wait.',
    ],
    sub_rank_up: [
      'Mortal {sub}. One more step up the mountain.',
      'You have earned {rank} {sub}. Do not celebrate too long.',
      '{sub}. Good. The next step is steeper.',
    ],
    rank_up_goodbye: [
      'You split the boulder, {name}. Go. Someone louder is waiting.',
      'My teaching ends here. Carry it with you to the next mountain.',
      'You no longer need my mask to protect you. Go on.',
    ],
    rank_up_intro: [
      'I am Urokodaki. Your training starts now. Can you keep up?',
      'Every hunter starts here. Show me your form, {name}.',
      'Mortal. Good. We build from the ground. No shortcuts.',
    ],
    comeback: [
      '{days} days away. Your body forgot. Your will did not. Begin.',
      'You came back. That is the first lesson, and the hardest.',
      'Rust comes off with work. Start light. Start today.',
    ],
    onboarding_reveal: [
      'I am Urokodaki. I will be your coach. Your training starts now.',
      'So you want to get strong. Then listen closely, {name}. I am your coach.',
      'Mortal rank. Good. Every master stood exactly where you stand.',
    ],
  },
  tanjiro: {
    workout_finished: [
      'You did great today, {name}! I could tell you gave it everything!',
      "Thank you for training hard! Let's both rest well tonight!",
      'Every set counted today. I mean it! Keep going!',
    ],
    pr_hit: [
      '{weight} on {lift}! I could smell your determination from here!',
      "A new record! Your hard work is paying off, {name}!",
      "{weight} × {reps}! I knew you could do it! Don't stop now!",
    ],
    rest_dropin: [
      "Catch your breath! You're doing so well. Next set's yours!",
      "Rest a little, then give it everything again! You've got this!",
      "I believe in you, {name}! One more good set!",
    ],
    power_jump: [
      "+{delta}! You're getting stronger every single day!",
      '{power}! Your effort really shows, {name}!',
      "Your power grew! Let's keep climbing together!",
    ],
    home_dropin: [
      "{streak} days in a row! That's real dedication, {name}!",
      "Your {weakest} needs love too. Let's work on it together!",
      "Good morning, {name}! Ready to give it your all today?",
    ],
  },
  zenitsu: {
    workout_finished: [
      "I'm so tired just WATCHING you. Can we go home now? Please?",
      "You actually finished?! I would've quit three sets ago!",
      "That was terrifying. You were amazing. I need a nap.",
    ],
    pr_hit: [
      "I'm gonna DIE— wait. {weight}?! Did I do that?!",
      "{weight} on {lift}?! Are you even human?! Teach me!",
      "Don't look at me, I fainted. Did you just hit {weight}?!",
    ],
    rest_dropin: [
      "Is the rest over? Already?! No no no, rest longer! Wait, go!",
      "The next set is gonna hurt. I can FEEL it. You go first.",
      "Why are we doing this to ourselves?! ...okay, one more.",
    ],
    power_jump: [
      "+{delta}?! You're getting scary strong. Please be nice to me.",
      "{power}?! I'm still crying about my own numbers!",
      "Your power went UP?! While mine stayed... never mind.",
    ],
    home_dropin: [
      "{streak} days straight?! Don't you ever get tired?!",
      "Your {weakest} is... fine! It's fine! Don't hit me!",
      "Are we training today? Can we skip? No? Okay. Okay.",
    ],
  },
  inosuke: {
    workout_finished: [
      'HA! You survived! Inosuke approves! Barely!',
      "Not bad, {name}! But I'd have lifted MORE! Rematch tomorrow!",
      'Done already?! The beast inside me is still hungry!',
    ],
    pr_hit: [
      '{weight}?! Hmph! Inosuke will lift {weight} AND a boar!',
      "A new record?! You're my rival now, {name}! CHARGE!",
      'BOAR HEAD POWER! {weight} on {lift}! Again! AGAIN!',
    ],
    rest_dropin: [
      'Why are you sitting?! Inosuke doesn\'t REST! Lift the thing!',
      'Your rest is too long! CHARGE!',
      'Pig assault! I mean... next set! GO GO GO!',
    ],
    power_jump: [
      '+{delta}! Ha! Still weaker than me! For now!',
      '{power}! Inosuke will crush that number tomorrow!',
      'Your power went up?! Then I go up MORE!',
    ],
    home_dropin: [
      'Your {weakest} is weak! Fix it or I headbutt you!',
      '{streak} days! Not bad for a weakling, {name}!',
      'Fight me! Or the barbell! Fight SOMETHING today!',
    ],
  },
  rengoku: {
    workout_finished: [
      'Set your heart ablaze, {name}! That session burned bright!',
      "Magnificent! You gave everything! I'm proud of you!",
      'Rest well! Tomorrow, we burn even brighter!',
    ],
    pr_hit: [
      '{weight} on {lift}! Splendid! Your flame grows stronger!',
      'A new record! Set your heart ablaze and keep climbing!',
      'Wonderful! {weight} × {reps}! I knew your spirit was strong!',
    ],
    rest_dropin: [
      'Breathe deep! Feel the fire! Then strike!',
      "Don't let the flame die between sets! Onward!",
      'Your next set will be your best yet! I believe it!',
    ],
    power_jump: [
      '+{delta}! Your fire burns hotter every week!',
      '{power}! Splendid! Keep feeding that flame!',
      'Your power rises like a blaze! Wonderful!',
    ],
    home_dropin: [
      '{streak} days! Your heart burns bright, {name}!',
      "Your {weakest} needs fire! Let's set it ablaze today!",
      'Good day, {name}! Shall we train with our whole hearts?',
    ],
  },
  giyu: {
    workout_finished: ['...Done.', '...Adequate.', '...Rest.'],
    pr_hit: ['...{weight}.', '...Good.', '...Hm.'],
    rest_dropin: ['...Breathe.', '...Next.', '...Focus.'],
    power_jump: ['...+{delta}.', '...Stronger.', '...Keep going.'],
    home_dropin: ['...Train.', '...{weakest}.', '...Today.'],
  },

  // ── Awakened · My Hero Academia ────────────────────────────────────────────
  allmight: {
    workout_finished: [
      'Splendid work, young {name}! Rest up. Tomorrow we go further!',
      'A true hero trains even when no one is watching! Well done!',
      'You gave it your all! That is what heroes do!',
    ],
    pr_hit: [
      '{weight} on {lift}! Now THAT is the spirit of a hero!',
      'A new record! Go beyond, young {name}! PLUS ULTRA!',
      "HAHAHA! {weight}! You're getting stronger, my student!",
    ],
    rest_dropin: [
      'A hero rests so they can rise again! Ready? GO!',
      'Smile, young {name}! The next set fears you!',
      'Deep breath! A hero never gives up mid-battle!',
    ],
    power_jump: [
      '+{delta}! Your power grows, young {name}! Splendid!',
      '{power}! You are becoming a true symbol of strength!',
      'Go beyond! Your power just did exactly that!',
    ],
    home_dropin: [
      "{streak} days straight! That's the heart of a hero!",
      'Your {weakest} needs work! A hero shores up every weakness!',
      "Fear not, young {name}! For today, you TRAIN!",
    ],
    sub_rank_up: [
      'Awakened {sub}! A step closer to greatness, young {name}!',
      '{rank} {sub}! Splendid! Keep climbing!',
      'Sub-rank up! Plus Ultra, {name}!',
    ],
    rank_up_goodbye: [
      'My time as your teacher ends here. Go, and be the best!',
      'You have outgrown me, {name}. A new teacher awaits. Plus Ultra!',
      'Now it is your turn. {nextChar} will take you further. Go!',
    ],
    rank_up_intro: [
      'I AM HERE! Awakened, young {name}! Now go beyond: Plus Ultra!',
      'Fear not! For I am your coach now! Let us train like heroes!',
      'HAHAHA! You have awakened! The real training starts NOW!',
    ],
    comeback: [
      '{days} days off? A hero always returns! Welcome back!',
      'You came back, {name}! That alone makes you a hero!',
      'The comeback is the bravest part! Let us begin again!',
    ],
    onboarding_reveal: [
      'I AM HERE! I will be your coach, young {name}! Plus Ultra!',
      'Awakened already?! Splendid! Let us become heroes together!',
      'Fear not, {name}! For I am your coach! Let us begin!',
    ],
  },
  deku: {
    workout_finished: [
      "I took notes on your whole session. You're improving so fast!",
      'Great work, {name}! Your consistency is really inspiring!',
      "That was a smart session! I'm analyzing it right now!",
    ],
    pr_hit: [
      '{weight} on {lift}?! I need to write this down!',
      'A new PR! Your form must have improved! Amazing!',
      "{weight} × {reps}! You're surpassing your limits, {name}!",
    ],
    rest_dropin: [
      'Your bar path looked good! Keep the same setup next set!',
      "I've been thinking about your {lift}. Let's go, one more!",
      "Okay, focus! Smash this next set, {name}!",
    ],
    power_jump: [
      "+{delta}?! I'm writing this down. Your progression is incredible!",
      '{power}! That trend line is beautiful, {name}!',
      'Your power went up! The data does not lie!',
    ],
    home_dropin: [
      "Your {weakest} is lagging. I made a plan! Want to hear it?",
      '{streak} days in a row! Consistency beats talent!',
      "Ready to train, {name}? I've got notes!",
    ],
  },
  bakugo: {
    workout_finished: [
      "Tch. Don't get cocky. I'd have done it faster.",
      "Fine. You didn't suck. Don't make me say it twice.",
      'Done? Then get out of my way, extra.',
    ],
    pr_hit: [
      "{weight}?! Don't you DARE get stronger than me!",
      'Hah?! {weight} on {lift}? ...Whatever. Do it again.',
      "Tch. {weight}. Not bad. Still beneath me.",
    ],
    rest_dropin: [
      'Stop staring at your phone and LIFT, nerd!',
      "You call that resting? You call that LIFTING? Move!",
      "Hurry up! I'll blow this rest timer up myself!",
    ],
    power_jump: [
      "+{delta}? Don't get smug. I'm still above you.",
      '{power}. Hmph. Keep up or get out of my way.',
      "Your power went up. So what? I'll still win.",
    ],
    home_dropin: [
      'Your {weakest} is pathetic. Fix it before I blow it up.',
      "{streak} days? Cute. I've never skipped one.",
      "Oi, {name}. You training today or what?",
    ],
  },
  todoroki: {
    workout_finished: [
      'That was a solid session. Rest. Cool down properly.',
      'Balanced work. Good. Recovery matters as much as effort.',
      "You did well today, {name}. Let's keep it steady.",
    ],
    pr_hit: [
      '{weight} on {lift}. Calm execution. Well done.',
      'A new record. You controlled the whole rep.',
      '{weight} × {reps}. Steady progress beats bursts.',
    ],
    rest_dropin: [
      'Cool your head. Then the next set.',
      'Take the full rest. Heat and cold, in balance.',
      'Breathe. Stay composed. Then lift.',
    ],
    power_jump: [
      '+{delta}. Steady climb. I like it.',
      '{power}. You are getting stronger, quietly.',
      'Your power rose. Keep it balanced.',
    ],
    home_dropin: [
      'Your {weakest} is uneven with the rest. Balance it.',
      '{streak} days. Consistent. Good.',
      "Morning, {name}. Training today?",
    ],
  },
  kirishima: {
    workout_finished: [
      "That was MANLY, {name}! You didn't back down once!",
      'Rock solid session! Get some sleep, bro!',
      "You hardened up today! Proud of you!",
    ],
    pr_hit: [
      '{weight}?! That is SO manly! Unbreakable!',
      "A new PR! You didn't crack under that bar, bro!",
      '{weight} on {lift}! Hardened! UNBREAKABLE!',
    ],
    rest_dropin: [
      "Rest's done! A real man gets back under the bar!",
      'Harden up and hit the next set, bro!',
      "Don't quit now! Stay rock solid!",
    ],
    power_jump: [
      '+{delta}! You just got harder to break, bro!',
      '{power}! That is MANLY growth!',
      'Your power went up! Unbreakable!',
    ],
    home_dropin: [
      "{streak} days, bro! That's what never quitting looks like!",
      'Your {weakest} is soft! Harden it up today!',
      "Let's get manly today, {name}!",
    ],
    comeback: [
      "{days} days off? Doesn't matter! A real man gets back up! Let's go!",
      'You came back! That is the MANLIEST thing you can do!',
      "Back at it, bro! Falling down is fine. Staying down isn't!",
    ],
  },
  aizawa: {
    workout_finished: [
      'Logical session. Go home and sleep. Eight hours. I\'m serious.',
      'Efficient. Now recover. Don\'t waste the work.',
      'Done. Eat protein. Sleep. That\'s the whole lesson.',
    ],
    pr_hit: [
      '{weight}. Fine. Don\'t chase it again today.',
      'New record. Logical result of consistent work.',
      '{weight} on {lift}. Okay. Now don\'t get hurt celebrating.',
    ],
    rest_dropin: [
      "Rest is rest. Don't waste it scrolling.",
      'Shorter rest won\'t make you a hero. Take the full time.',
      "I'm tired just watching. Next set.",
    ],
    power_jump: [
      '+{delta}. Expected. You trained. Keep it rational.',
      "{power}. Good. I'm going to take a nap.",
      'Power up. Logical. Carry on.',
    ],
    home_dropin: [
      'Your {weakest} is behind. Fix it. Rationally.',
      '{streak} days. Make sure you\'re sleeping, too.',
      "Train today. Then sleep. I'm going back to bed.",
    ],
  },

  // ── Ascendant · Jujutsu Kaisen ─────────────────────────────────────────────
  gojo: {
    workout_finished: [
      "Good output. Now let's talk about why your third set fell apart.",
      'Not bad. Not me-level, obviously. But not bad.',
      "Nice session, {name}. Relax. You're in good hands.",
    ],
    pr_hit: [
      '{weight} on {lift}? Cute. Do it again and I might be impressed.',
      'New record. See? Trust the strongest and things happen.',
      '{weight} × {reps}. Okay, that one was actually good.',
    ],
    rest_dropin: [
      "Take your time. I'm not worried. I'm never worried.",
      'Infinity rest? No. Ninety seconds. Go.',
      "Relax, {name}. Next set's going to be fine. Probably.",
    ],
    power_jump: [
      '+{delta}. Look at you, growing up so fast.',
      "{power}. Getting there. Still not the strongest, but hey.",
      'Your power went up. My student. Obviously.',
    ],
    home_dropin: [
      "Your {weakest}? We'll fix it. Relax, I'm the strongest.",
      '{streak} days straight. I approve. Mildly.',
      "Yo, {name}. Training today? Of course you are.",
    ],
    sub_rank_up: [
      'Ascendant {sub}. Told you. Good hands.',
      '{rank} {sub}. Keep going. You still have a long way to me.',
      'Sub-rank up. Nice. Now do it again.',
    ],
    rank_up_goodbye: [
      "Leaving already? Fine. {nextChar} better not break you.",
      "You've outgrown my class, {name}. Go show them.",
      'Graduation. Try not to miss me too much.',
    ],
    rank_up_intro: [
      "Ascendant, huh? Relax, you're in good hands. I'm the strongest, after all.",
      "Hey, {name}. I'm Gojo. Your new coach. Lucky you.",
      "Welcome to the technical stuff. Don't worry. I'll make it look easy.",
    ],
    comeback: [
      "{days} days off? Cursed. Let's get you back on track.",
      'Welcome back. I kept your spot warm.',
      "You're back. Good. Start light. Seriously.",
    ],
    onboarding_reveal: [
      "Ascendant already? Interesting. I'm Gojo, your coach. Relax.",
      "Hey {name}. I'm the strongest. And now I'm your coach.",
      "You're in good hands. The best hands, actually.",
    ],
  },
  yuji: {
    workout_finished: [
      'That was sick, {name}! Wanna grab food after?',
      'Great session! I\'m starving now!',
      'You crushed it! Same time tomorrow?',
    ],
    pr_hit: [
      '{weight}?! Dude. DUDE. That\'s insane!',
      'New PR! Let\'s GO, {name}!',
      '{weight} on {lift}! You\'re a monster, man!',
    ],
    rest_dropin: [
      "Rest's almost up! You got this one!",
      "C'mon, one more good set! I'm hyped!",
      'Deep breath! Then hit it hard!',
    ],
    power_jump: [
      '+{delta}?! You\'re getting so strong, dude!',
      '{power}! That\'s awesome, man!',
      'Your power just jumped! Let\'s keep going!',
    ],
    home_dropin: [
      "{streak} days, dude! That's crazy!",
      "Your {weakest} needs love! Let's hit it today!",
      "Yo {name}! Gym? Gym!",
    ],
  },
  megumi: {
    workout_finished: [
      'Efficient. Your setup was better today.',
      'Good session. Next time, rest a little longer before the top set.',
      "Done. Recover and plan the next one.",
    ],
    pr_hit: [
      '{weight}. The plan worked.',
      'New record on {lift}. Good timing.',
      '{weight} × {reps}. Calculated.',
    ],
    rest_dropin: [
      'Think about the next set before you start it.',
      'Same setup as last set. Don\'t change what works.',
      'Rest. Then execute.',
    ],
    power_jump: [
      '+{delta}. Steady. The strategy is working.',
      '{power}. Keep building quietly.',
      'Power up. Stay patient.',
    ],
    home_dropin: [
      'Your {weakest} is the gap. Plan around it.',
      '{streak} days. Consistent. Good.',
      'Training today, {name}? Have a plan.',
    ],
  },
  maki: {
    workout_finished: [
      'No shortcuts today. Good. That\'s the only way.',
      'Solid. Strength you earn sticks around.',
      'You did the work. That\'s all there is to it.',
    ],
    pr_hit: [
      '{weight}. No talent, no tricks. Just reps. That\'s how you do it.',
      'New record on {lift}. Earned. Not given.',
      '{weight} × {reps}. Keep proving them wrong.',
    ],
    rest_dropin: [
      "Nobody's handing it to you. Get back up there.",
      'Rest over. Earn the next one.',
      'No shortcuts. Next set.',
    ],
    power_jump: [
      '+{delta}. Earned, every point of it.',
      '{power}. That\'s what showing up looks like.',
      'Power up. No tricks needed.',
    ],
    home_dropin: [
      'Your {weakest}? Weak spots get trained, not hidden.',
      "{streak} days. That's how you get strong without a gift.",
      "Train today, {name}. Nobody's coming to do it for you.",
    ],
  },
  todo: {
    workout_finished: [
      'My best friend! That session moved me to tears!',
      'A worthy session, {name}! Our bond deepens!',
      'Splendid! I knew you were a person of taste!',
    ],
    pr_hit: [
      '{weight}?! Brother! I knew it from the first set!',
      'A new record! My heart soars, best friend!',
      '{weight} on {lift}! Truly, you are my brother!',
    ],
    rest_dropin: [
      'Clap your hands. Now. Next set.',
      'Brother, your rest is boring. Lift!',
      'I\'ve seen your next set in a vision. It\'s glorious.',
    ],
    power_jump: [
      '+{delta}! As expected of my best friend!',
      '{power}! Tears of joy, brother!',
      'Your power grows! Our bond is unbreakable!',
    ],
    home_dropin: [
      'Tell me, {name}... what type of lift do you like? Your answer had better be deadlifts.',
      '{streak} days! Only my best friend trains like that!',
      'Your {weakest}? Boring. Make it interesting.',
    ],
  },
  sukuna: {
    workout_finished: [
      'You lifted. How dull. Do it again tomorrow, brat.',
      'Finished? Pathetic stamina. ...Adequate output, though.',
      'Hmph. Entertain me more next time.',
    ],
    pr_hit: [
      '{weight}? Barely worth noticing. Barely.',
      'New record. You\'re slightly less of a worm today.',
      '{weight} on {lift}. Hm. Annoying.',
    ],
    rest_dropin: [
      'Resting? How weak. Lift, before I lose interest.',
      'Your rest bores me. Move.',
      'Hurry up, brat.',
    ],
    power_jump: [
      '+{delta}. Hm. You\'re becoming slightly less pathetic, brat.',
      "{power}. Don't get comfortable. I'm still above you.",
      'Your power rose. How irritating.',
    ],
    home_dropin: [
      'Your {weakest} is laughable. Fix it or don\'t. I\'ll enjoy either.',
      '{streak} days. Stubborn. I almost respect it.',
      "Train, brat. Or don't. It's your funeral.",
    ],
  },

  // ── Phantom · Dragon Ball ──────────────────────────────────────────────────
  vegeta: {
    workout_finished: [
      'Your power is {power}. Mine is higher. Train harder.',
      "Hmph. Adequate. A Saiyan would've done twice the volume.",
      "Don't think one good session makes you a warrior.",
    ],
    pr_hit: [
      '{weight}? Hmph. Not bad... for someone who isn\'t me.',
      'A new record. Don\'t let it go to your head.',
      '{weight} on {lift}. Again. And heavier.',
    ],
    rest_dropin: [
      "Are you resting or retiring? Get up!",
      'A warrior doesn\'t sit around. Next set!',
      'Hurry up. My patience has limits.',
    ],
    power_jump: [
      '+{delta}. Fine. You\'re closing the gap. Slightly.',
      "{power}. Hmph. I'll surpass that tomorrow.",
      'Your power rose. Don\'t get comfortable.',
    ],
    home_dropin: [
      'Your {weakest} is an embarrassment to warriors everywhere.',
      "{streak} days. I'd expect nothing less. Don't stop.",
      "Training today? Of course you are. Don't disappoint me.",
    ],
    sub_rank_up: [
      'Phantom {sub}. Hmph. Keep climbing.',
      '{rank} {sub}. Still beneath the Prince.',
      'Sub-rank up. Don\'t celebrate. Train.',
    ],
    rank_up_goodbye: [
      'Go, then. Show {nextChar} what a Saiyan-trained warrior looks like.',
      "Hmph. You've outgrown my training. Don't you dare get soft.",
      "Leaving? Fine. Remember who made you strong.",
    ],
    rank_up_intro: [
      "So, you made it to Phantom. Don't expect me to go easy on you.",
      'I am Vegeta, Prince of all Saiyans. And now, your coach.',
      "Phantom. Hmph. Let's see if you can keep up with royalty.",
    ],
    comeback: [
      '{days} days?! A Saiyan never takes that long off. Get back to it!',
      "You're back. About time. Let's go.",
      'Rest is over. Prove you still have it.',
    ],
    over_9000: [
      "It's over 9000?! ...{name}, who ARE you?",
      "WHAT?! Over 9000?! That's impossible!",
      "{power}?! Over 9000?! ...Hmph. I suppose you've earned that.",
    ],
    onboarding_reveal: [
      "Phantom already? Hmph. I'm Vegeta, your coach. Don't waste my time.",
      "I am the Prince of all Saiyans. And you, {name}, are my student now.",
      'Hmph. A strong start. Now prove it.',
    ],
  },
  goku: {
    workout_finished: [
      "That was awesome, {name}! I'm getting hungry just watching!",
      'Great training! Wanna spar tomorrow?',
      "You're getting really strong! Let's eat!",
    ],
    pr_hit: [
      "Whoa, {weight}! You're getting strong, {name}!",
      'A new record! That\'s amazing! Let\'s go again!',
      "{weight} on {lift}? I can't wait to see what's next!",
    ],
    rest_dropin: [
      'Ready for the next round? I am!',
      "Hehe, rest is nice, but training's more fun!",
      "C'mon {name}, let's keep going!",
    ],
    power_jump: [
      'Whoa, +{delta}! You\'re getting strong, {name}! Wanna spar?',
      "{power}! That's incredible! Let's keep training!",
      'Your power jumped! I can feel it from here!',
    ],
    home_dropin: [
      "{streak} days! That's some serious training!",
      'Your {weakest} could use some training! Let\'s go!',
      "Hey {name}! Wanna train? I always wanna train!",
    ],
  },
  gohan: {
    workout_finished: [
      'Good session. The study and the training both paid off.',
      'That was smart work, {name}. Steady progress.',
      'Done for today. Rest is part of the plan.',
    ],
    pr_hit: [
      '{weight}. I knew you had more in you.',
      'A new record on {lift}! Your hidden power is showing.',
      '{weight} × {reps}. Calm, then explosive. Nice.',
    ],
    rest_dropin: [
      'Use this rest to visualize the next set.',
      "Take your time. When you're ready, unleash it.",
      'Breathe. Your best set is still inside you.',
    ],
    power_jump: [
      'That jump to {power}... I knew you had it in you.',
      '+{delta}. Your potential is finally coming out.',
      'Your power grew. Keep studying your training.',
    ],
    home_dropin: [
      'Your {weakest} is behind. Let\'s study why.',
      '{streak} days. That\'s real dedication, {name}.',
      'Training and studying today? Both, ideally.',
    ],
  },
  piccolo: {
    workout_finished: [
      'Good session. Now eat, sleep, and stop skipping legs.',
      'Adequate. Your focus is improving.',
      'Rest. Then come back sharper.',
    ],
    pr_hit: [
      '{weight}. Good. Your discipline is paying off.',
      'A new record on {lift}. Don\'t get sloppy now.',
      '{weight} × {reps}. Focus held. Good.',
    ],
    rest_dropin: [
      'Meditate on the next set. Then do it.',
      'Your rest is fine. Your focus isn\'t. Fix it.',
      'Stop fidgeting. Breathe. Lift.',
    ],
    power_jump: [
      '+{delta}. You\'re growing. Don\'t let it make you careless.',
      '{power}. Good. Keep the training honest.',
      'Your power rose. As it should.',
    ],
    home_dropin: [
      'Your {weakest} needs work. I noticed. So should you.',
      '{streak} days. Good. Don\'t break the streak.',
      "Train today, {name}. And don't skip legs.",
    ],
  },
  beerus: {
    workout_finished: [
      'Fine. You lifted. Now where is my pudding?',
      'Hm. Entertaining enough. I won\'t destroy you today.',
      'Done? Good. I need a nap.',
    ],
    pr_hit: [
      '{weight}. Interesting. Slightly.',
      'A new record. Don\'t expect applause from a god.',
      '{weight} on {lift}. Hm. Better than I expected.',
    ],
    rest_dropin: [
      "Your rest is boring me. Hurry up.",
      'Lift something, or bring me food.',
      'I could destroy this gym out of boredom. Lift.',
    ],
    power_jump: [
      '+{delta}. Hm. You may be worth watching after all.',
      "{power}. Not bad. For a mortal.",
      'Your power rose. I suppose I\'ll allow it.',
    ],
    home_dropin: [
      'Your {weakest} disappoints me. Fix it before I get hungry.',
      '{streak} days? Impressive dedication. For a mortal.',
      'Train, {name}. And bring snacks.',
    ],
  },
  whis: {
    workout_finished: [
      'My, what a lovely session! Do rest well.',
      'Ohoho, you did quite well today, {name}.',
      'Splendid effort. Shall we have dessert?',
    ],
    pr_hit: [
      '{weight}! Ohoho, how delightful!',
      'A new record. My, you are full of surprises.',
      '{weight} on {lift}. Lovely form, too.',
    ],
    rest_dropin: [
      'Take your time. Although... maybe not too much time.',
      'Ohoho, still resting? How relaxing for you.',
      'Shall we continue? I\'ll be watching.',
    ],
    power_jump: [
      '+{delta}. My, how you\'ve grown.',
      '{power}. Ohoho, quite the improvement!',
      'Your power rose. How charming.',
    ],
    home_dropin: [
      'Your {weakest} could be lovelier. Shall we work on it?',
      '{streak} days in a row. How diligent!',
      'Good day, {name}. Training, I presume?',
    ],
  },

  // ── Sovereign · Solo Leveling ──────────────────────────────────────────────
  jinwoo: {
    workout_finished: [
      'Quest complete. Rest. Tomorrow, we level again.',
      'Good. Every rep is experience. Keep stacking it.',
      'You trained when no one made you. That\'s how hunters rise.',
    ],
    pr_hit: [
      '{weight}. Level up.',
      'New record on {lift}. The system noticed.',
      '{weight} × {reps}. Stronger than yesterday. As it should be.',
    ],
    rest_dropin: [
      'Recover your stats. Then the next set.',
      'Rest. Your shadows are waiting.',
      'Next set. Arise.',
    ],
    power_jump: [
      '+{delta}. Levels don\'t lie.',
      '{power}. Keep leveling.',
      'Your power rose. Most hunters never get here.',
    ],
    home_dropin: [
      'Your {weakest} is your lowest stat. Allocate points there.',
      '{streak} days. Daily quests complete.',
      "Today's quest is waiting, {name}.",
    ],
    sub_rank_up: [
      'Sovereign {sub}. Level up.',
      '{rank} {sub}. Keep climbing the floors.',
      'Sub-rank up. The system acknowledges you.',
    ],
    rank_up_goodbye: [
      "You've cleared this dungeon. {nextChar} awaits on the next floor.",
      "My shadows will remember you, {name}. Go.",
      'There is nothing left for me to teach you here.',
    ],
    rank_up_intro: [
      'Sovereign. Most hunters never see this floor. Keep leveling.',
      "I'm Sung Jinwoo. From here, the dungeons get deeper.",
      'You were weak once. So was I. Now, we level.',
    ],
    comeback: [
      '{days} days away. The daily quest penalty is training. Begin.',
      'You returned. Good. The gates don\'t close on their own.',
      'Back. Start with the daily quest.',
    ],
    onboarding_reveal: [
      "Sovereign? Interesting. I'm Sung Jinwoo. I'll be your coach.",
      'You start where most hunters finish. Keep leveling, {name}.',
      'The system has chosen you. Let\'s begin.',
    ],
  },
  igris: {
    workout_finished: [
      '*bows* The session is complete, my liege.',
      'Your army is stronger tonight, my liege.',
      '*sheathes sword* Well fought.',
    ],
    pr_hit: [
      '*kneels* {weight}. Your army grows stronger, my liege.',
      '{weight} on {lift}. A worthy victory.',
      '*raises sword* A new record, my liege.',
    ],
    rest_dropin: [
      '*stands guard* Rest, my liege. Then strike.',
      'The next set awaits your command.',
      '*kneels* Ready when you are.',
    ],
    power_jump: [
      '+{delta}. Your shadow grows, my liege.',
      '{power}. The army is honored.',
      '*bows* Your power rises.',
    ],
    home_dropin: [
      'Your {weakest}, my liege. It must be fortified.',
      '{streak} days. Your discipline honors us.',
      '*kneels* Shall we train today, my liege?',
    ],
  },
  beru: {
    workout_finished: [
      'MY KING! That was magnificent! Beru is moved!',
      'The king has finished! Beru will guard your rest!',
      'MY KING! You are the strongest!',
    ],
    pr_hit: [
      '{weight}?! MY KING IS THE STRONGEST!',
      'A NEW RECORD! Beru weeps with pride, my king!',
      '{weight} on {lift}! Nobody can match my king!',
    ],
    rest_dropin: [
      'My king, rest! Beru will keep watch!',
      'Your next set will be glorious, my king!',
      'Shall Beru clear the gym for you, my king?!',
    ],
    power_jump: [
      '+{delta}! MY KING GROWS EVEN STRONGER!',
      '{power}! Beru is overwhelmed!',
      'My king\'s power rises! All shall tremble!',
    ],
    home_dropin: [
      'MY KING! {streak} days in a row! Beru is so proud!',
      'My king, your {weakest} must be avenged!',
      'Good morning, my king! Today we conquer!',
    ],
  },
  chahaein: {
    workout_finished: [
      'That was a good session. Calm and strong.',
      'You train with purpose, {name}. It shows.',
      'Rest well. You earned it today.',
    ],
    pr_hit: [
      '{weight}. Beautiful form. Truly.',
      'A new record on {lift}. I knew it.',
      '{weight} × {reps}. You make it look easy.',
    ],
    rest_dropin: [
      'Take your time. Your next set will be good.',
      'Steady breathing. You\'re ready.',
      'I\'ll be watching. Go.',
    ],
    power_jump: [
      '+{delta}. You keep getting stronger.',
      '{power}. Impressive, {name}.',
      'Your power rose. I\'m not surprised.',
    ],
    home_dropin: [
      'Your {weakest} needs work. I can help.',
      '{streak} days. That\'s admirable.',
      'Training today, {name}? I\'ll join you.',
    ],
  },
  thomasandre: {
    workout_finished: [
      "HA! Good session, kid! You'd last at least ten minutes in a raid!",
      "Not bad! Come lift with a real tank sometime!",
      "That's how we do it! Now eat a steak!",
    ],
    pr_hit: [
      'HA! {weight}! You might actually survive a raid with me, kid!',
      "{weight} on {lift}? Cute! I warm up with that! ...Good job!",
      'A new record! Okay, kid. Okay. I see you!',
    ],
    rest_dropin: [
      "Rest's for scouts! Tanks lift! Let's GO!",
      'Get under the bar, kid! Show me something!',
      "C'mon! I've seen guild members lift faster!",
    ],
    power_jump: [
      "+{delta}! HA! You're becoming a real hunter!",
      "{power}! Not bad! Still not Goliath level!",
      'Your power jumped! I like it, kid!',
    ],
    home_dropin: [
      "Your {weakest}? Weak! Come to the guild, I'll fix it!",
      "{streak} days! You train like an American, kid!",
      "HEY! You lifting today or what?!",
    ],
  },
  yoojinho: {
    workout_finished: [
      'Hyung-nim! That was incredible! I\'ll carry your bag!',
      'You did it, hyung-nim! Let\'s celebrate!',
      'Hyung-nim is the best! The best!',
    ],
    pr_hit: [
      '{weight}?! Hyung-nim! You\'re a monster!',
      'A NEW RECORD! Hyung-nim is unstoppable!',
      '{weight} on {lift}! I knew it! I KNEW it!',
    ],
    rest_dropin: [
      'Hyung-nim, water? Towel? Anything?!',
      'Next set\'s gonna be huge, hyung-nim!',
      'I\'m so hyped, hyung-nim! Go go go!',
    ],
    power_jump: [
      '+{delta}! Hyung-nim keeps leveling up!',
      '{power}! Hyung-nim, you\'re amazing!',
      'Your power jumped! I\'m telling everyone!',
    ],
    home_dropin: [
      'Hyung-nim! {streak} days straight! You\'re a monster!',
      'Hyung-nim, your {weakest} will catch up! I believe!',
      'Hyung-nim! Are we raiding the gym today?!',
    ],
  },
  system: {
    workout_finished: [
      '[ DAILY QUEST COMPLETE ] Rewards: +{delta} power.',
      '[ QUEST COMPLETE ] Recovery is now available.',
      '[ DAILY QUEST COMPLETE ] Return tomorrow for the next quest.',
    ],
    pr_hit: [
      '[ NEW RECORD ] {lift}: {weight}. Stats updated.',
      '[ LEVEL UP ] {lift} has increased.',
      '[ ACHIEVEMENT ] {weight} × {reps}.',
    ],
    power_jump: [
      '[ LEVEL UP ] Power: {power} (+{delta}).',
      '[ STATS UPDATED ] +{delta} power.',
      '[ SYSTEM ] Growth detected: +{delta}.',
    ],
  },

  // ── Godhand · One Punch Man ────────────────────────────────────────────────
  saitama: {
    workout_finished: [
      'Ok. Good workout. Want to get some groceries?',
      "That was fine. I'm hungry. Are you hungry?",
      "Done? Cool. There's a sale on cabbage today.",
    ],
    pr_hit: [
      'Ok. {weight}. Nice. Want to grab ramen?',
      '{weight} on {lift}. Huh. Cool.',
      'A new record. ...Neat. Anyway.',
    ],
    rest_dropin: [
      "Take your time. I'm not in a hurry. The sale ends at six though.",
      'Next set? Ok.',
      '...I forgot what I was gonna say. Lift.',
    ],
    power_jump: [
      '+{delta}. Huh. Nice.',
      "{power}. Ok. I didn't really keep track of mine.",
      'Your power went up. Cool. Ramen?',
    ],
    home_dropin: [
      'Your {weakest} is weaker? Do push-ups. Sit-ups. Squats. Run. Daily.',
      "{streak} days. That's how I did it. Kind of.",
      "Training today? Ok. Don't forget to eat.",
    ],
    sub_rank_up: [
      'Godhand {sub}. Ok.',
      '{rank} {sub}. Cool. Groceries?',
      'Sub-rank up. ...That\'s it.',
    ],
    rank_up_goodbye: [
      "There's nowhere left to go. ...Want to get ramen?",
      'You beat the game, I guess. Ok.',
      "Huh. Nobody left to teach you. That's kind of sad.",
    ],
    rank_up_intro: [
      'Godhand, huh. Cool. ...Is there a sale at the supermarket today?',
      "I'm Saitama. A hero for fun. I guess I'm your coach now.",
      "Ok. You're strong. Now what? ...Same thing. Train.",
    ],
    comeback: [
      '{days} days off. Ok. Just start again. That\'s it.',
      "You're back. Cool. Push-ups first.",
      'Took a break? Happens. Train.',
    ],
    onboarding_reveal: [
      "Godhand already? Ok. I'm Saitama. Guess I'm your coach.",
      "You're really strong. Huh. ...Want to get ramen?",
      'I\'m your coach. Don\'t expect much excitement.',
    ],
  },
  genos: {
    workout_finished: [
      "Sensei-level output. I've logged a 34-point analysis of your session.",
      'Session complete. My sensors detect significant fatigue. Rest.',
      'Excellent. I will study your technique tonight.',
    ],
    pr_hit: [
      '{weight}. Recorded. Sensei would approve.',
      'New record on {lift}. Output exceeds projections.',
      '{weight} × {reps}. Analysis: flawless.',
    ],
    rest_dropin: [
      'Rest interval optimal. Proceed.',
      'Core temperature normal. Ready for the next set.',
      'Analyzing your next set. Probability of success: high.',
    ],
    power_jump: [
      '+{delta}. Growth rate exceeds my models.',
      '{power}. Updating my records.',
      'Your power rose. I must train harder.',
    ],
    home_dropin: [
      'Your {weakest} is 12% behind. Recommend focused work.',
      '{streak} days. Your consistency is admirable.',
      'Shall we train today? I am ready.',
    ],
  },
  bang: {
    workout_finished: [
      'Flowing water does not stop. Neither did you today.',
      'Good. Rest, then flow again.',
      'A calm session. The body remembers.',
    ],
    pr_hit: [
      '{weight}. Like water carving stone.',
      'A new record on {lift}. Patience rewarded.',
      '{weight} × {reps}. Smooth.',
    ],
    rest_dropin: [
      'Breathe like water. Then flow.',
      'Patience. The next set comes.',
      'Steady. Then strike.',
    ],
    power_jump: [
      '+{delta}. The river deepens.',
      '{power}. Good, young one.',
      'Power rises. Stay humble.',
    ],
    home_dropin: [
      'Your {weakest} resists. Water wears it down.',
      '{streak} days. The flow continues.',
      'Train today. Gently, but train.',
    ],
    comeback: [
      '{days} days away. The body forgets. The heart shouldn\'t. Begin again.',
      'You returned. Flow back into it slowly.',
      'Water always finds its way back. So did you.',
    ],
  },
  king: {
    workout_finished: [
      '*heart pounding* ...That was a great session. Truly.',
      '...You finished. I am... very impressed. Please go easy on me.',
      '*sweating* Well done. Want to play video games instead?',
    ],
    pr_hit: [
      '*heart pounding* ...{weight}. That\'s... very impressive. Please don\'t hurt me.',
      '...{weight} on {lift}. I... I knew it. Obviously.',
      '*King Engine roars* ...A new record. Amazing.',
    ],
    rest_dropin: [
      '*sweating* Take all the rest you need. Seriously.',
      '...Are you about to lift more? Okay. I\'ll stand back.',
      '*heart pounding* Next set. I believe in you.',
    ],
    power_jump: [
      '+{delta}. ...I\'m terrified. In a good way.',
      '{power}. *King Engine intensifies*',
      'Your power went up. ...Please stay on my side.',
    ],
    home_dropin: [
      'Your {weakest}... it\'s fine. I won\'t say anything. Please.',
      '{streak} days? You\'re scarier than any monster.',
      '...Are we training today? I\'ll watch from here.',
    ],
  },
  mumenrider: {
    workout_finished: [
      'You gave it everything! That\'s what matters!',
      'Great job, {name}! Never give up!',
      'Justice crash! I mean... great workout!',
    ],
    pr_hit: [
      '{weight}! See? Hard work beats talent!',
      'A new record! I knew you\'d never quit!',
      '{weight} on {lift}! Justice!',
    ],
    rest_dropin: [
      'Even if it\'s hard, we keep going! Next set!',
      'You can do it! I believe in you!',
      'Don\'t give up! One more!',
    ],
    power_jump: [
      '+{delta}! Effort pays off!',
      '{power}! You keep getting stronger!',
      'Your power went up! Never give up!',
    ],
    home_dropin: [
      'Your {weakest} isn\'t great? Doesn\'t matter! Keep trying!',
      '{streak} days! You never give up, {name}!',
      'Ready to train today? I am!',
    ],
    comeback: [
      'No talent? Doesn\'t matter. You came back. That\'s what counts!',
      '{days} days off? Get back on the bike! Let\'s go!',
      'You returned! That\'s the bravest thing!',
    ],
  },
  garou: {
    workout_finished: [
      'Not bad. But the strongest is still out there.',
      'You trained. Fine. I train harder.',
      'Done? I\'m just warming up.',
    ],
    pr_hit: [
      '{weight}. Now you\'re worth hunting.',
      'A new record. Interesting.',
      '{weight} on {lift}. Getting dangerous.',
    ],
    rest_dropin: [
      'Resting? The strongest doesn\'t wait.',
      'Hurry. I want to see you at your peak.',
      'Next set. Show me something.',
    ],
    power_jump: [
      '+{delta}. You\'re climbing. I\'ll be waiting at the top.',
      '{power}. Not the strongest. Yet.',
      'Your power rose. Good. More fun for me.',
    ],
    home_dropin: [
      'Your {weakest} is a weakness. Weakness gets hunted.',
      '{streak} days. You\'re serious. Good.',
      'Train. I want a real fight someday.',
    ],
    rank_up_goodbye: [
      "So you're climbing to the top. I'll be waiting there.",
    ],
  },

  // ── Guests ────────────────────────────────────────────────────────────────
  broly: {
    heavy_day: [
      '{name}... you lifted like a Saiyan today!',
      'More... MORE! That volume... is acceptable.',
      '{name}... your power is overflowing.',
    ],
    pr_hit: [
      "{weight} on {lift}... MORE. I'm not satisfied. Go again!",
      '{weight}... Kakarot would be jealous.',
      'A new record... the power... it\'s rising!',
    ],
  },
  yujiro: {
    heavy_day: [
      'Hm. Today, your body almost resembled that of a warrior.',
      'That volume... acceptable. For prey.',
      'You trained like you meant it. Barely enough.',
    ],
    pr_hit: [
      '{weight}. Hm. You might survive a few seconds against me.',
      '{weight} on {lift}. The strongest creature acknowledges it.',
      'A new record. Your back almost looks like a demon\'s.',
    ],
  },
  roshi: {
    comeback: [
      'Ho ho! {days} days off? Even turtles move faster than that. Back to it!',
      'Ho ho ho! Welcome back! Now carry this shell around the block!',
      "{days} days? My, my. Let's start with milk delivery.",
    ],
    workout_finished: [
      'Ho ho! Good training! Now rest and eat well!',
      'Work hard, play hard, rest hard! Ho ho!',
      'Splendid! The turtle way is the right way!',
    ],
    home_dropin: [
      'Ho ho! Train today, {name}! Then a nap!',
      '{streak} days? Ho ho, my best student yet!',
      'Your {weakest}? Ho ho, more milk deliveries!',
    ],
  },
};

/** trigger → speaker → lines */
export const CAMEO_LINES: Partial<Record<CameoTrigger, Partial<Record<Speaker, string[]>>>> = {};
for (const [speaker, lines] of Object.entries(BY_CHARACTER) as [Speaker, Lines][]) {
  for (const [trigger, list] of Object.entries(lines) as [CameoTrigger, string[]][]) {
    (CAMEO_LINES[trigger] ??= {})[speaker] = list;
  }
}

export function linesFor(trigger: CameoTrigger, speaker: Speaker): string[] {
  return CAMEO_LINES[trigger]?.[speaker] ?? [];
}
