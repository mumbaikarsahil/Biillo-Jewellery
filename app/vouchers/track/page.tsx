"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { format, isPast } from "date-fns";
import { 
  Search, 
  Store, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  Package, 
  Printer, 
  Loader2,
  AlertCircle,
  ArrowLeft,
  ChevronRight,
  RefreshCw,
  Database,
  IndianRupee,
  CheckSquare,
  Calendar,
  Filter,
  User,
  Truck,
  ScanFace,
  FileEdit,
  ShieldAlert
} from "lucide-react";

import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/hooks/useAuth"; 
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface TrackedVoucher {
  id: string;
  code: string;
  discount_value: number;
  handling_fee: number;
  status: 'pending_print' | 'in_stock' | 'distributed' | 'registered' | 'redeemed' | 'expired' | 'voided';
  distributed_at: string | null;
  expiry_date: string | null;
  redeemed_at: string | null;
  is_manual_override: boolean; 
  updated_by_user: string | null;
  scan_count: number;
  last_scanned_at: string | null;
  voucher_batches: {
    batch_no: string;
    created_at?: string;
    received_at?: string | null;
  };
  voucher_distributors?: {
    distributor_name: string;
    distributor_type: string;
  } | null;
  voucher_distributions?: {
    payment_status: string;
    delivery_agent: string | null;
  } | null;
  invoices?: {
    invoice_number: string;
    final_total: number;
  } | null;
}

export default function TrackVoucherPage() {
  const { toast } = useToast();
  const { appUser } = useAuth(); 
  
  // --- SINGLE LOOKUP STATE ---
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [voucher, setVoucher] = useState<TrackedVoucher | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  // --- MASTER LIST STATE ---
  const [listData, setListData] = useState<TrackedVoucher[]>([]);
  const [isListLoading, setIsListLoading] = useState(false);
  const [localSearch, setLocalSearch] = useState("");

  // --- ADVANCED FILTERS STATE ---
  const [activeFilter, setActiveFilter] = useState("all");
  const [distributors, setDistributors] = useState<any[]>([]);
  const [batches, setBatches] = useState<any[]>([]);
  const [selectedFilterDistributor, setSelectedFilterDistributor] = useState("all");
  const [selectedFilterBatch, setSelectedFilterBatch] = useState("all");

  // --- BULK ACTION STATE ---
  const [selectedVouchers, setSelectedVouchers] = useState<Set<string>>(new Set());
  const [bulkHandlingFee, setBulkHandlingFee] = useState("");
  const [bulkExpiryDate, setBulkExpiryDate] = useState(""); 
  const [bulkOverrideReason, setBulkOverrideReason] = useState("");
  const [isUpdatingBulk, setIsUpdatingBulk] = useState(false);

  // Fetch filter dropdown data on mount
  useEffect(() => {
    const fetchFiltersData = async () => {
      const { data: dData } = await supabase.from("voucher_distributors").select("id, distributor_name").order("distributor_name");
      if (dData) setDistributors(dData);

      const { data: bData } = await supabase.from("voucher_batches").select("id, batch_no").order("created_at", { ascending: false });
      if (bData) setBatches(bData);
    };
    fetchFiltersData();
  }, []);

  // Trigger list fetch whenever a filter changes
  useEffect(() => {
    fetchVoucherList(activeFilter);
    setSelectedVouchers(new Set()); 
    setBulkHandlingFee("");
    setBulkExpiryDate("");
    setBulkOverrideReason("");
  }, [activeFilter, selectedFilterDistributor, selectedFilterBatch]);

  const fetchVoucherList = async (tabStatus: string) => {
    setIsListLoading(true);
    setListData([]);
    try {
      let query = supabase
        .from("vouchers")
        .select(`
          id, code, discount_value, handling_fee, status, expiry_date, distributed_at, redeemed_at,
          is_manual_override, updated_by_user, scan_count, last_scanned_at,
          voucher_batches (batch_no),
          voucher_distributors (distributor_name, distributor_type),
          voucher_distributions (payment_status, delivery_agent)
        `)
        .order('code', { ascending: true }) 
        .limit(5000); 

      const todayIso = new Date().toISOString();
      
      // 1. Apply Status Filters
      if (tabStatus === "expired") {
        query = query.in("status", ["distributed", "registered"]).lt("expiry_date", todayIso);
      } else if (tabStatus !== "all") {
        query = query.eq("status", tabStatus);
      }

      // 2. Apply Advanced Dropdown Filters
      if (selectedFilterDistributor !== "all") {
        query = query.eq("distributor_id", selectedFilterDistributor);
      }
      if (selectedFilterBatch !== "all") {
        query = query.eq("batch_id", selectedFilterBatch);
      }

      const { data, error } = await query;
      if (error) throw error;
      setListData((data as any) || []);
    } catch (error: any) {
      console.error("List fetch error:", error);
      toast({ title: "Failed to load list", description: error.message, variant: "destructive" });
    } finally {
      setIsListLoading(false);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    setHasSearched(true);
    setVoucher(null);
    try {
      // FIXED: Using correct foreign key relation 'vouchers_invoice_id_fkey' to prevent the {} crash
      const { data, error } = await supabase
        .from("vouchers")
        .select(`*, voucher_batches (batch_no, created_at, received_at), voucher_distributors (distributor_name, distributor_type), voucher_distributions (payment_status, delivery_agent), invoices!vouchers_invoice_id_fkey (invoice_number, final_total)`)
        .ilike("code", searchQuery.trim())
        .maybeSingle();

      if (error) {
        throw new Error(error.message || JSON.stringify(error));
      }
      if (!data) throw new Error("Voucher code not found in the system.");
      
      setVoucher(data as TrackedVoucher);
    } catch (error: any) {
      console.error("Search error:", error);
      toast({ title: "Search Failed", description: error.message, variant: "destructive" });
    } finally {
      setIsSearching(false);
    }
  };

  const handleBulkUpdate = async () => {
    if (selectedVouchers.size === 0) return;
    
    if (bulkHandlingFee.trim() === "" && bulkExpiryDate.trim() === "") {
      return toast({ title: "Action Required", description: "Enter a handling fee or select an expiry date to update.", variant: "destructive" });
    }

    if (bulkOverrideReason.trim() === "") {
      return toast({ title: "Reason Required", description: "You must provide a reason for overriding these vouchers.", variant: "destructive" });
    }

    setIsUpdatingBulk(true);
    try {
      const updates: any = {};
      if (bulkHandlingFee.trim() !== "") updates.handling_fee = Number(bulkHandlingFee);
      if (bulkExpiryDate.trim() !== "") updates.expiry_date = bulkExpiryDate;
      
      updates.is_manual_override = true; 
      
      // Embed the user's name and reason into the audit log
      const userIdent = appUser?.email?.split('@')[0] || 'Staff';
      updates.updated_by_user = `${userIdent}: ${bulkOverrideReason.trim()}`; 

      const idsToUpdate = Array.from(selectedVouchers);

      const { error } = await supabase
        .from("vouchers")
        .update(updates)
        .in("id", idsToUpdate);

      if (error) throw error;

      toast({ title: "Bulk Update Successful", description: `Explicitly tagged and updated ${idsToUpdate.length} vouchers.` });
      
      fetchVoucherList(activeFilter);
      setSelectedVouchers(new Set());
      setBulkHandlingFee("");
      setBulkExpiryDate("");
      setBulkOverrideReason("");
    } catch (error: any) {
      console.error("Bulk update error:", error);
      toast({ title: "Update Failed", description: error.message, variant: "destructive" });
    } finally {
      setIsUpdatingBulk(false);
    }
  };

  const toggleSelection = (id: string) => {
    const newSet = new Set(selectedVouchers);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedVouchers(newSet);
  };

  const toggleAll = () => {
    if (selectedVouchers.size === filteredListData.length && filteredListData.length > 0) setSelectedVouchers(new Set());
    else setSelectedVouchers(new Set(filteredListData.map(v => v.id)));
  };

  const getDisplayStatus = (v: { status: string; expiry_date?: string | null }) => {
    if ((v.status === 'distributed' || v.status === 'registered') && v.expiry_date && isPast(new Date(v.expiry_date))) return 'expired';
    return v.status;
  };

  const StatusBadge = ({ status }: { status: string }) => {
    switch (status) {
      case 'pending_print': return <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20 text-[10px] font-bold h-5 px-1.5 uppercase">Pending</Badge>;
      case 'in_stock': return <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/20 text-[10px] font-bold h-5 px-1.5 uppercase">In Stock</Badge>;
      case 'distributed': return <Badge variant="outline" className="bg-purple-500/10 text-purple-600 border-purple-500/20 text-[10px] font-bold h-5 px-1.5 uppercase">Issued</Badge>;
      case 'registered': return <Badge variant="outline" className="bg-teal-500/10 text-teal-600 border-teal-500/20 text-[10px] font-bold h-5 px-1.5 uppercase">Registered</Badge>;
      case 'redeemed': return <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px] font-bold h-5 px-1.5 uppercase">Redeemed</Badge>;
      case 'expired':
      case 'voided': return <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/20 text-[10px] font-bold h-5 px-1.5 uppercase">{status}</Badge>;
      default: return <Badge variant="secondary" className="text-[10px] h-5 uppercase">{status}</Badge>;
    }
  };

  // Local search filter
  const filteredListData = listData.filter(v => 
    v.code.toLowerCase().includes(localSearch.toLowerCase()) || 
    v.voucher_batches?.batch_no.toLowerCase().includes(localSearch.toLowerCase())
  );

  const canBulkUpdate = ["all", "pending_print", "in_stock", "distributed", "registered", "expired"].includes(activeFilter);

  return (
    <div className="flex flex-col min-h-screen bg-[#fafafa] pb-20">
      {/* --- COMPACT IDE-STYLE TOOLBAR HEADER --- */}
      <header className="sticky top-0 z-40 w-full bg-white/80 backdrop-blur-md border-b border-gray-200 px-4 h-12 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3 overflow-hidden">
          <Link href="/vouchers">
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-md hover:bg-gray-100 transition-colors">
              <ArrowLeft className="h-4 w-4 text-gray-500" />
            </Button>
          </Link>
          
          <div className="h-4 w-[1px] bg-gray-200 hidden sm:block" />
          
          <nav className="flex items-center gap-1.5 text-[13px] whitespace-nowrap overflow-hidden">
            <Link href="/vouchers" className="text-gray-500 hover:text-gray-900 transition-colors font-medium">Vouchers</Link>
            <ChevronRight className="h-3.5 w-3.5 text-gray-400" />
            <span className="font-bold text-gray-900 select-none">Track & Audit</span>
            
            <div className="ml-3 hidden md:flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-gray-100 border border-gray-200">
              <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-tighter">Live Database</span>
            </div>
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-8 px-2 text-xs font-medium text-gray-500 hover:text-gray-900"
            onClick={() => fetchVoucherList(activeFilter)}
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isListLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <div className="h-4 w-[1px] bg-gray-200 mx-1" />
          <Button variant="default" size="sm" className="h-8 text-xs font-bold px-3 shadow-sm bg-gray-900 hover:bg-gray-800 text-white">
            <Database className="h-3.5 w-3.5 mr-1.5" />
            Sync Data
          </Button>
        </div>
      </header>

      <main className="p-4 md:p-6 lg:p-8 max-w-[1500px] w-full mx-auto space-y-8">
        
        {/* --- 1. SINGLE VOUCHER LOOKUP SECTION --- */}
        <section className="space-y-4 animate-in fade-in zoom-in-95 duration-200">
          <div className="flex flex-col md:flex-row gap-6">
            <Card className="flex-1 shadow-sm border-gray-200/60 overflow-hidden bg-white">
              <CardHeader className="bg-gray-50/50 py-3 px-4 border-b border-gray-100">
                <h3 className="text-[11px] font-black uppercase tracking-widest text-gray-500">Global Search Lookup</h3>
              </CardHeader>
              <CardContent className="pt-6 pb-6 px-4">
                <form onSubmit={handleSearch} className="flex gap-2">
                  <div className="relative flex-1 group">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400 group-focus-within:text-indigo-500 transition-colors" />
                    <Input
                      placeholder="Scan or type voucher code..."
                      className="pl-9 h-9 text-sm font-mono bg-white border-gray-200 focus-visible:ring-1 focus-visible:ring-indigo-300 uppercase"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                  <Button type="submit" disabled={isSearching || !searchQuery.trim()} className="h-9 px-6 font-bold text-xs uppercase tracking-tight bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm">
                    {isSearching ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" /> : <Search className="h-3.5 w-3.5 mr-2" />}
                    Track
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Display Single Searched Voucher Details */}
            {voucher && (
                <Card className="w-full md:w-[600px] shadow-sm border-gray-200/60 overflow-hidden bg-white">
                <CardHeader className="bg-gray-50/50 py-3 px-4 border-b border-gray-100">
                  <div className="flex justify-between items-center">
                    <h3 className="text-[11px] font-black uppercase tracking-widest text-gray-500">Live Status</h3>
                    <StatusBadge status={getDisplayStatus(voucher)} />
                  </div>
                </CardHeader>
                <CardContent className="p-4 flex flex-col gap-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="col-span-2">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter leading-none">Voucher Code</p>
                      <p className="text-lg font-mono font-black text-gray-900 mt-1">{voucher.code}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-tighter leading-none">Discount</p>
                        <p className="text-xl font-black text-emerald-600 mt-1">₹{voucher.discount_value.toLocaleString()}</p>
                    </div>
                  </div>
                  
                  {/* METRICS ROW */}
                  <div className="grid grid-cols-3 gap-4 pt-3 border-t border-gray-100">
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter leading-none">Handling Fee</p>
                      <p className="text-sm font-bold text-gray-700 mt-1">₹{voucher.handling_fee || 0}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter leading-none flex items-center gap-1"><ScanFace className="w-3 h-3"/> Scan Attempts</p>
                      <p className="text-sm font-bold text-indigo-600 mt-1">{voucher.scan_count || 0} <span className="text-[10px] text-gray-400 font-medium">Views</span></p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter leading-none">Batch</p>
                      <p className="text-sm font-medium text-gray-700 mt-1">{voucher.voucher_batches.batch_no}</p>
                    </div>
                  </div>
                  
                  {/* Agent & Payment Sub-Block */}
                  {voucher.voucher_distributors && (
                    <>
                      <div className="pt-3 border-t border-gray-100 flex justify-between items-end">
                        <div>
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter leading-none">Issued To</p>
                          <p className="text-sm font-bold text-gray-900 mt-1">{voucher.voucher_distributors.distributor_name}</p>
                        </div>
                        {voucher.is_manual_override && (
                           <div className="text-right max-w-[200px] bg-red-50 border border-red-100 p-2 rounded-lg">
                             <p className="text-[9px] font-bold text-red-500 uppercase tracking-widest flex items-center gap-1"><ShieldAlert className="w-3 h-3"/> Override Executed</p>
                             <p className="text-[10px] font-medium text-red-800 mt-1" title={voucher.updated_by_user || 'Unknown'}>
                               {voucher.updated_by_user || 'Unknown User'}
                             </p>
                           </div>
                        )}
                      </div>
                      
                      {voucher.voucher_distributions && (
                        <div className="flex items-center justify-between pt-2">
                          <div className="flex items-center gap-1.5 text-gray-600">
                            <Truck className="w-3.5 h-3.5" />
                            <span className="text-xs font-medium">{voucher.voucher_distributions.delivery_agent || 'No Agent'}</span>
                          </div>
                          <div>
                            {voucher.voucher_distributions.payment_status === 'paid' ? (
                              <span className="text-[9px] font-black uppercase tracking-widest text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">Paid</span>
                            ) : (
                              <span className="text-[9px] font-black uppercase tracking-widest text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100">Pending Fee</span>
                            )}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          {hasSearched && !isSearching && !voucher && (
            <div className="flex items-center gap-3 p-4 bg-red-50 rounded-lg border border-red-100 animate-in fade-in slide-in-from-top-2">
              <AlertCircle className="h-5 w-5 text-red-500" />
              <p className="text-xs font-bold text-red-700">Object not found: Code "{searchQuery}" does not match any entry in the database.</p>
            </div>
          )}
        </section>

        <Separator className="bg-gray-200" />

        {/* --- 2. MASTER FILTERABLE LIST SECTION --- */}
        <section className="space-y-4 animate-in fade-in duration-300">
          <div className="flex flex-col gap-2">
            <h2 className="text-lg font-bold text-gray-900">Voucher Master Ledger</h2>
            <p className="text-xs text-gray-500">View, filter, and track campaign engagement metrics across all distributions.</p>
          </div>

          <Card className="shadow-sm border-gray-200/60 overflow-hidden bg-white">
            
            {/* --- ADVANCED UNIFIED FILTER BAR --- */}
            <div className="bg-gray-50/80 border-b border-gray-100 p-4 flex flex-col md:flex-row items-center gap-4">
              <div className="flex items-center gap-2 text-gray-500 w-full md:w-auto shrink-0">
                <Filter className="w-4 h-4 text-indigo-500" />
                <span className="text-[11px] font-black uppercase tracking-widest text-indigo-700">Filters:</span>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:flex lg:flex-row flex-wrap items-center gap-3 w-full">
                
                {/* Local Search */}
                <div className="relative w-full lg:w-[220px]">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                  <Input 
                    placeholder="Filter list by code..." 
                    className="pl-8 h-9 text-xs bg-white border-gray-200 shadow-sm font-medium"
                    value={localSearch}
                    onChange={(e) => setLocalSearch(e.target.value)}
                  />
                </div>

                <Select value={activeFilter} onValueChange={setActiveFilter}>
                  <SelectTrigger className="w-full lg:w-[150px] h-9 text-xs bg-white border-gray-200 font-semibold text-gray-700 shadow-sm">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent className="border-gray-200">
                    <SelectItem value="all" className="text-xs font-bold text-indigo-600">All Statuses</SelectItem>
                    <SelectItem value="pending_print" className="text-xs font-medium">Pending Print</SelectItem>
                    <SelectItem value="in_stock" className="text-xs font-medium">In Stock</SelectItem>
                    <SelectItem value="distributed" className="text-xs font-medium">Issued / Active</SelectItem>
                    <SelectItem value="registered" className="text-xs font-medium">Registered (App)</SelectItem>
                    <SelectItem value="redeemed" className="text-xs font-medium">Redeemed</SelectItem>
                    <SelectItem value="expired" className="text-xs font-medium">Expired</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={selectedFilterDistributor} onValueChange={setSelectedFilterDistributor}>
                  <SelectTrigger className="w-full lg:w-[180px] h-9 text-xs bg-white border-gray-200 font-semibold text-gray-700 shadow-sm">
                    <SelectValue placeholder="All Partners" />
                  </SelectTrigger>
                  <SelectContent className="border-gray-200">
                    <SelectItem value="all" className="text-xs font-bold text-indigo-600">All Partners</SelectItem>
                    {distributors.map(d => (
                      <SelectItem key={d.id} value={d.id} className="text-xs font-medium">{d.distributor_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={selectedFilterBatch} onValueChange={setSelectedFilterBatch}>
                  <SelectTrigger className="w-full lg:w-[160px] h-9 text-xs bg-white border-gray-200 font-semibold text-gray-700 shadow-sm">
                    <SelectValue placeholder="All Batches" />
                  </SelectTrigger>
                  <SelectContent className="border-gray-200">
                    <SelectItem value="all" className="text-xs font-bold text-indigo-600">All Batches</SelectItem>
                    {batches.map(b => (
                      <SelectItem key={b.id} value={b.id} className="text-xs font-medium">{b.batch_no}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {(selectedFilterDistributor !== "all" || selectedFilterBatch !== "all" || activeFilter !== "all" || localSearch) && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-9 text-xs font-bold text-red-500 hover:bg-red-50 hover:text-red-600"
                    onClick={() => { 
                      setSelectedFilterDistributor("all"); 
                      setSelectedFilterBatch("all"); 
                      setActiveFilter("all");
                      setLocalSearch("");
                    }}
                  >
                    Clear
                  </Button>
                )}
              </div>
            </div>

            {/* BULK ACTION BAR */}
            {canBulkUpdate && selectedVouchers.size > 0 && (
              <div className="bg-indigo-50/50 border-b border-indigo-100 p-4 flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4 animate-in slide-in-from-top-2">
                <div className="flex items-center gap-2 shrink-0">
                  <CheckSquare className="h-4 w-4 text-indigo-600" />
                  <span className="text-sm font-bold text-indigo-700">{selectedVouchers.size} Vouchers Selected</span>
                </div>
                <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
                  <div className="relative">
                    <IndianRupee className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                    <Input 
                      type="number"
                      placeholder="Fee..." 
                      className="pl-7 h-9 text-xs w-full sm:w-28 bg-white border-indigo-200 focus-visible:ring-indigo-500"
                      value={bulkHandlingFee}
                      onChange={(e) => setBulkHandlingFee(e.target.value)}
                    />
                  </div>
                  <div className="relative">
                    <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                    <Input 
                      type="date"
                      className="pl-7 pr-2 h-9 text-xs w-full sm:w-36 bg-white border-indigo-200 focus-visible:ring-indigo-500"
                      value={bulkExpiryDate}
                      onChange={(e) => setBulkExpiryDate(e.target.value)}
                    />
                  </div>
                  <div className="relative flex-1 sm:w-64 min-w-[200px]">
                    <FileEdit className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                    <Input 
                      type="text"
                      placeholder="Reason for override (Required)..." 
                      className="pl-8 h-9 text-xs w-full bg-white border-indigo-200 focus-visible:ring-indigo-500"
                      value={bulkOverrideReason}
                      onChange={(e) => setBulkOverrideReason(e.target.value)}
                    />
                  </div>
                  <Button 
                    size="sm" 
                    className="h-9 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white w-full sm:w-auto shadow-sm"
                    disabled={isUpdatingBulk || (!bulkHandlingFee.trim() && !bulkExpiryDate.trim()) || !bulkOverrideReason.trim()}
                    onClick={handleBulkUpdate}
                  >
                    {isUpdatingBulk ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Apply Override"}
                  </Button>
                </div>
              </div>
            )}

            <CardContent className="p-0">
              {isListLoading ? (
                <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 animate-spin text-gray-300" /></div>
              ) : filteredListData.length === 0 ? (
                <div className="text-center py-20 bg-gray-50/30">
                  <Package className="w-12 h-12 mx-auto mb-4 text-gray-200" />
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-tighter italic">Null set: No records found for this filter</p>
                </div>
              ) : (
                <div className="max-h-[600px] overflow-y-auto custom-scrollbar">
                  <Table>
                    <TableHeader className="bg-gray-50/80 sticky top-0 z-10 border-b border-gray-200 backdrop-blur-sm">
                      <TableRow className="border-none hover:bg-transparent">
                        {canBulkUpdate && (
                          <TableHead className="w-12 px-4 text-center">
                            <input 
                              type="checkbox" 
                              className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                              checked={selectedVouchers.size === filteredListData.length && filteredListData.length > 0}
                              onChange={toggleAll}
                            />
                          </TableHead>
                        )}
                        <TableHead className="text-[10px] font-black uppercase text-gray-400 tracking-widest px-4 h-10">Code Identifier</TableHead>
                        <TableHead className="text-[10px] font-black uppercase text-gray-400 tracking-widest px-4 h-10">Batch No</TableHead>
                        <TableHead className="text-[10px] font-black uppercase text-gray-400 tracking-widest px-4 h-10 text-center">Scan Attempts</TableHead>
                        <TableHead className="text-[10px] font-black uppercase text-gray-400 tracking-widest px-4 h-10">Value (INR)</TableHead>
                        <TableHead className="text-[10px] font-black uppercase text-gray-400 tracking-widest px-4 h-10 text-right">Fee & Pmt</TableHead>
                        
                        {["all", "distributed", "registered", "redeemed", "expired"].includes(activeFilter) && (
                          <TableHead className="text-[10px] font-black uppercase text-gray-400 tracking-widest px-4 h-10">Logistics (To/Agent)</TableHead>
                        )}
                        
                        {["all", "distributed", "registered", "expired"].includes(activeFilter) && (
                          <TableHead className="text-[10px] font-black uppercase text-gray-400 tracking-widest px-4 h-10 text-center">Expiration</TableHead>
                        )}
                        {["redeemed"].includes(activeFilter) && (
                          <TableHead className="text-[10px] font-black uppercase text-gray-400 tracking-widest px-4 h-10 text-center">Redeemed On</TableHead>
                        )}
                        
                        <TableHead className="text-[10px] font-black uppercase text-gray-400 tracking-widest px-4 h-10 text-center pr-6">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredListData.map((v) => (
                        <TableRow key={v.id} className={`hover:bg-gray-50/50 border-b border-gray-100 transition-colors ${selectedVouchers.has(v.id) ? 'bg-indigo-50/20' : ''}`}>
                          {canBulkUpdate && (
                            <TableCell className="px-4 text-center">
                              <input 
                                type="checkbox" 
                                className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                checked={selectedVouchers.has(v.id)}
                                onChange={() => toggleSelection(v.id)}
                              />
                            </TableCell>
                          )}
                          <TableCell className="font-mono font-bold text-xs text-gray-900 px-4 py-3">
                            {v.code}
                            {v.is_manual_override && (
                              <div className="flex items-center gap-1 mt-1 text-red-500">
                                <ShieldAlert className="w-3 h-3 shrink-0" />
                                <span className="block text-[9px] font-bold uppercase tracking-widest truncate max-w-[120px]" title={`Overridden by: ${v.updated_by_user}`}>
                                  {v.updated_by_user?.split('|')[0] || '*OVERRIDDEN'}
                                </span>
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-[11px] font-medium text-gray-500 px-4">{v.voucher_batches?.batch_no}</TableCell>
                          
                          {/* SCAN COUNTS COLUMN */}
                          <TableCell className="text-center px-4">
                            {v.scan_count > 0 ? (
                              <div className="flex flex-col items-center justify-center">
                                <Badge variant="secondary" className="bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border-indigo-200">
                                  {v.scan_count} Scans
                                </Badge>
                                <span className="text-[9px] text-gray-400 mt-1 font-medium" title="Last checked at counter">
                                  {v.last_scanned_at ? format(new Date(v.last_scanned_at), "dd MMM, HH:mm") : ''}
                                </span>
                              </div>
                            ) : (
                              <span className="text-[10px] text-gray-300 font-medium italic">Unscanned</span>
                            )}
                          </TableCell>

                          <TableCell className="font-black text-emerald-600 text-xs px-4">₹{v.discount_value.toLocaleString()}</TableCell>
                          
                          <TableCell className="px-4 text-right">
                            <div className="flex flex-col items-end">
                              <span className="font-bold text-gray-700 text-xs">₹{v.handling_fee || 0}</span>
                              {v.voucher_distributions && (
                                <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded border mt-1 ${v.voucher_distributions.payment_status === 'paid' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-amber-50 text-amber-600 border-amber-100'}`}>
                                  {v.voucher_distributions.payment_status}
                                </span>
                              )}
                            </div>
                          </TableCell>
                          
                          {["all", "distributed", "registered", "redeemed", "expired"].includes(activeFilter) && (
                            <TableCell className="px-4">
                              <div className="flex flex-col">
                                <span className="font-bold text-[11px] text-gray-700">{v.voucher_distributors?.distributor_name || <span className="text-gray-300 italic font-medium">Unassigned</span>}</span>
                                {v.voucher_distributions?.delivery_agent && (
                                  <span className="text-[9px] font-semibold text-gray-400 flex items-center gap-1 mt-0.5"><User className="w-3 h-3"/> {v.voucher_distributions.delivery_agent}</span>
                                )}
                              </div>
                            </TableCell>
                          )}

                          {["all", "distributed", "registered", "expired"].includes(activeFilter) && (
                            <TableCell className="text-center font-bold text-[10px] text-red-500 px-4">
                              {v.expiry_date ? format(new Date(v.expiry_date), "dd MMM yy") : "-"}
                            </TableCell>
                          )}
                          {["redeemed"].includes(activeFilter) && (
                            <TableCell className="text-center font-bold text-[10px] text-emerald-600 px-4">
                              {v.redeemed_at ? format(new Date(v.redeemed_at), "dd MMM yy") : "-"}
                            </TableCell>
                          )}
                          
                          <TableCell className="text-center px-4 pr-6"><StatusBadge status={getDisplayStatus(v)} /></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </section>

      </main>
    </div>
  );
}