import React, { useState, useEffect } from 'react'
import { Undo2, ScanLine, Keyboard, Loader2, CheckCircle2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabaseClient' 

interface ReturnIntakeFormProps {
  details: any
  setDetails: (details: any) => void
  appUser: any 
  // ✨ NEW: Function to push the final value to the parent checkout sidebar
  onApplyReturn?: (refundValue: number, originalInvoice: string) => void 
}

export function ReturnIntakeForm({ details, setDetails, appUser, onApplyReturn }: ReturnIntakeFormProps) {
  const [entryMode, setEntryMode] = useState<'auto' | 'manual'>('manual')
  const [isFetching, setIsFetching] = useState(false)
  
  // Local state for calculation
  const [articleCost, setArticleCost] = useState('')
  const [discountApplied, setDiscountApplied] = useState('0')
  const [returnPercent, setReturnPercent] = useState('70')

  const handleFetchInvoice = async () => {
    if (!details.invoiceNo?.trim()) {
      return toast.error('Please enter an invoice number first.')
    }
    if (!appUser?.company_id) {
      return toast.error('Authentication error. Missing company ID.')
    }

    setIsFetching(true)
    try {
      const { data, error } = await supabase
        .from('invoices')
        .select('subtotal, discount_amount') 
        .ilike('invoice_number', details.invoiceNo.trim())
        .eq('company_id', appUser.company_id)
        .maybeSingle()

      if (error) throw error
      if (!data) return toast.error('Invoice not found in the system.')

      setArticleCost(data.subtotal?.toString() || '0')
      setDiscountApplied(data.discount_amount?.toString() || '0')
      toast.success('Invoice data retrieved successfully.')

    } catch (error: any) {
      toast.error(error.message || 'Failed to fetch invoice data.')
    } finally {
      setIsFetching(false)
    }
  }

  // Math Engine for Return
  useEffect(() => {
    const cost = parseFloat(articleCost) || 0
    const discount = parseFloat(discountApplied) || 0
    const percent = parseFloat(returnPercent) || 70

    const paidValue = cost - discount
    const refundValue = paidValue * (percent / 100)

    setDetails({
      ...details,
      articleCost: cost,
      discountApplied: discount,
      paidValue: paidValue,
      returnPercent: percent,
      calculatedRefund: refundValue
    })
  }, [articleCost, discountApplied, returnPercent])

  // ✨ NEW: Handler to push to sidebar
  const handleApplyToBill = () => {
    if (!details.calculatedRefund || details.calculatedRefund <= 0) {
      return toast.error('Refund value must be greater than zero.');
    }
    
    if (onApplyReturn) {
      onApplyReturn(details.calculatedRefund, details.invoiceNo || 'Manual Return');
      toast.success('Return value applied to sidebar.');
    } else {
      toast.error('Parent component is not listening for this update.');
    }
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar bg-slate-50">
      <div className="max-w-2xl mx-auto space-y-6 bg-white border border-slate-300 shadow-sm rounded-sm p-4 sm:p-6">
        
        <div className="border-b border-slate-200 pb-4 mb-4 flex justify-between items-center">
          <div>
            <h2 className="text-lg font-semibold text-[#E30000] flex items-center gap-2">
              <Undo2 className="w-5 h-5" /> Customer Buyback / Return
            </h2>
            <p className="text-xs text-slate-500 mt-1">Calculate return value based on final discounted article price.</p>
          </div>
        </div>

        {/* Mode Toggle */}
        <div className="flex bg-slate-100 p-1 rounded-sm border border-slate-200 w-full sm:w-1/2">
          <button className={`flex-1 text-xs flex justify-center items-center gap-2 font-bold py-2 rounded-sm transition-colors ${entryMode === 'auto' ? 'bg-white text-slate-800 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-700'}`} onClick={() => setEntryMode('auto')}>
            <ScanLine className="w-4 h-4"/> Fetch from DB
          </button>
          <button className={`flex-1 text-xs flex justify-center items-center gap-2 font-bold py-2 rounded-sm transition-colors ${entryMode === 'manual' ? 'bg-white text-slate-800 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-700'}`} onClick={() => setEntryMode('manual')}>
            <Keyboard className="w-4 h-4"/> Manual Entry
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1 sm:col-span-2">
            <Label className="text-xs font-semibold text-slate-700">Original Invoice Number</Label>
            <div className="flex gap-2">
              <Input 
                placeholder="e.g. INV-100293" 
                className="h-9 rounded-sm border-slate-300 uppercase" 
                value={details.invoiceNo || ''} 
                onChange={e => setDetails({...details, invoiceNo: e.target.value})}
                onKeyDown={(e) => { if (e.key === 'Enter' && entryMode === 'auto') handleFetchInvoice() }}
              />
              {entryMode === 'auto' && (
                <Button 
                  className="h-9 bg-slate-800 text-white rounded-sm hover:bg-slate-700 w-[120px]" 
                  onClick={handleFetchInvoice}
                  disabled={isFetching}
                >
                  {isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Audit System'}
                </Button>
              )}
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-semibold text-slate-700">Article Cost (Pre-GST) ₹</Label>
            <Input type="number" placeholder="0.00" className="h-9 rounded-sm border-slate-300" value={articleCost} onChange={e => setArticleCost(e.target.value)} disabled={entryMode === 'auto'} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-semibold text-slate-700">Discount Given (If any) ₹</Label>
            <Input type="number" placeholder="0.00" className="h-9 rounded-sm border-slate-300 text-red-600" value={discountApplied} onChange={e => setDiscountApplied(e.target.value)} disabled={entryMode === 'auto'} />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-100 p-4 border border-slate-200 mt-4 rounded-sm">
          <div className="space-y-1">
            <Label className="text-xs font-bold text-slate-800">Buyback Percentage (%)</Label>
            <Input type="number" className="h-10 text-base font-bold rounded-sm border-slate-300" value={returnPercent} onChange={e => setReturnPercent(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-bold text-[#E30000]">Final Refund Value (₹)</Label>
            <Input type="number" readOnly className="h-10 text-base font-bold rounded-sm border-[#E30000] bg-white focus-visible:ring-[#E30000]" value={details.calculatedRefund?.toFixed(2) || 0} />
          </div>
        </div>

        {/* ✨ NEW: Action Button */}
        <div className="pt-4 border-t border-slate-200 flex justify-end">
          <Button 
            className="h-11 px-8 bg-[#E30000] hover:bg-red-700 text-white font-bold rounded-sm"
            onClick={handleApplyToBill}
            disabled={!details.calculatedRefund || details.calculatedRefund <= 0}
          >
            <CheckCircle2 className="w-5 h-5 mr-2" />
            Apply Return to Bill
          </Button>
        </div>

      </div>
    </div>
  )
}