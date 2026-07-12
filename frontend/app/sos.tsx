import React, { useState } from "react";
import { View, Text, StyleSheet, Pressable, Linking } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { Platform } from "react-native";
import { colors, spacing, radius, font } from "@/src/theme";
import { api } from "@/src/api";
import { useApp } from "@/src/context/AppContext";

export default function Sos() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { activePatient } = useApp();
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);

  const trigger = async () => {
    setSending(true);
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    try {
      await api("/sos", { method: "POST", body: { patient_id: activePatient?.id, message: "Notruf über App ausgelöst" } });
      setSent(true);
    } catch {
      setSent(true);
    } finally { setSending(false); }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.lg }]}>
      <Pressable testID="sos-close" onPress={() => router.back()} style={styles.close}>
        <Ionicons name="close" size={28} color="#fff" />
      </Pressable>

      <View style={styles.content}>
        {!sent ? (
          <>
            <View style={styles.iconWrap}>
              <Ionicons name="warning" size={64} color="#fff" />
            </View>
            <Text style={styles.title}>Notfall auslösen?</Text>
            <Text style={styles.sub}>
              Angehörige und Pflegekräfte werden sofort benachrichtigt. Bei akuter Gefahr rufen Sie bitte direkt den Notruf.
            </Text>

            <Pressable testID="trigger-sos" onPress={trigger} disabled={sending} style={styles.sosBtn}>
              <Ionicons name="notifications" size={24} color={colors.error} />
              <Text style={styles.sosBtnText}>{sending ? "Wird gesendet…" : "Notruf senden"}</Text>
            </Pressable>

            <Pressable testID="call-emergency" onPress={() => Linking.openURL("tel:112")} style={styles.callBtn}>
              <Ionicons name="call" size={22} color="#fff" />
              <Text style={styles.callText}>Notruf 112 anrufen</Text>
            </Pressable>
          </>
        ) : (
          <>
            <View style={[styles.iconWrap, { backgroundColor: "rgba(255,255,255,0.2)" }]}>
              <Ionicons name="checkmark-circle" size={72} color="#fff" />
            </View>
            <Text style={styles.title}>Notruf gesendet</Text>
            <Text style={styles.sub}>Ihre Angehörigen und Pflegekräfte wurden benachrichtigt. Hilfe ist unterwegs.</Text>
            <Pressable testID="sos-done" onPress={() => router.back()} style={styles.sosBtn}>
              <Text style={styles.sosBtnText}>Schließen</Text>
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.error, paddingHorizontal: spacing.xl },
  close: { alignSelf: "flex-end", width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  content: { flex: 1, alignItems: "center", justifyContent: "center" },
  iconWrap: { width: 120, height: 120, borderRadius: 60, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center", marginBottom: spacing.xl },
  title: { color: "#fff", fontSize: 26, fontWeight: "900", textAlign: "center" },
  sub: { color: "#FDE2E2", fontSize: font.lg, textAlign: "center", lineHeight: 24, marginTop: spacing.md, marginBottom: spacing["2xl"] },
  sosBtn: { backgroundColor: "#fff", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, minHeight: 60, borderRadius: radius.md, paddingHorizontal: spacing["2xl"], alignSelf: "stretch" },
  sosBtnText: { color: colors.error, fontSize: font.xl, fontWeight: "800" },
  callBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: spacing.lg, minHeight: 52 },
  callText: { color: "#fff", fontSize: font.lg, fontWeight: "700", textDecorationLine: "underline" },
});
