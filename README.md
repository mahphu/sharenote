# 🎨 Sharenote

> A premium real-time collaborative whiteboard and notes application built with React, Tldraw, and a self-hosted Node.js backend (WebSocket + SQLite).

🌐 **Languages:** [English (Active)](README.md) | [Tiếng Việt](README.vi.md) | [日本語](README.ja.md)

---

## 📊 Overview

Sharenote is an interactive whiteboard platform designed for high-performance team collaboration. Users can draw, collaborate on a shared infinite canvas, track live cursor presence, and communicate instantly through a real-time chat interface.

### 🛠 Tech Stack

![React 19](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black)
![Tldraw v2](https://img.shields.io/badge/Tldraw-v2.4.6-black?style=flat-square)
![Node.js](https://img.shields.io/badge/Node.js-24-339933?style=flat-square&logo=node.js&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-Database-003B57?style=flat-square&logo=sqlite&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-Bundler-646CFF?style=flat-square&logo=vite&logoColor=white)
![Yjs](https://img.shields.io/badge/Yjs-CRDT-FFCD00?style=flat-square)
![License](https://img.shields.io/badge/License-MIT-blue?style=flat-square)

---

## ✨ Features

*   **⚡ Real-time Drawing Sync:** Collaborative drawing updates instantly over the built-in WebSocket server, utilizing smart batching to keep network overhead low.
*   **👥 Live Cursors:** View active collaborators' cursor movements in real-time with color-coded tags and names.
*   **💬 Real-time Chat:** Sidebar messaging stored in SQLite and pushed to everyone over WebSocket.
*   **🔒 Secure Auth:** Email + password sign-up/sign-in (scrypt password hashing, HttpOnly session cookie).
*   **🌌 Premium Dark Theme:** Glassmorphism design system utilizing sleek, custom CSS variables.
*   **💾 Auto-Save Canvas:** Auto-saves board snapshots to the SQLite database.
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
| **Cursor Tracking (`LiveCursors`)** | Direct WebSocket relay | Cursor positions are only relayed within the board room, never written to the database. |
| | 100ms Throttle + 2px Dead-zone | Ignores micro-movements, filtering cursor updates by **~40%**. |
| | RAF-batched React Renders | Coalesces multiple peer updates into a single render frame using `requestAnimationFrame`. |

### 📦 Assets Self-Hosting

*   **Solution:** All Tldraw static assets (fonts, icons, translations) are self-hosted in `public/tldraw-assets/` using the `@tldraw/assets` library helper.
*   **Result:** Works **100% offline** and is **immune to CDN timeouts/blocks** (especially in Vietnam).

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
│   ├── api.js                       # REST client for the server
│   ├── realtime.js                  # Shared WebSocket per board
│   └── index.css                    # Design System + dark theme variables
├── public/
│   └── tldraw-assets/               # Self-hosted fonts, icons, translations
├── server/
│   ├── index.js                     # Server entry (API + WebSocket + serves dist/)
│   ├── routes.js                    # REST API
│   ├── realtime.js                  # WebSocket rooms per board
│   ├── auth.js                      # Email/password auth, sessions
│   ├── access.js                    # Board permissions
│   └── db.js                        # SQLite (server/data/sharenote.db)
└── package.json                     # Dependencies config
```

---

## 📦 Installation & Setup

### Prerequisites
*   Node.js 24+ (uses the built-in `node:sqlite` module, no separate database to install)

### 1. Clone & Install
```bash
git clone https://github.com/yourusername/sharenote.git
cd sharenote
npm install --legacy-peer-deps
```

### 2. Start Development
```bash
npm run dev
```
This runs Vite (port 5173) and the API server (port 3001) together. Open `http://localhost:5173` and click "Đăng ký" (Sign up) to create the first account. The SQLite database is created automatically at `server/data/sharenote.db`.

---

## 🚀 Running for your LAN

```bash
npm start
```
This builds the frontend and runs a single server on port 3001. The server prints its LAN address (e.g. `http://192.168.1.10:3001`) so other machines on the same network can open it. Change the port with the `SHARENOTE_PORT` environment variable.

---

## 📝 License

Distributed under the MIT License. See `LICENSE` for more information.

---

**Built with ❤️ for high-performance real-time collaboration**
