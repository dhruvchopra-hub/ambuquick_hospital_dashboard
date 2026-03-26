'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Ambulance } from '@/types'
import { toast } from 'sonner'
import { Truck, Plus, Edit2, Loader2, X, CheckCircle, Shield, Building2, Link2, KeyRound } from 'lucide-react'

const STATUSES = ['available', 'on_trip', 'maintenance', 'offline'] as const
type Status = typeof STATUSES[number]

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

export default function FleetPage() {
  const [ambulances, setAmbulances] = useState<(Ambulance & { driver_pin?: string; _optimistic?: boolean })[]>([])
  const [hospitalId, setHospitalId] = useState('')
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<VehicleModal>({ open: false, mode: 'add', ambulance: null })
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [tab, setTab] = useState<'ambuquick' | 'hospital'>('ambuquick')
  const [copiedId, setCopiedId] = useState<string | null>(null)

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

  useEffect(() => {
    const supabase = createClient()
    async function init() {
      const { data: profile } = await supabase.from('user_profiles').select('hospital_id').single()
      if (profile?.hospital_id) setHospitalId(profile.hospital_id)
      await fetchData(supabase)
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
      </div>
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
