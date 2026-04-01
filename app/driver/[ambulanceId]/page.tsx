'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { MapPin, Wifi, WifiOff, CheckCircle, AlertCircle, BatteryCharging, Navigation, Lock } from 'lucide-react'

interface AmbulanceInfo { code: string; driver_name: string; status: string }
interface ActiveRide {
  id: string
  patient_name: string; pickup_location: string; destination: string
  urgency: string; patient_phone: string
  status: string
  assignment_score?: number | null
}

export default function DriverTrackingPage({ params }: { params: { ambulanceId: string } }) {
  const [ambulance, setAmbulance] = useState<AmbulanceInfo | null>(null)
  const [activeRide, setActiveRide] = useState<ActiveRide | null>(null)
  const [pinVerified, setPinVerified] = useState(false)
  const [pin, setPin] = useState('')
  const [pinError, setPinError] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [tracking, setTracking] = useState(false)
  const [responding, setResponding] = useState(false)
  const [declineReason, setDeclineReason] = useState('')
  const [showDeclineReasons, setShowDeclineReasons] = useState(false)
  const [coords, setCoords] = useState<{ lat: number; lng: number; accuracy: number } | null>(null)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [showInstall, setShowInstall] = useState(false)
  const watchIdRef = useRef<number | null>(null)
  const wakeLockRef = useRef<WakeLockSentinel | null>(null)
  const deferredPromptRef = useRef<Event | null>(null)

  useEffect(() => {
    // Register service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    }

    // Capture install prompt
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault()
      deferredPromptRef.current = e
      setShowInstall(true)
    }
    window.addEventListener('beforeinstallprompt', handleBeforeInstall)

    Promise.all([
      fetch(`/api/driver/ambulance?id=${params.ambulanceId}`).then(r => r.json()),
      fetch(`/api/driver/ride?ambulanceId=${params.ambulanceId}`).then(r => r.json()),
    ]).then(([ambData, rideData]) => {
      if (ambData.error) setError(ambData.error)
      else setAmbulance(ambData)
      if (!rideData.error) setActiveRide(rideData)
    }).catch(() => setError('Could not load info')).finally(() => setLoading(false))

    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall)
  }, [params.ambulanceId])

  useEffect(() => {
    const handleVisibility = async () => {
      if (tracking && document.visibilityState === 'visible' && 'wakeLock' in navigator) {
        try { wakeLockRef.current = await navigator.wakeLock.request('screen') } catch {}
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [tracking])

  const verifyPin = async () => {
    if (pin.length !== 4) { setPinError('Enter a 4-digit PIN'); return }
    setVerifying(true); setPinError('')
    const res = await fetch('/api/driver/verify-pin', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ambulanceId: params.ambulanceId, pin }),
    })
    const data = await res.json()
    if (data.valid) setPinVerified(true)
    else setPinError('Incorrect PIN. Try again.')
    setVerifying(false)
  }

  const sendLocation = useCallback(async (lat: number, lng: number) => {
    try {
      await fetch('/api/driver/location', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ambulanceId: params.ambulanceId, lat, lng }),
      })
      setLastUpdate(new Date())
    } catch {}
  }, [params.ambulanceId])

  const respondToRide = async (response: 'accept' | 'decline') => {
    if (!activeRide) return
    setResponding(true)
    try {
      await fetch('/api/driver/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ambulanceId: params.ambulanceId,
          rideId: activeRide.id,
          response,
          reason: response === 'decline' ? declineReason : undefined,
        }),
      })
      if (response === 'decline') {
        setActiveRide(null)
        setShowDeclineReasons(false)
        setDeclineReason('')
      } else {
        setActiveRide(prev => prev ? { ...prev, status: 'dispatched' } : prev)
      }
    } catch { /* non-fatal */ }
    setResponding(false)
  }

  const startTracking = async () => {
    if (!navigator.geolocation) { setError('Geolocation not supported'); return }
    setError('')
    if ('wakeLock' in navigator) {
      try { wakeLockRef.current = await navigator.wakeLock.request('screen') } catch {}
    }
    setTracking(true)
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords
        setCoords({ lat: latitude, lng: longitude, accuracy })
        sendLocation(latitude, longitude)
      },
      (err) => { setError('GPS error: ' + err.message); setTracking(false) },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
    )
  }

  const stopTracking = () => {
    if (watchIdRef.current !== null) { navigator.geolocation.clearWatch(watchIdRef.current); watchIdRef.current = null }
    wakeLockRef.current?.release(); wakeLockRef.current = null
    setTracking(false)
  }

  useEffect(() => () => {
    if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current)
    wakeLockRef.current?.release()
  }, [])

  const installApp = async () => {
    if (!deferredPromptRef.current) return
    const prompt = deferredPromptRef.current as unknown as { prompt: () => void; userChoice: Promise<{ outcome: string }> }
    prompt.prompt()
    const { outcome } = await prompt.userChoice
    if (outcome === 'accepted') setShowInstall(false)
  }

  if (loading) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (!ambulance) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-6">
      <div className="text-center">
        <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
        <p className="text-white font-semibold">Invalid tracking link</p>
        <p className="text-gray-500 text-sm mt-1">{error || 'Ambulance not found'}</p>
      </div>
    </div>
  )

  // PIN screen
  if (!pinVerified) return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center p-6 gap-6">
      <div className="text-center">
        <div className="w-16 h-16 bg-red-500/20 rounded-2xl flex items-center justify-center mx-auto mb-3 text-4xl">🚑</div>
        <h1 className="text-xl font-bold">{ambulance.code}</h1>
        <p className="text-gray-400 mt-1">{ambulance.driver_name}</p>
      </div>
      <div className="bg-gray-900 rounded-2xl p-6 w-full max-w-sm space-y-4">
        <div className="flex items-center gap-2 text-gray-300 text-sm font-medium">
          <Lock className="w-4 h-4" /> Enter Driver PIN
        </div>
        <input
          type="number" inputMode="numeric" maxLength={4} value={pin}
          onChange={e => { setPin(e.target.value.slice(0, 4)); setPinError('') }}
          onKeyDown={e => e.key === 'Enter' && verifyPin()}
          placeholder="4-digit PIN"
          className="w-full text-center text-3xl font-bold tracking-[0.5em] bg-gray-800 border border-gray-700 rounded-xl px-4 py-4 text-white focus:outline-none focus:ring-2 focus:ring-red-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
        {pinError && <p className="text-red-400 text-sm text-center">{pinError}</p>}
        <button onClick={verifyPin} disabled={verifying || pin.length !== 4}
          className="w-full py-4 rounded-xl bg-red-600 hover:bg-red-700 font-bold text-lg transition-all active:scale-95 disabled:opacity-50">
          {verifying ? 'Verifying…' : 'Unlock'}
        </button>
      </div>
      <p className="text-gray-600 text-xs text-center">Contact your hospital admin if you don't know your PIN</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center p-6 gap-5">
      {/* Install banner */}
      {showInstall && (
        <div className="w-full max-w-sm bg-gray-800 border border-gray-700 rounded-xl p-3 flex items-center justify-between gap-3">
          <p className="text-sm text-gray-300">Add to Home Screen for best experience</p>
          <button onClick={installApp} className="text-xs bg-red-600 text-white px-3 py-1.5 rounded-lg font-medium shrink-0">Install</button>
        </div>
      )}

      <div className="text-center">
        <div className="w-16 h-16 bg-red-500/20 rounded-2xl flex items-center justify-center mx-auto mb-3 text-4xl">🚑</div>
        <h1 className="text-2xl font-bold">{ambulance.code}</h1>
        <p className="text-gray-400 mt-1">{ambulance.driver_name}</p>
      </div>

      {/* Active Trip */}
      {activeRide ? (
        <div className="bg-gray-900 border border-gray-700 rounded-2xl p-5 w-full max-w-sm space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <Navigation className="w-4 h-4 text-red-400" />
            <span className="text-sm font-semibold">
              {activeRide.status === 'pending' ? 'New Ride Request' : 'Active Trip'}
            </span>
            <span className={`ml-auto text-xs px-2 py-0.5 rounded-full font-medium ${
              activeRide.urgency === 'Critical' ? 'bg-red-500/20 text-red-400' :
              activeRide.urgency === 'Urgent' ? 'bg-orange-500/20 text-orange-400' : 'bg-green-500/20 text-green-400'
            }`}>{activeRide.urgency}</span>
          </div>

          {activeRide.assignment_score && (
            <p className="text-xs text-gray-500">
              Assigned to you · Best match in your area ({activeRide.assignment_score}/100)
            </p>
          )}

          <div className="flex justify-between text-sm"><span className="text-gray-500">Patient</span><span className="font-medium">{activeRide.patient_name}</span></div>
          <div className="flex justify-between text-sm"><span className="text-gray-500">Phone</span><a href={`tel:${activeRide.patient_phone}`} className="text-blue-400">{activeRide.patient_phone}</a></div>
          <div className="border-t border-gray-800 pt-3 space-y-1">
            <div className="flex items-start gap-2 text-sm"><span className="text-gray-500 shrink-0">Pickup</span><span className="text-right ml-auto">{activeRide.pickup_location}</span></div>
            <div className="flex items-start gap-2 text-sm"><span className="text-gray-500 shrink-0">Drop</span><span className="text-right ml-auto">{activeRide.destination}</span></div>
          </div>

          {activeRide.status === 'pending' && (
            <div className="border-t border-gray-800 pt-3 space-y-2">
              {!showDeclineReasons ? (
                <div className="flex gap-2">
                  <button
                    onClick={() => respondToRide('accept')}
                    disabled={responding}
                    className="flex-1 py-3 rounded-xl bg-green-600 hover:bg-green-700 font-bold text-sm transition active:scale-95 disabled:opacity-50"
                  >
                    {responding ? '…' : '✓ Accept'}
                  </button>
                  <button
                    onClick={() => setShowDeclineReasons(true)}
                    disabled={responding}
                    className="flex-1 py-3 rounded-xl bg-gray-700 hover:bg-gray-600 font-bold text-sm transition active:scale-95 disabled:opacity-50"
                  >
                    ✕ Decline
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-gray-400">Reason (optional)</p>
                  <div className="flex flex-wrap gap-2">
                    {['Too far away', 'Off route', 'Vehicle issue'].map(r => (
                      <button
                        key={r}
                        onClick={() => setDeclineReason(prev => prev === r ? '' : r)}
                        className={`text-xs px-3 py-1.5 rounded-full border transition ${
                          declineReason === r
                            ? 'border-red-500 bg-red-500/20 text-red-400'
                            : 'border-gray-600 text-gray-400'
                        }`}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setShowDeclineReasons(false); setDeclineReason('') }}
                      className="flex-1 py-2.5 rounded-xl bg-gray-700 text-sm transition"
                    >
                      Back
                    </button>
                    <button
                      onClick={() => respondToRide('decline')}
                      disabled={responding}
                      className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 font-bold text-sm transition active:scale-95 disabled:opacity-50"
                    >
                      {responding ? '…' : 'Confirm Decline'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="bg-gray-900 rounded-2xl p-4 w-full max-w-sm text-center text-gray-500 text-sm">No active trip assigned</div>
      )}

      <div className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium ${tracking ? 'bg-green-500/20 text-green-400' : 'bg-gray-800 text-gray-400'}`}>
        {tracking ? <><Wifi className="w-4 h-4" /> Sending Location</> : <><WifiOff className="w-4 h-4" /> Not Tracking</>}
      </div>

      {tracking && (
        <div className="flex items-start gap-2 bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-xs px-4 py-3 rounded-xl w-full max-w-sm">
          <BatteryCharging className="w-4 h-4 shrink-0 mt-0.5" />
          <span>Keep this page open. You can lock your screen — do not close the app.</span>
        </div>
      )}

      {coords && (
        <div className="bg-gray-900 rounded-2xl p-5 w-full max-w-sm space-y-3">
          <div className="flex justify-between text-sm"><span className="text-gray-500">Latitude</span><span className="font-mono">{coords.lat.toFixed(6)}</span></div>
          <div className="flex justify-between text-sm"><span className="text-gray-500">Longitude</span><span className="font-mono">{coords.lng.toFixed(6)}</span></div>
          <div className="flex justify-between text-sm"><span className="text-gray-500">Accuracy</span><span className="font-mono">±{Math.round(coords.accuracy)}m</span></div>
          {lastUpdate && (
            <div className="flex justify-between text-sm border-t border-gray-800 pt-3">
              <span className="text-gray-500">Last sent</span>
              <span className="text-green-400 flex items-center gap-1.5"><CheckCircle className="w-3.5 h-3.5" />{lastUpdate.toLocaleTimeString()}</span>
            </div>
          )}
        </div>
      )}

      <button onClick={tracking ? stopTracking : startTracking}
        className={`w-full max-w-sm py-5 rounded-2xl text-lg font-bold transition-all active:scale-95 ${tracking ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'}`}>
        {tracking ? 'Stop Tracking' : 'Start Tracking'}
      </button>

      {error && (
        <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 px-4 py-2 rounded-xl">
          <AlertCircle className="w-4 h-4 shrink-0" />{error}
        </div>
      )}
      <p className="text-gray-600 text-xs text-center max-w-xs">Screen stays on while tracking. Hospital dashboard updates in real time.</p>
    </div>
  )
}
