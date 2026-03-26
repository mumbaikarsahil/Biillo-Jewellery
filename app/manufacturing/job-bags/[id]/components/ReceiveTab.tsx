"use client"

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { 
  Dialog, DialogContent, DialogHeader, 
  DialogTitle, DialogDescription, DialogFooter
} from '@/components/ui/dialog'
import { 
  Table, TableBody, TableCell, TableHead, 
  TableHeader, TableRow 
} from "@/components/ui/table"
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { 
  Save, Layers, Settings2, RefreshCw, CheckCircle2, 
  ArrowUpCircle, ArrowDownCircle, CheckSquare,
  Calculator, Database, Gem, Hammer, ArrowRight, ArrowLeft, Check
} from 'lucide-react'

interface Props {
  jobId: string 
  companyId: string
  warehouseId: string
  refresh: () => void
}

type ReceiveItem = {
  job_bag_item_id: string
  sku_reference: string
  ornament_type: string
  category: string
  issuedGold: number
  issuedDiamondCts: number
  issuedDiamondPcs: number
  barcode: string
  grossWeight: string
  stonePieces: string
  stoneWeight: string
  breakageWeight: string
  netWeight: string
  lossWeight: string
  costMaking: string
  mrp: string
  item_size: string
  hsn_code: string
  huid_code: string
  item_remarks: string
  isSelected: boolean
}

export default function ReceiveTab({
  jobId,
  companyId,
  warehouseId,
  refresh
}: Props) {
  // --- BATCH SETTINGS STATE ---
  const [metalType, setMetalType] = useState('Gold')
  const [purityKarat, setPurityKarat] = useState('22K')
  const [purityPercent, setPurityPercent] = useState('91.6')
  const [laborRate, setLaborRate] = useState('')
  const [globalRemarks, setGlobalRemarks] = useState('')

  const [warehouses, setWarehouses] = useState<{id: string, name: string}[]>([])
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('')

  const [receiveItems, setReceiveItems] = useState<ReceiveItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)

  // --- MRP WIZARD STATE ---
  const [isCalcModalOpen, setCalcModalOpen] = useState(false)
  const [calcStep, setCalcStep] = useState<'params' | 'preview'>('params')
  const [base24kRate, setBase24kRate] = useState<number>(7250) 
  const [goldRates, setGoldRates] = useState<Record<string, number>>({}) 
  const [previewData, setPreviewData] = useState<any[]>([])
  const [calcParams, setCalcParams] = useState({
    diamondRatePerCt: 25000, 
    markupPercent: 80,
    flatCharge: 8000
  })

  // Fetch initial base rates for the calculator
  useEffect(() => {
    async function fetchCompanyRates() {
      const { data } = await supabase
        .from('companies')
        .select('current_rate_24k, current_rate_diamond')
        .eq('id', companyId)
        .maybeSingle()
      if (data) {
        if (data.current_rate_24k) setBase24kRate(data.current_rate_24k)
        if (data.current_rate_diamond) setCalcParams(prev => ({ ...prev, diamondRatePerCt: data.current_rate_diamond }))
      }
    }
    fetchCompanyRates()
  }, [companyId])

  useEffect(() => {
    async function fetchWarehouses() {
      const { data } = await supabase
        .from('warehouses')
        .select('id, name')
        .eq('company_id', companyId)
        .eq('is_active', true)
      
      if (data && data.length > 0) {
        setWarehouses(data)
        setSelectedWarehouseId(data[0].id) 
      }
    }
    fetchWarehouses()
  }, [companyId])

  useEffect(() => {
    async function fetchKarigarRate() {
      if (!jobId) return
      const { data } = await supabase
        .from('job_bags')
        .select(`karigars (default_labor_rate)`)
        .eq('id', jobId)
        .single()

      if (data && data.karigars) {
        const rateData = data.karigars as any
        if (rateData.default_labor_rate) setLaborRate(rateData.default_labor_rate.toString())
      }
    }
    fetchKarigarRate()
  }, [jobId])

  const loadJobBagItems = useCallback(async () => {
    setIsLoading(true)
    try {
      const jobPrefix = jobId.split('-')[0].substring(0, 4).toUpperCase()

      const { data: items, error } = await supabase
        .from('job_bag_items')
        .select(`
          id, sku_reference, ornament_type, status,
          job_bags ( product_category ),
          job_bag_gold_issues ( issued_weight_g ),
          job_bag_diamond_issues ( issued_weight_cts, issued_pieces )
        `)
        .eq('job_bag_id', jobId)
        .neq('status', 'received')
        .order('created_at', { ascending: true })

      if (error) throw error

      if (!items || items.length === 0) {
        setReceiveItems([])
        return
      }

      const mappedItems: ReceiveItem[] = items.map((item: any, index: number) => {
        const issuedGold = item.job_bag_gold_issues.reduce((sum: number, issue: any) => sum + Number(issue.issued_weight_g), 0)
        const issuedDiamondCts = item.job_bag_diamond_issues.reduce((sum: number, issue: any) => sum + Number(issue.issued_weight_cts), 0)
        const issuedDiamondPcs = item.job_bag_diamond_issues.reduce((sum: number, issue: any) => sum + Number(issue.issued_pieces), 0)

        const category = item.job_bags?.product_category || item.ornament_type || 'Jewelry'
        const categoryPrefix = category.substring(0, 3).toUpperCase()
        const currentSeq = (index + 1).toString().padStart(2, '0')

        return {
          job_bag_item_id: item.id,
          sku_reference: item.sku_reference,
          ornament_type: item.ornament_type || 'N/A', 
          category: category,
          issuedGold,
          issuedDiamondCts,
          issuedDiamondPcs,
          barcode: `JB${jobPrefix}-${categoryPrefix}-${item.sku_reference}-${currentSeq}`,
          grossWeight: '',
          stonePieces: '',
          stoneWeight: '',
          breakageWeight: '',
          netWeight: '0',
          lossWeight: '0',
          costMaking: '0',
          mrp: '',
          item_size: '',
          hsn_code: '',
          huid_code: '',
          item_remarks: '',
          isSelected: false 
        }
      })

      setReceiveItems(mappedItems)
    } catch (err: any) {
      toast.error(`Error loading items: ${err.message}`)
    } finally {
      setIsLoading(false)
    }
  }, [jobId])

  useEffect(() => { loadJobBagItems() }, [loadJobBagItems])

  const updateBatchItem = (id: string, field: keyof ReceiveItem, value: string) => {
    setReceiveItems(prev => prev.map(item => {
      if (item.job_bag_item_id !== id) return item;

      const updated = { ...item, [field]: value }

      if (field === 'grossWeight' || field === 'stoneWeight') {
        const gw = parseFloat(field === 'grossWeight' ? value : updated.grossWeight) || 0
        const sw = parseFloat(field === 'stoneWeight' ? value : updated.stoneWeight) || 0
        const lr = parseFloat(laborRate) || 0
        
        const calculatedNet = Math.max(0, gw - (sw * 0.2))
        const loss = Math.max(0, updated.issuedGold - calculatedNet)

        updated.netWeight = calculatedNet.toFixed(3)
        updated.lossWeight = loss.toFixed(3)
        updated.costMaking = (calculatedNet * lr).toFixed(2)
      }
      return updated;
    }))
  }

  const toggleSelection = (id: string) => {
    setReceiveItems(prev => prev.map(item => 
      item.job_bag_item_id === id ? { ...item, isSelected: !item.isSelected } : item
    ))
  }

  const selectAll = (select: boolean) => {
    setReceiveItems(prev => prev.map(item => ({ ...item, isSelected: select })))
  }

  useEffect(() => {
    if (receiveItems.length === 0) return
    const lr = parseFloat(laborRate) || 0

    setReceiveItems(prev => prev.map(item => {
      const gw = parseFloat(item.grossWeight) || 0
      const sw = parseFloat(item.stoneWeight) || 0
      const calculatedNet = Math.max(0, gw - (sw * 0.2))
      const loss = Math.max(0, item.issuedGold - calculatedNet)
      return {
        ...item,
        netWeight: calculatedNet.toFixed(3),
        lossWeight: loss.toFixed(3),
        costMaking: (calculatedNet * lr).toFixed(2)
      }
    }))
  }, [laborRate])

  const handleKaratChange = (val: string) => {
    setPurityKarat(val)
    if (val === '24K') setPurityPercent('99.9')
    if (val === '22K') setPurityPercent('91.6')
    if (val === '18K') setPurityPercent('75.0')
    if (val === '14K') setPurityPercent('58.3')
  }

  // --- MRP WIZARD LOGIC FOR RECEIVE TAB ---
  const handleOpenCalc = () => {
    const selectedItems = receiveItems.filter(i => i.isSelected)
    if (selectedItems.length === 0) {
      return toast.error("No items staged.", { description: "Please select at least one item to calculate MRP." })
    }
    
    const initialRates: Record<string, number> = {}
    const kNum = parseInt(purityKarat.replace(/\D/g, '')) || 24
    initialRates[purityKarat] = Math.round(base24kRate * (kNum / 24))
    
    setGoldRates(initialRates)
    setCalcStep('params')
    setCalcModalOpen(true)
  }

  const handleGeneratePreview = () => {
    const selectedItems = receiveItems.filter(i => i.isSelected)
    const previews = selectedItems.map(item => {
      const k = purityKarat || '24K'
      const gRate = goldRates[k] || 0
      const goldCost = (parseFloat(item.netWeight) || 0) * gRate
      const diamondCost = (parseFloat(item.stoneWeight) || 0) * calcParams.diamondRatePerCt
      const baseCost = goldCost + diamondCost
      const markupAmount = baseCost * (calcParams.markupPercent / 100)
      const subtotal = baseCost + markupAmount
      const finalMrp = Math.round(subtotal + calcParams.flatCharge)
      
      return { ...item, newMrp: finalMrp }
    })
    setPreviewData(previews)
    setCalcStep('preview')
  }

  const handleApplyBulkMrp = () => {
    setReceiveItems(prev => prev.map(item => {
      const update = previewData.find(px => px.job_bag_item_id === item.job_bag_item_id)
      if (update) {
        return { ...item, mrp: update.newMrp.toString() }
      }
      return item
    }))
    toast.success(`Applied calculated MRP to ${previewData.length} items.`)
    setCalcModalOpen(false)
  }

  // --- BULK RECEIVE LOGIC ---
  async function receiveSelectedBatch() {
    const selectedItems = receiveItems.filter(i => i.isSelected)
    
    if (selectedItems.length === 0) return toast.error("No items selected to receive.")
    
    const invalidItem = selectedItems.find(i => parseFloat(i.grossWeight) <= 0 || !i.grossWeight)
    if (invalidItem) return toast.error(`Enter a valid Gross Weight for ${invalidItem.sku_reference}.`)

    setIsProcessing(true)
    const { data: authData } = await supabase.auth.getUser()
    const userId = authData?.user?.id

    try {
      for (const item of selectedItems) {
        let combinedRemarks = globalRemarks ? `[Batch] ${globalRemarks}` : '';
        if (item.item_remarks) combinedRemarks += ` | [Item] ${item.item_remarks}`;
        if (item.breakageWeight && Number(item.breakageWeight) > 0) {
          combinedRemarks += ` | Broken Stone: ${item.breakageWeight}ct`;
        }

        const { error: invError } = await supabase.from('inventory_items').insert({
          company_id: companyId,
          warehouse_id: selectedWarehouseId,
          created_from_job_bag_id: jobId,
          created_from_job_bag_item_id: item.job_bag_item_id,
          status: 'in_stock',
          metal_type: metalType,
          purity_karat: purityKarat,
          purity_percent: Number(purityPercent),
          item_category: item.category, 
          sku_reference: item.sku_reference,
          labor_rate: Number(laborRate),
          remarks: combinedRemarks.trim() || null,
          barcode: item.barcode,
          gross_weight_g: Number(item.grossWeight),
          net_weight_g: Number(item.netWeight),
          total_stone_weight_cts: Number(item.stoneWeight),
          total_stone_pieces: Number(item.stonePieces) || 0,
          wastage_weight_g: Number(item.lossWeight),
          cost_making: Number(item.costMaking),
          mrp: item.mrp ? Number(item.mrp) : null,
          created_by: userId,
          updated_by: userId,
          item_size: item.item_size || null,
          hsn_code: item.hsn_code || null,
          huid_code: item.huid_code ? item.huid_code.toUpperCase() : null 
        })

        if (invError) {
          if (invError.code === '23505' && invError.message.includes('huid')) {
             throw new Error(`HUID Code ${item.huid_code} is already registered.`);
          }
          throw new Error(`Inventory Insert Error (${item.sku_reference}): ${invError.message}`)
        }

        const { error: jobItemError } = await supabase.from('job_bag_items').update({
          status: 'received',
          actual_gross_weight_g: Number(item.grossWeight),
          calculated_loss_g: Number(item.lossWeight),
          updated_at: new Date().toISOString()
        }).eq('id', item.job_bag_item_id)

        if (jobItemError) throw new Error(`Update Status Error: ${jobItemError.message}`)
      }

      toast.success(`Successfully received ${selectedItems.length} items to the vault!`)
      refresh()
      await loadJobBagItems() 
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setIsProcessing(false)
    }
  }

  const selectedItems = receiveItems.filter(i => i.isSelected)
  const unselectedItems = receiveItems.filter(i => !i.isSelected)

  if (!isLoading && receiveItems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 border-2 border-dashed border-border rounded-xl bg-secondary/10">
        <CheckCircle2 className="w-8 h-8 text-emerald-500 mb-3" />
        <h3 className="text-sm font-bold text-foreground">All Items Received</h3>
        <p className="text-muted-foreground text-xs mt-1 text-center">There are no pending SKUs to receive in this Job Bag.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      
      {/* ========================================================
          STEP 1: CONFIGURATION & STAGING AREA (SELECTED ITEMS)
          ======================================================== */}
      <Card className="shadow-md border-primary/20 bg-card overflow-hidden">
        <CardHeader className="bg-primary/5 py-3 px-4 border-b border-primary/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Settings2 className="w-4 h-4 text-primary" />
            <h3 className="text-xs font-black uppercase tracking-widest text-primary">1. Active Receiving Batch</h3>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={loadJobBagItems} disabled={isLoading} className="h-8 text-xs bg-white">
              <RefreshCw className={`w-3 h-3 mr-2 ${isLoading ? 'animate-spin' : ''}`} /> Refresh
            </Button>
            <Button 
              size="sm" 
              onClick={receiveSelectedBatch} 
              disabled={isProcessing || selectedItems.length === 0}
              className="h-8 px-4 text-xs font-bold uppercase shadow-md bg-foreground text-background hover:bg-foreground/90 transition-all active:scale-[0.98]"
            >
              {isProcessing ? <RefreshCw className="w-3 h-3 mr-2 animate-spin" /> : <Save className="w-3 h-3 mr-2" />}
              Receive Selected ({selectedItems.length})
            </Button>
          </div>
        </CardHeader>
        
        <CardContent className="p-0">
          {/* Top Settings Form */}
          <div className="p-4 sm:p-6 bg-white border-b border-zinc-100">
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold uppercase text-muted-foreground">Receiving Vault</Label>
                <Select value={selectedWarehouseId} onValueChange={setSelectedWarehouseId}>
                  <SelectTrigger className="h-9 text-xs border-border bg-muted/20 focus:ring-1 focus:ring-primary"><SelectValue /></SelectTrigger>
                  <SelectContent>{warehouses.map(w => <SelectItem key={w.id} value={w.id} className="text-xs">{w.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold uppercase text-muted-foreground">Metal Type</Label>
                <Select value={metalType} onValueChange={setMetalType}>
                  <SelectTrigger className="h-9 text-xs border-border bg-muted/20"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="Gold" className="text-xs">Gold</SelectItem><SelectItem value="Platinum" className="text-xs">Platinum</SelectItem></SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold uppercase text-muted-foreground">Received Purity</Label>
                <Select value={purityKarat} onValueChange={handleKaratChange}>
                  <SelectTrigger className="h-9 text-xs border-border bg-muted/20"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="24K" className="text-xs">24K (99.9%)</SelectItem>
                    <SelectItem value="22K" className="text-xs">22K (91.6%)</SelectItem>
                    <SelectItem value="18K" className="text-xs">18K (75.0%)</SelectItem>
                    <SelectItem value="14K" className="text-xs">14K (58.3%)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold uppercase text-muted-foreground">Labor /g (₹)</Label>
                <Input type="number" className="h-9 text-xs border-border bg-muted/20" value={laborRate} onChange={(e) => setLaborRate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold uppercase text-muted-foreground">Batch Remarks</Label>
                <Input placeholder="Global notes..." className="h-9 text-xs border-border bg-muted/20" value={globalRemarks} onChange={(e) => setGlobalRemarks(e.target.value)} />
              </div>
            </div>
          </div>

          {/* Staged Items Grid */}
          <div className="bg-zinc-50/50 min-h-[150px]">
            {selectedItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
                <ArrowUpCircle className="w-8 h-8 text-zinc-300 mb-2" />
                <p className="text-xs font-medium">No items selected.</p>
                <p className="text-[10px]">Select items from the pending list below to stage them for receiving.</p>
              </div>
            ) : (
              <div className="overflow-x-auto max-h-[500px] custom-scrollbar">
                <table className="w-full text-sm">
                  <thead className="bg-white sticky top-0 z-10 border-b shadow-sm">
                    <tr>
                      <th className="p-3 text-center w-10"><CheckSquare className="w-4 h-4 text-primary mx-auto" /></th>
                      <th className="p-3 text-left text-[10px] font-black uppercase text-muted-foreground min-w-[140px]">Style Details</th>
                      <th className="p-3 text-left text-[10px] font-black uppercase text-muted-foreground bg-amber-50">Issued (Material)</th>
                      <th className="p-3 text-left text-[10px] font-black uppercase text-foreground bg-primary/10">Final Gross</th>
                      <th className="p-3 text-left text-[10px] font-black uppercase text-muted-foreground">Stones (Pcs/Ct)</th>
                      <th className="p-3 text-left text-[10px] font-black uppercase text-muted-foreground bg-green-50">Net & Loss</th>
                      <th className="p-3 text-left text-[10px] font-black uppercase text-muted-foreground border-l">Compliance</th>
                      <th className="p-3 text-left text-[10px] font-black uppercase text-muted-foreground">Specs / Notes</th>
                      <th className="p-3 text-left text-[10px] font-black uppercase text-amber-700 bg-amber-50/50">
                        <div className="flex items-center justify-between">
                          <span>Financials (₹)</span>
                          <Button variant="ghost" size="icon" onClick={handleOpenCalc} className="h-6 w-6 text-amber-600 hover:bg-amber-100 rounded-md bg-white border border-amber-200" title="Auto Calc MRP">
                            <Calculator className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedItems.map((item) => (
                      <tr key={item.job_bag_item_id} className="border-b border-border/40 hover:bg-white transition-colors bg-white">
                        <td className="p-3 text-center align-top">
                          <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full hover:bg-rose-100 hover:text-rose-600 text-zinc-400" onClick={() => toggleSelection(item.job_bag_item_id)}>
                            <ArrowDownCircle className="w-4 h-4" />
                          </Button>
                        </td>
                        <td className="p-3 font-medium text-xs text-foreground align-top">
                          <div className="font-bold">{item.sku_reference}</div>
                          <div className="text-[10px] text-muted-foreground">{item.ornament_type}</div>
                        </td>
                        <td className="p-3 font-bold text-xs bg-amber-50/50 align-top">
                          <div className="text-amber-700">{item.issuedGold.toFixed(3)}g <span className="text-[9px] font-normal text-zinc-500">Au</span></div>
                          {item.issuedDiamondCts > 0 && <div className="text-blue-600 mt-1">{item.issuedDiamondCts.toFixed(2)}ct</div>}
                        </td>
                        <td className="p-3 bg-primary/5 align-top">
                          <Input type="number" step="0.001" placeholder="0.000" className="h-8 w-24 text-xs font-bold border-primary/30 bg-white" value={item.grossWeight} onChange={(e) => updateBatchItem(item.job_bag_item_id, 'grossWeight', e.target.value)} />
                        </td>
                        <td className="p-3 align-top">
                          <div className="flex gap-1 mb-1">
                            <Input type="number" className="h-7 w-12 text-[11px] px-1 text-center" placeholder="Pcs" value={item.stonePieces} onChange={(e) => updateBatchItem(item.job_bag_item_id, 'stonePieces', e.target.value)} title="Pieces"/>
                            <Input type="number" step="0.01" className="h-7 w-16 text-[11px] px-1 text-center" placeholder="Cts" value={item.stoneWeight} onChange={(e) => updateBatchItem(item.job_bag_item_id, 'stoneWeight', e.target.value)} title="Carats"/>
                          </div>
                          <Input type="number" step="0.01" className="h-7 w-full max-w-[120px] text-[11px] border-red-200 text-red-600 bg-red-50/50" placeholder="Breakage (Ct)" value={item.breakageWeight} onChange={(e) => updateBatchItem(item.job_bag_item_id, 'breakageWeight', e.target.value)} title="Broken Carats"/>
                        </td>
                        <td className="p-3 align-top bg-green-50/30">
                          <div className="font-bold text-green-700 text-xs mb-1">{item.netWeight}g <span className="text-[9px] font-normal text-muted-foreground">NET</span></div>
                          <div className="font-bold text-red-600 text-xs">{item.lossWeight}g <span className="text-[9px] font-normal text-muted-foreground">LOSS</span></div>
                        </td>
                        <td className="p-3 border-l align-top">
                           <Input className="h-7 w-24 text-[10px] uppercase font-mono mb-1" placeholder="HUID CODE" value={item.huid_code} onChange={(e) => updateBatchItem(item.job_bag_item_id, 'huid_code', e.target.value)} maxLength={6} />
                           <Input className="h-7 w-24 text-[10px]" placeholder="HSN CODE" value={item.hsn_code} onChange={(e) => updateBatchItem(item.job_bag_item_id, 'hsn_code', e.target.value)} />
                        </td>
                        <td className="p-3 align-top">
                           <Input className="h-7 w-24 text-[11px] mb-1" placeholder="Size (e.g. 18)" value={item.item_size} onChange={(e) => updateBatchItem(item.job_bag_item_id, 'item_size', e.target.value)} />
                           <Input className="h-7 w-28 text-[10px]" placeholder="Item notes..." value={item.item_remarks} onChange={(e) => updateBatchItem(item.job_bag_item_id, 'item_remarks', e.target.value)} />
                        </td>
                        <td className="p-3 align-top bg-amber-50/30 border-l border-amber-100">
                          <div className="text-[10px] font-bold text-zinc-500 mb-1">Making: <span className="text-amber-700">₹{item.costMaking}</span></div>
                          <Input type="number" step="0.01" className="h-7 w-24 text-[11px] font-bold text-zinc-900 bg-white" placeholder="MRP (₹)" value={item.mrp} onChange={(e) => updateBatchItem(item.job_bag_item_id, 'mrp', e.target.value)} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </CardContent>
      </Card>


      {/* ========================================================
          STEP 2: AVAILABLE ITEMS (UNSELECTED)
          ======================================================== */}
      {unselectedItems.length > 0 && (
        <Card className="shadow-sm border-border/60 bg-card overflow-hidden">
          <CardHeader className="bg-secondary/30 py-3 px-4 border-b flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-muted-foreground" />
              <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">2. Available SKUs in Job Bag ({unselectedItems.length})</h3>
            </div>
            <Button variant="secondary" size="sm" onClick={() => selectAll(true)} className="h-7 text-xs font-bold">
              Select All Below
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto max-h-[400px] custom-scrollbar">
              <table className="w-full text-sm">
                <thead className="bg-zinc-50 sticky top-0 z-10 border-b">
                  <tr>
                    <th className="p-3 text-left text-[10px] font-black uppercase text-muted-foreground">Action</th>
                    <th className="p-3 text-left text-[10px] font-black uppercase text-muted-foreground">Style Details</th>
                    <th className="p-3 text-left text-[10px] font-black uppercase text-muted-foreground">Issued Au</th>
                    <th className="p-3 text-left text-[10px] font-black uppercase text-muted-foreground">Issued Dia</th>
                  </tr>
                </thead>
                <tbody>
                  {unselectedItems.map((item) => (
                    <tr key={item.job_bag_item_id} className="border-b border-border/40 hover:bg-secondary/20 transition-colors">
                      <td className="p-3">
                        <Button variant="outline" size="sm" className="h-8 px-3 text-[10px] font-bold text-primary hover:bg-primary/10 hover:text-primary" onClick={() => toggleSelection(item.job_bag_item_id)}>
                          <ArrowUpCircle className="w-3.5 h-3.5 mr-1.5" /> Stage Item
                        </Button>
                      </td>
                      <td className="p-3 font-medium text-xs text-foreground">
                        <div className="font-bold">{item.sku_reference}</div>
                        <div className="text-[10px] text-muted-foreground">{item.ornament_type}</div>
                      </td>
                      <td className="p-3 font-bold text-xs text-amber-700">{item.issuedGold.toFixed(3)}g</td>
                      <td className="p-3 font-bold text-xs text-blue-600">{item.issuedDiamondCts > 0 ? `${item.issuedDiamondCts.toFixed(2)}ct` : '--'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* ==============================================================
          MRP CALCULATOR MODAL (MULTI-STEP WIZARD)
          ============================================================== */}
      <Dialog open={isCalcModalOpen} onOpenChange={setCalcModalOpen}>
        <DialogContent className={cn("p-0 overflow-hidden border-slate-200 shadow-2xl rounded-xl bg-white transition-all", calcStep === 'preview' ? 'sm:max-w-[650px]' : 'sm:max-w-[450px]')}>
          <DialogHeader className="bg-slate-50 p-5 border-b border-slate-200">
            <DialogTitle className="text-base font-semibold text-slate-900 flex items-center gap-2">
               <Calculator className="w-4 h-4 text-indigo-600" /> 
               {calcStep === 'params' ? 'Dynamic MRP Parameters' : 'Verification & Preview'}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500 mt-1 leading-relaxed">
              {calcStep === 'params' 
                ? `System detected purity ${purityKarat} for the ${receiveItems.filter(i=>i.isSelected).length} staged items.`
                : `Review the calculated retail prices before applying them.`
              }
            </DialogDescription>
          </DialogHeader>

          {calcStep === 'params' ? (
            <div className="p-5 space-y-6">
              <div>
                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 border-b border-slate-100 pb-1">1. Variable Gold Rates</h4>
                <div className="grid grid-cols-2 gap-4">
                  {Object.entries(goldRates).map(([karat, rate]) => (
                    <div key={karat} className="space-y-1.5">
                      <Label className="text-xs font-bold text-slate-600 uppercase flex items-center gap-1.5">
                        <Database className="w-3 h-3 text-emerald-500" /> {karat} Rate/g
                      </Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">₹</span>
                        <Input 
                          type="number" 
                          className="pl-7 h-9 text-sm font-semibold border-slate-200 focus-visible:ring-indigo-500" 
                          value={rate} 
                          onChange={e => setGoldRates(prev => ({...prev, [karat]: Number(e.target.value)}))}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 border-b border-slate-100 pb-1">2. Formulation Constants</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-600 uppercase flex items-center gap-1.5">
                      <Gem className="w-3 h-3 text-blue-500" /> Diamond Rate / Ct
                    </Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">₹</span>
                      <Input 
                        type="number" 
                        className="pl-7 h-9 text-sm font-semibold border-slate-200 focus-visible:ring-indigo-500" 
                        value={calcParams.diamondRatePerCt} 
                        onChange={e => setCalcParams({...calcParams, diamondRatePerCt: Number(e.target.value)})}
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-600 uppercase flex items-center gap-1.5">
                      <Hammer className="w-3 h-3 text-amber-500" /> Markup Margin
                    </Label>
                    <div className="relative">
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">%</span>
                      <Input 
                        type="number" 
                        className="pr-7 h-9 text-sm font-semibold border-slate-200 focus-visible:ring-indigo-500" 
                        value={calcParams.markupPercent} 
                        onChange={e => setCalcParams({...calcParams, markupPercent: Number(e.target.value)})}
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-600 uppercase">
                       Flat Addition (Chg.)
                    </Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">₹</span>
                      <Input 
                        type="number" 
                        className="pl-7 h-9 text-sm font-semibold border-slate-200 focus-visible:ring-indigo-500" 
                        value={calcParams.flatCharge} 
                        onChange={e => setCalcParams({...calcParams, flatCharge: Number(e.target.value)})}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-[10px] text-slate-500 font-mono leading-relaxed">
                <span className="font-bold text-slate-700">Formula Engine:</span><br/>
                1. Base = (NetWt × KaratRate) + (DiaCt × DiaRate)<br/>
                2. Subtotal = Base + (Base × {calcParams.markupPercent}%)<br/>
                3. Final MRP = Math.round(Subtotal + ₹{calcParams.flatCharge})
              </div>
            </div>
          ) : (
            <div className="max-h-[60vh] overflow-y-auto border-b border-slate-200 custom-scrollbar">
              <Table>
                <TableHeader className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                  <TableRow className="border-none hover:bg-transparent">
                    <TableHead className="text-[10px] font-bold uppercase text-slate-500 h-9">Asset Ref</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase text-slate-500 h-9">Purity</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase text-slate-500 h-9 text-right">Net Wt</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase text-slate-500 h-9 text-right">Current MRP</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase text-indigo-600 h-9 text-right pr-6">Calculated MRP</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewData.map((item) => {
                    const isDiff = item.mrp !== item.newMrp.toString();
                    return (
                      <TableRow key={item.job_bag_item_id} className="border-b border-slate-100 last:border-none">
                        <TableCell className="py-2.5 font-mono text-xs font-semibold text-slate-900">{item.barcode}</TableCell>
                        <TableCell className="py-2.5 text-xs text-slate-600">{purityKarat}</TableCell>
                        <TableCell className="py-2.5 text-xs text-right font-medium">{item.netWeight}g</TableCell>
                        <TableCell className="py-2.5 text-xs text-right text-slate-400 line-through">
                          {item.mrp ? `₹${Number(item.mrp).toLocaleString()}` : '---'}
                        </TableCell>
                        <TableCell className="py-2.5 text-sm font-bold text-right pr-6 text-slate-900">
                          {isDiff && <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 mr-2" />}
                          ₹{item.newMrp.toLocaleString()}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          <DialogFooter className="bg-slate-50 p-4 border-t border-slate-200 flex-row gap-3">
             {calcStep === 'params' ? (
               <>
                 <Button variant="outline" className="flex-1 h-10 text-xs font-semibold rounded-lg border-slate-300 text-slate-700 bg-white hover:bg-slate-50" onClick={() => setCalcModalOpen(false)}>
                   Cancel
                 </Button>
                 <Button 
                    onClick={handleGeneratePreview}
                    className="flex-[2] h-10 text-xs font-bold rounded-lg bg-slate-900 hover:bg-slate-800 text-white shadow-sm"
                  >
                   Generate Preview <ArrowRight className="w-3.5 h-3.5 ml-2" />
                 </Button>
               </>
             ) : (
               <>
                 <Button variant="outline" className="flex-1 h-10 text-xs font-semibold rounded-lg border-slate-300 text-slate-700 bg-white hover:bg-slate-50" onClick={() => setCalcStep('params')}>
                   <ArrowLeft className="w-3.5 h-3.5 mr-2" /> Adjust Rates
                 </Button>
                 <Button 
                    onClick={handleApplyBulkMrp}
                    className="flex-[2] h-10 text-xs font-bold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
                  >
                   <Check className="w-4 h-4 mr-2" /> Apply MRP to Forms
                 </Button>
               </>
             )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}