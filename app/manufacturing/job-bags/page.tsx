"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { 
  Plus, 
  Search, 
  ChevronRight, 
  ArrowLeft, 
  LayoutDashboard, 
  RefreshCw, 
  Database,
  Loader2,
  Briefcase,
  User,
  CheckCircle2,
  Package,
  Info,
  Filter
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
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
  SheetFooter
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { Label } from "@/components/ui/label";

export default function JobBagPage() {
  const { appUser } = useAuth();
  const router = useRouter();

  const [jobBags, setJobBags] = useState<any[]>([]);
  const [karigars, setKarigars] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isOpen, setIsOpen] = useState(false);

  const [form, setForm] = useState({
    job_bag_number: "",
    product_category: "",
    design_code: "",
    gold_expected_weight_g: "",
    diamond_expected_weight_cts: "",
    karigar_id: "",
    issue_date: "",
    expected_return_date: ""
  });

  async function fetchData() {
    if (!appUser) return;
    setLoading(true);
    try {
      const { data } = await supabase
        .from("job_bags")
        .select("*, karigars(full_name)")
        .eq("company_id", appUser.company_id)
        .order("created_at", { ascending: false });

      const { data: kData } = await supabase
        .from("karigars")
        .select("id, full_name")
        .eq("company_id", appUser.company_id)
        .eq("is_active", true);

      setJobBags(data || []);
      setKarigars(kData || []);
    } catch (err) {
      toast.error("Failed to load manufacturing data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, [appUser]);

  // FIX: Summary logic added back to component body
  const openCount = jobBags.filter((j) => j.status === 'open').length;
  const inProgressCount = jobBags.filter((j) => j.status === 'in_progress').length;
  const completedCount = jobBags.filter((j) => j.status === 'completed').length;

  async function handleCreate() {
    if (!appUser) return;
    setIsCreating(true);
    try {
      const { data, error } = await supabase.rpc("create_job_bag", {
        p_company_id: appUser.company_id,
        p_job_bag_number: form.job_bag_number,
        p_product_category: form.product_category,
        p_design_code: form.design_code,
        p_gold_expected_weight_g: Number(form.gold_expected_weight_g) || 0,
        p_diamond_expected_weight_cts: Number(form.diamond_expected_weight_cts) || 0,
        p_karigar_id: form.karigar_id,
        p_issue_date: form.issue_date,
        p_expected_return_date: form.expected_return_date,
        p_created_by: appUser.user_id
      });

      if (error) throw error;

      toast.success("Job Bag Created Successfully");
      setIsOpen(false);
      fetchData();
      router.push(`/manufacturing/job-bags/${data}`);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsCreating(false);
    }
  }

  const filtered = jobBags.filter((j) => {
    const matchSearch = j.job_bag_number.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" ? true : j.status === statusFilter;
    return matchSearch && matchStatus;
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
          <Button variant="ghost" size="sm" className="h-8 px-2 text-xs font-medium text-muted-foreground" onClick={fetchData}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
          <Separator orientation="vertical" className="h-4 mx-1" />
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
          
          <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild>
              <Button className="h-10 px-6 font-bold text-xs uppercase tracking-widest shadow-md bg-foreground text-background hover:bg-foreground/90 w-full md:w-auto transition-transform active:scale-95">
                <Plus className="mr-2 h-4 w-4" /> New Production Bag
              </Button>
            </SheetTrigger>
            <SheetContent className="w-full sm:max-w-[500px] p-0 border-none shadow-2xl">
              <SheetHeader className="bg-secondary/50 p-6 border-b">
                <SheetTitle className="text-lg font-bold">Initialize Job Bag</SheetTitle>
                <SheetDescription className="text-xs font-medium uppercase tracking-tight">Create a unique identifier for artisan work.</SheetDescription>
              </SheetHeader>
              
              <div className="p-6 space-y-6 overflow-y-auto max-h-[calc(100vh-140px)]">
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-bold text-muted-foreground uppercase">Unique Ref #</Label>
                    <Input placeholder="e.g. JB-9921" className="h-9 text-sm border-border bg-muted/20 focus-visible:bg-background" value={form.job_bag_number} onChange={(e) => setForm({ ...form, job_bag_number: e.target.value })} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-bold text-muted-foreground uppercase">Item Category</Label>
                      <Input placeholder="Rings, Chains..." className="h-9 text-sm border-border bg-muted/20" value={form.product_category} onChange={(e) => setForm({ ...form, product_category: e.target.value })} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-bold text-muted-foreground uppercase">Design ID</Label>
                      <Input placeholder="DS-500" className="h-9 text-sm border-border bg-muted/20" value={form.design_code} onChange={(e) => setForm({ ...form, design_code: e.target.value })} />
                    </div>
                  </div>
                  <Separator />
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-tighter">Est. Gold Mass (g)</Label>
                      <Input type="number" className="h-9 text-sm border-border bg-muted/20 font-bold" value={form.gold_expected_weight_g} onChange={(e) => setForm({ ...form, gold_expected_weight_g: e.target.value })} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-tighter">Est. Diamond (ct)</Label>
                      <Input type="number" className="h-9 text-sm border-border bg-muted/20 font-bold" value={form.diamond_expected_weight_cts} onChange={(e) => setForm({ ...form, diamond_expected_weight_cts: e.target.value })} />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-bold text-muted-foreground uppercase">Target Artisan (Karigar)</Label>
                    <Select onValueChange={(v) => setForm({ ...form, karigar_id: v })}>
                      <SelectTrigger className="h-9 text-sm border-border bg-muted/20">
                        <SelectValue placeholder="Identify Karigar..." />
                      </SelectTrigger>
                      <SelectContent>
                        {karigars.map((k) => <SelectItem key={k.id} value={k.id} className="text-xs">{k.full_name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-bold text-muted-foreground uppercase">Dispatch Date</Label>
                      <Input type="date" className="h-9 text-sm border-border bg-muted/20" onChange={(e) => setForm({ ...form, issue_date: e.target.value })} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-bold text-muted-foreground uppercase">Expected Return</Label>
                      <Input type="date" className="h-9 text-sm border-border bg-muted/20" onChange={(e) => setForm({ ...form, expected_return_date: e.target.value })} />
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

        {/* SEARCH & FILTERS */}
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1 group">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground group-focus-within:text-primary transition-colors" />
            <Input
              placeholder="Search by Job ID or Reference..."
              className="pl-8 h-9 text-xs bg-muted/20 border-border focus-visible:bg-background"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2 bg-secondary/50 p-1 rounded-md border border-border">
            <div className="pl-2 pr-1"><Filter className="w-3 h-3 text-muted-foreground" /></div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-7 border-none bg-transparent shadow-none text-xs font-bold w-full md:w-40 focus:ring-0">
                <SelectValue placeholder="Lifecycle Filter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">All Orders</SelectItem>
                <SelectItem value="open" className="text-xs">Awaiting Issue</SelectItem>
                <SelectItem value="in_progress" className="text-xs">Under Fabrication</SelectItem>
                <SelectItem value="completed" className="text-xs">Finished / Audit</SelectItem>
                <SelectItem value="closed" className="text-xs">Archived</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* JOB BAGS LIST - RESPONSIVE */}
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
                          <div className="flex items-center gap-2">
                             <User className="h-3 w-3" />
                             <span className="font-semibold text-gray-900">{job.karigars?.full_name}</span>
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

        <div className="flex items-start gap-3 px-4 py-3 rounded-lg bg-secondary/30 border border-border">
          <Info className="h-4 w-4 text-muted-foreground mt-0.5" />
          <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-tight leading-relaxed">
            Initializing a Job Bag allocates raw materials from main inventory into manufacturing transit. Reconcile mass changes upon completion to finalize ledger updates.
          </p>
        </div>

      </main>
    </div>
  );
}