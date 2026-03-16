"use client";

import React, { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import QRCode from "react-qr-code";
import html2canvas from "html2canvas";
import { useReactToPrint } from "react-to-print";
import { toast } from "sonner";
import { 
  Search, 
  Printer, 
  Edit2, 
  Check, 
  X, 
  Store, 
  Truck, 
  Download, 
  RefreshCw,
  ChevronRight,
  LayoutDashboard,
  Database
} from "lucide-react";

import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabaseClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Table, TableBody, TableCell, TableHead, 
  TableHeader, TableRow 
} from "@/components/ui/table";
import { 
  Dialog, DialogContent, DialogHeader, 
  DialogTitle, DialogDescription, DialogFooter
} from "@/components/ui/dialog";
import { 
  Select, SelectContent, SelectItem, 
  SelectTrigger, SelectValue 
} from "@/components/ui/select";

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
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [editingMrpId, setEditingId] = useState<string | null>(null)
  const [editingMrpVal, setEditingMrpVal] = useState<string>('')
  
  // Printing State
  const [tagItem, setTagItem] = useState<InventoryItem | null>(null)
  const labelRef = useRef<HTMLDivElement>(null)

  const handlePrint = useReactToPrint({
    contentRef: labelRef,
    documentTitle: `Jewelry-Tag-${tagItem?.barcode || 'Item'}`,
    onAfterPrint: () => toast.success('Sent to Thermal Printer'),
  })

  useEffect(() => {
    const fetchWarehouses = async () => {
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
          setSelectedWarehouseId(whData[0].id)
        }
      } catch (err) { toast.error('Error loading warehouses') }
    }
    fetchWarehouses()
  }, [appUser])

  const fetchItems = async () => {
    if (!appUser || !selectedWarehouseId) return
    setLoading(true)
    try {
      let query = supabase.from('inventory_items').select('*').eq('company_id', appUser.company_id).order('created_at', { ascending: false })
      const currentWarehouse = warehouses.find(w => w.id === selectedWarehouseId)
      const wType = currentWarehouse?.type || currentWarehouse?.warehouse_type || 'branch'
      
      if (wType !== 'main_safe') query = query.eq('warehouse_id', selectedWarehouseId)
      
      const { data, error } = await query
      if (error) throw error
      setItems(data || [])
    } catch (error) { toast.error('Failed to load inventory') } 
    finally { setLoading(false) }
  }

  useEffect(() => { fetchItems() }, [appUser, selectedWarehouseId, warehouses])

  const handleSaveMrp = async (id: string) => {
    const newMrp = editingMrpVal ? Number(editingMrpVal) : null
    const { error } = await supabase.from('inventory_items').update({ mrp: newMrp }).eq('id', id)
    if (error) return toast.error('Failed to update price')
    setItems(items.map(item => item.id === id ? { ...item, mrp: newMrp } : item))
    setEditingId(null)
    toast.success('Price updated')
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

  const TableSkeleton = () => (
    <div className="space-y-2 p-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 h-12 border-b border-border/40">
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-24" />
          <div className="flex-1" />
          <Skeleton className="h-8 w-20" />
        </div>
      ))}
    </div>
  )

  if (!appUser) return null

  return (
    <div className="flex flex-col min-h-screen bg-background font-sans">
      
      {/* --- COMPACT ERP HEADER --- */}
      <header className="sticky top-0 z-40 w-full bg-background border-b border-border/60 px-4 h-12 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3 overflow-hidden">
          <Link href="/dashboard">
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-sm">
              <LayoutDashboard className="h-4 w-4 text-muted-foreground" />
            </Button>
          </Link>
          <Separator orientation="vertical" className="h-4" />
          <nav className="flex items-center gap-1.5 text-sm whitespace-nowrap overflow-hidden">
            <span className="text-muted-foreground font-medium text-xs">Inventory</span>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="font-bold text-foreground text-xs uppercase tracking-wider">Stock Ledger</span>
            <div className="ml-3 hidden md:flex items-center gap-1.5 px-2 py-0.5 rounded bg-secondary/50 border border-border/60">
              <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Live Sync</span>
            </div>
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="h-8 px-2 text-xs font-bold text-muted-foreground rounded-sm" onClick={fetchItems}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Separator orientation="vertical" className="h-4 mx-1" />
          <Button variant="outline" size="sm" className="h-8 text-xs font-bold px-3 border-border/60 rounded-sm hidden sm:flex">
            <Database className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
            DB Status: Optimal
          </Button>
        </div>
      </header>

      <main className="p-4 md:p-6 max-w-7xl w-full mx-auto space-y-4 animate-in fade-in duration-300">
        
        {/* TOOLBAR */}
        <div className="flex flex-col lg:flex-row gap-3 items-start lg:items-center justify-between bg-white p-3 rounded-sm border border-border/60 shadow-sm">
           <div className="flex items-center gap-2 w-full lg:w-auto overflow-x-auto">
              <div className="flex items-center gap-2 bg-secondary/30 p-1 rounded-sm border border-border/40">
                 <div className="pl-2 pr-1"><Store className="w-3.5 h-3.5 text-muted-foreground" /></div>
                 <Select value={selectedWarehouseId} onValueChange={setSelectedWarehouseId}>
                   <SelectTrigger className="h-7 border-none bg-transparent shadow-none text-xs font-bold w-[160px] focus:ring-0">
                     <SelectValue />
                   </SelectTrigger>
                   <SelectContent>
                     {warehouses.map(w => <SelectItem key={w.id} value={w.id} className="text-xs">{w.name}</SelectItem>)}
                   </SelectContent>
                 </Select>
              </div>
              <Button asChild variant="outline" size="sm" className="h-9 text-xs font-bold border-border/60 rounded-sm">
                 <Link href="/transfer"><Truck className="w-3.5 h-3.5 mr-2 text-muted-foreground" /> Logistics</Link>
              </Button>
           </div>

           <div className="flex items-center gap-2 w-full lg:w-auto">
              <div className="relative flex-1 lg:w-64">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input placeholder="Search barcode or SKU..." className="pl-8 h-9 text-xs bg-background border-border/60 rounded-sm" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
              </div>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="h-9 text-xs font-bold border-border/60 bg-background rounded-sm w-[130px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">All Items</SelectItem>
                  <SelectItem value="in_stock" className="text-xs">Available</SelectItem>
                  <SelectItem value="transit" className="text-xs">In Transit</SelectItem>
                  <SelectItem value="exchanged" className="text-xs">Buybacks</SelectItem>
                </SelectContent>
              </Select>
           </div>
        </div>

        <Tabs defaultValue="active" className="space-y-4">
          <TabsList className="bg-transparent border-b border-border/60 rounded-none h-11 w-full justify-start p-0 gap-6">
            <TabsTrigger value="active" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent shadow-none h-full px-1 text-xs font-bold uppercase tracking-widest transition-all">
              Live Stock ({filteredActiveItems.length})
            </TabsTrigger>
            <TabsTrigger value="sold" className="rounded-none border-b-2 border-transparent data-[state=active]:border-red-500 data-[state=active]:bg-transparent shadow-none h-full px-1 text-xs font-bold uppercase tracking-widest text-muted-foreground data-[state=active]:text-red-600 transition-all">
              Archive / Sold ({soldItems.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="mt-0">
             <Card className="shadow-sm border-border/60 overflow-hidden bg-card rounded-sm">
                {loading ? <TableSkeleton /> : <InventoryTable data={filteredActiveItems} warehouses={warehouses} selectedIds={selectedIds} setSelectedIds={setSelectedIds} editingMrpId={editingMrpId} setEditingId={setEditingId} editingMrpVal={editingMrpVal} setEditingMrpVal={setEditingMrpVal} handleSaveMrp={handleSaveMrp} setTagItem={setTagItem} handleSingleTransfer={handleSingleTransfer} />}
             </Card>
          </TabsContent>

          <TabsContent value="sold" className="mt-0">
             <Card className="shadow-sm border-border/60 overflow-hidden bg-card rounded-sm">
                {loading ? <TableSkeleton /> : <InventoryTable data={soldItems} warehouses={warehouses} isSoldTab selectedIds={[]} setSelectedIds={()=>{}} editingMrpId={null} setEditingId={()=>{}} editingMrpVal="" setEditingMrpVal={()=>{}} handleSaveMrp={async()=>{}} setTagItem={setTagItem} handleSingleTransfer={()=>{}} />}
             </Card>
          </TabsContent>
        </Tabs>

        {/* FLOATING BULK BAR */}
        {selectedIds.length > 0 && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-foreground text-background px-4 py-3 rounded-sm shadow-2xl flex items-center gap-4 animate-in slide-in-from-bottom-4 border border-border/10 min-w-[320px]">
            <div className="flex items-center gap-3 pr-4 border-r border-background/20">
              <div className="h-6 w-6 bg-primary rounded-sm flex items-center justify-center text-xs font-black text-primary-foreground">{selectedIds.length}</div>
              <span className="text-[11px] font-bold uppercase tracking-widest">Units Selected</span>
            </div>
            <Button size="sm" variant="secondary" onClick={handleBulkTransfer} className="h-8 text-[11px] font-bold uppercase tracking-widest rounded-sm">
              <Truck className="w-3.5 h-3.5 mr-2" /> Bulk Transfer
            </Button>
            <Button size="icon" variant="ghost" onClick={() => setSelectedIds([])} className="h-8 w-8 hover:bg-white/10 rounded-sm">
              <X className="w-4 h-4" />
            </Button>
          </div>
        )}
      </main>

      {/* ==============================================================
          TAG PREVIEW DIALOG (TSC THERMAL PRINTER 100x20mm)
          ============================================================== */}
      <Dialog open={!!tagItem} onOpenChange={() => setTagItem(null)}>
        <DialogContent className="sm:max-w-[550px] p-0 overflow-hidden border-border/60 shadow-2xl rounded-sm">
          <DialogHeader className="bg-secondary/30 p-4 border-b border-border/40">
            <DialogTitle className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
               <Printer className="w-4 h-4 text-muted-foreground" /> Thermal Label Layout
            </DialogTitle>
            <DialogDescription className="text-xs">Verify the physical 100x20mm jewelry tag format below before printing.</DialogDescription>
          </DialogHeader>
          
          <div className="flex flex-col items-center justify-center py-10 bg-slate-50 min-h-[250px] overflow-x-auto">
            
            {/* EXACT 100x20mm CSS LAYOUT */}
            <div 
              ref={labelRef} 
              className="bg-white text-black flex border border-gray-300 shadow-sm print:border-none print:shadow-none overflow-hidden shrink-0"
              style={{ 
                width: '100mm', 
                height: '20mm', 
                fontFamily: 'Arial, sans-serif',
                boxSizing: 'border-box'
              }}
            >
              {/* Global Print CSS Injection */}
              <style type="text/css" media="print">
                {`@page { size: 100mm 20mm; margin: 0; } body { margin: 0; padding: 0; background: white; -webkit-print-color-adjust: exact; print-color-adjust: exact; }`}
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
                    {tagItem?.item_category || 'CATEGORY'}
                  </div>

                  {/* Technical Specs */}
                  <div className="flex"><span className="w-[9mm]">TAG</span><span>: {tagItem?.barcode?.slice(-6) || '---'}</span></div>
                  <div className="flex"><span className="w-[9mm]">STYLE</span><span>: {tagItem?.sku_reference || '---'}</span></div>
                  <div className="flex"><span className="w-[9mm]">KT/GW</span><span>: {tagItem?.purity_karat || 'N/A'} / {Number(tagItem?.gross_weight_g||0).toFixed(3)}</span></div>
                  <div className="flex">
                    <span className="w-[9mm]">{Number(tagItem?.total_stone_pieces) <= 1 ? 'CS' : 'RD'}</span>
                    <span>: {tagItem?.total_stone_pieces || 0} / {Number(tagItem?.total_stone_weight_cts||0).toFixed(3)}</span>
                  </div>
                  <div className="flex"><span className="w-[9mm]">NET</span><span>: {Number(tagItem?.net_weight_g||0).toFixed(3)}</span></div>
                </div>

                {/* CENTER GAP (Fold Line - 2mm) */}
                <div className="w-[2mm] h-full flex items-center justify-center">
                  <div className="h-full w-[1px] border-l border-dashed border-gray-300 print:border-none opacity-50" />
                </div>

                {/* RIGHT FLAP (Dedicated QR Code - 34mm) */}
                <div className="flex flex-col justify-center items-center h-full w-[34mm] pr-[2mm]">
                  {tagItem?.barcode ? (
                    <div className="bg-white p-0.5">
                      <QRCode 
                        value={tagItem.barcode} 
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

          <DialogFooter className="bg-white p-4 border-t border-border/40 flex-row gap-2">
             <Button variant="outline" className="flex-1 text-xs font-bold uppercase tracking-widest rounded-sm border-border/60" onClick={downloadTagImage}>
               <Download className="w-3.5 h-3.5 mr-2 text-muted-foreground" /> Download PNG
             </Button>
             <Button className="flex-[2] text-xs font-bold uppercase tracking-widest rounded-sm bg-foreground hover:bg-foreground/90" onClick={() => handlePrint()}>
               <Printer className="w-3.5 h-3.5 mr-2" /> Direct Print (TSC)
             </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function InventoryTable({ data, warehouses, isSoldTab, selectedIds, setSelectedIds, editingMrpId, setEditingId, editingMrpVal, setEditingMrpVal, handleSaveMrp, setTagItem, handleSingleTransfer }: any) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader className="bg-secondary/30">
          <TableRow className="hover:bg-transparent border-border/40">
            {!isSoldTab && (
              <TableHead className="w-[40px] px-4 h-10">
                <Checkbox 
                  checked={selectedIds.length === data.length && data.length > 0} 
                  onCheckedChange={() => setSelectedIds(selectedIds.length === data.length ? [] : data.map((i: any) => i.id))} 
                  className="rounded-[2px]"
                />
              </TableHead>
            )}
            <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground h-10">Identifier / SKU</TableHead>
            <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground h-10">Specs</TableHead>
            <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground h-10 text-right px-4">Weights</TableHead>
            <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground h-10 text-center">Status</TableHead>
            <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground h-10 w-[180px]">Retail Price</TableHead>
            <TableHead className="w-[100px] text-right px-6"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((item: any) => (
            <TableRow key={item.id} className={`${selectedIds.includes(item.id) ? 'bg-primary/5' : 'bg-white'} hover:bg-secondary/20 transition-colors border-b border-border/40 last:border-0`}>
              {!isSoldTab && (
                <TableCell className="px-4 py-2.5">
                  <Checkbox 
                    checked={selectedIds.includes(item.id)} 
                    onCheckedChange={() => setSelectedIds((prev: any) => prev.includes(item.id) ? prev.filter((i: any) => i !== item.id) : [...prev, item.id])} 
                    disabled={item.status !== 'in_stock'} 
                    className="rounded-[2px]"
                  />
                </TableCell>
              )}
              <TableCell className="py-2.5">
                <div className="flex flex-col">
                   <span className="font-mono font-bold text-xs text-foreground tracking-tight">{item.barcode}</span>
                   <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-tight">{item.sku_reference || 'NO SKU'}</span>
                   {item.is_exchanged && <span className="text-[8px] font-black text-purple-600 uppercase tracking-tighter mt-0.5">Buyback Asset</span>}
                </div>
              </TableCell>
              <TableCell className="py-2.5">
                 <div className="text-xs font-bold text-foreground">{item.item_category}</div>
                 <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-tight">{item.metal_type} ({item.purity_karat}) · Size {item.item_size || 'N/A'}</div>
              </TableCell>
              <TableCell className="text-right px-4">
                 <div className="flex flex-col items-end">
                    <span className="text-xs font-bold text-foreground">{item.net_weight_g?.toFixed(3)}g <span className="text-[9px] font-normal text-muted-foreground">NET</span></span>
                    <span className="text-[10px] text-blue-600 font-bold uppercase">{item.total_stone_weight_cts?.toFixed(2)}ct <span className="text-[9px] font-normal text-muted-foreground">STN</span></span>
                 </div>
              </TableCell>
              <TableCell className="text-center py-2.5">
                 <Badge variant="outline" className={`text-[9px] font-black uppercase tracking-widest h-5 px-2 rounded-sm ${item.status === 'in_stock' ? 'border-emerald-200 text-emerald-700 bg-emerald-50/50' : 'border-border text-muted-foreground'}`}>
                   {item.status.replace('_', ' ')}
                 </Badge>
              </TableCell>
              <TableCell className="py-2.5">
                 {editingMrpId === item.id ? (
                   <div className="flex items-center gap-1">
                     <Input className="h-7 w-24 text-[11px] font-bold rounded-sm border-border/60" value={editingMrpVal} onChange={e => setEditingMrpVal(e.target.value)} autoFocus />
                     <Button size="icon" variant="ghost" className="h-7 w-7 text-emerald-600 hover:bg-emerald-50 rounded-sm" onClick={() => handleSaveMrp(item.id)}><Check className="w-3.5 h-3.5" /></Button>
                   </div>
                 ) : (
                   <div className="group flex items-center gap-2 cursor-pointer" onClick={() => { if(!isSoldTab) { setEditingId(item.id); setEditingMrpVal(item.mrp?.toString() || '') }}}>
                     <span className="text-xs font-bold text-foreground">{item.mrp ? `₹${item.mrp.toLocaleString()}` : 'Market Rate'}</span>
                     {!isSoldTab && <Edit2 className="w-3 h-3 opacity-0 group-hover:opacity-100 text-muted-foreground transition-opacity" />}
                   </div>
                 )}
              </TableCell>
              <TableCell className="text-right px-6 py-2.5">
                 <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-secondary/50 rounded-sm" onClick={() => setTagItem(item)} title="Print Label">
                      <Printer className="h-3.5 w-3.5" />
                    </Button>
                    {!isSoldTab && item.status === 'in_stock' && (
                       <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-sm" onClick={() => handleSingleTransfer(item)} title="Transfer">
                         <Truck className="h-3.5 w-3.5" />
                       </Button>
                    )}
                 </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}