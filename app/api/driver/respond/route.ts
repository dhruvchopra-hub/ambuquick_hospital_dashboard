import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function POST(req: Request) {
  try {
    const { ambulanceId, rideId, response, reason } = await req.json()
    if (!ambulanceId || !rideId || !response) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }

    if (response === 'accept') {
      await supabaseAdmin.from('rides').update({ status: 'dispatched' }).eq('id', rideId)
      // Log the acceptance (best-effort)
      void supabaseAdmin.from('assignment_attempts').update({ outcome: 'accepted' })
        .eq('ride_id', rideId).eq('ambulance_id', ambulanceId).is('outcome', null)
      return NextResponse.json({ ok: true })
    }

    if (response === 'decline') {
      // Mark ambulance available again
      await supabaseAdmin.from('ambulances').update({ status: 'available' }).eq('id', ambulanceId)
      // Update ride to signal fallback needed
      await supabaseAdmin.from('rides').update({
        status: 'declined_by_driver',
        decline_reason: reason || null,
      }).eq('id', rideId)
      // Log the decline (best-effort)
      void supabaseAdmin.from('assignment_attempts').update({ outcome: 'declined' })
        .eq('ride_id', rideId).eq('ambulance_id', ambulanceId).is('outcome', null)
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: 'Invalid response' }, { status: 400 })
  } catch (err) {
    console.error('driver/respond error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
