import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Platform, Alert, Animated,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Speech from "expo-speech";
import * as Haptics from "expo-haptics";
import { useKeepAwake } from "expo-keep-awake";

import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { GeneratedStory, SavedStory } from "@/shared/types";
import { STORIES_STORAGE_KEY } from "@/shared/const";

const Y = "#FFD580";
const Y_DIM = "#3D3010";

const LANGUAGE_CODES: Record<string, string> = {
  English: "en-US", Mandarin: "zh-CN", Spanish: "es-ES",
};

type PlayState = "idle" | "playing" | "paused" | "done";
type NarrationSpeed = 0.5 | 0.7 | 0.9 | 1.0 | 1.1 | 1.3 | 1.5;

const SPEED_OPTIONS: NarrationSpeed[] = [0.5, 0.7, 0.9, 1.0, 1.1, 1.3, 1.5];
const DEFAULT_SPEED: NarrationSpeed = 1.0;

export default function StoryScreen() {
  useKeepAwake();
  const router = useRouter();
  const params = useLocalSearchParams<{ storyData: string }>();
  const [story, setStory] = useState<GeneratedStory | null>(null);
  const [playState, setPlayState] = useState<PlayState>("idle");
  const [currentParagraph, setCurrentParagraph] = useState(0);
  const [isSaved, setIsSaved] = useState(false);
  const [speed, setSpeed] = useState<NarrationSpeed>(DEFAULT_SPEED);
  const speedRef = useRef<NarrationSpeed>(DEFAULT_SPEED);
  const scrollRef = useRef<ScrollView>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (params.storyData) {
      try {
        const parsed: GeneratedStory = JSON.parse(params.storyData);
        setStory(parsed);
        Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
      } catch { /**/ }
    }
    return () => { Speech.stop(); };
  }, [params.storyData, fadeAnim]);

  const speakParagraph = useCallback(
    (index: number, paragraphs: string[], config: GeneratedStory["config"]) => {
      if (index >= paragraphs.length) { setPlayState("done"); setCurrentParagraph(0); return; }
      setCurrentParagraph(index);
      Speech.speak(paragraphs[index], {
        rate: speedRef.current,
        pitch: 1.05,
        language: LANGUAGE_CODES[config.language ?? "English"] ?? "en-US",
        ...(config.voiceId ? { voice: config.voiceId } : {}),
        onDone: () => speakParagraph(index + 1, paragraphs, config),
        onStopped: () => { /**/ },
        onError: () => setPlayState("idle"),
      });
    }, []
  );

  const handlePlay = async () => {
    if (!story) return;
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (playState === "paused" && Platform.OS !== "android") { await Speech.resume(); setPlayState("playing"); return; }
    if (playState === "playing") {
      if (Platform.OS !== "android") { await Speech.pause(); setPlayState("paused"); }
      else { await Speech.stop(); setPlayState("idle"); }
      return;
    }
    setPlayState("playing"); setCurrentParagraph(0);
    speedRef.current = speed;
    speakParagraph(0, story.paragraphs, story.config);
  };

  const handleStop = async () => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await Speech.stop(); setPlayState("idle"); setCurrentParagraph(0);
  };

  const handleSave = async () => {
    if (!story || isSaved) return;
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    try {
      const raw = await AsyncStorage.getItem(STORIES_STORAGE_KEY);
      const existing: SavedStory[] = raw ? JSON.parse(raw) : [];
      const saved: SavedStory = { ...story, savedAt: new Date().toISOString() };
      await AsyncStorage.setItem(STORIES_STORAGE_KEY, JSON.stringify([saved, ...existing.filter((s) => s.id !== story.id)]));
      setIsSaved(true);
    } catch { Alert.alert("Error", "Could not save the story. Please try again."); }
  };

  const handleBack = async () => { await Speech.stop(); router.back(); };

  if (!story) {
    return (
      <ScreenContainer containerClassName="bg-background">
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingEmoji}>🌙</Text>
          <Text style={styles.loadingText}>Loading your story…</Text>
        </View>
      </ScreenContainer>
    );
  }

  const totalParagraphs = story.paragraphs.length;
  const progress = playState === "done" ? 1 : totalParagraphs > 0 ? currentParagraph / totalParagraphs : 0;

  return (
    <ScreenContainer containerClassName="bg-background" safeAreaClassName="">
      {/* Top bar */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.iconBtn} onPress={handleBack} activeOpacity={0.7}>
          <IconSymbol name="chevron.left" size={22} color={Y} />
        </TouchableOpacity>
        <Text style={styles.topBarTitle} numberOfLines={1}>{story.title}</Text>
        <TouchableOpacity
          style={[styles.iconBtn, isSaved && styles.iconBtnSaved]}
          onPress={handleSave}
          disabled={isSaved}
          activeOpacity={0.7}
        >
          <IconSymbol name="heart.fill" size={20} color={isSaved ? "#F87171" : "#9B8BB4"} />
        </TouchableOpacity>
      </View>

      {/* Story content */}
      <Animated.View style={[{ flex: 1 }, { opacity: fadeAnim }]}>
        <ScrollView ref={scrollRef} style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <Text style={styles.storyTitle}>{story.title}</Text>
          <View style={styles.metaRow}>
            <Text style={styles.metaText}>{story.config.characterType} • {story.config.scenario} • {story.config.style}</Text>
            <Text style={styles.metaText}>🌐 {story.config.language ?? "English"} • 🕐 ~{story.config.lengthMinutes} min</Text>
          </View>
          {story.paragraphs.map((para, idx) => (
            <Text key={idx} style={[styles.paragraph, idx === currentParagraph && (playState === "playing" || playState === "paused") && styles.paragraphActive]}>
              {para}
            </Text>
          ))}
          <View style={{ height: 120 }} />
        </ScrollView>
      </Animated.View>

      {/* Controls */}
      <View style={styles.controls}>
        {/* Progress bar */}
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${progress * 100}%` as any }]} />
        </View>

        {/* Speed chips */}
        <View style={styles.speedRow}>
          {SPEED_OPTIONS.map((s) => {
            const sel = speed === s;
            return (
              <TouchableOpacity
                key={s}
                style={[styles.speedChip, sel && styles.speedChipSelected]}
                onPress={() => { if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setSpeed(s); speedRef.current = s; }}
                activeOpacity={0.7}
              >
                <Text style={[styles.speedChipText, sel && styles.speedChipTextSelected]}>{s}×</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Play / Stop row */}
        <View style={styles.controlRow}>
          <TouchableOpacity
            style={[styles.controlBtn, playState === "idle" && styles.controlBtnDisabled]}
            onPress={handleStop}
            disabled={playState === "idle"}
            activeOpacity={0.7}
          >
            <IconSymbol name="stop.fill" size={22} color={playState === "idle" ? "#2E2A5A" : "#9B8BB4"} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.playBtn} onPress={handlePlay} activeOpacity={0.85}>
            <IconSymbol name={playState === "playing" ? "pause.fill" : "play.fill"} size={30} color="#0D0B2B" />
          </TouchableOpacity>

          <View style={styles.statusContainer}>
            <Text style={styles.statusText}>
              {playState === "idle" && "Tap to read"}
              {playState === "playing" && "Reading…"}
              {playState === "paused" && "Paused"}
              {playState === "done" && "The End ✨"}
            </Text>
          </View>
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  loadingContainer: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#0D0B2B" },
  loadingEmoji: { fontSize: 56, marginBottom: 16 },
  loadingText: { fontSize: 18, color: "#9B8BB4" },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: Platform.OS === "android" ? 48 : 56, paddingBottom: 12, backgroundColor: "#0D0B2B" },
  topBarTitle: { flex: 1, fontSize: 16, fontWeight: "700", color: "#F0EAF8", textAlign: "center", marginHorizontal: 8 },
  iconBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: "#1A1740", borderWidth: 1.5, borderColor: Y, alignItems: "center", justifyContent: "center" },
  iconBtnSaved: { backgroundColor: Y_DIM, borderColor: "#F87171" },
  scroll: { flex: 1, backgroundColor: "#0D0B2B" },
  scrollContent: { paddingHorizontal: 24, paddingTop: 8 },
  storyTitle: { fontSize: 26, fontWeight: "800", color: "#F0EAF8", textAlign: "center", marginBottom: 10, lineHeight: 34 },
  metaRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 4 },
  metaText: { fontSize: 13, color: "#9B8BB4" },
  paragraph: { fontSize: 18, lineHeight: 30, color: "#C8BEDC", marginBottom: 20, letterSpacing: 0.2 },
  paragraphActive: { color: "#F0EAF8", backgroundColor: Y_DIM, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, marginHorizontal: -8 },
  controls: { backgroundColor: "#120F35", borderTopWidth: 1.5, borderTopColor: Y, paddingHorizontal: 24, paddingTop: 12, paddingBottom: Platform.OS === "android" ? 24 : 32 },
  progressBar: { height: 4, backgroundColor: "#2E2A5A", borderRadius: 2, marginBottom: 14, overflow: "hidden" },
  progressFill: { height: "100%", backgroundColor: Y, borderRadius: 2 },
  speedRow: { flexDirection: "row", justifyContent: "center", gap: 6, marginBottom: 14 },
  speedChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: "#1A1740", borderWidth: 1.5, borderColor: "#2E2A5A" },
  speedChipSelected: { backgroundColor: Y_DIM, borderColor: Y },
  speedChipText: { fontSize: 13, fontWeight: "600", color: "#9B8BB4" },
  speedChipTextSelected: { color: Y, fontWeight: "700" },
  controlRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  controlBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: "#1A1740", borderWidth: 1.5, borderColor: Y, alignItems: "center", justifyContent: "center" },
  controlBtnDisabled: { borderColor: "#2E2A5A" },
  playBtn: { width: 68, height: 68, borderRadius: 34, backgroundColor: Y, alignItems: "center", justifyContent: "center", elevation: 10 },
  statusContainer: { width: 80, alignItems: "flex-end" },
  statusText: { fontSize: 13, color: "#9B8BB4", fontWeight: "500" },
});
