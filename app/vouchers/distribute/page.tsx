"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { 
  Send, 
  Loader2, 
  Store, 
  Package, 
  ArrowLeft, 
  ChevronRight, 
  RefreshCw, 
  Database,
  Info,
  ListOrdered,
  Hash
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

interface VoucherCode {
  id: string;
  code: string;
}

export default function DistributePage() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [distributors, setDistributors] = useState<Distributor[]>([]);
  const [batches, setBatches] = useState<BatchStats[]>([]);

  const [selectedDistributor, setSelectedDistributor] = useState<string>("");
  const [selectedBatch, setSelectedBatch] = useState<string>("");
  
  // Sequence & Quantity States
  const [availableVouchers, setAvailableVouchers] = useState<VoucherCode[]>([]);
  const [isLoadingVouchers, setIsLoadingVouchers] = useState(false);
  const [quantity, setQuantity] = useState<string>("");

  useEffect(() => {
    fetchInitialData();
  }, []);

  // Fetch the exact sequence of available vouchers whenever the batch changes
  useEffect(() => {
    if (!selectedBatch) {
      setAvailableVouchers([]);
      setQuantity("");
      return;
    }

    const fetchVoucherSequence = async () => {
      setIsLoadingVouchers(true);
      try {
        const { data, error } = await supabase
          .from("vouchers")
          .select("id, code")
          .eq("batch_id", selectedBatch)
          .eq("status", "in_stock")
          .order("code", { ascending: true }); // Guarantees chronological sequence

        if (error) throw error;
        setAvailableVouchers(data || []);
        setQuantity(""); // Reset quantity on new batch
      } catch (error: any) {
        console.error("Error fetching sequence:", error);
        toast({ title: "Sequence Error", description: error.message, variant: "destructive" });
      } finally {
        setIsLoadingVouchers(false);
      }
    };

    fetchVoucherSequence();
  }, [selectedBatch, toast]);

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

  // Compute Start and End Codes dynamically based on user quantity
  const { numQuantity, isValidQuantity, startCode, endCode, vouchersToUpdate } = useMemo(() => {
    const num = parseInt(quantity) || 0;
    const isValid = num > 0 && num <= availableVouchers.length;
    const toUpdate = isValid ? availableVouchers.slice(0, num) : [];
    
    return {
      numQuantity: num,
      isValidQuantity: isValid,
      startCode: isValid ? toUpdate[0].code : "---",
      endCode: isValid ? toUpdate[toUpdate.length - 1].code : "---",
      vouchersToUpdate: toUpdate
    };
  }, [quantity, availableVouchers]);

  const handleDistribute = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedDistributor || !selectedBatch) {
      toast({ title: "Validation Required", description: "Select a Partner and a Batch.", variant: "destructive" });
      return;
    }

    if (!isValidQuantity) {
      toast({ title: "Invalid Quantity", description: `Please enter a valid quantity between 1 and ${availableVouchers.length}.`, variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      const voucherIds = vouchersToUpdate.map(v => v.id);

      const { error: updateError } = await supabase
        .from("vouchers")
        .update({
          distributor_id: selectedDistributor,
          status: "distributed",
          distributed_at: new Date().toISOString()
        })
        .in("id", voucherIds);

      if (updateError) throw updateError;

      const distName = distributors.find(d => d.id === selectedDistributor)?.distributor_name;

      toast({
        title: "Transfer Complete",
        description: `Successfully issued ${numQuantity} vouchers (${startCode} to ${endCode}) to ${distName}.`,
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

  return (
    <div className="flex flex-col min-h-screen bg-background font-sans">
      
      {/* --- CLEAN VERCEL-STYLE HEADER --- */}
      <header className="sticky top-0 z-40 w-full bg-background border-b border-border px-4 h-12 flex items-center justify-between">
        <div className="flex items-center gap-3 overflow-hidden">
          <Link href="/vouchers">
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-md">
              <ArrowLeft className="h-4 w-4 text-muted-foreground" />
            </Button>
          </Link>
          
          <Separator orientation="vertical" className="h-4" />
          
          <nav className="flex items-center gap-1.5 text-sm whitespace-nowrap overflow-hidden">
            <Link href="/vouchers" className="text-muted-foreground font-medium hover:text-foreground transition-colors">Vouchers</Link>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="font-semibold text-foreground select-none">Issue to Partner</span>
            
            <div className="ml-3 hidden md:flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-secondary border border-border">
              <div className="h-1.5 w-1.5 rounded-full bg-orange-500" />
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Transaction</span>
            </div>
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-8 px-2 text-xs font-medium text-muted-foreground" 
            onClick={fetchInitialData}
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isLoading ? 'animate-spin' : ''}`} />
            Sync Stock
          </Button>
          <Separator orientation="vertical" className="h-4 mx-1" />
          <Button variant="outline" size="sm" className="h-8 text-xs font-semibold px-3 border-border hidden sm:flex">
            <Database className="h-3.5 w-3.5 mr-1.5" /> 
            Transfer Ledger
          </Button>
        </div>
      </header>

      <main className="p-6 md:p-10 max-w-[800px] w-full mx-auto space-y-6">
        
        {/* Page Title */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Distribution Request</h1>
          <p className="text-sm text-muted-foreground mt-1">Assign specific physical voucher booklets to authorized B2B partners.</p>
        </div>

        {/* Main Form Card */}
        <Card className="shadow-none border-border bg-card">
          <CardContent className="p-6 sm:p-8">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-12 space-y-4">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                <p className="text-sm font-medium text-muted-foreground">Validating Inventory...</p>
              </div>
            ) : (
              <form onSubmit={handleDistribute} className="space-y-8">
                
                {/* 1. Distributor Selection */}
                <div className="space-y-2">
                  <Label htmlFor="distributor" className="text-sm font-medium text-foreground">Target Partner</Label>
                  <Select value={selectedDistributor} onValueChange={setSelectedDistributor} required>
                    <SelectTrigger id="distributor" className="h-10 text-sm bg-background border-border">
                      <SelectValue placeholder="Select business partner..." />
                    </SelectTrigger>
                    <SelectContent className="border-border">
                      {distributors.map(dist => (
                        <SelectItem key={dist.id} value={dist.id} className="text-sm font-medium py-2">
                          <div className="flex items-center gap-2">
                            <Store className="w-4 h-4 text-muted-foreground" />
                            {dist.distributor_name} 
                            <span className="text-[10px] text-muted-foreground bg-secondary px-1.5 py-0.5 rounded-md ml-1">
                              {dist.distributor_type}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* 2. Batch Selection */}
                <div className="space-y-2">
                  <Label htmlFor="batch" className="text-sm font-medium text-foreground">Source Batch</Label>
                  <Select value={selectedBatch} onValueChange={setSelectedBatch} required>
                    <SelectTrigger id="batch" className="h-10 text-sm bg-background border-border">
                      <SelectValue placeholder="Choose batch from stock..." />
                    </SelectTrigger>
                    <SelectContent className="border-border">
                      {batches.length === 0 && <SelectItem value="none" disabled>Insufficient inventory across all batches</SelectItem>}
                      {batches.map(batch => (
                        <SelectItem key={batch.id} value={batch.id} className="text-sm font-medium py-2">
                          <div className="flex items-center justify-between w-full min-w-[250px]">
                            <span className="flex items-center gap-2">
                              <Package className="w-4 h-4 text-muted-foreground" />
                              {batch.batch_no} <span className="text-muted-foreground font-normal">(₹{batch.discount_value})</span>
                            </span>
                            <span className="text-[11px] font-semibold text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-md ml-4">
                              {batch.available_stock} Avail.
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Separator className="bg-border my-6" />

                {/* 3. Quantity & Sequence Auto-Generation */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <ListOrdered className="h-4 w-4 text-foreground" />
                      <Label className="text-base font-semibold text-foreground">Issue Quantity</Label>
                    </div>
                    {isLoadingVouchers && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-muted-foreground">Quantity to Distribute</Label>
                      <div className="relative">
                        <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          type="number"
                          min="1"
                          max={availableVouchers.length || 1}
                          placeholder={selectedBatch ? `Max: ${availableVouchers.length}` : "Select batch first"}
                          value={quantity}
                          onChange={(e) => setQuantity(e.target.value)}
                          className="h-10 pl-9 text-sm font-bold bg-background border-border focus-visible:ring-indigo-500"
                          required
                          disabled={!selectedBatch || isLoadingVouchers}
                        />
                      </div>
                    </div>
                    
                    <div className="space-y-2 md:col-span-2">
                      <Label className="text-sm font-medium text-muted-foreground">Generated Physical Sequence</Label>
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-10 px-3 bg-secondary border border-border rounded-md flex items-center justify-center font-mono text-sm font-bold text-foreground">
                          {startCode}
                        </div>
                        <span className="text-muted-foreground font-medium text-sm">to</span>
                        <div className="flex-1 h-10 px-3 bg-secondary border border-border rounded-md flex items-center justify-center font-mono text-sm font-bold text-foreground">
                          {endCode}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Notification Area */}
                <div className="flex items-start gap-3 p-4 rounded-lg bg-indigo-50/50 border border-indigo-100">
                  <Info className="h-4 w-4 text-indigo-500 shrink-0 mt-0.5" />
                  <p className="text-sm text-indigo-700 leading-relaxed">
                    <span className="font-semibold block mb-0.5">Sequence Auto-Matched</span> 
                    The system has automatically skipped any voided or previously distributed codes in this batch. Please ensure the physical booklets you hand over exactly match the <strong>{startCode} to {endCode}</strong> range shown above.
                  </p>
                </div>

                <Button 
                  type="submit" 
                  disabled={isSubmitting || isLoading || batches.length === 0 || !isValidQuantity}
                  className="w-full h-10 font-semibold bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processing Transfer...
                    </>
                  ) : (
                    <>
                      <Send className="mr-2 h-4 w-4" />
                      Authorize Distribution of {numQuantity > 0 && isValidQuantity ? numQuantity : ""} Vouchers
                    </>
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