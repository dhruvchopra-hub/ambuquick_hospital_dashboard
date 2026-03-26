'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Sidebar from '@/components/Sidebar'
import ErrorBoundary from '@/components/ErrorBoundary'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [hospitalName, setHospitalName] = useState('Hospital')

  useEffect(() => {
    const supabase = createClient()

    async function loadHospitalName() {
      const { data: profile } = await supabase.from('user_profiles').select('hospital_id').single()
      if (!profile?.hospital_id) return
      const { data: hospital } = await supabase.from('hospitals').select('name').eq('id', profile.hospital_id).single()
      if (hospital?.name) setHospitalName(hospital.name)
    }

    loadHospitalName()

    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }

    // Listen for new Critical rides and push browser notification
    const notifChannel = supabase
      .channel('critical-ride-alerts')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'rides' }, (payload) => {
        const ride = payload.new as { urgency: string; patient_name: string; pickup_location: string }
        if (ride.urgency === 'Critical' && Notification.permission === 'granted') {
          new Notification('🚨 Critical Ride Booked', {
            body: `${ride.patient_name} — ${ride.pickup_location}`,
            icon: '/favicon.ico',
          })
        }
      })
      .subscribe()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') router.push('/login')
    })

    return () => {
      subscription.unsubscribe()
      supabase.removeChannel(notifChannel)
    }
  }, [])

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar hospitalName={hospitalName} />
      <main className="lg:ml-60 min-h-screen">
        <div className="pt-[52px] lg:pt-0">
          <ErrorBoundary>
            {children}
          </ErrorBoundary>
        </div>
      </main>
    </div>
  )
}
