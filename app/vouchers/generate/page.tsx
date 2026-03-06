"use client";

import { useState } from "react";
import Link from "next/link";
import * as XLSX from "xlsx";
import { 
  Loader2, 
  Download, 
  CheckCircle2, 
  PlusCircle, 
  ArrowLeft, 
  ChevronRight, 
  RefreshCw, 
  Database,
  Printer,
  Ticket,
  FileSpreadsheet,
  Info
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/hooks/useAuth";
import { Separator } from "@/components/ui/separator";

// Helper function to generate a secure-looking alphanumeric string
const generateSecureCode = (prefix: string) => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let randomPart = "";
  for (let i = 0; i < 6; i++) {
    randomPart += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return prefix ? `${prefix.toUpperCase()}-${randomPart}` : randomPart;
};

export default function GenerateVouchersPage() {
  const { toast } = useToast();
  const { appUser } = useAuth();
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [successBatch, setSuccessBatch] = useState<{ batchNo: string; codes: string[]; discount: number } | null>(null);

  const [formData, setFormData] = useState({
    prefix: "FESTIVAL",
    quantity: 100,
    discountValue: 500,
    printerName: "",
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsGenerating(true);

    try {
      if (!appUser || !appUser.company_id) {
        throw new Error("Authentication error: Could not verify your company profile.");
      }

      const companyId = appUser.company_id;
      const batchNo = `PO-${Date.now().toString().slice(-6)}`;
      const quantity = Number(formData.quantity);
      const discount = Number(formData.discountValue);

      const generatedCodes = Array.from({ length: quantity }, () => generateSecureCode(formData.prefix));

      const { data: batchData, error: batchError } = await supabase
        .from("voucher_batches")
        .insert({
          company_id: companyId,
          batch_no: batchNo,
          prefix: formData.prefix.toUpperCase(),
          quantity: quantity,
          discount_value: discount,
          printer_name: formData.printerName,
          status: "generated",
        })
        .select()
        .single();

      if (batchError) throw new Error(batchError.message);

      const vouchersToInsert = generatedCodes.map((code) => ({
        batch_id: batchData.id,
        code: code,
        discount_value: discount,
        status: "pending_print",
      }));

      const { error: vouchersError } = await supabase
        .from("vouchers")
        .insert(vouchersToInsert);

      if (vouchersError) throw new Error(vouchersError.message);

      setSuccessBatch({ batchNo, codes: generatedCodes, discount });
      
      toast({
        title: "Batch Generated",
        description: `${quantity} vouchers successfully committed to database.`,
      });

    } catch (error: any) {
      console.error("Error generating vouchers:", error);
      toast({
        title: "Process Failed",
        description: error.message || "An error occurred during batch creation.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadExcel = () => {
    if (!successBatch) return;

    const exportData = successBatch.codes.map((code, index) => ({
      "Sr No": index + 1,
      "Voucher Code": code,
      "Discount Value": successBatch.discount,
      "Batch Reference": successBatch.batchNo,
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Vouchers");
    worksheet["!cols"] = [{ wch: 8 }, { wch: 25 }, { wch: 15 }, { wch: 20 }];
    XLSX.writeFile(workbook, `Vouchers_${successBatch.batchNo}.xlsx`);
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#fafafa]">
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
            <span className="font-bold text-gray-900 select-none">Generate Vouchers</span>
            
            <div className="ml-3 hidden md:flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-gray-100 border border-gray-200">
              <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-tighter">Write Mode</span>
            </div>
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="h-8 px-2 text-xs font-medium text-gray-500 hover:text-gray-900">
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            Reset Form
          </Button>
          <Separator orientation="vertical" className="h-4 mx-1" />
          <Button variant="outline" size="sm" className="h-8 text-xs font-bold px-3 shadow-sm border-gray-200">
            <Database className="h-3.5 w-3.5 mr-1.5 text-gray-400" />
            Voucher DB
          </Button>
        </div>
      </header>

      <main className="p-4 md:p-8 max-w-[1000px] w-full mx-auto space-y-6 animate-in fade-in duration-500">
        <div className="grid gap-6 md:grid-cols-5">
          
          {/* Main Form Section */}
          <Card className="md:col-span-3 shadow-sm border-gray-200/60 overflow-hidden bg-white">
            <CardHeader className="bg-gray-50/50 py-3 px-4 border-b">
              <div className="flex items-center gap-2">
                <PlusCircle className="h-4 w-4 text-gray-400" />
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-tight">Batch Configuration</h3>
              </div>
            </CardHeader>
            <CardContent className="pt-6 pb-6">
              <form onSubmit={handleGenerate} className="space-y-5">
                <div className="space-y-1.5">
                  <Label htmlFor="prefix" className="text-[11px] font-bold text-gray-400 uppercase">Code Prefix</Label>
                  <Input
                    id="prefix"
                    name="prefix"
                    placeholder="e.g., FESTIVAL"
                    className="h-9 text-sm font-mono bg-muted/20 border-gray-200 focus-visible:ring-gray-300 uppercase"
                    value={formData.prefix}
                    onChange={handleInputChange}
                    required
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="quantity" className="text-[11px] font-bold text-gray-400 uppercase">Quantity</Label>
                    <Input
                      id="quantity"
                      name="quantity"
                      type="number"
                      className="h-9 text-sm bg-muted/20 border-gray-200 focus-visible:ring-gray-300"
                      value={formData.quantity}
                      onChange={handleInputChange}
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="discountValue" className="text-[11px] font-bold text-gray-400 uppercase">Discount (₹)</Label>
                    <Input
                      id="discountValue"
                      name="discountValue"
                      type="number"
                      className="h-9 text-sm bg-muted/20 border-gray-200 font-bold focus-visible:ring-gray-300"
                      value={formData.discountValue}
                      onChange={handleInputChange}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="printerName" className="text-[11px] font-bold text-gray-400 uppercase">Printer / Vendor</Label>
                  <Input
                    id="printerName"
                    name="printerName"
                    placeholder="Optional vendor name..."
                    className="h-9 text-sm bg-muted/20 border-gray-200 focus-visible:ring-gray-300"
                    value={formData.printerName}
                    onChange={handleInputChange}
                  />
                </div>

                <Button type="submit" className="w-full h-10 font-bold text-xs uppercase tracking-widest shadow-md" disabled={isGenerating}>
                  {isGenerating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Commiting to Ledger...
                    </>
                  ) : (
                    "Generate Batch"
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Sidebar / Status Section */}
          <div className="md:col-span-2 space-y-4">
            
            {/* Status Info Card */}
            <Card className={`shadow-sm border-gray-200/60 overflow-hidden transition-all duration-500 ${successBatch ? 'bg-white' : 'bg-gray-50/50 opacity-60'}`}>
              <CardHeader className="bg-gray-50/50 py-3 px-4 border-b">
                <div className="flex items-center gap-2">
                  <Printer className="h-4 w-4 text-gray-400" />
                  <h3 className="text-xs font-bold text-gray-500 uppercase tracking-tight">Print Assets</h3>
                </div>
              </CardHeader>
              <CardContent className="pt-6 pb-6 text-center">
                {successBatch ? (
                  <div className="space-y-5">
                    <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100 mb-2">
                       <CheckCircle2 className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="text-2xl font-black text-gray-900 leading-none">{successBatch.codes.length}</p>
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1">Unique Identifiers Ready</p>
                    </div>
                    
                    <div className="p-3 rounded-md bg-muted/30 border border-gray-100 text-left">
                       <p className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter">Batch Pointer</p>
                       <p className="text-xs font-mono font-bold text-gray-700">{successBatch.batchNo}</p>
                    </div>

                    <Button onClick={downloadExcel} variant="outline" className="w-full h-9 text-xs font-bold bg-white hover:bg-gray-50 border-gray-200 shadow-sm transition-all hover:scale-[1.02]">
                      <FileSpreadsheet className="mr-2 h-4 w-4 text-emerald-600" />
                      Download Manifest (.xlsx)
                    </Button>
                  </div>
                ) : (
                  <div className="py-8 space-y-3">
                    <div className="h-10 w-10 rounded-lg bg-gray-100 border border-gray-200 mx-auto flex items-center justify-center">
                       <Ticket className="h-5 w-5 text-gray-300" />
                    </div>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-tighter italic">Pending Batch Creation</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Hint Box */}
            <div className="p-4 rounded-xl border border-blue-100 bg-blue-50/30 space-y-2">
              <div className="flex items-center gap-2 text-blue-900">
                <Info className="h-3.5 w-3.5" />
                <span className="text-[11px] font-bold uppercase tracking-tight">System Notice</span>
              </div>
              <p className="text-[11px] leading-relaxed text-blue-700 font-medium">
                Vouchers are initialized with <span className="font-bold underline italic">pending_print</span> status. They will transition to inventory upon physical card ingestion.
              </p>
            </div>

          </div>
        </div>
      </main>
    </div>
  );
}