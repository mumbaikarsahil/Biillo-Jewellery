"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { 
  Plus, Search, ChevronRight, ArrowLeft, LayoutDashboard, 
  RefreshCw, Database, Loader2, Briefcase, User, CheckCircle2,
  Package, Info, Filter, Wand2, SortDesc, CalendarDays, Bell, Hammer, Wrench
} from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
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
  const [loading, setLoading] = useState(true);
  
  // Sheet/Modal states
  const [isCreating, setIsCreating] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  
  const [isOrdersModalOpen, setIsOrdersModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  
  const [isRepairsModalOpen, setIsRepairsModalOpen] = useState(false);
  const [selectedRepair, setSelectedRepair] = useState<any>(null);

  const [routingBagId, setRoutingBagId] = useState<string>('new');
  const [isRouting, setIsRouting] = useState(false);

  // Filters & Sorting State
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [karigarFilter, setKarigarFilter] = useState("all");
  const [dateSort, setDateSort] = useState("desc");

  // Smart Dropdown States
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
      const [jbRes, kRes, ordRes, repRes] = await Promise.all([
        supabase.from("job_bags").select("*, karigars(full_name)").eq("company_id", appUser.company_id),
        supabase.from("karigars").select("id, full_name").eq("company_id", appUser.company_id).eq("is_active", true),
        // Fetch Custom Orders safely
        supabase.from("custom_orders").select("*, origin:origin_warehouse_id(name)").eq("company_id", appUser.company_id).eq("status", "pending_manufacturing"),
        // Fetch Repairs safely
        supabase.from("repair_tickets").select("*, origin:warehouses!repair_tickets_origin_warehouse_id_fkey(name)").eq("company_id", appUser.company_id).eq("status", "received_at_ho")
      ]);

      // 1. Handle Job Bags (Core Data)
      if (jbRes.error) {
        console.error("Job Bags Error:", jbRes.error);
        toast.error("Failed to load Job Bags");
      } else {
        setJobBags(jbRes.data || []);
      }

      // 2. Handle Karigars
      if (kRes.error) console.error("Karigars Error:", kRes.error);
      else setKarigars(kRes.data || []);

      // 3. Handle Custom Orders (Don't crash the page if it fails)
      if (ordRes.error) console.error("Custom Orders Error:", ordRes.error);
      else setPendingOrders(ordRes.data || []);

      // 4. Handle Repairs (Don't crash the page if it fails)
      if (repRes.error) console.error("Repairs Error:", repRes.error);
      else setPendingRepairs(repRes.data || []);

    } catch (err: any) {
      toast.error(`Unexpected error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [appUser]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const openCount = jobBags.filter((j) => j.status === 'open').length;
  const inProgressCount = jobBags.filter((j) => j.status === 'in_progress').length;
  const completedCount = jobBags.filter((j) => j.status === 'completed').length;

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

  // --- ROUTE CUSTOM ORDER OR REPAIR TO JOB BAG ---
  const handleRouteItem = async (type: 'order' | 'repair') => {
    const item = type === 'order' ? selectedOrder : selectedRepair;
    if (!item) return;

    setIsRouting(true);
    try {
      let targetBagId = routingBagId;
      
      // If "Create New" is selected, scaffold a new job bag instantly
      if (targetBagId === 'new') {
        const newBagNumber = type === 'order' 
          ? `JB-CUST-${Date.now().toString().slice(-6)}`
          : `JB-REP-${Date.now().toString().slice(-6)}`;

        const { data: newBag, error } = await supabase
          .from('job_bags')
          .insert({
            company_id: appUser?.company_id,
            job_bag_number: newBagNumber,
            product_category: type === 'order' ? item.item_category : 'Repair Job',
            design_code: type === 'order' ? item.design_reference : item.ticket_number,
            gold_expected_weight_g: type === 'order' ? item.expected_gold_g : 0,
            status: 'open'
          })
          .select().single();
          
        if (error) throw error;
        targetBagId = newBag.id;
      }

      if (type === 'order') {
        setIsOrdersModalOpen(false);
        router.push(`/manufacturing/job-bags/${targetBagId}?custom_order=${item.id}`);
      } else {
        setIsRepairsModalOpen(false);
        router.push(`/manufacturing/job-bags/${targetBagId}?repair_ticket=${item.id}`);
      }
      
    } catch (err: any) {
      toast.error("Routing Error: " + err.message);
    } finally {
      setIsRouting(false);
    }
  }

  const filtered = jobBags
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "open": return <Badge variant="outline" className="bg-blue-500/5 text-blue-600 border-blue-200/50 text-[10px] font-bold h-5 uppercase">Awaiting Issue</Badge>;
      case "in_progress": return <Badge variant="outline" className="bg-amber-500/5 text-amber-600 border-amber-200/50 text-[10px] font-bold h-5 uppercase">In Fabrication</Badge>;
      case "completed": return <Badge variant="outline" className="bg-emerald-500/5 text-emerald-600 border-emerald-200/50 text-[10px] font-bold h-5 uppercase">Finished</Badge>;
      default: return <Badge variant="secondary" className="text-[10px] h-5 uppercase">{status}</Badge>;
    }
  };

  const ListSkeleton = () => (
    <div className="space-y-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-16 w-full rounded-lg border border-border/40" />
      ))}
    </div>
  );

  if (!appUser) return null;

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* --- IDE HEADER --- */}
      <header className="sticky top-0 z-40 w-full bg-background border-b border-border px-4 h-12 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3 overflow-hidden">
          <Link href="/dashboard">
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-md hover:bg-secondary">
              <LayoutDashboard className="h-4 w-4 text-muted-foreground" />
            </Button>
          </Link>
          <Separator orientation="vertical" className="h-4" />
          <nav className="flex items-center gap-1.5 text-sm whitespace-nowrap overflow-hidden">
            <span className="text-muted-foreground font-medium">Production</span>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="font-semibold text-foreground">Job Bags</span>
            <div className="ml-3 hidden md:flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-secondary border border-border">
              <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
              <span className="text-[10px] font-bold text-muted-foreground uppercase">Live Factory</span>
            </div>
          </nav>
        </div>

        <div className="flex items-center gap-2">
          
          {/* NOTIFICATION BELL FOR REPAIRS */}
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-8 px-2 text-xs font-semibold text-amber-600 hover:text-amber-700 hover:bg-amber-50 relative"
            onClick={() => setIsRepairsModalOpen(true)}
          >
            <Wrench className="h-4 w-4 sm:mr-1.5" /> 
            <span className="hidden sm:inline">Store Repairs</span>
            {pendingRepairs.length > 0 && (
              <span className="absolute top-1 right-1 sm:-top-1 sm:-right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500 border-2 border-white"></span>
              </span>
            )}
          </Button>

          {/* NOTIFICATION BELL FOR CUSTOM ORDERS */}
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-8 px-2 text-xs font-semibold text-purple-600 hover:text-purple-700 hover:bg-purple-50 relative"
            onClick={() => setIsOrdersModalOpen(true)}
          >
            <Bell className="h-4 w-4 sm:mr-1.5" /> 
            <span className="hidden sm:inline">Store Requests</span>
            {pendingOrders.length > 0 && (
              <span className="absolute top-1 right-1 sm:-top-1 sm:-right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-purple-500 border-2 border-white"></span>
              </span>
            )}
          </Button>

          <Separator orientation="vertical" className="h-4 mx-1" />
          <Button variant="ghost" size="sm" className="h-8 px-2 text-xs font-medium text-muted-foreground" onClick={fetchData}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} /> <span className="hidden sm:inline">Refresh</span>
          </Button>
          <Separator orientation="vertical" className="h-4 mx-1 hidden sm:block" />
          <Button variant="outline" size="sm" className="h-8 text-xs font-semibold px-3 border-border hidden sm:flex">
            <Database className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" /> Registry
          </Button>
        </div>
      </header>

      <main className="p-4 md:p-8 max-w-[1400px] w-full mx-auto space-y-8 animate-in fade-in duration-500">
        
        {/* ACTION BAR */}
        <div className="flex flex-col md:flex-row justify-between md:items-center gap-6">
          <div className="space-y-1">
             <h1 className="text-2xl font-bold tracking-tight text-foreground">Manufacturing Workflow</h1>
             <p className="text-sm text-muted-foreground">Orchestrate workshop orders, material allocation, and artisan tracking.</p>
          </div>
          
          <Sheet open={isOpen} onOpenChange={handleOpenSheet}>
            <SheetTrigger asChild>
              <Button className="h-10 px-6 font-bold text-xs uppercase tracking-widest shadow-md bg-foreground text-background hover:bg-foreground/90 w-full md:w-auto transition-transform active:scale-95">
                <Plus className="mr-2 h-4 w-4" /> New Production Bag
              </Button>
            </SheetTrigger>
            <SheetContent className="w-full sm:max-w-[500px] p-0 border-none shadow-2xl">
              <SheetHeader className="bg-secondary/50 p-6 border-b">
                <SheetTitle className="text-lg font-bold">Initialize Job Bag</SheetTitle>
                <SheetDescription className="text-xs font-medium uppercase tracking-tight">Define standard parameters or create custom references.</SheetDescription>
              </SheetHeader>
              
              <div className="p-6 space-y-6 overflow-y-auto max-h-[calc(100vh-140px)] custom-scrollbar">
                <div className="space-y-4">
                  
                  {/* AUTO-GENERATED REF */}
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-bold text-muted-foreground uppercase flex justify-between">
                      <span>Unique Ref #</span>
                      <button type="button" onClick={generateJobRef} className="text-primary flex items-center hover:underline">
                        <Wand2 className="w-3 h-3 mr-1" /> Auto-Generate
                      </button>
                    </Label>
                    <Input placeholder="e.g. JB-9921" className="h-9 text-sm font-mono font-bold border-border bg-white focus-visible:ring-primary" value={form.job_bag_number} onChange={(e) => setForm({ ...form, job_bag_number: e.target.value })} />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    {/* CATEGORY SMART SELECTOR */}
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-bold text-muted-foreground uppercase">Item Category</Label>
                      {!showCustomCategory ? (
                         <Select value={form.product_category} onValueChange={(v) => {
                           if (v === 'Other') { setShowCustomCategory(true); setForm({ ...form, product_category: '' }); }
                           else { setForm({ ...form, product_category: v }); }
                         }}>
                           <SelectTrigger className="h-9 text-sm border-border bg-muted/20"><SelectValue placeholder="Category..." /></SelectTrigger>
                           <SelectContent>
                             {STANDARD_CATEGORIES.map(c => <SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>)}
                             <SelectItem value="Other" className="text-xs font-bold text-primary">Other (Type)</SelectItem>
                           </SelectContent>
                         </Select>
                      ) : (
                         <div className="flex gap-1 h-9">
                           <Input className="h-9 text-sm bg-white border-primary" placeholder="Custom..." value={form.product_category} onChange={(e) => setForm({ ...form, product_category: e.target.value })} />
                           <Button variant="outline" size="icon" className="h-9 w-9 shrink-0 text-slate-400" onClick={() => setShowCustomCategory(false)}><ArrowLeft className="h-4 w-4" /></Button>
                         </div>
                      )}
                    </div>

                    {/* DESIGN SMART SELECTOR */}
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-bold text-muted-foreground uppercase">Design ID</Label>
                      {!showCustomDesign ? (
                         <Select value={form.design_code} onValueChange={(v) => {
                           if (v === 'Other') { setShowCustomDesign(true); setForm({ ...form, design_code: '' }); }
                           else { setForm({ ...form, design_code: v }); }
                         }}>
                           <SelectTrigger className="h-9 text-sm border-border bg-muted/20"><SelectValue placeholder="Design..." /></SelectTrigger>
                           <SelectContent>
                             {STANDARD_DESIGNS.map(d => <SelectItem key={d} value={d} className="text-xs">{d}</SelectItem>)}
                             <SelectItem value="Other" className="text-xs font-bold text-primary">Other / Custom</SelectItem>
                           </SelectContent>
                         </Select>
                      ) : (
                         <div className="flex gap-1 h-9">
                           <Input className="h-9 text-sm bg-white border-primary font-mono" placeholder="Custom ID..." value={form.design_code} onChange={(e) => setForm({ ...form, design_code: e.target.value })} />
                           <Button variant="outline" size="icon" className="h-9 w-9 shrink-0 text-slate-400" onClick={() => setShowCustomDesign(false)}><ArrowLeft className="h-4 w-4" /></Button>
                         </div>
                      )}
                    </div>
                  </div>

                  <Separator className="bg-border/60" />

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-tighter">Est. Gold Mass (g)</Label>
                      <Input type="number" step="0.001" className="h-9 text-sm border-border bg-muted/20 font-bold" value={form.gold_expected_weight_g} onChange={(e) => setForm({ ...form, gold_expected_weight_g: e.target.value })} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-tighter">Est. Diamond (ct)</Label>
                      <Input type="number" step="0.01" className="h-9 text-sm border-border bg-muted/20 font-bold" value={form.diamond_expected_weight_cts} onChange={(e) => setForm({ ...form, diamond_expected_weight_cts: e.target.value })} />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-bold text-muted-foreground uppercase">Target Artisan (Karigar)</Label>
                    <Select onValueChange={(v) => setForm({ ...form, karigar_id: v })}>
                      <SelectTrigger className="h-9 text-sm border-border bg-white focus-visible:ring-primary">
                        <SelectValue placeholder="Identify Karigar..." />
                      </SelectTrigger>
                      <SelectContent>
                        {karigars.map((k) => <SelectItem key={k.id} value={k.id} className="text-xs font-semibold">{k.full_name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-bold text-muted-foreground uppercase">Dispatch Date</Label>
                      <Input type="date" className="h-9 text-sm border-border bg-muted/20" value={form.issue_date} onChange={(e) => setForm({ ...form, issue_date: e.target.value })} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-bold text-muted-foreground uppercase">Expected Return</Label>
                      <Input type="date" className="h-9 text-sm border-border bg-muted/20" value={form.expected_return_date} onChange={(e) => setForm({ ...form, expected_return_date: e.target.value })} />
                    </div>
                  </div>
                </div>
              </div>
              <SheetFooter className="p-6 bg-secondary/30 border-t">
                 <Button className="w-full h-10 font-bold text-xs uppercase tracking-widest shadow-md" onClick={handleCreate} disabled={isCreating}>
                   {isCreating ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                   Begin Fabrication
                 </Button>
              </SheetFooter>
            </SheetContent>
          </Sheet>
        </div>

        {/* SUMMARY DASHBOARD - HIGH DENSITY */}
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          <div className="p-4 rounded-xl border border-border bg-card shadow-none">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Queue Size</p>
            <p className="text-2xl font-bold tracking-tight text-foreground">{jobBags.length}</p>
          </div>
          <div className="p-4 rounded-xl border border-blue-200/60 bg-blue-50/20 shadow-none">
            <p className="text-[10px] font-bold uppercase tracking-widest text-blue-600 mb-1">In Fabrication</p>
            <p className="text-2xl font-bold tracking-tight text-blue-700">{inProgressCount}</p>
          </div>
          <div className="p-4 rounded-xl border border-emerald-200/60 bg-emerald-50/20 shadow-none">
            <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-600 mb-1">Ready for Audit</p>
            <p className="text-2xl font-bold tracking-tight text-emerald-700">{completedCount}</p>
          </div>
          <div className="p-4 rounded-xl border border-amber-200/60 bg-amber-50/20 shadow-none">
            <p className="text-[10px] font-bold uppercase tracking-widest text-amber-600 mb-1">Awaiting Issue</p>
            <p className="text-2xl font-bold tracking-tight text-amber-700">{openCount}</p>
          </div>
        </div>

        {/* MULTI-FILTER SYSTEM */}
        <div className="flex flex-col xl:flex-row gap-3">
          <div className="relative flex-1 group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
            <Input
              placeholder="Search by Job ID, Category, or Design..."
              className="pl-9 h-10 text-sm bg-muted/20 border-border focus-visible:bg-background"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          
          <div className="flex flex-wrap md:flex-nowrap items-center gap-2">
            {/* KARIGAR FILTER */}
            <div className="flex items-center gap-2 bg-secondary/50 p-1 rounded-md border border-border w-full md:w-auto">
              <div className="pl-2 pr-1"><User className="w-3.5 h-3.5 text-muted-foreground" /></div>
              <Select value={karigarFilter} onValueChange={setKarigarFilter}>
                <SelectTrigger className="h-8 border-none bg-transparent shadow-none text-xs font-semibold w-full md:w-[160px] focus:ring-0">
                  <SelectValue placeholder="All Karigars" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs font-bold">All Karigars</SelectItem>
                  {karigars.map(k => <SelectItem key={k.id} value={k.id} className="text-xs">{k.full_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* STATUS FILTER */}
            <div className="flex items-center gap-2 bg-secondary/50 p-1 rounded-md border border-border w-full md:w-auto">
              <div className="pl-2 pr-1"><Filter className="w-3.5 h-3.5 text-muted-foreground" /></div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-8 border-none bg-transparent shadow-none text-xs font-semibold w-full md:w-[150px] focus:ring-0">
                  <SelectValue placeholder="Lifecycle Filter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs font-bold">All Statuses</SelectItem>
                  <SelectItem value="open" className="text-xs">Awaiting Issue</SelectItem>
                  <SelectItem value="in_progress" className="text-xs">Under Fabrication</SelectItem>
                  <SelectItem value="completed" className="text-xs">Finished / Audit</SelectItem>
                  <SelectItem value="closed" className="text-xs">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* DATE SORT */}
            <div className="flex items-center gap-2 bg-secondary/50 p-1 rounded-md border border-border w-full md:w-auto">
              <div className="pl-2 pr-1"><CalendarDays className="w-3.5 h-3.5 text-muted-foreground" /></div>
              <Select value={dateSort} onValueChange={setDateSort}>
                <SelectTrigger className="h-8 border-none bg-transparent shadow-none text-xs font-semibold w-full md:w-[130px] focus:ring-0">
                  <SelectValue placeholder="Sort" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="desc" className="text-xs">Newest First</SelectItem>
                  <SelectItem value="asc" className="text-xs">Oldest First</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* JOB BAGS LIST */}
        <div className="space-y-4 pb-20">
          {loading ? (
            <ListSkeleton />
          ) : filtered.length === 0 ? (
            <div className="text-center py-20 bg-muted/5 border border-dashed rounded-xl">
               <Package className="w-10 h-10 mx-auto mb-4 text-muted-foreground/20" />
               <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">No matching orders in registry</p>
            </div>
          ) : (
            <>
              {/* DESKTOP VIEW */}
              <div className="hidden md:block overflow-hidden border border-border/60 rounded-xl bg-card shadow-none">
                <Table>
                  <TableHeader className="bg-secondary/30">
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="text-[10px] font-black uppercase text-muted-foreground px-6 h-10">Job Ref</TableHead>
                      <TableHead className="text-[10px] font-black uppercase text-muted-foreground px-4 h-10">Specs & Category</TableHead>
                      <TableHead className="text-[10px] font-black uppercase text-muted-foreground px-4 h-10">Artisan</TableHead>
                      <TableHead className="text-[10px] font-black uppercase text-muted-foreground px-4 h-10">Created Date</TableHead>
                      <TableHead className="text-[10px] font-black uppercase text-muted-foreground px-4 h-10 text-center">Status</TableHead>
                      <TableHead className="w-[80px] h-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((job) => (
                      <TableRow 
                        key={job.id} 
                        className="hover:bg-secondary/20 transition-colors border-b last:border-0 cursor-pointer group"
                        onClick={() => router.push(`/manufacturing/job-bags/${job.id}`)}
                      >
                        <TableCell className="px-6 py-4 font-mono font-bold text-xs text-foreground tracking-tight">
                           {job.job_bag_number}
                        </TableCell>
                        <TableCell className="px-4">
                           <div className="text-xs font-bold text-foreground">{job.product_category}</div>
                           <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-tight">SKU: {job.design_code}</div>
                        </TableCell>
                        <TableCell className="px-4">
                           <div className="flex items-center gap-2">
                             <User className="h-3 w-3 text-muted-foreground/60" />
                             <span className="text-[13px] font-semibold text-gray-700">{job.karigars?.full_name}</span>
                           </div>
                        </TableCell>
                        <TableCell className="px-4">
                           <div className="text-xs text-muted-foreground font-medium">
                             {new Date(job.created_at).toLocaleDateString('en-GB')}
                           </div>
                        </TableCell>
                        <TableCell className="px-4 text-center">
                           {getStatusBadge(job.status)}
                        </TableCell>
                        <TableCell className="px-6 text-right">
                           <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-all group-hover:translate-x-1" />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* MOBILE CARD VIEW */}
              <div className="md:hidden space-y-3">
                {filtered.map((job) => (
                  <Card 
                    key={job.id} 
                    className="shadow-sm border-border/60 overflow-hidden bg-card active:scale-[0.98] transition-transform"
                    onClick={() => router.push(`/manufacturing/job-bags/${job.id}`)}
                  >
                    <CardContent className="p-4 space-y-4">
                       <div className="flex justify-between items-start">
                          <div className="space-y-1">
                             <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest leading-none">Reference</p>
                             <p className="text-sm font-mono font-bold text-foreground mt-1">{job.job_bag_number}</p>
                          </div>
                          {getStatusBadge(job.status)}
                       </div>

                       <div className="p-3 rounded-lg bg-secondary/50 border border-border/50 flex justify-between items-center">
                          <div className="flex items-center gap-2">
                             <Briefcase className="h-3.5 w-3.5 text-muted-foreground/60" />
                             <span className="text-xs font-bold text-gray-700">{job.product_category}</span>
                          </div>
                          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-tighter">{job.design_code}</span>
                       </div>

                       <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
                          <div className="flex flex-col gap-1">
                             <div className="flex items-center gap-2">
                               <User className="h-3 w-3" />
                               <span className="font-semibold text-gray-900">{job.karigars?.full_name}</span>
                             </div>
                             <span className="text-[10px]">{new Date(job.created_at).toLocaleDateString('en-GB')}</span>
                          </div>
                          <ChevronRight className="h-4 w-4 text-border" />
                       </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}
        </div>

      </main>

      {/* PENDING REPAIRS MODAL */}
      <Dialog open={isRepairsModalOpen} onOpenChange={setIsRepairsModalOpen}>
        <DialogContent className="sm:max-w-[550px] p-0 border-slate-200 shadow-2xl rounded-xl bg-white overflow-hidden">
          <DialogHeader className="bg-amber-50 p-5 border-b border-amber-100">
            <DialogTitle className="text-base font-semibold text-amber-900 flex items-center gap-2">
              <Wrench className="w-5 h-5 text-amber-600" /> Pending Store Repairs
            </DialogTitle>
            <DialogDescription className="text-xs text-amber-700/70 mt-1">
              Select a repair ticket to assign it to an active Job Bag.
            </DialogDescription>
          </DialogHeader>

          <div className="p-0 max-h-[400px] overflow-y-auto custom-scrollbar bg-slate-50">
            {pendingRepairs.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-sm">
                No pending repairs waiting at HQ.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {pendingRepairs.map(rep => (
                  <div 
                    key={rep.id} 
                    onClick={() => setSelectedRepair(rep)}
                    className={`p-4 cursor-pointer transition-colors ${selectedRepair?.id === rep.id ? 'bg-amber-100/50' : 'bg-white hover:bg-slate-50'}`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <span className="font-mono font-bold text-xs text-slate-900">{rep.ticket_number}</span>
                      <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-[9px] uppercase tracking-widest">{rep.origin?.name}</Badge>
                    </div>
                    <div className="text-sm font-semibold text-slate-700">{rep.item_description}</div>
                    <div className="text-xs text-slate-500 mt-1">
                      Recv. Weight: {rep.gross_weight_g}g • {rep.purity}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {selectedRepair && (
            <div className="p-5 bg-white border-t border-slate-200 space-y-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Route to Job Bag</Label>
                <Select value={routingBagId} onValueChange={setRoutingBagId}>
                  <SelectTrigger className="h-10 border-slate-300">
                    <SelectValue placeholder="Select target Job Bag..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new" className="font-bold text-amber-700">
                      + Create New Job Bag
                    </SelectItem>
                    {jobBags.filter(j => j.status !== 'completed').map(bag => (
                      <SelectItem key={bag.id} value={bag.id} className="font-medium text-slate-700">
                        Attach to {bag.job_bag_number}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-3 pt-2">
                <Button variant="outline" className="flex-1" onClick={() => {setSelectedRepair(null); setIsRepairsModalOpen(false)}}>Cancel</Button>
                <Button 
                  onClick={() => handleRouteItem('repair')}
                  disabled={isRouting}
                  className="flex-1 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs uppercase tracking-widest"
                >
                  {isRouting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  Route Repair
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* PENDING CUSTOM ORDERS MODAL */}
      <Dialog open={isOrdersModalOpen} onOpenChange={setIsOrdersModalOpen}>
        <DialogContent className="sm:max-w-[550px] p-0 border-slate-200 shadow-2xl rounded-xl bg-white overflow-hidden">
          <DialogHeader className="bg-purple-50 p-5 border-b border-purple-100">
            <DialogTitle className="text-base font-semibold text-purple-900 flex items-center gap-2">
              <Hammer className="w-5 h-5 text-purple-600" /> Pending Store Requests
            </DialogTitle>
            <DialogDescription className="text-xs text-purple-700/70 mt-1">
              Select a custom order to pull its specifications into a Job Bag.
            </DialogDescription>
          </DialogHeader>

          <div className="p-0 max-h-[400px] overflow-y-auto custom-scrollbar bg-slate-50">
            {pendingOrders.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-sm">
                No pending custom orders.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {pendingOrders.map(order => (
                  <div 
                    key={order.id} 
                    onClick={() => setSelectedOrder(order)}
                    className={`p-4 cursor-pointer transition-colors ${selectedOrder?.id === order.id ? 'bg-purple-100/50' : 'bg-white hover:bg-slate-50'}`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <span className="font-mono font-bold text-xs text-slate-900">{order.order_number}</span>
                      <Badge className="bg-purple-100 text-purple-700 border-purple-200 text-[9px] uppercase tracking-widest">{order.origin?.name}</Badge>
                    </div>
                    <div className="text-sm font-semibold text-slate-700">{order.design_reference}</div>
                    <div className="text-xs text-slate-500 mt-1">
                      {order.item_category} • {order.expected_gold_g || 'TBD'}g Gold • {order.expected_diamond_cts || 'TBD'}ct Dia
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {selectedOrder && (
            <div className="p-5 bg-white border-t border-slate-200 space-y-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Route to Job Bag</Label>
                <Select value={routingBagId} onValueChange={setRoutingBagId}>
                  <SelectTrigger className="h-10 border-slate-300">
                    <SelectValue placeholder="Select target Job Bag..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new" className="font-bold text-purple-700">
                      + Create New Job Bag
                    </SelectItem>
                    {jobBags.filter(j => j.status !== 'completed').map(bag => (
                      <SelectItem key={bag.id} value={bag.id} className="font-medium text-slate-700">
                        Attach to {bag.job_bag_number}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-3 pt-2">
                <Button variant="outline" className="flex-1" onClick={() => {setSelectedOrder(null); setIsOrdersModalOpen(false)}}>Cancel</Button>
                <Button 
                  onClick={() => handleRouteItem('order')}
                  disabled={isRouting}
                  className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs uppercase tracking-widest"
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