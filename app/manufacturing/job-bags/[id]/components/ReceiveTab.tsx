"use client"

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { Save, Layers, Printer, Settings2, Wand2, Plus, X } from 'lucide-react'
import Barcode from 'react-barcode'
import { useReactToPrint } from 'react-to-print' // <-- Swapped html2canvas for native printing
import QRCode from 'react-qr-code'

interface Props {
  jobId: string 
  companyId: string
  warehouseId: string
  refresh: () => void
}

type BatchItem = {
  index: number
  barcode: string
  sku_reference: string
  stonePieces: string 
  grossWeight: string
  stoneWeight: string
  netWeight: string
  wastageWeight: string
  costMaking: string
  mrp: string
}

export default function ReceiveTab({
  jobId,
  companyId,
  warehouseId,
  refresh
}: Props) {
  const labelRef = useRef<HTMLDivElement>(null)

  // --- BATCH SETTINGS STATE ---
  const [batchQuantity, setBatchQuantity] = useState('1')
  const [itemCategory, setItemCategory] = useState('')
  const [itemSize, setItemSize] = useState('')
  const [styleCode, setStyleCode] = useState('') 
  
  const [metalType, setMetalType] = useState('Gold')
  const [purityKarat, setPurityKarat] = useState('22K')
  const [purityPercent, setPurityPercent] = useState('91.6')
  
  // Shared Costing & Metadata
  const [laborRate, setLaborRate] = useState('')
  const [wastagePercent, setWastagePercent] = useState('')
  const [remarks, setRemarks] = useState('')

  // --- WAREHOUSE STATE ---
  const [warehouses, setWarehouses] = useState<{id: string, name: string}[]>([])
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('')

  // --- CATEGORY STATE ---
  const [categories, setCategories] = useState<string[]>([])
  const [isNewCategoryMode, setIsNewCategoryMode] = useState(false)

  // --- GRID STATE ---
  const [batchItems, setBatchItems] = useState<BatchItem[]>([])
  const [previewIndex, setPreviewIndex] = useState(0)

  // Fetch unique categories
  useEffect(() => {
    async function fetchCategories() {
      const { data, error } = await supabase
        .from('inventory_items')
        .select('item_category')
        .eq('company_id', companyId)
        .not('item_category', 'is', null)
      
      if (!error && data) {
        const uniqueCats = Array.from(new Set(data.map(d => d.item_category))).filter(Boolean) as string[]
        setCategories(uniqueCats)
        if (uniqueCats.length > 0 && !itemCategory) {
          setItemCategory(uniqueCats[0])
        }
      }
    }
    fetchCategories()
  }, [companyId, itemCategory])

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

  const generateSmartStyleCode = (category: string, purity: string) => {
    const catPrefix = category ? category.replace(/[^a-zA-Z]/g, '').substring(0, 3).toUpperCase() : 'ITM'
    const karatPrefix = purity ? purity.toUpperCase() : 'XX'
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
    let randomSuffix = ""
    for (let i = 0; i < 4; i++) {
      randomSuffix += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return `${catPrefix}-${karatPrefix}-${randomSuffix}`
  }

  const generateBatchGrid = async () => {
    const qty = parseInt(batchQuantity) || 1
    const categoryPrefix = itemCategory ? itemCategory.substring(0, 3).toUpperCase() : 'ITM'
    const jobPrefix = jobId.split('-')[0].substring(0, 4).toUpperCase()
    
    const baseBarcodePrefix = `JB${jobPrefix}-${categoryPrefix}-`

    const { data, error } = await supabase
      .from('inventory_items')
      .select('barcode')
      .eq('created_from_job_bag_id', jobId)
      .ilike('barcode', `${baseBarcodePrefix}%`) 

    if (error) {
      toast.error(`Could not verify sequence: ${error.message}`)
      return 
    }

    let startingSequence = 1
    if (data && data.length > 0) {
      const existingNumbers = data.map(item => {
        const parts = item.barcode.split('-')
        return parseInt(parts[parts.length - 1]) || 0
      })
      startingSequence = Math.max(...existingNumbers) + 1
    }

    const newItems: BatchItem[] = []
    
    for (let i = 0; i < qty; i++) {
      const currentSeq = (startingSequence + i).toString().padStart(2, '0') 
      newItems.push({
        index: i,
        barcode: `${baseBarcodePrefix}${currentSeq}`,
        sku_reference: styleCode,
        stonePieces: '0',
        grossWeight: '',
        stoneWeight: '0',
        netWeight: '0',
        wastageWeight: '0',
        costMaking: '0',
        mrp: ''
      })
    }
    
    setBatchItems(newItems)
    setPreviewIndex(0)
  }

  const updateBatchItem = (index: number, field: keyof BatchItem, value: string) => {
    setBatchItems(prev => {
      const updated = [...prev]
      const item = { ...updated[index], [field]: value }

      if (field === 'grossWeight' || field === 'stoneWeight') {
        const gw = parseFloat(field === 'grossWeight' ? value : item.grossWeight) || 0
        const sw = parseFloat(field === 'stoneWeight' ? value : item.stoneWeight) || 0
        const lr = parseFloat(laborRate) || 0
        const wp = parseFloat(wastagePercent) || 0

        const calculatedNet = Math.max(0, gw - (sw * 0.2))
        item.netWeight = calculatedNet.toFixed(3)
        item.wastageWeight = (calculatedNet * (wp / 100)).toFixed(3)
        item.costMaking = (calculatedNet * lr).toFixed(2)
      }

      updated[index] = item
      return updated
    })
    setPreviewIndex(index) 
  }

  useEffect(() => {
    if (batchItems.length === 0) return
    const lr = parseFloat(laborRate) || 0
    const wp = parseFloat(wastagePercent) || 0

    setBatchItems(prev => prev.map(item => {
      const gw = parseFloat(item.grossWeight) || 0
      const sw = parseFloat(item.stoneWeight) || 0
      const calculatedNet = Math.max(0, gw - (sw * 0.2))
      return {
        ...item,
        netWeight: calculatedNet.toFixed(3),
        wastageWeight: (calculatedNet * (wp / 100)).toFixed(3),
        costMaking: (calculatedNet * lr).toFixed(2)
      }
    }))
  }, [laborRate, wastagePercent])

  async function receiveBatch() {
    if (batchItems.length === 0) return toast.error("Generate batch grid first.")

    const incomplete = batchItems.some(item => !item.grossWeight || parseFloat(item.grossWeight) <= 0)
    if (incomplete) return toast.error("All items must have a valid Gross Weight.")

    const { data: authData, error: authError } = await supabase.auth.getUser()
    if (authError || !authData.user) return toast.error("Authentication error.")
    
    const userId = authData.user.id

    const insertData = batchItems.map(item => ({
      company_id: companyId,
      warehouse_id: selectedWarehouseId,
      created_from_job_bag_id: jobId,
      status: 'in_stock',
      metal_type: metalType,
      purity_karat: purityKarat,
      purity_percent: Number(purityPercent),
      item_category: itemCategory,
      item_size: itemSize,
      sku_reference: item.sku_reference,
      labor_rate: Number(laborRate),
      remarks: remarks,
      barcode: item.barcode,
      gross_weight_g: Number(item.grossWeight),
      net_weight_g: Number(item.netWeight),
      total_stone_weight_cts: Number(item.stoneWeight),
      total_stone_pieces: Number(item.stonePieces) || 0,
      wastage_weight_g: Number(item.wastageWeight),
      cost_making: Number(item.costMaking),
      mrp: item.mrp ? Number(item.mrp) : null,
      created_by: userId,
      updated_by: userId
    }))

    const { error } = await supabase.from('inventory_items').insert(insertData)

    if (error) {
      toast.error(`Batch insert failed: ${error.message}`)
    } else {
      toast.success(`Successfully added ${batchItems.length} items to inventory!`)
      refresh()
      setBatchItems([])
    }
  }

  // --- TSC PRINTER LOGIC ---
  const activeItem = batchItems[previewIndex]
  
  const handlePrint = useReactToPrint({
    contentRef: labelRef,
    documentTitle: `Tag_${activeItem?.barcode || 'Preview'}`,
    onAfterPrint: () => toast.success('Sent to Thermal Printer'),
  })

  return (
    <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 items-start">
      
      {/* MAIN CONTENT AREA */}
      <div className="xl:col-span-3 space-y-6">
        
        {/* STEP 1: BATCH SETTINGS */}
        <Card className="shadow-none border-border/60 bg-card overflow-hidden">
          <CardHeader className="bg-secondary/30 py-3 px-4 border-b">
            <div className="flex items-center gap-2">
              <Settings2 className="w-4 h-4 text-muted-foreground" />
              <h3 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Step 1: Batch Configuration</h3>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
              
              <div className="sm:col-span-2 space-y-1.5">
                <Label className="text-[10px] font-bold uppercase text-muted-foreground">Item Category</Label>
                {isNewCategoryMode ? (
                  <div className="relative flex items-center group">
                    <Input 
                      placeholder="Type new category..." 
                      className="h-9 text-xs border-border bg-background pr-8 focus-visible:ring-1 focus-visible:ring-primary shadow-inner" 
                      value={itemCategory} 
                      onChange={(e) => setItemCategory(e.target.value)} 
                      autoFocus
                    />
                    <Button 
                      type="button" variant="ghost" size="icon" 
                      className="absolute right-0 h-9 w-9 text-muted-foreground hover:text-red-500 transition-colors"
                      onClick={() => {
                        setIsNewCategoryMode(false)
                        setItemCategory(categories.length > 0 ? categories[0] : '')
                      }}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ) : (
                  <Select value={itemCategory} onValueChange={(val) => {
                    if (val === 'ADD_NEW') { setIsNewCategoryMode(true); setItemCategory(''); } 
                    else { setItemCategory(val) }
                  }}>
                    <SelectTrigger className="h-9 text-xs border-border bg-muted/20 focus:ring-1 focus:ring-primary">
                      <SelectValue placeholder="Select Category..." />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map(c => (
                        <SelectItem key={c} value={c} className="text-xs font-medium">{c}</SelectItem>
                      ))}
                      {categories.length > 0 && <Separator className="my-1" />}
                      <SelectItem value="ADD_NEW" className="text-xs font-bold text-primary focus:bg-primary/10">
                        <div className="flex items-center gap-2"><Plus className="h-3.5 w-3.5" /> Add New Category...</div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>

              <div className="sm:col-span-2 space-y-1.5">
                <Label className="text-[10px] font-bold uppercase text-muted-foreground">Style / SKU</Label>
                <div className="relative flex items-center group">
                  <Input 
                    placeholder="e.g. RNG-22K-A1B2" 
                    className="h-9 text-xs border-border bg-muted/20 uppercase pr-8 focus-visible:ring-1 focus-visible:ring-primary" 
                    value={styleCode} 
                    onChange={(e) => setStyleCode(e.target.value)} 
                  />
                  <Button 
                    type="button" variant="ghost" size="icon" 
                    className="absolute right-0 h-9 w-9 text-muted-foreground hover:text-primary transition-colors"
                    onClick={() => setStyleCode(generateSmartStyleCode(itemCategory, purityKarat))}
                    title="Auto-generate Style Code"
                  >
                    <Wand2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              <div className="sm:col-span-2 space-y-1.5">
                <Label className="text-[10px] font-bold uppercase text-muted-foreground">Receiving Vault</Label>
                <Select value={selectedWarehouseId} onValueChange={setSelectedWarehouseId}>
                  <SelectTrigger className="h-9 text-xs border-border bg-muted/20 focus:ring-1 focus:ring-primary">
                    <SelectValue placeholder="Select Vault..." />
                  </SelectTrigger>
                  <SelectContent>
                    {warehouses.map(w => (
                      <SelectItem key={w.id} value={w.id} className="text-xs font-medium">{w.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold uppercase text-muted-foreground">Quantity</Label>
                <Input type="number" min="1" className="h-9 text-xs border-border bg-muted/20 font-bold" value={batchQuantity} onChange={(e) => setBatchQuantity(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold uppercase text-muted-foreground">Labor /g (₹)</Label>
                <Input type="number" className="h-9 text-xs border-border bg-muted/20" value={laborRate} onChange={(e) => setLaborRate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold uppercase text-muted-foreground">Wastage (%)</Label>
                <Input type="number" className="h-9 text-xs border-border bg-muted/20" value={wastagePercent} onChange={(e) => setWastagePercent(e.target.value)} />
              </div>
            </div>

            <Button onClick={generateBatchGrid} variant="secondary" className="w-full h-10 font-bold text-xs uppercase tracking-widest border border-border">
              Generate Sequence for {batchQuantity || 0} Units
            </Button>
          </CardContent>
        </Card>

        {/* STEP 2: FAST ENTRY GRID */}
        {batchItems.length > 0 && (
          <Card className="shadow-none border-border/60 bg-card overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300">
            <CardHeader className="bg-primary/5 py-3 px-4 border-b border-primary/10 flex flex-row items-center justify-between">
               <div className="flex items-center gap-2">
                 <Layers className="w-4 h-4 text-primary" />
                 <h3 className="text-[11px] font-bold uppercase tracking-widest text-primary">Step 2: Fast Entry Grid</h3>
               </div>
               <span className="text-[9px] font-bold uppercase tracking-tighter text-muted-foreground">Tap row to view label</span>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto max-h-[500px] custom-scrollbar">
                <table className="w-full text-sm">
                  <thead className="bg-secondary/30 sticky top-0 z-10 border-b shadow-sm">
                    <tr>
                      <th className="p-3 text-left text-[10px] font-black uppercase text-muted-foreground whitespace-nowrap">Identifier</th>
                      <th className="p-3 text-left text-[10px] font-black uppercase text-muted-foreground">Style / SKU</th>
                      <th className="p-3 text-left text-[10px] font-black uppercase text-muted-foreground">Gross (g)</th>
                      <th className="p-3 text-left text-[10px] font-black uppercase text-muted-foreground">Stone Pcs</th>
                      <th className="p-3 text-left text-[10px] font-black uppercase text-muted-foreground">Stone (ct)</th>
                      <th className="p-3 text-left text-[10px] font-black uppercase text-muted-foreground">Net (g)</th>
                      <th className="p-3 text-left text-[10px] font-black uppercase text-muted-foreground">Retail (₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {batchItems.map((item, idx) => (
                      <tr 
                        key={item.barcode} 
                        className={`border-b border-border/40 transition-colors hover:bg-secondary/30 cursor-pointer ${previewIndex === idx ? 'bg-primary/5' : ''}`}
                        onClick={() => setPreviewIndex(idx)}
                      >
                        <td className="p-3 font-mono font-bold text-xs text-foreground whitespace-nowrap">{item.barcode}</td>
                        <td className="p-3">
                          <Input 
                            className="h-8 w-24 text-xs font-bold border-border/60 focus-visible:ring-1 focus-visible:ring-primary/50 uppercase" 
                            value={item.sku_reference} 
                            onChange={(e) => updateBatchItem(idx, 'sku_reference', e.target.value)} 
                          />
                        </td>
                        <td className="p-3">
                          <Input 
                            type="number" step="0.001" 
                            className="h-8 w-24 text-xs font-bold border-border/60 focus-visible:ring-1 focus-visible:ring-primary/50" 
                            value={item.grossWeight} 
                            onChange={(e) => updateBatchItem(idx, 'grossWeight', e.target.value)} 
                          />
                        </td>
                        <td className="p-3">
                          <Input 
                            type="number"
                            className="h-8 w-16 text-xs border-border/60 focus-visible:ring-1 focus-visible:ring-primary/50" 
                            value={item.stonePieces} 
                            onChange={(e) => updateBatchItem(idx, 'stonePieces', e.target.value)} 
                          />
                        </td>
                        <td className="p-3">
                          <Input 
                            type="number" step="0.01" 
                            className="h-8 w-20 text-xs border-border/60 focus-visible:ring-1 focus-visible:ring-primary/50" 
                            value={item.stoneWeight} 
                            onChange={(e) => updateBatchItem(idx, 'stoneWeight', e.target.value)} 
                          />
                        </td>
                        <td className="p-3 font-bold text-foreground text-xs">{item.netWeight}</td>
                        <td className="p-3">
                          <Input 
                            type="number" 
                            className="h-8 w-24 text-xs border-border/60 focus-visible:ring-1 focus-visible:ring-primary/50" 
                            placeholder="Auto"
                            value={item.mrp || ''} 
                            onChange={(e) => updateBatchItem(idx, 'mrp', e.target.value)} 
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              <div className="p-6 bg-secondary/10 border-t">
                <Button onClick={receiveBatch} className="w-full md:w-auto h-10 px-8 font-bold text-xs uppercase tracking-widest shadow-md bg-foreground text-background hover:bg-foreground/90 transition-transform active:scale-[0.98]">
                  <Save className="w-4 h-4 mr-2" /> Commit Batch to Vault
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* RIGHT COLUMN: DIRECT TSC THERMAL PRINT PREVIEW */}
      <div className="xl:col-span-1">
        <Card className="sticky top-[100px] shadow-none border-border/60 bg-card overflow-hidden">
          <CardHeader className="bg-secondary/30 py-3 px-4 border-b">
             <h3 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground text-center">Thermal Label Layout</h3>
          </CardHeader>
          <CardContent className="p-6 flex flex-col items-center justify-center min-h-[400px]">
            
            <div className="overflow-x-auto w-full pb-4 flex justify-center">
              
              {/* EXACT 100x20mm CSS LAYOUT */}
              <div 
                ref={labelRef} 
                className="bg-white text-black flex border border-gray-300 shadow-sm print:border-none print:shadow-none overflow-hidden"
                style={{ 
                  width: '100mm', 
                  height: '20mm', 
                  fontFamily: 'Arial, sans-serif',
                  boxSizing: 'border-box'
                }}
              >
                {/* Global Print CSS Injection */}
                <style type="text/css" media="print">
                  {`@page { size: 100mm 20mm; margin: 0; } body { margin: 0; padding: 0; background: white; }`}
                </style>

                {/* PRINTABLE AREA (70mm total) */}
                <div className="flex w-[70mm] h-full">
                  
                  {/* LEFT FLAP (All Text & Branding - 34mm) */}
                  <div className="flex flex-col justify-center h-full w-[34mm] pl-[2mm]" style={{ fontSize: '5.8px', lineHeight: '1.15', fontWeight: 'bold' }}>
                    
                    {/* Branding Header */}
                    <h2 className="font-extrabold uppercase tracking-tight text-[8px] leading-none mb-[1px]">
                      PAVITRAM
                    </h2>
                    <div className="uppercase tracking-widest text-[5px] text-gray-600 mb-[2px] border-b border-gray-200 pb-[1px]">
                      {itemCategory || 'CATEGORY'}
                    </div>

                    {/* Technical Specs */}
                    <div className="flex"><span className="w-[9mm]">TAG</span><span>: {activeItem?.barcode?.slice(-6) || '---'}</span></div>
                    <div className="flex"><span className="w-[9mm]">STYLE</span><span>: {activeItem?.sku_reference || '---'}</span></div>
                    <div className="flex"><span className="w-[9mm]">KT/GW</span><span>: {purityKarat} / {Number(activeItem?.grossWeight||0).toFixed(3)}</span></div>
                    <div className="flex">
                      <span className="w-[9mm]">{Number(activeItem?.stonePieces) === 1 ? 'CS' : 'RD'}</span>
                      <span>: {activeItem?.stonePieces || 0} / {Number(activeItem?.stoneWeight||0).toFixed(3)}</span>
                    </div>
                    <div className="flex"><span className="w-[9mm]">NET</span><span>: {Number(activeItem?.netWeight||0).toFixed(3)}</span></div>
                  </div>

                  {/* CENTER GAP (Fold Line - 2mm) */}
                  <div className="w-[2mm] h-full flex items-center justify-center">
                    <div className="h-full w-[1px] border-l border-dashed border-gray-300 print:border-none opacity-50" />
                  </div>

                  {/* RIGHT FLAP (Dedicated QR Code - 34mm) */}
                  <div className="flex flex-col justify-center items-center h-full w-[34mm] pr-[2mm]">
                    {activeItem?.barcode ? (
                      <div className="bg-white p-0.5">
                        <QRCode 
                          value={activeItem.barcode} 
                          size={64} 
                          level="M" 
                          style={{ height: "16mm", width: "16mm" }} 
                        />
                      </div>
                    ) : (
                      <div className="h-[16mm] w-[16mm] bg-gray-100 flex items-center justify-center border border-dashed border-gray-300 text-[5px] text-gray-400">
                        N/A
                      </div>
                    )}
                  </div>

                </div>

                {/* RAT-TAIL / STRING TIE AREA (30mm Blank) */}
                <div className="w-[30mm] h-full bg-gray-50 print:bg-white border-l border-gray-200 print:border-none flex items-center justify-center">
                   <span className="text-[5px] text-gray-300 print:hidden rotate-90 tracking-widest">TAIL AREA</span>
                </div>

              </div>
            </div>

            <Button 
              className="w-full h-10 font-bold text-xs uppercase tracking-widest shadow-md" 
              onClick={handlePrint}
              disabled={batchItems.length === 0}
            >
              <Printer className="w-3.5 h-3.5 mr-2" /> Direct Print (TSC)
            </Button>

            <p className="text-[9px] text-muted-foreground text-center mt-3 uppercase tracking-widest">
              Set printer bounds to 100mm x 20mm
            </p>
          </CardContent>
        </Card>
      </div>

    </div>
  )
}