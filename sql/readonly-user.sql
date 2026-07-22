-- Usuario Postgres de SOLO LECTURA para el dashboard.
-- Ejecutar UNA vez como superusuario (o el dueño de la base) en la base del
-- agente (en EasyPanel la base se llama `apps`). Reemplazá la clave.
--
-- Orden recomendado:
--   1) Crear el usuario (este archivo).
--   2) Aplicar sql/analytics.sql UNA vez con un usuario con permisos de CREATE
--      (crea las vistas o3_*). El dashboard también intenta crearlas al arrancar,
--      pero el usuario read-only no puede: por eso conviene hacerlo antes.
--   3) Dar SELECT sobre todo (incluye las vistas o3_*), abajo.

CREATE USER o3_dashboard_ro WITH PASSWORD 'CAMBIA-ESTA-CLAVE';

GRANT CONNECT ON DATABASE apps TO o3_dashboard_ro;
GRANT USAGE ON SCHEMA public TO o3_dashboard_ro;

-- SELECT sobre tablas y vistas existentes (incluye estado_actual_tareas, o3_*).
GRANT SELECT ON ALL TABLES IN SCHEMA public TO o3_dashboard_ro;

-- Y sobre lo que se cree a futuro (nuevas vistas del agente o del dashboard).
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO o3_dashboard_ro;

-- Cadena de conexión resultante para DATABASE_URL (host interno de EasyPanel):
--   postgres://o3_dashboard_ro:CAMBIA-ESTA-CLAVE@apps_db-agenteo3:5432/apps
