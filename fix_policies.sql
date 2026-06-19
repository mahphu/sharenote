-- Drop ALL policies on boards table (no matter the name)
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'boards' AND schemaname = 'public')
  LOOP
    EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON public.boards';
  END LOOP;
END $$;

-- Recreate simple, non-recursive policies
CREATE POLICY "select_own_boards"
ON public.boards FOR SELECT
USING (auth.uid() = owner_id);

CREATE POLICY "insert_own_boards"
ON public.boards FOR INSERT
WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "update_own_boards"
ON public.boards FOR UPDATE
USING (auth.uid() = owner_id);

CREATE POLICY "delete_own_boards"
ON public.boards FOR DELETE
USING (auth.uid() = owner_id);
