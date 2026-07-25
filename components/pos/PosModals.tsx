import React, { useRef, useState, useEffect } from 'react'
import { QrCode, X, ShieldAlert, Loader2, CheckCircle2, FileText, Truck, Hammer, Printer, Store } from 'lucide-react'
import { Scanner } from '@yudiel/react-qr-scanner'
import { useReactToPrint } from 'react-to-print'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { InvoicePrintTemplate } from '@/components/InvoicePrintTemplate'
import { BillingMode } from '@/app/pos/page'
import { toast } from 'sonner'
import * as VisuallyHidden from "@radix-ui/react-visually-hidden";

export function PosModals({ 
  mode, showScanner, setShowScanner, onScanSuccess, 
  showPreviewModal, setShowPreviewModal, 
  showPrintModal, setShowPrintModal, 
  previewData, lastInvoiceData, executeCheckout,
  isProcessing 
}: any) {
  
  // Use stable refs that exist for the lifecycle of the component
  const customerPrintRef = useRef<HTMLDivElement>(null)
  const storePrintRef = useRef<HTMLDivElement>(null)
  
  // ✨ State to track which copy Android should natively print
  const [printType, setPrintType] = useState<'customer' | 'store'>('customer')

  const triggerCustomerPrint = useReactToPrint({ contentRef: customerPrintRef })
  const triggerStorePrint = useReactToPrint({ contentRef: storePrintRef })

  const handlePrintCustomer = (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    const data = lastInvoiceData || previewData;
    if (!data) { toast.error("No data to print"); return; }
    
    setPrintType('customer');
    // Tiny timeout ensures React state updates before the print spooler freezes the browser
    setTimeout(() => triggerCustomerPrint(), 10);
  };

  const handlePrintStore = (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    const data = lastInvoiceData || previewData;
    if (!data) { toast.error("No data to print"); return; }
    
    setPrintType('store');
    setTimeout(() => triggerStorePrint(), 10);
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
      {/* 1. CAMERA SCANNER MODAL */}
      <Dialog open={showScanner} onOpenChange={setShowScanner}>
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
            <Button variant="outline" onClick={() => setShowScanner(false)} className="w-full h-12 bg-white border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-semibold rounded-xl transition-all shadow-sm">
              Cancel Scan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 2. WYSIWYG PREVIEW MODAL */}
      <Dialog open={showPreviewModal} onOpenChange={setShowPreviewModal}>
        <DialogContent className="print:hidden max-w-[950px] w-full h-[100dvh] sm:h-[90vh] p-0 border-0 sm:border border-slate-200 shadow-[0_0_50px_rgba(0,0,0,0.15)] rounded-none sm:rounded-2xl bg-slate-50 flex flex-col overflow-hidden">
          <DialogHeader className="p-4 sm:p-5 border-b border-slate-200 bg-white shrink-0 flex flex-row items-center justify-between z-20 shadow-sm relative">
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-xl bg-slate-100/80 border border-slate-200 flex items-center justify-center`}>
                <ShieldAlert className={`w-5 h-5 ${currentTheme.text}`} />
              </div>
              <div className="flex flex-col items-start text-left">
                <DialogTitle className="text-base sm:text-lg font-bold text-slate-900 leading-none">Review Document</DialogTitle>
                <span className="text-[10px] sm:text-[11px] font-bold text-slate-400 mt-1 uppercase tracking-widest">Verify before committing</span>
              </div>
            </div>
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
            <div className="flex gap-2 w-full sm:w-auto">
              <Button onClick={handlePrintCustomer} variant="outline" className="flex-1 rounded-xl text-xs font-bold border-slate-300 h-11"><Printer className="w-4 h-4 mr-2" /> Print Customer Copy</Button>
            </div>
            <Button variant="ghost" className="rounded-xl text-sm font-bold h-11 text-slate-500" onClick={() => setShowPreviewModal(false)}>Back to Edit</Button>
            <Button onClick={executeCheckout} disabled={isProcessing} className={`rounded-xl text-sm font-bold text-white w-full sm:w-auto h-11 px-8 ${currentTheme.bg}`}>
               {isProcessing ? <Loader2 className="animate-spin w-4 h-4 mr-2" /> : "Confirm & Commit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 3. SUCCESS MODAL */}
      <Dialog open={showPrintModal} onOpenChange={setShowPrintModal}>
        <DialogContent className="print:hidden sm:max-w-[420px] p-0 rounded-2xl overflow-hidden bg-white">
        <VisuallyHidden.Root>
          <DialogTitle>Transaction Success</DialogTitle>
        </VisuallyHidden.Root>
          <div className="flex flex-col items-center justify-center p-10 text-center space-y-6">
            <div className={`w-20 h-20 text-white rounded-full flex items-center justify-center shadow-lg ${currentTheme.bg}`}>
              <CheckCircle2 className="h-10 w-10" />
            </div>
            <div className="w-full grid grid-cols-1 gap-3">
              <Button onClick={handlePrintCustomer} className={`w-full h-12 rounded-xl font-bold text-white ${currentTheme.bg}`}>
                <Printer className="h-4 w-4 mr-2"/> Print Customer Copy
              </Button>
              <Button onClick={handlePrintStore} variant="outline" className={`w-full h-12 rounded-xl font-bold border-2 bg-white ${currentTheme.text} border-current`}>
                <Store className="h-4 w-4 mr-2"/> Print Store Copy
              </Button>
            </div>
            <Button onClick={() => setShowPrintModal(false)} variant="ghost" className="w-full text-slate-500">Close</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ✨ BULLETPROOF ANDROID/CHROME FALLBACK WRAPPER */}
      <div id="print-wrapper" className="fixed top-0 left-0 -z-[9999] opacity-0 pointer-events-none print:static print:z-auto print:opacity-100 print:pointer-events-auto print:bg-white w-full flex justify-center">
        
        {/* Dynamic conditional render based on which button was clicked */}
        <div className={printType === 'customer' ? 'block' : 'hidden print:hidden'}>
          <div ref={customerPrintRef} className="w-[210mm] bg-white text-black">
             <InvoicePrintTemplate data={lastInvoiceData || previewData} copyLabel="Customer Copy" />
          </div>
        </div>

        <div className={printType === 'store' ? 'block' : 'hidden print:hidden'}>
          <div ref={storePrintRef} className="w-[210mm] bg-white text-black">
             <InvoicePrintTemplate data={lastInvoiceData || previewData} copyLabel="Store Copy" />
          </div>
        </div>

      </div>

      {/* ✨ The Master Trap */}
      <style dangerouslySetInnerHTML={{__html:`
        @media print {
          /* Kill the dark background and any active modals */
          [data-radix-portal] { display: none !important; }
          /* Set the absolute base to white so it doesn't print grey */
          body { background-color: white !important; }
        }
      `}} />
    </>
  )
}