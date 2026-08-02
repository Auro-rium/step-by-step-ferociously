const SOURCES: Record<string, string> = {
  blockchain: 'https://ocw.mit.edu/courses/15-s12-blockchain-and-money-fall-2018/resources/lecture-videos/',
  fintech: 'https://ocw.mit.edu/courses/15-s08-fintech-shaping-the-financial-world-spring-2020/resources/lecture-videos/',
  mathfinance: 'https://ocw.mit.edu/courses/18-642-topics-in-mathematics-with-applications-in-finance-fall-2024/resources/lecture-videos/',
  publicfinance: 'https://ocw.mit.edu/courses/14-41-public-finance-and-public-policy-fall-2024/resources/lecture-videos/',
};

async function fetchWithTimeout(url: string, init: RequestInit = {}, timeoutMs = 6500) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function clean(value: string) {
  return value.replace(/<[^>]*>/g, ' ').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim();
}

async function mapWithConcurrency<T, R>(items: T[], limit: number, worker: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index]);
    }
  });
  await Promise.all(runners);
  return results;
}

export default async function handler(request: any, response: any) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return response.status(405).json({ error: 'method_not_allowed' });
  }

  const requestUrl = new URL(String(request.url || '/'), 'https://finish.local');
  const key = String(requestUrl.searchParams.get('course') || '').trim();
  const source = SOURCES[key];
  if (!source) return response.status(403).json({ error: 'course_not_allowed' });

  const headers = { 'User-Agent': 'Mozilla/5.0 (compatible; FINISHCourseIndexer/1.0)', 'Accept-Language': 'en-US,en;q=0.9' };
  let listingResponse: Response;
  try {
    listingResponse = await fetchWithTimeout(source, { headers }, 7000);
  } catch {
    return response.status(504).json({ error: 'listing_fetch_timeout' });
  }
  if (!listingResponse.ok) return response.status(502).json({ error: 'listing_fetch_failed', status: listingResponse.status });

  const html = await listingResponse.text();
  const base = new URL(source);
  const links = new Map<string, string>();
  const pattern = /<a[^>]+href="([^"]+\/resources\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  for (const match of html.matchAll(pattern)) {
    const href = new URL(match[1], base).toString();
    const title = clean(match[2]);
    if (!title || !/(session|class|lecture)/i.test(title) || /video\s+\d+\s*mb/i.test(title)) continue;
    if (!links.has(href)) links.set(href, title);
  }

  const entries = [...links.entries()].slice(0, 40);
  const videos = await mapWithConcurrency(entries, 8, async ([url, title]) => {
    try {
      const page = await fetchWithTimeout(url, { headers }, 5500);
      if (!page.ok) return { title, url, id: null };
      const body = await page.text();
      const id = body.match(/youtube\.com\/embed\/([A-Za-z0-9_-]{11})/)?.[1]
        || body.match(/youtube-nocookie\.com\/embed\/([A-Za-z0-9_-]{11})/)?.[1]
        || null;
      return { title, url, id };
    } catch {
      return { title, url, id: null };
    }
  });

  response.setHeader('Cache-Control', 'public, max-age=300, s-maxage=21600, stale-while-revalidate=86400');
  return response.status(200).json({ course: key, source, count: videos.length, withVideo: videos.filter((item) => item.id).length, videos });
}
