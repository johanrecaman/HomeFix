import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { Header } from '../components/Header'
import { Button } from '../components/Button'
import { MapPin, Bell, CheckCircle, XCircle, AlertTriangle, Wifi } from 'lucide-react'

function getGPSCoords() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) { reject(new Error('Geolocalização não suportada')); return }
    navigator.geolocation.getCurrentPosition(
      pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => reject(new Error('Permissão de localização negada')),
      { enableHighAccuracy: true, timeout: 10000 }
    )
  })
}

function StatusBadge({ status }) {
  const map = {
    online:  { cls: 'bg-teal-400 text-ink-900', label: 'Online' },
    offline: { cls: 'bg-ink-400/30 text-ink-600 dark:text-ink-400', label: 'Offline' },
    alerta:  { cls: 'bg-amber/30 text-amber-800 dark:text-amber-300', label: 'Alerta' },
  }
  const { cls, label } = map[status] || map.offline
  return <span className={`px-3 py-1 rounded-full text-xs font-bold ${cls}`}>{label}</span>
}

function ProposalCard({ sol, onAccept, onReject }) {
  return (
    <div className="bg-white dark:bg-[#11222A] rounded-xl border border-ink-900/10 dark:border-white/10 p-5">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div>
          <p className="font-semibold text-ink-900 dark:text-white text-sm">{sol.descricao}</p>
          <p className="text-xs text-ink-500 dark:text-ink-600 mt-1">
            {new Date(sol.data_desejada).toLocaleString('pt-BR')}
          </p>
        </div>
        {sol.valor_oferecido && (
          <span className="text-teal-600 dark:text-teal-400 font-bold text-sm whitespace-nowrap">
            R$ {Number(sol.valor_oferecido).toFixed(2)}
          </span>
        )}
      </div>
      {sol.status === 'pendente' && (
        <div className="flex gap-2">
          <Button variant="primary" size="sm" onClick={() => onAccept(sol.id)} className="flex-1">
            <CheckCircle size={14}/> Aceitar
          </Button>
          <Button variant="outline" size="sm" onClick={() => onReject(sol.id)} className="flex-1">
            <XCircle size={14}/> Recusar
          </Button>
        </div>
      )}
      {sol.status !== 'pendente' && (
        <span className={`text-xs font-bold ${sol.status === 'aceita' ? 'text-teal-600 dark:text-teal-400' : 'text-red-500'}`}>
          {sol.status === 'aceita' ? '✓ Aceita' : '✗ Recusada'}
        </span>
      )}
    </div>
  )
}

export function ProviderDashboard() {
  const { profile } = useAuth()
  const [tab, setTab] = useState('propostas')
  const [status, setStatus] = useState('offline')
  const [proposals, setProposals] = useState([])
  const [toggling, setToggling] = useState(false)
  const [gpsError, setGpsError] = useState('')

  useEffect(() => {
    if (!profile) return
    supabase.from('prestadores').select('status').eq('user_id', profile.id).single()
      .then(({ data }) => { if (data) setStatus(data.status) })
  }, [profile])

  useEffect(() => {
    if (!profile) return
    supabase.from('solicitacoes').select('*').eq('prestador_id', profile.id).order('created_at', { ascending: false })
      .then(({ data }) => setProposals(data || []))

    const channel = supabase.channel('provider-proposals-' + profile.id)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'solicitacoes',
        filter: `prestador_id=eq.${profile.id}`,
      }, (payload) => {
        setProposals(prev => [payload.new, ...prev])
      })
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [profile])

  async function toggleOnline() {
    if (!profile) return
    setToggling(true)
    setGpsError('')
    const newStatus = status === 'online' ? 'offline' : 'online'
    const updateData = { status: newStatus }

    if (newStatus === 'online') {
      try {
        const coords = await getGPSCoords()
        updateData.latitude = coords.lat
        updateData.longitude = coords.lng
        updateData.updated_at = new Date().toISOString()
      } catch {
        setGpsError('GPS negado — ficando online sem localização exata')
      }
    }

    await supabase.from('prestadores').update(updateData).eq('user_id', profile.id)
    setStatus(newStatus)
    setToggling(false)
  }

  async function setAlertMode() {
    if (!profile) return
    await supabase.from('prestadores').update({ status: 'alerta' }).eq('user_id', profile.id)
    setStatus('alerta')
  }

  async function acceptAlertAndGoOnline() {
    if (!profile) return
    setToggling(true)
    const updateData = { status: 'online', updated_at: new Date().toISOString() }
    try {
      const coords = await getGPSCoords()
      updateData.latitude = coords.lat
      updateData.longitude = coords.lng
    } catch { /* proceed without GPS */ }
    await supabase.from('prestadores').update(updateData).eq('user_id', profile.id)
    setStatus('online')
    setToggling(false)
  }

  async function deactivateAlert() {
    if (!profile) return
    await supabase.from('prestadores').update({ status: 'offline' }).eq('user_id', profile.id)
    setStatus('offline')
  }

  async function handleAccept(id) {
    await supabase.from('solicitacoes').update({ status: 'aceita' }).eq('id', id)
    setProposals(ps => ps.map(p => p.id === id ? { ...p, status: 'aceita' } : p))
  }

  async function handleReject(id) {
    await supabase.from('solicitacoes').update({ status: 'recusada' }).eq('id', id)
    setProposals(ps => ps.map(p => p.id === id ? { ...p, status: 'recusada' } : p))
  }

  const pendingCount = proposals.filter(p => p.status === 'pendente').length

  return (
    <div className="min-h-screen bg-[#FAF8F3] dark:bg-[#08141A]">
      <Header/>
      <div className="max-w-2xl mx-auto px-6 py-8">
        {/* Profile card */}
        <div className="bg-white dark:bg-[#11222A] rounded-xl border border-ink-900/10 dark:border-white/10 p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-extrabold text-ink-900 dark:text-white tracking-tight"
                style={{ letterSpacing: '-0.025em' }}>{profile?.nome}</h1>
              <p className="text-sm text-ink-600 dark:text-ink-400 mt-0.5">{profile?.email}</p>
            </div>
            <StatusBadge status={status}/>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-ink-900/5 dark:bg-white/5 rounded-xl p-1 mb-6">
          {[
            { id: 'propostas', label: 'Propostas', badge: pendingCount },
            { id: 'alerta', label: 'Modo Alerta' },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                tab === t.id
                  ? 'bg-white dark:bg-[#11222A] text-ink-900 dark:text-white shadow-sm'
                  : 'text-ink-600 dark:text-ink-400'
              }`}>
              {t.label}
              {t.badge > 0 && (
                <span className="w-5 h-5 rounded-full bg-teal-400 text-ink-900 text-xs font-bold grid place-items-center">
                  {t.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {tab === 'propostas' && (
          <div className="space-y-4">
            <div className="bg-white dark:bg-[#11222A] rounded-xl border border-ink-900/10 dark:border-white/10 p-5 flex items-center justify-between">
              <div>
                <p className="font-semibold text-ink-900 dark:text-white text-sm">
                  {status === 'online' ? 'Você está recebendo propostas' : 'Fique online para receber propostas'}
                </p>
                {gpsError && <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">{gpsError}</p>}
              </div>
              <button onClick={toggleOnline} disabled={toggling}
                className={`relative w-14 h-7 rounded-full transition-colors duration-300 disabled:opacity-50 ${
                  status === 'online' ? 'bg-teal-400' : 'bg-ink-400/30'
                }`}>
                <span className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-all duration-300 ${
                  status === 'online' ? 'left-7' : 'left-0.5'
                }`}/>
              </button>
            </div>

            {proposals.length === 0 ? (
              <div className="text-center py-16 text-ink-500 dark:text-ink-600">
                <MapPin size={40} className="mx-auto mb-4 text-ink-300 dark:text-ink-700"/>
                <p className="font-medium">Nenhuma proposta ainda</p>
                <p className="text-sm mt-1">Fique online para receber solicitações</p>
              </div>
            ) : (
              proposals.map(sol => (
                <ProposalCard key={sol.id} sol={sol} onAccept={handleAccept} onReject={handleReject}/>
              ))
            )}
          </div>
        )}

        {tab === 'alerta' && (
          <div className="bg-amber-50 dark:bg-amber-400/10 border border-amber-200 dark:border-amber-400/20 rounded-xl p-6 text-center">
            <AlertTriangle size={36} className="mx-auto mb-4 text-amber-500"/>
            <h2 className="text-lg font-bold text-ink-900 dark:text-white mb-2">Modo Alerta</h2>
            <p className="text-sm text-ink-600 dark:text-ink-400 mb-6">
              Receba notificações quando um cliente solicitar serviço na sua área, mesmo estando offline. Decida depois se quer aceitar e ficar online.
            </p>
            {status !== 'alerta' ? (
              <Button variant="dark" onClick={setAlertMode}>
                <Bell size={16}/> Ativar Modo Alerta
              </Button>
            ) : (
              <div className="space-y-3">
                <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">✓ Modo Alerta ativo</p>
                <Button onClick={acceptAlertAndGoOnline} loading={toggling}>
                  <Wifi size={16}/> Aceitar e ficar Online
                </Button>
                <div>
                  <Button variant="ghost" size="sm" onClick={deactivateAlert}>Desativar</Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
