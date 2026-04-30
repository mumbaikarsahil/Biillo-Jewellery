import React, { useRef, useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { QrCode, X, ShieldAlert, Loader2, CheckCircle2, FileText, Truck, Hammer, Printer } from 'lucide-react'
import { Scanner } from '@yudiel/react-qr-scanner'
import { useReactToPrint } from 'react-to-print'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { InvoicePrintTemplate } from '@/components/InvoicePrintTemplate'
import { BillingMode } from '@/app/pos/page'

export function PosModals({ 
  mode, showScanner, setShowScanner, onScanSuccess, 
  showPreviewModal, setShowPreviewModal, 
  showPrintModal, setShowPrintModal, 
  previewData, lastInvoiceData, setLastInvoiceData, executeCheckout,
  isProcessing 
}: any) {
  
  const printRef = useRef<HTMLDivElement>(null)
  const [mounted, setMounted] = useState(false)

  // ✨ Wait for the client to mount so we can safely use Portals in Next.js
  useEffect(() => {
    setMounted(true)
  }, [])
  
  // Base trigger function
  const triggerPrint = useReactToPrint({ 
    contentRef: printRef 
  })

  // --- Wrapper function to hijack document.title for PDF saving ---
  const handlePrint = () => {
    if (!lastInvoiceData) return;
    
    // Save the original page title
    const originalTitle = document.title;
    
    // Overwrite the title so "Save as PDF" uses this name
    const docPrefix = mode === 'challan' ? 'Challan' : mode === 'estimate' ? 'Estimate' : 'Invoice';
    document.title = `${docPrefix}_${lastInvoiceData.invoice_number || 'Doc'}`;
    
    // Trigger the print dialog
    triggerPrint();
    
    // Restore the original title after a short delay
    setTimeout(() => {
      document.title = originalTitle;
    }, 2000);
  };

  const modeConfig: Record<string, { bg: string, text: string }> = {
    normal: { bg: 'bg-[#0078D7]', text: 'text-[#0078D7]' },
    estimate: { bg: 'bg-[#D83B01]', text: 'text-[#D83B01]' },
    custom: { bg: 'bg-[#881798]', text: 'text-[#881798]' },
    repair: { bg: 'bg-[#E3008C]', text: 'text-[#E3008C]' },
    challan: { bg: 'bg-[#107C10]', text: 'text-[#107C10]' },
    return: { bg: 'bg-[#C50F1F]', text: 'text-[#C50F1F]' },
  }
  const currentTheme = modeConfig[mode as BillingMode] || modeConfig.normal

  return (
    <>
      {/* ✨ BULLETPROOF PRINT ISOLATION */}
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          @page { margin: 0; size: auto; } 
          
          /* iPhone Native Print: Hides the main Next.js app to kill the 60 empty pages */
          /* Desktop Print: Ignores the .print-container so the iframe doesn't go blank */
          body > *:not(#mobile-print-portal):not(.print-container) {
            display: none !important;
          }
          
          #mobile-print-portal {
            display: block !important;
          }

          /* Kill Radix UI dark overlay backgrounds so we don't print grey pages */
          [data-radix-focus-guard], [data-aria-hidden="true"], .fixed.inset-0 {
            display: none !important;
          }
        }
      `}} />

      {/* 1. CAMERA SCANNER MODAL */}
      <Dialog open={showScanner} onOpenChange={setShowScanner}>
        {/* ✨ Added print:hidden so the modal vanishes if they trigger native print */}
        <DialogContent className="print:hidden sm:max-w-md p-0 overflow-hidden bg-white border border-slate-200 rounded-2xl shadow-2xl">
          <DialogHeader className="p-5 border-b border-slate-100 bg-white shrink-0">
            <DialogTitle className="text-sm font-bold uppercase tracking-widest text-slate-700 flex items-center justify-center gap-2">
              <QrCode className={`w-5 h-5 ${currentTheme.text}`} /> Scan Barcode / QR
            </DialogTitle>
          </DialogHeader>
          
          <div className="relative w-full aspect-square sm:aspect-video bg-slate-100 flex items-center justify-center overflow-hidden">
            <Scanner 
              onScan={(detected) => { 
                if (detected?.length) {
                  onScanSuccess(detected[0].rawValue);
                  setShowScanner(false);
                }
              }} 
              onError={console.error} 
              components={{ finder: true }} 
              styles={{ container: { width: '100%', height: '100%' } }} 
            />
          </div>

          <DialogFooter className="p-4 bg-slate-50/50 border-t border-slate-100 flex justify-center sm:justify-center">
            <Button 
              variant="outline" 
              onClick={() => setShowScanner(false)} 
              className="w-full h-12 bg-white border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-semibold rounded-xl transition-all shadow-sm"
            >
              Cancel Scan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 2. WYSIWYG PREVIEW MODAL */}
      <Dialog open={showPreviewModal} onOpenChange={setShowPreviewModal}>
        {/* ✨ Added print:hidden */}
        <DialogContent 
          className="print:hidden max-w-[950px] w-full h-[100dvh] sm:h-[90vh] p-0 border-0 sm:border border-slate-200 shadow-[0_0_50px_rgba(0,0,0,0.15)] rounded-none sm:rounded-2xl bg-slate-50 flex flex-col overflow-hidden"
        >
          <DialogHeader className="p-4 sm:p-5 border-b border-slate-200 bg-white shrink-0 flex flex-row items-center justify-between z-20 shadow-sm relative">
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-xl bg-slate-100/80 border border-slate-200 flex items-center justify-center`}>
                <ShieldAlert className={`w-5 h-5 ${currentTheme.text}`} />
              </div>
              <div className="flex flex-col items-start text-left">
                <DialogTitle className="text-base sm:text-lg font-bold text-slate-900 leading-none">Review Document</DialogTitle>
                <span className="text-[10px] sm:text-[11px] font-bold text-slate-400 mt-1 uppercase tracking-widest">
                  Verify details before committing to ledger
                </span>
              </div>
            </div>
            
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-9 w-9 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors absolute right-4 top-1/2 -translate-y-1/2 hidden sm:flex" 
              onClick={() => setShowPreviewModal(false)}
            >
               <X className="w-5 h-5" />
            </Button>
          </DialogHeader>
          
          <div className="flex-1 overflow-auto bg-slate-100/90 custom-scrollbar relative flex flex-col items-center">
             {previewData && (
               <div className="w-full min-h-full flex justify-center pb-[300px] sm:pb-20">
                 <div className="w-[210mm] origin-top-left sm:origin-top scale-[0.42] sm:scale-75 md:scale-[0.85] lg:scale-100 absolute sm:relative left-[4%] sm:left-auto mt-4 sm:mt-8 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.15)] bg-white ring-1 ring-slate-200 rounded-sm">
                   <InvoicePrintTemplate data={previewData} copyLabel="Preview Draft" />
                 </div>
               </div>
             )}
          </div>

          <DialogFooter className="bg-white p-4 sm:p-5 border-t border-slate-200 shrink-0 flex flex-col sm:flex-row justify-end gap-3 z-20 shadow-[0_-4px_20px_rgba(0,0,0,0.03)]">
            <Button 
              variant="outline" 
              className="rounded-xl text-sm font-bold w-full sm:w-auto h-12 sm:h-11 border-slate-300 text-slate-700 hover:bg-slate-50" 
              onClick={() => setShowPreviewModal(false)}
            >
              Back to Edit
            </Button>
            <Button 
              onClick={executeCheckout} 
              disabled={isProcessing} 
              className={`rounded-xl text-sm font-bold text-white w-full sm:w-auto h-12 sm:h-11 px-8 shadow-md transition-all active:scale-[0.98] ${currentTheme.bg}`}
            >
              {isProcessing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
              {isProcessing ? 'Processing...' : 'Confirm & Commit to Ledger'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 3. SUCCESS & PRINT MODAL */}
      <Dialog open={showPrintModal} onOpenChange={setShowPrintModal}>
        {/* ✨ Added print:hidden */}
        <DialogContent className="print:hidden sm:max-w-[420px] border-0 sm:border border-slate-200 shadow-2xl p-0 rounded-none sm:rounded-2xl overflow-hidden bg-white w-full h-[100dvh] sm:h-auto flex flex-col justify-center">
          <DialogTitle className="sr-only">Transaction Success</DialogTitle>
          <div className="flex flex-col items-center justify-center p-8 sm:p-10 text-center space-y-6">
            <div className={`w-20 h-20 text-white rounded-full flex items-center justify-center shadow-lg ${currentTheme.bg}`}>
              {mode === 'custom' ? <Hammer className="h-10 w-10" /> : mode === 'estimate' ? <FileText className="h-10 w-10" /> : mode === 'challan' ? <Truck className="h-10 w-10" /> : <CheckCircle2 className="h-10 w-10" />}
            </div>
            <div className="space-y-1.5">
               <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Success</h2>
               <p className="text-sm font-mono font-semibold text-slate-500 bg-slate-100 px-3 py-1 rounded-md inline-block">{lastInvoiceData?.invoice_number}</p>
            </div>
            <div className="w-full flex flex-col sm:flex-row gap-3 pt-4">
              <Button onClick={() => setShowPrintModal(false)} variant="outline" className="w-full sm:flex-1 h-12 rounded-xl font-bold border-slate-300 text-slate-600 hover:bg-slate-50">
                Close
              </Button>
              <Button onClick={handlePrint} className={`w-full sm:flex-1 h-12 rounded-xl font-bold text-white shadow-md ${currentTheme.bg}`}>
                <Printer className="h-4 w-4 mr-2"/> Print Bill
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ✨ FIX: PORTAL RENDERS PRINT TARGET DIRECTLY TO DOCUMENT ROOT */}
      {mounted && typeof document !== 'undefined' && createPortal(
        <div id="mobile-print-portal" className="hidden print:block w-full">
          <div ref={printRef} className="print-container bg-white flex flex-col mx-auto w-max">
            <InvoicePrintTemplate 
              data={lastInvoiceData} 
              copyLabel="Customer Copy" 
            />
            <div style={{ pageBreakAfter: 'always' }}></div>
            <InvoicePrintTemplate 
              data={lastInvoiceData} 
              copyLabel="Store Copy" 
            />
          </div>
        </div>,
        document.body
      )}
    </>
  )
}