'use client'

import React, { useEffect, useState, useRef, use } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'
import { Button } from '@/components/ui/button'
import { Printer, ArrowLeft, Truck, AlertTriangle, ShieldCheck, Box } from 'lucide-react'
import QRCode from 'react-qr-code'
import { useReactToPrint } from 'react-to-print'
import { Badge } from '@/components/ui/badge'

export default function TransferVoucher({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params)
  const transferId = resolvedParams.id

  const [transfer, setTransfer] = useState<any>(null)
  
  // Three separate refs for the three different print jobs
  const masterRef = useRef<HTMLDivElement>(null)
  const outerRef = useRef<HTMLDivElement>(null)
  const innerRef = useRef<HTMLDivElement>(null)

  const handlePrintMaster = useReactToPrint({ contentRef: masterRef, documentTitle: `Ledger-${transfer?.transfer_number}` })
  const handlePrintOuter = useReactToPrint({ contentRef: outerRef, documentTitle: `Outer-Label-${transfer?.transfer_number}` })
  const handlePrintInner = useReactToPrint({ contentRef: innerRef, documentTitle: `Inner-Manifest-${transfer?.transfer_number}` })

  useEffect(() => {
    const fetchTransfer = async () => {
      const { data } = await supabase
        .from('stock_transfers')
        .select('*, from:from_warehouse_id(name), to:to_warehouse_id(name), items:stock_transfer_item_lines(inventory_items(*))')
        .eq('id', transferId)
        .single()
      setTransfer(data)
    }
    if (transferId) fetchTransfer()
  }, [transferId])

  if (!transfer) {
    return (
      <div className="min-h-screen bg-[#fafafa] flex items-center justify-center">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="h-8 w-8 rounded-full border-4 border-slate-200 border-t-indigo-600 animate-spin" />
        </div>
      </div>
    )
  }

  const isDisputed = transfer.status === 'disputed'

  return (
    <div className="min-h-screen bg-[#fafafa] font-sans selection:bg-indigo-100 pb-20">
      
      {/* HEADER */}
      <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center sticky top-0 z-40 shadow-sm print:hidden">
        <div className="w-full max-w-5xl mx-auto flex justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <Link href="/transfer">
              <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div className="h-4 w-px bg-slate-200" />
            <h1 className="text-sm font-semibold text-slate-900">Transfer Ledger</h1>
            <Badge variant="outline" className="uppercase tracking-widest text-[10px] ml-2 font-mono">
              {transfer.transfer_number}
            </Badge>
          </div>

          <div className="flex items-center gap-2">
            <Button onClick={handlePrintOuter} variant="outline" className="h-8 px-3 text-xs border-orange-200 text-orange-700 hover:bg-orange-50">
              <Printer className="w-3.5 h-3.5 mr-1.5" /> Outer Label
            </Button>
            <Button onClick={handlePrintInner} variant="outline" className="h-8 px-3 text-xs border-indigo-200 text-indigo-700 hover:bg-indigo-50">
              <Printer className="w-3.5 h-3.5 mr-1.5" /> Inner Secure Print
            </Button>
            <Button onClick={handlePrintMaster} className="h-8 px-4 text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white shadow-sm">
              <Printer className="w-3.5 h-3.5 mr-1.5" /> Print HO Ledger
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4 sm:p-8 space-y-6 print:hidden">
        
        {/* DISPUTE ALERT */}
        {isDisputed && (
          <div className="bg-red-50 border-2 border-red-500 rounded-xl p-6 flex items-start gap-4 shadow-sm animate-in fade-in">
             <AlertTriangle className="h-8 w-8 text-red-600 shrink-0 mt-1" />
             <div>
               <h2 className="text-lg font-black text-red-700 uppercase tracking-widest">Security Dispute Flagged</h2>
               <p className="text-red-900 font-medium mt-1">
                 The receiving branch ({transfer.to.name}) reported missing inventory upon breaking the seal. 
                 Check inventory logs immediately.
               </p>
             </div>
          </div>
        )}

        {/* SECURITY DATA OVERVIEW */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white border border-slate-200 p-4 rounded-xl flex flex-col justify-between">
             <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Physical Seal No.</p>
             <p className="text-xl font-mono font-black text-slate-900">{transfer.seal_number || 'N/A'}</p>
          </div>
          <div className="bg-white border border-slate-200 p-4 rounded-xl flex flex-col justify-between">
             <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Outer QR Hash</p>
             <p className="text-xs font-mono font-bold text-slate-500 break-all">{transfer.outer_qr_hash || 'N/A'}</p>
          </div>
          <div className="bg-white border border-slate-200 p-4 rounded-xl flex flex-col justify-between">
             <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Inner QR Hash</p>
             <p className="text-xs font-mono font-bold text-slate-500 break-all">{transfer.inner_qr_hash || 'N/A'}</p>
          </div>
        </div>
      </main>

      {/* ========================================================= */}
      {/* HIDDEN PRINT LAYOUTS (Only visible when printing) */}
      {/* ========================================================= */}
      
      <div className="hidden print:block">
        
        {/* 1. MASTER LEDGER (HO COPY) */}
        <div ref={masterRef} className="p-10 bg-white min-h-screen">
          <div className="flex justify-between items-end border-b border-slate-200 pb-6 mb-8">
            <div className="flex flex-col gap-2">
              <h2 className="text-2xl font-black text-slate-900 tracking-tight uppercase">Pavitram Jewels</h2>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Master Transfer Ledger (HO)</p>
            </div>
            <div className="text-right">
              <p className="font-mono text-2xl font-black text-slate-900">{transfer.transfer_number}</p>
              <p className="text-xs font-medium text-slate-500 mt-1">
                {new Date(transfer.dispatched_at || transfer.created_at).toLocaleString('en-IN')}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8 bg-slate-50 border border-slate-200 p-6 rounded-xl mb-8">
            <div>
              <p className="text-[10px] font-bold uppercase text-slate-500 tracking-widest mb-1.5">From</p>
              <p className="font-bold text-lg text-slate-900 leading-none">{transfer.from.name}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase text-slate-500 tracking-widest mb-1.5">To</p>
              <p className="font-bold text-lg text-slate-900 leading-none">{transfer.to.name}</p>
            </div>
          </div>

          <table className="w-full border-collapse mb-12">
            <thead>
              <tr className="border-b-2 border-slate-200 text-left">
                <th className="py-3 px-2 text-[10px] font-bold uppercase text-slate-400 w-12">#</th>
                <th className="py-3 px-2 text-[10px] font-bold uppercase text-slate-400">Barcode</th>
                <th className="py-3 px-2 text-[10px] font-bold uppercase text-slate-400">Category</th>
                <th className="py-3 px-2 text-[10px] font-bold uppercase text-slate-400 text-right">Net Wt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {transfer.items.map((line: any, idx: number) => (
                <tr key={idx} className="text-sm text-slate-800">
                  <td className="py-3 px-2 text-slate-400">{idx + 1}</td>
                  <td className="py-3 px-2 font-mono font-bold text-slate-900">{line.inventory_items.barcode}</td>
                  <td className="py-3 px-2 font-semibold">{line.inventory_items.item_category}</td>
                  <td className="py-3 px-2 text-right font-bold">{line.inventory_items.net_weight_g.toFixed(3)}g</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 2. OUTER BOX LABEL */}
        <div ref={outerRef} className="p-8 w-[100mm] h-[100mm] flex flex-col items-center justify-center border-4 border-black text-center mx-auto">
          <ShieldCheck className="w-12 h-12 text-black mb-2" />
          <h1 className="text-2xl font-black uppercase tracking-widest mb-4">Security Seal</h1>
          
          <div className="bg-white p-2 border-2 border-black inline-block mb-4">
            {/* Renders the Outer Hash for the scanner, with a fallback for old transfers */}
            {transfer.outer_qr_hash ? (
              <QRCode value={transfer.outer_qr_hash} size={150} level="H" />
            ) : (
              <div className="w-[150px] h-[150px] flex items-center justify-center bg-slate-100 text-[10px] text-slate-400 font-bold uppercase tracking-widest text-center border-2 border-dashed border-slate-300">
                Legacy Transfer<br/>No QR Data
              </div>
            )}
          </div>
          
          <p className="text-xs font-bold uppercase tracking-widest mb-1">Verify Seal Number:</p>
          <p className="text-3xl font-mono font-black border-t-2 border-black w-full pt-2">{transfer.seal_number}</p>
        </div>

        {/* 3. INNER SECURE MANIFEST (No Item Details) */}
        <div ref={innerRef} className="p-12 w-full max-w-2xl mx-auto border-2 border-slate-200 h-[150mm] flex flex-col">
          <div className="flex justify-between items-start border-b-2 border-black pb-4 mb-8">
            <h1 className="text-3xl font-black uppercase tracking-tight">Jewellery Shipment</h1>
            <div className="text-right">
              <p className="text-sm font-bold uppercase tracking-widest text-slate-500">Dispatch Date</p>
              <p className="font-mono text-lg font-bold">
                {new Date(transfer.dispatched_at || transfer.created_at).toLocaleDateString('en-IN')}
              </p>
            </div>
          </div>
          
          <div className="flex-1 flex flex-col items-center justify-center space-y-8">
          <div className="bg-white p-4 border border-slate-300 rounded-xl shadow-sm">
  {/* Renders the Inner Hash for the scanner, with a fallback for old transfers */}
  {transfer.inner_qr_hash ? (
    <QRCode value={transfer.inner_qr_hash} size={200} level="H" />
  ) : (
    <div className="w-[200px] h-[200px] flex items-center justify-center bg-slate-50 text-xs text-slate-400 font-bold uppercase tracking-widest text-center border-2 border-dashed border-slate-200 rounded-lg">
      Legacy Transfer<br/>No Secure Hash
    </div>
  )}
</div>
            
            <div className="text-center max-w-sm">
              <p className="text-sm font-bold uppercase tracking-widest text-slate-500 mb-2">Instructions for Receiver</p>
              <p className="text-sm text-slate-700">Scan this code using the internal receiver application to view the hidden manifest and verify contents.</p>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}