import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const { phone, patientName, hospitalName, driverName, trackingUrl } = await req.json()

    const apiKey = process.env.AISENSY_API_KEY
    if (!apiKey) {
      // No API key configured — log and return success so booking still goes through
      console.warn('AISENSY_API_KEY not configured — WhatsApp skipped')
      return NextResponse.json({ ok: false, skipped: true })
    }

    // Normalise to 12-digit international format (91XXXXXXXXXX)
    const digits = (phone || '').replace(/\D/g, '')
    const destination = digits.length === 10 ? `91${digits}` : digits

    if (destination.length < 10) {
      return NextResponse.json({ ok: false, error: 'Invalid phone number' }, { status: 400 })
    }

    const res = await fetch('https://backend.aisensy.com/campaign/t1/api/v2', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apiKey,
        campaignName: 'ambulance_dispatched',
        destination,
        userName: 'AmbuQuick',
        templateParams: [patientName, hospitalName, driverName, trackingUrl],
        source: 'AmbuQuick Dashboard',
        media: {},
        buttons: [
          {
            type: 'url',
            text: 'Track Ambulance Live 🚑',
            url: trackingUrl,
          },
        ],
      }),
    })

    const data = await res.json().catch(() => ({}))
    return NextResponse.json({ ok: res.ok, data })
  } catch (err) {
    console.error('WhatsApp API error:', err)
    return NextResponse.json({ ok: false, error: 'Internal error' }, { status: 500 })
  }
}
