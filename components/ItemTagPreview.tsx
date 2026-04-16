"use client"

import React, { useRef } from "react"
import html2canvas from "html2canvas"
import QRCode from "react-qr-code"
import { useReactToPrint } from "react-to-print"
import { toast } from "sonner"
import { Printer, Download } from "lucide-react"

import { Button } from "@/components/ui/button"
import { 
  Dialog, DialogContent, DialogHeader, 
  DialogTitle, DialogFooter
} from "@/components/ui/dialog"

export interface TagItemData {
  _type?: 'inventory' | 'repair';
  is_repair_ticket?: boolean;
  barcode?: string;
  item_category?: string;
  sku_reference?: string;
  purity_karat?: string;
  gross_weight_g?: number | string;
  net_weight_g?: number | string;
  
  total_stone_pieces?: number | string;
  total_stone_weight_cts?: number | string;
  
  solitaire_weight_cts?: number | string;
  solitaire_pieces?: number | string;
  melee_weight_cts?: number | string;
  melee_pieces?: number | string;

  label_1?: string | null; 
  label_2?: string | null; 
  
  diamond_shape?: string | null;
  diamond_color?: string | null;
  diamond_clarity?: string | null;

  mrp?: number | null; 
  origin_name?: string; 
  expected_delivery_date?: string; 
}

interface Props {
  item: TagItemData | null;
  onClose?: () => void;
  isPrintOnly?: boolean;
}

export function ItemTagPreview({ item, onClose, isPrintOnly = false }: Props) {
  const labelRef = useRef<HTMLDivElement>(null)

  const handlePrint = useReactToPrint({
    contentRef: labelRef,
    documentTitle: `Jewelry-Tag-${item?.barcode || 'Item'}`,
    onAfterPrint: () => toast.success('Sent to Thermal Printer'),
  })

  const downloadTagImage = async () => {
    if (!labelRef.current || !item) return
    try {
      const canvas = await html2canvas(labelRef.current, { scale: 4 })
      const link = document.createElement("a")
      link.href = canvas.toDataURL("image/png")
      link.download = `Tag-${item.barcode}.png`
      link.click()
      toast.success("Tag image saved")
    } catch (err) { 
      toast.error("Failed to generate tag image") 
    }
  }

  if (!item) return null;

  const isRepair = item._type === 'repair' || item.is_repair_ticket;
  const hasSolitaire = Number(item.solitaire_weight_cts) > 0;
  
  // Format variables specifically for the requested layout
  const categoryStr = item.item_category || 'CATEGORY';
  const skuStr = item.sku_reference || '';
  const headerText = `${categoryStr} ${skuStr}`.trim();
  
  const ktStr = item.purity_karat || '---';
  const netWtStr = Number(item.net_weight_g || 0).toFixed(3);
  
  const rdPcs = item.melee_pieces || 0;
  const rdCts = Number(item.melee_weight_cts || 0).toFixed(2);
  
  const solPcs = item.solitaire_pieces || 0;
  const solCts = Number(item.solitaire_weight_cts || 0).toFixed(2);
  
  // Assuming shape is not always needed in QLT line based on photo, just Color/Clarity
  const qltStr = [item.diamond_color, item.diamond_clarity].filter(Boolean).join('/') || '---';

  // --- EXTRACTED PURE LABEL COMPONENT ---
  const LabelContent = () => (
    <div 
      ref={isPrintOnly ? undefined : labelRef} 
      className="bg-white text-black flex border border-gray-300 shadow-sm print:border-none print:shadow-none overflow-hidden shrink-0" 
      style={{ 
        width: '100mm', 
        height: '20mm', 
        fontFamily: 'Arial, Helvetica, sans-serif', 
        boxSizing: 'border-box',
        pageBreakAfter: isPrintOnly ? 'always' : 'auto' 
      }}
    >
      <style type="text/css" media="print">{`
        @page { size: 100mm 20mm; margin: 0; } 
        body { margin: 0; padding: 0; background: white; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      `}</style>
      
      <div className="flex w-[70mm] h-full">
        {/* LEFT: TEXT DETAILS AREA (41mm) */}
        <div 
          className="flex flex-col justify-center h-full w-[41mm] pl-[2mm] pr-[1mm] tracking-tight text-black font-bold" 
          style={{ 
            // Slightly reduce font size and line height if Solitaire is present to fit the extra line
            fontSize: hasSolitaire ? '8.5px' : '9.5px', 
            lineHeight: hasSolitaire ? '1.15' : '1.3' 
          }}
        >
          {isRepair ? (
            <>
              <div className="uppercase text-[11px] leading-none mb-[1.5px] border-b border-black/50 pb-[1.5px] truncate">
                REPAIR: {item.item_category || 'SERVICE'}
              </div>
              <div className="truncate">{item.barcode || '---'}</div>
              <div className="truncate">{item.origin_name || '---'}</div>
              <div>{item.expected_delivery_date ? new Date(item.expected_delivery_date).toLocaleDateString('en-GB') : '---'}</div>
              <div>{Number(item.net_weight_g||0).toFixed(3)}g</div>
              <div>{Number(item.total_stone_weight_cts||0).toFixed(2)}ct</div>
              <div>₹{Number(item.mrp||0).toLocaleString()}</div>
            </>
          ) : (
            <>
              {/* Header: Gents Ring RNG-981 */}
              <div className="uppercase truncate" style={{ fontSize: hasSolitaire ? '9.5px' : '10.5px', marginBottom: '1px' }}>
                {headerText}
              </div>
              
              {/* Line 1: KT/GW : 14k/2.300 */}
              <div className="truncate uppercase flex">
                <span className="w-[14mm] inline-block shrink-0">KT/GW</span>
                <span>: {ktStr}/{netWtStr}</span>
              </div>
              
              {/* Line 2: RD : 4/0.23 */}
              <div className="truncate uppercase flex">
                <span className="w-[14mm] inline-block shrink-0">RD</span>
                <span>: {rdPcs}/{rdCts}</span>
              </div>
              
              {/* Line 3 (Optional): SOL : 1/0.20 */}
              {hasSolitaire && (
                <div className="truncate uppercase flex">
                  <span className="w-[14mm] inline-block shrink-0">SOL</span>
                  <span>: {solPcs}/{solCts}</span>
                </div>
              )}
              
              {/* Line 4: QLT : GH/SI */}
              <div className="truncate uppercase flex">
                <span className="w-[14mm] inline-block shrink-0">QLT</span>
                <span>: {qltStr}</span>
              </div>
            </>
          )}
        </div>

        {/* MIDDLE FOLD GAP (5mm) */}
        <div className="h-full w-[5mm] flex items-center justify-center border-l border-r border-dashed border-gray-200 print:border-none opacity-50 shrink-0">
          <span className="text-[4px] text-gray-300 print:hidden rotate-90 tracking-widest whitespace-nowrap">FOLD HERE</span>
        </div>

        {/* RIGHT: QR CODE & BRANDING AREA (24mm) */}
        <div className="flex h-full w-[24mm] justify-between items-center shrink-0 pr-[1mm]">
           <div className="h-full w-[5mm] flex items-center justify-center">
             <span className="font-black text-[7px] tracking-widest" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>
               {item.barcode || 'NO-CODE'}
             </span>
           </div>
           <div className="flex flex-col justify-center items-center w-[14mm]">
             {item.barcode ? (
               <QRCode value={item.barcode} size={64} level="M" style={{ height: "14mm", width: "14mm" }} />
             ) : (
               <div className="h-[14mm] w-[14mm] bg-gray-100 flex items-center justify-center border border-dashed border-gray-300 text-[5px] text-gray-400">N/A</div>
             )}
           </div>
           <div className="h-full w-[4mm] flex items-center justify-center">
              <div className="bg-black text-white h-full w-full flex items-center justify-center">
                <h2 className="font-black uppercase tracking-widest text-[7px] leading-none" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>
                  PAVITRAM
                </h2>
              </div>
           </div>
        </div>
      </div>

      {/* TAIL AREA (30mm) */}
      <div className="w-[30mm] h-full bg-gray-50 print:bg-white border-l border-gray-200 print:border-none flex items-center justify-center shrink-0">
         <span className="text-[5px] text-gray-300 print:hidden rotate-90 tracking-widest">TAIL AREA</span>
      </div>
    </div>
  )

  // --------------------------------------------------------------------------
  // RENDER LOGIC
  // --------------------------------------------------------------------------
  
  if (isPrintOnly) {
    return <LabelContent />
  }

  return (
    <Dialog open={true} onOpenChange={(val) => !val && onClose && onClose()}>
      <DialogContent className="sm:max-w-[550px] p-0 overflow-hidden border-slate-200 shadow-2xl rounded-xl bg-white">
        <DialogHeader className="bg-slate-50 p-5 border-b border-slate-200">
          <DialogTitle className="text-base font-semibold text-slate-900 flex items-center gap-2">
             <Printer className="w-4 h-4 text-slate-500" /> Thermal Label Layout {isRepair && "(Repair Tag)"}
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex flex-col items-center justify-center py-10 bg-slate-100/50 min-h-[250px] overflow-x-auto">
          <LabelContent />
        </div>

        <DialogFooter className="bg-slate-50 p-4 border-t border-slate-200 flex-row gap-3">
           <Button variant="outline" className="flex-1 h-10 text-xs font-semibold rounded-lg border-slate-300 text-slate-700 bg-white hover:bg-slate-50" onClick={downloadTagImage}>
             <Download className="w-4 h-4 mr-2 text-slate-400" /> Save PNG
           </Button>
           <Button className="flex-[2] h-10 text-xs font-bold rounded-lg bg-slate-900 hover:bg-slate-800 text-white" onClick={() => handlePrint()}>
             <Printer className="w-4 h-4 mr-2" /> Print (TSC)
           </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}