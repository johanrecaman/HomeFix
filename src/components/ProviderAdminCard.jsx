import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { ShieldOff, ShieldCheck } from 'lucide-react'

const STATUS_LABEL = {
  online: { label: 'Online', cls: 'bg-teal-100 text-teal-700 dark:bg-teal-400/15 dark:text-teal-300' },
  offline: { label: 'Offline', cls: 'bg-ink-100 text-ink-500 dark:bg-white/5 dark:text-ink-400' },
  alerta: { label: 'Alerta', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300' },
}

export function ProviderAdminCard({ provider, onUpdate }) {
  const [loading, setLoading] = useState(false)
  const isBanned = provider.approval_status === 'banned'
  const statusInfo = STATUS_LABEL[provider.status] || STATUS_LABEL.offline

  async function toggleBan() {
    setLoading(true)
    const newStatus = isBanned ? 'active' : 'banned'
    const { error } = await supabase
      .from('prestadores')
      .update({ approval_status: newStatus })
      .eq('user_id', provider.user_id)
    setLoading(false)
    if (!error) onUpdate(provider.user_id, newStatus)
  }

  return (
    <div className={`bg-white dark:bg-[#11222A] rounded-xl border p-5 transition-all ${
      isBanned
        ? 'border-red-200 dark:border-red-400/20 opacity-60'
        : 'border-ink-900/10 dark:border-white/10'
    }`}>
      <div className="flex items-center gap-4">
        <div className="w-11 h-11 rounded-full bg-teal-100 dark:bg-teal-400/15 grid place-items-center text-teal-700 dark:text-teal-300 font-bold flex-shrink-0">
          {provider.foto_url
            ? <img src={provider.foto_url} alt={provider.nome} className="w-full h-full rounded-full object-cover"/>
            : provider.nome?.[0]?.toUpperCase() || '?'
          }
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-ink-900 dark:text-white text-sm">{provider.nome}</p>
            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${statusInfo.cls}`}>
              {statusInfo.label}
            </span>
          </div>
          <p className="text-xs text-ink-500 dark:text-ink-600 truncate">{provider.email}</p>
          <p className="text-xs text-ink-500 dark:text-ink-600">{provider.categoria}</p>
        </div>
        <div className="flex-shrink-0 text-right">
          {provider.avaliacao && (
            <p className="text-xs text-amber-500 mb-2">★ {Number(provider.avaliacao).toFixed(1)}</p>
          )}
          <button
            onClick={toggleBan}
            disabled={loading}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors disabled:opacity-50 ${
              isBanned
                ? 'bg-teal-50 dark:bg-teal-400/10 text-teal-700 dark:text-teal-300 hover:bg-teal-100'
                : 'bg-red-50 dark:bg-red-400/10 text-red-600 dark:text-red-400 hover:bg-red-100'
            }`}
          >
            {isBanned
              ? <><ShieldCheck size={13}/> Reativar</>
              : <><ShieldOff size={13}/> Banir</>
            }
          </button>
        </div>
      </div>
    </div>
  )
}
