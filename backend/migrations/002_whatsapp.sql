-- WhatsApp channel: links, one-time codes, conversation source separation
-- Run after 001_initial.sql in Supabase SQL Editor.

alter table public.conversations
  add column if not exists source text not null default 'web';

alter table public.conversations
  add column if not exists external_key text;

create index if not exists conversations_user_source_idx
  on public.conversations (user_id, source);

create index if not exists conversations_whatsapp_key_idx
  on public.conversations (source, external_key)
  where source = 'whatsapp' and external_key is not null;

-- Linked WhatsApp phone numbers (E.164 digits, typically without +)
create table if not exists public.whatsapp_links (
  phone_number text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  linked_at timestamptz not null default now()
);

create index if not exists whatsapp_links_user_id_idx
  on public.whatsapp_links (user_id);

-- One-time linking codes from Settings
create table if not exists public.whatsapp_link_codes (
  code text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  expires_at timestamptz not null,
  used boolean not null default false
);

create index if not exists whatsapp_link_codes_user_id_idx
  on public.whatsapp_link_codes (user_id);

alter table public.whatsapp_links enable row level security;
alter table public.whatsapp_link_codes enable row level security;

create policy "whatsapp_links_own_rows"
  on public.whatsapp_links
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "whatsapp_link_codes_own_rows"
  on public.whatsapp_link_codes
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
