import { useState, useCallback } from 'react'

export function useGeolocation() {
  const [coords, setCoords] = useState(null)
  const [error, setError] = useState(null)

  const getPosition = useCallback(() => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        const err = 'Geolocation not supported'
        setError(err)
        reject(err)
        return
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const c = { lat: pos.coords.latitude, lng: pos.coords.longitude }
          setCoords(c)
          resolve(c)
        },
        (err) => {
          setError(err.message)
          reject(err.message)
        },
        { enableHighAccuracy: true, timeout: 10000 }
      )
    })
  }, [])

  return { coords, error, getPosition }
}
