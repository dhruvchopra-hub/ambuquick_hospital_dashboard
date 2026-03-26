'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Image from 'next/image'
import { AlertCircle, Loader2, ArrowRight } from 'lucide-react'

const STATS = [
  { value: '600+', label: 'Ambulances' },
  { value: '15+', label: 'Hospital Partners' },
  { value: '7,000+', label: 'Lives Saved' },
]

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const supabase = createClient()
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
    if (signInError) {
      setError(
        signInError.message === 'Invalid login credentials'
          ? 'Incorrect email or password. Please try again.'
          : signInError.message
      )
      setLoading(false)
      return
    }
    router.push('/')
    router.refresh()
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Left — Red Panel */}
      <div
        className="lg:w-[45%] lg:fixed lg:inset-y-0 lg:left-0 flex flex-col justify-center px-8 py-12 lg:px-14"
        style={{ backgroundColor: '#D91A2A' }}
      >
        <div className="max-w-sm">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-14">
            <div className="w-10 h-10 rounded-xl overflow-hidden bg-white/20 flex items-center justify-center flex-shrink-0">
              <Image src="/logo.png" alt="AmbuQuick" width={40} height={40} className="object-contain" />
            </div>
            <div>
              <p className="text-white font-bold text-lg leading-none">AmbuQuick</p>
              <p className="text-red-200 text-xs mt-0.5">Emergency Medical Network</p>
            </div>
          </div>

          {/* Tagline */}
          <h1 className="text-white text-4xl xl:text-5xl font-bold leading-tight mb-5">
            18 minutes.<br />Every time.
          </h1>
          <p className="text-red-200 text-sm leading-relaxed mb-10">
            India's most reliable ambulance dispatch network, purpose-built for hospital partners who demand speed and accountability.
          </p>

          {/* Stat Pills */}
          <div className="flex flex-wrap gap-3">
            {STATS.map(s => (
              <div
                key={s.label}
                className="flex items-center gap-2 px-4 py-2 rounded-full border border-white/25 bg-white/10"
              >
                <span className="text-white font-bold text-sm">{s.value}</span>
                <span className="text-red-200 text-xs">{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right — Login Form */}
      <div className="flex-1 lg:ml-[45%] bg-white flex flex-col min-h-screen">
        <div className="flex-1 flex items-center justify-center px-8 py-12 lg:px-14">
          <div className="w-full max-w-sm">
            <div className="mb-8">
              <h2 className="text-2xl font-bold" style={{ color: '#0F0F0F' }}>Welcome back</h2>
              <p className="text-sm mt-1.5" style={{ color: '#6B6560' }}>
                Sign in to your hospital partner account
              </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: '#0F0F0F' }}>
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="admin@hospital.com"
                  className="w-full px-4 py-3 rounded-xl text-sm border transition focus:outline-none focus:ring-2 focus:ring-ambu-red focus:border-transparent"
                  style={{ borderColor: '#E5E2DC', color: '#0F0F0F' }}
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-sm font-medium" style={{ color: '#0F0F0F' }}>
                    Password
                  </label>
                  <button
                    type="button"
                    className="text-xs transition hover:opacity-70"
                    style={{ color: '#6B6560' }}
                  >
                    Forgot password?
                  </button>
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-3 rounded-xl text-sm border transition focus:outline-none focus:ring-2 focus:ring-ambu-red focus:border-transparent"
                  style={{ borderColor: '#E5E2DC', color: '#0F0F0F' }}
                />
              </div>

              {error && (
                <div className="flex items-start gap-2.5 bg-red-50 border border-red-100 text-red-700 rounded-xl p-3.5 text-sm">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-ambu-red hover:bg-ambu-red-dark text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed shadow-sm"
              >
                {loading
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Signing in…</>
                  : <>Sign In <ArrowRight className="w-4 h-4" /></>
                }
              </button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-sm" style={{ color: '#6B6560' }}>
                Not a partner yet?{' '}
                <button
                  type="button"
                  onClick={() => alert('Contact dhruvchopra@ambuquick.com to get access')}
                  className="text-ambu-red font-semibold hover:underline"
                >
                  Request Access
                </button>
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-8 py-5 text-center border-t" style={{ borderColor: '#E5E2DC' }}>
          <p className="text-xs" style={{ color: '#6B6560' }}>
            © 2026 AmbuQuick · ambuquick.com
          </p>
        </div>
      </div>
    </div>
  )
}
