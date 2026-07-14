import { storage } from "@/src/utils/storage";

const BASE = (process.env.EXPO_PUBLIC_BACKEND_URL || "").replace(/\/$/, "");
const TOKEN_KEY = "vylnax_session_token";
const REQUEST_TIMEOUT_MS = 8000;

export async function getToken(): Promise<string | null> {
  return (await storage.secureGet(TOKEN_KEY, "")) || null;
}

export async function setToken(token: string) {
  await storage.secureSet(TOKEN_KEY, token);
}

export async function clearToken() {
  await storage.secureRemove(TOKEN_KEY);
}

export async function api<T = any>(
  path: string,
  options: { method?: string; body?: any; auth?: boolean; timeoutMs?: number } = {}
): Promise<T> {
  if (!BASE) {
    throw new Error("BACKEND_URL_MISSING");
  }

  const { method = "GET", body, auth = true, timeoutMs = REQUEST_TIMEOUT_MS } = options;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (auth) {
    const token = await getToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${BASE}/api${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    if (res.status === 401) {
      await clearToken();
      throw new Error("UNAUTHORIZED");
    }
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || `Request failed: ${res.status}`);
    }
    if (res.status === 204) return {} as T;
    return res.json();
  } catch (error: any) {
    if (error?.name === "AbortError") {
      throw new Error("BACKEND_TIMEOUT");
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export function todayStr(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
