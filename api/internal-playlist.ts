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

function collectVideos(node: unknown, found: Map<string, { id: string; title: string; duration: string | null }>) {
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

export default async function handler(request: any, response: any) {
  const list = String(request.query?.list || '').trim();
  if (!ALLOWED.has(list)) return response.status(403).json({ error: 'playlist_not_allowed' });

  const upstream = await fetch(`https://www.youtube.com/playlist?list=${encodeURIComponent(list)}&hl=en`, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; FINISHCourseIndexer/1.0)' },
  });
  if (!upstream.ok) return response.status(502).json({ error: 'youtube_fetch_failed', status: upstream.status });
  const html = await upstream.text();
  const match = html.match(/var ytInitialData = (\{.*?\});<\/script>/s)
    || html.match(/ytInitialData"\s*:\s*(\{.*?\})\s*,\s*"ytInitialPlayerResponse/s);
  if (!match) return response.status(502).json({ error: 'youtube_data_missing' });

  let data: unknown;
  try { data = JSON.parse(match[1]); }
  catch { return response.status(502).json({ error: 'youtube_data_invalid' }); }

  const found = new Map<string, { id: string; title: string; duration: string | null }>();
  collectVideos(data, found);
  response.setHeader('Cache-Control', 'no-store');
  return response.status(200).json({ playlistId: list, count: found.size, videos: [...found.values()] });
}
