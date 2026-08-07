// src/services/searchRanking.ts

import type { SongItem } from "./musicApi";

export type RankedSongItem = SongItem & {
  score: number;
  matchedArtist?: boolean;
  matchedTitle?: boolean;
  isExactTitle?: boolean;
};

export const HUGE_ARTISTS = new Set(
  [
    // Global
    "The Weeknd",
    "Taylor Swift",
    "Justin Bieber",
    "Ed Sheeran",
    "Ariana Grande",
    "Billie Eilish",
    "Drake",
    "Post Malone",
    "Bruno Mars",
    "Dua Lipa",
    "Olivia Rodrigo",
    "Travis Scott",
    "Kendrick Lamar",
    "Eminem",
    "Coldplay",
    "Imagine Dragons",
    "Maroon 5",
    "OneRepublic",
    "Harry Styles",
    "Shawn Mendes",
    "Adele",
    "SZA",
    "Doja Cat",
    "Charlie Puth",
    "Khalid",
    "Rihanna",
    "Beyoncé",
    "Lady Gaga",
    "Katy Perry",
    "Selena Gomez",
    "Lana Del Rey",
    "Hozier",
    "The Beatles",
    "Queen",
    "ABBA",
    "Michael Jackson",
    "Linkin Park",
    "Green Day",
    "The Rolling Stones",
    "Nirvana",
    "AC/DC",

    // India / South Asia
    "Arijit Singh",
    "Atif Aslam",
    "Pritam",
    "A.R. Rahman",
    "Armaan Malik",
    "Jubin Nautiyal",
    "Shreya Ghoshal",
    "Sonu Nigam",
    "Diljit Dosanjh",
    "Sid Sriram",
    "Anirudh Ravichander",
    "Vishal Mishra",
    "Darshan Raval",
    "King",
    "Anuv Jain",
    "AP Dhillon",
    "Shubh",
    "Sidhu Moose Wala",
    "Badshah",
    "Yo Yo Honey Singh",
    "Raftaar",
    "Neha Kakkar",
    "Mohit Chauhan",
    "Amaal Mallik",
    "KK",
    "Vishal-Shekhar",
    "Shankar-Ehsaan-Loy",

    // K-pop / Latin / EDM / others
    "BTS",
    "BLACKPINK",
    "EXO",
    "TWICE",
    "SEVENTEEN",
    "Stray Kids",
    "ATEEZ",
    "Rosalía",
    "Bad Bunny",
    "Karol G",
    "Maluma",
    "Daddy Yankee",
    "Luis Fonsi",
    "Calvin Harris",
    "David Guetta",
    "Avicii",
    "Martin Garrix",
    "Marshmello",
    "Zedd",
    "Skrillex",
    "Diplo",
    "Alan Walker",
    "Kygo",
  ].map((name) => name.toLowerCase())
);

const BAD_KEYWORDS = [
  "karaoke",
  "cover",
  "instrumental",
  "slowed",
  "reverb",
  "nightcore",
  "sped up",
  "sped-up",
  "8d",
  "lofi",
  "remix",
  "edit",
  "fan made",
  "fanmade",
  "mashup",
  "tribute",
];

const OFFICIAL_KEYWORDS = [
  "official",
  "original",
  "album version",
  "single",
  "explicit",
];

const MOVIE_SUFFIX_PATTERNS: RegExp[] = [
  /\s*\(\s*from\s+["“”].*?["“”]\s*\)\s*$/i,
  /\s*-\s*from\s+["“”].*?["“”]\s*$/i,
  /\s*\(\s*music from\s+.*?\)\s*$/i,
  /\s*\(\s*from\s+.*?\)\s*$/i,
];

function normalizeText(value: unknown): string {
  return String(value ?? "")
    .toLowerCase()
    .replace(/&quot;|&#34;|&amp;|&apos;|&#39;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanTitle(value: string): string {
  let text = value.trim();

  for (const pattern of MOVIE_SUFFIX_PATTERNS) {
    text = text.replace(pattern, "");
  }

  return text.replace(/\s+/g, " ").trim();
}

function getTitle(song: Partial<SongItem>): string {
  return cleanTitle(String(song.title ?? ""));
}

function getArtist(song: Partial<SongItem>): string {
  return String(song.artist ?? "").trim();
}

function hasHugeArtist(song: Partial<SongItem>): boolean {
  const artist = normalizeText(getArtist(song));
  if (!artist) return false;

  for (const huge of HUGE_ARTISTS) {
    if (artist.includes(huge)) return true;
  }

  return false;
}

function countKeywordHits(text: string, keywords: string[]): number {
  let hits = 0;
  for (const keyword of keywords) {
    if (text.includes(keyword)) hits += 1;
  }
  return hits;
}

function scoreSong(query: string, song: Partial<SongItem>): number {
  const q = normalizeText(query);
  const title = normalizeText(getTitle(song));
  const artist = normalizeText(getArtist(song));
  const album = normalizeText(song.album);
  const language = normalizeText(song.language);
  const year = normalizeText(song.year);
  const combined = `${title} ${artist} ${album} ${language} ${year}`.trim();

  let score = 0;

  if (!q) return score;

  // Exact / close title matches
  if (title === q) score += 1000;
  if (title.startsWith(q)) score += 700;
  if (title.includes(q)) score += 450;

  // Artist match
  if (artist === q) score += 600;
  if (artist.startsWith(q)) score += 350;
  if (artist.includes(q)) score += 220;

  // Album / metadata relevance
  if (album.includes(q)) score += 120;
  if (language.includes(q)) score += 40;
  if (year.includes(q)) score += 20;

  // Huge/popular artists
  if (hasHugeArtist(song)) score += 300;

  // Official / good quality versions
  score += countKeywordHits(combined, OFFICIAL_KEYWORDS) * 70;

  // Penalize low-quality or noisy versions
  score -= countKeywordHits(combined, BAD_KEYWORDS) * 250;

  // Very small bonus for short titles or cleaner matches
  if (title.length <= q.length + 6) score += 40;

  return score;
}

export function dedupeSongsByIdOrTitle<T extends Partial<SongItem>>(songs: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];

  for (const song of songs) {
    const title = normalizeText(song.title);
    const artist = normalizeText(song.artist);
    const id = String(song.id ?? "").trim();

    const key = id || `${title}__${artist}`;
    if (!key || seen.has(key)) continue;

    seen.add(key);
    out.push(song);
  }

  return out;
}

export function rankSongs<T extends Partial<SongItem>>(
  query: string,
  songs: T[]
): RankedSongItem[] {
  const cleanQuery = normalizeText(query);

  return dedupeSongsByIdOrTitle(songs)
    .map((song) => {
      const title = normalizeText(getTitle(song));
      const artist = normalizeText(getArtist(song));

      const score = scoreSong(cleanQuery, song);

      return {
        ...(song as SongItem),
        title: cleanTitle(String(song.title ?? "")),
        score,
        matchedTitle: cleanQuery ? title.includes(cleanQuery) : false,
        matchedArtist: cleanQuery ? artist.includes(cleanQuery) : false,
        isExactTitle: cleanQuery ? title === cleanQuery : false,
      };
    })
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;

      // Tie-breakers: exact title first, then huge artists, then shorter title
      if (a.isExactTitle !== b.isExactTitle) return a.isExactTitle ? -1 : 1;

      const aHuge = hasHugeArtist(a);
      const bHuge = hasHugeArtist(b);
      if (aHuge !== bHuge) return aHuge ? -1 : 1;

      const aLen = normalizeText(a.title).length;
      const bLen = normalizeText(b.title).length;
      if (aLen !== bLen) return aLen - bLen;

      return normalizeText(a.artist).localeCompare(normalizeText(b.artist));
    });
}

export function filterAndRankSongs<T extends Partial<SongItem>>(
  query: string,
  songs: T[],
  limit = 50
): RankedSongItem[] {
  return rankSongs(query, songs).slice(0, limit);
}

export function splitRankedSongs<T extends Partial<SongItem>>(
  query: string,
  songs: T[]
): {
  topResult: RankedSongItem | null;
  songs: RankedSongItem[];
  hugeArtists: RankedSongItem[];
  official: RankedSongItem[];
  others: RankedSongItem[];
} {
  const ranked = rankSongs(query, songs);

  const topResult = ranked[0] ?? null;

  const hugeArtists = ranked.filter((song) => hasHugeArtist(song));
  const official = ranked.filter((song) => {
    const text = normalizeText(`${song.title} ${song.artist} ${song.album}`);
    return OFFICIAL_KEYWORDS.some((keyword) => text.includes(keyword));
  });
  const others = ranked.filter(
    (song) => !hugeArtists.includes(song) && !official.includes(song)
  );

  return {
    topResult,
    songs: ranked,
    hugeArtists,
    official,
    others,
  };
}

export function isHighQualitySearchResult(song: Partial<SongItem>): boolean {
  const text = normalizeText(
    `${song.title ?? ""} ${song.artist ?? ""} ${song.album ?? ""}`
  );

  return !BAD_KEYWORDS.some((word) => text.includes(word));
}

export function removeLowQualityResults<T extends Partial<SongItem>>(
  songs: T[]
): T[] {
  return songs.filter((song) => isHighQualitySearchResult(song));
}

export function boostHugeArtistsOnly<T extends Partial<SongItem>>(
  songs: T[]
): T[] {
  return dedupeSongsByIdOrTitle(songs).sort((a, b) => {
    const aHuge = hasHugeArtist(a) ? 1 : 0;
    const bHuge = hasHugeArtist(b) ? 1 : 0;
    return bHuge - aHuge;
  });
}