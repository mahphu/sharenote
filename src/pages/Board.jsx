// ============================================
// SHARENOTE — Board.jsx (Complete Real-time Canvas)
// Real-time sync, live cursors, continuous persistence
// ============================================

import { useParams, Link, useNavigate } from 'react-router-dom'
import { Tldraw, useEditor } from 'tldraw'
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

  // Track online users
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
      `Are you sure you want to delete board "${slug}"?\n\nThis action cannot be undone. All drawings and messages will be permanently deleted.`
    )

    if (!confirmed) return

    try {
      setDeleting(true)

      // Delete board from database
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
      <>
        <div className="bg-mesh" />
        <div className="board-room">
          <div className="board-room-card">
            <div className="spinner" />
            <p style={{ color: 'var(--text-secondary)', marginTop: 16 }}>
              Connecting to room...
            </p>
          </div>
        </div>
      </>
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

// Tldraw canvas with real-time sync and live cursors
function TldrawCanvas({ boardId, userId, userEmail, isReadOnly }) {
  const [store, setStore] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  // Initialize store
  useEffect(() => {
    if (!boardId) return

    let mounted = true

    async function init() {
      try {
        const { createTLStore, defaultShapeUtils } = await import('tldraw')

        if (!mounted) return

        const tlStore = createTLStore({ shapeUtils: defaultShapeUtils })

        // Load saved state
        const { data, error } = await supabase
          .from('boards')
          .select('canvas_data')
          .eq('id', boardId)
          .single()

        if (!error && data?.canvas_data) {
          try {
            const snapshot = data.canvas_data

            // Load records vào store
            if (snapshot.store) {
              const records = Object.values(snapshot.store)
              console.log('[Canvas] Loading', records.length, 'records')

              tlStore.put(records)
              console.log('[Canvas] ✅ Loaded saved state')
            }
          } catch (err) {
            console.error('[Canvas] Load error:', err)
          }
        } else {
          console.log('[Canvas] No saved state found')
        }

        setStore(tlStore)
        setIsLoading(false)
      } catch (error) {
        console.error('[TldrawCanvas] Init error:', error)
        if (mounted) alert('Failed to initialize canvas')
      }
    }

    init()

    return () => { mounted = false }
  }, [boardId])

  if (isLoading || !store) {
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
    <div className="tldraw-dark" style={{ width: '100%', height: '100%' }}>
      <Tldraw
        store={store}
        autoFocus
        readOnly={isReadOnly}
      >
        <RealtimeSync
          store={store}
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

// Real-time sync component — uses useEditor() hook (child of <Tldraw>)
function RealtimeSync({ store, boardId, userId, enabled }) {
  const editor = useEditor()
  const channelRef = useRef(null)
  const isSyncingRef = useRef(false)
  const saveTimeoutRef = useRef(null)

  // Broadcast changes
  useEffect(() => {
    if (!store || !boardId || !enabled) return

    const channel = supabase.channel(`sync:${boardId}`)
    channelRef.current = channel

    // Listen to remote changes
    channel
      .on('broadcast', { event: 'change' }, ({ payload }) => {
        if (isSyncingRef.current || payload.userId === userId) return

        try {
          isSyncingRef.current = true
          const { changes } = payload

          store.mergeRemoteChanges(() => {
            // Chỉ đồng bộ shapes (nội dung vẽ), không đồng bộ camera/viewport
            if (changes.added) {
              Object.values(changes.added).forEach(record => {
                // Bỏ qua camera và instance records
                if (record.typeName !== 'camera' && record.typeName !== 'instance') {
                  store.put([record])
                }
              })
            }
            if (changes.updated) {
              Object.values(changes.updated).forEach(([_, record]) => {
                // Bỏ qua camera và instance records
                if (record.typeName !== 'camera' && record.typeName !== 'instance') {
                  store.put([record])
                }
              })
            }
            if (changes.removed) {
              Object.keys(changes.removed).forEach(id => {
                // Bỏ qua camera và instance records
                const record = changes.removed[id]
                if (record.typeName !== 'camera' && record.typeName !== 'instance') {
                  store.remove([id])
                }
              })
            }
          })

          console.log('[Sync] Applied remote changes (content only)')
        } catch (error) {
          console.error('[Sync] Apply error:', error)
        } finally {
          setTimeout(() => { isSyncingRef.current = false }, 50)
        }
      })
      .subscribe()

    // Broadcast local changes
    const unsubscribe = store.listen((entry) => {
      if (isSyncingRef.current || entry.source !== 'user') return

      try {
        const changes = entry.changes

        // Chỉ broadcast shapes (nội dung vẽ), không broadcast camera/viewport
        const filteredChanges = {
          added: {},
          updated: {},
          removed: {}
        }

        if (changes.added) {
          Object.entries(changes.added).forEach(([id, record]) => {
            if (record.typeName !== 'camera' && record.typeName !== 'instance') {
              filteredChanges.added[id] = record
            }
          })
        }

        if (changes.updated) {
          Object.entries(changes.updated).forEach(([id, [from, to]]) => {
            if (to.typeName !== 'camera' && to.typeName !== 'instance') {
              filteredChanges.updated[id] = [from, to]
            }
          })
        }

        if (changes.removed) {
          Object.entries(changes.removed).forEach(([id, record]) => {
            if (record.typeName !== 'camera' && record.typeName !== 'instance') {
              filteredChanges.removed[id] = record
            }
          })
        }

        // Chỉ broadcast nếu có thay đổi thực sự
        const hasChanges =
          Object.keys(filteredChanges.added).length > 0 ||
          Object.keys(filteredChanges.updated).length > 0 ||
          Object.keys(filteredChanges.removed).length > 0

        if (hasChanges) {
          channel.send({
            type: 'broadcast',
            event: 'change',
            payload: {
              userId,
              changes: filteredChanges,
              timestamp: Date.now()
            }
          })
          console.log('[Sync] Broadcasted content changes')
        }
      } catch (error) {
        console.error('[Sync] Broadcast error:', error)
      }

      // Auto-save to database (debounced)
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
      saveTimeoutRef.current = setTimeout(async () => {
        try {
          console.log('[Sync] Starting auto-save...')

          // Lấy tất cả records từ store
          const allRecords = store.allRecords()
          const snapshot = {
            store: Object.fromEntries(
              allRecords.map(record => [record.id, record])
            ),
            schema: {
              schemaVersion: 2,
              sequences: {}
            }
          }

          console.log('[Sync] Snapshot records:', allRecords.length)

          const { error } = await supabase
            .from('boards')
            .update({
              canvas_data: snapshot,
              updated_at: new Date().toISOString()
            })
            .eq('id', boardId)

          if (error) {
            console.error('[Sync] Auto-save failed:', error)
            throw error
          }

          console.log('[Sync] ✅ Auto-saved to database successfully')
        } catch (error) {
          console.error('[Sync] Auto-save error:', error)
          // Không alert nữa vì có thể spam
        }
      }, 2000)
    }, { source: 'user', scope: 'all' })

    return () => {
      unsubscribe()
      supabase.removeChannel(channel)
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    }
  }, [store, boardId, userId, enabled])

  return null
}

// Live cursors component — uses useEditor() hook (child of <Tldraw>)
function LiveCursors({ boardId, userId, userEmail }) {
  const editor = useEditor()
  const [peers, setPeers] = useState({})
  const channelRef = useRef(null)
  const rafRef = useRef(null)

  useEffect(() => {
    if (!editor || !boardId || !userId) {
      console.log('[Cursors] Missing deps:', { editor: !!editor, boardId, userId })
      return
    }

    console.log('[Cursors] Initializing for user:', userId)

    const userColor = getColorForUser(userId)
    const channel = supabase.channel(`cursors:${boardId}`, {
      config: { presence: { key: userId } }
    })
    channelRef.current = channel

    // Track presence state
    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState()
        const peerData = {}

        Object.values(state).forEach(presences => {
          presences.forEach(presence => {
            if (presence.id !== userId) {
              peerData[presence.id] = presence
              // console.log('[Cursors] Peer data:', presence)
            }
          })
        })

        setPeers(peerData)
        // console.log('[Cursors] Active peers:', Object.keys(peerData).length)
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        console.log('[Cursors] Peer joined:', key)
      })
      .on('presence', { event: 'leave' }, ({ key }) => {
        console.log('[Cursors] Peer left:', key)
      })
      .subscribe(async (status) => {
        console.log('[Cursors] Channel status:', status)
        if (status === 'SUBSCRIBED') {
          await channel.track({
            id: userId,
            email: userEmail,
            color: userColor,
            cursor: { x: 0, y: 0 },
            timestamp: Date.now()
          })
          console.log('[Cursors] Initial track sent')
        }
      })

    // Cursor position tracking with RAF for smooth updates
    let lastSentTime = 0
    const THROTTLE_MS = 40 // ~25fps for smoother updates

    const updateCursor = () => {
      const now = Date.now()

      // Throttle to ~25 updates per second for smoother feel
      if (now - lastSentTime < THROTTLE_MS) {
        rafRef.current = requestAnimationFrame(updateCursor)
        return
      }

      try {
        // Get screen coordinates
        const screenPoint = editor.inputs.currentScreenPoint

        if (screenPoint && (screenPoint.x !== 0 || screenPoint.y !== 0)) {
          channel.track({
            id: userId,
            email: userEmail,
            color: userColor,
            cursor: {
              x: Math.round(screenPoint.x),
              y: Math.round(screenPoint.y)
            },
            timestamp: now
          })

          lastSentTime = now
        }
      } catch (error) {
        console.error('[Cursors] Update error:', error)
      }

      rafRef.current = requestAnimationFrame(updateCursor)
    }

    // Start continuous cursor tracking
    rafRef.current = requestAnimationFrame(updateCursor)
    console.log('[Cursors] Started cursor tracking')

    // Set user preferences in tldraw
    try {
      editor.user.updateUserPreferences({
        id: userId,
        name: userEmail,
        color: userColor
      })
      console.log('[Cursors] User preferences set')
    } catch (error) {
      console.error('[Cursors] User preferences error:', error)
    }

    // Cleanup
    return () => {
      console.log('[Cursors] Cleanup')
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
      }
      supabase.removeChannel(channel)
    }
  }, [editor, boardId, userId, userEmail])

  // Render peer cursors
  // console.log('[Cursors] Rendering', Object.keys(peers).length, 'peer cursors')

  return (
    <>
      {Object.values(peers).map(peer => {
        const x = peer.cursor?.x ?? 0
        const y = peer.cursor?.y ?? 0
        // console.log('[Cursors] Rendering peer:', peer.email, 'at', x, y)

        return (
          <PeerCursor
            key={peer.id}
            email={peer.email}
            color={peer.color}
            x={x}
            y={y}
          />
        )
      })}
    </>
  )
}

// Peer cursor component
function PeerCursor({ email, color, x, y }) {
  // Get short name from email
  const displayName = email ? (email.includes('@') ? email.split('@')[0] : email) : 'User'

  return (
    <div style={{
      position: 'fixed',
      left: 0,
      top: 0,
      transform: `translate(${x}px, ${y}px)`,
      pointerEvents: 'none',
      zIndex: 99999,
      willChange: 'transform',
      transition: 'transform 0.08s cubic-bezier(0.25, 0.1, 0.25, 1)'
    }}>
      {/* Cursor arrow */}
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        style={{
          display: 'block',
          filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.4))'
        }}
      >
        <path
          d="M5.65376 12.3673L14.8516 21.5652C15.5909 22.3045 16.8279 22.0714 17.2611 21.1228L22.5528 10.6021C22.9859 9.65348 22.1775 8.61169 21.1491 8.78165L7.12345 10.9712C6.09501 11.1412 5.6444 12.3481 6.34444 13.0481L9.48146 16.185"
          fill={color}
          stroke="white"
          strokeWidth="1.5"
        />
      </svg>

      {/* Name label - positioned below and to the right */}
      <div style={{
        position: 'absolute',
        left: 24,
        top: 24,
        background: color,
        color: '#fff',
        padding: '4px 10px',
        borderRadius: 12,
        fontSize: 11,
        fontWeight: 600,
        whiteSpace: 'nowrap',
        boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
        lineHeight: '16px'
      }}>
        {displayName}
      </div>
    </div>
  )
}

// Read-only overlay
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

// Generate consistent color per user
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
