# 🎨 Sharenote

> A premium real-time collaborative whiteboard and notes application built with React, Tldraw, and Supabase.

🌐 **Languages:** [English (Active)](README.md) | [Tiếng Việt](README.vi.md) | [日本語](README.ja.md)

---

## 📊 Overview

Sharenote is an interactive whiteboard platform designed for high-performance team collaboration. Users can draw, collaborate on a shared infinite canvas, track live cursor presence, and communicate instantly through a real-time chat interface.

### 🛠 Tech Stack

![React 19](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black)
![Tldraw v2](https://img.shields.io/badge/Tldraw-v2.4.6-black?style=flat-square)
![Supabase](https://img.shields.io/badge/Supabase-Backend-3ECF8E?style=flat-square&logo=supabase&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-Bundler-646CFF?style=flat-square&logo=vite&logoColor=white)
![Yjs](https://img.shields.io/badge/Yjs-CRDT-FFCD00?style=flat-square)
![License](https://img.shields.io/badge/License-MIT-blue?style=flat-square)

---

## ✨ Features

*   **⚡ Real-time Drawing Sync:** Collaborative drawing updates instantly via Supabase Realtime, utilizing smart batching to keep network overhead low.
*   **👥 Live Cursors:** View active collaborators' cursor movements in real-time with color-coded tags and names.
*   **💬 Real-time Chat:** Sidebar messaging built on Supabase `postgres_changes` subscription.
*   **🔒 Secure Auth:** Seamless login integrations with Google OAuth.
*   **🌌 Premium Dark Theme:** Glassmorphism design system utilizing sleek, custom CSS variables.
*   **💾 Auto-Save Canvas:** Auto-saves board snapshots to PostgreSQL Database.
*   **📶 Multi-User Presence:** Sidebar indicators show who is online.

---

## 🏗 Architecture Highlights

### ⚡ Performance & Quota Optimization

To maintain high performance and low server billings/quotas, we optimized the data synchronization loops:

| Component | Optimization | Detail |
| :--- | :--- | :--- |
| **Drawing Sync (`RealtimeSync`)** | 50ms Batching Window | Merges multiple rapid store changes into a single payload. |
| | Smart Deduplication | Keeps only the final state if a shape is updated multiple times within 50ms. |
| | Add-Then-Remove Cancellation | Produces zero network events if a drawing is deleted within the same batch. |
| **Cursor Tracking (`LiveCursors`)** | Broadcast over Presence | Uses lightweight `channel.send()` broadcasts instead of heavy Presence database tracks. |
| | 100ms Throttle + 2px Dead-zone | Ignores micro-movements, filtering cursor updates by **~40%**. |
| | RAF-batched React Renders | Coalesces multiple peer updates into a single render frame using `requestAnimationFrame`. |

### 📦 Assets Self-Hosting

*   **Solution:** All Tldraw static assets (fonts, icons, translations) are self-hosted in `public/tldraw-assets/` using the `@tldraw/assets` library helper.
*   **Result:** Works **100% offline** and is **immune to CDN timeouts/blocks** (especially in Vietnam) or Content Security Policy (CSP) header conflicts on Vercel.

---

## 📁 Project Structure

```text
sharenote/
├── src/
│   ├── components/
│   │   ├── ChatSidebar.jsx          # Real-time chat UI
│   │   ├── ShareModal.jsx           # Board sharing modal (Vanilla CSS + Soft UI)
│   │   └── OnlineUsersSidebar.jsx   # Active users list
│   ├── pages/
│   │   ├── Home.jsx                 # Dashboard (board list)
│   │   └── Board.jsx                # Main whiteboard canvas
│   ├── App.jsx                      # Router + auth guard
│   ├── main.jsx                     # App entry point
│   ├── supabaseClient.js            # Supabase connection
│   └── index.css                    # Design System + dark theme variables
├── public/
│   └── tldraw-assets/               # Self-hosted fonts, icons, translations
├── vercel.json                      # Vercel SPA routing
└── package.json                     # Dependencies config
```

---

## 📦 Installation & Setup

### Prerequisites
*   Node.js 18+
*   Supabase Account

### 1. Clone & Install
```bash
git clone https://github.com/yourusername/sharenote.git
cd sharenote
npm install --legacy-peer-deps
```

### 2. Configure Environment
Create a `.env` file in the project root:
```env
VITE_SUPABASE_URL=https://your-project-url.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### 3. Run Database Setup
Execute the SQL files inside your Supabase SQL editor:
1.  `docs/sql/complete_database_setup.sql` (Core tables)
2.  `docs/sql/supabase_realtime_setup.sql` (Realtime publication)
3.  `docs/sql/share_feature_setup.sql` (Sharing rules)

### 4. Start Development
```bash
npm run dev
```

---

## 🚀 Deployment

### Build for Production
```bash
npm run build
```

### Deploy to Vercel
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/yourusername/sharenote)

---

## 📝 License

Distributed under the MIT License. See `LICENSE` for more information.

---

**Built with ❤️ for high-performance real-time collaboration**
