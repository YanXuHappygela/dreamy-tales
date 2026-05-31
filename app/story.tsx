import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Platform,
  Alert,
  Animated,
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

// Map our language labels to BCP-47 codes for expo-speech
const LANGUAGE_CODES: Record<string, string> = {
  English: "en-US",
  Mandarin: "zh-CN",
  Spanish: "es-ES",
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
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }).start();
      } catch {
        // ignore parse errors
      }
    }
    return () => {
      Speech.stop();
    };
  }, [params.storyData, fadeAnim]);

  const speakParagraph = useCallback(
    (index: number, paragraphs: string[], config: GeneratedStory["config"]) => {
      if (index >= paragraphs.length) {
        setPlayState("done");
        setCurrentParagraph(0);
        return;
      }
      setCurrentParagraph(index);

      const langCode =
        LANGUAGE_CODES[config.language ?? "English"] ?? "en-US";
      const voiceId = config.voiceId;
      const rate = speedRef.current;

      Speech.speak(paragraphs[index], {
        rate,
        pitch: 1.05,
        language: langCode,
        ...(voiceId ? { voice: voiceId } : {}),
        onDone: () => {
          speakParagraph(index + 1, paragraphs, config);
        },
        onStopped: () => {
          // stopped externally
        },
        onError: () => {
          setPlayState("idle");
        },
      });
    },
    []
  );

  const handlePlay = async () => {
    if (!story) return;
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    if (playState === "paused" && Platform.OS !== "android") {
      await Speech.resume();
      setPlayState("playing");
      return;
    }

    if (playState === "playing") {
      if (Platform.OS !== "android") {
        await Speech.pause();
        setPlayState("paused");
      } else {
        await Speech.stop();
        setPlayState("idle");
      }
      return;
    }

    // idle or done — start from beginning
    setPlayState("playing");
    setCurrentParagraph(0);
    speedRef.current = speed;
    speakParagraph(0, story.paragraphs, story.config);
  };

  const handleStop = async () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    await Speech.stop();
    setPlayState("idle");
    setCurrentParagraph(0);
  };

  const handleSave = async () => {
    if (!story || isSaved) return;
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    try {
      const raw = await AsyncStorage.getItem(STORIES_STORAGE_KEY);
      const existing: SavedStory[] = raw ? JSON.parse(raw) : [];
      const saved: SavedStory = {
        ...story,
        savedAt: new Date().toISOString(),
      };
      const updated = [saved, ...existing.filter((s) => s.id !== story.id)];
      await AsyncStorage.setItem(STORIES_STORAGE_KEY, JSON.stringify(updated));
      setIsSaved(true);
    } catch {
      Alert.alert("Error", "Could not save the story. Please try again.");
    }
  };

  const handleBack = async () => {
    await Speech.stop();
    router.back();
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

  const langLabel = story.config.language ?? "English";
  const langCode = LANGUAGE_CODES[langLabel] ?? "en-US";

  return (
    <ScreenContainer containerClassName="bg-background" safeAreaClassName="">
      {/* Top bar */}
      <View style={styles.topBar}>
        <Pressable
          style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.6 }]}
          onPress={handleBack}
        >
          <IconSymbol name="chevron.left" size={22} color="#C8A2E8" />
        </Pressable>
        <Text style={styles.topBarTitle} numberOfLines={1}>
          {story.title}
        </Text>
        <Pressable
          style={({ pressed }) => [
            styles.iconBtn,
            isSaved && styles.iconBtnSaved,
            pressed && { opacity: 0.6 },
          ]}
          onPress={handleSave}
          disabled={isSaved}
        >
          <IconSymbol
            name="heart.fill"
            size={20}
            color={isSaved ? "#F87171" : "#9B8BB4"}
          />
        </Pressable>
      </View>

      {/* Story content with fade-in */}
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
              {story.config.characterType} • {story.config.scenario} •{" "}
              {story.config.style}
            </Text>
            <Text style={styles.metaText}>
              🌐 {langLabel} • 🕐 ~{story.config.lengthMinutes} min
            </Text>
          </View>

          {story.paragraphs.map((para, idx) => (
            <Text
              key={idx}
              style={[
                styles.paragraph,
                idx === currentParagraph &&
                  (playState === "playing" || playState === "paused") &&
                  styles.paragraphActive,
              ]}
            >
              {para}
            </Text>
          ))}

          <View style={{ height: 120 }} />
        </ScrollView>
      </Animated.View>

      {/* Playback controls */}
      <View style={styles.controls}>
        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              { width: `${progress * 100}%` as any },
            ]}
          />
        </View>

        {/* Speed toggle */}
        <View style={styles.speedRow}>
          {SPEED_OPTIONS.map((s) => (
            <Pressable
              key={s}
              style={({ pressed }) => [
                styles.speedChip,
                speed === s && styles.speedChipSelected,
                pressed && { opacity: 0.7 },
              ]}
              onPress={() => {
                if (Platform.OS !== "web") {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }
                setSpeed(s);
                speedRef.current = s;
              }}
            >
              <Text
                style={[
                  styles.speedChipText,
                  speed === s && styles.speedChipTextSelected,
                ]}
              >
                {s}×
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.controlRow}>
          {/* Stop */}
          <Pressable
            style={({ pressed }) => [
              styles.controlBtn,
              pressed && { opacity: 0.6 },
            ]}
            onPress={handleStop}
            disabled={playState === "idle"}
          >
            <IconSymbol
              name="stop.fill"
              size={22}
              color={playState === "idle" ? "#2E2A5A" : "#9B8BB4"}
            />
          </Pressable>

          {/* Play / Pause */}
          <Pressable
            style={({ pressed }) => [
              styles.playBtn,
              pressed && { transform: [{ scale: 0.95 }] },
            ]}
            onPress={handlePlay}
          >
            <IconSymbol
              name={playState === "playing" ? "pause.fill" : "play.fill"}
              size={30}
              color="#0D0B2B"
            />
          </Pressable>

          {/* Status */}
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
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  loadingEmoji: {
    fontSize: 56,
    marginBottom: 16,
  },
  loadingText: {
    fontSize: 18,
    color: "#9B8BB4",
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: Platform.OS === "android" ? 48 : 56,
    paddingBottom: 12,
    backgroundColor: "transparent",
  },
  topBarTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: "700",
    color: "#F0EAF8",
    textAlign: "center",
    marginHorizontal: 8,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(26, 23, 64, 0.85)",
    alignItems: "center",
    justifyContent: "center",
  },
  iconBtnSaved: {
    backgroundColor: "rgba(42, 31, 74, 0.9)",
  },
  scroll: {
    flex: 1,
    backgroundColor: "transparent",
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 8,
  },
  storyTitle: {
    fontSize: 26,
    fontWeight: "800",
    color: "#F0EAF8",
    textAlign: "center",
    marginBottom: 10,
    lineHeight: 34,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 24,
    flexWrap: "wrap",
    gap: 4,
  },
  metaText: {
    fontSize: 13,
    color: "#9B8BB4",
  },
  paragraph: {
    fontSize: 18,
    lineHeight: 30,
    color: "#C8BEDC",
    marginBottom: 20,
    letterSpacing: 0.2,
  },
  paragraphActive: {
    color: "#F0EAF8",
    backgroundColor: "rgba(200, 162, 232, 0.1)",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginHorizontal: -8,
  },
  controls: {
    backgroundColor: "rgba(18, 15, 53, 0.97)",
    borderTopWidth: 1,
    borderTopColor: "#2E2A5A",
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: Platform.OS === "android" ? 24 : 32,
  },
  speedRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    marginBottom: 14,
  },
  speedChip: {
    paddingHorizontal: 18,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: "#1A1740",
    borderWidth: 1.5,
    borderColor: "#2E2A5A",
  },
  speedChipSelected: {
    backgroundColor: "#2A1F4A",
    borderColor: "#C8A2E8",
  },
  speedChipText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#9B8BB4",
  },
  speedChipTextSelected: {
    color: "#C8A2E8",
  },
  progressBar: {
    height: 3,
    backgroundColor: "#2E2A5A",
    borderRadius: 2,
    marginBottom: 16,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#C8A2E8",
    borderRadius: 2,
  },
  controlRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  controlBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#1A1740",
    alignItems: "center",
    justifyContent: "center",
  },
  playBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#C8A2E8",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#C8A2E8",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 8,
  },
  statusContainer: {
    width: 80,
    alignItems: "flex-end",
  },
  statusText: {
    fontSize: 13,
    color: "#9B8BB4",
    fontWeight: "500",
  },
});
