import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell,
  ComposedChart, Line, Legend,
} from "recharts";
import { useStore } from "../store";
import { useApi, ESTADOS, estadoColor, estadoLabel, nfmt } from "../lib";
import { Card, CardHead, Kpi, Loading, EmptyState } from "../components/ui";

interface Summary {
  abiertas: number; terminadas_periodo: number; en_revision: number;
  bloqueadas: number; sin_movimiento: number;
  participacion: { reportaron: number; total: number };
}
interface Alert { key: string; label: string; value: number | string; severity: string; filter: Record<string, string>; }
interface Insight { texto: string; tono: "alerta" | "info" | "positivo"; accion: string; }

// Tooltip oscuro para Recharts (por defecto viene blanco).
const TT = {
  contentStyle: { background: "var(--surface-2)", border: "1px solid var(--border-strong)", borderRadius: 8, fontSize: 12 },
  labelStyle: { color: "var(--text-2)" },
  itemStyle: { color: "var(--text)" },
} as const;

export function Resumen() {
  const { filters, setFilter, setSection, toggleFilter } = useStore();
  const { data: sum, loading } = useApi<Summary>("/api/summary", filters);
  const { data: dist } = useApi<{ estado: string; cantidad: number }[]>("/api/state-distribution", filters);
  const { data: weekly } = useApi<any[]>("/api/weekly-flow");
  const { data: alerts } = useApi<Alert[]>("/api/alerts");
  const { data: insights } = useApi<Insight[]>("/api/insights");

  const goOperacion = (f: Record<string, string>) => {
    Object.entries(f).forEach(([k, v]) => setFilter(k as any, v));
    setSection("operacion");
  };

  const distData = (dist ?? []).map((d) => ({ ...d, label: estadoLabel(d.estado) }));

  return (
    <>
      {/* KPIs */}
      <div className="grid cols-6">
        {loading || !sum ? (
          [...Array(6)].map((_, i) => <Loading key={i} />)
        ) : (
          <>
            <Kpi label="Tareas abiertas" value={nfmt(sum.abiertas)} foot="No terminadas (estado actual)" />
            <Kpi label="Terminadas en el período" value={nfmt(sum.terminadas_periodo)} foot="1ª vez a aprobado/entregado" />
            <Kpi label="En revisión" value={nfmt(sum.en_revision)} tone={sum.en_revision > 0 ? "warn" : undefined}
              foot="Esperando aprobación" onClick={() => goOperacion({ estado: "en_revision" })} title="Ver en Operación" />
            <Kpi label="Bloqueadas" value={nfmt(sum.bloqueadas)} tone={sum.bloqueadas > 0 ? "danger" : undefined}
              foot="Detenidas por impedimentos" onClick={() => goOperacion({ estado: "bloqueado" })} title="Ver en Operación" />
            <Kpi label="Sin movimiento" value={nfmt(sum.sin_movimiento)} tone={sum.sin_movimiento > 0 ? "warn" : undefined}
              foot="≥3 días corridos" onClick={() => setSection("operacion")} title="Ver en Operación" />
            <Kpi label="Participación hoy" value={`${sum.participacion.reportaron} de ${sum.participacion.total}`}
              foot="Personas que reportaron (no es productividad)" />
          </>
        )}
      </div>

      {/* Distribución + Evolución */}
      <div className="grid cols-2" style={{ marginTop: 14 }}>
        <Card>
          <CardHead title="Distribución actual por estado" sub="Tareas únicas · clic para filtrar todo el panel" />
          {!dist ? <Loading h={220} /> : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={distData} layout="vertical" margin={{ left: 8, right: 24 }}>
                <CartesianGrid horizontal={false} stroke="var(--border)" />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12, fill: "var(--text-3)" }} />
                <YAxis type="category" dataKey="label" width={92} tick={{ fontSize: 12, fill: "var(--text-2)" }} />
                <Tooltip cursor={{ fill: "rgba(255,255,255,0.04)" }} {...TT} />
                <Bar dataKey="cantidad" radius={[0, 4, 4, 0]} label={{ position: "right", fontSize: 12, fill: "var(--text-2)" }}
                  onClick={(d: any) => toggleFilter("estado", d.estado)} cursor="pointer">
                  {distData.map((d) => (
                    <Cell key={d.estado} fill={estadoColor(d.estado)}
                      opacity={filters.estado && filters.estado !== d.estado ? 0.35 : 1} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card>
          <CardHead title="Evolución semanal" sub="Últimas 12 semanas · tareas únicas (no mensajes)" />
          {!weekly ? <Loading h={220} /> : weekly.length === 0 ? (
            <EmptyState title="Aún no hay historia semanal" hint="Se llena a medida que el equipo reporta." />
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <ComposedChart data={weekly} margin={{ left: 4, right: 8 }}>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis dataKey="semana" tick={{ fontSize: 10, fill: "var(--text-3)" }}
                  tickFormatter={(s) => s.slice(5)} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "var(--text-3)" }} />
                <Tooltip {...TT} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="nuevas" name="Nuevas" fill="var(--st-pendiente)" radius={[3, 3, 0, 0]} barSize={9} />
                <Bar dataKey="terminadas" name="Terminadas" fill="var(--st-entregado)" radius={[3, 3, 0, 0]} barSize={9} />
                <Line dataKey="con_movimiento" name="Con movimiento" stroke="var(--brand)" strokeWidth={2} dot={false} />
                <Line dataKey="bloqueadas" name="Bloqueadas" stroke="var(--st-bloqueado)" strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      {/* Alertas + Insights */}
      <div className="grid cols-2" style={{ marginTop: 14 }}>
        <Card>
          <CardHead title="Alertas operativas" sub="Clic para ver el detalle en Operación" />
          {!alerts ? <Loading h={160} /> : alerts.map((a) => (
            <div key={a.key} className={`alert-row ${a.severity}`}>
              <span className="a-label">{a.label}</span>
              <span style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span className="a-val">{a.value}</span>
                <button className="go" onClick={() => goOperacion(a.filter)}>ver</button>
              </span>
            </div>
          ))}
        </Card>

        <Card>
          <CardHead title="Recomendaciones" sub="Generadas a partir de datos reales" />
          {!insights ? <Loading h={160} /> : insights.map((it, i) => (
            <div key={i} className={`insight ${it.tono}`}>
              <span className="tone" />
              <div>
                <div className="txt">{it.texto}</div>
                {it.accion && <div className="acc">→ {it.accion}</div>}
              </div>
            </div>
          ))}
        </Card>
      </div>
    </>
  );
}
