# VYLNAX PRO — Product Requirements Document

## Original Problem Statement
Moderne MedTech-App "VYLNAX PRO" für intelligente Medikamenteneinnahme. Unterstützt Patienten, Angehörige und Pflegekräfte. Design: medizinisches Blau/Weiß/Dunkelblau. Tagline: "Ihre sichere Medikamentenversorgung – jederzeit und überall." Ziel (erweitert): kommerzielle MedTech-Plattform in Apple-Qualität für Krankenhäuser, Pflegeheime und häusliche Pflege.

## Architecture
- **Frontend:** Expo Router (React Native), file-based routing, react-native-svg + gifted-charts, expo-print/sharing (PDF), expo-image, expo-linear-gradient, expo-haptics.
- **Backend:** FastAPI + Motor (MongoDB), UUID string ids (no ObjectId exposure), `/api` prefix.
- **Auth:** Emergent-managed Google OAuth, bearer session tokens (7d), stored in expo-secure-store.
- **AI:** emergentintegrations LlmChat, model `anthropic/claude-sonnet-4-6` via EMERGENT_LLM_KEY.

## User Personas
- **Patient:in** – eigene Medikamente, Einnahme bestätigen, KI-Hilfe, SOS.
- **Angehörige:r** – Übersicht mehrerer betreuter Personen, Adhärenz.
- **Pflegekraft** – Verwaltung mehrerer Patienten, Berichte.

## Core Requirements (static)
Medikamentenplan, Einnahmezeiten, In-App-Erinnerungen/Status, Einnahme bestätigen, Warnung bei vergessener Einnahme, Angehörigen-Übersicht, Pflegekraft-Rolle, Patienten/Medikamente hinzufügen, Tages-/Wochen-/Monatsberichte, SOS, VYLNAX PRO Gerät + Band (simuliert).

## Implemented
### Iteration 1 (2026-07-05)
- Google-Login (Splash + Login-Screen), Auth-Context, Session-Handling.
- Bottom-Tabs, Rollenwechsel (Patient/Angehörige/Pflegekraft).
- Dashboard (nächste Einnahme, Bestätigung, Tagesstatus-Ring), Medikamentenplan (Wochenleiste + Timeline), Berichte (Adhärenz-Ring + Wochen-Balken + PDF-Export), Geräte-Status (simuliert), Profil (Personen verwalten, hinzufügen/löschen, Adhärenz-Übersicht), SOS-Screen.
- Backend: patients/medications CRUD, computed schedule, intake upsert, reports, device, sos. **23/23 API-Tests grün.**

### Iteration 2 (2026-07-05)
- **AI Medication Assistant** — Chat-Tab, kontextbewusst (kennt Medikamente des aktiven Patienten), multi-turn Verlauf, Vorschläge, Verlauf löschen. Backend `/api/assistant/chat|history`.
- **Medikamenten-Datenbank** — kuratierte Suche (`/api/med-database`), integriert in "Medikament hinzufügen" (Auto-Ausfüllen).
- **Gerätekopplung** — `/pairing` Screen mit QR / Bluetooth / WLAN (simulierter Scan→Verbinden→Erfolg Flow). Gerät als Stack-Screen `/device` mit Dashboard-Schnellzugriff.

## Backlog (prioritized)
### P0 — high commercial value
- **Multi-language (DE / EN / BS)** — i18n context + Sprachumschalter in Einstellungen.
- **Dark Mode / Light Mode** — ThemeProvider, alle Screens auf dynamische Tokens umstellen.
- **Einstellungen-Screen** (Sprache, Theme, Benachrichtigungen).

### P1 — role & org dashboards
- Dedizierte Dashboards: Arzt, Krankenhaus, Pflegeheim, Admin-Panel (Organisations-/Nutzerverwaltung).
- Inventory Management (Bestand pro Medikament, Nachbestell-Warnung).

### P2 — platform
- Echte Bluetooth/WiFi-Kopplung + QR-Kamera (erfordert Dev-Build, nicht in Expo Go).
- Cloud-Synchronisation / Mehrgeräte-Sync, erweiterte Analytics.

## Notes / Mocked
- Geräte-Metriken (Dispenser/Band) und Kopplungs-Flow sind SIMULIERT (kein echtes Bluetooth/WiFi/QR im Preview).
- Erinnerungen sind IN-APP (keine Push) — auf Wunsch später Emergent Push nach Deploy.

## Test Accounts
Siehe `/app/memory/test_credentials.md` (Google OAuth, keine Passwörter).
