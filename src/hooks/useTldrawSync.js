// ============================================
// SHARENOTE — useTldrawSync Hook
// Real-time tldraw sync via Supabase Realtime
// ============================================

import { useEffect, useRef } from 'react'
import { supabase } from '../supabaseClient'

export function useTldrawSync({ store, boardId, userId, enabled = true }) {
  const channelRef = useRef(null)
  const isSyncingRef = useRef(false)

  useEffect(() => {
    if (!store || !boardId || !userId || !enabled) return

    console.log('[TldrawSync] Starting sync for board:', boardId)

    // Create Supabase channel for this board
    const channel = supabase.channel(`board-sync:${boardId}`, {
      config: {
        broadcast: { self: false }, // Don't receive own broadcasts
        presence: { key: userId }
      }
    })

    channelRef.current = channel

    // Listen to broadcasts from other users
    channel.on('broadcast', { event: 'store-update' }, ({ payload }) => {
      if (isSyncingRef.current) return // Prevent feedback loop

      try {
        isSyncingRef.current = true

        // Apply changes from other users
        const { changes } = payload

        if (changes && changes.length > 0) {
          store.mergeRemoteChanges(() => {
            changes.forEach(change => {
              if (change.added) {
                Object.entries(change.added).forEach(([id, record]) => {
                  store.put([record])
                })
              }
              if (change.updated) {
                Object.entries(change.updated).forEach(([id, [from, to]]) => {
                  store.put([to])
                })
              }
              if (change.removed) {
                Object.entries(change.removed).forEach(([id]) => {
                  store.remove([id])
                })
              }
            })
          })
        }

        console.log('[TldrawSync] Applied changes from peer')
      } catch (error) {
        console.error('[TldrawSync] Apply changes error:', error)
      } finally {
        setTimeout(() => {
          isSyncingRef.current = false
        }, 100)
      }
    })

    // Subscribe to the channel
    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        console.log('[TldrawSync] Subscribed to board channel')
      }
    })

    // Listen to local store changes and broadcast
    const handleChange = (entry) => {
      if (isSyncingRef.current) return
      if (entry.source !== 'user') return

      try {
        const changes = entry.changes

        // Broadcast changes to other users
        channel.send({
          type: 'broadcast',
          event: 'store-update',
          payload: {
            changes: [changes],
            userId,
            timestamp: Date.now()
          }
        })

        console.log('[TldrawSync] Broadcasted changes')
      } catch (error) {
        console.error('[TldrawSync] Broadcast error:', error)
      }
    }

    const unsubscribe = store.listen(handleChange, {
      source: 'user',
      scope: 'all'
    })

    // Cleanup
    return () => {
      unsubscribe()
      supabase.removeChannel(channel)
      console.log('[TldrawSync] Cleanup complete')
    }
  }, [store, boardId, userId, enabled])
}
