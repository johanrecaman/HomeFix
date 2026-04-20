-- Original basic RPC using lat/lng columns.
-- Migration 004 replaces this with the PostGIS version (run 004 after this).
CREATE OR REPLACE FUNCTION get_nearby_providers(
  lat        double precision,
  lng        double precision,
  radius_km  integer DEFAULT 10
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
  avaliacao       numeric,
  nome            text,
  user_foto_url   text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    p.user_id,
    p.status,
    p.approval_status,
    p.categoria,
    p.latitude,
    p.longitude,
    p.preco_medio,
    p.descricao,
    p.avaliacao,
    u.nome,
    u.foto_url AS user_foto_url
  FROM prestadores p
  JOIN users u ON u.id = p.user_id
  WHERE
    p.status = 'online'
    AND p.approval_status = 'active'
    AND p.latitude IS NOT NULL
    AND p.longitude IS NOT NULL
    AND (
      6371 * acos(
        LEAST(1.0,
          cos(radians(lat)) * cos(radians(p.latitude)) *
          cos(radians(p.longitude) - radians(lng)) +
          sin(radians(lat)) * sin(radians(p.latitude))
        )
      )
    ) <= radius_km
  LIMIT 100;
$$;

GRANT EXECUTE ON FUNCTION get_nearby_providers TO authenticated;
