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
    <header className="sticky top-0 z-50 bg-white/80 dark:bg-[#08141A]/80 backdrop-blur-md border-b border-ink-900/10 dark:border-white/10">
      <div className="max-w-6xl mx-auto px-6 h-[76px] flex items-center justify-between">
        <Link to="/"><Logo/></Link>
        <div className="flex items-center gap-2">
          <ThemeToggle/>
          {profile ? (
            <>
              <span className="hidden md:block text-sm text-ink-600 dark:text-ink-400 font-medium">{profile.nome}</span>
              <Button variant="ghost" size="sm" onClick={handleSignOut}>Sair</Button>
              <Button size="sm" onClick={() => navigate(
                profile.is_admin ? '/admin' :
                profile.tipo === 'prestador' ? '/dashboard' : '/mapa'
              )}>
                {profile.is_admin ? 'Painel Admin' : profile.tipo === 'prestador' ? 'Dashboard' : 'Buscar'}
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
