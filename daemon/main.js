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
import { stopAll as stopAllBrowsers } from "./dufs.js";

import systemRoutes from "./routes/system.js";
import containersRoutes from "./routes/containers.js";
import stacksRoutes from "./routes/stacks.js";
import appsRoutes from "./routes/apps.js";
import imagesRoutes from "./routes/images.js";
import volumesRoutes from "./routes/volumes.js";
import backupRoutes from "./routes/backup.js";
import { getBrowserPort } from "./dufs.js";
import http from "node:http";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const fastify = Fastify({ logger: false });

// ─── CORS ─────────────────────────────────────────────────────────────────────
await fastify.register(fastifyCors, { origin: "*" });

// ─── Dufs proxy (root scope — must be before static + route registration) ────
fastify.addHook('onRequest', (req, reply, done) => {
  if (!req.raw.url.startsWith('/browse/')) return done()

  reply.hijack()
  const parts = req.raw.url.split('/')   // ['', 'browse', 'volumeName', ...]
  const volumeName = decodeURIComponent(parts[2] || '')
  const port = getBrowserPort(volumeName)

  if (!port) {
    reply.raw.writeHead(503, { 'content-type': 'text/html' })
    reply.raw.end(`<h2>Volume browser for "${volumeName}" is not running.</h2><p>Start it from the Volumes page.</p>`)
    return done()
  }

  const proxy = http.request(
    { hostname: 'localhost', port, path: req.raw.url, method: req.raw.method, headers: { ...req.raw.headers, host: `localhost:${port}` } },
    (res) => {
      const skip = new Set(['transfer-encoding', 'connection'])
      const headers = {}
      for (const [k, v] of Object.entries(res.headers)) {
        if (!skip.has(k.toLowerCase())) headers[k] = v
      }
      reply.raw.writeHead(res.statusCode, headers)
      res.pipe(reply.raw)
    }
  )
  proxy.on('error', () => {
    if (!reply.raw.headersSent) reply.raw.writeHead(502)
    reply.raw.end()
  })
  req.raw.pipe(proxy)
  done()
})

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

for (const signal of ["SIGTERM", "SIGINT"]) {
  process.on(signal, () => {
    log("info", `Received ${signal}, stopping dufs browsers...`);
    stopAllBrowsers();
    process.exit(0);
  });
}
