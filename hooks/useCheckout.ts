import { useState, useEffect } from 'react'
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
  billedBy?: string; 
  selectedPackaging?: any[]; 
  autoLoyaltyRules?: any[]; 
  loyaltySettings?: any;
}

export function useCheckout({ 
  appUser, selectedLocation, cart, subtotal, mode, selectedCustomer, customOrderDetails, repairDetails, returnDetails, allBranches, callRpc, customBillingDate, billedBy, 
  selectedPackaging = [], autoLoyaltyRules = [], loyaltySettings
}: CheckoutConfig) {
  
  const [paymentMode, setPaymentMode] = useState('cash') 
  const [splitPayments, setSplitPayments] = useState({ cash: '', card: '', upi: '', bank: '', cheque: '' })
  const [isProcessing, setIsProcessing] = useState(false)

  const [billingRemarks, setBillingRemarks] = useState('')
  const [paymentRemarks, setPaymentRemarks] = useState('')

  const [estimateChargeType, setEstimateChargeType] = useState<'tax' | 'handling' | 'none'>('tax')
  const [estimateHandlingPercent, setEstimateHandlingPercent] = useState<string>('3')

  const [appliedKittyAmount, setAppliedKittyAmount] = useState(0)
  const [appliedKittyPlanId, setAppliedKittyPlanId] = useState<string | null>(null)
  const [appliedCreditAmount, setAppliedCreditAmount] = useState(0)
  
  const [appliedPointsAmount, setAppliedPointsAmount] = useState(0)
  const [rawPointsRedeemed, setRawPointsRedeemed] = useState(0)
  
  // ✨ Referral Engine State
  const [referralInput, setReferralInput] = useState('')
  const [activeReferral, setActiveReferral] = useState<{ referrer_id: string, code_or_phone: string, loyalty_account_id?: string, referrer_name?: string } | null>(null)
  
  const currentSplitTotal = 
    (parseFloat(splitPayments.cash) || 0) + 
    (parseFloat(splitPayments.card) || 0) + 
    (parseFloat(splitPayments.upi) || 0) + 
    (parseFloat(splitPayments.bank) || 0) +
    (parseFloat(splitPayments.cheque) || 0)
  
  const [discountType, setDiscountType] = useState<'percent' | 'flat'>('percent')
  const [discountValue, setDiscountValue] = useState<string>('')
  
  const [voucherCode, setVoucherCode] = useState('')
  const [activeVoucher, setActiveVoucher] = useState<{ id: string, code: string, amount: number, handling_fee: number, is_birthday_redemption?: boolean } | null>(null)
  const [handlingFee, setHandlingFee] = useState<string>('0')

  const [isExchangeOpen, setIsExchangeOpen] = useState(false)
  const [exchangeInvoiceNo, setExchangeInvoiceNo] = useState<string>('')
  const [exchangeValue, setExchangeValue] = useState<string>('')
  const [exchangeNotes, setExchangeNotes] = useState<string>('')
  const [exchangePhysicalDetails, setExchangePhysicalDetails] = useState<any>(null)


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

  const discountNum = parseFloat(discountValue) || 0
  const standardDiscount = discountType === 'percent' ? (subtotal * discountNum) / 100 : discountNum
  const hasVoucher = activeVoucher !== null

  if (hasVoucher && (appliedKittyAmount > 0 || appliedCreditAmount > 0 || appliedPointsAmount > 0 || activeReferral)) {
     setAppliedKittyAmount(0);
     setAppliedCreditAmount(0);
     setAppliedPointsAmount(0);
     setRawPointsRedeemed(0);
     setActiveReferral(null);
     toast.warning("Clubbing Restricted", { description: "Vouchers cannot be combined with Wallet, Loyalty, or Referrals." });
  }

  const cartAdvance = cart?.reduce((sum: number, item: any) => sum + (Number(item.advance_paid) || 0), 0) || 0;
  
  let effectiveSubtotal = subtotal;
  if (mode === 'custom') {
      effectiveSubtotal = Number(customOrderDetails?.estimated_value) || 0;
  }

  const exchangeNum = parseFloat(exchangeValue) || 0;
  let baseTaxable = Math.max(0, effectiveSubtotal - standardDiscount - exchangeNum);
  const handlingAmt = parseFloat(handlingFee) || 0; 

  let appliedVoucherAmount = 0
  let finalVoucherCode = ''
  let finalHandlingFee = handlingAmt

  if (activeVoucher) {
      const vAmount = activeVoucher.amount;
      const hFee = activeVoucher.handling_fee || 0;
      if (baseTaxable >= vAmount) {
          appliedVoucherAmount = vAmount - hFee;
      } else {
          appliedVoucherAmount = baseTaxable > hFee ? baseTaxable - hFee : 0; 
      }
      finalVoucherCode = activeVoucher.code
  } else if (mode === 'normal' && cart.some(item => item.voucher_discount_locked > 0)) {
      const lockedDiscount = cart.reduce((sum, item) => sum + (Number(item.voucher_discount_locked) || 0), 0);
      appliedVoucherAmount = lockedDiscount;
      finalVoucherCode = 'ORD-VOUCHER';
      finalHandlingFee = 0; 
  }

  // ✨ PRE-TAX MATH: Deduct Referral (10%) and Loyalty Points BEFORE tax is calculated
  const referralDiscountAmount = activeReferral ? Math.floor(baseTaxable * 0.10) : 0;
  
  const finalTaxableValue = Math.max(0, baseTaxable - appliedVoucherAmount - referralDiscountAmount - appliedPointsAmount);

  const cgstAmount = parseFloat((finalTaxableValue * 0.015).toFixed(2))
  const sgstAmount = parseFloat((finalTaxableValue * 0.015).toFixed(2))
  
  const exactFinalPayable = finalTaxableValue + cgstAmount + sgstAmount
  const finalPayableGross = Math.round(exactFinalPayable)
  const roundOffAmount = parseFloat((finalPayableGross - exactFinalPayable).toFixed(2))

  const finalPayableNet = Math.max(0, finalPayableGross - cartAdvance - appliedKittyAmount - appliedCreditAmount);

  // ==============================================================
  // ✨ WHATSAPP MESSAGING ENGINE
  // ==============================================================
  const sendWhatsAppNotification = async (
    phone: string, 
    name: string, 
    templateName: string, 
    mappingString: string, 
    specificContext: { points_awarded: number, total_balance: number, activity_name: string }
  ) => {
    if (!loyaltySettings?.is_wa_enabled || !templateName || !phone) return;

    let formattedPhone = phone.replace(/\D/g, '');
    if (formattedPhone.length === 10) formattedPhone = '91' + formattedPhone;

    try {
      try {
        await fetch("/api/whatsapp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "subscriber.createByPhone",
            payload: { phone: formattedPhone, name: name || "Pavitram Customer" }
          })
        });
      } catch (e) {
        console.warn("Subscriber auto-resolve skipped:", e);
      }

      const baseContext = {
        customer_name: name || 'Customer',
        customer_phone: formattedPhone,
        total_balance: specificContext.total_balance,
        activity_name: specificContext.activity_name,
        points_awarded: specificContext.points_awarded,
        points_redeemed: 0,
      };

      const mappedParams = mappingString
        ? mappingString.split(',').map(v => baseContext[v.trim() as keyof typeof baseContext]?.toString() || "0")
        : [];

      await fetch("/api/whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "message.sendDirect",
          payload: {
            user_id: formattedPhone,
            template_name: templateName,
            lang: "en",
            namespace: "bfbb14c4_778e_453b_97c2_92f60bb9e978", 
            parameters: mappedParams
          }
        })
      });
    } catch (error) {
      console.error("WhatsApp trigger failed", error);
    }
  };

  // ✨ Validates and Applies 10% Referral Discount
  // ✨ Validates and Applies 10% Referral Discount
  const handleApplyReferral = async () => {
    const input = referralInput.trim();
    if (!input) return toast.error("Please enter a Referral Code or Phone Number.");
    if (appliedKittyAmount > 0 || appliedCreditAmount > 0 || appliedVoucherAmount > 0) {
      return toast.error("Cannot club Referral Discounts with Vouchers, Kitty, or Wallet.");
    }
    if (!selectedCustomer) return toast.error("Select a customer first.");

    try {
      let account = null;
      let referrer = null;

      // 1. First, try searching by exact Referral Code
      const { data: codeData } = await supabase
        .from('loyalty_accounts')
        .select(`id, referral_code, customer_id, customers!inner(id, full_name, phone)`)
        .ilike('referral_code', input)
        .maybeSingle();

      if (codeData) {
        account = codeData;
        referrer = Array.isArray(codeData.customers) ? codeData.customers[0] : codeData.customers;
      } else {
        // 2. If no code matches, try searching by Phone Number
        const cleanPhone = input.replace(/\D/g, '');
        if (cleanPhone.length >= 4) { // Prevent empty searches
          const { data: phoneData } = await supabase
            .from('loyalty_accounts')
            .select(`id, referral_code, customer_id, customers!inner(id, full_name, phone)`)
            .ilike('customers.phone', `%${cleanPhone}%`)
            .limit(1);

          if (phoneData && phoneData.length > 0) {
            account = phoneData[0];
            referrer = Array.isArray(phoneData[0].customers) ? phoneData[0].customers[0] : phoneData[0].customers;
          }
        }
      }

      // If both checks failed, throw the error
      if (!account || !referrer) {
        return toast.error("Invalid Referral Code or Phone Number.");
      }

      // Prevent self-referrals
      if (referrer.id === selectedCustomer.id) {
        return toast.error("You cannot refer yourself.");
      }

      // Success! Set the state
      setActiveReferral({
        referrer_id: referrer.id,
        code_or_phone: account.referral_code || referrer.phone,
        loyalty_account_id: account.id,
        referrer_name: referrer.full_name
      });
      
      setReferralInput('');
      toast.success(`Referral Applied! 10% Discount from ${referrer.full_name}`);
    } catch (err) {
      toast.error("Failed to apply referral.");
    }
  };


  const handleApplyVoucher = async (overrideCode?: string) => {
    const validOverride = typeof overrideCode === 'string' ? overrideCode : undefined;
    
    if (appliedKittyAmount > 0 || appliedCreditAmount > 0 || appliedPointsAmount > 0 || activeReferral) {
      return toast.error("Clubbing Error", { description: "Cannot apply vouchers when Wallet, Kitty, Loyalty, or Referrals are in use." });
    }

    if (!validOverride && !voucherCode.trim()) return;
    
    let codeToSearch = validOverride || voucherCode.trim();
    
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
           scan_count: (voucher.scan_count || 0) + 1 ,
           last_scanned_warehouse_id: selectedLocation,
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
      
      subtotal: effectiveSubtotal, 
      
      discountAmount: standardDiscount, 
      voucherAmount: appliedVoucherAmount, 
      handlingFee: finalHandlingFee, 
      taxableValue: finalTaxableValue, 
      cgstAmount: printCgst, 
      sgstAmount: printSgst, 
      exactFinalPayable, 
      roundOffAmount: printRoundOff, 
      exchangeValue: exchangeNum, 
      
      appliedKitty: appliedKittyAmount,
      kittyPlanId: appliedKittyPlanId,
      appliedCredit: appliedCreditAmount,
      appliedPoints: appliedPointsAmount, 
      rawPointsRedeemed: rawPointsRedeemed, 
      referralDiscount: referralDiscountAmount,
      
      estimateChargeType, 
      estimateHandlingPct: estimateHandlingPercent,
      estimateHandlingAmt: printEstimateHandlingAmt,
      
      finalTotal: mode === 'custom' ? finalPayableGross 
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
      
      const finalizingUserId = billedBy || appUser?.user_id || appUser?.id;

      const effectiveKittyAmt = customTransactionContext?.applied_kitty || customTransactionContext?.appliedKitty || appliedKittyAmount;
      const effectiveKittyPlanId = customTransactionContext?.kitty_plan_id || customTransactionContext?.kittyPlanId || appliedKittyPlanId;
      const effectiveCreditAmt = customTransactionContext?.applied_credit || customTransactionContext?.appliedCredit || appliedCreditAmount;
      const effectivePointsAmt = customTransactionContext?.applied_points || customTransactionContext?.appliedPoints || appliedPointsAmount;
      const effectiveRawPoints = customTransactionContext?.raw_points_redeemed || customTransactionContext?.rawPointsRedeemed || rawPointsRedeemed;

      if (customTransactionContext) {
         if (effectiveKittyAmt) setAppliedKittyAmount(effectiveKittyAmt);
         if (effectiveCreditAmt) setAppliedCreditAmount(effectiveCreditAmt);
         if (effectivePointsAmt) setAppliedPointsAmount(effectivePointsAmt);
      }

      const requiredTotal = mode === 'custom' ? (Number(customOrderDetails?.advance_paid) || 0) 
                          : mode === 'repair' ? (Number(repairDetails?.advancePaid) || 0) 
                          : mode === 'return' ? (Number(returnDetails?.calculatedRefund) || 0) 
                          : finalPayableNet; 

      if (paymentMode === 'split' && Math.abs(currentSplitTotal - requiredTotal) > 0.1) {
        toast.error(`Split total must match ₹${requiredTotal.toLocaleString()}`);
        setIsProcessing(false); return { success: false };
      }

      const finalDraftData = generateDraftData(isEstimate);

      if (isEstimate) {
        finalNo = `EST-${Date.now().toString().slice(-6)}`
        finalDraftData.invoice_number = finalNo; 

        const { data: estData, error: estError } = await supabase.from('estimates').insert({
          company_id: appUser?.company_id,
          warehouse_id: selectedLocation,
          customer_id: selectedCustomer?.id || null,
          estimate_number: finalNo,
          subtotal: finalDraftData.subtotal,
          discount_amount: finalDraftData.discountAmount + finalDraftData.voucherAmount + finalDraftData.exchangeValue,
          handling_charge: finalDraftData.estimateHandlingAmt > 0 ? finalDraftData.estimateHandlingAmt : finalDraftData.handlingFee,
          cgst: finalDraftData.cgstAmount,
          sgst: finalDraftData.sgstAmount,
          round_off: finalDraftData.roundOffAmount,
          total_amount: finalDraftData.finalTotal,
          remarks: customTransactionContext?.billing_remarks || customTransactionContext?.payment_remarks || null,
          created_by: finalizingUserId 
        }).select('id').single();

        if (estError) throw new Error("Failed to save estimate: " + estError.message);

        if (cart && cart.length > 0 && mode === 'normal') {
           const estItems = cart.map((item: any) => ({
                estimate_id: estData.id,
                inventory_id: item.id,
                mrp: item.mrp || 0
           }));
           const { error: estItemsError } = await supabase.from('estimate_items').insert(estItems);
           if (estItemsError) throw new Error("Failed to log estimate items: " + estItemsError.message);
        }

        toast.success("Estimate generated and securely logged.");
      } 
      else if (mode === 'normal' || mode === 'custom') {
        let dbPaymentMode = paymentMode;
        let dbSplitPayments: any = paymentMode === 'split' ? { ...splitPayments } : null;

        if (effectiveKittyAmt > 0 || effectiveCreditAmt > 0 || effectivePointsAmt > 0) {
            if (requiredTotal === 0) {
                dbPaymentMode = 'Wallet / Loyalty';
            } else {
                dbPaymentMode = 'Split / Combined';
                if (paymentMode !== 'split') {
                    dbSplitPayments = {};
                    dbSplitPayments[paymentMode] = requiredTotal;
                }
                if (effectiveKittyAmt > 0) dbSplitPayments['kitty'] = effectiveKittyAmt;
                if (effectiveCreditAmt > 0) dbSplitPayments['wallet'] = effectiveCreditAmt;
                if (effectivePointsAmt > 0) dbSplitPayments['loyalty_points'] = effectivePointsAmt;
            }
        }

        if (mode === 'normal') {
            const preTaxDeductions = standardDiscount + exchangeNum + appliedVoucherAmount + effectivePointsAmt + referralDiscountAmount;
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
              voucher_code: finalVoucherCode || null,
              voucher_discount: appliedVoucherAmount, 
              Voucher_handling_fee: finalHandlingFee,
              exchange_value: exchangeNum || 0, 
              kitty_payment: effectiveKittyAmt, 
              wallet_payment: effectiveCreditAmt,
              payment_mode: dbPaymentMode,
              split_payments: dbSplitPayments,
              transaction_reference: customTransactionContext?.transaction_reference || null,
              payment_remarks: customTransactionContext?.payment_remarks || null,
              billing_remarks: customTransactionContext?.billing_remarks || null,
              target_bank_account_id: customTransactionContext?.target_bank_account_id || null,
              transfer_type: customTransactionContext?.transfer_type || null,
              referral_code_used: activeReferral ? activeReferral.code_or_phone : null,
              referral_discount_amount: referralDiscountAmount
            };
            
            if (exchangeNum > 0 && exchangePhysicalDetails) {
              invoiceData.exchange_notes = exchangeNotes;
              invoiceData.exchange_physical_details = exchangePhysicalDetails;
            }

            const { data, error } = await callRpc('pos_confirm_sale', { 
              p_invoice_json: invoiceData, 
              p_user_id: finalizingUserId 
            })
            finalNo = data?.invoice_number || `INV-${Date.now().toString().slice(-6)}`
            toast.success("Tax Invoice Generated!")
        } 
        else if (mode === 'custom') {
            if (!selectedCustomer) throw new Error("Please select a customer for this Custom Order.")
            finalNo = `ORD-${Date.now().toString().slice(-6)}`
            const customCashAdvance = Number(customOrderDetails.advance_paid) || 0;
            const totalRealizedAdvance = customCashAdvance + effectiveKittyAmt + effectiveCreditAmt + effectivePointsAmt;
            const baseEstimate = Number(customOrderDetails.estimated_value) || 0;

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
              base_estimated_value: baseEstimate,
              discount_amount: standardDiscount,
              taxable_value: finalTaxableValue,
              cgst_amount: cgstAmount,
              sgst_amount: sgstAmount,
              estimated_value: finalPayableGross, 
              advance_paid: totalRealizedAdvance, 
              voucher_code: finalVoucherCode || null,
              voucher_amount: appliedVoucherAmount,
              status: 'pending_manufacturing',
              created_by: finalizingUserId 
            }
            const { error } = await supabase.from('custom_orders').insert(payload)
            if (error) throw error
            toast.success(`Custom Order ${finalNo} submitted to manufacturing!`)
        }
        
        // ==========================================
        // ✨ POST-SALE REDEMPTIONS & REWARDS
        // ==========================================
        if (activeVoucher) {
          await supabase.from('vouchers').update({ status: 'redeemed', redeemed_at: new Date().toISOString() }).eq('id', activeVoucher.id)
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

            // 💎 1. DEDUCT REDEEMED POINTS
            let purchaserLoyaltyId = null;
            if (effectiveRawPoints > 0) {
              const { data: purchaserAcc } = await supabase.from('loyalty_accounts').select('id').eq('customer_id', selectedCustomer.id).maybeSingle();
              if (purchaserAcc) {
                purchaserLoyaltyId = purchaserAcc.id;
                await supabase.from('loyalty_transactions').insert({
                  account_id: purchaserAcc.id,
                  activity_category: 'Redemption',
                  activity_name: 'POS Billing Redemption',
                  points_redeemed: effectiveRawPoints,
                  status: 'approved',
                  recorded_by: finalizingUserId
                });
              }
            }

            // 💎 2. AWARD REPEAT PURCHASE POINTS
            if (autoLoyaltyRules && autoLoyaltyRules.length > 0) {
              
              const repeatRule = autoLoyaltyRules.find(r => r.name.toLowerCase().includes('repeat'));
              const { data: purchaserAcc } = await supabase.from('loyalty_accounts').select('id').eq('customer_id', selectedCustomer.id).maybeSingle();
              
              if (repeatRule && purchaserAcc) {
                const pointsToAward = repeatRule.is_dynamic ? Math.floor(finalTaxableValue * 0.05) : repeatRule.points;
                if (pointsToAward > 0) {
                  await supabase.from('loyalty_transactions').insert({
                    account_id: purchaserAcc.id,
                    activity_category: repeatRule.category,
                    activity_name: repeatRule.name,
                    points_awarded: pointsToAward,
                    status: 'approved',
                    recorded_by: finalizingUserId
                  });

                  const { data: finalAcc } = await supabase.from('loyalty_accounts').select('total_points').eq('id', purchaserAcc.id).single();

                  await sendWhatsAppNotification(
                    selectedCustomer.phone,
                    selectedCustomer.full_name,
                    loyaltySettings?.wa_template_points_earned, 
                    loyaltySettings?.wa_mapping_points_earned, 
                    { points_awarded: pointsToAward, total_balance: finalAcc?.total_points || 0, activity_name: repeatRule.name }
                  );
                }
              }

              // ✨ 3. AWARD REFERRER (5% OF FINAL TAXABLE VALUE)
              
              if (activeReferral && activeReferral.loyalty_account_id) {
                const referRule = autoLoyaltyRules.find(r => r.name.toLowerCase().includes('refer'));
                if (referRule) {
                   const pointsToAward = referRule.is_dynamic ? Math.floor(finalTaxableValue * 0.05) : referRule.points;
                   if (pointsToAward > 0) {
                     await supabase.from('loyalty_transactions').insert({
                       account_id: activeReferral.loyalty_account_id, activity_category: referRule.category, activity_name: "Friend Referral Bonus", points_awarded: pointsToAward, status: 'approved', recorded_by: finalizingUserId
                     });
                     
                     const { data: finalRefAcc } = await supabase.from('loyalty_accounts')
                       .select('total_points, customers!inner(phone, full_name)')
                       .eq('id', activeReferral.loyalty_account_id)
                       .single();
                     
                     // ✨ TS FIX: Added null check here
                     if (finalRefAcc && finalRefAcc.customers) {
                       const refCust = Array.isArray(finalRefAcc.customers) ? finalRefAcc.customers[0] : finalRefAcc.customers;
                       
                       await sendWhatsAppNotification(
                         refCust.phone, 
                         refCust.full_name, 
                         loyaltySettings?.wa_template_points_earned, 
                         loyaltySettings?.wa_mapping_points_earned, 
                         { points_awarded: pointsToAward, total_balance: finalRefAcc.total_points || 0, activity_name: "Friend Referral Bonus" }
                       );
                     }
                   }
                }
             }
            }
        }
      }
      // Note: If you need specialized DB handling for 'repair' or 'return' or 'challan' modes, insert those Supabase calls here.

      finalDraftData.invoice_number = finalNo;
      
      if (customTransactionContext) {
          finalDraftData.appliedKitty = effectiveKittyAmt;
          finalDraftData.appliedCredit = effectiveCreditAmt;
          finalDraftData.appliedPoints = effectivePointsAmt;
      }

      if (!isEstimate && selectedPackaging?.length > 0 && (mode === 'normal' || mode === 'custom')) {
        
        const safeWarehouseId = selectedLocation === 'ALL' ? null : selectedLocation;

        for (const pkg of selectedPackaging) {
          const { error: packErr } = await supabase.rpc('decrement_packaging_stock', {
            p_id: pkg.id,
            p_qty: Number(pkg.quantity),
            p_company_id: appUser?.company_id || null,         
            p_warehouse_id: safeWarehouseId,                   
            p_transaction_type: mode === 'custom' ? 'custom_order' : 'normal_sale',
            p_reference_id: finalNo,                   
            p_customer_id: selectedCustomer?.id || null,       
            p_user_id: finalizingUserId || null                
          });

          if (packErr) {
            console.error("Packaging deduction failed:", packErr);
          }
        }
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
    setAppliedPointsAmount(0); setRawPointsRedeemed(0); setReferralInput(''); setActiveReferral(null);
    setSplitPayments({ cash: '', card: '', upi: '', bank: '', cheque: '' });
    setBillingRemarks(''); setPaymentRemarks(''); 
  }

  return {
    paymentMode, setPaymentMode, isProcessing, splitPayments, setSplitPayments, currentSplitTotal,
    discountType, setDiscountType, discountValue, setDiscountValue,
    voucherCode, setVoucherCode, activeVoucher, setActiveVoucher, handlingFee,
    isExchangeOpen, setIsExchangeOpen, exchangeInvoiceNo, setExchangeInvoiceNo, exchangeValue, setExchangeValue, exchangeNotes, setExchangeNotes,
    
    // ✨ Referral Exports
    referralInput, setReferralInput, activeReferral, setActiveReferral, handleApplyReferral, referralDiscountAmount,

    discountAmount: standardDiscount, appliedVoucherAmount, handlingAmt, finalTaxableValue, cgstAmount, sgstAmount, exactFinalPayable, roundOffAmount, 
    setExchangePhysicalDetails,
    finalPayable: finalPayableNet, 
    
    appliedKittyAmount, setAppliedKittyAmount,appliedKittyPlanId, setAppliedKittyPlanId, appliedCreditAmount, setAppliedCreditAmount,
    appliedPointsAmount, setAppliedPointsAmount, rawPointsRedeemed, setRawPointsRedeemed,
    estimateChargeType, setEstimateChargeType, estimateHandlingPercent, setEstimateHandlingPercent, 

    handleApplyVoucher, handleFetchExchangeItem, generateDraftData, executeCheckout, resetCheckoutState
  }
}