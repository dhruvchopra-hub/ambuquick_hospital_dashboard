'use client'

import dynamic from 'next/dynamic'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { BrainCircuit, Flame, MapPin, TrendingUp, Clock } from 'lucide-react'

const ForecastMap = dynamic(() => import('./ForecastMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-ambu-bg flex items-center justify-center rounded-xl">
      <div className="w-6 h-6 border-2 border-ambu-red border-t-transparent rounded-full animate-spin" />
    </div>
  ),
})

// Weekly heatmap data: [day][hour] = call volume (0–10)
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const HOURS = Array.from({ length: 24 }, (_, i) => i)

const HEATMAP: number[][] = [
  // Mon
  [1,0,0,1,0,0,2,3,5,6,5,4,4,5,5,4,5,6,7,7,5,4,3,2],
  // Tue
  [1,0,0,0,1,1,2,4,6,7,6,5,5,6,5,4,5,7,8,7,5,4,2,1],
  // Wed
  [0,0,1,0,0,1,2,3,5,6,5,4,4,5,4,4,5,6,7,8,6,4,3,1],
  // Thu
  [1,0,0,0,1,1,2,4,5,7,6,5,5,6,5,5,6,7,8,9,6,5,3,2],
  // Fri
  [1,1,0,1,1,1,2,4,5,6,5,5,5,6,5,5,6,8,9,10,7,5,4,3],
  // Sat
  [2,1,1,1,1,2,3,4,5,5,5,4,4,5,4,5,6,7,9,10,8,6,5,4],
  // Sun
  [3,2,2,2,1,1,2,3,4,4,4,4,3,4,4,4,5,6,8,9,7,5,4,3],
]

function heatColor(v: number): string {
  if (v === 0) return 'bg-gray-100'
  if (v <= 2) return 'bg-amber-100'
  if (v <= 4) return 'bg-orange-200'
  if (v <= 6) return 'bg-orange-400'
  if (v <= 8) return 'bg-red-500'
  return 'bg-red-700'
}

const PEAK_HOURS = [
  { window: '7pm – 9pm', confidence: 94, label: 'Fri–Sat evening surge', color: 'text-red-600', bg: 'bg-red-50 border-red-200' },
  { window: '9am – 11am', confidence: 82, label: 'Morning commute peak', color: 'text-orange-600', bg: 'bg-orange-50 border-orange-200' },
  { window: '10pm – 12am', confidence: 76, label: 'Late-night Rohini hotspot', color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200' },
]

const ZONES_LIST = [
  { id: 'A', name: 'Rohini Sector 15', demand: 'High', window: '10pm–2am', units: 2 },
  { id: 'B', name: 'Nangloi', demand: 'High', window: '8am–12pm', units: 2 },
  { id: 'C', name: 'Janakpuri', demand: 'Medium', window: '6pm–10pm', units: 1 },
  { id: 'D', name: 'Pitampura', demand: 'High', window: '7am–11am', units: 2 },
  { id: 'E', name: 'Dwarka Sector 12', demand: 'Medium', window: '5pm–9pm', units: 1 },
]

// Last 30 days demand vs actual
const DEMAND_DATA = Array.from({ length: 30 }, (_, i) => {
  const day = i + 1
  const base = 12 + Math.sin(i * 0.6) * 4 + Math.cos(i * 0.3) * 2
  const predicted = Math.round(base + (i % 7 === 4 || i % 7 === 5 ? 4 : 0))
  const actual = predicted + Math.round((Math.random() - 0.5) * 4)
  return { day: `Mar ${day}`, predicted, actual: Math.max(1, actual) }
})

export default function DemandForecastPage() {
  return (
    <div className="p-5 lg:p-7 space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-ambu-dark flex items-center gap-2">
          <BrainCircuit className="w-6 h-6 text-ambu-red" /> Demand Forecast
        </h1>
        <p className="text-sm text-ambu-muted mt-0.5">AI-powered dispatch demand prediction for Delhi NCR · Updated hourly</p>
      </div>

      {/* Peak Hours Today */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="lg:col-span-1">
          <div className="bg-white rounded-2xl border border-ambu-border shadow-sm p-5 h-full">
            <h2 className="font-semibold text-ambu-dark text-sm flex items-center gap-2 mb-4">
              <Flame className="w-4 h-4 text-ambu-red" /> Peak Hours Today
            </h2>
            <div className="space-y-3">
              {PEAK_HOURS.map((p, i) => (
                <div key={i} className={`rounded-xl border p-3.5 ${p.bg}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className={`text-sm font-bold ${p.color}`}>{p.window}</p>
                      <p className="text-xs text-ambu-muted mt-0.5">{p.label}</p>
                    </div>
                    <span className={`text-xs font-bold px-2 py-1 rounded-lg bg-white border ${p.color}`}>
                      {p.confidence}%
                    </span>
                  </div>
                  <div className="mt-2.5 h-1.5 bg-white/60 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${i === 0 ? 'bg-red-500' : i === 1 ? 'bg-orange-500' : 'bg-amber-500'}`}
                      style={{ width: `${p.confidence}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Recommended Pre-Positioning */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl border border-ambu-border shadow-sm p-5 h-full">
            <h2 className="font-semibold text-ambu-dark text-sm flex items-center gap-2 mb-1">
              <MapPin className="w-4 h-4 text-ambu-red" /> Recommended Pre-Positioning
            </h2>
            <p className="text-xs text-ambu-muted mb-3">Suggested ambulance staging zones based on historical demand clusters</p>
            <div className="flex flex-col md:flex-row gap-3" style={{ minHeight: 280 }}>
              {/* Map */}
              <div className="flex-1 rounded-xl overflow-hidden" style={{ minHeight: 240 }}>
                <ForecastMap />
              </div>
              {/* Zone list */}
              <div className="md:w-52 space-y-2 flex-shrink-0">
                {ZONES_LIST.map(z => (
                  <div key={z.id} className="bg-ambu-bg rounded-xl border border-ambu-border p-3">
                    <div className="flex items-start justify-between gap-1">
                      <div>
                        <p className="text-xs font-bold text-ambu-dark">Zone {z.id} — {z.name}</p>
                        <p className="text-xs text-ambu-muted mt-0.5">{z.window}</p>
                      </div>
                      <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0 ${
                        z.demand === 'High' ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}>{z.demand}</span>
                    </div>
                    <p className="text-xs text-ambu-muted mt-1.5">
                      <span className="font-semibold text-ambu-dark">{z.units}</span> unit{z.units > 1 ? 's' : ''} recommended
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Weekly Heatmap */}
      <div className="bg-white rounded-2xl border border-ambu-border shadow-sm p-5">
        <h2 className="font-semibold text-ambu-dark text-sm flex items-center gap-2 mb-1">
          <Clock className="w-4 h-4 text-ambu-red" /> Weekly Emergency Call Volume Heatmap
        </h2>
        <p className="text-xs text-ambu-muted mb-4">Based on last 90 days · Color intensity = call volume</p>
        <div className="overflow-x-auto">
          <div className="min-w-[640px]">
            {/* Hour labels */}
            <div className="flex ml-10 mb-1">
              {HOURS.map(h => (
                <div key={h} className="flex-1 text-center text-[9px] text-ambu-muted/60 font-medium" style={{ minWidth: 0 }}>
                  {h % 3 === 0 ? `${h}h` : ''}
                </div>
              ))}
            </div>
            {DAYS.map((day, di) => (
              <div key={day} className="flex items-center gap-1 mb-1">
                <div className="w-9 text-xs text-ambu-muted font-medium text-right pr-1 flex-shrink-0">{day}</div>
                {HOURS.map(h => {
                  const v = HEATMAP[di][h]
                  return (
                    <div
                      key={h}
                      title={`${day} ${h}:00 — ${v} calls`}
                      className={`flex-1 rounded-sm h-7 cursor-default transition-transform hover:scale-110 ${heatColor(v)}`}
                      style={{ minWidth: 0 }}
                    />
                  )
                })}
              </div>
            ))}
            {/* Legend */}
            <div className="flex items-center gap-1 mt-3 ml-10">
              <span className="text-[10px] text-ambu-muted mr-1">Low</span>
              {['bg-gray-100','bg-amber-100','bg-orange-200','bg-orange-400','bg-red-500','bg-red-700'].map(c => (
                <div key={c} className={`w-5 h-3 rounded-sm ${c}`} />
              ))}
              <span className="text-[10px] text-ambu-muted ml-1">High</span>
            </div>
          </div>
        </div>
      </div>

      {/* Demand vs Actual */}
      <div className="bg-white rounded-2xl border border-ambu-border shadow-sm p-5">
        <h2 className="font-semibold text-ambu-dark text-sm flex items-center gap-2 mb-1">
          <TrendingUp className="w-4 h-4 text-ambu-red" /> Demand vs Actual — Last 30 Days
        </h2>
        <p className="text-xs text-ambu-muted mb-4">Predicted call volume vs actual dispatches (March 2026)</p>
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={DEMAND_DATA} margin={{ top: 5, right: 10, left: 0, bottom: 20 }}>
            <defs>
              <linearGradient id="gradPred" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gradActual" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#DC2626" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#DC2626" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#F0EDEB" />
            <XAxis
              dataKey="day"
              tick={{ fontSize: 10, fill: '#9B9490' }}
              tickLine={false}
              interval={4}
              label={{ value: 'Date (March 2026)', position: 'insideBottom', offset: -12, fontSize: 11, fill: '#9B9490' }}
            />
            <YAxis
              tick={{ fontSize: 10, fill: '#9B9490' }}
              tickLine={false}
              axisLine={false}
              label={{ value: 'Calls', angle: -90, position: 'insideLeft', fontSize: 11, fill: '#9B9490' }}
            />
            <Tooltip
              contentStyle={{ fontSize: 12, border: '1px solid #E8E4E1', borderRadius: 8 }}
              formatter={(v: number, name: string) => [v, name === 'predicted' ? 'Predicted' : 'Actual']}
            />
            <Legend
              formatter={(v) => v === 'predicted' ? 'Predicted' : 'Actual'}
              wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
            />
            <Area type="monotone" dataKey="predicted" stroke="#6366f1" strokeWidth={2} fill="url(#gradPred)" dot={false} />
            <Area type="monotone" dataKey="actual" stroke="#DC2626" strokeWidth={2} fill="url(#gradActual)" dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
