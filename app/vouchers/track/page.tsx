"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { format, isPast, addDays } from "date-fns";
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
  ChevronLeft,
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
  ShieldAlert,
  MapPin,
  Phone,
  MessageCircle,
  ExternalLink,
  Download,
  Sparkles,
  X,
  BellRing,
  Megaphone,
  Trash2,
  ArrowUpDown // ✨ NEW ICON FOR SORTING
} from "lucide-react";

import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/hooks/useAuth"; 
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
  updated_at: string | null; // ✨ ADDED TO INTERFACE
  
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
}

export default function TrackVoucherPage() {
  const { toast } = useToast();
  const { appUser } = useAuth(); 
  
  // --- SINGLE LOOKUP STATE ---
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [voucher, setVoucher] = useState<TrackedVoucher | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [aiSummary, setAiSummary] = useState<string | null>(null);

  // --- MASTER LIST STATE (PAGINATED) ---
  const [listData, setListData] = useState<TrackedVoucher[]>([]);
  const [isListLoading, setIsListLoading] = useState(false);
  const [localSearch, setLocalSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(0);
  const [pageSize, setPageSize] = useState(50); 
  const [totalCount, setTotalCount] = useState(0);

  // --- ADVANCED FILTERS STATE ---
  const [activeFilter, setActiveFilter] = useState("all");
  const [distributors, setDistributors] = useState<any[]>([]);
  const [batches, setBatches] = useState<any[]>([]);
  const [selectedFilterDistributor, setSelectedFilterDistributor] = useState("all");
  const [selectedFilterBatch, setSelectedFilterBatch] = useState("all");
  
  // ✨ NEW: SORTING STATE
  const [sortOrder, setSortOrder] = useState("newest"); // Defaulting to newest activity

  // --- BULK ACTION STATE ---
  const [selectedVouchers, setSelectedVouchers] = useState<Set<string>>(new Set());
  const [bulkHandlingFee, setBulkHandlingFee] = useState("");
  const [bulkExpiryDate, setBulkExpiryDate] = useState(""); 
  const [bulkOverrideReason, setBulkOverrideReason] = useState("");
  const [isUpdatingBulk, setIsUpdatingBulk] = useState(false);

  // --- BULK VOID MODAL STATE ---
  const [isVoidModalOpen, setIsVoidModalOpen] = useState(false);
  const [bulkVoidReason, setBulkVoidReason] = useState("");
  const [isVoidingBulk, setIsVoidingBulk] = useState(false);

  // --- CUSTOMER MODAL STATE ---
  const [selectedCustomer, setSelectedCustomer] = useState<{ id: string, full_name: string, phone: string, voucherCode: string } | null>(null);

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

  // ✨ UPDATED: Added sortOrder to dependencies
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchVoucherList(activeFilter, currentPage, localSearch, sortOrder);
    }, 400); 
    return () => clearTimeout(timer);
  }, [activeFilter, selectedFilterDistributor, selectedFilterBatch, currentPage, localSearch, pageSize, sortOrder]);

  // ✨ UPDATED: Added sortDirection parameter
  const fetchVoucherList = async (tabStatus: string, page: number, searchKeyword: string, currentSort: string) => {
    setIsListLoading(true);
    try {
      let query = supabase
        .from("vouchers")
        .select(`
          id, code, discount_value, handling_fee, status, expiry_date, distributed_at, redeemed_at,
          is_manual_override, updated_by_user, scan_count, last_scanned_at, updated_at,
          voucher_batches (batch_no),
          voucher_distributors (distributor_name, distributor_type, phone),
          voucher_distributions (payment_status, delivery_agent),
          customers (id, full_name, phone, convo360_user_id),
          last_scanned_warehouse:warehouses!last_scanned_warehouse_id(name)
        `, { count: 'exact' });

      // ✨ NEW: Apply Dynamic Sorting
      if (currentSort === 'newest') {
        query = query.order('updated_at', { ascending: false, nullsFirst: false });
      } else if (currentSort === 'oldest') {
        query = query.order('updated_at', { ascending: true, nullsFirst: false });
      } else if (currentSort === 'code_desc') {
        query = query.order('code', { ascending: false });
      } else {
        query = query.order('code', { ascending: true }); // Default code_asc
      }

      query = query.range(page * pageSize, (page + 1) * pageSize - 1);

      const todayIso = new Date().toISOString();
      
      if (tabStatus === "expired") {
        query = query.in("status", ["distributed", "in_stock", "registered"]).lt("expiry_date", todayIso);
      } else if (tabStatus !== "all") {
        query = query.eq("status", tabStatus);
      }

      if (selectedFilterDistributor !== "all") query = query.eq("distributor_id", selectedFilterDistributor);
      if (selectedFilterBatch !== "all") query = query.eq("batch_id", selectedFilterBatch);
      if (searchKeyword.trim()) query = query.ilike("code", `%${searchKeyword.trim()}%`);

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

  const executeRemindExpiring = async () => {
    setIsQueryingExpiry(true);
    setRemindError(null); 
    
    try {
      const today = new Date();
      const targetDate = addDays(today, parseInt(remindDays));

      let query = supabase
        .from("vouchers")
        .select(`
          code, 
          expiry_date, 
          status,
          voucher_distributors (*),
          customers (*)
        `)
        .gte("expiry_date", today.toISOString())
        .lte("expiry_date", targetDate.toISOString());

      if (remindStatus === 'both') {
        query = query.in("status", ["distributed", "registered"]);
      } else {
        query = query.eq("status", remindStatus);
      }

      const { data, error } = await query;

      if (error) throw error;
      
      if (!data || data.length === 0) {
        setRemindError(`No vouchers found expiring within the next ${remindDays} days for the selected statuses.`);
        return;
      }

      const recipientsMap = new Map();
      
      data.forEach((v: any) => {
        const dist = Array.isArray(v.voucher_distributors) ? v.voucher_distributors[0] : v.voucher_distributors;
        const cust = Array.isArray(v.customers) ? v.customers[0] : v.customers;

        const rawPhone = v.status === 'registered' ? cust?.phone : (dist?.phone || cust?.phone);
        const name = v.status === 'registered' ? cust?.full_name : (dist?.distributor_name || cust?.full_name || 'Valued Customer');
        
        if (rawPhone) {
          let cleanPhone = String(rawPhone).replace(/\D/g, '');
          if (cleanPhone.length === 10) cleanPhone = '91' + cleanPhone;
          
          const formattedExpiry = v.expiry_date ? format(new Date(v.expiry_date), 'dd MMM yyyy') : 'soon';

          if (!recipientsMap.has(cleanPhone)) {
            recipientsMap.set(cleanPhone, {
              phone: cleanPhone,
              name: name,
              user_id: cust?.convo360_user_id || undefined,
              customer_db_id: cust?.id || undefined,
              voucher_code: v.code,
              expiry_date: formattedExpiry,
              templateParams: [name, formattedExpiry],
            });
          }
        }
      });

      const recipients = Array.from(recipientsMap.values());
      
      if (recipients.length === 0) {
        setRemindError("Found expiring vouchers, but none have a valid phone number associated with them.");
        return;
      }

      setIsRemindModalOpen(false);
      setMessageRecipients(recipients);
      setActiveTemplateContext("reminder");
      setIsSenderModalOpen(true);

    } catch (err: any) {
      setRemindError(err.message || "A database error occurred.");
    } finally {
      setIsQueryingExpiry(false);
    }
  };

  const handleBroadcastRegistered = async () => {
    setIsQueryingRegistered(true);
    try {
      const { data, error } = await supabase
        .from("vouchers")
        .select(`
          code, 
          expiry_date, 
          customers (*)
        `)
        .eq("status", "registered");

      if (error) throw error;
      
      if (!data || data.length === 0) {
        return toast({ 
          title: "No Registered Vouchers", 
          description: "There are no vouchers currently in the registered state.",
          variant: "destructive"
        });
      }

      const recipientsMap = new Map();
      
      data.forEach((v: any) => {
        const cust = Array.isArray(v.customers) ? v.customers[0] : v.customers;
        const rawPhone = cust?.phone;
        const name = cust?.full_name || 'Valued Customer';
        
        if (rawPhone) {
          let cleanPhone = String(rawPhone).replace(/\D/g, '');
          if (cleanPhone.length === 10) cleanPhone = '91' + cleanPhone;
          
          const formattedExpiry = v.expiry_date ? format(new Date(v.expiry_date), 'dd MMM yyyy') : 'soon';

          if (!recipientsMap.has(cleanPhone)) {
            recipientsMap.set(cleanPhone, {
              phone: cleanPhone,
              name: name,
              user_id: cust?.convo360_user_id || undefined,
              customer_db_id: cust?.id || undefined,
              voucher_code: v.code,
              expiry_date: formattedExpiry,
              templateParams: [name, formattedExpiry],
            });
          }
        }
      });

      const recipients = Array.from(recipientsMap.values());
      
      if (recipients.length === 0) {
        return toast({ 
          title: "Missing Contact Data", 
          description: "Found registered vouchers, but none have a valid phone number.",
          variant: "destructive"
        });
      }

      setMessageRecipients(recipients);
      setActiveTemplateContext("welcome");
      setIsSenderModalOpen(true);

    } catch (err: any) {
      toast({ title: "Query Failed", description: err.message, variant: "destructive" });
    } finally {
      setIsQueryingRegistered(false);
    }
  };

  const generateAIOverview = (v: TrackedVoucher) => {
    const isExpired = v.expiry_date && isPast(new Date(v.expiry_date));
    let text = `Voucher ${v.code} is currently `;
    
    if (isExpired && (v.status === 'distributed' || v.status === 'in_stock' || v.status === 'registered')) {
       text += `expired. It carried a discount value of ₹${v.discount_value.toLocaleString()} `;
    } else {
       text += `marked as ${v.status.replace('_', ' ')}. It carries a discount value of ₹${v.discount_value.toLocaleString()} `;
    }

    if (v.voucher_distributors) {
      text += `and was issued to partner ${v.voucher_distributors.distributor_name}. `;
    } else {
      text += `and has not been assigned to a distributor yet. `;
    }

    if (v.customers) {
      text += `It is securely registered to customer ${v.customers.full_name}. `;
    }

    if (v.scan_count > 0) {
      text += `The system has logged ${v.scan_count} verification scans for this tag.`;
    }

    setAiSummary(text);
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    
    setIsSearching(true);
    setHasSearched(true);
    setVoucher(null);
    setAiSummary(null);

    try {
      const { data, error } = await supabase
        .from("vouchers")
        .select(`
          *, 
          voucher_batches (batch_no, created_at, received_at), 
          voucher_distributors (distributor_name, distributor_type), 
          voucher_distributions (payment_status, delivery_agent), 
          customers (id, full_name, phone),
          last_scanned_warehouse:warehouses!last_scanned_warehouse_id(name)
        `)
        .ilike("code", `%${searchQuery.trim()}%`)
        .limit(1)
        .maybeSingle();

      if (error) throw new Error(error.message || JSON.stringify(error));
      
      if (!data) {
        setAiSummary(`I searched the entire vault but couldn't find any voucher matching "${searchQuery}". Please check the alphanumeric code and try again.`);
        setVoucher(null);
      } else {
        setVoucher(data as TrackedVoucher);
        generateAIOverview(data as TrackedVoucher);
      }
    } catch (error: any) {
      toast({ title: "Search Failed", description: error.message, variant: "destructive" });
    } finally {
      setIsSearching(false);
    }
  };

  const handleBulkUpdate = async () => {
    if (selectedVouchers.size === 0) return;
    if (bulkHandlingFee.trim() === "" && bulkExpiryDate.trim() === "") return toast({ title: "Action Required", description: "Enter a handling fee or select an expiry date.", variant: "destructive" });
    if (bulkOverrideReason.trim() === "") return toast({ title: "Reason Required", description: "Provide a reason for overriding.", variant: "destructive" });

    setIsUpdatingBulk(true);
    try {
      const updates: any = {};
      if (bulkHandlingFee.trim() !== "") updates.handling_fee = Number(bulkHandlingFee);
      if (bulkExpiryDate.trim() !== "") updates.expiry_date = bulkExpiryDate;
      updates.is_manual_override = true; 
      
      const userIdent = appUser?.email?.split('@')[0] || 'Staff';
      updates.updated_by_user = `${userIdent}: ${bulkOverrideReason.trim()}`; 

      const idsToUpdate = Array.from(selectedVouchers);
      const { error } = await supabase.from("vouchers").update(updates).in("id", idsToUpdate);
      if (error) throw error;

      toast({ title: "Bulk Update Successful", description: `Updated ${idsToUpdate.length} vouchers.` });
      fetchVoucherList(activeFilter, currentPage, localSearch, sortOrder);
      setSelectedVouchers(new Set());
      setBulkHandlingFee("");
      setBulkExpiryDate("");
      setBulkOverrideReason("");
    } catch (error: any) {
      toast({ title: "Update Failed", description: error.message, variant: "destructive" });
    } finally {
      setIsUpdatingBulk(false);
    }
  };

  const handleBulkVoid = async () => {
    if (selectedVouchers.size === 0) return;
    if (bulkVoidReason.trim() === "") return toast({ title: "Reason Required", description: "Provide a reason for voiding these vouchers.", variant: "destructive" });

    setIsVoidingBulk(true);
    try {
      const userIdent = appUser?.email?.split('@')[0] || 'Staff';
      const updates = {
        status: 'voided',
        is_manual_override: true,
        updated_by_user: `${userIdent} (VOIDED): ${bulkVoidReason.trim()}`
      };

      const idsToUpdate = Array.from(selectedVouchers);
      const { error } = await supabase.from("vouchers").update(updates).in("id", idsToUpdate);
      if (error) throw error;

      toast({ title: "Vouchers Voided", description: `Successfully voided ${idsToUpdate.length} vouchers.` });
      fetchVoucherList(activeFilter, currentPage, localSearch, sortOrder);
      setSelectedVouchers(new Set());
      setBulkVoidReason("");
      setIsVoidModalOpen(false);
    } catch (error: any) {
      toast({ title: "Void Failed", description: error.message, variant: "destructive" });
    } finally {
      setIsVoidingBulk(false);
    }
  };

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

  const StatusBadge = ({ status }: { status: string }) => {
    switch (status) {
      case 'pending_print': return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200 text-[10px] font-bold h-5 px-1.5 uppercase">Pending</Badge>;
      case 'in_stock': return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-[10px] font-bold h-5 px-1.5 uppercase">In Stock</Badge>;
      case 'distributed': return <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 text-[10px] font-bold h-5 px-1.5 uppercase">Issued</Badge>;
      case 'registered': return <Badge variant="outline" className="bg-teal-50 text-teal-700 border-teal-200 text-[10px] font-bold h-5 px-1.5 uppercase">Registered</Badge>;
      case 'redeemed': return <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] font-bold h-5 px-1.5 uppercase">Redeemed</Badge>;
      case 'expired':
      case 'voided': return <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200 text-[10px] font-bold h-5 px-1.5 uppercase">{status}</Badge>;
      default: return <Badge variant="secondary" className="text-[10px] h-5 uppercase">{status}</Badge>;
    }
  };

  const getWhatsAppLink = (phone: string) => {
    const cleanPhone = phone.replace(/\D/g, '');
    const finalPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
    return `https://wa.me/${finalPhone}`;
  };

  const downloadCSV = () => {
    if (listData.length === 0) {
      return toast({ title: "No Data", description: "There is no data to export matching your current filters." });
    }

    const headers = [
      "Voucher Code", 
      "Batch No", 
      "Current Status", 
      "Discount Value (INR)", 
      "Handling Fee (INR)",
      "Scan Attempts", 
      "Partner / Distributor", 
      "Registered Customer", 
      "Customer Phone",
      "Expiry Date", 
      "Redeemed Date",
      "Last Updated"
    ];

    const csvRows = listData.map(v => [
      v.code,
      v.voucher_batches?.batch_no || '',
      getDisplayStatus(v).toUpperCase(),
      v.discount_value,
      v.handling_fee || 0,
      v.scan_count || 0,
      v.voucher_distributors?.distributor_name || 'Unassigned',
      v.customers?.full_name || 'None',
      v.customers?.phone || 'None',
      v.expiry_date ? format(new Date(v.expiry_date), "yyyy-MM-dd") : 'None',
      v.redeemed_at ? format(new Date(v.redeemed_at), "yyyy-MM-dd") : 'None',
      v.updated_at ? format(new Date(v.updated_at), "yyyy-MM-dd HH:mm") : 'None'
    ].map(field => `"${String(field).replace(/"/g, '""')}"`).join(","));

    const csvContent = [headers.join(","), ...csvRows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Vouchers_Page${currentPage+1}_Export_${format(new Date(), "yyyyMMdd_HHmm")}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({ title: "Export Started", description: "Your CSV file is downloading." });
  };

  const canBulkUpdate = ["all", "pending_print", "in_stock", "distributed", "registered", "expired"].includes(activeFilter);
  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <div className="flex flex-col min-h-screen bg-transparent font-sans selection:bg-indigo-100">
      
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes geminiGlow { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }
        .gemini-bg { background: linear-gradient(90deg, #4285F4, #9b72cb, #d96570, #4285F4); background-size: 300% 100%; animation: geminiGlow 6s linear infinite; }
      `}} />

      {/* --- ENTERPRISE IDE-STYLE TOOLBAR HEADER --- */}
      <header className="sticky top-0 z-40 w-full bg-white border-b border-slate-200 px-4 h-14 flex items-center justify-between shadow-sm box-border">
        <div className="flex items-center gap-3 overflow-hidden">
          <Link href="/vouchers">
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-md hover:bg-slate-100 transition-colors">
              <ArrowLeft className="h-4 w-4 text-slate-500" />
            </Button>
          </Link>
          
          <div className="h-4 w-[1px] bg-slate-200 hidden sm:block" />
          
          <nav className="flex items-center gap-1.5 text-[13px] whitespace-nowrap overflow-hidden">
            <Link href="/vouchers" className="text-slate-500 hover:text-slate-900 transition-colors font-medium">Vouchers</Link>
            <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
            <span className="font-bold text-slate-900 select-none">Track & Audit</span>
            
            <div className="ml-3 hidden md:flex items-center gap-1.5 px-2 py-0.5 rounded bg-emerald-50 border border-emerald-100">
              <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-widest">Live Database</span>
            </div>
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="h-8 px-2 text-xs font-semibold text-slate-500 hover:text-slate-900" onClick={() => fetchVoucherList(activeFilter, currentPage, localSearch, sortOrder)}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isListLoading ? "animate-spin text-indigo-500" : ""}`} />
            Refresh
          </Button>
          <div className="h-4 w-[1px] bg-slate-200 mx-1" />
          <Button size="sm" className="h-8 text-xs font-bold px-3 bg-slate-900 hover:bg-slate-800 text-white rounded-lg shadow-sm" onClick={() => { setCurrentPage(0); setLocalSearch(""); }}>
            <Database className="h-3.5 w-3.5 mr-1.5" />
            Sync Data
          </Button>
        </div>
      </header>

      <main className="p-4 md:p-6 lg:p-8 max-w-[1500px] w-full mx-auto space-y-8">
        
        {/* --- 1. SINGLE VOUCHER LOOKUP SECTION --- */}
        <section className="space-y-4 animate-in fade-in zoom-in-95 duration-200">
          <div className="flex flex-col xl:flex-row gap-6">
            
            <div className="flex-1 max-w-xl">
              <Card className="shadow-sm border-slate-200 overflow-hidden bg-white rounded-xl h-full">
                <CardHeader className="bg-slate-50 py-3 px-4 border-b border-slate-100">
                  <h3 className="text-[11px] font-bold uppercase tracking-widest text-slate-500">Intelligent Lookup</h3>
                </CardHeader>
                <CardContent className="pt-6 pb-6 px-5 flex flex-col justify-center">
                  
                  {/* ✨ GEMINI INSPIRED SEARCH BAR ✨ */}
                  <form onSubmit={handleSearch} className="relative w-full group">
                    <div className="absolute -inset-[2px] rounded-[14px] bg-gradient-to-r from-[#4285F4] via-[#9b72cb] to-[#d96570] blur-md opacity-0 group-focus-within:opacity-25 transition-opacity duration-500"></div>
                    
                    <div className="relative flex items-center bg-white rounded-xl ring-1 ring-slate-200 shadow-sm p-1.5 z-10 transition-all focus-within:ring-0 focus-within:border-transparent">
                      <div className="pl-3 pr-2 text-[#0052FF]">
                        <Sparkles className="w-5 h-5" />
                      </div>
                      <Input
                        placeholder="Ask for a voucher code..."
                        className="flex-1 h-11 border-0 outline-none ring-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 bg-transparent text-[15px] font-bold font-mono placeholder:text-slate-400 placeholder:font-sans uppercase"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                      />
                      <div className="pr-2 flex items-center gap-2">
                        {searchQuery && (
                          <button 
                            type="button"
                            onClick={() => { setSearchQuery(''); setVoucher(null); setAiSummary(null); }}
                            className="p-1.5 text-slate-400 hover:text-rose-500 bg-slate-50 hover:bg-rose-50 rounded-md transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                        <Button type="submit" disabled={isSearching || !searchQuery.trim()} className="h-9 px-4 font-bold text-xs uppercase tracking-widest bg-[#0052FF] hover:bg-blue-700 text-white rounded-lg shadow-sm">
                          {isSearching ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Search className="h-4 w-4 mr-2" />}
                          Locate
                        </Button>
                      </div>
                    </div>
                  </form>
                  
                  <p className="text-xs text-slate-400 font-medium mt-4 text-center">Scan a physical voucher or manually type the exact code to view its live telemetry and logistics trail.</p>

                </CardContent>
              </Card>
            </div>

            {/* --- AI SUMMARY & VOUCHER DETAILS --- */}
            {(hasSearched) && (
              <div className="w-full xl:flex-1 space-y-4">
                
                {/* AI SUMMARY BOX */}
                {isSearching ? (
                  <div className="bg-gradient-to-r from-blue-50/50 to-indigo-50/50 rounded-xl p-5 border border-blue-100/50 shadow-inner animate-in fade-in duration-300">
                    <div className="flex items-center gap-2 mb-4">
                      <Sparkles className="w-5 h-5 text-indigo-500 animate-pulse" />
                      <span className="text-[11px] uppercase tracking-widest font-black text-indigo-900 animate-pulse">AI is querying the vault...</span>
                    </div>
                    <div className="space-y-3">
                      <Skeleton className="h-3 w-full bg-indigo-100/50 rounded-full" />
                      <Skeleton className="h-3 w-[85%] bg-indigo-100/50 rounded-full" />
                      <Skeleton className="h-3 w-[60%] bg-indigo-100/50 rounded-full" />
                    </div>
                  </div>
                ) : aiSummary && (
                  <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-5 border border-blue-100 shadow-sm animate-in slide-in-from-bottom-2 duration-300">
                     <div className="flex items-center gap-2 mb-2">
                       <Sparkles className="w-4 h-4 text-[#0052FF]" />
                       <span className="text-[10px] uppercase tracking-widest font-black text-[#0052FF]">AI Overview</span>
                     </div>
                     <p className="text-sm text-slate-800 font-medium leading-relaxed">
                       {aiSummary}
                     </p>
                  </div>
                )}

                {/* SINGLE VOUCHER DETAILS */}
                {!isSearching && voucher && (
                  <Card className="shadow-sm border-slate-200 overflow-hidden bg-white rounded-xl animate-in slide-in-from-bottom-4 duration-500">
                    <CardHeader className="bg-slate-50 py-3 px-4 border-b border-slate-100">
                      <div className="flex justify-between items-center">
                        <h3 className="text-[11px] font-bold uppercase tracking-widest text-slate-500">Live Telemetry</h3>
                        <StatusBadge status={getDisplayStatus(voucher)} />
                      </div>
                    </CardHeader>
                    <CardContent className="p-0">
                      
                      {/* Top Row: Core Values */}
                      <div className="p-5 grid grid-cols-2 md:grid-cols-4 gap-4 bg-white">
                        <div className="col-span-2 md:col-span-2">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1.5">Voucher Code</p>
                          <p className="text-2xl font-mono font-black text-slate-900 tracking-tight">{voucher.code}</p>
                        </div>
                        <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1.5">Handling Fee</p>
                            <p className="text-lg font-bold text-slate-700">₹{voucher.handling_fee || 0}</p>
                        </div>
                        <div className="text-right">
                            <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest leading-none mb-1.5">Discount Value</p>
                            <p className="text-2xl font-black text-emerald-600">₹{voucher.discount_value.toLocaleString()}</p>
                        </div>
                      </div>
                      
                      {/* Middle Row: Tracking & Distribution */}
                      <div className="p-5 bg-slate-50/50 border-t border-b border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-6">
                        
                        {/* Left: Location & Scans */}
                        <div className="space-y-4">
                          <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5 mb-3">
                              <MapPin className="w-3.5 h-3.5"/> Location Trail
                            </p>
                            <div className="space-y-3">
                              <div className="flex items-start gap-2.5">
                                <div className="w-2 h-2 rounded-full bg-slate-300 mt-1" />
                                <div>
                                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider leading-none">Created (Batch: {voucher.voucher_batches.batch_no})</p>
                                  <p className="text-xs font-bold text-slate-900 mt-1">System Generation</p>
                                </div>
                              </div>
                              <div className="flex items-start gap-2.5 border-l-2 border-slate-200 ml-[3px] pl-[13px] py-1">
                                <div>
                                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider leading-none">Last Scanned Location</p>
                                  <p className="text-xs font-bold text-[#0052FF] mt-1">
                                    {voucher.last_scanned_warehouse?.name || <span className="text-slate-400 italic">Unscanned</span>}
                                  </p>
                                  {voucher.last_scanned_at && (
                                    <p className="text-[10px] font-mono text-slate-400 mt-1">{format(new Date(voucher.last_scanned_at), "dd MMM yyyy, HH:mm")}</p>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center justify-between bg-white border border-slate-200 rounded-lg p-3 shadow-sm">
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                              <ScanFace className="w-4 h-4 text-[#0052FF]"/> Total Verification Scans
                            </p>
                            <Badge variant="secondary" className="bg-blue-50 text-[#0052FF] font-bold shadow-none">{voucher.scan_count || 0}</Badge>
                          </div>
                        </div>

                        {/* Right: Partner & Customer */}
                        <div className="space-y-4">
                          {voucher.voucher_distributors ? (
                            <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5 mb-2">
                                <Store className="w-3.5 h-3.5"/> Issued Partner
                              </p>
                              <p className="text-sm font-bold text-slate-900">{voucher.voucher_distributors.distributor_name}</p>
                              <div className="flex items-center gap-3 mt-3 pt-3 border-t border-slate-100">
                                {voucher.voucher_distributions?.delivery_agent && (
                                  <span className="text-[10px] font-medium text-slate-500 flex items-center gap-1"><Truck className="w-3.5 h-3.5"/> {voucher.voucher_distributions.delivery_agent}</span>
                                )}
                                {voucher.voucher_distributions && (
                                  <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded border ${voucher.voucher_distributions.payment_status === 'paid' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-amber-50 text-amber-600 border-amber-100'}`}>
                                    {voucher.voucher_distributions.payment_status}
                                  </span>
                                )}
                              </div>
                            </div>
                          ) : (
                            <div className="bg-white border border-slate-200 border-dashed rounded-lg p-4 flex flex-col items-center justify-center text-center h-[96px]">
                              <Store className="w-5 h-5 text-slate-300 mb-1.5" />
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Not Issued to Partner</p>
                            </div>
                          )}

                          {/* ✨ INTERACTIVE CUSTOMER BLOCK */}
                          {voucher.customers ? (
                            <div 
                              className="bg-teal-50 border border-teal-200 rounded-lg p-4 relative overflow-hidden cursor-pointer hover:bg-teal-100 hover:border-teal-300 transition-all group shadow-sm"
                              onClick={() => setSelectedCustomer({ ...voucher.customers!, voucherCode: voucher.code })}
                            >
                              <div className="absolute right-2 top-2 opacity-10 group-hover:scale-110 group-hover:opacity-20 transition-all"><User className="w-12 h-12 text-teal-600"/></div>
                              <p className="text-[10px] font-bold text-teal-700 uppercase tracking-widest flex items-center gap-1.5 mb-2 relative z-10">
                                <CheckCircle2 className="w-3.5 h-3.5"/> Registered Customer <ExternalLink className="w-3 h-3 ml-auto opacity-50 group-hover:opacity-100" />
                              </p>
                              <p className="text-sm font-bold text-teal-950 relative z-10">{voucher.customers.full_name}</p>
                              <p className="text-xs font-medium text-teal-800 flex items-center gap-1 mt-1.5 relative z-10">
                                <Phone className="w-3.5 h-3.5"/> {voucher.customers.phone}
                              </p>
                            </div>
                          ) : (
                            <div className="bg-white border border-slate-200 border-dashed rounded-lg p-4 flex flex-col items-center justify-center text-center h-[96px]">
                              <User className="w-5 h-5 text-slate-300 mb-1.5" />
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">No Customer Registered</p>
                            </div>
                          )}
                        </div>

                      </div>

                      {/* Bottom Row: Overrides & Logs */}
                      {voucher.is_manual_override && (
                         <div className="p-4 bg-rose-50 flex items-center gap-3">
                           <div className="bg-rose-100 p-2 rounded">
                             <ShieldAlert className="w-4 h-4 text-rose-600" />
                           </div>
                           <div>
                             <p className="text-[10px] font-bold text-rose-600 uppercase tracking-widest">System Override Executed</p>
                             <p className="text-[12px] font-medium text-rose-800 mt-0.5">{voucher.updated_by_user}</p>
                           </div>
                         </div>
                      )}

                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </div>
        </section>

        <Separator className="bg-slate-200" />

        {/* --- 2. MASTER FILTERABLE LIST SECTION --- */}
        <section className="space-y-4 animate-in fade-in duration-300">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex flex-col gap-1">
              <h2 className="text-lg font-bold text-slate-900 tracking-tight">Voucher Master Ledger</h2>
              <p className="text-[13px] font-medium text-slate-500">View, filter, and track campaign engagement metrics across all distributions.</p>
            </div>
            
            <div className="flex flex-wrap items-center gap-2">
              <Button 
                onClick={() => {
                  setRemindError(null);
                  setIsRemindModalOpen(true);
                }} 
                disabled={isQueryingExpiry}
                className="bg-amber-500 hover:bg-amber-600 text-white shadow-sm font-bold text-xs h-9"
              >
                <BellRing className="w-4 h-4 mr-2" />
                Remind Expiring
              </Button>

              <Button 
                onClick={handleBroadcastRegistered} 
                disabled={isQueryingRegistered}
                className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm font-bold text-xs h-9"
              >
                {isQueryingRegistered ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Megaphone className="w-4 h-4 mr-2" />}
                Broadcast to Registered
              </Button>

              <Button 
                variant="outline" 
                className="bg-white border-slate-200 text-slate-700 hover:bg-slate-50 shadow-sm font-bold text-xs h-9"
                onClick={downloadCSV}
                disabled={listData.length === 0}
              >
                <Download className="w-4 h-4 mr-2 text-slate-400" />
                Export Page ({listData.length})
              </Button>
            </div>
          </div>

          <Card className="shadow-sm border-slate-200 overflow-hidden bg-white rounded-xl">
            
            {/* --- ADVANCED UNIFIED FILTER BAR --- */}
            <div className="bg-slate-50 border-b border-slate-200 p-4 flex flex-col xl:flex-row items-start xl:items-center gap-4">
              <div className="flex items-center gap-2 text-slate-500 w-full xl:w-auto shrink-0">
                <Filter className="w-4 h-4 text-[#0052FF]" />
                <span className="text-[11px] font-bold uppercase tracking-widest text-[#0052FF]">Database Filters:</span>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:flex lg:flex-row flex-wrap items-center gap-3 w-full">
                
                {/* Local Search */}
                <div className="relative w-full lg:w-[180px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <Input 
                    placeholder="Search codes..." 
                    className="pl-9 h-9 text-xs bg-white border-slate-200 shadow-sm font-medium rounded-lg"
                    value={localSearch}
                    onChange={(e) => {
                      setLocalSearch(e.target.value);
                      setCurrentPage(0);
                    }}
                  />
                </div>

                <Select value={activeFilter} onValueChange={(val) => { setActiveFilter(val); setCurrentPage(0); }}>
                  <SelectTrigger className="w-full lg:w-[140px] h-9 text-xs bg-white border-slate-200 font-semibold text-slate-700 shadow-sm rounded-lg">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent className="border-slate-200 rounded-lg">
                    <SelectItem value="all" className="text-xs font-bold text-[#0052FF]">All Statuses</SelectItem>
                    <SelectItem value="pending_print" className="text-xs font-medium">Pending Print</SelectItem>
                    <SelectItem value="in_stock" className="text-xs font-medium">In Stock</SelectItem>
                    <SelectItem value="distributed" className="text-xs font-medium">Issued / Active</SelectItem>
                    <SelectItem value="registered" className="text-xs font-medium">Registered (App)</SelectItem>
                    <SelectItem value="redeemed" className="text-xs font-medium">Redeemed</SelectItem>
                    <SelectItem value="expired" className="text-xs font-medium">Expired</SelectItem>
                    <SelectItem value="voided" className="text-xs font-medium">Voided</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={selectedFilterDistributor} onValueChange={(val) => { setSelectedFilterDistributor(val); setCurrentPage(0); }}>
                  <SelectTrigger className="w-full lg:w-[160px] h-9 text-xs bg-white border-slate-200 font-semibold text-slate-700 shadow-sm rounded-lg">
                    <SelectValue placeholder="All Partners" />
                  </SelectTrigger>
                  <SelectContent className="border-slate-200 rounded-lg">
                    <SelectItem value="all" className="text-xs font-bold text-[#0052FF]">All Partners</SelectItem>
                    {distributors.map(d => (
                      <SelectItem key={d.id} value={d.id} className="text-xs font-medium">{d.distributor_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={selectedFilterBatch} onValueChange={(val) => { setSelectedFilterBatch(val); setCurrentPage(0); }}>
                  <SelectTrigger className="w-full lg:w-[140px] h-9 text-xs bg-white border-slate-200 font-semibold text-slate-700 shadow-sm rounded-lg">
                    <SelectValue placeholder="All Batches" />
                  </SelectTrigger>
                  <SelectContent className="border-slate-200 rounded-lg">
                    <SelectItem value="all" className="text-xs font-bold text-[#0052FF]">All Batches</SelectItem>
                    {batches.map(b => (
                      <SelectItem key={b.id} value={b.id} className="text-xs font-medium">{b.batch_no}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* ✨ NEW: SORTING DROPDOWN */}
                <Select value={sortOrder} onValueChange={(val) => { setSortOrder(val); setCurrentPage(0); }}>
                  <SelectTrigger className="w-full lg:w-[160px] h-9 text-xs bg-white border-slate-200 font-semibold text-slate-700 shadow-sm rounded-lg">
                    <div className="flex items-center gap-1.5"><ArrowUpDown className="w-3.5 h-3.5 text-slate-400" /> <SelectValue placeholder="Sort By" /></div>
                  </SelectTrigger>
                  <SelectContent className="border-slate-200 rounded-lg">
                    <SelectItem value="newest" className="text-xs font-medium">Newest First</SelectItem>
                    <SelectItem value="oldest" className="text-xs font-medium">Oldest First</SelectItem>
                    <SelectItem value="code_asc" className="text-xs font-medium">Code (A-Z)</SelectItem>
                    <SelectItem value="code_desc" className="text-xs font-medium">Code (Z-A)</SelectItem>
                  </SelectContent>
                </Select>

                {(selectedFilterDistributor !== "all" || selectedFilterBatch !== "all" || activeFilter !== "all" || localSearch || sortOrder !== "newest") && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-9 text-xs font-bold text-rose-500 hover:bg-rose-50 hover:text-rose-600 rounded-lg ml-auto lg:ml-0"
                    onClick={() => { 
                      setSelectedFilterDistributor("all"); 
                      setSelectedFilterBatch("all"); 
                      setActiveFilter("all");
                      setLocalSearch("");
                      setSortOrder("newest"); // Reset sorting
                      setCurrentPage(0);
                    }}
                  >
                    Clear All
                  </Button>
                )}
              </div>
            </div>

            {/* BULK ACTION BAR */}
            {canBulkUpdate && selectedVouchers.size > 0 && (
              <div className="bg-blue-50/80 border-b border-blue-100 p-4 flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4 animate-in slide-in-from-top-2">
                <div className="flex items-center gap-2 shrink-0">
                  <CheckSquare className="h-4 w-4 text-[#0052FF]" />
                  <span className="text-sm font-bold text-blue-900">{selectedVouchers.size} Selected</span>
                </div>
                <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
                  <div className="relative">
                    <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                    <Input 
                      type="number"
                      placeholder="Fee..." 
                      className="pl-8 h-9 text-xs w-full sm:w-28 bg-white border-blue-200 focus-visible:ring-[#0052FF] rounded-lg shadow-sm"
                      value={bulkHandlingFee}
                      onChange={(e) => setBulkHandlingFee(e.target.value)}
                    />
                  </div>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                    <Input 
                      type="date"
                      className="pl-8 pr-3 h-9 text-xs w-full sm:w-36 bg-white border-blue-200 focus-visible:ring-[#0052FF] rounded-lg shadow-sm"
                      value={bulkExpiryDate}
                      onChange={(e) => setBulkExpiryDate(e.target.value)}
                    />
                  </div>
                  <div className="relative flex-1 sm:w-64 min-w-[200px]">
                    <FileEdit className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                    <Input 
                      type="text"
                      placeholder="Reason for override (Required)..." 
                      className="pl-8 h-9 text-xs w-full bg-white border-blue-200 focus-visible:ring-[#0052FF] rounded-lg shadow-sm"
                      value={bulkOverrideReason}
                      onChange={(e) => setBulkOverrideReason(e.target.value)}
                    />
                  </div>
                  <Button 
                    size="sm" 
                    className="h-9 text-xs font-bold bg-[#0052FF] hover:bg-blue-700 text-white w-full sm:w-auto shadow-sm rounded-lg"
                    disabled={isUpdatingBulk || (!bulkHandlingFee.trim() && !bulkExpiryDate.trim()) || !bulkOverrideReason.trim()}
                    onClick={handleBulkUpdate}
                  >
                    {isUpdatingBulk ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Apply Override"}
                  </Button>
                  
                  {/* ✨ BULK VOID ACTION */}
                  <Button 
                    size="sm" 
                    variant="destructive"
                    className="h-9 text-xs font-bold w-full sm:w-auto shadow-sm rounded-lg"
                    onClick={() => setIsVoidModalOpen(true)}
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Void Vouchers
                  </Button>
                </div>
              </div>
            )}

            <CardContent className="p-0">
              {isListLoading ? (
                <div className="flex flex-col items-center justify-center py-24 bg-slate-50/50">
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkles className="w-5 h-5 text-[#0052FF] animate-pulse" />
                    <span className="text-[11px] font-black uppercase tracking-widest text-[#0052FF]">Syncing Database</span>
                  </div>
                  <Skeleton className="h-6 w-64 bg-slate-200 rounded mb-2" />
                  <Skeleton className="h-4 w-48 bg-slate-100 rounded" />
                </div>
              ) : listData.length === 0 ? (
                <div className="text-center py-20 bg-slate-50/50">
                  <Package className="w-12 h-12 mx-auto mb-4 text-slate-200" />
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">No records found for this filter</p>
                </div>
              ) : (
                <div className="max-h-[600px] overflow-y-auto custom-scrollbar">
                  <Table>
                    <TableHeader className="bg-white sticky top-0 z-10 border-b border-slate-200 shadow-sm">
                      <TableRow className="border-none hover:bg-transparent">
                        {canBulkUpdate && (
                          <TableHead className="w-12 px-4 text-center">
                            <input 
                              type="checkbox" 
                              className="w-4 h-4 rounded border-slate-300 text-[#0052FF] focus:ring-[#0052FF] cursor-pointer"
                              checked={selectedVouchers.size === listData.length && listData.length > 0}
                              onChange={toggleAll}
                            />
                          </TableHead>
                        )}
                        <TableHead className="text-[10px] font-bold uppercase text-slate-500 tracking-widest px-4 h-10">Code Identifier</TableHead>
                        <TableHead className="text-[10px] font-bold uppercase text-slate-500 tracking-widest px-4 h-10">Batch No</TableHead>
                        <TableHead className="text-[10px] font-bold uppercase text-slate-500 tracking-widest px-4 h-10 text-center">Location & Scans</TableHead>
                        <TableHead className="text-[10px] font-bold uppercase text-slate-500 tracking-widest px-4 h-10 text-right">Value (INR)</TableHead>
                        <TableHead className="text-[10px] font-bold uppercase text-slate-500 tracking-widest px-4 h-10 text-right">Fee & Pmt</TableHead>
                        
                        {["all", "distributed", "in_stock", "registered", "redeemed", "expired"].includes(activeFilter) && (
                          <TableHead className="text-[10px] font-bold uppercase text-slate-500 tracking-widest px-4 h-10">Logistics & Customer</TableHead>
                        )}
                        
                        {["all", "distributed", "in_stock", "registered", "expired"].includes(activeFilter) && (
                          <TableHead className="text-[10px] font-bold uppercase text-slate-500 tracking-widest px-4 h-10 text-center">Expiration</TableHead>
                        )}
                        {["redeemed"].includes(activeFilter) && (
                          <TableHead className="text-[10px] font-bold uppercase text-slate-500 tracking-widest px-4 h-10 text-center">Redeemed On</TableHead>
                        )}
                        
                        <TableHead className="text-[10px] font-bold uppercase text-slate-500 tracking-widest px-4 h-10 text-center pr-6">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {listData.map((v) => (
                        <TableRow key={v.id} className={`hover:bg-slate-50/80 border-b border-slate-100 transition-colors ${selectedVouchers.has(v.id) ? 'bg-blue-50/30' : ''}`}>
                          {canBulkUpdate && (
                            <TableCell className="px-4 text-center">
                              <input 
                                type="checkbox" 
                                className="w-4 h-4 rounded border-slate-300 text-[#0052FF] focus:ring-[#0052FF] cursor-pointer"
                                checked={selectedVouchers.has(v.id)}
                                onChange={() => toggleSelection(v.id)}
                              />
                            </TableCell>
                          )}
                          <TableCell className="font-mono font-bold text-xs text-slate-900 px-4 py-3">
                            {v.code}
                            <div className="text-[9px] text-slate-400 font-sans mt-0.5" title="Last Updated Timestamp">
                              {v.updated_at ? format(new Date(v.updated_at), 'dd MMM, HH:mm') : ''}
                            </div>
                            {v.is_manual_override && (
                              <div className="flex items-center gap-1 mt-1 text-rose-500">
                                <ShieldAlert className="w-3 h-3 shrink-0" />
                                <span className="block text-[9px] font-bold uppercase tracking-widest truncate max-w-[120px]" title={`Overridden by: ${v.updated_by_user}`}>
                                  {v.updated_by_user?.split('|')[0] || '*OVERRIDDEN'}
                                </span>
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-[11px] font-medium text-slate-500 px-4">{v.voucher_batches?.batch_no}</TableCell>
                          
                          <TableCell className="text-center px-4">
                            <div className="flex flex-col items-center justify-center">
                              <Badge variant="secondary" className="bg-blue-50 text-[#0052FF] hover:bg-blue-100 border-blue-200 shadow-none">
                                {v.scan_count} Scans
                              </Badge>
                              {v.last_scanned_warehouse && (
                                <span className="text-[9px] text-slate-500 mt-1.5 font-medium flex items-center gap-1" title="Last scanned location">
                                  <MapPin className="w-2.5 h-2.5" /> {v.last_scanned_warehouse.name}
                                </span>
                              )}
                            </div>
                          </TableCell>

                          <TableCell className="font-black text-emerald-600 text-xs px-4 text-right">₹{v.discount_value.toLocaleString()}</TableCell>
                          
                          <TableCell className="px-4 text-right">
                            <div className="flex flex-col items-end">
                              <span className="font-bold text-slate-700 text-xs">₹{v.handling_fee || 0}</span>
                              {v.voucher_distributions && (
                                <span className={`text-[8px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded border mt-1 ${v.voucher_distributions.payment_status === 'paid' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-amber-50 text-amber-600 border-amber-100'}`}>
                                  {v.voucher_distributions.payment_status}
                                </span>
                              )}
                            </div>
                          </TableCell>
                          
                          {/* LOGISTICS & CUSTOMER CELL - INTERACTIVE */}
                          {["all", "distributed", "in_stock", "registered", "redeemed", "expired"].includes(activeFilter) && (
                            <TableCell className="px-4">
                              <div className="flex flex-col items-start gap-1.5">
                                <span className="font-semibold text-[11px] text-slate-700 flex items-center gap-1">
                                  <Store className="w-3 h-3 text-slate-400" /> {v.voucher_distributors?.distributor_name || <span className="text-slate-300 italic font-medium">Unassigned</span>}
                                </span>
                                {v.customers && (
                                  <button 
                                    onClick={() => setSelectedCustomer({ ...v.customers!, voucherCode: v.code })}
                                    className="text-[10px] font-bold text-teal-700 flex items-center gap-1 bg-teal-50 hover:bg-teal-100 px-2 py-1 rounded border border-teal-200 transition-colors shadow-sm group"
                                  >
                                    <User className="w-3 h-3 text-teal-500" /> 
                                    {v.customers.full_name}
                                    <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 ml-0.5 transition-opacity" />
                                  </button>
                                )}
                              </div>
                            </TableCell>
                          )}

                          {["all", "distributed", "in_stock", "registered", "expired"].includes(activeFilter) && (
                            <TableCell className="text-center font-bold text-[10px] text-rose-500 px-4">
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
            
            {/* SERVER-SIDE PAGINATION FOOTER - UPDATED WITH SELECTOR */}
            {totalCount > 0 && (
              <div className="bg-slate-50 border-t border-slate-200 px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="flex items-center gap-4 text-xs font-semibold text-slate-500">
                  <div className="flex items-center gap-2">
                    <span>Rows per page:</span>
                    <Select value={pageSize.toString()} onValueChange={(v) => { setPageSize(Number(v)); setCurrentPage(0); }}>
                      <SelectTrigger className="h-8 w-[70px] bg-white border-slate-200 shadow-sm text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="50">50</SelectItem>
                        <SelectItem value="100">100</SelectItem>
                        <SelectItem value="200">200</SelectItem>
                        <SelectItem value="500">500</SelectItem>
                        <SelectItem value="1000">1000</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <span className="hidden sm:inline">
                    Showing <span className="text-slate-900">{currentPage * pageSize + 1}</span> to <span className="text-slate-900">{Math.min((currentPage + 1) * pageSize, totalCount)}</span> of <span className="text-slate-900">{totalCount}</span> entries
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="h-8 text-xs font-bold text-slate-600 bg-white"
                    onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
                    disabled={currentPage === 0 || isListLoading}
                  >
                    <ChevronLeft className="w-4 h-4 mr-1" /> Prev
                  </Button>
                  <div className="text-xs font-bold text-slate-400 px-2">
                    Page {currentPage + 1} of {totalPages}
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="h-8 text-xs font-bold text-slate-600 bg-white"
                    onClick={() => setCurrentPage(p => p + 1)}
                    disabled={(currentPage + 1) * pageSize >= totalCount || isListLoading}
                  >
                    Next <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </section>

        {/* --- CUSTOMER DETAILS MODAL --- */}
        <Dialog open={!!selectedCustomer} onOpenChange={(open) => !open && setSelectedCustomer(null)}>
          <DialogContent className="sm:max-w-[400px] border-slate-200 shadow-2xl rounded-xl p-0 overflow-hidden bg-white">
            {selectedCustomer && (
              <>
                <DialogHeader className="bg-slate-50 border-b border-slate-100 p-6">
                  <div className="w-12 h-12 bg-teal-100 rounded-full flex items-center justify-center mb-4">
                    <User className="w-6 h-6 text-teal-600" />
                  </div>
                  <DialogTitle className="text-xl font-bold text-slate-900 tracking-tight">
                    {selectedCustomer.full_name}
                  </DialogTitle>
                  <DialogDescription className="text-xs font-medium text-slate-500 mt-1 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-teal-500" /> Registered to Voucher: <span className="font-mono font-bold text-slate-700">{selectedCustomer.voucherCode}</span>
                  </DialogDescription>
                </DialogHeader>

                <div className="p-6 space-y-6">
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Contact Number</p>
                    <p className="text-[15px] font-semibold text-slate-900 flex items-center gap-2">
                      <Phone className="w-4 h-4 text-slate-400" /> {selectedCustomer.phone}
                    </p>
                  </div>
                  
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Customer ID Reference</p>
                    <p className="text-xs font-mono font-medium text-slate-500 bg-slate-50 p-2 rounded border border-slate-100">
                      {selectedCustomer.id}
                    </p>
                  </div>

                  <Button 
                    className="w-full h-11 bg-[#25D366] hover:bg-[#20bd5a] text-white font-bold text-[13px] rounded-lg shadow-sm"
                    onClick={() => window.open(getWhatsAppLink(selectedCustomer.phone), '_blank')}
                  >
                    <MessageCircle className="w-4 h-4 mr-2" /> Message on WhatsApp
                  </Button>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>

        {/* ✨ CUSTOM REMINDER MODAL */}
        <Dialog open={isRemindModalOpen} onOpenChange={setIsRemindModalOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-amber-600">
                <BellRing className="w-5 h-5" /> Target Expiring Vouchers
              </DialogTitle>
              <DialogDescription>
                Select which vouchers to target for the expiry broadcast.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Target Status</Label>
                <Select value={remindStatus} onValueChange={(val) => { setRemindStatus(val); setRemindError(null); }}>
                  <SelectTrigger className="h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="both">Both Registered & Distributed</SelectItem>
                    <SelectItem value="registered">Registered Only (Direct to Customer)</SelectItem>
                    <SelectItem value="distributed">Distributed Only (Direct to Partner)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Expiring Within (Days)</Label>
                <Select value={remindDays} onValueChange={(val) => { setRemindDays(val); setRemindError(null); }}>
                  <SelectTrigger className="h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1,2,3,4,5,6,7].map(d => (
                      <SelectItem key={d} value={d.toString()}>{d} Day{d > 1 ? 's' : ''}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* ✨ INLINE ERROR DISPLAY */}
              {remindError && (
                <div className="bg-red-50 text-red-600 p-3 rounded-lg border border-red-100 flex items-start gap-2.5 animate-in slide-in-from-top-2 duration-300">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <p className="text-xs font-semibold leading-relaxed">{remindError}</p>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsRemindModalOpen(false)}>Cancel</Button>
              <Button onClick={executeRemindExpiring} disabled={isQueryingExpiry} className="bg-amber-500 hover:bg-amber-600 text-white">
                {isQueryingExpiry ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Generate Broadcast List
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ✨ BULK VOID MODAL */}
        <Dialog open={isVoidModalOpen} onOpenChange={setIsVoidModalOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-rose-600">
                <ShieldAlert className="w-5 h-5" /> Void Selected Vouchers
              </DialogTitle>
              <DialogDescription>
                You are about to permanently void <strong className="text-slate-900">{selectedVouchers.size}</strong> vouchers. This action cannot be reversed.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="void-reason">Reason for Voiding (Required)</Label>
                <Input 
                  id="void-reason" 
                  placeholder="e.g. Lost in transit, printed incorrectly..." 
                  value={bulkVoidReason}
                  onChange={(e) => setBulkVoidReason(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsVoidModalOpen(false)}>Cancel</Button>
              <Button variant="destructive" onClick={handleBulkVoid} disabled={isVoidingBulk || !bulkVoidReason.trim()}>
                {isVoidingBulk ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
                Confirm Void
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* --- WHATSAPP SENDER MODAL --- */}
        <WhatsAppSenderModal 
          isOpen={isSenderModalOpen}
          onClose={() => setIsSenderModalOpen(false)}
          recipients={messageRecipients}
          defaultTemplateName={activeTemplateContext === "welcome" ? "welcome_registered_voucher" : "voucher_expiry_reminder"} 
        />

      </main>
    </div>
  );
}