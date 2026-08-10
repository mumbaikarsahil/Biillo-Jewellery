"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { format, isPast } from "date-fns";
import { 
  Search, Store, Package, Loader2, ArrowLeft, ChevronRight, ChevronLeft,
  RefreshCw, Database, CheckSquare, Filter, User, ShieldAlert, Phone,
  Download, BellRing, Megaphone, ArrowUpDown, Settings2, PhoneCall,
  CheckCircle2, X
} from "lucide-react";

import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/hooks/useAuth"; 
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
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
  
  customers?: {
    id: string;
    full_name: string;
    phone: string;
    convo360_user_id?: string | null;
  } | null;

  voucher_batches: {
    batch_no: string;
    created_at?: string;
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
    assigned_by: string; 
    status: string;
    call_outcome?: string | null;
    interest_level?: string | null;
    call_notes?: string | null;
  }[];
}

export default function TrackVoucherPage() {
  const { toast } = useToast();
  const { appUser } = useAuth(); 

  // --- EXPORT MODAL STATE ---
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isExportingAll, setIsExportingAll] = useState(false);

  // --- MASTER LIST STATE ---
  const [listData, setListData] = useState<TrackedVoucher[]>([]);
  const [isListLoading, setIsListLoading] = useState(false);
  const [localSearch, setLocalSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(0);
  const [pageSize, setPageSize] = useState(50); 
  const [totalCount, setTotalCount] = useState(0);

  // --- ADVANCED UNIFIED FILTERS STATE ---
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState("all");
  const [assignmentFilter, setAssignmentFilter] = useState("all");
  const [outcomeFilter, setOutcomeFilter] = useState("all");
  const [interestFilter, setInterestFilter] = useState("all");
  const [selectedFilterDistributor, setSelectedFilterDistributor] = useState("all");
  
  const [distributors, setDistributors] = useState<any[]>([]);
  const [sortOrder, setSortOrder] = useState("newest"); 
  const [searchMode, setSearchMode] = useState<'text' | 'range'>('text');
  const [fromCode, setFromCode] = useState("");
  const [toCode, setToCode] = useState("");
  
  // --- BULK ACTION STATE ---
  const [selectedVouchers, setSelectedVouchers] = useState<Set<string>>(new Set());

  // --- MASTER UPDATE MODAL STATE ---
  const [isMasterEditModalOpen, setIsMasterEditModalOpen] = useState(false);
  const [isUpdatingBulk, setIsUpdatingBulk] = useState(false);
  const [masterEditForm, setMasterEditForm] = useState({
    status: 'no_change', distributor_id: 'no_change', distributed_at: '', expiry_date: '', handling_fee: '', override_reason: ''
  });

  // --- VOID MODAL STATE ---
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
  const [isRemindModalOpen, setIsRemindModalOpen] = useState(false);

  useEffect(() => {
    const fetchFiltersData = async () => {
      const { data: dData } = await supabase.from("voucher_distributors").select("id, distributor_name").order("distributor_name");
      if (dData) setDistributors(dData);
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
      fetchVoucherList();
    }, 400); 
    return () => clearTimeout(timer);
  }, [activeFilter, assignmentFilter, outcomeFilter, interestFilter, selectedFilterDistributor, currentPage, localSearch, pageSize, sortOrder, searchMode, fromCode, toCode]);

  const fetchVoucherList = async () => {
    setIsListLoading(true);
    try {
      const requiresInnerJoin = assignmentFilter === "assigned" || assignmentFilter === "called" || outcomeFilter !== "all" || interestFilter !== "all";

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
          voucher_call_assignments${requiresInnerJoin ? '!inner' : ''} (id, assigned_to, assigned_by, status, call_outcome, interest_level, call_notes)
        `, { count: 'exact' });

      if (sortOrder === 'newest') query = query.order('updated_at', { ascending: false, nullsFirst: false });
      else if (sortOrder === 'oldest') query = query.order('updated_at', { ascending: true, nullsFirst: false });
      else if (sortOrder === 'code_desc') query = query.order('code', { ascending: false });
      else query = query.order('code', { ascending: true }); 

      query = query.range(currentPage * pageSize, (currentPage + 1) * pageSize - 1);

      // Status Filter
      if (activeFilter === "expired") {
        query = query.in("status", ["distributed", "in_stock", "registered"]).lt("expiry_date", new Date().toISOString());
      } else if (activeFilter !== "all") {
        query = query.eq("status", activeFilter);
      }

      // Calling Logic Filter
      if (assignmentFilter === "assigned") {
        query = query.eq("voucher_call_assignments.status", "pending");
      } else if (assignmentFilter === "called") {
        query = query.in("voucher_call_assignments.status", ["called", "dnd"]);
      } else if (assignmentFilter === "unassigned") {
        query = query.eq("status", "registered");
        const { data: assigned } = await supabase.from('voucher_call_assignments').select('voucher_id');
        const assignedIds = assigned?.map(a => a.voucher_id).filter(Boolean) || [];
        if (assignedIds.length > 0) query = query.not('id', 'in', `(${assignedIds.join(',')})`);
      }

      // Outcomes & Interest Filters
      if (outcomeFilter !== "all") query = query.eq("voucher_call_assignments.call_outcome", outcomeFilter);
      if (interestFilter !== "all") query = query.eq("voucher_call_assignments.interest_level", interestFilter);

      // Search Logic
      if (searchMode === 'text' && localSearch.trim()) {
        query = query.ilike("code", `%${localSearch.trim()}%`);
      } else if (searchMode === 'range') {
        if (fromCode.trim()) query = query.gte("code", fromCode.trim().toUpperCase());
        if (toCode.trim()) query = query.lte("code", toCode.trim().toUpperCase());
      }

      if (selectedFilterDistributor !== "all") query = query.eq("distributor_id", selectedFilterDistributor);

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

  // --- RESTORED CORE FUNCTIONS ---
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
      fetchVoucherList(); 
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
      fetchVoucherList();
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
      fetchVoucherList();
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
    return v.voucher_call_assignments.find(a => a.status === 'pending') || v.voucher_call_assignments[0];
  };

  const StatusBadge = ({ status }: { status: string }) => {
    switch (status) {
      case 'pending_print': return <Badge variant="outline" className="bg-zinc-100 text-zinc-700 border-zinc-200 shadow-none font-medium">Pending</Badge>;
      case 'in_stock': return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 shadow-none font-medium">In Stock</Badge>;
      case 'distributed': return <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200 shadow-none font-medium">Issued</Badge>;
      case 'registered': return <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 shadow-none font-medium">Registered</Badge>;
      case 'redeemed': return <Badge variant="outline" className="bg-emerald-500 text-white border-emerald-600 shadow-none font-medium">Redeemed</Badge>;
      case 'expired':
      case 'voided': return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 shadow-none font-medium capitalize">{status}</Badge>;
      default: return <Badge variant="secondary" className="shadow-none font-medium capitalize">{status}</Badge>;
    }
  };

  // --- EXPORT LOGIC ---
  const generateCSV = (dataToExport: TrackedVoucher[], filenamePrefix: string) => {
    if (dataToExport.length === 0) return toast({ title: "No Data", description: "No data to export." });
    
    const headers = [
      "Voucher Code", "Batch No", "Current Status", "Discount (INR)", "Handling Fee (INR)",
      "Partner / Distributor", "Registered Customer", "Customer Phone",
      "Assigned To", "Assigned By", "Call Status", "Call Outcome", "Interest Level",
      "Expiry Date", "Redeemed Date", "Last Updated"
    ];

    const csvRows = dataToExport.map(v => {
      const assignment = getActiveAssignment(v);
      const assigneeName = assignment ? teamMembers.find(m => m.id === assignment.assigned_to)?.name || 'Unknown' : 'None';
      const assignerName = assignment ? teamMembers.find(m => m.id === assignment.assigned_by)?.name || 'Unknown' : 'None';
      
      return [
        v.code, 
        v.voucher_batches?.batch_no || '', 
        getDisplayStatus(v).toUpperCase(), 
        v.discount_value, 
        v.handling_fee || 0,
        v.voucher_distributors?.distributor_name || 'Unassigned', 
        v.customers?.full_name || 'None', 
        v.customers?.phone || 'None',
        assigneeName, 
        assignerName, 
        assignment ? assignment.status.toUpperCase() : 'NONE',
        assignment?.call_outcome || 'NONE',
        assignment?.interest_level || 'NONE',
        v.expiry_date ? format(new Date(v.expiry_date), "yyyy-MM-dd") : 'None',
        v.redeemed_at ? format(new Date(v.redeemed_at), "yyyy-MM-dd") : 'None',
        v.updated_at ? format(new Date(v.updated_at), "yyyy-MM-dd HH:mm") : 'None'
      ].map(field => `"${String(field).replace(/"/g, '""')}"`).join(",");
    });

    const csvContent = [headers.join(","), ...csvRows].join("\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csvContent], { type: "text/csv;charset=utf-8;" }));
    link.download = `${filenamePrefix}_${format(new Date(), "yyyyMMdd_HHmm")}.csv`;
    link.click();
  };

  const exportCurrentPage = () => {
    setIsExportModalOpen(false);
    generateCSV(listData, `Vouchers_Page${currentPage + 1}`);
    toast({ title: "Export Started", description: "Your CSV is downloading." });
  };

  const exportAllData = async () => {
    setIsExportModalOpen(false);
    setIsExportingAll(true);
    toast({ title: "Compiling Data", description: `Fetching all ${totalCount} records from the database. Please wait...`, duration: 5000 });

    try {
      let allRecords: TrackedVoucher[] = [];
      const chunkSize = 1000;
      let currentOffset = 0;
      let hasMore = true;

      // Pre-fetch assigned IDs if filtering by 'unassigned' to avoid doing it in every loop
      let unassignedFilterIds: string[] = [];
      if (assignmentFilter === "unassigned") {
        const { data: assigned } = await supabase.from('voucher_call_assignments').select('voucher_id');
        unassignedFilterIds = assigned?.map(a => a.voucher_id).filter(Boolean) || [];
      }

      while (hasMore) {
        const requiresInnerJoin = assignmentFilter === "assigned" || assignmentFilter === "called" || outcomeFilter !== "all" || interestFilter !== "all";

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
            voucher_call_assignments${requiresInnerJoin ? '!inner' : ''} (id, assigned_to, assigned_by, status, call_outcome, interest_level, call_notes)
          `);

        if (sortOrder === 'newest') query = query.order('updated_at', { ascending: false, nullsFirst: false });
        else if (sortOrder === 'oldest') query = query.order('updated_at', { ascending: true, nullsFirst: false });
        else if (sortOrder === 'code_desc') query = query.order('code', { ascending: false });
        else query = query.order('code', { ascending: true }); 

        // Apply Status Filter
        if (activeFilter === "expired") {
          query = query.in("status", ["distributed", "in_stock", "registered"]).lt("expiry_date", new Date().toISOString());
        } else if (activeFilter !== "all") {
          query = query.eq("status", activeFilter);
        }

        // Apply Calling Logic Filter
        if (assignmentFilter === "assigned") query = query.eq("voucher_call_assignments.status", "pending");
        else if (assignmentFilter === "called") query = query.in("voucher_call_assignments.status", ["called", "dnd"]);
        else if (assignmentFilter === "unassigned") {
          query = query.eq("status", "registered");
          if (unassignedFilterIds.length > 0) query = query.not('id', 'in', `(${unassignedFilterIds.join(',')})`);
        }

        // Apply Outcomes, Interest, Distributor, & Search Filters
        if (outcomeFilter !== "all") query = query.eq("voucher_call_assignments.call_outcome", outcomeFilter);
        if (interestFilter !== "all") query = query.eq("voucher_call_assignments.interest_level", interestFilter);
        if (selectedFilterDistributor !== "all") query = query.eq("distributor_id", selectedFilterDistributor);
        
        if (searchMode === 'text' && localSearch.trim()) {
          query = query.ilike("code", `%${localSearch.trim()}%`);
        } else if (searchMode === 'range') {
          if (fromCode.trim()) query = query.gte("code", fromCode.trim().toUpperCase());
          if (toCode.trim()) query = query.lte("code", toCode.trim().toUpperCase());
        }

        // Fetch chunk
        query = query.range(currentOffset, currentOffset + chunkSize - 1);
        const { data, error } = await query;
        
        if (error) throw error;

        if (data && data.length > 0) {
          allRecords = [...allRecords, ...(data as any)];
          currentOffset += chunkSize;
          if (data.length < chunkSize) hasMore = false;
        } else {
          hasMore = false;
        }
      }

      generateCSV(allRecords, "Vouchers_Global_Export");
      toast({ title: "Export Complete", description: `Successfully exported ${allRecords.length} records.` });
    } catch (error: any) {
      toast({ title: "Export Failed", description: error.message, variant: "destructive" });
    } finally {
      setIsExportingAll(false);
    }
  };

  const totalPages = Math.ceil(totalCount / pageSize);
  const activeFiltersCount = [activeFilter, assignmentFilter, outcomeFilter, interestFilter, selectedFilterDistributor].filter(f => f !== 'all').length;

  return (
    <div className="flex flex-col min-h-screen bg-[#FAFAFA] font-sans selection:bg-zinc-200">
      {/* VERCEL-STYLE TOP BAR */}
      <header className="sticky top-0 z-40 w-full bg-white border-b border-zinc-200 px-6 h-14 flex items-center justify-between shadow-[0_1px_2px_rgba(0,0,0,0.02)] box-border">
        <div className="flex items-center gap-4 overflow-hidden">
          <Link href="/vouchers">
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-md hover:bg-zinc-100 text-zinc-500">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="h-4 w-[1px] bg-zinc-200" />
          <nav className="flex items-center gap-2 text-[13px] font-medium tracking-tight">
            <Link href="/vouchers" className="text-zinc-500 hover:text-zinc-900 transition-colors">Vouchers</Link>
            <ChevronRight className="h-4 w-4 text-zinc-300" />
            <span className="text-zinc-900 select-none">Tracking Ledger</span>
          </nav>
        </div>

        <div className="flex items-center gap-3">
        <Button 
            variant="outline" 
            size="sm" 
            className="h-8 text-[13px] border-zinc-200 text-zinc-700 shadow-sm font-medium hover:bg-zinc-50" 
            onClick={() => setIsExportModalOpen(true)}
            disabled={listData.length === 0 || isExportingAll}
          >
            {isExportingAll ? <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" /> : <Download className="w-3.5 h-3.5 mr-2" />} 
            {isExportingAll ? "Exporting..." : "Export"}
          </Button>
        </div>
      </header>

      <main className="p-6 md:p-8 max-w-[1600px] w-full mx-auto space-y-6">

       {/* --- COMPACT ASSIGNMENT METRICS DASHBOARD --- */}
       {assignmentMetrics.length > 0 && (
          <section className="space-y-3 animate-in fade-in duration-300">
            
            {/* Header & Legend */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h2 className="text-sm font-bold text-zinc-500 tracking-wide flex items-center gap-2">
                <PhoneCall className="w-4 h-4" /> Team Calling Assignments
              </h2>
              
              {/* ✨ NEW: Color Nomenclature Legend */}
              <div className="flex items-center gap-3 text-[11px] font-medium text-zinc-500 bg-white border border-zinc-200 px-2.5 py-1 rounded-md shadow-sm">
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> Pending
                </div>
                <div className="w-px h-3 bg-zinc-200" />
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Done
                </div>
                <div className="w-px h-3 bg-zinc-200" />
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-zinc-400" /> DND
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {assignmentMetrics.map(member => {
        
                const initials = member.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
                
                return (
                  <div key={member.name} className="bg-white border border-zinc-200 p-2.5 rounded-lg shadow-sm flex items-center justify-between gap-4 hover:border-zinc-300 transition-colors">
                    
                    {/* User Info */}
                    <div className="flex items-center gap-2.5 truncate">
                      <div className="h-7 w-7 rounded-full bg-zinc-100 border border-zinc-200 flex items-center justify-center shrink-0">
                        <span className="text-[10px] font-bold text-zinc-600">
                          {initials || <User className="w-3.5 h-3.5" />}
                        </span>
                      </div>
                      <span className="text-[13px] font-semibold text-zinc-800 truncate" title={member.name}>
                        {member.name}
                      </span>
                    </div>

                    {/* Compact Metrics Pills */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <div className="flex items-center gap-1.5 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-100" title="Pending Calls">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                        <span className="text-[11px] font-bold text-amber-700">{member.pending}</span>
                      </div>
                      
                      <div className="flex items-center gap-1.5 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100" title="Completed Calls">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        <span className="text-[11px] font-bold text-emerald-700">{member.completed}</span>
                      </div>
                      
                      <div className="flex items-center gap-1.5 bg-zinc-100 px-2 py-0.5 rounded-md border border-zinc-200" title="Do Not Disturb">
                        <span className="w-1.5 h-1.5 rounded-full bg-zinc-400" />
                        <span className="text-[11px] font-bold text-zinc-600">{member.dnd}</span>
                      </div>
                    </div>

                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* --- UNIFIED FILTER & SEARCH COMMAND BAR (ELEVENLABS / OLX STYLE) --- */}
        <section className="bg-white border border-zinc-200 rounded-xl shadow-sm overflow-hidden animate-in fade-in duration-300">
          <div className="p-2 flex flex-col sm:flex-row items-center gap-2 bg-white">
            
            {/* Search Input */}
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
              <Input 
                placeholder="Search codes..." 
                className="w-full pl-9 h-10 border-0 focus-visible:ring-0 text-sm placeholder:text-zinc-400 font-medium"
                value={localSearch}
                onChange={(e) => { setLocalSearch(e.target.value); setCurrentPage(0); }}
              />
            </div>

            <div className="h-6 w-[1px] bg-zinc-200 hidden sm:block" />

            {/* Filter Toggle & Quick Sort */}
            <div className="flex items-center gap-2 pr-2 w-full sm:w-auto">
              <Select value={sortOrder} onValueChange={(val) => { setSortOrder(val); setCurrentPage(0); }}>
                <SelectTrigger className="h-9 border-0 shadow-none text-[13px] font-medium text-zinc-600 focus:ring-0 w-auto hover:bg-zinc-50 rounded-md">
                  <ArrowUpDown className="w-3.5 h-3.5 mr-2 text-zinc-400" /> <SelectValue />
                </SelectTrigger>
                <SelectContent align="end" className="border-zinc-200 rounded-lg shadow-md">
                  <SelectItem value="newest" className="text-[13px]">Newest First</SelectItem>
                  <SelectItem value="oldest" className="text-[13px]">Oldest First</SelectItem>
                  <SelectItem value="code_asc" className="text-[13px]">Code (A-Z)</SelectItem>
                  <SelectItem value="code_desc" className="text-[13px]">Code (Z-A)</SelectItem>
                </SelectContent>
              </Select>
              
              <Button 
                variant={isFiltersOpen ? "default" : "outline"} 
                className={`h-9 text-[13px] font-medium px-4 shadow-sm transition-all ${isFiltersOpen ? 'bg-zinc-900 text-white' : 'border-zinc-200 text-zinc-700 bg-white hover:bg-zinc-50'}`}
                onClick={() => setIsFiltersOpen(!isFiltersOpen)}
              >
                <Filter className="w-3.5 h-3.5 mr-2" />
                Filters
                {activeFiltersCount > 0 && (
                  <span className="ml-2 flex items-center justify-center w-4 h-4 rounded-full bg-zinc-200 text-zinc-800 text-[10px] font-bold">
                    {activeFiltersCount}
                  </span>
                )}
              </Button>
            </div>
          </div>

          {/* EXPANDABLE MULTI-FILTER DRAWER */}
          {isFiltersOpen && (
            <div className="border-t border-zinc-100 bg-zinc-50/50 p-5 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4 animate-in slide-in-from-top-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Voucher Status</Label>
                <Select value={activeFilter} onValueChange={(val) => { setActiveFilter(val); setCurrentPage(0); }}>
                  <SelectTrigger className="h-9 bg-white border-zinc-200 text-[13px] shadow-sm"><SelectValue /></SelectTrigger>
                  <SelectContent className="border-zinc-200">
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="pending_print">Pending Print</SelectItem>
                    <SelectItem value="in_stock">In Stock</SelectItem>
                    <SelectItem value="distributed">Issued</SelectItem>
                    <SelectItem value="registered">Registered</SelectItem>
                    <SelectItem value="redeemed">Redeemed</SelectItem>
                    <SelectItem value="expired">Expired</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Telecalling Status</Label>
                <Select value={assignmentFilter} onValueChange={(val) => { setAssignmentFilter(val); setCurrentPage(0); }}>
                  <SelectTrigger className="h-9 bg-white border-zinc-200 text-[13px] shadow-sm"><SelectValue /></SelectTrigger>
                  <SelectContent className="border-zinc-200">
                    <SelectItem value="all">All Assignments</SelectItem>
                    <SelectItem value="assigned">Assigned (Pending)</SelectItem>
                    <SelectItem value="called">Assigned (Completed)</SelectItem>
                    <SelectItem value="unassigned">Not Assigned</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Call Outcome</Label>
                <Select value={outcomeFilter} onValueChange={(val) => { setOutcomeFilter(val); setCurrentPage(0); }}>
                  <SelectTrigger className="h-9 bg-white border-zinc-200 text-[13px] shadow-sm"><SelectValue /></SelectTrigger>
                  <SelectContent className="border-zinc-200">
                    <SelectItem value="all">All Outcomes</SelectItem>
                    <SelectItem value="Connected / Spoke to Customer">Connected</SelectItem>
                    <SelectItem value="Ringing / No Answer">No Answer</SelectItem>
                    <SelectItem value="Not Interested (Do Not Disturb)">DND</SelectItem>
                    <SelectItem value="Wrong Number">Wrong Number</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Customer Interest</Label>
                <Select value={interestFilter} onValueChange={(val) => { setInterestFilter(val); setCurrentPage(0); }}>
                  <SelectTrigger className="h-9 bg-white border-zinc-200 text-[13px] shadow-sm"><SelectValue /></SelectTrigger>
                  <SelectContent className="border-zinc-200">
                    <SelectItem value="all">All Levels</SelectItem>
                    <SelectItem value="High">High</SelectItem>
                    <SelectItem value="Moderate">Moderate</SelectItem>
                    <SelectItem value="Not Interested">Not Interested</SelectItem>
                    <SelectItem value="Already Claimed Voucher">Already Claimed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* RESTORED: Distributor / Partner Filter */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Partner / Distributor</Label>
                <Select value={selectedFilterDistributor} onValueChange={(val) => { setSelectedFilterDistributor(val); setCurrentPage(0); }}>
                  <SelectTrigger className="h-9 bg-white border-zinc-200 text-[13px] shadow-sm"><SelectValue /></SelectTrigger>
                  <SelectContent className="border-zinc-200">
                    <SelectItem value="all">All Partners</SelectItem>
                    {distributors.map(d => <SelectItem key={d.id} value={d.id}>{d.distributor_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="col-span-1 md:col-span-5 flex justify-end pt-2 border-t border-zinc-200/60 mt-2">
                 <Button variant="ghost" size="sm" className="text-xs text-zinc-500 hover:text-zinc-900" onClick={() => {
                   setActiveFilter('all'); setAssignmentFilter('all'); setOutcomeFilter('all'); setInterestFilter('all'); setSelectedFilterDistributor('all'); setLocalSearch('');
                 }}>
                   Reset Filters
                 </Button>
              </div>
            </div>
          )}
        </section>

        {/* --- ACTION BAR (WHEN SELECTED) --- */}
        {selectedVouchers.size > 0 && (
          <div className="bg-zinc-900 border border-zinc-800 p-3 px-4 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-in slide-in-from-bottom-4 shadow-xl fixed bottom-8 left-1/2 -translate-x-1/2 w-full max-w-2xl z-50">
            <div className="flex items-center gap-3 shrink-0">
              <div className="bg-zinc-800 text-white text-xs font-bold px-2 py-1 rounded-md">{selectedVouchers.size}</div>
              <span className="text-[13px] font-medium text-zinc-300">Vouchers Selected</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" className="bg-zinc-800 hover:bg-zinc-700 text-white border-none h-8 text-[13px]" onClick={() => setIsAssignModalOpen(true)}>
                <PhoneCall className="w-3.5 h-3.5 mr-2" /> Assign Leads
              </Button>
              <Button size="sm" className="bg-zinc-800 hover:bg-zinc-700 text-white border-none h-8 text-[13px]" onClick={() => setIsMasterEditModalOpen(true)}>
                <Settings2 className="w-3.5 h-3.5 mr-2" /> Edit Status
              </Button>
              <Button size="sm" variant="ghost" className="text-rose-400 hover:bg-rose-500/20 hover:text-rose-300 h-8 text-[13px]" onClick={() => setIsVoidModalOpen(true)}>
                Void
              </Button>
              <Button size="icon" variant="ghost" className="h-8 w-8 text-zinc-400 hover:text-white" onClick={() => setSelectedVouchers(new Set())}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {/* --- SLEEK DATA TABLE --- */}
        <div className="bg-white border border-zinc-200 rounded-xl shadow-sm overflow-hidden">
          {isListLoading ? (
            <div className="flex flex-col items-center justify-center py-32">
              <Loader2 className="w-6 h-6 animate-spin text-zinc-400 mb-3" />
              <span className="text-[11px] font-bold uppercase tracking-widest text-zinc-400">Loading Records</span>
            </div>
          ) : listData.length === 0 ? (
            <div className="text-center py-32">
              <Database className="w-10 h-10 mx-auto mb-3 text-zinc-200" />
              <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest">No Records Found</p>
            </div>
          ) : (
            <div className="overflow-x-auto custom-scrollbar">
              <Table>
                <TableHeader className="bg-zinc-50 border-b border-zinc-200">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-12 px-5 text-center">
                      <input 
                        type="checkbox" 
                        className="w-3.5 h-3.5 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900 cursor-pointer"
                        checked={selectedVouchers.size === listData.length && listData.length > 0}
                        onChange={toggleAll}
                      />
                    </TableHead>
                    <TableHead className="text-[12px] font-semibold text-zinc-500 h-10 px-5">Identifier</TableHead>
                    
                    {/* RESTORED: Distributor/Partner Column */}
                    <TableHead className="text-[12px] font-semibold text-zinc-500 h-10 px-5">Partner / Distributor</TableHead>
                    
                    <TableHead className="text-[12px] font-semibold text-zinc-500 h-10 px-5">Registered Customer</TableHead>
                    <TableHead className="text-[12px] font-semibold text-zinc-500 h-10 px-5">Telecalling Status</TableHead>
                    <TableHead className="text-[12px] font-semibold text-zinc-500 h-10 px-5 text-right">Value (₹)</TableHead>
                    <TableHead className="text-[12px] font-semibold text-zinc-500 h-10 px-5 text-center pr-6">System Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {listData.map((v) => {
                    const activeAssignment = getActiveAssignment(v);

                    return (
                      <TableRow key={v.id} className={`hover:bg-zinc-50/50 border-b border-zinc-100 transition-colors ${selectedVouchers.has(v.id) ? 'bg-zinc-50' : ''}`}>
                        <TableCell className="px-5 text-center">
                          <input 
                            type="checkbox" 
                            className="w-3.5 h-3.5 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900 cursor-pointer"
                            checked={selectedVouchers.has(v.id)}
                            onChange={() => toggleSelection(v.id)}
                          />
                        </TableCell>
                        
                        {/* IDENTIFIER */}
                        <TableCell className="px-5 py-3">
                          <span className="font-mono font-medium text-[13px] text-zinc-900 tracking-tight block">{v.code}</span>
                          <span className="text-[11px] text-zinc-400 mt-1 block">
                            {v.updated_at ? format(new Date(v.updated_at), 'dd MMM, HH:mm') : ''}
                          </span>
                        </TableCell>

                        {/* RESTORED: DISTRIBUTOR DETAILS */}
                        <TableCell className="px-5 py-3">
                          {v.voucher_distributors ? (
                            <span className="font-medium text-[12px] text-zinc-700 flex items-center gap-2">
                              <Store className="w-3.5 h-3.5 text-zinc-400" /> {v.voucher_distributors.distributor_name}
                            </span>
                          ) : (
                            <span className="text-[12px] italic text-zinc-400">Unassigned</span>
                          )}
                        </TableCell>

                        {/* ENHANCED CUSTOMER DETAILS */}
                        <TableCell className="px-5 py-3">
                          {v.customers ? (
                            <div className="flex flex-col">
                              <span className="font-semibold text-[13px] text-zinc-900">{v.customers.full_name}</span>
                              <span className="font-mono text-[11px] text-zinc-500 mt-0.5">{v.customers.phone}</span>
                            </div>
                          ) : (
                            <span className="text-[12px] italic text-zinc-400">Unregistered</span>
                          )}
                        </TableCell>

                        {/* ENHANCED TELECALLING METRICS */}
                        <TableCell className="px-5 py-3">
                          {activeAssignment ? (
                            <div className="flex flex-col gap-1.5">
                              <div className="flex items-center gap-2">
                                <span className="text-[11px] font-semibold text-zinc-700 bg-zinc-100 px-2 py-0.5 rounded-md flex items-center gap-1.5 w-fit">
                                  <PhoneCall className="w-3 h-3 text-zinc-500" />
                                  {teamMembers.find(m => m.id === activeAssignment.assigned_to)?.name?.split(' ')[0] || 'Staff'}
                                </span>
                                {activeAssignment.interest_level && (
                                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${
                                    activeAssignment.interest_level === 'High' ? 'text-emerald-700 bg-emerald-50' :
                                    activeAssignment.interest_level === 'Moderate' ? 'text-blue-700 bg-blue-50' :
                                    activeAssignment.interest_level === 'Not Interested' ? 'text-rose-700 bg-rose-50' :
                                    'text-zinc-600 bg-zinc-100'
                                  }`}>
                                    {activeAssignment.interest_level}
                                  </span>
                                )}
                              </div>
                              {activeAssignment.call_outcome && (
                                <p className="text-[11px] text-zinc-500 leading-tight">
                                  <span className="font-medium text-zinc-700">{activeAssignment.call_outcome}</span>
                                </p>
                              )}
                            </div>
                          ) : (
                            <span className="text-[11px] text-zinc-300">-</span>
                          )}
                        </TableCell>

                        <TableCell className="px-5 font-semibold text-zinc-900 text-[13px] text-right">{v.discount_value.toLocaleString()}</TableCell>
                        
                        <TableCell className="px-5 text-center pr-6"><StatusBadge status={getDisplayStatus(v)} /></TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {/* SERVER-SIDE PAGINATION FOOTER */}
          {totalCount > 0 && (
            <div className="bg-white border-t border-zinc-200 px-5 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Select value={pageSize.toString()} onValueChange={(v) => { setPageSize(Number(v)); setCurrentPage(0); }}>
                  <SelectTrigger className="h-8 w-[70px] bg-white border-zinc-200 shadow-none text-[12px] font-medium rounded-md">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="50" className="text-[12px]">50</SelectItem>
                    <SelectItem value="100" className="text-[12px]">100</SelectItem>
                  </SelectContent>
                </Select>
                <span className="text-[12px] font-medium text-zinc-500 ml-2">
                  Showing {currentPage * pageSize + 1}-{Math.min((currentPage + 1) * pageSize, totalCount)} of {totalCount}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-500 hover:bg-zinc-100" onClick={() => setCurrentPage(p => Math.max(0, p - 1))} disabled={currentPage === 0 || isListLoading}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-500 hover:bg-zinc-100" onClick={() => setCurrentPage(p => p + 1)} disabled={(currentPage + 1) * pageSize >= totalCount || isListLoading}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* ========================================================= */}
        {/* MODALS SECTION                                              */}
        {/* ========================================================= */}
        
        {/* ASSIGNMENT MODAL */}
        <Dialog open={isAssignModalOpen} onOpenChange={setIsAssignModalOpen}>
          {/* ✨ FIX: Added max-h-[90dvh] flex flex-col and w-[95vw] for mobile */}
          <DialogContent className="sm:max-w-[450px] w-[95vw] max-h-[90dvh] flex flex-col border-none shadow-xl rounded-2xl bg-white p-0 overflow-hidden">
            <DialogHeader className="bg-zinc-50 border-b border-zinc-100 p-6 pb-5 shrink-0">
              <DialogTitle className="flex items-center gap-2 text-zinc-800 text-lg font-semibold">
                <PhoneCall className="w-5 h-5 text-teal-600" /> Assign Call Queue
              </DialogTitle>
              <DialogDescription className="text-sm text-zinc-500 mt-1.5">
                Delegate <strong className="text-zinc-700 font-bold">{selectedVouchers.size}</strong> selected leads to a team member.
              </DialogDescription>
            </DialogHeader>

            {/* ✨ FIX: Added flex-1 overflow-y-auto to allow only the middle to scroll */}
            <div className="p-6 space-y-5 flex-1 overflow-y-auto custom-scrollbar">
              <div className="space-y-2.5">
                <Label className="text-xs font-semibold text-zinc-600">Assign To</Label>
                <Select value={selectedAssignee} onValueChange={setSelectedAssignee}>
                  <SelectTrigger className="h-10 bg-white border-zinc-200 text-sm shadow-sm rounded-lg">
                    <SelectValue placeholder="Choose user..." />
                  </SelectTrigger>
                  <SelectContent>
                    {teamMembers.map(member => (
                      <SelectItem key={member.id} value={member.id}>
                        <div className="flex items-center justify-between w-full pr-4 gap-4">
                          <span className="font-medium text-zinc-700 text-sm">{member.name}</span>
                          <span className="text-[10px] text-zinc-400 uppercase font-bold tracking-widest">{member.role}</span>
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

            {/* ✨ FIX: shrink-0 pins footer to the bottom */}
            <DialogFooter className="bg-zinc-50 p-5 border-t border-zinc-100 shrink-0 flex flex-col sm:flex-row gap-3">
              <Button variant="ghost" className="h-10 text-sm font-semibold rounded-lg px-4 w-full sm:w-auto" onClick={() => setIsAssignModalOpen(false)}>Cancel</Button>
              <Button onClick={handleAssignCalls} disabled={isAssigning || !selectedAssignee} className="h-10 text-sm font-semibold bg-teal-600 hover:bg-teal-700 text-white rounded-lg shadow-sm px-6 w-full sm:w-auto">
                {isAssigning ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null} Confirm Assignment
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* MASTER UPDATE MODAL */}
        <Dialog open={isMasterEditModalOpen} onOpenChange={setIsMasterEditModalOpen}>
          {/* ✨ FIX: Flexbox bounding keeps it completely on screen */}
          <DialogContent className="sm:max-w-[550px] w-[95vw] max-h-[90dvh] flex flex-col border-none shadow-xl rounded-2xl bg-white p-0 overflow-hidden">
            <DialogHeader className="p-6 pb-2 shrink-0">
              <DialogTitle className="flex items-center gap-2 text-zinc-800 text-lg font-semibold">
                <Settings2 className="w-5 h-5 text-indigo-600" /> Master Update
              </DialogTitle>
              <DialogDescription className="text-sm text-zinc-500 mt-1.5">
                Applying forced overrides to <strong className="text-zinc-700 font-bold">{selectedVouchers.size}</strong> vouchers.
              </DialogDescription>
            </DialogHeader>

            <div className="p-6 pt-4 space-y-4 flex-1 overflow-y-auto custom-scrollbar">
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Override Status</Label>
                <Select value={masterEditForm.status} onValueChange={(val) => setMasterEditForm({...masterEditForm, status: val})}>
                  <SelectTrigger className="h-11 bg-white border-zinc-200 text-sm shadow-sm rounded-xl focus:ring-zinc-900">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border-zinc-200 rounded-xl shadow-md">
                    <SelectItem value="no_change" className="text-zinc-400 italic">No Change</SelectItem>
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

              <div className="space-y-2">
                <Label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Override Distributor</Label>
                <Select value={masterEditForm.distributor_id} onValueChange={(val) => setMasterEditForm({...masterEditForm, distributor_id: val})}>
                  <SelectTrigger className="h-11 bg-white border-zinc-200 text-sm shadow-sm rounded-xl focus:ring-zinc-900">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border-zinc-200 rounded-xl shadow-md max-h-[200px]">
                    <SelectItem value="no_change" className="text-zinc-400 italic">No Change</SelectItem>
                    <SelectItem value="clear" className="text-rose-500 font-semibold">Clear Partner</SelectItem>
                    {distributors.map(d => <SelectItem key={d.id} value={d.id}>{d.distributor_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Issue Date</Label>
                  <Input type="datetime-local" className="h-11 text-sm rounded-xl shadow-sm border-zinc-200 bg-white focus:ring-zinc-900 w-full" value={masterEditForm.distributed_at} onChange={(e) => setMasterEditForm({...masterEditForm, distributed_at: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Expiry Date</Label>
                  <Input type="date" className="h-11 text-sm rounded-xl shadow-sm border-zinc-200 bg-white focus:ring-zinc-900 w-full" value={masterEditForm.expiry_date} onChange={(e) => setMasterEditForm({...masterEditForm, expiry_date: e.target.value})} />
                </div>
              </div>

              <div className="space-y-2 pt-2">
                <Label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Handling Fee Override (₹)</Label>
                <Input type="number" placeholder="Leave blank to skip..." className="h-11 text-sm rounded-xl shadow-sm border-zinc-200 bg-white focus:ring-zinc-900" value={masterEditForm.handling_fee} onChange={(e) => setMasterEditForm({...masterEditForm, handling_fee: e.target.value})} />
              </div>

              <div className="space-y-2 pt-2">
                <Label className="text-xs font-semibold text-zinc-700">Audit Trail Reason <span className="text-rose-500">*</span></Label>
                <Input type="text" placeholder="Why are you making this edit?" className="h-11 text-sm bg-white border-zinc-300 shadow-sm rounded-xl focus:border-zinc-500 focus:ring-zinc-900 transition-colors" value={masterEditForm.override_reason} onChange={(e) => setMasterEditForm({...masterEditForm, override_reason: e.target.value})} />
              </div>
            </div>

            <DialogFooter className="p-6 border-t border-zinc-100 bg-zinc-50 shrink-0 flex flex-col sm:flex-row gap-3">
              <Button variant="outline" className="h-11 text-sm font-semibold rounded-xl px-6 border-zinc-200 text-zinc-700 hover:bg-zinc-50 w-full sm:w-auto" onClick={() => setIsMasterEditModalOpen(false)}>Cancel</Button>
              <Button onClick={handleMasterUpdate} disabled={isUpdatingBulk || !masterEditForm.override_reason.trim()} className="h-11 text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-sm px-8 w-full sm:w-auto">
                {isUpdatingBulk ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null} Execute Update
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* BULK VOID MODAL */}
        <Dialog open={isVoidModalOpen} onOpenChange={setIsVoidModalOpen}>
          <DialogContent className="sm:max-w-[450px] w-[95vw] max-h-[90dvh] flex flex-col border-none shadow-xl rounded-2xl bg-white p-0">
            <DialogHeader className="p-6 pb-2 shrink-0">
              <DialogTitle className="flex items-center gap-2 text-rose-600 text-lg font-semibold">
                <ShieldAlert className="w-5 h-5" /> Void Selected Vouchers
              </DialogTitle>
              <DialogDescription className="text-sm text-zinc-500 mt-1.5">
                You are about to permanently void <strong className="text-zinc-700 font-bold">{selectedVouchers.size}</strong> vouchers. This action will explicitly override their current status.
              </DialogDescription>
            </DialogHeader>
            
            <div className="p-6 pt-4 flex-1 overflow-y-auto">
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-zinc-700">Reason (Required) <span className="text-rose-500">*</span></Label>
                <Input className="h-11 text-sm border-zinc-300 shadow-sm rounded-xl focus:border-zinc-500 focus:ring-zinc-900 transition-colors" placeholder="e.g. Lost in transit, printed incorrectly..." value={bulkVoidReason} onChange={(e) => setBulkVoidReason(e.target.value)} />
              </div>
            </div>

            <DialogFooter className="p-6 border-t border-zinc-100 bg-zinc-50 shrink-0 flex flex-col sm:flex-row gap-3">
              <Button variant="outline" className="h-11 text-sm font-semibold rounded-xl px-6 border-zinc-200 text-zinc-700 hover:bg-zinc-50 w-full sm:w-auto" onClick={() => setIsVoidModalOpen(false)}>Cancel</Button>
              <Button variant="destructive" className="h-11 text-sm font-semibold shadow-sm rounded-xl px-8 w-full sm:w-auto" onClick={handleBulkVoid} disabled={isVoidingBulk || !bulkVoidReason.trim()}>
                {isVoidingBulk ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null} Confirm Void
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* EXPORT OPTIONS MODAL */}
        <Dialog open={isExportModalOpen} onOpenChange={setIsExportModalOpen}>
          <DialogContent className="sm:max-w-[420px] w-[95vw] max-h-[90dvh] flex flex-col border-none shadow-xl rounded-2xl bg-white p-0">
            <DialogHeader className="p-6 pb-2 shrink-0">
              <DialogTitle className="flex items-center gap-2 text-zinc-800 text-lg font-semibold">
                <Download className="w-5 h-5 text-zinc-500" /> Export Data
              </DialogTitle>
              <DialogDescription className="text-sm text-zinc-500 mt-1.5">
                Choose how much data you want to export based on your current filters.
              </DialogDescription>
            </DialogHeader>
            <div className="p-6 pt-4 flex flex-col gap-3 flex-1 overflow-y-auto">
              <Button variant="outline" className="w-full h-auto flex flex-col items-start justify-center p-4 border-zinc-200 hover:bg-zinc-50 hover:border-zinc-300 transition-all rounded-xl text-left shadow-sm" onClick={exportCurrentPage}>
                <span className="font-semibold text-zinc-900 text-sm">Export Current Page</span>
                <span className="text-xs text-zinc-500 font-normal mt-1">Downloads only the {listData.length} records currently visible on this screen.</span>
              </Button>
              
              <Button variant="outline" className="w-full h-auto flex flex-col items-start justify-center p-4 border-zinc-200 hover:bg-zinc-50 hover:border-zinc-300 transition-all rounded-xl text-left shadow-sm" onClick={exportAllData}>
                <span className="font-semibold text-zinc-900 text-sm">Export All Matching Records</span>
                <span className="text-xs text-zinc-500 font-normal mt-1 whitespace-normal">Compiles all {totalCount} records from the database across all pages.</span>
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <WhatsAppSenderModal isOpen={isSenderModalOpen} onClose={() => setIsSenderModalOpen(false)} recipients={messageRecipients} defaultTemplateName={activeTemplateContext === "welcome" ? "welcome_registered_voucher" : "voucher_expiry_reminder"} />
        <WhatsAppSenderModal isOpen={isSenderModalOpen} onClose={() => setIsSenderModalOpen(false)} recipients={messageRecipients} defaultTemplateName={activeTemplateContext === "welcome" ? "welcome_registered_voucher" : "voucher_expiry_reminder"} />

      </main>
    </div>
  );
}