import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

// In-memory rate limit: max 1 request per 3 seconds per ambulanceId
const lastRequest = new Map<string, number>()

export async function POST(request: Request) {
  const { ambulanceId, lat, lng } = await request.json()

  if (!ambulanceId || lat === undefined || lng === undefined) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  const now = Date.now()
  const last = lastRequest.get(ambulanceId) || 0
  if (now - last < 3000) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }
  lastRequest.set(ambulanceId, now)

  const { error } = await supabaseAdmin
    .from('ambulances')
    .update({ lat, lng })
    .eq('id', ambulanceId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
