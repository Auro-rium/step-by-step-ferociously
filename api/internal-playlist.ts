const ALLOWED = new Set([
  'PLUl4u3cNGP63B2lDhyKOsImI7FjCf6eDW',
  'PLUkh9m2Borqn549nqiEOyFRIvqs4_P3d0',
  'PLUkh9m2BorqlOjmzA9_LYgnzgt0N-2hGS',
  'PLUkh9m2BorqkgpNyRpP-NL3BS4yvFabXk',
  'PLUkh9m2BorqnapcQ03A0a_jsbele2kKbp',
  'PLUkh9m2BorqmtIQKZ1jv3uuZDM_bQIICg',
  'PLUkh9m2BorqmKaLrNBjKtFDhpdFdi8f7C',
  'PLUkh9m2BorqnDenjSLZ2DHIXrdxoN4Bn_',
  'PLUkh9m2BorqndWimijiJ-VCAXjJUrzJQU',
  'PLUkh9m2BorqlDJlnBXUaJaMRNE7UDckn6',
  'PLUkh9m2BorqmXcRzWFbzcjMd7fYErVexF',
  'PLUkh9m2BorqlpbJBd26UEawPHk0k9y04_',
  'PLUkh9m2Borql51x9Lj8S-bHUq3V6kuix-',
  'PLUkh9m2BorqnKWu0g5ZUps_CbQ-JGtbI9',
  'PLEDC55106E0BA18FC',
  'PL8FB14A2200B87185',
]);

type Video = { id: string; title: string; duration: string | null };

function collectVideos(node: unknown, found: Map<string, Video>) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    for (const item of node) collectVideos(item, found);
    return;
  }
  const value = node as Record<string, any>;
  const renderer = value.playlistVideoRenderer;
  if (renderer?.videoId && renderer?.title?.runs?.[0]?.text) {
    found.set(renderer.videoId, {
      id: renderer.videoId,
      title: renderer.title.runs.map((run: any) => run.text || '').join('').trim(),
      duration: renderer.lengthText?.simpleText || null,
    });
  }
  for (const child of Object.values(value)) collectVideos(child, found);
}

function parseJsonObjectAfter(html: string, marker: string): any | null {
  const markerIndex = html.indexOf(marker);
  if (markerIndex < 0) return null;
  const start = html.indexOf('{', markerIndex + marker.length);
  if (start < 0) return null;
  let depth = 0;
  let quoted = false;
  let escaped = false;
  for (let i = start; i < html.length; i += 1) {
    const char = html[i];
    if (quoted) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') quoted = false;
      continue;
    }
    if (char === '"') quoted = true;
    else if (char === '{') depth += 1;
    else if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        try { return JSON.parse(html.slice(start, i + 1)); }
        catch { return null; }
      }
    }
  }
  return null;
}

export default async function handler(request: any, response: any) {
  const list = String(request.query?.list || '').trim();
  if (!ALLOWED.has(list)) return response.status(403).json({ error: 'playlist_not_allowed' });

  const headers = {
    'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/126 Safari/537.36',
    'Accept-Language': 'en-US,en;q=0.9',
  };
  const page = await fetch(`https://www.youtube.com/playlist?list=${encodeURIComponent(list)}&hl=en&gl=US`, { headers });
  if (!page.ok) return response.status(502).json({ error: 'youtube_fetch_failed', status: page.status });
  const html = await page.text();

  const key = html.match(/"INNERTUBE_API_KEY":"([^"]+)"/)?.[1];
  const context = parseJsonObjectAfter(html, '"INNERTUBE_CONTEXT":');
  if (!key || !context) return response.status(502).json({ error: 'youtube_config_missing', hasKey: Boolean(key), hasContext: Boolean(context) });

  const browse = await fetch(`https://www.youtube.com/youtubei/v1/browse?key=${encodeURIComponent(key)}&prettyPrint=false`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json', Origin: 'https://www.youtube.com' },
    body: JSON.stringify({ context, browseId: `VL${list}` }),
  });
  if (!browse.ok) return response.status(502).json({ error: 'youtube_browse_failed', status: browse.status, detail: (await browse.text()).slice(0, 500) });
  const data = await browse.json();
  const found = new Map<string, Video>();
  collectVideos(data, found);

  response.setHeader('Cache-Control', 'no-store');
  return response.status(200).json({ playlistId: list, count: found.size, videos: [...found.values()] });
}
