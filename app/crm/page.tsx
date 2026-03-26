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
  Database
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Separator } from '@radix-ui/react-separator'

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
    { id: 'blank', label: 'Blank Message', text: "Hi {name}, " }
  ],
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
  
  const { isHQ, isLocked, selectedLocation, setSelectedLocation } = useStoreLocation()
  
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [customers, setCustomers] = useState<CRMCustomer[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')

  const [activeAiFilter, setActiveAiFilter] = useState<'none' | 'scheme' | 'cold' | 'birthday' | 'anniversary'>('none')

  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isAddKittyModalOpen, setIsAddKittyModalOpen] = useState(false)
  const [isWhatsAppModalOpen, setIsWhatsAppModalOpen] = useState(false)
  const [isFollowupModalOpen, setIsFollowupModalOpen] = useState(false)
  
  const [selectedCustomer, setSelectedCustomer] = useState<CRMCustomer | null>(null)
  
  const [newCustForm, setNewCustForm] = useState({ 
    full_name: '', phone: '', city: '', customer_status: 'Lead', 
    birth_date: '', anniversary_date: '', next_followup_date: '', followup_reason: '' 
  })

  const [newKittyForm, setNewKittyForm] = useState({
    full_name: '', phone: '', city: '', monthly_amount: '5000', start_date: new Date().toISOString().split('T')[0]
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

  // --- ACTIONS ---
  const handleAddCustomer = async () => {
    if (!selectedLocation || selectedLocation === 'ALL') {
      return toast({ title: 'Security Restriction', description: 'Please select a specific branch to add a lead, not ALL.', variant: 'destructive' })
    }
    if (!newCustForm.full_name || !newCustForm.phone) return toast({ title: 'Name and Phone required', variant: 'destructive' })
    
    try {
      const { error } = await supabase.from('customers').insert([{
        company_id: appUser?.company_id,
        warehouse_id: selectedLocation, 
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

  const handleAddKittyMember = async () => {
    if (!selectedLocation || selectedLocation === 'ALL') {
      return toast({ title: 'Security Restriction', description: 'Please select a specific branch to register a kitty member.', variant: 'destructive' })
    }
    if (!newKittyForm.full_name || !newKittyForm.phone) return toast({ title: 'Name and Phone required', variant: 'destructive' })
    
    try {
      const nextInstallment = new Date(newKittyForm.start_date)
      nextInstallment.setMonth(nextInstallment.getMonth() + 1)

      const { error } = await supabase.from('customers').insert([{
        company_id: appUser?.company_id,
        warehouse_id: selectedLocation, 
        full_name: newKittyForm.full_name,
        phone: newKittyForm.phone,
        city: newKittyForm.city,
        customer_status: 'Kitty Member',
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
    
    let statusKey: 'Lead' | 'Purchased' | 'Kitty' = 'Lead'
    if (selectedCustomer.customer_status === 'Purchased') statusKey = 'Purchased'
    if (selectedCustomer.customer_status === 'Kitty Member') statusKey = 'Kitty'

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

  // --- MATH & INSIGHTS ---
  const { filteredLeads, filteredPurchased, filteredKitty, insights, reminders } = useMemo(() => {
    const today = new Date(); today.setHours(0,0,0,0);
    const thirtyDaysAgo = new Date(today); thirtyDaysAgo.setDate(today.getDate() - 30)
    const fourteenDaysAgo = new Date(today); fourteenDaysAgo.setDate(today.getDate() - 14)
    const currentMonth = today.getMonth()

    let baseLeads = customers.filter(c => c.customer_status === 'Lead' || c.customer_status == null)
    let basePurchased = customers.filter(c => c.customer_status === 'Purchased')
    let baseKitty = customers.filter(c => c.customer_status === 'Kitty Member')

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
    const birthdayClients = customers.filter(c => c.birth_date && new Date(c.birth_date).getMonth() === currentMonth)
    const anniversaryClients = customers.filter(c => c.anniversary_date && new Date(c.anniversary_date).getMonth() === currentMonth)

    if (activeAiFilter === 'scheme') basePurchased = schemeEligible
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


  if (loading || !appUser) return null

  return (
    <div className="flex flex-col min-h-screen bg-[#fafafa] font-sans selection:bg-indigo-100 pb-20">
      
      {/* 1. GLOBAL h-14 HEADER */}
      <header className="h-14 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center sticky top-0 z-40 shadow-sm box-border">
        <div className="w-full max-w-7xl mx-auto flex justify-between items-center gap-4">
          <div className="flex items-center gap-2.5">
            <div className="h-7 w-7 bg-rose-50 border border-rose-100 text-rose-600 flex items-center justify-center rounded text-xs shadow-sm">
              <Users className="w-3.5 h-3.5" />
            </div>
            <h1 className="text-sm font-semibold text-slate-900 tracking-tight leading-none hidden sm:block">Customer CRM</h1>
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
            <Button onClick={() => setIsAddKittyModalOpen(true)} className="flex-1 md:flex-none bg-purple-600 hover:bg-purple-700 text-white h-10 px-4 text-xs font-bold shadow-sm rounded-lg border border-purple-500 transition-none">
              <Gem className="w-3.5 h-3.5 mr-1.5" /> Kitty Member
            </Button>
            <Button onClick={() => setIsAddModalOpen(true)} className="flex-1 md:flex-none bg-slate-900 hover:bg-slate-800 text-white h-10 px-4 text-xs font-bold shadow-sm rounded-lg transition-none">
              <UserPlus className="w-3.5 h-3.5 mr-1.5" /> Add Lead
            </Button>
          </div>
        </div>

        {/* 3. METRICS DASHBOARD */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 shrink-0">
          <Card className="border-slate-200 shadow-sm rounded-xl">
            <CardContent className="p-4 flex justify-between items-center">
              <div>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Total Clients</p>
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
                <p className="text-[10px] font-bold text-purple-600 uppercase tracking-widest mb-1">Kitty Members</p>
                <div className="text-2xl font-extrabold tracking-tight text-purple-700 leading-none">{filteredKitty.length}</div>
              </div>
              <div className="h-10 w-10 rounded-full bg-purple-100/50 border border-purple-100 flex items-center justify-center"><Gem className="h-5 w-5 text-purple-500" /></div>
            </CardContent>
          </Card>
        </div>

        {/* 4. AI SMART CAMPAIGNS PANEL */}
        <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-4 shadow-sm shrink-0 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-white p-2 rounded-lg border border-indigo-100 text-indigo-500 shadow-sm"><Sparkles className="w-4 h-4" /></div>
            <div>
              <h2 className="text-sm font-bold text-indigo-900 tracking-tight">AI Smart Campaigns</h2>
              <p className="text-[10px] text-indigo-500 font-medium">Auto-segmented cohorts based on lifecycle and dates.</p>
            </div>
          </div>
          
          <div className="flex gap-2 flex-wrap lg:justify-end">
            <Button 
              variant={activeAiFilter === 'scheme' ? 'default' : 'outline'} size="sm" 
              onClick={() => setActiveAiFilter(activeAiFilter === 'scheme' ? 'none' : 'scheme')}
              className={cn("h-8 text-xs font-semibold transition-none rounded-lg", activeAiFilter === 'scheme' ? "bg-indigo-600 text-white border-transparent" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50")}
            >
              Kitty Invites ({insights.scheme})
            </Button>
            <Button 
              variant={activeAiFilter === 'cold' ? 'default' : 'outline'} size="sm" 
              onClick={() => setActiveAiFilter(activeAiFilter === 'cold' ? 'none' : 'cold')}
              className={cn("h-8 text-xs font-semibold transition-none rounded-lg", activeAiFilter === 'cold' ? "bg-indigo-600 text-white border-transparent" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50")}
            >
              Wake Cold Leads ({insights.cold})
            </Button>
            <Button 
              variant={activeAiFilter === 'birthday' ? 'default' : 'outline'} size="sm" 
              onClick={() => setActiveAiFilter(activeAiFilter === 'birthday' ? 'none' : 'birthday')}
              className={cn("h-8 text-xs font-semibold transition-none rounded-lg", activeAiFilter === 'birthday' ? "bg-indigo-600 text-white border-transparent" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50")}
            >
              Birthdays ({insights.birthday})
            </Button>
            <Button 
              variant={activeAiFilter === 'anniversary' ? 'default' : 'outline'} size="sm" 
              onClick={() => setActiveAiFilter(activeAiFilter === 'anniversary' ? 'none' : 'anniversary')}
              className={cn("h-8 text-xs font-semibold transition-none rounded-lg", activeAiFilter === 'anniversary' ? "bg-indigo-600 text-white border-transparent" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50")}
            >
              Anniversaries ({insights.anniversary})
            </Button>
            
            {activeAiFilter !== 'none' && (
              <Button variant="ghost" size="icon" onClick={() => setActiveAiFilter('none')} className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg">
                <FilterX className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>

        {/* 5. MAIN CONTENT AREA (Tabs & RESPONSIVE List) */}
        <Card className="flex-1 flex flex-col border-slate-200 shadow-sm overflow-hidden bg-white rounded-xl">
          <Tabs defaultValue="followups" className="flex-1 flex flex-col overflow-hidden">
            <CardHeader className="py-2 px-3 border-b border-slate-100 bg-slate-50/50 shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <TabsList className="bg-slate-100/50 h-9 p-1 rounded-lg border border-slate-200/60 self-start">
                <TabsTrigger value="followups" className="text-[11px] font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-md">
                  Leads <Badge variant="secondary" className="ml-1.5 text-[9px] h-4 px-1 bg-slate-100">{filteredLeads.length}</Badge>
                </TabsTrigger>
                <TabsTrigger value="purchased" className="text-[11px] font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-md">
                  Buyers <Badge variant="secondary" className="ml-1.5 text-[9px] h-4 px-1 bg-emerald-50 text-emerald-600 border-emerald-100">{filteredPurchased.length}</Badge>
                </TabsTrigger>
                <TabsTrigger value="kitty" className="text-[11px] font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm text-purple-700 rounded-md">
                  Kitty Scheme <Badge variant="secondary" className="ml-1.5 text-[9px] h-4 px-1 bg-purple-50 text-purple-600 border-purple-100">{filteredKitty.length}</Badge>
                </TabsTrigger>
              </TabsList>
              
              {activeAiFilter !== 'none' && (
                <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-md border border-indigo-100 flex items-center gap-1.5 animate-pulse shrink-0">
                  <Sparkles className="w-3 h-3"/> {activeAiFilter.toUpperCase()} FILTER APPLIED
                </span>
              )}
            </CardHeader>
            
            <CardContent className="p-0 flex-1 overflow-hidden">
              <TabsContent value="followups" className="h-full m-0 data-[state=active]:flex flex-col">
                 <CustomerListView 
                   data={filteredLeads} 
                   loading={isLoading} 
                   emptyMessage={activeAiFilter !== 'none' ? "No leads match this AI filter." : "No active leads found."}
                   onMessage={openWhatsAppModal}
                   onSchedule={openScheduleModal}
                 />
              </TabsContent>

              <TabsContent value="purchased" className="h-full m-0 data-[state=active]:flex flex-col">
                 <CustomerListView 
                   data={filteredPurchased} 
                   loading={isLoading} 
                   emptyMessage={activeAiFilter !== 'none' ? "No purchased clients match this AI filter." : "No purchased customers found."}
                   onMessage={openWhatsAppModal}
                   onSchedule={openScheduleModal}
                 />
              </TabsContent>

              <TabsContent value="kitty" className="h-full m-0 data-[state=active]:flex flex-col">
                 <CustomerListView 
                   data={filteredKitty} 
                   loading={isLoading} 
                   emptyMessage="No active Kitty Members found for this branch."
                   onMessage={openWhatsAppModal}
                   onSchedule={openScheduleModal}
                   isKitty={true}
                 />
              </TabsContent>
            </CardContent>
          </Tabs>
        </Card>
      </main>

      {/* --- MODALS --- */}
      {/* ADD LEAD MODAL */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="sm:max-w-[500px] border-slate-200 rounded-xl bg-white shadow-2xl p-0 overflow-hidden">
          <DialogHeader className="bg-slate-50 p-5 border-b border-slate-100">
            <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-slate-500" /> Add New Lead
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500 mt-1">Register an inquiry for branch: <span className="font-bold text-slate-700">{selectedLocation === 'ALL' ? 'GLOBAL HQ' : warehouses.find(w => w.id === selectedLocation)?.name}</span></DialogDescription>
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
            <Button className="flex-[2] h-10 text-xs font-bold rounded-lg bg-slate-900 hover:bg-slate-800 text-white shadow-sm" onClick={handleAddCustomer}>Save Lead</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* KITTY REGISTRATION MODAL */}
      <Dialog open={isAddKittyModalOpen} onOpenChange={setIsAddKittyModalOpen}>
        <DialogContent className="sm:max-w-[500px] border-slate-200 rounded-xl bg-white shadow-2xl p-0 overflow-hidden">
          <DialogHeader className="bg-purple-50 p-5 border-b border-purple-100">
            <DialogTitle className="text-base font-bold flex items-center gap-2 text-purple-700">
              <Gem className="w-4 h-4" /> Register Diamond Kitty Member
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
            <Button className="flex-[2] h-10 text-xs font-bold rounded-lg bg-purple-600 hover:bg-purple-700 text-white shadow-sm" onClick={handleAddKittyMember}>Confirm Enrollment</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* SCHEDULE MODAL */}
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
            <Button className="flex-[2] h-10 text-xs font-bold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm" onClick={handleUpdateFollowup}>Save Schedule</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* WHATSAPP MODAL */}
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
// RESPONSIVE CUSTOMER LIST COMPONENT (Vercel Style Hybrid Render)
// =========================================================================
function CustomerListView({ data, loading, emptyMessage, onMessage, onSchedule, isKitty = false }: any) {
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

  // Follow-up Badge Renderer
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
      {/* --- DESKTOP VIEW (Standard Table) --- */}
      <div className="hidden md:block overflow-x-auto flex-1 custom-scrollbar">
        <Table>
          <TableHeader className="bg-slate-50 border-b border-slate-200 sticky top-0">
            <TableRow className="hover:bg-transparent border-none">
              <TableHead className="text-[10px] font-bold uppercase tracking-wider text-slate-500 h-10 px-6">Client Profile</TableHead>
              <TableHead className="text-[10px] font-bold uppercase tracking-wider text-slate-500 h-10">Follow-up Details</TableHead>
              <TableHead className="text-[10px] font-bold uppercase tracking-wider text-slate-500 h-10">Last Note</TableHead>
              <TableHead className="w-[180px] text-right px-6"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row: any) => (
              <TableRow key={row.id} className={cn("transition-colors border-b border-slate-100 hover:bg-slate-50/50", isKitty && "hover:bg-purple-50/50")}>
                <TableCell className="px-6 py-3">
                  <div className="flex flex-col">
                    <span className="font-semibold text-slate-900 text-sm leading-tight">{row.full_name}</span>
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

      {/* --- MOBILE VIEW (Stacked Action Cards) --- */}
      <div className="md:hidden flex flex-col gap-3 p-3 bg-slate-50/50 flex-1 overflow-y-auto custom-scrollbar">
        {data.map((row: any) => (
          <div key={row.id} className={cn("bg-white border rounded-xl p-4 shadow-sm flex flex-col gap-3", isKitty ? "border-purple-100" : "border-slate-200")}>
            <div className="flex justify-between items-start">
              <div>
                <p className="font-bold text-slate-900 text-sm">{row.full_name}</p>
                <p className="text-[11px] font-mono text-slate-500 mt-0.5 flex items-center gap-1"><Phone className="w-3 h-3"/> {row.phone}</p>
              </div>
              <Button size="icon" variant="outline" className="h-8 w-8 text-[#1DA851] border-slate-200 rounded-lg hover:bg-[#25D366]/10 shrink-0" onClick={() => onMessage(row)}>
                <MessageCircle className="h-4 w-4" />
              </Button>
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