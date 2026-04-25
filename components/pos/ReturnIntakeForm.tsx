import React, { useState, useEffect } from 'react'
import { Undo2, Search, Keyboard, Loader2, CheckCircle2, Package, Scale, Gem, AlertCircle, CheckCircle } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { 
  Select, SelectContent, SelectItem, 
  SelectTrigger, SelectValue 
} from '@/components/ui/select'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabaseClient' 

interface ReturnIntakeFormProps {
  details: any
  setDetails: (details: any) => void
  appUser: any 
  onApplyReturn?: (refundValue: number, originalInvoice: string, physicalDetails: any) => void 
}

type FlowState = 'search' | 'found' | 'manual'

export function ReturnIntakeForm({ details, setDetails, appUser, onApplyReturn }: ReturnIntakeFormProps) {
  // ✨ NEW: Wizard flow state instead of tabs
  const [flowState, setFlowState] = useState<FlowState>('search')
  const [isFetching, setIsFetching] = useState(false)
  
  // Financial State
  const [articleCost, setArticleCost] = useState('')
  const [discountApplied, setDiscountApplied] = useState('0')
  const [returnPercent, setReturnPercent] = useState('70')

  // Physical Item State (Required for Manual / Old Gold)
  const [itemCategory, setItemCategory] = useState('')
  const [metalType, setMetalType] = useState('Gold')
  const [purityKarat, setPurityKarat] = useState('22K')
  const [grossWeight, setGrossWeight] = useState('')
  const [netWeight, setNetWeight] = useState('')
  
  // Optional Diamond State
  const [stoneWeight, setStoneWeight] = useState('0')
  const [diamondClarity, setDiamondClarity] = useState('')
  const [diamondColor, setDiamondColor] = useState('')
  const [diamondShape, setDiamondShape] = useState('')

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

      if (error || !data) {
        toast.error('Invoice not found. Switching to manual Old Gold entry.')
        setFlowState('manual')
        setArticleCost('')
        setDiscountApplied('0')
        return
      }

      setArticleCost(data.subtotal?.toString() || '0')
      setDiscountApplied(data.discount_amount?.toString() || '0')
      setFlowState('found')
      toast.success('Invoice verified successfully.')

    } catch (error: any) {
      toast.error(error.message || 'Failed to fetch invoice data.')
    } finally {
      setIsFetching(false)
    }
  }

  const resetFlow = () => {
    setFlowState('search')
    setDetails({...details, invoiceNo: ''})
    setArticleCost('')
    setDiscountApplied('0')
    setReturnPercent('70')
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

  // Purity Auto-Mapper for Database Constraints
  const getPurityPercent = (karat: string) => {
    switch (karat) {
      case '24K': return 99.90;
      case '22K': return 91.60;
      case '18K': return 75.00;
      case '14K': return 58.30;
      case '10K': return 41.70;
      default: return 100.00;
    }
  }

  const handleApplyToBill = () => {
    if (!details.calculatedRefund || details.calculatedRefund <= 0) {
      return toast.error('Refund value must be greater than zero.');
    }

    if (flowState === 'manual') {
      if (!itemCategory.trim()) return toast.error("Item Category is required for manual entry.");
      const gw = parseFloat(grossWeight);
      const nw = parseFloat(netWeight);
      if (isNaN(gw) || gw <= 0) return toast.error("Valid Gross Weight is required.");
      if (isNaN(nw) || nw <= 0) return toast.error("Valid Net Weight is required.");
      if (nw > gw) return toast.error("Net weight cannot exceed Gross weight.");
    }
    
    if (onApplyReturn) {
      const physicalDetails = flowState === 'manual' ? {
        is_external_item: true,
        item_category: itemCategory,
        metal_type: metalType,
        purity_karat: purityKarat,
        purity_percent: getPurityPercent(purityKarat),
        gross_weight_g: parseFloat(grossWeight),
        net_weight_g: parseFloat(netWeight),
        total_stone_weight_cts: parseFloat(stoneWeight) || 0,
        diamond_clarity: diamondClarity.trim() || null,
        diamond_color: diamondColor.trim() || null,
        diamond_shape: diamondShape.trim() || null,
      } : { is_external_item: false };

      onApplyReturn(details.calculatedRefund, details.invoiceNo || 'Manual Return', physicalDetails);
      toast.success('Return value applied to checkout.');
    } else {
      toast.error('Parent component is not listening for this update.');
    }
  }

  return (
    <div className="flex-1 overflow-y-auto p-3 sm:p-6 custom-scrollbar bg-slate-50">
      <div className="max-w-2xl mx-auto space-y-5 bg-white border border-slate-200 shadow-sm rounded-xl p-4 sm:p-6">
        
        <div className="border-b border-slate-100 pb-4 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
          <div>
            <h2 className="text-lg font-bold text-rose-600 flex items-center gap-2 tracking-tight">
              <Undo2 className="w-5 h-5" /> Customer Return / Buyback
            </h2>
            <p className="text-xs text-slate-500 mt-1">Audit original invoice or intake external Old Gold.</p>
          </div>
          
          {flowState !== 'search' && (
            <Button variant="outline" size="sm" onClick={resetFlow} className="text-xs h-8 shrink-0 w-full sm:w-auto">
              Start Over
            </Button>
          )}
        </div>

        {/* STEP 1: INVOICE SEARCH */}
        <div className={`space-y-3 transition-all duration-300 ${flowState !== 'search' ? 'opacity-60 pointer-events-none hidden sm:block' : ''}`}>
          <Label className="text-xs font-bold text-slate-700">Original Invoice Number</Label>
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input 
                placeholder="e.g. INV-100293" 
                className="h-11 pl-9 rounded-lg border-slate-300 uppercase font-mono text-sm" 
                value={details.invoiceNo || ''} 
                onChange={e => setDetails({...details, invoiceNo: e.target.value})}
                onKeyDown={(e) => { if (e.key === 'Enter' && flowState === 'search') handleFetchInvoice() }}
                disabled={flowState !== 'search'}
              />
            </div>
            <Button 
              className="h-11 bg-slate-900 text-white rounded-lg hover:bg-slate-800 w-full sm:w-[140px] shrink-0 font-bold" 
              onClick={handleFetchInvoice}
              disabled={isFetching || flowState !== 'search'}
            >
              {isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Search Invoice'}
            </Button>
          </div>
          
          {flowState === 'search' && (
            <div className="pt-2 text-center sm:text-left">
              <button 
                className="text-xs font-bold text-indigo-600 hover:text-indigo-800 underline underline-offset-2 flex items-center gap-1.5 mx-auto sm:mx-0"
                onClick={() => {
                  setFlowState('manual')
                  setDetails({...details, invoiceNo: 'OLD-GOLD-MANUAL'})
                }}
              >
                <Keyboard className="w-3.5 h-3.5" /> Skip search and enter Old Gold manually
              </button>
            </div>
          )}
        </div>

        {/* STEP 2: DYNAMIC FORM AREA */}
        {flowState !== 'search' && (
          <div className="space-y-5 animate-in fade-in slide-in-from-top-4 duration-300 pt-2 border-t border-slate-100 sm:border-0 sm:pt-0">
            
            {/* Context Banners */}
            {flowState === 'found' ? (
              <div className="bg-emerald-50 text-emerald-800 border border-emerald-200 p-3 rounded-lg flex items-center gap-2 text-xs font-semibold">
                <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                Invoice verified. System details loaded automatically.
              </div>
            ) : (
              <div className="bg-amber-50 text-amber-800 border border-amber-200 p-3 rounded-lg flex items-center gap-2 text-xs font-semibold">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                Manual Intake Mode: Please enter physical item specifications.
              </div>
            )}

            {/* Physical Details (Only in Manual Mode) */}
            {flowState === 'manual' && (
              <div className="space-y-4 bg-slate-50/50 p-3 sm:p-4 rounded-xl border border-slate-200">
                <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5 mb-1">
                  <Package className="w-3.5 h-3.5" /> Physical Specifications
                </Label>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1.5 sm:col-span-1">
                    <Label className="text-[11px] font-semibold text-slate-700">Category</Label>
                    <Input placeholder="e.g. Ring, Scrap" className="h-10 bg-white" value={itemCategory} onChange={e => setItemCategory(e.target.value)} />
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-2 gap-3 sm:col-span-2">
                    <div className="space-y-1.5">
                      <Label className="text-[11px] font-semibold text-slate-700">Metal</Label>
                      <Select value={metalType} onValueChange={setMetalType}>
                        <SelectTrigger className="h-10 bg-white"><SelectValue/></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Gold">Gold</SelectItem>
                          <SelectItem value="Silver">Silver</SelectItem>
                          <SelectItem value="Platinum">Platinum</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[11px] font-semibold text-slate-700">Purity</Label>
                      <Select value={purityKarat} onValueChange={setPurityKarat}>
                        <SelectTrigger className="h-10 bg-amber-50 text-amber-800 border-amber-200 font-bold"><SelectValue/></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="24K">24K</SelectItem>
                          <SelectItem value="22K">22K</SelectItem>
                          <SelectItem value="18K">18K</SelectItem>
                          <SelectItem value="14K">14K</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 sm:gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] text-slate-500 uppercase font-bold flex items-center gap-1"><Scale className="w-3 h-3 hidden sm:block"/> Gross (g)</Label>
                    <Input type="number" inputMode="decimal" step="0.001" className="h-10 font-mono text-sm bg-white" value={grossWeight} onChange={e => setGrossWeight(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] text-emerald-600 uppercase font-bold flex items-center gap-1"><Scale className="w-3 h-3 hidden sm:block"/> Net (g)</Label>
                    <Input type="number" inputMode="decimal" step="0.001" className="h-10 font-mono text-sm bg-emerald-50 border-emerald-200 text-emerald-700" value={netWeight} onChange={e => setNetWeight(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] text-blue-600 uppercase font-bold flex items-center gap-1"><Gem className="w-3 h-3 hidden sm:block"/> Stone (ct)</Label>
                    <Input type="number" inputMode="decimal" step="0.001" className="h-10 font-mono text-sm bg-blue-50 border-blue-200 text-blue-700" value={stoneWeight} onChange={e => setStoneWeight(e.target.value)} />
                  </div>
                </div>

                {parseFloat(stoneWeight) > 0 && (
                  <div className="grid grid-cols-3 gap-2 sm:gap-3 animate-in fade-in slide-in-from-top-1 pt-2 border-t border-slate-200">
                    <div className="space-y-1.5">
                      <Label className="text-[9px] text-slate-500 uppercase">Clarity</Label>
                      <Input placeholder="VVS" className="h-9 text-xs uppercase bg-white" value={diamondClarity} onChange={e => setDiamondClarity(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[9px] text-slate-500 uppercase">Color</Label>
                      <Input placeholder="E-F" className="h-9 text-xs uppercase bg-white" value={diamondColor} onChange={e => setDiamondColor(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[9px] text-slate-500 uppercase">Shape</Label>
                      <Input placeholder="Round" className="h-9 text-xs bg-white" value={diamondShape} onChange={e => setDiamondShape(e.target.value)} />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Financial Calculations */}
            <div className="space-y-4">
              <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Financial Calculation</Label>
              
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-semibold text-slate-700">Article Value (Pre-GST) ₹</Label>
                  <Input 
                    type="number" 
                    inputMode="decimal"
                    className={`h-11 rounded-lg font-bold text-base ${flowState === 'found' ? 'bg-slate-100 text-slate-500 border-transparent' : 'bg-white border-slate-300'}`}
                    value={articleCost} 
                    onChange={e => setArticleCost(e.target.value)} 
                    disabled={flowState === 'found'} 
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-semibold text-slate-700">Discount Given ₹</Label>
                  <Input 
                    type="number" 
                    inputMode="decimal"
                    className={`h-11 rounded-lg font-bold text-base ${flowState === 'found' ? 'bg-rose-50/50 text-rose-400 border-transparent' : 'bg-white border-slate-300 text-rose-600'}`}
                    value={discountApplied} 
                    onChange={e => setDiscountApplied(e.target.value)} 
                    disabled={flowState === 'found'} 
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 bg-rose-50/30 p-3 sm:p-4 border border-rose-100 rounded-xl">
                <div className="space-y-1.5 flex flex-col justify-center">
                  <Label className="text-xs font-bold text-slate-800">Buyback Policy (%)</Label>
                  <Input 
                    type="number" 
                    inputMode="decimal"
                    className="h-11 text-lg font-black rounded-lg border-slate-300 bg-white focus-visible:ring-rose-500" 
                    value={returnPercent} 
                    onChange={e => setReturnPercent(e.target.value)} 
                  />
                  <p className="text-[10px] text-slate-500 mt-1">Percentage applied against net paid value.</p>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-rose-600">Final Refund Value (₹)</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-rose-600 font-bold text-xl">₹</span>
                    <Input 
                      readOnly 
                      className="h-14 pl-8 text-2xl font-black rounded-lg border-rose-300 bg-white text-rose-700 shadow-inner" 
                      value={details.calculatedRefund?.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}) || "0.00"} 
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Action Button */}
            <div className="pt-2 flex justify-end">
              <Button 
                className="h-12 w-full sm:w-auto px-8 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl shadow-md transition-all active:scale-95"
                onClick={handleApplyToBill}
                disabled={!details.calculatedRefund || details.calculatedRefund <= 0}
              >
                <CheckCircle2 className="w-5 h-5 mr-2" />
                Apply Return to Bill
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}