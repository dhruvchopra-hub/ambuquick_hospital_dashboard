'use client'

import { useJsApiLoader, GoogleMap, Marker, InfoWindow } from '@react-google-maps/api'
import { useState } from 'react'

interface Unit {
  name: string; lat: number; lng: number
  avgResponse: number; sla: number; rides: number
  perf: 'good' | 'ok' | 'poor'
}

const UNITS: Unit[] = [
  { name: 'Nangloi Delhi',        lat: 28.6726, lng: 77.0554, avgResponse: 14.2, sla: 88, rides: 47, perf: 'good' },
  { name: 'Rama Vihar Delhi',     lat: 28.6897, lng: 77.0362, avgResponse: 16.8, sla: 75, rides: 31, perf: 'ok'   },
  { name: 'Karnal Haryana',       lat: 29.6857, lng: 76.9905, avgResponse: 13.1, sla: 92, rides: 28, perf: 'good' },
  { name: 'Panipat Haryana',      lat: 29.3909, lng: 76.9635, avgResponse: 17.4, sla: 71, rides: 22, perf: 'ok'   },
  { name: 'Sonipat Haryana',      lat: 28.9288, lng: 77.0172, avgResponse: 19.3, sla: 62, rides: 18, perf: 'poor' },
  { name: 'Kurukshetra Haryana',  lat: 29.9695, lng: 76.8783, avgResponse: 15.6, sla: 80, rides: 15, perf: 'good' },
  { name: 'Bahadurgarh Haryana',  lat: 28.6924, lng: 76.9264, avgResponse: 18.1, sla: 67, rides: 21, perf: 'poor' },
  { name: 'Varanasi UP',          lat: 25.3176, lng: 82.9739, avgResponse: 16.2, sla: 78, rides: 33, perf: 'ok'   },
  { name: 'Kanpur UP',            lat: 26.4499, lng: 80.3319, avgResponse: 20.7, sla: 58, rides: 26, perf: 'poor' },
]

const PERF_COLORS: Record<string, string> = {
  good: '#16a34a',
  ok:   '#d97706',
  poor: '#dc2626',
}

function createPin(color: string) {
  if (typeof window === 'undefined') return undefined
  return {
    path: window.google?.maps?.SymbolPath?.CIRCLE ?? 0,
    fillColor: color,
    fillOpacity: 1,
    strokeColor: '#fff',
    strokeWeight: 2,
    scale: 10,
  }
}

const MAP_CENTER = { lat: 28.2, lng: 78.5 }

export default function GroupMap() {
  const [active, setActive] = useState<Unit | null>(null)
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '',
    id: 'google-map-script-group',
  })

  if (loadError) {
    return (
      <div className="w-full h-full bg-ambu-bg flex items-center justify-center rounded-xl">
        <div className="text-center px-4">
          <p className="text-sm font-medium text-ambu-dark">Map unavailable</p>
          <p className="text-xs text-ambu-muted mt-1">Add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to .env.local</p>
        </div>
      </div>
    )
  }

  if (!isLoaded) {
    return (
      <div className="w-full h-full bg-ambu-bg flex items-center justify-center rounded-xl">
        <div className="w-6 h-6 border-2 border-ambu-red border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <GoogleMap
      mapContainerStyle={{ width: '100%', height: '100%', borderRadius: '12px' }}
      center={MAP_CENTER}
      zoom={7}
      options={{
        disableDefaultUI: true,
        zoomControl: true,
        styles: [
          { featureType: 'poi', stylers: [{ visibility: 'off' }] },
          { featureType: 'transit', stylers: [{ visibility: 'off' }] },
        ],
      }}
    >
      {UNITS.map(unit => (
        <Marker
          key={unit.name}
          position={{ lat: unit.lat, lng: unit.lng }}
          icon={createPin(PERF_COLORS[unit.perf])}
          onClick={() => setActive(active?.name === unit.name ? null : unit)}
        />
      ))}

      {active && (
        <InfoWindow
          position={{ lat: active.lat, lng: active.lng }}
          onCloseClick={() => setActive(null)}
        >
          <div className="min-w-[180px] p-1">
            <p className="font-bold text-gray-900 text-sm">{active.name}</p>
            <div className="mt-1.5 space-y-0.5">
              <p className="text-xs text-gray-600">Avg Response: <span className="font-semibold">{active.avgResponse} min</span></p>
              <p className="text-xs text-gray-600">SLA Compliance: <span className="font-semibold">{active.sla}%</span></p>
              <p className="text-xs text-gray-600">Rides This Month: <span className="font-semibold">{active.rides}</span></p>
            </div>
          </div>
        </InfoWindow>
      )}
    </GoogleMap>
  )
}
