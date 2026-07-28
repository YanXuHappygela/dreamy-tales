import React, { useCallback, useState, useMemo } from "react";
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  Platform, Alert, TextInput, Modal, KeyboardAvoidingView,
  ScrollView,
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
const SHARED_IDS_KEY = "dreamy_tales_shared_ids";
const LIKED_IDS_KEY = "dreamy_tales_liked_ids";

const STYLE_EMOJIS: Record<string, string> = {
  Funny: "😄", Magical: "✨", Adventurous: "🗺️",
  Cozy: "🛋️", Mysterious: "🔮", Silly: "🤪",
};
const CHAR_EMOJIS: Record<string, string> = {
  Bunny: "🐰", Dragon: "🐉", Princess: "👸", Robot: "🤖",
  Unicorn: "🦄", Bear: "🐻", "Race Car": "🏎️", Dolphin: "🐬",
};

const ALL_LANGUAGES = ["All", "English", "Mandarin", "Spanish"];
const ALL_STYLES = ["All", "Funny", "Magical", "Adventurous", "Cozy", "Mysterious", "Silly"];
const ALL_CHARS = [
  "All", "Bunny", "Dragon", "Princess", "Robot",
  "Unicorn", "Bear", "Race Car", "Dolphin", "Custom",
];

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
  likeCount: number;
  createdAt: Date | string;
}

export default function CommunityScreen() {
  const router = useRouter();
  const [shareModalVisible, setShareModalVisible] = useState(false);
  const [authorName, setAuthorName] = useState("");
  const [selectedStory, setSelectedStory] = useState<SavedStory | null>(null);
  const [savedStories, setSavedStories] = useState<SavedStory[]>([]);
  const [downloadedIds, setDownloadedIds] = useState<Set<number>>(new Set());
  const [sharedStoryIds, setSharedStoryIds] = useState<Set<string>>(new Set());
  const [likedPostIds, setLikedPostIds] = useState<Set<number>>(new Set());

  // Search and filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [filterLang, setFilterLang] = useState("All");
  const [filterStyle, setFilterStyle] = useState("All");
  const [filterChar, setFilterChar] = useState("All");

  const { data, isLoading, refetch } = trpc.community.list.useQuery(
    { limit: 200 },
    { staleTime: 0 }
  );

  const postMutation = trpc.community.post.useMutation({
    onSuccess: async () => {
      if (selectedStory) {
        try {
          const raw = await AsyncStorage.getItem(SHARED_IDS_KEY);
          const ids: string[] = raw ? JSON.parse(raw) : [];
          if (!ids.includes(selectedStory.id)) {
            const updated = [...ids, selectedStory.id];
            await AsyncStorage.setItem(SHARED_IDS_KEY, JSON.stringify(updated));
            setSharedStoryIds(new Set(updated));
          }
        } catch { /**/ }
      }
      setShareModalVisible(false);
      setSelectedStory(null);
      setAuthorName("");
      refetch();
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Shared! 🌟", "Your story has been posted to the community.");
    },
    onError: (err) => Alert.alert("Error", err.message || "Could not share the story."),
  });

  const downloadMutation = trpc.community.download.useMutation();
  const likeMutation = trpc.community.like.useMutation();

  const allPosts: CommunityPost[] = (data?.posts ?? []) as unknown as CommunityPost[];

  // Apply search + filters, then sort by likeCount desc
  const posts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return allPosts
      .filter((p) => {
        if (filterLang !== "All" && p.language !== filterLang) return false;
        if (filterStyle !== "All" && p.style !== filterStyle) return false;
        if (filterChar !== "All" && p.characterType !== filterChar) return false;
        if (q) {
          const haystack = [
            p.title, p.authorName, p.characterType, p.scenario, p.style, p.language,
            ...(p.storyJson?.paragraphs ?? []),
          ].join(" ").toLowerCase();
          if (!haystack.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => (b.likeCount ?? 0) - (a.likeCount ?? 0));
  }, [allPosts, searchQuery, filterLang, filterStyle, filterChar]);

  useFocusEffect(
    useCallback(() => {
      refetch();
      AsyncStorage.getItem(STORIES_STORAGE_KEY).then((raw) => {
        if (raw) setSavedStories(JSON.parse(raw));
      }).catch(() => {});
      AsyncStorage.getItem(SHARED_IDS_KEY).then((raw) => {
        if (raw) setSharedStoryIds(new Set(JSON.parse(raw)));
      }).catch(() => {});
      AsyncStorage.getItem(LIKED_IDS_KEY).then((raw) => {
        if (raw) setLikedPostIds(new Set(JSON.parse(raw)));
      }).catch(() => {});
    }, [refetch])
  );

  const unsharableStories = savedStories.filter((s) => !sharedStoryIds.has(s.id));

  const handleOpenShareModal = () => {
    if (savedStories.length === 0) {
      Alert.alert("No stories yet", "Generate and save a story first, then share it here.");
      return;
    }
    if (unsharableStories.length === 0) {
      Alert.alert("All shared", "All your saved stories have already been shared to the community.");
      return;
    }
    setSelectedStory(unsharableStories[0]);
    setShareModalVisible(true);
  };

  const handleShare = () => {
    if (!selectedStory) return;
    if (sharedStoryIds.has(selectedStory.id)) {
      Alert.alert("Already shared", "This story has already been shared to the community.");
      return;
    }
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    postMutation.mutate({ authorName: authorName.trim() || "Anonymous", storyJson: selectedStory });
  };

  const handleLike = async (post: CommunityPost) => {
    if (likedPostIds.has(post.id)) return;
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const raw = await AsyncStorage.getItem(LIKED_IDS_KEY);
      const ids: number[] = raw ? JSON.parse(raw) : [];
      const updated = [...ids, post.id];
      await AsyncStorage.setItem(LIKED_IDS_KEY, JSON.stringify(updated));
      setLikedPostIds(new Set(updated));
      likeMutation.mutate({ id: post.id });
      refetch();
    } catch { /**/ }
  };

  const handleDownload = async (post: CommunityPost) => {
    if (downloadedIds.has(post.id)) { Alert.alert("Already saved", "This story is already in your library."); return; }
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    try {
      const raw = await AsyncStorage.getItem(STORIES_STORAGE_KEY);
      const existing: SavedStory[] = raw ? JSON.parse(raw) : [];
      const story = post.storyJson;
      if (existing.some((s) => s.id === story.id)) { Alert.alert("Already saved", "This story is already in your library."); return; }
      const saved: SavedStory = { ...story, savedAt: new Date().toISOString() };
      await AsyncStorage.setItem(STORIES_STORAGE_KEY, JSON.stringify([saved, ...existing]));
      setDownloadedIds((prev) => new Set([...prev, post.id]));
      downloadMutation.mutate({ id: post.id });
      Alert.alert("Saved! 📚", `"${post.title}" has been added to My Stories.`);
    } catch { Alert.alert("Error", "Could not save the story."); }
  };

  const handleOpenStory = (post: CommunityPost) => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({ pathname: "/story", params: { storyData: JSON.stringify(post.storyJson) } } as any);
  };

  const formatDate = (iso: Date | string) =>
    new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });

  /** Display name: author name or "Magical" if anonymous/empty */
  const displayAuthor = (name: string) => {
    const n = name?.trim();
    return n && n.toLowerCase() !== "anonymous" ? n : "Magical";
  };

  const FilterChips = ({ options, value, onChange }: { options: string[]; value: string; onChange: (v: string) => void }) => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
      {options.map((opt) => (
        <TouchableOpacity
          key={opt}
          style={[styles.filterChip, value === opt && styles.filterChipSelected]}
          onPress={() => { if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onChange(opt); }}
          activeOpacity={0.7}
        >
          <Text style={[styles.filterChipText, value === opt && styles.filterChipTextSelected]}>{opt}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );

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

      {/* Search bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search stories, characters, settings…"
            placeholderTextColor="#4A4270"
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={styles.searchClear}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Filter bar */}
      <View style={styles.filterSection}>
        <FilterChips options={ALL_LANGUAGES} value={filterLang} onChange={setFilterLang} />
        <FilterChips options={ALL_STYLES} value={filterStyle} onChange={setFilterStyle} />
        <FilterChips options={ALL_CHARS} value={filterChar} onChange={setFilterChar} />
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
          <Text style={styles.emptyTitle}>{allPosts.length === 0 ? "No stories yet" : "No matches"}</Text>
          <Text style={styles.emptyText}>
            {allPosts.length === 0
              ? "Be the first to share a story with the community!"
              : "Try a different search or filter."}
          </Text>
        </View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            const isDownloaded = downloadedIds.has(item.id);
            const isLiked = likedPostIds.has(item.id);
            return (
              <TouchableOpacity style={styles.card} onPress={() => handleOpenStory(item)} activeOpacity={0.75}>
                <View style={styles.cardLeft}>
                  <Text style={styles.cardEmoji}>{CHAR_EMOJIS[item.characterType] || "📖"}</Text>
                </View>
                <View style={styles.cardContent}>
                  <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
                  <Text style={styles.cardMeta}>
                    {STYLE_EMOJIS[item.style] || "✨"} {item.style} · {item.scenario} · {item.lengthMinutes} min
                  </Text>
                  <View style={styles.cardFooter}>
                    {/* Author name instead of flag */}
                    <Text style={styles.cardAuthor}>✍️ {displayAuthor(item.authorName)}</Text>
                    <Text style={styles.cardDate}>{item.language} · {formatDate(item.createdAt)}</Text>
                  </View>
                  <View style={styles.cardStats}>
                    {(item.likeCount ?? 0) > 0 && <Text style={styles.cardStat}>❤️ {item.likeCount}</Text>}
                    {(item.downloadCount ?? 0) > 0 && <Text style={styles.cardStat}>⬇ {item.downloadCount}</Text>}
                  </View>
                </View>
                <View style={styles.cardActions}>
                  <TouchableOpacity
                    style={[styles.actionBtn, isLiked && styles.actionBtnLiked]}
                    onPress={() => handleLike(item)}
                    activeOpacity={0.7}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Text style={styles.actionIcon}>{isLiked ? "❤️" : "🤍"}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionBtn, isDownloaded && styles.actionBtnDone]}
                    onPress={() => handleDownload(item)}
                    activeOpacity={0.7}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Text style={[styles.actionIcon, isDownloaded && styles.actionIconDone]}>
                      {isDownloaded ? "✓" : "⬇"}
                    </Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}

      {/* Share Modal */}
      <Modal visible={shareModalVisible} animationType="slide" transparent onRequestClose={() => setShareModalVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Share to Community</Text>
            <Text style={styles.modalSub}>Choose a story to share with other parents</Text>
            <Text style={styles.fieldLabel}>Story</Text>
            <View style={styles.storyPickerScroll}>
              {unsharableStories.map((s) => (
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
            <Text style={styles.fieldLabel}>Your name (optional)</Text>
            <TextInput
              style={styles.textInput}
              placeholder="e.g. Sarah's Dad — shown as 'Magical' if blank"
              placeholderTextColor="#4A4270"
              value={authorName}
              onChangeText={setAuthorName}
              maxLength={80}
              returnKeyType="done"
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShareModalVisible(false)} activeOpacity={0.7}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmBtn, postMutation.isPending && { opacity: 0.6 }]}
                onPress={handleShare}
                disabled={postMutation.isPending || !selectedStory}
                activeOpacity={0.8}
              >
                <Text style={styles.confirmBtnText}>{postMutation.isPending ? "Sharing…" : "Share Story"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12, backgroundColor: "#0D0B2B" },
  headerTitle: { fontSize: 28, fontWeight: "800", color: "#F0EAF8" },
  headerSub: { fontSize: 13, color: "#9B8BB4", marginTop: 2 },
  shareBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: Y, borderRadius: 14, paddingVertical: 9, paddingHorizontal: 14, elevation: 4 },
  shareBtnText: { fontSize: 14, fontWeight: "700", color: "#0D0B2B" },
  // Search
  searchContainer: { paddingHorizontal: 16, paddingVertical: 10, backgroundColor: "#0D0B2B" },
  searchBar: { flexDirection: "row", alignItems: "center", backgroundColor: "#1A1740", borderRadius: 14, borderWidth: 1.5, borderColor: "#2E2A5A", paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  searchIcon: { fontSize: 16 },
  searchInput: { flex: 1, fontSize: 15, color: "#F0EAF8", padding: 0 },
  searchClear: { fontSize: 14, color: "#4A4270", paddingHorizontal: 4 },
  // Filter bar
  filterSection: { paddingBottom: 8, backgroundColor: "#0D0B2B", borderBottomWidth: 1, borderBottomColor: "#2E2A5A" },
  filterRow: { paddingHorizontal: 16, paddingVertical: 4, gap: 8, flexDirection: "row" },
  filterChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: "#1A1740", borderWidth: 1.5, borderColor: "#2E2A5A" },
  filterChipSelected: { backgroundColor: Y_DIM, borderColor: Y },
  filterChipText: { fontSize: 13, fontWeight: "500", color: "#9B8BB4" },
  filterChipTextSelected: { color: Y, fontWeight: "700" },
  // List
  listContent: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 40 },
  card: { flexDirection: "row", alignItems: "flex-start", backgroundColor: "#1A1740", borderRadius: 18, padding: 16, marginBottom: 12, borderWidth: 1.5, borderColor: "#2E2A5A" },
  cardLeft: { width: 48, height: 48, borderRadius: 14, backgroundColor: Y_DIM, alignItems: "center", justifyContent: "center", marginRight: 14, flexShrink: 0 },
  cardEmoji: { fontSize: 24 },
  cardContent: { flex: 1 },
  cardTitle: { fontSize: 15, fontWeight: "700", color: "#F0EAF8", marginBottom: 5, lineHeight: 20 },
  cardMeta: { fontSize: 13, color: "#9B8BB4", marginBottom: 4 },
  cardFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4, flexWrap: "wrap", gap: 4 },
  cardAuthor: { fontSize: 12, color: "#C8A2E8", fontWeight: "500" },
  cardDate: { fontSize: 12, color: "#4A4270" },
  cardStats: { flexDirection: "row", gap: 10 },
  cardStat: { fontSize: 12, color: "#9B8BB4" },
  cardActions: { flexDirection: "column", gap: 8, marginLeft: 10, alignItems: "center" },
  actionBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: "#120F35", alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: "#2E2A5A" },
  actionBtnLiked: { backgroundColor: "#2B1020", borderColor: "#F87171" },
  actionBtnDone: { backgroundColor: "#1A2B1A", borderColor: "#7BE8A0" },
  actionIcon: { fontSize: 15 },
  actionIconDone: { fontSize: 13, color: "#7BE8A0", fontWeight: "700" },
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
