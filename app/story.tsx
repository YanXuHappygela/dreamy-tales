import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Platform, Alert, Animated, Share,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createAudioPlayer, setAudioModeAsync } from "expo-audio";
import * as Haptics from "expo-haptics";
import { useKeepAwake } from "expo-keep-awake";

import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { GeneratedStory, SavedStory } from "@/shared/types";
import { STORIES_STORAGE_KEY } from "@/shared/const";
import { trpc } from "@/lib/trpc";

const Y = "#FFD580";
const Y_DIM = "#3D3010";

const LANGUAGE_CODES: Record<string, string> = {
  English: "en-US", Mandarin: "zh-CN", Spanish: "es-ES",
};

type PlayState = "idle" | "playing" | "paused" | "loading" | "done";
type NarrationSpeed = 0.5 | 0.7 | 0.9 | 1.0 | 1.1 | 1.3 | 1.5;

const SPEED_OPTIONS: NarrationSpeed[] = [0.5, 0.7, 0.9, 1.0, 1.1, 1.3, 1.5];
const DEFAULT_SPEED: NarrationSpeed = 0.9;

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
  const currentParagraphRef = useRef(0);
  const audioPlayerRef = useRef<ReturnType<typeof createAudioPlayer> | null>(null);
  const listenerRef = useRef<{ remove: () => void } | null>(null);

  /**
   * Generation counter — incremented on every stop/start.
   * Any in-flight async work checks this before proceeding.
   */
  const generationRef = useRef(0);

  const scrollRef = useRef<ScrollView>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const synthesizeMutation = trpc.tts.synthesize.useMutation();
  const utils = trpc.useUtils();
  const communityPostMutation = trpc.community.post.useMutation({
    onSuccess: () => {
      // Invalidate the community list cache so it refreshes when the user navigates to that tab
      utils.community.list.invalidate();
      Alert.alert("Shared! 🌟", "Your story has been posted to the community.");
    },
    onError: () => Alert.alert("Error", "Could not share to community."),
  });
  const [isSharedToCommunity, setIsSharedToCommunity] = useState(false);

  useEffect(() => {
    if (params.storyData) {
      try {
        const parsed: GeneratedStory = JSON.parse(params.storyData);
        setStory(parsed);
        Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
      } catch { /**/ }
    }
    return () => { stopAll(); };
  }, [params.storyData, fadeAnim]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Atomically stop everything and invalidate any in-flight chain. */
  const stopAll = useCallback(() => {
    generationRef.current += 1;
    // Remove event listener first
    if (listenerRef.current) {
      try { listenerRef.current.remove(); } catch { /**/ }
      listenerRef.current = null;
    }
    // Pause then remove the audio player so audio stops immediately
    if (audioPlayerRef.current) {
      try { audioPlayerRef.current.pause(); } catch { /**/ }
      try { audioPlayerRef.current.remove(); } catch { /**/ }
      audioPlayerRef.current = null;
    }
  }, []);

  const speakParagraph = useCallback(
    async (
      index: number,
      paragraphs: string[],
      config: GeneratedStory["config"],
      generation: number
    ) => {
      if (generation !== generationRef.current) return;

      if (index >= paragraphs.length) {
        setPlayState("done");
        setCurrentParagraph(0);
        currentParagraphRef.current = 0;
        return;
      }

      setCurrentParagraph(index);
      currentParagraphRef.current = index;
      setPlayState("loading");

      const langCode =
        config.voiceLanguageCode ??
        LANGUAGE_CODES[config.language ?? "English"] ??
        "en-US";

      // Default voices per language code (always WaveNet/Standard — safe for all sessions)
      const DEFAULT_VOICES: Record<string, string> = {
        "en-US": "en-US-Wavenet-C",
        "en-GB": "en-GB-Wavenet-A",
        "zh-CN": "cmn-CN-Wavenet-A",
        "cmn-CN": "cmn-CN-Wavenet-A",
        "es-ES": "es-ES-Wavenet-B",
        "es-US": "es-US-Wavenet-A",
      };
      const rawVoiceId = config.voiceId;
      // Sanitize: if the stored voiceId is not WaveNet or Standard (e.g. Chirp3-HD, Neural2)
      // replace it with the language-appropriate default so synthesis never fails silently
      const isValidTier = rawVoiceId && (/wavenet/i.test(rawVoiceId) || /standard/i.test(rawVoiceId));
      const voiceId = isValidTier
        ? rawVoiceId!
        : (DEFAULT_VOICES[langCode] ?? DEFAULT_VOICES["en-US"]);

      try {
        const result = await synthesizeMutation.mutateAsync({
          text: paragraphs[index],
          voiceId,
          languageCode: langCode,
          speakingRate: speedRef.current,
        });

        // Stale check after async synthesis
        if (generation !== generationRef.current) return;

        await setAudioModeAsync({ playsInSilentMode: true });

        // Clean up any previous player + listener
        if (listenerRef.current) {
          try { listenerRef.current.remove(); } catch { /**/ }
          listenerRef.current = null;
        }
        if (audioPlayerRef.current) {
          try { audioPlayerRef.current.remove(); } catch { /**/ }
          audioPlayerRef.current = null;
        }

        // Stale check again after cleanup
        if (generation !== generationRef.current) return;

        const apiBase = process.env.EXPO_PUBLIC_API_BASE_URL ?? "";
        const audioUrl = result.url.startsWith("http")
          ? result.url
          : `${apiBase}${result.url}`;

        const player = createAudioPlayer({ uri: audioUrl });
        audioPlayerRef.current = player;

        // Use didJustFinish event — fires exactly once when playback ends.
        // This replaces the polling loop that caused the double-voice bug on Android.
        let didFinishFired = false;
        const subscription = player.addListener("playbackStatusUpdate", (status) => {
          if (generation !== generationRef.current) {
            subscription.remove();
            return;
          }
          if (status.didJustFinish && !didFinishFired) {
            didFinishFired = true;
            subscription.remove();
            if (listenerRef.current === subscription) listenerRef.current = null;
            try { player.remove(); } catch { /**/ }
            if (audioPlayerRef.current === player) audioPlayerRef.current = null;
            // Advance to next paragraph
            speakParagraph(index + 1, paragraphs, config, generation);
          }
        });
        listenerRef.current = subscription;

        setPlayState("playing");
        player.play();

      } catch (err) {
        if (generation === generationRef.current) {
          setPlayState("idle");
          Alert.alert(
            "Narration error",
            `Could not load audio for paragraph ${index + 1}. Please check your internet connection and try again.\n\n${String(err)}`
          );
        }
      }
    },
    [synthesizeMutation] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const handlePlay = async () => {
    if (!story) return;
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (playState === "playing" || playState === "loading") {
      stopAll();
      setPlayState("paused");
      return;
    }

    if (playState === "paused") {
      const gen = generationRef.current;
      speedRef.current = speed;
      setPlayState("loading");
      speakParagraph(currentParagraphRef.current, story.paragraphs, story.config, gen);
      return;
    }

    // idle or done — start from beginning
    stopAll();
    const gen = generationRef.current;
    setCurrentParagraph(0);
    currentParagraphRef.current = 0;
    speedRef.current = speed;
    setPlayState("loading");
    speakParagraph(0, story.paragraphs, story.config, gen);
  };

  const handleStop = () => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    stopAll();
    setPlayState("idle");
    setCurrentParagraph(0);
    currentParagraphRef.current = 0;
  };

  const handleSave = async () => {
    if (!story || isSaved) return;
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    try {
      const raw = await AsyncStorage.getItem(STORIES_STORAGE_KEY);
      const existing: SavedStory[] = raw ? JSON.parse(raw) : [];
      const saved: SavedStory = { ...story, savedAt: new Date().toISOString() };
      await AsyncStorage.setItem(
        STORIES_STORAGE_KEY,
        JSON.stringify([saved, ...existing.filter((s) => s.id !== story.id)])
      );
      setIsSaved(true);
    } catch { Alert.alert("Error", "Could not save the story. Please try again."); }
  };

  const handleShare = async () => {
    if (!story) return;
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const text = `${story.title}\n\n${story.paragraphs.join("\n\n")}`;
    try { await Share.share({ message: text, title: story.title }); } catch { /**/ }
  };

  const handleShareToCommunity = () => {
    if (!story || isSharedToCommunity) return;
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      "Share to Community?",
      `Post "${story.title}" so other parents can discover and read it.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Share",
          onPress: () => {
            communityPostMutation.mutate({ authorName: "Anonymous", storyJson: story });
            setIsSharedToCommunity(true);
          },
        },
      ]
    );
  };

  const handleBack = () => { stopAll(); router.back(); };

  const handleSpeedChange = async (s: NarrationSpeed) => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSpeed(s);
    speedRef.current = s;
    if ((playState === "playing" || playState === "loading") && story) {
      const para = currentParagraphRef.current;
      stopAll();
      const gen = generationRef.current;
      setCurrentParagraph(para);
      currentParagraphRef.current = para;
      setPlayState("loading");
      speakParagraph(para, story.paragraphs, story.config, gen);
    }
  };

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
  const progress =
    playState === "done"
      ? 1
      : totalParagraphs > 0
      ? currentParagraph / totalParagraphs
      : 0;

  const isActive = playState === "playing" || playState === "loading";

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
          onPress={handleSave} disabled={isSaved} activeOpacity={0.7}
        >
          <IconSymbol name="heart.fill" size={20} color={isSaved ? "#F87171" : "#9B8BB4"} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.iconBtn} onPress={handleShare} activeOpacity={0.7}>
          <IconSymbol name="paperplane.fill" size={18} color="#9B8BB4" />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.iconBtn, isSharedToCommunity && { borderColor: "#7BE8A0" }]}
          onPress={handleShareToCommunity}
          disabled={isSharedToCommunity}
          activeOpacity={0.7}
        >
          <IconSymbol name="person.2.fill" size={18} color={isSharedToCommunity ? "#7BE8A0" : "#9B8BB4"} />
        </TouchableOpacity>
      </View>

      {/* Story content */}
      <Animated.View style={[{ flex: 1 }, { opacity: fadeAnim }]}>
        <ScrollView
          ref={scrollRef}
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.storyTitle}>{story.title}</Text>
          <View style={styles.metaRow}>
            <Text style={styles.metaText}>
              {story.config.characterType} • {story.config.scenario} • {story.config.style}
            </Text>
            <Text style={styles.metaText}>
              🌐 {story.config.language ?? "English"} • 🕐 ~{story.config.lengthMinutes} min
            </Text>
          </View>
          {story.paragraphs.map((para, idx) => (
            <Text
              key={idx}
              style={[
                styles.paragraph,
                idx === currentParagraph && isActive && styles.paragraphActive,
              ]}
            >
              {para}
            </Text>
          ))}
          <View style={{ height: 120 }} />
        </ScrollView>
      </Animated.View>

      {/* Controls */}
      <View style={styles.controls}>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${progress * 100}%` as any }]} />
        </View>

        <View style={styles.speedRow}>
          {SPEED_OPTIONS.map((s) => {
            const sel = speed === s;
            return (
              <TouchableOpacity
                key={s}
                style={[styles.speedChip, sel && styles.speedChipSelected]}
                onPress={() => handleSpeedChange(s)}
                activeOpacity={0.7}
              >
                <Text style={[styles.speedChipText, sel && styles.speedChipTextSelected]}>
                  {s}×
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.controlRow}>
          <TouchableOpacity
            style={[styles.controlBtn, playState === "idle" && styles.controlBtnDisabled]}
            onPress={handleStop}
            disabled={playState === "idle"}
            activeOpacity={0.7}
          >
            <IconSymbol
              name="stop.fill"
              size={22}
              color={playState === "idle" ? "#2E2A5A" : "#9B8BB4"}
            />
          </TouchableOpacity>

          <TouchableOpacity style={styles.playBtn} onPress={handlePlay} activeOpacity={0.85}>
            {playState === "loading"
              ? <Text style={styles.loadingDots}>…</Text>
              : <IconSymbol
                  name={isActive ? "pause.fill" : "play.fill"}
                  size={30}
                  color="#0D0B2B"
                />
            }
          </TouchableOpacity>

          <View style={styles.statusContainer}>
            <Text style={styles.statusText}>
              {playState === "idle" && "Tap to read"}
              {playState === "loading" && "Loading…"}
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
  topBar: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: Platform.OS === "android" ? 48 : 56,
    paddingBottom: 12, backgroundColor: "#0D0B2B",
  },
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
  controls: {
    backgroundColor: "#120F35", borderTopWidth: 1.5, borderTopColor: Y,
    paddingHorizontal: 24, paddingTop: 12,
    paddingBottom: Platform.OS === "android" ? 24 : 32,
  },
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
  loadingDots: { fontSize: 24, color: "#0D0B2B", fontWeight: "700" },
  statusContainer: { width: 80, alignItems: "flex-end" },
  statusText: { fontSize: 13, color: "#9B8BB4", fontWeight: "500" },
});
