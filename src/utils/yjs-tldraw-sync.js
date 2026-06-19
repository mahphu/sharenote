// ============================================
// SHARENOTE — Yjs-Tldraw Sync Utility
// Syncs Yjs document with tldraw store
// ============================================

import { createTLStore, defaultShapeUtils } from 'tldraw'
import * as Y from 'yjs'

export function createYjsStore({ yDoc, shapeUtils = defaultShapeUtils }) {
  try {
    // Create base tldraw store
    const store = createTLStore({
      shapeUtils
    })

    // Get Yjs map for tldraw data
    const yMap = yDoc.getMap('tldraw')

    // Sync tldraw changes to Yjs
    store.listen((entry) => {
      if (entry.source === 'user') {
        try {
          const snapshot = store.getSnapshot()
          yMap.set('snapshot', JSON.stringify(snapshot))
        } catch (error) {
          console.error('[Sync] tldraw->Yjs error:', error)
        }
      }
    }, { source: 'user', scope: 'all' })

    // Sync Yjs changes to tldraw
    yMap.observe(() => {
      try {
        const snapshotStr = yMap.get('snapshot')
        if (snapshotStr) {
          const snapshot = JSON.parse(snapshotStr)
          store.loadSnapshot(snapshot)
        }
      } catch (error) {
        console.error('[Sync] Yjs->tldraw error:', error)
      }
    })

    // Load initial state
    try {
      const initialSnapshot = yMap.get('snapshot')
      if (initialSnapshot) {
        const snapshot = JSON.parse(initialSnapshot)
        store.loadSnapshot(snapshot)
      }
    } catch (error) {
      console.error('[Sync] Initial load error:', error)
    }

    return store
  } catch (error) {
    console.error('[createYjsStore] Error:', error)
    throw error
  }
}
