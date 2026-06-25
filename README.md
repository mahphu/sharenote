# Sharenote

A real-time collaborative whiteboard application built with React, Tldraw, and Supabase. Draw, collaborate, and chat with your team in real-time.

![Sharenote Banner](https://via.placeholder.com/800x400/1a1a1a/ffffff?text=Sharenote+-+Real-time+Collaborative+Whiteboard)

## ✨ Features

- **Real-time Drawing Sync** — Changes broadcast instantly via Supabase Realtime, with optimized batching to reduce network overhead
- **Live Cursors** — See collaborators' cursor positions in real-time with color-coded labels
- **Real-time Chat** — Built-in chat sidebar for team communication
- **Google OAuth** — Secure authentication via Supabase Auth
- **Dark Theme** — Modern, eye-friendly dark interface
- **Persistent Storage** — Auto-save canvas state to Supabase PostgreSQL
- **Multi-user Presence** — Track who's online in each board

## 🛠 Tech Stack

- **Frontend**: React 19, Vite, React Router
- **Whiteboard**: [Tldraw v2](https://tldraw.dev/) — Infinite canvas with full drawing toolkit
- **Backend**: Supabase (PostgreSQL + Realtime + Auth)
- **Styling**: CSS custom properties, dark theme design

## 🏗 Architecture Highlights

### Performance Optimizations

**Drawing Sync (Board.jsx — RealtimeSync)**
- **50ms batching window**: Multiple rapid store changes are merged into a single broadcast
- **Smart deduplication**: Records updated multiple times within the batch send only their final state
- **Cancellation logic**: Add-then-remove operations within the same batch produce zero network traffic
- **Result**: Reduced broadcast frequency from ~30/sec to ~20/sec max during active drawing

**Cursor Tracking (Board.jsx — LiveCursors)**
- **Broadcast over Presence**: Switched from `channel.track()` (expensive state updates) to `channel.send()` (lightweight broadcasts) for cursor positions
- **100ms throttle + 2px dead-zone**: Filters micro-movements and reduces cursor events by ~40%
- **RAF-batched React updates**: Coalesces multiple peer cursor updates into a single render per frame
- **Result**: Smoother remote cursors, significantly lower Supabase quota consumption

## 📦 Installation

### Prerequisites

- Node.js 18+
- Supabase account ([sign up free](https://supabase.com))

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/sharenote.git
cd sharenote
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment

Create a `.env` file in the project root:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

Get your Supabase credentials from: **Dashboard → Settings → API**

### 4. Set Up Database

Run the SQL scripts in order:

```bash
# 1. Core tables and RLS policies
psql -h <host> -U postgres -d postgres -f docs/sql/complete_database_setup.sql

# 2. Realtime setup
psql -h <host> -U postgres -d postgres -f docs/sql/supabase_realtime_setup.sql

# 3. Share feature tables
psql -h <host> -U postgres -d postgres -f docs/sql/share_feature_setup.sql
```

Or run them directly in the Supabase SQL Editor.

### 5. Configure Google OAuth

1. Go to **Supabase Dashboard → Authentication → Providers**
2. Enable **Google** provider
3. Add your OAuth credentials from [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
4. Add authorized redirect URI: `https://your-project.supabase.co/auth/v1/callback`

### 6. Start Development Server

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

## 🚀 Deployment

### Build for Production

```bash
npm run build
```

The optimized bundle will be in the `dist/` folder.

### Deploy to Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/yourusername/sharenote)

Or manually:

```bash
npm i -g vercel
vercel --prod
```

**Important**: Add your environment variables in Vercel's project settings.

## 📁 Project Structure

```
sharenote/
├── src/
│   ├── components/
│   │   ├── ChatSidebar.jsx          # Real-time chat UI
│   │   ├── ShareModal.jsx           # Board sharing modal
│   │   └── OnlineUsersSidebar.jsx   # Active users list
│   ├── pages/
│   │   ├── Home.jsx                 # Dashboard (board list)
│   │   └── Board.jsx                # Main whiteboard canvas
│   ├── App.jsx                      # Router + auth guard
│   ├── main.jsx                     # App entry point
│   ├── supabaseClient.js            # Supabase connection
│   └── index.css                    # Global styles + dark theme
├── docs/
│   └── sql/                         # Database setup scripts
├── public/
│   ├── favicon.svg
│   └── icons.svg
├── .env.example                     # Environment template
└── vercel.json                      # SPA routing config
```

## 🎨 Key Components

### Board.jsx

The main canvas component with two inline real-time sub-components:

- **RealtimeSync**: Handles drawing synchronization with optimized batching
- **LiveCursors**: Manages peer cursor positions via lightweight broadcasts

### ChatSidebar.jsx

Real-time chat powered by Supabase `postgres_changes` subscription. Messages sync instantly across all users in the same board.

### ShareModal.jsx

Board sharing interface (prepared for future collaboration features).

## 🔒 Security

- **Row Level Security (RLS)** enabled on all tables
- Users can only access boards they own or have been shared with
- Google OAuth handles authentication
- Environment variables keep credentials secure
- `.env` excluded from version control

## 🧪 Testing

Open the app in two browser windows:

1. **Drawing sync**: Draw in one window → appears instantly in the other
2. **Live cursors**: Move mouse in one window → cursor with email appears in the other
3. **Chat**: Send message in one window → appears in the other immediately

## 📝 License

MIT License - feel free to use this project for learning or building your own collaborative tools.

## 🙏 Acknowledgments

- [Tldraw](https://tldraw.dev/) for the excellent infinite canvas library
- [Supabase](https://supabase.com/) for the real-time backend infrastructure
- [React](https://react.dev/) for the UI framework

---

**Built with ❤️ for seamless real-time collaboration**
