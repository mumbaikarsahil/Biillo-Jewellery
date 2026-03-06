"use client"

import React, { useEffect, useState, useRef } from "react"
import Link from "next/link"
import { 
  Server, 
  Store, 
  Factory, 
  Activity, 
  Package,
  TrendingUp,
  Coins,
  Diamond,
  RefreshCw,
  LayoutDashboard,
  ZoomIn,
  ZoomOut,
  Maximize,
  ArrowRightLeft,
  ShoppingCart,
  Database,
  Loader2,
  DollarSign
} from "lucide-react"
import { toast } from "sonner"

import { supabase } from "@/lib/supabaseClient"
import { useAuth } from "@/hooks/useAuth"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

// --- TYPES ---
type WarehouseType = 'main_safe' | 'factory' | 'branch' | 'transit'

interface Warehouse {
  id: string
  name: string
  warehouse_type: WarehouseType
  warehouse_code: string
  is_active: boolean
}

interface WarehouseMetrics {
  inventoryCount: number
  totalGoldWeight: number
  totalDiamondWeight: number
  inventoryValuation: number
  todaySales: number
  todayProfit: number
  todayPurchases: number
  activeTransfers: number
}

const NODE_WIDTH = 256;
const NODE_GAP = 64;
const ROUTING_DISTANCE = NODE_WIDTH + NODE_GAP; // 320px

export default function MasterDashboard() {
  const { appUser } = useAuth()
  
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [metricsMap, setMetricsMap] = useState<Record<string, WarehouseMetrics>>({})
  
  // --- PAN & ZOOM STATE ---
  const canvasRef = useRef<HTMLDivElement>(null)
  const [transform, setTransform] = useState({ x: 0, y: 50, scale: 1 })
  const [isDragging, setIsDragging] = useState(false)

  // --- DIALOG & DEEP DATA STATE ---
  const [dialogNodeId, setDialogNodeId] = useState<string | null>(null)
  const [dialogTab, setDialogTab] = useState<string>("stock")
  
  const [detailsLoading, setDetailsLoading] = useState(false)
  const [nodeItems, setNodeItems] = useState<any[]>([])
  const [nodeGold, setNodeGold] = useState<any[]>([])
  const [nodeDiamonds, setNodeDiamonds] = useState<any[]>([])

  const fetchCommandData = async () => {
    if (!appUser?.company_id) return
    setRefreshing(true)
    
    try {
      const today = new Date().toISOString().split('T')[0]

      const [whRes, invRes, salesRes, purchRes, trfRes] = await Promise.all([
        supabase.from('warehouses').select('*').eq('company_id', appUser.company_id).eq('is_active', true),
        supabase.from('inventory_items').select('warehouse_id, metal_type, gross_weight_g, total_stone_weight_cts, cost_total').eq('company_id', appUser.company_id).eq('status', 'in_stock'),
        supabase.from('sales_invoices').select('warehouse_id, total_payable, sales_invoice_items(gross_profit)').eq('company_id', appUser.company_id).gte('created_at', `${today}T00:00:00Z`),
        supabase.from('purchase_invoices').select('warehouse_id, total_payable').eq('company_id', appUser.company_id).gte('created_at', `${today}T00:00:00Z`),
        supabase.from('stock_transfers').select('from_warehouse_id, to_warehouse_id').eq('company_id', appUser.company_id).eq('status', 'in_transit')
      ])

      if (whRes.error) throw whRes.error
      setWarehouses(whRes.data || [])

      const newMetrics: Record<string, WarehouseMetrics> = {}
      
      whRes.data?.forEach(wh => {
        const nodeInv = invRes.data?.filter(i => i.warehouse_id === wh.id) || []
        const nodeSales = salesRes.data?.filter(s => s.warehouse_id === wh.id) || []
        const nodePurch = purchRes.data?.filter(p => p.warehouse_id === wh.id) || []
        const nodeTrf = trfRes.data?.filter(t => t.from_warehouse_id === wh.id || t.to_warehouse_id === wh.id) || []

        const goldWeight = nodeInv.filter(i => i.metal_type?.toLowerCase().includes('gold')).reduce((sum, i) => sum + (Number(i.gross_weight_g) || 0), 0)
        const diamondWeight = nodeInv.reduce((sum, i) => sum + (Number(i.total_stone_weight_cts) || 0), 0)
        const valuation = nodeInv.reduce((sum, i) => sum + (Number(i.cost_total) || 0), 0)
        const salesToday = nodeSales.reduce((sum, s) => sum + (Number(s.total_payable) || 0), 0)
        const purchToday = nodePurch.reduce((sum, p) => sum + (Number(p.total_payable) || 0), 0)
        
        let profitToday = 0
        nodeSales.forEach(sale => {
          const items = sale.sales_invoice_items as any[]
          if (items) profitToday += items.reduce((sum, item) => sum + (Number(item.gross_profit) || 0), 0)
        })

        newMetrics[wh.id] = {
          inventoryCount: nodeInv.length,
          totalGoldWeight: goldWeight,
          totalDiamondWeight: diamondWeight,
          inventoryValuation: valuation,
          todaySales: salesToday,
          todayProfit: profitToday,
          todayPurchases: purchToday,
          activeTransfers: nodeTrf.length
        }
      })

      setMetricsMap(newMetrics)

    } catch (err: any) {
      toast.error(`System Sync Failed: ${err.message}`)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  // --- FETCH DEEP DETAILS ON DIALOG OPEN ---
  useEffect(() => {
    const fetchNodeDetails = async () => {
      if (!dialogNodeId) return;
      setDetailsLoading(true)
      
      const targetNode = warehouses.find(w => w.id === dialogNodeId)
      
      try {
        // 1. Finished Goods (All Nodes)
        const { data: items } = await supabase
          .from('inventory_items')
          .select('id, barcode, item_category, net_weight_g, cost_total')
          .eq('warehouse_id', dialogNodeId)
          .eq('status', 'in_stock')
          .order('created_at', { ascending: false })
          .limit(100)
        
        setNodeItems(items || [])

        // 2. Raw Materials (Main Safe Only)
        if (targetNode?.warehouse_type === 'main_safe') {
           const { data: gold } = await supabase.from('inventory_gold_batches')
             .select('id, batch_number, purity_karat, remaining_weight_g')
             .eq('warehouse_id', dialogNodeId).gt('remaining_weight_g', 0)
           
           const { data: diamonds } = await supabase.from('inventory_diamond_lots')
             .select('id, lot_number, shape, remaining_weight_cts')
             .eq('warehouse_id', dialogNodeId).gt('remaining_weight_cts', 0)

           setNodeGold(gold || [])
           setNodeDiamonds(diamonds || [])
        } else {
           setNodeGold([])
           setNodeDiamonds([])
        }
      } catch (err) {
        console.error(err)
      } finally {
        setDetailsLoading(false)
      }
    }

    fetchNodeDetails()
  }, [dialogNodeId, warehouses])

  useEffect(() => {
    fetchCommandData()
    const interval = setInterval(fetchCommandData, 300000)
    return () => clearInterval(interval)
  }, [appUser])

  // --- CANVAS CONTROLS ---
  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault()
      setTransform(prev => ({
        ...prev,
        scale: Math.min(Math.max(0.3, prev.scale - e.deltaY * 0.002), 2)
      }))
    } else {
      setTransform(prev => ({
        ...prev,
        x: prev.x - e.deltaX,
        y: prev.y - e.deltaY
      }))
    }
  }

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0 && e.button !== 1) return 
    setIsDragging(true)
    if (canvasRef.current) canvasRef.current.setPointerCapture(e.pointerId)
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return
    setTransform(prev => ({
      ...prev,
      x: prev.x + e.movementX,
      y: prev.y + e.movementY
    }))
  }

  const handlePointerUp = (e: React.PointerEvent) => {
    setIsDragging(false)
    if (canvasRef.current) canvasRef.current.releasePointerCapture(e.pointerId)
  }

  const zoomIn = () => setTransform(p => ({ ...p, scale: Math.min(p.scale + 0.2, 2) }))
  const zoomOut = () => setTransform(p => ({ ...p, scale: Math.max(p.scale - 0.2, 0.3) }))
  const resetZoom = () => setTransform({ x: 0, y: 50, scale: 1 })

  const openNodeDialog = (nodeId: string, tab: string) => {
    setDialogNodeId(nodeId)
    setDialogTab(tab)
  }

  // --- TOPOLOGY ROUTING ---
  const mainSafes = warehouses.filter(w => w.warehouse_type === 'main_safe')
  const factories = warehouses.filter(w => w.warehouse_type === 'factory')
  const branches = warehouses.filter(w => w.warehouse_type === 'branch')

  const dialogNode = warehouses.find(w => w.id === dialogNodeId)
  const dialogMetrics = dialogNodeId ? metricsMap[dialogNodeId] : null

  if (!appUser) return null

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden relative">
      
      {/* INJECT ANIMATED DATA WIRES CSS */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes dataFlowV {
          from { background-position: 0 0; }
          to { background-position: 0 12px; }
        }
        @keyframes dataFlowH {
          from { background-position: 0 0; }
          to { background-position: 12px 0; }
        }
        .wire-v {
          width: 2px;
          background: linear-gradient(to bottom, #10b981 50%, #cbd5e1 50%);
          background-size: 2px 12px;
          animation: dataFlowV 0.6s linear infinite;
        }
        .wire-h {
          height: 2px;
          background: linear-gradient(to right, #10b981 50%, #cbd5e1 50%);
          background-size: 12px 2px;
          animation: dataFlowH 0.6s linear infinite;
        }
      `}} />

      {/* --- STANDARD IDE HEADER --- */}
      <header className="z-40 w-full bg-card border-b border-border px-4 h-12 flex items-center justify-between shrink-0 shadow-sm relative">
        <div className="flex items-center gap-3">
          <Link href="/dashboard">
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-md">
              <LayoutDashboard className="h-4 w-4 text-muted-foreground" />
            </Button>
          </Link>
          <Separator orientation="vertical" className="h-4" />
          <nav className="flex items-center gap-2 text-sm">
            <span className="font-semibold text-foreground">Master Topology</span>
            <Badge variant="outline" className="text-[9px] uppercase tracking-widest font-bold bg-emerald-500/10 text-emerald-600 border-emerald-200">
              System Online
            </Badge>
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center bg-muted/30 rounded-md border border-border p-0.5 gap-1">
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={zoomOut}><ZoomOut className="h-3.5 w-3.5" /></Button>
            <span className="text-[10px] font-mono font-bold w-10 text-center">{Math.round(transform.scale * 100)}%</span>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={zoomIn}><ZoomIn className="h-3.5 w-3.5" /></Button>
            <Separator orientation="vertical" className="h-4 mx-1" />
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={resetZoom}><Maximize className="h-3.5 w-3.5" /></Button>
          </div>
          <Separator orientation="vertical" className="h-4 mx-1" />
          <Button variant="outline" size="sm" className="h-8 text-xs font-bold px-3 shadow-sm" onClick={fetchCommandData} disabled={refreshing}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${refreshing ? 'animate-spin' : ''}`} /> Sync
          </Button>
        </div>
      </header>

      {/* --- INTERACTIVE CANVAS --- */}
      <main 
        ref={canvasRef}
        className="flex-1 relative w-full h-full cursor-grab active:cursor-grabbing select-none overflow-hidden"
        style={{ 
          backgroundColor: '#f8fafc', 
          backgroundImage: 'radial-gradient(#cbd5e1 1px, transparent 1px)', 
          backgroundSize: `${24 * transform.scale}px ${24 * transform.scale}px`,
          backgroundPosition: `${transform.x}px ${transform.y}px`,
          touchAction: 'none'
        }}
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
        <div 
          className="absolute origin-top-left flex flex-col items-center min-w-max p-10 transition-transform duration-75 ease-out"
          style={{ 
            transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
            left: '50%', marginLeft: '-50%' // Centers horizontally relative to screen
          }}
        >
          {loading ? (
            <div className="flex flex-col items-center opacity-50">
               <Skeleton className="h-[180px] w-[256px] rounded-sm" />
               <div className="w-[2px] h-12 bg-slate-300" />
               <div className="flex gap-[64px]"><Skeleton className="h-[180px] w-[256px] rounded-sm" /><Skeleton className="h-[180px] w-[256px] rounded-sm" /></div>
            </div>
          ) : (
            <div className="flex flex-col items-center w-full">
              
              {/* TIER 1: MAIN SAFES */}
              <div className="flex flex-col items-center relative z-10">
                <div className="flex justify-center gap-[64px]">
                  {mainSafes.map(node => (
                    <NodeBlock key={node.id} node={node} metrics={metricsMap[node.id]} onAction={openNodeDialog} />
                  ))}
                </div>
              </div>

              {/* WIRE: Main Safes -> Factories */}
              {factories.length > 0 && (
                <div className="flex flex-col items-center w-full relative z-0">
                  <div className="wire-v h-8" />
                  {factories.length > 1 && (
                    <div className="wire-h" style={{ width: `${(factories.length - 1) * ROUTING_DISTANCE}px` }} />
                  )}
                </div>
              )}

              {/* TIER 2: FACTORIES */}
              {factories.length > 0 && (
                <div className="flex flex-col items-center relative z-10">
                  <div className="flex justify-center gap-[64px] w-full">
                    {factories.map(node => (
                      <div key={node.id} className="flex flex-col items-center">
                        {factories.length > 1 && <div className="wire-v h-8" />}
                        <NodeBlock node={node} metrics={metricsMap[node.id]} onAction={openNodeDialog} />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* WIRE: Factories -> Branches */}
              {branches.length > 0 && (
                <div className="flex flex-col items-center w-full relative z-0">
                  <div className="wire-v h-8" />
                  {branches.length > 1 && (
                    <div className="wire-h" style={{ width: `${(branches.length - 1) * ROUTING_DISTANCE}px` }} />
                  )}
                </div>
              )}

              {/* TIER 3: BRANCHES */}
              {branches.length > 0 && (
                <div className="flex flex-col items-center relative z-10">
                  <div className="flex justify-center gap-[64px] w-full">
                    {branches.map(node => (
                      <div key={node.id} className="flex flex-col items-center">
                        {branches.length > 1 && <div className="wire-v h-8" />}
                        <NodeBlock node={node} metrics={metricsMap[node.id]} onAction={openNodeDialog} />
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>
          )}
        </div>
      </main>

      {/* --- DETAILED INSPECTOR DIALOG --- */}
      <Dialog open={!!dialogNodeId} onOpenChange={(open) => !open && setDialogNodeId(null)}>
        <DialogContent className="sm:max-w-[800px] p-0 border-border shadow-2xl bg-card overflow-hidden">
          {dialogNode && dialogMetrics && (
            <>
              {/* Header */}
              <DialogHeader className="bg-secondary/30 p-5 border-b border-border">
                 <div className="flex items-center gap-3">
                    <div className="p-2 bg-background border border-border rounded shadow-sm">
                      {dialogNode.warehouse_type === 'main_safe' ? <Database className="h-5 w-5 text-slate-700" /> : dialogNode.warehouse_type === 'branch' ? <Store className="h-5 w-5 text-slate-700" /> : <Factory className="h-5 w-5 text-slate-700" />}
                    </div>
                    <div className="text-left">
                      <DialogTitle className="text-lg font-bold text-foreground leading-none">{dialogNode.name}</DialogTitle>
                      <p className="text-[10px] font-mono text-muted-foreground mt-1 uppercase tracking-widest">{dialogNode.warehouse_code} · {dialogNode.warehouse_type.replace('_', ' ')}</p>
                    </div>
                 </div>
              </DialogHeader>

              {/* Tabs Content */}
              <Tabs value={dialogTab} onValueChange={setDialogTab} className="w-full flex flex-col h-[500px]">
                <TabsList className="w-full bg-transparent border-b rounded-none h-11 justify-start px-5 gap-6 shrink-0">
                  <TabsTrigger value="stock" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary shadow-none bg-transparent">Vault Stock</TabsTrigger>
                  <TabsTrigger value="revenue" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary shadow-none bg-transparent">Commerce</TabsTrigger>
                  <TabsTrigger value="transfers" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary shadow-none bg-transparent">Transfers</TabsTrigger>
                  <TabsTrigger value="purchases" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary shadow-none bg-transparent">Procurement</TabsTrigger>
                </TabsList>

                <div className="flex-1 bg-slate-50 overflow-hidden relative">
                  
                  {/* STOCK TAB WITH DEEP INVENTORY */}
                  <TabsContent value="stock" className="m-0 h-full flex flex-col p-5">
                    
                    {/* Top Summary Metrics */}
                    <div className="grid grid-cols-4 gap-3 shrink-0 mb-4">
                      <div className="p-3 bg-white border border-border rounded shadow-sm">
                        <span className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground uppercase"><Package className="h-3 w-3"/> Units</span>
                        <p className="text-lg font-black mt-1">{dialogMetrics.inventoryCount}</p>
                      </div>
                      <div className="p-3 bg-white border border-border rounded shadow-sm">
                        <span className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground uppercase"><DollarSign className="h-3 w-3"/> Value</span>
                        <p className="text-lg font-black text-emerald-600 mt-1">₹{(dialogMetrics.inventoryValuation / 100000).toFixed(2)}L</p>
                      </div>
                      <div className="p-3 bg-white border border-border rounded shadow-sm">
                        <span className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground uppercase"><Coins className="h-3 w-3 text-amber-500"/> Gold</span>
                        <p className="text-lg font-mono font-bold mt-1">{dialogMetrics.totalGoldWeight.toFixed(2)}g</p>
                      </div>
                      <div className="p-3 bg-white border border-border rounded shadow-sm">
                        <span className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground uppercase"><Diamond className="h-3 w-3 text-blue-500"/> Stone</span>
                        <p className="text-lg font-mono font-bold mt-1">{dialogMetrics.totalDiamondWeight.toFixed(2)}ct</p>
                      </div>
                    </div>

                    {/* Data Tables */}
                    <div className="flex-1 bg-white border border-border rounded shadow-sm overflow-hidden flex flex-col relative">
                      {detailsLoading ? (
                        <div className="flex-1 flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                      ) : (
                        dialogNode.warehouse_type === 'main_safe' ? (
                          <Tabs defaultValue="finished" className="w-full h-full flex flex-col">
                            <div className="bg-slate-100 border-b px-2 py-1 shrink-0">
                               <TabsList className="h-7 bg-transparent">
                                  <TabsTrigger value="finished" className="text-[10px] h-6">Finished Goods</TabsTrigger>
                                  <TabsTrigger value="gold" className="text-[10px] h-6">Raw Gold</TabsTrigger>
                                  <TabsTrigger value="diamond" className="text-[10px] h-6">Loose Diamonds</TabsTrigger>
                               </TabsList>
                            </div>
                            
                            <TabsContent value="finished" className="m-0 flex-1 overflow-auto custom-scrollbar">
                               <InventoryTable items={nodeItems} />
                            </TabsContent>
                            
                            <TabsContent value="gold" className="m-0 flex-1 overflow-auto custom-scrollbar">
                               <GoldTable items={nodeGold} />
                            </TabsContent>
                            
                            <TabsContent value="diamond" className="m-0 flex-1 overflow-auto custom-scrollbar">
                               <DiamondTable items={nodeDiamonds} />
                            </TabsContent>
                          </Tabs>
                        ) : (
                          <div className="h-full flex flex-col">
                             <div className="bg-slate-100 border-b px-3 py-1.5 text-[10px] font-bold uppercase text-muted-foreground shrink-0">Finished Inventory Log</div>
                             <div className="flex-1 overflow-auto custom-scrollbar">
                               <InventoryTable items={nodeItems} />
                             </div>
                          </div>
                        )
                      )}
                    </div>

                  </TabsContent>

                  {/* REVENUE TAB */}
                  <TabsContent value="revenue" className="m-0 p-5 space-y-4">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">Today's Commerce Stream</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-5 bg-white border border-border rounded-md shadow-sm">
                        <span className="text-xs font-bold text-muted-foreground uppercase">Gross Revenue</span>
                        <p className="text-3xl font-black mt-2">₹{dialogMetrics.todaySales.toLocaleString()}</p>
                      </div>
                      <div className="p-5 bg-emerald-50/50 border border-emerald-200 rounded-md shadow-sm">
                        <span className="text-xs font-bold text-emerald-700 uppercase">Gross Margin</span>
                        <p className="text-3xl font-black text-emerald-600 mt-2">₹{dialogMetrics.todayProfit.toLocaleString()}</p>
                      </div>
                    </div>
                  </TabsContent>

                  {/* TRANSFERS TAB */}
                  <TabsContent value="transfers" className="m-0 p-5 space-y-4">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">Logistics Routing</h4>
                    <div className="p-8 bg-white border border-border rounded-md shadow-sm flex flex-col items-center justify-center text-center">
                      <ArrowRightLeft className="h-10 w-10 text-slate-300 mb-4" />
                      <p className="text-3xl font-black">{dialogMetrics.activeTransfers}</p>
                      <p className="text-xs font-bold uppercase text-muted-foreground mt-1">Active In-Transit Parcels</p>
                    </div>
                  </TabsContent>

                  {/* PURCHASES TAB */}
                  <TabsContent value="purchases" className="m-0 p-5 space-y-4">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">Procurement Registry</h4>
                    <div className="p-8 bg-white border border-border rounded-md shadow-sm flex flex-col items-center justify-center text-center">
                      <ShoppingCart className="h-10 w-10 text-slate-300 mb-4" />
                      <p className="text-3xl font-black">₹{dialogMetrics.todayPurchases.toLocaleString()}</p>
                      <p className="text-xs font-bold uppercase text-muted-foreground mt-1">Today's Acquisitions</p>
                    </div>
                  </TabsContent>

                </div>
              </Tabs>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

// --- SUB-COMPONENTS ---

function NodeBlock({ node, metrics, onAction }: { node: Warehouse, metrics: WarehouseMetrics, onAction: (id: string, tab: string) => void }) {
  const isMain = node.warehouse_type === 'main_safe'
  const isBranch = node.warehouse_type === 'branch'
  const Icon = isMain ? Database : isBranch ? Store : Factory
  
  return (
    <div className="w-[256px] bg-white border-2 border-slate-300 shadow-sm rounded-sm overflow-hidden flex flex-col shrink-0 group">
      
      {/* Node Header */}
      <div className="bg-slate-100 border-b border-slate-200 px-3 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2 overflow-hidden">
          <Icon className="h-3.5 w-3.5 text-slate-600 shrink-0" />
          <span className="text-xs font-bold text-slate-800 uppercase tracking-tight truncate">{node.name}</span>
        </div>
        <div className="h-2 w-2 rounded-full bg-emerald-500 shrink-0 shadow-[0_0_8px_rgba(16,185,129,0.8)]" title="Online" />
      </div>
      
      {/* Action Rows - "IDE Property Inspector Style" */}
      <div className="flex flex-col">
        <SubActionRow 
          title="Vault Stock" 
          value={`${metrics?.inventoryCount || 0} U`} 
          icon={Package} 
          onClick={() => onAction(node.id, 'stock')} 
        />
        <SubActionRow 
          title="Revenue" 
          value={`₹${(metrics?.todaySales / 100000 || 0).toFixed(1)}L`} 
          icon={TrendingUp} 
          onClick={() => onAction(node.id, 'revenue')} 
        />
        <SubActionRow 
          title="Transfers" 
          value={`${metrics?.activeTransfers || 0} Open`} 
          icon={ArrowRightLeft} 
          onClick={() => onAction(node.id, 'transfers')} 
        />
        <SubActionRow 
          title="Purchases" 
          value={`₹${(metrics?.todayPurchases / 100000 || 0).toFixed(1)}L`} 
          icon={ShoppingCart} 
          onClick={() => onAction(node.id, 'purchases')} 
          isLast
        />
      </div>
    </div>
  )
}

function SubActionRow({ title, value, icon: Icon, onClick, isLast = false }: any) {
  return (
    <div 
      className={`flex justify-between items-center px-3 py-2 bg-white hover:bg-primary/5 cursor-pointer transition-colors ${!isLast ? 'border-b border-slate-100' : ''}`}
      onClick={(e) => {
        // Prevent pan event from triggering when clicking rows
        e.stopPropagation();
        onClick();
      }}
    >
      <div className="flex items-center gap-2">
        <Icon className="h-3 w-3 text-slate-400" />
        <span className="text-[10px] font-semibold text-slate-600 uppercase tracking-widest">{title}</span>
      </div>
      <span className="text-xs font-mono font-bold text-slate-900">{value}</span>
    </div>
  )
}

// --- TABLE SUB-COMPONENTS FOR DIALOG ---

function InventoryTable({ items }: { items: any[] }) {
  if (items.length === 0) return <div className="p-4 text-xs text-muted-foreground text-center">No items found.</div>
  return (
    <table className="w-full text-left text-xs">
      <thead className="bg-slate-50 text-[9px] uppercase tracking-widest text-muted-foreground sticky top-0">
        <tr>
          <th className="px-3 py-2 font-bold border-b">Barcode</th>
          <th className="px-3 py-2 font-bold border-b">Category</th>
          <th className="px-3 py-2 font-bold border-b text-right">Net Wt</th>
          <th className="px-3 py-2 font-bold border-b text-right">Valuation</th>
        </tr>
      </thead>
      <tbody>
        {items.map(item => (
          <tr key={item.id} className="border-b last:border-0 hover:bg-slate-50">
            <td className="px-3 py-2 font-mono font-bold text-slate-700">{item.barcode}</td>
            <td className="px-3 py-2 text-slate-600">{item.item_category}</td>
            <td className="px-3 py-2 text-right">{item.net_weight_g}g</td>
            <td className="px-3 py-2 text-right text-emerald-600 font-medium">₹{item.cost_total}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function GoldTable({ items }: { items: any[] }) {
  if (items.length === 0) return <div className="p-4 text-xs text-muted-foreground text-center">No raw gold found.</div>
  return (
    <table className="w-full text-left text-xs">
      <thead className="bg-slate-50 text-[9px] uppercase tracking-widest text-muted-foreground sticky top-0">
        <tr>
          <th className="px-3 py-2 font-bold border-b">Batch No</th>
          <th className="px-3 py-2 font-bold border-b">Purity</th>
          <th className="px-3 py-2 font-bold border-b text-right">Avail Wt</th>
        </tr>
      </thead>
      <tbody>
        {items.map(item => (
          <tr key={item.id} className="border-b last:border-0 hover:bg-slate-50">
            <td className="px-3 py-2 font-mono font-bold text-amber-700">{item.batch_number}</td>
            <td className="px-3 py-2 text-slate-600">{item.purity_karat}</td>
            <td className="px-3 py-2 text-right font-bold">{item.remaining_weight_g}g</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function DiamondTable({ items }: { items: any[] }) {
  if (items.length === 0) return <div className="p-4 text-xs text-muted-foreground text-center">No loose diamonds found.</div>
  return (
    <table className="w-full text-left text-xs">
      <thead className="bg-slate-50 text-[9px] uppercase tracking-widest text-muted-foreground sticky top-0">
        <tr>
          <th className="px-3 py-2 font-bold border-b">Lot No</th>
          <th className="px-3 py-2 font-bold border-b">Shape</th>
          <th className="px-3 py-2 font-bold border-b text-right">Avail Cts</th>
        </tr>
      </thead>
      <tbody>
        {items.map(item => (
          <tr key={item.id} className="border-b last:border-0 hover:bg-slate-50">
            <td className="px-3 py-2 font-mono font-bold text-blue-700">{item.lot_number}</td>
            <td className="px-3 py-2 text-slate-600">{item.shape || 'Mixed'}</td>
            <td className="px-3 py-2 text-right font-bold">{item.remaining_weight_cts}ct</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}