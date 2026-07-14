import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, TextInput, Pressable, KeyboardAvoidingView, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, spacing, radius, font } from "@/src/theme";
import { api } from "@/src/api";
import { useApp } from "@/src/context/AppContext";
import { PrimaryButton } from "@/src/components/ui";

export default function AddPatient() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { loadPatients } = useApp();
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [room, setRoom] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const save = async () => {
    setError("");
    if (!name.trim()) { setError("Bitte einen Namen angeben."); return; }
    setSaving(true);
    try {
      await api("/patients", {
        method: "POST",
        body: { name: name.trim(), age: age ? parseInt(age) : null, room: room.trim() || null, notes: notes.trim() || null },
      });
      await loadPatients();
      router.back();
    } catch {
      setError("Speichern fehlgeschlagen.");
    } finally { setSaving(false); }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.surface }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable testID="close-modal" onPress={() => router.back()} style={styles.closeBtn}>
          <Ionicons name="close" size={24} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.title}>Person hinzufügen</Text>
        <View style={{ width: 40 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: spacing.lg }} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>Name *</Text>
        <TextInput testID="patient-name-input" value={name} onChangeText={setName} placeholder="z. B. Maria Schmidt" placeholderTextColor={colors.borderStrong} style={styles.input} />
        <Text style={styles.label}>Alter</Text>
        <TextInput testID="patient-age-input" value={age} onChangeText={setAge} placeholder="z. B. 74" placeholderTextColor={colors.borderStrong} style={styles.input} keyboardType="number-pad" />
        <Text style={styles.label}>Zimmer / Standort</Text>
        <TextInput testID="patient-room-input" value={room} onChangeText={setRoom} placeholder="z. B. Zimmer 12" placeholderTextColor={colors.borderStrong} style={styles.input} />
        <Text style={styles.label}>Notizen</Text>
        <TextInput testID="patient-notes-input" value={notes} onChangeText={setNotes} placeholder="Wichtige Hinweise" placeholderTextColor={colors.borderStrong} style={[styles.input, { height: 90, textAlignVertical: "top", paddingTop: spacing.md }]} multiline />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <PrimaryButton testID="save-patient" label="Person speichern" icon="checkmark" loading={saving} onPress={save} style={{ marginTop: spacing.xl }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  closeBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  title: { fontSize: font.lg, fontWeight: "800", color: colors.onSurface },
  label: { fontSize: 13, fontWeight: "700", color: colors.onSurfaceSecondary, marginTop: spacing.lg, marginBottom: spacing.sm },
  input: { minHeight: 52, borderRadius: radius.md, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, fontSize: font.lg, color: colors.onSurface },
  error: { color: colors.error, marginTop: spacing.md, fontWeight: "600" },
});
