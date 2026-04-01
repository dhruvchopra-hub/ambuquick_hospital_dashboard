// Server-only scoring helper — imports supabaseAdmin, never bundle in client
import { supabaseAdmin } from '@/lib/supabase/admin'
import {
  getProximityScore, getTypeScore, getDriverRatingScore,
  getFatigueScore, calculateMatchScore, haversineKm, estimateDriveTime,
} from '@/lib/ambulanceMatching'

const driveTimeCache = new Map<string, { driveTimeMinutes: number; distanceKm: string; ts: number }>()
const CACHE_TTL_MS = 60_000

interface AmbulanceRow {
  id: string; code: string; type: string
  driver_name: string; driver_phone: string
  is_hospital_fleet: boolean; lat: number; lng: number
}

interface DistanceEl {
  status: string
  duration_in_traffic?: { value: number }
  duration?: { value: number }
  distance?: { value: number }
}

async function fetchDriveTimes(
  origins: Array<{ id: string; lat: number; lng: number }>,
  pickupLat: number, pickupLng: number,
): Promise<Map<string, { driveTimeMinutes: number; distanceKm: string }>> {
  const result = new Map<string, { driveTimeMinutes: number; distanceKm: string }>()
  const now = Date.now()

  const uncached = origins.filter(o => {
    const key = `${o.id}:${pickupLat.toFixed(4)}:${pickupLng.toFixed(4)}`
    const cached = driveTimeCache.get(key)
    if (cached && now - cached.ts < CACHE_TTL_MS) {
      result.set(o.id, { driveTimeMinutes: cached.driveTimeMinutes, distanceKm: cached.distanceKm })
      return false
    }
    return true
  })

  if (uncached.length === 0) return result

  const apiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  if (!apiKey) {
    uncached.forEach(o => {
      const km = haversineKm(o.lat, o.lng, pickupLat, pickupLng)
      result.set(o.id, { driveTimeMinutes: estimateDriveTime(km), distanceKm: km.toFixed(1) })
    })
    return result
  }

  try {
    const originsStr = uncached.map(o => `${o.lat},${o.lng}`).join('|')
    const url = `https://maps.googleapis.com/maps/api/distancematrix/json` +
      `?origins=${encodeURIComponent(originsStr)}` +
      `&destinations=${encodeURIComponent(`${pickupLat},${pickupLng}`)}` +
      `&mode=driving&departure_time=now&traffic_model=best_guess&key=${apiKey}`

    const res = await fetch(url, { next: { revalidate: 0 } })
    const data = await res.json()

    if (data.status === 'OK') {
      data.rows.forEach((row: { elements: DistanceEl[] }, idx: number) => {
        const el = row.elements[0]
        const amb = uncached[idx]
        const km = el.distance?.value
          ? (el.distance.value / 1000).toFixed(1)
          : haversineKm(amb.lat, amb.lng, pickupLat, pickupLng).toFixed(1)
        if (el.status === 'OK') {
          const secs = el.duration_in_traffic?.value ?? el.duration?.value ?? 1800
          const driveTimeMinutes = Math.max(1, Math.ceil(secs / 60))
          const cacheKey = `${amb.id}:${pickupLat.toFixed(4)}:${pickupLng.toFixed(4)}`
          driveTimeCache.set(cacheKey, { driveTimeMinutes, distanceKm: km, ts: now })
          result.set(amb.id, { driveTimeMinutes, distanceKm: km })
        } else {
          const k = haversineKm(amb.lat, amb.lng, pickupLat, pickupLng)
          result.set(amb.id, { driveTimeMinutes: estimateDriveTime(k), distanceKm: k.toFixed(1) })
        }
      })
    } else {
      uncached.forEach(o => {
        const km = haversineKm(o.lat, o.lng, pickupLat, pickupLng)
        result.set(o.id, { driveTimeMinutes: estimateDriveTime(km), distanceKm: km.toFixed(1) })
      })
    }
  } catch {
    uncached.forEach(o => {
      const km = haversineKm(o.lat, o.lng, pickupLat, pickupLng)
      result.set(o.id, { driveTimeMinutes: estimateDriveTime(km), distanceKm: km.toFixed(1) })
    })
  }
  return result
}

async function getRidesInLast4Hours(ambulanceId: string): Promise<number> {
  const since = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString()
  const { count } = await supabaseAdmin
    .from('rides').select('id', { count: 'exact', head: true })
    .eq('ambulance_id', ambulanceId).eq('status', 'completed').gte('created_at', since)
  return count ?? 0
}

export interface ScoredAmbulance {
  id: string; code: string; type: string
  driver_name: string; driver_phone: string; is_hospital_fleet: boolean
  driveTimeMinutes: number; distanceKm: string
  matchScore: number
  scoreBreakdown: { proximity: number; type: number; rating: number; fatigue: number }
}

export async function scoreAmbulances(
  ambulances: AmbulanceRow[],
  urgency: string,
  pickupLat: number | null,
  pickupLng: number | null,
): Promise<ScoredAmbulance[]> {
  if (!ambulances.length) return []

  // Drive times
  let driveTimeMap = new Map<string, { driveTimeMinutes: number; distanceKm: string }>()
  if (pickupLat != null && pickupLng != null) {
    driveTimeMap = await fetchDriveTimes(
      ambulances.map(a => ({ id: a.id, lat: a.lat, lng: a.lng })),
      pickupLat, pickupLng,
    )
  } else {
    ambulances.forEach(a => driveTimeMap.set(a.id, { driveTimeMinutes: 15, distanceKm: '—' }))
  }

  // Fatigue counts in parallel
  const fatigueCounts = await Promise.all(ambulances.map(a => getRidesInLast4Hours(a.id)))

  // Driver ratings
  const ratingMap = new Map<string, number>()
  try {
    const { data: scores } = await supabaseAdmin
      .from('driver_scores').select('ambulance_id, overall_score')
      .in('ambulance_id', ambulances.map(a => a.id))
    scores?.forEach(s => ratingMap.set(s.ambulance_id, s.overall_score))
  } catch { /* table may not exist yet */ }

  const scored: ScoredAmbulance[] = ambulances.map((amb, idx) => {
    const dt = driveTimeMap.get(amb.id) ?? { driveTimeMinutes: 15, distanceKm: '—' }
    const proximityScore = getProximityScore(dt.driveTimeMinutes)
    const typeScore = getTypeScore(urgency, amb.type)
    const driverRatingScore = getDriverRatingScore(ratingMap.get(amb.id) ?? null)
    const fatigueScore = getFatigueScore(fatigueCounts[idx])
    const finalScore = calculateMatchScore({ proximityScore, typeScore, driverRatingScore, fatigueScore })
    return {
      id: amb.id, code: amb.code, type: amb.type,
      driver_name: amb.driver_name, driver_phone: amb.driver_phone,
      is_hospital_fleet: amb.is_hospital_fleet,
      driveTimeMinutes: dt.driveTimeMinutes, distanceKm: dt.distanceKm,
      matchScore: Math.round(finalScore),
      scoreBreakdown: {
        proximity: Math.round(proximityScore),
        type: Math.round(typeScore),
        rating: Math.round(driverRatingScore),
        fatigue: Math.round(fatigueScore),
      },
    }
  })

  scored.sort((a, b) => b.matchScore - a.matchScore)
  return scored
}
