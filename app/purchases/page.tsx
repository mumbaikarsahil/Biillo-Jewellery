"use client"

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { useForm, useWatch, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { 
  Loader2, 
  CheckCircle, 
  Plus, 
  Trash2, 
  FileText, 
  Diamond, 
  Coins, 
  X,
  ChevronRight,
  ArrowLeft,
  RefreshCw,
  LayoutDashboard,
  Database,
  Info,
  CheckCircle2,
  FilePlus,
  Trash
} from 'lucide-react'

import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/hooks/useAuth'
import { useRouter } from 'next/navigation'

// UI Components
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog"

// --- Industry Standard Diamond Constants ---
const DIAMOND_SHAPES = ['Round', 'Oval', 'Princess', 'Emerald', 'Cushion', 'Marquise', 'Pear', 'Radiant', 'Asscher', 'Heart']
const DIAMOND_COLORS = ['D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', 'Fancy Yellow', 'Fancy Pink', 'Fancy Blue', 'Fancy Intense']
const DIAMOND_CLARITIES = ['FL', 'IF', 'VVS1', 'VVS2', 'VS1', 'VS2', 'SI1', 'SI2', 'I1', 'I2', 'I3']

// --- Zod Schemas ---
const invoiceHeaderSchema = z.object({
  supplier_id: z.string().uuid('Select a supplier'),
  warehouse_id: z.string().uuid('Select destination warehouse'),
  invoice_number: z.string().min(1, 'Invoice number is required'),
  invoice_date: z.string().min(1, 'Date is required'),
  currency: z.string().default('INR'), 
  exchange_rate: z.coerce.number().min(0.01).default(1),
  notes: z.string().optional(),
})

const goldItemSchema = z.object({
  batch_number: z.string().min(1, 'Batch # required'),
  purity_karat: z.string().min(1, 'Karat required'),
  purity_percent: z.coerce.number().min(0).max(100),
  weight_g: z.coerce.number().positive(),
  rate_per_g: z.coerce.number().positive(),
  total_amount: z.coerce.number().nonnegative(),
  tax_percent: z.coerce.number().min(0).optional().default(0),
})

const diamondItemSchema = z.object({
  lot_number: z.string().min(1, 'Lot # required'),
  lot_type: z.enum(['packet', 'single_piece']),
  shape: z.string().optional(),
  color: z.string().optional(),
  clarity: z.string().optional(),
  pieces: z.coerce.number().int().positive(),
  weight_cts: z.coerce.number().positive(),
  rate_per_ct: z.coerce.number().positive(),
  total_amount: z.coerce.number().nonnegative(),
  tax_percent: z.coerce.number().min(0).optional().default(0),
})

type InvoiceItem = 
  | ({ type: 'GOLD' } & z.infer<typeof goldItemSchema>)
  | ({ type: 'DIAMOND' } & z.infer<typeof diamondItemSchema>)

export default function PurchaseInvoicePage() {
  const { appUser } = useAuth()
  const router = useRouter()
  
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [warehouses, setWarehouses] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  
  const [isGoldModalOpen, setIsGoldModalOpen] = useState(false)
  const [isDiamondModalOpen, setIsDiamondModalOpen] = useState(false)
  const [customFields, setCustomFields] = useState({ shape: false, color: false, clarity: false })
  const [items, setItems] = useState<InvoiceItem[]>([])

  const headerForm = useForm<z.infer<typeof invoiceHeaderSchema>>({
    resolver: zodResolver(invoiceHeaderSchema),
    defaultValues: { invoice_date: format(new Date(), 'yyyy-MM-dd'), currency: 'INR', exchange_rate: 1 }
  })

  const goldForm = useForm<z.infer<typeof goldItemSchema>>({
    resolver: zodResolver(goldItemSchema),
    defaultValues: { purity_karat: '22K', purity_percent: 91.6, weight_g: 0, rate_per_g: 0, total_amount: 0, tax_percent: 0 }
  })

  const diamondForm = useForm<z.infer<typeof diamondItemSchema>>({
    resolver: zodResolver(diamondItemSchema),
    defaultValues: { lot_type: 'packet', pieces: 1, weight_cts: 0, rate_per_ct: 0, total_amount: 0, tax_percent: 0, shape: '', color: '', clarity: '' }
  })

  useEffect(() => {
    async function init() {
      if (!appUser) return
      const [supRes, warRes] = await Promise.all([
        supabase.from('suppliers').select('id, supplier_name').eq('company_id', appUser.company_id),
        supabase.from('warehouses').select('id, name').eq('company_id', appUser.company_id)
      ])
      if (supRes.data) setSuppliers(supRes.data)
      if (warRes.data) setWarehouses(warRes.data)
      setLoading(false)
    }
    init()
  }, [appUser])

  // --- Auto Calculations ---
  const gWeight = useWatch({ control: goldForm.control, name: 'weight_g' })
  const gRate = useWatch({ control: goldForm.control, name: 'rate_per_g' })
  useEffect(() => {
    const total = (Number(gWeight) || 0) * (Number(gRate) || 0)
    goldForm.setValue('total_amount', parseFloat(total.toFixed(2)))
  }, [gWeight, gRate, goldForm])

  const dWeight = useWatch({ control: diamondForm.control, name: 'weight_cts' })
  const dRate = useWatch({ control: diamondForm.control, name: 'rate_per_ct' })
  useEffect(() => {
    const total = (Number(dWeight) || 0) * (Number(dRate) || 0)
    diamondForm.setValue('total_amount', parseFloat(total.toFixed(2)))
  }, [dWeight, dRate, diamondForm])

  const calculateTotals = () => {
    const subtotal = items.reduce((sum, item) => sum + item.total_amount, 0)
    const totalTax = items.reduce((sum, item) => sum + (item.total_amount * (item.tax_percent / 100)), 0)
    return { subtotal, totalTax, grandTotal: subtotal + totalTax }
  }
  const { subtotal, totalTax, grandTotal } = calculateTotals()

  // --- Handlers ---
  const addGoldItem = (data: z.infer<typeof goldItemSchema>) => {
    setItems([...items, { type: 'GOLD', ...data }])
    goldForm.reset({ purity_karat: '22K', purity_percent: 91.6, weight_g: 0, rate_per_g: 0, total_amount: 0, tax_percent: 0 })
    setIsGoldModalOpen(false)
    toast.success('Gold batch added')
  }

  const addDiamondItem = (data: z.infer<typeof diamondItemSchema>) => {
    setItems([...items, { type: 'DIAMOND', ...data }])
    diamondForm.reset({ lot_type: 'packet', pieces: 1, weight_cts: 0, rate_per_ct: 0, total_amount: 0, tax_percent: 0, shape: '', color: '', clarity: '' })
    setCustomFields({ shape: false, color: false, clarity: false })
    setIsDiamondModalOpen(false)
    toast.success('Diamond lot added')
  }

  const removeItem = (index: number) => {
    const newItems = [...items]
    newItems.splice(index, 1)
    setItems(newItems)
  }

  const handleSaveInvoice = async (action: 'save_draft' | 'save_and_post') => {
    if (!appUser) return toast.error('Unauthorized')
    setSaving(true)
    try {
      const headerValid = await headerForm.trigger()
      if (!headerValid || items.length === 0) {
        toast.error(items.length === 0 ? 'Add at least one item' : 'Verify invoice details')
        setSaving(false)
        return 
      }
      const headerValues = headerForm.getValues()
      const payload = {
        header: { ...headerValues, subtotal, total_tax: totalTax, grand_total: grandTotal },
        items: items.map(item => ({
          ...item,
          quantity: item.type === 'GOLD' ? item.weight_g : item.weight_cts,
          rate: item.type === 'GOLD' ? item.rate_per_g : item.rate_per_ct,
          amount: item.total_amount,
          description: item.type === 'GOLD' ? `${item.purity_karat} Gold Batch` : `Diamond ${item.shape || 'Lot'}`
        }))
      }
      const { error: saveError } = await supabase.rpc(
        'save_purchase_invoice_complete', { 
          _payload: payload, 
          _user_id: appUser.user_id,
          _action: action === 'save_and_post' ? 'post' : 'draft' 
        }
      )
      if (saveError) throw saveError
      toast.success(action === 'save_and_post' ? 'Invoice Posted & Inventory Created!' : 'Draft Saved Successfully')
      headerForm.reset({ invoice_date: format(new Date(), 'yyyy-MM-dd'), currency: 'INR', exchange_rate: 1, invoice_number: '', supplier_id: '', warehouse_id: '' })
      setItems([]) 
    } catch (err: any) {
      toast.error(err.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  // --- SKELETON LOADER ---
  const PageSkeleton = () => (
    <div className="p-8 space-y-8 max-w-7xl mx-auto">
      <div className="flex justify-between items-center">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="flex gap-3">
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-10 w-32" />
        </div>
      </div>
      <Skeleton className="h-48 w-full rounded-xl" />
      <div className="space-y-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    </div>
  )

  if (loading) return <PageSkeleton />

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* --- COMPACT IDE HEADER --- */}
      <header className="sticky top-0 z-40 w-full bg-background border-b border-border px-4 h-12 flex items-center justify-between">
        <div className="flex items-center gap-3 overflow-hidden">
          <Link href="/purchases">
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-md hover:bg-secondary">
              <ArrowLeft className="h-4 w-4 text-muted-foreground" />
            </Button>
          </Link>
          <Separator orientation="vertical" className="h-4" />
          <nav className="flex items-center gap-1.5 text-sm whitespace-nowrap overflow-hidden">
            <span className="text-muted-foreground font-medium">Purchases</span>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="font-semibold text-foreground">New Invoice</span>
            <div className="ml-3 hidden md:flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-blue-50 border border-blue-100">
              <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
              <span className="text-[10px] font-bold text-blue-600 uppercase">Input Mode</span>
            </div>
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="h-8 px-2 text-xs font-medium text-muted-foreground" onClick={() => headerForm.reset()}>
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Reset
          </Button>
          <Separator orientation="vertical" className="h-4 mx-1" />
          <Button variant="outline" size="sm" className="h-8 text-xs font-semibold px-3 border-border hidden sm:flex">
            <Database className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" /> Registry
          </Button>
        </div>
      </header>

      <main className="p-4 md:p-8 max-w-[1400px] w-full mx-auto space-y-8 animate-in fade-in duration-500">
        
        {/* HEADER ACTIONS */}
        <div className="flex flex-col md:flex-row justify-between md:items-start gap-6">
           <div className="space-y-1">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">Draft Purchase Record</h1>
              <p className="text-sm text-muted-foreground">Synchronize physical intake with digital inventory and financial ledgers.</p>
           </div>
           <div className="flex items-center gap-3 w-full md:w-auto">
              <Button variant="outline" className="flex-1 md:flex-none h-10 text-xs font-bold uppercase tracking-tight" onClick={() => handleSaveInvoice('save_draft')} disabled={saving}>
                Save Draft
              </Button>
              <Button className="flex-1 md:flex-none h-10 text-xs font-bold uppercase tracking-tight shadow-md bg-foreground text-background hover:bg-foreground/90" onClick={() => handleSaveInvoice('save_and_post')} disabled={saving}>
                {saving ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                Confirm & Post
              </Button>
           </div>
        </div>

        {/* DOCUMENT METADATA */}
        <Card className="shadow-none border-border/60 bg-card overflow-hidden">
          <CardHeader className="bg-secondary/30 py-3 px-4 border-b">
             <h3 className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                <FileText className="h-3.5 w-3.5" /> Header Context
             </h3>
          </CardHeader>
          <CardContent className="p-6">
            <form className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold text-muted-foreground uppercase">Supplier Entity</Label>
                <Controller
                  control={headerForm.control}
                  name="supplier_id"
                  render={({ field, fieldState }) => (
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger className={`h-9 text-xs border-border bg-muted/20 ${fieldState.error ? 'border-red-500' : ''}`}>
                        <SelectValue placeholder="Identify Supplier..." />
                      </SelectTrigger>
                      <SelectContent>
                        {suppliers.map(s => <SelectItem key={s.id} value={s.id} className="text-xs">{s.supplier_name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold text-muted-foreground uppercase">Vault Destination</Label>
                <Controller
                  control={headerForm.control}
                  name="warehouse_id"
                  render={({ field, fieldState }) => (
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger className={`h-9 text-xs border-border bg-muted/20 ${fieldState.error ? 'border-red-500' : ''}`}>
                        <SelectValue placeholder="Assign Warehouse..." />
                      </SelectTrigger>
                      <SelectContent>
                        {warehouses.map(w => <SelectItem key={w.id} value={w.id} className="text-xs">{w.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold text-muted-foreground uppercase">Invoice ID</Label>
                <Input 
                  className="h-9 text-xs border-border bg-muted/20 font-mono uppercase" 
                  placeholder="INV-XXXXX" 
                  {...headerForm.register('invoice_number')} 
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold text-muted-foreground uppercase">Issuance Date</Label>
                <Input 
                  className="h-9 text-xs border-border bg-muted/20" 
                  type="date" 
                  {...headerForm.register('invoice_date')} 
                />
              </div>
            </form>
          </CardContent>
        </Card>

        {/* OPERATIONS RIBBON */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
           <div className="flex items-center gap-2">
              <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Line Registry ({items.length})</h2>
           </div>
           <div className="flex items-center gap-2 w-full sm:w-auto">
              <Dialog open={isGoldModalOpen} onOpenChange={setIsGoldModalOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="flex-1 sm:flex-none h-9 text-[11px] font-bold uppercase border-amber-200/50 text-amber-700 bg-amber-500/5 hover:bg-amber-50">
                    <Coins className="mr-2 h-3.5 w-3.5" /> Ingest Gold
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[450px] p-0 overflow-hidden border-none shadow-2xl">
                  <DialogHeader className="bg-amber-50 p-6 border-b border-amber-100">
                    <DialogTitle className="text-amber-900 font-bold">Gold Batch Acquisition</DialogTitle>
                    <DialogDescription className="text-amber-700/70 text-xs">Define purity and mass metrics for metal stock.</DialogDescription>
                  </DialogHeader>
                  <div className="p-6 grid grid-cols-2 gap-4">
                    <div className="space-y-1.5"><Label className="text-[10px] font-bold uppercase">Batch Ref</Label><Input className="h-9 text-xs" {...goldForm.register('batch_number')} /></div>
                    <div className="space-y-1.5"><Label className="text-[10px] font-bold uppercase">Karatage</Label>
                      <Select onValueChange={(v) => { goldForm.setValue('purity_karat', v); const p = v==='24K'?99.9:v==='22K'?91.6:v==='18K'?75.0:58.3; goldForm.setValue('purity_percent', p); }} defaultValue="22K">
                        <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="24K" className="text-xs">24K (99.9%)</SelectItem><SelectItem value="22K" className="text-xs">22K (91.6%)</SelectItem><SelectItem value="18K" className="text-xs">18K (75.0%)</SelectItem></SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5"><Label className="text-[10px] font-bold uppercase">Mass (g)</Label><Input type="number" className="h-9 text-xs" {...goldForm.register('weight_g')} /></div>
                    <div className="space-y-1.5"><Label className="text-[10px] font-bold uppercase">Rate (₹/g)</Label><Input type="number" className="h-9 text-xs font-bold" {...goldForm.register('rate_per_g')} /></div>
                    <div className="col-span-2 p-3 bg-secondary/50 rounded-lg border border-border flex justify-between items-center">
                       <span className="text-[10px] font-bold uppercase text-muted-foreground">Calculated Value</span>
                       <span className="text-sm font-black">₹{goldForm.getValues('total_amount').toLocaleString()}</span>
                    </div>
                  </div>
                  <DialogFooter className="bg-amber-50 p-4 border-t border-amber-100">
                    <Button type="button" variant="ghost" className="text-xs font-bold uppercase" onClick={() => setIsGoldModalOpen(false)}>Cancel</Button>
                    <Button type="button" onClick={goldForm.handleSubmit(addGoldItem)} className="text-xs font-bold uppercase px-8 bg-amber-600 hover:bg-amber-700">Add to Ledger</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <Dialog open={isDiamondModalOpen} onOpenChange={setIsDiamondModalOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="flex-1 sm:flex-none h-9 text-[11px] font-bold uppercase border-blue-200/50 text-blue-700 bg-blue-500/5 hover:bg-blue-50">
                    <Diamond className="mr-2 h-3.5 w-3.5" /> Ingest Diamond
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[550px] p-0 overflow-hidden border-none shadow-2xl">
                   <DialogHeader className="bg-blue-50 p-6 border-b border-blue-100">
                    <DialogTitle className="text-blue-900 font-bold">Stone Lot Acquisition</DialogTitle>
                    <DialogDescription className="text-blue-700/70 text-xs">Register technical specs for precious stone inventory.</DialogDescription>
                  </DialogHeader>
                  <div className="p-6 grid grid-cols-3 gap-4">
                    <div className="col-span-2 space-y-1.5"><Label className="text-[10px] font-bold uppercase">Lot/Cert ID</Label><Input className="h-9 text-xs font-mono" {...diamondForm.register('lot_number')} /></div>
                    <div className="space-y-1.5"><Label className="text-[10px] font-bold uppercase">Mode</Label>
                      <Select onValueChange={(v:any) => diamondForm.setValue('lot_type', v)} defaultValue="packet">
                        <SelectTrigger className="h-9 text-xs uppercase font-bold"><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="packet" className="text-xs">Packet</SelectItem><SelectItem value="single_piece" className="text-xs">Single</SelectItem></SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5"><Label className="text-[10px] font-bold uppercase text-muted-foreground">Shape</Label>
                       <Controller control={diamondForm.control} name="shape" render={({ field }) => (
                         <Select onValueChange={field.onChange} value={field.value}><SelectTrigger className="h-9 text-xs"><SelectValue placeholder="..." /></SelectTrigger>
                         <SelectContent>{DIAMOND_SHAPES.map(s => <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>)}</SelectContent></Select>
                       )}/>
                    </div>
                    <div className="space-y-1.5"><Label className="text-[10px] font-bold uppercase">Carats</Label><Input type="number" className="h-9 text-xs font-bold" {...diamondForm.register('weight_cts')} /></div>
                    <div className="space-y-1.5"><Label className="text-[10px] font-bold uppercase">Units (pcs)</Label><Input type="number" className="h-9 text-xs" {...diamondForm.register('pieces')} /></div>
                    <div className="col-span-3 p-4 bg-blue-50/50 rounded-lg border border-blue-100 flex justify-between items-center mt-2">
                       <div className="space-y-1">
                          <p className="text-[9px] font-bold uppercase text-blue-400 leading-none">Net Acquisition Cost</p>
                          <p className="text-lg font-black text-blue-900">₹{diamondForm.getValues('total_amount').toLocaleString()}</p>
                       </div>
                       <div className="w-32"><Label className="text-[10px] font-bold uppercase text-blue-400">Rate/Ct</Label><Input type="number" className="h-8 text-xs font-bold bg-white" {...diamondForm.register('rate_per_ct')} /></div>
                    </div>
                  </div>
                  <DialogFooter className="bg-blue-50 p-4 border-t border-blue-100">
                    <Button type="button" variant="ghost" className="text-xs font-bold uppercase" onClick={() => setIsDiamondModalOpen(false)}>Cancel</Button>
                    <Button type="button" onClick={diamondForm.handleSubmit(addDiamondItem)} className="text-xs font-bold uppercase px-8 bg-blue-600 hover:bg-blue-700">Add to Ledger</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
           </div>
        </div>

        {/* LINE ITEMS TABLE */}
        <Card className="shadow-none border-border/60 bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-secondary/30">
                <TableRow>
                  <TableHead className="text-[10px] font-black uppercase text-muted-foreground h-10 px-6">Asset Type</TableHead>
                  <TableHead className="text-[10px] font-black uppercase text-muted-foreground h-10">Identifier</TableHead>
                  <TableHead className="text-[10px] font-black uppercase text-muted-foreground h-10 text-right">Mass</TableHead>
                  <TableHead className="text-[10px] font-black uppercase text-muted-foreground h-10 text-right">Unit Rate</TableHead>
                  <TableHead className="text-[10px] font-black uppercase text-muted-foreground h-10 text-right">Net Amount</TableHead>
                  <TableHead className="text-[10px] font-black uppercase text-muted-foreground h-10 text-center">Tax</TableHead>
                  <TableHead className="w-[80px] h-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-48 text-center bg-muted/5">
                       <div className="flex flex-col items-center gap-2">
                          <FilePlus className="h-8 w-8 text-muted-foreground/30" />
                          <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Awaiting Line Item Input</p>
                       </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((item, idx) => (
                    <TableRow key={idx} className="hover:bg-secondary/20 transition-colors border-b last:border-0">
                      <TableCell className="px-6 py-3">
                        <div className="flex items-center gap-2">
                          {item.type === 'GOLD' ? <Coins className="h-3.5 w-3.5 text-amber-500" /> : <Diamond className="h-3.5 w-3.5 text-blue-500" />}
                          <span className="text-xs font-bold uppercase tracking-tight text-foreground">{item.type}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                           <span className="text-[13px] font-bold text-foreground">{'batch_number' in item ? item.batch_number : item.lot_number}</span>
                           <span className="text-[10px] text-muted-foreground font-medium">{'purity_karat' in item ? item.purity_karat : item.shape}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                         <span className="text-[13px] font-bold">{'weight_g' in item ? `${item.weight_g}g` : `${item.weight_cts}ct`}</span>
                      </TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground">
                         ₹{'rate_per_g' in item ? item.rate_per_g?.toLocaleString() : item.rate_per_ct?.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                         <span className="text-[13px] font-black text-foreground">₹{item.total_amount.toLocaleString()}</span>
                      </TableCell>
                      <TableCell className="text-center">
                         <Badge variant="outline" className="text-[9px] font-bold bg-muted/20 border-border">{item.tax_percent}%</Badge>
                      </TableCell>
                      <TableCell className="px-6 text-right">
                         <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-red-600" onClick={() => removeItem(idx)}>
                           <Trash className="h-4 w-4" />
                         </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* FINANCIAL FOOTER */}
          {items.length > 0 && (
            <div className="bg-secondary/10 border-t p-8 flex flex-col md:flex-row md:justify-end gap-6">
               <div className="w-full md:w-80 space-y-3">
                  <div className="flex justify-between items-center text-xs font-medium text-muted-foreground uppercase tracking-widest">
                     <span>Subtotal</span>
                     <span className="text-foreground font-bold">₹{subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                  {totalTax > 0 && (
                    <div className="flex justify-between items-center text-xs font-medium text-muted-foreground uppercase tracking-widest">
                       <span>Total Tax</span>
                       <span className="text-foreground font-bold">₹{totalTax.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                  )}
                  <Separator className="bg-border" />
                  <div className="flex justify-between items-center">
                     <span className="text-[10px] font-black uppercase text-primary tracking-[0.2em]">Grand Ledger Total</span>
                     <span className="text-2xl font-black tracking-tighter">₹{grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
               </div>
            </div>
          )}
        </Card>

        {/* SYSTEM HINT */}
        <div className="flex items-start gap-3 px-4 py-3 rounded-lg bg-blue-50/30 border border-blue-100/50">
          <Info className="h-4 w-4 text-blue-500 mt-0.5" />
          <p className="text-[11px] text-blue-700/80 font-medium uppercase tracking-tight">
            Asset ingestion via Purchase Invoices automatically creates <span className="text-blue-900 font-bold italic underline">Un-Barcoded stock Lots</span> in the master inventory. Tagging and individual serialization occur during the barcoding process.
          </p>
        </div>

      </main>
    </div>
  )
}