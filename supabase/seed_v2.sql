-- STR — Exercise Library Expansion v2
-- Run after seed.sql

insert into public.exercises (name, muscle_group, secondary_muscle, equipment_type, is_custom, form_cues) values

-- ── CALISTHENICS ───────────────────────────────────────────────────────────
('Push-Ups', 'Chest', 'Triceps, Shoulders', 'Bodyweight',
 false, 'Hands shoulder-width. Body rigid from head to heels. Lower chest to floor. Full lockout at top. Elbows at ~45° to torso.'),

('Diamond Push-Ups', 'Triceps', 'Chest', 'Bodyweight',
 false, 'Hands form a diamond under chest. Elbows track close to sides throughout. Full range. Squeeze at lockout.'),

('Wide Push-Ups', 'Chest', 'Shoulders', 'Bodyweight',
 false, 'Hands wider than shoulder-width. Emphasizes outer pec. Full stretch at bottom. Controlled tempo.'),

('Decline Push-Ups', 'Chest', 'Shoulders, Triceps', 'Bodyweight',
 false, 'Feet elevated on bench or box. Shifts emphasis to upper chest. Keep body rigid. Full range.'),

('Pike Push-Ups', 'Shoulders', 'Triceps', 'Bodyweight',
 false, 'Hips high, body inverted V. Lower crown of head toward floor. Press back up. Builds toward handstand push-up.'),

('Handstand Push-Ups', 'Shoulders', 'Triceps, Upper Chest', 'Bodyweight',
 false, 'Kick up against wall. Lower head toward floor under control. Press to full lockout. Core tight throughout.'),

('Muscle-Ups', 'Lats', 'Chest, Triceps, Shoulders', 'Bodyweight',
 false, 'Dead hang. Explosive pull — lead with chest, not chin. Transition wrists over bar as you pull. Press to lockout. Lower under control.'),

('Ring Dips', 'Chest', 'Triceps, Shoulders', 'Rings',
 false, 'Rings turned out at top. Lean forward slightly for chest emphasis. Lower with control. Keep rings close to body.'),

('Ring Push-Ups', 'Chest', 'Triceps, Core', 'Rings',
 false, 'Harder than regular push-ups due to instability. Rings at floor level. Full range. Keep core rigid.'),

('Australian Pull-Ups', 'Mid-Upper Back', 'Biceps', 'Bodyweight',
 false, 'Bar at hip height. Body rigid, face up. Pull chest to bar. Full hang at bottom. Think horizontal pull-up.'),

('Inverted Row', 'Mid-Upper Back', 'Biceps, Rear Delts', 'Bodyweight',
 false, 'Same as Australian pull-up. Adjust difficulty by foot position. Full range. Squeeze shoulder blades at top.'),

('Archer Pull-Ups', 'Lats', 'Biceps', 'Bodyweight',
 false, 'Wide grip. Pull to one side while other arm stays straight. Alternate sides. Builds unilateral pulling strength.'),

('Pistol Squats', 'Quads', 'Glutes, Hamstrings', 'Bodyweight',
 false, 'One leg extended forward. Sit to full depth on working leg. Drive through heel to stand. Maintain upright torso.'),

('Nordic Hamstring Curl', 'Hamstrings', 'Glutes', 'Bodyweight',
 false, 'Anchor feet. Slowly lower body toward floor using hamstrings only. Catch yourself, use hands, pull back with hamstrings. Elite eccentric work.'),

('Dragon Flag', 'Core', 'Lats, Shoulders', 'Bodyweight',
 false, 'Grip bench behind head. Raise body to vertical. Lower slowly keeping body rigid — do NOT bend at hips. Pure core tension.'),

('L-Sit', 'Core', 'Quads, Triceps', 'Bodyweight',
 false, 'Support on parallel bars or floor. Extend legs parallel to floor. Hold. Keep legs straight, shoulders depressed. Build time.'),

('Hollow Body Hold', 'Core', 'Lats', 'Bodyweight',
 false, 'Lie flat. Press lower back into floor. Raise arms overhead and legs off floor. Find the point where you can barely maintain contact. Hold.'),

('Tuck Planche', 'Chest', 'Shoulders, Triceps, Core', 'Bodyweight',
 false, 'On floor or parallettes. Lean forward until feet leave ground with knees tucked. Shoulders protracted. Build hold time before extending.'),

('Front Lever', 'Lats', 'Mid-Upper Back, Core', 'Bodyweight',
 false, 'Hang from bar. Raise body horizontal, face up. Pull shoulder blades down and together. Work tuck → straddle → full progression.'),

('Calisthenics Dip', 'Triceps', 'Chest, Shoulders', 'Bodyweight',
 false, 'Parallel bars. Upright torso for tricep focus. Full lockout at top. Lower until tricep stretch. No kipping.'),

-- ── POWERLIFTING SPECIFIC ──────────────────────────────────────────────────
('Pause Squat', 'Quads', 'Glutes, Hamstrings', 'Barbell',
 false, 'Standard squat setup. Pause 2-3 seconds at bottom before standing. No bounce. Builds strength out of the hole.'),

('Tempo Squat', 'Quads', 'Glutes, Hamstrings', 'Barbell',
 false, 'Slow eccentric (3-5 seconds down). Control is the stimulus. Teaches bar path and body positioning.'),

('Front Squat', 'Quads', 'Core, Upper Back', 'Barbell',
 false, 'Bar in front rack on front delts. Elbows high. Upright torso is mandatory. Sit straight down. Hip crease below parallel.'),

('Safety Bar Squat', 'Quads', 'Glutes, Hamstrings', 'Safety Bar',
 false, 'Cambered bar sits on yoke pads. Hands grip handles in front. Less shoulder mobility needed. Camber shifts weight forward — stay upright.'),

('Zercher Squat', 'Quads', 'Biceps, Core, Upper Back', 'Barbell',
 false, 'Bar held in crook of elbows. Brutal but effective. Upright torso naturally. Full depth. Brace hard.'),

('Pause Bench Press', 'Chest', 'Triceps, Shoulders', 'Barbell',
 false, 'Touch and hold bar on chest 2-3 seconds. No bounce. Then press. Builds off-the-chest strength. Competition carry-over.'),

('Tempo Bench Press', 'Chest', 'Triceps, Shoulders', 'Barbell',
 false, 'Slow descent (3-4 seconds). Touch and go or pause at chest. Control teaches bar path and tightness.'),

('Floor Press', 'Chest', 'Triceps', 'Barbell',
 false, 'Lie on floor. ROM stops when triceps touch floor. Eliminates leg drive. Pure pressing strength. Great tricep builder.'),

('Pin Press', 'Chest', 'Triceps', 'Barbell',
 false, 'Bar starts on safety pins at sticking point height. Dead start — no stretch reflex. Brutal for weak points.'),

('Sumo Deadlift', 'Hamstrings', 'Glutes, Adductors, Lower Back', 'Barbell',
 false, 'Wide stance, toes flared. Grip inside legs. Hips closer to bar. Push floor away, keep hips from shooting up early.'),

('Deficit Deadlift', 'Hamstrings', 'Glutes, Lower Back', 'Barbell',
 false, 'Stand on 2-4 inch platform. Increased range of motion. Builds strength off the floor. Keep back tight throughout extended ROM.'),

('Rack Pull', 'Overall', 'Traps, Lower Back', 'Barbell',
 false, 'Bar starts on pins at knee height or above. Overloads top portion of deadlift. Great for lockout and trap development.'),

('Trap Bar Deadlift', 'Overall', 'Quads, Hamstrings, Glutes', 'Trap Bar',
 false, 'Stand inside hex bar. More upright torso than conventional. Friendlier on lower back. Drive through floor. Full lockout.'),

('Romanian Deadlift Off Pins', 'Hamstrings', 'Glutes, Lower Back', 'Barbell',
 false, 'Bar starts on pins at knee height. Hip hinge down, feel hamstring stretch, drive back up. Removes momentum.'),

('Slingshot Bench', 'Chest', 'Triceps', 'Barbell',
 false, 'Elastic slingshot around elbows. Allows supramaximal loading or higher volume. Touch slightly higher on chest.'),

('Board Press', 'Chest', 'Triceps', 'Barbell',
 false, 'Wood boards on chest limit ROM. Targets sticking point. Press from dead stop on boards.'),

('Banded Deadlift', 'Overall', 'Hamstrings, Glutes', 'Barbell',
 false, 'Bands attached to bar add accommodating resistance. Heaviest at lockout. Teaches acceleration. Drive hard all the way through.'),

('Banded Squat', 'Quads', 'Glutes, Hamstrings', 'Barbell',
 false, 'Bands add resistance at top. Forces you to accelerate through entire range. Better for explosive strength development.'),

-- ── CHEST (additional) ─────────────────────────────────────────────────────
('Cable Crossover', 'Chest', 'Shoulders', 'Cable Machine',
 false, 'High pulleys. Step forward, slight forward lean. Bring hands together in arc in front of chest. Squeeze peak contraction. Control return.'),

('Low to High Cable Fly', 'Chest', 'Shoulders', 'Cable Machine',
 false, 'Low pulley. Slight forward lean. Arc upward and together. Hits upper chest. Squeeze at top.'),

('High to Low Cable Fly', 'Chest', 'Shoulders', 'Cable Machine',
 false, 'High pulley. Arc downward and together. Hits lower chest. Squeeze at bottom of arc.'),

('Svend Press', 'Chest', 'Shoulders', 'Plates',
 false, 'Hold two plates pressed together at chest. Press straight out while squeezing plates together. Return slowly. Pure pec tension.'),

('Guillotine Press', 'Chest', 'Shoulders', 'Barbell',
 false, 'Bar lowers to neck not sternum. Wide grip. Extreme pec stretch. Use light weight — high injury risk. Slow controlled descent.'),

-- ── SHOULDERS (additional) ─────────────────────────────────────────────────
('Arnold Press', 'Shoulders', 'Triceps', 'Dumbbells',
 false, 'Start with palms facing you at chin height. Rotate palms out as you press up. Reverse on way down. Full range, full rotation.'),

('Cable Front Raise', 'Shoulders', 'Upper Chest', 'Cable Machine',
 false, 'Low pulley. Raise straight arm to eye level. Controlled descent. Keep slight bend in elbow. Avoid swinging.'),

('Plate Front Raise', 'Shoulders', 'Upper Chest', 'Plates',
 false, 'Hold plate at 9 and 3. Raise to eye level. Thumbs-up grip. No swinging. Full control down.'),

('Upright Row', 'Shoulders', 'Upper Traps, Biceps', 'Barbell',
 false, 'Close to medium grip. Pull bar up along body to chin height. Lead with elbows. Pause at top. Be mindful of shoulder impingement.'),

('Band Pull-Apart', 'Shoulders', 'Mid-Upper Back', 'Resistance Band',
 false, 'Hold band at shoulder height. Pull apart until band touches chest. Squeeze rear delts. Controlled return. High rep.'),

('Cable Rear Delt Fly', 'Shoulders', 'Mid-Upper Back', 'Cable Machine',
 false, 'Cross cables. Slight forward lean. Pull hands apart in reverse fly motion. Squeeze rear delts. No elbow bend.'),

-- ── BACK (additional) ──────────────────────────────────────────────────────
('Straight Arm Pulldown', 'Lats', 'Chest', 'Cable Machine',
 false, 'High pulley. Arms straight. Pull bar down to hips in arc. Pure lat isolation — no bicep involvement. Full stretch overhead.'),

('Single Arm Dumbbell Row', 'Mid-Upper Back', 'Biceps, Lats', 'Dumbbells',
 false, 'Brace on bench. Pull dumbbell to hip. Elbow drives back past torso. Full stretch at bottom. No hip rotation. Row the weight, not your elbow.'),

('Chest Supported Row', 'Mid-Upper Back', 'Biceps, Rear Delts', 'Dumbbells',
 false, 'Lie chest on incline bench. Removes lower back from equation. Pure upper back work. Squeeze hard at top.'),

('Meadows Row', 'Mid-Upper Back', 'Biceps, Lats', 'Barbell',
 false, 'Landmine setup. Staggered stance, grab collar end. Row to hip. Massive range of motion. Great for lats and upper back.'),

('Cable Pullover', 'Lats', 'Chest', 'Cable Machine',
 false, 'High pulley. Stand or kneel facing cable. Arms straight. Pull in arc to hips. Full lat stretch overhead.'),

('Barbell Shrug', 'Mid-Upper Back', 'Upper Traps', 'Barbell',
 false, 'Shoulder-width grip. Shrug straight up — no rolling. Pause at top. Lower under control. Heavy weight appropriate here.'),

('Rack Pull from Shin', 'Overall', 'Traps, Lower Back, Lats', 'Barbell',
 false, 'Bar starting just below knee. Shorter ROM than floor. Allows heavier loading. Full lockout at top.'),

-- ── BICEPS (additional) ────────────────────────────────────────────────────
('EZ Bar Curl', 'Biceps', 'Brachialis', 'EZ Bar',
 false, 'Semi-supinated grip reduces wrist stress. Full range. Elbows at sides. Squeeze at top. No swinging.'),

('Drag Curl', 'Biceps', null, 'Barbell',
 false, 'Bar drags up the body instead of arcing out. Elbows travel behind torso. Hits long head hard. Short, focused contraction.'),

('Reverse Curl', 'Biceps', 'Brachioradialis, Brachialis', 'Barbell',
 false, 'Overhand (pronated) grip. Full range. Forearm extensors and brachialis emphasized. Heavier than it looks — use lighter weight.'),

('Zottman Curl', 'Biceps', 'Brachioradialis, Forearms', 'Dumbbells',
 false, 'Curl up supinated. Rotate to pronated at top. Lower overhand. Best of both — bicep on way up, brachioradialis on way down.'),

('Bayesian Curl', 'Biceps', null, 'Cable Machine',
 false, 'Low pulley behind body. Step forward. Curl forward from behind hip. Maximizes stretch on long head at bottom. Full ROM.'),

('Cross Body Hammer Curl', 'Biceps', 'Brachialis, Brachioradialis', 'Dumbbells',
 false, 'Curl across body instead of straight up. Hits brachialis and long head. Alternate arms. No swinging.'),

-- ── TRICEPS (additional) ───────────────────────────────────────────────────
('JM Press', 'Triceps', 'Chest', 'Barbell',
 false, 'Cross between close grip bench and skull crusher. Bar comes toward throat as you descend. Elbows drift slightly forward. Explosive press. Powerlifting tricep staple.'),

('Tate Press', 'Triceps', 'Chest', 'Dumbbells',
 false, 'Dumbbells point at ceiling at start. Bend elbows letting dumbbells drop to chest. Press back up. Elbows stay flared.'),

('Rolling Tricep Extension', 'Triceps', null, 'Dumbbells',
 false, 'Skull crusher motion then roll dumbbells back to shoulders. Extend back up. The roll removes the weak point. High reps.'),

('Decline Skull Crusher', 'Triceps', null, 'Barbell',
 false, 'Decline bench. Bar lowers behind head rather than to forehead. Greater stretch on tricep. Lower slowly. Press to lockout.'),

('Rope Pushdown', 'Triceps', null, 'Cable Machine',
 false, 'Rope attachment. Pull apart at bottom for extra squeeze. Full lockout. Elbows stay at sides. Control the return.'),

-- ── LEGS (additional) ──────────────────────────────────────────────────────
('Smith Machine Squat', 'Quads', 'Glutes, Hamstrings', 'Machine',
 false, 'Fixed bar path. Feet can be placed further forward to change emphasis. Good for high volume or rehab. Full depth.'),

('Sissy Squat', 'Quads', null, 'Bodyweight',
 false, 'Hold fixed object. Lean back while letting knees travel forward over toes. Lower until thigh parallel. Isolates rectus femoris.'),

('Single Leg Press', 'Quads', 'Glutes', 'Machine',
 false, 'One leg on plate. Address imbalances. Same cues as bilateral — full ROM, no knee lockout.'),

('Lying Leg Curl', 'Hamstrings', null, 'Machine',
 false, 'Lie prone. Pad against lower leg. Curl to full flexion. Squeeze at peak. Slow eccentric. Plantarflexed foot for more activation.'),

('Seated Leg Curl', 'Hamstrings', null, 'Machine',
 false, 'Seated position. Different angle than lying — more stretch at origin. Full range. Control the return.'),

('Standing Calf Raise', 'Calves', null, 'Machine',
 false, 'Full plantar flexion at top. Full dorsiflexion at bottom (heel lower than toes). Slow stretch. High reps work well for calves.'),

('Seated Calf Raise', 'Calves', null, 'Machine',
 false, 'Seated targets soleus specifically. Full ROM. Load heavy. Calves respond to time under tension. Slow tempo.'),

('Leg Press Calf Raise', 'Calves', null, 'Machine',
 false, 'Use toes on bottom edge of leg press plate. Push through ball of foot. Full stretch at bottom. High reps.'),

('Hip Abduction Machine', 'Glutes', 'TFL', 'Machine',
 false, 'Sit with pads on outside of knees. Push out against resistance. Squeeze at peak. Hits glute medius specifically.'),

('Hip Adduction Machine', 'Glutes', 'Adductors', 'Machine',
 false, 'Pads on inside of knees. Bring legs together against resistance. Adductors and inner thigh.'),

('Nordic Curl', 'Hamstrings', 'Glutes', 'Bodyweight',
 false, 'Kneel with feet anchored. Lower body toward floor using hamstrings only. Push with hands when you fail. Hardest hamstring exercise. High injury risk if not progressed correctly.'),

('Glute Ham Raise', 'Hamstrings', 'Glutes, Lower Back', 'Machine',
 false, 'Full hip extension to horizontal. Pull heels toward glutes using hamstrings. Lower with control. One of the best posterior chain developers.'),

('Belt Squat', 'Quads', 'Glutes, Hamstrings', 'Machine',
 false, 'Weight hangs from belt at hips. No spinal loading. Perfect for quad focus without back involvement. Go deep.'),

('Tibialis Raise', 'Calves', null, 'Bodyweight',
 false, 'Stand heels against wall. Raise toes toward shins. Pause at top. The underrated lower leg movement for knee health.'),

-- ── CORE ──────────────────────────────────────────────────────────────────
('Ab Wheel Rollout', 'Core', 'Lats, Shoulders', 'Ab Wheel',
 false, 'Kneeling or standing. Roll out until hips want to drop. Pull back using core and lats. Do NOT let lower back extend. Full rollout is advanced.'),

('Cable Crunch', 'Core', null, 'Cable Machine',
 false, 'Kneel facing cable. Rope behind head. Crunch elbow toward knees. Do NOT pull with arms — all from abs. Full stretch at top.'),

('Hanging Leg Raise', 'Core', 'Hip Flexors', 'Bodyweight',
 false, 'Dead hang. Raise legs to 90° or higher. Control the descent. No swinging. For harder version: touch bar with toes.'),

('Ab Crunch', 'Core', null, 'Bodyweight',
 false, 'Feet flat, knees bent. Curl shoulder blades off floor. Do not pull neck. Squeeze abs at top. Full controlled descent.'),

('Decline Ab Crunch', 'Core', null, 'Machine',
 false, 'Feet secured on decline bench. Curl up with full range. Added ROM vs flat crunch. Weight on chest for progression.'),

('Russian Twist', 'Core', 'Obliques', 'Bodyweight',
 false, 'Seated, feet up. Rotate torso side to side. Touch floor each side. Add weight plate or medicine ball for progression.'),

('Pallof Press', 'Core', 'Obliques', 'Cable Machine',
 false, 'Stand perpendicular to cable. Press straight out — resist rotation. Hold 2 seconds. The anti-rotation element is the point.'),

('Dead Bug', 'Core', 'Hip Flexors', 'Bodyweight',
 false, 'Lie flat. Arms vertical, knees 90°. Lower opposite arm and leg while pressing lower back into floor. Return. Never lose lumbar contact with floor.'),

('Bird Dog', 'Core', 'Lower Back, Glutes', 'Bodyweight',
 false, 'On all fours. Extend opposite arm and leg. Hold 2-3 seconds. Hips stay square — do not rotate. Return with control.'),

('Landmine Rotation', 'Core', 'Obliques, Shoulders', 'Barbell',
 false, 'Barbell in landmine. Hold end with both hands. Rotate side to side from athletic stance. Control the arc. Core stays rigid.'),

('GHR Sit-Up', 'Core', 'Hip Flexors', 'Machine',
 false, 'On glute ham machine facing up. Full sit-up with maximal range. Can hold weight on chest for progression.'),

('Weighted Plank', 'Core', 'Shoulders, Glutes', 'Bodyweight',
 false, 'Forearms or hands. Partner places plate on back. Hold perfect position — no hips up or sagging. Build time under tension.'),

('Side Plank', 'Core', 'Obliques, Glutes', 'Bodyweight',
 false, 'Elbow or hand. Straight line from head to heels. Hips don''t sag. Hip dips for added difficulty. Build hold time.'),

-- ── FOREARMS ───────────────────────────────────────────────────────────────
('Wrist Curl', 'Forearms', null, 'Barbell',
 false, 'Forearms on bench or thighs. Wrist curls up against resistance. Full range. High reps work well for forearms.'),

('Reverse Wrist Curl', 'Forearms', null, 'Barbell',
 false, 'Overhand grip. Extend wrists against resistance. Works extensor side. Balance with wrist curls.'),

('Farmers Carry', 'Forearms', 'Traps, Core, Glutes', 'Dumbbells',
 false, 'Heavy dumbbells or handles. Walk with purpose. Stand tall. Do not let shoulders roll forward. Grip, traps, and core work simultaneously.'),

('Dead Hang', 'Forearms', 'Lats, Shoulders', 'Bodyweight',
 false, 'Hang from bar with straight arms. Shoulders packed down. Build grip and shoulder health. Work up to 60+ seconds.'),

-- ── OLYMPIC / EXPLOSIVE ────────────────────────────────────────────────────
('Power Clean', 'Overall', 'Quads, Hamstrings, Traps, Shoulders', 'Barbell',
 false, 'Bar from floor. Triple extension — ankle, knee, hip — then shrug and pull under. Catch in quarter squat. Explosive hip drive is everything.'),

('Hang Clean', 'Overall', 'Hamstrings, Traps, Shoulders', 'Barbell',
 false, 'Start with bar at hip or knee. Same hip drive and pull as power clean. Teaches the second pull without floor complexity.'),

('Power Snatch', 'Overall', 'Quads, Shoulders, Traps', 'Barbell',
 false, 'Wide snatch grip. Bar from floor to overhead in one explosive movement. Catch with slight knee bend. The most technical barbell lift.'),

('Kettlebell Swing', 'Hamstrings', 'Glutes, Lower Back, Traps', 'Kettlebell',
 false, 'Hip hinge, not squat. Drive hips forward explosively. Bell floats to shoulder height from hip power. Hike back between legs. Glutes fire hard at top.'),

('Box Jump', 'Quads', 'Glutes, Hamstrings', 'Bodyweight',
 false, 'Load up, jump explosively. Land softly on box with bent knees. Step down — never jump down. Reactive power development.'),

('Broad Jump', 'Quads', 'Glutes, Hamstrings', 'Bodyweight',
 false, 'Countermovement, jump forward as far as possible. Stick the landing. Measures horizontal power output.'),

('Clean Pull', 'Overall', 'Hamstrings, Traps', 'Barbell',
 false, 'Pull phase of the clean without catching. Drive to full extension. Bar should hit hip crease. Traps shrug hard at top.'),

-- ── NECK / ROTATOR CUFF / PREHAB ──────────────────────────────────────────
('Face Pull with External Rotation', 'Shoulders', 'Rear Delts', 'Cable Machine',
 false, 'Rope at face height. Pull to forehead while rotating hands back. Elbows high. Critical for shoulder health if you bench heavy.'),

('External Rotation', 'Shoulders', null, 'Cable Machine',
 false, 'Elbow at 90° against side. Rotate forearm out against resistance. Rotator cuff. Light weight, controlled. Shoulder health essential.'),

('Internal Rotation', 'Shoulders', null, 'Cable Machine',
 false, 'Opposite of external rotation. Elbow at 90°. Rotate forearm in. Rotator cuff balance work.'),

('Prone YTW', 'Shoulders', 'Mid-Upper Back', 'Dumbbells',
 false, 'Lie prone on incline bench or floor. Raise arms into Y, T, and W shapes. Light weight. Rear delt and rotator cuff health.'),

('Serratus Anterior Push-Up', 'Chest', 'Shoulders', 'Bodyweight',
 false, 'At top of push-up position. Push extra — shoulder blades spread wide. The "plus" at the top. Serratus activation for shoulder health.');

-- Additional exercises
,('Preacher Curl Machine', 'Biceps', null, 'Machine',
 false, 'Adjust seat so upper arms rest flat on pad. Full range of motion — complete extension at bottom, full contraction at top. Slow eccentric. Isolates bicep completely.');
