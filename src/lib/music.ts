// Music helpers — URL parsing for direct YouTube/Spotify links plus a
// YouTube Data API v3 search wrapper for free-text queries.

export type MusicProvider = "youtube" | "spotify";

export interface ParsedMusic {
  provider: MusicProvider;
  embedUrl: string;
  label: string;
}

export interface YouTubeSearchResult {
  videoId: string;
  title: string;
  channelTitle: string;
  thumbnailUrl: string;
}

// ----------------------------------------------------------------------------
// URL detection
// ----------------------------------------------------------------------------

/**
 * Returns true when the input looks like a URL (with or without scheme) for
 * a music host we can embed. Used to route an input to the URL parser instead
 * of the search flow.
 */
export function looksLikeMusicUrl(input: string): boolean {
  const raw = input.trim();
  if (!raw) return false;
  // If it parses as a URL with scheme, accept.
  try {
    const u = new URL(raw);
    if (u.protocol === "http:" || u.protocol === "https:") return true;
  } catch {
    /* fall through */
  }
  // Bare host shorthand (e.g. "youtu.be/abc") — try with https://
  if (/^(www\.|m\.)?(youtube\.com|youtu\.be|music\.youtube\.com|open\.spotify\.com|spotify\.com)\b/i.test(raw)) {
    try {
      const u = new URL("https://" + raw);
      return !!u.hostname;
    } catch {
      return false;
    }
  }
  return false;
}

export function parseMusicUrl(input: string): ParsedMusic | null {
  let raw = input.trim();
  if (!raw) return null;

  // Allow bare "youtube.com/..." without scheme.
  if (!/^https?:\/\//i.test(raw)) {
    if (/^(www\.|m\.)?(youtube\.com|youtu\.be|music\.youtube\.com|open\.spotify\.com|spotify\.com)\b/i.test(raw)) {
      raw = "https://" + raw;
    } else {
      return null;
    }
  }

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }

  const host = url.hostname.replace(/^www\./, "").toLowerCase();

  // ---------- YouTube ----------
  if (host === "youtube.com" || host === "m.youtube.com" || host === "music.youtube.com") {
    const list = url.searchParams.get("list");
    const v = url.searchParams.get("v");
    if (list) {
      return {
        provider: "youtube",
        embedUrl: `https://www.youtube.com/embed/videoseries?list=${encodeURIComponent(list)}`,
        label: "YouTube playlist",
      };
    }
    if (v) {
      return {
        provider: "youtube",
        embedUrl: `https://www.youtube.com/embed/${encodeURIComponent(v)}`,
        label: "YouTube video",
      };
    }
  }

  if (host === "youtu.be") {
    const id = url.pathname.replace(/^\//, "").split("/")[0];
    if (id) {
      return {
        provider: "youtube",
        embedUrl: `https://www.youtube.com/embed/${encodeURIComponent(id)}`,
        label: "YouTube video",
      };
    }
  }

  // ---------- Spotify ----------
  if (host === "open.spotify.com" || host === "spotify.com") {
    const parts = url.pathname.split("/").filter(Boolean);
    let kindIndex = 0;
    if (parts[0]?.startsWith("intl-")) kindIndex = 1;
    const kind = parts[kindIndex];
    const id = parts[kindIndex + 1];
    const validKinds = ["playlist", "track", "album", "artist", "episode", "show"];
    if (kind && id && validKinds.includes(kind)) {
      return {
        provider: "spotify",
        embedUrl: `https://open.spotify.com/embed/${kind}/${encodeURIComponent(id)}`,
        label: `Spotify ${kind}`,
      };
    }
  }

  return null;
}

/**
 * Build the embeddable iframe URL for a YouTube video id chosen from search.
 */
export function youtubeVideoIdToParsed(videoId: string, title?: string): ParsedMusic {
  return {
    provider: "youtube",
    embedUrl: `https://www.youtube.com/embed/${encodeURIComponent(videoId)}`,
    label: title || "YouTube video",
  };
}

// ----------------------------------------------------------------------------
// YouTube Data API v3 search
// ----------------------------------------------------------------------------

const YT_API_KEY = import.meta.env.VITE_YOUTUBE_API_KEY as string | undefined;
const YT_SEARCH_ENDPOINT = "https://www.googleapis.com/youtube/v3/search";

export function isYouTubeSearchAvailable(): boolean {
  return typeof YT_API_KEY === "string" && YT_API_KEY.length > 0;
}

export class YouTubeSearchError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
    this.name = "YouTubeSearchError";
  }
}

/**
 * Search YouTube and return a small list of video results suitable for an
 * inline picker. Throws YouTubeSearchError on transport/quota errors.
 */
export async function searchYouTube(
  query: string,
  maxResults = 5,
  signal?: AbortSignal
): Promise<YouTubeSearchResult[]> {
  if (!isYouTubeSearchAvailable()) {
    throw new YouTubeSearchError(
      "YouTube search isn't configured. You can still paste a YouTube or Spotify link.",
      "missing_key"
    );
  }
  const q = query.trim();
  if (!q) return [];

  const url =
    `${YT_SEARCH_ENDPOINT}` +
    `?part=snippet` +
    `&type=video` +
    `&safeSearch=moderate` +
    `&maxResults=${Math.min(Math.max(maxResults, 1), 5)}` +
    `&q=${encodeURIComponent(q)}` +
    `&key=${encodeURIComponent(YT_API_KEY!)}`;

  let res: Response;
  try {
    res = await fetch(url, { signal });
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
    throw new YouTubeSearchError("Couldn't reach YouTube. Check your connection.");
  }

  if (!res.ok) {
    let detail = "";
    try {
      const body = await res.json();
      detail = body?.error?.message || "";
    } catch {
      /* ignore */
    }
    if (res.status === 403) {
      throw new YouTubeSearchError(
        detail || "YouTube refused the request. Your API key may be restricted or out of quota.",
        "forbidden"
      );
    }
    throw new YouTubeSearchError(detail || `YouTube returned ${res.status}.`);
  }

  const data = (await res.json()) as {
    items?: Array<{
      id?: { videoId?: string };
      snippet?: {
        title?: string;
        channelTitle?: string;
        thumbnails?: Record<string, { url?: string }>;
      };
    }>;
  };

  const items = data.items ?? [];
  return items
    .map((it): YouTubeSearchResult | null => {
      const videoId = it.id?.videoId;
      if (!videoId) return null;
      const t = it.snippet?.thumbnails;
      const thumb = t?.medium?.url || t?.high?.url || t?.default?.url || "";
      return {
        videoId,
        title: decodeHtmlEntities(it.snippet?.title || "(untitled)"),
        channelTitle: decodeHtmlEntities(it.snippet?.channelTitle || ""),
        thumbnailUrl: thumb,
      };
    })
    .filter((x): x is YouTubeSearchResult => x !== null);
}

// YouTube returns titles with HTML entities like &amp; and &#39; — decode them.
function decodeHtmlEntities(s: string): string {
  if (typeof document === "undefined") return s;
  const el = document.createElement("textarea");
  el.innerHTML = s;
  return el.value;
}
