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
  loginWithPin: (
    profile: AccessUser,
    pin: string
  ) => Promise<void>;

  logout: () => Promise<void>;
  lock: () => Promise<void>;

  refreshAccessUsers: () => Promise<void>;
  setRole: (role: string) => Promise<void>;
  refresh: () => Promise<void>;

  // AKTIVNA ULOGA
  isPatient: boolean;
  isRelative: boolean;
  isCaregiver: boolean;
  isDoctor: boolean;

  // OVLASTENJA
  canEdit: boolean;
  canAddPatients: boolean;
  canEditPatients: boolean;
  canEditMedications: boolean;
  canEditWounds: boolean;
};

const AuthContext = createContext({} as AuthState);

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, setUser] = useState<User | null>(null);

  const [accessUser, setAccessUser] =
    useState<AccessUser | null>(null);

  const [accessUsers, setAccessUsers] =
    useState<AccessUser[]>([]);

  const [loading, setLoading] = useState(true);
  const [signingIn, setSigningIn] = useState(false);

  /*
   * Učitavanje svih PIN profila.
   */
  const refreshAccessUsers = useCallback(async () => {
    try {
      const response = await api("/access-users");

      const profiles: AccessUser[] = Array.isArray(response)
        ? response
        : Array.isArray(response?.access_users)
        ? response.access_users
        : Array.isArray(response?.users)
        ? response.users
        : [];

      console.log(
        "VYLNAX ACCESS USERS:",
        JSON.stringify(profiles, null, 2)
      );

      setAccessUsers(profiles);
    } catch (error) {
      console.warn(
        "Access users konnten nicht geladen werden:",
        error
      );

      setAccessUsers([]);

      throw error;
    }
  }, []);

  /*
   * Glavna session prijava.
   */
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

      await refreshAccessUsers();
    } finally {
      setSigningIn(false);
    }
  }, [refreshAccessUsers]);

  /*
   * Provjera postojeće sesije.
   */
  const check = useCallback(async () => {
    const token = await getToken();

    if (!token) {
      setUser(null);
      setAccessUser(null);
      setAccessUsers([]);
      return;
    }

    try {
      const me = await api<User>("/auth/me");

      setUser(me);

      await refreshAccessUsers();

      const accessToken = await getAccessToken();

      if (accessToken) {
        try {
          const accessData = await api<any>(
            "/access/me",
            {
              access: true,
            }
          );

          if (accessData?.access_user) {
            console.log(
              "VYLNAX RESTORED ACCESS USER:",
              JSON.stringify(
                accessData.access_user,
                null,
                2
              )
            );

            setAccessUser(accessData.access_user);
          } else {
            await clearAccessToken();
            setAccessUser(null);
          }
        } catch (error) {
          console.warn(
            "Access session konnte nicht geladen werden:",
            error
          );

          await clearAccessToken();

          setAccessUser(null);
        }
      } else {
        setAccessUser(null);
      }
    } catch (error) {
      console.warn(
        "Session konnte nicht geladen werden:",
        error
      );

      await clearToken();
      await clearAccessToken();

      setUser(null);
      setAccessUser(null);
      setAccessUsers([]);
    }
  }, [refreshAccessUsers]);

  /*
   * Start aplikacije.
   */
  useEffect(() => {
    check().finally(() => {
      setLoading(false);
    });
  }, [check]);

  /*
   * Kada se glavni user promijeni,
   * ponovo učitaj PIN profile.
   */
  useEffect(() => {
    if (user) {
      refreshAccessUsers().catch((error) => {
        console.warn(
          "Profil-Aktualisierung fehlgeschlagen:",
          error
        );
      });
    } else {
      setAccessUsers([]);
    }
  }, [user, refreshAccessUsers]);

  /*
   * PIN LOGIN
   *
   * VAŽNO:
   *
   * patient   = Patient
   * relative  = Angehörige
   * caregiver = Pflegekraft / PFK
   * doctor    = Arzt
   */
  const loginWithPin = useCallback(
    async (
      profile: AccessUser,
      pin: string
    ) => {
      const data = await api("/access/login", {
        method: "POST",

        body: {
          access_user_id: profile.id,
          pin,
          patient_id:
            profile.patient_id || undefined,
        },
      });

      if (!data?.access_token) {
        throw new Error(
          "Kein Access-Token vom Server erhalten."
        );
      }

      if (!data?.access_user) {
        throw new Error(
          "Kein Access-Benutzer vom Server erhalten."
        );
      }

      await setAccessToken(
        data.access_token
      );

      /*
       * OVO JE JEDINI IZVOR AKTIVNE PIN ULOGE.
       */
      setAccessUser(
        data.access_user
      );

      console.log(
        "VYLNAX ACTIVE ACCESS USER:",
        JSON.stringify(
          data.access_user,
          null,
          2
        )
      );
    },
    []
  );

  /*
   * Zaključavanje PIN sesije.
   */
  const lock = useCallback(async () => {
    try {
      await api("/access/logout", {
        method: "POST",
        access: true,
      });
    } catch {
      /*
       * Lokalno zaključavanje mora raditi
       * čak i ako backend nije dostupan.
       */
    }

    await clearAccessToken();

    setAccessUser(null);
  }, []);

  /*
   * Potpuna odjava.
   */
  const logout = useCallback(async () => {
    await lock();

    try {
      await api("/auth/logout", {
        method: "POST",
      });
    } catch {
      /*
       * Lokalna odjava se ipak izvršava.
       */
    }

    await clearToken();
    await clearAccessToken();

    setUser(null);
    setAccessUser(null);
    setAccessUsers([]);
  }, [lock]);

  /*
   * Legacy role funkcija.
   *
   * VAŽNO:
   * PIN prava NE određujemo preko user.role.
   *
   * Za PIN prava uvijek koristimo:
   *
   * accessUser.role
   */
  const setRole = useCallback(
    async (role: string) => {
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
    },
    []
  );

  /*
   * =====================================================
   * CENTRALNA PROVJERA ULOGA
   * =====================================================
   */

  const isPatient =
    accessUser?.role === "patient";

  const isRelative =
    accessUser?.role === "relative";

  /*
   * caregiver = Pflegekraft / PFK
   */
  const isCaregiver =
    accessUser?.role === "caregiver";

  const isDoctor =
    accessUser?.role === "doctor";

  /*
   * =====================================================
   * CENTRALNA OVLASTENJA
   * =====================================================
   */

  /*
   * Opće uređivanje:
   *
   * Pflegekraft + Arzt
   */
  const canEdit =
    isCaregiver || isDoctor;

  /*
   * NOVOG PACIJENTA MOŽE DODATI PFK.
   */
  const canAddPatients =
    isCaregiver;

  /*
   * Pacijenta mogu uređivati:
   *
   * Pflegekraft
   * Arzt
   */
  const canEditPatients =
    isCaregiver || isDoctor;

  /*
   * Lijekove mogu uređivati:
   *
   * Pflegekraft
   * Arzt
   */
  const canEditMedications =
    isCaregiver || isDoctor;

  /*
   * Wunddokumentation mogu uređivati:
   *
   * Pflegekraft
   * Arzt
   */
  const canEditWounds =
    isCaregiver || isDoctor;

  /*
   * DEBUG
   *
   * Ovdje ćemo odmah vidjeti
   * koju ulogu aplikacija stvarno koristi.
   */
  useEffect(() => {
    console.log(
      "VYLNAX ROLE CHECK:",
      {
        role: accessUser?.role,
        name: accessUser?.name,
        isPatient,
        isRelative,
        isCaregiver,
        isDoctor,
        canEdit,
        canAddPatients,
        canEditPatients,
        canEditMedications,
        canEditWounds,
      }
    );
  }, [
    accessUser,
    isPatient,
    isRelative,
    isCaregiver,
    isDoctor,
    canEdit,
    canAddPatients,
    canEditPatients,
    canEditMedications,
    canEditWounds,
  ]);

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

        isPatient,
        isRelative,
        isCaregiver,
        isDoctor,

        canEdit,
        canAddPatients,
        canEditPatients,
        canEditMedications,
        canEditWounds,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}