import { useState } from "react";
import { useStore } from "./store";
import { useApi } from "./lib";
import { login } from "./api";
import { Sidebar, Header, FilterBar, TaskDrawer, O3Logo } from "./components/shell";
import { Resumen } from "./pages/Resumen";
import { Operacion } from "./pages/Operacion";
import { Equipo } from "./pages/Equipo";
import { Clientes } from "./pages/Clientes";
import { Calidad } from "./pages/Calidad";

export function App() {
  const section = useStore((s) => s.section);
  const { data: auth } = useApi<{ required: boolean; demo: boolean }>("/api/auth");
  const [authed, setAuthed] = useState(!!localStorage.getItem("o3_dashboard_key"));

  if (auth?.required && !authed) return <Login onOk={() => setAuthed(true)} />;

  const logout = auth?.required
    ? () => {
        localStorage.removeItem("o3_dashboard_key");
        location.reload();
      }
    : undefined;

  return (
    <div className="app-frame">
      <div className="app">
        <Sidebar />
        <div className="main">
          <Header demo={!!auth?.demo} onLogout={logout} />
          <div className="content">
            <FilterBar />
            {section === "resumen" && <Resumen />}
            {section === "operacion" && <Operacion />}
            {section === "equipo" && <Equipo />}
            {section === "clientes" && <Clientes />}
            {section === "calidad" && <Calidad />}
          </div>
        </div>
        <TaskDrawer />
      </div>
    </div>
  );
}

function Login({ onOk }: { onOk: () => void }) {
  const [pw, setPw] = useState("");
  const [err, setErr] = useState(false);
  const submit = async () => {
    if (await login(pw)) onOk();
    else setErr(true);
  };
  return (
    <div className="login">
      <div className="box">
        <span className="login-mark"><O3Logo /></span>
        <div style={{ fontWeight: 700, fontSize: 16 }}>Panel de Gestión O3</div>
        <div className="card-sub">Acceso de dirección</div>
        <input
          type="password"
          placeholder="Clave de acceso"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
        />
        {err && <div style={{ color: "var(--danger)", fontSize: 12, marginBottom: 8 }}>Clave incorrecta.</div>}
        <button onClick={submit}>Entrar</button>
      </div>
    </div>
  );
}
