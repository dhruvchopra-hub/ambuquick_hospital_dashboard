import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function POST(request: Request) {
  const { email } = await request.json()
  if (!email) return NextResponse.json({ error: 'Email required' }, { status: 400 })

  // Get calling user's hospital
  const cookieStore = cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabaseAdmin.from('user_profiles').select('hospital_id').eq('user_id', user.id).single()
  if (!profile?.hospital_id) return NextResponse.json({ error: 'No hospital linked' }, { status: 400 })

  const { error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
    data: { hospital_id: profile.hospital_id },
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
