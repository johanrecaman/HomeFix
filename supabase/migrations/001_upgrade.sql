-- ── Camada 1: Upgrade HomeFix MVP ───────────────────────────────────────────

-- 1. Admin flag em users
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false;

-- 2. Aprovação/ban de prestadores (separado do status de presença)
ALTER TABLE public.prestadores
  ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'active'
  CHECK (approval_status IN ('active', 'banned'));

-- 3. Avaliação média
ALTER TABLE public.prestadores
  ADD COLUMN IF NOT EXISTS avaliacao numeric(2,1) DEFAULT null;

-- 4. Promover primeiro admin (rode apenas uma vez)
UPDATE public.users SET is_admin = true WHERE email = 'johanstrr@gmail.com';

-- ── RLS: substituir policy pública de prestadores ────────────────────────────

-- Remove policy antiga que não filtrava por approval_status
DROP POLICY IF EXISTS "Anyone can read online providers" ON public.prestadores;

-- Qualquer um lê prestadores ativos
CREATE POLICY "Public reads active providers"
  ON public.prestadores FOR SELECT
  USING (approval_status = 'active');

-- Admin lê todos os prestadores (inclusive banidos)
CREATE POLICY "Admin reads all providers"
  ON public.prestadores FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- Admin pode editar qualquer prestador (ban/unban, avaliacao)
CREATE POLICY "Admin updates any provider"
  ON public.prestadores FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- Admin pode ler todos os perfis de usuário
CREATE POLICY "Admin reads all users"
  ON public.users FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- Admin pode atualizar qualquer perfil de usuário
CREATE POLICY "Admin updates any user"
  ON public.users FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND is_admin = true
    )
  );
