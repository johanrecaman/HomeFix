import { MarkerF } from '@react-google-maps/api'

function buildIcon(fotoUrl, nome) {
  if (fotoUrl) {
    return {
      url: fotoUrl,
      scaledSize: new window.google.maps.Size(44, 44),
      anchor: new window.google.maps.Point(22, 22),
    }
  }

  const inicial = (nome?.[0] || '?').toUpperCase()
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="44" height="44">
      <circle cx="22" cy="22" r="20" fill="#20D4B8" stroke="white" stroke-width="3"/>
      <text x="22" y="27" text-anchor="middle" font-size="16" font-weight="bold"
        font-family="Plus Jakarta Sans,sans-serif" fill="#08141A">${inicial}</text>
    </svg>
  `
  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: new window.google.maps.Size(44, 44),
    anchor: new window.google.maps.Point(22, 22),
  }
}

export function ProviderMarker({ provider, onClick, isSelected }) {
  return (
    <MarkerF
      key={provider.user_id}
      position={{ lat: provider.latitude, lng: provider.longitude }}
      icon={buildIcon(provider.foto_url, provider.nome)}
      onClick={() => onClick(provider)}
      zIndex={isSelected ? 10 : 1}
    />
  )
}
