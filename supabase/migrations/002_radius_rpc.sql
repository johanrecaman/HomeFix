-- PostGIS is enabled by default on Supabase — no CREATE EXTENSION needed.

CREATE OR REPLACE FUNCTION get_nearby_providers(
  lat        double precision,
  lng        double precision,
  radius_km  integer DEFAULT 10
)
RETURNS TABLE (
  user_id        uuid,
  status         text,
  approval_status text,
  categoria      text,
  latitude       double precision,
  longitude      double precision,
  preco_medio    numeric,
  descricao      text,
  foto_url       text,
  avaliacao      numeric,
  nome           text,
  user_foto_url  text
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
    p.foto_url,
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
    AND ST_DWithin(
      ST_MakePoint(p.longitude, p.latitude)::geography,
      ST_MakePoint(lng, lat)::geography,
      radius_km * 1000
    );
$$;

GRANT EXECUTE ON FUNCTION get_nearby_providers TO authenticated;
