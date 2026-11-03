-- One-off cleanup. Functions pushed from a Windows checkout (migration files
-- with CRLF line endings) have carriage returns in their bodies, while the
-- same files replayed with LF endings don't, so `supabase db diff` kept
-- listing them as changed. .gitattributes now keeps *.sql LF everywhere; this
-- recreates the existing functions without \r so remote and local match.
--
-- Behaviour is unchanged: only the line endings differ, and CREATE OR REPLACE
-- keeps each function's owner and grants. A no-op on databases built from LF
-- files.
DO $$
DECLARE
  fn record;
BEGIN
  FOR fn IN
    SELECT p.oid
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname IN ('public', 'private')
      AND p.prokind = 'f'
      AND p.prosrc LIKE '%' || chr(13) || '%'
      -- Leave functions owned by extensions alone.
      AND NOT EXISTS (
        SELECT 1 FROM pg_depend d
        WHERE d.classid = 'pg_proc'::regclass AND d.objid = p.oid AND d.deptype = 'e'
      )
  LOOP
    EXECUTE replace(pg_get_functiondef(fn.oid), chr(13), '');
  END LOOP;
END $$;
