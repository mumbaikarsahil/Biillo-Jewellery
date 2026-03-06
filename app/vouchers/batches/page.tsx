"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { 
  PackageCheck, 
  Printer, 
  Loader2, 
  RefreshCw,
  Clock,
  ChevronRight,
  ArrowLeft,
  Database,
  LayoutDashboard,
  Inbox
} from "lucide-react";

import { supabase } from "@/lib/supabaseClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
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
  quantity: number;
  discount_value: number;
  printer_name: string;
  status: 'generated' | 'sent_for_printing' | 'received_from_printer';
  created_at: string;
  received_at: string | null;
}

export default function BatchesPage() {
  const { toast } = useToast();
  const [batches, setBatches] = useState<VoucherBatch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

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
      console.error("Error fetching batches:", error);
      toast({
        title: "Database Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBatches();
  }, []);

  const handleMarkAsReceived = async (batchId: string, batchNo: string) => {
    if (!confirm(`Confirm ingestion for Batch ${batchNo}? Vouchers will be moved to active inventory.`)) {
      return;
    }

    setProcessingId(batchId);
    try {
      const { error: batchError } = await supabase
        .from("voucher_batches")
        .update({ 
          status: "received_from_printer",
          received_at: new Date().toISOString()
        })
        .eq("id", batchId);

      if (batchError) throw batchError;

      const { error: voucherError } = await supabase
        .from("vouchers")
        .update({ status: "in_stock" })
        .eq("batch_id", batchId)
        .eq("status", "pending_print");

      if (voucherError) throw voucherError;

      toast({
        title: "Inventory Updated",
        description: `Batch ${batchNo} is now marked as In Stock.`,
      });

      fetchBatches();
    } catch (error: any) {
      console.error("Update failed:", error);
      toast({
        title: "Update Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setProcessingId(null);
    }
  };

  const getStatusBadge = (status: VoucherBatch['status']) => {
    switch (status) {
      case "generated":
        return <Badge variant="outline" className="bg-amber-500/5 text-amber-600 border-amber-200/50 text-[10px] font-bold h-5 uppercase">Pending Print</Badge>;
      case "sent_for_printing":
        return <Badge variant="outline" className="bg-blue-500/5 text-blue-600 border-blue-200/50 text-[10px] font-bold h-5 uppercase">At Printer</Badge>;
      case "received_from_printer":
        return <Badge variant="outline" className="bg-emerald-500/5 text-emerald-600 border-emerald-200/50 text-[10px] font-bold h-5 uppercase">In Stock</Badge>;
      default:
        return <Badge variant="secondary" className="text-[10px] h-5 uppercase">{status}</Badge>;
    }
  };

  // --- SKELETON LOADING COMPONENT ---
  const TableSkeleton = () => (
    <div className="space-y-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center space-x-4 px-6 py-4 border-b border-gray-100">
          <Skeleton className="h-4 w-[120px]" />
          <Skeleton className="h-4 w-[80px]" />
          <Skeleton className="h-4 w-[150px]" />
          <div className="flex-1" />
          <Skeleton className="h-4 w-[100px]" />
          <Skeleton className="h-8 w-[100px] rounded-md" />
        </div>
      ))}
    </div>
  );

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
            <span className="font-bold text-gray-900 select-none">Manage Batches</span>
            
            <div className="ml-3 hidden md:flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-gray-100 border border-gray-200">
              <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-tighter">Inventory Ops</span>
            </div>
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="h-8 px-2 text-xs font-medium text-gray-500 hover:text-gray-900" onClick={fetchBatches}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Separator orientation="vertical" className="h-4 mx-1" />
          <Button variant="outline" size="sm" className="h-8 text-xs font-bold px-3 shadow-sm border-gray-200">
            <Database className="h-3.5 w-3.5 mr-1.5 text-gray-400" />
            Batch DB
          </Button>
        </div>
      </header>

      <main className="p-4 md:p-8 max-w-[1200px] w-full mx-auto space-y-6 animate-in fade-in duration-500">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-widest text-gray-500">Purchase Orders & Ingestion</h2>
            <p className="text-xs text-gray-400 mt-1 uppercase tracking-tight font-medium">Track physical voucher assets from printer to warehouse</p>
          </div>
          <Link href="/vouchers/generate">
            <Button size="sm" variant="outline" className="h-9 px-4 font-bold text-xs uppercase tracking-tight shadow-sm bg-white border-gray-200">
              <Printer className="w-3.5 h-3.5 mr-2" />
              New Order
            </Button>
          </Link>
        </div>

        <Card className="shadow-sm border-gray-200/60 overflow-hidden bg-white">
          <CardContent className="p-0">
            {isLoading ? (
              <TableSkeleton />
            ) : batches.length === 0 ? (
              <div className="text-center py-20 bg-gray-50/30">
                <Inbox className="w-12 h-12 mx-auto mb-4 text-gray-200" />
                <p className="text-xs font-bold text-gray-400 uppercase tracking-tighter italic">No orders found in ledger</p>
                <Link href="/vouchers/generate">
                    <Button variant="link" className="text-xs mt-2 text-primary font-bold uppercase tracking-widest">Generate first batch</Button>
                </Link>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-gray-50/50 border-b">
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="text-[10px] font-black uppercase text-gray-400 px-6 h-10">Batch Info</TableHead>
                      <TableHead className="text-[10px] font-black uppercase text-gray-400 px-4 h-10">Printer/Vendor</TableHead>
                      <TableHead className="text-[10px] font-black uppercase text-gray-400 px-4 h-10 text-right">Qty</TableHead>
                      <TableHead className="text-[10px] font-black uppercase text-gray-400 px-4 h-10 text-right">Value</TableHead>
                      <TableHead className="text-[10px] font-black uppercase text-gray-400 px-4 h-10">Created</TableHead>
                      <TableHead className="text-[10px] font-black uppercase text-gray-400 px-4 h-10 text-center">Status</TableHead>
                      <TableHead className="w-[140px] px-6 h-10 text-right text-[10px] font-black uppercase text-gray-400">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {batches.map((batch) => (
                      <TableRow key={batch.id} className="hover:bg-gray-50/50 transition-colors border-b last:border-0">
                        <TableCell className="px-6 py-3">
                          <div className="flex flex-col">
                            <span className="font-mono font-bold text-xs text-gray-900">{batch.batch_no}</span>
                            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter">Prefix: {batch.prefix}</span>
                          </div>
                        </TableCell>
                        <TableCell className="px-4">
                           <span className="text-[13px] font-medium text-gray-600">{batch.printer_name || "Self-Printed"}</span>
                        </TableCell>
                        <TableCell className="px-4 text-right">
                           <span className="text-[13px] font-bold text-gray-900">{batch.quantity.toLocaleString()}</span>
                        </TableCell>
                        <TableCell className="px-4 text-right">
                           <span className="text-[13px] font-bold text-emerald-600">₹{batch.discount_value}</span>
                        </TableCell>
                        <TableCell className="px-4">
                          <span className="text-[11px] font-bold text-gray-400 uppercase">{format(new Date(batch.created_at), "dd MMM yy")}</span>
                        </TableCell>
                        <TableCell className="px-4 text-center">
                          {getStatusBadge(batch.status)}
                        </TableCell>
                        <TableCell className="px-6 text-right">
                          {(batch.status === "generated" || batch.status === "sent_for_printing") ? (
                            <Button
                              size="sm"
                              variant="default"
                              className="h-7 px-3 text-[10px] font-black uppercase tracking-tighter bg-gray-900 hover:bg-black shadow-sm"
                              onClick={() => handleMarkAsReceived(batch.id, batch.batch_no)}
                              disabled={processingId === batch.id}
                            >
                              {processingId === batch.id ? (
                                <Loader2 className="h-3 w-3 animate-spin mr-1.5" />
                              ) : (
                                <PackageCheck className="h-3 w-3 mr-1.5" />
                              )}
                              Ingest
                            </Button>
                          ) : (
                            <div className="flex flex-col items-end">
                                <div className="flex items-center gap-1.5 text-emerald-600">
                                   <CheckCircle2 className="h-3 w-3" />
                                   <span className="text-[10px] font-black uppercase tracking-tighter">Ingested</span>
                                </div>
                                <span className="text-[9px] text-gray-400 font-medium">
                                   {batch.received_at ? format(new Date(batch.received_at), "dd/MM/yy HH:mm") : ''}
                                </span>
                            </div>
                          )}
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
    </div>
  );
}

// Fixed missing icon import in the Table
function CheckCircle2(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}