import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'

const ACCESS_OPTIONS = [
  { value: 'restricted', label: 'Private', desc: 'Only you can access', icon: '🔒' },
  { value: 'viewer', label: 'View', desc: 'Anyone can view', icon: '👁️' },
  { value: 'editor', label: 'Edit', desc: 'Anyone can edit', icon: '✏️' },
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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{
        background: 'rgba(5, 5, 5, 0.75)',
        backdropFilter: 'blur(12px)',
        animation: 'fadeIn 400ms cubic-bezier(0.32, 0.72, 0, 1)'
      }}
      onClick={onClose}
    >
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(24px) scale(0.96);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
      `}</style>

      {/* Double-Bezel Architecture: Outer Shell */}
      <div
        className="w-full max-w-md"
        style={{
          animation: 'slideUp 500ms cubic-bezier(0.32, 0.72, 0, 1)'
        }}
        onClick={e => e.stopPropagation()}
      >
        <div
          className="p-[3px] rounded-[2rem]"
          style={{
            background: 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%)',
            boxShadow: '0 0 0 1px rgba(255,255,255,0.08)'
          }}
        >
          {/* Inner Core */}
          <div
            className="bg-[#0A0A0A] rounded-[calc(2rem-3px)] overflow-hidden"
            style={{
              boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.08), 0 20px 60px rgba(0,0,0,0.4)'
            }}
          >
            {/* Header */}
            <div className="px-8 pt-8 pb-6 border-b border-white/5">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <div
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] uppercase tracking-[0.15em] font-medium"
                    style={{
                      background: 'rgba(255,255,255,0.06)',
                      color: 'rgba(255,255,255,0.5)'
                    }}
                  >
                    Share Board
                  </div>
                  <h2 className="text-2xl font-semibold text-white tracking-tight">
                    /{slug}
                  </h2>
                </div>

                <button
                  onClick={onClose}
                  className="group -mt-1 -mr-1 p-2.5 rounded-xl transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-white/5 active:scale-95"
                  aria-label="Close"
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    className="text-white/40 group-hover:text-white/70 transition-colors duration-300"
                  >
                    <path d="M1 1l14 14M15 1L1 15" />
                  </svg>
                </button>
              </div>
            </div>

            {loading ? (
              <div className="px-8 py-12 flex items-center justify-center">
                <div
                  className="w-6 h-6 border-2 border-white/10 border-t-white/60 rounded-full"
                  style={{
                    animation: 'spin 800ms linear infinite'
                  }}
                />
                <style>{`
                  @keyframes spin {
                    to { transform: rotate(360deg); }
                  }
                `}</style>
              </div>
            ) : (
              <div className="px-8 py-6 space-y-6">
                {/* Link Copy Section */}
                <div className="space-y-2">
                  <label className="block text-[11px] uppercase tracking-[0.12em] font-medium text-white/40">
                    Link
                  </label>

                  {/* Double-Bezel Input */}
                  <div
                    className="p-[2px] rounded-2xl"
                    style={{
                      background: 'rgba(255,255,255,0.04)',
                      boxShadow: '0 0 0 1px rgba(255,255,255,0.06)'
                    }}
                  >
                    <div className="flex items-center gap-2 bg-[#0F0F0F] rounded-[calc(1rem-2px)] p-1">
                      <input
                        type="text"
                        value={shareUrl}
                        readOnly
                        className="flex-1 bg-transparent px-3 py-2.5 text-sm text-white/70 font-mono outline-none select-all"
                      />

                      <button
                        onClick={handleCopy}
                        className="group relative flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-95"
                        style={{
                          background: copied
                            ? 'rgba(34, 197, 94, 0.15)'
                            : 'rgba(255,255,255,0.08)',
                          color: copied ? '#22c55e' : '#fff'
                        }}
                      >
                        <span className="relative z-10">
                          {copied ? 'Copied' : 'Copy'}
                        </span>

                        <div
                          className="w-5 h-5 rounded-full flex items-center justify-center transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:translate-x-0.5 group-hover:scale-105"
                          style={{
                            background: copied
                              ? 'rgba(34, 197, 94, 0.2)'
                              : 'rgba(255,255,255,0.1)'
                          }}
                        >
                          {copied ? (
                            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M2 6L5 9L10 2" />
                            </svg>
                          ) : (
                            <svg width="11" height="11" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                              <rect x="5" y="5" width="7" height="7" rx="1.5" />
                              <path d="M9 5V3.5A1.5 1.5 0 007.5 2h-4A1.5 1.5 0 002 3.5v4A1.5 1.5 0 003.5 9H5" />
                            </svg>
                          )}
                        </div>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Access Control Section */}
                <div className="space-y-3">
                  <label className="block text-[11px] uppercase tracking-[0.12em] font-medium text-white/40">
                    Access Level
                    {!isOwner && (
                      <span className="ml-2 text-white/25">• Owner only</span>
                    )}
                  </label>

                  <div className="grid grid-cols-3 gap-2">
                    {ACCESS_OPTIONS.map(opt => {
                      const isActive = publicAccess === opt.value
                      return (
                        <button
                          key={opt.value}
                          onClick={() => handleAccessChange(opt.value)}
                          disabled={!isOwner || saving}
                          className="group relative transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
                        >
                          {/* Double-Bezel for Active State */}
                          <div
                            className="p-[2px] rounded-2xl transition-all duration-500"
                            style={{
                              background: isActive
                                ? 'linear-gradient(135deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.08) 100%)'
                                : 'rgba(255,255,255,0.03)',
                              boxShadow: isActive
                                ? '0 0 0 1px rgba(255,255,255,0.12)'
                                : '0 0 0 1px rgba(255,255,255,0.05)'
                            }}
                          >
                            <div
                              className="px-3 py-4 rounded-[calc(1rem-2px)] transition-all duration-500"
                              style={{
                                background: isActive ? '#0F0F0F' : 'transparent'
                              }}
                            >
                              <div className="text-2xl mb-1.5">{opt.icon}</div>
                              <div className="text-sm font-medium text-white mb-0.5">
                                {opt.label}
                              </div>
                              <div className="text-[10px] text-white/40">
                                {opt.desc}
                              </div>
                            </div>
                          </div>
                        </button>
                      )
                    })}
                  </div>

                  {activeOption && (
                    <p
                      className="text-xs text-white/50 px-1"
                      style={{
                        animation: 'fadeIn 400ms cubic-bezier(0.32, 0.72, 0, 1)'
                      }}
                    >
                      {activeOption.value === 'restricted' && 'Only you can access this board.'}
                      {activeOption.value === 'viewer' && 'Anyone with the link can view but cannot edit.'}
                      {activeOption.value === 'editor' && 'Anyone with the link can draw, edit, and chat.'}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
