'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { createClient } from '@/lib/supabase/client'
import { Ambulance, Ride } from '@/types'
import { MapPin, Navigation, Wifi } from 'lucide-react'

const MapComponent = dynamic(() => import('./MapComponent'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-ambu-bg flex items-center justify-center rounded-xl">
      <div className="text-center">
        <div className="w-6 h-6 border-2 border-ambu-red border-t-transparent rounded-full animate-spin mx-auto mb-2" />
        <p className="text-xs text-ambu-muted">Loading map…</p>
      </div>
    </div>
  ),
})

function StatusDot({ status }: { status: string }) {
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
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${styles[status] || 'bg-gray-100 text-gray-500 border-gray-200'}`}>
      {label[status] || status}
    </span>
  )
}

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-ambu-border/60 rounded-lg ${className}`} />
}

export default function TrackingPage() {
  const [ambulances, setAmbulances] = useState<Ambulance[]>([])
  const [activeRides, setActiveRides] = useState<Ride[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Ambulance | null>(null)

  useEffect(() => {
    const supabase = createClient()

    async function init() {
      const [{ data: ambData }, { data: ridesData }] = await Promise.all([
        supabase.from('ambulances').select('*'),
        supabase.from('rides').select('*').in('status', ['dispatched', 'en_route']),
      ])
      if (ambData) setAmbulances(ambData as Ambulance[])
      if (ridesData) setActiveRides(ridesData as Ride[])
      setLoading(false)
    }
    init()

    const ambChannel = supabase.channel('tracking-ambulances')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ambulances' }, async () => {
        const { data } = await supabase.from('ambulances').select('*')
        if (data) setAmbulances(data as Ambulance[])
      })
      .subscribe()

    const ridesChannel = supabase.channel('tracking-rides')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rides' }, async () => {
        const { data } = await supabase.from('rides').select('*').in('status', ['dispatched', 'en_route'])
        if (data) setActiveRides(data as Ride[])
      })
      .subscribe()

    const poll = setInterval(async () => {
      const [{ data: ambData }, { data: ridesData }] = await Promise.all([
        supabase.from('ambulances').select('*'),
        supabase.from('rides').select('*').in('status', ['dispatched', 'en_route']),
      ])
      if (ambData) setAmbulances(ambData as Ambulance[])
      if (ridesData) setActiveRides(ridesData as Ride[])
    }, 5000)

    return () => {
      supabase.removeChannel(ambChannel)
      supabase.removeChannel(ridesChannel)
      clearInterval(poll)
    }
  }, [])

  return (
    <div className="p-5 lg:p-7 space-y-4 h-screen flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-ambu-dark flex items-center gap-2">
            <MapPin className="w-6 h-6 text-ambu-red" />
            Live Tracking
          </h1>
          <p className="text-sm text-ambu-muted mt-0.5">Real-time ambulance positions · Updates every 5 seconds</p>
        </div>
        <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-full">
          <Wifi className="w-3.5 h-3.5" />
          Live
        </div>
      </div>

      {/* Main Layout */}
      <div className="flex flex-col lg:flex-row gap-4 flex-1 min-h-0">
        {/* Map */}
        <div className="flex-1 bg-white rounded-2xl border border-ambu-border shadow-sm overflow-hidden min-h-72">
          <MapComponent ambulances={ambulances} rides={activeRides} selected={selected} onSelect={setSelected} />
        </div>

        {/* Side Panel */}
        <div className="lg:w-72 xl:w-80 flex flex-col gap-4 overflow-y-auto">
          {/* Active Rides */}
          <div className="bg-white rounded-2xl border border-ambu-border shadow-sm p-4 flex-shrink-0">
            <h2 className="font-semibold text-ambu-dark text-sm flex items-center gap-2 mb-3">
              <span className="w-2 h-2 rounded-full bg-ambu-red animate-pulse" />
              Active Rides ({activeRides.length})
            </h2>

            {loading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20" />)}
              </div>
            ) : activeRides.length === 0 ? (
              <div className="text-center py-6 bg-ambu-bg rounded-xl">
                <p className="text-xs text-ambu-muted">No active rides at the moment</p>
              </div>
            ) : (
              <div className="space-y-3">
                {activeRides.map(ride => {
                  const progress = ride.status === 'en_route' ? 70 : 30
                  return (
                    <div key={ride.id} className="bg-ambu-bg rounded-xl p-3 border border-ambu-border">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-ambu-dark truncate">{ride.patient_name}</p>
                          <p className="text-xs text-ambu-muted mt-0.5 truncate">{ride.pickup_location}</p>
                        </div>
                        <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium border flex-shrink-0 ${
                          ride.urgency === 'Critical' ? 'bg-red-50 text-red-700 border-red-200' :
                          ride.urgency === 'Urgent' ? 'bg-orange-50 text-orange-700 border-orange-200' :
                          'bg-emerald-50 text-emerald-700 border-emerald-200'
                        }`}>{ride.urgency}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-ambu-muted mb-2">
                        <Navigation className="w-3 h-3 flex-shrink-0" />
                        <span className="truncate">{ride.destination}</span>
                      </div>
                      <div>
                        <div className="flex justify-between text-xs text-ambu-muted mb-1">
                          <span>{ride.status === 'en_route' ? 'En route' : 'Dispatched'}</span>
                          <span>{progress}%</span>
                        </div>
                        <div className="h-1.5 bg-ambu-border rounded-full overflow-hidden">
                          <div
                            className="h-full bg-ambu-red rounded-full transition-all duration-500"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Fleet Positions */}
          <div className="bg-white rounded-2xl border border-ambu-border shadow-sm p-4">
            <h2 className="font-semibold text-ambu-dark text-sm mb-3">Fleet Positions ({ambulances.length})</h2>
            {loading ? (
              <div className="space-y-2">
                {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-14" />)}
              </div>
            ) : (
              <div className="space-y-2">
                {ambulances.map(amb => (
                  <button
                    key={amb.id}
                    onClick={() => setSelected(selected?.id === amb.id ? null : amb)}
                    className={`w-full text-left p-3 rounded-xl border transition-all ${
                      selected?.id === amb.id
                        ? 'border-ambu-red bg-red-50'
                        : 'border-ambu-border bg-ambu-bg hover:border-ambu-muted/40'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-ambu-dark">{amb.code}</p>
                        <p className="text-xs text-ambu-muted truncate">{amb.driver_name}</p>
                      </div>
                      <StatusDot status={amb.status} />
                    </div>
                    <p className="text-xs text-ambu-muted/60 mt-1">
                      {Number(amb.lat).toFixed(4)}, {Number(amb.lng).toFixed(4)}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
