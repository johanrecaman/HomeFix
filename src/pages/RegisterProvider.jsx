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
          <div className="inline-block text-xs font-bold text-ink-900 dark:text-teal-200 bg-teal-200 dark:bg-teal-400/25 px-3 py-1 rounded-full uppercase tracking-widest mb-6">
            Prestador
          </div>
          <h1 className="text-2xl font-extrabold text-ink-900 dark:text-white mb-2 tracking-tight"
            style={{ letterSpacing: '-0.03em' }}>
            Cadastrar como prestador
          </h1>
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
            Já tem conta?{' '}
            <Link to="/login" className="text-teal-600 dark:text-teal-400 font-semibold hover:underline">Entrar</Link>
          </p>
        </div>
      </main>
    </div>
  )
}
