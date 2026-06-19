-- ============================================
-- SHARENOTE — Complete Database Setup
-- Realtime + Share Feature (Unified)
-- ============================================

-- ================================================
-- PART 1: ENABLE REALTIME FOR TABLES
-- ================================================

BEGIN;

-- Remove existing publication
DROP PUBLICATION IF EXISTS supabase_realtime;

-- Create publication with no tables
CREATE PUBLICATION supabase_realtime;

COMMIT;

-- Add tables to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE boards;

-- ================================================
-- PART 2: ADD PUBLIC ACCESS COLUMN
-- ================================================

-- Add public_access column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'boards'
    AND column_name = 'public_access'
  ) THEN
    ALTER TABLE public.boards
    ADD COLUMN public_access text NOT NULL DEFAULT 'restricted'
    CHECK (public_access IN ('restricted', 'viewer', 'editor'));
  END IF;
END $$;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_boards_public_access
ON public.boards(public_access);

-- ================================================
-- PART 3: BROADCAST AUTHORIZATION
-- ================================================

-- Drop existing broadcast policy if it exists
DROP POLICY IF EXISTS "Authenticated users can receive broadcasts"
ON "realtime"."messages";

-- Allow authenticated users to receive broadcast messages
CREATE POLICY "Authenticated users can receive broadcasts"
ON "realtime"."messages"
FOR SELECT
TO authenticated
USING (true);

-- ================================================
-- PART 4: CANVAS PERSISTENCE TRIGGERS
-- ================================================

-- Canvas persistence function (auto-save to DB)
CREATE OR REPLACE FUNCTION public.boards_changes()
RETURNS trigger
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Broadcast canvas changes to all subscribers
  PERFORM realtime.broadcast_changes(
    'board:' || COALESCE(NEW.id, OLD.id)::text,
    TG_OP,
    TG_OP,
    TG_TABLE_NAME,
    TG_TABLE_SCHEMA,
    NEW,
    OLD
  );
  RETURN NULL;
END;
$$;

-- Create trigger for boards table
DROP TRIGGER IF EXISTS handle_boards_changes ON public.boards;

CREATE TRIGGER handle_boards_changes
AFTER INSERT OR UPDATE OR DELETE
ON public.boards
FOR EACH ROW
EXECUTE FUNCTION boards_changes();

-- Add updated_at trigger for boards
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_updated_at ON public.boards;

CREATE TRIGGER set_updated_at
BEFORE UPDATE ON public.boards
FOR EACH ROW
EXECUTE FUNCTION handle_updated_at();

-- ================================================
-- PART 5: RLS POLICIES FOR BOARDS (WITH SHARING)
-- ================================================

-- Drop all existing board policies
DROP POLICY IF EXISTS "select_own_boards" ON public.boards;
DROP POLICY IF EXISTS "select_boards_with_access" ON public.boards;
DROP POLICY IF EXISTS "update_own_boards" ON public.boards;
DROP POLICY IF EXISTS "update_boards_with_access" ON public.boards;
DROP POLICY IF EXISTS "insert_own_boards" ON public.boards;
DROP POLICY IF EXISTS "delete_own_boards" ON public.boards;

-- SELECT: Owner OR public access
CREATE POLICY "select_boards_with_access"
ON public.boards FOR SELECT
USING (
  auth.uid() = owner_id
  OR public_access IN ('viewer', 'editor')
);

-- INSERT: Only authenticated users for their own boards
CREATE POLICY "insert_own_boards"
ON public.boards FOR INSERT
WITH CHECK (auth.uid() = owner_id);

-- UPDATE: Owner OR editor access
CREATE POLICY "update_boards_with_access"
ON public.boards FOR UPDATE
USING (
  auth.uid() = owner_id
  OR public_access = 'editor'
);

-- DELETE: Only owner
CREATE POLICY "delete_own_boards"
ON public.boards FOR DELETE
USING (auth.uid() = owner_id);

-- ================================================
-- PART 6: RLS POLICIES FOR MESSAGES (WITH SHARING)
-- ================================================

-- Drop all existing message policies
DROP POLICY IF EXISTS "Users can read messages in their boards" ON public.messages;
DROP POLICY IF EXISTS "Users can send messages" ON public.messages;
DROP POLICY IF EXISTS "read_messages_in_accessible_boards" ON public.messages;
DROP POLICY IF EXISTS "send_messages_in_editable_boards" ON public.messages;

-- SELECT: Read messages in accessible boards
CREATE POLICY "read_messages_in_accessible_boards"
ON public.messages FOR SELECT
USING (
  board_id IN (
    SELECT id FROM public.boards
    WHERE owner_id = auth.uid()
       OR public_access IN ('viewer', 'editor')
  )
);

-- INSERT: Send messages only in boards you own or have editor access
CREATE POLICY "send_messages_in_editable_boards"
ON public.messages FOR INSERT
WITH CHECK (
  sender_id = auth.uid()
  AND board_id IN (
    SELECT id FROM public.boards
    WHERE owner_id = auth.uid()
       OR public_access = 'editor'
  )
);

-- ================================================
-- PART 7: ADD DOCUMENTATION
-- ================================================

COMMENT ON COLUMN public.boards.public_access IS
  'Public access level: restricted (owner only), viewer (read-only), editor (can edit)';

-- ================================================
-- SETUP COMPLETE!
-- ================================================

-- Verify the setup
DO $$
BEGIN
  RAISE NOTICE '✓ Realtime enabled for messages and boards tables';
  RAISE NOTICE '✓ Public access column added to boards';
  RAISE NOTICE '✓ Broadcast authorization policy created';
  RAISE NOTICE '✓ Canvas persistence triggers created';
  RAISE NOTICE '✓ RLS policies updated with sharing support';
  RAISE NOTICE '✓ Setup complete! Refresh your app.';
END $$;
