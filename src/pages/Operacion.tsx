import { useMemo, useState } from "react";
import { useStore } from "../store";
import { useApi, estadoColor, estadoLabel, ESTADO_META, ALERTA_LABEL, nfmt } from "../lib";
import { Card, CardHead, MetricTile, StateChip, EmptyState, Loading } from "../components/ui";

interface Task {
  clave: string; cliente: string | null; proyecto: string | null; tarea: string;
  estado: string; entregado_a: string | null; ultimo_reporto: string; area: string | null;
  ultima_fecha: string; dias_sin_mov: number; nota: string | null; alerta: string;
}

export function Operacion() {
  const { filters } = useStore();
  const { data: funnel } = useApi<{ flujo: { estado: string; n: number }[]; bloqueado: number }>("/api/funnel");
  const { data: flow } = useApi<any>("/api/flow");
  const { data: tasks, loading } = useApi<Task[]>("/api/tasks", filters);

  return (
    <>
      {/* Embudo */}
      <Card>
        <CardHead title="Embudo operacional" sub="Tareas por estado actual · las bloqueadas son un desvío del flujo, no un paso" />
        {!funnel ? <Loading h={90} /> : (
          <div style={{ display: "flex", alignItems: "stretch", gap: 8, flexWrap: "wrap" }}>
            {funnel.flujo.map((s, i) => (
              <div key={s.estado} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ textAlign: "center", minWidth: 96, padding: "10px 12px", borderRadius: 10,
                  background: "var(--surface-2)", border: `1px solid var(--border)`, borderTop: `3px solid ${estadoColor(s.estado)}` }}>
                  <div style={{ fontSize: 22, fontWeight: 680 }}>{s.n}</div>
                  <div style={{ fontSize: 11, color: "var(--text-2)" }}>{estadoLabel(s.estado)}</div>
                </div>
                {i < funnel.flujo.length - 1 && <span style={{ color: "var(--text-3)" }}>→</span>}
              </div>
            ))}
            <div style={{ marginLeft: "auto", textAlign: "center", minWidth: 96, padding: "10px 12px", borderRadius: 10,
              background: "#fff5f5", border: "1px solid #fecaca" }}>
              <div style={{ fontSize: 22, fontWeight: 680, color: "var(--st-bloqueado)" }}>{funnel.bloqueado}</div>
              <div style={{ fontSize: 11, color: "var(--text-2)" }}>⛔ Bloqueadas</div>
            </div>
          </div>
        )}
      </Card>

      {/* Flujo: ciclo / revisión / retrabajo */}
      <div className="grid cols-3" style={{ marginTop: 14 }}>
        <Card>
          <CardHead title="Tiempo de ciclo" sub="Primer reporte → primer estado terminal (días)" />
          {!flow ? <Loading h={90} /> : flow.ciclo.n === 0 ? (
            <EmptyState title="Sin tareas terminadas aún" hint="Se calcula cuando haya cierres." />
          ) : (
            <div className="grid cols-3" style={{ gap: 8 }}>
              <MetricTile label="Mediana" value={flow.ciclo.mediana ?? "—"} />
              <MetricTile label="Promedio" value={flow.ciclo.promedio ?? "—"} />
              <MetricTile label="P75" value={flow.ciclo.p75 ?? "—"} />
            </div>
          )}
          <div className="note" style={{ marginTop: 10 }}>Priorizamos la mediana: no se distorsiona con pocas tareas antiguas.</div>
        </Card>

        <Card>
          <CardHead title="Tiempo en revisión" sub="Desde que entra a revisión hasta que sale (días)" />
          {!flow ? <Loading h={90} /> : (
            <>
              <MetricTile label="Mediana" value={flow.revision.mediana ?? "—"} />
              <div className="grid cols-2" style={{ gap: 8, marginTop: 8 }}>
                <MetricTile label="En revisión ahora" value={nfmt(flow.revision.en_curso)} />
                <MetricTile label="≥2 días" value={nfmt(flow.revision.buckets.g2)} />
              </div>
              <div className="legend"><span>≥1d: {flow.revision.buckets.g1}</span><span>≥3d: {flow.revision.buckets.g3}</span><span>≥5d: {flow.revision.buckets.g5}</span></div>
            </>
          )}
        </Card>

        <Card>
          <CardHead title="Señales de retrabajo" sub="Devoluciones de revisión o reaperturas" />
          {!flow ? <Loading h={90} /> : (
            <>
              <div className="grid cols-2" style={{ gap: 8 }}>
                <MetricTile label="Tasa de retrabajo" value={`${flow.retrabajo.tasa}%`} />
                <MetricTile label="Tareas afectadas" value={nfmt(flow.retrabajo.tareas)} />
              </div>
              <div className="note" style={{ marginTop: 10 }}>
                {flow.retrabajo.eventos} devolución(es) sobre {flow.retrabajo.entradas_revision} entradas a revisión. El sistema no registra la causa.
              </div>
            </>
          )}
        </Card>
      </div>

      {/* Aging */}
      <Card style={{ marginTop: 14 }}>
        <CardHead title="Antigüedad de tareas abiertas" sub="Días corridos sin movimiento" />
        {!flow ? <Loading h={80} /> : (
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {flow.aging.map((b: any) => (
              <div key={b.rango} style={{ flex: 1, minWidth: 110, textAlign: "center", padding: "12px",
                borderRadius: 10, background: "var(--surface-2)", border: "1px solid var(--border)" }}>
                <div style={{ fontSize: 22, fontWeight: 680, color: b.rango === ">20" || b.rango === "11-20" ? "var(--danger)" : "var(--text)" }}>{b.n}</div>
                <div style={{ fontSize: 12, color: "var(--text-2)" }}>{b.rango} días</div>
                <div style={{ fontSize: 11, color: "var(--text-3)" }}>{b.pct}%</div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Tabla operativa */}
      <div style={{ marginTop: 14 }}>
        <OpTable tasks={tasks} loading={loading} />
      </div>
    </>
  );
}

type SortKey = keyof Task;

function OpTable({ tasks, loading }: { tasks: Task[] | null; loading: boolean }) {
  const openDrawer = useStore((s) => s.openDrawer);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<{ k: SortKey; dir: 1 | -1 }>({ k: "dias_sin_mov", dir: -1 });

  const rows = useMemo(() => {
    let r = tasks ?? [];
    if (q.trim()) {
      const s = q.toLowerCase();
      r = r.filter((t) =>
        [t.cliente, t.proyecto, t.tarea, t.ultimo_reporto, t.area, t.nota]
          .some((v) => (v ?? "").toLowerCase().includes(s))
      );
    }
    return [...r].sort((a, b) => {
      const av = a[sort.k] ?? "", bv = b[sort.k] ?? "";
      if (av < bv) return -sort.dir;
      if (av > bv) return sort.dir;
      return 0;
    });
  }, [tasks, q, sort]);

  const toggleSort = (k: SortKey) => setSort((s) => (s.k === k ? { k, dir: (s.dir * -1) as 1 | -1 } : { k, dir: 1 }));

  const exportCsv = () => {
    const head = ["cliente", "proyecto", "tarea", "estado", "ultimo_reporto", "area", "ultima_fecha", "dias_sin_mov", "entregado_a", "nota", "alerta"];
    const lines = [head.join(",")].concat(
      rows.map((t) => head.map((h) => `"${String((t as any)[h] ?? "").replace(/"/g, '""')}"`).join(","))
    );
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "tareas-o3.csv";
    a.click();
  };

  const H = ({ k, children }: { k: SortKey; children: React.ReactNode }) => (
    <th onClick={() => toggleSort(k)}>{children}{sort.k === k ? (sort.dir === 1 ? " ▲" : " ▼") : ""}</th>
  );

  return (
    <Card>
      <CardHead title="Tabla operativa" sub={`${rows.length} tarea(s) · "Último responsable registrado" es quien reportó al último, no una asignación oficial`} />
      <div className="toolbar">
        <input type="search" placeholder="Buscar cliente, tarea, persona…" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="btn" onClick={exportCsv}>Exportar CSV</button>
      </div>
      {loading ? <Loading h={200} /> : rows.length === 0 ? (
        <EmptyState title="No hay tareas con estos filtros" />
      ) : (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <H k="cliente">Cliente</H>
                <H k="proyecto">Proyecto</H>
                <H k="tarea">Tarea</H>
                <H k="estado">Estado</H>
                <H k="ultimo_reporto">Últ. responsable</H>
                <H k="area">Área</H>
                <H k="dias_sin_mov">Días s/mov</H>
                <th>Entregado a</th>
                <th>Alerta</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => (
                <tr key={t.clave} className="clickable"
                  onClick={() => openDrawer(t.clave, [t.cliente, t.proyecto, t.tarea].filter(Boolean).join(" · "))}>
                  <td>{t.cliente || <span className="muted">Sin cliente</span>}</td>
                  <td className="muted">{t.proyecto || "—"}</td>
                  <td><b>{t.tarea}</b>{t.nota && <div className="muted" style={{ fontSize: 11.5 }}>{t.nota}</div>}</td>
                  <td><StateChip estado={t.estado} /></td>
                  <td>{t.ultimo_reporto}</td>
                  <td className="muted">{t.area || "—"}</td>
                  <td className={`mono right ${t.dias_sin_mov >= 6 && !["aprobado", "entregado"].includes(t.estado) ? "warnflag" : ""}`}>{t.dias_sin_mov}</td>
                  <td className="muted">{t.entregado_a || "—"}</td>
                  <td>{t.alerta ? <span style={{ color: "var(--danger)", fontSize: 12 }}>{ALERTA_LABEL[t.alerta] ?? t.alerta}</span> : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
