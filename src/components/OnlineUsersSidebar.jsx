// ============================================
// OnlineUsersSidebar — Display list of online users
// ============================================

export default function OnlineUsersSidebar({ users, currentUserId }) {
  const userList = Array.from(users.values())

  return (
    <div style={{
      width: 240,
      height: '100%',
      background: 'rgba(255, 255, 255, 0.04)',
      backdropFilter: 'blur(24px)',
      WebkitBackdropFilter: 'blur(24px)',
      borderLeft: '1px solid rgba(255, 255, 255, 0.08)',
      display: 'flex',
      flexDirection: 'column',
      flexShrink: 0
    }}>
      {/* Header */}
      <div style={{
        padding: '16px 20px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)'
      }}>
        <div style={{
          fontSize: 13,
          fontWeight: 600,
          color: 'var(--text-secondary)',
          textTransform: 'uppercase',
          letterSpacing: '1.5px',
          marginBottom: 4
        }}>
          Online Users
        </div>
        <div style={{
          fontSize: 11,
          color: 'var(--text-muted)'
        }}>
          {userList.length} {userList.length === 1 ? 'person' : 'people'}
        </div>
      </div>

      {/* User list */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '12px 0'
      }}>
        {userList.map(user => {
          const isCurrentUser = user.id === currentUserId
          const displayName = getShortName(user.email)
          const color = user.color || getColorForUser(user.id)

          return (
            <div
              key={user.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '10px 20px',
                transition: 'background 0.2s',
                cursor: 'default'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent'
              }}
            >
              {/* Color indicator */}
              <div style={{
                width: 12,
                height: 12,
                borderRadius: '50%',
                background: color,
                boxShadow: `0 0 8px ${color}`,
                flexShrink: 0
              }} />

              {/* User name */}
              <div style={{
                flex: 1,
                fontSize: 14,
                fontWeight: 500,
                color: isCurrentUser ? 'var(--accent-solid)' : 'var(--text-primary)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}>
                {displayName}
                {isCurrentUser && (
                  <span style={{
                    marginLeft: 6,
                    fontSize: 11,
                    color: 'var(--text-muted)'
                  }}>
                    (you)
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Helper: Get short name from email
function getShortName(email) {
  if (!email) return 'Anonymous'
  const atIndex = email.indexOf('@')
  return atIndex > 0 ? email.substring(0, atIndex) : email.substring(0, 10)
}

// Helper: Generate consistent color per user
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
