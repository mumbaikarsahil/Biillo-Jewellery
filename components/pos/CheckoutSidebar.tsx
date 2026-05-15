import React, { useState, useEffect } from 'react'
import { 
  Loader2, Banknote, CreditCard, QrCode, Building, Split, 
  FileText, ChevronDown, CheckSquare, Gem, Wallet, IndianRupee 
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { 
  Select, SelectContent, SelectItem, 
  SelectTrigger, SelectValue 
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { supabase } from '@/lib/supabaseClient'
import { toast } from 'sonner' 

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
  setExchangePhysicalDetails,
  // Split Payment Props
  splitPayments, setSplitPayments, currentSplitTotal, 
  
  // Custom, Repair, & Return Data
  customOrderDetails, repairDetails, returnDetails,
  
  // Ledger Props
  isProcessing, finalPayable, subtotal, discountAmount, appliedVoucherAmount, handlingAmt, 
  finalTaxableValue, cgstAmount, sgstAmount, roundOffAmount,
  
  // WALLET STATES FROM HOOK
  appliedKittyAmount, setAppliedKittyAmount,
  appliedKittyPlanId, setAppliedKittyPlanId,
  appliedCreditAmount, setAppliedCreditAmount,

  estimateChargeType, 
  setEstimateChargeType,
  estimateHandlingPercent,
  setEstimateHandlingPercent,
  
  setCart, 
  setMode  
}: any) {
  
  const themeMap: Record<string, { bg: string, text: string, ring: string, light: string }> = {
    estimate: { bg: 'bg-[#D83B01]', text: 'text-[#D83B01]', ring: 'ring-[#D83B01]', light: 'bg-[#D83B01]/10' },
    custom: { bg: 'bg-[#881798]', text: 'text-[#881798]', ring: 'ring-[#881798]', light: 'bg-[#881798]/10' },
    repair: { bg: 'bg-[#E3008C]', text: 'text-[#E3008C]', ring: 'ring-[#E3008C]', light: 'bg-[#E3008C]/10' }, 
    return: { bg: 'bg-[#C50F1F]', text: 'text-[#C50F1F]', ring: 'ring-[#C50F1F]', light: 'bg-[#C50F1F]/10' },
    challan: { bg: 'bg-[#107C10]', text: 'text-[#107C10]', ring: 'ring-[#107C10]', light: 'bg-[#107C10]/10' },
    normal: { bg: 'bg-[#0078D7]', text: 'text-[#0078D7]', ring: 'ring-[#0078D7]', light: 'bg-[#0078D7]/10' },
  }
  
  const theme = themeMap[mode] || themeMap.normal

  const [transactionRef, setTransactionRef] = useState('')
  const [paymentRemarks, setPaymentRemarks] = useState('')
  const [bankAccounts, setBankAccounts] = useState<any[]>([])
  const [selectedBankId, setSelectedBankId] = useState<string>('none')
  const [transferType, setTransferType] = useState<string>('IMPS') 
  const [splitRefs, setSplitRefs] = useState({ card: '', upi: '', bank: '', cheque: '' })

  // Reset wallets if customer is changed
  useEffect(() => {
    if (!selectedCustomer) {
      setAppliedKittyAmount(0)
      setAppliedCreditAmount(0)
    }
  }, [selectedCustomer, setAppliedKittyAmount, setAppliedCreditAmount])

  useEffect(() => {
    const fetchBanks = async () => {
      if (!appUser?.company_id) return
      const { data } = await supabase
        .from('company_bank_accounts')
        .select('id, bank_name, account_number')
        .eq('company_id', appUser.company_id)
      
      if (data) setBankAccounts(data)
    }
    fetchBanks()
  }, [appUser?.company_id])

  // --- SAFE MATH CALCULATIONS ---
  const cartAdvance = cart?.reduce((sum: number, item: any) => sum + (Number(item.advance_paid) || 0), 0) || 0;
  const invoiceTotalValue = (Number(finalTaxableValue) || 0) + (Number(cgstAmount) || 0) + (Number(sgstAmount) || 0) + (Number(roundOffAmount) || 0);

  const displayTotal = mode === 'custom' ? (Number(customOrderDetails?.advance_paid) || 0) 
                       : mode === 'repair' ? (Number(repairDetails?.advancePaid) || 0) 
                       : mode === 'return' ? (Number(returnDetails?.calculatedRefund) || 0) 
                       : (Number(finalPayable) || 0);

  const splitRemaining = Math.max(0, displayTotal - (Number(currentSplitTotal) || 0))
  const isSplitValid = Math.abs((Number(currentSplitTotal) || 0) - displayTotal) < 0.1

  // ✨ --- ENHANCED CUSTOM ORDER MATH (100% NaN Protected) --- ✨
  const customEstBase = Number(customOrderDetails?.estimated_value) || 0;
  const customDiscount = discountType === 'percent' ? (customEstBase * (Number(discountValue) || 0) / 100) : (Number(discountValue) || 0);
  const safeExchangeNum = Number(exchangeNum) || 0;
  const voucherVal = Number(activeVoucher?.amount) || 0;
  const handlingVal = Number(activeVoucher?.handling_fee) || 0;
  const effectiveVoucherCredit = Math.max(0, voucherVal - handlingVal);
  
  // Calculate Taxable after Deductions safely
  const customTaxable = Math.max(0, customEstBase - customDiscount - safeExchangeNum - effectiveVoucherCredit);
  const customCgst = customTaxable * 0.015;
  const customSgst = customTaxable * 0.015;
  const customTotalEstimate = Math.round(customTaxable + customCgst + customSgst);

  const customAdvancePaid = Number(customOrderDetails?.advance_paid) || 0;
  const totalSettlements = (Number(appliedKittyAmount) || 0) + (Number(appliedCreditAmount) || 0);

  // Final Estimated Balance Due on Delivery
  const customNetEst = Math.max(0, customTotalEstimate - customAdvancePaid - totalSettlements);

  // ONLY clear wallets if an activeVoucher is applied (Manual discounts are now freely allowed to club)
  useEffect(() => {
    if (activeVoucher && (appliedKittyAmount > 0 || appliedCreditAmount > 0)) {
      setAppliedKittyAmount(0);
      setAppliedCreditAmount(0);
      toast.warning("Settlements Reset", { description: "Applying a Voucher clears Wallet/Kitty settlements." });
    }
  }, [activeVoucher, appliedKittyAmount, appliedCreditAmount, setAppliedKittyAmount, setAppliedCreditAmount]);

  const handleFinalize = (isEstimate: boolean) => {
    let finalRef = transactionRef;
    let finalTransferType = paymentMode === 'bank' ? transferType : null;

    if (paymentMode === 'split') {
      const compiledRefs = [];
      if (Number(splitPayments?.card) > 0 && splitRefs.card) compiledRefs.push(`Card: ${splitRefs.card}`);
      if (Number(splitPayments?.upi) > 0 && splitRefs.upi) compiledRefs.push(`UPI: ${splitRefs.upi}`);
      if (Number(splitPayments?.bank) > 0 && splitRefs.bank) compiledRefs.push(`Bank: ${splitRefs.bank}`);
      if (Number(splitPayments?.cheque) > 0 && splitRefs.cheque) compiledRefs.push(`Cheque: ${splitRefs.cheque}`);
      
      finalRef = compiledRefs.join(' | ');
      if (Number(splitPayments?.bank) > 0) finalTransferType = transferType;
    }

    onPreviewRequest(isEstimate, {
      transaction_reference: finalRef,
      payment_remarks: paymentRemarks,
      billing_remarks: paymentRemarks,
      target_bank_account_id: selectedBankId !== 'none' ? selectedBankId : null,
      transfer_type: finalTransferType,
      
      applied_kitty: appliedKittyAmount,
      kitty_plan_id: appliedKittyPlanId,
      applied_credit: appliedCreditAmount
    })
  }

  return (
    <div className="w-full lg:w-[460px] xl:w-[520px] 2xl:w-[600px] bg-slate-50 border-l border-slate-200 flex flex-col z-10 shadow-[-4px_0_24px_-12px_rgba(0,0,0,0.05)]">
      
      <div className="flex-1 overflow-y-auto p-4 space-y-5 pb-12 custom-scrollbar">
        
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
            subtotal={subtotal}
            onApplyWallet={(type: 'kitty' | 'credit', amount: number, planId?: string) => {
              if (activeVoucher) {
                 return toast.error("Clubbing Restricted", { description: "Cannot apply Wallet/Kitty when Vouchers are active. Clear the voucher first."});
              }

              if (type === 'kitty') {
                if (invoiceTotalValue < amount) {
                  toast.error(`Redemption Limit: Kitty value (₹${amount.toLocaleString()}) exceeds the total invoice value.`);
                  return;
                }
                setAppliedKittyAmount(amount);
                if (planId) setAppliedKittyPlanId(planId); 
              } 
              else if (type === 'credit') {
                if (invoiceTotalValue < amount + appliedKittyAmount) {
                   toast.error("Total settlements cannot exceed the invoice value.");
                   return;
                }
                setAppliedCreditAmount(amount);
              }
            }}
          />
        </section>

        <Separator className="bg-slate-200/60" />

        {/* 2. ADJUSTMENTS */}
        {['normal', 'custom'].includes(mode) && (
           <section className="animate-in fade-in duration-300">
             <VoucherExchangePanel 
               discountType={discountType} setDiscountType={setDiscountType} discountValue={discountValue} setDiscountValue={setDiscountValue}
               voucherCode={voucherCode} setVoucherCode={setVoucherCode} activeVoucher={activeVoucher} setActiveVoucher={setActiveVoucher}
               handlingFee={handlingFee} setHandlingFee={setHandlingFee} handleApplyVoucher={handleApplyVoucher}
               isExchangeOpen={isExchangeOpen} setIsExchangeOpen={setIsExchangeOpen} exchangeMode={exchangeMode} setExchangeMode={setExchangeMode}
               exchangeInvoiceNo={exchangeInvoiceNo} setExchangeInvoiceNo={setExchangeInvoiceNo} exchangeValue={exchangeValue} setExchangeValue={setExchangeValue}
               exchangeNotes={exchangeNotes} setExchangeNotes={setExchangeNotes} handleFetchExchangeItem={handleFetchExchangeItem} exchangeNum={exchangeNum}
               setExchangePhysicalDetails={setExchangePhysicalDetails}
             />
           </section>
        )}

        {/* 3. GENERAL REMARKS */}
        {(['normal', 'custom', 'repair', 'return'].includes(mode)) && (
          <section className="animate-in fade-in slide-in-from-bottom-2">
            <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 block">
              Billing Remarks
            </Label>
            <div className="relative">
              <FileText className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <Textarea 
                placeholder="Internal notes or billing remarks (e.g., VIP client, delivery requests...)" 
                className="min-h-[70px] pl-9 py-2.5 text-xs bg-white border-slate-200 resize-none placeholder:text-slate-400 focus-visible:ring-slate-300 shadow-sm rounded-xl"
                value={paymentRemarks}
                onChange={(e) => setPaymentRemarks(e.target.value)}
              />
            </div>
          </section>
        )}

        {/* 4. SETTLEMENT MODE */}
        {(['normal', 'custom', 'repair', 'return'].includes(mode)) && (
          <section className="space-y-3 bg-white p-3 border border-slate-200 rounded-2xl shadow-sm">
            <Label className="text-xs font-bold text-slate-800 uppercase tracking-wider pl-1">
              {mode === 'return' ? 'Refund Method' : 'Balance Settlement Method'}
            </Label>
            
            <div className="grid grid-cols-6 gap-2">
              {[
                { id: 'cash', label: 'Cash', icon: Banknote },
                { id: 'card', label: 'Card', icon: CreditCard },
                { id: 'upi', label: 'UPI', icon: QrCode },
                { id: 'bank', label: 'Bank', icon: Building },
                { id: 'cheque', label: 'Cheque', icon: CheckSquare }, 
                { id: 'split', label: 'Split', icon: Split }, 
              ].map((method) => {
                const isActive = paymentMode === method.id;
                return (
                  <button
                    key={method.id} 
                    onClick={() => {
                      setPaymentMode(method.id);
                      setTransactionRef(''); // Reset ref on mode change
                      setSplitRefs({ card: '', upi: '', bank: '', cheque: '' });
                    }}
                    className={`flex flex-col items-center justify-center gap-1 h-14 border rounded-xl transition-all duration-200 ${
                      isActive 
                        ? `${theme.light} ${theme.ring} border-transparent ${theme.text} shadow-sm ring-1` 
                        : 'bg-slate-50 border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-100 hover:text-slate-800'
                    }`}
                  >
                    <method.icon className={`h-4 w-4 ${isActive ? theme.text : 'text-slate-400'}`} />
                    <span className="text-[9px] font-semibold tracking-tight">{method.label}</span>
                  </button>
                )
              })}
            </div>

            {/* A. Bank Transfer Details */}
            {paymentMode === 'bank' && (
              <div className="pt-2 space-y-3 animate-in fade-in slide-in-from-top-2">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] text-slate-500 uppercase font-semibold">Transfer Type</Label>
                    <Select value={transferType} onValueChange={setTransferType}>
                      <SelectTrigger className="h-9 text-xs bg-slate-50">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="IMPS">IMPS (Instant)</SelectItem>
                        <SelectItem value="NEFT">NEFT</SelectItem>
                        <SelectItem value="RTGS">RTGS</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] text-slate-500 uppercase font-semibold">Target Account</Label>
                    <Select value={selectedBankId} onValueChange={setSelectedBankId}>
                      <SelectTrigger className="h-9 text-xs bg-slate-50">
                        <SelectValue placeholder="Select Account..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Not Specified</SelectItem>
                        {bankAccounts.map(bank => (
                          <SelectItem key={bank.id} value={bank.id}>
                            {bank.bank_name} (...{bank.account_number?.slice(-4)})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] text-slate-500 uppercase font-semibold">Reference / UTR No.</Label>
                  <Input 
                    placeholder="Enter UTR or Transaction ID" 
                    className="h-9 text-xs bg-slate-50" 
                    value={transactionRef}
                    onChange={(e) => setTransactionRef(e.target.value)}
                  />
                </div>
              </div>
            )}

            {/* B. UPI, Card, or Cheque Details */}
            {['upi', 'card', 'cheque'].includes(paymentMode) && (
              <div className="pt-2 space-y-3 animate-in fade-in slide-in-from-top-2">
                {['upi', 'cheque'].includes(paymentMode) && (
                  <div className="space-y-1.5">
                    <Label className="text-[10px] text-slate-500 uppercase font-semibold">Target Account</Label>
                    <Select value={selectedBankId} onValueChange={setSelectedBankId}>
                      <SelectTrigger className="h-9 text-xs bg-slate-50">
                        <SelectValue placeholder="Select Account..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Not Specified</SelectItem>
                        {bankAccounts.map(bank => (
                          <SelectItem key={bank.id} value={bank.id}>
                            {bank.bank_name} (...{bank.account_number?.slice(-4)})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label className="text-[10px] text-slate-500 uppercase font-semibold">
                    {paymentMode === 'upi' ? 'UPI Reference No.' : paymentMode === 'cheque' ? 'Cheque Number' : 'Auth / Receipt No.'}
                  </Label>
                  <Input 
                    placeholder={paymentMode === 'upi' ? "Enter 12-digit UPI Ref" : paymentMode === 'cheque' ? "Enter 6-digit Cheque No." : "Enter Machine Auth Code"} 
                    className="h-9 text-xs bg-slate-50" 
                    value={transactionRef}
                    onChange={(e) => setTransactionRef(e.target.value)}
                  />
                </div>
              </div>
            )}

            {/* C. Split Payment Inputs & Context */}
            {paymentMode === 'split' && (
              <div className="pt-2 space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-[10px] text-slate-500 uppercase font-semibold tracking-wider pl-1">Cash</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">₹</span>
                      <Input type="number" placeholder="0" className="h-9 pl-7 text-sm rounded-lg border-slate-200 bg-slate-50 focus-visible:ring-slate-300 focus-visible:bg-white" value={splitPayments?.cash} onChange={e => setSplitPayments({...splitPayments, cash: e.target.value})} />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] text-slate-500 uppercase font-semibold tracking-wider pl-1">Card</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">₹</span>
                      <Input type="number" placeholder="0" className="h-9 pl-7 text-sm rounded-lg border-slate-200 bg-slate-50 focus-visible:ring-slate-300 focus-visible:bg-white" value={splitPayments?.card} onChange={e => setSplitPayments({...splitPayments, card: e.target.value})} />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] text-slate-500 uppercase font-semibold tracking-wider pl-1">UPI</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">₹</span>
                      <Input type="number" placeholder="0" className="h-9 pl-7 text-sm rounded-lg border-slate-200 bg-slate-50 focus-visible:ring-slate-300 focus-visible:bg-white" value={splitPayments?.upi} onChange={e => setSplitPayments({...splitPayments, upi: e.target.value})} />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] text-slate-500 uppercase font-semibold tracking-wider pl-1">Bank</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">₹</span>
                      <Input type="number" placeholder="0" className="h-9 pl-7 text-sm rounded-lg border-slate-200 bg-slate-50 focus-visible:ring-slate-300 focus-visible:bg-white" value={splitPayments?.bank} onChange={e => setSplitPayments({...splitPayments, bank: e.target.value})} />
                    </div>
                  </div>
                  <div className="space-y-1 col-span-2">
                    <Label className="text-[10px] text-slate-500 uppercase font-semibold tracking-wider pl-1">Cheque</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">₹</span>
                      <Input type="number" placeholder="0" className="h-9 pl-7 text-sm rounded-lg border-slate-200 bg-slate-50 focus-visible:ring-slate-300 focus-visible:bg-white" value={splitPayments?.cheque} onChange={e => setSplitPayments({...splitPayments, cheque: e.target.value})} />
                    </div>
                  </div>
                </div>

                {/* DYNAMIC SPLIT REFERENCES */}
                {(Number(splitPayments?.card) > 0 || Number(splitPayments?.upi) > 0 || Number(splitPayments?.bank) > 0 || Number(splitPayments?.cheque) > 0) && (
                  <div className="pt-3 border-t border-slate-100 space-y-3">
                    
                    {(Number(splitPayments?.upi) > 0 || Number(splitPayments?.bank) > 0 || Number(splitPayments?.cheque) > 0) && (
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5 col-span-2 sm:col-span-1">
                          <Label className="text-[10px] text-slate-500 uppercase font-semibold">Target Account</Label>
                          <Select value={selectedBankId} onValueChange={setSelectedBankId}>
                            <SelectTrigger className="h-8 text-xs bg-slate-50">
                              <SelectValue placeholder="Select Account..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Not Specified</SelectItem>
                              {bankAccounts.map(bank => (
                                <SelectItem key={bank.id} value={bank.id}>
                                  {bank.bank_name} (...{bank.account_number?.slice(-4)})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        {Number(splitPayments?.bank) > 0 && (
                          <div className="space-y-1.5 col-span-2 sm:col-span-1">
                            <Label className="text-[10px] text-slate-500 uppercase font-semibold">Transfer Type</Label>
                            <Select value={transferType} onValueChange={setTransferType}>
                              <SelectTrigger className="h-8 text-xs bg-slate-50">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="IMPS">IMPS (Instant)</SelectItem>
                                <SelectItem value="NEFT">NEFT</SelectItem>
                                <SelectItem value="RTGS">RTGS</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label className="text-[10px] text-slate-500 uppercase font-semibold tracking-wider">Reference Numbers</Label>
                      {Number(splitPayments?.card) > 0 && (
                        <div className="flex items-center gap-2">
                          <span className="w-14 text-[10px] font-bold text-slate-400">CARD</span>
                          <Input placeholder="Auth Code" className="h-8 text-xs flex-1 bg-slate-50" value={splitRefs.card} onChange={e => setSplitRefs({...splitRefs, card: e.target.value})} />
                        </div>
                      )}
                      {Number(splitPayments?.upi) > 0 && (
                        <div className="flex items-center gap-2">
                          <span className="w-14 text-[10px] font-bold text-slate-400">UPI</span>
                          <Input placeholder="12-digit UPI Ref" className="h-8 text-xs flex-1 bg-slate-50" value={splitRefs.upi} onChange={e => setSplitRefs({...splitRefs, upi: e.target.value})} />
                        </div>
                      )}
                      {Number(splitPayments?.bank) > 0 && (
                        <div className="flex items-center gap-2">
                          <span className="w-14 text-[10px] font-bold text-slate-400">BANK</span>
                          <Input placeholder="UTR No." className="h-8 text-xs flex-1 bg-slate-50" value={splitRefs.bank} onChange={e => setSplitRefs({...splitRefs, bank: e.target.value})} />
                        </div>
                      )}
                      {Number(splitPayments?.cheque) > 0 && (
                        <div className="flex items-center gap-2">
                          <span className="w-14 text-[10px] font-bold text-slate-400">CHEQUE</span>
                          <Input placeholder="6-digit Cheque No." className="h-8 text-xs flex-1 bg-slate-50" value={splitRefs.cheque} onChange={e => setSplitRefs({...splitRefs, cheque: e.target.value})} />
                        </div>
                      )}
                    </div>

                  </div>
                )}

                <div className="flex justify-between items-center pt-3 mt-1 border-t border-slate-100">
                  <div className="text-xs font-medium text-slate-500">
                    Entered: <span className={`font-semibold tabular-nums ${isSplitValid ? "text-emerald-600" : "text-slate-800"}`}>₹{(Number(currentSplitTotal) || 0).toLocaleString()}</span>
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
        
        {/* NORMAL MODE LEDGER */}
        {mode === 'normal' && (
          <div className="space-y-1.5 text-sm text-slate-500 pb-3 border-b border-slate-100 mb-3">
            
            <div className="flex justify-between items-center">
              <span>Subtotal (MRP)</span>
              <span className="tabular-nums font-medium text-slate-700">
                ₹{(Number(subtotal) || 0).toLocaleString()} 
              </span>
            </div>
            
            {/* MANUAL DISCOUNTS */}
            {Number(discountAmount) > 0 && (
              <div className="flex justify-between items-center text-red-500">
                <span>Manual Discount</span><span className="tabular-nums">- ₹{(Number(discountAmount) || 0).toLocaleString()}</span>
              </div>
            )}
            
            {/* EXCHANGES & VOUCHERS */}
            {safeExchangeNum > 0 && (
              <div className="flex justify-between items-center text-blue-600">
                <span>Old Gold / Exchange</span><span className="tabular-nums">- ₹{safeExchangeNum.toLocaleString()}</span>
              </div>
            )}
            {activeVoucher && (
              <div className="flex justify-between items-center text-emerald-600">
                <span>Voucher Redemption</span><span className="tabular-nums">- ₹{(Number(activeVoucher.amount) || 0).toLocaleString()}</span>
              </div>
            )}
            
            {/* TAX CALCULATION (Pre-Tax Subtotal - All Deductions) */}
            <div className="flex justify-between items-center text-slate-800 font-semibold pt-1.5 mt-1.5 border-t border-slate-100/50">
              <span>Taxable Value {Number(handlingAmt) > 0 && <span className="text-[10px] font-normal text-slate-400 ml-1">(inc. Handling ₹{handlingAmt})</span>}</span>
              <span className="tabular-nums">₹{(Number(finalTaxableValue) || 0).toLocaleString()}</span>
            </div>
            
            <div className="flex justify-between items-center">
              <span>CGST + SGST (3%)</span><span className="tabular-nums">+ ₹{(Number(cgstAmount) + Number(sgstAmount)).toLocaleString()}</span>
            </div>

            {/* TOTAL INVOICE ROW */}
            <div className="flex justify-between items-center font-bold text-slate-900 pt-2 border-t border-slate-200">
              <span>Total Invoice Value</span>
              <span className="tabular-nums">₹{invoiceTotalValue.toLocaleString()}</span>
            </div>

            {/* PRE-PAID SETTLEMENTS (Deductions from the Final Total) */}
            <div className="pt-2 space-y-1">
              {cartAdvance > 0 && (
                <div className="flex justify-between items-center text-slate-500 italic">
                  <span>Less: Advance Received</span>
                  <span className="tabular-nums">- ₹{cartAdvance.toLocaleString()}</span>
                </div>
              )}
              {Number(appliedKittyAmount) > 0 && (
                <div className="flex justify-between items-center text-purple-600 font-bold animate-in slide-in-from-right-2">
                  <span className="flex items-center gap-1.5"><Gem className="w-3.5 h-3.5"/> Less: Kitty Payment</span>
                  <span className="tabular-nums">- ₹{(Number(appliedKittyAmount) || 0).toLocaleString()}</span>
                </div>
              )}
              {Number(appliedCreditAmount) > 0 && (
                <div className="flex justify-between items-center text-emerald-600 font-bold animate-in slide-in-from-right-2">
                  <span className="flex items-center gap-1.5"><Wallet className="w-3.5 h-3.5"/> Less: Wallet Payment</span>
                  <span className="tabular-nums">- ₹{(Number(appliedCreditAmount) || 0).toLocaleString()}</span>
                </div>
              )}
            </div>

            {Number(roundOffAmount) !== 0 && roundOffAmount !== undefined && (
              <div className="flex justify-between items-center pt-2">
                <span>Round Off</span>
                <span className={`tabular-nums ${Number(roundOffAmount) > 0 ? "text-emerald-500" : "text-red-400"}`}>
                  {Number(roundOffAmount) > 0 ? '+' : ''} ₹{Math.abs(Number(roundOffAmount)).toFixed(2)}
                </span>
              </div>
            )}

          </div>
        )}

        {/* ✨ UPDATED CUSTOM ORDER ESTIMATE LEDGER WITH SAFE MATH ✨ */}
        {mode === 'custom' && customEstBase > 0 && (
          <div className="space-y-1.5 text-sm text-slate-500 pb-3 border-b border-slate-100 mb-3 bg-purple-50/30 p-3 rounded-lg border border-purple-100 animate-in fade-in">
            <div className="flex justify-between items-center mb-1">
              <span className="text-[10px] font-bold uppercase tracking-widest text-purple-800">Est. Final Calculation</span>
            </div>
            
            <div className="flex justify-between items-center">
              <span>Estimated Base Value</span>
              <span className="tabular-nums font-medium text-slate-700">₹{customEstBase.toLocaleString('en-IN')}</span>
            </div>
            
            {Number(customDiscount) > 0 && (
              <div className="flex justify-between items-center text-red-500">
                <span>Discount Applied</span>
                <span className="tabular-nums">- ₹{customDiscount.toLocaleString('en-IN')}</span>
              </div>
            )}
            
            {safeExchangeNum > 0 && (
              <div className="flex justify-between items-center text-blue-600">
                <span>Exchange Credit</span>
                <span className="tabular-nums">- ₹{safeExchangeNum.toLocaleString('en-IN')}</span>
              </div>
            )}
            
            {activeVoucher && (
              <div className="flex justify-between items-center text-emerald-600 font-medium">
                <span>Voucher Auth {Number(activeVoucher.handling_fee) > 0 ? `(Post ₹${activeVoucher.handling_fee} Fee)` : ''}</span>
                <span className="tabular-nums">- ₹{effectiveVoucherCredit.toLocaleString('en-IN')}</span>
              </div>
            )}

            <div className="flex justify-between border-t border-purple-200/50 pt-1 mt-1 text-slate-800 font-semibold">
              <span>Estimated Taxable Value</span>
              <span>₹{customTaxable.toLocaleString('en-IN')}</span>
            </div>
            
            <div className="flex justify-between text-xs text-slate-600 mt-1">
              <span>Estimated CGST (1.5%)</span>
              <span>+ ₹{customCgst.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
            </div>
            <div className="flex justify-between text-xs text-slate-600 pb-1">
              <span>Estimated SGST (1.5%)</span>
              <span>+ ₹{customSgst.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
            </div>

            <div className="flex justify-between py-1.5 mt-1 border-y border-purple-200/50 text-lg font-black text-slate-900">
              <span>Total Estimated Amount</span>
              <span>₹{customTotalEstimate.toLocaleString('en-IN')}</span>
            </div>
            
            {customAdvancePaid > 0 && (
              <div className="flex justify-between items-center text-emerald-600 font-bold mt-2">
                <span>Advance Paid (Cash/Bank)</span>
                <span className="tabular-nums">- ₹{customAdvancePaid.toLocaleString('en-IN')}</span>
              </div>
            )}

            {Number(appliedKittyAmount) > 0 && (
              <div className="flex justify-between items-center text-purple-600 font-bold mt-1">
                <span>Less: Kitty Payment</span>
                <span className="tabular-nums">- ₹{appliedKittyAmount.toLocaleString('en-IN')}</span>
              </div>
            )}
            
            {Number(appliedCreditAmount) > 0 && (
              <div className="flex justify-between items-center text-emerald-600 font-bold mt-1">
                <span>Less: Store Credit</span>
                <span className="tabular-nums">- ₹{appliedCreditAmount.toLocaleString('en-IN')}</span>
              </div>
            )}

            <div className="flex justify-between items-center text-purple-900 font-bold pt-1.5 mt-1 border-t border-purple-200/50">
              <span>Est. Balance on Pickup</span>
              <span className="tabular-nums">₹{customNetEst.toLocaleString('en-IN')}</span>
            </div>
          </div>
        )}

        <div className="flex justify-between items-end mb-3 mt-4 border-t-2 border-dashed border-slate-200 pt-3">
          <p className="text-xs font-black uppercase text-slate-500">
            {mode === 'custom' || mode === 'repair' ? 'Balance Advance' : mode === 'return' ? 'Refund Amount' : mode === 'challan' ? 'Memo Value' : 'Balance to Pay'}
          </p>
          <p className={`text-4xl font-bold tracking-tight tabular-nums ${theme.text}`}>
             ₹{displayTotal.toLocaleString()}
          </p>
        </div>

        <div className="flex flex-col gap-2.5 w-full">
          {mode === 'normal' && (
            <div className="flex flex-col bg-slate-100/50 p-2.5 rounded-xl border border-slate-200 gap-2 animate-in fade-in">
               <div className="flex items-center justify-between">
                 <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1">Estimate Add-ons</span>
                 <Select value={estimateChargeType} onValueChange={setEstimateChargeType}>
                   <SelectTrigger className="h-8 text-xs bg-white w-[140px] border-slate-200 shadow-sm font-semibold text-slate-700">
                     <SelectValue />
                   </SelectTrigger>
                   <SelectContent>
                     <SelectItem value="tax">Tax (3% GST)</SelectItem>
                     <SelectItem value="handling">Handling Charges</SelectItem>
                     <SelectItem value="none">No Extra Charges</SelectItem>
                   </SelectContent>
                 </Select>
               </div>
               
               {/* Custom Handling Percentage Input */}
               {estimateChargeType === 'handling' && (
                 <div className="flex justify-between items-center px-1 mt-1 animate-in fade-in">
                    <span className="text-[10px] text-slate-500 font-medium">Handling Percentage (%)</span>
                    <Input 
                      type="number" 
                      className="h-7 w-20 text-xs text-right bg-white" 
                      value={estimateHandlingPercent} 
                      onChange={(e) => setEstimateHandlingPercent(e.target.value)} 
                    />
                 </div>
               )}
               
               {/* Real-time Estimate Total Preview */}
               <div className="flex justify-between items-center px-1 animate-in fade-in mt-1 border-t border-slate-200/60 pt-2">
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Printed Est. Total:</span>
                  <span className="text-sm font-bold text-slate-800">
                    ₹{Math.max(0, Math.round(
                      estimateChargeType === 'tax' ? (Number(finalTaxableValue) || 0) + (Number(cgstAmount) || 0) + (Number(sgstAmount) || 0) :
                      estimateChargeType === 'handling' ? (Number(finalTaxableValue) || 0) + ((Number(finalTaxableValue) || 0) * (parseFloat(estimateHandlingPercent) || 0) / 100) :
                      (Number(finalTaxableValue) || 0)
                    )).toLocaleString()}
                  </span>
               </div>
            </div>
          )}
          
          <div className="flex gap-2.5 w-full">
            {mode === 'normal' && (
              <Button 
                onClick={() => handleFinalize(true)} 
                disabled={isProcessing || cartLength === 0} 
                variant="outline"
                className="flex-1 font-semibold h-12 text-orange-600 border-orange-200 bg-orange-50/50 hover:bg-orange-100 hover:border-orange-300 rounded-xl transition-all"
              >
                {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : "Save & Print Estimate"}
              </Button>
            )}
            
            <Button 
              onClick={() => handleFinalize(false)} 
              disabled={
                isProcessing || 
                (!['custom', 'repair', 'return'].includes(mode) && cartLength === 0) || 
                (paymentMode === 'split' && !isSplitValid)
              } 
              className={`${mode === 'normal' ? 'flex-1' : 'w-full'} font-semibold h-12 text-white ${theme.bg} hover:opacity-90 rounded-xl transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {isProcessing ? <Loader2 className="animate-spin w-5 h-5" /> : mode === 'repair' ? 'Generate Ticket' : mode === 'custom' ? 'Submit Order' : mode === 'return' ? 'Process Return' : 'Finalize Sale'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}