"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import * as XLSX from "xlsx";
import QRCode from "react-qr-code";
import { useReactToPrint } from "react-to-print";
import { 
  Loader2, CheckCircle2, PlusCircle, ArrowLeft, ChevronRight, 
  RefreshCw, Database, Printer, Ticket, FileSpreadsheet, Info, Share2,
  MonitorSmartphone, QrCode, ArrowRight // ✨ Added ArrowRight
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
// ✨ NEW: Imported Dialog Components for the Success Modal
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"; 
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/hooks/useAuth";
import { Separator } from "@/components/ui/separator";

export default function GenerateVouchersPage() {
  const { toast } = useToast();
  const { appUser } = useAuth();
  
  const [companyName, setCompanyName] = useState("GIFT VOUCHER");
  const [isGenerating, setIsGenerating] = useState(false);
  const [successBatch, setSuccessBatch] = useState<{ 
    batchNo: string; codes: string[]; discount: number; handlingFee: number; expiry: string 
  } | null>(null);

  // ✨ NEW: State to control the Success Modal
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  const [formData, setFormData] = useState({
    prefix: "A",
    startingNumber: 1,
    quantity: 100,
    discountValue: 500,
    handlingFee: 0,
    printerName: "",
  });

  const [intendedUse, setIntendedUse] = useState<'physical' | 'digital'>('physical');

  const printRef = useRef<HTMLDivElement>(null);
  const handlePrint = useReactToPrint({ contentRef: printRef });

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  useEffect(() => {
    async function fetchInitialContext() {
      if (!appUser?.company_id) return;
      const { data: compData } = await supabase.from('companies').select('trade_name, legal_name').eq('id', appUser.company_id).single();
      if (compData) setCompanyName(compData.trade_name || compData.legal_name || "GIFT VOUCHER");

      const { data: lastBatch } = await supabase.from('voucher_batches').select('prefix').eq('company_id', appUser.company_id).order('created_at', { ascending: false }).limit(1).maybeSingle();
      if (lastBatch && lastBatch.prefix) setFormData(prev => ({ ...prev, prefix: lastBatch.prefix }));
    }
    fetchInitialContext();
  }, [appUser]);

  // --- BULLETPROOF SEQUENCE DETECTION ---
  useEffect(() => {
    async function fetchNextSequence() {
      if (!formData.prefix.trim()) return;
      const prefix = formData.prefix.trim().toUpperCase();
      
      const { data: vData, error } = await supabase
        .from('vouchers')
        .select('code')
        .ilike('code', `${prefix}%`)
        .order('code', { ascending: false }) 
        .limit(1); 

      if (!error && vData && vData.length > 0) {
        const highestCode = vData[0].code;
        const numStr = highestCode.substring(prefix.length);
        const parsed = parseInt(numStr, 10);
        
        if (!isNaN(parsed)) {
          setFormData(prev => ({ ...prev, startingNumber: parsed + 1 }));
        } else {
          setFormData(prev => ({ ...prev, startingNumber: 1 }));
        }
      } else {
        setFormData(prev => ({ ...prev, startingNumber: 1 }));
      }
    }
    
    const timeoutId = setTimeout(() => fetchNextSequence(), 500);
    return () => clearTimeout(timeoutId);
  }, [formData.prefix]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isGenerating) return; 
    
    setIsGenerating(true);

    try {
      if (!appUser || !appUser.company_id) throw new Error("Authentication error.");

      const companyId = appUser.company_id;
      const batchNo = `BCH-${Date.now().toString().slice(-6)}`;
      const quantity = Number(formData.quantity);
      const startNum = Number(formData.startingNumber) || 1;
      const discount = Number(formData.discountValue);
      const handlingFee = Number(formData.handlingFee);

      const initialExpiryDate = new Date();
      initialExpiryDate.setMonth(initialExpiryDate.getMonth() + 6);
      const expiryIsoStr = initialExpiryDate.toISOString().split('T')[0];

      const prefix = formData.prefix.trim().toUpperCase();
      const generatedCodes = Array.from({ length: quantity }, (_, i) => {
        const numSequence = (startNum + i).toString().padStart(4, '0');
        return `${prefix}${numSequence}`;
      });

      const { data: batchData, error: batchError } = await supabase.from("voucher_batches").insert({
          company_id: companyId, 
          batch_no: batchNo, 
          prefix: prefix, 
          quantity: quantity,
          discount_value: discount, 
          handling_fee: handlingFee, 
          printer_name: intendedUse === 'digital' ? 'DIGITAL_EVENT_POOL' : formData.printerName, 
          status: "generated",
        }).select().single();

      if (batchError) throw new Error(batchError.message);

      const vouchersToInsert = generatedCodes.map((code) => ({
        batch_id: batchData.id, 
        code: code, 
        discount_value: discount, 
        handling_fee: handlingFee,
        status: "pending_print", 
        expiry_date: expiryIsoStr,
      }));

      const chunkSize = 500;
      for (let i = 0; i < vouchersToInsert.length; i += chunkSize) {
        const chunk = vouchersToInsert.slice(i, i + chunkSize);
        const { error: vouchersError } = await supabase.from("vouchers").insert(chunk);
        if (vouchersError) {
          throw new Error(`Failed to insert batch segment. Check database limits. Details: ${vouchersError.message}`);
        }
      }

      setSuccessBatch({ batchNo, codes: generatedCodes, discount, handlingFee, expiry: expiryIsoStr });
      setFormData(prev => ({ ...prev, startingNumber: startNum + quantity }));
      
      // ✨ NEW: Trigger the Success Popup immediately!
      setShowSuccessModal(true);

    } catch (error: any) {
      toast({ title: "Process Failed", description: error.message, variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadExcel = () => {
    if (!successBatch) return;
    const exportData = successBatch.codes.map((code, index) => ({
      "Sr No": index + 1, "Voucher Code": code, "Credit Value (₹)": successBatch.discount,
      "Handling Fee (₹)": successBatch.handlingFee, "Initial Expiry": successBatch.expiry,
      "Batch Ref": successBatch.batchNo, "Claim URL": `${baseUrl}/claim?code=${code}`
    }));
    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Vouchers");
    XLSX.writeFile(workbook, `Vouchers_${successBatch.batchNo}.xlsx`);
  };

  const shareExcel = async () => {
    if (!successBatch) return;
    
    const exportData = successBatch.codes.map((code, index) => ({
      "Sr No": index + 1, "Voucher Code": code, "Credit Value (₹)": successBatch.discount,
      "Handling Fee (₹)": successBatch.handlingFee, "Initial Expiry": successBatch.expiry,
      "Batch Ref": successBatch.batchNo, "Claim URL": `${baseUrl}/claim?code=${code}`
    }));
    
    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Vouchers");

    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const file = new File([excelBuffer], `Vouchers_${successBatch.batchNo}.xlsx`, {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: `Voucher Manifest - ${successBatch.batchNo}`,
          text: `Here is the Excel manifest for voucher batch ${successBatch.batchNo}.`,
        });
      } catch (error: any) {
        if (error.name !== 'AbortError') {
          toast({ title: "Sharing Failed", description: "Could not share the file.", variant: "destructive" });
        }
      }
    } else {
      toast({ 
        title: "Not Supported", 
        description: "Your device/browser does not support direct file sharing. Please use the Download button instead.", 
        variant: "destructive" 
      });
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#fafafa] font-sans">
      
      {/* --- COMPACT IDE-STYLE TOOLBAR HEADER --- */}
      <header className="sticky top-0 z-40 w-full bg-white/80 backdrop-blur-md border-b border-gray-200 px-4 h-12 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3 overflow-hidden">
          <Link href="/vouchers">
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-md hover:bg-gray-100 transition-colors">
              <ArrowLeft className="h-4 w-4 text-gray-500" />
            </Button>
          </Link>
          
          <Separator orientation="vertical" className="h-4" />
          
          <nav className="flex items-center gap-1.5 text-[13px] whitespace-nowrap overflow-hidden">
            <Link href="/vouchers" className="text-gray-500 hover:text-gray-900 transition-colors font-medium">Vouchers</Link>
            <ChevronRight className="h-3.5 w-3.5 text-gray-400" />
            <span className="font-bold text-gray-900 select-none">Generate Sequential Batch</span>
            
            <div className="ml-3 hidden md:flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-gray-100 border border-gray-200">
              <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-tighter">Write Mode</span>
            </div>
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="h-8 px-2 text-xs font-medium text-gray-500 hover:text-gray-900" 
            onClick={() => setFormData({ prefix: "A", startingNumber: 1, quantity: 100, discountValue: 500, handlingFee: 0, printerName: "" })}>
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Reset Form
          </Button>
          <Separator orientation="vertical" className="h-4 mx-1" />
          <Button variant="outline" size="sm" className="h-8 text-xs font-bold px-3 shadow-sm border-gray-200 bg-white text-gray-700">
            <Database className="h-3.5 w-3.5 mr-1.5 text-gray-400" /> Voucher DB
          </Button>
        </div>
      </header>

      <main className="p-4 md:p-8 max-w-[1100px] w-full mx-auto space-y-6 animate-in fade-in duration-500">
        <div className="grid gap-6 md:grid-cols-5">
          
          {/* MAIN FORM SECTION */}
          <Card className="md:col-span-3 shadow-sm border-gray-200/60 overflow-hidden bg-white">
            <CardHeader className="bg-gray-50/50 py-3 px-4 border-b">
              <div className="flex items-center gap-2">
                <PlusCircle className="h-4 w-4 text-gray-400" />
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-tight">Batch Configuration Engine</h3>
              </div>
            </CardHeader>
            <CardContent className="pt-6 pb-6">
              <form onSubmit={handleGenerate} className="space-y-6">
                
                <div className="space-y-3 pb-5 border-b border-gray-100">
                  <Label className="text-xs font-bold text-gray-500 uppercase tracking-tight">Intended Format</Label>
                  <div className="grid grid-cols-2 gap-3">
                    <Button 
                      type="button"
                      variant={intendedUse === 'physical' ? 'default' : 'outline'}
                      className={`h-11 shadow-sm ${intendedUse === 'physical' ? 'bg-slate-900 text-white' : 'text-slate-500 border-gray-200'}`}
                      onClick={() => setIntendedUse('physical')}
                    >
                      <Printer className="w-4 h-4 mr-2" /> Physical Booklets
                    </Button>
                    <Button 
                      type="button"
                      variant={intendedUse === 'digital' ? 'default' : 'outline'}
                      className={`h-11 shadow-sm ${intendedUse === 'digital' ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'text-slate-500 border-gray-200'}`}
                      onClick={() => setIntendedUse('digital')}
                    >
                      <MonitorSmartphone className="w-4 h-4 mr-2" /> Digital Event Pool
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <Label htmlFor="prefix" className="text-xs font-bold text-gray-500 uppercase tracking-tight">Code Prefix</Label>
                    <Input id="prefix" name="prefix" placeholder="e.g., A" className="h-10 text-sm font-mono border-gray-200 focus-visible:ring-primary uppercase rounded-md font-bold bg-gray-50 shadow-inner" value={formData.prefix} onChange={handleInputChange} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="startingNumber" className="text-xs font-bold text-gray-500 uppercase tracking-tight flex justify-between">
                      <span>Start Sequence</span>
                      <span className="text-[9px] text-primary lowercase tracking-normal bg-primary/10 px-2 py-0.5 rounded-full">Auto-detected</span>
                    </Label>
                    <Input id="startingNumber" name="startingNumber" type="number" min="1" className="h-10 text-sm border-gray-200 focus-visible:ring-primary rounded-md font-mono bg-gray-50 shadow-inner" value={formData.startingNumber} onChange={handleInputChange} required />
                  </div>
                </div>

                <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-sm">
                   <span className="text-[11px] font-bold uppercase text-gray-500 tracking-tight">Preview Output:</span>
                   <span className="text-sm font-mono font-black tracking-widest text-gray-900 bg-white px-3 py-1 rounded-md border border-gray-200">
                     {formData.prefix.trim().toUpperCase()}{(Number(formData.startingNumber) || 1).toString().padStart(4, '0')} 
                     <span className="text-gray-400 mx-2">→</span> 
                     {formData.prefix.trim().toUpperCase()}{((Number(formData.startingNumber) || 1) + (Number(formData.quantity) || 1) - 1).toString().padStart(4, '0')}
                   </span>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                  <div className="space-y-2">
                    <Label htmlFor="quantity" className="text-xs font-bold text-gray-500 uppercase tracking-tight">Total Qty</Label>
                    <Input id="quantity" name="quantity" type="number" min="1" className="h-10 text-sm border-gray-200 focus-visible:ring-primary rounded-md font-bold bg-gray-50" value={formData.quantity} onChange={handleInputChange} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="discountValue" className="text-xs font-bold text-emerald-600 uppercase tracking-tight">Credit Val (₹)</Label>
                    <Input id="discountValue" name="discountValue" type="number" className="h-10 text-sm border-emerald-200 font-bold focus-visible:ring-emerald-500 rounded-md text-emerald-700 bg-emerald-50/50 shadow-inner" value={formData.discountValue} onChange={handleInputChange} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="handlingFee" className="text-xs font-bold text-gray-500 uppercase tracking-tight">Handling (₹)</Label>
                    <Input id="handlingFee" name="handlingFee" type="number" className="h-10 text-sm border-gray-200 focus-visible:ring-primary rounded-md text-gray-900 bg-gray-50 shadow-inner" value={formData.handlingFee} onChange={handleInputChange} required />
                  </div>
                </div>

                {intendedUse === 'physical' && (
                  <div className="space-y-2">
                    <Label htmlFor="printerName" className="text-xs font-bold text-gray-500 uppercase tracking-tight">Printer / Vendor ID (Optional)</Label>
                    <Input id="printerName" name="printerName" placeholder="Identify the printing press..." className="h-10 text-sm border-gray-200 focus-visible:ring-primary rounded-md bg-gray-50" value={formData.printerName} onChange={handleInputChange} />
                  </div>
                )}

                <Button type="submit" className="w-full h-12 font-bold text-sm uppercase tracking-widest rounded-lg mt-6 shadow-md hover:shadow-lg transition-all" disabled={isGenerating}>
                  {isGenerating ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Commiting to Ledger...</> : "Generate Sequential Batch"}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* SIDEBAR / STATUS SECTION */}
          <div className="md:col-span-2 space-y-6">
            <Card className={`shadow-sm border-gray-200/60 overflow-hidden rounded-lg transition-all duration-500 ${successBatch ? 'bg-white' : 'bg-gray-50/50 opacity-80'}`}>
              <CardHeader className="bg-gray-50/50 py-3 px-4 border-b border-gray-200/60">
                <div className="flex items-center gap-2">
                  {intendedUse === 'digital' ? <QrCode className="h-4 w-4 text-indigo-400" /> : <Printer className="h-4 w-4 text-gray-400" />}
                  <h3 className="text-xs font-bold text-gray-500 uppercase tracking-tight">Post-Generation Actions</h3>
                </div>
              </CardHeader>
              <CardContent className="pt-6 pb-6 text-center">
                {successBatch ? (
                  <div className="space-y-5">
                    <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100 mb-2">
                       <CheckCircle2 className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="text-3xl font-black text-gray-900 leading-none">{successBatch.codes.length}</p>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Identifiers Ready</p>
                    </div>
                    
                    <div className="p-3 rounded-md bg-gray-50 border border-gray-100 text-left">
                       <p className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter">Batch Pointer</p>
                       <p className="text-xs font-mono font-bold text-gray-700 mt-1">{successBatch.batchNo}</p>
                    </div>

                    <div className="flex flex-col gap-3 pt-2">
                      <div className="flex gap-2">
                        <Button onClick={downloadExcel} variant="outline" className="flex-1 h-11 text-[11px] font-semibold bg-background border-border rounded-lg shadow-sm transition-all text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/5">
                          <FileSpreadsheet className="mr-1.5 h-4 w-4" />
                          Download
                        </Button>
                        <Button onClick={shareExcel} variant="outline" className="flex-1 h-11 text-[11px] font-semibold bg-background border-border rounded-lg shadow-sm transition-all text-blue-600 hover:text-blue-700 hover:bg-blue-500/5">
                          <Share2 className="mr-1.5 h-4 w-4" />
                          Share List
                        </Button>
                      </div>
                      
                      {intendedUse === 'physical' ? (
                        <Button onClick={handlePrint} className="w-full h-11 text-xs font-semibold rounded-lg shadow-sm transition-all bg-slate-900 hover:bg-slate-800 text-white">
                          <Printer className="mr-2 h-4 w-4" />
                          Print Quick Strips
                        </Button>
                      ) : (
                        <div className="space-y-2 mt-2">
                          <p className="text-[10px] text-gray-500 font-medium leading-tight">These codes are completely digital. Proceed to distribution to activate the Event QR.</p>
                          <Link href="/vouchers" className="w-full block">
                            <Button className="w-full h-11 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-all">
                              <QrCode className="mr-2 h-4 w-4" />
                              Proceed to Event Allocation
                            </Button>
                          </Link>
                        </div>
                      )}

                    </div>
                  </div>
                ) : (
                  <div className="py-8 space-y-3">
                    <div className="h-10 w-10 rounded-lg bg-gray-100 border border-gray-200 mx-auto flex items-center justify-center">
                       <Ticket className="h-5 w-5 text-gray-300" />
                    </div>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-tighter">Pending Batch Creation</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="p-4 rounded-xl border border-blue-100 bg-blue-50/30 space-y-2">
              <div className="flex items-center gap-2 text-blue-900">
                <Info className="h-3.5 w-3.5" />
                <span className="text-[11px] font-bold uppercase tracking-tight">Voucher Lifecycle</span>
              </div>
              <p className="text-[11px] leading-relaxed text-blue-700 font-medium">
                Vouchers are initially valid for <span className="font-bold">6 months</span>. Upon customer scan & registration, validity automatically shrinks to <span className="font-bold">2 months</span>.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* ✨ NEW: Success Celebration Modal */}
      <Dialog open={showSuccessModal} onOpenChange={setShowSuccessModal}>
        <DialogContent className="sm:max-w-md text-center flex flex-col items-center border-none shadow-2xl p-6 rounded-2xl">
          <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-2 shadow-sm border border-emerald-200">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <DialogHeader>
            <DialogTitle className="text-2xl font-black text-slate-900 text-center tracking-tight">Batch Generated!</DialogTitle>
            <DialogDescription className="text-center text-slate-500 mt-2 font-medium">
              Successfully created <strong className="text-slate-800">{successBatch?.codes.length}</strong> sequential vouchers for batch <strong className="text-slate-800">{successBatch?.batchNo}</strong>.
            </DialogDescription>
          </DialogHeader>
          
          <div className="w-full bg-slate-50 border border-slate-100 p-4 rounded-xl mt-4 mb-2 text-left space-y-3 shadow-inner">
            <div className="flex justify-between text-sm">
              <span className="text-slate-500 font-bold uppercase tracking-wider text-[10px]">Format Type</span>
              <span className="font-bold text-slate-800 flex items-center gap-1.5 text-xs">
                {intendedUse === 'physical' ? <><Printer className="w-3.5 h-3.5 text-slate-400"/> Physical Booklets</> : <><QrCode className="w-3.5 h-3.5 text-indigo-500"/> Digital Event Pool</>}
              </span>
            </div>
            <div className="flex justify-between text-sm border-t border-slate-200 pt-3">
              <span className="text-slate-500 font-bold uppercase tracking-wider text-[10px]">Sequence Series</span>
              <span className="font-mono font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100 text-xs">
                {successBatch?.codes[0]} <span className="text-slate-400 mx-1">→</span> {successBatch?.codes[(successBatch?.codes.length || 1) - 1]}
              </span>
            </div>
          </div>

          <DialogFooter className="w-full sm:justify-center flex-col sm:flex-col gap-2 mt-4">
            <Button 
              className={`w-full text-white font-bold h-12 text-sm rounded-xl shadow-md transition-all ${intendedUse === 'physical' ? 'bg-slate-900 hover:bg-slate-800' : 'bg-indigo-600 hover:bg-indigo-700'}`}
              onClick={() => setShowSuccessModal(false)}
            >
              Continue to Actions <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* --- HIDDEN PRINT AREA (13cm x 3.5cm Strips) --- */}
      <div className="hidden">
        <div ref={printRef}>
          <style type="text/css" media="print">
            {`
              @page { size: 130mm 35mm; margin: 0; }
              body { margin: 0; padding: 0; background: white; -webkit-print-color-adjust: exact; }
              .ticket-strip { 
                width: 130mm; height: 35mm; display: flex; 
                border: 1px solid #ccc; box-sizing: border-box;
                page-break-after: always;
                font-family: Arial, sans-serif;
              }
              .ticket-left { flex: 1; padding: 3mm 4mm; display: flex; flex-direction: column; justify-content: center; }
              .ticket-right { width: 35mm; display: flex; align-items: center; justify-content: center; border-left: 1px dashed #ccc; padding: 2mm; }
            `}
          </style>
          {successBatch?.codes.map((code) => (
            <div key={code} className="ticket-strip">
              <div className="ticket-left">
                <h1 style={{ fontSize: '14px', fontWeight: '900', margin: 0, color: '#000', textTransform: 'uppercase' }}>
                  {companyName}
                </h1>
                <p style={{ fontSize: '7px', textTransform: 'uppercase', color: '#666', marginTop: '1px', marginBottom: '4px' }}>
                  Exclusive Gift Voucher · Value: ₹{successBatch.discount}
                </p>
                <p style={{ fontSize: '16px', fontWeight: 'bold', fontFamily: 'monospace', letterSpacing: '2px', margin: '4px 0' }}>
                  {code}
                </p>
                <div style={{ backgroundColor: '#f0f0f0', padding: '2px 4px', borderRadius: '2px', marginTop: 'auto' }}>
                  <p style={{ fontSize: '6px', fontWeight: 'bold', margin: 0, textTransform: 'uppercase' }}>
                    ⚠️ Valid ONLY after claiming online. Scan QR to register.
                  </p>
                  <p style={{ fontSize: '5px', margin: '1px 0 0 0', color: '#666' }}>
                    Valid for 6 months. Post-registration validity is 2 months. T&C Apply.
                  </p>
                </div>
              </div>
              <div className="ticket-right">
                <QRCode value={`${baseUrl}/claim?code=${code}`} size={90} level="M" style={{ height: "26mm", width: "26mm" }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}