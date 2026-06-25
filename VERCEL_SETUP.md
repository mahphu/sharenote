# Hướng dẫn Deploy lên Vercel

## Lỗi "Could not load assets. Please refresh the page."

Lỗi này xảy ra khi **thiếu biến môi trường Supabase** trên Vercel.

## Cách fix:

### 1. Thêm Environment Variables trên Vercel

Vào **Vercel Dashboard** → **Project Settings** → **Environment Variables**

Thêm 2 biến sau:

```
VITE_SUPABASE_URL=https://azabxhrymjnlcogszcdi.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF6YWJ4aHJ5bWpubGNvZ3N6Y2RpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyNjMwNjAsImV4cCI6MjA5MTgzOTA2MH0.-xFMRqxIOCLDh80lvWndmyCMTB9zcQRCG3WzLzLyNYw
```

**Lưu ý:** Chọn **Production**, **Preview**, và **Development** cho tất cả môi trường.

### 2. Redeploy

Sau khi thêm biến môi trường:
- Vào **Deployments**
- Click vào deployment mới nhất
- Click **Redeploy**

Hoặc push một commit mới lên GitHub để trigger deploy.

### 3. Kiểm tra

Mở app trên Vercel và kiểm tra:
- Console browser (F12) không có lỗi
- Có thể đăng nhập/đăng ký
- Realtime features hoạt động

## Lưu ý quan trọng

- File `.env` **KHÔNG** được push lên GitHub (đã có trong `.gitignore`)
- Biến môi trường phải được set trực tiếp trên Vercel Dashboard
- Mỗi lần thay đổi env vars, cần **Redeploy** để áp dụng
