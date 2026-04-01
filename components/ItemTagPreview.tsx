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

// Flexible interface so it can accept items from Inventory OR Receiving
export interface TagItemData {
  barcode?: string;
  item_category?: string;
  sku_reference?: string;
  purity_karat?: string;
  gross_weight_g?: number | string;
  net_weight_g?: number | string;
  total_stone_pieces?: number | string;
  total_stone_weight_cts?: number | string;
  label_1?: string | null; // e.g., Gold Quality / Hallmark info
  label_2?: string | null; // e.g., Diamond Quality / Certification
}

interface Props {
  item: TagItemData | null;
  onClose: () => void;
}

export function ItemTagPreview({ item, onClose }: Props) {
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

  return (
    <Dialog open={!!item} onOpenChange={(val) => !val && onClose()}>
      <DialogContent className="sm:max-w-[550px] p-0 overflow-hidden border-slate-200 shadow-2xl rounded-xl bg-white">
        <DialogHeader className="bg-slate-50 p-5 border-b border-slate-200">
          <DialogTitle className="text-base font-semibold text-slate-900 flex items-center gap-2">
             <Printer className="w-4 h-4 text-slate-500" /> Thermal Label Layout
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex flex-col items-center justify-center py-10 bg-slate-100/50 min-h-[250px] overflow-x-auto">
          {/* THERMAL PRINT AREA (100mm x 20mm) */}
          <div ref={labelRef} className="bg-white text-black flex border border-gray-300 shadow-sm print:border-none print:shadow-none overflow-hidden shrink-0" style={{ width: '100mm', height: '20mm', fontFamily: 'Arial, sans-serif', boxSizing: 'border-box' }}>
            <style type="text/css" media="print">{`@page { size: 100mm 20mm; margin: 0; } body { margin: 0; padding: 0; background: white; -webkit-print-color-adjust: exact; print-color-adjust: exact; }`}</style>
            
            <div className="flex w-[70mm] h-full">
              
              {/* LEFT: TEXT DETAILS AREA */}
              <div className="flex flex-col justify-center h-full w-[41mm] pl-[2mm] pr-[1mm]" style={{ fontSize: '6px', lineHeight: '1.25', fontWeight: '700' }}>
                <div className="font-extrabold uppercase tracking-tight text-[7px] leading-none mb-[1.5px] border-b border-black/50 pb-[1.5px] truncate">
                  {item?.item_category || 'CATEGORY'}
                </div>
                
                <div className="flex items-center"><span className="w-[10mm] text-gray-700">STYLE</span><span className="truncate">: {item?.sku_reference || '---'}</span></div>
                <div className="flex items-center"><span className="w-[10mm] text-gray-700">GW/NW</span><span>: {Number(item?.gross_weight_g||0).toFixed(3)}g / {Number(item?.net_weight_g||0).toFixed(3)}g</span></div>
                <div className="flex items-center"><span className="w-[10mm] text-gray-700">KT/QLTY</span><span className="truncate">: {item?.purity_karat || '---'} {item?.label_1 ? `| ${item.label_1}` : ''}</span></div>
                <div className="flex items-center"><span className="w-[10mm] text-gray-700">DP/DW</span><span>: {item?.total_stone_pieces || 0} / {Number(item?.total_stone_weight_cts||0).toFixed(2)}ct</span></div>
                
                {/* Only show Diamond Quality if it exists to save space */}
                {(item?.label_2) && (
                  <div className="flex items-center"><span className="w-[10mm] text-gray-700">DIA</span><span className="truncate">: {item?.label_2}</span></div>
                )}
              </div>

              {/* MIDDLE FOLD GAP (5mm) */}
              <div className="h-full w-[5mm] flex items-center justify-center border-l border-r border-dashed border-gray-200 print:border-none opacity-50">
                <span className="text-[4px] text-gray-300 print:hidden rotate-90 tracking-widest whitespace-nowrap">FOLD HERE</span>
              </div>

              {/* RIGHT: QR CODE AREA */}
              <div className="flex flex-col justify-center items-center h-full w-[16mm]">
                {item?.barcode ? (
                  <QRCode value={item.barcode} size={64} level="M" style={{ height: "14mm", width: "14mm" }} />
                ) : (
                  <div className="h-[14mm] w-[14mm] bg-gray-100 flex items-center justify-center border border-dashed border-gray-300 text-[5px] text-gray-400">N/A</div>
                )}
              </div>

              {/* RIGHTMOST: VERTICAL BRANDING */}
              <div className="flex justify-center items-center h-full w-[8mm] bg-black text-white">
                <h2 
                  className="font-black uppercase tracking-widest text-[9px] leading-none" 
                  style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
                >
                  PAVITRAM
                </h2>
              </div>
            </div>

            {/* TAIL AREA (Wraps around the jewelry) */}
            <div className="w-[30mm] h-full bg-gray-50 print:bg-white border-l border-gray-200 print:border-none flex items-center justify-center">
               <span className="text-[5px] text-gray-300 print:hidden rotate-90 tracking-widest">TAIL AREA</span>
            </div>
          </div>
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