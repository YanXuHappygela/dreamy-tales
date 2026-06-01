/**
 * Google Cloud Text-to-Speech helpers
 * Docs: https://cloud.google.com/text-to-speech/docs/reference/rest
 */

const GOOGLE_TTS_BASE = "https://texttospeech.googleapis.com/v1";

function getApiKey(): string {
  const key = process.env.GOOGLE_TTS_API_KEY;
  if (!key) throw new Error("GOOGLE_TTS_API_KEY is not set");
  return key;
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface GoogleVoice {
  name: string;
  languageCodes: string[];
  ssmlGender: "MALE" | "FEMALE" | "NEUTRAL" | "SSML_VOICE_GENDER_UNSPECIFIED";
  naturalSampleRateHertz: number;
}

export interface CloudVoiceOption {
  id: string;           // Google voice name, e.g. "en-US-Neural2-A"
  name: string;         // Display name, e.g. "Neural2-A (Female)"
  language: string;     // BCP-47 code, e.g. "en-US"
  gender: string;       // "Male" | "Female" | "Neutral"
  tier: string;         // "Neural2" | "WaveNet" | "Standard" | "Studio"
}

// Language code prefixes for each app language
const LANG_PREFIXES: Record<string, string[]> = {
  English:  ["en-"],
  Mandarin: ["zh-", "cmn-"],
  Spanish:  ["es-"],
};

// ── Voice listing ─────────────────────────────────────────────────────────────

export async function listGoogleVoices(language: string): Promise<CloudVoiceOption[]> {
  const apiKey = getApiKey();
  const prefixes = LANG_PREFIXES[language] ?? ["en-"];

  // Fetch all voices (no languageCode filter so we get all variants)
  const res = await fetch(`${GOOGLE_TTS_BASE}/voices?key=${apiKey}`);
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Google TTS voices failed: ${res.status} ${err}`);
  }
  const data = (await res.json()) as { voices: GoogleVoice[] };

  const voices: CloudVoiceOption[] = [];
  for (const v of data.voices ?? []) {
    const matchingCode = v.languageCodes.find((lc) =>
      prefixes.some((p) => lc.toLowerCase().startsWith(p.toLowerCase()))
    );
    if (!matchingCode) continue;

    // Determine tier from name — must match exactly WaveNet or Standard
    // Standard voices follow the pattern: {lang}-Standard-{A-Z}
    // WaveNet voices follow the pattern: {lang}-Wavenet-{A-Z} or {lang}-WaveNet-{A-Z}
    let tier: string;
    if (/wavenet/i.test(v.name)) {
      tier = "WaveNet";
    } else if (/standard/i.test(v.name)) {
      tier = "Standard";
    } else {
      // Skip all other model families (Neural2, Studio, Chirp, Journey, News, Polyglot, etc.)
      continue;
    }

    const genderLabel =
      v.ssmlGender === "MALE" ? "Male"
      : v.ssmlGender === "FEMALE" ? "Female"
      : "Neutral";

    // Build a friendly display name: e.g. "en-US-Neural2-A" → "Neural2-A (Female)"
    const shortName = v.name.replace(`${matchingCode}-`, "");
    const displayName = `${shortName} (${genderLabel})`;

    voices.push({
      id: v.name,
      name: displayName,
      language: matchingCode,
      gender: genderLabel,
      tier,
    });
  }

  // Sort: WaveNet first, then Standard; within tier by name
  const TIER_ORDER: Record<string, number> = { WaveNet: 0, Standard: 1 };
  voices.sort((a, b) => {
    const ta = TIER_ORDER[a.tier] ?? 9;
    const tb = TIER_ORDER[b.tier] ?? 9;
    if (ta !== tb) return ta - tb;
    return a.name.localeCompare(b.name);
  });

  return voices;
}

// ── Audio synthesis ───────────────────────────────────────────────────────────

export async function synthesizeSpeech(params: {
  text: string;
  voiceId: string;       // Google voice name, e.g. "en-US-Neural2-A"
  languageCode: string;  // BCP-47, e.g. "en-US"
  speakingRate?: number; // 0.25–4.0, default 1.0
}): Promise<Buffer> {
  const apiKey = getApiKey();

  const body = {
    input: { text: params.text },
    voice: {
      languageCode: params.languageCode,
      name: params.voiceId,
    },
    audioConfig: {
      audioEncoding: "MP3",
      speakingRate: params.speakingRate ?? 1.0,
      pitch: 0,
      volumeGainDb: 0,
    },
  };

  const res = await fetch(`${GOOGLE_TTS_BASE}/text:synthesize?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Google TTS synthesis failed: ${res.status} ${err}`);
  }

  const data = (await res.json()) as { audioContent: string };
  return Buffer.from(data.audioContent, "base64");
}
