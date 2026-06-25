import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'

const ACCESS_OPTIONS = [
  { value: 'restricted', label: 'Private', desc: 'Only you can access' },
  { value: 'viewer', label: 'View only', desc: 'Anyone with link can view' },
  { value: 'editor', label: 'Full access', desc: 'Anyone with link can edit' },
]

export default function ShareModal({ boardId, ownerId, currentUserId, slug, onClose }) {
  const [publicAccess, setPublicAccess] = useState('restricted')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)

  const isOwner = currentUserId === ownerId
  const shareUrl = `${window.location.origin}/board/${slug}`
  const activeOption = ACCESS_OPTIONS.find(o => o.value === publicAccess)

  useEffect(() => {
    supabase
      .from('boards')
      .select('public_access')
      .eq('id', boardId)
      .single()
      .then(({ data, error }) => {
        if (!error && data) setPublicAccess(data.public_access || 'restricted')
        setLoading(false)
      })
  }, [boardId])

  const handleAccessChange = async (value) => {
    if (!isOwner || saving) return
    setSaving(true)
    const { error } = await supabase
      .from('boards')
      .update({ public_access: value })
      .eq('id', boardId)
    if (!error) setPublicAccess(value)
    setSaving(false)
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {}
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <style>{`
        @keyframes modalSlideUp {
          from {
            opacity: 0;
            transform: translateY(12px) scale(0.97);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>

      {/* Double-Bezel Shell */}
      <div className="modal-shell" onClick={e => e.stopPropagation()}>
        {/* Inner Core */}
        <div className="modal-inner">
          {/* Header */}
          <div className="modal-header">
            <div>
              <span className="modal-eyebrow">Share</span>
              <h2 className="modal-title">/{slug}</h2>
            </div>
            <button className="modal-close" onClick={onClose} aria-label="Close">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <path d="M1 1l12 12M13 1L1 13" />
              </svg>
            </button>
          </div>

          {loading ? (
            <div className="modal-loading">
              <div className="spinner" />
            </div>
          ) : (
            <>
              {/* Link Section */}
              <div className="modal-section">
                <div className="modal-link-row">
                  <input className="modal-link-input" type="text" value={shareUrl} readOnly />
                  <button
                    className={`modal-copy-btn ${copied ? 'modal-copy-btn--done' : ''}`}
                    onClick={handleCopy}
                  >
                    {copied ? (
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M2.5 7.5L5.5 10.5L11.5 3.5" />
                      </svg>
                    ) : (
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="4.5" y="4.5" width="7" height="7" rx="1.5" />
                        <path d="M9.5 4.5V3a1.5 1.5 0 00-1.5-1.5H3A1.5 1.5 0 001.5 3v5A1.5 1.5 0 003 9.5h1.5" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {/* Access Control Section */}
              <div className="modal-section">
                <span className="modal-label">
                  Access
                  {!isOwner && <span className="modal-label-hint">Owner only</span>}
                </span>
                <div className="modal-access-options">
                  {ACCESS_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      className={`modal-access-btn ${publicAccess === opt.value ? 'modal-access-btn--active' : ''}`}
                      onClick={() => handleAccessChange(opt.value)}
                      disabled={!isOwner || saving}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                {activeOption && (
                  <p className="modal-access-desc">{activeOption.desc}</p>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
