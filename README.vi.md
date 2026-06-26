# 🎨 Sharenote (Tiếng Việt)

> Ứng dụng bảng vẽ và ghi chú cộng tác thời gian thực cao cấp được phát triển bằng React, Tldraw và Supabase.

🌐 **Languages:** [English](README.md) | [Tiếng Việt (Active)](README.vi.md) | [日本語](README.ja.md)

---

## 📊 Tổng quan

Sharenote là một nền tảng bảng vẽ tương tác được thiết kế cho sự cộng tác nhóm hiệu năng cao. Người dùng có thể vẽ, cộng tác trên một khung vải vô hạn dùng chung, theo dõi sự hiện diện của con trỏ chuột thời gian thực và giao tiếp tức thì thông qua giao diện chat tích hợp.

### 🛠 Công nghệ sử dụng

![React 19](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black)
![Tldraw v2](https://img.shields.io/badge/Tldraw-v2.4.6-black?style=flat-square)
![Supabase](https://img.shields.io/badge/Supabase-Backend-3ECF8E?style=flat-square&logo=supabase&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-Bundler-646CFF?style=flat-square&logo=vite&logoColor=white)
![Yjs](https://img.shields.io/badge/Yjs-CRDT-FFCD00?style=flat-square)
![License](https://img.shields.io/badge/License-MIT-blue?style=flat-square)

---

## ✨ Tính năng nổi bật

*   **⚡ Đồng bộ nét vẽ thời gian thực:** Cập nhật bản vẽ cộng tác ngay lập tức qua Supabase Realtime, sử dụng cơ chế gom gói (batching) thông minh để giảm thiểu tải lượng mạng.
*   **👥 Hiển thị con trỏ chuột (Live Cursors):** Xem chuyển động con trỏ chuột của những người cộng tác khác trong thời gian thực với nhãn tên và màu sắc riêng biệt.
*   **💬 Chat thời gian thực:** Thanh chat bên lề dựa trên đăng ký sự kiện `postgres_changes` của Supabase.
*   **🔒 Đăng nhập bảo mật:** Tích hợp đăng nhập nhanh chóng và an toàn qua Google OAuth.
*   **🌌 Giao diện tối cao cấp (Premium Dark Theme):** Hệ thống thiết kế Glassmorphism (hiệu ứng kính mờ) sử dụng các biến CSS tùy chỉnh tinh tế.
*   **💾 Tự động lưu trữ:** Tự động chụp lại trạng thái bảng vẽ và lưu vào Cơ sở dữ liệu PostgreSQL.
*   **📶 Trạng thái người dùng online:** Sidebar hiển thị danh sách những ai đang hoạt động trên bảng vẽ.

---

## 🏗 Điểm nhấn kiến trúc

### ⚡ Tối ưu hóa hiệu năng & Quota mạng

Để duy trì hiệu năng cao và tiết kiệm dung lượng truyền tải dữ liệu (giảm chi phí server), chúng tôi đã tối ưu hóa vòng đồng bộ dữ liệu:

| Thành phần | Cơ chế tối ưu | Chi tiết kỹ thuật |
| :--- | :--- | :--- |
| **Đồng bộ nét vẽ (`RealtimeSync`)** | Gom gói 50ms (Batching) | Gộp nhiều thay đổi nét vẽ liên tục trong 50ms thành một gói dữ liệu duy nhất. |
| | Loại bỏ trùng lặp | Chỉ gửi trạng thái cuối cùng của hình vẽ nếu nó bị thay đổi nhiều lần trong 50ms. |
| | Hủy sự kiện Vẽ-Xóa | Không gửi bất kỳ dữ liệu mạng nào nếu hình vẽ vừa được tạo ra đã bị xóa ngay trong cùng một batch 50ms. |
| **Đồng bộ con trỏ (`LiveCursors`)** | Broadcast thay vì Presence | Sử dụng cơ chế gửi broadcast nhẹ (`channel.send()`) thay vì track trạng thái Presence nặng nề lên DB. |
| | Throttle 100ms + Dead-zone 2px | Bỏ qua các chuyển động rung chuột nhỏ dưới 2px, giúp giảm tới **~40%** lượng sự kiện gửi đi. |
| | Gom gói render bằng RAF | Gom nhiều cập nhật vị trí chuột của các peer thành một lượt render duy nhất mỗi khung hình bằng `requestAnimationFrame`. |

### 📦 Tự lưu trữ tài nguyên tĩnh (Assets Self-Hosting)

*   **Giải pháp:** Toàn bộ file font chữ, icon và bản dịch của Tldraw được lưu trữ cục bộ trong thư mục `public/tldraw-assets/` thông qua thư viện bổ trợ `@tldraw/assets`.
*   **Kết quả:** Ứng dụng hoạt động **100% offline** và **không bao giờ bị lỗi nghẽn/chặn tải asset** từ CDN bên ngoài (đặc biệt là unpkg bị chặn ở Việt Nam) hoặc lỗi xung đột bảo mật CSP trên Vercel.

---

## 📁 Cấu trúc thư mục dự án

```text
sharenote/
├── src/
│   ├── components/
│   │   ├── ChatSidebar.jsx          # Giao diện chat thời gian thực
│   │   ├── ShareModal.jsx           # Modal chia sẻ bảng vẽ (CSS thuần + Soft UI)
│   │   └── OnlineUsersSidebar.jsx   # Danh sách người dùng đang online
│   ├── pages/
│   │   ├── Home.jsx                 # Màn hình chính (danh sách board)
│   │   └── Board.jsx                # Trang bảng vẽ chính
│   ├── App.jsx                      # Router + Bộ kiểm tra đăng nhập
│   ├── main.jsx                     # File khởi chạy ứng dụng
│   ├── supabaseClient.js            # Kết nối Supabase
│   └── index.css                    # Design System + Biến màu dark theme
├── public/
│   └── tldraw-assets/               # Assets cục bộ (fonts, icons, translations)
├── vercel.json                      # Cấu hình định tuyến SPA trên Vercel
└── package.json                     # Cấu hình thư viện dependencies
```

---

## 📦 Hướng dẫn cài đặt & Chạy local

### Yêu cầu hệ thống
*   Node.js 18+
*   Tài khoản Supabase

### 1. Tải về và cài đặt thư viện
```bash
git clone https://github.com/yourusername/sharenote.git
cd sharenote
npm install --legacy-peer-deps
```

### 2. Cấu hình biến môi trường
Tạo file `.env` tại thư mục gốc của dự án:
```env
VITE_SUPABASE_URL=https://your-project-url.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### 3. Cấu hình Database
Chạy các file SQL trong Supabase SQL Editor theo thứ tự:
1.  `docs/sql/complete_database_setup.sql` (Tạo bảng chính & RLS)
2.  `docs/sql/supabase_realtime_setup.sql` (Cấu hình Realtime publication)
3.  `docs/sql/share_feature_setup.sql` (Cấu hình phân quyền chia sẻ)

### 4. Khởi động môi trường Dev
```bash
npm run dev
```

---

## 🚀 Deployment

### Build dự án cho Production
```bash
npm run build
```

### Deploy lên Vercel
[![Deploy với Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/yourusername/sharenote)

---

## 📝 Bản quyền (License)

Phát hành dưới giấy phép MIT License. Xem file `LICENSE` để biết thêm thông tin.

---

**Được xây dựng với ❤️ nhằm mang lại trải nghiệm cộng tác thời gian thực tối ưu nhất**
