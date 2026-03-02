import { spawn } from 'child_process'
import { createServer } from 'net'
import { log } from './shared.js'

// Map: volumeName -> { process, port, expireAt }
const browsers = new Map()

function findFreePort() {
  return new Promise((resolve, reject) => {
    const server = createServer()
    server.listen(0, () => {
      const port = server.address().port
      server.close(() => resolve(port))
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
    browsers.delete(volumeName)
  })

  proc.on('error', (err) => {
    log('error', `dufs process error for ${volumeName}: ${err.message}`)
    browsers.delete(volumeName)
  })

  browsers.set(volumeName, { process: proc, port, expireAt })
  log('info', `dufs started for volume "${volumeName}" on port ${port}`)
  return port
}

export function stopBrowser(volumeName) {
  const browser = browsers.get(volumeName)
  if (!browser) return false
  try { browser.process.kill() } catch {}
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
}
