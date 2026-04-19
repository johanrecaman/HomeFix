import { useJsApiLoader } from '@react-google-maps/api'

const LIBRARIES = ['places']

export function useGoogleMaps() {
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
    libraries: LIBRARIES,
  })
  return { isLoaded, loadError }
}
