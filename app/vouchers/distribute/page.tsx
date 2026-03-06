"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { 
  Send, 
  Loader2, 
  Store, 
  Package, 
  AlertCircle, 
  ArrowLeft, 
  ChevronRight, 
  RefreshCw, 
  Database,
  Info,
  CheckCircle2
} from "lucide-react";

import { supabase } from "@/lib/supabaseClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface Distributor {
  id: string;
  distributor_name: string;
  distributor_type: string;
}

interface BatchStats {
  id: string;
  batch_no: string;
  discount_value: number;
  available_stock: number;
}

export default function DistributePage() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [distributors, setDistributors] = useState<Distributor[]>([]);
  const [batches, setBatches] = useState<BatchStats[]>([]);

  const [selectedDistributor, setSelectedDistributor] = useState<string>("");
  const [selectedBatch, setSelectedBatch] = useState<string>("");
  const [quantity, setQuantity] = useState<string>("");

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setIsLoading(true);
    try {
      const { data: distData, error: distError } = await supabase
        .from("voucher_distributors")
        .select("id, distributor_name, distributor_type")
        .order("distributor_name");

      if (distError) throw distError;
      setDistributors(distData || []);

      const { data: batchData, error: batchError } = await supabase
        .from("voucher_batches")
        .select(`
          id, 
          batch_no, 
          discount_value,
          vouchers (count)
        `)
        .eq("status", "received_from_printer")
        .eq("vouchers.status", "in_stock");

      if (batchError) throw batchError;

      const formattedBatches = (batchData as any[])
        .map(b => ({
          id: b.id,
          batch_no: b.batch_no,
          discount_value: b.discount_value,
          available_stock: b.vouchers[0].count
        }))
        .filter(b => b.available_stock > 0);

      setBatches(formattedBatches);
    } catch (error: any) {
      console.error("Error fetching data:", error);
      toast({
        title: "Sync Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDistribute = async (e: React.FormEvent) => {
    e.preventDefault();
    const qty = parseInt(quantity);
    const activeBatch = batches.find(b => b.id === selectedBatch);

    if (!selectedDistributor || !selectedBatch || !qty || qty <= 0) {
      toast({ title: "Validation Required", description: "All fields are mandatory.", variant: "destructive" });
      return;
    }

    if (activeBatch && qty > activeBatch.available_stock) {
      toast({ title: "Stock Conflict", description: `Requested ${qty} but only ${activeBatch.available_stock} remain in batch.`, variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      const { data: vouchersToUpdate, error: fetchError } = await supabase
        .from("vouchers")
        .select("id")
        .eq("batch_id", selectedBatch)
        .eq("status", "in_stock")
        .limit(qty);

      if (fetchError) throw fetchError;
      if (!vouchersToUpdate || vouchersToUpdate.length < qty) {
        throw new Error("Inventory availability changed. Please refresh.");
      }

      const voucherIds = vouchersToUpdate.map(v => v.id);

      const { error: updateError } = await supabase
        .from("vouchers")
        .update({
          distributor_id: selectedDistributor,
          status: "distributed"
        })
        .in("id", voucherIds);

      if (updateError) throw updateError;

      const distName = distributors.find(d => d.id === selectedDistributor)?.distributor_name;

      toast({
        title: "Transfer Complete",
        description: `${qty} units issued to ${distName}.`,
      });

      setQuantity("");
      setSelectedBatch("");
      fetchInitialData();
    } catch (error: any) {
      console.error("Distribution error:", error);
      toast({
        title: "Transfer Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const activeBatch = batches.find(b => b.id === selectedBatch);

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
            <span className="font-bold text-gray-900 select-none">Issue Vouchers</span>
            
            <div className="ml-3 hidden md:flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-gray-100 border border-gray-200">
              <div className="h-1.5 w-1.5 rounded-full bg-orange-500" />
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-tighter">Transaction Mode</span>
            </div>
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="h-8 px-2 text-xs font-medium text-gray-500 hover:text-gray-900" onClick={fetchInitialData}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isLoading ? 'animate-spin' : ''}`} />
            Sync Stock
          </Button>
          <Separator orientation="vertical" className="h-4 mx-1" />
          <Button variant="outline" size="sm" className="h-8 text-xs font-bold px-3 shadow-sm border-gray-200">
            <Database className="h-3.5 w-3.5 mr-1.5 text-gray-400" />
            Transfer Ledger
          </Button>
        </div>
      </header>

      <main className="p-4 md:p-8 max-w-[800px] w-full mx-auto space-y-6 animate-in fade-in duration-500">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-widest text-gray-500">Distribution Request</h2>
            <p className="text-xs text-gray-400 mt-1 uppercase tracking-tight font-medium">Assign warehouse stock to authorized B2B partners</p>
          </div>
        </div>

        <Card className="shadow-sm border-gray-200/60 overflow-hidden bg-white">
          <CardHeader className="bg-gray-50/50 py-3 px-4 border-b">
            <div className="flex items-center gap-2">
              <Send className="h-4 w-4 text-gray-400" />
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-tight">Transfer Manifest</h3>
            </div>
          </CardHeader>
          <CardContent className="pt-8 pb-8 px-6">
            {isLoading ? (
              <div className="flex flex-col items-center py-12 space-y-4">
                <Loader2 className="h-8 w-8 animate-spin text-gray-200" />
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Validating Inventory...</p>
              </div>
            ) : (
              <form id="distribute-form" onSubmit={handleDistribute} className="space-y-8">
                
                {/* 1. Distributor Selection */}
                <div className="space-y-1.5">
                  <Label htmlFor="distributor" className="text-[11px] font-bold text-gray-400 uppercase">Target Partner</Label>
                  <Select value={selectedDistributor} onValueChange={setSelectedDistributor} required>
                    <SelectTrigger id="distributor" className="h-9 text-sm border-gray-200 bg-muted/20 focus:ring-gray-300">
                      <SelectValue placeholder="Select business partner..." />
                    </SelectTrigger>
                    <SelectContent>
                      {distributors.map(dist => (
                        <SelectItem key={dist.id} value={dist.id} className="text-xs font-medium">
                          <div className="flex items-center gap-2">
                            <Store className="w-3.5 h-3.5 text-muted-foreground" />
                            {dist.distributor_name} 
                            <span className="text-[10px] text-gray-400 ml-1 uppercase">({dist.distributor_type})</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* 2. Batch Selection */}
                <div className="space-y-1.5">
                  <Label htmlFor="batch" className="text-[11px] font-bold text-gray-400 uppercase">Source Batch</Label>
                  <Select value={selectedBatch} onValueChange={setSelectedBatch} required>
                    <SelectTrigger id="batch" className="h-9 text-sm border-gray-200 bg-muted/20 focus:ring-gray-300">
                      <SelectValue placeholder="Choose batch from stock..." />
                    </SelectTrigger>
                    <SelectContent>
                      {batches.length === 0 && <SelectItem value="none" disabled>Insufficient inventory across all batches</SelectItem>}
                      {batches.map(batch => (
                        <SelectItem key={batch.id} value={batch.id} className="text-xs font-medium">
                          <div className="flex items-center justify-between w-full gap-8">
                            <span className="flex items-center gap-2">
                              <Package className="w-3.5 h-3.5 text-muted-foreground" />
                              {batch.batch_no} (₹{batch.discount_value})
                            </span>
                            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded uppercase">
                              {batch.available_stock} Avail.
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* 3. Quantity */}
                <div className="space-y-1.5">
                  <Label htmlFor="quantity" className="text-[11px] font-bold text-gray-400 uppercase">Transfer Quantity</Label>
                  <div className="flex items-center gap-4">
                    <div className="relative flex-1 max-w-[240px]">
                       <Input
                        id="quantity"
                        type="number"
                        min="1"
                        max={activeBatch?.available_stock || 1}
                        value={quantity}
                        onChange={(e) => setQuantity(e.target.value)}
                        placeholder="0"
                        className="h-9 text-sm border-gray-200 bg-muted/20 font-bold focus-visible:ring-gray-300"
                        required
                        disabled={!selectedBatch}
                      />
                    </div>
                    {activeBatch && (
                      <div className="flex items-center gap-1.5 px-3 h-9 rounded-md border border-emerald-100 bg-emerald-50/50">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                        <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-tight">Limit: {activeBatch.available_stock} Units</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Notification Area */}
                <div className="p-4 rounded-xl border border-blue-100 bg-blue-50/30 space-y-2">
                  <div className="flex items-center gap-2 text-blue-900">
                    <Info className="h-3.5 w-3.5" />
                    <span className="text-[11px] font-bold uppercase tracking-tight">Auto-Expiry Notice</span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-blue-700 font-medium">
                    This transfer will initialize a strict <span className="font-bold underline italic">90-day lifecycle</span> for these assets. Redemption will be systematically denied upon crossing the threshold.
                  </p>
                </div>

                <Button 
                  type="submit" 
                  disabled={isSubmitting || isLoading || batches.length === 0}
                  className="w-full h-10 font-bold text-xs uppercase tracking-widest shadow-md"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processing Transfer...
                    </>
                  ) : (
                    "Authorize Distribution"
                  )}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}