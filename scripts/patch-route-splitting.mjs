import { readFile, writeFile } from 'node:fs/promises';

const mainFile = new URL('../src/main.tsx', import.meta.url);
const adminFile = new URL('../src/pages/Admin.tsx', import.meta.url);
let source = await readFile(mainFile, 'utf8');
let adminSource = await readFile(adminFile, 'utf8');

function replaceOnce(current, pattern, replacement, label) {
  if (!current.includes(pattern)) {
    if (current.includes(replacement)) return current;
    throw new Error(`Route splitting patch could not find ${label}.`);
  }
  return current.replace(pattern, replacement);
}

source = replaceOnce(
  source,
  'import { StrictMode, Component,',
  'import { StrictMode, Suspense, lazy, Component,',
  'the React import',
);

for (const name of [
  'ChallengePrice',
  'Challenge',
  'Profile',
  'Enrollment',
  'VideoProgress',
  'XpEvent',
  'QuizQuestion',
  'Quiz',
  'QuizAttempt',
  'PaymentOrder',
]) {
  source = source.replace(`interface ${name} {`, `export interface ${name} {`);
}

source = source.replace('const supabase = createClient', 'export const supabase = createClient');
source = source.replace('function useSession() {', 'export function useSession() {');
source = source.replace('function PageLoader(', 'export function PageLoader(');
source = source.replace('function PageError(', 'export function PageError(');
source = source.replace('function ProgressBar(', 'export function ProgressBar(');

if (!source.includes('export interface LearningState {')) {
  const marker = '// ---- src/lib/supabase.ts ----';
  const learningState = `export interface LearningState {
  course: Challenge;
  progress: VideoProgress[];
  xp: XpEvent[];
  quizzes: Quiz[];
  attempts: QuizAttempt[];
  steps: CourseStep[];
  project: CourseProject | null;
  submission: ProjectSubmission | null;
}

`;
  if (!source.includes(marker)) throw new Error('Route splitting patch could not find the shared types boundary.');
  source = source.replace(marker, learningState + marker);
}

if (source.includes('// ---- src/pages/Learn.tsx ----')) {
  const start = source.indexOf('// ---- src/pages/Learn.tsx ----');
  const end = source.indexOf('// ---- src/pages/NotFound.tsx ----', start);
  if (end < 0) throw new Error('Route splitting patch could not isolate the heavy route pages.');
  const lazyPages = `const Learn = lazy(() => import('./pages/Learn'));
const Admin = lazy(() => import('./pages/Admin'));

`;
  source = source.slice(0, start) + lazyPages + source.slice(end);
}

source = source.replace(
  "{ path: '/learn/:slug', element: <Learn /> },",
  "{ path: '/learn/:slug', element: <Suspense fallback={<PageLoader label=\"Opening the learning route\" />}><Learn /></Suspense> },",
);
source = source.replace(
  "{ path: '/admin', element: <Admin /> }",
  "{ path: '/admin', element: <Suspense fallback={<PageLoader label=\"Opening the admin workspace\" />}><Admin /></Suspense> }",
);

adminSource = adminSource.replace("p_inr: Number(form.get('inr'))", 'p_inr: 0');
adminSource = adminSource.replace(
  `            <div className="form-columns">
              <label>USD PRICE<input name="usd" type="number" step="0.01" defaultValue="2" required /></label>
              <label>INR PRICE<input name="inr" type="number" step="1" defaultValue="159" required /></label>
            </div>`,
  '            <label>GLOBAL PAYPAL PRICE (USD)<input name="usd" type="number" min="0.01" step="0.01" defaultValue="1" required /></label>',
);

const requiredMainMarkers = [
  "lazy(() => import('./pages/Learn'))",
  "lazy(() => import('./pages/Admin'))",
  'export interface LearningState',
  'export const supabase = createClient',
  'export function useSession()',
  'export function PageLoader(',
  'export function PageError(',
  'export function ProgressBar(',
  '<Suspense fallback={<PageLoader label="Opening the learning route" />}><Learn /></Suspense>',
  '<Suspense fallback={<PageLoader label="Opening the admin workspace" />}><Admin /></Suspense>',
];
for (const marker of requiredMainMarkers) {
  if (!source.includes(marker)) throw new Error(`Route splitting verification failed for ${marker}.`);
}

if (!adminSource.includes('p_inr: 0') || !adminSource.includes('GLOBAL PAYPAL PRICE (USD)')) {
  throw new Error('Route splitting patch did not preserve the existing admin payment behavior.');
}

await Promise.all([
  writeFile(mainFile, source),
  writeFile(adminFile, adminSource),
]);

console.log('FINISH Learn and Admin routes are lazy-loaded into separate production chunks.');
