// ============================================
// SHARENOTE — Board permissions (replaces the old Supabase RLS policies)
//   public_access (the share link):
//     restricted: no access through the link
//     viewer:     anyone signed in with the link can view
//     editor:     anyone signed in with the link can edit
//   board_members: people the owner invited by email, as viewer or editor
// A user's role is the stronger of their invitation and the link access.
// ============================================

import { db } from './db.js'

const BOARD_COLUMNS = 'id, owner_id, unique_slug, title, public_access, created_at, updated_at'

export function getBoardById(id) {
  return db.prepare(`SELECT ${BOARD_COLUMNS} FROM boards WHERE id = ?`).get(id)
}

export function getBoardBySlug(slug) {
  return db.prepare(`SELECT ${BOARD_COLUMNS} FROM boards WHERE unique_slug = ?`).get(slug)
}

function getMemberRole(userId, boardId) {
  return db.prepare('SELECT role FROM board_members WHERE board_id = ? AND user_id = ?')
    .get(boardId, userId)?.role ?? null
}

// 'owner' | 'editor' | 'viewer' | null
function combineRole(userId, board, memberRole) {
  if (board.owner_id === userId) return 'owner'
  if (memberRole === 'editor' || board.public_access === 'editor') return 'editor'
  if (memberRole === 'viewer' || board.public_access === 'viewer') return 'viewer'
  return null
}

export function roleFor(user, board) {
  if (!user || !board) return null
  return combineRole(user.id, board, getMemberRole(user.id, board.id))
}

// Board row plus the caller's role, as sent to the client
export function withRole(user, board) {
  return { ...board, my_role: roleFor(user, board) }
}

// Owned boards, boards the user was invited to, and link-shared boards they have opened
export function listVisibleBoards(userId) {
  const rows = db.prepare(`
    SELECT b.id, b.owner_id, b.unique_slug, b.title, b.public_access, b.created_at, b.updated_at,
           u.email AS owner_email, m.role AS member_role
    FROM boards b
    JOIN users u ON u.id = b.owner_id
    LEFT JOIN board_members m ON m.board_id = b.id AND m.user_id = ?
    LEFT JOIN board_visits v ON v.board_id = b.id AND v.user_id = ?
    WHERE b.owner_id = ?
       OR m.user_id IS NOT NULL
       OR (v.user_id IS NOT NULL AND b.public_access IN ('viewer', 'editor'))
    ORDER BY b.created_at DESC
  `).all(userId, userId, userId)

  return rows.map(({ member_role, ...board }) => ({
    ...board,
    my_role: combineRole(userId, board, member_role)
  }))
}

export function listMembers(boardId) {
  return db.prepare(`
    SELECT u.id, u.email, m.role, m.added_at
    FROM board_members m JOIN users u ON u.id = m.user_id
    WHERE m.board_id = ?
    ORDER BY m.added_at
  `).all(boardId)
}

export function isOwner(user, board) {
  return !!user && !!board && board.owner_id === user.id
}

export function canView(user, board) {
  return roleFor(user, board) !== null
}

export function canEdit(user, board) {
  const role = roleFor(user, board)
  return role === 'owner' || role === 'editor'
}
