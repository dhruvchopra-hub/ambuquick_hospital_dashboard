'use client'

import { useEffect, useRef, useState } from 'react'
import { useJsApiLoader } from '@react-google-maps/api'
import { GOOGLE_MAPS_LIBRARIES } from '@/lib/googleMapsLibraries'
import { createClient } from '@/lib/supabase/client'
import Image from 'next/image'

interface TrackingRide {
  id: string
  tracking_token: string
  patient_name: string
  pickup_location: string
  destination: string
  status: string
  ambulance_id: string
  driver_name: string
  hospital_id: string
}

interface TrackingHospital {
  name: string
  logo_url: string | null
  primary_color: string
  slug: string
}

interface TrackingAmbulance {
  id: string
  code: string
  driver_name: string
  driver_phone: string
  type: string
  lat: number
  lng: number
}

const STATUS_CONFIG: Record<string, { label: string; emoji: string; bg: string; textColor: string }> = {
  dispatched: { label: 'Ambulance Dispatched', emoji: '🚑', bg: '#dbeafe', textColor: '#1e40af' },
  en_route:   { label: 'On The Way',            emoji: '🚑', bg: '#ffedd5', textColor: '#9a3412' },
  completed:  { label: 'At Hospital',           emoji: '✅', bg: '#dcfce7', textColor: '#14532d' },
  cancelled:  { label: 'Ride Cancelled',        emoji: '❌', bg: '#fee2e2', textColor: '#991b1b' },
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export default function TrackPage({
  params,
}: {
  params: { hospitalSlug: string; rideId: string }
}) {
  const { hospitalSlug, rideId } = params

  const [ride, setRide] = useState<TrackingRide | null>(null)
  const [hospital, setHospital] = useState<TrackingHospital | null>(null)
  const [ambulance, setAmbulance] = useState<TrackingAmbulance | null>(null)
  const [pageLoading, setPageLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [rideStatus, setRideStatus] = useState<string>('dispatched')
  const [driverPos, setDriverPos] = useState<{ lat: number; lng: number } | null>(null)
  const [pickupCoords, setPickupCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [eta, setEta] = useState<number | null>(null)
  const [isNearby, setIsNearby] = useState(false)

  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '',
    libraries: GOOGLE_MAPS_LIBRARIES,
  })

  // Map refs — imperative, never re-creates the map
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<google.maps.Map | null>(null)
  const ambMarkerRef = useRef<google.maps.Marker | null>(null)
  const pickupMarkerRef = useRef<google.maps.Marker | null>(null)
  const routeLineRef = useRef<google.maps.Polyline | null>(null)
  const animFromRef = useRef<{ lat: number; lng: number } | null>(null)
  const animToRef = useRef<{ lat: number; lng: number } | null>(null)
  const animStartRef = useRef<number>(0)
  const rafRef = useRef<number | null>(null)

  // ── Initial data fetch ──────────────────────────────────────
  useEffect(() => {
    const supabase = createClient()

    async function load() {
      // 1. Fetch ride by tracking token
      const { data: rideData, error: rideErr } = await supabase
        .from('rides')
        .select('id, tracking_token, patient_name, pickup_location, destination, status, ambulance_id, driver_name, hospital_id')
        .eq('tracking_token', rideId)
        .single()

      if (rideErr || !rideData) {
        setError('Tracking link not found or expired.')
        setPageLoading(false)
        return
      }

      // 2. Fetch hospital and verify slug matches
      const { data: hospData } = await supabase
        .from('hospitals')
        .select('name, logo_url, primary_color, slug')
        .eq('slug', hospitalSlug)
        .eq('id', rideData.hospital_id)
        .single()

      if (!hospData) {
        setError('Invalid tracking link.')
        setPageLoading(false)
        return
      }

      // 3. Fetch ambulance
      const { data: ambData } = await supabase
        .from('ambulances')
        .select('id, code, driver_name, driver_phone, type, lat, lng')
        .eq('id', rideData.ambulance_id)
        .single()

      setRide(rideData)
      setHospital(hospData)
      setAmbulance(ambData)
      setRideStatus(rideData.status)

      if (ambData) {
        const pos = { lat: Number(ambData.lat), lng: Number(ambData.lng) }
        setDriverPos(pos)

        // Geocode pickup to get coordinates for ETA + route line
        fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(rideData.pickup_location + ', India')}&format=json&limit=1`,
          { headers: { 'User-Agent': 'AmbuQuick/1.0' } }
        )
          .then(r => r.json())
          .then(d => {
            if (!d[0]) return
            const coords = { lat: parseFloat(d[0].lat), lng: parseFloat(d[0].lon) }
            setPickupCoords(coords)
            const km = haversineKm(pos.lat, pos.lng, coords.lat, coords.lng)
            setEta(Math.max(1, Math.round((km / 30) * 60)))
            setIsNearby(km < 2)
          })
          .catch(() => {})
      }

      setPageLoading(false)
    }

    load()
  }, [rideId, hospitalSlug])

  // ── Realtime subscriptions ──────────────────────────────────
  useEffect(() => {
    if (!ride || !ambulance) return
    const supabase = createClient()

    const channel = supabase
      .channel(`track-${rideId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'ambulances', filter: `id=eq.${ambulance.id}` },
        payload => {
          const newPos = { lat: Number(payload.new.lat), lng: Number(payload.new.lng) }
          setDriverPos(newPos)
          if (pickupCoords) {
            const km = haversineKm(newPos.lat, newPos.lng, pickupCoords.lat, pickupCoords.lng)
            setEta(Math.max(1, Math.round((km / 30) * 60)))
            setIsNearby(km < 2)
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'rides', filter: `tracking_token=eq.${rideId}` },
        payload => { setRideStatus(payload.new.status) }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [ride, ambulance, rideId, pickupCoords])

  // ── Init map once ───────────────────────────────────────────
  useEffect(() => {
    if (!isLoaded || !containerRef.current || mapRef.current || !driverPos) return
    mapRef.current = new window.google.maps.Map(containerRef.current, {
      center: driverPos,
      zoom: 14,
      disableDefaultUI: true,
      gestureHandling: 'greedy',
      styles: [{ featureType: 'poi', stylers: [{ visibility: 'off' }] }],
    })
  }, [isLoaded, driverPos])

  // ── Animate ambulance marker ────────────────────────────────
  useEffect(() => {
    if (!mapRef.current || !isLoaded || !driverPos) return
    const map = mapRef.current

    const ambSvg = encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="44">` +
      `<text x="20" y="32" text-anchor="middle" font-size="28" font-family="Apple Color Emoji,Segoe UI Emoji,Noto Color Emoji,sans-serif">🚑</text>` +
      `<circle cx="20" cy="41" r="4" fill="#DC2626" stroke="white" stroke-width="2"/>` +
      `</svg>`
    )
    const ambIcon = {
      url: `data:image/svg+xml,${ambSvg}`,
      scaledSize: new window.google.maps.Size(40, 44),
      anchor: new window.google.maps.Point(20, 44),
    }

    if (!ambMarkerRef.current) {
      ambMarkerRef.current = new window.google.maps.Marker({
        position: driverPos, map, icon: ambIcon, zIndex: 10,
      })
    } else {
      // Smooth animation between positions via requestAnimationFrame
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      animFromRef.current = ambMarkerRef.current.getPosition()?.toJSON() ?? driverPos
      animToRef.current = driverPos
      animStartRef.current = performance.now()
      const DURATION = 2000

      const animate = (now: number) => {
        const t = Math.min((now - animStartRef.current) / DURATION, 1)
        const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t
        if (animFromRef.current && animToRef.current && ambMarkerRef.current) {
          ambMarkerRef.current.setPosition({
            lat: animFromRef.current.lat + (animToRef.current.lat - animFromRef.current.lat) * ease,
            lng: animFromRef.current.lng + (animToRef.current.lng - animFromRef.current.lng) * ease,
          })
        }
        if (t < 1) rafRef.current = requestAnimationFrame(animate)
      }
      rafRef.current = requestAnimationFrame(animate)
    }

    map.panTo(driverPos)
  }, [driverPos, isLoaded])

  // ── Pickup marker + dashed route line ──────────────────────
  useEffect(() => {
    if (!mapRef.current || !isLoaded || !pickupCoords || !driverPos) return
    const map = mapRef.current

    const pinSvg = encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="36" viewBox="0 0 28 36">` +
      `<path d="M14 0C6.268 0 0 6.268 0 14c0 10.5 14 22 14 22S28 24.5 28 14C28 6.268 21.732 0 14 0z" fill="#DC2626"/>` +
      `<circle cx="14" cy="14" r="6" fill="white"/>` +
      `</svg>`
    )
    const pinIcon = {
      url: `data:image/svg+xml,${pinSvg}`,
      scaledSize: new window.google.maps.Size(28, 36),
      anchor: new window.google.maps.Point(14, 36),
    }

    if (!pickupMarkerRef.current) {
      pickupMarkerRef.current = new window.google.maps.Marker({
        position: pickupCoords, map, icon: pinIcon, zIndex: 5, title: 'Pickup Location',
      })
    }

    // Redraw route line whenever either position updates
    routeLineRef.current?.setMap(null)
    routeLineRef.current = new window.google.maps.Polyline({
      path: [driverPos, pickupCoords],
      map,
      strokeColor: '#DC2626',
      strokeWeight: 3,
      strokeOpacity: 0,
      icons: [{
        icon: { path: 'M 0,-1 0,1', strokeOpacity: 0.85, scale: 4, strokeColor: '#DC2626' },
        offset: '0',
        repeat: '18px',
      }],
    })
  }, [pickupCoords, driverPos, isLoaded])

  // Cleanup animation frame on unmount
  useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }, [])

  const statusCfg = STATUS_CONFIG[rideStatus] || STATUS_CONFIG.dispatched
  const isCompleted = rideStatus === 'completed'
  const isCancelled = rideStatus === 'cancelled'
  const showMap = !isCompleted && !isCancelled
  const primaryColor = hospital?.primary_color || '#DC2626'

  // ── Loading state ───────────────────────────────────────────
  if (pageLoading) {
    return (
      <div style={{ minHeight: '100vh', background: 'white', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
        <style>{`@keyframes aq-spin { to { transform: rotate(360deg) } }`}</style>
        <div style={{ width: '32px', height: '32px', border: `3px solid ${primaryColor}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'aq-spin 1s linear infinite' }} />
        <p style={{ color: '#6b7280', fontSize: '14px', fontFamily: 'system-ui, sans-serif' }}>Loading tracking info…</p>
      </div>
    )
  }

  // ── Error state ─────────────────────────────────────────────
  if (error || !ride || !hospital || !ambulance) {
    return (
      <div style={{ minHeight: '100vh', background: 'white', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', padding: '24px', textAlign: 'center', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ fontSize: '56px' }}>🔍</div>
        <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#111827', margin: 0 }}>Link Not Found</h1>
        <p style={{ color: '#6b7280', fontSize: '14px', margin: 0 }}>{error || 'This tracking link is invalid or has expired.'}</p>
        <p style={{ color: '#9ca3af', fontSize: '12px', marginTop: '8px' }}>AmbuQuick Emergency Network</p>
      </div>
    )
  }

  // ── Main tracking UI ────────────────────────────────────────
  return (
    <div style={{ background: '#f9fafb', minHeight: '100vh', maxWidth: '480px', margin: '0 auto', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <style>{`@keyframes aq-spin { to { transform: rotate(360deg) } } @keyframes aq-pulse { 0%,100%{opacity:1} 50%{opacity:.5} }`}</style>

      {/* ── Branding Bar ─────────────────────────────── */}
      <div style={{ background: 'white', borderBottom: `2.5px solid ${primaryColor}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {hospital.logo_url ? (
            <Image src={hospital.logo_url} alt="Hospital" width={36} height={36} style={{ borderRadius: '8px', objectFit: 'contain' }} />
          ) : (
            <div style={{ width: '36px', height: '36px', borderRadius: '8px', backgroundColor: primaryColor, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: '14px', flexShrink: 0 }}>
              {hospital.name.charAt(0)}
            </div>
          )}
          <div>
            <p style={{ fontWeight: 700, color: '#111827', fontSize: '14px', lineHeight: '1.2', margin: 0 }}>{hospital.name}</p>
            <p style={{ color: '#9ca3af', fontSize: '11px', margin: 0 }}>Emergency Response</p>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ color: '#9ca3af', fontSize: '10px', margin: 0 }}>Powered by</p>
          <p style={{ fontWeight: 700, fontSize: '12px', color: primaryColor, margin: 0 }}>AmbuQuick</p>
        </div>
      </div>

      {/* ── Status Banner ────────────────────────────── */}
      <div style={{ margin: '16px 16px 0', borderRadius: '16px', padding: '20px 16px', textAlign: 'center', backgroundColor: statusCfg.bg }}>
        <div style={{ fontSize: '36px', marginBottom: '6px' }}>{statusCfg.emoji}</div>
        <h2 style={{ fontWeight: 700, fontSize: '20px', color: statusCfg.textColor, margin: 0 }}>{statusCfg.label}</h2>
        {isNearby && !isCompleted && !isCancelled && (
          <p style={{ fontSize: '14px', marginTop: '6px', fontWeight: 600, color: statusCfg.textColor, animation: 'aq-pulse 1.5s ease-in-out infinite' }}>
            📍 Almost there!
          </p>
        )}
      </div>

      {/* ── ETA / Completion card ────────────────────── */}
      {isCompleted ? (
        <div style={{ margin: '12px 16px 0', background: '#f0fdf4', borderRadius: '16px', border: '1px solid #bbf7d0', padding: '20px', textAlign: 'center' }}>
          <p style={{ fontSize: '22px', fontWeight: 700, color: '#15803d', margin: 0 }}>Ambulance has arrived!</p>
          <p style={{ color: '#16a34a', fontSize: '14px', marginTop: '6px', margin: '6px 0 0' }}>Patient is being attended to</p>
        </div>
      ) : isCancelled ? (
        <div style={{ margin: '12px 16px 0', background: '#fef2f2', borderRadius: '16px', border: '1px solid #fecaca', padding: '16px', textAlign: 'center' }}>
          <p style={{ fontSize: '16px', fontWeight: 600, color: '#991b1b', margin: 0 }}>This ride has been cancelled</p>
          <p style={{ color: '#b91c1c', fontSize: '13px', marginTop: '4px', margin: '4px 0 0' }}>Please contact the hospital for assistance</p>
        </div>
      ) : (
        <div style={{ margin: '12px 16px 0', background: 'white', borderRadius: '16px', border: '1px solid #f3f4f6', padding: '20px', textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          {eta !== null ? (
            <>
              <p style={{ fontSize: '52px', fontWeight: 900, color: primaryColor, lineHeight: 1, margin: 0 }}>{eta}</p>
              <p style={{ color: '#4b5563', fontSize: '14px', marginTop: '4px' }}>min estimated arrival</p>
              <p style={{ color: '#9ca3af', fontSize: '11px', marginTop: '2px' }}>Updates every 5 seconds</p>
            </>
          ) : (
            <p style={{ color: '#9ca3af', fontSize: '14px' }}>Calculating ETA…</p>
          )}
        </div>
      )}

      {/* ── Map ──────────────────────────────────────── */}
      {/* Always render the container div for the ref; hide with CSS when not needed */}
      <div style={{
        margin: '12px 16px 0',
        borderRadius: '16px',
        overflow: 'hidden',
        height: showMap ? 'min(45vw, 320px)' : '0',
        minHeight: showMap ? '200px' : '0',
        transition: 'height 0.3s ease',
        position: 'relative',
        display: showMap ? 'block' : 'none',
      }}>
        <div ref={containerRef} style={{ width: '100%', height: '100%', background: '#f3f4f6' }} />
        {showMap && !isLoaded && (
          <div style={{ position: 'absolute', inset: 0, background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: '24px', height: '24px', border: `2px solid ${primaryColor}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'aq-spin 1s linear infinite' }} />
          </div>
        )}
      </div>

      {/* ── Driver Info Card ─────────────────────────── */}
      <div style={{ margin: '12px 16px 0', background: 'white', borderRadius: '16px', border: '1px solid #f3f4f6', padding: '16px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: '#4b5563', fontSize: '18px', flexShrink: 0 }}>
            {ambulance.driver_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
          </div>
          <div>
            <p style={{ fontWeight: 700, color: '#111827', fontSize: '15px', margin: 0 }}>{ambulance.driver_name}</p>
            <p style={{ color: '#6b7280', fontSize: '13px', margin: '2px 0 0' }}>
              {ambulance.code} · {ambulance.type === 'hospital_fleet' ? 'Hospital Fleet' : ambulance.type || 'Basic Life Support'}
            </p>
          </div>
        </div>
        <a
          href={`tel:+91${(ambulance.driver_phone || '').replace(/\D/g, '')}`}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            background: '#16a34a', color: 'white', fontWeight: 700, fontSize: '16px',
            padding: '14px', borderRadius: '12px', textDecoration: 'none',
            marginBottom: '12px', width: '100%', boxSizing: 'border-box',
          }}
        >
          📞 Call Driver
        </a>
        <p style={{ textAlign: 'center', fontSize: '12px', color: '#9ca3af', margin: 0 }}>
          Need help? Call AmbuQuick:{' '}
          <a href="tel:1800XXXXXXX" style={{ fontWeight: 600, color: '#6b7280', textDecoration: 'none' }}>1800-XXX-XXXX</a>
        </p>
      </div>

      {/* ── Tips Card ────────────────────────────────── */}
      {!isCompleted && !isCancelled && (
        <div style={{ margin: '12px 16px 0', background: 'white', borderRadius: '16px', border: '1px solid #f3f4f6', padding: '16px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <p style={{ fontWeight: 700, color: '#374151', marginBottom: '12px', fontSize: '14px', margin: '0 0 12px' }}>While you wait:</p>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {[
              'Keep the entrance/gate clear for the ambulance',
              "Have patient's documents ready",
              'Stay near your phone',
              'Someone should be ready to assist the driver',
            ].map(tip => (
              <li key={tip} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '13px', color: '#4b5563' }}>
                <span style={{ color: '#16a34a', fontWeight: 700, marginTop: '1px', flexShrink: 0 }}>✓</span>
                {tip}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── Footer ───────────────────────────────────── */}
      <div style={{ textAlign: 'center', padding: '24px 16px', marginTop: '8px' }}>
        <p style={{ fontWeight: 700, color: '#9ca3af', fontSize: '13px', margin: 0 }}>🚑 AmbuQuick</p>
        <p style={{ color: '#9ca3af', fontSize: '11px', margin: '2px 0 0' }}>Emergency Medical Network</p>
        <p style={{ color: '#9ca3af', fontSize: '11px', margin: '2px 0 0' }}>© 2026 AmbuQuick</p>
      </div>
    </div>
  )
}
