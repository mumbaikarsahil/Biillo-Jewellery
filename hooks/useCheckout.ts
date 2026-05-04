import { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { toast } from 'sonner'
import { format } from 'date-fns'

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
  customBillingDate?: string; 
}

export function useCheckout({ 
  appUser, selectedLocation, cart, subtotal, mode, selectedCustomer, customOrderDetails, repairDetails, returnDetails, allBranches, callRpc, customBillingDate 
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
  const [appliedKittyPlanId, setAppliedKittyPlanId] = useState<string | null>(null)
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
  const [activeVoucher, setActiveVoucher] = useState<{ 
    id: string, 
    code: string, 
    amount: number, 
    handling_fee: number, 
    is_birthday_redemption?: boolean 
  } | null>(null)
  const [handlingFee, setHandlingFee] = useState<string>('0')

  // Exchange
  const [isExchangeOpen, setIsExchangeOpen] = useState(false)
  const [exchangeInvoiceNo, setExchangeInvoiceNo] = useState<string>('')
  const [exchangeValue, setExchangeValue] = useState<string>('')
  const [exchangeNotes, setExchangeNotes] = useState<string>('')
  const [exchangePhysicalDetails, setExchangePhysicalDetails] = useState<any>(null)


  // ==============================================================
  // --- DATE ENGINE ---
  // ==============================================================
  const getEffectiveDate = () => {
    if (!customBillingDate) return new Date();
    try {
      const currentTimeString = new Date().toISOString().split('T')[1];
      return new Date(`${customBillingDate}T${currentTimeString}`);
    } catch (e) {
      return new Date();
    }
  };

  const effectiveDate = getEffectiveDate();
  const effectiveDateISO = effectiveDate.toISOString();


  // ==============================================================
  // --- CLUBBING VALIDATION OVERRIDES ---
  // ==============================================================
  
  const discountNum = parseFloat(discountValue) || 0
  const standardDiscount = discountType === 'percent' ? (subtotal * discountNum) / 100 : discountNum
  const hasVoucher = activeVoucher !== null

  if (hasVoucher && (appliedKittyAmount > 0 || appliedCreditAmount > 0)) {
     setAppliedKittyAmount(0);
     setAppliedCreditAmount(0);
     toast.warning("Clubbing Restricted", { description: "Vouchers cannot be combined with Wallet & Kitty credits." });
  }

  // ==============================================================
  // --- MATH ENGINE (PRE-TAX & ADVANCE ADJUSTMENTS) ---
  // ==============================================================
  
  const cartAdvance = cart?.reduce((sum: number, item: any) => sum + (Number(item.advance_paid) || 0), 0) || 0;
  
  let effectiveSubtotal = subtotal;
  if (mode === 'custom') {
      effectiveSubtotal = Number(customOrderDetails?.estimated_value) || 0;
  }

  const exchangeNum = parseFloat(exchangeValue) || 0;
  let baseTaxable = Math.max(0, effectiveSubtotal - standardDiscount - exchangeNum);
  
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

  const cgstAmount = parseFloat((finalTaxableValue * 0.015).toFixed(2))
  const sgstAmount = parseFloat((finalTaxableValue * 0.015).toFixed(2))
  
  const exactFinalPayable = finalTaxableValue + cgstAmount + sgstAmount
  const finalPayableGross = Math.round(exactFinalPayable)
  const roundOffAmount = parseFloat((finalPayableGross - exactFinalPayable).toFixed(2))

  const finalPayableNet = Math.max(0, finalPayableGross - cartAdvance - appliedKittyAmount - appliedCreditAmount);


  // ==============================================================
  // --- HANDLERS ---
  // ==============================================================

  const handleApplyVoucher = async () => {
    if (appliedKittyAmount > 0 || appliedCreditAmount > 0) {
      return toast.error("Clubbing Error", { description: "Cannot apply vouchers when Wallet or Kitty balances are in use." });
    }

    if (!voucherCode.trim()) return;
    let codeToSearch = voucherCode.trim();
    if (codeToSearch.includes('?code=')) {
      codeToSearch = codeToSearch.split('?code=')[1].split('&')[0];
    }
    
    try {
      const { data: voucher, error } = await supabase
        .from('vouchers')
        .select(`
          id, code, discount_value, handling_fee, status, 
          valid_from, expiry_date, is_birthday_redemption, 
          customer_id, scan_count, customers ( id, full_name, phone )
        `)
        .ilike('code', codeToSearch) 
        .maybeSingle()
      
      if (error) throw error
      if (!voucher) return toast.error('Invalid Voucher: Code not found.')
      if (voucher.status !== 'registered') return toast.error(`Cannot Apply: Voucher is ${voucher.status.toUpperCase()}.`)

      const today = new Date();
      today.setHours(0,0,0,0);

      if (voucher.valid_from) {
        const validFromDate = new Date(voucher.valid_from);
        validFromDate.setHours(0,0,0,0);
        
        if (today < validFromDate) {
           return toast.error("Voucher Not Active", { 
             description: `This is a Birthday Voucher. It will become valid on ${format(validFromDate, 'dd MMM yyyy')}.` 
           });
        }
      }

      if (voucher.expiry_date) {
        const expiryDate = new Date(voucher.expiry_date)
        expiryDate.setHours(0,0,0,0);
        if (today > expiryDate) return toast.error(`Expired: This voucher expired on ${expiryDate.toLocaleDateString()}.`)
      }

      if (voucher.customer_id && voucher.customers) {
        const rawCust = Array.isArray(voucher.customers) ? voucher.customers[0] : voucher.customers;
        if (selectedCustomer && selectedCustomer.id !== voucher.customer_id) {
          return toast.error(`Fraud Alert: Voucher registered to ${rawCust.full_name}.`)
        }
      }

      await supabase
        .from('vouchers')
        .update({ 
           last_scanned_at: new Date().toISOString(),
           scan_count: (voucher.scan_count || 0) + 1 
        })
        .eq('id', voucher.id);

      setActiveVoucher({ 
        id: voucher.id, 
        code: voucher.code, 
        amount: voucher.discount_value, 
        handling_fee: voucher.handling_fee,
        is_birthday_redemption: voucher.is_birthday_redemption
      })

      setHandlingFee(voucher.handling_fee?.toString() || '0') 
      setVoucherCode('')
      toast.success(`Voucher Validated & Applied!`)
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

    let printCgst = cgstAmount;
    let printSgst = sgstAmount;
    let printRoundOff = roundOffAmount;
    let printFinalTotal = finalPayableGross; 
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
      date: effectiveDate,
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
      kittyPlanId: appliedKittyPlanId,
      appliedCredit: appliedCreditAmount,
      
      estimateChargeType, 
      estimateHandlingPct: estimateHandlingPercent,
      estimateHandlingAmt: printEstimateHandlingAmt,
      
      finalTotal: mode === 'custom' ? (Number(customOrderDetails?.advance_paid) || 0) 
                : mode === 'repair' ? (Number(repairDetails?.advancePaid) || 0) 
                : mode === 'return' ? (Number(returnDetails?.calculatedRefund) || 0) 
                : isEstimate && mode === 'normal' ? printFinalTotal 
                : finalPayableGross, 
      paymentMode: formattedPaymentMode
    }
  }

  const executeCheckout = async (isEstimate = false, customTransactionContext?: any) => {
    setIsProcessing(true)
    let finalNo = ''
    try {
      
      const effectiveKittyAmt = customTransactionContext?.applied_kitty || customTransactionContext?.appliedKitty || appliedKittyAmount;
      const effectiveKittyPlanId = customTransactionContext?.kitty_plan_id || customTransactionContext?.kittyPlanId || appliedKittyPlanId;
      const effectiveCreditAmt = customTransactionContext?.applied_credit || customTransactionContext?.appliedCredit || appliedCreditAmount;

      if (customTransactionContext) {
         if (effectiveKittyAmt) setAppliedKittyAmount(effectiveKittyAmt);
         if (effectiveCreditAmt) setAppliedCreditAmount(effectiveCreditAmt);
      }

      const requiredTotal = mode === 'custom' ? (Number(customOrderDetails?.advance_paid) || 0) 
                          : mode === 'repair' ? (Number(repairDetails?.advancePaid) || 0) 
                          : mode === 'return' ? (Number(returnDetails?.calculatedRefund) || 0) 
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
        
        let dbPaymentMode = paymentMode;
        let dbSplitPayments: any = paymentMode === 'split' ? { ...splitPayments } : null;

        if (effectiveKittyAmt > 0 || effectiveCreditAmt > 0) {
            if (requiredTotal === 0) {
                if (effectiveKittyAmt > 0 && effectiveCreditAmt === 0) dbPaymentMode = 'Kitty';
                else if (effectiveCreditAmt > 0 && effectiveKittyAmt === 0) dbPaymentMode = 'Wallet';
                else dbPaymentMode = 'Kitty + Wallet';
            } else {
                dbPaymentMode = 'Split / Combined';
                if (paymentMode !== 'split') {
                    dbSplitPayments = {};
                    dbSplitPayments[paymentMode] = requiredTotal;
                }
                if (effectiveKittyAmt > 0) dbSplitPayments['kitty'] = effectiveKittyAmt;
                if (effectiveCreditAmt > 0) dbSplitPayments['wallet'] = effectiveCreditAmt;
            }
        }

        const preTaxDeductions = standardDiscount + exchangeNum + appliedVoucherAmount;

        // 1. Build the base payload WITHOUT the exchange details keys
        const invoiceData: any = {
          created_at: effectiveDateISO,
          customer_id: selectedCustomer?.id, 
          warehouse_id: selectedLocation,
          items: cart.map((item) => ({ item_id: item.id, rate: item.mrp })),
          
          subtotal: subtotal, 
          discount_amount: standardDiscount, 
          discounted_total: Math.max(0, subtotal - preTaxDeductions),
          taxable_value: finalTaxableValue,
          cgst_amount: cgstAmount, 
          sgst_amount: sgstAmount, 
          round_off_amount: roundOffAmount,
          final_total: finalPayableGross, 
          advance_adjusted: cartAdvance, 
          
          voucher_code: activeVoucher?.code || null,
          voucher_discount: appliedVoucherAmount, 
          Voucher_handling_fee: handlingAmt,
          exchange_value: exchangeNum || 0, // Ensure strictly 0
          
          kitty_payment: effectiveKittyAmt, 
          wallet_payment: effectiveCreditAmt,
          
          payment_mode: dbPaymentMode,
          split_payments: dbSplitPayments,
          
          transaction_reference: customTransactionContext?.transaction_reference || null,
          payment_remarks: customTransactionContext?.payment_remarks || null,
          billing_remarks: customTransactionContext?.billing_remarks || null,
          target_bank_account_id: customTransactionContext?.target_bank_account_id || null,
          transfer_type: customTransactionContext?.transfer_type || null
        };
        
        // ✨ THE STRICT GATEKEEPER ✨
        // 2. ONLY attach these keys to the payload if a real exchange occurred!
        // This makes it completely invisible to the database RPC otherwise.
        if (exchangeNum > 0 && exchangePhysicalDetails) {
           invoiceData.exchange_notes = exchangeNotes;
           invoiceData.exchange_physical_details = exchangePhysicalDetails;
        }

        const { data, error } = await callRpc('pos_confirm_sale', { p_invoice_json: invoiceData, p_user_id: appUser?.user_id })
        
        finalNo = data?.invoice_number || `INV-${Date.now().toString().slice(-6)}`
        
        if (activeVoucher) {
          await supabase.from('vouchers').update({ 
            status: 'redeemed', 
            redeemed_at: new Date().toISOString() 
          }).eq('id', activeVoucher.id)
        }
        
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

            if (effectiveCreditAmt > 0) {
                const fullRawCreditDeducted = Number(effectiveCreditAmt) / 0.80; 
                updatePayload.store_credit_balance = Math.max(0, (selectedCustomer.store_credit_balance || 0) - fullRawCreditDeducted);
                shouldUpdateCustomer = true;
            }
            
            if (effectiveKittyAmt > 0 && effectiveKittyPlanId) {
              await supabase.from('kitty_plans').update({
                  status: 'redeemed',
                  redeemed_at: new Date().toISOString()
              }).eq('id', effectiveKittyPlanId);
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
          created_at: effectiveDateISO,
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
        
        // 1. Insert the Buyback Ledger Entry
        const { data: buybackData, error: buybackErr } = await supabase.from('buybacks').insert({
          created_at: effectiveDateISO, 
          company_id: appUser?.company_id,
          reference_invoice_number: returnDetails.invoiceNo || null,
          customer_id: selectedCustomer?.id,
          warehouse_id: selectedLocation,
          
          is_external_item: returnDetails.physicalDetails?.is_external_item || false,
          item_category: returnDetails.physicalDetails?.item_category || null,
          metal_type: returnDetails.physicalDetails?.metal_type || null,
          purity_karat: returnDetails.physicalDetails?.purity_karat || null,
          purity_percent: returnDetails.physicalDetails?.purity_percent || null,
          gross_weight_g: returnDetails.physicalDetails?.gross_weight_g || 0,
          net_weight_g: returnDetails.physicalDetails?.net_weight_g || 0,
          total_stone_weight_cts: returnDetails.physicalDetails?.total_stone_weight_cts || 0,
          diamond_shape: returnDetails.physicalDetails?.diamond_shape || null,
          diamond_color: returnDetails.physicalDetails?.diamond_color || null,
          diamond_clarity: returnDetails.physicalDetails?.diamond_clarity || null,
          
          gross_value: Number(returnDetails.articleCost) || 0,
          deduction_amount: Number(returnDetails.discountApplied) || 0,
          buyback_percent: Number(returnDetails.returnPercent) || 100,
          net_refund: Number(returnDetails.calculatedRefund) || 0,
          
          status: 'received',
          created_by: appUser?.user_id
        }).select('id').single()
        
        if (buybackErr) throw buybackErr

       const uniqueRef = `RTN-${Date.now().toString().slice(-6)}`;
        
       const grossWt = Number(returnDetails.physicalDetails?.gross_weight_g) || 0.001;
       const netWt = Number(returnDetails.physicalDetails?.net_weight_g) || grossWt;

       const { error: invError } = await supabase.from('inventory_items').insert({
         company_id: appUser?.company_id,
         warehouse_id: selectedLocation,
         sku: uniqueRef,
         barcode: uniqueRef,
         item_category: returnDetails.physicalDetails?.item_category || 'Old Gold',
         metal_type: returnDetails.physicalDetails?.metal_type || 'Gold',
         
         purity_karat: returnDetails.physicalDetails?.purity_karat || '22K', 
         purity_percent: returnDetails.physicalDetails?.purity_percent || 91.60, 
         
         gross_weight_g: grossWt,
         net_weight_g: netWt,
         
         acquisition_method: 'buyback',
         is_for_sale: false, 
         status: 'in_vault', 
         source_buyback_id: buybackData.id, 
         cost_price: Number(returnDetails.calculatedRefund) || 0 
       })
       
       if (invError) throw invError
        
        toast.success("Buyback processed & Item added to Vault!")
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
          created_at: effectiveDateISO, 
          company_id: appUser?.company_id,
          origin_warehouse_id: selectedLocation, 
          customer_id: selectedCustomer.id,
          order_number: finalNo,
          design_reference: customOrderDetails.design_reference,

          item_category: customOrderDetails.item_category,
          expected_gold_g: Number(customOrderDetails.expected_gold_g) || null,
          expected_diamond_cts: Number(customOrderDetails.expected_diamond_cts) || null,
          estimated_value: Number(customOrderDetails.estimated_value) || 0,
          advance_paid: (Number(customOrderDetails.advance_paid) || 0) + appliedVoucherAmount,
          
          status: 'pending_manufacturing' 
        }
        const { error } = await supabase.from('custom_orders').insert(payload)
        if (error) throw error
        toast.success(`Custom Order ${finalNo} submitted to manufacturing!`)
      }

      const finalDraftData = generateDraftData(isEstimate);
      finalDraftData.invoice_number = finalNo;
      
      if (customTransactionContext) {
          finalDraftData.appliedKitty = effectiveKittyAmt;
          finalDraftData.appliedCredit = effectiveCreditAmt;
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
    setAppliedKittyAmount(0); setAppliedKittyPlanId(null); setAppliedCreditAmount(0); 
    setSplitPayments({ cash: '', card: '', upi: '', bank: '', cheque: '' });
  }

  return {
    paymentMode, setPaymentMode, isProcessing, splitPayments, setSplitPayments, currentSplitTotal,
    discountType, setDiscountType, discountValue, setDiscountValue,
    voucherCode, setVoucherCode, activeVoucher, setActiveVoucher, handlingFee,
    isExchangeOpen, setIsExchangeOpen, exchangeInvoiceNo, setExchangeInvoiceNo, exchangeValue, setExchangeValue, exchangeNotes, setExchangeNotes,
    discountAmount: standardDiscount, appliedVoucherAmount, handlingAmt, finalTaxableValue, cgstAmount, sgstAmount, exactFinalPayable, roundOffAmount, 
    setExchangePhysicalDetails,
    finalPayable: finalPayableNet, 
    
    appliedKittyAmount, setAppliedKittyAmount,appliedKittyPlanId, setAppliedKittyPlanId, appliedCreditAmount, setAppliedCreditAmount,
    estimateChargeType, setEstimateChargeType, estimateHandlingPercent, setEstimateHandlingPercent, 

    handleApplyVoucher, handleFetchExchangeItem, generateDraftData, executeCheckout, resetCheckoutState
  }
}