-- ─────────────────────────────────────────────
-- STR — Exercise Seed Data
-- Run after 001_schema.sql
-- ─────────────────────────────────────────────

insert into public.exercises (name, muscle_group, secondary_muscle, equipment_type, is_custom, form_cues) values

-- ── CHEST ────────────────────────────────────────────────────────────────────
('Barbell Bench Press', 'Chest', 'Triceps, Shoulders', 'Barbell',
 false, 'Retract and depress scapulae. Arch naturally. Grip just outside shoulder width. Lower to sternum with control. Drive bar up and slightly back. Feet flat.'),

('Incline Barbell Bench Press', 'Chest', 'Triceps, Shoulders', 'Barbell',
 false, 'Set bench 30-45°. Same scapular position as flat bench. Lower to upper chest. Keep elbows at 75° to torso.'),

('Dumbbell Bench Press', 'Chest', 'Triceps, Shoulders', 'Dumbbells',
 false, 'Neutral or pronated grip. Slight arc path — out wide at bottom, together at top. Full stretch at bottom.'),

('Incline Dumbbell Press', 'Chest', 'Triceps, Shoulders', 'Dumbbells',
 false, 'Bench at 30-45°. Lead with elbows up. Squeeze hard at top without fully locking.'),

('Pec Deck Cable Flys', 'Chest', 'Shoulders', 'Cable Machine',
 false, 'Slight bend in elbows throughout. Think hugging a barrel. Squeeze chest at peak contraction. Control the return.'),

('Dips', 'Chest', 'Triceps, Shoulders', 'Bodyweight',
 false, 'Lean forward for chest emphasis. Lower until slight stretch in pec. Drive up without flaring elbows excessively.'),

('Incline Machine Press', 'Chest', 'Triceps, Shoulders', 'Machine',
 false, 'Adjust seat so handles align with upper chest. Full range of motion. Controlled negative.'),

-- ── SHOULDERS ────────────────────────────────────────────────────────────────
('Overhead Press', 'Shoulders', 'Triceps, Upper Chest', 'Barbell',
 false, 'Bar on front delts. Core tight. Press straight up — bar clears face then track back over base of skull. Lock out overhead.'),

('Cable Lateral Raise', 'Shoulders', 'Upper Traps', 'Cable Machine',
 false, 'Cable runs across body from opposite side. Slight forward lean. Lead with elbow, not wrist. Stop at shoulder height.'),

('Dumbbell Shoulder Press', 'Shoulders', 'Triceps', 'Dumbbells',
 false, 'Neutral or pronated grip. Press up and slightly in. Full lockout. Control the descent.'),

('Rear Delt Row', 'Shoulders', 'Mid-Upper Back', 'Barbell',
 false, 'Hinge to roughly parallel. Wide overhand grip. Pull to upper chest. Lead with elbows wide.'),

('Rear Delt Fly', 'Shoulders', 'Mid-Upper Back', 'Dumbbells',
 false, 'Hinge forward 45-90°. Slight bend in elbows. Raise to ear height. Squeeze rear delts at top.'),

('Shoulder Press Machine', 'Shoulders', 'Triceps', 'Machine',
 false, 'Adjust seat so handles align with ears. Full press to lockout. Controlled down.'),

('Lateral Raise Machine', 'Shoulders', null, 'Machine',
 false, 'Pad against forearm not wrist. Drive pad up with delt. Control the descent.'),

('Dumbbell Lateral Raise', 'Shoulders', 'Upper Traps', 'Dumbbells',
 false, 'Slight forward lean at hip. Slight bend in elbow. Lead with pinkies slightly up. Stop at shoulder height. No shrugging.'),

-- ── TRICEPS ──────────────────────────────────────────────────────────────────
('Katana Extensions', 'Triceps', null, 'Cable Machine',
 false, 'Set cable high. Face away. Arms overhead, elbows tucked. Press down in an arc like drawing a sword. Squeeze at lockout.'),

('Standing Cable Extension', 'Triceps', null, 'Cable Machine',
 false, 'Rope or bar attached high. Hinge slightly. Press down keeping elbows tucked at sides. Full lockout.'),

('Cable Kickback', 'Triceps', null, 'Cable Machine',
 false, 'Hinge to near parallel. Upper arm parallel to floor. Extend forearm back to full lockout. Squeeze at top.'),

('Skull Crushers', 'Triceps', null, 'Barbell',
 false, 'Lie flat. Bar over forehead. Elbows vertical. Lower bar toward forehead by bending only elbows. Press back up.'),

('Overhand Pushdowns', 'Triceps', null, 'Cable Machine',
 false, 'Overhand grip on bar. Elbows locked at sides. Press to full lockout. Squeeze hard. Controlled return.'),

('Close Grip Bench Press', 'Triceps', 'Chest', 'Barbell',
 false, 'Grip shoulder-width or slightly inside. Lower with elbows close to body. Press explosively. Full lockout.'),

('Cross Body Cable Extension', 'Triceps', null, 'Cable Machine',
 false, 'Cable from opposite side shoulder height. Single arm extension across body. Elbow stays still. Full extension.'),

-- ── BICEPS ───────────────────────────────────────────────────────────────────
('Concentration Curl', 'Biceps', null, 'Dumbbells',
 false, 'Seated, elbow braced on inner thigh. Full range. Supinate at top. No swinging.'),

('Spider Curl', 'Biceps', null, 'Barbell',
 false, 'Chest against incline bench pad, arms hanging. Curl up without letting elbows drift back. Full supination at top.'),

('Hammer Curl', 'Biceps', 'Brachialis, Brachioradialis', 'Dumbbells',
 false, 'Neutral grip throughout. Elbows at sides. Curl to shoulder. Control the descent.'),

('Preacher Curl', 'Biceps', null, 'Barbell',
 false, 'Arm flat on pad. Do not hyperextend at bottom. Full contraction at top. Slow negative.'),

('Cable Curl', 'Biceps', null, 'Cable Machine',
 false, 'Low pulley. Supinated grip. Elbows stay at sides. Full range. Squeeze at top.'),

('Bicep Curl', 'Biceps', null, 'Dumbbells',
 false, 'Supinate as you curl. Elbows at sides. Full extension at bottom. No swinging.'),

('Incline Curl', 'Biceps', null, 'Dumbbells',
 false, 'Bench at 45-60°. Arms hang back. This maximizes stretch on long head. Curl without letting shoulders round forward.'),

-- ── MID-UPPER BACK ───────────────────────────────────────────────────────────
('Lat Pulldowns', 'Mid-Upper Back', 'Biceps, Lats', 'Cable Machine',
 false, 'Wide overhand grip. Lean back slightly. Pull to upper chest driving elbows down and back. Squeeze at bottom.'),

('T-Bar Row', 'Mid-Upper Back', 'Lats, Biceps', 'Barbell',
 false, 'Hinge to 45°. Neutral grip. Pull to lower chest. Lead with elbows. Squeeze rhomboids at top.'),

('Barbell Row', 'Mid-Upper Back', 'Lats, Biceps', 'Barbell',
 false, 'Hip hinge to 45-75°. Overhand grip. Pull to belly button. Drive elbows back past torso.'),

('Pendlay Row', 'Mid-Upper Back', 'Lats, Biceps', 'Barbell',
 false, 'Bar starts on floor each rep. Fully horizontal torso. Explosive pull to sternum. Bar returns to floor.'),

('One Arm Pulldowns', 'Mid-Upper Back', 'Biceps, Lats', 'Cable Machine',
 false, 'Single arm. Pull elbow to hip. Lean away slightly. Full stretch at top.'),

('Pullups', 'Mid-Upper Back', 'Biceps, Lats', 'Bodyweight',
 false, 'Dead hang start. Pull until chin over bar or chest to bar. Controlled descent to full hang.'),

('Seated Cable Row', 'Mid-Upper Back', 'Biceps, Lats', 'Cable Machine',
 false, 'Neutral grip. Sit tall. Pull handle to lower chest. Drive elbows behind torso. Full stretch at extension.'),

('Face Pulls', 'Mid-Upper Back', 'Rear Delts', 'Cable Machine',
 false, 'Rope at face height. Pull to forehead. Elbows flare high and wide. External rotation at end.'),

-- ── LATS ─────────────────────────────────────────────────────────────────────
('Lat Pullover', 'Lats', 'Chest, Triceps', 'Dumbbell',
 false, 'Lie across bench. Arms extended overhead holding dumbbell. Arc down in a long-lever motion. Feel lat stretch fully.'),

('Kneeling Single Arm Lat Pulldown', 'Lats', 'Biceps', 'Cable Machine',
 false, 'Kneel facing cable. Single arm overhead. Pull elbow to hip. Rotate torso slightly. Full stretch.'),

('Seated Lat Row', 'Lats', 'Mid-Upper Back, Biceps', 'Cable Machine',
 false, 'Wide grip. Pull to upper abs. Elbows flare wide to hit lats more than rhomboids.'),

('Seated Single Arm Lat Row', 'Lats', 'Mid-Upper Back, Biceps', 'Cable Machine',
 false, 'Same as seated lat row but single arm allows more rotation and stretch.'),

-- ── QUADS ────────────────────────────────────────────────────────────────────
('Barbell Back Squats', 'Quads', 'Glutes, Hamstrings', 'Barbell',
 false, 'Bar on traps, not neck. Chest up. Hip crease below parallel. Knees track over toes. Drive through full foot.'),

('Hack Squats', 'Quads', 'Glutes', 'Machine',
 false, 'Feet low on plate for more quad emphasis. Full depth. Knees track toes. Do not lock out at top.'),

('Leg Extensions', 'Quads', null, 'Machine',
 false, 'Pad on lower shin. Full extension and squeeze. Control the return. No swinging.'),

('Goblet Squats', 'Quads', 'Glutes, Core', 'Dumbbell',
 false, 'Hold dumbbell at chest. Elbows inside knees at bottom. Upright torso. Heels down.'),

('Bulgarian Split Squat', 'Quads', 'Glutes, Hamstrings', 'Dumbbells',
 false, 'Rear foot elevated. Lower rear knee toward floor. Front shin nearly vertical. Drive through front heel.'),

('Walking Lunges', 'Quads', 'Glutes, Hamstrings', 'Dumbbells',
 false, 'Step long. Lower rear knee toward floor. Drive forward through front foot. Keep torso upright.'),

('Reverse Lunges', 'Quads', 'Glutes, Hamstrings', 'Dumbbells',
 false, 'Step back. Lower knee to floor. Keep front shin vertical. Return by driving through front heel.'),

('Dumbbell Step-Ups', 'Quads', 'Glutes', 'Dumbbells',
 false, 'Step up onto box. Drive through the heel of working leg. Do not push off back foot.'),

('Leg Press', 'Quads', 'Glutes, Hamstrings', 'Machine',
 false, 'Feet at shoulder width. Lower until thighs past parallel. Press through full foot. Do not lock out knees.'),

-- ── HAMSTRINGS ───────────────────────────────────────────────────────────────
('Barbell RDLs', 'Hamstrings', 'Glutes, Lower Back', 'Barbell',
 false, 'Hip hinge. Bar drags down legs. Feel stretch in hamstrings. Soft knee bend. Drive hips forward to stand.'),

('Dumbbell RDLs', 'Hamstrings', 'Glutes, Lower Back', 'Dumbbells',
 false, 'Same as barbell RDL. Dumbbells allow natural hand path.'),

('Leg Curl', 'Hamstrings', null, 'Machine',
 false, 'Seated or lying. Full range. Squeeze at peak contraction. Slow eccentric.'),

('Good Mornings', 'Hamstrings', 'Lower Back, Glutes', 'Barbell',
 false, 'Bar on upper traps. Soft knee bend. Hinge at hip until torso near parallel. Drive hips through to stand.'),

-- ── GLUTES ───────────────────────────────────────────────────────────────────
('KAS Glute Bridge', 'Glutes', 'Hamstrings', 'Barbell',
 false, 'Small range of motion — only go up a few inches. Constant tension. Short reps. Drive knees out. Squeeze glutes hard.'),

('Glute Focused Back Extension', 'Glutes', 'Hamstrings', 'Bodyweight',
 false, 'Round lower back slightly. Think about posterior pelvic tilt at top. Squeeze glutes, not lower back.'),

('Hip Thrust', 'Glutes', 'Hamstrings', 'Barbell',
 false, 'Shoulders on bench. Pad over hips. Drive hips up to full extension. Posterior pelvic tilt at top. Squeeze glutes hard.'),

-- ── OVERALL ──────────────────────────────────────────────────────────────────
('Deadlifts', 'Overall', 'Hamstrings, Glutes, Lower Back, Traps', 'Barbell',
 false, 'Bar over mid-foot. Hinge to grip. Lat spread. Big breath and brace. Push floor away. Lock hips out at top. Control the return.');
