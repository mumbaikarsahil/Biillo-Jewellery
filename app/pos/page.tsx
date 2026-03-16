'use client'

import React, { useEffect, useState, useRef } from 'react'
import { format } from 'date-fns' // <-- ADDED THIS

import { useAuth } from '@/hooks/useAuth'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { cn } from "@/lib/utils"
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

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
  Trash2, ScanLine, Camera, X, Receipt, Search, Plus, CheckCircle2, Printer,
  Banknote, CreditCard, QrCode, Building, RefreshCw, ChevronDown, ChevronUp, 
  Ticket, ShoppingCart, FileText, Hammer, Truck, AlertTriangle, ShieldAlert,
  Loader2
} from 'lucide-react'

// IMPORT THE SHARED PRINT COMPONENT
import { InvoicePrintTemplate } from '@/components/InvoicePrintTemplate'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

type BillingMode = 'normal' | 'estimate' | 'custom' | 'challan'

interface CartItem {
  id: string
  barcode: string
  sku_reference?: string
  metal_type: string
  mrp: number
  purity_karat?: string
  hsn_code?: string
  gross_weight_g?: number
  net_weight_g?: number
  total_stone_weight_cts?: number
  tax_percent?: number
  status?: string
  warehouse_id?: string
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
  
  // --- CORE SYSTEM STATE ---
  const [mode, setMode] = useState<BillingMode>('normal')
  const [warehouses, setWarehouses] = useState<{id: string, name: string}[]>([])
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('')
  const [cart, setCart] = useState<CartItem[]>([])
  const [paymentMode, setPaymentMode] = useState('cash')
  const [isProcessing, setIsProcessing] = useState(false)
  
  // --- CUSTOM ORDER STATE ---
  const [customOrderDetails, setCustomOrderDetails] = useState({
    designCode: '', category: '', expectedGoldWt: '', expectedDiamondCts: '', estimatedValue: '', advancePayment: ''
  })

  // --- CUSTOMER STATE ---
  const [customers, setCustomers] = useState<Customer[]>([])
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [searchCustomer, setSearchCustomer] = useState('')
  const [isAddCustomerOpen, setIsAddCustomerOpen] = useState(false)
  const [newCustForm, setNewCustForm] = useState({ 
    full_name: '', phone: '', city: '', address: '', pan_no: '', birth_date: '' 
  })
  
  // --- INPUT STATE ---
  const [barcodeInput, setBarcodeInput] = useState('')
  const [itemSearchTerm, setItemSearchTerm] = useState('')
  const [searchResults, setSearchResults] = useState<CartItem[]>([])
  
  // --- ADJUSTMENTS STATE ---
  const [discountType, setDiscountType] = useState<'percent' | 'flat'>('percent')
  const [discountValue, setDiscountValue] = useState<string>('')
  
  // Voucher State
  const [voucherCode, setVoucherCode] = useState('')
  const [activeVoucher, setActiveVoucher] = useState<{ id: string, code: string, amount: number } | null>(null)
  const [handlingFee, setHandlingFee] = useState<string>('0')

  // Exchange State
  const [isExchangeOpen, setIsExchangeOpen] = useState(false)
  const [exchangeMode, setExchangeMode] = useState<'buyback' | 'exchange'>('exchange')
  const [exchangeHistoricalValue, setExchangeHistoricalValue] = useState<number>(0)
  const [exchangeBarcode, setExchangeBarcode] = useState<string>('')
  const [exchangeValue, setExchangeValue] = useState<string>('')
  const [exchangeNotes, setExchangeNotes] = useState<string>('')
  

  // --- PRINT STATE ---
  const printRef = useRef<HTMLDivElement>(null)
  const [showPrintModal, setShowPrintModal] = useState(false)
  const [lastInvoiceData, setLastInvoiceData] = useState<any>(null)

  const handlePrint = useReactToPrint({ contentRef: printRef })

  // UI Theme Config (Windows 10 / Modern Enterprise Style)
  const modeConfig = {
    normal: { bg: 'bg-[#0078D7]', border: 'border-[#0078D7]', hover: 'hover:bg-[#005A9E]', text: 'text-[#0078D7]', badge: 'Tax Invoice' },
    estimate: { bg: 'bg-[#D83B01]', border: 'border-[#D83B01]', hover: 'hover:bg-[#A80000]', text: 'text-[#D83B01]', badge: 'Proforma Estimate' },
    custom: { bg: 'bg-[#881798]', border: 'border-[#881798]', hover: 'hover:bg-[#5C005C]', text: 'text-[#881798]', badge: 'Advance Receipt' },
    challan: { bg: 'bg-[#107C10]', border: 'border-[#107C10]', hover: 'hover:bg-[#0B5A0B]', text: 'text-[#107C10]', badge: 'Delivery Challan' },
  }
  const currentTheme = modeConfig[mode]

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
    if (!newCustForm.full_name || !newCustForm.phone) return toast.error('Name and Phone are required.')
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
      toast.success('New client registered.')
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  // --- ITEM SCANNING & SEARCH ---
  useEffect(() => {
    const searchItems = async () => {
      if (!itemSearchTerm.trim() || !appUser) return setSearchResults([])
      
      const { data, error } = await supabase.from('inventory_items')
        .select('id, barcode, sku_reference, metal_type, mrp, status, warehouse_id, purity_karat, hsn_code, gross_weight_g, net_weight_g, total_stone_weight_cts')
        .eq('company_id', appUser.company_id)
        .eq('status', 'in_stock') // <-- ADDED: Only show in-stock items
        .or(`barcode.ilike.%${itemSearchTerm.trim()}%,sku_reference.ilike.%${itemSearchTerm.trim()}%`) // <-- ADDED: Search SKU too
        .limit(15)

      if (error) console.error("Search Error:", error)
      setSearchResults(data || [])
    }
    const timeoutId = setTimeout(() => searchItems(), 300)
    return () => clearTimeout(timeoutId)
  }, [itemSearchTerm, appUser])

  const processScannedItem = (item: CartItem) => {
    if (cart.find(c => c.barcode === item.barcode)) return toast.error(`Item ${item.barcode} is already in the cart.`)
    if (item.warehouse_id !== selectedWarehouseId) return toast.error(`Cannot sell item: Resides in a different branch!`)
    if (mode !== 'challan' && item.status !== 'in_stock') return toast.error(`Cannot sell item. Current status is: ${item.status?.replace('_', ' ').toUpperCase()}`)

    setCart(prev => [{...item, tax_percent: 3, mrp: item.mrp || 0}, ...prev])
    toast.success(`${item.barcode} added to bill.`)
    setBarcodeInput('')
    setItemSearchTerm('')
    setSearchResults([]) 
  }

  const handleHardwareScan = async (barcode: string) => {
    if (!barcode.trim()) return toast.error('Type a barcode first.')
    if (!selectedWarehouseId) return toast.error('Select a Vault Location.')

    try {
      const { data: item, error } = await supabase.from('inventory_items')
        .select('id, barcode, sku_reference, metal_type, mrp, status, warehouse_id, purity_karat, hsn_code, gross_weight_g, net_weight_g, total_stone_weight_cts')
        .ilike('barcode', barcode.trim())
        .eq('company_id', appUser?.company_id)
        .maybeSingle()

      if (error) throw error
      if (!item) return toast.error(`Barcode doesn't exist in registry.`)

      processScannedItem(item)
    } catch (err) {
      toast.error('Database query failed.')
    }
  }

  // --- EXCHANGE & BUYBACK LOGIC ---
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
      setExchangeHistoricalValue(historicalValue) // <-- Save original value

      // Calculate based on mode
      const multiplier = exchangeMode === 'buyback' ? 0.70 : 1.00
      const finalVal = historicalValue * multiplier

      setExchangeValue(finalVal.toString())
      setExchangeNotes(`${exchangeMode.toUpperCase()} (${multiplier*100}%): ${itemData.metal_type} ${itemData.purity_karat || ''} (${itemData.gross_weight_g}g) - [${itemData.barcode}]`)
      toast.success(`Found historical value: ₹${historicalValue}. Calculated ${multiplier*100}% = ₹${finalVal}`)
    } catch (err) {
      toast.error('Failed to fetch original billed item.')
    }
  }

  useEffect(() => {
    if (exchangeHistoricalValue > 0) {
      const multiplier = exchangeMode === 'buyback' ? 0.70 : 1.00
      const finalVal = exchangeHistoricalValue * multiplier
      setExchangeValue(finalVal.toString())
      setExchangeNotes(prev => prev.replace(/BUYBACK \(70%\)|EXCHANGE \(100%\)/, `${exchangeMode.toUpperCase()} (${multiplier*100}%)`))
    }
  }, [exchangeMode, exchangeHistoricalValue])

  

  // Recalculate exchange value if user toggles Buyback/Exchange AFTER fetching
  useEffect(() => {
    if (exchangeHistoricalValue > 0) {
      const multiplier = exchangeMode === 'buyback' ? 0.70 : 1.00
      const finalVal = exchangeHistoricalValue * multiplier
      setExchangeValue(finalVal.toString())
      setExchangeNotes(prev => prev.replace(/BUYBACK \(70%\)|EXCHANGE \(100%\)/, `${exchangeMode.toUpperCase()} (${multiplier*100}%)`))
    }
  }, [exchangeMode])


  // --- VOUCHER LOGIC ---
  const handleApplyVoucher = async () => {
    if (!voucherCode.trim()) return;
    
    // --- NEW: URL STRIPPING LOGIC ---
    // If the laser scanner reads the full QR URL, extract just the code
    let codeToSearch = voucherCode.trim();
    if (codeToSearch.includes('?code=')) {
      codeToSearch = codeToSearch.split('?code=')[1].split('&')[0];
    }
    
    try {
      const { data: voucher, error } = await supabase
        .from('vouchers')
        .select(`
          id, code, discount_value, handling_fee, status, customer_id,
          customers ( id, full_name, phone )
        `)
        .ilike('code', codeToSearch) // <-- Use the extracted code here
        .maybeSingle()
      
      if (error) throw error
      if (!voucher) return toast.error('Voucher code not found in system.')
      
      if (voucher.status !== 'registered') {
        return toast.error(`Voucher is ${voucher.status.toUpperCase()}. It must be activated online first.`)
      }

      // 1. Check if the customer data exists
      if (voucher.customer_id && voucher.customers) {
        
        // 2. Typecast the nested Supabase response so TypeScript knows what it is
        const rawCust = Array.isArray(voucher.customers) ? voucher.customers[0] : voucher.customers;
        const vCustomer = rawCust as { id: string, full_name: string, phone: string };

        if (!selectedCustomer) {
          // Auto-load customer into POS
          setSelectedCustomer({
            id: vCustomer.id,
            full_name: vCustomer.full_name,
            phone: vCustomer.phone
          })
          toast.success(`Customer auto-loaded from voucher profile.`)
        } else if (selectedCustomer.id !== voucher.customer_id) {
          return toast.error(`Fraud Alert: Voucher registered to ${vCustomer.full_name}.`)
        }
      }

      setActiveVoucher({ id: voucher.id, code: voucher.code, amount: voucher.discount_value })
      setHandlingFee(voucher.handling_fee?.toString() || '0') // <-- Auto set handling fee
      setVoucherCode('')
      toast.success(`Valid Voucher Applied! ₹${voucher.discount_value.toLocaleString()} Credit.`)
    } catch (err) {
      toast.error('Failed to validate voucher code.')
    }
  }

  // --- MATH ENGINE CALCULATIONS ---
  const subtotal = cart.reduce((sum, item) => sum + (item.mrp || 0), 0)
  const discountNum = parseFloat(discountValue) || 0
  const discountAmount = discountType === 'percent' ? (subtotal * discountNum) / 100 : discountNum
  
  let baseTaxable = Math.max(0, subtotal - discountAmount)
  const exchangeNum = parseFloat(exchangeValue) || 0
  baseTaxable = Math.max(0, baseTaxable - exchangeNum)

  const voucherAmount = activeVoucher ? activeVoucher.amount : 0
  const handlingAmt = parseFloat(handlingFee) || 0
  
  let finalTaxableValue = 0
  let appliedVoucherAmount = 0

  if (activeVoucher) {
      if (voucherAmount > baseTaxable) {
          // Voucher is bigger than cart: Customer only pays the handling fee
          finalTaxableValue = handlingAmt;
          appliedVoucherAmount = baseTaxable; 
      } else {
          // Normal logic: Deduct voucher, add handling fee to taxable amount
          finalTaxableValue = (baseTaxable - voucherAmount) + handlingAmt;
          appliedVoucherAmount = voucherAmount;
      }
  } else {
      finalTaxableValue = baseTaxable;
  }

  const cgstAmount = finalTaxableValue * 0.015
  const sgstAmount = finalTaxableValue * 0.015
  const finalPayable = finalTaxableValue + cgstAmount + sgstAmount

  // --- UNIFIED CHECKOUT LOGIC ---
  const handleCheckout = async () => {
    if (!appUser) return toast.error('Unauthorized')
    if (mode !== 'custom' && cart.length === 0) return toast.error('Cart is empty')
    if (mode === 'custom' && !customOrderDetails.designCode) return toast.error('Design code required')
    if (!selectedCustomer) return toast.error('Please select a customer or SIS Partner')

    setIsProcessing(true)
    try {
      let finalInvoiceNo = ''

      if (mode === 'normal') {
        const invoiceData = {
          customer_id: selectedCustomer.id,
          warehouse_id: selectedWarehouseId,
          items: cart.map((item) => ({ item_id: item.id, rate: item.mrp })),
          payment_mode: paymentMode,
          subtotal: subtotal,
          discount_amount: discountAmount,
          voucher_code: activeVoucher?.code || null,
          voucher_discount: appliedVoucherAmount,
          taxable_value: finalTaxableValue,
          cgst_amount: cgstAmount,
          sgst_amount: sgstAmount,
          exchange_value: exchangeNum, 
          exchange_notes: exchangeNotes,
          exchange_barcode: exchangeBarcode.trim() || null, 
          final_total: finalPayable
        }
        
        // Custom RPC call expecting it handles voucher marking as redeemed internally
        const { data, error } = await callRpc('pos_confirm_sale', { p_invoice_json: invoiceData, p_user_id: appUser.user_id })
        if (error) throw error
        finalInvoiceNo = data?.invoice_number || `INV-${Date.now().toString().slice(-6)}`
        
        // Mark Voucher Redeemed manually if the RPC doesn't do it
        if (activeVoucher) {
          await supabase.from('vouchers').update({ status: 'redeemed', redeemed_at: new Date().toISOString() }).eq('id', activeVoucher.id)
        }

        toast.success("Tax Invoice Generated!")

      } else if (mode === 'estimate') {
        finalInvoiceNo = `EST-${Date.now().toString().slice(-6)}`
        toast.success("Estimate generated (No inventory deducted).")

      } else if (mode === 'challan') {
        finalInvoiceNo = `CHL-${Date.now().toString().slice(-6)}`
        const itemIds = cart.map(c => c.id)
        const { error } = await supabase.from('inventory_items').update({ status: 'sold_unbilled' }).in('id', itemIds)
        if (error) throw error
        toast.success("Delivery Challan issued. Items unbilled.")

      } else if (mode === 'custom') {
        finalInvoiceNo = `JB-CUST-${Date.now().toString().slice(-6)}`
        const { error } = await supabase.from('job_bags').insert({
          company_id: appUser.company_id,
          job_bag_number: finalInvoiceNo,
          product_category: customOrderDetails.category,
          design_code: customOrderDetails.designCode,
          gold_expected_weight_g: Number(customOrderDetails.expectedGoldWt),
          diamond_expected_weight_cts: Number(customOrderDetails.expectedDiamondCts),
          status: 'open',
          karigar_id: null
        })
        if (error) throw error
        toast.success("Advance Receipt created & Job Bag Initiated.")
      }

      setLastInvoiceData({
        mode: mode,
        invoice_number: finalInvoiceNo,
        date: new Date(),
        customer: selectedCustomer,
        items: cart.map(i => ({
          mrp: i.mrp, barcode: i.barcode, metal_type: i.metal_type, purity: i.purity_karat,
          hsn_code: i.hsn_code || '7113', gross_wt: i.gross_weight_g || 0, net_wt: i.net_weight_g || 0,
          dia_wt: i.total_stone_weight_cts || 0
        })),
        customOrder: mode === 'custom' ? customOrderDetails : null,
        subtotal, discountAmount, voucherAmount: appliedVoucherAmount, handlingFee: handlingAmt, 
        taxableValue: finalTaxableValue, cgstAmount, sgstAmount, 
        exchangeValue: exchangeNum, finalTotal: mode === 'custom' ? Number(customOrderDetails.advancePayment) : finalPayable
      })

      // CLEAR TERMINAL
      setCart([]); setSelectedCustomer(null); setSearchCustomer(''); setDiscountValue(''); 
      setActiveVoucher(null); setHandlingFee('0'); setExchangeValue(''); setExchangeNotes(''); setExchangeBarcode('');
      setIsExchangeOpen(false); setExchangeHistoricalValue(0);
      setCustomOrderDetails({ designCode: '', category: '', expectedGoldWt: '', expectedDiamondCts: '', estimatedValue: '', advancePayment: '' })
      
      setShowPrintModal(true) 
    } catch (err: any) {
      toast.error(err.message || 'Checkout failed.')
    } finally {
      setIsProcessing(false)
    }
  }

  if (loading || !appUser) return <div className="h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-[#0078D7]" /></div>

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-[#E6E6E6] text-slate-900 font-sans">
      
      {/* WINDOWS APP HEADER */}
      <header className="z-40 w-full bg-[#2B2B2B] text-white px-4 h-12 flex items-center justify-between shrink-0 shadow-md">
        <div className="flex items-center gap-4">
          <div className="h-7 w-7 bg-[#0078D7] flex items-center justify-center rounded-sm">
            <Receipt className="h-4 w-4 text-white" />
          </div>
          <div>
             <h1 className="font-semibold text-sm tracking-wide leading-none">Biillo Unified POS Terminal</h1>
          </div>
          <Separator orientation="vertical" className="h-5 bg-slate-600 hidden sm:block" />
          <div className="flex items-center gap-2">
            <Building className="w-4 h-4 text-slate-400 hidden sm:block" />
            <Select value={selectedWarehouseId} onValueChange={setSelectedWarehouseId}>
              <SelectTrigger className="h-8 border-none bg-transparent hover:bg-slate-700 focus:ring-0 text-xs uppercase px-2 w-[140px] sm:w-[180px] rounded-none">
                <SelectValue placeholder="Identify Node..." />
              </SelectTrigger>
              <SelectContent className="rounded-none border-slate-300">
                {warehouses.map(w => <SelectItem key={w.id} value={w.id} className="text-xs uppercase">{w.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex items-center gap-4">
           <span className="text-xs text-slate-400 hidden md:block">{format(new Date(), 'EEEE, dd MMM yyyy')}</span>
           <Button variant="ghost" size="sm" className="h-8 rounded-sm text-xs font-semibold text-red-400 hover:text-white hover:bg-red-600" 
            onClick={() => { setCart([]); setDiscountValue(''); setActiveVoucher(null); setSelectedCustomer(null); setExchangeValue(''); setExchangeBarcode(''); setExchangeHistoricalValue(0); }}>
            Wipe Session
          </Button>
        </div>
      </header>

      {/* MODE TABS (Windows 10 Ribbon Style) */}
      <div className="bg-white border-b border-slate-300 px-2 pt-2 shrink-0">
        <Tabs value={mode} onValueChange={(v) => setMode(v as BillingMode)} className="w-full">
          <TabsList className="flex h-auto bg-transparent p-0 gap-1 overflow-x-auto justify-start">
            <TabsTrigger value="normal" className="rounded-t-sm rounded-b-none border border-b-0 border-transparent data-[state=active]:border-slate-300 data-[state=active]:bg-slate-100 data-[state=active]:text-[#0078D7] text-slate-600 px-4 py-2 font-semibold text-xs transition-none hover:bg-slate-50">
              <ShoppingCart className="w-4 h-4 mr-2" /> Tax Invoice (Sale)
            </TabsTrigger>
            <TabsTrigger value="estimate" className="rounded-t-sm rounded-b-none border border-b-0 border-transparent data-[state=active]:border-slate-300 data-[state=active]:bg-slate-100 data-[state=active]:text-[#D83B01] text-slate-600 px-4 py-2 font-semibold text-xs transition-none hover:bg-slate-50">
              <FileText className="w-4 h-4 mr-2" /> Proforma Estimate
            </TabsTrigger>
            <TabsTrigger value="custom" className="rounded-t-sm rounded-b-none border border-b-0 border-transparent data-[state=active]:border-slate-300 data-[state=active]:bg-slate-100 data-[state=active]:text-[#881798] text-slate-600 px-4 py-2 font-semibold text-xs transition-none hover:bg-slate-50">
              <Hammer className="w-4 h-4 mr-2" /> Custom Order
            </TabsTrigger>
            <TabsTrigger value="challan" className="rounded-t-sm rounded-b-none border border-b-0 border-transparent data-[state=active]:border-slate-300 data-[state=active]:bg-slate-100 data-[state=active]:text-[#107C10] text-slate-600 px-4 py-2 font-semibold text-xs transition-none hover:bg-slate-50">
              <Truck className="w-4 h-4 mr-2" /> Delivery Challan
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden p-2 gap-2">
        
        {/* LEFT PANEL: CART OR FORM */}
        <div className="flex-1 flex flex-col bg-white border border-slate-300 shadow-sm overflow-hidden rounded-sm">
          
          {mode === 'custom' ? (
            // CUSTOM ORDER FORM UI
            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-slate-50">
              <div className="max-w-2xl mx-auto space-y-6 bg-white border border-slate-300 shadow-sm rounded-sm p-6">
                <div className="border-b border-slate-200 pb-4 mb-4">
                  <h2 className="text-lg font-semibold text-[#881798] flex items-center gap-2">
                    <Hammer className="w-5 h-5" /> Initiate Custom Fabrication
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">Capture advance payment and forward specifications to manufacturing.</p>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-slate-700">Design Ref / Name</Label>
                    <Input placeholder="e.g. Vintage Solitaire Ring" className="h-9 rounded-sm border-slate-300 focus-visible:ring-[#881798]" value={customOrderDetails.designCode} onChange={e => setCustomOrderDetails({...customOrderDetails, designCode: e.target.value})} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-slate-700">Ornament Type</Label>
                    <Input placeholder="e.g. Ring, Necklace" className="h-9 rounded-sm border-slate-300 focus-visible:ring-[#881798]" value={customOrderDetails.category} onChange={e => setCustomOrderDetails({...customOrderDetails, category: e.target.value})} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-slate-700">Expected Gold (g)</Label>
                    <Input type="number" placeholder="0.000" className="h-9 rounded-sm border-slate-300 focus-visible:ring-[#881798]" value={customOrderDetails.expectedGoldWt} onChange={e => setCustomOrderDetails({...customOrderDetails, expectedGoldWt: e.target.value})} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-slate-700">Expected Diamond (cts)</Label>
                    <Input type="number" placeholder="0.00" className="h-9 rounded-sm border-slate-300 focus-visible:ring-[#881798]" value={customOrderDetails.expectedDiamondCts} onChange={e => setCustomOrderDetails({...customOrderDetails, expectedDiamondCts: e.target.value})} />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-100 p-4 border border-slate-200 mt-4 rounded-sm">
                  <div className="space-y-1">
                    <Label className="text-xs font-bold text-slate-800">Estimated Total Value (₹)</Label>
                    <Input type="number" placeholder="0.00" className="h-10 text-base font-bold rounded-sm border-slate-300" value={customOrderDetails.estimatedValue} onChange={e => setCustomOrderDetails({...customOrderDetails, estimatedValue: e.target.value})} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-bold text-[#881798]">Advance Received (₹)</Label>
                    <Input type="number" placeholder="0.00" className="h-10 text-base font-bold rounded-sm border-[#881798] focus-visible:ring-[#881798]" value={customOrderDetails.advancePayment} onChange={e => setCustomOrderDetails({...customOrderDetails, advancePayment: e.target.value})} />
                  </div>
                </div>
              </div>
            </div>
          ) : (
            // STANDARD CART UI
            <>
              {/* SEARCH/SCAN INPUT AREA */}
              <div className="p-3 bg-slate-100 border-b border-slate-300 space-y-3 shrink-0">
                <div className="flex gap-2 relative">
                  <div className="relative flex-1 group z-20">
                     <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                     <Input 
                       placeholder="Search by Barcode, Name, or SKU..." 
                       className="h-9 pl-9 rounded-sm border-slate-300 focus-visible:ring-[#0078D7] text-sm"
                       value={itemSearchTerm} onChange={(e) => setItemSearchTerm(e.target.value)}
                     />
                     {searchResults.length > 0 && itemSearchTerm && (
                      <div className="absolute top-full left-0 mt-1 w-full bg-white border border-slate-300 shadow-lg max-h-[300px] overflow-y-auto rounded-sm">
                        {searchResults.map(item => {
                           const isAvailable = item.status === 'in_stock'
                           const isHere = item.warehouse_id === selectedWarehouseId
                           return (
                            <div key={item.id} className="p-2 border-b border-slate-100 hover:bg-slate-50 cursor-pointer flex items-center justify-between" onClick={() => processScannedItem(item)}>
                              <div className="flex flex-col">
                                <span className="font-mono text-sm font-bold text-slate-800">{item.barcode}</span>
                                <span className="text-[10px] text-slate-500 uppercase">{item.sku_reference || item.metal_type} · {item.purity_karat}</span>
                              </div>
                              <div className="flex flex-col items-end">
                                <div className="text-sm font-bold text-slate-800">₹{(item.mrp || 0).toLocaleString()}</div>
                                {!isAvailable && <span className="text-[9px] text-red-600 font-bold uppercase">{item.status?.replace('_', ' ')}</span>}
                                {isAvailable && !isHere && <span className="text-[9px] text-amber-600 font-bold uppercase">Other Branch</span>}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                  <div className="relative w-1/3">
                      <ScanLine className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#0078D7]" />
                      <Input 
                        placeholder="Barcode Reader..." 
                        className="h-9 pl-9 rounded-sm border-[#0078D7] focus-visible:ring-[#0078D7] font-mono text-xs uppercase"
                        value={barcodeInput} onChange={(e) => setBarcodeInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleHardwareScan(barcodeInput)}
                      />
                   </div>
                </div>
              </div>

              {/* CART TABLE */}
              <div className="flex-1 overflow-auto bg-white custom-scrollbar">
                <Table>
                  <TableHeader className="bg-slate-100 sticky top-0 border-b border-slate-300 z-10 shadow-sm">
                    <TableRow className="hover:bg-slate-100">
                      <TableHead className="w-[40px] p-2"></TableHead>
                      <TableHead className="text-xs font-semibold text-slate-600 p-2">Item ID & Details</TableHead>
                      <TableHead className="text-xs font-semibold text-slate-600 p-2 text-right">Net Wt</TableHead>
                      <TableHead className="text-xs font-semibold text-slate-600 p-2 text-right">Tax</TableHead>
                      <TableHead className="text-xs font-semibold text-slate-600 p-2 text-right pr-4">MRP (₹)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cart.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="h-[400px] text-center">
                           <ShoppingCart className="h-12 w-12 text-slate-200 mx-auto mb-3" />
                           <p className="text-sm font-semibold text-slate-400">Cart is empty</p>
                        </TableCell>
                      </TableRow>
                    ) : (
                      cart.map((item, idx) => (
                        <TableRow key={idx} className="border-b border-slate-200 hover:bg-slate-50">
                          <TableCell className="p-2">
                            <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-400 hover:text-red-600 rounded-sm" onClick={() => setCart(cart.filter((_, i) => i !== idx))}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </TableCell>
                          <TableCell className="p-2">
                            <p className="font-mono text-sm font-bold text-slate-800">{item.barcode}</p>
                            <p className="text-[10px] text-slate-500 uppercase">{item.sku_reference} | {item.metal_type} | {item.purity_karat}</p>
                          </TableCell>
                          <TableCell className="p-2 text-right">
                             <p className="text-xs font-medium text-slate-700">{item.net_weight_g} g</p>
                             <p className="text-[9px] text-slate-400">Gross: {item.gross_weight_g}g</p>
                          </TableCell>
                          <TableCell className="p-2 text-right text-xs text-slate-600">
                             {mode === 'challan' ? '-' : `${item.tax_percent}%`}
                          </TableCell>
                          <TableCell className="p-2 text-right font-bold text-sm text-slate-800 pr-4">
                             {mode === 'challan' ? '-' : (item.mrp || 0).toLocaleString()}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </div>

        {/* RIGHT PANEL: BILLING & CHECKOUT */}
        <div className="w-full lg:w-[350px] xl:w-[400px] bg-slate-50 border border-slate-300 flex flex-col overflow-hidden shrink-0 rounded-sm">
          
          <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
            
            {/* Warning Banners */}
            {mode === 'estimate' && (
              <div className="bg-[#FFF4CE] border border-[#F5D0A9] p-3 rounded-sm flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-[#D83B01] mt-0.5" />
                <p className="text-xs text-[#D83B01] leading-tight">Proforma Estimate. No live inventory deducted. Not valid for ITC.</p>
              </div>
            )}
            {mode === 'challan' && (
              <div className="bg-[#DFF6DD] border border-[#C3E8C1] p-3 rounded-sm flex items-start gap-2">
                <ShieldAlert className="h-4 w-4 text-[#107C10] mt-0.5" />
                <p className="text-xs text-[#107C10] leading-tight">Stock Transfer logic. Items will be marked as "Sold (Unbilled)".</p>
              </div>
            )}

            {/* CUSTOMER REGISTRY */}
            <div className="space-y-1.5 relative">
              <Label className="text-xs font-semibold text-slate-700">
                {mode === 'challan' ? 'SIS Partner / Destination' : 'Customer Account'}
              </Label>
              {selectedCustomer ? (
                <div className="flex items-center justify-between bg-white border border-[#0078D7] p-2 rounded-sm">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-sm bg-[#0078D7] text-white flex items-center justify-center font-bold text-xs uppercase">
                      {selectedCustomer.full_name[0]}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-800 leading-none">{selectedCustomer.full_name}</p>
                      <p className="text-[10px] text-slate-500 mt-1">{selectedCustomer.phone}</p>
                    </div>
                  </div>
                  <Button size="icon" variant="ghost" className="h-6 w-6 rounded-sm text-slate-500 hover:text-red-500" onClick={() => setSelectedCustomer(null)}><X className="h-4 w-4" /></Button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                    <Input placeholder="Search phone or name..." value={searchCustomer} onChange={(e) => setSearchCustomer(e.target.value)} className="h-9 pl-8 text-xs rounded-sm border-slate-300" />
                  </div>
                  <Button variant="outline" className="h-9 px-3 rounded-sm border-slate-300 bg-white" onClick={() => setIsAddCustomerOpen(true)}><Plus className="h-4 w-4" /></Button>
                </div>
              )}
              {searchCustomer && !selectedCustomer && (
                <div className="absolute top-full left-0 w-full bg-white border border-slate-300 shadow-lg z-50 max-h-[200px] overflow-y-auto rounded-sm mt-1">
                  {customers.filter(c => c.full_name.toLowerCase().includes(searchCustomer.toLowerCase()) || c.phone.includes(searchCustomer)).map(c => (
                    <div key={c.id} className="p-2 border-b border-slate-100 hover:bg-slate-50 cursor-pointer flex justify-between items-center" onClick={() => { setSelectedCustomer(c); setSearchCustomer(''); }}>
                      <span className="font-semibold text-xs text-slate-700">{c.full_name}</span>
                      <span className="text-[10px] text-slate-500">{c.phone}</span>
                    </div>
                  ))}
                  <div className="p-2 text-center text-xs font-semibold text-[#0078D7] cursor-pointer hover:bg-slate-50" onClick={() => setIsAddCustomerOpen(true)}>
                    + Create New Customer
                  </div>
                </div>
              )}
            </div>

            <Separator className="bg-slate-200" />

            {/* ADJUSTMENTS & EXCHANGE (Normal Mode Only) */}
            {mode === 'normal' && (
              <div className="space-y-4">
                
                {/* VOUCHER & DISCOUNT */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                     <Label className="text-[10px] font-semibold text-slate-600 uppercase">Discount</Label>
                     <div className="flex overflow-hidden rounded-sm border border-slate-300 h-8 bg-white">
                        <select className="bg-slate-100 border-r border-slate-300 text-xs font-medium px-2 outline-none" value={discountType} onChange={(e: any) => setDiscountType(e.target.value)}>
                          <option value="percent">%</option>
                          <option value="flat">₹</option>
                        </select>
                        <Input type="number" placeholder="0.00" className="border-none h-full text-xs focus-visible:ring-0" value={discountValue} onChange={(e) => setDiscountValue(e.target.value)} />
                     </div>
                  </div>
                  <div className="space-y-1">
                     <Label className="text-[10px] font-semibold text-slate-600 uppercase">Voucher Code</Label>
                     {activeVoucher ? (
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center justify-between bg-[#DFF6DD] border border-[#C3E8C1] h-8 px-2 rounded-sm">
                          <span className="text-[10px] font-bold text-[#107C10] truncate mr-2">{activeVoucher.code} (-₹{activeVoucher.amount})</span>
                          <X className="h-3.5 w-3.5 cursor-pointer text-[#107C10] shrink-0" onClick={() => {setActiveVoucher(null); setHandlingFee('0');}} />
                        </div>
                        <div className="flex items-center gap-2">
   <span className="text-[9px] font-bold text-slate-500 uppercase">Handling ₹</span>
   <Input 
     type="number" 
     readOnly // <--- ADD THIS
     className="h-6 text-xs bg-slate-100 text-slate-500 border-slate-300 rounded-sm cursor-not-allowed" // <--- UPDATE CLASS
     value={handlingFee} 
   />
</div>
                      </div>
                    ) : (
                      <div className="flex gap-1 relative">
                        <Ticket className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                        <Input placeholder="CODE..." className="h-8 pl-7 text-xs uppercase border-slate-300 rounded-sm" value={voucherCode} onChange={(e) => setVoucherCode(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleApplyVoucher()} />
                        <Button variant="secondary" className="h-8 w-8 p-0 border border-slate-300 rounded-sm" onClick={handleApplyVoucher}><CheckCircle2 className="h-4 w-4"/></Button>
                      </div>
                    )}
                  </div>
                </div>

                {/* BUYBACK / EXCHANGE PROTOCOL */}
                <div className={`rounded-sm border transition-all overflow-hidden ${isExchangeOpen ? 'border-[#0078D7] bg-blue-50/50' : 'border-slate-300 bg-white'}`}>
                   <button 
                     className="w-full flex items-center justify-between p-2 text-xs font-semibold text-slate-700 outline-none hover:bg-slate-50"
                     onClick={() => setIsExchangeOpen(!isExchangeOpen)}
                   >
                     <div className="flex items-center gap-2">
                       <RefreshCw className={`h-3.5 w-3.5 ${isExchangeOpen ? 'animate-spin text-[#0078D7]' : 'text-slate-400'}`} /> 
                       Buyback / Exchange Protocol
                       {exchangeNum > 0 && <span className="ml-2 text-[10px] bg-[#0078D7] text-white px-1.5 py-0.5 rounded-sm">₹{exchangeNum.toLocaleString()}</span>}
                     </div>
                     {isExchangeOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                   </button>
                   
                   {isExchangeOpen && (
                     <div className="p-3 pt-2 space-y-3 border-t border-slate-200 bg-white">
                        
                        <div className="flex bg-slate-100 p-1 rounded-sm border border-slate-200">
                          <button className={`flex-1 text-[10px] font-bold uppercase py-1.5 rounded-sm transition-colors ${exchangeMode === 'buyback' ? 'bg-white text-slate-800 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-700'}`} onClick={() => setExchangeMode('buyback')}>
                            Buyback (70%)
                          </button>
                          <button className={`flex-1 text-[10px] font-bold uppercase py-1.5 rounded-sm transition-colors ${exchangeMode === 'exchange' ? 'bg-white text-slate-800 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-700'}`} onClick={() => setExchangeMode('exchange')}>
                            Exchange (100%)
                          </button>
                        </div>

                        <div className="flex gap-2">
                          <Input placeholder="Scan Old Barcode" className="h-8 text-xs border-slate-300 rounded-sm uppercase" value={exchangeBarcode} onChange={(e) => setExchangeBarcode(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleFetchExchangeItem()} />
                          <Button variant="secondary" size="sm" className="h-8 rounded-sm text-xs px-3 bg-slate-800 text-white hover:bg-slate-700" onClick={handleFetchExchangeItem}>Audit</Button>
                        </div>

                        <div className="grid grid-cols-3 gap-2">
                          <Input type="number" placeholder="Credit ₹" className="h-8 text-xs font-bold border-slate-300 rounded-sm" value={exchangeValue} onChange={(e) => setExchangeValue(e.target.value)} />
                          <Input placeholder="Notes..." className="col-span-2 h-8 text-xs border-slate-300 rounded-sm" value={exchangeNotes} onChange={(e) => setExchangeNotes(e.target.value)} />
                        </div>
                     </div>
                   )}
                </div>
              </div>
            )}

            {/* SETTLEMENT MODE (Normal & Custom) */}
            {(mode === 'normal' || mode === 'custom') && (
              <div className="space-y-1.5 pt-2">
                <Label className="text-xs font-semibold text-slate-700">Payment Method</Label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { id: 'cash', label: 'Cash', icon: Banknote },
                    { id: 'card', label: 'Card', icon: CreditCard },
                    { id: 'upi', label: 'UPI', icon: QrCode },
                    { id: 'bank', label: 'Bank', icon: Building },
                  ].map((method) => {
                    const isActive = paymentMode === method.id;
                    return (
                      <button
                        key={method.id} onClick={() => setPaymentMode(method.id)}
                        className={`flex flex-col items-center justify-center gap-1 h-12 border rounded-sm transition-colors ${
                          isActive ? `${currentTheme.bg} border-transparent text-white shadow-sm` : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <method.icon className="h-4 w-4" />
                        <span className="text-[9px] font-bold uppercase">{method.label}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {/* LEDGER & ACTIONS FOOTER */}
          <div className="p-4 border-t border-slate-300 bg-white space-y-3 shrink-0 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
             
             {/* Dynamic Ledger */}
             {mode !== 'custom' && mode !== 'challan' && (
               <div className="space-y-1 font-mono text-sm">
                  <div className="flex justify-between items-center text-slate-600">
                    <span>Subtotal</span>
                    <span>₹{subtotal.toLocaleString()}</span>
                  </div>
                  {mode === 'normal' && discountAmount > 0 && (
                    <div className="flex justify-between items-center text-red-600">
                      <span>Discount</span>
                      <span>- ₹{discountAmount.toLocaleString()}</span>
                    </div>
                  )}
                  {mode === 'normal' && exchangeNum > 0 && (
                    <div className="flex justify-between items-center text-blue-600 text-xs">
                      <span>Exchange Credit</span>
                      <span>- ₹{exchangeNum.toLocaleString()}</span>
                    </div>
                  )}
                  
                  {mode === 'normal' ? (
                    <>
                      {activeVoucher && (
                        <div className="flex justify-between items-center text-emerald-600 text-xs">
                          <span>Voucher Auth</span>
                          <span>- ₹{activeVoucher.amount.toLocaleString()}</span>
                        </div>
                      )}
                      
                      <div className="flex justify-between items-center text-slate-800 font-semibold border-t border-slate-200 pt-1 mt-1">
                        <span>Taxable Value {handlingAmt > 0 && <span className="text-[9px] font-normal text-slate-500">(inc. Handling ₹{handlingAmt})</span>}</span>
                        <span>₹{finalTaxableValue.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center text-slate-500 text-xs">
                        <span>CGST + SGST (3%)</span>
                        <span>+ ₹{(cgstAmount + sgstAmount).toLocaleString()}</span>
                      </div>
                    </>
                  ) : (
                    <div className="flex justify-between items-center text-slate-500 text-xs">
                        <span>Est. GST (3%)</span>
                        <span>+ ₹{(cgstAmount + sgstAmount).toLocaleString()}</span>
                    </div>
                  )}
               </div>
             )}

             {mode === 'challan' && (
               <div className="flex justify-between items-center text-sm font-semibold text-slate-700 pb-1 border-b border-slate-200">
                 <span>Items Count</span>
                 <span>{cart.length}</span>
               </div>
             )}

             <div className="flex justify-between items-end pt-1">
                <div>
                   <p className="text-[10px] font-bold uppercase text-slate-500">
                     {mode === 'custom' ? 'Advance Payment' : mode === 'challan' ? 'Memo Value' : 'Net Payable'}
                   </p>
                   <p className={`text-3xl font-black tracking-tight ${currentTheme.text}`}>
                     ₹{mode === 'custom' ? (Number(customOrderDetails.advancePayment) || 0).toLocaleString() : mode === 'challan' ? subtotal.toLocaleString() : finalPayable.toLocaleString()}
                   </p>
                </div>
             </div>

             <Button 
                onClick={handleCheckout} 
                disabled={isProcessing || (mode !== 'custom' && cart.length === 0) || (mode === 'custom' && !customOrderDetails.designCode)} 
                className={`w-full font-bold text-sm h-12 rounded-sm flex items-center justify-center gap-2 transition-all text-white ${currentTheme.bg} ${currentTheme.hover}`}
              >
                {isProcessing ? <Loader2 className="h-5 w-5 animate-spin" /> : 
                  mode === 'normal' ? <><CheckCircle2 className="h-5 w-5"/> Finalize Invoice</> :
                  mode === 'estimate' ? <><Printer className="h-5 w-5"/> Print Estimate</> :
                  mode === 'custom' ? <><Hammer className="h-5 w-5"/> Record Advance</> :
                  <><Truck className="h-5 w-5"/> Generate Challan</>
                }
              </Button>
          </div>
        </div>
      </div>

      {/* --- MODALS --- */}
      <Dialog open={isAddCustomerOpen} onOpenChange={setIsAddCustomerOpen}>
        <DialogContent className="sm:max-w-[450px] border border-slate-300 shadow-xl p-0 rounded-sm overflow-hidden bg-white">
          <DialogHeader className="bg-slate-100 p-4 border-b border-slate-200">
            <DialogTitle className="text-base font-semibold text-slate-800">Add New Customer</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-5">
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs font-semibold text-slate-700">Full Name *</Label>
              <Input className="h-9 rounded-sm border-slate-300" value={newCustForm.full_name} onChange={(e) => setNewCustForm({...newCustForm, full_name: e.target.value})} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Phone *</Label>
              <Input className="h-9 rounded-sm border-slate-300" value={newCustForm.phone} onChange={(e) => setNewCustForm({...newCustForm, phone: e.target.value})} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Date of Birth</Label>
              <Input type="date" className="h-9 rounded-sm border-slate-300" value={newCustForm.birth_date} onChange={(e) => setNewCustForm({...newCustForm, birth_date: e.target.value})} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs font-semibold text-slate-700">Address</Label>
              <Input className="h-9 rounded-sm border-slate-300" value={newCustForm.address} onChange={(e) => setNewCustForm({...newCustForm, address: e.target.value})} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">City</Label>
              <Input className="h-9 rounded-sm border-slate-300" value={newCustForm.city} onChange={(e) => setNewCustForm({...newCustForm, city: e.target.value})} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">PAN Number</Label>
              <Input className="h-9 rounded-sm border-slate-300 uppercase" value={newCustForm.pan_no} onChange={(e) => setNewCustForm({...newCustForm, pan_no: e.target.value})} />
            </div>
          </div>
          <DialogFooter className="p-4 bg-slate-50 border-t border-slate-200">
            <Button variant="ghost" className="rounded-sm text-sm" onClick={() => setIsAddCustomerOpen(false)}>Cancel</Button>
            <Button onClick={handleAddCustomer} className="rounded-sm text-sm bg-[#0078D7] hover:bg-[#005A9E] text-white px-6">Save Customer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showPrintModal} onOpenChange={setShowPrintModal}>
        <DialogContent className="sm:max-w-[400px] border border-slate-300 shadow-2xl p-0 rounded-sm overflow-hidden bg-white">
          <div className="flex flex-col items-center justify-center p-8 text-center space-y-5">
            <div className={`w-16 h-16 text-white rounded-full flex items-center justify-center ${currentTheme.bg}`}>
              {mode === 'custom' ? <Hammer className="h-8 w-8" /> : mode === 'estimate' ? <FileText className="h-8 w-8" /> : mode === 'challan' ? <Truck className="h-8 w-8" /> : <CheckCircle2 className="h-8 w-8" />}
            </div>
            <div className="space-y-1">
               <h2 className="text-xl font-bold text-slate-800">
                 {mode === 'normal' ? 'Sale Completed' : mode === 'estimate' ? 'Estimate Generated' : mode === 'challan' ? 'Challan Issued' : 'Order Initiated'}
               </h2>
               <p className="text-sm font-mono text-slate-500">{lastInvoiceData?.invoice_number}</p>
            </div>
            <div className="w-full flex gap-3 pt-2">
              <Button onClick={() => setShowPrintModal(false)} variant="outline" className="flex-1 rounded-sm border-slate-300 text-slate-700">Close</Button>
              <Button onClick={handlePrint} className={`flex-1 rounded-sm text-white ${currentTheme.bg} ${currentTheme.hover}`}><Printer className="h-4 w-4 mr-2"/> Print</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* REUSABLE PRINT TEMPLATE INTEGRATION */}
      <div className="hidden">
        <InvoicePrintTemplate ref={printRef} data={lastInvoiceData} />
      </div>

    </div>
  )
}