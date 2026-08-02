import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Platform, Alert,
} from "react-native";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";

import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { VoicePicker } from "@/components/voice-picker";
import { AgeGroup, StoryLanguage } from "@/shared/types";

const Y = "#FFD580";
const Y_DIM = "#3D3010";

export const SETTINGS_KEY = "dreamy_tales_settings";

export interface AppSettings {
  childName: string;
  ageGroup: AgeGroup;
  language: StoryLanguage;
  voiceId?: string;
  voiceLanguageCode?: string;
}

const DEFAULT_SETTINGS: AppSettings = {
  childName: "",
  ageGroup: "5-6",
  language: "English",
  voiceId: undefined,
  voiceLanguageCode: undefined,
};

const AGE_GROUPS: AgeGroup[] = ["3-4", "5-6", "7-8", "8+"];
const LANGUAGES: StoryLanguage[] = ["English", "Mandarin", "Spanish"];

export async function loadSettings(): Promise<AppSettings> {
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_KEY);
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch { /**/ }
  return { ...DEFAULT_SETTINGS };
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  try {
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch { /**/ }
}

export default function SettingsScreen() {
  const router = useRouter();
  const [childName, setChildName] = useState("");
  const [ageGroup, setAgeGroup] = useState<AgeGroup>("5-6");
  const [language, setLanguage] = useState<StoryLanguage>("English");
  const [voiceId, setVoiceId] = useState<string | undefined>(undefined);
  const [voiceLanguageCode, setVoiceLanguageCode] = useState<string | undefined>(undefined);
  const [loaded, setLoaded] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    loadSettings().then((s) => {
      setChildName(s.childName);
      setAgeGroup(s.ageGroup);
      setLanguage(s.language);
      setVoiceId(s.voiceId);
      setVoiceLanguageCode(s.voiceLanguageCode);
      setLoaded(true);
    });
  }, []);

  const handleLanguageChange = useCallback((lang: StoryLanguage) => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setLanguage(lang);
    setVoiceId(undefined);
    setVoiceLanguageCode(undefined);
    setSaved(false);
  }, []);

  const handleVoiceSelect = useCallback((id: string, langCode: string) => {
    setVoiceId(id);
    setVoiceLanguageCode(langCode);
    setSaved(false);
  }, []);

  const handleSave = async () => {
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await saveSettings({ childName: childName.trim(), ageGroup, language, voiceId, voiceLanguageCode });
    setSaved(true);
    setTimeout(() => router.back(), 600);
  };

  const tap = () => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSaved(false);
  };

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
          <Text style={styles.headerTitle}>Settings</Text>
          <View style={{ width: 40 }} />
        </View>

        <Text style={styles.sectionDesc}>
          These preferences are used as defaults every time you create a new story.
        </Text>

        {/* Child Name */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Child's Name (optional)</Text>
          <TextInput
            style={styles.textInput}
            placeholder="e.g. Emma, Liam…"
            placeholderTextColor="#4A4270"
            value={childName}
            onChangeText={(v) => { setChildName(v); setSaved(false); }}
            maxLength={30}
            returnKeyType="done"
          />
          <Text style={styles.hint}>Used to personalise the story (e.g. "Emma's adventure").</Text>
        </View>

        {/* Age Group */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Child's Age</Text>
          <View style={styles.chipRow}>
            {AGE_GROUPS.map((ag) => {
              const sel = ageGroup === ag;
              return (
                <TouchableOpacity
                  key={ag}
                  style={[styles.chip, sel && styles.chipSelected]}
                  onPress={() => { tap(); setAgeGroup(ag); }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.chipLabel, sel && styles.chipLabelSelected]}>{ag} yrs</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <Text style={styles.hint}>Adjusts vocabulary and story complexity.</Text>
        </View>

        {/* Language */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Story Language</Text>
          <View style={styles.chipRow}>
            {LANGUAGES.map((lang) => {
              const sel = language === lang;
              return (
                <TouchableOpacity
                  key={lang}
                  style={[styles.chip, sel && styles.chipSelected]}
                  onPress={() => handleLanguageChange(lang)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.chipLabel, sel && styles.chipLabelSelected]}>{lang}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <Text style={styles.hint}>The language the story is written and narrated in.</Text>
        </View>

        {/* Voice */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Narrator Voice</Text>
          <Text style={styles.hint}>Tap ▶ to preview a voice before selecting.</Text>
          {loaded && (
            <VoicePicker
              language={language}
              selectedVoiceId={voiceId}
              onVoiceSelect={handleVoiceSelect}
            />
          )}
        </View>

        {/* Save button */}
        <TouchableOpacity
          style={[styles.saveBtn, saved && styles.saveBtnDone]}
          onPress={handleSave}
          activeOpacity={0.8}
        >
          <IconSymbol name={saved ? "checkmark" : "gearshape.fill"} size={20} color="#0D0B2B" />
          <Text style={styles.saveBtnText}>{saved ? "Saved!" : "Save Settings"}</Text>
        </TouchableOpacity>

        <View style={{ height: 48 }} />
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: "#0D0B2B" },
  scrollContent: { paddingHorizontal: 20, paddingTop: 12 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 16, marginBottom: 4 },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: "#1A1740", borderWidth: 1.5, borderColor: Y, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 22, fontWeight: "700", color: "#F0EAF8" },
  sectionDesc: { fontSize: 14, color: "#9B8BB4", marginBottom: 24, lineHeight: 20 },
  section: { marginBottom: 28 },
  sectionLabel: { fontSize: 14, fontWeight: "600", color: "#9B8BB4", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 12 },
  hint: { fontSize: 12, color: "#4A4270", marginTop: 8, lineHeight: 16 },
  textInput: { backgroundColor: "#1A1740", borderRadius: 14, borderWidth: 1.5, borderColor: "#2E2A5A", paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, color: "#F0EAF8" },
  chipRow: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
  chip: { paddingHorizontal: 18, paddingVertical: 12, borderRadius: 16, backgroundColor: "#1A1740", borderWidth: 1.5, borderColor: "#2E2A5A" },
  chipSelected: { borderColor: Y, backgroundColor: Y_DIM },
  chipLabel: { fontSize: 15, fontWeight: "600", color: "#9B8BB4" },
  chipLabelSelected: { color: Y },
  saveBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, backgroundColor: Y, borderRadius: 20, paddingVertical: 18, marginTop: 8, elevation: 8 },
  saveBtnDone: { backgroundColor: "#7BE8A0" },
  saveBtnText: { fontSize: 18, fontWeight: "700", color: "#0D0B2B" },
});
