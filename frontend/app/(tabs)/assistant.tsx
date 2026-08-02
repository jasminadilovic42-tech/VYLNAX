import React, { useCallback, useRef, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TextInput, Pressable, ActivityIndicator,
  KeyboardAvoidingView, Platform, Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, spacing, radius } from "@/src/theme";
import { api } from "@/src/api";
import { useApp } from "@/src/context/AppContext";
import { VLogo } from "@/src/components/ui";

type Msg = {
  role: "user" | "assistant";
  content: string;
  suggest_journal?: boolean;
  source_text?: string | null;
  journal_saved?: boolean;
};

type AssistantContext = {
  memories: Array<{ id: string; label: string; value: string }>;
  recent_journal: Array<{ id: string; category: string; text: string; created_at: string }>;
  recent_vitals: Array<{ id: string; vital_type: string; value?: number; systolic?: number; diastolic?: number; unit?: string }>;
  habit_summary: string;
};

const SUGGESTIONS = [
  "Welche Medikamente stehen heute an?",
  "Wie waren meine letzten Vitalwerte?",
  "Fasse meinen heutigen Gesundheitsverlauf zusammen.",
  "Was tun bei einer vergessenen Einnahme?",
];

export default function Assistant() {
  const { activePatient } = useApp();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [context, setContext] = useState<AssistantContext | null>(null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [initial, setInitial] = useState(true);
  const [voiceMode, setVoiceMode] = useState(false);
  const [savingJournal, setSavingJournal] = useState<number | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  const loadHistory = useCallback(async () => {
    try {
      if (!activePatient) {
        setMessages([]);
        setContext(null);
        return;
      }
      const [hist, ctx] = await Promise.all([
        api<Msg[]>(`/assistant/history?patient_id=${activePatient.id}`),
        api<AssistantContext>(`/patients/${activePatient.id}/assistant-context`),
      ]);
      setMessages(hist.map((h: any) => ({
        role: h.role,
        content: h.content,
        suggest_journal: h.suggest_journal,
        source_text: h.source_text,
      })));
      setContext(ctx);
    } catch {
    } finally {
      setInitial(false);
    }
  }, [activePatient]);

  useFocusEffect(useCallback(() => {
    setInitial(true);
    loadHistory();
  }, [loadHistory]));

  const send = async (text: string) => {
    const msg = text.trim().replace(/^Hallo VYLNAX[,\s]*/i, "");
    if (!msg || loading || !activePatient) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", content: msg }]);
    setLoading(true);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    try {
      const res = await api<{ reply: string; suggest_journal?: boolean; source_text?: string }>('/assistant/chat', {
        method: "POST",
        body: { message: msg, patient_id: activePatient.id },
      });
      setMessages((m) => [...m, {
        role: "assistant",
        content: res.reply,
        suggest_journal: res.suggest_journal,
        source_text: res.source_text,
      }]);
      loadContextOnly();
    } catch {
      setMessages((m) => [...m, { role: "assistant", content: "Entschuldigung, der Assistent ist gerade nicht erreichbar. Bitte versuchen Sie es erneut." }]);
    } finally {
      setLoading(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  const loadContextOnly = async () => {
    if (!activePatient) return;
    try {
      setContext(await api<AssistantContext>(`/patients/${activePatient.id}/assistant-context`));
    } catch {}
  };

  const saveSymptom = async (messageIndex: number, text: string) => {
    if (!activePatient || !text.trim()) return;
    setSavingJournal(messageIndex);
    try {
      await api(`/patients/${activePatient.id}/journal`, {
        method: "POST",
        body: { category: "symptom", text: text.trim(), tags: ["KI-Assistent"] },
      });
      setMessages((items) => items.map((item, i) => i === messageIndex ? { ...item, journal_saved: true } : item));
      await loadContextOnly();
      Alert.alert("Gespeichert", "Die Angabe wurde als Symptom im Patiententagebuch dokumentiert.");
    } catch {
      Alert.alert("Nicht gespeichert", "Der Eintrag konnte nicht gespeichert werden.");
    } finally {
      setSavingJournal(null);
    }
  };

  const clear = async () => {
    if (!activePatient) return;
    await api(`/assistant/history?patient_id=${activePatient.id}`, { method: "DELETE" });
    setMessages([]);
  };

  const latestVital = context?.recent_vitals?.[0];
  const latestVitalText = latestVital
    ? latestVital.vital_type === "blood_pressure"
      ? `${latestVital.systolic}/${latestVital.diastolic} mmHg`
      : `${latestVital.value ?? "–"} ${latestVital.unit || ""}`.trim()
    : "Noch keine Messung";

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}> 
        <View style={styles.headTitle}>
          <VLogo size={34} />
          <View>
            <Text style={styles.title}>KI Care Assistant</Text>
            <Text style={styles.sub}>{activePatient?.name || "Kein Patient ausgewählt"}</Text>
          </View>
        </View>
        <Pressable testID="wake-word-toggle" onPress={() => setVoiceMode(v => !v)} style={[styles.voiceChip, voiceMode && styles.voiceChipActive]}>
          <Ionicons name={voiceMode ? "mic" : "mic-outline"} size={18} color={voiceMode ? "#fff" : colors.brandPrimary} />
          <Text style={[styles.voiceChipText, voiceMode && { color: "#fff" }]}>{voiceMode ? "Hallo VYLNAX aktiv" : "Sprachmodus"}</Text>
        </Pressable>
        {messages.length > 0 && (
          <Pressable testID="clear-chat" onPress={clear} style={styles.clearBtn}>
            <Ionicons name="trash-outline" size={20} color={colors.onSurfaceTertiary} />
          </Pressable>
        )}
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={90}>
        <ScrollView ref={scrollRef} contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xl }}>
          {activePatient && context && (
            <View style={styles.contextCard}>
              <View style={styles.contextTitleRow}>
                <Ionicons name="shield-checkmark" size={18} color={colors.brandPrimary} />
                <Text style={styles.contextTitle}>Aktiver Patientenkontext</Text>
              </View>
              <View style={styles.contextGrid}>
                <View style={styles.contextItem}><Text style={styles.contextLabel}>Letzter Vitalwert</Text><Text style={styles.contextValue}>{latestVitalText}</Text></View>
                <View style={styles.contextItem}><Text style={styles.contextLabel}>Tagebuch</Text><Text style={styles.contextValue}>{context.recent_journal?.length || 0} letzte Einträge</Text></View>
              </View>
              <Text style={styles.habitText}>{context.habit_summary}</Text>
              <Text style={styles.contextHint}>Der Assistent nutzt nur dokumentierte Patientendaten und ersetzt keine medizinische Beurteilung.</Text>
              <Pressable onPress={() => router.push("/assistant-memory" as any)} style={styles.memoryLink}>
                <Ionicons name="brain-outline" size={16} color={colors.brandPrimary} />
                <Text style={styles.memoryLinkText}>Bestätigte KI-Merkpunkte verwalten</Text>
              </Pressable>
            </View>
          )}

          {initial ? (
            <ActivityIndicator color={colors.brandPrimary} style={{ marginTop: 40 }} />
          ) : messages.length === 0 ? (
            <View style={styles.empty}>
              <View style={styles.emptyIcon}><Ionicons name="sparkles" size={36} color={colors.brandPrimary} /></View>
              <Text style={styles.emptyTitle}>Wie kann ich helfen?</Text>
              <Text style={styles.emptyText}>Ich berücksichtige Therapie, Allergien, Vitalwerte, Tagebuch und dokumentierte Gewohnheiten des aktiven Patienten.</Text>
              <View style={{ marginTop: spacing.lg, gap: spacing.sm, width: "100%" }}>
                {SUGGESTIONS.map((s) => (
                  <Pressable key={s} onPress={() => send(s)} style={styles.suggestion}>
                    <Ionicons name="chatbubble-ellipses-outline" size={18} color={colors.brandPrimary} />
                    <Text style={styles.suggestionText}>{s}</Text>
                  </Pressable>
                ))}
              </View>
              <Text style={styles.disclaimer}>Hinweis: Keine Diagnose, keine Änderung einer verordneten Therapie.</Text>
            </View>
          ) : (
            messages.map((m, i) => (
              <View key={i} style={[styles.bubbleRow, m.role === "user" ? styles.rowUser : styles.rowBot]}>
                {m.role === "assistant" && <View style={styles.botAvatar}><Ionicons name="sparkles" size={14} color="#fff" /></View>}
                <View style={{ maxWidth: "84%" }}>
                  <View style={[styles.bubble, m.role === "user" ? styles.userBubble : styles.botBubble]}>
                    <Text style={[styles.bubbleText, m.role === "user" && { color: "#fff" }]}>{m.content}</Text>
                  </View>
                  {m.role === "assistant" && m.suggest_journal && m.source_text && (
                    <Pressable
                      onPress={() => saveSymptom(i, m.source_text || "")}
                      disabled={m.journal_saved || savingJournal === i}
                      style={[styles.saveJournal, m.journal_saved && styles.saveJournalDone]}
                    >
                      {savingJournal === i ? <ActivityIndicator size="small" color={colors.brandPrimary} /> : <Ionicons name={m.journal_saved ? "checkmark-circle" : "document-text-outline"} size={16} color={m.journal_saved ? colors.success : colors.brandPrimary} />}
                      <Text style={[styles.saveJournalText, m.journal_saved && { color: colors.success }]}>{m.journal_saved ? "Im Tagebuch gespeichert" : "Als Symptom dokumentieren"}</Text>
                    </Pressable>
                  )}
                </View>
              </View>
            ))
          )}
          {loading && (
            <View style={[styles.bubbleRow, styles.rowBot]}>
              <View style={styles.botAvatar}><Ionicons name="sparkles" size={14} color="#fff" /></View>
              <View style={[styles.bubble, styles.botBubble]}><ActivityIndicator color={colors.brandPrimary} size="small" /></View>
            </View>
          )}
        </ScrollView>

        <View style={[styles.inputBar, { paddingBottom: insets.bottom + spacing.sm }]}> 
          <Pressable testID="voice-listen" onPress={() => { setVoiceMode(true); setInput("Hallo VYLNAX, "); }} style={styles.micBtn}><Ionicons name="mic" size={22} color={colors.brandPrimary} /></Pressable>
          <TextInput
            testID="chat-input"
            value={input}
            onChangeText={setInput}
            placeholder={activePatient ? "Nachricht schreiben…" : "Zuerst Patient auswählen"}
            placeholderTextColor={colors.borderStrong}
            style={styles.input}
            multiline
            editable={!!activePatient}
            onSubmitEditing={() => send(input)}
          />
          <Pressable testID="send-message" onPress={() => send(input)} disabled={!input.trim() || loading || !activePatient} style={[styles.sendBtn, (!input.trim() || loading || !activePatient) && { opacity: 0.5 }]}>
            <Ionicons name="arrow-up" size={22} color="#fff" />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surfaceSecondary },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: colors.surface, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  headTitle: { flexDirection: "row", alignItems: "center", gap: spacing.sm, flex: 1 },
  title: { fontSize: 18, fontWeight: "800", color: colors.onSurface },
  sub: { fontSize: 12, color: colors.onSurfaceTertiary },
  clearBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  voiceChip: { flexDirection: "row", alignItems: "center", gap: 5, borderWidth: 1, borderColor: colors.brandPrimary, borderRadius: 18, paddingHorizontal: 9, height: 36 },
  voiceChipActive: { backgroundColor: colors.brandPrimary },
  voiceChipText: { fontSize: 10, fontWeight: "700", color: colors.brandPrimary },
  micBtn: { width: 48, height: 48, borderRadius: 24, borderWidth: 1, borderColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" },
  contextCard: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.lg },
  contextTitleRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  contextTitle: { fontSize: 14, fontWeight: "800", color: colors.onSurface },
  contextGrid: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
  contextItem: { flex: 1, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.sm },
  contextLabel: { fontSize: 10, color: colors.onSurfaceTertiary, textTransform: "uppercase", fontWeight: "700" },
  contextValue: { fontSize: 13, color: colors.onSurface, fontWeight: "700", marginTop: 3 },
  habitText: { fontSize: 12, color: colors.onSurfaceSecondary, marginTop: spacing.sm },
  contextHint: { fontSize: 10, color: colors.onSurfaceTertiary, marginTop: spacing.xs },
  memoryLink: { marginTop: spacing.sm, flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start" },
  memoryLinkText: { fontSize: 11, fontWeight: "700", color: colors.brandPrimary },
  empty: { alignItems: "center", marginTop: spacing.lg },
  emptyIcon: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.brandSecondary, alignItems: "center", justifyContent: "center" },
  emptyTitle: { fontSize: 20, fontWeight: "800", color: colors.onSurface, marginTop: spacing.lg },
  emptyText: { fontSize: 14, color: colors.onSurfaceSecondary, textAlign: "center", marginTop: spacing.xs, lineHeight: 20 },
  suggestion: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
  suggestionText: { flex: 1, color: colors.onSurface, fontSize: 14, fontWeight: "500" },
  disclaimer: { fontSize: 11, color: colors.onSurfaceTertiary, marginTop: spacing.lg, textAlign: "center" },
  bubbleRow: { flexDirection: "row", marginBottom: spacing.md, alignItems: "flex-end", gap: 6 },
  rowUser: { justifyContent: "flex-end" },
  rowBot: { justifyContent: "flex-start" },
  botAvatar: { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" },
  bubble: { padding: spacing.md, borderRadius: radius.lg },
  userBubble: { backgroundColor: colors.brandPrimary, borderBottomRightRadius: 4 },
  botBubble: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderBottomLeftRadius: 4 },
  bubbleText: { fontSize: 15, lineHeight: 21, color: colors.onSurface },
  saveJournal: { marginTop: 6, alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  saveJournalDone: { borderColor: colors.success },
  saveJournalText: { fontSize: 11, fontWeight: "700", color: colors.brandPrimary },
  inputBar: { flexDirection: "row", alignItems: "flex-end", gap: spacing.sm, padding: spacing.md, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border },
  input: { flex: 1, maxHeight: 120, minHeight: 48, borderRadius: radius.lg, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, paddingTop: 12, fontSize: 15, color: colors.onSurface },
  sendBtn: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" },
});
