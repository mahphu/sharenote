// ============================================
// SHARENOTE — Server entry: REST API + WebSocket + built frontend
// ============================================

import express from 'express'
import { createServer } from 'node:http'
import { existsSync } from 'node:fs'
import { networkInterfaces } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { apiRouter } from './routes.js'
import { attachRealtime } from './realtime.js'

const PORT = Number(process.env.SHARENOTE_PORT) || 3001
const HOST = process.env.SHARENOTE_HOST || '0.0.0.0'
const DIST_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist')

const app = express()
app.disable('x-powered-by')
app.use('/api', apiRouter)

// In production (`npm start`) serve the built SPA from the same port
if (existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR))
  app.use((req, res, next) => {
    if (req.method !== 'GET') return next()
    // `root` keeps dotfile checks to the path below dist/, so a parent folder like .claude/ is fine
    res.sendFile('index.html', { root: DIST_DIR })
  })
}

// Never send stack traces to the browser
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const status = err.status || err.statusCode || 500
  if (status >= 500) console.error('[server] Error:', err)
  res.status(status).end()
})

const server = createServer(app)
attachRealtime(server)

function lanAddresses() {
  return Object.values(networkInterfaces())
    .flat()
    .filter((iface) => iface && iface.family === 'IPv4' && !iface.internal)
    .map((iface) => iface.address)
}

server.listen(PORT, HOST, () => {
  console.log(`[sharenote] Server running at http://localhost:${PORT}`)
  for (const address of lanAddresses()) {
    console.log(`[sharenote] LAN: http://${address}:${PORT}`)
  }
})
