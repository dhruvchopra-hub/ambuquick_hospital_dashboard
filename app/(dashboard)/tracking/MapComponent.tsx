'use client'

import { useEffect, useRef } from 'react'
import { useJsApiLoader } from '@react-google-maps/api'
import { Ambulance, Ride } from '@/types'

const STATUS_COLORS: Record<string, string> = {
  available: '#16a34a', on_trip: '#2563eb', maintenance: '#d97706', offline: '#6b7280',
}
const STATUS_LABEL: Record<string, string> = {
  available: 'Available', on_trip: 'On Trip', maintenance: 'Maintenance', offline: 'Offline',
}
const DEFAULT_CENTER = { lat: 28.6139, lng: 77.2090 }

function makeAmbIcon(color: string) {
  const svg = encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="40">` +
    `<text x="18" y="30" text-anchor="middle" font-size="26" font-family="Apple Color Emoji,Segoe UI Emoji,Noto Color Emoji,sans-serif">🚑</text>` +
    `<circle cx="18" cy="37" r="4" fill="${color}" stroke="white" stroke-width="2"/>` +
    `</svg>`
  )
  return {
    url: `data:image/svg+xml,${svg}`,
    scaledSize: new window.google.maps.Size(36, 40),
    anchor: new window.google.maps.Point(18, 40),
  }
}

function makeInfoContent(amb: Ambulance, activeRide?: Ride): string {
  const s = amb.status
  const bg = s === 'available' ? '#dcfce7' : s === 'on_trip' ? '#dbeafe' : s === 'maintenance' ? '#fef3c7' : '#f3f4f6'
  const fg = s === 'available' ? '#15803d' : s === 'on_trip' ? '#1d4ed8' : s === 'maintenance' ? '#92400e' : '#4b5563'
  return (
    `<div style="min-width:148px;padding:4px 2px;font-family:system-ui,sans-serif">` +
    `<p style="font-weight:700;color:#1a1a1a;font-size:14px;margin:0">${amb.code}</p>` +
    `<p style="font-size:12px;color:#555;margin:2px 0 0">${amb.driver_name}</p>` +
    `<p style="font-size:12px;color:#888;margin:0">${amb.driver_phone || ''}</p>` +
    `<p style="font-size:12px;color:#aaa;margin:2px 0 0">${amb.type === 'hospital_fleet' ? 'Hospital Fleet' : (amb.type || '')}</p>` +
    `<span style="display:inline-block;margin-top:6px;font-size:11px;padding:2px 8px;border-radius:9999px;font-weight:600;background:${bg};color:${fg}">${STATUS_LABEL[s] || s}</span>` +
    (activeRide
      ? `<div style="margin-top:6px;padding-top:6px;border-top:1px solid #f0f0f0">` +
        `<p style="font-size:12px;font-weight:600;color:#333;margin:0">${activeRide.patient_name}</p>` +
        `<p style="font-size:12px;color:#aaa;margin:2px 0 0">→ ${activeRide.pickup_location}</p>` +
        `</div>`
      : '') +
    `</div>`
  )
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
    id: 'google-map-script',
    googleMapsApiKey: apiKey,
  })

  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<google.maps.Map | null>(null)
  const markersRef = useRef<Record<string, google.maps.Marker>>({})
  const infoWindowsRef = useRef<Record<string, google.maps.InfoWindow>>({})
  const polylinesRef = useRef<Record<string, google.maps.Polyline>>({})
  const geocodedRef = useRef<Record<string, { lat: number; lng: number }>>({})

  // Keep stable refs to props so event listeners never go stale
  const onSelectRef = useRef(onSelect)
  onSelectRef.current = onSelect
  const ambulancesRef = useRef(ambulances)
  ambulancesRef.current = ambulances

  // Initialise map exactly once when the API script is ready
  useEffect(() => {
    if (!isLoaded || !containerRef.current || mapRef.current) return
    mapRef.current = new window.google.maps.Map(containerRef.current, {
      center: DEFAULT_CENTER,
      zoom: 13,
      disableDefaultUI: false,
      zoomControl: true,
      streetViewControl: false,
      mapTypeControl: false,
      fullscreenControl: true,
      clickableIcons: false,
      styles: [{ featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] }],
    })
  }, [isLoaded])

  // Imperatively sync markers whenever ambulance data changes — never recreates the map
  useEffect(() => {
    if (!mapRef.current || !isLoaded) return
    const map = mapRef.current
    const currentIds = new Set(ambulances.map(a => a.id))

    // Remove markers for ambulances no longer present
    for (const id of Object.keys(markersRef.current)) {
      if (!currentIds.has(id)) {
        markersRef.current[id].setMap(null)
        infoWindowsRef.current[id]?.close()
        polylinesRef.current[id]?.setMap(null)
        delete markersRef.current[id]
        delete infoWindowsRef.current[id]
        delete polylinesRef.current[id]
      }
    }

    ambulances.forEach(amb => {
      const pos = {
        lat: Number(amb.lat) || DEFAULT_CENTER.lat,
        lng: Number(amb.lng) || DEFAULT_CENTER.lng,
      }
      const color = STATUS_COLORS[amb.status] || '#6b7280'
      const activeRide = rides.find(
        r => r.ambulance_id === amb.id && ['dispatched', 'en_route'].includes(r.status)
      )

      if (!markersRef.current[amb.id]) {
        // --- Create new marker + info window (only once per ambulance) ---
        const marker = new window.google.maps.Marker({
          position: pos,
          map,
          icon: makeAmbIcon(color),
        })
        const iw = new window.google.maps.InfoWindow({
          content: makeInfoContent(amb, activeRide),
          pixelOffset: new window.google.maps.Size(0, -8),
        })
        marker.addListener('click', () => {
          Object.values(infoWindowsRef.current).forEach(w => w.close())
          iw.open({ map, anchor: marker })
          // Pass the freshest ambulance data from ref, not the stale closure
          const fresh = ambulancesRef.current.find(a => a.id === amb.id)
          if (fresh) onSelectRef.current(fresh)
        })
        markersRef.current[amb.id] = marker
        infoWindowsRef.current[amb.id] = iw
      } else {
        // --- Update existing marker in place (no flicker, no map reset) ---
        markersRef.current[amb.id].setPosition(pos)
        markersRef.current[amb.id].setIcon(makeAmbIcon(color))
        // Silently refresh info window content (stays open if user had it open)
        infoWindowsRef.current[amb.id]?.setContent(makeInfoContent(amb, activeRide))
      }

      // Geocode pickup and draw dashed route line for on_trip ambulances
      if (activeRide) {
        if (!geocodedRef.current[activeRide.id]) {
          fetch(
            `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(activeRide.pickup_location + ', India')}&format=json&limit=1`,
            { headers: { 'User-Agent': 'AmbuQuick/1.0' } }
          )
            .then(r => r.json())
            .then(data => {
              if (!data[0]) return
              const pickup = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) }
              geocodedRef.current[activeRide.id] = pickup
              if (amb.status === 'on_trip') {
                polylinesRef.current[amb.id]?.setMap(null)
                polylinesRef.current[amb.id] = new window.google.maps.Polyline({
                  path: [pos, pickup],
                  map,
                  strokeColor: '#D91A2A',
                  strokeWeight: 3,
                  strokeOpacity: 0,
                  icons: [{
                    icon: { path: 'M 0,-1 0,1', strokeOpacity: 0.85, scale: 4, strokeColor: '#D91A2A' },
                    offset: '0',
                    repeat: '18px',
                  }],
                })
              }
            })
            .catch(() => { /* geocoding failures are non-fatal */ })
        } else if (amb.status === 'on_trip' && !polylinesRef.current[amb.id]) {
          const pickup = geocodedRef.current[activeRide.id]
          polylinesRef.current[amb.id] = new window.google.maps.Polyline({
            path: [pos, pickup],
            map,
            strokeColor: '#D91A2A',
            strokeWeight: 3,
            strokeOpacity: 0,
            icons: [{
              icon: { path: 'M 0,-1 0,1', strokeOpacity: 0.85, scale: 4, strokeColor: '#D91A2A' },
              offset: '0',
              repeat: '18px',
            }],
          })
        }
      } else {
        // No active ride — remove any stale polyline
        if (polylinesRef.current[amb.id]) {
          polylinesRef.current[amb.id].setMap(null)
          delete polylinesRef.current[amb.id]
        }
      }
    })
  }, [ambulances, rides, isLoaded])

  // Pan to whichever ambulance was selected from the side panel
  useEffect(() => {
    if (!mapRef.current || !selected) return
    const pos = { lat: Number(selected.lat), lng: Number(selected.lng) }
    if (isNaN(pos.lat) || isNaN(pos.lng)) return
    mapRef.current.panTo(pos)
    Object.values(infoWindowsRef.current).forEach(w => w.close())
    const marker = markersRef.current[selected.id]
    const iw = infoWindowsRef.current[selected.id]
    if (marker && iw) iw.open({ map: mapRef.current, anchor: marker })
  }, [selected])

  // Always render the container div — the map is mounted imperatively inside it
  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />

      {/* Overlays — shown above the (empty) map div when not ready */}
      {!apiKey && (
        <div className="absolute inset-0 flex items-center justify-center bg-ambu-bg rounded-xl">
          <p className="text-sm text-ambu-muted">Map unavailable — add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to .env.local</p>
        </div>
      )}
      {apiKey && loadError && (
        <div className="absolute inset-0 flex items-center justify-center bg-ambu-bg rounded-xl">
          <p className="text-sm text-ambu-muted">Map failed to load. Check your API key.</p>
        </div>
      )}
      {apiKey && !loadError && !isLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-ambu-bg rounded-xl">
          <div className="text-center">
            <div className="w-6 h-6 border-2 border-ambu-red border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <p className="text-xs text-ambu-muted">Loading map…</p>
          </div>
        </div>
      )}
    </div>
  )
}
