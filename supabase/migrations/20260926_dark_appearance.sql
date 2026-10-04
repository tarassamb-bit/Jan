alter table public.user_settings drop constraint if exists user_settings_appearance_check;
alter table public.user_settings add constraint user_settings_appearance_check check (appearance in ('system', 'light', 'dark'));
alter table public.user_settings add column if not exists response_style text not null default 'balanced';
alter table public.user_settings drop constraint if exists user_settings_response_style_check;
alter table public.user_settings add constraint user_settings_response_style_check check (response_style in ('concise', 'balanced', 'detailed'));
