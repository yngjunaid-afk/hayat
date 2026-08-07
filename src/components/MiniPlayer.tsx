import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
} from "react-native";
import Slider from "@react-native-community/slider";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";

import { COLORS } from "../constants/colors";
import { usePlayer } from "../context/PlayerContext";
import { SongItem } from "../services/musicApi";

const LIKED_SONGS_KEY_PREFIX = "hayat_liked_songs_v1_";

function normalizeArtworkUrl(url?: string) {
  if (!url) return undefined;
  const clean = url.trim();
  if (!clean) return undefined;

  if (/mzstatic/i.test(clean) || /apple/i.test(clean)) {
    return clean
      .replace(/100x100bb\.jpg/i, "300x300bb.jpg")
      .replace(/100x100\.jpg/i, "300x300.jpg")
      .replace(/200x200bb\.jpg/i, "300x300bb.jpg");
  }

  return clean;
}

function normalizeUserId(userId: string) {
  return userId.trim() || "guest";
}

async function readLikedSongs(userId: string): Promise<SongItem[]> {
  const key = `${LIKED_SONGS_KEY_PREFIX}${normalizeUserId(userId)}`;
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is SongItem => {
      return !!item && typeof item === "object" && typeof (item as any).id === "string";
    });
  } catch {
    return [];
  }
}

async function writeLikedSongs(userId: string, songs: SongItem[]) {
  const key = `${LIKED_SONGS_KEY_PREFIX}${normalizeUserId(userId)}`;
  try {
    await AsyncStorage.setItem(key, JSON.stringify(songs));
  } catch {
    // ignore
  }
}

export default function MiniPlayer() {
  const player = usePlayer();
  const song = player.currentSong;
  const [liked, setLiked] = useState(false);
  const [measured, setMeasured] = useState(false);
  const [visibleAnim] = useState(new Animated.Value(0));
  const [width, setWidth] = useState(1);
  const seekingRef = useRef(false);

  useEffect(() => {
    Animated.timing(visibleAnim, {
      toValue: song ? 1 : 0,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [song, visibleAnim]);

  useEffect(() => {
    const load = async () => {
      if (!song) {
        setLiked(false);
        return;
      }
      const userId = "guest";
      const likedSongs = await readLikedSongs(userId);
      setLiked(likedSongs.some((item) => item.id === song.id));
    };

    void load();
  }, [song]);

  if (!song) return null;

  const progress =
    player.duration > 0 ? Math.min(player.position / player.duration, 1) : 0;

  const thumbnail = normalizeArtworkUrl(song.thumbnail);

  const toggleLike = async () => {
    const userId = "guest";
    const likedSongs = await readLikedSongs(userId);
    const exists = likedSongs.some((item) => item.id === song.id);

    const next = exists
      ? likedSongs.filter((item) => item.id !== song.id)
      : [song, ...likedSongs];

    await writeLikedSongs(userId, next);
    setLiked(!exists);
  };

  const seekFromX = async (x: number) => {
    const next = Math.max(0, Math.min(1, x / width));
    await player.seekTo(Math.round(next * player.duration));
  };

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.container,
        {
          opacity: visibleAnim,
          transform: [
            {
              translateY: visibleAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [22, 0],
              }),
            },
          ],
        },
      ]}
    >
      <View style={styles.card} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        <View style={styles.topRow}>
          <View style={styles.left}>
            {thumbnail ? (
              <Image
                source={{ uri: thumbnail }}
                style={styles.thumb}
                contentFit="cover"
              />
            ) : (
              <View style={styles.thumbFallback}>
                <Ionicons name="musical-notes" size={18} color={COLORS.primary} />
              </View>
            )}

            <View style={styles.meta}>
              <Text style={styles.title} numberOfLines={1}>
                {song.title}
              </Text>
              <Text style={styles.artist} numberOfLines={1}>
                {song.artist}
              </Text>
            </View>
          </View>

          <View style={styles.right}>
            <TouchableOpacity
              onPress={toggleLike}
              style={[styles.likeButton, liked && styles.likeButtonActive]}
              activeOpacity={0.85}
            >
              <Ionicons
                name={liked ? "heart" : "heart-outline"}
                size={18}
                color={liked ? "#fff" : COLORS.primary}
              />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={player.toggle}
              style={styles.iconButton}
              activeOpacity={0.85}
            >
              <Ionicons
                name={player.isPlaying ? "pause" : "play"}
                size={18}
                color="#fff"
              />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.sliderWrap}>
          <Slider
            style={styles.slider}
            minimumValue={0}
            maximumValue={1}
            value={progress}
            minimumTrackTintColor={COLORS.primary}
            maximumTrackTintColor="#EFE5E0"
            thumbTintColor={COLORS.primary}
            onSlidingStart={() => {
              seekingRef.current = true;
            }}
            onValueChange={async (value) => {
              if (!player.duration) return;
              const target = Math.round(value * player.duration);
              await player.seekTo(target);
            }}
            onSlidingComplete={async (value) => {
              seekingRef.current = false;
              if (!player.duration) return;
              const target = Math.round(value * player.duration);
              await player.seekTo(target);
            }}
          />
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 82,
    zIndex: 50,
  },
  card: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 24,
    padding: 12,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  left: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    paddingRight: 10,
  },
  thumb: {
    width: 52,
    height: 52,
    borderRadius: 16,
    marginRight: 12,
    backgroundColor: "#F4E6E0",
  },
  thumbFallback: {
    width: 52,
    height: 52,
    borderRadius: 16,
    marginRight: 12,
    backgroundColor: "#F4E6E0",
    alignItems: "center",
    justifyContent: "center",
  },
  meta: {
    flex: 1,
  },
  title: {
    fontSize: 15,
    fontWeight: "800",
    color: COLORS.text,
  },
  artist: {
    marginTop: 2,
    fontSize: 13,
    color: COLORS.secondaryText,
  },
  right: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  likeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F4E6E0",
    alignItems: "center",
    justifyContent: "center",
  },
  likeButtonActive: {
    backgroundColor: COLORS.primary,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  sliderWrap: {
    marginTop: 8,
  },
  slider: {
    width: "100%",
    height: 18,
  },
});