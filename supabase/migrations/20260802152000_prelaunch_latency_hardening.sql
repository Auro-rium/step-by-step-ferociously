-- FINISH latency hardening. Payment behavior is intentionally untouched.

create index if not exists challenges_published_featured_created_idx
  on public.challenges (is_featured desc, created_at asc)
  where status = 'published';
create index if not exists challenges_created_by_idx on public.challenges (created_by);
create index if not exists enrollments_challenge_id_idx on public.enrollments (challenge_id);
create index if not exists playlist_video_progress_challenge_id_idx on public.playlist_video_progress (challenge_id);
create index if not exists playlist_video_progress_user_challenge_status_idx
  on public.playlist_video_progress (user_id, challenge_id, status);
create index if not exists xp_events_user_challenge_idx on public.xp_events (user_id, challenge_id);
create index if not exists xp_events_challenge_id_idx on public.xp_events (challenge_id);
create index if not exists xp_events_step_id_idx on public.xp_events (step_id);
create index if not exists course_quiz_attempts_quiz_id_idx on public.course_quiz_attempts (quiz_id);
create index if not exists course_project_submissions_challenge_id_idx on public.course_project_submissions (challenge_id);
create index if not exists course_project_submissions_project_id_idx on public.course_project_submissions (project_id);
create index if not exists course_project_submissions_reviewer_id_idx on public.course_project_submissions (reviewer_id);
create index if not exists course_project_submissions_user_challenge_idx
  on public.course_project_submissions (user_id, challenge_id);
create index if not exists payment_orders_challenge_id_idx on public.payment_orders (challenge_id);
create index if not exists payment_orders_price_id_idx on public.payment_orders (price_id);
create index if not exists step_progress_step_id_idx on public.step_progress (step_id);

drop policy if exists "users can read own profile" on public.profiles;
create policy "users can read own profile" on public.profiles
  for select to authenticated
  using ((select auth.uid()) = id);

drop policy if exists "users can update own profile" on public.profiles;
create policy "users can update own profile" on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

drop policy if exists "users can read own enrollments" on public.enrollments;
create policy "users can read own enrollments" on public.enrollments
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "users can read own progress" on public.step_progress;
create policy "users can read own progress" on public.step_progress
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "users can read own xp" on public.xp_events;
create policy "users can read own xp" on public.xp_events
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "users read own payment orders" on public.payment_orders;
create policy "users read own payment orders" on public.payment_orders
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "users read own playlist progress" on public.playlist_video_progress;
create policy "users read own playlist progress" on public.playlist_video_progress
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "users read own quiz attempts" on public.course_quiz_attempts;
create policy "users read own quiz attempts" on public.course_quiz_attempts
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "users read own project submissions" on public.course_project_submissions;
create policy "users read own project submissions" on public.course_project_submissions
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "paid users read quizzes" on public.course_quizzes;
create policy "paid users read quizzes" on public.course_quizzes
  for select to authenticated
  using (published = true and public.has_paid_course_access((select auth.uid()), challenge_id));

drop policy if exists "paid users read quiz questions" on public.course_quiz_questions;
create policy "paid users read quiz questions" on public.course_quiz_questions
  for select to authenticated
  using (exists (
    select 1
    from public.course_quizzes q
    where q.id = course_quiz_questions.quiz_id
      and q.published = true
      and public.has_paid_course_access((select auth.uid()), q.challenge_id)
  ));

drop policy if exists "paid users read course projects" on public.course_projects;
create policy "paid users read course projects" on public.course_projects
  for select to authenticated
  using (public.has_paid_course_access((select auth.uid()), challenge_id));

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select exists(
    select 1
    from public.profiles
    where id = (select auth.uid()) and role = 'admin'
  );
$function$;

create or replace function public.has_paid_course_access(p_user uuid, p_challenge uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select p_user = (select auth.uid())
    and (
      exists(select 1 from public.profiles p where p.id = p_user and p.role = 'admin')
      or exists(
        select 1
        from public.enrollments e
        where e.user_id = p_user
          and e.challenge_id = p_challenge
          and e.access_status in ('paid','granted')
      )
    );
$function$;

create or replace function public.get_public_course_thumbnails()
returns table(slug text, title text, video_id text)
language sql
stable
security definer
set search_path to 'public'
as $function$
  select c.slug, c.title, first_step.youtube_video_id
  from public.challenges c
  join lateral (
    select s.youtube_video_id
    from public.challenge_steps s
    where s.challenge_id = c.id
      and s.youtube_video_id is not null
    order by s.position asc
    limit 1
  ) first_step on true
  where c.status = 'published'
  order by c.is_featured desc, c.created_at asc;
$function$;

revoke all on function public.get_public_course_thumbnails() from public;
grant execute on function public.get_public_course_thumbnails() to anon, authenticated, service_role;
