import { spawnProcess } from "./utils.js";

let composeCommandCache = null;
let composeCommandLogged = false;

function getComposeEnv(socketPath) {
  return {
    ...process.env,
    DOCKER_HOST: socketPath ? `unix://${socketPath}` : process.env.DOCKER_HOST,
  };
}

export async function resolveComposeCommand({ socketPath, log } = {}) {
  if (composeCommandCache) {
    return composeCommandCache;
  }

  const env = getComposeEnv(socketPath);

  try {
    const { exitCode } = await spawnProcess("docker", ["compose", "version"], { env });
    if (exitCode === 0) {
      composeCommandCache = { command: "docker", args: ["compose"], display: "docker compose" };
      if (log && !composeCommandLogged) {
        composeCommandLogged = true;
        log("info", `🧩 [COMPOSE] Using ${composeCommandCache.display}`);
      }
      return composeCommandCache;
    }
  } catch (err) {
    // ignore and try docker-compose
  }

  try {
    const { exitCode } = await spawnProcess("docker-compose", ["version"], { env });
    if (exitCode === 0) {
      composeCommandCache = { command: "docker-compose", args: [], display: "docker-compose" };
      if (log && !composeCommandLogged) {
        composeCommandLogged = true;
        log("info", `🧩 [COMPOSE] Using ${composeCommandCache.display}`);
      }
      return composeCommandCache;
    }
  } catch (err) {
    // ignore and fail below
  }

  throw new Error("docker compose is not available (docker compose or docker-compose not found)");
}
