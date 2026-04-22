import { useEffect, useState, useRef } from 'react'
import { supabase } from './supabaseClient'

// ID Độc nhất cho mỗi Tab (Chống lỗi 2 người trùng tên)
const SESSION_ID = crypto.randomUUID()
const COLORS = ['#e03131','#1971c2','#2f9e44','#e67700','#862e9c','#c2255c','#0c8599']
const MY_COLOR = COLORS[Math.floor(Math.random() * COLORS.length)]

export function useMultiplayer({ activeNote, editor, userName }) {
  const [remoteCursors, setRemoteCursors] = useState({})
  const channelRef = useRef(null)
  const lastCursorSend = useRef(0)

  useEffect(() => {
    if (!editor || !activeNote) return

    if (channelRef.current) supabase.removeChannel(channelRef.current)

// SAU KHI SỬA (Chống lỗi tiếng Việt & dấu cách):
const safeRoomId = encodeURIComponent(activeNote)
const channel = supabase.channel(`sync-room:${safeRoomId}`)

    // 1. NHẬN TỌA ĐỘ CHUỘT
    channel.on('broadcast', { event: 'cursor' }, ({ payload }) => {
      if (payload.sessionId === SESSION_ID) return
      setRemoteCursors(prev => ({
        ...prev,
        [payload.sessionId]: { ...payload, lastUpdate: Date.now() } // Lưu kèm thời gian
      }))
    })

    // 2. NHẬN NÉT VẼ TỨC THÌ (0.1s)
    channel.on('broadcast', { event: 'draw' }, ({ payload }) => {
      if (payload.sessionId === SESSION_ID) return
      
      // Áp dụng nét vẽ của bạn bè lên bảng của mình trong chớp mắt
      editor.store.mergeRemoteChanges(() => {
        const { added, updated, removed } = payload.changes
        if (added && Object.keys(added).length > 0) editor.store.put(Object.values(added))
        if (updated && Object.keys(updated).length > 0) editor.store.put(Object.values(updated).map(u => u[1]))
        if (removed && Object.keys(removed).length > 0) editor.store.remove(Object.keys(removed))
      })
    })

    channel.subscribe()
    channelRef.current = channel

    // --- GỬI DỮ LIỆU ĐI ---

    // Gửi vị trí chuột (Giới hạn 20 lần/giây để không sập mạng)
    const handlePointerMove = (e) => {
      const now = Date.now()
      if (now - lastCursorSend.current < 50) return
      lastCursorSend.current = now

      const pagePoint = editor.screenToPage({ x: e.clientX, y: e.clientY })
      channel.send({
        type: 'broadcast', event: 'cursor',
        payload: { sessionId: SESSION_ID, userName, color: MY_COLOR, x: pagePoint.x, y: pagePoint.y }
      })
    }
    window.addEventListener('pointermove', handlePointerMove)

    // Gửi nét vẽ tức thì ngay khi tay đang di chuyển
    const unsubStore = editor.store.listen((e) => {
      if (e.source === 'user') {
        const filteredUpdates = Object.keys(e.changes.updated).filter(id => !id.startsWith('instance'))
        if (Object.keys(e.changes.added).length > 0 || Object.keys(e.changes.removed).length > 0 || filteredUpdates.length > 0) {
          channel.send({
            type: 'broadcast', event: 'draw',
            payload: { sessionId: SESSION_ID, changes: e.changes }
          })
        }
      }
    })

    // Dọn dẹp con trỏ khi bạn bè đóng tab (Xóa sau 3 giây không cử động)
    const cleaner = setInterval(() => {
      const now = Date.now()
      setRemoteCursors(prev => {
        let changed = false
        const next = { ...prev }
        for (const key in next) {
          if (now - next[key].lastUpdate > 3000) { delete next[key]; changed = true }
        }
        return changed ? next : prev
      })
    }, 1000)

    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      unsubStore()
      clearInterval(cleaner)
      supabase.removeChannel(channel)
    }
  }, [activeNote, editor, userName])

  return { remoteCursors }
}