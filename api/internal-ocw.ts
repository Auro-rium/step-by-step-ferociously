const SOURCES: Record<string, string> = {
  blockchain: 'https://ocw.mit.edu/courses/15-s12-blockchain-and-money-fall-2018/resources/lecture-videos/',
  fintech: 'https://ocw.mit.edu/courses/15-s08-fintech-shaping-the-financial-world-spring-2020/resources/lecture-videos/',
  mathfinance: 'https://ocw.mit.edu/courses/18-642-topics-in-mathematics-with-applications-in-finance-fall-2024/resources/lecture-videos/',
  publicfinance: 'https://ocw.mit.edu/courses/14-41-public-finance-and-public-policy-fall-2024/resources/lecture-videos/',
};

function clean(value: string) {
  return value.replace(/<[^>]*>/g, ' ').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim();
}

export default async function handler(request: any, response: any) {
  const key = String(request.query?.course || '').trim();
  const source = SOURCES[key];
  if (!source) return response.status(403).json({ error: 'course_not_allowed' });

  const headers = { 'User-Agent': 'Mozilla/5.0 (compatible; FINISHCourseIndexer/1.0)', 'Accept-Language': 'en-US,en;q=0.9' };
  const listingResponse = await fetch(source, { headers });
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
  const videos = await Promise.all(entries.map(async ([url, title]) => {
    try {
      const page = await fetch(url, { headers });
      if (!page.ok) return { title, url, id: null };
      const body = await page.text();
      const id = body.match(/youtube\.com\/embed\/([A-Za-z0-9_-]{11})/)?.[1]
        || body.match(/youtube-nocookie\.com\/embed\/([A-Za-z0-9_-]{11})/)?.[1]
        || null;
      return { title, url, id };
    } catch {
      return { title, url, id: null };
    }
  }));

  response.setHeader('Cache-Control', 'no-store');
  return response.status(200).json({ course: key, source, count: videos.length, withVideo: videos.filter((item) => item.id).length, videos });
}
