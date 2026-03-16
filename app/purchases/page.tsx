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
  CheckCircle2, 
  Plus, 
  FileText, 
  Diamond, 
  Coins, 
  X,
  ChevronRight,
  ArrowLeft,
  RefreshCw,
  Database,
  Info,
  FilePlus,
  Trash
} from 'lucide-react'

import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/hooks/useAuth'
import { useRouter } from 'next/navigation'

// UI Components
import { Card, CardContent, CardHeader } from '@/components/ui/card'
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

// --- Industry Standard Constants ---
const STONE_TYPES = ['DIAMOND', 'RUBY', 'SAPPHIRE', 'EMERALD', 'PEARL', 'MOISSANITE', 'CUBIC ZIRCONIA']
const DIAMOND_SHAPES = ['Round', 'Oval', 'Princess', 'Emerald', 'Cushion', 'Marquise', 'Pear', 'Radiant', 'Asscher', 'Heart']
const DIAMOND_COLORS = ['D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', 'Fancy Yellow', 'Fancy Pink', 'Fancy Blue']
const DIAMOND_CLARITIES = ['FL', 'IF', 'VVS1', 'VVS2', 'VS1', 'VS2', 'SI1', 'SI2', 'I1', 'I2', 'I3']
const SIEVE_SIZES = ['-2', '+2-6', '+6-11', '+11-14', 'Stars', 'Melee', 'Pointers', 'Solitaires', 'Mixed']
const CERT_AGENCIES = ['GIA', 'IGI', 'HRD', 'SGL', 'None']

// --- Zod Schemas ---
const invoiceHeaderSchema = z.object({
  supplier_id: z.string().uuid('Select a supplier'),
  warehouse_id: z.string().uuid('Select destination warehouse'),
  invoice_number: z.string().min(1, 'Invoice number is required'),
  invoice_date: z.string().min(1, 'Date is required'),
  supplier_gstin: z.string().optional(), // <-- NEW: Added GSTIN to Schema
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
  stone_type: z.string().default('DIAMOND'),
  shape: z.string().optional(),
  color: z.string().optional(),
  clarity: z.string().optional(),
  sieve_size: z.string().optional(),
  certificate_number: z.string().optional(),
  certificate_agency: z.string().optional(),
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
  const [items, setItems] = useState<InvoiceItem[]>([])

  const [customFields, setCustomFields] = useState<Record<string, boolean>>({
    stone_type: false, shape: false, color: false, clarity: false, sieve_size: false, certificate_agency: false
  })

  const headerForm = useForm<z.infer<typeof invoiceHeaderSchema>>({
    resolver: zodResolver(invoiceHeaderSchema),
    defaultValues: { invoice_date: format(new Date(), 'yyyy-MM-dd'), currency: 'INR', exchange_rate: 1, supplier_gstin: '' }
  })

  type GoldFormValues = z.infer<typeof goldItemSchema>
  type DiamondFormValues = z.infer<typeof diamondItemSchema>

  const goldForm = useForm<GoldFormValues>({
    resolver: zodResolver(goldItemSchema),
    defaultValues: { 
      batch_number: '', 
      purity_karat: '22K', 
      purity_percent: 91.6, 
      weight_g: '' as unknown as number, 
      rate_per_g: '' as unknown as number, 
      total_amount: 0, 
      tax_percent: 3 
    }
  })

  const diamondForm = useForm<DiamondFormValues>({
    resolver: zodResolver(diamondItemSchema),
    defaultValues: { 
      lot_number: '', 
      lot_type: 'packet', 
      stone_type: 'DIAMOND', 
      pieces: '' as unknown as number, 
      weight_cts: '' as unknown as number, 
      rate_per_ct: '' as unknown as number, 
      total_amount: 0, 
      tax_percent: 1.5, 
      shape: '', 
      color: '', 
      clarity: '', 
      sieve_size: '', 
      certificate_agency: '', 
      certificate_number: '' 
    }
  })

  useEffect(() => {
    async function init() {
      if (!appUser) return
      const [supRes, warRes] = await Promise.all([
        // <-- NEW: Added `gstin` to the select query (Change 'gstin' if your column is named 'gst_number')
        supabase.from('suppliers').select('id, supplier_name, gstin').eq('company_id', appUser.company_id),
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
  const dLotType = useWatch({ control: diamondForm.control, name: 'lot_type' })
  useEffect(() => {
    const total = (Number(dWeight) || 0) * (Number(dRate) || 0)
    diamondForm.setValue('total_amount', parseFloat(total.toFixed(2)))
    if (dLotType === 'single_piece') diamondForm.setValue('pieces', 1)
  }, [dWeight, dRate, dLotType, diamondForm])

  const calculateTotals = () => {
    const subtotal = items.reduce((sum, item) => sum + item.total_amount, 0)
    const totalTax = items.reduce((sum, item) => sum + (item.total_amount * (item.tax_percent / 100)), 0)
    return { subtotal, totalTax, grandTotal: subtotal + totalTax }
  }
  const { subtotal, totalTax, grandTotal } = calculateTotals()

  // --- Handlers ---
  const addGoldItem = (data: GoldFormValues) => {
    setItems([...items, { type: 'GOLD', ...data }])
    goldForm.reset({ 
      batch_number: '',
      purity_karat: '22K', 
      purity_percent: 91.6, 
      weight_g: '' as unknown as number, 
      rate_per_g: '' as unknown as number, 
      total_amount: 0, 
      tax_percent: 3 
    })
    setIsGoldModalOpen(false)
    toast.success('Gold batch added')
  }

  const addDiamondItem = (data: DiamondFormValues) => {
    setItems([...items, { type: 'DIAMOND', ...data }])
    diamondForm.reset({ 
      lot_number: '',
      lot_type: 'packet', 
      stone_type: 'DIAMOND', 
      pieces: '' as unknown as number, 
      weight_cts: '' as unknown as number, 
      rate_per_ct: '' as unknown as number, 
      total_amount: 0, 
      tax_percent: 1.5, 
      shape: '', 
      color: '', 
      clarity: '', 
      sieve_size: '', 
      certificate_agency: '', 
      certificate_number: '' 
    })
    setCustomFields({ stone_type: false, shape: false, color: false, clarity: false, sieve_size: false, certificate_agency: false })
    setIsDiamondModalOpen(false)
    toast.success('Stone lot added')
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
      
      // Update supplier's GSTIN if they typed a new one in
      if (headerValues.supplier_gstin && headerValues.supplier_gstin.trim() !== '') {
        await supabase
          .from('suppliers')
          .update({ gstin: headerValues.supplier_gstin.toUpperCase() })
          .eq('id', headerValues.supplier_id)
      }

      const payload = {
        header: { ...headerValues, subtotal, total_tax: totalTax, grand_total: grandTotal },
        items: items.map(item => ({
          ...item,
          quantity: item.type === 'GOLD' ? item.weight_g : item.weight_cts,
          rate: item.type === 'GOLD' ? item.rate_per_g : item.rate_per_ct,
          amount: item.total_amount,
          description: item.type === 'GOLD' ? `${item.purity_karat} Gold Batch` : `${item.stone_type} ${item.shape || 'Lot'}`
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
      headerForm.reset({ invoice_date: format(new Date(), 'yyyy-MM-dd'), currency: 'INR', exchange_rate: 1, invoice_number: '', supplier_id: '', warehouse_id: '', supplier_gstin: '' })
      setItems([]) 
    } catch (err: any) {
      toast.error(err.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const HybridSelect = ({ name, label, options, placeholder = "Select..." }: { name: string, label: string, options: string[], placeholder?: string }) => {
    const isCustom = customFields[name]
    return (
      <div className="space-y-1.5">
        <Label className="text-[10px] font-bold text-muted-foreground uppercase">{label}</Label>
        {isCustom ? (
          <div className="flex relative items-center">
            <Input className="h-9 text-xs pr-8 bg-background border-primary/40 focus-visible:ring-primary shadow-sm" {...diamondForm.register(name as any)} autoFocus placeholder={`Custom ${label}...`} />
            <Button type="button" variant="ghost" size="icon" className="absolute right-0 h-8 w-8 text-muted-foreground hover:text-red-500"
              onClick={() => { setCustomFields(p => ({...p, [name]: false})); diamondForm.setValue(name as any, ''); }}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <Controller
            control={diamondForm.control}
            name={name as any}
            render={({ field }) => (
              <Select onValueChange={(v) => {
                if (v === 'CUSTOM') { setCustomFields(p => ({...p, [name]: true})); diamondForm.setValue(name as any, ''); } 
                else { field.onChange(v); }
              }} value={field.value || ''}>
                <SelectTrigger className="h-9 text-xs bg-background"><SelectValue placeholder={placeholder} /></SelectTrigger>
                <SelectContent>
                  {options.map(o => <SelectItem key={o} value={o} className="text-xs">{o}</SelectItem>)}
                  <Separator className="my-1"/>
                  <SelectItem value="CUSTOM" className="text-xs text-primary font-bold"><Plus className="w-3 h-3 inline mr-1"/> Add Custom...</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
        )}
      </div>
    )
  }

  const PageSkeleton = () => (
    <div className="p-4 sm:p-8 space-y-8 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="space-y-2"><Skeleton className="h-8 w-48 sm:w-64" /><Skeleton className="h-4 w-64 sm:w-96" /></div>
        <div className="flex w-full sm:w-auto gap-3"><Skeleton className="h-10 flex-1 sm:w-24" /><Skeleton className="h-10 flex-1 sm:w-32" /></div>
      </div>
      <Skeleton className="h-48 w-full rounded-xl" />
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  )

  if (loading) return <PageSkeleton />

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* HEADER */}
      <header className="sticky top-0 z-40 w-full bg-background border-b border-border px-2 sm:px-4 h-12 flex items-center justify-between">
        <div className="flex items-center gap-2 sm:gap-3">
          <Link href="/purchases">
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-md hover:bg-secondary"><ArrowLeft className="h-4 w-4" /></Button>
          </Link>
          <Separator orientation="vertical" className="h-4" />
          <nav className="flex items-center gap-1 sm:gap-1.5 text-xs sm:text-sm whitespace-nowrap">
            <span className="text-muted-foreground font-medium">Purchases</span>
            <ChevronRight className="h-3 sm:h-3.5 w-3 sm:w-3.5 text-muted-foreground" />
            <span className="font-semibold text-foreground">New Invoice Intake</span>
          </nav>
        </div>
      </header>

      <main className="p-4 md:p-8 max-w-[1400px] w-full mx-auto space-y-6 animate-in fade-in duration-500">
        
        {/* ACTION BAR */}
        <div className="flex flex-col md:flex-row justify-between md:items-end gap-4 sm:gap-6">
           <div className="space-y-1 text-center md:text-left">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">Draft Purchase Record</h1>
              <p className="text-xs sm:text-sm text-muted-foreground">Synchronize physical intake with digital inventory and financial ledgers.</p>
           </div>
           <div className="flex items-stretch sm:items-center flex-row gap-2 sm:gap-3 w-full md:w-auto">
              <Button variant="outline" className="flex-1 sm:flex-none h-10 text-xs font-bold uppercase" onClick={() => handleSaveInvoice('save_draft')} disabled={saving}>Save Draft</Button>
              <Button className="flex-1 sm:flex-none h-10 text-xs font-bold uppercase shadow-md bg-foreground text-background hover:bg-foreground/90" onClick={() => handleSaveInvoice('save_and_post')} disabled={saving}>
                {saving ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <CheckCircle2 className="mr-2 h-4 w-4" />} Confirm & Post
              </Button>
           </div>
        </div>

        {/* DOCUMENT METADATA */}
        <Card className="shadow-none border-border/60">
          <CardHeader className="bg-secondary/30 py-3 px-4 border-b">
             <h3 className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                <FileText className="h-3.5 w-3.5" /> Header Context
             </h3>
          </CardHeader>
          <CardContent className="p-4 sm:p-6">
            <form className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 sm:gap-6">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold text-muted-foreground uppercase">Supplier Entity</Label>
                <Controller control={headerForm.control} name="supplier_id" render={({ field, fieldState }) => (
                    <Select 
                      onValueChange={(val) => {
                        field.onChange(val);
                        // <-- NEW: Auto-fill GSTIN when supplier is selected
                        const selectedSup = suppliers.find(s => s.id === val);
                        if (selectedSup) {
                          headerForm.setValue('supplier_gstin', selectedSup.gstin || '');
                        }
                      }} 
                      value={field.value}
                    >
                      <SelectTrigger className={`h-9 text-xs border-border bg-muted/20 ${fieldState.error ? 'border-red-500' : ''}`}><SelectValue placeholder="Identify Supplier..." /></SelectTrigger>
                      <SelectContent>{suppliers.map(s => <SelectItem key={s.id} value={s.id} className="text-xs">{s.supplier_name}</SelectItem>)}</SelectContent>
                    </Select>
                  )}
                />
              </div>

              {/* <-- NEW: Supplier GSTIN Input Field --> */}
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold text-muted-foreground uppercase">Supplier GSTIN</Label>
                <Input 
                  className="h-9 text-xs border-border bg-muted/20 uppercase font-mono" 
                  placeholder="27XXXXX0000X1Z5" 
                  {...headerForm.register('supplier_gstin')} 
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold text-muted-foreground uppercase">Vault Destination</Label>
                <Controller control={headerForm.control} name="warehouse_id" render={({ field, fieldState }) => (
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger className={`h-9 text-xs border-border bg-muted/20 ${fieldState.error ? 'border-red-500' : ''}`}><SelectValue placeholder="Assign Warehouse..." /></SelectTrigger>
                      <SelectContent>{warehouses.map(w => <SelectItem key={w.id} value={w.id} className="text-xs">{w.name}</SelectItem>)}</SelectContent>
                    </Select>
                  )}
                />
              </div>
              <div className="space-y-1.5"><Label className="text-[10px] font-bold text-muted-foreground uppercase">Invoice ID</Label><Input className="h-9 text-xs border-border bg-muted/20 font-mono uppercase" placeholder="INV-XXXXX" {...headerForm.register('invoice_number')} /></div>
              <div className="space-y-1.5"><Label className="text-[10px] font-bold text-muted-foreground uppercase">Issuance Date</Label><Input className="h-9 text-xs border-border bg-muted/20" type="date" {...headerForm.register('invoice_date')} /></div>
            </form>
          </CardContent>
        </Card>

        {/* OPERATIONS RIBBON */}
        <div className="flex flex-col sm:flex-row justify-between items-center bg-secondary/20 p-2 sm:p-3 rounded-lg border border-border gap-4">
           <div className="px-3 w-full sm:w-auto text-center sm:text-left">
              <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Line Item Registry ({items.length})</h2>
           </div>
           <div className="grid grid-cols-2 sm:flex sm:flex-row items-center gap-2 w-full sm:w-auto">
              
              {/* --- GOLD INGESTION MODAL --- */}
              <Dialog open={isGoldModalOpen} onOpenChange={setIsGoldModalOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9 px-4 text-[10px] sm:text-xs font-bold uppercase border-border hover:bg-secondary w-full sm:w-auto">
                    <Coins className="mr-1.5 sm:mr-2 h-3.5 w-3.5 text-amber-500" /> Ingest Metal
                  </Button>
                </DialogTrigger>
                <DialogContent className="w-[95vw] sm:max-w-2xl p-0 border-border overflow-hidden">
                  <DialogHeader className="bg-secondary/40 p-4 sm:p-5 border-b">
                    <DialogTitle className="flex items-center gap-2"><Coins className="h-5 w-5 text-amber-500"/> Gold Metal Intake</DialogTitle>
                    <DialogDescription className="text-xs">Register bulk bullion or raw gold into the inventory system.</DialogDescription>
                  </DialogHeader>
                  <div className="p-4 sm:p-6 space-y-6 bg-background max-h-[70vh] overflow-y-auto">
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5"><Label className="text-[10px] font-bold uppercase text-muted-foreground">Ref / Batch ID</Label><Input className="h-9 text-xs bg-muted/20" placeholder="e.g. GB-2026-001" {...goldForm.register('batch_number')} /></div>
                      <div className="space-y-1.5"><Label className="text-[10px] font-bold uppercase text-muted-foreground">Karatage / Purity</Label>
                        <Select onValueChange={(v) => { goldForm.setValue('purity_karat', v); const p = v==='24K'?99.9:v==='22K'?91.6:v==='18K'?75.0:58.3; goldForm.setValue('purity_percent', p); }} defaultValue="22K">
                          <SelectTrigger className="h-9 text-xs bg-muted/20"><SelectValue /></SelectTrigger>
                          <SelectContent><SelectItem value="24K" className="text-xs">24K Fine (99.9%)</SelectItem><SelectItem value="22K" className="text-xs">22K Standard (91.6%)</SelectItem><SelectItem value="18K" className="text-xs">18K Alloy (75.0%)</SelectItem></SelectContent>
                        </Select>
                      </div>
                    </div>

                    <Separator />

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 items-end">
                      <div className="space-y-1.5"><Label className="text-[10px] font-bold uppercase text-muted-foreground">Total Mass (g)</Label><Input type="number" step="0.001" className="h-9 text-xs font-bold bg-muted/20" {...goldForm.register('weight_g')} /></div>
                      <div className="space-y-1.5"><Label className="text-[10px] font-bold uppercase text-muted-foreground">Rate (₹/g)</Label><Input type="number" className="h-9 text-xs bg-muted/20" {...goldForm.register('rate_per_g')} /></div>
                      <div className="space-y-1.5"><Label className="text-[10px] font-bold uppercase text-muted-foreground">Tax (%)</Label><Input type="number" className="h-9 text-xs bg-muted/20" {...goldForm.register('tax_percent')} /></div>
                      
                      {/* Subtotal Display */}
                      <div className="col-span-2 sm:col-span-1 p-2.5 bg-secondary/50 rounded border border-border flex flex-col items-end justify-center h-14 sm:h-16">
                         <span className="text-[9px] font-bold uppercase text-muted-foreground mb-0.5">Value (Excl. Tax)</span>
                         <span className="text-sm font-black">₹{goldForm.getValues('total_amount').toLocaleString()}</span>
                      </div>
                    </div>

                  </div>
                  <DialogFooter className="bg-secondary/20 p-4 border-t flex flex-row gap-2 justify-end">
                    <Button variant="ghost" size="sm" className="text-xs uppercase font-bold" onClick={() => setIsGoldModalOpen(false)}>Cancel</Button>
                    <Button size="sm" className="text-xs uppercase font-bold px-6" onClick={goldForm.handleSubmit((data) => addGoldItem(data))}>Add to Invoice</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              {/* --- DIAMOND INGESTION MODAL --- */}
              <Dialog open={isDiamondModalOpen} onOpenChange={setIsDiamondModalOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9 px-4 text-[10px] sm:text-xs font-bold uppercase border-border hover:bg-secondary w-full sm:w-auto">
                    <Diamond className="mr-1.5 sm:mr-2 h-3.5 w-3.5 text-blue-500" /> Ingest Stone
                  </Button>
                </DialogTrigger>
                <DialogContent className="w-[95vw] sm:max-w-3xl p-0 border-border overflow-hidden">
                   <DialogHeader className="bg-secondary/40 p-4 sm:p-5 border-b">
                    <DialogTitle className="flex items-center gap-2"><Diamond className="h-5 w-5 text-blue-500"/> Stone Lot Registration</DialogTitle>
                    <DialogDescription className="text-xs">Record comprehensive technical metrics for precious stone lots.</DialogDescription>
                  </DialogHeader>
                  <div className="p-4 sm:p-6 space-y-6 bg-background max-h-[70vh] overflow-y-auto">
                    
                    {/* Identification Section */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="space-y-1.5"><Label className="text-[10px] font-bold uppercase text-muted-foreground">Lot / Internal ID *</Label><Input className="h-9 text-xs bg-muted/20 font-mono uppercase" placeholder="e.g. DL-202" {...diamondForm.register('lot_number')} /></div>
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-bold uppercase text-muted-foreground">Classification</Label>
                        <Select onValueChange={(v:any) => diamondForm.setValue('lot_type', v)} defaultValue="packet">
                          <SelectTrigger className="h-9 text-xs bg-muted/20"><SelectValue /></SelectTrigger>
                          <SelectContent><SelectItem value="packet" className="text-xs">Parcel / Packet</SelectItem><SelectItem value="single_piece" className="text-xs">Single Solitaire</SelectItem></SelectContent>
                        </Select>
                      </div>
                      <div>
                        <HybridSelect name="stone_type" label="Stone Type" options={STONE_TYPES} />
                      </div>
                    </div>

                    {/* Technical Specs Section */}
                    <div className="p-4 bg-secondary/10 border border-border rounded-lg space-y-4">
                       <h4 className="text-[10px] font-black uppercase text-muted-foreground tracking-widest border-b pb-2">Gemological Specifications</h4>
                       <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                         <HybridSelect name="shape" label="Shape" options={DIAMOND_SHAPES} />
                         <HybridSelect name="color" label="Color Grade" options={DIAMOND_COLORS} />
                         <HybridSelect name="clarity" label="Clarity" options={DIAMOND_CLARITIES} />
                         <HybridSelect name="sieve_size" label="Sieve / Size" options={SIEVE_SIZES} />
                       </div>
                       <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                         <HybridSelect name="certificate_agency" label="Certifying Agency (Optional)" options={CERT_AGENCIES} placeholder="None" />
                         <div className="space-y-1.5"><Label className="text-[10px] font-bold uppercase text-muted-foreground">Certificate Number</Label><Input className="h-9 text-xs bg-white" placeholder="Report ID..." {...diamondForm.register('certificate_number')} /></div>
                       </div>
                    </div>

                    {/* Financials Section */}
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 items-end">
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-bold uppercase text-muted-foreground">Total Pieces</Label>
                        <Input type="number" min="1" className="h-9 text-xs bg-muted/20" disabled={dLotType === 'single_piece'} {...diamondForm.register('pieces')} />
                      </div>
                      <div className="space-y-1.5"><Label className="text-[10px] font-bold uppercase text-muted-foreground">Total Carats (ct)</Label><Input type="number" step="0.001" className="h-9 text-xs font-bold bg-muted/20" {...diamondForm.register('weight_cts')} /></div>
                      <div className="space-y-1.5"><Label className="text-[10px] font-bold uppercase text-muted-foreground">Rate (₹/ct)</Label><Input type="number" className="h-9 text-xs bg-muted/20" {...diamondForm.register('rate_per_ct')} /></div>
                      <div className="space-y-1.5"><Label className="text-[10px] font-bold uppercase text-muted-foreground">Tax (%)</Label><Input type="number" className="h-9 text-xs bg-muted/20" {...diamondForm.register('tax_percent')} /></div>
                      
                      <div className="col-span-2 sm:col-span-1 p-2.5 bg-secondary/50 rounded border border-border flex flex-col items-end justify-center h-14 sm:h-16">
                         <span className="text-[9px] font-bold uppercase text-muted-foreground mb-0.5">Value (Excl. Tax)</span>
                         <span className="text-sm font-black">₹{diamondForm.getValues('total_amount').toLocaleString()}</span>
                      </div>
                    </div>

                  </div>
                  <DialogFooter className="bg-secondary/20 p-4 border-t flex flex-row gap-2 justify-end">
                    <Button variant="ghost" size="sm" className="text-xs uppercase font-bold" onClick={() => setIsDiamondModalOpen(false)}>Cancel</Button>
                    <Button size="sm" className="text-xs uppercase font-bold px-6" onClick={diamondForm.handleSubmit((data) => addDiamondItem(data))}>Add to Invoice</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
           </div>
        </div>

        {/* LINE ITEMS TABLE */}
        <Card className="shadow-none border-border/60 overflow-hidden">
          <div className="overflow-x-auto min-h-[200px] sm:min-h-[300px]">
            <Table>
              <TableHeader className="bg-secondary/40 sticky top-0">
                <TableRow>
                  <TableHead className="text-[10px] font-black uppercase text-muted-foreground h-10 px-4 sm:px-6">Asset Type</TableHead>
                  <TableHead className="text-[10px] font-black uppercase text-muted-foreground h-10">Identifier & Specs</TableHead>
                  <TableHead className="text-[10px] font-black uppercase text-muted-foreground h-10 text-right">Quantity / Mass</TableHead>
                  <TableHead className="text-[10px] font-black uppercase text-muted-foreground h-10 text-right">Unit Rate</TableHead>
                  <TableHead className="text-[10px] font-black uppercase text-muted-foreground h-10 text-right">Net Amount</TableHead>
                  <TableHead className="text-[10px] font-black uppercase text-muted-foreground h-10 text-center">Tax</TableHead>
                  <TableHead className="w-[50px] sm:w-[60px] h-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-[200px] sm:h-[250px] text-center">
                       <div className="flex flex-col items-center gap-2">
                          <FilePlus className="h-8 w-8 text-muted-foreground/30" />
                          <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Awaiting Line Item Input</p>
                       </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((item, idx) => (
                    <TableRow key={idx} className="hover:bg-secondary/20 transition-colors border-b last:border-0">
                      <TableCell className="px-4 sm:px-6 py-3">
                        <div className="flex items-center gap-1.5 sm:gap-2">
                          {item.type === 'GOLD' ? <Coins className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" /> : <Diamond className="h-3.5 w-3.5 text-blue-500 flex-shrink-0" />}
                          <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-tight text-foreground">{item.type}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col min-w-[120px]">
                           <span className="text-xs sm:text-[13px] font-bold text-foreground">
                             {'batch_number' in item ? item.batch_number : item.lot_number}
                           </span>
                           <span className="text-[9px] sm:text-[10px] text-muted-foreground font-medium flex items-center gap-1 flex-wrap">
                             {'purity_karat' in item ? (
                               <span>{item.purity_karat} ({item.purity_percent}%)</span>
                             ) : (
                               <>
                                 <span>{item.stone_type}</span>
                                 {item.shape && <><Separator orientation="vertical" className="h-2 w-[1px] bg-border"/><span>{item.shape}</span></>}
                                 {item.color && <><Separator orientation="vertical" className="h-2 w-[1px] bg-border"/><span>{item.color} {item.clarity}</span></>}
                                 {item.certificate_number && <><Separator orientation="vertical" className="h-2 w-[1px] bg-border"/><span>Cert: {item.certificate_agency} {item.certificate_number}</span></>}
                               </>
                             )}
                           </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                         <div className="flex flex-col items-end">
                           <span className="text-xs sm:text-[13px] font-bold">{'weight_g' in item ? `${item.weight_g} g` : `${item.weight_cts} ct`}</span>
                           {'pieces' in item && <span className="text-[9px] text-muted-foreground uppercase">{item.pieces} Pcs</span>}
                         </div>
                      </TableCell>
                      <TableCell className="text-right text-xs sm:text-[13px] text-muted-foreground font-medium whitespace-nowrap">
                         ₹{'rate_per_g' in item ? item.rate_per_g?.toLocaleString() : item.rate_per_ct?.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                         <span className="text-xs sm:text-[13px] font-black text-foreground">₹{item.total_amount.toLocaleString()}</span>
                      </TableCell>
                      <TableCell className="text-center">
                         <Badge variant="outline" className="text-[9px] font-bold bg-muted/20 border-border">{item.tax_percent}%</Badge>
                      </TableCell>
                      <TableCell className="px-2 sm:px-4 text-right">
                         <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-red-600 hover:bg-red-50" onClick={() => removeItem(idx)}>
                           <Trash className="h-3.5 w-3.5" />
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
            <div className="bg-secondary/30 border-t p-4 sm:p-6 flex flex-col sm:flex-row sm:justify-end">
               <div className="w-full sm:w-80 space-y-2">
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
                  <Separator className="bg-border/60 my-2" />
                  <div className="flex justify-between items-center">
                     <span className="text-[10px] sm:text-[10px] font-black uppercase text-primary tracking-[0.2em]">Grand Ledger Total</span>
                     <span className="text-lg sm:text-xl font-black tracking-tighter">₹{grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
               </div>
            </div>
          )}
        </Card>

      </main>
    </div>
  )
}