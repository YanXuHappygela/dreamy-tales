import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from "react-native";
import * as Speech from "expo-speech";
import * as Haptics from "expo-haptics";
import { StoryLanguage } from "@/shared/types";

// BCP-47 language code prefixes for each supported language
const LANGUAGE_PREFIXES: Record<StoryLanguage, string[]> = {
  English: ["en"],
  Mandarin: ["zh", "cmn"],
  Spanish: ["es"],
};

// Fallback built-in voices when device has none for a language
const FALLBACK_VOICES: Record<StoryLanguage, { identifier: string; name: string; language: string }[]> = {
  English: [
    { identifier: "en-US", name: "English (US)", language: "en-US" },
    { identifier: "en-GB", name: "English (UK)", language: "en-GB" },
    { identifier: "en-AU", name: "English (AU)", language: "en-AU" },
  ],
  Mandarin: [
    { identifier: "zh-CN", name: "普通话 (中国大陆)", language: "zh-CN" },
    { identifier: "zh-TW", name: "國語 (台灣)", language: "zh-TW" },
    { identifier: "zh-HK", name: "廣東話 (香港)", language: "zh-HK" },
  ],
  Spanish: [
    { identifier: "es-ES", name: "Español (España)", language: "es-ES" },
    { identifier: "es-MX", name: "Español (México)", language: "es-MX" },
    { identifier: "es-US", name: "Español (EE.UU.)", language: "es-US" },
  ],
};

export interface VoiceOption {
  identifier: string;
  name: string;
  language: string;
  quality?: string;
}

interface VoicePickerProps {
  language: StoryLanguage;
  selectedVoiceId: string | undefined;
  onVoiceSelect: (voiceId: string) => void;
}

export function VoicePicker({ language, selectedVoiceId, onVoiceSelect }: VoicePickerProps) {
  const [voices, setVoices] = useState<VoiceOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewingId, setPreviewingId] = useState<string | null>(null);

  const loadVoices = useCallback(async () => {
    setLoading(true);
    try {
      const prefixes = LANGUAGE_PREFIXES[language];
      let available: VoiceOption[] = [];

      if (Platform.OS !== "web") {
        const all = await Speech.getAvailableVoicesAsync();
        available = all
          .filter((v) =>
            prefixes.some((prefix) =>
              v.language?.toLowerCase().startsWith(prefix.toLowerCase())
            )
          )
          .map((v) => ({
            identifier: v.identifier,
            name: v.name,
            language: v.language,
            quality: v.quality,
          }));
      }

      // Always include fallback voices, deduplicating by identifier
      const fallbacks = FALLBACK_VOICES[language];
      const existingIds = new Set(available.map((v) => v.identifier));
      const merged = [
        ...available,
        ...fallbacks.filter((f) => !existingIds.has(f.identifier)),
      ];

      setVoices(merged);

      // Auto-select the first voice if none selected yet
      if (!selectedVoiceId && merged.length > 0) {
        onVoiceSelect(merged[0].identifier);
      }
    } catch {
      // Fall back gracefully
      const fallbacks = FALLBACK_VOICES[language];
      setVoices(fallbacks);
      if (!selectedVoiceId && fallbacks.length > 0) {
        onVoiceSelect(fallbacks[0].identifier);
      }
    } finally {
      setLoading(false);
    }
  }, [language, selectedVoiceId, onVoiceSelect]);

  useEffect(() => {
    loadVoices();
  }, [loadVoices]);

  const handlePreview = async (voice: VoiceOption) => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    await Speech.stop();
    setPreviewingId(voice.identifier);

    const previewText: Record<StoryLanguage, string> = {
      English: "Once upon a time, in a land far away…",
      Mandarin: "从前，在一个遥远的地方……",
      Spanish: "Había una vez, en un lugar muy lejano…",
    };

    Speech.speak(previewText[language], {
      voice: voice.identifier,
      rate: 0.85,
      pitch: 1.05,
      language: voice.language,
      onDone: () => setPreviewingId(null),
      onStopped: () => setPreviewingId(null),
      onError: () => setPreviewingId(null),
    });
  };

  if (loading) {
    return (
      <View style={styles.loadingRow}>
        <ActivityIndicator size="small" color="#C8A2E8" />
        <Text style={styles.loadingText}>Loading voices…</Text>
      </View>
    );
  }

  if (voices.length === 0) {
    return (
      <Text style={styles.emptyText}>
        No voices available for this language on your device.
      </Text>
    );
  }

  return (
    <View style={styles.container}>
      {voices.map((voice) => {
        const isSelected = selectedVoiceId === voice.identifier;
        const isPreviewing = previewingId === voice.identifier;

        return (
          <Pressable
            key={voice.identifier}
            style={({ pressed }) => [
              styles.voiceRow,
              isSelected && styles.voiceRowSelected,
              pressed && styles.voiceRowPressed,
            ]}
            onPress={() => {
              if (Platform.OS !== "web") {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }
              onVoiceSelect(voice.identifier);
            }}
          >
            {/* Selection indicator */}
            <View style={[styles.radioOuter, isSelected && styles.radioOuterSelected]}>
              {isSelected && <View style={styles.radioInner} />}
            </View>

            {/* Voice info */}
            <View style={styles.voiceInfo}>
              <Text style={[styles.voiceName, isSelected && styles.voiceNameSelected]}>
                {voice.name}
              </Text>
              <Text style={styles.voiceLang}>{voice.language}</Text>
            </View>

            {/* Preview button */}
            <Pressable
              style={({ pressed }) => [
                styles.previewBtn,
                isPreviewing && styles.previewBtnActive,
                pressed && { opacity: 0.6 },
              ]}
              onPress={() => handlePreview(voice)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={[styles.previewBtnText, isPreviewing && styles.previewBtnTextActive]}>
                {isPreviewing ? "▶" : "▷"}
              </Text>
            </Pressable>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
  },
  loadingText: {
    fontSize: 14,
    color: "#9B8BB4",
  },
  emptyText: {
    fontSize: 14,
    color: "#9B8BB4",
    fontStyle: "italic",
    paddingVertical: 8,
  },
  voiceRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1A1740",
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "#2E2A5A",
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
  },
  voiceRowSelected: {
    borderColor: "#C8A2E8",
    backgroundColor: "#2A1F4A",
  },
  voiceRowPressed: {
    opacity: 0.75,
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#4A4270",
    alignItems: "center",
    justifyContent: "center",
  },
  radioOuterSelected: {
    borderColor: "#C8A2E8",
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#C8A2E8",
  },
  voiceInfo: {
    flex: 1,
  },
  voiceName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#9B8BB4",
    marginBottom: 2,
  },
  voiceNameSelected: {
    color: "#C8A2E8",
  },
  voiceLang: {
    fontSize: 12,
    color: "#4A4270",
  },
  previewBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#2E2A5A",
    alignItems: "center",
    justifyContent: "center",
  },
  previewBtnActive: {
    backgroundColor: "#C8A2E8",
  },
  previewBtnText: {
    fontSize: 14,
    color: "#9B8BB4",
  },
  previewBtnTextActive: {
    color: "#0D0B2B",
  },
});
