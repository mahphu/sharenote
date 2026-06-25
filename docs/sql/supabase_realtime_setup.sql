-- ============================================
-- SHARENOTE — Complete Supabase Setup
-- Real-time with Broadcast + Postgres Changes
-- ============================================

-- Step 1: Enable Realtime for tables
BEGIN;

-- Remove existing publication
DROP PUBLICATION IF EXISTS supabase_realtime;

-- Create publication with no tables
CREATE PUBLICATION supabase_realtime;

COMMIT;

-- Add tables to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE boards;

-- Step 2: Broadcast Authorization (for cursor presence)
-- Allow authenticated users to receive broadcast messages
CREATE POLICY "Authenticated users can receive broadcasts"
ON "realtime"."messages"
FOR SELECT
TO authenticated
USING (true);

-- Step 3: Canvas persistence function (auto-save to DB)
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

-- Step 4: Create trigger for boards table
DROP TRIGGER IF EXISTS handle_boards_changes ON public.boards;

CREATE TRIGGER handle_boards_changes
AFTER INSERT OR UPDATE OR DELETE
ON public.boards
FOR EACH ROW
EXECUTE FUNCTION boards_changes();

-- Step 5: Add updated_at trigger for boards
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

-- Step 6: Verify RLS policies on messages table
-- (Keep existing policies, ensure they allow INSERT for authenticated users)

-- Step 7: Verify RLS policies on boards table
-- (Keep existing policies, ensure they allow UPDATE for owner)

-- Done! Now your tables are ready for realtime subscriptions.
