'use client'

import React, { useEffect, useState, useMemo } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useStoreLocation } from '@/hooks/useStoreLocation' 
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Dialog, DialogContent, DialogHeader, 
  DialogTitle, DialogFooter, DialogDescription 
} from '@/components/ui/dialog'
import { 
  Select, SelectContent, SelectItem, 
  SelectTrigger, SelectValue 
} from '@/components/ui/select'
import { 
  Table, TableBody, TableCell, TableHead, 
  TableHeader, TableRow 
} from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { supabase } from '@/lib/supabaseClient'
import { useToast } from '@/hooks/use-toast'
import { 
  MessageCircle, Users, Calendar, Phone, 
  UserPlus, Search, AlertCircle, Store, Gem, Sparkles, FilterX, RefreshCw,
  Database, IndianRupee, Star, User, Wallet, Gift, CheckCircle2, Clock, Lock, Loader2, Edit2, UploadCloud, Download, FileSpreadsheet, Trash2
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Separator } from '@radix-ui/react-separator'
import Papa from 'papaparse'

interface CRMCustomer {
  id: string
  full_name: string
  phone: string
  city: string | null
  customer_status: string 
  next_followup_date: string | null
  followup_reason: string | null 
  last_interaction: string | null
  created_at: string
  birth_date?: string
  anniversary_date?: string
  warehouse_id?: string
  store_credit_balance?: number
  pavitram_points?: number
  kitty_plan_name?: string
  kitty_plan_status?: string
  kitty_installment_amount?: number
  kitty_months_paid?: number
  kitty_payment_ledger?: any[]
}

interface Warehouse {
  id: string
  name: string
}

// ✨ DYNAMIC AI-DRIVEN TEMPLATES
const WA_TEMPLATES = {
  Lead: [
    { id: 'followup', label: 'General Follow-up', text: "Hi {name}, this is Sahil from OSSAM JEWELS. We noticed you were interested in our recent collection. Let me know if you'd like to schedule a visit or see more designs! 💎" },
    { id: 'hot_lead', label: 'Hot Lead (Offer)', text: "Hi {name}, still thinking about that piece you liked at OSSAM JEWELS? We're offering a special 5% discount on making charges if you book it this week! ✨" },
    { id: 'kitty_invite', label: 'Invite to Diamond Kitty', text: "Hello {name}! Join the Pavitram Diamond Kitty at OSSAM JEWELS! 💎 Invest just ₹5,000/month for 12 months. Enjoy our monthly Housie games, mega lucky draws for cash prizes up to ₹21,000, and take home stunning diamond jewelry at the end! Let me know if you want to reserve a spot. 🎉" },
    { id: 'cold_lead', label: 'Wake-up Cold Lead', text: "Hello {name}! It's been a while since you visited OSSAM JEWELS. We just launched our breathtaking new Antique collection. Drop by to see what's new! 🌟" },
    { id: 'festival', label: 'Festival Invite', text: "Hello {name}! ✨ Celebrate this festive season with OSSAM JEWELS. We have an exclusive new collection waiting for you. Visit our store to check it out!" },
    { id: 'birthday', label: 'Birthday Wish', text: "Happy Birthday Month, {name}! 🎉 Celebrate your special day with a visit to OSSAM JEWELS to see our latest arrivals!" },
    { id: 'anniversary', label: 'Anniversary Wish', text: "Happy Anniversary Month, {name}! 💖 Celebrate your special milestone with a beautiful gift from OSSAM JEWELS." },
    { id: 'blank', label: 'Blank Message', text: "Hi {name}, " }
  ],
  Purchased: [
    { id: 'thankyou', label: 'Thank You for Purchase', text: "Dear {name}, thank you for shopping with OSSAM JEWELS! We hope you love your new jewelry. Let us know if you need any assistance with jewelry care. ✨" },
    { id: 'scheme_upsell', label: 'Diamond Kitty Upsell', text: "Hi {name}! As a valued customer, we'd love for you to join the Pavitram Diamond Kitty! 💎 Invest ₹5,000/month, join our fun monthly events with Housie and Lucky Draws, and build a fund for your next big diamond purchase. Spots are limited, let me know if you are interested! ✨" },
    { id: 'service', label: 'Free Polishing Reminder', text: "Hi {name}, it's been a while! Just a reminder that OSSAM JEWELS offers complimentary cleaning and polishing for your purchased items. Drop by anytime! 💎" },
    { id: 'birthday', label: 'Birthday Wish & Offer', text: "Happy Birthday Month, {name}! 🎉 Wishing you a sparkling year ahead. Visit OSSAM JEWELS this month for a special birthday discount on your next purchase!" },
    { id: 'anniversary', label: 'Anniversary Wish & Offer', text: "Happy Anniversary Month, {name}! 💖 Wishing you endless love and joy. Visit OSSAM JEWELS this month for a special anniversary discount!" },
    { id: 'store_credit', label: 'Store Credit Reminder', text: "Hi {name}! Just a quick reminder from OSSAM JEWELS that you currently have Store Credit available in your account! Visit us to redeem it on our beautiful new collections! ✨" },
    { id: 'blank', label: 'Blank Message', text: "Hi {name}, " }
  ],
  Kitty: [
    { id: 'kitty_reminder', label: 'Installment Reminder', text: "Hi {name}, this is a gentle reminder from OSSAM JEWELS that your monthly Pavitram Diamond Kitty installment is due soon. Let us know if you'd like to pay online or visit the store! ✨" },
    { id: 'kitty_welcome', label: 'Welcome to Kitty', text: "Welcome to the Pavitram Diamond Kitty, {name}! 💎 We are thrilled to have you. Your first installment is complete. Get ready for our upcoming monthly Housie events and lucky draws! 🎉" },
    { id: 'kitty_event', label: 'Housie Event Invite', text: "Hello {name}! 🌟 It's time for our monthly Pavitram Kitty Event! Join us this Sunday at the store for snacks, Housie, and the mega lucky draw. Can't wait to see you there! 🎁" },
    { id: 'blank', label: 'Blank Message', text: "Hi {name}, " }
  ]
}

export default function CRMPage() {
  const { appUser, loading } = useAuth()
  const { toast } = useToast()
  
  const { isHQ, isLocked, selectedLocation, setSelectedLocation } = useStoreLocation()
  
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [customers, setCustomers] = useState<CRMCustomer[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false) 
  const [searchTerm, setSearchTerm] = useState('')

  const [activeAiFilter, setActiveAiFilter] = useState<'none' | 'scheme' | 'cold' | 'birthday' | 'anniversary'>('none')

  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isAddKittyModalOpen, setIsAddKittyModalOpen] = useState(false)
  const [isWhatsAppModalOpen, setIsWhatsAppModalOpen] = useState(false)
  const [isFollowupModalOpen, setIsFollowupModalOpen] = useState(false)
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false)
  const [isLoyaltyModalOpen, setIsLoyaltyModalOpen] = useState(false)
  
  // --- IMPORT MODAL STATE ---
  const [isImportModalOpen, setIsImportModalOpen] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [isImporting, setIsImporting] = useState(false)
  
  // --- PREVIEW MODAL STATE (NEW) ---
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false)
  const [previewData, setPreviewData] = useState<any[]>([])

  const [selectedCustomer, setSelectedCustomer] = useState<CRMCustomer | null>(null)
  
  const [newCustForm, setNewCustForm] = useState({ 
    full_name: '', phone: '', city: '', customer_status: 'Lead', 
    birth_date: '', anniversary_date: '', next_followup_date: '', followup_reason: '' 
  })

  const [newKittyForm, setNewKittyForm] = useState({
    full_name: '', phone: '', city: '', monthly_amount: '5000', start_date: new Date().toISOString().split('T')[0]
  })

  const [loyaltyForm, setLoyaltyForm] = useState({
    type: 'points', 
    action: 'add',  
    amount: ''
  })

  const [waTemplateId, setWaTemplateId] = useState<string>('')
  const [customMessage, setCustomMessage] = useState('')
  const [followupDate, setFollowupDate] = useState('')
  const [followupReason, setFollowupReason] = useState('') 
  const [interactionNotes, setInteractionNotes] = useState('')

  useEffect(() => {
    const fetchWarehouses = async () => {
      if (!appUser) return
      try {
        const { data: whData, error } = await supabase
          .from('warehouses')
          .select('*')
          .eq('company_id', appUser.company_id)
          .eq('is_active', true)
          .order('name')

        if (error) throw error;
        if (whData && whData.length > 0) setWarehouses(whData)
      } catch (err) {
        toast({ title: 'Error loading warehouses', variant: 'destructive' })
      }
    }
    fetchWarehouses()
  }, [appUser, toast])

  const fetchCRMData = async () => {
    if (!appUser || !selectedLocation) return
    setIsLoading(true)
    try {
      let query = supabase
        .from('customers')
        .select('*')
        .eq('company_id', appUser.company_id)
        .order('next_followup_date', { ascending: true, nullsFirst: false }) 

      if (selectedLocation !== 'ALL') {
        query = query.eq('warehouse_id', selectedLocation)
      }

      const { data, error } = await query

      if (error) throw error
      setCustomers(data || [])
    } catch (err) {
      toast({ title: 'Error fetching customers', variant: 'destructive' })
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => { fetchCRMData() }, [appUser, selectedLocation])

  // --- CSV IMPORT LOGIC WITH PREVIEW ---
  const handleDownloadSample = () => {
    const csvContent = "full_name,phone,city,customer_status,birth_date,anniversary_date,pavitram_points,store_credit_balance,kitty_plan_status,kitty_months_paid,kitty_installment_amount\nJohn Doe,9876543210,Mumbai,Lead,1990-01-01,2015-05-15,0,0,,,\nJane Smith,9123456789,Delhi,Purchased,1985-08-20,,500,1200,,,\nRahul Sharma,9988776655,Pune,Kitty Member,,,,0,0,Active,3,5000";
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
    if (!importFile) return alert("Please select a file first.");
    setIsImporting(true);

    Papa.parse(importFile, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        try {
          const rows = results.data as any[];
          
          // Map to a strict temporary state for the preview editor
          const mappedData = rows
            .filter(row => row.full_name && row.phone) // Only take rows with at least name & phone
            .map((row, index) => ({
               _id: index, // Temp React Key
               full_name: row.full_name?.trim() || '',
               phone: row.phone?.trim().replace(/\D/g, '') || '',
               city: row.city?.trim() || '',
               customer_status: row.customer_status?.trim() || 'Lead',
               birth_date: row.birth_date?.trim() || '',
               anniversary_date: row.anniversary_date?.trim() || '',
               pavitram_points: row.pavitram_points?.trim() || '0',
               store_credit_balance: row.store_credit_balance?.trim() || '0',
               kitty_plan_status: row.kitty_plan_status?.trim() || '',
               kitty_months_paid: row.kitty_months_paid?.trim() || '0',
               kitty_installment_amount: row.kitty_installment_amount?.trim() || '0'
            }));

          if (mappedData.length === 0) {
            throw new Error("No valid rows found. Ensure 'full_name' and 'phone' columns exist and are populated.");
          }

          setPreviewData(mappedData);
          setIsImportModalOpen(false);
          setIsPreviewModalOpen(true); // Open the staging grid

        } catch (err: any) {
          alert(`Parsing failed: ${err.message}`);
        } finally {
          setIsImporting(false);
        }
      },
      error: (err) => {
        alert(`Failed to read file: ${err.message}`);
        setIsImporting(false);
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
    if (previewData.length === 0) return alert("No data to import.");

    setIsSubmitting(true);
    try {
      const validPayloads = previewData
        .filter(row => row.full_name && row.phone) 
        .map(row => {
          // If they have a kitty status, make sure the plan name defaults properly
          const isKittyActive = row.kitty_plan_status === 'Active' || row.customer_status === 'Kitty Member';
          
          return {
             company_id: appUser.company_id,
             warehouse_id: selectedLocation === 'ALL' ? null : selectedLocation,
             full_name: row.full_name,
             phone: row.phone,
             city: row.city || null,
             customer_status: row.customer_status || 'Lead',
             birth_date: row.birth_date || null,
             anniversary_date: row.anniversary_date || null,
             pavitram_points: Number(row.pavitram_points) || 0,
             store_credit_balance: Number(row.store_credit_balance) || 0,
             kitty_plan_status: row.kitty_plan_status || null,
             kitty_months_paid: Number(row.kitty_months_paid) || 0,
             kitty_installment_amount: Number(row.kitty_installment_amount) || 0,
             kitty_plan_name: isKittyActive ? 'Pavitram Diamond Kitty' : null,
          };
        });

      if (validPayloads.length === 0) throw new Error("No valid rows left to import.");

      // Supabase Bulk Upsert
      const { error } = await supabase
        .from('customers')
        .upsert(validPayloads, { onConflict: 'company_id, phone' });

      if (error) throw error;

      toast({ title: `Successfully imported ${validPayloads.length} customers!` });
      setIsPreviewModalOpen(false);
      setImportFile(null);
      setPreviewData([]);
      fetchCRMData();

    } catch (err: any) {
      alert(`Database Import Failed: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };


  // --- STANDARD ACTIONS ---
  const handleAddCustomer = async () => {
    if (!newCustForm.full_name || !newCustForm.phone) {
      alert('Missing Info: Name and Phone are required.');
      return;
    }
    
    setIsSubmitting(true)
    try {
      const cleanPhone = newCustForm.phone.trim();
      const payload = {
        company_id: appUser?.company_id,
        warehouse_id: selectedLocation === 'ALL' ? null : selectedLocation, 
        full_name: newCustForm.full_name.trim(),
        phone: cleanPhone,
        city: newCustForm.city?.trim() || null,
        customer_status: newCustForm.customer_status,
        birth_date: newCustForm.birth_date || null,
        anniversary_date: newCustForm.anniversary_date || null,
        next_followup_date: newCustForm.next_followup_date || null,
        followup_reason: newCustForm.followup_reason || null
      };

      const { data: existing } = await supabase
        .from('customers')
        .select('id')
        .eq('company_id', appUser?.company_id)
        .eq('phone', cleanPhone)
        .limit(1)
        .maybeSingle();

      let error;
      if (existing) {
        const res = await supabase.from('customers').update(payload).eq('id', existing.id);
        error = res.error;
      } else {
        const res = await supabase.from('customers').insert([payload]);
        error = res.error;
      }

      if (error) throw error
      toast({ title: existing ? 'Lead Updated Successfully!' : 'Lead Added Successfully!' })
      setIsAddModalOpen(false)
      setNewCustForm({ full_name: '', phone: '', city: '', customer_status: 'Lead', birth_date: '', anniversary_date: '', next_followup_date: '', followup_reason: '' })
      await fetchCRMData()
    } catch (err: any) {
      alert(`Error Saving: ${err.message}`);
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleAddKittyMember = async () => {
    if (!selectedLocation || selectedLocation === 'ALL') {
      return toast({ title: 'Branch Required', description: 'Please select a specific store branch from the top menu first.', variant: 'destructive' })
    }
    if (!newKittyForm.full_name || !newKittyForm.phone) {
      alert('Missing Info: Name and Phone are required.');
      return;
    }
    
    setIsSubmitting(true)
    try {
      const sd = newKittyForm.start_date ? new Date(newKittyForm.start_date) : new Date();
      if (isNaN(sd.getTime())) throw new Error("Invalid start date provided.");

      const nextInstallment = new Date(sd);
      nextInstallment.setMonth(nextInstallment.getMonth() + 1);
      const cleanPhone = newKittyForm.phone.trim();

      const payload = {
        company_id: appUser?.company_id,
        warehouse_id: selectedLocation === 'ALL' ? null : selectedLocation, 
        full_name: newKittyForm.full_name.trim(),
        phone: cleanPhone,
        city: newKittyForm.city?.trim() || null,
        customer_status: 'Kitty Member',
        kitty_plan_name: `Pavitram Diamond Kitty`,
        kitty_plan_status: 'Active',
        kitty_installment_amount: Number(newKittyForm.monthly_amount) || 5000,
        kitty_months_paid: 0,
        kitty_payment_ledger: [], 
        next_followup_date: nextInstallment.toISOString().split('T')[0],
        followup_reason: `Installment due (₹${newKittyForm.monthly_amount})`,
        last_interaction: `Joined Diamond Kitty Scheme on ${sd.toLocaleDateString()}`
      };

      const { data: existing } = await supabase
        .from('customers')
        .select('id')
        .eq('company_id', appUser?.company_id)
        .eq('phone', cleanPhone)
        .limit(1)
        .maybeSingle();

      let error;
      if (existing) {
        const res = await supabase.from('customers').update(payload).eq('id', existing.id);
        error = res.error;
      } else {
        const res = await supabase.from('customers').insert([payload]);
        error = res.error;
      }

      if (error) throw error

      toast({ title: 'Enrollment Confirmed!', description: 'Customer added to Pavitram Diamond Kitty.' })
      
      setIsAddKittyModalOpen(false)
      setIsProfileModalOpen(false) 
      setNewKittyForm({ full_name: '', phone: '', city: '', monthly_amount: '5000', start_date: new Date().toISOString().split('T')[0] })
      
      await fetchCRMData()
    } catch (err: any) {
      alert(`Registration Failed: ${err.message}`);
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleUpdateFollowup = async () => {
    if (!selectedCustomer) return
    setIsSubmitting(true)
    try {
      const { error } = await supabase
        .from('customers')
        .update({ 
          next_followup_date: followupDate || null, 
          followup_reason: followupReason || null,
          last_interaction: interactionNotes 
        })
        .eq('id', selectedCustomer.id)

      if (error) throw error
      toast({ title: 'Follow-up Scheduled!' })
      setIsFollowupModalOpen(false)
      await fetchCRMData()
    } catch (err: any) {
      alert('Error scheduling follow-up.');
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleUpdateLoyalty = async () => {
    if (!selectedCustomer) return;
    const amount = Number(loyaltyForm.amount) || 0;
    if (amount <= 0) return alert("Amount must be greater than 0");

    setIsSubmitting(true);
    try {
      let updatePayload: any = {};
      
      if (loyaltyForm.type === 'points') {
        const current = selectedCustomer.pavitram_points || 0;
        const newTotal = loyaltyForm.action === 'add' ? current + amount : Math.max(0, current - amount);
        updatePayload = { pavitram_points: newTotal };
      } else {
        const current = selectedCustomer.store_credit_balance || 0;
        const newTotal = loyaltyForm.action === 'add' ? current + amount : Math.max(0, current - amount);
        updatePayload = { store_credit_balance: newTotal };
      }

      const { data, error } = await supabase
        .from('customers')
        .update(updatePayload)
        .eq('id', selectedCustomer.id)
        .select()
        .single();

      if (error) throw error;

      toast({ title: 'Wallet Updated Successfully!' });
      setSelectedCustomer(data); 
      setIsLoyaltyModalOpen(false);
      setLoyaltyForm({ type: 'points', action: 'add', amount: '' });
      fetchCRMData(); 
    } catch (err: any) {
      alert(`Update Failed: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  }

  const handleRecordKittyPayment = async (customer: CRMCustomer) => {
    if (!appUser || !customer) return;
    
    const currentMonthsPaid = customer.kitty_months_paid || 0;
    if (currentMonthsPaid >= 12) return alert('Plan already matured!');

    const newMonthsPaid = currentMonthsPaid + 1;
    const amount = customer.kitty_installment_amount || 0;
    
    const receipt = {
      month: newMonthsPaid,
      amount: amount,
      paid_on: new Date().toISOString(),
      recorded_by: appUser.id
    };
    
    const updatedLedger = [...(customer.kitty_payment_ledger || []), receipt];
    
    const nextDue = new Date();
    nextDue.setMonth(nextDue.getMonth() + 1);

    const newStatus = newMonthsPaid >= 12 ? 'Matured' : 'Active';

    try {
      const { data, error } = await supabase
        .from('customers')
        .update({
          kitty_months_paid: newMonthsPaid,
          kitty_payment_ledger: updatedLedger,
          kitty_plan_status: newStatus,
          next_followup_date: newStatus === 'Matured' ? null : nextDue.toISOString().split('T')[0],
          followup_reason: newStatus === 'Matured' ? 'Plan Matured! Ready for purchase.' : `Installment ${newMonthsPaid + 1} due (₹${amount})`,
          last_interaction: `Paid Kitty Installment ${newMonthsPaid} (₹${amount})`
        })
        .eq('id', customer.id)
        .select()
        .single();

      if (error) throw error;
      
      toast({ title: `Month ${newMonthsPaid} Payment Recorded!` });
      setSelectedCustomer(data); 
      fetchCRMData(); 
    } catch (err: any) {
      alert(`Payment Failed: ${err.message}`);
    }
  }

  // --- WHATSAPP LOGIC ---
  const openWhatsAppModal = (customer: CRMCustomer, forcedTemplateId?: string) => {
    setSelectedCustomer(customer)
    let statusKey: 'Lead' | 'Purchased' | 'Kitty' = 'Lead'
    if (customer.customer_status === 'Purchased') statusKey = 'Purchased'
    if (customer.customer_status === 'Kitty Member' || customer.kitty_plan_name) statusKey = 'Kitty'
    
    let defaultTemplateId = forcedTemplateId || WA_TEMPLATES[statusKey][0].id
    if (!forcedTemplateId) {
      if (activeAiFilter === 'scheme' && statusKey === 'Purchased') defaultTemplateId = 'scheme_upsell'
      if (activeAiFilter === 'scheme' && statusKey === 'Lead') defaultTemplateId = 'kitty_invite'
      if (activeAiFilter === 'cold' && statusKey === 'Lead') defaultTemplateId = 'cold_lead'
    }

    const tpl = WA_TEMPLATES[statusKey].find(t => t.id === defaultTemplateId) || WA_TEMPLATES[statusKey][0]
    
    setWaTemplateId(tpl.id)
    setCustomMessage(tpl.text.replace('{name}', customer.full_name.split(' ')[0]))
    setIsWhatsAppModalOpen(true)
  }

  const handleTemplateChange = (templateId: string) => {
    setWaTemplateId(templateId)
    let statusKey: 'Lead' | 'Purchased' | 'Kitty' = 'Lead'
    if (selectedCustomer?.customer_status === 'Purchased') statusKey = 'Purchased'
    if (selectedCustomer?.customer_status === 'Kitty Member' || selectedCustomer?.kitty_plan_name) statusKey = 'Kitty'

    const tpl = WA_TEMPLATES[statusKey].find(t => t.id === templateId)
    if (tpl && selectedCustomer) {
      setCustomMessage(tpl.text.replace('{name}', selectedCustomer.full_name.split(' ')[0]))
    }
  }

  const handleSendWhatsApp = () => {
    if (!selectedCustomer) return
    let phone = selectedCustomer.phone.replace(/\D/g, '')
    if (phone.length === 10) phone = '91' + phone 
    const encodedMessage = encodeURIComponent(customMessage)
    window.open(`https://wa.me/${phone}?text=${encodedMessage}`, '_blank')
    setIsWhatsAppModalOpen(false)
    
    let statusKey: 'Lead' | 'Purchased' | 'Kitty' = 'Lead'
    if (selectedCustomer.customer_status === 'Purchased') statusKey = 'Purchased'
    if (selectedCustomer.customer_status === 'Kitty Member' || selectedCustomer.kitty_plan_name) statusKey = 'Kitty'

    setInteractionNotes(`Sent WhatsApp: ${WA_TEMPLATES[statusKey].find(t=>t.id===waTemplateId)?.label}`)
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

  // --- MATH & INSIGHTS ---
  const { filteredLeads, filteredPurchased, filteredKitty, insights, reminders } = useMemo(() => {
    const today = new Date(); today.setHours(0,0,0,0);
    const thirtyDaysAgo = new Date(today); thirtyDaysAgo.setDate(today.getDate() - 30)
    const fourteenDaysAgo = new Date(today); fourteenDaysAgo.setDate(today.getDate() - 14)

    let baseLeads = customers.filter(c => c.customer_status === 'Lead' || c.customer_status == null)
    let basePurchased = customers.filter(c => c.customer_status === 'Purchased')
    
    // Robust Kitty Check
    let baseKitty = customers.filter(c => 
      c.customer_status === 'Kitty Member' || 
      c.kitty_plan_status === 'Active' || 
      (c.kitty_plan_name && c.kitty_plan_name.includes('Kitty'))
    )

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

  const isEnrolledInKitty = selectedCustomer?.kitty_plan_status === 'Active' || 
                            selectedCustomer?.customer_status === 'Kitty Member' || 
                            !!selectedCustomer?.kitty_plan_name;

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
            {/* --- NEW: BULK IMPORT BUTTON --- */}
            <Button onClick={() => setIsImportModalOpen(true)} className="flex-1 md:flex-none bg-emerald-600 hover:bg-emerald-700 text-white h-10 px-4 text-xs font-bold shadow-sm rounded-lg border border-emerald-500 transition-none">
              <UploadCloud className="w-3.5 h-3.5 mr-1.5" /> Import
            </Button>

            <Button onClick={() => {
              setNewKittyForm({ full_name: '', phone: '', city: '', monthly_amount: '5000', start_date: new Date().toISOString().split('T')[0] })
              setIsAddKittyModalOpen(true)
            }} className="flex-1 md:flex-none bg-purple-600 hover:bg-purple-700 text-white h-10 px-4 text-xs font-bold shadow-sm rounded-lg border border-purple-500 transition-none">
              <Gem className="w-3.5 h-3.5 mr-1.5" /> Start Kitty Plan
            </Button>
            
            <Button onClick={() => {
              setNewCustForm({ full_name: '', phone: '', city: '', customer_status: 'Lead', birth_date: '', anniversary_date: '', next_followup_date: '', followup_reason: '' })
              setIsAddModalOpen(true)
            }} className="flex-1 md:flex-none bg-slate-900 hover:bg-slate-800 text-white h-10 px-4 text-xs font-bold shadow-sm rounded-lg transition-none">
              <UserPlus className="w-3.5 h-3.5 mr-1.5" /> Add Customer
            </Button>
          </div>
        </div>

        {/* 3. METRICS DASHBOARD */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 shrink-0">
          <Card className="border-slate-200 shadow-sm rounded-xl">
            <CardContent className="p-4 flex justify-between items-center">
              <div>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Total Database</p>
                <div className="text-2xl font-extrabold tracking-tight text-slate-900 leading-none">{customers.length}</div>
              </div>
              <div className="h-10 w-10 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center"><Users className="h-5 w-5 text-slate-400" /></div>
            </CardContent>
          </Card>

          <Card className="border-orange-200 shadow-sm bg-orange-50/30 rounded-xl">
            <CardContent className="p-4 flex justify-between items-center">
              <div>
                <p className="text-[10px] font-bold text-orange-600 uppercase tracking-widest mb-1.5">Action Board</p>
                <div className="flex gap-4">
                  <div className="flex flex-col">
                    <span className="text-xl font-extrabold text-orange-600 leading-none tracking-tight">{reminders.dueToday}</span>
                    <span className="text-[9px] font-bold text-orange-500 uppercase mt-0.5 tracking-wider">Due Today</span>
                  </div>
                  <div className="w-px bg-orange-200 h-8 my-auto"></div>
                  <div className="flex flex-col">
                    <span className="text-xl font-extrabold text-red-600 leading-none tracking-tight">{reminders.overdue}</span>
                    <span className="text-[9px] font-bold text-red-500 uppercase mt-0.5 tracking-wider">Overdue</span>
                  </div>
                </div>
              </div>
              <div className="h-10 w-10 rounded-full bg-orange-100/50 border border-orange-100 flex items-center justify-center"><AlertCircle className="h-5 w-5 text-orange-500" /></div>
            </CardContent>
          </Card>

          <Card className="border-purple-200 shadow-sm bg-purple-50/30 rounded-xl">
            <CardContent className="p-4 flex justify-between items-center">
              <div>
                <p className="text-[10px] font-bold text-purple-600 uppercase tracking-widest mb-1">Active Kitty Plans</p>
                <div className="text-2xl font-extrabold tracking-tight text-purple-700 leading-none">{filteredKitty.length}</div>
              </div>
              <div className="h-10 w-10 rounded-full bg-purple-100/50 border border-purple-100 flex items-center justify-center"><Gem className="h-5 w-5 text-purple-500" /></div>
            </CardContent>
          </Card>
        </div>

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
                 <CustomerListView 
                   data={filteredLeads} 
                   loading={isLoading} 
                   emptyMessage={activeAiFilter !== 'none' ? "No leads match this filter." : "No active leads found."}
                   onMessage={openWhatsAppModal}
                   onSchedule={openScheduleModal}
                   onViewProfile={openProfileModal}
                 />
              </TabsContent>

              <TabsContent value="purchased" className="h-full m-0 data-[state=active]:flex flex-col">
                 <CustomerListView 
                   data={filteredPurchased} 
                   loading={isLoading} 
                   emptyMessage={activeAiFilter !== 'none' ? "No buyers match this filter." : "No purchased customers found."}
                   onMessage={openWhatsAppModal}
                   onSchedule={openScheduleModal}
                   onViewProfile={openProfileModal}
                 />
              </TabsContent>

              <TabsContent value="kitty" className="h-full m-0 data-[state=active]:flex flex-col">
                 <CustomerListView 
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

      {/* --- MODALS --- */}

      {/* 0. IMPORT CSV MODAL (NEW) */}
      <Dialog open={isImportModalOpen} onOpenChange={setIsImportModalOpen}>
        <DialogContent className="sm:max-w-[450px] border-slate-200 rounded-xl bg-white shadow-2xl p-0 overflow-hidden">
          <DialogHeader className="bg-emerald-50 p-5 border-b border-emerald-100">
            <DialogTitle className="text-base font-bold flex items-center gap-2 text-emerald-800">
              <UploadCloud className="w-4 h-4" /> Bulk Import Customers
            </DialogTitle>
            <DialogDescription className="text-xs text-emerald-600/80 mt-1">
              Upload a `.csv` file to instantly populate your CRM database.
            </DialogDescription>
          </DialogHeader>

          <div className="p-6 space-y-6">
            <div className="bg-emerald-50/50 border border-emerald-100 p-4 rounded-lg flex flex-col sm:flex-row gap-3 items-center justify-between text-sm">
              <div className="flex flex-col">
                <span className="font-bold text-slate-700 text-xs">Need the exact format?</span>
                <span className="text-[10px] text-slate-500">Download the required template.</span>
              </div>
              <Button variant="outline" size="sm" onClick={handleDownloadSample} className="h-8 border-emerald-200 text-emerald-700 bg-white hover:bg-emerald-50 shrink-0">
                <Download className="w-3.5 h-3.5 mr-1.5" /> Sample CSV
              </Button>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Select File (.CSV)</label>
              <label className={`
                flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-xl cursor-pointer transition-colors
                ${importFile ? 'border-emerald-300 bg-emerald-50/50' : 'border-slate-300 hover:bg-slate-50 bg-white'}
              `}>
                <div className="flex flex-col items-center justify-center pt-5 pb-6 text-center px-4">
                  {isImporting ? (
                     <Loader2 className="w-8 h-8 text-emerald-500 animate-spin mb-2" />
                  ) : importFile ? (
                     <FileSpreadsheet className="w-8 h-8 text-emerald-500 mb-2" />
                  ) : (
                     <UploadCloud className="w-8 h-8 text-slate-400 mb-2" />
                  )}
                  <p className="text-sm font-semibold text-slate-700 truncate w-full">{importFile ? importFile.name : "Click or drag file here"}</p>
                </div>
                <input 
                  type="file" 
                  accept=".csv" 
                  className="hidden" 
                  onChange={(e) => setImportFile(e.target.files?.[0] || null)} 
                />
              </label>
            </div>

            <p className="text-[10px] text-slate-400 leading-relaxed">
              * The system uses Phone Numbers to prevent duplicates. Existing profiles will be securely updated if they share the same number.
            </p>
          </div>

          <DialogFooter className="bg-slate-50 p-4 border-t border-slate-100 flex-row gap-3">
            <Button variant="outline" className="flex-1 h-10 text-xs font-semibold rounded-lg border-slate-300 text-slate-700 bg-white hover:bg-slate-50" onClick={() => setIsImportModalOpen(false)}>Cancel</Button>
            <Button disabled={isImporting || !importFile} className="flex-[2] h-10 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm" onClick={handleParseFile}>
              {isImporting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Review Data'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 0.5 IMPORT PREVIEW MODAL (STAGING GRID) */}
      <Dialog open={isPreviewModalOpen} onOpenChange={setIsPreviewModalOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-[90vw] h-[90vh] flex flex-col border-slate-200 rounded-xl bg-slate-50 shadow-2xl p-0 overflow-hidden">
          <DialogHeader className="bg-emerald-50 p-5 border-b border-emerald-100 shrink-0">
            <div className="flex justify-between items-center">
              <div>
                <DialogTitle className="text-base font-bold flex items-center gap-2 text-emerald-800">
                  <Database className="w-5 h-5" /> Import Staging Area
                </DialogTitle>
                <DialogDescription className="text-xs text-emerald-600/80 mt-1">
                  Review and edit the {previewData.length} records parsed from your CSV before committing them to the database.
                </DialogDescription>
              </div>
              <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100 font-mono">
                {previewData.length} Valid Rows
              </Badge>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-auto bg-white custom-scrollbar p-2">
            <Table className="w-max min-w-full">
              <TableHeader className="bg-slate-50 sticky top-0 z-10 shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
                <TableRow>
                  <TableHead className="w-10"></TableHead>
                  <TableHead className="text-[10px] font-bold uppercase w-[150px]">Full Name</TableHead>
                  <TableHead className="text-[10px] font-bold uppercase w-[120px]">Phone</TableHead>
                  <TableHead className="text-[10px] font-bold uppercase w-[130px]">Status</TableHead>
                  <TableHead className="text-[10px] font-bold uppercase w-[120px]">City</TableHead>
                  <TableHead className="text-[10px] font-bold uppercase w-[100px]">Pts</TableHead>
                  <TableHead className="text-[10px] font-bold uppercase w-[100px]">Credit(₹)</TableHead>
                  <TableHead className="text-[10px] font-bold uppercase w-[120px] text-purple-600 bg-purple-50/50">Kitty Status</TableHead>
                  <TableHead className="text-[10px] font-bold uppercase w-[100px] text-purple-600 bg-purple-50/50">Mths Paid</TableHead>
                  <TableHead className="text-[10px] font-bold uppercase w-[100px] text-purple-600 bg-purple-50/50">Inst. (₹)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {previewData.map((row, index) => (
                  <TableRow key={row._id} className="group">
                    <TableCell className="p-1 text-center">
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-400 hover:text-red-500" onClick={() => removePreviewRow(index)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </TableCell>
                    <TableCell className="p-1">
                      <Input className="h-8 text-xs border-transparent hover:border-slate-200 focus-visible:ring-emerald-500 rounded px-2" value={row.full_name} onChange={(e) => updatePreviewRow(index, 'full_name', e.target.value)} />
                    </TableCell>
                    <TableCell className="p-1">
                      <Input className="h-8 text-xs font-mono border-transparent hover:border-slate-200 focus-visible:ring-emerald-500 rounded px-2" value={row.phone} onChange={(e) => updatePreviewRow(index, 'phone', e.target.value.replace(/\D/g, ''))} />
                    </TableCell>
                    <TableCell className="p-1">
                      <Select value={row.customer_status} onValueChange={(val) => updatePreviewRow(index, 'customer_status', val)}>
                        <SelectTrigger className="h-8 text-xs border-transparent hover:border-slate-200 bg-transparent focus:ring-emerald-500 shadow-none">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Lead" className="text-xs">Lead</SelectItem>
                          <SelectItem value="Purchased" className="text-xs">Purchased</SelectItem>
                          <SelectItem value="Kitty Member" className="text-xs text-purple-600 font-bold">Kitty Member</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="p-1">
                      <Input className="h-8 text-xs border-transparent hover:border-slate-200 focus-visible:ring-emerald-500 rounded px-2" value={row.city} onChange={(e) => updatePreviewRow(index, 'city', e.target.value)} />
                    </TableCell>
                    <TableCell className="p-1">
                      <Input type="number" className="h-8 text-xs font-mono border-transparent hover:border-slate-200 focus-visible:ring-amber-500 rounded px-2 text-amber-700 bg-amber-50/30" value={row.pavitram_points} onChange={(e) => updatePreviewRow(index, 'pavitram_points', e.target.value)} />
                    </TableCell>
                    <TableCell className="p-1">
                      <Input type="number" className="h-8 text-xs font-mono border-transparent hover:border-slate-200 focus-visible:ring-emerald-500 rounded px-2 text-emerald-700 bg-emerald-50/30" value={row.store_credit_balance} onChange={(e) => updatePreviewRow(index, 'store_credit_balance', e.target.value)} />
                    </TableCell>
                    
                    {/* Kitty Specific Columns */}
                    <TableCell className="p-1 bg-purple-50/30">
                      <Select value={row.kitty_plan_status} onValueChange={(val) => updatePreviewRow(index, 'kitty_plan_status', val)}>
                        <SelectTrigger className="h-8 text-xs border-transparent hover:border-purple-200 bg-transparent focus:ring-purple-500 shadow-none text-purple-700 font-semibold">
                          <SelectValue placeholder="None" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value=" " className="text-xs text-slate-400">None</SelectItem>
                          <SelectItem value="Active" className="text-xs text-purple-600 font-bold">Active</SelectItem>
                          <SelectItem value="Inactive" className="text-xs text-slate-500">Inactive</SelectItem>
                          <SelectItem value="Matured" className="text-xs text-emerald-600 font-bold">Matured</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="p-1 bg-purple-50/30">
                      <Input type="number" className="h-8 text-xs font-mono border-transparent hover:border-purple-200 focus-visible:ring-purple-500 rounded px-2 text-purple-700" value={row.kitty_months_paid} onChange={(e) => updatePreviewRow(index, 'kitty_months_paid', e.target.value)} />
                    </TableCell>
                    <TableCell className="p-1 bg-purple-50/30">
                      <Input type="number" className="h-8 text-xs font-mono border-transparent hover:border-purple-200 focus-visible:ring-purple-500 rounded px-2 text-purple-700" value={row.kitty_installment_amount} onChange={(e) => updatePreviewRow(index, 'kitty_installment_amount', e.target.value)} />
                    </TableCell>

                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <DialogFooter className="bg-emerald-50 p-4 border-t border-emerald-100 flex-row justify-between shrink-0">
            <Button variant="outline" className="h-10 text-xs font-semibold rounded-lg border-emerald-200 text-emerald-800 bg-white hover:bg-emerald-100" onClick={() => setIsPreviewModalOpen(false)}>Cancel & Discard</Button>
            <Button disabled={isSubmitting || previewData.length === 0} className="h-10 px-8 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm" onClick={handleCommitImport}>
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Database className="w-4 h-4 mr-2" />}
              Confirm & Import Database
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 1. CUSTOMER PROFILE MODAL */}
      <Dialog open={isProfileModalOpen} onOpenChange={setIsProfileModalOpen}>
        <DialogContent className="sm:max-w-[700px] border-slate-200 rounded-xl bg-slate-50 shadow-2xl p-0 overflow-hidden">
          {selectedCustomer && (
            <>
              <DialogHeader className="bg-white p-6 border-b border-slate-100">
                <div className="flex items-start justify-between">
                  <div>
                    <DialogTitle className="text-xl font-bold text-slate-900">{selectedCustomer.full_name}</DialogTitle>
                    <div className="flex items-center gap-3 mt-2 text-sm text-slate-500 font-mono">
                      <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5"/> {selectedCustomer.phone}</span>
                      <span className="text-slate-300">|</span>
                      <span className="font-sans">{selectedCustomer.city || 'Unknown City'}</span>
                    </div>
                  </div>
                  <Badge variant="outline" className={cn(
                    "uppercase tracking-widest text-[10px] font-bold px-2.5 py-1 rounded-md",
                    selectedCustomer.customer_status === 'Kitty Member' ? "bg-purple-50 text-purple-700 border-purple-200" :
                    selectedCustomer.customer_status === 'Purchased' ? "bg-emerald-50 text-emerald-700 border-emerald-200" : 
                    "bg-slate-100 text-slate-600 border-slate-200"
                  )}>
                    {selectedCustomer.customer_status || 'Lead'}
                  </Badge>
                </div>
              </DialogHeader>

              <div className="p-6 overflow-y-auto max-h-[70vh] custom-scrollbar space-y-6">
                
                {/* TOP ROW: Loyalty & Context Info */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Loyalty Card WITH EDIT BUTTON */}
                  <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-100 rounded-xl p-4 shadow-sm flex flex-col justify-center">
                    <div className="flex justify-between items-center mb-3">
                      <h3 className="text-[10px] font-bold text-amber-700 uppercase tracking-widest flex items-center gap-1.5">
                        <Star className="w-3.5 h-3.5" /> Loyalty & Wallet
                      </h3>
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        className="h-6 w-6 text-amber-600 hover:bg-amber-100 hover:text-amber-800 rounded shadow-sm bg-white/50 border border-amber-200/50" 
                        onClick={() => setIsLoyaltyModalOpen(true)}
                        title="Adjust Balance"
                      >
                        <Edit2 className="w-3 h-3" />
                      </Button>
                    </div>
                    
                    <div className="flex justify-between items-end">
                      <div>
                        <p className="text-xs text-amber-600/80 font-medium mb-0.5">Pavitram Points</p>
                        <p className="text-2xl font-black text-amber-600 leading-none">{selectedCustomer.pavitram_points || 0}</p>
                      </div>
                      <div className="w-px h-8 bg-amber-200 mx-4"></div>
                      <div>
                        <p className="text-xs text-emerald-600/80 font-medium mb-0.5">Store Credit</p>
                        <p className="text-2xl font-black text-emerald-600 leading-none">₹{(selectedCustomer.store_credit_balance || 0).toLocaleString()}</p>
                      </div>
                    </div>
                  </div>

                  {/* Context Card */}
                  <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col justify-center space-y-3">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-500 font-medium">Birth Date</span>
                      <span className="font-bold text-slate-800">{selectedCustomer.birth_date ? new Date(selectedCustomer.birth_date).toLocaleDateString() : 'Not Set'}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-500 font-medium">Anniversary</span>
                      <span className="font-bold text-slate-800">{selectedCustomer.anniversary_date ? new Date(selectedCustomer.anniversary_date).toLocaleDateString() : 'Not Set'}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm pt-2 border-t border-slate-100">
                      <span className="text-slate-500 font-medium">Customer Since</span>
                      <span className="font-bold text-slate-800">{new Date(selectedCustomer.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>

                {/* THE DIAMOND KITTY HARVESTING DASHBOARD */}
                <div className="bg-white border border-purple-100 rounded-xl shadow-sm overflow-hidden">
                  <div className="bg-purple-50 border-b border-purple-100 p-4 flex justify-between items-center">
                    <h3 className="text-xs font-bold text-purple-800 uppercase tracking-widest flex items-center gap-1.5">
                      <Gem className="w-4 h-4" /> Harvesting Plan (Diamond Kitty)
                    </h3>
                    <Badge variant="outline" className={cn(
                      "text-[9px] uppercase tracking-wider font-bold", 
                      (selectedCustomer.kitty_plan_status === 'Active' || selectedCustomer.customer_status === 'Kitty Member') ? 'bg-purple-100 text-purple-700 border-purple-200' : 'bg-slate-100 text-slate-500 border-slate-200'
                    )}>
                      {selectedCustomer.kitty_plan_status || (selectedCustomer.customer_status === 'Kitty Member' ? 'Active' : 'Inactive')}
                    </Badge>
                  </div>
                  
                  <div className="p-5 space-y-6">
                    {(selectedCustomer.kitty_plan_status === 'Active' || selectedCustomer.customer_status === 'Kitty Member') ? (
                      <>
                        {/* Progress Header */}
                        <div className="flex justify-between items-end">
                          <div>
                            <p className="text-sm font-bold text-slate-900">{selectedCustomer.kitty_plan_name || 'Pavitram Diamond Kitty'}</p>
                            <p className="text-xs text-slate-500 mt-0.5">12 Months Plan + 1 Month Jeweler Bonus</p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs font-bold text-purple-600 uppercase tracking-widest">Months Paid</p>
                            <p className="text-2xl font-black text-purple-700">{selectedCustomer.kitty_months_paid || 0} <span className="text-sm text-purple-400 font-medium">/ 12</span></p>
                          </div>
                        </div>

                        {/* Progress Bar (Visual) */}
                        <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                          <div 
                            className="bg-purple-500 h-full rounded-full transition-all duration-500" 
                            style={{ width: `${Math.min(((selectedCustomer.kitty_months_paid || 0) / 12) * 100, 100)}%` }}
                          />
                        </div>

                        {/* Visual 12-Month Grid Ledger */}
                        <div>
                          <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Installment Tracker</h4>
                          <div className="grid grid-cols-4 md:grid-cols-6 gap-2 sm:gap-3">
                            {Array.from({length: 12}).map((_, i) => {
                              const monthNum = i + 1;
                              const monthsPaid = selectedCustomer.kitty_months_paid || 0;
                              const isPaid = monthNum <= monthsPaid;
                              const isCurrent = monthNum === monthsPaid + 1;

                              return (
                                <div key={i} className={cn(
                                  "rounded-lg border p-2 flex flex-col items-center justify-center gap-1.5 transition-all relative overflow-hidden",
                                  isPaid ? "bg-emerald-50/50 border-emerald-200" :
                                  isCurrent ? "bg-blue-50 border-blue-300 shadow-sm ring-1 ring-blue-100" :
                                  "bg-slate-50 border-slate-100 opacity-60"
                                )}>
                                  <span className={cn("text-[9px] font-bold uppercase", isPaid ? "text-emerald-600" : isCurrent ? "text-blue-700" : "text-slate-400")}>
                                    Month {monthNum}
                                  </span>
                                  
                                  {isPaid ? (
                                    <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                                  ) : isCurrent ? (
                                    <Clock className="w-5 h-5 text-blue-500" />
                                  ) : (
                                    <Lock className="w-4 h-4 text-slate-300" />
                                  )}

                                  {isCurrent && (
                                    <div className="absolute inset-x-0 bottom-0 top-0 flex flex-col">
                                      <button 
                                        className="flex-1 bg-blue-600/90 text-white text-[9px] font-bold opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center"
                                        onClick={() => handleRecordKittyPayment(selectedCustomer)}
                                      >
                                        MARK PAID
                                      </button>
                                      <button 
                                        className="h-1/3 bg-green-500/90 text-white text-[8px] font-bold opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center gap-1"
                                        onClick={() => {
                                          setIsProfileModalOpen(false);
                                          setTimeout(() => openWhatsAppModal(selectedCustomer, 'kitty_reminder'), 300);
                                        }}
                                      >
                                        REMIND
                                      </button>
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        </div>

                        {/* Financial Math Breakdown */}
                        <div className="grid grid-cols-3 gap-4 p-4 bg-slate-50 rounded-lg border border-slate-100 mt-4">
                          <div className="space-y-1">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Paid</p>
                            <p className="text-sm font-bold text-slate-800">
                              ₹{((selectedCustomer.kitty_months_paid || 0) * (selectedCustomer.kitty_installment_amount || 0)).toLocaleString()}
                            </p>
                          </div>
                          <div className="space-y-1 border-l border-slate-200 pl-4">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                              <Gift className="w-3 h-3 text-emerald-500"/> Jeweler Bonus
                            </p>
                            <p className="text-sm font-bold text-emerald-600">
                              + ₹{(selectedCustomer.kitty_installment_amount || 0).toLocaleString()}
                            </p>
                          </div>
                          <div className="space-y-1 border-l border-slate-200 pl-4">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                              <Wallet className="w-3 h-3 text-purple-500"/> Est. Maturity
                            </p>
                            <p className="text-lg font-black text-purple-700 leading-none">
                              ₹{((12 * (selectedCustomer.kitty_installment_amount || 0)) + (selectedCustomer.kitty_installment_amount || 0)).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="text-center py-6">
                        <p className="text-sm font-medium text-slate-500">Customer is not currently enrolled in a Kitty Plan.</p>
                        <Button 
                          variant="outline" 
                          className="mt-4 border-purple-200 text-purple-700 hover:bg-purple-50 font-bold"
                          onClick={() => {
                            setIsProfileModalOpen(false);
                            setNewKittyForm({ 
                              ...newKittyForm, 
                              full_name: selectedCustomer.full_name || '', 
                              phone: selectedCustomer.phone || '', 
                              city: selectedCustomer.city || '' 
                            });
                            setTimeout(() => setIsAddKittyModalOpen(true), 300);
                          }}
                        >
                          <Gem className="w-4 h-4 mr-2" /> Start Kitty Plan Now
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* LOYALTY ADJUSTMENT MODAL */}
      <Dialog open={isLoyaltyModalOpen} onOpenChange={setIsLoyaltyModalOpen}>
        <DialogContent className="sm:max-w-[400px] border-amber-200 rounded-xl bg-white shadow-2xl p-0 overflow-hidden">
          <DialogHeader className="bg-gradient-to-r from-amber-50 to-orange-50 p-5 border-b border-amber-100">
            <DialogTitle className="text-base font-bold text-amber-800 flex items-center gap-2">
              <Star className="w-4 h-4" /> Adjust Wallet Balance
            </DialogTitle>
            <DialogDescription className="text-xs text-amber-600/80 mt-1">For <span className="font-bold text-amber-800">{selectedCustomer?.full_name}</span></DialogDescription>
          </DialogHeader>
          <div className="p-5 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Asset Type</label>
                <Select value={loyaltyForm.type} onValueChange={(val) => setLoyaltyForm({...loyaltyForm, type: val})}>
                  <SelectTrigger className="h-9 text-sm font-semibold bg-slate-50 border-slate-200 shadow-sm rounded-md">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-md border-slate-200 shadow-lg">
                    <SelectItem value="points">Pavitram Points</SelectItem>
                    <SelectItem value="credit">Store Credit (₹)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Action</label>
                <Select value={loyaltyForm.action} onValueChange={(val) => setLoyaltyForm({...loyaltyForm, action: val})}>
                  <SelectTrigger className="h-9 text-sm font-semibold bg-slate-50 border-slate-200 shadow-sm rounded-md">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-md border-slate-200 shadow-lg">
                    <SelectItem value="add" className="text-emerald-600 font-bold">Add Balance</SelectItem>
                    <SelectItem value="deduct" className="text-red-600 font-bold">Deduct Balance</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Amount to {loyaltyForm.action}</label>
              <div className="relative">
                {loyaltyForm.type === 'credit' && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₹</span>}
                {loyaltyForm.type === 'points' && <Star className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />}
                <Input 
                  type="number"
                  className={cn("h-10 text-lg font-black border-slate-200 focus-visible:ring-amber-500 rounded-lg shadow-sm bg-white", loyaltyForm.action === 'add' ? 'text-emerald-600' : 'text-red-600')} 
                  placeholder="0"
                  style={{ paddingLeft: '2rem' }}
                  value={loyaltyForm.amount} 
                  onChange={(e) => setLoyaltyForm({...loyaltyForm, amount: e.target.value})} 
                />
              </div>
            </div>
            
            {selectedCustomer && loyaltyForm.amount && (
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 flex justify-between items-center text-sm">
                <span className="text-slate-500">New Balance:</span>
                <span className="font-bold text-slate-900">
                  {loyaltyForm.type === 'credit' ? '₹' : ''}
                  {loyaltyForm.action === 'add' 
                    ? (Number(loyaltyForm.type === 'points' ? selectedCustomer.pavitram_points : selectedCustomer.store_credit_balance) || 0) + Number(loyaltyForm.amount) 
                    : Math.max(0, (Number(loyaltyForm.type === 'points' ? selectedCustomer.pavitram_points : selectedCustomer.store_credit_balance) || 0) - Number(loyaltyForm.amount))
                  }
                  {loyaltyForm.type === 'points' ? ' pts' : ''}
                </span>
              </div>
            )}
          </div>
          <DialogFooter className="bg-amber-50/50 p-4 border-t border-amber-100 flex-row gap-3">
            <Button variant="outline" className="flex-1 h-10 text-xs font-semibold rounded-lg border-amber-200 text-amber-800 bg-white hover:bg-amber-50" onClick={() => setIsLoyaltyModalOpen(false)}>Cancel</Button>
            <Button disabled={isSubmitting || !loyaltyForm.amount} className="flex-[2] h-10 text-xs font-bold rounded-lg bg-amber-600 hover:bg-amber-700 text-white shadow-sm" onClick={handleUpdateLoyalty}>
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirm Update'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ADD LEAD MODAL */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="sm:max-w-[500px] border-slate-200 rounded-xl bg-white shadow-2xl p-0 overflow-hidden">
          <DialogHeader className="bg-slate-50 p-5 border-b border-slate-100">
            <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-slate-500" /> Add New Customer
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500 mt-1">Branch Context: <span className="font-bold text-slate-700">{selectedLocation === 'ALL' ? 'GLOBAL HQ' : warehouses.find(w => w.id === selectedLocation)?.name}</span></DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 p-5 max-h-[60vh] overflow-y-auto custom-scrollbar">
            <div className="space-y-1.5 col-span-2">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Full Name *</label>
              <Input className="h-9 text-sm border-slate-200 focus-visible:ring-indigo-500 rounded-md shadow-sm" placeholder="E.g. Rahul Sharma" value={newCustForm.full_name} onChange={(e) => setNewCustForm({...newCustForm, full_name: e.target.value})} />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Phone *</label>
              <Input className="h-9 text-sm font-mono border-slate-200 focus-visible:ring-indigo-500 rounded-md shadow-sm" placeholder="10 digits" value={newCustForm.phone} onChange={(e) => setNewCustForm({...newCustForm, phone: e.target.value})} />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">City</label>
              <Input className="h-9 text-sm border-slate-200 focus-visible:ring-indigo-500 rounded-md shadow-sm" placeholder="Mumbai" value={newCustForm.city} onChange={(e) => setNewCustForm({...newCustForm, city: e.target.value})} />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">D.O.B (Optional)</label>
              <Input type="date" className="h-9 text-xs border-slate-200 focus-visible:ring-indigo-500 rounded-md shadow-sm bg-white" value={newCustForm.birth_date} onChange={(e) => setNewCustForm({...newCustForm, birth_date: e.target.value})} />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Anniversary (Optional)</label>
              <Input type="date" className="h-9 text-xs border-slate-200 focus-visible:ring-indigo-500 rounded-md shadow-sm bg-white" value={newCustForm.anniversary_date} onChange={(e) => setNewCustForm({...newCustForm, anniversary_date: e.target.value})} />
            </div>
            <div className="col-span-2 border-t border-slate-100 pt-4 mt-2">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 block">Initial Follow-up Strategy</label>
              <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-1.5">
                   <label className="text-[9px] font-bold text-slate-400 uppercase">Date to contact</label>
                   <Input type="date" className="h-9 text-xs border-slate-200 focus-visible:ring-indigo-500 rounded-md shadow-sm bg-white" value={newCustForm.next_followup_date} onChange={(e) => setNewCustForm({...newCustForm, next_followup_date: e.target.value})} />
                 </div>
                 <div className="space-y-1.5">
                   <label className="text-[9px] font-bold text-slate-400 uppercase">Reason / Goal</label>
                   <Input className="h-9 text-sm border-slate-200 focus-visible:ring-indigo-500 rounded-md shadow-sm" placeholder="E.g. Wants bridal sets" value={newCustForm.followup_reason} onChange={(e) => setNewCustForm({...newCustForm, followup_reason: e.target.value})} />
                 </div>
              </div>
            </div>
          </div>
          <DialogFooter className="bg-slate-50 p-4 border-t border-slate-100 flex-row gap-3">
            <Button variant="outline" className="flex-1 h-10 text-xs font-semibold rounded-lg border-slate-300 text-slate-700 bg-white hover:bg-slate-50" onClick={() => setIsAddModalOpen(false)}>Cancel</Button>
            <Button disabled={isSubmitting} className="flex-[2] h-10 text-xs font-bold rounded-lg bg-slate-900 hover:bg-slate-800 text-white shadow-sm" onClick={handleAddCustomer}>
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Profile'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 3. KITTY REGISTRATION MODAL */}
      <Dialog open={isAddKittyModalOpen} onOpenChange={setIsAddKittyModalOpen}>
        <DialogContent className="sm:max-w-[500px] border-slate-200 rounded-xl bg-white shadow-2xl p-0 overflow-hidden">
          <DialogHeader className="bg-purple-50 p-5 border-b border-purple-100">
            <DialogTitle className="text-base font-bold flex items-center gap-2 text-purple-700">
              <Gem className="w-4 h-4" /> Start Diamond Kitty Plan
            </DialogTitle>
            <DialogDescription className="text-xs text-purple-600/70 mt-1">Enroll a new member into the 12-month Pavitram scheme.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 p-5 max-h-[60vh] overflow-y-auto custom-scrollbar">
            <div className="space-y-1.5 col-span-2">
              <label className="text-[10px] font-bold text-purple-800 uppercase tracking-widest">Full Name *</label>
              <Input className="h-9 text-sm border-purple-200 focus-visible:ring-purple-500 rounded-md shadow-sm" placeholder="Member Name" value={newKittyForm.full_name} onChange={(e) => setNewKittyForm({...newKittyForm, full_name: e.target.value})} />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-purple-800 uppercase tracking-widest">Phone *</label>
              <Input className="h-9 text-sm font-mono border-purple-200 focus-visible:ring-purple-500 rounded-md shadow-sm" placeholder="10 digits" value={newKittyForm.phone} onChange={(e) => setNewKittyForm({...newKittyForm, phone: e.target.value})} />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-purple-800 uppercase tracking-widest">City</label>
              <Input className="h-9 text-sm border-purple-200 focus-visible:ring-purple-500 rounded-md shadow-sm" placeholder="Mumbai" value={newKittyForm.city} onChange={(e) => setNewKittyForm({...newKittyForm, city: e.target.value})} />
            </div>
            <div className="col-span-2 bg-purple-50/50 p-4 rounded-xl border border-purple-100 mt-2 space-y-4">
               <label className="text-[10px] font-black text-purple-900 uppercase block tracking-widest flex items-center gap-2">
                 <Database className="w-3 h-3 text-purple-500" /> Scheme Parameters
               </label>
               <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-1.5">
                   <label className="text-[9px] font-bold text-purple-700 uppercase tracking-wider">Monthly Amount (₹)</label>
                   <Select value={newKittyForm.monthly_amount} onValueChange={(val) => setNewKittyForm({...newKittyForm, monthly_amount: val})}>
                      <SelectTrigger className="h-9 bg-white border-purple-200 font-semibold text-xs rounded-md shadow-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-md border-purple-100 shadow-lg">
                        <SelectItem value="2000" className="text-xs">₹ 2,000 / month</SelectItem>
                        <SelectItem value="3000" className="text-xs">₹ 3,000 / month</SelectItem>
                        <SelectItem value="5000" className="text-xs font-bold text-purple-700">₹ 5,000 / month</SelectItem>
                        <SelectItem value="10000" className="text-xs">₹ 10,000 / month</SelectItem>
                      </SelectContent>
                   </Select>
                 </div>
                 <div className="space-y-1.5">
                   <label className="text-[9px] font-bold text-purple-700 uppercase tracking-wider">Enrollment Date</label>
                   <Input type="date" className="h-9 text-xs bg-white border-purple-200 rounded-md shadow-sm" value={newKittyForm.start_date} onChange={(e) => setNewKittyForm({...newKittyForm, start_date: e.target.value})} />
                 </div>
               </div>
               <p className="text-[10px] text-purple-600/80 font-medium leading-relaxed bg-white p-2 rounded border border-purple-100">
                 Saving this will automatically schedule their first installment reminder 1 month from the Enrollment Date.
               </p>
            </div>
          </div>
          <DialogFooter className="bg-purple-50 p-4 border-t border-purple-100 flex-row gap-3">
            <Button variant="outline" className="flex-1 h-10 text-xs font-semibold rounded-lg border-purple-200 text-purple-700 bg-white hover:bg-purple-50" onClick={() => setIsAddKittyModalOpen(false)}>Cancel</Button>
            <Button disabled={isSubmitting} className="flex-[2] h-10 text-xs font-bold rounded-lg bg-purple-600 hover:bg-purple-700 text-white shadow-sm" onClick={handleAddKittyMember}>
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirm Enrollment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 4. SCHEDULE MODAL */}
      <Dialog open={isFollowupModalOpen} onOpenChange={setIsFollowupModalOpen}>
        <DialogContent className="sm:max-w-[400px] border-slate-200 rounded-xl bg-white shadow-2xl p-0 overflow-hidden">
          <DialogHeader className="bg-slate-50 p-5 border-b border-slate-100">
            <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-indigo-500" /> Schedule Follow-up
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500 mt-1">For <span className="font-bold text-slate-700">{selectedCustomer?.full_name}</span></DialogDescription>
          </DialogHeader>
          <div className="space-y-4 p-5">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">1. Goal / Reason</label>
              <Input 
                className="h-9 text-sm border-slate-200 rounded-md shadow-sm focus-visible:ring-indigo-500" 
                placeholder="E.g. Wants to buy a bridal set" 
                value={followupReason} onChange={(e) => setFollowupReason(e.target.value)} 
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">2. Next Action Date</label>
              <Input type="date" className="h-9 text-sm border-slate-200 rounded-md shadow-sm focus-visible:ring-indigo-500 bg-white" value={followupDate} onChange={(e) => setFollowupDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">3. Notes (Optional)</label>
              <textarea 
                className="w-full min-h-[80px] p-3 text-sm border border-slate-200 rounded-md focus:ring-1 focus:ring-indigo-500 outline-none resize-none shadow-sm"
                placeholder="Any previous context..." 
                value={interactionNotes} onChange={(e) => setInteractionNotes(e.target.value)} 
              />
            </div>
          </div>
          <DialogFooter className="bg-slate-50 p-4 border-t border-slate-100 flex-row gap-3">
            <Button variant="outline" className="flex-1 h-10 text-xs font-semibold rounded-lg border-slate-300 text-slate-700 bg-white hover:bg-slate-50" onClick={() => setIsFollowupModalOpen(false)}>Cancel</Button>
            <Button disabled={isSubmitting} className="flex-[2] h-10 text-xs font-bold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm" onClick={handleUpdateFollowup}>
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Schedule'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 5. WHATSAPP MODAL */}
      <Dialog open={isWhatsAppModalOpen} onOpenChange={setIsWhatsAppModalOpen}>
        <DialogContent className="sm:max-w-[500px] border-slate-200 rounded-xl bg-white shadow-2xl p-0 overflow-hidden">
          <DialogHeader className="bg-[#25D366]/5 p-5 border-b border-[#25D366]/20">
            <DialogTitle className="text-base font-bold flex items-center gap-2 text-[#1DA851]">
              <MessageCircle className="w-4 h-4" /> Campaign Message
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500 mt-1">To: <span className="font-bold text-slate-700">{selectedCustomer?.full_name}</span> ({selectedCustomer?.phone})</DialogDescription>
          </DialogHeader>
          
          <div className="space-y-5 p-5">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center justify-between">
                <span>1. Select Template</span>
                {activeAiFilter !== 'none' && <Badge className="text-[9px] font-bold h-5 bg-indigo-50 text-indigo-600 border-indigo-200 uppercase tracking-wider rounded-md">Auto-Selected</Badge>}
              </label>
              <Select value={waTemplateId} onValueChange={handleTemplateChange}>
                <SelectTrigger className="h-10 text-sm font-semibold bg-white border-slate-200 shadow-sm rounded-lg">
                  <SelectValue placeholder="Choose a template" />
                </SelectTrigger>
                <SelectContent className="rounded-lg border-slate-200 shadow-lg">
                  {selectedCustomer && WA_TEMPLATES[selectedCustomer.customer_status === 'Kitty Member' ? 'Kitty' : selectedCustomer.customer_status === 'Purchased' ? 'Purchased' : 'Lead'].map(t => (
                    <SelectItem key={t.id} value={t.id} className="text-xs font-medium py-2">{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex justify-between items-end">
                <span>2. Customize Message</span>
                <span className="text-slate-400 font-semibold lowercase text-[10px]">Editable</span>
              </label>
              <div className="relative">
                <textarea 
                  className="w-full min-h-[160px] p-4 text-sm font-medium border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#25D366]/20 focus:border-[#25D366] outline-none shadow-inner resize-none leading-relaxed text-slate-800 bg-slate-50/50"
                  placeholder="Type your message here..."
                  value={customMessage}
                  onChange={(e) => setCustomMessage(e.target.value)}
                />
              </div>
            </div>
          </div>

          <DialogFooter className="bg-slate-50 p-4 border-t border-slate-100 flex-row gap-3">
            <Button variant="outline" className="flex-1 h-10 text-xs font-semibold rounded-lg border-slate-300 text-slate-700 bg-white hover:bg-slate-50" onClick={() => setIsWhatsAppModalOpen(false)}>Cancel</Button>
            <Button className="flex-[2] h-10 text-xs font-bold rounded-lg bg-[#25D366] hover:bg-[#1DA851] text-white shadow-sm" onClick={handleSendWhatsApp}>
              <MessageCircle className="w-4 h-4 mr-2" /> Send via WhatsApp
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// =========================================================================
// RESPONSIVE CUSTOMER LIST COMPONENT 
// =========================================================================
function CustomerListView({ data, loading, emptyMessage, onMessage, onSchedule, onViewProfile, isKitty = false }: any) {
  if (loading) {
    return (
      <div className="p-5 space-y-3">
        {[1,2,3,4].map(i => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-16 text-center">
        <div className="h-12 w-12 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center mb-3">
          <Users className="w-6 h-6 text-slate-300" />
        </div>
        <p className="text-sm font-semibold text-slate-500">{emptyMessage}</p>
      </div>
    )
  }

  const renderFollowup = (val: string | null, reason: string | null) => {
    if (!val) return <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Unscheduled</span>
    
    const today = new Date(); today.setHours(0,0,0,0);
    const fDate = new Date(val); fDate.setHours(0,0,0,0);
    
    let statusColor = 'text-blue-600 bg-blue-50 border-blue-200' 
    let icon = <Calendar className="w-3 h-3" />
    
    if (fDate.getTime() === today.getTime()) {
       statusColor = 'text-orange-700 bg-orange-50 border-orange-200' 
       icon = <AlertCircle className="w-3 h-3" />
    } else if (fDate.getTime() < today.getTime()) {
       statusColor = 'text-red-700 bg-red-50 border-red-200' 
       icon = <AlertCircle className="w-3 h-3" />
    }

    return (
      <div className="flex flex-col gap-1">
        <div className={cn("flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded-md border w-max", statusColor)}>
          {icon} {fDate.toLocaleDateString()}
        </div>
        {reason && <p className="text-[10px] font-medium text-slate-600 truncate max-w-[200px] mt-0.5">Goal: {reason}</p>}
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* --- DESKTOP VIEW --- */}
      <div className="hidden md:block overflow-x-auto flex-1 custom-scrollbar">
        <Table>
          <TableHeader className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
            <TableRow className="hover:bg-transparent border-none">
              <TableHead className="text-[10px] font-bold uppercase tracking-wider text-slate-500 h-10 px-6">Client Profile</TableHead>
              <TableHead className="text-[10px] font-bold uppercase tracking-wider text-slate-500 h-10">Follow-up Details</TableHead>
              <TableHead className="text-[10px] font-bold uppercase tracking-wider text-slate-500 h-10">Last Note</TableHead>
              <TableHead className="w-[240px] text-right px-6"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row: any) => (
              <TableRow key={row.id} className={cn("transition-colors border-b border-slate-100 hover:bg-slate-50/50", isKitty && "hover:bg-purple-50/50")}>
                <TableCell className="px-6 py-3">
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <button onClick={() => onViewProfile(row)} className="font-semibold text-indigo-600 hover:text-indigo-800 hover:underline text-sm leading-tight transition-colors text-left">
                        {row.full_name}
                      </button>
                      {/* --- FINANCIAL BADGES --- */}
                      {Number(row.store_credit_balance) > 0 && (
                        <Badge className="bg-emerald-50 text-emerald-600 border-emerald-200 text-[8px] h-4 px-1 uppercase tracking-widest flex items-center gap-0.5">
                          <IndianRupee className="w-2.5 h-2.5" /> Credit
                        </Badge>
                      )}
                      {Number(row.pavitram_points) > 0 && (
                        <Badge className="bg-amber-50 text-amber-600 border-amber-200 text-[8px] h-4 px-1 uppercase tracking-widest flex items-center gap-0.5">
                          <Star className="w-2.5 h-2.5" /> Points
                        </Badge>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono mt-0.5 flex items-center gap-1"><Phone className="w-2.5 h-2.5"/> {row.phone}</span>
                  </div>
                </TableCell>
                <TableCell className="py-3">
                  {renderFollowup(row.next_followup_date, row.followup_reason)}
                </TableCell>
                <TableCell className="py-3">
                  <span className="text-[11px] font-medium text-slate-500 truncate max-w-[200px] block" title={row.last_interaction || ''}>{row.last_interaction || '--'}</span>
                </TableCell>
                <TableCell className="text-right px-6 py-3">
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" size="icon" className="h-8 w-8 text-slate-500 border-slate-200 hover:bg-slate-100" onClick={() => onViewProfile(row)} title="View Profile">
                      <User className="w-4 h-4" />
                    </Button>
                    <Button variant="outline" size="sm" className="h-8 px-3 text-[10px] font-bold uppercase text-[#1DA851] border-slate-200 bg-white hover:bg-[#25D366]/10" onClick={() => onMessage(row)}>
                      <MessageCircle className="w-3.5 h-3.5 sm:mr-1.5" /> <span className="hidden sm:inline">Message</span>
                    </Button>
                    <Button variant="outline" size="sm" className="h-8 px-3 text-[10px] font-bold uppercase text-indigo-600 border-slate-200 bg-white hover:bg-indigo-50" onClick={() => onSchedule(row)}>
                      <Calendar className="w-3.5 h-3.5 sm:mr-1.5" /> <span className="hidden sm:inline">Schedule</span>
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* --- MOBILE VIEW --- */}
      <div className="md:hidden flex flex-col gap-3 p-3 bg-slate-50/50 flex-1 overflow-y-auto custom-scrollbar">
        {data.map((row: any) => (
          <div key={row.id} className={cn("bg-white border rounded-xl p-4 shadow-sm flex flex-col gap-3", isKitty ? "border-purple-100" : "border-slate-200")}>
            <div className="flex justify-between items-start">
              <div>
                <button onClick={() => onViewProfile(row)} className="font-bold text-indigo-600 hover:underline text-sm flex items-center gap-2 text-left">
                  {row.full_name}
                </button>
                <div className="flex gap-1 mt-1">
                  {Number(row.store_credit_balance) > 0 && (
                    <Badge className="bg-emerald-50 text-emerald-600 border-emerald-200 text-[8px] h-4 px-1 uppercase tracking-widest flex items-center gap-0.5">
                      <IndianRupee className="w-2.5 h-2.5" /> Credit
                    </Badge>
                  )}
                  {Number(row.pavitram_points) > 0 && (
                    <Badge className="bg-amber-50 text-amber-600 border-amber-200 text-[8px] h-4 px-1 uppercase tracking-widest flex items-center gap-0.5">
                      <Star className="w-2.5 h-2.5" /> Points
                    </Badge>
                  )}
                </div>
                <p className="text-[11px] font-mono text-slate-500 mt-1 flex items-center gap-1"><Phone className="w-3 h-3"/> {row.phone}</p>
              </div>
              <div className="flex gap-1.5">
                <Button size="icon" variant="outline" className="h-8 w-8 text-slate-500 border-slate-200 rounded-lg hover:bg-slate-100 shrink-0" onClick={() => onViewProfile(row)}>
                  <User className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="outline" className="h-8 w-8 text-[#1DA851] border-slate-200 rounded-lg hover:bg-[#25D366]/10 shrink-0" onClick={() => onMessage(row)}>
                  <MessageCircle className="h-4 w-4" />
                </Button>
              </div>
            </div>
            
            <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
              {renderFollowup(row.next_followup_date, row.followup_reason)}
            </div>

            <Button variant="outline" className="w-full h-9 text-xs font-bold text-indigo-600 border-slate-200 rounded-lg" onClick={() => onSchedule(row)}>
              <Calendar className="w-3.5 h-3.5 mr-2" /> Schedule Follow-up
            </Button>
          </div>
        ))}
      </div>
    </div>
  )
}