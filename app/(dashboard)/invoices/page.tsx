'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Invoice, InvoiceItem, Hospital } from '@/types'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { FileText, Download, Plus, Loader2, X, CheckCircle, Clock, IndianRupee } from 'lucide-react'

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-ambu-border/60 rounded-lg ${className}`} />
}

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
    const { data } = await supabase.from('invoices').select('*').order('created_at', { ascending: false })
    setInvoices((data as Invoice[]) || [])
  }

  useEffect(() => {
    const supabase = createClient()
    async function init() {
      const [{ data: profile }, { data: hospitalData }] = await Promise.all([
        supabase.from('user_profiles').select('hospital_id').single(),
        supabase.from('hospitals').select('*').single(),
      ])
      if (profile?.hospital_id) setHospitalId(profile.hospital_id)
      if (hospitalData) setHospital(hospitalData as Hospital)
      await fetchInvoices(supabase)
      setLoading(false)
    }
    init()
  }, [])

  const loadItems = async (inv: Invoice) => {
    setSelected(inv)
    setItemsLoading(true)
    const supabase = createClient()
    const { data } = await supabase.from('invoice_items').select('*').eq('invoice_id', inv.id)
    setItems((data as InvoiceItem[]) || [])
    setItemsLoading(false)
  }

  const markPaid = async (inv: Invoice) => {
    const supabase = createClient()
    await supabase.from('invoices').update({ status: 'paid' }).eq('id', inv.id)
    setInvoices(prev => prev.map(i => i.id === inv.id ? { ...i, status: 'paid' } : i))
    setSelected(prev => prev?.id === inv.id ? { ...prev, status: 'paid' } : prev)
    toast.success('Invoice marked as paid')
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
      toast.error('No completed rides this month to generate an invoice.')
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
    toast.success('Invoice created successfully!')
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
    if (selected.status === 'paid') { doc.setTextColor(45, 106, 45); doc.text('● PAID', pageW - 40, 50) }
    else { doc.setTextColor(146, 80, 10); doc.text('● PENDING', pageW - 45, 50) }

    doc.setFillColor(248, 247, 244)
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
      alternateRowStyles: { fillColor: [248, 247, 244] },
      columnStyles: { 0: { cellWidth: 10 }, 2: { cellWidth: 12 }, 3: { cellWidth: 25 }, 4: { cellWidth: 28 } },
    })

    const finalY = (doc as any).lastAutoTable.finalY + 8
    doc.setFillColor(248, 247, 244)
    doc.rect(pageW - 90, finalY, 75, 36, 'F')
    doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(80, 80, 80)
    doc.text('Subtotal:', pageW - 88, finalY + 8)
    doc.text(`₹${selected.subtotal.toLocaleString('en-IN')}`, pageW - 20, finalY + 8, { align: 'right' })
    doc.text('GST (18%):', pageW - 88, finalY + 16)
    doc.text(`₹${selected.gst.toLocaleString('en-IN')}`, pageW - 20, finalY + 16, { align: 'right' })
    doc.setDrawColor(217, 26, 42)
    doc.line(pageW - 88, finalY + 19, pageW - 17, finalY + 19)
    doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(217, 26, 42)
    doc.text('Total Due:', pageW - 88, finalY + 28)
    doc.text(`₹${selected.total.toLocaleString('en-IN')}`, pageW - 20, finalY + 28, { align: 'right' })
    doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(160, 160, 160)
    doc.text('AmbuQuick Pvt. Ltd. · emergency@ambuquick.in · +91-11-4000-0000', pageW / 2, 285, { align: 'center' })
    doc.save(`AmbuQuick-Invoice-${selected.period_label.replace(' ', '-')}.pdf`)
    toast.success('PDF downloaded')
  }

  const totalPaid = invoices.filter(i => i.status === 'paid').reduce((s, i) => s + i.total, 0)
  const totalPending = invoices.filter(i => i.status === 'pending').reduce((s, i) => s + i.total, 0)
  const totalYear = invoices.reduce((s, i) => s + i.total, 0)

  return (
    <div className="p-5 lg:p-7 space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ambu-dark flex items-center gap-2">
            <FileText className="w-6 h-6 text-ambu-red" /> Invoices
          </h1>
          <p className="text-sm text-ambu-muted mt-0.5">View and download AmbuQuick service invoices</p>
        </div>
        <button
          onClick={createInvoice}
          disabled={creating}
          className="flex items-center gap-1.5 bg-ambu-red text-white text-sm font-bold px-4 py-2.5 rounded-xl hover:bg-ambu-red-dark transition shadow-sm disabled:opacity-60 flex-shrink-0"
        >
          {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          Create Invoice
        </button>
      </div>

      {/* Summary */}
      {loading ? (
        <div className="grid grid-cols-3 gap-3">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-white rounded-xl border border-ambu-border shadow-sm p-4">
            <p className="text-xs text-ambu-muted uppercase tracking-wide mb-1">Total Paid</p>
            <p className="text-xl font-bold text-ambu-success">₹{totalPaid.toLocaleString('en-IN')}</p>
          </div>
          <div className="bg-white rounded-xl border border-ambu-border shadow-sm p-4">
            <p className="text-xs text-ambu-muted uppercase tracking-wide mb-1">Total Pending</p>
            <p className="text-xl font-bold text-ambu-warning">₹{totalPending.toLocaleString('en-IN')}</p>
          </div>
          <div className="bg-white rounded-xl border border-ambu-border shadow-sm p-4">
            <p className="text-xs text-ambu-muted uppercase tracking-wide mb-1">Total This Year</p>
            <p className="text-xl font-bold text-ambu-dark">₹{totalYear.toLocaleString('en-IN')}</p>
          </div>
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-5">
        {/* Invoice List */}
        <div className="lg:w-96 space-y-3 flex-shrink-0">
          {loading ? (
            [...Array(4)].map((_, i) => <Skeleton key={i} className="h-28" />)
          ) : invoices.length === 0 ? (
            <div className="bg-white rounded-2xl border border-ambu-border p-10 text-center">
              <FileText className="w-10 h-10 text-ambu-border mx-auto mb-3" />
              <p className="text-ambu-muted text-sm">No invoices yet</p>
              <p className="text-xs text-ambu-muted/60 mt-1">Click "Create Invoice" to generate your first invoice</p>
            </div>
          ) : (
            invoices.map(inv => (
              <button
                key={inv.id}
                onClick={() => loadItems(inv)}
                className={`w-full text-left bg-white rounded-2xl border shadow-sm p-4 transition-all hover:shadow-md ${
                  selected?.id === inv.id ? 'border-ambu-red ring-1 ring-ambu-red' : 'border-ambu-border'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-bold text-ambu-dark">{inv.period_label}</p>
                    <p className="text-xs text-ambu-muted mt-0.5">
                      {inv.total_rides} rides · {format(new Date(inv.created_at), 'dd MMM yyyy')}
                    </p>
                  </div>
                  <span className={`flex-shrink-0 flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${
                    inv.status === 'paid'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-amber-50 text-amber-700 border-amber-200'
                  }`}>
                    {inv.status === 'paid' ? <CheckCircle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                    {inv.status === 'paid' ? 'Paid' : 'Pending'}
                  </span>
                </div>
                <div className="mt-3 pt-3 border-t border-ambu-border flex justify-between items-center">
                  <span className="text-xs text-ambu-muted">Total Due</span>
                  <span className="font-bold text-ambu-dark">₹{inv.total.toLocaleString('en-IN')}</span>
                </div>
              </button>
            ))
          )}
        </div>

        {/* Invoice Detail */}
        {selected ? (
          <div className="flex-1 bg-white rounded-2xl border border-ambu-border shadow-sm overflow-hidden">
            <div className="p-6 text-white" style={{ backgroundColor: '#D91A2A' }}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xl font-bold">AmbuQuick</p>
                  <p className="text-red-200 text-sm">Emergency Medical Services</p>
                </div>
                <button onClick={() => setSelected(null)} className="text-red-200 hover:text-white transition">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="mt-5 flex items-end justify-between">
                <div>
                  <p className="text-red-200 text-xs uppercase tracking-wider">Invoice Period</p>
                  <p className="text-xl font-bold mt-0.5">{selected.period_label}</p>
                  <p className="text-red-200 text-xs mt-1">#{selected.id.substring(0, 8).toUpperCase()}</p>
                </div>
                <span className={`px-3 py-1.5 rounded-full text-sm font-bold ${
                  selected.status === 'paid' ? 'bg-emerald-500 text-white' : 'bg-amber-400 text-white'
                }`}>
                  {selected.status === 'paid' ? '✓ PAID' : 'PENDING'}
                </span>
              </div>
            </div>

            <div className="p-6 space-y-5">
              {hospital && (
                <div className="bg-ambu-bg rounded-xl p-4 border border-ambu-border">
                  <p className="text-xs font-semibold text-ambu-muted uppercase tracking-wider mb-2">Billed To</p>
                  <p className="font-bold text-ambu-dark">{hospital.name}</p>
                  <p className="text-sm text-ambu-muted">{hospital.city}</p>
                  <p className="text-sm text-ambu-muted">{hospital.email}</p>
                </div>
              )}

              {itemsLoading ? (
                <div className="space-y-2">
                  {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-10" />)}
                </div>
              ) : (
                <div>
                  <p className="text-sm font-semibold text-ambu-dark mb-3">Itemized Rides</p>
                  <div className="border border-ambu-border rounded-xl overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-ambu-bg border-b border-ambu-border">
                        <tr>
                          <th className="text-left px-4 py-2.5 text-xs font-semibold text-ambu-muted">Description</th>
                          <th className="text-center px-4 py-2.5 text-xs font-semibold text-ambu-muted">Qty</th>
                          <th className="text-right px-4 py-2.5 text-xs font-semibold text-ambu-muted">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-ambu-border">
                        {items.map(item => (
                          <tr key={item.id} className="hover:bg-ambu-bg/50 transition">
                            <td className="px-4 py-2.5 text-xs text-ambu-dark">{item.description}</td>
                            <td className="px-4 py-2.5 text-xs text-center text-ambu-muted">{item.quantity}</td>
                            <td className="px-4 py-2.5 text-xs text-right font-semibold text-ambu-dark">
                              ₹{(item.amount || 0).toLocaleString('en-IN')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="ml-auto max-w-xs space-y-2 border-t border-ambu-border pt-4">
                <div className="flex justify-between text-sm">
                  <span className="text-ambu-muted">Subtotal</span>
                  <span className="text-ambu-dark">₹{selected.subtotal.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-ambu-muted">GST (18%)</span>
                  <span className="text-ambu-dark">₹{selected.gst.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between font-bold text-ambu-red text-base border-t border-ambu-border pt-2">
                  <span>Total Due</span>
                  <span>₹{selected.total.toLocaleString('en-IN')}</span>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 pt-2">
                <button
                  onClick={downloadPDF}
                  className="flex items-center gap-2 bg-ambu-red text-white px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-ambu-red-dark transition"
                >
                  <Download className="w-4 h-4" /> Download PDF
                </button>
                {selected.status === 'pending' && (
                  <button
                    onClick={() => markPaid(selected)}
                    className="flex items-center gap-2 bg-ambu-success text-white px-4 py-2.5 rounded-xl text-sm font-bold hover:opacity-90 transition"
                  >
                    <CheckCircle className="w-4 h-4" /> Mark as Paid
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 bg-white rounded-2xl border border-ambu-border shadow-sm flex items-center justify-center min-h-64">
            <div className="text-center">
              <IndianRupee className="w-10 h-10 text-ambu-border mx-auto mb-3" />
              <p className="text-ambu-muted text-sm">Select an invoice to view details</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
