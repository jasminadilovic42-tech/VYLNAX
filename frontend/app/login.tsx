import React, { useEffect } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator, Dimensions } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/src/context/AuthContext";
import { colors, spacing, radius, font } from "@/src/theme";
import { VLogo } from "@/src/components/ui";

const { height } = Dimensions.get("window");
const BG = "https://images.unsplash.com/photo-1687197180710-b2b9484a3c5f?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA0MTJ8MHwxfHNlYXJjaHwxfHxhYnN0cmFjdCUyMGJsdWUlMjBjbGVhbiUyMHRlY2hub2xvZ3l8ZW58MHx8fHwxNzgzMjU3MTE2fDA&ixlib=rb-4.1.0&q=85";

export default function Login() {
  const { login, signingIn, user } = useAuth();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  useEffect(() => {
    if (user) router.replace("/(tabs)");
  }, [user]);

  return (
    <View style={styles.container}>
      <Image source={{ uri: BG }} style={StyleSheet.absoluteFill} contentFit="cover" transition={300} />
      <LinearGradient
        colors={["rgba(10,25,41,0.35)", "rgba(10,25,41,0.85)", "rgba(10,25,41,0.98)"]}
        locations={[0, 0.55, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.content, { paddingTop: insets.top + spacing["2xl"], paddingBottom: insets.bottom + spacing["2xl"] }]}>
        <View style={styles.brandRow}>
          <VLogo size={56} />
          <View style={{ marginLeft: 12 }}>
            <Text style={styles.brand}>VYLNAX <Text style={{ color: "#4DA6E8" }}>PRO</Text></Text>
            <Text style={styles.tagline}>INTELLIGENT · SICHER · MENSCHLICH</Text>
          </View>
        </View>

        <View style={{ flex: 1, justifyContent: "center" }}>
          <Text style={styles.headline}>Ihre sichere{"\n"}Medikamenten­versorgung</Text>
          <Text style={styles.sub}>Jederzeit und überall. Erinnerungen, Bestätigungen und Berichte – für Patienten, Angehörige und Pflegekräfte.</Text>
          <View style={styles.features}>
            {[
              { icon: "shield-checkmark", t: "Mehr Sicherheit" },
              { icon: "notifications", t: "Erinnerungen" },
              { icon: "people", t: "Vernetzt" },
            ].map((f) => (
              <View key={f.t} style={styles.feature}>
                <Ionicons name={f.icon as any} size={20} color="#4DA6E8" />
                <Text style={styles.featureT}>{f.t}</Text>
              </View>
            ))}
          </View>
        </View>

        <Pressable
          testID="google-login-button"
          onPress={login}
          disabled={signingIn}
          style={({ pressed }) => [styles.googleBtn, { opacity: pressed ? 0.9 : 1 }]}
        >
          {signingIn ? (
            <ActivityIndicator color={colors.brand} />
          ) : (
            <>
              <Ionicons name="logo-google" size={20} color="#EA4335" />
              <Text style={styles.googleText}>Mit Google anmelden</Text>
            </>
          )}
        </Pressable>
        <Text style={styles.legal}>Mit der Anmeldung akzeptieren Sie unsere Datenschutz­bestimmungen.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surfaceInverse },
  content: { flex: 1, paddingHorizontal: spacing.xl },
  brandRow: { flexDirection: "row", alignItems: "center" },
  brand: { color: "#fff", fontSize: 26, fontWeight: "900", letterSpacing: 0.5 },
  tagline: { color: "#9DC3E6", fontSize: 11, fontWeight: "700", letterSpacing: 1, marginTop: 2 },
  headline: { color: "#fff", fontSize: 32, fontWeight: "800", lineHeight: 40 },
  sub: { color: "#C7D6E5", fontSize: font.lg, lineHeight: 24, marginTop: spacing.md },
  features: { flexDirection: "row", gap: spacing.lg, marginTop: spacing.xl },
  feature: { alignItems: "center", gap: 6 },
  featureT: { color: "#E6F0F9", fontSize: 12, fontWeight: "600" },
  googleBtn: {
    backgroundColor: "#fff",
    minHeight: 56,
    borderRadius: radius.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  googleText: { color: "#1F2937", fontSize: font.lg, fontWeight: "700" },
  legal: { color: "#7C93A8", fontSize: 11, textAlign: "center", marginTop: spacing.md },
});
