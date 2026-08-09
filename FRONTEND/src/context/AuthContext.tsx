import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";

import {
  api,
  getToken,
  setToken,
  clearToken,
  setAccessToken,
  clearAccessToken,
  getAccessToken,
} from "@/src/api";

type User = {
  user_id: string;
  email: string;
  name: string;
  picture?: string;
  role: string;
};

export type AccessUser = {
  id: string;
  name: string;
  role: "patient" | "relative" | "caregiver" | "doctor";
  patient_id?: string | null;
  permissions?: Record<string, boolean>;
};

type AuthState = {
  user: User | null;
  accessUser: AccessUser | null;
  accessUsers: AccessUser[];
  loading: boolean;
  signingIn: boolean;

  login: () => Promise<void>;
  loginWithPin: (profile: AccessUser, pin: string) => Promise<void>;
  logout: () => Promise<void>;
  lock: () => Promise<void>;
  refreshAccessUsers: () => Promise<void>;
  setRole: (role: string) => Promise<void>;
  refresh: () => Promise<void>;
  canEditMedications: boolean;
};

const AuthContext = createContext<AuthState>({} as AuthState);

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, setUser] = useState<User | null>(null);
  const [accessUser, setAccessUser] = useState<AccessUser | null>(null);
  const [accessUsers, setAccessUsers] = useState<AccessUser[]>([]);

  const [loading, setLoading] = useState(true);
  const [signingIn, setSigningIn] = useState(false);

  /*
   * VAŽNA ISPRAVKA:
   * Ne provjeravamo više "if (!user) return".
   * Ako token postoji, profili se mogu odmah učitati.
   */
  const refreshAccessUsers = useCallback(async () => {
    try {
      const response = await api<any>("/access-users");

      /*
       * Podržava oba moguća backend odgovora:
       * 1. Direktan niz: [...]
       * 2. Objekat: { access_users: [...] }
       */
      const profiles: AccessUser[] = Array.isArray(response)
        ? response
        : Array.isArray(response?.access_users)
          ? response.access_users
          : Array.isArray(response?.users)
            ? response.users
            : [];

      console.log(
        "VYLNAX access users:",
        JSON.stringify(profiles, null, 2)
      );

      setAccessUsers(profiles);
    } catch (error) {
      console.warn("Access users konnten nicht geladen werden:", error);
      setAccessUsers([]);
      throw error;
    }
  }, []);

  const login = useCallback(async () => {
    setSigningIn(true);

    try {
      const data = await api<{
        session_token: string;
        user: User;
      }>("/auth/session", {
        method: "POST",
        auth: false,
        body: {
          session_token: "local-dev",
        },
      });

      await setToken(data.session_token);
      setUser(data.user);

      /*
       * Profile odmah učitavamo nakon prijave.
       */
      await refreshAccessUsers();
    } finally {
      setSigningIn(false);
    }
  }, [refreshAccessUsers]);

  const check = useCallback(async () => {
    const token = await getToken();

    if (!token) {
      setUser(null);
      setAccessUsers([]);
      return;
    }

    try {
      const me = await api<User>("/auth/me");
      setUser(me);

      /*
       * Profile učitavamo odmah nakon provjere sesije.
       */
      await refreshAccessUsers();

      const accessToken = await getAccessToken();

      if (accessToken) {
        try {
          const accessData = await api<any>("/access/me", {
            access: true,
          });

          setAccessUser(accessData.access_user);
        } catch {
          await clearAccessToken();
          setAccessUser(null);
        }
      }
    } catch (error) {
      console.warn("Session konnte nicht geladen werden:", error);

      await clearToken();
      await clearAccessToken();

      setUser(null);
      setAccessUser(null);
      setAccessUsers([]);
    }
  }, [refreshAccessUsers]);

  useEffect(() => {
    check().finally(() => setLoading(false));
  }, [check]);

  /*
   * Dodatna sigurnost:
   * Kada se user promijeni, ponovo učitaj profile.
   */
  useEffect(() => {
    if (user) {
      refreshAccessUsers().catch((error) => {
        console.warn("Profil-Aktualisierung fehlgeschlagen:", error);
      });
    } else {
      setAccessUsers([]);
    }
  }, [user, refreshAccessUsers]);

  const loginWithPin = useCallback(
    async (profile: AccessUser, pin: string) => {
      const data = await api<any>("/access/login", {
        method: "POST",
        body: {
          access_user_id: profile.id,
          pin,
          patient_id: profile.patient_id || undefined,
        },
      });

      await setAccessToken(data.access_token);
      setAccessUser(data.access_user);
    },
    []
  );

  const lock = useCallback(async () => {
    try {
      await api("/access/logout", {
        method: "POST",
        access: true,
      });
    } catch {
      // Lokalno zaključavanje mora raditi i ako server nije dostupan.
    }

    await clearAccessToken();
    setAccessUser(null);
  }, []);

  const logout = useCallback(async () => {
    await lock();

    try {
      await api("/auth/logout", {
        method: "POST",
      });
    } catch {
      // Lokalna odjava se ipak izvršava.
    }

    await clearToken();

    setUser(null);
    setAccessUser(null);
    setAccessUsers([]);
  }, [lock]);

  const setRole = useCallback(async (role: string) => {
    await api("/auth/role", {
      method: "PUT",
      body: {
        role,
      },
    });

    setUser((currentUser) =>
      currentUser
        ? {
            ...currentUser,
            role,
          }
        : currentUser
    );
  }, []);

  const canEditMedications =
    accessUser?.role === "caregiver" ||
    accessUser?.role === "doctor";

  return (
    <AuthContext.Provider
      value={{
        user,
        accessUser,
        accessUsers,
        loading,
        signingIn,
        login,
        loginWithPin,
        logout,
        lock,
        refreshAccessUsers,
        setRole,
        refresh: check,
        canEditMedications,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
