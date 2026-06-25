-- ============================================
-- SHARENOTE — Share via Link Feature
-- Add public access controls to boards
-- ============================================

-- Step 1: Add public_access column to boards table
ALTER TABLE public.boards
ADD COLUMN public_access text NOT NULL DEFAULT 'restricted'
CHECK (public_access IN ('restricted', 'viewer', 'editor'));

-- Step 2: Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_boards_public_access
ON public.boards(public_access);

-- Step 3: Update RLS policies to support public access

-- Drop existing SELECT policy
DROP POLICY IF EXISTS "select_own_boards" ON public.boards;

-- Create new SELECT policy with public access support
CREATE POLICY "select_boards_with_access"
ON public.boards FOR SELECT
USING (
  -- Owner can always view
  auth.uid() = owner_id
  OR
  -- Anyone can view if public_access is 'viewer' or 'editor'
  public_access IN ('viewer', 'editor')
);

-- Drop existing UPDATE policy
DROP POLICY IF EXISTS "update_own_boards" ON public.boards;

-- Create new UPDATE policy with public access support
CREATE POLICY "update_boards_with_access"
ON public.boards FOR UPDATE
USING (
  -- Owner can always update
  auth.uid() = owner_id
  OR
  -- Anyone can update if public_access is 'editor'
  public_access = 'editor'
);

-- Step 4: Update messages policies to support public boards

-- Drop existing message policies
DROP POLICY IF EXISTS "Users can read messages in their boards" ON public.messages;
DROP POLICY IF EXISTS "Users can send messages" ON public.messages;

-- New policy: Read messages in accessible boards
CREATE POLICY "read_messages_in_accessible_boards"
ON public.messages FOR SELECT
USING (
  board_id IN (
    SELECT id FROM public.boards
    WHERE owner_id = auth.uid()
       OR public_access IN ('viewer', 'editor')
  )
);

-- New policy: Send messages in editable boards
CREATE POLICY "send_messages_in_editable_boards"
ON public.messages FOR INSERT
WITH CHECK (
  board_id IN (
    SELECT id FROM public.boards
    WHERE owner_id = auth.uid()
       OR public_access = 'editor'
  )
  AND sender_id = auth.uid()
);

-- Step 5: Add comment for documentation
COMMENT ON COLUMN public.boards.public_access IS
  'Public access level: restricted (owner only), viewer (read-only), editor (can edit)';

-- Done! Public access controls are now active.
