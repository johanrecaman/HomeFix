# HomeFix MVP Upgrade — Design Spec
**Date:** 2026-04-18  
**Stack:** React 19 + Vite, Tailwind CSS 3, Supabase, `@react-google-maps/api`  
**Approach:** Layered — DB → Maps → Admin → UX Polish

---

## Camada 1: DB Migration

### Alterações no schema (aditivas, sem breaking changes)

```sql
-- 1. Admin flag em users
ALTER TABLE public.users
  ADD COLUMN is_admin boolean NOT NULL DEFAULT false;

-- 2. Aprovação/ban de prestadores (separado do status de presença)
ALTER TABLE public.prestadores
  ADD COLUMN approval_status text NOT NULL DEFAULT 'active'
  CHECK (approval_status IN ('active', 'banned'));

-- 3. Avaliação média
ALTER TABLE public.prestadores
  ADD COLUMN avaliacao numeric(2,1) DEFAULT null;

-- 4. Promover primeiro admin
UPDATE public.users SET is_admin = true WHERE email = 'johanstrr@gmail.com';
```

### Decisões

- `approval_status` tem apenas dois estados: `active` (padrão) e `banned`. Não há fluxo de aprovação manual — moderação é reativa.
- Prestadores novos ficam `active` automaticamente ao se cadastrar.
- `status` (online/offline/alerta) continua sendo exclusivamente presença/disponibilidade.
- `avaliacao` é preenchida manualmente pelo Admin por enquanto; sistema de reviews é fase 2.

### RLS atualizada

```sql
-- Prestadores: somente ativos são visíveis publicamente
DROP POLICY "Anyone can read online providers" ON public.prestadores;

CREATE POLICY "Public reads active providers"
  ON public.prestadores FOR SELECT
  USING (approval_status = 'active');

CREATE POLICY "Admin reads all providers"
  ON public.prestadores FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = true)
  );

CREATE POLICY "Admin updates any provider"
  ON public.prestadores FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = true)
  );

-- Users: admin pode ler qualquer perfil
CREATE POLICY "Admin reads all users"
  ON public.users FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = true)
  );
```

---

## Camada 2: Google Maps

### Dependência

```bash
npm install @react-google-maps/api
```

Variável de ambiente: `VITE_GOOGLE_MAPS_API_KEY` no `.env`.

### Estrutura de arquivos

```
src/
  hooks/
    useGoogleMaps.js          ← useJsApiLoader wrapper, expõe { isLoaded, loadError }
  components/
    MapSkeleton.jsx           ← skeleton animate-pulse enquanto isLoaded = false
    ProviderMarker.jsx        ← <MarkerF> com ícone customizado
    ProviderInfoWindow.jsx    ← <InfoWindowF> com nome, avaliação, botão solicitar
  pages/
    ClientMap.jsx             ← refatorado para Google Maps
```

### useGoogleMaps

Wrapper fino sobre `useJsApiLoader` do `@react-google-maps/api`. Expõe `{ isLoaded, loadError }`. O `ClientMap` consome para renderizar skeleton ou mapa.

### Estilo do mapa

Estilo "Silver" via `options.styles` no `<GoogleMap>` — tons neutros compatíveis com o tema light/dark existente (`#FAF8F3` / `#08141A`).

### Markers customizados

- **Com `foto_url`:** ícone circular com a foto do prestador, borda branca, sombra teal.
- **Sem foto:** PIN teal com inicial do nome em branco.
- Implementado via `icon` prop do `<MarkerF>` com SVG/URL.

### FitBounds

Após carregar providers, `useEffect` chama `map.fitBounds(bounds)` englobando todos os `LatLng`. Se houver apenas 1 provider, usa `map.setCenter` + `map.setZoom(14)` para evitar zoom excessivo.

### InfoWindow

Abre ao clicar no marker. Conteúdo:
- Avatar (foto circular ou inicial)
- Nome + categoria
- Avaliação: "★ 4.8" ou "Sem avaliação" se `null`
- Botão "Solicitar serviço" → abre `SolicitacaoModal` existente

Fecha ao clicar fora ou ao abrir outra InfoWindow.

---

## Camada 3: Admin UI

### Rota

`/admin` protegida por `PrivateRoute` com verificação `profile.is_admin === true`. Redireciona para `/` se falso. O `useAuth` já faz `select('*')` em `users`, então `is_admin` está disponível sem mudança no hook.

### Estrutura de arquivos

```
src/
  pages/
    AdminDashboard.jsx
  components/
    ProviderAdminCard.jsx     ← card com ações ban/unban
    AdminTableSkeleton.jsx    ← skeleton para lista
```

### Layout

- Header com badge "Admin"
- Tabs de filtro: **Todos | Ativos | Banidos** (estado local, sem roteamento)
- Lista de `ProviderAdminCard` filtrada

### ProviderAdminCard

Exibe: avatar, nome, email, categoria, avaliação, status de presença atual (online/offline/alerta).

Ações contextuais:
- `active` → botão "Banir" → `UPDATE prestadores SET approval_status = 'banned'`
- `banned` → botão "Reativar" → `UPDATE prestadores SET approval_status = 'active'`

### Query do Admin

Join `prestadores + users` sem filtro de `approval_status`. Permitido pela RLS policy `"Admin reads all providers"`.

---

## Camada 4: UX Polish

### Skeleton Screens

Todos com `animate-pulse` + `bg-ink-900/10 dark:bg-white/10` — zero libs novas.

- **`MapSkeleton`:** retângulo full-height no lugar do mapa
- **`ProviderCardSkeleton`:** 3 cards fantasma na sidebar (avatar + 2 linhas de texto)
- **`AdminTableSkeleton`:** 5 linhas fantasma na lista do admin

### Empty States

- **Mapa sem providers:** ícone `MapPin` + "Nenhum prestador disponível na sua região agora" + subtexto — refinamento do estado existente
- **Admin filtro "Banidos" vazio:** ícone `ShieldCheck` + "Nenhum prestador banido"

### Realtime Ban

O canal `map-providers` existente no `ClientMap` já escuta `UPDATE` em `prestadores`. Quando o Admin bane um prestador, o payload chega com `approval_status = 'banned'`. O handler re-executa `fetchOnlineProviders()`, que agora filtra `approval_status = 'active'` — o prestador some do mapa instantaneamente para todos os clientes conectados, sem refresh.

---

## Fora do Escopo (Fase 2)

- Sistema de reviews/avaliações com tabela dedicada
- Notificações push para prestadores
- Filtros de categoria/preço no mapa
- Perfil público do prestador (`/prestador/:id`)
