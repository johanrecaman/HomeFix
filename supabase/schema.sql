-- Enable uuid extension
create extension if not exists "uuid-ossp";

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
