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
          <p className="text-sm">Click the "Print E-Com Labels" button above to generate the Amazon-style shipping label, or "Print HO Ledger" for the high-detail manifest.</p>
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
        {/* 1. MASTER LEDGER (HO COPY) - PROFESSIONAL SERIF REDESIGN */}
        {/* --------------------------------------------------------- */}
        <div ref={masterRef} className="bg-white w-[210mm] mx-auto text-black font-serif p-8">
          
          {/* HEADER SECTION */}
          <div className="border-b-[3px] border-black pb-4 mb-6 flex justify-between items-end font-sans">
            <div>
              <h2 className="text-sm font-black uppercase tracking-widest text-gray-500 mb-1">Pavitram Jewels</h2>
              <h1 className="text-3xl font-black uppercase tracking-tighter font-serif">Transfer Manifest</h1>
            </div>
            <div className="text-right flex flex-col items-end">
              <div className="w-[40mm] h-[8mm] mb-2" style={barcodeStyle}></div>
              <p className="font-mono text-lg font-black tracking-widest leading-none">{transfer.transfer_number}</p>
            </div>
          </div>

          {/* ROUTING & INFO BLOCK (Sans-Serif for labels) */}
          <div className="flex border-2 border-black rounded-lg overflow-hidden mb-6 font-sans">
            <div className="flex-1 p-3 bg-gray-50 border-r-2 border-black">
              <p className="text-[9px] font-black uppercase tracking-widest text-gray-500 mb-1">Dispatching Node</p>
              <p className="font-bold text-sm font-serif">{transfer.from.name}</p>
            </div>
            <div className="flex-1 p-3 bg-gray-50 border-r-2 border-black">
              <p className="text-[9px] font-black uppercase tracking-widest text-gray-500 mb-1">Receiving Node</p>
              <p className="font-bold text-sm font-serif">{transfer.to.name}</p>
            </div>
            <div className="flex-1 p-3">
              <p className="text-[9px] font-black uppercase tracking-widest text-gray-500 mb-1">Dispatch Time</p>
              <p className="font-bold text-sm tabular-nums">{fullDate}</p>
            </div>
            <div className="flex-1 p-3 border-l-2 border-black">
              <p className="text-[9px] font-black uppercase tracking-widest text-gray-500 mb-1">Seal Number</p>
              <p className="font-mono font-black text-sm tracking-widest">{transfer.seal_number || 'UNSEALED'}</p>
            </div>
          </div>

          {/* ASSET TABLE (Serif body, Mono numbers) */}
          <table className="w-full text-left border-collapse mb-8">
            <thead>
              <tr className="border-y-2 border-black bg-gray-100 font-sans">
                <th className="py-2.5 px-2 text-[10px] font-black uppercase tracking-widest w-8">#</th>
                <th className="py-2.5 px-2 text-[10px] font-black uppercase tracking-widest">Asset Identity</th>
                <th className="py-2.5 px-2 text-[10px] font-black uppercase tracking-widest">Metal Specs</th>
                <th className="py-2.5 px-2 text-[10px] font-black uppercase tracking-widest">Stone Profile</th>
                <th className="py-2.5 px-2 text-[10px] font-black uppercase tracking-widest text-right">Total Stone</th>
                <th className="py-2.5 px-2 text-[10px] font-black uppercase tracking-widest text-right">MRP (₹)</th>
              </tr>
            </thead>
            <tbody>
              {transfer.items?.map((line: any, idx: number) => {
                 if(!line.inventory_items) return null;
                 const item = line.inventory_items;
                 
                 const diamondSpecs = [item.diamond_shape, item.diamond_color, item.diamond_clarity].filter(Boolean).join(' ') || 'Plain Metal';
                 
                 let stoneDetails = [];
                 if (Number(item.solitaire_weight_cts) > 0) stoneDetails.push(`Sol: ${item.solitaire_weight_cts}ct (${item.solitaire_pieces || 0}p)`);
                 if (Number(item.melee_weight_cts) > 0) stoneDetails.push(`Mel: ${item.melee_weight_cts}ct (${item.melee_pieces || 0}p)`);
                 
                 return (
                  <tr key={idx} className="border-b border-gray-300 even:bg-gray-50 text-sm break-inside-avoid">
                    <td className="py-3 px-2 text-xs font-bold text-gray-500 align-top tabular-nums">{idx + 1}.</td>
                    <td className="py-3 px-2 align-top">
                      <div className="font-mono font-black text-xs">{item.barcode}</div>
                      <div className="text-[10px] text-gray-500 font-sans font-bold uppercase tracking-wider mt-0.5">{item.item_category}</div>
                    </td>
                    <td className="py-3 px-2 align-top">
                      <div className="font-bold text-xs">{item.metal_type} <span className="text-gray-500">{item.purity_karat}</span></div>
                      <div className="text-[10px] text-gray-600 font-sans font-bold uppercase tracking-wider mt-0.5 tabular-nums">
                        Gross: {(item.gross_weight_g || 0).toFixed(3)}g | Net: {(item.net_weight_g || 0).toFixed(3)}g
                      </div>
                    </td>
                    <td className="py-3 px-2 align-top">
                      <div className="font-bold text-xs">{diamondSpecs}</div>
                      {stoneDetails.length > 0 && (
                        <div className="text-[9px] text-gray-600 font-sans font-bold uppercase tracking-wider mt-0.5 tabular-nums">
                          {stoneDetails.join(' • ')}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-2 text-right font-bold align-top tabular-nums">
                      {(item.total_stone_weight_cts || 0).toFixed(2)} ct
                    </td>
                    <td className="py-3 px-2 text-right font-black align-top tabular-nums">
                      {(item.mrp || 0).toLocaleString('en-IN')}
                    </td>
                  </tr>
                 )
              })}
            </tbody>
            {/* TABLE FOOTER / TOTALS */}
            <tfoot>
              <tr className="border-y-[3px] border-black bg-gray-100 break-inside-avoid font-sans">
                <td colSpan={2} className="py-3 px-2 text-right text-[11px] font-black uppercase tracking-widest">
                  Grand Totals ({transfer.items?.length || 0} Assets)
                </td>
                <td className="py-3 px-2 text-[10px] font-black uppercase tracking-widest text-gray-600 tabular-nums">
                  Gross: {totalGrossWeight.toFixed(3)}g <br/> Net: {totalNetWeight.toFixed(3)}g
                </td>
                <td colSpan={2} className="py-3 px-2 text-right font-black text-sm tabular-nums">
                  {totalStoneWeight.toFixed(2)} cts
                </td>
                <td className="py-3 px-2 text-right font-black text-sm tabular-nums">
                  ₹{totalMRP.toLocaleString('en-IN')}
                </td>
              </tr>
            </tfoot>
          </table>

          {/* SIGNATURE & AUDIT BLOCKS */}
          <div className="grid grid-cols-3 gap-6 mt-16 break-inside-avoid font-sans">
            <div className="flex flex-col">
              <div className="border-b border-black h-8 mb-2"></div>
              <p className="text-[10px] font-black uppercase tracking-widest text-black">Dispatched By</p>
              <p className="text-[8px] font-bold text-gray-500 mt-1 uppercase">Name / Signature / Date</p>
            </div>
            <div className="flex flex-col">
              <div className="border-b border-black h-8 mb-2"></div>
              <p className="text-[10px] font-black uppercase tracking-widest text-black">HO Security Audit</p>
              <p className="text-[8px] font-bold text-gray-500 mt-1 uppercase">Seal Intact / Signature / Date</p>
            </div>
            <div className="flex flex-col">
              <div className="border-b border-black h-8 mb-2"></div>
              <p className="text-[10px] font-black uppercase tracking-widest text-black">Received By</p>
              <p className="text-[8px] font-bold text-gray-500 mt-1 uppercase">Name / Signature / Date</p>
            </div>
          </div>

          <div className="mt-8 text-center border-t border-gray-200 pt-4 font-sans">
            <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400">Generated by Biillo ERP System • Internal Document</p>
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