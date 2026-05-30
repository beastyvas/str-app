-- ─────────────────────────────────────────────
-- STR — Initial Schema
-- ─────────────────────────────────────────────

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ── USERS ──────────────────────────────────────────────────────────────────────
create table public.users (
  id            uuid references auth.users(id) on delete cascade primary key,
  email         text not null,
  display_name  text,
  bodyweight_lbs numeric(6,1),
  unit_pref     text not null default 'lbs' check (unit_pref in ('lbs', 'kg')),
  avatar_url    text,
  created_at    timestamptz not null default now()
);

alter table public.users enable row level security;

create policy "Users can view their own profile"
  on public.users for select using (auth.uid() = id);

create policy "Users can update their own profile"
  on public.users for update using (auth.uid() = id);

create policy "Users can insert their own profile"
  on public.users for insert with check (auth.uid() = id);

-- Auto-create user row on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.users (id, email, display_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- ── EXERCISES ─────────────────────────────────────────────────────────────────
create table public.exercises (
  id                uuid primary key default uuid_generate_v4(),
  name              text not null,
  muscle_group      text not null,
  secondary_muscle  text,
  equipment_type    text,
  is_custom         boolean not null default false,
  created_by        uuid references public.users(id) on delete set null,
  form_cues         text,
  demo_video_url    text,
  created_at        timestamptz not null default now()
);

alter table public.exercises enable row level security;

-- Everyone can read default exercises; users can read their own custom ones
create policy "Anyone can view non-custom exercises"
  on public.exercises for select
  using (is_custom = false or created_by = auth.uid());

create policy "Users can insert custom exercises"
  on public.exercises for insert
  with check (is_custom = true and created_by = auth.uid());

create policy "Users can update their own custom exercises"
  on public.exercises for update
  using (created_by = auth.uid());

create policy "Users can delete their own custom exercises"
  on public.exercises for delete
  using (created_by = auth.uid());


-- ── WORKOUTS ──────────────────────────────────────────────────────────────────
create table public.workouts (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references public.users(id) on delete cascade,
  name        text not null,
  started_at  timestamptz not null default now(),
  ended_at    timestamptz,
  notes       text,
  created_at  timestamptz not null default now()
);

alter table public.workouts enable row level security;

create policy "Users can manage their own workouts"
  on public.workouts for all using (auth.uid() = user_id);


-- ── WORKOUT SETS ──────────────────────────────────────────────────────────────
create table public.workout_sets (
  id           uuid primary key default uuid_generate_v4(),
  workout_id   uuid not null references public.workouts(id) on delete cascade,
  exercise_id  uuid not null references public.exercises(id),
  set_number   integer not null,
  weight       numeric(7,2) not null default 0,
  reps         integer not null default 0,
  rpe          numeric(3,1) check (rpe >= 1 and rpe <= 10),
  note         text,
  logged_at    timestamptz not null default now()
);

alter table public.workout_sets enable row level security;

create policy "Users can manage sets in their own workouts"
  on public.workout_sets for all
  using (
    exists (
      select 1 from public.workouts w
      where w.id = workout_id and w.user_id = auth.uid()
    )
  );

-- Index for fast history queries
create index workout_sets_workout_id_idx on public.workout_sets(workout_id);
create index workout_sets_exercise_id_idx on public.workout_sets(exercise_id);


-- ── PERSONAL RECORDS ──────────────────────────────────────────────────────────
create table public.personal_records (
  id           uuid primary key default uuid_generate_v4(),
  user_id      uuid not null references public.users(id) on delete cascade,
  exercise_id  uuid not null references public.exercises(id),
  weight       numeric(7,2) not null,
  reps         integer not null,
  achieved_at  timestamptz not null default now(),
  unique (user_id, exercise_id)
);

alter table public.personal_records enable row level security;

create policy "Users can manage their own PRs"
  on public.personal_records for all using (auth.uid() = user_id);


-- ── FRIENDSHIPS ───────────────────────────────────────────────────────────────
create table public.friendships (
  id            uuid primary key default uuid_generate_v4(),
  requester_id  uuid not null references public.users(id) on delete cascade,
  addressee_id  uuid not null references public.users(id) on delete cascade,
  status        text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at    timestamptz not null default now(),
  unique (requester_id, addressee_id)
);

alter table public.friendships enable row level security;

create policy "Users can view their own friendship rows"
  on public.friendships for select
  using (auth.uid() = requester_id or auth.uid() = addressee_id);

create policy "Users can send friend requests"
  on public.friendships for insert
  with check (auth.uid() = requester_id);

create policy "Addressee can accept or decline"
  on public.friendships for update
  using (auth.uid() = addressee_id);

create policy "Either party can remove friendship"
  on public.friendships for delete
  using (auth.uid() = requester_id or auth.uid() = addressee_id);

-- Friends can view each other's PRs (must come after friendships table exists)
create policy "Friends can view PRs"
  on public.personal_records for select
  using (
    auth.uid() = user_id
    or exists (
      select 1 from public.friendships f
      where f.status = 'accepted'
      and (
        (f.requester_id = auth.uid() and f.addressee_id = user_id)
        or (f.addressee_id = auth.uid() and f.requester_id = user_id)
      )
    )
  );
