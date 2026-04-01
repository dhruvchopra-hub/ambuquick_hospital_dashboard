'use client'

import { useEffect, useRef, useState } from 'react'
import { useJsApiLoader } from '@react-google-maps/api'
import { GOOGLE_MAPS_LIBRARIES } from '@/lib/googleMapsLibraries'
import { createClient } from '@/lib/supabase/client'
import { Ambulance } from '@/types'
import { toast } from 'sonner'
import { Loader2, User, Phone, MapPin, Navigation, Zap, Clock, Calendar, CheckCircle2, X, PlusCircle, Sparkles } from 'lucide-react'
import { useRouter } from 'next/navigation'

const URGENCY_OPTIONS = [
  {
    key: 'Critical',
    icon: <Zap className="w-5 h-5" />,
    desc: 'Life-threatening emergency, immediate dispatch',
    eta: 8,
    price: 2500,
    border: 'border-ambu-red',
    bg: 'bg-red-50',
    text: 'text-ambu-red',
    iconBg: 'bg-ambu-red/10',
  },
  {
    key: 'Urgent',
    icon: <Clock className="w-5 h-5" />,
    desc: 'Needs ambulance within 30 minutes',
    eta: 15,
    price: 1200,
    border: 'border-orange-500',
    bg: 'bg-orange-50',
    text: 'text-orange-700',
    iconBg: 'bg-orange-100',
  },
  {
    key: 'Scheduled',
    icon: <Calendar className="w-5 h-5" />,
    desc: 'Pre-planned non-emergency transport',
    eta: 25,
    price: 1200,
    border: 'border-emerald-500',
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    iconBg: 'bg-emerald-100',
  },
] as const

type Urgency = 'Critical' | 'Urgent' | 'Scheduled'

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-ambu-border/60 rounded-lg ${className}`} />
}

export default function BookAmbulancePage() {
  const router = useRouter()
  const { isLoaded: mapsLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '',
    libraries: GOOGLE_MAPS_LIBRARIES,
  })
  const pickupRef = useRef<HTMLInputElement>(null)
  const destRef = useRef<HTMLInputElement>(null)
  const [hospitalId, setHospitalId] = useState('')
  const [hospitalSlug, setHospitalSlug] = useState('')
  const [hospitalName, setHospitalName] = useState('')
  const [ambulances, setAmbulances] = useState<Ambulance[]>([])
  const [ambLoading, setAmbLoading] = useState(true)
  const [loading, setLoading] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [dispatched, setDispatched] = useState<{
    driverName: string; vehicleCode: string; eta: number
    trackingToken: string; patientPhone: string; whatsappSent: boolean
  } | null>(null)
  const [form, setForm] = useState({
    patient_name: '', patient_phone: '', patient_age: '', patient_gender: '',
    pickup_location: '', destination: '', chief_complaint: '',
    urgency: 'Urgent' as Urgency, ambulance_id: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [pickupCoords, setPickupCoords] = useState<{ lat: number; lng: number; place_id: string } | null>(null)
  const [destCoords, setDestCoords] = useState<{ lat: number; lng: number; place_id: string } | null>(null)
  const [matchLoading, setMatchLoading] = useState(false)
  const [bestMatch, setBestMatch] = useState<{
    id: string; code: string; type: string; driver_name: string; is_hospital_fleet: boolean
    driveTimeMinutes: number; distanceKm: string; matchScore: number
    scoreBreakdown: { proximity: number; type: number; rating: number; fatigue: number }
  } | null>(null)

  const urgencyConfig = URGENCY_OPTIONS.find(u => u.key === form.urgency)!

  // Run smart matching whenever we have pickup coords + urgency + hospitalId
  useEffect(() => {
    if (!hospitalId || ambulances.length === 0) return
    setBestMatch(null)
    setMatchLoading(true)
    fetch('/api/match-ambulance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pickupLat: pickupCoords?.lat ?? null,
        pickupLng: pickupCoords?.lng ?? null,
        urgency: form.urgency,
        hospitalId,
      }),
    })
      .then(r => r.json())
      .then(data => {
        if (data.scored?.length) {
          const top = data.scored[0]
          setBestMatch(top)
          setForm(prev => ({ ...prev, ambulance_id: top.id }))
        }
      })
      .catch(() => {})
      .finally(() => setMatchLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickupCoords, form.urgency, hospitalId, ambulances.length])

  const loadAmbs = async (supabase: ReturnType<typeof createClient>) => {
    setAmbLoading(true)
    const { data } = await supabase.from('ambulances').select('*').eq('status', 'available')
    setAmbulances((data as Ambulance[]) || [])
    setAmbLoading(false)
  }

  useEffect(() => {
    const supabase = createClient()
    async function init() {
      const { data: profile } = await supabase.from('user_profiles').select('hospital_id').single()
      if (profile?.hospital_id) {
        setHospitalId(profile.hospital_id)
        // Fetch hospital name + slug for tracking URL and WhatsApp
        const { data: hosp } = await supabase
          .from('hospitals')
          .select('name, slug')
          .eq('id', profile.hospital_id)
          .single()
        if (hosp) {
          setHospitalName(hosp.name || '')
          setHospitalSlug(hosp.slug || '')
        }
      }
      await loadAmbs(supabase)
    }
    init()
  }, [])

  // Attach Google Places Autocomplete to pickup + destination inputs
  useEffect(() => {
    if (!mapsLoaded || !window.google?.maps?.places) return
    const opts: google.maps.places.AutocompleteOptions = {
      componentRestrictions: { country: 'in' },
      fields: ['formatted_address', 'geometry', 'place_id'],
    }
    if (pickupRef.current) {
      const ac = new window.google.maps.places.Autocomplete(pickupRef.current, opts)
      ac.addListener('place_changed', () => {
        const place = ac.getPlace()
        if (place.formatted_address) {
          setForm(prev => ({ ...prev, pickup_location: place.formatted_address! }))
          setErrors(prev => { const n = { ...prev }; delete n.pickup_location; return n })
          if (place.geometry?.location && place.place_id) {
            setPickupCoords({
              lat: place.geometry.location.lat(),
              lng: place.geometry.location.lng(),
              place_id: place.place_id,
            })
          }
        }
      })
    }
    if (destRef.current) {
      const ac = new window.google.maps.places.Autocomplete(destRef.current, opts)
      ac.addListener('place_changed', () => {
        const place = ac.getPlace()
        if (place.formatted_address) {
          setForm(prev => ({ ...prev, destination: place.formatted_address! }))
          setErrors(prev => { const n = { ...prev }; delete n.destination; return n })
          if (place.geometry?.location && place.place_id) {
            setDestCoords({
              lat: place.geometry.location.lat(),
              lng: place.geometry.location.lng(),
              place_id: place.place_id,
            })
          }
        }
      })
    }
  }, [mapsLoaded])

  const f = (field: keyof typeof form, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }))
    if (errors[field]) setErrors(prev => { const n = { ...prev }; delete n[field]; return n })
    if (field === 'pickup_location') setPickupCoords(null)
    if (field === 'destination') setDestCoords(null)
  }

  const validate = () => {
    const e: Record<string, string> = {}
    if (!form.patient_name.trim()) e.patient_name = 'Patient name is required'
    if (!form.patient_phone.trim()) e.patient_phone = 'Phone number is required'
    if (!/^[0-9]{10}$/.test(form.patient_phone.replace(/\s/g, ''))) e.patient_phone = 'Enter a valid 10-digit phone number'
    if (!form.patient_age || isNaN(Number(form.patient_age)) || Number(form.patient_age) < 0 || Number(form.patient_age) > 120) e.patient_age = 'Enter a valid age (0–120)'
    if (!form.patient_gender) e.patient_gender = 'Please select gender'
    if (!form.pickup_location.trim()) e.pickup_location = 'Pickup location is required'
    if (!form.destination.trim()) e.destination = 'Destination is required'
    if (!form.chief_complaint.trim()) e.chief_complaint = 'Chief complaint is required'
    if (!form.ambulance_id) e.ambulance_id = 'Please select an ambulance'
    return e
  }

  const handleReview = (e: React.FormEvent) => {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length > 0) { setErrors(errs); return }
    setErrors({})
    setShowConfirm(true)
  }

  const handleConfirmDispatch = async () => {
    setShowConfirm(false)
    setLoading(true)
    const supabase = createClient()
    const selectedAmb = ambulances.find(a => a.id === form.ambulance_id)
    const eta = urgencyConfig.eta
    const amount = urgencyConfig.price

    const { data: rideRow } = await supabase.from('rides').insert({
      hospital_id: hospitalId,
      patient_name: form.patient_name,
      patient_phone: form.patient_phone,
      patient_age: Number(form.patient_age),
      patient_gender: form.patient_gender,
      chief_complaint: form.chief_complaint,
      pickup_location: form.pickup_location,
      pickup_lat: pickupCoords?.lat ?? null,
      pickup_lng: pickupCoords?.lng ?? null,
      pickup_place_id: pickupCoords?.place_id ?? null,
      destination: form.destination,
      destination_lat: destCoords?.lat ?? null,
      destination_lng: destCoords?.lng ?? null,
      destination_place_id: destCoords?.place_id ?? null,
      urgency: form.urgency,
      ambulance_id: form.ambulance_id,
      driver_name: selectedAmb?.driver_name || '',
      status: 'dispatched',
      amount,
      response_time_minutes: null,
    }).select('id, tracking_token').single()

    if (selectedAmb) {
      await supabase.from('ambulances').update({ status: 'on_trip' }).eq('id', form.ambulance_id)

      // Send Expo push notification to driver
      const pushToken = (selectedAmb as Ambulance & { expo_push_token?: string }).expo_push_token
      if (pushToken) {
        fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: pushToken,
            title: `🚨 New Ride — ${form.urgency.toUpperCase()}`,
            body: `${form.patient_name} · ${form.pickup_location} → ${form.destination}`,
            data: { rideDbId: rideRow?.id ?? '' },
            sound: 'default',
            priority: 'high',
          }),
        }).catch(() => {})
      }

      // Send WhatsApp tracking message to patient's family
      const trackingToken = rideRow?.tracking_token || ''
      const trackingUrl = hospitalSlug && trackingToken
        ? `${window.location.origin}/track/${hospitalSlug}/${trackingToken}`
        : ''
      let whatsappSent = false
      if (trackingUrl && form.patient_phone) {
        try {
          const waRes = await fetch('/api/whatsapp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              phone: form.patient_phone,
              patientName: form.patient_name,
              hospitalName: hospitalName,
              driverName: selectedAmb.driver_name,
              trackingUrl,
            }),
          })
          const waData = await waRes.json()
          whatsappSent = waData.ok === true
          if (whatsappSent) {
            await supabase.from('rides').update({ whatsapp_sent: true }).eq('id', rideRow?.id)
          }
        } catch { /* WhatsApp failure is non-fatal */ }
      }

      setDispatched({
        driverName: selectedAmb.driver_name, vehicleCode: selectedAmb.code, eta,
        trackingToken, patientPhone: form.patient_phone, whatsappSent,
      })
      setForm({ patient_name: '', patient_phone: '', patient_age: '', patient_gender: '', pickup_location: '', destination: '', chief_complaint: '', urgency: 'Urgent', ambulance_id: '' })
      setPickupCoords(null)
      setDestCoords(null)
      setBestMatch(null)
      await loadAmbs(supabase)
      toast.success('Ambulance dispatched successfully!')
    }
    setLoading(false)
  }

  const selectedAmb = ambulances.find(a => a.id === form.ambulance_id)

  const inputCls = (err?: string) =>
    `w-full px-4 py-3 border rounded-xl text-sm text-ambu-dark placeholder:text-ambu-muted/50 focus:outline-none focus:ring-2 focus:ring-ambu-red focus:border-transparent transition ${
      err ? 'border-red-300 bg-red-50' : 'border-ambu-border bg-white'
    }`

  return (
    <div className="p-5 lg:p-7 max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-ambu-dark flex items-center gap-2">
          <PlusCircle className="w-6 h-6 text-ambu-red" />
          Book Ambulance
        </h1>
        <p className="text-sm text-ambu-muted mt-1">Dispatch an ambulance for a patient</p>
      </div>

      <form onSubmit={handleReview} className="space-y-5">
        {/* Patient Information */}
        <div className="bg-white rounded-2xl border border-ambu-border shadow-sm p-6 space-y-4">
          <h2 className="font-semibold text-ambu-dark flex items-center gap-2 text-sm uppercase tracking-wide">
            <User className="w-4 h-4 text-ambu-red" /> Patient Information
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-ambu-dark mb-1.5">Patient Name</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ambu-muted" />
                <input
                  type="text" value={form.patient_name}
                  onChange={e => f('patient_name', e.target.value)}
                  placeholder="Full name"
                  className={`${inputCls(errors.patient_name)} pl-9`}
                />
              </div>
              {errors.patient_name && <p className="text-ambu-red text-xs mt-1">{errors.patient_name}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-ambu-dark mb-1.5">Phone Number</label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ambu-muted" />
                <input
                  type="tel" value={form.patient_phone}
                  onChange={e => f('patient_phone', e.target.value)}
                  placeholder="10-digit number"
                  className={`${inputCls(errors.patient_phone)} pl-9`}
                />
              </div>
              {errors.patient_phone && <p className="text-ambu-red text-xs mt-1">{errors.patient_phone}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-ambu-dark mb-1.5">Patient Age</label>
              <input
                type="number" min={0} max={120} value={form.patient_age}
                onChange={e => f('patient_age', e.target.value)}
                placeholder="Age in years"
                className={inputCls(errors.patient_age)}
              />
              {errors.patient_age && <p className="text-ambu-red text-xs mt-1">{errors.patient_age}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-ambu-dark mb-1.5">Patient Gender</label>
              <select
                value={form.patient_gender}
                onChange={e => f('patient_gender', e.target.value)}
                className={inputCls(errors.patient_gender)}
              >
                <option value="">Select gender</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
              {errors.patient_gender && <p className="text-ambu-red text-xs mt-1">{errors.patient_gender}</p>}
            </div>
          </div>
        </div>

        {/* Trip Details */}
        <div className="bg-white rounded-2xl border border-ambu-border shadow-sm p-6 space-y-4">
          <h2 className="font-semibold text-ambu-dark flex items-center gap-2 text-sm uppercase tracking-wide">
            <Navigation className="w-4 h-4 text-ambu-red" /> Trip Details
          </h2>
          <div>
            <label className="block text-sm font-medium text-ambu-dark mb-1.5">Pickup Location</label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ambu-muted" />
              <input
                ref={pickupRef}
                type="text" value={form.pickup_location}
                onChange={e => f('pickup_location', e.target.value)}
                placeholder="e.g. Sector 15, Rohini, Delhi"
                autoComplete="off"
                className={`${inputCls(errors.pickup_location)} pl-9`}
              />
            </div>
            {errors.pickup_location && <p className="text-ambu-red text-xs mt-1">{errors.pickup_location}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-ambu-dark mb-1.5">Destination</label>
            <div className="relative">
              <Navigation className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ambu-muted" />
              <input
                ref={destRef}
                type="text" value={form.destination}
                onChange={e => f('destination', e.target.value)}
                placeholder="e.g. Ujala Cygnus Hospital"
                autoComplete="off"
                className={`${inputCls(errors.destination)} pl-9`}
              />
            </div>
            {errors.destination && <p className="text-ambu-red text-xs mt-1">{errors.destination}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-ambu-dark mb-1.5">Chief Complaint</label>
            <textarea
              rows={2}
              value={form.chief_complaint}
              onChange={e => f('chief_complaint', e.target.value)}
              placeholder="e.g. Chest pain, shortness of breath since 2 hours"
              className={`${inputCls(errors.chief_complaint)} resize-none`}
            />
            {errors.chief_complaint && <p className="text-ambu-red text-xs mt-1">{errors.chief_complaint}</p>}
          </div>
        </div>

        {/* Urgency */}
        <div className="bg-white rounded-2xl border border-ambu-border shadow-sm p-6">
          <h2 className="font-semibold text-ambu-dark flex items-center gap-2 text-sm uppercase tracking-wide mb-4">
            <Zap className="w-4 h-4 text-ambu-red" /> Urgency Level
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {URGENCY_OPTIONS.map(u => (
              <button
                type="button"
                key={u.key}
                onClick={() => f('urgency', u.key)}
                className={`p-4 rounded-xl border-2 text-left transition-all ${
                  form.urgency === u.key
                    ? `${u.border} ${u.bg}`
                    : 'border-ambu-border hover:border-ambu-muted/40 bg-white'
                }`}
              >
                <div className={`w-8 h-8 rounded-lg ${form.urgency === u.key ? u.iconBg : 'bg-ambu-bg'} flex items-center justify-center mb-2.5 ${form.urgency === u.key ? u.text : 'text-ambu-muted'}`}>
                  {u.icon}
                </div>
                <p className={`font-bold text-sm ${form.urgency === u.key ? u.text : 'text-ambu-dark'}`}>{u.key}</p>
                <p className="text-xs mt-1 text-ambu-muted">{u.desc}</p>
                <p className="text-xs mt-2 font-semibold text-ambu-muted">ETA ~{u.eta} min · ₹{u.price.toLocaleString('en-IN')}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Ambulance Selection */}
        <div className="bg-white rounded-2xl border border-ambu-border shadow-sm p-6">
          <h2 className="font-semibold text-ambu-dark text-sm uppercase tracking-wide mb-4">Select Ambulance</h2>
          {errors.ambulance_id && <p className="text-ambu-red text-xs mb-3">{errors.ambulance_id}</p>}

          {/* Smart Match card */}
          {matchLoading && (
            <div className="mb-4 flex items-center gap-2 text-xs text-ambu-muted bg-ambu-bg rounded-xl px-4 py-3">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Finding best match…
            </div>
          )}
          {!matchLoading && bestMatch && (
            <div className="mb-4 rounded-xl border-2 border-ambu-red bg-red-50 p-4">
              <div className="flex items-center gap-1.5 mb-3">
                <Sparkles className="w-4 h-4 text-ambu-red" />
                <span className="text-xs font-bold text-ambu-red uppercase tracking-wide">Recommended Ambulance</span>
              </div>
              <div className="flex items-start justify-between gap-2 mb-1">
                <div>
                  <p className="font-bold text-sm text-ambu-dark">{bestMatch.code} · {bestMatch.is_hospital_fleet ? 'Hospital Fleet' : `AmbuQuick ${bestMatch.type}`}</p>
                  <p className="text-xs text-ambu-muted mt-0.5">Driver: {bestMatch.driver_name}</p>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-lg font-black text-ambu-red">{bestMatch.matchScore}</span>
                  <span className="text-xs text-ambu-muted">/100</span>
                </div>
              </div>
              <div className="flex gap-3 text-xs text-ambu-muted mb-3">
                <span>⏱ {bestMatch.driveTimeMinutes} min away</span>
                {bestMatch.distanceKm !== '—' && <span>📍 {bestMatch.distanceKm} km</span>}
              </div>
              <div className="space-y-1.5">
                {([
                  { label: 'Proximity', value: bestMatch.scoreBreakdown.proximity },
                  { label: 'Type Match', value: bestMatch.scoreBreakdown.type },
                  { label: 'Rating', value: bestMatch.scoreBreakdown.rating },
                  { label: 'Fatigue', value: bestMatch.scoreBreakdown.fatigue },
                ] as const).map(({ label, value }) => (
                  <div key={label} className="flex items-center gap-2">
                    <span className="text-xs text-ambu-muted w-20 shrink-0">{label}</span>
                    <div className="flex-1 h-1.5 bg-red-100 rounded-full overflow-hidden">
                      <div className="h-full bg-ambu-red rounded-full" style={{ width: `${value}%` }} />
                    </div>
                    <span className="text-xs font-semibold text-ambu-dark w-7 text-right">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {ambLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)}
            </div>
          ) : ambulances.length === 0 ? (
            <div className="text-center py-8 bg-ambu-bg rounded-xl">
              <p className="text-sm text-ambu-muted">No available ambulances at the moment.</p>
              <p className="text-xs text-ambu-muted/60 mt-1">All units are currently on trips or in maintenance.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {ambulances.map(amb => (
                <button
                  type="button"
                  key={amb.id}
                  onClick={() => f('ambulance_id', amb.id)}
                  className={`p-4 rounded-xl border-2 text-left transition-all ${
                    form.ambulance_id === amb.id
                      ? 'border-ambu-red bg-red-50'
                      : 'border-ambu-border hover:border-ambu-muted/40'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <p className="font-bold text-sm text-ambu-dark">{amb.code}</p>
                    <span className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full font-medium">
                      Available
                    </span>
                  </div>
                  <p className="text-xs text-ambu-muted mt-1">
                    {amb.is_hospital_fleet ? 'Hospital Fleet' : `AmbuQuick ${amb.type}`}
                  </p>
                  <p className="text-xs text-ambu-muted/70 mt-0.5">Driver: {amb.driver_name}</p>
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          type="submit"
          disabled={loading || ambulances.length === 0}
          className="w-full bg-ambu-red hover:bg-ambu-red-dark text-white font-bold py-4 rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed shadow-sm text-sm"
        >
          {loading
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Dispatching…</>
            : 'Review Booking →'}
        </button>
      </form>

      {/* Confirmation Modal */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full relative">
            <button onClick={() => setShowConfirm(false)} className="absolute top-4 right-4 text-ambu-muted hover:text-ambu-dark">
              <X className="w-5 h-5" />
            </button>
            <h2 className="text-lg font-bold text-ambu-dark mb-1">Confirm Booking</h2>
            <p className="text-sm text-ambu-muted mb-5">Review details before dispatching</p>
            <div className="space-y-2.5 bg-ambu-bg rounded-xl p-4 mb-5">
              {[
                { label: 'Patient', value: form.patient_name },
                { label: 'Phone', value: form.patient_phone },
                { label: 'Age / Gender', value: `${form.patient_age} yrs · ${form.patient_gender}` },
                { label: 'Chief Complaint', value: form.chief_complaint },
                { label: 'Pickup', value: form.pickup_location },
                { label: 'Destination', value: form.destination },
                { label: 'Urgency', value: form.urgency },
                { label: 'Ambulance', value: selectedAmb ? `${selectedAmb.code} — ${selectedAmb.driver_name}` : '—' },
                { label: 'ETA', value: `~${urgencyConfig.eta} minutes` },
                { label: 'Est. Cost', value: `₹${urgencyConfig.price.toLocaleString('en-IN')}` },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between text-sm">
                  <span className="text-ambu-muted">{label}</span>
                  <span className="font-medium text-ambu-dark text-right max-w-[180px]">{value}</span>
                </div>
              ))}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 py-2.5 border border-ambu-border rounded-xl text-sm font-medium text-ambu-muted hover:bg-ambu-bg transition"
              >
                Go Back
              </button>
              <button
                onClick={handleConfirmDispatch}
                className="flex-1 bg-ambu-red text-white py-2.5 rounded-xl font-bold text-sm hover:bg-ambu-red-dark transition"
              >
                Confirm Dispatch
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success Modal */}
      {dispatched && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full relative">
            <button onClick={() => setDispatched(null)} className="absolute top-4 right-4 text-ambu-muted hover:text-ambu-dark">
              <X className="w-5 h-5" />
            </button>
            <div className="text-center mb-5">
              <div className="w-14 h-14 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 className="w-7 h-7 text-emerald-600" />
              </div>
              <h2 className="text-xl font-bold text-ambu-dark">Ambulance Dispatched!</h2>
              <p className="text-sm text-ambu-muted mt-1">Your request is confirmed</p>
            </div>

            <div className="space-y-2.5 bg-ambu-bg rounded-xl p-4 mb-4">
              <div className="flex justify-between text-sm">
                <span className="text-ambu-muted">Driver</span>
                <span className="font-bold text-ambu-dark">{dispatched.driverName}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-ambu-muted">Vehicle</span>
                <span className="font-bold text-ambu-dark">{dispatched.vehicleCode}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-ambu-muted">ETA</span>
                <span className="font-bold text-ambu-red">{dispatched.eta} minutes</span>
              </div>
            </div>

            {/* WhatsApp status + tracking link */}
            {dispatched.trackingToken && hospitalSlug && (
              <div className="mb-4 space-y-2">
                {dispatched.whatsappSent ? (
                  <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-3 py-2.5">
                    <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                    <p className="text-xs text-green-700 font-medium">
                      WhatsApp tracking link sent to {dispatched.patientPhone.slice(0, 3)}•••{dispatched.patientPhone.slice(-4)}
                    </p>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
                    <span className="text-amber-500 text-sm">⚠</span>
                    <p className="text-xs text-amber-700">WhatsApp not sent — share the link manually</p>
                  </div>
                )}
                <button
                  onClick={() => {
                    const url = `${window.location.origin}/track/${hospitalSlug}/${dispatched.trackingToken}`
                    navigator.clipboard.writeText(url).catch(() => {})
                    toast.success('Tracking link copied!')
                  }}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-ambu-border text-sm font-medium text-ambu-dark hover:bg-ambu-bg transition"
                >
                  🔗 Copy Tracking Link
                </button>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setDispatched(null)}
                className="flex-1 py-2.5 border border-ambu-border rounded-xl text-sm font-medium text-ambu-muted hover:bg-ambu-bg transition"
              >
                Close
              </button>
              <button
                onClick={() => { setDispatched(null); router.push('/tracking') }}
                className="flex-1 bg-ambu-red text-white py-2.5 rounded-xl font-bold text-sm hover:bg-ambu-red-dark transition"
              >
                Track Live
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
