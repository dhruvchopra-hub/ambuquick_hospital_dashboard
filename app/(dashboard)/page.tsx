'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Ride, Ambulance } from '@/types'
import { formatDistanceToNow } from 'date-fns'
import { toast } from 'sonner'
import {
  Ambulance as AmbulanceIcon, Clock, TrendingUp, IndianRupee,
  Navigation, CheckCircle, Circle, AlertTriangle, X, Zap, Timer,
} from 'lucide-react'

const NEXT_STATUS: Record<string, string> = {
  pending: 'dispatched', dispatched: 'en_route', en_route: 'completed',
}
const NEXT_LABEL: Record<string, string> = {
  pending: 'Dispatch', dispatched: 'En Route', en_route: 'Complete',
}

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-ambu-border/60 ${className}`} />
}

function RideStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending: 'bg-amber-50 text-amber-700 border border-amber-200',
    dispatched: 'bg-blue-50 text-blue-700 border border-blue-200',
    en_route: 'bg-indigo-50 text-indigo-700 border border-indigo-200',
    completed: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    cancelled: 'bg-red-50 text-red-700 border border-red-200',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${styles[status] || 'bg-gray-100 text-gray-600'}`}>
      {status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')}
    </span>
  )
}

function StatusDot({ status }: { status: string }) {
  const color: Record<string, string> = {
    available: 'bg-emerald-500',
    on_trip: 'bg-blue-500',
    maintenance: 'bg-amber-500',
    offline: 'bg-gray-400',
  }
  const label: Record<string, string> = {
    available: 'Available', on_trip: 'On Trip', maintenance: 'Maintenance', offline: 'Offline',
  }
  return (
    <div className={`flex items-center gap-1.5 text-xs font-medium ${
      status === 'available' ? 'text-emerald-700' :
      status === 'on_trip' ? 'text-blue-700' :
      status === 'maintenance' ? 'text-amber-700' : 'text-gray-500'
    }`}>
      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${color[status] || 'bg-gray-400'}`} />
      {label[status] || status}
    </div>
  )
}

const REASSIGN_TIMEOUT_S = 30
const MAX_ATTEMPTS = 3
const OPS_PHONE = '9810001234'

interface CountdownState {
  secondsLeft: number
  attemptNumber: number
  ambulanceCode: string
  driverName: string
  status: 'waiting' | 'accepted' | 'declined' | 'exhausted'
}

export default function OverviewPage() {
  const router = useRouter()
  const [ambulances, setAmbulances] = useState<Ambulance[]>([])
  const [recentRides, setRecentRides] = useState<Ride[]>([])
  const [ridesThisMonth, setRidesThisMonth] = useState(0)
  const [avgResponse, setAvgResponse] = useState<number | null>(null)
  const [pendingInvoice, setPendingInvoice] = useState(0)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState<string | null>(null)
  const [dismissedAlerts, setDismissedAlerts] = useState<string[]>([])
  // rideId → countdown state
  const [countdowns, setCountdowns] = useState<Record<string, CountdownState>>({})
  const timerRefs = useRef<Record<string, NodeJS.Timeout>>({})
  const reassigningRef = useRef<Set<string>>(new Set())

  const loadData = useCallback(async () => {
    const supabase = createClient()
    const [{ data: allRides }, { data: pendingInvoices }, { data: ambData }] = await Promise.all([
      supabase.from('rides').select('*').order('created_at', { ascending: false }),
      supabase.from('invoices').select('total').eq('status', 'pending'),
      supabase.from('ambulances').select('*'),
    ])
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
    setLoading(false)
  }, [])

  useEffect(() => {
    loadData()
    const supabase = createClient()
    const channel = supabase.channel('overview-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ambulances' }, loadData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rides' }, loadData)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [loadData])

  // Start / update countdowns for pending rides
  useEffect(() => {
    const pendingRides = recentRides.filter(r => r.status === 'pending')

    // Clear timers for rides that are no longer pending
    Object.keys(timerRefs.current).forEach(rideId => {
      if (!pendingRides.find(r => r.id === rideId)) {
        clearInterval(timerRefs.current[rideId])
        delete timerRefs.current[rideId]
      }
    })

    // Resolve accepted/declined countdowns
    setCountdowns(prev => {
      const next = { ...prev }
      Object.keys(next).forEach(rideId => {
        const ride = recentRides.find(r => r.id === rideId)
        if (ride?.status === 'dispatched' && next[rideId].status === 'waiting') {
          next[rideId] = { ...next[rideId], status: 'accepted' }
          clearInterval(timerRefs.current[rideId])
          delete timerRefs.current[rideId]
          setTimeout(() => setCountdowns(p => { const c = { ...p }; delete c[rideId]; return c }), 4000)
        }
      })
      return next
    })

    // Start new timers for newly pending rides
    pendingRides.forEach(ride => {
      if (timerRefs.current[ride.id]) return // already running
      const amb = ambulances.find(a => a.id === ride.ambulance_id)
      const attemptNumber = (ride as Ride & { attempted_ambulance_ids?: string[] }).attempted_ambulance_ids?.length ?? 1

      setCountdowns(prev => ({
        ...prev,
        [ride.id]: {
          secondsLeft: REASSIGN_TIMEOUT_S,
          attemptNumber,
          ambulanceCode: amb?.code ?? '—',
          driverName: ride.driver_name ?? '—',
          status: 'waiting',
        },
      }))

      timerRefs.current[ride.id] = setInterval(() => {
        setCountdowns(prev => {
          const cur = prev[ride.id]
          if (!cur || cur.status !== 'waiting') return prev
          const next = cur.secondsLeft - 1
          if (next > 0) return { ...prev, [ride.id]: { ...cur, secondsLeft: next } }

          // Timer expired — trigger reassignment
          clearInterval(timerRefs.current[ride.id])
          delete timerRefs.current[ride.id]

          if (!reassigningRef.current.has(ride.id)) {
            reassigningRef.current.add(ride.id)
            fetch('/api/reassign-ride', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ rideId: ride.id, excludeAmbulanceIds: [] }),
            })
              .then(r => r.json())
              .then(data => {
                reassigningRef.current.delete(ride.id)
                if (data.exhausted) {
                  setCountdowns(p => ({
                    ...p,
                    [ride.id]: { ...p[ride.id], status: 'exhausted', secondsLeft: 0 },
                  }))
                } else {
                  setCountdowns(p => ({
                    ...p,
                    [ride.id]: {
                      secondsLeft: REASSIGN_TIMEOUT_S,
                      attemptNumber: data.attemptNumber,
                      ambulanceCode: data.ambulance?.code ?? '—',
                      driverName: data.ambulance?.driver_name ?? '—',
                      status: 'waiting',
                    },
                  }))
                }
              })
              .catch(() => { reassigningRef.current.delete(ride.id) })
          }
          return { ...prev, [ride.id]: { ...cur, secondsLeft: 0 } }
        })
      }, 1000)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recentRides, ambulances])

  // Cleanup timers on unmount
  useEffect(() => () => {
    Object.values(timerRefs.current).forEach(clearInterval)
  }, [])

  const updateStatus = async (ride: Ride, newStatus: string) => {
    setUpdating(ride.id)
    const supabase = createClient()
    await supabase.from('rides').update({ status: newStatus }).eq('id', ride.id)
    if ((newStatus === 'completed' || newStatus === 'cancelled') && ride.ambulance_id) {
      await supabase.from('ambulances').update({ status: 'available' }).eq('id', ride.ambulance_id)
    }
    toast.success(`Ride marked as ${newStatus.replace('_', ' ')}`)
    await loadData()
    setUpdating(null)
  }

  const slaBreaches = recentRides.filter(r => {
    if (!['dispatched', 'en_route'].includes(r.status) || dismissedAlerts.includes(r.id)) return false
    const elapsed = (Date.now() - new Date(r.created_at).getTime()) / 60000
    return elapsed >= 13 // warn at 13 min (5 min before 18-min SLA)
  })

  const activeAmbulances = ambulances.filter(a => ['available', 'on_trip'].includes(a.status)).length
  const activeRides = recentRides.filter(r => ['pending', 'dispatched', 'en_route'].includes(r.status))

  const metrics = [
    {
      label: 'Active Ambulances',
      value: loading ? '—' : activeAmbulances,
      sub: loading ? '' : `${ambulances.length} total in fleet`,
      icon: <AmbulanceIcon className="w-5 h-5" />,
      color: 'text-blue-600',
      iconBg: 'bg-blue-50',
    },
    {
      label: 'Avg Response Time',
      value: loading ? '—' : avgResponse !== null ? `${avgResponse} min` : '—',
      sub: loading ? '' : avgResponse !== null ? (avgResponse <= 18 ? 'Within SLA ✓' : 'Above SLA target') : 'No data yet',
      icon: <Clock className="w-5 h-5" />,
      color: avgResponse !== null && avgResponse <= 18 ? 'text-ambu-success' : avgResponse ? 'text-ambu-red' : 'text-ambu-muted',
      iconBg: avgResponse !== null && avgResponse <= 18 ? 'bg-emerald-50' : 'bg-red-50',
    },
    {
      label: 'Rides This Month',
      value: loading ? '—' : ridesThisMonth,
      sub: 'Current calendar month',
      icon: <TrendingUp className="w-5 h-5" />,
      color: 'text-violet-600',
      iconBg: 'bg-violet-50',
    },
    {
      label: 'Pending Invoice',
      value: loading ? '—' : `₹${pendingInvoice.toLocaleString('en-IN')}`,
      sub: 'Awaiting payment',
      icon: <IndianRupee className="w-5 h-5" />,
      color: 'text-ambu-warning',
      iconBg: 'bg-amber-50',
    },
  ]

  return (
    <div className="p-5 lg:p-7 space-y-5 pb-24">
      {/* SLA Breach Alerts */}
      {!loading && slaBreaches.length === 0 && activeRides.length > 0 && (
        <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
          <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <p className="text-sm font-semibold text-emerald-800">All Active Rides Within SLA</p>
          <span className="ml-auto text-xs text-emerald-600">{activeRides.length} active</span>
        </div>
      )}
      {slaBreaches.map(ride => {
        const elapsed = Math.floor((Date.now() - new Date(ride.created_at).getTime()) / 60000)
        const minsLeft = 18 - elapsed
        const ambulanceCode = ambulances.find(a => a.id === ride.ambulance_id)?.code || '—'
        return (
          <div
            key={ride.id}
            className="flex items-start gap-3 bg-red-50 border-2 border-red-300 rounded-xl px-4 py-3 shadow-sm"
            style={{ animation: 'pulse 2s ease-in-out infinite' }}
          >
            <AlertTriangle className="w-5 h-5 text-ambu-red flex-shrink-0 mt-0.5 animate-pulse" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-red-900">
                ⚠️ SLA Breach Risk — {ambulanceCode} is {minsLeft > 0 ? `${minsLeft} min${minsLeft !== 1 ? 's' : ''} from SLA breach` : 'past SLA target'} on Ride #{ride.id.substring(0, 8).toUpperCase()}
              </p>
              <p className="text-xs text-red-700 mt-0.5">
                {ride.patient_name} · {ride.pickup_location} · Elapsed: {elapsed} min · SLA target: 18 min
              </p>
            </div>
            <button
              onClick={() => setDismissedAlerts(prev => [...prev, ride.id])}
              className="text-red-400 hover:text-red-600 flex-shrink-0 mt-0.5"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )
      })}

      {/* Driver Response Countdown Cards */}
      {Object.entries(countdowns).map(([rideId, cd]) => {
        const ride = recentRides.find(r => r.id === rideId)
        const pct = (cd.secondsLeft / REASSIGN_TIMEOUT_S) * 100
        if (cd.status === 'accepted') return (
          <div key={rideId} className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            <p className="text-sm font-semibold text-emerald-800">
              {cd.driverName} accepted · {ride?.patient_name ?? 'Ride'} is on the way
            </p>
          </div>
        )
        if (cd.status === 'exhausted') return (
          <div key={rideId} className="flex items-start gap-3 bg-red-50 border-2 border-ambu-red rounded-xl px-4 py-3">
            <AlertTriangle className="w-5 h-5 text-ambu-red shrink-0 mt-0.5 animate-pulse" />
            <div className="flex-1">
              <p className="text-sm font-bold text-red-900">No drivers responding — please call ops</p>
              <p className="text-xs text-red-700 mt-0.5">
                {ride?.patient_name} · All {MAX_ATTEMPTS} drivers tried ·{' '}
                <a href={`tel:${OPS_PHONE}`} className="underline font-semibold">{OPS_PHONE}</a>
              </p>
            </div>
            <button onClick={() => setCountdowns(p => { const c = { ...p }; delete c[rideId]; return c })}
              className="text-red-400 hover:text-red-600 shrink-0">
              <X className="w-4 h-4" />
            </button>
          </div>
        )
        return (
          <div key={rideId} className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Timer className="w-4 h-4 text-amber-600 shrink-0" />
                <p className="text-sm font-semibold text-amber-900">
                  Awaiting Driver Response · Attempt {cd.attemptNumber}/{MAX_ATTEMPTS}
                </p>
              </div>
              <span className={`text-sm font-black tabular-nums ${cd.secondsLeft <= 10 ? 'text-ambu-red animate-pulse' : 'text-amber-700'}`}>
                {cd.secondsLeft}s
              </span>
            </div>
            <p className="text-xs text-amber-700">
              {cd.ambulanceCode} · {cd.driverName}
              {ride && <span> · {ride.patient_name}</span>}
            </p>
            <div className="h-1.5 bg-amber-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-amber-500 rounded-full transition-all duration-1000"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        )
      })}

      {/* Metric Cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {metrics.map(m => (
          <div key={m.label} className="bg-white rounded-2xl border border-ambu-border shadow-sm p-5">
            {loading ? (
              <div className="space-y-2">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-7 w-16" />
                <Skeleton className="h-3 w-20" />
              </div>
            ) : (
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-ambu-muted uppercase tracking-wide">{m.label}</p>
                  <p className={`text-2xl font-bold mt-1 ${m.color}`}>{m.value}</p>
                  <p className="text-xs text-ambu-muted mt-1">{m.sub}</p>
                </div>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${m.iconBg} ${m.color}`}>
                  {m.icon}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-5">
        {/* Live Dispatch Feed */}
        <div className="xl:col-span-3 bg-white rounded-2xl border border-ambu-border shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-ambu-dark flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-ambu-red animate-pulse" />
              Live Dispatch Feed
            </h2>
            <span className="text-xs text-ambu-muted">{activeRides.length} active</span>
          </div>

          {loading ? (
            <div className="space-y-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="flex gap-3">
                  <Skeleton className="w-8 h-8 rounded-full flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-3 w-32" />
                    <Skeleton className="h-3 w-48" />
                  </div>
                </div>
              ))}
            </div>
          ) : recentRides.length === 0 ? (
            <div className="text-center py-10">
              <AmbulanceIcon className="w-8 h-8 text-ambu-border mx-auto mb-2" />
              <p className="text-sm text-ambu-muted">No rides yet</p>
            </div>
          ) : (
            <div className="space-y-0 divide-y divide-ambu-border/50">
              {recentRides.map((ride) => (
                <div key={ride.id} className="flex gap-3 py-3 first:pt-0 last:pb-0">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                    ride.status === 'completed' ? 'bg-emerald-50' :
                    ride.status === 'cancelled' ? 'bg-red-50' : 'bg-blue-50'
                  }`}>
                    {ride.status === 'completed' ? <CheckCircle className="w-4 h-4 text-emerald-600" /> :
                     ['en_route', 'dispatched'].includes(ride.status) ? <Navigation className="w-4 h-4 text-blue-600" /> :
                     <Circle className="w-4 h-4 text-ambu-muted" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-ambu-dark truncate">{ride.patient_name}</p>
                        <p className="text-xs text-ambu-muted truncate mt-0.5">
                          {ride.pickup_location} → {ride.destination}
                        </p>
                      </div>
                      <div className="flex-shrink-0 text-right">
                        <RideStatusBadge status={ride.status} />
                        <p className="text-xs text-ambu-muted mt-1">
                          {formatDistanceToNow(new Date(ride.created_at), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${
                        ride.urgency === 'Critical' ? 'bg-red-50 text-red-700 border-red-200' :
                        ride.urgency === 'Urgent' ? 'bg-orange-50 text-orange-700 border-orange-200' :
                        'bg-emerald-50 text-emerald-700 border-emerald-200'
                      }`}>{ride.urgency}</span>
                      {ride.driver_name && <span className="text-xs text-ambu-muted">{ride.driver_name}</span>}
                      {NEXT_STATUS[ride.status] && (
                        <button
                          onClick={() => updateStatus(ride, NEXT_STATUS[ride.status])}
                          disabled={updating === ride.id}
                          className="text-xs px-2 py-0.5 rounded-full font-medium text-white bg-ambu-dark hover:bg-ambu-dark/80 transition disabled:opacity-50"
                        >
                          {updating === ride.id ? '…' : NEXT_LABEL[ride.status]}
                        </button>
                      )}
                      {['pending', 'dispatched'].includes(ride.status) && (
                        <button
                          onClick={() => updateStatus(ride, 'cancelled')}
                          disabled={updating === ride.id}
                          className="text-xs px-2 py-0.5 rounded-full font-medium text-ambu-red bg-red-50 hover:bg-red-100 transition disabled:opacity-50"
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
        <div className="xl:col-span-2 bg-white rounded-2xl border border-ambu-border shadow-sm p-5">
          <h2 className="font-semibold text-ambu-dark flex items-center gap-2 mb-4">
            <AmbulanceIcon className="w-4 h-4 text-ambu-red" />
            Fleet Status
          </h2>

          {loading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
            </div>
          ) : ambulances.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-ambu-muted">No ambulances found</p>
            </div>
          ) : (
            <div className="space-y-2">
              {ambulances.map(amb => (
                <div key={amb.id} className="flex items-center justify-between p-3 bg-ambu-bg rounded-xl">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-ambu-dark">{amb.code}</p>
                    <p className="text-xs text-ambu-muted truncate mt-0.5">{amb.driver_name}</p>
                    <p className="text-xs text-ambu-muted/60">
                      {amb.is_hospital_fleet ? 'Hospital Fleet' : `AmbuQuick ${amb.type}`}
                    </p>
                  </div>
                  <StatusDot status={amb.status} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Emergency SOS Button */}
      <button
        onClick={() => router.push('/book')}
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 bg-ambu-red hover:bg-ambu-red-dark text-white font-bold px-5 py-3.5 rounded-full shadow-2xl transition-all hover:scale-105 active:scale-95"
        style={{ boxShadow: '0 0 0 4px rgba(217,26,42,0.15), 0 8px 24px rgba(217,26,42,0.35)' }}
      >
        <Zap className="w-4 h-4" />
        Emergency SOS
      </button>
    </div>
  )
}
