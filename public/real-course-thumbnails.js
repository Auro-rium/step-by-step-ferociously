(() => {
  const SUPABASE_URL = 'https://ijkdhrznxukawugeoocs.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable_kwSezylj6T63a7nIMtuxcg_0bQWm6-8';
  const THUMBNAIL_HOST = 'https://i.ytimg.com/vi';
  const byTitle = new Map();
  const bySlug = new Map();
  let ready = false;

  const normalize = (value) => String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();

  function firstVideo(course) {
    return [...(course.challenge_steps || [])]
      .filter((step) => step && step.youtube_video_id)
      .sort((a, b) => Number(a.position || 0) - Number(b.position || 0))[0]?.youtube_video_id || null;
  }

  function setThumbnail(image, videoId) {
    if (!image || !videoId || image.dataset.realCourseThumbnail === videoId) return;
    image.dataset.realCourseThumbnail = videoId;
    image.alt = '';
    image.decoding = 'async';
    image.loading = 'lazy';
    image.referrerPolicy = 'no-referrer';
    image.style.opacity = '1';
    image.style.objectFit = 'cover';
    image.style.filter = 'saturate(.9) contrast(1.06)';
    image.src = `${THUMBNAIL_HOST}/${videoId}/maxresdefault.jpg`;
    image.onerror = () => {
      const fallback = `${THUMBNAIL_HOST}/${videoId}/hqdefault.jpg`;
      if (image.src !== fallback) image.src = fallback;
      else image.onerror = null;
    };
  }

  function resolveVideoId(container) {
    const pathname = window.location.pathname;
    const slugMatch = pathname.match(/^\/course\/([^/?#]+)/);
    if (slugMatch) {
      const slug = decodeURIComponent(slugMatch[1]);
      if (bySlug.has(slug)) return bySlug.get(slug);
    }

    const card = container.closest('.course-card, .dashboard-course, .course-hero, article, section');
    const titleNode = card?.querySelector('h1, h2, h3') || document.querySelector('.course-hero-copy h1');
    return byTitle.get(normalize(titleNode?.textContent)) || null;
  }

  function apply() {
    if (!ready) return;
    document.querySelectorAll('.course-artwork').forEach((artwork) => {
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

  async function load() {
    try {
      const query = new URLSearchParams({
        select: 'slug,title,challenge_steps(youtube_video_id,position)',
        status: 'eq.published',
      });
      const response = await fetch(`${SUPABASE_URL}/rest/v1/challenges?${query}`, {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
      });
      if (!response.ok) throw new Error(`Course artwork request failed: ${response.status}`);
      const courses = await response.json();
      for (const course of courses) {
        const videoId = firstVideo(course);
        if (!videoId) continue;
        bySlug.set(course.slug, videoId);
        byTitle.set(normalize(course.title), videoId);
      }
      ready = true;
      apply();
    } catch (error) {
      console.warn('[FINISH] Real course thumbnails could not load.', error);
    }
  }

  const observer = new MutationObserver(() => apply());
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener('popstate', () => queueMicrotask(apply));
  document.addEventListener('DOMContentLoaded', load, { once: true });
})();
