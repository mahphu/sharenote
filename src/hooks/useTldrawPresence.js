// ============================================
// SHARENOTE — useTldrawPresence Hook
// Live cursors via Supabase Presence
// ============================================

import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

export function useTldrawPresence({ editor, boardId, userId, userEmail }) {
  const [peers, setPeers] = useState({})

  useEffect(() => {
    if (!editor || !boardId || !userId) return

    console.log('[TldrawPresence] Starting presence tracking')

    const channel = supabase.channel(`presence:${boardId}`, {
      config: {
        presence: { key: userId }
      }
    })

    // Track peer presence
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
        console.log('[TldrawPresence] Peers updated:', Object.keys(peerData).length)
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        console.log('[TldrawPresence] Peer joined:', key)
      })
      .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
        console.log('[TldrawPresence] Peer left:', key)
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          // Track own presence
          await channel.track({
            id: userId,
            email: userEmail,
            color: getColorForUser(userId),
            cursor: { x: 0, y: 0 },
            timestamp: Date.now()
          })
        }
      })

    // Update cursor position
    const handlePointerMove = (info) => {
      try {
        const { x, y } = editor.inputs.currentPagePoint

        channel.track({
          id: userId,
          email: userEmail,
          color: getColorForUser(userId),
          cursor: { x, y },
          timestamp: Date.now()
        })
      } catch (error) {
        // Silently handle
      }
    }

    // Throttle cursor updates
    let lastUpdate = 0
    const throttledMove = () => {
      const now = Date.now()
      if (now - lastUpdate > 50) {
        lastUpdate = now
        handlePointerMove()
      }
    }

    editor.on('pointer-move', throttledMove)

    // Update user preferences
    try {
      editor.user.updateUserPreferences({
        id: userId,
        name: userEmail,
        color: getColorForUser(userId)
      })
    } catch (error) {
      console.error('[TldrawPresence] User update error:', error)
    }

    // Cleanup
    return () => {
      editor.off('pointer-move', throttledMove)
      supabase.removeChannel(channel)
    }
  }, [editor, boardId, userId, userEmail])

  return { peers }
}

// Consistent color per user
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
