'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Hospital } from '@/types'
import { toast } from 'sonner'
import { Settings, Save, Loader2, CheckCircle, Users, Mail, Send } from 'lucide-react'

interface TeamMember { email: string; user_id: string }

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-ambu-border/60 rounded-lg ${className}`} />
}

const inputCls = 'w-full px-4 py-2.5 border border-ambu-border rounded-xl text-sm text-ambu-dark focus:outline-none focus:ring-2 focus:ring-ambu-red focus:border-transparent transition'

export default function SettingsPage() {
  const [hospital, setHospital] = useState<Hospital | null>(null)
  const [form, setForm] = useState({ name: '', contact_person: '', city: '', email: '' })
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [team, setTeam] = useState<TeamMember[]>([])
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviting, setInviting] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    async function load() {
      const [{ data: h }, res] = await Promise.all([
        supabase.from('hospitals').select('*').single(),
        fetch('/api/team'),
      ])
      if (h) { setHospital(h as Hospital); setForm({ name: h.name, contact_person: h.contact_person || '', city: h.city || '', email: h.email || '' }) }
      if (res.ok) setTeam(await res.json())
      setLoading(false)
    }
    load()
  }, [])

  const handleSave = async () => {
    if (!hospital) return
    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase.from('hospitals').update({ name: form.name, contact_person: form.contact_person, city: form.city }).eq('id', hospital.id)
    if (error) toast.error('Failed to save: ' + error.message)
    else toast.success('Hospital profile saved!')
    setSaving(false)
  }

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return
    setInviting(true)
    const res = await fetch('/api/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: inviteEmail }),
    })
    const data = await res.json()
    if (res.ok) {
      toast.success('Invite sent! They will receive an email to set their password.')
      setInviteEmail('')
    } else {
      toast.error(data.error || 'Failed to send invite')
    }
    setInviting(false)
  }

  return (
    <div className="p-5 lg:p-7 max-w-2xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-ambu-dark flex items-center gap-2">
          <Settings className="w-6 h-6 text-ambu-red" /> Settings
        </h1>
        <p className="text-sm text-ambu-muted mt-0.5">Manage your hospital profile and team</p>
      </div>

      {/* Hospital Profile */}
      <div className="bg-white rounded-2xl border border-ambu-border shadow-sm p-6 space-y-4">
        <h2 className="font-semibold text-ambu-dark">Hospital Profile</h2>
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-12" />)}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-ambu-dark mb-1.5">Hospital Name</label>
              <input
                value={form.name}
                onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-ambu-dark mb-1.5">Contact Person</label>
              <input
                value={form.contact_person}
                onChange={e => setForm(p => ({ ...p, contact_person: e.target.value }))}
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-ambu-dark mb-1.5">City</label>
              <input
                value={form.city}
                onChange={e => setForm(p => ({ ...p, city: e.target.value }))}
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-ambu-dark mb-1.5">Email</label>
              <input
                value={form.email}
                disabled
                className="w-full px-4 py-2.5 border border-ambu-border rounded-xl text-sm bg-ambu-bg text-ambu-muted cursor-not-allowed"
              />
              <p className="text-xs text-ambu-muted mt-1">Email cannot be changed</p>
            </div>
          </div>
        )}
        <button
          onClick={handleSave}
          disabled={saving || loading}
          className="flex items-center gap-2 bg-ambu-red text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-ambu-red-dark transition disabled:opacity-60"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save Changes
        </button>
      </div>

      {/* Team Members */}
      <div className="bg-white rounded-2xl border border-ambu-border shadow-sm p-6 space-y-4">
        <h2 className="font-semibold text-ambu-dark flex items-center gap-2">
          <Users className="w-4 h-4 text-ambu-red" /> Team Members
        </h2>

        {loading ? (
          <div className="space-y-2">{[...Array(2)].map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
        ) : team.length === 0 ? (
          <p className="text-sm text-ambu-muted">No team members yet</p>
        ) : (
          <div className="space-y-2">
            {team.map(member => (
              <div key={member.user_id} className="flex items-center gap-3 bg-ambu-bg border border-ambu-border rounded-xl px-4 py-3">
                <div className="w-8 h-8 bg-ambu-red/10 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-ambu-red font-bold text-sm">{member.email[0].toUpperCase()}</span>
                </div>
                <span className="text-sm text-ambu-dark">{member.email}</span>
                <span className="ml-auto text-xs text-ambu-muted border border-ambu-border px-2 py-0.5 rounded-full">Staff</span>
              </div>
            ))}
          </div>
        )}

        <div className="border-t border-ambu-border pt-4 space-y-3">
          <h3 className="text-sm font-semibold text-ambu-dark flex items-center gap-2">
            <Mail className="w-4 h-4" /> Invite Staff Member
          </h3>
          <div className="flex gap-2">
            <input
              type="email"
              value={inviteEmail}
              onChange={e => setInviteEmail(e.target.value)}
              placeholder="staff@hospital.com"
              className={`flex-1 ${inputCls}`}
            />
            <button
              onClick={handleInvite}
              disabled={inviting || !inviteEmail.trim()}
              className="flex items-center gap-2 bg-ambu-dark text-white px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-ambu-dark/80 transition disabled:opacity-60"
            >
              {inviting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Invite
            </button>
          </div>
          <p className="text-xs text-ambu-muted">
            They will receive an email invite and can log in with the same hospital account.
          </p>
        </div>
      </div>

      {/* Copyright */}
      <p className="text-xs text-ambu-muted text-center pt-2">© 2026 AmbuQuick · ambuquick.com</p>
    </div>
  )
}
