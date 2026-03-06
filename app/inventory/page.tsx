"use client";

import React, { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import QRCode from "react-qr-code";
import Barcode from "react-barcode";
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
  ArrowLeft,
  LayoutDashboard,
  Database,
  Info,
  Package,
  History,
  MoreVertical,
  Scale
} from "lucide-react";

import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabaseClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  item_category: string
  item_size: string
  metal_type: string
  gross_weight_g: number
  net_weight_g: number
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
  const [tagItem, setTagItem] = useState<InventoryItem | null>(null)
  const labelRef = useRef<HTMLDivElement>(null)

  const handlePrint = useReactToPrint({
    contentRef: labelRef,
    documentTitle: `Jewelry-Tag-${tagItem?.barcode || 'Item'}`,
    onAfterPrint: () => toast.success('Sent to printer'),
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

  const downloadTag = async () => {
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

  // --- SKELETON LOADER ---
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
    <div className="flex flex-col min-h-screen bg-background">
      {/* --- COMPACT IDE HEADER --- */}
      <header className="sticky top-0 z-40 w-full bg-background border-b border-border px-4 h-12 flex items-center justify-between">
        <div className="flex items-center gap-3 overflow-hidden">
          <Link href="/dashboard">
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-md">
              <LayoutDashboard className="h-4 w-4 text-muted-foreground" />
            </Button>
          </Link>
          <Separator orientation="vertical" className="h-4" />
          <nav className="flex items-center gap-1.5 text-sm whitespace-nowrap overflow-hidden">
            <span className="text-muted-foreground font-medium">Inventory</span>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="font-semibold text-foreground">Stock Ledger</span>
            <div className="ml-3 hidden md:flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-secondary border border-border">
              <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              <span className="text-[10px] font-bold text-muted-foreground uppercase">Sync Active</span>
            </div>
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="h-8 px-2 text-xs font-medium text-muted-foreground" onClick={fetchItems}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Separator orientation="vertical" className="h-4 mx-1" />
          <Button variant="outline" size="sm" className="h-8 text-xs font-semibold px-3 border-border hidden sm:flex">
            <Database className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
            Inventory DB
          </Button>
        </div>
      </header>

      <main className="p-4 md:p-8 max-w-[1400px] w-full mx-auto space-y-6 animate-in fade-in duration-500">
        {/* TOOLBAR */}
        <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
           <div className="flex items-center gap-2 w-full lg:w-auto overflow-x-auto pb-1">
              <div className="flex items-center gap-2 bg-secondary/50 p-1 rounded-md border border-border">
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
              <Button asChild variant="ghost" size="sm" className="h-9 text-xs font-bold border border-border bg-card">
                 <Link href="/transfer"><Truck className="w-3.5 h-3.5 mr-2" /> Logistics</Link>
              </Button>
           </div>

           <div className="flex items-center gap-2 w-full lg:w-auto">
              <div className="relative flex-1 lg:w-64 group">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                <Input placeholder="Search barcode..." className="pl-8 h-9 text-xs bg-muted/20 border-border" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
              </div>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="h-9 text-xs border-border bg-card w-[130px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Items</SelectItem>
                  <SelectItem value="in_stock">Available</SelectItem>
                  <SelectItem value="transit">In Transit</SelectItem>
                  <SelectItem value="exchanged">Buybacks</SelectItem>
                </SelectContent>
              </Select>
           </div>
        </div>

        <Tabs defaultValue="active" className="space-y-4">
          <TabsList className="bg-transparent border-b rounded-none h-11 w-full justify-start p-0 gap-6">
            <TabsTrigger value="active" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent shadow-none h-full px-1 text-xs font-bold transition-all">
              Live Stock ({filteredActiveItems.length})
            </TabsTrigger>
            <TabsTrigger value="sold" className="rounded-none border-b-2 border-transparent data-[state=active]:border-red-500 data-[state=active]:bg-transparent shadow-none h-full px-1 text-xs font-bold text-muted-foreground data-[state=active]:text-red-600 transition-all">
              Archive / Sold ({soldItems.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="mt-0">
             <Card className="shadow-none border-border/60 overflow-hidden bg-card">
                {loading ? <TableSkeleton /> : <InventoryTable data={filteredActiveItems} warehouses={warehouses} selectedIds={selectedIds} setSelectedIds={setSelectedIds} editingMrpId={editingMrpId} setEditingId={setEditingId} editingMrpVal={editingMrpVal} setEditingMrpVal={setEditingMrpVal} handleSaveMrp={handleSaveMrp} setTagItem={setTagItem} handleSingleTransfer={handleSingleTransfer} />}
             </Card>
          </TabsContent>

          <TabsContent value="sold" className="mt-0">
             <Card className="shadow-none border-border/60 overflow-hidden bg-card">
                {loading ? <TableSkeleton /> : <InventoryTable data={soldItems} warehouses={warehouses} isSoldTab selectedIds={[]} setSelectedIds={()=>{}} editingMrpId={null} setEditingId={()=>{}} editingMrpVal="" setEditingMrpVal={()=>{}} handleSaveMrp={async()=>{}} setTagItem={setTagItem} handleSingleTransfer={()=>{}} />}
             </Card>
          </TabsContent>
        </Tabs>

        {/* FLOATING BULK BAR */}
        {selectedIds.length > 0 && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-foreground text-background px-4 py-3 rounded-xl shadow-2xl flex items-center gap-4 animate-in slide-in-from-bottom-4 border border-border/10 min-w-[320px]">
            <div className="flex items-center gap-2 pr-4 border-r border-background/20">
              <div className="h-5 w-5 bg-primary rounded flex items-center justify-center text-[10px] font-black">{selectedIds.length}</div>
              <span className="text-[11px] font-bold uppercase tracking-tight">Units Selected</span>
            </div>
            <Button size="sm" variant="secondary" onClick={handleBulkTransfer} className="h-8 text-[11px] font-bold uppercase">
              <Truck className="w-3.5 h-3.5 mr-2" /> Bulk Transfer
            </Button>
            <Button size="icon" variant="ghost" onClick={() => setSelectedIds([])} className="h-8 w-8 hover:bg-white/10">
              <X className="w-4 h-4" />
            </Button>
          </div>
        )}
      </main>

      {/* TAG PREVIEW DIALOG (Redesigned) */}
      <Dialog open={!!tagItem} onOpenChange={() => setTagItem(null)}>
        <DialogContent className="sm:max-w-[400px] p-0 overflow-hidden border-none shadow-2xl">
          <DialogHeader className="bg-secondary/50 p-6 border-b">
            <DialogTitle className="text-lg font-bold">Label Generation</DialogTitle>
            <DialogDescription className="text-xs font-medium">Verify visual identity for asset {tagItem?.barcode}</DialogDescription>
          </DialogHeader>
          
          <div className="flex justify-center py-10 bg-white">
            <div ref={labelRef} className="bg-white p-5 border border-border shadow-sm w-[280px] flex flex-col items-center justify-center print:border-none print:shadow-none" style={{ fontFamily: 'monospace' }}>
              <div className="text-center mb-3 w-full border-b-2 border-foreground pb-2">
                <h2 className="font-black text-[14px] uppercase tracking-tighter leading-tight italic">Pavitram Diamond</h2>
              </div>
              <div className="w-full flex justify-between px-1 text-[11px] mb-1 font-bold uppercase tracking-tighter">
                <span>{tagItem?.item_category}</span>
                <span>{tagItem?.item_size ? `SZ: ${tagItem.item_size}` : ''}</span>
              </div>
              <div className="w-full flex justify-between px-1 text-[9px] text-muted-foreground mb-4 border-b border-border pb-1 uppercase font-bold">
                <span>GW: {tagItem?.gross_weight_g?.toFixed(3)}g</span>
                <span>NW: {tagItem?.net_weight_g?.toFixed(3)}g</span>
              </div>
              <div className="flex gap-3 items-center justify-center mb-2 w-full">
                {tagItem?.barcode && (
                  <>
                    <div className="bg-white p-1 border border-border"><QRCode value={tagItem.barcode} size={45} level="M" /></div>
                    <div className="flex-1 flex flex-col items-center">
                      <Barcode value={tagItem.barcode} height={30} width={1.1} displayValue={false} margin={0} />
                      <span className="text-[11px] font-black tracking-[0.25em] mt-1">{tagItem.barcode}</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
          <DialogFooter className="bg-secondary/50 p-4 border-t flex-row gap-2">
             <Button variant="ghost" className="flex-1 text-xs font-bold uppercase" onClick={downloadTag}><Download className="w-3.5 h-3.5 mr-2" /> Image</Button>
             <Button className="flex-1 text-xs font-bold uppercase" onClick={() => handlePrint()}><Printer className="w-3.5 h-3.5 mr-2" /> Print Tag</Button>
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
          <TableRow className="hover:bg-transparent">
            {!isSoldTab && (
              <TableHead className="w-[40px] px-4 h-10">
                <Checkbox checked={selectedIds.length === data.length && data.length > 0} onCheckedChange={() => setSelectedIds(selectedIds.length === data.length ? [] : data.map((i: any) => i.id))} />
              </TableHead>
            )}
            <TableHead className="text-[10px] font-black uppercase text-muted-foreground h-10">Identifier</TableHead>
            <TableHead className="text-[10px] font-black uppercase text-muted-foreground h-10">Item Details</TableHead>
            <TableHead className="text-[10px] font-black uppercase text-muted-foreground h-10 text-right px-4">Metadata</TableHead>
            <TableHead className="text-[10px] font-black uppercase text-muted-foreground h-10 text-center">Status</TableHead>
            <TableHead className="text-[10px] font-black uppercase text-muted-foreground h-10 w-[180px]">Retail Price</TableHead>
            <TableHead className="w-[100px] text-right px-6"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((item: any) => (
            <TableRow key={item.id} className={`${selectedIds.includes(item.id) ? 'bg-primary/5' : ''} hover:bg-secondary/20 transition-colors border-b last:border-0`}>
              {!isSoldTab && (
                <TableCell className="px-4 py-3">
                  <Checkbox checked={selectedIds.includes(item.id)} onCheckedChange={() => setSelectedIds((prev: any) => prev.includes(item.id) ? prev.filter((i: any) => i !== item.id) : [...prev, item.id])} disabled={item.status !== 'in_stock'} />
                </TableCell>
              )}
              <TableCell className="py-3">
                <div className="flex flex-col">
                   <span className="font-mono font-bold text-xs text-foreground tracking-tight">{item.barcode}</span>
                   {item.is_exchanged && <span className="text-[8px] font-black text-purple-600 uppercase tracking-tighter">Buyback Asset</span>}
                </div>
              </TableCell>
              <TableCell className="py-3">
                 <div className="text-xs font-bold text-foreground">{item.item_category}</div>
                 <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-tight">{item.metal_type} · Size {item.item_size || 'N/A'}</div>
              </TableCell>
              <TableCell className="text-right px-4">
                 <div className="flex flex-col">
                    <span className="text-xs font-bold text-foreground">{item.net_weight_g?.toFixed(3)}g</span>
                    <span className="text-[10px] text-muted-foreground font-medium uppercase">{warehouses.find((w: any) => w.id === item.warehouse_id)?.name}</span>
                 </div>
              </TableCell>
              <TableCell className="text-center py-3">
                 <Badge variant="outline" className={`text-[9px] font-black uppercase h-5 px-1.5 ${item.status === 'in_stock' ? 'border-emerald-200 text-emerald-600' : 'border-border text-muted-foreground'}`}>
                   {item.status.replace('_', ' ')}
                 </Badge>
              </TableCell>
              <TableCell className="py-3">
                 {editingMrpId === item.id ? (
                   <div className="flex items-center gap-1">
                     <Input className="h-7 w-24 text-[11px] font-bold" value={editingMrpVal} onChange={e => setEditingMrpVal(e.target.value)} autoFocus />
                     <Button size="icon" variant="ghost" className="h-7 w-7 text-emerald-600" onClick={() => handleSaveMrp(item.id)}><Check className="w-3 h-3" /></Button>
                   </div>
                 ) : (
                   <div className="group flex items-center gap-2 cursor-pointer" onClick={() => { if(!isSoldTab) { setEditingId(item.id); setEditingMrpVal(item.mrp?.toString() || '') }}}>
                     <span className="text-xs font-bold text-foreground">{item.mrp ? `₹${item.mrp.toLocaleString()}` : 'Market Rate'}</span>
                     {!isSoldTab && <Edit2 className="w-3 h-3 opacity-0 group-hover:opacity-100 text-muted-foreground" />}
                   </div>
                 )}
              </TableCell>
              <TableCell className="text-right px-6 py-3">
                 <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => setTagItem(item)}><Printer className="h-4 w-4" /></Button>
                    {!isSoldTab && item.status === 'in_stock' && (
                       <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-primary" onClick={() => handleSingleTransfer(item)}><Truck className="h-4 w-4" /></Button>
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