# HomeFix Fixes — Design Spec

**Date:** 2026-04-19  
**Branch base:** `feat/homefix-v3-realtime-quickcall`  
**Scope:** Two sequential implementation plans.

---

## Plano 1 — Admin Role Refactor

### Goal
Remove `is_admin boolean` from `users`. Admin identity becomes `users.tipo = 'admin'` — a third value alongside `'cliente'` and `'prestador'`.

### Database

**Migration `005_admin_tipo.sql`:**

```sql
-- 1. Allow 'admin' as a valid tipo value
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_tipo_check;
ALTER TABLE users ADD CONSTRAINT users_tipo_check
  CHECK (tipo IN ('cliente', 'prestador', 'admin'));

-- 2. Migrate existing admins
UPDATE users SET tipo = 'admin' WHERE is_admin = true;

-- 3. Drop the is_admin column
ALTER TABLE users DROP COLUMN IF EXISTS is_admin;

-- 4. Rewrite is_admin() helper used by RLS policies
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND tipo = 'admin'
  );
$$;
```

All existing RLS policies that call `is_admin()` continue to work unchanged — only the function body changes.

### Frontend

| File | Change |
|------|--------|
| `src/hooks/useAuth.js` | Remove `is_admin` from the `users` select query and from the returned `profile` object |
| `src/App.jsx` — `PrivateRoute` | Replace `profile.is_admin` check with `profile.tipo === 'admin'` |
| `src/App.jsx` — `AdminRoute` | Replace `is_admin = true` check with `profile.tipo === 'admin'` |
| `src/pages/LandingPage.jsx` | Replace `is_admin` redirect check with `tipo === 'admin'` |
| `src/pages/AdminDashboard.jsx` | Remove any read/display of `is_admin` field |

### Success criteria
- Admin user with `tipo = 'admin'` can log in and reach `/admin`
- Provider and client routing unchanged
- `npm run build` passes with no references to `is_admin`

---

## Plano 2 — Agenda Visual + Cancelamento + Redesign do Mapa

### 2.1 — Agenda do Prestador (AgendaCalendar rewrite)

**File:** `src/components/AgendaCalendar.jsx` (full rewrite)

**Layout:** Lista por dia. Navega semana a semana (botões ← →). Cada dia é uma seção com header de data. Dias sem agendamento mostram "Sem agendamentos" em cinza. Dias passados ficam com `opacity-60`.

**Card de agendamento:**
- Horário: `HH:mm – HH:mm` (calculado de `data_desejada` + `estimated_duration`)
- Nome do cliente (join com `users`)
- Descrição do serviço (`descricao`)
- Botão "Cancelar" (vermelho outline, pequeno)

**Cancelar da agenda:**
1. Clique em "Cancelar" → diálogo de confirmação inline no card ("Tem certeza?")
2. Confirma → `UPDATE solicitacoes SET status = 'cancelada' WHERE id = ?`
3. Card desaparece da lista imediatamente (optimistic removal)

**Data fetch:** `solicitacoes` WHERE `prestador_id = prestadorId` AND `status IN ('pendente', 'aceita')` AND `data_desejada` within week range. Join `users!solicitacoes_cliente_id_fkey(nome)`.

**Status badges:** `pendente` = âmbar, `aceita` = verde — visíveis no card para o prestador saber o que já foi confirmado vs. ainda pendente.

### 2.2 — Cancelamento pelo Cliente

**File:** `src/pages/ClientDashboard.jsx`

**Aba Propostas (`pendente`):**
- Botão "Cancelar" direto no card
- Clique → confirma → `UPDATE solicitacoes SET status = 'cancelada'`
- Card some da aba Propostas

**Aba Histórico (`aceita` | `recusada` | `cancelada`):**
- Solicitações com `status = 'aceita'` mostram botão "Cancelar" com confirmação extra: "Este serviço já foi aceito pelo prestador. Deseja cancelar mesmo assim?"
- Badge novo: `cancelada` → cinza escuro com texto "Cancelado"

**Migration necessária:** `solicitacoes.status` CHECK constraint deve incluir `'cancelada'`:
```sql
ALTER TABLE solicitacoes DROP CONSTRAINT IF EXISTS solicitacoes_status_check;
ALTER TABLE solicitacoes ADD CONSTRAINT solicitacoes_status_check
  CHECK (status IN ('pendente', 'aceita', 'recusada', 'cancelada'));
```
Incluir na migration `005_admin_tipo.sql`.

### 2.3 — Redesign do ClientMap

**Estrutura:** O componente `ClientMap` / `MapContent` é reestruturado com dois tabs.

**Navigation bar** (abaixo do Header, acima do conteúdo):
```
[🗺️  Mapa]    [🔍  Busca]
```
Tab ativo com underline teal. Estado: `activeTab` = `'mapa' | 'busca'`.

---

#### Tab Mapa

Mapa ocupa 100% da altura disponível (fullscreen relativo ao container). Controles flutuantes mínimos:

- **Seletor de raio** — pill flutuante no canto superior direito: `📍 10 km ▼` (dropdown simples: 2, 5, 10, 20, 50 km)
- **Botão Chamada Rápida** — barra fixa na parte inferior da tela, largura total, fundo âmbar: `⚡ Chamada Rápida`
- Marcadores dos prestadores online no mapa (verde = online, cinza = offline)
- Clique no marcador → InfoWindow com nome, categoria, avaliação, preço/hora + botão "Agendar"

**Fluxo Chamada Rápida — bottom sheet em 3 fases:**

**Fase 1 — Formulário** (bottom sheet sobe ~50% da tela):
```
⚡ Chamada Rápida              [✕]
──────────────────────────────────
Descreva o serviço *
[textarea]

Categoria (opcional)
[select]

[  Solicitar agora  ]
```

**Fase 2 — Aguardando** (bottom sheet mostra feed de status, sem fechar):
```
⚡ Chamada Rápida em andamento  [Cancelar]
──────────────────────────────────────────
✅ Solicitação enviada
⏳ Procurando prestadores próximos...

— João Silva recebeu sua solicitação
— João enviou uma proposta
  60 min · R$ 80,00        [Aceitar →]

— Maria Santos recebeu sua solicitação
```

Cada evento novo é appended ao feed (não substitui). Marcadores dos prestadores que receberam a solicitação pulsam no mapa.

**Fase 3 — Proposta aceita:** bottom sheet fecha, mapa mostra marcador do prestador selecionado destacado. Toast: "Agendado com João Silva!"

---

#### Tab Busca

Lista vertical de cards com filtros colapsáveis no topo.

**Filtros (colapsáveis, default: fechados):**
- Categoria (select)
- Distância máxima (slider: 2–50 km)
- Valor/hora mín e máx (dois inputs numéricos)
- Ordenar por: Distância | Avaliação (radio ou select)

**Card de prestador:**
```
┌──────────────────────────────────────┐
│ [foto]  Nome Sobrenome       ★ 4.8  │
│         Categoria · 2.3 km          │
│         R$ 60/h                     │
│                          [Agendar]  │
└──────────────────────────────────────┘
```

Clique em "Agendar" → `SolicitacaoModal` existente.

Os filtros já existem no estado de `MapContent` (Task 7 do plano anterior) — serão movidos para este tab e desacoplados do mapa.

---

### Files changed — Plano 2

| File | Action |
|------|--------|
| `src/components/AgendaCalendar.jsx` | Full rewrite |
| `src/pages/ClientDashboard.jsx` | Add cancel buttons + 'cancelada' badge |
| `src/pages/ClientMap.jsx` | Full restructure — tab nav + MapTab + BuscaTab |
| `supabase/migrations/005_admin_tipo.sql` | status constraint + admin tipo migration |

### Success criteria
- Prestador vê agendamentos na agenda com nome do cliente, horário, descrição e pode cancelar
- Cliente pode cancelar propostas pendentes e aceitas no seu dashboard
- `/mapa` tem dois tabs funcionais: Mapa (fullscreen + Chamada Rápida com feed de status) e Busca (lista com filtros)
- `npm run build` passa
