# Admin Role Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove `is_admin boolean` from `users` and use `users.tipo = 'admin'` as the single source of truth for admin identity.

**Architecture:** One SQL migration handles the data migration + constraint update + `is_admin()` function rewrite. Frontend changes are purely mechanical: two string replacements in route guards and one in the landing page redirect. No logic changes, no new components.

**Tech Stack:** React 19 + Vite + Supabase v2 + React Router 7

---

## File Map

| Action | File | What changes |
|--------|------|-------------|
| **Create** | `supabase/migrations/005_admin_tipo.sql` | Adds `'admin'` to tipo CHECK, migrates admins, drops `is_admin`, rewrites `is_admin()`, adds `'cancelada'` to solicitacoes status |
| **Modify** | `src/App.jsx` | `profile.is_admin` → `profile.tipo === 'admin'` in PrivateRoute and AdminRoute |
| **Modify** | `src/pages/LandingPage.jsx` | `is_admin` redirect check → `tipo === 'admin'` |
| **Modify** | `CLAUDE.md` | Update User Roles and Auth Flow sections |

> `src/hooks/useAuth.js` uses `select('*')` — no change needed. After migration the `is_admin` column simply won't exist and won't be returned.
> `src/pages/AdminDashboard.jsx` — does not reference `is_admin` in its logic; verify with grep step in Task 3.

---

## Task 1 — Migration 005: admin tipo + solicitacoes status

**Files:**
- Create: `supabase/migrations/005_admin_tipo.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- supabase/migrations/005_admin_tipo.sql

-- ============================================================
-- 1. Allow 'admin' as a valid tipo value
-- ============================================================
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_tipo_check;
ALTER TABLE users ADD CONSTRAINT users_tipo_check
  CHECK (tipo IN ('cliente', 'prestador', 'admin'));

-- ============================================================
-- 2. Migrate existing admin users
-- ============================================================
UPDATE users SET tipo = 'admin' WHERE is_admin = true;

-- ============================================================
-- 3. Drop the is_admin column
-- ============================================================
ALTER TABLE users DROP COLUMN IF EXISTS is_admin;

-- ============================================================
-- 4. Rewrite is_admin() helper (used by existing RLS policies)
--    All policies that call is_admin() continue working unchanged.
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND tipo = 'admin'
  );
$$;

-- ============================================================
-- 5. Add 'cancelada' to solicitacoes.status
--    (Required by Plan 2 — included here so DB is ready)
-- ============================================================
ALTER TABLE solicitacoes DROP CONSTRAINT IF EXISTS solicitacoes_status_check;
ALTER TABLE solicitacoes ADD CONSTRAINT solicitacoes_status_check
  CHECK (status IN ('pendente', 'aceita', 'recusada', 'cancelada'));
```

- [ ] **Step 2: Apply migration in Supabase SQL Editor**

  Paste the full content of `005_admin_tipo.sql` into the Supabase SQL Editor and run it.

  Verify with:
  ```sql
  -- Should return 0 rows (column is gone)
  SELECT column_name FROM information_schema.columns
  WHERE table_name = 'users' AND column_name = 'is_admin';

  -- Should return 'admin' in the check constraint
  SELECT pg_get_constraintdef(oid) FROM pg_constraint
  WHERE conname = 'users_tipo_check';
  ```

- [ ] **Step 3: Commit the migration file**

  ```bash
  git add supabase/migrations/005_admin_tipo.sql
  git commit -m "feat: migration 005 — admin tipo, drop is_admin, cancelada status"
  ```

---

## Task 2 — App.jsx: update route guards

**Files:**
- Modify: `src/App.jsx`

- [ ] **Step 1: Read App.jsx to locate PrivateRoute and AdminRoute**

  ```bash
  grep -n "is_admin" /Users/johanstrombergrecaman/Documents/github/HomeFix/src/App.jsx
  ```
  Expected: 2 lines — one in PrivateRoute, one in AdminRoute.

- [ ] **Step 2: Update PrivateRoute**

  Find:
  ```jsx
  if (profile.is_admin) return <Navigate to="/admin" replace/>
  ```
  Replace with:
  ```jsx
  if (profile.tipo === 'admin') return <Navigate to="/admin" replace/>
  ```

- [ ] **Step 3: Update AdminRoute**

  Find:
  ```jsx
  if (!profile.is_admin) return <Navigate to="/" replace/>
  ```
  Replace with:
  ```jsx
  if (profile.tipo !== 'admin') return <Navigate to="/" replace/>
  ```

- [ ] **Step 4: Verify no remaining is_admin references**

  ```bash
  grep -n "is_admin" /Users/johanstrombergrecaman/Documents/github/HomeFix/src/App.jsx
  ```
  Expected: no output.

- [ ] **Step 5: Verify build**

  ```bash
  npm run build
  ```
  Expected: success.

- [ ] **Step 6: Commit**

  ```bash
  git add src/App.jsx
  git commit -m "feat: App.jsx — admin check via tipo=admin"
  ```

---

## Task 3 — LandingPage.jsx and full is_admin sweep

**Files:**
- Modify: `src/pages/LandingPage.jsx`

- [ ] **Step 1: Find is_admin references across all source files**

  ```bash
  grep -rn "is_admin" /Users/johanstrombergrecaman/Documents/github/HomeFix/src/
  ```
  Expected: one or two hits in `LandingPage.jsx`. If any appear in other files, fix those too before proceeding.

- [ ] **Step 2: Update LandingPage redirect**

  The landing page has a `useEffect` or early return that redirects logged-in users. Find the block that reads `profile?.is_admin` (or `profile.is_admin`) and replace each occurrence:

  ```js
  // Before
  if (profile?.is_admin) navigate('/admin')
  // After
  if (profile?.tipo === 'admin') navigate('/admin')
  ```

  If the pattern is slightly different (e.g. a ternary or a switch), the principle is the same: replace the `is_admin` boolean check with `tipo === 'admin'`.

- [ ] **Step 3: Fix any other files flagged in Step 1**

  Apply the same replacement pattern — `profile.is_admin` → `profile.tipo === 'admin'` — in any other files the grep found.

- [ ] **Step 4: Verify no is_admin references remain**

  ```bash
  grep -rn "is_admin" /Users/johanstrombergrecaman/Documents/github/HomeFix/src/
  ```
  Expected: no output.

- [ ] **Step 5: Verify build**

  ```bash
  npm run build
  ```
  Expected: success.

- [ ] **Step 6: Commit**

  ```bash
  git add -u src/
  git commit -m "feat: remove all is_admin references — use tipo=admin"
  ```

---

## Task 4 — Update CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update User Roles table**

  Find the User Roles table in CLAUDE.md:
  ```markdown
  | Admin | `users.is_admin = true` | `/admin` |
  ```
  Replace with:
  ```markdown
  | Admin | `users.tipo = 'admin'` | `/admin` |
  ```

  Find the bullet:
  ```markdown
  - `is_admin` column has been **removed** from `users` — admin identity is `tipo = 'admin'`
  ```
  Ensure this line exists (it was added in the previous CLAUDE.md update — verify it's still accurate).

- [ ] **Step 2: Update Auth Flow section**

  Find:
  ```markdown
  `profile` includes `tipo`, `is_admin`, `nome`, `email`, `foto_url`.
  ```
  Replace with:
  ```markdown
  `profile` includes `tipo` (`'cliente'`|`'prestador'`|`'admin'`), `nome`, `email`, `foto_url`.
  ```

- [ ] **Step 3: Update Pending Work section**

  Mark admin refactor as done:
  ```markdown
  ## Completed Work
  ...
  Migration 005: `is_admin` removed, `tipo='admin'` is now the admin identifier. `solicitacoes.status` now accepts `'cancelada'`.
  ```

- [ ] **Step 4: Commit**

  ```bash
  git add CLAUDE.md
  git commit -m "docs: CLAUDE.md — reflect admin tipo refactor completion"
  ```
