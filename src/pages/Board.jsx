// ============================================
// SHARENOTE — Board.jsx (Complete Real-time Canvas)
// Real-time drawing sync, live cursors, persistence
// ============================================

import { useParams, Link, useNavigate } from 'react-router-dom'
import { Tldraw, useEditor, track } from 'tldraw'
import { useEffect, useState, useRef, useCallback } from 'react'
import { supabase } from '../supabaseClient'
import ChatSidebar from '../components/ChatSidebar'
import ShareModal from '../components/ShareModal'
import OnlineUsersSidebar from '../components/OnlineUsersSidebar'
import 'tldraw/tldraw.css'

export default function Board() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const [userId, setUserId] = useState(null)
  const [userEmail, setUserEmail] = useState(null)
  const [boardId, setBoardId] = useState(null)
  const [ownerId, setOwnerId] = useState(null)
  const [publicAccess, setPublicAccess] = useState('restricted')
  const [onlineUsers, setOnlineUsers] = useState(new Map())
  const [chatOpen, setChatOpen] = useState(true)
  const [usersOpen, setUsersOpen] = useState(true)
  const [shareModalOpen, setShareModalOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const isOwner = userId && ownerId && userId === ownerId
  const isReadOnly = !isOwner && publicAccess === 'viewer'

  // Load board info
  useEffect(() => {
    async function init() {
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) {
          alert('Authentication error. Please log in again.')
          return
        }
        setUserId(user.id)
        setUserEmail(user.email || 'Anonymous')

        const { data: board, error: boardError } = await supabase
          .from('boards')
          .select('id, owner_id, public_access')
          .eq('unique_slug', slug)
          .maybeSingle()

        if (boardError) throw boardError

        if (!board) {
          alert(`Board "${slug}" not found.`)
          navigate('/')
          return
        }

        setBoardId(board.id)
        setOwnerId(board.owner_id)
        setPublicAccess(board.public_access || 'restricted')

        if (board.owner_id !== user.id && board.public_access === 'restricted') {
          alert('You do not have access to this board.')
          navigate('/')
          return
        }
      } catch (error) {
        console.error('[Board] Init error:', error)
        alert('Failed to load board: ' + error.message)
      }
    }
    init()
  }, [slug, navigate])

  // Track online users via Supabase Presence
  useEffect(() => {
    if (!boardId || !userId || !userEmail) return

    const channel = supabase.channel(`users:${boardId}`, {
      config: { presence: { key: userId } }
    })

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState()
        const users = new Map()
        Object.values(state).forEach(presences => {
          presences.forEach(presence => users.set(presence.id, presence))
        })
        setOnlineUsers(users)
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            id: userId,
            email: userEmail,
            online_at: new Date().toISOString()
          })
        }
      })

    return () => supabase.removeChannel(channel)
  }, [boardId, userId, userEmail])

  // Delete board (owner only)
  const handleDeleteBoard = async () => {
    if (!isOwner) return

    const confirmed = window.confirm(
      `Are you sure you want to delete board "${slug}"?\n\nThis action cannot be undone.`
    )
    if (!confirmed) return

    try {
      setDeleting(true)
      const { error } = await supabase
        .from('boards')
        .delete()
        .eq('id', boardId)

      if (error) throw error
      alert('Board deleted successfully.')
      navigate('/')
    } catch (error) {
      console.error('[Board] Delete error:', error)
      alert('Failed to delete board: ' + error.message)
      setDeleting(false)
    }
  }

  if (!userId || !boardId) {
    return (
      <div style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0a0a0f'
      }}>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 16,
          color: 'var(--text-secondary)'
        }}>
          <div className="spinner" style={{ width: 40, height: 40 }} />
          <span>Connecting to board...</span>
        </div>
      </div>
    )
  }

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      background: '#0a0a0f'
    }}>
      {/* Top Header Bar */}
      <div style={{
        height: 60,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 20px',
        background: 'rgba(255, 255, 255, 0.06)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        zIndex: 100,
        flexShrink: 0
      }}>
        {/* Left: Back button */}
        <Link
          to="/"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 16px',
            fontSize: 13,
            fontWeight: 600,
            textDecoration: 'none',
            background: 'rgba(255, 255, 255, 0.08)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: 8,
            color: 'var(--text-primary)',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(139, 92, 246, 0.15)'
            e.currentTarget.style.borderColor = 'rgba(139, 92, 246, 0.4)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'
            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.12)'
          }}
        >
          <span>←</span>
          <span>Back</span>
        </Link>

        {/* Center: Room info */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <code style={{
            background: 'rgba(139, 92, 246, 0.15)',
            padding: '4px 10px',
            borderRadius: 6,
            fontFamily: 'monospace',
            color: '#8b5cf6',
            fontSize: 13
          }}>
            {slug}
          </code>
          {isReadOnly && (
            <span style={{
              padding: '4px 10px',
              fontSize: 11,
              fontWeight: 600,
              background: 'rgba(251, 191, 36, 0.15)',
              color: '#fbbf24',
              border: '1px solid rgba(251, 191, 36, 0.3)',
              borderRadius: 6,
              textTransform: 'uppercase'
            }}>
              👀 View Only
            </span>
          )}
        </div>

        {/* Right: Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Delete button (owner only) */}
          {isOwner && (
            <button
              onClick={handleDeleteBoard}
              disabled={deleting}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 16px',
                fontSize: 13,
                fontWeight: 600,
                background: deleting ? 'rgba(239, 68, 68, 0.1)' : 'rgba(239, 68, 68, 0.12)',
                color: deleting ? 'rgba(239, 68, 68, 0.5)' : '#ef4444',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: 8,
                cursor: deleting ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                if (!deleting) {
                  e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)'
                  e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.5)'
                }
              }}
              onMouseLeave={(e) => {
                if (!deleting) {
                  e.currentTarget.style.background = 'rgba(239, 68, 68, 0.12)'
                  e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.3)'
                }
              }}
            >
              <span>🗑️</span>
              <span>{deleting ? 'Deleting...' : 'Delete Board'}</span>
            </button>
          )}

          {/* Share button */}
          <button
            onClick={() => setShareModalOpen(true)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 16px',
              fontSize: 13,
              fontWeight: 600,
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: 8,
              color: 'var(--text-primary)',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(139, 92, 246, 0.15)'
              e.currentTarget.style.borderColor = 'rgba(139, 92, 246, 0.4)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.12)'
            }}
          >
            <span>🔗</span>
            <span>Share</span>
          </button>

          {/* Online users */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 16px',
            fontSize: 13,
            fontWeight: 600,
            background: 'rgba(255, 255, 255, 0.08)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: 8,
            color: 'var(--text-primary)'
          }}>
            <span style={{
              color: '#10b981',
              fontSize: 14,
              animation: 'pulse 2s ease-in-out infinite'
            }}>●</span>
            <span>{onlineUsers.size} online</span>
          </div>

          {/* Chat toggle */}
          <button
            onClick={() => setChatOpen(!chatOpen)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 16px',
              fontSize: 13,
              fontWeight: 600,
              background: chatOpen ? 'rgba(139, 92, 246, 0.15)' : 'rgba(255, 255, 255, 0.08)',
              border: chatOpen ? '1px solid rgba(139, 92, 246, 0.4)' : '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: 8,
              color: 'var(--text-primary)',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            <span>💬</span>
            <span>{chatOpen ? 'Hide' : 'Show'}</span>
          </button>

          {/* Users toggle */}
          <button
            onClick={() => setUsersOpen(!usersOpen)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 16px',
              fontSize: 13,
              fontWeight: 600,
              background: usersOpen ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.08)',
              border: usersOpen ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: 8,
              color: 'var(--text-primary)',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            <span>👥</span>
            <span>{usersOpen ? 'Hide' : 'Show'}</span>
          </button>
        </div>
      </div>

      {/* Canvas Area */}
      <div style={{
        flex: 1,
        display: 'flex',
        overflow: 'hidden',
        position: 'relative'
      }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <TldrawCanvas
            boardId={boardId}
            userId={userId}
            userEmail={userEmail}
            isReadOnly={isReadOnly}
          />
        </div>

        {chatOpen && (
          <ChatSidebar boardId={boardId} userId={userId} userEmail={userEmail} />
        )}

        {usersOpen && (
          <OnlineUsersSidebar
            users={onlineUsers}
            currentUserId={userId}
          />
        )}
      </div>

      {shareModalOpen && (
        <ShareModal
          boardId={boardId}
          ownerId={ownerId}
          currentUserId={userId}
          slug={slug}
          onClose={() => setShareModalOpen(false)}
        />
      )}
    </div>
  )
}

// ============================================
// TldrawCanvas — Wrapper that loads saved state, then renders <Tldraw>
// ============================================
function TldrawCanvas({ boardId, userId, userEmail, isReadOnly }) {
  const [initialSnapshot, setInitialSnapshot] = useState(undefined)
  const [isLoading, setIsLoading] = useState(true)

  // Load saved canvas state from database on mount
  useEffect(() => {
    if (!boardId) return

    async function loadSavedState() {
      try {
        const { data, error } = await supabase
          .from('boards')
          .select('canvas_data')
          .eq('id', boardId)
          .single()

        if (!error && data?.canvas_data) {
          console.log('[Canvas] Found saved state')
          setInitialSnapshot(data.canvas_data)
        } else {
          console.log('[Canvas] No saved state found')
          setInitialSnapshot(null)
        }
      } catch (err) {
        console.error('[Canvas] Load error:', err)
        setInitialSnapshot(null)
      } finally {
        setIsLoading(false)
      }
    }

    loadSavedState()
  }, [boardId])

  if (isLoading) {
    return (
      <div style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0a0a0f',
        color: 'var(--text-secondary)'
      }}>
        <div>
          <div className="spinner" style={{ margin: '0 auto 16px' }} />
          <div>Loading canvas...</div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <Tldraw
        autoFocus
        inferDarkMode
        onMount={(editor) => {
          // Load saved snapshot into the editor
          if (initialSnapshot && initialSnapshot.store) {
            try {
              const records = Object.values(initialSnapshot.store)
              // Filter out camera/instance records to avoid conflicts
              const contentRecords = records.filter(
                r => r.typeName !== 'camera' && r.typeName !== 'instance' && r.typeName !== 'instance_page_state'
              )
              if (contentRecords.length > 0) {
                editor.store.put(contentRecords)
                console.log('[Canvas] ✅ Loaded', contentRecords.length, 'records from DB')
              }
            } catch (err) {
              console.error('[Canvas] Snapshot load error:', err)
            }
          }

          // Set read-only mode
          if (isReadOnly) {
            editor.updateInstanceState({ isReadonly: true })
          }
        }}
      >
        <RealtimeSync
          boardId={boardId}
          userId={userId}
          enabled={!isReadOnly}
        />
        <LiveCursors
          boardId={boardId}
          userId={userId}
          userEmail={userEmail}
        />
        {isReadOnly && <ReadOnlyOverlay />}
      </Tldraw>
    </div>
  )
}

// ============================================
// RealtimeSync — Broadcasts drawing changes via Supabase channel
// Uses useEditor() hook (must be child of <Tldraw>)
// ============================================
function RealtimeSync({ boardId, userId, enabled }) {
  const editor = useEditor()
  const channelRef = useRef(null)
  const isSyncingRef = useRef(false)
  const saveTimeoutRef = useRef(null)

  useEffect(() => {
    if (!editor || !boardId || !enabled) return

    const channel = supabase.channel(`sync:${boardId}`)
    channelRef.current = channel

    // Listen to remote drawing changes
    channel
      .on('broadcast', { event: 'draw' }, ({ payload }) => {
        if (isSyncingRef.current || payload.senderId === userId) return

        try {
          isSyncingRef.current = true
          const { added, updated, removed } = payload

          editor.store.mergeRemoteChanges(() => {
            if (added && added.length > 0) {
              editor.store.put(added)
            }
            if (updated && updated.length > 0) {
              editor.store.put(updated)
            }
            if (removed && removed.length > 0) {
              editor.store.remove(removed.map(r => r.id))
            }
          })

          console.log('[Sync] Applied remote changes')
        } catch (error) {
          console.error('[Sync] Apply error:', error)
        } finally {
          setTimeout(() => { isSyncingRef.current = false }, 50)
        }
      })
      .subscribe()

    // Listen to local changes and broadcast them
    const unsubscribe = editor.store.listen((entry) => {
      if (isSyncingRef.current || entry.source !== 'user') return

      try {
        const changes = entry.changes
        const added = []
        const updated = []
        const removed = []

        // Collect only drawing content (not camera/viewport)
        if (changes.added) {
          Object.values(changes.added).forEach(record => {
            if (record.typeName !== 'camera' && record.typeName !== 'instance' && record.typeName !== 'instance_page_state') {
              added.push(record)
            }
          })
        }

        if (changes.updated) {
          Object.values(changes.updated).forEach(([_from, to]) => {
            if (to.typeName !== 'camera' && to.typeName !== 'instance' && to.typeName !== 'instance_page_state') {
              updated.push(to)
            }
          })
        }

        if (changes.removed) {
          Object.values(changes.removed).forEach(record => {
            if (record.typeName !== 'camera' && record.typeName !== 'instance' && record.typeName !== 'instance_page_state') {
              removed.push(record)
            }
          })
        }

        // Only broadcast if there are actual drawing changes
        const hasChanges = added.length > 0 || updated.length > 0 || removed.length > 0
        if (hasChanges) {
          channel.send({
            type: 'broadcast',
            event: 'draw',
            payload: { senderId: userId, added, updated, removed }
          })
        }
      } catch (error) {
        console.error('[Sync] Broadcast error:', error)
      }

      // Auto-save to database (debounced 2s)
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
      saveTimeoutRef.current = setTimeout(async () => {
        try {
          const allRecords = editor.store.allRecords()
          const snapshot = {
            store: Object.fromEntries(
              allRecords.map(record => [record.id, record])
            ),
            schema: { schemaVersion: 2, sequences: {} }
          }

          const { error } = await supabase
            .from('boards')
            .update({
              canvas_data: snapshot,
              updated_at: new Date().toISOString()
            })
            .eq('id', boardId)

          if (error) throw error
          console.log('[Sync] ✅ Auto-saved')
        } catch (error) {
          console.error('[Sync] Auto-save error:', error)
        }
      }, 2000)
    }, { source: 'user', scope: 'all' })

    return () => {
      unsubscribe()
      supabase.removeChannel(channel)
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    }
  }, [editor, boardId, userId, enabled])

  return null
}

// ============================================
// LiveCursors — Broadcasts and renders remote cursors
// Uses Supabase Presence in PAGE coordinates (zoom/pan independent)
// ============================================
const LiveCursors = track(function LiveCursors({ boardId, userId, userEmail }) {
  const editor = useEditor()
  const [peers, setPeers] = useState({})
  const channelRef = useRef(null)
  const lastSentRef = useRef(0)

  useEffect(() => {
    if (!editor || !boardId || !userId) return

    const userColor = getColorForUser(userId)
    const channel = supabase.channel(`cursors:${boardId}`, {
      config: { presence: { key: userId } }
    })
    channelRef.current = channel

    // Listen for presence sync (cursor positions from other users)
    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState()
        const peerData = {}
        Object.values(state).forEach(presences => {
          presences.forEach(presence => {
            if (presence.id !== userId) {
              peerData[presence.id] = presence
            }
          })
        })
        setPeers(peerData)
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            id: userId,
            email: userEmail,
            color: userColor,
            cx: null,
            cy: null,
          })
        }
      })

    // Track mouse movement and send to channel (throttled 50ms)
    const handlePointerMove = () => {
      const now = Date.now()
      if (now - lastSentRef.current < 50) return
      lastSentRef.current = now

      try {
        const pagePoint = editor.inputs.currentPagePoint
        if (!pagePoint) return

        channel.track({
          id: userId,
          email: userEmail,
          color: userColor,
          cx: Math.round(pagePoint.x * 10) / 10,
          cy: Math.round(pagePoint.y * 10) / 10,
        })
      } catch (e) {
        // silent
      }
    }

    // Use the tldraw container element to listen for pointer moves
    const container = editor.getContainer()
    if (container) {
      container.addEventListener('pointermove', handlePointerMove)
    }

    return () => {
      if (container) {
        container.removeEventListener('pointermove', handlePointerMove)
      }
      supabase.removeChannel(channel)
    }
  }, [editor, boardId, userId, userEmail])

  if (!editor) return null

  // Convert each peer's PAGE coordinates → screen coordinates using local camera
  const camera = editor.getCamera()

  return (
    <>
      {Object.values(peers).map(peer => {
        if (peer.cx == null || peer.cy == null) return null

        // Page coords → screen coords: screenX = (pageX + camera.x) * camera.z
        const screenX = (peer.cx + camera.x) * camera.z
        const screenY = (peer.cy + camera.y) * camera.z

        return (
          <PeerCursor
            key={peer.id}
            email={peer.email}
            color={peer.color}
            x={screenX}
            y={screenY}
          />
        )
      })}
    </>
  )
})

// ============================================
// PeerCursor — Figma-style arrow + name pill
// ============================================
function PeerCursor({ email, color, x, y }) {
  const displayName = email
    ? (email.includes('@') ? email.split('@')[0] : email)
    : 'User'

  return (
    <div style={{
      position: 'absolute',
      left: 0,
      top: 0,
      transform: `translate(${x}px, ${y}px)`,
      pointerEvents: 'none',
      zIndex: 99999,
      willChange: 'transform',
      transition: 'transform 80ms linear'
    }}>
      {/* Figma-style cursor arrow */}
      <svg
        width="18"
        height="22"
        viewBox="0 0 18 22"
        fill="none"
        style={{
          display: 'block',
          filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.35))'
        }}
      >
        <path
          d="M0.5 0.5L17 11L9.5 12.5L5 21L0.5 0.5Z"
          fill={color}
          stroke="white"
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
      </svg>

      {/* Name pill — positioned below-right of cursor arrow */}
      <div style={{
        position: 'absolute',
        left: 14,
        top: 20,
        background: color,
        color: '#fff',
        padding: '2px 8px',
        borderRadius: 4,
        fontSize: 11,
        fontWeight: 600,
        whiteSpace: 'nowrap',
        lineHeight: '16px',
        boxShadow: '0 1px 4px rgba(0,0,0,0.25)',
        letterSpacing: '0.01em',
        maxWidth: 120,
        overflow: 'hidden',
        textOverflow: 'ellipsis'
      }}>
        {displayName}
      </div>
    </div>
  )
}

// ============================================
// ReadOnlyOverlay — Shows "view only" badge
// ============================================
function ReadOnlyOverlay() {
  return (
    <div style={{
      position: 'absolute',
      bottom: 20,
      left: '50%',
      transform: 'translateX(-50%)',
      padding: '8px 16px',
      background: 'rgba(251, 191, 36, 0.15)',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      border: '1px solid rgba(251, 191, 36, 0.3)',
      borderRadius: 8,
      color: '#fbbf24',
      fontSize: 12,
      fontWeight: 600,
      pointerEvents: 'none',
      zIndex: 1000
    }}>
      👀 View-only mode • You cannot edit this board
    </div>
  )
}

// ============================================
// Helper: Generate consistent color per user
// ============================================
function getColorForUser(userId) {
  const colors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A',
    '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E2',
    '#F8B739', '#52B788', '#E07A5F', '#3D5A80'
  ]
  let hash = 0
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash)
  }
  return colors[Math.abs(hash) % colors.length]
}
