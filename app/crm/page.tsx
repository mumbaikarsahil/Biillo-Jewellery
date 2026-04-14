'use client'

import React, { useEffect, useState, useMemo } from 'react'
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
  Users, Search, Store, Gem, FilterX, RefreshCw,
  UserPlus, UploadCloud, Settings
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Separator } from '@radix-ui/react-separator'
import Papa from 'papaparse'

// Import Extracted Components & Types
import { CRMCustomer, Warehouse } from './types'
import { CustomerList } from './components/CustomerList'
import { CRMMetrics } from './components/CRMMetrics'
import { CRMModals } from './components/CRMModals'

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

  const [activeAiFilter, setActiveAiFilter] = useState<'none' | 'scheme' | 'cold' | 'birthday' | 'anniversary'>('none')

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isAddKittyModalOpen, setIsAddKittyModalOpen] = useState(false)
  const [isWhatsAppModalOpen, setIsWhatsAppModalOpen] = useState(false)
  const [isFollowupModalOpen, setIsFollowupModalOpen] = useState(false)
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false)
  const [isLoyaltyModalOpen, setIsLoyaltyModalOpen] = useState(false)
  
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
  
  // Unified Loyalty Form
  const [loyaltyForm, setLoyaltyForm] = useState({ 
    actionType: 'manual_add', 
    amount: '', 
    billedAmount: '', 
    notes: '' 
  })

  // Interaction States
  const [waTemplateId, setWaTemplateId] = useState<string>('')
  const [customMessage, setCustomMessage] = useState('')
  const [followupDate, setFollowupDate] = useState('')
  const [followupReason, setFollowupReason] = useState('') 
  const [interactionNotes, setInteractionNotes] = useState('')

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

  const fetchCRMData = async () => {
    if (!appUser || !selectedLocation) return
    setIsLoading(true)
    try {
      let query = supabase.from('customers').select('*, kitty_plans(*)').eq('company_id', appUser.company_id).order('next_followup_date', { ascending: true, nullsFirst: false }) 
      if (selectedLocation !== 'ALL') query = query.eq('warehouse_id', selectedLocation)

      const { data, error } = await query
      if (error) throw error
      setCustomers(data || [])
    } catch (err) {
      toast.error('Error fetching customers')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => { fetchCRMData() }, [appUser, selectedLocation])

  const handleDownloadSample = () => {
    const csvContent = "full_name,phone,city,customer_status,birth_date,anniversary_date,store_credit_balance\nJohn Doe,9876543210,Mumbai,Lead,1990-01-01,2015-05-15,0\nJane Smith,9123456789,Delhi,Purchased,1985-08-20,1200\nRahul Sharma,9988776655,Pune,Kitty Member,1992-12-10,2020-11-20,0";
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
               birth_date: row.birth_date?.trim() || '',
               anniversary_date: row.anniversary_date?.trim() || '',
               store_credit_balance: row.store_credit_balance?.trim() || '0'
            }));

          if (mappedData.length === 0) throw new Error("No valid rows found. Ensure 'full_name' and 'phone' exist.");

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

      const { error } = await supabase.from('customers').upsert(validPayloads, { onConflict: 'company_id, phone' });
      if (error) throw error;

      toast.success(`Imported ${validPayloads.length} customers!`);
      setIsPreviewModalOpen(false);
      setImportFile(null);
      setPreviewData([]);
      fetchCRMData();
    } catch (err: any) {
      toast.error(`Import Failed: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

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
      fetchCRMData()
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

      const customerPayload = {
        company_id: appUser?.company_id,
        warehouse_id: selectedLocation, 
        full_name: newKittyForm.full_name.trim(),
        phone: cleanPhone,
        email: newKittyForm.email?.trim() || null, 
        city: newKittyForm.city?.trim() || null,
        customer_status: 'Kitty Member',
        next_followup_date: nextInstallment.toISOString().split('T')[0],
        followup_reason: `Installment due (₹${selectedConfig.monthly_amount})`,
        last_interaction: `Joined Diamond Kitty Scheme on ${sd.toLocaleDateString()}`
      };

      const { data: existing } = await supabase.from('customers').select('id').eq('company_id', appUser?.company_id).eq('phone', cleanPhone).limit(1).maybeSingle();

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

      if (newKittyForm.referred_by_id !== 'none') {
         const bonusAmount = Number(newKittyForm.referral_bonus) || 500;
         const { data: referrer } = await supabase.from('customers').select('store_credit_balance, full_name').eq('id', newKittyForm.referred_by_id).single();
         
         if (referrer) {
           const newBal = (referrer.store_credit_balance || 0) + bonusAmount;
           await supabase.from('customers').update({
             store_credit_balance: newBal,
             last_interaction: `Received ₹${bonusAmount} Referral Bonus for bringing in ${newKittyForm.full_name.trim()}`
           }).eq('id', newKittyForm.referred_by_id);
           toast.success(`Added ₹${bonusAmount} to ${referrer.full_name}'s wallet!`);
         }
      }

      toast.success('Customer enrolled in Diamond Kitty.')
      setIsAddKittyModalOpen(false)
      setIsProfileModalOpen(false) 
      setNewKittyForm(prev => ({ ...prev, full_name: '', phone: '', email: '', city: '', start_date: new Date().toISOString().split('T')[0], referred_by_id: 'none', referral_bonus: '500' }))
      await fetchCRMData()
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
      await fetchCRMData()
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
        if (loyaltyForm.actionType === 'wedding_intro') note = note || `Wedding House Introduction Bonus (+₹${amount})`;
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
      fetchCRMData(); 
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
      
      fetchCRMData();
      
      const { data: updatedCust } = await supabase.from('customers').select('*, kitty_plans(*)').eq('id', customer.id).single();
      if (updatedCust) setSelectedCustomer(updatedCust);

    } catch (err: any) {
      toast.error(`Payment Failed: ${err.message}`);
    }
  }

  const openWhatsAppModal = (customer: CRMCustomer, forcedTemplateId?: string) => {
    setSelectedCustomer(customer)
    let statusKey = 'Lead'
    if (customer.customer_status === 'Purchased') statusKey = 'Purchased'
    
    // Check for both active AND matured plans to determine if they are a Kitty Member
    const hasActivePlan = customer.kitty_plans && customer.kitty_plans.some(p => ['active', 'matured'].includes(p.status));
    if (customer.customer_status === 'Kitty Member' || hasActivePlan) statusKey = 'Kitty'

    const categoryTemplates = dynamicTemplates.filter(t => t.category === statusKey)
    let defaultTemplateId = forcedTemplateId || (categoryTemplates[0]?.template_id || '')
    
    if (!forcedTemplateId) {
      if (activeAiFilter === 'scheme' && statusKey === 'Purchased') defaultTemplateId = 'scheme_upsell'
      if (activeAiFilter === 'scheme' && statusKey === 'Lead') defaultTemplateId = 'kitty_invite'
      if (activeAiFilter === 'cold' && statusKey === 'Lead') defaultTemplateId = 'cold_lead'
    }

    const tpl = categoryTemplates.find(t => t.template_id === defaultTemplateId) || categoryTemplates[0]
    setWaTemplateId(tpl?.template_id || '')
    
    if (tpl) setCustomMessage(tpl.message_text.replace(/{name}/g, customer.full_name.split(' ')[0]))
    else setCustomMessage(`Hi ${customer.full_name.split(' ')[0]}, `)
    
    setIsWhatsAppModalOpen(true)
  }

  const handleTemplateChange = (templateId: string) => {
    setWaTemplateId(templateId)
    const tpl = dynamicTemplates.find(t => t.template_id === templateId)
    if (tpl && selectedCustomer) {
      setCustomMessage(tpl.message_text.replace(/{name}/g, selectedCustomer.full_name.split(' ')[0]))
    }
  }

  const handleSendWhatsApp = () => {
    if (!selectedCustomer) return
    let phone = selectedCustomer.phone.replace(/\D/g, '')
    if (phone.length === 10) phone = '91' + phone 
    
    const encodedMessage = encodeURIComponent(customMessage)
    window.open(`https://wa.me/${phone}?text=${encodedMessage}`, '_blank')
    setIsWhatsAppModalOpen(false)
    
    const tplLabel = dynamicTemplates.find(t => t.template_id === waTemplateId)?.label || 'Custom Message'
    setInteractionNotes(`Sent WhatsApp: ${tplLabel}`)
    setFollowupDate(selectedCustomer.next_followup_date || '')
    setFollowupReason(selectedCustomer.followup_reason || '')
    setTimeout(() => setIsFollowupModalOpen(true), 500)
  }

  const openScheduleModal = (customer: CRMCustomer) => {
    setSelectedCustomer(customer); 
    setFollowupDate(customer.next_followup_date || ''); 
    setFollowupReason(customer.followup_reason || ''); 
    setInteractionNotes(customer.last_interaction || ''); 
    setIsFollowupModalOpen(true); 
  }

  const openProfileModal = (customer: CRMCustomer) => {
    setSelectedCustomer(customer);
    setIsProfileModalOpen(true);
  }

  const { filteredLeads, filteredPurchased, filteredKitty, insights, reminders } = useMemo(() => {
    const today = new Date(); today.setHours(0,0,0,0);
    const thirtyDaysAgo = new Date(today); thirtyDaysAgo.setDate(today.getDate() - 30)
    const fourteenDaysAgo = new Date(today); fourteenDaysAgo.setDate(today.getDate() - 14)

    let baseLeads = customers.filter(c => c.customer_status === 'Lead' || c.customer_status == null)
    let basePurchased = customers.filter(c => c.customer_status === 'Purchased')
    
    // --- FIXED: Make sure matured plans keep the customer in the Kitty tab! ---
    let baseKitty = customers.filter(c => c.customer_status === 'Kitty Member' || (c.kitty_plans && c.kitty_plans.some(p => ['active', 'matured'].includes(p.status))))

    let dueToday = 0; let overdue = 0;
    customers.forEach(l => {
      if (l.next_followup_date) {
        const d = new Date(l.next_followup_date); d.setHours(0,0,0,0);
        if (d.getTime() === today.getTime()) dueToday++
        else if (d.getTime() < today.getTime()) overdue++
      }
    })

    const schemeEligible = basePurchased.filter(c => new Date(c.created_at) < thirtyDaysAgo)
    const coldLeads = baseLeads.filter(c => new Date(c.created_at) < fourteenDaysAgo)

    if (activeAiFilter === 'scheme') basePurchased = schemeEligible
    if (activeAiFilter === 'cold') baseLeads = coldLeads

    if (searchTerm) {
      const s = searchTerm.toLowerCase()
      baseLeads = baseLeads.filter(c => c.full_name.toLowerCase().includes(s) || c.phone.includes(s))
      basePurchased = basePurchased.filter(c => c.full_name.toLowerCase().includes(s) || c.phone.includes(s))
      baseKitty = baseKitty.filter(c => c.full_name.toLowerCase().includes(s) || c.phone.includes(s))
    }

    return { 
      filteredLeads: baseLeads, 
      filteredPurchased: basePurchased,
      filteredKitty: baseKitty,
      insights: { scheme: schemeEligible.length + baseLeads.length, cold: coldLeads.length },
      reminders: { dueToday, overdue }
    }
  }, [customers, activeAiFilter, searchTerm])

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
            <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-none shrink-0" onClick={fetchCRMData}>
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

      <main className="p-4 md:p-6 max-w-7xl w-full mx-auto space-y-6 animate-in fade-in duration-300">
        
        {/* 2. ACTION BAR */}
        <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm flex flex-col md:flex-row gap-3 items-start md:items-center justify-between">
          <div className="relative w-full md:w-[300px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input 
              placeholder="Search by name or phone..." 
              className="pl-9 h-10 text-sm font-medium bg-slate-50 border-slate-200 focus-visible:bg-white focus-visible:border-slate-400 focus-visible:ring-1 focus-visible:ring-slate-400 rounded-lg transition-all"
              value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex gap-2 w-full md:w-auto">
            <Button onClick={() => setIsImportModalOpen(true)} className="flex-1 md:flex-none bg-emerald-600 hover:bg-emerald-700 text-white h-10 px-4 text-xs font-bold shadow-sm rounded-lg border border-emerald-500 transition-none">
              <UploadCloud className="w-3.5 h-3.5 mr-1.5" /> Import
            </Button>

            <Button onClick={() => {
              setNewKittyForm(prev => ({ 
                ...prev, 
                full_name: '', phone: '', email: '', city: '', 
                start_date: new Date().toISOString().split('T')[0], 
                referred_by_id: 'none', referral_bonus: '500' 
              }))
              setIsAddKittyModalOpen(true)
            }} className="flex-1 md:flex-none bg-purple-600 hover:bg-purple-700 text-white h-10 px-4 text-xs font-bold shadow-sm rounded-lg border border-purple-500 transition-none">
              <Gem className="w-3.5 h-3.5 mr-1.5" /> Start Kitty Plan
            </Button>
            
            <Button onClick={() => {
              setNewCustForm({ full_name: '', phone: '', email: '', city: '', customer_status: 'Lead', birth_date: '', anniversary_date: '', next_followup_date: '', followup_reason: '' }) 
              setIsAddModalOpen(true)
            }} className="flex-1 md:flex-none bg-slate-900 hover:bg-slate-800 text-white h-10 px-4 text-xs font-bold shadow-sm rounded-lg transition-none">
              <UserPlus className="w-3.5 h-3.5 mr-1.5" /> Add Customer
            </Button>
          </div>
        </div>

        {/* 3. METRICS DASHBOARD */}
        <CRMMetrics 
          totalCustomers={customers.length} 
          reminders={reminders} 
          activeKittyCount={filteredKitty.length} 
        />

        {/* 4. QUICK FILTERS */}
        <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-4 shadow-sm shrink-0 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-white p-2 rounded-lg border border-indigo-100 text-indigo-500 shadow-sm"><Search className="w-4 h-4" /></div>
            <div>
              <h2 className="text-sm font-bold text-indigo-900 tracking-tight">Quick Cohort Filters</h2>
              <p className="text-[10px] text-indigo-500 font-medium">Find specific groups of customers to message.</p>
            </div>
          </div>
          
          <div className="flex gap-2 flex-wrap lg:justify-end">
            <Button 
              variant={activeAiFilter === 'scheme' ? 'default' : 'outline'} size="sm" 
              onClick={() => setActiveAiFilter(activeAiFilter === 'scheme' ? 'none' : 'scheme')}
              className={cn("h-8 text-xs font-semibold transition-none rounded-lg", activeAiFilter === 'scheme' ? "bg-indigo-600 text-white border-transparent" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50")}
            >
              Can Pitch Kitty ({insights.scheme})
            </Button>
            <Button 
              variant={activeAiFilter === 'cold' ? 'default' : 'outline'} size="sm" 
              onClick={() => setActiveAiFilter(activeAiFilter === 'cold' ? 'none' : 'cold')}
              className={cn("h-8 text-xs font-semibold transition-none rounded-lg", activeAiFilter === 'cold' ? "bg-indigo-600 text-white border-transparent" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50")}
            >
              Cold Leads ({insights.cold})
            </Button>
            
            {activeAiFilter !== 'none' && (
              <Button variant="ghost" size="icon" onClick={() => setActiveAiFilter('none')} className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg">
                <FilterX className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>

        {/* 5. MAIN LIST AREA */}
        <Card className="flex-1 flex flex-col border-slate-200 shadow-sm overflow-hidden bg-white rounded-xl">
          <Tabs defaultValue="followups" className="flex-1 flex flex-col overflow-hidden">
            <CardHeader className="py-2 px-3 border-b border-slate-100 bg-slate-50/50 shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <TabsList className="bg-slate-100/50 h-9 p-1 rounded-lg border border-slate-200/60 self-start">
                <TabsTrigger value="followups" className="text-[11px] font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-md">
                  Inquiries / Leads <Badge variant="secondary" className="ml-1.5 text-[9px] h-4 px-1 bg-slate-100">{filteredLeads.length}</Badge>
                </TabsTrigger>
                <TabsTrigger value="purchased" className="text-[11px] font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-md">
                  Past Buyers <Badge variant="secondary" className="ml-1.5 text-[9px] h-4 px-1 bg-emerald-50 text-emerald-600 border-emerald-100">{filteredPurchased.length}</Badge>
                </TabsTrigger>
                <TabsTrigger value="kitty" className="text-[11px] font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm text-purple-700 rounded-md">
                  Kitty Plan Members <Badge variant="secondary" className="ml-1.5 text-[9px] h-4 px-1 bg-purple-50 text-purple-600 border-purple-100">{filteredKitty.length}</Badge>
                </TabsTrigger>
              </TabsList>
            </CardHeader>
            
            <CardContent className="p-0 flex-1 overflow-hidden">
              <TabsContent value="followups" className="h-full m-0 data-[state=active]:flex flex-col">
                 <CustomerList 
                   data={filteredLeads} 
                   loading={isLoading} 
                   emptyMessage={activeAiFilter !== 'none' ? "No leads match this filter." : "No active leads found."}
                   onMessage={openWhatsAppModal}
                   onSchedule={openScheduleModal}
                   onViewProfile={openProfileModal}
                 />
              </TabsContent>

              <TabsContent value="purchased" className="h-full m-0 data-[state=active]:flex flex-col">
                 <CustomerList 
                   data={filteredPurchased} 
                   loading={isLoading} 
                   emptyMessage={activeAiFilter !== 'none' ? "No buyers match this filter." : "No purchased customers found."}
                   onMessage={openWhatsAppModal}
                   onSchedule={openScheduleModal}
                   onViewProfile={openProfileModal}
                 />
              </TabsContent>

              <TabsContent value="kitty" className="h-full m-0 data-[state=active]:flex flex-col">
                 <CustomerList 
                   data={filteredKitty} 
                   loading={isLoading} 
                   emptyMessage="No active Kitty Members found for this branch."
                   onMessage={openWhatsAppModal}
                   onSchedule={openScheduleModal}
                   onViewProfile={openProfileModal}
                   isKitty={true}
                 />
              </TabsContent>
            </CardContent>
          </Tabs>
        </Card>
      </main>

      {/* ALL MODALS */}
      <CRMModals 
        isImportModalOpen={isImportModalOpen} setIsImportModalOpen={setIsImportModalOpen}
        isPreviewModalOpen={isPreviewModalOpen} setIsPreviewModalOpen={setIsPreviewModalOpen}
        isProfileModalOpen={isProfileModalOpen} setIsProfileModalOpen={setIsProfileModalOpen}
        isLoyaltyModalOpen={isLoyaltyModalOpen} setIsLoyaltyModalOpen={setIsLoyaltyModalOpen}
        isAddModalOpen={isAddModalOpen} setIsAddModalOpen={setIsAddModalOpen}
        isAddKittyModalOpen={isAddKittyModalOpen} setIsAddKittyModalOpen={setIsAddKittyModalOpen}
        isFollowupModalOpen={isFollowupModalOpen} setIsFollowupModalOpen={setIsFollowupModalOpen}
        isWhatsAppModalOpen={isWhatsAppModalOpen} setIsWhatsAppModalOpen={setIsWhatsAppModalOpen}
        
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
      />
    </div>
  )
}