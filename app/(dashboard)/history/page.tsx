'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Ride } from '@/types'
import { format } from 'date-fns'
import { Clock, Download, Filter, CheckCircle, AlertCircle } from 'lucide-react'

const MONTHS = [
  'All Time', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

function UrgencyBadge({ u }: { u: string }) {
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
      u === 'Critical' ? 'bg-red-100 text-red-700' : u === 'Urgent' ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'
    }`}>{u}</span>
  )
}

function StatusBadge({ s }: { s: string }) {
  const map: Record<string, string> = {
    completed: 'bg-green-100 text-green-700', cancelled: 'bg-red-100 text-red-700',
    dispatched: 'bg-blue-100 text-blue-700', en_route: 'bg-indigo-100 text-indigo-700', pending: 'bg-yellow-100 text-yellow-700',
  }
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${map[s] || 'bg-gray-100 text-gray-600'}`}>
      {s.charAt(0).toUpperCase() + s.slice(1).replace('_', ' ')}
    </span>
  )
}

export default function RideHistoryPage() {
  const [rides, setRides] = useState<Ride[]>([])
  const [filtered, setFiltered] = useState<Ride[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedMonth, setSelectedMonth] = useState('All Time')

  useEffect(() => {
    const supabase = createClient()
    async function loadData() {
      try {
        const { data } = await supabase
          .from('rides')
          .select('*')
          .order('created_at', { ascending: false })
        if (data) {
          setRides(data as Ride[])
          setFiltered(data as Ride[])
        }
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  useEffect(() => {
    if (selectedMonth === 'All Time') {
      setFiltered(rides)
    } else {
      const monthIndex = MONTHS.indexOf(selectedMonth) - 1
      setFiltered(rides.filter(r => new Date(r.created_at).getMonth() === monthIndex))
    }
  }, [selectedMonth, rides])

  const exportCSV = () => {
    const headers = ['Ride ID', 'Date', 'Patient Name', 'Phone', 'Pickup', 'Destination', 'Urgency', 'Driver', 'Response Time (min)', 'Status', 'Amount (₹)']
    const rows = filtered.map(r => [
      r.id.substring(0, 8).toUpperCase(),
      format(new Date(r.created_at), 'dd/MM/yyyy HH:mm'),
      r.patient_name, r.patient_phone,
      `"${r.pickup_location}"`, `"${r.destination}"`,
      r.urgency, r.driver_name || '—',
      r.response_time_minutes ?? '—', r.status, r.amount ?? 0,
    ])
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `rides-${selectedMonth.toLowerCase().replace(' ', '-')}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) {
    return (
      <div className="p-6 lg:p-8 flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-ambu-red border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const slaCompliance = filtered.filter(r => r.status === 'completed').length > 0
    ? Math.round(
        filtered.filter(r => r.status === 'completed' && (r.response_time_minutes || 0) <= 18).length /
        filtered.filter(r => r.status === 'completed').length * 100
      )
    : 0

  return (
    <div className="p-6 lg:p-8 space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Clock className="w-6 h-6 text-ambu-red" /> Ride History
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">Complete record of all ambulance dispatches</p>
      </div>

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="w-4 h-4 text-gray-400" />
          {MONTHS.map(m => (
            <button key={m} onClick={() => setSelectedMonth(m)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${selectedMonth === m ? 'bg-ambu-red text-white shadow-sm' : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-300'}`}>
              {m}
            </button>
          ))}
        </div>
        <button onClick={exportCSV} className="flex items-center gap-1.5 bg-white border border-gray-200 hover:border-gray-300 text-gray-700 text-xs font-medium px-3 py-2 rounded-lg transition-all">
          <Download className="w-3.5 h-3.5" /> Export CSV
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Rides', value: filtered.length, color: 'text-gray-900' },
          { label: 'Completed', value: filtered.filter(r => r.status === 'completed').length, color: 'text-green-600' },
          { label: 'Cancelled', value: filtered.filter(r => r.status === 'cancelled').length, color: 'text-red-600' },
          { label: 'SLA Compliance', value: `${slaCompliance}%`, color: slaCompliance >= 80 ? 'text-green-600' : 'text-red-600' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 text-center">
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                {['Ride ID', 'Date & Time', 'Patient', 'Type', 'Driver', 'Response', 'Status', 'Amount'].map((h, i) => (
                  <th key={h} className={`px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide ${i === 7 ? 'text-right' : 'text-left'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-12 text-gray-400 text-sm">No rides found for {selectedMonth}</td></tr>
              ) : (
                filtered.map(ride => {
                  const rt = ride.response_time_minutes
                  const rtOk = rt !== null && rt <= 18
                  return (
                    <tr key={ride.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs text-gray-500">#{ride.id.substring(0, 8).toUpperCase()}</td>
                      <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">
                        {format(new Date(ride.created_at), 'dd MMM yyyy')}<br />
                        <span className="text-gray-400">{format(new Date(ride.created_at), 'HH:mm')}</span>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{ride.patient_name}</p>
                        <p className="text-xs text-gray-400">{ride.patient_phone}</p>
                      </td>
                      <td className="px-4 py-3"><UrgencyBadge u={ride.urgency} /></td>
                      <td className="px-4 py-3 text-xs text-gray-600 font-medium">{ride.driver_name || '—'}</td>
                      <td className="px-4 py-3">
                        {rt !== null ? (
                          <span className={`flex items-center gap-1 text-xs font-semibold ${rtOk ? 'text-green-600' : 'text-red-600'}`}>
                            {rtOk ? <CheckCircle className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                            {rt} min
                          </span>
                        ) : <span className="text-gray-300 text-xs">—</span>}
                      </td>
                      <td className="px-4 py-3"><StatusBadge s={ride.status} /></td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-900">₹{(ride.amount || 0).toLocaleString('en-IN')}</td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
        {filtered.length > 0 && (
          <div className="px-4 py-3 border-t border-gray-50 flex justify-between text-xs text-gray-400">
            <span>Showing {filtered.length} rides</span>
            <span>Total: ₹{filtered.reduce((s, r) => s + (r.amount || 0), 0).toLocaleString('en-IN')}</span>
          </div>
        )}
      </div>
    </div>
  )
}
