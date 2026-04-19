import { useState, useEffect, useCallback, useRef } from 'react'
import { GoogleMap } from '@react-google-maps/api'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useGoogleMaps } from '../hooks/useGoogleMaps'
import { Header } from '../components/Header'
import { Button } from '../components/Button'
import { MapSkeleton } from '../components/MapSkeleton'
import { ProviderCardSkeleton } from '../components/ProviderCardSkeleton'
import { ProviderMarker } from '../components/ProviderMarker'
import { ProviderInfoWindow } from '../components/ProviderInfoWindow'
import { LocationGate } from '../components/LocationGate'
import { X, Send, MapPin } from 'lucide-react'

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
  const { data } = await supabase.rpc('get_nearby_providers', {
    lat, lng, radius_km: radiusKm,
  })
  return (data || []).map(p => ({ ...p, foto_url: p.user_foto_url }))
}

function MapContent({ userLocation }) {
  const { profile } = useAuth()
  const { isLoaded, loadError } = useGoogleMaps()
  const mapRef = useRef(null)
  const debounceRef = useRef(null)
  const isInitialMount = useRef(true)
  const radiusRef = useRef(10)
  const [providers, setProviders] = useState([])
  const [loadingProviders, setLoadingProviders] = useState(true)
  const [selected, setSelected] = useState(null)
  const [infoOpen, setInfoOpen] = useState(null)
  const [soliciting, setSoliciting] = useState(null)
  const [sent, setSent] = useState(false)
  const [radius, setRadius] = useState(10)

  const loadProviders = useCallback(async (lat, lng, r) => {
    setLoadingProviders(true)
    try {
      const data = await fetchNearbyProviders(lat, lng, r)
      setProviders(data)
    } catch {
      setProviders([])
    } finally {
      setLoadingProviders(false)
    }
  }, [])

  // Keep radiusRef in sync so the realtime callback always has the current value
  useEffect(() => { radiusRef.current = radius }, [radius])

  // Initial load + realtime channel
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
  }, [userLocation, loadProviders])

  // Radius debounce — skip on initial mount (initial load handles the first fetch)
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

  // FitBounds when providers load
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

  function handleMarkerClick(provider) {
    setSelected(provider)
    setInfoOpen(provider)
  }

  return (
    <div className="flex-1 flex flex-col md:flex-row gap-4 max-w-7xl mx-auto w-full px-4 py-6" style={{ minHeight: 'calc(100vh - 76px)' }}>
      {/* Map */}
      <div className="flex-1 rounded-xl overflow-hidden border border-ink-900/10 dark:border-white/10" style={{ minHeight: '400px' }}>
        {!isLoaded || loadingProviders ? (
          <MapSkeleton/>
        ) : loadError ? (
          <div className="h-full grid place-items-center text-red-500 text-sm">
            Erro ao carregar o mapa. Verifique a API key.
          </div>
        ) : (
          <GoogleMap
            mapContainerStyle={MAP_CONTAINER_STYLE}
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
                onClick={handleMarkerClick}
                isSelected={selected?.user_id === p.user_id}
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
      </div>

      {/* Sidebar */}
      <div className="w-full md:w-80 flex flex-col gap-3">
        <div className="bg-white dark:bg-[#11222A] rounded-xl border border-ink-900/10 dark:border-white/10 p-4">
          <h2 className="font-extrabold text-ink-900 dark:text-white tracking-tight mb-1" style={{ letterSpacing: '-0.025em' }}>
            {loadingProviders ? '...' : `${providers.length} prestador${providers.length !== 1 ? 'es' : ''} próximos`}
          </h2>
          <p className="text-xs text-ink-500 dark:text-ink-600 mb-3">Clique no pin ou no card para ver o perfil</p>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={1}
              max={50}
              value={radius}
              onChange={e => setRadius(Number(e.target.value))}
              className="flex-1 accent-teal-400 h-1.5"
            />
            <span className="text-xs font-bold text-ink-700 dark:text-ink-300 w-14 text-right">{radius} km</span>
          </div>
        </div>

        {selected && (
          <div className="bg-white dark:bg-[#11222A] rounded-xl border-2 border-teal-400 p-5 shadow-md">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-bold text-ink-900 dark:text-white">{selected.nome}</h3>
                <p className="text-xs text-ink-600 dark:text-ink-400 mt-0.5">{selected.categoria}</p>
              </div>
              <button onClick={() => { setSelected(null); setInfoOpen(null) }} className="text-ink-400 hover:text-ink-700 dark:hover:text-ink-300">
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
            {selected.avaliacao && (
              <p className="text-sm font-semibold text-amber-500 mb-4">★ {Number(selected.avaliacao).toFixed(1)}</p>
            )}
            <Button className="w-full" onClick={() => setSoliciting(selected)}>
              <Send size={14}/> Solicitar serviço
            </Button>
          </div>
        )}

        <div className="flex flex-col gap-2 overflow-y-auto" style={{ maxHeight: '60vh' }}>
          {loadingProviders ? (
            <ProviderCardSkeleton/>
          ) : providers.length === 0 ? (
            <div className="text-center py-12 text-ink-500 dark:text-ink-600">
              <MapPin size={32} className="mx-auto mb-3 text-ink-300 dark:text-ink-700"/>
              <p className="text-sm font-medium">Nenhum prestador disponível em {radius}km agora</p>
              <p className="text-xs mt-1">Aumente o raio ou aguarde prestadores ficarem online</p>
            </div>
          ) : (
            providers.map(p => (
              <button key={p.user_id}
                onClick={() => {
                  setSelected(p)
                  setInfoOpen(p)
                  if (mapRef.current) mapRef.current.panTo({ lat: p.latitude, lng: p.longitude })
                }}
                className={`text-left bg-white dark:bg-[#11222A] rounded-xl border p-4 transition-all hover:-translate-y-0.5 hover:shadow-md ${
                  selected?.user_id === p.user_id ? 'border-teal-400' : 'border-ink-900/10 dark:border-white/10'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-teal-100 dark:bg-teal-400/15 grid place-items-center text-teal-700 dark:text-teal-300 font-bold text-sm flex-shrink-0">
                    {p.foto_url
                      ? <img src={p.foto_url} alt={p.nome} className="w-full h-full rounded-full object-cover"/>
                      : p.nome?.[0]?.toUpperCase() || '?'
                    }
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-ink-900 dark:text-white text-sm truncate">{p.nome}</p>
                    <p className="text-xs text-ink-500 dark:text-ink-600 truncate">{p.categoria}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    {p.preco_medio && (
                      <p className="text-xs font-bold text-teal-600 dark:text-teal-400">
                        R$ {Number(p.preco_medio).toFixed(0)}
                      </p>
                    )}
                    {p.avaliacao && (
                      <p className="text-xs text-amber-500">★ {Number(p.avaliacao).toFixed(1)}</p>
                    )}
                  </div>
                </div>
              </button>
            ))
          )}
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

export function ClientMap() {
  return (
    <div className="min-h-screen bg-[#FAF8F3] dark:bg-[#08141A] flex flex-col">
      <Header/>
      <LocationGate>
        {(coords) => <MapContent userLocation={coords}/>}
      </LocationGate>
    </div>
  )
}
