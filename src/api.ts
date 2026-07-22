import type { Filters } from "./store";

const KEY = "o3_dashboard_key";

export function authHeader(): Record<string, string> {
  const k = localStorage.getItem(KEY);
  return k ? { "x-dashboard-key": k } : {};
}
export const setKey = (k: string) => localStorage.setItem(KEY, k);

export function filtersToQuery(f: Partial<Filters>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(f)) if (v) p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : "";
}

export async function api<T = any>(path: string, filters?: Partial<Filters>): Promise<T> {
  // `path` ya incluye el prefijo /api (ej. "/api/summary").
  const res = await fetch(`${path}${filters ? filtersToQuery(filters) : ""}`, {
    headers: { ...authHeader() },
  });
  if (!res.ok) throw new Error(`API ${path} → ${res.status}`);
  return res.json();
}

export async function login(password: string): Promise<boolean> {
  const res = await fetch("/api/auth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
  if (res.ok) {
    setKey(password);
    return true;
  }
  return false;
}
