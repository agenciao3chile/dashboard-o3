import type { FastifyInstance } from "fastify";
import { rows } from "../db.ts";
import { parseFilters, buildWhere, clienteExprFor } from "../filters.ts";

export default async function tasksRoutes(app: FastifyInstance) {
  // Tabla operativa: estado actual de cada tarea con antigüedad y alerta.
  app.get("/api/tasks", async (req) => {
    const f = parseFilters(req.query as any);
    const w = buildWhere(f, {
      persona: "e.ultimo_reporto",
      area: "e.area",
      cliente: clienteExprFor("e"),
      proyecto: "e.proyecto",
      estado: "e.estado",
      tipo: "e.tipo",
    });
    const data = await rows(
      `SELECT e.clave, e.cliente, e.proyecto, e.tarea, e.estado, e.entregado_a,
              e.ultimo_reporto, e.area, to_char(e.ultima_fecha,'YYYY-MM-DD') AS ultima_fecha,
              floor(EXTRACT(EPOCH FROM (now() - e.ultimo_movimiento)) / 86400.0)::int AS dias_sin_mov,
              r.nota,
              CASE
                WHEN e.estado = 'bloqueado' THEN 'bloqueada'
                WHEN e.estado NOT IN ('aprobado','entregado','publicado')
                     AND e.ultimo_movimiento < now() - interval '3 days' THEN 'sin_movimiento'
                WHEN e.estado = 'en_revision' THEN 'revision'
                ELSE ''
              END AS alerta
       FROM o3_estado_ext e
       LEFT JOIN reportes r ON r.id = e.ultimo_reporte_id
       ${w.where}
       ORDER BY (e.estado = 'bloqueado') DESC, dias_sin_mov DESC`,
      w.params
    );
    return data;
  });

  // Historial completo de movimientos de una tarea (para el panel lateral).
  app.get("/api/tasks/history", async (req) => {
    const clave = (req.query as any).clave;
    if (!clave) return [];
    return rows(
      `SELECT to_char(creado,'YYYY-MM-DD HH24:MI') AS momento, estado, persona_nombre,
              entregado_a, nota, mensaje_original
       FROM reportes
       WHERE tarea_key(cliente, proyecto, tarea) = $1
       ORDER BY creado, id`,
      [clave]
    );
  });
}
