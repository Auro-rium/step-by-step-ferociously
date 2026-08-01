create table if not exists public.signup_rate_limits (
  id bigint generated always as identity primary key,
  email_hash text not null,
  ip_hash text not null,
  created_at timestamptz not null default now()
);

create index if not exists signup_rate_limits_email_created_idx
  on public.signup_rate_limits(email_hash, created_at desc);
create index if not exists signup_rate_limits_ip_created_idx
  on public.signup_rate_limits(ip_hash, created_at desc);

alter table public.signup_rate_limits enable row level security;
revoke all on table public.signup_rate_limits from public, anon, authenticated;

create or replace function public.cleanup_signup_rate_limits()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.signup_rate_limits where created_at < now() - interval '24 hours';
$$;

revoke all on function public.cleanup_signup_rate_limits() from public, anon, authenticated;
