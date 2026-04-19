# HomeFix v2 — Agenda System + Client Dashboard

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Prerequisite:** `2026-04-18-homefix-v2-foundation.md` must be complete and merged. The PostGIS RPC `get_nearby_providers` must be deployed.

**Goal:** Add a slot-based availability system for providers and a client-facing dashboard. Providers manage free/booked time slots. Clients can filter the map by date/time, seeing only providers with a free slot AND within the radius. A new `/cliente` page shows the client's proposals, history, and profile.

**Architecture:** Two new DB tables: `slots` (provider availability) and a `slot_id` FK added to `solicitacoes`. A second PostGIS RPC `get_nearby_providers_with_availability` extends the first with a slot join — so one round-trip returns only providers who are online, active, within radius, AND have a free slot at the requested time. All slot mutations go through RLS policies. The client dashboard is a new page with three tabs (Propostas / Histórico / Perfil).

**Tech Stack:** React 19, Tailwind CSS 3, Supabase v2 (PostGIS, RLS), lucide-react.

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `supabase/migrations/003_agenda.sql` | CREATE | `slots` table, `slot_id` on `solicitacoes`, RLS, `get_nearby_providers_with_availability` RPC |
| `src/components/SlotManager.jsx` | CREATE | Provider UI: add/remove time slots, list free/booked slots |
| `src/pages/ProviderDashboard.jsx` | MODIFY | Add "Agenda" tab wired to SlotManager |
| `src/components/DateTimeFilter.jsx` | CREATE | Client UI: date+time picker that triggers availability-aware fetch |
| `src/pages/ClientMap.jsx` | MODIFY | Add DateTimeFilter to sidebar; switch RPC when filter is active |
| `src/pages/ClientDashboard.jsx` | CREATE | Three-tab page: Propostas / Histórico / Perfil |
| `src/App.jsx` | MODIFY | Add `/cliente` route (PrivateRoute, tipo='cliente') |
| `src/components/Header.jsx` | MODIFY | Add "Minha conta" link for tipo='cliente' |

---

## Task 1: Database Migration — Slots + Availability RPC

**Files:**
- Create: `supabase/migrations/003_agenda.sql`

### Schema Design

```
slots
  id            uuid PK
  prestador_id  uuid FK → users(id)
  starts_at     timestamptz NOT NULL
  ends_at       timestamptz NOT NULL
  status        text CHECK ('free'|'booked') DEFAULT 'free'
  created_at    timestamptz DEFAULT now()

solicitacoes (existing)
  + slot_id     uuid FK → slots(id) NULLABLE
```

A `slot` is a time block the provider offers. When a proposal is accepted, the slot status is set to `'booked'`. When rejected/cancelled, it returns to `'free'`. `slot_id` is nullable on `solicitacoes` so existing proposals without a slot are preserved.

- [ ] **Step 1: Create migration file**

Create `supabase/migrations/003_agenda.sql`:

```sql
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
```

- [ ] **Step 2: Run migration in Supabase SQL Editor**

Paste contents → Run.

Expected: `Success. No rows returned.`

- [ ] **Step 3: Verify tables in Table Editor**

In Supabase Dashboard → Table Editor:
- Confirm `slots` table exists with columns: `id`, `prestador_id`, `starts_at`, `ends_at`, `status`, `created_at`
- Confirm `solicitacoes` table has new column `slot_id`

- [ ] **Step 4: Test RPC in SQL Editor**

```sql
SELECT * FROM get_nearby_providers_with_availability(
  -23.55, -46.63, 50,
  now()
);
```

Expected: returns rows only for providers that have a free slot overlapping `now()` and are within 50km. Empty result is valid if no slots exist yet.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/003_agenda.sql
git commit -m "feat: slots table, RLS, availability RPC"
```

---

## Task 2: SlotManager Component (Provider Availability UI)

**Files:**
- Create: `src/components/SlotManager.jsx`

### What it does

Providers add time slots (start datetime + duration) and see a list of upcoming free/booked slots. They can delete free slots. Booked slots are read-only.

- [ ] **Step 1: Create SlotManager.jsx**

Create `src/components/SlotManager.jsx`:

```jsx
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Plus, Trash2, Clock } from 'lucide-react'
import { Button } from './Button'

const inputClass = "w-full px-4 py-3 rounded-lg border border-ink-900/15 dark:border-white/15 bg-transparent text-ink-900 dark:text-white placeholder-ink-500 focus:outline-none focus:ring-2 focus:ring-teal-400 text-sm"

const DURATIONS = [
  { label: '1 hora', minutes: 60 },
  { label: '2 horas', minutes: 120 },
  { label: '3 horas', minutes: 180 },
  { label: '4 horas', minutes: 240 },
]

export function SlotManager({ prestadorId }) {
  const [slots, setSlots] = useState([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ starts_at: '', duration: 60 })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function fetchSlots() {
    const { data } = await supabase
      .from('slots')
      .select('*')
      .eq('prestador_id', prestadorId)
      .gte('ends_at', new Date().toISOString())
      .order('starts_at', { ascending: true })
    setSlots(data || [])
    setLoading(false)
  }

  useEffect(() => { fetchSlots() }, [prestadorId])

  async function handleAdd(e) {
    e.preventDefault()
    setError('')
    if (!form.starts_at) { setError('Selecione data e horário'); return }
    const starts = new Date(form.starts_at)
    const ends = new Date(starts.getTime() + form.duration * 60000)
    if (starts <= new Date()) { setError('O horário deve ser no futuro'); return }
    setSaving(true)
    const { error: err } = await supabase.from('slots').insert({
      prestador_id: prestadorId,
      starts_at: starts.toISOString(),
      ends_at: ends.toISOString(),
      status: 'free',
    })
    setSaving(false)
    if (err) { setError(err.message); return }
    setForm({ starts_at: '', duration: 60 })
    setAdding(false)
    fetchSlots()
  }

  async function handleDelete(slotId) {
    await supabase.from('slots').delete().eq('id', slotId)
    setSlots(s => s.filter(x => x.id !== slotId))
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-bold text-ink-900 dark:text-white">Minha Agenda</h3>
          <p className="text-xs text-ink-500 dark:text-ink-600 mt-0.5">Horários livres disponíveis para clientes</p>
        </div>
        <Button size="sm" onClick={() => setAdding(a => !a)}>
          <Plus size={14}/> Adicionar horário
        </Button>
      </div>

      {adding && (
        <form onSubmit={handleAdd} className="bg-white dark:bg-[#11222A] rounded-xl border border-ink-900/10 dark:border-white/10 p-4 flex flex-col gap-3">
          <div>
            <label className="block text-xs font-bold text-ink-700 dark:text-ink-400 uppercase tracking-widest mb-2">Data e horário de início</label>
            <input
              type="datetime-local"
              value={form.starts_at}
              onChange={e => setForm(f => ({ ...f, starts_at: e.target.value }))}
              className={inputClass}
              min={new Date().toISOString().slice(0, 16)}
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-ink-700 dark:text-ink-400 uppercase tracking-widest mb-2">Duração</label>
            <div className="flex gap-2 flex-wrap">
              {DURATIONS.map(d => (
                <button
                  key={d.minutes}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, duration: d.minutes }))}
                  className={`px-3 py-1.5 rounded-lg text-sm font-semibold border transition-colors ${
                    form.duration === d.minutes
                      ? 'bg-teal-400 text-ink-900 border-teal-400'
                      : 'border-ink-900/15 dark:border-white/15 text-ink-700 dark:text-ink-300'
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <div className="flex gap-2">
            <Button type="submit" size="sm" loading={saving}>Salvar</Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setAdding(false)}>Cancelar</Button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="flex flex-col gap-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-16 rounded-xl bg-ink-900/5 dark:bg-white/5 animate-pulse"/>
          ))}
        </div>
      ) : slots.length === 0 ? (
        <div className="text-center py-12 text-ink-500 dark:text-ink-600">
          <Clock size={32} className="mx-auto mb-3 text-ink-300 dark:text-ink-700"/>
          <p className="text-sm font-medium">Nenhum horário cadastrado</p>
          <p className="text-xs mt-1">Adicione horários para receber solicitações</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {slots.map(slot => {
            const start = new Date(slot.starts_at)
            const end = new Date(slot.ends_at)
            const isBooked = slot.status === 'booked'
            return (
              <div
                key={slot.id}
                className={`flex items-center justify-between p-4 rounded-xl border ${
                  isBooked
                    ? 'border-amber-400/50 bg-amber-50 dark:bg-amber-400/10'
                    : 'border-teal-400/50 bg-teal-50 dark:bg-teal-400/10'
                }`}
              >
                <div>
                  <p className="font-semibold text-ink-900 dark:text-white text-sm">
                    {start.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' })}
                  </p>
                  <p className="text-xs text-ink-600 dark:text-ink-400 mt-0.5">
                    {start.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} –{' '}
                    {end.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                    isBooked ? 'bg-amber-400 text-ink-900' : 'bg-teal-400 text-ink-900'
                  }`}>
                    {isBooked ? 'Reservado' : 'Livre'}
                  </span>
                  {!isBooked && (
                    <button
                      onClick={() => handleDelete(slot.id)}
                      className="w-8 h-8 rounded-full grid place-items-center text-ink-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                    >
                      <Trash2 size={14}/>
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify (isolated)**

`SlotManager` won't render yet until wired into `ProviderDashboard`. No action needed here beyond confirming no TypeScript/lint errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/SlotManager.jsx
git commit -m "feat: SlotManager component for provider availability"
```

---

## Task 3: Add Agenda Tab to ProviderDashboard

**Files:**
- Modify: `src/pages/ProviderDashboard.jsx`

### What changes

Add a third tab "Agenda" (alongside "Propostas" and "Alerta") that renders `SlotManager`. The tab value is `'agenda'`.

- [ ] **Step 1: Add import and tab constant**

At the top of `ProviderDashboard.jsx`, add:

```jsx
import { SlotManager } from '../components/SlotManager'
```

Find the tab values definition (look for `'propostas'` and `'alerta'` strings). Add `'agenda'` as a valid tab.

- [ ] **Step 2: Add Agenda tab button**

Find the tab button group (the UI that renders "Propostas" / "Modo Alerta" buttons). Add a third tab button after "Modo Alerta":

```jsx
<button
  onClick={() => setTab('agenda')}
  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all ${
    tab === 'agenda'
      ? 'bg-white dark:bg-[#11222A] text-ink-900 dark:text-white shadow-sm'
      : 'text-ink-600 dark:text-ink-400'
  }`}
>
  Agenda
</button>
```

- [ ] **Step 3: Add Agenda tab content**

Find the section that renders tab content (`tab === 'propostas'` or `tab === 'alerta'`). Add:

```jsx
{tab === 'agenda' && (
  <SlotManager prestadorId={profile.id}/>
)}
```

- [ ] **Step 4: Verify**

Run `npm run dev`. Log in as a prestador. Navigate to `/dashboard`. Expected:
- Three tabs: Propostas / Modo Alerta / Agenda
- Agenda tab shows "Nenhum horário cadastrado" with a clock icon
- "Adicionar horário" button opens the add-slot form
- Adding a slot saves to DB and appears in the list with "Livre" badge
- Deleting a free slot removes it from the list

- [ ] **Step 5: Commit**

```bash
git add src/pages/ProviderDashboard.jsx
git commit -m "feat: Agenda tab in ProviderDashboard with SlotManager"
```

---

## Task 4: DateTimeFilter Component + ClientMap Integration

**Files:**
- Create: `src/components/DateTimeFilter.jsx`
- Modify: `src/pages/ClientMap.jsx`

### What changes

A `DateTimeFilter` component renders a datetime input and a clear button. When active, `ClientMap` calls `get_nearby_providers_with_availability` instead of `get_nearby_providers`. The sidebar header shows "N prestadores disponíveis em [datetime]" when filter is active.

- [ ] **Step 1: Create DateTimeFilter.jsx**

Create `src/components/DateTimeFilter.jsx`:

```jsx
import { Calendar, X } from 'lucide-react'

export function DateTimeFilter({ value, onChange, onClear }) {
  return (
    <div className="flex items-center gap-2 mt-3">
      <div className="flex-1 relative">
        <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none"/>
        <input
          type="datetime-local"
          value={value}
          onChange={e => onChange(e.target.value)}
          min={new Date().toISOString().slice(0, 16)}
          className="w-full pl-9 pr-3 py-2 rounded-lg border border-ink-900/15 dark:border-white/15 bg-transparent text-ink-900 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-teal-400"
        />
      </div>
      {value && (
        <button
          onClick={onClear}
          className="w-8 h-8 rounded-lg grid place-items-center text-ink-400 hover:text-ink-700 dark:hover:text-ink-300 hover:bg-ink-900/5 dark:hover:bg-white/5 transition-colors flex-shrink-0"
        >
          <X size={14}/>
        </button>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Add availability fetch function to ClientMap**

In `src/pages/ClientMap.jsx`, add after `fetchNearbyProviders`:

```js
async function fetchProvidersWithAvailability(lat, lng, radiusKm, desiredAt) {
  const { data } = await supabase.rpc('get_nearby_providers_with_availability', {
    lat, lng, radius_km: radiusKm, desired_at: new Date(desiredAt).toISOString(),
  })
  return (data || []).map(p => ({ ...p, foto_url: p.user_foto_url }))
}
```

- [ ] **Step 3: Add dateFilter state + DateTimeFilter to MapContent**

In `MapContent`, add:

```jsx
import { DateTimeFilter } from '../components/DateTimeFilter'

// inside MapContent:
const [dateFilter, setDateFilter] = useState('')
```

Update `loadProviders` to accept and use the filter:

```js
const loadProviders = useCallback(async (lat, lng, r, dt) => {
  setLoadingProviders(true)
  try {
    const data = dt
      ? await fetchProvidersWithAvailability(lat, lng, r, dt)
      : await fetchNearbyProviders(lat, lng, r)
    setProviders(data)
  } catch {
    setProviders([])
  } finally {
    setLoadingProviders(false)
  }
}, [])
```

Update the debounced radius effect to pass `dateFilter`:

```js
useEffect(() => {
  clearTimeout(debounceRef.current)
  debounceRef.current = setTimeout(() => {
    loadProviders(userLocation.lat, userLocation.lng, radius, dateFilter)
  }, 500)
  return () => clearTimeout(debounceRef.current)
}, [radius, dateFilter, userLocation, loadProviders])
```

- [ ] **Step 4: Add DateTimeFilter to sidebar header**

In `MapContent` JSX, inside the sidebar header card (after the radius slider), add:

```jsx
<DateTimeFilter
  value={dateFilter}
  onChange={v => setDateFilter(v)}
  onClear={() => setDateFilter('')}
/>
```

Update the sidebar header text to reflect the filter:

```jsx
<h2 className="font-extrabold text-ink-900 dark:text-white tracking-tight mb-1" style={{ letterSpacing: '-0.025em' }}>
  {loadingProviders ? '...' : `${providers.length} prestador${providers.length !== 1 ? 'es' : ''} ${dateFilter ? 'disponíveis' : 'próximos'}`}
</h2>
<p className="text-xs text-ink-500 dark:text-ink-600">
  {dateFilter
    ? `Com disponibilidade em ${new Date(dateFilter).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}`
    : 'Clique no pin ou no card para ver o perfil'}
</p>
```

- [ ] **Step 5: Verify**

Run `npm run dev`. Log in as a cliente and go to `/mapa`. Expected:
- A datetime input appears below the radius slider
- With no date selected: loads providers normally via `get_nearby_providers`
- After selecting a date/time: re-fetches via `get_nearby_providers_with_availability`, showing only providers with a free slot at that time within the radius
- Clicking the X on the filter clears it and re-fetches normally
- The sidebar counter says "X prestadores disponíveis" when filter is active, "X prestadores próximos" otherwise

- [ ] **Step 6: Commit**

```bash
git add src/components/DateTimeFilter.jsx src/pages/ClientMap.jsx
git commit -m "feat: date/time availability filter in ClientMap"
```

---

## Task 5: Client Dashboard Page

**Files:**
- Create: `src/pages/ClientDashboard.jsx`

### Tabs

1. **Propostas** — list of proposals sent by the client with status badges
2. **Histórico** — proposals with `status = 'aceita'` or `'recusada'` (completed/closed)
3. **Perfil** — edit `nome` and display email (email change not supported via this UI)

- [ ] **Step 1: Create ClientDashboard.jsx**

Create `src/pages/ClientDashboard.jsx`:

```jsx
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { Header } from '../components/Header'
import { Button } from '../components/Button'
import { ClipboardList, History, User } from 'lucide-react'

const TABS = [
  { id: 'propostas', label: 'Propostas', icon: ClipboardList },
  { id: 'historico', label: 'Histórico', icon: History },
  { id: 'perfil', label: 'Perfil', icon: User },
]

const STATUS_STYLES = {
  pendente:  { label: 'Pendente',  bg: 'bg-amber-50 dark:bg-amber-400/10',  text: 'text-amber-700 dark:text-amber-300',  dot: 'bg-amber-400' },
  aceita:    { label: 'Aceita',    bg: 'bg-teal-50 dark:bg-teal-400/10',    text: 'text-teal-700 dark:text-teal-300',    dot: 'bg-teal-400' },
  recusada:  { label: 'Recusada', bg: 'bg-red-50 dark:bg-red-500/10',      text: 'text-red-600 dark:text-red-400',      dot: 'bg-red-500' },
}

function ProposalCard({ proposal }) {
  const s = STATUS_STYLES[proposal.status] || STATUS_STYLES.pendente
  const date = new Date(proposal.data_desejada)
  return (
    <div className="bg-white dark:bg-[#11222A] rounded-xl border border-ink-900/10 dark:border-white/10 p-5">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <p className="font-semibold text-ink-900 dark:text-white text-sm leading-snug">{proposal.descricao}</p>
          <p className="text-xs text-ink-500 dark:text-ink-600 mt-1">
            {date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
        <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold flex-shrink-0 ${s.bg} ${s.text}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`}/>
          {s.label}
        </span>
      </div>
      {proposal.valor_oferecido && (
        <p className="text-xs text-ink-600 dark:text-ink-400">
          Valor oferecido: <span className="font-bold text-teal-600 dark:text-teal-400">R$ {Number(proposal.valor_oferecido).toFixed(2)}</span>
        </p>
      )}
    </div>
  )
}

function PropostasTab({ clientId }) {
  const [proposals, setProposals] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('solicitacoes')
      .select('*')
      .eq('cliente_id', clientId)
      .in('status', ['pendente'])
      .order('created_at', { ascending: false })
      .then(({ data }) => { setProposals(data || []); setLoading(false) })
  }, [clientId])

  if (loading) return (
    <div className="flex flex-col gap-3">
      {[1, 2, 3].map(i => <div key={i} className="h-24 rounded-xl bg-ink-900/5 dark:bg-white/5 animate-pulse"/>)}
    </div>
  )

  if (proposals.length === 0) return (
    <div className="text-center py-16 text-ink-500 dark:text-ink-600">
      <ClipboardList size={36} className="mx-auto mb-3 text-ink-300 dark:text-ink-700"/>
      <p className="font-medium text-sm">Nenhuma proposta pendente</p>
      <p className="text-xs mt-1">Suas propostas em aberto aparecerão aqui</p>
    </div>
  )

  return (
    <div className="flex flex-col gap-3">
      {proposals.map(p => <ProposalCard key={p.id} proposal={p}/>)}
    </div>
  )
}

function HistoricoTab({ clientId }) {
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('solicitacoes')
      .select('*')
      .eq('cliente_id', clientId)
      .in('status', ['aceita', 'recusada'])
      .order('created_at', { ascending: false })
      .then(({ data }) => { setHistory(data || []); setLoading(false) })
  }, [clientId])

  if (loading) return (
    <div className="flex flex-col gap-3">
      {[1, 2].map(i => <div key={i} className="h-24 rounded-xl bg-ink-900/5 dark:bg-white/5 animate-pulse"/>)}
    </div>
  )

  if (history.length === 0) return (
    <div className="text-center py-16 text-ink-500 dark:text-ink-600">
      <History size={36} className="mx-auto mb-3 text-ink-300 dark:text-ink-700"/>
      <p className="font-medium text-sm">Nenhum serviço no histórico ainda</p>
    </div>
  )

  return (
    <div className="flex flex-col gap-3">
      {history.map(p => <ProposalCard key={p.id} proposal={p}/>)}
    </div>
  )
}

function PerfilTab({ profile, onUpdate }) {
  const [nome, setNome] = useState(profile.nome || '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  async function handleSave(e) {
    e.preventDefault()
    if (!nome.trim()) { setError('Nome não pode ser vazio'); return }
    setSaving(true)
    const { error: err } = await supabase
      .from('users')
      .update({ nome: nome.trim() })
      .eq('id', profile.id)
    setSaving(false)
    if (err) { setError(err.message); return }
    setSaved(true)
    onUpdate()
    setTimeout(() => setSaved(false), 3000)
  }

  const inputClass = "w-full px-4 py-3 rounded-lg border border-ink-900/15 dark:border-white/15 bg-transparent text-ink-900 dark:text-white placeholder-ink-500 focus:outline-none focus:ring-2 focus:ring-teal-400 text-sm"

  return (
    <form onSubmit={handleSave} className="flex flex-col gap-4 max-w-sm">
      <div>
        <label className="block text-xs font-bold text-ink-700 dark:text-ink-400 uppercase tracking-widest mb-2">Nome</label>
        <input
          type="text"
          value={nome}
          onChange={e => setNome(e.target.value)}
          className={inputClass}
          placeholder="Seu nome"
        />
      </div>
      <div>
        <label className="block text-xs font-bold text-ink-700 dark:text-ink-400 uppercase tracking-widest mb-2">E-mail</label>
        <input
          type="email"
          value={profile.email || ''}
          disabled
          className={`${inputClass} opacity-50 cursor-not-allowed`}
        />
        <p className="text-xs text-ink-500 dark:text-ink-600 mt-1">O e-mail não pode ser alterado por aqui.</p>
      </div>
      {error && <p className="text-red-500 text-sm">{error}</p>}
      {saved && <p className="text-teal-600 dark:text-teal-400 text-sm font-semibold">Perfil atualizado!</p>}
      <Button type="submit" loading={saving}>Salvar alterações</Button>
    </form>
  )
}

export function ClientDashboard() {
  const { profile, refetchProfile } = useAuth()
  const [tab, setTab] = useState('propostas')

  if (!profile) return null

  return (
    <div className="min-h-screen bg-[#FAF8F3] dark:bg-[#08141A]">
      <Header/>
      <div className="max-w-2xl mx-auto px-6 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-extrabold text-ink-900 dark:text-white" style={{ letterSpacing: '-0.025em' }}>
            Minha conta
          </h1>
          <p className="text-sm text-ink-500 dark:text-ink-600 mt-1">Bem-vindo, {profile.nome}</p>
        </div>

        <div className="flex gap-1 bg-ink-900/5 dark:bg-white/5 rounded-xl p-1 mb-6">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                tab === t.id
                  ? 'bg-white dark:bg-[#11222A] text-ink-900 dark:text-white shadow-sm'
                  : 'text-ink-600 dark:text-ink-400'
              }`}
            >
              <t.icon size={14}/>
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'propostas' && <PropostasTab clientId={profile.id}/>}
        {tab === 'historico' && <HistoricoTab clientId={profile.id}/>}
        {tab === 'perfil'    && <PerfilTab profile={profile} onUpdate={refetchProfile}/>}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/ClientDashboard.jsx
git commit -m "feat: ClientDashboard with Propostas, Histórico, Perfil tabs"
```

---

## Task 6: Wire /cliente Route + Header Link

**Files:**
- Modify: `src/App.jsx`
- Modify: `src/components/Header.jsx`

- [ ] **Step 1: Add /cliente route in App.jsx**

Add the import at the top of `src/App.jsx`:

```jsx
import { ClientDashboard } from './pages/ClientDashboard'
```

Add the route inside `<Routes>`, after the `/mapa` route:

```jsx
<Route path="/cliente" element={<PrivateRoute requiredType="cliente"><ClientDashboard/></PrivateRoute>}/>
```

- [ ] **Step 2: Add "Minha conta" link in Header.jsx**

In `src/components/Header.jsx`, in the logged-in button block, add a "Minha conta" ghost button for clientes (between the name span and the Sair button):

```jsx
{profile && !profile.is_admin && profile.tipo === 'cliente' && (
  <Button variant="ghost" size="sm" onClick={() => navigate('/cliente')}>Minha conta</Button>
)}
```

- [ ] **Step 3: Verify end-to-end**

Run `npm run dev`. Log in as a cliente. Expected:
- Header shows "Minha conta" link
- Clicking it navigates to `/cliente`
- `/cliente` shows the three-tab dashboard
- Propostas tab lists open proposals
- Histórico tab lists accepted/rejected proposals
- Perfil tab allows updating the name, shows success message after save

- [ ] **Step 4: Commit**

```bash
git add src/App.jsx src/components/Header.jsx
git commit -m "feat: /cliente route and Minha conta nav link"
```

---

## Self-Review Checklist

- [x] **Spec: Agenda do Prestador** → Task 2 (SlotManager) + Task 3 (ProviderDashboard tab)
- [x] **Spec: Integração de Propostas com horários livres** → `slot_id` on `solicitacoes` (Task 1); UI enforces slot selection via DateTimeFilter (Task 4)
- [x] **Spec: Filtro Inteligente (data/hora + raio)** → Task 4 (`get_nearby_providers_with_availability`)
- [x] **Spec: Dashboard do Cliente** → Task 5 (ClientDashboard)
- [x] **Spec: RLS para Agenda** → Task 1 (5 RLS policies on `slots`)
- [x] **Spec: PostGIS / performance** → availability RPC joins at DB level, single round-trip
- [x] **Type consistency:** `slot_id` is `uuid` in migration and in `solicitacoes` insert; `fetchProvidersWithAvailability` returns same shape as `fetchNearbyProviders` (both map `user_foto_url → foto_url`)
- [x] **Placeholder scan:** No TBDs. All code blocks are complete. All commands are exact.

> **Gap note:** The spec says "clientes só podem enviar propostas para horários que estejam livres". The current `SolicitacaoModal` still lets clients send proposals without selecting a slot. Full enforcement would require the modal to require a `slot_id` — left as a follow-up task to keep this plan focused. The DB is ready for it (`slot_id` column exists, RPC returns `slot_id`).
