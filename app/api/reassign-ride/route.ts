import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { scoreAmbulances } from '@/lib/server/scoreAmbulances'

const MAX_ATTEMPTS = 3

export async function POST(req: Request) {
  try {
    const { rideId, excludeAmbulanceIds = [] } = await req.json()
    if (!rideId) return NextResponse.json({ error: 'Missing rideId' }, { status: 400 })

    // 1. Get current ride details
    const { data: ride, error: rideErr } = await supabaseAdmin
      .from('rides')
      .select('id, hospital_id, urgency, pickup_lat, pickup_lng, ambulance_id, attempted_ambulance_ids, status')
      .eq('id', rideId)
      .single()

    if (rideErr || !ride) return NextResponse.json({ error: 'Ride not found' }, { status: 404 })

    // Merge already-tried IDs from the ride record + caller-supplied list
    const triedIds: string[] = Array.from(new Set([
      ...(ride.attempted_ambulance_ids ?? []),
      ...excludeAmbulanceIds,
    ]))

    if (triedIds.length >= MAX_ATTEMPTS) {
      return NextResponse.json({ exhausted: true, message: 'Max reassignment attempts reached' })
    }

    // 2. Find next available ambulance
    let query = supabaseAdmin
      .from('ambulances')
      .select('id, code, type, driver_name, driver_phone, lat, lng, is_hospital_fleet, expo_push_token')
      .eq('hospital_id', ride.hospital_id)
      .eq('status', 'available')

    if (triedIds.length > 0) {
      query = query.not('id', 'in', `(${triedIds.join(',')})`)
    }

    const { data: available } = await query
    if (!available?.length) {
      return NextResponse.json({ exhausted: true, message: 'No available ambulances remaining' })
    }

    // 3. Score and pick best
    const scored = await scoreAmbulances(
      available, ride.urgency, ride.pickup_lat ?? null, ride.pickup_lng ?? null,
    )
    if (!scored.length) {
      return NextResponse.json({ exhausted: true, message: 'No available ambulances remaining' })
    }
    const best = scored[0]

    // 4. Mark old ambulance available again (if it was set on_trip for this ride)
    if (ride.ambulance_id && !triedIds.includes(ride.ambulance_id)) {
      await supabaseAdmin.from('ambulances').update({ status: 'available' }).eq('id', ride.ambulance_id)
    }

    // 5. Update ride with new assignment
    const newTriedIds = [...triedIds, best.id]
    await supabaseAdmin.from('rides').update({
      ambulance_id: best.id,
      driver_name: best.driver_name,
      status: 'pending',
      assignment_score: best.matchScore,
      attempted_ambulance_ids: newTriedIds,
    }).eq('id', rideId)

    // 6. Mark new ambulance on_trip
    await supabaseAdmin.from('ambulances').update({ status: 'on_trip' }).eq('id', best.id)

    // 7. Send Expo push to new driver
    const pushToken = (available.find(a => a.id === best.id) as typeof available[0] & { expo_push_token?: string })?.expo_push_token
    if (pushToken) {
      fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: pushToken,
          title: `🚨 New Ride — ${ride.urgency.toUpperCase()}`,
          body: `Reassigned ride · Attempt ${newTriedIds.length}`,
          data: { rideDbId: rideId },
          sound: 'default', priority: 'high',
        }),
      }).catch(() => {})
    }

    // 8. Log attempt
    // Log attempt — best-effort, non-fatal if table doesn't exist yet
    void supabaseAdmin.from('assignment_attempts').insert({
      ride_id: rideId,
      ambulance_id: best.id,
      match_score: best.matchScore,
      attempt_number: newTriedIds.length,
      outcome: 'pending',
    })

    return NextResponse.json({
      reassigned: true,
      attemptNumber: newTriedIds.length,
      ambulance: best,
      attemptsRemaining: MAX_ATTEMPTS - newTriedIds.length,
    })
  } catch (err) {
    console.error('reassign-ride error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
