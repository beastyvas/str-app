-- ─────────────────────────────────────────────────────────────────────────────
-- STR → Google Doc lift log export
--
-- Renders workouts logged in STR back into the same text shape the Google Doc
-- used, so the doc can pick up where it left off. Output is one text value:
-- copy the cell, paste at the bottom of the doc.
--
-- The format is the inverse of src/lib/workoutParser.ts (the Import tab), so
-- anything this emits can be pasted straight back into Import without loss:
--
--     5/27/2025
--     TUE — Lower (Quad Focus)
--     ∙ Barbell Back Squat — 3×6-8
--     1 set of 135x5 for warmup
--     1 set of 225x8 for working set (rpe 7.5)
--     1 set of 225x8 for working set (rpe 8, depth felt good)
--
-- Run it in: Supabase dashboard → SQL Editor (runs as service role, so RLS on
-- workouts/workout_sets does not filter the rows out).
--
-- Or, for a clean file with no CSV quoting or cell-truncation:
--     psql "$SUPABASE_DB_URL" -At -f scripts/export-google-doc-log.sql > log.txt
--
-- Workouts flagged is_imported are skipped: those rows came *from* the doc via
-- the Import tab, so re-exporting them would duplicate history already there.
-- ─────────────────────────────────────────────────────────────────────────────

with params as (
  select
    'vasquezjrnick@gmail.com'::text as account_email,
    '2025-05-25'::date              as since_date,   -- first day to export
    '2999-12-31'::date              as until_date,   -- last day to export
    'America/Los_Angeles'::text     as tz            -- tz the doc's dates are in
),

me as (
  select u.id from public.users u, params p where u.email = p.account_email
),

wk as (
  select
    w.id,
    w.name,
    w.notes,
    (w.started_at at time zone p.tz) as local_start
  from public.workouts w, params p
  where w.user_id = (select id from me)
    and coalesce(w.is_imported, false) = false
    and (w.started_at at time zone p.tz)::date between p.since_date and p.until_date
),

-- One row per logged set, pre-rendered into its doc line.
set_lines as (
  select
    wk.id           as workout_id,
    wk.name         as workout_name,
    wk.notes        as workout_notes,
    wk.local_start,
    ws.exercise_id,
    e.name          as exercise_name,
    ws.set_number,
    ws.logged_at,
    ws.reps,
    coalesce(ws.is_warmup, false) as is_warmup,
    '1 set of '
      || case
           when ws.weight = 0 then 'bw'                          -- parser maps bw → 0
           else rtrim(rtrim(ws.weight::text, '0'), '.')          -- 225.00 → 225, 187.50 → 187.5
         end
      || 'x' || ws.reps
      || ' for ' || case when coalesce(ws.is_warmup, false) then 'warmup' else 'working set' end
      || coalesce(
           ' (' || nullif(concat_ws(', ',
             case when ws.rpe is not null
                  then 'rpe ' || rtrim(rtrim(ws.rpe::text, '0'), '.') end,
             nullif(btrim(ws.note), '')
           ), '') || ')', ''
         ) as line
  from public.workout_sets ws
  join wk                 on wk.id = ws.workout_id
  join public.exercises e on e.id  = ws.exercise_id
),

-- Bullet header + its set lines. Grouping by exercise merges an exercise that
-- was logged in two separate blocks, matching the importer's mergeExercises.
exercise_blocks as (
  select
    workout_id, workout_name, workout_notes, local_start,
    min(logged_at)  as ex_first_logged,
    min(set_number) as ex_first_set,
    '∙ ' || exercise_name
      || coalesce(
           ' — ' || nullif(count(*) filter (where not is_warmup), 0)::text || '×'
           || case
                when min(reps) filter (where not is_warmup)
                   = max(reps) filter (where not is_warmup)
                then (min(reps) filter (where not is_warmup))::text
                else (min(reps) filter (where not is_warmup))::text || '-'
                  || (max(reps) filter (where not is_warmup))::text
              end,
           ''                                            -- warmup-only: bare name
         )
      || E'\n'
      || string_agg(line, E'\n' order by set_number, logged_at) as block
  from set_lines
  group by workout_id, workout_name, workout_notes, local_start,
           exercise_id, exercise_name
),

workout_blocks as (
  select
    local_start,
    to_char(local_start, 'FMMM/FMDD/YYYY') || E'\n'
      || upper(to_char(local_start, 'FMDy')) || ' — ' || workout_name
      || coalesce(E'\n' || nullif(btrim(workout_notes), ''), '')
      || E'\n'
      || string_agg(block, E'\n' order by ex_first_logged, ex_first_set) as block
  from exercise_blocks
  group by workout_id, local_start, workout_name, workout_notes
)

select coalesce(string_agg(block, E'\n\n' order by local_start), '') as google_doc_log
from workout_blocks;


-- ── Alternative: one line per row ────────────────────────────────────────────
-- If the SQL Editor truncates the single cell above, replace the final SELECT
-- with this and copy the whole column instead:
--
--   select unnest(string_to_array(block || E'\n', E'\n')) as line
--   from (select block from workout_blocks order by local_start) q;


-- ── Sanity check: what is actually in there ──────────────────────────────────
-- Run this first to see the real date range and confirm the since_date above
-- is not clipping anything. Set since_date to '1970-01-01' to export every
-- STR-logged workout.
--
--   select
--     count(*)                                   as workouts,
--     min(w.started_at)                          as first_workout,
--     max(w.started_at)                          as last_workout,
--     count(*) filter (where w.is_imported)      as imported_skipped
--   from public.workouts w
--   where w.user_id = (select id from public.users
--                      where email = 'vasquezjrnick@gmail.com');
