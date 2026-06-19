// ============================================
// SHARENOTE — ShareModal Component
// Google Sheets-style link sharing with permissions
// ============================================

import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'

export default function ShareModal({ boardId, ownerId, currentUserId, slug, onClose }) {
  const [publicAccess, setPublicAccess] = useState('restricted')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)

  const isOwner = currentUserId === ownerId
  const shareUrl = `${window.location.origin}/board/${slug}`

  // Load current public access setting
  useEffect(() => {
    async function loadAccess() {
      try {
        const { data, error } = await supabase
          .from('boards')
          .select('public_access')
          .eq('id', boardId)
          .single()

        if (error) throw error

        setPublicAccess(data.public_access || 'restricted')
        setLoading(false)
      } catch (error) {
        console.error('[ShareModal] Load error:', error)
        alert('Failed to load sharing settings: ' + error.message)
        setLoading(false)
      }
    }

    loadAccess()
  }, [boardId])

  // Update public access setting
  const handleAccessChange = async (newAccess) => {
    if (!isOwner) return

    try {
      setSaving(true)

      const { error } = await supabase
        .from('boards')
        .update({ public_access: newAccess })
        .eq('id', boardId)

      if (error) throw error

      setPublicAccess(newAccess)
      console.log('[ShareModal] Access updated to:', newAccess)
    } catch (error) {
      console.error('[ShareModal] Update error:', error)
      alert('Failed to update sharing settings: ' + error.message)
    } finally {
      setSaving(false)
    }
  }

  // Copy link to clipboard
  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error('[ShareModal] Copy error:', error)
      alert('Failed to copy link: ' + error.message)
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.7)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 20
        }}
      >
        {/* Modal */}
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            background: 'rgba(18, 18, 26, 0.95)',
            backdropFilter: 'blur(32px)',
            WebkitBackdropFilter: 'blur(32px)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: 16,
            padding: 32,
            width: '100%',
            maxWidth: 520,
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
            animation: 'modalAppear 0.2s ease-out'
          }}
        >
          {/* Header */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 24
          }}>
            <h2 style={{
              fontSize: 20,
              fontWeight: 700,
              color: 'var(--text-primary)',
              margin: 0
            }}>
              🔗 Share "{slug}"
            </h2>
            <button
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-secondary)',
                fontSize: 24,
                cursor: 'pointer',
                padding: 4,
                lineHeight: 1,
                transition: 'color 0.2s'
              }}
              onMouseEnter={(e) => e.target.style.color = 'var(--text-primary)'}
              onMouseLeave={(e) => e.target.style.color = 'var(--text-secondary)'}
            >
              ×
            </button>
          </div>

          {loading ? (
            <div style={{
              textAlign: 'center',
              padding: '40px 0',
              color: 'var(--text-secondary)'
            }}>
              Loading...
            </div>
          ) : (
            <>
              {/* Link Input + Copy Button */}
              <div style={{ marginBottom: 24 }}>
                <label style={{
                  display: 'block',
                  fontSize: 13,
                  fontWeight: 600,
                  color: 'var(--text-secondary)',
                  marginBottom: 8,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}>
                  Share Link
                </label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="text"
                    value={shareUrl}
                    readOnly
                    style={{
                      flex: 1,
                      padding: '10px 14px',
                      fontSize: 13,
                      background: 'rgba(255, 255, 255, 0.04)',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      borderRadius: 8,
                      color: 'var(--text-primary)',
                      fontFamily: 'monospace',
                      outline: 'none'
                    }}
                  />
                  <button
                    onClick={handleCopyLink}
                    style={{
                      padding: '10px 20px',
                      fontSize: 13,
                      fontWeight: 600,
                      background: copied
                        ? 'rgba(16, 185, 129, 0.2)'
                        : 'linear-gradient(135deg, var(--accent-start), var(--accent-end))',
                      color: copied ? '#10b981' : '#fff',
                      border: copied ? '1px solid rgba(16, 185, 129, 0.4)' : 'none',
                      borderRadius: 8,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {copied ? '✓ Copied!' : 'Copy Link'}
                  </button>
                </div>
              </div>

              {/* General Access Dropdown */}
              <div>
                <label style={{
                  display: 'block',
                  fontSize: 13,
                  fontWeight: 600,
                  color: 'var(--text-secondary)',
                  marginBottom: 8,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}>
                  General Access
                  {!isOwner && (
                    <span style={{
                      marginLeft: 8,
                      fontSize: 11,
                      color: 'var(--text-muted)',
                      textTransform: 'none',
                      fontWeight: 400
                    }}>
                      (Owner only)
                    </span>
                  )}
                </label>

                <select
                  value={publicAccess}
                  onChange={(e) => handleAccessChange(e.target.value)}
                  disabled={!isOwner || saving}
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    fontSize: 14,
                    background: isOwner
                      ? 'rgba(255, 255, 255, 0.06)'
                      : 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    borderRadius: 8,
                    color: isOwner ? 'var(--text-primary)' : 'var(--text-muted)',
                    cursor: isOwner ? 'pointer' : 'not-allowed',
                    outline: 'none',
                    appearance: 'none',
                    backgroundImage: isOwner
                      ? `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23f0f0f5' d='M6 8L2 4h8z'/%3E%3C/svg%3E")`
                      : 'none',
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'right 14px center',
                    paddingRight: 40
                  }}
                >
                  <option value="restricted">🔒 Restricted (Only owner can access)</option>
                  <option value="viewer">👀 Anyone with the link can view</option>
                  <option value="editor">✏️ Anyone with the link can edit</option>
                </select>

                {/* Access Description */}
                <div style={{
                  marginTop: 12,
                  padding: 12,
                  background: 'rgba(139, 92, 246, 0.08)',
                  border: '1px solid rgba(139, 92, 246, 0.2)',
                  borderRadius: 8,
                  fontSize: 12,
                  color: 'var(--text-secondary)',
                  lineHeight: 1.5
                }}>
                  {publicAccess === 'restricted' && (
                    <>
                      <strong style={{ color: 'var(--text-primary)' }}>Private:</strong> Only you can access this board.
                    </>
                  )}
                  {publicAccess === 'viewer' && (
                    <>
                      <strong style={{ color: 'var(--text-primary)' }}>View-only:</strong> Anyone with the link can view but cannot draw or edit.
                    </>
                  )}
                  {publicAccess === 'editor' && (
                    <>
                      <strong style={{ color: 'var(--text-primary)' }}>Full access:</strong> Anyone with the link can draw, edit, and chat.
                    </>
                  )}
                </div>
              </div>

              {/* Done Button */}
              <div style={{ marginTop: 24, textAlign: 'right' }}>
                <button
                  onClick={onClose}
                  style={{
                    padding: '10px 24px',
                    fontSize: 14,
                    fontWeight: 600,
                    background: 'rgba(255, 255, 255, 0.08)',
                    color: 'var(--text-primary)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    borderRadius: 8,
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.background = 'rgba(255, 255, 255, 0.12)'
                    e.target.style.borderColor = 'rgba(139, 92, 246, 0.4)'
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.background = 'rgba(255, 255, 255, 0.08)'
                    e.target.style.borderColor = 'rgba(255, 255, 255, 0.12)'
                  }}
                >
                  Done
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <style>{`
        @keyframes modalAppear {
          from {
            opacity: 0;
            transform: scale(0.95) translateY(-10px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
      `}</style>
    </>
  )
}
