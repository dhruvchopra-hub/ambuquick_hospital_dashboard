import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function GET() {
  const cookieStore = cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json([], { status: 401 })

  const { data: profile } = await supabaseAdmin.from('user_profiles').select('hospital_id').eq('user_id', user.id).single()
  if (!profile?.hospital_id) return NextResponse.json([])

  const { data: profiles } = await supabaseAdmin.from('user_profiles').select('user_id').eq('hospital_id', profile.hospital_id)
  if (!profiles?.length) return NextResponse.json([])

  const userIds = profiles.map(p => p.user_id)
  const { data: { users } } = await supabaseAdmin.auth.admin.listUsers()
  const team = users.filter(u => userIds.includes(u.id)).map(u => ({ email: u.email, user_id: u.id }))

  return NextResponse.json(team)
}
