import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  StyleSheet,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { trpc } from "@/lib/trpc";
import { GeneratedStory } from "@/shared/types";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { LoadingStory } from "@/components/loading-story";
import { StarfieldBackground } from "@/components/starfield-background";

const CHARACTER_OPTIONS = [
  { label: "Bunny", emoji: "🐰" },
  { label: "Dragon", emoji: "🐉" },
  { label: "Princess", emoji: "👸" },
  { label: "Robot", emoji: "🤖" },
  { label: "Unicorn", emoji: "🦄" },
  { label: "Bear", emoji: "🐻" },
];

const SCENARIO_OPTIONS = [
  { label: "Forest", emoji: "🌲" },
  { label: "Space", emoji: "🚀" },
  { label: "Ocean", emoji: "🌊" },
  { label: "Castle", emoji: "🏰" },
  { label: "Jungle", emoji: "🌴" },
  { label: "Cloud Kingdom", emoji: "☁️" },
];

const STYLE_OPTIONS = [
  { label: "Funny", emoji: "😄" },
  { label: "Magical", emoji: "✨" },
  { label: "Adventurous", emoji: "🗺️" },
  { label: "Cozy", emoji: "🛋️" },
  { label: "Mysterious", emoji: "🔮" },
];

const LENGTH_OPTIONS = [3, 4, 5, 6, 7, 8, 9, 10];

export default function ConfigScreen() {
  const router = useRouter();
  const [childName, setChildName] = useState("");
  const [characterType, setCharacterType] = useState("Bunny");
  const [scenario, setScenario] = useState("Forest");
  const [storyStyle, setStoryStyle] = useState("Magical");
  const [lengthMinutes, setLengthMinutes] = useState(5);

  const generateMutation = trpc.story.generate.useMutation({
    onSuccess: (data: GeneratedStory) => {
      router.push({
        pathname: "/story",
        params: { storyData: JSON.stringify(data) },
      } as any);
    },
  });

  const handleGenerate = () => {
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    generateMutation.mutate({
      childName: childName.trim() || "the little one",
      characterType: characterType as
        | "Bunny"
        | "Dragon"
        | "Princess"
        | "Robot"
        | "Unicorn"
        | "Bear",
      scenario: scenario as
        | "Forest"
        | "Space"
        | "Ocean"
        | "Castle"
        | "Jungle"
        | "Cloud Kingdom",
      style: storyStyle as
        | "Funny"
        | "Magical"
        | "Adventurous"
        | "Cozy"
        | "Mysterious",
      lengthMinutes,
    });
  };

  const handleBack = () => {
    router.back();
  };

  // Show loading screen while generating
  if (generateMutation.isPending) {
    return (
      <ScreenContainer containerClassName="bg-background" safeAreaClassName="">
        <StarfieldBackground />
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
          <Pressable
            style={({ pressed }) => [
              styles.backBtn,
              pressed && { opacity: 0.6 },
            ]}
            onPress={handleBack}
          >
            <IconSymbol name="chevron.left" size={22} color="#C8A2E8" />
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

        {/* Character Type */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Main Character</Text>
          <View style={styles.optionGrid}>
            {CHARACTER_OPTIONS.map((opt) => (
              <Pressable
                key={opt.label}
                style={({ pressed }) => [
                  styles.optionChip,
                  characterType === opt.label && styles.optionChipSelected,
                  pressed && styles.optionChipPressed,
                ]}
                onPress={() => {
                  if (Platform.OS !== "web") {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }
                  setCharacterType(opt.label);
                }}
              >
                <Text style={styles.optionEmoji}>{opt.emoji}</Text>
                <Text
                  style={[
                    styles.optionLabel,
                    characterType === opt.label && styles.optionLabelSelected,
                  ]}
                >
                  {opt.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Scenario */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Story Setting</Text>
          <View style={styles.optionGrid}>
            {SCENARIO_OPTIONS.map((opt) => (
              <Pressable
                key={opt.label}
                style={({ pressed }) => [
                  styles.optionChip,
                  scenario === opt.label && styles.optionChipSelected,
                  pressed && styles.optionChipPressed,
                ]}
                onPress={() => {
                  if (Platform.OS !== "web") {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }
                  setScenario(opt.label);
                }}
              >
                <Text style={styles.optionEmoji}>{opt.emoji}</Text>
                <Text
                  style={[
                    styles.optionLabel,
                    scenario === opt.label && styles.optionLabelSelected,
                  ]}
                >
                  {opt.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Style */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Story Style</Text>
          <View style={styles.optionGrid}>
            {STYLE_OPTIONS.map((opt) => (
              <Pressable
                key={opt.label}
                style={({ pressed }) => [
                  styles.optionChip,
                  storyStyle === opt.label && styles.optionChipSelected,
                  pressed && styles.optionChipPressed,
                ]}
                onPress={() => {
                  if (Platform.OS !== "web") {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }
                  setStoryStyle(opt.label);
                }}
              >
                <Text style={styles.optionEmoji}>{opt.emoji}</Text>
                <Text
                  style={[
                    styles.optionLabel,
                    storyStyle === opt.label && styles.optionLabelSelected,
                  ]}
                >
                  {opt.label}
                </Text>
              </Pressable>
            ))}
          </View>
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
            {LENGTH_OPTIONS.map((min) => (
              <Pressable
                key={min}
                style={({ pressed }) => [
                  styles.lengthDot,
                  lengthMinutes === min && styles.lengthDotSelected,
                  pressed && { opacity: 0.7 },
                ]}
                onPress={() => {
                  if (Platform.OS !== "web") {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }
                  setLengthMinutes(min);
                }}
              >
                <Text
                  style={[
                    styles.lengthDotLabel,
                    lengthMinutes === min && styles.lengthDotLabelSelected,
                  ]}
                >
                  {min}
                </Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.lengthRange}>
            <Text style={styles.lengthRangeLabel}>3 min</Text>
            <Text style={styles.lengthRangeLabel}>10 min</Text>
          </View>
        </View>

        {/* Generate Button */}
        <Pressable
          style={({ pressed }) => [
            styles.generateBtn,
            pressed && styles.generateBtnPressed,
          ]}
          onPress={handleGenerate}
        >
          <IconSymbol name="wand.and.stars" size={22} color="#0D0B2B" />
          <Text style={styles.generateBtnText}>Generate Story</Text>
        </Pressable>

        {generateMutation.isError && (
          <Text style={styles.errorText}>
            Something went wrong. Please try again.
          </Text>
        )}

        <View style={{ height: 48 }} />
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: "#0D0B2B",
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
    marginBottom: 8,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#1A1740",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#F0EAF8",
  },
  section: {
    marginBottom: 28,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#9B8BB4",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  textInput: {
    backgroundColor: "#1A1740",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#2E2A5A",
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: "#F0EAF8",
  },
  optionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  optionChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#1A1740",
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "#2E2A5A",
    paddingHorizontal: 14,
    paddingVertical: 10,
    minWidth: 90,
  },
  optionChipSelected: {
    borderColor: "#C8A2E8",
    backgroundColor: "#2A1F4A",
  },
  optionChipPressed: {
    opacity: 0.75,
  },
  optionEmoji: {
    fontSize: 18,
  },
  optionLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: "#9B8BB4",
  },
  optionLabelSelected: {
    color: "#C8A2E8",
    fontWeight: "700",
  },
  lengthHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  lengthBadge: {
    backgroundColor: "#2A1F4A",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: "#C8A2E8",
  },
  lengthBadgeText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#C8A2E8",
  },
  lengthRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 6,
  },
  lengthDot: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 12,
    backgroundColor: "#1A1740",
    borderWidth: 1.5,
    borderColor: "#2E2A5A",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
  },
  lengthDotSelected: {
    backgroundColor: "#C8A2E8",
    borderColor: "#C8A2E8",
  },
  lengthDotLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#9B8BB4",
  },
  lengthDotLabelSelected: {
    color: "#0D0B2B",
    fontWeight: "800",
  },
  lengthRange: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
  },
  lengthRangeLabel: {
    fontSize: 12,
    color: "#4A4270",
  },
  generateBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: "#C8A2E8",
    borderRadius: 20,
    paddingVertical: 18,
    marginTop: 8,
    shadowColor: "#C8A2E8",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  generateBtnPressed: {
    transform: [{ scale: 0.97 }],
    opacity: 0.9,
  },
  generateBtnText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0D0B2B",
  },
  errorText: {
    color: "#F87171",
    textAlign: "center",
    marginTop: 12,
    fontSize: 14,
  },
});
