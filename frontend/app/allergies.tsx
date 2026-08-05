import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { Platform } from "react-native";
import { colors, spacing, radius, font } from "@/src/theme";
import { api } from "@/src/api";
import { useApp } from "@/src/context/AppContext";
import { PrimaryButton } from "@/src/components/ui";

export default function Allergies() {
  const { activePatient, loadPatients } = useApp();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [options, setOptions] = useState<string[]>([]);
  const [selected, setSelected] = useState<string[]>((activePatient?.allergies as string[]) || []);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const opts = await api<string[]>("/allergy-options");
        setOptions(opts);
      } catch {} finally { setLoading(false); }
    })();
  }, []);

  const toggle = (a: string) => {
    if (Platform.OS !== "web") Haptics.selectionAsync();
    setSelected((p) => (p.includes(a) ? p.filter((x) => x !== a) : [...p, a]));
  };

  const save = async () => {
    if (!activePatient) return;
    setSaving(true);
    try {
      await api(`/patients/${activePatient.id}/allergies`, { method: "PUT", body: { allergies: selected } });
      await loadPatients();
      router.back();
    } catch {} finally { setSaving(false); }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable testID="allergies-close" onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="close" size={24} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.title}>Allergie-Profil</Text>
        <View style={{ width: 40 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
        <View style={styles.info}>
          <Ionicons name="medical" size={20} color={colors.brandPrimary} />
          <Text style={styles.infoText}>
            Bekannte Allergien von {activePatient?.name}. Bei Konflikt mit einem Medikament warnt VYLNAX PRO vor dem Speichern.
          </Text>
        </View>

        {loading ? (
          <ActivityIndicator color={colors.brandPrimary} style={{ marginTop: 40 }} />
        ) : (
          <View style={styles.list}>
            {options.map((a) => {
              const active = selected.includes(a);
              return (
                <Pressable key={a} testID={`allergy-${a}`} onPress={() => toggle(a)} style={[styles.row, active && styles.rowActive]}>
                  <Ionicons name={active ? "checkbox" : "square-outline"} size={24} color={active ? colors.error : colors.borderStrong} />
                  <Text style={[styles.rowText, active && { color: colors.error, fontWeight: "700" }]}>{a}</Text>
                  {active && <Ionicons name="warning" size={18} color={colors.error} />}
                </Pressable>
              );
            })}
          </View>
        )}

        <PrimaryButton testID="save-allergies" label="Allergie-Profil speichern" icon="checkmark" loading={saving} onPress={save} style={{ marginTop: spacing.xl }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.sm, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  title: { fontSize: font.lg, fontWeight: "800", color: colors.onSurface },
  info: { flexDirection: "row", gap: spacing.sm, backgroundColor: colors.brandTertiary, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.lg },
  infoText: { flex: 1, fontSize: 13, color: colors.onSurfaceSecondary, lineHeight: 19 },
  list: { gap: spacing.sm },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border, minHeight: 56 },
  rowActive: { backgroundColor: "#FDECEC", borderColor: "#F5C6C6" },
  rowText: { flex: 1, fontSize: font.lg, color: colors.onSurface },
});
