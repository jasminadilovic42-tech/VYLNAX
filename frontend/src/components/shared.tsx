import React from "react";
import { View, Text, StyleSheet, Pressable, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { Platform } from "react-native";
import { colors, spacing, radius, shadow } from "@/src/theme";
import { useApp, Patient } from "@/src/context/AppContext";

export function PatientSwitcher() {
  const { patients, activePatient, setActivePatient } = useApp();
  if (patients.length <= 1) return null;
  return (
    <View style={styles.chipWrap}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: spacing.sm, paddingHorizontal: spacing.lg }}
      >
        {patients.map((p) => {
          const active = activePatient?.id === p.id;
          return (
            <Pressable
              key={p.id}
              testID={`patient-chip-${p.id}`}
              onPress={() => setActivePatient(p)}
              style={[styles.chip, active && styles.chipActive]}
            >
              <Ionicons
                name={p.is_self ? "person-circle" : "person"}
                size={16}
                color={active ? "#fff" : colors.brandPrimary}
              />
              <Text style={[styles.chipText, active && { color: "#fff" }]} numberOfLines={1}>
                {p.name}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

export function SosFab({ bottom = 96 }: { bottom?: number }) {
  const router = useRouter();
  return (
    <Pressable
      testID="sos-fab"
      onPress={() => {
        if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        router.push("/sos");
      }}
      style={({ pressed }) => [styles.fab, { bottom, opacity: pressed ? 0.9 : 1 }]}
    >
      <Ionicons name="warning" size={24} color="#fff" />
      <Text style={styles.fabText}>SOS</Text>
    </Pressable>
  );
}

export function SectionTitle({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <View style={styles.sectionRow}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {action ? (
        <Pressable onPress={onAction} testID={`section-action-${title}`}>
          <Text style={styles.sectionAction}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  chipWrap: { height: 56, justifyContent: "center" },
  chip: {
    flexShrink: 0,
    height: 36,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    backgroundColor: colors.brandSecondary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  chipText: { color: colors.brand, fontWeight: "700", fontSize: 13, maxWidth: 120 },
  fab: {
    position: "absolute",
    right: spacing.lg,
    backgroundColor: colors.error,
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    ...shadow.strong,
  },
  fabText: { color: "#fff", fontWeight: "900", fontSize: 12, marginTop: -2 },
  sectionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
    marginTop: spacing.xl,
  },
  sectionTitle: { fontSize: 18, fontWeight: "800", color: colors.onSurface },
  sectionAction: { fontSize: 14, fontWeight: "700", color: colors.brandPrimary },
});
