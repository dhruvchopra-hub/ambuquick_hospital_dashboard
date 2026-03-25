'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Sidebar from '@/components/Sidebar'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [hospitalName, setHospitalName] = useState('Hospital')

  useEffect(() => {
    const supabase = createClient()

    // Load hospital name in the background (non-blocking)
    async function loadHospitalName() {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('hospital_id')
        .single()

      if (!profile?.hospital_id) return

      const { data: hospital } = await supabase
        .from('hospitals')
        .select('name')
        .eq('id', profile.hospital_id)
        .single()

      if (hospital?.name) setHospitalName(hospital.name)
    }

    loadHospitalName()

    // Redirect to login if the user signs out
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') router.push('/login')
    })

    return () => subscription.unsubscribe()
  }, [])

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar hospitalName={hospitalName} />
      <main className="lg:ml-60 min-h-screen">
        <div className="pt-[52px] lg:pt-0">
          {children}
        </div>
      </main>
    </div>
  )
}
