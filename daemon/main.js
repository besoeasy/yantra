import Fastify from "fastify";
import fastifyCors from "@fastify/cors";
import fastifyStatic from "@fastify/static";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

import { resolveComposeCommand } from "./compose.js";
import { errorHandler } from "./utils.js";
import { startCleanupScheduler } from "./cleanup.js";
import { startScheduler } from "./backup-scheduler.js";
import { socketPath, log } from "./shared.js";

import systemRoutes from "./routes/system.js";
import containersRoutes from "./routes/containers.js";
import stacksRoutes from "./routes/stacks.js";
import appsRoutes from "./routes/apps.js";
import imagesRoutes from "./routes/images.js";
import volumesRoutes from "./routes/volumes.js";
import backupRoutes from "./routes/backup.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const fastify = Fastify({ logger: false });

// ─── CORS ─────────────────────────────────────────────────────────────────────
await fastify.register(fastifyCors, { origin: "*" });

// ─── Static UI (production only) ─────────────────────────────────────────────
function normalizeUiBasePath(value) {
  if (!value || value === "/") return "/";
  const trimmed = String(value).trim();
  if (!trimmed) return "/";
  const withLeadingSlash = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return withLeadingSlash.replace(/\/+$/, "");
}

if (process.env.NODE_ENV === "production") {
  const uiDistPath = path.join(__dirname, "..", "dist");
  const uiBasePath = normalizeUiBasePath(process.env.UI_BASE_PATH || process.env.VITE_BASE_PATH || "/");

  await fastify.register(fastifyStatic, {
    root: uiDistPath,
    prefix: uiBasePath,
    wildcard: false,
    decorateReply: true,
  });

  log("info", `📦 Serving Vue.js app from: ${uiDistPath}`);
  log("info", `🧭 UI virtual root: ${uiBasePath}`);
}

// ─── API Routes ───────────────────────────────────────────────────────────────
await fastify.register(systemRoutes);
await fastify.register(containersRoutes);
await fastify.register(stacksRoutes);
await fastify.register(appsRoutes);
await fastify.register(imagesRoutes);
await fastify.register(volumesRoutes);
await fastify.register(backupRoutes);

// ─── Error handler ────────────────────────────────────────────────────────────
fastify.setErrorHandler(errorHandler);

// ─── SPA fallback (production only, after API routes) ────────────────────────
if (process.env.NODE_ENV === "production") {
  fastify.setNotFoundHandler((_request, reply) => {
    reply.sendFile("index.html");
  });
}

// ─── Start server ─────────────────────────────────────────────────────────────
const PORT = 5252;
try {
  await fastify.listen({ port: PORT, host: "0.0.0.0" });

  log("info", "\n" + "=".repeat(50));
  log("info", "🚀 Yantr API Server Started");
  log("info", "=".repeat(50));
  log("info", `📡 Port: ${PORT}`);
  log("info", `🔌 Socket: ${socketPath}`);
  log("info", `📂 Apps directory: ${path.join(__dirname, "..", "apps")}`);
  log("info", `🌐 Access: http://localhost:${PORT}`);
  log("info", "=".repeat(50) + "\n");

  resolveComposeCommand({ socketPath, log }).catch((err) => {
    log("warn", `⚠️  [COMPOSE] ${err.message}`);
  });

  log("info", "🧹 Starting automatic cleanup scheduler");
  startCleanupScheduler(11);

  log("info", "⏰ Starting backup scheduler");
  startScheduler(log).catch((err) => {
    log("warn", `⚠️  [BACKUP SCHEDULER] ${err.message}`);
  });
} catch (err) {
  console.error("Failed to start server:", err);
  process.exit(1);
}
