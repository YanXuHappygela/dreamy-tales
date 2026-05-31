import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Platform,
} from "react-native";
import * as Speech from "expo-speech";
import * as Haptics from "expo-haptics";
import { StoryLanguage } from "@/shared/types";

const Y = "#FFD580";
const Y_DIM = "#3D3010";

const LANGUAGE_PREFIXES: Record<StoryLanguage, string[]> = {
  English: ["en"], Mandarin: ["zh", "cmn"], Spanish: ["es"],
};

const PREVIEW_TEXT: Record<StoryLanguage, string> = {
  English: "Once upon a time, in a land of stars and moonlight…",
  Mandarin: "从前，在一个星光闪烁的地方……",
  Spanish: "Había una vez, en un lugar lleno de estrellas…",
};

export interface VoiceOption {
  identifier: string;
  name: string;
  language: string;
  quality: string;
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
  const previewingRef = useRef<string | null>(null);

  const loadVoices = useCallback(async () => {
    setLoading(true);
    setPreviewingId(null);
    previewingRef.current = null;
    try { await Speech.stop(); } catch { /**/ }

    try {
      if (Platform.OS === "web") { setVoices([]); setLoading(false); return; }
      const prefixes = LANGUAGE_PREFIXES[language];
      const all = await Speech.getAvailableVoicesAsync();
      const filtered: VoiceOption[] = all
        .filter((v) => prefixes.some((p) => (v.language ?? "").toLowerCase().startsWith(p.toLowerCase())))
        .map((v) => ({
          identifier: v.identifier,
          name: (v.name && v.name !== v.identifier) ? v.name : (v.language ?? v.identifier),
          language: v.language ?? "",
          quality: v.quality === Speech.VoiceQuality.Enhanced ? "Enhanced"
            : v.quality === Speech.VoiceQuality.Default ? "Default" : "",
        }))
        .reduce<VoiceOption[]>((acc, v) => {
          if (!acc.some((x) => x.identifier === v.identifier)) acc.push(v);
          return acc;
        }, [])
        .sort((a, b) => {
          if (a.quality === "Enhanced" && b.quality !== "Enhanced") return -1;
          if (a.quality !== "Enhanced" && b.quality === "Enhanced") return 1;
          return a.name.localeCompare(b.name);
        });

      setVoices(filtered);
      if (filtered.length > 0 && !filtered.some((v) => v.identifier === selectedVoiceId)) {
        onVoiceSelect((filtered.find((v) => v.quality === "Enhanced") ?? filtered[0]).identifier);
      }
    } catch { setVoices([]); } finally { setLoading(false); }
  }, [language]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    loadVoices();
    return () => { Speech.stop().catch(() => {}); };
  }, [loadVoices]);

  const handlePreview = useCallback(async (voice: VoiceOption) => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (previewingRef.current === voice.identifier) {
      await Speech.stop(); previewingRef.current = null; setPreviewingId(null); return;
    }
    await Speech.stop();
    previewingRef.current = voice.identifier;
    setPreviewingId(voice.identifier);
    Speech.speak(PREVIEW_TEXT[language], {
      voice: voice.identifier, language: voice.language, rate: 0.85, pitch: 1.0,
      onDone: () => { if (previewingRef.current === voice.identifier) { previewingRef.current = null; setPreviewingId(null); } },
      onStopped: () => { if (previewingRef.current === voice.identifier) { previewingRef.current = null; setPreviewingId(null); } },
      onError: () => { previewingRef.current = null; setPreviewingId(null); },
    });
  }, [language]);

  if (loading) {
    return (
      <View style={styles.loadingRow}>
        <ActivityIndicator size="small" color={Y} />
        <Text style={styles.loadingText}>Loading voices…</Text>
      </View>
    );
  }
  if (Platform.OS === "web") {
    return <View style={styles.infoBox}><Text style={styles.infoText}>Voice selection is available on iOS and Android. The device default voice will be used on web.</Text></View>;
  }
  if (voices.length === 0) {
    return <View style={styles.infoBox}><Text style={styles.infoText}>No {language} voices found on this device. Install additional voices in Accessibility → Spoken Content settings.</Text></View>;
  }

  return (
    <View style={styles.container}>
      {voices.map((voice, index) => {
        const isSelected = selectedVoiceId === voice.identifier;
        const isPreviewing = previewingId === voice.identifier;
        return (
          <TouchableOpacity
            key={`${voice.identifier}-${index}`}
            style={[styles.voiceRow, isSelected && styles.voiceRowSelected]}
            onPress={() => { if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onVoiceSelect(voice.identifier); }}
            activeOpacity={0.75}
          >
            <View style={[styles.radioOuter, isSelected && styles.radioOuterSelected]}>
              {isSelected && <View style={styles.radioInner} />}
            </View>
            <View style={styles.voiceInfo}>
              <View style={styles.voiceNameRow}>
                <Text style={[styles.voiceName, isSelected && styles.voiceNameSelected]} numberOfLines={1}>{voice.name}</Text>
                {voice.quality === "Enhanced" && (
                  <View style={styles.qualityBadge}><Text style={styles.qualityBadgeText}>HD</Text></View>
                )}
              </View>
              <Text style={styles.voiceLang}>{voice.language}</Text>
            </View>
            <TouchableOpacity
              style={[styles.previewBtn, isPreviewing && styles.previewBtnActive]}
              onPress={() => handlePreview(voice)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              activeOpacity={0.7}
            >
              <Text style={[styles.previewIcon, isPreviewing && styles.previewIconActive]}>{isPreviewing ? "■" : "▶"}</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 8 },
  loadingRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 14 },
  loadingText: { fontSize: 14, color: "#9B8BB4" },
  infoBox: { backgroundColor: "#1A1740", borderRadius: 14, borderWidth: 1, borderColor: "#2E2A5A", padding: 14 },
  infoText: { fontSize: 13, color: "#9B8BB4", lineHeight: 20 },
  voiceRow: { flexDirection: "row", alignItems: "center", backgroundColor: "#1A1740", borderRadius: 14, borderWidth: 1.5, borderColor: "#2E2A5A", paddingHorizontal: 14, paddingVertical: 13, gap: 12 },
  voiceRowSelected: { borderColor: Y, backgroundColor: Y_DIM },
  radioOuter: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: "#4A4270", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  radioOuterSelected: { borderColor: Y },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: Y },
  voiceInfo: { flex: 1, minWidth: 0 },
  voiceNameRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 3 },
  voiceName: { fontSize: 14, fontWeight: "600", color: "#9B8BB4", flexShrink: 1 },
  voiceNameSelected: { color: Y },
  qualityBadge: { backgroundColor: Y_DIM, borderRadius: 5, paddingHorizontal: 5, paddingVertical: 1, flexShrink: 0 },
  qualityBadgeText: { fontSize: 10, fontWeight: "700", color: Y, letterSpacing: 0.5 },
  voiceLang: { fontSize: 12, color: "#4A4270" },
  previewBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: Y, alignItems: "center", justifyContent: "center", flexShrink: 0, elevation: 4 },
  previewBtnActive: { backgroundColor: "#F87171" },
  previewIcon: { fontSize: 14, color: "#0D0B2B", fontWeight: "700" },
  previewIconActive: { color: "#FFFFFF" },
});
