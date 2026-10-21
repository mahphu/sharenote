// ============================================
// SHARENOTE — WebSocket rooms (one room per board)
//
// Client → server:
//   { type: 'join', boardId }
//   { type: 'draw', added, updated, removed }   (editors only)
//   { type: 'cursor', cx, cy }
// Server → client:
//   { type: 'joined', boardId }
//   { type: 'presence', users: [{ id, email }] }
//   { type: 'draw', senderId, added, updated, removed }
//   { type: 'cursor', id, cx, cy }
//   { type: 'chat', message }
//   { type: 'access', public_access }
//   { type: 'forbidden' } | { type: 'board-deleted' }
// ============================================

import { WebSocketServer, WebSocket } from 'ws'
import { userFromCookieHeader } from './auth.js'
import { getBoardById, canView, canEdit } from './access.js'

const MAX_PAYLOAD = 10 * 1024 * 1024
const HEARTBEAT_MS = 30000

// boardId -> Set<WebSocket>
const rooms = new Map()

function send(ws, msg) {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg))
}

export function broadcast(boardId, msg, except = null) {
  const room = rooms.get(boardId)
  if (!room) return
  const data = JSON.stringify(msg)
  for (const ws of room) {
    if (ws !== except && ws.readyState === WebSocket.OPEN) ws.send(data)
  }
}

function broadcastPresence(boardId) {
  const room = rooms.get(boardId)
  if (!room) return
  const users = new Map()
  for (const ws of room) users.set(ws.user.id, { id: ws.user.id, email: ws.user.email })
  broadcast(boardId, { type: 'presence', users: [...users.values()] })
}

function leaveRoom(ws) {
  const boardId = ws.boardId
  if (!boardId) return
  ws.boardId = null
  const room = rooms.get(boardId)
  if (!room) return
  room.delete(ws)
  if (room.size === 0) {
    rooms.delete(boardId)
  } else {
    broadcastPresence(boardId)
  }
}

// Called after the owner changes public_access: drop sockets that lost access
export function enforceBoardAccess(boardId) {
  const room = rooms.get(boardId)
  if (!room) return
  const board = getBoardById(boardId)
  for (const ws of [...room]) {
    if (!board || !canView(ws.user, board)) {
      send(ws, { type: 'forbidden' })
      leaveRoom(ws)
    }
  }
  if (board) broadcast(boardId, { type: 'access', public_access: board.public_access })
}

export function closeBoardRoom(boardId) {
  const room = rooms.get(boardId)
  if (!room) return
  broadcast(boardId, { type: 'board-deleted' })
  for (const ws of room) ws.boardId = null
  rooms.delete(boardId)
}

function handleMessage(ws, msg) {
  if (!msg || typeof msg.type !== 'string') return

  if (msg.type === 'join') {
    const board = typeof msg.boardId === 'string' ? getBoardById(msg.boardId) : null
    if (!board || !canView(ws.user, board)) {
      send(ws, { type: 'forbidden' })
      return
    }
    leaveRoom(ws)
    ws.boardId = board.id
    if (!rooms.has(board.id)) rooms.set(board.id, new Set())
    rooms.get(board.id).add(ws)
    send(ws, { type: 'joined', boardId: board.id })
    broadcastPresence(board.id)
    return
  }

  if (!ws.boardId) return

  // Re-check permissions on every message so access changes apply immediately
  const board = getBoardById(ws.boardId)

  if (msg.type === 'draw') {
    if (!canEdit(ws.user, board)) return
    broadcast(ws.boardId, {
      type: 'draw',
      senderId: ws.user.id,
      added: Array.isArray(msg.added) ? msg.added : [],
      updated: Array.isArray(msg.updated) ? msg.updated : [],
      removed: Array.isArray(msg.removed) ? msg.removed : []
    }, ws)
    return
  }

  if (msg.type === 'cursor') {
    if (!canView(ws.user, board)) return
    const cx = Number(msg.cx)
    const cy = Number(msg.cy)
    if (!Number.isFinite(cx) || !Number.isFinite(cy)) return
    broadcast(ws.boardId, { type: 'cursor', id: ws.user.id, cx, cy }, ws)
  }
}

export function attachRealtime(server) {
  const wss = new WebSocketServer({ noServer: true, maxPayload: MAX_PAYLOAD })

  server.on('upgrade', (req, socket, head) => {
    const { pathname } = new URL(req.url, 'http://localhost')
    if (pathname !== '/ws') {
      socket.destroy()
      return
    }

    // Reject cross-site WebSocket connections
    const origin = req.headers.origin
    if (origin) {
      let originHost = null
      try { originHost = new URL(origin).host } catch { /* invalid origin */ }
      if (originHost !== req.headers.host) {
        socket.write('HTTP/1.1 403 Forbidden\r\n\r\n')
        socket.destroy()
        return
      }
    }

    const user = userFromCookieHeader(req.headers.cookie)
    if (!user) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n')
      socket.destroy()
      return
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      ws.user = user
      ws.boardId = null
      wss.emit('connection', ws)
    })
  })

  wss.on('connection', (ws) => {
    ws.isAlive = true
    ws.on('pong', () => { ws.isAlive = true })

    ws.on('message', (raw) => {
      let msg
      try {
        msg = JSON.parse(raw)
      } catch {
        return
      }
      try {
        handleMessage(ws, msg)
      } catch (err) {
        console.error('[ws] Message error:', err)
      }
    })

    ws.on('close', () => leaveRoom(ws))
  })

  const heartbeat = setInterval(() => {
    for (const ws of wss.clients) {
      if (!ws.isAlive) {
        ws.terminate()
        continue
      }
      ws.isAlive = false
      ws.ping()
    }
  }, HEARTBEAT_MS)
  wss.on('close', () => clearInterval(heartbeat))

  return wss
}
