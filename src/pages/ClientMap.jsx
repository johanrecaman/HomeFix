import { useState, useEffect, useCallback, useRef } from 'react'
import { GoogleMap } from '@react-google-maps/api'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useGoogleMaps } from '../hooks/useGoogleMaps'
import { Header } from '../components/Header'
import { Button } from '../components/Button'
import { MapSkeleton } from '../components/MapSkeleton'
import { ProviderMarker } from '../components/ProviderMarker'
import { ProviderInfoWindow } from '../components/ProviderInfoWindow'
import { LocationGate } from '../components/LocationGate'
import BuscaTab from '../components/BuscaTab'
import QuickCallPanel from '../components/QuickCallPanel'
import { X, Send, Map, Search, Zap } from 'lucide-react'

const MAP_OPTIONS = {
  disableDefaultUI: false,
  zoomControl: true,
  streetViewControl: false,
  mapTypeControl: false,
  fullscreenControl: false,
  styles: [
    { elementType: 'geometry', stylers: [{ color: '#f5f5f5' }] },
    { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
    { elementType: 'labels.text.fill', stylers: [{ color: '#616161' }] },
    { elementType: 'labels.text.stroke', stylers: [{ color: '#f5f5f5' }] },
    { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
    { featureType: 'road.arterial', elementType: 'labels.text.fill', stylers: [{ color: '#757575' }] },
    { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#dadada' }] },
    { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#c9c9c9' }] },
    { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#9e9e9e' }] },
    { featureType: 'poi', stylers: [{ visibility: 'off' }] },
    { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  ],
}

const MAP_CONTAINER_STYLE = { height: '100%', width: '100%', minHeight: '400px' }

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

async function fetchNearbyProviders(lat, lng, radiusKm = 10) {
  const { data, error } = await supabase.rpc('get_nearby_providers', {
    lat,
    lng,
    radius_km: radiusKm,
  })
  if (error) { console.error(error); return [] }
  return (data || []).map(p => ({ ...p, foto_url: p.foto_url ?? p.user_foto_url }))
}

function MapContent({ userLocation }) {
  const { profile } = useAuth()
  const { isLoaded, loadError } = useGoogleMaps()
  const mapRef = useRef(null)
  const debounceRef = useRef(null)
  const isInitialMount = useRef(true)
  const radiusRef = useRef(10)
  const [providers, setProviders] = useState([])
  const [selected, setSelected] = useState(null)
  const [infoOpen, setInfoOpen] = useState(null)
  const [soliciting, setSoliciting] = useState(null)
  const [sent, setSent] = useState(false)
  const [radius, setRadius] = useState(10)
  const [categorias, setCategorias] = useState([])
  const [quickCallOpen, setQuickCallOpen] = useState(false)
  const [activeTab, setActiveTab] = useState('mapa')

  useEffect(() => {
    supabase
      .from('prestadores')
      .select('categoria')
      .eq('approval_status', 'active')
      .then(({ data }) => {
        const unique = [...new Set((data || []).map(r => r.categoria).filter(Boolean))].sort()
        setCategorias(unique)
      })
  }, [])

  const loadProviders = useCallback(async (lat, lng, r) => {
    try {
      const data = await fetchNearbyProviders(lat, lng, r)
      setProviders(data)
    } catch {
      setProviders([])
    }
  }, [])

  useEffect(() => { radiusRef.current = radius }, [radius])

  useEffect(() => {
    loadProviders(userLocation.lat, userLocation.lng, radiusRef.current)

    const channel = supabase.channel('map-providers')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'prestadores' }, () => {
        fetchNearbyProviders(userLocation.lat, userLocation.lng, radiusRef.current).then(data => {
          setProviders(data)
          setInfoOpen(prev => prev && data.find(p => p.user_id === prev.user_id) ? prev : null)
          setSelected(prev => prev && data.find(p => p.user_id === prev.user_id) ? prev : null)
        })
      })
      .subscribe()

    return () => supabase.removeChannel(channel)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userLocation, loadProviders])

  useEffect(() => {
    if (isInitialMount.current) { isInitialMount.current = false; return }
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      loadProviders(userLocation.lat, userLocation.lng, radius)
    }, 500)
    return () => clearTimeout(debounceRef.current)
  }, [radius, userLocation, loadProviders])

  const onMapLoad = useCallback((map) => {
    mapRef.current = map
    map.setCenter(userLocation)
    map.setZoom(13)
  }, [userLocation])

  useEffect(() => {
    if (!mapRef.current || !isLoaded || providers.length === 0) return
    if (providers.length === 1) {
      mapRef.current.setCenter({ lat: providers[0].latitude, lng: providers[0].longitude })
      mapRef.current.setZoom(14)
      return
    }
    const bounds = new window.google.maps.LatLngBounds()
    providers.forEach(p => bounds.extend({ lat: p.latitude, lng: p.longitude }))
    mapRef.current.fitBounds(bounds, 80)
  }, [providers, isLoaded])

  function handleSent() {
    setSoliciting(null)
    setSent(true)
    setTimeout(() => setSent(false), 4000)
  }

  return (
    <div className="flex flex-col h-full bg-white dark:bg-[#08141A]">
      {/* Tab navigation */}
      <div className="flex border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-[#08141A] shrink-0">
        <button
          onClick={() => setActiveTab('mapa')}
          className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 transition border-b-2 ${
            activeTab === 'mapa'
              ? 'border-[var(--teal-400)] text-[var(--teal-400)]'
              : 'border-transparent text-[var(--text-600)] hover:text-[var(--text-900)]'
          }`}
        >
          <Map size={15} />
          Mapa
        </button>
        <button
          onClick={() => setActiveTab('busca')}
          className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 transition border-b-2 ${
            activeTab === 'busca'
              ? 'border-[var(--teal-400)] text-[var(--teal-400)]'
              : 'border-transparent text-[var(--text-600)] hover:text-[var(--text-900)]'
          }`}
        >
          <Search size={15} />
          Busca
        </button>
      </div>

      {/* Mapa tab */}
      {activeTab === 'mapa' && (
        <div className="relative flex-1">
          {!isLoaded || loadError ? (
            <MapSkeleton />
          ) : (
            <GoogleMap
              mapContainerStyle={{ width: '100%', height: '100%' }}
              center={userLocation}
              zoom={13}
              options={MAP_OPTIONS}
              onLoad={onMapLoad}
              onClick={() => setInfoOpen(null)}
            >
              {providers.map(p => (
                <ProviderMarker
                  key={p.user_id}
                  provider={p}
                  onClick={p => { setSelected(p); setInfoOpen(p) }}
                  isSelected={selected?.user_id === p.user_id}
                  isOnline={p.is_online ?? true}
                />
              ))}
              {infoOpen && (
                <ProviderInfoWindow
                  provider={infoOpen}
                  onClose={() => setInfoOpen(null)}
                  onSolicitar={p => { setInfoOpen(null); setSoliciting(p) }}
                />
              )}
            </GoogleMap>
          )}

          {/* Floating radius pill */}
          <div className="absolute top-3 right-3 z-10">
            <select
              value={radius}
              onChange={e => setRadius(Number(e.target.value))}
              className="bg-white/90 dark:bg-[#08141A]/90 backdrop-blur border border-gray-200 dark:border-gray-700 rounded-full px-3 py-1.5 text-sm shadow-md text-[var(--text-900)]"
            >
              {[2, 5, 10, 20, 50].map(r => (
                <option key={r} value={r}>📍 {r} km</option>
              ))}
            </select>
          </div>

          {/* Full-width Chamada Rápida button */}
          <div className="absolute bottom-0 left-0 right-0 p-4">
            <button
              onClick={() => setQuickCallOpen(true)}
              className="w-full bg-amber-400 hover:bg-amber-500 active:bg-amber-600 text-white font-semibold py-3.5 rounded-2xl flex items-center justify-center gap-2 shadow-lg transition"
            >
              <Zap size={18} />
              Chamada Rápida
            </button>
          </div>

          {quickCallOpen && (
            <QuickCallPanel
              userLocation={userLocation}
              clientId={profile?.id}
              categorias={categorias}
              onClose={() => setQuickCallOpen(false)}
            />
          )}
        </div>
      )}

      {/* Busca tab */}
      {activeTab === 'busca' && (
        <BuscaTab
          userLocation={userLocation}
          categorias={categorias}
          onAgendar={provider => setSoliciting(provider)}
        />
      )}

      {/* Shared modals */}
      {soliciting && (
        <SolicitacaoModal
          provider={soliciting}
          clientId={profile?.id}
          onClose={() => setSoliciting(null)}
          onSent={handleSent}
        />
      )}

      {sent && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] bg-[var(--teal-400)] text-white rounded-2xl px-5 py-3 shadow-xl text-sm font-medium">
          Proposta enviada!
        </div>
      )}
    </div>
  )
}

export function ClientMap() {
  return (
    <div className="h-screen flex flex-col bg-[#FAF8F3] dark:bg-[#08141A]">
      <Header/>
      <div className="flex-1 overflow-hidden">
        <LocationGate>
          {(coords) => <MapContent userLocation={coords}/>}
        </LocationGate>
      </div>
    </div>
  )
}
