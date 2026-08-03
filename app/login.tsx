import React, { useState } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, Platform, ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { startOAuthLogin } from "@/constants/oauth";
import { ScreenContainer } from "@/components/screen-container";

const Y = "#FFD580";

export default function LoginScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (loading) return;
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoading(true);
    try {
      await startOAuthLogin();
      // On native: OAuth opens in browser, callback returns via deep link
      // On web: page redirects, no need to do anything here
    } catch {
      setLoading(false);
    }
    // On native, reset loading after a delay (deep link will navigate away)
    if (Platform.OS !== "web") {
      setTimeout(() => setLoading(false), 5000);
    }
  };

  return (
    <ScreenContainer containerClassName="bg-background" safeAreaClassName="">
      <View style={styles.container}>
        {/* Moon + stars */}
        <View style={styles.heroSection}>
          <Text style={styles.moonEmoji}>🌙</Text>
          <View style={styles.starRow}>
            <Text style={styles.starEmoji}>✨</Text>
            <Text style={styles.starEmoji}>⭐</Text>
            <Text style={styles.starEmoji}>✨</Text>
          </View>
        </View>

        <Text style={styles.appTitle}>Dreamy Tales</Text>
        <Text style={styles.tagline}>Magical bedtime stories, just for you</Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Sign in to continue</Text>
          <Text style={styles.cardDesc}>
            Create personalised bedtime stories for your child.{"\n"}
            Free users get <Text style={styles.highlight}>3 stories per day</Text>.
          </Text>

          {/* Google / Manus OAuth login button */}
          <TouchableOpacity
            style={[styles.loginBtn, loading && { opacity: 0.7 }]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#0D0B2B" />
            ) : (
              <Text style={styles.loginBtnIcon}>G</Text>
            )}
            <Text style={styles.loginBtnText}>
              {loading ? "Opening sign-in…" : "Continue with Google"}
            </Text>
          </TouchableOpacity>

          <Text style={styles.privacyNote}>
            By signing in you agree to our terms of service.{"\n"}
            Your data is stored securely and never shared.
          </Text>
        </View>

        {/* Feature bullets */}
        <View style={styles.features}>
          {[
            "✨  AI-generated personalised stories",
            "🌐  English, Mandarin & Spanish",
            "🎙️  Google Cloud narration voices",
            "📄  Share stories as PDF",
          ].map((f) => (
            <Text key={f} style={styles.featureItem}>{f}</Text>
          ))}
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 28, backgroundColor: "#0D0B2B" },
  heroSection: { alignItems: "center", marginBottom: 12 },
  moonEmoji: { fontSize: 64, lineHeight: 78 },
  starRow: { flexDirection: "row", gap: 8, marginTop: 4 },
  starEmoji: { fontSize: 18 },
  appTitle: { fontSize: 36, fontWeight: "800", color: "#F0EAF8", letterSpacing: 0.5, marginBottom: 6 },
  tagline: { fontSize: 15, color: "#9B8BB4", textAlign: "center", marginBottom: 32 },
  card: { width: "100%", backgroundColor: "#1A1740", borderRadius: 24, padding: 24, borderWidth: 1.5, borderColor: "#2E2A5A", marginBottom: 28 },
  cardTitle: { fontSize: 20, fontWeight: "700", color: "#F0EAF8", marginBottom: 10, textAlign: "center" },
  cardDesc: { fontSize: 14, color: "#9B8BB4", textAlign: "center", lineHeight: 22, marginBottom: 24 },
  highlight: { color: Y, fontWeight: "700" },
  loginBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12,
    backgroundColor: Y, borderRadius: 16, paddingVertical: 16, marginBottom: 16, elevation: 6,
  },
  loginBtnIcon: { fontSize: 18, fontWeight: "800", color: "#0D0B2B" },
  loginBtnText: { fontSize: 16, fontWeight: "700", color: "#0D0B2B" },
  privacyNote: { fontSize: 11, color: "#4A4270", textAlign: "center", lineHeight: 16 },
  features: { width: "100%", gap: 10 },
  featureItem: { fontSize: 14, color: "#9B8BB4", lineHeight: 20 },
});
