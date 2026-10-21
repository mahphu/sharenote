// ============================================
// SHARENOTE — ChatSidebar Component
// Real-time chat: history over REST, new messages over the board WebSocket
// ============================================

import { useEffect, useState, useRef } from 'react'
import { api } from '../api'
import { acquireBoardSocket } from '../realtime'

function appendUnique(messages, message) {
  return messages.some(m => m.id === message.id) ? messages : [...messages, message]
}

export default function ChatSidebar({ boardId, userId }) {
  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const messagesEndRef = useRef(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  // Load initial messages
  useEffect(() => {
    async function loadMessages() {
      try {
        const { messages } = await api(`/boards/${boardId}/messages`)
        setMessages(messages)
        setLoading(false)
        setTimeout(scrollToBottom, 100)
      } catch (error) {
        console.error('[Chat] Load error:', error)
        setLoading(false)
      }
    }

    if (boardId) {
      loadMessages()
    }
  }, [boardId])

  // Subscribe to new messages pushed by the server
  useEffect(() => {
    if (!boardId) return

    const socket = acquireBoardSocket(boardId)
    const offChat = socket.on('chat', ({ message }) => {
      setMessages(prev => appendUnique(prev, message))
      setTimeout(scrollToBottom, 100)
    })

    return () => {
      offChat()
      socket.release()
    }
  }, [boardId])

  // Send message
  const sendMessage = async (e) => {
    e.preventDefault()
    const trimmed = newMessage.trim()
    if (!trimmed) return

    // Input validation
    const MAX_MESSAGE_LENGTH = 5000
    if (trimmed.length > MAX_MESSAGE_LENGTH) {
      alert(`Message too long. Maximum ${MAX_MESSAGE_LENGTH} characters allowed.`)
      return
    }

    try {
      const { message } = await api(`/boards/${boardId}/messages`, {
        method: 'POST',
        body: { content: trimmed }
      })
      setMessages(prev => appendUnique(prev, message))
      setTimeout(scrollToBottom, 100)

      setNewMessage('')
    } catch (error) {
      console.error('[Chat] Send error:', error)
      alert('Failed to send message. Please try again.')
    }
  }

  // Handle key events in chat input
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(e)
    } else if (e.key === 'Escape') {
      e.target.blur() // Unfocus chat input to restore whiteboard keyboard shortcuts
    }
  }

  return (
    <div style={{
      width: 320,
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      background: 'rgba(255, 255, 255, 0.04)',
      borderLeft: '1px solid rgba(255, 255, 255, 0.08)'
    }}>
      {/* Header */}
      <div style={{
        padding: '16px 20px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        color: 'var(--text-primary)',
        fontWeight: 600,
        fontSize: 14
      }}>
        💬 Chat
      </div>

      {/* Messages */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 12
      }}>
        {loading ? (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            color: 'var(--text-secondary)',
            fontSize: 13
          }}>
            Loading messages...
          </div>
        ) : messages.length === 0 ? (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            color: 'var(--text-secondary)',
            fontSize: 13,
            textAlign: 'center',
            padding: 20
          }}>
            No messages yet.<br />Start the conversation!
          </div>
        ) : (
          messages.map((msg) => {
            const isOwn = msg.sender_id === userId
            return (
              <div
                key={msg.id}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: isOwn ? 'flex-end' : 'flex-start',
                  gap: 4
                }}
              >
                <div style={{
                  fontSize: 11,
                  color: 'var(--text-muted)',
                  paddingLeft: isOwn ? 0 : 8,
                  paddingRight: isOwn ? 8 : 0
                }}>
                  {msg.sender_email?.split('@')[0] || 'Unknown'}
                </div>
                <div
                  ref={(el) => {
                    if (el) el.textContent = msg.content
                  }}
                  style={{
                    maxWidth: '80%',
                    padding: '8px 12px',
                    borderRadius: 8,
                    fontSize: 13,
                    color: 'var(--text-primary)',
                    background: isOwn
                      ? 'rgba(139, 92, 246, 0.2)'
                      : 'rgba(255, 255, 255, 0.08)',
                    border: isOwn
                      ? '1px solid rgba(139, 92, 246, 0.3)'
                      : '1px solid rgba(255, 255, 255, 0.08)',
                    wordBreak: 'break-word',
                    whiteSpace: 'pre-wrap'
                  }}
                />
              </div>
            )
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={sendMessage} style={{
        padding: 16,
        borderTop: '1px solid rgba(255, 255, 255, 0.08)'
      }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message... (Enter to send)"
            style={{
              flex: 1,
              padding: '8px 12px',
              fontSize: 13,
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: 6,
              color: 'var(--text-primary)',
              outline: 'none'
            }}
            onFocus={(e) => {
              e.target.style.borderColor = 'rgba(139, 92, 246, 0.4)'
            }}
            onBlur={(e) => {
              e.target.style.borderColor = 'rgba(255, 255, 255, 0.12)'
            }}
          />
          <button
            type="submit"
            disabled={!newMessage.trim()}
            style={{
              padding: '8px 16px',
              fontSize: 13,
              fontWeight: 600,
              background: newMessage.trim()
                ? 'linear-gradient(135deg, var(--accent-start), var(--accent-end))'
                : 'rgba(255, 255, 255, 0.08)',
              color: newMessage.trim() ? '#fff' : 'var(--text-muted)',
              border: 'none',
              borderRadius: 6,
              cursor: newMessage.trim() ? 'pointer' : 'not-allowed',
              transition: 'all 0.2s ease'
            }}
          >
            Send
          </button>
        </div>
      </form>
    </div>
  )
}
