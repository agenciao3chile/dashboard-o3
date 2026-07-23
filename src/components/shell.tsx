import { useEffect, useState } from "react";
import { useStore, activeFilterCount, type Section } from "../store";
import { useApi, estadoLabel, estadoColor } from "../lib";
import { api } from "../api";
import { Icon } from "./icons";

const NAV_GROUPS: { label: string; items: { key: Section; label: string; icon: string }[] }[] = [
  {
    label: "Gestión",
    items: [
      { key: "resumen", label: "Resumen", icon: "resumen" },
      { key: "operacion", label: "Operación", icon: "operacion" },
      { key: "equipo", label: "Equipo", icon: "equipo" },
      { key: "clientes", label: "Clientes", icon: "clientes" },
    ],
  },
  {
    label: "Datos",
    items: [{ key: "calidad", label: "Calidad de datos", icon: "calidad" }],
  },
];

export const SECTION_TITLE: Record<Section, { h1: string; sub: string; crumb: string }> = {
  resumen: { h1: "Resumen ejecutivo", sub: "Estado real de la agencia, orientado a decisiones", crumb: "Resumen" },
  operacion: { h1: "Operación y flujo", sub: "Embudo, antigüedad, revisión, bloqueos y retrabajo", crumb: "Operación" },
  equipo: { h1: "Equipo y carga", sub: "Capacidad y distribución del trabajo (no es un ranking)", crumb: "Equipo" },
  clientes: { h1: "Clientes y proyectos", sub: "Carga, concentración y avance registrado", crumb: "Clientes" },
  calidad: { h1: "Calidad de datos", sub: "Confiabilidad de los análisis y seguimiento", crumb: "Calidad de datos" },
};

export function O3Logo({ className = "logo" }: { className?: string }) {
  return (
    <span className={className}>
      <svg viewBox="0 0 2394.16 2096.32" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="O3">
        <path fill="currentColor" d="M911.01,254.86c-245.86,0-459.08,91.67-639.67,275.02C90.74,713.23.3,928.77,0,1176.49c0,247.5,90.45,462.69,271.34,645.6,180.89,182.9,394.12,274.32,639.67,274.24,245.86,0,459.12-91.41,639.79-274.24,180.67-182.83,271.11-398.03,271.34-645.6,0-247.64-90.45-463.18-271.34-646.6-180.89-183.42-394.15-275.1-639.79-275.02ZM1295.44,1594.55c-107.95,113.84-236.1,170.8-384.43,170.87-148.33.07-276.74-56.88-385.21-170.87-108.47-113.69-162.75-253.05-162.82-418.07-.07-165.02,54.2-304.41,162.82-418.18,108.47-113.91,236.88-170.83,385.21-170.76,148.33.07,276.48,56.99,384.43,170.76,107.51,113.91,161.45,253.31,161.82,418.18.37,164.87-53.57,304.23-161.82,418.07ZM2354.07,438.69c-30.21-33.32-70.26-56.14-114.32-65.15v-2.35c35.55-11.26,67.73-31.19,93.65-58,24.59-25.93,36.88-60.72,36.88-104.38.5-29.97-5.8-59.66-18.44-86.83-12.35-25.6-30.48-47.99-52.97-65.38-24.61-18.9-52.49-33.1-82.25-41.91-35.13-10.24-71.59-15.17-108.18-14.64-40.05-.77-79.92,5.51-117.79,18.55-31.89,11.24-61.13,28.88-85.94,51.85-23.52,22.45-41.79,49.81-53.53,80.13-12.69,33.35-19.68,68.6-20.67,104.27h145.28c-.06-36.05,12.16-71.05,34.64-99.24,21.61-25.55,54.35-38.33,98.23-38.33,28.98-1.55,57.4,8.36,79.12,27.6,19.74,19.38,30.31,46.24,29.06,73.87,1.76,29.54-11.21,58.03-34.64,76.1-25.95,18.69-57.45,28.07-89.4,26.6h-43.81v116.11h46.94c46.79,0,81.91,10.5,105.38,31.51,24.19,22.65,37.09,54.86,35.2,87.95,0,39.93-11.92,70.78-35.76,92.53-23.84,21.75-56.92,32.67-99.24,32.74-22.86.6-45.62-3.2-67.05-11.18-17.65-6.86-33.38-17.9-45.82-32.18-12.22-14.54-21.35-31.43-26.82-49.62-6.23-20.72-9.99-42.1-11.18-63.7h-145.28c.18,39.23,7.14,78.13,20.56,114.99,12.2,33.37,31.66,63.6,56.99,88.51,26.7,25.32,58.69,44.4,93.65,55.88,41.91,13.83,85.85,20.48,129.97,19.67,37.75.28,75.35-4.65,111.75-14.64,33-8.76,64.04-23.66,91.53-43.92,26.11-19.69,47.3-45.17,61.91-74.43,15.63-32.72,23.29-68.68,22.35-104.94.89-53.79-12.44-96.48-40.01-128.07Z"/>
      </svg>
    </span>
  );
}

export function Sidebar() {
  const { section, setSection } = useStore();
  return (
    <aside className="sidebar">
      <div className="brand-logo"><O3Logo /></div>

      <nav className="side-nav">
        {NAV_GROUPS.map((g) => (
          <div className="nav-group" key={g.label}>
            <div className="nav-label">{g.label}</div>
            {g.items.map((n) => (
              <button
                key={n.key}
                className={`nav-item ${section === n.key ? "active" : ""}`}
                onClick={() => setSection(n.key)}
              >
                <span className="ico"><Icon name={n.icon} /></span>
                <span className="nav-text">{n.label}</span>
                {section === n.key && <span className="nav-active-dot" />}
              </button>
            ))}
          </div>
        ))}
      </nav>
    </aside>
  );
}

export function Header({ demo, onLogout }: { demo: boolean; onLogout?: () => void }) {
  const section = useStore((s) => s.section);
  const t = SECTION_TITLE[section];
  const now = new Date().toLocaleString("es-CL", { dateStyle: "medium", timeStyle: "short" });
  return (
    <header className="header">
      <div className="header-topline">
        <div className="breadcrumb">
          <span><Icon name="panel" size={16} /></span>
          <b>Panel de gestión</b>
          <i>/</i>
          <span className="crumb-now">{t.crumb}</span>
        </div>
        <div className="header-actions">
          <div className="header-meta">
            <span className="updated">Actualizado {now}</span>
            <span className={`live ${demo ? "demo" : ""}`}>
              <i />
              {demo ? "Modo demo · datos sintéticos" : "En vivo · Producción"}
            </span>
          </div>
          {onLogout && (
            <button className="icon-button" title="Salir" aria-label="Salir" onClick={onLogout}>
              <Icon name="logout" />
            </button>
          )}
        </div>
      </div>
      <div className="header-title-row">
        <div className="title">
          <h1>{t.h1}</h1>
          <div className="sub">{t.sub}</div>
        </div>
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
      <div className="filterbar-heading">
        <span className="filter-icon"><Icon name="filter" size={16} /></span>
        <div>
          <b>Filtros</b>
          <small>Afectan todo el panel</small>
        </div>
      </div>
      <div className="filter-fields">
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
        <div className="fx">
          <label>Tipo</label>
          <select value={filters.tipo} onChange={(e) => setFilter("tipo", e.target.value)}>
            <option value="">Todos</option>
            <option value="fijo">Fijo</option>
            <option value="freelance">Freelance</option>
          </select>
        </div>
      </div>
      <button className="clear" onClick={clearFilters} disabled={!count}>
        Limpiar{count ? ` (${count})` : ""}
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
          <button className="close" onClick={closeDrawer} aria-label="Cerrar">×</button>
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
                  <div className="tmeta">{m.momento} · {m.persona_nombre}</div>
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
