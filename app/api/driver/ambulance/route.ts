import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')

  if (!id) return NextResponse.json({ error: 'Missing ambulance ID' }, { status: 400 })

  const { data, error } = await supabaseAdmin
    .from('ambulances')
    .select('code, driver_name, status')
    .eq('id', id)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Ambulance not found' }, { status: 404 })
  }

  return NextResponse.json(data)
}
