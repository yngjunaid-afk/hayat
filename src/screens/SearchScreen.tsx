import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  FlatList,
  ActivityIndicator,
  SafeAreaView,
  Alert,
  Keyboard,
  ListRenderItem,
  Platform,
} from "react-native";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";

import MiniPlayer from "../components/MiniPlayer";
import { COLORS } from "../constants/colors";
import {
  SongItem,
  searchSongs,
  formatDuration,
  toDisplayMeta,
  dedupeSongs,
} from "../services/musicApi";
import {
  playOrToggleTrack,
  prefetchTrackStreams,
} from "../services/musicPlayer";
import { filterAndRankSongs } from "../services/searchRanking";

const RECENT_SEARCHED_SONGS_KEY = "hayat_recent_searched_songs_v3";
const MAX_RECENT_SONGS = 12;
const MAX_RESULTS = 50;

const WEB_INPUT_FIX =
  Platform.OS === "web"
    ? ({
        outlineStyle: "none",
        boxShadow: "none",
        outlineWidth: 0,
      } as any)
    : undefined;

function cleanTrackTitle(rawTitle: string): string {
  let title = rawTitle.trim();

  title = title.replace(/\s*\(\s*from\s+["“”].*?["“”]\s*\)\s*$/i, "");
  title = title.replace(/\s*-\s*from\s+["“”].*?["“”]\s*$/i, "");
  title = title.replace(/\s*\(\s*from\s+.*?\)\s*$/i, "");
  title = title.replace(/\s*\(\s*music from\s+.*?\)\s*$/i, "");
  title = title.replace(/\s+/g, " ").trim();

  return title;
}

function cleanSongForDisplay(song: SongItem): SongItem {
  return {
    ...song,
    title: cleanTrackTitle(song.title),
  };
}

function cleanSongArray(items: SongItem[]): SongItem[] {
  return items.map(cleanSongForDisplay);
}

async function readRecentSongs(): Promise<SongItem[]> {
  try {
    const raw = await AsyncStorage.getItem(RECENT_SEARCHED_SONGS_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    const songs = parsed.filter(
      (item): item is SongItem =>
        typeof item === "object" &&
        item !== null &&
        typeof (item as SongItem).id === "string" &&
        typeof (item as SongItem).title === "string" &&
        typeof (item as SongItem).artist === "string"
    );

    return cleanSongArray(dedupeSongs(songs, MAX_RECENT_SONGS));
  } catch {
    return [];
  }
}

async function writeRecentSongs(items: SongItem[]) {
  try {
    await AsyncStorage.setItem(
      RECENT_SEARCHED_SONGS_KEY,
      JSON.stringify(dedupeSongs(items, MAX_RECENT_SONGS))
    );
  } catch {
    // ignore
  }
}

function SearchResultRow({
  song,
  onPlay,
  onMore,
}: {
  song: SongItem;
  onPlay: () => void;
  onMore: () => void;
}) {
  const meta = toDisplayMeta(song);

  return (
    <TouchableOpacity style={styles.row} activeOpacity={0.9} onPress={onPlay}>
      <View style={styles.coverWrap}>
        {song.thumbnail ? (
          <Image
            source={{ uri: song.thumbnail }}
            style={styles.cover}
            contentFit="cover"
          />
        ) : (
          <View style={styles.coverFallback}>
            <Ionicons name="musical-notes" size={18} color={COLORS.primary} />
          </View>
        )}
      </View>

      <View style={styles.info}>
        <Text numberOfLines={1} style={styles.title}>
          {song.title}
        </Text>

        <Text numberOfLines={1} style={styles.artist}>
          {song.artist}
        </Text>

        {meta ? (
          <Text numberOfLines={1} style={styles.meta}>
            {meta}
          </Text>
        ) : null}
      </View>

      <TouchableOpacity
        onPress={onPlay}
        style={styles.playButton}
        activeOpacity={0.85}
      >
        <Ionicons name="play" size={16} color="#fff" />
      </TouchableOpacity>

      <TouchableOpacity
        onPress={onMore}
        style={styles.moreButton}
        activeOpacity={0.85}
      >
        <Ionicons
          name="ellipsis-horizontal"
          size={18}
          color={COLORS.secondaryText}
        />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

function RecentSongRow({
  song,
  onPlay,
  onRemove,
}: {
  song: SongItem;
  onPlay: () => void;
  onRemove: () => void;
}) {
  const meta = toDisplayMeta(song);

  return (
    <TouchableOpacity style={styles.row} activeOpacity={0.9} onPress={onPlay}>
      <View style={styles.coverWrap}>
        {song.thumbnail ? (
          <Image
            source={{ uri: song.thumbnail }}
            style={styles.cover}
            contentFit="cover"
          />
        ) : (
          <View style={styles.coverFallback}>
            <Ionicons name="time-outline" size={18} color={COLORS.primary} />
          </View>
        )}
      </View>

      <View style={styles.info}>
        <Text numberOfLines={1} style={styles.title}>
          {song.title}
        </Text>

        <Text numberOfLines={1} style={styles.artist}>
          {song.artist}
        </Text>

        {meta ? (
          <Text numberOfLines={1} style={styles.meta}>
            {meta}
          </Text>
        ) : null}
      </View>

      <TouchableOpacity
        onPress={onPlay}
        style={styles.playButton}
        activeOpacity={0.85}
      >
        <Ionicons name="play" size={16} color="#fff" />
      </TouchableOpacity>

      <TouchableOpacity
        onPress={onRemove}
        style={styles.removeButton}
        activeOpacity={0.8}
        hitSlop={10}
      >
        <Text style={styles.removeText}>X</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

export default function SearchScreen() {
  const navigation = useNavigation<any>();

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SongItem[]>([]);
  const [recentSongs, setRecentSongs] = useState<SongItem[]>([]);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [loadingRecent, setLoadingRecent] = useState(true);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const trimmedQuery = query.trim();
  const showingSearchResults = trimmedQuery.length > 0;

  const loadRecentSongs = useCallback(async () => {
    setLoadingRecent(true);

    try {
      const items = await readRecentSongs();
      setRecentSongs(items);
      void prefetchTrackStreams(items.slice(0, 8));
    } catch (error) {
      console.log("Recent songs load error:", error);
      setRecentSongs([]);
    } finally {
      setLoadingRecent(false);
    }
  }, []);

  useEffect(() => {
    void loadRecentSongs();
  }, [loadRecentSongs]);

  const addRecentSong = useCallback(async (song: SongItem) => {
    setRecentSongs((prev) => {
      const next = dedupeSongs([song, ...prev], MAX_RECENT_SONGS);
      void writeRecentSongs(next);
      return next;
    });
  }, []);

  const removeRecentSong = useCallback((songId: string) => {
    setRecentSongs((prev) => {
      const next = prev.filter((item) => item.id !== songId);
      void writeRecentSongs(next);
      return next;
    });
  }, []);

  const clearQuery = useCallback(() => {
    setQuery("");
    setResults([]);
    setLoadingSearch(false);
  }, []);

  const runSearch = useCallback(async (text: string) => {
    const clean = text.trim();

    if (!clean) {
      setResults([]);
      setLoadingSearch(false);
      return;
    }

    setLoadingSearch(true);

    try {
      const found = await searchSongs(clean);
      const ranked = filterAndRankSongs(clean, found, MAX_RESULTS);
      const displayResults = cleanSongArray(ranked);
      setResults(displayResults);
      void prefetchTrackStreams(displayResults.slice(0, 12));
    } catch (error) {
      console.log("Search error:", error);
      setResults([]);
    } finally {
      setLoadingSearch(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (!trimmedQuery) {
      setResults([]);
      setLoadingSearch(false);
      return;
    }

    debounceRef.current = setTimeout(() => {
      void runSearch(trimmedQuery);
    }, 350);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [trimmedQuery, runSearch]);

  const handleSubmit = useCallback(() => {
    Keyboard.dismiss();
    void runSearch(query);
  }, [query, runSearch]);

  const playSong = useCallback(
    async (song: SongItem) => {
      try {
        await playOrToggleTrack(song);
        void addRecentSong(song);
      } catch (error: any) {
        Alert.alert(
          "Playback Failed",
          error?.message ?? "Could not play this song."
        );
      }
    },
    [addRecentSong]
  );

  const renderSearchItem: ListRenderItem<SongItem> = useCallback(
    ({ item }) => (
      <SearchResultRow
        song={item}
        onPlay={() => playSong(item)}
        onMore={() =>
          Alert.alert(
            item.title,
            [
              `Artist: ${item.artist}`,
              item.album ? `Album: ${item.album}` : null,
              item.language ? `Language: ${item.language}` : null,
              item.year ? `Year: ${item.year}` : null,
              item.duration ? `Duration: ${formatDuration(item.duration)}` : null,
            ]
              .filter(Boolean)
              .join("\n")
          )
        }
      />
    ),
    [playSong]
  );

  const renderRecentItem: ListRenderItem<SongItem> = useCallback(
    ({ item }) => (
      <RecentSongRow
        song={item}
        onPlay={() => playSong(item)}
        onRemove={() => removeRecentSong(item.id)}
      />
    ),
    [playSong, removeRecentSong]
  );

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
            activeOpacity={0.85}
          >
            <Ionicons name="chevron-back" size={24} color={COLORS.text} />
          </TouchableOpacity>

          <Text style={styles.headerTitle}>Search</Text>

          <View style={{ width: 36 }} />
        </View>

        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color={COLORS.secondaryText} />

          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search songs, artists, albums"
            placeholderTextColor={COLORS.secondaryText}
            style={[styles.searchInput, WEB_INPUT_FIX]}
            underlineColorAndroid="transparent"
            cursorColor={COLORS.primary}
            selectionColor={COLORS.primary}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
            onSubmitEditing={handleSubmit}
            blurOnSubmit={false}
          />

          {query.length > 0 ? (
            <TouchableOpacity
              onPress={clearQuery}
              activeOpacity={0.8}
              style={styles.clearButton}
            >
              <Text style={styles.clearText}>X</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {!showingSearchResults ? (
          <View style={styles.sectionBlock}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionLabel}>Recent Songs From Search</Text>
            </View>

            {loadingRecent ? (
              <View style={styles.loadingWrap}>
                <ActivityIndicator size="small" color={COLORS.primary} />
                <Text style={styles.loadingText}>Loading recent songs...</Text>
              </View>
            ) : recentSongs.length > 0 ? (
              <FlatList
                data={recentSongs}
                keyExtractor={(item, index) => `${item.id}-${index}`}
                renderItem={renderRecentItem}
                scrollEnabled={false}
                contentContainerStyle={styles.recentList}
                ListEmptyComponent={null}
              />
            ) : (
              <View style={styles.emptyWrap}>
                <Ionicons
                  name="search-outline"
                  size={42}
                  color={COLORS.secondaryText}
                />
                <Text style={styles.emptyTitle}>No recent searched songs</Text>
                <Text style={styles.emptyText}>
                  Search and play songs, and they will appear here with full metadata.
                </Text>
              </View>
            )}
          </View>
        ) : null}

        {loadingSearch ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.loadingText}>Searching...</Text>
          </View>
        ) : showingSearchResults ? (
          <FlatList
            data={results}
            keyExtractor={(item, index) => `${item.id}-${index}`}
            renderItem={renderSearchItem}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              showingSearchResults ? (
                <View style={styles.emptyWrap}>
                  <Ionicons
                    name="musical-notes-outline"
                    size={48}
                    color={COLORS.secondaryText}
                  />
                  <Text style={styles.emptyTitle}>No songs found</Text>
                  <Text style={styles.emptyText}>
                    Try a different artist, song, or album name.
                  </Text>
                </View>
              ) : null
            }
          />
        ) : null}

        <MiniPlayer />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: COLORS.text,
    flex: 1,
    textAlign: "center",
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 56,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
    paddingHorizontal: 16,
  },
  searchInput: {
    flex: 1,
    minHeight: 54,
    color: COLORS.text,
    fontSize: 15,
    borderWidth: 0,
    backgroundColor: "transparent",
    paddingVertical: 0,
    paddingHorizontal: 0,
    includeFontPadding: false,
  },
  clearButton: {
    paddingHorizontal: 2,
    paddingVertical: 2,
  },
  clearText: {
    color: "#000",
    fontSize: 18,
    fontWeight: "800",
  },
  sectionBlock: {
    marginTop: 18,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: "800",
    color: COLORS.secondaryText,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  listContent: {
    paddingTop: 14,
    paddingBottom: 180,
  },
  recentList: {
    gap: 10,
    paddingBottom: 10,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 18,
    padding: 12,
    marginBottom: 10,
  },
  coverWrap: {
    marginRight: 12,
  },
  cover: {
    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: "#F4E6E0",
  },
  coverFallback: {
    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: "#F4E6E0",
    alignItems: "center",
    justifyContent: "center",
  },
  info: {
    flex: 1,
    marginRight: 8,
  },
  title: {
    fontSize: 15,
    fontWeight: "800",
    color: COLORS.text,
  },
  artist: {
    marginTop: 3,
    fontSize: 13,
    color: COLORS.secondaryText,
  },
  meta: {
    marginTop: 3,
    fontSize: 12,
    color: COLORS.secondaryText,
  },
  playButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 4,
  },
  moreButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#F7EFEA",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },
  removeButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 6,
  },
  removeText: {
    color: "#000",
    fontSize: 16,
    fontWeight: "900",
    lineHeight: 18,
  },
  loadingWrap: {
    marginTop: 18,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 24,
  },
  loadingText: {
    marginTop: 10,
    color: COLORS.secondaryText,
    fontSize: 14,
    fontWeight: "600",
  },
  emptyWrap: {
    marginTop: 80,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  emptyTitle: {
    marginTop: 10,
    fontSize: 18,
    fontWeight: "800",
    color: COLORS.text,
  },
  emptyText: {
    marginTop: 6,
    textAlign: "center",
    color: COLORS.secondaryText,
    lineHeight: 20,
  },
});