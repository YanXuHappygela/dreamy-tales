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
import * as FileSystem from "expo-file-system/legacy";

import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { GeneratedStory, SavedStory } from "@/shared/types";
import { STORIES_STORAGE_KEY } from "@/shared/const";
import { trpc } from "@/lib/trpc";
import { shareStoryAsPdf } from "@/lib/storyPdf";
import { loadSettings } from "@/app/settings";
import { synthesizeParagraphsInParallel } from "@/lib/parallel-synthesis";
import { getNarrationFilename } from "@/lib/narration-storage";

const Y = "#FFD580";
const Y_DIM = "#3D3010";

const LANGUAGE_CODES: Record<string, string> = {
  English: "en-US", Mandarin: "zh-CN", Spanish: "es-ES",
};
const DEFAULT_VOICES: Record<string, string> = {
  "en-US": "en-US-Wavenet-C",
  "en-GB": "en-GB-Wavenet-A",
  "zh-CN": "cmn-CN-Wavenet-A",
  "cmn-CN": "cmn-CN-Wavenet-A",
  "es-ES": "es-ES-Wavenet-B",
  "es-US": "es-US-Wavenet-A",
};

type PlayState = "idle" | "synthesizing" | "playing" | "paused" | "done";
type NarrationSpeed = 0.5 | 0.7 | 0.9 | 1.0 | 1.1 | 1.3 | 1.5;

const SPEED_OPTIONS: NarrationSpeed[] = [0.5, 0.7, 0.9, 1.0, 1.1, 1.3, 1.5];
const DEFAULT_SPEED: NarrationSpeed = 0.9;

/** Save synthesized MP3 data into the app's private device storage. */
async function saveNarrationOnDevice(
  audioBase64: string,
  storyId: string,
  paragraphIndex: number,
): Promise<string> {
  if (Platform.OS === "web") {
    return `data:audio/mpeg;base64,${audioBase64}`;
  }

  const documentDirectory = FileSystem.documentDirectory;
  if (!documentDirectory) throw new Error("Device storage is unavailable");

  const narrationDirectory = `${documentDirectory}dreamy-tales/narration/`;
  await FileSystem.makeDirectoryAsync(narrationDirectory, { intermediates: true });
  const fileUri = `${narrationDirectory}${getNarrationFilename(storyId, paragraphIndex)}`;
  await FileSystem.writeAsStringAsync(fileUri, audioBase64, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return fileUri;
}

export default function StoryScreen() {
  useKeepAwake();
  const router = useRouter();
  const params = useLocalSearchParams<{ storyData: string }>();
  const [story, setStory] = useState<GeneratedStory | null>(null);
  const [playState, setPlayState] = useState<PlayState>("idle");
  const [currentParagraph, setCurrentParagraph] = useState(0);
  const [isSaved, setIsSaved] = useState(false);
  const [speed, setSpeed] = useState<NarrationSpeed>(DEFAULT_SPEED);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isGeneratingAnother, setIsGeneratingAnother] = useState(false);
  const [synthProgress, setSynthProgress] = useState(0); // 0-100 during pre-synthesis

  const speedRef = useRef<NarrationSpeed>(DEFAULT_SPEED);
  const currentParagraphRef = useRef(0);
  const audioPlayerRef = useRef<ReturnType<typeof createAudioPlayer> | null>(null);
  const listenerRef = useRef<{ remove: () => void } | null>(null);
  // Pre-synthesized audio URLs for all paragraphs — filled before playback starts
  const audioUrlsRef = useRef<string[]>([]);
  const generationRef = useRef(0);

  const scrollRef = useRef<ScrollView>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const synthesizeMutation = trpc.tts.synthesize.useMutation();

  const generateAnotherMutation = trpc.story.generate.useMutation({
    onSuccess: (data: GeneratedStory) => {
      setIsGeneratingAnother(false);
      stopAll();
      router.replace({ pathname: "/story", params: { storyData: JSON.stringify(data) } } as any);
    },
    onError: () => {
      setIsGeneratingAnother(false);
      Alert.alert("Error", "Could not generate a new story. Please try again.");
    },
  });

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

  /** Stop audio and invalidate any in-flight chain. */
  const stopAll = useCallback(() => {
    generationRef.current += 1;
    if (listenerRef.current) {
      try { listenerRef.current.remove(); } catch { /**/ }
      listenerRef.current = null;
    }
    if (audioPlayerRef.current) {
      try { audioPlayerRef.current.pause(); } catch { /**/ }
      try { audioPlayerRef.current.remove(); } catch { /**/ }
      audioPlayerRef.current = null;
    }
  }, []);

  /** Resolve voice ID from config, sanitising away non-WaveNet/Standard voices. */
  const resolveVoice = (config: GeneratedStory["config"]) => {
    const langCode = config.voiceLanguageCode ?? LANGUAGE_CODES[config.language ?? "English"] ?? "en-US";
    const raw = config.voiceId;
    const valid = raw && (/wavenet/i.test(raw) || /standard/i.test(raw));
    const voiceId = valid ? raw! : (DEFAULT_VOICES[langCode] ?? DEFAULT_VOICES["en-US"]);
    return { langCode, voiceId };
  };

  /**
   * Pre-synthesize ALL paragraphs in parallel before playback starts.
   * Promise.all retains paragraph order in the returned URL array even if
   * individual synthesis requests finish in a different order.
   * Returns an array of local audio file URIs, one per paragraph.
   * Runs network calls while the screen is still on, so background mode is not needed here.
   */
  const preSynthesizeAll = useCallback(
    async (
      storyId: string,
      paragraphs: string[],
      config: GeneratedStory["config"],
      generation: number,
    ): Promise<string[]> => {
      const { langCode, voiceId } = resolveVoice(config);
      const urls = await synthesizeParagraphsInParallel(
        paragraphs,
        async (paragraph, paragraphIndex) => {
          const result = await synthesizeMutation.mutateAsync({
            text: paragraph,
            voiceId,
            languageCode: langCode,
            speakingRate: speedRef.current,
          });
          return saveNarrationOnDevice(result.audioBase64, storyId, paragraphIndex);
        },
        (percent) => {
          if (generation === generationRef.current) setSynthProgress(percent);
        },
      );

      return generation === generationRef.current ? urls : [];
    },
    [synthesizeMutation] // eslint-disable-line react-hooks/exhaustive-deps
  );

  /**
   * Play paragraph at `index` using the pre-synthesized URL.
   * No network calls — pure local/remote file playback.
   * When done, automatically advances to the next paragraph.
   */
  const playParagraph = useCallback(
    (index: number, urls: string[], generation: number) => {
      if (generation !== generationRef.current) return;

      if (index >= urls.length) {
        setPlayState("done");
        setCurrentParagraph(0);
        currentParagraphRef.current = 0;
        return;
      }

      setCurrentParagraph(index);
      currentParagraphRef.current = index;

      // Clean up previous player
      if (listenerRef.current) {
        try { listenerRef.current.remove(); } catch { /**/ }
        listenerRef.current = null;
      }
      if (audioPlayerRef.current) {
        try { audioPlayerRef.current.remove(); } catch { /**/ }
        audioPlayerRef.current = null;
      }

      if (generation !== generationRef.current) return;

      const player = createAudioPlayer({ uri: urls[index] });
      audioPlayerRef.current = player;

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
          // Advance — no network call needed, URL is already in the array
          playParagraph(index + 1, urls, generation);
        }
      });
      listenerRef.current = subscription;

      setPlayState("playing");
      player.play();
    },
    [] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const handlePlay = async () => {
    if (!story) return;
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (playState === "playing") {
      stopAll();
      setPlayState("paused");
      return;
    }

    if (playState === "paused") {
      // Resume from current paragraph using already-synthesized URLs
      const urls = audioUrlsRef.current;
      if (urls.length > 0) {
        const gen = generationRef.current;
        speedRef.current = speed;
        playParagraph(currentParagraphRef.current, urls, gen);
      }
      return;
    }

    // idle or done — pre-synthesize everything then start playing
    stopAll();
    const gen = generationRef.current;
    setCurrentParagraph(0);
    currentParagraphRef.current = 0;
    speedRef.current = speed;
    audioUrlsRef.current = [];
    setSynthProgress(0);
    setPlayState("synthesizing");

    try {
      await setAudioModeAsync({
        playsInSilentMode: true,
        shouldPlayInBackground: true,
        interruptionModeAndroid: "duckOthers",
        interruptionMode: "mixWithOthers",
      });

      const urls = await preSynthesizeAll(story.id, story.paragraphs, story.config, gen);
      if (gen !== generationRef.current || urls.length === 0) return;

      audioUrlsRef.current = urls;
      playParagraph(0, urls, gen);
    } catch (err) {
      if (gen === generationRef.current) {
        setPlayState("idle");
        Alert.alert("Narration error", "Could not prepare audio. Please check your connection and try again.");
      }
    }
  };

  const handleStop = () => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    stopAll();
    audioUrlsRef.current = [];
    setPlayState("idle");
    setCurrentParagraph(0);
    currentParagraphRef.current = 0;
    setSynthProgress(0);
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
    if (!story || isGeneratingPdf) return;
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsGeneratingPdf(true);
    try {
      await shareStoryAsPdf(story);
    } catch {
      const text = `${story.title}\n\n${story.paragraphs.join("\n\n")}`;
      try { await Share.share({ message: text, title: story.title }); } catch { /**/ }
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleBack = () => { stopAll(); router.back(); };

  const handleGenerateAnother = async () => {
    if (!story || isGeneratingAnother) return;
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setIsGeneratingAnother(true);
    const settings = await loadSettings();
    generateAnotherMutation.mutate({
      childName: settings.childName?.trim() || story.config.childName || "the little one",
      characterType: story.config.characterType,
      customCharacter: story.config.customCharacter,
      scenario: story.config.scenario as any,
      style: story.config.style as any,
      lengthMinutes: story.config.lengthMinutes,
      language: story.config.language ?? settings.language,
      ageGroup: story.config.ageGroup ?? settings.ageGroup,
      voiceId: story.config.voiceId ?? settings.voiceId,
      voiceLanguageCode: story.config.voiceLanguageCode ?? settings.voiceLanguageCode,
      storyIdea: story.config.storyIdea,
    });
  };

  const handleSpeedChange = (s: NarrationSpeed) => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSpeed(s);
    speedRef.current = s;
    // Speed change requires re-synthesis — reset to idle so user taps Play again
    if (playState === "playing" || playState === "paused") {
      stopAll();
      audioUrlsRef.current = [];
      setPlayState("idle");
      setCurrentParagraph(0);
      currentParagraphRef.current = 0;
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
      : playState === "synthesizing"
      ? synthProgress / 100 * 0.15 // show up to 15% during synthesis
      : totalParagraphs > 0
      ? 0.15 + (currentParagraph / totalParagraphs) * 0.85
      : 0;

  const isActive = playState === "playing";
  const isBusy = playState === "synthesizing";

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
        <TouchableOpacity
          style={[styles.iconBtn, isGeneratingPdf && { opacity: 0.5 }]}
          onPress={handleShare}
          disabled={isGeneratingPdf}
          activeOpacity={0.7}
        >
          {isGeneratingPdf
            ? <Text style={{ fontSize: 12, color: Y }}>PDF…</Text>
            : <IconSymbol name="paperplane.fill" size={18} color="#9B8BB4" />
          }
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
              {story.config.characterType} · {story.config.scenario} · {story.config.style}
            </Text>
            <Text style={styles.metaText}>
              🌐 {story.config.language ?? "English"} · 🕐 ~{story.config.lengthMinutes} min
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

        {/* Play / Stop row */}
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

          <TouchableOpacity
            style={[styles.playBtn, isBusy && { opacity: 0.7 }]}
            onPress={handlePlay}
            disabled={isBusy}
            activeOpacity={0.85}
          >
            {isBusy
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
              {playState === "synthesizing" && `Preparing ${synthProgress}%`}
              {playState === "playing" && "Reading…"}
              {playState === "paused" && "Paused"}
              {playState === "done" && "The End ✨"}
            </Text>
          </View>
        </View>

        {/* Generate Another button */}
        <TouchableOpacity
          style={[styles.generateAnotherBtn, isGeneratingAnother && { opacity: 0.65 }]}
          onPress={handleGenerateAnother}
          disabled={isGeneratingAnother}
          activeOpacity={0.8}
        >
          <IconSymbol name="arrow.clockwise" size={18} color="#0D0B2B" />
          <Text style={styles.generateAnotherText}>
            {isGeneratingAnother ? "Generating…" : "Generate Another"}
          </Text>
        </TouchableOpacity>
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
  generateAnotherBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: Y, borderRadius: 16, paddingVertical: 13, marginTop: 14, elevation: 6,
  },
  generateAnotherText: { fontSize: 15, fontWeight: "700", color: "#0D0B2B" },
});
