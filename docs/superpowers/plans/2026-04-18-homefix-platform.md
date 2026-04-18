# HomeFix Platform Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a full-stack Brazilian home-services marketplace (React + Tailwind + Supabase) with client/provider flows, real-time proposals, GPS-enabled provider dashboard, and an interactive map.

**Architecture:** Vite + React 18 SPA with React Router v6, Tailwind CSS v3 with a custom design token layer matching the HomeFix design system, and Supabase for auth/database/realtime. Provider GPS is stored on toggle and updated on an interval. The map uses Leaflet (lightweight, no API key).

**Tech Stack:** Vite, React 18, React Router v6, Tailwind CSS v3, Supabase JS v2, Leaflet + React-Leaflet, Plus Jakarta Sans (Google Fonts), Lucide React (icons)

**Design System Source:** `Landing Page.html` — primary `#20D4B8`, font `Plus Jakarta Sans`, CSS variables for light/dark, spacing/radius tokens extracted below.

---

## Design Token Reference (extracted from Landing Page.html)

```
Primary:   #20D4B8  (teal-400)
Primary-h: #10B89C  (teal-500, hover)
Dark text: #0D1B1A  (ink-900)
Amber:     #FFB648  (stars)
Coral:     #FF7A59  (accent)
Radius:    8/12/18/28px (sm/md/lg/xl)
Font:      Plus Jakarta Sans 400/500/600/700/800
```

---

## File Map

```
HomeFix/
├── index.html
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
├── package.json
├── .env.example
├── supabase/
│   └── schema.sql                  # all tables + RLS policies
├── src/
│   ├── main.jsx
│   ├── App.jsx                     # routes
│   ├── index.css                   # Tailwind + CSS vars + global styles
│   ├── lib/
│   │   └── supabase.js             # supabase client
│   ├── hooks/
│   │   ├── useAuth.js              # auth state + helpers
│   │   └── useGeolocation.js       # GPS hook
│   ├── components/
│   │   ├── Logo.jsx
│   │   ├── Header.jsx
│   │   ├── ThemeToggle.jsx
│   │   └── Button.jsx
│   └── pages/
│       ├── Entry.jsx               # "Contratar" | "Prestar serviço"
│       ├── Login.jsx               # unified login, detects type, redirects
│       ├── RegisterClient.jsx
│       ├── RegisterProvider.jsx
│       ├── ClientMap.jsx           # map + solicitation flow
│       ├── ProviderDashboard.jsx   # tabs: propostas + alerta
│       └── NotFound.jsx
```

---

## Task 1: Project Scaffold

**Files:**
- Create: `package.json`
- Create: `vite.config.js`
- Create: `tailwind.config.js`
- Create: `postcss.config.js`
- Create: `index.html`
- Create: `.env.example`

- [ ] **Step 1: Init project and install deps**

```bash
cd /Users/johanstrombergrecaman/Documents/github/HomeFix
npm create vite@latest . -- --template react
npm install
npm install @supabase/supabase-js react-router-dom leaflet react-leaflet lucide-react
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

- [ ] **Step 2: Configure Tailwind**

Replace `tailwind.config.js`:
```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
      },
      colors: {
        teal: {
          50:  '#E4FAF5',
          100: '#BDF3E6',
          200: '#8AE9D3',
          300: '#4EDFC0',
          400: '#20D4B8',
          500: '#10B89C',
          600: '#0A9A82',
          700: '#097868',
          800: '#0A5A4F',
          900: '#083F37',
        },
        ink: {
          900: '#0D1B1A',
          800: '#14302C',
          700: '#264944',
          600: '#4A6862',
          500: '#6E8984',
          400: '#97ADA9',
        },
        amber: '#FFB648',
        coral: '#FF7A59',
      },
      borderRadius: {
        sm: '8px',
        md: '12px',
        lg: '18px',
        xl: '28px',
      },
      boxShadow: {
        teal: '0 12px 28px rgba(32,212,184,0.32)',
      },
    },
  },
  plugins: [],
}
```

- [ ] **Step 3: Create `src/index.css`**

```css
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --teal-400: #20D4B8;
  --teal-500: #10B89C;
  --ink-900:  #0D1B1A;
}

* { box-sizing: border-box; }
html { -webkit-font-smoothing: antialiased; }
body { font-family: 'Plus Jakarta Sans', system-ui, sans-serif; }

/* Leaflet fix */
.leaflet-container { height: 100%; width: 100%; border-radius: 18px; }
```

- [ ] **Step 4: Create `.env.example`**

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

Copy to `.env.local` and fill in real credentials before running.

- [ ] **Step 5: Verify dev server starts**

```bash
npm run dev
```

Expected: Vite server on http://localhost:5173 with default Vite page.

- [ ] **Step 6: Commit**

```bash
git add .
git commit -m "feat: scaffold Vite+React+Tailwind+Supabase project"
```

---

## Task 2: Supabase Schema

**Files:**
- Create: `supabase/schema.sql`

- [ ] **Step 1: Write schema SQL**

Create `supabase/schema.sql`:

```sql
-- Enable uuid extension
create extension if not exists "uuid-ossp";
create extension if not exists "postgis";

-- USERS (extends Supabase auth.users)
create table public.users (
  id          uuid primary key references auth.users(id) on delete cascade,
  nome        text not null,
  email       text not null,
  telefone    text,
  tipo        text not null check (tipo in ('cliente', 'prestador')),
  foto_url    text,
  created_at  timestamptz default now()
);

alter table public.users enable row level security;
create policy "Users can read own profile" on public.users for select using (auth.uid() = id);
create policy "Users can update own profile" on public.users for update using (auth.uid() = id);
create policy "Users can insert own profile" on public.users for insert with check (auth.uid() = id);

-- PRESTADORES
create table public.prestadores (
  user_id     uuid primary key references public.users(id) on delete cascade,
  categoria   text not null,
  descricao   text,
  preco_medio numeric(10,2),
  raio_km     int default 10,
  status      text not null default 'offline' check (status in ('online', 'offline', 'alerta')),
  latitude    double precision,
  longitude   double precision,
  updated_at  timestamptz default now()
);

alter table public.prestadores enable row level security;
create policy "Anyone can read online providers" on public.prestadores for select using (true);
create policy "Provider can update own record" on public.prestadores for update using (auth.uid() = user_id);
create policy "Provider can insert own record" on public.prestadores for insert with check (auth.uid() = user_id);

-- SOLICITACOES
create table public.solicitacoes (
  id              uuid primary key default uuid_generate_v4(),
  cliente_id      uuid not null references public.users(id) on delete cascade,
  prestador_id    uuid not null references public.users(id) on delete cascade,
  descricao       text not null,
  data_desejada   timestamptz not null,
  valor_oferecido numeric(10,2),
  status          text not null default 'pendente' check (status in ('pendente', 'aceita', 'recusada')),
  created_at      timestamptz default now()
);

alter table public.solicitacoes enable row level security;
create policy "Client sees own requests" on public.solicitacoes for select using (auth.uid() = cliente_id);
create policy "Provider sees incoming requests" on public.solicitacoes for select using (auth.uid() = prestador_id);
create policy "Client can insert" on public.solicitacoes for insert with check (auth.uid() = cliente_id);
create policy "Provider can update status" on public.solicitacoes for update using (auth.uid() = prestador_id);

-- Realtime: enable for provider dashboard
alter publication supabase_realtime add table public.solicitacoes;
alter publication supabase_realtime add table public.prestadores;
```

- [ ] **Step 2: Run schema in Supabase SQL editor**

Go to your Supabase project → SQL Editor → paste `supabase/schema.sql` → Run.

Verify in Table Editor: tables `users`, `prestadores`, `solicitacoes` exist.

- [ ] **Step 3: Commit schema**

```bash
git add supabase/schema.sql
git commit -m "feat: add Supabase schema with users/prestadores/solicitacoes + RLS"
```

---

## Task 3: Supabase Client + Auth Hook

**Files:**
- Create: `src/lib/supabase.js`
- Create: `src/hooks/useAuth.js`
- Create: `src/hooks/useGeolocation.js`

- [ ] **Step 1: Create Supabase client**

```js
// src/lib/supabase.js
import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)
```

- [ ] **Step 2: Create useAuth hook**

```js
// src/hooks/useAuth.js
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export function useAuth() {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id)
      else setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id)
      else { setProfile(null); setLoading(false) }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function fetchProfile(id) {
    const { data } = await supabase.from('users').select('*').eq('id', id).single()
    setProfile(data)
    setLoading(false)
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  return { user, profile, loading, signOut, refetchProfile: () => fetchProfile(user?.id) }
}
```

- [ ] **Step 3: Create useGeolocation hook**

```js
// src/hooks/useGeolocation.js
import { useState, useCallback } from 'react'

export function useGeolocation() {
  const [coords, setCoords] = useState(null)
  const [error, setError] = useState(null)

  const getPosition = useCallback(() => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        const err = 'Geolocation not supported'
        setError(err)
        reject(err)
        return
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const c = { lat: pos.coords.latitude, lng: pos.coords.longitude }
          setCoords(c)
          resolve(c)
        },
        (err) => {
          setError(err.message)
          reject(err.message)
        },
        { enableHighAccuracy: true, timeout: 10000 }
      )
    })
  }, [])

  return { coords, error, getPosition }
}
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/supabase.js src/hooks/useAuth.js src/hooks/useGeolocation.js
git commit -m "feat: Supabase client + auth/geolocation hooks"
```

---

## Task 4: Shared UI Components

**Files:**
- Create: `src/components/Logo.jsx`
- Create: `src/components/Button.jsx`
- Create: `src/components/Header.jsx`
- Create: `src/components/ThemeToggle.jsx`

- [ ] **Step 1: Create Logo component**

```jsx
// src/components/Logo.jsx
export function Logo({ className = '' }) {
  return (
    <span className={`inline-flex items-center gap-2 font-extrabold text-xl tracking-tight text-ink-900 dark:text-white ${className}`}>
      <svg width="32" height="32" viewBox="0 0 32 32" className="flex-shrink-0">
        <rect width="32" height="32" rx="9" fill="#20D4B8"/>
        <path d="M8 9 L12 6 L12 24 L8 24 Z" fill="#0D1B1A"/>
        <path d="M20 6 L24 9 L24 24 L20 24 Z" fill="#0D1B1A"/>
        <rect x="12" y="14" width="8" height="4" fill="#0D1B1A"/>
      </svg>
      HomeFix
    </span>
  )
}
```

- [ ] **Step 2: Create Button component**

```jsx
// src/components/Button.jsx
const variants = {
  primary: 'bg-teal-400 hover:bg-teal-500 text-ink-900 font-bold shadow-teal hover:-translate-y-px',
  dark: 'bg-ink-900 hover:opacity-90 text-white font-semibold',
  outline: 'border border-ink-400 hover:border-ink-900 dark:border-ink-600 dark:hover:border-teal-400 text-ink-900 dark:text-white font-semibold',
  ghost: 'text-ink-800 hover:bg-ink-900/5 dark:hover:bg-white/10 font-medium',
}

const sizes = {
  sm: 'px-4 py-2 text-sm rounded-md',
  md: 'px-5 py-3 text-sm rounded-md',
  lg: 'px-6 py-4 text-base rounded-lg',
}

export function Button({ variant = 'primary', size = 'md', className = '', disabled, loading, children, ...props }) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"/> : null}
      {children}
    </button>
  )
}
```

- [ ] **Step 3: Create ThemeToggle**

```jsx
// src/components/ThemeToggle.jsx
import { useState, useEffect } from 'react'
import { Sun, Moon } from 'lucide-react'

export function ThemeToggle() {
  const [dark, setDark] = useState(() => localStorage.getItem('theme') === 'dark')

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    localStorage.setItem('theme', dark ? 'dark' : 'light')
  }, [dark])

  return (
    <button
      onClick={() => setDark(d => !d)}
      className="w-10 h-10 grid place-items-center rounded-lg text-ink-700 dark:text-ink-400 hover:bg-ink-900/5 dark:hover:bg-white/10 transition-colors"
      aria-label="Alternar tema"
    >
      {dark ? <Sun size={18}/> : <Moon size={18}/>}
    </button>
  )
}
```

- [ ] **Step 4: Create Header**

```jsx
// src/components/Header.jsx
import { Link, useNavigate } from 'react-router-dom'
import { Logo } from './Logo'
import { Button } from './Button'
import { ThemeToggle } from './ThemeToggle'
import { useAuth } from '../hooks/useAuth'

export function Header() {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()

  async function handleSignOut() {
    await signOut()
    navigate('/')
  }

  return (
    <header className="sticky top-0 z-50 bg-white/80 dark:bg-[#08141A]/80 backdrop-blur-md border-b border-ink-900/8 dark:border-white/8">
      <div className="max-w-6xl mx-auto px-6 h-[76px] flex items-center justify-between">
        <Link to="/"><Logo/></Link>
        <div className="flex items-center gap-2">
          <ThemeToggle/>
          {profile ? (
            <>
              <span className="hidden md:block text-sm text-ink-600 dark:text-ink-400 font-medium">{profile.nome}</span>
              <Button variant="ghost" size="sm" onClick={handleSignOut}>Sair</Button>
              <Button size="sm" onClick={() => navigate(profile.tipo === 'prestador' ? '/dashboard' : '/mapa')}>
                {profile.tipo === 'prestador' ? 'Dashboard' : 'Buscar'}
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" size="sm" onClick={() => navigate('/login')}>Entrar</Button>
              <Button size="sm" onClick={() => navigate('/')}>Criar conta</Button>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
```

- [ ] **Step 5: Commit**

```bash
git add src/components/
git commit -m "feat: shared UI components (Logo, Button, Header, ThemeToggle)"
```

---

## Task 5: App Router + Entry Screen

**Files:**
- Create: `src/main.jsx`
- Create: `src/App.jsx`
- Create: `src/pages/Entry.jsx`
- Create: `src/pages/NotFound.jsx`
- Modify: `index.html`

- [ ] **Step 1: Update index.html**

```html
<!DOCTYPE html>
<html lang="pt-BR" class="">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>HomeFix — Serviços para sua casa</title>
  <link rel="preconnect" href="https://fonts.googleapis.com"/>
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet"/>
</head>
<body class="bg-white dark:bg-[#08141A] text-ink-900 dark:text-white transition-colors">
  <div id="root"></div>
  <script type="module" src="/src/main.jsx"></script>
</body>
</html>
```

- [ ] **Step 2: Create main.jsx**

```jsx
// src/main.jsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App/>
    </BrowserRouter>
  </React.StrictMode>
)
```

- [ ] **Step 3: Create App.jsx with all routes**

```jsx
// src/App.jsx
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import { Entry } from './pages/Entry'
import { Login } from './pages/Login'
import { RegisterClient } from './pages/RegisterClient'
import { RegisterProvider } from './pages/RegisterProvider'
import { ClientMap } from './pages/ClientMap'
import { ProviderDashboard } from './pages/ProviderDashboard'
import { NotFound } from './pages/NotFound'

function PrivateRoute({ children, requiredType }) {
  const { profile, loading } = useAuth()
  if (loading) return <div className="h-screen grid place-items-center"><span className="w-8 h-8 border-4 border-teal-400 border-t-transparent rounded-full animate-spin"/></div>
  if (!profile) return <Navigate to="/login" replace/>
  if (requiredType && profile.tipo !== requiredType) return <Navigate to="/" replace/>
  return children
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Entry/>}/>
      <Route path="/login" element={<Login/>}/>
      <Route path="/cadastro/cliente" element={<RegisterClient/>}/>
      <Route path="/cadastro/prestador" element={<RegisterProvider/>}/>
      <Route path="/mapa" element={<PrivateRoute requiredType="cliente"><ClientMap/></PrivateRoute>}/>
      <Route path="/dashboard" element={<PrivateRoute requiredType="prestador"><ProviderDashboard/></PrivateRoute>}/>
      <Route path="*" element={<NotFound/>}/>
    </Routes>
  )
}
```

- [ ] **Step 4: Create Entry page**

```jsx
// src/pages/Entry.jsx
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useEffect } from 'react'
import { Logo } from '../components/Logo'
import { ThemeToggle } from '../components/ThemeToggle'
import { Button } from '../components/Button'
import { Home, Wrench, Shield, Star, Clock } from 'lucide-react'

export function Entry() {
  const { profile, loading } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (!loading && profile) {
      navigate(profile.tipo === 'prestador' ? '/dashboard' : '/mapa', { replace: true })
    }
  }, [profile, loading, navigate])

  return (
    <div className="min-h-screen bg-[#FAF8F3] dark:bg-[#08141A] flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-5 max-w-6xl mx-auto w-full">
        <Logo/>
        <ThemeToggle/>
      </header>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-16 text-center">
        {/* Eyebrow */}
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white dark:bg-ink-900/50 border border-ink-900/10 dark:border-white/10 text-ink-700 dark:text-ink-400 text-sm font-medium mb-8 shadow-sm">
          <span className="w-5 h-5 rounded-full bg-teal-400 grid place-items-center text-ink-900">
            <Shield size={11}/>
          </span>
          +12.000 profissionais verificados no Brasil
        </div>

        <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-ink-900 dark:text-white mb-6 leading-tight" style={{ letterSpacing: '-0.035em' }}>
          Tudo que sua casa<br/>precisa, <span className="text-teal-600 dark:text-teal-300">em um clique.</span>
        </h1>
        <p className="text-lg md:text-xl text-ink-600 dark:text-ink-400 max-w-xl mb-12 leading-relaxed">
          Encontre profissionais verificados para limpeza, reparos, instalações e muito mais — sem surpresas.
        </p>

        {/* Choice cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-2xl mb-10">
          <button
            onClick={() => navigate('/cadastro/cliente')}
            className="group relative flex flex-col items-start gap-4 p-8 rounded-xl bg-white dark:bg-[#11222A] border border-ink-900/10 dark:border-white/10 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all text-left"
          >
            <div className="w-12 h-12 rounded-xl bg-teal-100 dark:bg-teal-400/15 grid place-items-center text-teal-700 dark:text-teal-300">
              <Home size={24}/>
            </div>
            <div>
              <h2 className="text-xl font-bold text-ink-900 dark:text-white mb-1">Quero contratar</h2>
              <p className="text-sm text-ink-600 dark:text-ink-400 leading-relaxed">Encontre profissionais verificados para sua casa</p>
            </div>
            <div className="absolute bottom-6 right-6 w-8 h-8 rounded-full bg-teal-400 grid place-items-center text-ink-900 opacity-0 group-hover:opacity-100 transition-opacity">
              →
            </div>
          </button>

          <button
            onClick={() => navigate('/cadastro/prestador')}
            className="group relative flex flex-col items-start gap-4 p-8 rounded-xl bg-white dark:bg-[#11222A] border border-ink-900/10 dark:border-white/10 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all text-left"
          >
            <div className="w-12 h-12 rounded-xl bg-teal-100 dark:bg-teal-400/15 grid place-items-center text-teal-700 dark:text-teal-300">
              <Wrench size={24}/>
            </div>
            <div>
              <h2 className="text-xl font-bold text-ink-900 dark:text-white mb-1">Quero prestar serviço</h2>
              <p className="text-sm text-ink-600 dark:text-ink-400 leading-relaxed">Ofereça seus serviços e conquiste mais clientes</p>
            </div>
            <div className="absolute bottom-6 right-6 w-8 h-8 rounded-full bg-teal-400 grid place-items-center text-ink-900 opacity-0 group-hover:opacity-100 transition-opacity">
              →
            </div>
          </button>
        </div>

        <p className="text-sm text-ink-500 dark:text-ink-600">
          Já tem conta?{' '}
          <button onClick={() => navigate('/login')} className="text-teal-600 dark:text-teal-400 font-semibold hover:underline">
            Entrar
          </button>
        </p>

        {/* Trust strip */}
        <div className="flex flex-wrap justify-center gap-x-8 gap-y-3 mt-12 text-sm text-ink-500 dark:text-ink-600">
          {[
            { icon: <Shield size={14}/>, label: 'Profissionais verificados' },
            { icon: <Star size={14}/>, label: '4,9★ média de avaliação' },
            { icon: <Clock size={14}/>, label: 'Agendamento em 2 min' },
          ].map(({ icon, label }) => (
            <span key={label} className="flex items-center gap-1.5 font-medium">
              <span className="text-teal-600 dark:text-teal-400">{icon}</span>
              {label}
            </span>
          ))}
        </div>
      </main>
    </div>
  )
}
```

- [ ] **Step 5: Create NotFound page**

```jsx
// src/pages/NotFound.jsx
import { useNavigate } from 'react-router-dom'
import { Button } from '../components/Button'
export function NotFound() {
  const navigate = useNavigate()
  return (
    <div className="h-screen grid place-items-center text-center px-6">
      <div>
        <div className="text-6xl font-extrabold text-teal-400 mb-4">404</div>
        <h1 className="text-2xl font-bold text-ink-900 dark:text-white mb-2">Página não encontrada</h1>
        <p className="text-ink-600 dark:text-ink-400 mb-8">A página que você procura não existe.</p>
        <Button onClick={() => navigate('/')}>Voltar ao início</Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Commit**

```bash
git add src/
git commit -m "feat: app router + entry screen with type selection"
```

---

## Task 6: Login Page (unified, detects tipo and redirects)

**Files:**
- Create: `src/pages/Login.jsx`

- [ ] **Step 1: Create Login page**

```jsx
// src/pages/Login.jsx
import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Logo } from '../components/Logo'
import { ThemeToggle } from '../components/ThemeToggle'
import { Button } from '../components/Button'

export function Login() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { data, error: authErr } = await supabase.auth.signInWithPassword({ email, password })
    if (authErr) { setError(authErr.message); setLoading(false); return }

    const { data: profile } = await supabase.from('users').select('tipo').eq('id', data.user.id).single()
    setLoading(false)
    if (profile?.tipo === 'prestador') navigate('/dashboard', { replace: true })
    else navigate('/mapa', { replace: true })
  }

  return (
    <div className="min-h-screen bg-[#FAF8F3] dark:bg-[#08141A] flex flex-col">
      <header className="flex items-center justify-between px-6 py-5 max-w-xl mx-auto w-full">
        <Link to="/"><Logo/></Link>
        <ThemeToggle/>
      </header>
      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md bg-white dark:bg-[#11222A] rounded-xl border border-ink-900/10 dark:border-white/10 shadow-sm p-8">
          <h1 className="text-2xl font-extrabold text-ink-900 dark:text-white mb-2 tracking-tight">Bem-vindo de volta</h1>
          <p className="text-sm text-ink-600 dark:text-ink-400 mb-8">Entre com sua conta HomeFix</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-ink-700 dark:text-ink-400 uppercase tracking-widest mb-2">E-mail</label>
              <input
                type="email" required value={email} onChange={e => setEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-lg border border-ink-900/15 dark:border-white/15 bg-transparent text-ink-900 dark:text-white placeholder-ink-500 focus:outline-none focus:ring-2 focus:ring-teal-400 text-sm"
                placeholder="seu@email.com"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-ink-700 dark:text-ink-400 uppercase tracking-widest mb-2">Senha</label>
              <input
                type="password" required value={password} onChange={e => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-lg border border-ink-900/15 dark:border-white/15 bg-transparent text-ink-900 dark:text-white placeholder-ink-500 focus:outline-none focus:ring-2 focus:ring-teal-400 text-sm"
                placeholder="••••••••"
              />
            </div>
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <Button type="submit" className="w-full" size="lg" loading={loading}>Entrar</Button>
          </form>

          <p className="text-center text-sm text-ink-500 dark:text-ink-600 mt-6">
            Não tem conta?{' '}
            <Link to="/" className="text-teal-600 dark:text-teal-400 font-semibold hover:underline">Criar conta</Link>
          </p>
        </div>
      </main>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/Login.jsx
git commit -m "feat: unified login with tipo-based redirect"
```

---

## Task 7: Client Registration

**Files:**
- Create: `src/pages/RegisterClient.jsx`

- [ ] **Step 1: Create RegisterClient page**

```jsx
// src/pages/RegisterClient.jsx
import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Logo } from '../components/Logo'
import { ThemeToggle } from '../components/ThemeToggle'
import { Button } from '../components/Button'

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-xs font-bold text-ink-700 dark:text-ink-400 uppercase tracking-widest mb-2">{label}</label>
      {children}
    </div>
  )
}

const inputClass = "w-full px-4 py-3 rounded-lg border border-ink-900/15 dark:border-white/15 bg-transparent text-ink-900 dark:text-white placeholder-ink-500 focus:outline-none focus:ring-2 focus:ring-teal-400 text-sm"

export function RegisterClient() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ nome: '', email: '', telefone: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { data, error: authErr } = await supabase.auth.signUp({ email: form.email, password: form.password })
    if (authErr) { setError(authErr.message); setLoading(false); return }

    const { error: dbErr } = await supabase.from('users').insert({
      id: data.user.id,
      nome: form.nome,
      email: form.email,
      telefone: form.telefone,
      tipo: 'cliente',
    })
    setLoading(false)
    if (dbErr) { setError(dbErr.message); return }
    navigate('/mapa', { replace: true })
  }

  return (
    <div className="min-h-screen bg-[#FAF8F3] dark:bg-[#08141A] flex flex-col">
      <header className="flex items-center justify-between px-6 py-5 max-w-xl mx-auto w-full">
        <Link to="/"><Logo/></Link>
        <ThemeToggle/>
      </header>
      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md bg-white dark:bg-[#11222A] rounded-xl border border-ink-900/10 dark:border-white/10 shadow-sm p-8">
          <div className="inline-block text-xs font-bold text-teal-800 dark:text-teal-300 bg-teal-100 dark:bg-teal-400/15 px-3 py-1 rounded-full uppercase tracking-widest mb-6">Cliente</div>
          <h1 className="text-2xl font-extrabold text-ink-900 dark:text-white mb-2 tracking-tight">Criar sua conta</h1>
          <p className="text-sm text-ink-600 dark:text-ink-400 mb-8">Encontre profissionais verificados para sua casa</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Field label="Nome completo">
              <input type="text" required value={form.nome} onChange={set('nome')} className={inputClass} placeholder="Maria Silva"/>
            </Field>
            <Field label="E-mail">
              <input type="email" required value={form.email} onChange={set('email')} className={inputClass} placeholder="seu@email.com"/>
            </Field>
            <Field label="Telefone">
              <input type="tel" value={form.telefone} onChange={set('telefone')} className={inputClass} placeholder="(11) 99999-9999"/>
            </Field>
            <Field label="Senha">
              <input type="password" required value={form.password} onChange={set('password')} className={inputClass} placeholder="Mínimo 6 caracteres" minLength={6}/>
            </Field>
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <Button type="submit" className="w-full" size="lg" loading={loading}>Criar conta</Button>
          </form>

          <p className="text-center text-sm text-ink-500 dark:text-ink-600 mt-6">
            Já tem conta? <Link to="/login" className="text-teal-600 dark:text-teal-400 font-semibold hover:underline">Entrar</Link>
          </p>
        </div>
      </main>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/RegisterClient.jsx
git commit -m "feat: client registration with Supabase auth"
```

---

## Task 8: Provider Registration

**Files:**
- Create: `src/pages/RegisterProvider.jsx`

- [ ] **Step 1: Create RegisterProvider page**

```jsx
// src/pages/RegisterProvider.jsx
import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Logo } from '../components/Logo'
import { ThemeToggle } from '../components/ThemeToggle'
import { Button } from '../components/Button'

const CATEGORIAS = [
  'Diarista / Limpeza', 'Eletricista', 'Encanador', 'Marceneiro',
  'Pintor', 'Jardineiro', 'Pedreiro', 'Ar-condicionado', 'Outros',
]

const inputClass = "w-full px-4 py-3 rounded-lg border border-ink-900/15 dark:border-white/15 bg-transparent text-ink-900 dark:text-white placeholder-ink-500 focus:outline-none focus:ring-2 focus:ring-teal-400 text-sm"

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-xs font-bold text-ink-700 dark:text-ink-400 uppercase tracking-widest mb-2">{label}</label>
      {children}
    </div>
  )
}

export function RegisterProvider() {
  const navigate = useNavigate()
  const [form, setForm] = useState({
    nome: '', email: '', telefone: '', password: '',
    categoria: '', descricao: '', preco_medio: '', raio_km: '10',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { data, error: authErr } = await supabase.auth.signUp({ email: form.email, password: form.password })
    if (authErr) { setError(authErr.message); setLoading(false); return }

    const { error: userErr } = await supabase.from('users').insert({
      id: data.user.id,
      nome: form.nome,
      email: form.email,
      telefone: form.telefone,
      tipo: 'prestador',
    })
    if (userErr) { setError(userErr.message); setLoading(false); return }

    const { error: provErr } = await supabase.from('prestadores').insert({
      user_id: data.user.id,
      categoria: form.categoria,
      descricao: form.descricao,
      preco_medio: parseFloat(form.preco_medio) || null,
      raio_km: parseInt(form.raio_km) || 10,
      status: 'offline',
    })
    setLoading(false)
    if (provErr) { setError(provErr.message); return }
    navigate('/dashboard', { replace: true })
  }

  return (
    <div className="min-h-screen bg-[#FAF8F3] dark:bg-[#08141A] flex flex-col">
      <header className="flex items-center justify-between px-6 py-5 max-w-xl mx-auto w-full">
        <Link to="/"><Logo/></Link>
        <ThemeToggle/>
      </header>
      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md bg-white dark:bg-[#11222A] rounded-xl border border-ink-900/10 dark:border-white/10 shadow-sm p-8">
          <div className="inline-block text-xs font-bold text-ink-900 dark:text-teal-200 bg-teal-200 dark:bg-teal-400/25 px-3 py-1 rounded-full uppercase tracking-widest mb-6">Prestador</div>
          <h1 className="text-2xl font-extrabold text-ink-900 dark:text-white mb-2 tracking-tight">Cadastrar como prestador</h1>
          <p className="text-sm text-ink-600 dark:text-ink-400 mb-8">Ofereça seus serviços e receba propostas na sua área</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Field label="Nome completo">
              <input type="text" required value={form.nome} onChange={set('nome')} className={inputClass} placeholder="João Silva"/>
            </Field>
            <Field label="E-mail">
              <input type="email" required value={form.email} onChange={set('email')} className={inputClass} placeholder="seu@email.com"/>
            </Field>
            <Field label="Telefone">
              <input type="tel" value={form.telefone} onChange={set('telefone')} className={inputClass} placeholder="(11) 99999-9999"/>
            </Field>
            <Field label="Senha">
              <input type="password" required value={form.password} onChange={set('password')} className={inputClass} placeholder="Mínimo 6 caracteres" minLength={6}/>
            </Field>
            <Field label="Categoria">
              <select required value={form.categoria} onChange={set('categoria')} className={inputClass}>
                <option value="">Selecione uma categoria</option>
                {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Descrição (opcional)">
              <textarea value={form.descricao} onChange={set('descricao')} className={inputClass} rows={3} placeholder="Descreva seus serviços e experiência..."/>
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Preço médio (R$)">
                <input type="number" value={form.preco_medio} onChange={set('preco_medio')} className={inputClass} placeholder="150"/>
              </Field>
              <Field label="Raio (km)">
                <input type="number" value={form.raio_km} onChange={set('raio_km')} className={inputClass} placeholder="10" min={1} max={100}/>
              </Field>
            </div>
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <Button type="submit" className="w-full" size="lg" loading={loading}>Criar conta</Button>
          </form>

          <p className="text-center text-sm text-ink-500 dark:text-ink-600 mt-6">
            Já tem conta? <Link to="/login" className="text-teal-600 dark:text-teal-400 font-semibold hover:underline">Entrar</Link>
          </p>
        </div>
      </main>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/RegisterProvider.jsx
git commit -m "feat: provider registration with categoria/preco/raio"
```

---

## Task 9: Provider Dashboard

**Files:**
- Create: `src/pages/ProviderDashboard.jsx`

- [ ] **Step 1: Create ProviderDashboard**

```jsx
// src/pages/ProviderDashboard.jsx
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useGeolocation } from '../hooks/useGeolocation'
import { Header } from '../components/Header'
import { Button } from '../components/Button'
import { MapPin, Bell, CheckCircle, XCircle, Wifi, WifiOff, AlertTriangle } from 'lucide-react'

function StatusBadge({ status }) {
  const map = {
    online:  { color: 'bg-teal-400 text-ink-900', label: 'Online' },
    offline: { color: 'bg-ink-400/30 text-ink-600', label: 'Offline' },
    alerta:  { color: 'bg-amber/30 text-amber-800', label: 'Alerta' },
  }
  const { color, label } = map[status] || map.offline
  return <span className={`px-3 py-1 rounded-full text-xs font-bold ${color}`}>{label}</span>
}

function ProposalCard({ sol, onAccept, onReject }) {
  return (
    <div className="bg-white dark:bg-[#11222A] rounded-xl border border-ink-900/10 dark:border-white/10 p-5">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div>
          <p className="font-semibold text-ink-900 dark:text-white text-sm">{sol.descricao}</p>
          <p className="text-xs text-ink-500 dark:text-ink-600 mt-1">
            {new Date(sol.data_desejada).toLocaleString('pt-BR')}
          </p>
        </div>
        {sol.valor_oferecido && (
          <span className="text-teal-600 dark:text-teal-400 font-bold text-sm whitespace-nowrap">
            R$ {Number(sol.valor_oferecido).toFixed(2)}
          </span>
        )}
      </div>
      {sol.status === 'pendente' && (
        <div className="flex gap-2">
          <Button variant="primary" size="sm" onClick={() => onAccept(sol.id)} className="flex-1">
            <CheckCircle size={14}/> Aceitar
          </Button>
          <Button variant="outline" size="sm" onClick={() => onReject(sol.id)} className="flex-1">
            <XCircle size={14}/> Recusar
          </Button>
        </div>
      )}
      {sol.status !== 'pendente' && (
        <span className={`text-xs font-bold ${sol.status === 'aceita' ? 'text-teal-600' : 'text-red-500'}`}>
          {sol.status === 'aceita' ? '✓ Aceita' : '✗ Recusada'}
        </span>
      )}
    </div>
  )
}

export function ProviderDashboard() {
  const { profile } = useAuth()
  const { getPosition } = useGeolocation()
  const [tab, setTab] = useState('propostas')
  const [status, setStatus] = useState('offline')
  const [proposals, setProposals] = useState([])
  const [toggling, setToggling] = useState(false)
  const [gpsError, setGpsError] = useState('')

  // Load current status
  useEffect(() => {
    if (!profile) return
    supabase.from('prestadores').select('status').eq('user_id', profile.id).single()
      .then(({ data }) => { if (data) setStatus(data.status) })
  }, [profile])

  // Realtime proposals
  useEffect(() => {
    if (!profile) return
    // Initial fetch
    supabase.from('solicitacoes').select('*').eq('prestador_id', profile.id).order('created_at', { ascending: false })
      .then(({ data }) => setProposals(data || []))

    // Realtime subscription
    const channel = supabase.channel('provider-proposals')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'solicitacoes',
        filter: `prestador_id=eq.${profile.id}`,
      }, (payload) => {
        setProposals(prev => [payload.new, ...prev])
      })
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [profile])

  async function toggleOnline() {
    if (!profile) return
    setToggling(true)
    setGpsError('')
    const newStatus = status === 'online' ? 'offline' : 'online'

    let updateData = { status: newStatus }
    if (newStatus === 'online') {
      try {
        const coords = await getPosition()
        updateData.latitude = coords.lat
        updateData.longitude = coords.lng
        updateData.updated_at = new Date().toISOString()
      } catch {
        setGpsError('GPS negado — ficando online sem localização exata')
      }
    }

    await supabase.from('prestadores').update(updateData).eq('user_id', profile.id)
    setStatus(newStatus)
    setToggling(false)
  }

  async function setAlertMode() {
    await supabase.from('prestadores').update({ status: 'alerta' }).eq('user_id', profile.id)
    setStatus('alerta')
  }

  async function acceptAlertAndGoOnline() {
    setToggling(true)
    let updateData = { status: 'online', updated_at: new Date().toISOString() }
    try {
      const coords = await getPosition()
      updateData.latitude = coords.lat
      updateData.longitude = coords.lng
    } catch { /* proceed without GPS */ }
    await supabase.from('prestadores').update(updateData).eq('user_id', profile.id)
    setStatus('online')
    setToggling(false)
  }

  async function handleAccept(id) {
    await supabase.from('solicitacoes').update({ status: 'aceita' }).eq('id', id)
    setProposals(ps => ps.map(p => p.id === id ? { ...p, status: 'aceita' } : p))
  }

  async function handleReject(id) {
    await supabase.from('solicitacoes').update({ status: 'recusada' }).eq('id', id)
    setProposals(ps => ps.map(p => p.id === id ? { ...p, status: 'recusada' } : p))
  }

  const pendingCount = proposals.filter(p => p.status === 'pendente').length

  return (
    <div className="min-h-screen bg-[#FAF8F3] dark:bg-[#08141A]">
      <Header/>
      <div className="max-w-2xl mx-auto px-6 py-8">
        {/* Profile card */}
        <div className="bg-white dark:bg-[#11222A] rounded-xl border border-ink-900/10 dark:border-white/10 p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-extrabold text-ink-900 dark:text-white tracking-tight">{profile?.nome}</h1>
              <p className="text-sm text-ink-600 dark:text-ink-400 mt-0.5">{profile?.email}</p>
            </div>
            <StatusBadge status={status}/>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-ink-900/5 dark:bg-white/5 rounded-xl p-1 mb-6">
          {[
            { id: 'propostas', label: 'Propostas', badge: pendingCount },
            { id: 'alerta', label: 'Modo Alerta' },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                tab === t.id
                  ? 'bg-white dark:bg-[#11222A] text-ink-900 dark:text-white shadow-sm'
                  : 'text-ink-600 dark:text-ink-400'
              }`}
            >
              {t.label}
              {t.badge > 0 && <span className="w-5 h-5 rounded-full bg-teal-400 text-ink-900 text-xs font-bold grid place-items-center">{t.badge}</span>}
            </button>
          ))}
        </div>

        {/* Propostas tab */}
        {tab === 'propostas' && (
          <div className="space-y-4">
            {/* Toggle */}
            <div className="bg-white dark:bg-[#11222A] rounded-xl border border-ink-900/10 dark:border-white/10 p-5 flex items-center justify-between">
              <div>
                <p className="font-semibold text-ink-900 dark:text-white text-sm">
                  {status === 'online' ? 'Você está recebendo propostas' : 'Fique online para receber propostas'}
                </p>
                {gpsError && <p className="text-xs text-amber-600 mt-1">{gpsError}</p>}
              </div>
              <button
                onClick={toggleOnline}
                disabled={toggling}
                className={`relative w-14 h-7 rounded-full transition-colors duration-300 ${
                  status === 'online' ? 'bg-teal-400' : 'bg-ink-400/30'
                }`}
              >
                <span className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-all duration-300 ${
                  status === 'online' ? 'left-7' : 'left-0.5'
                }`}/>
              </button>
            </div>

            {proposals.length === 0 ? (
              <div className="text-center py-16 text-ink-500 dark:text-ink-600">
                <MapPin size={40} className="mx-auto mb-4 text-ink-300 dark:text-ink-700"/>
                <p className="font-medium">Nenhuma proposta ainda</p>
                <p className="text-sm mt-1">Fique online para receber solicitações</p>
              </div>
            ) : (
              proposals.map(sol => (
                <ProposalCard key={sol.id} sol={sol} onAccept={handleAccept} onReject={handleReject}/>
              ))
            )}
          </div>
        )}

        {/* Alerta tab */}
        {tab === 'alerta' && (
          <div className="space-y-4">
            <div className="bg-amber-50 dark:bg-amber-400/10 border border-amber-200 dark:border-amber-400/20 rounded-xl p-6 text-center">
              <AlertTriangle size={36} className="mx-auto mb-4 text-amber-500"/>
              <h2 className="text-lg font-bold text-ink-900 dark:text-white mb-2">Modo Alerta</h2>
              <p className="text-sm text-ink-600 dark:text-ink-400 mb-6">
                Receba notificações quando um cliente solicitar serviço na sua área, mesmo estando offline. Decida depois se quer aceitar e ficar online.
              </p>
              {status !== 'alerta' ? (
                <Button variant="dark" onClick={setAlertMode}>
                  <Bell size={16}/> Ativar Modo Alerta
                </Button>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">✓ Modo Alerta ativo</p>
                  <Button onClick={acceptAlertAndGoOnline} loading={toggling}>
                    <Wifi size={16}/> Aceitar e ficar Online
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => {
                    supabase.from('prestadores').update({ status: 'offline' }).eq('user_id', profile.id)
                    setStatus('offline')
                  }}>Desativar</Button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/ProviderDashboard.jsx
git commit -m "feat: provider dashboard with online toggle, GPS, realtime proposals, alert mode"
```

---

## Task 10: Client Map + Solicitation Flow

**Files:**
- Create: `src/pages/ClientMap.jsx`

- [ ] **Step 1: Add Leaflet CSS to index.html head**

Add inside `<head>` in `index.html`:
```html
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
```

- [ ] **Step 2: Create ClientMap page**

```jsx
// src/pages/ClientMap.jsx
import { useState, useEffect, useCallback } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { Header } from '../components/Header'
import { Button } from '../components/Button'
import { X, Star, MapPin, Send } from 'lucide-react'

// Custom teal marker for providers
const providerIcon = L.divIcon({
  className: '',
  html: `<div style="
    width:40px;height:40px;border-radius:50%;
    background:#20D4B8;border:3px solid white;
    box-shadow:0 4px 12px rgba(32,212,184,0.5);
    display:grid;place-items:center;font-size:18px;
  ">🔧</div>`,
  iconSize: [40, 40],
  iconAnchor: [20, 20],
})

function RecenterMap({ center }) {
  const map = useMap()
  useEffect(() => { if (center) map.flyTo(center, 13) }, [center, map])
  return null
}

function SolicitacaoModal({ provider, clientId, onClose, onSent }) {
  const [form, setForm] = useState({ descricao: '', data_desejada: '', valor_oferecido: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))

  const inputClass = "w-full px-4 py-3 rounded-lg border border-ink-900/15 dark:border-white/15 bg-transparent text-ink-900 dark:text-white placeholder-ink-500 focus:outline-none focus:ring-2 focus:ring-teal-400 text-sm"

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
            <h2 className="text-lg font-extrabold text-ink-900 dark:text-white tracking-tight">Enviar proposta</h2>
            <p className="text-sm text-ink-600 dark:text-ink-400">{provider.nome} · {provider.categoria}</p>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-full hover:bg-ink-900/5 dark:hover:bg-white/10 grid place-items-center text-ink-600">
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

export function ClientMap() {
  const { profile } = useAuth()
  const [providers, setProviders] = useState([])
  const [selected, setSelected] = useState(null)
  const [soliciting, setSoliciting] = useState(null)
  const [sent, setSent] = useState(false)
  const [mapCenter, setMapCenter] = useState([-23.55, -46.63]) // São Paulo default

  useEffect(() => {
    // Try to get user's location for initial center
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(pos => {
        setMapCenter([pos.coords.latitude, pos.coords.longitude])
      })
    }

    // Load online providers
    supabase
      .from('prestadores')
      .select('*, users(nome, foto_url, telefone)')
      .eq('status', 'online')
      .not('latitude', 'is', null)
      .then(({ data }) => {
        setProviders((data || []).map(p => ({ ...p, nome: p.users?.nome, foto_url: p.users?.foto_url })))
      })

    // Realtime: track provider status changes
    const channel = supabase.channel('map-providers')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'prestadores' }, () => {
        supabase
          .from('prestadores')
          .select('*, users(nome, foto_url, telefone)')
          .eq('status', 'online')
          .not('latitude', 'is', null)
          .then(({ data }) => {
            setProviders((data || []).map(p => ({ ...p, nome: p.users?.nome, foto_url: p.users?.foto_url })))
          })
      })
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [])

  function handleSent() {
    setSoliciting(null)
    setSent(true)
    setTimeout(() => setSent(false), 4000)
  }

  return (
    <div className="min-h-screen bg-[#FAF8F3] dark:bg-[#08141A] flex flex-col">
      <Header/>
      <div className="flex-1 flex flex-col md:flex-row gap-0 max-w-7xl mx-auto w-full px-4 py-6 gap-4">
        {/* Map */}
        <div className="flex-1 rounded-xl overflow-hidden" style={{ minHeight: '500px' }}>
          <MapContainer center={mapCenter} zoom={13} style={{ height: '100%', width: '100%' }}>
            <TileLayer
              attribution='&copy; <a href="https://openstreetmap.org">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <RecenterMap center={mapCenter}/>
            {providers.map(p => p.latitude && p.longitude ? (
              <Marker
                key={p.user_id}
                position={[p.latitude, p.longitude]}
                icon={providerIcon}
                eventHandlers={{ click: () => setSelected(p) }}
              >
                <Popup>
                  <div className="font-sans p-1">
                    <p className="font-bold">{p.nome}</p>
                    <p className="text-xs text-gray-500">{p.categoria}</p>
                  </div>
                </Popup>
              </Marker>
            ) : null)}
          </MapContainer>
        </div>

        {/* Provider list / detail panel */}
        <div className="w-full md:w-80 flex flex-col gap-3">
          <div className="bg-white dark:bg-[#11222A] rounded-xl border border-ink-900/10 dark:border-white/10 p-4">
            <h2 className="font-extrabold text-ink-900 dark:text-white tracking-tight mb-1">
              {providers.length} prestador{providers.length !== 1 ? 'es' : ''} online
            </h2>
            <p className="text-xs text-ink-500 dark:text-ink-600">Clique no pin para ver o perfil</p>
          </div>

          {selected && (
            <div className="bg-white dark:bg-[#11222A] rounded-xl border border-teal-300 p-5 shadow-md">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="font-bold text-ink-900 dark:text-white">{selected.nome}</h3>
                  <p className="text-xs text-ink-600 dark:text-ink-400 mt-0.5">{selected.categoria}</p>
                </div>
                <button onClick={() => setSelected(null)} className="text-ink-400 hover:text-ink-700">
                  <X size={16}/>
                </button>
              </div>
              {selected.descricao && <p className="text-sm text-ink-600 dark:text-ink-400 mb-4 leading-relaxed">{selected.descricao}</p>}
              {selected.preco_medio && (
                <p className="text-sm font-semibold text-ink-900 dark:text-white mb-4">
                  A partir de <span className="text-teal-600 dark:text-teal-400">R$ {Number(selected.preco_medio).toFixed(2)}</span>
                </p>
              )}
              <Button className="w-full" onClick={() => setSoliciting(selected)}>
                <Send size={14}/> Solicitar serviço
              </Button>
            </div>
          )}

          {providers.slice(0, 5).map(p => (
            <button
              key={p.user_id}
              onClick={() => { setSelected(p); setMapCenter([p.latitude, p.longitude]) }}
              className={`text-left bg-white dark:bg-[#11222A] rounded-xl border p-4 transition-all hover:-translate-y-0.5 hover:shadow-md ${
                selected?.user_id === p.user_id ? 'border-teal-400' : 'border-ink-900/10 dark:border-white/10'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-teal-100 dark:bg-teal-400/15 grid place-items-center text-teal-700 dark:text-teal-300 font-bold text-sm flex-shrink-0">
                  {p.nome?.[0] || '?'}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-ink-900 dark:text-white text-sm truncate">{p.nome}</p>
                  <p className="text-xs text-ink-500 dark:text-ink-600 truncate">{p.categoria}</p>
                </div>
                {p.preco_medio && (
                  <span className="ml-auto text-xs font-bold text-teal-600 dark:text-teal-400 whitespace-nowrap">
                    R$ {Number(p.preco_medio).toFixed(0)}
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>

      {sent && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-ink-900 text-white px-6 py-3 rounded-full text-sm font-semibold shadow-xl z-50 flex items-center gap-2">
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

- [ ] **Step 3: Commit**

```bash
git add src/pages/ClientMap.jsx
git commit -m "feat: client map with Leaflet, online providers, solicitation modal, realtime updates"
```

---

## Task 11: Final polish + run

- [ ] **Step 1: Remove Vite default assets**

```bash
rm -f src/assets/react.svg public/vite.svg src/App.css
```

- [ ] **Step 2: Verify tailwind dark mode works**

In `tailwind.config.js` confirm `darkMode: 'class'` is set (done in Task 1).
In `ThemeToggle.jsx` confirm it toggles `document.documentElement.classList` (done in Task 4).

- [ ] **Step 3: Start dev server and smoke-test**

```bash
npm run dev
```

Test flow:
- Open http://localhost:5173 — Entry screen shows two cards
- Click "Quero contratar" → RegisterClient form
- Fill form → creates client account → redirects to /mapa
- Map loads with Leaflet tiles
- Open new incognito window → "Quero prestar serviço" → RegisterProvider → /dashboard
- On dashboard: click online toggle → GPS prompt → status updates to Online
- On client map: provider pin appears
- Click pin → provider panel → "Solicitar serviço" → modal opens → fill form → send
- On provider dashboard: new proposal appears in real-time

- [ ] **Step 4: Final commit**

```bash
git add .
git commit -m "feat: HomeFix MVP — entry/auth/map/dashboard with realtime Supabase"
```

---

## Task 12: Environment Setup Reminder

Before running, ensure `.env.local` exists with:
```
VITE_SUPABASE_URL=https://<your-project>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-anon-key>
```

And that the SQL from `supabase/schema.sql` has been run in your Supabase project's SQL Editor.

---

## Scope Boundaries (what's NOT in this plan)

- Photo upload for providers (foto_url column exists, upload UI deferred)
- Push notifications (alert mode uses in-app realtime only)
- Payment processing
- Ratings/reviews UI
- Admin panel
