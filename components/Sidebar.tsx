'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  LayoutDashboard, PlusCircle, MapPin, Clock, Truck,
  FileText, BarChart3, LogOut, Menu, X, Settings,
} from 'lucide-react'
import { useState } from 'react'

const navItems = [
  { href: '/', label: 'Overview', icon: LayoutDashboard },
  { href: '/book', label: 'Book Ambulance', icon: PlusCircle },
  { href: '/tracking', label: 'Live Tracking', icon: MapPin },
  { href: '/history', label: 'Ride History', icon: Clock },
  { href: '/fleet', label: 'Fleet Manager', icon: Truck },
  { href: '/invoices', label: 'Invoices', icon: FileText },
  { href: '/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/settings', label: 'Settings', icon: Settings },
]

interface SidebarProps {
  hospitalName: string
}

export default function Sidebar({ hospitalName }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  const SidebarContent = () => (
    <div className="flex flex-col h-full" style={{ backgroundColor: '#0F0F0F' }}>
      {/* Brand */}
      <div className="px-5 py-5 border-b border-white/10 flex-shrink-0">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 rounded-lg overflow-hidden flex-shrink-0 bg-white/10">
            <Image src="/logo.png" alt="AmbuQuick" width={32} height={32} className="object-contain w-full h-full" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-white font-bold text-sm">AmbuQuick</span>
            <span className="w-1.5 h-1.5 rounded-full bg-ambu-red flex-shrink-0" />
          </div>
        </div>
        <p className="text-white/40 text-xs leading-tight truncate">{hospitalName || 'Hospital Dashboard'}</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href
          return (
            <Link
              key={href}
              href={href}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                active
                  ? 'text-ambu-red bg-ambu-red/10 pl-2.5 border-l-2 border-ambu-red'
                  : 'text-white/50 hover:text-white hover:bg-white/5 px-3'
              }`}
            >
              <Icon className="w-[18px] h-[18px] flex-shrink-0" />
              <span>{label}</span>
            </Link>
          )
        })}
      </nav>

      {/* Logout */}
      <div className="px-3 pb-5 pt-3 border-t border-white/10 flex-shrink-0">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-white/40 hover:text-red-400 hover:bg-red-400/10 transition-all w-full"
        >
          <LogOut className="w-[18px] h-[18px]" />
          <span>Logout</span>
        </button>
      </div>
    </div>
  )

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-60 lg:fixed lg:inset-y-0 z-30">
        <SidebarContent />
      </aside>

      {/* Mobile Top Bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-30 flex items-center justify-between px-4 py-3 border-b border-white/10" style={{ backgroundColor: '#0F0F0F' }}>
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded overflow-hidden bg-white/10">
            <Image src="/logo.png" alt="AmbuQuick" width={28} height={28} className="object-contain w-full h-full" />
          </div>
          <span className="text-white font-bold text-sm">AmbuQuick</span>
          <span className="w-1.5 h-1.5 rounded-full bg-ambu-red" />
        </div>
        <button onClick={() => setMobileOpen(!mobileOpen)} className="text-white/60 hover:text-white transition-colors p-1">
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <>
          <div
            className="lg:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <div className="lg:hidden fixed top-0 left-0 h-full w-64 z-50 shadow-2xl">
            <SidebarContent />
          </div>
        </>
      )}
    </>
  )
}
