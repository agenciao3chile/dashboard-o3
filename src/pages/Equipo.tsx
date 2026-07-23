import { useApi, estadoColor, nfmt } from "../lib";
import { Card, CardHead, StackBar, EmptyState, Loading } from "../components/ui";
import { useStore } from "../store";

interface Tipo { tipo: string; personas: number; abiertas: number; bloqueadas: number; }

interface Load {
  persona: string; area: string | null; tipo: string; abiertas: number;
  pendiente: number; en_progreso: number; en_revision: number; bloqueado: number;
  sin_movimiento: number; mediana_dias: number; señales: string[];
}

const FL_TAG: React.CSSProperties = {
  flex: "0 0 auto", fontSize: 9, fontWeight: 600, padding: "1px 6px", borderRadius: 999,
  color: "var(--warn)", border: "1px solid rgba(229,171,69,.3)", background: "rgba(229,171,69,.08)",
  textTransform: "uppercase", letterSpacing: ".04em",
};
interface Rep { persona: string; area: string | null; esperados: number; con_reporte: number; cumplimiento: number; }
interface Area { area: string; abiertas: number; en_revision: number; bloqueadas: number; sin_movimiento: number; }

const SEG = [
  { key: "pendiente", color: estadoColor("pendiente") },
  { key: "en_progreso", color: estadoColor("en_progreso") },
  { key: "en_revision", color: estadoColor("en_revision") },
  { key: "bloqueado", color: estadoColor("bloqueado") },
];

export function Equipo() {
  const filters = useStore((s) => s.filters);
  const { data: load } = useApi<Load[]>("/api/team/load", filters);
  const { data: rep } = useApi<Rep[]>("/api/team/reporting");
  const { data: areas } = useApi<Area[]>("/api/team/by-area");
  const { data: tipos } = useApi<Tipo[]>("/api/team/by-tipo");
  const max = Math.max(1, ...(load ?? []).map((l) => l.abiertas));

  return (
    <>
      <Card style={{ marginBottom: 14 }}>
        <CardHead title="Fijos vs freelance" sub="Personas activas y tareas abiertas por tipo de contratación" />
        {!tipos ? <Loading h={70} /> : (
          <div className="grid cols-2" style={{ gap: 12 }}>
            {tipos.map((t) => (
              <div key={t.tipo} style={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 12, padding: "13px 15px" }}>
                <div style={{ fontSize: 12, fontWeight: 600, textTransform: "capitalize", color: t.tipo === "freelance" ? "var(--warn)" : "var(--text)" }}>{t.tipo}</div>
                <div style={{ display: "flex", gap: 22, marginTop: 8 }}>
                  <div><div style={{ fontSize: 22, fontWeight: 680 }}>{nfmt(t.personas)}</div><div className="muted" style={{ fontSize: 11 }}>personas</div></div>
                  <div><div style={{ fontSize: 22, fontWeight: 680 }}>{nfmt(t.abiertas)}</div><div className="muted" style={{ fontSize: 11 }}>tareas abiertas</div></div>
                  <div><div style={{ fontSize: 22, fontWeight: 680, color: t.bloqueadas ? "var(--danger)" : undefined }}>{nfmt(t.bloqueadas)}</div><div className="muted" style={{ fontSize: 11 }}>bloqueadas</div></div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <CardHead title="Carga actual por persona" sub="Solo tareas abiertas · el objetivo es administrar capacidad, no rankear personas" />
        {!load ? <Loading h={220} /> : load.length === 0 ? (
          <EmptyState title="Sin tareas abiertas" />
        ) : (
          <>
            <div>
              {load.map((l) => (
                <div key={l.persona} style={{ padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
                  <div className="hbar" style={{ gridTemplateColumns: "172px 1fr 44px" }}>
                    <div className="name" title={`${l.persona} — ${l.area ?? ""}`}
                      style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.persona}</span>
                      {l.tipo === "freelance" && <span style={FL_TAG}>freelance</span>}
                    </div>
                    <StackBar total={l.abiertas} max={max}
                      segments={SEG.map((s) => ({ key: s.key, value: (l as any)[s.key], color: s.color }))} />
                    <div className="num">{l.abiertas}</div>
                  </div>
                  {l.señales.length > 0 && (
                    <div className="pill-tags" style={{ marginLeft: 140 }}>
                      {l.señales.map((s) => <span key={s} className="tag">{s}</span>)}
                      <span className="tag">mediana {l.mediana_dias}d sin mov · {l.sin_movimiento} arrastradas</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="legend">
              {SEG.map((s) => (
                <span key={s.key}><span className="dot" style={{ background: s.color }} />{s.key.replace("_", " ")}</span>
              ))}
            </div>
          </>
        )}
      </Card>

      <div className="grid cols-2" style={{ marginTop: 14 }}>
        <Card>
          <CardHead title="Consistencia de reporte" sub="Últimos 28 días hábiles · excluye a quienes no reportan" />
          {!rep ? <Loading h={180} /> : (
            <>
              {rep.map((r) => (
                <div key={r.persona} className="hbar" style={{ gridTemplateColumns: "150px 1fr 46px" }}>
                  <div className="name">{r.persona}</div>
                  <div className="track">
                    <div className="seg" style={{
                      width: `${r.cumplimiento}%`,
                      background: r.cumplimiento >= 70 ? "var(--ok)" : r.cumplimiento >= 40 ? "var(--warn)" : "var(--danger)",
                    }} />
                  </div>
                  <div className="num">{r.cumplimiento}%</div>
                </div>
              ))}
              <div className="note" style={{ marginTop: 10 }}>
                El registro diario refleja participación en el sistema, no cantidad ni calidad del trabajo realizado.
              </div>
            </>
          )}
        </Card>

        <Card>
          <CardHead title="Vista por área" sub="Carga abierta, revisión y bloqueos por área" />
          {!areas ? <Loading h={180} /> : (
            <div className="table-wrap" style={{ border: "none" }}>
              <table className="data">
                <thead><tr><th>Área</th><th className="right">Abiertas</th><th className="right">En revisión</th><th className="right">Bloqueadas</th><th className="right">Sin mov.</th></tr></thead>
                <tbody>
                  {areas.map((a) => (
                    <tr key={a.area}>
                      <td><b>{a.area}</b></td>
                      <td className="right mono">{nfmt(a.abiertas)}</td>
                      <td className="right mono">{nfmt(a.en_revision)}</td>
                      <td className="right mono" style={{ color: a.bloqueadas ? "var(--danger)" : undefined }}>{nfmt(a.bloqueadas)}</td>
                      <td className="right mono">{nfmt(a.sin_movimiento)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
