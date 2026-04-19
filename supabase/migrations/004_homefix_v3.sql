-- supabase/migrations/004_homefix_v3.sql

-- ============================================================
-- 1. PRESTADORES — new columns
-- ============================================================
ALTER TABLE prestadores
  ADD COLUMN IF NOT EXISTS is_online boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS hourly_rate numeric(10,2),
  ADD COLUMN IF NOT EXISTS last_location geography(POINT, 4326);

-- Sync is_online from existing status
UPDATE prestadores SET is_online = (status = 'online');

-- Populate last_location from existing lat/lng
UPDATE prestadores
SET last_location = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography
WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- ============================================================
-- 2. SOLICITACOES — booking-level columns
-- ============================================================
ALTER TABLE solicitacoes
  ADD COLUMN IF NOT EXISTS estimated_duration integer,        -- minutes
  ADD COLUMN IF NOT EXISTS total_price numeric(10,2),
  ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'scheduled'
    CHECK (type IN ('scheduled', 'quick_call'));

-- ============================================================
-- 3. QUICK_CALLS — Uber-style request table
-- ============================================================
CREATE TABLE IF NOT EXISTS quick_calls (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id   uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  descricao    text NOT NULL,
  categoria    text,
  latitude     double precision NOT NULL,
  longitude    double precision NOT NULL,
  radius_km    double precision NOT NULL DEFAULT 10,
  status       text NOT NULL DEFAULT 'open'
               CHECK (status IN ('open', 'locked', 'cancelled')),
  locked_by    uuid REFERENCES users(id),
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- 4. QUICK_CALL_OFFERS — provider bids
-- ============================================================
CREATE TABLE IF NOT EXISTS quick_call_offers (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quick_call_id      uuid NOT NULL REFERENCES quick_calls(id) ON DELETE CASCADE,
  prestador_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  estimated_duration integer NOT NULL,                        -- minutes
  total_price        numeric(10,2) NOT NULL,
  status             text NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (quick_call_id, prestador_id)
);

-- ============================================================
-- 5. RLS — quick_calls
-- ============================================================
ALTER TABLE quick_calls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "clients_own_quick_calls" ON quick_calls
  FOR ALL USING (auth.uid() = cliente_id);

CREATE POLICY "providers_read_open_quick_calls" ON quick_calls
  FOR SELECT USING (status = 'open');

-- ============================================================
-- 6. RLS — quick_call_offers
-- ============================================================
ALTER TABLE quick_call_offers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "providers_manage_own_offers" ON quick_call_offers
  FOR ALL USING (auth.uid() = prestador_id);

CREATE POLICY "clients_read_offers_for_own_calls" ON quick_call_offers
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM quick_calls
      WHERE id = quick_call_id AND cliente_id = auth.uid()
    )
  );

-- ============================================================
-- 7. RLS — tighten prestadores UPDATE (providers own row only)
-- ============================================================
DROP POLICY IF EXISTS "providers update own profile" ON prestadores;
CREATE POLICY "providers_update_own_profile" ON prestadores
  FOR UPDATE USING (auth.uid() = user_id);

-- ============================================================
-- 8. get_nearby_providers — rewrite using PostGIS + new filters
-- ============================================================
CREATE OR REPLACE FUNCTION get_nearby_providers(
  lat             double precision,
  lng             double precision,
  radius_km       double precision DEFAULT 10,
  filter_categoria text DEFAULT NULL,
  min_hourly_rate  numeric DEFAULT NULL,
  max_hourly_rate  numeric DEFAULT NULL
)
RETURNS TABLE (
  user_id       uuid,
  nome          text,
  email         text,
  foto_url      text,
  categoria     text,
  descricao     text,
  preco_medio   numeric,
  avaliacao     numeric,
  latitude      double precision,
  longitude     double precision,
  distance_km   double precision,
  is_online     boolean,
  hourly_rate   numeric
)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    p.user_id,
    u.nome,
    u.email,
    u.foto_url,
    p.categoria,
    p.descricao,
    p.preco_medio,
    p.avaliacao,
    ST_Y(p.last_location::geometry) AS latitude,
    ST_X(p.last_location::geometry) AS longitude,
    ST_Distance(p.last_location, ST_MakePoint(lng, lat)::geography) / 1000 AS distance_km,
    p.is_online,
    p.hourly_rate
  FROM prestadores p
  JOIN users u ON u.id = p.user_id
  WHERE
    p.approval_status = 'active'
    AND p.is_online = true
    AND p.last_location IS NOT NULL
    AND ST_DWithin(
          p.last_location,
          ST_MakePoint(lng, lat)::geography,
          radius_km * 1000
        )
    AND (filter_categoria IS NULL OR p.categoria = filter_categoria)
    AND (min_hourly_rate IS NULL OR p.hourly_rate >= min_hourly_rate)
    AND (max_hourly_rate IS NULL OR p.hourly_rate <= max_hourly_rate)
  ORDER BY distance_km ASC, p.avaliacao DESC NULLS LAST
  LIMIT 100;
$$;

-- ============================================================
-- 9. get_nearby_providers_with_availability — occupancy-based
--    Provider is available unless an accepted booking overlaps desired_at.
-- ============================================================
CREATE OR REPLACE FUNCTION get_nearby_providers_with_availability(
  lat             double precision,
  lng             double precision,
  radius_km       double precision DEFAULT 10,
  desired_at      timestamptz DEFAULT NULL,
  filter_categoria text DEFAULT NULL,
  min_hourly_rate  numeric DEFAULT NULL,
  max_hourly_rate  numeric DEFAULT NULL
)
RETURNS TABLE (
  user_id       uuid,
  nome          text,
  email         text,
  foto_url      text,
  categoria     text,
  descricao     text,
  preco_medio   numeric,
  avaliacao     numeric,
  latitude      double precision,
  longitude     double precision,
  distance_km   double precision,
  is_online     boolean,
  hourly_rate   numeric
)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    p.user_id,
    u.nome,
    u.email,
    u.foto_url,
    p.categoria,
    p.descricao,
    p.preco_medio,
    p.avaliacao,
    ST_Y(p.last_location::geometry) AS latitude,
    ST_X(p.last_location::geometry) AS longitude,
    ST_Distance(p.last_location, ST_MakePoint(lng, lat)::geography) / 1000 AS distance_km,
    p.is_online,
    p.hourly_rate
  FROM prestadores p
  JOIN users u ON u.id = p.user_id
  WHERE
    p.approval_status = 'active'
    AND p.is_online = true
    AND p.last_location IS NOT NULL
    AND ST_DWithin(
          p.last_location,
          ST_MakePoint(lng, lat)::geography,
          radius_km * 1000
        )
    AND (filter_categoria IS NULL OR p.categoria = filter_categoria)
    AND (min_hourly_rate IS NULL OR p.hourly_rate >= min_hourly_rate)
    AND (max_hourly_rate IS NULL OR p.hourly_rate <= max_hourly_rate)
    AND (
      desired_at IS NULL
      OR NOT EXISTS (
        SELECT 1 FROM solicitacoes s
        WHERE s.prestador_id = p.user_id
          AND s.status = 'aceita'
          AND s.estimated_duration IS NOT NULL
          AND desired_at >= s.data_desejada
          AND desired_at < s.data_desejada + (s.estimated_duration::text || ' minutes')::interval
      )
    )
  ORDER BY distance_km ASC, p.avaliacao DESC NULLS LAST
  LIMIT 100;
$$;

-- ============================================================
-- 10. accept_quick_call_offer — atomic race-condition-safe RPC
-- ============================================================
CREATE OR REPLACE FUNCTION accept_quick_call_offer(
  p_quick_call_id uuid,
  p_offer_id      uuid,
  p_cliente_id    uuid
)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_offer  quick_call_offers%ROWTYPE;
  v_sol_id uuid;
BEGIN
  -- Atomic lock: only succeeds if status is still 'open'
  UPDATE quick_calls
  SET
    status    = 'locked',
    locked_by = (SELECT prestador_id FROM quick_call_offers WHERE id = p_offer_id)
  WHERE id          = p_quick_call_id
    AND status      = 'open'
    AND cliente_id  = p_cliente_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'already_locked');
  END IF;

  SELECT * INTO v_offer FROM quick_call_offers WHERE id = p_offer_id;

  -- Accept winning offer, reject all others
  UPDATE quick_call_offers SET status = 'accepted' WHERE id = p_offer_id;
  UPDATE quick_call_offers
    SET status = 'rejected'
  WHERE quick_call_id = p_quick_call_id AND id <> p_offer_id;

  -- Create confirmed solicitacao
  INSERT INTO solicitacoes (
    cliente_id, prestador_id, descricao,
    data_desejada, estimated_duration, total_price, type, status
  )
  SELECT
    qc.cliente_id,
    v_offer.prestador_id,
    qc.descricao,
    now(),
    v_offer.estimated_duration,
    v_offer.total_price,
    'quick_call',
    'aceita'
  FROM quick_calls qc
  WHERE qc.id = p_quick_call_id
  RETURNING id INTO v_sol_id;

  RETURN json_build_object('success', true, 'solicitacao_id', v_sol_id);
END;
$$;
