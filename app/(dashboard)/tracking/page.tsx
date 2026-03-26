'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { createClient } from '@/lib/supabase/client'
import { Ambulance, Ride } from '@/types'
import { Loader2, MapPin, Navigation } from 'lucide-react'

const MapComponent = dynamic(() => import('./MapComponent'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-gray-100 flex items-center justify-center rounded-xl">
      <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
    </div>
  ),
})

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    available: 'bg-green-100 text-green-700', on_trip: 'bg-blue-100 text-blue-700',
    maintenance: 'bg-yellow-100 text-yellow-700', offline: 'bg-gray-100 text-gray-600',
  }
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${map[status] || 'bg-gray-100 text-gray-600'}`}>
      {status === 'on_trip' ? 'On Trip' : status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  )
}

export default function TrackingPage() {
  const [ambulances, setAmbulances] = useState<Ambulance[]>([])
  const [activeRides, setActiveRides] = useState<Ride[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Ambulance | null>(null)

  useEffect(() => {
    const supabase = createClient()

    async function init() {
      try {
        const [{ data: ambData }, { data: ridesData }] = await Promise.all([
          supabase.from('ambulances').select('*'),
          supabase.from('rides').select('*').in('status', ['dispatched', 'en_route']),
        ])
        if (ambData) setAmbulances(ambData as Ambulance[])
        if (ridesData) setActiveRides(ridesData as Ride[])

      } finally {
        setLoading(false)
      }
    }

    init()

    // Realtime ambulance positions
    const ambChannel = supabase
      .channel('tracking-ambulances')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ambulances' }, async () => {
        const { data } = await supabase.from('ambulances').select('*')
        if (data) setAmbulances(data as Ambulance[])
      })
      .subscribe()

    // Realtime active rides
    const ridesChannel = supabase
      .channel('tracking-rides')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rides' }, async () => {
        const { data } = await supabase.from('rides').select('*').in('status', ['dispatched', 'en_route'])
        if (data) setActiveRides(data as Ride[])
      })
      .subscribe()

    // Polling fallback every 5 seconds
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


  if (loading) {
    return (
      <div className="p-6 lg:p-8 flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-ambu-red border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className="text-sm text-gray-500">Loading tracking data…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 lg:p-8 space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <MapPin className="w-6 h-6 text-ambu-red" /> Live Tracking
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">Real-time ambulance positions · Updates every 8 seconds</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-4" style={{ height: '65vh' }}>
        <div className="flex-1 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden relative min-h-[300px]">
          <MapComponent ambulances={ambulances} rides={activeRides} selected={selected} onSelect={setSelected} />
        </div>

        <div className="lg:w-72 xl:w-80 flex flex-col gap-3 overflow-y-auto">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <h2 className="font-semibold text-gray-900 text-sm mb-3 flex items-center gap-1.5">
              <Navigation className="w-4 h-4 text-ambu-red" /> Active Rides ({activeRides.length})
            </h2>
            {activeRides.length === 0 ? (
              <p className="text-xs text-gray-400 py-2">No active rides at the moment</p>
            ) : (
              <div className="space-y-3">
                {activeRides.map(ride => {
                  const progress = ride.status === 'en_route' ? 70 : 30
                  return (
                    <div key={ride.id} className="bg-gray-50 rounded-xl p-3">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{ride.patient_name}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{ride.pickup_location}</p>
                        </div>
                        <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 ${
                          ride.urgency === 'Critical' ? 'bg-red-100 text-red-700' :
                          ride.urgency === 'Urgent' ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'
                        }`}>{ride.urgency}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
                        <Navigation className="w-3 h-3" />
                        <span className="truncate">{ride.destination}</span>
                      </div>
                      <div>
                        <div className="flex justify-between text-xs text-gray-400 mb-1">
                          <span>{ride.status === 'en_route' ? 'En route' : 'Dispatched'}</span>
                          <span>{progress}%</span>
                        </div>
                        <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                          <div className="h-full bg-ambu-red rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <h2 className="font-semibold text-gray-900 text-sm mb-3">Fleet Positions</h2>
            <div className="space-y-2">
              {ambulances.map(amb => (
                <button key={amb.id} onClick={() => setSelected(amb)}
                  className={`w-full text-left p-3 rounded-xl border transition-all ${selected?.id === amb.id ? 'border-ambu-red bg-red-50' : 'border-gray-100 bg-gray-50 hover:border-gray-200'}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{amb.code}</p>
                      <p className="text-xs text-gray-400">{amb.driver_name}</p>
                    </div>
                    <StatusBadge status={amb.status} />
                  </div>
                  <p className="text-xs text-gray-400 mt-1">{Number(amb.lat).toFixed(4)}, {Number(amb.lng).toFixed(4)}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
