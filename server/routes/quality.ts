import type { FastifyInstance } from "fastify";
import { rows } from "../db.ts";

export default async function qualityRoutes(app: FastifyInstance) {
  app.get("/api/quality", async () => {
    const [sinCliente] = await rows(
      `SELECT COUNT(*) AS reportes FROM reportes WHERE cliente IS NULL OR btrim(cliente) = ''`
    );
    const [tareasSinCliente] = await rows(
      `SELECT COUNT(*) AS n FROM estado_actual_tareas WHERE cliente IS NULL OR btrim(cliente) = ''`
    );
    const [tareasSinProyecto] = await rows(
      `SELECT COUNT(*) AS n FROM estado_actual_tareas WHERE proyecto IS NULL OR btrim(proyecto) = ''`
    );
    const [sinMov] = await rows(`SELECT COUNT(*) AS n FROM o3_task_aging WHERE dias_sin_mov >= 3`);

    // Clientes escritos con variantes: mismo texto normalizado, distintas grafías.
    const variantes = await rows(
      `SELECT lower(btrim(cliente)) AS normal,
              string_agg(DISTINCT cliente, ' | ' ORDER BY cliente) AS variantes,
              COUNT(*) AS reportes
       FROM reportes
       WHERE cliente IS NOT NULL AND btrim(cliente) <> ''
       GROUP BY lower(btrim(cliente))
       HAVING COUNT(DISTINCT cliente) > 1
       ORDER BY reportes DESC`
    );

    // Personas activas que deben reportar y no lo hacen hace ≥7 días.
    const inactivas = await rows(
      `SELECT p.nombre AS persona, p.area,
              to_char(MAX(r.fecha),'YYYY-MM-DD') AS ultimo_reporte
       FROM personas p
       LEFT JOIN reportes r ON r.persona_chat_id = p.chat_id
       WHERE p.activo AND p.reporta
       GROUP BY p.nombre, p.area
       HAVING MAX(r.fecha) IS NULL OR MAX(r.fecha) < now()::date - 6`
    );

    // Muestra para auditar interpretación: mensaje original vs dato estructurado.
    const muestra = await rows(
      `SELECT to_char(creado,'YYYY-MM-DD HH24:MI') AS momento,
              mensaje_original, cliente, proyecto, tarea, estado
       FROM reportes
       WHERE mensaje_original IS NOT NULL
       ORDER BY creado DESC LIMIT 12`
    );

    return {
      reportes_sin_cliente: Number(sinCliente.reportes),
      tareas_sin_cliente: Number(tareasSinCliente.n),
      tareas_sin_proyecto: Number(tareasSinProyecto.n),
      tareas_sin_movimiento: Number(sinMov.n),
      variantes_cliente: variantes.map((r) => ({
        normal: r.normal,
        variantes: r.variantes,
        reportes: Number(r.reportes),
      })),
      personas_inactivas: inactivas,
      muestra_interpretacion: muestra,
    };
  });
}
