"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { 
  Plus, Search, ChevronRight, ArrowLeft, LayoutDashboard, 
  RefreshCw, Database, Loader2, Briefcase, User, CheckCircle2,
  Package, Filter, Wand2, CalendarDays, Bell, Wrench,
  Check, Banknote, HardHat, Scale, History
} from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
  SheetDescription, SheetTrigger, SheetFooter
} from "@/components/ui/sheet";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import { Label } from "@/components/ui/label";

// Standard Jewelry Dictionaries
const STANDARD_CATEGORIES = ['Ring', 'Necklace', 'Earring', 'Bracelet', 'Bangle', 'Chain', 'Pendant', 'Mangalsutra', 'Nose Pin', 'Set'];
const STANDARD_DESIGNS = ['CUSTOM-01', 'Casting-Std', 'Handmade-Classic', 'Kundan-Work', 'Temple-Jewelry', 'Polki-Set', 'CNC-Design'];

export default function JobBagPage() {
  const { appUser } = useAuth();
  const router = useRouter();

  const [jobBags, setJobBags] = useState<any[]>([]);
  const [karigars, setKarigars] = useState<any[]>([]);
  
  // Pending Routing States
  const [pendingOrders, setPendingOrders] = useState<any[]>([]);
  const [pendingRepairs, setPendingRepairs] = useState<any[]>([]);
  const [pendingRestocks, setPendingRestocks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Sheet/Modal states
  const [isCreating, setIsCreating] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  
  const [isOrdersModalOpen, setIsOrdersModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  
  const [isRepairsModalOpen, setIsRepairsModalOpen] = useState(false);
  const [selectedRepair, setSelectedRepair] = useState<any>(null);

  const [isRestocksModalOpen, setIsRestocksModalOpen] = useState(false);
  const [selectedRestock, setSelectedRestock] = useState<any>(null);

  const [routingBagId, setRoutingBagId] = useState<string>('new');
  const [isRouting, setIsRouting] = useState(false);

  // Filters & Sorting State
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [karigarFilter, setKarigarFilter] = useState("all");
  const [dateSort, setDateSort] = useState("desc");

  const [showCustomCategory, setShowCustomCategory] = useState(false);
  const [showCustomDesign, setShowCustomDesign] = useState(false);

  const [form, setForm] = useState({
    job_bag_number: "", product_category: "", design_code: "",
    gold_expected_weight_g: "", diamond_expected_weight_cts: "", karigar_id: "",
    issue_date: new Date().toISOString().split('T')[0], expected_return_date: ""
  });

  const fetchData = useCallback(async () => {
    if (!appUser) return;
    setLoading(true);
    try {
      // 🚀 FIXED: Added inventory_items(net_weight_g) to fetch the actual finished net weight
      const [jbRes, kRes, ordRes, repRes, restockRes] = await Promise.all([
        supabase.from("job_bags").select("*, karigars(full_name), inventory_items(net_weight_g)").eq("company_id", appUser.company_id),
        supabase.from("karigars").select("*").eq("company_id", appUser.company_id).eq("is_active", true),
        supabase.from("custom_orders").select("*, origin:origin_warehouse_id(name)").eq("company_id", appUser.company_id).eq("status", "pending_manufacturing"),
        supabase.from("repair_tickets").select("*, origin:warehouses!repair_tickets_origin_warehouse_id_fkey(name)").eq("company_id", appUser.company_id).eq("status", "received_at_ho"),
        supabase.from("branch_restock_requests").select("*, warehouses(name)").eq("company_id", appUser.company_id).eq("status", "pending_ho")
      ]);

      if (jbRes.error) throw jbRes.error;
      setJobBags(jbRes.data || []);

      if (kRes.error) throw kRes.error;
      setKarigars(kRes.data || []);

      setPendingOrders(ordRes.data || []);
      setPendingRepairs(repRes.data || []);
      setPendingRestocks(restockRes.data || []);

    } catch (err: any) {
      toast.error(`Error loading workshop data: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [appUser]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // 🚀 CORE ENGINE: Calculates payout strictly on ACTUAL generated inventory net weight
  const enrichedJobBags = useMemo(() => {
    return jobBags.map(bag => {
      const karigar = karigars.find(k => k.id === bag.karigar_id);
      const rate = Number(karigar?.default_labor_rate) || 350;
      const laborType = karigar?.labor_type || 'per_gram';
      
      // Calculate actual generated net weight from linked inventory items
      const actualNetWeight = bag.inventory_items?.reduce((sum: number, item: any) => sum + (Number(item.net_weight_g) || 0), 0) || 0;
      
      // Use actual net weight if items exist, otherwise fallback to expected weight for forecasting
      const isFinalWeight = actualNetWeight > 0;
      const weightUsed = isFinalWeight ? actualNetWeight : (Number(bag.gold_expected_weight_g) || 0);

      let payout = 0;
      if (laborType === 'per_piece' || laborType === 'fixed') {
         payout = rate; 
      } else {
         payout = weightUsed * rate; 
      }

      return {
        ...bag,
        payout,
        isFinalWeight, // Flag to show if payout is estimated or finalized
        rate_display: `₹${rate}/${laborType === 'per_piece' || laborType === 'fixed' ? 'pc' : 'g'}`,
        weight_used: weightUsed,
        labor_type: laborType
      };
    });
  }, [jobBags, karigars]);

  // 🚀 KARIGAR LEDGER CALCULATIONS
  const karigarLedgers = useMemo(() => {
    return karigars.map(karigar => {
      const rate = Number(karigar.default_labor_rate) || 350; 
      const laborType = karigar.labor_type || 'per_gram';
      
      const kBags = enrichedJobBags.filter(jb => jb.karigar_id === karigar.id && jb.status !== 'closed');
      const pendingBags = kBags.filter(jb => ['open', 'in_progress'].includes(jb.status));
      const readyBags = kBags.filter(jb => jb.status === 'completed');

      // Weights are now based on actual Net Weight calculation above
      const pendingWeight = pendingBags.reduce((sum, jb) => sum + jb.weight_used, 0);
      const readyWeight = readyBags.reduce((sum, jb) => sum + jb.weight_used, 0);
      const totalWeight = pendingWeight + readyWeight;
      
      const estimatedPay = kBags.reduce((sum, jb) => sum + jb.payout, 0);

      return {
        ...karigar,
        rate,
        laborType,
        activeJobs: kBags.length,
        pendingWeight,
        readyWeight,
        totalWeight,
        estimatedPay
      };
    }).filter(k => k.activeJobs > 0);
  }, [enrichedJobBags, karigars]);

  const totalPendingGrams = karigarLedgers.reduce((sum, k) => sum + k.pendingWeight, 0);
  const totalReadyGrams = karigarLedgers.reduce((sum, k) => sum + k.readyWeight, 0);
  const totalPendingPayout = karigarLedgers.reduce((sum, k) => sum + k.estimatedPay, 0);

  const generateJobRef = () => {
    const randomCode = Math.floor(10000 + Math.random() * 90000);
    setForm(prev => ({ ...prev, job_bag_number: `JB-${randomCode}` }));
  };

  const handleOpenSheet = (open: boolean) => {
    setIsOpen(open);
    if (open && !form.job_bag_number) generateJobRef();
  };

  async function handleCreate() {
    if (!appUser) return;
    if (!form.job_bag_number || !form.karigar_id || !form.product_category) {
      return toast.error("Please fill in the Job Ref, Category, and Karigar.");
    }

    setIsCreating(true);
    try {
      const { data, error } = await supabase.rpc("create_job_bag", {
        p_company_id: appUser.company_id,
        p_job_bag_number: form.job_bag_number,
        p_product_category: form.product_category,
        p_design_code: form.design_code || 'N/A',
        p_gold_expected_weight_g: Number(form.gold_expected_weight_g) || 0,
        p_diamond_expected_weight_cts: Number(form.diamond_expected_weight_cts) || 0,
        p_karigar_id: form.karigar_id,
        p_issue_date: form.issue_date,
        p_expected_return_date: form.expected_return_date || null,
        p_created_by: appUser.user_id
      });

      if (error) throw error;
      toast.success("Job Bag Created Successfully");
      router.push(`/manufacturing/job-bags/${data}`);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsCreating(false);
    }
  }

  const handleRouteItem = async (type: 'order' | 'repair' | 'restock') => {
    const item = type === 'order' ? selectedOrder : type === 'repair' ? selectedRepair : selectedRestock;
    if (!item) return;

    setIsRouting(true);
    try {
      let targetBagId = routingBagId;
      
      if (targetBagId === 'new') {
        let newBagNumber = '';
        let category = '';
        let designCode = '';
        let goldExpected = 0;

        if (type === 'order') {
          newBagNumber = `JB-CUST-${Date.now().toString().slice(-6)}`;
          category = item.item_category;
          designCode = item.design_reference;
          goldExpected = item.expected_gold_g;
        } else if (type === 'repair') {
          newBagNumber = `JB-REP-${Date.now().toString().slice(-6)}`;
          category = 'Repair Job';
          designCode = item.ticket_number;
          goldExpected = 0;
        } else if (type === 'restock') {
          newBagNumber = `JB-STK-${Date.now().toString().slice(-6)}`;
          category = 'Branch Restock';
          designCode = item.sku_reference;
          goldExpected = 0;
        }

        const { data: newBag, error } = await supabase
          .from('job_bags')
          .insert({
            company_id: appUser?.company_id,
            job_bag_number: newBagNumber,
            product_category: category,
            design_code: designCode,
            gold_expected_weight_g: goldExpected,
            status: 'open'
          })
          .select().single();
          
        if (error) throw error;
        targetBagId = newBag.id;
      }

      if (type === 'order') {
        setIsOrdersModalOpen(false);
        router.push(`/manufacturing/job-bags/${targetBagId}?custom_order=${item.id}`);
      } else if (type === 'repair') {
        setIsRepairsModalOpen(false);
        router.push(`/manufacturing/job-bags/${targetBagId}?repair_ticket=${item.id}`);
      } else if (type === 'restock') {
        setIsRestocksModalOpen(false);
        router.push(`/manufacturing/job-bags/${targetBagId}?store_restock=${item.id}`);
      }
      
    } catch (err: any) {
      toast.error("Routing Error: " + err.message);
    } finally {
      setIsRouting(false);
    }
  }

  // 🚀 GLOBAL FILTERING 
  const baseFiltered = enrichedJobBags
    .filter((j) => {
      const matchSearch = j.job_bag_number.toLowerCase().includes(search.toLowerCase()) || 
                          (j.design_code && j.design_code.toLowerCase().includes(search.toLowerCase()));
      const matchStatus = statusFilter === "all" ? true : j.status === statusFilter;
      const matchKarigar = karigarFilter === "all" ? true : j.karigar_id === karigarFilter;
      return matchSearch && matchStatus && matchKarigar;
    })
    .sort((a, b) => {
      const dateA = new Date(a.created_at).getTime();
      const dateB = new Date(b.created_at).getTime();
      return dateSort === "desc" ? dateB - dateA : dateA - dateB;
    });

  const activeBags = baseFiltered.filter(j => ['open', 'in_progress'].includes(j.status));
  const historyBags = baseFiltered.filter(j => ['completed', 'closed'].includes(j.status));

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "open": return <Badge variant="outline" className="bg-blue-50 text-blue-600 border-blue-200/50 text-[10px] font-bold px-2 py-0.5 uppercase tracking-widest rounded-lg">Awaiting Issue</Badge>;
      case "in_progress": return <Badge variant="outline" className="bg-amber-50 text-amber-600 border-amber-200/50 text-[10px] font-bold px-2 py-0.5 uppercase tracking-widest rounded-lg">In Fabrication</Badge>;
      case "completed": return <Badge variant="outline" className="bg-emerald-50 text-emerald-600 border-emerald-200/50 text-[10px] font-bold px-2 py-0.5 uppercase tracking-widest rounded-lg">Completed</Badge>;
      case "closed": return <Badge variant="outline" className="bg-gray-100 text-gray-500 border-gray-200 text-[10px] font-bold px-2 py-0.5 uppercase tracking-widest rounded-lg">Archived</Badge>;
      default: return <Badge variant="secondary" className="bg-gray-50 text-gray-600 border-gray-200/60 text-[10px] font-bold px-2 py-0.5 uppercase tracking-widest rounded-lg">{status}</Badge>;
    }
  };

  const ListSkeleton = () => (
    <div className="space-y-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-16 w-full rounded-2xl bg-white border border-gray-100" />
      ))}
    </div>
  );

  const renderJobBagTable = (bags: any[], isHistory = false) => {
    if (loading) return <ListSkeleton />;
    if (bags.length === 0) return (
      <div className="text-center py-20 bg-white border border-gray-200/60 rounded-2xl shadow-sm">
         <Package className="w-12 h-12 mx-auto mb-4 text-gray-300" strokeWidth={1.5} />
         <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
           {isHistory ? "No historical records found" : "No active jobs in registry"}
         </p>
      </div>
    );

    return (
      <>
        {/* DESKTOP VIEW */}
        <div className="hidden md:block overflow-hidden border border-gray-200/60 rounded-2xl bg-white shadow-sm">
          <Table>
            <TableHeader className="bg-gray-50/80">
              <TableRow className="hover:bg-transparent border-gray-200/60">
                <TableHead className="text-[11px] font-bold uppercase text-gray-500 tracking-widest px-6 h-12">Job Ref</TableHead>
                <TableHead className="text-[11px] font-bold uppercase text-gray-500 tracking-widest px-4 h-12">Specs & Category</TableHead>
                <TableHead className="text-[11px] font-bold uppercase text-gray-500 tracking-widest px-4 h-12">Artisan</TableHead>
                <TableHead className="text-[11px] font-bold uppercase text-gray-500 tracking-widest px-4 h-12">Net Weight</TableHead>
                <TableHead className="text-[11px] font-bold uppercase text-gray-500 tracking-widest px-4 h-12 text-center">Status</TableHead>
                <TableHead className="text-[11px] font-black uppercase text-blue-700 tracking-widest px-4 h-12 text-right">Payout</TableHead>
                <TableHead className="w-[60px] h-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bags.map((job) => (
                <TableRow 
                  key={job.id} 
                  className="hover:bg-gray-50/50 transition-colors border-b border-gray-100 last:border-0 cursor-pointer group"
                  onClick={() => router.push(`/manufacturing/job-bags/${job.id}`)}
                >
                  <TableCell className="px-6 py-4 font-mono font-bold text-sm text-gray-900 tracking-tight group-hover:text-blue-600 transition-colors">
                     {job.job_bag_number}
                  </TableCell>
                  <TableCell className="px-4">
                     <div className="text-[13px] font-bold text-gray-900">{job.product_category}</div>
                     <div className="text-[10px] text-gray-500 font-medium uppercase tracking-widest mt-0.5">SKU: {job.design_code}</div>
                  </TableCell>
                  <TableCell className="px-4">
                     <div className="flex items-center gap-2.5">
                       <div className="h-7 w-7 rounded-full bg-gray-100 flex items-center justify-center text-gray-500"><User className="h-3.5 w-3.5" strokeWidth={1.5} /></div>
                       <span className="text-[13px] font-semibold text-gray-700">{job.karigars?.full_name}</span>
                     </div>
                  </TableCell>
                  <TableCell className="px-4">
                     <div className={`font-mono text-[13px] font-bold ${job.isFinalWeight ? 'text-emerald-600' : 'text-amber-600'}`}>
                       {job.weight_used.toFixed(3)}g
                     </div>
                     <div className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">
                       {job.isFinalWeight ? 'Actual Net' : 'Expected'}
                     </div>
                  </TableCell>
                  <TableCell className="px-4 text-center">
                     {getStatusBadge(job.status)}
                  </TableCell>
                  <TableCell className="px-4 text-right">
                     <div className={`text-[14px] font-black ${job.isFinalWeight ? 'text-emerald-600' : 'text-blue-700'}`}>
                       ₹ {job.payout.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                     </div>
                     <div className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">
                       {job.rate_display}
                     </div>
                  </TableCell>
                  <TableCell className="px-4 text-right">
                     <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-gray-400 group-hover:bg-white group-hover:shadow-sm group-hover:text-gray-900 transition-all">
                       <ChevronRight className="h-[18px] w-[18px]" strokeWidth={1.5} />
                     </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* MOBILE CARD VIEW */}
        <div className="md:hidden space-y-3">
          {bags.map((job) => (
            <Card 
              key={job.id} 
              className="shadow-sm border-gray-200/60 overflow-hidden bg-white active:scale-[0.98] transition-transform rounded-2xl"
              onClick={() => router.push(`/manufacturing/job-bags/${job.id}`)}
            >
              <CardContent className="p-5 space-y-4">
                 <div className="flex justify-between items-start">
                    <div className="space-y-1">
                       <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none">Reference</p>
                       <p className="text-[15px] font-mono font-bold text-gray-900 mt-1">{job.job_bag_number}</p>
                    </div>
                    {getStatusBadge(job.status)}
                 </div>

                 <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-100 flex justify-between items-center">
                    <div>
                      <div className="flex items-center gap-2.5">
                         <Briefcase className="h-[18px] w-[18px] text-gray-400" strokeWidth={1.5} />
                         <span className="text-[13px] font-bold text-gray-800">{job.product_category}</span>
                      </div>
                      <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-1 block">
                        {job.weight_used.toFixed(3)}g {job.isFinalWeight ? '(Actual)' : '(Est)'}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className={`block text-sm font-black ${job.isFinalWeight ? 'text-emerald-600' : 'text-blue-700'}`}>
                        ₹ {job.payout.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                      </span>
                      <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">{job.rate_display}</span>
                    </div>
                 </div>

                 <div className="flex items-center justify-between text-xs text-gray-500 pt-1">
                    <div className="flex flex-col gap-1.5">
                       <div className="flex items-center gap-2">
                         <div className="h-6 w-6 rounded-full bg-gray-200 flex items-center justify-center text-gray-500"><User className="h-3 w-3" strokeWidth={1.5} /></div>
                         <span className="font-semibold text-gray-900">{job.karigars?.full_name}</span>
                       </div>
                       <span className="text-[10px] font-medium ml-8 text-gray-400">{format(new Date(job.created_at), 'dd MMM yyyy')}</span>
                    </div>
                    <ChevronRight className="h-5 w-5 text-gray-300" strokeWidth={1.5} />
                 </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </>
    );
  };

  if (!appUser) return null;

  return (
    <div className="flex flex-col min-h-screen bg-[#F8F9FA] font-sans">
      
      <header className="sticky top-0 z-40 w-full bg-white/80 backdrop-blur-md border-b border-gray-200/60 px-4 h-14 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3 overflow-hidden">
          <Link href="/dashboard">
            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl hover:bg-gray-100 text-gray-500 transition-colors">
              <LayoutDashboard className="h-[18px] w-[18px]" strokeWidth={1.5} />
            </Button>
          </Link>
          <Separator orientation="vertical" className="h-5 bg-gray-200" />
          <nav className="flex items-center gap-1.5 text-[13px] whitespace-nowrap overflow-hidden">
            <span className="text-gray-500 font-medium">Production</span>
            <ChevronRight className="h-3.5 w-3.5 text-gray-400" strokeWidth={1.5} />
            <span className="font-bold text-gray-900 tracking-tight">Karigar & Jobs</span>
          </nav>
        </div>

        <div className="flex items-center gap-1 overflow-x-auto custom-scrollbar py-2 px-1">
          <Button variant="ghost" size="sm" className="h-9 px-3 text-[13px] font-bold text-gray-600 hover:text-blue-600 hover:bg-blue-50 relative shrink-0 rounded-xl transition-colors" onClick={() => setIsRestocksModalOpen(true)}>
            <div className="flex items-center"><Package className="h-[18px] w-[18px] sm:mr-2" strokeWidth={1.5} /> <span className="hidden sm:inline">Restocks</span></div>
            {pendingRestocks.length > 0 && <span className="absolute -top-1.5 -right-1.5 flex items-center justify-center h-4 min-w-[16px] px-1 rounded-full bg-red-500 text-white text-[9px] font-black border-2 border-white shadow-sm z-10">{pendingRestocks.length}</span>}
          </Button>

          <Button variant="ghost" size="sm" className="h-9 px-3 text-[13px] font-bold text-gray-600 hover:text-purple-600 hover:bg-purple-50 relative shrink-0 rounded-xl transition-colors" onClick={() => setIsOrdersModalOpen(true)}>
            <div className="flex items-center"><Bell className="h-[18px] w-[18px] sm:mr-2" strokeWidth={1.5} /> <span className="hidden sm:inline">Store Requests</span></div>
            {pendingOrders.length > 0 && <span className="absolute -top-1.5 -right-1.5 flex items-center justify-center h-4 min-w-[16px] px-1 rounded-full bg-red-500 text-white text-[9px] font-black border-2 border-white shadow-sm z-10">{pendingOrders.length}</span>}
          </Button>

          <Button variant="ghost" size="sm" className="h-9 px-3 text-[13px] font-bold text-gray-600 hover:text-amber-600 hover:bg-amber-50 relative shrink-0 rounded-xl transition-colors" onClick={() => setIsRepairsModalOpen(true)}>
            <div className="flex items-center"><Wrench className="h-[18px] w-[18px] sm:mr-2" strokeWidth={1.5} /> <span className="hidden sm:inline">Repairs</span></div>
            {pendingRepairs.length > 0 && <span className="absolute -top-1.5 -right-1.5 flex items-center justify-center h-4 min-w-[16px] px-1 rounded-full bg-red-500 text-white text-[9px] font-black border-2 border-white shadow-sm z-10">{pendingRepairs.length}</span>}
          </Button>

          <Separator orientation="vertical" className="h-5 mx-1.5 bg-gray-200 shrink-0 hidden sm:block" />
          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl text-gray-500 shrink-0 hover:bg-gray-100" onClick={fetchData}>
            <RefreshCw className={`h-[18px] w-[18px] ${loading ? 'animate-spin' : ''}`} strokeWidth={1.5} />
          </Button>
        </div>
      </header>

      <main className="p-4 md:p-6 lg:p-8 max-w-7xl w-full mx-auto space-y-6 animate-in fade-in duration-500 pb-20">
        
        <div className="bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-gray-200/60 flex flex-col md:flex-row justify-between md:items-center gap-4">
          <div className="space-y-1">
             <h1 className="text-xl font-bold tracking-tight text-gray-900">Karigar Pay & Workflow</h1>
             <p className="text-[13px] font-medium text-gray-500">Track artisan workloads and generate payroll based on received gold weight.</p>
          </div>
          
          <Sheet open={isOpen} onOpenChange={handleOpenSheet}>
            <SheetTrigger asChild>
              <Button className="h-10 px-6 font-bold text-[13px] shadow-sm bg-gray-900 text-white hover:bg-gray-800 rounded-xl w-full md:w-auto transition-all active:scale-95">
                <Plus className="mr-2 h-4 w-4" strokeWidth={2} /> New Job Bag
              </Button>
            </SheetTrigger>
            <SheetContent className="w-full sm:max-w-[450px] p-0 border-none shadow-2xl rounded-l-[24px]">
              <SheetHeader className="bg-gray-50/80 p-6 border-b border-gray-100">
                <SheetTitle className="text-lg font-bold text-gray-900">Initialize Job Bag</SheetTitle>
                <SheetDescription className="text-xs font-medium text-gray-500 mt-1">Assign metal weights and design targets to a Karigar.</SheetDescription>
              </SheetHeader>
              
              <div className="p-6 space-y-6 overflow-y-auto max-h-[calc(100vh-140px)] custom-scrollbar">
                <div className="space-y-5">
                  <div className="space-y-2">
                    <Label className="text-[11px] font-bold text-gray-500 uppercase tracking-widest flex justify-between">
                      <span>Unique Ref #</span>
                      <button type="button" onClick={generateJobRef} className="text-blue-600 flex items-center hover:text-blue-700 transition-colors">
                        <Wand2 className="w-3 h-3 mr-1" /> Auto
                      </button>
                    </Label>
                    <Input className="h-10 text-sm font-mono font-bold border-gray-200/60 bg-gray-50 rounded-xl" value={form.job_bag_number} onChange={(e) => setForm({ ...form, job_bag_number: e.target.value })} />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Item Category</Label>
                      {!showCustomCategory ? (
                         <Select value={form.product_category} onValueChange={(v) => {
                           if (v === 'Other') { setShowCustomCategory(true); setForm({ ...form, product_category: '' }); }
                           else { setForm({ ...form, product_category: v }); }
                         }}>
                           <SelectTrigger className="h-10 rounded-xl border-gray-200/60 bg-gray-50 text-sm"><SelectValue placeholder="Select..." /></SelectTrigger>
                           <SelectContent className="rounded-xl p-1">
                             {STANDARD_CATEGORIES.map(c => <SelectItem key={c} value={c} className="py-2 text-sm">{c}</SelectItem>)}
                             <SelectItem value="Other" className="py-2 text-sm font-bold text-blue-600">Other (Type)</SelectItem>
                           </SelectContent>
                         </Select>
                      ) : (
                         <div className="flex gap-1.5 h-10">
                           <Input className="h-10 text-sm border-blue-200 rounded-xl" placeholder="Custom..." value={form.product_category} onChange={(e) => setForm({ ...form, product_category: e.target.value })} />
                           <Button type="button" className="h-10 w-10 shrink-0 bg-blue-600 text-white rounded-xl" size="icon" onClick={() => setShowCustomCategory(false)}><Check className="h-4 w-4" /></Button>
                         </div>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Design ID</Label>
                      {!showCustomDesign ? (
                         <Select value={form.design_code} onValueChange={(v) => {
                           if (v === 'Other') { setShowCustomDesign(true); setForm({ ...form, design_code: '' }); }
                           else { setForm({ ...form, design_code: v }); }
                         }}>
                           <SelectTrigger className="h-10 rounded-xl border-gray-200/60 bg-gray-50 text-sm"><SelectValue placeholder="Design..." /></SelectTrigger>
                           <SelectContent className="rounded-xl p-1">
                             {STANDARD_DESIGNS.map(d => <SelectItem key={d} value={d} className="py-2 text-sm">{d}</SelectItem>)}
                             <SelectItem value="Other" className="py-2 text-sm font-bold text-blue-600">Other / Custom</SelectItem>
                           </SelectContent>
                         </Select>
                      ) : (
                         <div className="flex gap-1.5 h-10">
                           <Input className="h-10 text-sm font-mono border-blue-200 rounded-xl" placeholder="Custom ID..." value={form.design_code} onChange={(e) => setForm({ ...form, design_code: e.target.value })} />
                           <Button variant="outline" size="icon" className="h-10 w-10 shrink-0 rounded-xl" onClick={() => setShowCustomDesign(false)}><ArrowLeft className="h-4 w-4" /></Button>
                         </div>
                      )}
                    </div>
                  </div>

                  <Separator className="bg-gray-100" />

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Est. Gold (g)</Label>
                      <Input type="number" step="0.001" className="h-10 text-sm font-bold border-gray-200/60 bg-gray-50 rounded-xl" value={form.gold_expected_weight_g} onChange={(e) => setForm({ ...form, gold_expected_weight_g: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Est. Diamond (ct)</Label>
                      <Input type="number" step="0.01" className="h-10 text-sm font-bold border-gray-200/60 bg-gray-50 rounded-xl" value={form.diamond_expected_weight_cts} onChange={(e) => setForm({ ...form, diamond_expected_weight_cts: e.target.value })} />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Target Karigar</Label>
                    <Select onValueChange={(v) => setForm({ ...form, karigar_id: v })}>
                      <SelectTrigger className="h-10 rounded-xl border-gray-200/60 bg-gray-50 text-sm font-semibold"><SelectValue placeholder="Identify Karigar..." /></SelectTrigger>
                      <SelectContent className="rounded-xl p-1">
                        {karigars.map((k) => <SelectItem key={k.id} value={k.id} className="py-2.5 text-sm font-semibold">{k.full_name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Dispatch Date</Label>
                      <Input type="date" className="h-10 text-[13px] font-medium border-gray-200/60 bg-gray-50 rounded-xl px-3" value={form.issue_date} onChange={(e) => setForm({ ...form, issue_date: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Expected Return</Label>
                      <Input type="date" className="h-10 text-[13px] font-medium border-gray-200/60 bg-gray-50 rounded-xl px-3" value={form.expected_return_date} onChange={(e) => setForm({ ...form, expected_return_date: e.target.value })} />
                    </div>
                  </div>
                </div>
              </div>
              <SheetFooter className="p-5 bg-white border-t border-gray-100">
                 <Button className="w-full h-11 font-bold text-[13px] rounded-xl bg-blue-600 hover:bg-blue-700 text-white" onClick={handleCreate} disabled={isCreating}>
                   {isCreating ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                   Generate Job Bag
                 </Button>
              </SheetFooter>
            </SheetContent>
          </Sheet>
        </div>

        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          <div className="p-5 rounded-2xl border border-gray-200/60 bg-white shadow-sm flex flex-col justify-center">
            <p className="text-[11px] font-bold uppercase tracking-widest text-gray-500 flex items-center mb-1"><HardHat className="w-3.5 h-3.5 mr-1.5" /> Active Artisans</p>
            <p className="text-2xl font-black tracking-tight text-gray-900">{karigarLedgers.length}</p>
          </div>
          <div className="p-5 rounded-2xl border border-amber-100 bg-amber-50/50 shadow-sm flex flex-col justify-center">
            <p className="text-[11px] font-bold uppercase tracking-widest text-amber-600 flex items-center mb-1"><Scale className="w-3.5 h-3.5 mr-1.5" /> Pending Gold</p>
            <p className="text-2xl font-black tracking-tight text-amber-700">{totalPendingGrams.toFixed(2)} <span className="text-sm font-bold text-amber-600/50">g</span></p>
          </div>
          <div className="p-5 rounded-2xl border border-blue-100 bg-blue-50/50 shadow-sm flex flex-col justify-center">
            <p className="text-[11px] font-bold uppercase tracking-widest text-blue-600 flex items-center mb-1"><Package className="w-3.5 h-3.5 mr-1.5" /> Active Job Bags</p>
            <p className="text-2xl font-black tracking-tight text-blue-700">{activeBags.length}</p>
          </div>
          <div className="p-5 rounded-2xl border border-indigo-100 bg-indigo-50/50 shadow-sm flex flex-col justify-center">
            <p className="text-[11px] font-bold uppercase tracking-widest text-indigo-600 flex items-center mb-1"><Banknote className="w-3.5 h-3.5 mr-1.5" /> Est. Payouts Owed</p>
            <p className="text-2xl font-black tracking-tight text-indigo-700">₹ {totalPendingPayout.toLocaleString('en-IN')}</p>
          </div>
        </div>

        <div className="bg-white p-3 rounded-2xl border border-gray-200/60 shadow-sm flex flex-col xl:flex-row gap-3">
          <div className="relative flex-1 group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
            <Input
              placeholder="Search by Job ID, Category, or Design..."
              className="pl-9 h-10 text-[13px] bg-gray-50 border-transparent focus-visible:bg-white focus-visible:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-500/20 rounded-xl transition-all font-medium"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap md:flex-nowrap items-center gap-2">
            <div className="flex items-center gap-2 bg-gray-50 px-2 py-1 rounded-xl border border-gray-100 w-full md:w-auto">
              <User className="w-[18px] h-[18px] text-gray-400 ml-1.5" strokeWidth={1.5} />
              <Select value={karigarFilter} onValueChange={setKarigarFilter}>
                <SelectTrigger className="h-8 border-none bg-transparent shadow-none text-xs font-bold text-gray-700 w-full md:w-[160px] focus:ring-0">
                  <SelectValue placeholder="All Karigars" />
                </SelectTrigger>
                <SelectContent className="rounded-xl shadow-lg border-gray-100 p-1">
                  <SelectItem value="all" className="text-xs font-bold text-blue-600 rounded-lg py-2">All Karigars</SelectItem>
                  {karigars.map(k => <SelectItem key={k.id} value={k.id} className="text-xs font-medium rounded-lg py-2">{k.full_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2 bg-gray-50 px-2 py-1 rounded-xl border border-gray-100 w-full md:w-auto">
              <Filter className="w-[18px] h-[18px] text-gray-400 ml-1.5" strokeWidth={1.5} />
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-8 border-none bg-transparent shadow-none text-xs font-bold text-gray-700 w-full md:w-[150px] focus:ring-0">
                  <SelectValue placeholder="Lifecycle Filter" />
                </SelectTrigger>
                <SelectContent className="rounded-xl shadow-lg border-gray-100 p-1">
                  <SelectItem value="all" className="text-xs font-bold text-blue-600 rounded-lg py-2">All Statuses</SelectItem>
                  <SelectItem value="open" className="text-xs font-medium rounded-lg py-2">Awaiting Issue</SelectItem>
                  <SelectItem value="in_progress" className="text-xs font-medium rounded-lg py-2">Under Fabrication</SelectItem>
                  <SelectItem value="completed" className="text-xs font-medium rounded-lg py-2">Audit Ready / Completed</SelectItem>
                  <SelectItem value="closed" className="text-xs font-medium rounded-lg py-2">Archived / History</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <Tabs defaultValue="bags" className="w-full space-y-4">
          <TabsList className="bg-gray-100/50 border border-gray-200/50 rounded-xl h-12 px-1 flex w-full max-w-max overflow-x-auto custom-scrollbar">
            <TabsTrigger value="bags" className="rounded-lg px-6 text-xs font-bold uppercase tracking-widest data-[state=active]:bg-white data-[state=active]:shadow-sm">Active Job Bags</TabsTrigger>
            <TabsTrigger value="ledgers" className="rounded-lg px-6 text-xs font-bold uppercase tracking-widest data-[state=active]:bg-white data-[state=active]:shadow-sm">Karigar Ledger</TabsTrigger>
            <TabsTrigger value="history" className="rounded-lg px-6 text-xs font-bold uppercase tracking-widest data-[state=active]:bg-emerald-50 data-[state=active]:text-emerald-700 data-[state=active]:shadow-sm">
              <History className="w-3.5 h-3.5 mr-2" /> History & Settled
            </TabsTrigger>
          </TabsList>

          <TabsContent value="ledgers" className="m-0">
            <div className="bg-white border border-gray-200/60 rounded-2xl overflow-hidden shadow-sm">
              <Table>
                <TableHeader className="bg-gray-50/80">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-[11px] font-bold uppercase text-gray-500 tracking-widest px-6 h-12">Karigar Name</TableHead>
                    <TableHead className="text-[11px] font-bold uppercase text-gray-500 tracking-widest px-4 h-12 text-center">Active Bags</TableHead>
                    <TableHead className="text-[11px] font-bold uppercase text-gray-500 tracking-widest px-4 h-12 text-center">Base Rate</TableHead>
                    <TableHead className="text-[11px] font-bold uppercase text-amber-600 tracking-widest px-4 h-12 text-right">WIP Gold</TableHead>
                    <TableHead className="text-[11px] font-bold uppercase text-emerald-600 tracking-widest px-4 h-12 text-right">Ready Gold</TableHead>
                    <TableHead className="text-[11px] font-black uppercase text-indigo-700 tracking-widest px-6 h-12 text-right">Est. Payout</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {karigarLedgers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-24 text-center text-xs font-bold text-gray-400 uppercase tracking-widest">No active Karigar work found</TableCell>
                    </TableRow>
                  ) : (
                    karigarLedgers.map((k) => (
                      <TableRow key={k.id} className="hover:bg-gray-50/50 transition-colors border-b border-gray-100">
                        <TableCell className="px-6 py-4">
                           <div className="flex items-center gap-3">
                             <div className="h-8 w-8 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600"><User className="h-4 w-4" strokeWidth={2} /></div>
                             <span className="text-sm font-bold text-gray-900">{k.full_name}</span>
                           </div>
                        </TableCell>
                        <TableCell className="px-4 text-center">
                          <Badge variant="secondary" className="font-mono bg-gray-100">{k.activeJobs}</Badge>
                        </TableCell>
                        <TableCell className="px-4 text-center font-mono text-xs text-gray-600 font-bold">
                          ₹ {k.rate} <span className="text-[9px] uppercase tracking-widest text-gray-400">/{k.laborType === 'per_piece' || k.laborType === 'fixed' ? 'pc' : 'g'}</span>
                        </TableCell>
                        <TableCell className="px-4 text-right font-mono text-[13px] font-bold text-amber-600">
                          {k.pendingWeight > 0 ? `${k.pendingWeight.toFixed(2)} g` : '-'}
                        </TableCell>
                        <TableCell className="px-4 text-right font-mono text-[13px] font-bold text-emerald-600">
                          {k.readyWeight > 0 ? `${k.readyWeight.toFixed(2)} g` : '-'}
                        </TableCell>
                        <TableCell className="px-6 text-right font-mono text-[15px] font-black text-indigo-700 bg-indigo-50/30">
                          ₹ {k.estimatedPay.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="bags" className="m-0 space-y-4">
             {renderJobBagTable(activeBags)}
          </TabsContent>

          <TabsContent value="history" className="m-0 space-y-4">
             {renderJobBagTable(historyBags, true)}
          </TabsContent>
        </Tabs>

      </main>

      <Dialog open={isRestocksModalOpen} onOpenChange={setIsRestocksModalOpen}>
        <DialogContent className="sm:max-w-[550px] p-0 border-none shadow-2xl rounded-2xl bg-white overflow-hidden">
          <DialogHeader className="bg-blue-50/50 p-6 border-b border-blue-100/50">
            <DialogTitle className="text-lg font-bold text-blue-900 flex items-center gap-2.5">
              <Package className="w-5 h-5 text-blue-600" strokeWidth={2} /> Pending Branch Restocks
            </DialogTitle>
            <DialogDescription className="text-xs font-medium text-blue-700/70 mt-1.5">
              Select an internal branch indent to route to a Job Bag.
            </DialogDescription>
          </DialogHeader>

          <div className="p-0 max-h-[400px] overflow-y-auto custom-scrollbar bg-gray-50">
            {pendingRestocks.length === 0 ? (
              <div className="p-10 text-center text-gray-400 text-[13px] font-medium">
                No pending restock indents from branches.
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {pendingRestocks.map(restock => (
                  <div 
                    key={restock.id} 
                    onClick={() => setSelectedRestock(restock)}
                    className={`p-5 cursor-pointer transition-all ${selectedRestock?.id === restock.id ? 'bg-blue-50/50 border-l-4 border-blue-500' : 'bg-white hover:bg-gray-50 border-l-4 border-transparent'}`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <span className="font-mono font-bold text-[13px] text-gray-900">{restock.sku_reference}</span>
                      <Badge className="bg-blue-100 text-blue-700 border-blue-200 text-[9px] uppercase tracking-widest font-bold px-2">{restock.warehouses?.name}</Badge>
                    </div>
                    <div className="text-[13px] font-semibold text-gray-700">Quantity: {restock.quantity}</div>
                    <div className="text-xs text-gray-500 mt-1.5 flex flex-col gap-1 font-medium">
                      {restock.required_by_date && <span>Required by: <span className="font-bold text-gray-700">{format(new Date(restock.required_by_date), 'dd MMM yyyy')}</span></span>}
                      {restock.remarks && <span className="italic text-gray-500 mt-1 bg-gray-50 p-2 rounded-md border border-gray-100">"{restock.remarks}"</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {selectedRestock && (
            <div className="p-5 sm:p-6 bg-white border-t border-gray-200 space-y-5 animate-in fade-in slide-in-from-bottom-2">
              <div className="space-y-2">
                <Label className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Route to Job Bag</Label>
                <Select value={routingBagId} onValueChange={setRoutingBagId}>
                  <SelectTrigger className="h-11 rounded-xl border-gray-200/60 bg-gray-50 text-[13px] font-semibold focus:ring-blue-500/20 focus:border-blue-500 shadow-sm transition-all hover:bg-gray-100">
                    <SelectValue placeholder="Select target Job Bag..." />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl shadow-lg border-gray-100 p-1">
                    <SelectItem value="new" className="font-bold text-blue-600 rounded-lg py-2 focus:bg-blue-50 focus:text-blue-700">
                      + Create New Job Bag
                    </SelectItem>
                    <Separator className="my-1 bg-gray-100" />
                    {jobBags.filter(j => j.status !== 'completed').map(bag => (
                      <SelectItem key={bag.id} value={bag.id} className="font-medium text-gray-700 rounded-lg py-2 focus:bg-gray-50">
                        Attach to {bag.job_bag_number}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-3 pt-2">
                <Button variant="outline" className="flex-1 h-11 rounded-xl text-xs font-bold uppercase tracking-widest text-gray-500 border-gray-200 hover:bg-gray-100 transition-colors" onClick={() => {setSelectedRestock(null); setIsRestocksModalOpen(false)}}>Cancel</Button>
                <Button 
                  onClick={() => handleRouteItem('restock')}
                  disabled={isRouting}
                  className="flex-1 h-11 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs uppercase tracking-widest shadow-sm transition-colors"
                >
                  {isRouting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  Route Indent
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isRepairsModalOpen} onOpenChange={setIsRepairsModalOpen}>
        <DialogContent className="sm:max-w-[550px] p-0 border-none shadow-2xl rounded-2xl bg-white overflow-hidden">
          <DialogHeader className="bg-amber-50/50 p-6 border-b border-amber-100/50">
            <DialogTitle className="text-lg font-bold text-amber-900 flex items-center gap-2.5">
              <Wrench className="w-5 h-5 text-amber-600" strokeWidth={2} /> Pending Store Repairs
            </DialogTitle>
            <DialogDescription className="text-xs font-medium text-amber-700/70 mt-1.5">
              Select a repair ticket to assign it to an active Job Bag.
            </DialogDescription>
          </DialogHeader>

          <div className="p-0 max-h-[400px] overflow-y-auto custom-scrollbar bg-gray-50">
            {pendingRepairs.length === 0 ? (
              <div className="p-10 text-center text-gray-400 text-[13px] font-medium">
                No pending repairs waiting at HQ.
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {pendingRepairs.map(rep => (
                  <div 
                    key={rep.id} 
                    onClick={() => setSelectedRepair(rep)}
                    className={`p-5 cursor-pointer transition-all ${selectedRepair?.id === rep.id ? 'bg-amber-50/50 border-l-4 border-amber-500' : 'bg-white hover:bg-gray-50 border-l-4 border-transparent'}`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <span className="font-mono font-bold text-[13px] text-gray-900">{rep.ticket_number}</span>
                      <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-[9px] uppercase tracking-widest font-bold px-2">{rep.origin?.name}</Badge>
                    </div>
                    <div className="text-[13px] font-semibold text-gray-800">{rep.item_description}</div>
                    <div className="text-xs text-gray-500 mt-1.5 font-medium">
                      Recv. Weight: <span className="font-bold text-gray-700">{rep.gross_weight_g}g</span> • {rep.purity}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {selectedRepair && (
            <div className="p-5 sm:p-6 bg-white border-t border-gray-200 space-y-5 animate-in fade-in slide-in-from-bottom-2">
              <div className="space-y-2">
                <Label className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Route to Job Bag</Label>
                <Select value={routingBagId} onValueChange={setRoutingBagId}>
                  <SelectTrigger className="h-11 rounded-xl border-gray-200/60 bg-gray-50 text-[13px] font-semibold focus:ring-amber-500/20 focus:border-amber-500 shadow-sm transition-all hover:bg-gray-100">
                    <SelectValue placeholder="Select target Job Bag..." />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl shadow-lg border-gray-100 p-1">
                    <SelectItem value="new" className="font-bold text-amber-600 rounded-lg py-2 focus:bg-amber-50 focus:text-amber-700">
                      + Create New Job Bag
                    </SelectItem>
                    <Separator className="my-1 bg-gray-100" />
                    {jobBags.filter(j => j.status !== 'completed').map(bag => (
                      <SelectItem key={bag.id} value={bag.id} className="font-medium text-gray-700 rounded-lg py-2 focus:bg-gray-50">
                        Attach to {bag.job_bag_number}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-3 pt-2">
                <Button variant="outline" className="flex-1 h-11 rounded-xl text-xs font-bold uppercase tracking-widest text-gray-500 border-gray-200 hover:bg-gray-100 transition-colors" onClick={() => {setSelectedRepair(null); setIsRepairsModalOpen(false)}}>Cancel</Button>
                <Button 
                  onClick={() => handleRouteItem('repair')}
                  disabled={isRouting}
                  className="flex-1 h-11 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs uppercase tracking-widest shadow-sm transition-colors"
                >
                  {isRouting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  Route Repair
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isOrdersModalOpen} onOpenChange={setIsOrdersModalOpen}>
        <DialogContent className="sm:max-w-[550px] p-0 border-none shadow-2xl rounded-2xl bg-white overflow-hidden">
          <DialogHeader className="bg-purple-50/50 p-6 border-b border-purple-100/50">
            <DialogTitle className="text-lg font-bold text-purple-900 flex items-center gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-purple-600" strokeWidth={2} /> Pending Store Requests
            </DialogTitle>
            <DialogDescription className="text-xs font-medium text-purple-700/70 mt-1.5">
              Select a custom order to pull its specifications into a Job Bag.
            </DialogDescription>
          </DialogHeader>

          <div className="p-0 max-h-[400px] overflow-y-auto custom-scrollbar bg-gray-50">
            {pendingOrders.length === 0 ? (
              <div className="p-10 text-center text-gray-400 text-[13px] font-medium">
                No pending custom orders.
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {pendingOrders.map(order => (
                  <div 
                    key={order.id} 
                    onClick={() => setSelectedOrder(order)}
                    className={`p-5 cursor-pointer transition-all ${selectedOrder?.id === order.id ? 'bg-purple-50/50 border-l-4 border-purple-500' : 'bg-white hover:bg-gray-50 border-l-4 border-transparent'}`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <span className="font-mono font-bold text-[13px] text-gray-900">{order.order_number}</span>
                      <Badge className="bg-purple-100 text-purple-700 border-purple-200 text-[9px] uppercase tracking-widest font-bold px-2">{order.origin?.name}</Badge>
                    </div>
                    <div className="text-[13px] font-semibold text-gray-800">{order.design_reference}</div>
                    <div className="text-xs text-gray-500 mt-1.5 font-medium">
                      {order.item_category} • <span className="font-bold text-gray-700">{order.expected_gold_g || 'TBD'}g</span> Gold • <span className="font-bold text-gray-700">{order.expected_diamond_cts || 'TBD'}ct</span> Dia
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {selectedOrder && (
            <div className="p-5 sm:p-6 bg-white border-t border-gray-200 space-y-5 animate-in fade-in slide-in-from-bottom-2">
              <div className="space-y-2">
                <Label className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Route to Job Bag</Label>
                <Select value={routingBagId} onValueChange={setRoutingBagId}>
                  <SelectTrigger className="h-11 rounded-xl border-gray-200/60 bg-gray-50 text-[13px] font-semibold focus:ring-purple-500/20 focus:border-purple-500 shadow-sm transition-all hover:bg-gray-100">
                    <SelectValue placeholder="Select target Job Bag..." />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl shadow-lg border-gray-100 p-1">
                    <SelectItem value="new" className="font-bold text-purple-600 rounded-lg py-2 focus:bg-purple-50 focus:text-purple-700">
                      + Create New Job Bag
                    </SelectItem>
                    <Separator className="my-1 bg-gray-100" />
                    {jobBags.filter(j => j.status !== 'completed').map(bag => (
                      <SelectItem key={bag.id} value={bag.id} className="font-medium text-gray-700 rounded-lg py-2 focus:bg-gray-50">
                        Attach to {bag.job_bag_number}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-3 pt-2">
                <Button variant="outline" className="flex-1 h-11 rounded-xl text-xs font-bold uppercase tracking-widest text-gray-500 border-gray-200 hover:bg-gray-100 transition-colors" onClick={() => {setSelectedOrder(null); setIsOrdersModalOpen(false)}}>Cancel</Button>
                <Button 
                  onClick={() => handleRouteItem('order')}
                  disabled={isRouting}
                  className="flex-1 h-11 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs uppercase tracking-widest shadow-sm transition-colors"
                >
                  {isRouting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  Process Order
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}