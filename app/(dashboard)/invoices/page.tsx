'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Invoice, InvoiceItem, Hospital } from '@/types'
import { format } from 'date-fns'
import { FileText, Download, Plus, Loader2, X, CheckCircle, Clock, IndianRupee } from 'lucide-react'

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [hospital, setHospital] = useState<Hospital | null>(null)
  const [hospitalId, setHospitalId] = useState('')
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Invoice | null>(null)
  const [items, setItems] = useState<InvoiceItem[]>([])
  const [itemsLoading, setItemsLoading] = useState(false)
  const [creating, setCreating] = useState(false)

  const fetchInvoices = async (supabase: ReturnType<typeof createClient>) => {
    const { data } = await supabase
      .from('invoices')
      .select('*')
      .order('created_at', { ascending: false })
    setInvoices((data as Invoice[]) || [])
  }

  useEffect(() => {
    const supabase = createClient()
    async function init() {
      try {
        const { data: profile } = await supabase.from('user_profiles').select('hospital_id').single()
        if (profile?.hospital_id) setHospitalId(profile.hospital_id)

        const { data: hospitalData } = await supabase.from('hospitals').select('*').single()
        if (hospitalData) setHospital(hospitalData as Hospital)

        await fetchInvoices(supabase)
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [])

  const loadItems = async (inv: Invoice) => {
    setSelected(inv)
    setItemsLoading(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('invoice_items')
      .select('*')
      .eq('invoice_id', inv.id)
    setItems((data as InvoiceItem[]) || [])
    setItemsLoading(false)
  }

  const markPaid = async (inv: Invoice) => {
    const supabase = createClient()
    await supabase.from('invoices').update({ status: 'paid' }).eq('id', inv.id)
    setInvoices(prev => prev.map(i => i.id === inv.id ? { ...i, status: 'paid' } : i))
    setSelected(prev => prev?.id === inv.id ? { ...prev, status: 'paid' } : prev)
  }

  const createInvoice = async () => {
    setCreating(true)
    const supabase = createClient()
    const now = new Date()
    const periodLabel = format(now, 'MMMM yyyy')
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

    const { data: rides } = await supabase
      .from('rides')
      .select('*')
      .eq('status', 'completed')
      .gte('created_at', startOfMonth)
      .not('amount', 'is', null)

    if (!rides || rides.length === 0) {
      alert('No completed rides this month to generate an invoice.')
      setCreating(false)
      return
    }

    const subtotal = rides.reduce((s, r) => s + (r.amount || 0), 0)
    const gst = Math.round(subtotal * 0.18 * 100) / 100
    const total = Math.round((subtotal + gst) * 100) / 100

    const { data: inv } = await supabase
      .from('invoices')
      .insert({ hospital_id: hospitalId, period_label: periodLabel, total_rides: rides.length, subtotal, gst, total, status: 'pending' })
      .select('id')
      .single()

    if (inv?.id) {
      await supabase.from('invoice_items').insert(
        rides.map(r => ({
          invoice_id: inv.id,
          description: `${r.urgency} — ${r.patient_name} (${format(new Date(r.created_at), 'dd MMM')})`,
          quantity: 1, rate: r.amount, amount: r.amount,
        }))
      )
    }

    await fetchInvoices(supabase)
    setCreating(false)
  }

  const downloadPDF = async () => {
    if (!selected || !hospital) return
    const { default: jsPDF } = await import('jspdf')
    const { default: autoTable } = await import('jspdf-autotable')

    const doc = new jsPDF()
    const pageW = doc.internal.pageSize.getWidth()

    doc.setFillColor(217, 26, 42)
    doc.rect(0, 0, pageW, 28, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(20); doc.setFont('helvetica', 'bold')
    doc.text('AmbuQuick', 15, 18)
    doc.setFontSize(10); doc.setFont('helvetica', 'normal')
    doc.text('Emergency Medical Services', 15, 24)

    doc.setTextColor(50, 50, 50)
    doc.setFontSize(18); doc.setFont('helvetica', 'bold')
    doc.text('INVOICE', 15, 42)
    doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(100, 100, 100)
    doc.text(`Period: ${selected.period_label}`, 15, 50)
    doc.text(`Date: ${format(new Date(selected.created_at), 'dd MMMM yyyy')}`, 15, 57)
    doc.text(`Invoice ID: #${selected.id.substring(0, 8).toUpperCase()}`, 15, 64)

    doc.setFontSize(10); doc.setFont('helvetica', 'bold')
    if (selected.status === 'paid') { doc.setTextColor(22, 163, 74); doc.text('● PAID', pageW - 40, 50) }
    else { doc.setTextColor(234, 88, 12); doc.text('● PENDING', pageW - 45, 50) }

    doc.setFillColor(248, 250, 252)
    doc.rect(15, 72, pageW - 30, 26, 'F')
    doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(100, 100, 100)
    doc.text('BILLED TO', 20, 80)
    doc.setFont('helvetica', 'bold'); doc.setTextColor(30, 30, 30); doc.setFontSize(11)
    doc.text(hospital.name, 20, 87)
    doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(80, 80, 80)
    doc.text(`${hospital.city} | ${hospital.email}`, 20, 93)

    autoTable(doc, {
      startY: 108,
      head: [['#', 'Description', 'Qty', 'Rate (₹)', 'Amount (₹)']],
      body: items.map((item, i) => [i + 1, item.description, item.quantity, item.rate.toLocaleString('en-IN'), item.amount.toLocaleString('en-IN')]),
      headStyles: { fillColor: [217, 26, 42], textColor: 255, fontStyle: 'bold', fontSize: 9 },
      bodyStyles: { fontSize: 8.5, textColor: [50, 50, 50] },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: { 0: { cellWidth: 10 }, 2: { cellWidth: 12 }, 3: { cellWidth: 25 }, 4: { cellWidth: 28 } },
    })

    const finalY = (doc as any).lastAutoTable.finalY + 8
    doc.setFillColor(248, 250, 252)
    doc.rect(pageW - 90, finalY, 75, 36, 'F')
    doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(80, 80, 80)
    doc.text(`Subtotal:`, pageW - 88, finalY + 8)
    doc.text(`₹${selected.subtotal.toLocaleString('en-IN')}`, pageW - 20, finalY + 8, { align: 'right' })
    doc.text(`GST (18%):`, pageW - 88, finalY + 16)
    doc.text(`₹${selected.gst.toLocaleString('en-IN')}`, pageW - 20, finalY + 16, { align: 'right' })
    doc.setDrawColor(217, 26, 42)
    doc.line(pageW - 88, finalY + 19, pageW - 17, finalY + 19)
    doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(217, 26, 42)
    doc.text('Total Due:', pageW - 88, finalY + 28)
    doc.text(`₹${selected.total.toLocaleString('en-IN')}`, pageW - 20, finalY + 28, { align: 'right' })
    doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(160, 160, 160)
    doc.text('AmbuQuick Pvt. Ltd. · emergency@ambuquick.in · +91-11-4000-0000', pageW / 2, 285, { align: 'center' })

    doc.save(`AmbuQuick-Invoice-${selected.period_label.replace(' ', '-')}.pdf`)
  }

  if (loading) {
    return <div className="p-6 lg:p-8 flex items-center justify-center min-h-[60vh]">
      <div className="w-8 h-8 border-2 border-ambu-red border-t-transparent rounded-full animate-spin" />
    </div>
  }

  return (
    <div className="p-6 lg:p-8 space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><FileText className="w-6 h-6 text-ambu-red" /> Invoices</h1>
          <p className="text-sm text-gray-500 mt-0.5">View and download AmbuQuick service invoices</p>
        </div>
        <button onClick={createInvoice} disabled={creating}
          className="flex items-center gap-1.5 bg-ambu-red text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-ambu-red-dark transition-colors shadow-sm disabled:opacity-60 flex-shrink-0">
          {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Create Invoice
        </button>
      </div>

      <div className="flex flex-col lg:flex-row gap-5">
        <div className="lg:w-96 space-y-3">
          {invoices.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
              <FileText className="w-10 h-10 text-gray-200 mx-auto mb-3" />
              <p className="text-gray-400 text-sm">No invoices yet</p>
              <p className="text-xs text-gray-300 mt-1">Click "Create Invoice" to generate your first invoice</p>
            </div>
          ) : invoices.map(inv => (
            <button key={inv.id} onClick={() => loadItems(inv)}
              className={`w-full text-left bg-white rounded-2xl border shadow-sm p-4 transition-all hover:shadow-md ${selected?.id === inv.id ? 'border-ambu-red ring-1 ring-ambu-red' : 'border-gray-100'}`}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-gray-900">{inv.period_label}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{inv.total_rides} rides · {format(new Date(inv.created_at), 'dd MMM yyyy')}</p>
                </div>
                <span className={`flex-shrink-0 flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${inv.status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                  {inv.status === 'paid' ? <CheckCircle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                  {inv.status === 'paid' ? 'Paid' : 'Pending'}
                </span>
              </div>
              <div className="mt-3 pt-3 border-t border-gray-50 flex justify-between items-center">
                <span className="text-xs text-gray-400">Total Due</span>
                <span className="font-bold text-gray-900">₹{inv.total.toLocaleString('en-IN')}</span>
              </div>
            </button>
          ))}
        </div>

        {selected ? (
          <div className="flex-1 bg-white rounded-2xl border border-gray-100 shadow-sm">
            <div className="bg-ambu-red rounded-t-2xl p-6 text-white">
              <div className="flex items-start justify-between">
                <div><p className="text-2xl font-bold">AmbuQuick</p><p className="text-red-200 text-sm">Emergency Medical Services</p></div>
                <button onClick={() => setSelected(null)} className="text-red-200 hover:text-white"><X className="w-5 h-5" /></button>
              </div>
              <div className="mt-4 flex items-end justify-between">
                <div><p className="text-red-200 text-xs uppercase tracking-wider">Invoice Period</p><p className="text-xl font-semibold">{selected.period_label}</p></div>
                <span className={`px-3 py-1.5 rounded-full text-sm font-bold ${selected.status === 'paid' ? 'bg-green-500 text-white' : 'bg-orange-400 text-white'}`}>
                  {selected.status === 'paid' ? '✓ PAID' : 'PENDING'}
                </span>
              </div>
            </div>
            <div className="p-6 space-y-5">
              {hospital && (
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Billed To</p>
                  <p className="font-bold text-gray-900">{hospital.name}</p>
                  <p className="text-sm text-gray-500">{hospital.city}</p>
                  <p className="text-sm text-gray-500">{hospital.email}</p>
                </div>
              )}
              {itemsLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-gray-300" /></div>
              ) : (
                <div>
                  <p className="text-sm font-semibold text-gray-700 mb-3">Itemized Rides</p>
                  <div className="border border-gray-100 rounded-xl overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b border-gray-100">
                        <tr>
                          <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500">Description</th>
                          <th className="text-center px-4 py-2.5 text-xs font-semibold text-gray-500">Qty</th>
                          <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {items.map(item => (
                          <tr key={item.id} className="hover:bg-gray-50">
                            <td className="px-4 py-2.5 text-xs text-gray-700">{item.description}</td>
                            <td className="px-4 py-2.5 text-xs text-center text-gray-500">{item.quantity}</td>
                            <td className="px-4 py-2.5 text-xs text-right font-medium text-gray-900">₹{(item.amount || 0).toLocaleString('en-IN')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              <div className="ml-auto max-w-xs space-y-2 border-t border-gray-100 pt-4">
                <div className="flex justify-between text-sm text-gray-500"><span>Subtotal</span><span>₹{selected.subtotal.toLocaleString('en-IN')}</span></div>
                <div className="flex justify-between text-sm text-gray-500"><span>GST (18%)</span><span>₹{selected.gst.toLocaleString('en-IN')}</span></div>
                <div className="flex justify-between font-bold text-ambu-red text-base border-t border-gray-200 pt-2"><span>Total Due</span><span>₹{selected.total.toLocaleString('en-IN')}</span></div>
              </div>
              <div className="flex flex-wrap gap-2 pt-2">
                <button onClick={downloadPDF} className="flex items-center gap-2 bg-ambu-red text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-ambu-red-dark transition-colors">
                  <Download className="w-4 h-4" /> Download PDF
                </button>
                {selected.status === 'pending' && (
                  <button onClick={() => markPaid(selected)} className="flex items-center gap-2 bg-green-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-green-700 transition-colors">
                    <CheckCircle className="w-4 h-4" /> Mark as Paid
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 bg-white rounded-2xl border border-gray-100 shadow-sm flex items-center justify-center">
            <div className="text-center py-16">
              <IndianRupee className="w-10 h-10 text-gray-200 mx-auto mb-3" />
              <p className="text-gray-400 text-sm">Select an invoice to view details</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
