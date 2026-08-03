import React, { useCallback, useState } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Platform, Alert,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";

import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { StarfieldBackground } from "@/components/starfield-background";
import { SavedStory } from "@/shared/types";
import { STORIES_STORAGE_KEY } from "@/shared/const";
import { loadSettings } from "@/app/settings";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/hooks/use-auth";

const Y = "#FFD580";
const Y_DIM = "#3D3010";
const FREE_LIMIT = 3;

const CHARACTER_EMOJIS: Record<string, string> = {
  Bunny: "🐰", Dragon: "🐉", Princess: "👸",
  Robot: "🤖", Unicorn: "🦄", Bear: "🐻",
  "Race Car": "🏎️", Dolphin: "🐬",
};
const SCENARIO_EMOJIS: Record<string, string> = {
  Forest: "🌲", Space: "🚀", Ocean: "🌊",
  Castle: "🏰", Jungle: "🌴", "Cloud Kingdom": "☁️",
  Volcano: "🌋", Desert: "🏜️", Mountain: "⛰️",
};

const RANDOM_CHARACTERS = ["Bunny", "Dragon", "Princess", "Robot", "Unicorn", "Bear", "Race Car", "Dolphin"];
const RANDOM_SCENARIOS = ["Forest", "Space", "Ocean", "Castle", "Jungle", "Cloud Kingdom", "Volcano", "Desert", "Mountain"];
const RANDOM_STYLES = ["Funny", "Magical", "Adventurous", "Cozy", "Mysterious", "Silly"];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export default function HomeScreen() {
  const router = useRouter();
  const { user, isAuthenticated, logout } = useAuth();
  const [recentStories, setRecentStories] = useState<SavedStory[]>([]);
  const [isSurprising, setIsSurprising] = useState(false);

  // Usage counter — only meaningful for logged-in users
  const { data: usageData, refetch: refetchUsage } = trpc.story.usage.useQuery(undefined, {
    enabled: isAuthenticated,
    staleTime: 0,
  });
  const storiesUsed = usageData?.count ?? 0;
  const storiesRemaining = usageData?.remaining ?? FREE_LIMIT;
  const limitReached = isAuthenticated && storiesUsed >= FREE_LIMIT;

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

  useFocusEffect(useCallback(() => {
    loadRecentStories();
    if (isAuthenticated) refetchUsage();
  }, [loadRecentStories, isAuthenticated, refetchUsage]));

  const surpriseMutation = trpc.story.generate.useMutation({
    onSuccess: (data) => {
      setIsSurprising(false);
      if (isAuthenticated) refetchUsage();
      router.push({ pathname: "/story", params: { storyData: JSON.stringify(data) } } as any);
    },
    onError: (err) => {
      setIsSurprising(false);
      handleGenerationError(err);
    },
  });

  const handleGenerationError = (err: unknown) => {
    const msg = (err as any)?.message ?? "";
    if (msg.startsWith("LIMIT_REACHED_GUEST:")) {
      // Guest hit the limit — prompt to sign in
      Alert.alert(
        "Daily limit reached 🌙",
        "You've used your 3 free stories today.\n\nSign in to keep track of your stories and come back tomorrow for more!",
        [
          { text: "Not now", style: "cancel" },
          { text: "Sign in", onPress: () => router.push("/login" as any) },
        ]
      );
    } else if (msg.startsWith("LIMIT_REACHED:")) {
      Alert.alert("Daily limit reached 🌙", msg.replace("LIMIT_REACHED:", "").trim());
    } else {
      Alert.alert("Error", msg || "Something went wrong. Please try again.");
    }
  };

  const handleCreateStory = () => {
    if (limitReached) { handleLimitReached(); return; }
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push("/config" as any);
  };

  const handleSurpriseMe = async () => {
    if (limitReached) { handleLimitReached(); return; }
    if (isSurprising) return;
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setIsSurprising(true);
    const settings = await loadSettings();
    surpriseMutation.mutate({
      childName: settings.childName?.trim() || "the little one",
      characterType: pick(RANDOM_CHARACTERS),
      scenario: pick(RANDOM_SCENARIOS) as any,
      style: pick(RANDOM_STYLES) as any,
      lengthMinutes: 8,
      language: settings.language,
      ageGroup: settings.ageGroup,
      voiceId: settings.voiceId,
      voiceLanguageCode: settings.voiceLanguageCode,
    });
  };

  const handleLimitReached = () => {
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    Alert.alert(
      "Daily limit reached 🌙",
      `Free users can generate ${FREE_LIMIT} stories per day. Come back tomorrow for more magical stories!`
    );
  };

  const handleOpenStory = (story: SavedStory) => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({ pathname: "/story", params: { storyData: JSON.stringify(story) } } as any);
  };

  const handleSettings = () => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push("/settings" as any);
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
          <TouchableOpacity style={styles.settingsBtn} onPress={handleSettings} activeOpacity={0.7}>
            <IconSymbol name="gearshape.fill" size={22} color="#0D0B2B" />
          </TouchableOpacity>
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

        {/* Usage counter — only shown for logged-in users */}
        {isAuthenticated && (
          <View style={[styles.usageBanner, limitReached && styles.usageBannerLimit]}>
            <View style={styles.usageDots}>
              {Array.from({ length: FREE_LIMIT }).map((_, i) => (
                <View key={i} style={[styles.usageDot, i < storiesUsed && styles.usageDotFilled]} />
              ))}
            </View>
            <Text style={[styles.usageText, limitReached && styles.usageTextLimit]}>
              {limitReached
                ? "Daily limit reached — come back tomorrow 🌙"
                : `${storiesRemaining} stor${storiesRemaining === 1 ? "y" : "ies"} remaining today`}
            </Text>
          </View>
        )}

        {/* Create Story Button */}
        <TouchableOpacity
          style={[styles.createButton, limitReached && styles.createButtonDisabled]}
          onPress={handleCreateStory}
          activeOpacity={0.8}
        >
          <IconSymbol name="wand.and.stars" size={24} color="#0D0B2B" />
          <Text style={styles.createButtonText}>Create a Story</Text>
        </TouchableOpacity>

        {/* Surprise Me Button */}
        <TouchableOpacity
          style={[styles.surpriseButton, (isSurprising || limitReached) && { opacity: 0.65 }]}
          onPress={handleSurpriseMe}
          disabled={isSurprising || limitReached}
          activeOpacity={0.8}
        >
          <Text style={styles.surpriseEmoji}>{isSurprising ? "🌙" : "🎲"}</Text>
          <Text style={styles.surpriseButtonText}>
            {isSurprising ? "Weaving your story…" : "Surprise Me!"}
          </Text>
        </TouchableOpacity>

        {/* Sign in / user row */}
        {isAuthenticated ? (
          <View style={styles.userRow}>
            <Text style={styles.userName}>👤 {user?.name ?? user?.email ?? "Signed in"}</Text>
            <TouchableOpacity onPress={logout} activeOpacity={0.7}>
              <Text style={styles.logoutText}>Sign out</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.signInRow}
            onPress={() => router.push("/login" as any)}
            activeOpacity={0.7}
          >
            <Text style={styles.signInText}>
              Sign in to track your daily stories →
            </Text>
          </TouchableOpacity>
        )}

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
  header: { alignItems: "center", paddingVertical: 32, position: "relative" },
  settingsBtn: { position: "absolute", top: 16, right: 0, width: 40, height: 40, borderRadius: 12, backgroundColor: Y, alignItems: "center", justifyContent: "center", zIndex: 10, elevation: 6 },
  moonContainer: { alignItems: "center", marginBottom: 16 },
  moonEmoji: { fontSize: 72, lineHeight: 88 },
  starRow: { flexDirection: "row", gap: 8, marginTop: 4 },
  starEmoji: { fontSize: 20 },
  appTitle: { fontSize: 34, fontWeight: "800", color: "#F0EAF8", letterSpacing: 0.5, marginBottom: 8 },
  appSubtitle: { fontSize: 16, color: "#9B8BB4", textAlign: "center", lineHeight: 22 },
  usageBanner: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#1A1740", borderRadius: 14, borderWidth: 1.5, borderColor: "#2E2A5A", paddingHorizontal: 16, paddingVertical: 12, marginBottom: 16 },
  usageBannerLimit: { borderColor: "#F87171", backgroundColor: "#2B1020" },
  usageDots: { flexDirection: "row", gap: 6 },
  usageDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#2E2A5A", borderWidth: 1.5, borderColor: "#4A4270" },
  usageDotFilled: { backgroundColor: Y, borderColor: Y },
  usageText: { flex: 1, fontSize: 13, color: "#9B8BB4", fontWeight: "500" },
  usageTextLimit: { color: "#F87171" },
  createButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, backgroundColor: Y, borderRadius: 20, paddingVertical: 18, paddingHorizontal: 32, marginBottom: 14, elevation: 8 },
  createButtonDisabled: { opacity: 0.45 },
  createButtonText: { fontSize: 18, fontWeight: "700", color: "#0D0B2B" },
  surpriseButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, backgroundColor: Y, borderRadius: 20, paddingVertical: 18, paddingHorizontal: 32, marginBottom: 20, elevation: 8 },
  surpriseEmoji: { fontSize: 22 },
  surpriseButtonText: { fontSize: 18, fontWeight: "700", color: "#0D0B2B" },
  userRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 24, paddingHorizontal: 4 },
  userName: { fontSize: 13, color: "#9B8BB4" },
  logoutText: { fontSize: 13, color: "#F87171", fontWeight: "600" },
  signInRow: { alignItems: "center", marginBottom: 24 },
  signInText: { fontSize: 13, color: "#9B8BB4", textDecorationLine: "underline" },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 20, fontWeight: "700", color: "#F0EAF8", marginBottom: 14 },
  storyCard: { flexDirection: "row", alignItems: "center", backgroundColor: "#1A1740", borderRadius: 16, padding: 16, marginBottom: 10, borderWidth: 1.5, borderColor: Y },
  storyCardLeft: { width: 44, height: 44, borderRadius: 12, backgroundColor: Y_DIM, alignItems: "center", justifyContent: "center", marginRight: 12 },
  storyCardEmoji: { fontSize: 22 },
  storyCardContent: { flex: 1 },
  storyCardTitle: { fontSize: 15, fontWeight: "600", color: "#F0EAF8", marginBottom: 4 },
  storyCardMeta: { fontSize: 13, color: "#9B8BB4" },
  emptyState: { alignItems: "center", paddingVertical: 40, paddingHorizontal: 24 },
  emptyStateEmoji: { fontSize: 48, marginBottom: 16 },
  emptyStateText: { fontSize: 15, color: "#9B8BB4", textAlign: "center", lineHeight: 22 },
});
