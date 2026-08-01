drop function if exists public.claim_preview(text);
drop function if exists public.complete_step(uuid);

revoke all on function public.rls_auto_enable() from public, anon, authenticated;

create or replace function public.has_paid_course_access(p_user uuid, p_challenge uuid)
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select p_user=auth.uid()
    and exists(
      select 1 from public.enrollments e
      where e.user_id=p_user
        and e.challenge_id=p_challenge
        and e.access_status in ('paid','granted')
    );
$$;

revoke all on function public.has_paid_course_access(uuid,uuid) from public,anon;
grant execute on function public.has_paid_course_access(uuid,uuid) to authenticated;
