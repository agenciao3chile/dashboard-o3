import type { FastifyInstance } from "fastify";
import { rows } from "../db.ts";

export default async function teamRoutes(app: FastifyInstance) {
  // Carga actual por persona (barras apiladas por estado abierto).
  app.get("/api/team/load", async () => {
    const data = await rows(
      `SELECT tp.ultimo_reporto AS persona, tp.area,
              COALESCE(max(p.tipo), 'fijo')                        AS tipo,
              COUNT(*)                                             AS abiertas,
              COUNT(*) FILTER (WHERE tp.estado = 'pendiente')      AS pendiente,
              COUNT(*) FILTER (WHERE tp.estado = 'en_progreso')    AS en_progreso,
              COUNT(*) FILTER (WHERE tp.estado = 'en_revision')    AS en_revision,
              COUNT(*) FILTER (WHERE tp.estado = 'bloqueado')      AS bloqueado,
              COUNT(*) FILTER (WHERE tp.ultimo_movimiento < now() - interval '3 days') AS sin_movimiento,
              round(percentile_cont(0.5) WITHIN GROUP (
                ORDER BY EXTRACT(EPOCH FROM (now() - tp.ultimo_movimiento)) / 86400.0)::numeric, 1) AS mediana_dias
       FROM tareas_pendientes tp
       LEFT JOIN personas p ON lower(p.nombre) = lower(tp.ultimo_reporto)
       GROUP BY tp.ultimo_reporto, tp.area
       ORDER BY abiertas DESC`
    );
    const nums = data.map((r) => Number(r.abiertas));
    const avg = nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
    return data.map((r) => {
      const abiertas = Number(r.abiertas);
      const señales: string[] = [];
      if (abiertas > avg * 1.5 && abiertas >= 3) señales.push("Carga superior al promedio");
      if (Number(r.en_revision) >= 3) señales.push("Alta concentración en revisión");
      if (Number(r.sin_movimiento) >= 2) señales.push("Varias tareas sin movimiento");
      if (Number(r.bloqueado) >= 2) señales.push("Varias tareas bloqueadas");
      if (abiertas <= Math.max(1, avg * 0.4)) señales.push("Posible capacidad disponible");
      return {
        persona: r.persona,
        area: r.area,
        tipo: r.tipo as string,
        abiertas,
        pendiente: Number(r.pendiente),
        en_progreso: Number(r.en_progreso),
        en_revision: Number(r.en_revision),
        bloqueado: Number(r.bloqueado),
        sin_movimiento: Number(r.sin_movimiento),
        mediana_dias: Number(r.mediana_dias) || 0,
        señales,
      };
    });
  });

  // Consistencia de reporte (últimos 28 días hábiles). Excluye reporta=false.
  app.get("/api/team/reporting", async () => {
    return rows(
      `WITH dias AS (
         SELECT d::date AS d
         FROM generate_series(now()::date - 27, now()::date, interval '1 day') g(d)
         WHERE EXTRACT(DOW FROM d) BETWEEN 1 AND 5
       ),
       rep AS (
         SELECT DISTINCT r.persona_chat_id, r.fecha
         FROM reportes r JOIN dias ON dias.d = r.fecha
       )
       SELECT p.nombre AS persona, p.area,
              (SELECT COUNT(*) FROM dias)               AS esperados,
              COUNT(rep.fecha)                          AS con_reporte
       FROM personas p
       LEFT JOIN rep ON rep.persona_chat_id = p.chat_id
       WHERE p.activo AND p.reporta
       GROUP BY p.nombre, p.area
       ORDER BY con_reporte DESC`
    ).then((data) =>
      data.map((r) => ({
        persona: r.persona,
        area: r.area,
        esperados: Number(r.esperados),
        con_reporte: Number(r.con_reporte),
        cumplimiento: Number(r.esperados) ? Math.round((Number(r.con_reporte) / Number(r.esperados)) * 100) : 0,
      }))
    );
  });

  // Vista por área.
  app.get("/api/team/by-area", async () => {
    return rows(
      `SELECT coalesce(area,'(sin área)') AS area,
              COUNT(*) FILTER (WHERE estado NOT IN ('aprobado','entregado')) AS abiertas,
              COUNT(*) FILTER (WHERE estado = 'en_revision')                 AS en_revision,
              COUNT(*) FILTER (WHERE estado = 'bloqueado')                   AS bloqueadas,
              COUNT(*) FILTER (WHERE estado NOT IN ('aprobado','entregado')
                               AND ultimo_movimiento < now() - interval '3 days') AS sin_movimiento
       FROM estado_actual_tareas
       GROUP BY area
       ORDER BY abiertas DESC`
    ).then((d) => d.map((r) => ({
      area: r.area,
      abiertas: Number(r.abiertas),
      en_revision: Number(r.en_revision),
      bloqueadas: Number(r.bloqueadas),
      sin_movimiento: Number(r.sin_movimiento),
    })));
  });
}
