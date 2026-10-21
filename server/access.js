// ============================================
// SHARENOTE — Board permissions (replaces the old Supabase RLS policies)
//   restricted: owner only
//   viewer:     anyone signed in with the link can view
//   editor:     anyone signed in with the link can edit
// ============================================

import { db } from './db.js'

const BOARD_COLUMNS = 'id, owner_id, unique_slug, title, public_access, created_at, updated_at'

export function getBoardById(id) {
  return db.prepare(`SELECT ${BOARD_COLUMNS} FROM boards WHERE id = ?`).get(id)
}

export function getBoardBySlug(slug) {
  return db.prepare(`SELECT ${BOARD_COLUMNS} FROM boards WHERE unique_slug = ?`).get(slug)
}

export function listVisibleBoards(userId) {
  return db.prepare(`
    SELECT ${BOARD_COLUMNS} FROM boards
    WHERE owner_id = ? OR public_access IN ('viewer', 'editor')
    ORDER BY created_at DESC
  `).all(userId)
}

export function isOwner(user, board) {
  return !!user && !!board && board.owner_id === user.id
}

export function canView(user, board) {
  return isOwner(user, board) || board?.public_access === 'viewer' || board?.public_access === 'editor'
}

export function canEdit(user, board) {
  return isOwner(user, board) || board?.public_access === 'editor'
}
