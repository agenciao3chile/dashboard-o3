/**
 * Capa de datos. Un mismo `query()` sirve a dos backends:
 *   - PRODUCCIÓN: Postgres real (node-postgres) si hay DATABASE_URL.
 *   - DEMO:       Postgres embebido (pglite) con datos sintéticos, si no la hay.
 * El SQL es idéntico en ambos, así que lo que se ve en demo es lo que se verá
 * en producción.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { PGlite } from "@electric-sql/pglite";
import { seedDemo } from "./seed.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const TZ = process.env.TZ || "America/Santiago";

export type Row = Record<string, any>;
export interface QueryResult {
  rows: Row[];
}

interface Backend {
  query(sql: string, params?: any[]): Promise<QueryResult>;
  exec(sql: string): Promise<void>;
}

let backend: Backend | null = null;
export let DEMO_MODE = false;

function readSql(rel: string): string {
  // sql/ vive en la raíz del repo; server/ es hermano.
  return readFileSync(join(__dirname, "..", rel), "utf8");
}

async function makePgBackend(connectionString?: string): Promise<Backend> {
  // Con connectionString usa la URL; sin ella, node-postgres lee las variables
  // sueltas PGHOST/PGPORT/PGUSER/PGPASSWORD/PGDATABASE (evita URL-encoding).
  const pool = new pg.Pool(connectionString ? { connectionString, max: 6 } : { max: 6 });
  // Fija la zona horaria de cada conexión nueva.
  pool.on("connect", (client) => {
    client.query(`SET TIME ZONE '${TZ}'`).catch(() => {});
  });
  return {
    query: (sql, params) => pool.query(sql, params),
    exec: async (sql) => {
      await pool.query(sql);
    },
  };
}

async function makePgliteBackend(): Promise<Backend> {
  const db = new PGlite();
  await db.exec(`SET TIME ZONE '${TZ}';`);
  return {
    query: (sql, params) => db.query(sql, params) as Promise<QueryResult>,
    exec: async (sql) => {
      await db.exec(sql);
    },
  };
}

/** Inicializa el backend según el entorno y aplica las vistas analíticas. */
export async function initDb(): Promise<void> {
  const url = (process.env.DATABASE_URL || "").trim();
  // También se acepta configuración por variables sueltas (PGHOST/PGDATABASE…),
  // que node-postgres lee automáticamente. Útil para copiar las credenciales del
  // agente sin armar la URL ni encodear caracteres especiales de la clave.
  const hasPgVars = !!(process.env.PGHOST || process.env.PGDATABASE);
  if (url || hasPgVars) {
    backend = await makePgBackend(url || undefined);
    DEMO_MODE = false;
    // En prod las tablas/vistas base ya existen (las crea el agente); solo
    // agregamos las vistas analíticas (idempotente). Si el usuario es read-only
    // no podrá crearlas: se asume que ya fueron aplicadas por un admin.
    try {
      await backend.exec(readSql("sql/analytics.sql"));
      console.log("[dashboard-o3] vistas analíticas aplicadas.");
    } catch (e) {
      console.warn(
        "[dashboard-o3] no se pudieron crear las vistas analíticas (¿usuario read-only?). " +
          "Asumo que ya existen. Aplicá sql/analytics.sql con un usuario con permisos si faltan. Detalle:",
        (e as Error).message
      );
    }
    return;
  }

  // Modo demo: Postgres embebido + esquema base + datos sintéticos + vistas.
  backend = await makePgliteBackend();
  DEMO_MODE = true;
  await backend.exec(readSql("server/schema_base.sql"));
  await seedDemo(backend);
  await backend.exec(readSql("sql/analytics.sql"));
}

export function query(sql: string, params?: any[]): Promise<QueryResult> {
  if (!backend) throw new Error("DB no inicializada (llamá initDb() primero).");
  return backend.query(sql, params);
}

export async function rows(sql: string, params?: any[]): Promise<Row[]> {
  return (await query(sql, params)).rows;
}
