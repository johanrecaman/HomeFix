-- ── 1. Slots table ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.slots (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  prestador_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  starts_at    timestamptz NOT NULL,
  ends_at      timestamptz NOT NULL,
  status       text NOT NULL DEFAULT 'free'
                 CHECK (status IN ('free', 'booked')),
  created_at   timestamptz DEFAULT now(),
  CONSTRAINT slots_end_after_start CHECK (ends_at > starts_at)
);

CREATE INDEX IF NOT EXISTS slots_prestador_idx ON public.slots (prestador_id);
CREATE INDEX IF NOT EXISTS slots_starts_at_idx ON public.slots (starts_at);

-- ── 2. Add slot_id to solicitacoes ─────────────────────────────────────────
ALTER TABLE public.solicitacoes
  ADD COLUMN IF NOT EXISTS slot_id uuid REFERENCES public.slots(id) ON DELETE SET NULL;

-- ── 3. RLS for slots ───────────────────────────────────────────────────────
ALTER TABLE public.slots ENABLE ROW LEVEL SECURITY;

-- Providers can read their own slots
CREATE POLICY "provider reads own slots"
  ON public.slots FOR SELECT
  USING (prestador_id = auth.uid());

-- Clients can read free slots (to check availability)
CREATE POLICY "client reads free slots"
  ON public.slots FOR SELECT
  USING (status = 'free');

-- Providers can insert their own slots
CREATE POLICY "provider inserts own slots"
  ON public.slots FOR INSERT
  WITH CHECK (prestador_id = auth.uid());

-- Providers can delete their own free slots
CREATE POLICY "provider deletes own free slots"
  ON public.slots FOR DELETE
  USING (prestador_id = auth.uid() AND status = 'free');

-- System/admin can update slot status (when proposal accepted/rejected)
CREATE POLICY "provider updates own slot status"
  ON public.slots FOR UPDATE
  USING (prestador_id = auth.uid())
  WITH CHECK (prestador_id = auth.uid());

-- ── 4. RPC: nearby providers WITH availability ────────────────────────────
CREATE OR REPLACE FUNCTION get_nearby_providers_with_availability(
  lat         double precision,
  lng         double precision,
  radius_km   integer,
  desired_at  timestamptz
)
RETURNS TABLE (
  user_id         uuid,
  status          text,
  approval_status text,
  categoria       text,
  latitude        double precision,
  longitude       double precision,
  preco_medio     numeric,
  descricao       text,
  foto_url        text,
  avaliacao       numeric,
  nome            text,
  user_foto_url   text,
  slot_id         uuid,
  slot_starts_at  timestamptz,
  slot_ends_at    timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT DISTINCT ON (p.user_id)
    p.user_id,
    p.status,
    p.approval_status,
    p.categoria,
    p.latitude,
    p.longitude,
    p.preco_medio,
    p.descricao,
    p.foto_url,
    p.avaliacao,
    u.nome,
    u.foto_url AS user_foto_url,
    s.id       AS slot_id,
    s.starts_at AS slot_starts_at,
    s.ends_at   AS slot_ends_at
  FROM prestadores p
  JOIN users u ON u.id = p.user_id
  JOIN slots s ON s.prestador_id = p.user_id
  WHERE
    p.status = 'online'
    AND p.approval_status = 'active'
    AND p.latitude IS NOT NULL
    AND p.longitude IS NOT NULL
    AND s.status = 'free'
    AND s.starts_at <= desired_at
    AND s.ends_at   >  desired_at
    AND ST_DWithin(
      ST_MakePoint(p.longitude, p.latitude)::geography,
      ST_MakePoint(lng, lat)::geography,
      radius_km * 1000
    )
  ORDER BY p.user_id, s.starts_at;
$$;

GRANT EXECUTE ON FUNCTION get_nearby_providers_with_availability TO authenticated;
