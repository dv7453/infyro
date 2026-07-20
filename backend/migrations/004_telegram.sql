-- Telegram channel: links by chat_id (no phone number), one-time codes
-- Run after 001_initial.sql in Supabase SQL Editor.
-- If you already ran 002_whatsapp.sql, conversations.source/external_key already exist.

alter table public.conversations
  add column if not exists source text not null default 'web';

alter table public.conversations
  add column if not exists external_key text;

create index if not exists conversations_telegram_key_idx
  on public.conversations (source, external_key)
  where source = 'telegram' and external_key is not null;

-- Linked Telegram chats (Bot API chat.id as text)
create table if not exists public.telegram_links (
  chat_id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  telegram_username text,
  linked_at timestamptz not null default now()
);

create index if not exists telegram_links_user_id_idx
  on public.telegram_links (user_id);

-- One-time linking codes from Settings
create table if not exists public.telegram_link_codes (
  code text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  expires_at timestamptz not null,
  used boolean not null default false
);

create index if not exists telegram_link_codes_user_id_idx
  on public.telegram_link_codes (user_id);

alter table public.telegram_links enable row level security;
alter table public.telegram_link_codes enable row level security;

create policy "telegram_links_own_rows"
  on public.telegram_links
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "telegram_link_codes_own_rows"
  on public.telegram_link_codes
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
