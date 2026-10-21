// ============================================
// SHARENOTE — One shared WebSocket per board
// Board presence, canvas sync, live cursors and chat all subscribe to the
// same socket via acquireBoardSocket(boardId) / socket.release().
// ============================================

const MAX_RETRY_DELAY_MS = 10000
const MAX_QUEUE = 500

// Message types whose latest value is replayed to late subscribers
const STICKY_TYPES = new Set(['presence'])

const sockets = new Map()

class BoardSocket {
  constructor(boardId) {
    this.boardId = boardId
    this.refs = 0
    this.listeners = new Map()
    this.last = new Map()
    this.queue = []
    this.retry = 0
    this.closed = false
    this.ws = null
    this.retryTimer = null
    this.connect()
  }

  connect() {
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws'
    const ws = new WebSocket(`${protocol}://${window.location.host}/ws`)
    this.ws = ws

    ws.onopen = () => {
      this.retry = 0
      ws.send(JSON.stringify({ type: 'join', boardId: this.boardId }))
      // Edits made while disconnected; cursors are not worth replaying
      for (const msg of this.queue.splice(0)) ws.send(msg)
    }

    ws.onmessage = (event) => {
      let msg
      try {
        msg = JSON.parse(event.data)
      } catch {
        return
      }
      if (STICKY_TYPES.has(msg.type)) this.last.set(msg.type, msg)
      this.emit(msg.type, msg)
    }

    ws.onclose = () => {
      if (this.closed) return
      this.emit('disconnected', {})
      const delay = Math.min(1000 * 2 ** this.retry, MAX_RETRY_DELAY_MS)
      this.retry++
      this.retryTimer = setTimeout(() => this.connect(), delay)
    }
  }

  on(type, callback) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set())
    this.listeners.get(type).add(callback)
    if (this.last.has(type)) callback(this.last.get(type))
    return () => this.listeners.get(type)?.delete(callback)
  }

  emit(type, msg) {
    for (const callback of this.listeners.get(type) ?? []) {
      try {
        callback(msg)
      } catch (err) {
        console.error(`[realtime] ${type} handler error:`, err)
      }
    }
  }

  send(type, payload = {}) {
    const data = JSON.stringify({ ...payload, type })
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(data)
    } else if (type !== 'cursor' && this.queue.length < MAX_QUEUE) {
      this.queue.push(data)
    }
  }

  release() {
    this.refs--
    // Defer so a StrictMode unmount/remount reuses the same connection
    setTimeout(() => {
      if (this.refs > 0 || this.closed) return
      this.closed = true
      clearTimeout(this.retryTimer)
      this.ws?.close()
      sockets.delete(this.boardId)
    }, 0)
  }
}

export function acquireBoardSocket(boardId) {
  let socket = sockets.get(boardId)
  if (!socket || socket.closed) {
    socket = new BoardSocket(boardId)
    sockets.set(boardId, socket)
  }
  socket.refs++
  return socket
}
