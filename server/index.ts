import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import { initDb, DEMO_MODE } from "./db.ts";
import metricsRoutes from "./routes/metrics.ts";
import tasksRoutes from "./routes/tasks.ts";
import teamRoutes from "./routes/team.ts";
import clientsRoutes from "./routes/clients.ts";
import qualityRoutes from "./routes/quality.ts";
import insightsRoutes from "./routes/insights.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROD = process.env.NODE_ENV === "production";
const PORT = Number(process.env.PORT || 3001);
const PASSWORD = (process.env.DASHBOARD_PASSWORD || "").trim();

async function main() {
  await initDb();
  const app = Fastify({ logger: false });

  // Gate opcional por clave compartida (solo afecta /api, no /api/auth).
  app.addHook("preHandler", async (req, reply) => {
    if (!PASSWORD) return;
    if (!req.url.startsWith("/api")) return;
    if (req.url.startsWith("/api/auth") || req.url.startsWith("/api/health")) return;
    if (req.headers["x-dashboard-key"] !== PASSWORD) {
      reply.code(401).send({ error: "no autorizado" });
    }
  });

  app.get("/api/health", async () => ({ ok: true, demo: DEMO_MODE }));
  app.get("/api/auth", async () => ({ required: !!PASSWORD, demo: DEMO_MODE }));
  app.post("/api/auth", async (req, reply) => {
    const password = (req.body as any)?.password;
    if (!PASSWORD || password === PASSWORD) return { ok: true };
    reply.code(401);
    return { ok: false };
  });

  await app.register(metricsRoutes);
  await app.register(tasksRoutes);
  await app.register(teamRoutes);
  await app.register(clientsRoutes);
  await app.register(qualityRoutes);
  await app.register(insightsRoutes);

  // En producción, Fastify sirve el bundle de Vite (dist/) con fallback SPA.
  if (PROD) {
    await app.register(fastifyStatic, { root: join(__dirname, "..", "dist"), prefix: "/" });
    app.setNotFoundHandler((req, reply) => {
      if (req.url.startsWith("/api")) {
        reply.code(404).send({ error: "not found" });
      } else {
        reply.sendFile("index.html");
      }
    });
  }

  await app.listen({ port: PORT, host: "0.0.0.0" });
  console.log(
    `[dashboard-o3] escuchando en :${PORT} · modo ${DEMO_MODE ? "DEMO (datos sintéticos)" : "PRODUCCIÓN"}`
  );
}

main().catch((e) => {
  console.error("Fallo al arrancar:", e);
  process.exit(1);
});
