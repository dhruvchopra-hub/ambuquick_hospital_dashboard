'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Sidebar from '@/components/Sidebar'
import ErrorBoundary from '@/components/ErrorBoundary'
import { format } from 'date-fns'
import { Bell } from 'lucide-react'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [hospitalName, setHospitalName] = useState('')
  const [userEmail, setUserEmail] = useState('')
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const supabase = createClient()

    async function load() {
      const [{ data: profile }, { data: { user } }] = await Promise.all([
        supabase.from('user_profiles').select('hospital_id').single(),
        supabase.auth.getUser(),
      ])
      if (profile?.hospital_id) {
        const { data: hospital } = await supabase
          .from('hospitals').select('name').eq('id', profile.hospital_id).single()
        if (hospital?.name) setHospitalName(hospital.name)
      }
      if (user?.email) setUserEmail(user.email)
    }
    load()

    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }

    const notifChannel = supabase
      .channel('critical-ride-alerts')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'rides' }, (payload) => {
        const ride = payload.new as { urgency: string; patient_name: string; pickup_location: string }
        if (ride.urgency === 'Critical' && Notification.permission === 'granted') {
          new Notification('🚨 Critical Ride Booked', {
            body: `${ride.patient_name} — ${ride.pickup_location}`,
            icon: '/logo.png',
          })
        }
      })
      .subscribe()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') router.push('/login')
    })

    const timer = setInterval(() => setNow(new Date()), 60000)

    return () => {
      subscription.unsubscribe()
      supabase.removeChannel(notifChannel)
      clearInterval(timer)
    }
  }, [router])

  const initials = userEmail?.[0]?.toUpperCase() || 'U'

  return (
    <div className="min-h-screen bg-ambu-bg">
      <Sidebar hospitalName={hospitalName} />

      {/* Top bar */}
      <header className="fixed top-0 right-0 left-0 lg:left-60 z-20 bg-white border-b border-ambu-border h-14 flex items-center px-4 lg:px-6 justify-between">
        <div className="hidden lg:flex items-center gap-2.5">
          <span className="text-sm font-semibold text-ambu-dark truncate max-w-[220px]">{hospitalName}</span>
          {hospitalName && <span className="w-1 h-1 rounded-full bg-ambu-border" />}
          <span className="text-xs text-ambu-muted">{format(now, 'EEEE, d MMMM yyyy')}</span>
        </div>
        <div className="flex items-center gap-3 ml-auto">
          <button className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-ambu-bg transition-colors text-ambu-muted hover:text-ambu-dark">
            <Bell className="w-4 h-4" />
          </button>
          <div className="w-8 h-8 rounded-full bg-ambu-red flex items-center justify-center">
            <span className="text-white text-xs font-bold">{initials}</span>
          </div>
        </div>
      </header>

      <main className="lg:ml-60 pt-14 min-h-screen">
        <ErrorBoundary>
          {children}
        </ErrorBoundary>
      </main>
    </div>
  )
}
