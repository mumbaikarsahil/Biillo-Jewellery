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
  DollarSign,
  Save,
  Search,
  Users,
  ChevronRight
} from "lucide-react"
import { toast } from "sonner"

import { supabase } from "@/lib/supabaseClient"
import { useAuth } from "@/hooks/useAuth"
import { useStoreLocation } from "@/hooks/useStoreLocation"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
const ROUTING_DISTANCE = NODE_WIDTH + NODE_GAP; 

export default function MasterDashboard() {
  const { appUser } = useAuth()
  const { isHQ, userWarehouseId } = useStoreLocation()

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

  // --- GLOBAL GOLD RATE STATE ---
  const [isRateDialogOpen, setIsRateDialogOpen] = useState(false)
  const [goldRates, setGoldRates] = useState<Record<string, number | string>>({ k24: 7250, k22: 6645, k18: 5437 })
  const [isSavingRates, setIsSavingRates] = useState(false)

  const fetchCommandData = async () => {
    if (!appUser?.company_id) {
      setLoading(false)
      return
    }
    setRefreshing(true)
    
    try {
      const today = new Date().toISOString().split('T')[0]

      const [whRes, invRes, salesRes, purchRes, trfRes, companyRes] = await Promise.all([
        supabase.from('warehouses').select('*').eq('company_id', appUser.company_id).eq('is_active', true),
        supabase.from('inventory_items').select('warehouse_id, metal_type, gross_weight_g, total_stone_weight_cts, cost_total').eq('company_id', appUser.company_id).eq('status', 'in_stock'),
        supabase.from('invoices').select('warehouse_id, final_total, invoice_items(gross_profit)').eq('company_id', appUser.company_id).gte('created_at', `${today}T00:00:00Z`),
        supabase.from('purchase_invoices').select('warehouse_id, total_payable').eq('company_id', appUser.company_id).gte('created_at', `${today}T00:00:00Z`),
        supabase.from('stock_transfers').select('from_warehouse_id, to_warehouse_id').eq('company_id', appUser.company_id).eq('status', 'in_transit'),
        supabase.from('companies').select('current_rate_24k, current_rate_22k, current_rate_18k').eq('id', appUser.company_id).maybeSingle() 
      ])

      if (whRes.error) throw whRes.error
      setWarehouses(whRes.data || [])

      if (companyRes.data) {
        setGoldRates({ 
          k24: companyRes.data.current_rate_24k || 7250, 
          k22: companyRes.data.current_rate_22k || 6645, 
          k18: companyRes.data.current_rate_18k || 5437 
        })
      }

      const newMetrics: Record<string, WarehouseMetrics> = {}
      
      whRes.data?.forEach(wh => {
        const nodeInv = invRes.data?.filter(i => i.warehouse_id === wh.id) || []
        const nodeSales = salesRes.data?.filter(s => s.warehouse_id === wh.id) || []
        const nodePurch = purchRes.data?.filter(p => p.warehouse_id === wh.id) || []
        const nodeTrf = trfRes.data?.filter(t => t.from_warehouse_id === wh.id || t.to_warehouse_id === wh.id) || []

        const goldWeight = nodeInv.filter(i => i.metal_type?.toLowerCase().includes('gold')).reduce((sum, i) => sum + (Number(i.gross_weight_g) || 0), 0)
        const diamondWeight = nodeInv.reduce((sum, i) => sum + (Number(i.total_stone_weight_cts) || 0), 0)
        const valuation = nodeInv.reduce((sum, i) => sum + (Number(i.cost_total) || 0), 0)
        const salesToday = nodeSales.reduce((sum, s) => sum + (Number(s.final_total) || 0), 0)
        const purchToday = nodePurch.reduce((sum, p) => sum + (Number(p.total_payable) || 0), 0)
        
        let profitToday = 0
        nodeSales.forEach(sale => {
          const items = sale.invoice_items as any[]
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

  useEffect(() => {
    const fetchNodeDetails = async () => {
      if (!dialogNodeId) return;
      setDetailsLoading(true)
      const targetNode = warehouses.find(w => w.id === dialogNodeId)
      try {
        const { data: items } = await supabase.from('inventory_items').select('id, barcode, item_category, net_weight_g, cost_total').eq('warehouse_id', dialogNodeId).eq('status', 'in_stock').order('created_at', { ascending: false }).limit(100)
        setNodeItems(items || [])

        if (targetNode?.warehouse_type === 'main_safe') {
           const { data: gold } = await supabase.from('inventory_gold_batches').select('id, batch_number, purity_karat, remaining_weight_g').eq('warehouse_id', dialogNodeId).gt('remaining_weight_g', 0)
           const { data: diamonds } = await supabase.from('inventory_diamond_lots').select('id, lot_number, shape, remaining_weight_cts').eq('warehouse_id', dialogNodeId).gt('remaining_weight_cts', 0)
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

  const handleSaveRates = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSavingRates(true)
    try {
      const { data, error } = await supabase.from('companies').update({ current_rate_24k: Number(goldRates.k24), current_rate_22k: Number(goldRates.k22), current_rate_18k: Number(goldRates.k18) }).eq('id', appUser?.company_id).select()
      if (error) throw error
      if (!data || data.length === 0) throw new Error("Update blocked by database security policy. Ask owner for permission.")
      setIsRateDialogOpen(false)
      toast.success("Board Rates Broadcasted")
    } catch (err: any) {
      toast.error("Failed to broadcast rates: " + err.message)
    } finally {
      setIsSavingRates(false)
    }
  }

  // --- CANVAS CONTROLS ---
  const handleWheel = (e: React.WheelEvent) => {
    if (!isHQ) return;
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault()
      setTransform(prev => ({ ...prev, scale: Math.min(Math.max(0.3, prev.scale - e.deltaY * 0.002), 2) }))
    } else {
      setTransform(prev => ({ ...prev, x: prev.x - e.deltaX, y: prev.y - e.deltaY }))
    }
  }
  const handlePointerDown = (e: React.PointerEvent) => {
    if (!isHQ || (e.button !== 0 && e.button !== 1)) return 
    setIsDragging(true)
    if (canvasRef.current) canvasRef.current.setPointerCapture(e.pointerId)
  }
  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging || !isHQ) return
    setTransform(prev => ({ ...prev, x: prev.x + e.movementX, y: prev.y + e.movementY }))
  }
  const handlePointerUp = (e: React.PointerEvent) => {
    setIsDragging(false)
    if (canvasRef.current) canvasRef.current.releasePointerCapture(e.pointerId)
  }

  const zoomIn = () => setTransform(p => ({ ...p, scale: Math.min(p.scale + 0.2, 2) }))
  const zoomOut = () => setTransform(p => ({ ...p, scale: Math.max(p.scale - 0.2, 0.3) }))
  const resetZoom = () => setTransform({ x: 0, y: 50, scale: 1 })
  const openNodeDialog = (nodeId: string, tab: string) => { setDialogNodeId(nodeId); setDialogTab(tab) }

  // --- TOPOLOGY ROUTING ---
  const mainSafes = warehouses.filter(w => w.warehouse_type === 'main_safe')
  const factories = warehouses.filter(w => w.warehouse_type === 'factory')
  const branches = warehouses.filter(w => w.warehouse_type === 'branch')

  const myNode = warehouses.find(w => w.id === userWarehouseId) || warehouses[0]
  const dialogNode = warehouses.find(w => w.id === dialogNodeId)
  const dialogMetrics = dialogNodeId ? metricsMap[dialogNodeId] : null

  if (!appUser) return null

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden relative">
      
      {/* INJECT ANIMATED DATA WIRES CSS */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes dataFlowV { from { background-position: 0 0; } to { background-position: 0 12px; } }
        @keyframes dataFlowH { from { background-position: 0 0; } to { background-position: 12px 0; } }
        .wire-v { width: 2px; background: linear-gradient(to bottom, #10b981 50%, #cbd5e1 50%); background-size: 2px 12px; animation: dataFlowV 0.6s linear infinite; }
        .wire-h { height: 2px; background: linear-gradient(to right, #10b981 50%, #cbd5e1 50%); background-size: 12px 2px; animation: dataFlowH 0.6s linear infinite; }
        .wire-gold-v { width: 2px; background: linear-gradient(to bottom, #fbbf24 50%, #cbd5e1 50%); background-size: 2px 12px; animation: dataFlowV 0.6s linear infinite; }
        .wire-gold-h { height: 2px; background: linear-gradient(to right, #fbbf24 50%, #cbd5e1 50%); background-size: 12px 2px; animation: dataFlowH 0.6s linear infinite; }
        .hide-scroll::-webkit-scrollbar { display: none; }
        .hide-scroll { -ms-overflow-style: none; scrollbar-width: none; }
      `}} />

      {/* --- STANDARD IDE HEADER --- */}
      <header className="z-40 w-full bg-card border-b border-border px-3 sm:px-4 h-12 flex items-center justify-between shrink-0 shadow-sm relative">
        <div className="flex items-center gap-2 sm:gap-3">
          <Link href="/dashboard">
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-md">
              <LayoutDashboard className="h-4 w-4 text-muted-foreground" />
            </Button>
          </Link>
          <Separator orientation="vertical" className="h-4 hidden sm:block" />
          <nav className="flex items-center gap-2 text-sm">
            <span className="font-semibold text-foreground truncate max-w-[120px] sm:max-w-none">
              {isHQ ? "Master Topology" : "Terminal"}
            </span>
            <Badge variant="outline" className="text-[9px] uppercase tracking-widest font-bold bg-emerald-500/10 text-emerald-600 border-emerald-200 hidden sm:inline-flex">
              Online
            </Badge>
          </nav>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {/* Zoom controls only show on Desktop for HQ */}
          {isHQ && (
            <div className="hidden md:flex items-center bg-muted/30 rounded-md border border-border p-0.5 gap-1">
              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={zoomOut}><ZoomOut className="h-3.5 w-3.5" /></Button>
              <span className="text-[10px] font-mono font-bold w-10 text-center">{Math.round(transform.scale * 100)}%</span>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={zoomIn}><ZoomIn className="h-3.5 w-3.5" /></Button>
              <Separator orientation="vertical" className="h-4 mx-1" />
              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={resetZoom}><Maximize className="h-3.5 w-3.5" /></Button>
            </div>
          )}
          <Button variant="outline" size="sm" className="h-8 text-xs font-bold px-2 sm:px-3 shadow-sm" onClick={fetchCommandData} disabled={refreshing}>
            <RefreshCw className={`h-3.5 w-3.5 sm:mr-1.5 ${refreshing ? 'animate-spin' : ''}`} /> 
            <span className="hidden sm:inline">Sync</span>
          </Button>
        </div>
      </header>

      {/* --- CONDITIONAL VIEW RENDERING --- */}
      {isHQ ? (
        <>
          {/* VIEW A: DESKTOP CANVAS (HQ ONLY) */}
          <main 
            ref={canvasRef}
            className="hidden md:block flex-1 relative w-full h-full cursor-grab active:cursor-grabbing select-none overflow-hidden"
            style={{ 
              backgroundColor: '#f8fafc', backgroundImage: 'radial-gradient(#cbd5e1 1px, transparent 1px)', 
              backgroundSize: `${24 * transform.scale}px ${24 * transform.scale}px`, backgroundPosition: `${transform.x}px ${transform.y}px`, touchAction: 'none'
            }}
            onWheel={handleWheel} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerLeave={handlePointerUp}
          >
            <div className="absolute origin-top-left flex flex-col items-center min-w-max p-10 transition-transform duration-75 ease-out pb-32" style={{ transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`, left: '50%', marginLeft: '-50%' }}>
              {loading ? (
                <div className="flex flex-col items-center opacity-50"><Skeleton className="h-[100px] w-[256px] rounded-sm mb-8" /><Skeleton className="h-[180px] w-[256px] rounded-sm" /></div>
              ) : (
                <div className="flex flex-col items-center w-full">
                  {/* MASTER GOLD RATE NODE */}
                  <div className="flex flex-col items-center relative z-20">
                    <div className="w-[256px] bg-amber-50 border-2 border-amber-400 shadow-[0_0_20px_rgba(251,191,36,0.3)] rounded-sm overflow-hidden flex flex-col shrink-0 cursor-pointer hover:border-amber-500 transition-colors group" onClick={(e) => { e.stopPropagation(); setIsRateDialogOpen(true); }} onPointerDown={(e) => e.stopPropagation()}>
                      <div className="bg-amber-400 text-amber-950 px-3 py-2 flex items-center justify-between"><div className="flex items-center gap-2"><Coins className="h-4 w-4" /><span className="text-xs font-black uppercase tracking-widest">Global Board Rate</span></div></div>
                      <div className="p-3 grid grid-cols-3 gap-2 text-center divide-x divide-amber-200">
                        <div><p className="text-[10px] font-bold text-amber-600 uppercase">24K</p><p className="text-sm font-black text-amber-900 mt-0.5">₹{goldRates.k24}</p></div>
                        <div><p className="text-[10px] font-bold text-amber-600 uppercase">22K</p><p className="text-sm font-black text-amber-900 mt-0.5">₹{goldRates.k22}</p></div>
                        <div><p className="text-[10px] font-bold text-amber-600 uppercase">18K</p><p className="text-sm font-black text-amber-900 mt-0.5">₹{goldRates.k18}</p></div>
                      </div>
                      <div className="bg-white px-3 py-1.5 border-t border-amber-200 flex justify-center items-center group-hover:bg-amber-100 transition-colors"><span className="text-[9px] font-bold text-amber-700 uppercase tracking-widest">Click to Update Protocol</span></div>
                    </div>
                  </div>
                  {/* WIRES & TIERS... */}
                  <div className="flex flex-col items-center w-full relative z-0"><div className="wire-gold-v h-8" />{mainSafes.length > 1 && <div className="wire-gold-h" style={{ width: `${(mainSafes.length - 1) * ROUTING_DISTANCE}px` }} />}<div className="wire-v h-4" /></div>
                  <div className="flex flex-col items-center relative z-10"><div className="flex justify-center gap-[64px]">{mainSafes.map(node => <NodeBlock key={node.id} node={node} metrics={metricsMap[node.id]} onAction={openNodeDialog} />)}</div></div>
                  {factories.length > 0 && <div className="flex flex-col items-center w-full relative z-0"><div className="wire-v h-8" />{factories.length > 1 && <div className="wire-h" style={{ width: `${(factories.length - 1) * ROUTING_DISTANCE}px` }} />}</div>}
                  {factories.length > 0 && <div className="flex flex-col items-center relative z-10"><div className="flex justify-center gap-[64px] w-full">{factories.map(node => (<div key={node.id} className="flex flex-col items-center">{factories.length > 1 && <div className="wire-v h-8" />}<NodeBlock node={node} metrics={metricsMap[node.id]} onAction={openNodeDialog} /></div>))}</div></div>}
                  {branches.length > 0 && <div className="flex flex-col items-center w-full relative z-0"><div className="wire-v h-8" />{branches.length > 1 && <div className="wire-h" style={{ width: `${(branches.length - 1) * ROUTING_DISTANCE}px` }} />}</div>}
                  {branches.length > 0 && <div className="flex flex-col items-center relative z-10"><div className="flex justify-center gap-[64px] w-full">{branches.map(node => (<div key={node.id} className="flex flex-col items-center">{branches.length > 1 && <div className="wire-v h-8" />}<NodeBlock node={node} metrics={metricsMap[node.id]} onAction={openNodeDialog} /></div>))}</div></div>}
                </div>
              )}
            </div>
          </main>

          {/* VIEW B: MOBILE LIST VIEW (HQ ONLY) */}
          <main className="block md:hidden flex-1 overflow-y-auto bg-slate-50 p-4 pb-28 space-y-6">
            {loading ? (
              <div className="space-y-4"><Skeleton className="h-32 w-full rounded-lg" /><Skeleton className="h-48 w-full rounded-lg" /></div>
            ) : (
              <div className="space-y-6 max-w-md mx-auto">
                {/* Mobile Gold Rate Card */}
                <div onClick={() => setIsRateDialogOpen(true)} className="bg-amber-50 border border-amber-200 rounded-xl p-4 cursor-pointer shadow-sm active:scale-[0.98] transition-transform">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-amber-900 flex items-center gap-2"><Coins className="h-4 w-4"/> Global Board Rate</h3>
                    <Badge className="bg-amber-200 text-amber-800 border-none font-bold tracking-widest text-[9px] uppercase">Update</Badge>
                  </div>
                  <div className="grid grid-cols-3 divide-x divide-amber-200/60 text-center">
                    <div><p className="text-[10px] text-amber-700 font-bold uppercase mb-1">24K</p><p className="font-black text-amber-950 text-sm">₹{goldRates.k24}</p></div>
                    <div><p className="text-[10px] text-amber-700 font-bold uppercase mb-1">22K</p><p className="font-black text-amber-950 text-sm">₹{goldRates.k22}</p></div>
                    <div><p className="text-[10px] text-amber-700 font-bold uppercase mb-1">18K</p><p className="font-black text-amber-950 text-sm">₹{goldRates.k18}</p></div>
                  </div>
                </div>

                {/* Render Nodes as Lists */}
                {mainSafes.length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 px-1">Main Safes</h4>
                    <div className="grid grid-cols-1 gap-3">{mainSafes.map(node => <NodeBlock key={node.id} node={node} metrics={metricsMap[node.id]} onAction={openNodeDialog} />)}</div>
                  </div>
                )}
                {factories.length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 px-1 mt-6">Factories</h4>
                    <div className="grid grid-cols-1 gap-3">{factories.map(node => <NodeBlock key={node.id} node={node} metrics={metricsMap[node.id]} onAction={openNodeDialog} />)}</div>
                  </div>
                )}
                {branches.length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 px-1 mt-6">Branches</h4>
                    <div className="grid grid-cols-1 gap-3">{branches.map(node => <NodeBlock key={node.id} node={node} metrics={metricsMap[node.id]} onAction={openNodeDialog} />)}</div>
                  </div>
                )}
              </div>
            )}
          </main>
        </>
      ) : (
        /* =========================================================
           VIEW C: BRANCH MANAGER FOCUSED TERMINAL (NON-HQ)
           ========================================================= */
        <main className="flex-1 w-full h-full bg-slate-50 flex items-start sm:items-center justify-center p-4 sm:p-6 relative pb-28 sm:pb-0 overflow-y-auto">
          <Store className="absolute h-64 w-64 sm:h-96 sm:w-96 text-slate-200/50 pointer-events-none top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
          {loading ? (
             <Skeleton className="h-[200px] w-full max-w-sm rounded-sm z-10 mt-10 sm:mt-0" />
          ) : myNode ? (
            <div className="flex flex-col w-full max-w-sm items-center animate-in fade-in zoom-in duration-500 z-10 mt-6 sm:-mt-20">
              <h2 className="text-xl sm:text-2xl font-black text-slate-800 uppercase tracking-widest mb-4 sm:mb-6 text-center">
                {myNode.name}
                <span className="block text-[10px] font-bold text-indigo-600 mt-1 tracking-widest bg-indigo-100 px-2 py-0.5 rounded inline-block w-max mx-auto">
                  Terminal Overview
                </span>
              </h2>
              <div className="shadow-2xl ring-1 ring-slate-900/5 rounded-xl sm:rounded-sm bg-white w-full">
                <NodeBlock node={myNode} metrics={metricsMap[myNode.id]} onAction={openNodeDialog} />
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center text-slate-400 z-10 mt-20 sm:-mt-20">
              <Store className="h-12 w-12 mb-4 opacity-50" />
              <p className="font-bold uppercase tracking-widest text-xs">No Terminal Assigned</p>
            </div>
          )}
        </main>
      )}

      {/* =========================================================
          GLOBAL: FLOATING iOS-STYLE QUICK NAVIGATION DOCK
          ========================================================= */}
      {/* Raised high enough to clear mobile browser toolbars and global app navbars */}
      <div className="fixed bottom-[90px] sm:bottom-6 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur-xl border border-slate-200 p-1.5 sm:p-2 rounded-full shadow-[0_12px_40px_rgb(0,0,0,0.12)] flex items-center gap-1 sm:gap-2 z-50 max-w-[95vw] overflow-x-auto hide-scroll">
        <DockItem href="/pos" icon={ShoppingCart} label="POS" color="text-indigo-600" hover="hover:bg-indigo-50 hover:text-indigo-700" />
        <DockItem href="/discovery" icon={Search} label="Search" color="text-blue-600" hover="hover:bg-blue-50 hover:text-blue-700" />
        <DockItem href="/inventory" icon={Package} label="Vault" color="text-emerald-600" hover="hover:bg-emerald-50 hover:text-emerald-700" />
        <DockItem href="/transfer" icon={ArrowRightLeft} label="Transit" color="text-amber-600" hover="hover:bg-amber-50 hover:text-amber-700" />
        <DockItem href="/crm" icon={Users} label="CRM" color="text-rose-600" hover="hover:bg-rose-50 hover:text-rose-700" />
      </div>

      {/* --- MASTER GOLD RATE DIALOG (ONLY RENDERS IF HQ) --- */}
      {isHQ && (
        <Dialog open={isRateDialogOpen} onOpenChange={setIsRateDialogOpen}>
          <DialogContent className="w-[95vw] sm:max-w-[600px] bg-white border-border shadow-2xl rounded-xl p-5 sm:p-6">
            <DialogHeader className="pb-4 border-b">
              <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl">
                <div className="p-1.5 sm:p-2 bg-amber-100 rounded-md"><Coins className="h-4 w-4 sm:h-5 sm:w-5 text-amber-600" /></div>
                Global Board Rates
              </DialogTitle>
              <DialogDescription className="text-xs sm:text-sm">
                <strong>Two-Way Sync:</strong> Enter rates per 10 grams OR per 1 gram. The system will automatically calculate and sync the other.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSaveRates} className="space-y-6 pt-2">
              <div>
                <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-2">
                  <div className="flex-1 h-px bg-slate-200"></div>Rate per 10 Grams<div className="flex-1 h-px bg-slate-200"></div>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                  {['k24', 'k22', 'k18'].map((k) => (
                    <div key={`${k}-10g`} className="space-y-1 sm:space-y-2">
                      <Label className="text-[10px] font-bold text-amber-700 uppercase">{k.replace('k', '')} Karat</Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">₹</span>
                        <Input type="number" step="any" required className="pl-7 font-mono font-bold h-10" onWheel={(e) => e.currentTarget.blur()}
                          value={goldRates[k] === '' ? '' : Number(goldRates[k]) * 10}
                          onChange={(e) => { const val = e.target.value; setGoldRates(prev => ({...prev, [k]: val === '' ? '' : Number(val) / 10})) }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-2">
                  <div className="flex-1 h-px bg-slate-200"></div>Rate per 1 Gram<div className="flex-1 h-px bg-slate-200"></div>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                  {['k24', 'k22', 'k18'].map((k) => (
                    <div key={`${k}-1g`} className="space-y-1 sm:space-y-2">
                      <Label className="text-[10px] font-bold text-slate-500 uppercase">{k.replace('k', '')} Karat</Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">₹</span>
                        <Input type="number" step="any" required className="pl-7 font-mono font-bold bg-slate-50 border-slate-200 text-slate-600 focus:bg-white h-10" onWheel={(e) => e.currentTarget.blur()}
                          value={goldRates[k] === '' ? '' : goldRates[k]}
                          onChange={(e) => { const val = e.target.value; setGoldRates(prev => ({...prev, [k]: val === '' ? '' : Number(val)})) }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <Button type="submit" disabled={isSavingRates} className="w-full mt-2 bg-amber-500 hover:bg-amber-600 text-white font-bold tracking-wider uppercase shadow-sm h-12 rounded-lg">
                {isSavingRates ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="h-4 w-4 mr-2" /> Broadcast to Network</>}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* --- DETAILED INSPECTOR DIALOG --- */}
      <Dialog open={!!dialogNodeId} onOpenChange={(open) => !open && setDialogNodeId(null)}>
        <DialogContent className="w-[95vw] sm:max-w-[800px] p-0 border-border shadow-2xl bg-card overflow-hidden max-h-[90vh] flex flex-col rounded-xl">
          {dialogNode && dialogMetrics && (
            <>
              <DialogHeader className="bg-secondary/30 p-4 sm:p-5 border-b border-border shrink-0">
                 <div className="flex items-center gap-3">
                    <div className="p-2 bg-background border border-border rounded shadow-sm">
                      {dialogNode.warehouse_type === 'main_safe' ? <Database className="h-5 w-5 text-slate-700" /> : dialogNode.warehouse_type === 'branch' ? <Store className="h-5 w-5 text-slate-700" /> : <Factory className="h-5 w-5 text-slate-700" />}
                    </div>
                    <div className="text-left">
                      <DialogTitle className="text-base sm:text-lg font-bold text-foreground leading-none">{dialogNode.name}</DialogTitle>
                      <p className="text-[10px] font-mono text-muted-foreground mt-1 uppercase tracking-widest">{dialogNode.warehouse_code} · {dialogNode.warehouse_type.replace('_', ' ')}</p>
                    </div>
                 </div>
              </DialogHeader>

              <Tabs value={dialogTab} onValueChange={setDialogTab} className="w-full flex flex-col flex-1 overflow-hidden">
                <TabsList className="w-full bg-transparent border-b rounded-none h-11 justify-start px-2 sm:px-5 gap-2 sm:gap-6 shrink-0 overflow-x-auto hide-scroll">
                  <TabsTrigger value="stock" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary shadow-none bg-transparent whitespace-nowrap text-xs sm:text-sm">Vault Stock</TabsTrigger>
                  <TabsTrigger value="revenue" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary shadow-none bg-transparent whitespace-nowrap text-xs sm:text-sm">Commerce</TabsTrigger>
                  <TabsTrigger value="transfers" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary shadow-none bg-transparent whitespace-nowrap text-xs sm:text-sm">Transfers</TabsTrigger>
                  <TabsTrigger value="purchases" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary shadow-none bg-transparent whitespace-nowrap text-xs sm:text-sm">Procurement</TabsTrigger>
                </TabsList>

                <div className="flex-1 bg-slate-50 overflow-y-auto relative p-3 sm:p-5 min-h-[50vh] sm:min-h-[400px]">
                  <TabsContent value="stock" className="m-0 h-full flex flex-col">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 shrink-0 mb-4">
                      <div className="p-3 bg-white border border-border rounded-lg shadow-sm"><span className="flex items-center gap-1.5 text-[9px] sm:text-[10px] font-bold text-muted-foreground uppercase"><Package className="h-3 w-3"/> Units</span><p className="text-base sm:text-lg font-black mt-1">{dialogMetrics.inventoryCount}</p></div>
                      <div className="p-3 bg-white border border-border rounded-lg shadow-sm"><span className="flex items-center gap-1.5 text-[9px] sm:text-[10px] font-bold text-muted-foreground uppercase"><DollarSign className="h-3 w-3"/> Value</span><p className="text-base sm:text-lg font-black text-emerald-600 mt-1">₹{(dialogMetrics.inventoryValuation / 100000).toFixed(2)}L</p></div>
                      <div className="p-3 bg-white border border-border rounded-lg shadow-sm"><span className="flex items-center gap-1.5 text-[9px] sm:text-[10px] font-bold text-muted-foreground uppercase"><Coins className="h-3 w-3 text-amber-500"/> Gold</span><p className="text-base sm:text-lg font-mono font-bold mt-1">{dialogMetrics.totalGoldWeight.toFixed(1)}g</p></div>
                      <div className="p-3 bg-white border border-border rounded-lg shadow-sm"><span className="flex items-center gap-1.5 text-[9px] sm:text-[10px] font-bold text-muted-foreground uppercase"><Diamond className="h-3 w-3 text-blue-500"/> Stone</span><p className="text-base sm:text-lg font-mono font-bold mt-1">{dialogMetrics.totalDiamondWeight.toFixed(1)}ct</p></div>
                    </div>
                    <div className="flex-1 bg-white border border-border rounded-lg shadow-sm overflow-hidden flex flex-col relative min-h-[300px]">
                      {detailsLoading ? (
                        <div className="flex-1 flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                      ) : (
                        dialogNode.warehouse_type === 'main_safe' ? (
                          <Tabs defaultValue="finished" className="w-full h-full flex flex-col">
                            <div className="bg-slate-100 border-b px-2 py-1 shrink-0 overflow-x-auto hide-scroll"><TabsList className="h-8 bg-transparent w-max"><TabsTrigger value="finished" className="text-[10px] h-7">Finished Goods</TabsTrigger><TabsTrigger value="gold" className="text-[10px] h-7">Raw Gold</TabsTrigger><TabsTrigger value="diamond" className="text-[10px] h-7">Loose Diamonds</TabsTrigger></TabsList></div>
                            <TabsContent value="finished" className="m-0 flex-1 overflow-auto custom-scrollbar"><InventoryTable items={nodeItems} /></TabsContent>
                            <TabsContent value="gold" className="m-0 flex-1 overflow-auto custom-scrollbar"><GoldTable items={nodeGold} /></TabsContent>
                            <TabsContent value="diamond" className="m-0 flex-1 overflow-auto custom-scrollbar"><DiamondTable items={nodeDiamonds} /></TabsContent>
                          </Tabs>
                        ) : (
                          <div className="h-full flex flex-col"><div className="bg-slate-100 border-b px-3 py-2 text-[10px] font-bold uppercase text-muted-foreground shrink-0">Finished Inventory Log</div><div className="flex-1 overflow-auto custom-scrollbar"><InventoryTable items={nodeItems} /></div></div>
                        )
                      )}
                    </div>
                  </TabsContent>

                  <TabsContent value="revenue" className="m-0 h-full flex flex-col space-y-4">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">Today's Commerce Stream</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                      <div className="p-5 sm:p-6 bg-white border border-border rounded-xl shadow-sm"><span className="text-xs font-bold text-muted-foreground uppercase">Gross Revenue</span><p className="text-2xl sm:text-3xl font-black mt-2">₹{dialogMetrics.todaySales.toLocaleString()}</p></div>
                      <div className="p-5 sm:p-6 bg-emerald-50/50 border border-emerald-200 rounded-xl shadow-sm"><span className="text-xs font-bold text-emerald-700 uppercase">Gross Margin</span><p className="text-2xl sm:text-3xl font-black text-emerald-600 mt-2">₹{dialogMetrics.todayProfit.toLocaleString()}</p></div>
                    </div>
                  </TabsContent>

                  <TabsContent value="transfers" className="m-0 h-full flex flex-col space-y-4">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">Logistics Routing</h4>
                    <div className="flex-1 p-6 bg-white border border-border rounded-xl shadow-sm flex flex-col items-center justify-center text-center min-h-[250px]"><ArrowRightLeft className="h-10 w-10 sm:h-12 sm:w-12 text-slate-300 mb-4" /><p className="text-3xl sm:text-4xl font-black">{dialogMetrics.activeTransfers}</p><p className="text-[10px] sm:text-xs font-bold uppercase text-muted-foreground mt-1">Active In-Transit Parcels</p></div>
                  </TabsContent>

                  <TabsContent value="purchases" className="m-0 h-full flex flex-col space-y-4">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">Procurement Registry</h4>
                    <div className="flex-1 p-6 bg-white border border-border rounded-xl shadow-sm flex flex-col items-center justify-center text-center min-h-[250px]"><ShoppingCart className="h-10 w-10 sm:h-12 sm:w-12 text-slate-300 mb-4" /><p className="text-3xl sm:text-4xl font-black">₹{dialogMetrics.todayPurchases.toLocaleString()}</p><p className="text-[10px] sm:text-xs font-bold uppercase text-muted-foreground mt-1">Today's Acquisitions</p></div>
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

function DockItem({ href, icon: Icon, label, color, hover }: any) {
  return (
    <Link href={href} className="shrink-0">
      <Button variant="ghost" size="icon" className={`h-11 w-11 sm:h-14 sm:w-14 rounded-full ${hover} transition-all group relative`}>
        <Icon className={`h-5 w-5 sm:h-6 sm:w-6 ${color}`} />
        <span className="absolute -top-10 scale-0 opacity-0 transition-all duration-200 ease-out rounded bg-slate-800 p-2 text-[10px] font-bold text-white group-hover:scale-100 group-hover:opacity-100 uppercase tracking-widest shadow-xl whitespace-nowrap pointer-events-none z-50 hidden sm:block">
          {label}
        </span>
      </Button>
    </Link>
  )
}

function NodeBlock({ node, metrics, onAction }: { node: Warehouse, metrics: WarehouseMetrics, onAction: (id: string, tab: string) => void }) {
  const isMain = node.warehouse_type === 'main_safe'
  const isBranch = node.warehouse_type === 'branch'
  const Icon = isMain ? Database : isBranch ? Store : Factory
  
  return (
    <div 
      className="w-full md:w-[256px] bg-white border-2 border-slate-300 shadow-sm rounded-xl md:rounded-sm overflow-hidden flex flex-col shrink-0 group hover:border-slate-400 transition-colors"
      onPointerDown={(e) => e.stopPropagation()} 
    >
      <div className="bg-slate-100 border-b border-slate-200 px-4 py-3 md:px-3 md:py-2 flex items-center justify-between">
        <div className="flex items-center gap-2 overflow-hidden">
          <Icon className="h-4 w-4 md:h-3.5 md:w-3.5 text-slate-600 shrink-0" />
          <span className="text-sm md:text-xs font-bold text-slate-800 uppercase tracking-tight truncate">{node.name}</span>
        </div>
        <div className="h-2 w-2 rounded-full bg-emerald-500 shrink-0 shadow-[0_0_8px_rgba(16,185,129,0.8)]" title="Online" />
      </div>
      
      <div className="flex flex-col">
        <SubActionRow title="Vault Stock" value={`${metrics?.inventoryCount || 0} U`} icon={Package} onClick={() => onAction(node.id, 'stock')} />
        <SubActionRow title="Revenue" value={`₹${(metrics?.todaySales / 100000 || 0).toFixed(1)}L`} icon={TrendingUp} onClick={() => onAction(node.id, 'revenue')} />
        <SubActionRow title="Transfers" value={`${metrics?.activeTransfers || 0} Open`} icon={ArrowRightLeft} onClick={() => onAction(node.id, 'transfers')} />
        <SubActionRow title="Purchases" value={`₹${(metrics?.todayPurchases / 100000 || 0).toFixed(1)}L`} icon={ShoppingCart} onClick={() => onAction(node.id, 'purchases')} isLast />
      </div>
    </div>
  )
}

function SubActionRow({ title, value, icon: Icon, onClick, isLast = false }: any) {
  return (
    <div 
      className={`flex justify-between items-center px-4 py-3 md:px-3 md:py-2 bg-white hover:bg-primary/5 cursor-pointer transition-colors ${!isLast ? 'border-b border-slate-100' : ''}`}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
    >
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 md:h-3 md:w-3 text-slate-400" />
        <span className="text-[11px] md:text-[10px] font-semibold text-slate-600 uppercase tracking-widest">{title}</span>
      </div>
      <span className="text-sm md:text-xs font-mono font-bold text-slate-900">{value}</span>
    </div>
  )
}

// --- TABLE SUB-COMPONENTS FOR DIALOG ---
function InventoryTable({ items }: { items: any[] }) {
  if (items.length === 0) return <div className="p-4 text-xs text-muted-foreground text-center">No items found.</div>
  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full text-left text-xs min-w-[450px]">
        <thead className="bg-slate-50 text-[9px] uppercase tracking-widest text-muted-foreground sticky top-0">
          <tr><th className="px-3 py-2 font-bold border-b">Barcode</th><th className="px-3 py-2 font-bold border-b">Category</th><th className="px-3 py-2 font-bold border-b text-right">Net Wt</th><th className="px-3 py-2 font-bold border-b text-right">Valuation</th></tr>
        </thead>
        <tbody>
          {items.map(item => (
            <tr key={item.id} className="border-b last:border-0 hover:bg-slate-50"><td className="px-3 py-2 font-mono font-bold text-slate-700">{item.barcode}</td><td className="px-3 py-2 text-slate-600">{item.item_category}</td><td className="px-3 py-2 text-right">{item.net_weight_g}g</td><td className="px-3 py-2 text-right text-emerald-600 font-medium">₹{item.cost_total}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function GoldTable({ items }: { items: any[] }) {
  if (items.length === 0) return <div className="p-4 text-xs text-muted-foreground text-center">No raw gold found.</div>
  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full text-left text-xs min-w-[350px]">
        <thead className="bg-slate-50 text-[9px] uppercase tracking-widest text-muted-foreground sticky top-0">
          <tr><th className="px-3 py-2 font-bold border-b">Batch No</th><th className="px-3 py-2 font-bold border-b">Purity</th><th className="px-3 py-2 font-bold border-b text-right">Avail Wt</th></tr>
        </thead>
        <tbody>
          {items.map(item => (
            <tr key={item.id} className="border-b last:border-0 hover:bg-slate-50"><td className="px-3 py-2 font-mono font-bold text-amber-700">{item.batch_number}</td><td className="px-3 py-2 text-slate-600">{item.purity_karat}</td><td className="px-3 py-2 text-right font-bold">{item.remaining_weight_g}g</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function DiamondTable({ items }: { items: any[] }) {
  if (items.length === 0) return <div className="p-4 text-xs text-muted-foreground text-center">No loose diamonds found.</div>
  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full text-left text-xs min-w-[350px]">
        <thead className="bg-slate-50 text-[9px] uppercase tracking-widest text-muted-foreground sticky top-0">
          <tr><th className="px-3 py-2 font-bold border-b">Lot No</th><th className="px-3 py-2 font-bold border-b">Shape</th><th className="px-3 py-2 font-bold border-b text-right">Avail Cts</th></tr>
        </thead>
        <tbody>
          {items.map(item => (
            <tr key={item.id} className="border-b last:border-0 hover:bg-slate-50"><td className="px-3 py-2 font-mono font-bold text-blue-700">{item.lot_number}</td><td className="px-3 py-2 text-slate-600">{item.shape || 'Mixed'}</td><td className="px-3 py-2 text-right font-bold">{item.remaining_weight_cts}ct</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}