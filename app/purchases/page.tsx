"use client"

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar as CalendarUI } from '@/components/ui/calendar'
import { cn } from '@/lib/utils'
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
  Wand2,
  Trash2,
  Building2,
  MapPin,
  Calendar,
  Hash,
  FileSignature,
  Percent
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

// --- Industry Standard Constants ---
const STONE_TYPES = ['DIAMOND', 'RUBY', 'SAPPHIRE', 'EMERALD', 'PEARL', 'MOISSANITE', 'CUBIC ZIRCONIA']
const DIAMOND_SHAPES = ['Round', 'Oval', 'Princess', 'Emerald', 'Cushion', 'Marquise', 'Pear', 'Radiant', 'Asscher', 'Heart']
const DIAMOND_COLORS = ['D', 'E', 'F', 'G', 'H', 'GH', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', 'Fancy Yellow', 'Fancy Pink', 'Fancy Blue']
const DIAMOND_CLARITIES = ['FL', 'IF', 'VVS', 'VVS1', 'VVS2', 'VS1', 'VS2', 'SI1', 'SI2', 'I1', 'I2', 'I3']
const SIEVE_SIZES = ['-2', '+2-6', '+6-11', '+11-14', 'Stars', 'Melee', 'Pointers', 'Solitaires', 'Mixed']
const CERT_AGENCIES = ['GIA', 'IGI', 'HRD', 'SGL', 'None']

// --- Zod Schemas ---
const invoiceHeaderSchema = z.object({
  supplier_id: z.string().uuid('Select a supplier'),
  warehouse_id: z.string().uuid('Select destination warehouse'),
  invoice_number: z.string().min(1, 'Invoice number is required'),
  invoice_date: z.string().min(1, 'Date is required'),
  supplier_gstin: z.string().optional(),
  currency: z.string().default('INR'), 
  exchange_rate: z.coerce.number().min(0.01).default(1),
  notes: z.string().optional(),
})

const goldItemSchema = z.object({
  batch_number: z.string().min(1, 'Batch # required'),
  purity_karat: z.string().min(1, 'Karat required'),
  purity_percent: z.coerce.number().min(0).max(100),
  weight_g: z.union([z.string(), z.number()]).transform(v => Number(v) || 0),
  rate_per_g: z.union([z.string(), z.number()]).transform(v => Number(v) || 0),
  total_amount: z.coerce.number().nonnegative(),
  tax_percent: z.union([z.string(), z.number()]).transform(v => Number(v) || 0),
  final_amount: z.coerce.number().nonnegative(), // NEW: Editable Final Amount
  hsn_code: z.string().optional(),
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
  pieces: z.union([z.string(), z.number()]).transform(v => Number(v) || 0),
  weight_cts: z.union([z.string(), z.number()]).transform(v => Number(v) || 0),
  rate_per_ct: z.union([z.string(), z.number()]).transform(v => Number(v) || 0),
  total_amount: z.coerce.number().nonnegative(),
  tax_percent: z.union([z.string(), z.number()]).transform(v => Number(v) || 0),
  final_amount: z.coerce.number().nonnegative(), // NEW: Editable Final Amount
  hsn_code: z.string().optional(),
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

  const [customGrandTotal, setCustomGrandTotal] = useState<string>('')

  const [customFields, setCustomFields] = useState<Record<string, boolean>>({
    stone_type: false, shape: false, color: false, clarity: false, sieve_size: false, certificate_agency: false
  })

  const headerForm = useForm<z.infer<typeof invoiceHeaderSchema>>({
    resolver: zodResolver(invoiceHeaderSchema),
    defaultValues: { invoice_date: format(new Date(), 'yyyy-MM-dd'), currency: 'INR', exchange_rate: 1, supplier_gstin: '', notes: '' }
  })

  type GoldFormValues = z.infer<typeof goldItemSchema>
  type DiamondFormValues = z.infer<typeof diamondItemSchema>

  const goldForm = useForm<GoldFormValues>({
    resolver: zodResolver(goldItemSchema),
    defaultValues: { 
      batch_number: '', purity_karat: '22K', purity_percent: 91.6, 
      weight_g: '' as unknown as number, rate_per_g: '' as unknown as number, 
      total_amount: 0, tax_percent: 3, final_amount: 0, hsn_code: '7108'
    }
  })

  const diamondForm = useForm<DiamondFormValues>({
    resolver: zodResolver(diamondItemSchema),
    defaultValues: { 
      lot_number: '', lot_type: 'packet', stone_type: 'DIAMOND', 
      pieces: '' as unknown as number, weight_cts: '' as unknown as number, 
      rate_per_ct: '' as unknown as number, total_amount: 0, tax_percent: 1.5, final_amount: 0,
      shape: '', color: '', clarity: '', sieve_size: '', certificate_agency: '', certificate_number: '', hsn_code: '7102'
    }
  })

  useEffect(() => {
    async function init() {
      if (!appUser) return
      const [supRes, warRes] = await Promise.all([
        supabase.from('suppliers').select('id, supplier_name, gstin').eq('company_id', appUser.company_id),
        supabase.from('warehouses').select('id, name').eq('company_id', appUser.company_id)
      ])
      if (supRes.data) setSuppliers(supRes.data)
      if (warRes.data) setWarehouses(warRes.data)
      setLoading(false)
    }
    init()
  }, [appUser])

  // --- Auto Generate IDs ---
  const generateGoldBatchId = () => {
    const dateStr = format(new Date(), 'yyyyMMdd')
    const random = Math.floor(100 + Math.random() * 900)
    goldForm.setValue('batch_number', `GB-${dateStr}-${random}`)
  }

  const generateDiamondLotId = () => {
    const dateStr = format(new Date(), 'yyyyMMdd')
    const random = Math.floor(100 + Math.random() * 900)
    diamondForm.setValue('lot_number', `DL-${dateStr}-${random}`)
  }

  // ============================================================================
  // BIDIRECTIONAL CALCULATION ENGINE (GOLD & DIAMOND)
  // ============================================================================
  
  // Gold State Extraction
  const gWeight = goldForm.watch('weight_g') || 0;
  const gRate = goldForm.watch('rate_per_g') || 0;
  const gTaxPct = goldForm.watch('tax_percent') || 0;
  const gTaxable = goldForm.watch('total_amount') || 0;
  const gFinal = goldForm.watch('final_amount') || 0;
  
  // Mathematical roundoff calculation
  const gExactTotal = gTaxable + (gTaxable * gTaxPct / 100);
  const gRoundOff = gFinal - gExactTotal;

  const updateGoldCalc = (field: keyof GoldFormValues, val: number) => {
    goldForm.setValue(field, val);
    const w = field === 'weight_g' ? val : (goldForm.getValues('weight_g') || 0);
    const r = field === 'rate_per_g' ? val : (goldForm.getValues('rate_per_g') || 0);
    const t = field === 'tax_percent' ? val : (goldForm.getValues('tax_percent') || 0);
    const taxb = field === 'total_amount' ? val : (goldForm.getValues('total_amount') || 0);
    const fin = field === 'final_amount' ? val : (goldForm.getValues('final_amount') || 0);

    if (field === 'weight_g' || field === 'rate_per_g' || field === 'tax_percent') {
       const newTaxb = w * r;
       goldForm.setValue('total_amount', parseFloat(newTaxb.toFixed(2)));
       goldForm.setValue('final_amount', Math.round(newTaxb * (1 + t/100)));
    } else if (field === 'total_amount') {
       goldForm.setValue('final_amount', Math.round(taxb * (1 + t/100)));
    } else if (field === 'final_amount') {
       const newTaxb = fin / (1 + t/100);
       goldForm.setValue('total_amount', parseFloat(newTaxb.toFixed(2)));
    }
  }

  // Diamond State Extraction
  const dWeight = diamondForm.watch('weight_cts') || 0;
  const dRate = diamondForm.watch('rate_per_ct') || 0;
  const dTaxPct = diamondForm.watch('tax_percent') || 0;
  const dTaxable = diamondForm.watch('total_amount') || 0;
  const dFinal = diamondForm.watch('final_amount') || 0;
  
  // Mathematical roundoff calculation
  const dExactTotal = dTaxable + (dTaxable * dTaxPct / 100);
  const dRoundOff = dFinal - dExactTotal;

  const updateDiamondCalc = (field: keyof DiamondFormValues, val: number) => {
    diamondForm.setValue(field, val);
    if (field === 'lot_type' && val === 'single_piece' as any) diamondForm.setValue('pieces', 1);

    const w = field === 'weight_cts' ? val : (diamondForm.getValues('weight_cts') || 0);
    const r = field === 'rate_per_ct' ? val : (diamondForm.getValues('rate_per_ct') || 0);
    const t = field === 'tax_percent' ? val : (diamondForm.getValues('tax_percent') || 0);
    const taxb = field === 'total_amount' ? val : (diamondForm.getValues('total_amount') || 0);
    const fin = field === 'final_amount' ? val : (diamondForm.getValues('final_amount') || 0);

    if (field === 'weight_cts' || field === 'rate_per_ct' || field === 'tax_percent') {
       const newTaxb = w * r;
       diamondForm.setValue('total_amount', parseFloat(newTaxb.toFixed(2)));
       diamondForm.setValue('final_amount', Math.round(newTaxb * (1 + t/100)));
    } else if (field === 'total_amount') {
       diamondForm.setValue('final_amount', Math.round(taxb * (1 + t/100)));
    } else if (field === 'final_amount') {
       const newTaxb = fin / (1 + t/100);
       diamondForm.setValue('total_amount', parseFloat(newTaxb.toFixed(2)));
    }
  }

  // ============================================================================

  const calculateTotals = () => {
    const subtotal = items.reduce((sum, item) => sum + item.total_amount, 0)
    const totalTax = items.reduce((sum, item) => sum + (item.total_amount * (item.tax_percent / 100)), 0)
    const sumFinals = items.reduce((sum, item) => sum + item.final_amount, 0)
    
    // User can override the grand total, but it defaults to the exact sum of all item final amounts
    const grandTotal = customGrandTotal !== '' ? Number(customGrandTotal) : sumFinals
    const roundOff = grandTotal - (subtotal + totalTax)
    
    return { subtotal, totalTax, grandTotal, roundOff }
  }
  const { subtotal, totalTax, grandTotal, roundOff } = calculateTotals()

  // --- Handlers ---
  const addGoldItem = (data: GoldFormValues) => {
    setItems([...items, { type: 'GOLD', ...data }])
    goldForm.reset({ 
      batch_number: '', purity_karat: '22K', purity_percent: 91.6, 
      weight_g: '' as unknown as number, rate_per_g: '' as unknown as number, 
      total_amount: 0, tax_percent: 3, final_amount: 0, hsn_code: '7108'
    })
    setIsGoldModalOpen(false)
    toast.success('Gold batch added to ledger')
  }

  const addDiamondItem = (data: DiamondFormValues) => {
    setItems([...items, { type: 'DIAMOND', ...data }])
    diamondForm.reset({ 
      lot_number: '', lot_type: 'packet', stone_type: 'DIAMOND', 
      pieces: '' as unknown as number, weight_cts: '' as unknown as number, 
      rate_per_ct: '' as unknown as number, total_amount: 0, tax_percent: 1.5, final_amount: 0,
      shape: '', color: '', clarity: '', sieve_size: '', certificate_agency: '', certificate_number: '', hsn_code: '7102'
    })
    setCustomFields({ stone_type: false, shape: false, color: false, clarity: false, sieve_size: false, certificate_agency: false })
    setIsDiamondModalOpen(false)
    toast.success('Stone lot added to ledger')
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
        toast.error(items.length === 0 ? 'Add at least one item to proceed' : 'Please verify all header details')
        setSaving(false)
        return 
      }
      const headerValues = headerForm.getValues()
      
      if (headerValues.supplier_gstin && headerValues.supplier_gstin.trim() !== '') {
        await supabase
          .from('suppliers')
          .update({ gstin: headerValues.supplier_gstin.toUpperCase() })
          .eq('id', headerValues.supplier_id)
      }

      const payload = {
        header: { 
          ...headerValues, 
          subtotal, 
          total_tax: totalTax, 
          round_off: roundOff, 
          grand_total: grandTotal 
        },
        items: items.map(item => ({
          ...item,
          quantity: item.type === 'GOLD' ? item.weight_g : item.weight_cts,
          rate: item.type === 'GOLD' ? item.rate_per_g : item.rate_per_ct,
          amount: item.total_amount, // Taxable Value
          description: item.type === 'GOLD' ? `${item.purity_karat} Gold Batch` : `${item.stone_type} ${item.shape || 'Lot'} ${item.sieve_size ? `(${item.sieve_size})` : ''}`
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
      headerForm.reset({ invoice_date: format(new Date(), 'yyyy-MM-dd'), currency: 'INR', exchange_rate: 1, invoice_number: '', supplier_id: '', warehouse_id: '', supplier_gstin: '', notes: '' })
      setItems([]) 
      setCustomGrandTotal('')
    } catch (err: any) {
      toast.error(err.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const PageSkeleton = () => (
    <div className="p-4 sm:p-8 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="space-y-2"><Skeleton className="h-8 w-48" /><Skeleton className="h-4 w-64" /></div>
        <div className="flex w-full sm:w-auto gap-3"><Skeleton className="h-10 flex-1 sm:w-28 rounded-xl" /><Skeleton className="h-10 flex-1 sm:w-32 rounded-xl" /></div>
      </div>
      <Skeleton className="h-48 w-full rounded-2xl" />
      <Skeleton className="h-64 w-full rounded-2xl" />
    </div>
  )

  if (loading) return <PageSkeleton />

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      
      {/* HEADER */}
      <header className="sticky top-0 z-40 w-full bg-white/80 backdrop-blur-md border-b border-gray-200/60 px-4 h-14 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <Link href="/purchases">
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-gray-100 text-gray-500"><ArrowLeft className="h-4 w-4" strokeWidth={1.5} /></Button>
          </Link>
          <Separator orientation="vertical" className="h-5 bg-gray-200" />
          <nav className="flex items-center gap-1.5 text-[13px] whitespace-nowrap">
            <span className="text-gray-500 font-medium">Purchases</span>
            <ChevronRight className="h-3.5 w-3.5 text-gray-300" strokeWidth={2} />
            <span className="font-semibold text-gray-900 tracking-tight">New Digital Intake</span>
          </nav>
        </div>
      </header>

      <main className="p-4 sm:p-6 md:p-8 max-w-7xl w-full mx-auto space-y-6 animate-in fade-in duration-500 pb-20">
        
        {/* ACTION BAR */}
        <div className="flex flex-col md:flex-row justify-between md:items-end gap-4">
           <div className="space-y-1 text-center md:text-left">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-gray-900">Procurement Record</h1>
              <p className="text-xs sm:text-sm text-gray-500 font-medium">Digitize physical vendor invoices into vault inventory.</p>
           </div>
           <div className="flex items-stretch sm:items-center flex-row gap-3 w-full md:w-auto">
              <Button variant="outline" className="flex-1 sm:flex-none h-10 px-5 rounded-xl text-xs font-bold border-gray-200 text-gray-700 hover:bg-gray-100 transition-colors" onClick={() => handleSaveInvoice('save_draft')} disabled={saving}>
                Save Draft
              </Button>
              <Button className="flex-1 sm:flex-none h-10 px-5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-colors" onClick={() => handleSaveInvoice('save_and_post')} disabled={saving}>
                {saving ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <CheckCircle2 className="mr-2 h-4 w-4" />} Confirm & Post
              </Button>
           </div>
        </div>

        {/* DOCUMENT METADATA */}
        <Card className="shadow-sm border-gray-200/60 rounded-2xl overflow-hidden bg-white">
          <CardHeader className="bg-gray-50/50 py-3.5 px-5 border-b border-gray-100">
             <CardTitle className="text-xs font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
                <FileText className="h-3.5 w-3.5 text-blue-500" /> Source Information
             </CardTitle>
          </CardHeader>
          <CardContent className="p-5">
            <form className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              <div className="space-y-2">
                <Label className="text-[11px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1.5"><Building2 className="w-3.5 h-3.5"/> Supplier Entity</Label>
                <Controller control={headerForm.control} name="supplier_id" render={({ field, fieldState }) => (
                    <Select 
                      onValueChange={(val) => {
                        field.onChange(val);
                        const selectedSup = suppliers.find(s => s.id === val);
                        if (selectedSup) headerForm.setValue('supplier_gstin', selectedSup.gstin || '');
                      }} 
                      value={field.value}
                    >
                      <SelectTrigger className={`h-10 rounded-xl text-sm font-medium bg-gray-50 border border-gray-200/60 hover:bg-gray-100 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all ${fieldState.error ? 'ring-2 ring-red-500/20 border-red-300 bg-red-50' : ''}`}>
                        <SelectValue placeholder="Identify Supplier..." />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl shadow-lg border-gray-100 p-1">
                        {suppliers.map(s => <SelectItem key={s.id} value={s.id} className="text-sm font-medium rounded-lg cursor-pointer focus:bg-blue-50 focus:text-blue-700">{s.supplier_name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-[11px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1.5"><Hash className="w-3.5 h-3.5"/> Supplier GSTIN</Label>
                <Input 
                  className="h-10 rounded-xl text-sm font-medium bg-gray-50 border border-gray-200/60 hover:bg-gray-100 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all uppercase font-mono" 
                  placeholder="27XXXXX0000X1Z5" 
                  {...headerForm.register('supplier_gstin')} 
                />
              </div>

              <div className="space-y-2">
                <Label className="text-[11px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5"/> Vault Destination</Label>
                <Controller control={headerForm.control} name="warehouse_id" render={({ field, fieldState }) => (
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger className={`h-10 rounded-xl text-sm font-medium bg-gray-50 border border-gray-200/60 hover:bg-gray-100 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all ${fieldState.error ? 'ring-2 ring-red-500/20 border-red-300 bg-red-50' : ''}`}>
                        <SelectValue placeholder="Assign Vault..." />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl shadow-lg border-gray-100 p-1">
                        {warehouses.map(w => <SelectItem key={w.id} value={w.id} className="text-sm font-medium rounded-lg cursor-pointer focus:bg-blue-50 focus:text-blue-700">{w.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-[11px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1.5"><FileSignature className="w-3.5 h-3.5"/> Invoice ID</Label>
                  <Input className="h-10 rounded-xl text-sm font-medium bg-gray-50 border border-gray-200/60 hover:bg-gray-100 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all uppercase font-mono px-3" placeholder="INV-102" {...headerForm.register('invoice_number')} />
                </div>
                <div className="space-y-2">
                  <Label className="text-[11px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5"/> Date
                  </Label>
                  <Controller
                    control={headerForm.control}
                    name="invoice_date"
                    render={({ field }) => (
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full h-10 rounded-xl text-[13px] font-medium bg-gray-50 border border-gray-200/60 hover:bg-gray-100 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all px-4 justify-start text-left shadow-sm",
                              !field.value && "text-gray-400"
                            )}
                          >
                            {field.value ? format(new Date(field.value), "MMM dd, yyyy") : <span>Select date</span>}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0 rounded-2xl shadow-xl border-gray-100" align="start">
                          <CalendarUI
                            mode="single"
                            selected={field.value ? new Date(field.value) : undefined}
                            onSelect={(date) => field.onChange(date ? format(date, 'yyyy-MM-dd') : '')}
                            initialFocus
                            className="bg-white rounded-2xl p-3"
                          />
                        </PopoverContent>
                      </Popover>
                    )}
                  />
                </div>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* OPERATIONS RIBBON */}
        <div className="flex flex-col sm:flex-row justify-between items-center bg-white p-3 rounded-2xl border border-gray-200/60 shadow-sm gap-4">
           <div className="px-2 w-full sm:w-auto text-center sm:text-left">
              <h2 className="text-xs font-bold uppercase tracking-widest text-gray-500">Assets & Items <span className="ml-1 text-gray-400">({items.length})</span></h2>
           </div>
           <div className="grid grid-cols-2 sm:flex sm:flex-row items-center gap-2.5 w-full sm:w-auto">
              
              {/* --- GOLD INGESTION MODAL --- */}
              <Dialog open={isGoldModalOpen} onOpenChange={(open) => {
                setIsGoldModalOpen(open);
                if (open && !goldForm.getValues('batch_number')) generateGoldBatchId();
              }}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="h-10 px-5 rounded-xl text-[11px] sm:text-xs font-bold uppercase border-gray-200 text-gray-700 hover:bg-amber-50 hover:text-amber-700 hover:border-amber-200 transition-colors w-full sm:w-auto">
                    <Coins className="mr-2 h-4 w-4 text-amber-500" strokeWidth={2} /> Ingest Metal
                  </Button>
                </DialogTrigger>
                <DialogContent className="w-[95vw] sm:max-w-2xl p-0 border-none shadow-xl rounded-2xl overflow-hidden bg-white">
                  <DialogHeader className="bg-amber-50/50 p-5 border-b border-amber-100/50">
                    <DialogTitle className="flex items-center gap-2.5 text-amber-900 font-bold text-lg"><Coins className="h-5 w-5 text-amber-500" strokeWidth={2}/> Gold Metal Intake</DialogTitle>
                    <DialogDescription className="text-xs font-medium text-amber-700/70 mt-1">Register bulk bullion or raw gold into the inventory system.</DialogDescription>
                  </DialogHeader>
                  <div className="p-5 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                      <div className="space-y-2">
                        <Label className="text-[11px] font-bold uppercase tracking-widest text-gray-500 flex justify-between items-center">
                          <span>Ref / Batch ID</span>
                          <button type="button" onClick={generateGoldBatchId} className="text-blue-600 hover:text-blue-700 flex items-center bg-blue-50 hover:bg-blue-100 px-2 py-0.5 rounded-full transition-colors">
                            <Wand2 className="w-3 h-3 mr-1" /> Auto
                          </button>
                        </Label>
                        <Input className="h-10 rounded-xl text-sm font-medium bg-gray-50 border border-gray-200 hover:bg-gray-100 focus:bg-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 font-mono uppercase shadow-sm" placeholder="GB-2026-001" {...goldForm.register('batch_number')} />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2"><Label className="text-[11px] font-bold uppercase tracking-widest text-gray-500">Karatage</Label>
                          <Select onValueChange={(v) => { goldForm.setValue('purity_karat', v); const p = v==='24K'?99.9:v==='22K'?91.6:v==='18K'?75.0:58.3; goldForm.setValue('purity_percent', p); }} defaultValue="22K">
                            <SelectTrigger className="h-10 rounded-xl text-sm font-medium bg-gray-50 border border-gray-200 hover:bg-gray-100 focus:bg-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 shadow-sm"><SelectValue /></SelectTrigger>
                            <SelectContent className="rounded-xl shadow-lg border-gray-100 p-1">
                              <SelectItem value="24K" className="text-sm font-medium rounded-lg py-2 focus:bg-amber-50 focus:text-amber-700">24K Fine</SelectItem>
                              <SelectItem value="22K" className="text-sm font-medium rounded-lg py-2 focus:bg-amber-50 focus:text-amber-700">22K Std</SelectItem>
                              <SelectItem value="18K" className="text-sm font-medium rounded-lg py-2 focus:bg-amber-50 focus:text-amber-700">18K Alloy</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                           <Label className="text-[11px] font-bold uppercase tracking-widest text-gray-500">HSN Code</Label>
                           <Input className="h-10 rounded-xl text-sm font-medium bg-gray-50 border border-gray-200 hover:bg-gray-100 focus:bg-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 shadow-sm" {...goldForm.register('hsn_code')} />
                        </div>
                      </div>
                    </div>

                    <Separator className="bg-gray-100" />

                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 items-start">
                      <div className="space-y-2">
                        <Label className="text-[11px] font-bold uppercase tracking-widest text-gray-500">Mass (g)</Label>
                        <Input 
                          type="number" step="0.001" 
                          className="h-10 rounded-xl text-sm font-medium bg-gray-50 border border-gray-200 hover:bg-gray-100 focus:bg-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 shadow-sm" 
                          value={gWeight || ''}
                          onChange={(e) => updateGoldCalc('weight_g', parseFloat(e.target.value) || 0)} 
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[11px] font-bold uppercase tracking-widest text-gray-500">Rate (₹/g)</Label>
                        <Input 
                          type="number" 
                          className="h-10 rounded-xl text-sm font-medium bg-gray-50 border border-gray-200 hover:bg-gray-100 focus:bg-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 shadow-sm" 
                          value={gRate || ''}
                          onChange={(e) => updateGoldCalc('rate_per_g', parseFloat(e.target.value) || 0)} 
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[11px] font-bold uppercase tracking-widest text-gray-500 flex items-center gap-1"><Percent className="w-3 h-3"/> Tax</Label>
                        <Input 
                          type="number" 
                          className="h-10 rounded-xl text-sm font-medium bg-gray-50 border border-gray-200 hover:bg-gray-100 focus:bg-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 shadow-sm" 
                          value={gTaxPct}
                          onChange={(e) => updateGoldCalc('tax_percent', parseFloat(e.target.value) || 0)} 
                        />
                      </div>
                      
                      <div className="space-y-2">
                         <Label className="text-[11px] font-bold uppercase tracking-widest text-amber-600/70">Taxable Val (₹)</Label>
                         <Input 
                           type="number" step="0.01" 
                           className="h-10 rounded-xl text-sm font-bold bg-amber-50 border border-amber-200 text-amber-900 focus:bg-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 shadow-sm" 
                           value={gTaxable || ''}
                           onChange={(e) => updateGoldCalc('total_amount', parseFloat(e.target.value) || 0)} 
                         />
                      </div>
                      
                      <div className="space-y-2">
                         <Label className="text-[11px] font-bold uppercase tracking-widest text-emerald-600">Final Amt (₹)</Label>
                         <Input 
                           type="number" step="0.01" 
                           className="h-10 rounded-xl text-sm font-black bg-emerald-50 border border-emerald-200 text-emerald-900 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 shadow-sm" 
                           value={gFinal || ''}
                           onChange={(e) => updateGoldCalc('final_amount', parseFloat(e.target.value) || 0)} 
                         />
                         {gRoundOff !== 0 && (
                           <span className="text-[9px] text-gray-400 font-medium block mt-1 tracking-widest">
                             ROUND OFF: {gRoundOff > 0 ? '+' : ''}{gRoundOff.toFixed(2)}
                           </span>
                         )}
                      </div>
                    </div>

                  </div>
                  <DialogFooter className="bg-gray-50/80 p-4 border-t border-gray-100 flex flex-row gap-2 justify-end">
                    <Button variant="ghost" className="h-10 rounded-xl text-xs uppercase font-bold text-gray-500 hover:text-gray-900 hover:bg-gray-200 px-4" onClick={() => setIsGoldModalOpen(false)}>Cancel</Button>
                    <Button className="h-10 rounded-xl text-xs uppercase font-bold px-6 bg-gray-900 hover:bg-black text-white shadow-sm" onClick={goldForm.handleSubmit((data) => addGoldItem(data))}>Add to Invoice</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              {/* --- DIAMOND INGESTION MODAL --- */}
              <Dialog open={isDiamondModalOpen} onOpenChange={(open) => {
                setIsDiamondModalOpen(open);
                if (open && !diamondForm.getValues('lot_number')) generateDiamondLotId();
              }}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="h-11 px-5 rounded-xl text-[11px] sm:text-xs font-bold uppercase border-gray-200 bg-white text-gray-700 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 transition-colors w-full sm:w-auto shadow-sm">
                    <Diamond className="mr-2 h-4 w-4 text-blue-500" strokeWidth={2} /> Ingest Stone
                  </Button>
                </DialogTrigger>
                <DialogContent className="w-[95vw] sm:max-w-3xl p-0 border-none shadow-xl rounded-2xl overflow-hidden bg-white">
                   <DialogHeader className="bg-blue-50/50 p-5 border-b border-blue-100/50">
                    <DialogTitle className="flex items-center gap-2.5 text-blue-900 font-bold text-lg"><Diamond className="h-5 w-5 text-blue-500" strokeWidth={2}/> Stone Lot Registration</DialogTitle>
                    <DialogDescription className="text-xs font-medium text-blue-700/70 mt-1">Record comprehensive technical metrics for precious stone lots.</DialogDescription>
                  </DialogHeader>
                  <div className="p-5 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
                    
                    {/* Identification Section */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label className="text-[11px] font-bold uppercase tracking-widest text-gray-500 flex justify-between items-center">
                          <span>Lot / ID</span>
                          <button type="button" onClick={generateDiamondLotId} className="text-blue-600 hover:text-blue-700 flex items-center bg-blue-50 hover:bg-blue-100 px-2 py-0.5 rounded-full transition-colors">
                            <Wand2 className="w-3 h-3 mr-1" /> Auto
                          </button>
                        </Label>
                        <Input className="h-10 rounded-xl text-sm font-medium bg-gray-50 border border-gray-200 hover:bg-gray-100 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-mono uppercase shadow-sm" placeholder="DL-202" {...diamondForm.register('lot_number')} />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[11px] font-bold uppercase tracking-widest text-gray-500">Class</Label>
                        <Select 
                          onValueChange={(val) => updateDiamondCalc('lot_type', val as any)} 
                          value={diamondForm.watch('lot_type')}
                        >
                          <SelectTrigger className="h-10 rounded-xl text-sm font-medium bg-gray-50 border border-gray-200 hover:bg-gray-100 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl shadow-lg border-gray-100 p-1">
                            <SelectItem value="packet" className="text-sm font-medium rounded-lg py-2 focus:bg-blue-50 focus:text-blue-700">Parcel / Packet</SelectItem>
                            <SelectItem value="single_piece" className="text-sm font-medium rounded-lg py-2 focus:bg-blue-50 focus:text-blue-700">Single Solitaire</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                         <Label className="text-[11px] font-bold uppercase tracking-widest text-gray-500">Stone Type</Label>
                         {customFields['stone_type'] ? (
                            <div className="flex relative items-center">
                              <Input className="h-10 rounded-xl text-sm font-medium bg-white border border-blue-500 focus:ring-2 focus:ring-blue-500/20 pr-8 shadow-sm" {...diamondForm.register('stone_type')} placeholder="Custom..." />
                              <Button type="button" variant="ghost" size="icon" className="absolute right-1 h-8 w-8 text-gray-400 hover:text-red-500 rounded-lg"
                                onClick={() => { setCustomFields(p => ({...p, stone_type: false})); diamondForm.setValue('stone_type', 'DIAMOND'); }}>
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                         ) : (
                           <Controller control={diamondForm.control} name="stone_type" render={({ field }) => (
                              <Select onValueChange={(v) => { if(v === 'CUSTOM') { setCustomFields(p => ({...p, stone_type: true})); diamondForm.setValue('stone_type', ''); } else field.onChange(v); }} value={field.value}>
                                <SelectTrigger className="h-10 rounded-xl text-sm font-medium bg-gray-50 border border-gray-200 hover:bg-gray-100 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-sm"><SelectValue /></SelectTrigger>
                                <SelectContent className="rounded-xl shadow-lg border-gray-100 p-1 max-h-[300px]">
                                  {STONE_TYPES.map(o => <SelectItem key={o} value={o} className="text-sm font-medium rounded-lg py-2 cursor-pointer focus:bg-blue-50 focus:text-blue-700">{o}</SelectItem>)}
                                  <Separator className="my-1 bg-gray-100"/>
                                  <SelectItem value="CUSTOM" className="text-sm text-blue-600 font-bold rounded-lg py-2 cursor-pointer focus:bg-blue-50 focus:text-blue-700"><Plus className="w-4 h-4 inline mr-1.5"/> Add Custom</SelectItem>
                                </SelectContent>
                              </Select>
                           )} />
                         )}
                      </div>
                    </div>

                    {/* Technical Specs Section */}
                    <div className="p-4 bg-gray-50/80 border border-gray-200/60 rounded-2xl space-y-4">
                       <h4 className="text-[11px] font-bold uppercase text-gray-400 tracking-widest border-b border-gray-200 pb-2">Gemological Specs</h4>
                       <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                         
                         {['shape', 'color', 'clarity', 'sieve_size'].map((fieldName) => {
                           const isCustom = customFields[fieldName];
                           const options = fieldName === 'shape' ? DIAMOND_SHAPES : fieldName === 'color' ? DIAMOND_COLORS : fieldName === 'clarity' ? DIAMOND_CLARITIES : SIEVE_SIZES;
                           const label = fieldName.replace('_', ' ');
                           return (
                             <div key={fieldName} className="space-y-2">
                                <Label className="text-[11px] font-bold uppercase tracking-widest text-gray-500">{label}</Label>
                                {isCustom ? (
                                  <div className="flex relative items-center">
                                    <Input className="h-10 rounded-xl text-sm font-medium bg-white border border-blue-500 focus:ring-2 focus:ring-blue-500/20 pr-8 shadow-sm" {...diamondForm.register(fieldName as any)} placeholder="Custom..." />
                                    <Button type="button" variant="ghost" size="icon" className="absolute right-1 h-8 w-8 text-gray-400 hover:text-red-500 rounded-lg"
                                      onClick={() => { setCustomFields(p => ({...p, [fieldName]: false})); diamondForm.setValue(fieldName as any, ''); }}>
                                      <X className="h-4 w-4" />
                                    </Button>
                                  </div>
                                ) : (
                                  <Controller control={diamondForm.control} name={fieldName as any} render={({ field }) => (
                                     <Select onValueChange={(v) => { if(v === 'CUSTOM') { setCustomFields(p => ({...p, [fieldName]: true})); diamondForm.setValue(fieldName as any, ''); } else field.onChange(v); }} value={field.value || ''}>
                                       <SelectTrigger className="h-10 rounded-xl text-sm font-medium bg-white border border-gray-200 shadow-sm hover:bg-gray-50 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"><SelectValue placeholder="Select..."/></SelectTrigger>
                                       <SelectContent className="rounded-xl shadow-lg border-gray-100 p-1 max-h-[300px]">
                                         {options.map(o => <SelectItem key={o} value={o} className="text-sm font-medium rounded-lg py-2 cursor-pointer focus:bg-blue-50 focus:text-blue-700">{o}</SelectItem>)}
                                         <Separator className="my-1 bg-gray-100"/>
                                         <SelectItem value="CUSTOM" className="text-sm text-blue-600 font-bold rounded-lg py-2 cursor-pointer focus:bg-blue-50 focus:text-blue-700"><Plus className="w-4 h-4 inline mr-1.5"/> Custom</SelectItem>
                                       </SelectContent>
                                     </Select>
                                  )} />
                                )}
                             </div>
                           )
                         })}

                       </div>
                       
                       <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
                         <div className="space-y-2">
                            <Label className="text-[11px] font-bold uppercase tracking-widest text-gray-500">Agency</Label>
                            {customFields['certificate_agency'] ? (
                                <div className="flex relative items-center">
                                  <Input className="h-10 rounded-xl text-sm font-medium bg-white border border-blue-500 focus:ring-2 focus:ring-blue-500/20 pr-8 shadow-sm" {...diamondForm.register('certificate_agency')} placeholder="Custom agency..." />
                                  <Button type="button" variant="ghost" size="icon" className="absolute right-1 h-8 w-8 text-gray-400 hover:text-red-500 rounded-lg"
                                    onClick={() => { setCustomFields(p => ({...p, certificate_agency: false})); diamondForm.setValue('certificate_agency', ''); }}>
                                    <X className="h-4 w-4" />
                                  </Button>
                                </div>
                            ) : (
                              <Controller control={diamondForm.control} name="certificate_agency" render={({ field }) => (
                                 <Select onValueChange={(v) => { if(v === 'CUSTOM') { setCustomFields(p => ({...p, certificate_agency: true})); diamondForm.setValue('certificate_agency', ''); } else field.onChange(v); }} value={field.value || ''}>
                                   <SelectTrigger className="h-10 rounded-xl text-sm font-medium bg-white border border-gray-200 shadow-sm hover:bg-gray-50 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"><SelectValue placeholder="None"/></SelectTrigger>
                                   <SelectContent className="rounded-xl shadow-lg border-gray-100 p-1">
                                     {CERT_AGENCIES.map(o => <SelectItem key={o} value={o} className="text-sm font-medium rounded-lg py-2 cursor-pointer focus:bg-blue-50 focus:text-blue-700">{o}</SelectItem>)}
                                     <Separator className="my-1 bg-gray-100"/>
                                     <SelectItem value="CUSTOM" className="text-sm text-blue-600 font-bold rounded-lg py-2 cursor-pointer focus:bg-blue-50 focus:text-blue-700"><Plus className="w-4 h-4 inline mr-1.5"/> Custom</SelectItem>
                                   </SelectContent>
                                 </Select>
                              )} />
                            )}
                         </div>
                         <div className="space-y-2">
                           <Label className="text-[11px] font-bold uppercase tracking-widest text-gray-500">Report ID</Label>
                           <Input className="h-10 rounded-xl text-sm font-medium bg-white border border-gray-200 hover:bg-gray-50 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-sm" placeholder="e.g. GIA..." {...diamondForm.register('certificate_number')} />
                         </div>
                         <div className="space-y-2">
                           <Label className="text-[11px] font-bold uppercase tracking-widest text-gray-500">HSN</Label>
                           <Input className="h-10 rounded-xl text-sm font-medium bg-white border border-gray-200 hover:bg-gray-50 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-sm" {...diamondForm.register('hsn_code')} />
                         </div>
                       </div>
                    </div>

                    {/* Financials Section */}
                    <div className="grid grid-cols-2 sm:grid-cols-6 gap-4 items-start">
                      <div className="space-y-2">
                        <Label className="text-[11px] font-bold uppercase tracking-widest text-gray-500 flex justify-between">
                          <span>Pieces</span>
                        </Label>
                        <Input 
                          type="number" min="1" 
                          className="h-10 rounded-xl text-sm font-medium bg-gray-50 border border-gray-200 hover:bg-gray-100 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-sm disabled:opacity-50" 
                          disabled={diamondForm.watch('lot_type') === 'single_piece'} 
                          {...diamondForm.register('pieces')} 
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[11px] font-bold uppercase tracking-widest text-gray-500">Carats</Label>
                        <Input 
                          type="number" step="0.001" 
                          className="h-10 rounded-xl text-sm font-medium bg-gray-50 border border-gray-200 hover:bg-gray-100 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-sm" 
                          value={dWeight || ''}
                          onChange={(e) => updateDiamondCalc('weight_cts', parseFloat(e.target.value) || 0)} 
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[11px] font-bold uppercase tracking-widest text-gray-500">Rate (₹)</Label>
                        <Input 
                          type="number" 
                          className="h-10 rounded-xl text-sm font-medium bg-gray-50 border border-gray-200 hover:bg-gray-100 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-sm" 
                          value={dRate || ''}
                          onChange={(e) => updateDiamondCalc('rate_per_ct', parseFloat(e.target.value) || 0)} 
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[11px] font-bold uppercase tracking-widest text-gray-500 flex items-center gap-1"><Percent className="w-3 h-3"/> Tax</Label>
                        <Input 
                          type="number" 
                          className="h-10 rounded-xl text-sm font-medium bg-gray-50 border border-gray-200 hover:bg-gray-100 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-sm" 
                          value={dTaxPct}
                          onChange={(e) => updateDiamondCalc('tax_percent', parseFloat(e.target.value) || 0)} 
                        />
                      </div>
                      
                      <div className="space-y-2">
                         <Label className="text-[11px] font-bold uppercase tracking-widest text-blue-600/70">Taxable Val (₹)</Label>
                         <Input 
                           type="number" step="0.01" 
                           className="h-10 rounded-xl text-sm font-bold bg-blue-50 border border-blue-200 text-blue-900 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-sm" 
                           value={dTaxable || ''}
                           onChange={(e) => updateDiamondCalc('total_amount', parseFloat(e.target.value) || 0)} 
                         />
                      </div>
                      
                      <div className="space-y-2">
                         <Label className="text-[11px] font-bold uppercase tracking-widest text-emerald-600">Final Amt (₹)</Label>
                         <Input 
                           type="number" step="0.01" 
                           className="h-10 rounded-xl text-sm font-black bg-emerald-50 border border-emerald-200 text-emerald-900 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 shadow-sm" 
                           value={dFinal || ''}
                           onChange={(e) => updateDiamondCalc('final_amount', parseFloat(e.target.value) || 0)} 
                         />
                         {dRoundOff !== 0 && (
                           <span className="text-[9px] text-gray-400 font-medium block mt-1 tracking-widest">
                             ROUND OFF: {dRoundOff > 0 ? '+' : ''}{dRoundOff.toFixed(2)}
                           </span>
                         )}
                      </div>
                    </div>

                  </div>
                  <DialogFooter className="bg-gray-50/80 p-4 border-t border-gray-100 flex flex-row gap-2 justify-end">
                    <Button variant="ghost" className="h-10 rounded-xl text-xs uppercase font-bold text-gray-500 hover:text-gray-900 hover:bg-gray-200 px-4" onClick={() => setIsDiamondModalOpen(false)}>Cancel</Button>
                    <Button className="h-10 rounded-xl text-xs uppercase font-bold px-6 bg-gray-900 hover:bg-black text-white shadow-sm" onClick={diamondForm.handleSubmit((data) => addDiamondItem(data))}>Add to Invoice</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
           </div>
        </div>

        {/* LINE ITEMS TABLE */}
        <Card className="shadow-sm border-gray-200/60 rounded-2xl overflow-hidden bg-white">
          <div className="overflow-x-auto min-h-[200px] sm:min-h-[300px]">
            <Table>
              <TableHeader className="bg-gray-50/80 sticky top-0 z-10 border-b border-gray-100">
                <TableRow className="border-none hover:bg-transparent">
                  <TableHead className="text-[11px] font-bold uppercase tracking-widest text-gray-500 h-11 px-4 sm:px-5">Type</TableHead>
                  <TableHead className="text-[11px] font-bold uppercase tracking-widest text-gray-500 h-11">Specs</TableHead>
                  <TableHead className="text-[11px] font-bold uppercase tracking-widest text-gray-500 h-11 text-right">Qty/Mass</TableHead>
                  <TableHead className="text-[11px] font-bold uppercase tracking-widest text-gray-500 h-11 text-right">Rate</TableHead>
                  <TableHead className="text-[11px] font-bold uppercase tracking-widest text-gray-500 h-11 text-right">Taxable Val</TableHead>
                  <TableHead className="text-[11px] font-bold uppercase tracking-widest text-gray-500 h-11 text-center">Tax</TableHead>
                  <TableHead className="text-[11px] font-bold uppercase tracking-widest text-gray-500 h-11 text-right text-emerald-600">Final Amt</TableHead>
                  <TableHead className="w-[50px] h-11"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-[250px] text-center">
                       <div className="flex flex-col items-center gap-3">
                          <div className="h-12 w-12 bg-gray-50 rounded-2xl flex items-center justify-center border border-gray-100">
                             <Plus className="h-5 w-5 text-gray-400" strokeWidth={1.5} />
                          </div>
                          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Awaiting Line Item Input</p>
                       </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((item, idx) => (
                    <TableRow key={idx} className="hover:bg-gray-50/50 transition-colors border-gray-100 group">
                      <TableCell className="px-4 sm:px-5 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${item.type === 'GOLD' ? 'bg-amber-50 text-amber-600' : 'bg-blue-50 text-blue-600'}`}>
                             {item.type === 'GOLD' ? <Coins className="h-4 w-4" strokeWidth={1.5} /> : <Diamond className="h-4 w-4" strokeWidth={1.5} />}
                          </div>
                          <span className="text-[11px] font-bold uppercase tracking-widest text-gray-900">{item.type}</span>
                        </div>
                      </TableCell>
                      <TableCell className="py-3">
                        <div className="flex flex-col min-w-[120px] gap-1">
                           <span className="text-[13px] font-bold text-gray-900 tracking-tight">
                             {'batch_number' in item ? item.batch_number : item.lot_number}
                           </span>
                           <span className="text-[10px] text-gray-500 font-medium flex items-center gap-1.5 flex-wrap uppercase tracking-wider">
                             {'purity_karat' in item ? (
                               <Badge variant="secondary" className="bg-amber-50 text-amber-700 hover:bg-amber-50 border-none px-1.5 py-0 shadow-none text-[9px] font-bold">{item.purity_karat} ({item.purity_percent}%)</Badge>
                             ) : (
                               <>
                                 <Badge variant="secondary" className="bg-blue-50 text-blue-700 hover:bg-blue-50 border-none px-1.5 py-0 shadow-none text-[9px] font-bold">{item.stone_type}</Badge>
                                 {item.shape && <span className="flex items-center gap-1.5"><div className="w-1 h-1 rounded-full bg-gray-300"/>{item.shape}</span>}
                                 {item.color && <span className="flex items-center gap-1.5"><div className="w-1 h-1 rounded-full bg-gray-300"/>{item.color} {item.clarity}</span>}
                                 {item.sieve_size && <span className="flex items-center gap-1.5 text-blue-600 bg-blue-50/50 px-1.5 py-0.5 rounded-md border border-blue-100"><div className="w-1 h-1 rounded-full bg-blue-300"/>{item.sieve_size}</span>}
                                 {item.certificate_number && <span className="flex items-center gap-1.5 text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded-md"><div className="w-1 h-1 rounded-full bg-indigo-300"/>Cert: {item.certificate_agency} {item.certificate_number}</span>}
                               </>
                             )}
                           </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right py-3 whitespace-nowrap">
                         <div className="flex flex-col items-end">
                           <span className="text-[13px] font-bold text-gray-900">{'weight_g' in item ? `${item.weight_g} g` : `${item.weight_cts} ct`}</span>
                           {'pieces' in item && <span className="text-[10px] font-medium text-gray-400 uppercase tracking-widest mt-0.5">{item.pieces} Pcs</span>}
                         </div>
                      </TableCell>
                      <TableCell className="text-right text-[13px] text-gray-600 font-medium whitespace-nowrap py-3">
                         ₹{'rate_per_g' in item ? item.rate_per_g?.toLocaleString() : item.rate_per_ct?.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap py-3">
                         <span className="text-[13px] font-bold text-gray-900 tracking-tight">₹{item.total_amount.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                      </TableCell>
                      <TableCell className="text-center py-3">
                         <Badge variant="outline" className="text-[10px] font-bold bg-gray-50 border-gray-200 text-gray-600 px-1.5 py-0 shadow-sm">{item.tax_percent}%</Badge>
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap py-3">
                         <span className="text-[13px] font-black text-emerald-700 tracking-tight">₹{item.final_amount.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                      </TableCell>
                      <TableCell className="px-2 sm:px-4 text-right py-3">
                         <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-300 hover:text-red-600 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all" onClick={() => removeItem(idx)}>
                           <Trash2 className="h-4 w-4" strokeWidth={1.5} />
                         </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* FINANCIAL FOOTER WITH ROUND OFF SUPPORT */}
          {items.length > 0 && (
            <div className="bg-gray-50/80 border-t border-gray-200 p-5 sm:p-6 flex flex-col sm:flex-row sm:justify-end">
               <div className="w-full sm:w-[320px] space-y-3">
                  <div className="flex justify-between items-center text-[11px] font-bold text-gray-500 uppercase tracking-widest">
                     <span>Subtotal</span>
                     <span className="text-gray-900 text-sm">₹{subtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                  {totalTax > 0 && (
                    <div className="flex justify-between items-center text-[11px] font-bold text-gray-500 uppercase tracking-widest">
                       <span>Total Tax</span>
                       <span className="text-gray-900 text-sm">₹{totalTax.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                  )}
                  <Separator className="bg-gray-200 my-2" />
                  
                  {/* The Round Off Indicator */}
                  <div className="flex justify-between items-center">
                     <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Round Off</span>
                     <span className={cn("text-sm font-medium", roundOff > 0 ? "text-emerald-600" : roundOff < 0 ? "text-red-500" : "text-gray-400")}>
                        {roundOff > 0 ? '+' : ''}{roundOff.toFixed(2)}
                     </span>
                  </div>

                  <div className="flex justify-between items-center mt-2">
                     <span className="text-[12px] font-bold uppercase text-blue-600 tracking-widest">Grand Total</span>
                     <div className="relative">
                       <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500 text-sm font-bold">₹</span>
                       {/* Editable Grand Total to absorb manual rounding differences */}
                       <Input 
                         type="number" 
                         step="0.01"
                         className="w-36 h-10 pl-6 text-right text-xl font-black text-gray-900 border-blue-200 bg-white shadow-sm focus:ring-blue-500 focus:border-blue-500" 
                         value={customGrandTotal !== '' ? customGrandTotal : grandTotal}
                         onChange={(e) => setCustomGrandTotal(e.target.value)}
                         title="Edit this to exactly match the vendor's physical bill total."
                       />
                     </div>
                  </div>
               </div>
            </div>
          )}
        </Card>

      </main>
    </div>
  )
}