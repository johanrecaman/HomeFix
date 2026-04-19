import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { Header } from '../components/Header'
import { Button } from '../components/Button'
import { ClipboardList, History, User } from 'lucide-react'

const TABS = [
  { id: 'propostas', label: 'Propostas', icon: ClipboardList },
  { id: 'historico', label: 'Histórico', icon: History },
  { id: 'perfil', label: 'Perfil', icon: User },
]

const STATUS_STYLES = {
  pendente:  { label: 'Pendente',  bg: 'bg-amber-50 dark:bg-amber-400/10',  text: 'text-amber-700 dark:text-amber-300',  dot: 'bg-amber-400' },
  aceita:    { label: 'Aceita',    bg: 'bg-teal-50 dark:bg-teal-400/10',    text: 'text-teal-700 dark:text-teal-300',    dot: 'bg-teal-400' },
  recusada:  { label: 'Recusada', bg: 'bg-red-50 dark:bg-red-500/10',      text: 'text-red-600 dark:text-red-400',      dot: 'bg-red-500' },
}

function ProposalCard({ proposal }) {
  const s = STATUS_STYLES[proposal.status] || STATUS_STYLES.pendente
  const date = new Date(proposal.data_desejada)
  return (
    <div className="bg-white dark:bg-[#11222A] rounded-xl border border-ink-900/10 dark:border-white/10 p-5">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <p className="font-semibold text-ink-900 dark:text-white text-sm leading-snug">{proposal.descricao}</p>
          <p className="text-xs text-ink-500 dark:text-ink-600 mt-1">
            {date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
        <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold flex-shrink-0 ${s.bg} ${s.text}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`}/>
          {s.label}
        </span>
      </div>
      {proposal.valor_oferecido && (
        <p className="text-xs text-ink-600 dark:text-ink-400">
          Valor oferecido: <span className="font-bold text-teal-600 dark:text-teal-400">R$ {Number(proposal.valor_oferecido).toFixed(2)}</span>
        </p>
      )}
    </div>
  )
}

function PropostasTab({ clientId }) {
  const [proposals, setProposals] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    supabase
      .from('solicitacoes')
      .select('*')
      .eq('cliente_id', clientId)
      .in('status', ['pendente'])
      .order('created_at', { ascending: false })
      .then(({ data, error: err }) => {
        if (err) {
          setError(err.message)
        } else {
          setProposals(data || [])
        }
        setLoading(false)
      })
  }, [clientId])

  if (loading) return (
    <div className="flex flex-col gap-3">
      {[1, 2, 3].map(i => <div key={i} className="h-24 rounded-xl bg-ink-900/5 dark:bg-white/5 animate-pulse"/>)}
    </div>
  )

  if (error) return (
    <div className="text-center py-16 text-red-500">
      <p className="font-medium text-sm">Erro ao carregar propostas</p>
      <p className="text-xs mt-1">{error}</p>
    </div>
  )

  if (proposals.length === 0) return (
    <div className="text-center py-16 text-ink-500 dark:text-ink-600">
      <ClipboardList size={36} className="mx-auto mb-3 text-ink-300 dark:text-ink-700"/>
      <p className="font-medium text-sm">Nenhuma proposta pendente</p>
      <p className="text-xs mt-1">Suas propostas em aberto aparecerão aqui</p>
    </div>
  )

  return (
    <div className="flex flex-col gap-3">
      {proposals.map(p => <ProposalCard key={p.id} proposal={p}/>)}
    </div>
  )
}

function HistoricoTab({ clientId }) {
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    supabase
      .from('solicitacoes')
      .select('*')
      .eq('cliente_id', clientId)
      .in('status', ['aceita', 'recusada'])
      .order('created_at', { ascending: false })
      .then(({ data, error: err }) => {
        if (err) {
          setError(err.message)
        } else {
          setHistory(data || [])
        }
        setLoading(false)
      })
  }, [clientId])

  if (loading) return (
    <div className="flex flex-col gap-3">
      {[1, 2].map(i => <div key={i} className="h-24 rounded-xl bg-ink-900/5 dark:bg-white/5 animate-pulse"/>)}
    </div>
  )

  if (error) return (
    <div className="text-center py-16 text-red-500">
      <p className="font-medium text-sm">Erro ao carregar histórico</p>
      <p className="text-xs mt-1">{error}</p>
    </div>
  )

  if (history.length === 0) return (
    <div className="text-center py-16 text-ink-500 dark:text-ink-600">
      <History size={36} className="mx-auto mb-3 text-ink-300 dark:text-ink-700"/>
      <p className="font-medium text-sm">Nenhum serviço no histórico ainda</p>
    </div>
  )

  return (
    <div className="flex flex-col gap-3">
      {history.map(p => <ProposalCard key={p.id} proposal={p}/>)}
    </div>
  )
}

function PerfilTab({ profile, onUpdate }) {
  const [nome, setNome] = useState(profile.nome || '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  async function handleSave(e) {
    e.preventDefault()
    if (!nome.trim()) { setError('Nome não pode ser vazio'); return }
    setSaving(true)
    const { error: err } = await supabase
      .from('users')
      .update({ nome: nome.trim() })
      .eq('id', profile.id)
    setSaving(false)
    if (err) { setError(err.message); return }
    setSaved(true)
    onUpdate()
    setTimeout(() => setSaved(false), 3000)
  }

  const inputClass = "w-full px-4 py-3 rounded-lg border border-ink-900/15 dark:border-white/15 bg-transparent text-ink-900 dark:text-white placeholder-ink-500 focus:outline-none focus:ring-2 focus:ring-teal-400 text-sm"

  return (
    <form onSubmit={handleSave} className="flex flex-col gap-4 max-w-sm">
      <div>
        <label className="block text-xs font-bold text-ink-700 dark:text-ink-400 uppercase tracking-widest mb-2">Nome</label>
        <input
          type="text"
          value={nome}
          onChange={e => setNome(e.target.value)}
          className={inputClass}
          placeholder="Seu nome"
        />
      </div>
      <div>
        <label className="block text-xs font-bold text-ink-700 dark:text-ink-400 uppercase tracking-widest mb-2">E-mail</label>
        <input
          type="email"
          value={profile.email || ''}
          disabled
          className={`${inputClass} opacity-50 cursor-not-allowed`}
        />
        <p className="text-xs text-ink-500 dark:text-ink-600 mt-1">O e-mail não pode ser alterado por aqui.</p>
      </div>
      {error && <p className="text-red-500 text-sm">{error}</p>}
      {saved && <p className="text-teal-600 dark:text-teal-400 text-sm font-semibold">Perfil atualizado!</p>}
      <Button type="submit" loading={saving}>Salvar alterações</Button>
    </form>
  )
}

export function ClientDashboard() {
  const { profile, refetchProfile } = useAuth()
  const [tab, setTab] = useState('propostas')

  if (!profile) return null

  return (
    <div className="min-h-screen bg-[#FAF8F3] dark:bg-[#08141A]">
      <Header/>
      <div className="max-w-2xl mx-auto px-6 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-extrabold text-ink-900 dark:text-white" style={{ letterSpacing: '-0.025em' }}>
            Minha conta
          </h1>
          <p className="text-sm text-ink-500 dark:text-ink-600 mt-1">Bem-vindo, {profile.nome}</p>
        </div>

        <div className="flex gap-1 bg-ink-900/5 dark:bg-white/5 rounded-xl p-1 mb-6">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                tab === t.id
                  ? 'bg-white dark:bg-[#11222A] text-ink-900 dark:text-white shadow-sm'
                  : 'text-ink-600 dark:text-ink-400'
              }`}
            >
              <t.icon size={14}/>
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'propostas' && <PropostasTab clientId={profile.id}/>}
        {tab === 'historico' && <HistoricoTab clientId={profile.id}/>}
        {tab === 'perfil'    && <PerfilTab profile={profile} onUpdate={refetchProfile}/>}
      </div>
    </div>
  )
}
