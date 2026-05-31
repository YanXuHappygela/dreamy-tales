import React, { useState, useCallback } from "react";
import {
  View, Text, ScrollView, Pressable, TextInput, StyleSheet, Platform,
} from "react-native";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { trpc } from "@/lib/trpc";
import { GeneratedStory, StoryLanguage } from "@/shared/types";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { LoadingStory } from "@/components/loading-story";
import { VoicePicker } from "@/components/voice-picker";

const PREFS_KEY = "dreamy_tales_prefs";

// Moon yellow palette
const Y = "#FFD580";       // moon yellow — primary accent
const Y_DIM = "#3D3010";   // dark tinted yellow — selected chip bg
const Y_BORDER = "#FFD580"; // yellow border for selected state

const CHARACTER_OPTIONS = [
  { label: "Bunny", emoji: "🐰" }, { label: "Dragon", emoji: "🐉" },
  { label: "Princess", emoji: "👸" }, { label: "Robot", emoji: "🤖" },
  { label: "Unicorn", emoji: "🦄" }, { label: "Bear", emoji: "🐻" },
  { label: "Custom", emoji: "✏️" },
];
const SCENARIO_OPTIONS = [
  { label: "Forest", emoji: "🌲" }, { label: "Space", emoji: "🚀" },
  { label: "Ocean", emoji: "🌊" }, { label: "Castle", emoji: "🏰" },
  { label: "Jungle", emoji: "🌴" }, { label: "Cloud Kingdom", emoji: "☁️" },
];
const STYLE_OPTIONS = [
  { label: "Funny", emoji: "😄" }, { label: "Magical", emoji: "✨" },
  { label: "Adventurous", emoji: "🗺️" }, { label: "Cozy", emoji: "🛋️" },
  { label: "Mysterious", emoji: "🔮" },
];
const LENGTH_OPTIONS = [3, 4, 5, 6, 7, 8, 9, 10];
const LANGUAGE_OPTIONS: { label: StoryLanguage }[] = [
  { label: "English" }, { label: "Mandarin" }, { label: "Spanish" },
];

export default function ConfigScreen() {
  const router = useRouter();
  const [childName, setChildName] = useState("");
  const [characterType, setCharacterType] = useState("Bunny");
  const [customCharacter, setCustomCharacter] = useState("");
  const [storyIdea, setStoryIdea] = useState("");
  const [scenario, setScenario] = useState("Forest");
  const [storyStyle, setStoryStyle] = useState("Magical");
  const [lengthMinutes, setLengthMinutes] = useState(5);
  const [language, setLanguage] = useState<StoryLanguage>("English");
  const [voiceId, setVoiceId] = useState<string | undefined>(undefined);

  const generateMutation = trpc.story.generate.useMutation({
    onSuccess: async (data: GeneratedStory) => {
      try { await AsyncStorage.setItem(PREFS_KEY, JSON.stringify({ language, voiceId })); } catch { /**/ }
      router.push({ pathname: "/story", params: { storyData: JSON.stringify(data) } } as any);
    },
  });

  const handleGenerate = () => {
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    generateMutation.mutate({
      childName: childName.trim() || "the little one",
      characterType: characterType as any,
      customCharacter: characterType === "Custom" ? customCharacter.trim() : undefined,
      scenario: scenario as any,
      style: storyStyle as any,
      lengthMinutes,
      language,
      voiceId,
      storyIdea: storyIdea.trim() || undefined,
    });
  };

  const handleLanguageChange = useCallback((lang: StoryLanguage) => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLanguage(lang);
    setVoiceId(undefined);
  }, []);

  const tap = () => { if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); };

  if (generateMutation.isPending) {
    return (
      <ScreenContainer containerClassName="bg-background" safeAreaClassName="">
        <LoadingStory />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer containerClassName="bg-background" safeAreaClassName="">
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.6 }]} onPress={() => router.back()}>
            <IconSymbol name="chevron.left" size={22} color={Y} />
          </Pressable>
          <Text style={styles.headerTitle}>Create a Story</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Child's Name */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Child's Name (optional)</Text>
          <TextInput
            style={styles.textInput}
            placeholder="e.g. Emma, Liam…"
            placeholderTextColor="#4A4270"
            value={childName}
            onChangeText={setChildName}
            maxLength={30}
            returnKeyType="done"
          />
        </View>

        {/* Character */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Main Character</Text>
          <View style={styles.optionGrid}>
            {CHARACTER_OPTIONS.map((opt) => {
              const sel = characterType === opt.label;
              return (
                <Pressable
                  key={opt.label}
                  style={({ pressed }) => [styles.chip, sel && styles.chipSelected, pressed && { opacity: 0.7 }]}
                  onPress={() => { tap(); setCharacterType(opt.label); }}
                >
                  <Text style={styles.chipEmoji}>{opt.emoji}</Text>
                  <Text style={[styles.chipLabel, sel && styles.chipLabelSelected]}>{opt.label}</Text>
                </Pressable>
              );
            })}
          </View>
          {characterType === "Custom" && (
            <TextInput
              style={[styles.textInput, styles.customCharInput]}
              placeholder="Describe your character, e.g. a tiny wizard fox…"
              placeholderTextColor="#4A4270"
              value={customCharacter}
              onChangeText={setCustomCharacter}
              maxLength={80}
              returnKeyType="done"
              autoFocus
            />
          )}
        </View>

        {/* Scenario */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Story Setting</Text>
          <View style={styles.optionGrid}>
            {SCENARIO_OPTIONS.map((opt) => {
              const sel = scenario === opt.label;
              return (
                <Pressable
                  key={opt.label}
                  style={({ pressed }) => [styles.chip, sel && styles.chipSelected, pressed && { opacity: 0.7 }]}
                  onPress={() => { tap(); setScenario(opt.label); }}
                >
                  <Text style={styles.chipEmoji}>{opt.emoji}</Text>
                  <Text style={[styles.chipLabel, sel && styles.chipLabelSelected]}>{opt.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Style */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Story Style</Text>
          <View style={styles.optionGrid}>
            {STYLE_OPTIONS.map((opt) => {
              const sel = storyStyle === opt.label;
              return (
                <Pressable
                  key={opt.label}
                  style={({ pressed }) => [styles.chip, sel && styles.chipSelected, pressed && { opacity: 0.7 }]}
                  onPress={() => { tap(); setStoryStyle(opt.label); }}
                >
                  <Text style={styles.chipEmoji}>{opt.emoji}</Text>
                  <Text style={[styles.chipLabel, sel && styles.chipLabelSelected]}>{opt.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Story Idea */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>
            Story Idea<Text style={styles.optionalTag}> (optional)</Text>
          </Text>
          <TextInput
            style={[styles.textInput, styles.storyIdeaInput]}
            placeholder="e.g. The bunny finds a lost star and returns it to the sky…"
            placeholderTextColor="#4A4270"
            value={storyIdea}
            onChangeText={setStoryIdea}
            maxLength={300}
            multiline
            numberOfLines={3}
            returnKeyType="done"
            blurOnSubmit
          />
          <Text style={styles.charCount}>{storyIdea.length}/300</Text>
        </View>

        {/* Story Length */}
        <View style={styles.section}>
          <View style={styles.lengthHeader}>
            <Text style={styles.sectionLabel}>Story Length</Text>
            <View style={styles.lengthBadge}>
              <Text style={styles.lengthBadgeText}>{lengthMinutes} min</Text>
            </View>
          </View>
          <View style={styles.lengthRow}>
            {LENGTH_OPTIONS.map((min) => {
              const sel = lengthMinutes === min;
              return (
                <Pressable
                  key={min}
                  style={({ pressed }) => [styles.lengthDot, sel && styles.lengthDotSelected, pressed && { opacity: 0.7 }]}
                  onPress={() => { tap(); setLengthMinutes(min); }}
                >
                  <Text style={[styles.lengthDotLabel, sel && styles.lengthDotLabelSelected]}>{min}</Text>
                </Pressable>
              );
            })}
          </View>
          <View style={styles.lengthRange}>
            <Text style={styles.lengthRangeLabel}>3 min</Text>
            <Text style={styles.lengthRangeLabel}>10 min</Text>
          </View>
        </View>

        {/* Language */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Story Language</Text>
          <View style={styles.languageRow}>
            {LANGUAGE_OPTIONS.map((opt) => {
              const sel = language === opt.label;
              return (
                <Pressable
                  key={opt.label}
                  style={({ pressed }) => [styles.languageChip, sel && styles.languageChipSelected, pressed && { opacity: 0.7 }]}
                  onPress={() => handleLanguageChange(opt.label)}
                >
                  <Text style={[styles.languageLabel, sel && styles.languageLabelSelected]}>{opt.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Voice */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Narrator Voice</Text>
          <Text style={styles.voiceHint}>Tap ▶ to preview a voice before selecting.</Text>
          <VoicePicker language={language} selectedVoiceId={voiceId} onVoiceSelect={setVoiceId} />
        </View>

        {/* Generate */}
        <Pressable
          style={({ pressed }) => [styles.generateBtn, pressed && styles.generateBtnPressed]}
          onPress={handleGenerate}
        >
          <IconSymbol name="wand.and.stars" size={22} color="#0D0B2B" />
          <Text style={styles.generateBtnText}>Generate Story</Text>
        </Pressable>

        {generateMutation.isError && (
          <Text style={styles.errorText}>Something went wrong. Please try again.</Text>
        )}
        <View style={{ height: 48 }} />
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: "#0D0B2B" },
  scrollContent: { paddingHorizontal: 20, paddingTop: 12 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 16, marginBottom: 8 },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: "#1A1740", borderWidth: 1.5, borderColor: Y, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 20, fontWeight: "700", color: "#F0EAF8" },
  section: { marginBottom: 28 },
  sectionLabel: { fontSize: 14, fontWeight: "600", color: "#9B8BB4", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 12 },
  textInput: { backgroundColor: "#1A1740", borderRadius: 14, borderWidth: 1.5, borderColor: "#2E2A5A", paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, color: "#F0EAF8" },
  customCharInput: { marginTop: 10, borderColor: Y },
  optionGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  chip: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#1A1740", borderRadius: 14, borderWidth: 1.5, borderColor: "#2E2A5A", paddingHorizontal: 14, paddingVertical: 10, minWidth: 90 },
  chipSelected: { borderColor: Y_BORDER, backgroundColor: Y_DIM },
  chipEmoji: { fontSize: 18 },
  chipLabel: { fontSize: 14, fontWeight: "500", color: "#9B8BB4" },
  chipLabelSelected: { color: Y, fontWeight: "700" },
  storyIdeaInput: { minHeight: 90, textAlignVertical: "top", paddingTop: 14 },
  optionalTag: { fontSize: 12, fontWeight: "400", color: "#4A4270", textTransform: "none", letterSpacing: 0 },
  charCount: { fontSize: 12, color: "#4A4270", textAlign: "right", marginTop: 6 },
  lengthHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 },
  lengthBadge: { backgroundColor: Y_DIM, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 4, borderWidth: 1.5, borderColor: Y },
  lengthBadgeText: { fontSize: 14, fontWeight: "700", color: Y },
  lengthRow: { flexDirection: "row", justifyContent: "space-between", gap: 6 },
  lengthDot: { flex: 1, aspectRatio: 1, borderRadius: 12, backgroundColor: "#1A1740", borderWidth: 1.5, borderColor: "#2E2A5A", alignItems: "center", justifyContent: "center", minHeight: 44 },
  lengthDotSelected: { backgroundColor: Y, borderColor: Y },
  lengthDotLabel: { fontSize: 14, fontWeight: "600", color: "#9B8BB4" },
  lengthDotLabelSelected: { color: "#0D0B2B", fontWeight: "800" },
  lengthRange: { flexDirection: "row", justifyContent: "space-between", marginTop: 8 },
  lengthRangeLabel: { fontSize: 12, color: "#4A4270" },
  languageRow: { flexDirection: "row", gap: 10 },
  languageChip: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#1A1740", borderRadius: 16, borderWidth: 1.5, borderColor: "#2E2A5A", paddingVertical: 14, paddingHorizontal: 8 },
  languageChipSelected: { borderColor: Y, backgroundColor: Y_DIM },
  languageLabel: { fontSize: 13, fontWeight: "600", color: "#9B8BB4", textAlign: "center" },
  languageLabelSelected: { color: Y },
  voiceHint: { fontSize: 12, color: "#4A4270", marginBottom: 10, fontStyle: "italic" },
  generateBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, backgroundColor: Y, borderRadius: 20, paddingVertical: 18, marginTop: 8, shadowColor: Y, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.5, shadowRadius: 12, elevation: 8 },
  generateBtnPressed: { transform: [{ scale: 0.97 }], opacity: 0.9 },
  generateBtnText: { fontSize: 18, fontWeight: "700", color: "#0D0B2B" },
  errorText: { color: "#F87171", textAlign: "center", marginTop: 12, fontSize: 14 },
});
