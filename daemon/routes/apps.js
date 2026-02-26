import { Router } from "express";
import path from "path";
import { readFile, writeFile, unlink, access } from "fs/promises";
import YAML from "yaml";
import {
  docker, log, appsDir, socketPath,
  getAppsCatalogCached, checkImageArchitectureSupport, getImageFromCompose,
} from "../shared.js";
import { asyncHandler, spawnProcess, NotFoundError, BadRequestError } from "../utils.js";
import { resolveComposeCommand } from "../compose.js";

const router = Router();

// GET /api/apps
router.get("/api/apps", asyncHandler(async (req, res) => {
  const forceRefresh = req.query.refresh === "1" || req.query.refresh === "true";
  const { apps, count } = await getAppsCatalogCached({ forceRefresh });
  res.json({ success: true, count, apps });
}));

// GET /api/apps/:id/check-arch
router.get("/api/apps/:id/check-arch", asyncHandler(async (req, res) => {
  const appId = req.params.id;
  const composePath = path.join(appsDir, appId, "compose.yml");
  try { await access(composePath); } catch { throw new NotFoundError(`App '${appId}' not found`); }

  const imageName = await getImageFromCompose(composePath);
  if (!imageName) throw new BadRequestError("Could not extract image name from compose file");

  const archCheck = await checkImageArchitectureSupport(imageName);
  res.json({ success: true, appId, image: imageName, supported: archCheck.supported, systemArch: archCheck.systemArch, imageArch: archCheck.imageArch });
}));

// GET /api/apps/:id/dependency-env
router.get("/api/apps/:id/dependency-env", asyncHandler(async (req, res) => {
  const appId = req.params.id;
  const appPath = path.join(appsDir, appId);

  try { await readFile(path.join(appPath, "compose.yml"), "utf-8"); }
  catch { throw new NotFoundError(`App '${appId}' not found or has no compose.yml`); }

  let dependencies = [];
  try {
    const info = JSON.parse(await readFile(path.join(appPath, "info.json"), "utf-8"));
    dependencies = Array.isArray(info.dependencies) ? info.dependencies : [];
  } catch {}

  if (dependencies.length === 0) return res.json({ success: true, dependencies: [], environmentVariables: {} });

  log("info", `[GET /api/apps/:id/dependency-env] Found dependencies for ${appId}: ${dependencies.join(", ")}`);

  const environmentVariables = {};
  for (const depAppId of dependencies) {
    try {
      const containers = await docker.listContainers({ all: false, filters: { label: [`com.docker.compose.project=${depAppId}`] } });
      if (containers.length === 0) continue;
      const inspect = await docker.getContainer(containers[0].Id).inspect();
      environmentVariables[depAppId] = {};
      (inspect.Config.Env || []).forEach(envVar => {
        const [key, ...valueParts] = envVar.split("=");
        const value = valueParts.join("=");
        if (value && !value.match(/^\$\{.*\}$/)) environmentVariables[depAppId][key] = value;
      });
    } catch (err) {
      log("error", `[GET /api/apps/:id/dependency-env] Error fetching env from ${depAppId}:`, err.message);
    }
  }

  res.json({ success: true, dependencies, environmentVariables });
}));

// POST /api/deploy
router.post("/api/deploy", async (req, res) => {
  log("info", "🚀 [POST /api/deploy] Deploy request received");
  try {
    const { appId, environment, expiresIn, customPortMappings, instanceId, allowMissingDependencies } = req.body;
    log("info", `🚀 [POST /api/deploy] Deploying app: ${appId}${instanceId > 1 ? ` (Instance #${instanceId})` : ""}`);

    if (!appId) {
      return res.status(400).json({ success: false, error: "appId is required" });
    }

    const appPath = path.join(appsDir, appId);
    const composePath = path.join(appPath, "compose.yml");

    let composeContent;
    try {
      composeContent = await readFile(composePath, "utf-8");
    } catch {
      return res.status(404).json({ success: false, error: `App '${appId}' not found or has no compose.yml` });
    }

    // Architecture check
    const imageName = await getImageFromCompose(composePath);
    if (imageName) {
      const archCheck = await checkImageArchitectureSupport(imageName);
      if (archCheck.supported === false) {
        return res.status(400).json({ success: false, error: "Architecture not supported", message: `The image '${imageName}' does not support your system architecture (${archCheck.systemArch}). Image supports: ${archCheck.imageArch}`, details: { image: imageName, systemArch: archCheck.systemArch, imageArch: archCheck.imageArch } });
      }
    }

    // Check external networks
    let parsedCompose;
    try { parsedCompose = YAML.parse(composeContent); } catch { parsedCompose = null; }
    if (parsedCompose?.networks) {
      const missingNetworks = [];
      for (const [netName, netConfig] of Object.entries(parsedCompose.networks)) {
        if (netConfig?.external === true) {
          const name = netConfig.name || netName;
          const nets = await docker.listNetworks({ filters: { name: [name] } });
          if (!nets.some(n => n.Name === name)) missingNetworks.push(name);
        }
      }
      if (missingNetworks.length > 0) {
        const needed = missingNetworks.map(n => n.replace(/_network$/, "")).join(", ");
        return res.status(400).json({ success: false, error: "Missing networks", message: `Required network(s) ${missingNetworks.join(", ")} do not exist. Deploy ${needed} first.`, missingNetworks });
      }
    }

    // Check dependencies
    let deployDeps = [];
    try {
      const infoData = JSON.parse(await readFile(path.join(appPath, "info.json"), "utf-8"));
      deployDeps = Array.isArray(infoData.dependencies) ? infoData.dependencies : [];
    } catch {}

    let dependencyWarnings = null;
    if (deployDeps.length > 0) {
      const runningContainers = await docker.listContainers({ all: false });
      const runningProjects = new Set(runningContainers.map(c => c.Labels?.["com.docker.compose.project"]).filter(Boolean));
      const missingDeps = deployDeps.filter(dep => !runningProjects.has(dep));
      if (missingDeps.length > 0) {
        if (!allowMissingDependencies) {
          return res.status(400).json({ success: false, error: "Missing dependencies", message: `This app requires the following apps to be running: ${missingDeps.join(", ")}. Please deploy ${missingDeps.length === 1 ? "it" : "them"} first.`, missingDependencies: missingDeps });
        }
        dependencyWarnings = missingDeps;
      }
    }

    // Write .env file
    if (environment && Object.keys(environment).length > 0) {
      const envContent = Object.entries(environment).filter(([, v]) => v !== null && v !== undefined && String(v).trim() !== "").map(([k, v]) => `${k}=${v}`).join("\n");
      if (envContent.length > 0) await writeFile(path.join(appPath, ".env"), envContent, "utf-8");
    }

    // Inject expiration labels
    let modifiedComposeContent = composeContent;
    if (expiresIn) {
      const expiresInHours = parseFloat(expiresIn);
      if (!isNaN(expiresInHours) && expiresInHours > 0) {
        const expireAtTimestamp = Math.floor(Date.now() / 1000) + Math.floor(expiresInHours * 3600);
        const lines = composeContent.split("\n");
        const result = [];
        let inLabelsSection = false, baseIndentLevel = 0;
        for (const line of lines) {
          result.push(line);
          if (line.trim().startsWith("labels:")) {
            inLabelsSection = true;
            baseIndentLevel = line.search(/\S/);
            const labelIndent = " ".repeat(baseIndentLevel + 2);
            result.push(`${labelIndent}yantr.expireAt: "${expireAtTimestamp}"`);
            result.push(`${labelIndent}yantr.temporary: "true"`);
          } else if (inLabelsSection) {
            const currentIndent = line.search(/\S/);
            if (line.trim() && currentIndent <= baseIndentLevel) inLabelsSection = false;
          }
        }
        modifiedComposeContent = result.join("\n");
        await writeFile(path.join(appPath, ".compose.tmp.yml"), modifiedComposeContent, "utf-8");
      }
    }

    // Instance-specific naming
    if (instanceId && instanceId > 1) {
      const lines = modifiedComposeContent.split("\n");
      const result = [];
      let inVolumesSection = false, inServiceVolumesSection = false;
      for (const line of lines) {
        let l = line;
        if (l.match(/^volumes:\s*$/)) { inVolumesSection = true; inServiceVolumesSection = false; }
        else if (l.match(/^[a-z]+:\s*$/) && !l.startsWith(" ")) inVolumesSection = false;
        if (l.match(/^\s+volumes:\s*$/)) inServiceVolumesSection = true;
        else if (l.match(/^\s+[a-z_]+:\s*$/) && !l.match(/^\s+volumes:/)) inServiceVolumesSection = false;

        const cnm = l.match(/^(\s*container_name:\s*)(.+)$/);
        if (cnm) l = `${cnm[1]}${cnm[2].trim()}-${instanceId}`;

        const vdm = l.match(/^(\s+)([a-zA-Z0-9_-]+):(\s*)$/);
        if (vdm && inVolumesSection) l = `${vdm[1]}${vdm[2]}_${instanceId}:${vdm[3]}`;

        const vnm = l.match(/^(\s+name:\s+)(.+)$/);
        if (vnm && inVolumesSection) l = `${vnm[1]}${vnm[2].trim()}_${instanceId}`;

        const vrm = l.match(/^(\s*-\s+)([a-zA-Z0-9_-]+)(:.+)$/);
        if (vrm && inServiceVolumesSection) l = `${vrm[1]}${vrm[2]}_${instanceId}${vrm[3]}`;

        result.push(l);
      }
      modifiedComposeContent = result.join("\n");
      await writeFile(path.join(appPath, ".compose.tmp.yml"), modifiedComposeContent, "utf-8");
    }

    // Custom port mappings
    if (customPortMappings && Object.keys(customPortMappings).length > 0) {
      const lines = modifiedComposeContent.split("\n");
      const result = [];
      for (const line of lines) {
        let l = line;
        const fpm = l.match(/^(\s*-\s*)(["']?)(\d+):(\d+)(\/(?:tcp|udp))?(["']?)$/);
        if (fpm) {
          const key = `${fpm[3]}/${(fpm[5] || "/tcp").replace("/", "")}`;
          if (customPortMappings[key]) l = `${fpm[1]}${fpm[2]}${customPortMappings[key]}:${fpm[4]}${fpm[5] || ""}${fpm[6]}`;
        }
        const apm = l.match(/^(\s*-\s*)(["'])(\d+)["']$/);
        if (apm) {
          const key = `${apm[3]}/tcp`;
          if (customPortMappings[key]) l = `${apm[1]}${apm[2]}${customPortMappings[key]}:${apm[3]}${apm[2]}`;
        }
        result.push(l);
      }
      modifiedComposeContent = result.join("\n");
      await writeFile(path.join(appPath, ".compose.tmp.yml"), modifiedComposeContent, "utf-8");
    }

    const useTmp = expiresIn || customPortMappings || (instanceId && instanceId > 1);
    const composeFile = useTmp ? ".compose.tmp.yml" : "compose.yml";
    const projectName = (instanceId && instanceId > 1) ? `${appId}-${instanceId}` : appId;

    const composeCmd = await resolveComposeCommand({ socketPath, log });
    try {
      const { stdout, stderr, exitCode } = await spawnProcess(
        composeCmd.command,
        [...composeCmd.args, "-p", projectName, "-f", composeFile, "up", "-d"],
        { cwd: appPath, env: { ...process.env, DOCKER_HOST: `unix://${socketPath}` } }
      );
      if (exitCode !== 0) throw new Error(`docker compose failed with exit code ${exitCode}: ${stderr}`);

      if (useTmp) {
        try { await unlink(path.join(appPath, ".compose.tmp.yml")); } catch {}
      }

      res.json({ success: true, message: `App '${appId}' deployed successfully`, appId, output: stdout, warnings: stderr || null, dependencyWarnings, temporary: !!expiresIn });
    } catch (error) {
      if (useTmp) { try { await unlink(path.join(appPath, ".compose.tmp.yml")); } catch {} }
      const isArchError = error.message?.includes("no matching manifest") || error.message?.includes("platform") || error.message?.includes("architecture");
      res.status(500).json({ success: false, error: isArchError ? "Architecture not supported" : "Deployment failed", message: isArchError ? "This image does not support your system architecture" : error.message, stderr: error.stderr });
    }
  } catch (error) {
    log("error", "❌ [POST /api/deploy] Unexpected error:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
