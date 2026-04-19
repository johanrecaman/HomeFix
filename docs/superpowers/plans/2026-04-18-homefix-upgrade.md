# HomeFix MVP Upgrade — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrar o mapa para Google Maps, adicionar sistema de ban de prestadores com Admin Dashboard, e polir a UX com skeletons e realtime.

**Architecture:** Quatro camadas independentes executadas em ordem: (1) DB migration + RLS, (2) Google Maps com markers customizados e FitBounds, (3) Admin Dashboard com ban/unban, (4) UX polish com skeletons e empty states. Cada camada faz commit próprio e é verificável isoladamente.

**Tech Stack:** React 19, Vite, Tailwind CSS 3, Supabase JS v2, `@react-google-maps/api`, React Router 7, lucide-react.

---

## File Map

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `supabase/migrations/001_upgrade.sql` | CRIAR | SQL da migração (colunas + RLS) |
| `.env.example` | MODIFICAR | Adicionar `VITE_GOOGLE_MAPS_API_KEY` |
| `src/hooks/useGoogleMaps.js` | CRIAR | Wrapper de `useJsApiLoader`, expõe `{ isLoaded, loadError }` |
| `src/components/MapSkeleton.jsx` | CRIAR | Skeleton animate-pulse para o mapa |
| `src/components/ProviderCardSkeleton.jsx` | CRIAR | Skeleton para cards da sidebar |
| `src/components/ProviderMarker.jsx` | CRIAR | `<MarkerF>` com ícone customizado (foto ou PIN teal) |
| `src/components/ProviderInfoWindow.jsx` | CRIAR | `<InfoWindowF>` com nome, avaliação, botão solicitar |
| `src/pages/ClientMap.jsx` | MODIFICAR | Substituir Leaflet por Google Maps, FitBounds, realtime ban |
| `src/components/ProviderAdminCard.jsx` | CRIAR | Card de prestador no admin com ações ban/unban |
| `src/components/AdminTableSkeleton.jsx` | CRIAR | Skeleton para lista do admin |
| `src/pages/AdminDashboard.jsx` | CRIAR | Dashboard do admin com filtros e lista |
| `src/App.jsx` | MODIFICAR | Adicionar rota `/admin` protegida por `is_admin` |

---

## Task 1: SQL Migration

**Files:**
- Create: `supabase/migrations/001_upgrade.sql`

- [ ] **Step 1: Criar o arquivo de migração**

Crie `supabase/migrations/001_upgrade.sql` com o conteúdo abaixo:

```sql
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
```

- [ ] **Step 2: Executar no Supabase Dashboard**

1. Abra o Supabase Dashboard → SQL Editor
2. Cole o conteúdo do arquivo e execute
3. Verifique que não há erros
4. Em Table Editor → `users`, confirme que a coluna `is_admin` existe e `johanstrr@gmail.com` tem `is_admin = true`
5. Em Table Editor → `prestadores`, confirme colunas `approval_status` e `avaliacao`

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/001_upgrade.sql
git commit -m "feat: db migration — is_admin, approval_status, avaliacao, RLS update"
```

---

## Task 2: Instalar @react-google-maps/api e configurar .env

**Files:**
- Modify: `.env.example` (se existir) ou criar `.env.local`

- [ ] **Step 1: Instalar a biblioteca**

```bash
npm install @react-google-maps/api
```

Esperado: biblioteca adicionada em `package.json` e `node_modules`.

- [ ] **Step 2: Configurar variável de ambiente**

Crie (ou edite) `.env.local` na raiz do projeto:

```
VITE_GOOGLE_MAPS_API_KEY=sua_api_key_aqui
```

Verifique que `.env.local` está no `.gitignore` (já deve estar por padrão do Vite).

Se existir `.env.example`, adicione a linha:
```
VITE_GOOGLE_MAPS_API_KEY=
```

- [ ] **Step 3: Verificar**

```bash
npm run dev
```

Esperado: projeto abre sem erros de compilação.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json .env.example
git commit -m "feat: install @react-google-maps/api, add env var for Maps API key"
```

---

## Task 3: Hook useGoogleMaps

**Files:**
- Create: `src/hooks/useGoogleMaps.js`

- [ ] **Step 1: Criar o hook**

Crie `src/hooks/useGoogleMaps.js`:

```js
import { useJsApiLoader } from '@react-google-maps/api'

const LIBRARIES = ['places']

export function useGoogleMaps() {
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
    libraries: LIBRARIES,
  })
  return { isLoaded, loadError }
}
```

> `LIBRARIES` é definido fora do componente para evitar re-renders desnecessários (o `useJsApiLoader` compara por referência).

- [ ] **Step 2: Verificar no browser**

Em `src/pages/ClientMap.jsx`, adicione temporariamente no topo do componente:

```js
import { useGoogleMaps } from '../hooks/useGoogleMaps'
// dentro do componente:
const { isLoaded, loadError } = useGoogleMaps()
console.log('Maps loaded:', isLoaded, loadError)
```

Abra o browser, verifique no console que `Maps loaded: true undefined` aparece após alguns segundos. Remova o `console.log` depois.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useGoogleMaps.js
git commit -m "feat: useGoogleMaps hook wrapping useJsApiLoader"
```

---

## Task 4: Skeleton Components

**Files:**
- Create: `src/components/MapSkeleton.jsx`
- Create: `src/components/ProviderCardSkeleton.jsx`

- [ ] **Step 1: Criar MapSkeleton**

Crie `src/components/MapSkeleton.jsx`:

```jsx
export function MapSkeleton() {
  return (
    <div
      className="flex-1 rounded-xl overflow-hidden border border-ink-900/10 dark:border-white/10 animate-pulse bg-ink-900/5 dark:bg-white/5"
      style={{ minHeight: '400px' }}
    >
      <div className="h-full w-full bg-gradient-to-br from-ink-900/5 to-teal-400/5 dark:from-white/5 dark:to-teal-400/10" />
    </div>
  )
}
```

- [ ] **Step 2: Criar ProviderCardSkeleton**

Crie `src/components/ProviderCardSkeleton.jsx`:

```jsx
function SingleCardSkeleton() {
  return (
    <div className="bg-white dark:bg-[#11222A] rounded-xl border border-ink-900/10 dark:border-white/10 p-4 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-ink-900/10 dark:bg-white/10 flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-3 bg-ink-900/10 dark:bg-white/10 rounded w-3/4" />
          <div className="h-3 bg-ink-900/10 dark:bg-white/10 rounded w-1/2" />
        </div>
      </div>
    </div>
  )
}

export function ProviderCardSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      <SingleCardSkeleton />
      <SingleCardSkeleton />
      <SingleCardSkeleton />
    </div>
  )
}
```

- [ ] **Step 3: Verificar visualmente**

Em `ClientMap.jsx`, substitua temporariamente o map container por `<MapSkeleton />` e a lista de providers por `<ProviderCardSkeleton />` para ver o resultado visual. Reverta depois.

- [ ] **Step 4: Commit**

```bash
git add src/components/MapSkeleton.jsx src/components/ProviderCardSkeleton.jsx
git commit -m "feat: MapSkeleton and ProviderCardSkeleton components"
```

---

## Task 5: ProviderMarker

**Files:**
- Create: `src/components/ProviderMarker.jsx`

- [ ] **Step 1: Criar o componente**

Crie `src/components/ProviderMarker.jsx`:

```jsx
import { MarkerF } from '@react-google-maps/api'

function buildIcon(fotoUrl, nome) {
  if (fotoUrl) {
    return {
      url: fotoUrl,
      scaledSize: new window.google.maps.Size(44, 44),
      anchor: new window.google.maps.Point(22, 22),
    }
  }

  const inicial = (nome?.[0] || '?').toUpperCase()
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="44" height="44">
      <circle cx="22" cy="22" r="20" fill="#20D4B8" stroke="white" stroke-width="3"/>
      <text x="22" y="27" text-anchor="middle" font-size="16" font-weight="bold"
        font-family="Plus Jakarta Sans,sans-serif" fill="#08141A">${inicial}</text>
    </svg>
  `
  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: new window.google.maps.Size(44, 44),
    anchor: new window.google.maps.Point(22, 22),
  }
}

export function ProviderMarker({ provider, onClick, isSelected }) {
  return (
    <MarkerF
      key={provider.user_id}
      position={{ lat: provider.latitude, lng: provider.longitude }}
      icon={buildIcon(provider.foto_url, provider.nome)}
      onClick={() => onClick(provider)}
      zIndex={isSelected ? 10 : 1}
    />
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ProviderMarker.jsx
git commit -m "feat: ProviderMarker with custom icon (photo or teal initial PIN)"
```

---

## Task 6: ProviderInfoWindow

**Files:**
- Create: `src/components/ProviderInfoWindow.jsx`

- [ ] **Step 1: Criar o componente**

Crie `src/components/ProviderInfoWindow.jsx`:

```jsx
import { InfoWindowF } from '@react-google-maps/api'
import { Send } from 'lucide-react'
import { Button } from './Button'

function StarRating({ avaliacao }) {
  if (!avaliacao) return <span className="text-xs text-ink-500">Sem avaliação</span>
  return (
    <span className="text-xs font-semibold text-amber-500">
      ★ {Number(avaliacao).toFixed(1)}
    </span>
  )
}

export function ProviderInfoWindow({ provider, onClose, onSolicitar }) {
  return (
    <InfoWindowF
      position={{ lat: provider.latitude, lng: provider.longitude }}
      onCloseClick={onClose}
      options={{ pixelOffset: new window.google.maps.Size(0, -22) }}
    >
      <div style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', minWidth: '180px', padding: '4px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
          {provider.foto_url ? (
            <img
              src={provider.foto_url}
              alt={provider.nome}
              style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover' }}
            />
          ) : (
            <div style={{
              width: 36, height: 36, borderRadius: '50%',
              background: '#20D4B8', display: 'grid', placeItems: 'center',
              fontWeight: 700, color: '#08141A', fontSize: 14,
            }}>
              {provider.nome?.[0]?.toUpperCase() || '?'}
            </div>
          )}
          <div>
            <p style={{ fontWeight: 700, margin: 0, fontSize: 14 }}>{provider.nome}</p>
            <p style={{ fontSize: 12, color: '#6E8984', margin: 0 }}>{provider.categoria}</p>
          </div>
        </div>
        <StarRating avaliacao={provider.avaliacao} />
        <button
          onClick={() => onSolicitar(provider)}
          style={{
            marginTop: 8, width: '100%', background: '#20D4B8', border: 'none',
            borderRadius: 8, padding: '6px 12px', fontWeight: 700, fontSize: 13,
            cursor: 'pointer', color: '#08141A', display: 'flex',
            alignItems: 'center', justifyContent: 'center', gap: 6,
          }}
        >
          <span>Solicitar serviço</span>
        </button>
      </div>
    </InfoWindowF>
  )
}
```

> A InfoWindow usa estilos inline porque o conteúdo é renderizado dentro do iframe do Google Maps, fora do escopo do Tailwind.

- [ ] **Step 2: Commit**

```bash
git add src/components/ProviderInfoWindow.jsx
git commit -m "feat: ProviderInfoWindow with rating, avatar, and solicitar button"
```

---

## Task 7: Refatorar ClientMap para Google Maps

**Files:**
- Modify: `src/pages/ClientMap.jsx`

Este é o maior task. Substitui todo o código Leaflet por Google Maps, conecta os novos componentes, adiciona FitBounds, skeletons, e atualiza o `fetchOnlineProviders` para filtrar `approval_status = 'active'` (o que também implementa o realtime ban — quando o admin bane, a re-fetch filtra o prestador).

- [ ] **Step 1: Substituir o conteúdo de ClientMap.jsx**

Substitua **todo** o conteúdo de `src/pages/ClientMap.jsx`:

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
import { X, Send, MapPin } from 'lucide-react'

const MAP_OPTIONS = {
  disableDefaultUI: false,
  zoomControl: true,
  streetViewControl: false,
  mapTypeControl: false,
  fullscreenControl: false,
  styles: [
    { elementType: 'geometry', stylers: [{ color: '#f5f5f5' }] },
    { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
    { elementType: 'labels.text.fill', stylers: [{ color: '#616161' }] },
    { elementType: 'labels.text.stroke', stylers: [{ color: '#f5f5f5' }] },
    { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
    { featureType: 'road.arterial', elementType: 'labels.text.fill', stylers: [{ color: '#757575' }] },
    { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#dadada' }] },
    { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#c9c9c9' }] },
    { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#9e9e9e' }] },
    { featureType: 'poi', stylers: [{ visibility: 'off' }] },
    { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  ],
}

const MAP_CONTAINER_STYLE = { height: '100%', width: '100%', minHeight: '400px' }

const inputClass = "w-full px-4 py-3 rounded-lg border border-ink-900/15 dark:border-white/15 bg-transparent text-ink-900 dark:text-white placeholder-ink-500 focus:outline-none focus:ring-2 focus:ring-teal-400 text-sm"

function SolicitacaoModal({ provider, clientId, onClose, onSent }) {
  const [form, setForm] = useState({ descricao: '', data_desejada: '', valor_oferecido: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error: err } = await supabase.from('solicitacoes').insert({
      cliente_id: clientId,
      prestador_id: provider.user_id,
      descricao: form.descricao,
      data_desejada: form.data_desejada,
      valor_oferecido: parseFloat(form.valor_oferecido) || null,
      status: 'pendente',
    })
    setLoading(false)
    if (err) { setError(err.message); return }
    onSent()
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-[9999] flex items-end md:items-center justify-center p-4">
      <div className="bg-white dark:bg-[#11222A] rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between p-6 border-b border-ink-900/10 dark:border-white/10">
          <div>
            <h2 className="text-lg font-extrabold text-ink-900 dark:text-white" style={{ letterSpacing: '-0.025em' }}>
              Enviar proposta
            </h2>
            <p className="text-sm text-ink-600 dark:text-ink-400">{provider.nome} · {provider.categoria}</p>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-full hover:bg-ink-900/5 dark:hover:bg-white/10 grid place-items-center text-ink-600 dark:text-ink-400">
            <X size={18}/>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-bold text-ink-700 dark:text-ink-400 uppercase tracking-widest mb-2">Descrição do serviço</label>
            <textarea required value={form.descricao} onChange={set('descricao')} className={inputClass} rows={3} placeholder="Descreva o que precisa..."/>
          </div>
          <div>
            <label className="block text-xs font-bold text-ink-700 dark:text-ink-400 uppercase tracking-widest mb-2">Data e horário desejados</label>
            <input type="datetime-local" required value={form.data_desejada} onChange={set('data_desejada')} className={inputClass}/>
          </div>
          <div>
            <label className="block text-xs font-bold text-ink-700 dark:text-ink-400 uppercase tracking-widest mb-2">Valor oferecido (R$) — opcional</label>
            <input type="number" value={form.valor_oferecido} onChange={set('valor_oferecido')} className={inputClass} placeholder="150"/>
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <Button type="submit" className="w-full" size="lg" loading={loading}>
            <Send size={16}/> Enviar proposta
          </Button>
        </form>
      </div>
    </div>
  )
}

async function fetchOnlineProviders() {
  const { data } = await supabase
    .from('prestadores')
    .select('*, users(nome, foto_url, telefone)')
    .eq('status', 'online')
    .eq('approval_status', 'active')
    .not('latitude', 'is', null)
  return (data || []).map(p => ({
    ...p,
    nome: p.users?.nome,
    foto_url: p.users?.foto_url,
  }))
}

export function ClientMap() {
  const { profile } = useAuth()
  const { isLoaded, loadError } = useGoogleMaps()
  const mapRef = useRef(null)
  const [providers, setProviders] = useState([])
  const [loadingProviders, setLoadingProviders] = useState(true)
  const [selected, setSelected] = useState(null)
  const [infoOpen, setInfoOpen] = useState(null)
  const [soliciting, setSoliciting] = useState(null)
  const [sent, setSent] = useState(false)
  const [center] = useState({ lat: -23.55, lng: -46.63 })

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(pos => {
        if (mapRef.current) {
          mapRef.current.panTo({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        }
      })
    }

    fetchOnlineProviders().then(data => {
      setProviders(data)
      setLoadingProviders(false)
    })

    const channel = supabase.channel('map-providers')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'prestadores' }, () => {
        fetchOnlineProviders().then(data => {
          setProviders(data)
          // limpa selected e infoOpen se o prestador foi banido/ficou offline
          setInfoOpen(prev => prev && data.find(p => p.user_id === prev.user_id) ? prev : null)
          setSelected(prev => prev && data.find(p => p.user_id === prev.user_id) ? prev : null)
        })
      })
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [])

  const onMapLoad = useCallback((map) => {
    mapRef.current = map
  }, [])

  useEffect(() => {
    if (!mapRef.current || providers.length === 0) return
    if (providers.length === 1) {
      mapRef.current.setCenter({ lat: providers[0].latitude, lng: providers[0].longitude })
      mapRef.current.setZoom(14)
      return
    }
    const bounds = new window.google.maps.LatLngBounds()
    providers.forEach(p => bounds.extend({ lat: p.latitude, lng: p.longitude }))
    mapRef.current.fitBounds(bounds, 80)
  }, [providers])

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
    <div className="min-h-screen bg-[#FAF8F3] dark:bg-[#08141A] flex flex-col">
      <Header/>
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
              center={center}
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
              {loadingProviders ? '...' : `${providers.length} prestador${providers.length !== 1 ? 'es' : ''} online`}
            </h2>
            <p className="text-xs text-ink-500 dark:text-ink-600">Clique no pin ou no card para ver o perfil</p>
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
                <p className="text-sm font-medium">Nenhum prestador disponível na sua região agora</p>
                <p className="text-xs mt-1">Novos prestadores aparecem assim que ficam online</p>
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
```

- [ ] **Step 2: Remover dependências Leaflet do projeto (opcional)**

Se quiser remover Leaflet para limpar o bundle:

```bash
npm uninstall leaflet react-leaflet
```

Verifique que não há outros arquivos importando `leaflet` ou `react-leaflet`:

```bash
grep -r "react-leaflet\|from 'leaflet'" src/
```

Esperado: nenhum resultado.

- [ ] **Step 3: Verificar no browser**

```bash
npm run dev
```

- Acesse `/mapa` como cliente
- O mapa Google Maps deve aparecer no estilo Silver
- Markers devem aparecer nos locais dos prestadores online
- Clicar em um marker deve abrir a InfoWindow com nome, avaliação e botão
- Clicar no botão abre o SolicitacaoModal
- Sidebar deve mostrar cards com avaliação (se houver)
- Com 0 prestadores online: empty state com mensagem amigável
- Durante carregamento: skeleton screens visíveis

- [ ] **Step 4: Commit**

```bash
git add src/pages/ClientMap.jsx
git commit -m "feat: migrate ClientMap from Leaflet to Google Maps with FitBounds, InfoWindow, skeletons, realtime ban"
```

---

## Task 8: Rota /admin e proteção por is_admin

**Files:**
- Modify: `src/App.jsx`

> **Atenção:** Execute este task apenas após o Task 11 (AdminDashboard), pois `App.jsx` importa `AdminDashboard`. Se quiser executar agora, crie um stub temporário: `src/pages/AdminDashboard.jsx` com `export function AdminDashboard() { return null }` e substitua no Task 11.

- [ ] **Step 1: Adicionar AdminRoute e rota /admin em App.jsx**

Substitua o conteúdo de `src/App.jsx`:

```jsx
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import { LandingPage } from './pages/LandingPage'
import { Entry } from './pages/Entry'
import { Login } from './pages/Login'
import { RegisterClient } from './pages/RegisterClient'
import { RegisterProvider } from './pages/RegisterProvider'
import { ClientMap } from './pages/ClientMap'
import { ProviderDashboard } from './pages/ProviderDashboard'
import { AdminDashboard } from './pages/AdminDashboard'
import { NotFound } from './pages/NotFound'

function PrivateRoute({ children, requiredType }) {
  const { profile, loading } = useAuth()
  if (loading) return (
    <div className="h-screen grid place-items-center" style={{ background: 'var(--bg)' }}>
      <span className="w-8 h-8 border-4 border-teal-400 border-t-transparent rounded-full animate-spin"/>
    </div>
  )
  if (!profile) return <Navigate to="/login" replace/>
  if (requiredType && profile.tipo !== requiredType) return <Navigate to="/" replace/>
  return children
}

function AdminRoute({ children }) {
  const { profile, loading } = useAuth()
  if (loading) return (
    <div className="h-screen grid place-items-center" style={{ background: 'var(--bg)' }}>
      <span className="w-8 h-8 border-4 border-teal-400 border-t-transparent rounded-full animate-spin"/>
    </div>
  )
  if (!profile) return <Navigate to="/login" replace/>
  if (!profile.is_admin) return <Navigate to="/" replace/>
  return children
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage/>}/>
      <Route path="/entrar" element={<Entry/>}/>
      <Route path="/login" element={<Login/>}/>
      <Route path="/cadastro/cliente" element={<RegisterClient/>}/>
      <Route path="/cadastro/prestador" element={<RegisterProvider/>}/>
      <Route path="/mapa" element={<PrivateRoute requiredType="cliente"><ClientMap/></PrivateRoute>}/>
      <Route path="/dashboard" element={<PrivateRoute requiredType="prestador"><ProviderDashboard/></PrivateRoute>}/>
      <Route path="/admin" element={<AdminRoute><AdminDashboard/></AdminRoute>}/>
      <Route path="*" element={<NotFound/>}/>
    </Routes>
  )
}
```

- [ ] **Step 2: Verificar proteção da rota**

```bash
npm run dev
```

- Acesse `/admin` sem estar logado → deve redirecionar para `/login`
- Acesse `/admin` logado como cliente/prestador não-admin → deve redirecionar para `/`
- Acesse `/admin` logado como `johanstrr@gmail.com` (após rodar a migration) → deve renderizar (mesmo que `AdminDashboard` ainda não exista — vai dar erro de import, o que é esperado)

- [ ] **Step 3: Commit**

```bash
git add src/App.jsx
git commit -m "feat: add AdminRoute guard and /admin route"
```

---

## Task 9: ProviderAdminCard

**Files:**
- Create: `src/components/ProviderAdminCard.jsx`

- [ ] **Step 1: Criar o componente**

Crie `src/components/ProviderAdminCard.jsx`:

```jsx
import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { ShieldOff, ShieldCheck } from 'lucide-react'

const STATUS_LABEL = {
  online: { label: 'Online', cls: 'bg-teal-100 text-teal-700 dark:bg-teal-400/15 dark:text-teal-300' },
  offline: { label: 'Offline', cls: 'bg-ink-100 text-ink-500 dark:bg-white/5 dark:text-ink-400' },
  alerta: { label: 'Alerta', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300' },
}

export function ProviderAdminCard({ provider, onUpdate }) {
  const [loading, setLoading] = useState(false)
  const isBanned = provider.approval_status === 'banned'
  const statusInfo = STATUS_LABEL[provider.status] || STATUS_LABEL.offline

  async function toggleBan() {
    setLoading(true)
    const newStatus = isBanned ? 'active' : 'banned'
    const { error } = await supabase
      .from('prestadores')
      .update({ approval_status: newStatus })
      .eq('user_id', provider.user_id)
    setLoading(false)
    if (!error) onUpdate(provider.user_id, newStatus)
  }

  return (
    <div className={`bg-white dark:bg-[#11222A] rounded-xl border p-5 transition-all ${
      isBanned
        ? 'border-red-200 dark:border-red-400/20 opacity-60'
        : 'border-ink-900/10 dark:border-white/10'
    }`}>
      <div className="flex items-center gap-4">
        <div className="w-11 h-11 rounded-full bg-teal-100 dark:bg-teal-400/15 grid place-items-center text-teal-700 dark:text-teal-300 font-bold flex-shrink-0">
          {provider.foto_url
            ? <img src={provider.foto_url} alt={provider.nome} className="w-full h-full rounded-full object-cover"/>
            : provider.nome?.[0]?.toUpperCase() || '?'
          }
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-ink-900 dark:text-white text-sm">{provider.nome}</p>
            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${statusInfo.cls}`}>
              {statusInfo.label}
            </span>
          </div>
          <p className="text-xs text-ink-500 dark:text-ink-600 truncate">{provider.email}</p>
          <p className="text-xs text-ink-500 dark:text-ink-600">{provider.categoria}</p>
        </div>
        <div className="flex-shrink-0 text-right">
          {provider.avaliacao && (
            <p className="text-xs text-amber-500 mb-2">★ {Number(provider.avaliacao).toFixed(1)}</p>
          )}
          <button
            onClick={toggleBan}
            disabled={loading}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors disabled:opacity-50 ${
              isBanned
                ? 'bg-teal-50 dark:bg-teal-400/10 text-teal-700 dark:text-teal-300 hover:bg-teal-100'
                : 'bg-red-50 dark:bg-red-400/10 text-red-600 dark:text-red-400 hover:bg-red-100'
            }`}
          >
            {isBanned
              ? <><ShieldCheck size={13}/> Reativar</>
              : <><ShieldOff size={13}/> Banir</>
            }
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ProviderAdminCard.jsx
git commit -m "feat: ProviderAdminCard with ban/unban action"
```

---

## Task 10: AdminTableSkeleton

**Files:**
- Create: `src/components/AdminTableSkeleton.jsx`

- [ ] **Step 1: Criar o componente**

Crie `src/components/AdminTableSkeleton.jsx`:

```jsx
function SkeletonRow() {
  return (
    <div className="bg-white dark:bg-[#11222A] rounded-xl border border-ink-900/10 dark:border-white/10 p-5 animate-pulse">
      <div className="flex items-center gap-4">
        <div className="w-11 h-11 rounded-full bg-ink-900/10 dark:bg-white/10 flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-3 bg-ink-900/10 dark:bg-white/10 rounded w-1/3" />
          <div className="h-3 bg-ink-900/10 dark:bg-white/10 rounded w-1/2" />
        </div>
        <div className="w-16 h-7 bg-ink-900/10 dark:bg-white/10 rounded-lg flex-shrink-0" />
      </div>
    </div>
  )
}

export function AdminTableSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/AdminTableSkeleton.jsx
git commit -m "feat: AdminTableSkeleton component"
```

---

## Task 11: AdminDashboard

**Files:**
- Create: `src/pages/AdminDashboard.jsx`

- [ ] **Step 1: Criar a página**

Crie `src/pages/AdminDashboard.jsx`:

```jsx
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Header } from '../components/Header'
import { ProviderAdminCard } from '../components/ProviderAdminCard'
import { AdminTableSkeleton } from '../components/AdminTableSkeleton'
import { ShieldCheck } from 'lucide-react'

const FILTERS = [
  { id: 'all', label: 'Todos' },
  { id: 'active', label: 'Ativos' },
  { id: 'banned', label: 'Banidos' },
]

async function fetchAllProviders() {
  const { data } = await supabase
    .from('prestadores')
    .select('*, users(nome, email, foto_url)')
    .order('approval_status', { ascending: true })
  return (data || []).map(p => ({
    ...p,
    nome: p.users?.nome,
    email: p.users?.email,
    foto_url: p.users?.foto_url,
  }))
}

export function AdminDashboard() {
  const [providers, setProviders] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    fetchAllProviders().then(data => {
      setProviders(data)
      setLoading(false)
    })
  }, [])

  function handleUpdate(userId, newApprovalStatus) {
    setProviders(ps =>
      ps.map(p => p.user_id === userId ? { ...p, approval_status: newApprovalStatus } : p)
    )
  }

  const filtered = providers.filter(p => {
    if (filter === 'all') return true
    return p.approval_status === filter
  })

  const counts = {
    all: providers.length,
    active: providers.filter(p => p.approval_status === 'active').length,
    banned: providers.filter(p => p.approval_status === 'banned').length,
  }

  return (
    <div className="min-h-screen bg-[#FAF8F3] dark:bg-[#08141A]">
      <Header/>
      <div className="max-w-3xl mx-auto px-6 py-8">

        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-extrabold text-ink-900 dark:text-white tracking-tight" style={{ letterSpacing: '-0.025em' }}>
              Painel Admin
            </h1>
            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-teal-400 text-ink-900">Admin</span>
          </div>
          <p className="text-sm text-ink-500 dark:text-ink-600">Gerencie os prestadores da plataforma</p>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1 bg-ink-900/5 dark:bg-white/5 rounded-xl p-1 mb-6">
          {FILTERS.map(f => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                filter === f.id
                  ? 'bg-white dark:bg-[#11222A] text-ink-900 dark:text-white shadow-sm'
                  : 'text-ink-600 dark:text-ink-400'
              }`}
            >
              {f.label}
              {!loading && (
                <span className="text-xs font-bold opacity-60">({counts[f.id]})</span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <AdminTableSkeleton/>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-ink-500 dark:text-ink-600">
            <ShieldCheck size={40} className="mx-auto mb-4 text-ink-300 dark:text-ink-700"/>
            <p className="font-medium">
              {filter === 'banned' ? 'Nenhum prestador banido' : 'Nenhum prestador encontrado'}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {filtered.map(p => (
              <ProviderAdminCard key={p.user_id} provider={p} onUpdate={handleUpdate}/>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verificar no browser**

```bash
npm run dev
```

- Acesse `/admin` logado como `johanstrr@gmail.com`
- Lista de prestadores deve carregar com skeleton e depois mostrar os cards
- Filtros "Todos | Ativos | Banidos" devem funcionar
- Botão "Banir" em um prestador deve atualizar o card imediatamente (otimistic update via `handleUpdate`)
- Ir para `/mapa` em outra aba — o prestador banido deve desaparecer em segundos (realtime via canal `map-providers`)
- Com filtro "Banidos" sem prestadores banidos: empty state com ícone ShieldCheck

- [ ] **Step 3: Commit**

```bash
git add src/pages/AdminDashboard.jsx
git commit -m "feat: AdminDashboard with filter tabs, ban/unban, skeleton, empty state"
```

---

## Verificação Final

- [ ] **Smoke test completo**

Com `npm run dev` rodando:

1. **Mapa:** Acessar `/mapa` → Google Maps carrega com estilo Silver → markers aparecem → clicar abre InfoWindow → InfoWindow mostra avaliação (se houver) → botão solicitar abre modal
2. **FitBounds:** Com 2+ prestadores online, o zoom deve ajustar para mostrar todos
3. **Skeletons:** Throttle a conexão no DevTools (Network → Slow 3G) → recarregar `/mapa` → skeletons visíveis antes dos dados
4. **Admin:** Acessar `/admin` → lista carrega → banir um prestador → abrir `/mapa` → prestador some em tempo real
5. **Proteção:** Acessar `/admin` como cliente → redireciona para `/`
6. **Empty state:** Com todos os prestadores offline, `/mapa` mostra mensagem amigável

- [ ] **Commit final (se não houver mais mudanças)**

```bash
git log --oneline -10
```

Confirme que todos os commits das tasks estão presentes.
