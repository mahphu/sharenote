# 🎨 Sharenote (日本語)

> React、Tldraw、Supabaseを採用した、プレミアムなリアルタイム共同編集ホワイトボード＆ノートアプリケーション。

🌐 **Languages:** [English](README.md) | [Tiếng Việt](README.vi.md) | [日本語 (Active)](README.ja.md)

---

## 📊 概要

Sharenoteは、高性能なチームコラボレーション向けに設計されたインタラクティブなホワイトボードプラットフォームです。ユーザーは無限のキャンバスで共同描画を行い、リアルタイムでカーソル位置（現在地）を追跡し、組み込まれたチャット機能で即座に意見を交わすことができます。

### 🛠 使用技術

![React 19](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black)
![Tldraw v2](https://img.shields.io/badge/Tldraw-v2.4.6-black?style=flat-square)
![Supabase](https://img.shields.io/badge/Supabase-Backend-3ECF8E?style=flat-square&logo=supabase&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-Bundler-646CFF?style=flat-square&logo=vite&logoColor=white)
![Yjs](https://img.shields.io/badge/Yjs-CRDT-FFCD00?style=flat-square)
![License](https://img.shields.io/badge/License-MIT-blue?style=flat-square)

---

## ✨ 主な機能

*   **⚡ リアルタイム描画同期:** Supabase Realtimeを介して共同描画の内容を即座に同期。独自のバッチ処理によりネットワーク負荷を低く抑えます。
*   **👥 リアルタイムカーソル (Live Cursors):** 共同編集者のカーソル位置や動きを、名前とカラーラベル付きでリアルタイムに可視化します。
*   **💬 リアルタイムチャット:** Supabaseの `postgres_changes` サブスクリプションを活用した内蔵チャットサイドバー。
*   **🔒 安全な認証:** Google OAuthによるスムーズでセキュアなサインインをサポート。
*   **🌌 高品質なダークテーマ:** 美しいグラスモフィズム（ガラス風）デザインをカスタムCSS変数で実現。
*   **💾 自動保存:** ホワイトボードのスナップショットを自動的にPostgreSQLデータベースに保存。
*   **📶 オンラインステータス:** 現在ホワイトボードに参加しているメンバーをサイドバーに表示。

---

## 🏗 アーキテクチャのハイライト

### ⚡ パフォーマンスとネットワーク通信量の最適化

高い描画パフォーマンスとサーバー通信量の削減（コスト削減）を実現するため、データ同期処理を最適化しました。

| コンポーネント | 最適化手法 | 技術的詳細 |
| :--- | :--- | :--- |
| **描画同期 (`RealtimeSync`)** | 50ms バッチウインドウ | 50ms以内の連続した細かな描画変更を1つの送信データに統合。 |
| | スマート重複排除 | 同一オブジェクトが50ms以内に複数回更新された場合、最終状態のみを送信。 |
| | 作成・削除イベントの相殺 | 作成直後に同じバッチ内で削除されたオブジェクトは、通信イベントを発生させません。 |
| **カーソル追跡 (`LiveCursors`)** | PresenceからBroadcastへ変更 | データベース負荷の高いPresence追跡から、軽量な `channel.send()` のBroadcast通信に変更。 |
| | 100ms スロットル + 2px 不感帯 | 2px以下の細かなブレを無視することで、カーソル同期イベントを **約40%** 削減。 |
| | RAFによる描画バッチ処理 | `requestAnimationFrame` を使用し、各参加者のカーソル更新を1フレーム内で1回にまとめて再レンダリング。 |

### 📦 スタティックアセットのローカルホスティング (Self-Hosting)

*   **解決策:** Tldrawのフォント、アイコン、翻訳などのアセットファイルを、`@tldraw/assets` ヘルパーを利用してローカルディレクトリ `public/tldraw-assets/` に完全配置。
*   **効果:** アプリケーションが **100%オフライン動作** に対応。外部のCDN（ベトナム等で不安定なunpkg.comなど）の遅延やブロック、VercelのContent Security Policy (CSP) エラーの影響を受けません。

---

## 📁 ディレクトリ構造

```text
sharenote/
├── src/
│   ├── components/
│   │   ├── ChatSidebar.jsx          # リアルタイムチャット UI
│   │   ├── ShareModal.jsx           # 共有モーダル (Vanilla CSS + Soft UI)
│   │   └── OnlineUsersSidebar.jsx   # アクティブユーザーリスト
│   ├── pages/
│   │   ├── Home.jsx                 # ホーム画面 (ボード一覧)
│   │   └── Board.jsx                # メインのホワイトボード画面
│   ├── App.jsx                      # ルーター + 認証ガード
│   ├── main.jsx                     # エントリーポイント
│   ├── supabaseClient.js            # Supabase クライアント設定
│   └── index.css                    # デザインシステム + ダークテーマ変数
├── public/
│   └── tldraw-assets/               # ローカルホスティング用のフォント、アイコン等
├── vercel.json                      # Vercel SPAルーティング設定
└── package.json                     # 依存ライブラリ設定
```

---

## 📦 インストール & セットアップ

### 必須環境
*   Node.js 18以上
*   Supabase アカウント

### 1. クローンとインストール
```bash
git clone https://github.com/yourusername/sharenote.git
cd sharenote
npm install --legacy-peer-deps
```

### 2. 環境変数の設定
プロジェクトのルートディレクトリに `.env` ファイルを作成します：
```env
VITE_SUPABASE_URL=https://your-project-url.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### 3. データベースの設定
SupabaseのSQLエディタで以下のSQLファイルを順番に実行します：
1.  `docs/sql/complete_database_setup.sql` (メインテーブルの構築)
2.  `docs/sql/supabase_realtime_setup.sql` (リアルタイム同期の有効化)
3.  `docs/sql/share_feature_setup.sql` (ボード共有設定)

### 4. 開発サーバーの起動
```bash
npm run dev
```

---

## 🚀 デプロイ

### 本番ビルド
```bash
npm run build
```

### Vercelへのデプロイ
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/yourusername/sharenote)

---

## 📝 ライセンス

MITライセンスに準拠しています。詳細は `LICENSE` ファイルをご確認ください。

---

**リアルタイムのシームレスな共同編集体験のために ❤️ を込めて構築**
