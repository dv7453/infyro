-- Feedback / beta suggestion form
-- Run this in the Supabase SQL Editor.

create table if not exists public.feedback_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  email text not null,
  name text not null,
  message text not null,
  created_at timestamptz not null default now()
);

create index if not exists feedback_messages_user_id_idx
  on public.feedback_messages (user_id);

create index if not exists feedback_messages_created_at_idx
  on public.feedback_messages (created_at desc);

alter table public.feedback_messages enable row level security;

-- Backend uses the service role key (bypasses RLS).
-- Authenticated users can insert their own rows if you ever call Supabase from the client:
create policy "Users can insert own feedback"
  on public.feedback_messages
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can read own feedback"
  on public.feedback_messages
  for select
  to authenticated
  using (auth.uid() = user_id);
