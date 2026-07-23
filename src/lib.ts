import { useEffect, useState } from "react";
import { api } from "./api";
import type { Filters } from "./store";

export const ESTADOS = ["pendiente", "en_progreso", "en_revision", "aprobado", "entregado", "publicado", "bloqueado"] as const;
export type Estado = (typeof ESTADOS)[number];

export const ESTADO_META: Record<string, { label: string; color: string; emoji: string }> = {
  pendiente: { label: "Pendiente", color: "var(--st-pendiente)", emoji: "○" },
  en_progreso: { label: "En progreso", color: "var(--st-en_progreso)", emoji: "◐" },
  en_revision: { label: "En revisión", color: "var(--st-en_revision)", emoji: "◕" },
  aprobado: { label: "Aprobado", color: "var(--st-aprobado)", emoji: "✓" },
  entregado: { label: "Entregado", color: "var(--st-entregado)", emoji: "✔" },
  publicado: { label: "Publicado", color: "var(--st-publicado)", emoji: "🚀" },
  bloqueado: { label: "Bloqueado", color: "var(--st-bloqueado)", emoji: "⛔" },
};
export const estadoColor = (e: string) => ESTADO_META[e]?.color ?? "var(--text-3)";
export const estadoLabel = (e: string) => ESTADO_META[e]?.label ?? e;

export const ALERTA_LABEL: Record<string, string> = {
  bloqueada: "Bloqueada",
  sin_movimiento: "Sin movimiento",
  revision: "En revisión",
};

/** Hook de fetch que refresca cuando cambian los filtros o el path. */
export function useApi<T = any>(path: string | null, filters?: Partial<Filters>) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const dep = JSON.stringify(filters ?? {});

  useEffect(() => {
    if (!path) return;
    let alive = true;
    setLoading(true);
    setError(null);
    api<T>(path, filters)
      .then((d) => alive && setData(d))
      .catch((e) => alive && setError(String(e)))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, dep]);

  return { data, loading, error };
}

export const nfmt = (n: number | null | undefined) =>
  n == null ? "—" : new Intl.NumberFormat("es-CL").format(n);

export const pct = (n: number) => `${Math.round(n)}%`;
