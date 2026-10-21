// ============================================
// SHARENOTE — Home.jsx (Dashboard)
// Hiển thị danh sách ghi chú, tạo mới, đăng xuất
// ============================================

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'

export default function Home() {
  const [boards, setBoards] = useState([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [lastCreateTime, setLastCreateTime] = useState(0)
  const navigate = useNavigate()

  useEffect(() => {
    fetchBoards()
  }, [])

  // LẤY DANH SÁCH BẢNG VẼ TỪ SERVER
  const fetchBoards = async () => {
    try {
      const { boards } = await api('/boards')
      setBoards(boards)
    } catch (error) {
      console.error('Lỗi lấy danh sách:', error)
    }
    setLoading(false)
  }

  // TẠO BẢNG MỚI — Server sinh slug ngẫu nhiên, rồi chuyển trang
  const createBoard = async () => {
    try {
      // Rate limiting: Max 1 board per 2 seconds
      const now = Date.now()
      const timeSinceLastCreate = now - lastCreateTime
      const RATE_LIMIT_MS = 2000

      if (timeSinceLastCreate < RATE_LIMIT_MS) {
        const waitSeconds = Math.ceil((RATE_LIMIT_MS - timeSinceLastCreate) / 1000)
        alert(`⏳ Please wait ${waitSeconds} second${waitSeconds > 1 ? 's' : ''} before creating another board.`)
        return
      }

      setCreating(true)
      setLastCreateTime(now)

      const { board } = await api('/boards', {
        method: 'POST',
        body: { title: 'Ghi chú mới' }
      })
      navigate(`/board/${board.unique_slug}`)
    } catch (err) {
      alert('🚨 Lỗi: ' + err.message)
    } finally {
      setCreating(false)
    }
  }

  // ĐĂNG XUẤT — Xóa session & reload trang
  const handleLogout = async () => {
    await api('/auth/logout', { method: 'POST' }).catch(() => {})
    window.location.reload()
  }

  // Format ngày tháng
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  // GIAO DIỆN — Căn giữa tuyệt đối bằng Flexbox, nền tối #1a1a1a, chữ trắng
  return (
    <>
      <div className="bg-mesh" />
      <div className="dashboard">
        {/* Header */}
        <div className="dashboard-header">
          <p className="dashboard-greeting">✨ Không gian làm việc</p>
          <h1 className="dashboard-title">Sharenote</h1>
        </div>

        {/* Action buttons */}
        <div className="dashboard-actions">
          <button
            id="btn-create-board"
            className="btn btn-primary"
            onClick={createBoard}
            disabled={creating}
          >
            {creating ? (
              <>
                <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
                Đang tạo...
              </>
            ) : (
              '＋ Tạo Ghi chú mới'
            )}
          </button>
          <button
            id="btn-logout"
            className="btn btn-danger"
            onClick={handleLogout}
          >
            Đăng xuất
          </button>
        </div>

        {/* Board list */}
        <div className="board-section">
          <div className="board-section-header">
            <span className="board-section-title">Danh sách ghi chú</span>
            {!loading && <span className="board-count">{boards.length}</span>}
          </div>

          {loading ? (
            <div className="loading-page" style={{ minHeight: 'auto', padding: '48px 0' }}>
              <div className="spinner" />
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Đang tải dữ liệu...</span>
            </div>
          ) : boards.length === 0 ? (
            <div className="board-empty">
              <div className="board-empty-icon">📋</div>
              <p>Chưa có ghi chú nào.</p>
              <p style={{ marginTop: 4 }}>Nhấn "Tạo Ghi chú mới" để bắt đầu!</p>
            </div>
          ) : (
            <div>
              {boards.map((b, index) => (
                <div
                  className="board-card"
                  key={b.id}
                  style={{ animationDelay: `${0.3 + index * 0.05}s` }}
                >
                  <div className="board-card-info">
                    <span className="board-card-title">{b.title}</span>
                    <span className="board-card-slug">/{b.unique_slug}</span>
                    {b.created_at && (
                      <span className="board-card-date">
                        Tạo lúc: {formatDate(b.created_at)}
                      </span>
                    )}
                  </div>
                  <button
                    className="btn btn-ghost"
                    onClick={() => navigate(`/board/${b.unique_slug}`)}
                  >
                    Vào phòng →
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}