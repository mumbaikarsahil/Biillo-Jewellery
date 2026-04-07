"use client"

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
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
import { Badge } from '@/components/ui/badge'
import { 
  Save, Layers, Settings2, RefreshCw, CheckCircle2, 
  ArrowUpCircle, ArrowDownCircle, CheckSquare,
  Calculator, Database, Gem, Hammer, ArrowRight, ArrowLeft, Check, Box,
  UploadCloud, Image as ImageIcon, Camera 
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
  barcode: string
  grossWeight: string
  solitairePieces: string
  solitaireWeight: string
  meleePieces: string
  meleeWeight: string
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
  metalColor: string
  diamondShape: string
  diamondColor: string
  diamondClarity: string
  custom_order_id: string | null 
  repair_ticket_id: string | null // <--- NEW: Tracks origin repair ticket
  is_repair: boolean // <--- NEW: Determines routing logic
  // --- NEW UI STATES FOR MANUAL ENTRY ---
  showCustomMetal: boolean
  showCustomShape: boolean
  showCustomColor: boolean
  showCustomClarity: boolean
  imageFile: File | null
  imagePreview: string
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

  const [poolStats, setPoolStats] = useState({
    issuedGold: 0,
    issuedDiaCts: 0,
    consumedGold: 0 
  })

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

  // --- STANDARD JEWELRY DICTIONARIES ---
  const DIAMOND_SHAPES = ['Round', 'Princess', 'Oval', 'Marquise', 'Emerald', 'Pear', 'Cushion', 'Radiant', 'Heart', 'Asscher']
  const DIAMOND_COLORS = ['D', 'E', 'F', 'G', 'H', 'I', 'J', 'EF', 'FG', 'GH', 'HI', 'IJ', 'Fancy']
  const DIAMOND_CLARITIES = ['FL', 'IF', 'VVS1', 'VVS2', 'VVS', 'VS1', 'VS2', 'VS', 'SI1', 'SI2', 'SI', 'I1', 'I2', 'I3']

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
      const { data: gIssues } = await supabase.from('job_bag_gold_issues').select('issued_weight_g').eq('job_bag_id', jobId)
      const totalBagGold = gIssues?.reduce((sum, row) => sum + Number(row.issued_weight_g), 0) || 0

      const { data: dIssues } = await supabase.from('job_bag_diamond_issues').select('issued_weight_cts').eq('job_bag_id', jobId)
      const totalBagDia = dIssues?.reduce((sum, row) => sum + Number(row.issued_weight_cts), 0) || 0

      const { data: rItems } = await supabase.from('job_bag_items').select('actual_gross_weight_g, calculated_loss_g').eq('job_bag_id', jobId).eq('status', 'received')
      const consumedGold = rItems?.reduce((sum, row) => sum + Number(row.actual_gross_weight_g || 0) + Number(row.calculated_loss_g || 0), 0) || 0

      setPoolStats({ issuedGold: totalBagGold, issuedDiaCts: totalBagDia, consumedGold })

      const jobPrefix = jobId.split('-')[0].substring(0, 4).toUpperCase()

      // FETCH ADDED: repair_ticket_id & is_repair
      const { data: items, error } = await supabase
        .from('job_bag_items')
        .select(`
          id, sku_reference, ornament_type, status, custom_order_id, repair_ticket_id, is_repair,
          job_bags ( product_category )
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
        const category = item.job_bags?.product_category || item.ornament_type || 'Jewelry'
        const categoryPrefix = category.substring(0, 3).toUpperCase()
        const currentSeq = (index + 1).toString().padStart(2, '0')

        return {
          job_bag_item_id: item.id,
          sku_reference: item.sku_reference,
          ornament_type: item.ornament_type || 'N/A', 
          category: category,
          // Generates a clean, short 6-digit Item Code (e.g., ITM-492018)
          barcode: `ITM-${Math.floor(100000 + Math.random() * 900000)}`,
          grossWeight: '',
          stonePieces: '',
          stoneWeight: '',
          solitairePieces: '',
          solitaireWeight: '',
          meleePieces: '',
          meleeWeight: '',
          breakageWeight: '',
          netWeight: '0',
          lossWeight: '0', 
          costMaking: '0',
          mrp: '',
          item_size: '',
          hsn_code: '',
          huid_code: '',
          item_remarks: '',
          metalColor: 'Yellow Gold',
          diamondShape: '',
          diamondColor: '',
          diamondClarity: '',
          custom_order_id: item.custom_order_id || null, 
          repair_ticket_id: item.repair_ticket_id || null, 
          is_repair: item.is_repair || false, 
          showCustomMetal: false,
          showCustomShape: false,
          showCustomColor: false,
          showCustomClarity: false,
          imageFile: null,
          imagePreview: '',
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

  const handleKaratChange = (val: string) => {
    setPurityKarat(val)
    if (val === '24K') setPurityPercent('99.9')
    if (val === '22K') setPurityPercent('91.6')
    if (val === '18K') setPurityPercent('75.0')
    if (val === '14K') setPurityPercent('58.3')
  }

  useEffect(() => { loadJobBagItems() }, [loadJobBagItems])

  const updateBatchItem = (id: string, field: keyof ReceiveItem, value: any) => {
    setReceiveItems(prev => prev.map(item => {
      if (item.job_bag_item_id !== id) return item;
  
      const updated = { ...item, [field]: value }
  
      // --- NEW: AUTO-SUM BREAKUP INTO MAIN TOTALS ---
      if (field === 'solitairePieces' || field === 'meleePieces') {
        const solP = parseInt(field === 'solitairePieces' ? value : updated.solitairePieces) || 0;
        const melP = parseInt(field === 'meleePieces' ? value : updated.meleePieces) || 0;
        updated.stonePieces = (solP + melP).toString();
      }
      if (field === 'solitaireWeight' || field === 'meleeWeight') {
        const solW = parseFloat(field === 'solitaireWeight' ? value : updated.solitaireWeight) || 0;
        const melW = parseFloat(field === 'meleeWeight' ? value : updated.meleeWeight) || 0;
        updated.stoneWeight = (solW + melW).toFixed(2);
      }
      // ----------------------------------------------

      // Standard Jewelry Math (Notice we check 'stoneWeight' here too)
      if (!item.is_repair && (field === 'grossWeight' || field === 'stoneWeight' || field === 'solitaireWeight' || field === 'meleeWeight')) {
        const gw = parseFloat(field === 'grossWeight' ? value : updated.grossWeight) || 0
        const sw = parseFloat(updated.stoneWeight) || 0 // Always use the current total stoneWeight
        const lr = parseFloat(laborRate) || 0
        
        // 1 Carat = 0.2 Grams
        const totalStoneGrams = sw * 0.2;
        const calculatedNet = Math.max(0, gw - totalStoneGrams);
        
        updated.netWeight = calculatedNet.toFixed(3)
        updated.costMaking = (calculatedNet * lr).toFixed(2)
      } 
      // Repair Math
      else if (item.is_repair && field === 'grossWeight') {
        updated.netWeight = value; 
      }
      
      return updated;
    }))
  }
  const handleImageChange = (id: string, e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0]
      updateBatchItem(id, 'imageFile', file)
      updateBatchItem(id, 'imagePreview', URL.createObjectURL(file))
    }
  }

  const toggleSelection = (id: string) => {
    setReceiveItems(prev => prev.map(item => 
      item.job_bag_item_id === id ? { ...item, isSelected: !item.isSelected } : item
    ))
  }

  const selectAll = (select: boolean) => {
    setReceiveItems(prev => prev.map(item => ({ ...item, isSelected: select })))
  }

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
        
        let finalImageUrl = null;
        if (item.imageFile) {
          const fileExt = item.imageFile.name.split('.').pop()
          const fileName = `${item.sku_reference}-${Date.now()}.${fileExt}`
          
          const { error: uploadError } = await supabase.storage
            .from('inventory-images') 
            .upload(fileName, item.imageFile, { upsert: true })

          if (!uploadError) {
            const { data: publicUrlData } = supabase.storage
              .from('inventory-images') 
              .getPublicUrl(fileName)
            finalImageUrl = publicUrlData.publicUrl
          } else {
            console.error("Image Upload Error:", uploadError)
            toast.error(`Failed to upload image for ${item.sku_reference}`)
          }
        }

        let combinedRemarks = globalRemarks ? `[Batch] ${globalRemarks}` : '';
        if (item.item_remarks) combinedRemarks += ` | [Item] ${item.item_remarks}`;
        if (item.breakageWeight && Number(item.breakageWeight) > 0) {
          combinedRemarks += ` | Broken Stone: ${item.breakageWeight}ct`;
        }

        let diamondSpecs = []
        if (item.diamondShape) diamondSpecs.push(item.diamondShape)
        if (item.diamondColor) diamondSpecs.push(`Color: ${item.diamondColor}`)
        if (item.diamondClarity) diamondSpecs.push(`Clarity: ${item.diamondClarity}`)
        const formattedDiamondLabel = diamondSpecs.length > 0 ? diamondSpecs.join(' | ') : null;

        // ==========================================
        // THE FORK IN THE ROAD: Asset vs. Liability
        // ==========================================
        if (item.is_repair && item.repair_ticket_id) {
          // --- PATH A: REPAIR (Bypass Inventory) ---
          
          const finalBillableAmount = item.mrp ? Number(item.mrp) : Number(item.costMaking);

          const { error: repError } = await supabase.from('repair_tickets').update({
            status: 'fixed_ready_for_dispatch',
            actual_cost: finalBillableAmount, 
            // --- NEW: SAVE THE CONSUMED MATERIALS AND LABOR ---
            issued_gold_g: Number(item.grossWeight) || 0, 
            issued_diamond_cts: Number(item.stoneWeight) || 0,
            labor_charges: Number(item.costMaking) || 0,
            // --------------------------------------------------
            updated_at: new Date().toISOString()
          }).eq('id', item.repair_ticket_id)

          if (repError) throw new Error(`Repair Update Error (${item.sku_reference}): ${repError.message}`)

        } else {
          // --- PATH B: STANDARD INVENTORY / CUSTOM ORDER ---

          const solW = Number(item.solitaireWeight) || 0;
          const melW = Number(item.meleeWeight) || 0;
          const solP = Number(item.solitairePieces) || 0;
          const melP = Number(item.meleePieces) || 0;
          
          const { error: invError } = await supabase.from('inventory_items').insert({
            company_id: companyId,
            warehouse_id: selectedWarehouseId,
            created_from_job_bag_id: jobId,
            created_from_job_bag_item_id: item.job_bag_item_id,
            custom_order_id: item.custom_order_id || null,
            is_custom_order: !!item.custom_order_id,
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
            total_stone_weight_cts: solW + melW,
            total_stone_pieces: solP + melP,
            solitaire_weight_cts: solW,
            solitaire_pieces: solP,
            melee_weight_cts: melW,
            melee_pieces: melP,
            wastage_weight_g: Number(item.lossWeight), 
            cost_making: Number(item.costMaking),
            mrp: item.mrp ? Number(item.mrp) : null,
            created_by: userId,
            updated_by: userId,
            item_size: item.item_size || null,
            hsn_code: item.hsn_code || null,
            huid_code: item.huid_code ? item.huid_code.toUpperCase() : null,
            label_1: item.metalColor ? `Metal: ${item.metalColor}` : null,
            label_2: formattedDiamondLabel,
            image_url: finalImageUrl, 
            metal_color: item.metalColor || null,
            diamond_shape: item.diamondShape || null,
            diamond_color: item.diamondColor || null,
            diamond_clarity: item.diamondClarity || null
          })

          if (invError) {
            if (invError.code === '23505' && invError.message.includes('huid')) {
               throw new Error(`HUID Code ${item.huid_code} is already registered.`);
            }
            throw new Error(`Inventory Insert Error (${item.sku_reference}): ${invError.message}`)
          }
        }

        // --- ALWAYS UPDATE JOB BAG ITEM STATUS ---
        const { error: jobItemError } = await supabase.from('job_bag_items').update({
          status: 'received',
          actual_gross_weight_g: Number(item.grossWeight),
          calculated_loss_g: Number(item.lossWeight),
          updated_at: new Date().toISOString()
        }).eq('id', item.job_bag_item_id)

        if (jobItemError) throw new Error(`Update Status Error: ${jobItemError.message}`)
      }

      toast.success(`Successfully processed ${selectedItems.length} items!`)
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

      <div className="grid grid-cols-3 gap-4">
        <Card className="bg-amber-50/50 border-amber-100 shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-amber-600 mb-1">Total Bag Gold</p>
              <p className="text-2xl font-black text-amber-700">{poolStats.issuedGold.toFixed(3)}g</p>
            </div>
            <Database className="h-8 w-8 text-amber-200" />
          </CardContent>
        </Card>
        <Card className="bg-blue-50/50 border-blue-100 shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-blue-600 mb-1">Total Bag Diamonds</p>
              <p className="text-2xl font-black text-blue-700">{poolStats.issuedDiaCts.toFixed(2)}ct</p>
            </div>
            <Gem className="h-8 w-8 text-blue-200" />
          </CardContent>
        </Card>
        <Card className="bg-slate-50 border-slate-200 shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Pool Consumed (Gold)</p>
              <p className="text-2xl font-black text-slate-700">{poolStats.consumedGold.toFixed(3)}g</p>
            </div>
            <Box className="h-8 w-8 text-slate-200" />
          </CardContent>
        </Card>
      </div>
      
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

          <div className="bg-zinc-50/50 min-h-[150px]">
            {selectedItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
                <ArrowUpCircle className="w-8 h-8 text-zinc-300 mb-2" />
                <p className="text-xs font-medium">No items selected.</p>
                <p className="text-[10px]">Select items from the pending list below to stage them for receiving.</p>
              </div>
            ) : (
              <div className="overflow-x-auto max-h-[600px] custom-scrollbar">
                <Table className="w-full text-sm min-w-[950px]">
                  <thead className="bg-white sticky top-0 z-20 border-b shadow-sm">
                    <tr>
                      <th className="p-2 text-center w-10"><CheckSquare className="w-4 h-4 text-primary mx-auto" /></th>
                      <th className="p-2 text-center text-[10px] font-black uppercase text-muted-foreground w-20">Photo</th>
                      <th className="p-2 text-left text-[10px] font-black uppercase text-muted-foreground w-40">Identity & Compliance</th>
                      <th className="p-2 text-left text-[10px] font-black uppercase text-amber-700 bg-amber-50/50 w-36">Metal Specs (g)</th>
                      <th className="p-2 text-left text-[10px] font-black uppercase text-blue-700 bg-blue-50/50 w-52">Stone Specs</th>
                      <th className="p-2 text-left text-[10px] font-black uppercase text-emerald-700 bg-emerald-50/50 w-44">
                        <div className="flex items-center justify-between pr-2">
                          <span>Pricing & Notes</span>
                          <Button variant="ghost" size="icon" onClick={handleOpenCalc} className="h-6 w-6 text-emerald-600 hover:bg-emerald-100 rounded-md bg-white border border-emerald-200 shrink-0" title="Auto Calc MRP">
                            <Calculator className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {selectedItems.map((item) => (
                      <tr key={item.job_bag_item_id} className="hover:bg-white transition-colors bg-white">
                        
                        <td className="p-3 text-center align-middle">
                          <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full hover:bg-rose-100 hover:text-rose-600 text-zinc-400" onClick={() => toggleSelection(item.job_bag_item_id)}>
                            <ArrowDownCircle className="w-4 h-4" />
                          </Button>
                        </td>

                        <td className="p-3 align-middle text-center">
                          {item.imagePreview ? (
                            <div className="relative mx-auto w-14 h-14 rounded-md overflow-hidden group border border-slate-200">
                              <img src={item.imagePreview} alt="preview" className="w-full h-full object-cover" />
                              <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <label htmlFor={`file-${item.job_bag_item_id}`} className="cursor-pointer text-white hover:text-primary transition-colors flex items-center w-full h-full justify-center">
                                  <UploadCloud className="w-5 h-5" />
                                </label>
                                <input id={`file-${item.job_bag_item_id}`} type="file" className="hidden" accept="image/*" onChange={(e) => handleImageChange(item.job_bag_item_id, e)} />
                              </div>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center justify-center gap-1.5">
                              <label htmlFor={`upload-${item.job_bag_item_id}`} className="cursor-pointer flex items-center justify-center w-full h-7 border border-dashed border-slate-300 rounded bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-primary transition-colors text-[10px] font-medium gap-1" title="Upload Image">
                                <UploadCloud className="w-3 h-3" /> File
                              </label>
                              <input id={`upload-${item.job_bag_item_id}`} type="file" className="hidden" accept="image/*" onChange={(e) => handleImageChange(item.job_bag_item_id, e)} />
                              
                              <label htmlFor={`cam-${item.job_bag_item_id}`} className="cursor-pointer flex items-center justify-center w-full h-7 border border-dashed border-slate-300 rounded bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-primary transition-colors text-[10px] font-medium gap-1" title="Take Photo">
                                <Camera className="w-3 h-3" /> Cam
                              </label>
                              <input 
                                id={`cam-${item.job_bag_item_id}`} 
                                type="file" 
                                accept="image/*" 
                                capture="environment" 
                                className="hidden" 
                                onChange={(e) => handleImageChange(item.job_bag_item_id, e)} 
                                onClick={(e) => e.stopPropagation()} // Prevents table row clicks from interfering
                              />
                            </div>
                          )}
                        </td>

                        <td className="p-3 align-top">
  {/* 1. READ-ONLY SKU (The Design Template) */}
  <div className="flex items-center gap-2 mb-1.5">
    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">SKU:</span>
    <span className="font-bold text-xs text-slate-900 leading-tight">{item.sku_reference}</span>
    {item.custom_order_id && <Badge className="bg-purple-100 text-purple-700 text-[8px] uppercase tracking-widest border-purple-200 px-1.5">Custom</Badge>}
    {item.is_repair && <Badge className="bg-amber-100 text-amber-700 text-[8px] uppercase tracking-widest border-amber-200 px-1.5">Repair</Badge>}
  </div>
  
  <div className="text-[10px] text-muted-foreground mb-3">{item.ornament_type}</div>
  
  <div className="space-y-2">
    {/* 2. EDITABLE ITEM CODE / BARCODE (The Physical Asset) */}
    <div className="space-y-1">
      <Label className="text-[9px] font-bold text-indigo-600 uppercase tracking-wider">Item Code / Barcode</Label>
      <Input 
        className="h-7 w-full text-xs font-mono font-bold px-2 bg-indigo-50/50 border-indigo-200 focus-visible:ring-indigo-500 text-indigo-900 shadow-inner" 
        placeholder="Scan or Type..." 
        value={item.barcode} 
        onChange={(e) => updateBatchItem(item.job_bag_item_id, 'barcode', e.target.value)} 
        title="Scan your barcode tag here, or use the auto-generated ID"
      />
    </div>

    {/* 3. COMPLIANCE & SIZING */}
    <Input 
      className="h-6 w-full text-[10px] uppercase font-mono px-2 bg-slate-50 border-slate-200 placeholder:text-slate-400" 
      placeholder="HUID CODE (6 Digits)" 
      value={item.huid_code} 
      onChange={(e) => updateBatchItem(item.job_bag_item_id, 'huid_code', e.target.value)} 
      maxLength={6} 
    />
    <div className="flex gap-1.5">
      <Input 
        className="h-6 w-1/2 text-[10px] px-2 bg-slate-50 border-slate-200" 
        placeholder="Size" 
        value={item.item_size} 
        onChange={(e) => updateBatchItem(item.job_bag_item_id, 'item_size', e.target.value)} 
      />
      <Input 
        className="h-6 w-1/2 text-[10px] px-2 bg-slate-50 border-slate-200" 
        placeholder="HSN" 
        value={item.hsn_code} 
        onChange={(e) => updateBatchItem(item.job_bag_item_id, 'hsn_code', e.target.value)} 
      />
    </div>
  </div>
</td>

                        <td className="p-3 bg-amber-50/20 align-top border-l border-amber-100/50">
                          <div className="space-y-1.5">
                            {/* DYNAMIC GOLD LABEL */}
                            <div className="flex items-center gap-2">
                              <Label className={cn("text-[9px] font-bold uppercase w-8 shrink-0", item.is_repair ? "text-amber-600" : "text-slate-500")}>
                                {item.is_repair ? "Add Gold" : "Gross"}
                              </Label>
                              <Input 
                                type="number" step="0.001" 
                                placeholder={item.is_repair ? "Added (g)" : "0.000"} 
                                className="h-6 w-full text-[11px] font-bold border-amber-200 focus-visible:ring-amber-400 bg-white px-2" 
                                value={item.grossWeight} 
                                onChange={(e) => updateBatchItem(item.job_bag_item_id, 'grossWeight', e.target.value)} 
                              />
                            </div>

                            {/* DYNAMIC LOSS LABEL */}
                            <div className="flex items-center gap-2">
                              <Label className="text-[9px] font-bold text-red-500 uppercase w-8 shrink-0">Loss</Label>
                              <Input 
                                type="number" step="0.001" placeholder="0.000" 
                                className="h-6 w-full text-[11px] font-bold border-red-200 text-red-600 focus-visible:ring-red-400 bg-white px-2" 
                                value={item.lossWeight} 
                                onChange={(e) => updateBatchItem(item.job_bag_item_id, 'lossWeight', e.target.value)} 
                              />
                            </div>

                            {/* DYNAMIC NET LABEL */}
                            {!item.is_repair && (
                              <div className="flex items-center gap-2 mb-1">
                                <Label className="text-[9px] font-bold text-green-600 uppercase w-8 shrink-0">Net</Label>
                                <div className="h-6 flex items-center px-2 text-[11px] font-black text-green-700">{item.netWeight}g</div>
                              </div>
                            )}
                            
                            {/* METAL COLOR SMART SELECTOR */}
                            {!item.showCustomMetal ? (
                               <Select value={item.metalColor} onValueChange={(v) => {
                                 if (v === 'Other') {
                                   updateBatchItem(item.job_bag_item_id, 'showCustomMetal', true)
                                   updateBatchItem(item.job_bag_item_id, 'metalColor', '')
                                 } else {
                                   updateBatchItem(item.job_bag_item_id, 'metalColor', v)
                                 }
                               }}>
                                 <SelectTrigger className="h-6 w-full text-[10px] bg-white px-2 border-slate-200"><SelectValue placeholder="Color" /></SelectTrigger>
                                 <SelectContent>
                                   <SelectItem value="Yellow Gold" className="text-[10px]">Yellow Gold</SelectItem>
                                   <SelectItem value="Rose Gold" className="text-[10px]">Rose Gold</SelectItem>
                                   <SelectItem value="White Gold" className="text-[10px]">White Gold</SelectItem>
                                   <SelectItem value="Two-Tone" className="text-[10px]">Two-Tone</SelectItem>
                                   <SelectItem value="Other" className="text-[10px] font-bold text-primary">Other (Type)</SelectItem>
                                 </SelectContent>
                               </Select>
                            ) : (
                               <div className="flex gap-1 h-6">
                                 <Input className="h-6 w-full text-[10px] px-2 bg-white" placeholder="Custom Metal" value={item.metalColor} onChange={(e) => updateBatchItem(item.job_bag_item_id, 'metalColor', e.target.value)} />
                                 <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-400 shrink-0" onClick={() => updateBatchItem(item.job_bag_item_id, 'showCustomMetal', false)}><ArrowLeft className="h-3 w-3" /></Button>
                               </div>
                            )}
                          </div>
                        </td>

                        <td className="p-3 bg-blue-50/10 align-top border-l border-blue-100/50 min-w-[200px]">
  <div className="space-y-2">
    
    {/* MAIN MANUAL ENTRY + GLASSMORPHISM POPOVER BUTTON */}
    <div className="flex gap-1 items-center relative">
      <Input 
        type="number" className="h-6 w-[40%] text-[10px] px-2 bg-white" 
        placeholder="Pcs" 
        value={item.stonePieces} 
        onChange={(e) => updateBatchItem(item.job_bag_item_id, 'stonePieces', e.target.value)} 
      />
      <Input 
        type="number" step="0.01" className="h-6 w-[40%] text-[10px] px-2 bg-white font-bold" 
        placeholder="Cts" 
        value={item.stoneWeight} 
        onChange={(e) => updateBatchItem(item.job_bag_item_id, 'stoneWeight', e.target.value)} 
      />
      
      <Popover>
        <PopoverTrigger asChild>
          <Button 
            variant="outline" 
            size="icon" 
            className={cn(
              "h-6 w-[20%] transition-all", 
              (Number(item.solitaireWeight) > 0 || Number(item.meleeWeight) > 0) 
                ? "bg-blue-600 text-white border-blue-700 hover:bg-blue-700 shadow-inner" 
                : "bg-white text-blue-600 border-blue-200 hover:bg-blue-50"
            )}
            title="Advanced Diamond Breakup"
          >
            <Layers className="w-3 h-3" />
          </Button>
        </PopoverTrigger>
        <PopoverContent 
          side="left" 
          align="start"
          className="w-72 p-4 bg-white/70 backdrop-blur-xl border border-white/50 shadow-[0_8px_30px_rgb(0,0,0,0.12)] rounded-2xl ring-1 ring-black/5 z-50"
        >
          <div className="space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-200/50 pb-2">
              <Gem className="w-4 h-4 text-blue-600" />
              <h4 className="text-xs font-black uppercase tracking-widest text-slate-800">Stone Breakup</h4>
            </div>
            
            {/* Solitaire Input */}
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold text-slate-500 uppercase">Solitaire / Center Stone</Label>
              <div className="flex gap-2">
                <Input type="number" placeholder="Pieces" className="h-8 text-xs bg-white/50 border-slate-200" value={item.solitairePieces} onChange={(e) => updateBatchItem(item.job_bag_item_id, 'solitairePieces', e.target.value)} />
                <Input type="number" step="0.01" placeholder="Carats" className="h-8 text-xs font-bold text-blue-700 bg-white/50 border-slate-200" value={item.solitaireWeight} onChange={(e) => updateBatchItem(item.job_bag_item_id, 'solitaireWeight', e.target.value)} />
              </div>
            </div>

            {/* Melee Input */}
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold text-slate-500 uppercase">Melee / Side Stones</Label>
              <div className="flex gap-2">
                <Input type="number" placeholder="Pieces" className="h-8 text-xs bg-white/50 border-slate-200" value={item.meleePieces} onChange={(e) => updateBatchItem(item.job_bag_item_id, 'meleePieces', e.target.value)} />
                <Input type="number" step="0.01" placeholder="Carats" className="h-8 text-xs font-bold text-blue-700 bg-white/50 border-slate-200" value={item.meleeWeight} onChange={(e) => updateBatchItem(item.job_bag_item_id, 'meleeWeight', e.target.value)} />
              </div>
            </div>

            <div className="pt-2 border-t border-slate-200/50 flex justify-between items-center">
              <span className="text-[10px] font-medium text-slate-500">Auto-calculates main totals.</span>
              <Badge variant="secondary" className="bg-blue-100 text-blue-700 hover:bg-blue-100 border-none font-mono text-[10px]">
                {item.stoneWeight || "0.00"} ct
              </Badge>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>

    {/* BREAKAGE */}
    <Input 
      type="number" step="0.01" 
      className="h-6 w-full text-[10px] px-2 bg-red-50 text-red-600 border-red-200 placeholder:text-red-300" 
      placeholder="Broken Carats (Brk Ct)" 
      value={item.breakageWeight} 
      onChange={(e) => updateBatchItem(item.job_bag_item_id, 'breakageWeight', e.target.value)} 
      title="Broken Carats"
    />

    {/* DIAMOND SHAPE SMART SELECTOR */}
    {!item.showCustomShape ? (
       <Select value={item.diamondShape} onValueChange={(v) => {
         if (v === 'Other') { updateBatchItem(item.job_bag_item_id, 'showCustomShape', true); updateBatchItem(item.job_bag_item_id, 'diamondShape', ''); }
         else { updateBatchItem(item.job_bag_item_id, 'diamondShape', v); }
       }}>
         <SelectTrigger className="h-6 w-full text-[10px] bg-white px-2"><SelectValue placeholder="Shape" /></SelectTrigger>
         <SelectContent>
           {DIAMOND_SHAPES.map(s => <SelectItem key={s} value={s} className="text-[10px]">{s}</SelectItem>)}
           <SelectItem value="Other" className="text-[10px] font-bold text-primary">Other (Type)</SelectItem>
         </SelectContent>
       </Select>
    ) : (
       <div className="flex gap-1 h-6">
         <Input className="h-6 w-full text-[10px] px-2 bg-white" placeholder="Custom Shape" value={item.diamondShape} onChange={(e) => updateBatchItem(item.job_bag_item_id, 'diamondShape', e.target.value)} />
         <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-400 shrink-0" onClick={() => updateBatchItem(item.job_bag_item_id, 'showCustomShape', false)}><ArrowLeft className="h-3 w-3" /></Button>
       </div>
    )}

    <div className="flex gap-1.5">
       {/* DIAMOND COLOR SMART SELECTOR */}
       {!item.showCustomColor ? (
         <Select value={item.diamondColor} onValueChange={(v) => {
           if (v === 'Other') { updateBatchItem(item.job_bag_item_id, 'showCustomColor', true); updateBatchItem(item.job_bag_item_id, 'diamondColor', ''); }
           else { updateBatchItem(item.job_bag_item_id, 'diamondColor', v); }
         }}>
           <SelectTrigger className="h-6 w-1/2 text-[10px] bg-white px-1"><SelectValue placeholder="Color" /></SelectTrigger>
           <SelectContent>
             {DIAMOND_COLORS.map(c => <SelectItem key={c} value={c} className="text-[10px]">{c}</SelectItem>)}
             <SelectItem value="Other" className="text-[10px] font-bold text-primary">Other</SelectItem>
           </SelectContent>
         </Select>
       ) : (
         <div className="flex w-1/2 gap-0.5 h-6">
           <Input className="h-6 w-full text-[10px] px-1 bg-white" placeholder="Color" value={item.diamondColor} onChange={(e) => updateBatchItem(item.job_bag_item_id, 'diamondColor', e.target.value)} />
           <Button variant="ghost" size="icon" className="h-6 w-5 text-slate-400 shrink-0" onClick={() => updateBatchItem(item.job_bag_item_id, 'showCustomColor', false)}><ArrowLeft className="h-3 w-3" /></Button>
         </div>
       )}

       {/* DIAMOND CLARITY SMART SELECTOR */}
       {!item.showCustomClarity ? (
         <Select value={item.diamondClarity} onValueChange={(v) => {
           if (v === 'Other') { updateBatchItem(item.job_bag_item_id, 'showCustomClarity', true); updateBatchItem(item.job_bag_item_id, 'diamondClarity', ''); }
           else { updateBatchItem(item.job_bag_item_id, 'diamondClarity', v); }
         }}>
           <SelectTrigger className="h-6 w-1/2 text-[10px] bg-white px-1"><SelectValue placeholder="Clarity" /></SelectTrigger>
           <SelectContent>
             {DIAMOND_CLARITIES.map(c => <SelectItem key={c} value={c} className="text-[10px]">{c}</SelectItem>)}
             <SelectItem value="Other" className="text-[10px] font-bold text-primary">Other</SelectItem>
           </SelectContent>
         </Select>
       ) : (
         <div className="flex w-1/2 gap-0.5 h-6">
           <Input className="h-6 w-full text-[10px] px-1 bg-white" placeholder="Clarity" value={item.diamondClarity} onChange={(e) => updateBatchItem(item.job_bag_item_id, 'diamondClarity', e.target.value)} />
           <Button variant="ghost" size="icon" className="h-6 w-5 text-slate-400 shrink-0" onClick={() => updateBatchItem(item.job_bag_item_id, 'showCustomClarity', false)}><ArrowLeft className="h-3 w-3" /></Button>
         </div>
       )}
    </div>
  </div>
</td>

<td className="p-3 bg-emerald-50/10 align-top border-l border-emerald-100/50 min-w-[160px]">
  <div className="space-y-2.5">
    
    {/* 1. MAKING CHARGE / LABOR (Auto-calculated or Manual for repairs) */}
    <div className="flex items-center justify-between border-b border-emerald-100/50 pb-1.5">
      <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">
        {item.is_repair ? "Labor Fee:" : "Making Chg:"}
      </span>
      {item.is_repair ? (
        <Input 
          type="number" 
          className="h-6 w-16 text-[10px] font-black text-emerald-700 bg-white border-emerald-200 px-1 text-right focus-visible:ring-emerald-500" 
          value={item.costMaking} 
          onChange={(e) => updateBatchItem(item.job_bag_item_id, 'costMaking', e.target.value)} 
        />
      ) : (
        <span className="text-[10px] font-black text-slate-600">₹{item.costMaking}</span>
      )}
    </div>

    {/* 2. SELLING PRICE / MRP (The main input) */}
    <div className="space-y-1">
      <Label className="text-[10px] font-black text-emerald-700 uppercase tracking-widest">
        {item.is_repair ? "Total Repair Bill" : "Selling Price (MRP)"}
      </Label>
      <div className="relative">
        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">₹</span>
        <Input 
          type="number" step="0.01" 
          className="h-8 w-full text-xs font-black text-slate-900 bg-white border-emerald-300 shadow-inner focus-visible:ring-emerald-500 pl-6" 
          placeholder="0.00" 
          value={item.mrp} 
          onChange={(e) => updateBatchItem(item.job_bag_item_id, 'mrp', e.target.value)} 
        />
      </div>
    </div>

    {/* 3. INTERNAL NOTES */}
    <Input 
      className="h-6 w-full text-[10px] px-2 bg-white border-slate-200 text-slate-600 placeholder:text-slate-400" 
      placeholder="Internal Notes / Remarks..." 
      value={item.item_remarks} 
      onChange={(e) => updateBatchItem(item.job_bag_item_id, 'item_remarks', e.target.value)} 
    />
    
  </div>
</td>

                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* STEP 2: AVAILABLE ITEMS (UNSELECTED) */}
      {unselectedItems.length > 0 && (
        <Card className="shadow-sm border-border/60 bg-card overflow-hidden">
          <CardHeader className="bg-secondary/30 py-3 px-4 border-b flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-muted-foreground" />
              <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">2. Pending SKUs in Job Bag ({unselectedItems.length})</h3>
            </div>
            <Button variant="secondary" size="sm" onClick={() => selectAll(true)} className="h-7 text-xs font-bold">
              Stage All Below
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto max-h-[400px] custom-scrollbar">
              <table className="w-full text-sm">
                <thead className="bg-zinc-50 sticky top-0 z-10 border-b">
                  <tr>
                    <th className="p-3 text-left text-[10px] font-black uppercase text-muted-foreground w-32">Action</th>
                    <th className="p-3 text-left text-[10px] font-black uppercase text-muted-foreground">Style Details</th>
                    <th className="p-3 text-left text-[10px] font-black uppercase text-muted-foreground">Status</th>
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
                        <div className="font-bold">
                          {item.sku_reference}
                          {item.custom_order_id && <Badge className="ml-2 bg-purple-100 text-purple-700 text-[8px] uppercase tracking-widest border-purple-200">Custom</Badge>}
                          {item.is_repair && <Badge className="ml-2 bg-amber-100 text-amber-700 text-[8px] uppercase tracking-widest border-amber-200">Repair</Badge>}
                        </div>
                        <div className="text-[10px] text-muted-foreground">{item.ornament_type}</div>
                      </td>
                      <td className="p-3 text-[10px] uppercase font-bold text-amber-600">
                        In Progress
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* MRP CALCULATOR MODAL */}
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
                    <TableHead className="text-[10px] font-bold uppercase text-slate-500 h-9 text-right">Current Price</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase text-indigo-600 h-9 text-right pr-6">Calculated Price</TableHead>
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
                   <Check className="w-4 h-4 mr-2" /> Apply to Forms
                 </Button>
               </>
             )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}