begin;

create table if not exists public.user_promos (
  user_id uuid primary key references auth.users(id) on delete cascade,
  code text not null check (code = 'FREE'),
  created_at timestamptz not null default now()
);

alter table public.user_promos enable row level security;
drop policy if exists "Users read own promo" on public.user_promos;
create policy "Users read own promo" on public.user_promos
  for select using (auth.uid() = user_id);
revoke insert, update, delete on public.user_promos from anon, authenticated;
grant select on public.user_promos to authenticated;

create or replace function public.consume_daily_usage(p_user_id uuid, p_kind text, p_amount integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  result public.daily_usage;
  utc_day date := (clock_timestamp() at time zone 'UTC')::date;
  has_unlimited boolean;
begin
  if p_user_id is null or p_kind not in ('messages', 'uploads') or p_amount < 1 then
    raise exception 'INVALID_USAGE_REQUEST';
  end if;
  select exists(select 1 from public.user_promos where user_id = p_user_id and code = 'FREE') into has_unlimited;
  insert into public.daily_usage(user_id, usage_date) values(p_user_id, utc_day)
    on conflict(user_id, usage_date) do nothing;
  update public.daily_usage
  set messages = messages + case when p_kind = 'messages' then p_amount else 0 end,
      uploads = uploads + case when p_kind = 'uploads' then p_amount else 0 end,
      updated_at = now()
  where user_id = p_user_id and usage_date = utc_day
    and (has_unlimited or messages + case when p_kind = 'messages' then p_amount else 0 end <= 100)
    and (has_unlimited or uploads + case when p_kind = 'uploads' then p_amount else 0 end <= 3)
  returning * into result;
  if not found then
    if p_kind = 'messages' then raise exception 'DAILY_MESSAGE_LIMIT';
    else raise exception 'DAILY_UPLOAD_LIMIT'; end if;
  end if;
  return jsonb_build_object('messages', result.messages, 'uploads', result.uploads);
end;
$$;
revoke all on function public.consume_daily_usage(uuid, text, integer) from public, anon, authenticated;

commit;
