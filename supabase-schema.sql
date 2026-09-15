-- Run this SQL in your Supabase SQL Editor (Dashboard → SQL Editor → New query)

-- Conversations table
create table if not exists conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  title text default 'New conversation',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Messages table
create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references conversations(id) on delete cascade not null,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  attachments jsonb not null default '[]'::jsonb,
  created_at timestamptz default now()
);

-- Safe for projects that already created the messages table before attachments existed.
alter table messages add column if not exists attachments jsonb not null default '[]'::jsonb;

-- Indexes for fast queries
create index if not exists idx_conversations_user_id on conversations(user_id);
create index if not exists idx_messages_conversation_id on messages(conversation_id);
create index if not exists idx_messages_created_at on messages(created_at);

-- Row Level Security — users can only see their own data
alter table conversations enable row level security;
alter table messages enable row level security;

-- Drop existing policies if they exist (safe to re-run)
drop policy if exists "Users see own conversations" on conversations;
drop policy if exists "Users insert own conversations" on conversations;
drop policy if exists "Users update own conversations" on conversations;
drop policy if exists "Users delete own conversations" on conversations;
drop policy if exists "Users see own messages" on messages;
drop policy if exists "Users insert own messages" on messages;
drop policy if exists "Users delete own messages" on messages;

-- Conversation policies
create policy "Users see own conversations"
  on conversations for select
  using (auth.uid() = user_id);

create policy "Users insert own conversations"
  on conversations for insert
  with check (auth.uid() = user_id);

create policy "Users update own conversations"
  on conversations for update
  using (auth.uid() = user_id);

create policy "Users delete own conversations"
  on conversations for delete
  using (auth.uid() = user_id);

-- Message policies
create policy "Users see own messages"
  on messages for select
  using (
    conversation_id in (
      select id from conversations where user_id = auth.uid()
    )
  );

create policy "Users insert own messages"
  on messages for insert
  with check (
    conversation_id in (
      select id from conversations where user_id = auth.uid()
    )
  );

create policy "Users delete own messages"
  on messages for delete
  using (
    conversation_id in (
      select id from conversations where user_id = auth.uid()
    )
  );

-- Enable email sign-up (check Supabase Dashboard → Authentication → Providers → Email is enabled)
