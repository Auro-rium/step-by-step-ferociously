create or replace function public.submit_course_quiz(p_quiz_id uuid,p_answers jsonb)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_user uuid:=auth.uid();
  v_quiz public.course_quizzes;
  v_total integer;
  v_submitted integer;
  v_invalid integer;
  v_completed integer;
  v_correct integer;
  v_score integer;
  v_passed boolean;
  v_awarded integer:=0;
  v_feedback jsonb;
  v_today date:=current_date;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if jsonb_typeof(p_answers)<>'array' then raise exception 'Answers must be an array'; end if;

  select * into v_quiz from public.course_quizzes where id=p_quiz_id and published=true;
  if v_quiz.id is null then raise exception 'Quiz not found'; end if;
  if not public.has_paid_course_access(v_user,v_quiz.challenge_id) then
    raise exception 'Payment required before quizzes and XP are enabled';
  end if;

  select count(*) into v_total from public.course_quiz_questions where quiz_id=p_quiz_id;
  if v_total=0 then raise exception 'Quiz has no questions'; end if;

  with raw as (
    select (a->>'question_id')::uuid question_id,(a->>'selected_index')::integer selected_index
    from jsonb_array_elements(p_answers) a
  ), submitted as (
    select distinct on(question_id) question_id,selected_index from raw order by question_id
  )
  select count(*) into v_submitted from submitted;
  if v_submitted<>v_total then raise exception 'Submit exactly one answer for every question'; end if;

  with raw as (
    select (a->>'question_id')::uuid question_id,(a->>'selected_index')::integer selected_index
    from jsonb_array_elements(p_answers) a
  ), submitted as (
    select distinct on(question_id) question_id,selected_index from raw order by question_id
  )
  select count(*) into v_invalid
  from submitted s
  left join public.course_quiz_questions q on q.id=s.question_id and q.quiz_id=p_quiz_id
  where q.id is null or s.selected_index<0 or s.selected_index>=jsonb_array_length(q.options);
  if v_invalid>0 then raise exception 'One or more quiz answers are invalid'; end if;

  select count(distinct position) into v_completed
  from public.playlist_video_progress
  where user_id=v_user and challenge_id=v_quiz.challenge_id and status='completed' and position < v_quiz.unlock_after_video;
  if v_completed < v_quiz.unlock_after_video then
    raise exception 'Complete the required lessons before this quiz';
  end if;

  with raw as (
    select (a->>'question_id')::uuid question_id,(a->>'selected_index')::integer selected_index
    from jsonb_array_elements(p_answers) a
  ), submitted as (
    select distinct on(question_id) question_id,selected_index from raw order by question_id
  )
  select count(*) filter(where s.selected_index=k.correct_index) into v_correct
  from public.course_quiz_questions q
  join public.course_quiz_answer_keys k on k.question_id=q.id
  join submitted s on s.question_id=q.id
  where q.quiz_id=p_quiz_id;

  v_score:=floor((v_correct::numeric/v_total::numeric)*100)::integer;
  v_passed:=v_score>=v_quiz.pass_percent;

  insert into public.course_quiz_attempts(user_id,quiz_id,answers,correct_count,total_count,score_percent,passed)
  values(v_user,p_quiz_id,p_answers,v_correct,v_total,v_score,v_passed);

  if v_passed then
    insert into public.xp_events(user_id,challenge_id,step_id,event_type,amount,idempotency_key)
    values(v_user,v_quiz.challenge_id,null,'course_quiz_passed',v_quiz.xp_reward,v_user::text||':'||p_quiz_id::text||':quiz_passed')
    on conflict(idempotency_key) do nothing;
    if found then
      v_awarded:=v_quiz.xp_reward;
      update public.profiles
      set current_streak=case when last_activity_date=v_today then current_streak when last_activity_date=v_today-1 then current_streak+1 else 1 end,
          last_activity_date=v_today,updated_at=now()
      where id=v_user;
    end if;
  end if;

  with raw as (
    select (a->>'question_id')::uuid question_id,(a->>'selected_index')::integer selected_index
    from jsonb_array_elements(p_answers) a
  ), submitted as (
    select distinct on(question_id) question_id,selected_index from raw order by question_id
  )
  select jsonb_agg(
    jsonb_build_object(
      'question_id',q.id,
      'selected_index',s.selected_index,
      'correct_index',k.correct_index,
      'correct',s.selected_index=k.correct_index,
      'explanation',k.explanation
    ) order by q.position
  ) into v_feedback
  from public.course_quiz_questions q
  join public.course_quiz_answer_keys k on k.question_id=q.id
  join submitted s on s.question_id=q.id
  where q.quiz_id=p_quiz_id;

  return jsonb_build_object(
    'quiz_id',p_quiz_id,
    'correct_count',v_correct,
    'total_count',v_total,
    'score_percent',v_score,
    'passed',v_passed,
    'awarded_xp',v_awarded,
    'feedback',coalesce(v_feedback,'[]'::jsonb),
    'total_xp',coalesce((select sum(amount) from public.xp_events where user_id=v_user),0)
  );
end;
$$;

revoke all on function public.submit_course_quiz(uuid,jsonb) from public,anon;
grant execute on function public.submit_course_quiz(uuid,jsonb) to authenticated;
