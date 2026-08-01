import { useEffect, useMemo, useState, type FormEvent } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { Check, CheckCircle2, ExternalLink, FileCheck2, Github, Globe2, LoaderCircle, LockKeyhole, RefreshCw, ShieldCheck, Trophy } from 'lucide-react';
import './course-product.css';

export interface RegionalOffer {
  country: string;
  countryName: string;
  provider: 'stripe' | 'razorpay';
  currency: 'USD' | 'INR';
  market: 'india' | 'international';
}

export interface RegionalPrice {
  provider: string;
  currency: string;
  amount: number;
  active?: boolean;
}

export interface CourseStep {
  id: string;
  challenge_id: string;
  position: number;
  title: string;
  description?: string | null;
  duration_minutes: number;
  youtube_video_id?: string | null;
  task_prompt?: string | null;
  xp_reward: number;
}

export interface CourseProject {
  id: string;
  challenge_id: string;
  title: string;
  brief: string;
  requirements: string[];
  deliverables: string[];
  submission_instructions: string;
  xp_reward: number;
}

export interface ProjectSubmission {
  id: string;
  project_id: string;
  challenge_id: string;
  user_id: string;
  repo_url: string;
  live_url?: string | null;
  notes: string;
  status: 'submitted' | 'in_review' | 'approved' | 'changes_requested';
  feedback?: string | null;
  submitted_at: string;
  reviewed_at?: string | null;
  course_projects?: { title?: string } | null;
  challenges?: { title?: string } | null;
}

const fallbackRegion: RegionalOffer = {
  country: 'ZZ',
  countryName: 'International',
  provider: 'stripe',
  currency: 'USD',
  market: 'international',
};

let cachedRegion: RegionalOffer | null = null;
let regionRequest: Promise<RegionalOffer> | null = null;

async function loadRegion(): Promise<RegionalOffer> {
  if (cachedRegion) return cachedRegion;
  if (!regionRequest) {
    regionRequest = fetch('/api/region', { headers: { Accept: 'application/json' } })
      .then(async (response) => {
        if (!response.ok) throw new Error('Region lookup failed.');
        return response.json() as Promise<RegionalOffer>;
      })
      .then((region) => {
        cachedRegion = region;
        return region;
      })
      .catch(() => fallbackRegion);
  }
  return regionRequest;
}

export function useRegion() {
  const [region, setRegion] = useState<RegionalOffer>(cachedRegion || fallbackRegion);
  useEffect(() => {
    let active = true;
    void loadRegion().then((next) => active && setRegion(next));
    return () => { active = false; };
  }, []);
  return region;
}

export function regionalPrice(prices: RegionalPrice[], region: RegionalOffer) {
  return prices.find((price) => price.active !== false && price.provider === region.provider && price.currency === region.currency)
    || prices.find((price) => price.active !== false && price.currency === region.currency)
    || prices.find((price) => price.active !== false)
    || { amount: region.market === 'india' ? 159 : 2, currency: region.currency, provider: region.provider };
}

function statusCopy(status: ProjectSubmission['status']) {
  if (status === 'approved') return 'Approved. You finished the course.';
  if (status === 'changes_requested') return 'Changes requested. Revise the work and resubmit.';
  if (status === 'in_review') return 'Your project is being reviewed.';
  return 'Submitted for review.';
}

export function FinalProjectPanel({
  supabase,
  project,
  submission,
  unlocked,
  onSubmitted,
}: {
  supabase: SupabaseClient;
  project: CourseProject | null;
  submission: ProjectSubmission | null;
  unlocked: boolean;
  onSubmitted: (submission: ProjectSubmission) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  if (!project) return null;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!unlocked) return;
    setBusy(true); setError(''); setSuccess('');
    const form = new FormData(event.currentTarget);
    const result = await supabase.rpc('submit_course_project', {
      p_project_id: project.id,
      p_repo_url: String(form.get('repo') || ''),
      p_live_url: String(form.get('live') || ''),
      p_notes: String(form.get('notes') || ''),
    });
    setBusy(false);
    if (result.error) { setError(result.error.message); return; }
    const next: ProjectSubmission = {
      id: String(result.data?.submission_id || submission?.id || ''),
      project_id: project.id,
      challenge_id: project.challenge_id,
      user_id: submission?.user_id || '',
      repo_url: String(form.get('repo') || ''),
      live_url: String(form.get('live') || '') || null,
      notes: String(form.get('notes') || ''),
      status: 'submitted',
      submitted_at: String(result.data?.submitted_at || new Date().toISOString()),
    };
    onSubmitted(next);
    setSuccess('Project submitted. The admin review queue now has something more useful than another payment row.');
  };

  return <section className={`final-project panel ${unlocked ? 'unlocked' : 'locked'}`}>
    <div className="project-heading">
      <div className="project-mark">{unlocked ? <FileCheck2 /> : <LockKeyhole />}</div>
      <div><p className="eyebrow">FINAL BUILD · {project.xp_reward} XP</p><h2>{project.title}</h2><p>{project.brief}</p></div>
    </div>
    {!unlocked && <div className="project-lock"><LockKeyhole /><span>Complete every lesson and pass every checkpoint to unlock submission.</span></div>}
    <div className="project-columns">
      <div><h3>Build requirements</h3><ul>{project.requirements.map((item) => <li key={item}><Check />{item}</li>)}</ul></div>
      <div><h3>Deliverables</h3><ul>{project.deliverables.map((item) => <li key={item}><Check />{item}</li>)}</ul></div>
    </div>
    <div className="project-instructions"><ShieldCheck /><p>{project.submission_instructions}</p></div>
    {submission && <div className={`submission-status ${submission.status}`}><CheckCircle2 /><div><strong>{statusCopy(submission.status)}</strong>{submission.feedback && <p>{submission.feedback}</p>}<div className="submission-links"><a href={submission.repo_url} target="_blank" rel="noreferrer"><Github />Repository</a>{submission.live_url && <a href={submission.live_url} target="_blank" rel="noreferrer"><Globe2 />Live build</a>}</div></div></div>}
    {error && <div className="form-message error">{error}</div>}
    {success && <div className="form-message success">{success}</div>}
    {submission?.status !== 'approved' && <form className="project-form form" onSubmit={submit}>
      <label>REPOSITORY URL<input name="repo" type="url" defaultValue={submission?.repo_url || ''} placeholder="https://github.com/you/project" required disabled={!unlocked} /></label>
      <label>LIVE URL · OPTIONAL<input name="live" type="url" defaultValue={submission?.live_url || ''} placeholder="https://your-project.example" disabled={!unlocked} /></label>
      <label>ENGINEERING REFLECTION<textarea name="notes" minLength={80} defaultValue={submission?.notes || ''} placeholder="Explain the trade-offs, evidence, failure modes and what you would improve." required disabled={!unlocked} /></label>
      <button className="button button-acid button-large" disabled={!unlocked || busy}>{busy ? <LoaderCircle className="spin" /> : submission ? <RefreshCw /> : <Trophy />}{submission ? 'Resubmit final project' : 'Submit final project'}</button>
    </form>}
  </section>;
}

export function AdminProjectReviews({ supabase }: { supabase: SupabaseClient }) {
  const [rows, setRows] = useState<ProjectSubmission[]>([]);
  const [feedback, setFeedback] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true); setError('');
    const result = await supabase.from('course_project_submissions')
      .select('*, course_projects(title), challenges(title)')
      .order('submitted_at', { ascending: false });
    setLoading(false);
    if (result.error) { setError(result.error.message); return; }
    setRows((result.data || []) as ProjectSubmission[]);
  };

  useEffect(() => { void load(); }, []);
  const pending = useMemo(() => rows.filter((row) => row.status !== 'approved').length, [rows]);

  const review = async (id: string, status: 'approved' | 'changes_requested' | 'in_review') => {
    const note = (feedback[id] || '').trim();
    if (note.length < 10) { setError('Write useful feedback before reviewing a submission.'); return; }
    setBusy(id); setError('');
    const result = await supabase.rpc('admin_review_course_project', { p_submission_id: id, p_status: status, p_feedback: note });
    setBusy('');
    if (result.error) { setError(result.error.message); return; }
    await load();
  };

  if (loading) return <div className="project-review-loader"><LoaderCircle className="spin" />Loading project submissions</div>;
  return <section className="panel project-reviews">
    <div className="review-header"><div><p className="eyebrow">FINAL PROJECT REVIEW</p><h2>{pending} submission{pending === 1 ? '' : 's'} need attention.</h2></div><button className="button button-soft" onClick={() => void load()}><RefreshCw />Refresh</button></div>
    {error && <div className="form-message error">{error}</div>}
    {!rows.length ? <p className="review-empty">No projects submitted yet.</p> : <div className="review-stack">{rows.map((row) => <article key={row.id} className="review-card">
      <div className="review-card-head"><div><p className="eyebrow">{row.status.replace('_',' ')}</p><h3>{row.challenges?.title || row.course_projects?.title || 'Course project'}</h3><span>User {row.user_id.slice(0,8)} · {new Date(row.submitted_at).toLocaleString()}</span></div><span className={`order-status ${row.status}`}>{row.status.replace('_',' ')}</span></div>
      <p className="review-notes">{row.notes}</p>
      <div className="submission-links"><a href={row.repo_url} target="_blank" rel="noreferrer"><Github />Open repository <ExternalLink /></a>{row.live_url && <a href={row.live_url} target="_blank" rel="noreferrer"><Globe2 />Open live build <ExternalLink /></a>}</div>
      <label>REVIEW FEEDBACK<textarea value={feedback[row.id] ?? row.feedback ?? ''} onChange={(event) => setFeedback((current) => ({ ...current, [row.id]: event.target.value }))} placeholder="State what passed, what needs revision, and why." /></label>
      <div className="review-actions"><button className="button button-soft" disabled={busy === row.id} onClick={() => void review(row.id,'changes_requested')}>Request changes</button><button className="button button-primary" disabled={busy === row.id} onClick={() => void review(row.id,'approved')}>{busy === row.id ? <LoaderCircle className="spin" /> : <CheckCircle2 />}Approve + award XP</button></div>
    </article>)}</div>}
  </section>;
}
