"use client"

import React, { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { 
  ArrowLeft, Plus, MessageCircle, Edit2, Trash2, 
  Loader2, Save, ShieldAlert, Database, Gem, Gift
} from "lucide-react"
import { toast } from "sonner"

import { supabase } from "@/lib/supabaseClient"
import { useAuth } from "@/hooks/useAuth"
import { useStoreLocation } from "@/hooks/useStoreLocation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

type TemplateCategory = 'Lead' | 'Purchased' | 'Kitty'

interface MessageTemplate {
  id: string
  category: TemplateCategory
  template_id: string
  label: string
  message_text: string
  is_active: boolean
}

interface KittyConfig {
  id: string
  monthly_amount: number
  duration_months: number
  bonus_amount: number
  is_active: boolean
}

export default function CRMSettingsPage() {
  const { appUser } = useAuth()
  const router = useRouter()
  
  // SECURITY: Check if user has global/HQ access
  const { isHQ } = useStoreLocation()
  const isAdmin = appUser?.role === 'owner' || appUser?.role === 'manager' || appUser?.role === 'operations_manager' || isHQ

  const [mainTab, setMainTab] = useState<'messages' | 'kitty'>('messages')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  // --- TEMPLATE STATES ---
  const [templates, setTemplates] = useState<MessageTemplate[]>([])
  const [activeTemplateTab, setActiveTemplateTab] = useState<TemplateCategory>('Lead')
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false)
  const [templateForm, setTemplateForm] = useState<Partial<MessageTemplate>>({ category: 'Lead', label: '', message_text: '' })

  // --- KITTY CONFIG STATES ---
  const [kittyConfigs, setKittyConfigs] = useState<KittyConfig[]>([])
  const [isKittyModalOpen, setIsKittyModalOpen] = useState(false)
  const [kittyForm, setKittyForm] = useState<Partial<KittyConfig>>({ monthly_amount: 0, duration_months: 12, bonus_amount: 0 })

  const fetchAllData = useCallback(async () => {
    if (!appUser?.company_id || !isAdmin) return
    setIsLoading(true)
    try {
      // Fetch Templates
      const { data: tplData, error: tplError } = await supabase
        .from('crm_message_templates')
        .select('*')
        .eq('company_id', appUser.company_id)
        .order('created_at', { ascending: true })
      if (tplError) throw tplError
      setTemplates(tplData || [])

      // Fetch Kitty Configs
      const { data: kittyData, error: kittyError } = await supabase
        .from('crm_kitty_plans_config')
        .select('*')
        .eq('company_id', appUser.company_id)
        .order('monthly_amount', { ascending: true })
      if (kittyError) throw kittyError
      setKittyConfigs(kittyData || [])

    } catch (err: any) {
      toast.error(`Failed to load settings: ${err.message}`)
    } finally {
      setIsLoading(false)
    }
  }, [appUser, isAdmin])

  useEffect(() => {
    fetchAllData()
  }, [fetchAllData])

  // ==========================================
  // TEMPLATE HANDLERS
  // ==========================================
  const handleOpenTemplateModal = (template?: MessageTemplate) => {
    if (template) setTemplateForm(template)
    else setTemplateForm({ category: activeTemplateTab, label: '', message_text: '' })
    setIsTemplateModalOpen(true)
  }

  const handleSaveTemplate = async () => {
    if (!appUser?.company_id) return
    if (!templateForm.label || !templateForm.message_text) return toast.error("Label and Message Text are required.")

    setIsSaving(true)
    try {
      const templateId = templateForm.template_id || templateForm.label.toLowerCase().replace(/[^a-z0-9]+/g, '_')
      const payload = {
        company_id: appUser.company_id,
        category: templateForm.category,
        template_id: templateId,
        label: templateForm.label,
        message_text: templateForm.message_text,
        is_active: true,
        updated_at: new Date().toISOString()
      }

      if (templateForm.id) {
        await supabase.from('crm_message_templates').update(payload).eq('id', templateForm.id)
        toast.success("Template updated successfully!")
      } else {
        await supabase.from('crm_message_templates').insert([payload])
        toast.success("New template created!")
      }
      setIsTemplateModalOpen(false)
      fetchAllData()
    } catch (err: any) {
      toast.error(`Error saving template: ${err.message}`)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteTemplate = async (id: string) => {
    if (!confirm("Are you sure you want to delete this template?")) return
    try {
      await supabase.from('crm_message_templates').delete().eq('id', id)
      toast.success("Template deleted.")
      fetchAllData()
    } catch (err: any) {
      toast.error(`Failed to delete: ${err.message}`)
    }
  }

  // ==========================================
  // KITTY PLAN HANDLERS
  // ==========================================
  const handleOpenKittyModal = (config?: KittyConfig) => {
    if (config) setKittyForm(config)
    else setKittyForm({ monthly_amount: 0, duration_months: 12, bonus_amount: 0 })
    setIsKittyModalOpen(true)
  }

  const handleSaveKittyConfig = async () => {
    if (!appUser?.company_id) return
    if (!kittyForm.monthly_amount || !kittyForm.duration_months) return toast.error("Amount and Duration are required.")

    setIsSaving(true)
    try {
      const payload = {
        company_id: appUser.company_id,
        monthly_amount: Number(kittyForm.monthly_amount),
        duration_months: Number(kittyForm.duration_months),
        bonus_amount: Number(kittyForm.bonus_amount) || 0,
        is_active: true
      }

      if (kittyForm.id) {
        await supabase.from('crm_kitty_plans_config').update(payload).eq('id', kittyForm.id)
        toast.success("Kitty plan updated!")
      } else {
        await supabase.from('crm_kitty_plans_config').insert([payload])
        toast.success("New Kitty plan activated!")
      }
      setIsKittyModalOpen(false)
      fetchAllData()
    } catch (err: any) {
      toast.error(`Error saving plan: ${err.message}`)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteKittyConfig = async (id: string) => {
    if (!confirm("Are you sure you want to delete this plan configuration?")) return
    try {
      await supabase.from('crm_kitty_plans_config').delete().eq('id', id)
      toast.success("Plan deleted.")
      fetchAllData()
    } catch (err: any) {
      toast.error(`Failed to delete: ${err.message}`)
    }
  }


  // ==========================================
  // RENDER BLOCKS
  // ==========================================

  // SECURITY RENDER
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-[#fafafa] flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md bg-white border border-slate-200 shadow-sm rounded-3xl p-8 text-center space-y-4">
          <div className="h-16 w-16 bg-red-50 text-red-500 flex items-center justify-center rounded-full mx-auto mb-2">
            <ShieldAlert className="h-8 w-8" />
          </div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight">Access Restricted</h1>
          <p className="text-sm text-slate-500 font-medium">CRM Settings and Tier Configurations are strictly limited to System Administrators and Global HQ accounts.</p>
          <Button onClick={() => router.back()} className="mt-4 w-full h-11 bg-slate-900 text-white rounded-xl">Go Back</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen bg-[#fafafa] font-sans selection:bg-indigo-100">
      
      {/* HEADER */}
      <header className="h-14 bg-white border-b border-gray-200 px-4 sm:px-6 flex items-center sticky top-0 z-40 shadow-sm box-border">
        <div className="w-full max-w-5xl mx-auto flex items-center gap-3">
          <Link href="/crm">
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-gray-100 text-gray-500">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <Separator orientation="vertical" className="h-5 bg-gray-200" />
          <div className="flex items-center gap-2.5">
            <div className="h-7 w-7 bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center rounded-lg text-xs shadow-sm">
              <Database className="w-3.5 h-3.5" />
            </div>
            <h1 className="text-sm font-bold text-gray-900 tracking-tight leading-none">CRM Settings & Automations</h1>
          </div>
        </div>
      </header>

      <main className="p-4 md:p-8 max-w-5xl w-full mx-auto animate-in fade-in duration-300">
        
        <Tabs value={mainTab} onValueChange={(v: any) => setMainTab(v)} className="w-full space-y-6">
          {/* TOP LEVEL SETTINGS NAV */}
          <TabsList className="bg-white border border-slate-200 shadow-sm p-1 rounded-2xl w-full flex h-auto">
            <TabsTrigger value="messages" className="rounded-xl text-xs font-bold py-3 px-4 data-[state=active]:bg-indigo-50 data-[state=active]:text-indigo-700 flex-1">
              <MessageCircle className="w-4 h-4 mr-2" /> WhatsApp Templates
            </TabsTrigger>
            <TabsTrigger value="kitty" className="rounded-xl text-xs font-bold py-3 px-4 data-[state=active]:bg-purple-50 data-[state=active]:text-purple-700 flex-1">
              <Gem className="w-4 h-4 mr-2" /> Kitty Plan Tiers
            </TabsTrigger>
          </TabsList>

          {/* ========================================================= */}
          {/* TAB: WHATSAPP TEMPLATES                                     */}
          {/* ========================================================= */}
          <TabsContent value="messages" className="space-y-6 outline-none">
            <div className="flex flex-col sm:flex-row justify-between sm:items-end gap-4 bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
              <div className="space-y-1">
                <h2 className="text-xl font-bold tracking-tight text-gray-900">WhatsApp Templates</h2>
                <p className="text-xs font-medium text-gray-500">Manage the pre-written messages used by your sales team to contact leads and members.</p>
              </div>
              <Button className="h-10 px-5 text-xs font-bold uppercase tracking-widest bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-md transition-all active:scale-95" onClick={() => handleOpenTemplateModal()}>
                <Plus className="w-4 h-4 mr-2" /> Add Template
              </Button>
            </div>

            <Tabs value={activeTemplateTab} onValueChange={(v) => setActiveTemplateTab(v as TemplateCategory)} className="w-full">
              <TabsList className="bg-gray-200/50 p-1 rounded-xl w-full sm:w-auto flex h-auto">
                <TabsTrigger value="Lead" className="rounded-lg text-xs font-bold py-2 px-4 data-[state=active]:bg-white data-[state=active]:shadow-sm flex-1 sm:flex-none">Inquiries / Leads</TabsTrigger>
                <TabsTrigger value="Purchased" className="rounded-lg text-xs font-bold py-2 px-4 data-[state=active]:bg-white data-[state=active]:shadow-sm flex-1 sm:flex-none">Past Buyers</TabsTrigger>
                <TabsTrigger value="Kitty" className="rounded-lg text-xs font-bold py-2 px-4 data-[state=active]:bg-white data-[state=active]:shadow-sm flex-1 sm:flex-none">Kitty Members</TabsTrigger>
              </TabsList>

              <div className="grid gap-4 mt-6">
                {isLoading ? (
                  [1, 2, 3].map(i => <div key={i} className="h-24 bg-gray-100 animate-pulse rounded-xl" />)
                ) : templates.filter(t => t.category === activeTemplateTab).length === 0 ? (
                  <div className="text-center py-16 bg-white border border-gray-200 rounded-2xl shadow-sm">
                    <MessageCircle className="w-10 h-10 mx-auto text-gray-300 mb-3" />
                    <p className="text-sm font-semibold text-gray-500">No templates found for {activeTemplateTab}.</p>
                  </div>
                ) : (
                  templates.filter(t => t.category === activeTemplateTab).map(template => (
                    <Card key={template.id} className="shadow-sm border-gray-200 rounded-2xl overflow-hidden group hover:border-indigo-200 transition-colors">
                      <CardContent className="p-5 flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2">
                            <h3 className="font-bold text-gray-900 text-sm">{template.label}</h3>
                            <Badge variant="secondary" className="text-[9px] uppercase tracking-widest font-mono bg-gray-100 text-gray-500">{template.template_id}</Badge>
                          </div>
                          <p className="text-xs text-gray-600 leading-relaxed bg-gray-50 p-3 rounded-lg border border-gray-100 whitespace-pre-wrap">{template.message_text}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 w-full md:w-auto justify-end">
                          <Button variant="outline" size="sm" className="h-8 border-gray-200 text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg" onClick={() => handleOpenTemplateModal(template)}>
                            <Edit2 className="w-3.5 h-3.5 mr-1.5" /> Edit
                          </Button>
                          <Button variant="outline" size="sm" className="h-8 border-gray-200 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg" onClick={() => handleDeleteTemplate(template.id)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </Tabs>
          </TabsContent>


          {/* ========================================================= */}
          {/* TAB: KITTY PLAN CONFIGURATIONS                              */}
          {/* ========================================================= */}
          <TabsContent value="kitty" className="space-y-6 outline-none">
             <div className="flex flex-col sm:flex-row justify-between sm:items-end gap-4 bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
              <div className="space-y-1">
                <h2 className="text-xl font-bold tracking-tight text-purple-900">Kitty Plan & Bonus Tiers</h2>
                <p className="text-xs font-medium text-gray-500">Define the monthly installments available to customers and set the exact Jeweler Bonus amount for each tier upon maturity.</p>
              </div>
              <Button className="h-10 px-5 text-xs font-bold uppercase tracking-widest bg-purple-600 hover:bg-purple-700 text-white rounded-xl shadow-md transition-all active:scale-95" onClick={() => handleOpenKittyModal()}>
                <Plus className="w-4 h-4 mr-2" /> Add Plan Tier
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {isLoading ? (
                  [1, 2, 3].map(i => <div key={i} className="h-32 bg-gray-100 animate-pulse rounded-2xl" />)
                ) : kittyConfigs.length === 0 ? (
                  <div className="col-span-full text-center py-16 bg-white border border-gray-200 rounded-2xl shadow-sm">
                    <Gem className="w-10 h-10 mx-auto text-purple-200 mb-3" />
                    <p className="text-sm font-semibold text-gray-500">No Kitty Plans configured yet.</p>
                  </div>
                ) : (
                  kittyConfigs.map(config => (
                    <Card key={config.id} className="shadow-sm border-gray-200 rounded-2xl overflow-hidden group hover:border-purple-200 transition-all flex flex-col">
                      <div className="p-5 flex-1 space-y-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Monthly Deposit</p>
                            <h3 className="font-black text-2xl text-purple-900 tracking-tighter">₹{config.monthly_amount.toLocaleString()}</h3>
                          </div>
                          <Badge variant="outline" className="bg-gray-50 text-gray-500 border-none text-[10px] uppercase font-bold tracking-wider">{config.duration_months} Months</Badge>
                        </div>

                        <div className="bg-purple-50/50 border border-purple-100 rounded-xl p-3 flex items-center gap-3">
                          <div className="h-8 w-8 bg-purple-100 text-purple-600 rounded-lg flex items-center justify-center shrink-0">
                            <Gift className="w-4 h-4" />
                          </div>
                          <div>
                             <p className="text-[10px] font-bold text-purple-400 uppercase tracking-widest leading-none mb-1">Maturity Bonus</p>
                             <p className="text-sm font-bold text-purple-700 leading-none">
                                {config.bonus_amount > 0 ? `+ ₹${config.bonus_amount.toLocaleString()}` : 'No Additional Bonus'}
                             </p>
                          </div>
                        </div>
                      </div>
                      <div className="bg-gray-50 p-3 border-t border-gray-100 flex justify-end gap-2 shrink-0">
                          <Button variant="outline" size="sm" className="h-8 border-gray-200 text-gray-600 hover:text-purple-600 hover:bg-purple-50 rounded-lg flex-1" onClick={() => handleOpenKittyModal(config)}>
                            <Edit2 className="w-3.5 h-3.5 mr-1.5" /> Edit
                          </Button>
                          <Button variant="outline" size="sm" className="h-8 border-gray-200 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg flex-1" onClick={() => handleDeleteKittyConfig(config.id)}>
                            <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Delete
                          </Button>
                      </div>
                    </Card>
                  ))
                )}
            </div>
          </TabsContent>

        </Tabs>
      </main>

      {/* ========================================================= */}
      {/* MODAL: MESSAGE TEMPLATE                                     */}
      {/* ========================================================= */}
      <Dialog open={isTemplateModalOpen} onOpenChange={setIsTemplateModalOpen}>
        <DialogContent className="sm:max-w-[500px] p-0 border-none shadow-2xl rounded-2xl bg-white overflow-hidden">
          <DialogHeader className="bg-gray-50 p-6 border-b border-gray-100">
            <DialogTitle className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-indigo-600" />
              {templateForm.id ? 'Edit Template' : 'New Template'}
            </DialogTitle>
            <DialogDescription className="text-xs font-medium text-gray-500 mt-1">
              Use <span className="font-mono font-bold text-indigo-600 bg-indigo-50 px-1 rounded">{`{name}`}</span> to automatically insert the customer's first name.
            </DialogDescription>
          </DialogHeader>

          <div className="p-6 space-y-5">
            <div className="space-y-2">
              <Label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Category</Label>
              <Select value={templateForm.category} onValueChange={(v) => setTemplateForm({...templateForm, category: v as TemplateCategory})}>
                <SelectTrigger className="h-10 rounded-xl bg-white border-gray-200 text-sm font-semibold focus:ring-indigo-500">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-gray-200">
                  <SelectItem value="Lead" className="text-xs font-semibold">Inquiries / Leads</SelectItem>
                  <SelectItem value="Purchased" className="text-xs font-semibold">Past Buyers</SelectItem>
                  <SelectItem value="Kitty" className="text-xs font-semibold">Kitty Members</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Internal Label</Label>
              <Input 
                placeholder="e.g. Festival Upsell, Birthday Wish..." 
                className="h-10 text-sm font-semibold border-gray-200 rounded-xl focus-visible:ring-indigo-500 shadow-sm"
                value={templateForm.label}
                onChange={e => setTemplateForm({...templateForm, label: e.target.value})}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex justify-between">
                <span>Message Body</span>
                <span className="text-gray-400 lowercase font-medium">Supports Emojis ✨</span>
              </Label>
              <textarea 
                className="w-full min-h-[160px] p-4 text-sm font-medium border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none shadow-sm resize-none leading-relaxed text-gray-800 bg-white"
                placeholder="Hi {name}, we have a special offer for you..."
                value={templateForm.message_text}
                onChange={(e) => setTemplateForm({...templateForm, message_text: e.target.value})}
              />
            </div>
          </div>

          <DialogFooter className="bg-gray-50 p-4 border-t border-gray-100 flex-row gap-3">
            <Button variant="outline" className="flex-1 h-11 rounded-xl text-xs font-bold uppercase tracking-widest text-gray-500 border-gray-200 hover:bg-gray-100" onClick={() => setIsTemplateModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveTemplate} disabled={isSaving} className="flex-[2] h-11 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs uppercase tracking-widest shadow-md">
              {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />} Save Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========================================================= */}
      {/* MODAL: KITTY PLAN TIER                                      */}
      {/* ========================================================= */}
      <Dialog open={isKittyModalOpen} onOpenChange={setIsKittyModalOpen}>
        <DialogContent className="sm:max-w-[400px] p-0 border-none shadow-2xl rounded-2xl bg-white overflow-hidden">
          <DialogHeader className="bg-purple-50/50 p-6 border-b border-purple-100/50">
            <DialogTitle className="text-lg font-bold text-purple-900 flex items-center gap-2">
              <Gem className="w-5 h-5 text-purple-600" />
              {kittyForm.id ? 'Edit Plan Tier' : 'New Plan Tier'}
            </DialogTitle>
            <DialogDescription className="text-xs font-medium text-purple-600/70 mt-1">
              Configure the monthly commitment and the final jeweler bonus awarded upon completion.
            </DialogDescription>
          </DialogHeader>

          <div className="p-6 space-y-5">
            <div className="space-y-2">
              <Label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Monthly Installment Amount (₹)</Label>
              <Input 
                type="number"
                placeholder="e.g. 5000" 
                className="h-12 text-lg font-black text-purple-900 border-gray-200 rounded-xl focus-visible:ring-purple-500 shadow-sm"
                value={kittyForm.monthly_amount || ''}
                onChange={e => setKittyForm({...kittyForm, monthly_amount: Number(e.target.value)})}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
               <div className="space-y-2">
                 <Label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Duration (Months)</Label>
                 <Input 
                   type="number"
                   className="h-11 text-sm font-bold border-gray-200 rounded-xl focus-visible:ring-purple-500 shadow-sm"
                   value={kittyForm.duration_months || ''}
                   onChange={e => setKittyForm({...kittyForm, duration_months: Number(e.target.value)})}
                 />
               </div>
               <div className="space-y-2">
                 <Label className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest flex items-center gap-1"><Gift className="w-3 h-3"/> Maturity Bonus</Label>
                 <Input 
                   type="number"
                   placeholder="e.g. 5000 or 0"
                   className="h-11 text-sm font-bold text-emerald-700 bg-emerald-50/50 border-emerald-200 rounded-xl focus-visible:ring-emerald-500 shadow-sm"
                   value={kittyForm.bonus_amount ?? ''}
                   onChange={e => setKittyForm({...kittyForm, bonus_amount: Number(e.target.value)})}
                 />
               </div>
            </div>
          </div>

          <DialogFooter className="bg-gray-50 p-4 border-t border-gray-100 flex-row gap-3">
            <Button variant="outline" className="flex-1 h-11 rounded-xl text-xs font-bold uppercase tracking-widest text-gray-500 border-gray-200 hover:bg-gray-100" onClick={() => setIsKittyModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveKittyConfig} disabled={isSaving} className="flex-[2] h-11 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs uppercase tracking-widest shadow-md">
              {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />} Save Plan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  )
}