import React, { useState } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator, Linking } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { Platform } from "react-native";
import { colors, spacing, radius, font } from "@/src/theme";
import { api } from "@/src/api";
import { PrimaryButton } from "@/src/components/ui";

export default function ScanBarcode() {
  const { patientId } = useLocalSearchParams<{ patientId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [looking, setLooking] = useState(false);
  const [notFound, setNotFound] = useState("");

  const normalizeBarcode = (rawData: string, type?: string) => {
    const raw = rawData.trim().toUpperCase();

    if (type === "code39") {
      const pznMatch = raw.match(/^-?(\d{7,8})$/);
      if (!pznMatch) return null;
      return pznMatch[1].padStart(8, "0");
    }

    const numeric = raw.replace(/\D/g, "");
    if (["ean13", "ean8", "code128"].includes(type || "") && numeric.length >= 7) {
      return numeric;
    }

    return null;
  };

  const onScan = async ({ data, type }: { data: string; type?: string }) => {
    if (scanned || looking) return;

    const normalized = normalizeBarcode(data, type);
    setScanned(true);

    if (!normalized) {
      setNotFound(`${data} – Barcode konnte nicht eindeutig gelesen werden.`);
      return;
    }

    setLooking(true);
    setNotFound("");
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }

    try {
      const res = await api<any>(`/barcode/${encodeURIComponent(normalized)}`);
      if (res.found) {
        router.replace({
          pathname: "/add-medication",
          params: {
            patientId,
            pName: res.name ?? "",
            pDosage: res.dosage ?? "",
            pForm: res.form ?? "",
            pPzn: res.pzn ?? normalized,
          },
        });
      } else {
        setNotFound(normalized);
      }
    } catch (error: any) {
      setNotFound(
        error?.message === "BACKEND_TIMEOUT"
          ? `${normalized} – Server nicht erreichbar`
          : normalized
      );
    } finally {
      setLooking(false);
    }
  };

  if (!permission) return <View style={styles.dark}><ActivityIndicator color="#fff" /></View>;

  if (!permission.granted) {
    return (
      <View style={styles.dark}>
        <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
          <Pressable testID="scan-close" onPress={() => router.back()} style={styles.backBtn}><Ionicons name="close" size={24} color="#fff" /></Pressable>
          <Text style={styles.title}>Barcode scannen</Text><View style={{ width: 40 }} />
        </View>
        <View style={styles.center}>
          <Ionicons name="barcode" size={56} color="#fff" />
          <Text style={styles.permTitle}>Kamerazugriff benötigt</Text>
          <Text style={styles.permText}>Um Medikamenten-Barcodes zu scannen, wird Kamerazugriff benötigt.</Text>
          {permission.canAskAgain ? (
            <PrimaryButton testID="grant-camera" label="Kamera erlauben" icon="camera" onPress={requestPermission} style={{ marginTop: spacing.lg, alignSelf: "stretch" }} />
          ) : (
            <PrimaryButton testID="open-settings" label="Einstellungen öffnen" icon="settings" onPress={() => Linking.openSettings()} style={{ marginTop: spacing.lg, alignSelf: "stretch" }} />
          )}
          <Pressable testID="manual-entry" onPress={() => router.replace({ pathname: "/add-medication", params: { patientId } })} style={{ marginTop: spacing.lg }}>
            <Text style={styles.manual}>Stattdessen manuell suchen</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.dark}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ["ean13", "ean8", "code128", "code39"] }}
        onBarcodeScanned={scanned ? undefined : onScan}
      />
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable testID="scan-close" onPress={() => router.back()} style={styles.backBtn}><Ionicons name="close" size={24} color="#fff" /></Pressable>
        <Text style={styles.title}>Barcode scannen</Text><View style={{ width: 40 }} />
      </View>
      <View style={styles.frameWrap}>
        <View style={styles.frame} />
        <Text style={styles.hint}>Barcode auf der Packung scannen</Text>
        {looking && <ActivityIndicator color="#fff" style={{ marginTop: spacing.md }} />}
        {notFound ? (
          <View style={styles.nfCard}>
            <Text style={styles.nfText}>Barcode „{notFound}“ nicht gefunden.</Text>
            <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm }}>
              <Pressable testID="scan-again" onPress={() => { setScanned(false); setNotFound(""); }} style={styles.nfBtn}><Text style={styles.nfBtnText}>Erneut scannen</Text></Pressable>
              <Pressable testID="manual-search" onPress={() => router.replace({ pathname: "/add-medication", params: { patientId } })} style={[styles.nfBtn, { backgroundColor: colors.brandPrimary }]}><Text style={[styles.nfBtnText, { color: "#fff" }]}>Manuell suchen</Text></Pressable>
            </View>
          </View>
        ) : null}
        <Text style={styles.demoHint}>PZN- oder Medikamenten-Barcode scannen</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  dark: { flex: 1, backgroundColor: "#000" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.sm, paddingBottom: spacing.md, zIndex: 2 },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  title: { color: "#fff", fontSize: font.lg, fontWeight: "800" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl },
  permTitle: { color: "#fff", fontSize: 20, fontWeight: "800", marginTop: spacing.lg },
  permText: { color: "#C7D6E5", fontSize: 15, textAlign: "center", marginTop: spacing.sm, lineHeight: 22 },
  manual: { color: "#9DC3E6", fontWeight: "700", fontSize: 15, textDecorationLine: "underline" },
  frameWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
  frame: { width: "78%", height: 150, borderWidth: 3, borderColor: "rgba(255,255,255,0.85)", borderRadius: radius.lg },
  hint: { color: "#fff", marginTop: spacing.lg, fontSize: 15, fontWeight: "600" },
  demoHint: { color: "#9DC3E6", marginTop: spacing.xl, fontSize: 12 },
  nfCard: { backgroundColor: "rgba(255,255,255,0.95)", borderRadius: radius.md, padding: spacing.md, marginTop: spacing.lg, marginHorizontal: spacing.lg },
  nfText: { color: colors.onSurface, fontWeight: "600" },
  nfBtn: { flex: 1, backgroundColor: colors.surfaceTertiary, borderRadius: radius.sm, paddingVertical: 10, alignItems: "center" },
  nfBtnText: { fontWeight: "700", color: colors.onSurface },
});
