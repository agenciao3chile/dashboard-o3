import { useEffect, useState } from "react";
import { useStore, activeFilterCount, type Section } from "../store";
import { useApi, estadoLabel, estadoColor } from "../lib";
import { api } from "../api";

const NAV: { key: Section; label: string; ico: string }[] = [
  { key: "resumen", label: "Resumen", ico: "▦" },
  { key: "operacion", label: "Operación", ico: "⇄" },
  { key: "equipo", label: "Equipo", ico: "◑" },
  { key: "clientes", label: "Clientes", ico: "◇" },
  { key: "calidad", label: "Calidad de datos", ico: "✓" },
];

export const SECTION_TITLE: Record<Section, { h1: string; sub: string }> = {
  resumen: { h1: "Resumen ejecutivo", sub: "Estado real de la agencia, orientado a decisiones" },
  operacion: { h1: "Operación y flujo", sub: "Embudo, antigüedad, revisión, bloqueos y retrabajo" },
  equipo: { h1: "Equipo y carga", sub: "Capacidad y distribución del trabajo (no es un ranking)" },
  clientes: { h1: "Clientes y proyectos", sub: "Carga, concentración y avance registrado" },
  calidad: { h1: "Calidad de datos", sub: "Confiabilidad de los análisis y seguimiento" },
};

export function Sidebar() {
  const { section, setSection } = useStore();
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="logo">O3</div>
        <div>
          <b>Panel de Gestión</b>
          <span>Agencia O3</span>
        </div>
      </div>
      {NAV.map((n) => (
        <button
          key={n.key}
          className={`nav-item ${section === n.key ? "active" : ""}`}
          onClick={() => setSection(n.key)}
        >
          <span className="ico">{n.ico}</span>
          {n.label}
        </button>
      ))}
      <div className="nav-foot">
        Los datos provienen de los reportes del agente de Telegram. Reflejan actividad y avance,
        no horas ni cumplimiento de fechas.
      </div>
    </aside>
  );
}

export function Header({ demo }: { demo: boolean }) {
  const section = useStore((s) => s.section);
  const t = SECTION_TITLE[section];
  const now = new Date().toLocaleString("es-CL", { dateStyle: "medium", timeStyle: "short" });
  return (
    <header className="header">
      <div className="title">
        <h1>{t.h1}</h1>
        <div className="sub">{t.sub}</div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span className="sub" style={{ fontSize: 12, color: "var(--text-3)" }}>
          Actualizado: {now}
        </span>
        {demo && <span className="demo-pill">Modo demo · datos sintéticos</span>}
      </div>
    </header>
  );
}

interface Options {
  personas: string[];
  areas: string[];
  clientes: string[];
  proyectos: string[];
  estados: string[];
}

export function FilterBar() {
  const { filters, setFilter, clearFilters } = useStore();
  const { data: opt } = useApi<Options>("/api/filters/options");
  const count = activeFilterCount(filters);

  const Sel = ({ k, label, items }: { k: keyof typeof filters; label: string; items?: string[] }) => (
    <div className="fx">
      <label>{label}</label>
      <select value={filters[k]} onChange={(e) => setFilter(k, e.target.value)}>
        <option value="">Todos</option>
        {(items ?? []).map((v) => (
          <option key={v} value={v}>
            {k === "estado" ? estadoLabel(v) : v}
          </option>
        ))}
      </select>
    </div>
  );

  return (
    <div className="filterbar">
      <div className="fx">
        <label>Desde</label>
        <input type="date" value={filters.desde} onChange={(e) => setFilter("desde", e.target.value)} />
      </div>
      <div className="fx">
        <label>Hasta</label>
        <input type="date" value={filters.hasta} onChange={(e) => setFilter("hasta", e.target.value)} />
      </div>
      <Sel k="persona" label="Persona" items={opt?.personas} />
      <Sel k="area" label="Área" items={opt?.areas} />
      <Sel k="cliente" label="Cliente" items={opt?.clientes} />
      <Sel k="proyecto" label="Proyecto" items={opt?.proyectos} />
      <Sel k="estado" label="Estado" items={opt?.estados} />
      <button className="clear" onClick={clearFilters} disabled={!count}>
        Limpiar filtros{count ? ` (${count})` : ""}
      </button>
    </div>
  );
}

interface Mov {
  momento: string;
  estado: string;
  persona_nombre: string;
  entregado_a: string | null;
  nota: string | null;
  mensaje_original: string | null;
}

export function TaskDrawer() {
  const { drawerClave, drawerTitle, closeDrawer } = useStore();
  const [movs, setMovs] = useState<Mov[] | null>(null);

  useEffect(() => {
    if (!drawerClave) return;
    setMovs(null);
    api<Mov[]>(`/api/tasks/history?clave=${encodeURIComponent(drawerClave)}`)
      .then(setMovs)
      .catch(() => setMovs([]));
  }, [drawerClave]);

  if (!drawerClave) return null;
  return (
    <>
      <div className="drawer-scrim" onClick={closeDrawer} />
      <div className="drawer">
        <div className="d-head">
          <button className="close" onClick={closeDrawer}>
            ×
          </button>
          <div className="card-sub" style={{ marginBottom: 4 }}>Historial de la tarea</div>
          <h3 style={{ fontSize: 15, paddingRight: 24 }}>{drawerTitle}</h3>
        </div>
        <div className="d-body">
          {movs == null ? (
            <div className="empty">Cargando…</div>
          ) : movs.length === 0 ? (
            <div className="empty">Sin movimientos.</div>
          ) : (
            <ul className="timeline">
              {movs.map((m, i) => (
                <li key={i}>
                  <span className="tdot" style={{ background: estadoColor(m.estado) }} />
                  <div>
                    <b>{estadoLabel(m.estado)}</b>{" "}
                    {m.entregado_a && <span className="muted">→ {m.entregado_a}</span>}
                  </div>
                  <div className="tmeta">
                    {m.momento} · {m.persona_nombre}
                  </div>
                  {m.nota && <div className="tmeta">Nota: {m.nota}</div>}
                  {m.mensaje_original && <div className="torig">“{m.mensaje_original}”</div>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}
