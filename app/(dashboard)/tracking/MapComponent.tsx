'use client'

import { useEffect, useState, useCallback, Fragment } from 'react'
import { useJsApiLoader, GoogleMap, OverlayView, Polyline, InfoWindow } from '@react-google-maps/api'
import { Ambulance, Ride } from '@/types'

const STATUS_COLORS: Record<string, string> = {
  available: '#16a34a', on_trip: '#2563eb', maintenance: '#d97706', offline: '#6b7280',
}
const DEFAULT_CENTER = { lat: 28.6139, lng: 77.2090 }
const MAP_OPTIONS = {
  disableDefaultUI: false,
  zoomControl: true,
  streetViewControl: false,
  mapTypeControl: false,
  fullscreenControl: true,
  clickableIcons: false,
  styles: [
    { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  ],
}

interface Props {
  ambulances: Ambulance[]
  rides: Ride[]
  selected: Ambulance | null
  onSelect: (amb: Ambulance | null) => void
}

export default function MapComponent({ ambulances, rides, selected, onSelect }: Props) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script-tracking',
    googleMapsApiKey: apiKey,
  })

  const [map, setMap] = useState<google.maps.Map | null>(null)
  const [geocoded, setGeocoded] = useState<Record<string, { lat: number; lng: number }>>({})
  const [openInfo, setOpenInfo] = useState<string | null>(null)

  const onLoad = useCallback((m: google.maps.Map) => setMap(m), [])
  const onUnmount = useCallback(() => setMap(null), [])

  // Pan to selected ambulance from side panel clicks
  useEffect(() => {
    if (!map || !selected) return
    const lat = Number(selected.lat)
    const lng = Number(selected.lng)
    if (!isNaN(lat) && !isNaN(lng)) {
      map.panTo({ lat, lng })
      setOpenInfo(selected.id)
    }
  }, [map, selected])

  // Geocode pickup locations for on_trip ambulances (Nominatim, free)
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
          setGeocoded(prev => ({ ...prev, [ride.id]: { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) } }))
        }
      } catch { /* silently ignore geocoding failures */ }
    })
  }, [ambulances, rides, geocoded])

  if (!apiKey) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-ambu-bg rounded-xl">
        <p className="text-sm text-ambu-muted">Map unavailable — add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to .env.local</p>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-ambu-bg rounded-xl">
        <p className="text-sm text-ambu-muted">Map failed to load. Check your API key.</p>
      </div>
    )
  }

  if (!isLoaded) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-ambu-bg rounded-xl">
        <div className="text-center">
          <div className="w-6 h-6 border-2 border-ambu-red border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className="text-xs text-ambu-muted">Loading map…</p>
        </div>
      </div>
    )
  }

  const mapCenter = ambulances.length > 0
    ? { lat: Number(ambulances[0].lat) || DEFAULT_CENTER.lat, lng: Number(ambulances[0].lng) || DEFAULT_CENTER.lng }
    : DEFAULT_CENTER

  return (
    <GoogleMap
      mapContainerStyle={{ width: '100%', height: '100%' }}
      center={mapCenter}
      zoom={13}
      options={MAP_OPTIONS}
      onLoad={onLoad}
      onUnmount={onUnmount}
    >
      {ambulances.map(amb => {
        const ambPos = {
          lat: Number(amb.lat) || DEFAULT_CENTER.lat,
          lng: Number(amb.lng) || DEFAULT_CENTER.lng,
        }
        const activeRide = rides.find(r => r.ambulance_id === amb.id && ['dispatched', 'en_route'].includes(r.status))
        const pickupCoords = activeRide ? geocoded[activeRide.id] : undefined
        const statusColor = STATUS_COLORS[amb.status] || '#6b7280'
        const isOpen = openInfo === amb.id

        return (
          <Fragment key={amb.id}>
            {/* Custom ambulance marker using OverlayView */}
            <OverlayView position={ambPos} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
              <div
                onClick={() => {
                  const next = isOpen ? null : amb.id
                  setOpenInfo(next)
                  onSelect(isOpen ? null : amb)
                }}
                style={{
                  cursor: 'pointer',
                  textAlign: 'center',
                  width: 36,
                  transform: 'translate(-18px, -38px)',
                  position: 'relative',
                }}
              >
                <div style={{ fontSize: 28, lineHeight: 1, filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.4))' }}>
                  🚑
                </div>
                <div style={{
                  position: 'absolute',
                  bottom: -3,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: 9,
                  height: 9,
                  borderRadius: '50%',
                  background: statusColor,
                  border: '2px solid white',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
                }} />
              </div>
            </OverlayView>

            {/* InfoWindow popup */}
            {isOpen && (
              <InfoWindow
                position={ambPos}
                onCloseClick={() => { setOpenInfo(null); onSelect(null) }}
                options={{ pixelOffset: new window.google.maps.Size(0, -46) }}
              >
                <div style={{ minWidth: 148, padding: '4px 2px', fontFamily: 'inherit' }}>
                  <p style={{ fontWeight: 700, color: '#1a1a1a', fontSize: 14, margin: 0 }}>{amb.code}</p>
                  <p style={{ fontSize: 12, color: '#555', margin: '2px 0 0' }}>{amb.driver_name}</p>
                  <p style={{ fontSize: 12, color: '#888', margin: 0 }}>{amb.driver_phone}</p>
                  <p style={{ fontSize: 12, color: '#aaa', margin: '2px 0 0' }}>
                    {amb.type === 'hospital_fleet' ? 'Hospital Fleet' : amb.type}
                  </p>
                  <span style={{
                    display: 'inline-block',
                    marginTop: 6,
                    fontSize: 11,
                    padding: '2px 8px',
                    borderRadius: 9999,
                    fontWeight: 600,
                    background: amb.status === 'available' ? '#dcfce7' : amb.status === 'on_trip' ? '#dbeafe' : amb.status === 'maintenance' ? '#fef3c7' : '#f3f4f6',
                    color: amb.status === 'available' ? '#15803d' : amb.status === 'on_trip' ? '#1d4ed8' : amb.status === 'maintenance' ? '#92400e' : '#4b5563',
                  }}>
                    {amb.status === 'on_trip' ? 'On Trip' : amb.status.charAt(0).toUpperCase() + amb.status.slice(1)}
                  </span>
                  {activeRide && (
                    <div style={{ marginTop: 6, paddingTop: 6, borderTop: '1px solid #f0f0f0' }}>
                      <p style={{ fontSize: 12, fontWeight: 600, color: '#333', margin: 0 }}>{activeRide.patient_name}</p>
                      <p style={{ fontSize: 12, color: '#aaa', margin: '2px 0 0' }}>→ {activeRide.pickup_location}</p>
                    </div>
                  )}
                </div>
              </InfoWindow>
            )}

            {/* Dashed route line from ambulance to pickup location */}
            {pickupCoords && amb.status === 'on_trip' && (
              <Polyline
                path={[ambPos, pickupCoords]}
                options={{
                  strokeColor: '#D91A2A',
                  strokeWeight: 3,
                  strokeOpacity: 0,
                  icons: [{
                    icon: { path: 'M 0,-1 0,1', strokeOpacity: 0.85, scale: 4, strokeColor: '#D91A2A' },
                    offset: '0',
                    repeat: '18px',
                  }],
                }}
              />
            )}
          </Fragment>
        )
      })}
    </GoogleMap>
  )
}
