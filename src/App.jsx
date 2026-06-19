// ============================================
// SHARENOTE — App.jsx
// Router bảo vệ route bằng trạng thái đăng nhập (Session)
// ============================================

import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './supabaseClient'
import Home from './pages/Home'
import Board from './pages/Board'

export default function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  // KIỂM TRA ĐĂNG NHẬP (AUTH)
  useEffect(() => {
    // Lấy session hiện tại
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })

    // Lắng nghe thay đổi auth state
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  // HÀM ĐĂNG NHẬP GOOGLE
  const loginWithGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin }
    })
  }

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
  if (!session) {
    return (
      <>
        <div className="bg-mesh" />
        <div className="login-page">
          <div className="login-card">
            <div className="login-logo">📝</div>
            <h1 className="login-title">Sharenote</h1>
            <p className="login-subtitle">
              Nền tảng ghi chú & bảng vẽ cộng tác thời gian thực.<br />
              Đăng nhập để bắt đầu sáng tạo.
            </p>
            <button
              id="btn-login-google"
              className="btn btn-google"
              onClick={loginWithGoogle}
            >
              <img
                src="https://www.svgrepo.com/show/475656/google-color.svg"
                alt="Google"
              />
              Đăng nhập bằng Google
            </button>
          </div>
        </div>
      </>
    )
  }

  // NẾU ĐÃ ĐĂNG NHẬP → CHO VÀO HỆ THỐNG VỚI ROUTER
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/board/:slug" element={<Board />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}