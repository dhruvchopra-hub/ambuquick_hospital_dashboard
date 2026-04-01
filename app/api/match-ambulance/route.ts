import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { scoreAmbulances } from '@/lib/server/scoreAmbulances'

export async function POST(req: Request) {
  try {
    const { pickupLat, pickupLng, urgency, hospitalId, excludeAmbulanceIds = [] } = await req.json()

    if (!urgency || !hospitalId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    let query = supabaseAdmin
      .from('ambulances')
      .select('id, code, type, driver_name, driver_phone, lat, lng, is_hospital_fleet')
      .eq('hospital_id', hospitalId)
      .eq('status', 'available')

    if (excludeAmbulanceIds.length > 0) {
      query = query.not('id', 'in', `(${excludeAmbulanceIds.join(',')})`)
    }

    const { data: ambulances, error } = await query
    if (error) return NextResponse.json({ error: 'Failed to fetch ambulances' }, { status: 500 })
    if (!ambulances?.length) return NextResponse.json({ scored: [] })

    const scored = await scoreAmbulances(ambulances, urgency, pickupLat ?? null, pickupLng ?? null)
    return NextResponse.json({ scored })
  } catch (err) {
    console.error('match-ambulance error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
