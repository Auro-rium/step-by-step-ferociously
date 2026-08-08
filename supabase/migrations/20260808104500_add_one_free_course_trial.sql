create table if not exists public.free_course_claims (
  user_id uuid primary key references auth.users(id) on delete cascade,
  challenge_id uuid not null references public.challenges(id) on delete restrict,
  claimed_at timestamptz not null default now()
);

create index if not exists free_course_claims_challenge_idx on public.free_course_claims(challenge_id);

alter table public.free_course_claims enable row level security;
revoke all on table public.free_course_claims from public, anon, authenticated;
grant select, insert, update, delete on table public.free_course_claims to service_role;

create or replace function public.get_free_course_trial_status()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_email text;
  v_claim record;
  v_role text;
begin
  if v_user is null then
    raise exception 'Authentication required';
  end if;

  select p.role into v_role from public.profiles p where p.id = v_user;
  select lower(btrim(u.email)) into v_email from auth.users u where u.id = v_user;

  if v_role = 'admin' then
    return jsonb_build_object('eligible', false, 'reason', 'admin_access', 'claimed', false);
  end if;

  if exists (
    select 1 from public.complimentary_course_access g
    where g.email = v_email and g.active and g.all_published_courses
  ) then
    return jsonb_build_object('eligible', false, 'reason', 'complimentary_access', 'claimed', false);
  end if;

  select f.challenge_id, f.claimed_at, c.slug, c.title
    into v_claim
  from public.free_course_claims f
  join public.challenges c on c.id = f.challenge_id
  where f.user_id = v_user;

  if found then
    return jsonb_build_object(
      'eligible', false,
      'claimed', true,
      'challenge_id', v_claim.challenge_id,
      'slug', v_claim.slug,
      'title', v_claim.title,
      'claimed_at', v_claim.claimed_at
    );
  end if;

  return jsonb_build_object('eligible', true, 'claimed', false);
end;
$$;

revoke all on function public.get_free_course_trial_status() from public, anon;
grant execute on function public.get_free_course_trial_status() to authenticated, service_role;

create or replace function public.claim_free_course(p_challenge_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_email text;
  v_role text;
  v_course record;
begin
  if v_user is null then
    raise exception 'Authentication required';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_user::text, 0));

  select p.role into v_role from public.profiles p where p.id = v_user;
  if v_role = 'admin' then
    raise exception 'Admin accounts already have course access';
  end if;

  select lower(btrim(u.email)) into v_email from auth.users u where u.id = v_user;
  if exists (
    select 1 from public.complimentary_course_access g
    where g.email = v_email and g.active and g.all_published_courses
  ) then
    raise exception 'This account already has complimentary course access';
  end if;

  if exists (select 1 from public.free_course_claims f where f.user_id = v_user) then
    raise exception 'Your free course has already been claimed';
  end if;

  select c.id, c.slug, c.title
    into v_course
  from public.challenges c
  where c.id = p_challenge_id
    and c.status = 'published'
    and coalesce(c.route_ready, true) = true;

  if not found then
    raise exception 'This course is not available for the free trial';
  end if;

  if exists (
    select 1 from public.enrollments e
    where e.user_id = v_user
      and e.challenge_id = p_challenge_id
      and e.access_status in ('paid','granted')
  ) then
    raise exception 'You already have access to this course. Choose another course for your free trial';
  end if;

  insert into public.free_course_claims(user_id, challenge_id)
  values (v_user, p_challenge_id);

  insert into public.enrollments(user_id, challenge_id, access_status, enrolled_at, updated_at)
  values (v_user, p_challenge_id, 'granted', now(), now())
  on conflict (user_id, challenge_id) do update
    set access_status = case
      when public.enrollments.access_status = 'paid' then 'paid'
      else 'granted'
    end,
    updated_at = now();

  return jsonb_build_object(
    'claimed', true,
    'challenge_id', v_course.id,
    'slug', v_course.slug,
    'title', v_course.title,
    'access_status', 'granted'
  );
end;
$$;

revoke all on function public.claim_free_course(uuid) from public, anon;
grant execute on function public.claim_free_course(uuid) to authenticated, service_role;
