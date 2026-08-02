(() => {
  const SUPABASE_URL = 'https://ijkdhrznxukawugeoocs.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable_kwSezylj6T63a7nIMtuxcg_0bQWm6-8';
  const THUMBNAIL_HOST = 'https://i.ytimg.com/vi';
  const CACHE_KEY = 'finish:course-thumbnails:v2';
  const CACHE_TTL = 12 * 60 * 60 * 1000;
  const byTitle = new Map();
  const bySlug = new Map();
  let ready = false;
  let loadPromise = null;
  let observer = null;
  let frame = 0;

  const normalize = (value) => String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();
  const relevantRoute = () => {
    const path = window.location.pathname;
    return path === '/catalog' || path === '/app' || path.startsWith('/course/') || path.startsWith('/checkout/');
  };

  function hydrate(rows) {
    byTitle.clear();
    bySlug.clear();
    for (const course of Array.isArray(rows) ? rows : []) {
      if (!course?.video_id) continue;
      bySlug.set(String(course.slug || ''), String(course.video_id));
      byTitle.set(normalize(course.title), String(course.video_id));
    }
    ready = bySlug.size > 0;
  }

  function readCache() {
    try {
      const cached = JSON.parse(sessionStorage.getItem(CACHE_KEY) || 'null');
      if (!cached || Date.now() - Number(cached.savedAt || 0) > CACHE_TTL) return false;
      hydrate(cached.rows);
      return ready;
    } catch {
      return false;
    }
  }

  function writeCache(rows) {
    try { sessionStorage.setItem(CACHE_KEY, JSON.stringify({ savedAt: Date.now(), rows })); }
    catch { /* Storage is optional. */ }
  }

  function setThumbnail(image, videoId) {
    if (!(image instanceof HTMLImageElement) || !videoId || image.dataset.realCourseThumbnail === videoId) return;
    const critical = Boolean(image.closest('.course-hero'));
    image.dataset.realCourseThumbnail = videoId;
    image.alt = '';
    image.decoding = 'async';
    image.loading = critical ? 'eager' : 'lazy';
    image.fetchPriority = critical ? 'high' : 'low';
    image.referrerPolicy = 'no-referrer';
    image.style.opacity = '1';
    image.style.objectFit = 'cover';
    image.style.filter = 'saturate(.9) contrast(1.06)';
    image.src = `${THUMBNAIL_HOST}/${videoId}/hqdefault.jpg`;
    image.onerror = () => {
      const fallback = `${THUMBNAIL_HOST}/${videoId}/mqdefault.jpg`;
      if (image.src !== fallback) image.src = fallback;
      else image.onerror = null;
    };
  }

  function resolveVideoId(container) {
    const slugMatch = window.location.pathname.match(/^\/course\/([^/?#]+)/);
    if (slugMatch) {
      const slug = decodeURIComponent(slugMatch[1]);
      if (bySlug.has(slug)) return bySlug.get(slug);
    }

    const card = container.closest('.course-card, .owned-card, .dashboard-course, .course-hero, article, section');
    const titleNode = card?.querySelector('h1, h2, h3') || document.querySelector('.course-hero-copy h1');
    return byTitle.get(normalize(titleNode?.textContent)) || null;
  }

  function apply() {
    frame = 0;
    if (!ready || !relevantRoute()) return;
    document.querySelectorAll('.course-artwork:not(.real-source-thumbnail)').forEach((artwork) => {
      const videoId = resolveVideoId(artwork);
      if (!videoId) return;
      let image = artwork.querySelector('img');
      if (!image) {
        image = document.createElement('img');
        artwork.prepend(image);
      }
      setThumbnail(image, videoId);
      artwork.classList.add('real-source-thumbnail');
    });
  }

  function scheduleApply() {
    if (frame) return;
    frame = requestAnimationFrame(apply);
  }

  async function load() {
    if (ready) return;
    if (readCache()) return;
    if (loadPromise) return loadPromise;

    loadPromise = fetch(`${SUPABASE_URL}/rest/v1/rpc/get_public_course_thumbnails`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      body: '{}',
    })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Course artwork request failed: ${response.status}`);
        return response.json();
      })
      .then((rows) => {
        hydrate(rows);
        writeCache(rows);
      })
      .catch((error) => console.warn('[FINISH] Real course thumbnails could not load.', error))
      .finally(() => { loadPromise = null; });

    return loadPromise;
  }

  function stopWatching() {
    observer?.disconnect();
    observer = null;
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
  }

  async function activate() {
    stopWatching();
    if (!relevantRoute()) return;
    await load();
    scheduleApply();

    const root = document.getElementById('root');
    if (!root) return;
    observer = new MutationObserver((mutations) => {
      if (mutations.some((mutation) => mutation.addedNodes.length > 0 || mutation.removedNodes.length > 0)) scheduleApply();
    });
    observer.observe(root, { childList: true, subtree: true });
  }

  window.addEventListener('finish-route-change', activate);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', activate, { once: true });
  else activate();
})();
