import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { Logo } from '../components/Logo'
import { ThemeToggle } from '../components/ThemeToggle'
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
      <header className="flex items-center justify-between px-6 py-5 max-w-6xl mx-auto w-full">
        <Logo/>
        <ThemeToggle/>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-6 py-16 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white dark:bg-ink-900/50 border border-ink-900/10 dark:border-white/10 text-ink-700 dark:text-ink-400 text-sm font-medium mb-8 shadow-sm">
          <span className="w-5 h-5 rounded-full bg-teal-400 grid place-items-center text-ink-900">
            <Shield size={11}/>
          </span>
          +12.000 profissionais verificados no Brasil
        </div>

        <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-ink-900 dark:text-white mb-6 leading-tight"
          style={{ letterSpacing: '-0.035em' }}>
          Tudo que sua casa<br/>precisa,{' '}
          <span className="text-teal-600 dark:text-teal-300">em um clique.</span>
        </h1>
        <p className="text-lg md:text-xl text-ink-600 dark:text-ink-400 max-w-xl mb-12 leading-relaxed">
          Encontre profissionais verificados para limpeza, reparos, instalações e muito mais — sem surpresas.
        </p>

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
            <span className="absolute bottom-6 right-6 w-8 h-8 rounded-full bg-teal-400 grid place-items-center text-ink-900 text-lg opacity-0 group-hover:opacity-100 transition-opacity">→</span>
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
            <span className="absolute bottom-6 right-6 w-8 h-8 rounded-full bg-teal-400 grid place-items-center text-ink-900 text-lg opacity-0 group-hover:opacity-100 transition-opacity">→</span>
          </button>
        </div>

        <p className="text-sm text-ink-500 dark:text-ink-600">
          Já tem conta?{' '}
          <button onClick={() => navigate('/login')} className="text-teal-600 dark:text-teal-400 font-semibold hover:underline">
            Entrar
          </button>
        </p>

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
