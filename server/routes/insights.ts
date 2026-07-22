import type { FastifyInstance } from "fastify";
import { rows } from "../db.ts";
import { CLIENTE_EXPR } from "../filters.ts";

// Insights en lenguaje natural, SOLO a partir de datos reales. Nunca juicios
// personales: se traducen a recomendaciones operativas.
export default async function insightsRoutes(app: FastifyInstance) {
  app.get("/api/insights", async () => {
    const out: { texto: string; tono: "alerta" | "info" | "positivo"; accion: string }[] = [];

    const [sinMov] = await rows(`SELECT COUNT(*) n FROM o3_task_aging WHERE dias_sin_mov >= 3`);
    if (Number(sinMov.n) > 0)
      out.push({
        texto: `Hay ${sinMov.n} tarea(s) sin movimiento durante más de tres días.`,
        tono: "alerta",
        accion: "Confirmar si siguen vigentes o cerrarlas.",
      });

    const areas = await rows(
      `SELECT area, COUNT(*) n FROM tareas_pendientes WHERE area IS NOT NULL GROUP BY area ORDER BY n DESC`
    );
    const totalOpen = areas.reduce((a, r) => a + Number(r.n), 0);
    if (areas[0] && totalOpen > 0) {
      const pct = Math.round((Number(areas[0].n) / totalOpen) * 100);
      if (pct >= 40)
        out.push({
          texto: `${areas[0].area} concentra el ${pct}% de las tareas abiertas.`,
          tono: "info",
          accion: "Revisar la distribución de carga entre áreas.",
        });
    }

    const [rev] = await rows(
      `SELECT COUNT(*) n FROM o3_review_spans WHERE en_curso AND dias_en_revision >= 2`
    );
    if (Number(rev.n) > 0)
      out.push({
        texto: `${rev.n} tarea(s) llevan más de dos días esperando revisión.`,
        tono: "alerta",
        accion: "Acelerar aprobaciones pendientes.",
      });

    const blockedByClient = await rows(
      `SELECT ${CLIENTE_EXPR} cliente, COUNT(*) n FROM tareas_pendientes
       WHERE estado = 'bloqueado' GROUP BY 1 ORDER BY n DESC`
    );
    const totalBlocked = blockedByClient.reduce((a, r) => a + Number(r.n), 0);
    if (blockedByClient[0] && totalBlocked >= 2) {
      const pct = Math.round((Number(blockedByClient[0].n) / totalBlocked) * 100);
      if (pct >= 40)
        out.push({
          texto: `El cliente ${blockedByClient[0].cliente} concentra el ${pct}% de los trabajos bloqueados.`,
          tono: "info",
          accion: "Revisar los bloqueos de ese cliente.",
        });
    }

    const [wk] = await rows(
      `SELECT
         COALESCE((SELECT terminadas FROM o3_weekly_flow WHERE semana = date_trunc('week', now())::date), 0) AS esta,
         COALESCE((SELECT terminadas FROM o3_weekly_flow WHERE semana = date_trunc('week', now())::date - 7), 0) AS pasada`
    );
    if (Number(wk.pasada) > 0 && Number(wk.esta) < Number(wk.pasada))
      out.push({
        texto: `Las tareas terminadas bajaron respecto de la semana anterior (${wk.esta} vs ${wk.pasada}).`,
        tono: "info",
        accion: "Revisar cuellos de botella en revisión y bloqueos.",
      });

    const [rework] = await rows(
      `SELECT COUNT(*) n FROM o3_rework_events WHERE creado > now() - interval '30 days'`
    );
    if (Number(rework.n) > 0)
      out.push({
        texto: `Se detectaron ${rework.n} señal(es) de retrabajo en los últimos 30 días.`,
        tono: "info",
        accion: "Revisar claridad de briefs y criterios de aprobación.",
      });

    if (out.length === 0)
      out.push({ texto: "Sin alertas operativas por ahora.", tono: "positivo", accion: "" });

    return out;
  });
}
