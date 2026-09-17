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

-- Projects, project chats, and compressed file metadata
create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null check (char_length(trim(name)) > 0),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists project_chats (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade not null,
  title text not null default 'New project chat',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists project_messages (
  id uuid primary key default gen_random_uuid(),
  project_chat_id uuid references project_chats(id) on delete cascade not null,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz default now()
);

create table if not exists project_files (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade not null,
  storage_path text not null unique,
  name text not null,
  mime_type text not null,
  original_size bigint not null check (original_size >= 0),
  compressed_size bigint not null check (compressed_size >= 0),
  compression text not null check (compression in ('webp', 'gzip', 'original')),
  created_at timestamptz default now()
);

create index if not exists idx_projects_user_id on projects(user_id);
create index if not exists idx_project_chats_project_id on project_chats(project_id);
create index if not exists idx_project_messages_chat_id on project_messages(project_chat_id);
create index if not exists idx_project_files_project_id on project_files(project_id);

alter table projects enable row level security;
alter table project_chats enable row level security;
alter table project_messages enable row level security;
alter table project_files enable row level security;

drop policy if exists "Users manage own projects" on projects;
drop policy if exists "Users manage own project chats" on project_chats;
drop policy if exists "Users manage own project messages" on project_messages;
drop policy if exists "Users manage own project files" on project_files;
create policy "Users manage own projects" on projects for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users manage own project chats" on project_chats for all using (project_id in (select id from projects where user_id = auth.uid())) with check (project_id in (select id from projects where user_id = auth.uid()));
create policy "Users manage own project messages" on project_messages for all using (project_chat_id in (select pc.id from project_chats pc join projects p on p.id = pc.project_id where p.user_id = auth.uid())) with check (project_chat_id in (select pc.id from project_chats pc join projects p on p.id = pc.project_id where p.user_id = auth.uid()));
create policy "Users manage own project files" on project_files for all using (project_id in (select id from projects where user_id = auth.uid())) with check (project_id in (select id from projects where user_id = auth.uid()));

-- Files are uploaded directly to this private bucket from the authenticated app.
insert into storage.buckets (id, name, public, file_size_limit)
values ('project-files', 'project-files', false, 26214400)
on conflict (id) do update set public = false, file_size_limit = 26214400;

drop policy if exists "Users manage own project objects" on storage.objects;
create policy "Users manage own project objects" on storage.objects for all
using (bucket_id = 'project-files' and (storage.foldername(name))[1] = auth.uid()::text)
with check (bucket_id = 'project-files' and (storage.foldername(name))[1] = auth.uid()::text);

-- Account settings and durable daily free-plan usage
create table if not exists user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  appearance text not null default 'system' check (appearance in ('system', 'light')),
  language text not null default 'auto',
  response_streaming boolean not null default true,
  custom_instructions text not null default '',
  updated_at timestamptz default now()
);

create table if not exists daily_usage (
  user_id uuid references auth.users(id) on delete cascade not null,
  usage_date date not null default current_date,
  messages integer not null default 0 check (messages >= 0),
  uploads integer not null default 0 check (uploads >= 0),
  updated_at timestamptz default now(),
  primary key (user_id, usage_date)
);

create table if not exists user_memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  content text not null check (char_length(trim(content)) between 2 and 220),
  created_at timestamptz default now()
);

alter table user_settings add column if not exists developer_mode boolean not null default false;
-- Remove retired prototype-only settings when upgrading an existing project.
alter table user_settings drop column if exists accent_color;
alter table user_settings drop column if exists response_detail;
alter table user_settings drop column if exists code_mode;

alter table user_settings enable row level security;
alter table daily_usage enable row level security;
alter table user_memories enable row level security;
drop policy if exists "Users manage own settings" on user_settings;
drop policy if exists "Users manage own daily usage" on daily_usage;
drop policy if exists "Users manage own memories" on user_memories;
create policy "Users manage own settings" on user_settings for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users manage own daily usage" on daily_usage for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users manage own memories" on user_memories for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Enable email sign-up (check Supabase Dashboard → Authentication → Providers → Email is enabled)
begin;

alter table public.project_messages add column if not exists attachments jsonb not null default '[]'::jsonb;

-- Clients can read counters; only trusted functions and insert triggers change them.
drop policy if exists "Users manage own daily usage" on public.daily_usage;
drop policy if exists "Users read own daily usage" on public.daily_usage;
create policy "Users read own daily usage" on public.daily_usage for select using (auth.uid() = user_id);
revoke insert, update, delete on public.daily_usage from anon, authenticated;
grant select on public.daily_usage to authenticated;

create or replace function public.consume_daily_usage(p_user_id uuid, p_kind text, p_amount integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  result public.daily_usage;
  utc_day date := (clock_timestamp() at time zone 'UTC')::date;
begin
  if p_user_id is null or p_kind not in ('messages', 'uploads') or p_amount < 1 then
    raise exception 'INVALID_USAGE_REQUEST';
  end if;
  insert into public.daily_usage(user_id, usage_date) values(p_user_id, utc_day)
    on conflict(user_id, usage_date) do nothing;
  -- UPDATE locks the account/day row and evaluates the bound against the latest value.
  update public.daily_usage
  set messages = messages + case when p_kind = 'messages' then p_amount else 0 end,
      uploads = uploads + case when p_kind = 'uploads' then p_amount else 0 end,
      updated_at = now()
  where user_id = p_user_id and usage_date = utc_day
    and messages + case when p_kind = 'messages' then p_amount else 0 end <= 100
    and uploads + case when p_kind = 'uploads' then p_amount else 0 end <= 3
  returning * into result;
  if not found then
    if p_kind = 'messages' then raise exception 'DAILY_MESSAGE_LIMIT';
    else raise exception 'DAILY_UPLOAD_LIMIT'; end if;
  end if;
  return jsonb_build_object('messages', result.messages, 'uploads', result.uploads);
end;
$$;
revoke all on function public.consume_daily_usage(uuid, text, integer) from public, anon, authenticated;

create or replace function public.consume_chat_message(p_user_id uuid)
returns jsonb language sql security definer set search_path = '' as $$
  select public.consume_daily_usage(p_user_id, 'messages', 1);
$$;
revoke all on function public.consume_chat_message(uuid) from public, anon, authenticated;
grant execute on function public.consume_chat_message(uuid) to service_role;

create or replace function public.count_saved_uploads()
returns trigger language plpgsql security definer set search_path = '' as $$
declare owner_id uuid; file_count integer;
begin
  if tg_table_name = 'messages' then
    if new.role <> 'user' then return new; end if;
    file_count := jsonb_array_length(new.attachments);
    select user_id into owner_id from public.conversations where id = new.conversation_id;
  else
    file_count := 1;
    select user_id into owner_id from public.projects where id = new.project_id;
  end if;
  if file_count > 0 then perform public.consume_daily_usage(owner_id, 'uploads', file_count); end if;
  return new;
end;
$$;
revoke all on function public.count_saved_uploads() from public, anon, authenticated;
drop trigger if exists count_message_uploads on public.messages;
create trigger count_message_uploads before insert on public.messages for each row execute function public.count_saved_uploads();
drop trigger if exists count_project_uploads on public.project_files;
create trigger count_project_uploads before insert on public.project_files for each row execute function public.count_saved_uploads();
commit;
