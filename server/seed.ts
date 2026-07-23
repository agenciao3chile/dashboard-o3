/**
 * Datos sintéticos para el MODO DEMO. Simula ~12 semanas de reportes con
 * ciclos de vida realistas (avances, revisiones, retrabajo, bloqueos, entregas)
 * e incluye "ruido" a propósito (clientes con variantes, tareas sin cliente)
 * para que la sección de Calidad de Datos tenga qué mostrar.
 * Determinista (PRNG con semilla) para que la demo sea estable entre reinicios.
 */
interface DemoDb {
  query(sql: string, params?: any[]): Promise<{ rows: any[] }>;
  exec(sql: string): Promise<void>;
}

// ── PRNG determinista (mulberry32) ────────────────────────────────────────
function makeRng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = makeRng(42);
const pick = <T>(a: T[]): T => a[Math.floor(rnd() * a.length)];
const int = (min: number, max: number) => min + Math.floor(rnd() * (max - min + 1));
const chance = (p: number) => rnd() < p;

const DAY = 86_400_000;
const NOW = Date.now();

// fecha "hábil" (America/Santiago ≈ UTC-4) a partir de un timestamp.
function fechaDe(ms: number): string {
  return new Date(ms - 4 * 3600_000).toISOString().slice(0, 10);
}
function iso(ms: number): string {
  return new Date(ms).toISOString();
}

const PERSONAS = [
  { chat_id: "8920381767", nombre: "Dante Torres", area: "Dirección Creativa", reporta: false, tipo: "fijo" },
  { chat_id: "8947760744", nombre: "Francisca Troncoso", area: "Administración", reporta: true, tipo: "fijo" },
  { chat_id: "6231570634", nombre: "Gonzalo Poblete", area: "Audiovisual", reporta: true, tipo: "fijo" },
  { chat_id: "8444580851", nombre: "Debonne Jiménez", area: "Audiovisual", reporta: true, tipo: "freelance" },
  { chat_id: "5809796354", nombre: "Patricio González", area: "Diseño", reporta: true, tipo: "fijo" },
  { chat_id: "6541091356", nombre: "María José Muñoz", area: "Meta Ads", reporta: true, tipo: "fijo" },
  { chat_id: "7100000001", nombre: "Rodrigo Argote", area: "Dirección de Arte", reporta: true, tipo: "fijo" },
  { chat_id: "7100000002", nombre: "Daniel Vega", area: "Audiovisual", reporta: true, tipo: "freelance" },
  { chat_id: "7100000003", nombre: "Robinson Retamal", area: "Ventas", reporta: true, tipo: "fijo" },
];
const REPORTAN = PERSONAS.filter((p) => p.reporta);

// Clientes con variantes intencionales (para Calidad de Datos) y "" = sin cliente.
const CLIENTES = [
  "Oriencoop", "Oriencoop", "Oriencoop", "oriencoop ", "Orien coop",
  "Ferval", "Ferval", "Coopeuch", "Coopeuch", "Cranco",
  "Municipalidad de Maipú", "Viña Santa Ema", "", "", "Ferval ",
];
const PROYECTOS = ["Redes", "Campaña Julio", "Branding", "Video Institucional", "Landing", "Pauta Meta"];
const TAREAS = [
  "Reel Instagram", "Post carrusel", "Video corporativo", "Diseño flyer",
  "Guion campaña", "Edición video", "Pauta Meta Ads", "Informe de resultados",
  "Banner web", "Historia destacada", "Sesión de fotos", "Motion graphics",
];
const NOTAS = [
  null, null, null, "Falta aprobación del cliente", "Pendiente material del cliente",
  "Ajustes menores de color", "Esperando brief", "Urgente para el viernes",
];

const ESTADOS_ABIERTOS = ["pendiente", "en_progreso", "en_revision", "bloqueado"];

type Mov = { estado: string; ms: number; entregado_a: string | null; nota: string | null };

// Genera la secuencia de movimientos de una tarea según un arquetipo.
function timeline(startMs: number): Mov[] {
  const movs: Mov[] = [];
  let t = startMs;
  const push = (estado: string, gapDays: number, extra: Partial<Mov> = {}) => {
    t += gapDays * DAY;
    if (t > NOW) return false;
    movs.push({ estado, ms: t, entregado_a: extra.entregado_a ?? null, nota: extra.nota ?? null });
    return true;
  };
  const arquetipo = rnd();

  push("pendiente", int(0, 1) * 0.3);
  if (arquetipo < 0.1) return movs; // queda en pendiente (posiblemente antigua)

  if (!push("en_progreso", int(1, 4) * 0.7)) return movs;

  if (arquetipo < 0.28) return movs; // sigue en progreso

  if (arquetipo < 0.4) {
    // se bloquea y queda trabada
    push("bloqueado", int(1, 3), { nota: pick(NOTAS.filter(Boolean) as string[]) });
    return movs;
  }

  if (!push("en_revision", int(1, 4))) return movs;

  if (arquetipo < 0.55) return movs; // queda en revisión (a veces mucho tiempo)

  // retrabajo: vuelve a progreso y de nuevo a revisión
  if (arquetipo < 0.72) {
    if (!push("en_progreso", int(1, 3), { nota: "Devuelto con correcciones" })) return movs;
    if (!push("en_revision", int(1, 3))) return movs;
  }

  if (!push("aprobado", int(1, 3))) return movs;

  // la mayoría termina entregada
  if (chance(0.75)) {
    push("entregado", int(0, 2), { entregado_a: pick(["Cliente", "María José", "Dante", "Francisca"]) });
  }

  // reapertura ocasional (señal de retrabajo post-aprobación)
  if (chance(0.08)) {
    push("en_progreso", int(1, 4), { nota: "Reabierto: cambios del cliente" });
  }
  return movs;
}

export async function seedDemo(db: DemoDb): Promise<void> {
  for (const p of PERSONAS) {
    await db.query(
      `INSERT INTO personas (chat_id, nombre, area, activo, reporta, tipo)
       VALUES ($1,$2,$3,TRUE,$4,$5) ON CONFLICT (chat_id) DO NOTHING`,
      [p.chat_id, p.nombre, p.area, p.reporta, p.tipo]
    );
  }

  const TAREAS_TOTAL = 75;
  for (let i = 0; i < TAREAS_TOTAL; i++) {
    const persona = pick(REPORTAN);
    const cliente = pick(CLIENTES);
    const proyecto = chance(0.85) ? pick(PROYECTOS) : "";
    const tarea = `${pick(TAREAS)}${chance(0.4) ? " " + int(1, 4) : ""}`;
    const startMs = NOW - int(1, 82) * DAY;
    const movs = timeline(startMs);
    if (movs.length === 0) continue;

    for (const m of movs) {
      // el 15% de los movimientos los reporta otra persona (colaboración)
      const quien = chance(0.15) ? pick(REPORTAN) : persona;
      const original =
        m.nota && chance(0.5)
          ? `${tarea.toLowerCase()} ${m.estado} — ${m.nota}`
          : `${tarea} ${m.estado.replace("_", " ")}`;
      await db.query(
        `INSERT INTO reportes
           (persona_chat_id, persona_nombre, area, cliente, proyecto, tarea,
            estado, entregado_a, nota, mensaje_original, fecha, creado)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [
          quien.chat_id, quien.nombre, quien.area,
          cliente || null, proyecto || null, tarea,
          m.estado, m.entregado_a, m.nota, original,
          fechaDe(m.ms), iso(m.ms),
        ]
      );
    }
  }
}
