create or replace function public.get_public_catalog_stats()
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $function$
  select jsonb_build_object(
    'courses', (
      select count(*)
      from public.challenges
      where status = 'published' and coalesce(route_ready, true)
    ),
    'lessons', (
      select coalesce(sum(lesson_count), 0)
      from public.challenges
      where status = 'published' and coalesce(route_ready, true)
    ),
    'quizzes', (
      select count(*)
      from public.course_quizzes q
      join public.challenges c on c.id = q.challenge_id
      where c.status = 'published' and coalesce(c.route_ready, true) and q.published = true
    ),
    'questions', (
      select count(*)
      from public.course_quiz_questions qq
      join public.course_quizzes q on q.id = qq.quiz_id
      join public.challenges c on c.id = q.challenge_id
      where c.status = 'published' and coalesce(c.route_ready, true) and q.published = true
    ),
    'projects', (
      select count(*)
      from public.course_projects p
      join public.challenges c on c.id = p.challenge_id
      where c.status = 'published' and coalesce(c.route_ready, true)
    ),
    'previews', (
      select count(*)
      from public.challenges
      where status = 'published' and not coalesce(route_ready, true)
    )
  );
$function$;

revoke all on function public.get_public_catalog_stats() from public;
grant execute on function public.get_public_catalog_stats() to anon, authenticated, service_role;
