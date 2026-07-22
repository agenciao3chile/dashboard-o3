import { create } from "zustand";

export type Section = "resumen" | "operacion" | "equipo" | "clientes" | "calidad";

export interface Filters {
  desde: string;
  hasta: string;
  persona: string;
  area: string;
  cliente: string;
  proyecto: string;
  estado: string;
}

const EMPTY: Filters = { desde: "", hasta: "", persona: "", area: "", cliente: "", proyecto: "", estado: "" };

interface Store {
  section: Section;
  filters: Filters;
  drawerClave: string | null;
  drawerTitle: string;
  setSection: (s: Section) => void;
  setFilter: (k: keyof Filters, v: string) => void;
  toggleFilter: (k: keyof Filters, v: string) => void;
  clearFilters: () => void;
  openDrawer: (clave: string, title: string) => void;
  closeDrawer: () => void;
}

export const useStore = create<Store>((set) => ({
  section: "resumen",
  filters: { ...EMPTY },
  drawerClave: null,
  drawerTitle: "",
  setSection: (section) => set({ section }),
  setFilter: (k, v) => set((s) => ({ filters: { ...s.filters, [k]: v } })),
  // Cross-filter: clic en un valor lo aplica; volver a clicar el mismo lo quita.
  toggleFilter: (k, v) =>
    set((s) => ({ filters: { ...s.filters, [k]: s.filters[k] === v ? "" : v } })),
  clearFilters: () => set({ filters: { ...EMPTY } }),
  openDrawer: (drawerClave, drawerTitle) => set({ drawerClave, drawerTitle }),
  closeDrawer: () => set({ drawerClave: null }),
}));

export const activeFilterCount = (f: Filters) => Object.values(f).filter(Boolean).length;
