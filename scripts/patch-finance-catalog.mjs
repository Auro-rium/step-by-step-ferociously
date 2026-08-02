import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mainFile = path.join(root, 'src', 'main.tsx');
const stylesFile = path.join(root, 'src', 'styles.css');

let source = fs.readFileSync(mainFile, 'utf8');

function replaceRequired(search, replacement, label) {
  if (!source.includes(search)) throw new Error(`Finance catalog patch could not find ${label}.`);
  source = source.replace(search, replacement);
}

if (!source.includes('route_ready?: boolean | null;')) {
  replaceRequired(
    '  project_required?: boolean | null;\n',
    '  project_required?: boolean | null;\n  route_ready?: boolean | null;\n',
    'the Challenge route readiness field',
  );
}

if (!source.includes('function isCourseRouteReady')) {
  replaceRequired(
    "function hasPaidAccess(enrollment: Enrollment | null): boolean {\n  return enrollment?.access_status === 'paid' || enrollment?.access_status === 'granted';\n}\n",
    "function hasPaidAccess(enrollment: Enrollment | null): boolean {\n  return enrollment?.access_status === 'paid' || enrollment?.access_status === 'granted';\n}\n\nfunction isCourseRouteReady(course: Challenge): boolean {\n  return course.route_ready !== false;\n}\n",
    'the paid access helper',
  );
}

if (!source.includes('const routeReady = isCourseRouteReady(course);')) {
  replaceRequired(
    '  const owned = hasPaidAccess(enrollment ?? null);\n',
    '  const owned = hasPaidAccess(enrollment ?? null);\n  const routeReady = isCourseRouteReady(course);\n',
    'the course card access state',
  );
}

if (!source.includes("routeReady ? `${course.lesson_count || 'Playlist'} lessons`")) {
  replaceRequired(
    "<Pill><PlayCircle size={13} />{course.lesson_count || 'Playlist'} lessons</Pill>",
    "<Pill><PlayCircle size={13} />{routeReady ? `${course.lesson_count || 'Playlist'} lessons` : course.lesson_count ? `${course.lesson_count} source sessions` : 'Source course selected'}</Pill>",
    'the course card lesson label',
  );
}

if (!source.includes("Route opening soon")) {
  replaceRequired(
    `      <div className="card-bottom">
        <strong>{owned ? <span className="owned"><CheckCircle2 size={16} />Owned</span> : formatMoney(price.amount, price.currency)}</strong>
        <Link className="button button-primary" onMouseEnter={() => prefetchCourse(course.slug)} onFocus={() => prefetchCourse(course.slug)} to={owned ? \`/learn/\${course.slug}\` : \`/course/\${course.slug}\`}>{owned ? 'Continue' : 'Explore course'} <ArrowUpRight size={16} /></Link>
      </div>`,
    `      <div className="card-bottom">
        <strong>{owned ? <span className="owned"><CheckCircle2 size={16} />Owned</span> : routeReady ? formatMoney(price.amount, price.currency) : <span className="route-soon">Route opening soon</span>}</strong>
        <Link className="button button-primary" onMouseEnter={() => prefetchCourse(course.slug)} onFocus={() => prefetchCourse(course.slug)} to={owned ? \`/learn/\${course.slug}\` : \`/course/\${course.slug}\`}>{owned ? 'Continue' : routeReady ? 'Explore course' : 'Preview course'} <ArrowUpRight size={16} /></Link>
      </div>`,
    'the course card purchase controls',
  );
}

if (!source.includes('const routeReady = isCourseRouteReady(course);\n  const destination')) {
  replaceRequired(
    `  const owned = hasPaidAccess(enrollment);
  const price = priceFor(course, region);
  const destination = owned ? \`/learn/\${course.slug}\` : user ? \`/checkout/\${course.slug}\` : \`/auth?next=\${encodeURIComponent(\`/checkout/\${course.slug}\`)}\`;`,
    `  const owned = hasPaidAccess(enrollment);
  const price = priceFor(course, region);
  const routeReady = isCourseRouteReady(course);
  const destination = owned ? \`/learn/\${course.slug}\` : user ? \`/checkout/\${course.slug}\` : \`/auth?next=\${encodeURIComponent(\`/checkout/\${course.slug}\`)}\`;`,
    'the course detail destination',
  );
}

if (!source.includes("routeReady ? <><Pill>Knowledge checks")) {
  replaceRequired(
    `<div className="course-pills"><Pill>{course.lesson_count || 'Full playlist'} lessons</Pill><Pill>Knowledge checks</Pill><Pill>Progress + XP</Pill><Pill>{course.difficulty || 'Advanced'}</Pill><Pill>Reviewed final project</Pill></div>`,
    `<div className="course-pills"><Pill>{course.lesson_count ? \`${'${course.lesson_count} source sessions'}\` : 'Source course selected'}</Pill>{routeReady ? <><Pill>Knowledge checks</Pill><Pill>Progress + XP</Pill><Pill>Reviewed final project</Pill></> : <><Pill>Curriculum mapping</Pill><Pill>No payment yet</Pill></>}<Pill>{course.difficulty || 'Advanced'}</Pill></div>`,
    'the course detail capability pills',
  );
}

if (!source.includes("'ROUTE STATUS'")) {
  replaceRequired(
    `<div className="course-price"><div><small>{owned ? 'YOUR ACCESS' : 'ONE-TIME PRICE'}</small><strong>{owned ? 'Unlocked' : formatMoney(price.amount, price.currency)}</strong><span>{owned ? 'Return whenever you need it.' : 'No subscription. Permanent access.'}</span></div><Link className="button button-acid button-large" to={destination}>{owned ? 'Continue learning' : 'Start this course'} <ArrowUpRight size={18} /></Link></div>`,
    `<div className="course-price"><div><small>{owned ? 'YOUR ACCESS' : routeReady ? 'ONE-TIME PRICE' : 'ROUTE STATUS'}</small><strong>{owned ? 'Unlocked' : routeReady ? formatMoney(price.amount, price.currency) : 'Structuring now'}</strong><span>{owned ? 'Return whenever you need it.' : routeReady ? 'No subscription. Permanent access.' : 'The source course is selected. Payment stays disabled until the FINISH route, quizzes and project are complete.'}</span></div>{owned || routeReady ? <Link className="button button-acid button-large" to={destination}>{owned ? 'Continue learning' : 'Start this course'} <ArrowUpRight size={18} /></Link> : <span className="button button-acid button-large route-disabled" aria-disabled="true">Opening soon</span>}</div>`,
    'the course detail purchase panel',
  );
}

if (!source.includes("'Verified source curriculum'")) {
  replaceRequired(
    `<section className="included-panel"><p className="eyebrow">INCLUDED</p><div>{['Complete named lecture route','Saved lesson progress','Authored quiz checkpoints','Cumulative final assessment','Reviewed final project','XP and streak tracking','Permanent course access'].map((item) => <span key={item}><Check size={17} />{item}</span>)}</div></section>`,
    `<section className="included-panel"><p className="eyebrow">{routeReady ? 'INCLUDED' : 'ROUTE PREVIEW'}</p><div>{(routeReady ? ['Complete named lecture route','Saved lesson progress','Authored quiz checkpoints','Cumulative final assessment','Reviewed final project','XP and streak tracking','Permanent course access'] : ['Verified source curriculum','Learning sequence being mapped','Knowledge checks being authored','Final applied project being designed','No checkout until the route is complete']).map((item) => <span key={item}><Check size={17} />{item}</span>)}</div></section>`,
    'the course detail included panel',
  );
}

if (!source.includes('This course route is still being structured and cannot be purchased yet.')) {
  replaceRequired(
    `        const next = await getCourse(slug);
        const enrollment = await getEnrollment(user.id, next.id);`,
    `        const next = await getCourse(slug);
        if (!isCourseRouteReady(next)) throw new Error('This course route is still being structured and cannot be purchased yet.');
        const enrollment = await getEnrollment(user.id, next.id);`,
    'the checkout route guard',
  );
}

const requiredMarkers = [
  'route_ready?: boolean | null;',
  'function isCourseRouteReady',
  'Route opening soon',
  "'ROUTE STATUS'",
  'This course route is still being structured and cannot be purchased yet.',
];
for (const marker of requiredMarkers) {
  if (!source.includes(marker)) throw new Error(`Finance catalog patch verification failed for ${marker}.`);
}

fs.writeFileSync(mainFile, source);

let styles = fs.readFileSync(stylesFile, 'utf8');
if (!styles.includes('/* FINANCE ROUTE PREVIEWS */')) {
  styles += `

/* FINANCE ROUTE PREVIEWS */
.route-soon{display:inline-flex;align-items:center;padding:7px 10px;border:1px solid color-mix(in srgb,var(--border) 80%,transparent);border-radius:999px;font-size:11px;line-height:1;text-transform:uppercase;letter-spacing:.08em;color:var(--muted)}
.route-disabled{cursor:not-allowed;opacity:.58;pointer-events:none;user-select:none}
`;
  fs.writeFileSync(stylesFile, styles);
}

console.log('FINISH finance category and route-readiness gate applied.');
