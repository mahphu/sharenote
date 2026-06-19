// ============================================
// SHARENOTE — useCanvasPersistence Hook
// Auto-save canvas state to Supabase boards table
// ============================================

import { useEffect, useRef } from 'react'
import { supabase } from '../supabaseClient'

export function useCanvasPersistence({ store, boardId, enabled = true }) {
  const saveTimeoutRef = useRef(null)
  const lastSavedRef = useRef(null)

  useEffect(() => {
    if (!store || !boardId || !enabled) return

    // Save to database with debounce
    const saveToDatabase = async () => {
      try {
        const snapshot = store.getSnapshot()
        const snapshotStr = JSON.stringify(snapshot)

        // Don't save if unchanged
        if (lastSavedRef.current === snapshotStr) {
          return
        }

        const { error } = await supabase
          .from('boards')
          .update({
            canvas_data: snapshot,
            updated_at: new Date().toISOString()
          })
          .eq('id', boardId)

        if (error) throw error

        lastSavedRef.current = snapshotStr
        console.log('[Persistence] Canvas saved to database')
      } catch (error) {
        console.error('[Persistence] Save error:', error)
      }
    }

    // Listen to store changes
    const unsubscribe = store.listen(() => {
      // Clear existing timeout
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }

      // Debounce save (wait 2 seconds after last change)
      saveTimeoutRef.current = setTimeout(saveToDatabase, 2000)
    }, { source: 'user', scope: 'all' })

    return () => {
      unsubscribe()
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [store, boardId, enabled])
}

// Load initial canvas state from database
export async function loadCanvasState(boardId) {
  try {
    const { data, error } = await supabase
      .from('boards')
      .select('canvas_data')
      .eq('id', boardId)
      .single()

    if (error) throw error

    return data?.canvas_data || null
  } catch (error) {
    console.error('[Persistence] Load error:', error)
    return null
  }
}
