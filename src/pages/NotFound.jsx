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
