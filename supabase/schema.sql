-- ChatAlternative — Supabase PostgreSQL Schema & Row Level Security (RLS)
-- Tables: user_sessions, matchmaking_queue, matches, signaling_messages, user_blocks, user_reports

create extension if not exists "pgcrypto";

-- 1. User Sessions
create table if not exists public.user_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null unique,
  status text not null default 'idle' check (status in ('idle', 'searching', 'matched', 'connecting', 'connected')),
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- 2. Matchmaking Queue
create table if not exists public.matchmaking_queue (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null unique,
  joined_at timestamptz not null default now()
);

-- 3. Matches
create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  user_a uuid references auth.users(id) on delete cascade not null,
  user_b uuid references auth.users(id) on delete cascade not null,
  status text not null default 'matched' check (status in ('matched', 'connecting', 'connected', 'ended')),
  created_at timestamptz not null default now(),
  ended_at timestamptz,
  constraint prevent_self_match check (user_a <> user_b)
);

-- 4. Temporary Signaling Messages (No audio/video media is ever stored)
create table if not exists public.signaling_messages (
  id uuid primary key default gen_random_uuid(),
  match_id uuid references public.matches(id) on delete cascade not null,
  sender_id uuid references auth.users(id) on delete cascade not null,
  receiver_id uuid references auth.users(id) on delete cascade not null,
  signal_type text not null check (signal_type in ('offer', 'answer', 'ice-candidate', 'connected')),
  payload jsonb not null,
  created_at timestamptz not null default now()
);

-- 5. Blocking Records
create table if not exists public.user_blocks (
  id uuid primary key default gen_random_uuid(),
  blocker_id uuid references auth.users(id) on delete cascade not null,
  blocked_id uuid references auth.users(id) on delete cascade not null,
  created_at timestamptz not null default now(),
  unique (blocker_id, blocked_id)
);

-- 6. Reporting Records
create table if not exists public.user_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references auth.users(id) on delete cascade not null,
  reported_id uuid references auth.users(id) on delete cascade not null,
  match_id uuid references public.matches(id) on delete set null,
  reason text not null,
  created_at timestamptz not null default now()
);

-- Enable Row Level Security (RLS)
alter table public.user_sessions enable row level security;
alter table public.matchmaking_queue enable row level security;
alter table public.matches enable row level security;
alter table public.signaling_messages enable row level security;
alter table public.user_blocks enable row level security;
alter table public.user_reports enable row level security;

-- RLS Policies: User Sessions
create policy "Users can manage their own session"
  on public.user_sessions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- RLS Policies: Matchmaking Queue
create policy "Users can insert and remove themselves from queue"
  on public.matchmaking_queue for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Searching users can read active queue entries"
  on public.matchmaking_queue for select
  using (auth.uid() is not null);

-- RLS Policies: Matches (Only participants in a match can view or update it)
create policy "Participants can view their own matches"
  on public.matches for select
  using (auth.uid() = user_a or auth.uid() = user_b);

create policy "Participants can update their match state"
  on public.matches for update
  using (auth.uid() = user_a or auth.uid() = user_b);

-- RLS Policies: Signaling Messages (Strictly authorized for active match participants only)
create policy "Participants can read signaling messages for their match"
  on public.signaling_messages for select
  using (
    (auth.uid() = sender_id or auth.uid() = receiver_id)
    and exists (
      select 1 from public.matches m
      where m.id = match_id
        and m.status <> 'ended'
        and (m.user_a = auth.uid() or m.user_b = auth.uid())
    )
  );

create policy "Participants can insert signaling messages for their active match"
  on public.signaling_messages for insert
  with check (
    auth.uid() = sender_id
    and exists (
      select 1 from public.matches m
      where m.id = match_id
        and m.status <> 'ended'
        and ((m.user_a = sender_id and m.user_b = receiver_id) or (m.user_b = sender_id and m.user_a = receiver_id))
    )
  );

-- RLS Policies: Blocks & Reports
create policy "Users can manage their own block list"
  on public.user_blocks for all
  using (auth.uid() = blocker_id)
  with check (auth.uid() = blocker_id);

create policy "Users can submit reports"
  on public.user_reports for insert
  with check (auth.uid() = reporter_id);
