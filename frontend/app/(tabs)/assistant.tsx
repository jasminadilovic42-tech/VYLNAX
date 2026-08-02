import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Speech from "expo-speech";
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from "@jamsch/expo-speech-recognition";

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
  recent_journal: Array<{
    id: string;
    category: string;
    text: string;
    created_at: string;
  }>;
  recent_vitals: Array<{
    id: string;
    vital_type: string;
    value?: number;
    systolic?: number;
    diastolic?: number;
    unit?: string;
  }>;
  habit_summary: string;
};

type VoicePhase = "off" | "wake" | "command" | "processing" | "speaking";

const SUGGESTIONS = [
  "Welche Medikamente stehen heute an?",
  "Wie waren meine letzten Vitalwerte?",
  "Fasse meinen heutigen Gesundheitsverlauf zusammen.",
  "Was tun bei einer vergessenen Einnahme?",
];

const WAKE_WORD = /(?:hallo|hello|hey)\s+(?:v[yi]lnax|vilnaks|will\s*max|wie\s*max|villenax|wielnax|vylnax)/i;
const RESTART_DELAY_MS = 500;


const GERMAN_ONES = [
  "null", "eins", "zwei", "drei", "vier", "fünf",
  "sechs", "sieben", "acht", "neun", "zehn",
  "elf", "zwölf", "dreizehn", "vierzehn", "fünfzehn",
  "sechzehn", "siebzehn", "achtzehn", "neunzehn",
];

const GERMAN_TENS: Record<number, string> = {
  20: "zwanzig",
  30: "dreißig",
  40: "vierzig",
  50: "fünfzig",
  60: "sechzig",
  70: "siebzig",
  80: "achtzig",
  90: "neunzig",
};

const GERMAN_ORDINAL_DAYS: Record<number, string> = {
  1: "erster",
  2: "zweiter",
  3: "dritter",
  4: "vierter",
  5: "fünfter",
  6: "sechster",
  7: "siebter",
  8: "achter",
  9: "neunter",
  10: "zehnter",
  11: "elfter",
  12: "zwölfter",
  13: "dreizehnter",
  14: "vierzehnter",
  15: "fünfzehnter",
  16: "sechzehnter",
  17: "siebzehnter",
  18: "achtzehnter",
  19: "neunzehnter",
  20: "zwanzigster",
  21: "einundzwanzigster",
  22: "zweiundzwanzigster",
  23: "dreiundzwanzigster",
  24: "vierundzwanzigster",
  25: "fünfundzwanzigster",
  26: "sechsundzwanzigster",
  27: "siebenundzwanzigster",
  28: "achtundzwanzigster",
  29: "neunundzwanzigster",
  30: "dreißigster",
  31: "einunddreißigster",
};

function germanNumber(value: number): string {
  const n = Math.trunc(value);
  if (n < 0) return `minus ${germanNumber(Math.abs(n))}`;
  if (n < 20) return GERMAN_ONES[n];
  if (n < 100) {
    const tens = Math.floor(n / 10) * 10;
    const ones = n % 10;
    if (ones === 0) return GERMAN_TENS[tens];
    const oneWord = ones === 1 ? "ein" : GERMAN_ONES[ones];
    return `${oneWord}und${GERMAN_TENS[tens]}`;
  }
  if (n < 1000) {
    const hundreds = Math.floor(n / 100);
    const rest = n % 100;
    const prefix = hundreds === 1 ? "einhundert" : `${GERMAN_ONES[hundreds]}hundert`;
    return rest ? `${prefix}${germanNumber(rest)}` : prefix;
  }
  if (n < 1_000_000) {
    const thousands = Math.floor(n / 1000);
    const rest = n % 1000;
    const prefix =
      thousands === 1 ? "eintausend" : `${germanNumber(thousands)}tausend`;
    return rest ? `${prefix}${germanNumber(rest)}` : prefix;
  }
  return String(n);
}

function prepareTextForSpeech(text: string): string {
  let spoken = text || "";

  // Markdown i tehnički znakovi se uklanjaju prije govora.
  spoken = spoken
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/^[\s>*#•●▪-]+/gm, "")
    .replace(/[*_#]/g, " ");

  // Datum: "3. August 2026" -> "dritter August zweitausendsechsundzwanzig".
  spoken = spoken.replace(
    /\b([1-9]|[12]\d|3[01])\.\s*(Januar|Februar|März|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember)\s+(\d{4})\b/gi,
    (_match, day, month, year) =>
      `${GERMAN_ORDINAL_DAYS[Number(day)] || day} ${month} ${germanNumber(Number(year))}`
  );

  spoken = spoken
    .replace(/\bVYLNAX\s*PRO\b/gi, "Vilnaks Pro")
    .replace(/\bVYLNAX\b/gi, "Vilnaks")
    .replace(/\bRR\b/gi, "Blutdruck")
    .replace(/\bSpO[₂2]\b/gi, "Sauerstoffsättigung")
    .replace(/\bSYS\b/gi, "systolischer Wert")
    .replace(/\bDIA\b/gi, "diastolischer Wert")
    .replace(/\bmmHg\b/gi, "Millimeter Quecksilbersäule")
    .replace(/\bmg\s*\/\s*d[lL]\b/gi, "Milligramm pro Deziliter")
    .replace(/\bmmol\s*\/\s*[lL]\b/gi, "Millimol pro Liter")
    .replace(/\bmg\b/gi, "Milligramm")
    .replace(/\bµg\b/gi, "Mikrogramm")
    .replace(/\bml\b/gi, "Milliliter")
    .replace(/\bkg\b/gi, "Kilogramm")
    .replace(/\bbpm\b/gi, "Schläge pro Minute")
    .replace(/(\d+)\s*\/\s*min\b/gi, "$1 Schläge pro Minute")
    .replace(/°C/gi, "Grad Celsius")
    .replace(/%/g, " Prozent")
    .replace(/\b(\d{2,3})\s*\/\s*(\d{2,3})\b/g, "$1 zu $2")
    .replace(/\b(\d{1,2}):(\d{2})\b/g, (_match, hour, minute) => {
      const h = Number(hour);
      const m = Number(minute);
      return m === 0
        ? `${germanNumber(h)} Uhr`
        : `${germanNumber(h)} Uhr ${germanNumber(m)}`;
    })
    .replace(/\n+/g, ". ")
    .replace(/\s+([,.;!?])/g, "$1")
    .replace(/([,.;!?]){2,}/g, "$1")
    .replace(/\s+/g, " ")
    .trim();

  return spoken;
}

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
  const [voicePhase, setVoicePhase] = useState<VoicePhase>("off");
  const [recognizedText, setRecognizedText] = useState("");
  const [savingJournal, setSavingJournal] = useState<number | null>(null);

  const scrollRef = useRef<ScrollView>(null);
  const voiceModeRef = useRef(false);
  const voicePhaseRef = useRef<VoicePhase>("off");
  const activePatientRef = useRef(activePatient);
  const loadingRef = useRef(false);
  const restartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intentionalAbortRef = useRef(false);
  const lastFinalTextRef = useRef("");

  useEffect(() => {
    activePatientRef.current = activePatient;
  }, [activePatient]);

  useEffect(() => {
    loadingRef.current = loading;
  }, [loading]);

  const setPhase = useCallback((phase: VoicePhase) => {
    voicePhaseRef.current = phase;
    setVoicePhase(phase);
  }, []);

  const clearRestartTimer = useCallback(() => {
    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
  }, []);

  const stopRecognition = useCallback((abort = true) => {
    clearRestartTimer();
    try {
      intentionalAbortRef.current = true;
      if (abort) {
        ExpoSpeechRecognitionModule.abort();
      } else {
        ExpoSpeechRecognitionModule.stop();
      }
    } catch {
      intentionalAbortRef.current = false;
    }
  }, [clearRestartTimer]);

  const startWakeListening = useCallback(async () => {
    if (
      !voiceModeRef.current ||
      !activePatientRef.current ||
      loadingRef.current ||
      voicePhaseRef.current === "speaking"
    ) {
      return;
    }

    clearRestartTimer();
    setRecognizedText("");
    lastFinalTextRef.current = "";
    intentionalAbortRef.current = false;
    setPhase("wake");

    try {
      ExpoSpeechRecognitionModule.start({
        lang: "de-DE",
        interimResults: true,
        continuous: true,
        maxAlternatives: 1,
        addsPunctuation: false,
      });
    } catch (error) {
      console.warn("Wake-word start failed:", error);
      restartTimerRef.current = setTimeout(() => {
        if (voiceModeRef.current) void startWakeListening();
      }, 1200);
    }
  }, [clearRestartTimer, setPhase]);

  const startCommandListening = useCallback(async () => {
    if (!voiceModeRef.current || !activePatientRef.current) return;

    clearRestartTimer();
    setRecognizedText("");
    lastFinalTextRef.current = "";
    intentionalAbortRef.current = false;
    setPhase("command");

    try {
      ExpoSpeechRecognitionModule.start({
        lang: "de-DE",
        interimResults: true,
        continuous: false,
        maxAlternatives: 1,
        addsPunctuation: true,
      });
    } catch (error) {
      console.warn("Command recognition start failed:", error);
      Alert.alert(
        "Spracherkennung",
        "Die Spracheingabe konnte nicht gestartet werden."
      );
      restartTimerRef.current = setTimeout(() => {
        if (voiceModeRef.current) void startWakeListening();
      }, 1000);
    }
  }, [clearRestartTimer, setPhase, startWakeListening]);

  const speak = useCallback(
    (
      text: string,
      options?: {
        thenListenForCommand?: boolean;
        thenWake?: boolean;
      }
    ) => {
      stopRecognition(true);
      setPhase("speaking");

      Speech.stop();
      const spokenText = prepareTextForSpeech(text);

      Speech.speak(spokenText, {
        language: "de-DE",
        rate: 0.91,
        pitch: 1.02,
        onDone: () => {
          if (!voiceModeRef.current) {
            setPhase("off");
            return;
          }

          if (options?.thenListenForCommand) {
            restartTimerRef.current = setTimeout(() => {
              void startCommandListening();
            }, 300);
            return;
          }

          if (options?.thenWake !== false) {
            restartTimerRef.current = setTimeout(() => {
              void startWakeListening();
            }, RESTART_DELAY_MS);
          }
        },
        onError: () => {
          if (voiceModeRef.current) {
            restartTimerRef.current = setTimeout(() => {
              void startWakeListening();
            }, RESTART_DELAY_MS);
          } else {
            setPhase("off");
          }
        },
      });
    },
    [setPhase, startCommandListening, startWakeListening, stopRecognition]
  );

  const loadHistory = useCallback(async () => {
    try {
      if (!activePatient) {
        setMessages([]);
        setContext(null);
        return;
      }

      const [hist, ctx] = await Promise.all([
        api<Msg[]>(`/assistant/history?patient_id=${activePatient.id}`),
        api<AssistantContext>(
          `/patients/${activePatient.id}/assistant-context`
        ),
      ]);

      setMessages(
        hist.map((h: any) => ({
          role: h.role,
          content: h.content,
          suggest_journal: h.suggest_journal,
          source_text: h.source_text,
        }))
      );
      setContext(ctx);
    } catch {
      // Ekran ostaje upotrebljiv i kada historija privremeno nije dostupna.
    } finally {
      setInitial(false);
    }
  }, [activePatient]);

  useFocusEffect(
    useCallback(() => {
      setInitial(true);
      loadHistory();

      return () => {
        clearRestartTimer();
        Speech.stop();
        stopRecognition(true);
      };
    }, [clearRestartTimer, loadHistory, stopRecognition])
  );

  const loadContextOnly = useCallback(async () => {
    if (!activePatientRef.current) return;

    try {
      setContext(
        await api<AssistantContext>(
          `/patients/${activePatientRef.current.id}/assistant-context`
        )
      );
    } catch {
      // Ne prekidamo razgovor ako osvježavanje konteksta ne uspije.
    }
  }, []);

  const send = useCallback(
    async (text: string, fromVoice = false) => {
      const patient = activePatientRef.current;
      const msg = text
        .trim()
        .replace(/^(?:hallo|hello|hey)\s+(?:v[yi]lnax|vilnaks|will\s*max|wie\s*max|villenax|wielnax)[,\s]*/i, "");

      if (!msg || loadingRef.current || !patient) return;

      setInput("");
      setRecognizedText("");
      setMessages((current) => [
        ...current,
        { role: "user", content: msg },
      ]);
      setLoading(true);
      loadingRef.current = true;

      if (fromVoice) {
        stopRecognition(true);
        setPhase("processing");
      }

      setTimeout(
        () => scrollRef.current?.scrollToEnd({ animated: true }),
        100
      );

      try {
        const res = await api<{
          reply: string;
          suggest_journal?: boolean;
          source_text?: string;
        }>("/assistant/chat", {
          method: "POST",
          body: {
            message: msg,
            patient_id: patient.id,
          },
        });

        setMessages((current) => [
          ...current,
          {
            role: "assistant",
            content: res.reply,
            suggest_journal: res.suggest_journal,
            source_text: res.source_text,
          },
        ]);

        void loadContextOnly();

        if (voiceModeRef.current && fromVoice) {
          speak(res.reply, { thenListenForCommand: true, thenWake: false });
        }
      } catch (error) {
        const fallback =
          "Entschuldigung, der Assistent ist gerade nicht erreichbar. Bitte versuchen Sie es erneut.";

        setMessages((current) => [
          ...current,
          { role: "assistant", content: fallback },
        ]);

        if (voiceModeRef.current && fromVoice) {
          speak(fallback, { thenListenForCommand: true, thenWake: false });
        }
      } finally {
        setLoading(false);
        loadingRef.current = false;
        setTimeout(
          () => scrollRef.current?.scrollToEnd({ animated: true }),
          100
        );

        if (
          voiceModeRef.current &&
          !fromVoice &&
          voicePhaseRef.current !== "speaking"
        ) {
          restartTimerRef.current = setTimeout(() => {
            void startWakeListening();
          }, RESTART_DELAY_MS);
        }
      }
    },
    [
      loadContextOnly,
      setPhase,
      speak,
      startWakeListening,
      stopRecognition,
    ]
  );

  const activateWakeWord = useCallback(async () => {
    if (!activePatientRef.current) {
      Alert.alert(
        "Kein Patient ausgewählt",
        "Bitte zuerst einen Patienten auswählen."
      );
      return;
    }

    try {
      const permission =
        await ExpoSpeechRecognitionModule.requestPermissionsAsync();

      if (!permission.granted) {
        Alert.alert(
          "Mikrofon nicht freigegeben",
          "Bitte erlauben Sie VYLNAX den Zugriff auf Mikrofon und Spracherkennung."
        );
        return;
      }

      voiceModeRef.current = true;
      setVoiceMode(true);
      await startWakeListening();
    } catch (error) {
      console.warn("Speech permission error:", error);
      Alert.alert(
        "Spracherkennung",
        "Die Spracherkennung ist auf diesem Gerät nicht verfügbar."
      );
    }
  }, [startWakeListening]);

  const deactivateWakeWord = useCallback(() => {
    voiceModeRef.current = false;
    setVoiceMode(false);
    setRecognizedText("");
    clearRestartTimer();
    Speech.stop();
    stopRecognition(true);
    setPhase("off");
  }, [clearRestartTimer, setPhase, stopRecognition]);

  const toggleVoiceMode = useCallback(() => {
    if (voiceModeRef.current) {
      deactivateWakeWord();
    } else {
      void activateWakeWord();
    }
  }, [activateWakeWord, deactivateWakeWord]);

  const manualVoiceStart = useCallback(async () => {
    if (!voiceModeRef.current) {
      await activateWakeWord();
    }

    stopRecognition(true);
    speak("Hallo, ich bin da. Wie kann ich helfen?", {
      thenListenForCommand: true,
      thenWake: false,
    });
  }, [activateWakeWord, speak, stopRecognition]);

  // Automatski uključi čekanje na "Hallo VYLNAX" čim se otvori AI ekran.
  // Pri izlasku sa ekrana mikrofon se potpuno isključuje.
  useFocusEffect(
    useCallback(() => {
      const timer = setTimeout(() => {
        if (activePatientRef.current && !voiceModeRef.current) {
          void activateWakeWord();
        } else if (
          activePatientRef.current &&
          voiceModeRef.current &&
          voicePhaseRef.current === "off"
        ) {
          void startWakeListening();
        }
      }, 700);

      return () => {
        clearTimeout(timer);
        deactivateWakeWord();
      };
    }, [activePatient, activateWakeWord, deactivateWakeWord, startWakeListening])
  );

  useSpeechRecognitionEvent("start", () => {
    intentionalAbortRef.current = false;
  });

  useSpeechRecognitionEvent("result", (event) => {
    const transcript = event.results?.[0]?.transcript?.trim() || "";
    if (!transcript) return;

    setRecognizedText(transcript);

    if (voicePhaseRef.current === "wake") {
      if (WAKE_WORD.test(transcript)) {
        stopRecognition(true);
        setRecognizedText("");
        speak("Hallo, ich bin da. Wie kann ich helfen?", {
          thenListenForCommand: true,
          thenWake: false,
        });
      } else if (event.isFinal) {
        clearRestartTimer();
        restartTimerRef.current = setTimeout(() => {
          if (voiceModeRef.current && !loadingRef.current) {
            void startWakeListening();
          }
        }, RESTART_DELAY_MS);
      }
      return;
    }

    if (voicePhaseRef.current === "command" && event.isFinal) {
      const command = transcript
        .replace(/^(?:hallo|hello|hey)\s+(?:v[yi]lnax|vilnaks|will\s*max|wie\s*max|villenax|wielnax)[,\s]*/i, "")
        .trim();

      if (!command || command === lastFinalTextRef.current) return;

      const stopWords =
        /^(danke|vielen dank|danke schön|hvala|puno hvala|tschüss|tschuss|ciao|ćao|cao|bis später|bis spaeter|auf wiedersehen)$/i;

      if (stopWords.test(command)) {
        lastFinalTextRef.current = command;
        voiceModeRef.current = false;
        setVoiceMode(false);
        setRecognizedText("");
        speak("Sehr gern. Bis später.", {
          thenWake: false,
        });
        return;
      }

      lastFinalTextRef.current = command;
      stopRecognition(true);
      void send(command, true);
    }
  });

  useSpeechRecognitionEvent("nomatch", () => {
    if (!voiceModeRef.current) return;

    if (voicePhaseRef.current === "command") {
      speak("Ich habe Sie nicht verstanden. Bitte wiederholen Sie die Frage.", {
        thenListenForCommand: true,
        thenWake: false,
      });
    }
  });

  useSpeechRecognitionEvent("error", (event) => {
    const code = event.error || "unknown";

    if (code === "aborted" || intentionalAbortRef.current) {
      intentionalAbortRef.current = false;
      return;
    }

    console.warn("Speech recognition error:", code, event.message);

    if (code === "not-allowed" || code === "service-not-allowed") {
      deactivateWakeWord();
      Alert.alert(
        "Spracherkennung nicht erlaubt",
        "Bitte aktivieren Sie Mikrofon und Spracherkennung in den Android-Einstellungen."
      );
      return;
    }

    if (!voiceModeRef.current || loadingRef.current) return;

    if (
      voicePhaseRef.current === "command" &&
      (code === "no-speech" || code === "speech-timeout")
    ) {
      speak("Ich habe nichts gehört. Bitte sprechen Sie erneut.", {
        thenListenForCommand: true,
        thenWake: false,
      });
      return;
    }

    restartTimerRef.current = setTimeout(() => {
      if (voiceModeRef.current && !loadingRef.current) {
        void startWakeListening();
      }
    }, 900);
  });

  useSpeechRecognitionEvent("end", () => {
    if (
      !voiceModeRef.current ||
      loadingRef.current ||
      voicePhaseRef.current === "speaking" ||
      voicePhaseRef.current === "processing"
    ) {
      return;
    }

    if (voicePhaseRef.current === "wake") {
      clearRestartTimer();
      restartTimerRef.current = setTimeout(() => {
        if (voiceModeRef.current) void startWakeListening();
      }, RESTART_DELAY_MS);
    }
  });

  const saveSymptom = async (messageIndex: number, text: string) => {
    if (!activePatient || !text.trim()) return;

    setSavingJournal(messageIndex);

    try {
      await api(`/patients/${activePatient.id}/journal`, {
        method: "POST",
        body: {
          category: "symptom",
          text: text.trim(),
          tags: ["KI-Assistent"],
        },
      });

      setMessages((items) =>
        items.map((item, index) =>
          index === messageIndex
            ? { ...item, journal_saved: true }
            : item
        )
      );

      await loadContextOnly();

      Alert.alert(
        "Gespeichert",
        "Die Angabe wurde als Symptom im Patiententagebuch dokumentiert."
      );
    } catch {
      Alert.alert(
        "Nicht gespeichert",
        "Der Eintrag konnte nicht gespeichert werden."
      );
    } finally {
      setSavingJournal(null);
    }
  };

  const clear = async () => {
    if (!activePatient) return;

    await api(`/assistant/history?patient_id=${activePatient.id}`, {
      method: "DELETE",
    });
    setMessages([]);
  };

  const latestVital = context?.recent_vitals?.[0];
  const latestVitalText = latestVital
    ? latestVital.vital_type === "blood_pressure"
      ? `${latestVital.systolic}/${latestVital.diastolic} mmHg`
      : `${latestVital.value ?? "–"} ${latestVital.unit || ""}`.trim()
    : "Noch keine Messung";

  const voiceStatus =
    voicePhase === "wake"
      ? "Warte auf „Hallo VYLNAX“"
      : voicePhase === "command"
        ? "Ich höre zu…"
        : voicePhase === "processing"
          ? "VYLNAX denkt…"
          : voicePhase === "speaking"
            ? "VYLNAX spricht…"
            : "Sprachmodus";

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.header,
          { paddingTop: insets.top + spacing.sm },
        ]}
      >
        <View style={styles.headTitle}>
          <VLogo size={34} />
          <View>
            <Text style={styles.title}>KI Care Assistant</Text>
            <Text style={styles.sub}>
              {activePatient?.name || "Kein Patient ausgewählt"}
            </Text>
          </View>
        </View>

        <Pressable
          testID="wake-word-toggle"
          onPress={toggleVoiceMode}
          style={[
            styles.voiceChip,
            voiceMode && styles.voiceChipActive,
          ]}
        >
          {voicePhase === "processing" || voicePhase === "speaking" ? (
            <ActivityIndicator
              size="small"
              color={voiceMode ? "#fff" : colors.brandPrimary}
            />
          ) : (
            <Ionicons
              name={voiceMode ? "mic" : "mic-outline"}
              size={18}
              color={voiceMode ? "#fff" : colors.brandPrimary}
            />
          )}
          <Text
            style={[
              styles.voiceChipText,
              voiceMode && { color: "#fff" },
            ]}
          >
            {voiceMode ? voiceStatus : "Sprachmodus"}
          </Text>
        </Pressable>

        {messages.length > 0 && (
          <Pressable
            testID="clear-chat"
            onPress={clear}
            style={styles.clearBtn}
          >
            <Ionicons
              name="trash-outline"
              size={20}
              color={colors.onSurfaceTertiary}
            />
          </Pressable>
        )}
      </View>

      {voiceMode && recognizedText ? (
        <View style={styles.liveTranscript}>
          <Ionicons
            name="waveform"
            size={17}
            color={colors.brandPrimary}
          />
          <Text style={styles.liveTranscriptText} numberOfLines={2}>
            {recognizedText}
          </Text>
        </View>
      ) : null}

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={90}
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={{
            padding: spacing.lg,
            paddingBottom: spacing.xl,
          }}
        >
          {activePatient && context && (
            <View style={styles.contextCard}>
              <View style={styles.contextTitleRow}>
                <Ionicons
                  name="shield-checkmark"
                  size={18}
                  color={colors.brandPrimary}
                />
                <Text style={styles.contextTitle}>
                  Aktiver Patientenkontext
                </Text>
              </View>

              <View style={styles.contextGrid}>
                <View style={styles.contextItem}>
                  <Text style={styles.contextLabel}>
                    Letzter Vitalwert
                  </Text>
                  <Text style={styles.contextValue}>
                    {latestVitalText}
                  </Text>
                </View>

                <View style={styles.contextItem}>
                  <Text style={styles.contextLabel}>Tagebuch</Text>
                  <Text style={styles.contextValue}>
                    {context.recent_journal?.length || 0} letzte Einträge
                  </Text>
                </View>
              </View>

              <Text style={styles.habitText}>
                {context.habit_summary}
              </Text>

              <Text style={styles.contextHint}>
                Der Assistent nutzt nur dokumentierte Patientendaten und
                ersetzt keine medizinische Beurteilung.
              </Text>

              <Pressable
                onPress={() => router.push("/assistant-memory" as any)}
                style={styles.memoryLink}
              >
                <Ionicons
                  name="brain-outline"
                  size={16}
                  color={colors.brandPrimary}
                />
                <Text style={styles.memoryLinkText}>
                  Bestätigte KI-Merkpunkte verwalten
                </Text>
              </Pressable>
            </View>
          )}

          {initial ? (
            <ActivityIndicator
              color={colors.brandPrimary}
              style={{ marginTop: 40 }}
            />
          ) : messages.length === 0 ? (
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <Ionicons
                  name="sparkles"
                  size={36}
                  color={colors.brandPrimary}
                />
              </View>

              <Text style={styles.emptyTitle}>
                Wie kann ich helfen?
              </Text>

              <Text style={styles.emptyText}>
                Ich berücksichtige Therapie, Allergien, Vitalwerte,
                Tagebuch und dokumentierte Gewohnheiten des aktiven
                Patienten.
              </Text>

              <View
                style={{
                  marginTop: spacing.lg,
                  gap: spacing.sm,
                  width: "100%",
                }}
              >
                {SUGGESTIONS.map((suggestion) => (
                  <Pressable
                    key={suggestion}
                    onPress={() => send(suggestion)}
                    style={styles.suggestion}
                  >
                    <Ionicons
                      name="chatbubble-ellipses-outline"
                      size={18}
                      color={colors.brandPrimary}
                    />
                    <Text style={styles.suggestionText}>
                      {suggestion}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Text style={styles.disclaimer}>
                Hinweis: Keine Diagnose, keine Änderung einer
                verordneten Therapie.
              </Text>
            </View>
          ) : (
            messages.map((message, index) => (
              <View
                key={index}
                style={[
                  styles.bubbleRow,
                  message.role === "user"
                    ? styles.rowUser
                    : styles.rowBot,
                ]}
              >
                {message.role === "assistant" && (
                  <View style={styles.botAvatar}>
                    <Ionicons
                      name="sparkles"
                      size={14}
                      color="#fff"
                    />
                  </View>
                )}

                <View style={{ maxWidth: "84%" }}>
                  <View
                    style={[
                      styles.bubble,
                      message.role === "user"
                        ? styles.userBubble
                        : styles.botBubble,
                    ]}
                  >
                    <Text
                      style={[
                        styles.bubbleText,
                        message.role === "user" && { color: "#fff" },
                      ]}
                    >
                      {message.content}
                    </Text>
                  </View>

                  {message.role === "assistant" &&
                    message.suggest_journal &&
                    message.source_text && (
                      <Pressable
                        onPress={() =>
                          saveSymptom(
                            index,
                            message.source_text || ""
                          )
                        }
                        disabled={
                          message.journal_saved ||
                          savingJournal === index
                        }
                        style={[
                          styles.saveJournal,
                          message.journal_saved &&
                            styles.saveJournalDone,
                        ]}
                      >
                        {savingJournal === index ? (
                          <ActivityIndicator
                            size="small"
                            color={colors.brandPrimary}
                          />
                        ) : (
                          <Ionicons
                            name={
                              message.journal_saved
                                ? "checkmark-circle"
                                : "document-text-outline"
                            }
                            size={16}
                            color={
                              message.journal_saved
                                ? colors.success
                                : colors.brandPrimary
                            }
                          />
                        )}

                        <Text
                          style={[
                            styles.saveJournalText,
                            message.journal_saved && {
                              color: colors.success,
                            },
                          ]}
                        >
                          {message.journal_saved
                            ? "Im Tagebuch gespeichert"
                            : "Als Symptom dokumentieren"}
                        </Text>
                      </Pressable>
                    )}
                </View>
              </View>
            ))
          )}

          {loading && (
            <View style={[styles.bubbleRow, styles.rowBot]}>
              <View style={styles.botAvatar}>
                <Ionicons
                  name="sparkles"
                  size={14}
                  color="#fff"
                />
              </View>
              <View style={[styles.bubble, styles.botBubble]}>
                <ActivityIndicator
                  color={colors.brandPrimary}
                  size="small"
                />
              </View>
            </View>
          )}
        </ScrollView>

        <View
          style={[
            styles.inputBar,
            { paddingBottom: insets.bottom + spacing.sm },
          ]}
        >
          <Pressable
            testID="voice-listen"
            onPress={manualVoiceStart}
            disabled={!activePatient}
            style={[
              styles.micBtn,
              voicePhase === "command" && styles.micBtnActive,
              !activePatient && { opacity: 0.45 },
            ]}
          >
            {voicePhase === "command" ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Ionicons
                name="mic"
                size={22}
                color={colors.brandPrimary}
              />
            )}
          </Pressable>

          <TextInput
            testID="chat-input"
            value={input}
            onChangeText={setInput}
            placeholder={
              activePatient
                ? "Nachricht schreiben…"
                : "Zuerst Patient auswählen"
            }
            placeholderTextColor={colors.borderStrong}
            style={styles.input}
            multiline
            editable={!!activePatient}
            onSubmitEditing={() => send(input)}
          />

          <Pressable
            testID="send-message"
            onPress={() => send(input)}
            disabled={!input.trim() || loading || !activePatient}
            style={[
              styles.sendBtn,
              (!input.trim() || loading || !activePatient) && {
                opacity: 0.5,
              },
            ]}
          >
            <Ionicons
              name="arrow-up"
              size={22}
              color="#fff"
            />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surfaceSecondary,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headTitle: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.onSurface,
  },
  sub: {
    fontSize: 12,
    color: colors.onSurfaceTertiary,
  },
  clearBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  voiceChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderWidth: 1,
    borderColor: colors.brandPrimary,
    borderRadius: 18,
    paddingHorizontal: 9,
    minHeight: 36,
    maxWidth: 150,
  },
  voiceChipActive: {
    backgroundColor: colors.brandPrimary,
  },
  voiceChipText: {
    fontSize: 10,
    fontWeight: "700",
    color: colors.brandPrimary,
    flexShrink: 1,
  },
  liveTranscript: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  liveTranscriptText: {
    flex: 1,
    color: colors.onSurfaceSecondary,
    fontSize: 13,
    fontWeight: "600",
  },
  micBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.brandPrimary,
    alignItems: "center",
    justifyContent: "center",
  },
  micBtnActive: {
    backgroundColor: colors.brandPrimary,
  },
  contextCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  contextTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  contextTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.onSurface,
  },
  contextGrid: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  contextItem: {
    flex: 1,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    padding: spacing.sm,
  },
  contextLabel: {
    fontSize: 10,
    color: colors.onSurfaceTertiary,
    textTransform: "uppercase",
    fontWeight: "700",
  },
  contextValue: {
    fontSize: 13,
    color: colors.onSurface,
    fontWeight: "700",
    marginTop: 3,
  },
  habitText: {
    fontSize: 12,
    color: colors.onSurfaceSecondary,
    marginTop: spacing.sm,
  },
  contextHint: {
    fontSize: 10,
    color: colors.onSurfaceTertiary,
    marginTop: spacing.xs,
  },
  memoryLink: {
    marginTop: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
  },
  memoryLinkText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.brandPrimary,
  },
  empty: {
    alignItems: "center",
    marginTop: spacing.lg,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.brandSecondary,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: colors.onSurface,
    marginTop: spacing.lg,
  },
  emptyText: {
    fontSize: 14,
    color: colors.onSurfaceSecondary,
    textAlign: "center",
    marginTop: spacing.xs,
    lineHeight: 20,
  },
  suggestion: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  suggestionText: {
    flex: 1,
    color: colors.onSurface,
    fontSize: 14,
    fontWeight: "500",
  },
  disclaimer: {
    fontSize: 11,
    color: colors.onSurfaceTertiary,
    marginTop: spacing.lg,
    textAlign: "center",
  },
  bubbleRow: {
    flexDirection: "row",
    marginBottom: spacing.md,
    alignItems: "flex-end",
    gap: 6,
  },
  rowUser: {
    justifyContent: "flex-end",
  },
  rowBot: {
    justifyContent: "flex-start",
  },
  botAvatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.brandPrimary,
    alignItems: "center",
    justifyContent: "center",
  },
  bubble: {
    padding: spacing.md,
    borderRadius: radius.lg,
  },
  userBubble: {
    backgroundColor: colors.brandPrimary,
    borderBottomRightRadius: 4,
  },
  botBubble: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderBottomLeftRadius: 4,
  },
  bubbleText: {
    fontSize: 15,
    lineHeight: 21,
    color: colors.onSurface,
  },
  saveJournal: {
    marginTop: 6,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  saveJournalDone: {
    borderColor: colors.success,
  },
  saveJournalText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.brandPrimary,
  },
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  input: {
    flex: 1,
    maxHeight: 120,
    minHeight: 48,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingTop: 12,
    fontSize: 15,
    color: colors.onSurface,
  },
  sendBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.brandPrimary,
    alignItems: "center",
    justifyContent: "center",
  },
});