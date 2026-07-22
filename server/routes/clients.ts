import type { FastifyInstance } from "fastify";
import { rows } from "../db.ts";
import { CLIENTE_EXPR, clienteExprFor } from "../filters.ts";

export default async function clientsRoutes(app: FastifyInstance) {
  // Ranking de clientes por carga abierta (+ terminadas del período).
  app.get("/api/clients", async () => {
    const open = await rows(
      `SELECT ${CLIENTE_EXPR} AS cliente,
              COUNT(*) FILTER (WHERE estado NOT IN ('aprobado','entregado')) AS abiertas,
              COUNT(*) FILTER (WHERE estado = 'en_progreso')                 AS en_progreso,
              COUNT(*) FILTER (WHERE estado = 'en_revision')                 AS en_revision,
              COUNT(*) FILTER (WHERE estado = 'bloqueado')                   AS bloqueadas,
              COUNT(*) FILTER (WHERE estado NOT IN ('aprobado','entregado')
                               AND ultimo_movimiento < now() - interval '3 days') AS sin_movimiento
       FROM estado_actual_tareas
       GROUP BY 1
       ORDER BY abiertas DESC`
    );
    return open.map((r) => ({
      cliente: r.cliente,
      abiertas: Number(r.abiertas),
      en_progreso: Number(r.en_progreso),
      en_revision: Number(r.en_revision),
      bloqueadas: Number(r.bloqueadas),
      sin_movimiento: Number(r.sin_movimiento),
    }));
  });

  // Concentración operacional (top 1/3/5 sobre el trabajo abierto).
  app.get("/api/clients/concentration", async () => {
    const [r] = await rows(
      `WITH c AS (SELECT ${CLIENTE_EXPR} AS cliente, COUNT(*) AS n FROM tareas_pendientes GROUP BY 1)
       SELECT
         (SELECT COALESCE(SUM(n),0) FROM (SELECT n FROM c ORDER BY n DESC LIMIT 1) x) AS top1,
         (SELECT COALESCE(SUM(n),0) FROM (SELECT n FROM c ORDER BY n DESC LIMIT 3) x) AS top3,
         (SELECT COALESCE(SUM(n),0) FROM (SELECT n FROM c ORDER BY n DESC LIMIT 5) x) AS top5,
         (SELECT COALESCE(SUM(n),0) FROM c) AS total`
    );
    const total = Number(r.total) || 0;
    const pct = (x: number) => (total ? Math.round((Number(x) / total) * 100) : 0);
    return { total, top1: pct(r.top1), top3: pct(r.top3), top5: pct(r.top5) };
  });

  // Ficha de un cliente.
  app.get("/api/clients/detail", async (req) => {
    const cliente = (req.query as any).cliente;
    if (!cliente) return null;
    const match = `${CLIENTE_EXPR} = $1`;

    const [counts] = await rows(
      `SELECT
         COUNT(DISTINCT proyecto) FILTER (WHERE proyecto IS NOT NULL)   AS proyectos,
         COUNT(*) FILTER (WHERE estado NOT IN ('aprobado','entregado')) AS abiertas,
         COUNT(*) FILTER (WHERE estado IN ('aprobado','entregado'))     AS terminadas,
         COUNT(*) FILTER (WHERE estado = 'en_revision')                 AS en_revision,
         COUNT(*) FILTER (WHERE estado = 'bloqueado')                   AS bloqueadas
       FROM estado_actual_tareas WHERE ${match}`,
      [cliente]
    );
    const [ciclo] = await rows(
      `SELECT round(percentile_cont(0.5) WITHIN GROUP (ORDER BY ct.dias_ciclo)::numeric, 1) AS ciclo_mediano
       FROM o3_cycle_time ct
       JOIN estado_actual_tareas e USING (clave)
       WHERE ${clienteExprFor("e")} = $1`,
      [cliente]
    );
    const movimientos = await rows(
      `SELECT to_char(creado,'YYYY-MM-DD') AS fecha, tarea, estado, persona_nombre
       FROM reportes WHERE ${match} ORDER BY creado DESC LIMIT 8`,
      [cliente]
    );
    const personas = await rows(
      `SELECT DISTINCT ultimo_reporto AS persona, area
       FROM estado_actual_tareas WHERE ${match} AND ultimo_reporto IS NOT NULL`,
      [cliente]
    );
    return {
      cliente,
      proyectos: Number(counts.proyectos),
      abiertas: Number(counts.abiertas),
      terminadas: Number(counts.terminadas),
      en_revision: Number(counts.en_revision),
      bloqueadas: Number(counts.bloqueadas),
      ciclo_mediano: ciclo?.ciclo_mediano != null ? Number(ciclo.ciclo_mediano) : null,
      movimientos,
      personas,
    };
  });

  // Matriz de proyectos.
  app.get("/api/projects", async () => {
    return rows(
      `SELECT ${CLIENTE_EXPR} AS cliente,
              coalesce(nullif(btrim(proyecto),''),'(sin proyecto)') AS proyecto,
              COUNT(*)                                              AS total,
              COUNT(*) FILTER (WHERE estado NOT IN ('aprobado','entregado')) AS abiertas,
              COUNT(*) FILTER (WHERE estado IN ('aprobado','entregado'))     AS terminadas,
              COUNT(*) FILTER (WHERE estado = 'bloqueado')                   AS bloqueadas,
              to_char(MAX(ultimo_movimiento),'YYYY-MM-DD')                   AS ultimo_movimiento
       FROM estado_actual_tareas
       GROUP BY 1, 2
       ORDER BY total DESC`
    ).then((d) => d.map((r) => ({
      cliente: r.cliente,
      proyecto: r.proyecto,
      total: Number(r.total),
      abiertas: Number(r.abiertas),
      terminadas: Number(r.terminadas),
      pct_terminado: Number(r.total) ? Math.round((Number(r.terminadas) / Number(r.total)) * 100) : 0,
      bloqueadas: Number(r.bloqueadas),
      ultimo_movimiento: r.ultimo_movimiento,
    })));
  });
}
