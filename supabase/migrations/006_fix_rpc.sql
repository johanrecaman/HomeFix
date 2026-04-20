-- Drops ALL overloads of get_nearby_providers then re-creates the single
-- canonical PostGIS version. Safe to run multiple times.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'get_nearby_providers'
  LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS public.get_nearby_providers(' || r.args || ')';
  END LOOP;
END $$;

CREATE FUNCTION get_nearby_providers(
  lat               double precision,
  lng               double precision,
  radius_km         double precision DEFAULT 10,
  filter_categoria  text             DEFAULT NULL,
  min_hourly_rate   numeric          DEFAULT NULL,
  max_hourly_rate   numeric          DEFAULT NULL
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
    ST_Y(p.last_location::geometry)  AS latitude,
    ST_X(p.last_location::geometry)  AS longitude,
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
    AND (min_hourly_rate  IS NULL OR p.hourly_rate >= min_hourly_rate)
    AND (max_hourly_rate  IS NULL OR p.hourly_rate <= max_hourly_rate)
  ORDER BY distance_km ASC, p.avaliacao DESC NULLS LAST
  LIMIT 100;
$$;

GRANT EXECUTE ON FUNCTION get_nearby_providers TO authenticated;
