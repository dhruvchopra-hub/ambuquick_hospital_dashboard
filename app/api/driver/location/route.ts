import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function POST(request: Request) {
  const { ambulanceId, lat, lng } = await request.json()

  if (!ambulanceId || lat === undefined || lng === undefined) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  const { error } = await supabaseAdmin
    .from('ambulances')
    .update({ lat, lng })
    .eq('id', ambulanceId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
