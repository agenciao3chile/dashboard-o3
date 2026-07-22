/** Parseo y construcción de los filtros globales del dashboard. */

export interface Filters {
  desde?: string;
  hasta?: string;
  persona?: string;
  area?: string;
  cliente?: string;
  proyecto?: string;
  estado?: string;
}

/** Expresión canónica de cliente (agrupa vacíos como "(sin cliente)"). */
export const CLIENTE_EXPR = `coalesce(nullif(btrim(cliente), ''), '(sin cliente)')`;
export const clienteExprFor = (alias: string) =>
  `coalesce(nullif(btrim(${alias}.cliente), ''), '(sin cliente)')`;

export function parseFilters(q: Record<string, any>): Filters {
  const s = (v: any) => (typeof v === "string" && v.trim() !== "" ? v.trim() : undefined);
  return {
    desde: s(q.desde),
    hasta: s(q.hasta),
    persona: s(q.persona),
    area: s(q.area),
    cliente: s(q.cliente),
    proyecto: s(q.proyecto),
    estado: s(q.estado),
  };
}

type Key = "persona" | "area" | "cliente" | "proyecto" | "estado" | "fecha";

/**
 * Construye el WHERE a partir de los filtros. `map` indica qué expresión SQL
 * usar para cada filtro aplicable (los que no estén en `map` se ignoran).
 */
export function buildWhere(
  f: Filters,
  map: Partial<Record<Key, string>>,
  start = 1
): { where: string; and: string; params: any[]; next: number } {
  const cond: string[] = [];
  const params: any[] = [];
  let i = start;
  const eq = (expr: string, val: any) => {
    cond.push(`${expr} = $${i++}`);
    params.push(val);
  };
  if (map.persona && f.persona) eq(map.persona, f.persona);
  if (map.area && f.area) eq(map.area, f.area);
  if (map.cliente && f.cliente) eq(map.cliente, f.cliente);
  if (map.proyecto && f.proyecto) eq(map.proyecto, f.proyecto);
  if (map.estado && f.estado) eq(map.estado, f.estado);
  if (map.fecha && f.desde) {
    cond.push(`${map.fecha} >= $${i++}::date`);
    params.push(f.desde);
  }
  if (map.fecha && f.hasta) {
    cond.push(`${map.fecha} < ($${i++}::date + 1)`);
    params.push(f.hasta);
  }
  return {
    where: cond.length ? `WHERE ${cond.join(" AND ")}` : "",
    and: cond.length ? `AND ${cond.join(" AND ")}` : "",
    params,
    next: i,
  };
}
