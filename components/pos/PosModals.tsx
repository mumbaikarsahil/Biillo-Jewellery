import React, { useRef } from 'react'
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
  
  // Base trigger function
  const triggerPrint = useReactToPrint({ 
    contentRef: printRef 
  })

  // --- NEW: Wrapper function to hijack document.title for PDF saving ---
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
  }
  const currentTheme = modeConfig[mode as BillingMode] || modeConfig.normal

  return (
    <>
      {/* 1. CAMERA SCANNER MODAL - VERCEL-STYLE SLEEK UI */}
      <Dialog open={showScanner} onOpenChange={setShowScanner}>
        <DialogContent className="sm:max-w-md p-0 overflow-hidden bg-white border border-slate-200 rounded-2xl shadow-xl">
          
          <DialogHeader className="p-5 border-b border-slate-100 bg-white shrink-0">
            <DialogTitle className="text-sm font-bold uppercase tracking-widest text-slate-700 flex items-center justify-center gap-2">
              <QrCode className="w-5 h-5 text-[#0078D7]" /> Scan Barcode / QR
            </DialogTitle>
          </DialogHeader>
          
          {/* Softened background behind the camera feed */}
          <div className="relative w-full aspect-square sm:aspect-video bg-slate-100 flex items-center justify-center overflow-hidden">
            <Scanner 
              onScan={(detected) => { 
                if (detected?.length) {
                  onScanSuccess(detected[0].rawValue);
                  setShowScanner(false); // Auto-close scanner on success
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
        <DialogContent className="sm:max-w-[850px] border border-slate-300 shadow-2xl p-0 rounded-sm bg-slate-100 flex flex-col max-h-[90vh]">
          <DialogHeader className={`p-4 border-b border-slate-200 text-white ${currentTheme.bg} shrink-0`}>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <ShieldAlert className="w-4 h-4" /> Review Document Before Issuing
            </DialogTitle>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto p-4 sm:p-8 flex justify-center bg-slate-200/50 custom-scrollbar shadow-inner">
             {previewData && (
               <div className="bg-white shadow-xl origin-top scale-[0.6] sm:scale-75 md:scale-[0.85] transition-transform h-max pb-10 border border-slate-300">
                  <InvoicePrintTemplate data={previewData} copyLabel="Preview Draft" />
               </div>
             )}
          </div>

          <DialogFooter className="bg-white p-4 border-t border-slate-200 shrink-0 flex flex-row justify-end gap-3">
            <Button variant="outline" className="rounded-sm text-sm" onClick={() => setShowPreviewModal(false)}>
              Back to Edit
            </Button>
            <Button onClick={executeCheckout} className={`rounded-sm text-sm text-white ${currentTheme.bg}`}>
              {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
              Confirm & Commit to Ledger
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 3. SUCCESS & PRINT MODAL */}
      <Dialog open={showPrintModal} onOpenChange={setShowPrintModal}>
        <DialogContent className="sm:max-w-[400px] border border-slate-300 shadow-2xl p-0 rounded-sm overflow-hidden bg-white w-[90vw] sm:w-full">
          <DialogTitle className="sr-only">Transaction Success</DialogTitle>
          <div className="flex flex-col items-center justify-center p-6 sm:p-8 text-center space-y-5">
            <div className={`w-16 h-16 text-white rounded-full flex items-center justify-center ${currentTheme.bg}`}>
              {mode === 'custom' ? <Hammer className="h-8 w-8" /> : mode === 'estimate' ? <FileText className="h-8 w-8" /> : mode === 'challan' ? <Truck className="h-8 w-8" /> : <CheckCircle2 className="h-8 w-8" />}
            </div>
            <div className="space-y-1">
               <h2 className="text-xl font-bold text-slate-800">Document Generated</h2>
               <p className="text-sm font-mono text-slate-500">{lastInvoiceData?.invoice_number}</p>
            </div>
            <div className="w-full flex flex-col sm:flex-row gap-3 pt-2">
              <Button onClick={() => setShowPrintModal(false)} variant="outline" className="w-full sm:flex-1 rounded-sm border-slate-300">Close</Button>
              {/* UPDATED: Calls the new wrapper function */}
              <Button onClick={handlePrint} className={`w-full sm:flex-1 rounded-sm text-white ${currentTheme.bg}`}>
                <Printer className="h-4 w-4 mr-2"/> Print
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* HIDDEN PRINT TEMPLATE TARGET - UPDATED FOR DUAL COPIES */}
      <div className="hidden">
        <div ref={printRef} className="print-container bg-white">
          
          {/* First Page: Customer Copy */}
          <InvoicePrintTemplate 
            data={lastInvoiceData} 
            copyLabel="Customer Copy" 
          />
          
          {/* Page Break: Forces printer to start a new sheet of paper */}
          <div style={{ pageBreakAfter: 'always' }}></div>
          
          {/* Second Page: Store Copy */}
          <InvoicePrintTemplate 
            data={lastInvoiceData} 
            copyLabel="Store Copy" 
          />
          
        </div>
      </div>
    </>
  )
}