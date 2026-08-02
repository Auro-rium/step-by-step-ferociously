-- FINISH read-path latency hardening. Payment behavior is intentionally untouched.

create index if not exists challenges_catalog_order_idx
  on public.challenges (status, is_featured desc, created_at asc);

create index if not exists xp_events_user_challenge_idx
  on public.xp_events (user_id, challenge_id, created_at desc);

create index if not exists course_quiz_attempts_user_created_idx
  on public.course_quiz_attempts (user_id, created_at desc);

create index if not exists course_project_submissions_user_challenge_idx
  on public.course_project_submissions (user_id, challenge_id);

create or replace function public.get_dashboard_fast()
returns jsonb
language sql
stable
security definer
set search_path = 'public'
as $function$
  select jsonb_build_object(
    'enrollments', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', e.id,
          'challenge_id', e.challenge_id,
          'user_id', e.user_id,
          'access_status', e.access_status,
          'created_at', e.enrolled_at,
          'challenges', to_jsonb(c) || jsonb_build_object(
            'challenge_prices', coalesce((
              select jsonb_agg(to_jsonb(cp))
              from public.challenge_prices cp
              where cp.challenge_id = c.id and cp.active = true
            ), '[]'::jsonb)
          )
        ) order by e.enrolled_at desc
      )
      from public.enrollments e
      join public.challenges c on c.id = e.challenge_id
      where e.user_id = auth.uid()
        and e.access_status in ('paid', 'granted')
    ), '[]'::jsonb),
    'xp', coalesce((
      select jsonb_agg(jsonb_build_object('amount', x.amount, 'challenge_id', x.challenge_id))
      from public.xp_events x
      where x.user_id = auth.uid()
    ), '[]'::jsonb),
    'attempts', coalesce((
      select jsonb_agg(jsonb_build_object(
        'quiz_id', a.quiz_id,
        'passed', a.passed,
        'score_percent', a.score_percent,
        'created_at', a.created_at
      ) order by a.created_at desc)
      from public.course_quiz_attempts a
      where a.user_id = auth.uid()
    ), '[]'::jsonb),
    'progress', coalesce((
      select jsonb_agg(jsonb_build_object(
        'video_id', p.video_id,
        'challenge_id', p.challenge_id,
        'status', p.status,
        'position', p.position
      ) order by p.challenge_id, p.position)
      from public.playlist_video_progress p
      where p.user_id = auth.uid()
    ), '[]'::jsonb)
  );
$function$;

revoke all on function public.get_dashboard_fast() from public, anon;
grant execute on function public.get_dashboard_fast() to authenticated, service_role;

create or replace function public.get_learning_route(p_slug text)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_user uuid := auth.uid();
  v_course public.challenges;
  v_result jsonb;
begin
  if v_user is null then
    raise exception 'Authentication required';
  end if;

  select * into v_course
  from public.challenges
  where slug = p_slug and status = 'published';

  if v_course.id is null then
    raise exception 'Course not found';
  end if;

  if not public.has_paid_course_access(v_user, v_course.id) then
    raise exception 'Payment required';
  end if;

  select jsonb_build_object(
    'course', to_jsonb(v_course),
    'progress', coalesce((
      select jsonb_agg(jsonb_build_object(
        'video_id', p.video_id,
        'challenge_id', p.challenge_id,
        'status', p.status,
        'position', p.position,
        'completed_at', p.completed_at
      ) order by p.position)
      from public.playlist_video_progress p
      where p.user_id = v_user and p.challenge_id = v_course.id
    ), '[]'::jsonb),
    'xp', coalesce((
      select jsonb_agg(jsonb_build_object(
        'amount', x.amount,
        'challenge_id', x.challenge_id,
        'event_type', x.event_type,
        'created_at', x.created_at
      ) order by x.created_at)
      from public.xp_events x
      where x.user_id = v_user and x.challenge_id = v_course.id
    ), '[]'::jsonb),
    'quizzes', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', q.id,
          'challenge_id', q.challenge_id,
          'position', q.position,
          'title', q.title,
          'description', q.description,
          'unlock_after_video', q.unlock_after_video,
          'pass_percent', q.pass_percent,
          'xp_reward', q.xp_reward,
          'course_quiz_questions', coalesce((
            select jsonb_agg(jsonb_build_object(
              'id', qq.id,
              'position', qq.position,
              'prompt', qq.prompt,
              'options', qq.options
            ) order by qq.position)
            from public.course_quiz_questions qq
            where qq.quiz_id = q.id
          ), '[]'::jsonb)
        ) order by q.position
      )
      from public.course_quizzes q
      where q.challenge_id = v_course.id and q.published = true
    ), '[]'::jsonb),
    'attempts', coalesce((
      select jsonb_agg(jsonb_build_object(
        'quiz_id', a.quiz_id,
        'passed', a.passed,
        'score_percent', a.score_percent,
        'correct_count', a.correct_count,
        'total_count', a.total_count,
        'created_at', a.created_at
      ) order by a.created_at desc)
      from public.course_quiz_attempts a
      join public.course_quizzes q on q.id = a.quiz_id
      where a.user_id = v_user and q.challenge_id = v_course.id
    ), '[]'::jsonb),
    'steps', coalesce((
      select jsonb_agg(to_jsonb(s) order by s.position)
      from public.challenge_steps s
      where s.challenge_id = v_course.id
    ), '[]'::jsonb),
    'project', (
      select to_jsonb(cp)
      from public.course_projects cp
      where cp.challenge_id = v_course.id
      limit 1
    ),
    'submission', (
      select to_jsonb(cs)
      from public.course_project_submissions cs
      where cs.user_id = v_user and cs.challenge_id = v_course.id
      limit 1
    )
  ) into v_result;

  return v_result;
end;
$function$;

revoke all on function public.get_learning_route(text) from public, anon;
grant execute on function public.get_learning_route(text) to authenticated, service_role;
