'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Ambulance } from '@/types'
import { Loader2, User, Phone, MapPin, Navigation, AlertTriangle, CheckCircle2, X, PlusCircle } from 'lucide-react'

const URGENCY_OPTIONS = ['Critical', 'Urgent', 'Scheduled'] as const
type Urgency = typeof URGENCY_OPTIONS[number]

export default function BookAmbulancePage() {
  const [hospitalId, setHospitalId] = useState('')
  const [ambulances, setAmbulances] = useState<Ambulance[]>([])
  const [loading, setLoading] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [dispatched, setDispatched] = useState<{ driverName: string; vehicleCode: string; eta: number } | null>(null)
  const [form, setForm] = useState({ patient_name: '', patient_phone: '', pickup_location: '', destination: '', urgency: 'Urgent' as Urgency, ambulance_id: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})

  const loadAvailableAmbs = async (supabase: ReturnType<typeof createClient>) => {
    const { data } = await supabase.from('ambulances').select('*').eq('status', 'available')
    setAmbulances((data as Ambulance[]) || [])
  }

  useEffect(() => {
    const supabase = createClient()
    async function init() {
      const { data: profile } = await supabase.from('user_profiles').select('hospital_id').single()
      if (profile?.hospital_id) setHospitalId(profile.hospital_id)
      await loadAvailableAmbs(supabase)
    }
    init()
  }, [])

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
    const eta = form.urgency === 'Critical' ? 8 : form.urgency === 'Urgent' ? 15 : 25
    const amount = form.urgency === 'Critical' ? 2500 : selectedAmb?.type === 'ALS' ? 2000 : 1200

    await supabase.from('rides').insert({
      hospital_id: hospitalId, patient_name: form.patient_name, patient_phone: form.patient_phone,
      pickup_location: form.pickup_location, destination: form.destination, urgency: form.urgency,
      ambulance_id: form.ambulance_id, driver_name: selectedAmb?.driver_name || '',
      status: 'dispatched', amount, response_time_minutes: null,
    })

    if (selectedAmb) {
      await supabase.from('ambulances').update({ status: 'on_trip' }).eq('id', form.ambulance_id)
      setDispatched({ driverName: selectedAmb.driver_name, vehicleCode: selectedAmb.code, eta })
      setForm({ patient_name: '', patient_phone: '', pickup_location: '', destination: '', urgency: 'Urgent', ambulance_id: '' })
      await loadAvailableAmbs(supabase)
    }
    setLoading(false)
  }

  const f = (field: keyof typeof form, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }))
    if (errors[field]) setErrors(prev => { const n = { ...prev }; delete n[field]; return n })
  }

  const selectedAmb = ambulances.find(a => a.id === form.ambulance_id)
  const eta = form.urgency === 'Critical' ? 8 : form.urgency === 'Urgent' ? 15 : 25
  const amount = form.urgency === 'Critical' ? 2500 : selectedAmb?.type === 'ALS' ? 2000 : 1200

  const urgencyConfig: Record<Urgency, { color: string; desc: string }> = {
    Critical: { color: 'border-red-500 bg-red-50 text-red-700', desc: 'Life-threatening, immediate dispatch' },
    Urgent: { color: 'border-orange-500 bg-orange-50 text-orange-700', desc: 'Needs ambulance within 30 min' },
    Scheduled: { color: 'border-green-500 bg-green-50 text-green-700', desc: 'Pre-planned non-emergency trip' },
  }

  return (
    <div className="p-6 lg:p-8 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><PlusCircle className="w-6 h-6 text-ambu-red" /> Book Ambulance</h1>
        <p className="text-sm text-gray-500 mt-0.5">Dispatch an ambulance for a patient</p>
      </div>

      <form onSubmit={handleReview} className="space-y-6">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2 mb-4"><User className="w-4 h-4 text-ambu-red" /> Patient Information</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Patient Name" icon={<User className="w-4 h-4" />} error={errors.patient_name}>
              <input type="text" value={form.patient_name} onChange={e => f('patient_name', e.target.value)} placeholder="Full name" className={input(errors.patient_name)} />
            </Field>
            <Field label="Phone Number" icon={<Phone className="w-4 h-4" />} error={errors.patient_phone}>
              <input type="tel" value={form.patient_phone} onChange={e => f('patient_phone', e.target.value)} placeholder="10-digit mobile number" className={input(errors.patient_phone)} />
            </Field>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2 mb-4"><Navigation className="w-4 h-4 text-ambu-red" /> Trip Details</h2>
          <Field label="Pickup Location" icon={<MapPin className="w-4 h-4" />} error={errors.pickup_location}>
            <input type="text" value={form.pickup_location} onChange={e => f('pickup_location', e.target.value)} placeholder="e.g. Sector 15, Rohini, Delhi" className={input(errors.pickup_location)} />
          </Field>
          <Field label="Destination" icon={<Navigation className="w-4 h-4" />} error={errors.destination}>
            <input type="text" value={form.destination} onChange={e => f('destination', e.target.value)} placeholder="e.g. Ujala Cygnus Hospital" className={input(errors.destination)} />
          </Field>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2 mb-4"><AlertTriangle className="w-4 h-4 text-ambu-red" /> Urgency Level</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {URGENCY_OPTIONS.map(u => (
              <button type="button" key={u} onClick={() => f('urgency', u)}
                className={`p-4 rounded-xl border-2 text-left transition-all ${form.urgency === u ? urgencyConfig[u].color : 'border-gray-200 hover:border-gray-300 bg-white'}`}>
                <p className="font-semibold text-sm">{u}</p>
                <p className="text-xs mt-1 opacity-70">{urgencyConfig[u].desc}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Select Ambulance</h2>
          {errors.ambulance_id && <p className="text-red-500 text-xs mb-3">{errors.ambulance_id}</p>}
          {ambulances.length === 0 ? (
            <div className="text-center py-6 text-gray-400">
              <p className="text-sm">No available ambulances at the moment.</p>
              <p className="text-xs mt-1">All units are currently on trips or in maintenance.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {ambulances.map(amb => (
                <button type="button" key={amb.id} onClick={() => f('ambulance_id', amb.id)}
                  className={`p-4 rounded-xl border-2 text-left transition-all ${form.ambulance_id === amb.id ? 'border-ambu-red bg-red-50' : 'border-gray-200 hover:border-gray-300'}`}>
                  <div className="flex items-center justify-between">
                    <p className="font-bold text-sm text-gray-900">{amb.code}</p>
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Available</span>
                  </div>
                  <p className="text-xs text-gray-600 mt-1">{amb.is_hospital_fleet ? 'Hospital Fleet' : `AmbuQuick ${amb.type}`}</p>
                  <p className="text-xs text-gray-400 mt-0.5">Driver: {amb.driver_name}</p>
                </button>
              ))}
            </div>
          )}
        </div>

        <button type="submit" disabled={loading || ambulances.length === 0}
          className="w-full bg-ambu-red hover:bg-ambu-red-dark text-white font-semibold py-4 rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed shadow-sm text-sm">
          {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Dispatching…</> : 'Review Booking →'}
        </button>
      </form>

      {/* Pre-dispatch Confirmation Modal */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full relative">
            <button onClick={() => setShowConfirm(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            <h2 className="text-lg font-bold text-gray-900 mb-1">Confirm Booking</h2>
            <p className="text-sm text-gray-500 mb-5">Review details before dispatching</p>
            <div className="space-y-2.5 bg-gray-50 rounded-xl p-4 mb-5">
              {[
                { label: 'Patient', value: form.patient_name },
                { label: 'Phone', value: form.patient_phone },
                { label: 'Pickup', value: form.pickup_location },
                { label: 'Destination', value: form.destination },
                { label: 'Urgency', value: form.urgency },
                { label: 'Ambulance', value: selectedAmb ? `${selectedAmb.code} — ${selectedAmb.driver_name}` : '—' },
                { label: 'ETA', value: `~${eta} minutes` },
                { label: 'Est. Cost', value: `₹${amount.toLocaleString('en-IN')}` },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between text-sm">
                  <span className="text-gray-500">{label}</span>
                  <span className="font-medium text-gray-900 text-right max-w-[180px]">{value}</span>
                </div>
              ))}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowConfirm(false)} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50">Go Back</button>
              <button onClick={handleConfirmDispatch} className="flex-1 bg-ambu-red text-white py-2.5 rounded-xl font-semibold text-sm hover:bg-ambu-red-dark transition-colors">
                Confirm Dispatch
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Post-dispatch Success Modal */}
      {dispatched && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full relative">
            <button onClick={() => setDispatched(null)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4"><CheckCircle2 className="w-8 h-8 text-green-600" /></div>
              <h2 className="text-xl font-bold text-gray-900">Ambulance Dispatched!</h2>
              <p className="text-sm text-gray-500 mt-1">Your request is confirmed</p>
            </div>
            <div className="space-y-3 bg-gray-50 rounded-xl p-4">
              <div className="flex justify-between text-sm"><span className="text-gray-500">Driver</span><span className="font-semibold text-gray-900">{dispatched.driverName}</span></div>
              <div className="flex justify-between text-sm"><span className="text-gray-500">Vehicle</span><span className="font-semibold text-gray-900">{dispatched.vehicleCode}</span></div>
              <div className="flex justify-between text-sm"><span className="text-gray-500">ETA</span><span className="font-semibold text-ambu-red">{dispatched.eta} minutes</span></div>
            </div>
            <button onClick={() => setDispatched(null)} className="w-full mt-5 bg-ambu-red text-white py-2.5 rounded-xl font-semibold text-sm hover:bg-ambu-red-dark transition-colors">Done</button>
          </div>
        </div>
      )}
    </div>
  )
}

function input(error?: string) {
  return `w-full px-4 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 transition ${error ? 'border-red-300 focus:ring-red-200' : 'border-gray-200 focus:ring-ambu-red focus:border-transparent'}`
}

function Field({ label, icon, error, children }: { label: string; icon?: React.ReactNode; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
      <div className="relative">
        {icon && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">{icon}</span>}
        <div className={icon ? '[&>input]:pl-9 [&>select]:pl-9 [&>textarea]:pl-9' : ''}>{children}</div>
      </div>
      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
    </div>
  )
}
