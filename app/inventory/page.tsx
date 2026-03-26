"use client"

import React, { useEffect, useState, useRef } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import html2canvas from "html2canvas"
import QRCode from "react-qr-code"
import { useReactToPrint } from "react-to-print"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge" //

import { 
  Search, Printer, Edit2, Check, X, Store, Truck, Download, 
  RefreshCw, Database, Package, Calculator, Gem, Hammer, 
  ArrowRight, ArrowLeft, Upload, FileSpreadsheet, Loader2, AlertCircle, PlusCircle, UploadCloud,
  
} from "lucide-react"

import { useAuth } from "@/hooks/useAuth"
import { useStoreLocation } from "@/hooks/useStoreLocation"
import { supabase } from "@/lib/supabaseClient"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { Label } from "@/components/ui/label"
import { 
  Table, TableBody, TableCell, TableHead, 
  TableHeader, TableRow 
} from "@/components/ui/table"
import { 
  Dialog, DialogContent, DialogHeader, 
  DialogTitle, DialogDescription, DialogFooter
} from "@/components/ui/dialog"
import { 
  Select, SelectContent, SelectItem, 
  SelectTrigger, SelectValue 
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

interface InventoryItem {
  id: string
  barcode: string
  sku_reference: string
  item_category: string
  item_size: string
  metal_type: string
  purity_karat: string
  gross_weight_g: number
  net_weight_g: number
  total_stone_weight_cts: number
  total_stone_pieces: number
  mrp: number | null
  status: string
  warehouse_id: string
  is_exchanged: boolean
}

interface Warehouse {
  id: string
  name: string
  type?: string
  warehouse_type?: string
}

export default function InventoryPage() {
  const { appUser } = useAuth()
  const router = useRouter()
  const [items, setItems] = useState<InventoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const { isHQ, isLocked, selectedLocation, setSelectedLocation } = useStoreLocation()
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [editingMrpId, setEditingId] = useState<string | null>(null)
  const [editingMrpVal, setEditingMrpVal] = useState<string>('')
  
  // Printing State
  const [tagItem, setTagItem] = useState<InventoryItem | null>(null)
  const labelRef = useRef<HTMLDivElement>(null)

  // Dynamic MRP Calculator State
  const [isCalcModalOpen, setCalcModalOpen] = useState(false)
  const [calcStep, setCalcStep] = useState<'params' | 'preview'>('params')
  const [isCalculating, setIsCalculating] = useState(false)
  const [base24kRate, setBase24kRate] = useState<number>(7250) 
  const [goldRates, setGoldRates] = useState<Record<string, number>>({}) 
  const [previewData, setPreviewData] = useState<any[]>([])
  
  const [calcParams, setCalcParams] = useState({
    diamondRatePerCt: 25000, 
    markupPercent: 80,
    flatCharge: 8000
  })

  // --- BULK / MANUAL IMPORT STATE ---
  const [isImportModalOpen, setIsImportModalOpen] = useState(false)
  const [stagedImportItems, setStagedImportItems] = useState<any[]>([])
  const [importStep, setImportStep] = useState<'input' | 'verify'>('input')
  const [isImporting, setIsImporting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [manualEntry, setManualEntry] = useState({
    barcode: '', item_category: '', metal_type: 'Gold', purity_karat: '22K',
    gross_weight_g: '', net_weight_g: '', total_stone_weight_cts: '', mrp: ''
  })

  const handlePrint = useReactToPrint({
    contentRef: labelRef,
    documentTitle: `Jewelry-Tag-${tagItem?.barcode || 'Item'}`,
    onAfterPrint: () => toast.success('Sent to Thermal Printer'),
  })

  useEffect(() => {
    const fetchInitialData = async () => {
      if (!appUser) return
      try {
        const { data: whData } = await supabase
          .from('warehouses')
          .select('*')
          .eq('company_id', appUser.company_id)
          .eq('is_active', true)
          .order('name')

        if (whData && whData.length > 0) {
          setWarehouses(whData)
          if (!selectedLocation && isHQ) {
            setSelectedLocation(whData[0].id)
          }
        }

        const { data: companyData } = await supabase
          .from('companies')
          .select('current_rate_24k, current_rate_diamond')
          .eq('id', appUser.company_id)
          .maybeSingle()

        if (companyData) {
          if (companyData.current_rate_24k) setBase24kRate(companyData.current_rate_24k)
          if (companyData.current_rate_diamond) setCalcParams(prev => ({ ...prev, diamondRatePerCt: companyData.current_rate_diamond }))
        }
      } catch (err) { toast.error('Error loading initial data') }
    }
    fetchInitialData()
  }, [appUser, isHQ, selectedLocation, setSelectedLocation])

  const fetchItems = async () => {
    if (!appUser || !selectedLocation) return
    setLoading(true)
    try {
      let query = supabase.from('inventory_items').select('*').eq('company_id', appUser.company_id).order('created_at', { ascending: false })
      if (selectedLocation !== 'ALL') {
        query = query.eq('warehouse_id', selectedLocation)
      }
      const { data, error } = await query
      if (error) throw error
      setItems(data || [])
    } catch (error) { toast.error('Failed to load inventory') } 
    finally { setLoading(false) }
  }

  useEffect(() => { fetchItems() }, [appUser, selectedLocation])

  const handleSaveMrp = async (id: string) => {
    const newMrp = editingMrpVal ? Number(editingMrpVal) : null
    const { error } = await supabase.from('inventory_items').update({ mrp: newMrp }).eq('id', id)
    if (error) return toast.error('Failed to update price')
    setItems(items.map(item => item.id === id ? { ...item, mrp: newMrp } : item))
    setEditingId(null)
    toast.success('Price updated')
  }

  const handleOpenCalc = () => {
    const selectedItems = items.filter(i => selectedIds.includes(i.id))
    const uniqueKarats = Array.from(new Set(selectedItems.map(i => i.purity_karat || '24K')))
    const initialRates: Record<string, number> = {}
    uniqueKarats.forEach(k => {
      const kNum = parseInt(k.replace(/\D/g, '')) || 24
      initialRates[k] = Math.round(base24kRate * (kNum / 24))
    })
    setGoldRates(initialRates)
    setCalcStep('params')
    setCalcModalOpen(true)
  }

  const handleGeneratePreview = () => {
    const selectedItems = items.filter(i => selectedIds.includes(i.id))
    const previews = selectedItems.map(item => {
      const k = item.purity_karat || '24K'
      const gRate = goldRates[k] || 0
      const goldCost = (item.net_weight_g || 0) * gRate
      const diamondCost = (item.total_stone_weight_cts || 0) * calcParams.diamondRatePerCt
      const baseCost = goldCost + diamondCost
      const markupAmount = baseCost * (calcParams.markupPercent / 100)
      const subtotal = baseCost + markupAmount
      const finalMrp = Math.round(subtotal + calcParams.flatCharge)
      return { ...item, newMrp: finalMrp }
    })
    setPreviewData(previews)
    setCalcStep('preview')
  }

  const handleApplyBulkMrp = async () => {
    setIsCalculating(true)
    try {
      await Promise.all(previewData.map(p => 
        supabase.from('inventory_items').update({ mrp: p.newMrp }).eq('id', p.id)
      ))
      setItems(prev => prev.map(item => {
        const update = previewData.find(px => px.id === item.id)
        return update ? { ...item, mrp: update.newMrp } : item
      }))
      toast.success(`Successfully applied new MRP to ${previewData.length} items.`)
      setCalcModalOpen(false)
      setSelectedIds([]) 
    } catch (e) {
      toast.error("Failed to update inventory.")
    } finally {
      setIsCalculating(false)
    }
  }

  // --- IMPORT LOGIC: CSV Upload ---
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedLocation || selectedLocation === 'ALL') return toast.error("Please select a specific destination Vault/Location first.")
    
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const text = event.target?.result as string
      // Basic CSV/TSV parser (handles both commas and tabs)
      const rows = text.split('\n').map(row => row.split(/,|\t/))
      
      let startIndex = 0;
      if (rows[0].some(col => col.toLowerCase().includes('barcode') || col.toLowerCase().includes('metal'))) {
        startIndex = 1;
      }

      const parsedItems: any[] = [] // <--- ADD : any[] HERE
      
      for (let i = startIndex; i < rows.length; i++) {
        const cols = rows[i].map(c => c.trim())
        if (cols.length < 5 || !cols[0]) continue; 

        parsedItems.push({
          barcode: cols[0],
          item_category: cols[1] || 'Jewellery',
          metal_type: cols[2] || 'Gold',
          purity_karat: cols[3] || '24K',
          purity_percent: parseInt((cols[3] || '24').replace(/\D/g, '')) / 24 * 100,
          gross_weight_g: parseFloat(cols[4]) || 0,
          net_weight_g: parseFloat(cols[5]) || parseFloat(cols[4]) || 0, 
          total_stone_weight_cts: parseFloat(cols[6]) || 0,
          mrp: cols[7] ? parseFloat(cols[7]) : null,
          status: 'in_stock',
          warehouse_id: selectedLocation,
          company_id: appUser?.company_id,
          created_from_job_bag_id: '00000000-0000-0000-0000-000000000000' 
        })
      }

      if (parsedItems.length === 0) return toast.error("No valid rows found in CSV.")
      setStagedImportItems(prev => [...prev, ...parsedItems])
      toast.success(`Successfully loaded ${parsedItems.length} items from file.`)
    }
    reader.readAsText(file)
    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // --- IMPORT LOGIC: Manual Single Entry ---
  const handleManualAdd = () => {
    if (!selectedLocation || selectedLocation === 'ALL') return toast.error("Please select a specific destination Vault/Location first.")
    if (!manualEntry.barcode || !manualEntry.gross_weight_g) return toast.error("Barcode and Gross Weight are required.")

    const newItem = {
      barcode: manualEntry.barcode,
      item_category: manualEntry.item_category || 'Jewellery',
      metal_type: manualEntry.metal_type,
      purity_karat: manualEntry.purity_karat,
      purity_percent: parseInt((manualEntry.purity_karat || '24').replace(/\D/g, '')) / 24 * 100,
      gross_weight_g: parseFloat(manualEntry.gross_weight_g) || 0,
      net_weight_g: parseFloat(manualEntry.net_weight_g) || parseFloat(manualEntry.gross_weight_g) || 0,
      total_stone_weight_cts: parseFloat(manualEntry.total_stone_weight_cts) || 0,
      mrp: manualEntry.mrp ? parseFloat(manualEntry.mrp) : null,
      status: 'in_stock',
      warehouse_id: selectedLocation,
      company_id: appUser?.company_id,
      created_from_job_bag_id: '00000000-0000-0000-0000-000000000000'
    }

    setStagedImportItems(prev => [newItem, ...prev])
    setManualEntry({ barcode: '', item_category: '', metal_type: 'Gold', purity_karat: '22K', gross_weight_g: '', net_weight_g: '', total_stone_weight_cts: '', mrp: '' })
    toast.success("Item staged for import.")
  }

  // --- IMPORT LOGIC: Commit to Database ---
  const handleCommitImport = async () => {
    if (stagedImportItems.length === 0) return toast.error("No items staged.")
    setIsImporting(true)
    try {
      // Use upsert to handle duplicates safely
      const { error } = await supabase
        .from('inventory_items')
        .upsert(stagedImportItems, { onConflict: 'barcode' })

      if (error) throw error

      toast.success(`Successfully committed ${stagedImportItems.length} items to database.`)
      setIsImportModalOpen(false)
      setStagedImportItems([])
      setImportStep('input')
      fetchItems() // Refresh table
    } catch (err: any) {
      toast.error(err.message || "Failed to commit items to database.")
    } finally {
      setIsImporting(false)
    }
  }


  const filteredActiveItems = items.filter(item => {
    if (item.status === 'sold') return false; 
    const matchesSearch = item.barcode?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          item.sku_reference?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          item.item_category?.toLowerCase().includes(searchTerm.toLowerCase());
    if (filterStatus === 'all') return matchesSearch;
    if (filterStatus === 'exchanged') return matchesSearch && item.is_exchanged === true;
    return matchesSearch && item.status === filterStatus;
  });

  const soldItems = items.filter(item => {
    const matchesSearch = item.barcode?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          item.item_category?.toLowerCase().includes(searchTerm.toLowerCase())
    return item.status === 'sold' && matchesSearch
  })

  const handleSingleTransfer = (item: InventoryItem) => {
    router.push(`/transfer/new?ids=${item.id}&from=${item.warehouse_id}`)
  }

  const handleBulkTransfer = () => {
    if (selectedIds.length === 0) return
    const selectedItems = items.filter(i => selectedIds.includes(i.id))
    const whIds = new Set(selectedItems.map(i => i.warehouse_id))
    if (whIds.size > 1) return toast.error("Items must be from the same warehouse.")
    router.push(`/transfer/new?ids=${selectedIds.join(',')}&from=${Array.from(whIds)[0]}`)
  }

  const downloadTagImage = async () => {
    if (!labelRef.current || !tagItem) return
    try {
      const canvas = await html2canvas(labelRef.current, { scale: 4 })
      const link = document.createElement("a")
      link.href = canvas.toDataURL("image/png")
      link.download = `Tag-${tagItem.barcode}.png`
      link.click()
      toast.success("Tag image saved")
    } catch (err) { toast.error("Failed to generate tag image") }
  }

  const TableSkeleton = () => (
    <div className="space-y-2 p-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 h-12 border-b border-slate-100 last:border-0">
          <Skeleton className="h-4 w-4 rounded" />
          <Skeleton className="h-4 w-24 rounded" />
          <Skeleton className="h-4 w-40 rounded" />
          <Skeleton className="h-4 w-16 rounded" />
          <Skeleton className="h-4 w-24 rounded" />
          <div className="flex-1" />
          <Skeleton className="h-8 w-20 rounded-md" />
        </div>
      ))}
    </div>
  )

  if (!appUser) return null

  return (
    <div className="flex flex-col min-h-screen bg-[#fafafa] font-sans selection:bg-indigo-100 pb-20">
      
      {/* HEADER */}
      <header className="h-14 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center sticky top-0 z-40 shadow-sm box-border">
        <div className="w-full max-w-7xl mx-auto flex justify-between items-center gap-4">
          <div className="flex items-center gap-2.5">
            <div className="h-7 w-7 bg-emerald-50 border border-emerald-100 text-emerald-600 flex items-center justify-center rounded text-xs shadow-sm">
              <Package className="w-3.5 h-3.5" />
            </div>
            <h1 className="text-sm font-semibold text-slate-900 tracking-tight leading-none hidden sm:block">Vault Inventory</h1>
            
            <span className="hidden md:inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-slate-50 text-slate-500 border border-slate-200 uppercase tracking-wider leading-none ml-2">
              <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 mr-1.5 animate-pulse" />
              Live Sync
            </span>
          </div>
          
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="h-8 px-3 text-xs font-semibold text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 rounded-md transition-none border border-transparent hover:border-indigo-200 hidden sm:flex" onClick={() => setIsImportModalOpen(true)}>
              <Upload className="h-3.5 w-3.5 mr-1.5" />
              <span className="hidden sm:inline">Add / Import Stock</span>
            </Button>
            <div className="h-4 w-px bg-slate-200 mx-1 hidden sm:block" />

            <Button variant="ghost" size="sm" className="h-8 px-2 text-xs font-semibold text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-none" onClick={fetchItems}>
              <RefreshCw className={`h-3.5 w-3.5 sm:mr-1.5 ${loading ? 'animate-spin text-indigo-500' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
            <div className="h-4 w-px bg-slate-200 mx-1" />
            <Button variant="outline" size="sm" className="h-8 text-xs font-semibold px-3 border-slate-200 bg-white text-slate-700 shadow-sm rounded-md hidden sm:flex pointer-events-none">
              <Database className="h-3.5 w-3.5 mr-1.5 text-emerald-500" />
              Optimal
            </Button>
          </div>
        </div>
      </header>

      <main className="p-4 md:p-6 max-w-7xl w-full mx-auto space-y-6 animate-in fade-in duration-300">
        
        {/* TOOLBAR */}
        <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm flex flex-col lg:flex-row gap-3 items-start lg:items-center justify-between">
           <div className="flex items-center gap-2 w-full lg:w-auto overflow-x-auto">
              <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-lg border border-slate-200">
                 <div className="pl-2 pr-1"><Store className="w-4 h-4 text-slate-400" /></div>
                 <Select value={selectedLocation} onValueChange={setSelectedLocation} disabled={isLocked}>
                   <SelectTrigger className="h-8 border-none bg-transparent shadow-none text-xs font-semibold text-slate-700 w-[180px] focus:ring-0">
                     <SelectValue placeholder="Select Location..." />
                   </SelectTrigger>
                   <SelectContent className="rounded-md border-slate-200 shadow-lg">
                     {isHQ && <SelectItem value="ALL" className="text-xs font-bold text-indigo-600">All Branches (HQ)</SelectItem>}
                     {warehouses.map(w => <SelectItem key={w.id} value={w.id} className="text-xs font-medium">{w.name}</SelectItem>)}
                   </SelectContent>
                 </Select>
              </div>
              <Button asChild variant="outline" size="sm" className="h-10 px-4 text-xs font-semibold border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg shadow-sm">
                 <Link href="/transfer"><Truck className="w-4 h-4 mr-2 text-indigo-500" /> Logistics</Link>
              </Button>
           </div>

           <div className="flex items-center gap-2 w-full lg:w-auto">
              <div className="relative flex-1 lg:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input 
                  placeholder="Search barcode or SKU..." 
                  className="pl-9 h-10 text-xs font-medium bg-slate-50 border-slate-200 focus-visible:bg-white focus-visible:border-slate-400 focus-visible:ring-1 focus-visible:ring-slate-400 rounded-lg transition-all" 
                  value={searchTerm} 
                  onChange={e => setSearchTerm(e.target.value)} 
                />
              </div>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="h-10 text-xs font-semibold border-slate-200 bg-white rounded-lg w-[140px] shadow-sm">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent className="rounded-md border-slate-200 shadow-lg">
                  <SelectItem value="all" className="text-xs font-medium">All Items</SelectItem>
                  <SelectItem value="in_stock" className="text-xs font-medium">Available</SelectItem>
                  <SelectItem value="transit" className="text-xs font-medium">In Transit</SelectItem>
                  <SelectItem value="exchanged" className="text-xs font-medium">Buybacks</SelectItem>
                </SelectContent>
              </Select>
           </div>
        </div>

        {/* TABS & TABLE CARD */}
        <Tabs defaultValue="active" className="space-y-4">
          <TabsList className="bg-transparent border-b border-slate-200 rounded-none h-11 w-full justify-start p-0 gap-6 mb-2">
            <TabsTrigger value="active" className="rounded-none border-b-2 border-transparent data-[state=active]:border-indigo-600 data-[state=active]:text-indigo-600 data-[state=active]:bg-transparent shadow-none h-full px-1 text-xs font-bold uppercase tracking-widest text-slate-500 transition-all hover:text-slate-800">
              Live Stock <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-slate-100 text-[9px] text-slate-600">{filteredActiveItems.length}</span>
            </TabsTrigger>
            <TabsTrigger value="sold" className="rounded-none border-b-2 border-transparent data-[state=active]:border-slate-800 data-[state=active]:bg-transparent shadow-none h-full px-1 text-xs font-bold uppercase tracking-widest text-slate-400 hover:text-slate-600 data-[state=active]:text-slate-800 transition-all">
              Archive / Sold <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-slate-100 text-[9px] text-slate-600">{soldItems.length}</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="active">
             <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                {loading ? <TableSkeleton /> : <InventoryTable data={filteredActiveItems} warehouses={warehouses} selectedIds={selectedIds} setSelectedIds={setSelectedIds} editingMrpId={editingMrpId} setEditingId={setEditingId} editingMrpVal={editingMrpVal} setEditingMrpVal={setEditingMrpVal} handleSaveMrp={handleSaveMrp} setTagItem={setTagItem} handleSingleTransfer={handleSingleTransfer} />}
             </div>
          </TabsContent>

          <TabsContent value="sold">
             <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                {loading ? <TableSkeleton /> : <InventoryTable data={soldItems} warehouses={warehouses} isSoldTab selectedIds={[]} setSelectedIds={()=>{}} editingMrpId={null} setEditingId={()=>{}} editingMrpVal="" setEditingMrpVal={()=>{}} handleSaveMrp={async()=>{}} setTagItem={setTagItem} handleSingleTransfer={()=>{}} />}
             </div>
          </TabsContent>
        </Tabs>

        {/* FLOATING BULK BAR */}
        {selectedIds.length > 0 && (
          <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white p-1.5 rounded-2xl shadow-2xl flex items-center gap-2 border border-slate-700/50 animate-in slide-in-from-bottom-8">
            <div className="flex items-center gap-2 pl-2 pr-3 border-r border-slate-700">
              <div className="h-7 w-7 bg-indigo-500 rounded-lg flex items-center justify-center text-[11px] font-bold shadow-inner">
                {selectedIds.length}
              </div>
              <span className="text-xs font-medium text-slate-300 whitespace-nowrap">Selected</span>
            </div>
            <div className="flex items-center gap-1">
              <Button size="sm" onClick={handleOpenCalc} className="h-8 px-4 text-xs font-semibold bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl shadow-sm transition-none whitespace-nowrap border border-emerald-400/50">
                <Calculator className="w-3.5 h-3.5 mr-1.5" /> Calc MRP
              </Button>
              <Button size="sm" onClick={handleBulkTransfer} className="h-8 px-4 text-xs font-semibold bg-white text-slate-900 hover:bg-slate-100 rounded-xl shadow-sm transition-none whitespace-nowrap">
                <Truck className="w-3.5 h-3.5 mr-1.5" /> Transfer
              </Button>
              <Button size="icon" variant="ghost" onClick={() => setSelectedIds([])} className="h-8 w-8 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl ml-1 transition-none shrink-0">
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </main>

      {/* ==============================================================
          BULK IMPORT & MANUAL ENTRY MODAL
          ============================================================== */}
      <Dialog open={isImportModalOpen} onOpenChange={(open) => {
         setIsImportModalOpen(open); 
         if(!open) { setImportStep('input'); setStagedImportItems([]); }
      }}>
        <DialogContent className={cn("p-0 overflow-hidden border-slate-200 shadow-2xl rounded-xl bg-white transition-all", importStep === 'verify' ? 'sm:max-w-[850px]' : 'sm:max-w-[600px]')}>
          <DialogHeader className="bg-slate-50 p-5 border-b border-slate-200 shrink-0">
            <DialogTitle className="text-base font-semibold text-slate-900 flex items-center gap-2">
               <FileSpreadsheet className="w-4 h-4 text-indigo-600" /> 
               {importStep === 'input' ? 'Add Inventory' : 'Verify & Commit Ledger'}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500 mt-1 leading-relaxed">
              {importStep === 'input' 
                ? `Upload a CSV file or manually stage single items. Destination: ${warehouses.find(w=>w.id === selectedLocation)?.name || 'HQ'}`
                : `Review the ${stagedImportItems.length} parsed items before committing them to the database.`
              }
            </DialogDescription>
          </DialogHeader>

          {importStep === 'input' ? (
            <div className="p-5 flex flex-col h-[50vh] max-h-[500px]">
              <Tabs defaultValue="csv" className="flex flex-col h-full">
                <TabsList className="grid w-full grid-cols-2 shrink-0 bg-slate-100 p-1 rounded-lg">
                   <TabsTrigger value="csv" className="rounded-md text-xs font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm">Upload CSV File</TabsTrigger>
                   <TabsTrigger value="manual" className="rounded-md text-xs font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm">Single Entry Form</TabsTrigger>
                </TabsList>
                
                <div className="flex-1 overflow-y-auto mt-4 custom-scrollbar pr-2">
                  <TabsContent value="csv" className="m-0 space-y-4">
                     <div className="bg-indigo-50/50 border border-indigo-100 p-4 rounded-lg flex gap-3 items-start">
                       <AlertCircle className="w-5 h-5 text-indigo-500 shrink-0 mt-0.5" />
                       <div className="text-[11px] text-indigo-700 leading-relaxed font-medium">
                         <p className="font-bold mb-1">Required CSV Column Format:</p>
                         <code className="bg-white px-2 py-1 rounded border border-indigo-200 block text-[9px] shadow-sm">
                           Barcode, Category, Metal, Purity, Gross Wt, Net Wt, Stone Cts, MRP
                         </code>
                       </div>
                     </div>
                     
                     <div 
                       className="border-2 border-dashed border-slate-300 rounded-xl p-8 flex flex-col items-center justify-center bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer group"
                       onClick={() => fileInputRef.current?.click()}
                     >
                        <input type="file" accept=".csv, .tsv, .txt" className="hidden" ref={fileInputRef} onChange={handleFileUpload} />
                        <div className="h-12 w-12 bg-white border border-slate-200 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-sm">
                          <UploadCloud className="w-6 h-6 text-slate-400" />
                        </div>
                        <p className="text-sm font-bold text-slate-700 mb-1">Click to browse files</p>
                        <p className="text-xs text-slate-500">Supports .csv (comma separated)</p>
                     </div>
                  </TabsContent>

                  <TabsContent value="manual" className="m-0">
                     <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                        <div className="space-y-1.5">
                          <Label className="text-[10px] font-bold text-slate-500 uppercase">Barcode *</Label>
                          <Input className="h-9 text-xs rounded-md border-slate-300" value={manualEntry.barcode} onChange={e => setManualEntry({...manualEntry, barcode: e.target.value})} placeholder="e.g. RING001" />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-[10px] font-bold text-slate-500 uppercase">Category</Label>
                          <Input className="h-9 text-xs rounded-md border-slate-300" value={manualEntry.item_category} onChange={e => setManualEntry({...manualEntry, item_category: e.target.value})} placeholder="e.g. Solitaire Ring" />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-[10px] font-bold text-slate-500 uppercase">Metal Type</Label>
                          <Input className="h-9 text-xs rounded-md border-slate-300" value={manualEntry.metal_type} onChange={e => setManualEntry({...manualEntry, metal_type: e.target.value})} placeholder="Gold" />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-[10px] font-bold text-slate-500 uppercase">Purity</Label>
                          <Input className="h-9 text-xs rounded-md border-slate-300" value={manualEntry.purity_karat} onChange={e => setManualEntry({...manualEntry, purity_karat: e.target.value})} placeholder="22K" />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-[10px] font-bold text-slate-500 uppercase">Gross Weight (g) *</Label>
                          <Input type="number" className="h-9 text-xs rounded-md border-slate-300" value={manualEntry.gross_weight_g} onChange={e => setManualEntry({...manualEntry, gross_weight_g: e.target.value})} placeholder="0.000" />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-[10px] font-bold text-slate-500 uppercase">Net Weight (g)</Label>
                          <Input type="number" className="h-9 text-xs rounded-md border-slate-300" value={manualEntry.net_weight_g} onChange={e => setManualEntry({...manualEntry, net_weight_g: e.target.value})} placeholder="0.000" />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-[10px] font-bold text-slate-500 uppercase">Stone Weight (ct)</Label>
                          <Input type="number" className="h-9 text-xs rounded-md border-slate-300" value={manualEntry.total_stone_weight_cts} onChange={e => setManualEntry({...manualEntry, total_stone_weight_cts: e.target.value})} placeholder="0.00" />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-[10px] font-bold text-slate-500 uppercase">MRP (₹)</Label>
                          <Input type="number" className="h-9 text-xs rounded-md border-slate-300" value={manualEntry.mrp} onChange={e => setManualEntry({...manualEntry, mrp: e.target.value})} placeholder="Optional" />
                        </div>
                        <div className="col-span-2 pt-2">
                           <Button onClick={handleManualAdd} className="w-full h-9 bg-slate-900 hover:bg-slate-800 text-xs font-bold shadow-sm rounded-lg">
                             <PlusCircle className="w-4 h-4 mr-2" /> Add to Staging Queue
                           </Button>
                        </div>
                     </div>
                  </TabsContent>
                </div>
              </Tabs>
            </div>
          ) : (
            <div className="max-h-[60vh] overflow-y-auto border-b border-slate-200 custom-scrollbar bg-slate-50">
              <Table>
                <TableHeader className="bg-white sticky top-0 shadow-sm z-10">
                  <TableRow className="border-none hover:bg-transparent">
                    <TableHead className="text-[10px] font-bold uppercase text-slate-500 h-9 px-4">Barcode</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase text-slate-500 h-9">Category</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase text-slate-500 h-9 text-right">Net Wt</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase text-slate-500 h-9 text-right">Stn Cts</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase text-slate-500 h-9 text-right pr-4">MRP</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stagedImportItems.map((item, idx) => (
                    <TableRow key={idx} className="border-b border-slate-200 last:border-none hover:bg-white">
                      <TableCell className="py-2 px-4 text-xs font-mono font-bold text-slate-900">{item.barcode}</TableCell>
                      <TableCell className="py-2 text-xs text-slate-600">
                        {item.item_category} <span className="text-[9px] text-slate-400">({item.metal_type} {item.purity_karat})</span>
                      </TableCell>
                      <TableCell className="py-2 text-xs text-right font-medium">{item.net_weight_g.toFixed(3)}g</TableCell>
                      <TableCell className="py-2 text-xs text-right text-blue-600">{item.total_stone_weight_cts.toFixed(2)}ct</TableCell>
                      <TableCell className="py-2 text-xs font-bold text-right text-slate-900 pr-4">
                        {item.mrp ? `₹${item.mrp.toLocaleString()}` : '---'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          <DialogFooter className="bg-slate-50 p-4 border-t border-slate-200 flex flex-row items-center justify-between gap-3 shrink-0">
             {importStep === 'input' ? (
               <>
                 <div className="flex items-center text-xs font-bold text-slate-600">
                    Staged Items: <Badge variant="secondary" className="ml-2 px-2 h-5 bg-white border border-slate-200">{stagedImportItems.length}</Badge>
                 </div>
                 <div className="flex gap-2">
                   <Button variant="ghost" className="h-9 text-xs font-semibold rounded-lg text-slate-600 hover:bg-slate-100" onClick={() => setIsImportModalOpen(false)}>Cancel</Button>
                   <Button onClick={() => setImportStep('verify')} disabled={stagedImportItems.length === 0} className="h-9 text-xs font-bold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm">
                     Proceed to Verify <ArrowRight className="w-3.5 h-3.5 ml-2" />
                   </Button>
                 </div>
               </>
             ) : (
               <>
                 <Button variant="outline" className="h-10 text-xs font-semibold rounded-lg border-slate-300 text-slate-700 bg-white hover:bg-slate-50" onClick={() => setImportStep('input')}>
                   <ArrowLeft className="w-3.5 h-3.5 mr-2" /> Back
                 </Button>
                 <Button onClick={handleCommitImport} disabled={isImporting} className="h-10 px-6 text-xs font-bold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm">
                   {isImporting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Database className="w-4 h-4 mr-2" />}
                   Commit {stagedImportItems.length} Items to Ledger
                 </Button>
               </>
             )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MRP CALCULATOR MODAL (MULTI-STEP WIZARD) */}
      <Dialog open={isCalcModalOpen} onOpenChange={setCalcModalOpen}>
        <DialogContent className={cn("p-0 overflow-hidden border-slate-200 shadow-2xl rounded-xl bg-white transition-all", calcStep === 'preview' ? 'sm:max-w-[650px]' : 'sm:max-w-[450px]')}>
          <DialogHeader className="bg-slate-50 p-5 border-b border-slate-200">
            <DialogTitle className="text-base font-semibold text-slate-900 flex items-center gap-2">
               <Calculator className="w-4 h-4 text-indigo-600" /> 
               {calcStep === 'params' ? 'Dynamic MRP Parameters' : 'Verification & Preview'}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500 mt-1 leading-relaxed">
              {calcStep === 'params' 
                ? `System detected ${Object.keys(goldRates).length} distinct metal purities across the ${selectedIds.length} selected items.`
                : `Review the calculated retail prices before committing changes to the database.`
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
                    <TableHead className="text-[10px] font-bold uppercase text-slate-500 h-9">Asset ID</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase text-slate-500 h-9">Profile</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase text-slate-500 h-9 text-right">Net Wt</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase text-slate-500 h-9 text-right">Old MRP</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase text-indigo-600 h-9 text-right pr-6">Calculated MRP</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewData.map((item) => {
                    const isDiff = item.mrp !== item.newMrp;
                    return (
                      <TableRow key={item.id} className="border-b border-slate-100 last:border-none">
                        <TableCell className="py-2.5 font-mono text-xs font-semibold text-slate-900">{item.barcode}</TableCell>
                        <TableCell className="py-2.5 text-xs text-slate-600">{item.purity_karat || '24K'}</TableCell>
                        <TableCell className="py-2.5 text-xs text-right font-medium">{item.net_weight_g?.toFixed(3)}g</TableCell>
                        <TableCell className="py-2.5 text-xs text-right text-slate-400 line-through">
                          {item.mrp ? `₹${item.mrp.toLocaleString()}` : '---'}
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
                    disabled={isCalculating}
                    className="flex-[2] h-10 text-xs font-bold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
                  >
                   {isCalculating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <><Check className="w-4 h-4 mr-2" /> Save to Database</>}
                 </Button>
               </>
             )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* TAG PREVIEW DIALOG (Unchanged) */}
      <Dialog open={!!tagItem} onOpenChange={() => setTagItem(null)}>
        <DialogContent className="sm:max-w-[550px] p-0 overflow-hidden border-slate-200 shadow-2xl rounded-xl bg-white">
          <DialogHeader className="bg-slate-50 p-5 border-b border-slate-200">
            <DialogTitle className="text-base font-semibold text-slate-900 flex items-center gap-2">
               <Printer className="w-4 h-4 text-slate-500" /> Thermal Label Layout
            </DialogTitle>
          </DialogHeader>
          
          <div className="flex flex-col items-center justify-center py-10 bg-slate-100/50 min-h-[250px] overflow-x-auto">
            <div ref={labelRef} className="bg-white text-black flex border border-gray-300 shadow-sm print:border-none print:shadow-none overflow-hidden shrink-0" style={{ width: '100mm', height: '20mm', fontFamily: 'Arial, sans-serif', boxSizing: 'border-box' }}>
              <style type="text/css" media="print">{`@page { size: 100mm 20mm; margin: 0; } body { margin: 0; padding: 0; background: white; -webkit-print-color-adjust: exact; print-color-adjust: exact; }`}</style>
              <div className="flex w-[70mm] h-full">
                <div className="flex flex-col justify-center h-full w-[34mm] pl-[2mm]" style={{ fontSize: '5.8px', lineHeight: '1.15', fontWeight: 'bold' }}>
                  <h2 className="font-extrabold uppercase tracking-tight text-[8px] leading-none mb-[1px]">PAVITRAM</h2>
                  <div className="uppercase tracking-widest text-[5px] text-gray-600 mb-[2px] border-b border-gray-200 pb-[1px]">{tagItem?.item_category || 'CATEGORY'}</div>
                  <div className="flex"><span className="w-[9mm]">TAG</span><span>: {tagItem?.barcode?.slice(-6) || '---'}</span></div>
                  <div className="flex"><span className="w-[9mm]">STYLE</span><span>: {tagItem?.sku_reference || '---'}</span></div>
                  <div className="flex"><span className="w-[9mm]">KT/GW</span><span>: {tagItem?.purity_karat || 'N/A'} / {Number(tagItem?.gross_weight_g||0).toFixed(3)}</span></div>
                  <div className="flex"><span className="w-[9mm]">{Number(tagItem?.total_stone_pieces) <= 1 ? 'CS' : 'RD'}</span><span>: {tagItem?.total_stone_pieces || 0} / {Number(tagItem?.total_stone_weight_cts||0).toFixed(3)}</span></div>
                  <div className="flex"><span className="w-[9mm]">NET</span><span>: {Number(tagItem?.net_weight_g||0).toFixed(3)}</span></div>
                </div>
                <div className="w-[2mm] h-full flex items-center justify-center"><div className="h-full w-[1px] border-l border-dashed border-gray-300 print:border-none opacity-50" /></div>
                <div className="flex flex-col justify-center items-center h-full w-[34mm] pr-[2mm]">
                  {tagItem?.barcode ? <div className="bg-white p-0.5"><QRCode value={tagItem.barcode} size={64} level="M" style={{ height: "16mm", width: "16mm" }} /></div> : <div className="h-[16mm] w-[16mm] bg-gray-100 flex items-center justify-center border border-dashed border-gray-300 text-[5px] text-gray-400">N/A</div>}
                </div>
              </div>
              <div className="w-[30mm] h-full bg-gray-50 print:bg-white border-l border-gray-200 print:border-none flex items-center justify-center">
                 <span className="text-[5px] text-gray-300 print:hidden rotate-90 tracking-widest">TAIL AREA</span>
              </div>
            </div>
          </div>
          <DialogFooter className="bg-slate-50 p-4 border-t border-slate-200 flex-row gap-3">
             <Button variant="outline" className="flex-1 h-10 text-xs font-semibold rounded-lg border-slate-300 text-slate-700 bg-white hover:bg-slate-50" onClick={downloadTagImage}><Download className="w-4 h-4 mr-2 text-slate-400" /> Save PNG</Button>
             <Button className="flex-[2] h-10 text-xs font-bold rounded-lg bg-slate-900 hover:bg-slate-800 text-white" onClick={() => handlePrint()}><Printer className="w-4 h-4 mr-2" /> Print (TSC)</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// --- HYBRID RENDER TABLE ---
function InventoryTable({ data, isSoldTab, selectedIds, setSelectedIds, editingMrpId, setEditingId, editingMrpVal, setEditingMrpVal, handleSaveMrp, setTagItem, handleSingleTransfer }: any) {
  return (
    <div className="h-full flex flex-col">
      {/* DESKTOP VIEW */}
      <div className="hidden md:block overflow-x-auto custom-scrollbar">
        <Table>
          <TableHeader className="bg-slate-50/80 border-b border-slate-200">
            <TableRow className="hover:bg-transparent border-none">
              {!isSoldTab && (
                <TableHead className="w-[40px] px-4 h-10">
                  <Checkbox 
                    checked={selectedIds.length === data.length && data.length > 0} 
                    onCheckedChange={() => setSelectedIds(selectedIds.length === data.length ? [] : data.map((i: any) => i.id))} 
                    className="rounded-[4px] border-slate-300 data-[state=checked]:bg-indigo-600 data-[state=checked]:border-indigo-600"
                  />
                </TableHead>
              )}
              <TableHead className="text-[10px] font-bold uppercase tracking-wider text-slate-500 h-10">Identifier / SKU</TableHead>
              <TableHead className="text-[10px] font-bold uppercase tracking-wider text-slate-500 h-10">Specs</TableHead>
              <TableHead className="text-[10px] font-bold uppercase tracking-wider text-slate-500 h-10 text-right px-4">Weights</TableHead>
              <TableHead className="text-[10px] font-bold uppercase tracking-wider text-slate-500 h-10 text-center">Status</TableHead>
              <TableHead className="text-[10px] font-bold uppercase tracking-wider text-slate-500 h-10 w-[180px]">Retail Price</TableHead>
              <TableHead className="w-[100px] text-right px-6"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((item: any) => (
              <TableRow key={item.id} className={cn("transition-colors border-b border-slate-100 last:border-0 hover:bg-slate-50/80", selectedIds.includes(item.id) && "bg-indigo-50/30")}>
                {!isSoldTab && (
                  <TableCell className="px-4 py-3">
                    <Checkbox 
                      checked={selectedIds.includes(item.id)} 
                      onCheckedChange={() => setSelectedIds((prev: any) => prev.includes(item.id) ? prev.filter((i: any) => i !== item.id) : [...prev, item.id])} 
                      disabled={item.status !== 'in_stock'} 
                      className="rounded-[4px] border-slate-300 data-[state=checked]:bg-indigo-600 data-[state=checked]:border-indigo-600 disabled:opacity-30"
                    />
                  </TableCell>
                )}
                <TableCell className="py-3">
                  <div className="flex flex-col">
                     <span className="font-mono font-semibold text-sm text-slate-900 tracking-tight leading-tight">{item.barcode}</span>
                     <span className="text-[10px] text-slate-500 font-medium uppercase tracking-wider mt-0.5">{item.sku_reference || 'NO SKU'}</span>
                     {item.is_exchanged && <span className="text-[9px] font-bold text-purple-600 uppercase tracking-widest mt-1">Buyback Asset</span>}
                  </div>
                </TableCell>
                <TableCell className="py-3">
                   <div className="text-xs font-semibold text-slate-900">{item.item_category}</div>
                   <div className="text-[10px] text-slate-500 font-medium uppercase tracking-wider mt-0.5">{item.metal_type} ({item.purity_karat}) · Size {item.item_size || 'N/A'}</div>
                </TableCell>
                <TableCell className="text-right px-4 py-3">
                   <div className="flex flex-col items-end">
                      <span className="text-xs font-semibold text-slate-900">{item.net_weight_g?.toFixed(3)}g <span className="text-[9px] font-medium text-slate-400 ml-0.5">NET</span></span>
                      <span className="text-[10px] text-blue-600 font-semibold uppercase mt-0.5">{item.total_stone_weight_cts?.toFixed(2)}ct <span className="text-[9px] font-medium text-slate-400 ml-0.5">STN</span></span>
                   </div>
                </TableCell>
                <TableCell className="text-center py-3">
                   <span className={cn("inline-flex items-center justify-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border", item.status === 'in_stock' ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-50 text-slate-500 border-slate-200")}>
                     {item.status.replace('_', ' ')}
                   </span>
                </TableCell>
                <TableCell className="py-3">
                   {editingMrpId === item.id ? (
                     <div className="flex items-center gap-1.5">
                       <Input className="h-8 w-24 text-xs font-semibold rounded-md border-slate-300 focus-visible:ring-indigo-500" value={editingMrpVal} onChange={e => setEditingMrpVal(e.target.value)} autoFocus />
                       <Button size="icon" variant="ghost" className="h-8 w-8 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 rounded-md shadow-sm border border-emerald-100" onClick={() => handleSaveMrp(item.id)}>
                         <Check className="w-4 h-4" />
                       </Button>
                     </div>
                   ) : (
                     <div className="group flex items-center gap-2 cursor-pointer w-max" onClick={() => { if(!isSoldTab) { setEditingId(item.id); setEditingMrpVal(item.mrp?.toString() || '') }}}>
                       <span className="text-xs font-semibold text-slate-900">{item.mrp ? `₹${item.mrp.toLocaleString()}` : 'Market Rate'}</span>
                       {!isSoldTab && <Edit2 className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 text-slate-400 hover:text-indigo-600 transition-all" />}
                     </div>
                   )}
                </TableCell>
                <TableCell className="text-right px-6 py-3">
                   <div className="flex justify-end gap-1.5">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors" onClick={() => setTagItem(item)} title="Print Label">
                        <Printer className="h-4 w-4" />
                      </Button>
                      {!isSoldTab && item.status === 'in_stock' && (
                         <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors" onClick={() => handleSingleTransfer(item)} title="Transfer">
                           <Truck className="h-4 w-4" />
                         </Button>
                      )}
                   </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* MOBILE VIEW (Stacked Action Cards) */}
      <div className="md:hidden flex flex-col gap-3 bg-slate-50/50 p-3 flex-1 overflow-y-auto custom-scrollbar">
        {data.map((item: any) => (
          <div key={item.id} className={cn("bg-white border rounded-xl p-4 shadow-sm flex flex-col gap-3", selectedIds.includes(item.id) ? "border-indigo-300 ring-1 ring-indigo-100" : "border-slate-200")}>
            <div className="flex justify-between items-start">
               <div className="flex items-center gap-3">
                 {!isSoldTab && (
                   <Checkbox 
                     checked={selectedIds.includes(item.id)} 
                     onCheckedChange={() => setSelectedIds((prev: any) => prev.includes(item.id) ? prev.filter((i: any) => i !== item.id) : [...prev, item.id])} 
                     disabled={item.status !== 'in_stock'}
                     className="rounded-[4px] border-slate-300 data-[state=checked]:bg-indigo-600 data-[state=checked]:border-indigo-600 disabled:opacity-30"
                   />
                 )}
                 <div>
                   <span className="font-mono font-semibold text-sm text-slate-900 tracking-tight leading-tight">{item.barcode}</span>
                   <span className="block text-[10px] text-slate-500 font-medium uppercase tracking-wider mt-0.5">{item.sku_reference || 'NO SKU'}</span>
                 </div>
               </div>
               <span className={cn("inline-flex items-center justify-center px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider border", item.status === 'in_stock' ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-50 text-slate-500 border-slate-200")}>
                 {item.status.replace('_', ' ')}
               </span>
            </div>
            
            <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-lg border border-slate-100">
               <div>
                 <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Specs</p>
                 <p className="text-xs font-semibold text-slate-900">{item.item_category}</p>
                 <p className="text-[10px] text-slate-500">{item.metal_type} ({item.purity_karat})</p>
               </div>
               <div className="text-right">
                 <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Weights</p>
                 <p className="text-xs font-semibold text-slate-900">{item.net_weight_g?.toFixed(3)}g <span className="text-[9px] text-slate-400">NET</span></p>
                 <p className="text-[10px] text-blue-600 font-semibold">{item.total_stone_weight_cts?.toFixed(2)}ct <span className="text-[9px] text-slate-400">STN</span></p>
               </div>
            </div>

            <div className="flex justify-between items-end pt-1">
               <div>
                 <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Retail Price</p>
                 {editingMrpId === item.id ? (
                   <div className="flex items-center gap-1.5">
                     <Input className="h-8 w-24 text-xs font-semibold rounded-md border-slate-300 focus-visible:ring-indigo-500" value={editingMrpVal} onChange={e => setEditingMrpVal(e.target.value)} autoFocus />
                     <Button size="icon" variant="ghost" className="h-8 w-8 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 rounded-md shadow-sm border border-emerald-100" onClick={() => handleSaveMrp(item.id)}>
                       <Check className="w-4 h-4" />
                     </Button>
                   </div>
                 ) : (
                   <div className="group flex items-center gap-2 cursor-pointer w-max" onClick={() => { if(!isSoldTab) { setEditingId(item.id); setEditingMrpVal(item.mrp?.toString() || '') }}}>
                     <span className="text-sm font-bold text-slate-900">{item.mrp ? `₹${item.mrp.toLocaleString()}` : 'Market Rate'}</span>
                     {!isSoldTab && <Edit2 className="w-3.5 h-3.5 text-slate-400" />}
                   </div>
                 )}
               </div>
               <div className="flex gap-1.5">
                 <Button variant="outline" size="icon" className="h-8 w-8 text-slate-500 border-slate-200 bg-white" onClick={() => setTagItem(item)}>
                   <Printer className="h-3.5 w-3.5" />
                 </Button>
                 {!isSoldTab && item.status === 'in_stock' && (
                   <Button variant="outline" size="icon" className="h-8 w-8 text-indigo-600 border-indigo-200 bg-indigo-50" onClick={() => handleSingleTransfer(item)}>
                     <Truck className="h-3.5 w-3.5" />
                   </Button>
                 )}
               </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}