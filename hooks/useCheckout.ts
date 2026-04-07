import { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { toast } from 'sonner'

interface CheckoutConfig {
  appUser: any;
  selectedLocation: string;
  cart: any[];
  subtotal: number;
  mode: string;
  selectedCustomer: any;
  customOrderDetails: any;
  repairDetails: any; 
  returnDetails: any; 
  allBranches: any[];
  callRpc: Function;
}

export function useCheckout({ 
  appUser, selectedLocation, cart, subtotal, mode, selectedCustomer, customOrderDetails, repairDetails, returnDetails, allBranches, callRpc 
}: CheckoutConfig) {
  
  // Payment States
  const [paymentMode, setPaymentMode] = useState('cash') 
  const [splitPayments, setSplitPayments] = useState({ cash: '', card: '', upi: '', bank: '', cheque: '' })
  const [isProcessing, setIsProcessing] = useState(false)

  // --- ESTIMATE ADD-ON STATE ---
  const [estimateChargeType, setEstimateChargeType] = useState<'tax' | 'handling' | 'none'>('tax')
  const [estimateHandlingPercent, setEstimateHandlingPercent] = useState<string>('3')

  // --- CENTRALIZED WALLET STATE ---
  const [appliedKittyAmount, setAppliedKittyAmount] = useState(0)
  const [appliedPointsAmount, setAppliedPointsAmount] = useState(0)
  const [appliedCreditAmount, setAppliedCreditAmount] = useState(0)
  
  const currentSplitTotal = 
    (parseFloat(splitPayments.cash) || 0) + 
    (parseFloat(splitPayments.card) || 0) + 
    (parseFloat(splitPayments.upi) || 0) + 
    (parseFloat(splitPayments.bank) || 0) +
    (parseFloat(splitPayments.cheque) || 0)
  
  // Adjustments
  const [discountType, setDiscountType] = useState<'percent' | 'flat'>('percent')
  const [discountValue, setDiscountValue] = useState<string>('')
  
  // Vouchers
  const [voucherCode, setVoucherCode] = useState('')
  const [activeVoucher, setActiveVoucher] = useState<{ id: string, code: string, amount: number, handling_fee: number } | null>(null)
  const [handlingFee, setHandlingFee] = useState<string>('0')

  // Exchange
  const [isExchangeOpen, setIsExchangeOpen] = useState(false)
  const [exchangeInvoiceNo, setExchangeInvoiceNo] = useState<string>('')
  const [exchangeValue, setExchangeValue] = useState<string>('')
  const [exchangeNotes, setExchangeNotes] = useState<string>('')

  // ==============================================================
  // --- MATH ENGINE (PRE-TAX & ADVANCE ADJUSTMENTS) ---
  // ==============================================================
  
  // 1. Calculate Advance Paid (If this is a custom order pickup)
  const cartAdvance = cart?.reduce((sum: number, item: any) => sum + (Number(item.advance_paid) || 0), 0) || 0;

  // 2. Calculate Deductions
  const discountNum = parseFloat(discountValue) || 0
  const standardDiscount = discountType === 'percent' ? (subtotal * discountNum) / 100 : discountNum
  const totalWalletRedemptions = appliedKittyAmount + appliedPointsAmount + appliedCreditAmount;

  // 3. Deduct all pre-tax discounts
  let baseTaxable = Math.max(0, subtotal - standardDiscount - totalWalletRedemptions)
  
  const exchangeNum = parseFloat(exchangeValue) || 0
  baseTaxable = Math.max(0, baseTaxable - exchangeNum)
  const handlingAmt = parseFloat(handlingFee) || 0; 

  let finalTaxableValue = baseTaxable
  let appliedVoucherAmount = 0

  if (activeVoucher) {
      const vAmount = activeVoucher.amount;
      const hFee = activeVoucher.handling_fee || 0;
      if (baseTaxable >= vAmount) {
          appliedVoucherAmount = vAmount - hFee;
          finalTaxableValue = baseTaxable - appliedVoucherAmount;
      } else {
          finalTaxableValue = hFee;
          appliedVoucherAmount = baseTaxable > hFee ? baseTaxable - hFee : 0; 
      }
  }

  // 4. Calculate GST on Taxable Value
  const cgstAmount = parseFloat((finalTaxableValue * 0.015).toFixed(2))
  const sgstAmount = parseFloat((finalTaxableValue * 0.015).toFixed(2))
  
  // 5. Finalize Totals (Gross vs Net)
  const exactFinalPayable = finalTaxableValue + cgstAmount + sgstAmount
  const finalPayableGross = Math.round(exactFinalPayable)
  const roundOffAmount = parseFloat((finalPayableGross - exactFinalPayable).toFixed(2))

  // Net payable is the Invoice Total MINUS the Advance they already paid
  const finalPayableNet = Math.max(0, finalPayableGross - cartAdvance);

  // ==============================================================

  const handleApplyVoucher = async () => {
    if (!voucherCode.trim()) return;
    let codeToSearch = voucherCode.trim();
    if (codeToSearch.includes('?code=')) {
      codeToSearch = codeToSearch.split('?code=')[1].split('&')[0];
    }
    try {
      const { data: voucher, error } = await supabase
        .from('vouchers')
        .select(`id, code, discount_value, handling_fee, status, expiry_date, customer_id, customers ( id, full_name, phone )`)
        .ilike('code', codeToSearch) 
        .maybeSingle()
      
      if (error) throw error
      if (!voucher) return toast.error('Invalid Voucher: Code not found.')
      if (voucher.status !== 'registered') return toast.error(`Cannot Apply: Voucher is ${voucher.status.toUpperCase()}.`)

      if (voucher.expiry_date) {
        const expiryDate = new Date(voucher.expiry_date)
        expiryDate.setHours(0,0,0,0); const today = new Date(); today.setHours(0,0,0,0);
        if (expiryDate < today) return toast.error(`Expired: This voucher expired on ${expiryDate.toLocaleDateString()}.`)
      }

      if (voucher.customer_id && voucher.customers) {
        const rawCust = Array.isArray(voucher.customers) ? voucher.customers[0] : voucher.customers;
        if (selectedCustomer && selectedCustomer.id !== voucher.customer_id) {
          return toast.error(`Fraud Alert: Voucher registered to ${rawCust.full_name}.`)
        }
      }

      setActiveVoucher({ id: voucher.id, code: voucher.code, amount: voucher.discount_value, handling_fee: voucher.handling_fee })
      setHandlingFee(voucher.handling_fee?.toString() || '0') 
      setVoucherCode('')
      toast.success(`Voucher Applied!`)
    } catch (err) {
      toast.error('Failed to validate voucher.')
    }
  }

  const handleFetchExchangeItem = async (): Promise<boolean> => {
    if (!exchangeInvoiceNo.trim() || !appUser) {
      toast.error('Enter an invoice number.')
      return false
    }
    try {
      const { data: invoiceData, error: invErr } = await supabase
        .from('invoices')
        .select('id, invoice_number, subtotal')
        .ilike('invoice_number', exchangeInvoiceNo.trim())
        .eq('company_id', appUser.company_id)
        .maybeSingle()
        
      if (invErr) throw invErr
      if (!invoiceData) return false 
      
      setExchangeValue((invoiceData.subtotal || 0).toString())
      setExchangeNotes(`EXCHANGE (100% MRP): INV [${invoiceData.invoice_number}]`)
      toast.success(`100% Credit Applied.`)
      return true 
    } catch (err) {
      console.error(err)
      return false
    }
  }

  const generateDraftData = (isEstimate = false) => {
    const draftInvoiceNo = isEstimate ? 'DRAFT-EST' 
                         : mode === 'normal' ? 'DRAFT-INV' 
                         : mode === 'challan' ? 'DRAFT-CHL' 
                         : mode === 'repair' ? 'DRAFT-REP' 
                         : mode === 'return' ? 'DRAFT-RET' 
                         : 'DRAFT-ORD';
                         
    const formattedPaymentMode = paymentMode === 'split' ? `SPLIT: ${JSON.stringify(splitPayments)}` : paymentMode
    const activeBranch = allBranches?.find((b: any) => b.id === selectedLocation) || null;

    const mappedCustomOrder = mode === 'custom' && customOrderDetails ? {
      ...customOrderDetails,
      estimatedValue: customOrderDetails.estimated_value,
      advancePayment: customOrderDetails.advance_paid,
      designCode: customOrderDetails.design_reference,
      category: customOrderDetails.item_category,
      expectedGoldWt: customOrderDetails.expected_gold_g,
      expectedDiamondCts: customOrderDetails.expected_diamond_cts,
    } : null;

    // Estimate Overrides
    let printCgst = cgstAmount;
    let printSgst = sgstAmount;
    let printRoundOff = roundOffAmount;
    let printFinalTotal = finalPayableGross; // Print the gross before advance
    let printEstimateHandlingAmt = 0;

    if (isEstimate && mode === 'normal') {
        if (estimateChargeType === 'handling') {
            printCgst = 0;
            printSgst = 0;
            const hPct = parseFloat(estimateHandlingPercent) || 0;
            printEstimateHandlingAmt = parseFloat((finalTaxableValue * (hPct / 100)).toFixed(2));
            const exact = finalTaxableValue + printEstimateHandlingAmt;
            printFinalTotal = Math.round(exact);
            printRoundOff = parseFloat((printFinalTotal - exact).toFixed(2));
        } else if (estimateChargeType === 'none') {
            printCgst = 0;
            printSgst = 0;
            printFinalTotal = Math.round(finalTaxableValue);
            printRoundOff = parseFloat((printFinalTotal - finalTaxableValue).toFixed(2));
        }
    }

    return {
      mode: isEstimate ? 'estimate' : mode, 
      invoice_number: draftInvoiceNo,
      date: new Date(),
      customer: selectedCustomer,
      branch: activeBranch, 
      items: cart,
      customOrder: mappedCustomOrder, 
      repair: mode === 'repair' ? repairDetails : null, 
      returnDetails: mode === 'return' ? returnDetails : null, 
      
      subtotal, 
      discountAmount: standardDiscount, 
      voucherAmount: appliedVoucherAmount, 
      handlingFee: handlingAmt, 
      taxableValue: finalTaxableValue, 
      cgstAmount: printCgst, 
      sgstAmount: printSgst, 
      exactFinalPayable, 
      roundOffAmount: printRoundOff, 
      exchangeValue: exchangeNum, 
      
      appliedKitty: appliedKittyAmount,
      appliedPoints: appliedPointsAmount,
      appliedCredit: appliedCreditAmount,
      
      estimateChargeType, 
      estimateHandlingPct: estimateHandlingPercent,
      estimateHandlingAmt: printEstimateHandlingAmt,
      
      finalTotal: mode === 'custom' ? (Number(customOrderDetails?.advance_paid) || 0) 
                : mode === 'repair' ? (Number(repairDetails?.advancePaid) || 0) 
                : mode === 'return' ? (Number(returnDetails?.refundAmount) || 0) 
                : isEstimate && mode === 'normal' ? printFinalTotal 
                : finalPayableGross, // ALWAYS PASS GROSS TO THE PRINTER
      paymentMode: formattedPaymentMode
    }
  }

  const executeCheckout = async (isEstimate = false, customTransactionContext?: any) => {
    setIsProcessing(true)
    let finalNo = ''
    try {
      if (customTransactionContext) {
         if (customTransactionContext.applied_kitty) setAppliedKittyAmount(customTransactionContext.applied_kitty);
         if (customTransactionContext.applied_points) setAppliedPointsAmount(customTransactionContext.applied_points);
         if (customTransactionContext.applied_credit) setAppliedCreditAmount(customTransactionContext.applied_credit);
      }

      // Ensure split validation checks against the NET amount, not the gross!
      const requiredTotal = mode === 'custom' ? (Number(customOrderDetails?.advance_paid) || 0) 
                          : mode === 'repair' ? (Number(repairDetails?.advancePaid) || 0) 
                          : mode === 'return' ? (Number(returnDetails?.refundAmount) || 0) 
                          : finalPayableNet; 

      if (paymentMode === 'split' && Math.abs(currentSplitTotal - requiredTotal) > 0.1) {
        toast.error(`Split total must match ₹${requiredTotal.toLocaleString()}`);
        setIsProcessing(false); return { success: false };
      }

      if (isEstimate) {
        finalNo = `EST-${Date.now().toString().slice(-6)}`
        toast.success("Estimate generated.")
      } 
      else if (mode === 'normal') {
        const totalDeductions = standardDiscount + appliedKittyAmount + appliedPointsAmount + appliedCreditAmount;

        // PERFECT SCHEMA MATCH: Every field mapped explicitly
        const invoiceData = {
            customer_id: selectedCustomer?.id, 
            warehouse_id: selectedLocation,
            items: cart.map((item) => ({ item_id: item.id, rate: item.mrp })),
            
            // Financials
            subtotal: subtotal, 
            discount_amount: totalDeductions, 
            discounted_total: Math.max(0, subtotal - totalDeductions),
            taxable_value: finalTaxableValue,
            cgst_amount: cgstAmount, 
            sgst_amount: sgstAmount, 
            round_off_amount: roundOffAmount,
            final_total: finalPayableGross, // DB stores the FULL INVOICE VALUE
            advance_adjusted: cartAdvance,  // DB stores the ADVANCE DEDUCTION
            
            // Vouchers & Exchanges
            voucher_code: activeVoucher?.code || null,
            voucher_discount: appliedVoucherAmount, 
            Voucher_handling_fee: handlingAmt,
            exchange_value: exchangeNum, 
            exchange_notes: exchangeNotes, 
            
            // Payment Data
            payment_mode: paymentMode,
            split_payments: paymentMode === 'split' ? splitPayments : null,
            transaction_reference: customTransactionContext?.transaction_reference || null,
            payment_remarks: customTransactionContext?.payment_remarks || null,
            target_bank_account_id: customTransactionContext?.target_bank_account_id || null,
            transfer_type: customTransactionContext?.transfer_type || null
        }
        
        const { data, error } = await callRpc('pos_confirm_sale', { p_invoice_json: invoiceData, p_user_id: appUser?.user_id })
        if (error) throw error
        
        finalNo = data?.invoice_number || `INV-${Date.now().toString().slice(-6)}`
        if (activeVoucher) await supabase.from('vouchers').update({ status: 'redeemed', redeemed_at: new Date().toISOString() }).eq('id', activeVoucher.id)
        
        const customOrderIds = cart.filter(item => item.custom_order_id).map(item => item.custom_order_id);
        if (customOrderIds.length > 0) {
           await supabase.from('custom_orders').update({ status: 'delivered' }).in('id', customOrderIds);
        }

        const repairTicketIds = cart.filter(item => item.repair_ticket_id).map(item => item.repair_ticket_id);
        if (repairTicketIds.length > 0) {
           await supabase.from('repair_tickets').update({ status: 'delivered' }).in('id', repairTicketIds);
        }

        if (selectedCustomer) {
            let updatePayload: any = {};
            let shouldUpdateCustomer = false;

            if (customTransactionContext?.applied_points > 0) {
                updatePayload.pavitram_points = Math.max(0, (selectedCustomer.pavitram_points || 0) - customTransactionContext.applied_points);
                shouldUpdateCustomer = true;
            }
            if (customTransactionContext?.applied_credit > 0) {
                updatePayload.store_credit_balance = Math.max(0, (selectedCustomer.store_credit_balance || 0) - customTransactionContext.applied_credit);
                shouldUpdateCustomer = true;
            }
            if (customTransactionContext?.applied_kitty > 0) {
                updatePayload.kitty_plan_status = 'Redeemed';
                updatePayload.kitty_months_paid = 0; 
                shouldUpdateCustomer = true;
            }

            if (shouldUpdateCustomer) {
                await supabase.from('customers').update(updatePayload).eq('id', selectedCustomer.id);
            }
        }

        toast.success("Tax Invoice Generated!")
      } 
      else if (mode === 'repair') { 
        finalNo = `REP-${Date.now().toString().slice(-6)}`
        const { error } = await supabase.from('repair_tickets').insert({
          company_id: appUser?.company_id,
          ticket_number: finalNo,
          customer_id: selectedCustomer?.id,
          origin_warehouse_id: selectedLocation,
          current_warehouse_id: selectedLocation,
          item_description: repairDetails.itemDescription,
          gross_weight_g: Number(repairDetails.grossWeight),
          purity: repairDetails.purity,
          defect_notes: repairDetails.defectNotes,
          estimated_cost: Number(repairDetails.estimatedCost) || 0,
          advance_paid: Number(repairDetails.advancePaid) || 0,
          condition_photo_url: repairDetails.conditionPhotoUrl,
          expected_delivery_date: repairDetails.expectedDelivery || null,
          status: 'received_at_store'
        })
        if (error) throw error
        toast.success("Repair Ticket Generated!")
      }
      else if (mode === 'return') { 
        finalNo = `RET-${Date.now().toString().slice(-6)}`
        const { error } = await supabase.from('buybacks').insert({
          company_id: appUser?.company_id,
          voucher_number: finalNo,
          customer_id: selectedCustomer?.id,
          warehouse_id: selectedLocation,
          original_invoice_no: returnDetails.originalInvoiceNo || null,
          item_description: returnDetails.itemDescription,
          purity: returnDetails.purity,
          gross_weight_g: Number(returnDetails.grossWeight),
          gross_value: Number(returnDetails.grossValue) || 0,
          deduction_amount: Number(returnDetails.deductionAmount) || 0,
          net_refund: Number(returnDetails.refundAmount) || 0,
          refund_mode: paymentMode === 'split' ? JSON.stringify(splitPayments) : paymentMode,
        })
        if (error) throw error
        toast.success("Buyback processed & Refund logged!")
      }
      else if (mode === 'challan') {
        finalNo = `CHL-${Date.now().toString().slice(-6)}`
        await supabase.from('inventory_items').update({ status: 'sold_unbilled' }).in('id', cart.map(c => c.id))
        toast.success("Delivery Challan issued.")
      } 
      else if (mode === 'custom') {
        if (!selectedCustomer) throw new Error("Please select a customer for this Custom Order.")
        
        finalNo = `ORD-${Date.now().toString().slice(-6)}`
        const payload = {
          company_id: appUser?.company_id,
          origin_warehouse_id: selectedLocation, 
          customer_id: selectedCustomer.id,
          order_number: finalNo,
          design_reference: customOrderDetails.design_reference,
          item_category: customOrderDetails.item_category,
          expected_gold_g: Number(customOrderDetails.expected_gold_g) || null,
          expected_diamond_cts: Number(customOrderDetails.expected_diamond_cts) || null,
          estimated_value: Number(customOrderDetails.estimated_value) || 0,
          advance_paid: Number(customOrderDetails.advance_paid) || 0,
          status: 'pending_manufacturing' 
        }

        const { error } = await supabase.from('custom_orders').insert(payload)
        if (error) throw error
        toast.success(`Custom Order ${finalNo} submitted to manufacturing!`)
      }

      const finalDraftData = generateDraftData(isEstimate);
      if (customTransactionContext) {
          finalDraftData.appliedKitty = customTransactionContext.applied_kitty || 0;
          finalDraftData.appliedPoints = customTransactionContext.applied_points || 0;
          finalDraftData.appliedCredit = customTransactionContext.applied_credit || 0;
      }

      return { success: true, invoiceNo: finalNo, draftData: finalDraftData }
    } catch (err: any) {
      toast.error(err.message || 'Checkout failed.'); return { success: false }
    } finally { setIsProcessing(false) }
  }

  const resetCheckoutState = () => {
    setDiscountValue(''); setActiveVoucher(null); setHandlingFee('0'); 
    setExchangeValue(''); setExchangeNotes(''); setExchangeInvoiceNo('');
    setIsExchangeOpen(false); setPaymentMode('cash');
    setAppliedKittyAmount(0); setAppliedPointsAmount(0); setAppliedCreditAmount(0); 
    setSplitPayments({ cash: '', card: '', upi: '', bank: '', cheque: '' });
  }

  return {
    paymentMode, setPaymentMode, isProcessing, splitPayments, setSplitPayments, currentSplitTotal,
    discountType, setDiscountType, discountValue, setDiscountValue,
    voucherCode, setVoucherCode, activeVoucher, setActiveVoucher, handlingFee,
    isExchangeOpen, setIsExchangeOpen, exchangeInvoiceNo, setExchangeInvoiceNo, exchangeValue, setExchangeValue, exchangeNotes, setExchangeNotes,
    discountAmount: standardDiscount, appliedVoucherAmount, handlingAmt, finalTaxableValue, cgstAmount, sgstAmount, exactFinalPayable, roundOffAmount, 
    
    // We export the Net Payable (Amount Due) so the Sidebar knows what to charge!
    finalPayable: finalPayableNet, 
    exchangeNum,
    
    appliedKittyAmount, setAppliedKittyAmount, appliedPointsAmount, setAppliedPointsAmount, appliedCreditAmount, setAppliedCreditAmount,
    estimateChargeType, setEstimateChargeType, estimateHandlingPercent, setEstimateHandlingPercent, 

    handleApplyVoucher, handleFetchExchangeItem, generateDraftData, executeCheckout, resetCheckoutState
  }
}