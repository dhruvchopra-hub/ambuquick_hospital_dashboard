'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Ride } from '@/types'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { Clock, Download, Filter, CheckCircle, AlertCircle, Search } from 'lucide-react'

const MONTHS = [
  'All Time', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const NEXT_STATUS: Record<string, string> = {
  pending: 'dispatched', dispatched: 'en_route', en_route: 'completed',
}
const NEXT_LABEL: Record<string, string> = {
  pending: 'Dispatch', dispatched: 'En Route', en_route: 'Complete',
}

function UrgencyBadge({ u }: { u: string }) {
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${
      u === 'Critical' ? 'bg-red-50 text-red-700 border-red-200' :
      u === 'Urgent' ? 'bg-orange-50 text-orange-700 border-orange-200' :
      'bg-emerald-50 text-emerald-700 border-emerald-200'
    }`}>{u}</span>
  )
}

function StatusBadge({ s }: { s: string }) {
  const styles: Record<string, string> = {
    completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    cancelled: 'bg-red-50 text-red-700 border-red-200',
    dispatched: 'bg-blue-50 text-blue-700 border-blue-200',
    en_route: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    pending: 'bg-amber-50 text-amber-700 border-amber-200',
  }
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${styles[s] || 'bg-gray-100 text-gray-600 border-gray-200'}`}>
      {s.charAt(0).toUpperCase() + s.slice(1).replace('_', ' ')}
    </span>
  )
}

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-ambu-border/60 rounded-lg ${className}`} />
}

function maskPhone(phone: string): string {
  if (!phone || phone.length < 7) return phone
  return phone.slice(0, 3) + '•••' + phone.slice(-4)
}

export default function RideHistoryPage() {
  const [rides, setRides] = useState<Ride[]>([])
  const [filtered, setFiltered] = useState<Ride[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedMonth, setSelectedMonth] = useState('All Time')
  const [search, setSearch] = useState('')
  const [updating, setUpdating] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase.from('rides').select('*').order('created_at', { ascending: false })
    if (data) { setRides(data as Ride[]); setFiltered(data as Ride[]) }
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  useEffect(() => {
    let result = rides
    if (selectedMonth !== 'All Time') {
      const monthIndex = MONTHS.indexOf(selectedMonth) - 1
      result = result.filter(r => new Date(r.created_at).getMonth() === monthIndex)
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(r =>
        r.patient_name.toLowerCase().includes(q) ||
        r.id.toLowerCase().includes(q)
      )
    }
    setFiltered(result)
  }, [selectedMonth, search, rides])

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

  const exportCSV = () => {
    const headers = ['Ride ID', 'Date', 'Patient Name', 'Phone', 'Pickup', 'Destination', 'Urgency', 'Driver', 'Response Time (min)', 'Status', 'Amount (₹)']
    const rows = filtered.map(r => [
      r.id.substring(0, 8).toUpperCase(),
      format(new Date(r.created_at), 'dd/MM/yyyy HH:mm'),
      r.patient_name, maskPhone(r.patient_phone),
      `"${r.pickup_location}"`, `"${r.destination}"`,
      r.urgency, r.driver_name || '—',
      r.response_time_minutes ?? '—', r.status, r.amount ?? 0,
    ])
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url
    a.download = `rides-${selectedMonth.toLowerCase().replace(' ', '-')}.csv`
    a.click(); URL.revokeObjectURL(url)
    toast.success('CSV exported')
  }

  const completedFiltered = filtered.filter(r => r.status === 'completed')
  const slaCompliance = completedFiltered.length > 0
    ? Math.round(completedFiltered.filter(r => (r.response_time_minutes ?? 99) <= 18).length / completedFiltered.length * 100)
    : 0

  return (
    <div className="p-5 lg:p-7 space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ambu-dark flex items-center gap-2">
            <Clock className="w-6 h-6 text-ambu-red" /> Ride History
          </h1>
          <p className="text-sm text-ambu-muted mt-0.5">Complete record of all ambulance dispatches</p>
        </div>
        <button
          onClick={exportCSV}
          className="flex items-center gap-1.5 bg-white border border-ambu-border hover:border-ambu-muted/60 text-ambu-dark text-xs font-medium px-3 py-2.5 rounded-xl transition flex-shrink-0"
        >
          <Download className="w-3.5 h-3.5" /> Export CSV
        </button>
      </div>

      {/* Search + Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-shrink-0 sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ambu-muted" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search patient name or ride ID…"
            className="w-full pl-9 pr-4 py-2.5 border border-ambu-border rounded-xl text-sm bg-white text-ambu-dark placeholder:text-ambu-muted/50 focus:outline-none focus:ring-2 focus:ring-ambu-red focus:border-transparent"
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="w-4 h-4 text-ambu-muted flex-shrink-0" />
          {MONTHS.slice(0, 7).map(m => (
            <button
              key={m}
              onClick={() => setSelectedMonth(m)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                selectedMonth === m
                  ? 'bg-ambu-red text-white'
                  : 'bg-white border border-ambu-border text-ambu-muted hover:border-ambu-muted/60'
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {loading ? (
          [...Array(4)].map((_, i) => <Skeleton key={i} className="h-20" />)
        ) : (
          [
            { label: 'Total Rides', value: filtered.length, color: 'text-ambu-dark' },
            { label: 'Completed', value: completedFiltered.length, color: 'text-ambu-success' },
            { label: 'Cancelled', value: filtered.filter(r => r.status === 'cancelled').length, color: 'text-ambu-red' },
            { label: 'SLA Compliance', value: `${slaCompliance}%`, color: slaCompliance >= 80 ? 'text-ambu-success' : 'text-ambu-red' },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-xl border border-ambu-border shadow-sm p-4 text-center">
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-ambu-muted mt-0.5">{s.label}</p>
            </div>
          ))
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-ambu-border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ambu-border bg-ambu-bg">
                {['Ride ID', 'Date & Time', 'Patient', 'Type', 'Driver', 'Response', 'Status', 'Amount', 'Actions'].map((h, i) => (
                  <th
                    key={h}
                    className={`px-4 py-3 text-xs font-semibold text-ambu-muted uppercase tracking-wide whitespace-nowrap ${i === 7 ? 'text-right' : 'text-left'}`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-ambu-border/50">
              {loading ? (
                [...Array(6)].map((_, i) => (
                  <tr key={i}>
                    {[...Array(9)].map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <Skeleton className="h-4 w-20" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-12 text-ambu-muted text-sm">
                    No rides found{search ? ` for "${search}"` : selectedMonth !== 'All Time' ? ` in ${selectedMonth}` : ''}
                  </td>
                </tr>
              ) : (
                filtered.map(ride => {
                  const rt = ride.response_time_minutes
                  const rtGood = rt !== null && rt <= 15
                  const rtOk = rt !== null && rt > 15 && rt <= 18
                  return (
                    <tr key={ride.id} className="hover:bg-ambu-bg/50 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs text-ambu-muted">
                        #{ride.id.substring(0, 8).toUpperCase()}
                      </td>
                      <td className="px-4 py-3 text-xs text-ambu-muted whitespace-nowrap">
                        {format(new Date(ride.created_at), 'dd MMM yyyy')}
                        <br />
                        <span className="text-ambu-muted/60">{format(new Date(ride.created_at), 'HH:mm')}</span>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-ambu-dark">{ride.patient_name}</p>
                        <p className="text-xs text-ambu-muted">{maskPhone(ride.patient_phone)}</p>
                      </td>
                      <td className="px-4 py-3"><UrgencyBadge u={ride.urgency} /></td>
                      <td className="px-4 py-3 text-xs text-ambu-dark font-medium">{ride.driver_name || '—'}</td>
                      <td className="px-4 py-3">
                        {rt !== null ? (
                          <span className={`flex items-center gap-1 text-xs font-bold ${
                            rtGood ? 'text-ambu-success' : rtOk ? 'text-ambu-warning' : 'text-ambu-red'
                          }`}>
                            {rtGood ? <CheckCircle className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                            {rt} min
                          </span>
                        ) : <span className="text-ambu-muted/40 text-xs">—</span>}
                      </td>
                      <td className="px-4 py-3"><StatusBadge s={ride.status} /></td>
                      <td className="px-4 py-3 text-right font-bold text-ambu-dark">
                        ₹{(ride.amount || 0).toLocaleString('en-IN')}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          {NEXT_STATUS[ride.status] && (
                            <button
                              onClick={() => updateStatus(ride, NEXT_STATUS[ride.status])}
                              disabled={updating === ride.id}
                              className="text-xs px-2.5 py-1 rounded-lg font-medium bg-ambu-bg hover:bg-ambu-dark hover:text-white text-ambu-dark border border-ambu-border transition disabled:opacity-50 whitespace-nowrap"
                            >
                              {updating === ride.id ? '…' : NEXT_LABEL[ride.status]}
                            </button>
                          )}
                          {['pending', 'dispatched'].includes(ride.status) && (
                            <button
                              onClick={() => updateStatus(ride, 'cancelled')}
                              disabled={updating === ride.id}
                              className="text-xs px-2.5 py-1 rounded-lg font-medium bg-red-50 hover:bg-red-100 text-ambu-red border border-red-200 transition disabled:opacity-50"
                            >
                              Cancel
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
        {!loading && filtered.length > 0 && (
          <div className="px-4 py-3 border-t border-ambu-border flex justify-between text-xs text-ambu-muted">
            <span>Showing {filtered.length} rides</span>
            <span className="font-semibold text-ambu-dark">
              Total: ₹{filtered.reduce((s, r) => s + (r.amount || 0), 0).toLocaleString('en-IN')}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
