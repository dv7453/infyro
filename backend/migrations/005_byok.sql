-- Bring-your-own-key (BYOK): per-user OpenAI or Groq API key
-- Run in Supabase SQL Editor.

create table if not exists public.user_llm_keys (
  user_id uuid primary key references auth.users (id) on delete cascade,
  provider text not null check (provider in ('groq', 'openai')),
  api_key text not null,
  updated_at timestamptz not null default now()
);

alter table public.user_llm_keys enable row level security;

create policy "user_llm_keys_own_rows"
  on public.user_llm_keys
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
