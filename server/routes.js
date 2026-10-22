// ============================================
// SHARENOTE — REST API (/api/*)
// ============================================

import express from 'express'
import { randomBytes, randomUUID } from 'node:crypto'
import { db } from './db.js'
import {
  hashPassword, verifyPassword, createSession, deleteSession,
  setSessionCookie, clearSessionCookie, sessionTokenFromCookieHeader, requireUser,
  isLoginBlocked, recordFailedLogin, clearFailedLogins
} from './auth.js'
import {
  getBoardById, getBoardBySlug, listVisibleBoards, listMembers, withRole, isOwner, canView, canEdit
} from './access.js'
import { broadcast, enforceBoardAccess, closeBoardRoom } from './realtime.js'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MIN_PASSWORD_LENGTH = 8
const MAX_PASSWORD_LENGTH = 200
const MAX_MESSAGE_LENGTH = 5000
const ACCESS_LEVELS = new Set(['restricted', 'viewer', 'editor'])
const MEMBER_ROLES = new Set(['viewer', 'editor'])

export const apiRouter = express.Router()

apiRouter.use(express.json({ limit: '20mb' }))

function readCredentials(body) {
  const email = typeof body?.email === 'string' ? body.email.trim() : ''
  const password = typeof body?.password === 'string' ? body.password : ''
  return { email, password }
}

function randomSlug() {
  return Array.from(randomBytes(10), (b) => (b % 36).toString(36)).join('')
}

// Loads :id into req.board and rejects with 404/403 unless check(user, board) passes
function withBoard(check) {
  return (req, res, next) => {
    const board = getBoardById(req.params.id)
    if (!board) return res.status(404).json({ error: 'Board not found' })
    if (!check(req.user, board)) return res.status(403).json({ error: 'You do not have access to this board' })
    req.board = board
    next()
  }
}

// ---------- Auth ----------

apiRouter.post('/auth/register', async (req, res) => {
  const { email, password } = readCredentials(req.body)
  if (!EMAIL_RE.test(email) || email.length > 254) {
    return res.status(400).json({ error: 'Email không hợp lệ' })
  }
  if (password.length < MIN_PASSWORD_LENGTH || password.length > MAX_PASSWORD_LENGTH) {
    return res.status(400).json({ error: `Mật khẩu phải có từ ${MIN_PASSWORD_LENGTH} ký tự` })
  }
  if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(email)) {
    return res.status(409).json({ error: 'Email này đã được đăng ký' })
  }

  const user = { id: randomUUID(), email }
  db.prepare('INSERT INTO users (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)')
    .run(user.id, email, await hashPassword(password), new Date().toISOString())

  setSessionCookie(res, createSession(user.id))
  res.status(201).json({ user })
})

apiRouter.post('/auth/login', async (req, res) => {
  const { email, password } = readCredentials(req.body)
  if (isLoginBlocked(req.ip, email)) {
    return res.status(429).json({ error: 'Sai quá nhiều lần. Hãy thử lại sau 15 phút.' })
  }

  const row = db.prepare('SELECT id, email, password_hash FROM users WHERE email = ?').get(email)
  if (!row || !(await verifyPassword(password, row.password_hash))) {
    recordFailedLogin(req.ip, email)
    return res.status(401).json({ error: 'Email hoặc mật khẩu không đúng' })
  }

  clearFailedLogins(req.ip, email)
  setSessionCookie(res, createSession(row.id))
  res.json({ user: { id: row.id, email: row.email } })
})

apiRouter.post('/auth/logout', (req, res) => {
  deleteSession(sessionTokenFromCookieHeader(req.headers.cookie))
  clearSessionCookie(res)
  res.status(204).end()
})

apiRouter.get('/auth/me', requireUser, (req, res) => {
  res.json({ user: req.user })
})

// ---------- Boards ----------

apiRouter.get('/boards', requireUser, (req, res) => {
  res.json({ boards: listVisibleBoards(req.user.id) })
})

apiRouter.post('/boards', requireUser, (req, res) => {
  const now = new Date().toISOString()
  const title = typeof req.body?.title === 'string' && req.body.title.trim()
    ? req.body.title.trim().slice(0, 200)
    : 'Ghi chú mới'

  let slug = randomSlug()
  while (getBoardBySlug(slug)) slug = randomSlug()

  const id = randomUUID()
  db.prepare(`
    INSERT INTO boards (id, owner_id, unique_slug, title, public_access, created_at, updated_at)
    VALUES (?, ?, ?, ?, 'restricted', ?, ?)
  `).run(id, req.user.id, slug, title, now, now)

  res.status(201).json({ board: withRole(req.user, getBoardById(id)) })
})

apiRouter.get('/boards/by-slug/:slug', requireUser, (req, res) => {
  const board = getBoardBySlug(req.params.slug)
  if (!board) return res.status(404).json({ error: 'Board not found' })
  if (!canView(req.user, board)) return res.status(403).json({ error: 'You do not have access to this board' })

  if (!isOwner(req.user, board)) {
    db.prepare(`
      INSERT INTO board_visits (board_id, user_id, last_opened_at) VALUES (?, ?, ?)
      ON CONFLICT (board_id, user_id) DO UPDATE SET last_opened_at = excluded.last_opened_at
    `).run(board.id, req.user.id, new Date().toISOString())
  }
  res.json({ board: withRole(req.user, board) })
})

apiRouter.patch('/boards/:id', requireUser, withBoard(isOwner), (req, res) => {
  const access = req.body?.public_access
  if (!ACCESS_LEVELS.has(access)) {
    return res.status(400).json({ error: 'Invalid public_access value' })
  }
  db.prepare('UPDATE boards SET public_access = ?, updated_at = ? WHERE id = ?')
    .run(access, new Date().toISOString(), req.board.id)
  enforceBoardAccess(req.board.id)
  res.json({ board: withRole(req.user, getBoardById(req.board.id)) })
})

apiRouter.delete('/boards/:id', requireUser, withBoard(isOwner), (req, res) => {
  db.prepare('DELETE FROM boards WHERE id = ?').run(req.board.id)
  closeBoardRoom(req.board.id)
  res.status(204).end()
})

// ---------- Members (owner only) ----------

apiRouter.get('/boards/:id/members', requireUser, withBoard(isOwner), (req, res) => {
  res.json({ members: listMembers(req.board.id) })
})

apiRouter.post('/boards/:id/members', requireUser, withBoard(isOwner), (req, res) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim() : ''
  const role = req.body?.role
  if (!MEMBER_ROLES.has(role)) return res.status(400).json({ error: 'Invalid role' })

  const invitee = email && db.prepare('SELECT id FROM users WHERE email = ?').get(email)
  if (!invitee) return res.status(404).json({ error: 'No account uses this email yet. Ask them to sign up first.' })
  if (invitee.id === req.user.id) return res.status(400).json({ error: 'You already own this board' })

  db.prepare(`
    INSERT INTO board_members (board_id, user_id, role, added_at) VALUES (?, ?, ?, ?)
    ON CONFLICT (board_id, user_id) DO UPDATE SET role = excluded.role
  `).run(req.board.id, invitee.id, role, new Date().toISOString())
  enforceBoardAccess(req.board.id)
  res.status(201).json({ members: listMembers(req.board.id) })
})

apiRouter.patch('/boards/:id/members/:userId', requireUser, withBoard(isOwner), (req, res) => {
  const role = req.body?.role
  if (!MEMBER_ROLES.has(role)) return res.status(400).json({ error: 'Invalid role' })

  const { changes } = db.prepare('UPDATE board_members SET role = ? WHERE board_id = ? AND user_id = ?')
    .run(role, req.board.id, req.params.userId)
  if (!changes) return res.status(404).json({ error: 'Member not found' })
  enforceBoardAccess(req.board.id)
  res.json({ members: listMembers(req.board.id) })
})

apiRouter.delete('/boards/:id/members/:userId', requireUser, withBoard(isOwner), (req, res) => {
  db.prepare('DELETE FROM board_members WHERE board_id = ? AND user_id = ?')
    .run(req.board.id, req.params.userId)
  enforceBoardAccess(req.board.id)
  res.json({ members: listMembers(req.board.id) })
})

// ---------- Canvas ----------

apiRouter.get('/boards/:id/canvas', requireUser, withBoard(canView), (req, res) => {
  const row = db.prepare('SELECT canvas_data FROM boards WHERE id = ?').get(req.board.id)
  res.json({ snapshot: row?.canvas_data ? JSON.parse(row.canvas_data) : null })
})

apiRouter.put('/boards/:id/canvas', requireUser, withBoard(canEdit), (req, res) => {
  const snapshot = req.body?.snapshot
  if (!snapshot || typeof snapshot !== 'object') {
    return res.status(400).json({ error: 'Missing snapshot' })
  }
  db.prepare('UPDATE boards SET canvas_data = ?, updated_at = ? WHERE id = ?')
    .run(JSON.stringify(snapshot), new Date().toISOString(), req.board.id)
  res.status(204).end()
})

// ---------- Chat ----------

apiRouter.get('/boards/:id/messages', requireUser, withBoard(canView), (req, res) => {
  const messages = db.prepare(`
    SELECT * FROM (
      SELECT m.id, m.content, m.created_at, m.sender_id, u.email AS sender_email
      FROM messages m JOIN users u ON u.id = m.sender_id
      WHERE m.board_id = ?
      ORDER BY m.created_at DESC
      LIMIT 100
    ) ORDER BY created_at ASC
  `).all(req.board.id)
  res.json({ messages })
})

apiRouter.post('/boards/:id/messages', requireUser, withBoard(canEdit), (req, res) => {
  const content = typeof req.body?.content === 'string' ? req.body.content.trim() : ''
  if (!content) return res.status(400).json({ error: 'Message is empty' })
  if (content.length > MAX_MESSAGE_LENGTH) {
    return res.status(400).json({ error: `Message too long. Maximum ${MAX_MESSAGE_LENGTH} characters allowed.` })
  }

  const message = {
    id: randomUUID(),
    content,
    created_at: new Date().toISOString(),
    sender_id: req.user.id,
    sender_email: req.user.email
  }
  db.prepare('INSERT INTO messages (id, board_id, sender_id, content, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(message.id, req.board.id, message.sender_id, message.content, message.created_at)

  broadcast(req.board.id, { type: 'chat', message })
  res.status(201).json({ message })
})

apiRouter.use((req, res) => {
  res.status(404).json({ error: 'Not found' })
})

// eslint-disable-next-line no-unused-vars
apiRouter.use((err, req, res, next) => {
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Payload too large' })
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid JSON' })
  }
  console.error('[api] Error:', err)
  res.status(500).json({ error: 'Internal server error' })
})
