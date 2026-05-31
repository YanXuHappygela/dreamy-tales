import React, { useCallback, useState } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Platform,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";

import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { StarfieldBackground } from "@/components/starfield-background";
import { SavedStory } from "@/shared/types";
import { STORIES_STORAGE_KEY } from "@/shared/const";

const Y = "#FFD580";
const Y_DIM = "#3D3010";

const CHARACTER_EMOJIS: Record<string, string> = {
  Bunny: "🐰", Dragon: "🐉", Princess: "👸",
  Robot: "🤖", Unicorn: "🦄", Bear: "🐻",
  "Race Car": "🏎️", Dolphin: "🐬",
};
const SCENARIO_EMOJIS: Record<string, string> = {
  Forest: "🌲", Space: "🚀", Ocean: "🌊",
  Castle: "🏰", Jungle: "🌴", "Cloud Kingdom": "☁️",
};

export default function HomeScreen() {
  const router = useRouter();
  const [recentStories, setRecentStories] = useState<SavedStory[]>([]);

  const loadRecentStories = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(STORIES_STORAGE_KEY);
      if (raw) {
        setRecentStories(
          (JSON.parse(raw) as SavedStory[])
            .sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime())
            .slice(0, 3)
        );
      }
    } catch { /**/ }
  }, []);

  useFocusEffect(useCallback(() => { loadRecentStories(); }, [loadRecentStories]));

  const handleCreateStory = () => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push("/config" as any);
  };

  const handleOpenStory = (story: SavedStory) => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({ pathname: "/story", params: { storyData: JSON.stringify(story) } } as any);
  };

  return (
    <ScreenContainer containerClassName="bg-background" safeAreaClassName="">
      <StarfieldBackground />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.moonContainer}>
            <Text style={styles.moonEmoji}>🌙</Text>
            <View style={styles.starRow}>
              <Text style={styles.starEmoji}>✨</Text>
              <Text style={styles.starEmoji}>⭐</Text>
              <Text style={styles.starEmoji}>✨</Text>
            </View>
          </View>
          <Text style={styles.appTitle}>Dreamy Tales</Text>
          <Text style={styles.appSubtitle}>Magical bedtime stories, just for you</Text>
        </View>

        {/* Create Story Button */}
        <TouchableOpacity style={styles.createButton} onPress={handleCreateStory} activeOpacity={0.8}>
          <IconSymbol name="wand.and.stars" size={24} color="#0D0B2B" />
          <Text style={styles.createButtonText}>Create a Story</Text>
        </TouchableOpacity>

        {/* Recent Stories */}
        {recentStories.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recent Stories</Text>
            {recentStories.map((story) => (
              <TouchableOpacity
                key={story.id}
                style={styles.storyCard}
                onPress={() => handleOpenStory(story)}
                activeOpacity={0.75}
              >
                <View style={styles.storyCardLeft}>
                  <Text style={styles.storyCardEmoji}>
                    {CHARACTER_EMOJIS[story.config.characterType] || "📖"}
                  </Text>
                </View>
                <View style={styles.storyCardContent}>
                  <Text style={styles.storyCardTitle} numberOfLines={1}>{story.title}</Text>
                  <Text style={styles.storyCardMeta}>
                    {SCENARIO_EMOJIS[story.config.scenario] || "🌟"}{" "}
                    {story.config.scenario} • {story.config.lengthMinutes} min
                  </Text>
                </View>
                <IconSymbol name="chevron.right" size={18} color="#9B8BB4" />
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Empty state */}
        {recentStories.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateEmoji}>📖</Text>
            <Text style={styles.emptyStateText}>
              No stories yet! Tap the button above to create your first magical bedtime story.
            </Text>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: "transparent", zIndex: 1, elevation: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 20 },
  header: { alignItems: "center", paddingVertical: 32 },
  moonContainer: { alignItems: "center", marginBottom: 16 },
  moonEmoji: { fontSize: 72, lineHeight: 88 },
  starRow: { flexDirection: "row", gap: 8, marginTop: 4 },
  starEmoji: { fontSize: 20 },
  appTitle: { fontSize: 34, fontWeight: "800", color: "#F0EAF8", letterSpacing: 0.5, marginBottom: 8 },
  appSubtitle: { fontSize: 16, color: "#9B8BB4", textAlign: "center", lineHeight: 22 },
  createButton: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
    backgroundColor: Y, borderRadius: 20, paddingVertical: 18, paddingHorizontal: 32,
    marginBottom: 36, elevation: 8,
  },
  createButtonText: { fontSize: 18, fontWeight: "700", color: "#0D0B2B" },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 20, fontWeight: "700", color: "#F0EAF8", marginBottom: 14 },
  storyCard: {
    flexDirection: "row", alignItems: "center", backgroundColor: "#1A1740",
    borderRadius: 16, padding: 16, marginBottom: 10, borderWidth: 1.5, borderColor: Y,
  },
  storyCardLeft: { width: 44, height: 44, borderRadius: 12, backgroundColor: Y_DIM, alignItems: "center", justifyContent: "center", marginRight: 12 },
  storyCardEmoji: { fontSize: 22 },
  storyCardContent: { flex: 1 },
  storyCardTitle: { fontSize: 15, fontWeight: "600", color: "#F0EAF8", marginBottom: 4 },
  storyCardMeta: { fontSize: 13, color: "#9B8BB4" },
  emptyState: { alignItems: "center", paddingVertical: 40, paddingHorizontal: 24 },
  emptyStateEmoji: { fontSize: 48, marginBottom: 16 },
  emptyStateText: { fontSize: 15, color: "#9B8BB4", textAlign: "center", lineHeight: 22 },
});
