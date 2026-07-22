import { useApi, nfmt } from "../lib";
import { Card, CardHead, MetricTile, EmptyState, Loading } from "../components/ui";

interface Quality {
  reportes_sin_cliente: number;
  tareas_sin_cliente: number;
  tareas_sin_proyecto: number;
  tareas_sin_movimiento: number;
  variantes_cliente: { normal: string; variantes: string; reportes: number }[];
  personas_inactivas: { persona: string; area: string | null; ultimo_reporte: string | null }[];
  muestra_interpretacion: { momento: string; mensaje_original: string; cliente: string | null; proyecto: string | null; tarea: string; estado: string }[];
}

export function Calidad() {
  const { data, loading } = useApi<Quality>("/api/quality");

  return (
    <>
      <div className="note" style={{ marginBottom: 14 }}>
        Esta sección asegura que los análisis sean confiables. No se inventan horas, fechas de vencimiento,
        presupuesto, rentabilidad, prioridad ni responsable oficial: esos datos aún no existen en el sistema.
      </div>

      {loading || !data ? <Loading h={90} /> : (
        <>
          <div className="grid cols-6">
            <MetricTile label="Reportes sin cliente" value={nfmt(data.reportes_sin_cliente)} />
            <MetricTile label="Tareas sin cliente" value={nfmt(data.tareas_sin_cliente)} />
            <MetricTile label="Tareas sin proyecto" value={nfmt(data.tareas_sin_proyecto)} />
            <MetricTile label="Sin movimiento ≥3d" value={nfmt(data.tareas_sin_movimiento)} />
            <MetricTile label="Clientes con variantes" value={nfmt(data.variantes_cliente.length)} />
            <MetricTile label="Personas sin registro" value={nfmt(data.personas_inactivas.length)} />
          </div>

          <div className="grid cols-2" style={{ marginTop: 14 }}>
            <Card>
              <CardHead title="Clientes escritos con variantes" sub="Mismo nombre, distintas grafías · revisar y unificar (no se fusiona solo)" />
              {data.variantes_cliente.length === 0 ? <EmptyState icon="✓" title="Sin variantes detectadas" /> : (
                <div className="table-wrap" style={{ border: "none" }}>
                  <table className="data">
                    <thead><tr><th>Normalizado</th><th>Variantes encontradas</th><th className="right">Reportes</th></tr></thead>
                    <tbody>
                      {data.variantes_cliente.map((v) => (
                        <tr key={v.normal}><td className="muted">{v.normal}</td><td><b>{v.variantes}</b></td><td className="right mono">{v.reportes}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>

            <Card>
              <CardHead title="Personas activas sin registros recientes" sub="Deben reportar y no lo hacen hace ≥7 días" />
              {data.personas_inactivas.length === 0 ? <EmptyState icon="✓" title="Todas con registros recientes" /> : (
                data.personas_inactivas.map((p) => (
                  <div key={p.persona} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
                    <span><b>{p.persona}</b> <span className="muted">{p.area}</span></span>
                    <span className="muted">{p.ultimo_reporte ? `último: ${p.ultimo_reporte}` : "sin reportes"}</span>
                  </div>
                ))
              )}
            </Card>
          </div>

          <Card style={{ marginTop: 14 }}>
            <CardHead title="Auditoría de interpretación" sub="Mensaje original del agente vs. dato estructurado que guardó (últimos 12)" />
            <div className="table-wrap" style={{ border: "none" }}>
              <table className="data">
                <thead><tr><th>Momento</th><th>Mensaje original</th><th>Cliente</th><th>Proyecto</th><th>Tarea</th><th>Estado</th></tr></thead>
                <tbody>
                  {data.muestra_interpretacion.map((m, i) => (
                    <tr key={i}>
                      <td className="muted mono">{m.momento}</td>
                      <td style={{ fontStyle: "italic", color: "var(--text-2)", maxWidth: 240 }}>“{m.mensaje_original}”</td>
                      <td>{m.cliente || <span className="muted">—</span>}</td>
                      <td className="muted">{m.proyecto || "—"}</td>
                      <td><b>{m.tarea}</b></td>
                      <td>{m.estado}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </>
  );
}
