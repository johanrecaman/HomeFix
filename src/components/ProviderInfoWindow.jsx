import { InfoWindowF } from '@react-google-maps/api'

function StarRating({ avaliacao }) {
  if (!avaliacao) return <span style={{ fontSize: 12, color: '#9CA3AF' }}>Sem avaliação</span>
  return (
    <span style={{ fontSize: 12, fontWeight: 600, color: '#F59E0B' }}>
      ★ {Number(avaliacao).toFixed(1)}
    </span>
  )
}

export function ProviderInfoWindow({ provider, onClose, onSolicitar }) {
  return (
    <InfoWindowF
      position={{ lat: provider.latitude, lng: provider.longitude }}
      onCloseClick={onClose}
      options={{ pixelOffset: new window.google.maps.Size(0, -22) }}
    >
      <div style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', minWidth: '180px', padding: '4px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
          {provider.foto_url ? (
            <img
              src={provider.foto_url}
              alt={provider.nome}
              style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover' }}
            />
          ) : (
            <div style={{
              width: 36, height: 36, borderRadius: '50%',
              background: '#20D4B8', display: 'grid', placeItems: 'center',
              fontWeight: 700, color: '#08141A', fontSize: 14,
            }}>
              {provider.nome?.[0]?.toUpperCase() || '?'}
            </div>
          )}
          <div>
            <p style={{ fontWeight: 700, margin: 0, fontSize: 14 }}>{provider.nome}</p>
            <p style={{ fontSize: 12, color: '#6E8984', margin: 0 }}>{provider.categoria}</p>
          </div>
        </div>
        <StarRating avaliacao={provider.avaliacao} />
        <button
          onClick={() => onSolicitar(provider)}
          style={{
            marginTop: 8, width: '100%', background: '#20D4B8', border: 'none',
            borderRadius: 8, padding: '6px 12px', fontWeight: 700, fontSize: 13,
            cursor: 'pointer', color: '#08141A', display: 'flex',
            alignItems: 'center', justifyContent: 'center', gap: 6,
          }}
        >
          <span>Solicitar serviço</span>
        </button>
      </div>
    </InfoWindowF>
  )
}
