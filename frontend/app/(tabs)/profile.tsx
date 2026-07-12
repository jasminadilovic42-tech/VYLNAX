import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, spacing, radius, font, ROLES } from "@/src/theme";
import { api } from "@/src/api";
import { useAuth } from "@/src/context/AuthContext";
import { useApp } from "@/src/context/AppContext";
import { Card } from "@/src/components/ui";
import { SectionTitle } from "@/src/components/shared";

export default function Profile() {
  const { user, logout, setRole } = useAuth();
  const { patients, activePatient, setActivePatient, loadPatients } = useApp();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [overview, setOverview] = useState<Record<string, any>>({});
  const [busy, setBusy] = useState(false);

  const loadOverview = useCallback(async () => {
    const map: Record<string, any> = {};
    await Promise.all(
      patients.map(async (p) => {
        try {
          map[p.id] = await api(`/patients/${p.id}/reports?period=day`);
        } catch {}
      })
    );
    setOverview(map);
  }, [patients]);

  useFocusEffect(useCallback(() => { loadPatients().then(loadOverview); }, [loadOverview]));

  const changeRole = async (r: string) => {
    setBusy(true);
    try { await setRole(r); } finally { setBusy(false); }
  };

  const removePatient = async (id: string) => {
    await api(`/patients/${id}`, { method: "DELETE" });
    loadPatients();
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Text style={styles.title}>Profil</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}>
        <Card style={styles.userCard}>
          {user?.picture ? (
            <Image source={{ uri: user.picture }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Text style={styles.avatarInit}>{(user?.name || "?")[0]}</Text>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.userName}>{user?.name}</Text>
            <Text style={styles.userEmail}>{user?.email}</Text>
          </View>
        </Card>

        <SectionTitle title="Meine Rolle" />
        <View style={styles.roleRow}>
          {Object.entries(ROLES).map(([key, label]) => {
            const active = user?.role === key;
            return (
              <Pressable key={key} testID={`role-${key}`} onPress={() => changeRole(key)} disabled={busy} style={[styles.roleChip, active && styles.roleActive]}>
                <Ionicons name={key === "patient" ? "person" : key === "relative" ? "people" : "medical"} size={18} color={active ? "#fff" : colors.brandPrimary} />
                <Text style={[styles.roleText, active && { color: "#fff" }]}>{label}</Text>
              </Pressable>
            );
          })}
        </View>

        <SectionTitle title="Betreute Personen" action="+ Hinzufügen" onAction={() => router.push("/add-patient")} />
        {patients.map((p) => {
          const ov = overview[p.id];
          const active = activePatient?.id === p.id;
          return (
            <Card key={p.id} style={[styles.patientCard, active && { borderColor: colors.brandPrimary, borderWidth: 2 }]}>
              <Pressable testID={`select-patient-${p.id}`} onPress={() => setActivePatient(p)} style={styles.patientMain}>
                <View style={styles.patientAvatar}>
                  <Ionicons name={p.is_self ? "person-circle" : "person"} size={28} color={colors.brandPrimary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.patientName}>{p.name}{p.is_self ? " (Ich)" : ""}</Text>
                  <Text style={styles.patientMeta}>
                    {ov ? `${ov.taken} eingenommen · ${ov.missed} vergessen` : "—"}
                  </Text>
                </View>
                {ov && (
                  <View style={[styles.rateBadge, { backgroundColor: ov.adherence >= 80 ? "#E7F5EF" : "#FDF3E6" }]}>
                    <Text style={{ color: ov.adherence >= 80 ? colors.success : colors.warning, fontWeight: "800" }}>{ov.adherence}%</Text>
                  </View>
                )}
              </Pressable>
              {!p.is_self && (
                <Pressable testID={`delete-patient-${p.id}`} onPress={() => removePatient(p.id)} style={styles.delBtn}>
                  <Ionicons name="trash-outline" size={18} color={colors.error} />
                </Pressable>
              )}
            </Card>
          );
        })}

        <Pressable testID="logout-button" onPress={logout} style={styles.logout}>
          <Ionicons name="log-out-outline" size={20} color={colors.error} />
          <Text style={styles.logoutText}>Abmelden</Text>
        </Pressable>
        <Text style={styles.footerBrand}>VYLNAX PRO · Intelligent. Sicher. Menschlich.</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surfaceSecondary },
  header: { backgroundColor: colors.surface, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  title: { fontSize: 22, fontWeight: "800", color: colors.onSurface, paddingHorizontal: spacing.lg },
  userCard: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  avatar: { width: 56, height: 56, borderRadius: 28 },
  avatarFallback: { backgroundColor: colors.brand, alignItems: "center", justifyContent: "center" },
  avatarInit: { color: "#fff", fontSize: 24, fontWeight: "800" },
  userName: { fontSize: font.lg, fontWeight: "800", color: colors.onSurface },
  userEmail: { fontSize: 13, color: colors.onSurfaceTertiary, marginTop: 2 },
  roleRow: { flexDirection: "row", gap: spacing.sm },
  roleChip: { flex: 1, alignItems: "center", gap: 4, paddingVertical: spacing.md, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  roleActive: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  roleText: { fontSize: 12, fontWeight: "700", color: colors.brandPrimary, textAlign: "center" },
  patientCard: { flexDirection: "row", alignItems: "center", marginBottom: spacing.md, paddingVertical: spacing.md },
  patientMain: { flexDirection: "row", alignItems: "center", gap: spacing.md, flex: 1 },
  patientAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.brandSecondary, alignItems: "center", justifyContent: "center" },
  patientName: { fontSize: font.lg, fontWeight: "700", color: colors.onSurface },
  patientMeta: { fontSize: 12, color: colors.onSurfaceTertiary, marginTop: 2 },
  rateBadge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.pill },
  delBtn: { padding: spacing.sm, marginLeft: spacing.sm },
  logout: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: spacing.xl, minHeight: 52, borderRadius: radius.md, backgroundColor: "#FDECEC" },
  logoutText: { color: colors.error, fontWeight: "800", fontSize: font.lg },
  footerBrand: { textAlign: "center", color: colors.onSurfaceTertiary, fontSize: 12, marginTop: spacing.xl },
});
