'use client'

import { useEffect, useRef } from 'react'
import { useJsApiLoader, GoogleMap, Circle, InfoWindow, type Libraries } from '@react-google-maps/api'

const LIBRARIES: Libraries = ['places']
import { useState } from 'react'

const ZONES = [
  { id: 'A', name: 'Rohini Sector 15', lat: 28.7041, lng: 77.1025, demand: 'High', window: '10pm–2am', color: '#DC2626', fillOpacity: 0.18 },
  { id: 'B', name: 'Nangloi', lat: 28.6726, lng: 77.0554, demand: 'High', window: '8am–12pm', color: '#EA580C', fillOpacity: 0.16 },
  { id: 'C', name: 'Janakpuri', lat: 28.6289, lng: 77.0839, demand: 'Medium', window: '6pm–10pm', color: '#D97706', fillOpacity: 0.14 },
  { id: 'D', name: 'Pitampura', lat: 28.7007, lng: 77.1308, demand: 'High', window: '7am–11am', color: '#DC2626', fillOpacity: 0.18 },
  { id: 'E', name: 'Dwarka Sector 12', lat: 28.5921, lng: 77.0460, demand: 'Medium', window: '5pm–9pm', color: '#D97706', fillOpacity: 0.13 },
]

const MAP_CENTER = { lat: 28.6550, lng: 77.0850 }

export default function ForecastMap() {
  const [activeZone, setActiveZone] = useState<typeof ZONES[0] | null>(null)
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '',
    libraries: LIBRARIES,
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
      zoom={12}
      options={{
        disableDefaultUI: true,
        zoomControl: true,
        styles: [
          { featureType: 'poi', stylers: [{ visibility: 'off' }] },
          { featureType: 'transit', stylers: [{ visibility: 'off' }] },
        ],
      }}
    >
      {ZONES.map(zone => (
        <Circle
          key={zone.id}
          center={{ lat: zone.lat, lng: zone.lng }}
          radius={1400}
          options={{
            strokeColor: zone.color,
            strokeOpacity: 0.9,
            strokeWeight: 2,
            fillColor: zone.color,
            fillOpacity: zone.fillOpacity,
          }}
          onClick={() => setActiveZone(activeZone?.id === zone.id ? null : zone)}
        />
      ))}

      {activeZone && (
        <InfoWindow
          position={{ lat: activeZone.lat, lng: activeZone.lng }}
          onCloseClick={() => setActiveZone(null)}
        >
          <div className="min-w-[160px] p-1">
            <p className="font-bold text-gray-900 text-sm">Zone {activeZone.id} — {activeZone.name}</p>
            <p className="text-xs text-gray-600 mt-1">Demand: <span className="font-semibold">{activeZone.demand}</span></p>
            <p className="text-xs text-gray-500 mt-0.5">Peak window: {activeZone.window}</p>
          </div>
        </InfoWindow>
      )}
    </GoogleMap>
  )
}
