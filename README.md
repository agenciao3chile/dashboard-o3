# Panel de Gestión O3

Dashboard ejecutivo y operativo para **Agencia O3**, sobre la base Postgres que
alimenta el [agente de Telegram](https://github.com/agenciao3chile/agente-o3). El
equipo reporta avances en lenguaje natural; el agente los estructura
(`cliente · proyecto · tarea · estado`) y este panel los convierte en una
herramienta de gestión para dirección.

No es un sistema de vigilancia individual: mide **actividad, avance, carga y
resultados** por separado, y evita presentar la participación como productividad.

## Secciones

1. **Resumen ejecutivo** — KPIs (abiertas, terminadas, en revisión, bloqueadas,
   sin movimiento, participación), distribución por estado, evolución semanal,
   alertas e insights en lenguaje natural.
2. **Operación y flujo** — embudo, antigüedad (aging), tiempo de ciclo, tiempo en
   revisión, señales de retrabajo y tabla operativa con drill-down al historial.
3. **Equipo y carga** — carga por persona (no un ranking), consistencia de
   reporte y vista por área.
4. **Clientes y proyectos** — ranking, concentración operacional, ficha de
   cliente y matriz de proyectos.
5. **Calidad de datos** — reportes sin cliente, clientes con variantes, personas
   sin registro y auditoría de interpretación.

Filtros globales (fecha, persona, área, cliente, proyecto, estado) que persisten
entre secciones, cross-filter al hacer clic en gráficos y export CSV.

## Stack

- **Frontend**: React + Vite + Recharts (un SPA).
- **Backend**: Fastify (Node + TypeScript, corrido con `tsx`). Sirve el bundle y
  las rutas `/api`.
- **Datos**: Postgres real en producción; **Postgres embebido (pglite) con datos
  sintéticos** en modo demo. El **mismo SQL** corre en ambos.

## Desarrollo local (modo demo)

Sin base de datos ni configuración: arranca con datos sintéticos.

```bash
npm install
npm run dev      # API en :3001 + Vite en :5173 → abrir http://localhost:5173
```

Si `DATABASE_URL` está vacío, el panel entra en **modo demo** (badge visible) con
~12 semanas de reportes simulados. Ideal para ver la UI sin tocar la base real.

Otros comandos: `npm run build` (genera `dist/`), `npm run typecheck`.

## Deploy en EasyPanel (producción)

Mismo patrón que el agente: servicio nuevo desde este repo, build por Dockerfile.

1. **Usuario read-only de Postgres**: ejecutá `sql/readonly-user.sql` una vez en
   la base `apps` (ajustá la clave). Aplicá también `sql/analytics.sql` una vez
   con un usuario con permisos (crea las vistas `o3_*`).
2. **Servicio App** `dashboard-o3` desde este repo (Git), build por Dockerfile.
3. **Variables de entorno**:
   - `DATABASE_URL` — `postgres://o3_dashboard_ro:CLAVE@apps_db-agenteo3:5432/apps`
   - `TZ` — `America/Santiago`
   - `PORT` — `3001` (exponelo en EasyPanel)
   - `DASHBOARD_PASSWORD` — clave compartida de dirección (vacío = sin login)
   - Opcional `OPENAI_API_KEY` para pulir los insights con LLM.
4. **Cero tiempo de inactividad = APAGADO** (como el agente) y **réplicas = 1**.
5. Deploy. El server aplica `sql/analytics.sql` al arrancar; si el usuario es
   read-only, lo omite y asume que las vistas ya existen (por eso el paso 1).

> Sin `DATABASE_URL`, en producción arrancaría en modo demo. Asegurate de
> configurarla.

## Metodología de las métricas (reglas)

- Las tareas se cuentan con `COUNT(DISTINCT tarea_key(...))`, **no** por cantidad
  de mensajes. Un reporte es un movimiento, no una tarea terminada.
- **Terminada = primera vez** que la tarea llega a `aprobado`/`entregado` (una
  sola vez, aunque después registre otro terminal).
- **Estados abiertos**: pendiente, en_progreso, en_revision, bloqueado.
  **Terminales**: aprobado, entregado.
- El responsable visible es el **"Último responsable registrado"** (quien reportó
  al último), **no** una asignación oficial.
- Antigüedad = **días corridos** sin movimiento (aún no hay días hábiles reales).
- Cliente vacío se agrupa como **"(sin cliente)"**.
- **No** se calculan horas, rentabilidad, cumplimiento de fechas ni capacidad:
  esos datos no existen todavía.

## Nota sobre datos

Las métricas de **flujo** (ciclo, revisión, retrabajo, evolución semanal)
necesitan historia acumulada: con el agente recién en producción estarán vacías
o ralas durante las primeras semanas y se llenan solas a medida que el equipo
reporta. Las métricas de **estado** (abiertas, bloqueadas, carga, calidad de
datos) son útiles desde el día 1.

## Estructura

```
server/          API Fastify + capa de datos (pg | pglite) + seed demo
  routes/        metrics, tasks, team, clients, quality, insights
  db.ts          abstracción de datos con reconexión de pool
  schema_base.sql  espejo del esquema del agente (solo demo)
sql/
  analytics.sql    vistas o3_* (flujo) — idempotente, se aplica en prod y demo
  readonly-user.sql  creación del usuario read-only
src/             frontend React (páginas, componentes, store de filtros)
```
