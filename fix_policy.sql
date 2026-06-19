-- Drop old policies
DROP POLICY IF EXISTS "Users can view their own boards" ON boards;
DROP POLICY IF EXISTS "Users can create boards" ON boards;
DROP POLICY IF EXISTS "Users can update their own boards" ON boards;
DROP POLICY IF EXISTS "Users can delete their own boards" ON boards;

-- Recreate correct policies (no recursion)
CREATE POLICY "Users can view their own boards"
ON boards FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create boards"
ON boards FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own boards"
ON boards FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own boards"
ON boards FOR DELETE
USING (auth.uid() = user_id);
