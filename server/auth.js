// ============================================
// SHARENOTE — Email/password auth with cookie sessions
// ============================================

import { randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import { db } from './db.js'

const scrypt = promisify(scryptCb)

export const SESSION_COOKIE = 'sid'
const SESSION_MS = 30 * 24 * 60 * 60 * 1000
const KEY_LENGTH = 64

export async function hashPassword(password) {
  const salt = randomBytes(16)
  const key = await scrypt(password, salt, KEY_LENGTH)
  return `${salt.toString('hex')}:${key.toString('hex')}`
}

export async function verifyPassword(password, stored) {
  const [saltHex, keyHex] = stored.split(':')
  if (!saltHex || !keyHex) return false
  const expected = Buffer.from(keyHex, 'hex')
  const key = await scrypt(password, Buffer.from(saltHex, 'hex'), expected.length)
  return timingSafeEqual(key, expected)
}

export function createSession(userId) {
  const token = randomBytes(32).toString('hex')
  db.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)')
    .run(token, userId, Date.now() + SESSION_MS)
  return token
}

export function deleteSession(token) {
  if (token) db.prepare('DELETE FROM sessions WHERE token = ?').run(token)
}

export function setSessionCookie(res, token) {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: SESSION_MS,
    path: '/'
  })
}

export function clearSessionCookie(res) {
  res.clearCookie(SESSION_COOKIE, { path: '/' })
}

export function parseCookies(header) {
  const cookies = {}
  if (!header) return cookies
  for (const part of header.split(';')) {
    const eq = part.indexOf('=')
    if (eq === -1) continue
    const name = part.slice(0, eq).trim()
    const value = part.slice(eq + 1).trim()
    try {
      cookies[name] = decodeURIComponent(value)
    } catch {
      cookies[name] = value
    }
  }
  return cookies
}

export function sessionTokenFromCookieHeader(header) {
  return parseCookies(header)[SESSION_COOKIE] || null
}

// Shared by the REST middleware and the WebSocket upgrade handler
export function userFromCookieHeader(header) {
  const token = sessionTokenFromCookieHeader(header)
  if (!token) return null

  const row = db.prepare(`
    SELECT u.id, u.email, s.expires_at
    FROM sessions s JOIN users u ON u.id = s.user_id
    WHERE s.token = ?
  `).get(token)
  if (!row) return null

  if (row.expires_at < Date.now()) {
    deleteSession(token)
    return null
  }
  return { id: row.id, email: row.email }
}

export function requireUser(req, res, next) {
  const user = userFromCookieHeader(req.headers.cookie)
  if (!user) return res.status(401).json({ error: 'Not signed in' })
  req.user = user
  next()
}

// Simple in-memory brute-force guard: max 10 failed logins per email+IP per 15 minutes
const LOGIN_WINDOW_MS = 15 * 60 * 1000
const MAX_FAILED_LOGINS = 10
const failedLogins = new Map()

function loginKey(ip, email) {
  return `${ip}|${email.toLowerCase()}`
}

export function isLoginBlocked(ip, email) {
  const entry = failedLogins.get(loginKey(ip, email))
  if (!entry) return false
  if (Date.now() - entry.first > LOGIN_WINDOW_MS) {
    failedLogins.delete(loginKey(ip, email))
    return false
  }
  return entry.count >= MAX_FAILED_LOGINS
}

export function recordFailedLogin(ip, email) {
  const key = loginKey(ip, email)
  const entry = failedLogins.get(key)
  if (!entry || Date.now() - entry.first > LOGIN_WINDOW_MS) {
    failedLogins.set(key, { first: Date.now(), count: 1 })
  } else {
    entry.count++
  }
}

export function clearFailedLogins(ip, email) {
  failedLogins.delete(loginKey(ip, email))
}
