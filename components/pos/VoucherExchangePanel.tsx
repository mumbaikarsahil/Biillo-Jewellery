import React, { useState } from 'react'
import { Ticket, CheckCircle2, X, RefreshCw, ChevronUp, ChevronDown, Check, AlertCircle, Gift, Package, Scale, Gem, ArrowLeft } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'

// Pre-defined Catalog Options
const CATEGORIES = ['Ring', 'Necklace', 'Earrings', 'Bangle', 'Bracelet', 'Pendant', 'Chain', 'Scrap', 'Coins/Bars']
const DIAMOND_SHAPES = ['Round', 'Princess', 'Oval', 'Marquise', 'Emerald', 'Pear', 'Cushion', 'Radiant', 'Heart', 'Asscher']
const DIAMOND_COLORS = ['D', 'E', 'F', 'G', 'H', 'I', 'J', 'EF', 'FG', 'GH', 'HI', 'IJ', 'Fancy']
const DIAMOND_CLARITIES = ['FL', 'IF', 'VVS1', 'VVS2', 'VVS', 'VS1', 'VS2', 'VS', 'SI1', 'SI2', 'SI', 'I1', 'I2', 'I3']

export function VoucherExchangePanel(props: any) {
  const [isSearching, setIsSearching] = useState(false)
  const [showManualOverride, setShowManualOverride] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  
  // Physical Details State
  const [itemCategory, setItemCategory] = useState('')
  const [metalType, setMetalType] = useState('Gold')
  const [purityKarat, setPurityKarat] = useState('22K')
  const [grossWeight, setGrossWeight] = useState('')
  const [netWeight, setNetWeight] = useState('')
  const [stoneWeight, setStoneWeight] = useState('0')
  const [diamondClarity, setDiamondClarity] = useState('')
  const [diamondColor, setDiamondColor] = useState('')
  const [diamondShape, setDiamondShape] = useState('')
  const [manualArticleCost, setManualArticleCost] = useState('')

  // Custom Input Toggles
  const [showCustomCategory, setShowCustomCategory] = useState(false)
  const [showCustomClarity, setShowCustomClarity] = useState(false)
  const [showCustomColor, setShowCustomColor] = useState(false)
  const [showCustomShape, setShowCustomShape] = useState(false)

  // --- BULLETPROOF FETCH HANDLER ---
  const handleSmartFetch = async () => {
    if (!props.exchangeInvoiceNo.trim()) return toast.error("Please enter an invoice number.")
    
    setIsSearching(true)
    try {
      const success = await props.handleFetchExchangeItem()
      
      if (!success) {
        setShowManualOverride(true)
        toast.info("System bill not found. Please enter details manually.")
      } else {
        setShowManualOverride(false)
      }
    } catch (err) {
      setShowManualOverride(true)
      toast.info("System bill not found. Please enter details manually.")
    } finally {
      setIsSearching(false)
    }
  }

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

  const handleManualApply = () => {
    const cost = parseFloat(manualArticleCost) || 0
    if (cost <= 0) return toast.error("Enter a valid article cost.")
    if (!itemCategory) return toast.error("Please select an item category.")
    if (!grossWeight || parseFloat(grossWeight) <= 0) return toast.error("Gross weight is required.")

    const physicalDetails = {
      is_external_item: true,
      item_category: itemCategory,
      metal_type: metalType,
      purity_karat: purityKarat,
      purity_percent: getPurityPercent(purityKarat),
      gross_weight_g: parseFloat(grossWeight) || 0,
      net_weight_g: parseFloat(netWeight) || 0,
      total_stone_weight_cts: parseFloat(stoneWeight) || 0,
      diamond_clarity: diamondClarity.trim() || null,
      diamond_color: diamondColor.trim() || null,
      diamond_shape: diamondShape.trim() || null,
    }

    props.setExchangeValue(cost.toString())
    props.setExchangeNotes(`MANUAL EXCHANGE: INV [${props.exchangeInvoiceNo}] | ${itemCategory} (${purityKarat}) - ${grossWeight}g`)
    
    // Safely call the prop if the parent hook has been updated to receive physical details
    if (props.setExchangePhysicalDetails) {
      props.setExchangePhysicalDetails(physicalDetails)
    }

    setShowManualOverride(false)
    setIsModalOpen(false)
    toast.success("Manual exchange item registered.")
  }

  const clearExchange = () => {
    props.setExchangeValue('0')
    props.setExchangeNotes('')
    props.setExchangeInvoiceNo('')
    setShowManualOverride(false)
    setManualArticleCost('')
    setGrossWeight('')
    setNetWeight('')
    setStoneWeight('0')
    setItemCategory('')
    if (props.setExchangePhysicalDetails) {
      props.setExchangePhysicalDetails(null)
    }
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

      {/* STRICT EXCHANGE PROTOCOL */}
      <div className={`rounded-xl border transition-all duration-300 overflow-hidden shadow-sm ${props.isExchangeOpen ? 'border-blue-200 bg-white' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
        <button 
          className="w-full flex items-center justify-between p-3 outline-none hover:bg-slate-50 transition-colors"
          onClick={() => props.setIsExchangeOpen(!props.isExchangeOpen)}
        >
          <div className="flex items-center gap-2">
            <RefreshCw className={`h-3.5 w-3.5 transition-transform duration-500 ${props.isExchangeOpen ? 'rotate-180 text-blue-600' : 'text-slate-400'}`} /> 
            <span className="text-xs font-semibold text-slate-700 tracking-tight">Old Item Exchange</span>
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
                  placeholder="Enter Invoice No. or Reference..." 
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
                    {isSearching ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : 'Search'}
                  </Button>
                )}
              </div>

              {/* MANUAL OVERRIDE TRIGGER */}
              {showManualOverride && activeExchangeValue === 0 && (
                <div className="animate-in slide-in-from-top-1 fade-in duration-200 mt-1">
                  <div className="flex items-start gap-1.5 text-[10px] text-slate-500 leading-tight mb-2 p-2 bg-orange-50 border border-orange-100 rounded-lg">
                    <AlertCircle className="w-3.5 h-3.5 text-orange-500 shrink-0 mt-0.5" />
                    <span>System bill not found. Please log the physical item details and enter the exchange value manually to commit it to the vault.</span>
                  </div>
                  <Button 
                    className="w-full h-9 rounded-lg text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 shadow-sm" 
                    onClick={() => setIsModalOpen(true)}
                  >
                    Log Physical Item & Exchange Value
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* --- MANUAL PHYSICAL INTAKE MODAL --- */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-[500px] p-0 overflow-hidden bg-slate-50 sm:rounded-2xl shadow-2xl h-[95dvh] sm:h-auto flex flex-col">
          <DialogHeader className="p-4 sm:p-5 border-b border-slate-200 bg-white shrink-0">
            <DialogTitle className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Package className="w-5 h-5 text-blue-600" /> Intake External Exchange Item
            </DialogTitle>
          </DialogHeader>

          <div className="p-4 sm:p-5 overflow-y-auto custom-scrollbar flex-1 space-y-5">
            {/* 1. Category & Metal */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-[11px] font-semibold text-slate-700">Category *</Label>
                {!showCustomCategory ? (
                  <Select value={itemCategory} onValueChange={(v) => {
                    if (v === 'Other') { setShowCustomCategory(true); setItemCategory(''); }
                    else { setItemCategory(v); }
                  }}>
                    <SelectTrigger className="h-10 bg-white"><SelectValue placeholder="Select..."/></SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      <SelectItem value="Other" className="font-bold text-blue-600">Other (Type)</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="flex gap-1 items-center">
                    <Input placeholder="Type Category" className="h-10 bg-white flex-1 text-sm" value={itemCategory} onChange={e => setItemCategory(e.target.value)} autoFocus />
                    <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0 text-slate-400" onClick={() => setShowCustomCategory(false)}>
                      <ArrowLeft className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
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
                    <SelectTrigger className="h-10 bg-amber-50 text-amber-800 font-bold border-amber-200"><SelectValue/></SelectTrigger>
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

            {/* 2. Weights */}
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-[10px] text-slate-500 uppercase font-bold flex items-center gap-1"><Scale className="w-3 h-3 hidden sm:block"/> Gross (g) *</Label>
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

            {/* 3. Diamond Details (Conditional) */}
            {parseFloat(stoneWeight) > 0 && (
              <div className="grid grid-cols-3 gap-3 animate-in fade-in slide-in-from-top-1 pt-2 border-t border-slate-200">
                <div className="space-y-1.5">
                  <Label className="text-[9px] text-slate-500 uppercase font-bold">Clarity</Label>
                  {!showCustomClarity ? (
                    <Select value={diamondClarity} onValueChange={(v) => { if (v === 'Other') setShowCustomClarity(true); else setDiamondClarity(v); }}>
                      <SelectTrigger className="h-9 bg-white text-xs"><SelectValue placeholder="Select..."/></SelectTrigger>
                      <SelectContent>
                        {DIAMOND_CLARITIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                        <SelectItem value="Other" className="font-bold text-blue-600">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : <Input className="h-9 text-xs uppercase" value={diamondClarity} onChange={e => setDiamondClarity(e.target.value)} />}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[9px] text-slate-500 uppercase font-bold">Color</Label>
                  {!showCustomColor ? (
                    <Select value={diamondColor} onValueChange={(v) => { if (v === 'Other') setShowCustomColor(true); else setDiamondColor(v); }}>
                      <SelectTrigger className="h-9 bg-white text-xs"><SelectValue placeholder="Select..."/></SelectTrigger>
                      <SelectContent>
                        {DIAMOND_COLORS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                        <SelectItem value="Other" className="font-bold text-blue-600">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : <Input className="h-9 text-xs uppercase" value={diamondColor} onChange={e => setDiamondColor(e.target.value)} />}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[9px] text-slate-500 uppercase font-bold">Shape</Label>
                  {!showCustomShape ? (
                    <Select value={diamondShape} onValueChange={(v) => { if (v === 'Other') setShowCustomShape(true); else setDiamondShape(v); }}>
                      <SelectTrigger className="h-9 bg-white text-xs"><SelectValue placeholder="Select..."/></SelectTrigger>
                      <SelectContent>
                        {DIAMOND_SHAPES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                        <SelectItem value="Other" className="font-bold text-blue-600">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : <Input className="h-9 text-xs" value={diamondShape} onChange={e => setDiamondShape(e.target.value)} />}
                </div>
              </div>
            )}

            {/* 4. Financial Exchange Value */}
            <div className="pt-2 border-t border-slate-200">
              <Label className="text-[11px] font-semibold text-slate-700 mb-1.5 block">Approved Exchange Value (₹) *</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-600 font-bold text-lg">₹</span>
                <Input 
                  type="number" 
                  inputMode="decimal"
                  placeholder="0.00" 
                  className="h-12 pl-8 text-xl font-bold border-blue-200 rounded-lg focus-visible:ring-blue-300 bg-blue-50/50 text-blue-900" 
                  value={manualArticleCost} 
                  onChange={(e) => setManualArticleCost(e.target.value)} 
                />
              </div>
            </div>
          </div>

          <DialogFooter className="bg-white p-4 sm:p-5 border-t border-slate-200 shrink-0 grid grid-cols-2 gap-3">
            <Button variant="outline" className="h-11 rounded-xl text-slate-600" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button className="h-11 rounded-xl bg-blue-600 text-white hover:bg-blue-700 font-bold" onClick={handleManualApply}>
              Apply Item & Value
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}