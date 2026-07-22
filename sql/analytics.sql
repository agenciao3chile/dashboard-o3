-- Vistas analíticas del Panel O3 — construidas sobre las tablas del agente
-- (personas, reportes) y sus vistas base (estado_actual_tareas, tarea_key…).
-- Solo CREATE OR REPLACE VIEW: es idempotente y seguro de correr en producción
-- (no toca datos ni crea tablas). El modelo aprovecha que `reportes` es un log
-- append-only: cada fila es un movimiento con timestamp, así que las
-- transiciones de estado se derivan con window functions.

-- ─── Log de eventos con contexto de transición ────────────────────────────
-- Por cada movimiento: estado previo/siguiente y su timestamp, dentro de la
-- misma tarea (tarea_key). Base de ciclo, revisión y retrabajo.
CREATE OR REPLACE VIEW o3_task_events AS
SELECT
    id,
    tarea_key(cliente, proyecto, tarea)               AS clave,
    persona_chat_id,
    persona_nombre,
    area,
    cliente,
    proyecto,
    tarea,
    estado,
    entregado_a,
    nota,
    fecha,
    creado,
    LAG(estado)  OVER w  AS estado_prev,
    LEAD(estado) OVER w  AS estado_next,
    LAG(creado)  OVER w  AS creado_prev,
    LEAD(creado) OVER w  AS creado_next,
    ROW_NUMBER() OVER w  AS mov_num
FROM reportes
WINDOW w AS (PARTITION BY tarea_key(cliente, proyecto, tarea) ORDER BY creado, id);

-- ─── Primer avistamiento de cada tarea ────────────────────────────────────
CREATE OR REPLACE VIEW o3_task_first_seen AS
SELECT clave,
       MIN(creado) AS primer_reporte,
       MIN(fecha)  AS primera_fecha
FROM o3_task_events
GROUP BY clave;

-- ─── Primer estado terminal por tarea (terminada UNA sola vez) ────────────
-- Cuenta la tarea como terminada la primera vez que llega a aprobado/entregado,
-- aunque después registre otro terminal.
CREATE OR REPLACE VIEW o3_task_terminal AS
SELECT clave,
       MIN(creado) AS terminado_en,
       MIN(fecha)  AS terminado_fecha
FROM o3_task_events
WHERE estado IN ('aprobado', 'entregado')
GROUP BY clave;

-- ─── Tiempo de ciclo por tarea (primer reporte → primer terminal) ─────────
CREATE OR REPLACE VIEW o3_cycle_time AS
SELECT f.clave,
       f.primer_reporte,
       t.terminado_en,
       EXTRACT(EPOCH FROM (t.terminado_en - f.primer_reporte)) / 86400.0 AS dias_ciclo
FROM o3_task_first_seen f
JOIN o3_task_terminal t USING (clave);

-- ─── Tramos en revisión ───────────────────────────────────────────────────
-- Cada vez que una tarea entra en `en_revision`: cuánto tardó en salir y a qué
-- estado. Si aún no salió, en_curso = true y se mide hasta ahora.
CREATE OR REPLACE VIEW o3_review_spans AS
SELECT clave, cliente, proyecto, tarea, area, persona_nombre,
       creado                                   AS entro_revision,
       estado_next                              AS salio_a,
       creado_next                              AS salio_en,
       EXTRACT(EPOCH FROM (COALESCE(creado_next, now()) - creado)) / 86400.0 AS dias_en_revision,
       (creado_next IS NULL)                    AS en_curso
FROM o3_task_events
WHERE estado = 'en_revision';

-- ─── Señales de retrabajo ─────────────────────────────────────────────────
-- Devoluciones: de revisión a progreso, o de un estado terminal de vuelta a
-- uno abierto. El sistema no registra la causa; son señales, no culpas.
CREATE OR REPLACE VIEW o3_rework_events AS
SELECT clave, cliente, proyecto, tarea, area, persona_nombre, creado,
       estado_prev, estado
FROM o3_task_events
WHERE (estado_prev = 'en_revision' AND estado = 'en_progreso')
   OR (estado_prev IN ('aprobado', 'entregado')
       AND estado IN ('pendiente', 'en_progreso', 'en_revision', 'bloqueado'));

-- ─── Antigüedad de tareas abiertas (días corridos sin movimiento) ─────────
CREATE OR REPLACE VIEW o3_task_aging AS
SELECT clave, cliente, proyecto, tarea, estado, entregado_a,
       ultimo_reporto, area, ultima_fecha, ultimo_movimiento,
       EXTRACT(EPOCH FROM (now() - ultimo_movimiento)) / 86400.0 AS dias_sin_mov
FROM estado_actual_tareas
WHERE estado NOT IN ('aprobado', 'entregado');

-- ─── Flujo semanal (entradas y cierres por semana ISO) ────────────────────
CREATE OR REPLACE VIEW o3_weekly_flow AS
WITH mov AS (
    SELECT date_trunc('week', creado)::date AS semana, COUNT(DISTINCT clave) AS con_movimiento
    FROM o3_task_events GROUP BY 1
),
term AS (
    SELECT date_trunc('week', terminado_en)::date AS semana, COUNT(*) AS terminadas
    FROM o3_task_terminal GROUP BY 1
),
nuevas AS (
    SELECT date_trunc('week', primer_reporte)::date AS semana, COUNT(*) AS nuevas
    FROM o3_task_first_seen GROUP BY 1
),
bloq AS (
    SELECT date_trunc('week', creado)::date AS semana, COUNT(DISTINCT clave) AS bloqueadas
    FROM o3_task_events WHERE estado = 'bloqueado' GROUP BY 1
),
semanas AS (
    SELECT semana FROM mov
    UNION SELECT semana FROM term
    UNION SELECT semana FROM nuevas
    UNION SELECT semana FROM bloq
)
SELECT s.semana,
       COALESCE(mov.con_movimiento, 0) AS con_movimiento,
       COALESCE(term.terminadas, 0)    AS terminadas,
       COALESCE(nuevas.nuevas, 0)      AS nuevas,
       COALESCE(bloq.bloqueadas, 0)    AS bloqueadas
FROM semanas s
LEFT JOIN mov    USING (semana)
LEFT JOIN term   USING (semana)
LEFT JOIN nuevas USING (semana)
LEFT JOIN bloq   USING (semana)
ORDER BY s.semana;
