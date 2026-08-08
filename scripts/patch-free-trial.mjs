import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mainFile = path.join(root, 'src', 'main.tsx');
const learnFile = path.join(root, 'src', 'pages', 'Learn.tsx');
const landingFile = path.join(root, 'src', 'routes', 'landing.ts');
const catalogFile = path.join(root, 'src', 'routes', 'catalog.ts');

function replaceRequired(source, search, replacement, label) {
  if (!source.includes(search)) {
    if (source.includes(replacement)) return source;
    throw new Error(`Free-trial patch could not find ${label}.`);
  }
  return source.replace(search, replacement);
}

let main = fs.readFileSync(mainFile, 'utf8');

if (!main.includes('type FreeCourseTrialStatus =')) {
  const marker = '// ---- src/lib/supabase.ts ----';
  const trialType = `type FreeCourseTrialStatus = {
  eligible: boolean;
  claimed?: boolean;
  reason?: string;
  challenge_id?: string;
  slug?: string;
  title?: string;
  claimed_at?: string;
};

`;
  main = replaceRequired(main, marker, trialType + marker, 'the shared type boundary');
}

if (!main.includes('const [freeTrial, setFreeTrial]')) {
  main = replaceRequired(
    main,
    `  const region = useRegion();
  const [course, setCourse] = useState<Challenge | null>(null);
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [error, setError] = useState('');`,
    `  const region = useRegion();
  const navigate = useNavigate();
  const [course, setCourse] = useState<Challenge | null>(null);
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [freeTrial, setFreeTrial] = useState<FreeCourseTrialStatus | null>(null);
  const [claimingTrial, setClaimingTrial] = useState(false);
  const [error, setError] = useState('');`,
    'the course detail state',
  );
}

if (!main.includes("supabase.rpc('get_free_course_trial_status')")) {
  main = replaceRequired(
    main,
    `        const next = await getCourse(slug);
        const access = user ? await getEnrollment(user.id, next.id) : null;
        if (active) { setCourse(next); setEnrollment(access); }`,
    `        const next = await getCourse(slug);
        let access: Enrollment | null = null;
        let trial: FreeCourseTrialStatus | null = null;
        if (user) {
          const [accessResult, trialResult] = await Promise.all([
            getEnrollment(user.id, next.id),
            supabase.rpc('get_free_course_trial_status'),
          ]);
          access = accessResult;
          trial = trialResult.error
            ? { eligible: false, claimed: false, reason: 'status_unavailable' }
            : (trialResult.data as FreeCourseTrialStatus | null);
        }
        if (active) { setCourse(next); setEnrollment(access); setFreeTrial(trial); }`,
    'the course detail access load',
  );
}

if (!main.includes('const claimFreeCourse = async () =>')) {
  const marker = `  const destination = owned ? \`/learn/\${course.slug}\` : user ? \`/checkout/\${course.slug}\` : \`/auth?next=\${encodeURIComponent(\`/checkout/\${course.slug}\`)}\`;
`;
  const replacement = `${marker}
  const claimFreeCourse = async () => {
    if (!user || !course || owned || !routeReady || !freeTrial?.eligible || claimingTrial) return;
    setClaimingTrial(true);
    setError('');
    try {
      const result = await supabase.rpc('claim_free_course', { p_challenge_id: course.id });
      if (result.error) throw result.error;
      setEnrollment({ user_id: user.id, challenge_id: course.id, access_status: 'granted' });
      setFreeTrial({ eligible: false, claimed: true, challenge_id: course.id, slug: course.slug, title: course.title });
      navigate(\`/learn/\${course.slug}\`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Your free course could not be claimed.');
      const refreshed = await supabase.rpc('get_free_course_trial_status');
      if (!refreshed.error) setFreeTrial(refreshed.data as FreeCourseTrialStatus);
    } finally {
      setClaimingTrial(false);
    }
  };
`;
  main = replaceRequired(main, marker, replacement, 'the course detail destination');
}

if (!main.includes('FIRST COURSE FREE')) {
  const oldPrice = `<div className="course-price"><div><small>{owned ? 'YOUR ACCESS' : routeReady ? 'ONE-TIME PRICE' : 'ROUTE STATUS'}</small><strong>{owned ? 'Unlocked' : routeReady ? formatMoney(price.amount, price.currency) : 'Structuring now'}</strong><span>{owned ? 'Return whenever you need it.' : routeReady ? 'No subscription. Permanent access.' : 'The source course is selected. Payment stays disabled until the FINISH route, quizzes and project are complete.'}</span></div>{owned || routeReady ? <Link className="button button-acid button-large" to={destination}>{owned ? 'Continue learning' : 'Start this course'} <ArrowUpRight size={18} /></Link> : <span className="button button-acid button-large route-disabled" aria-disabled="true">Opening soon</span>}</div>`;
  const newPrice = `<div className="course-price"><div><small>{owned ? 'YOUR ACCESS' : routeReady && (!user || freeTrial?.eligible) ? 'FIRST COURSE FREE' : routeReady ? 'ONE-TIME PRICE' : 'ROUTE STATUS'}</small><strong>{owned ? 'Unlocked' : routeReady && (!user || freeTrial?.eligible) ? 'Free' : routeReady ? formatMoney(price.amount, price.currency) : 'Structuring now'}</strong><span>{owned ? 'Return whenever you need it.' : !routeReady ? 'The source course is selected. Payment stays disabled until the FINISH route, quizzes and project are complete.' : !user ? 'Create an account and choose any one FINISH course free. Additional courses are one-time purchases.' : freeTrial?.eligible ? 'This can be your one free course. You get the full route, quizzes, progress and flagship project.' : freeTrial?.claimed ? \`Your free course is already \${freeTrial.title || 'claimed'}. Additional courses are one-time purchases.\` : 'No subscription. Permanent access.'}</span></div>{owned ? <Link className="button button-acid button-large" to={destination}>Continue learning <ArrowUpRight size={18} /></Link> : !routeReady ? <span className="button button-acid button-large route-disabled" aria-disabled="true">Opening soon</span> : !user ? <Link className="button button-acid button-large" to={\`/auth?next=\${encodeURIComponent(\`/course/\${course.slug}\`)}\`}>Sign in to try free <ArrowUpRight size={18} /></Link> : freeTrial === null ? <button className="button button-acid button-large" disabled><LoaderCircle className="spin" />Checking free access</button> : freeTrial.eligible ? <button className="button button-acid button-large" disabled={claimingTrial} onClick={() => void claimFreeCourse()}>{claimingTrial ? <LoaderCircle className="spin" /> : <Sparkles size={18} />}{claimingTrial ? 'Claiming course…' : 'Claim this course free'}</button> : <Link className="button button-acid button-large" to={destination}>Start this course <ArrowUpRight size={18} /></Link>}</div>`;
  main = replaceRequired(main, oldPrice, newPrice, 'the course detail price and action panel');
}

fs.writeFileSync(mainFile, main);

let learn = fs.readFileSync(learnFile, 'utf8');
if (!learn.includes('setWatched((best) => Math.max(best, percent));')) {
  learn = replaceRequired(
    learn,
    `                const duration = player.current?.getDuration() || 0;
                const current = player.current?.getCurrentTime() || 0;
                setWatched(duration ? Math.min(100, Math.round((current / duration) * 100)) : 0);`,
    `                const duration = player.current?.getDuration() || 0;
                const current = player.current?.getCurrentTime() || 0;
                const percent = duration ? Math.min(100, Math.round((current / duration) * 100)) : 0;
                setWatched((best) => Math.max(best, percent));`,
    'the lesson watch-percent tracker',
  );
}
fs.writeFileSync(learnFile, learn);

let landing = fs.readFileSync(landingFile, 'utf8');
landing = landing.replace(
  '<div class="trust-row"><span>✓ No subscription trap</span><span>✓ Permanent course access</span><span>✓ Progress saved</span></div>',
  '<div class="trust-row"><span>✓ First course free</span><span>✓ No subscription trap</span><span>✓ Progress saved</span></div>',
);
landing = landing.replace(
  '<p>Each FINISH course is one focused learning product: an ordered route, two assessments, permanent access and a flagship outcome.</p>',
  '<p>Choose any one course free and experience the complete FINISH route. If it works for you, additional courses are simple one-time purchases.</p>',
);
fs.writeFileSync(landingFile, landing);

let catalog = fs.readFileSync(catalogFile, 'utf8');
catalog = catalog.replaceAll(
  'Structured learning routes built around strong free courses. Ordered lectures, two 20-question assessments and a required flagship project.',
  'Choose any one course free. Each route includes ordered lectures, two 20-question assessments and a required flagship project.',
);
fs.writeFileSync(catalogFile, catalog);

for (const [file, markers] of [
  [mainFile, ["supabase.rpc('claim_free_course'", 'FIRST COURSE FREE', 'Claim this course free']],
  [learnFile, ['setWatched((best) => Math.max(best, percent));']],
  [landingFile, ['✓ First course free', 'Choose any one course free']],
  [catalogFile, ['Choose any one course free.']],
]) {
  const source = fs.readFileSync(file, 'utf8');
  for (const marker of markers) {
    if (!source.includes(marker)) throw new Error(`Free-trial patch verification failed for ${path.relative(root, file)}: ${marker}`);
  }
}

console.log('FINISH one-free-course trial and monotonic watch progress applied.');
