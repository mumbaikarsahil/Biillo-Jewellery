'use client'

import React, { useEffect, useState, useMemo } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
import { DataTable, Column } from '@/components/DataTable'
import { supabase } from '@/lib/supabaseClient'
import { useToast } from '@/hooks/use-toast'
import { 
  MessageCircle, Users, Calendar, Phone, 
  UserPlus, Search, Clock, CheckCircle2, Sparkles, FilterX, AlertCircle, Store, Gem
} from 'lucide-react'

interface CRMCustomer {
  id: string
  full_name: string
  phone: string
  city: string
  customer_status: string 
  next_followup_date: string | null
  followup_reason: string | null 
  last_interaction: string | null
  created_at: string
  birth_date?: string
  anniversary_date?: string
  warehouse_id?: string
}

interface Warehouse {
  id: string
  name: string
  type?: string
  warehouse_type?: string
}

// ✨ DYNAMIC AI-DRIVEN TEMPLATES (UPDATED WITH PAVITRAM KITTY)
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
    { id: 'blank', label: 'Blank Message', text: "Hi {name}, " }
  ],
  // New Kitty Member specific templates
  Kitty: [
    { id: 'kitty_welcome', label: 'Welcome to Kitty', text: "Welcome to the Pavitram Diamond Kitty, {name}! 💎 We are thrilled to have you. Your first installment is complete. Get ready for our upcoming monthly Housie events and lucky draws! 🎉" },
    { id: 'kitty_reminder', label: 'Installment Reminder', text: "Hi {name}, this is a gentle reminder from OSSAM JEWELS that your monthly Pavitram Diamond Kitty installment is due soon. Let us know if you'd like to pay online or visit the store! ✨" },
    { id: 'kitty_event', label: 'Housie Event Invite', text: "Hello {name}! 🌟 It's time for our monthly Pavitram Kitty Event! Join us this Sunday at the store for snacks, Housie, and the mega lucky draw. Can't wait to see you there! 🎁" },
    { id: 'blank', label: 'Blank Message', text: "Hi {name}, " }
  ]
}

export default function CRMPage() {
  const { appUser, loading } = useAuth()
  const { toast } = useToast()
  
  // Warehouse State
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('')

  const [customers, setCustomers] = useState<CRMCustomer[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')

  // ✨ AI Campaign State
  const [activeAiFilter, setActiveAiFilter] = useState<'none' | 'scheme' | 'cold' | 'birthday' | 'anniversary'>('none')

  // Modals State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isAddKittyModalOpen, setIsAddKittyModalOpen] = useState(false) // NEW KITTY MODAL
  const [isWhatsAppModalOpen, setIsWhatsAppModalOpen] = useState(false)
  const [isFollowupModalOpen, setIsFollowupModalOpen] = useState(false)
  
  const [selectedCustomer, setSelectedCustomer] = useState<CRMCustomer | null>(null)
  
  // Forms State
  const [newCustForm, setNewCustForm] = useState({ 
    full_name: '', phone: '', city: '', customer_status: 'Lead', 
    birth_date: '', anniversary_date: '', next_followup_date: '', followup_reason: '' 
  })

  // Kitty Specific Form State
  const [newKittyForm, setNewKittyForm] = useState({
    full_name: '', phone: '', city: '', monthly_amount: '5000', start_date: new Date().toISOString().split('T')[0]
  })

  const [waTemplateId, setWaTemplateId] = useState<string>('')
  const [customMessage, setCustomMessage] = useState('')
  const [followupDate, setFollowupDate] = useState('')
  const [followupReason, setFollowupReason] = useState('') 
  const [interactionNotes, setInteractionNotes] = useState('')

  // 1. Fetch Warehouses on Load 
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

        if (whData && whData.length > 0) {
          setWarehouses(whData)
          setSelectedWarehouseId(whData[0].id)
        }
      } catch (err) {
        console.error("Error fetching warehouses:", err)
        toast({ title: 'Error loading warehouses', variant: 'destructive' })
      }
    }
    fetchWarehouses()
  }, [appUser, toast])


  // 2. Fetch Customers based on Selected Warehouse
  useEffect(() => {
    if (!appUser || !selectedWarehouseId) return
    fetchCRMData()
  }, [appUser, selectedWarehouseId])

  const fetchCRMData = async () => {
    if (!appUser || !selectedWarehouseId) return
    setIsLoading(true)
    try {
      let query = supabase
        .from('customers')
        .select('*')
        .eq('company_id', appUser.company_id)
        .order('next_followup_date', { ascending: true, nullsFirst: false }) 

      const currentWarehouse = warehouses.find(w => w.id === selectedWarehouseId)
      const wType = currentWarehouse?.type || currentWarehouse?.warehouse_type || 'branch'
      
      if (wType !== 'main_safe') {
        query = query.eq('warehouse_id', selectedWarehouseId)
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

  // --- ACTIONS ---
  const handleAddCustomer = async () => {
    if (!newCustForm.full_name || !newCustForm.phone) return toast({ title: 'Name and Phone required', variant: 'destructive' })
    try {
      const { error } = await supabase.from('customers').insert([{
        company_id: appUser?.company_id,
        warehouse_id: selectedWarehouseId, 
        full_name: newCustForm.full_name,
        phone: newCustForm.phone,
        city: newCustForm.city,
        customer_status: newCustForm.customer_status,
        birth_date: newCustForm.birth_date || null,
        anniversary_date: newCustForm.anniversary_date || null,
        next_followup_date: newCustForm.next_followup_date || null,
        followup_reason: newCustForm.followup_reason || null
      }])
      if (error) throw error
      toast({ title: 'Lead Added Successfully!' })
      setIsAddModalOpen(false)
      setNewCustForm({ full_name: '', phone: '', city: '', customer_status: 'Lead', birth_date: '', anniversary_date: '', next_followup_date: '', followup_reason: '' })
      fetchCRMData()
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
    }
  }

  // NEW: HANDLE ADD KITTY MEMBER
  const handleAddKittyMember = async () => {
    if (!newKittyForm.full_name || !newKittyForm.phone) return toast({ title: 'Name and Phone required', variant: 'destructive' })
    try {
      // Calculate their next installment date (1 month from start)
      const nextInstallment = new Date(newKittyForm.start_date)
      nextInstallment.setMonth(nextInstallment.getMonth() + 1)

      const { error } = await supabase.from('customers').insert([{
        company_id: appUser?.company_id,
        warehouse_id: selectedWarehouseId, 
        full_name: newKittyForm.full_name,
        phone: newKittyForm.phone,
        city: newKittyForm.city,
        customer_status: 'Kitty Member', // Specific status for the scheme
        next_followup_date: nextInstallment.toISOString().split('T')[0],
        followup_reason: `Installment due (₹${newKittyForm.monthly_amount})`,
        last_interaction: `Joined Diamond Kitty Scheme on ${new Date(newKittyForm.start_date).toLocaleDateString()}`
      }])
      if (error) throw error
      toast({ title: 'Kitty Member Registered!' })
      setIsAddKittyModalOpen(false)
      setNewKittyForm({ full_name: '', phone: '', city: '', monthly_amount: '5000', start_date: new Date().toISOString().split('T')[0] })
      fetchCRMData()
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
    }
  }

  const handleUpdateFollowup = async () => {
    if (!selectedCustomer) return
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
      fetchCRMData()
    } catch (err: any) {
      toast({ title: 'Error updating', variant: 'destructive' })
    }
  }

  // --- WHATSAPP LOGIC ---
  const openWhatsAppModal = (customer: CRMCustomer) => {
    setSelectedCustomer(customer)
    
    let statusKey: 'Lead' | 'Purchased' | 'Kitty' = 'Lead'
    if (customer.customer_status === 'Purchased') statusKey = 'Purchased'
    if (customer.customer_status === 'Kitty Member') statusKey = 'Kitty'
    
    // Auto-Select Template based on AI Engine
    let defaultTemplateId = WA_TEMPLATES[statusKey][0].id
    if (activeAiFilter === 'scheme' && statusKey === 'Purchased') defaultTemplateId = 'scheme_upsell'
    if (activeAiFilter === 'scheme' && statusKey === 'Lead') defaultTemplateId = 'kitty_invite'
    if (activeAiFilter === 'cold' && statusKey === 'Lead') defaultTemplateId = 'cold_lead'
    if (activeAiFilter === 'birthday') defaultTemplateId = 'birthday'
    if (activeAiFilter === 'anniversary') defaultTemplateId = 'anniversary'

    const tpl = WA_TEMPLATES[statusKey].find(t => t.id === defaultTemplateId) || WA_TEMPLATES[statusKey][0]
    
    setWaTemplateId(tpl.id)
    setCustomMessage(tpl.text.replace('{name}', customer.full_name.split(' ')[0]))
    setIsWhatsAppModalOpen(true)
  }

  const handleTemplateChange = (templateId: string) => {
    setWaTemplateId(templateId)
    
    let statusKey: 'Lead' | 'Purchased' | 'Kitty' = 'Lead'
    if (selectedCustomer?.customer_status === 'Purchased') statusKey = 'Purchased'
    if (selectedCustomer?.customer_status === 'Kitty Member') statusKey = 'Kitty'

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
    
    // Determine status key for interaction log
    let statusKey: 'Lead' | 'Purchased' | 'Kitty' = 'Lead'
    if (selectedCustomer.customer_status === 'Purchased') statusKey = 'Purchased'
    if (selectedCustomer.customer_status === 'Kitty Member') statusKey = 'Kitty'

    setInteractionNotes(`Sent WhatsApp: ${WA_TEMPLATES[statusKey].find(t=>t.id===waTemplateId)?.label}`)
    setFollowupDate(selectedCustomer.next_followup_date || '')
    setFollowupReason(selectedCustomer.followup_reason || '')
    setTimeout(() => setIsFollowupModalOpen(true), 500)
  }

  // --- MATH & INSIGHTS ---
  const { filteredLeads, filteredPurchased, filteredKitty, insights, reminders } = useMemo(() => {
    const today = new Date()
    today.setHours(0,0,0,0)
    
    const thirtyDaysAgo = new Date(today); thirtyDaysAgo.setDate(today.getDate() - 30)
    const fourteenDaysAgo = new Date(today); fourteenDaysAgo.setDate(today.getDate() - 14)
    const currentMonth = today.getMonth()

    let baseLeads = customers.filter(c => c.customer_status === 'Lead' || c.customer_status == null)
    let basePurchased = customers.filter(c => c.customer_status === 'Purchased')
    let baseKitty = customers.filter(c => c.customer_status === 'Kitty Member')

    // Reminder Math (Look at all customers for due dates)
    let dueToday = 0;
    let overdue = 0;
    customers.forEach(l => {
      if (l.next_followup_date) {
        const d = new Date(l.next_followup_date)
        d.setHours(0,0,0,0)
        if (d.getTime() === today.getTime()) dueToday++
        else if (d.getTime() < today.getTime()) overdue++
      }
    })

    // Generate Insights Counts
    const schemeEligible = basePurchased.filter(c => new Date(c.created_at) < thirtyDaysAgo)
    const coldLeads = baseLeads.filter(c => new Date(c.created_at) < fourteenDaysAgo)
    const birthdayClients = customers.filter(c => c.birth_date && new Date(c.birth_date).getMonth() === currentMonth)
    const anniversaryClients = customers.filter(c => c.anniversary_date && new Date(c.anniversary_date).getMonth() === currentMonth)

    // Apply Active Filter
    if (activeAiFilter === 'scheme') {
      basePurchased = schemeEligible
    }
    if (activeAiFilter === 'cold') baseLeads = coldLeads
    if (activeAiFilter === 'birthday') {
      baseLeads = baseLeads.filter(c => c.birth_date && new Date(c.birth_date).getMonth() === currentMonth)
      basePurchased = basePurchased.filter(c => c.birth_date && new Date(c.birth_date).getMonth() === currentMonth)
      baseKitty = baseKitty.filter(c => c.birth_date && new Date(c.birth_date).getMonth() === currentMonth)
    }
    if (activeAiFilter === 'anniversary') {
      baseLeads = baseLeads.filter(c => c.anniversary_date && new Date(c.anniversary_date).getMonth() === currentMonth)
      basePurchased = basePurchased.filter(c => c.anniversary_date && new Date(c.anniversary_date).getMonth() === currentMonth)
      baseKitty = baseKitty.filter(c => c.anniversary_date && new Date(c.anniversary_date).getMonth() === currentMonth)
    }

    // Apply Manual Search
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
      insights: { scheme: schemeEligible.length + baseLeads.length, cold: coldLeads.length, birthday: birthdayClients.length, anniversary: anniversaryClients.length },
      reminders: { dueToday, overdue }
    }
  }, [customers, activeAiFilter, searchTerm])


  // --- TABLE COLUMNS ---
  const columns: Column<CRMCustomer>[] = [
    { 
      key: 'full_name', 
      label: 'Client Profile',
      render: (val, row) => (
        <div className="py-1">
          <p className="font-bold text-slate-900 text-sm leading-tight">{row.full_name}</p>
          <p className="text-[10px] text-slate-500 font-mono mt-0.5 flex items-center gap-1"><Phone className="w-2.5 h-2.5"/> {row.phone}</p>
        </div>
      )
    },
    { 
      key: 'next_followup_date', 
      label: 'Follow-up Details',
      render: (val, row) => {
        if (!val) return <span className="text-slate-300 text-[10px] uppercase font-bold">Unscheduled</span>
        
        const today = new Date(); today.setHours(0,0,0,0);
        const fDate = new Date(val); fDate.setHours(0,0,0,0);
        
        let statusColor = 'text-blue-600 bg-blue-50 border-blue-200' 
        let icon = <Calendar className="w-3 h-3" />
        
        if (fDate.getTime() === today.getTime()) {
           statusColor = 'text-orange-700 bg-orange-100 border-orange-300' 
           icon = <AlertCircle className="w-3 h-3" />
        } else if (fDate.getTime() < today.getTime()) {
           statusColor = 'text-red-700 bg-red-100 border-red-300' 
           icon = <AlertCircle className="w-3 h-3" />
        }

        return (
          <div className="flex flex-col gap-1">
            <div className={`flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded border w-max ${statusColor}`}>
              {icon} {fDate.toLocaleDateString()}
            </div>
            {row.followup_reason && (
              <p className="text-[10px] font-semibold text-slate-700 truncate max-w-[200px]">Goal: {row.followup_reason}</p>
            )}
          </div>
        )
      }
    },
    {
      key: 'last_interaction',
      label: 'Last Note',
      render: (val) => <span className="text-[11px] text-slate-500 truncate max-w-[200px] block" title={val || ''}>{val || '--'}</span>
    }
  ]

  if (loading || !appUser) return null

  return (
    <div className="flex flex-col h-[calc(100vh-2rem)] gap-3 p-3 overflow-hidden bg-slate-50 min-w-[1024px]">
      
      {/* HEADER WITH WAREHOUSE SELECTOR */}
      <div className="flex items-center justify-between bg-white p-3 rounded-lg border border-slate-200 shadow-sm shrink-0">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-black tracking-tight text-slate-900 flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" /> Client CRM
          </h1>
          <div className="h-5 w-px bg-slate-200" />
          
          {/* BRANCH SELECTOR */}
          <div className="flex items-center gap-2 bg-slate-50 p-1 rounded border border-slate-200">
            <div className="pl-2 pr-1 border-r border-slate-200">
               <Store className="w-3.5 h-3.5 text-slate-400" />
            </div>
            <Select value={selectedWarehouseId} onValueChange={setSelectedWarehouseId}>
              <SelectTrigger className="w-[180px] h-7 border-none bg-transparent focus:ring-0 shadow-none font-bold text-xs text-slate-700">
                <SelectValue placeholder={warehouses.length > 0 ? "Select Branch" : "Loading..."} />
              </SelectTrigger>
              <SelectContent>
                {warehouses.map(w => (
                  <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="relative w-[200px] ml-2">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input 
              placeholder="Search clients..." 
              className="pl-8 h-8 text-xs bg-slate-50 border-slate-200 focus-visible:ring-primary shadow-inner"
              value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
        <div className="flex gap-2">
          {/* NEW KITTY BUTTON */}
          <Button size="sm" onClick={() => setIsAddKittyModalOpen(true)} className="bg-purple-600 hover:bg-purple-700 text-white h-8 text-xs font-bold shadow-md border border-purple-500">
            <Gem className="w-3.5 h-3.5 mr-1.5" /> Register Kitty
          </Button>
          <Button size="sm" onClick={() => setIsAddModalOpen(true)} className="bg-slate-900 text-white h-8 text-xs font-bold shadow-md">
            <UserPlus className="w-3.5 h-3.5 mr-1.5" /> Add Lead
          </Button>
        </div>
      </div>

      {/* METRICS DASHBOARD */}
      <div className="grid grid-cols-3 gap-3 shrink-0">
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="p-3 flex justify-between items-center">
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-0.5">Total Clients</p>
              <div className="text-2xl font-black text-slate-900 leading-none">{customers.length}</div>
            </div>
            <div className="h-8 w-8 rounded-full bg-blue-50 flex items-center justify-center"><Users className="h-4 w-4 text-blue-600" /></div>
          </CardContent>
        </Card>

        <Card className="border-orange-200 shadow-sm bg-orange-50/50">
          <CardContent className="p-3 flex justify-between items-center">
            <div>
              <p className="text-[10px] font-bold text-orange-700 uppercase tracking-widest mb-1">Follow-ups Action Board</p>
              <div className="flex gap-4">
                <div className="flex flex-col">
                  <span className="text-lg font-black text-orange-600 leading-none">{reminders.dueToday}</span>
                  <span className="text-[9px] font-bold text-orange-600/70 uppercase">Due Today</span>
                </div>
                <div className="w-px bg-orange-200 h-6 my-auto"></div>
                <div className="flex flex-col">
                  <span className="text-lg font-black text-red-600 leading-none">{reminders.overdue}</span>
                  <span className="text-[9px] font-bold text-red-600/70 uppercase">Overdue</span>
                </div>
              </div>
            </div>
            <div className="h-8 w-8 rounded-full bg-orange-100 flex items-center justify-center"><AlertCircle className="h-4 w-4 text-orange-600" /></div>
          </CardContent>
        </Card>

        <Card className="border-purple-200 shadow-sm bg-purple-50/50">
          <CardContent className="p-3 flex justify-between items-center">
            <div>
              <p className="text-[10px] font-bold text-purple-700 uppercase tracking-widest mb-0.5">Active Kitty Members</p>
              <div className="text-2xl font-black text-purple-700 leading-none">{filteredKitty.length}</div>
            </div>
            <div className="h-8 w-8 rounded-full bg-purple-100 flex items-center justify-center"><Gem className="h-4 w-4 text-purple-600" /></div>
          </CardContent>
        </Card>
      </div>

      {/* ✨ AI SMART CAMPAIGNS PANEL */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-lg p-3 shadow-lg shrink-0 flex items-center justify-between border border-indigo-800/50">
        <div className="flex items-center gap-3 text-white">
          <div className="bg-white/10 p-1.5 rounded-md border border-white/20"><Sparkles className="w-4 h-4 text-indigo-300" /></div>
          <div>
            <h2 className="text-sm font-black tracking-wide">AI Smart Campaigns</h2>
            <p className="text-[10px] text-indigo-200 font-medium">Auto-segmented cohorts based on purchase history & time.</p>
          </div>
        </div>
        
        <div className="flex gap-2 flex-wrap justify-end">
          <Button 
            variant={activeAiFilter === 'scheme' ? 'default' : 'outline'} size="sm" 
            onClick={() => setActiveAiFilter(activeAiFilter === 'scheme' ? 'none' : 'scheme')}
            className={`h-8 text-xs font-bold transition-all ${activeAiFilter === 'scheme' ? 'bg-indigo-500 text-white border-transparent shadow-[0_0_15px_rgba(99,102,241,0.5)]' : 'bg-white/5 border-white/20 text-indigo-100 hover:bg-white/10'}`}
          >
            Kitty Scheme Invites ({insights.scheme})
          </Button>
          <Button 
            variant={activeAiFilter === 'cold' ? 'default' : 'outline'} size="sm" 
            onClick={() => setActiveAiFilter(activeAiFilter === 'cold' ? 'none' : 'cold')}
            className={`h-8 text-xs font-bold transition-all ${activeAiFilter === 'cold' ? 'bg-indigo-500 text-white border-transparent shadow-[0_0_15px_rgba(99,102,241,0.5)]' : 'bg-white/5 border-white/20 text-indigo-100 hover:bg-white/10'}`}
          >
            Wake Cold Leads ({insights.cold})
          </Button>
          <Button 
            variant={activeAiFilter === 'birthday' ? 'default' : 'outline'} size="sm" 
            onClick={() => setActiveAiFilter(activeAiFilter === 'birthday' ? 'none' : 'birthday')}
            className={`h-8 text-xs font-bold transition-all ${activeAiFilter === 'birthday' ? 'bg-indigo-500 text-white border-transparent shadow-[0_0_15px_rgba(99,102,241,0.5)]' : 'bg-white/5 border-white/20 text-indigo-100 hover:bg-white/10'}`}
          >
            Birthdays ({insights.birthday})
          </Button>
          <Button 
            variant={activeAiFilter === 'anniversary' ? 'default' : 'outline'} size="sm" 
            onClick={() => setActiveAiFilter(activeAiFilter === 'anniversary' ? 'none' : 'anniversary')}
            className={`h-8 text-xs font-bold transition-all ${activeAiFilter === 'anniversary' ? 'bg-indigo-500 text-white border-transparent shadow-[0_0_15px_rgba(99,102,241,0.5)]' : 'bg-white/5 border-white/20 text-indigo-100 hover:bg-white/10'}`}
          >
            Anniversaries ({insights.anniversary})
          </Button>
          
          {activeAiFilter !== 'none' && (
            <Button variant="ghost" size="sm" onClick={() => setActiveAiFilter('none')} className="h-8 px-2 text-red-300 hover:text-red-200 hover:bg-red-900/30">
              <FilterX className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* MAIN CONTENT AREA */}
      <Card className="flex-1 flex flex-col border-slate-200 shadow-sm overflow-hidden bg-white">
        <Tabs defaultValue="followups" className="flex-1 flex flex-col overflow-hidden">
          <CardHeader className="py-2 px-3 border-b bg-slate-50/80 shrink-0 flex flex-row items-center justify-between">
            <TabsList className="bg-slate-200/50 h-8 p-0.5">
              <TabsTrigger value="followups" className="text-xs font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm">
                Leads <Badge variant="secondary" className="ml-1.5 text-[9px] h-4 px-1">{filteredLeads.length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="purchased" className="text-xs font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm">
                Buyers <Badge variant="secondary" className="ml-1.5 text-[9px] h-4 px-1 bg-green-100 text-green-700">{filteredPurchased.length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="kitty" className="text-xs font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm text-purple-700">
                Kitty Scheme <Badge variant="secondary" className="ml-1.5 text-[9px] h-4 px-1 bg-purple-100 text-purple-700">{filteredKitty.length}</Badge>
              </TabsTrigger>
            </TabsList>
            {activeAiFilter !== 'none' && (
              <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded border border-indigo-100 flex items-center gap-1 animate-pulse">
                <Sparkles className="w-3 h-3"/> {activeAiFilter.toUpperCase()} FILTER ACTIVE
              </span>
            )}
          </CardHeader>
          
          <CardContent className="p-0 flex-1 overflow-hidden">
            {/* FOLLOW UPS TAB */}
            <TabsContent value="followups" className="h-full m-0 data-[state=active]:flex flex-col">
              <div className="flex-1 overflow-y-auto">
                <DataTable
                  columns={columns}
                  data={filteredLeads}
                  loading={isLoading}
                  emptyMessage={activeAiFilter !== 'none' ? "No leads match this AI filter." : "No active leads found."}
                  actions={[
                    { label: 'Message', icon: MessageCircle, onClick: (row) => openWhatsAppModal(row) },
                    { label: 'Schedule', icon: Calendar, onClick: (row) => { 
                        setSelectedCustomer(row); 
                        setFollowupDate(row.next_followup_date || ''); 
                        setFollowupReason(row.followup_reason || ''); 
                        setInteractionNotes(row.last_interaction || ''); 
                        setIsFollowupModalOpen(true); 
                      } 
                    }
                  ]}
                />
              </div>
            </TabsContent>

            {/* PURCHASED TAB */}
            <TabsContent value="purchased" className="h-full m-0 data-[state=active]:flex flex-col">
              <div className="flex-1 overflow-y-auto">
                <DataTable
                  columns={columns}
                  data={filteredPurchased}
                  loading={isLoading}
                  emptyMessage={activeAiFilter !== 'none' ? "No purchased clients match this AI filter." : "No purchased customers found."}
                  actions={[
                    { label: 'Message', icon: MessageCircle, onClick: (row) => openWhatsAppModal(row) },
                    { label: 'Schedule', icon: Calendar, onClick: (row) => { 
                      setSelectedCustomer(row); 
                      setFollowupDate(row.next_followup_date || ''); 
                      setFollowupReason(row.followup_reason || ''); 
                      setInteractionNotes(row.last_interaction || ''); 
                      setIsFollowupModalOpen(true); 
                    }}
                  ]}
                />
              </div>
            </TabsContent>

            {/* KITTY MEMBERS TAB */}
            <TabsContent value="kitty" className="h-full m-0 data-[state=active]:flex flex-col">
              <div className="flex-1 overflow-y-auto bg-purple-50/10">
                <DataTable
                  columns={columns}
                  data={filteredKitty}
                  loading={isLoading}
                  emptyMessage="No active Kitty Members found for this branch."
                  actions={[
                    { label: 'Message', icon: MessageCircle, onClick: (row) => openWhatsAppModal(row) },
                    { label: 'Schedule Installment', icon: Calendar, onClick: (row) => { 
                      setSelectedCustomer(row); 
                      setFollowupDate(row.next_followup_date || ''); 
                      setFollowupReason(row.followup_reason || 'Monthly Installment Due'); 
                      setInteractionNotes(row.last_interaction || ''); 
                      setIsFollowupModalOpen(true); 
                    }}
                  ]}
                />
              </div>
            </TabsContent>

          </CardContent>
        </Tabs>
      </Card>

      {/* --- MODALS --- */}

      {/* REGULAR ADD LEAD MODAL */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Add New Lead</DialogTitle>
            <DialogDescription className="text-xs">Register an inquiry for branch: <span className="font-bold">{warehouses.find(w => w.id === selectedWarehouseId)?.name}</span></DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 pt-2">
            <div className="space-y-1 col-span-2">
              <label className="text-[10px] font-bold text-slate-500 uppercase">Full Name *</label>
              <Input className="h-9 text-sm" placeholder="E.g. Rahul Sharma" value={newCustForm.full_name} onChange={(e) => setNewCustForm({...newCustForm, full_name: e.target.value})} />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase">Phone *</label>
              <Input className="h-9 text-sm font-mono" placeholder="10 digits" value={newCustForm.phone} onChange={(e) => setNewCustForm({...newCustForm, phone: e.target.value})} />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase">City</label>
              <Input className="h-9 text-sm" placeholder="Mumbai" value={newCustForm.city} onChange={(e) => setNewCustForm({...newCustForm, city: e.target.value})} />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase">D.O.B (Optional)</label>
              <Input type="date" className="h-9 text-xs" value={newCustForm.birth_date} onChange={(e) => setNewCustForm({...newCustForm, birth_date: e.target.value})} />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase">Anniversary (Optional)</label>
              <Input type="date" className="h-9 text-xs" value={newCustForm.anniversary_date} onChange={(e) => setNewCustForm({...newCustForm, anniversary_date: e.target.value})} />
            </div>
            <div className="col-span-2 border-t border-slate-100 pt-2 mt-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase mb-2 block">Initial Follow-up Strategy</label>
              <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-1">
                   <label className="text-[9px] font-semibold text-slate-400">Date to contact</label>
                   <Input type="date" className="h-9 text-xs" value={newCustForm.next_followup_date} onChange={(e) => setNewCustForm({...newCustForm, next_followup_date: e.target.value})} />
                 </div>
                 <div className="space-y-1">
                   <label className="text-[9px] font-semibold text-slate-400">Reason / Goal</label>
                   <Input className="h-9 text-sm" placeholder="E.g. Wants to see bridal sets" value={newCustForm.followup_reason} onChange={(e) => setNewCustForm({...newCustForm, followup_reason: e.target.value})} />
                 </div>
              </div>
            </div>
          </div>
          <DialogFooter className="mt-4 border-t border-slate-100 pt-4">
            <Button variant="outline" size="sm" onClick={() => setIsAddModalOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={handleAddCustomer} className="bg-slate-900">Save Lead</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* SPECIAL KITTY SCHEME REGISTRATION MODAL */}
      <Dialog open={isAddKittyModalOpen} onOpenChange={setIsAddKittyModalOpen}>
        <DialogContent className="sm:max-w-[500px] border-t-4 border-t-purple-600">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-purple-700">
              <Gem className="w-5 h-5" /> Register Diamond Kitty Member
            </DialogTitle>
            <DialogDescription className="text-xs">Enroll a new member into the 12-month Pavitram scheme.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 pt-2">
            <div className="space-y-1 col-span-2">
              <label className="text-[10px] font-bold text-purple-800 uppercase">Full Name *</label>
              <Input className="h-9 text-sm border-purple-200 focus-visible:ring-purple-500" placeholder="Member Name" value={newKittyForm.full_name} onChange={(e) => setNewKittyForm({...newKittyForm, full_name: e.target.value})} />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-purple-800 uppercase">Phone *</label>
              <Input className="h-9 text-sm font-mono border-purple-200 focus-visible:ring-purple-500" placeholder="10 digits" value={newKittyForm.phone} onChange={(e) => setNewKittyForm({...newKittyForm, phone: e.target.value})} />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-purple-800 uppercase">City</label>
              <Input className="h-9 text-sm border-purple-200 focus-visible:ring-purple-500" placeholder="Mumbai" value={newKittyForm.city} onChange={(e) => setNewKittyForm({...newKittyForm, city: e.target.value})} />
            </div>
            <div className="col-span-2 bg-purple-50 p-3 rounded-lg border border-purple-100 mt-2 space-y-3">
               <label className="text-[10px] font-black text-purple-900 uppercase block tracking-widest">Scheme Details</label>
               <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-1">
                   <label className="text-[9px] font-bold text-purple-700">Monthly Amount (₹)</label>
                   <Select value={newKittyForm.monthly_amount} onValueChange={(val) => setNewKittyForm({...newKittyForm, monthly_amount: val})}>
                      <SelectTrigger className="h-9 bg-white border-purple-200 font-bold">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="2000">₹ 2,000 / month</SelectItem>
                        <SelectItem value="3000">₹ 3,000 / month</SelectItem>
                        <SelectItem value="5000">₹ 5,000 / month</SelectItem>
                        <SelectItem value="10000">₹ 10,000 / month</SelectItem>
                      </SelectContent>
                   </Select>
                 </div>
                 <div className="space-y-1">
                   <label className="text-[9px] font-bold text-purple-700">Enrollment Date</label>
                   <Input type="date" className="h-9 text-xs bg-white border-purple-200" value={newKittyForm.start_date} onChange={(e) => setNewKittyForm({...newKittyForm, start_date: e.target.value})} />
                 </div>
               </div>
               <p className="text-[9px] text-purple-600 leading-tight">Saving this will automatically schedule their first installment reminder 1 month from the Enrollment Date.</p>
            </div>
          </div>
          <DialogFooter className="mt-4 pt-4">
            <Button variant="ghost" size="sm" onClick={() => setIsAddKittyModalOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={handleAddKittyMember} className="bg-purple-600 hover:bg-purple-700 text-white shadow-md">Confirm Enrollment</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* SCHEDULE FOLLOW-UP MODAL */}
      <Dialog open={isFollowupModalOpen} onOpenChange={setIsFollowupModalOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Schedule Follow-up</DialogTitle>
            <DialogDescription className="text-xs">For {selectedCustomer?.full_name}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase">1. Goal / Reason</label>
              <Input 
                className="h-9 text-sm" 
                placeholder="E.g. Wants to buy a bridal set" 
                value={followupReason} onChange={(e) => setFollowupReason(e.target.value)} 
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase">2. Next Action Date</label>
              <Input type="date" className="h-9 text-sm" value={followupDate} onChange={(e) => setFollowupDate(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase">3. Notes (Optional)</label>
              <textarea 
                className="w-full min-h-[60px] p-2 text-sm border border-slate-200 rounded-md focus:ring-1 focus:ring-slate-900 outline-none resize-none"
                placeholder="Any previous context..." 
                value={interactionNotes} onChange={(e) => setInteractionNotes(e.target.value)} 
              />
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" size="sm" onClick={() => setIsFollowupModalOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={handleUpdateFollowup} className="bg-slate-900">Save Schedule</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* WHATSAPP SENDER MODAL */}
      <Dialog open={isWhatsAppModalOpen} onOpenChange={setIsWhatsAppModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-600">
              <MessageCircle className="w-5 h-5" /> Campaign Message
            </DialogTitle>
            <DialogDescription className="text-xs">To: <span className="font-bold text-slate-700">{selectedCustomer?.full_name}</span> ({selectedCustomer?.phone})</DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 pt-2">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center justify-between">
                <span>1. Select Template</span>
                {activeAiFilter !== 'none' && <Badge className="text-[8px] h-4 bg-indigo-100 text-indigo-700 border-indigo-200 uppercase">Auto-Selected</Badge>}
              </label>
              <Select value={waTemplateId} onValueChange={handleTemplateChange}>
                <SelectTrigger className="h-9 text-sm font-medium bg-slate-50 border-slate-300">
                  <SelectValue placeholder="Choose a template" />
                </SelectTrigger>
                <SelectContent>
                  {selectedCustomer && WA_TEMPLATES[selectedCustomer.customer_status === 'Kitty Member' ? 'Kitty' : selectedCustomer.customer_status === 'Purchased' ? 'Purchased' : 'Lead'].map(t => (
                    <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex justify-between items-end">
                <span>2. Customize Message</span>
                <span className="text-slate-400 font-normal lowercase text-[10px]">Editable</span>
              </label>
              <div className="relative">
                <textarea 
                  className="w-full min-h-[160px] p-3 text-sm border border-slate-300 rounded-md focus:ring-1 focus:ring-green-500 outline-none shadow-inner resize-none leading-relaxed text-slate-800"
                  placeholder="Type your message here..."
                  value={customMessage}
                  onChange={(e) => setCustomMessage(e.target.value)}
                />
              </div>
            </div>
          </div>

          <DialogFooter className="mt-4 flex gap-2 sm:justify-between">
            <Button variant="ghost" size="sm" onClick={() => setIsWhatsAppModalOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={handleSendWhatsApp} className="bg-[#25D366] hover:bg-[#1DA851] text-white font-bold shadow-md px-6">
              <MessageCircle className="w-4 h-4 mr-2" /> Send via WhatsApp
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  )
}