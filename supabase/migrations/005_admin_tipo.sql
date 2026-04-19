-- supabase/migrations/005_admin_tipo.sql

-- ============================================================
-- 1. Allow 'admin' as a valid tipo value
-- ============================================================
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_tipo_check;
ALTER TABLE users ADD CONSTRAINT users_tipo_check
  CHECK (tipo IN ('cliente', 'prestador', 'admin'));

-- ============================================================
-- 2. Migrate existing admin users
-- ============================================================
UPDATE users SET tipo = 'admin' WHERE is_admin = true;

-- ============================================================
-- 3. Drop the is_admin column
-- ============================================================
ALTER TABLE users DROP COLUMN IF EXISTS is_admin;

-- ============================================================
-- 4. Rewrite is_admin() helper (used by existing RLS policies)
--    All policies that call is_admin() continue working unchanged.
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND tipo = 'admin'
  );
$$;

-- ============================================================
-- 5. Add 'cancelada' to solicitacoes.status
-- ============================================================
ALTER TABLE solicitacoes DROP CONSTRAINT IF EXISTS solicitacoes_status_check;
ALTER TABLE solicitacoes ADD CONSTRAINT solicitacoes_status_check
  CHECK (status IN ('pendente', 'aceita', 'recusada', 'cancelada'));
