import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const ambulanceId = searchParams.get('ambulanceId')
  if (!ambulanceId) return NextResponse.json({ error: 'Missing ambulanceId' }, { status: 400 })

  const { data, error } = await supabaseAdmin
    .from('rides')
    .select('patient_name, patient_phone, pickup_location, destination, urgency')
    .eq('ambulance_id', ambulanceId)
    .in('status', ['dispatched', 'en_route'])
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (error || !data) return NextResponse.json({ error: 'No active ride' }, { status: 404 })
  return NextResponse.json(data)
}
