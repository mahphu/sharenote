import { useEffect, useState } from 'react'

export function CursorOverlay({ remoteCursors, editor }) {
  const [, forceRender] = useState(0)

  // Lắng nghe camera (zoom/pan) để cập nhật vị trí con trỏ ngay lập tức
  useEffect(() => {
    if (!editor) return
    const unsub = editor.store.listen(
      () => forceRender(n => n + 1),
      { source: 'all', scope: 'record' }
    )
    return unsub
  }, [editor])

  if (!editor || !remoteCursors || Object.keys(remoteCursors).length === 0) return null

  return (
    <div style={{ 
      position: 'absolute', 
      inset: 0, 
      pointerEvents: 'none', 
      zIndex: 9999, // Ép nó nằm trên tất cả các lớp của tldraw
      overflow: 'hidden' 
    }}>
      {Object.entries(remoteCursors).map(([id, cursor]) => {
        // Chuyển tọa độ thế giới (bảng vẽ) sang tọa độ màn hình (pixel)
        const screen = editor.pageToScreen({ x: cursor.x, y: cursor.y })

        return (
          <div
            key={id}
            style={{
              position: 'absolute',
              left: screen.x,
              top: screen.y,
              transform: 'translate(-2px, -2px)',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
              transition: 'left 0.08s linear, top 0.08s linear', // Mượt như Figma
            }}
          >
            {/* HÌNH MŨI TÊN CHUỘT SVG */}
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              style={{
                filter: 'drop-shadow(0px 2px 4px rgba(0,0,0,0.2))',
              }}
            >
              <path
                d="M5.65376 12.3122L5.60305 12.2764L5.55621 12.2354L2.31731 9.39411L18.8252 2.15344L14.7394 20.1534L11.5641 13.9142L11.5312 13.8496L11.4815 13.795L5.65376 12.3122Z"
                fill={cursor.color || '#646cff'}
                stroke="white"
                strokeWidth="2"
              />
            </svg>

            {/* NHÃN TÊN USER */}
            <div
              style={{
                backgroundColor: cursor.color || '#646cff',
                color: 'white',
                padding: '4px 10px',
                borderRadius: '20px', // Bo tròn kiểu You
                fontSize: '12px',
                fontWeight: 'bold',
                whiteSpace: 'nowrap',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                marginLeft: '12px',
              }}
            >
              {cursor.userName || 'Người dùng'}
            </div>
          </div>
        )
      })}
    </div>
  )
}