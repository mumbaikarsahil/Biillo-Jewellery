'use client'

import React, { useEffect, useState, useRef, use } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'
import { Button } from '@/components/ui/button'
import { Printer, ArrowLeft, Truck } from 'lucide-react'
import QRCode from 'react-qr-code'
import { useReactToPrint } from 'react-to-print'

export default function TransferVoucher({ params }: { params: Promise<{ id: string }> }) {
  // Unwrap the params using React.use() to fix the Next.js 15 warning
  const resolvedParams = use(params)
  const transferId = resolvedParams.id

  const [transfer, setTransfer] = useState<any>(null)
  const voucherRef = useRef<HTMLDivElement>(null)

  const handlePrint = useReactToPrint({
    contentRef: voucherRef,
    documentTitle: `Transfer-Voucher-${transfer?.transfer_number || 'TRF'}`,
  })

  useEffect(() => {
    const fetchTransfer = async () => {
      const { data } = await supabase
        .from('stock_transfers')
        .select('*, from:from_warehouse_id(name), to:to_warehouse_id(name), items:stock_transfer_item_lines(inventory_items(*))')
        .eq('id', transferId)
        .single()
      setTransfer(data)
    }
    
    if (transferId) {
      fetchTransfer()
    }
  }, [transferId])

  if (!transfer) {
    return (
      <div className="min-h-screen bg-[#fafafa] flex items-center justify-center">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="h-8 w-8 rounded-full border-4 border-slate-200 border-t-indigo-600 animate-spin" />
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Generating Ledger...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#fafafa] font-sans selection:bg-indigo-100 pb-20">
      
      {/* --- UI HEADER (Not Printed) --- */}
      <header className="h-14 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center sticky top-0 z-40 shadow-sm box-border print:hidden">
        <div className="w-full max-w-4xl mx-auto flex justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <Link href="/transfer">
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-md hover:bg-slate-100 text-slate-500">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div className="h-4 w-px bg-slate-200" />
            <div className="flex items-center gap-2">
              <Truck className="w-4 h-4 text-indigo-500" />
              <h1 className="text-sm font-semibold text-slate-900 tracking-tight leading-none">Transfer Voucher</h1>
            </div>
            <span className="hidden sm:inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50 text-indigo-600 border border-indigo-100 uppercase tracking-widest ml-2">
              {transfer.transfer_number}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button onClick={handlePrint} className="h-8 px-4 text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white rounded-md shadow-sm transition-none">
              <Printer className="w-3.5 h-3.5 mr-1.5" /> Print Manifest
            </Button>
          </div>
        </div>
      </header>

      {/* --- PRINTABLE VOUCHER --- */}
      <div className="p-4 sm:p-8 flex justify-center print:p-0 print:block">
        
        {/* CSS INJECTION: Forces perfect A4 printing boundaries */}
        <style type="text/css" media="print">
          {`
            @page { 
              size: A4 portrait; 
              margin: 15mm; /* Provides safe margins so nothing touches the edge */
            }
            body { 
              -webkit-print-color-adjust: exact; 
              print-color-adjust: exact; 
            }
          `}
        </style>

        <div 
          ref={voucherRef} 
          /* print:max-w-none print:w-full forces it to fit within the 15mm A4 margins */
          className="bg-white p-8 sm:p-12 border border-slate-200 shadow-sm w-full max-w-4xl print:border-none print:shadow-none print:p-0 print:w-full print:max-w-none"
        >
          
          {/* VOUCHER HEADER */}
          <div className="flex justify-between items-end border-b border-slate-200 pb-6 mb-8">
            <div className="flex flex-col gap-2">
              {/* LOGO INJECTION */}
              <img 
                src="/pavitram-logo.jpg" 
                alt="Pavitram Logo" 
                className="h-16 w-auto object-contain object-left" 
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  e.currentTarget.parentElement?.insertAdjacentHTML('beforeend', '<h2 class="text-2xl font-black text-slate-900 tracking-tight uppercase">Pavitram Jewels</h2>');
                }}
              />
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Official Stock Transfer Voucher</p>
            </div>
            <div className="text-right">
              <p className="font-mono text-2xl font-black text-slate-900 tracking-tighter">{transfer.transfer_number}</p>
              <p className="text-xs font-medium text-slate-500 mt-1">
                {new Date(transfer.dispatched_at || transfer.created_at).toLocaleString('en-IN', {
                  day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                })}
              </p>
            </div>
          </div>

          {/* ROUTE INFORMATION */}
          <div className="grid grid-cols-2 gap-8 bg-slate-50/50 border border-slate-100 p-6 rounded-xl mb-8 print:bg-slate-50 print:border-slate-200">
            <div>
              <p className="text-[10px] font-bold uppercase text-slate-400 tracking-widest mb-1.5">From (Sender)</p>
              <p className="font-bold text-lg text-slate-900 leading-none">{transfer.from.name}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase text-indigo-400 tracking-widest mb-1.5 print:text-slate-500">To (Receiver)</p>
              <p className="font-bold text-lg text-indigo-700 leading-none print:text-slate-900">{transfer.to.name}</p>
            </div>
          </div>

          {/* MANIFEST TABLE */}
          <table className="w-full border-collapse mb-12">
            <thead>
              <tr className="border-b-2 border-slate-200 text-left">
                <th className="py-3 px-2 text-[10px] font-bold uppercase tracking-widest text-slate-400 w-12">#</th>
                <th className="py-3 px-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">Asset Barcode</th>
                <th className="py-3 px-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">Category / Profile</th>
                <th className="py-3 px-2 text-[10px] font-bold uppercase tracking-widest text-slate-400 text-right">Net Wt (g)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {transfer.items.map((line: any, idx: number) => (
                <tr key={idx} className="text-sm text-slate-800 print:break-inside-avoid">
                  <td className="py-3 px-2 text-slate-400 font-medium">{idx + 1}</td>
                  <td className="py-3 px-2 font-mono font-bold text-slate-900">{line.inventory_items.barcode}</td>
                  <td className="py-3 px-2">
                    <span className="font-semibold">{line.inventory_items.item_category}</span>
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider ml-2">
                      ({line.inventory_items.metal_type} {line.inventory_items.purity_karat})
                    </span>
                  </td>
                  <td className="py-3 px-2 text-right font-bold">{line.inventory_items.net_weight_g.toFixed(3)}g</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-900">
                <td colSpan={3} className="py-3 px-2 text-right text-xs font-bold uppercase tracking-widest text-slate-500">Total Net Weight</td>
                <td className="py-3 px-2 text-right font-black text-slate-900">
                  {transfer.items.reduce((sum: number, line: any) => sum + (line.inventory_items.net_weight_g || 0), 0).toFixed(3)}g
                </td>
              </tr>
            </tfoot>
          </table>

          {/* SIGNATURES & AUTHENTICATION BLOCK */}
          <div className="flex justify-between items-end pt-8 mt-auto print:break-inside-avoid">
            
            {/* Left: Authentication QR */}
            <div className="text-center flex flex-col items-center w-48">
              <div className="bg-white p-3 border border-slate-200 rounded-xl shadow-sm inline-block">
                {/* QR Code holds the UUID for the scanner */}
                <QRCode value={transfer.id} size={100} level="M" />
              </div>
              
              {/* HUMAN READABLE TRF NUMBER */}
              <p className="text-base font-mono font-black text-slate-900 mt-3 tracking-widest">
                {transfer.transfer_number}
              </p>
              <p className="text-[9px] font-bold uppercase text-slate-400 tracking-widest mt-0.5">Scan or Enter to Receive</p>
            </div>
            
            {/* Right: Physical Signatures */}
            <div className="flex flex-col gap-12 text-right">
              <div className="border-t-2 border-slate-200 w-56 pt-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                Authorized Dispatch (Sender)
              </div>
              <div className="border-t-2 border-slate-200 w-56 pt-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                Verified Receipt (Destination)
              </div>
            </div>
            
          </div>
        </div>
      </div>
    </div>
  )
}