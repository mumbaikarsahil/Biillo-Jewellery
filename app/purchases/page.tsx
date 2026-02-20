'use client'

import React, { useState, useEffect } from 'react'
import { useForm, useWatch, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { 
  Loader2, CheckCircle, Plus, Trash2, 
  FileText 
} from 'lucide-react'
import { format } from 'date-fns'

// UI Components
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'

// --- Types & Zod Schemas ---

// 1. Invoice Header Schema
const invoiceHeaderSchema = z.object({
  supplier_id: z.string().uuid('Select a supplier'),
  warehouse_id: z.string().uuid('Select destination warehouse'),
  invoice_number: z.string().min(1, 'Invoice number is required'),
  invoice_date: z.string().min(1, 'Date is required'),
  currency: z.string().default('INR'), 
  exchange_rate: z.coerce.number().min(0.01).default(1),
  notes: z.string().optional(),
})

// 2. Gold Item Schema
const goldItemSchema = z.object({
  batch_number: z.string().min(1, 'Batch # required'),
  purity_karat: z.string().min(1, 'Karat required'),
  purity_percent: z.coerce.number().min(0).max(100),
  weight_g: z.coerce.number().positive(),
  rate_per_g: z.coerce.number().positive(),
  total_amount: z.coerce.number().nonnegative(),
  making_charges: z.coerce.number().optional().default(0),
  tax_percent: z.coerce.number().optional().default(3), 
})

// 3. Diamond Item Schema
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
  tax_percent: z.coerce.number().optional().default(1.5), 
})

type InvoiceItem = 
  | ({ type: 'GOLD' } & z.infer<typeof goldItemSchema>)
  | ({ type: 'DIAMOND' } & z.infer<typeof diamondItemSchema>)

// --- Main Component ---

export default function PurchaseInvoicePage() {
  const { appUser } = useAuth()
  const router = useRouter()
  
  // Master Data State
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [warehouses, setWarehouses] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Local Invoice State
  const [items, setItems] = useState<InvoiceItem[]>([])

  // Header Form
  const headerForm = useForm<z.infer<typeof invoiceHeaderSchema>>({
    resolver: zodResolver(invoiceHeaderSchema),
    defaultValues: {
      invoice_date: format(new Date(), 'yyyy-MM-dd'),
      currency: 'INR',
      exchange_rate: 1
    }
  })

  // Item Forms
  const goldForm = useForm<z.infer<typeof goldItemSchema>>({
    resolver: zodResolver(goldItemSchema),
    defaultValues: { purity_karat: '22K', purity_percent: 91.6, weight_g: 0, rate_per_g: 0, total_amount: 0, tax_percent: 3 }
  })
  const diamondForm = useForm<z.infer<typeof diamondItemSchema>>({
    resolver: zodResolver(diamondItemSchema),
    defaultValues: { lot_type: 'packet', pieces: 1, weight_cts: 0, rate_per_ct: 0, total_amount: 0, tax_percent: 1.5 }

  })

  // --- Initial Data Fetch ---
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

  // --- Calculations ---
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

  // Invoice Totals
  const calculateTotals = () => {
    const subtotal = items.reduce((sum, item) => sum + item.total_amount, 0)
    const totalTax = items.reduce((sum, item) => sum + (item.total_amount * (item.tax_percent / 100)), 0)
    return { subtotal, totalTax, grandTotal: subtotal + totalTax }
  }
  const { subtotal, totalTax, grandTotal } = calculateTotals()

  // --- Handlers ---

  const addGoldItem = (data: z.infer<typeof goldItemSchema>) => {
    setItems([...items, { type: 'GOLD', ...data }])
    goldForm.reset({ purity_karat: '22K', purity_percent: 91.6, weight_g: 0, rate_per_g: 0, total_amount: 0, tax_percent: 3 })
    toast.success('Gold item added')
  }

  const addDiamondItem = (data: z.infer<typeof diamondItemSchema>) => {
    setItems([...items, { type: 'DIAMOND', ...data }])
    diamondForm.reset({ lot_type: 'packet', pieces: 1, weight_cts: 0, rate_per_ct: 0, total_amount: 0, tax_percent: 1.5 })
    toast.success('Diamond item added')
  }

  const removeItem = (index: number) => {
    const newItems = [...items]
    newItems.splice(index, 1)
    setItems(newItems)
  }

  // --- FIXED: Types and Logic ---
  const handleSaveInvoice = async (action: 'save_draft' | 'save_and_post') => {
    // 1. FIX: Null Guard for TypeScript
    if (!appUser) {
        toast.error('You are not logged in')
        return
    }

    setSaving(true)
    try {
      const headerValid = await headerForm.trigger()
      if (!headerValid) {
        console.log(headerForm.formState.errors)
        toast.error('Fix required invoice fields')
        setSaving(false)
        return
      }
      
      if (items.length === 0) throw new Error('Add at least one item')
  
      const headerValues = headerForm.getValues()
      
      const payload = {
        header: {
          // REMOVED: company_id (Backend derives this from user_id for security)
          supplier_id: headerValues.supplier_id,
          warehouse_id: headerValues.warehouse_id,
          invoice_number: headerValues.invoice_number,
          invoice_date: headerValues.invoice_date,
          currency: headerValues.currency,
          exchange_rate: headerValues.exchange_rate,
          subtotal: subtotal,
          total_tax: totalTax,
          grand_total: grandTotal
        },
        items: items.map(item => ({
          // 2. FIX: Spread logic corrected. 'type' is already in '...item'
          ...item,
          quantity: item.type === 'GOLD' ? item.weight_g : item.weight_cts,
          rate: item.type === 'GOLD' ? item.rate_per_g : item.rate_per_ct,
          amount: item.total_amount,
          description: item.type === 'GOLD' 
            ? `${item.purity_karat} Gold Batch` 
            : `Diamond ${item.shape || 'Lot'}`
        }))
      }
  
      const { data: invoiceId, error: saveError } = await supabase.rpc(
        'create_purchase_invoice_draft', 
        { 
          _payload: payload,
          _user_id: appUser.user_id
        }
      )
  
      if (saveError) throw saveError
      if (!invoiceId) throw new Error('Failed to create invoice ID')
  
      if (action === 'save_and_post') {
        const { error: postError } = await supabase.rpc(
          'post_purchase_invoice',
          { 
            _invoice_id: invoiceId,
            _user_id: appUser.user_id
          }
        )
        if (postError) throw postError
        toast.success('Invoice Posted & Inventory Created!')
      } else {
        toast.success('Draft Saved Successfully')
      }
  
      router.push('/purchases') 
  
    } catch (err: any) {
      if (err.message?.includes('idx_unique_supplier_invoice')) {
        toast.error('This Invoice Number already exists for this supplier.')
      } else if (err.message?.includes('idx_unique_gold_batch')) {
        toast.error('One of the Gold Batch numbers already exists.')
      } else {
        toast.error(err.message || 'An error occurred')
      }
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin" /></div>

  return (
    <div className="container mx-auto py-6 max-w-6xl space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">New Purchase Invoice</h1>
          <p className="text-gray-500">Record incoming stock from suppliers.</p>
        </div>
        <div className="flex gap-2">
          {/* 3. FIX: Updated onClick strings to match union type */}
          <Button variant="outline" onClick={() => handleSaveInvoice('save_draft')} disabled={saving}>
            Save Draft
          </Button>
          <Button className="bg-green-600 hover:bg-green-700" onClick={() => handleSaveInvoice('save_and_post')} disabled={saving}>
            {saving ? <Loader2 className="animate-spin mr-2" /> : <CheckCircle className="mr-2 h-4 w-4" />}
            Confirm & Post
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="h-5 w-5 text-blue-600" /> Invoice Details
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Supplier <span className="text-red-500">*</span></Label>
              <Controller
                control={headerForm.control}
                name="supplier_id"
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger><SelectValue placeholder="Select Supplier" /></SelectTrigger>
                    <SelectContent>
                      {suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.supplier_name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="space-y-2">
              <Label>Warehouse (Destination)</Label>
              <Controller
                control={headerForm.control}
                name="warehouse_id"
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger><SelectValue placeholder="Select Warehouse" /></SelectTrigger>
                    <SelectContent>
                      {warehouses.map(w => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="space-y-2">
              <Label>Invoice Number</Label>
              <Input placeholder="e.g. INV-2024-001" {...headerForm.register('invoice_number')} />
            </div>
            <div className="space-y-2">
              <Label>Date</Label>
              <Input type="date" {...headerForm.register('invoice_date')} />
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* LEFT COLUMN: Add Items */}
        <div className="lg:col-span-1 space-y-4">
          <Card className="h-full border-t-4 border-t-indigo-500">
            <CardHeader>
              <CardTitle>Add Line Items</CardTitle>
              <CardDescription>Select type and enter details</CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="gold" className="w-full">
                <TabsList className="w-full grid grid-cols-2 mb-4">
                  <TabsTrigger value="gold">Gold</TabsTrigger>
                  <TabsTrigger value="diamond">Diamond</TabsTrigger>
                </TabsList>

                <TabsContent value="gold" className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <Input placeholder="Batch No (Auto?)" {...goldForm.register('batch_number')} />
                    <Select onValueChange={(v) => {
                       goldForm.setValue('purity_karat', v)
                       if(v==='24K') goldForm.setValue('purity_percent', 99.9)
                       if(v==='22K') goldForm.setValue('purity_percent', 91.6)
                       if(v==='18K') goldForm.setValue('purity_percent', 75.0)
                       if(v==='14K') goldForm.setValue('purity_percent', 58.3)
                       if(v==='12K') goldForm.setValue('purity_percent', 41.6)
                    }} defaultValue="22K">
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="24K">24K</SelectItem>
                        <SelectItem value="22K">22K</SelectItem>
                        <SelectItem value="18K">18K</SelectItem>
                        <SelectItem value="14K">14K</SelectItem>
                        <SelectItem value="12K">12K</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">Weight (g)</Label>
                      <Input type="number" step="0.001" {...goldForm.register('weight_g')} />
                    </div>
                    <div>
                      <Label className="text-xs">Rate/g</Label>
                      <Input type="number" step="0.01" {...goldForm.register('rate_per_g')} />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">Total Amount</Label>
                    <Input readOnly className="bg-gray-50 font-bold" {...goldForm.register('total_amount')} />
                  </div>
                  <Button className="w-full mt-2" onClick={goldForm.handleSubmit(addGoldItem)}>
                    <Plus className="mr-2 h-4 w-4" /> Add Gold Batch
                  </Button>
                </TabsContent>

                <TabsContent value="diamond" className="space-y-3">
                   <div className="grid grid-cols-2 gap-2">
                    <Input placeholder="Lot/Cert #" {...diamondForm.register('lot_number')} />
                    <Select onValueChange={(v:any) => diamondForm.setValue('lot_type', v)} defaultValue="packet">
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="packet">Packet</SelectItem>
                        <SelectItem value="single_piece">Single Stone</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                   <div className="grid grid-cols-3 gap-2">
                    <Input placeholder="Shape" {...diamondForm.register('shape')} />
                    <Input placeholder="Color" {...diamondForm.register('color')} />
                    <Input placeholder="Clarity" {...diamondForm.register('clarity')} />
                  </div>
                   <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">Carats</Label>
                      <Input type="number" step="0.01" {...diamondForm.register('weight_cts')} />
                    </div>
                    <div>
                      <Label className="text-xs">Rate/Ct</Label>
                      <Input type="number" step="0.01" {...diamondForm.register('rate_per_ct')} />
                    </div>
                    <div>
                      <Label className="text-xs">Pieces</Label>
                      <Input type="number" {...diamondForm.register('pieces')} />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">Total Amount</Label>
                    <Input readOnly className="bg-gray-50 font-bold" {...diamondForm.register('total_amount')} />
                  </div>
                   <Button className="w-full mt-2 bg-blue-600 hover:bg-blue-700" onClick={diamondForm.handleSubmit(addDiamondItem)}>
                    <Plus className="mr-2 h-4 w-4" /> Add Diamond Lot
                  </Button>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>

        {/* RIGHT COLUMN: Items List */}
        <div className="lg:col-span-2">
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Invoice Items ({items.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Rate</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center h-32 text-gray-500">
                        No items added yet.
                      </TableCell>
                    </TableRow>
                  )}
                  {items.map((item, idx) => (
                    <TableRow key={idx}>
                      <TableCell>
                        {item.type === 'GOLD' ? 
                          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">Gold</Badge> : 
                          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Diamond</Badge>
                        }
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-sm">
                          {item.type === 'GOLD' ? item.batch_number : item.lot_number}
                        </div>
                        <div className="text-xs text-gray-500">
                          {item.type === 'GOLD' ? `${item.purity_karat}` : `${item.shape || ''} ${item.color || ''} ${item.clarity || ''}`}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {item.type === 'GOLD' ? `${item.weight_g} g` : `${item.weight_cts} ct`}
                      </TableCell>
                      <TableCell className="text-right text-xs text-gray-500">
                        {item.type === 'GOLD' ? item.rate_per_g : item.rate_per_ct}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {item.total_amount.toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-red-500" onClick={() => removeItem(idx)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
            {items.length > 0 && (
              <CardFooter className="flex flex-col gap-2 border-t bg-gray-50/50 p-4">
                <div className="flex justify-between w-full text-sm">
                  <span className="text-gray-500">Subtotal:</span>
                  <span>{subtotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between w-full text-sm">
                  <span className="text-gray-500">Tax Estimate:</span>
                  <span>{totalTax.toLocaleString()}</span>
                </div>
                <Separator />
                <div className="flex justify-between w-full font-bold text-lg">
                  <span>Grand Total:</span>
                  <span>{grandTotal.toLocaleString()}</span>
                </div>
              </CardFooter>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}