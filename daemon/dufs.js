import { spawn } from 'child_process'
import { createServer } from 'net'
import { log } from './shared.js'

// Map: volumeName -> { process, port, expireAt }
const browsers = new Map()
// Ports currently claimed (active or pending spawn) — prevents concurrent startBrowser
// calls from getting the same port during the TOCTOU window
const reservedPorts = new Set()

function findFreePort() {
  return new Promise((resolve, reject) => {
    const server = createServer()
    server.listen(0, () => {
      const port = server.address().port
      server.close(() => {
        if (reservedPorts.has(port)) {
          // Extremely unlikely, but recurse to get a different one
          return findFreePort().then(resolve, reject)
        }
        reservedPorts.add(port)
        resolve(port)
      })
    })
    server.on('error', reject)
  })
}

export async function startBrowser(volumeName, expiryMinutes = 0) {
  if (browsers.has(volumeName)) {
    return browsers.get(volumeName).port
  }

  const port = await findFreePort()
  const dataPath = `/var/lib/docker/volumes/${volumeName}/_data`
  const expireAt = expiryMinutes > 0 ? Math.floor(Date.now() / 1000) + expiryMinutes * 60 : null

  const proc = spawn('dufs', [dataPath, '--port', String(port), '--allow-all', '--path-prefix', `/browse/${volumeName}`], {
    stdio: 'ignore',
    detached: false,
  })

  proc.on('exit', (code) => {
    log('info', `dufs for ${volumeName} exited (code ${code})`)
    reservedPorts.delete(port)
    browsers.delete(volumeName)
  })

  proc.on('error', (err) => {
    log('error', `dufs process error for ${volumeName}: ${err.message}`)
    reservedPorts.delete(port)
    browsers.delete(volumeName)
  })

  browsers.set(volumeName, { process: proc, port, expireAt })
  log('info', `📂 Volume browser started: "${volumeName}" → /browse/${volumeName}/`)
  return port
}

export function stopBrowser(volumeName) {
  const browser = browsers.get(volumeName)
  if (!browser) return false
  try { browser.process.kill() } catch {}
  reservedPorts.delete(browser.port)
  browsers.delete(volumeName)
  log('info', `dufs stopped for volume "${volumeName}"`)
  return true
}

export function isBrowsing(volumeName) {
  return browsers.has(volumeName)
}

export function getBrowserPort(volumeName) {
  return browsers.get(volumeName)?.port ?? null
}

export function listBrowsers() {
  return Array.from(browsers.entries()).map(([volumeName, { port, expireAt }]) => ({
    volumeName,
    port,
    expireAt,
  }))
}

export function stopAll() {
  for (const [, { process: proc }] of browsers) {
    try { proc.kill() } catch {}
  }
  browsers.clear()
  reservedPorts.clear()
}
