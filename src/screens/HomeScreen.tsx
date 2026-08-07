import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
  SafeAreaView,
  FlatList,
  ListRenderItem,
} from "react-native";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useNavigation } from "@react-navigation/native";

import { COLORS } from "../constants/colors";
import { auth } from "../services/firebase";
import { getCurrentUserProfile } from "../services/userService";
import {
  fetchChartsFeed,
  formatDuration,
  SongItem,
  ChartsFeed,
  dedupeSongs,
} from "../services/musicApi";
import { fetchRecentlyPlayed } from "../services/recentlyPlayed";
import { fetchMadeForYouSongs } from "../services/recommendationService";
import { playOrToggleTrack, prefetchTrackStreams, prefetchTrackStream } from "../services/musicPlayer";

const EMPTY_CHARTS: ChartsFeed = {
  globalTop: [],
  topIndia: [],
  trendingNow: [],
  newReleases: [],
  topAlbums: [],
};

const HOME_CACHE_KEY = "hayat_home_cache_v9";
const HOME_REFRESH_MS = 5 * 60 * 1000;
const FAST_PRELOAD_LIMIT = 8;
const MADE_FOR_YOU_CACHE_KEY_PREFIX = "hayat_made_for_you_cache_v11_";
const MADE_FOR_YOU_TIME_KEY_PREFIX = "hayat_made_for_you_timestamp_v11_";
const MADE_FOR_YOU_REFRESH_MS = 24 * 60 * 60 * 1000;

type HomeFeed = {
  madeForYou: SongItem[];
  charts: ChartsFeed;
  recentlyPlayed: SongItem[];
};

type HomeCache = {
  avatarUrl: string | null;
  feed: HomeFeed;
  savedAt: number;
};

function getGreeting() {
  const hour = new Date().getHours();

  if (hour < 12) return { title: "Good morning,", subtitle: "your top songs are ready. ♡" };
  if (hour < 17) return { title: "Good afternoon,", subtitle: "take a break with your favorite music. ♡" };
  if (hour < 21) return { title: "Good evening,", subtitle: "unwind with the songs you love. ♡" };
  return { title: "Good night,", subtitle: "end your day with peaceful music. ♡" };
}

function normalizeArtist(value: string | undefined) {
  return (value || "").trim().toLowerCase();
}

function normalizeArtworkUrl(url?: string) {
  if (!url) return undefined;
  const clean = url.trim();
  if (!clean) return undefined;

  // only upscale Apple-style artwork URLs; leave other sources untouched
  if (/mzstatic/i.test(clean) || /apple/i.test(clean)) {
    return clean
      .replace(/100x100bb\.jpg/i, "600x600bb.jpg")
      .replace(/100x100\.jpg/i, "600x600.jpg")
      .replace(/200x200bb\.jpg/i, "600x600bb.jpg");
  }

  return clean;
}

function uniqueByArtistOnly(items: SongItem[], limit = 15) {
  const seen = new Set<string>();
  const out: SongItem[] = [];

  for (const item of items) {
    const artist = normalizeArtist(item.artist);
    if (!artist || seen.has(artist)) continue;
    seen.add(artist);
    out.push(item);
    if (out.length >= limit) break;
  }

  return out;
}

function uniqueById(items: SongItem[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

function dedupeAndUnique(items: SongItem[], limit = 15) {
  return uniqueByArtistOnly(dedupeSongs(items, 50), limit);
}

function reindexRanks(items: SongItem[]) {
  return items.map((item, index) => ({
    ...item,
    chartRank: index + 1,
  }));
}

function makeCacheKeys(userId: string) {
  const suffix = userId || "guest";
  return {
    cacheKey: `${MADE_FOR_YOU_CACHE_KEY_PREFIX}${suffix}`,
    timeKey: `${MADE_FOR_YOU_TIME_KEY_PREFIX}${suffix}`,
  };
}

async function readHomeCache(): Promise<HomeCache | null> {
  try {
    const raw = await AsyncStorage.getItem(HOME_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as HomeCache;
    if (!parsed || typeof parsed !== "object" || !parsed.feed) return null;
    return parsed;
  } catch {
    return null;
  }
}

async function writeHomeCache(value: HomeCache) {
  try {
    await AsyncStorage.setItem(HOME_CACHE_KEY, JSON.stringify(value));
  } catch {
    // ignore
  }
}

async function loadMadeForYouWithCache(userId: string, limit: number): Promise<SongItem[]> {
  const { cacheKey, timeKey } = makeCacheKeys(userId);

  const cachedSongsRaw = await AsyncStorage.getItem(cacheKey);
  const cachedTimeRaw = await AsyncStorage.getItem(timeKey);

  if (cachedSongsRaw && cachedTimeRaw) {
    const age = Date.now() - Number(cachedTimeRaw);
    if (Number.isFinite(age) && age < MADE_FOR_YOU_REFRESH_MS) {
      try {
        const parsed = JSON.parse(cachedSongsRaw) as SongItem[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          return dedupeAndUnique(parsed, limit);
        }
      } catch {
        // ignore
      }
    }
  }

  const fresh = await fetchMadeForYouSongs(userId, limit).catch(() => []);
  if (Array.isArray(fresh) && fresh.length > 0) {
    await AsyncStorage.setItem(cacheKey, JSON.stringify(fresh));
    await AsyncStorage.setItem(timeKey, Date.now().toString());
  }

  return dedupeAndUnique(fresh, limit);
}

async function readOrBuildHomeData(userId: string) {
  const [profileRes, recentRes, chartsRes, madeForYouRes] = await Promise.allSettled([
    getCurrentUserProfile(),
    fetchRecentlyPlayed(userId),
    fetchChartsFeed(),
    loadMadeForYouWithCache(userId, 15),
  ]);

  const avatarUrl =
    profileRes.status === "fulfilled"
      ? profileRes.value?.avatar || profileRes.value?.avatarUrl || null
      : null;

  const recentlyPlayed = recentRes.status === "fulfilled" ? recentRes.value : [];
  const charts = chartsRes.status === "fulfilled" ? chartsRes.value : EMPTY_CHARTS;
  const madeForYou = madeForYouRes.status === "fulfilled" ? madeForYouRes.value : [];

  return { avatarUrl, recentlyPlayed, charts, madeForYou };
}

function buildMadeForYouFallback(charts: ChartsFeed, recent: SongItem[]) {
  return dedupeSongs(
    [
      ...recent,
      ...charts.trendingNow,
      ...charts.globalTop,
      ...charts.topIndia,
      ...charts.newReleases,
    ],
    15
  );
}

function buildRecentFromPlayback(recent: SongItem[]) {
  return dedupeSongs(recent, 15);
}

function SectionHeader({
  title,
  onSeeAll,
}: {
  title: string;
  onSeeAll: () => void;
}) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <TouchableOpacity onPress={onSeeAll} activeOpacity={0.85}>
        <Text style={styles.seeAll}>See All</Text>
      </TouchableOpacity>
    </View>
  );
}

function SongCard({
  song,
  onPlay,
  onMore,
  showRankBadge = true,
}: {
  song: SongItem;
  onPlay: () => void;
  onMore: () => void;
  showRankBadge?: boolean;
}) {
  const meta = [
    song.artist,
    song.album,
    song.language,
    song.year,
    song.duration ? formatDuration(song.duration) : "",
  ]
    .filter(Boolean)
    .join(" • ");

  const thumbnail = normalizeArtworkUrl(song.thumbnail);

  return (
    <TouchableOpacity style={styles.songCard} activeOpacity={0.92} onPress={onPlay}>
      <View style={styles.songThumbWrap}>
        {thumbnail ? (
          <Image
            source={{ uri: thumbnail }}
            style={styles.songThumb}
            contentFit="cover"
          />
        ) : (
          <View style={styles.songThumbFallback}>
            <Ionicons name="musical-notes" size={20} color={COLORS.primary} />
          </View>
        )}

        {showRankBadge && typeof song.chartRank === "number" ? (
          <View style={styles.rankBadge}>
            <Text style={styles.rankText}>#{song.chartRank}</Text>
          </View>
        ) : null}

        <View style={styles.playBadge}>
          <Ionicons name="play" size={14} color="#fff" />
        </View>
      </View>

      <Text style={styles.songTitle} numberOfLines={1}>
        {song.title}
      </Text>

      <Text style={styles.songArtist} numberOfLines={1}>
        {meta}
      </Text>

      <TouchableOpacity
        style={styles.moreButton}
        onPress={onMore}
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

function SectionScroller({
  title,
  items,
  emptyText,
  onSeeAll,
  onPlay,
  loading,
}: {
  title: string;
  items: SongItem[];
  emptyText: string;
  onSeeAll: () => void;
  onPlay: (song: SongItem) => void;
  loading?: boolean;
}) {
  const shouldShowRankBadge = title !== "Made for You" && title !== "New Releases";

  const renderItem: ListRenderItem<SongItem> = useCallback(
    ({ item }) => (
      <SongCard
        song={item}
        showRankBadge={shouldShowRankBadge}
        onPlay={() => onPlay(item)}
        onMore={() =>
          Alert.alert(
            item.title,
            [
              `Artist: ${item.artist}`,
              item.album ? `Album: ${item.album}` : null,
              item.language ? `Language: ${item.language}` : null,
              item.year ? `Year: ${item.year}` : null,
              item.duration ? `Duration: ${formatDuration(item.duration)}` : null,
              typeof item.chartRank === "number" ? `Chart Rank: #${item.chartRank}` : null,
            ]
              .filter(Boolean)
              .join("\n")
          )
        }
      />
    ),
    [onPlay, shouldShowRankBadge]
  );

  if (title === "Recently Played" && items.length === 0) {
    return null;
  }

  return (
    <>
      <SectionHeader title={title} onSeeAll={onSeeAll} />

      {loading && items.length === 0 ? (
        <View style={styles.skeletonRow}>
          {[1, 2, 3, 4].map((item) => (
            <View key={item} style={styles.skeletonCard} />
          ))}
        </View>
      ) : items.length > 0 ? (
        <FlatList
          horizontal
          data={items}
          renderItem={renderItem}
          keyExtractor={(item, index) => `${item.id}-${index}`}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.horizontalList}
          initialNumToRender={5}
          maxToRenderPerBatch={5}
          windowSize={5}
          removeClippedSubviews
        />
      ) : (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>{emptyText}</Text>
        </View>
      )}
    </>
  );
}

export default function HomeScreen() {
  const navigation = useNavigation<any>();
  const greeting = useMemo(() => getGreeting(), []);
  const lastLoadedRef = useRef(0);

  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [feed, setFeed] = useState<HomeFeed>({
    madeForYou: [],
    charts: EMPTY_CHARTS,
    recentlyPlayed: [],
  });
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const warmPlaybackCache = useCallback((songs: SongItem[]) => {
    const list = dedupeSongs(songs, 12).slice(0, 12);
    if (!list.length) return;
    void prefetchTrackStreams(list);
  }, []);

  const prefetchPrimaryCandidates = useCallback((homeFeed: HomeFeed) => {
    const candidates = dedupeSongs(
      [
        ...homeFeed.madeForYou.slice(0, FAST_PRELOAD_LIMIT),
        ...homeFeed.charts.globalTop.slice(0, FAST_PRELOAD_LIMIT),
        ...homeFeed.charts.topIndia.slice(0, FAST_PRELOAD_LIMIT),
        ...homeFeed.charts.trendingNow.slice(0, FAST_PRELOAD_LIMIT),
        ...homeFeed.charts.newReleases.slice(0, FAST_PRELOAD_LIMIT),
        ...homeFeed.recentlyPlayed.slice(0, FAST_PRELOAD_LIMIT),
      ],
      FAST_PRELOAD_LIMIT * 3
    );

    if (!candidates.length) return;

    void prefetchTrackStreams(candidates.slice(0, FAST_PRELOAD_LIMIT * 2));

    const first = candidates[0];
    if (first) {
      void prefetchTrackStream(first);
    }
  }, []);

  const prefetchAllSections = useCallback((homeFeed: HomeFeed) => {
    const tracks = dedupeSongs(
      [
        ...homeFeed.madeForYou.slice(0, 12),
        ...homeFeed.charts.globalTop.slice(0, 12),
        ...homeFeed.charts.topIndia.slice(0, 12),
        ...homeFeed.charts.trendingNow.slice(0, 12),
        ...homeFeed.charts.newReleases.slice(0, 12),
        ...homeFeed.recentlyPlayed.slice(0, 12),
      ],
      40
    ).slice(0, 24);

    if (!tracks.length) return;
    void prefetchTrackStreams(tracks);
  }, []);

  const hydrateFromCache = useCallback(async () => {
    const cached = await readHomeCache();
    if (!cached) return;

    const nextFeed: HomeFeed = {
      madeForYou: dedupeAndUnique(cached.feed?.madeForYou ?? [], 15),
      charts: {
        globalTop: reindexRanks(dedupeAndUnique(cached.feed?.charts?.globalTop ?? [], 15)),
        topIndia: reindexRanks(dedupeAndUnique(cached.feed?.charts?.topIndia ?? [], 15)),
        trendingNow: reindexRanks(dedupeAndUnique(cached.feed?.charts?.trendingNow ?? [], 15)),
        newReleases: reindexRanks(dedupeAndUnique(cached.feed?.charts?.newReleases ?? [], 15)),
        topAlbums: Array.isArray(cached.feed?.charts?.topAlbums)
          ? cached.feed?.charts?.topAlbums
          : [],
      },
      recentlyPlayed: dedupeAndUnique(cached.feed?.recentlyPlayed ?? [], 15),
    };

    setAvatarUrl(cached.avatarUrl ?? null);
    setFeed(nextFeed);
    void prefetchPrimaryCandidates(nextFeed);
    void prefetchAllSections(nextFeed);
  }, [prefetchAllSections, prefetchPrimaryCandidates]);

  const loadHome = useCallback(async () => {
    setLoading(true);
    const userId = auth.currentUser?.uid ?? "";

    try {
      const { avatarUrl: avatar, recentlyPlayed, charts, madeForYou } =
        await readOrBuildHomeData(userId);

      const madeForYouFinal =
        madeForYou.length > 0
          ? madeForYou
          : buildMadeForYouFallback(charts, recentlyPlayed);

      const nextFeed: HomeFeed = {
        madeForYou: dedupeAndUnique(madeForYouFinal, 15),
        charts: {
          globalTop: reindexRanks(dedupeAndUnique(charts.globalTop || [], 15)),
          topIndia: reindexRanks(dedupeAndUnique(charts.topIndia || [], 15)),
          trendingNow: reindexRanks(dedupeAndUnique(charts.trendingNow || [], 15)),
          newReleases: reindexRanks(dedupeAndUnique(charts.newReleases || [], 15)),
          topAlbums: Array.isArray(charts.topAlbums) ? charts.topAlbums : [],
        },
        recentlyPlayed: buildRecentFromPlayback(recentlyPlayed || []),
      };

      setAvatarUrl(avatar);
      setFeed(nextFeed);

      await writeHomeCache({
        avatarUrl: avatar,
        feed: nextFeed,
        savedAt: Date.now(),
      });

      void prefetchPrimaryCandidates(nextFeed);
      void prefetchAllSections(nextFeed);
    } catch (error) {
      console.log("Home load error:", error);

      const cached = await readHomeCache();
      if (cached) {
        const nextFeed: HomeFeed = {
          madeForYou: dedupeAndUnique(cached.feed?.madeForYou ?? [], 15),
          charts: {
            globalTop: reindexRanks(dedupeAndUnique(cached.feed?.charts?.globalTop ?? [], 15)),
            topIndia: reindexRanks(dedupeAndUnique(cached.feed?.charts?.topIndia ?? [], 15)),
            trendingNow: reindexRanks(dedupeAndUnique(cached.feed?.charts?.trendingNow ?? [], 15)),
            newReleases: reindexRanks(dedupeAndUnique(cached.feed?.charts?.newReleases ?? [], 15)),
            topAlbums: Array.isArray(cached.feed?.charts?.topAlbums)
              ? cached.feed?.charts?.topAlbums
              : [],
          },
          recentlyPlayed: dedupeAndUnique(cached.feed?.recentlyPlayed ?? [], 15),
        };

        setAvatarUrl(cached.avatarUrl ?? null);
        setFeed(nextFeed);
        void prefetchPrimaryCandidates(nextFeed);
        void prefetchAllSections(nextFeed);
      }
    } finally {
      setLoading(false);
    }
  }, [prefetchAllSections]);

  useEffect(() => {
    void hydrateFromCache();
    void loadHome();
  }, [hydrateFromCache, loadHome]);

  useFocusEffect(
    useCallback(() => {
      const age = Date.now() - lastLoadedRef.current;
      if (lastLoadedRef.current > 0 && age < HOME_REFRESH_MS) return;

      let active = true;

      const run = async () => {
        if (!active) return;
        await loadHome();
        if (active) lastLoadedRef.current = Date.now();
      };

      run();

      return () => {
        active = false;
      };
    }, [loadHome])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadHome();
    lastLoadedRef.current = Date.now();
    setRefreshing(false);
  };

  const playSong = async (song: SongItem) => {
    try {
      await playOrToggleTrack(song);
    } catch (error: any) {
      Alert.alert("Playback Failed", error?.message ?? "Could not play this song.");
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={COLORS.primary}
              colors={[COLORS.primary]}
            />
          }
        >
          <View style={styles.header}>
            <View style={styles.logoWrap}>
              <Image
                source={require("../../assets/images/hayat-logo.png")}
                style={styles.logo}
                contentFit="contain"
              />
            </View>

            <TouchableOpacity
              onPress={() => navigation.navigate("Profile")}
              activeOpacity={0.85}
              style={styles.profileButton}
            >
              {avatarUrl ? (
                <Image
                  source={{ uri: avatarUrl }}
                  style={styles.profileAvatar}
                  contentFit="cover"
                />
              ) : (
                <Ionicons name="person-circle-outline" size={34} color={COLORS.primary} />
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.greetingBlock}>
            <Text style={styles.greeting}>{greeting.title}</Text>
            <Text style={styles.subGreeting}>{greeting.subtitle}</Text>
          </View>

          <SectionScroller
            title="Made for You"
            items={feed.madeForYou}
            emptyText="Your taste-based recommendations will appear here."
            onSeeAll={() =>
              navigation.navigate("SectionSongs", {
                sectionKey: "madeForYou",
                title: "Made for You",
              })
            }
            onPlay={playSong}
            loading={loading}
          />

          <SectionScroller
            title="Top Global"
            items={feed.charts.globalTop}
            emptyText="No top global songs yet."
            onSeeAll={() =>
              navigation.navigate("SectionSongs", {
                sectionKey: "globalTop",
                title: "Top Global",
              })
            }
            onPlay={playSong}
            loading={loading}
          />

          <SectionScroller
            title="Top India"
            items={feed.charts.topIndia}
            emptyText="No Top India songs yet."
            onSeeAll={() =>
              navigation.navigate("SectionSongs", {
                sectionKey: "topIndia",
                title: "Top India",
              })
            }
            onPlay={playSong}
            loading={loading}
          />

          <SectionScroller
            title="Trending Now"
            items={feed.charts.trendingNow}
            emptyText="No trending songs yet."
            onSeeAll={() =>
              navigation.navigate("SectionSongs", {
                sectionKey: "trendingNow",
                title: "Trending Now",
              })
            }
            onPlay={playSong}
            loading={loading}
          />

          <SectionScroller
            title="New Releases"
            items={feed.charts.newReleases}
            emptyText="No new releases yet."
            onSeeAll={() =>
              navigation.navigate("SectionSongs", {
                sectionKey: "newReleases",
                title: "New Releases",
              })
            }
            onPlay={playSong}
            loading={loading}
          />

          <SectionScroller
            title="Recently Played"
            items={feed.recentlyPlayed}
            emptyText="Your recent plays will appear here."
            onSeeAll={() =>
              navigation.navigate("SectionSongs", {
                sectionKey: "recentlyPlayed",
                title: "Recently Played",
              })
            }
            onPlay={playSong}
            loading={loading}
          />

          <View style={{ height: 24 }} />
        </ScrollView>
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
  },
  logoWrap: {
    alignItems: "flex-start",
    marginLeft: -2,
  },
  logo: {
    width: 78,
    height: 102,
  },
  profileButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: "hidden",
  },
  profileAvatar: {
    width: "100%",
    height: "100%",
    borderRadius: 21,
  },
  greetingBlock: {
    marginTop: 6,
    marginBottom: 14,
  },
  greeting: {
    fontSize: 32,
    fontWeight: "800",
    color: COLORS.text,
  },
  subGreeting: {
    marginTop: 6,
    fontSize: 17,
    lineHeight: 24,
    color: COLORS.text,
  },
  sectionHeader: {
    marginTop: 24,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: COLORS.primary,
  },
  seeAll: {
    color: COLORS.primary,
    fontWeight: "700",
  },
  horizontalList: {
    paddingTop: 14,
    paddingBottom: 4,
  },
  songCard: {
    width: 155,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 20,
    padding: 12,
    marginRight: 14,
  },
  songThumbWrap: {
    width: "100%",
    height: 120,
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 10,
    position: "relative",
  },
  songThumb: {
    width: "100%",
    height: "100%",
  },
  songThumbFallback: {
    width: "100%",
    height: "100%",
    backgroundColor: "#F4E6E0",
    alignItems: "center",
    justifyContent: "center",
  },
  likeButton: {
    position: "absolute",
    right: 8,
    top: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.92)",
    alignItems: "center",
    justifyContent: "center",
  },
  likeButtonActive: {
    backgroundColor: COLORS.primary,
  },
  playBadge: {
    position: "absolute",
    right: 8,
    bottom: 8,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  rankBadge: {
    position: "absolute",
    left: 8,
    top: 8,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: "rgba(255,255,255,0.92)",
  },
  rankText: {
    fontSize: 11,
    fontWeight: "800",
    color: COLORS.text,
  },
  songTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: COLORS.text,
  },
  songArtist: {
    marginTop: 4,
    fontSize: 13,
    color: COLORS.secondaryText,
  },
  moreButton: {
    alignSelf: "flex-end",
    marginTop: 8,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#F7EFEA",
    alignItems: "center",
    justifyContent: "center",
  },
  skeletonRow: {
    flexDirection: "row",
    paddingTop: 14,
    paddingBottom: 4,
  },
  skeletonCard: {
    width: 150,
    height: 200,
    borderRadius: 20,
    backgroundColor: COLORS.border,
    marginRight: 14,
  },
  emptyCard: {
    marginTop: 14,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 18,
    paddingVertical: 18,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    color: COLORS.secondaryText,
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
  },
});