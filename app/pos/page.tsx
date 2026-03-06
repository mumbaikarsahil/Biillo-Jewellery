'use client'

import React, { useEffect, useState, useRef } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { 
  Select, SelectContent, SelectItem, 
  SelectTrigger, SelectValue 
} from '@/components/ui/select'
import { 
  Dialog, DialogContent, DialogHeader, 
  DialogTitle, DialogFooter, DialogDescription 
} from '@/components/ui/dialog'
import { supabase } from '@/lib/supabaseClient'
import { fetchCustomers } from '@/lib/api'
import { useRpc } from '@/hooks/useRpc'
import { useToast } from '@/hooks/use-toast'
import { useReactToPrint } from 'react-to-print'
import { 
  Trash2, ScanLine, Camera,
  X, Receipt, Search, Plus, CheckCircle2, Printer,
  Banknote, CreditCard, QrCode, Building, Keyboard, RefreshCw, ChevronDown, ChevronUp
} from 'lucide-react'

// IMPORT THE SHARED PRINT COMPONENT
import { InvoicePrintTemplate } from '@/components/InvoicePrintTemplate'

// ADDED NEW FIELDS HERE
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
  const { toast } = useToast()
  
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
  const [isExchangeOpen, setIsExchangeOpen] = useState(false) // NEW TOGGLE STATE
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
        toast({ title: 'Error', description: 'Failed to load initial data.', variant: 'destructive' })
      }
    }
    init()
  }, [appUser, toast])

  // --- CUSTOMER LOGIC ---
  const handleAddCustomer = async () => {
    if (!newCustForm.full_name || !newCustForm.phone) {
      return toast({ title: 'Validation', description: 'Name and Phone are required.', variant: 'destructive' })
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
      toast({ title: 'Success', description: 'New customer registered.' })
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
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
    if (!barcode.trim()) return toast({ title: 'Empty Input', description: 'Type a barcode first.', variant: 'destructive' })
    if (!selectedWarehouseId) return toast({ title: 'Locked', description: 'Select a Vault Location.', variant: 'destructive' })

    try {
      const { data: item, error } = await supabase.from('inventory_items')
        .select('id, barcode, metal_type, mrp, status, warehouse_id, purity_karat, hsn_code, gross_weight_g, net_weight_g, total_stone_weight_cts')
        .ilike('barcode', barcode.trim()).eq('company_id', appUser?.company_id).maybeSingle()

      if (error) throw error
      if (!item) return toast({ title: 'Not Found', description: `Barcode doesn't exist.`, variant: 'destructive' })
      if (item.warehouse_id !== selectedWarehouseId) return toast({ title: 'Wrong Vault', description: `Item is in a different branch!`, variant: 'destructive' })
      if (item.status !== 'in_stock') return toast({ title: 'Not Available', description: `Item is marked as: ${item.status}.`, variant: 'destructive' })

      if (cart.find(c => c.barcode === item.barcode)) return toast({ title: 'Duplicate', description: 'Already in cart.', variant: 'destructive' })
      
      setCart(prev => [...prev, item])
      toast({ title: 'Added', description: `${item.barcode} added.` })
      setBarcodeInput('')
      setItemSearchTerm('')
    } catch (err) {
      toast({ title: 'Error', description: 'Database query failed.', variant: 'destructive' })
    }
  }

  // --- FETCH OLD EXCHANGE ITEM ---
  const handleFetchExchangeItem = async () => {
    if (!exchangeBarcode.trim() || !appUser) return toast({ title: 'Empty', description: 'Enter an old barcode.', variant: 'destructive' })
    
    try {
      const { data: itemData, error: itemErr } = await supabase.from('inventory_items')
        .select('id, barcode, mrp, metal_type, purity_karat, gross_weight_g')
        .ilike('barcode', exchangeBarcode.trim())
        .eq('company_id', appUser.company_id)
        .maybeSingle()

      if (itemErr) throw itemErr
      if (!itemData) return toast({ title: 'Not Found', description: 'Old item not found in database.', variant: 'destructive' })

      const { data: invoiceData } = await supabase.from('invoice_items')
        .select('rate')
        .eq('item_id', itemData.id)
        .order('id', { ascending: false })
        .limit(1)
        .maybeSingle()

      const historicalValue = invoiceData?.rate || itemData.mrp

      setExchangeValue(historicalValue.toString())
      setExchangeNotes(`Buyback: ${itemData.metal_type} ${itemData.purity_karat || ''} (${itemData.gross_weight_g}g) - [${itemData.barcode}]`)
      toast({ title: 'Item Found', description: `Exchange value set to actual billed rate: ₹${historicalValue}. You can edit this if needed.` })
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to fetch original billed item.', variant: 'destructive' })
    }
  }

  // --- MATH & CHECKOUT ---
  const handleApplyVoucher = () => {
    if (voucherCode.toUpperCase().startsWith('OFFER')) {
      setActiveVoucher({ code: voucherCode.toUpperCase(), amount: 500 })
      setVoucherCode('')
    } else toast({ title: 'Invalid Voucher', variant: 'destructive' })
  }

  const subtotal = cart.reduce((sum, item) => sum + item.mrp, 0)
  const discountNum = parseFloat(discountValue) || 0
  const discountAmount = discountType === 'percent' ? (subtotal * discountNum) / 100 : discountNum
  const voucherAmount = activeVoucher ? activeVoucher.amount : 0
  
  const taxableValue = Math.max(0, subtotal - discountAmount - voucherAmount)
  
  const cgstAmount = taxableValue * 0.015
  const sgstAmount = taxableValue * 0.015
  const totalWithGst = taxableValue + cgstAmount + sgstAmount

  const exchangeNum = parseFloat(exchangeValue) || 0
  const finalPayable = Math.max(0, totalWithGst - exchangeNum)

  const handleCheckout = async () => {
    if (!appUser || cart.length === 0) return toast({ title: 'Error', description: 'Cart is empty', variant: 'destructive' })
    if (!selectedCustomer) return toast({ title: 'Error', description: 'Please select a customer', variant: 'destructive' })
    if (!selectedWarehouseId) return toast({ title: 'Error', description: 'Please select a Branch/Vault', variant: 'destructive' }) // Added security check

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
      
      if (error) {
        console.error("RPC Error Details:", error); // This logs the EXACT database error
        throw error;
      }

      setLastInvoiceData({
        invoice_number: data?.invoice_number,
        date: new Date(),
        customer: selectedCustomer,
        items: cart.map(i => ({
          mrp: i.mrp,
          barcode: i.barcode,
          metal_type: i.metal_type,
          purity: i.purity_karat,
          hsn_code: i.hsn_code || '7113',
          gross_wt: i.gross_weight_g || 0,
          net_wt: i.net_weight_g || 0,
          dia_wt: i.total_stone_weight_cts || 0
        })),
        subtotal, discountAmount, voucherAmount, taxableValue, cgstAmount, sgstAmount, 
        exchangeValue: exchangeNum,
        finalTotal: finalPayable
      })

      // CLEAR TERMINAL
      setCart([]); setSelectedCustomer(null); setSearchCustomer(''); setDiscountValue(''); 
      setActiveVoucher(null); setExchangeValue(''); setExchangeNotes(''); setExchangeBarcode('');
      setIsExchangeOpen(false); 
      
      setShowPrintModal(true) 
    } catch (err: any) {
      console.error("Checkout Failed:", err);
      // Now the toast will show the exact PostgreSQL error message
      toast({ title: 'Checkout Failed', description: err.message || 'Check browser console.', variant: 'destructive' })
    } finally {
      setIsProcessing(false)
    }
  }

  // --- RENDER ---
  if (loading || !appUser) return null

  return (
    <div className="h-[calc(100vh-2rem)] flex flex-col gap-3 p-3 overflow-hidden bg-slate-50 min-w-[1024px]">
      
      {/* HEADER BAR */}
      <div className="flex items-center justify-between bg-white p-2.5 rounded-lg border border-slate-200 shadow-sm shrink-0">
        <div className="flex items-center gap-6">
          <h1 className="text-xl font-black tracking-tight text-slate-900 flex items-center gap-2 pl-2">
            <Receipt className="w-5 h-5 text-primary" /> POS Terminal
          </h1>
          <div className="h-5 w-px bg-slate-200" />
          <div className="flex items-center gap-2">
            <Building className="w-4 h-4 text-slate-400" />
            <Select value={selectedWarehouseId} onValueChange={setSelectedWarehouseId}>
              <SelectTrigger className="w-[180px] h-8 border-none bg-slate-50 focus:ring-0 font-bold text-slate-700">
                <SelectValue placeholder="Loading..." />
              </SelectTrigger>
              <SelectContent>{warehouses.map(w => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <Button variant="ghost" size="sm" className="text-red-500 hover:bg-red-50 h-8 font-semibold" 
          onClick={() => { 
            setCart([]); setDiscountValue(''); setActiveVoucher(null); setSelectedCustomer(null); 
            setSearchCustomer(''); setExchangeValue(''); setExchangeNotes(''); setExchangeBarcode(''); setIsExchangeOpen(false);
          }}>
          Clear Terminal
        </Button>
      </div>

      <div className="flex-1 grid grid-cols-12 gap-3 overflow-hidden">
        
        {/* COLUMN 1: SCANNER & CART (Left - 7 columns) */}
        <div className="col-span-7 flex flex-col gap-3 overflow-hidden">
          
          {/* INPUT ITEMS BLOCK */}
          <Card className="shrink-0 border-slate-200 shadow-sm overflow-visible bg-white">
            <CardHeader className="py-2.5 px-3 border-b bg-slate-50/50 shrink-0">
              <CardTitle className="text-xs font-bold flex items-center gap-1.5 text-slate-700">
                <Keyboard className="w-3.5 h-3.5 text-primary" /> Input Items
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 space-y-4">
              <div className="space-y-1.5 relative z-50">
                <label className="text-[10px] font-bold uppercase text-slate-500 tracking-widest flex items-center gap-1">
                  <Search className="w-3 h-3" /> Live Item Search
                </label>
                <Input 
                  placeholder="Type barcode or item name..." className="h-12 font-mono text-sm bg-slate-50 border-slate-300 shadow-inner focus-visible:ring-primary"
                  value={itemSearchTerm} onChange={(e) => setItemSearchTerm(e.target.value)}
                />
                {searchResults.length > 0 && itemSearchTerm && (
                  <div className="absolute top-full left-0 mt-1 w-full bg-white border border-slate-200 rounded-md shadow-2xl max-h-[300px] overflow-y-auto">
                    {searchResults.map(item => (
                      <div key={item.id} className="p-3 border-b hover:bg-slate-50 cursor-pointer flex flex-col" onClick={() => handleScan(item.barcode)}>
                        <div className="flex justify-between items-center">
                          <span className="font-mono text-sm font-bold text-slate-800">{item.barcode}</span>
                          <span className="text-sm text-primary font-bold">₹{item.mrp}</span>
                        </div>
                        <span className="text-[10px] uppercase font-semibold text-slate-400 mt-0.5">{item.metal_type}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase text-slate-500 tracking-widest block">Hardware Scanners</label>
                <div className="flex gap-3">
                  <Button variant="outline" className="flex-1 h-10 flex items-center justify-center gap-2 border-slate-300 hover:bg-slate-50" onClick={() => toast({ description: "Camera module ready." })}>
                    <Camera className="w-4 h-4 text-slate-600" />
                    <span className="text-xs font-bold text-slate-700">Camera Scan</span>
                  </Button>
                  <div className="flex-1 relative group">
                    <ScanLine className="w-4 h-4 text-primary absolute left-3 top-1/2 -translate-y-1/2 z-10 group-focus-within:text-blue-600 transition-colors" />
                    <Input 
                      autoFocus placeholder="IR Laser Active..." 
                      className="h-10 pl-9 font-mono text-xs bg-blue-50/50 border-blue-200 uppercase focus-visible:ring-blue-500 focus-visible:border-blue-500 transition-all text-center tracking-widest text-blue-900 placeholder:text-blue-400"
                      value={barcodeInput} onChange={(e) => setBarcodeInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleScan(barcodeInput)}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ACTIVE CART BLOCK */}
          <Card className="flex-1 flex flex-col border-slate-200 shadow-sm overflow-hidden bg-white">
            <CardHeader className="py-2.5 px-3 border-b bg-slate-50/50 flex flex-row justify-between items-center shrink-0">
              <CardTitle className="text-xs font-bold text-slate-700">Shopping Cart</CardTitle>
              <Badge variant="secondary" className="font-mono text-[10px] h-5 bg-white border shadow-sm text-slate-700">{cart.length} Items</Badge>
            </CardHeader>
            <CardContent className="p-0 flex-1 overflow-y-auto bg-slate-50/30">
              {cart.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-300 p-8 space-y-2">
                  <div className="p-3 bg-white rounded-full border border-slate-100 shadow-sm"><ScanLine className="w-8 h-8 text-slate-300" /></div>
                  <p className="text-xs font-medium">Cart is waiting for items...</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {cart.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2.5 bg-white hover:bg-slate-50 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-slate-500 text-[9px] uppercase shadow-sm">
                          {item.metal_type.substring(0, 2)}
                        </div>
                        <div>
                          <p className="font-mono font-bold text-xs text-slate-900">{item.barcode}</p>
                          <p className="text-[9px] font-semibold text-slate-500 uppercase">{item.metal_type}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <p className="font-black text-sm text-slate-900">₹{item.mrp.toLocaleString()}</p>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-red-400 hover:text-red-600 hover:bg-red-50" onClick={() => setCart(cart.filter((_, i) => i !== idx))}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* COLUMN 2: CHECKOUT & BILLING PANEL */}
        <Card className="col-span-5 flex flex-col border-slate-200 shadow-sm overflow-hidden bg-white h-full">
          <CardHeader className="py-2.5 px-3 border-b bg-slate-50/50 shrink-0 shadow-sm z-10">
            <CardTitle className="text-xs font-bold flex items-center gap-1.5 text-slate-800">
              <Receipt className="w-3.5 h-3.5 text-primary" /> Checkout
            </CardTitle>
          </CardHeader>
          
          <CardContent className="p-2.5 flex-1 flex flex-col justify-between gap-2.5 overflow-hidden overflow-y-auto">
            
            {/* 1. CUSTOMER INFO BLOCK */}
            <div className="bg-slate-50 p-2 rounded border border-slate-200 relative shrink-0">
              <label className="text-[9px] font-bold uppercase tracking-widest text-slate-500 mb-1 block">Customer Info</label>
              {selectedCustomer ? (
                <div className="flex items-center justify-between bg-white border border-slate-200 p-1.5 rounded shadow-sm">
                  <div>
                    <p className="text-xs font-bold text-slate-900 leading-none">{selectedCustomer.full_name}</p>
                    <p className="text-[9px] text-slate-500 font-mono mt-0.5">{selectedCustomer.phone}</p>
                  </div>
                  <Button size="icon" variant="ghost" className="h-5 w-5 text-slate-400 hover:text-red-600" onClick={() => setSelectedCustomer(null)}><X className="w-3 h-3" /></Button>
                </div>
              ) : (
                <div className="flex gap-1.5">
                  <Input placeholder="Mobile No. or Name" value={searchCustomer} onChange={(e) => setSearchCustomer(e.target.value)} className="h-9 text-xs bg-white" />
                  <Button variant="outline" className="h-9 px-3 bg-white" onClick={() => setIsAddCustomerOpen(true)}><Plus className="w-3.5 h-3.5" /></Button>
                </div>
              )}
              {searchCustomer && !selectedCustomer && (
                <div className="absolute top-full left-0 mt-1 w-full bg-white border border-slate-200 rounded shadow-xl z-50 max-h-[150px] overflow-y-auto">
                  {customers.filter(c => c.full_name.toLowerCase().includes(searchCustomer.toLowerCase()) || c.phone.includes(searchCustomer)).map(c => (
                    <div key={c.id} className="p-2.5 border-b hover:bg-slate-50 cursor-pointer" onClick={() => { setSelectedCustomer(c); setSearchCustomer(''); }}>
                      <p className="font-bold text-xs text-slate-800">{c.full_name}</p>
                      <p className="text-[9px] text-slate-500 font-mono">{c.phone}</p>
                    </div>
                  ))}
                  <div className="p-2.5 bg-slate-50 text-center text-[10px] font-bold text-primary cursor-pointer hover:bg-slate-100" onClick={() => setIsAddCustomerOpen(true)}>
                    + New Customer
                  </div>
                </div>
              )}
            </div>

            {/* 2. DISCOUNTS & OFFERS */}
            <div className="grid grid-cols-2 gap-2 shrink-0">
              <div className="bg-slate-50 p-2 rounded border border-slate-200">
                 <label className="text-[9px] font-bold uppercase text-slate-500 mb-1 block">Manual Disc.</label>
                 <div className="flex gap-1">
                  <select className="border border-slate-200 rounded px-1 text-[10px] font-bold w-10 bg-white outline-none" value={discountType} onChange={(e: any) => setDiscountType(e.target.value)}>
                    <option value="percent">%</option>
                    <option value="flat">₹</option>
                  </select>
                  <Input type="number" placeholder="0" className="h-8 text-xs font-mono px-2 bg-white" value={discountValue} onChange={(e) => setDiscountValue(e.target.value)} />
                </div>
              </div>
              <div className="bg-slate-50 p-2 rounded border border-slate-200">
                 <label className="text-[9px] font-bold uppercase text-slate-500 mb-1 block">Promo Code</label>
                 {activeVoucher ? (
                  <div className="flex items-center justify-between bg-green-50 border border-green-200 h-8 px-2 rounded">
                    <span className="text-[10px] font-bold text-green-700">{activeVoucher.code}</span>
                    <X className="w-3 h-3 cursor-pointer text-green-700" onClick={() => setActiveVoucher(null)} />
                  </div>
                ) : (
                  <div className="flex gap-1">
                    <Input placeholder="CODE" className="h-8 text-[10px] uppercase font-mono px-2 bg-white" value={voucherCode} onChange={(e) => setVoucherCode(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleApplyVoucher()} />
                    <Button variant="secondary" className="h-8 w-8 p-0 shrink-0 bg-white" onClick={handleApplyVoucher}><CheckCircle2 className="w-3.5 h-3.5"/></Button>
                  </div>
                )}
              </div>
            </div>

            {/* 3. EXCHANGE BLOCK (COLLAPSIBLE) */}
            <div className="bg-purple-50/50 p-2 rounded border border-purple-200 shrink-0 transition-all">
               <button 
                 className="w-full flex items-center justify-between text-[9px] font-bold uppercase text-purple-700 hover:text-purple-900 outline-none"
                 onClick={() => setIsExchangeOpen(!isExchangeOpen)}
               >
                 <div className="flex items-center gap-1.5">
                   <RefreshCw className="w-3.5 h-3.5" /> Lifetime Buyback Exchange
                   {exchangeNum > 0 && !isExchangeOpen && (
                     <Badge variant="outline" className="ml-2 h-4 text-[8px] border-purple-300 text-purple-700 bg-purple-100">Active</Badge>
                   )}
                 </div>
                 {isExchangeOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
               </button>
               
               {isExchangeOpen && (
                 <div className="space-y-2 mt-2 pt-2 border-t border-purple-200/50">
                   <div className="flex gap-2">
                     <Input 
                       placeholder="Scan Old Barcode..." 
                       className="h-8 text-xs font-mono bg-white border-purple-200 focus-visible:ring-purple-500 w-1/2 uppercase shadow-inner" 
                       value={exchangeBarcode} onChange={(e) => setExchangeBarcode(e.target.value)} 
                       onKeyDown={(e) => e.key === 'Enter' && handleFetchExchangeItem()}
                     />
                     <Button variant="secondary" size="sm" className="h-8 bg-purple-100 hover:bg-purple-200 text-purple-700 text-xs flex-1 shadow-sm" onClick={handleFetchExchangeItem}>
                        Fetch Billed Value
                     </Button>
                   </div>
                   <div className="flex gap-2">
                     <Input 
                       type="number" placeholder="Value (₹)" 
                       className="h-8 text-xs font-mono bg-white border-purple-200 focus-visible:ring-purple-500 w-1/3 shadow-inner" 
                       value={exchangeValue} onChange={(e) => setExchangeValue(e.target.value)} 
                     />
                     <Input 
                       placeholder="Notes / Override Reason" 
                       className="h-8 text-xs bg-white border-purple-200 focus-visible:ring-purple-500 flex-1 shadow-inner" 
                       value={exchangeNotes} onChange={(e) => setExchangeNotes(e.target.value)} 
                     />
                   </div>
                 </div>
               )}
            </div>

            {/* 4. PAYMENT MODE GRID */}
            <div className="bg-slate-50 p-2 rounded border border-slate-200 shrink-0 mt-auto">
              <label className="text-[9px] font-bold uppercase tracking-widest text-slate-500 mb-1.5 block">Payment Mode</label>
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  { id: 'cash', label: 'Cash', icon: Banknote },
                  { id: 'card', label: 'Card', icon: CreditCard },
                  { id: 'upi', label: 'UPI QR', icon: QrCode },
                  { id: 'bank', label: 'Transfer', icon: Building },
                ].map((method) => {
                  const Icon = method.icon;
                  const isActive = paymentMode === method.id;
                  return (
                    <Button
                      key={method.id} variant="outline" onClick={() => setPaymentMode(method.id)}
                      className={`flex items-center justify-center gap-1.5 h-8 border transition-all rounded ${
                        isActive ? 'bg-slate-900 border-slate-900 text-white shadow-sm' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                      <span className="text-[10px] font-bold">{method.label}</span>
                    </Button>
                  )
                })}
              </div>
            </div>

            {/* 5. TOTALS & FINAL ACTION */}
            <div className="bg-slate-50 border border-slate-200 rounded p-3 shadow-sm flex flex-col justify-end shrink-0">
              <div className="space-y-0.5 mb-1.5 border-b border-slate-200 pb-2">
                <div className="flex justify-between text-slate-500 text-xs">
                  <span>Subtotal ({cart.length})</span>
                  <span className="font-bold text-slate-800">₹{subtotal.toFixed(2)}</span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between text-red-500 text-[10px] font-medium"><span>Discount</span><span>- ₹{discountAmount.toFixed(2)}</span></div>
                )}
                {voucherAmount > 0 && (
                  <div className="flex justify-between text-green-600 text-[10px] font-medium"><span>Voucher</span><span>- ₹{voucherAmount.toFixed(2)}</span></div>
                )}
                <div className="flex justify-between text-slate-800 text-xs font-bold pt-1.5">
                  <span>Taxable Value</span>
                  <span>₹{taxableValue.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-500 text-[10px] pt-0.5">
                  <span>CGST (1.5%)</span>
                  <span>+ ₹{cgstAmount.toFixed(2)}</span>
                </div>
                <div className={`flex justify-between text-slate-500 text-[10px] pb-1 ${exchangeNum > 0 ? 'border-b border-slate-200' : ''}`}>
                  <span>SGST (1.5%)</span>
                  <span>+ ₹{sgstAmount.toFixed(2)}</span>
                </div>
                {exchangeNum > 0 && (
                  <div className="flex justify-between text-purple-700 text-[11px] font-bold pt-1.5">
                    <span>Exchange Value</span>
                    <span>- ₹{exchangeNum.toFixed(2)}</span>
                  </div>
                )}
              </div>
              
              <div className="flex justify-between items-end pb-2 pt-0.5">
                <span className="text-slate-800 font-black text-sm">Payable</span>
                <span className="font-black text-2xl tracking-tighter text-slate-900 leading-none">₹{finalPayable.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
              </div>

              <Button 
                onClick={handleCheckout} 
                disabled={isProcessing || cart.length === 0} 
                className="w-full bg-slate-900 hover:bg-black text-white font-black text-base h-12 rounded shadow-md transition-transform active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2 mt-1"
              >
                {isProcessing ? 'Processing...' : <><Printer className="w-4 h-4"/> Confirm & Print</>}
              </Button>
            </div>

          </CardContent>
        </Card>
      </div>

      {/* --- MODALS & HIDDEN PRINT COMPONENTS --- */}
      <Dialog open={isAddCustomerOpen} onOpenChange={setIsAddCustomerOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Register New Customer</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 pt-4">
            <div className="space-y-2 col-span-2">
              <label className="text-xs font-bold text-slate-500 uppercase">Full Name *</label>
              <Input placeholder="John Doe" value={newCustForm.full_name} onChange={(e) => setNewCustForm({...newCustForm, full_name: e.target.value})} />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase">Phone Number *</label>
              <Input placeholder="+91 99999 99999" value={newCustForm.phone} onChange={(e) => setNewCustForm({...newCustForm, phone: e.target.value})} />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase">D.O.B</label>
              <Input type="date" value={newCustForm.birth_date} onChange={(e) => setNewCustForm({...newCustForm, birth_date: e.target.value})} />
            </div>
            <div className="space-y-2 col-span-2">
              <label className="text-xs font-bold text-slate-500 uppercase">Full Address</label>
              <Input placeholder="Flat, Building, Street..." value={newCustForm.address} onChange={(e) => setNewCustForm({...newCustForm, address: e.target.value})} />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase">City</label>
              <Input placeholder="Mumbai" value={newCustForm.city} onChange={(e) => setNewCustForm({...newCustForm, city: e.target.value})} />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase">PAN No.</label>
              <Input placeholder="ABCDE1234F" className="uppercase font-mono" value={newCustForm.pan_no} onChange={(e) => setNewCustForm({...newCustForm, pan_no: e.target.value})} />
            </div>
          </div>
          <DialogFooter className="mt-6">
            <Button variant="outline" onClick={() => setIsAddCustomerOpen(false)}>Cancel</Button>
            <Button onClick={handleAddCustomer} className="bg-slate-900 text-white">Save & Select</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showPrintModal} onOpenChange={setShowPrintModal}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogTitle className="sr-only">Sale Complete</DialogTitle>
          <div className="flex flex-col items-center justify-center p-6 text-center space-y-4">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-slate-900" />
            </div>
            <h2 className="text-2xl font-black text-slate-900">Sale Complete!</h2>
            <p className="text-slate-500">Invoice {lastInvoiceData?.invoice_number} generated successfully.</p>
            <div className="w-full flex gap-3 pt-4">
              <Button onClick={() => setShowPrintModal(false)} variant="outline" className="flex-1 font-bold">New Sale</Button>
              <Button onClick={handlePrint} className="flex-1 font-bold bg-slate-900 text-white"><Printer className="w-4 h-4 mr-2"/> Print Bill</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* REUSABLE PRINT TEMPLATE INTEGRATION */}
      <InvoicePrintTemplate ref={printRef} data={lastInvoiceData} />

    </div>
  )
}