'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Ambulance } from '@/types'
import { toast } from 'sonner'
import { Loader2, User, Phone, MapPin, Navigation, Zap, Clock, Calendar, CheckCircle2, X, PlusCircle } from 'lucide-react'
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
  const [hospitalId, setHospitalId] = useState('')
  const [ambulances, setAmbulances] = useState<Ambulance[]>([])
  const [ambLoading, setAmbLoading] = useState(true)
  const [loading, setLoading] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [dispatched, setDispatched] = useState<{ driverName: string; vehicleCode: string; eta: number } | null>(null)
  const [form, setForm] = useState({
    patient_name: '', patient_phone: '', pickup_location: '',
    destination: '', urgency: 'Urgent' as Urgency, ambulance_id: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  const urgencyConfig = URGENCY_OPTIONS.find(u => u.key === form.urgency)!

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
      if (profile?.hospital_id) setHospitalId(profile.hospital_id)
      await loadAmbs(supabase)
    }
    init()
  }, [])

  const f = (field: keyof typeof form, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }))
    if (errors[field]) setErrors(prev => { const n = { ...prev }; delete n[field]; return n })
  }

  const validate = () => {
    const e: Record<string, string> = {}
    if (!form.patient_name.trim()) e.patient_name = 'Patient name is required'
    if (!form.patient_phone.trim()) e.patient_phone = 'Phone number is required'
    if (!/^[0-9]{10}$/.test(form.patient_phone.replace(/\s/g, ''))) e.patient_phone = 'Enter a valid 10-digit phone number'
    if (!form.pickup_location.trim()) e.pickup_location = 'Pickup location is required'
    if (!form.destination.trim()) e.destination = 'Destination is required'
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

    await supabase.from('rides').insert({
      hospital_id: hospitalId,
      patient_name: form.patient_name,
      patient_phone: form.patient_phone,
      pickup_location: form.pickup_location,
      destination: form.destination,
      urgency: form.urgency,
      ambulance_id: form.ambulance_id,
      driver_name: selectedAmb?.driver_name || '',
      status: 'dispatched',
      amount,
      response_time_minutes: null,
    })

    if (selectedAmb) {
      await supabase.from('ambulances').update({ status: 'on_trip' }).eq('id', form.ambulance_id)
      setDispatched({ driverName: selectedAmb.driver_name, vehicleCode: selectedAmb.code, eta })
      setForm({ patient_name: '', patient_phone: '', pickup_location: '', destination: '', urgency: 'Urgent', ambulance_id: '' })
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
                type="text" value={form.pickup_location}
                onChange={e => f('pickup_location', e.target.value)}
                placeholder="e.g. Sector 15, Rohini, Delhi"
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
                type="text" value={form.destination}
                onChange={e => f('destination', e.target.value)}
                placeholder="e.g. Ujala Cygnus Hospital"
                className={`${inputCls(errors.destination)} pl-9`}
              />
            </div>
            {errors.destination && <p className="text-ambu-red text-xs mt-1">{errors.destination}</p>}
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
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full relative">
            <button onClick={() => setDispatched(null)} className="absolute top-4 right-4 text-ambu-muted hover:text-ambu-dark">
              <X className="w-5 h-5" />
            </button>
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-8 h-8 text-emerald-600" />
              </div>
              <h2 className="text-xl font-bold text-ambu-dark">Ambulance Dispatched!</h2>
              <p className="text-sm text-ambu-muted mt-1">Your request is confirmed</p>
            </div>
            <div className="space-y-3 bg-ambu-bg rounded-xl p-4">
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
            <div className="flex gap-3 mt-5">
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
