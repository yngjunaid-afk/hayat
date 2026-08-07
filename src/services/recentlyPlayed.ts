import AsyncStorage from "@react-native-async-storage/async-storage";
import { SongItem, dedupeSongs } from "./musicApi";

const RECENTLY_PLAYED_KEY_PREFIX = "hayat_recently_played_v3_";
const MAX_RECENT = 50;

function normalizeUserId(userId: string) {
  return userId.trim() || "guest";
}

function normalizeSong(song: SongItem): SongItem {
  return {
    ...song,
    title: (song.title || "").trim(),
    artist: (song.artist || "Unknown artist").trim(),
    album: song.album?.trim() || undefined,
    thumbnail: song.thumbnail?.trim() || undefined,
    language: song.language?.trim() || undefined,
    year: song.year?.trim() || undefined,
    streamUrl: song.streamUrl?.trim() || undefined,
  };
}

async function readList(key: string): Promise<SongItem[]> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    const items = parsed
      .filter((item): item is SongItem => {
        return !!item && typeof item === "object" && typeof (item as any).title === "string";
      })
      .map((item) => normalizeSong(item));

    return dedupeSongs(items, MAX_RECENT);
  } catch {
    return [];
  }
}

async function writeList(key: string, songs: SongItem[]) {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(dedupeSongs(songs, MAX_RECENT)));
  } catch {
    // ignore
  }
}

export async function addRecentlyPlayed(userId: string, song: SongItem) {
  const cleanUserId = normalizeUserId(userId);
  const key = `${RECENTLY_PLAYED_KEY_PREFIX}${cleanUserId}`;

  const existing = await readList(key);
  const next = dedupeSongs([normalizeSong(song), ...existing], MAX_RECENT);

  await writeList(key, next);
}

export async function fetchRecentlyPlayed(
  userId: string,
  limit = 20
): Promise<SongItem[]> {
  const cleanUserId = normalizeUserId(userId);
  const key = `${RECENTLY_PLAYED_KEY_PREFIX}${cleanUserId}`;

  const existing = await readList(key);
  return dedupeSongs(existing, limit);
}

export async function clearRecentlyPlayed(userId: string) {
  const cleanUserId = normalizeUserId(userId);
  const key = `${RECENTLY_PLAYED_KEY_PREFIX}${cleanUserId}`;

  try {
    await AsyncStorage.removeItem(key);
  } catch {
    // ignore
  }
}

export async function removeRecentlyPlayedItem(
  userId: string,
  songId: string
) {
  const cleanUserId = normalizeUserId(userId);
  const key = `${RECENTLY_PLAYED_KEY_PREFIX}${cleanUserId}`;

  const existing = await readList(key);
  const next = existing.filter((item) => item.id !== songId);

  await writeList(key, next);
}

export async function updateRecentlyPlayed(
  userId: string,
  song: SongItem
) {
  await addRecentlyPlayed(userId, song);
}

export async function fetchRecentlyPlayedSongs(
  userId: string,
  limit = 20
): Promise<SongItem[]> {
  return fetchRecentlyPlayed(userId, limit);
}