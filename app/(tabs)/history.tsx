import React, { useCallback, useState } from "react";
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, Alert, Platform,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";

import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { SavedStory } from "@/shared/types";
import { STORIES_STORAGE_KEY } from "@/shared/const";
import { saveActiveStory } from "@/lib/story-navigation";

const Y = "#FFD580";
const Y_DIM = "#3D3010";

const CHARACTER_EMOJIS: Record<string, string> = {
  Bunny: "🐰", Dragon: "🐉", Princess: "👸", Robot: "🤖", Unicorn: "🦄", Bear: "🐻",
  "Race Car": "🏎️", Dolphin: "🐬",
};
const STYLE_EMOJIS: Record<string, string> = {
  Funny: "😄", Magical: "✨", Adventurous: "🗺️", Cozy: "🛋️", Mysterious: "🔮",
};

export default function HistoryScreen() {
  const router = useRouter();
  const [stories, setStories] = useState<SavedStory[]>([]);

  const loadStories = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(STORIES_STORAGE_KEY);
      if (raw) {
        setStories(
          (JSON.parse(raw) as SavedStory[]).sort(
            (a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime()
          )
        );
      } else { setStories([]); }
    } catch { setStories([]); }
  }, []);

  useFocusEffect(useCallback(() => { loadStories(); }, [loadStories]));

  const handleDelete = (story: SavedStory) => {
    Alert.alert("Delete Story", `Remove "${story.title}" from your library?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive",
        onPress: async () => {
          if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          try {
            const updated = stories.filter((s) => s.id !== story.id);
            await AsyncStorage.setItem(STORIES_STORAGE_KEY, JSON.stringify(updated));
            setStories(updated);
          } catch { /**/ }
        },
      },
    ]);
  };

  const handleOpen = async (story: SavedStory) => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const storyId = await saveActiveStory(story);
      router.push({ pathname: "/story", params: { storyId } } as any);
    } catch {
      Alert.alert("Could not open story", "Please try again.");
    }
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  if (stories.length === 0) {
    return (
      <ScreenContainer containerClassName="bg-background" safeAreaClassName="">
        <View style={styles.header}>
          <Text style={styles.headerTitle}>My Stories</Text>
        </View>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyEmoji}>📚</Text>
          <Text style={styles.emptyTitle}>No stories saved yet</Text>
          <Text style={styles.emptySubtitle}>Generate a story and tap the heart to save it here.</Text>
          <TouchableOpacity style={styles.createBtn} onPress={() => router.push("/config" as any)} activeOpacity={0.8}>
            <Text style={styles.createBtnText}>Create a Story</Text>
          </TouchableOpacity>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer containerClassName="bg-background" safeAreaClassName="">
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Stories</Text>
        <Text style={styles.headerCount}>{stories.length} saved</Text>
      </View>
      <FlatList
        data={stories}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.card} onPress={() => handleOpen(item)} activeOpacity={0.75}>
            <View style={styles.cardLeft}>
              <Text style={styles.cardEmoji}>{CHARACTER_EMOJIS[item.config.characterType] || "📖"}</Text>
            </View>
            <View style={styles.cardContent}>
              <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
              <Text style={styles.cardMeta}>{STYLE_EMOJIS[item.config.style] || "✨"} {item.config.style} • {item.config.scenario} • {item.config.lengthMinutes} min</Text>
              <Text style={styles.cardDate}>{formatDate(item.savedAt)}</Text>
            </View>
            <TouchableOpacity
              style={styles.deleteBtn}
              onPress={() => handleDelete(item)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              activeOpacity={0.5}
            >
              <IconSymbol name="trash.fill" size={16} color="#9B8BB4" />
            </TouchableOpacity>
          </TouchableOpacity>
        )}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16, backgroundColor: "#0D0B2B" },
  headerTitle: { fontSize: 28, fontWeight: "800", color: "#F0EAF8" },
  headerCount: { fontSize: 14, color: "#9B8BB4", fontWeight: "500" },
  listContent: { paddingHorizontal: 20, paddingBottom: 40 },
  card: { flexDirection: "row", alignItems: "center", backgroundColor: "#1A1740", borderRadius: 18, padding: 16, marginBottom: 12, borderWidth: 1.5, borderColor: Y },
  cardLeft: { width: 52, height: 52, borderRadius: 14, backgroundColor: Y_DIM, alignItems: "center", justifyContent: "center", marginRight: 14 },
  cardEmoji: { fontSize: 26 },
  cardContent: { flex: 1 },
  cardTitle: { fontSize: 15, fontWeight: "700", color: "#F0EAF8", marginBottom: 5, lineHeight: 20 },
  cardMeta: { fontSize: 13, color: "#9B8BB4", marginBottom: 4 },
  cardDate: { fontSize: 12, color: "#4A4270" },
  deleteBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: "#120F35", alignItems: "center", justifyContent: "center", marginLeft: 8 },
  emptyContainer: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32, backgroundColor: "#0D0B2B" },
  emptyEmoji: { fontSize: 64, marginBottom: 20 },
  emptyTitle: { fontSize: 22, fontWeight: "700", color: "#F0EAF8", marginBottom: 10 },
  emptySubtitle: { fontSize: 15, color: "#9B8BB4", textAlign: "center", lineHeight: 22, marginBottom: 32 },
  createBtn: { backgroundColor: Y, borderRadius: 16, paddingVertical: 14, paddingHorizontal: 28, elevation: 6 },
  createBtnText: { fontSize: 16, fontWeight: "700", color: "#0D0B2B" },
});
