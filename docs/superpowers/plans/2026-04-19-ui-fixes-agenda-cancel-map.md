# UI Fixes — Agenda, Cancelamento, Mapa Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the provider agenda as a readable day-list schedule, add cancellation for both provider and client, and restructure ClientMap into two clean tabs (Mapa fullscreen + Busca com lista).

**Architecture:** Three independent sub-areas. Agenda and cancellation are provider/client dashboard changes. ClientMap gets a tab-based layout: the map tab is fullscreen with a bottom-sheet Quick Call flow (Uber-like status feed), the busca tab is a scrollable provider list with collapsible filters extracted into a new `BuscaTab` component. `QuickCallPanel` is fully rewritten as a bottom sheet.

**Tech Stack:** React 19 + Vite + Tailwind CSS 3 + Supabase v2 + @react-google-maps/api + lucide-react

**Prerequisite:** Migration `005_admin_tipo.sql` must be applied (Plan 1 complete) — it adds `'cancelada'` to `solicitacoes.status`.

---

## File Map

| Action | File | Responsibility |
|--------|------|---------------|
| **Rewrite** | `src/components/AgendaCalendar.jsx` | Day-list schedule with booking cards, status badges, inline cancel confirm |
| **Modify** | `src/pages/ClientDashboard.jsx` | Cancel buttons on Propostas + Histórico tabs, `'cancelada'` badge |
| **Create** | `src/components/BuscaTab.jsx` | Provider list with collapsible filters, agendar callback |
| **Rewrite** | `src/components/QuickCallPanel.jsx` | Bottom sheet with 3-phase Uber-like status feed |
| **Restructure** | `src/pages/ClientMap.jsx` | Tab nav (Mapa|Busca), fullscreen map tab, integrates BuscaTab + new QuickCallPanel |
| **Modify** | `CLAUDE.md` | Update completed work and pending sections |

---

## Task 1 — AgendaCalendar: full rewrite

**Files:**
- Rewrite: `src/components/AgendaCalendar.jsx`

- [ ] **Step 1: Rewrite AgendaCalendar.jsx**

```jsx
// src/components/AgendaCalendar.jsx
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { ChevronLeft, ChevronRight, AlertCircle } from 'lucide-react';

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

function fmtTime(iso) {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function fmtDayHeader(date) {
  return date.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
}

const STATUS_BADGE = {
  pendente: { label: 'Pendente', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
  aceita:   { label: 'Confirmado', cls: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' },
};

export default function AgendaCalendar({ prestadorId }) {
  const [weekOffset, setWeekOffset] = useState(0);
  const [bookings, setBookings] = useState([]);
  const [confirmingId, setConfirmingId] = useState(null);
  const [cancelling, setCancelling] = useState(null);

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
        'id, data_desejada, estimated_duration, descricao, status, users!solicitacoes_cliente_id_fkey(nome)'
      )
      .eq('prestador_id', prestadorId)
      .in('status', ['pendente', 'aceita'])
      .gte('data_desejada', weekStart)
      .lte('data_desejada', weekEnd)
      .order('data_desejada', { ascending: true });
    setBookings(data || []);
  }, [prestadorId, weekStart, weekEnd]);

  useEffect(() => { load(); }, [load]);

  async function handleCancel(id) {
    setCancelling(id);
    await supabase.from('solicitacoes').update({ status: 'cancelada' }).eq('id', id);
    setBookings(prev => prev.filter(b => b.id !== id));
    setConfirmingId(null);
    setCancelling(null);
  }

  function bookingsForDay(day) {
    return bookings.filter(
      b => new Date(b.data_desejada).toDateString() === day.toDateString()
    );
  }

  const todayStr = new Date(new Date().setHours(0, 0, 0, 0)).toDateString();

  return (
    <div>
      {/* Week navigation */}
      <div className="flex items-center justify-between mb-5">
        <button
          onClick={() => setWeekOffset(w => w - 1)}
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition"
        >
          <ChevronLeft size={18} />
        </button>
        <span className="text-sm font-semibold text-[var(--text-600)]">
          {days[0].toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })}
          {' – '}
          {days[6].toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' })}
        </span>
        <button
          onClick={() => setWeekOffset(w => w + 1)}
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      <div className="space-y-1">
        {days.map(day => {
          const dayBookings = bookingsForDay(day);
          const dayStr = day.toDateString();
          const isToday = dayStr === todayStr;
          const isPast = day < new Date(new Date().setHours(0, 0, 0, 0));

          return (
            <div key={day.toISOString()} className={isPast ? 'opacity-60' : ''}>
              {/* Day header */}
              <div className={`flex items-center gap-2 px-1 py-2 ${isToday ? 'text-[var(--teal-400)]' : 'text-[var(--text-600)]'}`}>
                <span className="text-xs font-bold uppercase tracking-wider capitalize">
                  {fmtDayHeader(day)}
                </span>
                {isToday && (
                  <span className="text-xs bg-[var(--teal-400)] text-white rounded-full px-2 py-0.5 font-medium">
                    Hoje
                  </span>
                )}
              </div>

              {dayBookings.length === 0 ? (
                <p className="ml-1 mb-4 text-xs text-gray-400 dark:text-gray-600 italic">
                  Sem agendamentos
                </p>
              ) : (
                <div className="space-y-2 mb-4">
                  {dayBookings.map(b => {
                    const endMs =
                      new Date(b.data_desejada).getTime() +
                      (b.estimated_duration ?? 60) * 60_000;
                    const badge = STATUS_BADGE[b.status] ?? STATUS_BADGE.pendente;
                    const isConfirming = confirmingId === b.id;
                    const isCancelling = cancelling === b.id;

                    return (
                      <div
                        key={b.id}
                        className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#0f1f28] p-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <span className="text-sm font-mono font-semibold text-[var(--text-900)]">
                                {fmtTime(b.data_desejada)} – {fmtTime(new Date(endMs).toISOString())}
                              </span>
                              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${badge.cls}`}>
                                {badge.label}
                              </span>
                            </div>
                            <p className="text-sm font-semibold text-[var(--text-900)] truncate">
                              {b.users?.nome ?? 'Cliente'}
                            </p>
                            <p className="text-xs text-[var(--text-600)] mt-0.5 line-clamp-2">
                              {b.descricao}
                            </p>
                          </div>

                          {!isConfirming && (
                            <button
                              onClick={() => setConfirmingId(b.id)}
                              className="shrink-0 text-xs text-red-500 border border-red-300 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg px-2 py-1.5 transition"
                            >
                              Cancelar
                            </button>
                          )}
                        </div>

                        {isConfirming && (
                          <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-800 flex items-center gap-2">
                            <AlertCircle size={14} className="text-amber-500 shrink-0" />
                            <span className="text-xs text-[var(--text-600)] flex-1">
                              Tem certeza que deseja cancelar?
                            </span>
                            <button
                              onClick={() => setConfirmingId(null)}
                              className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 px-2 py-1 transition"
                            >
                              Não
                            </button>
                            <button
                              onClick={() => handleCancel(b.id)}
                              disabled={isCancelling}
                              className="text-xs text-white bg-red-500 hover:bg-red-600 disabled:opacity-50 rounded-lg px-3 py-1 transition"
                            >
                              {isCancelling ? 'Cancelando...' : 'Sim, cancelar'}
                            </button>
                          </div>
                        )}
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
  Expected: success.

- [ ] **Step 3: Commit**

  ```bash
  git add src/components/AgendaCalendar.jsx
  git commit -m "feat: AgendaCalendar — day-list view with booking cards, status badges, inline cancel"
  ```

---

## Task 2 — ClientDashboard: cancel buttons + cancelada badge

**Files:**
- Modify: `src/pages/ClientDashboard.jsx`

Read the file before making changes.

- [ ] **Step 1: Read ClientDashboard.jsx**

  ```bash
  cat -n /Users/johanstrombergrecaman/Documents/github/HomeFix/src/pages/ClientDashboard.jsx
  ```

- [ ] **Step 2: Add handleCancel function**

  Inside the `ClientDashboard` component (or the relevant sub-component), add this function alongside the existing fetch/action functions:

  ```js
  async function handleCancel(id) {
    await supabase.from('solicitacoes').update({ status: 'cancelada' }).eq('id', id);
    // Refetch both tabs to reflect the change
    fetchPropostas();
    fetchHistorico();
  }
  ```

  > If `fetchPropostas` and `fetchHistorico` don't exist as named functions, extract the fetch logic from the existing `useEffect` calls into named async functions and call them from both `useEffect` and `handleCancel`.

- [ ] **Step 3: Add cancel button to Propostas tab (pendente cards)**

  In the JSX that renders each `pendente` proposal card, add a cancel button after the existing content:

  ```jsx
  {/* Inside each pendente card, after the status badge */}
  <button
    onClick={() => handleCancel(sol.id)}
    className="mt-2 text-xs text-red-500 border border-red-300 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg px-3 py-1.5 transition"
  >
    Cancelar solicitação
  </button>
  ```

- [ ] **Step 4: Add cancel button to Histórico tab (aceita cards only)**

  In the JSX that renders each `aceita` card in the Histórico tab, add a cancel button with a stronger confirmation message:

  ```jsx
  {/* Inside each aceita card in Histórico */}
  {sol.status === 'aceita' && (
    <button
      onClick={() => {
        if (window.confirm('Este serviço já foi aceito pelo prestador. Deseja cancelar mesmo assim?')) {
          handleCancel(sol.id);
        }
      }}
      className="mt-2 text-xs text-red-500 border border-red-300 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg px-3 py-1.5 transition"
    >
      Cancelar serviço
    </button>
  )}
  ```

- [ ] **Step 5: Add cancelada badge**

  Find the section that maps status to badge styles. Add the `cancelada` case:

  ```jsx
  // In whatever status→style map or conditional exists, add:
  // cancelada → gray
  const statusBadge = {
    pendente:  { label: 'Pendente',  cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
    aceita:    { label: 'Aceita',    cls: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300' },
    recusada:  { label: 'Recusada',  cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' },
    cancelada: { label: 'Cancelado', cls: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' },
  };
  ```

  Ensure the Histórico fetch query includes `'cancelada'` status:
  ```js
  .in('status', ['aceita', 'recusada', 'cancelada'])
  ```

- [ ] **Step 6: Verify build**

  ```bash
  npm run build
  ```

- [ ] **Step 7: Commit**

  ```bash
  git add src/pages/ClientDashboard.jsx
  git commit -m "feat: ClientDashboard — cancel buttons for provider and client, cancelada badge"
  ```

---

## Task 3 — BuscaTab new component

**Files:**
- Create: `src/components/BuscaTab.jsx`

- [ ] **Step 1: Create BuscaTab.jsx**

```jsx
// src/components/BuscaTab.jsx
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { SlidersHorizontal, ChevronDown, Loader2, Search } from 'lucide-react';

export default function BuscaTab({ userLocation, categorias, onAgendar }) {
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filterCategoria, setFilterCategoria] = useState('');
  const [minRate, setMinRate] = useState('');
  const [maxRate, setMaxRate] = useState('');
  const [radius, setRadius] = useState(10);
  const [sortBy, setSortBy] = useState('distance');

  const search = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc('get_nearby_providers', {
      lat: userLocation.lat,
      lng: userLocation.lng,
      radius_km: radius,
      filter_categoria: filterCategoria || null,
      min_hourly_rate: minRate ? parseFloat(minRate) : null,
      max_hourly_rate: maxRate ? parseFloat(maxRate) : null,
    });
    if (error) { console.error(error); setLoading(false); return; }
    let results = (data || []).map(p => ({ ...p, foto_url: p.foto_url ?? p.user_foto_url }));
    if (sortBy === 'rating') {
      results = [...results].sort((a, b) => (b.avaliacao ?? 0) - (a.avaliacao ?? 0));
    }
    setProviders(results);
    setLoading(false);
  }, [userLocation, radius, filterCategoria, minRate, maxRate, sortBy]);

  useEffect(() => { search(); }, [search]);

  return (
    <div className="flex flex-col flex-1 overflow-hidden h-full">
      {/* Collapsible filters */}
      <div className="bg-white dark:bg-[#08141A] border-b border-gray-200 dark:border-gray-700 shrink-0">
        <button
          onClick={() => setFiltersOpen(f => !f)}
          className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-[var(--text-900)]"
        >
          <div className="flex items-center gap-2">
            <SlidersHorizontal size={15} />
            Filtros
            {(filterCategoria || minRate || maxRate || radius !== 10) && (
              <span className="text-xs bg-[var(--teal-400)] text-white rounded-full px-1.5 py-0.5">
                ●
              </span>
            )}
          </div>
          <ChevronDown
            size={16}
            className={`transition-transform duration-200 ${filtersOpen ? 'rotate-180' : ''}`}
          />
        </button>

        {filtersOpen && (
          <div className="px-4 pb-4 grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-[var(--text-600)] block mb-1">Categoria</label>
              <select
                value={filterCategoria}
                onChange={e => setFilterCategoria(e.target.value)}
                className="w-full border rounded-lg px-2 py-2 text-sm dark:bg-gray-800 dark:border-gray-600 dark:text-white"
              >
                <option value="">Todas</option>
                {categorias.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div>
              <label className="text-xs text-[var(--text-600)] block mb-1">Distância</label>
              <select
                value={radius}
                onChange={e => setRadius(Number(e.target.value))}
                className="w-full border rounded-lg px-2 py-2 text-sm dark:bg-gray-800 dark:border-gray-600 dark:text-white"
              >
                {[2, 5, 10, 20, 50].map(r => (
                  <option key={r} value={r}>{r} km</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs text-[var(--text-600)] block mb-1">Valor/hora (R$)</label>
              <div className="flex gap-1">
                <input
                  type="number" min="0" placeholder="Mín" value={minRate}
                  onChange={e => setMinRate(e.target.value)}
                  className="w-1/2 border rounded-lg px-2 py-2 text-sm dark:bg-gray-800 dark:border-gray-600 dark:text-white"
                />
                <input
                  type="number" min="0" placeholder="Máx" value={maxRate}
                  onChange={e => setMaxRate(e.target.value)}
                  className="w-1/2 border rounded-lg px-2 py-2 text-sm dark:bg-gray-800 dark:border-gray-600 dark:text-white"
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-[var(--text-600)] block mb-1">Ordenar por</label>
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value)}
                className="w-full border rounded-lg px-2 py-2 text-sm dark:bg-gray-800 dark:border-gray-600 dark:text-white"
              >
                <option value="distance">Distância</option>
                <option value="rating">Avaliação</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Provider list */}
      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="flex justify-center py-12">
            <Loader2 size={28} className="animate-spin text-[var(--teal-400)]" />
          </div>
        )}

        {!loading && providers.length === 0 && (
          <div className="flex flex-col items-center py-16 text-[var(--text-600)]">
            <Search size={36} className="mb-3 opacity-25" />
            <p className="text-sm">Nenhum prestador encontrado</p>
            <p className="text-xs mt-1 opacity-60">Tente aumentar o raio de busca</p>
          </div>
        )}

        {!loading && providers.length > 0 && (
          <div className="p-4 space-y-3">
            {providers.map(p => (
              <div
                key={p.user_id}
                className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#0f1f28] p-3 flex items-center gap-3"
              >
                {/* Avatar */}
                <div className="w-12 h-12 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden shrink-0 flex items-center justify-center">
                  {p.foto_url ? (
                    <img src={p.foto_url} alt={p.nome} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-lg font-bold text-gray-500 dark:text-gray-400">
                      {p.nome?.[0]?.toUpperCase() ?? '?'}
                    </span>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <p className="font-semibold text-sm truncate text-[var(--text-900)]">{p.nome}</p>
                    {p.avaliacao != null && (
                      <span className="text-xs text-amber-400 shrink-0 font-medium">
                        ★ {Number(p.avaliacao).toFixed(1)}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[var(--text-600)]">
                    {p.categoria}
                    {p.distance_km != null && ` · ${Number(p.distance_km).toFixed(1)} km`}
                  </p>
                  {p.hourly_rate != null && (
                    <p className="text-xs font-medium text-[var(--teal-400)] mt-0.5">
                      R$ {Number(p.hourly_rate).toFixed(0)}/h
                    </p>
                  )}
                </div>

                {/* CTA */}
                <button
                  onClick={() => onAgendar(p)}
                  className="shrink-0 text-xs font-semibold bg-[var(--teal-400)] hover:opacity-90 text-white rounded-xl px-3 py-2 transition"
                >
                  Agendar
                </button>
              </div>
            ))}
          </div>
        )}
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
  git add src/components/BuscaTab.jsx
  git commit -m "feat: BuscaTab — provider list with collapsible filters"
  ```

---

## Task 4 — QuickCallPanel: rewrite as bottom sheet with status feed

**Files:**
- Rewrite: `src/components/QuickCallPanel.jsx`

The current QuickCallPanel is a centered overlay. Replace it entirely with a bottom sheet that shows a live Uber-like status feed.

- [ ] **Step 1: Rewrite QuickCallPanel.jsx**

```jsx
// src/components/QuickCallPanel.jsx
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Button } from './Button';
import { Zap, X, Loader2, CheckCircle2 } from 'lucide-react';

export default function QuickCallPanel({ userLocation, clientId, categorias, onClose }) {
  const [step, setStep] = useState('form');       // 'form' | 'live'
  const [descricao, setDescricao] = useState('');
  const [categoria, setCategoria] = useState('');
  const [quickCallId, setQuickCallId] = useState(null);
  const [feed, setFeed] = useState([]);
  const [accepting, setAccepting] = useState(null);
  const [createError, setCreateError] = useState('');

  // Subscribe to offers once quickCallId is set
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
          const { data: prov } = await supabase
            .from('prestadores')
            .select('avaliacao, categoria, users(nome)')
            .eq('user_id', offer.prestador_id)
            .single();

          const nome = prov?.users?.nome ?? 'Prestador';

          setFeed(prev => [
            ...prev,
            { type: 'received', text: `${nome} recebeu sua solicitação` },
            {
              type: 'offer',
              text: `${nome} enviou uma proposta`,
              offerId: offer.id,
              prestadorNome: nome,
              avaliacao: prov?.avaliacao,
              estimated_duration: offer.estimated_duration,
              total_price: offer.total_price,
            },
          ]);
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
    setFeed([
      { type: 'system', text: 'Solicitação enviada' },
      { type: 'waiting', text: 'Procurando prestadores próximos...' },
    ]);
    setStep('live');

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

  const hasOffers = feed.some(f => f.type === 'offer');

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col justify-end">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 transition-opacity"
        onClick={() => step === 'form' && onClose()}
      />

      {/* Sheet */}
      <div className="relative bg-white dark:bg-[#08141A] rounded-t-2xl max-h-[85vh] flex flex-col shadow-2xl">
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 bg-gray-200 dark:bg-gray-700 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 dark:border-gray-800 shrink-0">
          <div className="flex items-center gap-2">
            <Zap size={18} className="text-amber-400" />
            <h3 className="font-semibold text-[var(--text-900)]">
              {step === 'form' ? 'Chamada Rápida' : 'Chamada Rápida em andamento'}
            </h3>
          </div>
          {step === 'form' ? (
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X size={18} />
            </button>
          ) : (
            <button
              onClick={handleCancel}
              className="text-xs text-red-500 border border-red-300 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg px-3 py-1.5 transition"
            >
              Cancelar
            </button>
          )}
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {/* ── Form ── */}
          {step === 'form' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[var(--text-600)] mb-1">
                  Descreva o serviço *
                </label>
                <textarea
                  value={descricao}
                  onChange={e => setDescricao(e.target.value)}
                  rows={3}
                  placeholder="Ex: Torneira vazando na cozinha..."
                  className="w-full rounded-xl border border-gray-200 dark:border-gray-700 px-3 py-2 text-sm dark:bg-gray-800 dark:text-white resize-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--text-600)] mb-1">
                  Categoria (opcional)
                </label>
                <select
                  value={categoria}
                  onChange={e => setCategoria(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 dark:border-gray-700 px-3 py-2 text-sm dark:bg-gray-800 dark:text-white"
                >
                  <option value="">Qualquer</option>
                  {categorias.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              {createError && <p className="text-xs text-red-500">{createError}</p>}
              <Button onClick={handleCreate} disabled={!descricao.trim()} className="w-full">
                Solicitar agora
              </Button>
            </div>
          )}

          {/* ── Live feed ── */}
          {step === 'live' && (
            <div className="space-y-3">
              {feed.map((item, i) => {
                if (item.type === 'system') {
                  return (
                    <div key={i} className="flex items-center gap-3">
                      <CheckCircle2 size={16} className="text-green-500 shrink-0" />
                      <span className="text-sm text-[var(--text-600)]">{item.text}</span>
                    </div>
                  );
                }

                if (item.type === 'waiting') {
                  return (
                    <div key={i} className="flex items-center gap-3">
                      <Loader2 size={16} className={`shrink-0 text-[var(--teal-400)] ${!hasOffers ? 'animate-spin' : ''}`} />
                      <span className="text-sm text-[var(--text-600)]">{item.text}</span>
                    </div>
                  );
                }

                if (item.type === 'received') {
                  return (
                    <div key={i} className="flex items-center gap-3 pl-1">
                      <span className="text-xs text-gray-400">—</span>
                      <span className="text-sm text-[var(--text-600)]">{item.text}</span>
                    </div>
                  );
                }

                if (item.type === 'offer') {
                  return (
                    <div key={i} className="rounded-xl border border-[var(--teal-400)]/30 bg-teal-50/40 dark:bg-teal-900/10 p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-semibold text-[var(--text-900)]">
                          {item.prestadorNome}
                        </span>
                        {item.avaliacao != null && (
                          <span className="text-xs text-amber-400 font-medium">
                            ★ {Number(item.avaliacao).toFixed(1)}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[var(--text-600)] mb-2">
                        {item.estimated_duration} min · R$ {Number(item.total_price).toFixed(2)}
                      </p>
                      <Button
                        size="sm"
                        className="w-full"
                        onClick={() => handleAccept(item.offerId)}
                        disabled={accepting !== null}
                      >
                        {accepting === item.offerId ? 'Aceitando...' : 'Aceitar →'}
                      </Button>
                    </div>
                  );
                }

                return null;
              })}
            </div>
          )}
        </div>
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
  git add src/components/QuickCallPanel.jsx
  git commit -m "feat: QuickCallPanel — bottom sheet with Uber-like status feed"
  ```

---

## Task 5 — ClientMap: tab navigation + map tab restructure

**Files:**
- Restructure: `src/pages/ClientMap.jsx`

Read the current file fully before starting — it is ~476 lines and its structure must be understood before editing.

- [ ] **Step 1: Read the current ClientMap.jsx**

  ```bash
  cat -n /Users/johanstrombergrecaman/Documents/github/HomeFix/src/pages/ClientMap.jsx
  ```

- [ ] **Step 2: Add new imports to MapContent**

  At the top of `ClientMap.jsx`, add these imports alongside the existing ones:

  ```js
  import { Map, Search, Zap } from 'lucide-react';
  import BuscaTab from '../components/BuscaTab';
  ```

  > `Zap` may already be imported — check first and skip if so.

- [ ] **Step 3: Add activeTab state and remove old sidebar/filter state from MapContent**

  Inside `MapContent`, add:
  ```js
  const [activeTab, setActiveTab] = useState('mapa');
  ```

  Remove these state vars from MapContent (they move into BuscaTab):
  ```js
  // DELETE these from MapContent state:
  // filterCategoria, minRate, maxRate, dateFilter
  // (keep: radius, providers, selected, infoOpen, soliciting, sent, quickCallOpen, categorias)
  ```

  Also remove the useEffect that debounced on filterCategoria/minRate/maxRate since BuscaTab handles its own fetching.

- [ ] **Step 4: Simplify fetchNearbyProviders in MapContent**

  The map tab only shows all online providers by radius, no filters. Update the function:

  ```js
  async function fetchNearbyProviders(lat, lng, radiusKm) {
    const { data, error } = await supabase.rpc('get_nearby_providers', {
      lat,
      lng,
      radius_km: radiusKm,
    });
    if (error) { console.error(error); return; }
    setProviders(
      (data || []).map(p => ({ ...p, foto_url: p.foto_url ?? p.user_foto_url }))
    );
  }
  ```

  Remove `fetchProvidersWithAvailability` from MapContent — date-based filtering is gone from the map tab. The debounce effect should now only watch `radius`.

- [ ] **Step 5: Replace the return JSX of MapContent**

  Replace the entire return JSX of `MapContent` with this structure. Keep `SolicitacaoModal` and `isLoaded` / map config exactly as they were — only the layout shell changes.

  ```jsx
  return (
    <div className="flex flex-col h-screen bg-white dark:bg-[#08141A]">
      {/* Tab navigation */}
      <div className="flex border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-[#08141A] shrink-0">
        <button
          onClick={() => setActiveTab('mapa')}
          className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 transition border-b-2 ${
            activeTab === 'mapa'
              ? 'border-[var(--teal-400)] text-[var(--teal-400)]'
              : 'border-transparent text-[var(--text-600)] hover:text-[var(--text-900)]'
          }`}
        >
          <Map size={15} />
          Mapa
        </button>
        <button
          onClick={() => setActiveTab('busca')}
          className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 transition border-b-2 ${
            activeTab === 'busca'
              ? 'border-[var(--teal-400)] text-[var(--teal-400)]'
              : 'border-transparent text-[var(--text-600)] hover:text-[var(--text-900)]'
          }`}
        >
          <Search size={15} />
          Busca
        </button>
      </div>

      {/* ── Mapa tab ── */}
      {activeTab === 'mapa' && (
        <div className="relative flex-1">
          {!isLoaded ? (
            <MapSkeleton />
          ) : (
            <GoogleMap
              mapContainerStyle={{ width: '100%', height: '100%' }}
              center={userLocation}
              zoom={13}
              options={MAP_OPTIONS}
              onLoad={map => { mapRef.current = map; }}
            >
              {providers.map(p => (
                <ProviderMarker
                  key={p.user_id}
                  provider={p}
                  isOnline={p.is_online ?? true}
                  isSelected={selected?.user_id === p.user_id}
                  onClick={() => { setSelected(p); setInfoOpen(p); }}
                />
              ))}

              {infoOpen && (
                <InfoWindow
                  position={{ lat: infoOpen.latitude, lng: infoOpen.longitude }}
                  onCloseClick={() => setInfoOpen(null)}
                >
                  {/* Keep the existing InfoWindow content / ProviderInfoWindow component */}
                  <ProviderInfoWindow
                    provider={infoOpen}
                    onSolicitar={() => { setSoliciting(infoOpen); setInfoOpen(null); }}
                  />
                </InfoWindow>
              )}
            </GoogleMap>
          )}

          {/* Floating radius pill */}
          <div className="absolute top-3 right-3 z-10">
            <select
              value={radius}
              onChange={e => setRadius(Number(e.target.value))}
              className="bg-white/90 dark:bg-[#08141A]/90 backdrop-blur border border-gray-200 dark:border-gray-700 rounded-full px-3 py-1.5 text-sm shadow-md text-[var(--text-900)]"
            >
              {[2, 5, 10, 20, 50].map(r => (
                <option key={r} value={r}>📍 {r} km</option>
              ))}
            </select>
          </div>

          {/* Chamada Rápida button — full width at bottom */}
          <div className="absolute bottom-0 left-0 right-0 p-4">
            <button
              onClick={() => setQuickCallOpen(true)}
              className="w-full bg-amber-400 hover:bg-amber-500 active:bg-amber-600 text-white font-semibold py-3.5 rounded-2xl flex items-center justify-center gap-2 shadow-lg transition"
            >
              <Zap size={18} />
              Chamada Rápida
            </button>
          </div>

          {/* Quick Call bottom sheet */}
          {quickCallOpen && (
            <QuickCallPanel
              userLocation={userLocation}
              clientId={profile?.id}
              categorias={categorias}
              onClose={() => setQuickCallOpen(false)}
            />
          )}
        </div>
      )}

      {/* ── Busca tab ── */}
      {activeTab === 'busca' && (
        <BuscaTab
          userLocation={userLocation}
          categorias={categorias}
          onAgendar={provider => setSoliciting(provider)}
        />
      )}

      {/* Solicitation modal — shared between both tabs */}
      {soliciting && (
        <SolicitacaoModal
          provider={soliciting}
          clientId={profile?.id}
          onClose={() => setSoliciting(null)}
          onSent={() => { setSent(true); setSoliciting(null); }}
        />
      )}

      {sent && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] bg-[var(--teal-400)] text-white rounded-2xl px-5 py-3 shadow-xl text-sm font-medium">
          Proposta enviada!
        </div>
      )}
    </div>
  );
  ```

  > **Important:** The `MAP_OPTIONS`, `mapRef`, `GoogleMap`, `InfoWindow`, `ProviderMarker`, `ProviderInfoWindow`, `SolicitacaoModal`, and `MapSkeleton` references must match what already exists in the file. Read the current file and adapt — don't invent new component names. The `profile` reference comes from `const { profile } = useAuth()` which should already be in MapContent.

- [ ] **Step 6: Remove the old sidebar JSX**

  Delete the sidebar `<div>` that contained the provider list, radius slider, datetime filter, category/hourly-rate inputs — all of that is now in BuscaTab.

- [ ] **Step 7: Verify build**

  ```bash
  npm run build
  ```
  Expected: success. Fix any import errors before committing.

- [ ] **Step 8: Commit**

  ```bash
  git add src/pages/ClientMap.jsx
  git commit -m "feat: ClientMap — tab layout (Mapa fullscreen + Busca), Quick Call bottom sheet"
  ```

---

## Task 6 — Update CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update Completed Work section**

  Add to the completed work block:

  ```markdown
  Plan 2 complete: AgendaCalendar rebuilt (day-list, booking cards, inline cancel). ClientDashboard has cancel flow. ClientMap restructured into Mapa tab (fullscreen + Chamada Rápida bottom sheet) and Busca tab (BuscaTab component with filters).
  ```

- [ ] **Step 2: Update solicitacoes schema note**

  Ensure the `solicitacoes` line in Key tables reads:
  ```markdown
  - `solicitacoes` — `id, cliente_id, prestador_id, descricao, data_desejada, valor_oferecido, estimated_duration (int, minutes), total_price, type ('scheduled'|'quick_call'), status ('pendente'|'aceita'|'recusada'|'cancelada'), created_at`
  ```

- [ ] **Step 3: Update Map section**

  Replace the ClientMap architecture note with:
  ```markdown
  `/mapa` uses two tabs: **Mapa** (fullscreen GoogleMap + floating radius pill + Chamada Rápida bottom sheet via `QuickCallPanel`) and **Busca** (`BuscaTab` component — provider list with collapsible filters). Both tabs share `SolicitacaoModal` for scheduling.
  ```

- [ ] **Step 4: Commit**

  ```bash
  git add CLAUDE.md
  git commit -m "docs: CLAUDE.md — reflect UI fixes completion"
  ```

---

## Self-review against spec

| Spec requirement | Task |
|---|---|
| AgendaCalendar day-list with booking cards (time, client, description) | Task 1 |
| Status badges (pendente=âmbar, aceita=verde) | Task 1 |
| Inline cancel confirm on each booking card | Task 1 |
| Optimistic card removal on cancel | Task 1 |
| Client cancel on Propostas tab (pendente) | Task 2 |
| Client cancel on Histórico tab (aceita, with extra confirm) | Task 2 |
| `cancelada` badge (gray) in Histórico | Task 2 |
| Histórico query includes `cancelada` | Task 2 |
| BuscaTab: provider list with cards (foto, nome, categoria, distância, hourly_rate, avaliação) | Task 3 |
| BuscaTab: collapsible filters (categoria, distância, valor/hora, ordenar) | Task 3 |
| Filter active indicator on the Filtros button | Task 3 |
| QuickCallPanel as bottom sheet (not floating overlay) | Task 4 |
| Phase 1: form (descrição + categoria) | Task 4 |
| Phase 2 live feed: system messages + received + offer cards with Aceitar | Task 4 |
| Backdrop closes sheet when on form step | Task 4 |
| ClientMap tab nav (Mapa | Busca) with teal underline | Task 5 |
| Map tab fullscreen with floating radius pill | Task 5 |
| Chamada Rápida full-width amber button at bottom | Task 5 |
| BuscaTab integrated in Busca tab | Task 5 |
| SolicitacaoModal shared between both tabs | Task 5 |
| CLAUDE.md updated | Task 6 |
