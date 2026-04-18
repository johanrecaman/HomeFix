import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Logo } from '../components/Logo'
import { ThemeToggle } from '../components/ThemeToggle'
import { Button } from '../components/Button'

const inputClass = "w-full px-4 py-3 rounded-lg border border-ink-900/15 dark:border-white/15 bg-transparent text-ink-900 dark:text-white placeholder-ink-500 focus:outline-none focus:ring-2 focus:ring-teal-400 text-sm"

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-xs font-bold text-ink-700 dark:text-ink-400 uppercase tracking-widest mb-2">{label}</label>
      {children}
    </div>
  )
}

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
          <div className="inline-block text-xs font-bold text-teal-800 dark:text-teal-300 bg-teal-100 dark:bg-teal-400/15 px-3 py-1 rounded-full uppercase tracking-widest mb-6">
            Cliente
          </div>
          <h1 className="text-2xl font-extrabold text-ink-900 dark:text-white mb-2 tracking-tight"
            style={{ letterSpacing: '-0.03em' }}>
            Criar sua conta
          </h1>
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
            Já tem conta?{' '}
            <Link to="/login" className="text-teal-600 dark:text-teal-400 font-semibold hover:underline">Entrar</Link>
          </p>
        </div>
      </main>
    </div>
  )
}
