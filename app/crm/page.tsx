'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/hooks/useAuth'
import { useStoreLocation } from '@/hooks/useStoreLocation' 
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Select, SelectContent, SelectItem, 
  SelectTrigger, SelectValue 
} from '@/components/ui/select'
import { supabase } from '@/lib/supabaseClient'
import { toast } from 'sonner'
import { 
  Users, Search, Store, Gem, RefreshCw, Download,
  UserPlus, UploadCloud, Settings, ChevronLeft, ChevronRight, MessageSquare, PhoneOff,
  TicketPercent, ArrowUpDown, Filter, X, PhoneCall, Gift, Zap,
  Loader2
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Separator } from '@radix-ui/react-separator'
import Papa from 'papaparse'

// Import Extracted Components & Types
import { CRMCustomer, Warehouse } from './types'
import { CustomerList } from './components/CustomerList'
import { CRMMetrics } from './components/CRMMetrics'
import { CRMModals } from './components/CRMModals'
import { WhatsAppSenderModal } from '@/components/WhatsAppSenderModal'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@radix-ui/react-dropdown-menu'

// Defined Call Outcomes for Strict Logging
const CALL_OUTCOMES = [
  'Connected / Spoke to Customer',
  'Ringing / No Answer',
  'Switched Off',
  'Out of Service / Not Reachable',
  'Wrong Number',
  'Busy / Call Waiting',
  'Call After Some Time',
  'Not Interested (Do Not Disturb)'
]

// Robust DD-MM-YYYY Parser for CSV Uploads
const formatToDBDate = (dateStr?: string) => {
  if (!dateStr) return '';
  const cleanDate = dateStr.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(cleanDate)) return cleanDate;
  
  const parts = cleanDate.split(/[-/.]/);
  if (parts.length === 3) {
     const d = parts[0].padStart(2, '0');
     const m = parts[1].padStart(2, '0');
     let y = parts[2];
     if (y.length === 2) y = parseInt(y) > 30 ? `19${y}` : `20${y}`;
     return `${y}-${m}-${d}`;
  }
  return cleanDate;
};

export default function CRMPage() {
  const { appUser, loading } = useAuth()
  const { isHQ, isLocked, selectedLocation, setSelectedLocation } = useStoreLocation()
  
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [customers, setCustomers] = useState<CRMCustomer[]>([])
  const [dynamicTemplates, setDynamicTemplates] = useState<any[]>([]) 
  const [kittyConfigs, setKittyConfigs] = useState<any[]>([])
  
  const [isLoading, setIsLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false) 
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [isExporting, setIsExporting] = useState(false);

  const [activeAiFilter, setActiveAiFilter] = useState<'none' | 'scheme' | 'cold' | 'dnd' | 'birthday' | 'anniversary'>('none')
  const [voucherFilter, setVoucherFilter] = useState<'all' | 'registered' | 'redeemed' | 'none'>('all')
  const [giftSort, setGiftSort] = useState<'latest' | 'earliest'>('latest')

  // ✨ FIX: Upgraded Gift Filter State
  const [giftFilter, setGiftFilter] = useState<string>('all')
  
  const [sortOrder, setSortOrder] = useState<'followup_asc' | 'followup_desc' | 'newest' | 'name_asc'>('followup_asc')

  // Server-Side Pagination States
  const [activeTab, setActiveTab] = useState<string>("all")
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState<number>(50) 
  
  const [globalCounts, setGlobalCounts] = useState({ all: 0, walkin: 0, followups: 0, purchased: 0, kitty: 0, vouchers: 0, dnd: 0, assignedCalls: 0 })
  const [metrics, setMetrics] = useState({ 
    total: 0, 
    dueToday: 0, 
    overdue: 0, 
    schemeCount: 0, 
    coldCount: 0, 
    dndCount: 0,
    sequences: { total: 0, today: 0 } 
  })
  
  // History States
  const [customerHistory, setCustomerHistory] = useState<any[]>([])
  const [isHistoryLoading, setIsHistoryLoading] = useState(false)
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false)

  // WhatsApp Integration States
  const [isSenderModalOpen, setIsSenderModalOpen] = useState(false);
  const [messageRecipients, setMessageRecipients] = useState<any[]>([]);
  

  // Modals
  const [isWaActivityModalOpen, setIsWaActivityModalOpen] = useState(false)
  const [activeCallRecordId, setActiveCallRecordId] = useState<string | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isAddKittyModalOpen, setIsAddKittyModalOpen] = useState(false)
  const [isWhatsAppModalOpen, setIsWhatsAppModalOpen] = useState(false) 
  const [isFollowupModalOpen, setIsFollowupModalOpen] = useState(false)
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false)
  const [isLoyaltyModalOpen, setIsLoyaltyModalOpen] = useState(false)
  const [isCallModalOpen, setIsCallModalOpen] = useState(false)
  
  // Import States
  const [isImportModalOpen, setIsImportModalOpen] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [isImporting, setIsImporting] = useState(false)
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false)
  const [previewData, setPreviewData] = useState<any[]>([])

  const [selectedCustomer, setSelectedCustomer] = useState<CRMCustomer | null>(null)
  
  // Forms
  const [newCustForm, setNewCustForm] = useState({ 
    full_name: '', phone: '', email: '', city: '', customer_status: 'Lead', 
    birth_date: '', anniversary_date: '', next_followup_date: '', followup_reason: '' 
  })
  const [newKittyForm, setNewKittyForm] = useState({
    full_name: '', phone: '', email: '', city: '', config_id: '', start_date: new Date().toISOString().split('T')[0], 
    referred_by_id: 'none', referral_bonus: '500' 
  })
  const [loyaltyForm, setLoyaltyForm] = useState({ 
    actionType: 'manual_add', amount: '', billedAmount: '', notes: '' 
  })
  const [callForm, setCallForm] = useState<{
    caller_profile_id: string;
    outcome: string;
    interest_level?: string;
    notes: string;
    next_call_date: string;
    next_call_time: string;
  }>({
    caller_profile_id: '',
    outcome: '',
    interest_level: undefined,
    notes: '',
    next_call_date: '',
    next_call_time: ''
  });

  // Interaction States
  const [waTemplateId, setWaTemplateId] = useState<string>('')
  const [customMessage, setCustomMessage] = useState('')
  const [followupDate, setFollowupDate] = useState('')
  const [followupReason, setFollowupReason] = useState('') 
  const [interactionNotes, setInteractionNotes] = useState('')

  // Search Debouncer & Auto-Switch to ALL tab
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm)
      if (searchTerm.trim().length > 0 && activeTab !== 'all' && activeTab !== 'assigned_calls') {
        setActiveTab('all')
      }
    }, 500)
    return () => clearTimeout(timer)
  }, [searchTerm, activeTab])

  useEffect(() => {
    const fetchCoreData = async () => {
      if (!appUser) return
      
      const { data: whData } = await supabase.from('warehouses').select('*').eq('company_id', appUser.company_id).eq('is_active', true).order('name')
      if (whData) setWarehouses(whData)

      const { data: tplData } = await supabase.from('crm_message_templates').select('*').eq('company_id', appUser.company_id).eq('is_active', true).order('created_at')
      if (tplData) setDynamicTemplates(tplData)

      const { data: kittyData } = await supabase
        .from('crm_kitty_plans_config')
        .select('*')
        .eq('company_id', appUser.company_id)
        .eq('is_active', true)
        .order('monthly_amount')
        
      if (kittyData) {
        setKittyConfigs(kittyData)
        if (kittyData.length > 0 && !newKittyForm.config_id) {
          setNewKittyForm(prev => ({ ...prev, config_id: kittyData[0].id }))
        }
      }
    }
    fetchCoreData()
  }, [appUser])

  const buildServerQuery = (queryObj: any, tab: string) => {
    let q = queryObj.eq('company_id', appUser?.company_id);
    
    if (selectedLocation !== 'ALL' && tab !== 'assigned_calls') {
       q = q.eq('warehouse_id', selectedLocation);
    }
    
    if (debouncedSearch) {
       q = q.or(`full_name.ilike.%${debouncedSearch}%,phone.ilike.%${debouncedSearch}%`);
    }

    if (activeAiFilter === 'dnd') {
       q = q.eq('customer_status', 'DND');
    } else {
       q = q.neq('customer_status', 'DND');

       if (activeAiFilter === 'scheme') {
          q = q.eq('customer_status', 'Purchased');
       } else if (activeAiFilter === 'cold') {
          q = q.or('customer_status.eq.Lead,customer_status.is.null');
       } else {
          if (tab === 'dnd') {
            q = queryObj.eq('company_id', appUser?.company_id).eq('customer_status', 'DND'); 
          } else if (tab === 'followups') {
            q = q.or('customer_status.eq.Lead,customer_status.is.null');
          } else if (tab === 'purchased') {
            q = q.eq('customer_status', 'Purchased');
          } else if (tab === 'kitty') {
            q = q.eq('customer_status', 'Kitty Member');
          } else if (tab === 'walkin') {
            // ✨ FIX: Added `activity_timeline` JSONB checker to dynamically scoop up all historic walk-ins globally!
            q = q.or('customer_status.eq.Walk-in,last_interaction.ilike.%walk-in%,last_interaction.ilike.%checkin%,last_interaction.ilike.%discovery%,last_interaction.ilike.%visited%,activity_timeline.cs.[{"type":"WALK-IN"}]');
          } else if (tab === 'all') {
            // Unrestricted (except DND which is handled above)
          }
       }
    }

    // ✨ FIX: Advanced Gifting Filters 
    if (giftFilter.startsWith('given')) {
      q = q.not('gift_given', 'is', null);
    } else if (giftFilter === 'pending') {
      q = q.is('gift_given', null);
    }

    return q;
  };

  // FETCH COUNTS GLOBALLY
  useEffect(() => {
    if (!appUser) return;
    const fetchCounts = async () => {
      try {
        const getQ = (t: string) => buildServerQuery(supabase.from('customers').select('*', { count: 'exact', head: true }), t);

        const todayStr = new Date().toISOString().split('T')[0];
        const thirtyDaysAgo = new Date(); thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const fourteenDaysAgo = new Date(); fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
        const startOfTodayISO = new Date().setHours(0,0,0,0);
        const startOfTodayStr = new Date(startOfTodayISO).toISOString()

        let dueQ = supabase.from('customers').select('*', {count: 'exact', head: true}).eq('company_id', appUser.company_id).eq('next_followup_date', todayStr).neq('customer_status', 'DND');
        let overQ = supabase.from('customers').select('*', {count: 'exact', head: true}).eq('company_id', appUser.company_id).lt('next_followup_date', todayStr).neq('customer_status', 'DND');
        let schemeQ = supabase.from('customers').select('*', {count: 'exact', head: true}).eq('company_id', appUser.company_id).eq('customer_status', 'Purchased').lt('created_at', thirtyDaysAgo.toISOString());
        let coldQ = supabase.from('customers').select('*', {count: 'exact', head: true}).eq('company_id', appUser.company_id).or('customer_status.eq.Lead,customer_status.is.null').lt('created_at', fourteenDaysAgo.toISOString());
        let dndQ = supabase.from('customers').select('*', {count: 'exact', head: true}).eq('company_id', appUser.company_id).eq('customer_status', 'DND');
        
        let voucherQ = supabase.from('customers').select('id, vouchers!inner(id)', {count: 'exact', head: true}).eq('company_id', appUser.company_id).neq('customer_status', 'DND');
        
        const currentUserId = appUser.user_id || appUser.id;

        // Count assigned calls for this user
        let assignedCallsQ = supabase.from('customers').select('id, voucher_call_assignments!inner(id)', {count: 'exact', head: true})
          .eq('company_id', appUser.company_id)
          .eq('voucher_call_assignments.assigned_to', currentUserId)
          .eq('voucher_call_assignments.status', 'pending')
          .neq('customer_status', 'DND');

        let seqTotalQ = supabase
          .from('voucher_message_sequences')
          .select('*', { count: 'exact', head: true });

        let seqTodayQ = supabase
          .from('voucher_message_sequences')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', startOfTodayStr);

        if (selectedLocation !== 'ALL') {
           dueQ = dueQ.eq('warehouse_id', selectedLocation);
           overQ = overQ.eq('warehouse_id', selectedLocation);
           schemeQ = schemeQ.eq('warehouse_id', selectedLocation);
           coldQ = coldQ.eq('warehouse_id', selectedLocation);
           dndQ = dndQ.eq('warehouse_id', selectedLocation);
           voucherQ = voucherQ.eq('warehouse_id', selectedLocation);
        }

        const [a, w, f, p, k, vC, due, over, scheme, cold, dnd, seqTotal, seqToday, assignedCallsRes] = await Promise.all([
          getQ('all'), getQ('walkin'), getQ('followups'), getQ('purchased'), getQ('kitty'), voucherQ, dueQ, overQ, schemeQ, coldQ, dndQ,
          seqTotalQ, seqTodayQ, assignedCallsQ
        ]);
        
        setGlobalCounts({
          all: a.count || 0,
          walkin: w.count || 0,
          followups: f.count || 0,
          purchased: p.count || 0,
          kitty: k.count || 0,
          vouchers: vC.count || 0, 
          assignedCalls: assignedCallsRes.count || 0,
          dnd: dnd.count || 0
        });

        setMetrics({
          dueToday: due.count || 0,
          overdue: over.count || 0,
          total: (f.count || 0) + (p.count || 0) + (k.count || 0) + (dnd.count || 0),
          schemeCount: scheme.count || 0,
          coldCount: cold.count || 0,
          dndCount: dnd.count || 0,
          sequences: {
            total: seqTotal.count || 0,
            today: seqToday.count || 0
          }
        });
      } catch (e) { console.warn("Count Fetch Error:", e); }
    }
    fetchCounts()
  }, [appUser, selectedLocation, debouncedSearch, activeAiFilter, giftFilter])

  const fetchPage = async (pageToLoad: number) => {
    if (!appUser || !selectedLocation) return;
    setIsLoading(true);
    try {
      const requireVoucherJoin = activeTab === 'vouchers' || voucherFilter === 'registered' || voucherFilter === 'redeemed';
      const requireAssignmentJoin = activeTab === 'assigned_calls';
      
      let q = supabase.from('customers').select(`
        *, 
        kitty_plans(*),
        vouchers${requireVoucherJoin ? '!inner' : ''}(id, code, status, expiry_date, distributor_id, voucher_distributors(distributor_name)),
        voucher_message_sequences(id, status, current_step, next_send_at),
        voucher_call_assignments${requireAssignmentJoin ? '!inner' : ''}(id, status, assigned_to),
        customer_gifts_history(gift_name, created_at)
      `);
      
      q = buildServerQuery(q, activeTab);

      if (activeTab === 'assigned_calls') {
        const currentUserId = appUser.user_id || appUser.id;
        q = q.eq('voucher_call_assignments.assigned_to', currentUserId).eq('voucher_call_assignments.status', 'pending');
      }

      if (voucherFilter === 'registered') q = q.eq('vouchers.status', 'registered');
      if (voucherFilter === 'redeemed') q = q.eq('vouchers.status', 'redeemed');
      if (voucherFilter === 'none') {
         q = q.is('vouchers', null); 
      }

      // ✨ FIX: Dedicated Gift Sorter
      if (giftFilter === 'given') {
        if (giftSort === 'latest') {
          q = q.order('updated_at', { ascending: false, nullsFirst: false }).order('id', { ascending: true });
        } else {
          q = q.order('updated_at', { ascending: true, nullsFirst: false }).order('id', { ascending: true });
        }
      } else {
        // Standard Sort Operations
        if (sortOrder === 'followup_asc') {
          q = q.order('next_followup_date', { ascending: true, nullsFirst: false }).order('id', { ascending: true });
        } else if (sortOrder === 'followup_desc') {
          q = q.order('next_followup_date', { ascending: false, nullsFirst: false }).order('id', { ascending: true });
        } else if (sortOrder === 'newest') {
          q = q.order('created_at', { ascending: false }).order('id', { ascending: true });
        } else if (sortOrder === 'name_asc') {
          q = q.order('full_name', { ascending: true }).order('id', { ascending: true });
        }
      }
      
      q = q.range(pageToLoad * pageSize, (pageToLoad + 1) * pageSize - 1);

      const { data, error } = await q;
      if (error) throw error;
      setCustomers(data || []);
    } catch (error) { 
      toast.error('Failed to load customers');
    } finally { 
      setIsLoading(false);
    }
  }
  
  // ✨ FIX: Added giftSort to dependencies so it refreshes instantly when changed
  useEffect(() => {
    setPage(0);
    fetchPage(0);
  }, [appUser, selectedLocation, debouncedSearch, activeAiFilter, voucherFilter, giftFilter, giftSort, activeTab, pageSize, sortOrder])

  const handleViewHistory = async (customer: CRMCustomer) => {
    setSelectedCustomer(customer);
    setIsHistoryModalOpen(true);
    setIsHistoryLoading(true);
    
    try {
      const [inv, ord, rep, est, webhooks] = await Promise.all([
        supabase.from('invoices').select('id, invoice_number, created_at, final_total, subtotal').eq('customer_id', customer.id),
        supabase.from('custom_orders').select('id, order_number, created_at, estimated_value, status').eq('customer_id', customer.id),
        supabase.from('repair_tickets').select('id, ticket_number, created_at, estimated_cost, status').eq('customer_id', customer.id),
        supabase.from('estimates').select('id, estimate_number, created_at, total_amount').eq('customer_id', customer.id),
        supabase.from('crm_webhook_events')
        .select('id, message, workflow, event_time, processed_status')
        .eq('matched_customer_id', customer.id)
      ]);

      const combined = [
        ...(inv.data || []).map(i => ({ ...i, type: 'Invoice', date: i.created_at, ref: i.invoice_number, amt: i.final_total || i.subtotal })),
        ...(ord.data || []).map(o => ({ ...o, type: 'Custom Order', date: o.created_at, ref: o.order_number, amt: o.estimated_value })),
        ...(rep.data || []).map(r => ({ ...r, type: 'Repair', date: r.created_at, ref: r.ticket_number, amt: r.estimated_cost })),
        ...(est.data || []).map(e => ({ ...e, type: 'Estimate', date: e.created_at, ref: e.estimate_number, amt: e.total_amount })),
        ...(webhooks.data || []).map(w => ({
          id: w.id,
          type: 'WhatsApp Webhook',
          date: w.event_time,
          ref: w.workflow || 'Inbound Msg',
          amt: 0,
          notes: w.message
        }))
      ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      setCustomerHistory(combined);
    } catch (err) {
      toast.error("Failed to load purchase history");
    } finally {
      setIsHistoryLoading(false);
    }
  };

  const toggleAiFilter = (filter: 'scheme' | 'cold' | 'dnd' | 'birthday' | 'anniversary') => {
    if (activeAiFilter === filter) {
       setActiveAiFilter('none');
       if (activeTab === 'dnd') setActiveTab('all');
    } else {
       setActiveAiFilter(filter);
       if (filter === 'scheme') setActiveTab('purchased');
       if (filter === 'cold') setActiveTab('followups'); 
       if (filter === 'dnd') setActiveTab('dnd');
    }
  }

  const handleLogCall = async () => {
    if (!selectedCustomer) return;
    if (!callForm.outcome) return toast.error("Select a call outcome.");

    setIsSubmitting(true);
    try {
      const isDND = callForm.outcome === 'Not Interested (Do Not Disturb)';
      const isCompletedOutcome = ['Connected / Spoke to Customer', 'Not Interested (Do Not Disturb)', 'Wrong Number'].includes(callForm.outcome);
      
      const baseCallLogEntry = {
        outcome: callForm.outcome,
        notes: callForm.notes,
        next_call_date: callForm.next_call_date || null,
        next_call_time: callForm.next_call_time || null,
      };

      if (activeCallRecordId) {
        const { error: logErr } = await supabase.from('call_records').update(baseCallLogEntry).eq('id', activeCallRecordId);
        if (logErr) throw logErr;
      } else {
        const { error: logErr } = await supabase.from('call_records').insert([{
          company_id: appUser?.company_id,
          customer_id: selectedCustomer.id,
          user_id: callForm.caller_profile_id || appUser?.id || appUser?.user_id,
          ...baseCallLogEntry
        }]);
        if (logErr) throw logErr;
      }

      if (activeTab === 'assigned_calls') {
          let assignmentUpdate: any = { 
              call_outcome: callForm.outcome,
              interest_level: callForm.interest_level || null,
              call_notes: callForm.notes
          };

          if (isCompletedOutcome) {
              assignmentUpdate.status = isDND ? 'dnd' : 'called';
              assignmentUpdate.completed_at = new Date().toISOString();
          }

          await supabase.from('voucher_call_assignments')
             .update(assignmentUpdate)
             .eq('customer_id', selectedCustomer.id)
             .eq('assigned_to', appUser?.id)
             .eq('status', 'pending');
      }

      // Safe Activity Timeline Stacking (Protects Manual Data)
      const { data: existing } = await supabase.from('customers').select('id, activity_timeline').eq('id', selectedCustomer.id).single();

      const newSystemEvent = {
        timestamp: new Date().toISOString(),
        type: 'CALL',
        description: `[${callForm.outcome}] ${callForm.notes}`
      };

      const existingTimeline = existing?.activity_timeline || [];
      const updatedTimeline = [newSystemEvent, ...existingTimeline];

      let updatePayload: any = {
        activity_timeline: updatedTimeline 
      };

      if (isDND) {
        updatePayload.customer_status = 'DND';
        updatePayload.next_followup_date = null; 
        updatePayload.followup_reason = 'Customer requested Do Not Disturb';
      } else {
        if (callForm.next_call_date) {
           updatePayload.next_followup_date = callForm.next_call_date;
           updatePayload.followup_reason = `Follow up required after: ${callForm.outcome}`;
        }
      }

      const { error: custErr } = await supabase.from('customers').update(updatePayload).eq('id', selectedCustomer.id);
      if (custErr) throw custErr;

      toast.success(isDND ? 'Customer moved to DND List' : 'Call Logged & Timer Set!');
      
      setIsCallModalOpen(false);
      setActiveCallRecordId(null);
      setCallForm({ caller_profile_id: '', outcome: 'Connected / Spoke to Customer', interest_level: undefined, notes: '', next_call_date: '', next_call_time: '' });
      
      if (isCompletedOutcome) {
        setGlobalCounts(prev => ({...prev, assignedCalls: Math.max(0, prev.assignedCalls - 1)}));
      }
      fetchPage(page);

    } catch (error: any) {
      toast.error(`Failed to log call: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  }

  const formatCustomersForExport = (data: any[]) => {
    return data.map(c => ({
      "Customer ID": c.id,
      "Full Name": c.full_name || '',
      "Phone": c.phone || '',
      "City": c.city || '',
      "Status": c.customer_status || '',
      "Credit Balance": c.store_credit_balance || 0,
      "Points": c.pavitram_points || 0,
      "Gift Given": c.gift_given || '',
      "Last Interaction": c.last_interaction || '',
      "Next Follow-up": c.next_followup_date || '',
      "Follow-up Reason": c.followup_reason || '',
      "Created At": c.created_at ? new Date(c.created_at).toLocaleString() : ''
    }));
  };

  const downloadCSV = (csv: string, filename: string) => {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportCurrent = () => {
    if (customers.length === 0) return toast.error("No customers currently visible to export.");
    const csvData = formatCustomersForExport(customers);
    const csv = Papa.unparse(csvData);
    downloadCSV(csv, `crm_export_page_${page + 1}.csv`);
    toast.success("Exported current view!");
  };

  const handleExportAll = async () => {
    if (!appUser) return;
    setIsExporting(true);
    const toastId = toast.loading('Exporting data... 0 rows');
    
    try {
      let allRecords: any[] = [];
      let keepFetching = true;
      let currentPage = 0;
      const limit = 1000;

      // Loop to bypass Supabase's 1000-row limit
      while (keepFetching) {
        const requireVoucherJoin = activeTab === 'vouchers' || voucherFilter === 'registered' || voucherFilter === 'redeemed';
        const requireAssignmentJoin = activeTab === 'assigned_calls';
        
        let q = supabase.from('customers').select(`
          *, 
          kitty_plans(*),
          vouchers${requireVoucherJoin ? '!inner' : ''}(id, code, status, expiry_date, distributor_id, voucher_distributors(distributor_name)),
          voucher_message_sequences(id, status, current_step, next_send_at),
          voucher_call_assignments${requireAssignmentJoin ? '!inner' : ''}(id, status, assigned_to),
          customer_gifts_history(gift_name, created_at)
        `);
        
        q = buildServerQuery(q, activeTab);

        if (activeTab === 'assigned_calls') {
          const currentUserId = appUser.user_id || appUser.id;
          q = q.eq('voucher_call_assignments.assigned_to', currentUserId).eq('voucher_call_assignments.status', 'pending');
        }

        if (voucherFilter === 'registered') q = q.eq('vouchers.status', 'registered');
        if (voucherFilter === 'redeemed') q = q.eq('vouchers.status', 'redeemed');
        if (voucherFilter === 'none') {
           q = q.is('vouchers', null); 
        }

        if (giftFilter === 'given') {
          if (giftSort === 'latest') {
            q = q.order('updated_at', { ascending: false, nullsFirst: false }).order('id', { ascending: true });
          } else {
            q = q.order('updated_at', { ascending: true, nullsFirst: false }).order('id', { ascending: true });
          }
        } else {
          if (sortOrder === 'followup_asc') {
            q = q.order('next_followup_date', { ascending: true, nullsFirst: false }).order('id', { ascending: true });
          } else if (sortOrder === 'followup_desc') {
            q = q.order('next_followup_date', { ascending: false, nullsFirst: false }).order('id', { ascending: true });
          } else if (sortOrder === 'newest') {
            q = q.order('created_at', { ascending: false }).order('id', { ascending: true });
          } else if (sortOrder === 'name_asc') {
            q = q.order('full_name', { ascending: true }).order('id', { ascending: true });
          }
        }

        // Apply chunk range
        q = q.range(currentPage * limit, (currentPage + 1) * limit - 1);

        const { data, error } = await q;
        if (error) throw error;
        
        if (data && data.length > 0) {
          allRecords = [...allRecords, ...data];
          toast.loading(`Exporting data... ${allRecords.length} rows`, { id: toastId });
          
          if (data.length < limit) {
            keepFetching = false;
          } else {
            currentPage++;
          }
        } else {
          keepFetching = false;
        }
      }

      if (allRecords.length === 0) {
        toast.error('No data found to export.', { id: toastId });
        return;
      }

      const csvData = formatCustomersForExport(allRecords);
      const csv = Papa.unparse(csvData);
      downloadCSV(csv, `crm_export_all_${new Date().toISOString().split('T')[0]}.csv`);
      toast.success(`Successfully exported ${allRecords.length} records!`, { id: toastId });

    } catch (error: any) {
      console.error(error);
      toast.error(`Export failed: ${error.message}`, { id: toastId });
    } finally {
      setIsExporting(false);
    }
  };

  // --- CSV Import Handlers ---
  const handleDownloadSample = () => {
    const csvContent = "full_name,phone,city,customer_status,birth_date,anniversary_date,store_credit_balance\nJohn Doe,9876543210,Mumbai,Lead,01-01-1990,15-05-2015,0\nJane Smith,9123456789,Delhi,Purchased,20-08-1985,,1200\nRahul Sharma,9988776655,Pune,Kitty Member,10-12-1992,20-11-2020,0";
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "pavitram_customer_import_sample.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleParseFile = () => {
    if (!importFile) return toast.error("Please select a file first.");
    setIsImporting(true);

    Papa.parse(importFile, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        try {
          const rows = results.data as any[];
          const mappedData = rows
            .filter(row => row.full_name && row.phone)
            .map((row, index) => ({
               _id: index, 
               full_name: row.full_name?.trim() || '',
               phone: row.phone?.trim().replace(/\D/g, '') || '',
               city: row.city?.trim() || '',
               customer_status: row.customer_status?.trim() || 'Lead',
               birth_date: formatToDBDate(row.birth_date),
               anniversary_date: formatToDBDate(row.anniversary_date),
               store_credit_balance: row.store_credit_balance?.trim() || '0'
            }));

          if (mappedData.length === 0) throw new Error("No valid rows found.");
          setPreviewData(mappedData);
          setIsImportModalOpen(false);
          setIsPreviewModalOpen(true);
        } catch (err: any) {
          toast.error(`Parsing failed: ${err.message}`);
        } finally {
          setIsImporting(false);
        }
      }
    });
  };

  const updatePreviewRow = (index: number, field: string, value: string) => {
    setPreviewData(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const removePreviewRow = (index: number) => {
    setPreviewData(prev => prev.filter((_, i) => i !== index));
  };

  const handleCommitImport = async () => {
    if (!appUser?.company_id) return;
    setIsSubmitting(true);
    try {
      const validPayloads = previewData
        .filter(row => row.full_name && row.phone) 
        .map(row => ({
             company_id: appUser.company_id,
             warehouse_id: selectedLocation === 'ALL' ? null : selectedLocation,
             full_name: row.full_name,
             phone: row.phone,
             city: row.city || null,
             customer_status: row.customer_status || 'Lead',
             birth_date: row.birth_date || null,
             anniversary_date: row.anniversary_date || null,
             store_credit_balance: Number(row.store_credit_balance) || 0
        }));

      const uniqueCustomersMap = new Map();
      validPayloads.forEach(payload => { uniqueCustomersMap.set(payload.phone, payload); });
      const deduplicatedPayload = Array.from(uniqueCustomersMap.values());

      const { error } = await supabase.from('customers').upsert(deduplicatedPayload, { onConflict: 'company_id, phone' });
      if (error) throw error;

      toast.success(`Imported ${deduplicatedPayload.length} unique customers!`);
      setIsPreviewModalOpen(false);
      setImportFile(null);
      setPreviewData([]);
      fetchPage(page);
    } catch (err: any) {
      toast.error(`Import Failed: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- CRUD Handlers ---
  const handleAddCustomer = async () => {
    if (!newCustForm.full_name || !newCustForm.phone) return toast.error('Name and Phone are required.');
    
    setIsSubmitting(true)
    try {
      const cleanPhone = newCustForm.phone.trim();
      const payload = {
        company_id: appUser?.company_id,
        warehouse_id: selectedLocation === 'ALL' ? null : selectedLocation, 
        full_name: newCustForm.full_name.trim(),
        phone: cleanPhone,
        email: newCustForm.email?.trim() || null, 
        city: newCustForm.city?.trim() || null,
        customer_status: newCustForm.customer_status,
        birth_date: newCustForm.birth_date || null,
        anniversary_date: newCustForm.anniversary_date || null,
        next_followup_date: newCustForm.next_followup_date || null,
        followup_reason: newCustForm.followup_reason || null
      };

      const { data: existing } = await supabase.from('customers').select('id').eq('company_id', appUser?.company_id).eq('phone', cleanPhone).limit(1).maybeSingle();

      let error;
      if (existing) {
        const res = await supabase.from('customers').update(payload).eq('id', existing.id);
        error = res.error;
      } else {
        const res = await supabase.from('customers').insert([payload]);
        error = res.error;
      }

      if (error) throw error
      toast.success(existing ? 'Lead Updated Successfully!' : 'Lead Added Successfully!')
      setIsAddModalOpen(false)
      fetchPage(page)
    } catch (err: any) {
      toast.error(`Error: ${err.message}`);
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleAddKittyMember = async () => {
    if (!selectedLocation || selectedLocation === 'ALL') return toast.error('Branch Required', { description: 'Please select a specific store branch from the top menu first.' })
    if (!newKittyForm.full_name || !newKittyForm.phone) return toast.error('Name and Phone are required.');
    if (!newKittyForm.config_id) return toast.error('Please select a Kitty Plan tier.');
    
    const selectedConfig = kittyConfigs.find(c => c.id === newKittyForm.config_id);
    if (!selectedConfig) return toast.error('Selected plan tier is invalid.');

    setIsSubmitting(true)
    try {
      const sd = newKittyForm.start_date ? new Date(newKittyForm.start_date) : new Date();
      const nextInstallment = new Date(sd);
      nextInstallment.setMonth(nextInstallment.getMonth() + 1);
      const cleanPhone = newKittyForm.phone.trim();

      const { data: existing } = await supabase
        .from('customers')
        .select('id, activity_timeline')
        .eq('company_id', appUser?.company_id)
        .eq('phone', cleanPhone)
        .limit(1)
        .maybeSingle();

      const newSystemEvent = {
        timestamp: new Date().toISOString(),
        type: 'KITTY ENROLLMENT',
        description: `Joined Diamond Kitty Scheme (₹${selectedConfig.monthly_amount})`
      };

      const existingTimeline = existing?.activity_timeline || [];
      const updatedTimeline = [newSystemEvent, ...existingTimeline];

      const customerPayload = {
        company_id: appUser?.company_id,
        warehouse_id: selectedLocation, 
        full_name: newKittyForm.full_name.trim(),
        phone: cleanPhone,
        email: newKittyForm.email?.trim() || null, 
        city: newKittyForm.city?.trim() || null,
        customer_status: 'Kitty Member',
        
        kitty_next_due_date: nextInstallment.toISOString().split('T')[0],
        activity_timeline: updatedTimeline
      };

      let customerId;
      if (existing) {
        await supabase.from('customers').update(customerPayload).eq('id', existing.id);
        customerId = existing.id;
      } else {
        const { data: newCust, error } = await supabase.from('customers').insert([customerPayload]).select().single();
        if (error) throw error;
        customerId = newCust.id;
      }

      const planPayload = {
        company_id: appUser?.company_id,
        customer_id: customerId,
        warehouse_id: selectedLocation,
        plan_name: `Kitty Plan - ₹${selectedConfig.monthly_amount}/mo`,
        plan_amount: Number(selectedConfig.monthly_amount),
        total_months: Number(selectedConfig.duration_months),
        bonus_amount: Number(selectedConfig.bonus_amount) || 0,
        months_paid: 0,
        status: 'active',
        start_date: sd.toISOString().split('T')[0]
      }
      const { error: planError } = await supabase.from('kitty_plans').insert([planPayload]);
      if (planError) throw planError;

      toast.success('Customer enrolled in Diamond Kitty.')
      setIsAddKittyModalOpen(false)
      setIsProfileModalOpen(false) 
      setNewKittyForm(prev => ({ ...prev, full_name: '', phone: '', email: '', city: '', start_date: new Date().toISOString().split('T')[0], referred_by_id: 'none', referral_bonus: '500' }))
      fetchPage(page)
    } catch (err: any) {
      toast.error(`Registration Failed: ${err.message}`);
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleUpdateFollowup = async () => {
    if (!selectedCustomer) return
    setIsSubmitting(true)
    try {
      const { error } = await supabase.from('customers')
        .update({ next_followup_date: followupDate || null, followup_reason: followupReason || null, last_interaction: interactionNotes })
        .eq('id', selectedCustomer.id)

      if (error) throw error
      toast.success('Follow-up Scheduled!')
      setIsFollowupModalOpen(false)
      fetchPage(page)
    } catch (err: any) {
      toast.error('Error scheduling follow-up.');
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleUpdateLoyalty = async () => {
    if (!selectedCustomer) return;
    const amount = Number(loyaltyForm.amount) || 0;
    if (amount <= 0) return toast.error("Amount must be greater than 0");

    setIsSubmitting(true);
    try {
      const current = selectedCustomer.store_credit_balance || 0;
      let newTotal = current;
      let note = loyaltyForm.notes || '';

      if (loyaltyForm.actionType === 'manual_deduct') {
        newTotal = Math.max(0, current - amount);
        note = note || `Manually Deducted ₹${amount}`;
      } else {
        newTotal = current + amount;
        if (loyaltyForm.actionType === 'exhibition') note = note || `Exhibition Hosting Bonus (+₹500)`;
        if (loyaltyForm.actionType === 'b2p_referral') note = note || `Business Referral Bonus (+5% of ₹${loyaltyForm.billedAmount})`;
        if (loyaltyForm.actionType === 'manual_add') note = note || `Manually Added ₹${amount}`;
      }

      const { data, error } = await supabase.from('customers').update({ 
        store_credit_balance: newTotal,
        last_interaction: note
      }).eq('id', selectedCustomer.id).select('*, kitty_plans(*)').single(); 
      
      if (error) throw error;

      toast.success('Wallet Updated Successfully!');
      setSelectedCustomer(data); 
      setIsLoyaltyModalOpen(false);
      setLoyaltyForm({ actionType: 'manual_add', amount: '', billedAmount: '', notes: '' });
      fetchPage(page); 
    } catch (err: any) {
      toast.error(`Update Failed: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  }

  const handleRecordKittyPayment = async (customer: CRMCustomer, planId: string) => {
    if (!appUser || !customer || !planId) return;

    const plan = customer.kitty_plans?.find(p => p.id === planId);
    if (!plan) return toast.error('Plan not found.');

    const currentMonthsPaid = plan.months_paid || 0;
    if (currentMonthsPaid >= plan.total_months) return toast.error('Plan already matured!');

    const newMonthsPaid = currentMonthsPaid + 1;
    const amount = plan.plan_amount || 0;
    const newStatus = newMonthsPaid >= plan.total_months ? 'matured' : 'active';

    try {
      const { error: instError } = await supabase.from('kitty_installments').insert({
         kitty_plan_id: plan.id,
         amount_paid: amount,
         payment_mode: 'cash', 
         payment_date: new Date().toISOString(),
      });
      if (instError) throw instError;

      const { error: planError } = await supabase.from('kitty_plans').update({
         months_paid: newMonthsPaid,
         status: newStatus
      }).eq('id', plan.id);
      if (planError) throw planError;

      const nextDue = new Date();
      nextDue.setMonth(nextDue.getMonth() + 1);

      await supabase.from('customers').update({
        next_followup_date: newStatus === 'matured' ? null : nextDue.toISOString().split('T')[0],
        followup_reason: newStatus === 'matured' ? 'Plan Matured! Ready for purchase.' : `Installment ${newMonthsPaid + 1} due (₹${amount})`,
        last_interaction: `Paid Kitty Installment ${newMonthsPaid} (₹${amount})`
      }).eq('id', customer.id);

      toast.success(`Month ${newMonthsPaid} Payment Recorded!`);
      
      const { data: updatedCust } = await supabase.from('customers').select('*, kitty_plans(*)').eq('id', customer.id).single();
      if (updatedCust) setSelectedCustomer(updatedCust);
      fetchPage(page);

    } catch (err: any) {
      toast.error(`Payment Failed: ${err.message}`);
    }
  }

  const openWhatsAppModal = (customer: CRMCustomer) => {
    let phone = customer.phone.replace(/\D/g, '');
    if (phone.length === 10) phone = '91' + phone;

    setMessageRecipients([{ phone: phone, name: customer.full_name }]);
    setIsSenderModalOpen(true);
  }
  
  const handleBulkBroadcast = () => {
    if (customers.length === 0) return toast.error("No customers found in the current filtered list.");
    
    const recipients = customers.map(c => {
      let phone = c.phone.replace(/\D/g, '');
      if (phone.length === 10) phone = '91' + phone;
      return { phone: phone, name: c.full_name };
    });
    
    setMessageRecipients(recipients);
    setIsSenderModalOpen(true);
  }

  const handleTemplateChange = (templateId: string) => {}
  const handleSendWhatsApp = () => {}

  const openScheduleModal = (customer: CRMCustomer) => {
    setSelectedCustomer(customer); 
    setFollowupDate(customer.next_followup_date || ''); 
    setFollowupReason(customer.followup_reason || ''); 
    setInteractionNotes(customer.last_interaction || ''); 
    setIsFollowupModalOpen(true); 
  }

  const openCallLoggerModal = async (customer: CRMCustomer) => {
    setSelectedCustomer(customer);
    
    const cleanPhone = customer.phone.replace(/\D/g, '');
    window.location.href = `tel:+91${cleanPhone}`;

    setIsCallModalOpen(true);
    setCallForm({ caller_profile_id: '',outcome: 'Connected / Spoke to Customer', notes: '', next_call_date: '', next_call_time: '' });

    try {
      const { data, error } = await supabase.from('call_records').insert([{
        company_id: appUser?.company_id,
        customer_id: customer.id,
        user_id: appUser?.id || appUser?.user_id,
        outcome: 'Call Attempted (Pending Details)',
        notes: 'Call initiated from CRM dialer.',
      }]).select('id').single();

      if (error) throw error;
      setActiveCallRecordId(data.id);
    } catch (error) {
      console.error("Failed to auto-log call attempt:", error);
    }
  }

  const openWaActivityModal = async (customer: CRMCustomer) => {
    setSelectedCustomer(customer);
    setIsWaActivityModalOpen(true);
    setIsHistoryLoading(true);

    try {
      const { data, error } = await supabase
        .from('crm_webhook_events')
        .select('*')
        .eq('matched_customer_id', customer.id);

      if (error) throw error;

      const formatted = (data || []).map(w => ({
        id: w.id,
        type: 'WhatsApp Webhook',
        date: w.event_time || w.created_at, 
        ref: w.workflow || 'Inbound Msg',
        amt: 0,
        notes: w.message
      })).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      setCustomerHistory(formatted);
    } catch (err) {
      console.error("WA Fetch Error", err);
    } finally {
      setIsHistoryLoading(false);
    }
  };

  const openProfileModal = (customer: CRMCustomer) => {
    setSelectedCustomer(customer);
    setIsProfileModalOpen(true);
  }

  // --- FLASHING HELPER ---
  const isTabFlashing = (tabCount: number) => debouncedSearch.length > 0 && tabCount > 0;

  if (loading || !appUser) return null

  return (
    <div className="flex flex-col min-h-screen bg-[#fafafa] font-sans selection:bg-indigo-100 pb-20">
      
      {/* 1. GLOBAL HEADER */}
      <header className="h-14 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center sticky top-0 z-40 shadow-sm box-border">
        <div className="w-full max-w-7xl mx-auto flex justify-between items-center gap-4">
          <div className="flex items-center gap-2.5">
            <div className="h-7 w-7 bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center rounded text-xs shadow-sm">
              <Users className="w-3.5 h-3.5" />
            </div>
            <h1 className="text-sm font-semibold text-slate-900 tracking-tight leading-none hidden sm:block">CRM & Memberships</h1>
          </div>
          
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Store className="w-4 h-4 text-slate-400 hidden sm:block" />
            <Select value={selectedLocation} onValueChange={setSelectedLocation} disabled={isLocked}>
              <SelectTrigger className="h-8 text-xs font-semibold bg-white border-slate-200 focus:ring-1 focus:ring-indigo-500 w-full sm:w-48 md:w-56 rounded-md shadow-sm">
                <SelectValue placeholder="Select Context Node..." />
              </SelectTrigger>
              <SelectContent className="rounded-md border-slate-200 shadow-lg">
                {isHQ && <SelectItem value="ALL" className="text-xs font-bold text-indigo-600">All Branches (HQ)</SelectItem>}
                {warehouses.map(w => <SelectItem key={w.id} value={w.id} className="text-xs font-medium">{w.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Separator orientation="vertical" className="h-4 mx-1 hidden sm:block" />
            <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-none shrink-0" onClick={() => fetchPage(page)}>
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin text-indigo-500' : ''}`} />
            </Button>
            <Link href="/crm/settings">
              <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-none shrink-0" title="CRM Settings">
                <Settings className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="p-4 md:p-6 max-w-7xl w-full mx-auto space-y-4 md:space-y-6 animate-in fade-in duration-300">
        
        {/* 2. TOP ACTION BAR (Search + High-Level Actions) */}
        <div className="bg-white border border-slate-200 rounded-xl p-2 sm:p-3 shadow-sm flex flex-col md:flex-row gap-2 sm:gap-3 items-start md:items-center justify-between">
          
          {/* Smart Search */}
          <div className="relative flex-1 w-full max-w-2xl group">
             <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
             <Input 
               placeholder="Smart Search (Name, Phone)..." 
               className="pl-9 h-10 sm:h-11 text-sm font-medium bg-slate-50 border-slate-200 focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-indigo-100 focus-visible:border-indigo-400 rounded-lg transition-all w-full"
               value={searchTerm} 
               onChange={(e) => setSearchTerm(e.target.value)}
             />
             {searchTerm && (
               <Button variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 text-slate-400 hover:text-slate-600 rounded-full" onClick={() => { setSearchTerm(''); setDebouncedSearch(''); }}>
                 <X className="w-3.5 h-3.5" />
               </Button>
             )}
          </div>

          {/* Core Action Buttons */}
          <div className="flex flex-wrap md:flex-nowrap gap-2 w-full md:w-auto">
            <Button onClick={handleBulkBroadcast} className="flex-1 md:flex-none bg-emerald-600 hover:bg-emerald-700 text-white h-10 sm:h-11 px-4 text-xs font-bold rounded-lg shadow-sm transition-none">
              <MessageSquare className="w-3.5 h-3.5 sm:mr-1.5" /> <span className="hidden sm:inline">Broadcast</span>
            </Button>
            <Button onClick={() => setIsImportModalOpen(true)} className="flex-1 md:flex-none bg-blue-600 hover:bg-blue-700 text-white h-10 sm:h-11 px-4 text-xs font-bold rounded-lg shadow-sm transition-none">
              <UploadCloud className="w-3.5 h-3.5 sm:mr-1.5" /> <span className="hidden sm:inline">Import</span>
            </Button>
            <Button onClick={() => {
              setNewKittyForm(prev => ({ ...prev, full_name: '', phone: '', email: '', city: '', start_date: new Date().toISOString().split('T')[0], referred_by_id: 'none', referral_bonus: '500' }))
              setIsAddKittyModalOpen(true)
            }} className="flex-1 md:flex-none bg-purple-600 hover:bg-purple-700 text-white h-10 sm:h-11 px-4 text-xs font-bold rounded-lg shadow-sm transition-none">
              <Gem className="w-3.5 h-3.5 sm:mr-1.5" /> <span className="hidden sm:inline">Kitty Plan</span>
            </Button>
            <Button onClick={() => {
              setNewCustForm({ full_name: '', phone: '', email: '', city: '', customer_status: 'Lead', birth_date: '', anniversary_date: '', next_followup_date: '', followup_reason: '' }) 
              setIsAddModalOpen(true)
            }} className="flex-1 md:flex-none bg-slate-900 hover:bg-slate-800 text-white h-10 sm:h-11 px-4 text-xs font-bold shadow-sm rounded-lg transition-none">
              <UserPlus className="w-3.5 h-3.5 sm:mr-1.5" /> <span className="hidden sm:inline">Add Lead</span>
            </Button>
          </div>
        </div>

        {/* 3. METRICS DASHBOARD */}
        <CRMMetrics 
          totalCustomers={metrics.total} 
          reminders={{dueToday: metrics.dueToday, overdue: metrics.overdue}} 
          activeKittyCount={globalCounts.kitty} 
          sequences={metrics.sequences} 
        />

        {/* 4. UNIFIED COMMAND BAR (Filters & Sorting) */}
        {/* 4. UNIFIED COMMAND BAR (Filters & Sorting) */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col mb-4">
          
          <div className="bg-slate-50 border-b border-slate-100 p-2 sm:px-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
             <div className="flex items-center gap-2">
               <div className="bg-indigo-100 p-1 rounded text-indigo-600"><Filter className="w-3.5 h-3.5" /></div>
               <span className="text-[11px] font-bold text-slate-700 uppercase tracking-widest">Command Filters</span>
             </div>
             
             <div className="flex items-center gap-2 self-end sm:self-auto">
               {/* ✨ NEW: Export Data Dropdown */}
               <DropdownMenu>
                 <DropdownMenuTrigger asChild>
                   <Button variant="outline" size="sm" disabled={isExporting} className="h-7 px-3 rounded-md text-[10px] font-bold text-slate-600 bg-white border-slate-200 shadow-sm hover:bg-slate-50 transition-colors">
                     {isExporting ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Download className="w-3.5 h-3.5 mr-1.5" />}
                     Export Data
                   </Button>
                 </DropdownMenuTrigger>
                 <DropdownMenuContent align="end" className="w-56 rounded-lg shadow-md border-slate-200">
                   <DropdownMenuItem onClick={handleExportCurrent} className="text-xs font-semibold cursor-pointer py-2">
                     Export Current Page ({customers.length})
                   </DropdownMenuItem>
                   <DropdownMenuItem onClick={handleExportAll} className="text-xs font-semibold cursor-pointer py-2 text-indigo-600 focus:text-indigo-700 focus:bg-indigo-50">
                     Export All Matches ({globalCounts[activeTab as keyof typeof globalCounts] || 0})
                   </DropdownMenuItem>
                 </DropdownMenuContent>
               </DropdownMenu>

               {/* Clear Filters Button */}
               {(activeAiFilter !== 'none' || voucherFilter !== 'all' || giftFilter !== 'all') && (
                 <Button variant="ghost" size="sm" onClick={() => { setActiveAiFilter('none'); setVoucherFilter('all'); setGiftFilter('all'); }} className="h-7 px-3 rounded-md text-[10px] font-bold text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors">
                   <X className="w-3.5 h-3.5 mr-1" /> Clear All
                 </Button>
               )}
             </div>
          </div>

          {/* ✨ UPDATED: Removed horizontal scroll. Added flexible responsive wrapping & grid layout */}
          <div className="p-3 grid grid-cols-2 sm:flex sm:flex-wrap gap-2.5 items-center bg-white">
            
            {/* Sorting */}
            <Select value={sortOrder} onValueChange={(val: any) => setSortOrder(val)}>
              <SelectTrigger className="h-9 w-full sm:w-auto sm:min-w-[140px] text-xs font-bold bg-white border-slate-200 text-slate-700 shadow-sm rounded-lg shrink-0">
                 <div className="flex items-center gap-1.5"><ArrowUpDown className="w-3.5 h-3.5 text-slate-400 shrink-0" /> <span className="truncate"><SelectValue placeholder="Sort By" /></span></div>
              </SelectTrigger>
              <SelectContent className="border-slate-200 rounded-lg">
                <SelectItem value="followup_asc" className="text-xs font-medium">Follow-up: Soonest</SelectItem>
                <SelectItem value="followup_desc" className="text-xs font-medium">Follow-up: Latest</SelectItem>
                <SelectItem value="newest" className="text-xs font-medium">Recently Added</SelectItem>
                <SelectItem value="name_asc" className="text-xs font-medium">Name (A-Z)</SelectItem>
              </SelectContent>
            </Select>

            {/* Voucher Filter */}
            <Select value={voucherFilter} onValueChange={(v: any) => setVoucherFilter(v)}>
              <SelectTrigger className={cn("h-9 w-full sm:w-auto sm:min-w-[140px] text-xs font-bold rounded-lg shrink-0 shadow-sm transition-colors", voucherFilter !== 'all' ? "bg-teal-50 border-teal-200 text-teal-700" : "bg-white border-slate-200 text-slate-700")}>
                <div className="flex items-center gap-1.5"><TicketPercent className="w-3.5 h-3.5 shrink-0" /> <span className="truncate"><SelectValue placeholder="Voucher Filter" /></span></div>
              </SelectTrigger>
              <SelectContent className="rounded-lg border-slate-200">
                <SelectItem value="all">All Vouchers</SelectItem>
                <SelectItem value="none">Normal (No Voucher)</SelectItem>
                <SelectItem value="registered">Voucher Registered</SelectItem>
                <SelectItem value="redeemed">Voucher Redeemed</SelectItem>
              </SelectContent>
            </Select>

            {/* Gift Status Filter */}
            <Select value={giftFilter} onValueChange={(v: any) => setGiftFilter(v)}>
              <SelectTrigger className={cn("h-9 w-full sm:w-auto sm:min-w-[140px] text-xs font-bold rounded-lg shrink-0 shadow-sm transition-colors", giftFilter !== 'all' ? "bg-rose-50 border-rose-200 text-rose-700" : "bg-white border-slate-200 text-slate-700")}>
                <div className="flex items-center gap-1.5"><Gift className="w-3.5 h-3.5 shrink-0" /> <span className="truncate"><SelectValue placeholder="Gifting Status" /></span></div>
              </SelectTrigger>
              <SelectContent className="rounded-lg border-slate-200">
                <SelectItem value="all">All Gifting Status</SelectItem>
                <SelectItem value="pending">Gift Pending</SelectItem>
                <SelectItem value="given">Gift Given</SelectItem>
              </SelectContent>
            </Select>

            {/* Dynamic Gift Sorter */}
            {giftFilter === 'given' && (
              <Select value={giftSort} onValueChange={(v: any) => setGiftSort(v)}>
                <SelectTrigger className="h-9 w-full sm:w-auto sm:min-w-[140px] text-xs font-bold rounded-lg shrink-0 shadow-sm transition-colors bg-rose-100 border-rose-300 text-rose-800 animate-in fade-in zoom-in-95">
                  <div className="flex items-center gap-1.5"><ArrowUpDown className="w-3.5 h-3.5 shrink-0" /> <span className="truncate"><SelectValue placeholder="Sort Gifts" /></span></div>
                </SelectTrigger>
                <SelectContent className="rounded-lg border-slate-200 shadow-md">
                  <SelectItem value="latest">Latest Given First</SelectItem>
                  <SelectItem value="earliest">Earliest Given First</SelectItem>
                </SelectContent>
              </Select>
            )}

            <div className="col-span-2 hidden sm:block w-px h-6 bg-slate-200 mx-1 shrink-0" />

            {/* AI Toggle Filters Wrapper */}
            <div className="col-span-2 grid grid-cols-2 sm:flex sm:flex-wrap gap-2.5 w-full sm:w-auto mt-1 sm:mt-0">
              <Button 
                variant={activeAiFilter === 'scheme' ? 'default' : 'outline'} size="sm" 
                onClick={() => toggleAiFilter('scheme')}
                className={cn("w-full sm:w-auto shrink-0 h-9 px-3 rounded-lg text-xs font-bold transition-none border shadow-sm", activeAiFilter === 'scheme' ? "bg-indigo-600 text-white border-indigo-600" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50")}
              >
                Pitch Kitty <Badge variant="secondary" className={cn("ml-1.5 px-1 py-0 h-4 text-[9px]", activeAiFilter === 'scheme' ? "bg-indigo-500 text-white" : "bg-slate-100 text-slate-600")}>{metrics.schemeCount}</Badge>
              </Button>

              <Button 
                variant={activeAiFilter === 'cold' ? 'default' : 'outline'} size="sm" 
                onClick={() => toggleAiFilter('cold')}
                className={cn("w-full sm:w-auto shrink-0 h-9 px-3 rounded-lg text-xs font-bold transition-none border shadow-sm", activeAiFilter === 'cold' ? "bg-indigo-600 text-white border-indigo-600" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50")}
              >
                Cold Leads <Badge variant="secondary" className={cn("ml-1.5 px-1 py-0 h-4 text-[9px]", activeAiFilter === 'cold' ? "bg-indigo-500 text-white" : "bg-slate-100 text-slate-600")}>{metrics.coldCount}</Badge>
              </Button>

              <Button 
                variant={activeAiFilter === 'dnd' ? 'default' : 'outline'} size="sm" 
                onClick={() => toggleAiFilter('dnd')}
                className={cn("col-span-2 sm:col-span-1 w-full sm:w-auto shrink-0 h-9 px-3 rounded-lg text-xs font-bold transition-none border shadow-sm", activeAiFilter === 'dnd' ? "bg-red-600 text-white border-red-600" : "bg-white border-red-200 text-red-600 hover:bg-red-50")}
              >
                <PhoneOff className="w-3.5 h-3.5 mr-1.5 hidden sm:inline" /> DND <Badge variant="secondary" className={cn("ml-1.5 px-1 py-0 h-4 text-[9px]", activeAiFilter === 'dnd' ? "bg-red-500 text-white" : "bg-red-50 text-red-600")}>{metrics.dndCount}</Badge>
              </Button>
            </div>

          </div>
        </div>


        {/* 5. MAIN LIST AREA */}
        <Card className="flex-1 flex flex-col border-slate-200 shadow-sm overflow-hidden bg-white rounded-xl">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
            
            <CardHeader className="py-2 px-3 border-b border-slate-100 bg-slate-50/50 shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3 overflow-x-auto no-scrollbar">
              <TabsList className="bg-slate-100/50 h-10 p-1 rounded-lg border border-slate-200/60 self-start shrink-0 flex-nowrap gap-1">
                
                {/* Master ALL Tab */}
                <TabsTrigger value="all" className={cn("text-[11px] font-bold rounded-md whitespace-nowrap px-3 h-full data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-indigo-700 transition-all", isTabFlashing(globalCounts.all) && "ring-2 ring-indigo-400 bg-indigo-50/50 text-indigo-700")}>
                  Master List <Badge variant="secondary" className="ml-1.5 text-[9px] h-4 px-1 bg-slate-100">{globalCounts.all}</Badge>
                  {isTabFlashing(globalCounts.all) && <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />}
                </TabsTrigger>

                <TabsTrigger value="walkin" className={cn("text-[11px] font-bold rounded-md whitespace-nowrap px-3 h-full data-[state=active]:bg-white data-[state=active]:shadow-sm transition-all", isTabFlashing(globalCounts.walkin) && "ring-2 ring-indigo-400 bg-indigo-50/50 text-indigo-700")}>
                  Walk-ins <Badge variant="secondary" className="ml-1.5 text-[9px] h-4 px-1 bg-slate-100">{globalCounts.walkin}</Badge>
                  {isTabFlashing(globalCounts.walkin) && <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />}
                </TabsTrigger>

                <TabsTrigger value="followups" className={cn("text-[11px] font-bold rounded-md whitespace-nowrap px-3 h-full data-[state=active]:bg-white data-[state=active]:shadow-sm transition-all", isTabFlashing(globalCounts.followups) && "ring-2 ring-indigo-400 bg-indigo-50/50 text-indigo-700")}>
                  Inquiries / Leads <Badge variant="secondary" className="ml-1.5 text-[9px] h-4 px-1 bg-slate-100">{globalCounts.followups}</Badge>
                  {isTabFlashing(globalCounts.followups) && <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />}
                </TabsTrigger>
                
                <TabsTrigger value="purchased" className={cn("text-[11px] font-bold rounded-md whitespace-nowrap px-3 h-full data-[state=active]:bg-white data-[state=active]:shadow-sm transition-all", isTabFlashing(globalCounts.purchased) && "ring-2 ring-emerald-400 bg-emerald-50/50 text-emerald-700")}>
                  Past Buyers <Badge variant="secondary" className="ml-1.5 text-[9px] h-4 px-1 bg-emerald-50 text-emerald-600 border-emerald-100">{globalCounts.purchased}</Badge>
                  {isTabFlashing(globalCounts.purchased) && <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />}
                </TabsTrigger>

                <TabsTrigger value="kitty" className={cn("text-[11px] font-bold rounded-md whitespace-nowrap px-3 h-full data-[state=active]:bg-white data-[state=active]:shadow-sm text-purple-700 transition-all", isTabFlashing(globalCounts.kitty) && "ring-2 ring-purple-400 bg-purple-50/50")}>
                  Kitty Members <Badge variant="secondary" className="ml-1.5 text-[9px] h-4 px-1 bg-purple-50 text-purple-600 border-purple-100">{globalCounts.kitty}</Badge>
                  {isTabFlashing(globalCounts.kitty) && <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse" />}
                </TabsTrigger>

                <TabsTrigger value="vouchers" className={cn("text-[11px] font-bold rounded-md whitespace-nowrap px-3 h-full data-[state=active]:bg-white data-[state=active]:shadow-sm text-teal-700 transition-all", isTabFlashing(globalCounts.vouchers) && "ring-2 ring-teal-400 bg-teal-50/50")}>
                  <TicketPercent className="w-3.5 h-3.5 mr-1.5 hidden sm:inline" /> Vouchers <Badge variant="secondary" className="ml-1.5 text-[9px] h-4 px-1 bg-teal-50 text-teal-600 border-teal-100">{globalCounts.vouchers}</Badge>
                  {isTabFlashing(globalCounts.vouchers) && <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse" />}
                </TabsTrigger>
                
                <TabsTrigger value="assigned_calls" className={cn("text-[11px] font-bold rounded-md whitespace-nowrap px-3 h-full data-[state=active]:bg-white data-[state=active]:shadow-sm text-amber-700 transition-all", isTabFlashing(globalCounts.assignedCalls) && "ring-2 ring-amber-400 bg-amber-50/50")}>
                  <PhoneCall className="w-3.5 h-3.5 mr-1.5 hidden sm:inline" /> Assigned Calls <Badge variant="secondary" className="ml-1.5 text-[9px] h-4 px-1 bg-amber-50 text-amber-600 border-amber-100">{globalCounts.assignedCalls}</Badge>
                  {isTabFlashing(globalCounts.assignedCalls) && <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />}
                </TabsTrigger>

                <TabsTrigger value="dnd" className="hidden">DND</TabsTrigger>
              </TabsList>
            </CardHeader>
            
            <CardContent className="p-0 flex-1 overflow-hidden">
              
              {/* TAB LISTINGS (Reused CustomerList with specific empty messages) */}
              {['all', 'walkin', 'followups', 'purchased', 'kitty', 'vouchers', 'assigned_calls', 'dnd'].map(tab => (
                <TabsContent key={tab} value={tab} className="h-full m-0 data-[state=active]:flex flex-col">
                   <CustomerList 
                      data={customers} 
                      loading={isLoading} 
                      emptyMessage={
                        debouncedSearch ? `No results found for "${debouncedSearch}" in this tab.` :
                        tab === 'all' ? "No customers found." :
                        tab === 'walkin' ? "No Walk-in customers found." :
                        tab === 'followups' ? "No active leads found." :
                        tab === 'purchased' ? "No purchased customers found." :
                        tab === 'kitty' ? "No Kitty Members found." :
                        tab === 'vouchers' ? "No Voucher Customers found." :
                        tab === 'assigned_calls' ? "You have no pending assigned calls." :
                        "No Do Not Disturb customers found."
                      }
                      onMessage={openWhatsAppModal}
                      onSchedule={openScheduleModal}
                      onViewProfile={openProfileModal}
                      onLogCall={openCallLoggerModal} 
                      onViewHistory={handleViewHistory}
                      onViewWaActivity={openWaActivityModal}
                      isKitty={tab === 'kitty'}
                   />
                   {/* Pagination Footer */}
                   <div className="bg-slate-50 border-t border-slate-200 p-3 sm:p-4 flex flex-col sm:flex-row items-center justify-between gap-4 rounded-b-xl shrink-0">
                     <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-start">
                       <span className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Rows per page:</span>
                       <Select value={pageSize.toString()} onValueChange={(val) => setPageSize(Number(val))}>
                         <SelectTrigger className="h-8 w-[80px] text-xs bg-white font-bold shadow-sm rounded-lg border-slate-200">
                           <SelectValue />
                         </SelectTrigger>
                         <SelectContent className="rounded-lg border-slate-200">
                           <SelectItem value="50">50</SelectItem>
                           <SelectItem value="100">100</SelectItem>
                           <SelectItem value="200">200</SelectItem>
                           <SelectItem value="500">500</SelectItem>
                         </SelectContent>
                       </Select>
                     </div>
                     
                     <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
                       <span className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">
                         Showing <span className="text-indigo-600">{customers.length > 0 ? page * pageSize + 1 : 0}</span> to <span className="text-indigo-600">{Math.min((page + 1) * pageSize, globalCounts[tab as keyof typeof globalCounts] || 0)}</span> of <span className="text-indigo-600">{globalCounts[tab as keyof typeof globalCounts] || 0}</span>
                       </span>
                       <div className="flex items-center gap-1.5 w-full sm:w-auto">
                         <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0 || isLoading} className="flex-1 sm:flex-none h-8 px-3 text-xs font-bold bg-white text-slate-600 shadow-sm rounded-lg border-slate-200 hover:bg-slate-50">
                           <ChevronLeft className="w-4 h-4 mr-1"/> Prev
                         </Button>
                         <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)} disabled={(page + 1) * pageSize >= (globalCounts[tab as keyof typeof globalCounts] || 0) || isLoading} className="flex-1 sm:flex-none h-8 px-3 text-xs font-bold bg-white text-slate-600 shadow-sm rounded-lg border-slate-200 hover:bg-slate-50">
                           Next <ChevronRight className="w-4 h-4 ml-1"/>
                         </Button>
                       </div>
                     </div>
                   </div>
                </TabsContent>
              ))}

            </CardContent>
          </Tabs>
        </Card>
      </main>

      <WhatsAppSenderModal 
        isOpen={isSenderModalOpen}
        onClose={() => setIsSenderModalOpen(false)}
        recipients={messageRecipients}
      />

      <CRMModals 
        isImportModalOpen={isImportModalOpen} setIsImportModalOpen={setIsImportModalOpen}
        isPreviewModalOpen={isPreviewModalOpen} setIsPreviewModalOpen={setIsPreviewModalOpen}
        isProfileModalOpen={isProfileModalOpen} setIsProfileModalOpen={setIsProfileModalOpen}
        isLoyaltyModalOpen={isLoyaltyModalOpen} setIsLoyaltyModalOpen={setIsLoyaltyModalOpen}
        isAddModalOpen={isAddModalOpen} setIsAddModalOpen={setIsAddModalOpen}
        isAddKittyModalOpen={isAddKittyModalOpen} setIsAddKittyModalOpen={setIsAddKittyModalOpen}
        isFollowupModalOpen={isFollowupModalOpen} setIsFollowupModalOpen={setIsFollowupModalOpen}
        isWhatsAppModalOpen={isWhatsAppModalOpen} setIsWhatsAppModalOpen={setIsWhatsAppModalOpen}
        isWaActivityModalOpen={isWaActivityModalOpen} setIsWaActivityModalOpen={setIsWaActivityModalOpen} 
        
        
        importFile={importFile} setImportFile={setImportFile}
        previewData={previewData}
        selectedCustomer={selectedCustomer}
        selectedLocation={selectedLocation}
        warehouses={warehouses}
        activeAiFilter={activeAiFilter}
        customers={customers} 
        kittyConfigs={kittyConfigs}
        
        newCustForm={newCustForm} setNewCustForm={setNewCustForm}
        newKittyForm={newKittyForm} setNewKittyForm={setNewKittyForm}
        loyaltyForm={loyaltyForm} setLoyaltyForm={setLoyaltyForm}
        waTemplateId={waTemplateId} setWaTemplateId={setWaTemplateId}
        customMessage={customMessage} setCustomMessage={setCustomMessage}
        followupReason={followupReason} setFollowupReason={setFollowupReason}
        followupDate={followupDate} setFollowupDate={setFollowupDate}
        interactionNotes={interactionNotes} setInteractionNotes={setInteractionNotes}
        
        isImporting={isImporting}
        isSubmitting={isSubmitting}
        
        handleDownloadSample={handleDownloadSample}
        handleParseFile={handleParseFile}
        removePreviewRow={removePreviewRow}
        updatePreviewRow={updatePreviewRow}
        handleCommitImport={handleCommitImport}
        handleAddCustomer={handleAddCustomer}
        handleAddKittyMember={handleAddKittyMember}
        handleUpdateLoyalty={handleUpdateLoyalty}
        handleRecordKittyPayment={handleRecordKittyPayment}
        handleUpdateFollowup={handleUpdateFollowup}
        handleTemplateChange={handleTemplateChange}
        handleSendWhatsApp={handleSendWhatsApp}
        openWhatsAppModal={openWhatsAppModal}
        dynamicTemplates={dynamicTemplates} 

        isCallModalOpen={isCallModalOpen} setIsCallModalOpen={setIsCallModalOpen}
        callForm={callForm} setCallForm={setCallForm}
        handleLogCall={handleLogCall}

        isHistoryModalOpen={isHistoryModalOpen} setIsHistoryModalOpen={setIsHistoryModalOpen}
        customerHistory={customerHistory}
        isHistoryLoading={isHistoryLoading}
      />
    </div>
  )
}