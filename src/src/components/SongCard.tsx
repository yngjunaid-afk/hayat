import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";

import { COLORS } from "../constants/colors";
import { SongItem, formatDuration } from "../services/musicApi";

function normalizeArtworkUrl(url?: string) {
  if (!url) return undefined;

  const clean = url.trim();
  if (!clean) return undefined;

  if (/mzstatic/i.test(clean) || /apple/i.test(clean)) {
    return clean
      .replace(/100x100bb\.jpg/i, "600x600bb.jpg")
      .replace(/100x100\.jpg/i, "600x600.jpg")
      .replace(/200x200bb\.jpg/i, "600x600bb.jpg");
  }

  return clean;
}

function getSourceLabel(album?: string) {
  const clean = (album || "").trim();
  if (!clean) return "";

  if (
    /soundtrack|motion picture|original motion picture|from\s+/i.test(clean)
  ) {
    const source = clean.replace(/^from\s+/i, "").trim();
    return source ? `(from ${source})` : "";
  }

  return "";
}

export default function SongCard({
  song,
  onPress,
  showRankBadge = true,
}: {
  song: SongItem;
  onPress?: () => void;
  showRankBadge?: boolean;
}) {
  const thumbnail = normalizeArtworkUrl(song.thumbnail);
  const sourceLabel = getSourceLabel(song.album);

  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.9} onPress={onPress}>
      <View style={styles.imageWrap}>
        {thumbnail ? (
          <Image
            source={{ uri: thumbnail }}
            style={styles.image}
            contentFit="cover"
            transition={120}
          />
        ) : (
          <View style={styles.imageFallback}>
            <Ionicons name="musical-notes" size={24} color={COLORS.primary} />
          </View>
        )}

        {showRankBadge && typeof song.chartRank === "number" ? (
          <View style={styles.rankBadge}>
            <Text style={styles.rankText}>#{song.chartRank}</Text>
          </View>
        ) : null}
      </View>

      <Text style={styles.title} numberOfLines={1}>
        {song.title}
      </Text>

      <Text style={styles.artist} numberOfLines={1}>
        {song.artist}
      </Text>

      {sourceLabel ? (
        <Text style={styles.source} numberOfLines={1}>
          {sourceLabel}
        </Text>
      ) : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 150,
    marginRight: 15,
  },
  imageWrap: {
    position: "relative",
  },
  image: {
    width: 150,
    height: 150,
    borderRadius: 20,
    backgroundColor: "#F4E6E0",
  },
  imageFallback: {
    width: 150,
    height: 150,
    borderRadius: 20,
    backgroundColor: "#F4E6E0",
    alignItems: "center",
    justifyContent: "center",
  },
  rankBadge: {
    position: "absolute",
    top: 8,
    left: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.92)",
  },
  rankText: {
    fontSize: 11,
    fontWeight: "800",
    color: COLORS.text,
  },
  title: {
    marginTop: 8,
    fontWeight: "800",
    fontSize: 15,
    color: COLORS.primary,
  },
  artist: {
    color: COLORS.secondaryText,
    marginTop: 3,
    fontSize: 13,
    fontWeight: "600",
  },
  source: {
    color: COLORS.secondaryText,
    marginTop: 2,
    fontSize: 12,
    fontStyle: "italic",
  },
});