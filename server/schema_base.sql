-- Esquema BASE — SOLO para el modo demo (pglite).
-- Es un espejo de lo que el agente de Telegram ya crea en producción
-- (tablas personas/reportes, tarea_key y las vistas base). En prod NO se aplica:
-- esas tablas y vistas ya existen; el dashboard solo agrega sql/analytics.sql.

CREATE TABLE IF NOT EXISTS personas (
    chat_id     TEXT        PRIMARY KEY,
    nombre      TEXT        NOT NULL,
    area        TEXT,
    activo      BOOLEAN     NOT NULL DEFAULT TRUE,
    reporta     BOOLEAN     NOT NULL DEFAULT TRUE,
    asigna      BOOLEAN     NOT NULL DEFAULT FALSE,
    tipo        TEXT        NOT NULL DEFAULT 'fijo',
    creado      TIMESTAMPTZ NOT NULL DEFAULT now(),
    actualizado TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS reportes (
    id                BIGSERIAL   PRIMARY KEY,
    persona_chat_id   TEXT        NOT NULL REFERENCES personas(chat_id),
    persona_nombre    TEXT        NOT NULL,
    area              TEXT,
    cliente           TEXT,
    proyecto          TEXT,
    tarea             TEXT        NOT NULL,
    estado            TEXT        NOT NULL DEFAULT 'en_progreso',
    entregado_a       TEXT,
    nota              TEXT,
    mensaje_original  TEXT,
    fecha             DATE        NOT NULL,
    creado            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION tarea_key(cliente TEXT, proyecto TEXT, tarea TEXT)
RETURNS TEXT AS $$
    SELECT lower(btrim(coalesce(cliente, ''))) || '|' ||
           lower(btrim(coalesce(proyecto, ''))) || '|' ||
           lower(btrim(coalesce(tarea, '')));
$$ LANGUAGE sql IMMUTABLE;

CREATE OR REPLACE VIEW estado_actual_tareas AS
SELECT DISTINCT ON (tarea_key(cliente, proyecto, tarea))
    tarea_key(cliente, proyecto, tarea) AS clave,
    cliente, proyecto, tarea, estado, entregado_a,
    persona_nombre AS ultimo_reporto,
    area,
    fecha          AS ultima_fecha,
    creado         AS ultimo_movimiento,
    id             AS ultimo_reporte_id
FROM reportes
ORDER BY tarea_key(cliente, proyecto, tarea), creado DESC, id DESC;

CREATE OR REPLACE VIEW tareas_pendientes AS
SELECT * FROM estado_actual_tareas WHERE estado NOT IN ('aprobado', 'entregado');

CREATE OR REPLACE VIEW pendientes_aprobacion AS
SELECT * FROM estado_actual_tareas WHERE estado = 'en_revision';

CREATE OR REPLACE VIEW tareas_por_estado AS
SELECT estado, COUNT(*) AS cantidad
FROM estado_actual_tareas GROUP BY estado ORDER BY cantidad DESC;

CREATE OR REPLACE VIEW carga_por_persona AS
SELECT ultimo_reporto AS persona, area,
       COUNT(*)                                       AS abiertas,
       COUNT(*) FILTER (WHERE estado = 'en_revision') AS en_revision,
       COUNT(*) FILTER (WHERE estado = 'bloqueado')   AS bloqueadas
FROM tareas_pendientes GROUP BY ultimo_reporto, area ORDER BY abiertas DESC;

CREATE OR REPLACE VIEW carga_por_cliente AS
SELECT coalesce(nullif(btrim(cliente), ''), '(sin cliente)') AS cliente,
       COUNT(*)                                       AS abiertas,
       COUNT(*) FILTER (WHERE estado = 'en_revision') AS en_revision,
       COUNT(*) FILTER (WHERE estado = 'bloqueado')   AS bloqueadas
FROM tareas_pendientes GROUP BY 1 ORDER BY abiertas DESC;

CREATE OR REPLACE VIEW entregas_semana AS
SELECT persona_nombre AS persona, area, cliente, proyecto, tarea,
       estado, entregado_a, fecha, creado
FROM reportes
WHERE estado IN ('aprobado', 'entregado')
  AND date_trunc('week', creado) = date_trunc('week', now())
ORDER BY creado DESC;
