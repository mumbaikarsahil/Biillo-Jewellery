'use client'

import React, { useEffect, useState, useRef, use } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'
import { Button } from '@/components/ui/button'
import { Printer, ArrowLeft, AlertTriangle, Scissors, FileText, Package } from 'lucide-react'
import QRCode from 'react-qr-code'
import { useReactToPrint } from 'react-to-print'
import { Badge } from '@/components/ui/badge'

export default function TransferVoucher({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params)
  const transferId = resolvedParams.id

  const [transfer, setTransfer] = useState<any>(null)
  
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
  
  const totalGrossWeight = transfer.items?.reduce((sum: number, line: any) => sum + (line.inventory_items?.gross_weight_g || 0), 0) || 0;
  const totalNetWeight = transfer.items?.reduce((sum: number, line: any) => sum + (line.inventory_items?.net_weight_g || 0), 0) || 0;
  const totalStoneWeight = transfer.items?.reduce((sum: number, line: any) => sum + (line.inventory_items?.total_stone_weight_cts || 0), 0) || 0;
  const totalMRP = transfer.items?.reduce((sum: number, line: any) => sum + (line.inventory_items?.mrp || 0), 0) || 0;
  
  const fromCode = transfer.from?.name?.substring(0, 4).toUpperCase() || 'ORIG';
  const toCode = transfer.to?.name?.substring(0, 4).toUpperCase() || 'DEST';
  const dispatchDate = transfer.dispatched_at || transfer.created_at;
  const shortDate = new Date(dispatchDate).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' });
  const fullDate = new Date(dispatchDate).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

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
            <Button onClick={handlePrintShippingLabels} className="h-8 px-4 text-xs font-bold bg-black hover:bg-slate-800 text-white shadow-sm hidden sm:flex">
              <Printer className="w-3.5 h-3.5 mr-1.5" /> E-Com Labels
            </Button>
            <Button onClick={handlePrintMaster} variant="outline" className="h-8 px-4 text-xs border-slate-200 text-slate-700 hover:bg-slate-50 font-bold shadow-sm hidden sm:flex">
              <Printer className="w-3.5 h-3.5 mr-1.5" /> HO Ledger
            </Button>
          </div>
        </div>
      </header>

      {/* ✨ REWRITTEN MAIN SECTION: Actionable Instruction Cards */}
      <main className="max-w-5xl mx-auto p-4 sm:p-8 space-y-6 print:hidden">
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

        <div className="text-center mb-8 mt-4">
           <h2 className="text-2xl font-black tracking-tight text-slate-900">Print Documents</h2>
           <p className="text-slate-500 font-medium mt-2">Select the document format you need to generate for this transfer.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
           
           {/* Action Card 1: HO Ledger */}
           <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 flex flex-col items-center text-center shadow-sm hover:shadow-md transition-shadow">
              <div className="h-16 w-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mb-5 border border-blue-100">
                <FileText className="h-8 w-8" strokeWidth={1.5} />
              </div>
              <h3 className="text-xl font-bold text-slate-900">HO Transfer Ledger</h3>
              <p className="text-sm text-slate-500 mt-2 mb-8 leading-relaxed">
                A high-density A4 manifest detailing every asset, its metal specs, stone weights, and MRP. Used for internal auditing, record-keeping, and physical verification.
              </p>
              <div className="mt-auto w-full">
                <Button onClick={handlePrintMaster} className="w-full h-12 text-sm font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-sm transition-all active:scale-95">
                  <Printer className="w-4 h-4 mr-2" /> Print A4 Ledger
                </Button>
              </div>
           </div>

           {/* Action Card 2: E-Com Labels */}
           <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 flex flex-col items-center text-center shadow-sm hover:shadow-md transition-shadow">
              <div className="h-16 w-16 bg-slate-900 text-white rounded-2xl flex items-center justify-center mb-5 shadow-inner">
                <Package className="h-8 w-8" strokeWidth={1.5} />
              </div>
              <h3 className="text-xl font-bold text-slate-900">E-Com Shipping Labels</h3>
              <p className="text-sm text-slate-500 mt-2 mb-8 leading-relaxed">
                Standard 6x4 landscape labels with routing codes and security QR hashes. Includes the primary outer label and the secure inner-lock manifest.
              </p>
              <div className="mt-auto w-full">
                <Button onClick={handlePrintShippingLabels} className="w-full h-12 text-sm font-bold bg-slate-900 hover:bg-slate-800 text-white rounded-xl shadow-sm transition-all active:scale-95">
                  <Printer className="w-4 h-4 mr-2" /> Print 6x4 Labels
                </Button>
              </div>
           </div>

        </div>
      </main>

      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          @page {
            margin: 10mm;
            size: A4 portrait;
          }
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .break-inside-avoid {
            page-break-inside: avoid;
            break-inside: avoid;
          }
          .tabular-nums {
            font-variant-numeric: tabular-nums;
          }
        }
      `}} />

      <div className="hidden">
        
        {/* --------------------------------------------------------- */}
        {/* 1. MASTER LEDGER (HO COPY) - HIGH DENSITY COMPACT DESIGN  */}
        {/* --------------------------------------------------------- */}
        <div ref={masterRef} className="bg-white w-[210mm] mx-auto text-black font-sans p-6">
          
          {/* COMPACT HEADER SECTION */}
          <div className="border-b-2 border-black pb-2 mb-3 flex justify-between items-end">
            <div>
              <h1 className="text-xl font-black uppercase tracking-tight leading-none">Transfer Manifest</h1>
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-1">Ref: {transfer.transfer_number}</p>
            </div>
            <div className="text-right flex flex-col items-end">
              <div className="w-[30mm] h-[6mm]" style={barcodeStyle}></div>
            </div>
          </div>

          {/* COMPACT ROUTING & INFO BLOCK */}
          <div className="flex border border-black rounded mb-4 text-[10px] divide-x divide-black bg-gray-50">
            <div className="flex-1 p-1.5">
              <span className="font-bold uppercase text-gray-500 mr-1">From:</span> <span className="font-bold">{transfer.from.name}</span>
            </div>
            <div className="flex-1 p-1.5">
              <span className="font-bold uppercase text-gray-500 mr-1">To:</span> <span className="font-bold">{transfer.to.name}</span>
            </div>
            <div className="flex-1 p-1.5">
              <span className="font-bold uppercase text-gray-500 mr-1">Date:</span> <span className="font-bold tabular-nums">{fullDate}</span>
            </div>
            <div className="flex-1 p-1.5">
              <span className="font-bold uppercase text-gray-500 mr-1">Seal:</span> <span className="font-mono font-bold tracking-widest">{transfer.seal_number || 'UNSEALED'}</span>
            </div>
          </div>

          {/* HIGH-DENSITY ASSET TABLE */}
          <table className="w-full text-left border-collapse mb-6 text-[9px]">
            <thead>
              <tr className="border-y border-black bg-gray-100">
                <th className="py-1 px-1 font-bold uppercase tracking-wider w-6">#</th>
                <th className="py-1 px-1 font-bold uppercase tracking-wider">Asset (Barcode / Cat)</th>
                <th className="py-1 px-1 font-bold uppercase tracking-wider">Metal (Type / Wt)</th>
                <th className="py-1 px-1 font-bold uppercase tracking-wider">Stone Details</th>
                <th className="py-1 px-1 font-bold uppercase tracking-wider text-right w-12">Stn Wt</th>
                <th className="py-1 px-1 font-bold uppercase tracking-wider text-right w-16">MRP (₹)</th>
              </tr>
            </thead>
            <tbody>
              {transfer.items?.map((line: any, idx: number) => {
                 if(!line.inventory_items) return null;
                 const item = line.inventory_items;
                 
                 const diamondSpecs = [item.diamond_shape, item.diamond_color, item.diamond_clarity].filter(Boolean).join(' ') || 'Plain Metal';
                 
                 let stoneDetails = [];
                 if (Number(item.solitaire_weight_cts) > 0) stoneDetails.push(`Sol:${item.solitaire_weight_cts}ct(${item.solitaire_pieces || 0}p)`);
                 if (Number(item.melee_weight_cts) > 0) stoneDetails.push(`Mel:${item.melee_weight_cts}ct(${item.melee_pieces || 0}p)`);
                 
                 return (
                  <tr key={idx} className="border-b border-gray-200 even:bg-gray-50 break-inside-avoid leading-tight">
                    <td className="py-0.5 px-1 font-bold text-gray-400 align-top tabular-nums">{idx + 1}.</td>
                    <td className="py-0.5 px-1 align-top">
                      <span className="font-mono font-bold text-[10px]">{item.barcode}</span>
                      <span className="text-gray-500 ml-1 uppercase">({item.item_category})</span>
                    </td>
                    <td className="py-0.5 px-1 align-top">
                      <span className="font-bold">{item.metal_type} {item.purity_karat}</span>
                      <span className="text-gray-500 ml-1 tabular-nums">| G:{(item.gross_weight_g || 0).toFixed(3)}g N:{(item.net_weight_g || 0).toFixed(3)}g</span>
                    </td>
                    <td className="py-0.5 px-1 align-top truncate max-w-[150px]">
                      <span className="font-bold">{diamondSpecs}</span>
                      {stoneDetails.length > 0 && <span className="text-gray-500 ml-1 tabular-nums">| {stoneDetails.join(' ')}</span>}
                    </td>
                    <td className="py-0.5 px-1 text-right font-bold align-top tabular-nums">
                      {(item.total_stone_weight_cts || 0).toFixed(2)}
                    </td>
                    <td className="py-0.5 px-1 text-right font-bold align-top tabular-nums text-[10px]">
                      {(item.mrp || 0).toLocaleString('en-IN')}
                    </td>
                  </tr>
                 )
              })}
            </tbody>
            {/* COMPACT TABLE FOOTER */}
            <tfoot>
              <tr className="border-y-[2px] border-black bg-gray-100 break-inside-avoid">
                <td colSpan={2} className="py-1 px-1 text-right font-black uppercase tracking-widest text-[10px]">
                  Totals ({transfer.items?.length || 0} Items)
                </td>
                <td className="py-1 px-1 font-bold text-gray-700 tabular-nums">
                  G: {totalGrossWeight.toFixed(3)}g | N: {totalNetWeight.toFixed(3)}g
                </td>
                <td className="py-1 px-1 text-right"></td>
                <td className="py-1 px-1 text-right font-black tabular-nums">
                  {totalStoneWeight.toFixed(2)} ct
                </td>
                <td className="py-1 px-1 text-right font-black tabular-nums text-[10px]">
                  ₹{totalMRP.toLocaleString('en-IN')}
                </td>
              </tr>
            </tfoot>
          </table>

          {/* COMPACT SIGNATURE BLOCKS */}
          <div className="grid grid-cols-3 gap-6 mt-8 break-inside-avoid">
            <div className="flex flex-col">
              <div className="border-b border-black h-6 mb-1"></div>
              <p className="text-[8px] font-black uppercase tracking-widest text-black">Dispatched By</p>
            </div>
            <div className="flex flex-col">
              <div className="border-b border-black h-6 mb-1"></div>
              <p className="text-[8px] font-black uppercase tracking-widest text-black">HO Security Audit</p>
            </div>
            <div className="flex flex-col">
              <div className="border-b border-black h-6 mb-1"></div>
              <p className="text-[8px] font-black uppercase tracking-widest text-black">Received By</p>
            </div>
          </div>
        </div>

        {/* --------------------------------------------------------- */}
        {/* 2. E-COM STYLE SHIPPING LABELS (Stacked Landscape on A4) */}
        {/* --------------------------------------------------------- */}
        <div ref={shippingLabelsRef} className="bg-white w-[210mm] min-h-[297mm] mx-auto flex flex-col items-center pt-10 font-sans">
          
          {/* TOP HALF: OUTER LABEL (Landscape 6x4 format - 152x102mm) */}
          <div className="w-[152mm] h-[102mm] bg-white border-[3px] border-black flex flex-col text-black">
            
            <div className="flex border-b-[3px] border-black h-[12mm]">
              <div className="p-1 text-lg font-black border-r-[3px] border-black flex-1 flex items-center justify-center tracking-widest">{fromCode}</div>

              <div className="p-1 text-xs font-bold border-r-[3px] border-black flex-1 flex items-center justify-center tabular-nums">{shortDate}</div>
              <div className="p-1 text-lg font-black bg-black text-white flex-1 flex items-center justify-center tracking-widest">{toCode}</div>
            </div>

            <div className="flex flex-1">
              <div className="flex-[3] border-r-[3px] border-black p-4 flex flex-col justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase text-gray-500 tracking-widest mb-1">Deliver To:</p>
                  <p className="text-2xl font-black uppercase leading-none tracking-tight font-serif">{transfer.to.name}</p>
                  <p className="text-[10px] font-bold uppercase text-gray-600 mt-2 font-serif">From: {transfer.from.name}</p>
                </div>

                <div className="mt-4">
                  <div className="w-full h-[15mm] mb-1" style={barcodeStyle}></div>
                  <p className="text-sm font-black tracking-widest uppercase text-center font-mono">{transfer.transfer_number}</p>
                </div>
              </div>

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
                  <p className="text-xl font-mono font-black tracking-widest">{transfer.seal_number || 'NONE'}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="w-[152mm] border-b-2 border-dashed border-gray-400 flex items-center justify-center relative my-6">
             <div className="absolute bg-white px-2 text-gray-400 flex items-center gap-2">
               <Scissors className="w-4 h-4" />
               <span className="text-[10px] font-bold uppercase tracking-widest">Cut Here</span>
             </div>
          </div>

          <div className="w-[152mm] h-[102mm] bg-white border-[3px] border-black flex flex-col text-black">
            
            <div className="flex border-b-[3px] border-black h-[12mm]">
              <div className="p-1 text-lg font-black border-r-[3px] border-black flex-[3] flex items-center justify-center tracking-widest">INNER SECURE MANIFEST</div>
              <div className="p-1 text-lg font-black bg-black text-white flex-1 flex items-center justify-center tracking-widest">LOCK</div>
            </div>

            <div className="flex flex-1">
              <div className="flex-[3] border-r-[3px] border-black p-4 flex flex-col justify-between">
                <div className="text-center mt-2">
                  <h2 className="text-3xl font-black uppercase tracking-tighter font-serif">PLACE INSIDE</h2>
                  <p className="text-[10px] font-bold uppercase text-gray-600 mt-2 tracking-widest">Do not stick on outer box</p>
                </div>
                
                <div className="bg-black text-white text-center p-2 font-black uppercase tracking-widest text-sm">
                  Scan On Receipt
                </div>
                
                <div className="flex justify-between items-end text-[9px] font-bold uppercase text-gray-600">
                  <div className="flex flex-col">
                    <span>TRX ID</span>
                    <span className="text-sm text-black font-mono">{transfer.transfer_number}</span>
                  </div>
                  <div className="text-right flex flex-col">
                    <span>Packed On</span>
                    <span className="text-sm text-black tabular-nums">{shortDate}</span>
                  </div>
                </div>
              </div>

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