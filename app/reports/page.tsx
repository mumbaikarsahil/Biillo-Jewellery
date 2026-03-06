"use client"

import React, { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabaseClient'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { 
  Select, SelectContent, SelectItem, 
  SelectTrigger, SelectValue 
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts'
import { 
  BarChart3, Download, Printer, Store, Calendar, 
  RefreshCw, Package, TrendingUp, ArrowRightLeft, Briefcase, FileText
} from 'lucide-react'

// --- Types ---
interface KPIStats {
  totalSales: number
  avgDailySales: number
  pendingTransfers: number
  activeJobBags: number
}

export default function ReportsPage() {
  const { appUser } = useAuth()
  
  // --- FILTER STATES ---
  const [warehouses, setWarehouses] = useState<any[]>([])
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('all')
  
  const [startDate, setStartDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().split('T')[0];
  })
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0])

  // --- DASHBOARD STATES ---
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState<string | null>(null)
  
  const [kpis, setKpis] = useState<KPIStats>({ totalSales: 0, avgDailySales: 0, pendingTransfers: 0, activeJobBags: 0 })
  const [salesTrend, setSalesTrend] = useState<any[]>([])
  const [inventoryDist, setInventoryDist] = useState<any[]>([])

  // 1. Fetch Warehouses for Filter
  useEffect(() => {
    async function fetchWarehouses() {
      if (!appUser?.company_id) return
      const { data } = await supabase.from('warehouses').select('id, name').eq('company_id', appUser.company_id).eq('is_active', true)
      if (data) setWarehouses(data)
    }
    fetchWarehouses()
  }, [appUser])

  // 2. Fetch Dashboard Aggregates based on Filters
  const fetchDashboardData = async () => {
    if (!appUser?.company_id) return
    setLoading(true)

    try {
      // Queries
      let salesQ = supabase.from('sales_invoices')
        .select('created_at, total_amount')
        .eq('company_id', appUser.company_id)
        .gte('created_at', `${startDate}T00:00:00Z`)
        .lte('created_at', `${endDate}T23:59:59Z`)
        
      let invQ = supabase.from('inventory_items')
        .select('warehouse_id, metal_type, status, warehouses(name)')
        .eq('company_id', appUser.company_id)
        .eq('status', 'in_stock')
        
      let trfQ = supabase.from('stock_transfers')
        .select('id, status')
        .eq('company_id', appUser.company_id)
        .in('status', ['draft', 'in_transit'])
        
      let jobQ = supabase.from('job_bags')
        .select('id, status')
        .eq('company_id', appUser.company_id)
        .in('status', ['open', 'issued', 'in_progress'])

      if (selectedWarehouseId !== 'all') {
        salesQ = salesQ.eq('warehouse_id', selectedWarehouseId)
        invQ = invQ.eq('warehouse_id', selectedWarehouseId)
        trfQ = trfQ.or(`from_warehouse_id.eq.${selectedWarehouseId},to_warehouse_id.eq.${selectedWarehouseId}`)
      }

      const [salesRes, invRes, trfRes, jobRes] = await Promise.all([salesQ, invQ, trfQ, jobQ])

      // Process Sales KPI & Trend
      const salesData = salesRes.data || []
      const totalS = salesData.reduce((sum, inv) => sum + (Number(inv.total_amount) || 0), 0)
      const dateDiff = Math.max(1, Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 3600 * 24)))
      
      // Group by Date for Chart
      const trendMap: Record<string, number> = {}
      salesData.forEach(inv => {
        const d = new Date(inv.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
        trendMap[d] = (trendMap[d] || 0) + (Number(inv.total_amount) || 0)
      })
      const trendArr = Object.keys(trendMap).map(k => ({ date: k, amount: trendMap[k] })).slice(-15) // Max 15 points

      // Process Inventory Distribution
      const invData = invRes.data || []
      const distMap: Record<string, number> = {}
      
      // FIX: Added (item: any) to bypass strict property checks
      invData.forEach((item: any) => {
        // If viewing all warehouses, show by warehouse. If viewing specific, show by metal type.
        const key = selectedWarehouseId === 'all' 
          ? (item.warehouses?.name || 'Unknown Vault') 
          : (item.metal_type || 'Unknown Metal')
        distMap[key] = (distMap[key] || 0) + 1
      })
      
      const distArr = Object.keys(distMap).map(k => ({ name: k, value: distMap[k] }))

      setKpis({
        totalSales: totalS,
        avgDailySales: totalS / dateDiff,
        pendingTransfers: trfRes.data?.length || 0,
        activeJobBags: jobRes.data?.length || 0
      })
      setSalesTrend(trendArr)
      setInventoryDist(distArr)

    } catch (err) {
      toast.error('Failed to sync analytics')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDashboardData()
  }, [appUser, selectedWarehouseId, startDate, endDate])

  // --- REPORT EXPORT ENGINE (CSV) ---
  const downloadCSV = (filename: string, rows: any[]) => {
    if (rows.length === 0) return toast.error("No data found for the selected filters.")
    const headers = Object.keys(rows[0])
    const csvContent = [
      headers.join(','),
      ...rows.map(row => headers.map(h => `"${(row[h] || '').toString().replace(/"/g, '""')}"`).join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.setAttribute("href", url)
    link.setAttribute("download", `${filename}_${new Date().toISOString().split('T')[0]}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast.success(`${filename} Exported Successfully`)
  }

  const exportReport = async (reportType: string) => {
    if (!appUser?.company_id) return
    setExporting(reportType)
    toast.info('Compiling report data...')

    try {
      if (reportType === 'inventory') {
        let q = supabase.from('inventory_items')
          .select('barcode, item_category, metal_type, purity_karat, gross_weight_g, net_weight_g, cost_total, status, warehouses(name)')
          .eq('company_id', appUser.company_id)
        if (selectedWarehouseId !== 'all') q = q.eq('warehouse_id', selectedWarehouseId)
        
        const { data, error } = await q
        if (error) throw error
        
        // FIX: Added (d: any)
        const formatted = (data || []).map((d: any) => ({
          'System Barcode': d.barcode, 
          'Category': d.item_category || '--', 
          'Metal': d.metal_type, 
          'Purity': d.purity_karat,
          'Gross Wt (g)': d.gross_weight_g, 
          'Net Wt (g)': d.net_weight_g, 
          'Total Cost (INR)': d.cost_total,
          'Status': d.status, 
          'Location': d.warehouses?.name || '--'
        }))
        downloadCSV('Inventory_Master_Report', formatted)
      } 
      
      else if (reportType === 'sales') {
        let q = supabase.from('sales_invoices')
          .select('invoice_no, created_at, total_amount, payment_mode, customers(full_name), warehouses(name)')
          .eq('company_id', appUser.company_id)
          .gte('created_at', `${startDate}T00:00:00Z`)
          .lte('created_at', `${endDate}T23:59:59Z`)
          
        if (selectedWarehouseId !== 'all') q = q.eq('warehouse_id', selectedWarehouseId)

        const { data, error } = await q
        if (error) throw error

        // FIX: Added (d: any)
        const formatted = (data || []).map((d: any) => ({
          'Invoice Number': d.invoice_no, 
          'Date & Time': new Date(d.created_at).toLocaleString(),
          'Customer Name': d.customers?.full_name || 'Walk-in', 
          'Branch/Vault': d.warehouses?.name || '--',
          'Invoice Total': d.total_amount, 
          'Payment Mode': d.payment_mode || 'Cash'
        }))
        downloadCSV(`Sales_Ledger_${startDate}_to_${endDate}`, formatted)
      }

      else if (reportType === 'transfers') {
        let q = supabase.from('stock_transfers')
          .select('transfer_number, status, transfer_date, from_warehouse_id, to_warehouse_id')
          .eq('company_id', appUser.company_id)
          .gte('transfer_date', startDate)
          .lte('transfer_date', endDate)
          
        const { data, error } = await q
        if (error) throw error
        
        // FIX: Added (d: any)
        const formatted = (data || []).map((d: any) => ({
          'Transfer ID': d.transfer_number, 
          'Date Issued': d.transfer_date, 
          'Current Status': d.status,
          'Origin Node': d.from_warehouse_id, 
          'Destination Node': d.to_warehouse_id
        }))
        downloadCSV('Logistics_Transfer_Report', formatted)
      }

      else if (reportType === 'job_bags') {
        let q = supabase.from('job_bags')
          .select('job_bag_number, product_category, status, issue_date, expected_return_date, karigars(full_name)')
          .eq('company_id', appUser.company_id)
          
        const { data, error } = await q
        if (error) throw error
        
        // FIX: Added (d: any)
        const formatted = (data || []).map((d: any) => ({
          'Job Bag Ref': d.job_bag_number, 
          'Target Category': d.product_category || '--', 
          'Lifecycle Status': d.status,
          'Assigned Artisan': d.karigars?.full_name || '--', 
          'Date Issued': d.issue_date, 
          'Target Return': d.expected_return_date
        }))
        downloadCSV('Manufacturing_WIP_Report', formatted)
      }

    } catch (err: any) {
      toast.error(`Report Generation Failed: ${err.message}`)
    } finally {
      setExporting(null)
    }
  }

  const handlePrint = () => {
    window.print()
  }

  // --- CHART CONFIG ---
  const COLORS = ['#0f172a', '#10b981', '#f59e0b', '#3b82f6', '#8b5cf6']

  return (
    <div className="flex flex-col min-h-screen bg-background">
      
      {/* IDE TOOLBAR (Hidden when printing PDF) */}
      <header className="sticky top-0 z-40 w-full bg-card border-b border-border px-4 h-12 flex items-center justify-between shadow-sm print:hidden">
        <div className="flex items-center gap-3">
          <BarChart3 className="h-4 w-4 text-muted-foreground" />
          <Separator orientation="vertical" className="h-4" />
          <span className="text-sm font-semibold text-foreground">Analytics Engine</span>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-muted/30 border border-border rounded px-2 h-8">
            <Store className="w-3.5 h-3.5 text-muted-foreground" />
            <Select value={selectedWarehouseId} onValueChange={setSelectedWarehouseId}>
              <SelectTrigger className="h-6 w-[140px] border-none bg-transparent shadow-none text-xs font-bold focus:ring-0 p-0">
                <SelectValue placeholder="All Nodes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Global (All Nodes)</SelectItem>
                {warehouses.map(w => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2 bg-muted/30 border border-border rounded px-2 h-8">
            <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
            <Input type="date" className="h-6 w-28 border-none bg-transparent shadow-none text-[10px] font-mono p-0 focus-visible:ring-0" value={startDate} onChange={e => setStartDate(e.target.value)} />
            <span className="text-muted-foreground text-xs px-1">-</span>
            <Input type="date" className="h-6 w-28 border-none bg-transparent shadow-none text-[10px] font-mono p-0 focus-visible:ring-0" value={endDate} onChange={e => setEndDate(e.target.value)} />
          </div>

          <Separator orientation="vertical" className="h-4 mx-1" />
          
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={fetchDashboardData} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button variant="outline" size="sm" className="h-8 text-xs font-bold border-border shadow-sm bg-background" onClick={handlePrint}>
            <Printer className="h-3.5 w-3.5 mr-2" /> PDF / Print
          </Button>
        </div>
      </header>

      {/* MAIN DASHBOARD CANVAS */}
      <main className="p-4 md:p-8 max-w-[1400px] w-full mx-auto space-y-6 bg-background print:p-0 print:m-0 print:w-full print:block">
        
        {/* PRINT ONLY HEADER */}
        <div className="hidden print:block mb-8 border-b-2 border-slate-900 pb-4">
           <h1 className="text-2xl font-black uppercase tracking-widest text-slate-900">Telemetry Report</h1>
           <p className="text-sm font-mono text-slate-500 mt-1">Period: {startDate} to {endDate} | Node: {selectedWarehouseId === 'all' ? 'Global' : warehouses.find(w=>w.id===selectedWarehouseId)?.name}</p>
        </div>

        {/* KPI STRIP */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 print:grid-cols-4">
          <Card className="shadow-none border-border/60 bg-card rounded-md print:border-slate-300">
            <CardContent className="p-4">
              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1 print:text-slate-600">Period Revenue</p>
              {loading ? <Skeleton className="h-8 w-32" /> : (
                <p className="text-2xl font-black text-foreground tracking-tight print:text-slate-900">₹{kpis.totalSales.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
              )}
            </CardContent>
          </Card>
          <Card className="shadow-none border-border/60 bg-card rounded-md print:border-slate-300">
            <CardContent className="p-4">
              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1 print:text-slate-600">Avg Daily Vol</p>
              {loading ? <Skeleton className="h-8 w-32" /> : (
                <p className="text-2xl font-black text-slate-700 tracking-tight print:text-slate-900">₹{kpis.avgDailySales.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
              )}
            </CardContent>
          </Card>
          <Card className="shadow-none border-amber-200/60 bg-amber-50/20 rounded-md print:border-slate-300 print:bg-transparent">
            <CardContent className="p-4">
              <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-1 print:text-slate-600">Transit Nodes</p>
              {loading ? <Skeleton className="h-8 w-16" /> : (
                <p className="text-2xl font-black text-amber-700 tracking-tight print:text-slate-900">{kpis.pendingTransfers} Open</p>
              )}
            </CardContent>
          </Card>
          <Card className="shadow-none border-blue-200/60 bg-blue-50/20 rounded-md print:border-slate-300 print:bg-transparent">
            <CardContent className="p-4">
              <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-1 print:text-slate-600">Factory WIP</p>
              {loading ? <Skeleton className="h-8 w-16" /> : (
                <p className="text-2xl font-black text-blue-700 tracking-tight print:text-slate-900">{kpis.activeJobBags} Bags</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* VISUALIZATIONS */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 print:grid-cols-3 print:gap-4 print:break-inside-avoid">
          
          {/* Sales Trend Line Chart */}
          <Card className="lg:col-span-2 shadow-none border-border/60 rounded-md overflow-hidden print:border-slate-300">
            <CardHeader className="bg-secondary/30 py-3 border-b border-border print:bg-slate-100">
              <h2 className="text-[11px] font-black uppercase tracking-widest text-muted-foreground print:text-slate-800">Revenue Trajectory</h2>
            </CardHeader>
            <CardContent className="p-6">
              {loading ? <Skeleton className="h-64 w-full" /> : salesTrend.length === 0 ? (
                <div className="h-64 flex items-center justify-center text-xs font-bold text-muted-foreground uppercase tracking-widest border border-dashed border-border/50 rounded">No Commerce Data</div>
              ) : (
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={salesTrend}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} dy={10} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} dx={-10} tickFormatter={(val) => `₹${val/1000}k`} />
                      <RechartsTooltip 
                        contentStyle={{ backgroundColor: '#0f172a', borderColor: '#0f172a', color: '#fff', borderRadius: '6px', fontSize: '12px' }}
                        itemStyle={{ color: '#10b981', fontWeight: 'bold' }}
                      />
                      <Line type="monotone" dataKey="amount" name="Revenue" stroke="#0f172a" strokeWidth={3} dot={{ r: 4, fill: '#0f172a', strokeWidth: 0 }} activeDot={{ r: 6, fill: '#10b981' }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Inventory Distribution Pie Chart */}
          <Card className="shadow-none border-border/60 rounded-md overflow-hidden print:border-slate-300">
            <CardHeader className="bg-secondary/30 py-3 border-b border-border print:bg-slate-100">
              <h2 className="text-[11px] font-black uppercase tracking-widest text-muted-foreground print:text-slate-800">
                {selectedWarehouseId === 'all' ? 'Asset Distribution (Nodes)' : 'Asset Breakdown (Metals)'}
              </h2>
            </CardHeader>
            <CardContent className="p-6">
              {loading ? <Skeleton className="h-64 w-full" /> : inventoryDist.length === 0 ? (
                <div className="h-64 flex items-center justify-center text-xs font-bold text-muted-foreground uppercase tracking-widest border border-dashed border-border/50 rounded">Vaults Empty</div>
              ) : (
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={inventoryDist}
                        cx="50%" cy="50%"
                        innerRadius={60} outerRadius={80}
                        paddingAngle={2}
                        dataKey="value"
                        stroke="none"
                      >
                        {inventoryDist.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <RechartsTooltip 
                        contentStyle={{ backgroundColor: '#fff', borderColor: '#e2e8f0', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  {/* Custom Legend */}
                  <div className="flex flex-wrap justify-center gap-3 mt-2">
                     {inventoryDist.map((entry, index) => (
                       <div key={entry.name} className="flex items-center gap-1.5">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                          <span className="text-[10px] font-bold text-slate-600 truncate max-w-[80px]" title={entry.name}>{entry.name}</span>
                       </div>
                     ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* REPORT GENERATION ENGINE (Hidden in PDF Print) */}
        <div className="pt-4 print:hidden">
          <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-4 flex items-center gap-2">
             <FileText className="h-4 w-4" /> Data Extraction Engine (.CSV)
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            
            <ReportActionCard 
              title="Stock Registry" 
              desc="Full line-by-line snapshot of all physical items in selected vaults." 
              icon={Package} 
              isLoading={exporting === 'inventory'}
              onClick={() => exportReport('inventory')} 
            />
            <ReportActionCard 
              title="Commerce Ledger" 
              desc="Daily invoices, modes of payment, and net revenue for period." 
              icon={TrendingUp} 
              isLoading={exporting === 'sales'}
              onClick={() => exportReport('sales')} 
            />
            <ReportActionCard 
              title="Logistics Trace" 
              desc="Inter-node stock transfers and routing dispatch statuses." 
              icon={ArrowRightLeft} 
              isLoading={exporting === 'transfers'}
              onClick={() => exportReport('transfers')} 
            />
            <ReportActionCard 
              title="Fabrication WIP" 
              desc="Active and historic artisan job bags and material issues." 
              icon={Briefcase} 
              isLoading={exporting === 'job_bags'}
              onClick={() => exportReport('job_bags')} 
            />

          </div>
        </div>

      </main>
    </div>
  )
}

// --- SUB-COMPONENT: REPORT ACTION CARD ---
function ReportActionCard({ title, desc, icon: Icon, isLoading, onClick }: any) {
  return (
    <div className="bg-card border border-border/60 rounded-md p-4 flex flex-col hover:border-slate-400 transition-colors shadow-sm group">
      <div className="flex items-center gap-2 mb-2">
        <div className="p-1.5 bg-secondary/50 rounded text-muted-foreground group-hover:text-foreground transition-colors"><Icon className="h-4 w-4" /></div>
        <h4 className="font-bold text-xs uppercase tracking-wider text-foreground">{title}</h4>
      </div>
      <p className="text-[10px] text-muted-foreground leading-relaxed flex-1 mb-4">{desc}</p>
      <Button 
        variant="secondary" 
        className="w-full h-8 text-[10px] font-bold uppercase tracking-widest bg-slate-100 hover:bg-slate-200 text-slate-700" 
        onClick={onClick}
        disabled={isLoading}
      >
        {isLoading ? <RefreshCw className="h-3 w-3 mr-2 animate-spin" /> : <Download className="h-3 w-3 mr-2" />}
        Extract CSV
      </Button>
    </div>
  )
}