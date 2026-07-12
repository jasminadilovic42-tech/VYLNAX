import React, { useRef, useState } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator, Linking, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, spacing, radius, font } from "@/src/theme";
import { api } from "@/src/api";
import { PrimaryButton } from "@/src/components/ui";

export default function ScanPrescription() {
  const { patientId } = useLocalSearchParams<{ patientId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const camRef = useRef<CameraView>(null);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [err, setErr] = useState("");

  const capture = async () => {
    if (!camRef.current) return;
    setErr("");
    setProcessing(true);
    try {
      const photo = await camRef.current.takePictureAsync({ base64: true, quality: 0.5 });
      const res = await api<any>("/ocr/prescription", { method: "POST", body: { image_base64: photo?.base64 } });
      setResult(res);
    } catch {
      setErr("Scan fehlgeschlagen. Bitte erneut versuchen oder manuell eingeben.");
    } finally {
      setProcessing(false);
    }
  };

  const accept = () => {
    router.replace({
      pathname: "/add-medication",
      params: {
        patientId, pName: result.name || "", pDosage: result.dosage || "",
        pForm: result.form || "", pFreq: result.frequency || "",
        pPrescriber: result.prescriber || "", pNote: result.note || "",
      },
    });
  };

  const Header = (
    <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
      <Pressable testID="scan-close" onPress={() => router.back()} style={styles.backBtn}>
        <Ionicons name="close" size={24} color="#fff" />
      </Pressable>
      <Text style={styles.title}>Rezept scannen</Text>
      <View style={{ width: 40 }} />
    </View>
  );

  // Permission states
  if (!permission) {
    return <View style={styles.dark}><ActivityIndicator color="#fff" /></View>;
  }
  if (!permission.granted) {
    return (
      <View style={styles.dark}>
        {Header}
        <View style={styles.center}>
          <Ionicons name="camera" size={56} color="#fff" />
          <Text style={styles.permTitle}>Kamerazugriff benötigt</Text>
          <Text style={styles.permText}>Um Rezepte zu scannen, benötigt VYLNAX PRO Zugriff auf Ihre Kamera.</Text>
          {permission.canAskAgain ? (
            <PrimaryButton testID="grant-camera" label="Kamera erlauben" icon="camera" onPress={requestPermission} style={{ marginTop: spacing.lg, alignSelf: "stretch" }} />
          ) : (
            <PrimaryButton testID="open-settings" label="Einstellungen öffnen" icon="settings" onPress={() => Linking.openSettings()} style={{ marginTop: spacing.lg, alignSelf: "stretch" }} />
          )}
          <Pressable testID="manual-entry" onPress={() => router.replace({ pathname: "/add-medication", params: { patientId } })} style={{ marginTop: spacing.lg }}>
            <Text style={styles.manual}>Stattdessen manuell eingeben</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // Result confirmation
  if (result) {
    return (
      <View style={styles.light}>
        <View style={[styles.headerLight, { paddingTop: insets.top + spacing.sm }]}>
          <Pressable testID="result-back" onPress={() => setResult(null)} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={26} color={colors.onSurface} />
          </Pressable>
          <Text style={styles.titleLight}>Erkannte Daten</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={{ padding: spacing.lg, flex: 1 }}>
          <View style={styles.warn}>
            <Ionicons name="alert-circle" size={20} color={colors.warning} />
            <Text style={styles.warnText}>OCR-Ergebnisse müssen immer von medizinischem Fachpersonal geprüft werden.</Text>
          </View>
          {[["Name", result.name], ["Dosierung", result.dosage], ["Form", result.form], ["Häufigkeit", result.frequency], ["Arzt", result.prescriber], ["Notiz", result.note]].map(([k, v]) => (
            <View key={k} style={styles.field}>
              <Text style={styles.fieldLabel}>{k}</Text>
              <Text style={styles.fieldValue}>{v || "—"}</Text>
            </View>
          ))}
          <PrimaryButton testID="accept-ocr" label="Übernehmen & bearbeiten" icon="checkmark" onPress={accept} style={{ marginTop: spacing.xl }} />
        </View>
      </View>
    );
  }

  // Camera view
  return (
    <View style={styles.dark}>
      <CameraView ref={camRef} style={StyleSheet.absoluteFill} facing="back" />
      {Header}
      <View style={styles.frameWrap}>
        <View style={styles.frame} />
        <Text style={styles.hint}>Rezept im Rahmen positionieren</Text>
      </View>
      <View style={[styles.captureBar, { paddingBottom: insets.bottom + spacing.lg }]}>
        {err ? <Text style={styles.errText}>{err}</Text> : null}
        <Pressable testID="capture-btn" onPress={capture} disabled={processing} style={styles.captureBtn}>
          {processing ? <ActivityIndicator color={colors.brand} /> : <Ionicons name="scan" size={30} color={colors.brand} />}
        </Pressable>
        <Text style={styles.captureLabel}>{processing ? "Wird analysiert…" : "Tippen zum Scannen"}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  dark: { flex: 1, backgroundColor: "#000" },
  light: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.sm, paddingBottom: spacing.md, zIndex: 2 },
  headerLight: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.sm, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  title: { color: "#fff", fontSize: font.lg, fontWeight: "800" },
  titleLight: { color: colors.onSurface, fontSize: font.lg, fontWeight: "800" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl },
  permTitle: { color: "#fff", fontSize: 20, fontWeight: "800", marginTop: spacing.lg },
  permText: { color: "#C7D6E5", fontSize: 15, textAlign: "center", marginTop: spacing.sm, lineHeight: 22 },
  manual: { color: "#9DC3E6", fontWeight: "700", fontSize: 15, textDecorationLine: "underline" },
  frameWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
  frame: { width: "80%", height: "55%", borderWidth: 3, borderColor: "rgba(255,255,255,0.8)", borderRadius: radius.lg },
  hint: { color: "#fff", marginTop: spacing.lg, fontSize: 15, fontWeight: "600" },
  captureBar: { alignItems: "center", paddingTop: spacing.lg, backgroundColor: "rgba(0,0,0,0.5)" },
  captureBtn: { width: 72, height: 72, borderRadius: 36, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" },
  captureLabel: { color: "#fff", marginTop: spacing.sm, fontWeight: "600" },
  errText: { color: "#FCA5A5", marginBottom: spacing.sm, fontWeight: "600" },
  warn: { flexDirection: "row", gap: spacing.sm, backgroundColor: "#FDF3E6", borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.lg },
  warnText: { flex: 1, color: "#92600A", fontSize: 12.5, fontWeight: "600", lineHeight: 18 },
  field: { borderBottomWidth: 1, borderBottomColor: colors.divider, paddingVertical: spacing.md },
  fieldLabel: { fontSize: 12, color: colors.onSurfaceTertiary, fontWeight: "700" },
  fieldValue: { fontSize: font.lg, color: colors.onSurface, marginTop: 2 },
});
