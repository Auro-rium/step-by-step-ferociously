import { useEffect, useMemo, useState, type FormEvent } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Check, CircleDollarSign, ExternalLink, LoaderCircle, LockKeyhole, RefreshCw, Sparkles, WandSparkles, Youtube } from 'lucide-react';
import './CustomRoute.css';

type CustomCourse = {
  id: string;
  slug: string;
  title: string;
  description?: string | null;
  outcome?: string | null;
  lesson_count?: number | null;
  difficulty?: string | null;
  status?: string | null;
  route_ready?: boolean | null;
};

type CustomRequest = {
  id: string;
  challenge_id?: string | null;
  source_url: string;
  playlist_id: string;
  source_title?: string | null;
  source_channel?: string | null;
  status: 'generating' | 'ready' | 'failed';
  model?: string | null;
  video_count?: number | null;
  error?: string | null;
  created_at: string;
  generated_at?: string | null;
  challenges?: CustomCourse | CustomCourse[] | null;
};

type GeneratedRoute = {
  request_id: string;
  challenge_id: string;
  slug: string;
  title: string;
  description?: string;
  outcome?: string;
  difficulty?: string;
  lesson_count: number;
  price_usd: number;
  source_title?: string;
  source_channel?: string;
  model?: string;
};

type AccessMap = Map<string, string>;

function routeCourse(request: CustomRequest): CustomCourse | null {
  if (Array.isArray(request.challenges)) return request.challenges[0] ?? null;
  return request.challenges ?? null;
}

function formatDate(value: string) {
  try { return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)); }
  catch { return value; }
}

export function CustomRouteBuilder({ client, userId, supabaseUrl, supabaseKey }: { client: SupabaseClient; userId: string; supabaseUrl: string; supabaseKey: string }) {
  const [requests, setRequests] = useState<CustomRequest[]>([]);
  const [access, setAccess] = useState<AccessMap>(new Map());
  const [playlistUrl, setPlaylistUrl] = useState('');
  const [generated, setGenerated] = useState<GeneratedRoute | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const result = await client
        .from('custom_route_requests')
        .select('id, challenge_id, source_url, playlist_id, source_title, source_channel, status, model, video_count, error, created_at, generated_at, challenges(id, slug, title, description, outcome, lesson_count, difficulty, status, route_ready)')
        .order('created_at', { ascending: false })
        .limit(12);
      if (result.error) throw result.error;
      const rows = (result.data ?? []) as unknown as CustomRequest[];
      setRequests(rows);

      const ids = rows.map((row) => row.challenge_id).filter((id): id is string => Boolean(id));
      if (!ids.length) { setAccess(new Map()); return; }
      const enrollmentResult = await client
        .from('enrollments')
        .select('challenge_id, access_status')
        .eq('user_id', userId)
        .in('challenge_id', ids);
      if (enrollmentResult.error) throw enrollmentResult.error;
      setAccess(new Map((enrollmentResult.data ?? []).map((row: { challenge_id: string; access_status: string }) => [row.challenge_id, row.access_status])));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Your custom routes could not load.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [userId]);

  const readyCount = useMemo(() => requests.filter((request) => request.status === 'ready').length, [requests]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const raw = playlistUrl.trim();
    if (!raw) return;
    setBusy(true);
    setError('');
    setGenerated(null);

    try {
      const session = await client.auth.getSession();
      const token = session.data.session?.access_token;
      if (!token) throw new Error('Your session expired. Sign in again and retry.');

      const response = await fetch(`${supabaseUrl}/functions/v1/custom-route-generate`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: supabaseKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ playlist_url: raw }),
      });
      const payload = await response.json().catch(() => ({})) as GeneratedRoute & { error?: string };
      if (!response.ok || payload.error) throw new Error(payload.error || 'FINISH could not build this route.');

      setGenerated(payload);
      setPlaylistUrl('');
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'FINISH could not build this route.');
    } finally {
      setBusy(false);
    }
  };

  return <main className="app-page shell custom-route-page">
    <section className="custom-route-hero">
      <div className="custom-route-copy">
        <div className="custom-route-kicker"><WandSparkles size={17} /><span>BRING YOUR OWN PLAYLIST</span></div>
        <h1>Turn a saved YouTube playlist into something you actually finish.</h1>
        <p>Paste a playlist. FINISH keeps the original video order, then AI builds the route around it: lesson prompts, two 20-question mastery checks, progress tracking and a flagship project.</p>
        <div className="custom-route-points">
          <span><Check size={15} />Private to your account</span>
          <span><Check size={15} />Generated before you pay</span>
          <span><Check size={15} />$1 one-time unlock</span>
        </div>
      </div>
      <aside className="custom-route-price-card">
        <small>CUSTOM FINISH ROUTE</small>
        <strong>$1</strong>
        <span>one-time unlock after generation</span>
        <p>No subscription. Your generated route remains attached to your FINISH account.</p>
      </aside>
    </section>

    <section className="custom-builder panel">
      <div className="custom-builder-heading">
        <div><p className="eyebrow">YOUTUBE PLAYLIST</p><h2>Paste the thing sitting in your bookmarks.</h2></div>
        <Youtube size={30} />
      </div>
      <form onSubmit={submit} className="custom-route-form">
        <label htmlFor="playlist-url">PLAYLIST URL</label>
        <div className="custom-route-input-row">
          <input id="playlist-url" type="url" value={playlistUrl} onChange={(event) => setPlaylistUrl(event.target.value)} placeholder="https://www.youtube.com/playlist?list=..." required disabled={busy} />
          <button className="button button-acid button-large" disabled={busy || !playlistUrl.trim()}>
            {busy ? <LoaderCircle className="spin" /> : <Sparkles size={18} />}{busy ? 'Building your route…' : 'Build my FINISH route'}
          </button>
        </div>
      </form>
      <div className="custom-route-process" aria-live="polite">
        {busy ? <><LoaderCircle className="spin" /><div><strong>Reading the playlist and generating the structure.</strong><span>FINISH is producing 40 assessment questions plus the final project. Free-model inference can take around a minute, because apparently even robots have queues.</span></div></> : <><LockKeyhole /><div><strong>The source videos stay on YouTube.</strong><span>FINISH reads the playlist order and titles. AI creates the learning structure around that metadata; it does not pretend to transcribe or quote videos it has not read.</span></div></>}
      </div>
      {error && <div className="form-message error" role="alert">{error}</div>}
    </section>

    {generated && <section className="custom-generated panel">
      <div className="custom-generated-mark"><Sparkles /></div>
      <div className="custom-generated-copy">
        <p className="eyebrow">ROUTE READY</p><h2>{generated.title}</h2><p>{generated.description}</p>
        <div className="custom-generated-meta"><span>{generated.lesson_count} lessons</span><span>40 quiz questions</span><span>{generated.difficulty || 'Intermediate'}</span><span>1 flagship project</span></div>
        {generated.outcome && <blockquote>{generated.outcome}</blockquote>}
      </div>
      <div className="custom-generated-action"><small>UNLOCK THIS PRIVATE ROUTE</small><strong>$1.00</strong><Link className="button button-primary button-large" to={`/checkout/${generated.slug}`}><CircleDollarSign size={18} />Unlock route <ArrowUpRight size={17} /></Link></div>
    </section>}

    <section className="custom-route-history">
      <div className="section-row"><div><p className="eyebrow">MY CUSTOM ROUTES</p><h2>{readyCount ? `${readyCount} route${readyCount === 1 ? '' : 's'} generated.` : 'Nothing generated yet.'}</h2></div><button className="button button-soft" onClick={() => void load()} disabled={loading}><RefreshCw size={16} className={loading ? 'spin' : ''} />Refresh</button></div>

      {loading ? <div className="custom-history-loading"><LoaderCircle className="spin" />Loading custom routes</div> : requests.length ? <div className="custom-route-list">
        {requests.map((request) => {
          const course = routeCourse(request);
          const status = request.challenge_id ? access.get(request.challenge_id) : null;
          const unlocked = status === 'paid' || status === 'granted';
          return <article className={`custom-route-row ${request.status}`} key={request.id}>
            <div className="custom-route-source"><Youtube size={20} /><div><strong>{request.source_title || 'YouTube playlist'}</strong><span>{request.source_channel || request.playlist_id}</span></div></div>
            <div className="custom-route-status"><span className={`custom-status-pill ${request.status}`}>{request.status}</span><small>{request.video_count ? `${request.video_count} lessons · ` : ''}{formatDate(request.created_at)}</small>{request.status === 'failed' && request.error && <p>{request.error}</p>}</div>
            <div className="custom-route-row-actions">
              <a className="icon-button" href={request.source_url} target="_blank" rel="noreferrer" aria-label="Open source playlist"><ExternalLink size={17} /></a>
              {request.status === 'generating' && <span className="button button-soft route-disabled"><LoaderCircle className="spin" />Generating</span>}
              {request.status === 'ready' && course && (unlocked ? <Link className="button button-acid" to={`/learn/${course.slug}`}>Open route <ArrowUpRight size={15} /></Link> : <Link className="button button-primary" to={`/checkout/${course.slug}`}>Unlock $1 <ArrowUpRight size={15} /></Link>)}
            </div>
          </article>;
        })}
      </div> : <div className="empty-state panel"><p className="eyebrow">BOOKMARK GRAVEYARD, CURRENTLY EMPTY</p><h2>Your first playlist goes here.</h2><p>Paste one above. FINISH will turn it into a private learning route before asking you to unlock it.</p></div>}
    </section>
  </main>;
}
