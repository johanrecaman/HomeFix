# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # Start dev server (Vite)
npm run build      # Production build
npm run lint       # ESLint
```

No test suite — verify changes with `npm run build`.

## Environment Variables

```
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
VITE_GOOGLE_MAPS_API_KEY
```

## Architecture

**Stack:** React 19 + Vite + Tailwind CSS 3 + Supabase v2 + @react-google-maps/api + React Router 7 + lucide-react

**Font:** Plus Jakarta Sans (loaded via Google Fonts in `index.css`)

**Theming:** CSS variables defined in `src/index.css` — use `var(--teal-400)`, `var(--bg)`, `var(--text-900)` etc. Dark mode via `.dark` class on `<html>`. Tailwind classes like `dark:bg-[#08141A]` are also used inline.

### User Roles

Three distinct roles, all stored in `users.tipo` — routing enforced by `PrivateRoute` and `AdminRoute` in `App.jsx`:

| Role | `users.tipo` | Landing route |
|------|-------------|---------------|
| Admin | `'admin'` | `/admin` |
| Provider | `'prestador'` | `/dashboard` |
| Client | `'cliente'` | `/mapa` |

- `is_admin` column has been **removed** from `users` — admin identity is `tipo = 'admin'`
- `PrivateRoute` blocks admins (redirects to `/admin`) before checking `tipo`
- `AdminRoute` only allows `tipo = 'admin'`
- `LandingPage` auto-redirects logged-in users based on role
- Admin accounts are created directly in the DB — no signup flow

### Auth Flow

`useAuth` (`src/hooks/useAuth.js`) subscribes to Supabase auth state changes and fetches `users.*` on login. Returns `{ user, profile, loading, signOut, refetchProfile }`. `profile` includes `tipo`, `nome`, `email`, `foto_url`.

### Map (ClientMap)

`/mapa` uses two tabs rendered inside `MapContent` (receives `userLocation` from `LocationGate`):
- **Mapa tab** — fullscreen `GoogleMap`, floating radius pill (top-right), full-width amber "Chamada Rápida" button (bottom) → opens `QuickCallPanel` bottom sheet
- **Busca tab** — `BuscaTab` component: provider list with collapsible filters (categoria, distância, valor/hora, ordenar)

Both tabs share `SolicitacaoModal` for scheduling. Provider fetch uses RPC `get_nearby_providers(lat, lng, radius_km)` — PostGIS `ST_DWithin` (defined in `supabase/migrations/002_radius_rpc.sql`). Never fetch `prestadores` directly from client map.

`LocationGate` (`src/components/LocationGate.jsx`) blocks rendering until GPS permission is granted, showing loading/denied UIs. Uses `useGeolocation` hook which exposes `{ state, coords, request }` — states: `idle → requesting → granted | denied | unsupported`.

`useGoogleMaps` (`src/hooks/useGoogleMaps.js`) wraps `useJsApiLoader` — import it in any component that needs the Maps API rather than calling `useJsApiLoader` directly.

**GPS in ProviderDashboard:** Uses a local `getGPSCoords()` promise helper (not the `useGeolocation` hook) because GPS is needed mid-async-flow when going online.

### Supabase / Database

All migrations live in `supabase/migrations/` and must be run manually in the Supabase SQL Editor — there is no CLI migration runner configured.

Key tables:
- `users` — `id, nome, email, foto_url, tipo ('cliente'|'prestador'|'admin')`
- `prestadores` — `user_id (FK→users), status ('online'|'offline'|'alerta'), approval_status ('active'|'banned'), avaliacao, categoria, latitude, longitude, last_location (geography), preco_medio, hourly_rate, descricao, foto_url, is_online (bool)`
- `solicitacoes` — `id, cliente_id, prestador_id, descricao, data_desejada, valor_oferecido, estimated_duration (int, minutes), total_price, type ('scheduled'|'quick_call'), status ('pendente'|'aceita'|'recusada'|'cancelada'), created_at`
- `quick_calls` — `id, cliente_id, descricao, categoria, latitude, longitude, radius_km, status ('open'|'locked'|'cancelled'), locked_by, created_at`
- `quick_call_offers` — `id, quick_call_id, prestador_id, estimated_duration, total_price, status ('pending'|'accepted'|'rejected'), created_at`

RLS is enabled. `public.is_admin()` helper has been replaced — admin check uses `users.tipo = 'admin'` directly in policies.

`prestadores.approval_status` is separate from `prestadores.status`. `status` is real-time presence (online/offline). `approval_status` is the admin ban flag.

### Realtime

Supabase realtime channels are used in `ClientMap` (provider updates) and `ProviderDashboard` (new proposals). Pattern: subscribe in `useEffect`, return cleanup via `supabase.removeChannel(channel)`.

## Completed Work (branch: feat/homefix-v3-realtime-quickcall)

Migration `004_homefix_v3.sql` adds: `is_online`, `hourly_rate`, `last_location` on `prestadores`; `estimated_duration`, `total_price`, `type` on `solicitacoes`; `quick_calls` + `quick_call_offers` tables; updated PostGIS RPCs with filter params; `accept_quick_call_offer` atomic RPC.

New components: `AgendaCalendar`, `FlashAlert`, `QuickCallPanel`, `BuscaTab`. New hook: `useLocationSync`. New util: `src/lib/geo.js`.

Migration `005_admin_tipo.sql`: `is_admin` removed from `users`, `tipo='admin'` is now the admin identifier. `solicitacoes.status` now accepts `'cancelada'`. Frontend (`App.jsx`, `Header.jsx`, `LandingPage.jsx`) updated — no `is_admin` references remain.

**⚠️ Pending DB apply:** `supabase/migrations/004_homefix_v3.sql` and `supabase/migrations/005_admin_tipo.sql` must be run in Supabase SQL Editor.

Plan 2 complete: `AgendaCalendar` rebuilt as day-list with booking cards, status badges (amber/green), inline cancel + optimistic removal. `ClientDashboard` has cancel buttons on Propostas (pendente) and Histórico (aceita, extra confirm), plus gray `cancelada` badge. `ClientMap` restructured into Mapa tab (fullscreen map + floating radius pill + amber "Chamada Rápida" bottom sheet via `QuickCallPanel`) and Busca tab (`BuscaTab` with collapsible filters).

### Map (ClientMap) — updated

`/mapa` uses two tabs: **Mapa** (fullscreen `GoogleMap` + floating radius pill top-right + full-width amber Chamada Rápida button at bottom → opens `QuickCallPanel` bottom sheet with Uber-like status feed) and **Busca** (`BuscaTab` component — provider list with collapsible filters: categoria, distância, valor/hora, ordenar). Both tabs share `SolicitacaoModal` for scheduling.

## Pending Work

No pending frontend work. Both migrations still require manual application in Supabase SQL Editor.
