import AsyncStorage from "@react-native-async-storage/async-storage";
import { SongItem, dedupeSongs, fetchChartsFeed, fetchSongsFromQueries } from "./musicApi";
import { fetchRecentlyPlayed } from "./recentlyPlayed";

const RECENTLY_PLAYED_TASTE_KEY_PREFIX = "hayat_taste_profile_v3_";
const SEARCH_HISTORY_KEY_PREFIX = "hayat_search_history_v3_";
const MAX_HISTORY = 20;

function normalizeText(value: string | undefined | null) {
  return (value || "").trim().toLowerCase();
}

async function readStringArray(key: string): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter(Boolean)
      .slice(0, MAX_HISTORY);
  } catch {
    return [];
  }
}

async function writeStringArray(key: string, items: string[]) {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(items.slice(0, MAX_HISTORY)));
  } catch {
    // ignore
  }
}

export async function addSearchHistory(userId: string, query: string) {
  const cleanUserId = userId.trim() || "guest";
  const cleanQuery = query.trim();
  if (!cleanQuery) return;

  const key = `${SEARCH_HISTORY_KEY_PREFIX}${cleanUserId}`;
  const existing = await readStringArray(key);

  const next = [
    cleanQuery,
    ...existing.filter((item) => item.toLowerCase() !== cleanQuery.toLowerCase()),
  ].slice(0, MAX_HISTORY);

  await writeStringArray(key, next);
}

export async function getSearchHistory(userId: string): Promise<string[]> {
  const cleanUserId = userId.trim() || "guest";
  return readStringArray(`${SEARCH_HISTORY_KEY_PREFIX}${cleanUserId}`);
}

export async function addTasteSignal(userId: string, song: SongItem) {
  const cleanUserId = userId.trim() || "guest";
  const key = `${RECENTLY_PLAYED_TASTE_KEY_PREFIX}${cleanUserId}`;

  try {
    const raw = await AsyncStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    const items = Array.isArray(parsed) ? parsed : [];

    const next = [
      {
        title: song.title,
        artist: song.artist,
        album: song.album || "",
        language: song.language || "",
      },
      ...items,
    ].slice(0, MAX_HISTORY);

    await AsyncStorage.setItem(key, JSON.stringify(next));
  } catch {
    // ignore
  }
}

async function getTasteProfile(userId: string): Promise<string[]> {
  const cleanUserId = userId.trim() || "guest";
  const key = `${RECENTLY_PLAYED_TASTE_KEY_PREFIX}${cleanUserId}`;

  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    const out: string[] = [];
    for (const item of parsed) {
      if (item && typeof item === "object") {
        const record = item as Record<string, unknown>;
        const title = normalizeText(typeof record.title === "string" ? record.title : "");
        const artist = normalizeText(typeof record.artist === "string" ? record.artist : "");
        const album = normalizeText(typeof record.album === "string" ? record.album : "");

        if (artist) out.push(artist);
        if (title) out.push(title);
        if (album) out.push(album);
      }
    }

    return [...new Set(out)].slice(0, MAX_HISTORY);
  } catch {
    return [];
  }
}

function normalizePreferenceTokens(values: string[]) {
  const normalized = new Set<string>();

  for (const raw of values) {
    const text = raw.trim().toLowerCase();
    if (!text) continue;

    normalized.add(text);
    for (const word of text.split(/\s+/)) {
      if (word.length > 1) normalized.add(word);
    }
  }

  return [...normalized].slice(0, 16);
}

function scoreSong(song: SongItem, taste: string[], searches: string[], recencyScore = 0) {
  const hay = `${song.title} ${song.artist} ${song.album || ""} ${song.language || ""}`.toLowerCase();
  let score = recencyScore;

  for (const token of taste) {
    if (!token) continue;
    if (hay === token) score += 15;
    else if (hay.includes(` ${token} `) || hay.startsWith(`${token} `) || hay.endsWith(` ${token}`)) score += 10;
    else if (hay.includes(token)) score += 5;
  }

  for (const token of searches) {
    if (!token) continue;
    if (hay.includes(token)) score += 4;
  }

  if (song.chartRank) score += Math.max(0, 20 - song.chartRank);
  return score;
}

export async function fetchMadeForYouSongs(
  userId: string,
  limit = 20
): Promise<SongItem[]> {
  const [taste, searches, recent, charts] = await Promise.all([
    getTasteProfile(userId),
    getSearchHistory(userId),
    fetchRecentlyPlayed(userId).catch(() => []),
    fetchChartsFeed().catch(() => null),
  ]);

  const pool = [
    ...recent,
    ...(charts?.trendingNow ?? []),
    ...(charts?.globalTop ?? []),
    ...(charts?.topIndia ?? []),
    ...(charts?.newReleases ?? []),
  ];

  const profileTokens = normalizePreferenceTokens([...taste, ...searches]);
  if (profileTokens.length > 0) {
    const querySongs = await fetchSongsFromQueries(profileTokens.slice(0, 3), 30).catch(() => []);
    pool.push(...querySongs);
  }

  const ranked = pool
    .map((song, index) => ({
      song,
      score: scoreSong(song, profileTokens, searches, Math.max(0, 18 - index)),
    }))
    .sort((a, b) => b.score - a.score)
    .map((item) => item.song);

  const deduped = dedupeSongs(ranked, limit);
  if (deduped.length > 0) {
    return deduped;
  }

  return dedupeSongs(
    [
      ...recent,
      ...(charts?.trendingNow ?? []),
      ...(charts?.globalTop ?? []),
      ...(charts?.topIndia ?? []),
      ...(charts?.newReleases ?? []),
    ],
    limit
  );
}

export async function fetchRecommendations(
  userId: string,
  limit = 20
): Promise<SongItem[]> {
  return fetchMadeForYouSongs(userId, limit);
}