# HomeFix v2 — Foundation: Role Refactoring + Map Geolocation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Isolate admin as a first-class role, fix all routing guards, and refactor ClientMap to require user geolocation before rendering — loading only providers within an adjustable radius via a PostGIS RPC.

**Architecture:** Admin isolation is a pure routing fix (no DB migration needed — `is_admin` boolean already exists). Geolocation becomes a blocking gate before the map renders, implemented as a reusable `LocationGate` component. Provider fetching is replaced with a `get_nearby_providers` Supabase RPC backed by PostGIS `ST_DWithin`, avoiding full-table scans.

**Tech Stack:** React 19, Tailwind CSS 3, Supabase v2 (PostGIS enabled by default), @react-google-maps/api, lucide-react.

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/pages/LandingPage.jsx` | MODIFY | Add `is_admin` branch to redirect logic |
| `src/App.jsx` | MODIFY | PrivateRoute blocks admins; add `/cliente` stub route |
| `src/components/Header.jsx` | MODIFY | Show "Painel Admin" nav for admins |
| `src/hooks/useGeolocation.js` | MODIFY | Expose `state` ('idle'\|'requesting'\|'granted'\|'denied'\|'unsupported') |
| `src/components/LocationGate.jsx` | CREATE | Blocking UI gate: requests GPS, shows error states, passes `coords` as render prop |
| `supabase/migrations/002_radius_rpc.sql` | CREATE | PostGIS RPC `get_nearby_providers(lat, lng, radius_km)` |
| `src/pages/ClientMap.jsx` | MODIFY | Use LocationGate, RPC fetch, radius slider, remove SP default center |

---

## Task 1: Admin Role Routing Isolation

**Files:**
- Modify: `src/pages/LandingPage.jsx:50-54`
- Modify: `src/App.jsx:13-23`
- Modify: `src/components/Header.jsx`

### What changes

`LandingPage` currently redirects any non-`prestador` user to `/mapa`. It must check `is_admin` first. `PrivateRoute` in `App.jsx` must reject admins (redirect to `/admin`). `Header` must show a "Painel Admin" button for admins instead of "Buscar"/"Dashboard".

- [ ] **Step 1: Update LandingPage redirect**

In `src/pages/LandingPage.jsx`, replace lines 50–54:

```jsx
useEffect(() => {
  if (!loading && profile) {
    navigate(profile.tipo === 'prestador' ? '/dashboard' : '/mapa', { replace: true })
  }
}, [profile, loading, navigate])
```

With:

```jsx
useEffect(() => {
  if (!loading && profile) {
    if (profile.is_admin) navigate('/admin', { replace: true })
    else navigate(profile.tipo === 'prestador' ? '/dashboard' : '/mapa', { replace: true })
  }
}, [profile, loading, navigate])
```

- [ ] **Step 2: Update PrivateRoute in App.jsx**

Replace the `PrivateRoute` function (lines 13–23) with:

```jsx
function PrivateRoute({ children, requiredType }) {
  const { profile, loading } = useAuth()
  if (loading) return (
    <div className="h-screen grid place-items-center" style={{ background: 'var(--bg)' }}>
      <span className="w-8 h-8 border-4 border-teal-400 border-t-transparent rounded-full animate-spin"/>
    </div>
  )
  if (!profile) return <Navigate to="/login" replace/>
  if (profile.is_admin) return <Navigate to="/admin" replace/>
  if (requiredType && profile.tipo !== requiredType) return <Navigate to="/" replace/>
  return children
}
```

- [ ] **Step 3: Update Header nav for admin**

In `src/components/Header.jsx`, replace the logged-in button block:

```jsx
{profile ? (
  <>
    <span className="hidden md:block text-sm text-ink-600 dark:text-ink-400 font-medium">{profile.nome}</span>
    <Button variant="ghost" size="sm" onClick={handleSignOut}>Sair</Button>
    <Button size="sm" onClick={() => navigate(profile.tipo === 'prestador' ? '/dashboard' : '/mapa')}>
      {profile.tipo === 'prestador' ? 'Dashboard' : 'Buscar'}
    </Button>
  </>
```

With:

```jsx
{profile ? (
  <>
    <span className="hidden md:block text-sm text-ink-600 dark:text-ink-400 font-medium">{profile.nome}</span>
    <Button variant="ghost" size="sm" onClick={handleSignOut}>Sair</Button>
    <Button size="sm" onClick={() => navigate(
      profile.is_admin ? '/admin' :
      profile.tipo === 'prestador' ? '/dashboard' : '/mapa'
    )}>
      {profile.is_admin ? 'Painel Admin' : profile.tipo === 'prestador' ? 'Dashboard' : 'Buscar'}
    </Button>
  </>
```

- [ ] **Step 4: Verify**

Run `npm run dev`. Log in with the admin account (`johanstrr@gmail.com`). Expected:
- Landing page redirects to `/admin` immediately
- Trying to navigate to `/mapa` in the browser URL bar redirects back to `/admin`
- Header shows "Painel Admin" button

- [ ] **Step 5: Commit**

```bash
git add src/pages/LandingPage.jsx src/App.jsx src/components/Header.jsx
git commit -m "feat: isolate admin role — routing guards and nav"
```

---

## Task 2: Refactor useGeolocation + Create LocationGate

**Files:**
- Modify: `src/hooks/useGeolocation.js`
- Create: `src/components/LocationGate.jsx`

### What changes

`useGeolocation` currently only exposes a `getPosition()` promise. We need it to expose a declarative `state` so `LocationGate` can render different UIs. `LocationGate` is a new component that takes a render prop `children(coords)` — it blocks rendering until GPS is granted.

- [ ] **Step 1: Rewrite useGeolocation.js**

Replace the entire contents of `src/hooks/useGeolocation.js` with:

```js
import { useState, useCallback } from 'react'

export function useGeolocation() {
  const [state, setState] = useState('idle')
  const [coords, setCoords] = useState(null)

  const request = useCallback(() => {
    if (!navigator.geolocation) {
      setState('unsupported')
      return
    }
    setState('requesting')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setState('granted')
      },
      () => setState('denied'),
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }, [])

  return { state, coords, request }
}
```

- [ ] **Step 2: Create LocationGate.jsx**

Create `src/components/LocationGate.jsx`:

```jsx
import { useEffect } from 'react'
import { MapPin, AlertCircle } from 'lucide-react'
import { useGeolocation } from '../hooks/useGeolocation'

export function LocationGate({ children }) {
  const { state, coords, request } = useGeolocation()

  useEffect(() => { request() }, [request])

  if (state === 'idle' || state === 'requesting') {
    return (
      <div className="flex-1 grid place-items-center" style={{ minHeight: 'calc(100vh - 76px)' }}>
        <div className="flex flex-col items-center gap-4 text-center max-w-xs px-6">
          <div className="w-16 h-16 rounded-2xl bg-teal-100 dark:bg-teal-400/15 grid place-items-center">
            <MapPin size={28} className="text-teal-600 dark:text-teal-400 animate-pulse"/>
          </div>
          <h2 className="text-xl font-extrabold text-ink-900 dark:text-white" style={{ letterSpacing: '-0.025em' }}>
            Aguardando localização
          </h2>
          <p className="text-sm text-ink-500 dark:text-ink-600 leading-relaxed">
            Permita o acesso à sua localização para ver os prestadores disponíveis perto de você.
          </p>
          <span className="w-6 h-6 border-2 border-teal-400 border-t-transparent rounded-full animate-spin"/>
        </div>
      </div>
    )
  }

  if (state === 'denied' || state === 'unsupported') {
    return (
      <div className="flex-1 grid place-items-center" style={{ minHeight: 'calc(100vh - 76px)' }}>
        <div className="flex flex-col items-center gap-4 text-center max-w-xs px-6">
          <div className="w-16 h-16 rounded-2xl bg-red-50 dark:bg-red-500/10 grid place-items-center">
            <AlertCircle size={28} className="text-red-500"/>
          </div>
          <h2 className="text-xl font-extrabold text-ink-900 dark:text-white" style={{ letterSpacing: '-0.025em' }}>
            Localização necessária
          </h2>
          <p className="text-sm text-ink-500 dark:text-ink-600 leading-relaxed">
            {state === 'unsupported'
              ? 'Seu navegador não suporta geolocalização. Tente em outro dispositivo.'
              : 'Permita o acesso à localização nas configurações do navegador e recarregue a página.'}
          </p>
          {state === 'denied' && (
            <button
              onClick={() => window.location.reload()}
              className="px-5 py-2.5 rounded-xl bg-teal-400 text-ink-900 font-bold text-sm hover:bg-teal-300 transition-colors"
            >
              Tentar novamente
            </button>
          )}
        </div>
      </div>
    )
  }

  return children(coords)
}
```

- [ ] **Step 3: Verify (visual)**

`ClientMap` still uses the old `useGeolocation` call — it won't break yet because we haven't changed ClientMap. Verify the hook still exports correctly by checking no import errors in the console.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useGeolocation.js src/components/LocationGate.jsx
git commit -m "feat: geolocation gate component with permission states"
```

---

## Task 3: PostGIS RPC Migration

**Files:**
- Create: `supabase/migrations/002_radius_rpc.sql`

### What changes

Replace the full-table `prestadores` query with a PostGIS `ST_DWithin` RPC. PostGIS is enabled by default in Supabase. The function takes `lat`, `lng`, `radius_km` and returns only providers within the radius. `SECURITY DEFINER` lets it bypass RLS for the join while still being safe (the WHERE clause enforces `approval_status = 'active'`).

- [ ] **Step 1: Create migration file**

Create `supabase/migrations/002_radius_rpc.sql`:

```sql
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
```

> **Note on ST_MakePoint:** takes `(longitude, latitude)` — not `(lat, lng)`. The function parameters are named `lat/lng` for clarity but are passed in the correct order to `ST_MakePoint`.

- [ ] **Step 2: Run migration in Supabase SQL Editor**

Open Supabase Dashboard → SQL Editor → paste the contents of `002_radius_rpc.sql` → Run.

Expected output: `Success. No rows returned.`

- [ ] **Step 3: Test the RPC directly in SQL Editor**

```sql
SELECT * FROM get_nearby_providers(-23.55, -46.63, 50);
```

Expected: returns rows for providers near São Paulo (or empty if none are online/active). No error. If `ERROR: function st_dwithin does not exist` — PostGIS is not enabled; run `CREATE EXTENSION IF NOT EXISTS postgis;` first.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/002_radius_rpc.sql
git commit -m "feat: PostGIS RPC get_nearby_providers with radius filter"
```

---

## Task 4: Refactor ClientMap — LocationGate + RPC + Radius Slider

**Files:**
- Modify: `src/pages/ClientMap.jsx`

### What changes

1. Remove hardcoded `center` state (`{ lat: -23.55, lng: -46.63 }`)
2. Remove the inline `getCurrentPosition` call in `useEffect`
3. Wrap map content in `LocationGate` — receive `userLocation` from render prop
4. Replace `fetchOnlineProviders()` with `fetchNearbyProviders(lat, lng, radius)`
5. Add `radius` state (default 10km) with a slider in the sidebar header
6. Re-fetch when `radius` changes (debounced 500ms)
7. Update realtime channel to re-fetch with current location + radius

- [ ] **Step 1: Replace fetchOnlineProviders with fetchNearbyProviders**

In `src/pages/ClientMap.jsx`, replace the `fetchOnlineProviders` function (lines 99–111) with:

```js
async function fetchNearbyProviders(lat, lng, radiusKm = 10) {
  const { data } = await supabase.rpc('get_nearby_providers', {
    lat, lng, radius_km: radiusKm,
  })
  return (data || []).map(p => ({ ...p, foto_url: p.user_foto_url }))
}
```

- [ ] **Step 2: Rewrite ClientMap component**

Replace the entire `ClientMap` export function with:

```jsx
import { useState, useEffect, useCallback, useRef } from 'react'
import { GoogleMap } from '@react-google-maps/api'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useGoogleMaps } from '../hooks/useGoogleMaps'
import { Header } from '../components/Header'
import { Button } from '../components/Button'
import { MapSkeleton } from '../components/MapSkeleton'
import { ProviderCardSkeleton } from '../components/ProviderCardSkeleton'
import { ProviderMarker } from '../components/ProviderMarker'
import { ProviderInfoWindow } from '../components/ProviderInfoWindow'
import { LocationGate } from '../components/LocationGate'
import { X, Send, MapPin } from 'lucide-react'

// ... keep MAP_OPTIONS, MAP_CONTAINER_STYLE, inputClass, SolicitacaoModal unchanged ...

async function fetchNearbyProviders(lat, lng, radiusKm = 10) {
  const { data } = await supabase.rpc('get_nearby_providers', {
    lat, lng, radius_km: radiusKm,
  })
  return (data || []).map(p => ({ ...p, foto_url: p.user_foto_url }))
}

function MapContent({ userLocation }) {
  const { profile } = useAuth()
  const { isLoaded, loadError } = useGoogleMaps()
  const mapRef = useRef(null)
  const debounceRef = useRef(null)
  const [providers, setProviders] = useState([])
  const [loadingProviders, setLoadingProviders] = useState(true)
  const [selected, setSelected] = useState(null)
  const [infoOpen, setInfoOpen] = useState(null)
  const [soliciting, setSoliciting] = useState(null)
  const [sent, setSent] = useState(false)
  const [radius, setRadius] = useState(10)

  const loadProviders = useCallback(async (lat, lng, r) => {
    setLoadingProviders(true)
    try {
      const data = await fetchNearbyProviders(lat, lng, r)
      setProviders(data)
    } catch {
      setProviders([])
    } finally {
      setLoadingProviders(false)
    }
  }, [])

  useEffect(() => {
    loadProviders(userLocation.lat, userLocation.lng, radius)

    const channel = supabase.channel('map-providers')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'prestadores' }, () => {
        fetchNearbyProviders(userLocation.lat, userLocation.lng, radius).then(data => {
          setProviders(data)
          setInfoOpen(prev => prev && data.find(p => p.user_id === prev.user_id) ? prev : null)
          setSelected(prev => prev && data.find(p => p.user_id === prev.user_id) ? prev : null)
        })
      })
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [userLocation, loadProviders])

  useEffect(() => {
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      loadProviders(userLocation.lat, userLocation.lng, radius)
    }, 500)
    return () => clearTimeout(debounceRef.current)
  }, [radius, userLocation, loadProviders])

  const onMapLoad = useCallback((map) => {
    mapRef.current = map
    map.setCenter(userLocation)
    map.setZoom(13)
  }, [userLocation])

  useEffect(() => {
    if (!mapRef.current || !isLoaded || providers.length === 0) return
    if (providers.length === 1) {
      mapRef.current.setCenter({ lat: providers[0].latitude, lng: providers[0].longitude })
      mapRef.current.setZoom(14)
      return
    }
    const bounds = new window.google.maps.LatLngBounds()
    providers.forEach(p => bounds.extend({ lat: p.latitude, lng: p.longitude }))
    mapRef.current.fitBounds(bounds, 80)
  }, [providers, isLoaded])

  function handleSent() {
    setSoliciting(null)
    setSent(true)
    setTimeout(() => setSent(false), 4000)
  }

  function handleMarkerClick(provider) {
    setSelected(provider)
    setInfoOpen(provider)
  }

  return (
    <div className="flex-1 flex flex-col md:flex-row gap-4 max-w-7xl mx-auto w-full px-4 py-6" style={{ minHeight: 'calc(100vh - 76px)' }}>
      {/* Map */}
      <div className="flex-1 rounded-xl overflow-hidden border border-ink-900/10 dark:border-white/10" style={{ minHeight: '400px' }}>
        {!isLoaded || loadingProviders ? (
          <MapSkeleton/>
        ) : loadError ? (
          <div className="h-full grid place-items-center text-red-500 text-sm">
            Erro ao carregar o mapa. Verifique a API key.
          </div>
        ) : (
          <GoogleMap
            mapContainerStyle={MAP_CONTAINER_STYLE}
            center={userLocation}
            zoom={13}
            options={MAP_OPTIONS}
            onLoad={onMapLoad}
            onClick={() => setInfoOpen(null)}
          >
            {providers.map(p => (
              <ProviderMarker
                key={p.user_id}
                provider={p}
                onClick={handleMarkerClick}
                isSelected={selected?.user_id === p.user_id}
              />
            ))}
            {infoOpen && (
              <ProviderInfoWindow
                provider={infoOpen}
                onClose={() => setInfoOpen(null)}
                onSolicitar={p => { setInfoOpen(null); setSoliciting(p) }}
              />
            )}
          </GoogleMap>
        )}
      </div>

      {/* Sidebar */}
      <div className="w-full md:w-80 flex flex-col gap-3">
        <div className="bg-white dark:bg-[#11222A] rounded-xl border border-ink-900/10 dark:border-white/10 p-4">
          <h2 className="font-extrabold text-ink-900 dark:text-white tracking-tight mb-1" style={{ letterSpacing: '-0.025em' }}>
            {loadingProviders ? '...' : `${providers.length} prestador${providers.length !== 1 ? 'es' : ''} próximos`}
          </h2>
          <p className="text-xs text-ink-500 dark:text-ink-600 mb-3">Clique no pin ou no card para ver o perfil</p>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={1}
              max={50}
              value={radius}
              onChange={e => setRadius(Number(e.target.value))}
              className="flex-1 accent-teal-400 h-1.5"
            />
            <span className="text-xs font-bold text-ink-700 dark:text-ink-300 w-14 text-right">{radius} km</span>
          </div>
        </div>

        {selected && (
          <div className="bg-white dark:bg-[#11222A] rounded-xl border-2 border-teal-400 p-5 shadow-md">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-bold text-ink-900 dark:text-white">{selected.nome}</h3>
                <p className="text-xs text-ink-600 dark:text-ink-400 mt-0.5">{selected.categoria}</p>
              </div>
              <button onClick={() => { setSelected(null); setInfoOpen(null) }} className="text-ink-400 hover:text-ink-700 dark:hover:text-ink-300">
                <X size={16}/>
              </button>
            </div>
            {selected.descricao && (
              <p className="text-sm text-ink-600 dark:text-ink-400 mb-4 leading-relaxed">{selected.descricao}</p>
            )}
            {selected.preco_medio && (
              <p className="text-sm font-semibold text-ink-900 dark:text-white mb-4">
                A partir de <span className="text-teal-600 dark:text-teal-400">R$ {Number(selected.preco_medio).toFixed(2)}</span>
              </p>
            )}
            {selected.avaliacao && (
              <p className="text-sm font-semibold text-amber-500 mb-4">★ {Number(selected.avaliacao).toFixed(1)}</p>
            )}
            <Button className="w-full" onClick={() => setSoliciting(selected)}>
              <Send size={14}/> Solicitar serviço
            </Button>
          </div>
        )}

        <div className="flex flex-col gap-2 overflow-y-auto" style={{ maxHeight: '60vh' }}>
          {loadingProviders ? (
            <ProviderCardSkeleton/>
          ) : providers.length === 0 ? (
            <div className="text-center py-12 text-ink-500 dark:text-ink-600">
              <MapPin size={32} className="mx-auto mb-3 text-ink-300 dark:text-ink-700"/>
              <p className="text-sm font-medium">Nenhum prestador disponível em {radius}km agora</p>
              <p className="text-xs mt-1">Aumente o raio ou aguarde prestadores ficarem online</p>
            </div>
          ) : (
            providers.map(p => (
              <button key={p.user_id}
                onClick={() => {
                  setSelected(p)
                  setInfoOpen(p)
                  if (mapRef.current) mapRef.current.panTo({ lat: p.latitude, lng: p.longitude })
                }}
                className={`text-left bg-white dark:bg-[#11222A] rounded-xl border p-4 transition-all hover:-translate-y-0.5 hover:shadow-md ${
                  selected?.user_id === p.user_id ? 'border-teal-400' : 'border-ink-900/10 dark:border-white/10'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-teal-100 dark:bg-teal-400/15 grid place-items-center text-teal-700 dark:text-teal-300 font-bold text-sm flex-shrink-0">
                    {p.foto_url
                      ? <img src={p.foto_url} alt={p.nome} className="w-full h-full rounded-full object-cover"/>
                      : p.nome?.[0]?.toUpperCase() || '?'
                    }
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-ink-900 dark:text-white text-sm truncate">{p.nome}</p>
                    <p className="text-xs text-ink-500 dark:text-ink-600 truncate">{p.categoria}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    {p.preco_medio && (
                      <p className="text-xs font-bold text-teal-600 dark:text-teal-400">
                        R$ {Number(p.preco_medio).toFixed(0)}
                      </p>
                    )}
                    {p.avaliacao && (
                      <p className="text-xs text-amber-500">★ {Number(p.avaliacao).toFixed(1)}</p>
                    )}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {sent && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-ink-900 dark:bg-white text-white dark:text-ink-900 px-6 py-3 rounded-full text-sm font-semibold shadow-xl z-50 flex items-center gap-2 whitespace-nowrap">
          <span className="w-5 h-5 rounded-full bg-teal-400 grid place-items-center text-ink-900 text-xs">✓</span>
          Proposta enviada! O prestador irá responder em breve.
        </div>
      )}

      {soliciting && (
        <SolicitacaoModal
          provider={soliciting}
          clientId={profile?.id}
          onClose={() => setSoliciting(null)}
          onSent={handleSent}
        />
      )}
    </div>
  )
}

export function ClientMap() {
  return (
    <div className="min-h-screen bg-[#FAF8F3] dark:bg-[#08141A] flex flex-col">
      <Header/>
      <LocationGate>
        {(coords) => <MapContent userLocation={coords}/>}
      </LocationGate>
    </div>
  )
}
```

> **Important:** Keep `MAP_OPTIONS`, `MAP_CONTAINER_STYLE`, `inputClass`, and `SolicitacaoModal` exactly as they are — only replace `fetchOnlineProviders` and the `ClientMap` function.

- [ ] **Step 3: Verify**

Run `npm run dev`. Log in as a cliente. Expected flow:
1. `/mapa` shows the spinning `MapPin` animation while requesting GPS
2. If GPS denied: shows the "Localização necessária" UI with "Tentar novamente" button
3. If GPS granted: map renders centered on user's actual location (not SP)
4. Radius slider at 10km loads only nearby providers
5. Dragging slider to 50km re-fetches after 500ms and updates the count

- [ ] **Step 4: Commit**

```bash
git add src/pages/ClientMap.jsx
git commit -m "feat: geolocation gate, radius slider, PostGIS RPC in ClientMap"
```
