import { useState, useCallback } from 'react'

export function useGeolocation() {
  const [state, setState] = useState('idle')
  const [coords, setCoords] = useState(null)

  const request = useCallback(() => {
    if (!navigator.geolocation) {
      setState('unsupported')
      return
    }
    setState('requesting')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setState('granted')
      },
      () => setState('denied'),
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }, [])

  return { state, coords, request }
}
