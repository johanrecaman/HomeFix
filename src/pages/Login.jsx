import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Logo } from '../components/Logo'
import { ThemeToggle } from '../components/ThemeToggle'
import { Button } from '../components/Button'

const inputClass = "w-full px-4 py-3 rounded-lg border border-ink-900/15 dark:border-white/15 bg-transparent text-ink-900 dark:text-white placeholder-ink-500 focus:outline-none focus:ring-2 focus:ring-teal-400 text-sm"

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
          <h1 className="text-2xl font-extrabold text-ink-900 dark:text-white mb-2 tracking-tight"
            style={{ letterSpacing: '-0.03em' }}>
            Bem-vindo de volta
          </h1>
          <p className="text-sm text-ink-600 dark:text-ink-400 mb-8">Entre com sua conta HomeFix</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-ink-700 dark:text-ink-400 uppercase tracking-widest mb-2">E-mail</label>
              <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                className={inputClass} placeholder="seu@email.com"/>
            </div>
            <div>
              <label className="block text-xs font-bold text-ink-700 dark:text-ink-400 uppercase tracking-widest mb-2">Senha</label>
              <input type="password" required value={password} onChange={e => setPassword(e.target.value)}
                className={inputClass} placeholder="••••••••"/>
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
