"use client";

import { useEffect, useState } from "react";
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
  ListOrdered
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

export default function DistributePage() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [distributors, setDistributors] = useState<Distributor[]>([]);
  const [batches, setBatches] = useState<BatchStats[]>([]);

  const [selectedDistributor, setSelectedDistributor] = useState<string>("");
  const [selectedBatch, setSelectedBatch] = useState<string>("");
  
  // Range Mode State
  const [startCode, setStartCode] = useState<string>("");
  const [endCode, setEndCode] = useState<string>("");

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
    
    if (!selectedDistributor || !selectedBatch) {
      toast({ title: "Validation Required", description: "Select a Partner and a Batch.", variant: "destructive" });
      return;
    }

    if (!startCode.trim() || !endCode.trim()) {
      toast({ title: "Validation Required", description: "Please enter both Start and End codes.", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      const { data: vouchersToUpdate, error: fetchError } = await supabase
        .from("vouchers")
        .select("id, code")
        .eq("batch_id", selectedBatch)
        .eq("status", "in_stock")
        .gte("code", startCode.trim().toUpperCase())
        .lte("code", endCode.trim().toUpperCase());

      if (fetchError) throw fetchError;
      
      if (!vouchersToUpdate || vouchersToUpdate.length === 0) {
        throw new Error("No available vouchers found in this sequence range. They might be invalid or already distributed.");
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
        description: `Successfully issued ${vouchersToUpdate.length} vouchers to ${distName}.`,
      });

      setStartCode("");
      setEndCode("");
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

                {/* 3. Sequence Range Selection */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-2">
                    <ListOrdered className="h-4 w-4 text-foreground" />
                    <Label className="text-base font-semibold text-foreground">Physical Code Sequence Range</Label>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-foreground">Start Code</Label>
                      <Input
                        type="text"
                        placeholder="e.g. A0001"
                        value={startCode}
                        onChange={(e) => setStartCode(e.target.value)}
                        className="h-10 text-sm font-mono uppercase bg-background border-border"
                        required
                        disabled={!selectedBatch}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-foreground">End Code</Label>
                      <Input
                        type="text"
                        placeholder="e.g. A0025"
                        value={endCode}
                        onChange={(e) => setEndCode(e.target.value)}
                        className="h-10 text-sm font-mono uppercase bg-background border-border"
                        required
                        disabled={!selectedBatch}
                      />
                    </div>
                  </div>
                </div>

                {/* Notification Area */}
                <div className="flex items-start gap-3 p-4 rounded-lg bg-secondary/50 border border-border">
                  <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    <span className="text-foreground font-semibold">Sequence Matching Notice:</span> This will transfer the exact physical sequence. Ensure the physical booklets you are handing over perfectly match the Start and End codes typed above.
                  </p>
                </div>

                <Button 
                  type="submit" 
                  disabled={isSubmitting || isLoading || batches.length === 0}
                  className="w-full h-10 font-semibold"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processing Transfer...
                    </>
                  ) : (
                    <>
                      <Send className="mr-2 h-4 w-4" />
                      Authorize Distribution
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