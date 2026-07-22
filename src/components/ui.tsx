import type { CSSProperties, ReactNode } from "react";
import { estadoColor, estadoLabel, nfmt } from "../lib";

export function Card({ children, className = "", style }: { children: ReactNode; className?: string; style?: CSSProperties }) {
  return <div className={`card ${className}`} style={style}>{children}</div>;
}

export function CardHead({ title, sub, right }: { title: string; sub?: string; right?: ReactNode }) {
  return (
    <div className="card-head">
      <div>
        <h3>{title}</h3>
        {sub && <div className="card-sub">{sub}</div>}
      </div>
      {right}
    </div>
  );
}

export function Kpi({
  label,
  value,
  foot,
  tone,
  onClick,
  title,
}: {
  label: string;
  value: ReactNode;
  foot?: string;
  tone?: "warn" | "danger";
  onClick?: () => void;
  title?: string;
}) {
  return (
    <div className={`card kpi ${onClick ? "click" : ""}`} onClick={onClick} title={title}>
      <div className="kpi-label">{label}</div>
      <div className={`kpi-value ${tone ?? ""}`}>{value}</div>
      {foot && <div className="kpi-foot">{foot}</div>}
    </div>
  );
}

export function StateChip({ estado }: { estado: string }) {
  return (
    <span className="chip">
      <span className="dot" style={{ background: estadoColor(estado) }} />
      {estadoLabel(estado)}
    </span>
  );
}

/** Barra horizontal apilada (segmentos con color por estado). */
export function StackBar({
  segments,
  total,
  max,
}: {
  segments: { key: string; value: number; color: string }[];
  total: number;
  max: number;
}) {
  return (
    <div className="track" style={{ width: `${max ? (total / max) * 100 : 0}%`, minWidth: total ? 24 : 0 }}>
      {segments.map(
        (s) =>
          s.value > 0 && (
            <div
              key={s.key}
              className="seg"
              style={{ width: `${(s.value / total) * 100}%`, background: s.color }}
              title={`${s.key}: ${s.value}`}
            />
          )
      )}
    </div>
  );
}

export function EmptyState({ icon = "◔", title, hint }: { icon?: string; title: string; hint?: string }) {
  return (
    <div className="empty">
      <div className="big">{icon}</div>
      <div>{title}</div>
      {hint && <div style={{ marginTop: 6, fontSize: 12 }}>{hint}</div>}
    </div>
  );
}

export function Loading({ h = 90 }: { h?: number }) {
  return <div className="skeleton" style={{ height: h, width: "100%" }} />;
}

export function StatLine({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid var(--border)" }}>
      <span className="muted" style={{ fontSize: 12.5 }}>{label}</span>
      <b style={{ fontSize: 13 }}>{value}</b>
    </div>
  );
}

export function MetricTile({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div style={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 10, padding: "12px 14px" }}>
      <div style={{ fontSize: 11.5, color: "var(--text-3)", fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 680, marginTop: 2 }}>{value}</div>
    </div>
  );
}

export const num = nfmt;
