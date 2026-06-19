# 🔍 DEBUG & FIX: Cursor & Lưu Canvas

## Vấn Đề

1. ❌ Con trỏ không hiển thị/không di chuyển
2. ❌ Canvas không lưu lại sau khi vẽ

## Cách Debug

### Bước 1: Mở Browser Console

1. Nhấn **F12** trong browser
2. Chọn tab **Console**
3. Refresh trang

### Bước 2: Kiểm Tra Logs

#### Khi mở board, bạn phải thấy:
```
[Board] Access: viewer/editor | Owner: true/false
[Canvas] Loaded saved state
[Cursors] Peers: 0
[Presence] Online users: 1
```

#### Khi di chuyển chuột, bạn phải thấy:
```
[Cursors] Sending position: {x: 123, y: 456}
```

#### Khi vẽ, bạn phải thấy:
```
[Sync] Broadcasted content changes
[Sync] Starting auto-save...
[Sync] Snapshot size: 12345 bytes
[Sync] ✅ Auto-saved to database successfully
```

#### Khi có người khác online, bạn phải thấy:
```
[Cursors] Peers: 1
[PeerCursor] Rendering: {email: "...", x: 123, y: 456}
```

## Fix Chi Tiết

### Fix 1: Cursor Không Hiển Thị

**Nguyên nhân có thể:**
1. Không có user thứ 2
2. Supabase Presence không hoạt động
3. CSS z-index bị che

**Cách fix:**

#### A. Kiểm tra có 2 tabs/users không:
```
Console phải show: [Cursors] Peers: 1
```

Nếu là 0 → Mở tab thứ 2 với cùng board URL

#### B. Kiểm tra Supabase Presence:
```javascript
// Console phải show:
[Presence] Online users: 2
```

Nếu chỉ thấy 1 → Kiểm tra Supabase credentials

#### C. Test cursor rendering:
Mở Console và gõ:
```javascript
// Xem có peer cursors không
console.log(document.querySelectorAll('[style*="position: fixed"]'))
```

### Fix 2: Canvas Không Lưu

**Nguyên nhân có thể:**
1. Column `canvas_data` không tồn tại
2. RLS policies block UPDATE
3. Auto-save không trigger

**Cách fix:**

#### A. Kiểm tra column tồn tại:

Vào **Supabase Dashboard → SQL Editor** và chạy:

```sql
-- Kiểm tra column
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'boards'
AND column_name = 'canvas_data';
```

**Kết quả mong đợi:**
```
canvas_data | jsonb
```

**Nếu rỗng**, chạy:
```sql
ALTER TABLE public.boards
ADD COLUMN canvas_data jsonb;
```

#### B. Kiểm tra RLS policies:

```sql
-- Xem policies hiện tại
SELECT policyname, cmd
FROM pg_policies
WHERE tablename = 'boards';
```

**Phải có:**
- `update_boards_with_access` FOR UPDATE

**Nếu không có**, chạy file: `complete_database_setup.sql`

#### C. Test manual update:

Lấy board ID từ URL: `/board/abc12345`

Chạy trong Supabase SQL:
```sql
-- Tìm board ID
SELECT id, owner_id, canvas_data
FROM boards
WHERE unique_slug = 'abc12345';

-- Copy board ID và test update
UPDATE boards
SET canvas_data = '{"test": true}'::jsonb
WHERE id = 'YOUR_BOARD_ID_HERE';
```

**Nếu lỗi** → RLS policies sai, chạy lại `complete_database_setup.sql`

#### D. Kiểm tra auto-save trong Console:

Vẽ gì đó, sau 2 giây phải thấy:
```
[Sync] Starting auto-save...
[Sync] Snapshot size: 12345 bytes
[Sync] ✅ Auto-saved to database successfully
```

**Nếu thấy error:**
```
[Sync] Auto-save failed: {details}
```
→ Copy error message và kiểm tra RLS policies

## Quick Fix Script

Nếu cả 2 vấn đề đều không hoạt động, chạy SQL này:

```sql
-- Fix tất cả
BEGIN;

-- 1. Thêm canvas_data column
ALTER TABLE public.boards
ADD COLUMN IF NOT EXISTS canvas_data jsonb;

-- 2. Fix UPDATE policy
DROP POLICY IF EXISTS "update_boards_with_access" ON public.boards;

CREATE POLICY "update_boards_with_access"
ON public.boards FOR UPDATE
USING (
  auth.uid() = owner_id
  OR public_access = 'editor'
);

-- 3. Test
DO $$
BEGIN
  RAISE NOTICE '✅ Database fixed!';
END $$;

COMMIT;
```

## Checklist Debug

### ✅ Cursor:
- [ ] Mở 2 tabs với cùng board URL
- [ ] Console show: `[Cursors] Peers: 1`
- [ ] Console show: `[Cursors] Sending position: {x, y}`
- [ ] Console show: `[PeerCursor] Rendering: {...}`
- [ ] Thấy cursor với tên người dùng trên màn hình

### ✅ Lưu Canvas:
- [ ] Column `canvas_data` tồn tại (kiểm tra SQL)
- [ ] RLS policy `update_boards_with_access` tồn tại
- [ ] Console show: `[Sync] ✅ Auto-saved to database successfully`
- [ ] Vẽ → F5 refresh → Vẽ vẫn còn

## Liên Hệ Debug

Nếu vẫn không hoạt động, gửi cho tôi:

1. **Console logs** đầy đủ (copy/paste text)
2. **Screenshot** console khi vẽ
3. **Kết quả SQL query:**
```sql
SELECT id, owner_id, canvas_data IS NOT NULL as has_data
FROM boards
WHERE unique_slug = 'YOUR_SLUG';
```

4. **RLS policies:**
```sql
SELECT policyname, cmd, qual::text
FROM pg_policies
WHERE tablename = 'boards';
```

---

**Build Status**: ✅ Thành công (926ms)

**Refresh browser và kiểm tra Console ngay!** 🔍
