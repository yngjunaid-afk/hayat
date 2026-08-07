import Constants from "expo-constants";
import { Platform } from "react-native";

export type SongItem = {
  id: string;
  title: string;
  artist: string;
  album?: string;
  thumbnail?: string;
  duration?: number;
  language?: string;
  year?: string;
  streamUrl?: string;
  chartRank?: number;
  chartSource?: string;
  sourceId?: string;
  downloadUrl?: any;
};

export type ChartsFeed = {
  globalTop: SongItem[];
  topIndia: SongItem[];
  trendingNow: SongItem[];
  newReleases: SongItem[];
  topAlbums: any[];
};

type RawRecord = Record<string, unknown>;

function getExpoExtra(): Record<string, unknown> {
  const expoConfig = (Constants.expoConfig || Constants.manifest) as Record<string, unknown> | undefined;
  return (expoConfig?.extra as Record<string, unknown>) ?? {};
}

function resolveChartsApiBaseUrls() {
  const extra = getExpoExtra();
  const candidates = [
    process.env.EXPO_PUBLIC_CHARTS_API_URL?.trim(),
    process.env.EXPO_PUBLIC_JIOSAAVN_API_URL?.trim(),
    typeof extra.EXPO_PUBLIC_CHARTS_API_URL === "string" ? extra.EXPO_PUBLIC_CHARTS_API_URL.trim() : "",
    typeof extra.EXPO_PUBLIC_JIOSAAVN_API_URL === "string" ? extra.EXPO_PUBLIC_JIOSAAVN_API_URL.trim() : "",
  ].filter((value): value is string => Boolean(value));

  const fallbackCandidates =
    Platform.OS === "web"
      ? ["http://127.0.0.1:5000", "http://127.0.0.1:5055", "http://127.0.0.1:3000", "https://saavn.dev/api"]
      : Platform.OS === "android"
        ? ["http://10.0.2.2:5000", "http://10.0.2.2:5055", "http://10.0.2.2:3000", "https://saavn.dev/api"]
        : ["http://172.20.10.14:5000", "http://172.20.10.14:5055", "http://172.20.10.14:3000", "https://saavn.dev/api"];

  const seen = new Set<string>();
  const urls: string[] = [];
  for (const url of [...candidates, ...fallbackCandidates]) {
    const clean = url.replace(/\/$/, "");
    if (!clean || seen.has(clean)) continue;
    seen.add(clean);
    urls.push(clean);
  }

  return urls;
}

function resolveStreamingApiBaseUrl() {
  const extra = getExpoExtra();
  const envUrl =
    process.env.EXPO_PUBLIC_STREAMING_API_URL?.trim() ||
    process.env.EXPO_PUBLIC_JIOSAAVN_API_URL?.trim() ||
    (typeof extra.EXPO_PUBLIC_STREAMING_API_URL === "string" ? extra.EXPO_PUBLIC_STREAMING_API_URL.trim() : "") ||
    (typeof extra.EXPO_PUBLIC_JIOSAAVN_API_URL === "string" ? extra.EXPO_PUBLIC_JIOSAAVN_API_URL.trim() : "");

  if (envUrl) return envUrl.replace(/\/$/, "");
  return "http://127.0.0.1:5000";
}

const API_BASE_URLS = resolveChartsApiBaseUrls();
const API_BASE_URL = API_BASE_URLS[0];
const STREAMING_API_BASE_URL = resolveStreamingApiBaseUrl();

const DEFAULT_LIMIT = 20;
const CACHE_TTL_MS = 15 * 60 * 1000;
const SEARCH_RETRY_COUNT = 1;

type CacheEntry<T> = {
  at: number;
  value: T;
};

const memoryCache = new Map<string, CacheEntry<any>>();

function now() {
  return Date.now();
}

function getCache<T>(key: string): T | null {
  const entry = memoryCache.get(key) as CacheEntry<T> | undefined;
  if (!entry) return null;
  if (now() - entry.at > CACHE_TTL_MS) {
    memoryCache.delete(key);
    return null;
  }
  return entry.value;
}

function setCache<T>(key: string, value: T) {
  memoryCache.set(key, { at: now(), value });
}

function readFirstString(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return "";
}

function readOptionalString(...values: unknown[]): string | undefined {
  const value = readFirstString(...values);
  return value || undefined;
}

function readNumber(...values: unknown[]): number | undefined {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return undefined;
}

function isRecord(value: unknown): value is RawRecord {
  return typeof value === "object" && value !== null;
}

function extractArtworkFromRecord(record: RawRecord): string | undefined {
  const image = record.image;
  if (Array.isArray(image)) {
    for (const item of image) {
      if (isRecord(item)) {
        const candidate = readOptionalString(item.link, item.url, item.thumbnail, item.imageUrl);
        if (candidate) return candidate;
      }
    }
  }

  if (isRecord(image)) {
    const candidate = readOptionalString(image.link, image.url, image.thumbnail, image.imageUrl);
    if (candidate) return candidate;
  }

  return readOptionalString(record.thumbnail, record.imageUrl, record.image_url, record.artwork, record.poster);
}

function extractDownloadUrlFromRecord(record: RawRecord): string | undefined {
  const downloadUrl = record.downloadUrl;
  if (Array.isArray(downloadUrl)) {
    for (const item of downloadUrl) {
      if (isRecord(item)) {
        const candidate = readOptionalString(item.link, item.url, item.downloadUrl);
        if (candidate) return candidate;
      }
    }
  }

  if (isRecord(downloadUrl)) {
    return readOptionalString(downloadUrl.link, downloadUrl.url, downloadUrl.downloadUrl);
  }

  return readOptionalString(record.streamUrl, record.media_url, record.mediaUrl, record.url, record.audio, record.playbackUrl, record.download_url, record.encrypted_media_url, record.previewUrl);
}

function extractArtistFromRecord(record: RawRecord): string | undefined {
  const candidates: unknown[] = [
    record.artist,
    record.primaryArtists,
    record.primary_artists,
    record.singers,
    record.artist_name,
    record.artistName,
    record.subtitle,
    record.description,
  ];

  const moreInfo = record.more_info;
  if (isRecord(moreInfo)) {
    candidates.push(
      moreInfo.artist,
      moreInfo.primaryArtists,
      moreInfo.primary_artists,
      moreInfo.singers,
      moreInfo.artist_name,
      moreInfo.artistName,
      moreInfo.subtitle,
      moreInfo.description
    );

    const artistMap = moreInfo.artistMap;
    if (isRecord(artistMap)) {
      for (const value of Object.values(artistMap)) {
        if (isRecord(value)) {
          candidates.push(value.name, value.title, value.artist);
        }
      }
    }
  }

  const artists = record.artists;
  if (Array.isArray(artists)) {
    for (const value of artists) {
      if (isRecord(value)) {
        candidates.push(value.name, value.title, value.artist);
      }
    }
  } else if (isRecord(artists)) {
    for (const key of ["primary", "all", "featured", "singers"]) {
      const arr = artists[key];
      if (Array.isArray(arr)) {
        for (const value of arr) {
          if (isRecord(value)) {
            candidates.push(value.name, value.title, value.artist);
          }
        }
      }
    }
  }

  const artist = readFirstString(...candidates);
  if (!artist || /^(unknown artist|various artists)$/i.test(artist)) {
    return undefined;
  }
  return artist;
}

function normalizeSongItem(item: unknown): SongItem | null {
  if (!isRecord(item)) return null;

  const title = readFirstString(
    item.title,
    item.name,
    item.song,
    item.track,
    item.songName,
    item.fullTitle,
    item.song_title,
    item.track_title,
    item.label
  );

  if (!title) return null;

  const artist = extractArtistFromRecord(item);

  const thumbnail = extractArtworkFromRecord(item);

  const album = readOptionalString(
    item.album,
    item.albumName,
    item.album_name,
    item.collectionName,
    (item.album as RawRecord | undefined)?.name,
    (item.albumName as RawRecord | undefined)?.name
  );
  const language = readOptionalString(item.language, item.lang);
  const year = readOptionalString(item.year, item.releaseDate, item.yearOfRelease);

  const id =
    readFirstString(
      item.id,
      item.songid,
      item.trackId,
      item.videoId,
      item.key,
      item.sid,
      item.songId,
      item.track_id,
      item.perma_url,
      item.url
    ) || `${title}-${artist || "unknown"}`;

  const duration = readNumber(item.duration, item.durationInSeconds, item.length);

  let streamUrl = extractDownloadUrlFromRecord(item);

  const chartRank = readNumber(item.chartRank, item.rank, item.position);
  const chartSource = readOptionalString(item.chartSource, item.source, item.provider);
  const sourceId = readOptionalString(item.sourceId, item.source_id, item.providerId);

  return {
    id,
    title,
    artist: artist || "Unknown artist",
    album,
    thumbnail,
    duration,
    language,
    year,
    streamUrl,
    chartRank,
    chartSource,
    sourceId,
    downloadUrl: item.downloadUrl,
  };
}

export function normalizeSongArray(data: unknown): SongItem[] {
  let raw: unknown[] = [];

  if (Array.isArray(data)) {
    raw = data;
  } else if (isRecord(data)) {
    if (Array.isArray(data.songs)) raw = data.songs;
    else if (Array.isArray(data.data)) raw = data.data;
    else if (Array.isArray(data.results)) raw = data.results;
    else if (Array.isArray(data.items)) raw = data.items;
    else if (Array.isArray(data.tracks)) raw = data.tracks;
    else if (Array.isArray(data.top)) raw = data.top;
    else if (Array.isArray(data.madeForYou)) raw = data.madeForYou;
    else if (Array.isArray(data.recentlyPlayed)) raw = data.recentlyPlayed;
    else if (Array.isArray(data.globalTop)) raw = data.globalTop;
    else if (Array.isArray(data.topIndia)) raw = data.topIndia;
    else if (Array.isArray(data.trendingNow)) raw = data.trendingNow;
    else if (Array.isArray(data.newReleases)) raw = data.newReleases;
  }

  return raw
    .map((item) => normalizeSongItem(item))
    .filter((item): item is SongItem => item !== null);
}

export function dedupeSongs(songs: SongItem[], limit = songs.length): SongItem[] {
  const seen = new Set<string>();
  const output: SongItem[] = [];

  for (const song of songs) {
    const key = `${song.title.toLowerCase()}__${song.artist.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(song);
    if (output.length >= limit) break;
  }

  return output;
}

export function formatDuration(seconds?: number | null): string {
  if (!seconds || !Number.isFinite(seconds) || seconds <= 0) return "";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

async function fetchJson(path: string, init?: RequestInit): Promise<unknown> {
  let lastError: unknown = null;

  for (const baseUrl of API_BASE_URLS) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    try {
      console.log(`Fetching from API: ${baseUrl}${path}`);
      const response = await fetch(`${baseUrl}${path}`, {
        ...init,
        headers: {
          accept: "application/json",
          ...(init?.headers || {}),
        },
        signal: controller.signal,
      });

      console.log(`API response status: ${response.status} for ${baseUrl}${path}`);
      if (!response.ok) {
        lastError = new Error(`Request failed: ${response.status} ${response.statusText}`);
        continue;
      }

      const data = await response.json();
      console.log(`API response data received for ${baseUrl}${path}:`, data);
      return data;
    } catch (error) {
      console.error(`API request failed for ${baseUrl}${path}:`, error);
      lastError = error;
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError ?? new Error(`Request failed for ${path}`);
}

async function fetchJsonWithRetry(path: string, retries = SEARCH_RETRY_COUNT) {
  let lastError: unknown = null;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await fetchJson(path);
    } catch (error) {
      lastError = error;
      if (attempt >= retries) break;
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Request failed");
}

export async function searchSongs(query: string): Promise<SongItem[]> {
  const clean = query.trim();
  if (!clean) return [];

  const cacheKey = `search:${clean.toLowerCase()}`;
  const cached = getCache<SongItem[]>(cacheKey);
  if (cached) return cached;

  const response = await fetch(`${STREAMING_API_BASE_URL}/search/songs?query=${encodeURIComponent(clean)}`);
  if (!response.ok) {
    throw new Error(`Search failed: ${response.status}`);
  }

  const json = await response.json();
  const searchData =
    (json as any)?.data?.results ??
    (json as any)?.data ??
    (json as any)?.results ??
    (json as any)?.songs ??
    json;

  const results = normalizeSongArray(searchData).map((song) => ({
    ...song,
    streamUrl: song.streamUrl || (json as any)?.data?.streamUrl || undefined,
  }));

  const deduped = dedupeSongs(results, 50);

  setCache(cacheKey, deduped);
  return deduped;
}

export async function fetchSongsFromQueries(
  queries: string[],
  limit = DEFAULT_LIMIT
): Promise<SongItem[]> {
  const cleanQueries = [...new Set(queries.map((q) => q.trim()).filter(Boolean))];
  if (!cleanQueries.length) return [];

  const cacheKey = `queries:${cleanQueries.join("|").toLowerCase()}:${limit}`;
  const cached = getCache<SongItem[]>(cacheKey);
  if (cached) return cached;

  const batch = await Promise.allSettled(
    cleanQueries.map((query) => searchSongs(query))
  );

  const flattened = batch.flatMap((result) =>
    result.status === "fulfilled" ? result.value : []
  );

  const deduped = dedupeSongs(flattened, limit);
  setCache(cacheKey, deduped);
  return deduped;
}

export async function fetchChartsFeed(): Promise<ChartsFeed> {
  const cacheKey = "charts:feed";
  const cached = getCache<ChartsFeed>(cacheKey);
  if (cached) return cached;

  let record: Record<string, unknown> = {};
  try {
    const json = await fetchJsonWithRetry("/feed");
    record = isRecord(json) ? json : {};
  } catch {
    record = {
      globalTop: [
        {
          id: "fallback-1",
          title: "Sunset Drive",
          artist: "Hayat Beats",
          album: "Fallback Classics",
          thumbnail: "https://i.ytimg.com/vi/ScMzIvxBSi4/maxresdefault.jpg",
          duration: 185,
          year: "2024",
          streamUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
        },
        {
          id: "fallback-2",
          title: "Night Rhythm",
          artist: "Hayat Studio",
          album: "Soft Echoes",
          thumbnail: "https://i.ytimg.com/vi/3YxaaGgTQYM/maxresdefault.jpg",
          duration: 198,
          year: "2024",
          streamUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
        },
      ],
      topIndia: [],
      trendingNow: [],
      newReleases: [],
      topAlbums: [],
    };
  }

  const normalizeSection = (key: string) => {
    const raw = (record as any)[key] ?? [];
    const normalized = normalizeSongArray(raw);

    return dedupeSongs(
      normalized.map((song) => ({
        ...song,
        chartSource: song.chartSource || "jiosaavn",
        chartRank: song.chartRank ?? 0,
        streamUrl: song.streamUrl || undefined,
      })),
      40
    );
  };

  const feed: ChartsFeed = {
    globalTop: normalizeSection("globalTop"),
    topIndia: normalizeSection("topIndia"),
    trendingNow: normalizeSection("trendingNow"),
    newReleases: normalizeSection("newReleases"),
    topAlbums: Array.isArray((record as any).topAlbums) ? (record as any).topAlbums : [],
  };

  if (!feed.globalTop.length && !feed.topIndia.length && !feed.trendingNow.length && !feed.newReleases.length) {
    feed.globalTop = [
      {
        id: "fallback-1",
        title: "Sunset Drive",
        artist: "Hayat Beats",
        album: "Fallback Classics",
        thumbnail: "https://i.ytimg.com/vi/ScMzIvxBSi4/maxresdefault.jpg",
        duration: 185,
        year: "2024",
        streamUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
      },
      {
        id: "fallback-2",
        title: "Night Rhythm",
        artist: "Hayat Studio",
        album: "Soft Echoes",
        thumbnail: "https://i.ytimg.com/vi/3YxaaGgTQYM/maxresdefault.jpg",
        duration: 198,
        year: "2024",
        streamUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
      },
    ];
  }

  setCache(cacheKey, feed);
  return feed;
}

export async function fetchChartsSection(
  section: "globalTop" | "topIndia" | "trendingNow" | "newReleases",
  limit = 20
): Promise<SongItem[]> {
  const feed = await fetchChartsFeed();
  return dedupeSongs(feed[section] || [], limit);
}

export async function fetchRecentlyPlayedSongs(
  userId: string,
  limit = 20
): Promise<SongItem[]> {
  const cleanUserId = userId.trim();
  if (!cleanUserId) return [];

  const cacheKey = `recently:${cleanUserId}:${limit}`;
  const cached = getCache<SongItem[]>(cacheKey);
  if (cached) return cached;

  const json = await fetchJsonWithRetry(
    `/recently-played?userId=${encodeURIComponent(cleanUserId)}&limit=${encodeURIComponent(
      String(limit)
    )}`
  );

  const songs = dedupeSongs(normalizeSongArray((json as any)?.songs ?? json), limit);

  setCache(cacheKey, songs);
  return songs;
}

export async function fetchSongById(id: string): Promise<SongItem | null> {
  const clean = id.trim();
  if (!clean) return null;

  const response = await fetch(`${STREAMING_API_BASE_URL}/songs/${encodeURIComponent(clean)}`);
  if (!response.ok) return null;

  const json = await response.json();
  const payload = (json as any)?.data ?? json;
  return normalizeSongArray(payload)[0] ?? null;
}

export async function fetchArtistSongs(
  artist: string,
  limit = 20
): Promise<SongItem[]> {
  const clean = artist.trim();
  if (!clean) return [];

  const json = await fetchJsonWithRetry(
    `/artist?q=${encodeURIComponent(clean)}&limit=${encodeURIComponent(String(limit))}`
  );

  return dedupeSongs(normalizeSongArray((json as any)?.songs ?? json), limit);
}

export async function fetchAlbumSongs(
  album: string,
  limit = 20
): Promise<SongItem[]> {
  const clean = album.trim();
  if (!clean) return [];

  const json = await fetchJsonWithRetry(
    `/album?q=${encodeURIComponent(clean)}&limit=${encodeURIComponent(String(limit))}`
  );

  return dedupeSongs(normalizeSongArray((json as any)?.songs ?? json), limit);
}

export async function fetchPlaylistSongs(
  playlist: string,
  limit = 20
): Promise<SongItem[]> {
  const clean = playlist.trim();
  if (!clean) return [];

  const json = await fetchJsonWithRetry(
    `/playlist?q=${encodeURIComponent(clean)}&limit=${encodeURIComponent(String(limit))}`
  );

  return dedupeSongs(normalizeSongArray((json as any)?.songs ?? json), limit);
}

export function toDisplayMeta(song: SongItem): string {
  return [
    song.album,
    song.language,
    song.year,
    song.duration ? formatDuration(song.duration) : "",
  ]
    .filter(Boolean)
    .join(" • ");
}

export function withFallbackArtwork(song: SongItem, fallback?: string): SongItem {
  return {
    ...song,
    thumbnail: song.thumbnail || fallback,
  };
}

export function sortSongsAlphabetically(songs: SongItem[]) {
  return [...songs].sort((a, b) => a.title.localeCompare(b.title));
}

export function mergeSongLists(...lists: SongItem[][]): SongItem[] {
  return dedupeSongs(lists.flat(), 200);
}