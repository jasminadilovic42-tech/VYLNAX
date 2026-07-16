import React, { useCallback, useRef, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TextInput, Pressable, ActivityIndicator,
  KeyboardAvoidingView, Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, spacing, radius, font } from "@/src/theme";
import { api } from "@/src/api";
import { useApp } from "@/src/context/AppContext";
import { VLogo } from "@/src/components/ui";
import * as Speech from "expo-speech";
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from "expo-speech-recognition";
type Msg = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "Wann muss ich meine Medikamente einnehmen?",
  "Darf ich Ibuprofen und Paracetamol kombinieren?",
  "Was tun bei einer vergessenen Einnahme?",
  "Wie funktioniert das VYLNAX PRO Gerät?",
];

export default function Assistant() {
  const { activePatient } = useApp();
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [initial, setInitial] = useState(true);
  const scrollRef = useRef<ScrollView>(null);
  const [isListening, setIsListening] = useState(false);
  const [spokenText, setSpokenText] = useState("");
  const [speakingText, setSpeakingText] = useState<string | null>(null);
useSpeechRecognitionEvent("start", () => {
  setIsListening(true);
});

useSpeechRecognitionEvent("end", () => {
  setIsListening(false);
});

useSpeechRecognitionEvent("result", (event) => {
  const text = event.results?.[0]?.transcript ?? "";

  setSpokenText(text);
  setInput(text);

  if (event.isFinal && text.trim()) {
    send(text);
    setSpokenText("");
    setInput("");
  }
});
useSpeechRecognitionEvent("error", (event) => {
  console.log("Speech error:", event);
  setIsListening(false);
});

const startListening = async () => {
  await Speech.stop();

  const permission =
    await ExpoSpeechRecognitionModule.requestPermissionsAsync();

  if (!permission.granted) return;

  setSpokenText("");
  setInput("");

  ExpoSpeechRecognitionModule.start({
    lang: "de-DE",
    interimResults: true,
    continuous: false,
  });
};

const stopListening = () => {
  ExpoSpeechRecognitionModule.stop();
};
  const speakText = async (text: string) => {
  const isSpeaking = await Speech.isSpeakingAsync();

if (isSpeaking) {
  await Speech.stop();
}

  if (speakingText === text) {
    setSpeakingText(null);
    return;
  }

  setSpeakingText(text);
  const cleanText = text
  .replace(/VYLNAX\s+PRO\s+AI/gi, "Vilnaks Pro Asistent")
  .replace(/VYLNAX\s+PRO/gi, "Vilnaks Pro")
  .replace(/VYLNAX\s+AI/gi, "Vilnaks Asistent")
  .replace(/VYLNAX/gi, "Vilnaks")
  .replace(/\*\*/g, "")
  .replace(/\*/g, "")
  .replace(/#{1,6}\s?/g, "")
  .replace(/`/g, "")
  .replace(/_/g, "")
  .replace(/^\s*[-•]\s+/gm, "")
  .replace(/^\s*\d+\.\s+/gm, "")
  .replace(/\[(.*?)\]\((.*?)\)/g, "$1")
  .replace(/\s+/g, " ")
  .trim();

Speech.speak(cleanText, {
    language: "de-DE",
    rate: 1.0,
    pitch: 1.0,
    onDone: () => setSpeakingText(null),
    onStopped: () => setSpeakingText(null),
    onError: () => setSpeakingText(null),
  });
};

  const stopSpeaking = async () => {
  await Speech.stop();
  setSpeakingText(null);
};
  const loadHistory = useCallback(async () => {
    try {
      const hist = await api<Msg[]>("/assistant/history");
      setMessages(hist.map((h: any) => ({ role: h.role, content: h.content })));
    } catch {} finally { setInitial(false); }
  }, []);

  useFocusEffect(useCallback(() => { loadHistory(); }, [loadHistory]));

  const send = async (text: string) => {
    const msg = text.trim();
    if (!msg || loading) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", content: msg }]);
    setLoading(true);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    try {
      const res = await api<{ reply: string }>("/assistant/chat", {
        method: "POST",
        body: { message: msg, patient_id: activePatient?.id },
      });
      setMessages((m) => [...m, { role: "assistant", content: res.reply }]);
      
    } catch (e) {
       console.log(e);
      setMessages((m) => [...m, { role: "assistant", content: "Entschuldigung, der Assistent ist gerade nicht erreichbar. Bitte versuchen Sie es erneut." }]);
    } finally {
      setLoading(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

    const clear = async () => {
    await api("/assistant/history", { method: "DELETE" });
    setMessages([]);
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <View style={styles.headTitle}>
          <VLogo size={34} />
          <View>
            <Text style={styles.title}>KI-Assistent</Text>
            <Text style={styles.sub}>Ihr persönlicher Medikamenten-Helfer</Text>
          </View>
        </View>
        {messages.length > 0 && (
          <Pressable testID="clear-chat" onPress={clear} style={styles.clearBtn}>
            <Ionicons name="trash-outline" size={20} color={colors.onSurfaceTertiary} />
          </Pressable>
        )}
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={90}>
        <ScrollView ref={scrollRef} contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xl }}>
          {initial ? (
            <ActivityIndicator color={colors.brandPrimary} style={{ marginTop: 40 }} />
          ) : messages.length === 0 ? (
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <Ionicons name="sparkles" size={36} color={colors.brandPrimary} />
              </View>
              <Text style={styles.emptyTitle}>Wie kann ich helfen?</Text>
              <Text style={styles.emptyText}>Fragen Sie mich zu Medikamenten, Einnahmezeiten oder zur App.</Text>
              <View style={{ marginTop: spacing.lg, gap: spacing.sm, width: "100%" }}>
                {SUGGESTIONS.map((s) => (
                  <Pressable key={s} testID={`suggestion-${s.slice(0,10)}`} onPress={() => send(s)} style={styles.suggestion}>
                    <Ionicons name="chatbubble-ellipses-outline" size={18} color={colors.brandPrimary} />
                    <Text style={styles.suggestionText}>{s}</Text>
                  </Pressable>
                ))}
              </View>
              <Text style={styles.disclaimer}>Hinweis: Ersetzt keinen ärztlichen Rat.</Text>
            </View>
          ) : (
            messages.map((m, i) => (
              <View key={i} style={[styles.bubbleRow, m.role === "user" ? styles.rowUser : styles.rowBot]}>
                {m.role === "assistant" && (
                  <View style={styles.botAvatar}><Ionicons name="sparkles" size={14} color="#fff" /></View>
                )}
                <View style={[styles.bubble, m.role === "user" ? styles.userBubble : styles.botBubble]}>
  <Text
    style={[styles.bubbleText, m.role === "user" && { color: "#fff" }]}
  >
    {m.content}
  </Text>

  {m.role === "assistant" && (
    <Pressable
      onPress={() =>
        speakingText === m.content
          ? stopSpeaking()
          : speakText(m.content)
      }
      style={{ marginTop: 8, alignSelf: "flex-end" }}
    >
      <Ionicons
        name={speakingText === m.content ? "stop-circle" : "volume-high"}
        size={22}
        color={colors.brandPrimary}
      />
    </Pressable>
  )}
</View>
              </View>
            ))
          )}
          {loading && (
            <View style={[styles.bubbleRow, styles.rowBot]}>
              <View style={styles.botAvatar}><Ionicons name="sparkles" size={14} color="#fff" /></View>
              <View style={[styles.bubble, styles.botBubble]}>
                <ActivityIndicator color={colors.brandPrimary} size="small" />
              </View>
            </View>
          )}
        </ScrollView>

        <View style={[styles.inputBar, { paddingBottom: insets.bottom + spacing.sm }]}>
          <TextInput
            testID="chat-input"
            value={input}
            onChangeText={setInput}
            placeholder="Nachricht schreiben…"
            placeholderTextColor={colors.borderStrong}
            style={styles.input}
            multiline
            onSubmitEditing={() => send(input)}
          />
          <Pressable
  onPressIn={startListening}
  onPressOut={stopListening}
  style={[
    styles.voiceButton,
    isListening && { backgroundColor: "#e53935" },
  ]}
>
  <Ionicons
    name={isListening ? "mic" : "mic-outline"}
    size={24}
    color="#fff"
  />
</Pressable>
          <Pressable testID="send-message" onPress={() => send(input)} disabled={!input.trim() || loading} style={[styles.sendBtn, (!input.trim() || loading) && { opacity: 0.5 }]}>
            <Ionicons name="arrow-up" size={22} color="#fff" />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  voiceButton: {
  width: 48,
  height: 48,
  borderRadius: 24,
  backgroundColor: colors.brandPrimary,
  justifyContent: "center",
  alignItems: "center",
  marginHorizontal: 8,
},
  container: { flex: 1, backgroundColor: colors.surfaceSecondary },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: colors.surface, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  headTitle: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  title: { fontSize: 18, fontWeight: "800", color: colors.onSurface },
  sub: { fontSize: 12, color: colors.onSurfaceTertiary },
  clearBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  empty: { alignItems: "center", marginTop: spacing.xl },
  emptyIcon: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.brandSecondary, alignItems: "center", justifyContent: "center" },
  emptyTitle: { fontSize: 20, fontWeight: "800", color: colors.onSurface, marginTop: spacing.lg },
  emptyText: { fontSize: 14, color: colors.onSurfaceSecondary, textAlign: "center", marginTop: spacing.xs },
  suggestion: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
  suggestionText: { flex: 1, color: colors.onSurface, fontSize: 14, fontWeight: "500" },
  disclaimer: { fontSize: 11, color: colors.onSurfaceTertiary, marginTop: spacing.lg },
  bubbleRow: { flexDirection: "row", marginBottom: spacing.md, alignItems: "flex-end", gap: 6 },
  rowUser: { justifyContent: "flex-end" },
  rowBot: { justifyContent: "flex-start" },
  botAvatar: { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" },
  bubble: { maxWidth: "80%", padding: spacing.md, borderRadius: radius.lg },
  userBubble: { backgroundColor: colors.brandPrimary, borderBottomRightRadius: 4 },
  botBubble: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderBottomLeftRadius: 4 },
  bubbleText: { fontSize: 15, lineHeight: 21, color: colors.onSurface },
  inputBar: { flexDirection: "row", alignItems: "flex-end", gap: spacing.sm, padding: spacing.md, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border },
  input: { flex: 1, maxHeight: 120, minHeight: 48, borderRadius: radius.lg, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, paddingTop: 12, fontSize: 15, color: colors.onSurface },
  sendBtn: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" },
});
