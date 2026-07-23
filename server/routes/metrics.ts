import type { FastifyInstance } from "fastify";
import { rows } from "../db.ts";
import { parseFilters, buildWhere, CLIENTE_EXPR, clienteExprFor } from "../filters.ts";

const ESTADOS = ["pendiente", "en_progreso", "en_revision", "aprobado", "entregado", "publicado", "bloqueado"];
const SNAP = { persona: "ultimo_reporto", area: "area", cliente: CLIENTE_EXPR, proyecto: "proyecto", tipo: "tipo" };
const num = (v: any): number | null => (v == null ? null : Number(v));

export default async function metricsRoutes(app: FastifyInstance) {
  // Opciones para los selectores de filtros.
  app.get("/api/filters/options", async () => {
    const [personas, areas, clientes, proyectos] = await Promise.all([
      rows(`SELECT DISTINCT ultimo_reporto AS v FROM estado_actual_tareas WHERE ultimo_reporto IS NOT NULL ORDER BY 1`),
      rows(`SELECT DISTINCT area AS v FROM estado_actual_tareas WHERE area IS NOT NULL ORDER BY 1`),
      rows(`SELECT DISTINCT ${CLIENTE_EXPR} AS v FROM estado_actual_tareas ORDER BY 1`),
      rows(`SELECT DISTINCT proyecto AS v FROM estado_actual_tareas WHERE proyecto IS NOT NULL ORDER BY 1`),
    ]);
    return {
      personas: personas.map((r) => r.v),
      areas: areas.map((r) => r.v),
      clientes: clientes.map((r) => r.v),
      proyectos: proyectos.map((r) => r.v),
      estados: ESTADOS,
    };
  });

  // KPIs del resumen ejecutivo.
  app.get("/api/summary", async (req) => {
    const f = parseFilters(req.query as any);
    const snap = buildWhere(f, SNAP);

    // Terminadas en el período (primera vez que llegó a terminal).
    const term = buildWhere(f, {
      persona: "e.ultimo_reporto",
      area: "e.area",
      cliente: clienteExprFor("e"),
      proyecto: "e.proyecto",
      tipo: "e.tipo",
      fecha: "t.terminado_en",
    });
    // Las tres consultas son independientes: en paralelo para no encadenar
    // round-trips contra la BD (lo que hacía lento el resumen).
    const [[kpi], [t], [part]] = await Promise.all([
      rows(
        `SELECT
           COUNT(*) FILTER (WHERE estado NOT IN ('aprobado','entregado','publicado'))                 AS abiertas,
           COUNT(*) FILTER (WHERE estado = 'en_revision')                                 AS en_revision,
           COUNT(*) FILTER (WHERE estado = 'bloqueado')                                   AS bloqueadas,
           COUNT(*) FILTER (WHERE estado NOT IN ('aprobado','entregado','publicado')
                            AND ultimo_movimiento < now() - interval '3 days')            AS sin_movimiento
         FROM o3_estado_ext ${snap.where}`,
        snap.params
      ),
      rows(
        `SELECT COUNT(*) AS terminadas
         FROM o3_task_terminal t JOIN o3_estado_ext e USING (clave) ${term.where}`,
        term.params
      ),
      rows(
        `SELECT
           (SELECT COUNT(*) FROM personas WHERE activo AND reporta) AS total,
           (SELECT COUNT(DISTINCT r.persona_chat_id) FROM reportes r
              JOIN personas p ON p.chat_id = r.persona_chat_id
            WHERE p.activo AND p.reporta AND r.fecha = now()::date) AS reportaron`
      ),
    ]);

    return {
      abiertas: Number(kpi.abiertas),
      terminadas_periodo: Number(t.terminadas),
      en_revision: Number(kpi.en_revision),
      bloqueadas: Number(kpi.bloqueadas),
      sin_movimiento: Number(kpi.sin_movimiento),
      participacion: { reportaron: Number(part.reportaron), total: Number(part.total) },
    };
  });

  // Distribución actual por estado (para barras).
  app.get("/api/state-distribution", async (req) => {
    const f = parseFilters(req.query as any);
    const snap = buildWhere(f, SNAP);
    const data = await rows(
      `SELECT estado, COUNT(*) AS cantidad FROM o3_estado_ext ${snap.where} GROUP BY estado`,
      snap.params
    );
    const byEstado = new Map(data.map((r) => [r.estado, Number(r.cantidad)]));
    return ESTADOS.map((estado) => ({ estado, cantidad: byEstado.get(estado) ?? 0 }));
  });

  // Evolución semanal (últimas 12 semanas). Vista global, sin filtros.
  app.get("/api/weekly-flow", async () => {
    const data = await rows(
      `SELECT to_char(semana,'YYYY-MM-DD') AS semana, con_movimiento, terminadas, nuevas, bloqueadas
       FROM o3_weekly_flow ORDER BY semana DESC LIMIT 12`
    );
    return data.reverse().map((r) => ({
      semana: r.semana,
      con_movimiento: Number(r.con_movimiento),
      terminadas: Number(r.terminadas),
      nuevas: Number(r.nuevas),
      bloqueadas: Number(r.bloqueadas),
    }));
  });

  // Embudo operacional (conteo por estado actual, con desvío de bloqueadas).
  app.get("/api/funnel", async () => {
    const d = await rows(
      `SELECT estado, COUNT(*) AS n FROM estado_actual_tareas GROUP BY estado`
    );
    const m = new Map(d.map((r) => [r.estado, Number(r.n)]));
    return {
      flujo: ["pendiente", "en_progreso", "en_revision", "aprobado", "entregado", "publicado"].map((e) => ({
        estado: e,
        n: m.get(e) ?? 0,
      })),
      bloqueado: m.get("bloqueado") ?? 0,
    };
  });

  // Métricas de flujo: ciclo, revisión, retrabajo y antigüedad (aging).
  app.get("/api/flow", async () => {
    const [[cyc], [rev], [rew], [ent], bucketRows] = await Promise.all([
      rows(
        `SELECT
           round(percentile_cont(0.5) WITHIN GROUP (ORDER BY dias_ciclo)::numeric, 1)  AS mediana,
           round(avg(dias_ciclo)::numeric, 1)                                           AS promedio,
           round(percentile_cont(0.75) WITHIN GROUP (ORDER BY dias_ciclo)::numeric, 1) AS p75,
           COUNT(*)                                                                     AS n
         FROM o3_cycle_time`
      ),
      rows(
        `SELECT
           round(percentile_cont(0.5) WITHIN GROUP (ORDER BY dias_en_revision)::numeric, 1) AS mediana,
           COUNT(*) FILTER (WHERE en_curso)                        AS en_curso,
           COUNT(*) FILTER (WHERE en_curso AND dias_en_revision >= 1) AS g1,
           COUNT(*) FILTER (WHERE en_curso AND dias_en_revision >= 2) AS g2,
           COUNT(*) FILTER (WHERE en_curso AND dias_en_revision >= 3) AS g3,
           COUNT(*) FILTER (WHERE en_curso AND dias_en_revision >= 5) AS g5
         FROM o3_review_spans`
      ),
      rows(`SELECT COUNT(DISTINCT clave) AS tareas, COUNT(*) AS eventos FROM o3_rework_events`),
      rows(`SELECT COUNT(*) AS c FROM o3_task_events WHERE estado = 'en_revision'`),
      rows(
        `SELECT CASE
                  WHEN dias_sin_mov < 3  THEN '0-2'
                  WHEN dias_sin_mov < 6  THEN '3-5'
                  WHEN dias_sin_mov < 11 THEN '6-10'
                  WHEN dias_sin_mov < 21 THEN '11-20'
                  ELSE '>20'
                END AS rango, COUNT(*) AS n
         FROM o3_task_aging GROUP BY 1`
      ),
    ]);
    const bm = new Map(bucketRows.map((r) => [r.rango, Number(r.n)]));
    const orden = ["0-2", "3-5", "6-10", "11-20", ">20"];
    const totalAbiertas = orden.reduce((a, r) => a + (bm.get(r) ?? 0), 0);
    const entered = Number(ent.c);
    return {
      ciclo: { mediana: num(cyc.mediana), promedio: num(cyc.promedio), p75: num(cyc.p75), n: Number(cyc.n) },
      revision: {
        mediana: num(rev.mediana),
        en_curso: Number(rev.en_curso),
        buckets: { g1: Number(rev.g1), g2: Number(rev.g2), g3: Number(rev.g3), g5: Number(rev.g5) },
      },
      retrabajo: {
        tareas: Number(rew.tareas),
        eventos: Number(rew.eventos),
        entradas_revision: entered,
        tasa: entered ? Math.round((Number(rew.eventos) / entered) * 100) : 0,
      },
      aging: orden.map((r) => ({
        rango: r,
        n: bm.get(r) ?? 0,
        pct: totalAbiertas ? Math.round(((bm.get(r) ?? 0) / totalAbiertas) * 100) : 0,
      })),
    };
  });

  // Alertas operativas priorizadas.
  app.get("/api/alerts", async () => {
    const [[bloq], [sinmov], [rev], [norep], conc, [tot]] = await Promise.all([
      rows(`SELECT COUNT(*) c FROM o3_task_aging WHERE estado = 'bloqueado'`),
      rows(`SELECT COUNT(*) c FROM o3_task_aging WHERE dias_sin_mov >= 3`),
      rows(`SELECT COUNT(*) c FROM o3_review_spans WHERE en_curso AND dias_en_revision >= 2`),
      rows(
        `SELECT COUNT(*) c FROM personas p WHERE p.activo AND p.reporta
          AND NOT EXISTS (SELECT 1 FROM reportes r WHERE r.persona_chat_id = p.chat_id AND r.fecha = now()::date)`
      ),
      rows(`SELECT ${CLIENTE_EXPR} AS cliente, COUNT(*) c FROM tareas_pendientes GROUP BY 1 ORDER BY c DESC LIMIT 1`),
      rows(`SELECT COUNT(*) c FROM tareas_pendientes`),
    ]);
    const topCliente = conc[0];
    const pct = topCliente && Number(tot.c) ? Math.round((Number(topCliente.c) / Number(tot.c)) * 100) : 0;

    return [
      { key: "bloqueadas", label: "Tareas bloqueadas", value: Number(bloq.c), severity: "alta", filter: { estado: "bloqueado" } },
      { key: "sin_movimiento", label: "Sin movimiento ≥3 días", value: Number(sinmov.c), severity: "alta", filter: {} },
      { key: "revision_larga", label: "En revisión ≥2 días", value: Number(rev.c), severity: "media", filter: { estado: "en_revision" } },
      { key: "no_reporto", label: "No reportaron hoy", value: Number(norep.c), severity: "media", filter: {} },
      {
        key: "concentracion",
        label: topCliente ? `Concentración: ${topCliente.cliente}` : "Concentración por cliente",
        value: `${pct}%`,
        severity: pct >= 40 ? "alta" : "baja",
        filter: topCliente ? { cliente: topCliente.cliente } : {},
      },
    ];
  });
}
