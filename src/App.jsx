// ============================================
// SHARENOTE — App.jsx
// Router bảo vệ route bằng trạng thái đăng nhập (Session)
// ============================================

import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { api } from './api'
import Home from './pages/Home'
import Board from './pages/Board'

export default function App() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  // KIỂM TRA ĐĂNG NHẬP (AUTH) — session nằm trong cookie HttpOnly do server cấp
  useEffect(() => {
    api('/auth/me')
      .then(({ user }) => setUser(user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false))
  }, [])

  // LOADING STATE
  if (loading) {
    return (
      <>
        <div className="bg-mesh" />
        <div className="loading-page">
          <div className="spinner" />
          <span>Đang tải hệ thống...</span>
        </div>
      </>
    )
  }

  // NẾU CHƯA ĐĂNG NHẬP → HIỆN TRANG LOGIN
  if (!user) {
    return <LoginPage onSignedIn={setUser} />
  }

  // NẾU ĐÃ ĐĂNG NHẬP → CHO VÀO HỆ THỐNG VỚI ROUTER
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/board/:slug" element={<Board user={user} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

// ĐĂNG NHẬP / ĐĂNG KÝ bằng email + mật khẩu
function LoginPage({ onSignedIn }) {
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const isRegister = mode === 'register'

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (submitting) return
    setError('')
    setSubmitting(true)
    try {
      const { user } = await api(isRegister ? '/auth/register' : '/auth/login', {
        method: 'POST',
        body: { email, password }
      })
      onSignedIn(user)
    } catch (err) {
      setError(err.message)
      setSubmitting(false)
    }
  }

  const switchMode = () => {
    setMode(isRegister ? 'login' : 'register')
    setError('')
  }

  return (
    <>
      <div className="bg-mesh" />
      <div className="login-page">
        <div className="login-card">
          <div className="login-logo">📝</div>
          <h1 className="login-title">Sharenote</h1>
          <p className="login-subtitle">
            Nền tảng ghi chú & bảng vẽ cộng tác thời gian thực.<br />
            {isRegister ? 'Tạo tài khoản để bắt đầu sáng tạo.' : 'Đăng nhập để bắt đầu sáng tạo.'}
          </p>

          <form className="login-form" onSubmit={handleSubmit}>
            <input
              id="input-email"
              className="login-input"
              type="email"
              placeholder="Email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <input
              id="input-password"
              className="login-input"
              type="password"
              placeholder={isRegister ? 'Mật khẩu (ít nhất 8 ký tự)' : 'Mật khẩu'}
              autoComplete={isRegister ? 'new-password' : 'current-password'}
              minLength={isRegister ? 8 : undefined}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            {error && <div className="login-error">{error}</div>}

            <button
              id="btn-login-submit"
              type="submit"
              className="btn btn-primary login-submit"
              disabled={submitting}
            >
              {submitting
                ? 'Đang xử lý...'
                : isRegister ? 'Tạo tài khoản' : 'Đăng nhập'}
            </button>
          </form>

          <button type="button" className="login-switch" onClick={switchMode}>
            {isRegister ? 'Đã có tài khoản? Đăng nhập' : 'Chưa có tài khoản? Đăng ký'}
          </button>
        </div>
      </div>
    </>
  )
}
