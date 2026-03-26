import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function POST(request: Request) {
  const { ambulanceId, pin } = await request.json()
  if (!ambulanceId || !pin) return NextResponse.json({ valid: false })

  const { data } = await supabaseAdmin
    .from('ambulances')
    .select('driver_pin')
    .eq('id', ambulanceId)
    .single()

  return NextResponse.json({ valid: data?.driver_pin === pin })
}
