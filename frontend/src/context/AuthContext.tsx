import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { Alert, Platform } from "react-native";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import { api, getToken, setToken, clearToken } from "@/src/api";

WebBrowser.maybeCompleteAuthSession();

type User = {
  user_id: string;
  email: string;
  name: string;
  picture?: string;
  role: string;
};

type AuthState = {
  user: User | null;
  loading: boolean;
  signingIn: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  setRole: (role: string) => Promise<void>;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthState>({} as AuthState);
export const useAuth = () => useContext(AuthContext);

function parseSessionId(url: string): string | null {
  if (!url) return null;
  const hashMatch = url.match(/[#&]session_id=([^&]+)/);
  if (hashMatch) return decodeURIComponent(hashMatch[1]);
  const queryMatch = url.match(/[?&]session_id=([^&]+)/);
  if (queryMatch) return decodeURIComponent(queryMatch[1]);
  return null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [signingIn, setSigningIn] = useState(false);

  const processSessionId = useCallback(async (sessionId: string) => {
    const data = await api<{ session_token: string; user: User }>("/auth/session", {
      method: "POST",
      auth: false,
      body: { session_token: sessionId },
    });
    await setToken(data.session_token);
    setUser(data.user);
  }, []);

  const checkExisting = useCallback(async () => {
    try {
      const token = await getToken();
      if (!token) {
        setUser(null);
        return;
      }
      const me = await api<User>("/auth/me");
      setUser(me);
    } catch {
      await clearToken();
      setUser(null);
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        if (Platform.OS === "web") {
          const sid = parseSessionId(window.location.hash) || parseSessionId(window.location.search);
          if (sid) {
            await processSessionId(sid);
            window.history.replaceState(null, "", window.location.pathname);
            return;
          }
        } else {
          const initialUrl = await Linking.getInitialURL();
          const sid = initialUrl ? parseSessionId(initialUrl) : null;
          if (sid) {
            await processSessionId(sid);
            return;
          }
        }
        await checkExisting();
      } finally {
        setLoading(false);
      }
    })();
  }, [processSessionId, checkExisting]);

  const login = useCallback(async () => {
    if (signingIn) return;
    setSigningIn(true);
    try {
      // Local Windows/dev mode: no Emergent OAuth needed.
      await processSessionId("local-dev");
    } catch (error: any) {
      const message = error?.message === "BACKEND_TIMEOUT"
        ? "Der VYLNAX-Server ist nicht erreichbar. Prüfen Sie, ob START_VYLNAX.bat läuft und Telefon sowie Laptop im selben WLAN sind."
        : "Anmeldung fehlgeschlagen. Der VYLNAX-Server konnte nicht erreicht werden.";
      Alert.alert("Verbindung fehlgeschlagen", message);
    } finally {
      setSigningIn(false);
    }
  }, [processSessionId, signingIn]);

  const logout = useCallback(async () => {
    try {
      await api("/auth/logout", { method: "POST" });
    } catch {}
    await clearToken();
    setUser(null);
  }, []);

  const setRole = useCallback(async (role: string) => {
    await api("/auth/role", { method: "PUT", body: { role } });
    setUser((u) => (u ? { ...u, role } : u));
  }, []);

  const refresh = useCallback(async () => {
    await checkExisting();
  }, [checkExisting]);

  return (
    <AuthContext.Provider value={{ user, loading, signingIn, login, logout, setRole, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}
