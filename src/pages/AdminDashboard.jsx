import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Header } from '../components/Header'
import { ProviderAdminCard } from '../components/ProviderAdminCard'
import { AdminTableSkeleton } from '../components/AdminTableSkeleton'
import { ShieldCheck } from 'lucide-react'

const FILTERS = [
  { id: 'all', label: 'Todos' },
  { id: 'active', label: 'Ativos' },
  { id: 'banned', label: 'Banidos' },
]

async function fetchAllProviders() {
  const { data } = await supabase
    .from('prestadores')
    .select('*, users(nome, email, foto_url)')
    .order('approval_status', { ascending: true })
  return (data || []).map(p => ({
    ...p,
    nome: p.users?.nome,
    email: p.users?.email,
    foto_url: p.users?.foto_url,
  }))
}

export function AdminDashboard() {
  const [providers, setProviders] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    fetchAllProviders().then(data => {
      setProviders(data)
      setLoading(false)
    })
  }, [])

  function handleUpdate(userId, newApprovalStatus) {
    setProviders(ps =>
      ps.map(p => p.user_id === userId ? { ...p, approval_status: newApprovalStatus } : p)
    )
  }

  const filtered = providers.filter(p => {
    if (filter === 'all') return true
    return p.approval_status === filter
  })

  const counts = {
    all: providers.length,
    active: providers.filter(p => p.approval_status === 'active').length,
    banned: providers.filter(p => p.approval_status === 'banned').length,
  }

  return (
    <div className="min-h-screen bg-[#FAF8F3] dark:bg-[#08141A]">
      <Header/>
      <div className="max-w-3xl mx-auto px-6 py-8">

        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-extrabold text-ink-900 dark:text-white tracking-tight" style={{ letterSpacing: '-0.025em' }}>
              Painel Admin
            </h1>
            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-teal-400 text-ink-900">Admin</span>
          </div>
          <p className="text-sm text-ink-500 dark:text-ink-600">Gerencie os prestadores da plataforma</p>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1 bg-ink-900/5 dark:bg-white/5 rounded-xl p-1 mb-6">
          {FILTERS.map(f => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                filter === f.id
                  ? 'bg-white dark:bg-[#11222A] text-ink-900 dark:text-white shadow-sm'
                  : 'text-ink-600 dark:text-ink-400'
              }`}
            >
              {f.label}
              {!loading && (
                <span className="text-xs font-bold opacity-60">({counts[f.id]})</span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <AdminTableSkeleton/>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-ink-500 dark:text-ink-600">
            <ShieldCheck size={40} className="mx-auto mb-4 text-ink-300 dark:text-ink-700"/>
            <p className="font-medium">
              {filter === 'banned' ? 'Nenhum prestador banido' : 'Nenhum prestador encontrado'}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {filtered.map(p => (
              <ProviderAdminCard key={p.user_id} provider={p} onUpdate={handleUpdate}/>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
