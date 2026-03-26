'use client'

import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap, Polyline } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { Ambulance, Ride } from '@/types'

delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

const STATUS_COLORS: Record<string, string> = {
  available: '#16a34a', on_trip: '#2563eb', maintenance: '#d97706', offline: '#6b7280',
}
const STATUS_LABELS: Record<string, string> = {
  available: 'bg-green-100 text-green-700', on_trip: 'bg-blue-100 text-blue-700',
  maintenance: 'bg-yellow-100 text-yellow-700', offline: 'bg-gray-100 text-gray-600',
}
const DEFAULT_CENTER: [number, number] = [28.6139, 77.2090]

function createAmbulanceIcon(color: string) {
  return L.divIcon({
    html: `
      <div style="position:relative;text-align:center;width:36px">
        <div style="font-size:28px;line-height:1;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.4))">🚑</div>
        <div style="position:absolute;bottom:-3px;left:50%;transform:translateX(-50%);width:9px;height:9px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.4)"></div>
      </div>`,
    className: '', iconSize: [36, 38], iconAnchor: [18, 38], popupAnchor: [0, -40],
  })
}

function Recenter({ center }: { center: [number, number] }) {
  const map = useMap()
  useEffect(() => { map.setView(center, map.getZoom(), { animate: true }) }, [center, map])
  return null
}

interface Props {
  ambulances: Ambulance[]
  rides: Ride[]
  selected: Ambulance | null
  onSelect: (amb: Ambulance | null) => void
}

export default function MapComponent({ ambulances, rides, selected, onSelect }: Props) {
  const [geocoded, setGeocoded] = useState<Record<string, [number, number]>>({})

  // Geocode pickup locations for on_trip ambulances
  useEffect(() => {
    const onTripAmbs = ambulances.filter(a => a.status === 'on_trip')
    onTripAmbs.forEach(async (amb) => {
      const ride = rides.find(r => r.ambulance_id === amb.id && ['dispatched', 'en_route'].includes(r.status))
      if (!ride || geocoded[ride.id]) return
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(ride.pickup_location + ', India')}&format=json&limit=1`,
          { headers: { 'User-Agent': 'AmbuQuick/1.0' } }
        )
        const data = await res.json()
        if (data[0]) {
          setGeocoded(prev => ({ ...prev, [ride.id]: [parseFloat(data[0].lat), parseFloat(data[0].lon)] }))
        }
      } catch {}
    })
  }, [ambulances, rides])

  const center: [number, number] = ambulances.length > 0
    ? [Number(ambulances[0].lat) || DEFAULT_CENTER[0], Number(ambulances[0].lng) || DEFAULT_CENTER[1]]
    : DEFAULT_CENTER

  return (
    <MapContainer center={center} zoom={13} style={{ width: '100%', height: '100%' }} className="rounded-xl">
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Recenter center={center} />

      {ambulances.map(amb => {
        const ambPos: [number, number] = [Number(amb.lat) || DEFAULT_CENTER[0], Number(amb.lng) || DEFAULT_CENTER[1]]
        const activeRide = rides.find(r => r.ambulance_id === amb.id && ['dispatched', 'en_route'].includes(r.status))
        const pickupCoords = activeRide ? geocoded[activeRide.id] : undefined

        return (
          <div key={amb.id}>
            <Marker
              position={ambPos}
              icon={createAmbulanceIcon(STATUS_COLORS[amb.status] || '#6b7280')}
              eventHandlers={{ click: () => onSelect(selected?.id === amb.id ? null : amb) }}
            >
              <Popup>
                <div className="min-w-[140px] p-1">
                  <p className="font-bold text-gray-900 text-sm">{amb.code}</p>
                  <p className="text-xs text-gray-600 mt-0.5">{amb.driver_name}</p>
                  <p className="text-xs text-gray-500">{amb.driver_phone}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{amb.type === 'hospital_fleet' ? 'Hospital Fleet' : amb.type}</p>
                  <span className={`inline-block mt-2 text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_LABELS[amb.status] || 'bg-gray-100 text-gray-600'}`}>
                    {amb.status === 'on_trip' ? 'On Trip' : amb.status.charAt(0).toUpperCase() + amb.status.slice(1)}
                  </span>
                  {activeRide && (
                    <div className="mt-2 pt-2 border-t border-gray-100">
                      <p className="text-xs font-medium text-gray-700">{activeRide.patient_name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">→ {activeRide.pickup_location}</p>
                    </div>
                  )}
                </div>
              </Popup>
            </Marker>

            {/* Route polyline from ambulance to pickup */}
            {pickupCoords && amb.status === 'on_trip' && (
              <Polyline
                positions={[ambPos, pickupCoords]}
                color="#D91A2A"
                weight={3}
                dashArray="8, 8"
                opacity={0.8}
              />
            )}
          </div>
        )
      })}
    </MapContainer>
  )
}
