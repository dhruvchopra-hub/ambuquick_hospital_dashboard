'use client'

import dynamic from 'next/dynamic'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import { Building2, TrendingDown, TrendingUp, Activity, MapPin } from 'lucide-react'

const GroupMap = dynamic(() => import('./GroupMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-ambu-bg flex items-center justify-center rounded-xl">
      <div className="w-6 h-6 border-2 border-ambu-red border-t-transparent rounded-full animate-spin" />
    </div>
  ),
})

interface Unit {
  name: string; shortName: string; state: string
  ambulances: number; avgResponse: number; sla: number; rides: number
  perf: 'good' | 'ok' | 'poor'
}

const UNITS: Unit[] = [
  { name: 'Nangloi Delhi',        shortName: 'Nangloi',       state: 'Delhi',   ambulances: 8, avgResponse: 14.2, sla: 88, rides: 47, perf: 'good' },
  { name: 'Rama Vihar Delhi',     shortName: 'Rama Vihar',    state: 'Delhi',   ambulances: 6, avgResponse: 16.8, sla: 75, rides: 31, perf: 'ok'   },
  { name: 'Karnal Haryana',       shortName: 'Karnal',        state: 'Haryana', ambulances: 5, avgResponse: 13.1, sla: 92, rides: 28, perf: 'good' },
  { name: 'Panipat Haryana',      shortName: 'Panipat',       state: 'Haryana', ambulances: 4, avgResponse: 17.4, sla: 71, rides: 22, perf: 'ok'   },
  { name: 'Sonipat Haryana',      shortName: 'Sonipat',       state: 'Haryana', ambulances: 4, avgResponse: 19.3, sla: 62, rides: 18, perf: 'poor' },
  { name: 'Kurukshetra Haryana',  shortName: 'Kurukshetra',   state: 'Haryana', ambulances: 3, avgResponse: 15.6, sla: 80, rides: 15, perf: 'good' },
  { name: 'Bahadurgarh Haryana',  shortName: 'Bahadurgarh',   state: 'Haryana', ambulances: 3, avgResponse: 18.1, sla: 67, rides: 21, perf: 'poor' },
  { name: 'Varanasi UP',          shortName: 'Varanasi',      state: 'UP',      ambulances: 5, avgResponse: 16.2, sla: 78, rides: 33, perf: 'ok'   },
  { name: 'Kanpur UP',            shortName: 'Kanpur',        state: 'UP',      ambulances: 4, avgResponse: 20.7, sla: 58, rides: 26, perf: 'poor' },
]

const PERF_STYLE: Record<string, string> = {
  good: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  ok:   'bg-amber-50 text-amber-700 border-amber-200',
  poor: 'bg-red-50 text-red-700 border-red-200',
}
const PERF_BAR: Record<string, string> = {
  good: '#16a34a', ok: '#d97706', poor: '#dc2626',
}
const PERF_LABEL: Record<string, string> = {
  good: 'On Track', ok: 'Needs Attention', poor: 'Critical',
}

const sorted = [...UNITS].sort((a, b) => a.avgResponse - b.avgResponse)
const best3 = sorted.slice(0, 3)
const worst3 = sorted.slice(-3).reverse()

const totalRides = UNITS.reduce((s, u) => s + u.rides, 0)
const avgSLA = Math.round(UNITS.reduce((s, u) => s + u.sla, 0) / UNITS.length)
const avgRT = (UNITS.reduce((s, u) => s + u.avgResponse, 0) / UNITS.length).toFixed(1)
const totalAmb = UNITS.reduce((s, u) => s + u.ambulances, 0)

const chartData = [...UNITS]
  .sort((a, b) => a.avgResponse - b.avgResponse)
  .map(u => ({ name: u.shortName, response: u.avgResponse, perf: u.perf }))

export default function GroupOverviewPage() {
  return (
    <div className="p-5 lg:p-7 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ambu-dark flex items-center gap-2">
            <Building2 className="w-6 h-6 text-ambu-red" /> Group Overview
          </h1>
          <p className="text-sm text-ambu-muted mt-0.5">Ujala Cygnus network · 9 hospital units · All States</p>
        </div>
        <span className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold bg-violet-50 border border-violet-200 text-violet-700">
          Corporate View
        </span>
      </div>

      {/* Network KPIs */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        {[
          { label: 'Total Units', value: UNITS.length, sub: 'Across Delhi, Haryana, UP', color: 'text-ambu-dark', icon: <Building2 className="w-5 h-5" />, iconBg: 'bg-violet-50 text-violet-600' },
          { label: 'Network Fleet', value: totalAmb, sub: 'Active ambulances', color: 'text-blue-600', icon: <Activity className="w-5 h-5" />, iconBg: 'bg-blue-50 text-blue-600' },
          { label: 'Avg Response Time', value: `${avgRT} min`, sub: avgRT <= '18' ? 'Within SLA ✓' : 'Above SLA target', color: Number(avgRT) <= 18 ? 'text-emerald-600' : 'text-ambu-red', icon: <TrendingUp className="w-5 h-5" />, iconBg: Number(avgRT) <= 18 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-ambu-red' },
          { label: 'Network SLA', value: `${avgSLA}%`, sub: `${totalRides} rides this month`, color: avgSLA >= 75 ? 'text-emerald-600' : 'text-ambu-red', icon: <TrendingDown className="w-5 h-5" />, iconBg: avgSLA >= 75 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-ambu-red' },
        ].map(m => (
          <div key={m.label} className="bg-white rounded-2xl border border-ambu-border shadow-sm p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-ambu-muted uppercase tracking-wide">{m.label}</p>
                <p className={`text-2xl font-bold mt-1 ${m.color}`}>{m.value}</p>
                <p className="text-xs text-ambu-muted mt-1">{m.sub}</p>
              </div>
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${m.iconBg}`}>
                {m.icon}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* All Units Table */}
      <div className="bg-white rounded-2xl border border-ambu-border shadow-sm overflow-hidden">
        <div className="px-5 pt-4 pb-3 border-b border-ambu-border">
          <h2 className="font-semibold text-ambu-dark text-sm">All Hospital Units</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ambu-border bg-ambu-bg">
                {['Unit Name', 'State', 'Active Ambulances', 'Avg Response Time', 'SLA Compliance', 'Rides This Month', 'Status'].map((h, i) => (
                  <th key={h} className={`px-4 py-3 text-xs font-semibold text-ambu-muted uppercase tracking-wide whitespace-nowrap ${i >= 2 ? 'text-right' : 'text-left'}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-ambu-border/50">
              {UNITS.map(u => (
                <tr key={u.name} className="hover:bg-ambu-bg/50 transition-colors">
                  <td className="px-4 py-3 font-semibold text-ambu-dark">{u.name}</td>
                  <td className="px-4 py-3 text-xs text-ambu-muted">{u.state}</td>
                  <td className="px-4 py-3 text-right font-bold text-ambu-dark">{u.ambulances}</td>
                  <td className={`px-4 py-3 text-right font-bold ${u.avgResponse <= 15 ? 'text-emerald-600' : u.avgResponse <= 18 ? 'text-amber-600' : 'text-ambu-red'}`}>
                    {u.avgResponse} min
                  </td>
                  <td className={`px-4 py-3 text-right font-bold ${u.sla >= 80 ? 'text-emerald-600' : u.sla >= 70 ? 'text-amber-600' : 'text-ambu-red'}`}>
                    {u.sla}%
                  </td>
                  <td className="px-4 py-3 text-right text-ambu-dark">{u.rides}</td>
                  <td className="px-4 py-3 text-right">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${PERF_STYLE[u.perf]}`}>
                      {PERF_LABEL[u.perf]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Best + Worst + Chart */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* Best Performers */}
        <div className="bg-white rounded-2xl border border-ambu-border shadow-sm p-5">
          <h2 className="font-semibold text-ambu-dark text-sm flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4 text-emerald-600" /> Best Performing Units
          </h2>
          <div className="space-y-3">
            {best3.map((u, i) => (
              <div key={u.name} className="flex items-center gap-3 bg-emerald-50/50 rounded-xl border border-emerald-100 p-3">
                <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-bold text-emerald-700">#{i + 1}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-ambu-dark truncate">{u.name}</p>
                  <p className="text-xs text-ambu-muted">{u.avgResponse} min avg · {u.sla}% SLA</p>
                </div>
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 flex-shrink-0" />
              </div>
            ))}
          </div>
        </div>

        {/* Worst Performers */}
        <div className="bg-white rounded-2xl border border-ambu-border shadow-sm p-5">
          <h2 className="font-semibold text-ambu-dark text-sm flex items-center gap-2 mb-4">
            <TrendingDown className="w-4 h-4 text-ambu-red" /> Worst Performing Units
          </h2>
          <div className="space-y-3">
            {worst3.map((u, i) => (
              <div key={u.name} className="flex items-center gap-3 bg-red-50/50 rounded-xl border border-red-100 p-3">
                <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-bold text-red-700">#{i + 1}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-ambu-dark truncate">{u.name}</p>
                  <p className="text-xs text-ambu-muted">{u.avgResponse} min avg · {u.sla}% SLA</p>
                </div>
                <span className="w-2.5 h-2.5 rounded-full bg-ambu-red flex-shrink-0" />
              </div>
            ))}
          </div>
        </div>

        {/* Response Time Bar Chart */}
        <div className="bg-white rounded-2xl border border-ambu-border shadow-sm p-5">
          <h2 className="font-semibold text-ambu-dark text-sm mb-1">Cross-Unit Response Time</h2>
          <p className="text-xs text-ambu-muted mb-3">Average minutes per unit</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData} margin={{ top: 0, right: 5, left: -20, bottom: 30 }} barSize={14}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F0EDEB" vertical={false} />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 9, fill: '#9B9490' }}
                tickLine={false}
                interval={0}
                angle={-35}
                textAnchor="end"
                label={{ value: 'Unit', position: 'insideBottom', offset: -22, fontSize: 10, fill: '#9B9490' }}
              />
              <YAxis
                tick={{ fontSize: 9, fill: '#9B9490' }}
                tickLine={false}
                axisLine={false}
                label={{ value: 'Min', angle: -90, position: 'insideLeft', offset: 10, fontSize: 10, fill: '#9B9490' }}
              />
              <Tooltip
                formatter={(v: number) => [`${v} min`, 'Avg Response']}
                contentStyle={{ fontSize: 11, border: '1px solid #E8E4E1', borderRadius: 8 }}
              />
              {/* SLA target line at 18 */}
              <Bar dataKey="response" radius={[4, 4, 0, 0]}>
                {chartData.map((entry, i) => (
                  <Cell key={i} fill={PERF_BAR[entry.perf]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* City Map */}
      <div className="bg-white rounded-2xl border border-ambu-border shadow-sm p-5">
        <h2 className="font-semibold text-ambu-dark text-sm flex items-center gap-2 mb-1">
          <MapPin className="w-4 h-4 text-ambu-red" /> Network Unit Map
        </h2>
        <p className="text-xs text-ambu-muted mb-3">
          All Ujala Cygnus units · Color coded:&nbsp;
          <span className="text-emerald-600 font-medium">Green = On Track</span> ·&nbsp;
          <span className="text-amber-600 font-medium">Amber = Needs Attention</span> ·&nbsp;
          <span className="text-red-600 font-medium">Red = Critical</span>
        </p>
        <div style={{ height: 380 }} className="rounded-xl overflow-hidden">
          <GroupMap />
        </div>
      </div>
    </div>
  )
}
