import {
  Audio,
  AVPlaybackStatus,
  InterruptionModeAndroid,
  InterruptionModeIOS,
} from "expo-av";
import Constants from "expo-constants";
import { Platform } from "react-native";

import { SongItem } from "./musicApi";

const LIGHTNING_PRELOAD_LIMIT = 6;
import { addRecentlyPlayed } from "./recentlyPlayed";
import { auth } from "./firebase";
import { Song } from '../types/song';

type RawRecord = Record<string, unknown>;

function isRecord(value: unknown): value is RawRecord {
  return typeof value === "object" && value !== null;
}

function getExpoExtra(): Record<string, unknown> {
  const expoConfig = (Constants.expoConfig || Constants.manifest) as Record<string, unknown> | undefined;
  return (expoConfig?.extra as Record<string, unknown>) ?? {};
}

function resolveStreamingApiBaseUrls() {
  const extra = getExpoExtra();
  const envCandidates = [
    process.env.EXPO_PUBLIC_STREAMING_API_URL?.trim(),
    process.env.EXPO_PUBLIC_CHARTS_API_URL?.trim(),
    process.env.EXPO_PUBLIC_JIOSAAVN_API_URL?.trim(),
    typeof extra.EXPO_PUBLIC_STREAMING_API_URL === "string" ? extra.EXPO_PUBLIC_STREAMING_API_URL.trim() : "",
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
  const candidates: string[] = [];

  for (const value of [...envCandidates, ...fallbackCandidates]) {
    const clean = value.replace(/\/$/, "");
    if (!clean || seen.has(clean)) continue;
    seen.add(clean);
    candidates.push(clean);
  }

  return candidates;
}

type PlaybackState = {
  track: SongItem | null;
  isLoading: boolean;
  isPlaying: boolean;
  positionMillis: number;
  durationMillis: number;
  error: string | null;
};

const API_BASE_URLS = resolveStreamingApiBaseUrls();
const API_BASE_URL = API_BASE_URLS[0] ?? "https://saavn.dev/api";
const FALLBACK_STREAM_URL = "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3";

let sound: Audio.Sound | null = null;
let pendingPlayId = 0;

const streamCache = new Map<string, string>();

let state: PlaybackState = {
  track: null,
  isLoading: false,
  isPlaying: false,
  positionMillis: 0,
  durationMillis: 0,
  error: null,
};

const listeners = new Set<(next: PlaybackState) => void>();
let queue: Promise<void> = Promise.resolve();

function emit() {
  const snapshot = { ...state };
  listeners.forEach((listener) => listener(snapshot));
}

function setState(patch: Partial<PlaybackState>) {
  state = { ...state, ...patch };
  emit();
}

function readFirstString(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return "";
}

async function configureAudio() {
  await Audio.setAudioModeAsync({
    allowsRecordingIOS: false,
    playsInSilentModeIOS: true,
    staysActiveInBackground: true,
    interruptionModeIOS: InterruptionModeIOS.DuckOthers,
    interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
    shouldDuckAndroid: true,
  });
}

async function unloadCurrentSound() {
  if (!sound) return;

  try {
    await sound.unloadAsync();
  } catch {
    // ignore
  }

  sound = null;
}

function extractAudioUrl(payload: unknown): string | null {
  if (typeof payload === "string" && payload.trim()) return payload.trim();
  if (!isRecord(payload)) return null;

  const record = payload as RawRecord;
  const nestedCandidates: unknown[] = [];

  if (Array.isArray(record.data) && record.data.length > 0) nestedCandidates.push(record.data[0]);
  else if (isRecord(record.data)) nestedCandidates.push(record.data);

  if (Array.isArray(record.results) && record.results.length > 0) nestedCandidates.push(record.results[0]);
  else if (isRecord(record.results)) nestedCandidates.push(record.results);

  if (Array.isArray(record.songs) && record.songs.length > 0) nestedCandidates.push(record.songs[0]);
  else if (isRecord(record.songs)) nestedCandidates.push(record.songs);

  if (Array.isArray(record.items) && record.items.length > 0) nestedCandidates.push(record.items[0]);
  else if (isRecord(record.items)) nestedCandidates.push(record.items);

  if (Array.isArray(record.tracks) && record.tracks.length > 0) nestedCandidates.push(record.tracks[0]);
  else if (isRecord(record.tracks)) nestedCandidates.push(record.tracks);

  for (const candidate of nestedCandidates) {
    const nestedUrl = extractAudioUrl(candidate);
    if (nestedUrl) return nestedUrl;
  }

  const stream = record.stream as RawRecord | undefined;

  let audioUrl =
    readFirstString(
      stream?.audio,
      stream?.url,
      stream?.streamUrl,
      stream?.playbackUrl,
      stream?.download_url,
      stream?.media_url,
      stream?.encrypted_media_url,
      record.audio,
      record.url,
      record.streamUrl,
      record.playbackUrl,
      record.download_url,
      record.media_url,
      record.encrypted_media_url
    ) || null;

  if (!audioUrl && Array.isArray(record.downloadUrl) && record.downloadUrl.length > 0) {
    const highestQuality = (record.downloadUrl as Array<Record<string, unknown>>).find(
      (item: any) => item.quality === "320kbps"
    ) || (record.downloadUrl as Array<Record<string, unknown>>).find(
      (item: any) => item.quality === "160kbps"
    ) || record.downloadUrl[0];

    if (isRecord(highestQuality) && typeof highestQuality.url === "string") {
      audioUrl = highestQuality.url;
    } else if (typeof highestQuality === "string") {
      audioUrl = highestQuality;
    }
  }

  return audioUrl;
}

async function resolveStreamUrl(track: SongItem): Promise<string> {
  if (track.streamUrl && track.streamUrl.trim()) {
    streamCache.set(track.id, track.streamUrl.trim());
    return track.streamUrl.trim();
  }

  const cached = streamCache.get(track.id);
  if (cached) return cached;

  const searchQuery = `${track.title} ${track.artist}`.trim();
  const songId = track.sourceId || track.id;

  for (const baseUrl of API_BASE_URLS) {
    try {
      const response = await fetch(`${baseUrl}/songs/${encodeURIComponent(songId)}`);
      if (response.ok) {
        const json: unknown = await response.json();
        const record = (json as any)?.data ?? json;
        const audioUrl = extractAudioUrl(record);
        if (audioUrl) {
          streamCache.set(track.id, audioUrl);
          return audioUrl;
        }
      }
    } catch {
      // Try the next endpoint
    }

    try {
      const response = await fetch(`${baseUrl}/search/songs?query=${encodeURIComponent(searchQuery)}`);
      if (response.ok) {
        const json: unknown = await response.json();
        const searchRecord = ((json as any)?.data?.results ?? (json as any)?.data ?? (json as any)?.results ?? (json as any)?.songs ?? json) as unknown;
        const searchData = Array.isArray(searchRecord) ? searchRecord : [searchRecord];

        for (const item of searchData) {
          const audioUrl = extractAudioUrl(item);
          if (audioUrl) {
            streamCache.set(track.id, audioUrl);
            return audioUrl;
          }
        }
      }
    } catch {
      // Try the next endpoint
    }
  }

  streamCache.set(track.id, FALLBACK_STREAM_URL);
  return FALLBACK_STREAM_URL;
}

function handleStatusUpdate(status: AVPlaybackStatus) {
  if (!status.isLoaded) {
    setState({
      isLoading: false,
      isPlaying: false,
      error: (status as any).error || "Playback error",
    });
    return;
  }

  setState({
    isPlaying: status.isPlaying,
    positionMillis: status.positionMillis,
    durationMillis: status.durationMillis ?? 0,
    isLoading: false,
    error: null,
  });

  if (status.didJustFinish) {
    setState({
      isPlaying: false,
      positionMillis: 0,
    });
  }
}

function enqueue(task: () => Promise<void>) {
  const next = queue.then(task, task);
  queue = next.then(
    () => undefined,
    () => undefined
  );
  return next;
}

export function subscribePlayback(listener: (next: PlaybackState) => void) {
  listeners.add(listener);
  listener({ ...state });

  return () => {
    listeners.delete(listener);
  };
}

export function getPlaybackState() {
  return { ...state };
}

export async function prefetchTrackStream(track: SongItem) {
  if (!track?.id) return;
  if (track.streamUrl && track.streamUrl.trim()) {
    streamCache.set(track.id, track.streamUrl.trim());
    return;
  }

  if (streamCache.has(track.id)) return;

  const songId = track.sourceId || track.id;

  for (const baseUrl of API_BASE_URLS) {
    try {
      const response = await fetch(`${baseUrl}/songs/${encodeURIComponent(songId)}`);

      if (response.ok) {
        const json: unknown = await response.json();
        const record = (json as any)?.data ?? json;
        const audioUrl = extractAudioUrl(record);

        if (audioUrl) {
          streamCache.set(track.id, audioUrl);
          return;
        }
      }
    } catch {
      // Try the next endpoint
    }

    try {
      const response = await fetch(`${baseUrl}/search/songs?query=${encodeURIComponent(`${track.title} ${track.artist}`)}`);

      if (!response.ok) continue;

      const json: unknown = await response.json();
      const searchRecord = ((json as any)?.data?.results ?? (json as any)?.data ?? (json as any)?.results ?? (json as any)?.songs ?? json) as unknown;
      const searchData = Array.isArray(searchRecord) ? searchRecord : [searchRecord];

      for (const item of searchData) {
        const audioUrl = extractAudioUrl(item);
        if (audioUrl) {
          streamCache.set(track.id, audioUrl);
          return;
        }
      }
    } catch {
      // Try the next endpoint
    }
  }
}

export async function prefetchTrackStreams(tracks: SongItem[]) {
  const unique = new Map<string, SongItem>();

  for (const track of tracks) {
    if (track?.id && !unique.has(track.id)) {
      unique.set(track.id, track);
    }
  }

  const candidates = [...unique.values()].slice(0, LIGHTNING_PRELOAD_LIMIT);
  await Promise.allSettled(candidates.map((track) => prefetchTrackStream(track)));
}

export async function playTrack(track: SongItem) {
  return enqueue(async () => {
    if (state.isLoading) return;

    const playId = ++pendingPlayId;
    const userId = auth.currentUser?.uid ?? "guest";

    try {
      setState({
        track,
        isLoading: true,
        error: null,
      });

      await configureAudio();

      const audioUrl = await resolveStreamUrl(track);
      if (playId !== pendingPlayId) return;

      await unloadCurrentSound();
      if (playId !== pendingPlayId) return;

      const result = await Audio.Sound.createAsync(
        { uri: audioUrl },
        {
          shouldPlay: true,
          progressUpdateIntervalMillis: 500,
        },
        handleStatusUpdate
      );

      if (playId !== pendingPlayId) {
        try {
          await result.sound.unloadAsync();
        } catch {
          // ignore
        }
        return;
      }

      sound = result.sound;

      setState({
        isLoading: false,
        isPlaying: true,
        positionMillis: 0,
        durationMillis: 0,
      });

      void addRecentlyPlayed(userId, track);
    } catch (error: any) {
      setState({
        isLoading: false,
        isPlaying: false,
        error: error?.message ?? "Could not start playback",
      });
      throw error;
    }
  });
}

export async function togglePlayback() {
  return enqueue(async () => {
    if (!sound) {
      if (state.track) {
        await playTrack(state.track);
      }
      return;
    }

    if (state.isPlaying) {
      await sound.pauseAsync();
      setState({ isPlaying: false });
    } else {
      await sound.playAsync();
      setState({ isPlaying: true });
    }
  });
}

export async function seekTo(positionMillis: number) {
  return enqueue(async () => {
    if (!sound) return;
    await sound.setPositionAsync(positionMillis);
  });
}

export async function stopPlayback() {
  return enqueue(async () => {
    pendingPlayId += 1;

    await unloadCurrentSound();

    setState({
      track: null,
      isLoading: false,
      isPlaying: false,
      positionMillis: 0,
      durationMillis: 0,
      error: null,
    });
  });
}

export async function playOrToggleTrack(track: SongItem) {
  if (state.isLoading) return;

  if (state.track?.id === track.id) {
    await togglePlayback();
    return;
  }

  await playTrack(track);
}