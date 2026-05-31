import React, { useEffect, useState, useCallback, useRef } from "react";
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

// Short preview sentence per language
const PREVIEW_TEXT: Record<StoryLanguage, string> = {
  English: "Once upon a time, in a land of stars and moonlight…",
  Mandarin: "从前，在一个星光闪烁的地方……",
  Spanish: "Había una vez, en un lugar lleno de estrellas…",
};

export interface VoiceOption {
  identifier: string;
  name: string;
  language: string;
  quality: string; // "Enhanced" | "Default" | ""
}

interface VoicePickerProps {
  language: StoryLanguage;
  selectedVoiceId: string | undefined;
  onVoiceSelect: (voiceId: string) => void;
}

export function VoicePicker({
  language,
  selectedVoiceId,
  onVoiceSelect,
}: VoicePickerProps) {
  const [voices, setVoices] = useState<VoiceOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewingId, setPreviewingId] = useState<string | null>(null);
  const previewingRef = useRef<string | null>(null);

  const loadVoices = useCallback(async () => {
    setLoading(true);
    setPreviewingId(null);
    previewingRef.current = null;

    // Stop any ongoing speech when language changes
    try {
      await Speech.stop();
    } catch {
      // ignore
    }

    try {
      const prefixes = LANGUAGE_PREFIXES[language];

      if (Platform.OS === "web") {
        // expo-speech voice enumeration is not reliable on web
        setVoices([]);
        setLoading(false);
        return;
      }

      const all = await Speech.getAvailableVoicesAsync();

      const filtered: VoiceOption[] = all
        .filter((v) =>
          prefixes.some((prefix) =>
            (v.language ?? "").toLowerCase().startsWith(prefix.toLowerCase())
          )
        )
      .map((v) => ({
        identifier: v.identifier,
        name: v.name ?? v.identifier,
        language: v.language ?? "",
        quality:
          v.quality === Speech.VoiceQuality.Enhanced
            ? "Enhanced"
            : v.quality === Speech.VoiceQuality.Default
            ? "Default"
            : "",
      }))
      // Deduplicate: keep first occurrence of each unique identifier
      // Some devices return the same identifier multiple times with different metadata
      .reduce<VoiceOption[]>((acc, v) => {
        if (!acc.some((x) => x.identifier === v.identifier)) {
          acc.push(v);
        }
        return acc;
      }, [])
        // Sort: Enhanced voices first, then alphabetically by name
        .sort((a, b) => {
          if (a.quality === "Enhanced" && b.quality !== "Enhanced") return -1;
          if (a.quality !== "Enhanced" && b.quality === "Enhanced") return 1;
          return a.name.localeCompare(b.name);
        });

      setVoices(filtered);

      // Auto-select the first Enhanced voice, or the first voice overall
      if (filtered.length > 0) {
        const currentStillValid = filtered.some(
          (v) => v.identifier === selectedVoiceId
        );
        if (!currentStillValid) {
          const preferred =
            filtered.find((v) => v.quality === "Enhanced") ?? filtered[0];
          onVoiceSelect(preferred.identifier);
        }
      }
    } catch (err) {
      console.warn("[VoicePicker] Failed to load voices:", err);
      setVoices([]);
    } finally {
      setLoading(false);
    }
  }, [language]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    loadVoices();
    return () => {
      // Stop preview when component unmounts or language changes
      Speech.stop().catch(() => {});
    };
  }, [loadVoices]);

  const handlePreview = useCallback(
    async (voice: VoiceOption) => {
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }

      // If already previewing this voice, stop it
      if (previewingRef.current === voice.identifier) {
        await Speech.stop();
        previewingRef.current = null;
        setPreviewingId(null);
        return;
      }

      // Stop any currently playing preview
      await Speech.stop();

      previewingRef.current = voice.identifier;
      setPreviewingId(voice.identifier);

      Speech.speak(PREVIEW_TEXT[language], {
        voice: voice.identifier,
        language: voice.language,
        rate: 0.85,
        pitch: 1.0,
        onDone: () => {
          if (previewingRef.current === voice.identifier) {
            previewingRef.current = null;
            setPreviewingId(null);
          }
        },
        onStopped: () => {
          if (previewingRef.current === voice.identifier) {
            previewingRef.current = null;
            setPreviewingId(null);
          }
        },
        onError: () => {
          previewingRef.current = null;
          setPreviewingId(null);
        },
      });
    },
    [language]
  );

  const handleSelect = useCallback(
    (voice: VoiceOption) => {
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      onVoiceSelect(voice.identifier);
    },
    [onVoiceSelect]
  );

  // ── Render states ────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={styles.loadingRow}>
        <ActivityIndicator size="small" color="#C8A2E8" />
        <Text style={styles.loadingText}>Loading voices…</Text>
      </View>
    );
  }

  if (Platform.OS === "web") {
    return (
      <View style={styles.infoBox}>
        <Text style={styles.infoText}>
          Voice selection is available on iOS and Android devices. On the web
          preview, the device default voice will be used.
        </Text>
      </View>
    );
  }

  if (voices.length === 0) {
    return (
      <View style={styles.infoBox}>
        <Text style={styles.infoText}>
          No {language} voices found on this device. You can install additional
          voices in your device's Accessibility → Spoken Content settings.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {voices.map((voice, index) => {
        const isSelected = selectedVoiceId === voice.identifier;
        const isPreviewing = previewingId === voice.identifier;

        return (
          <Pressable
            key={`${voice.identifier}-${index}`}
            style={({ pressed }) => [
              styles.voiceRow,
              isSelected && styles.voiceRowSelected,
              pressed && styles.voiceRowPressed,
            ]}
            onPress={() => handleSelect(voice)}
          >
            {/* Radio button */}
            <View
              style={[
                styles.radioOuter,
                isSelected && styles.radioOuterSelected,
              ]}
            >
              {isSelected && <View style={styles.radioInner} />}
            </View>

            {/* Voice info */}
            <View style={styles.voiceInfo}>
              <View style={styles.voiceNameRow}>
                <Text
                  style={[
                    styles.voiceName,
                    isSelected && styles.voiceNameSelected,
                  ]}
                  numberOfLines={1}
                >
                  {voice.name}
                </Text>
                {voice.quality === "Enhanced" && (
                  <View style={styles.qualityBadge}>
                    <Text style={styles.qualityBadgeText}>HD</Text>
                  </View>
                )}
              </View>
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
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text
                style={[
                  styles.previewIcon,
                  isPreviewing && styles.previewIconActive,
                ]}
              >
                {isPreviewing ? "■" : "▶"}
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
    paddingVertical: 14,
  },
  loadingText: {
    fontSize: 14,
    color: "#9B8BB4",
  },
  infoBox: {
    backgroundColor: "#1A1740",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#2E2A5A",
    padding: 14,
  },
  infoText: {
    fontSize: 13,
    color: "#9B8BB4",
    lineHeight: 20,
  },
  voiceRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1A1740",
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "#2E2A5A",
    paddingHorizontal: 14,
    paddingVertical: 13,
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
    flexShrink: 0,
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
    minWidth: 0,
  },
  voiceNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 3,
  },
  voiceName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#9B8BB4",
    flexShrink: 1,
  },
  voiceNameSelected: {
    color: "#C8A2E8",
  },
  qualityBadge: {
    backgroundColor: "#3D2F6A",
    borderRadius: 5,
    paddingHorizontal: 5,
    paddingVertical: 1,
    flexShrink: 0,
  },
  qualityBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#C8A2E8",
    letterSpacing: 0.5,
  },
  voiceLang: {
    fontSize: 12,
    color: "#4A4270",
  },
  previewBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#C8A2E8",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    shadowColor: "#C8A2E8",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.45,
    shadowRadius: 6,
    elevation: 4,
  },
  previewBtnActive: {
    backgroundColor: "#F87171",
    shadowColor: "#F87171",
  },
  previewIcon: {
    fontSize: 14,
    color: "#0D0B2B",
    fontWeight: "700",
  },
  previewIconActive: {
    color: "#FFFFFF",
  },
});
