import React from 'react'
import { Loader2, Banknote, CreditCard, QrCode, Building, Split } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'

import { CustomerSelector } from './CustomerSelector'
import { VoucherExchangePanel } from './VoucherExchangePanel'

export function CheckoutSidebar({ 
  mode, cartLength, cart, 
  customers, setCustomers, 
  selectedCustomer, setSelectedCustomer, 
  onPreviewRequest,
  appUser, selectedLocation,
  // Adjustments & Vouchers
  discountType, setDiscountType, discountValue, setDiscountValue,
  voucherCode, setVoucherCode, activeVoucher, setActiveVoucher, handlingFee, setHandlingFee, handleApplyVoucher,
  isExchangeOpen, setIsExchangeOpen, exchangeMode, setExchangeMode, 
  exchangeInvoiceNo, setExchangeInvoiceNo, exchangeValue, setExchangeValue, exchangeNotes, setExchangeNotes,
  handleFetchExchangeItem, exchangeNum, paymentMode, setPaymentMode,
  // Split Payment Props
  splitPayments, setSplitPayments, currentSplitTotal, 
  // Custom, Repair, & Return Data for Totals
  customOrderDetails, repairDetails, returnDetails,
  // Ledger Props
  isProcessing, finalPayable, subtotal, discountAmount, appliedVoucherAmount, handlingAmt, 
  finalTaxableValue, cgstAmount, sgstAmount, roundOffAmount,
  
  setCart, 
  setMode  
}: any) {
  
  // Base theme colors mapping
  const themeMap: Record<string, { bg: string, text: string, ring: string, light: string }> = {
    estimate: { bg: 'bg-[#D83B01]', text: 'text-[#D83B01]', ring: 'ring-[#D83B01]', light: 'bg-[#D83B01]/10' },
    custom: { bg: 'bg-[#881798]', text: 'text-[#881798]', ring: 'ring-[#881798]', light: 'bg-[#881798]/10' },
    repair: { bg: 'bg-[#E3008C]', text: 'text-[#E3008C]', ring: 'ring-[#E3008C]', light: 'bg-[#E3008C]/10' }, 
    return: { bg: 'bg-[#C50F1F]', text: 'text-[#C50F1F]', ring: 'ring-[#C50F1F]', light: 'bg-[#C50F1F]/10' },
    challan: { bg: 'bg-[#107C10]', text: 'text-[#107C10]', ring: 'ring-[#107C10]', light: 'bg-[#107C10]/10' },
    normal: { bg: 'bg-[#0078D7]', text: 'text-[#0078D7]', ring: 'ring-[#0078D7]', light: 'bg-[#0078D7]/10' },
  }
  
  const theme = themeMap[mode] || themeMap.normal

  // --- NEW: Calculate Total Advance Paid from Cart Items ---
  const cartAdvance = cart?.reduce((sum: number, item: any) => sum + (Number(item.advance_paid) || 0), 0) || 0;

  // Smart Total: Reads advance payments, refund amounts, or standard cart total minus any previously paid advances
  // (If custom mode, we use the new order advance. If the user is doing a pickup, the displayTotal will read 0 until they push it to the normal cart)
  const displayTotal = mode === 'custom' ? (Number(customOrderDetails?.advance_paid) || 0) 
                     : mode === 'repair' ? (Number(repairDetails?.advancePaid) || 0) 
                     : mode === 'return' ? (Number(returnDetails?.refundAmount) || 0) 
                     : Math.max(0, (finalPayable || 0) - cartAdvance)

  // Helper math for Split Payments
  const splitRemaining = Math.max(0, displayTotal - (currentSplitTotal || 0))
  const isSplitValid = Math.abs((currentSplitTotal || 0) - displayTotal) < 0.1

  return (
    <div className="w-full lg:w-[460px] xl:w-[520px] 2xl:w-[600px] bg-slate-50 border-l border-slate-200 flex flex-col z-10 shadow-[-4px_0_24px_-12px_rgba(0,0,0,0.05)]">
      
      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
        
        {/* 1. CUSTOMER SELECTOR */}
        <section>
          <CustomerSelector 
            mode={mode}
            customers={customers}
            setCustomers={setCustomers}
            selectedCustomer={selectedCustomer}
            setSelectedCustomer={setSelectedCustomer}
            appUser={appUser}
            selectedLocation={selectedLocation}
          />
        </section>

        <Separator className="bg-slate-200/60" />

        {/* 2. ADJUSTMENTS (Vouchers & Exchange) */}
        {mode === 'normal' && (
           <section>
             <VoucherExchangePanel 
               discountType={discountType} setDiscountType={setDiscountType} discountValue={discountValue} setDiscountValue={setDiscountValue}
               voucherCode={voucherCode} setVoucherCode={setVoucherCode} activeVoucher={activeVoucher} setActiveVoucher={setActiveVoucher}
               handlingFee={handlingFee} setHandlingFee={setHandlingFee} handleApplyVoucher={handleApplyVoucher}
               isExchangeOpen={isExchangeOpen} setIsExchangeOpen={setIsExchangeOpen} exchangeMode={exchangeMode} setExchangeMode={setExchangeMode}
               exchangeInvoiceNo={exchangeInvoiceNo} setExchangeInvoiceNo={setExchangeInvoiceNo} exchangeValue={exchangeValue} setExchangeValue={setExchangeValue}
               exchangeNotes={exchangeNotes} setExchangeNotes={setExchangeNotes} handleFetchExchangeItem={handleFetchExchangeItem} exchangeNum={exchangeNum}
             />
           </section>
        )}

        {/* 3. SETTLEMENT MODE */}
        {(['normal', 'custom', 'repair', 'return'].includes(mode)) && (
          <section className="space-y-2.5">
            <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              {mode === 'return' ? 'Refund Method' : 'Payment Method'}
            </Label>
            <div className="grid grid-cols-5 gap-2">
              {[
                { id: 'cash', label: 'Cash', icon: Banknote },
                { id: 'card', label: 'Card', icon: CreditCard },
                { id: 'upi', label: 'UPI', icon: QrCode },
                { id: 'bank', label: 'Bank', icon: Building },
                { id: 'split', label: 'Split', icon: Split }, 
              ].map((method) => {
                const isActive = paymentMode === method.id;
                return (
                  <button
                    key={method.id} 
                    onClick={() => setPaymentMode(method.id)}
                    className={`flex flex-col items-center justify-center gap-1.5 h-14 border rounded-xl transition-all duration-200 ${
                      isActive 
                        ? `${theme.light} ${theme.ring} border-transparent ${theme.text} shadow-sm ring-1` 
                        : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-100 hover:text-slate-800'
                    }`}
                  >
                    <method.icon className={`h-5 w-5 ${isActive ? theme.text : 'text-slate-400'}`} />
                    <span className="text-[10px] font-semibold tracking-tight">{method.label}</span>
                  </button>
                )
              })}
            </div>

            {/* TOUCH-FRIENDLY SPLIT PAYMENT INPUTS */}
            {paymentMode === 'split' && (
              <div className="mt-2 p-3 bg-white border border-slate-200 rounded-xl space-y-3 shadow-sm animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="space-y-1">
                    <Label className="text-[10px] text-slate-500 uppercase font-semibold tracking-wider">Cash</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">₹</span>
                      <Input type="number" placeholder="0" className="h-10 pl-7 text-sm rounded-lg border-slate-200 focus-visible:ring-slate-300" value={splitPayments?.cash} onChange={e => setSplitPayments({...splitPayments, cash: e.target.value})} />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] text-slate-500 uppercase font-semibold tracking-wider">Card</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">₹</span>
                      <Input type="number" placeholder="0" className="h-10 pl-7 text-sm rounded-lg border-slate-200 focus-visible:ring-slate-300" value={splitPayments?.card} onChange={e => setSplitPayments({...splitPayments, card: e.target.value})} />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] text-slate-500 uppercase font-semibold tracking-wider">UPI</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">₹</span>
                      <Input type="number" placeholder="0" className="h-10 pl-7 text-sm rounded-lg border-slate-200 focus-visible:ring-slate-300" value={splitPayments?.upi} onChange={e => setSplitPayments({...splitPayments, upi: e.target.value})} />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] text-slate-500 uppercase font-semibold tracking-wider">Bank</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">₹</span>
                      <Input type="number" placeholder="0" className="h-10 pl-7 text-sm rounded-lg border-slate-200 focus-visible:ring-slate-300" value={splitPayments?.bank} onChange={e => setSplitPayments({...splitPayments, bank: e.target.value})} />
                    </div>
                  </div>
                </div>

                <div className="flex justify-between items-center pt-2 border-t border-slate-100">
                  <div className="text-xs font-medium text-slate-500">
                    Entered: <span className={`font-semibold tabular-nums ${isSplitValid ? "text-emerald-600" : "text-slate-800"}`}>₹{currentSplitTotal?.toLocaleString()}</span>
                  </div>
                  <div className="text-xs font-medium text-slate-500">
                    Remaining: <span className="font-semibold text-red-500 tabular-nums">₹{splitRemaining.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            )}
          </section>
        )}
      </div>

      {/* 4. LEDGER & FOOTER */}
      <div className="bg-white p-4 border-t border-slate-200 shadow-[0_-8px_30px_-15px_rgba(0,0,0,0.1)] z-20">
        
        {/* Hides full ledger if custom, challan, repair, or return mode is active */}
        {!['custom', 'challan', 'repair', 'return'].includes(mode) && (
          <div className="space-y-1.5 text-sm text-slate-500 pb-3 border-b border-slate-100 mb-3">
            <div className="flex justify-between items-center">
              <span>Subtotal</span>
              <span className="tabular-nums font-medium text-slate-700">
                ₹{(subtotal || 0).toLocaleString()} 
              </span>
            </div>
            {mode === 'normal' && discountAmount > 0 && (
              <div className="flex justify-between items-center text-red-500">
                <span>Discount</span><span className="tabular-nums">- ₹{discountAmount.toLocaleString()}</span>
              </div>
            )}
            {mode === 'normal' && exchangeNum > 0 && (
              <div className="flex justify-between items-center text-blue-600">
                <span>Exchange Credit</span><span className="tabular-nums">- ₹{exchangeNum.toLocaleString()}</span>
              </div>
            )}
            {mode === 'normal' && activeVoucher && (
              <div className="flex justify-between items-center text-emerald-600">
                <span>Voucher Auth</span><span className="tabular-nums">- ₹{activeVoucher.amount.toLocaleString()}</span>
              </div>
            )}
            {mode === 'normal' && (
              <>
                <div className="flex justify-between items-center text-slate-800 font-semibold pt-1.5 mt-1.5 border-t border-slate-100/50">
                  <span>Taxable Value {handlingAmt > 0 && <span className="text-[10px] font-normal text-slate-400 ml-1">(inc. Handling ₹{handlingAmt})</span>}</span>
                  <span className="tabular-nums">₹{finalTaxableValue?.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>CGST + SGST (3%)</span><span className="tabular-nums">+ ₹{(cgstAmount + sgstAmount)?.toLocaleString()}</span>
                </div>
                
                {/* Round Off Output */}
                {roundOffAmount !== 0 && roundOffAmount !== undefined && (
                  <div className="flex justify-between items-center">
                    <span>Round Off</span>
                    <span className={`tabular-nums ${roundOffAmount > 0 ? "text-emerald-500" : "text-red-400"}`}>
                      {roundOffAmount > 0 ? '+' : ''} ₹{roundOffAmount.toFixed(2)}
                    </span>
                  </div>
                )}
                
                {/* --- SHOW ADVANCE PAYMENT DEDUCTION --- */}
                {cartAdvance > 0 && (
                  <div className="flex justify-between items-center font-bold text-[#881798] pt-1 border-t border-slate-100 mt-1">
                    <span>Advance Received</span>
                    <span className="tabular-nums">- ₹{cartAdvance.toLocaleString()}</span>
                  </div>
                )}

              </>
            )}
          </div>
        )}

        <div className="flex justify-between items-end mb-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            {mode === 'custom' || mode === 'repair' ? 'Advance Payment' : mode === 'return' ? 'Refund Amount' : mode === 'challan' ? 'Memo Value' : 'Net Payable'}
          </p>
          <p className={`text-4xl font-bold tracking-tight tabular-nums ${theme.text}`}>
             ₹{displayTotal.toLocaleString()}
          </p>
        </div>

        <div className="flex gap-2.5 w-full">
          {mode === 'normal' && (
            <Button 
              onClick={() => onPreviewRequest(true)} 
              disabled={isProcessing || cartLength === 0} 
              variant="outline"
              className="flex-1 font-semibold h-12 text-orange-600 border-orange-200 bg-orange-50/50 hover:bg-orange-100 hover:border-orange-300 rounded-xl transition-all"
            >
              Print Estimate
            </Button>
          )}
          
          <Button 
            onClick={() => onPreviewRequest(false)} 
            disabled={
              isProcessing || 
              (!['custom', 'repair', 'return'].includes(mode) && cartLength === 0) || 
              (paymentMode === 'split' && !isSplitValid)
            } 
            className={`${mode === 'normal' ? 'flex-1' : 'w-full'} font-semibold h-12 text-white ${theme.bg} hover:opacity-90 rounded-xl transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {isProcessing ? <Loader2 className="animate-spin w-5 h-5" /> : mode === 'repair' ? 'Generate Ticket' : mode === 'custom' ? 'Submit Order' : mode === 'return' ? 'Process Return' : 'Finalize'}
          </Button>
        </div>
      </div>
    </div>
  )
}