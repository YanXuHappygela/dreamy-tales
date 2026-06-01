import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Platform,
} from "react-native";
import { createAudioPlayer, setAudioModeAsync } from "expo-audio";
import * as Haptics from "expo-haptics";
import { trpc } from "@/lib/trpc";
import { StoryLanguage } from "@/shared/types";

const Y = "#FFD580";
const Y_DIM = "#3D3010";

const PREVIEW_TEXT: Record<StoryLanguage, string> = {
  English: "Once upon a time, in a land of stars and moonlight…",
  Mandarin: "从前，在一个星光闪烁的地方……",
  Spanish: "Había una vez, en un lugar lleno de estrellas…",
};

const TIER_COLORS: Record<string, string> = {
  WaveNet: "#B8D4FF",
  Standard: "#6B8AAA",
};

type GenderFilter = "Female" | "Male";

export interface CloudVoiceOption {
  id: string;
  name: string;
  language: string;
  gender: string;
  tier: string;
}

interface VoicePickerProps {
  language: StoryLanguage;
  selectedVoiceId: string | undefined;
  onVoiceSelect: (voiceId: string, languageCode: string) => void;
}

export function VoicePicker({ language, selectedVoiceId, onVoiceSelect }: VoicePickerProps) {
  const [genderFilter, setGenderFilter] = useState<GenderFilter>("Female");
  const [previewingId, setPreviewingId] = useState<string | null>(null);
  const previewingRef = useRef<string | null>(null);
  const previewPlayerRef = useRef<ReturnType<typeof createAudioPlayer> | null>(null);

  const { data, isLoading, isError } = trpc.tts.listVoices.useQuery(
    { language },
    { staleTime: 1000 * 60 * 10 }
  );

  const allVoices = data?.voices ?? [];

  // Apply gender filter
  const voices = allVoices.filter((v) => v.gender === genderFilter);

  // Auto-select first WaveNet voice when list loads or language/filter changes
  useEffect(() => {
    if (allVoices.length === 0) return;
    const currentValid = voices.some((v) => v.id === selectedVoiceId);
    if (!currentValid) {
      const preferred =
        voices.find((v) => v.tier === "WaveNet") ?? voices[0];
      if (preferred) onVoiceSelect(preferred.id, preferred.language);
    }
  }, [allVoices, language, genderFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    return () => {
      previewPlayerRef.current?.remove();
      previewPlayerRef.current = null;
    };
  }, []);

  const synthesizeMutation = trpc.tts.synthesize.useMutation({
    onSuccess: async (result, variables) => {
      try {
        await setAudioModeAsync({ playsInSilentMode: true });
        previewPlayerRef.current?.remove();
        previewPlayerRef.current = null;

        const apiBase = process.env.EXPO_PUBLIC_API_BASE_URL ?? "";
        const audioUrl = result.url.startsWith("http")
          ? result.url
          : `${apiBase}${result.url}`;

        const player = createAudioPlayer({ uri: audioUrl });
        previewPlayerRef.current = player;
        player.play();

        const poll = setInterval(() => {
          if (!player.playing) {
            clearInterval(poll);
            if (previewingRef.current === variables.voiceId) {
              previewingRef.current = null;
              setPreviewingId(null);
            }
            player.remove();
            if (previewPlayerRef.current === player) previewPlayerRef.current = null;
          }
        }, 500);
      } catch {
        previewingRef.current = null;
        setPreviewingId(null);
      }
    },
    onError: () => {
      previewingRef.current = null;
      setPreviewingId(null);
    },
  });

  const handlePreview = useCallback(
    (voice: CloudVoiceOption) => {
      if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      if (previewingRef.current === voice.id) {
        previewPlayerRef.current?.remove();
        previewPlayerRef.current = null;
        previewingRef.current = null;
        setPreviewingId(null);
        return;
      }
      previewPlayerRef.current?.remove();
      previewPlayerRef.current = null;
      previewingRef.current = voice.id;
      setPreviewingId(voice.id);
      synthesizeMutation.mutate({
        text: PREVIEW_TEXT[language],
        voiceId: voice.id,
        languageCode: voice.language,
        speakingRate: 0.9,
      });
    },
    [language, synthesizeMutation]
  );

  const handleGenderFilter = (g: GenderFilter) => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setGenderFilter(g);
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <View style={styles.loadingRow}>
        <ActivityIndicator size="small" color={Y} />
        <Text style={styles.loadingText}>Loading voices…</Text>
      </View>
    );
  }

  if (isError || allVoices.length === 0) {
    return (
      <View style={styles.infoBox}>
        <Text style={styles.infoText}>
          {isError
            ? "Could not load voices. Check your Google Cloud TTS API key."
            : `No ${language} voices available.`}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Gender filter */}
      <View style={styles.genderRow}>
        {(["Female", "Male"] as GenderFilter[]).map((g) => {
          const sel = genderFilter === g;
          return (
            <TouchableOpacity
              key={g}
              style={[styles.genderChip, sel && styles.genderChipSelected]}
              onPress={() => handleGenderFilter(g)}
              activeOpacity={0.7}
            >
              <Text style={[styles.genderChipText, sel && styles.genderChipTextSelected]}>
                {g === "Female" ? "♀ Female" : "♂ Male"}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Voice list */}
      {voices.length === 0 ? (
        <View style={styles.infoBox}>
          <Text style={styles.infoText}>No {genderFilter.toLowerCase()} voices found for {language}.</Text>
        </View>
      ) : (
        voices.map((voice, index) => {
          const isSelected = selectedVoiceId === voice.id;
          const isPreviewing = previewingId === voice.id;
          const tierColor = TIER_COLORS[voice.tier] ?? "#6B8AAA";

          return (
            <TouchableOpacity
              key={`${voice.id}-${index}`}
              style={[styles.voiceRow, isSelected && styles.voiceRowSelected]}
              onPress={() => {
                if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onVoiceSelect(voice.id, voice.language);
              }}
              activeOpacity={0.75}
            >
              {/* Radio */}
              <View style={[styles.radioOuter, isSelected && styles.radioOuterSelected]}>
                {isSelected && <View style={styles.radioInner} />}
              </View>

              {/* Voice info */}
              <View style={styles.voiceInfo}>
                <View style={styles.voiceNameRow}>
                  <Text style={[styles.voiceName, isSelected && styles.voiceNameSelected]} numberOfLines={1}>
                    {voice.name}
                  </Text>
                  <View style={[styles.tierBadge, { backgroundColor: tierColor + "33", borderColor: tierColor }]}>
                    <Text style={[styles.tierBadgeText, { color: tierColor }]}>{voice.tier}</Text>
                  </View>
                </View>
                <Text style={styles.voiceMeta}>{voice.language} · {voice.gender}</Text>
              </View>

              {/* Preview button */}
              <TouchableOpacity
                style={[
                  styles.previewBtn,
                  isPreviewing && styles.previewBtnActive,
                  synthesizeMutation.isPending && previewingRef.current === voice.id && styles.previewBtnLoading,
                ]}
                onPress={() => handlePreview(voice)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                activeOpacity={0.7}
                disabled={synthesizeMutation.isPending && previewingRef.current !== voice.id}
              >
                <Text style={[styles.previewIcon, isPreviewing && styles.previewIconActive]}>
                  {synthesizeMutation.isPending && previewingRef.current === voice.id ? "…" : isPreviewing ? "■" : "▶"}
                </Text>
              </TouchableOpacity>
            </TouchableOpacity>
          );
        })
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 8 },
  loadingRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 14 },
  loadingText: { fontSize: 14, color: "#9B8BB4" },
  infoBox: { backgroundColor: "#1A1740", borderRadius: 14, borderWidth: 1, borderColor: "#2E2A5A", padding: 14 },
  infoText: { fontSize: 13, color: "#9B8BB4", lineHeight: 20 },
  // Gender filter
  genderRow: { flexDirection: "row", gap: 8, marginBottom: 4 },
  genderChip: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#1A1740", borderRadius: 12, borderWidth: 1.5, borderColor: "#2E2A5A", paddingVertical: 9 },
  genderChipSelected: { borderColor: Y, backgroundColor: Y_DIM },
  genderChipText: { fontSize: 13, fontWeight: "600", color: "#9B8BB4" },
  genderChipTextSelected: { color: Y },
  // Voice rows
  voiceRow: { flexDirection: "row", alignItems: "center", backgroundColor: "#1A1740", borderRadius: 14, borderWidth: 1.5, borderColor: "#2E2A5A", paddingHorizontal: 14, paddingVertical: 13, gap: 12 },
  voiceRowSelected: { borderColor: Y, backgroundColor: Y_DIM },
  radioOuter: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: "#4A4270", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  radioOuterSelected: { borderColor: Y },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: Y },
  voiceInfo: { flex: 1, minWidth: 0 },
  voiceNameRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 3, flexWrap: "wrap" },
  voiceName: { fontSize: 14, fontWeight: "600", color: "#9B8BB4", flexShrink: 1 },
  voiceNameSelected: { color: Y },
  tierBadge: { borderRadius: 5, paddingHorizontal: 5, paddingVertical: 1, borderWidth: 1, flexShrink: 0 },
  tierBadgeText: { fontSize: 10, fontWeight: "700", letterSpacing: 0.4 },
  voiceMeta: { fontSize: 12, color: "#4A4270" },
  previewBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: Y, alignItems: "center", justifyContent: "center", flexShrink: 0, elevation: 4 },
  previewBtnActive: { backgroundColor: "#F87171" },
  previewBtnLoading: { backgroundColor: "#4A4270" },
  previewIcon: { fontSize: 14, color: "#0D0B2B", fontWeight: "700" },
  previewIconActive: { color: "#FFFFFF" },
});
