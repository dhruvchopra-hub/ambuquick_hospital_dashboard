'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Hospital } from '@/types'
import { Settings, Save, Loader2, CheckCircle, Users, Mail, Send, Trash2 } from 'lucide-react'

interface TeamMember { email: string; user_id: string }

export default function SettingsPage() {
  const [hospital, setHospital] = useState<Hospital | null>(null)
  const [form, setForm] = useState({ name: '', contact_person: '', city: '', email: '' })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)

  const [team, setTeam] = useState<TeamMember[]>([])
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviting, setInviting] = useState(false)
  const [inviteMsg, setInviteMsg] = useState('')

  useEffect(() => {
    const supabase = createClient()
    async function load() {
      try {
        const { data: h } = await supabase.from('hospitals').select('*').single()
        if (h) { setHospital(h as Hospital); setForm({ name: h.name, contact_person: h.contact_person || '', city: h.city || '', email: h.email || '' }) }
        const res = await fetch('/api/team')
        if (res.ok) setTeam(await res.json())
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const handleSave = async () => {
    if (!hospital) return
    setSaving(true)
    const supabase = createClient()
    await supabase.from('hospitals').update({ name: form.name, contact_person: form.contact_person, city: form.city }).eq('id', hospital.id)
    setSaved(true); setTimeout(() => setSaved(false), 3000)
    setSaving(false)
  }

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return
    setInviting(true); setInviteMsg('')
    const res = await fetch('/api/invite', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: inviteEmail }),
    })
    const data = await res.json()
    if (res.ok) { setInviteMsg('Invite sent! They will receive an email to set their password.'); setInviteEmail('') }
    else setInviteMsg(data.error || 'Failed to send invite')
    setInviting(false)
  }

  if (loading) return (
    <div className="p-6 lg:p-8 flex items-center justify-center min-h-[60vh]">
      <div className="w-8 h-8 border-2 border-ambu-red border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="p-6 lg:p-8 max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Settings className="w-6 h-6 text-ambu-red" /> Settings
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">Manage your hospital profile and team</p>
      </div>

      {/* Hospital Profile */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
        <h2 className="font-semibold text-gray-900">Hospital Profile</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Hospital Name</label>
            <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-ambu-red focus:border-transparent" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Contact Person</label>
            <input value={form.contact_person} onChange={e => setForm(p => ({ ...p, contact_person: e.target.value }))}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-ambu-red focus:border-transparent" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">City</label>
            <input value={form.city} onChange={e => setForm(p => ({ ...p, city: e.target.value }))}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-ambu-red focus:border-transparent" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
            <input value={form.email} disabled
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 text-gray-400 cursor-not-allowed" />
            <p className="text-xs text-gray-400 mt-1">Email cannot be changed</p>
          </div>
        </div>
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-2 bg-ambu-red text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-ambu-red-dark transition-all disabled:opacity-60">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <CheckCircle className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          {saved ? 'Saved!' : 'Save Changes'}
        </button>
      </div>

      {/* Team Members */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
        <h2 className="font-semibold text-gray-900 flex items-center gap-2">
          <Users className="w-4 h-4 text-ambu-red" /> Team Members
        </h2>

        {team.length === 0 ? (
          <p className="text-sm text-gray-400">No team members yet</p>
        ) : (
          <div className="space-y-2">
            {team.map(member => (
              <div key={member.user_id} className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-ambu-red/10 rounded-full flex items-center justify-center">
                    <span className="text-ambu-red font-semibold text-sm">{member.email[0].toUpperCase()}</span>
                  </div>
                  <span className="text-sm text-gray-700">{member.email}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Invite */}
        <div className="border-t border-gray-100 pt-4 space-y-3">
          <h3 className="text-sm font-medium text-gray-700 flex items-center gap-2">
            <Mail className="w-4 h-4" /> Invite Staff Member
          </h3>
          <div className="flex gap-2">
            <input
              type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)}
              placeholder="staff@hospital.com"
              className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-ambu-red focus:border-transparent"
            />
            <button onClick={handleInvite} disabled={inviting || !inviteEmail.trim()}
              className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-800 transition-all disabled:opacity-60">
              {inviting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Invite
            </button>
          </div>
          {inviteMsg && (
            <p className={`text-xs ${inviteMsg.startsWith('Invite') ? 'text-green-600' : 'text-red-500'}`}>{inviteMsg}</p>
          )}
          <p className="text-xs text-gray-400">They will receive an email invite and can log in with the same hospital account.</p>
        </div>
      </div>
    </div>
  )
}
