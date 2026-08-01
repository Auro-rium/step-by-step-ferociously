create unique index if not exists playlist_video_progress_user_course_position_uidx
on public.playlist_video_progress(user_id, challenge_id, position);

create or replace function public.complete_playlist_video(p_challenge_id uuid, p_video_id text, p_position integer)
returns table(awarded_xp integer, total_xp bigint, current_streak integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_award integer := 20;
  v_today date := current_date;
  v_streak integer;
  v_inserted integer := 0;
  v_lesson_count integer;
  v_position_limit integer;
  v_blocking_quizzes integer;
begin
  if v_user is null then raise exception 'Authentication required'; end if;

  select lesson_count into v_lesson_count
  from public.challenges
  where id=p_challenge_id and status='published';
  if not found then raise exception 'Challenge not found'; end if;

  if not public.has_paid_course_access(v_user,p_challenge_id) then
    raise exception 'Payment required before course progress and XP are enabled';
  end if;
  if p_video_id !~ '^[A-Za-z0-9_-]{6,20}$' then raise exception 'Invalid video ID'; end if;

  v_position_limit := case when coalesce(v_lesson_count,0)>0 then v_lesson_count else 200 end;
  if p_position < 0 or p_position >= v_position_limit then raise exception 'Invalid lesson position'; end if;

  if p_position > 0 and not exists(
    select 1 from public.playlist_video_progress
    where user_id=v_user and challenge_id=p_challenge_id and position=p_position-1 and status='completed'
  ) then
    raise exception 'Complete the previous lesson first';
  end if;

  select count(*) into v_blocking_quizzes
  from public.course_quizzes q
  where q.challenge_id=p_challenge_id and q.published=true and q.unlock_after_video <= p_position
    and not exists(
      select 1 from public.course_quiz_attempts a
      where a.user_id=v_user and a.quiz_id=q.id and a.passed=true
    );
  if v_blocking_quizzes > 0 then raise exception 'Pass the required quiz checkpoint first'; end if;

  insert into public.playlist_video_progress(user_id,challenge_id,video_id,position,status,completed_at)
  values(v_user,p_challenge_id,p_video_id,p_position,'completed',now())
  on conflict do nothing;
  get diagnostics v_inserted = row_count;

  if v_inserted > 0 then
    insert into public.xp_events(user_id,challenge_id,step_id,event_type,amount,idempotency_key)
    values(v_user,p_challenge_id,null,'playlist_video_completed',v_award,v_user::text||':'||p_challenge_id::text||':position:'||p_position::text||':completed')
    on conflict(idempotency_key) do nothing;

    update public.profiles
    set current_streak=case when last_activity_date=v_today then current_streak when last_activity_date=v_today-1 then current_streak+1 else 1 end,
        last_activity_date=v_today,updated_at=now()
    where id=v_user
    returning profiles.current_streak into v_streak;
  else
    select profiles.current_streak into v_streak from public.profiles where id=v_user;
  end if;

  return query
  select case when v_inserted>0 then v_award else 0 end,
         coalesce((select sum(amount) from public.xp_events where user_id=v_user),0),
         coalesce(v_streak,0);
end;
$$;

revoke all on function public.complete_playlist_video(uuid,text,integer) from public,anon;
grant execute on function public.complete_playlist_video(uuid,text,integer) to authenticated;
