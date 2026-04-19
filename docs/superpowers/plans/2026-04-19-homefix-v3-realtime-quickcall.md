# HomeFix v3 — Realtime Quick Call & Dynamic Location Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add dynamic location tracking, occupancy-based provider schedule, advanced map filters, and an Uber-style "Quick Call" real-time bidding flow to the HomeFix marketplace.

**Architecture:** All real-time communication uses Supabase Broadcast (not polling) to stay within Free Tier limits. The Quick Call flow is asynchronous: client broadcasts a request, nearby online providers receive a "Flash Alert" and submit timed offers, client accepts the best offer via an atomic Postgres function that prevents race conditions. Provider availability is implicit (08:00–18:00) minus confirmed bookings — no explicit slot management needed.

**Tech Stack:** React 19 + Supabase v2 (Postgres/PostGIS/Realtime Broadcast) + Google Maps API + Tailwind CSS 3 + lucide-react

---

## Scope note

Five independent subsystems all share the same DB migration as their foundation. Tasks 1–11 must be executed in order; Tasks 3–7 can be done in parallel after Task 1 completes.

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| **Create** | `supabase/migrations/004_homefix_v3.sql` | Schema columns, new tables, updated RPCs, RLS |
| **Create** | `src/lib/geo.js` | `haversineDistance` utility (metres) |
| **Create** | `src/hooks/useLocationSync.js` | `watchPosition` with 50 m threshold, writes `last_location` |
| **Create** | `src/components/AgendaCalendar.jsx` | Occupancy-based 7-day agenda for providers |
| **Create** | `src/components/FlashAlert.jsx` | Provider component for Quick Call alerts |
| **Create** | `src/components/QuickCallPanel.jsx` | Client component to create + accept Quick Call offers |
| **Modify** | `src/pages/ProviderDashboard.jsx` | Wire `useLocationSync`, `FlashAlert`, `AgendaCalendar` |
| **Modify** | `src/pages/ClientMap.jsx` | Categoria/hourly-rate filters, updated RPC calls, `QuickCallPanel`, online marker colour |
| **Modify** | `src/components/ProviderMarker.jsx` | Accept `isOnline` prop → green/grey border |

---

## Task 1 — Migration 004: Schema, Tables, RPCs, RLS

**Files:**
- Create: `supabase/migrations/004_homefix_v3.sql`

> Apply this migration manually in the Supabase SQL Editor (same process as 001–003).

- [ ] **Step 1: Create the migration file**

```sql
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
--    Replaces slot-based approach: provider is available unless
--    an accepted booking overlaps the desired time.
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
```

- [ ] **Step 2: Apply migration in Supabase SQL Editor**

  Open Supabase dashboard → SQL Editor → paste the full content of `004_homefix_v3.sql` → Run.

  Verify by running:
  ```sql
  SELECT column_name FROM information_schema.columns
  WHERE table_name = 'prestadores'
    AND column_name IN ('is_online','hourly_rate','last_location');
  -- Should return 3 rows

  SELECT table_name FROM information_schema.tables
  WHERE table_name IN ('quick_calls','quick_call_offers');
  -- Should return 2 rows
  ```

- [ ] **Step 3: Verify build is still clean**

  ```bash
  npm run build
  ```
  Expected: build succeeds, no errors.

- [ ] **Step 4: Commit**

  ```bash
  git add supabase/migrations/004_homefix_v3.sql
  git commit -m "feat: migration 004 — is_online, hourly_rate, quick_calls, updated RPCs"
  ```

---

## Task 2 — geo.js: haversine distance utility

**Files:**
- Create: `src/lib/geo.js`

- [ ] **Step 1: Create the file**

```js
// src/lib/geo.js
export function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
```

- [ ] **Step 2: Verify build**

  ```bash
  npm run build
  ```
  Expected: success.

- [ ] **Step 3: Commit**

  ```bash
  git add src/lib/geo.js
  git commit -m "feat: haversineDistance utility"
  ```

---

## Task 3 — useLocationSync hook

**Files:**
- Create: `src/hooks/useLocationSync.js`

- [ ] **Step 1: Create the hook**

```js
// src/hooks/useLocationSync.js
import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { haversineDistance } from '../lib/geo';

/**
 * Watches the device position while isOnline is true.
 * Only writes to DB if the device moved > 50 metres since the last update.
 * Clears the watch and stops on cleanup / when isOnline becomes false.
 */
export function useLocationSync(isOnline, userId) {
  const watchId = useRef(null);
  const lastPos = useRef(null);

  useEffect(() => {
    if (!isOnline || !userId) {
      if (watchId.current != null) {
        navigator.geolocation.clearWatch(watchId.current);
        watchId.current = null;
        lastPos.current = null;
      }
      return;
    }

    watchId.current = navigator.geolocation.watchPosition(
      async ({ coords: { latitude: lat, longitude: lng } }) => {
        if (lastPos.current) {
          const moved = haversineDistance(
            lastPos.current.lat,
            lastPos.current.lng,
            lat,
            lng
          );
          if (moved < 50) return;
        }
        lastPos.current = { lat, lng };
        await supabase
          .from('prestadores')
          .update({
            last_location: `SRID=4326;POINT(${lng} ${lat})`,
            latitude: lat,
            longitude: lng,
          })
          .eq('user_id', userId);
      },
      (err) => console.error('useLocationSync error:', err),
      { enableHighAccuracy: true, maximumAge: 10000 }
    );

    return () => {
      if (watchId.current != null) {
        navigator.geolocation.clearWatch(watchId.current);
        watchId.current = null;
      }
    };
  }, [isOnline, userId]);
}
```

- [ ] **Step 2: Verify build**

  ```bash
  npm run build
  ```

- [ ] **Step 3: Commit**

  ```bash
  git add src/hooks/useLocationSync.js
  git commit -m "feat: useLocationSync hook — watchPosition with 50m threshold"
  ```

---

## Task 4 — ProviderDashboard: location sync + is_online DB sync

**Files:**
- Modify: `src/pages/ProviderDashboard.jsx`

Currently `toggleOnline()` captures a one-shot GPS position and updates `status` + lat/lng. We need to also update `is_online` and hand off continuous tracking to `useLocationSync`.

- [ ] **Step 1: Add import for useLocationSync**

  At the top of `ProviderDashboard.jsx`, after the existing imports add:

  ```js
  import { useLocationSync } from '../hooks/useLocationSync';
  ```

- [ ] **Step 2: Derive isOnline boolean and wire hook**

  Inside the `ProviderDashboard` component body, just below the existing state declarations, add:

  ```js
  const isOnline = status === 'online';
  useLocationSync(isOnline, profile?.id);
  ```

- [ ] **Step 3: Update toggleOnline — sync is_online column**

  Find the `toggleOnline` function. It currently calls:
  ```js
  await supabase.from('prestadores').update({ status: 'online', latitude: lat, longitude: lng }).eq(...)
  ```

  Add `is_online: true` to the "going online" update and `is_online: false` to the "going offline" update:

  **Going online block** — change the update call to:
  ```js
  await supabase
    .from('prestadores')
    .update({
      status: 'online',
      is_online: true,
      latitude: lat,
      longitude: lng,
      last_location: `SRID=4326;POINT(${lng} ${lat})`,
    })
    .eq('user_id', profile.id);
  ```

  **Going offline block** — change the update call to:
  ```js
  await supabase
    .from('prestadores')
    .update({ status: 'offline', is_online: false })
    .eq('user_id', profile.id);
  ```

- [ ] **Step 4: Sync is_online in alert mode transitions**

  In `setAlertMode()`, add `is_online: false` alongside `status: 'alerta'`:
  ```js
  await supabase
    .from('prestadores')
    .update({ status: 'alerta', is_online: false })
    .eq('user_id', profile.id);
  ```

  In `acceptAlertAndGoOnline()`, add `is_online: true` to the update (alongside `status: 'online'`).

  In `deactivateAlert()`, add `is_online: false` to the update.

- [ ] **Step 5: Verify build**

  ```bash
  npm run build
  ```

- [ ] **Step 6: Commit**

  ```bash
  git add src/pages/ProviderDashboard.jsx
  git commit -m "feat: ProviderDashboard — continuous location sync, is_online DB column"
  ```

---

## Task 5 — AgendaCalendar component (occupancy-based)

**Files:**
- Create: `src/components/AgendaCalendar.jsx`

Replaces SlotManager. Shows a rolling 7-day view. Availability is implicitly 08:00–18:00 each day. Busy blocks come from accepted `solicitacoes` with `estimated_duration`.

- [ ] **Step 1: Create AgendaCalendar.jsx**

```jsx
// src/components/AgendaCalendar.jsx
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { ChevronLeft, ChevronRight } from 'lucide-react';

function getWeekDays(offsetWeeks) {
  const days = [];
  const anchor = new Date();
  anchor.setDate(anchor.getDate() + offsetWeeks * 7);
  anchor.setHours(0, 0, 0, 0);
  for (let i = 0; i < 7; i++) {
    const d = new Date(anchor);
    d.setDate(d.getDate() + i);
    days.push(d);
  }
  return days;
}

function fmtTime(isoString) {
  return new Date(isoString).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function fmtDay(date) {
  return date.toLocaleDateString('pt-BR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

export default function AgendaCalendar({ prestadorId }) {
  const [weekOffset, setWeekOffset] = useState(0);
  const [bookings, setBookings] = useState([]);

  const days = getWeekDays(weekOffset);
  const weekStart = days[0].toISOString();
  const weekEnd = (() => {
    const d = new Date(days[6]);
    d.setHours(23, 59, 59, 999);
    return d.toISOString();
  })();

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('solicitacoes')
      .select(
        'id, data_desejada, estimated_duration, descricao, users!solicitacoes_cliente_id_fkey(nome)'
      )
      .eq('prestador_id', prestadorId)
      .eq('status', 'aceita')
      .not('estimated_duration', 'is', null)
      .gte('data_desejada', weekStart)
      .lte('data_desejada', weekEnd);
    setBookings(data || []);
  }, [prestadorId, weekStart, weekEnd]);

  useEffect(() => {
    load();
  }, [load]);

  function blocksForDay(day) {
    return bookings.filter(
      (b) =>
        new Date(b.data_desejada).toDateString() === day.toDateString()
    );
  }

  return (
    <div>
      {/* Week navigation */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => setWeekOffset((w) => w - 1)}
          className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
        >
          <ChevronLeft size={18} />
        </button>
        <span className="text-sm font-medium text-[var(--text-600)]">
          {days[0].toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })}
          {' – '}
          {days[6].toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' })}
        </span>
        <button
          onClick={() => setWeekOffset((w) => w + 1)}
          className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Day rows */}
      <div className="space-y-2">
        {days.map((day) => {
          const blocks = blocksForDay(day);
          const isToday = day.toDateString() === new Date().toDateString();
          const isPast = day < new Date(new Date().setHours(0, 0, 0, 0));

          return (
            <div
              key={day.toISOString()}
              className={`rounded-lg border px-3 py-2 ${
                isToday
                  ? 'border-[var(--teal-400)] bg-teal-50/30 dark:bg-teal-900/10'
                  : 'border-gray-200 dark:border-gray-700'
              } ${isPast ? 'opacity-50' : ''}`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-[var(--text-600)]">
                  {fmtDay(day)}
                  {isToday && (
                    <span className="ml-2 text-[var(--teal-400)]">hoje</span>
                  )}
                </span>
                {blocks.length === 0 && (
                  <span className="text-xs text-green-500">
                    Disponível 08:00–18:00
                  </span>
                )}
              </div>

              {blocks.length > 0 && (
                <div className="space-y-1 mt-1">
                  {blocks.map((b) => {
                    const endMs =
                      new Date(b.data_desejada).getTime() +
                      b.estimated_duration * 60_000;
                    const endIso = new Date(endMs).toISOString();
                    return (
                      <div
                        key={b.id}
                        className="flex items-center gap-2 text-xs bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded px-2 py-1"
                      >
                        <span className="font-mono shrink-0">
                          {fmtTime(b.data_desejada)}–{fmtTime(endIso)}
                        </span>
                        <span className="text-red-400">·</span>
                        <span className="font-medium">
                          {b.users?.nome ?? 'Cliente'}
                        </span>
                        <span className="text-red-400 truncate">{b.descricao}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

  ```bash
  npm run build
  ```

- [ ] **Step 3: Commit**

  ```bash
  git add src/components/AgendaCalendar.jsx
  git commit -m "feat: AgendaCalendar — occupancy-based 7-day provider schedule"
  ```

---

## Task 6 — ProviderDashboard: Agenda tab uses AgendaCalendar

**Files:**
- Modify: `src/pages/ProviderDashboard.jsx`

- [ ] **Step 1: Swap SlotManager import for AgendaCalendar**

  Find the import line:
  ```js
  import SlotManager from '../components/SlotManager';
  ```
  Replace with:
  ```js
  import AgendaCalendar from '../components/AgendaCalendar';
  ```

- [ ] **Step 2: Replace SlotManager in the Agenda tab JSX**

  In the Agenda tab render block find:
  ```jsx
  <SlotManager prestadorId={profile.id} />
  ```
  Replace with:
  ```jsx
  <AgendaCalendar prestadorId={profile.id} />
  ```

- [ ] **Step 3: Verify build**

  ```bash
  npm run build
  ```

- [ ] **Step 4: Commit**

  ```bash
  git add src/pages/ProviderDashboard.jsx
  git commit -m "feat: ProviderDashboard — Agenda tab uses occupancy-based AgendaCalendar"
  ```

---

## Task 7 — ClientMap: filters, updated RPC calls, online marker colour

**Files:**
- Modify: `src/pages/ClientMap.jsx`
- Modify: `src/components/ProviderMarker.jsx`

### 7a — ProviderMarker: online/offline colour

- [ ] **Step 1: Add isOnline prop to ProviderMarker**

  Open `src/components/ProviderMarker.jsx`. Find the component function signature and add `isOnline` to the destructured props.

  Locate the SVG element that renders the circle border (typically a `<circle>` with a stroke or a `<rect>`/outer `<circle>`). Change the stroke/fill colour to use a conditional:
  - `isOnline === true` → `stroke="#2dd4bf"` (teal, matches `--teal-400`)
  - `isOnline === false` → `stroke="#6b7280"` (gray-500)

  The exact diff depends on the current SVG shape but follows this pattern:
  ```jsx
  // Before (example)
  <circle cx="20" cy="20" r="18" fill="white" stroke="#2dd4bf" strokeWidth="2.5" />
  // After
  <circle
    cx="20" cy="20" r="18"
    fill="white"
    stroke={isOnline ? '#2dd4bf' : '#6b7280'}
    strokeWidth="2.5"
  />
  ```

- [ ] **Step 2: Pass isOnline from ClientMap**

  In `ClientMap.jsx`, wherever `<ProviderMarker>` is rendered, add:
  ```jsx
  <ProviderMarker
    provider={p}
    isOnline={p.is_online ?? true}
    ...existingProps
  />
  ```

### 7b — ClientMap: category + hourly-rate filters

- [ ] **Step 3: Add filter state at the top of MapContent**

  Inside the `MapContent` function, after the existing `radius` and `dateFilter` state, add:
  ```js
  const [categorias, setCategorias] = useState([]);
  const [filterCategoria, setFilterCategoria] = useState('');
  const [minRate, setMinRate] = useState('');
  const [maxRate, setMaxRate] = useState('');
  ```

- [ ] **Step 4: Fetch distinct categories on mount**

  Inside the existing `useEffect` that runs on mount (or add a new one), fetch available categories:
  ```js
  useEffect(() => {
    supabase
      .from('prestadores')
      .select('categoria')
      .eq('approval_status', 'active')
      .then(({ data }) => {
        const unique = [...new Set((data || []).map((r) => r.categoria).filter(Boolean))].sort();
        setCategorias(unique);
      });
  }, []);
  ```

- [ ] **Step 5: Update fetchNearbyProviders to pass filter params**

  Find the `fetchNearbyProviders` function. Update the RPC call:
  ```js
  async function fetchNearbyProviders(lat, lng, radiusKm) {
    const params = {
      lat,
      lng,
      radius_km: radiusKm,
      filter_categoria: filterCategoria || null,
      min_hourly_rate: minRate ? parseFloat(minRate) : null,
      max_hourly_rate: maxRate ? parseFloat(maxRate) : null,
    };
    const { data, error } = await supabase.rpc('get_nearby_providers', params);
    if (error) { console.error(error); return; }
    setProviders(
      (data || []).map((p) => ({ ...p, foto_url: p.foto_url ?? p.user_foto_url }))
    );
  }
  ```

- [ ] **Step 6: Update fetchProvidersWithAvailability to pass filter params**

  Find `fetchProvidersWithAvailability`. Update similarly:
  ```js
  async function fetchProvidersWithAvailability(lat, lng, radiusKm, desiredAt) {
    const params = {
      lat,
      lng,
      radius_km: radiusKm,
      desired_at: desiredAt,
      filter_categoria: filterCategoria || null,
      min_hourly_rate: minRate ? parseFloat(minRate) : null,
      max_hourly_rate: maxRate ? parseFloat(maxRate) : null,
    };
    const { data, error } = await supabase.rpc(
      'get_nearby_providers_with_availability',
      params
    );
    if (error) { console.error(error); return; }
    setProviders(
      (data || []).map((p) => ({ ...p, foto_url: p.foto_url ?? p.user_foto_url }))
    );
  }
  ```

- [ ] **Step 7: Add filter changes to the debounced reload deps**

  Find the `useEffect` that debounces reload on `radius`/`dateFilter`. Add `filterCategoria`, `minRate`, `maxRate` to the dependency array and the debounce trigger.

- [ ] **Step 8: Add filter UI to the sidebar**

  In the sidebar JSX (after the existing radius slider and datetime filter), add:
  ```jsx
  {/* Category filter */}
  <div>
    <label className="text-xs font-medium text-[var(--text-600)] block mb-1">
      Categoria
    </label>
    <select
      value={filterCategoria}
      onChange={(e) => setFilterCategoria(e.target.value)}
      className="w-full border rounded-lg px-3 py-2 text-sm dark:bg-[#08141A] dark:border-gray-600 dark:text-white"
    >
      <option value="">Todas</option>
      {categorias.map((c) => (
        <option key={c} value={c}>{c}</option>
      ))}
    </select>
  </div>

  {/* Hourly rate range */}
  <div>
    <label className="text-xs font-medium text-[var(--text-600)] block mb-1">
      Valor/hora (R$)
    </label>
    <div className="flex gap-2">
      <input
        type="number"
        min="0"
        placeholder="Mín"
        value={minRate}
        onChange={(e) => setMinRate(e.target.value)}
        className="w-1/2 border rounded-lg px-2 py-2 text-sm dark:bg-[#08141A] dark:border-gray-600 dark:text-white"
      />
      <input
        type="number"
        min="0"
        placeholder="Máx"
        value={maxRate}
        onChange={(e) => setMaxRate(e.target.value)}
        className="w-1/2 border rounded-lg px-2 py-2 text-sm dark:bg-[#08141A] dark:border-gray-600 dark:text-white"
      />
    </div>
  </div>
  ```

- [ ] **Step 9: Verify build**

  ```bash
  npm run build
  ```

- [ ] **Step 10: Commit**

  ```bash
  git add src/pages/ClientMap.jsx src/components/ProviderMarker.jsx
  git commit -m "feat: map filters (categoria, hourly rate), online/offline marker colour"
  ```

---

## Task 8 — FlashAlert component (provider receives Quick Call alerts)

**Files:**
- Create: `src/components/FlashAlert.jsx`

Subscribes to Supabase Broadcast channel `quick-calls`. Filters alerts by radius + category client-side. Shows an overlay card with estimated-duration form.

- [ ] **Step 1: Create FlashAlert.jsx**

```jsx
// src/components/FlashAlert.jsx
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { haversineDistance } from '../lib/geo';
import Button from './Button';
import { X, Zap } from 'lucide-react';

/**
 * prestador: {
 *   user_id, categoria, hourly_rate,
 *   latitude, longitude   ← current position (updated by useLocationSync)
 * }
 */
export default function FlashAlert({ prestador }) {
  const [alert, setAlert] = useState(null);
  const [duration, setDuration] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const channel = supabase
      .channel('quick-calls')
      .on('broadcast', { event: 'new-quick-call' }, ({ payload }) => {
        if (!prestador.latitude || !prestador.longitude) return;
        const dist = haversineDistance(
          prestador.latitude,
          prestador.longitude,
          payload.lat,
          payload.lng
        );
        if (dist > payload.radius_km * 1000) return;
        if (payload.categoria && payload.categoria !== prestador.categoria) return;
        setAlert(payload);
        setDuration('');
        setDone(false);
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [prestador.latitude, prestador.longitude, prestador.categoria]);

  async function handleSubmit() {
    const mins = parseInt(duration, 10);
    if (!mins || mins < 15) return;
    const totalPrice =
      prestador.hourly_rate != null
        ? parseFloat((prestador.hourly_rate * (mins / 60)).toFixed(2))
        : 0;

    setSubmitting(true);
    const { error } = await supabase.from('quick_call_offers').insert({
      quick_call_id: alert.quick_call_id,
      prestador_id: prestador.user_id,
      estimated_duration: mins,
      total_price: totalPrice,
    });
    setSubmitting(false);
    if (!error) {
      setDone(true);
      setAlert(null);
    }
  }

  if (done) {
    return (
      <div className="fixed bottom-4 right-4 z-[9999] max-w-sm rounded-xl bg-teal-600 p-4 shadow-xl text-white">
        <p className="font-semibold">Proposta enviada!</p>
        <p className="text-sm opacity-80 mt-0.5">Aguardando resposta do cliente.</p>
        <button
          onClick={() => setDone(false)}
          className="absolute top-3 right-3 opacity-70 hover:opacity-100"
        >
          <X size={16} />
        </button>
      </div>
    );
  }

  if (!alert) return null;

  const estimatedTotal =
    prestador.hourly_rate && duration
      ? (prestador.hourly_rate * (parseInt(duration, 10) / 60)).toFixed(2)
      : null;

  return (
    <div className="fixed bottom-4 right-4 z-[9999] max-w-sm rounded-xl border border-amber-400 bg-white dark:bg-[#08141A] p-4 shadow-xl">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <Zap size={16} className="text-amber-400 shrink-0" />
          <p className="font-semibold text-amber-500 text-sm">Chamado Rápido</p>
        </div>
        <button
          onClick={() => setAlert(null)}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
        >
          <X size={16} />
        </button>
      </div>

      <p className="text-sm dark:text-gray-300 mb-3">{alert.descricao}</p>

      <div className="mb-3">
        <label className="block text-xs text-[var(--text-600)] mb-1">
          Duração estimada (minutos)
        </label>
        <input
          type="number"
          min="15"
          max="480"
          step="15"
          value={duration}
          onChange={(e) => setDuration(e.target.value)}
          placeholder="Ex: 60"
          className="w-full rounded-lg border px-3 py-2 text-sm dark:bg-gray-800 dark:border-gray-600 dark:text-white"
        />
        {estimatedTotal && (
          <p className="mt-1 text-xs text-[var(--teal-400)]">
            Total estimado: R$ {estimatedTotal}
          </p>
        )}
      </div>

      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => setAlert(null)}>
          Ignorar
        </Button>
        <Button
          size="sm"
          onClick={handleSubmit}
          disabled={!duration || parseInt(duration, 10) < 15 || submitting}
        >
          {submitting ? 'Enviando...' : 'Enviar Proposta'}
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

  ```bash
  npm run build
  ```

- [ ] **Step 3: Commit**

  ```bash
  git add src/components/FlashAlert.jsx
  git commit -m "feat: FlashAlert component — provider receives Quick Call broadcast alerts"
  ```

---

## Task 9 — ProviderDashboard: mount FlashAlert when online

**Files:**
- Modify: `src/pages/ProviderDashboard.jsx`

- [ ] **Step 1: Import FlashAlert**

  Add at the top of `ProviderDashboard.jsx`:
  ```js
  import FlashAlert from '../components/FlashAlert';
  ```

- [ ] **Step 2: Build prestador object for FlashAlert**

  Inside the component, after the existing state, add a derived object that holds the fields FlashAlert needs. This re-uses state already tracked by ProviderDashboard (the component already fetches `profile` from `useAuth`; `latitude`/`longitude` come from the last GPS capture stored in the `prestadores` row).

  Add this right before the return statement:
  ```js
  const prestadorForAlert = {
    user_id: profile?.id,
    categoria: profile?.categoria,          // if present on profile
    hourly_rate: profile?.hourly_rate,      // may be null until set
    latitude: profile?.latitude,
    longitude: profile?.longitude,
  };
  ```

  > Note: If `useAuth` does not yet return `categoria`, `hourly_rate`, `latitude`, `longitude` from `prestadores`, add them to the `useAuth` select query in `src/hooks/useAuth.js`. The hook currently selects from `users` — it needs a join or a separate fetch. Add this fetch inside the `ProviderDashboard` component instead if modifying `useAuth` is not desired:
  >
  > ```js
  > const [prestadorRow, setPrestadorRow] = useState(null);
  > useEffect(() => {
  >   if (!profile?.id) return;
  >   supabase
  >     .from('prestadores')
  >     .select('categoria, hourly_rate, latitude, longitude')
  >     .eq('user_id', profile.id)
  >     .single()
  >     .then(({ data }) => setPrestadorRow(data));
  > }, [profile?.id]);
  >
  > const prestadorForAlert = {
  >   user_id: profile?.id,
  >   ...(prestadorRow ?? {}),
  > };
  > ```

- [ ] **Step 3: Render FlashAlert only when online**

  At the bottom of the return, outside all tabs, add:
  ```jsx
  {status === 'online' && profile?.id && (
    <FlashAlert prestador={prestadorForAlert} />
  )}
  ```

- [ ] **Step 4: Verify build**

  ```bash
  npm run build
  ```

- [ ] **Step 5: Commit**

  ```bash
  git add src/pages/ProviderDashboard.jsx
  git commit -m "feat: ProviderDashboard — mount FlashAlert when provider is online"
  ```

---

## Task 10 — QuickCallPanel component (client creates request + accepts offers)

**Files:**
- Create: `src/components/QuickCallPanel.jsx`

- [ ] **Step 1: Create QuickCallPanel.jsx**

```jsx
// src/components/QuickCallPanel.jsx
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import Button from './Button';
import { Zap, X, Loader2 } from 'lucide-react';

/**
 * userLocation: { lat, lng }
 * clientId: uuid
 * categorias: string[]   — available categories for the dropdown
 * onClose: () => void
 */
export default function QuickCallPanel({ userLocation, clientId, categorias, onClose }) {
  const [step, setStep] = useState('form');   // 'form' | 'waiting' | 'offers'
  const [descricao, setDescricao] = useState('');
  const [categoria, setCategoria] = useState('');
  const [quickCallId, setQuickCallId] = useState(null);
  const [offers, setOffers] = useState([]);
  const [accepting, setAccepting] = useState(null);
  const [createError, setCreateError] = useState('');

  // Subscribe to incoming offers once quickCallId is set
  useEffect(() => {
    if (!quickCallId) return;

    const channel = supabase
      .channel(`qc-offers:${quickCallId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'quick_call_offers',
          filter: `quick_call_id=eq.${quickCallId}`,
        },
        async ({ new: offer }) => {
          // Enrich with provider info
          const { data: prov } = await supabase
            .from('prestadores')
            .select('avaliacao, categoria, users(nome, foto_url)')
            .eq('user_id', offer.prestador_id)
            .single();
          setOffers((prev) => [...prev, { ...offer, prov }]);
          setStep('offers');
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [quickCallId]);

  async function handleCreate() {
    setCreateError('');
    const { data, error } = await supabase
      .from('quick_calls')
      .insert({
        cliente_id: clientId,
        descricao,
        categoria: categoria || null,
        latitude: userLocation.lat,
        longitude: userLocation.lng,
        radius_km: 10,
      })
      .select('id')
      .single();

    if (error || !data) {
      setCreateError('Erro ao criar chamado. Tente novamente.');
      return;
    }

    setQuickCallId(data.id);
    setStep('waiting');

    // Broadcast to all connected providers
    await supabase.channel('quick-calls').send({
      type: 'broadcast',
      event: 'new-quick-call',
      payload: {
        quick_call_id: data.id,
        descricao,
        categoria: categoria || null,
        lat: userLocation.lat,
        lng: userLocation.lng,
        radius_km: 10,
      },
    });
  }

  async function handleAccept(offerId) {
    setAccepting(offerId);
    const { data, error } = await supabase.rpc('accept_quick_call_offer', {
      p_quick_call_id: quickCallId,
      p_offer_id: offerId,
      p_cliente_id: clientId,
    });
    if (error || !data?.success) {
      alert('Esta proposta não está mais disponível. Escolha outra.');
      setAccepting(null);
      return;
    }
    onClose();
  }

  async function handleCancel() {
    if (quickCallId) {
      await supabase
        .from('quick_calls')
        .update({ status: 'cancelled' })
        .eq('id', quickCallId);
    }
    onClose();
  }

  // ── Form step ──────────────────────────────────────────────
  if (step === 'form') {
    return (
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[9999] w-full max-w-sm rounded-2xl bg-white dark:bg-[#08141A] shadow-2xl border border-amber-400 p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Zap size={18} className="text-amber-400" />
            <h3 className="font-semibold">Chamado Rápido</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs text-[var(--text-600)] mb-1">
              Descreva o serviço *
            </label>
            <textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              rows={3}
              placeholder="Ex: Torneira vazando na cozinha..."
              className="w-full rounded-lg border px-3 py-2 text-sm dark:bg-gray-800 dark:border-gray-600 dark:text-white resize-none"
            />
          </div>

          <div>
            <label className="block text-xs text-[var(--text-600)] mb-1">
              Categoria (opcional)
            </label>
            <select
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
              className="w-full rounded-lg border px-3 py-2 text-sm dark:bg-gray-800 dark:border-gray-600 dark:text-white"
            >
              <option value="">Qualquer</option>
              {categorias.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {createError && (
            <p className="text-xs text-red-500">{createError}</p>
          )}

          <Button
            onClick={handleCreate}
            disabled={!descricao.trim()}
            className="w-full"
          >
            Solicitar agora
          </Button>
        </div>
      </div>
    );
  }

  // ── Waiting step ───────────────────────────────────────────
  if (step === 'waiting') {
    return (
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[9999] w-full max-w-sm rounded-2xl bg-white dark:bg-[#08141A] shadow-2xl border border-gray-200 dark:border-gray-700 p-5 text-center">
        <Loader2 size={32} className="mx-auto mb-3 text-[var(--teal-400)] animate-spin" />
        <p className="font-medium">Procurando prestadores próximos...</p>
        <p className="text-sm text-[var(--text-600)] mt-1">
          Aguardando propostas dos profissionais
        </p>
        <button
          onClick={handleCancel}
          className="mt-4 text-xs text-gray-400 hover:text-gray-600 underline"
        >
          Cancelar
        </button>
      </div>
    );
  }

  // ── Offers step ────────────────────────────────────────────
  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[9999] w-full max-w-sm rounded-2xl bg-white dark:bg-[#08141A] shadow-2xl border border-gray-200 dark:border-gray-700 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold">Propostas recebidas</h3>
        <button onClick={handleCancel} className="text-gray-400 hover:text-gray-600">
          <X size={18} />
        </button>
      </div>

      <div className="space-y-3 max-h-80 overflow-y-auto">
        {offers.map((offer) => (
          <div
            key={offer.id}
            className="rounded-xl border border-gray-200 dark:border-gray-700 p-3"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="font-medium text-sm">
                {offer.prov?.users?.nome ?? 'Prestador'}
              </span>
              {offer.prov?.avaliacao && (
                <span className="text-xs text-amber-400">
                  ★ {offer.prov.avaliacao.toFixed(1)}
                </span>
              )}
            </div>
            <p className="text-xs text-[var(--text-600)]">
              {offer.estimated_duration} min · R$ {offer.total_price?.toFixed(2)}
            </p>
            <Button
              size="sm"
              className="mt-2 w-full"
              onClick={() => handleAccept(offer.id)}
              disabled={accepting !== null}
            >
              {accepting === offer.id ? 'Aceitando...' : 'Aceitar'}
            </Button>
          </div>
        ))}
      </div>

      <button
        onClick={handleCancel}
        className="mt-3 w-full text-xs text-gray-400 hover:text-gray-600 underline"
      >
        Cancelar chamado
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

  ```bash
  npm run build
  ```

- [ ] **Step 3: Commit**

  ```bash
  git add src/components/QuickCallPanel.jsx
  git commit -m "feat: QuickCallPanel — client Quick Call creation and offer acceptance"
  ```

---

## Task 11 — ClientMap: Quick Call button + QuickCallPanel

**Files:**
- Modify: `src/pages/ClientMap.jsx`

- [ ] **Step 1: Import QuickCallPanel**

  Add at top of `ClientMap.jsx`:
  ```js
  import QuickCallPanel from '../components/QuickCallPanel';
  ```

- [ ] **Step 2: Add quickCallOpen state in MapContent**

  ```js
  const [quickCallOpen, setQuickCallOpen] = useState(false);
  ```

- [ ] **Step 3: Add Quick Call button to the map UI**

  In the map container JSX (the `<GoogleMap>` wrapper or inside the relative container that holds the map), add a floating button. Place it after the map element:
  ```jsx
  {/* Quick Call trigger */}
  <button
    onClick={() => setQuickCallOpen(true)}
    className="absolute bottom-6 right-4 z-[1000] flex items-center gap-2 rounded-full bg-amber-400 hover:bg-amber-500 text-white font-semibold px-4 py-2.5 shadow-lg transition"
  >
    <Zap size={16} />
    Chamado Rápido
  </button>
  ```

  Add the `Zap` icon import if not already present:
  ```js
  import { Zap } from 'lucide-react';
  ```

- [ ] **Step 4: Render QuickCallPanel conditionally**

  Inside the same relative container, add:
  ```jsx
  {quickCallOpen && (
    <QuickCallPanel
      userLocation={userLocation}
      clientId={profile.id}
      categorias={categorias}
      onClose={() => setQuickCallOpen(false)}
    />
  )}
  ```

  > `categorias` state is already available from Task 7. `profile` comes from `useAuth` — ensure it is destructured in `MapContent`'s props or accessed via the hook.

- [ ] **Step 5: Verify build**

  ```bash
  npm run build
  ```

- [ ] **Step 6: Manual smoke test (dev server)**

  ```bash
  npm run dev
  ```

  Golden path:
  1. Log in as a provider → go online → verify position updates every 50 m move (check Supabase Table Editor → `prestadores.last_location`).
  2. Log in as a client → open `/mapa` → confirm map loads providers with teal (online) markers.
  3. Apply category filter → list re-fetches with filtered results.
  4. Click "Chamado Rápido" → fill form → submit → panel shows waiting state.
  5. In a second session (provider) → watch for FlashAlert → enter duration → submit offer.
  6. Client sees offer → click Accept → confirm `quick_calls.status = 'locked'` in DB.
  7. Open ProviderDashboard → Agenda tab → confirm accepted booking shows as a red busy block in today's row.

- [ ] **Step 7: Commit**

  ```bash
  git add src/pages/ClientMap.jsx
  git commit -m "feat: ClientMap — Quick Call button and QuickCallPanel integration"
  ```

---

## Self-review against spec

| Spec requirement | Covered by |
|---|---|
| `is_online` bool on prestadores | Task 1 (migration), Task 4 (ProviderDashboard sync) |
| `hourly_rate` on prestadores | Task 1 |
| `last_location` geography(POINT,4326) | Task 1 + Task 3 (useLocationSync) |
| `estimated_duration`, `total_price`, `type` on solicitacoes | Task 1 |
| RLS: providers update own `last_location` + `is_online` | Task 1 (row-level policy) |
| Implicit availability (08:00-18:00) | Task 5 (AgendaCalendar shows green "Disponível") |
| Visual busy blocks from confirmed bookings | Task 5 (AgendaCalendar red blocks) |
| Conflict prevention for client (datetime filter) | Task 1 (RPC checks overlapping solicitacoes) |
| watchPosition only when online | Task 3 (useLocationSync effect gate) |
| DB update only if moved > 50m | Task 3 (haversineDistance check) |
| Client location shared for search | LocationGate already provides GPS; passed as `userLocation` |
| Quick Call request creation | Task 10 (QuickCallPanel form step) |
| PostGIS radius matching online providers | Task 1 (get_nearby_providers uses ST_DWithin + is_online) |
| Provider Flash Alert via Broadcast | Task 8 (FlashAlert) + Task 9 (mounted in ProviderDashboard) |
| Provider submits estimated_duration | Task 8 (FlashAlert form) |
| total_price = hourly_rate × duration | Task 8 (computed in FlashAlert), Task 1 (stored in quick_call_offers) |
| Client accepts offer | Task 10 (QuickCallPanel offers step) |
| Race condition prevention (first accept locks) | Task 1 (accept_quick_call_offer atomic SQL) |
| Distance radius, category, hourly_rate filters | Task 7 (ClientMap sidebar + updated RPC params) |
| Sort by rating + proximity | Task 1 (ORDER BY distance_km, avaliacao in RPCs) |
| Online/offline marker colour | Task 7 (ProviderMarker isOnline prop) |
| Supabase Realtime Broadcast (no polling) | Tasks 8, 10 (Broadcast for Quick Call) |

All spec requirements are covered. No placeholders remain.
