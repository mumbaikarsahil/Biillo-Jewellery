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
  const [splitPayments, setSplitPayments] = useState({ cash: '', card: '', upi: '', bank: '' })
  const [isProcessing, setIsProcessing] = useState(false)
  
  const currentSplitTotal = 
    (parseFloat(splitPayments.cash) || 0) + 
    (parseFloat(splitPayments.card) || 0) + 
    (parseFloat(splitPayments.upi) || 0) + 
    (parseFloat(splitPayments.bank) || 0)
  
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

  // --- Math Engine ---
  const discountNum = parseFloat(discountValue) || 0
  const discountAmount = discountType === 'percent' ? (subtotal * discountNum) / 100 : discountNum
  
  let baseTaxable = Math.max(0, subtotal - discountAmount)
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

  const cgstAmount = parseFloat((finalTaxableValue * 0.015).toFixed(2))
  const sgstAmount = parseFloat((finalTaxableValue * 0.015).toFixed(2))
  const exactFinalPayable = finalTaxableValue + cgstAmount + sgstAmount
  const finalPayable = Math.round(exactFinalPayable)
  const roundOffAmount = parseFloat((finalPayable - exactFinalPayable).toFixed(2))

  // --- Actions ---
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

  const handleFetchExchangeItem = async () => {
    if (!exchangeInvoiceNo.trim() || !appUser) return toast.error('Enter an invoice number.')
    try {
      const { data: invoiceData, error: invErr } = await supabase.from('invoices')
        .select('id, invoice_number, subtotal').ilike('invoice_number', exchangeInvoiceNo.trim()).eq('company_id', appUser.company_id).maybeSingle()
      if (invErr) throw invErr
      if (!invoiceData) return toast.error('Invoice not found.')
      setExchangeValue((invoiceData.subtotal || 0).toString())
      setExchangeNotes(`EXCHANGE (100% MRP): INV [${invoiceData.invoice_number}]`)
      toast.success(`100% Credit Applied.`)
    } catch (err) {
      toast.error('Failed to fetch original invoice.')
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
      subtotal, discountAmount, voucherAmount: appliedVoucherAmount, handlingFee: handlingAmt, 
      taxableValue: finalTaxableValue, cgstAmount, sgstAmount, 
      exactFinalPayable, roundOffAmount, 
      exchangeValue: exchangeNum, 
      
      finalTotal: mode === 'custom' ? (Number(customOrderDetails?.advance_paid) || 0) 
                : mode === 'repair' ? (Number(repairDetails?.advancePaid) || 0) 
                : mode === 'return' ? (Number(returnDetails?.refundAmount) || 0) 
                : finalPayable,
      paymentMode: formattedPaymentMode
    }
  }

  const executeCheckout = async (isEstimate = false) => {
    setIsProcessing(true)
    let finalNo = ''
    try {
      const requiredTotal = mode === 'custom' ? (Number(customOrderDetails?.advance_paid) || 0) 
                          : mode === 'repair' ? (Number(repairDetails?.advancePaid) || 0) 
                          : mode === 'return' ? (Number(returnDetails?.refundAmount) || 0) 
                          : finalPayable;

      if (paymentMode === 'split' && Math.abs(currentSplitTotal - requiredTotal) > 0.1) {
        toast.error(`Split total must match ₹${requiredTotal}`);
        setIsProcessing(false); return { success: false };
      }

      if (isEstimate) {
        finalNo = `EST-${Date.now().toString().slice(-6)}`
        toast.success("Estimate generated.")
      } 
      else if (mode === 'normal') {
        const invoiceData = {
            customer_id: selectedCustomer?.id, warehouse_id: selectedLocation,
            items: cart.map((item) => ({ item_id: item.id, rate: item.mrp })),
            payment_mode: paymentMode === 'split' ? JSON.stringify(splitPayments) : paymentMode,
            subtotal, discount_amount: discountAmount, voucher_code: activeVoucher?.code || null,
            voucher_discount: appliedVoucherAmount, taxable_value: finalTaxableValue,
            cgst_amount: cgstAmount, sgst_amount: sgstAmount, round_off_amount: roundOffAmount,
            exchange_value: exchangeNum, exchange_notes: exchangeNotes, exchange_barcode: exchangeInvoiceNo.trim() || null, 
            final_total: finalPayable
          }
        const { data, error } = await callRpc('pos_confirm_sale', { p_invoice_json: invoiceData, p_user_id: appUser?.user_id })
        if (error) throw error
        
        finalNo = data?.invoice_number || `INV-${Date.now().toString().slice(-6)}`
        if (activeVoucher) await supabase.from('vouchers').update({ status: 'redeemed', redeemed_at: new Date().toISOString() }).eq('id', activeVoucher.id)
        
        // --- CUSTOM ORDERS FULFILLMENT ---
        const customOrderIds = cart.filter(item => item.custom_order_id).map(item => item.custom_order_id);
        if (customOrderIds.length > 0) {
           await supabase.from('custom_orders').update({ status: 'delivered' }).in('id', customOrderIds);
        }

        // --- REPAIR TICKETS FULFILLMENT ---
        const repairTicketIds = cart.filter(item => item.repair_ticket_id).map(item => item.repair_ticket_id);
        if (repairTicketIds.length > 0) {
           await supabase.from('repair_tickets').update({ status: 'delivered' }).in('id', repairTicketIds);
        }
        // ----------------------------------

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

      return { success: true, invoiceNo: finalNo, draftData: generateDraftData(isEstimate) }
    } catch (err: any) {
      toast.error(err.message || 'Checkout failed.'); return { success: false }
    } finally { setIsProcessing(false) }
  }

  const resetCheckoutState = () => {
    setDiscountValue(''); setActiveVoucher(null); setHandlingFee('0'); 
    setExchangeValue(''); setExchangeNotes(''); setExchangeInvoiceNo('');
    setIsExchangeOpen(false); setPaymentMode('cash');
    setSplitPayments({ cash: '', card: '', upi: '', bank: '' });
  }

  return {
    paymentMode, setPaymentMode, isProcessing, splitPayments, setSplitPayments, currentSplitTotal,
    discountType, setDiscountType, discountValue, setDiscountValue,
    voucherCode, setVoucherCode, activeVoucher, setActiveVoucher, handlingFee,
    isExchangeOpen, setIsExchangeOpen, exchangeInvoiceNo, setExchangeInvoiceNo, exchangeValue, setExchangeValue, exchangeNotes, setExchangeNotes,
    discountAmount, appliedVoucherAmount, handlingAmt, finalTaxableValue, cgstAmount, sgstAmount, exactFinalPayable, roundOffAmount, finalPayable, exchangeNum,
    handleApplyVoucher, handleFetchExchangeItem, generateDraftData, executeCheckout, resetCheckoutState
  }
}