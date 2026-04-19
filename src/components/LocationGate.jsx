import { useEffect } from 'react'
import { MapPin, AlertCircle } from 'lucide-react'
import { useGeolocation } from '../hooks/useGeolocation'

export function LocationGate({ children }) {
  const { state, coords, request } = useGeolocation()

  useEffect(() => { request() }, [request])

  if (state === 'idle' || state === 'requesting') {
    return (
      <div className="flex-1 grid place-items-center" style={{ minHeight: 'calc(100vh - 76px)' }}>
        <div className="flex flex-col items-center gap-4 text-center max-w-xs px-6">
          <div className="w-16 h-16 rounded-2xl bg-teal-100 dark:bg-teal-400/15 grid place-items-center">
            <MapPin size={28} className="text-teal-600 dark:text-teal-400 animate-pulse"/>
          </div>
          <h2 className="text-xl font-extrabold text-ink-900 dark:text-white" style={{ letterSpacing: '-0.025em' }}>
            Aguardando localização
          </h2>
          <p className="text-sm text-ink-500 dark:text-ink-600 leading-relaxed">
            Permita o acesso à sua localização para ver os prestadores disponíveis perto de você.
          </p>
          <span className="w-6 h-6 border-2 border-teal-400 border-t-transparent rounded-full animate-spin"/>
        </div>
      </div>
    )
  }

  if (state === 'denied' || state === 'unsupported') {
    return (
      <div className="flex-1 grid place-items-center" style={{ minHeight: 'calc(100vh - 76px)' }}>
        <div className="flex flex-col items-center gap-4 text-center max-w-xs px-6">
          <div className="w-16 h-16 rounded-2xl bg-red-50 dark:bg-red-500/10 grid place-items-center">
            <AlertCircle size={28} className="text-red-500"/>
          </div>
          <h2 className="text-xl font-extrabold text-ink-900 dark:text-white" style={{ letterSpacing: '-0.025em' }}>
            Localização necessária
          </h2>
          <p className="text-sm text-ink-500 dark:text-ink-600 leading-relaxed">
            {state === 'unsupported'
              ? 'Seu navegador não suporta geolocalização. Tente em outro dispositivo.'
              : 'Permita o acesso à localização nas configurações do navegador e recarregue a página.'}
          </p>
          {state === 'denied' && (
            <button
              onClick={() => window.location.reload()}
              className="px-5 py-2.5 rounded-xl bg-teal-400 text-ink-900 font-bold text-sm hover:bg-teal-300 transition-colors"
            >
              Tentar novamente
            </button>
          )}
        </div>
      </div>
    )
  }

  if (!coords) return null
  return children(coords)
}
