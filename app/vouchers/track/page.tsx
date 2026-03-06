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
  ListFilter,
  ChevronRight,
  RefreshCw,
  Database
} from "lucide-react";

import { supabase } from "@/lib/supabaseClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface TrackedVoucher {
  id: string;
  code: string;
  discount_value: number;
  status: 'pending_print' | 'in_stock' | 'distributed' | 'redeemed' | 'expired' | 'voided';
  distributed_at: string | null;
  expiry_date: string | null;
  redeemed_at: string | null;
  voucher_batches: {
    batch_no: string;
    created_at?: string;
    received_at?: string | null;
  };
  voucher_distributors?: {
    distributor_name: string;
    distributor_type: string;
  } | null;
  invoices?: {
    invoice_number: string;
    final_total: number;
  } | null;
}

export default function TrackVoucherPage() {
  const { toast } = useToast();
  
  // Logic & State
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [voucher, setVoucher] = useState<TrackedVoucher | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [activeTab, setActiveTab] = useState("search");
  const [listData, setListData] = useState<TrackedVoucher[]>([]);
  const [isListLoading, setIsListLoading] = useState(false);

  useEffect(() => {
    if (activeTab === "search") return;
    fetchVoucherList(activeTab);
  }, [activeTab]);

  const fetchVoucherList = async (tabStatus: string) => {
    setIsListLoading(true);
    setListData([]);
    try {
      let query = supabase
        .from("vouchers")
        .select(`id, code, discount_value, status, expiry_date, distributed_at, voucher_batches (batch_no)`)
        .limit(100);
      const todayIso = new Date().toISOString();
      if (tabStatus === "expired") {
        query = query.eq("status", "distributed").lt("expiry_date", todayIso);
      } else if (tabStatus === "distributed") {
        query = query.eq("status", "distributed").gte("expiry_date", todayIso);
      } else {
        query = query.eq("status", tabStatus);
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
      const { data, error } = await supabase
        .from("vouchers")
        .select(`*, voucher_batches (batch_no, created_at, received_at), voucher_distributors (distributor_name, distributor_type), invoices!vouchers_redeemed_invoice_id_fkey (invoice_number, final_total)`)
        .eq("code", searchQuery.trim().toUpperCase())
        .single();
      if (error) {
        if (error.code === 'PGRST116') throw new Error("Voucher code not found in the system.");
        throw error;
      }
      setVoucher(data as TrackedVoucher);
    } catch (error: any) {
      console.error("Search error:", error);
      toast({ title: "Search Failed", description: error.message, variant: "destructive" });
    } finally {
      setIsSearching(false);
    }
  };

  const getDisplayStatus = (v: { status: string; expiry_date?: string | null }) => {
    if (v.status === 'distributed' && v.expiry_date && isPast(new Date(v.expiry_date))) return 'expired';
    return v.status;
  };

  const StatusBadge = ({ status }: { status: string }) => {
    switch (status) {
      case 'pending_print': return <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20 text-[10px] font-bold h-5 px-1.5 uppercase">Pending</Badge>;
      case 'in_stock': return <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/20 text-[10px] font-bold h-5 px-1.5 uppercase">In Stock</Badge>;
      case 'distributed': return <Badge variant="outline" className="bg-purple-500/10 text-purple-600 border-purple-500/20 text-[10px] font-bold h-5 px-1.5 uppercase">Distributed</Badge>;
      case 'redeemed': return <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px] font-bold h-5 px-1.5 uppercase">Redeemed</Badge>;
      case 'expired':
      case 'voided': return <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/20 text-[10px] font-bold h-5 px-1.5 uppercase">{status}</Badge>;
      default: return <Badge variant="secondary" className="text-[10px] h-5 uppercase">{status}</Badge>;
    }
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
          
          <div className="h-4 w-[1px] bg-gray-200 hidden sm:block" />
          
          {/* Breadcrumbs */}
          <nav className="flex items-center gap-1.5 text-[13px] whitespace-nowrap overflow-hidden">
            <Link href="/vouchers" className="text-gray-500 hover:text-gray-900 transition-colors font-medium">Vouchers</Link>
            <ChevronRight className="h-3.5 w-3.5 text-gray-400" />
            <span className="font-bold text-gray-900 select-none">Track & Audit</span>
            
            <div className="ml-3 hidden md:flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-gray-100 border border-gray-200">
              <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-tighter">Live</span>
            </div>
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-8 px-2 text-xs font-medium text-gray-500 hover:text-gray-900"
            onClick={() => window.location.reload()}
          >
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            Refresh
          </Button>
          <div className="h-4 w-[1px] bg-gray-200 mx-1" />
          <Button variant="default" size="sm" className="h-8 text-xs font-bold px-3 shadow-sm">
            <Database className="h-3.5 w-3.5 mr-1.5" />
            Sync Data
          </Button>
        </div>
      </header>

      <main className="p-4 md:p-6 lg:p-8 max-w-[1400px] w-full mx-auto space-y-6">
        <Tabs defaultValue="search" value={activeTab} onValueChange={setActiveTab} className="w-full">
          {/* Compact Navigation Tabs */}
          <TabsList className="inline-flex h-9 items-center justify-start rounded-lg bg-gray-200/50 p-1 text-gray-500 border border-gray-200">
            <TabsTrigger value="search" className="rounded-md px-3 py-1 text-xs font-bold data-[state=active]:bg-white data-[state=active]:text-gray-900 data-[state=active]:shadow-sm">
              <Search className="h-3.5 w-3.5 mr-1.5" /> Lookup
            </TabsTrigger>
            <TabsTrigger value="pending_print" className="rounded-md px-3 py-1 text-xs font-bold data-[state=active]:bg-white data-[state=active]:text-gray-900 data-[state=active]:shadow-sm">
              <Printer className="h-3.5 w-3.5 mr-1.5" /> Pending
            </TabsTrigger>
            <TabsTrigger value="in_stock" className="rounded-md px-3 py-1 text-xs font-bold data-[state=active]:bg-white data-[state=active]:text-gray-900 data-[state=active]:shadow-sm">
              <Package className="h-3.5 w-3.5 mr-1.5" /> In Stock
            </TabsTrigger>
            <TabsTrigger value="distributed" className="rounded-md px-3 py-1 text-xs font-bold data-[state=active]:bg-white data-[state=active]:text-gray-900 data-[state=active]:shadow-sm">
              <Store className="h-3.5 w-3.5 mr-1.5" /> Issued
            </TabsTrigger>
            <TabsTrigger value="expired" className="rounded-md px-3 py-1 text-xs font-bold data-[state=active]:bg-white data-[state=active]:text-gray-900 data-[state=active]:shadow-sm">
              <XCircle className="h-3.5 w-3.5 mr-1.5" /> Expired
            </TabsTrigger>
          </TabsList>

          {/* --- SEARCH TAB CONTENT --- */}
          <TabsContent value="search" className="mt-6 space-y-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex flex-col md:flex-row gap-6">
              {/* Search Control Card */}
              <Card className="flex-1 shadow-sm border-gray-200/60 overflow-hidden">
                <CardHeader className="bg-gray-50 py-3 px-4 border-b border-gray-200">
                  <h3 className="text-[11px] font-black uppercase tracking-widest text-gray-500">Global Search</h3>
                </CardHeader>
                <CardContent className="pt-6 pb-6 px-4">
                  <form onSubmit={handleSearch} className="flex gap-2">
                    <div className="relative flex-1 group">
                      <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400 group-focus-within:text-primary transition-colors" />
                      <Input
                        placeholder="Scan or type voucher code..."
                        className="pl-9 h-9 text-sm font-mono bg-white border-gray-200 focus-visible:ring-1 focus-visible:ring-gray-300 uppercase"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                      />
                    </div>
                    <Button type="submit" disabled={isSearching || !searchQuery.trim()} className="h-9 px-6 font-bold text-xs uppercase tracking-tight">
                      {isSearching ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" /> : <Search className="h-3.5 w-3.5 mr-2" />}
                      Track
                    </Button>
                  </form>
                </CardContent>
              </Card>

              {voucher && (
                 <Card className="w-full md:w-[400px] shadow-sm border-gray-200/60 overflow-hidden">
                  <CardHeader className="bg-gray-50 py-3 px-4 border-b border-gray-200">
                    <div className="flex justify-between items-center">
                      <h3 className="text-[11px] font-black uppercase tracking-widest text-gray-500">Live Status</h3>
                      <StatusBadge status={getDisplayStatus(voucher)} />
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter leading-none">Voucher Code</p>
                      <p className="text-lg font-mono font-bold text-gray-900 mt-1">{voucher.code}</p>
                    </div>
                    <div className="text-right">
                       <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-tighter leading-none">Discount</p>
                       <p className="text-xl font-black text-emerald-600 mt-1">₹{voucher.discount_value}</p>
                    </div>
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

            {voucher && (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 animate-in slide-in-from-bottom-2 duration-300">
                {/* Details Column */}
                <Card className="lg:col-span-2 shadow-sm border-gray-200/60">
                  <CardHeader className="bg-gray-50/50 py-3 px-4 border-b">
                    <CardTitle className="text-xs font-bold text-gray-500 uppercase tracking-tight">System Metadata</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="grid grid-cols-2 border-b">
                       <div className="p-4 border-r bg-white">
                          <label className="text-[10px] font-bold text-gray-400 uppercase">Batch Identification</label>
                          <p className="font-semibold text-sm text-gray-800 mt-1">{voucher.voucher_batches.batch_no}</p>
                       </div>
                       <div className="p-4 bg-white">
                          <label className="text-[10px] font-bold text-gray-400 uppercase">Current Status</label>
                          <div className="mt-1 flex items-center gap-2">
                            <div className={`h-2 w-2 rounded-full ${voucher.status === 'redeemed' ? 'bg-emerald-500' : 'bg-blue-500'}`} />
                            <p className="font-bold text-sm text-gray-800 capitalize">{voucher.status.replace('_', ' ')}</p>
                          </div>
                       </div>
                    </div>
                    
                    <div className="p-4 bg-white border-b">
                       <label className="text-[10px] font-bold text-gray-400 uppercase">Validity Schedule</label>
                       <div className="flex items-center gap-4 mt-2">
                          <div className="flex-1 p-3 rounded-md border border-gray-100 bg-gray-50/30">
                             <p className="text-[10px] font-bold text-gray-400 uppercase">Issue Date</p>
                             <p className="text-sm font-semibold">{voucher.distributed_at ? format(new Date(voucher.distributed_at), "dd MMM yyyy") : "N/A"}</p>
                          </div>
                          <div className="flex-1 p-3 rounded-md border border-red-100 bg-red-50/20">
                             <p className="text-[10px] font-bold text-red-400 uppercase">Expiry Denied After</p>
                             <p className="text-sm font-semibold text-red-700">{voucher.expiry_date ? format(new Date(voucher.expiry_date), "dd MMM yyyy") : "N/A"}</p>
                          </div>
                       </div>
                    </div>

                    {voucher.voucher_distributors && (
                       <div className="p-4 flex items-center gap-4 bg-white">
                          <div className="h-10 w-10 rounded-md bg-primary/5 border border-primary/10 flex items-center justify-center">
                             <Store className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                             <p className="text-[10px] font-bold text-gray-400 uppercase leading-none">Associated Partner</p>
                             <p className="font-black text-gray-900 mt-1">{voucher.voucher_distributors.distributor_name}</p>
                             <p className="text-[11px] text-gray-500 mt-0.5 capitalize">{voucher.voucher_distributors.distributor_type.replace('_', ' ')}</p>
                          </div>
                       </div>
                    )}
                  </CardContent>
                </Card>

                {/* Audit Timeline Column */}
                <Card className="shadow-sm border-gray-200/60">
                  <CardHeader className="bg-gray-50 py-3 px-4 border-b border-gray-200">
                    <CardTitle className="text-xs font-bold text-gray-500 uppercase tracking-tight flex items-center gap-2">
                      <Clock className="h-3.5 w-3.5" /> Event Logs
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-6">
                    <div className="space-y-6 relative before:absolute before:inset-0 before:ml-[11.5px] before:w-0.5 before:bg-gray-100">
                      
                      <div className="relative pl-8">
                        <div className="absolute left-0 top-1 h-6 w-6 rounded-full bg-white border-2 border-gray-200 flex items-center justify-center z-10">
                          <div className="h-1.5 w-1.5 rounded-full bg-gray-400" />
                        </div>
                        <p className="text-xs font-bold text-gray-800">Batch Initialized</p>
                        <time className="text-[10px] font-medium text-gray-500 mt-0.5 block italic">{voucher.voucher_batches.created_at ? format(new Date(voucher.voucher_batches.created_at), "dd/MM/yy HH:mm") : "---"}</time>
                      </div>

                      {voucher.voucher_batches.received_at && (
                        <div className="relative pl-8">
                          <div className="absolute left-0 top-1 h-6 w-6 rounded-full bg-blue-50 border-2 border-blue-200 flex items-center justify-center z-10">
                            <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                          </div>
                          <p className="text-xs font-bold text-gray-800">Asset Ingested</p>
                          <time className="text-[10px] font-medium text-gray-500 mt-0.5 block italic">{format(new Date(voucher.voucher_batches.received_at), "dd/MM/yy HH:mm")}</time>
                        </div>
                      )}

                      {voucher.distributed_at && (
                        <div className="relative pl-8">
                          <div className="absolute left-0 top-1 h-6 w-6 rounded-full bg-purple-50 border-2 border-purple-200 flex items-center justify-center z-10">
                            <div className="h-1.5 w-1.5 rounded-full bg-purple-500" />
                          </div>
                          <p className="text-xs font-bold text-gray-800">Partner Transfer</p>
                          <time className="text-[10px] font-medium text-gray-500 mt-0.5 block italic">{format(new Date(voucher.distributed_at), "dd/MM/yy HH:mm")}</time>
                        </div>
                      )}

                      {voucher.status === 'redeemed' && (
                        <div className="relative pl-8">
                          <div className="absolute left-0 top-1 h-6 w-6 rounded-full bg-emerald-50 border-2 border-emerald-200 flex items-center justify-center z-10">
                            <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          </div>
                          <p className="text-xs font-bold text-emerald-700">Redemption Confirmed</p>
                          <p className="text-[10px] text-emerald-600/80 font-medium">Inv: {voucher.invoices?.invoice_number}</p>
                          <time className="text-[10px] font-medium text-gray-500 mt-0.5 block italic">{voucher.redeemed_at ? format(new Date(voucher.redeemed_at), "dd/MM/yy HH:mm") : ""}</time>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

          {/* --- CATEGORIZED LIST TABS --- */}
          {["pending_print", "in_stock", "distributed", "expired"].map((tab) => (
            <TabsContent key={tab} value={tab} className="animate-in fade-in duration-300">
              <Card className="shadow-sm border-gray-200/60 overflow-hidden">
                <CardHeader className="bg-gray-50 border-b py-3 px-4 flex flex-row items-center justify-between">
                  <div>
                    <h3 className="text-xs font-black uppercase tracking-widest text-gray-500">{tab.replace('_', ' ')} Registry</h3>
                    <p className="text-[10px] text-gray-400 font-bold mt-0.5 uppercase tracking-tighter">Query Results: {listData.length} records found</p>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  {isListLoading ? (
                    <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 animate-spin text-gray-200" /></div>
                  ) : listData.length === 0 ? (
                    <div className="text-center py-20 bg-gray-50/30">
                       <Package className="w-12 h-12 mx-auto mb-4 text-gray-200" />
                       <p className="text-xs font-bold text-gray-400 uppercase tracking-tighter italic">Null set: No records found for this category</p>
                    </div>
                  ) : (
                    <div className="max-h-[600px] overflow-y-auto">
                      <Table>
                        <TableHeader className="bg-gray-50 sticky top-0 z-10 border-b">
                          <TableRow>
                            <TableHead className="text-[10px] font-black uppercase text-gray-400 px-4 h-10">Identifier</TableHead>
                            <TableHead className="text-[10px] font-black uppercase text-gray-400 px-4 h-10">Batch No</TableHead>
                            <TableHead className="text-[10px] font-black uppercase text-gray-400 px-4 h-10 text-right">Value (INR)</TableHead>
                            {tab === 'distributed' && <TableHead className="text-[10px] font-black uppercase text-gray-400 px-4 h-10">Dispatched</TableHead>}
                            {(tab === 'distributed' || tab === 'expired') && <TableHead className="text-[10px] font-black uppercase text-gray-400 px-4 h-10 text-center">Expiration</TableHead>}
                            <TableHead className="text-[10px] font-black uppercase text-gray-400 px-4 h-10 text-center">Lifecycle</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {listData.map((v) => (
                            <TableRow key={v.id} className="hover:bg-gray-50 border-b transition-colors">
                              <TableCell className="font-mono font-bold text-xs text-gray-900 px-4 py-3">{v.code}</TableCell>
                              <TableCell className="text-[11px] font-medium text-gray-500 px-4">{v.voucher_batches?.batch_no}</TableCell>
                              <TableCell className="text-right font-black text-gray-900 text-xs px-4">₹{v.discount_value.toLocaleString()}</TableCell>
                              {tab === 'distributed' && <TableCell className="text-gray-500 text-[10px] font-bold px-4">{v.distributed_at ? format(new Date(v.distributed_at), "dd/MM/yy") : "-"}</TableCell>}
                              {(tab === 'distributed' || tab === 'expired') && <TableCell className="text-center font-bold text-[10px] text-red-500 px-4">{v.expiry_date ? format(new Date(v.expiry_date), "dd/MM/yy") : "-"}</TableCell>}
                              <TableCell className="text-center px-4"><StatusBadge status={getDisplayStatus(v)} /></TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>
      </main>
    </div>
  );
}