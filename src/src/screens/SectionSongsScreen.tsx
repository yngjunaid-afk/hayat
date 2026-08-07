import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  ListRenderItem,
  SafeAreaView,
} from "react-native";

import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";

import { COLORS } from "../constants/colors";
import { auth } from "../services/firebase";
import {
  fetchChartsFeed,
  formatDuration,
  SongItem,
  dedupeSongs,
} from "../services/musicApi";
import { fetchRecentlyPlayed } from "../services/recentlyPlayed";
import { fetchMadeForYouSongs } from "../services/recommendationService";
import { playOrToggleTrack, prefetchTrackStreams } from "../services/musicPlayer";

type SectionKey =
  | "madeForYou"
  | "globalTop"
  | "topIndia"
  | "trendingNow"
  | "newReleases"
  | "recentlyPlayed";

type RouteParams = {
  sectionKey: SectionKey;
  title: string;
};

function uniqueByArtist(items: SongItem[], limit = 40) {
  const seen = new Set<string>();
  const out: SongItem[] = [];

  for (const item of items) {
    const artist = (item.artist || "").trim().toLowerCase();
    if (!artist) continue;
    if (seen.has(artist)) continue;

    seen.add(artist);
    out.push(item);

    if (out.length >= limit) break;
  }

  return out;
}

function SongRow({
  song,
  index,
  onPlay,
  onMore,
  showIndexNumber = true,
  showRankBadge = true,
}: {
  song: SongItem;
  index: number;
  onPlay: () => void;
  onMore: () => void;
  showIndexNumber?: boolean;
  showRankBadge?: boolean;
}) {
  const meta = [
    song.album,
    song.language,
    song.year,
    song.duration ? formatDuration(song.duration) : "",
  ]
    .filter(Boolean)
    .join(" • ");

  return (
    <TouchableOpacity style={styles.row} activeOpacity={0.9} onPress={onPlay}>
      {showIndexNumber ? <Text style={styles.index}>{index + 1}</Text> : null}

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

        {showRankBadge && typeof song.chartRank === "number" ? (
          <View style={styles.rankBadge}>
            <Text style={styles.rankText}>#{song.chartRank}</Text>
          </View>
        ) : null}
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

export default function SectionSongsScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();

  const params = (route.params ?? {}) as Partial<RouteParams>;
  const sectionKey = params.sectionKey ?? "globalTop";
  const title = params.title ?? "Songs";

  const [songs, setSongs] = useState<SongItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadSection = useCallback(async () => {
    const userId = auth.currentUser?.uid ?? "";

    try {
      let result: SongItem[] = [];

      if (sectionKey === "madeForYou") {
        result = await fetchMadeForYouSongs(userId, 40);
      } else if (sectionKey === "recentlyPlayed") {
        result = await fetchRecentlyPlayed(userId, 40);
      } else {
        const charts = await fetchChartsFeed();

        if (sectionKey === "globalTop") result = charts.globalTop;
        else if (sectionKey === "topIndia") result = charts.topIndia;
        else if (sectionKey === "trendingNow") result = charts.trendingNow;
        else if (sectionKey === "newReleases") result = charts.newReleases;
      }

      const deduped = dedupeSongs(result, 40);
      const cleaned =
        sectionKey === "globalTop" ||
        sectionKey === "topIndia" ||
        sectionKey === "trendingNow" ||
        sectionKey === "newReleases"
          ? uniqueByArtist(deduped, 40)
          : deduped;

      setSongs(cleaned);

      // Warm the first tracks so playback feels faster
      void prefetchTrackStreams(cleaned.slice(0, 8));
    } catch (error) {
      console.log("Section load error:", error);
      setSongs([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [sectionKey]);

  useEffect(() => {
    void loadSection();
  }, [loadSection]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setLoading(true);
    void loadSection();
  }, [loadSection]);

  const handlePlay = useCallback(async (song: SongItem) => {
    try {
      await playOrToggleTrack(song);
    } catch (error: any) {
      Alert.alert(
        "Playback Failed",
        error?.message ?? "Could not play this song."
      );
    }
  }, []);

  const shouldShowIndexNumber = sectionKey !== "newReleases" && sectionKey !== "madeForYou";
  const shouldShowRankBadge = sectionKey !== "newReleases" && sectionKey !== "madeForYou";

  const renderItem: ListRenderItem<SongItem> = useCallback(
    ({ item, index }) => (
      <SongRow
        song={item}
        index={index}
        showIndexNumber={shouldShowIndexNumber}
        showRankBadge={shouldShowRankBadge}
        onPlay={() => handlePlay(item)}
        onMore={() =>
          Alert.alert(
            item.title,
            [
              `Artist: ${item.artist}`,
              item.album ? `Album: ${item.album}` : null,
              item.language ? `Language: ${item.language}` : null,
              item.year ? `Year: ${item.year}` : null,
              item.duration ? `Duration: ${formatDuration(item.duration)}` : null,
              typeof item.chartRank === "number"
                ? `Chart Rank: #${item.chartRank}`
                : null,
            ]
              .filter(Boolean)
              .join("\n")
          )
        }
      />
    ),
    [handlePlay]
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading songs...</Text>
        </View>
      </SafeAreaView>
    );
  }

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

          <Text style={styles.headerTitle}>{title}</Text>

          <View style={{ width: 36 }} />
        </View>

        <FlatList
          data={songs}
          keyExtractor={(item, index) => `${item.id}-${index}`}
          renderItem={renderItem}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={COLORS.primary}
              colors={[COLORS.primary]}
            />
          }
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={7}
          removeClippedSubviews
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Ionicons
                name="musical-notes-outline"
                size={48}
                color={COLORS.secondaryText}
              />
              <Text style={styles.emptyTitle}>No songs found</Text>
              <Text style={styles.emptyText}>
                Try refreshing this section or open it again later.
              </Text>
            </View>
          }
        />

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
    marginBottom: 12,
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
  listContent: {
    paddingBottom: 180,
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
  index: {
    width: 26,
    fontWeight: "800",
    color: COLORS.secondaryText,
    textAlign: "center",
  },
  coverWrap: {
    marginLeft: 8,
    position: "relative",
  },
  cover: {
    width: 60,
    height: 60,
    borderRadius: 14,
    backgroundColor: "#F4E6E0",
  },
  coverFallback: {
    width: 60,
    height: 60,
    borderRadius: 14,
    backgroundColor: "#F4E6E0",
    alignItems: "center",
    justifyContent: "center",
  },
  rankBadge: {
    position: "absolute",
    left: -6,
    top: -6,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.95)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  rankText: {
    fontSize: 10,
    fontWeight: "800",
    color: COLORS.text,
  },
  info: {
    flex: 1,
    marginLeft: 12,
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
  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.background,
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
  emptyPlaceholder: {
    marginTop: 18,
    alignItems: "center",
    justifyContent: "center",
  },
});