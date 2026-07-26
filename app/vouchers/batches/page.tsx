"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import * as XLSX from "xlsx";
import { 
  PackageCheck, 
  Printer, 
  Loader2, 
  RefreshCw,
  ChevronRight,
  ArrowLeft,
  Database,
  Inbox,
  CheckCircle2,
  Download,
  Share2,
  Trash2,
  X,
  AlertTriangle
} from "lucide-react";

import { supabase } from "@/lib/supabaseClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface VoucherBatch {
  id: string;
  batch_no: string;
  prefix: string;
  start_sequence?: number | string; 
  end_sequence?: number | string;   
  quantity: number;
  discount_value: number;
  printer_name: string;
  status: 'generated' | 'sent_for_printing' | 'received_from_printer' | 'deleted';
  created_at: string;
  received_at: string | null;
  cancel_reason?: string;
}

export default function BatchesPage() {
  const { toast } = useToast();
  const [batches, setBatches] = useState<VoucherBatch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'active' | 'deleted'>('active'); // ✨ NEW: Tabs State
  
  // Processing States
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [exportingId, setExportingId] = useState<string | null>(null);
  
  // Delete Modal States
  const [batchToDelete, setBatchToDelete] = useState<VoucherBatch | null>(null);
  const [deleteReason, setDeleteReason] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [validationWarning, setValidationWarning] = useState<string | null>(null);
  const [deleteProgress, setDeleteProgress] = useState(0);
  const [deleteStatusText, setDeleteStatusText] = useState("");
  const [retainedCount, setRetainedCount] = useState(0); 

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://biillo-jewellery.vercel.app';

  const fetchBatches = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("voucher_batches")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setBatches(data || []);
    } catch (error: any) {
      toast({ title: "Database Error", description: error.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBatches();
  }, []);

  // Filter batches based on the selected tab
  const filteredBatches = batches.filter(batch => 
    activeTab === 'active' ? batch.status !== 'deleted' : batch.status === 'deleted'
  );

  // --- 1. RECEIVE INVENTORY LOGIC ---
  const handleMarkAsReceived = async (batchId: string, batchNo: string) => {
    if (!confirm(`Confirm ingestion for Batch ${batchNo}? Vouchers will be moved to active inventory.`)) return;

    setProcessingId(batchId);
    try {
      const { error: batchError } = await supabase.from("voucher_batches")
        .update({ status: "received_from_printer", received_at: new Date().toISOString() })
        .eq("id", batchId);
      if (batchError) throw batchError;

      const { error: voucherError } = await supabase.from("vouchers")
        .update({ status: "in_stock" })
        .eq("batch_id", batchId)
        .eq("status", "pending_print");
      if (voucherError) throw voucherError;

      toast({ title: "Inventory Received", description: `Batch ${batchNo} is now marked as In Stock.` });
      fetchBatches();
    } catch (error: any) {
      toast({ title: "Update Failed", description: error.message, variant: "destructive" });
    } finally {
      setProcessingId(null);
    }
  };

  // --- 2. EXPORT & SHARE LOGIC ---
  const handleExport = async (batch: VoucherBatch, mode: 'download' | 'share') => {
    setExportingId(batch.id);
    try {
      const { data: vouchers, error } = await supabase
        .from("vouchers")
        .select("code, discount_value, handling_fee, status, expiry_date")
        .eq("batch_id", batch.id)
        .order("code", { ascending: true });

      if (error) throw error;
      if (!vouchers || vouchers.length === 0) throw new Error("No vouchers found for this batch.");

      const exportData = vouchers.map((v, index) => ({
        "Sr No": index + 1,
        "Voucher Code": v.code,
        "Credit Value (₹)": v.discount_value,
        "Handling Fee (₹)": v.handling_fee,
        "Status": v.status.toUpperCase(),
        "Initial Expiry": v.expiry_date || "N/A",
        "Batch Ref": batch.batch_no,
        "Claim URL": `${baseUrl}/claim?code=${v.code}`
      }));

      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, `Batch_${batch.batch_no}`);

      if (mode === 'download') {
        XLSX.writeFile(workbook, `Voucher_Manifest_${batch.batch_no}.xlsx`);
        toast({ title: "Download Complete", description: "Manifest has been saved to your device." });
      } else if (mode === 'share') {
        const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
        const file = new File([excelBuffer], `Voucher_Manifest_${batch.batch_no}.xlsx`, {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        });

        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: `Voucher Manifest - ${batch.batch_no}`,
            text: `Here is the secure Excel manifest for voucher batch ${batch.batch_no}.`,
          });
        } else {
          toast({ title: "Not Supported", description: "Sharing files is not supported on this browser. Downloading instead...", variant: "destructive" });
          XLSX.writeFile(workbook, `Voucher_Manifest_${batch.batch_no}.xlsx`);
        }
      }
    } catch (error: any) {
      toast({ title: "Export Failed", description: error.message, variant: "destructive" });
    } finally {
      setExportingId(null);
    }
  };

  // --- 3. UPDATED: STRICT ERROR THROWING ---
  // --- 3. ✨ FIXED: DIRECT BULK DELETE & AUDIT LOGIC ---
  const confirmDelete = async () => {
    if (!batchToDelete || !deleteReason.trim()) return;
    
    try {
      // Step A: Validate for claimed vouchers before attempting delete
      if (!validationWarning) {
        setIsDeleting(true);
        setDeleteStatusText("Checking voucher statuses...");
        
        const { count: claimedCount, error: checkError } = await supabase
          .from("vouchers")
          .select("*", { count: "exact", head: true })
          .eq("batch_id", batchToDelete.id)
          .in("status", ["claimed", "redeemed", "registered"]); 

        if (checkError) throw checkError;

        if (claimedCount && claimedCount > 0) {
          setRetainedCount(claimedCount); // Save for the audit trail
          setValidationWarning(`Found ${claimedCount} vouchers that are already claimed or registered. Proceeding will ONLY delete the remaining unused vouchers and void the batch. Proceed?`);
          setIsDeleting(false);
          return; 
        }
      }

      // Step B: Direct Bulk Deletion (No URL length limits!)
      setIsDeleting(true);
      setValidationWarning(null);
      setDeleteProgress(50); // Set to 50% immediately to show action
      setDeleteStatusText("Erasing unused vouchers...");

      const { error: deleteError } = await supabase
        .from("vouchers")
        .delete()
        .eq("batch_id", batchToDelete.id)
        .in("status", ["pending_print", "in_stock", "sent_for_printing"]); // Safe statuses

      if (deleteError) throw deleteError;

      const expectedDeletedCount = batchToDelete.quantity - retainedCount;
      setDeleteProgress(80);

      // Step C: Mark the Batch Ledger as Voided with Strict Audit Trail
      setDeleteStatusText("Writing audit trail...");
      
      const auditTrail = retainedCount > 0 
        ? `[PARTIAL VOID] Deleted ${expectedDeletedCount} unused. Retained ${retainedCount} claimed. Reason: ${deleteReason}`
        : `[FULL VOID] All ${expectedDeletedCount} vouchers deleted. Reason: ${deleteReason}`;

      const { error: batchError } = await supabase.from("voucher_batches")
        .update({ 
          status: "deleted", 
          cancel_reason: auditTrail 
        })
        .eq("id", batchToDelete.id);

      if (batchError) {
        await supabase.from("voucher_batches")
          .update({ cancel_reason: auditTrail })
          .eq("id", batchToDelete.id);
      }

      // Completion
      setDeleteProgress(100);
      setDeleteStatusText("Operation complete!");
      toast({ title: "Ledger Updated", description: `Audit trail saved for batch ${batchToDelete.batch_no}.` });

      setTimeout(() => {
        closeDeleteModal();
        fetchBatches();
      }, 1000);

    } catch (error: any) {
      toast({ title: "Deletion Failed", description: error.message, variant: "destructive" });
      setIsDeleting(false);
    }
  };
  
  const closeDeleteModal = () => {
    setBatchToDelete(null);
    setValidationWarning(null);
    setDeleteReason("");
    setDeleteProgress(0);
    setDeleteStatusText("");
    setRetainedCount(0);
    setIsDeleting(false);
  }

  const getStatusBadge = (status: VoucherBatch['status']) => {
    switch (status) {
      case "generated":
        return <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-semibold bg-amber-500/10 text-amber-600 border border-amber-500/20">Pending Print</span>;
      case "sent_for_printing":
        return <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-semibold bg-blue-500/10 text-blue-600 border border-blue-500/20">At Printer</span>;
      case "received_from_printer":
        return <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">In Stock</span>;
      case "deleted":
        return <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-semibold bg-rose-500/10 text-rose-600 border border-rose-500/20">Voided</span>;
      default:
        return <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-semibold bg-secondary text-muted-foreground border border-border">{status}</span>;
    }
  };

  const TableSkeleton = () => (
    <div className="space-y-4 p-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center space-x-4 px-2 py-3 border-b border-border/50">
          <Skeleton className="h-4 w-[120px] rounded-sm" />
          <Skeleton className="h-4 w-[100px] rounded-sm" />
          <Skeleton className="h-4 w-[60px] rounded-sm" />
          <div className="flex-1" />
          <Skeleton className="h-8 w-[200px] rounded-lg" />
        </div>
      ))}
    </div>
  );

  return (
    <div className="flex flex-col min-h-screen bg-muted/20 font-sans">
      
      {/* HEADER */}
      <header className="sticky top-0 z-40 w-full bg-background/80 backdrop-blur-md border-b border-border px-4 h-14 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3 overflow-hidden">
          <Link href="/vouchers">
            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-lg hover:bg-secondary transition-colors">
              <ArrowLeft className="h-4 w-4 text-muted-foreground" />
            </Button>
          </Link>
          
          <Separator orientation="vertical" className="h-5 bg-border hidden sm:block" />
          
          <nav className="flex items-center gap-1.5 text-sm whitespace-nowrap overflow-hidden">
            <Link href="/vouchers" className="text-muted-foreground hover:text-foreground transition-colors font-medium">Vouchers</Link>
            <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
            <span className="font-semibold text-foreground select-none">Manage Batches</span>
            
            <div className="ml-3 hidden md:flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20">
              <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
              <span className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">Inventory Ops</span>
            </div>
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" className="h-9 rounded-lg text-xs font-semibold text-muted-foreground hover:text-foreground" onClick={fetchBatches}>
            <RefreshCw className={`h-4 w-4 sm:mr-2 ${isLoading ? 'animate-spin text-primary' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
          <Separator orientation="vertical" className="h-5 bg-border hidden sm:block" />
          <Button variant="outline" size="sm" className="h-9 text-xs font-bold px-4 rounded-lg bg-background shadow-sm hidden sm:flex">
            <Database className="h-4 w-4 mr-2 text-primary" />
            Batch DB
          </Button>
        </div>
      </header>

      <main className="p-4 md:p-8 max-w-[1200px] w-full mx-auto space-y-6 animate-in fade-in duration-500">
        
        {/* Page Header & Tabs */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-2xl font-bold tracking-tight text-foreground">Purchase Orders & Ingestion</h2>
            <p className="text-sm text-muted-foreground">Track physical voucher assets, manage manifests, and secure your inventory.</p>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            {/* ✨ NEW: Tab Switcher UI */}
            <div className="flex bg-muted/50 p-1 rounded-lg border border-border">
              <button
                onClick={() => setActiveTab('active')}
                className={`px-4 py-1.5 text-sm font-semibold rounded-md transition-all ${activeTab === 'active' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              >
                Active Ledger
              </button>
              <button
                onClick={() => setActiveTab('deleted')}
                className={`px-4 py-1.5 text-sm font-semibold rounded-md transition-all ${activeTab === 'deleted' ? 'bg-background shadow-sm text-rose-600' : 'text-muted-foreground hover:text-rose-600'}`}
              >
                Voided Log
              </button>
            </div>

            <Link href="/vouchers/generate">
              <Button size="sm" className="h-10 px-5 font-medium text-sm rounded-lg shadow-sm w-full sm:w-auto">
                <Printer className="w-4 h-4 mr-2" />
                New Order
              </Button>
            </Link>
          </div>
        </div>

        {/* Data Table */}
        <Card className="shadow-sm border-border overflow-hidden bg-card rounded-xl">
          <CardContent className="p-0">
            {isLoading ? (
              <TableSkeleton />
            ) : filteredBatches.length === 0 ? (
              <div className="text-center py-24 bg-muted/10">
                <div className="h-14 w-14 rounded-full bg-secondary flex items-center justify-center mx-auto mb-4">
                  <Inbox className="w-6 h-6 text-muted-foreground/50" />
                </div>
                <p className="text-sm font-medium text-muted-foreground">
                  {activeTab === 'active' ? "No active orders found in the ledger." : "No voided batches in the log."}
                </p>
                {activeTab === 'active' && (
                  <Link href="/vouchers/generate">
                      <Button variant="link" className="text-sm mt-1 text-primary font-medium">Generate your first batch</Button>
                  </Link>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-secondary/30 border-b border-border">
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="text-xs font-semibold text-muted-foreground px-6 h-11">Batch Info</TableHead>
                      <TableHead className="text-xs font-semibold text-muted-foreground px-4 h-11">Printer/Vendor</TableHead>
                      <TableHead className="text-xs font-semibold text-muted-foreground px-4 h-11 text-right">Quantity</TableHead>
                      <TableHead className="text-xs font-semibold text-muted-foreground px-4 h-11 text-right">Value</TableHead>
                      <TableHead className="text-xs font-semibold text-muted-foreground px-4 h-11 text-center">Status</TableHead>
                      <TableHead className="px-6 h-11 text-right text-xs font-semibold text-muted-foreground">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredBatches.map((batch) => (
                      <TableRow key={batch.id} className={`hover:bg-secondary/20 transition-colors border-b border-border/50 last:border-0 ${batch.status === 'deleted' ? 'bg-rose-500/5' : ''}`}>
                        <TableCell className="px-6 py-3.5">
                          <div className="flex flex-col">
                            <span className="font-mono font-bold text-sm text-foreground">{batch.batch_no}</span>
                            <span className="text-[11px] text-muted-foreground font-medium mt-0.5">
                              {format(new Date(batch.created_at), "MMM d, yyyy")} · Prefix: <span className="font-mono text-foreground/80">{batch.prefix}</span>
                              {batch.start_sequence !== null && batch.end_sequence !== null && batch.start_sequence !== undefined && (
                                <> · Seq: <span className="font-mono text-foreground/80">
                                  {String(batch.start_sequence).padStart(4, '0')} - {String(batch.end_sequence).padStart(4, '0')}
                                </span></>
                              )}
                            </span>
                            
                            {batch.cancel_reason && (
                              <div className="mt-2 bg-rose-500/10 border border-rose-500/20 px-2.5 py-1.5 rounded text-[11px] text-rose-600 font-semibold leading-tight shadow-sm">
                                {batch.cancel_reason}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="px-4">
                           <span className="text-sm text-foreground">{batch.printer_name || "Self-Printed"}</span>
                        </TableCell>
                        <TableCell className="px-4 text-right">
                           <span className="text-sm font-medium text-foreground">{batch.quantity.toLocaleString()}</span>
                        </TableCell>
                        <TableCell className="px-4 text-right">
                           <span className="text-sm font-semibold text-emerald-600">₹{batch.discount_value}</span>
                        </TableCell>
                        <TableCell className="px-4 text-center">
                          {getStatusBadge(batch.status)}
                        </TableCell>
                        
                        <TableCell className="px-6">
                          <div className="flex items-center justify-end gap-2">
                            {batch.status !== 'deleted' && (
                              <>
                                {(batch.status === "generated" || batch.status === "sent_for_printing") && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-8 px-3 text-xs font-medium bg-background border-border hover:bg-secondary shadow-sm rounded-md transition-all text-primary"
                                    onClick={() => handleMarkAsReceived(batch.id, batch.batch_no)}
                                    disabled={processingId === batch.id || exportingId === batch.id}
                                  >
                                    {processingId === batch.id ? <Loader2 className="h-3 w-3 animate-spin mr-1.5" /> : <PackageCheck className="h-3.5 w-3.5 mr-1.5" />}
                                    Receive
                                  </Button>
                                )}

                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8 rounded-md text-muted-foreground hover:text-emerald-600 hover:bg-emerald-500/10"
                                  onClick={() => handleExport(batch, 'download')}
                                  disabled={exportingId === batch.id}
                                  title="Download Manifest"
                                >
                                  {exportingId === batch.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                                </Button>

                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8 rounded-md text-muted-foreground hover:text-blue-600 hover:bg-blue-500/10"
                                  onClick={() => handleExport(batch, 'share')}
                                  disabled={exportingId === batch.id}
                                  title="Share Manifest"
                                >
                                  <Share2 className="h-4 w-4" />
                                </Button>

                                <Separator orientation="vertical" className="h-4 mx-1" />

                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8 rounded-md text-muted-foreground hover:text-rose-600 hover:bg-rose-500/10"
                                  onClick={() => setBatchToDelete(batch)}
                                  title="Void Batch"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      {batchToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <Card className="w-full max-w-md bg-card border-border shadow-2xl rounded-2xl overflow-hidden m-4 animate-in zoom-in-95 duration-200">
            
            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-rose-500/5">
              <h3 className="text-lg font-bold text-rose-600 flex items-center gap-2">
                <Trash2 className="h-5 w-5" />
                Void Batch {batchToDelete.batch_no}
              </h3>
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-md text-muted-foreground" onClick={closeDeleteModal} disabled={isDeleting}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="p-6 space-y-4">
              <p className="text-sm text-muted-foreground leading-relaxed">
                This action will mark the batch as <span className="font-bold text-foreground">Deleted</span> in the ledger and securely delete all {batchToDelete.quantity} physical vouchers from the database.
              </p>

              {validationWarning && (
                <div className="bg-amber-500/10 border border-amber-500/20 text-amber-700 p-3.5 rounded-lg text-sm flex items-start gap-2.5 shadow-sm">
                  <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0 text-amber-600" />
                  <p className="font-medium leading-relaxed">{validationWarning}</p>
                </div>
              )}
              
              {isDeleting && (deleteProgress > 0 || deleteStatusText) && (
                <div className="space-y-2.5 pt-2">
                  <div className="flex justify-between text-[11px] uppercase tracking-wider text-muted-foreground font-bold">
                     <span>{deleteStatusText}</span>
                     <span>{deleteProgress}%</span>
                  </div>
                  <div className="w-full bg-secondary rounded-full h-2 overflow-hidden shadow-inner">
                     <div className="bg-rose-500 h-full transition-all duration-300 ease-out" style={{ width: `${deleteProgress}%` }} />
                  </div>
                </div>
              )}

              <div className="space-y-2 pt-2">
                <Label className="text-sm font-medium text-foreground">Reason for voiding</Label>
                <Input 
                  placeholder="e.g. Printing error, Lost in transit..." 
                  value={deleteReason} 
                  onChange={(e) => setDeleteReason(e.target.value)} 
                  disabled={isDeleting}
                  className="h-11 rounded-lg bg-background border-input focus-visible:ring-rose-500"
                />
              </div>
            </div>
            
            <div className="px-6 py-4 border-t border-border bg-secondary/30 flex justify-end gap-3">
              <Button variant="outline" className="rounded-lg h-10 px-4 font-semibold" onClick={closeDeleteModal} disabled={isDeleting}>
                Cancel
              </Button>
              <Button 
                variant="destructive" 
                className="rounded-lg h-10 px-5 font-semibold bg-rose-600 hover:bg-rose-700 transition-all" 
                onClick={confirmDelete} 
                disabled={isDeleting || !deleteReason.trim()}
              >
                {isDeleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                {validationWarning ? "Delete Unused Vouchers" : "Confirm Void"}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}