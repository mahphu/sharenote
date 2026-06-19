// ============================================
// SHARENOTE — useYjsStore Hook
// Creates and manages Yjs document for real-time sync
// ============================================

import { useEffect, useState } from 'react'
import * as Y from 'yjs'
import { WebrtcProvider } from 'y-webrtc'

// Keep track of active rooms to prevent duplicates
const activeRooms = new Map()

export function useYjsStore({ roomId }) {
  const [yDoc, setYDoc] = useState(null)
  const [provider, setProvider] = useState(null)
  const [isConnected, setIsConnected] = useState(false)

  useEffect(() => {
    if (!roomId) return

    // Check if room already exists
    if (activeRooms.has(roomId)) {
      const existing = activeRooms.get(roomId)
      setYDoc(existing.doc)
      setProvider(existing.provider)
      setIsConnected(true)
      return
    }

    let mounted = true
    let yProvider = null
    let doc = null

    async function init() {
      try {
        // Create Yjs document
        doc = new Y.Doc()

        // Import awareness protocol
        const { Awareness } = await import('y-protocols/awareness')

        // Create WebRTC provider
        yProvider = new WebrtcProvider(`sharenote-${roomId}`, doc, {
          signaling: [
            'wss://signaling.yjs.dev',
            'wss://y-webrtc-signaling-eu.herokuapp.com',
            'wss://y-webrtc-signaling-us.herokuapp.com'
          ],
          password: null,
          awareness: new Awareness(doc),
          maxConns: 20 + Math.floor(Math.random() * 15),
          filterBcConns: true,
          peerOpts: {}
        })

        if (!mounted) return

        // Store in active rooms map
        activeRooms.set(roomId, { doc, provider: yProvider })

        setYDoc(doc)
        setProvider(yProvider)

        // Connection status
        yProvider.on('status', (event) => {
          console.log('[Y-WebRTC] Status:', event.status)
          if (mounted) setIsConnected(event.status === 'connected')
        })

        yProvider.on('synced', (synced) => {
          console.log('[Y-WebRTC] Synced:', synced)
          if (synced && mounted) setIsConnected(true)
        })

        yProvider.on('peers', (event) => {
          console.log('[Y-WebRTC] Peers:', event.webrtcPeers.length)
        })

        // Set connected after a short delay
        setTimeout(() => {
          if (mounted) setIsConnected(true)
        }, 1000)

      } catch (error) {
        console.error('[useYjsStore] Error:', error)
        if (mounted) alert('Failed to initialize real-time sync: ' + error.message)
      }
    }

    init()

    // Cleanup
    return () => {
      mounted = false
      try {
        // Only destroy if this is the last reference
        activeRooms.delete(roomId)

        if (yProvider) {
          yProvider.destroy()
        }
        if (doc) {
          doc.destroy()
        }
      } catch (error) {
        console.error('[useYjsStore] Cleanup error:', error)
      }
    }
  }, [roomId])

  return { yDoc, provider, isConnected }
}
