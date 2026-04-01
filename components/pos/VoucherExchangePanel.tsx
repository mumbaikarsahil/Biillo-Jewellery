import React, { useState } from 'react'
import { Ticket, CheckCircle2, X, RefreshCw, ChevronUp, ChevronDown, ScanLine, Keyboard } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'

export function VoucherExchangePanel(props: any) {
  const [entryMode, setEntryMode] = useState<'auto' | 'manual'>('auto')
  const [manualArticleCost, setManualArticleCost] = useState('')

  const handleManualApply = () => {
    const cost = parseFloat(manualArticleCost) || 0
    props.setExchangeValue(cost.toString())
    props.setExchangeNotes(`MANUAL EXCHANGE (100% MRP): INV [${props.exchangeInvoiceNo}]`)
  }

  return (
    <div className="space-y-5">
      {/* VOUCHER & DISCOUNT ROW */}
      <div className="grid grid-cols-2 gap-3">
        
        {/* Manual Discount Input */}
        <div className="space-y-1.5">
          <Label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Manual Discount</Label>
          <div className="flex overflow-hidden rounded-lg border border-slate-200 h-11 bg-white focus-within:ring-2 focus-within:ring-slate-200 transition-all shadow-sm">
            <select 
              className="bg-slate-50/50 border-r border-slate-200 text-xs font-semibold px-3 outline-none cursor-pointer text-slate-600 hover:bg-slate-100 transition-colors" 
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
          <Label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Voucher Code</Label>
          {props.activeVoucher ? (
            <div className="flex flex-col gap-1 h-11 justify-center animate-in fade-in zoom-in duration-200">
              <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 h-full px-3 rounded-lg shadow-sm">
                <div className="flex items-center gap-2 overflow-hidden">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span className="text-[11px] font-bold text-emerald-700 truncate tracking-tight">
                    {props.activeVoucher.code} (-₹{props.activeVoucher.amount})
                  </span>
                </div>
                <button 
                  className="h-6 w-6 flex items-center justify-center rounded-md hover:bg-emerald-100 text-emerald-600 shrink-0 transition-colors"
                  onClick={() => { props.setActiveVoucher(null); props.setHandlingFee('0'); }} 
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ) : (
            <div className="flex gap-1.5 relative shadow-sm">
              <Ticket className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input 
                placeholder="CODE..." 
                className="h-11 pl-9 text-sm font-medium uppercase border-slate-200 rounded-lg bg-white focus-visible:ring-slate-300 transition-all" 
                value={props.voucherCode} 
                onChange={(e) => props.setVoucherCode(e.target.value)} 
                onKeyDown={(e) => e.key === 'Enter' && props.handleApplyVoucher()} 
              />
              <Button 
                variant="secondary" 
                className="h-11 w-11 p-0 border border-slate-200 rounded-lg bg-slate-50 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-all text-slate-500 shrink-0" 
                onClick={props.handleApplyVoucher}
              >
                <CheckCircle2 className="h-5 w-5"/>
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* STRICT EXCHANGE PROTOCOL (100% MRP) */}
      <div className={`rounded-xl border transition-all duration-200 overflow-hidden shadow-sm ${props.isExchangeOpen ? 'border-blue-300 bg-blue-50/30' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
        <button 
          className="w-full flex items-center justify-between p-3.5 outline-none"
          onClick={() => props.setIsExchangeOpen(!props.isExchangeOpen)}
        >
          <div className="flex items-center gap-2.5">
            <RefreshCw className={`h-4 w-4 transition-transform duration-500 ${props.isExchangeOpen ? 'rotate-180 text-blue-600' : 'text-slate-400'}`} /> 
            <span className="text-xs font-semibold text-slate-700 tracking-tight">Old Item Exchange (100% Value)</span>
            
            {props.exchangeNum > 0 && (
              <span className="ml-2 text-[10px] font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-md tabular-nums">
                ₹{props.exchangeNum.toLocaleString()}
              </span>
            )}
          </div>
          {props.isExchangeOpen ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
        </button>
        
        {props.isExchangeOpen && (
          <div className="p-4 pt-2 space-y-4 border-t border-slate-100 bg-white/50 animate-in slide-in-from-top-2 duration-200">
            
            {/* Entry Mode Toggle */}
            <div className="flex bg-slate-100/80 p-1 rounded-lg border border-slate-200/60">
              <button 
                className={`flex-1 text-[11px] flex justify-center items-center gap-1.5 font-bold uppercase py-2 rounded-md transition-all ${entryMode === 'auto' ? 'bg-white text-slate-800 shadow-sm border border-slate-200/50' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'}`} 
                onClick={() => setEntryMode('auto')}
              >
                <ScanLine className="w-3.5 h-3.5"/> Auto-Fetch
              </button>
              <button 
                className={`flex-1 text-[11px] flex justify-center items-center gap-1.5 font-bold uppercase py-2 rounded-md transition-all ${entryMode === 'manual' ? 'bg-white text-slate-800 shadow-sm border border-slate-200/50' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'}`} 
                onClick={() => setEntryMode('manual')}
              >
                <Keyboard className="w-3.5 h-3.5"/> Manual Entry
              </button>
            </div>

            {entryMode === 'auto' ? (
              <div className="flex gap-2">
                <Input 
                  placeholder="System Invoice No" 
                  className="h-10 text-sm font-medium border-slate-200 rounded-lg uppercase focus-visible:ring-slate-300" 
                  value={props.exchangeInvoiceNo} 
                  onChange={(e) => props.setExchangeInvoiceNo(e.target.value)} 
                  onKeyDown={(e) => e.key === 'Enter' && props.handleFetchExchangeItem()} 
                />
                <Button 
                  variant="secondary" 
                  className="h-10 rounded-lg text-xs font-semibold px-4 bg-slate-800 text-white hover:bg-slate-700 shrink-0 shadow-sm" 
                  onClick={props.handleFetchExchangeItem}
                >
                  Audit
                </Button>
              </div>
            ) : (
              <div className="space-y-2.5">
                <Input 
                  placeholder="Paper Bill / Invoice No" 
                  className="h-10 text-sm font-medium border-slate-200 rounded-lg uppercase focus-visible:ring-slate-300" 
                  value={props.exchangeInvoiceNo} 
                  onChange={(e) => props.setExchangeInvoiceNo(e.target.value)} 
                />
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">₹</span>
                    <Input 
                      type="number" 
                      placeholder="Article Cost (Pre-GST)" 
                      className="h-10 pl-7 text-sm font-medium border-slate-200 rounded-lg focus-visible:ring-slate-300" 
                      value={manualArticleCost} 
                      onChange={(e) => setManualArticleCost(e.target.value)} 
                    />
                  </div>
                  <Button 
                    className="h-10 rounded-lg text-xs font-semibold px-4 bg-blue-600 text-white hover:bg-blue-700 shrink-0 shadow-sm" 
                    onClick={handleManualApply}
                  >
                    Apply 100%
                  </Button>
                </div>
              </div>
            )}

            {/* Locked Output Statement */}
            {props.exchangeNum > 0 && (
              <div className="p-3 bg-blue-50/50 border border-blue-100 rounded-lg flex justify-between items-center mt-2">
                <span className="text-xs font-medium text-blue-700 tracking-tight">Approved Exchange Credit</span>
                <span className="text-sm font-bold text-blue-700 tabular-nums">₹{props.exchangeNum.toLocaleString()}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}