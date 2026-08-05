import { storage } from "@/src/utils/storage";

const BASE = (process.env.EXPO_PUBLIC_BACKEND_URL || "").replace(/\/$/, "");
const TOKEN_KEY = "vylnax_session_token";
const ACCESS_TOKEN_KEY = "vylnax_access_token";
const REQUEST_TIMEOUT_MS = 8000;

export async function getToken() { return (await storage.secureGet(TOKEN_KEY, "")) || null; }
export async function setToken(token: string) { await storage.secureSet(TOKEN_KEY, token); }
export async function clearToken() { await storage.secureRemove(TOKEN_KEY); }
export async function getAccessToken() { return (await storage.secureGet(ACCESS_TOKEN_KEY, "")) || null; }
export async function setAccessToken(token: string) { await storage.secureSet(ACCESS_TOKEN_KEY, token); }
export async function clearAccessToken() { await storage.secureRemove(ACCESS_TOKEN_KEY); }

export async function api<T = any>(
  path: string,
  options: { method?: string; body?: any; auth?: boolean; access?: boolean; timeoutMs?: number } = {}
): Promise<T> {
  if (!BASE) throw new Error("BACKEND_URL_MISSING");
  const { method = "GET", body, auth = true, access = false, timeoutMs = REQUEST_TIMEOUT_MS } = options;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (auth) {
    const token = await getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  if (access) {
    const accessToken = await getAccessToken();
    if (accessToken) headers["X-Access-Token"] = accessToken;
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${BASE}/api${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined, signal: controller.signal });
    if (!res.ok) {
      const text = await res.text();
      if (res.status === 401 && !access) await clearToken();
      throw new Error(text || `Request failed: ${res.status}`);
    }
    if (res.status === 204) return {} as T;
    return res.json();
  } catch (error: any) {
    if (error?.name === "AbortError") throw new Error("BACKEND_TIMEOUT");
    throw error;
  } finally { clearTimeout(timer); }
}

export function todayStr(d: Date = new Date()): string {
  const y = d.getFullYear(); const m = String(d.getMonth() + 1).padStart(2, "0"); const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
