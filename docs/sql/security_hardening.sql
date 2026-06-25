-- ============================================
-- SHARENOTE — Security Hardening SQL
-- Rate limiting, input validation, audit logging
-- ============================================

-- ================================================
-- 1. MESSAGE LENGTH CONSTRAINT
-- ================================================

ALTER TABLE public.messages
ADD CONSTRAINT message_length_check
CHECK (char_length(content) <= 5000);

COMMENT ON CONSTRAINT message_length_check ON public.messages IS
  'Prevents DoS via oversized messages (max 5000 characters)';

-- ================================================
-- 2. CANVAS DATA SIZE LIMIT
-- ================================================

ALTER TABLE public.boards
ADD CONSTRAINT canvas_size_limit
CHECK (pg_column_size(canvas_data) < 10485760); -- 10MB

COMMENT ON CONSTRAINT canvas_size_limit ON public.boards IS
  'Prevents DoS via massive canvas data (max 10MB)';

-- ================================================
-- 3. RATE LIMITING FUNCTION
-- ================================================

-- Create rate limiting function
CREATE OR REPLACE FUNCTION public.check_board_creation_rate_limit()
RETURNS boolean AS $$
DECLARE
  recent_count integer;
BEGIN
  -- Count boards created by this user in last minute
  SELECT COUNT(*) INTO recent_count
  FROM public.boards
  WHERE owner_id = auth.uid()
    AND created_at > NOW() - INTERVAL '1 minute';

  -- Allow max 5 boards per minute
  RETURN recent_count < 5;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to enforce rate limit
CREATE OR REPLACE FUNCTION public.enforce_board_creation_rate_limit()
RETURNS trigger AS $$
BEGIN
  IF NOT public.check_board_creation_rate_limit() THEN
    RAISE EXCEPTION 'Rate limit exceeded. Maximum 5 boards per minute.'
      USING HINT = 'Please wait before creating more boards.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS board_creation_rate_limit ON public.boards;

CREATE TRIGGER board_creation_rate_limit
BEFORE INSERT ON public.boards
FOR EACH ROW
EXECUTE FUNCTION enforce_board_creation_rate_limit();

-- ================================================
-- 4. AUDIT LOGGING TABLE
-- ================================================

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id bigserial PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  resource_type text NOT NULL,
  resource_id uuid,
  old_data jsonb,
  new_data jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamptz DEFAULT NOW()
);

-- Enable RLS on audit logs
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Only allow reading own audit logs
CREATE POLICY "Users can read own audit logs"
ON public.audit_logs FOR SELECT
USING (user_id = auth.uid());

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_created
ON public.audit_logs(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_resource
ON public.audit_logs(resource_type, resource_id);

-- ================================================
-- 5. AUDIT LOGGING FUNCTION
-- ================================================

CREATE OR REPLACE FUNCTION public.log_audit(
  p_action text,
  p_resource_type text,
  p_resource_id uuid DEFAULT NULL,
  p_old_data jsonb DEFAULT NULL,
  p_new_data jsonb DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  INSERT INTO public.audit_logs (
    user_id,
    action,
    resource_type,
    resource_id,
    old_data,
    new_data
  ) VALUES (
    auth.uid(),
    p_action,
    p_resource_type,
    p_resource_id,
    p_old_data,
    p_new_data
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ================================================
-- 6. AUTO AUDIT TRIGGERS
-- ================================================

-- Audit board operations
CREATE OR REPLACE FUNCTION public.audit_board_changes()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.log_audit('CREATE', 'board', NEW.id, NULL, to_jsonb(NEW));
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM public.log_audit('UPDATE', 'board', NEW.id, to_jsonb(OLD), to_jsonb(NEW));
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public.log_audit('DELETE', 'board', OLD.id, to_jsonb(OLD), NULL);
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS audit_board_changes ON public.boards;

CREATE TRIGGER audit_board_changes
AFTER INSERT OR UPDATE OR DELETE ON public.boards
FOR EACH ROW
EXECUTE FUNCTION audit_board_changes();

-- ================================================
-- 7. SECURE ACCESS VALIDATION FUNCTION
-- ================================================

CREATE OR REPLACE FUNCTION public.can_access_board(p_board_slug text)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.boards
    WHERE unique_slug = p_board_slug
      AND (
        owner_id = auth.uid()
        OR public_access IN ('viewer', 'editor')
      )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.can_access_board IS
  'Server-side validation for board access (defense-in-depth)';

-- ================================================
-- 8. SLUG UNIQUENESS INDEX
-- ================================================

CREATE UNIQUE INDEX IF NOT EXISTS idx_boards_unique_slug
ON public.boards(unique_slug);

COMMENT ON INDEX idx_boards_unique_slug IS
  'Ensures slug uniqueness and improves lookup performance';

-- ================================================
-- 9. AUTO-CLEANUP OLD AUDIT LOGS
-- ================================================

-- Function to clean up logs older than 90 days
CREATE OR REPLACE FUNCTION public.cleanup_old_audit_logs()
RETURNS void AS $$
BEGIN
  DELETE FROM public.audit_logs
  WHERE created_at < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Schedule daily cleanup (requires pg_cron extension)
-- Note: Enable pg_cron in Supabase dashboard first
-- SELECT cron.schedule(
--   'cleanup-audit-logs',
--   '0 2 * * *', -- 2 AM daily
--   $$ SELECT public.cleanup_old_audit_logs(); $$
-- );

-- ================================================
-- 10. VERIFICATION
-- ================================================

DO $$
BEGIN
  RAISE NOTICE '✓ Message length constraint added (max 5000 chars)';
  RAISE NOTICE '✓ Canvas size limit added (max 10MB)';
  RAISE NOTICE '✓ Rate limiting function created (max 5 boards/min)';
  RAISE NOTICE '✓ Audit logging system created';
  RAISE NOTICE '✓ Audit triggers enabled for boards';
  RAISE NOTICE '✓ Server-side access validation function created';
  RAISE NOTICE '✓ Slug uniqueness enforced';
  RAISE NOTICE '✓ Security hardening complete!';
END $$;
