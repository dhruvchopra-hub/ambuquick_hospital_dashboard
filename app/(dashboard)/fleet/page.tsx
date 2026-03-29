'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Ambulance } from '@/types'
import { toast } from 'sonner'
import { Truck, Plus, Edit2, Loader2, X, CheckCircle, Shield, Building2, Link2, KeyRound, Calendar, Wrench, BarChart2, Star, Award } from 'lucide-react'
import { format, differenceInDays, parseISO } from 'date-fns'

const STATUSES = ['available', 'on_trip', 'maintenance', 'offline'] as const
type Status = typeof STATUSES[number]

interface DriverScore {
  overall: number
  onTime: number
  rating: number
  safety: number
  flags: string[]
  trend: number[] // last 6 months scores
  recentRides: { id: string; date: string; onTime: boolean; rating: number; notes?: string }[]
}

const DRIVER_SCORES: Record<string, DriverScore> = {
  'Rajesh Kumar': {
    overall: 87, onTime: 91, rating: 4.6, safety: 88,
    flags: [],
    trend: [79, 82, 84, 83, 86, 87],
    recentRides: [
      { id: 'A1B2C3D4', date: '25 Mar', onTime: true,  rating: 5, notes: '' },
      { id: 'E5F6G7H8', date: '23 Mar', onTime: true,  rating: 5 },
      { id: 'I9J0K1L2', date: '21 Mar', onTime: false, rating: 4, notes: 'Traffic delay — NH-48' },
      { id: 'M3N4O5P6', date: '20 Mar', onTime: true,  rating: 5 },
      { id: 'Q7R8S9T0', date: '18 Mar', onTime: true,  rating: 4 },
      { id: 'U1V2W3X4', date: '15 Mar', onTime: true,  rating: 5 },
      { id: 'Y5Z6A7B8', date: '13 Mar', onTime: true,  rating: 5 },
      { id: 'C9D0E1F2', date: '11 Mar', onTime: true,  rating: 4 },
      { id: 'G3H4I5J6', date: '09 Mar', onTime: true,  rating: 5 },
      { id: 'K7L8M9N0', date: '07 Mar', onTime: false, rating: 4, notes: 'Road closed — Rohini bypass' },
    ],
  },
  'Sunil Sharma': {
    overall: 74, onTime: 78, rating: 4.1, safety: 75,
    flags: ['2 late arrivals this week'],
    trend: [71, 72, 76, 74, 75, 74],
    recentRides: [
      { id: 'P1Q2R3S4', date: '25 Mar', onTime: false, rating: 3, notes: 'Late — 22 min response' },
      { id: 'T5U6V7W8', date: '24 Mar', onTime: false, rating: 4, notes: 'Late — traffic Janakpuri' },
      { id: 'X9Y0Z1A2', date: '22 Mar', onTime: true,  rating: 4 },
      { id: 'B3C4D5E6', date: '20 Mar', onTime: true,  rating: 5 },
      { id: 'F7G8H9I0', date: '18 Mar', onTime: true,  rating: 4 },
      { id: 'J1K2L3M4', date: '17 Mar', onTime: false, rating: 3, notes: 'Speed compliance warning' },
      { id: 'N5O6P7Q8', date: '15 Mar', onTime: true,  rating: 4 },
      { id: 'R9S0T1U2', date: '13 Mar', onTime: true,  rating: 5 },
      { id: 'V3W4X5Y6', date: '11 Mar', onTime: true,  rating: 4 },
      { id: 'Z7A8B9C0', date: '09 Mar', onTime: true,  rating: 4 },
    ],
  },
  'Amit Verma': {
    overall: 82, onTime: 85, rating: 4.4, safety: 80,
    flags: [],
    trend: [76, 78, 80, 81, 82, 82],
    recentRides: [
      { id: 'D1E2F3G4', date: '25 Mar', onTime: true,  rating: 5 },
      { id: 'H5I6J7K8', date: '23 Mar', onTime: true,  rating: 4 },
      { id: 'L9M0N1O2', date: '21 Mar', onTime: true,  rating: 5 },
      { id: 'P3Q4R5S6', date: '19 Mar', onTime: false, rating: 4, notes: 'Minor delay — Dwarka flyover' },
      { id: 'T7U8V9W0', date: '17 Mar', onTime: true,  rating: 4 },
      { id: 'X1Y2Z3A4', date: '15 Mar', onTime: true,  rating: 5 },
      { id: 'B5C6D7E8', date: '13 Mar', onTime: true,  rating: 5 },
      { id: 'F9G0H1I2', date: '11 Mar', onTime: true,  rating: 4 },
      { id: 'J3K4L5M6', date: '09 Mar', onTime: true,  rating: 5 },
      { id: 'N7O8P9Q0', date: '07 Mar', onTime: true,  rating: 4 },
    ],
  },
  'Pradeep Singh': {
    overall: 69, onTime: 72, rating: 3.9, safety: 68,
    flags: ['1 SLA breach this month', 'Speed compliance warning'],
    trend: [72, 70, 68, 71, 70, 69],
    recentRides: [
      { id: 'R1S2T3U4', date: '24 Mar', onTime: false, rating: 3, notes: 'SLA breach — 24 min response' },
      { id: 'V5W6X7Y8', date: '22 Mar', onTime: false, rating: 4 },
      { id: 'Z9A0B1C2', date: '20 Mar', onTime: true,  rating: 4 },
      { id: 'D3E4F5G6', date: '18 Mar', onTime: false, rating: 3, notes: 'Speed warning flagged' },
      { id: 'H7I8J9K0', date: '16 Mar', onTime: true,  rating: 4 },
      { id: 'L1M2N3O4', date: '14 Mar', onTime: true,  rating: 4 },
      { id: 'P5Q6R7S8', date: '12 Mar', onTime: false, rating: 3 },
      { id: 'T9U0V1W2', date: '10 Mar', onTime: true,  rating: 5 },
      { id: 'X3Y4Z5A6', date: '08 Mar', onTime: true,  rating: 4 },
      { id: 'B7C8D9E0', date: '06 Mar', onTime: true,  rating: 4 },
    ],
  },
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    available: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    on_trip: 'bg-blue-50 text-blue-700 border-blue-200',
    maintenance: 'bg-amber-50 text-amber-700 border-amber-200',
    offline: 'bg-gray-100 text-gray-500 border-gray-200',
  }
  const label: Record<string, string> = {
    available: 'Available', on_trip: 'On Trip', maintenance: 'Maintenance', offline: 'Offline',
  }
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${styles[status] || 'bg-gray-100 text-gray-500 border-gray-200'}`}>
      {label[status] || status}
    </span>
  )
}

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-ambu-border/60 rounded-lg ${className}`} />
}

interface VehicleModal { open: boolean; mode: 'add' | 'edit'; ambulance: Partial<Ambulance & { driver_pin?: string }> | null }
const emptyForm = { code: '', type: 'BLS', driver_name: '', driver_phone: '', status: 'available' as Status, driver_pin: '0000' }

// Shape returned from driver_scores table
interface LiveDriverScore {
  driver_id:         string
  ambulance_code:    string
  overall_score:     number
  on_time_rate:      number
  patient_rating:    number
  safety_score:      number
  total_trips:       number
}

export default function FleetPage() {
  const [ambulances, setAmbulances] = useState<(Ambulance & { driver_pin?: string; _optimistic?: boolean })[]>([])
  const [hospitalId, setHospitalId] = useState('')
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<VehicleModal>({ open: false, mode: 'add', ambulance: null })
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [tab, setTab] = useState<'ambuquick' | 'hospital'>('ambuquick')
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [perfAmb, setPerfAmb] = useState<(Ambulance & { driver_pin?: string }) | null>(null)
  // Real driver scores loaded from Supabase (keyed by ambulance_code)
  const [liveScores, setLiveScores] = useState<Record<string, LiveDriverScore>>({})

  const copyDriverLink = (amb: Ambulance) => {
    navigator.clipboard.writeText(`${window.location.origin}/driver/${amb.id}`)
    setCopiedId(amb.id)
    setTimeout(() => setCopiedId(null), 2000)
    toast.success('Driver link copied to clipboard')
  }

  const fetchData = async (supabase: ReturnType<typeof createClient>) => {
    const { data } = await supabase.from('ambulances').select('*')
    setAmbulances((data as Ambulance[]) || [])
    setLoading(false)
  }

  const fetchScores = async (supabase: ReturnType<typeof createClient>) => {
    const { data } = await supabase
      .from('driver_scores')
      .select('driver_id, ambulance_code, overall_score, on_time_rate, patient_rating, safety_score, total_trips')
    if (data) {
      const map: Record<string, LiveDriverScore> = {}
      for (const row of data as LiveDriverScore[]) {
        if (row.ambulance_code) map[row.ambulance_code] = row
      }
      setLiveScores(map)
    }
  }

  useEffect(() => {
    const supabase = createClient()
    async function init() {
      const { data: profile } = await supabase.from('user_profiles').select('hospital_id').single()
      if (profile?.hospital_id) setHospitalId(profile.hospital_id)
      await Promise.all([fetchData(supabase), fetchScores(supabase)])

      // Subscribe to driver_scores changes
      const channel = supabase
        .channel('driver-scores-updates')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'driver_scores' }, () => {
          fetchScores(supabase)
        })
        .subscribe()
      return () => { supabase.removeChannel(channel) }
    }
    init()
  }, [])

  const openAdd = () => { setForm(emptyForm); setModal({ open: true, mode: 'add', ambulance: null }) }
  const openEdit = (amb: Ambulance & { driver_pin?: string }) => {
    setForm({ code: amb.code, type: amb.type, driver_name: amb.driver_name, driver_phone: amb.driver_phone, status: amb.status as Status, driver_pin: amb.driver_pin || '0000' })
    setModal({ open: true, mode: 'edit', ambulance: amb })
  }
  const closeModal = () => setModal({ open: false, mode: 'add', ambulance: null })

  const handleSave = async () => {
    if (!form.code || !form.driver_name) return
    if (!hospitalId) { toast.error('Hospital not linked. Please refresh.'); return }

    setSaving(true)
    const supabase = createClient()
    const TEMP_ID = `temp-${Date.now()}`

    if (modal.mode === 'add') {
      const optimistic = { id: TEMP_ID, ...form, hospital_id: hospitalId, is_hospital_fleet: true, lat: 28.6139, lng: 77.2090, created_at: new Date().toISOString(), _optimistic: true }
      setAmbulances(prev => [...prev, optimistic as Ambulance & { _optimistic: boolean }])
      closeModal(); setTab('hospital')

      const { error } = await supabase.from('ambulances').insert({ ...form, hospital_id: hospitalId, is_hospital_fleet: true, lat: 28.6139, lng: 77.2090 })
      if (error) {
        setAmbulances(prev => prev.filter(a => a.id !== TEMP_ID))
        toast.error('Failed to save: ' + error.message)
      } else {
        await fetchData(supabase)
        toast.success('Vehicle added successfully!')
      }
    } else if (modal.ambulance?.id) {
      const originalAmbs = [...ambulances]
      setAmbulances(prev => prev.map(a => a.id === modal.ambulance?.id ? { ...a, ...form } : a))
      closeModal()

      const { error } = await supabase.from('ambulances').update(form).eq('id', modal.ambulance.id)
      if (error) {
        setAmbulances(originalAmbs)
        toast.error('Failed to update: ' + error.message)
      } else {
        toast.success('Vehicle updated!')
      }
    }
    setSaving(false)
  }

  const ambuquickFleet = ambulances.filter(a => !a.is_hospital_fleet)
  const hospitalFleet = ambulances.filter(a => a.is_hospital_fleet)

  function Sparkline({ data }: { data: number[] }) {
    const min = Math.min(...data)
    const max = Math.max(...data)
    const range = max - min || 1
    const w = 80, h = 28, pad = 3
    const pts = data.map((v, i) => {
      const x = pad + (i / (data.length - 1)) * (w - pad * 2)
      const y = h - pad - ((v - min) / range) * (h - pad * 2)
      return `${x},${y}`
    }).join(' ')
    const last = data[data.length - 1]
    const trend = last >= data[0]
    return (
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="overflow-visible">
        <polyline points={pts} fill="none" stroke={trend ? '#16a34a' : '#dc2626'} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }

  const VehicleCard = ({ amb, editable }: { amb: Ambulance & { driver_pin?: string; _optimistic?: boolean }; editable: boolean }) => (
    <div className={`bg-white rounded-2xl border shadow-sm p-5 transition-opacity ${
      amb._optimistic ? 'opacity-60 border-dashed border-ambu-border' : 'border-ambu-border'
    }`}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-base font-bold text-ambu-dark">{amb.code}</p>
          <p className="text-xs text-ambu-muted mt-0.5">
            {amb.is_hospital_fleet ? 'Hospital Fleet' : `AmbuQuick ${amb.type}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={amb.status} />
          {!amb._optimistic && (
            <button
              onClick={() => copyDriverLink(amb)}
              title="Copy driver tracking link"
              className="w-7 h-7 flex items-center justify-center rounded-lg bg-ambu-bg hover:bg-blue-50 text-ambu-muted hover:text-blue-600 border border-ambu-border transition"
            >
              {copiedId === amb.id ? <CheckCircle className="w-3.5 h-3.5 text-emerald-500" /> : <Link2 className="w-3.5 h-3.5" />}
            </button>
          )}
          {editable && !amb._optimistic && (
            <button
              onClick={() => openEdit(amb)}
              className="w-7 h-7 flex items-center justify-center rounded-lg bg-ambu-bg hover:bg-ambu-dark hover:text-white text-ambu-muted border border-ambu-border transition"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
      <div className="border-t border-ambu-border pt-3 space-y-1.5">
        <div className="flex justify-between text-xs">
          <span className="text-ambu-muted">Type</span>
          <span className="text-ambu-dark font-medium">{amb.type === 'hospital_fleet' ? 'General' : amb.type}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-ambu-muted">Driver</span>
          <span className="text-ambu-dark font-medium">{amb.driver_name}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-ambu-muted">Phone</span>
          <span className="text-ambu-dark">{amb.driver_phone || '—'}</span>
        </div>
        {amb.driver_pin && (
          <div className="flex justify-between text-xs">
            <span className="text-ambu-muted flex items-center gap-1"><KeyRound className="w-3 h-3" /> PIN</span>
            <span className="font-mono text-ambu-dark">{amb.driver_pin}</span>
          </div>
        )}
        {amb.reg_number && (
          <div className="flex justify-between text-xs">
            <span className="text-ambu-muted flex items-center gap-1"><Truck className="w-3 h-3" /> Reg No.</span>
            <span className="font-mono text-ambu-dark">{amb.reg_number}</span>
          </div>
        )}
        {amb.last_service_date && (
          <div className="flex justify-between text-xs">
            <span className="text-ambu-muted flex items-center gap-1"><Wrench className="w-3 h-3" /> Last Service</span>
            <span className="text-ambu-dark">{format(parseISO(amb.last_service_date), 'dd MMM yyyy')}</span>
          </div>
        )}
        {amb.next_service_date && (() => {
          const daysLeft = differenceInDays(parseISO(amb.next_service_date), new Date())
          const isDue = daysLeft <= 30
          return (
            <div className="flex justify-between text-xs">
              <span className="text-ambu-muted flex items-center gap-1"><Calendar className="w-3 h-3" /> Next Service</span>
              <span className={isDue ? 'text-amber-600 font-semibold' : 'text-ambu-dark'}>
                {format(parseISO(amb.next_service_date), 'dd MMM yyyy')}
                {isDue && <span className="ml-1 text-amber-600">({daysLeft}d)</span>}
              </span>
            </div>
          )
        })()}
      </div>

      {/* Driver Performance Score */}
      {(() => {
        const live = liveScores[amb.code]
        const base = DRIVER_SCORES[amb.driver_name]
        const score = live ? {
          overall: live.overall_score,
          onTime: live.on_time_rate,
          rating: live.patient_rating,
          safety: live.safety_score,
          flags: base?.flags ?? [],
          trend: base?.trend ?? [live.overall_score],
          recentRides: base?.recentRides ?? [],
        } : base
        if (!score) return null
        const scoreColor = score.overall >= 80 ? 'text-emerald-600 bg-emerald-50 border-emerald-200'
          : score.overall >= 60 ? 'text-amber-600 bg-amber-50 border-amber-200'
          : 'text-red-600 bg-red-50 border-red-200'
        return (
          <div className="border-t border-ambu-border mt-3 pt-3 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-ambu-dark flex items-center gap-1">
                <Award className="w-3.5 h-3.5 text-ambu-red" /> Driver Score
              </span>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${scoreColor}`}>
                {score.overall}/100
              </span>
            </div>
            {[
              { label: 'On-Time Rate', value: score.onTime, suffix: '%' },
              { label: 'Patient Rating', value: Math.round(score.rating * 20), suffix: `${score.rating}★` },
              { label: 'Safety Score', value: score.safety, suffix: `${score.safety}%` },
            ].map(sub => (
              <div key={sub.label}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-ambu-muted">{sub.label}</span>
                  <span className="font-medium text-ambu-dark">{sub.suffix}</span>
                </div>
                <div className="h-1.5 bg-ambu-border rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${
                      sub.value >= 80 ? 'bg-emerald-500' : sub.value >= 60 ? 'bg-amber-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${sub.value}%` }}
                  />
                </div>
              </div>
            ))}
            {score.flags.length > 0 && (
              <div className="space-y-1">
                {score.flags.map(flag => (
                  <p key={flag} className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1">
                    ⚠ {flag}
                  </p>
                ))}
              </div>
            )}
            <button
              onClick={() => setPerfAmb(amb)}
              className="w-full text-xs font-medium text-ambu-red border border-ambu-red/30 bg-red-50/50 hover:bg-red-50 rounded-lg py-1.5 transition flex items-center justify-center gap-1.5"
            >
              <BarChart2 className="w-3.5 h-3.5" /> View Full Report
            </button>
          </div>
        )
      })()}
    </div>
  )

  return (
    <div className="p-5 lg:p-7 space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ambu-dark flex items-center gap-2">
            <Truck className="w-6 h-6 text-ambu-red" /> Fleet Manager
          </h1>
          <p className="text-sm text-ambu-muted mt-0.5">Manage all ambulances assigned to your hospital</p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-1.5 bg-ambu-red text-white text-sm font-bold px-4 py-2.5 rounded-xl hover:bg-ambu-red-dark transition shadow-sm flex-shrink-0"
        >
          <Plus className="w-4 h-4" /> Add Vehicle
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-ambu-border pb-0">
        <button
          onClick={() => setTab('ambuquick')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition border-b-2 -mb-px ${
            tab === 'ambuquick'
              ? 'border-ambu-red text-ambu-red'
              : 'border-transparent text-ambu-muted hover:text-ambu-dark'
          }`}
        >
          <Shield className="w-4 h-4" />
          AmbuQuick Fleet
          <span className="text-xs bg-ambu-bg border border-ambu-border text-ambu-muted px-1.5 py-0.5 rounded-full">
            {ambuquickFleet.length}
          </span>
        </button>
        <button
          onClick={() => setTab('hospital')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition border-b-2 -mb-px ${
            tab === 'hospital'
              ? 'border-ambu-red text-ambu-red'
              : 'border-transparent text-ambu-muted hover:text-ambu-dark'
          }`}
        >
          <Building2 className="w-4 h-4" />
          Your Fleet
          <span className="text-xs bg-ambu-bg border border-ambu-border text-ambu-muted px-1.5 py-0.5 rounded-full">
            {hospitalFleet.length}
          </span>
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-48" />)}
        </div>
      ) : tab === 'ambuquick' ? (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Shield className="w-4 h-4 text-ambu-red" />
            <h2 className="font-semibold text-ambu-dark text-sm">AmbuQuick Assigned Fleet</h2>
            <span className="text-xs bg-ambu-bg border border-ambu-border text-ambu-muted px-2 py-0.5 rounded-full">
              Managed by AmbuQuick · Read-only
            </span>
          </div>
          {ambuquickFleet.length === 0 ? (
            <div className="bg-white rounded-2xl border border-ambu-border p-12 text-center">
              <Truck className="w-8 h-8 text-ambu-border mx-auto mb-2" />
              <p className="text-ambu-muted text-sm">No AmbuQuick vehicles assigned yet</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {ambuquickFleet.map(amb => <VehicleCard key={amb.id} amb={amb} editable={false} />)}
            </div>
          )}
        </div>
      ) : (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Building2 className="w-4 h-4 text-ambu-red" />
            <h2 className="font-semibold text-ambu-dark text-sm">Your Hospital Fleet</h2>
            <span className="text-xs bg-blue-50 border border-blue-200 text-blue-700 px-2 py-0.5 rounded-full">Editable</span>
          </div>
          {hospitalFleet.length === 0 ? (
            <div className="bg-white rounded-2xl border border-ambu-border p-12 text-center">
              <Building2 className="w-8 h-8 text-ambu-border mx-auto mb-2" />
              <p className="text-ambu-muted text-sm mb-3">No hospital vehicles added yet</p>
              <button onClick={openAdd} className="text-ambu-red text-sm font-semibold hover:underline">
                Add your first vehicle →
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {hospitalFleet.map(amb => <VehicleCard key={amb.id} amb={amb} editable={true} />)}
            </div>
          )}
        </div>
      )}

      {/* Modal */}
      {/* Performance Report Modal */}
      {perfAmb && (() => {
        const live = liveScores[perfAmb.code]
        const base = DRIVER_SCORES[perfAmb.driver_name]
        const score = live ? {
          overall: live.overall_score,
          onTime: live.on_time_rate,
          rating: live.patient_rating,
          safety: live.safety_score,
          flags: base?.flags ?? [],
          trend: base?.trend ?? [live.overall_score],
          recentRides: base?.recentRides ?? [],
        } : base
        if (!score) return null
        const scoreColor = score.overall >= 80 ? 'text-emerald-600 bg-emerald-50 border-emerald-200'
          : score.overall >= 60 ? 'text-amber-600 bg-amber-50 border-amber-200'
          : 'text-red-600 bg-red-50 border-red-200'
        return (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg relative max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-white border-b border-ambu-border px-6 py-4 flex items-center justify-between rounded-t-2xl">
                <div>
                  <h2 className="text-lg font-bold text-ambu-dark flex items-center gap-2">
                    <Award className="w-5 h-5 text-ambu-red" /> Driver Performance Report
                  </h2>
                  <p className="text-xs text-ambu-muted mt-0.5">{perfAmb.driver_name} · {perfAmb.code}</p>
                </div>
                <button onClick={() => setPerfAmb(null)} className="text-ambu-muted hover:text-ambu-dark">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-5">
                {/* Overall + Trend */}
                <div className="flex items-center justify-between gap-4 bg-ambu-bg rounded-xl p-4">
                  <div>
                    <p className="text-xs text-ambu-muted mb-1">Overall Score</p>
                    <span className={`text-3xl font-bold px-3 py-1 rounded-xl border ${scoreColor}`}>
                      {score.overall}<span className="text-base font-normal">/100</span>
                    </span>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-ambu-muted mb-1">6-Month Trend</p>
                    <Sparkline data={score.trend} />
                    <p className="text-xs text-ambu-muted mt-0.5">
                      {score.trend[0]} → {score.trend[score.trend.length - 1]}
                    </p>
                  </div>
                </div>

                {/* Sub-scores */}
                <div className="space-y-3">
                  <p className="text-xs font-semibold text-ambu-dark uppercase tracking-wide">Performance Breakdown</p>
                  {[
                    { label: 'On-Time Rate', value: score.onTime, display: `${score.onTime}%` },
                    { label: 'Patient Rating', value: Math.round(score.rating * 20), display: `${score.rating} / 5.0 ★` },
                    { label: 'Safety Score', value: score.safety, display: `${score.safety}%` },
                  ].map(sub => (
                    <div key={sub.label}>
                      <div className="flex justify-between text-xs mb-1.5">
                        <span className="text-ambu-muted font-medium">{sub.label}</span>
                        <span className="font-bold text-ambu-dark">{sub.display}</span>
                      </div>
                      <div className="h-2 bg-ambu-border rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${sub.value >= 80 ? 'bg-emerald-500' : sub.value >= 60 ? 'bg-amber-500' : 'bg-red-500'}`}
                          style={{ width: `${sub.value}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Flags */}
                {score.flags.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-xs font-semibold text-ambu-dark uppercase tracking-wide">Active Flags</p>
                    {score.flags.map(flag => (
                      <p key={flag} className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                        ⚠ {flag}
                      </p>
                    ))}
                  </div>
                )}

                {/* Last 10 rides */}
                <div>
                  <p className="text-xs font-semibold text-ambu-dark uppercase tracking-wide mb-2">Last 10 Rides</p>
                  <div className="space-y-1.5">
                    {score.recentRides.map(r => (
                      <div key={r.id} className={`flex items-center justify-between gap-3 rounded-xl px-3 py-2 border text-xs ${
                        r.onTime ? 'bg-emerald-50/50 border-emerald-100' : 'bg-red-50/50 border-red-100'
                      }`}>
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${r.onTime ? 'bg-emerald-500' : 'bg-red-500'}`} />
                          <span className="font-mono text-ambu-muted">#{r.id.substring(0, 8).toUpperCase()}</span>
                          <span className="text-ambu-muted">{r.date}</span>
                          {r.notes && <span className="text-ambu-muted truncate">· {r.notes}</span>}
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                          <span className="font-semibold text-ambu-dark">{r.rating}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )
      })()}

      {modal.open && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md relative max-h-[90vh] overflow-y-auto">
            <button onClick={closeModal} className="absolute top-4 right-4 text-ambu-muted hover:text-ambu-dark">
              <X className="w-5 h-5" />
            </button>
            <h2 className="text-lg font-bold text-ambu-dark mb-5">
              {modal.mode === 'add' ? 'Add New Vehicle' : 'Edit Vehicle'}
            </h2>
            <div className="space-y-4">
              {[
                { label: 'Vehicle Code / Number Plate', key: 'code', type: 'text', placeholder: 'e.g. UC-DL-003' },
                { label: 'Driver Name', key: 'driver_name', type: 'text', placeholder: 'Full name' },
                { label: 'Driver Phone', key: 'driver_phone', type: 'tel', placeholder: '10-digit number' },
              ].map(({ label, key, type, placeholder }) => (
                <div key={key}>
                  <label className="block text-xs font-medium text-ambu-dark mb-1.5">{label}</label>
                  <input
                    type={type}
                    value={form[key as keyof typeof form] as string}
                    onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
                    placeholder={placeholder}
                    className="w-full px-3 py-2.5 border border-ambu-border rounded-xl text-sm text-ambu-dark focus:outline-none focus:ring-2 focus:ring-ambu-red focus:border-transparent"
                  />
                </div>
              ))}
              <div>
                <label className="block text-xs font-medium text-ambu-dark mb-1.5 flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5" /> Driver PIN (4 digits)
                </label>
                <input
                  type="number"
                  inputMode="numeric"
                  maxLength={4}
                  value={form.driver_pin}
                  onChange={e => setForm(p => ({ ...p, driver_pin: e.target.value.slice(0, 4) }))}
                  placeholder="e.g. 1234"
                  className="w-full px-3 py-2.5 border border-ambu-border rounded-xl text-sm text-ambu-dark focus:outline-none focus:ring-2 focus:ring-ambu-red [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <p className="text-xs text-ambu-muted mt-1">Driver enters this PIN to unlock the tracking app</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-ambu-dark mb-1.5">Vehicle Type</label>
                <select
                  value={form.type}
                  onChange={e => setForm(p => ({ ...p, type: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-ambu-border rounded-xl text-sm text-ambu-dark focus:outline-none focus:ring-2 focus:ring-ambu-red"
                >
                  <option value="BLS">BLS (Basic Life Support)</option>
                  <option value="ALS">ALS (Advanced Life Support)</option>
                  <option value="hospital_fleet">General Purpose</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-ambu-dark mb-1.5">Status</label>
                <select
                  value={form.status}
                  onChange={e => setForm(p => ({ ...p, status: e.target.value as Status }))}
                  className="w-full px-3 py-2.5 border border-ambu-border rounded-xl text-sm text-ambu-dark focus:outline-none focus:ring-2 focus:ring-ambu-red"
                >
                  {STATUSES.map(s => (
                    <option key={s} value={s}>
                      {s.charAt(0).toUpperCase() + s.slice(1).replace('_', ' ')}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  onClick={closeModal}
                  className="flex-1 px-4 py-2.5 border border-ambu-border rounded-xl text-sm font-medium text-ambu-muted hover:bg-ambu-bg transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || !form.code || !form.driver_name}
                  className="flex-1 bg-ambu-red text-white px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-ambu-red-dark disabled:opacity-60 flex items-center justify-center gap-2 transition"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  {modal.mode === 'add' ? 'Add Vehicle' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
