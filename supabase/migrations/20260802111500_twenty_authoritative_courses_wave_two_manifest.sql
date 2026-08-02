-- FINISH production catalog wave two: 20 authoritative public course routes.
-- Applied to Supabase on 2026-08-02 through managed migrations:
--   seed_twenty_authoritative_courses_wave_two
--   seed_wave_two_quizzes
--   seed_wave_two_quiz_questions
--   seed_wave_two_course_projects
--   publish_wave_two_after_integrity_gate
--
-- Every course below is published with an exact ordered YouTube playlist route,
-- one 20-question mastery assessment, one capstone, and INR/USD launch pricing.

DO $$
DECLARE
  expected_slugs text[] := ARRAY[
    'stanford-cs221-artificial-intelligence',
    'stanford-cs229-machine-learning',
    'stanford-cs229m-machine-learning-theory',
    'stanford-cs230-deep-learning',
    'stanford-cs234-reinforcement-learning',
    'stanford-cs224n-natural-language-processing',
    'stanford-cs231n-deep-learning-computer-vision',
    'stanford-cme295-large-language-models',
    'stanford-cs236-deep-generative-models',
    'stanford-cs336-language-modeling-from-scratch',
    'harvard-cs50ai-artificial-intelligence-python',
    'harvard-cs50p-programming-python',
    'harvard-cs50w-web-programming',
    'harvard-stat110-probability',
    'cmu-15721-advanced-database-systems',
    'cornell-cs4780-machine-learning',
    'ucl-david-silver-reinforcement-learning',
    'nand2tetris-part-one',
    'michigan-eecs498-deep-learning-computer-vision',
    'full-stack-deep-learning-2022'
  ];
  missing_count integer;
  invalid_count integer;
BEGIN
  SELECT count(*) INTO missing_count
  FROM unnest(expected_slugs) AS wanted(slug)
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.challenges c
    WHERE c.slug = wanted.slug AND c.status = 'published'
  );

  IF missing_count > 0 THEN
    RAISE EXCEPTION 'FINISH wave two is missing % published courses', missing_count;
  END IF;

  SELECT count(*) INTO invalid_count
  FROM public.challenges c
  WHERE c.slug = ANY(expected_slugs)
    AND (
      c.lesson_count < 1
      OR (SELECT count(*) FROM public.challenge_steps s WHERE s.challenge_id = c.id) <> c.lesson_count
      OR (SELECT count(*) FROM public.course_quizzes q WHERE q.challenge_id = c.id AND q.published) <> 1
      OR (SELECT count(*) FROM public.course_quiz_questions qq JOIN public.course_quizzes q ON q.id = qq.quiz_id WHERE q.challenge_id = c.id AND q.published) <> 20
      OR (SELECT count(*) FROM public.course_projects p WHERE p.challenge_id = c.id) <> 1
      OR (SELECT count(*) FROM public.challenge_prices cp WHERE cp.challenge_id = c.id AND cp.active) <> 2
    );

  IF invalid_count > 0 THEN
    RAISE EXCEPTION 'FINISH wave two has % incomplete courses', invalid_count;
  END IF;
END $$;
