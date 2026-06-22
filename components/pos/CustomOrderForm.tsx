"use client"

import React, { useState } from 'react'
import { Hammer, X, Search, Package, AlertCircle, CheckCircle2, Loader2, IndianRupee, Store, Ticket } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { supabase } from '@/lib/supabaseClient'
import { cn } from '@/lib/utils'

const ORNAMENT_TYPES = [
  'Ring', 'Necklace', 'Earring', 'Bracelet', 'Bangle', 
  'Chain', 'Pendant', 'Mangalsutra', 'Nose Pin', 'Set'
]

interface CustomOrderFormProps {
  details: {
    design_reference: string;
    item_category: string;
    expected_gold_g: string;
    expected_diamond_cts: string;
    estimated_value: string;
    advance_paid: string;
  }
  setDetails: (details: any) => void
  currentLocationId?: string 
  onAddToBill?: (finalItemData: any) => void 
  voucherAmount?: number 
}

export function CustomOrderForm({ details, setDetails, currentLocationId, onAddToBill, voucherAmount = 0 }: CustomOrderFormProps) {
  const [activeTab, setActiveTab] = useState<'new' | 'pickup'>('new')
  const [isCustomCategory, setIsCustomCategory] = useState(false)

  // Pickup Tab State
  const [searchQuery, setSearchQuery] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [searchError, setSearchError] = useState('')
  const [foundOrder, setFoundOrder] = useState<any>(null)

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDetails({ ...details, [e.target.name]: e.target.value })
  }

  const handleSearchOrder = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!searchQuery.trim()) return

    setIsSearching(true)
    setSearchError('')
    setFoundOrder(null)

    try {
      const { data: orderData, error: orderErr } = await supabase
        .from('custom_orders')
        .select('*')
        .eq('order_number', searchQuery.trim())
        .single()

      if (orderErr || !orderData) {
        setSearchError('Order not found. Please check the receipt number.')
        setIsSearching(false)
        return
      }

      const { data: invData, error: invErr } = await supabase
        .from('inventory_items')
        .select('id, barcode, mrp, warehouse_id, status, net_weight_g, gross_weight_g, total_stone_weight_cts, item_category, metal_type, purity_karat')
        .eq('custom_order_id', orderData.id)
        .maybeSingle()

      setFoundOrder({ 
        ...orderData, 
        inventory: invData || null 
      })

    } catch (err: any) {
      setSearchError('An error occurred while fetching the order.')
    } finally {
      setIsSearching(false)
    }
  }

  // ✨ UNIFIED MATH ENGINE: Treats Voucher as a Pre-Tax Discount
  const estValue = Number(details?.estimated_value) || 0;
  const taxableValue = Math.max(0, estValue - voucherAmount);
  const estimatedGst = taxableValue * 0.03;
  const finalEstimatedTotal = Math.round(taxableValue + estimatedGst);
  
  const customerAdvance = Number(details?.advance_paid) || 0;
  const estimatedBalance = Math.max(0, finalEstimatedTotal - customerAdvance);

  return (
    <div className="flex-1 p-3 sm:p-4 custom-scrollbar flex flex-col h-full bg-slate-50/50">
      <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 max-w-3xl mx-auto shadow-sm w-full">
        
        {/* HEADER & TAB SWITCHER */}
        <div className="border-b border-slate-100 pb-3 mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-[#881798] flex items-center gap-1.5">
              <Hammer className="w-4 h-4" /> Store Requests & Pickups
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">Manage new custom orders or process final billing.</p>
          </div>

          <div className="flex bg-slate-100 p-1 rounded-lg self-start sm:self-auto shrink-0 border border-slate-200">
            <button 
              className={cn("px-3 py-1 text-xs font-bold rounded-md transition-all", activeTab === 'new' ? "bg-white text-[#881798] shadow-sm" : "text-slate-500 hover:text-slate-700")}
              onClick={() => setActiveTab('new')}
            >
              New Order
            </button>
            <button 
              className={cn("px-3 py-1 text-xs font-bold rounded-md transition-all", activeTab === 'pickup' ? "bg-white text-[#881798] shadow-sm" : "text-slate-500 hover:text-slate-700")}
              onClick={() => setActiveTab('pickup')}
            >
              Pickup / Final Bill
            </button>
          </div>
        </div>
        
        {/* TAB 1: NEW CUSTOM ORDER */}
        {activeTab === 'new' && (
          <div className="space-y-4 animate-in fade-in duration-300">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700 uppercase tracking-wide">Design Ref / Name *</Label>
                <Input 
                  name="design_reference"
                  placeholder="e.g. Vintage Solitaire Ring" 
                  className="h-9 text-sm border-slate-300 focus-visible:ring-[#881798]" 
                  value={details?.design_reference || ''} 
                  onChange={handleInputChange} 
                />
              </div>
              
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700 uppercase tracking-wide">Ornament Type *</Label>
                {!isCustomCategory ? (
                  <Select 
                    value={details?.item_category} 
                    onValueChange={(val) => {
                      if (val === 'Other') {
                        setIsCustomCategory(true)
                        setDetails({ ...details, item_category: '' })
                      } else {
                        setDetails({ ...details, item_category: val })
                      }
                    }}
                  >
                    <SelectTrigger className="h-9 text-sm border-slate-300 focus:ring-[#881798]">
                      <SelectValue placeholder="Select type..." />
                    </SelectTrigger>
                    <SelectContent>
                      {ORNAMENT_TYPES.map(type => (
                        <SelectItem key={type} value={type} className="text-sm">{type}</SelectItem>
                      ))}
                      <SelectItem value="Other" className="font-bold text-[#881798] text-sm">Other (Custom)</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <Input 
                      name="item_category"
                      placeholder="Enter custom category..." 
                      className="h-9 text-sm border-slate-300 focus-visible:ring-[#881798]" 
                      value={details?.item_category || ''} 
                      onChange={handleInputChange} 
                      autoFocus
                    />
                    <Button variant="outline" size="icon" className="h-9 w-9 shrink-0" onClick={() => {
                      setIsCustomCategory(false)
                      setDetails({ ...details, item_category: '' })
                    }}>
                      <X className="w-4 h-4 text-slate-500" />
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {/* EXPECTED SPECS (OPTIONAL) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <Label className="text-xs font-bold text-slate-700 uppercase tracking-wide">Expected Gold Wt.</Label>
                  <span className="text-[9px] text-slate-400 font-bold uppercase">Optional</span>
                </div>
                <Input 
                  name="expected_gold_g"
                  placeholder="TBD / -" 
                  className="h-9 text-sm border-slate-300 focus-visible:ring-[#881798]" 
                  value={details?.expected_gold_g || ''} 
                  onChange={handleInputChange} 
                />
              </div>
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <Label className="text-xs font-bold text-slate-700 uppercase tracking-wide">Expected Diamond Wt.</Label>
                  <span className="text-[9px] text-slate-400 font-bold uppercase">Optional</span>
                </div>
                <Input 
                  name="expected_diamond_cts"
                  placeholder="TBD / -" 
                  className="h-9 text-sm border-slate-300 focus-visible:ring-[#881798]" 
                  value={details?.expected_diamond_cts || ''} 
                  onChange={handleInputChange} 
                />
              </div>
            </div>

            {/* FINANCIALS & MATH UI */}
            <div className="mt-4 bg-slate-50 border border-slate-200 rounded-lg p-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700 uppercase tracking-wide">Estimated Base Value (₹)</Label>
                  <Input 
                    name="estimated_value"
                    type="number" 
                    placeholder="0" 
                    className="h-9 text-sm border-slate-300 font-semibold bg-white" 
                    value={details?.estimated_value || ''} 
                    onChange={handleInputChange} 
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-[#881798] uppercase tracking-wide">Customer Advance (₹) *</Label>
                  <Input 
                    name="advance_paid"
                    type="number" 
                    placeholder="0" 
                    className="h-9 text-sm border-[#881798] ring-1 ring-[#881798]/20 focus-visible:ring-[#881798] font-bold text-[#881798] bg-white" 
                    value={details?.advance_paid || ''} 
                    onChange={handleInputChange} 
                  />
                </div>
              </div>

              {/* ✨ UNIFIED: Transparent Math Breakdown */}
              <div className="bg-white border border-slate-200 rounded-md p-3 space-y-1.5 shadow-sm">
                <div className="flex justify-between text-xs text-slate-600">
                  <span>Estimated Base Value:</span>
                  <span>₹ {estValue.toLocaleString()}</span>
                </div>
                
                {voucherAmount > 0 && (
                  <div className="flex justify-between text-xs text-emerald-600 font-medium">
                    <span className="flex items-center gap-1"><Ticket className="w-3.5 h-3.5" /> Voucher Discount:</span>
                    <span>- ₹ {voucherAmount.toLocaleString()}</span>
                  </div>
                )}
                
                <div className="flex justify-between text-xs font-bold text-slate-800 border-t border-slate-100 pt-1.5 mt-1">
                  <span>Taxable Value:</span>
                  <span>₹ {taxableValue.toLocaleString()}</span>
                </div>
                
                <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                  <span>Estimated GST (3%):</span>
                  <span>+ ₹ {estimatedGst.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                </div>
                
                <div className="flex justify-between text-sm font-bold text-slate-900 border-t border-slate-200 pt-1.5 mt-1.5">
                  <span>Estimated Total:</span>
                  <span>₹ {finalEstimatedTotal.toLocaleString()}</span>
                </div>

                {customerAdvance > 0 && (
                  <div className="flex justify-between text-xs text-emerald-600 font-bold mt-1">
                    <span>Advance Received (Cash/Bank):</span>
                    <span>- ₹ {customerAdvance.toLocaleString()}</span>
                  </div>
                )}
                
                <div className="flex justify-between text-sm font-black text-[#881798] border-t border-slate-200 pt-2 mt-1.5">
                  <span>Estimated Balance on Pickup:</span>
                  <span>₹ {estimatedBalance.toLocaleString()}</span>
                </div>
              </div>
            </div>

          </div>
        )}

        {/* TAB 2: PICKUP & FINAL BILLING */}
        {activeTab === 'pickup' && (
          <div className="space-y-4 animate-in fade-in duration-300">
            <form onSubmit={handleSearchOrder} className="flex gap-2.5">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input 
                  placeholder="Scan or enter Receipt No. (e.g. ORD-9182)"
                  className="pl-9 h-10 border-slate-300 font-mono text-sm focus-visible:ring-[#881798]"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Button type="submit" disabled={isSearching} className="h-10 px-5 bg-[#881798] hover:bg-[#721080] text-white font-bold text-xs">
                {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Fetch Order'}
              </Button>
            </form>

            {searchError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2 text-red-700">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <p className="text-xs font-medium">{searchError}</p>
              </div>
            )}

            {foundOrder && (
              <div className="bg-slate-50 border border-slate-200 rounded-xl overflow-hidden">
                <div className="p-3 border-b border-slate-200 bg-white flex justify-between items-start">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 font-mono">{foundOrder.order_number}</h3>
                    <p className="text-[10px] text-slate-500 font-medium mt-0.5 uppercase tracking-widest">{foundOrder.design_reference} • {foundOrder.item_category}</p>
                  </div>
                  {foundOrder.inventory ? (
                    <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-[10px] py-0">Manufactured</Badge>
                  ) : (
                    <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-[10px] py-0">In Production</Badge>
                  )}
                </div>

                <div className="p-4 space-y-3">
                  {!foundOrder.inventory ? (
                    <div className="text-center py-4">
                      <Hammer className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                      <p className="text-xs font-semibold text-slate-700">Item is still at the factory.</p>
                      <p className="text-[10px] text-slate-500 mt-1">This order has not been received into inventory yet.</p>
                    </div>
                  ) : (
                    <>
                      {/* Location Check */}
                      <div className="flex items-center gap-3 p-2.5 rounded-lg border bg-white border-slate-200">
                        <Store className="h-4 w-4 text-slate-400" />
                        <div className="flex-1">
                          <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Current Location</p>
                          <p className="text-xs font-semibold text-slate-900">
                            {foundOrder.inventory.warehouse_id === currentLocationId ? 'In Store (Ready for Pickup)' : 'In Transit / At Different Branch'}
                          </p>
                        </div>
                        {foundOrder.inventory.warehouse_id === currentLocationId ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                        ) : (
                          <AlertCircle className="h-4 w-4 text-amber-500" />
                        )}
                      </div>

                      {/* Final Financials Math */}
<div className="bg-white rounded-lg border border-slate-200 p-3 space-y-2">
  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-1.5 mb-1.5">Final Settlement</h4>
  
  <div className="flex justify-between items-center text-xs">
    <span className="text-slate-600 font-medium">Final MRP (From Factory)</span>
    <span className="font-semibold text-slate-900">₹{(foundOrder.inventory?.mrp || 0).toLocaleString()}</span>
  </div>

  {/* ✨ FIX: Automatically pull the locked-in Voucher Amount from the order! */}
  {foundOrder.voucher_amount > 0 && (
    <div className="flex justify-between items-center text-xs text-emerald-600 font-medium">
      <span>Locked Voucher Discount</span>
      <span>- ₹{(foundOrder.voucher_amount || 0).toLocaleString()}</span>
    </div>
  )}

  <div className="flex justify-between items-center text-xs">
    <span className="text-slate-600 font-medium">Final Taxable Value</span>
    <span className="font-semibold text-slate-900">
      ₹{Math.max(0, (foundOrder.inventory?.mrp || 0) - (foundOrder.voucher_amount || 0)).toLocaleString()}
    </span>
  </div>

  <div className="flex justify-between items-center text-xs">
    <span className="text-slate-600 font-medium">Estimated GST (3%)</span>
    <span className="font-semibold text-slate-900">
      ₹{(Math.max(0, (foundOrder.inventory?.mrp || 0) - (foundOrder.voucher_amount || 0)) * 0.03).toLocaleString()}
    </span>
  </div>

  <div className="flex justify-between items-center text-xs text-emerald-600 font-medium pt-1 mt-1 border-t border-slate-100">
    <span>Advance Paid (Cash/Bank)</span>
    <span>- ₹{(foundOrder.advance_paid || 0).toLocaleString()}</span>
  </div>
  
  <div className="border-t border-slate-200 pt-2 mt-2 flex justify-between items-center">
    <span className="text-xs font-bold text-[#881798]">Balance Payable</span>
    <span className="text-base font-black text-[#881798]">
      {/* ✨ FIX: The Final Balance calculation must include the voucher discount! */}
      ₹{Math.max(0, (
        (Math.max(0, (foundOrder.inventory?.mrp || 0) - (foundOrder.voucher_amount || 0)) * 1.03) 
        - (foundOrder.advance_paid || 0)
      )).toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 0})}
    </span>
  </div>
</div>

<Button 
  disabled={foundOrder.inventory?.warehouse_id !== currentLocationId}
  className="w-full h-10 bg-[#881798] hover:bg-[#721080] text-white font-bold text-xs shadow-sm mt-1"
  onClick={() => {
    if (onAddToBill) {
      onAddToBill({
        inventory_id: foundOrder.inventory.id,
        barcode: foundOrder.inventory.barcode,
        mrp: foundOrder.inventory.mrp,
        advance_paid: foundOrder.advance_paid,
        
        // ✨ FIX: Pass the voucher discount to the cart!
        voucher_discount_locked: foundOrder.voucher_amount, 
        
        custom_order_id: foundOrder.id,
        net_weight_g: foundOrder.inventory.net_weight_g,
        gross_weight_g: foundOrder.inventory.gross_weight_g,
        total_stone_weight_cts: foundOrder.inventory.total_stone_weight_cts,
        item_category: foundOrder.inventory.item_category,
        metal_type: foundOrder.inventory.metal_type,
        purity_karat: foundOrder.inventory.purity_karat
      })
    }
  }}
>
                        <IndianRupee className="h-3.5 w-3.5 mr-1.5" />
                        Process Final Invoice
                      </Button>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  )
}