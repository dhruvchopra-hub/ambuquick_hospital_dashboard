'use client'

import { useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { Ambulance } from '@/types'

// Fix default icon paths broken by webpack
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

const STATUS_COLORS: Record<string, string> = {
  available: '#16a34a',
  on_trip: '#2563eb',
  maintenance: '#d97706',
  offline: '#6b7280',
}

const STATUS_LABELS: Record<string, string> = {
  available: 'bg-green-100 text-green-700',
  on_trip: 'bg-blue-100 text-blue-700',
  maintenance: 'bg-yellow-100 text-yellow-700',
  offline: 'bg-gray-100 text-gray-600',
}

const DEFAULT_CENTER: [number, number] = [28.6139, 77.2090]

function createAmbulanceIcon(color: string) {
  return L.divIcon({
    html: `
      <div style="
        background:${color};
        width:18px;height:18px;
        border-radius:50%;
        border:2.5px solid white;
        box-shadow:0 2px 6px rgba(0,0,0,0.35);
      "></div>`,
    className: '',
    iconSize: [18, 18],
    iconAnchor: [9, 9],
    popupAnchor: [0, -12],
  })
}

// Recenter map when ambulances update
function Recenter({ center }: { center: [number, number] }) {
  const map = useMap()
  useEffect(() => {
    map.setView(center, map.getZoom(), { animate: true })
  }, [center, map])
  return null
}

interface Props {
  ambulances: Ambulance[]
  selected: Ambulance | null
  onSelect: (amb: Ambulance | null) => void
}

export default function MapComponent({ ambulances, selected, onSelect }: Props) {
  const center: [number, number] = ambulances.length > 0
    ? [Number(ambulances[0].lat) || DEFAULT_CENTER[0], Number(ambulances[0].lng) || DEFAULT_CENTER[1]]
    : DEFAULT_CENTER

  return (
    <MapContainer
      center={center}
      zoom={13}
      style={{ width: '100%', height: '100%' }}
      className="rounded-xl"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Recenter center={center} />

      {ambulances.map(amb => (
        <Marker
          key={amb.id}
          position={[Number(amb.lat) || DEFAULT_CENTER[0], Number(amb.lng) || DEFAULT_CENTER[1]]}
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
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  )
}
