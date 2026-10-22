import { useState, useEffect } from 'react'
import { api } from '../api'

const ACCESS_OPTIONS = [
  { value: 'restricted', label: 'Private', desc: 'Only you and invited members can access' },
  { value: 'viewer', label: 'View only', desc: 'Anyone with the link can view; members keep their role' },
  { value: 'editor', label: 'Full access', desc: 'Anyone with the link can edit' },
]

const ROLE_OPTIONS = [
  { value: 'editor', label: 'Can edit' },
  { value: 'viewer', label: 'Can view' },
]

export default function ShareModal({ boardId, isOwner, slug, onClose }) {
  const [publicAccess, setPublicAccess] = useState('restricted')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)
  const [members, setMembers] = useState([])
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('editor')
  const [memberBusy, setMemberBusy] = useState(false)
  const [memberError, setMemberError] = useState('')

  const shareUrl = `${window.location.origin}/board/${slug}`
  const activeOption = ACCESS_OPTIONS.find(o => o.value === publicAccess)

  useEffect(() => {
    const requests = [
      api(`/boards/by-slug/${encodeURIComponent(slug)}`)
        .then(({ board }) => setPublicAccess(board.public_access || 'restricted'))
    ]
    if (isOwner) {
      requests.push(api(`/boards/${boardId}/members`).then(({ members }) => setMembers(members)))
    }
    Promise.all(requests)
      .catch((error) => console.error('[Share] Load error:', error))
      .finally(() => setLoading(false))
  }, [slug, boardId, isOwner])

  const handleAccessChange = async (value) => {
    if (!isOwner || saving) return
    setSaving(true)
    try {
      await api(`/boards/${boardId}`, { method: 'PATCH', body: { public_access: value } })
      setPublicAccess(value)
    } catch (error) {
      console.error('[Share] Update error:', error)
      alert('Failed to update access: ' + error.message)
    }
    setSaving(false)
  }

  // Every members endpoint answers with the full, updated list
  const updateMembers = async (path, options) => {
    if (memberBusy) return false
    setMemberBusy(true)
    setMemberError('')
    try {
      const { members } = await api(`/boards/${boardId}/members${path}`, options)
      setMembers(members)
      return true
    } catch (error) {
      setMemberError(error.message)
      return false
    } finally {
      setMemberBusy(false)
    }
  }

  const handleInvite = async (e) => {
    e.preventDefault()
    const email = inviteEmail.trim()
    if (!email) return
    const ok = await updateMembers('', { method: 'POST', body: { email, role: inviteRole } })
    if (ok) setInviteEmail('')
  }

  const handleRoleChange = (memberId, role) =>
    updateMembers(`/${memberId}`, { method: 'PATCH', body: { role } })

  const handleRemove = (memberId) =>
    updateMembers(`/${memberId}`, { method: 'DELETE' })

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

              {/* Members Section (owner only) */}
              {isOwner && (
                <div className="modal-section">
                  <span className="modal-label">Members</span>
                  <form className="modal-link-row" onSubmit={handleInvite}>
                    <input
                      className="modal-link-input modal-invite-input"
                      type="email"
                      placeholder="friend@email.com"
                      value={inviteEmail}
                      onChange={e => setInviteEmail(e.target.value)}
                      aria-label="Email to invite"
                      required
                    />
                    <select
                      className="modal-role-select"
                      value={inviteRole}
                      onChange={e => setInviteRole(e.target.value)}
                      aria-label="Role for the invited person"
                    >
                      {ROLE_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                    <button className="modal-invite-btn" type="submit" disabled={memberBusy}>
                      Invite
                    </button>
                  </form>
                  {memberError && <p className="modal-error">{memberError}</p>}

                  {members.length === 0 ? (
                    <p className="modal-access-desc">No members yet. Invite people who already have an account.</p>
                  ) : (
                    <ul className="modal-member-list">
                      {members.map(m => (
                        <li key={m.id} className="modal-member">
                          <span className="modal-member-email" title={m.email}>{m.email}</span>
                          <select
                            className="modal-role-select"
                            value={m.role}
                            onChange={e => handleRoleChange(m.id, e.target.value)}
                            disabled={memberBusy}
                            aria-label={`Role for ${m.email}`}
                          >
                            {ROLE_OPTIONS.map(opt => (
                              <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                          </select>
                          <button
                            className="modal-member-remove"
                            onClick={() => handleRemove(m.id)}
                            disabled={memberBusy}
                            aria-label={`Remove ${m.email}`}
                            title="Remove"
                          >
                            <svg width="10" height="10" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                              <path d="M1 1l12 12M13 1L1 13" />
                            </svg>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {/* Access Control Section */}
              <div className="modal-section">
                <span className="modal-label">
                  Link access
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
