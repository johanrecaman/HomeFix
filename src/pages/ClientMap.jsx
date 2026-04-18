import { useState, useEffect, useCallback } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { Header } from '../components/Header'
import { Button } from '../components/Button'
import { X, Send, MapPin } from 'lucide-react'

const providerIcon = L.divIcon({
  className: '',
  html: `<div style="
    width:40px;height:40px;border-radius:50%;
    background:#20D4B8;border:3px solid white;
    box-shadow:0 4px 12px rgba(32,212,184,0.5);
    display:grid;place-items:center;font-size:18px;cursor:pointer;
  ">🔧</div>`,
  iconSize: [40, 40],
  iconAnchor: [20, 20],
})

function RecenterMap({ center }) {
  const map = useMap()
  useEffect(() => { if (center) map.flyTo(center, 13, { duration: 1 }) }, [center, map])
  return null
}

const inputClass = "w-full px-4 py-3 rounded-lg border border-ink-900/15 dark:border-white/15 bg-transparent text-ink-900 dark:text-white placeholder-ink-500 focus:outline-none focus:ring-2 focus:ring-teal-400 text-sm"

function SolicitacaoModal({ provider, clientId, onClose, onSent }) {
  const [form, setForm] = useState({ descricao: '', data_desejada: '', valor_oferecido: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error: err } = await supabase.from('solicitacoes').insert({
      cliente_id: clientId,
      prestador_id: provider.user_id,
      descricao: form.descricao,
      data_desejada: form.data_desejada,
      valor_oferecido: parseFloat(form.valor_oferecido) || null,
      status: 'pendente',
    })
    setLoading(false)
    if (err) { setError(err.message); return }
    onSent()
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-[9999] flex items-end md:items-center justify-center p-4">
      <div className="bg-white dark:bg-[#11222A] rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between p-6 border-b border-ink-900/10 dark:border-white/10">
          <div>
            <h2 className="text-lg font-extrabold text-ink-900 dark:text-white" style={{ letterSpacing: '-0.025em' }}>
              Enviar proposta
            </h2>
            <p className="text-sm text-ink-600 dark:text-ink-400">{provider.nome} · {provider.categoria}</p>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-full hover:bg-ink-900/5 dark:hover:bg-white/10 grid place-items-center text-ink-600 dark:text-ink-400">
            <X size={18}/>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-bold text-ink-700 dark:text-ink-400 uppercase tracking-widest mb-2">Descrição do serviço</label>
            <textarea required value={form.descricao} onChange={set('descricao')} className={inputClass} rows={3} placeholder="Descreva o que precisa..."/>
          </div>
          <div>
            <label className="block text-xs font-bold text-ink-700 dark:text-ink-400 uppercase tracking-widest mb-2">Data e horário desejados</label>
            <input type="datetime-local" required value={form.data_desejada} onChange={set('data_desejada')} className={inputClass}/>
          </div>
          <div>
            <label className="block text-xs font-bold text-ink-700 dark:text-ink-400 uppercase tracking-widest mb-2">Valor oferecido (R$) — opcional</label>
            <input type="number" value={form.valor_oferecido} onChange={set('valor_oferecido')} className={inputClass} placeholder="150"/>
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <Button type="submit" className="w-full" size="lg" loading={loading}>
            <Send size={16}/> Enviar proposta
          </Button>
        </form>
      </div>
    </div>
  )
}

async function fetchOnlineProviders() {
  const { data } = await supabase
    .from('prestadores')
    .select('*, users(nome, foto_url, telefone)')
    .eq('status', 'online')
    .not('latitude', 'is', null)
  return (data || []).map(p => ({ ...p, nome: p.users?.nome, foto_url: p.users?.foto_url }))
}

export function ClientMap() {
  const { profile } = useAuth()
  const [providers, setProviders] = useState([])
  const [selected, setSelected] = useState(null)
  const [soliciting, setSoliciting] = useState(null)
  const [sent, setSent] = useState(false)
  const [mapCenter, setMapCenter] = useState([-23.55, -46.63])

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(pos => {
        setMapCenter([pos.coords.latitude, pos.coords.longitude])
      })
    }
    fetchOnlineProviders().then(setProviders)

    const channel = supabase.channel('map-providers')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'prestadores' }, () => {
        fetchOnlineProviders().then(setProviders)
      })
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [])

  function handleSent() {
    setSoliciting(null)
    setSent(true)
    setTimeout(() => setSent(false), 4000)
  }

  return (
    <div className="min-h-screen bg-[#FAF8F3] dark:bg-[#08141A] flex flex-col">
      <Header/>
      <div className="flex-1 flex flex-col md:flex-row gap-4 max-w-7xl mx-auto w-full px-4 py-6" style={{ minHeight: 'calc(100vh - 76px)' }}>
        {/* Map */}
        <div className="flex-1 rounded-xl overflow-hidden border border-ink-900/10 dark:border-white/10" style={{ minHeight: '400px' }}>
          <MapContainer center={mapCenter} zoom={13} style={{ height: '100%', width: '100%', minHeight: '400px' }}>
            <TileLayer
              attribution='&copy; <a href="https://openstreetmap.org">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <RecenterMap center={mapCenter}/>
            {providers.map(p => p.latitude && p.longitude ? (
              <Marker
                key={p.user_id}
                position={[p.latitude, p.longitude]}
                icon={providerIcon}
                eventHandlers={{ click: () => setSelected(p) }}
              >
                <Popup>
                  <div style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', padding: '4px' }}>
                    <p style={{ fontWeight: 700, marginBottom: 2 }}>{p.nome}</p>
                    <p style={{ fontSize: 12, color: '#6E8984' }}>{p.categoria}</p>
                  </div>
                </Popup>
              </Marker>
            ) : null)}
          </MapContainer>
        </div>

        {/* Sidebar */}
        <div className="w-full md:w-80 flex flex-col gap-3">
          <div className="bg-white dark:bg-[#11222A] rounded-xl border border-ink-900/10 dark:border-white/10 p-4">
            <h2 className="font-extrabold text-ink-900 dark:text-white tracking-tight mb-1" style={{ letterSpacing: '-0.025em' }}>
              {providers.length} prestador{providers.length !== 1 ? 'es' : ''} online
            </h2>
            <p className="text-xs text-ink-500 dark:text-ink-600">Clique no pin ou no card para ver o perfil</p>
          </div>

          {selected && (
            <div className="bg-white dark:bg-[#11222A] rounded-xl border-2 border-teal-400 p-5 shadow-md">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-bold text-ink-900 dark:text-white">{selected.nome}</h3>
                  <p className="text-xs text-ink-600 dark:text-ink-400 mt-0.5">{selected.categoria}</p>
                </div>
                <button onClick={() => setSelected(null)} className="text-ink-400 hover:text-ink-700 dark:hover:text-ink-300">
                  <X size={16}/>
                </button>
              </div>
              {selected.descricao && (
                <p className="text-sm text-ink-600 dark:text-ink-400 mb-4 leading-relaxed">{selected.descricao}</p>
              )}
              {selected.preco_medio && (
                <p className="text-sm font-semibold text-ink-900 dark:text-white mb-4">
                  A partir de <span className="text-teal-600 dark:text-teal-400">R$ {Number(selected.preco_medio).toFixed(2)}</span>
                </p>
              )}
              <Button className="w-full" onClick={() => setSoliciting(selected)}>
                <Send size={14}/> Solicitar serviço
              </Button>
            </div>
          )}

          <div className="flex flex-col gap-2 overflow-y-auto" style={{ maxHeight: '60vh' }}>
            {providers.map(p => (
              <button key={p.user_id}
                onClick={() => {
                  setSelected(p)
                  if (p.latitude && p.longitude) setMapCenter([p.latitude, p.longitude])
                }}
                className={`text-left bg-white dark:bg-[#11222A] rounded-xl border p-4 transition-all hover:-translate-y-0.5 hover:shadow-md ${
                  selected?.user_id === p.user_id
                    ? 'border-teal-400'
                    : 'border-ink-900/10 dark:border-white/10'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-teal-100 dark:bg-teal-400/15 grid place-items-center text-teal-700 dark:text-teal-300 font-bold text-sm flex-shrink-0">
                    {p.nome?.[0]?.toUpperCase() || '?'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-ink-900 dark:text-white text-sm truncate">{p.nome}</p>
                    <p className="text-xs text-ink-500 dark:text-ink-600 truncate">{p.categoria}</p>
                  </div>
                  {p.preco_medio && (
                    <span className="text-xs font-bold text-teal-600 dark:text-teal-400 whitespace-nowrap">
                      R$ {Number(p.preco_medio).toFixed(0)}
                    </span>
                  )}
                </div>
              </button>
            ))}

            {providers.length === 0 && (
              <div className="text-center py-12 text-ink-500 dark:text-ink-600">
                <MapPin size={32} className="mx-auto mb-3 text-ink-300 dark:text-ink-700"/>
                <p className="text-sm font-medium">Nenhum prestador online agora</p>
                <p className="text-xs mt-1">Tente novamente em alguns minutos</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {sent && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-ink-900 dark:bg-white text-white dark:text-ink-900 px-6 py-3 rounded-full text-sm font-semibold shadow-xl z-50 flex items-center gap-2 whitespace-nowrap">
          <span className="w-5 h-5 rounded-full bg-teal-400 grid place-items-center text-ink-900 text-xs">✓</span>
          Proposta enviada! O prestador irá responder em breve.
        </div>
      )}

      {soliciting && (
        <SolicitacaoModal
          provider={soliciting}
          clientId={profile?.id}
          onClose={() => setSoliciting(null)}
          onSent={handleSent}
        />
      )}
    </div>
  )
}
