begin;

alter table public.project_messages add column if not exists attachments jsonb not null default '[]'::jsonb;
alter table public.user_settings add column if not exists developer_mode boolean not null default false;

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
