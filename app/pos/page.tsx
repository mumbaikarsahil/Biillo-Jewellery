'use client'

import React, { useEffect, useState, useRef } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { cn } from "@/lib/utils"

import { 
  Select, SelectContent, SelectItem, 
  SelectTrigger, SelectValue 
} from '@/components/ui/select'
import { 
  Dialog, DialogContent, DialogHeader, 
  DialogTitle, DialogFooter 
} from '@/components/ui/dialog'
import { supabase } from '@/lib/supabaseClient'
import { fetchCustomers } from '@/lib/api'
import { useRpc } from '@/hooks/useRpc'
import { toast } from 'sonner'
import { useReactToPrint } from 'react-to-print'
import { 
  Trash2, ScanLine, Camera,
  X, Receipt, Search, Plus, CheckCircle2, Printer,
  Banknote, CreditCard, QrCode, Building, Keyboard, RefreshCw, ChevronDown, ChevronUp, Ticket, Tag
} from 'lucide-react'

// IMPORT THE SHARED PRINT COMPONENT
import { InvoicePrintTemplate } from '@/components/InvoicePrintTemplate'
import { Label } from 'recharts'

interface CartItem {
  id: string
  barcode: string
  metal_type: string
  mrp: number
  purity_karat?: string
  hsn_code?: string
  gross_weight_g?: number
  net_weight_g?: number
  total_stone_weight_cts?: number
}

interface Customer {
  id: string
  full_name: string
  phone: string
  city?: string
  address?: string
  pan_no?: string
  birth_date?: string
}

export default function POSPage() {
  const { appUser, loading } = useAuth()
  const { callRpc } = useRpc()
  
  // Settings & Core
  const [warehouses, setWarehouses] = useState<{id: string, name: string}[]>([])
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('')
  const [cart, setCart] = useState<CartItem[]>([])
  const [paymentMode, setPaymentMode] = useState('cash')
  const [isProcessing, setIsProcessing] = useState(false)
  
  // Customer State
  const [customers, setCustomers] = useState<Customer[]>([])
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [searchCustomer, setSearchCustomer] = useState('')
  const [isAddCustomerOpen, setIsAddCustomerOpen] = useState(false)
  const [newCustForm, setNewCustForm] = useState({ 
    full_name: '', phone: '', city: '', address: '', pan_no: '', birth_date: '' 
  })
  
  // Input State
  const [barcodeInput, setBarcodeInput] = useState('')
  const [itemSearchTerm, setItemSearchTerm] = useState('')
  const [searchResults, setSearchResults] = useState<CartItem[]>([])
  
  // Discount & Voucher State
  const [discountType, setDiscountType] = useState<'percent' | 'flat'>('percent')
  const [discountValue, setDiscountValue] = useState<string>('')
  const [voucherCode, setVoucherCode] = useState('')
  const [activeVoucher, setActiveVoucher] = useState<{ code: string, amount: number } | null>(null)

  // Exchange State
  const [isExchangeOpen, setIsExchangeOpen] = useState(false)
  const [exchangeBarcode, setExchangeBarcode] = useState<string>('')
  const [exchangeValue, setExchangeValue] = useState<string>('')
  const [exchangeNotes, setExchangeNotes] = useState<string>('')

  // Print & Post-Checkout State
  const printRef = useRef<HTMLDivElement>(null)
  const [showPrintModal, setShowPrintModal] = useState(false)
  const [lastInvoiceData, setLastInvoiceData] = useState<any>(null)

  const handlePrint = useReactToPrint({
    contentRef: printRef,
  })

  // --- INITIALIZATION ---
  useEffect(() => {
    const init = async () => {
      if (!appUser) return
      try {
        const { data: whData } = await supabase.from('warehouses').select('id, name').eq('company_id', appUser.company_id).eq('is_active', true).order('name')
        if (whData && whData.length > 0) {
          setWarehouses(whData)
          setSelectedWarehouseId(whData[0].id)
        }
        const { data: custData } = await fetchCustomers(appUser.company_id)
        setCustomers(custData || [])
      } catch (err) {
        toast.error('Failed to load initial data.')
      }
    }
    init()
  }, [appUser])

  // --- CUSTOMER LOGIC ---
  const handleAddCustomer = async () => {
    if (!newCustForm.full_name || !newCustForm.phone) {
      return toast.error('Name and Phone are required.')
    }
    try {
      const { data, error } = await supabase.from('customers').insert([{
        company_id: appUser?.company_id,
        warehouse_id: selectedWarehouseId,
        full_name: newCustForm.full_name,
        phone: newCustForm.phone,
        city: newCustForm.city || null,
        address: newCustForm.address || null,
        pan_no: newCustForm.pan_no?.toUpperCase() || null,
        birth_date: newCustForm.birth_date || null
      }]).select().single()

      if (error) throw error

      setCustomers(prev => [...prev, data])
      setSelectedCustomer(data)
      setIsAddCustomerOpen(false)
      setSearchCustomer('')
      setNewCustForm({ full_name: '', phone: '', city: '', address: '', pan_no: '', birth_date: '' })
      toast.success('New customer registered.')
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  // --- ITEM SCANNING & SEARCH ---
  useEffect(() => {
    const searchItems = async () => {
      if (!itemSearchTerm.trim() || !selectedWarehouseId || !appUser) return setSearchResults([])
      
      const { data } = await supabase.from('inventory_items')
        .select('id, barcode, metal_type, mrp, status, warehouse_id, purity_karat, hsn_code, gross_weight_g, net_weight_g, total_stone_weight_cts')
        .eq('company_id', appUser.company_id).eq('warehouse_id', selectedWarehouseId).eq('status', 'in_stock')
        .ilike('barcode', `%${itemSearchTerm.trim()}%`).limit(10)
      setSearchResults(data || [])
    }
    const timeoutId = setTimeout(() => searchItems(), 300)
    return () => clearTimeout(timeoutId)
  }, [itemSearchTerm, selectedWarehouseId, appUser])

  const handleScan = async (barcode: string) => {
    if (!barcode.trim()) return toast.error('Type a barcode first.')
    if (!selectedWarehouseId) return toast.error('Select a Vault Location.')

    try {
      const { data: item, error } = await supabase.from('inventory_items')
        .select('id, barcode, metal_type, mrp, status, warehouse_id, purity_karat, hsn_code, gross_weight_g, net_weight_g, total_stone_weight_cts')
        .ilike('barcode', barcode.trim()).eq('company_id', appUser?.company_id).maybeSingle()

      if (error) throw error
      if (!item) return toast.error(`Barcode doesn't exist.`)
      if (item.warehouse_id !== selectedWarehouseId) return toast.error(`Item is in a different branch!`)
      if (item.status !== 'in_stock') return toast.error(`Item is marked as: ${item.status}.`)

      if (cart.find(c => c.barcode === item.barcode)) return toast.error('Already in cart.')
      
      setCart(prev => [...prev, item])
      toast.success(`${item.barcode} added to terminal.`)
      setBarcodeInput('')
      setItemSearchTerm('')
    } catch (err) {
      toast.error('Database query failed.')
    }
  }

  const handleFetchExchangeItem = async () => {
    if (!exchangeBarcode.trim() || !appUser) return toast.error('Enter an old barcode.')
    try {
      const { data: itemData, error: itemErr } = await supabase.from('inventory_items')
        .select('id, barcode, mrp, metal_type, purity_karat, gross_weight_g')
        .ilike('barcode', exchangeBarcode.trim())
        .eq('company_id', appUser.company_id).maybeSingle()

      if (itemErr) throw itemErr
      if (!itemData) return toast.error('Old item not found in registry.')

      const { data: invoiceData } = await supabase.from('invoice_items')
        .select('rate').eq('item_id', itemData.id).order('id', { ascending: false }).limit(1).maybeSingle()

      const historicalValue = invoiceData?.rate || itemData.mrp

      setExchangeValue(historicalValue.toString())
      setExchangeNotes(`Buyback: ${itemData.metal_type} ${itemData.purity_karat || ''} (${itemData.gross_weight_g}g) - [${itemData.barcode}]`)
      toast.success(`Exchange value fetched: ₹${historicalValue}`)
    } catch (err) {
      toast.error('Failed to fetch original billed item.')
    }
  }

  // --- VOUCHER ENGINE ---
  const handleApplyVoucher = () => {
    if (!voucherCode.trim()) return;
    // Standard mock logic - change to DB check if needed
    if (voucherCode.toUpperCase().startsWith('SAVE')) {
      setActiveVoucher({ code: voucherCode.toUpperCase(), amount: 1000 })
      setVoucherCode('')
      toast.success('Voucher value applied to final payable.')
    } else {
      toast.error('Invalid Voucher Code')
    }
  }

  // --- UPDATED MATH CALCULATIONS ---
  const subtotal = cart.reduce((sum, item) => sum + item.mrp, 0)
  const discountNum = parseFloat(discountValue) || 0
  const discountAmount = discountType === 'percent' ? (subtotal * discountNum) / 100 : discountNum
  
  // 1. Taxable Value handles item discounts
  const taxableValue = Math.max(0, subtotal - discountAmount)
  
  // 2. Taxes calculated on discounted value
  const cgstAmount = taxableValue * 0.015
  const sgstAmount = taxableValue * 0.015
  const totalWithGst = taxableValue + cgstAmount + sgstAmount

  // 3. Post-Tax Deductions (Exchange + Voucher)
  const exchangeNum = parseFloat(exchangeValue) || 0
  const voucherAmount = activeVoucher ? activeVoucher.amount : 0
  const finalPayable = Math.max(0, totalWithGst - exchangeNum - voucherAmount)

  const handleCheckout = async () => {
    if (!appUser || cart.length === 0) return toast.error('Cart is empty')
    if (!selectedCustomer) return toast.error('Please select a customer')

    setIsProcessing(true)
    try {
      const invoiceData = {
        customer_id: selectedCustomer.id,
        warehouse_id: selectedWarehouseId,
        items: cart.map((item) => ({ item_id: item.id, rate: item.mrp })),
        payment_mode: paymentMode,
        subtotal: subtotal,
        discount_amount: discountAmount,
        voucher_code: activeVoucher?.code || null,
        voucher_discount: voucherAmount,
        taxable_value: taxableValue,
        cgst_amount: cgstAmount,
        sgst_amount: sgstAmount,
        exchange_value: exchangeNum, 
        exchange_notes: exchangeNotes,
        exchange_barcode: exchangeBarcode.trim() || null, 
        final_total: finalPayable
      }

      const { data, error } = await callRpc('pos_confirm_sale', {
        p_invoice_json: invoiceData,
        p_user_id: appUser.user_id,
      })
      
      if (error) throw error;

      setLastInvoiceData({
        invoice_number: data?.invoice_number,
        date: new Date(),
        customer: selectedCustomer,
        items: cart.map(i => ({
          mrp: i.mrp, barcode: i.barcode, metal_type: i.metal_type, purity: i.purity_karat,
          hsn_code: i.hsn_code || '7113', gross_wt: i.gross_weight_g || 0, net_wt: i.net_weight_g || 0,
          dia_wt: i.total_stone_weight_cts || 0
        })),
        subtotal, discountAmount, voucherAmount, taxableValue, cgstAmount, sgstAmount, 
        exchangeValue: exchangeNum, finalTotal: finalPayable
      })

      // CLEAR TERMINAL
      setCart([]); setSelectedCustomer(null); setSearchCustomer(''); setDiscountValue(''); 
      setActiveVoucher(null); setExchangeValue(''); setExchangeNotes(''); setExchangeBarcode('');
      setIsExchangeOpen(false); 
      
      setShowPrintModal(true) 
    } catch (err: any) {
      toast.error(err.message || 'Checkout failed.')
    } finally {
      setIsProcessing(false)
    }
  }

  if (loading || !appUser) return null

  return (
    <div className="h-screen flex flex-col gap-0 overflow-hidden bg-background">
      
      {/* COMPACT IDE TOOLBAR */}
      <header className="z-40 w-full bg-card border-b border-border px-4 h-12 flex items-center justify-between shrink-0 shadow-sm relative">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="h-7 w-7 rounded bg-primary flex items-center justify-center shadow-inner">
            <Receipt className="h-3.5 w-3.5 text-primary-foreground" />
          </div>
          <Separator orientation="vertical" className="h-4" />
          <div className="flex items-center gap-2">
            <Building className="w-3.5 h-3.5 text-muted-foreground" />
            <Select value={selectedWarehouseId} onValueChange={setSelectedWarehouseId}>
              <SelectTrigger className="h-7 border-none bg-secondary/50 focus:ring-0 font-bold text-xs uppercase tracking-widest px-3">
                <SelectValue placeholder="Identify Node..." />
              </SelectTrigger>
              <SelectContent>{warehouses.map(w => <SelectItem key={w.id} value={w.id} className="text-xs uppercase font-bold">{w.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex items-center gap-2">
           <Badge variant="outline" className="text-[9px] font-black uppercase tracking-[0.2em] border-emerald-200 text-emerald-600 bg-emerald-50/30">Encryption Active</Badge>
           <Button variant="ghost" size="sm" className="h-8 text-[10px] font-black uppercase tracking-widest text-red-500 hover:bg-red-50" 
            onClick={() => { setCart([]); setDiscountValue(''); setActiveVoucher(null); setSelectedCustomer(null); }}>
            Wipe Terminal
          </Button>
        </div>
      </header>

      <div className="flex-1 grid grid-cols-12 overflow-hidden">
        
        {/* LEFT PANEL: SCAN & CART */}
        <div className="col-span-7 flex flex-col border-r border-border bg-slate-50/30 overflow-hidden">
          
          {/* SEARCH/SCAN INPUT AREA */}
          <div className="p-4 border-b border-border bg-background space-y-4">
            <div className="space-y-1.5 relative">
              <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.2em] ml-1">Universal Search</Label>
              <div className="relative group">
                 <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                 <Input 
                   placeholder="SCAN BARCODE OR TYPE ITEM ATTRIBUTES..." 
                   className="h-11 pl-10 bg-secondary/30 border-border focus-visible:bg-background font-mono text-xs uppercase tracking-wider"
                   value={itemSearchTerm} onChange={(e) => setItemSearchTerm(e.target.value)}
                 />
              </div>
              
              {searchResults.length > 0 && itemSearchTerm && (
                <div className="absolute top-full left-0 mt-1 w-full bg-card border border-border rounded-md shadow-2xl z-[100] max-h-[300px] overflow-y-auto">
                  {searchResults.map(item => (
                    <div key={item.id} className="p-3 border-b border-border/40 hover:bg-secondary/50 cursor-pointer flex items-center justify-between" onClick={() => handleScan(item.barcode)}>
                      <div className="flex flex-col">
                        <span className="font-mono text-xs font-black text-foreground tracking-widest">{item.barcode}</span>
                        <span className="text-[9px] font-bold text-muted-foreground uppercase">{item.metal_type} · {item.purity_karat}</span>
                      </div>
                      <div className="text-sm font-black text-foreground">₹{item.mrp.toLocaleString()}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-3">
               <div className="flex-1 relative group">
                  <ScanLine className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary animate-pulse" />
                  <Input 
                    placeholder="HARDWARE LASER READY..." 
                    className="h-10 pl-10 font-mono text-xs bg-primary/5 border-primary/20 focus-visible:ring-primary uppercase text-center tracking-[0.3em] font-black"
                    value={barcodeInput} onChange={(e) => setBarcodeInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleScan(barcodeInput)}
                  />
               </div>
               <Button variant="outline" className="h-10 px-4 border-border shadow-sm"><Camera className="h-4 w-4 mr-2" /> Vision</Button>
            </div>
          </div>

          {/* CART VIEW */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center opacity-20 grayscale scale-90">
                 <ScanLine className="h-16 w-16 mb-4" />
                 <p className="text-xs font-black uppercase tracking-widest">Awaiting Line Items</p>
              </div>
            ) : (
              cart.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-card border border-border/60 rounded animate-in fade-in slide-in-from-left-2">
                  <div className="flex items-center gap-4">
                    <div className="h-9 w-9 rounded bg-secondary border border-border flex items-center justify-center font-black text-[10px] text-muted-foreground">
                      {item.metal_type.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-mono font-black text-sm tracking-tighter">{item.barcode}</p>
                      <p className="text-[9px] font-bold text-muted-foreground uppercase">{item.metal_type} | {item.purity_karat}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                       <p className="text-sm font-black text-foreground">₹{item.mrp.toLocaleString()}</p>
                       <p className="text-[9px] font-bold text-emerald-600 uppercase tracking-tighter">Gross: {item.gross_weight_g}g</p>
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground/40 hover:text-red-500 hover:bg-red-50" onClick={() => setCart(cart.filter((_, i) => i !== idx))}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* RIGHT PANEL: BILLING & CHECKOUT */}
        <div className="col-span-5 bg-card flex flex-col overflow-hidden">
          
          <div className="flex-1 overflow-y-auto p-5 space-y-6 custom-scrollbar">
            
            {/* CUSTOMER REGISTRY */}
            <div className="space-y-2 relative">
              <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">Client Identification</Label>
              {selectedCustomer ? (
                <div className="flex items-center justify-between bg-primary/5 border border-primary/20 p-3 rounded-md animate-in zoom-in-95">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-black text-xs uppercase">
                      {selectedCustomer.full_name[0]}
                    </div>
                    <div>
                      <p className="text-sm font-black text-foreground leading-none">{selectedCustomer.full_name}</p>
                      <p className="text-[10px] text-muted-foreground font-mono mt-1 tracking-wider">{selectedCustomer.phone}</p>
                    </div>
                  </div>
                  <Button size="icon" variant="ghost" className="h-7 w-7 rounded-full text-primary hover:bg-primary/10" onClick={() => setSelectedCustomer(null)}><X className="h-4 w-4" /></Button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <div className="relative flex-1 group">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                    <Input placeholder="SEARCH DIRECTORY..." value={searchCustomer} onChange={(e) => setSearchCustomer(e.target.value)} className="h-10 pl-9 text-xs border-border bg-secondary/20 font-bold uppercase tracking-tight" />
                  </div>
                  <Button variant="outline" className="h-10 px-4 border-border shadow-sm" onClick={() => setIsAddCustomerOpen(true)}><Plus className="h-4 w-4" /></Button>
                </div>
              )}
              {searchCustomer && !selectedCustomer && (
                <div className="absolute top-full left-0 mt-1 w-full bg-card border border-border rounded shadow-2xl z-[150] overflow-hidden">
                  {customers.filter(c => c.full_name.toLowerCase().includes(searchCustomer.toLowerCase()) || c.phone.includes(searchCustomer)).map(c => (
                    <div key={c.id} className="p-3 border-b border-border/40 hover:bg-secondary/50 cursor-pointer flex justify-between items-center" onClick={() => { setSelectedCustomer(c); setSearchCustomer(''); }}>
                      <span className="font-bold text-xs uppercase tracking-tight">{c.full_name}</span>
                      <span className="text-[10px] text-muted-foreground font-mono">{c.phone}</span>
                    </div>
                  ))}
                  <div className="p-3 bg-secondary/30 text-center text-[10px] font-black text-primary uppercase tracking-widest cursor-pointer hover:bg-secondary" onClick={() => setIsAddCustomerOpen(true)}>
                    + Enroll New Member
                  </div>
                </div>
              )}
            </div>

            {/* ADJUSTMENTS Matrix */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                 <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">Manual Yield</Label>
                 <div className="flex overflow-hidden rounded-md border border-border h-10 shadow-sm">
                    <select className="bg-secondary/30 border-r border-border text-[10px] font-black px-2 outline-none focus:bg-background" value={discountType} onChange={(e: any) => setDiscountType(e.target.value)}>
                      <option value="percent">%</option>
                      <option value="flat">₹</option>
                    </select>
                    <Input type="number" placeholder="0.00" className="border-none h-full text-xs font-black focus-visible:ring-0 bg-secondary/10" value={discountValue} onChange={(e) => setDiscountValue(e.target.value)} />
                 </div>
              </div>
              <div className="space-y-2">
                 <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">Voucher Credit</Label>
                 {activeVoucher ? (
                  <div className="flex items-center justify-between bg-emerald-500/10 border border-emerald-500/20 h-10 px-3 rounded-md animate-in slide-in-from-right-2">
                    <span className="text-[10px] font-black text-emerald-700 tracking-widest">{activeVoucher.code}</span>
                    <X className="h-3.5 w-3.5 cursor-pointer text-emerald-700" onClick={() => setActiveVoucher(null)} />
                  </div>
                ) : (
                  <div className="flex gap-1 relative group">
                    <Ticket className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors z-10" />
                    <Input placeholder="CODE" className="h-10 pl-9 text-[10px] font-black uppercase tracking-[0.2em] border-border bg-secondary/20" value={voucherCode} onChange={(e) => setVoucherCode(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleApplyVoucher()} />
                    <Button variant="secondary" className="h-10 w-10 p-0 border border-border shadow-sm bg-card" onClick={handleApplyVoucher}><CheckCircle2 className="h-4 w-4"/></Button>
                  </div>
                )}
              </div>
            </div>

            {/* LIFETIME EXCHANGE */}
            <div className={`rounded-md border-2 transition-all overflow-hidden ${isExchangeOpen ? 'border-purple-500/30 bg-purple-500/5' : 'border-border/60 bg-secondary/10'}`}>
               <button 
                 className="w-full flex items-center justify-between p-3 text-[10px] font-black uppercase tracking-widest text-slate-700 outline-none"
                 onClick={() => setIsExchangeOpen(!isExchangeOpen)}
               >
                 <div className="flex items-center gap-2">
                   <RefreshCw className={`h-3.5 w-3.5 ${isExchangeOpen ? 'animate-spin' : ''}`} /> 
                   Buyback Protocol 
                   {exchangeNum > 0 && <Badge className="ml-2 bg-purple-600 h-4 text-[8px] uppercase">₹{exchangeNum}</Badge>}
                 </div>
                 {isExchangeOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
               </button>
               
               {isExchangeOpen && (
                 <div className="p-3 pt-0 space-y-3 animate-in fade-in duration-300">
                    <div className="flex gap-2">
                      <Input placeholder="SCAN OLD BARCODE..." className="h-9 text-[10px] font-black tracking-widest border-purple-200 bg-white uppercase" value={exchangeBarcode} onChange={(e) => setExchangeBarcode(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleFetchExchangeItem()} />
                      <Button variant="secondary" size="sm" className="h-9 bg-purple-600 hover:bg-purple-700 text-white text-[9px] font-black uppercase tracking-widest px-4" onClick={handleFetchExchangeItem}>Audit Item</Button>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <Input type="number" placeholder="CREDIT ₹" className="h-9 text-xs font-black border-purple-200 bg-white" value={exchangeValue} onChange={(e) => setExchangeValue(e.target.value)} />
                      <Input placeholder="REASON / NOTES" className="col-span-2 h-9 text-[10px] font-bold border-purple-200 bg-white" value={exchangeNotes} onChange={(e) => setExchangeNotes(e.target.value)} />
                    </div>
                 </div>
               )}
            </div>

            {/* SETTLEMENT MODE */}
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">Settlement Layer</Label>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { id: 'cash', label: 'Cash', icon: Banknote },
                  { id: 'card', label: 'Card', icon: CreditCard },
                  { id: 'upi', label: 'UPI QR', icon: QrCode },
                  { id: 'bank', label: 'IMPS', icon: Building },
                ].map((method) => {
                  const isActive = paymentMode === method.id;
                  return (
                    <button
                      key={method.id} onClick={() => setPaymentMode(method.id)}
                      className={`flex flex-col items-center justify-center gap-1.5 h-14 border transition-all rounded-md shadow-sm ${
                        isActive ? 'bg-foreground border-foreground text-background scale-[1.02] shadow-lg' : 'bg-card border-border text-muted-foreground hover:bg-secondary'
                      }`}
                    >
                      <method.icon className="h-4 w-4" />
                      <span className="text-[8px] font-black uppercase tracking-widest">{method.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          {/* LEDGER & ACTIONS */}
          <div className="p-5 border-t border-border bg-secondary/10 space-y-4">
             <div className="space-y-1.5">
                <div className="flex justify-between items-center text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                  <span>Line Item Total</span>
                  <span className="text-foreground">₹{subtotal.toLocaleString()}</span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between items-center text-[10px] font-black text-red-500 uppercase tracking-wider">
                    <span>Manual Yield Adjustment</span>
                    <span>- ₹{discountAmount.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between items-center text-xs font-black text-foreground uppercase border-y border-border/60 py-2">
                  <span>Taxable Basis</span>
                  <span>₹{taxableValue.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center text-[10px] font-bold text-muted-foreground uppercase pt-1">
                  <span>GST Liability (3% Agg.)</span>
                  <span className="text-foreground">+ ₹{(cgstAmount + sgstAmount).toLocaleString()}</span>
                </div>
                {(exchangeNum > 0 || voucherAmount > 0) && (
                   <div className="space-y-1 mt-2 pt-2 border-t border-border/40">
                      {exchangeNum > 0 && (
                        <div className="flex justify-between items-center text-[10px] font-black text-purple-700 uppercase tracking-widest">
                          <span>Buyback Protocol Credit</span>
                          <span>- ₹{exchangeNum.toLocaleString()}</span>
                        </div>
                      )}
                      {voucherAmount > 0 && (
                        <div className="flex justify-between items-center text-[10px] font-black text-emerald-600 uppercase tracking-widest">
                          <span>Voucher Authorization</span>
                          <span>- ₹{voucherAmount.toLocaleString()}</span>
                        </div>
                      )}
                   </div>
                )}
             </div>

             <div className="flex justify-between items-end py-2">
                <div>
                   <p className="text-[9px] font-black uppercase text-muted-foreground tracking-[0.3em]">Final Settlement</p>
                   <p className="text-4xl font-black tracking-tighter text-foreground">₹{finalPayable.toLocaleString()}</p>
                </div>
                <div className="text-right">
                   <p className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Selected Mode</p>
                   <p className="text-xs font-black uppercase text-primary">{paymentMode}</p>
                </div>
             </div>

             <Button 
                onClick={handleCheckout} 
                disabled={isProcessing || cart.length === 0} 
                className="w-full bg-foreground text-background hover:bg-foreground/90 font-black text-sm h-14 rounded shadow-xl transition-transform active:scale-[0.98] flex items-center justify-center gap-3 uppercase tracking-widest"
              >
                {isProcessing ? <Loader2 className="h-5 w-5 animate-spin" /> : <><CheckCircle2 className="h-5 w-5"/> Authorize & Commit</>}
              </Button>
          </div>
        </div>
      </div>

      {/* --- MODALS --- */}
      <Dialog open={isAddCustomerOpen} onOpenChange={setIsAddCustomerOpen}>
        <DialogContent className="sm:max-w-[500px] border-none shadow-2xl p-0 overflow-hidden">
          <DialogHeader className="bg-secondary/50 p-6 border-b">
            <DialogTitle className="text-lg font-black uppercase tracking-tight">Client Enrollment</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 p-6 bg-card">
            <div className="space-y-1.5 col-span-2">
              <Label className="text-[10px] font-bold text-muted-foreground uppercase">Legal Full Name</Label>
              <Input placeholder="John Doe" className="h-9 border-border bg-secondary/10 font-bold" value={newCustForm.full_name} onChange={(e) => setNewCustForm({...newCustForm, full_name: e.target.value})} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold text-muted-foreground uppercase">Contact Number</Label>
              <Input placeholder="+91 00000 00000" className="h-9 border-border bg-secondary/10 font-bold" value={newCustForm.phone} onChange={(e) => setNewCustForm({...newCustForm, phone: e.target.value})} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold text-muted-foreground uppercase">Date of Birth</Label>
              <Input type="date" className="h-9 border-border bg-secondary/10" value={newCustForm.birth_date} onChange={(e) => setNewCustForm({...newCustForm, birth_date: e.target.value})} />
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label className="text-[10px] font-bold text-muted-foreground uppercase">Permanent Address</Label>
              <Input placeholder="Building, Street..." className="h-9 border-border bg-secondary/10 font-medium" value={newCustForm.address} onChange={(e) => setNewCustForm({...newCustForm, address: e.target.value})} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold text-muted-foreground uppercase">Residential City</Label>
              <Input placeholder="City" className="h-9 border-border bg-secondary/10 font-bold" value={newCustForm.city} onChange={(e) => setNewCustForm({...newCustForm, city: e.target.value})} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold text-muted-foreground uppercase">Identity (PAN)</Label>
              <Input placeholder="ABCDE1234F" className="h-9 border-border bg-secondary/10 font-mono font-bold uppercase" value={newCustForm.pan_no} onChange={(e) => setNewCustForm({...newCustForm, pan_no: e.target.value})} />
            </div>
          </div>
          <DialogFooter className="p-6 bg-secondary/20 border-t">
            <Button variant="ghost" className="text-xs font-bold uppercase tracking-widest" onClick={() => setIsAddCustomerOpen(false)}>Discard</Button>
            <Button onClick={handleAddCustomer} className="h-10 px-8 font-black text-xs uppercase tracking-widest shadow-md">Register & Select</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showPrintModal} onOpenChange={setShowPrintModal}>
        <DialogContent className="sm:max-w-[400px] border-none p-0 overflow-hidden">
          <div className="flex flex-col items-center justify-center p-8 text-center space-y-6 bg-card">
            <div className="w-20 h-20 bg-emerald-500 text-background rounded-full flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <CheckCircle2 className="h-10 w-10" />
            </div>
            <div className="space-y-2">
               <h2 className="text-2xl font-black uppercase tracking-tight">Sale Locked</h2>
               <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest italic">Invoice #{lastInvoiceData?.invoice_number}</p>
            </div>
            <div className="w-full flex gap-3">
              <Button onClick={() => setShowPrintModal(false)} variant="outline" className="flex-1 font-bold text-xs uppercase tracking-widest border-border h-11">New Terminal</Button>
              <Button onClick={handlePrint} className="flex-1 font-black text-xs uppercase tracking-widest h-11 shadow-lg"><Printer className="h-4 w-4 mr-2"/> Dispatch Bill</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* REUSABLE PRINT TEMPLATE INTEGRATION */}
      <InvoicePrintTemplate ref={printRef} data={lastInvoiceData} />

    </div>
  )
}

function Loader2(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("animate-spin", props.className)}
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  )
}