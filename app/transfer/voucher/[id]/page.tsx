'use client'

import React, { useEffect, useState, useRef, use } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'
import { Button } from '@/components/ui/button'
import { Printer, ArrowLeft, AlertTriangle, Scissors } from 'lucide-react'
import QRCode from 'react-qr-code'
import { useReactToPrint } from 'react-to-print'
import { Badge } from '@/components/ui/badge'

export default function TransferVoucher({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params)
  const transferId = resolvedParams.id

  const [transfer, setTransfer] = useState<any>(null)
  
  // Two print refs: One for the HO Ledger, One for the Combined Shipping Labels
  const masterRef = useRef<HTMLDivElement>(null)
  const shippingLabelsRef = useRef<HTMLDivElement>(null)

  const handlePrintMaster = useReactToPrint({ contentRef: masterRef, documentTitle: `Ledger-${transfer?.transfer_number}` })
  const handlePrintShippingLabels = useReactToPrint({ contentRef: shippingLabelsRef, documentTitle: `Shipping-Labels-${transfer?.transfer_number}` })

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
          <div className="h-8 w-8 rounded-full border-4 border-slate-200 border-t-black animate-spin" />
        </div>
      </div>
    )
  }

  const isDisputed = transfer.status === 'disputed'
  
  // Calculate total weight for the shipping label
  const totalWeight = transfer.items?.reduce((sum: number, line: any) => sum + (line.inventory_items?.net_weight_g || 0), 0) || 0;
  
  // Generate pseudo-routing codes from warehouse names (e.g., "Juhu Branch" -> "JUH1")
  const fromCode = transfer.from?.name?.substring(0, 4).toUpperCase() || 'ORIG';
  const toCode = transfer.to?.name?.substring(0, 4).toUpperCase() || 'DEST';
  const shortDate = new Date(transfer.dispatched_at || transfer.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' });

  // CSS Trick for generating a realistic looking shipping barcode without an external library
  const barcodeStyle = {
    backgroundImage: 'repeating-linear-gradient(90deg, #000, #000 3px, transparent 3px, transparent 6px, #000 6px, #000 8px, transparent 8px, transparent 11px, #000 11px, #000 16px, transparent 16px, transparent 18px)'
  };

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
            <Button onClick={handlePrintShippingLabels} className="h-8 px-4 text-xs font-bold bg-black hover:bg-slate-800 text-white shadow-sm">
              <Printer className="w-3.5 h-3.5 mr-1.5" /> Print E-Com Labels
            </Button>
            <Button onClick={handlePrintMaster} variant="outline" className="h-8 px-4 text-xs border-slate-200 text-slate-700 hover:bg-slate-50 font-bold shadow-sm">
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
               </p>
             </div>
          </div>
        )}

        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-slate-500 shadow-sm">
          <Printer className="w-12 h-12 mx-auto mb-4 text-slate-300" />
          <h2 className="text-lg font-bold text-slate-700 mb-2">Print Ready</h2>
          <p className="text-sm">Click the "Print E-Com Labels" button above to generate the Amazon-style shipping label.</p>
        </div>
      </main>

      {/* ========================================================= */}
      {/* HIDDEN PRINT LAYOUTS (Only visible when printing) */}
      {/* ========================================================= */}
      
      <div className="hidden print:block">
        
        {/* --------------------------------------------------------- */}
        {/* 1. MASTER LEDGER (HO COPY) */}
        {/* --------------------------------------------------------- */}
        <div ref={masterRef} className="p-10 bg-white min-h-[100vh] w-full max-w-[210mm] mx-auto print:p-0">
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
              {transfer.items?.map((line: any, idx: number) => {
                 if(!line.inventory_items) return null;
                 return (
                  <tr key={idx} className="text-sm text-slate-800">
                    <td className="py-3 px-2 text-slate-400">{idx + 1}</td>
                    <td className="py-3 px-2 font-mono font-bold text-slate-900">{line.inventory_items.barcode}</td>
                    <td className="py-3 px-2 font-semibold">{line.inventory_items.item_category}</td>
                    <td className="py-3 px-2 text-right font-bold">{(line.inventory_items.net_weight_g || 0).toFixed(3)}g</td>
                  </tr>
                 )
              })}
            </tbody>
          </table>
        </div>

        {/* --------------------------------------------------------- */}
        {/* 2. E-COM STYLE SHIPPING LABELS (Stacked Landscape on A4) */}
        {/* --------------------------------------------------------- */}
        <div ref={shippingLabelsRef} className="bg-white min-h-[297mm] w-[210mm] mx-auto print:p-0 flex flex-col justify-center items-center font-sans">
          
          {/* TOP HALF: OUTER LABEL (Landscape 6x4 format - 152x102mm) */}
          <div className="w-[152mm] h-[102mm] bg-white border-[3px] border-black flex flex-col text-black">
            
            {/* Routing Header */}
            <div className="flex border-b-[3px] border-black h-[12mm]">
              <div className="p-1 text-lg font-black border-r-[3px] border-black flex-1 flex items-center justify-center tracking-widest">{fromCode}</div>

              <div className="p-1 text-xs font-bold border-r-[3px] border-black flex-1 flex items-center justify-center">{shortDate}</div>
              <div className="p-1 text-lg font-black bg-black text-white flex-1 flex items-center justify-center tracking-widest">{toCode}</div>
            </div>

            <div className="flex flex-1">
              {/* Left Side: Addresses & Barcode */}
              <div className="flex-[3] border-r-[3px] border-black p-4 flex flex-col justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase text-gray-500 tracking-widest mb-1">Deliver To:</p>
                  <p className="text-2xl font-black uppercase leading-none tracking-tight">{transfer.to.name}</p>
                  <p className="text-[10px] font-bold uppercase text-gray-600 mt-2">From: {transfer.from.name}</p>
                </div>

                {/* Simulated 1D Barcode */}
                <div className="mt-4">
                  <div className="w-full h-[15mm] mb-1" style={barcodeStyle}></div>
                  <p className="text-sm font-black tracking-widest uppercase text-center">{transfer.transfer_number}</p>
                </div>
              </div>

              {/* Right Side: QR & Seal No */}
              <div className="flex-[2] flex flex-col items-center justify-center p-4 bg-gray-50">
                {transfer.outer_qr_hash ? (
                  <div className="border-[3px] border-black p-2 bg-white">
                    <QRCode value={transfer.outer_qr_hash} size={100} level="H" />
                  </div>
                ) : (
                  <div className="w-[100px] h-[100px] border-2 border-dashed border-gray-400 flex items-center justify-center text-[10px] font-bold text-center uppercase tracking-widest">No Hash<br/>Legacy</div>
                )}
                
                <div className="mt-4 text-center w-full">
                  <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-0.5">Seal Number</p>
                  <p className="text-xl font-mono font-black tracking-widest">{transfer.seal_number}</p>
                </div>
              </div>
            </div>
          </div>

          {/* HORIZONTAL SCISSOR CUT LINE */}
          <div className="w-[152mm] border-b-2 border-dashed border-gray-400 flex items-center justify-center relative my-6">
             <div className="absolute bg-white px-2 text-gray-400 flex items-center gap-2">
               <Scissors className="w-4 h-4" />
               <span className="text-[10px] font-bold uppercase tracking-widest">Cut Here</span>
             </div>
          </div>

          {/* BOTTOM HALF: INNER MANIFEST (Landscape 6x4 format - 152x102mm) */}
          <div className="w-[152mm] h-[102mm] bg-white border-[3px] border-black flex flex-col text-black">
            
            {/* Header */}
            <div className="flex border-b-[3px] border-black h-[12mm]">
              <div className="p-1 text-lg font-black border-r-[3px] border-black flex-[3] flex items-center justify-center tracking-widest">INNER SECURE MANIFEST</div>
              <div className="p-1 text-lg font-black bg-black text-white flex-1 flex items-center justify-center tracking-widest">LOCK</div>
            </div>

            <div className="flex flex-1">
              {/* Left Side: Instructions & Info */}
              <div className="flex-[3] border-r-[3px] border-black p-4 flex flex-col justify-between">
                <div className="text-center mt-2">
                  <h2 className="text-3xl font-black uppercase tracking-tighter">PLACE INSIDE</h2>
                  <p className="text-[10px] font-bold uppercase text-gray-600 mt-2 tracking-widest">Do not stick on outer box</p>
                </div>
                
                <div className="bg-black text-white text-center p-2 font-black uppercase tracking-widest text-sm">
                  Scan On Receipt
                </div>
                
                <div className="flex justify-between items-end text-[9px] font-bold uppercase text-gray-600">
                  <div className="flex flex-col">
                    <span>TRX ID</span>
                    <span className="text-sm text-black">{transfer.transfer_number}</span>
                  </div>
                  <div className="text-right flex flex-col">
                    <span>Packed On</span>
                    <span className="text-sm text-black">{shortDate}</span>
                  </div>
                </div>
              </div>

              {/* Right Side: Giant QR */}
              <div className="flex-[2] flex flex-col items-center justify-center p-4 bg-gray-50">
                {transfer.inner_qr_hash ? (
                  <div className="border-[3px] border-black p-2 bg-white">
                    <QRCode value={transfer.inner_qr_hash} size={110} level="H" />
                  </div>
                ) : (
                  <div className="w-[110px] h-[110px] border-2 border-dashed border-gray-400 flex items-center justify-center text-[10px] font-bold text-center uppercase tracking-widest">No Hash<br/>Legacy</div>
                )}
              </div>
            </div>
          </div>
          
        </div>
      </div>
    </div>
  )
}