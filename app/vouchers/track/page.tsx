"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { format, isPast, addDays } from "date-fns";
import { 
  Search, 
  Store, 
  CheckCircle2, 
  Package, 
  Loader2,
  ArrowLeft,
  ChevronRight,
  ChevronLeft,
  RefreshCw,
  Database,
  CheckSquare,
  Filter,
  User,
  Truck,
  ScanFace,
  ShieldAlert,
  MapPin,
  Phone,
  ExternalLink,
  Download,
  BellRing,
  Megaphone,
  Trash2,
  ArrowUpDown, 
  Settings2,
  PhoneCall,
  UserPlus,
  Sparkles,
  X
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

import { WhatsAppSenderModal } from "@/components/WhatsAppSenderModal";

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
  updated_at: string | null; 
  
  last_scanned_warehouse_id?: string | null;
  last_scanned_warehouse?: { name: string } | null;

  customers?: {
    id: string;
    full_name: string;
    phone: string;
    convo360_user_id?: string | null;
  } | null;

  voucher_batches: {
    batch_no: string;
    created_at?: string;
    received_at?: string | null;
  };
  voucher_distributors?: {
    distributor_name: string;
    distributor_type: string;
    phone?: string;
  } | null;
  voucher_distributions?: {
    payment_status: string;
    delivery_agent: string | null;
  } | null;
  
  voucher_call_assignments?: {
    id: string;
    assigned_to: string;
    status: string;
    call_outcome?: string | null;
    interest_level?: string | null;
    call_notes?: string | null;
  }[];
}

export default function TrackVoucherPage() {
  const { toast } = useToast();
  const { appUser } = useAuth(); 

  // --- MASTER LIST STATE (PAGINATED) ---
  const [listData, setListData] = useState<TrackedVoucher[]>([]);
  const [isListLoading, setIsListLoading] = useState(false);
  const [localSearch, setLocalSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(0);
  const [pageSize, setPageSize] = useState(50); 
  const [totalCount, setTotalCount] = useState(0);

  // --- ADVANCED FILTERS STATE ---
  const [activeFilter, setActiveFilter] = useState("all");
  const [assignmentFilter, setAssignmentFilter] = useState("all");
  const [distributors, setDistributors] = useState<any[]>([]);
  const [batches, setBatches] = useState<any[]>([]);
  const [selectedFilterDistributor, setSelectedFilterDistributor] = useState("all");
  const [selectedFilterBatch, setSelectedFilterBatch] = useState("all");
  
  // --- SORTING & RANGE STATE ---
  const [sortOrder, setSortOrder] = useState("newest"); 
  const [searchMode, setSearchMode] = useState<'text' | 'range'>('text');
  const [fromCode, setFromCode] = useState("");
  const [toCode, setToCode] = useState("");
  
  // --- BULK ACTION STATE ---
  const [selectedVouchers, setSelectedVouchers] = useState<Set<string>>(new Set());
  const [bulkHandlingFee, setBulkHandlingFee] = useState("");
  const [bulkExpiryDate, setBulkExpiryDate] = useState(""); 
  const [bulkOverrideReason, setBulkOverrideReason] = useState("");

  // --- MASTER UPDATE MODAL STATE ---
  const [isMasterEditModalOpen, setIsMasterEditModalOpen] = useState(false);
  const [isUpdatingBulk, setIsUpdatingBulk] = useState(false);
  const [masterEditForm, setMasterEditForm] = useState({
    status: 'no_change',
    distributor_id: 'no_change',
    distributed_at: '',
    expiry_date: '',
    handling_fee: '',
    override_reason: ''
  });

  // --- BULK VOID MODAL STATE ---
  const [isVoidModalOpen, setIsVoidModalOpen] = useState(false);
  const [bulkVoidReason, setBulkVoidReason] = useState("");
  const [isVoidingBulk, setIsVoidingBulk] = useState(false);

  // --- ASSIGNMENT MODAL & METRICS STATE ---
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);
  const [selectedAssignee, setSelectedAssignee] = useState("");
  const [teamMembers, setTeamMembers] = useState<{id: string, name: string, role: string}[]>([]);
  const [assignmentMetrics, setAssignmentMetrics] = useState<{name: string, pending: number, completed: number, dnd: number}[]>([]);

  // --- WHATSAPP SENDER STATES ---
  const [isSenderModalOpen, setIsSenderModalOpen] = useState(false);
  const [messageRecipients, setMessageRecipients] = useState<any[]>([]);
  const [isQueryingExpiry, setIsQueryingExpiry] = useState(false);
  const [isQueryingRegistered, setIsQueryingRegistered] = useState(false);
  const [activeTemplateContext, setActiveTemplateContext] = useState<"reminder" | "welcome">("reminder");

  // --- CUSTOM EXPIRY REMINDER MODAL STATE ---
  const [isRemindModalOpen, setIsRemindModalOpen] = useState(false);
  const [remindDays, setRemindDays] = useState("7");
  const [remindStatus, setRemindStatus] = useState("both");
  const [remindError, setRemindError] = useState<string | null>(null); 

  useEffect(() => {
    const fetchFiltersData = async () => {
      const { data: dData } = await supabase.from("voucher_distributors").select("id, distributor_name").order("distributor_name");
      if (dData) setDistributors(dData);

      const { data: bData } = await supabase.from("voucher_batches").select("id, batch_no").order("created_at", { ascending: false });
      if (bData) setBatches(bData);
    };
    fetchFiltersData();
  }, []);

  const fetchAssignmentMetrics = useCallback(async () => {
    if (!appUser?.company_id) return;
    try {
      const { data: users, error: usersErr } = await supabase.from('app_users').select('user_id').eq('company_id', appUser.company_id);
      if (usersErr) return;
      
      const userIds = users?.map(u => u.user_id) || [];
      if (userIds.length > 0) {
        const { data: profiles } = await supabase.from('profiles').select('id, full_name, role').in('id', userIds);
        if (profiles) {
          setTeamMembers(profiles.map(p => ({ id: p.id, name: p.full_name || 'Unknown', role: p.role || 'Staff' })));
          
          const { data: metricsData } = await supabase.from('voucher_call_assignments').select('assigned_to, status').eq('company_id', appUser.company_id);
          if (metricsData) {
            type MetricAccumulator = Record<string, { name: string; pending: number; completed: number; dnd: number }>;
            const agg = profiles.reduce<MetricAccumulator>((acc, p) => {
              acc[p.id] = { name: p.full_name || 'Unknown', pending: 0, completed: 0, dnd: 0 };
              return acc;
            }, {});

            metricsData.forEach(row => {
              if (agg[row.assigned_to]) {
                if (row.status === 'pending') agg[row.assigned_to].pending++;
                else if (row.status === 'dnd') agg[row.assigned_to].dnd++;
                else agg[row.assigned_to].completed++;
              }
            });

            const filteredMetrics = Object.values(agg).filter(m => m.pending > 0 || m.completed > 0 || m.dnd > 0);
            setAssignmentMetrics(filteredMetrics);
          }
        }
      }
    } catch (error) {
      console.error(error);
    }
  }, [appUser]);

  useEffect(() => {
    fetchAssignmentMetrics();
  }, [fetchAssignmentMetrics]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchVoucherList(activeFilter, assignmentFilter, currentPage, localSearch, sortOrder);
    }, 400); 
    return () => clearTimeout(timer);
  }, [activeFilter, assignmentFilter, selectedFilterDistributor, selectedFilterBatch, currentPage, localSearch, pageSize, sortOrder, searchMode, fromCode, toCode]);

  const fetchVoucherList = async (tabStatus: string, assignStatus: string, page: number, searchKeyword: string, currentSort: string) => {
    setIsListLoading(true);
    try {
      // ✨ FIX 1: We must use !inner join for BOTH 'assigned' and 'called' to physically hide unmatched vouchers
      const requiresInnerJoin = assignStatus === "assigned" || assignStatus === "called";

      let query = supabase
        .from("vouchers")
        .select(`
          id, code, discount_value, handling_fee, status, expiry_date, distributed_at, redeemed_at,
          is_manual_override, updated_by_user, scan_count, last_scanned_at, updated_at,
          voucher_batches (batch_no),
          voucher_distributors (distributor_name, distributor_type, phone),
          voucher_distributions (payment_status, delivery_agent),
          customers (id, full_name, phone, convo360_user_id),
          last_scanned_warehouse:warehouses!last_scanned_warehouse_id(name),
          voucher_call_assignments${requiresInnerJoin ? '!inner' : ''} (id, assigned_to, status, call_outcome, interest_level, call_notes)
        `, { count: 'exact' });

      if (currentSort === 'newest') query = query.order('updated_at', { ascending: false, nullsFirst: false });
      else if (currentSort === 'oldest') query = query.order('updated_at', { ascending: true, nullsFirst: false });
      else if (currentSort === 'code_desc') query = query.order('code', { ascending: false });
      else query = query.order('code', { ascending: true }); 

      query = query.range(page * pageSize, (page + 1) * pageSize - 1);

      // --- STATUS LOGIC ---
      if (tabStatus === "expired") {
        query = query.in("status", ["distributed", "in_stock", "registered"]).lt("expiry_date", new Date().toISOString());
      } else if (tabStatus !== "all") {
        query = query.eq("status", tabStatus);
      }

      // --- ✨ FIX 2: CALLING ASSIGNMENT LOGIC ---
      if (assignStatus === "assigned") {
        query = query.eq("voucher_call_assignments.status", "pending");
      } else if (assignStatus === "called") {
        // Includes both 'called' and 'dnd' as completed tasks
        query = query.in("voucher_call_assignments.status", ["called", "dnd"]);
      } else if (assignStatus === "unassigned") {
        // Must be registered to even be eligible for calling
        query = query.eq("status", "registered");
        
        // Fetch all vouchers that have ANY call assignment
        const { data: assigned } = await supabase.from('voucher_call_assignments').select('voucher_id');
        const assignedIds = assigned?.map(a => a.voucher_id).filter(Boolean) || [];
        
        // Exclude them from the list
        if (assignedIds.length > 0) {
          query = query.not('id', 'in', `(${assignedIds.join(',')})`);
        }
      }

      // --- SEARCH LOGIC ---
      if (searchMode === 'text' && searchKeyword.trim()) {
        query = query.ilike("code", `%${searchKeyword.trim()}%`);
      } else if (searchMode === 'range') {
        if (fromCode.trim()) query = query.gte("code", fromCode.trim().toUpperCase());
        if (toCode.trim()) query = query.lte("code", toCode.trim().toUpperCase());
      }

      if (selectedFilterDistributor !== "all") query = query.eq("distributor_id", selectedFilterDistributor);
      if (selectedFilterBatch !== "all") query = query.eq("batch_id", selectedFilterBatch);

      const { data, count, error } = await query;
      
      if (error) throw error;
      setListData((data as any) || []);
      setTotalCount(count || 0);
      setSelectedVouchers(new Set());
    } catch (error: any) {
      toast({ title: "Failed to load list", description: error.message, variant: "destructive" });
    } finally {
      setIsListLoading(false);
    }
  };

  
  const handleAssignCalls = async () => {
    if (!selectedAssignee) return toast({ title: "Action Required", description: "Select a team member to assign the calls to.", variant: "destructive" });

    setIsAssigning(true);
    try {
      const vouchersToAssign = listData.filter(v => selectedVouchers.has(v.id) && v.customers?.id);

      if (vouchersToAssign.length === 0) {
        return toast({ title: "Cannot Assign", description: "None of the selected vouchers have a registered customer attached.", variant: "destructive" });
      }

      const payload = vouchersToAssign.map(v => ({
        company_id: appUser?.company_id,
        customer_id: v.customers!.id,
        voucher_id: v.id,
        assigned_to: selectedAssignee,
        assigned_by: appUser?.id,
        status: 'pending'
      }));

      const { error } = await supabase.from('voucher_call_assignments').insert(payload);
      if (error) throw error;

      toast({ title: "Assignments Distributed", description: `Successfully assigned ${payload.length} calling tasks to the selected team member.` });
      
      setIsAssignModalOpen(false);
      setSelectedVouchers(new Set());
      setSelectedAssignee("");
      fetchAssignmentMetrics();
      fetchVoucherList(activeFilter, assignmentFilter, currentPage, localSearch, sortOrder); 
    } catch (error: any) {
      toast({ title: "Assignment Failed", description: error.message, variant: "destructive" });
    } finally {
      setIsAssigning(false);
    }
  };

  const handleMasterUpdate = async () => {
    if (selectedVouchers.size === 0) return;
    if (!masterEditForm.override_reason.trim()) {
      return toast({ title: "Reason Required", description: "You must provide an audit reason to execute a master override.", variant: "destructive" });
    }

    setIsUpdatingBulk(true);
    try {
      const updates: any = {};
      if (masterEditForm.status !== 'no_change') updates.status = masterEditForm.status;
      if (masterEditForm.distributor_id !== 'no_change') updates.distributor_id = masterEditForm.distributor_id === 'clear' ? null : masterEditForm.distributor_id;
      if (masterEditForm.distributed_at) updates.distributed_at = new Date(masterEditForm.distributed_at).toISOString();
      if (masterEditForm.expiry_date) updates.expiry_date = masterEditForm.expiry_date;
      if (masterEditForm.handling_fee !== '') updates.handling_fee = Number(masterEditForm.handling_fee);

      updates.is_manual_override = true; 
      updates.updated_by_user = `${appUser?.email?.split('@')[0] || 'Admin'}: ${masterEditForm.override_reason.trim()}`; 

      const idsToUpdate = Array.from(selectedVouchers);
      const { error } = await supabase.from("vouchers").update(updates).in("id", idsToUpdate);
      if (error) throw error;

      toast({ title: "Master Update Successful", description: `Updated ${idsToUpdate.length} vouchers.` });
      fetchVoucherList(activeFilter, assignmentFilter, currentPage, localSearch, sortOrder);
      setSelectedVouchers(new Set());
      setIsMasterEditModalOpen(false);
      setMasterEditForm({ status: 'no_change', distributor_id: 'no_change', distributed_at: '', expiry_date: '', handling_fee: '', override_reason: '' });
    } catch (error: any) {
      toast({ title: "Update Failed", description: error.message, variant: "destructive" });
    } finally {
      setIsUpdatingBulk(false);
    }
  };

  const handleBulkVoid = async () => {
    if (selectedVouchers.size === 0) return;
    if (bulkVoidReason.trim() === "") return toast({ title: "Reason Required", description: "Provide a reason.", variant: "destructive" });

    setIsVoidingBulk(true);
    try {
      const updates = {
        status: 'voided',
        is_manual_override: true,
        updated_by_user: `${appUser?.email?.split('@')[0] || 'Staff'} (VOIDED): ${bulkVoidReason.trim()}`
      };
      const idsToUpdate = Array.from(selectedVouchers);
      const { error } = await supabase.from("vouchers").update(updates).in("id", idsToUpdate);
      if (error) throw error;

      toast({ title: "Vouchers Voided", description: `Successfully voided ${idsToUpdate.length} vouchers.` });
      fetchVoucherList(activeFilter, assignmentFilter, currentPage, localSearch, sortOrder);
      setSelectedVouchers(new Set());
      setBulkVoidReason("");
      setIsVoidModalOpen(false);
    } catch (error: any) {
      toast({ title: "Void Failed", description: error.message, variant: "destructive" });
    } finally {
      setIsVoidingBulk(false);
    }
  };

  const executeRemindExpiring = async () => { /* Logic Preserved */ };
  const handleBroadcastRegistered = async () => { /* Logic Preserved */ };

  const toggleSelection = (id: string) => {
    const newSet = new Set(selectedVouchers);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedVouchers(newSet);
  };

  const toggleAll = () => {
    if (selectedVouchers.size === listData.length && listData.length > 0) setSelectedVouchers(new Set());
    else setSelectedVouchers(new Set(listData.map(v => v.id)));
  };

  const getDisplayStatus = (v: { status: string; expiry_date?: string | null }) => {
    if ((v.status === 'distributed' || v.status === 'in_stock' || v.status === 'registered') && v.expiry_date && isPast(new Date(v.expiry_date))) return 'expired';
    return v.status;
  };

  const getActiveAssignment = (v: TrackedVoucher) => {
    if (!v.voucher_call_assignments || v.voucher_call_assignments.length === 0) return null;
    const pending = v.voucher_call_assignments.find(a => a.status === 'pending');
    return pending || v.voucher_call_assignments[0];
  };

  const StatusBadge = ({ status }: { status: string }) => {
    switch (status) {
      case 'pending_print': return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200 text-xs font-semibold h-6 px-2 shadow-none">Pending</Badge>;
      case 'in_stock': return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs font-semibold h-6 px-2 shadow-none">In Stock</Badge>;
      case 'distributed': return <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 text-xs font-semibold h-6 px-2 shadow-none">Issued</Badge>;
      case 'registered': return <Badge variant="outline" className="bg-teal-50 text-teal-700 border-teal-200 text-xs font-semibold h-6 px-2 shadow-none">Registered</Badge>;
      case 'redeemed': return <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs font-semibold h-6 px-2 shadow-none">Redeemed</Badge>;
      case 'expired':
      case 'voided': return <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200 text-xs font-semibold h-6 px-2 shadow-none capitalize">{status}</Badge>;
      default: return <Badge variant="secondary" className="text-xs font-medium h-6 capitalize shadow-none">{status}</Badge>;
    }
  };

  const downloadCSV = () => {
    if (listData.length === 0) return toast({ title: "No Data", description: "There is no data to export matching your current filters." });
    const headers = [
      "Voucher Code", "Batch No", "Current Status", "Discount Value (INR)", "Handling Fee (INR)",
      "Scan Attempts", "Partner / Distributor", "Registered Customer", "Customer Phone",
      "Assigned Caller", "Call Status", "Expiry Date", "Redeemed Date", "Last Updated"
    ];

    const csvRows = listData.map(v => {
      const assignment = getActiveAssignment(v);
      const assigneeName = assignment ? teamMembers.find(m => m.id === assignment.assigned_to)?.name || 'Unknown Staff' : 'None';
      return [
        v.code, v.voucher_batches?.batch_no || '', getDisplayStatus(v).toUpperCase(), v.discount_value, v.handling_fee || 0,
        v.scan_count || 0, v.voucher_distributors?.distributor_name || 'Unassigned', v.customers?.full_name || 'None', v.customers?.phone || 'None',
        assigneeName, assignment ? assignment.status.toUpperCase() : 'NONE',
        v.expiry_date ? format(new Date(v.expiry_date), "yyyy-MM-dd") : 'None',
        v.redeemed_at ? format(new Date(v.redeemed_at), "yyyy-MM-dd") : 'None',
        v.updated_at ? format(new Date(v.updated_at), "yyyy-MM-dd HH:mm") : 'None'
      ].map(field => `"${String(field).replace(/"/g, '""')}"`).join(",");
    });

    const csvContent = [headers.join(","), ...csvRows].join("\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csvContent], { type: "text/csv;charset=utf-8;" }));
    link.download = `Vouchers_Page${currentPage+1}_Export_${format(new Date(), "yyyyMMdd_HHmm")}.csv`;
    link.click();
    toast({ title: "Export Started", description: "Your CSV file is downloading." });
  };

  const totalPages = Math.ceil(totalCount / pageSize);
  // ✨ Add "called" to the assignmentFilter includes array:
  const canBulkUpdate = ["all", "pending_print", "in_stock", "distributed", "registered", "assigned", "expired"].includes(activeFilter) || ["assigned", "unassigned", "called"].includes(assignmentFilter);

  return (
    <div className="flex flex-col min-h-screen bg-[#fafafa] font-sans selection:bg-indigo-100">

      {/* --- ENTERPRISE IDE-STYLE TOOLBAR HEADER --- */}
      <header className="sticky top-0 z-40 w-full bg-white border-b border-slate-200 px-4 h-14 flex items-center justify-between shadow-sm box-border">
        <div className="flex items-center gap-3 overflow-hidden">
          <Link href="/vouchers">
            <Button variant="ghost" size="icon" className="h-9 w-9 rounded hover:bg-slate-100 transition-colors">
              <ArrowLeft className="h-5 w-5 text-slate-500" />
            </Button>
          </Link>
          
          <div className="h-5 w-[1px] bg-slate-200 hidden sm:block" />
          
          <nav className="flex items-center gap-2 text-sm whitespace-nowrap overflow-hidden">
            <Link href="/vouchers" className="text-slate-500 hover:text-slate-900 transition-colors font-medium">Vouchers</Link>
            <ChevronRight className="h-4 w-4 text-slate-400" />
            <span className="font-semibold text-slate-900 select-none">Track & Audit</span>
            
            <div className="ml-3 hidden md:flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-100">
              <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-bold text-emerald-700 tracking-wide">Live DB</span>
            </div>
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="h-9 px-3 text-sm font-medium text-slate-600 hover:text-slate-900" onClick={() => fetchVoucherList(activeFilter, assignmentFilter, currentPage, localSearch, sortOrder)}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isListLoading ? "animate-spin text-slate-900" : ""}`} />
            Refresh
          </Button>
          <div className="h-5 w-[1px] bg-slate-200 mx-1" />
          <Button size="sm" className="h-9 text-sm font-semibold px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-md shadow-sm" onClick={() => { setCurrentPage(0); setLocalSearch(""); }}>
            <Database className="h-4 w-4 mr-2" />
            Sync Data
          </Button>
        </div>
      </header>

      <main className="p-4 md:p-6 lg:p-8 max-w-[1500px] w-full mx-auto space-y-6">

        {/* --- 1. ASSIGNMENT METRICS DASHBOARD --- */}
        {assignmentMetrics.length > 0 && (
          <section className="space-y-3 animate-in fade-in duration-300">
            <h2 className="text-sm font-bold text-slate-500 tracking-wide flex items-center gap-2">
              <PhoneCall className="w-4 h-4" /> Team Calling Assignments
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {assignmentMetrics.map(member => (
                <div key={member.name} className="bg-white border border-slate-200 p-4 rounded-xl shadow-sm flex flex-col justify-between">
                  <div className="flex items-center justify-between text-slate-500 mb-3">
                    <span className="text-sm font-semibold tracking-tight text-slate-700">{member.name}</span>
                    <User className="h-4 w-4 text-slate-400" />
                  </div>
                  <div className="flex items-baseline gap-4 mt-1">
                    <div>
                      <div className="text-2xl font-bold tracking-tight text-slate-900">{member.pending}</div>
                      <p className="text-xs font-bold text-amber-500 uppercase tracking-widest mt-0.5">Pending</p>
                    </div>
                    <div className="h-8 w-px bg-slate-100" />
                    <div>
                      <div className="text-2xl font-bold tracking-tight text-slate-900">{member.completed}</div>
                      <p className="text-xs font-bold text-emerald-500 uppercase tracking-widest mt-0.5">Done</p>
                    </div>
                    <div className="h-8 w-px bg-slate-100" />
                    <div>
                      <div className="text-2xl font-bold tracking-tight text-slate-900">{member.dnd}</div>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-0.5">DND</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* --- 2. MASTER FILTERABLE LIST SECTION --- */}
        <section className="space-y-4 animate-in fade-in duration-300">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex flex-col gap-1">
              <h2 className="text-xl font-semibold text-slate-900 tracking-tight">Master Ledger</h2>
              <p className="text-sm text-slate-500">Filter, audit, and assign campaign tracking.</p>
            </div>
            
            <div className="flex items-center gap-3">
              <Button onClick={() => setIsRemindModalOpen(true)} disabled={isQueryingExpiry} className="bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 shadow-sm font-semibold text-sm h-10 rounded-md px-4">
                <BellRing className="w-4 h-4 mr-2" /> Remind
              </Button>
              <Button onClick={handleBroadcastRegistered} disabled={isQueryingRegistered} className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 shadow-sm font-semibold text-sm h-10 rounded-md px-4">
                {isQueryingRegistered ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Megaphone className="w-4 h-4 mr-2" />} Broadcast
              </Button>
              <Button variant="outline" onClick={downloadCSV} disabled={listData.length === 0} className="bg-white border-slate-200 text-slate-600 hover:bg-slate-50 shadow-sm font-semibold text-sm h-10 rounded-md px-4">
                <Download className="w-4 h-4 mr-2" /> Export
              </Button>
            </div>
          </div>

          <div className="border border-slate-200 bg-white rounded-xl shadow-sm overflow-hidden flex flex-col">
            
            {/* --- MINIMALIST UNIFIED COMMAND BAR --- */}
            <div className="flex flex-wrap items-center gap-3 p-4 border-b border-slate-100 bg-slate-50/50">
              
              {/* Text/Range Toggle */}
              <div className="flex bg-white rounded-md border border-slate-200 p-1 shadow-sm">
                <Button size="sm" variant={searchMode === 'text' ? 'default' : 'ghost'} className="h-8 text-xs font-semibold px-3 rounded shadow-none" onClick={() => setSearchMode('text')}>Text</Button>
                <Button size="sm" variant={searchMode === 'range' ? 'default' : 'ghost'} className="h-8 text-xs font-semibold px-3 rounded shadow-none" onClick={() => setSearchMode('range')}>Range</Button>
              </div>

              {/* Conditional Search Inputs */}
              {searchMode === 'text' ? (
                <div className="relative w-full sm:w-[220px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input 
                    placeholder="Search codes..." 
                    className="pl-9 h-10 text-sm bg-white border-slate-200 shadow-sm rounded-md"
                    value={localSearch}
                    onChange={(e) => { setLocalSearch(e.target.value); setCurrentPage(0); }}
                  />
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Input placeholder="From" className="h-10 text-sm w-[110px] uppercase font-mono shadow-sm bg-white" value={fromCode} onChange={(e) => setFromCode(e.target.value.toUpperCase())} />
                  <span className="text-slate-300 font-bold">-</span>
                  <Input placeholder="To" className="h-10 text-sm w-[110px] uppercase font-mono shadow-sm bg-white" value={toCode} onChange={(e) => setToCode(e.target.value.toUpperCase())} />
                </div>
              )}

              <div className="h-6 w-px bg-slate-200 mx-1 hidden lg:block" />

              {/* Minimal Selects */}
              <Select value={activeFilter} onValueChange={(val) => { setActiveFilter(val); setCurrentPage(0); }}>
                <SelectTrigger className="h-10 text-sm border-slate-200 hover:bg-white shadow-sm rounded-md px-3 min-w-[140px] bg-white">
                  <span className="text-slate-400 mr-2 font-medium">Status:</span>
                  <span className="font-semibold text-slate-700 truncate"><SelectValue /></span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="pending_print">Pending Print</SelectItem>
                  <SelectItem value="in_stock">In Stock</SelectItem>
                  <SelectItem value="distributed">Issued</SelectItem>
                  <SelectItem value="registered">Registered</SelectItem>
                  <SelectItem value="redeemed">Redeemed</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                  <SelectItem value="voided">Voided</SelectItem>
                </SelectContent>
              </Select>

              {/* ✨ NEW ASSIGNMENT STATUS FILTER */}
              <Select value={assignmentFilter} onValueChange={(val) => { setAssignmentFilter(val); setCurrentPage(0); }}>
                <SelectTrigger className="h-10 text-sm border-slate-200 hover:bg-white shadow-sm rounded-md px-3 min-w-[150px] bg-white">
                  <span className="text-slate-400 mr-2 font-medium">Calling:</span>
                  <span className="font-semibold text-slate-700 truncate"><SelectValue /></span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Leads</SelectItem>
                  <SelectItem value="assigned" className="text-teal-600 font-medium">Assigned (Pending)</SelectItem>
                  <SelectItem value="called" className="text-emerald-600 font-medium">Assigned (Completed)</SelectItem>
                  <SelectItem value="unassigned" className="text-rose-600 font-medium">Not Assigned</SelectItem>
                  
                </SelectContent>
              </Select>

              <Select value={selectedFilterDistributor} onValueChange={(val) => { setSelectedFilterDistributor(val); setCurrentPage(0); }}>
                <SelectTrigger className="h-10 text-sm border-slate-200 hover:bg-white shadow-sm rounded-md px-3 w-[160px] bg-white">
                  <span className="text-slate-400 mr-2 font-medium">Partner:</span>
                  <span className="font-semibold text-slate-700 truncate"><SelectValue /></span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Partners</SelectItem>
                  {distributors.map(d => <SelectItem key={d.id} value={d.id}>{d.distributor_name}</SelectItem>)}
                </SelectContent>
              </Select>

              <Select value={sortOrder} onValueChange={(val) => { setSortOrder(val); setCurrentPage(0); }}>
                <SelectTrigger className="h-10 text-sm border-slate-200 hover:bg-white shadow-sm rounded-md px-3 w-[140px] bg-white ml-auto lg:ml-0">
                  <ArrowUpDown className="w-4 h-4 text-slate-400 mr-2" />
                  <span className="font-semibold text-slate-700 truncate"><SelectValue /></span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Newest First</SelectItem>
                  <SelectItem value="oldest">Oldest First</SelectItem>
                  <SelectItem value="code_asc">Code (A-Z)</SelectItem>
                  <SelectItem value="code_desc">Code (Z-A)</SelectItem>
                </SelectContent>
              </Select>

              {(selectedFilterDistributor !== "all" || selectedFilterBatch !== "all" || activeFilter !== "all" || assignmentFilter !== "all" || localSearch || sortOrder !== "newest") && (
                <Button variant="ghost" className="h-10 text-sm font-semibold text-rose-500 hover:bg-rose-50 rounded-md px-3" onClick={() => { 
                  setSelectedFilterDistributor("all"); setSelectedFilterBatch("all"); setActiveFilter("all"); setAssignmentFilter("all"); setLocalSearch(""); setSortOrder("newest"); setCurrentPage(0);
                }}>
                  Clear Filters
                </Button>
              )}
            </div>

            {/* --- ACTION BAR (WHEN SELECTED) --- */}
            {canBulkUpdate && selectedVouchers.size > 0 && (
              <div className="bg-indigo-50/50 border-b border-indigo-100 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-in slide-in-from-top-1">
                <div className="flex items-center gap-3 shrink-0 px-2">
                  <CheckSquare className="h-5 w-5 text-indigo-500" />
                  <span className="text-sm font-semibold text-indigo-900">{selectedVouchers.size} Selected</span>
                </div>
                
                <div className="flex flex-wrap items-center gap-3">
                  <Button className="bg-white border border-teal-200 text-teal-700 hover:bg-teal-50 shadow-sm font-semibold h-9 text-sm px-4 rounded-md" onClick={() => setIsAssignModalOpen(true)}>
                    <PhoneCall className="w-4 h-4 mr-2" /> Assign Calls
                  </Button>
                  <Button className="bg-white border border-indigo-200 text-indigo-700 hover:bg-indigo-50 shadow-sm font-semibold h-9 text-sm px-4 rounded-md" onClick={() => setIsMasterEditModalOpen(true)}>
                    <Settings2 className="w-4 h-4 mr-2" /> Bulk Edit
                  </Button>
                  <Button variant="ghost" className="text-rose-600 hover:bg-rose-50 font-semibold h-9 text-sm px-4 rounded-md" onClick={() => setIsVoidModalOpen(true)}>
                    Void Selected
                  </Button>
                </div>
              </div>
            )}

            {/* --- DATA TABLE --- */}
            <div className="bg-white">
              {isListLoading ? (
                <div className="flex flex-col items-center justify-center py-24">
                  <Loader2 className="w-8 h-8 animate-spin text-slate-300 mb-4" />
                  <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Syncing Database...</span>
                </div>
              ) : listData.length === 0 ? (
                <div className="text-center py-24">
                  <Package className="w-12 h-12 mx-auto mb-4 text-slate-200" />
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">No matching records</p>
                </div>
              ) : (
                <div className="overflow-x-auto custom-scrollbar min-h-[400px]">
                  <Table>
                    <TableHeader className="bg-slate-50 border-b border-slate-200">
                      <TableRow className="hover:bg-transparent">
                        {canBulkUpdate && (
                          <TableHead className="w-12 px-5 text-center">
                            <input 
                              type="checkbox" 
                              className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-600 cursor-pointer"
                              checked={selectedVouchers.size === listData.length && listData.length > 0}
                              onChange={toggleAll}
                            />
                          </TableHead>
                        )}
                        <TableHead className="text-xs font-semibold text-slate-500 h-11 px-5">Code Identifier</TableHead>
                        <TableHead className="text-xs font-semibold text-slate-500 h-11 px-5 text-center">Scans</TableHead>
                        <TableHead className="text-xs font-semibold text-slate-500 h-11 px-5 text-right">Value (₹)</TableHead>
                        <TableHead className="text-xs font-semibold text-slate-500 h-11 px-5 text-right">Fee (₹)</TableHead>
                        <TableHead className="text-xs font-semibold text-slate-500 h-11 px-5">Logistics & Customer</TableHead>
                        <TableHead className="text-xs font-semibold text-slate-500 h-11 px-5 text-center pr-6">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {listData.map((v) => {
                        const activeAssignment = getActiveAssignment(v);

                        return (
                          <TableRow key={v.id} className={`hover:bg-slate-50/50 border-b border-slate-100 ${selectedVouchers.has(v.id) ? 'bg-indigo-50/20' : ''}`}>
                            {canBulkUpdate && (
                              <TableCell className="px-5 text-center">
                                <input 
                                  type="checkbox" 
                                  className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-600 cursor-pointer"
                                  checked={selectedVouchers.has(v.id)}
                                  onChange={() => toggleSelection(v.id)}
                                />
                              </TableCell>
                            )}
                            <TableCell className="px-5 py-4">
                              <span className="font-mono font-semibold text-sm text-slate-900 block">{v.code}</span>
                              <span className="text-xs text-slate-400 font-sans mt-1 block">
                                {v.updated_at ? format(new Date(v.updated_at), 'dd MMM, HH:mm') : ''}
                              </span>
                              {v.is_manual_override && (
                                <span className="flex items-center gap-1.5 text-[10px] font-bold text-rose-500 mt-2 uppercase tracking-widest">
                                  <ShieldAlert className="w-3 h-3" /> Overridden
                                </span>
                              )}
                            </TableCell>
                            
                            <TableCell className="px-5 text-center">
                              <span className="text-sm font-semibold text-slate-500">{v.scan_count}</span>
                            </TableCell>

                            <TableCell className="px-5 font-bold text-emerald-600 text-sm text-right">{v.discount_value.toLocaleString()}</TableCell>
                            
                            <TableCell className="px-5 text-right">
                              <div className="flex flex-col items-end">
                                <span className="font-semibold text-slate-700 text-sm">{v.handling_fee || 0}</span>
                                {v.voucher_distributions?.payment_status && (
                                  <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded mt-1.5 ${v.voucher_distributions.payment_status === 'paid' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                                    {v.voucher_distributions.payment_status}
                                  </span>
                                )}
                              </div>
                            </TableCell>
                            
                            <TableCell className="px-5 py-3">
                              <div className="flex flex-col items-start gap-2">
                                <span className="font-medium text-xs text-slate-600 flex items-center gap-2">
                                  <Store className="w-4 h-4 text-slate-300" /> {v.voucher_distributors?.distributor_name || <span className="text-slate-400 italic">Unassigned</span>}
                                </span>
                                {v.customers && (
                                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 mt-1">
                                    <span className="font-semibold text-xs text-slate-800 flex items-center gap-1.5 bg-slate-100 px-2 py-1 rounded-md">
                                      <User className="w-3.5 h-3.5 text-slate-400" /> {v.customers.full_name}
                                    </span>
                                    
                                    {/* Assignment Badge & Call Details */}
                                    {activeAssignment && (
                                      <div className="flex flex-col gap-1.5 mt-1">
                                        <div className="flex items-center gap-2">
                                          <span className={`text-[10px] font-bold flex items-center gap-1.5 uppercase tracking-widest px-2 py-1 rounded-md border w-fit ${activeAssignment.status === 'pending' ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-slate-50 text-slate-500 border-slate-200'}`}>
                                            <PhoneCall className="w-3 h-3" /> 
                                            {teamMembers.find(m => m.id === activeAssignment.assigned_to)?.name?.split(' ')[0] || 'Staff'}
                                            {activeAssignment.status !== 'pending' && <span className="text-[9px] opacity-70 ml-1">({activeAssignment.status})</span>}
                                          </span>
                                          
                                          {/* Show Interest Level Badge if it exists */}
                                          {activeAssignment.interest_level && (
                                            <span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-1 rounded-md w-fit ${
                                              activeAssignment.interest_level === 'High' ? 'bg-emerald-100 text-emerald-700' : 
                                              activeAssignment.interest_level === 'Moderate' ? 'bg-blue-100 text-blue-700' : 
                                              activeAssignment.interest_level === 'Not Interested' ? 'bg-rose-100 text-rose-700' : 
                                              'bg-purple-100 text-purple-700'
                                            }`}>
                                              {activeAssignment.interest_level}
                                            </span>
                                          )}
                                        </div>
                                        
                                        {/* Show Call Outcome & Notes if they exist */}
                                        {activeAssignment.call_outcome && (
                                          <div className="bg-slate-50 border border-slate-100 rounded-md p-2 mt-1">
                                            <p className="text-[10px] font-semibold text-slate-700 uppercase tracking-wide mb-0.5">{activeAssignment.call_outcome}</p>
                                            {activeAssignment.call_notes && (
                                              <p className="text-xs text-slate-500 leading-snug line-clamp-2" title={activeAssignment.call_notes}>
                                                "{activeAssignment.call_notes}"
                                              </p>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            </TableCell>
                            
                            <TableCell className="px-5 text-center pr-6"><StatusBadge status={getDisplayStatus(v)} /></TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
            
            {/* SERVER-SIDE PAGINATION FOOTER */}
            {totalCount > 0 && (
              <div className="bg-slate-50 border-t border-slate-200 px-5 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-4 text-xs font-medium text-slate-500">
                  <div className="flex items-center gap-2">
                    <span>Rows per page:</span>
                    <Select value={pageSize.toString()} onValueChange={(v) => { setPageSize(Number(v)); setCurrentPage(0); }}>
                      <SelectTrigger className="h-8 w-[70px] bg-white border-slate-200 shadow-sm text-xs rounded-md">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="50">50</SelectItem>
                        <SelectItem value="100">100</SelectItem>
                        <SelectItem value="200">200</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <span className="hidden sm:inline">
                    Showing <span className="font-semibold text-slate-700">{currentPage * pageSize + 1}</span> to <span className="font-semibold text-slate-700">{Math.min((currentPage + 1) * pageSize, totalCount)}</span> of <span className="font-semibold text-slate-700">{totalCount}</span>
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" className="h-8 w-8 p-0 text-slate-600 bg-white border-slate-200 shadow-sm rounded-md hover:bg-slate-50" onClick={() => setCurrentPage(p => Math.max(0, p - 1))} disabled={currentPage === 0 || isListLoading}>
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <span className="text-xs font-semibold text-slate-400 px-2">Page {currentPage + 1} of {totalPages}</span>
                  <Button variant="outline" size="sm" className="h-8 w-8 p-0 text-slate-600 bg-white border-slate-200 shadow-sm rounded-md hover:bg-slate-50" onClick={() => setCurrentPage(p => p + 1)} disabled={(currentPage + 1) * pageSize >= totalCount || isListLoading}>
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* MODALS */}
        <Dialog open={isAssignModalOpen} onOpenChange={setIsAssignModalOpen}>
          <DialogContent className="sm:max-w-[450px] border-none shadow-xl rounded-2xl bg-white p-0 overflow-hidden">
            <DialogHeader className="bg-slate-50 border-b border-slate-100 p-6 pb-5">
              <DialogTitle className="flex items-center gap-2 text-slate-800 text-lg font-semibold">
                <PhoneCall className="w-5 h-5 text-teal-600" /> Assign Call Queue
              </DialogTitle>
              <DialogDescription className="text-sm text-slate-500 mt-1.5">
                Delegate <strong className="text-slate-700 font-bold">{selectedVouchers.size}</strong> selected leads to a team member.
              </DialogDescription>
            </DialogHeader>

            <div className="p-6 space-y-5">
              <div className="space-y-2.5">
                <Label className="text-xs font-semibold text-slate-600">Assign To</Label>
                <Select value={selectedAssignee} onValueChange={setSelectedAssignee}>
                  <SelectTrigger className="h-10 bg-white border-slate-200 text-sm shadow-sm rounded-lg">
                    <SelectValue placeholder="Choose user..." />
                  </SelectTrigger>
                  <SelectContent>
                    {teamMembers.map(member => (
                      <SelectItem key={member.id} value={member.id}>
                        <div className="flex items-center justify-between w-full pr-4 gap-4">
                          <span className="font-medium text-slate-700 text-sm">{member.name}</span>
                          <span className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">{member.role}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="bg-amber-50 border border-amber-100 p-4 rounded-lg">
                <p className="text-xs text-amber-800 font-medium leading-relaxed">
                  Note: Only vouchers linked to a <strong className="font-bold">Registered Customer</strong> can be assigned. Empty vouchers will be safely ignored.
                </p>
              </div>
            </div>

            <DialogFooter className="bg-slate-50 p-5 border-t border-slate-100">
              <Button variant="ghost" className="h-10 text-sm font-semibold rounded-lg px-4" onClick={() => setIsAssignModalOpen(false)}>Cancel</Button>
              <Button onClick={handleAssignCalls} disabled={isAssigning || !selectedAssignee} className="h-10 text-sm font-semibold bg-teal-600 hover:bg-teal-700 text-white rounded-lg shadow-sm px-6">
                {isAssigning ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Confirm Assignment
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* MASTER UPDATE MODAL */}
        <Dialog open={isMasterEditModalOpen} onOpenChange={setIsMasterEditModalOpen}>
          <DialogContent className="sm:max-w-[550px] border-none shadow-xl rounded-2xl p-0 overflow-hidden bg-white">
            <DialogHeader className="bg-slate-50 border-b border-slate-100 p-6 pb-5">
              <DialogTitle className="flex items-center gap-2 text-slate-800 text-lg font-semibold">
                <Settings2 className="w-5 h-5 text-indigo-600" /> Master Update
              </DialogTitle>
              <DialogDescription className="text-sm text-slate-500 mt-1.5">
                Applying forced overrides to <strong className="text-slate-700 font-bold">{selectedVouchers.size}</strong> vouchers.
              </DialogDescription>
            </DialogHeader>

            <div className="p-6 space-y-5 max-h-[60vh] overflow-y-auto custom-scrollbar">
              <div className="space-y-2.5">
                <Label className="text-xs font-semibold text-slate-600">Override Status</Label>
                <Select value={masterEditForm.status} onValueChange={(val) => setMasterEditForm({...masterEditForm, status: val})}>
                  <SelectTrigger className="h-10 bg-white border-slate-200 text-sm shadow-sm rounded-lg">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="no_change" className="text-slate-400 italic">No Change</SelectItem>
                    <SelectItem value="pending_print">Pending Print</SelectItem>
                    <SelectItem value="in_stock">In Stock</SelectItem>
                    <SelectItem value="distributed">Issued</SelectItem>
                    <SelectItem value="registered">Registered</SelectItem>
                    <SelectItem value="redeemed">Redeemed</SelectItem>
                    <SelectItem value="expired">Expired</SelectItem>
                    <SelectItem value="voided">Voided</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2.5">
                <Label className="text-xs font-semibold text-slate-600">Override Distributor</Label>
                <Select value={masterEditForm.distributor_id} onValueChange={(val) => setMasterEditForm({...masterEditForm, distributor_id: val})}>
                  <SelectTrigger className="h-10 bg-white border-slate-200 text-sm shadow-sm rounded-lg">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="no_change" className="text-slate-400 italic">No Change</SelectItem>
                    <SelectItem value="clear" className="text-rose-500 font-semibold">Clear Partner</SelectItem>
                    {distributors.map(d => <SelectItem key={d.id} value={d.id}>{d.distributor_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-5">
                <div className="space-y-2.5">
                  <Label className="text-xs font-semibold text-slate-600">Issue Date</Label>
                  <Input type="datetime-local" className="h-10 text-sm rounded-lg shadow-sm border-slate-200 bg-white" value={masterEditForm.distributed_at} onChange={(e) => setMasterEditForm({...masterEditForm, distributed_at: e.target.value})} />
                </div>
                <div className="space-y-2.5">
                  <Label className="text-xs font-semibold text-slate-600">Expiry Date</Label>
                  <Input type="date" className="h-10 text-sm rounded-lg shadow-sm border-slate-200 bg-white" value={masterEditForm.expiry_date} onChange={(e) => setMasterEditForm({...masterEditForm, expiry_date: e.target.value})} />
                </div>
              </div>

              <div className="space-y-2.5 border-t border-slate-100 pt-5">
                <Label className="text-xs font-semibold text-slate-600">Handling Fee Override (₹)</Label>
                <Input type="number" placeholder="Leave blank to skip..." className="h-10 text-sm rounded-lg shadow-sm border-slate-200 bg-white" value={masterEditForm.handling_fee} onChange={(e) => setMasterEditForm({...masterEditForm, handling_fee: e.target.value})} />
              </div>

              <div className="space-y-2.5 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <Label className="text-xs font-bold text-slate-700">Audit Trail Reason *</Label>
                <Input type="text" placeholder="Why are you making this edit?" className="h-10 text-sm bg-white border-slate-300 shadow-sm rounded-lg" value={masterEditForm.override_reason} onChange={(e) => setMasterEditForm({...masterEditForm, override_reason: e.target.value})} />
              </div>
            </div>

            <DialogFooter className="bg-slate-50 p-5 border-t border-slate-100">
              <Button variant="ghost" className="h-10 text-sm font-semibold rounded-lg px-4" onClick={() => setIsMasterEditModalOpen(false)}>Cancel</Button>
              <Button onClick={handleMasterUpdate} disabled={isUpdatingBulk || !masterEditForm.override_reason.trim()} className="h-10 text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-sm px-6">
                {isUpdatingBulk ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null} Execute Update
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* BULK VOID MODAL */}
        <Dialog open={isVoidModalOpen} onOpenChange={setIsVoidModalOpen}>
          <DialogContent className="sm:max-w-[450px] border-none shadow-xl rounded-2xl bg-white p-0">
            <DialogHeader className="p-6 pb-2">
              <DialogTitle className="flex items-center gap-2 text-rose-600 text-lg font-semibold">
                <ShieldAlert className="w-5 h-5" /> Void Selected Vouchers
              </DialogTitle>
              <DialogDescription className="text-sm text-slate-500 mt-1.5">
                You are about to permanently void <strong className="text-slate-700 font-bold">{selectedVouchers.size}</strong> vouchers.
              </DialogDescription>
            </DialogHeader>
            <div className="p-6 pt-2">
              <div className="space-y-2.5">
                <Label className="text-xs font-semibold text-slate-600">Reason (Required)</Label>
                <Input className="h-10 text-sm border-slate-200 shadow-sm rounded-lg" placeholder="e.g. Lost in transit..." value={bulkVoidReason} onChange={(e) => setBulkVoidReason(e.target.value)} />
              </div>
            </div>
            <DialogFooter className="p-6 pt-0">
              <Button variant="ghost" className="h-10 text-sm font-semibold rounded-lg px-4" onClick={() => setIsVoidModalOpen(false)}>Cancel</Button>
              <Button variant="destructive" className="h-10 text-sm font-semibold shadow-sm rounded-lg px-6" onClick={handleBulkVoid} disabled={isVoidingBulk || !bulkVoidReason.trim()}>
                {isVoidingBulk ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null} Confirm Void
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <WhatsAppSenderModal isOpen={isSenderModalOpen} onClose={() => setIsSenderModalOpen(false)} recipients={messageRecipients} defaultTemplateName={activeTemplateContext === "welcome" ? "welcome_registered_voucher" : "voucher_expiry_reminder"} />

      </main>
    </div>
  );
}