import { Tldraw } from 'tldraw'
import 'tldraw/tldraw.css'
import { useEffect, useState, useRef, useCallback } from 'react'
import { supabase } from './supabaseClient'
import { useMultiplayer } from './useMultiplayer'
import { CursorOverlay } from './CursorOverlay'

// Cỗ máy tự động chia màu Avatar
const getAvatarColor = (name = '') => {
  const colors = ['#e03131','#1971c2','#2f9e44','#e67700','#862e9c','#c2255c','#0c8599']
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return colors[Math.abs(hash) % colors.length]
}

export default function App() {
  // 1. HỆ THỐNG ĐỊNH DANH NGƯỜI DÙNG CHUYÊN NGHIỆP
  const [userName, setUserName] = useState(localStorage.getItem('sharenote_user') || '')

  useEffect(() => {
    if (!userName) {
      const name = prompt('Nhập tên của bạn để tham gia phòng vẽ:') || `Khách-${Math.floor(Math.random() * 1000)}`
      localStorage.setItem('sharenote_user', name.trim())
      setUserName(name.trim())
    }
  }, [userName])

  const [editor, setEditor] = useState(null)
  const [activeNote, setActiveNote] = useState('Ghi chú mới')
  const [noteList, setNoteList] = useState(['Ghi chú mới'])
  const [saveStatus, setSaveStatus] = useState('Sẵn sàng 🟢')
  const [isChatOpen, setIsChatOpen] = useState(true)
  const [isCreating, setIsCreating] = useState(false)
  const [newNoteName, setNewNoteName] = useState('')
  const [chatInput, setChatInput] = useState('')
  const [messages, setMessages] = useState([])
  
  // State quản lý số tin nhắn chưa đọc (Cái chấm đỏ)
  const [unreadCount, setUnreadCount] = useState(0)

  const chatEndRef = useRef(null)
  const saveTimeoutRef = useRef(null)
  
  // Dùng Ref để theo dõi trạng thái đóng/mở chat bên trong luồng Real-time
  const isChatOpenRef = useRef(isChatOpen)
  useEffect(() => { isChatOpenRef.current = isChatOpen }, [isChatOpen])

  // Lắp định danh chuẩn vào hệ thống Chuột 0.1s
  const { remoteCursors } = useMultiplayer({
    activeNote, editor, userName
  })

  // HÀM LƯU DATABASE
  const performSave = async (nameToSave, currentEditor) => {
    if (!currentEditor) return
    const snapshot = currentEditor.getSnapshot()
    const sizeMB = JSON.stringify(snapshot).length / (1024 * 1024)
    if (sizeMB > 9.5) return setSaveStatus('Quá nặng (>9.5MB) ❌')

    setSaveStatus('Đang lưu ngầm... ⏳')
    try {
      await supabase.from('canvases').upsert({ name: nameToSave, content: snapshot, updated_at: new Date() }, { onConflict: 'name' })
      setSaveStatus('Đã lưu ☁️')
    } catch (err) { setSaveStatus('Lỗi lưu ❌') }
  }

  // CHUYỂN BÀI
  const handleSwitchNote = async (newName) => {
    const cleanNewName = newName.trim()
    if (!cleanNewName || cleanNewName === activeNote) return
    if (editor) await performSave(activeNote, editor)
    setActiveNote(cleanNewName)
  }

  // KHỞI TẠO VÀ LẮNG NGHE TOÀN CỤC
  useEffect(() => {
    supabase.from('canvases').select('name').then(({ data }) => {
      if (data) setNoteList(prev => [...new Set([...prev, ...data.map(n => n.name)])])
    })

    const globalChannel = supabase.channel('global-system').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'canvases' }, (payload) => {
      setNoteList(prev => [...new Set([...prev, payload.new.name])])
    }).subscribe()

    return () => supabase.removeChannel(globalChannel)
  }, [])

  // TẢI DỮ LIỆU & LẮNG NGHE CHAT
  useEffect(() => {
    if (!editor) return
    const loadData = async () => {
      setSaveStatus('Đang tải... ⏳')
      const { data: canvasData } = await supabase.from('canvases').select('content').eq('name', activeNote).maybeSingle()
      if (canvasData?.content) editor.loadSnapshot(canvasData.content)
      else editor.selectAll().deleteShapes(editor.getSelectedShapeIds())
      
      const { data: msgData } = await supabase.from('messages').select('*').eq('note_name', activeNote).order('created_at', { ascending: true })
      setMessages(msgData || [])
      setSaveStatus('Sẵn sàng 🟢')
    }
    loadData()

    const safeRoomId = encodeURIComponent(activeNote)
    const chatChannel = supabase.channel(`room-${safeRoomId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `note_name=eq.${activeNote}` }, 
      (payload) => {
        setMessages(prev => [...prev, payload.new])
        
        // NẾU CHAT ĐANG ĐÓNG & NGƯỜI NHẮN KHÔNG PHẢI MÌNH -> TĂNG SỐ THÔNG BÁO LÊN
        if (!isChatOpenRef.current && payload.new.user_name !== userName) {
          setUnreadCount(prev => prev + 1)
        }
      }
    ).subscribe()

    return () => supabase.removeChannel(chatChannel)
  }, [activeNote, editor, userName])

  // AUTO SAVE KHI VẼ
  useEffect(() => {
    if (!editor) return
    const cleanup = editor.store.listen((e) => {
      if (e.source === 'user') {
        const filteredUpdates = Object.keys(e.changes.updated).filter(id => !id.startsWith('instance'))
        if (Object.keys(e.changes.added).length > 0 || Object.keys(e.changes.removed).length > 0 || filteredUpdates.length > 0) {
          setSaveStatus('Đang vẽ... ✍️')
          if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
          saveTimeoutRef.current = setTimeout(() => performSave(activeNote, editor), 1500)
        }
      }
    })
    return () => { cleanup(); clearTimeout(saveTimeoutRef.current) }
  }, [editor, activeNote])

  // GỬI TIN NHẮN (Gắn tên thật vào)
  const handleSendMessage = useCallback(async () => {
    if (!chatInput.trim() || !userName) return
    const text = chatInput.trim()
    setChatInput('')
    await supabase.from('messages').insert([{ content: text, note_name: activeNote, user_name: userName }])
  }, [chatInput, activeNote, userName])

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }) }, [messages])

  // CHƯA NHẬP TÊN THÌ TRANG TRẮNG (Đợi nhập xong mới render bảng vẽ)
  if (!userName) return null

  return (
    <div style={{ display: 'flex', width: '100vw', height: '100vh', overflow: 'hidden', color: 'var(--color-text)', backgroundColor: 'var(--bg)' }}>
      
      {/* KHU VỰC BẢNG VẼ */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <Tldraw inferDarkMode components={{ PageMenu: null }} onMount={setEditor} />
        <CursorOverlay remoteCursors={remoteCursors} editor={editor} />
        
        <div style={{ position: 'absolute', top: '15px', left: '50%', transform: 'translateX(-50%)', zIndex: 1000, display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 20px', backgroundColor: 'var(--color-panel)', borderRadius: '12px', boxShadow: 'var(--shadow-2)', border: '1px solid var(--color-panel-border)', backdropFilter: 'blur(10px)' }}>
          <span style={{ fontSize: '11px', opacity: 0.6, minWidth: '90px', textAlign: 'right' }}>{saveStatus}</span>
          <div style={{ width: '1px', height: '20px', backgroundColor: 'var(--color-panel-border)' }} />
          {isCreating ? (
            <input autoFocus placeholder="Tên bài mới..." value={newNoteName} onChange={(e) => setNewNoteName(e.target.value)} onKeyDown={(e) => { if(e.key === 'Enter') { handleSwitchNote(newNoteName); setNoteList(prev => [...new Set([...prev, newNoteName.trim()])]); setIsCreating(false); setNewNoteName(''); } }} onBlur={() => setIsCreating(false)} style={{ border: 'none', background: 'transparent', outline: 'none', fontWeight: 'bold', color: '#646cff', width: '140px' }} />
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <select value={activeNote} onChange={(e) => handleSwitchNote(e.target.value)} style={{ border: 'none', background: 'transparent', outline: 'none', fontWeight: '800', color: 'var(--color-text)', cursor: 'pointer' }}>
                {noteList.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
              <button onClick={() => setIsCreating(true)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--color-text)' }}>➕</button>
            </div>
          )}
          <div style={{ width: '1px', height: '20px', backgroundColor: 'var(--color-panel-border)' }} />
          
          {/* NÚT CHAT & CHẤM ĐỎ THÔNG BÁO */}
          <button 
            onClick={() => { setIsChatOpen(!isChatOpen); setUnreadCount(0); }} 
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--color-text)', position: 'relative', display: 'flex', alignItems: 'center' }}
          >
            <div style={{ fontSize: '18px' }}>{isChatOpen ? '🤜' : '💬'}</div>
            
            {/* BADGE THÔNG BÁO */}
            {unreadCount > 0 && !isChatOpen && (
              <span style={{ 
                position: 'absolute', top: '-6px', right: '-8px', 
                backgroundColor: '#e03131', color: '#fff', fontSize: '10px', fontWeight: 'bold', 
                padding: '2px 6px', borderRadius: '10px', boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                animation: 'pulse 2s infinite'
              }}>
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* CHAT SIDEBAR */}
      <div style={{ width: isChatOpen ? '320px' : '0px', transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)', backgroundColor: 'var(--color-panel)', borderLeft: isChatOpen ? '1px solid var(--color-panel-border)' : 'none', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '20px', borderBottom: '1px solid var(--color-panel-border)', fontWeight: 'bold', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>💬 {activeNote}</span>
          <span style={{ fontSize: '12px', fontWeight: 'normal', opacity: 0.6 }}>Bạn là: {userName}</span>
        </div>
        
        <div style={{ flex: 1, padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {messages.map((msg, index) => {
            const isMe = msg.user_name === userName // Chỉ xanh khi đúng là tên mình
            const avatarColor = getAvatarColor(msg.user_name)
            const initial = msg.user_name.charAt(0).toUpperCase()
            const showAvatar = index === 0 || messages[index - 1].user_name !== msg.user_name

            return (
              <div key={msg.id || Math.random()} style={{ display: 'flex', flexDirection: isMe ? 'row-reverse' : 'row', gap: '8px', alignItems: 'flex-end' }}>
                {showAvatar ? (
                  <div style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: avatarColor, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 'bold', flexShrink: 0, boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                    {initial}
                  </div>
                ) : <div style={{ width: '28px' }} />}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start', maxWidth: '75%' }}>
                  {showAvatar && (
                    <div style={{ fontSize: '11px', opacity: 0.6, marginBottom: '4px', marginLeft: '4px', marginRight: '4px' }}>
                      {msg.user_name}
                    </div>
                  )}
                  <div style={{ backgroundColor: isMe ? '#646cff' : 'var(--color-muted)', color: isMe ? '#fff' : 'var(--color-text)', padding: '10px 14px', borderRadius: isMe ? '18px 18px 4px 18px' : '18px 18px 18px 4px', fontSize: '14px', boxShadow: '0 2px 5px rgba(0,0,0,0.08)', lineHeight: '1.4', wordBreak: 'break-word' }}>
                    {msg.content}
                  </div>
                </div>
              </div>
            )
          })}
          <div ref={chatEndRef} />
        </div>

        <div style={{ padding: '15px', borderTop: '1px solid var(--color-panel-border)', display: 'flex', gap: '8px' }}>
          <input value={chatInput} onChange={(e) => setChatInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()} style={{ flex: 1, padding: '10px 15px', borderRadius: '20px', border: '1px solid var(--color-panel-border)', backgroundColor: 'var(--color-muted)', color: 'var(--color-text)', outline: 'none' }} placeholder="Nhắn gì đó..." />
          <button onClick={handleSendMessage} style={{ background: '#646cff', color: '#fff', border: 'none', borderRadius: '50%', width: '40px', height: '40px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✈️</button>
        </div>
      </div>
    </div>
  )
}