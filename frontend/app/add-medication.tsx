import React, { useState, useEffect, useRef } from "react";
import { View, Text, StyleSheet, ScrollView, TextInput, Pressable, KeyboardAvoidingView, Platform, ActivityIndicator, Modal } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { colors, spacing, radius, font, shadow, MED_COLORS, MED_FORMS, WEEKDAYS_FULL } from "@/src/theme";
import { api } from "@/src/api";
import { PrimaryButton } from "@/src/components/ui";

const TIME_PRESETS = ["08:00", "12:00", "16:00", "20:00"];
const FREQUENCIES = ["Täglich", "Jeden 2. Tag", "Wöchentlich", "Nach Bedarf"];

export default function AddMedication() {
  const params = useLocalSearchParams<{ patientId: string; pName?: string; pDosage?: string; pForm?: string; pFreq?: string; pPrescriber?: string; pNote?: string }>();
  const patientId = params.patientId;
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState(params.pName || "");
  const [dosage, setDosage] = useState(params.pDosage || "");
  const [form, setForm] = useState(params.pForm && MED_FORMS.includes(params.pForm) ? params.pForm : "Tablette");
  const [color, setColor] = useState(MED_COLORS[0]);
  const [times, setTimes] = useState<string[]>(["08:00"]);
  const [days, setDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  const [customTime, setCustomTime] = useState("");
  const [frequency, setFrequency] = useState(params.pFreq || "Täglich");
  const [prescriber, setPrescriber] = useState(params.pPrescriber || "");
  const [note, setNote] = useState(params.pNote || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [showSuggest, setShowSuggest] = useState(false);
  const [check, setCheck] = useState<any>(null);
  const suppress = useRef(!!params.pName);

  useEffect(() => {
    let active = true;
    if (suppress.current) { suppress.current = false; return; }
    const q = name.trim();
    if (q.length < 2) { setResults([]); setShowSuggest(false); return; }
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const res = await api<any[]>(`/med-database?q=${encodeURIComponent(q)}`);
        if (active) { setResults(res); setShowSuggest(res.length > 0); }
      } catch {} finally { if (active) setSearching(false); }
    }, 250);
    return () => { active = false; clearTimeout(t); };
  }, [name]);

  const pickFromDb = (m: any) => {
    suppress.current = true;
    setName(m.name);
    setDosage(m.dosage);
    setForm(m.form);
    setResults([]);
    setShowSuggest(false);
  };

  const toggleTime = (t: string) => setTimes((p) => (p.includes(t) ? p.filter((x) => x !== t) : [...p, t]));
  const toggleDay = (d: number) => setDays((p) => (p.includes(d) ? p.filter((x) => x !== d) : [...p, d]));

  const addCustom = () => {
    if (/^\d{1,2}:\d{2}$/.test(customTime)) {
      const [h, m] = customTime.split(":");
      const t = `${h.padStart(2, "0")}:${m}`;
      if (!times.includes(t)) setTimes((p) => [...p, t]);
      setCustomTime("");
    }
  };

  const save = async () => {
    setError("");
    if (!name.trim() || !dosage.trim() || times.length === 0 || days.length === 0) {
      setError("Bitte Name, Dosierung, mindestens eine Zeit und einen Tag angeben.");
      return;
    }
    // Pre-save safety check
    try {
      const res = await api<any>(`/patients/${patientId}/check-medication`, {
        method: "POST",
        body: { name: name.trim(), dosage: dosage.trim() },
      });
      if (!res.safe) {
        if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        setCheck(res);
        return;
      }
    } catch {}
    await doSave();
  };

  const doSave = async () => {
    setCheck(null);
    setSaving(true);
    try {
      await api(`/patients/${patientId}/medications`, {
        method: "POST",
        body: {
          name: name.trim(), dosage: dosage.trim(), form, color, times, days,
          frequency, prescriber: prescriber.trim() || null, note: note.trim() || null,
        },
      });
      router.back();
    } catch {
      setError("Speichern fehlgeschlagen.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.surface }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable testID="close-modal" onPress={() => router.back()} style={styles.closeBtn}>
          <Ionicons name="close" size={24} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.title}>Medikament hinzufügen</Text>
        <View style={{ width: 40 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <View style={styles.warning}>
          <Ionicons name="alert-circle" size={20} color={colors.warning} />
          <Text style={styles.warningText}>
            Medikamentendaten müssen vor der Anwendung von medizinischem Fachpersonal (Arzt/Apotheker) geprüft werden.
          </Text>
        </View>

        <View style={styles.scanRow}>
          <Pressable testID="scan-prescription-btn" onPress={() => router.push({ pathname: "/scan-prescription", params: { patientId } })} style={styles.scanBtn}>
            <Ionicons name="document-text" size={18} color={colors.brand} />
            <Text style={styles.scanBtnText}>Rezept scannen</Text>
          </Pressable>
          <Pressable testID="scan-barcode-btn" onPress={() => router.push({ pathname: "/scan-barcode", params: { patientId } })} style={styles.scanBtn}>
            <Ionicons name="barcode" size={18} color={colors.brand} />
            <Text style={styles.scanBtnText}>Barcode scannen</Text>
          </Pressable>
        </View>

        <Label text="Medikamentenname" />
        <View style={styles.autocompleteWrap}>
          <View style={styles.inputWithIcon}>
            <Ionicons name="search" size={18} color={colors.brandPrimary} />
            <TextInput
              testID="med-name-input"
              value={name}
              onChangeText={setName}
              onFocus={() => results.length > 0 && setShowSuggest(true)}
              placeholder="Tippen Sie z. B. „Met“…"
              placeholderTextColor={colors.borderStrong}
              style={styles.autocompleteInput}
              autoCorrect={false}
            />
            {searching && <ActivityIndicator size="small" color={colors.brandPrimary} />}
          </View>
          {showSuggest && results.length > 0 && (
            <View style={styles.suggestDrop}>
              {results.slice(0, 6).map((m, i) => (
                <Pressable key={i} testID={`db-result-${i}`} onPress={() => pickFromDb(m)} style={styles.resultRow}>
                  <View style={styles.resultIcon}><Ionicons name="medical" size={16} color={colors.brandPrimary} /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.resultName}>{m.name} {m.dosage}</Text>
                    <Text style={styles.resultMeta}>{m.form} · {m.category}</Text>
                  </View>
                  <Ionicons name="add-circle-outline" size={22} color={colors.brandPrimary} />
                </Pressable>
              ))}
            </View>
          )}
        </View>

        <Label text="Stärke / Dosierung" />
        <TextInput testID="med-dosage-input" value={dosage} onChangeText={setDosage} placeholder="z. B. 500 mg" placeholderTextColor={colors.borderStrong} style={styles.input} />

        <Label text="Form" />
        <View style={styles.wrapRow}>
          {MED_FORMS.map((f) => (
            <Pressable key={f} testID={`form-${f}`} onPress={() => setForm(f)} style={[styles.tag, form === f && styles.tagActive]}>
              <Text style={[styles.tagText, form === f && { color: "#fff" }]}>{f}</Text>
            </Pressable>
          ))}
        </View>

        <Label text="Einnahmezeiten" />
        <View style={styles.wrapRow}>
          {TIME_PRESETS.map((t) => (
            <Pressable key={t} testID={`time-${t}`} onPress={() => toggleTime(t)} style={[styles.tag, times.includes(t) && styles.tagActive]}>
              <Text style={[styles.tagText, times.includes(t) && { color: "#fff" }]}>{t}</Text>
            </Pressable>
          ))}
          {times.filter((t) => !TIME_PRESETS.includes(t)).map((t) => (
            <Pressable key={t} testID={`time-${t}`} onPress={() => toggleTime(t)} style={[styles.tag, styles.tagActive]}>
              <Text style={[styles.tagText, { color: "#fff" }]}>{t}</Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.customRow}>
          <TextInput testID="custom-time-input" value={customTime} onChangeText={setCustomTime} placeholder="HH:MM" placeholderTextColor={colors.borderStrong} style={[styles.input, { flex: 1, marginBottom: 0 }]} keyboardType="numbers-and-punctuation" />
          <Pressable testID="add-custom-time" onPress={addCustom} style={styles.addTimeBtn}>
            <Ionicons name="add" size={22} color="#fff" />
          </Pressable>
        </View>

        <Label text="Wochentage" />
        <View style={styles.daysRow}>
          {WEEKDAYS_FULL.map((d, i) => (
            <Pressable key={i} testID={`weekday-${i}`} onPress={() => toggleDay(i)} style={[styles.dayCircle, days.includes(i) && styles.dayActive]}>
              <Text style={[styles.dayText, days.includes(i) && { color: "#fff" }]}>{d}</Text>
            </Pressable>
          ))}
        </View>

        <Label text="Farbe" />
        <View style={styles.wrapRow}>
          {MED_COLORS.map((c) => (
            <Pressable key={c} testID={`color-${c}`} onPress={() => setColor(c)} style={[styles.colorDot, { backgroundColor: c }, color === c && styles.colorActive]}>
              {color === c && <Ionicons name="checkmark" size={18} color="#fff" />}
            </Pressable>
          ))}
        </View>

        <Label text="Häufigkeit" />
        <View style={styles.wrapRow}>
          {FREQUENCIES.map((f) => (
            <Pressable key={f} testID={`freq-${f}`} onPress={() => setFrequency(f)} style={[styles.tag, frequency === f && styles.tagActive]}>
              <Text style={[styles.tagText, frequency === f && { color: "#fff" }]}>{f}</Text>
            </Pressable>
          ))}
        </View>

        <Label text="Arzt / Verordner" />
        <TextInput testID="med-prescriber-input" value={prescriber} onChangeText={setPrescriber} placeholder="z. B. Dr. Müller" placeholderTextColor={colors.borderStrong} style={styles.input} />

        <Label text="Notizen" />
        <TextInput testID="med-note-input" value={note} onChangeText={setNote} placeholder="z. B. Nach dem Essen einnehmen" placeholderTextColor={colors.borderStrong} style={[styles.input, { height: 80, textAlignVertical: "top", paddingTop: spacing.md }]} multiline />

        {error ? <Text style={styles.error}>{error}</Text> : null}
        <PrimaryButton testID="save-medication" label="Medikament speichern" icon="checkmark" loading={saving} onPress={save} style={{ marginTop: spacing.xl }} />
      </ScrollView>

      <Modal visible={!!check} transparent animationType="fade" onRequestClose={() => setCheck(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard} testID="safety-check-modal">
            <View style={styles.modalIcon}>
              <Ionicons name="warning" size={32} color={colors.error} />
            </View>
            <Text style={styles.modalTitle}>Sicherheitswarnung</Text>
            <ScrollView style={{ maxHeight: 300 }}>
              {check?.allergy_conflicts?.map((c: any, i: number) => (
                <View key={`a${i}`} style={[styles.conflictRow, { borderLeftColor: colors.error }]}>
                  <Text style={styles.conflictBadgeHigh}>ALLERGIE</Text>
                  <Text style={styles.conflictText}>{c.message}</Text>
                </View>
              ))}
              {check?.interactions?.map((it: any, i: number) => {
                const rc = it.risk === "high" ? colors.error : it.risk === "medium" ? colors.warning : colors.info;
                return (
                  <View key={`i${i}`} style={[styles.conflictRow, { borderLeftColor: rc }]}>
                    <Text style={[styles.conflictBadge, { color: rc }]}>{it.risk === "high" ? "HOHES" : it.risk === "medium" ? "MITTLERES" : "GERINGES"} RISIKO · {it.with}</Text>
                    <Text style={styles.conflictText}>{it.message}</Text>
                  </View>
                );
              })}
              {check?.duplicate && (
                <View style={[styles.conflictRow, { borderLeftColor: colors.warning }]}>
                  <Text style={[styles.conflictBadge, { color: colors.warning }]}>DOPPELVERORDNUNG</Text>
                  <Text style={styles.conflictText}>Dieses Medikament ist bereits hinterlegt.</Text>
                </View>
              )}
            </ScrollView>
            <Text style={styles.modalDisclaimer}>Dies ersetzt keine ärztliche Beratung.</Text>
            <PrimaryButton testID="save-anyway" label="Trotzdem speichern" variant="danger" onPress={doSave} style={{ marginTop: spacing.md }} />
            <Pressable testID="cancel-save" onPress={() => setCheck(null)} style={styles.modalCancel}>
              <Text style={styles.modalCancelText}>Abbrechen & Ändern</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

function Label({ text }: { text: string }) {
  return <Text style={styles.label}>{text}</Text>;
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  closeBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  title: { fontSize: font.lg, fontWeight: "800", color: colors.onSurface },
  label: { fontSize: 13, fontWeight: "700", color: colors.onSurfaceSecondary, marginTop: spacing.lg, marginBottom: spacing.sm },
  input: { minHeight: 52, borderRadius: radius.md, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, fontSize: font.lg, color: colors.onSurface, marginBottom: 4 },
  wrapRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  tag: { paddingHorizontal: 16, height: 40, borderRadius: radius.pill, backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  tagActive: { backgroundColor: colors.brandPrimary },
  tagText: { fontWeight: "700", color: colors.onSurfaceSecondary },
  customRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm, alignItems: "center" },
  addTimeBtn: { width: 52, height: 52, borderRadius: radius.md, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center" },
  daysRow: { flexDirection: "row", justifyContent: "space-between" },
  dayCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  dayActive: { backgroundColor: colors.brandPrimary },
  dayText: { fontWeight: "700", color: colors.onSurfaceSecondary, fontSize: 12 },
  colorDot: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  colorActive: { borderWidth: 3, borderColor: colors.onSurface },
  warning: { flexDirection: "row", gap: spacing.sm, backgroundColor: "#FDF3E6", borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: "#F6D8A8", marginBottom: spacing.sm },
  warningText: { flex: 1, color: "#92600A", fontSize: 12.5, lineHeight: 18, fontWeight: "600" },
  autocompleteWrap: { position: "relative", zIndex: 10 },
  inputWithIcon: { flexDirection: "row", alignItems: "center", gap: spacing.sm, minHeight: 52, borderRadius: radius.md, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md },
  autocompleteInput: { flex: 1, fontSize: font.lg, color: colors.onSurface },
  suggestDrop: { marginTop: spacing.xs, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, overflow: "hidden", ...shadow.card },
  resultRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.divider },
  resultIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.brandSecondary, alignItems: "center", justifyContent: "center" },
  resultName: { fontSize: 15, fontWeight: "700", color: colors.onSurface },
  resultMeta: { fontSize: 12, color: colors.onSurfaceTertiary, marginTop: 2 },
  scanRow: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md },
  scanBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, minHeight: 48, borderRadius: radius.md, backgroundColor: colors.brandSecondary, borderWidth: 1, borderColor: colors.brandSecondary },
  scanBtnText: { color: colors.brand, fontWeight: "700", fontSize: 13 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(10,25,41,0.55)", alignItems: "center", justifyContent: "center", padding: spacing.lg },
  modalCard: { width: "100%", backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.xl, alignItems: "center" },
  modalIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: "#FDECEC", alignItems: "center", justifyContent: "center" },
  modalTitle: { fontSize: 20, fontWeight: "800", color: colors.onSurface, marginTop: spacing.md, marginBottom: spacing.md },
  conflictRow: { borderLeftWidth: 4, backgroundColor: colors.surfaceSecondary, borderRadius: radius.sm, padding: spacing.md, marginBottom: spacing.sm },
  conflictBadge: { fontSize: 11, fontWeight: "800", marginBottom: 4 },
  conflictBadgeHigh: { fontSize: 11, fontWeight: "800", marginBottom: 4, color: colors.error },
  conflictText: { fontSize: 14, color: colors.onSurfaceSecondary, lineHeight: 20 },
  modalDisclaimer: { fontSize: 12, color: colors.onSurfaceTertiary, marginTop: spacing.sm, fontStyle: "italic" },
  modalCancel: { paddingVertical: spacing.md },
  modalCancelText: { color: colors.brandPrimary, fontWeight: "700", fontSize: font.base },
  error: { color: colors.error, marginTop: spacing.md, fontWeight: "600" },
});