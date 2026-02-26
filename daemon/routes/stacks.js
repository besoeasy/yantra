import { Router } from "express";
import { docker, getAppsCatalogCached, getContainerEnv, parseAppLabels } from "../shared.js";
import { asyncHandler, getBaseAppId } from "../utils.js";

const router = Router();

const DOCKER_SYSTEM_KEYS = new Set([
  "PATH", "HOME", "HOSTNAME", "TERM", "SHLVL", "USER", "LOGNAME", "SHELL",
  "no_proxy", "NO_PROXY", "HTTP_PROXY", "HTTPS_PROXY", "http_proxy", "https_proxy",
]);

// GET /api/stacks/:projectId
router.get("/api/stacks/:projectId", asyncHandler(async (req, res) => {
  const { projectId } = req.params;
  const catalog = await getAppsCatalogCached();
  const catalogMap = new Map(catalog.apps.map(a => [a.id, a]));

  const allContainers = await docker.listContainers({ all: true });
  const projectContainers = allContainers.filter(c => c.Labels?.["com.docker.compose.project"] === projectId);

  if (projectContainers.length === 0) {
    return res.status(404).json({ success: false, error: "Stack not found or no containers" });
  }

  const baseAppId = getBaseAppId(projectId);
  const catalogEntry = catalogMap.get(baseAppId) || null;

  // Build published ports (deduplicated by key)
  const publishedPortsMap = new Map();
  for (const c of projectContainers) {
    const svcLabel = c.Labels["yantr.service"] || c.Names[0]?.replace("/", "") || "unknown";
    for (const p of (c.Ports || [])) {
      if (p.PublicPort) {
        const key = `${p.PublicPort}:${p.PrivatePort}:${p.Type}:${svcLabel}`;
        if (!publishedPortsMap.has(key)) {
          publishedPortsMap.set(key, { hostPort: p.PublicPort, containerPort: p.PrivatePort, protocol: p.Type, service: svcLabel });
        }
      }
    }
  }
  const publishedPorts = [...publishedPortsMap.values()].sort((a, b) => a.hostPort - b.hostPort);

  const services = await Promise.all(projectContainers.map(async c => {
    const appLabels = parseAppLabels(c.Labels);

    const mountsMap = new Map();
    for (const m of (c.Mounts || [])) {
      if (!mountsMap.has(m.Destination)) {
        mountsMap.set(m.Destination, { type: m.Type, source: m.Source || "", destination: m.Destination, mode: m.Mode || "", name: m.Name || null });
      }
    }

    let env = [];
    try {
      const rawEnv = await getContainerEnv(c.Id);
      env = rawEnv
        .map(e => { const idx = e.indexOf("="); return idx >= 0 ? { key: e.slice(0, idx), value: e.slice(idx + 1) } : { key: e, value: "" }; })
        .filter(v => !DOCKER_SYSTEM_KEYS.has(v.key));
    } catch {}

    return {
      id: c.Id,
      name: c.Names[0]?.replace("/", "") || "unknown",
      image: c.Image,
      state: c.State,
      status: c.Status,
      created: c.Created,
      rawPorts: c.Ports || [],
      mounts: [...mountsMap.values()],
      env,
      service: c.Labels["yantr.service"] || appLabels.service || c.Names[0]?.replace("/", "") || "unknown",
      hasYantrLabel: !!(appLabels.app),
    };
  }));

  services.sort((a, b) => {
    if (a.hasYantrLabel !== b.hasYantrLabel) return a.hasYantrLabel ? -1 : 1;
    return a.service.localeCompare(b.service);
  });

  res.json({
    success: true,
    stack: {
      projectId,
      appId: baseAppId,
      app: catalogEntry ? { name: catalogEntry.name, logo: catalogEntry.logo, tags: catalogEntry.tags, ports: Array.isArray(catalogEntry.ports) ? catalogEntry.ports : [], short_description: catalogEntry.short_description, website: catalogEntry.website } : null,
      publishedPorts,
      services,
    },
  });
}));

export default router;
