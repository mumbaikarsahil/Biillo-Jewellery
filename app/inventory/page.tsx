"use client"

import React, { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"

import { 
  Search, Printer, Edit2, Check, X, Store, Truck, 
  RefreshCw, Database, Package, Calculator, Gem, Hammer, 
  ArrowLeft, Upload, Eye, Image as ImageIcon, CheckCircle2, Box, Layers, Wrench
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

// IMPORT YOUR NEW COMPONENT
import { ItemTagPreview } from "@/components/ItemTagPreview" 

// Unified Interface to handle both Inventory and Repairs
interface InventoryItem {
  id: string
  _type: 'inventory' | 'repair' 
  barcode: string
  sku_reference: string
  item_category: string
  item_size: string
  metal_type: string
  purity_karat: string
  purity_percent: number
  gross_weight_g: number
  net_weight_g: number
  total_stone_weight_cts: number
  total_stone_pieces: number
  mrp: number | null
  status: string
  warehouse_id: string
  is_exchanged: boolean
  is_custom_order: boolean
  is_repair_ticket: boolean
  custom_order_id: string | null
  origin_name?: string
  custom_orders?: {
    id: string
    order_number: string
    origin?: {
      name: string
    }
  }
  huid_code: string | null
  hsn_code: string | null
  image_url: string | null
  remarks: string | null
  metal_color: string | null
  diamond_shape: string | null
  diamond_color: string | null
  diamond_clarity: string | null
  cost_metal: number
  cost_stone: number
  cost_making: number
  cost_total: number
  wastage_weight_g: number
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

  // Full Details Modal State
  const [viewItem, setViewItem] = useState<InventoryItem | null>(null)

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
      // 1. FETCH INVENTORY ITEMS
      let invQuery = supabase
        .from('inventory_items')
        .select(`*, custom_orders (id, order_number, origin:origin_warehouse_id(name))`)
        .eq('company_id', appUser.company_id)

      if (selectedLocation !== 'ALL') {
        invQuery = invQuery.eq('warehouse_id', selectedLocation)
      }

      // 2. FETCH REPAIR TICKETS (that act like inventory)
      let repQuery = supabase
        .from('repair_tickets')
        .select(`*, origin:warehouses!repair_tickets_origin_warehouse_id_fkey(name)`)
        .eq('company_id', appUser.company_id)
        
      const [invRes, repRes] = await Promise.all([invQuery, repQuery])

      if (invRes.error) throw invRes.error
      if (repRes.error) throw repRes.error

      // Tag real inventory items
      const inventoryList = (invRes.data || []).map(item => ({ ...item, _type: 'inventory' as const, is_repair_ticket: false }))

      // Map Repair Tickets to look exactly like Inventory Items
      const repairList = (repRes.data || []).map(rep => ({
        id: rep.id,
        _type: 'repair' as const,
        barcode: rep.ticket_number,
        sku_reference: 'REPAIR TICKET',
        item_category: rep.item_description || 'Repair Service',
        item_size: 'N/A',
        metal_type: 'Mixed',
        purity_karat: rep.purity || 'N/A',
        purity_percent: 0,
        gross_weight_g: rep.gross_weight_g || 0, // Customer's total original item weight
        net_weight_g: rep.issued_gold_g || 0, // The actual factory gold added
        total_stone_weight_cts: rep.issued_diamond_cts || 0, // The actual factory diamonds added
        total_stone_pieces: 0,
        mrp: rep.actual_cost || 0, 
        status: rep.status,
        warehouse_id: rep.status === 'fixed_ready_for_dispatch' && warehouses.find(w => w.name.includes('HQ'))?.id 
                        ? warehouses.find(w => w.name.includes('HQ'))?.id || rep.origin_warehouse_id 
                        : rep.origin_warehouse_id, 
        is_exchanged: false,
        is_custom_order: false,
        is_repair_ticket: true,
        custom_order_id: null,
        origin_name: rep.origin?.name || 'Unknown Branch',
        huid_code: null,
        hsn_code: '9987', 
        image_url: null, 
        remarks: rep.issue_description || '',
        metal_color: 'N/A',
        diamond_shape: null,
        diamond_color: null,
        diamond_clarity: null,
        cost_metal: 0,
        cost_stone: 0,
        cost_making: rep.labor_charges || 0,
        cost_total: rep.actual_cost || 0,
        wastage_weight_g: 0,
        created_at: rep.created_at 
      }))

      // Filter repairs based on the selected location dropdown
      const filteredRepairs = selectedLocation === 'ALL' 
        ? repairList 
        : repairList.filter(r => r.warehouse_id === selectedLocation || (r.status === 'fixed_ready_for_dispatch' && isHQ));

      // Combine and sort by newest first
      const combined = [...inventoryList, ...filteredRepairs].sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      setItems(combined)
    } catch (error) { toast.error('Failed to load inventory') } 
    finally { setLoading(false) }
  }

  useEffect(() => { fetchItems() }, [appUser, selectedLocation])

  const handleSaveMrp = async (id: string) => {
    const item = items.find(i => i.id === id);
    if (!item) return;

    const newMrp = editingMrpVal ? Number(editingMrpVal) : null;

    if (item._type === 'repair') {
      const { error } = await supabase.from('repair_tickets').update({ actual_cost: newMrp }).eq('id', id);
      if (error) return toast.error('Failed to update repair cost');
    } else {
      const { error } = await supabase.from('inventory_items').update({ mrp: newMrp }).eq('id', id);
      if (error) return toast.error('Failed to update price');
    }
    
    setItems(items.map(i => i.id === id ? { ...i, mrp: newMrp } : i))
    setEditingId(null)
    toast.success('Price updated')
  }

  const handleOpenCalc = () => {
    // Only allow MRP calculation on real inventory items, not repairs
    const selectedItems = items.filter(i => selectedIds.includes(i.id) && i._type === 'inventory')
    
    if (selectedItems.length === 0) {
      return toast.error("No valid items selected.", { description: "Repairs cannot be bulk-calculated. Select standard inventory." })
    }

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
    const selectedItems = items.filter(i => selectedIds.includes(i.id) && i._type === 'inventory')
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

  const filteredActiveItems = items.filter(item => {
    if (item.status === 'sold' || item.status === 'delivered') return false; 
    const matchesSearch = item.barcode?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          item.sku_reference?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          item.item_category?.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (filterStatus === 'all') return matchesSearch;
    if (filterStatus === 'repairs') return matchesSearch && item._type === 'repair';
    if (filterStatus === 'exchanged') return matchesSearch && item.is_exchanged === true;
    return matchesSearch && item.status === filterStatus;
  });

  const soldItems = items.filter(item => {
    const matchesSearch = item.barcode?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          item.item_category?.toLowerCase().includes(searchTerm.toLowerCase())
    return (item.status === 'sold' || item.status === 'delivered') && matchesSearch
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
            <Button asChild variant="ghost" size="sm" className="h-8 px-3 text-xs font-semibold text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 rounded-md transition-none border border-transparent hover:border-indigo-200 hidden sm:flex">
              <Link href="/inventory/import">
                <Upload className="h-3.5 w-3.5 mr-1.5" />
                <span className="hidden sm:inline">Add / Import Stock</span>
              </Link>
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
                  <SelectItem value="repairs" className="text-xs font-medium text-amber-600">Repairs</SelectItem>
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
                {loading ? <TableSkeleton /> : <InventoryTable data={filteredActiveItems} warehouses={warehouses} selectedIds={selectedIds} setSelectedIds={setSelectedIds} editingMrpId={editingMrpId} setEditingId={setEditingId} editingMrpVal={editingMrpVal} setEditingMrpVal={setEditingMrpVal} handleSaveMrp={handleSaveMrp} setTagItem={setTagItem} handleSingleTransfer={handleSingleTransfer} setViewItem={setViewItem} />}
             </div>
          </TabsContent>

          <TabsContent value="sold">
             <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                {loading ? <TableSkeleton /> : <InventoryTable data={soldItems} warehouses={warehouses} isSoldTab selectedIds={[]} setSelectedIds={()=>{}} editingMrpId={null} setEditingId={()=>{}} editingMrpVal="" setEditingMrpVal={()=>{}} handleSaveMrp={async()=>{}} setTagItem={setTagItem} handleSingleTransfer={()=>{}} setViewItem={setViewItem} />}
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

      {/* VIEW DETAILS MODAL */}
      <Dialog open={!!viewItem} onOpenChange={(val) => !val && setViewItem(null)}>
        <DialogContent className="sm:max-w-[700px] p-0 overflow-hidden border-slate-200 shadow-2xl rounded-xl bg-slate-50">
          {viewItem && (
            <>
              <DialogHeader className="bg-white p-5 border-b border-slate-200 flex flex-row items-center justify-between">
                <div>
                  <DialogTitle className="text-lg font-bold text-slate-900 font-mono flex items-center gap-2">
                    {viewItem._type === 'repair' ? <Wrench className="w-5 h-5 text-amber-500" /> : <Package className="w-5 h-5 text-indigo-500" />}
                    {viewItem.barcode}
                  </DialogTitle>
                  <DialogDescription className="text-xs font-medium text-slate-500 mt-1 uppercase tracking-widest">
                    {viewItem.item_category} • {viewItem.sku_reference}
                  </DialogDescription>
                </div>
                <div className="flex flex-col items-end gap-1">
                   <Badge className={cn("text-[10px] uppercase tracking-widest border", 
                      viewItem._type === 'repair' ? "bg-amber-50 text-amber-700 border-amber-200" :
                      viewItem.status === 'in_stock' ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-100 text-slate-600 border-slate-200")}>
                     {viewItem.status.replace(/_/g, ' ')}
                   </Badge>
                   {viewItem.is_custom_order && <Badge className="bg-purple-100 text-purple-700 border-purple-200 text-[9px] uppercase tracking-widest">Custom: {viewItem.custom_orders?.origin?.name || 'Branch'}</Badge>}
                   {viewItem.is_repair_ticket && <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-[9px] uppercase tracking-widest">Repair: {viewItem.origin_name}</Badge>}
                </div>
              </DialogHeader>
              
              <div className="p-6 overflow-y-auto max-h-[70vh] custom-scrollbar space-y-6">
                
                {/* Visual Header */}
                <div className="flex flex-col md:flex-row gap-6">
                  <div className="w-full md:w-48 h-48 bg-white border border-slate-200 rounded-xl flex items-center justify-center shrink-0 overflow-hidden shadow-sm">
                    {viewItem.image_url ? (
                      <img src={viewItem.image_url} alt="Item" className="w-full h-full object-cover" />
                    ) : (
                      <div className="text-center text-slate-400">
                        <ImageIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <span className="text-[10px] font-bold uppercase tracking-widest">No Image</span>
                      </div>
                    )}
                  </div>

                  <div className="flex-1 grid grid-cols-2 gap-4">
                    <div className="bg-white p-4 border border-slate-200 rounded-xl shadow-sm space-y-1">
                      <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5"><Database className="w-3 h-3 text-amber-500"/> Metal Info</Label>
                      <p className="text-sm font-bold text-slate-900">{viewItem.metal_type} {viewItem.purity_karat !== 'N/A' ? `(${viewItem.purity_karat})` : ''}</p>
                      <p className="text-xs text-slate-500">{viewItem.purity_percent}% Purity • {viewItem.metal_color || 'Std Color'}</p>
                    </div>
                    <div className="bg-white p-4 border border-slate-200 rounded-xl shadow-sm space-y-1">
                      <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5"><Gem className="w-3 h-3 text-blue-500"/> Stone Info</Label>
                      <p className="text-sm font-bold text-slate-900">{viewItem.total_stone_weight_cts} cts</p>
                      <p className="text-xs text-slate-500">{viewItem.total_stone_pieces} Pieces</p>
                    </div>
                    <div className="bg-white p-4 border border-slate-200 rounded-xl shadow-sm space-y-1 col-span-2">
                      <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                        <Box className="w-3 h-3 text-emerald-500"/> 
                        {viewItem._type === 'repair' ? 'Added Materials (Consumed)' : 'Physical Weights'}
                      </Label>
                      <div className="flex justify-between items-end mt-1">
                        <div>
                           <p className="text-[10px] text-slate-400 font-medium">{viewItem._type === 'repair' ? 'Customer Gross' : 'Gross'}</p>
                           <p className="text-sm font-semibold">{viewItem.gross_weight_g}g</p>
                        </div>
                        <div>
                           <p className="text-[10px] text-slate-400 font-medium text-center">{viewItem._type === 'repair' ? 'Gold Added' : 'Net'}</p>
                           <p className="text-sm font-bold text-emerald-700">{viewItem.net_weight_g}g</p>
                        </div>
                        <div className="text-right">
                           <p className="text-[10px] text-slate-400 font-medium">Wastage</p>
                           <p className="text-sm font-semibold text-red-600">{viewItem.wastage_weight_g || 0}g</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Identification & Compliance */}
                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                  <div className="bg-slate-50 border-b border-slate-200 px-4 py-2">
                    <h3 className="text-xs font-bold text-slate-600 uppercase tracking-widest">Compliance & Specs</h3>
                  </div>
                  <div className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">HUID Code</p>
                      <p className="text-xs font-mono font-bold text-slate-900 mt-0.5">{viewItem.huid_code || '---'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">HSN Code</p>
                      <p className="text-xs font-mono font-bold text-slate-900 mt-0.5">{viewItem.hsn_code || '---'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Item Size</p>
                      <p className="text-xs font-semibold text-slate-900 mt-0.5">{viewItem.item_size || 'Standard'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Diamond Quality</p>
                      <p className="text-xs font-semibold text-slate-900 mt-0.5">
                        {viewItem.diamond_shape ? `${viewItem.diamond_shape} ` : ''}
                        {viewItem.diamond_color ? `${viewItem.diamond_color}/` : ''}
                        {viewItem.diamond_clarity || '---'}
                      </p>
                    </div>
                  </div>
                  {viewItem.remarks && (
                    <div className="p-4 pt-0">
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Remarks / Internal Notes</p>
                      <p className="text-xs text-slate-700 mt-1 bg-slate-50 p-2 rounded border border-slate-100">{viewItem.remarks}</p>
                    </div>
                  )}
                </div>

                {/* Financials Ledger */}
                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                  <div className="bg-slate-50 border-b border-slate-200 px-4 py-2">
                    <h3 className="text-xs font-bold text-slate-600 uppercase tracking-widest">Costing Ledger</h3>
                  </div>
                  <div className="p-4 space-y-3">
                    {viewItem._type !== 'repair' && (
                      <>
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-slate-500 font-medium">Metal Base Cost</span>
                          <span className="font-mono font-semibold">₹{(viewItem.cost_metal || 0).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-slate-500 font-medium">Stone Cost</span>
                          <span className="font-mono font-semibold">₹{(viewItem.cost_stone || 0).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-slate-500 font-medium">Making / Labor</span>
                          <span className="font-mono font-semibold">₹{(viewItem.cost_making || 0).toLocaleString()}</span>
                        </div>
                        <div className="border-t border-slate-100 pt-3 flex justify-between items-center">
                          <span className="text-[10px] font-bold text-slate-800 uppercase tracking-widest">Total Sourcing Cost</span>
                          <span className="font-mono font-bold text-sm">₹{(viewItem.cost_total || 0).toLocaleString()}</span>
                        </div>
                      </>
                    )}
                    <div className="border-t border-slate-200 pt-3 flex justify-between items-center bg-indigo-50/50 -mx-4 px-4 pb-1">
                      <span className="text-[10px] font-black text-indigo-800 uppercase tracking-widest">{viewItem._type === 'repair' ? 'Service Billable' : 'Retail MRP'}</span>
                      <span className="font-mono font-black text-lg text-indigo-700">₹{(viewItem.mrp || 0).toLocaleString()}</span>
                    </div>
                  </div>
                </div>

              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

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
                    <TableHead className="text-[10px] font-bold uppercase text-slate-500 h-9">Asset Ref</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase text-slate-500 h-9">Purity</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase text-slate-500 h-9 text-right">Net Wt</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase text-slate-500 h-9 text-right">Current MRP</TableHead>
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
                   Generate Preview
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

      <ItemTagPreview item={tagItem} onClose={() => setTagItem(null)} />

    </div>
  )
}

// --- HYBRID RENDER TABLE ---
function InventoryTable({ data, isSoldTab, selectedIds, setSelectedIds, editingMrpId, setEditingId, editingMrpVal, setEditingMrpVal, handleSaveMrp, setTagItem, handleSingleTransfer, setViewItem }: any) {
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
              <TableHead className="text-[10px] font-bold uppercase tracking-wider text-slate-500 h-10 w-[180px]">Price/Value</TableHead>
              <TableHead className="w-[120px] text-right px-6"></TableHead>
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
                      disabled={item.status === 'sold'} 
                      className="rounded-[4px] border-slate-300 data-[state=checked]:bg-indigo-600 data-[state=checked]:border-indigo-600 disabled:opacity-30"
                    />
                  </TableCell>
                )}
                <TableCell className="py-3">
                  <div className="flex flex-col items-start">
                     <span className="font-mono font-semibold text-sm text-slate-900 tracking-tight leading-tight">{item.barcode}</span>
                     <span className="text-[10px] text-slate-500 font-medium uppercase tracking-wider mt-0.5">{item.sku_reference || 'NO SKU'}</span>
                     <div className="flex gap-1 mt-1 flex-wrap">
                       {item.is_exchanged && <Badge className="bg-rose-100 text-rose-700 border-rose-200 text-[9px] uppercase tracking-widest px-1 py-0 h-4">Buyback</Badge>}
                       {item.is_custom_order && <Badge className="bg-purple-100 text-purple-700 border-purple-200 text-[9px] uppercase tracking-widest px-1 py-0 h-4">Custom: {item.custom_orders?.origin?.name || 'Branch'}</Badge>}
                       {item.is_repair_ticket && <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-[9px] uppercase tracking-widest px-1 py-0 h-4">Repair: {item.origin_name}</Badge>}
                     </div>
                  </div>
                </TableCell>
                <TableCell className="py-3">
                   <div className="text-xs font-semibold text-slate-900">{item.item_category}</div>
                   <div className="text-[10px] text-slate-500 font-medium uppercase tracking-wider mt-0.5">{item.metal_type} {item.purity_karat !== 'N/A' ? `(${item.purity_karat})` : ''}</div>
                </TableCell>
                <TableCell className="text-right px-4 py-3">
                   <div className="flex flex-col items-end">
                      <span className="text-xs font-semibold text-slate-900">
                        {item.net_weight_g?.toFixed(3)}g 
                        <span className={cn("text-[9px] font-bold ml-1", item._type === 'repair' ? "text-amber-500" : "text-slate-400")}>
                          {item._type === 'repair' ? 'ADDED' : 'NET'}
                        </span>
                      </span>
                      <span className="text-[10px] text-blue-600 font-semibold uppercase mt-0.5">
                        {item.total_stone_weight_cts?.toFixed(2)}ct 
                        <span className={cn("text-[9px] font-bold ml-1", item._type === 'repair' ? "text-amber-500" : "text-slate-400")}>
                          {item._type === 'repair' ? 'ADDED' : 'STN'}
                        </span>
                      </span>
                   </div>
                </TableCell>
                <TableCell className="text-center py-3">
                   <span className={cn("inline-flex items-center justify-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border", 
                      item._type === 'repair' ? "bg-amber-50 text-amber-700 border-amber-200" :
                      item.status === 'in_stock' ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-50 text-slate-500 border-slate-200")}>
                     {item.status.replace(/_/g, ' ')}
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
                     <div className="group flex items-center gap-2 cursor-pointer w-max" onClick={() => { if(!isSoldTab && !item.is_repair_ticket) { setEditingId(item.id); setEditingMrpVal(item.mrp?.toString() || '') }}}>
                       <span className="text-xs font-semibold text-slate-900">
                          {item.mrp ? `₹${item.mrp.toLocaleString()}` : 'TBD'}
                       </span>
                       {!isSoldTab && !item.is_repair_ticket && <Edit2 className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 text-slate-400 hover:text-indigo-600 transition-all" />}
                     </div>
                   )}
                </TableCell>
                <TableCell className="text-right px-6 py-3">
                   <div className="flex justify-end gap-1.5">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors" onClick={() => setViewItem(item)} title="View Full Details">
                        <Eye className="h-4 w-4" />
                      </Button>
                      {!item.is_repair_ticket && (
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors" onClick={() => setTagItem(item)} title="Print Label">
                          <Printer className="h-4 w-4" />
                        </Button>
                      )}
                      {!isSoldTab && (item.status === 'in_stock' || item.status === 'fixed_ready_for_dispatch') && (
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
                     disabled={item.status === 'sold'}
                     className="rounded-[4px] border-slate-300 data-[state=checked]:bg-indigo-600 data-[state=checked]:border-indigo-600 disabled:opacity-30"
                   />
                 )}
                 <div>
                   <span className="font-mono font-semibold text-sm text-slate-900 tracking-tight leading-tight">{item.barcode}</span>
                   <span className="block text-[10px] text-slate-500 font-medium uppercase tracking-wider mt-0.5">{item.sku_reference || 'NO SKU'}</span>
                   {item.is_custom_order && <span className="block text-[9px] font-bold text-purple-600 uppercase tracking-widest mt-1">Custom: {item.custom_orders?.origin?.name || 'Branch'}</span>}
                   {item.is_repair_ticket && <span className="block text-[9px] font-bold text-amber-600 uppercase tracking-widest mt-1">Repair: {item.origin_name}</span>}
                 </div>
               </div>
               <div className="flex gap-2 items-center">
                 <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-indigo-600 bg-slate-50" onClick={() => setViewItem(item)}>
                    <Eye className="h-3.5 w-3.5" />
                 </Button>
               </div>
            </div>
            
            <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-lg border border-slate-100">
               <div>
                 <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Specs</p>
                 <p className="text-xs font-semibold text-slate-900">{item.item_category}</p>
                 <p className="text-[10px] text-slate-500">{item.metal_type} {item.purity_karat !== 'N/A' ? `(${item.purity_karat})` : ''}</p>
               </div>
               <div className="text-right">
                 <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
                   {item._type === 'repair' ? 'Materials Added' : 'Weights'}
                 </p>
                 <p className="text-xs font-semibold text-slate-900">
                   {item.net_weight_g?.toFixed(3)}g 
                   <span className={cn("text-[9px] font-bold ml-1", item._type === 'repair' ? "text-amber-500" : "text-slate-400")}>
                     {item._type === 'repair' ? 'ADDED' : 'NET'}
                   </span>
                 </p>
                 <p className="text-[10px] text-blue-600 font-semibold">
                   {item.total_stone_weight_cts?.toFixed(2)}ct 
                   <span className={cn("text-[9px] font-bold ml-1", item._type === 'repair' ? "text-amber-500" : "text-slate-400")}>
                     {item._type === 'repair' ? 'ADDED' : 'STN'}
                   </span>
                 </p>
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
                   <div className="group flex items-center gap-2 cursor-pointer w-max" onClick={() => { if(!isSoldTab && !item.is_repair_ticket) { setEditingId(item.id); setEditingMrpVal(item.mrp?.toString() || '') }}}>
                     <span className="text-sm font-bold text-slate-900">{item.mrp ? `₹${item.mrp.toLocaleString()}` : 'TBD'}</span>
                     {!isSoldTab && !item.is_repair_ticket && <Edit2 className="w-3.5 h-3.5 text-slate-400" />}
                   </div>
                 )}
               </div>
               <div className="flex gap-1.5">
                 {!item.is_repair_ticket && (
                   <Button variant="outline" size="icon" className="h-8 w-8 text-slate-500 border-slate-200 bg-white" onClick={() => setTagItem(item)}>
                     <Printer className="h-3.5 w-3.5" />
                   </Button>
                 )}
                 {!isSoldTab && (item.status === 'in_stock' || item.status === 'fixed_ready_for_dispatch') && (
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