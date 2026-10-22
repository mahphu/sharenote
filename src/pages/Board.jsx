import { useParams, Link, useNavigate } from 'react-router-dom'
import { Tldraw, useEditor, track, Box } from 'tldraw'
import { getAssetUrls } from '@tldraw/assets/selfHosted'
import { useEffect, useState, useRef } from 'react'
import { api } from '../api'
import { acquireBoardSocket } from '../realtime'
import ChatSidebar from '../components/ChatSidebar'
import ShareModal from '../components/ShareModal'
import OnlineUsersSidebar from '../components/OnlineUsersSidebar'
import 'tldraw/tldraw.css'

// SVG icon components
function IconArrowLeft() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 12L6 8l4-4" />
    </svg>
  )
}
function IconTrash() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2.5 4h11M5.5 4V2.5h5V4M6.5 7v4.5M9.5 7v4.5M3.5 4l.75 9.5h7.5L12.5 4" />
    </svg>
  )
}
function IconLink() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6.5 9.5a3 3 0 004.243 0l2-2a3 3 0 00-4.243-4.243L7.5 4.257" />
      <path d="M9.5 6.5a3 3 0 00-4.243 0l-2 2a3 3 0 004.243 4.243L8.5 11.743" />
    </svg>
  )
}
function IconChat() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2.5 3h11v8h-6L4 13.5V11H2.5z" />
    </svg>
  )
}
function IconUsers() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="6" cy="5" r="2.5" />
      <path d="M1.5 13.5a4.5 4.5 0 019 0" />
      <circle cx="11.5" cy="5.5" r="2" />
      <path d="M14.5 13.5a3.5 3.5 0 00-4-3.46" />
    </svg>
  )
}

export default function Board({ user }) {
  const { slug } = useParams()
  const navigate = useNavigate()
  const userId = user.id
  const [boardId, setBoardId] = useState(null)
  const [ownerId, setOwnerId] = useState(null)
  const [publicAccess, setPublicAccess] = useState('restricted')
  const [onlineUsers, setOnlineUsers] = useState(new Map())
  const [chatOpen, setChatOpen] = useState(true)
  const [usersOpen, setUsersOpen] = useState(true)
  const [shareModalOpen, setShareModalOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const deletingRef = useRef(false)

  const isOwner = userId && ownerId && userId === ownerId
  const isReadOnly = !isOwner && publicAccess === 'viewer'

  useEffect(() => {
    let cancelled = false

    async function init() {
      try {
        const { board } = await api(`/boards/by-slug/${encodeURIComponent(slug)}`)
        if (cancelled) return
        setBoardId(board.id)
        setOwnerId(board.owner_id)
        setPublicAccess(board.public_access || 'restricted')
      } catch (error) {
        if (cancelled) return
        if (error.status === 404) {
          alert(`Board "${slug}" not found.`)
          navigate('/')
        } else if (error.status === 403) {
          alert('You do not have access to this board.')
          navigate('/')
        } else {
          console.error('[Board] Init error:', error)
          alert('Failed to load board: ' + error.message)
        }
      }
    }
    init()

    return () => { cancelled = true }
  }, [slug, navigate])

  // Presence + access changes pushed by the server
  useEffect(() => {
    if (!boardId) return

    const socket = acquireBoardSocket(boardId)
    const unsubscribers = [
      socket.on('presence', ({ users }) => {
        setOnlineUsers(new Map(users.map(u => [u.id, u])))
      }),
      socket.on('access', ({ public_access }) => {
        setPublicAccess(public_access)
      }),
      socket.on('forbidden', () => {
        alert('You no longer have access to this board.')
        navigate('/')
      }),
      socket.on('board-deleted', () => {
        if (deletingRef.current) return
        alert('This board was deleted by its owner.')
        navigate('/')
      })
    ]

    return () => {
      unsubscribers.forEach(off => off())
      socket.release()
    }
  }, [boardId, navigate])

  const handleDeleteBoard = async () => {
    if (!isOwner) return
    const confirmed = window.confirm(
      `Are you sure you want to delete board "${slug}"?\n\nThis action cannot be undone.`
    )
    if (!confirmed) return

    try {
      setDeleting(true)
      deletingRef.current = true
      await api(`/boards/${boardId}`, { method: 'DELETE' })
      alert('Board deleted successfully.')
      navigate('/')
    } catch (error) {
      console.error('[Board] Delete error:', error)
      alert('Failed to delete board: ' + error.message)
      deletingRef.current = false
      setDeleting(false)
    }
  }

  if (!userId || !boardId) {
    return (
      <div className="loading-page">
        <div className="spinner" style={{ width: 40, height: 40 }} />
        <span>Connecting to board...</span>
      </div>
    )
  }

  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg-primary)' }}>
      {/* Toolbar */}
      <div className="board-toolbar">
        <div className="board-toolbar-group">
          <Link to="/" className="board-toolbar-btn" title="Back to dashboard">
            <IconArrowLeft />
            <span>Back</span>
          </Link>

          <div className="board-toolbar-divider" />

          <span className="board-slug">{slug}</span>

          {isReadOnly && (
            <span className="board-badge board-badge--readonly">View only</span>
          )}
        </div>

        <div className="board-toolbar-group">
          {isOwner && (
            <button
              onClick={handleDeleteBoard}
              disabled={deleting}
              className="board-toolbar-btn board-toolbar-btn--danger"
              title="Delete board"
              style={deleting ? { opacity: 0.4, pointerEvents: 'none' } : undefined}
            >
              <IconTrash />
              <span>{deleting ? 'Deleting...' : 'Delete'}</span>
            </button>
          )}

          <button
            onClick={() => setShareModalOpen(true)}
            className="board-toolbar-btn"
            title="Share board"
          >
            <IconLink />
            <span>Share</span>
          </button>

          <div className="board-toolbar-divider" />

          <div className="board-toolbar-btn" style={{ cursor: 'default' }}>
            <span className="board-online-dot" />
            <span>{onlineUsers.size}</span>
          </div>

          <button
            onClick={() => setChatOpen(!chatOpen)}
            className={`board-toolbar-btn${chatOpen ? ' board-toolbar-btn--active' : ''}`}
            title={chatOpen ? 'Hide chat' : 'Show chat'}
          >
            <IconChat />
          </button>

          <button
            onClick={() => setUsersOpen(!usersOpen)}
            className={`board-toolbar-btn${usersOpen ? ' board-toolbar-btn--active' : ''}`}
            title={usersOpen ? 'Hide users' : 'Show users'}
          >
            <IconUsers />
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div className="board-canvas-area">
        <div className="board-canvas-wrap">
          <TldrawCanvas
            boardId={boardId}
            userId={userId}
            isReadOnly={isReadOnly}
          />
        </div>

        {chatOpen && (
          <ChatSidebar boardId={boardId} userId={userId} />
        )}

        {usersOpen && (
          <OnlineUsersSidebar users={onlineUsers} currentUserId={userId} />
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

// Must stay at module scope: a new object each render makes tldraw re-preload fonts and remount the editor
const assetUrls = getAssetUrls({
  baseUrl: '/tldraw-assets/'
})

function TldrawCanvas({ boardId, userId, isReadOnly }) {
  const [initialSnapshot, setInitialSnapshot] = useState(undefined)
  const [isLoading, setIsLoading] = useState(true)
  const editorRef = useRef(null)

  useEffect(() => {
    if (!boardId) return

    async function loadSavedState() {
      try {
        const { snapshot } = await api(`/boards/${boardId}/canvas`)
        setInitialSnapshot(snapshot)
      } catch (err) {
        console.error('[Canvas] Load error:', err)
        setInitialSnapshot(null)
      } finally {
        setIsLoading(false)
      }
    }

    loadSavedState()
  }, [boardId])

  // Global keyboard shortcuts interceptor
  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      if (!editorRef.current) return

      const activeEl = document.activeElement
      const isInput = activeEl && (
        activeEl.tagName === 'INPUT' ||
        activeEl.tagName === 'TEXTAREA' ||
        activeEl.isContentEditable
      )

      if (isInput) return

      // Don't intercept if modifier keys are pressed
      if (e.ctrlKey || e.metaKey || e.altKey) return

      const key = e.key.toLowerCase()
      let matched = false

      if (key === 'h') {
        editorRef.current.setCurrentTool('hand')
        matched = true
      } else if (key === 'v') {
        editorRef.current.setCurrentTool('select')
        matched = true
      } else if (key === 'd' || key === 'p') {
        editorRef.current.setCurrentTool('draw')
        matched = true
      } else if (key === 'e') {
        editorRef.current.setCurrentTool('eraser')
        matched = true
      } else if (key === 't') {
        editorRef.current.setCurrentTool('text')
        matched = true
      } else if (key === 'n') {
        editorRef.current.setCurrentTool('note')
        matched = true
      }

      if (matched) {
        editorRef.current.focus()
      }
    }

    window.addEventListener('keydown', handleGlobalKeyDown)
    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown)
    }
  }, [])

  if (isLoading) {
    return (
      <div style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-primary)',
        color: 'var(--text-secondary)'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div className="spinner" style={{ margin: '0 auto 12px' }} />
          <div style={{ fontSize: 13 }}>Loading canvas...</div>
        </div>
      </div>
    )
  }

  return (
    <div
      style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}
      onPointerDown={() => {
        if (editorRef.current) {
          editorRef.current.focus()
        }
      }}
    >
      <Tldraw
        autoFocus
        assetUrls={assetUrls}
        onMount={(editor) => {
          editorRef.current = editor
          editor.focus()

          if (initialSnapshot) {
            let loaded = false
            if (initialSnapshot.store && initialSnapshot.schema) {
              try {
                editor.store.loadSnapshot(initialSnapshot)
                loaded = true
                // loadSnapshot recreates the instance record with default screen bounds
                // (1080x720 at 0,0) and tldraw only re-measures on resize, which offsets
                // every pointer event by the toolbar height until the window changes size
                const rect = editor.getContainer().getBoundingClientRect()
                editor.updateViewportScreenBounds(new Box(rect.left, rect.top, rect.width, rect.height))
              } catch (err) {
                console.warn('[Canvas] loadSnapshot failed, falling back:', err)
              }
            }
            if (!loaded && initialSnapshot.store) {
              try {
                const records = Object.values(initialSnapshot.store).filter(isContentRecord)
                if (records.length > 0) {
                  editor.store.mergeRemoteChanges(() => {
                    for (const record of records) {
                      try { editor.store.put([record]) } catch {}
                    }
                  })
                }
              } catch (err) {
                console.error('[Canvas] Manual load failed:', err)
              }
            }
          }

          if (isReadOnly) {
            editor.updateInstanceState({ isReadonly: true })
          }
        }}
      >
        <RealtimeSync
          boardId={boardId}
          enabled={!isReadOnly}
        />
        <LiveCursors
          boardId={boardId}
          userId={userId}
        />
        {isReadOnly && <ReadOnlyOverlay />}
      </Tldraw>
    </div>
  )
}

const SKIP_TYPES = new Set([
  'camera', 'instance', 'instance_page_state', 'pointer', 'instance_presence'
])

function isContentRecord(r) {
  return r && r.typeName && !SKIP_TYPES.has(r.typeName)
}

const SYNC_BATCH_MS = 50

function RealtimeSync({ boardId, enabled }) {
  const editor = useEditor()
  const isSyncingRef = useRef(false)
  const saveTimeoutRef = useRef(null)
  const pendingRef = useRef(null)
  const batchTimerRef = useRef(null)

  useEffect(() => {
    if (!editor || !boardId) return

    const socket = acquireBoardSocket(boardId)

    // Viewers still receive live edits; only editors send and save them
    const offDraw = socket.on('draw', (payload) => {
      if (isSyncingRef.current) return

      try {
        isSyncingRef.current = true
        const { added, updated, removed } = payload

        editor.store.mergeRemoteChanges(() => {
          const toPut = [
            ...(added || []),
            ...(updated || [])
          ].filter(r => r && r.id && r.typeName)
          for (const record of toPut) {
            try { editor.store.put([record]) } catch {}
          }
          if (removed?.length > 0) {
            const ids = removed.map(r => r.id).filter(Boolean)
            if (ids.length > 0) {
              try { editor.store.remove(ids) } catch {}
            }
          }
        })
      } catch (error) {
        console.error('[Sync] Apply error:', error)
      } finally {
        isSyncingRef.current = false
      }
    })

    if (!enabled) {
      return () => {
        offDraw()
        socket.release()
      }
    }

    function flushBatch() {
      batchTimerRef.current = null
      const batch = pendingRef.current
      if (!batch) return
      pendingRef.current = null

      if (batch.added.length === 0 && batch.updated.length === 0 && batch.removed.length === 0) return

      socket.send('draw', { added: batch.added, updated: batch.updated, removed: batch.removed })
    }

    function mergeToBatch(changes) {
      if (!pendingRef.current) {
        pendingRef.current = { addedMap: {}, updatedMap: {}, removedSet: new Set(), added: [], updated: [], removed: [] }
      }
      const p = pendingRef.current

      if (changes.added) {
        for (const record of Object.values(changes.added)) {
          if (!isContentRecord(record)) continue
          p.removedSet.delete(record.id)
          delete p.updatedMap[record.id]
          p.addedMap[record.id] = { ...record }
        }
      }
      if (changes.updated) {
        for (const [, to] of Object.values(changes.updated)) {
          if (!isContentRecord(to)) continue
          if (p.addedMap[to.id]) {
            p.addedMap[to.id] = { ...to }
          } else {
            p.updatedMap[to.id] = { ...to }
          }
        }
      }
      if (changes.removed) {
        for (const record of Object.values(changes.removed)) {
          if (!isContentRecord(record)) continue
          if (p.addedMap[record.id]) {
            delete p.addedMap[record.id]
          } else {
            delete p.updatedMap[record.id]
            p.removedSet.add(record.id)
          }
        }
      }

      p.added = Object.values(p.addedMap)
      p.updated = Object.values(p.updatedMap)
      p.removed = [...p.removedSet].map(id => ({ id }))
    }

    const unsubscribe = editor.store.listen((entry) => {
      if (isSyncingRef.current) return
      if (entry.source !== 'user') return

      mergeToBatch(entry.changes)

      if (batchTimerRef.current === null) {
        batchTimerRef.current = setTimeout(flushBatch, SYNC_BATCH_MS)
      }

      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
      saveTimeoutRef.current = setTimeout(async () => {
        try {
          const snapshot = editor.store.getSnapshot()
          await api(`/boards/${boardId}/canvas`, { method: 'PUT', body: { snapshot } })
        } catch (error) {
          console.error('[Sync] Auto-save error:', error)
        }
      }, 3000)
    }, { source: 'user', scope: 'all' })

    return () => {
      unsubscribe()
      if (batchTimerRef.current !== null) {
        clearTimeout(batchTimerRef.current)
        flushBatch()
      }
      offDraw()
      socket.release()
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    }
  }, [editor, boardId, enabled])

  return null
}

const CURSOR_THROTTLE_MS = 100
const CURSOR_MOVE_THRESHOLD = 2

const LiveCursors = track(function LiveCursors({ boardId, userId }) {
  const editor = useEditor()
  const [peers, setPeers] = useState({})
  const peersRef = useRef({})
  const lastSentRef = useRef({ time: 0, x: 0, y: 0 })
  const rafRef = useRef(null)

  useEffect(() => {
    if (!editor || !boardId || !userId) return

    const socket = acquireBoardSocket(boardId)

    function schedulePeersUpdate() {
      if (rafRef.current !== null) return
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null
        setPeers({ ...peersRef.current })
      })
    }

    const offPresence = socket.on('presence', ({ users }) => {
      const activeIds = new Set()
      let changed = false
      const next = { ...peersRef.current }

      users.forEach(presence => {
        if (presence.id === userId) return
        activeIds.add(presence.id)
        const existing = next[presence.id]
        if (!existing || existing.email !== presence.email) {
          next[presence.id] = {
            ...existing,
            id: presence.id,
            email: presence.email,
            color: getColorForUser(presence.id),
            cx: existing?.cx ?? null,
            cy: existing?.cy ?? null
          }
          changed = true
        }
      })

      for (const id of Object.keys(next)) {
        if (!activeIds.has(id)) {
          delete next[id]
          changed = true
        }
      }

      if (changed) {
        peersRef.current = next
        schedulePeersUpdate()
      }
    })

    const offCursor = socket.on('cursor', (payload) => {
      if (payload.id === userId) return
      const existing = peersRef.current[payload.id]
      if (!existing) return

      peersRef.current = {
        ...peersRef.current,
        [payload.id]: { ...existing, cx: payload.cx, cy: payload.cy }
      }
      schedulePeersUpdate()
    })

    const handlePointerMove = () => {
      const now = Date.now()
      const last = lastSentRef.current
      if (now - last.time < CURSOR_THROTTLE_MS) return

      try {
        const pagePoint = editor.inputs.currentPagePoint
        if (!pagePoint) return

        const cx = Math.round(pagePoint.x)
        const cy = Math.round(pagePoint.y)

        if (Math.abs(cx - last.x) < CURSOR_MOVE_THRESHOLD &&
            Math.abs(cy - last.y) < CURSOR_MOVE_THRESHOLD) return

        lastSentRef.current = { time: now, x: cx, y: cy }

        socket.send('cursor', { cx, cy })
      } catch (e) {
        // silent
      }
    }

    const container = editor.getContainer()
    if (container) {
      container.addEventListener('pointermove', handlePointerMove)
    }

    return () => {
      if (container) {
        container.removeEventListener('pointermove', handlePointerMove)
      }
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
      offPresence()
      offCursor()
      socket.release()
    }
  }, [editor, boardId, userId])

  if (!editor) return null

  const camera = editor.getCamera()

  return (
    <>
      {Object.values(peers).map(peer => {
        if (peer.cx == null || peer.cy == null) return null

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
      <svg
        width="16"
        height="20"
        viewBox="0 0 16 20"
        fill="none"
        style={{ display: 'block', filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.4))' }}
      >
        <path
          d="M0.5 0.5L14.5 10L8 11.5L4 19L0.5 0.5Z"
          fill={color}
          stroke="rgba(255,255,255,0.9)"
          strokeWidth="1"
          strokeLinejoin="round"
        />
      </svg>

      <div style={{
        position: 'absolute',
        left: 12,
        top: 18,
        background: color,
        color: '#fff',
        padding: '1px 6px',
        borderRadius: 3,
        fontSize: 10,
        fontWeight: 600,
        whiteSpace: 'nowrap',
        lineHeight: '15px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
        maxWidth: 100,
        overflow: 'hidden',
        textOverflow: 'ellipsis'
      }}>
        {displayName}
      </div>
    </div>
  )
}

function ReadOnlyOverlay() {
  return (
    <div className="board-readonly-banner">
      View-only mode
    </div>
  )
}

function getColorForUser(userId) {
  const colors = [
    '#e06c75', '#56b6c2', '#61afef', '#e5c07b',
    '#98c379', '#c678dd', '#d19a66', '#be5046',
    '#7ec699', '#82aaff', '#c792ea', '#f78c6c'
  ]
  let hash = 0
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash)
  }
  return colors[Math.abs(hash) % colors.length]
}
