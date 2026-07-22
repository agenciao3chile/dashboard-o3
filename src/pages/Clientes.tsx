import { useState } from "react";
import { useStore } from "../store";
import { useApi, nfmt } from "../lib";
import { Card, CardHead, MetricTile, EmptyState, Loading, StatLine } from "../components/ui";

interface Cli { cliente: string; abiertas: number; en_progreso: number; en_revision: number; bloqueadas: number; sin_movimiento: number; }
interface Conc { total: number; top1: number; top3: number; top5: number; }
interface Proj { cliente: string; proyecto: string; total: number; abiertas: number; terminadas: number; pct_terminado: number; bloqueadas: number; ultimo_movimiento: string; }

export function Clientes() {
  const setFilter = useStore((s) => s.setFilter);
  const setSection = useStore((s) => s.setSection);
  const { data: clientes } = useApi<Cli[]>("/api/clients");
  const { data: conc } = useApi<Conc>("/api/clients/concentration");
  const { data: projects } = useApi<Proj[]>("/api/projects");
  const [sel, setSel] = useState<string | null>(null);

  return (
    <>
      <div className="grid cols-3">
        <Card><CardHead title="Concentración: Top 1" sub="del trabajo abierto" />
          <div className="kpi-value" style={{ fontSize: 30 }}>{conc ? `${conc.top1}%` : "—"}</div></Card>
        <Card><CardHead title="Top 3 clientes" sub="del trabajo abierto" />
          <div className="kpi-value" style={{ fontSize: 30 }}>{conc ? `${conc.top3}%` : "—"}</div></Card>
        <Card><CardHead title="Top 5 clientes" sub="del trabajo abierto" />
          <div className="kpi-value" style={{ fontSize: 30 }}>{conc ? `${conc.top5}%` : "—"}</div></Card>
      </div>
      <div className="note" style={{ marginTop: 8 }}>
        La concentración detecta dependencia o saturación operacional — no rentabilidad ni valor del cliente.
      </div>

      <div className="grid cols-2" style={{ marginTop: 14 }}>
        <Card>
          <CardHead title="Ranking de clientes" sub="Por carga abierta · clic para ver la ficha" />
          {!clientes ? <Loading h={220} /> : clientes.length === 0 ? <EmptyState title="Sin clientes" /> : (
            <div className="table-wrap" style={{ border: "none" }}>
              <table className="data">
                <thead><tr><th>Cliente</th><th className="right">Abiertas</th><th className="right">Revisión</th><th className="right">Bloq.</th><th className="right">Sin mov.</th></tr></thead>
                <tbody>
                  {clientes.map((c) => (
                    <tr key={c.cliente} className="clickable" onClick={() => setSel(c.cliente)}>
                      <td><b>{c.cliente}</b></td>
                      <td className="right mono">{nfmt(c.abiertas)}</td>
                      <td className="right mono">{nfmt(c.en_revision)}</td>
                      <td className="right mono" style={{ color: c.bloqueadas ? "var(--danger)" : undefined }}>{nfmt(c.bloqueadas)}</td>
                      <td className="right mono">{nfmt(c.sin_movimiento)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <ClienteFicha cliente={sel} onFilter={(c) => { setFilter("cliente", c); setSection("operacion"); }} />
      </div>

      <Card style={{ marginTop: 14 }}>
        <CardHead title="Comparación de proyectos" sub='"% de tareas registradas que están terminadas" — no es avance contractual' />
        {!projects ? <Loading h={200} /> : (
          <div className="table-wrap" style={{ border: "none" }}>
            <table className="data">
              <thead><tr><th>Cliente</th><th>Proyecto</th><th className="right">Tareas</th><th className="right">Abiertas</th><th className="right">Terminadas</th><th className="right">% term.</th><th className="right">Bloq.</th><th>Últ. mov.</th></tr></thead>
              <tbody>
                {projects.map((p, i) => (
                  <tr key={i}>
                    <td>{p.cliente}</td>
                    <td><b>{p.proyecto}</b></td>
                    <td className="right mono">{p.total}</td>
                    <td className="right mono">{p.abiertas}</td>
                    <td className="right mono">{p.terminadas}</td>
                    <td className="right mono">{p.pct_terminado}%</td>
                    <td className="right mono" style={{ color: p.bloqueadas ? "var(--danger)" : undefined }}>{p.bloqueadas}</td>
                    <td className="muted">{p.ultimo_movimiento}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}

function ClienteFicha({ cliente, onFilter }: { cliente: string | null; onFilter: (c: string) => void }) {
  const { data } = useApi<any>(cliente ? `/api/clients/detail?cliente=${encodeURIComponent(cliente)}` : null);
  if (!cliente) return (
    <Card><CardHead title="Ficha de cliente" sub="Seleccioná un cliente en el ranking" />
      <EmptyState icon="◇" title="Sin cliente seleccionado" /></Card>
  );
  if (!data) return <Card><CardHead title={`Ficha · ${cliente}`} /><Loading h={200} /></Card>;
  return (
    <Card>
      <CardHead title={`Ficha · ${cliente}`} sub={`${data.proyectos} proyecto(s) con actividad`}
        right={<button className="btn" onClick={() => onFilter(cliente)}>Ver tareas</button>} />
      <div className="grid cols-3" style={{ gap: 8, marginBottom: 12 }}>
        <MetricTile label="Abiertas" value={nfmt(data.abiertas)} />
        <MetricTile label="Terminadas" value={nfmt(data.terminadas)} />
        <MetricTile label="Ciclo mediano" value={data.ciclo_mediano != null ? `${data.ciclo_mediano}d` : "—"} />
      </div>
      <StatLine label="En revisión" value={nfmt(data.en_revision)} />
      <StatLine label="Bloqueadas" value={nfmt(data.bloqueadas)} />
      <div style={{ marginTop: 12 }}>
        <div className="card-sub">Personas involucradas</div>
        <div className="pill-tags">
          {data.personas.map((p: any) => <span key={p.persona} className="tag">{p.persona}{p.area ? ` · ${p.area}` : ""}</span>)}
        </div>
      </div>
      <div style={{ marginTop: 12 }}>
        <div className="card-sub">Últimos movimientos</div>
        {data.movimientos.map((m: any, i: number) => (
          <div key={i} style={{ fontSize: 12.5, padding: "4px 0", borderBottom: "1px solid var(--border)" }}>
            <span className="muted">{m.fecha}</span> · {m.tarea} — <b>{m.estado}</b> <span className="muted">({m.persona_nombre})</span>
          </div>
        ))}
      </div>
    </Card>
  );
}
