import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function POST(request: Request) {
  const { email, password, hospitalName } = await request.json()

  if (!email || !password || !hospitalName) {
    return NextResponse.json({ error: 'Email, password, and hospital name are required.' }, { status: 400 })
  }

  // Create the user (email_confirm: true skips the confirmation email)
  const { data: userData, error: userError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (userError) {
    const message = userError.message.includes('already been registered')
      ? 'An account with this email already exists.'
      : userError.message
    return NextResponse.json({ error: message }, { status: 400 })
  }

  const userId = userData.user.id

  // Create the hospital record
  const { data: hospital, error: hospitalError } = await supabaseAdmin
    .from('hospitals')
    .insert({ name: hospitalName, email })
    .select('id')
    .single()

  if (hospitalError) {
    // Roll back the user if hospital creation fails
    await supabaseAdmin.auth.admin.deleteUser(userId)
    return NextResponse.json({ error: 'Failed to create hospital record.' }, { status: 500 })
  }

  // Link user to hospital
  const { error: profileError } = await supabaseAdmin
    .from('user_profiles')
    .insert({ user_id: userId, hospital_id: hospital.id })

  if (profileError) {
    await supabaseAdmin.auth.admin.deleteUser(userId)
    return NextResponse.json({ error: 'Failed to link user to hospital.' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
