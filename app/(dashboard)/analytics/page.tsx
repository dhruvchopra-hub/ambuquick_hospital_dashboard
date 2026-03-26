'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Ride, Ambulance } from '@/types'
import { format, startOfMonth, subMonths, startOfWeek } from 'date-fns'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, AreaChart, Area, Cell, PieChart, Pie, Legend,
} from 'recharts'
import { BarChart3, TrendingUp, Clock, Target, IndianRupee } from 'lucide-react'

type Preset = 'week' | 'month' | '3months' | 'all'

const PRESETS: { key: Preset; label: string }[] = [
  { key: 'week', label: 'This Week' },
  { key: 'month', label: 'This Month' },
  { key: '3months', label: 'Last 3 Months' },
  { key: 'all', label: 'All Time' },
]

function getRange(preset: Preset): { start: Date; end: Date } {
  const now = new Date()
  if (preset === 'week') return { start: startOfWeek(now, { weekStartsOn: 1 }), end: now }
  if (preset === 'month') return { start: startOfMonth(now), end: now }
  if (preset === '3months') return { start: startOfMonth(subMonths(now, 2)), end: now }
  return { start: new Date('2000-01-01'), end: now }
}

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-ambu-border/60 rounded-lg ${className}`} />
}

function ChartCard({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-ambu-border shadow-sm p-5">
      <h3 className="font-semibold text-ambu-dark text-sm">{title}</h3>
      <p className="text-xs text-ambu-muted mt-0.5 mb-4">{subtitle}</p>
      {children}
    </div>
  )
}

const TOOLTIP_STYLE = {
  contentStyle: { borderRadius: '10px', border: '1px solid #E5E2DC', fontSize: '12px', color: '#0F0F0F' },
  cursor: { fill: '#F8F7F4' },
}

export default function AnalyticsPage() {
  const [rides, setRides] = useState<Ride[]>([])
  const [ambulances, setAmbulances] = useState<Ambulance[]>([])
  const [loading, setLoading] = useState(true)
  const [preset, setPreset] = useState<Preset>('month')

  useEffect(() => {
    const supabase = createClient()
    async function load() {
      const [{ data: ridesData }, { data: ambsData }] = await Promise.all([
        supabase.from('rides').select('*'),
        supabase.from('ambulances').select('*'),
      ])
      if (ridesData) setRides(ridesData as Ride[])
      if (ambsData) setAmbulances(ambsData as Ambulance[])
      setLoading(false)
    }
    load()
  }, [])

  const { start, end } = getRange(preset)
  const filtered = useMemo(
    () => rides.filter(r => { const d = new Date(r.created_at); return d >= start && d <= end }),
    [rides, preset]
  )

  const completedRides = filtered.filter(r => r.status === 'completed')
  const totalRides = filtered.length
  const avgResponse = completedRides.filter(r => r.response_time_minutes).length > 0
    ? Math.round(completedRides.filter(r => r.response_time_minutes).reduce((s, r) => s + (r.response_time_minutes || 0), 0) / completedRides.filter(r => r.response_time_minutes).length)
    : 0
  const slaCompliance = completedRides.length > 0
    ? Math.round(completedRides.filter(r => (r.response_time_minutes || 99) <= 18).length / completedRides.length * 100)
    : 0
  const totalSpend = filtered.reduce((s, r) => s + (r.amount || 0), 0)

  const byUrgency = [
    { name: 'Critical', rides: filtered.filter(r => r.urgency === 'Critical').length, fill: '#D91A2A' },
    { name: 'Urgent', rides: filtered.filter(r => r.urgency === 'Urgent').length, fill: '#F97316' },
    { name: 'Scheduled', rides: filtered.filter(r => r.urgency === 'Scheduled').length, fill: '#2D6A2D' },
  ]

  const rtBreakdown = [
    { name: '< 10 min', count: completedRides.filter(r => (r.response_time_minutes || 0) < 10).length, fill: '#2D6A2D' },
    { name: '10–18 min', count: completedRides.filter(r => { const v = r.response_time_minutes || 0; return v >= 10 && v <= 18 }).length, fill: '#2D6A2D' },
    { name: '18–30 min', count: completedRides.filter(r => { const v = r.response_time_minutes || 0; return v > 18 && v <= 30 }).length, fill: '#92500A' },
    { name: '> 30 min', count: completedRides.filter(r => (r.response_time_minutes || 0) > 30).length, fill: '#D91A2A' },
  ]

  const fleetPerf = ambulances.map(amb => ({
    name: amb.code,
    rides: filtered.filter(r => r.ambulance_id === amb.id).length,
    avgRT: Math.round(
      completedRides.filter(r => r.ambulance_id === amb.id && r.response_time_minutes)
        .reduce((s, r) => s + (r.response_time_minutes || 0), 0) /
      (completedRides.filter(r => r.ambulance_id === amb.id && r.response_time_minutes).length || 1)
    ),
  }))

  const monthlySpend = Array.from({ length: 6 }, (_, i) => {
    const d = subMonths(new Date(), 5 - i)
    const s = startOfMonth(d)
    const e = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59)
    const mr = rides.filter(r => { const rd = new Date(r.created_at); return rd >= s && rd <= e })
    return { month: format(d, 'MMM'), spend: Math.round(mr.reduce((s, r) => s + (r.amount || 0), 0)), rides: mr.length }
  })

  const metrics = [
    {
      label: 'Total Rides', value: totalRides, suffix: '',
      icon: <TrendingUp className="w-5 h-5" />, iconBg: 'bg-blue-50', color: 'text-blue-600',
    },
    {
      label: 'Avg Response Time', value: avgResponse || '—', suffix: avgResponse ? ' min' : '',
      icon: <Clock className="w-5 h-5" />,
      iconBg: avgResponse <= 18 ? 'bg-emerald-50' : 'bg-red-50',
      color: avgResponse <= 18 ? 'text-ambu-success' : 'text-ambu-red',
    },
    {
      label: 'SLA Compliance', value: slaCompliance, suffix: '%',
      icon: <Target className="w-5 h-5" />,
      iconBg: slaCompliance >= 80 ? 'bg-emerald-50' : 'bg-amber-50',
      color: slaCompliance >= 80 ? 'text-ambu-success' : 'text-ambu-warning',
    },
    {
      label: 'Total Spend', value: `₹${(totalSpend / 1000).toFixed(0)}K`, suffix: '',
      icon: <IndianRupee className="w-5 h-5" />, iconBg: 'bg-violet-50', color: 'text-violet-600',
    },
  ]

  return (
    <div className="p-5 lg:p-7 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ambu-dark flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-ambu-red" /> Analytics
          </h1>
          <p className="text-sm text-ambu-muted mt-0.5">Performance insights and service metrics</p>
        </div>
        <div className="flex items-center gap-1 bg-white border border-ambu-border rounded-xl p-1">
          {PRESETS.map(p => (
            <button
              key={p.key}
              onClick={() => setPreset(p.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                preset === p.key ? 'bg-ambu-red text-white shadow-sm' : 'text-ambu-muted hover:text-ambu-dark'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {loading
          ? [...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)
          : metrics.map(m => (
            <div key={m.label} className="bg-white rounded-2xl border border-ambu-border shadow-sm p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-ambu-muted uppercase tracking-wide">{m.label}</p>
                  <p className={`text-2xl font-bold mt-1 ${m.color}`}>{m.value}{m.suffix}</p>
                </div>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${m.iconBg} ${m.color}`}>
                  {m.icon}
                </div>
              </div>
            </div>
          ))
        }
      </div>

      {/* Row 2: Urgency + RT Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <ChartCard title="Rides by Urgency Type" subtitle="Distribution across urgency levels">
          {loading ? <Skeleton className="h-52" /> : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={byUrgency} barSize={40}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E2DC" />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#6B6560' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: '#6B6560' }} axisLine={false} tickLine={false} />
                <Tooltip {...TOOLTIP_STYLE} />
                <Bar dataKey="rides" name="Rides" radius={[6, 6, 0, 0]}>
                  {byUrgency.map((e, i) => <Cell key={i} fill={e.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Response Time Distribution" subtitle="How fast ambulances are reaching patients">
          {loading ? <Skeleton className="h-52" /> : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={rtBreakdown} barSize={40}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E2DC" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#6B6560' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: '#6B6560' }} axisLine={false} tickLine={false} />
                <Tooltip {...TOOLTIP_STYLE} />
                <Bar dataKey="count" name="Rides" radius={[6, 6, 0, 0]}>
                  {rtBreakdown.map((e, i) => <Cell key={i} fill={e.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      {/* Row 3: Fleet Performance + Rides by Type donut */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <ChartCard title="Fleet Performance" subtitle="Total rides and avg response time per vehicle">
          {loading ? <Skeleton className="h-52" /> : fleetPerf.length === 0 ? (
            <div className="h-52 flex items-center justify-center text-ambu-muted text-sm">No fleet data</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={fleetPerf} barSize={24}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E2DC" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#6B6560' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: '#6B6560' }} axisLine={false} tickLine={false} />
                <Tooltip {...TOOLTIP_STYLE} />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Bar dataKey="rides" name="Total Rides" fill="#D91A2A" radius={[4, 4, 0, 0]} />
                <Bar dataKey="avgRT" name="Avg RT (min)" fill="#E5E2DC" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Rides by Urgency — Donut" subtitle="Share of each urgency type in selected period">
          {loading ? <Skeleton className="h-52" /> : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={byUrgency}
                  dataKey="rides"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  innerRadius={50}
                  paddingAngle={3}
                >
                  {byUrgency.map((e, i) => <Cell key={i} fill={e.fill} />)}
                </Pie>
                <Tooltip {...TOOLTIP_STYLE} />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      {/* Row 4: Monthly Spend Trend */}
      <ChartCard title="Monthly Spend Trend" subtitle="Total billing over the last 6 months">
        {loading ? <Skeleton className="h-52" /> : (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={monthlySpend}>
              <defs>
                <linearGradient id="spendGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#D91A2A" stopOpacity={0.12} />
                  <stop offset="95%" stopColor="#D91A2A" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E2DC" />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#6B6560' }} axisLine={false} tickLine={false} />
              <YAxis
                tick={{ fontSize: 11, fill: '#6B6560' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={v => `₹${v / 1000}K`}
              />
              <Tooltip
                contentStyle={{ borderRadius: '10px', border: '1px solid #E5E2DC', fontSize: '12px' }}
                formatter={(v: number) => [`₹${v.toLocaleString('en-IN')}`, 'Spend']}
                cursor={{ fill: '#F8F7F4' }}
              />
              <Area
                type="monotone"
                dataKey="spend"
                name="Spend"
                stroke="#D91A2A"
                strokeWidth={2.5}
                fill="url(#spendGrad)"
                dot={{ fill: '#D91A2A', strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      {/* SLA Tracker */}
      <div className="bg-white rounded-2xl border border-ambu-border shadow-sm p-6">
        <h3 className="font-semibold text-ambu-dark">SLA Compliance Tracker</h3>
        <p className="text-xs text-ambu-muted mt-0.5 mb-5">
          Target: ≥80% rides completed within 18 minutes · {PRESETS.find(p => p.key === preset)?.label}
        </p>
        <div className="flex items-center gap-4">
          <div className="flex-1 h-3 bg-ambu-bg border border-ambu-border rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-1000 ${
                slaCompliance >= 80 ? 'bg-ambu-success' : slaCompliance >= 60 ? 'bg-amber-500' : 'bg-ambu-red'
              }`}
              style={{ width: `${slaCompliance}%` }}
            />
          </div>
          <span className={`font-bold text-lg w-14 text-right ${
            slaCompliance >= 80 ? 'text-ambu-success' : slaCompliance >= 60 ? 'text-amber-600' : 'text-ambu-red'
          }`}>
            {slaCompliance}%
          </span>
        </div>
        <div className="flex justify-between text-xs text-ambu-muted mt-2">
          <span>0%</span>
          <span className="text-amber-600 font-medium">Target: 80%</span>
          <span>100%</span>
        </div>
      </div>
    </div>
  )
}
