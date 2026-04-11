"use client"

import React, { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { 
  ArrowLeft, Plus, MessageCircle, Edit2, Trash2, 
  Loader2, Save, LayoutDashboard, Users
} from "lucide-react"
import { toast } from "sonner"

import { supabase } from "@/lib/supabaseClient"
import { useAuth } from "@/hooks/useAuth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
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

export default function CRMSettingsPage() {
  const { appUser } = useAuth()
  
  const [templates, setTemplates] = useState<MessageTemplate[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TemplateCategory>('Lead')
  
  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  
  const [form, setForm] = useState<Partial<MessageTemplate>>({
    category: 'Lead',
    label: '',
    message_text: ''
  })

  const fetchTemplates = useCallback(async () => {
    if (!appUser?.company_id) return
    setIsLoading(true)
    try {
      const { data, error } = await supabase
        .from('crm_message_templates')
        .select('*')
        .eq('company_id', appUser.company_id)
        .order('created_at', { ascending: true })

      if (error) throw error
      setTemplates(data || [])
    } catch (err: any) {
      toast.error(`Failed to load templates: ${err.message}`)
    } finally {
      setIsLoading(false)
    }
  }, [appUser])

  useEffect(() => {
    fetchTemplates()
  }, [fetchTemplates])

  const handleOpenModal = (template?: MessageTemplate) => {
    if (template) {
      setForm(template)
    } else {
      setForm({
        category: activeTab,
        label: '',
        message_text: ''
      })
    }
    setIsModalOpen(true)
  }

  const handleSave = async () => {
    if (!appUser?.company_id) return
    if (!form.label || !form.message_text) {
      return toast.error("Label and Message Text are required.")
    }

    setIsSaving(true)
    try {
      // Generate a snake_case template_id from the label if it's new
      const templateId = form.template_id || form.label.toLowerCase().replace(/[^a-z0-9]+/g, '_')

      const payload = {
        company_id: appUser.company_id,
        category: form.category,
        template_id: templateId,
        label: form.label,
        message_text: form.message_text,
        is_active: true,
        updated_at: new Date().toISOString()
      }

      if (form.id) {
        // Update existing
        const { error } = await supabase
          .from('crm_message_templates')
          .update(payload)
          .eq('id', form.id)
        if (error) throw error
        toast.success("Template updated successfully!")
      } else {
        // Insert new
        const { error } = await supabase
          .from('crm_message_templates')
          .insert([payload])
        if (error) throw error
        toast.success("New template created!")
      }

      setIsModalOpen(false)
      fetchTemplates()
    } catch (err: any) {
      toast.error(`Error saving template: ${err.message}`)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this template?")) return
    
    try {
      const { error } = await supabase
        .from('crm_message_templates')
        .delete()
        .eq('id', id)
        
      if (error) throw error
      toast.success("Template deleted.")
      fetchTemplates()
    } catch (err: any) {
      toast.error(`Failed to delete: ${err.message}`)
    }
  }

  const renderTemplateList = (category: TemplateCategory) => {
    const filtered = templates.filter(t => t.category === category)

    if (isLoading) {
      return (
        <div className="space-y-4 mt-4">
          {[1, 2, 3].map(i => <div key={i} className="h-24 bg-gray-100 animate-pulse rounded-xl" />)}
        </div>
      )
    }

    if (filtered.length === 0) {
      return (
        <div className="text-center py-16 bg-white border border-gray-200 rounded-2xl mt-4 shadow-sm">
          <MessageCircle className="w-10 h-10 mx-auto text-gray-300 mb-3" />
          <p className="text-sm font-semibold text-gray-500">No templates found for {category}.</p>
          <Button variant="link" className="text-indigo-600 mt-2" onClick={() => handleOpenModal()}>
            Create your first one
          </Button>
        </div>
      )
    }

    return (
      <div className="grid gap-4 mt-4">
        {filtered.map(template => (
          <Card key={template.id} className="shadow-sm border-gray-200 rounded-2xl overflow-hidden group hover:border-indigo-200 transition-colors">
            <CardContent className="p-5 flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-gray-900 text-sm">{template.label}</h3>
                  <Badge variant="secondary" className="text-[9px] uppercase tracking-widest font-mono bg-gray-100 text-gray-500">
                    {template.template_id}
                  </Badge>
                </div>
                <p className="text-xs text-gray-600 leading-relaxed bg-gray-50 p-3 rounded-lg border border-gray-100">
                  {template.message_text}
                </p>
              </div>
              
              <div className="flex items-center gap-2 shrink-0 w-full md:w-auto justify-end">
                <Button variant="outline" size="sm" className="h-8 border-gray-200 text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg" onClick={() => handleOpenModal(template)}>
                  <Edit2 className="w-3.5 h-3.5 mr-1.5" /> Edit
                </Button>
                <Button variant="outline" size="sm" className="h-8 border-gray-200 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg" onClick={() => handleDelete(template.id)}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen bg-[#fafafa] font-sans">
      
      {/* HEADER */}
      <header className="h-14 bg-white border-b border-gray-200 px-4 sm:px-6 flex items-center sticky top-0 z-40 shadow-sm box-border">
        <div className="w-full max-w-4xl mx-auto flex items-center gap-3">
          <Link href="/crm">
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-gray-100 text-gray-500">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <Separator orientation="vertical" className="h-5 bg-gray-200" />
          <div className="flex items-center gap-2.5">
            <div className="h-7 w-7 bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center rounded-lg text-xs shadow-sm">
              <MessageCircle className="w-3.5 h-3.5" />
            </div>
            <h1 className="text-sm font-bold text-gray-900 tracking-tight leading-none">Campaign Templates</h1>
          </div>
        </div>
      </header>

      <main className="p-4 md:p-8 max-w-4xl w-full mx-auto space-y-6 animate-in fade-in duration-300">
        
        {/* HEADER SECTION */}
        <div className="flex flex-col sm:flex-row justify-between sm:items-end gap-4 bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
          <div className="space-y-1">
            <h2 className="text-xl font-bold tracking-tight text-gray-900">WhatsApp Templates</h2>
            <p className="text-xs font-medium text-gray-500">Manage the pre-written messages used by your sales team to contact leads and members.</p>
          </div>
          <Button className="h-10 px-5 text-xs font-bold uppercase tracking-widest bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-md transition-all active:scale-95" onClick={() => handleOpenModal()}>
            <Plus className="w-4 h-4 mr-2" /> Add Template
          </Button>
        </div>

        {/* TABS */}
        <Tabs defaultValue="Lead" className="w-full" onValueChange={(v) => setActiveTab(v as TemplateCategory)}>
          <TabsList className="bg-gray-200/50 p-1 rounded-xl w-full sm:w-auto flex h-auto">
            <TabsTrigger value="Lead" className="rounded-lg text-xs font-bold py-2 px-4 data-[state=active]:bg-white data-[state=active]:shadow-sm flex-1 sm:flex-none">
              Inquiries / Leads
            </TabsTrigger>
            <TabsTrigger value="Purchased" className="rounded-lg text-xs font-bold py-2 px-4 data-[state=active]:bg-white data-[state=active]:shadow-sm flex-1 sm:flex-none">
              Past Buyers
            </TabsTrigger>
            <TabsTrigger value="Kitty" className="rounded-lg text-xs font-bold py-2 px-4 data-[state=active]:bg-white data-[state=active]:shadow-sm flex-1 sm:flex-none">
              Kitty Members
            </TabsTrigger>
          </TabsList>

          <TabsContent value="Lead" className="outline-none">
            {renderTemplateList('Lead')}
          </TabsContent>
          <TabsContent value="Purchased" className="outline-none">
            {renderTemplateList('Purchased')}
          </TabsContent>
          <TabsContent value="Kitty" className="outline-none">
            {renderTemplateList('Kitty')}
          </TabsContent>
        </Tabs>
      </main>

      {/* ADD/EDIT MODAL */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[500px] p-0 border-none shadow-2xl rounded-2xl bg-white overflow-hidden">
          <DialogHeader className="bg-gray-50 p-6 border-b border-gray-100">
            <DialogTitle className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-indigo-600" />
              {form.id ? 'Edit Template' : 'New Template'}
            </DialogTitle>
            <DialogDescription className="text-xs font-medium text-gray-500 mt-1">
              Use <span className="font-mono font-bold text-indigo-600 bg-indigo-50 px-1 rounded">{`{name}`}</span> to automatically insert the customer's first name.
            </DialogDescription>
          </DialogHeader>

          <div className="p-6 space-y-5">
            <div className="space-y-2">
              <Label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Category</Label>
              <Select value={form.category} onValueChange={(v) => setForm({...form, category: v as TemplateCategory})}>
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
                value={form.label}
                onChange={e => setForm({...form, label: e.target.value})}
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
                value={form.message_text}
                onChange={(e) => setForm({...form, message_text: e.target.value})}
              />
            </div>
          </div>

          <DialogFooter className="bg-gray-50 p-4 border-t border-gray-100 flex-row gap-3">
            <Button variant="outline" className="flex-1 h-11 rounded-xl text-xs font-bold uppercase tracking-widest text-gray-500 border-gray-200 hover:bg-gray-100" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button 
              onClick={handleSave}
              disabled={isSaving}
              className="flex-[2] h-11 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs uppercase tracking-widest shadow-md"
            >
              {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Save Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  )
}