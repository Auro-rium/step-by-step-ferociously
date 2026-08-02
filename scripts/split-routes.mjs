import { mkdir, readFile, writeFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const mainPath = new URL('src/main.tsx', root);
const packagePath = new URL('package.json', root);
const routesDirectory = new URL('src/routes/', root);
const corePath = new URL('src/app-core.tsx', root);
const courseUiPath = new URL('src/course-ui.tsx', root);
const regionPath = new URL('src/region.ts', root);

let source = await readFile(mainPath, 'utf8');
if (source.includes("lazy(() => import('./routes/landing'))")) {
  console.log('FINISH routes are already split.');
  process.exit(0);
}

const markers = {
  courseUi: '// ---- src/components/CourseCard.tsx ----',
  landing: '// ---- src/pages/Landing.tsx ----',
  catalog: '// ---- src/pages/Catalog.tsx ----',
  course: '// ---- src/pages/Course.tsx ----',
  auth: '// ---- src/pages/Auth.tsx ----',
  dashboard: '// ---- src/pages/Dashboard.tsx ----',
  checkout: '// ---- src/pages/Checkout.tsx ----',
  learn: '// ---- src/pages/Learn.tsx ----',
  admin: '// ---- src/pages/Admin.tsx ----',
  notFound: '// ---- src/pages/NotFound.tsx ----',
};

const positions = Object.fromEntries(Object.entries(markers).map(([name, marker]) => [name, source.indexOf(marker)]));
for (const [name, position] of Object.entries(positions)) {
  if (position < 0) throw new Error(`Route split could not find ${name} marker.`);
}
const ordered = ['courseUi', 'landing', 'catalog', 'course', 'auth', 'dashboard', 'checkout', 'learn', 'admin', 'notFound'];
for (let index = 1; index < ordered.length; index += 1) {
  if (positions[ordered[index]] <= positions[ordered[index - 1]]) {
    throw new Error(`Route markers are out of order near ${ordered[index]}.`);
  }
}

const section = (start, end) => source.slice(positions[start], positions[end]).trimStart();

let core = source.slice(0, positions.courseUi).trimEnd();
core = core.replace(
  "import { AdminProjectReviews, FinalProjectPanel, regionalPrice, useRegion, type CourseProject, type CourseStep, type ProjectSubmission, type RegionalOffer } from './course-product';",
  "import type { CourseProject, CourseStep, ProjectSubmission } from './course-product';",
);

if (!core.includes('interface LearningState')) {
  const apiMarker = '// ---- src/lib/supabase.ts ----';
  const learningState = `interface LearningState {\n  course: Challenge;\n  progress: VideoProgress[];\n  xp: XpEvent[];\n  quizzes: Quiz[];\n  attempts: QuizAttempt[];\n  steps: CourseStep[];\n  project: CourseProject | null;\n  submission: ProjectSubmission | null;\n}\n\n`;
  if (!core.includes(apiMarker)) throw new Error('Could not place the shared learning state.');
  core = core.replace(apiMarker, learningState + apiMarker);
}

core += `\n\nexport {\n  AppLayout,\n  EmptyState,\n  ErrorBoundary,\n  PageError,\n  PageLoader,\n  Pill,\n  ProgressBar,\n  PublicLayout,\n  RequireAdmin,\n  RequireAuth,\n  SessionProvider,\n  hasPaidAccess,\n  isCourseRouteReady,\n  prefetchCourse,\n  supabase,\n  supabaseAnonKey,\n  supabaseUrl,\n  useSession,\n  withTimeout,\n};\n\nexport type {\n  Challenge,\n  Enrollment,\n  LearningState,\n  PaymentOrder,\n  Quiz,\n  QuizAttempt,\n  VideoProgress,\n  XpEvent,\n};\n`;

let courseUi = section('courseUi', 'landing')
  .replace(markers.courseUi, '')
  .replace('function priceFor(', 'export function priceFor(')
  .replace('function formatMoney(', 'export function formatMoney(')
  .replace('const CATALOG_CATEGORY_ORDER =', 'export const CATALOG_CATEGORY_ORDER =')
  .replace('function normalizeCatalogText(', 'export function normalizeCatalogText(')
  .replace('function courseCategory(', 'export function courseCategory(')
  .replace('function courseSearchText(', 'export function courseSearchText(')
  .replace('function CourseArtwork(', 'export function CourseArtwork(')
  .replace('function CourseCard(', 'export function CourseCard(')
  .trim();
courseUi = `import { Link } from 'react-router-dom';\nimport { ArrowUpRight, CheckCircle2, Clock3, PlayCircle } from 'lucide-react';\nimport { regionalPrice, useRegion, type RegionalOffer } from './region';\nimport { Pill, hasPaidAccess, prefetchCourse, type Challenge, type Enrollment } from './app-core';\n\n${courseUi}\n`;

const makeRoute = (body, imports, functionName) => `${imports}\n\n${body
  .replace(markers[functionName.toLowerCase()] || '', '')
  .replace(new RegExp(`function ${functionName}\\(`), `export default function ${functionName}(`)
  .trim()}\n`;

const landing = makeRoute(
  section('landing', 'catalog'),
  `import { Link } from 'react-router-dom';\nimport { ArrowRight, ArrowUpRight, Check, CirclePlay, Gauge, Layers3, Sparkles } from 'lucide-react';`,
  'Landing',
);

const catalog = makeRoute(
  section('catalog', 'course'),
  `import { useEffect, useMemo, useState } from 'react';\nimport { Link } from 'react-router-dom';\nimport { Search, X } from 'lucide-react';\nimport { EmptyState, PageError, PageLoader, getCatalog, supabase, useSession, withTimeout, type Challenge, type Enrollment } from '../app-core';\nimport { CATALOG_CATEGORY_ORDER, CourseCard, courseCategory, courseSearchText, normalizeCatalogText } from '../course-ui';`,
  'Catalog',
);

const course = makeRoute(
  section('course', 'auth'),
  `import { useEffect, useState } from 'react';\nimport { Link, useParams } from 'react-router-dom';\nimport { ArrowUpRight, Check, ChevronRight, Infinity as InfinityIcon, ShieldCheck, Trophy } from 'lucide-react';\nimport { getCourse, getEnrollment, hasPaidAccess, isCourseRouteReady, PageError, PageLoader, Pill, useSession, type Challenge, type Enrollment } from '../app-core';\nimport { CourseArtwork, formatMoney, priceFor } from '../course-ui';\nimport { useRegion } from '../region';`,
  'CoursePage',
);

const auth = makeRoute(
  section('auth', 'dashboard'),
  `import { useEffect, useState, type FormEvent } from 'react';\nimport { Link, useNavigate, useSearchParams } from 'react-router-dom';\nimport { ArrowRight, Check, LoaderCircle, LockKeyhole, Sparkles } from 'lucide-react';\nimport { supabase, supabaseAnonKey, supabaseUrl, useSession, withTimeout } from '../app-core';`,
  'Auth',
);

const dashboard = makeRoute(
  section('dashboard', 'checkout'),
  `import { useEffect, useState } from 'react';\nimport { Link } from 'react-router-dom';\nimport { ArrowUpRight, BookOpen, Flame, Trophy } from 'lucide-react';\nimport { EmptyState, PageError, PageLoader, ProgressBar, getDashboard, getLearningRoute, useSession, type Enrollment, type QuizAttempt, type VideoProgress, type XpEvent } from '../app-core';\nimport { CourseArtwork } from '../course-ui';`,
  'Dashboard',
);

const checkout = makeRoute(
  section('checkout', 'learn'),
  `import { useEffect, useState } from 'react';\nimport { Link, useNavigate, useParams } from 'react-router-dom';\nimport { ArrowLeft, Check, CreditCard, LoaderCircle, ShieldCheck, WalletCards } from 'lucide-react';\nimport { PageError, PageLoader, getCourse, getEnrollment, hasPaidAccess, isCourseRouteReady, supabase, useSession, type Challenge } from '../app-core';\nimport { formatMoney } from '../course-ui';`,
  'Checkout',
);

const learn = makeRoute(
  section('learn', 'admin'),
  `import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';\nimport { Link, useNavigate, useParams } from 'react-router-dom';\nimport { ArrowRight, Check, ChevronLeft, CirclePlay, LoaderCircle, LockKeyhole, Trophy } from 'lucide-react';\nimport { FinalProjectPanel, type CourseProject, type CourseStep, type ProjectSubmission } from '../course-product';\nimport { PageError, PageLoader, ProgressBar, getLearningRoute, supabase, useSession, type Challenge, type Quiz, type QuizAttempt, type VideoProgress, type XpEvent } from '../app-core';`,
  'Learn',
);

const admin = makeRoute(
  section('admin', 'notFound'),
  `import { useEffect, useState, type FormEvent } from 'react';\nimport { BookPlus, ClipboardList, LoaderCircle, Plus, ReceiptText, Trash2 } from 'lucide-react';\nimport { AdminProjectReviews } from '../course-product';\nimport { PageError, PageLoader, getAdminData, supabase, type Challenge, type PaymentOrder } from '../app-core';`,
  'Admin',
);

const entry = `import { StrictMode, Suspense, lazy } from 'react';\nimport { createRoot } from 'react-dom/client';\nimport { createBrowserRouter, Link, RouterProvider } from 'react-router-dom';\nimport { ArrowLeft } from 'lucide-react';\nimport { AppLayout, ErrorBoundary, PageLoader, PublicLayout, RequireAdmin, RequireAuth, SessionProvider } from './app-core';\n\nconst Landing = lazy(() => import('./routes/landing'));\nconst Catalog = lazy(() => import('./routes/catalog'));\nconst CoursePage = lazy(() => import('./routes/course'));\nconst Auth = lazy(() => import('./routes/auth'));\nconst Dashboard = lazy(() => import('./routes/dashboard'));\nconst Checkout = lazy(() => import('./routes/checkout'));\nconst Learn = lazy(() => import('./routes/learn'));\nconst Admin = lazy(() => import('./routes/admin'));\n\nfunction NotFound() {\n  return <main className=\"not-found shell\"><p className=\"eyebrow\">404</p><h1>This route does not exist.</h1><p>At least this dead end is honest about being a dead end.</p><Link className=\"button button-primary\" to=\"/\"><ArrowLeft />Return home</Link></main>;\n}\n\nconst router = createBrowserRouter([\n  { element: <PublicLayout />, children: [\n    { path: '/', element: <Landing /> },\n    { path: '/catalog', element: <Catalog /> },\n    { path: '/course/:slug', element: <CoursePage /> },\n  ] },\n  { path: '/auth', element: <Auth /> },\n  { element: <RequireAuth />, children: [\n    { element: <AppLayout />, children: [\n      { path: '/app', element: <Dashboard /> },\n      { path: '/checkout/:slug', element: <Checkout /> },\n    ] },\n    { path: '/learn/:slug', element: <Learn /> },\n  ] },\n  { element: <RequireAdmin />, children: [{ element: <AppLayout />, children: [{ path: '/admin', element: <Admin /> }] }] },\n  { path: '*', element: <NotFound /> },\n]);\n\nfunction App() {\n  return <Suspense fallback={<PageLoader label=\"Opening this FINISH route\" />}><RouterProvider router={router} /></Suspense>;\n}\n\nconst rootElement = document.getElementById('root');\nif (!rootElement) throw new Error('FINISH root element is missing.');\ncreateRoot(rootElement).render(\n  <StrictMode>\n    <ErrorBoundary>\n      <SessionProvider><App /></SessionProvider>\n    </ErrorBoundary>\n  </StrictMode>,\n);\n`;

const region = `export interface RegionalOffer {\n  country: 'GLOBAL';\n  countryName: 'Global';\n  provider: 'paypal';\n  currency: 'USD';\n  market: 'global';\n}\n\nexport interface RegionalPrice {\n  provider: string;\n  currency: string;\n  amount: number;\n  active?: boolean;\n}\n\nconst globalOffer: RegionalOffer = {\n  country: 'GLOBAL',\n  countryName: 'Global',\n  provider: 'paypal',\n  currency: 'USD',\n  market: 'global',\n};\n\nexport function useRegion() {\n  return globalOffer;\n}\n\nexport function regionalPrice(prices: RegionalPrice[], _region: RegionalOffer) {\n  return prices.find((price) => price.active !== false && price.provider === 'paypal' && price.currency === 'USD')\n    || { amount: 1, currency: 'USD', provider: 'paypal' };\n}\n`;

await mkdir(routesDirectory, { recursive: true });
await Promise.all([
  writeFile(corePath, core),
  writeFile(courseUiPath, courseUi),
  writeFile(regionPath, region),
  writeFile(new URL('landing.tsx', routesDirectory), landing),
  writeFile(new URL('catalog.tsx', routesDirectory), catalog),
  writeFile(new URL('course.tsx', routesDirectory), course),
  writeFile(new URL('auth.tsx', routesDirectory), auth),
  writeFile(new URL('dashboard.tsx', routesDirectory), dashboard),
  writeFile(new URL('checkout.tsx', routesDirectory), checkout),
  writeFile(new URL('learn.tsx', routesDirectory), learn),
  writeFile(new URL('admin.tsx', routesDirectory), admin),
  writeFile(mainPath, entry),
]);

const packageJson = JSON.parse(await readFile(packagePath, 'utf8'));
packageJson.scripts.dev = 'vite';
packageJson.scripts.build = 'tsc --noEmit && vite build';
packageJson.scripts.typecheck = 'tsc --noEmit --pretty false';
await writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`);

console.log('FINISH route-level chunks generated and build-time source mutation disabled.');
