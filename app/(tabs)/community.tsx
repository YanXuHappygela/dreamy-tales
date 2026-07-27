import React, { useCallback, useState } from "react";
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  Platform, Alert, TextInput, Modal, KeyboardAvoidingView,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";

import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { trpc } from "@/lib/trpc";
import { SavedStory, GeneratedStory } from "@/shared/types";
import { STORIES_STORAGE_KEY } from "@/shared/const";

const Y = "#FFD580";
const Y_DIM = "#3D3010";

const STYLE_EMOJIS: Record<string, string> = {
  Funny: "😄", Magical: "✨", Adventurous: "🗺️",
  Cozy: "🛋️", Mysterious: "🔮", Silly: "🤪",
};
const CHAR_EMOJIS: Record<string, string> = {
  Bunny: "🐰", Dragon: "🐉", Princess: "👸", Robot: "🤖",
  Unicorn: "🦄", Bear: "🐻", "Race Car": "🏎️", Dolphin: "🐬",
};
const LANG_FLAGS: Record<string, string> = {
  English: "🇬🇧", Mandarin: "🇨🇳", Spanish: "🇪🇸",
};

interface CommunityPost {
  id: number;
  authorName: string;
  title: string;
  characterType: string;
  scenario: string;
  style: string;
  language: string;
  lengthMinutes: number;
  storyJson: GeneratedStory;
  downloadCount: number;
  createdAt: Date | string;
}

export default function CommunityScreen() {
  const router = useRouter();
  const [shareModalVisible, setShareModalVisible] = useState(false);
  const [authorName, setAuthorName] = useState("");
  const [selectedStory, setSelectedStory] = useState<SavedStory | null>(null);
  const [savedStories, setSavedStories] = useState<SavedStory[]>([]);
  const [downloadedIds, setDownloadedIds] = useState<Set<number>>(new Set());

  const { data, isLoading, refetch } = trpc.community.list.useQuery(
    { limit: 50 },
    { staleTime: 30_000 }
  );

  const postMutation = trpc.community.post.useMutation({
    onSuccess: () => {
      setShareModalVisible(false);
      setSelectedStory(null);
      setAuthorName("");
      refetch();
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Shared! 🌟", "Your story has been posted to the community.");
    },
    onError: () => Alert.alert("Error", "Could not share the story. Please try again."),
  });

  const downloadMutation = trpc.community.download.useMutation();

  const posts: CommunityPost[] = (data?.posts ?? []) as unknown as CommunityPost[];

  // Load saved stories for the share picker
  useFocusEffect(
    useCallback(() => {
      AsyncStorage.getItem(STORIES_STORAGE_KEY).then((raw) => {
        if (raw) setSavedStories(JSON.parse(raw));
      }).catch(() => {});
    }, [])
  );

  const handleOpenShareModal = () => {
    if (savedStories.length === 0) {
      Alert.alert("No stories yet", "Generate and save a story first, then share it here.");
      return;
    }
    setSelectedStory(savedStories[0]);
    setShareModalVisible(true);
  };

  const handleShare = () => {
    if (!selectedStory) return;
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    postMutation.mutate({
      authorName: authorName.trim() || "Anonymous",
      storyJson: selectedStory,
    });
  };

  const handleDownload = async (post: CommunityPost) => {
    if (downloadedIds.has(post.id)) {
      Alert.alert("Already saved", "This story is already in your library.");
      return;
    }
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    try {
      const raw = await AsyncStorage.getItem(STORIES_STORAGE_KEY);
      const existing: SavedStory[] = raw ? JSON.parse(raw) : [];
      const story = post.storyJson;
      // Avoid duplicates by story id
      if (existing.some((s) => s.id === story.id)) {
        Alert.alert("Already saved", "This story is already in your library.");
        return;
      }
      const saved: SavedStory = { ...story, savedAt: new Date().toISOString() };
      await AsyncStorage.setItem(STORIES_STORAGE_KEY, JSON.stringify([saved, ...existing]));
      setDownloadedIds((prev) => new Set([...prev, post.id]));
      downloadMutation.mutate({ id: post.id });
      Alert.alert("Saved! 📚", `"${post.title}" has been added to My Stories.`);
    } catch {
      Alert.alert("Error", "Could not save the story.");
    }
  };

  const handleOpenStory = (post: CommunityPost) => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({
      pathname: "/story",
      params: { storyData: JSON.stringify(post.storyJson) },
    } as any);
  };

  const formatDate = (iso: Date | string) =>
    new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });

  return (
    <ScreenContainer containerClassName="bg-background" safeAreaClassName="">
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Community</Text>
          <Text style={styles.headerSub}>Stories shared by parents worldwide</Text>
        </View>
        <TouchableOpacity style={styles.shareBtn} onPress={handleOpenShareModal} activeOpacity={0.8}>
          <IconSymbol name="paperplane.fill" size={16} color="#0D0B2B" />
          <Text style={styles.shareBtnText}>Share</Text>
        </TouchableOpacity>
      </View>

      {/* Story list */}
      {isLoading ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyEmoji}>🌙</Text>
          <Text style={styles.emptyText}>Loading stories…</Text>
        </View>
      ) : posts.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyEmoji}>📖</Text>
          <Text style={styles.emptyTitle}>No stories yet</Text>
          <Text style={styles.emptyText}>Be the first to share a story with the community!</Text>
        </View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            const isDownloaded = downloadedIds.has(item.id);
            return (
              <TouchableOpacity
                style={styles.card}
                onPress={() => handleOpenStory(item)}
                activeOpacity={0.75}
              >
                {/* Left emoji */}
                <View style={styles.cardLeft}>
                  <Text style={styles.cardEmoji}>
                    {CHAR_EMOJIS[item.characterType] || "📖"}
                  </Text>
                </View>

                {/* Content */}
                <View style={styles.cardContent}>
                  <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
                  <Text style={styles.cardMeta}>
                    {STYLE_EMOJIS[item.style] || "✨"} {item.style} · {item.scenario} · {item.lengthMinutes} min
                  </Text>
                  <View style={styles.cardFooter}>
                    <Text style={styles.cardAuthor}>by {item.authorName}</Text>
                    <Text style={styles.cardDate}>
                      {LANG_FLAGS[item.language] || "🌐"} {formatDate(item.createdAt)}
                    </Text>
                  </View>
                  {item.downloadCount > 0 && (
                    <Text style={styles.cardDownloads}>⬇ {item.downloadCount} saved</Text>
                  )}
                </View>

                {/* Download button */}
                <TouchableOpacity
                  style={[styles.downloadBtn, isDownloaded && styles.downloadBtnDone]}
                  onPress={() => handleDownload(item)}
                  activeOpacity={0.7}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={[styles.downloadIcon, isDownloaded && styles.downloadIconDone]}>
                    {isDownloaded ? "✓" : "⬇"}
                  </Text>
                </TouchableOpacity>
              </TouchableOpacity>
            );
          }}
        />
      )}

      {/* Share Modal */}
      <Modal
        visible={shareModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setShareModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalOverlay}
        >
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Share to Community</Text>
            <Text style={styles.modalSub}>Choose a story to share with other parents</Text>

            {/* Story picker */}
            <Text style={styles.fieldLabel}>Story</Text>
            <View style={styles.storyPickerScroll}>
              {savedStories.map((s) => (
                <TouchableOpacity
                  key={s.id}
                  style={[styles.storyPickerItem, selectedStory?.id === s.id && styles.storyPickerItemSelected]}
                  onPress={() => setSelectedStory(s)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.storyPickerText, selectedStory?.id === s.id && styles.storyPickerTextSelected]} numberOfLines={1}>
                    {CHAR_EMOJIS[s.config.characterType] || "📖"} {s.title}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Author name */}
            <Text style={styles.fieldLabel}>Your name (optional)</Text>
            <TextInput
              style={styles.textInput}
              placeholder="e.g. Sarah's Dad, Anonymous…"
              placeholderTextColor="#4A4270"
              value={authorName}
              onChangeText={setAuthorName}
              maxLength={80}
              returnKeyType="done"
            />

            {/* Buttons */}
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setShareModalVisible(false)}
                activeOpacity={0.7}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmBtn, postMutation.isPending && { opacity: 0.6 }]}
                onPress={handleShare}
                disabled={postMutation.isPending || !selectedStory}
                activeOpacity={0.8}
              >
                <Text style={styles.confirmBtnText}>
                  {postMutation.isPending ? "Sharing…" : "Share Story"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16, backgroundColor: "#0D0B2B" },
  headerTitle: { fontSize: 28, fontWeight: "800", color: "#F0EAF8" },
  headerSub: { fontSize: 13, color: "#9B8BB4", marginTop: 2 },
  shareBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: Y, borderRadius: 14, paddingVertical: 9, paddingHorizontal: 14, elevation: 4 },
  shareBtnText: { fontSize: 14, fontWeight: "700", color: "#0D0B2B" },
  listContent: { paddingHorizontal: 20, paddingBottom: 40 },
  card: { flexDirection: "row", alignItems: "flex-start", backgroundColor: "#1A1740", borderRadius: 18, padding: 16, marginBottom: 12, borderWidth: 1.5, borderColor: "#2E2A5A" },
  cardLeft: { width: 48, height: 48, borderRadius: 14, backgroundColor: Y_DIM, alignItems: "center", justifyContent: "center", marginRight: 14, flexShrink: 0 },
  cardEmoji: { fontSize: 24 },
  cardContent: { flex: 1 },
  cardTitle: { fontSize: 15, fontWeight: "700", color: "#F0EAF8", marginBottom: 5, lineHeight: 20 },
  cardMeta: { fontSize: 13, color: "#9B8BB4", marginBottom: 4 },
  cardFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardAuthor: { fontSize: 12, color: "#4A4270", fontStyle: "italic" },
  cardDate: { fontSize: 12, color: "#4A4270" },
  cardDownloads: { fontSize: 12, color: "#9B8BB4", marginTop: 4 },
  downloadBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: Y, alignItems: "center", justifyContent: "center", marginLeft: 10, flexShrink: 0, elevation: 4 },
  downloadBtnDone: { backgroundColor: "#2E2A5A" },
  downloadIcon: { fontSize: 16, color: "#0D0B2B", fontWeight: "700" },
  downloadIconDone: { color: "#9B8BB4" },
  emptyContainer: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32, backgroundColor: "#0D0B2B" },
  emptyEmoji: { fontSize: 56, marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: "700", color: "#F0EAF8", marginBottom: 8 },
  emptyText: { fontSize: 15, color: "#9B8BB4", textAlign: "center", lineHeight: 22 },
  // Modal
  modalOverlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.6)" },
  modalSheet: { backgroundColor: "#1A1740", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: Platform.OS === "ios" ? 40 : 24 },
  modalTitle: { fontSize: 22, fontWeight: "800", color: "#F0EAF8", marginBottom: 4 },
  modalSub: { fontSize: 14, color: "#9B8BB4", marginBottom: 20 },
  fieldLabel: { fontSize: 13, fontWeight: "600", color: "#9B8BB4", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 8 },
  storyPickerScroll: { maxHeight: 160, gap: 8, marginBottom: 20 },
  storyPickerItem: { backgroundColor: "#120F35", borderRadius: 12, borderWidth: 1.5, borderColor: "#2E2A5A", paddingHorizontal: 14, paddingVertical: 10 },
  storyPickerItemSelected: { borderColor: Y, backgroundColor: Y_DIM },
  storyPickerText: { fontSize: 14, color: "#9B8BB4", fontWeight: "500" },
  storyPickerTextSelected: { color: Y, fontWeight: "700" },
  textInput: { backgroundColor: "#120F35", borderRadius: 14, borderWidth: 1.5, borderColor: "#2E2A5A", paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, color: "#F0EAF8", marginBottom: 24 },
  modalButtons: { flexDirection: "row", gap: 12 },
  cancelBtn: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#120F35", borderRadius: 16, paddingVertical: 14, borderWidth: 1.5, borderColor: "#2E2A5A" },
  cancelBtnText: { fontSize: 16, fontWeight: "600", color: "#9B8BB4" },
  confirmBtn: { flex: 2, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8, backgroundColor: Y, borderRadius: 16, paddingVertical: 14, elevation: 6 },
  confirmBtnText: { fontSize: 16, fontWeight: "700", color: "#0D0B2B" },
});
