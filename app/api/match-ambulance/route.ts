import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import {
  getProximityScore,
  getTypeScore,
  getDriverRatingScore,
  getFatigueScore,
  calculateMatchScore,
  haversineKm,
  estimateDriveTime,
} from '@/lib/ambulanceMatching'

// In-memory cache: key = "ambulanceId:pickupLat:pickupLng", TTL = 60s
const driveTimeCache = new Map<string, { value: number; distanceKm: string; ts: number }>()
const CACHE_TTL_MS = 60_000

interface DistanceMatrixRow {
  elements: Array<{
    status: string
    duration_in_traffic?: { value: number }
    duration?: { value: number }
    distance?: { value: number }
  }>
}

async function fetchDriveTimes(
  origins: Array<{ id: string; lat: number; lng: number }>,
  pickupLat: number,
  pickupLng: number
): Promise<Map<string, { driveTimeMinutes: number; distanceKm: string }>> {
  const result = new Map<string, { driveTimeMinutes: number; distanceKm: string }>()
  const now = Date.now()

  // Separate cached from uncached
  const uncached = origins.filter(o => {
    const key = `${o.id}:${pickupLat.toFixed(4)}:${pickupLng.toFixed(4)}`
    const cached = driveTimeCache.get(key)
    if (cached && now - cached.ts < CACHE_TTL_MS) {
      result.set(o.id, { driveTimeMinutes: cached.value, distanceKm: cached.distanceKm })
      return false
    }
    return true
  })

  if (uncached.length === 0) return result

  const apiKey =
    process.env.GOOGLE_MAPS_API_KEY ||
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

  if (!apiKey) {
    // Haversine fallback
    uncached.forEach(o => {
      const km = haversineKm(o.lat, o.lng, pickupLat, pickupLng)
      result.set(o.id, {
        driveTimeMinutes: estimateDriveTime(km),
        distanceKm: km.toFixed(1),
      })
    })
    return result
  }

  try {
    const originsStr = uncached.map(o => `${o.lat},${o.lng}`).join('|')
    const destStr = `${pickupLat},${pickupLng}`
    const url =
      `https://maps.googleapis.com/maps/api/distancematrix/json` +
      `?origins=${encodeURIComponent(originsStr)}` +
      `&destinations=${encodeURIComponent(destStr)}` +
      `&mode=driving&departure_time=now&traffic_model=best_guess` +
      `&key=${apiKey}`

    const res = await fetch(url, { next: { revalidate: 0 } })
    const data = await res.json()

    if (data.status === 'OK') {
      data.rows.forEach((row: DistanceMatrixRow, idx: number) => {
        const el = row.elements[0]
        const amb = uncached[idx]
        if (el.status === 'OK') {
          const secs =
            el.duration_in_traffic?.value ?? el.duration?.value ?? 1800
          const km = el.distance?.value
            ? (el.distance.value / 1000).toFixed(1)
            : haversineKm(amb.lat, amb.lng, pickupLat, pickupLng).toFixed(1)
          const driveTimeMinutes = Math.max(1, Math.ceil(secs / 60))
          const cacheKey = `${amb.id}:${pickupLat.toFixed(4)}:${pickupLng.toFixed(4)}`
          driveTimeCache.set(cacheKey, { value: driveTimeMinutes, distanceKm: km, ts: now })
          result.set(amb.id, { driveTimeMinutes, distanceKm: km })
        } else {
          // Element error — haversine fallback for this ambulance
          const km = haversineKm(amb.lat, amb.lng, pickupLat, pickupLng)
          result.set(amb.id, {
            driveTimeMinutes: estimateDriveTime(km),
            distanceKm: km.toFixed(1),
          })
        }
      })
    } else {
      // API-level error — haversine fallback for all
      uncached.forEach(o => {
        const km = haversineKm(o.lat, o.lng, pickupLat, pickupLng)
        result.set(o.id, {
          driveTimeMinutes: estimateDriveTime(km),
          distanceKm: km.toFixed(1),
        })
      })
    }
  } catch {
    // Network error — haversine fallback
    uncached.forEach(o => {
      const km = haversineKm(o.lat, o.lng, pickupLat, pickupLng)
      result.set(o.id, {
        driveTimeMinutes: estimateDriveTime(km),
        distanceKm: km.toFixed(1),
      })
    })
  }

  return result
}

async function getRidesInLast4Hours(ambulanceId: string): Promise<number> {
  const since = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString()
  const { count } = await supabaseAdmin
    .from('rides')
    .select('id', { count: 'exact', head: true })
    .eq('ambulance_id', ambulanceId)
    .eq('status', 'completed')
    .gte('created_at', since)
  return count ?? 0
}

export async function POST(req: Request) {
  try {
    const { pickupLat, pickupLng, urgency, hospitalId } = await req.json()

    if (!urgency || !hospitalId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // 1. Fetch available ambulances
    const { data: ambulances, error: ambError } = await supabaseAdmin
      .from('ambulances')
      .select('id, code, type, driver_name, driver_phone, lat, lng, is_hospital_fleet')
      .eq('hospital_id', hospitalId)
      .eq('status', 'available')

    if (ambError) {
      return NextResponse.json({ error: 'Failed to fetch ambulances' }, { status: 500 })
    }
    if (!ambulances?.length) {
      return NextResponse.json({ scored: [] })
    }

    // 2. Drive times (Distance Matrix or haversine fallback)
    let driveTimeMap = new Map<string, { driveTimeMinutes: number; distanceKm: string }>()
    if (pickupLat != null && pickupLng != null) {
      driveTimeMap = await fetchDriveTimes(
        ambulances.map(a => ({ id: a.id, lat: a.lat, lng: a.lng })),
        pickupLat,
        pickupLng
      )
    } else {
      // No pickup coords — default drive time of 15 min (neutral score)
      ambulances.forEach(a => driveTimeMap.set(a.id, { driveTimeMinutes: 15, distanceKm: '—' }))
    }

    // 3. Fatigue scores — all ambulances in parallel
    const fatigueCounts = await Promise.all(
      ambulances.map(a => getRidesInLast4Hours(a.id))
    )

    // 4. Driver rating scores — try driver_scores table, default 70 on any error
    const ratingMap = new Map<string, number>()
    try {
      const { data: scores } = await supabaseAdmin
        .from('driver_scores')
        .select('ambulance_id, overall_score')
        .in('ambulance_id', ambulances.map(a => a.id))
      scores?.forEach(s => ratingMap.set(s.ambulance_id, s.overall_score))
    } catch {
      // Table doesn't exist yet — all defaults
    }

    // 5. Score each ambulance
    const scored = ambulances.map((amb, idx) => {
      const dt = driveTimeMap.get(amb.id) ?? { driveTimeMinutes: 15, distanceKm: '—' }
      const proximityScore = getProximityScore(dt.driveTimeMinutes)
      const typeScore = getTypeScore(urgency, amb.type)
      const driverRatingScore = getDriverRatingScore(ratingMap.get(amb.id) ?? null)
      const fatigueScore = getFatigueScore(fatigueCounts[idx])

      const finalScore = calculateMatchScore({
        proximityScore,
        typeScore,
        driverRatingScore,
        fatigueScore,
      })

      return {
        id: amb.id,
        code: amb.code,
        type: amb.type,
        driver_name: amb.driver_name,
        driver_phone: amb.driver_phone,
        is_hospital_fleet: amb.is_hospital_fleet,
        driveTimeMinutes: dt.driveTimeMinutes,
        distanceKm: dt.distanceKm,
        matchScore: Math.round(finalScore),
        scoreBreakdown: {
          proximity: Math.round(proximityScore),
          type: Math.round(typeScore),
          rating: Math.round(driverRatingScore),
          fatigue: Math.round(fatigueScore),
        },
      }
    })

    // 6. Sort highest score first
    scored.sort((a, b) => b.matchScore - a.matchScore)

    return NextResponse.json({ scored })
  } catch (err) {
    console.error('match-ambulance error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
