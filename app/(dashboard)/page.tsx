'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Ride, Ambulance, Hospital } from '@/types'
import { format, formatDistanceToNow } from 'date-fns'
import {
  Ambulance as AmbulanceIcon, Clock, TrendingUp, IndianRupee,
  Activity, CheckCircle, Navigation, Circle, AlertTriangle, X,
} from 'lucide-react'

const NEXT_STATUS: Record<string, string> = {
  pending: 'dispatched', dispatched: 'en_route', en_route: 'completed',
}
const NEXT_LABEL: Record<string, string> = {
  pending: 'Dispatch', dispatched: 'En Route', en_route: 'Complete',
}
const NEXT_COLOR: Record<string, string> = {
  pending: 'bg-blue-600 hover:bg-blue-700',
  dispatched: 'bg-indigo-600 hover:bg-indigo-700',
  en_route: 'bg-green-600 hover:bg-green-700',
}

function RideStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-700',
    dispatched: 'bg-blue-100 text-blue-700',
    en_route: 'bg-indigo-100 text-indigo-700',
    completed: 'bg-green-100 text-green-700',
    cancelled: 'bg-red-100 text-red-700',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${map[status] || 'bg-gray-100 text-gray-600'}`}>
      {status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')}
    </span>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    available: 'status-available', on_trip: 'status-on_trip',
    maintenance: 'status-maintenance', offline: 'status-offline',
  }
  const label: Record<string, string> = {
    available: 'Available', on_trip: 'On Trip', maintenance: 'Maintenance', offline: 'Offline',
  }
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${map[status] || 'bg-gray-100 text-gray-600'}`}>
      {label[status] || status}
    </span>
  )
}

export default function OverviewPage() {
  const [hospital, setHospital] = useState<Hospital | null>(null)
  const [ambulances, setAmbulances] = useState<Ambulance[]>([])
  const [recentRides, setRecentRides] = useState<Ride[]>([])
  const [ridesThisMonth, setRidesThisMonth] = useState(0)
  const [avgResponse, setAvgResponse] = useState<number | null>(null)
  const [pendingInvoice, setPendingInvoice] = useState(0)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState<string | null>(null)
  const [dismissedAlerts, setDismissedAlerts] = useState<string[]>([])

  const loadData = useCallback(async () => {
    const supabase = createClient()
    try {
      const [{ data: hospitalData }, { data: allRides }, { data: pendingInvoices }, { data: ambData }] = await Promise.all([
        supabase.from('hospitals').select('*').single(),
        supabase.from('rides').select('*').order('created_at', { ascending: false }),
        supabase.from('invoices').select('total').eq('status', 'pending'),
        supabase.from('ambulances').select('*'),
      ])
      if (hospitalData) setHospital(hospitalData as Hospital)
      if (allRides) {
        setRecentRides(allRides.slice(0, 10))
        const startOfMonth = new Date(); startOfMonth.setDate(1); startOfMonth.setHours(0, 0, 0, 0)
        setRidesThisMonth(allRides.filter(r => new Date(r.created_at) >= startOfMonth).length)
        const completed = allRides.filter(r => r.status === 'completed' && r.response_time_minutes != null)
        if (completed.length > 0) {
          setAvgResponse(Math.round(completed.reduce((s, r) => s + (r.response_time_minutes || 0), 0) / completed.length))
        }
      }
      if (pendingInvoices) setPendingInvoice(pendingInvoices.reduce((s, inv) => s + (inv.total || 0), 0))
      if (ambData) setAmbulances(ambData as Ambulance[])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
    const supabase = createClient()
    const channel = supabase.channel('ambulances-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ambulances' }, loadData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rides' }, loadData)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [loadData])

  const updateStatus = async (ride: Ride, newStatus: string) => {
    setUpdating(ride.id)
    const supabase = createClient()
    try {
      await supabase.from('rides').update({ status: newStatus }).eq('id', ride.id)
      if ((newStatus === 'completed' || newStatus === 'cancelled') && ride.ambulance_id) {
        await supabase.from('ambulances').update({ status: 'available' }).eq('id', ride.ambulance_id)
      }
      await loadData()
    } finally {
      setUpdating(null)
    }
  }

  // SLA breaches: dispatched rides older than 10 minutes
  const slaBreaches = recentRides.filter(r => {
    if (r.status !== 'dispatched' || dismissedAlerts.includes(r.id)) return false
    return (Date.now() - new Date(r.created_at).getTime()) / 60000 > 10
  })

  const activeAmbulances = ambulances.filter(a => ['available', 'on_trip'].includes(a.status)).length

  if (loading) {
    return (
      <div className="p-6 lg:p-8 flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-ambu-red border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className="text-sm text-gray-500">Loading dashboard…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Overview</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {hospital?.name} · {format(new Date(), 'EEEE, d MMMM yyyy')}
        </p>
      </div>

      {/* SLA Breach Alerts */}
      {slaBreaches.map(ride => (
        <div key={ride.id} className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-red-800">SLA Breach — {ride.patient_name}</p>
            <p className="text-xs text-red-600 mt-0.5">
              Dispatched {Math.floor((Date.now() - new Date(ride.created_at).getTime()) / 60000)} minutes ago with no status update. Expected response ≤ 10 min.
            </p>
          </div>
          <button onClick={() => setDismissedAlerts(prev => [...prev, ride.id])} className="text-red-400 hover:text-red-600 flex-shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard label="Active Ambulances" value={activeAmbulances} subtitle={`${ambulances.length} total in fleet`} icon={<AmbulanceIcon className="w-5 h-5" />} color="blue" />
        <StatCard label="Avg Response Time" value={avgResponse !== null ? `${avgResponse} min` : '—'} subtitle={avgResponse && avgResponse <= 18 ? 'Within SLA ✓' : avgResponse ? 'Above SLA target' : 'No data yet'} icon={<Clock className="w-5 h-5" />} color={avgResponse !== null && avgResponse <= 18 ? 'green' : 'red'} />
        <StatCard label="Rides This Month" value={ridesThisMonth} subtitle="Current month" icon={<TrendingUp className="w-5 h-5" />} color="purple" />
        <StatCard label="Pending Invoice" value={`₹${pendingInvoice.toLocaleString('en-IN')}`} subtitle="Awaiting payment" icon={<IndianRupee className="w-5 h-5" />} color="orange" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        {/* Recent Activity */}
        <div className="xl:col-span-3 bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <Activity className="w-4 h-4 text-ambu-red" /> Recent Activity
            </h2>
            <span className="text-xs text-gray-400">Last 10 rides</span>
          </div>
          {recentRides.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-sm">No rides yet</div>
          ) : (
            <div className="space-y-0">
              {recentRides.map((ride, idx) => (
                <div key={ride.id} className="flex gap-4 pb-4 last:pb-0">
                  <div className="flex flex-col items-center">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                      ride.status === 'completed' ? 'bg-green-100' :
                      ride.status === 'cancelled' ? 'bg-red-100' : 'bg-blue-100'
                    }`}>
                      {ride.status === 'completed' ? <CheckCircle className="w-4 h-4 text-green-600" /> :
                       ride.status === 'en_route' || ride.status === 'dispatched' ? <Navigation className="w-4 h-4 text-blue-600" /> :
                       <Circle className="w-4 h-4 text-gray-400" />}
                    </div>
                    {idx < recentRides.length - 1 && <div className="w-px flex-1 bg-gray-100 mt-1" />}
                  </div>
                  <div className="pb-4 flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium text-gray-900 truncate">{ride.patient_name}</p>
                        <p className="text-xs text-gray-500 truncate mt-0.5">{ride.pickup_location} → {ride.destination}</p>
                      </div>
                      <div className="flex-shrink-0 text-right">
                        <RideStatusBadge status={ride.status} />
                        <p className="text-xs text-gray-400 mt-1">{formatDistanceToNow(new Date(ride.created_at), { addSuffix: true })}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        ride.urgency === 'Critical' ? 'bg-red-100 text-red-700' :
                        ride.urgency === 'Urgent' ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'
                      }`}>{ride.urgency}</span>
                      {ride.driver_name && <span className="text-xs text-gray-400">{ride.driver_name}</span>}
                      {/* Action buttons */}
                      {NEXT_STATUS[ride.status] && (
                        <button
                          onClick={() => updateStatus(ride, NEXT_STATUS[ride.status])}
                          disabled={updating === ride.id}
                          className={`text-xs px-2 py-0.5 rounded-full font-medium text-white transition-all disabled:opacity-50 ${NEXT_COLOR[ride.status]}`}
                        >
                          {updating === ride.id ? '…' : NEXT_LABEL[ride.status]}
                        </button>
                      )}
                      {(ride.status === 'pending' || ride.status === 'dispatched') && (
                        <button
                          onClick={() => updateStatus(ride, 'cancelled')}
                          disabled={updating === ride.id}
                          className="text-xs px-2 py-0.5 rounded-full font-medium text-red-600 bg-red-50 hover:bg-red-100 transition-all disabled:opacity-50"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Fleet Status */}
        <div className="xl:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2 mb-5">
            <AmbulanceIcon className="w-4 h-4 text-ambu-red" /> Fleet Status
          </h2>
          {ambulances.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-sm">No ambulances found</div>
          ) : (
            <div className="space-y-3">
              {ambulances.map(amb => (
                <div key={amb.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900">{amb.code}</p>
                    <p className="text-xs text-gray-500 truncate">{amb.driver_name}</p>
                    <p className="text-xs text-gray-400">{amb.type === 'hospital_fleet' ? 'Hospital Fleet' : `AmbuQuick ${amb.type}`}</p>
                  </div>
                  <StatusBadge status={amb.status} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value, subtitle, icon, color }: {
  label: string; value: string | number; subtitle: string; icon: React.ReactNode; color: 'blue' | 'green' | 'red' | 'purple' | 'orange'
}) {
  const colors = {
    blue: { text: 'text-blue-600', icon: 'bg-blue-100 text-blue-600' },
    green: { text: 'text-green-600', icon: 'bg-green-100 text-green-600' },
    red: { text: 'text-red-600', icon: 'bg-red-100 text-red-600' },
    purple: { text: 'text-purple-600', icon: 'bg-purple-100 text-purple-600' },
    orange: { text: 'text-orange-600', icon: 'bg-orange-100 text-orange-600' },
  }
  const c = colors[color]
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
          <p className={`text-2xl font-bold mt-1 ${c.text}`}>{value}</p>
          <p className="text-xs text-gray-400 mt-1">{subtitle}</p>
        </div>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${c.icon}`}>{icon}</div>
      </div>
    </div>
  )
}
