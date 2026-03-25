'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Ride, Ambulance } from '@/types'
import { format, startOfMonth, subMonths } from 'date-fns'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, AreaChart, Area, Cell
} from 'recharts'
import { BarChart3, TrendingUp, Clock, Target, IndianRupee } from 'lucide-react'

export default function AnalyticsPage() {
  const [rides, setRides] = useState<Ride[]>([])
  const [ambulances, setAmbulances] = useState<Ambulance[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    async function loadData() {
      try {
        const [{ data: ridesData }, { data: ambsData }] = await Promise.all([
          supabase.from('rides').select('*'),
          supabase.from('ambulances').select('*'),
        ])
        if (ridesData) setRides(ridesData as Ride[])
        if (ambsData) setAmbulances(ambsData as Ambulance[])
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  if (loading) {
    return (
      <div className="p-6 lg:p-8 flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-ambu-red border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const completedRides = rides.filter(r => r.status === 'completed')
  const totalRides = rides.length
  const avgResponse = completedRides.length > 0
    ? Math.round(completedRides.filter(r => r.response_time_minutes).reduce((s, r) => s + (r.response_time_minutes || 0), 0) / completedRides.filter(r => r.response_time_minutes).length)
    : 0
  const slaCompliance = completedRides.length > 0
    ? Math.round(completedRides.filter(r => (r.response_time_minutes || 99) <= 18).length / completedRides.length * 100)
    : 0
  const totalSpend = rides.reduce((s, r) => s + (r.amount || 0), 0)

  const byUrgency = [
    { name: 'Critical', rides: rides.filter(r => r.urgency === 'Critical').length, fill: '#D91A2A' },
    { name: 'Urgent', rides: rides.filter(r => r.urgency === 'Urgent').length, fill: '#F97316' },
    { name: 'Scheduled', rides: rides.filter(r => r.urgency === 'Scheduled').length, fill: '#22C55E' },
  ]

  const rtBreakdown = [
    { name: '< 10 min', count: completedRides.filter(r => (r.response_time_minutes || 0) < 10).length },
    { name: '10-18 min', count: completedRides.filter(r => (r.response_time_minutes || 0) >= 10 && (r.response_time_minutes || 0) <= 18).length },
    { name: '18-30 min', count: completedRides.filter(r => (r.response_time_minutes || 0) > 18 && (r.response_time_minutes || 0) <= 30).length },
    { name: '> 30 min', count: completedRides.filter(r => (r.response_time_minutes || 0) > 30).length },
  ]

  const fleetPerf = ambulances.map(amb => ({
    name: amb.code,
    rides: rides.filter(r => r.ambulance_id === amb.id).length,
    avgRT: Math.round(
      completedRides.filter(r => r.ambulance_id === amb.id && r.response_time_minutes).reduce((s, r) => s + (r.response_time_minutes || 0), 0) /
      (completedRides.filter(r => r.ambulance_id === amb.id && r.response_time_minutes).length || 1)
    ),
  }))

  const monthlySpend = Array.from({ length: 6 }, (_, i) => {
    const d = subMonths(new Date(), 5 - i)
    const start = startOfMonth(d)
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59)
    const monthRides = rides.filter(r => { const rd = new Date(r.created_at); return rd >= start && rd <= end })
    return { month: format(d, 'MMM'), spend: Math.round(monthRides.reduce((s, r) => s + (r.amount || 0), 0)), rides: monthRides.length }
  })

  const metrics = [
    { label: 'Total Rides', value: totalRides, icon: <TrendingUp className="w-5 h-5" />, color: 'blue', suffix: '' },
    { label: 'Avg Response Time', value: avgResponse || '—', icon: <Clock className="w-5 h-5" />, color: avgResponse <= 18 ? 'green' : 'red', suffix: avgResponse ? ' min' : '' },
    { label: 'SLA Compliance', value: slaCompliance, icon: <Target className="w-5 h-5" />, color: slaCompliance >= 80 ? 'green' : 'orange', suffix: '%' },
    { label: 'Total Spend', value: `₹${(totalSpend / 1000).toFixed(0)}K`, icon: <IndianRupee className="w-5 h-5" />, color: 'purple', suffix: '' },
  ]

  const colorMap: Record<string, { bg: string; text: string; icon: string }> = {
    blue: { bg: 'bg-blue-50', text: 'text-blue-600', icon: 'bg-blue-100 text-blue-600' },
    green: { bg: 'bg-green-50', text: 'text-green-600', icon: 'bg-green-100 text-green-600' },
    red: { bg: 'bg-red-50', text: 'text-red-600', icon: 'bg-red-100 text-red-600' },
    orange: { bg: 'bg-orange-50', text: 'text-orange-600', icon: 'bg-orange-100 text-orange-600' },
    purple: { bg: 'bg-purple-50', text: 'text-purple-600', icon: 'bg-purple-100 text-purple-600' },
  }

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><BarChart3 className="w-6 h-6 text-ambu-red" /> Analytics</h1>
        <p className="text-sm text-gray-500 mt-0.5">Performance insights and service metrics</p>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {metrics.map(m => {
          const c = colorMap[m.color]
          return (
            <div key={m.label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">{m.label}</p>
                  <p className={`text-2xl font-bold mt-1 ${c.text}`}>{m.value}{m.suffix}</p>
                </div>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${c.icon}`}>{m.icon}</div>
              </div>
            </div>
          )
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <ChartCard title="Rides by Urgency Type" subtitle="Distribution across urgency levels">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={byUrgency} barSize={40}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#64748B' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: '#64748B' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #E2E8F0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }} cursor={{ fill: '#F8FAFC' }} />
              <Bar dataKey="rides" radius={[6, 6, 0, 0]}>
                {byUrgency.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Response Time Breakdown" subtitle="How fast are ambulances reaching patients">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={rtBreakdown} barSize={40}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: '#64748B' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #E2E8F0' }} cursor={{ fill: '#F8FAFC' }} />
              <Bar dataKey="count" name="Rides" radius={[6, 6, 0, 0]}>
                {rtBreakdown.map((_, i) => <Cell key={i} fill={i < 2 ? '#22C55E' : i === 2 ? '#F97316' : '#EF4444'} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <ChartCard title="Fleet Performance" subtitle="Total rides handled per ambulance">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={fleetPerf} barSize={32}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: '#64748B' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #E2E8F0' }} cursor={{ fill: '#F8FAFC' }} />
              <Legend />
              <Bar dataKey="rides" name="Total Rides" fill="#D91A2A" radius={[6, 6, 0, 0]} />
              <Bar dataKey="avgRT" name="Avg RT (min)" fill="#93C5FD" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Monthly Spend Trend" subtitle="Total billing over the last 6 months">
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={monthlySpend}>
              <defs>
                <linearGradient id="spendGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#D91A2A" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#D91A2A" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#64748B' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} tickFormatter={v => `₹${v / 1000}K`} />
              <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #E2E8F0' }} formatter={(v: number) => [`₹${v.toLocaleString('en-IN')}`, 'Spend']} cursor={{ fill: '#F8FAFC' }} />
              <Area type="monotone" dataKey="spend" name="Spend (₹)" stroke="#D91A2A" strokeWidth={2.5} fill="url(#spendGrad)" dot={{ fill: '#D91A2A', strokeWidth: 2, r: 4 }} activeDot={{ r: 6 }} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h3 className="font-semibold text-gray-900 mb-1">SLA Compliance Tracker</h3>
        <p className="text-xs text-gray-400 mb-5">Target: ≥80% rides completed within 18 minutes</p>
        <div className="flex items-center gap-4">
          <div className="flex-1 h-4 bg-gray-100 rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all duration-1000 ${slaCompliance >= 80 ? 'bg-green-500' : slaCompliance >= 60 ? 'bg-orange-500' : 'bg-red-500'}`} style={{ width: `${slaCompliance}%` }} />
          </div>
          <span className={`font-bold text-lg w-14 text-right ${slaCompliance >= 80 ? 'text-green-600' : slaCompliance >= 60 ? 'text-orange-600' : 'text-red-600'}`}>{slaCompliance}%</span>
        </div>
        <div className="flex justify-between text-xs text-gray-400 mt-1.5">
          <span>0%</span><span className="text-orange-500">Target: 80%</span><span>100%</span>
        </div>
      </div>
    </div>
  )
}

function ChartCard({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <h3 className="font-semibold text-gray-900 text-sm">{title}</h3>
      <p className="text-xs text-gray-400 mt-0.5 mb-4">{subtitle}</p>
      {children}
    </div>
  )
}
