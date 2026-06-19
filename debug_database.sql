-- ============================================
-- QUICK FIX: Kiểm tra & Sửa Database
-- ============================================

-- 1. Kiểm tra column canvas_data tồn tại
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'boards'
AND column_name = 'canvas_data';

-- Nếu không có, thêm vào:
ALTER TABLE public.boards
ADD COLUMN IF NOT EXISTS canvas_data jsonb;

-- 2. Kiểm tra RLS policies
SELECT policyname, cmd FROM pg_policies
WHERE tablename = 'boards';

-- 3. Test query (thay YOUR_BOARD_ID)
SELECT id, canvas_data
FROM boards
WHERE id = 'YOUR_BOARD_ID';

-- 4. Test update (thay YOUR_BOARD_ID)
UPDATE boards
SET canvas_data = '{"test": true}'::jsonb
WHERE id = 'YOUR_BOARD_ID';
