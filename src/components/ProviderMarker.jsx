import { MarkerF } from '@react-google-maps/api'

function buildIcon(fotoUrl, nome, isOnline) {
  const borderColor = isOnline ? '#2dd4bf' : '#6b7280'

  if (fotoUrl) {
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="44" height="44">
        <defs>
          <clipPath id="circle-clip">
            <circle cx="22" cy="22" r="19"/>
          </clipPath>
        </defs>
        <circle cx="22" cy="22" r="21" fill="white"/>
        <image href="${fotoUrl}" x="3" y="3" width="38" height="38" clip-path="url(#circle-clip)" preserveAspectRatio="xMidYMid slice"/>
        <circle cx="22" cy="22" r="21" fill="none" stroke="${borderColor}" stroke-width="3"/>
      </svg>
    `
    return {
      url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
      scaledSize: new window.google.maps.Size(44, 44),
      anchor: new window.google.maps.Point(22, 22),
    }
  }

  const inicial = (nome?.[0] || '?').toUpperCase()
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="44" height="44">
      <circle cx="22" cy="22" r="20" fill="#20D4B8" stroke="${borderColor}" stroke-width="3"/>
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

export function ProviderMarker({ provider, onClick, isSelected, isOnline = true }) {
  return (
    <MarkerF
      key={provider.user_id}
      position={{ lat: provider.latitude, lng: provider.longitude }}
      icon={buildIcon(provider.foto_url, provider.nome, isOnline)}
      onClick={() => onClick(provider)}
      zIndex={isSelected ? 10 : 1}
    />
  )
}
