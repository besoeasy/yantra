import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

import { resolveComposeCommand } from "./compose.js";
import { errorHandler } from "./utils.js";
import { startCleanupScheduler } from "./cleanup.js";
import { socketPath, log } from "./shared.js";

import systemRouter from "./routes/system.js";
import containersRouter from "./routes/containers.js";
import stacksRouter from "./routes/stacks.js";
import appsRouter from "./routes/apps.js";
import imagesRouter from "./routes/images.js";
import volumesRouter from "./routes/volumes.js";
import backupRouter from "./routes/backup.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

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

  app.use(uiBasePath, express.static(uiDistPath));

  log("info", `📦 Serving Vue.js app from: ${uiDistPath}`);
  log("info", `🧭 UI virtual root: ${uiBasePath}`);
}

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use(systemRouter);
app.use(containersRouter);
app.use(stacksRouter);
app.use(appsRouter);
app.use(imagesRouter);
app.use(volumesRouter);
app.use(backupRouter);

// ─── Error handler (must be last) ────────────────────────────────────────────
app.use(errorHandler);

// ─── Start server ─────────────────────────────────────────────────────────────
const PORT = 5252;
app.listen(PORT, "0.0.0.0", () => {
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
});
