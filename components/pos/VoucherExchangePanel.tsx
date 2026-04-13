import React, { useState } from 'react'
import { Ticket, CheckCircle2, X, RefreshCw, ChevronUp, ChevronDown, Check, AlertCircle, Gift } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'

export function VoucherExchangePanel(props: any) {
  const [isSearching, setIsSearching] = useState(false)
  const [showManualOverride, setShowManualOverride] = useState(false)
  const [manualArticleCost, setManualArticleCost] = useState('')

  // --- BULLETPROOF FETCH HANDLER ---
  const handleSmartFetch = async () => {
    if (!props.exchangeInvoiceNo.trim()) return toast.error("Please enter an invoice number.")
    
    setIsSearching(true)
    try {
      const success = await props.handleFetchExchangeItem()
      
      if (!success) {
        setShowManualOverride(true)
        toast.info("System bill not found. Please enter the article cost manually.")
      } else {
        setShowManualOverride(false)
      }
    } catch (err) {
      setShowManualOverride(true)
      toast.info("System bill not found. Please enter the article cost manually.")
    } finally {
      setIsSearching(false)
    }
  }

  const handleManualApply = () => {
    const cost = parseFloat(manualArticleCost) || 0
    if (cost <= 0) return toast.error("Enter a valid article cost.")
    
    props.setExchangeValue(cost.toString())
    props.setExchangeNotes(`MANUAL EXCHANGE (100% MRP): INV [${props.exchangeInvoiceNo}]`)
    setShowManualOverride(false)
    toast.success("Manual exchange value applied.")
  }

  const clearExchange = () => {
    props.setExchangeValue('0')
    props.setExchangeNotes('')
    props.setExchangeInvoiceNo('')
    setShowManualOverride(false)
    setManualArticleCost('')
  }

  const activeExchangeValue = Number(props.exchangeNum) || 0;

  return (
    <div className="space-y-4">
      
      {/* VOUCHER & DISCOUNT ROW */}
      <div className="grid grid-cols-2 gap-3">
        
        {/* Manual Discount Input */}
        <div className="space-y-1.5">
          <Label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Manual Discount</Label>
          <div className="flex overflow-hidden rounded-lg border border-slate-200 h-10 bg-white focus-within:ring-1 focus-within:ring-slate-300 transition-all shadow-sm">
            <select 
              className="bg-slate-50 border-r border-slate-200 text-xs font-semibold px-2 outline-none cursor-pointer text-slate-600 hover:bg-slate-100 transition-colors" 
              value={props.discountType} 
              onChange={(e: any) => props.setDiscountType(e.target.value)}
            >
              <option value="percent">%</option>
              <option value="flat">₹</option>
            </select>
            <Input 
              type="number" 
              placeholder="0" 
              className="border-none h-full text-sm font-medium focus-visible:ring-0 shadow-none px-3" 
              value={props.discountValue} 
              onChange={(e) => props.setDiscountValue(e.target.value)} 
            />
          </div>
        </div>

        {/* Voucher Input */}
        <div className="space-y-1.5">
          <Label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Voucher Code</Label>
          {props.activeVoucher ? (
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 h-10 px-3 rounded-lg shadow-sm animate-in zoom-in-95 duration-200">
                <div className="flex items-center gap-1.5 overflow-hidden">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                  <span className="text-[10px] font-bold text-emerald-700 truncate tracking-tight">
                    {props.activeVoucher.code} (-₹{props.activeVoucher.amount})
                  </span>
                </div>
                <button 
                  className="h-5 w-5 flex items-center justify-center rounded text-emerald-600 hover:bg-emerald-100 shrink-0 transition-colors"
                  onClick={() => { props.setActiveVoucher(null); props.setHandlingFee('0'); }} 
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              
              {/* NEW: Birthday Rule Indicator in POS UI */}
              {props.activeVoucher.is_birthday_redemption && (
                <div className="flex items-center gap-1 text-[9px] font-bold text-pink-600 uppercase tracking-tighter ml-1">
                  <Gift className="w-2.5 h-2.5" /> Birthday Month Validated
                </div>
              )}
            </div>
          ) : (
            <div className="flex gap-1 relative shadow-sm">
              <Ticket className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <Input 
                placeholder="CODE..." 
                className="h-10 pl-8 text-xs font-semibold uppercase border-slate-200 rounded-lg bg-white focus-visible:ring-slate-300 transition-all" 
                value={props.voucherCode} 
                onChange={(e) => props.setVoucherCode(e.target.value)} 
                onKeyDown={(e) => e.key === 'Enter' && props.handleApplyVoucher()} 
              />
              <Button 
                variant="secondary" 
                className="h-10 w-10 p-0 border border-slate-200 rounded-lg bg-slate-50 hover:bg-slate-100 transition-all text-slate-500 shrink-0" 
                onClick={props.handleApplyVoucher}
              >
                <Check className="h-4 w-4"/>
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* STRICT EXCHANGE PROTOCOL (100% MRP) */}
      <div className={`rounded-xl border transition-all duration-300 overflow-hidden shadow-sm ${props.isExchangeOpen ? 'border-blue-200 bg-white' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
        <button 
          className="w-full flex items-center justify-between p-3 outline-none hover:bg-slate-50 transition-colors"
          onClick={() => props.setIsExchangeOpen(!props.isExchangeOpen)}
        >
          <div className="flex items-center gap-2">
            <RefreshCw className={`h-3.5 w-3.5 transition-transform duration-500 ${props.isExchangeOpen ? 'rotate-180 text-blue-600' : 'text-slate-400'}`} /> 
            <span className="text-xs font-semibold text-slate-700 tracking-tight">Old Item Exchange (100% Value)</span>
          </div>
          <div className="flex items-center gap-2">
            {activeExchangeValue > 0 && (
              <span className="text-[10px] font-bold bg-blue-50 text-blue-700 px-2 py-0.5 rounded-md tabular-nums border border-blue-100">
                - ₹{activeExchangeValue.toLocaleString()}
              </span>
            )}
            {props.isExchangeOpen ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
          </div>
        </button>
        
        {props.isExchangeOpen && (
          <div className="p-3 pt-0 bg-slate-50/50 border-t border-slate-100 animate-in slide-in-from-top-2 duration-200">
            
            <div className="mt-3 flex flex-col gap-2.5">
              <div className="flex gap-1.5">
                <Input 
                  placeholder="Enter Invoice No. or Paper Bill Ref..." 
                  className="h-9 text-xs font-semibold border-slate-200 rounded-lg uppercase focus-visible:ring-blue-300 bg-white" 
                  value={props.exchangeInvoiceNo} 
                  onChange={(e) => {
                    props.setExchangeInvoiceNo(e.target.value);
                    setShowManualOverride(false);
                  }} 
                  onKeyDown={(e) => e.key === 'Enter' && handleSmartFetch()} 
                  disabled={activeExchangeValue > 0}
                />
                
                {activeExchangeValue > 0 ? (
                  <Button 
                    variant="outline"
                    className="h-9 px-3 rounded-lg text-xs font-bold text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200 shrink-0 shadow-sm" 
                    onClick={clearExchange}
                  >
                    Clear
                  </Button>
                ) : (
                  <Button 
                    className="h-9 px-4 rounded-lg text-xs font-bold bg-slate-900 text-white hover:bg-slate-800 shrink-0 shadow-sm" 
                    onClick={handleSmartFetch}
                    disabled={isSearching || !props.exchangeInvoiceNo.trim()}
                  >
                    {isSearching ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : 'Audit & Fetch'}
                  </Button>
                )}
              </div>

              {showManualOverride && activeExchangeValue === 0 && (
                <div className="flex gap-1.5 animate-in slide-in-from-top-1 fade-in duration-200 mt-1.5">
                  <div className="relative flex-1">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">₹</span>
                    <Input 
                      type="number" 
                      placeholder="Article Cost (100% Pre-GST)" 
                      className="h-9 pl-6 text-xs font-bold border-orange-200 rounded-lg focus-visible:ring-orange-300 bg-orange-50/30 text-orange-900 placeholder:text-orange-300/70" 
                      value={manualArticleCost} 
                      onChange={(e) => setManualArticleCost(e.target.value)} 
                      autoFocus
                    />
                  </div>
                  <Button 
                    className="h-9 rounded-lg text-xs font-bold px-4 bg-blue-600 text-white hover:bg-blue-700 shrink-0 shadow-sm" 
                    onClick={handleManualApply}
                  >
                    Apply Value
                  </Button>
                </div>
              )}
              
              {showManualOverride && activeExchangeValue === 0 && (
                <div className="flex items-start gap-1.5 text-[10px] text-slate-500 leading-tight mt-1">
                  <AlertCircle className="w-3 h-3 text-orange-400 shrink-0 mt-0.5" />
                  <span>System bill not found. Please manually verify the paper bill and enter the 100% pre-GST article cost above.</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}