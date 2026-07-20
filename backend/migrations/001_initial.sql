-- Infyro agent backend schema
-- Run this in Supabase SQL Editor after creating the project.

-- google_tokens: stored Google OAuth refresh tokens per user
create table if not exists public.google_tokens (
  user_id uuid primary key references auth.users (id) on delete cascade,
  refresh_token text not null,
  scopes text[] not null,
  updated_at timestamptz not null default now()
);

-- agent_settings: persona, tool permissions, and defaults
create table if not exists public.agent_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  persona_prompt text not null default '',
  tool_permissions jsonb not null default '{
    "send_email": "confirm",
    "schedule_meeting": "confirm",
    "create_document": "auto",
    "export_pdf": "auto",
    "save_to_drive": "auto",
    "create_spreadsheet": "auto",
    "search_email": "auto"
  }'::jsonb,
  defaults jsonb not null default '{}'::jsonb
);

-- conversations
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

-- messages
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  role text not null,
  content text not null,
  created_at timestamptz not null default now()
);

-- activity_log
create table if not exists public.activity_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  tool_name text not null,
  params jsonb,
  result jsonb,
  created_at timestamptz not null default now()
);

-- Indexes
create index if not exists conversations_user_id_idx on public.conversations (user_id);
create index if not exists messages_conversation_id_idx on public.messages (conversation_id);
create index if not exists activity_log_user_id_idx on public.activity_log (user_id);

-- RLS
alter table public.google_tokens enable row level security;
alter table public.agent_settings enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.activity_log enable row level security;

-- Policies: rows restricted to owning user
create policy "google_tokens_own_rows"
  on public.google_tokens
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "agent_settings_own_rows"
  on public.agent_settings
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "conversations_own_rows"
  on public.conversations
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "messages_own_via_conversation"
  on public.messages
  for all
  using (
    exists (
      select 1
      from public.conversations c
      where c.id = messages.conversation_id
        and c.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.conversations c
      where c.id = messages.conversation_id
        and c.user_id = auth.uid()
    )
  );

create policy "activity_log_own_rows"
  on public.activity_log
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
