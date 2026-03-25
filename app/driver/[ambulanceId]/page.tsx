'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { MapPin, Wifi, WifiOff, CheckCircle, AlertCircle } from 'lucide-react'

interface AmbulanceInfo {
  code: string
  driver_name: string
  status: string
}

export default function DriverTrackingPage({ params }: { params: { ambulanceId: string } }) {
  const [ambulance, setAmbulance] = useState<AmbulanceInfo | null>(null)
  const [tracking, setTracking] = useState(false)
  const [coords, setCoords] = useState<{ lat: number; lng: number; accuracy: number } | null>(null)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const watchIdRef = useRef<number | null>(null)

  useEffect(() => {
    fetch(`/api/driver/ambulance?id=${params.ambulanceId}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) setError(data.error)
        else setAmbulance(data)
      })
      .catch(() => setError('Could not load ambulance info'))
      .finally(() => setLoading(false))
  }, [params.ambulanceId])

  const sendLocation = useCallback(async (lat: number, lng: number) => {
    try {
      await fetch('/api/driver/location', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ambulanceId: params.ambulanceId, lat, lng }),
      })
      setLastUpdate(new Date())
    } catch {
      // silent — will retry on next GPS update
    }
  }, [params.ambulanceId])

  const startTracking = () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported on this device')
      return
    }
    setError('')
    setTracking(true)
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords
        setCoords({ lat: latitude, lng: longitude, accuracy })
        sendLocation(latitude, longitude)
      },
      (err) => {
        setError('GPS error: ' + err.message)
        setTracking(false)
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
    )
  }

  const stopTracking = () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
    setTracking(false)
  }

  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
      }
    }
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!ambulance) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-6">
        <div className="text-center">
          <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
          <p className="text-white font-semibold">Invalid tracking link</p>
          <p className="text-gray-500 text-sm mt-1">{error || 'Ambulance not found'}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center p-6 gap-6">

      {/* Header */}
      <div className="text-center">
        <div className="w-16 h-16 bg-red-500/20 rounded-2xl flex items-center justify-center mx-auto mb-3">
          <MapPin className="w-8 h-8 text-red-400" />
        </div>
        <h1 className="text-2xl font-bold">{ambulance.code}</h1>
        <p className="text-gray-400 mt-1">{ambulance.driver_name}</p>
      </div>

      {/* Status pill */}
      <div className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium ${
        tracking ? 'bg-green-500/20 text-green-400' : 'bg-gray-800 text-gray-400'
      }`}>
        {tracking
          ? <><Wifi className="w-4 h-4" /> Sending Location</>
          : <><WifiOff className="w-4 h-4" /> Not Tracking</>
        }
      </div>

      {/* Coords card */}
      {coords && (
        <div className="bg-gray-900 rounded-2xl p-5 w-full max-w-sm space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Latitude</span>
            <span className="font-mono text-white">{coords.lat.toFixed(6)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Longitude</span>
            <span className="font-mono text-white">{coords.lng.toFixed(6)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Accuracy</span>
            <span className="font-mono text-white">±{Math.round(coords.accuracy)}m</span>
          </div>
          {lastUpdate && (
            <div className="flex justify-between text-sm border-t border-gray-800 pt-3">
              <span className="text-gray-500">Last sent</span>
              <span className="text-green-400 flex items-center gap-1.5">
                <CheckCircle className="w-3.5 h-3.5" />
                {lastUpdate.toLocaleTimeString()}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Main button */}
      <button
        onClick={tracking ? stopTracking : startTracking}
        className={`w-full max-w-sm py-5 rounded-2xl text-lg font-bold transition-all active:scale-95 ${
          tracking
            ? 'bg-red-600 hover:bg-red-700'
            : 'bg-green-600 hover:bg-green-700'
        }`}
      >
        {tracking ? 'Stop Tracking' : 'Start Tracking'}
      </button>

      {error && (
        <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 px-4 py-2 rounded-xl">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      <p className="text-gray-600 text-xs text-center max-w-xs">
        Keep this page open while on a trip. The hospital dashboard updates in real time.
      </p>
    </div>
  )
}
