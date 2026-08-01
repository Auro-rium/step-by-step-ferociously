-- FINISH production catalog release: 20 full MIT OpenCourseWare routes.
-- Applied to Supabase on 2026-08-01 through managed migrations:
--   add_twenty_authoritative_courses
--   seed_twenty_course_assessments_projects
--
-- This manifest keeps source control aligned with the production catalog.
-- Every listed challenge is published with a complete ordered YouTube route,
-- one 20-question mastery assessment, and one final project.

DO $$
DECLARE
  expected_slugs text[] := ARRAY[
    'mit-60001-introduction-to-python',
    'mit-60002-computational-thinking-data-science',
    'mit-6034-artificial-intelligence',
    'mit-6s191-introduction-to-deep-learning',
    'mit-6042j-mathematics-for-computer-science',
    'mit-6s081-operating-system-engineering',
    'mit-6858-computer-systems-security',
    'mit-1806-linear-algebra',
    'mit-6041-probabilistic-systems-analysis',
    'mit-6046-design-analysis-algorithms',
    'mit-6172-performance-engineering',
    'mit-6851-advanced-data-structures',
    'mit-6875-cryptography',
    'mit-6837-computer-graphics',
    'mit-6869-advances-computer-vision',
    'mit-6004-computation-structures',
    'mit-6036-introduction-to-machine-learning',
    'mit-6005-software-construction',
    'mit-18065-matrix-methods-data-analysis',
    'mit-6003-signals-systems'
  ];
  missing_count integer;
BEGIN
  SELECT count(*) INTO missing_count
  FROM unnest(expected_slugs) AS slug
  WHERE NOT EXISTS (
    SELECT 1 FROM public.challenges c
    WHERE c.slug = slug AND c.status = 'published'
  );

  IF missing_count > 0 THEN
    RAISE EXCEPTION 'FINISH course catalog is missing % expected MIT routes', missing_count;
  END IF;
END $$;
