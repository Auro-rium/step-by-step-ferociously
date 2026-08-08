import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mainFile = path.join(root, 'src', 'main.tsx');
let main = fs.readFileSync(mainFile, 'utf8');

function replaceRequired(search, replacement, label) {
  if (!main.includes(search)) {
    if (main.includes(replacement)) return;
    throw new Error(`Custom-route patch could not find ${label}.`);
  }
  main = main.replace(search, replacement);
}

if (!main.includes("from './pages/CustomRoute'")) {
  replaceRequired(
    "import { AdminProjectReviews, FinalProjectPanel, regionalPrice, useRegion, type CourseProject, type CourseStep, type ProjectSubmission, type RegionalOffer } from './course-product';",
    "import { AdminProjectReviews, FinalProjectPanel, regionalPrice, useRegion, type CourseProject, type CourseStep, type ProjectSubmission, type RegionalOffer } from './course-product';\nimport { CustomRouteBuilder } from './pages/CustomRoute';",
    'the course product import',
  );
}

if (!main.includes('origin_type?:')) {
  const fieldAnchor = main.includes('  route_ready?: boolean | null;\n')
    ? '  route_ready?: boolean | null;\n'
    : '  project_required?: boolean | null;\n';
  replaceRequired(
    fieldAnchor,
    `${fieldAnchor}  visibility?: 'public' | 'private' | string | null;\n  origin_type?: 'catalog' | 'custom_playlist' | string | null;\n  created_by?: string | null;\n`,
    'the Challenge visibility fields',
  );
}

if (main.includes('const CATALOG_SELECT =') && !main.match(/const CATALOG_SELECT =[^\n]*visibility/)) {
  replaceRequired(
    'project_required, quiz_count, route_ready, challenge_prices',
    'project_required, quiz_count, route_ready, visibility, origin_type, created_by, challenge_prices',
    'the catalog select list',
  );
}

if (!main.includes(".eq('visibility', 'public')\n        .order('is_featured'")) {
  replaceRequired(
    ".eq('status', 'published')\n        .order('is_featured', { ascending: false })",
    ".eq('status', 'published')\n        .eq('visibility', 'public')\n        .order('is_featured', { ascending: false })",
    'the public catalog visibility filter',
  );
}

main = main.replace(/const CATALOG_SESSION_KEY = 'finish:catalog:v\d+';/, "const CATALOG_SESSION_KEY = 'finish:catalog:v5';");

if (!main.includes('<NavLink to="/custom">Make a route</NavLink>')) {
  main = main.replace(
    '<NavLink to="/catalog">Catalog</NavLink>',
    '<NavLink to="/catalog">Catalog</NavLink>\n            <NavLink to="/custom">Make a route</NavLink>',
  );
  main = main.replace(
    '<NavLink to="/catalog">Courses</NavLink>',
    '<NavLink to="/catalog">Courses</NavLink>\n            <NavLink to="/custom">Make a route</NavLink>',
  );
}

if (!main.includes('function CustomRoutePage()')) {
  replaceRequired(
    '// ---- src/pages/NotFound.tsx ----',
    `function CustomRoutePage() {
  const { user } = useSession();
  if (!user) return <PageLoader label="Opening custom routes" />;
  return <CustomRouteBuilder client={supabase} userId={user.id} supabaseUrl={supabaseUrl} supabaseKey={supabaseAnonKey} />;
}

// ---- src/pages/NotFound.tsx ----`,
    'the NotFound route boundary',
  );
}

if (!main.includes("{ path: '/custom', element: <CustomRoutePage /> }")) {
  replaceRequired(
    "{ path: '/app', element: <Dashboard /> },",
    "{ path: '/app', element: <Dashboard /> },\n      { path: '/custom', element: <CustomRoutePage /> },",
    'the authenticated app routes',
  );
}

if (!main.includes("const customRoute = course.origin_type === 'custom_playlist';")) {
  replaceRequired(
    `  const routeReady = isCourseRouteReady(course);
  const destination = owned ? \`/learn/\${course.slug}\` : user ? \`/checkout/\${course.slug}\` : \`/auth?next=\${encodeURIComponent(\`/checkout/\${course.slug}\`)}\`;`,
    `  const routeReady = isCourseRouteReady(course);
  const customRoute = course.origin_type === 'custom_playlist';
  const destination = owned ? \`/learn/\${course.slug}\` : user ? \`/checkout/\${course.slug}\` : \`/auth?next=\${encodeURIComponent(\`/checkout/\${course.slug}\`)}\`;`,
    'the course custom-route state',
  );
}

main = main.replace(
  'if (!user || !course || owned || !routeReady || !freeTrial?.eligible || claimingTrial) return;',
  'if (!user || !course || owned || !routeReady || customRoute || !freeTrial?.eligible || claimingTrial) return;',
);
main = main.replaceAll(
  'routeReady && (!user || freeTrial?.eligible)',
  'routeReady && !customRoute && (!user || freeTrial?.eligible)',
);
main = main.replace(
  ": !routeReady ? 'The source course is selected. Payment stays disabled until the FINISH route, quizzes and project are complete.' : !user ?",
  ": !routeReady ? 'The source course is selected. Payment stays disabled until the FINISH route, quizzes and project are complete.' : customRoute ? 'Private AI-generated route. One-time unlock. It does not use your free catalog-course claim.' : !user ?",
);
main = main.replace(
  ': !routeReady ? <span className="button button-acid button-large route-disabled" aria-disabled="true">Opening soon</span> : !user ?',
  ': !routeReady ? <span className="button button-acid button-large route-disabled" aria-disabled="true">Opening soon</span> : customRoute ? <Link className="button button-acid button-large" to={destination}>Unlock this route <ArrowUpRight size={18} /></Link> : !user ?',
);

const required = [
  "from './pages/CustomRoute'",
  'origin_type?:',
  "finish:catalog:v5",
  ".eq('visibility', 'public')",
  '<NavLink to="/custom">Make a route</NavLink>',
  'function CustomRoutePage()',
  "{ path: '/custom', element: <CustomRoutePage /> }",
  "const customRoute = course.origin_type === 'custom_playlist';",
  'Private AI-generated route. One-time unlock.',
  'Unlock this route',
];
for (const marker of required) {
  if (!main.includes(marker)) throw new Error(`Custom-route verification failed for ${marker}.`);
}

fs.writeFileSync(mainFile, main);
console.log('FINISH private AI playlist-route builder applied.');
