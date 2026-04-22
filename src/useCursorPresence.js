import { useEffect, useRef, useState } from 'react'
import { supabase } from './supabaseClient'

const COLORS = ['#e03131','#1971c2','#2f9e44','#e67700','#862e9c','#c2255c','#0c8599']
function colorFromKey(key) {
  let h = 0
  for (const ch of key) h = (h * 31 + ch.charCodeAt(0)) % COLORS.length
  return COLORS[h]
}

// [THUẬT TOÁN CLAUDE]: Tạo ID độc nhất cho mỗi tab trình duyệt
const SESSION_ID = crypto.randomUUID(); 

export function useCursorPresence({ activeNote, editor, userName, isTransitioning }) {
  const [remoteCursors, setRemoteCursors] = useState({}) 
  const channelRef = useRef(null)
  const lastTick = useRef(0)

  useEffect(() => {
    if (!editor || !activeNote) return

    if (channelRef.current) {
      channelRef.current.untrack()
      supabase.removeChannel(channelRef.current)
    }

    const ch = supabase.channel(`presence:${activeNote}`, {
      config: { presence: { key: SESSION_ID } } // Dùng SessionID thay vì UserName
    })

    ch.on('presence', { event: 'sync' }, () => {
        const state = ch.presenceState()
        const next = {}
        for (const [key, arr] of Object.entries(state)) {
          if (key === SESSION_ID) continue // Bỏ qua chính tab này
          const p = arr[arr.length - 1] 
          if (p?.x != null) {
            next[key] = { x: p.x, y: p.y, userName: p.userName, color: colorFromKey(key) }
          }
        }
        setRemoteCursors(next)
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await ch.track({ userName, x: null, y: null })
        }
      })

    channelRef.current = ch

    const handlePointerMove = (e) => {
      if (isTransitioning.current) return 
      const now = Date.now()
      if (now - lastTick.current < 40) return 
      lastTick.current = now

      const pagePoint = editor.screenToPage({ x: e.clientX, y: e.clientY })
      ch.track({ userName, x: pagePoint.x, y: pagePoint.y })
    }

    window.addEventListener('pointermove', handlePointerMove)

    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      if (channelRef.current) {
        channelRef.current.untrack()
        supabase.removeChannel(channelRef.current)
      }
      setRemoteCursors({})
    }
  }, [activeNote, editor, userName, isTransitioning]) 

  return { remoteCursors }
}