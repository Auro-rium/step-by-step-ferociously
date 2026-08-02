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

function secondsToText(value: unknown) {
  const total = Number(value);
  if (!Number.isFinite(total) || total <= 0) return null;
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = Math.floor(total % 60);
  return hours ? `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}` : `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function videoIdFromUrl(value: unknown) {
  const text = String(value || '');
  return text.match(/(?:watch\?v=|youtu\.be\/|\/watch\/)([A-Za-z0-9_-]{11})/)?.[1] || null;
}

function textValue(node: any): string {
  if (!node) return '';
  if (typeof node === 'string') return node.trim();
  if (Array.isArray(node)) return node.map(textValue).filter(Boolean).join(' ').trim();
  if (typeof node !== 'object') return '';
  if (typeof node.simpleText === 'string') return node.simpleText.trim();
  if (typeof node.content === 'string') return node.content.trim();
  if (typeof node.text === 'string') return node.text.trim();
  if (Array.isArray(node.runs)) return node.runs.map((run: any) => run?.text || '').join('').trim();
  return '';
}

function candidateTitle(value: Record<string, any>) {
  const candidates = [
    value.title,
    value.headline,
    value.metadata?.lockupMetadataViewModel?.title,
    value.metadata?.lockupMetadataViewModel?.metadata?.contentMetadataViewModel?.metadataRows?.[0]?.metadataParts?.[0]?.text,
    value.accessibilityText,
    value.accessibility?.accessibilityData?.label,
  ];
  for (const candidate of candidates) {
    const text = textValue(candidate);
    if (text && text.length > 2 && !/^\d+:\d+/.test(text)) return text.replace(/\s+/g, ' ').trim();
  }
  return '';
}

function collectVideos(node: unknown, found: Map<string, Video>) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    for (const item of node) collectVideos(item, found);
    return;
  }
  const value = node as Record<string, any>;
  const renderer = value.playlistVideoRenderer;
  if (renderer?.videoId) {
    const title = candidateTitle(renderer);
    if (title) found.set(renderer.videoId, { id: renderer.videoId, title, duration: textValue(renderer.lengthText) || null });
  }

  const lockup = value.lockupViewModel;
  if (lockup && /^[A-Za-z0-9_-]{11}$/.test(String(lockup.contentId || ''))) {
    const title = candidateTitle(lockup);
    if (title) found.set(lockup.contentId, { id: lockup.contentId, title, duration: null });
  }

  const directId = value.videoId || value.navigationEndpoint?.watchEndpoint?.videoId || value.onTap?.innertubeCommand?.watchEndpoint?.videoId;
  if (/^[A-Za-z0-9_-]{11}$/.test(String(directId || ''))) {
    const title = candidateTitle(value);
    if (title && !found.has(directId)) found.set(directId, { id: directId, title, duration: textValue(value.lengthText) || null });
  }

  for (const child of Object.values(value)) collectVideos(child, found);
}

function parseInitialData(html: string) {
  const markers = ['var ytInitialData = ', 'window["ytInitialData"] = ', 'ytInitialData = '];
  for (const marker of markers) {
    const index = html.indexOf(marker);
    if (index < 0) continue;
    const start = html.indexOf('{', index + marker.length);
    if (start < 0) continue;
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
          try { return JSON.parse(html.slice(start, i + 1)); } catch { break; }
        }
      }
    }
  }
  return null;
}

async function tryPiped(list: string): Promise<Video[]> {
  const instances = [
    'https://pipedapi.kavin.rocks',
    'https://pipedapi.adminforge.de',
    'https://pipedapi.reallyaweso.me',
    'https://pipedapi.leptons.xyz',
  ];
  for (const base of instances) {
    try {
      const result = await fetch(`${base}/playlists/${encodeURIComponent(list)}`, { headers: { 'User-Agent': 'FINISHCourseIndexer/1.0' } });
      if (!result.ok) continue;
      const data = await result.json();
      const rows = Array.isArray(data?.relatedStreams) ? data.relatedStreams : Array.isArray(data?.videos) ? data.videos : [];
      const videos = rows.map((row: any) => ({
        id: row?.videoId || videoIdFromUrl(row?.url),
        title: String(row?.title || '').trim(),
        duration: secondsToText(row?.duration),
      })).filter((row: any) => row.id && row.title);
      if (videos.length) return videos;
    } catch {
      // Try the next public mirror.
    }
  }
  return [];
}

async function tryYouTubeBrowse(list: string): Promise<Video[]> {
  const headers = {
    'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/126 Safari/537.36',
    'Accept-Language': 'en-US,en;q=0.9',
  };
  const page = await fetch(`https://www.youtube.com/playlist?list=${encodeURIComponent(list)}&hl=en&gl=US`, { headers });
  if (!page.ok) return [];
  const html = await page.text();
  const found = new Map<string, Video>();
  const initial = parseInitialData(html);
  if (initial) collectVideos(initial, found);
  if (found.size) return [...found.values()];

  const key = html.match(/"INNERTUBE_API_KEY":"([^"]+)"/)?.[1];
  if (!key) return [];
  const clientVersion = html.match(/"INNERTUBE_CLIENT_VERSION":"([^"]+)"/)?.[1] || '2.20260729.01.00';
  const browse = await fetch(`https://www.youtube.com/youtubei/v1/browse?key=${encodeURIComponent(key)}&prettyPrint=false`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json', Origin: 'https://www.youtube.com' },
    body: JSON.stringify({
      context: { client: { clientName: 'WEB', clientVersion, hl: 'en', gl: 'US' } },
      browseId: `VL${list}`,
    }),
  });
  if (!browse.ok) return [];
  collectVideos(await browse.json(), found);
  return [...found.values()];
}

export default async function handler(request: any, response: any) {
  const list = String(request.query?.list || '').trim();
  if (!ALLOWED.has(list)) return response.status(403).json({ error: 'playlist_not_allowed' });

  const piped = await tryPiped(list);
  const videos = piped.length ? piped : await tryYouTubeBrowse(list);
  response.setHeader('Cache-Control', 'no-store');
  return response.status(200).json({ playlistId: list, count: videos.length, source: piped.length ? 'piped' : 'youtube', videos });
}
