'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Ambulance } from '@/types'
import { Truck, Plus, Edit2, Loader2, X, CheckCircle, Shield, Building2, Link2 } from 'lucide-react'

const STATUSES = ['available', 'on_trip', 'maintenance', 'offline'] as const
type Status = typeof STATUSES[number]

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    available: 'status-available', on_trip: 'status-on_trip', maintenance: 'status-maintenance', offline: 'status-offline',
  }
  const label: Record<string, string> = {
    available: 'Available', on_trip: 'On Trip', maintenance: 'Maintenance', offline: 'Offline'
  }
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${map[status] || ''}`}>
      {label[status] || status}
    </span>
  )
}

interface VehicleModal { open: boolean; mode: 'add' | 'edit'; ambulance: Partial<Ambulance> | null }
const emptyForm = { code: '', type: 'BLS', driver_name: '', driver_phone: '', status: 'available' as Status }

export default function FleetPage() {
  const [ambulances, setAmbulances] = useState<Ambulance[]>([])
  const [hospitalId, setHospitalId] = useState('')
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<VehicleModal>({ open: false, mode: 'add', ambulance: null })
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [tab, setTab] = useState<'ambuquick' | 'hospital'>('ambuquick')
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const copyDriverLink = (amb: Ambulance) => {
    const url = `${window.location.origin}/driver/${amb.id}`
    navigator.clipboard.writeText(url)
    setCopiedId(amb.id)
    setTimeout(() => setCopiedId(null), 2000)
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
  const openEdit = (amb: Ambulance) => {
    setForm({ code: amb.code, type: amb.type, driver_name: amb.driver_name, driver_phone: amb.driver_phone, status: amb.status as Status })
    setModal({ open: true, mode: 'edit', ambulance: amb })
  }
  const closeModal = () => setModal({ open: false, mode: 'add', ambulance: null })

  const handleSave = async () => {
    if (!form.code || !form.driver_name) return
    if (!hospitalId) {
      setErrorMsg('Hospital not linked to your account. Please refresh and try again.')
      return
    }
    setSaving(true)
    setErrorMsg('')
    const supabase = createClient()
    let saveError = null
    if (modal.mode === 'add') {
      const { error } = await supabase.from('ambulances').insert({
        ...form, hospital_id: hospitalId, is_hospital_fleet: true, lat: 28.6139, lng: 77.2090,
      })
      saveError = error
    } else if (modal.ambulance?.id) {
      const { error } = await supabase.from('ambulances').update(form).eq('id', modal.ambulance.id)
      saveError = error
    }
    if (saveError) {
      setErrorMsg('Failed to save: ' + saveError.message)
      setSaving(false)
      return
    }
    await fetchData(supabase)
    setSaving(false)
    closeModal()
    setTab('hospital')
    setSuccessMsg(modal.mode === 'add' ? 'Vehicle added successfully!' : 'Vehicle updated!')
    setTimeout(() => setSuccessMsg(''), 3000)
  }

  const ambuquickFleet = ambulances.filter(a => !a.is_hospital_fleet)
  const hospitalFleet = ambulances.filter(a => a.is_hospital_fleet)

  if (loading) {
    return (
      <div className="p-6 lg:p-8 flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-ambu-red border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const VehicleCard = ({ amb, editable }: { amb: Ambulance; editable: boolean }) => (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-lg font-bold text-gray-900">{amb.code}</p>
          <p className="text-xs text-gray-500 mt-0.5">{amb.is_hospital_fleet ? 'Hospital Fleet' : `AmbuQuick ${amb.type}`}</p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={amb.status} />
          <button
            onClick={() => copyDriverLink(amb)}
            title="Copy driver tracking link"
            className="w-7 h-7 flex items-center justify-center rounded-lg bg-gray-100 hover:bg-blue-100 text-gray-500 hover:text-blue-600 transition-all"
          >
            {copiedId === amb.id ? <CheckCircle className="w-3.5 h-3.5 text-green-500" /> : <Link2 className="w-3.5 h-3.5" />}
          </button>
          {editable && (
            <button onClick={() => openEdit(amb)} className="w-7 h-7 flex items-center justify-center rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-gray-700 transition-all">
              <Edit2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
      <div className="border-t border-gray-50 pt-3 space-y-1.5">
        <div className="flex justify-between text-xs">
          <span className="text-gray-400">Type</span>
          <span className="text-gray-700 font-medium">{amb.type === 'hospital_fleet' ? 'General' : amb.type}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-gray-400">Driver</span>
          <span className="text-gray-700 font-medium">{amb.driver_name}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-gray-400">Phone</span>
          <span className="text-gray-700">{amb.driver_phone}</span>
        </div>
      </div>
    </div>
  )

  return (
    <div className="p-6 lg:p-8 space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Truck className="w-6 h-6 text-ambu-red" /> Fleet Manager
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage all ambulances assigned to your hospital</p>
        </div>
        <button onClick={openAdd} className="flex items-center gap-1.5 bg-ambu-red text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-ambu-red-dark transition-colors shadow-sm flex-shrink-0">
          <Plus className="w-4 h-4" /> Add Vehicle
        </button>
      </div>

      {successMsg && (
        <div className="flex items-center gap-2 bg-green-50 border border-green-100 text-green-700 rounded-xl p-3.5 text-sm">
          <CheckCircle className="w-4 h-4 flex-shrink-0" />{successMsg}
        </div>
      )}
      {errorMsg && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-100 text-red-700 rounded-xl p-3.5 text-sm">
          <X className="w-4 h-4 flex-shrink-0" />{errorMsg}
        </div>
      )}

      <div className="flex gap-2">
        <button onClick={() => setTab('ambuquick')} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${tab === 'ambuquick' ? 'bg-ambu-red text-white shadow-sm' : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-300'}`}>
          <Shield className="w-4 h-4" /> AmbuQuick Fleet ({ambuquickFleet.length})
        </button>
        <button onClick={() => setTab('hospital')} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${tab === 'hospital' ? 'bg-ambu-red text-white shadow-sm' : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-300'}`}>
          <Building2 className="w-4 h-4" /> Your Fleet ({hospitalFleet.length})
        </button>
      </div>

      {tab === 'ambuquick' && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Shield className="w-4 h-4 text-ambu-red" />
            <h2 className="font-semibold text-gray-900">AmbuQuick Assigned Fleet</h2>
            <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Read-only</span>
          </div>
          {ambuquickFleet.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
              <p className="text-gray-400 text-sm">No AmbuQuick vehicles assigned</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {ambuquickFleet.map(amb => <VehicleCard key={amb.id} amb={amb} editable={false} />)}
            </div>
          )}
        </div>
      )}

      {tab === 'hospital' && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Building2 className="w-4 h-4 text-ambu-red" />
            <h2 className="font-semibold text-gray-900">Your Hospital Fleet</h2>
            <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full">Editable</span>
          </div>
          {hospitalFleet.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
              <p className="text-gray-400 text-sm mb-3">No hospital vehicles added yet</p>
              <button onClick={openAdd} className="text-ambu-red text-sm font-medium hover:underline">Add your first vehicle →</button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {hospitalFleet.map(amb => <VehicleCard key={amb.id} amb={amb} editable={true} />)}
            </div>
          )}
        </div>
      )}

      {modal.open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md relative">
            <button onClick={closeModal} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            <h2 className="text-lg font-bold text-gray-900 mb-4">{modal.mode === 'add' ? 'Add New Vehicle' : 'Edit Vehicle'}</h2>
            <div className="space-y-4">
              {[
                { label: 'Vehicle Code / Number Plate', key: 'code', type: 'text', placeholder: 'e.g. UC-DL-003 or DL-1CA-1234' },
                { label: 'Driver Name', key: 'driver_name', type: 'text', placeholder: 'Full name' },
                { label: 'Driver Phone', key: 'driver_phone', type: 'tel', placeholder: '10-digit number' },
              ].map(({ label, key, type, placeholder }) => (
                <div key={key}>
                  <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
                  <input type={type} value={form[key as keyof typeof form] as string}
                    onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))} placeholder={placeholder}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ambu-red" />
                </div>
              ))}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Vehicle Type</label>
                <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ambu-red">
                  <option value="BLS">BLS (Basic Life Support)</option>
                  <option value="ALS">ALS (Advanced Life Support)</option>
                  <option value="hospital_fleet">General Purpose</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
                <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value as Status }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ambu-red">
                  {STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1).replace('_', ' ')}</option>)}
                </select>
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={closeModal} className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50">Cancel</button>
                <button onClick={handleSave} disabled={saving || !form.code || !form.driver_name}
                  className="flex-1 bg-ambu-red text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-ambu-red-dark disabled:opacity-60 flex items-center justify-center gap-2">
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
