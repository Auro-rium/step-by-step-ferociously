alter table public.challenges
  add column if not exists visibility text not null default 'public',
  add column if not exists origin_type text not null default 'catalog';

alter table public.challenges
  drop constraint if exists challenges_visibility_check,
  drop constraint if exists challenges_origin_type_check;

alter table public.challenges
  add constraint challenges_visibility_check check (visibility in ('public','private')),
  add constraint challenges_origin_type_check check (origin_type in ('catalog','custom_playlist'));

create index if not exists challenges_visibility_status_idx
  on public.challenges (visibility, status, route_ready);
create index if not exists challenges_created_by_origin_idx
  on public.challenges (created_by, origin_type, created_at desc);

create table if not exists public.custom_route_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  challenge_id uuid unique references public.challenges(id) on delete cascade,
  source_type text not null default 'youtube_playlist' check (source_type = 'youtube_playlist'),
  source_url text not null,
  playlist_id text not null,
  source_title text,
  source_channel text,
  status text not null default 'generating' check (status in ('generating','ready','failed')),
  model text,
  video_count integer check (video_count is null or (video_count >= 2 and video_count <= 80)),
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  generated_at timestamptz
);

create index if not exists custom_route_requests_user_created_idx
  on public.custom_route_requests (user_id, created_at desc);
create index if not exists custom_route_requests_status_idx
  on public.custom_route_requests (status, created_at desc);

alter table public.custom_route_requests enable row level security;

drop policy if exists "users read own custom route requests" on public.custom_route_requests;
create policy "users read own custom route requests"
  on public.custom_route_requests for select to authenticated
  using ((select auth.uid()) = user_id);

revoke all on public.custom_route_requests from anon;
revoke insert, update, delete on public.custom_route_requests from authenticated;
grant select on public.custom_route_requests to authenticated;
grant all on public.custom_route_requests to service_role;

drop policy if exists "published challenges are public" on public.challenges;
drop policy if exists "visible published challenges" on public.challenges;
create policy "visible published challenges"
  on public.challenges for select
  using (
    status = 'published'
    and (
      visibility = 'public'
      or created_by = (select auth.uid())
      or public.has_paid_course_access((select auth.uid()), id)
    )
  );

drop policy if exists "published challenge steps are public" on public.challenge_steps;
drop policy if exists "public or paid challenge steps" on public.challenge_steps;
create policy "public or paid challenge steps"
  on public.challenge_steps for select
  using (
    exists (
      select 1 from public.challenges c
      where c.id = challenge_steps.challenge_id
        and c.status = 'published'
        and (
          c.visibility = 'public'
          or public.has_paid_course_access((select auth.uid()), c.id)
        )
    )
  );

drop policy if exists "active prices are public" on public.challenge_prices;
drop policy if exists "visible active prices" on public.challenge_prices;
create policy "visible active prices"
  on public.challenge_prices for select
  using (
    active = true
    and exists (
      select 1 from public.challenges c
      where c.id = challenge_prices.challenge_id
        and (
          c.visibility = 'public'
          or c.created_by = (select auth.uid())
          or public.has_paid_course_access((select auth.uid()), c.id)
        )
    )
  );

create or replace function public.get_public_catalog_stats()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'courses', (
      select count(*) from public.challenges
      where status = 'published' and visibility = 'public' and coalesce(route_ready, true)
    ),
    'lessons', (
      select coalesce(sum(lesson_count), 0) from public.challenges
      where status = 'published' and visibility = 'public' and coalesce(route_ready, true)
    ),
    'quizzes', (
      select count(*)
      from public.course_quizzes q
      join public.challenges c on c.id = q.challenge_id
      where c.status = 'published' and c.visibility = 'public' and coalesce(c.route_ready, true) and q.published = true
    ),
    'questions', (
      select count(*)
      from public.course_quiz_questions qq
      join public.course_quizzes q on q.id = qq.quiz_id
      join public.challenges c on c.id = q.challenge_id
      where c.status = 'published' and c.visibility = 'public' and coalesce(c.route_ready, true) and q.published = true
    ),
    'projects', (
      select count(*)
      from public.course_projects p
      join public.challenges c on c.id = p.challenge_id
      where c.status = 'published' and c.visibility = 'public' and coalesce(c.route_ready, true)
    ),
    'previews', (
      select count(*) from public.challenges
      where status = 'published' and visibility = 'public' and not coalesce(route_ready, true)
    )
  );
$$;

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
  if v_user is null then raise exception 'Authentication required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_user::text, 0));

  select p.role into v_role from public.profiles p where p.id = v_user;
  if v_role = 'admin' then raise exception 'Admin accounts already have course access'; end if;

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

  select c.id, c.slug, c.title into v_course
  from public.challenges c
  where c.id = p_challenge_id
    and c.status = 'published'
    and c.visibility = 'public'
    and c.origin_type = 'catalog'
    and coalesce(c.route_ready, true) = true;

  if not found then raise exception 'This course is not available for the free trial'; end if;

  if exists (
    select 1 from public.enrollments e
    where e.user_id = v_user and e.challenge_id = p_challenge_id and e.access_status in ('paid','granted')
  ) then
    raise exception 'You already have access to this course. Choose another course for your free trial';
  end if;

  insert into public.free_course_claims(user_id, challenge_id)
  values (v_user, p_challenge_id);

  insert into public.enrollments(user_id, challenge_id, access_status, enrolled_at, updated_at)
  values (v_user, p_challenge_id, 'granted', now(), now())
  on conflict (user_id, challenge_id) do update
    set access_status = case when public.enrollments.access_status = 'paid' then 'paid' else 'granted' end,
        updated_at = now();

  return jsonb_build_object('claimed', true, 'challenge_id', v_course.id, 'slug', v_course.slug, 'title', v_course.title, 'access_status', 'granted');
end;
$$;

create or replace function public.grant_new_published_course_to_complimentary_users()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'published'
     and coalesce(new.visibility, 'public') = 'public'
     and coalesce(new.origin_type, 'catalog') = 'catalog'
     and (tg_op = 'INSERT' or old.status is distinct from new.status) then
    insert into public.enrollments (user_id, challenge_id, access_status, enrolled_at, updated_at)
    select u.id, new.id, 'granted', now(), now()
    from auth.users u
    join public.complimentary_course_access g
      on g.email = lower(btrim(u.email)) and g.active and g.all_published_courses
    on conflict (user_id, challenge_id) do update
      set access_status = case when public.enrollments.access_status = 'paid' then 'paid' else 'granted' end,
          updated_at = now();
  end if;
  return new;
end;
$$;

create or replace function public.materialize_custom_playlist_route(
  p_request_id uuid,
  p_user_id uuid,
  p_source jsonb,
  p_blueprint jsonb,
  p_model text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.custom_route_requests%rowtype;
  v_challenge_id uuid := gen_random_uuid();
  v_slug text;
  v_video_count integer;
  v_video jsonb;
  v_guide jsonb;
  v_quiz jsonb;
  v_question jsonb;
  v_project jsonb;
  v_quiz_id uuid;
  v_question_id uuid;
  v_idx bigint;
  v_question_idx bigint;
  v_video_id text;
  v_options jsonb;
  v_correct integer;
  v_difficulty text;
  v_base_slug text;
begin
  if p_user_id is null then raise exception 'User is required'; end if;

  select * into v_request
  from public.custom_route_requests
  where id = p_request_id and user_id = p_user_id
  for update;

  if not found then raise exception 'Custom route request not found'; end if;
  if v_request.status <> 'generating' then raise exception 'Custom route request is not generating'; end if;
  if jsonb_typeof(p_source) <> 'object' or jsonb_typeof(p_source->'videos') <> 'array' then raise exception 'Invalid playlist source'; end if;
  if jsonb_typeof(p_blueprint) <> 'object' then raise exception 'Invalid route blueprint'; end if;

  v_video_count := jsonb_array_length(p_source->'videos');
  if v_video_count < 2 or v_video_count > 80 then raise exception 'A custom route must contain 2 to 80 playable videos'; end if;
  if jsonb_typeof(p_blueprint->'quizzes') <> 'array' or jsonb_array_length(p_blueprint->'quizzes') <> 2 then raise exception 'Custom route requires exactly two quizzes'; end if;

  v_base_slug := regexp_replace(lower(coalesce(nullif(btrim(p_blueprint->>'title'), ''), nullif(btrim(p_source->>'title'), ''), 'playlist')), '[^a-z0-9]+', '-', 'g');
  v_base_slug := trim(both '-' from v_base_slug);
  if v_base_slug = '' then v_base_slug := 'playlist'; end if;
  v_slug := 'custom-' || left(v_base_slug, 40) || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);

  v_difficulty := coalesce(nullif(btrim(p_blueprint->>'difficulty'), ''), 'Intermediate');
  if v_difficulty not in ('Beginner','Intermediate','Advanced') then v_difficulty := 'Intermediate'; end if;

  insert into public.challenges (
    id, slug, title, eyebrow, description, outcome, price_cents, currency,
    duration_label, total_xp, status, youtube_playlist_id, cover_image_url,
    lesson_count, is_featured, created_by, source_title, source_channel,
    source_url, difficulty, project_required, quiz_count, route_ready,
    visibility, origin_type
  ) values (
    v_challenge_id,
    v_slug,
    left(coalesce(nullif(btrim(p_blueprint->>'title'), ''), p_source->>'title', 'Custom FINISH Route'), 180),
    'CUSTOM FINISH ROUTE',
    left(coalesce(nullif(btrim(p_blueprint->>'description'), ''), 'A private FINISH route generated from your YouTube playlist.'), 1200),
    left(coalesce(nullif(btrim(p_blueprint->>'outcome'), ''), 'Complete the playlist with structured checkpoints and a final applied project.'), 1200),
    100,
    'USD',
    v_video_count::text || ' lessons',
    (v_video_count * 20) + 650,
    'published',
    p_source->>'playlist_id',
    nullif(p_source->>'cover_image_url', ''),
    v_video_count,
    false,
    p_user_id,
    left(coalesce(p_source->>'title', 'YouTube playlist'), 240),
    left(coalesce(p_source->>'channel', 'YouTube'), 240),
    p_source->>'url',
    v_difficulty,
    true,
    2,
    true,
    'private',
    'custom_playlist'
  );

  for v_video, v_idx in
    select value, ordinality from jsonb_array_elements(p_source->'videos') with ordinality
  loop
    v_video_id := nullif(v_video->>'video_id', '');
    if v_video_id is null or v_video_id !~ '^[A-Za-z0-9_-]{6,20}$' then
      raise exception 'Playlist contains an invalid video ID at position %', v_idx;
    end if;

    v_guide := null;
    if jsonb_typeof(p_blueprint->'lesson_guidance') = 'array' then
      select g.value into v_guide
      from jsonb_array_elements(p_blueprint->'lesson_guidance') g(value)
      where (g.value->>'position') ~ '^[0-9]+$'
        and (g.value->>'position')::integer = v_idx::integer
      limit 1;
    end if;

    insert into public.challenge_steps (
      challenge_id, position, title, description, duration_minutes,
      youtube_video_id, start_seconds, end_seconds, task_prompt, xp_reward, is_preview
    ) values (
      v_challenge_id,
      v_idx::integer,
      left(coalesce(nullif(btrim(v_video->>'title'), ''), 'Lesson ' || v_idx::text), 300),
      left(coalesce(nullif(btrim(v_guide->>'description'), ''), 'Study this lesson and connect it to the previous material.'), 1000),
      greatest(coalesce(nullif(v_video->>'duration_minutes', '')::integer, 0), 0),
      v_video_id,
      0,
      null,
      left(coalesce(nullif(btrim(v_guide->>'task_prompt'), ''), 'Write down the key idea, one implication, and one question from this lesson.'), 1200),
      20,
      false
    );
  end loop;

  for v_quiz, v_idx in
    select value, ordinality from jsonb_array_elements(p_blueprint->'quizzes') with ordinality
  loop
    if jsonb_typeof(v_quiz->'questions') <> 'array' or jsonb_array_length(v_quiz->'questions') <> 20 then
      raise exception 'Each custom route quiz must contain exactly 20 questions';
    end if;

    insert into public.course_quizzes (
      challenge_id, title, description, position, unlock_after_video,
      pass_percent, xp_reward, published
    ) values (
      v_challenge_id,
      left(coalesce(nullif(btrim(v_quiz->>'title'), ''), case when v_idx = 1 then 'Mid-course knowledge check' else 'Final mastery assessment' end), 240),
      left(coalesce(nullif(btrim(v_quiz->>'description'), ''), 'Check what you retained before continuing.'), 800),
      v_idx::integer,
      case when v_idx = 1 then ceil(v_video_count / 2.0)::integer else v_video_count end,
      case when v_idx = 1 then 70 else 75 end,
      case when v_idx = 1 then 150 else 200 end,
      true
    ) returning id into v_quiz_id;

    for v_question, v_question_idx in
      select value, ordinality from jsonb_array_elements(v_quiz->'questions') with ordinality
    loop
      v_options := v_question->'options';
      if jsonb_typeof(v_options) <> 'array' or jsonb_array_length(v_options) <> 4 then
        raise exception 'Quiz question % in quiz % must contain exactly four options', v_question_idx, v_idx;
      end if;
      v_correct := coalesce(nullif(v_question->>'correct_index', '')::integer, -1);
      if v_correct < 0 or v_correct > 3 then raise exception 'Quiz answer key is invalid'; end if;

      insert into public.course_quiz_questions (quiz_id, position, prompt, options)
      values (
        v_quiz_id,
        v_question_idx::integer,
        left(coalesce(nullif(btrim(v_question->>'prompt'), ''), 'Which statement is most accurate?'), 1200),
        v_options
      ) returning id into v_question_id;

      insert into public.course_quiz_answer_keys (question_id, correct_index, explanation)
      values (
        v_question_id,
        v_correct,
        left(coalesce(nullif(btrim(v_question->>'explanation'), ''), 'Review the relevant lesson and compare the alternatives carefully.'), 1200)
      );
    end loop;
  end loop;

  v_project := p_blueprint->'project';
  if jsonb_typeof(v_project) <> 'object' then raise exception 'Custom route requires a final project'; end if;
  if jsonb_typeof(v_project->'requirements') <> 'array' or jsonb_typeof(v_project->'deliverables') <> 'array' then
    raise exception 'Final project requirements and deliverables must be arrays';
  end if;

  insert into public.course_projects (
    challenge_id, title, brief, requirements, deliverables,
    submission_instructions, xp_reward
  ) values (
    v_challenge_id,
    left(coalesce(nullif(btrim(v_project->>'title'), ''), 'Flagship project'), 240),
    left(coalesce(nullif(btrim(v_project->>'brief'), ''), 'Build an applied artifact that demonstrates the central skills from this playlist.'), 2000),
    v_project->'requirements',
    v_project->'deliverables',
    left(coalesce(nullif(btrim(v_project->>'submission_instructions'), ''), 'Submit a public HTTPS link to the finished artifact or repository and explain the major decisions you made.'), 1600),
    300
  );

  insert into public.challenge_prices (challenge_id, provider, currency, amount, active, promotion_label)
  values (v_challenge_id, 'paypal', 'USD', 1.00, true, 'Custom route launch price');

  update public.custom_route_requests
  set challenge_id = v_challenge_id,
      source_title = left(coalesce(p_source->>'title', 'YouTube playlist'), 240),
      source_channel = left(coalesce(p_source->>'channel', 'YouTube'), 240),
      status = 'ready',
      model = left(coalesce(p_model, 'openrouter/free'), 160),
      video_count = v_video_count,
      error = null,
      updated_at = now(),
      generated_at = now()
  where id = p_request_id;

  return jsonb_build_object(
    'request_id', p_request_id,
    'challenge_id', v_challenge_id,
    'slug', v_slug,
    'title', coalesce(nullif(btrim(p_blueprint->>'title'), ''), p_source->>'title', 'Custom FINISH Route'),
    'description', p_blueprint->>'description',
    'outcome', p_blueprint->>'outcome',
    'difficulty', v_difficulty,
    'lesson_count', v_video_count,
    'price_usd', 1.00,
    'status', 'ready'
  );
end;
$$;

revoke all on function public.materialize_custom_playlist_route(uuid, uuid, jsonb, jsonb, text) from public, anon, authenticated;
grant execute on function public.materialize_custom_playlist_route(uuid, uuid, jsonb, jsonb, text) to service_role;
