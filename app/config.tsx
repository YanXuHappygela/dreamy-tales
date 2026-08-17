import React, { useState, useRef, useCallback } from "react";
import {
  View, Text, ScrollView, FlatList, TouchableOpacity, TextInput,
  StyleSheet, Platform, Dimensions, Animated, Alert,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { trpc } from "@/lib/trpc";
import { GeneratedStory } from "@/shared/types";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { LoadingStory } from "@/components/loading-story";
import { loadSettings } from "@/app/settings";
import { saveActiveStory } from "@/lib/story-navigation";
import { buildSettingsSummary } from "@/lib/settings-summary";

const Y = "#FFD580";
const Y_DIM = "#3D3010";
const { width: SCREEN_W } = Dimensions.get("window");
const CARD_W = 120;
const CARD_H = 130;
const CARD_GAP = 14;

const CHARACTER_OPTIONS = [
  { label: "Bunny", emoji: "🐰" }, { label: "Dragon", emoji: "🐉" },
  { label: "Princess", emoji: "👸" }, { label: "Robot", emoji: "🤖" },
  { label: "Unicorn", emoji: "🦄" }, { label: "Bear", emoji: "🐻" },
  { label: "Race Car", emoji: "🏎️" }, { label: "Dolphin", emoji: "🐬" },
  { label: "Custom", emoji: "✏️" },
];
const SCENARIO_OPTIONS = [
  { label: "Forest", emoji: "🌲" }, { label: "Space", emoji: "🚀" },
  { label: "Ocean", emoji: "🌊" }, { label: "Castle", emoji: "🏰" },
  { label: "Jungle", emoji: "🌴" }, { label: "Cloud Kingdom", emoji: "☁️" },
  { label: "Volcano", emoji: "🌋" }, { label: "Desert", emoji: "🏜️" },
  { label: "Mountain", emoji: "⛰️" },
];
const STYLE_OPTIONS = [
  { label: "Funny", emoji: "😄" }, { label: "Magical", emoji: "✨" },
  { label: "Adventurous", emoji: "🗺️" }, { label: "Cozy", emoji: "🛋️" },
  { label: "Mysterious", emoji: "🔮" }, { label: "Silly", emoji: "🤪" },
];
const LENGTH_OPTIONS = [
  { label: "Short", sublabel: "~5 mins", value: 5 },
  { label: "Mid", sublabel: "~8 mins", value: 8 },
  { label: "Long", sublabel: "10 mins", value: 10 },
];

// ── Horizontal swipeable card carousel ──────────────────────────────────────
interface CardOption { label: string; emoji: string }
interface CardCarouselProps {
  options: CardOption[];
  selected: string;
  onSelect: (label: string) => void;
}
function CardCarousel({ options, selected, onSelect }: CardCarouselProps) {
  const flatRef = useRef<FlatList>(null);
  const selectedIdx = options.findIndex((o) => o.label === selected);

  const handlePress = useCallback((label: string, idx: number) => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onSelect(label);
    flatRef.current?.scrollToIndex({ index: idx, animated: true, viewPosition: 0.5 });
  }, [onSelect]);

  return (
    <FlatList
      ref={flatRef}
      data={options}
      keyExtractor={(item) => item.label}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.carouselContent}
      ItemSeparatorComponent={() => <View style={{ width: CARD_GAP }} />}
      initialScrollIndex={Math.max(0, selectedIdx)}
      getItemLayout={(_, index) => ({
        length: CARD_W + CARD_GAP,
        offset: (CARD_W + CARD_GAP) * index,
        index,
      })}
      renderItem={({ item, index }) => {
        const sel = selected === item.label;
        return (
          <TouchableOpacity
            style={[styles.card, sel && styles.cardSelected]}
            onPress={() => handlePress(item.label, index)}
            activeOpacity={0.75}
          >
            <Text style={styles.cardEmoji}>{item.emoji}</Text>
            <Text style={[styles.cardLabel, sel && styles.cardLabelSelected]}>
              {item.label}
            </Text>
            {sel && <View style={styles.cardDot} />}
          </TouchableOpacity>
        );
      }}
    />
  );
}

// ── Main screen ──────────────────────────────────────────────────────────────
export default function ConfigScreen() {
  const router = useRouter();
  const [characterType, setCharacterType] = useState("Bunny");
  const [customCharacter, setCustomCharacter] = useState("");
  const [storyIdea, setStoryIdea] = useState("");
  const [scenario, setScenario] = useState("Forest");
  const [storyStyle, setStoryStyle] = useState("Magical");
  const [lengthMinutes, setLengthMinutes] = useState(5);
  const [settingsSummary, setSettingsSummary] = useState("");

  const refreshSettingsSummary = useCallback(async () => {
    const settings = await loadSettings();
    setSettingsSummary(buildSettingsSummary(settings));
  }, []);

  // Settings is a separate route; refresh when returning so the banner never shows stale values.
  useFocusEffect(useCallback(() => {
    void refreshSettingsSummary();
  }, [refreshSettingsSummary]));

  const generateMutation = trpc.story.generate.useMutation({
    onSuccess: async (data: GeneratedStory) => {
      try {
        const storyId = await saveActiveStory(data);
        router.push({ pathname: "/story", params: { storyId } } as any);
      } catch {
        Alert.alert("Could not open story", "Your story was created, but could not be saved on this device. Please try again.");
      }
    },
  });

  const handleGenerate = async () => {
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const settings = await loadSettings();
    generateMutation.mutate({
      childName: settings.childName?.trim() || "the little one",
      characterType,
      customCharacter: characterType === "Custom" ? customCharacter.trim() : undefined,
      scenario: scenario as any,
      style: storyStyle as any,
      lengthMinutes,
      language: settings.language,
      ageGroup: settings.ageGroup,
      voiceId: settings.voiceId,
      voiceLanguageCode: settings.voiceLanguageCode,
      storyIdea: storyIdea.trim() || undefined,
    });
  };

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
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
            <IconSymbol name="chevron.left" size={22} color={Y} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Create a Story</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Settings summary banner */}
        {settingsSummary.length > 0 && (
          <TouchableOpacity
            style={styles.settingsBanner}
            onPress={() => router.push("/settings" as any)}
            activeOpacity={0.8}
          >
            <Text style={styles.settingsBannerText}>{settingsSummary}</Text>
            <IconSymbol name="gearshape.fill" size={16} color={Y} />
          </TouchableOpacity>
        )}

        {/* ── Main Character ── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Main Character</Text>
          <CardCarousel
            options={CHARACTER_OPTIONS}
            selected={characterType}
            onSelect={setCharacterType}
          />
          {characterType === "Custom" && (
            <TextInput
              style={[styles.textInput, { marginTop: 12, borderColor: Y }]}
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

        {/* ── Story Setting ── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Story Setting</Text>
          <CardCarousel
            options={SCENARIO_OPTIONS}
            selected={scenario}
            onSelect={setScenario}
          />
        </View>

        {/* ── Story Style ── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Story Style</Text>
          <CardCarousel
            options={STYLE_OPTIONS}
            selected={storyStyle}
            onSelect={setStoryStyle}
          />
        </View>

        {/* ── Story Idea ── */}
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

        {/* ── Story Length ── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Story Length</Text>
          <View style={styles.lengthRow}>
            {LENGTH_OPTIONS.map((opt) => {
              const sel = lengthMinutes === opt.value;
              return (
                <TouchableOpacity
                  key={opt.value}
                  style={[styles.lengthChip, sel && styles.lengthChipSelected]}
                  onPress={() => {
                    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setLengthMinutes(opt.value);
                  }}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.lengthLabel, sel && styles.lengthLabelSelected]}>
                    {opt.label}
                  </Text>
                  <Text style={[styles.lengthSub, sel && styles.lengthSubSelected]}>
                    {opt.sublabel}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* ── Generate Button ── */}
        <TouchableOpacity
          style={styles.generateBtn}
          onPress={handleGenerate}
          activeOpacity={0.8}
        >
          <IconSymbol name="wand.and.stars" size={22} color="#0D0B2B" />
          <Text style={styles.generateBtnText}>Generate Story</Text>
        </TouchableOpacity>

        {generateMutation.isError && (
          <Text style={styles.errorText}>
            {(generateMutation.error as any)?.message || "Something went wrong. Please try again."}
          </Text>
        )}
        <View style={{ height: 48 }} />
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: "#0D0B2B" },
  scrollContent: { paddingTop: 12 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 16, marginBottom: 4 },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: "#1A1740", borderWidth: 1.5, borderColor: Y, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 20, fontWeight: "700", color: "#F0EAF8" },
  settingsBanner: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#1A1740", borderRadius: 14, borderWidth: 1.5, borderColor: Y, paddingHorizontal: 16, paddingVertical: 12, marginHorizontal: 20, marginBottom: 24, gap: 8 },
  settingsBannerText: { flex: 1, fontSize: 13, color: Y, fontWeight: "500" },
  section: { marginBottom: 28 },
  sectionLabel: { fontSize: 14, fontWeight: "600", color: "#9B8BB4", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 14, paddingHorizontal: 20 },
  // Card carousel
  carouselContent: { paddingHorizontal: 20 },
  card: {
    width: CARD_W, height: CARD_H,
    borderRadius: 20, backgroundColor: "#1A1740",
    borderWidth: 2, borderColor: "#2E2A5A",
    alignItems: "center", justifyContent: "center",
    gap: 8, paddingVertical: 12,
  },
  cardSelected: { borderColor: Y, backgroundColor: Y_DIM },
  cardEmoji: { fontSize: 44, lineHeight: 52 },
  cardLabel: { fontSize: 13, fontWeight: "600", color: "#9B8BB4", textAlign: "center" },
  cardLabelSelected: { color: Y, fontWeight: "700" },
  cardDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Y },
  // Text inputs
  textInput: { backgroundColor: "#1A1740", borderRadius: 14, borderWidth: 1.5, borderColor: "#2E2A5A", paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, color: "#F0EAF8", marginHorizontal: 20 },
  storyIdeaInput: { minHeight: 90, textAlignVertical: "top", paddingTop: 14 },
  optionalTag: { fontSize: 12, fontWeight: "400", color: "#4A4270", textTransform: "none", letterSpacing: 0 },
  charCount: { fontSize: 12, color: "#4A4270", textAlign: "right", marginTop: 6, marginHorizontal: 20 },
  // Length chips
  lengthRow: { flexDirection: "row", gap: 12, paddingHorizontal: 20 },
  lengthChip: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#1A1740", borderRadius: 18, borderWidth: 2, borderColor: "#2E2A5A", paddingVertical: 18 },
  lengthChipSelected: { borderColor: Y, backgroundColor: Y_DIM },
  lengthLabel: { fontSize: 17, fontWeight: "700", color: "#9B8BB4" },
  lengthLabelSelected: { color: Y },
  lengthSub: { fontSize: 12, color: "#4A4270", marginTop: 4 },
  lengthSubSelected: { color: "#C8A060" },
  // Generate button
  generateBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, backgroundColor: Y, borderRadius: 20, paddingVertical: 18, marginHorizontal: 20, marginTop: 8, elevation: 8 },
  generateBtnText: { fontSize: 18, fontWeight: "700", color: "#0D0B2B" },
  errorText: { color: "#F87171", textAlign: "center", marginTop: 12, fontSize: 14, marginHorizontal: 20 },
});
