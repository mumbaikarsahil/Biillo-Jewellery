"use client"

import React, { useEffect, useState, useMemo } from 'react'
import { format } from 'date-fns'
import * as XLSX from 'xlsx'
import { 
  Download, Loader2, Search, RefreshCw, 
  TrendingUp, Calendar, Store, CreditCard, Receipt,
  Sparkles, Trophy, User, Target, BarChart3, CheckCircle2
} from 'lucide-react'

import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabaseClient'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/hooks/use-toast'
import { Badge } from '@/components/ui/badge'
import {
  Select, SelectContent, SelectItem, 
  SelectTrigger, SelectValue 
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, 
  TableHeader, TableRow
} from '@/components/ui/table'

export function SalesVelocityReport() {
  const { appUser } = useAuth()
  const { toast } = useToast()
  
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [data, setData] = useState<any[]>([])
  const [warehouses, setWarehouses] = useState<any[]>([])
  
  const [showAnalytics, setShowAnalytics] = useState(false)

  // Filters
  const [search, setSearch] = useState('')
  const [filterWarehouse, setFilterWarehouse] = useState('all')
  const [filterPayment, setFilterPayment] = useState('all')
  
  const [startDate, setStartDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().split('T')[0];
  })
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0])

  const [metrics, setMetrics] = useState({
    totalRevenue: 0,
    invoiceCount: 0,
    avgOrderValue: 0,
    topPaymentMode: '--'
  })

  // Fetch Warehouses
  useEffect(() => {
    async function fetchWarehouses() {
      if (!appUser?.company_id) return
      const { data } = await supabase.from('warehouses').select('id, name').eq('company_id', appUser.company_id)
      if (data) setWarehouses(data)
    }
    fetchWarehouses()
  }, [appUser])

  const fetchData = async () => {
    if (!appUser?.company_id) return
    setLoading(true)

    try {
      const safeEndDate = new Date(endDate)
      safeEndDate.setDate(safeEndDate.getDate() + 1)
      const safeEndDateStr = safeEndDate.toISOString().split('T')[0]

      // Fetching user_id and joining the profiles table to get the actual staff name
      let q = supabase.from('invoices')
        .select(`
          id, invoice_number, created_at, final_total, payment_mode, warehouse_id, user_id,
          customers(full_name, phone),
          profiles(full_name) 
        `)
        .eq('company_id', appUser.company_id)
        .gte('created_at', startDate)
        .lt('created_at', safeEndDateStr)
        .order('created_at', { ascending: false })

      if (filterWarehouse !== 'all') q = q.eq('warehouse_id', filterWarehouse)
      if (filterPayment !== 'all') q = q.eq('payment_mode', filterPayment)
      if (search.trim()) q = q.ilike('invoice_number', `%${search.trim()}%`)

      const { data: resData, error } = await q
      if (error) throw error

      setData(resData || [])

      let totalRev = 0
      const paymentCounts: Record<string, number> = {}
      
      resData?.forEach(inv => {
        totalRev += (Number(inv.final_total) || 0)
        const mode = inv.payment_mode || 'Unknown'
        paymentCounts[mode] = (paymentCounts[mode] || 0) + 1
      })

      let topMode = '--'
      let maxCount = 0
      for (const [mode, count] of Object.entries(paymentCounts)) {
        if (count > maxCount) { maxCount = count; topMode = mode }
      }

      setMetrics({
        totalRevenue: totalRev,
        invoiceCount: resData?.length || 0,
        avgOrderValue: resData?.length ? totalRev / resData.length : 0,
        topPaymentMode: topMode.toUpperCase()
      })

    } catch (err: any) {
      toast({ title: "Fetch Failed", description: err.message, variant: "destructive" })
      console.error("Sales Report Fetch Error:", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const delay = setTimeout(() => { fetchData() }, 300)
    return () => clearTimeout(delay)
  }, [appUser, filterWarehouse, filterPayment, startDate, endDate, search])

  // --- AI HELPER: SALES MATRIX ANALYTICS ---
  const analytics = useMemo(() => {
    if (!showAnalytics || data.length === 0) return null;

    const branchStats: Record<string, { name: string, revenue: number, count: number }> = {};
    const staffStats: Record<string, { name: string, revenue: number, count: number }> = {};

    data.forEach(inv => {
      // Resolve Warehouse Name
      const wName = warehouses.find(w => w.id === inv.warehouse_id)?.name || 'Unknown Branch';
      
      // Resolve Staff Name safely from the profiles join
      const staffName = inv.profiles?.full_name || (inv.user_id ? `Staff (${inv.user_id.substring(0, 5).toUpperCase()})` : 'System / Admin');
      
      const rev = Number(inv.final_total) || 0;

      // Aggregate Branch
      if (!branchStats[wName]) branchStats[wName] = { name: wName, revenue: 0, count: 0 };
      branchStats[wName].revenue += rev;
      branchStats[wName].count += 1;

      // Aggregate Staff
      if (!staffStats[staffName]) staffStats[staffName] = { name: staffName, revenue: 0, count: 0 };
      staffStats[staffName].revenue += rev;
      staffStats[staffName].count += 1;
    });

    const branchLeaderboard = Object.values(branchStats).sort((a, b) => b.revenue - a.revenue);
    const staffLeaderboard = Object.values(staffStats).sort((a, b) => b.revenue - a.revenue);

    // Find highest absolute revenue
    const maxBranchRev = branchLeaderboard[0]?.revenue || 1;
    const maxStaffRev = staffLeaderboard[0]?.revenue || 1;

    // Find highest Average Order Value (AOV) for branch
    const topAovBranch = [...branchLeaderboard].sort((a, b) => (b.revenue / b.count) - (a.revenue / a.count))[0];

    return {
      topBranch: branchLeaderboard[0],
      topStaff: staffLeaderboard[0],
      topAovBranch,
      branchLeaderboard,
      staffLeaderboard,
      maxBranchRev,
      maxStaffRev
    };
  }, [data, showAnalytics, warehouses]);


  const handleExport = () => {
    if (data.length === 0) {
      toast({ title: "Empty Data", description: "No records to export.", variant: "destructive" })
      return
    }
    setExporting(true)

    const formattedData = data.map((d) => {
      const wName = warehouses.find(w => w.id === d.warehouse_id)?.name || '--'
      const staffName = d.profiles?.full_name || d.user_id || 'System'

      return {
        'Invoice No': d.invoice_number,
        'Date & Time': format(new Date(d.created_at), 'dd-MMM-yyyy HH:mm'),
        'Customer Name': d.customers?.full_name || 'Walk-in Customer',
        'Customer Phone': d.customers?.phone || '--',
        'Location': wName,
        'Billed By': staffName,
        'Payment Mode': (d.payment_mode || 'CASH').toUpperCase(),
        'Invoice Total (₹)': d.final_total
      }
    })

    const worksheet = XLSX.utils.json_to_sheet(formattedData)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, "Sales_Ledger")

    XLSX.writeFile(workbook, `Sales_Velocity_Report_${startDate}_to_${endDate}.xlsx`)
    
    setExporting(false)
    toast({ title: "Export Complete", description: "Sales Ledger downloaded securely." })
  }

  return (
    <div className="space-y-4 animate-in fade-in duration-500">
      
      {/* NATIVE APP STYLE FILTERS */}
      <div className="flex flex-col gap-2 bg-white p-3 rounded-xl border border-gray-200 shadow-sm">
        
        {/* Top Row: Search & Location */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
            <Input placeholder="Search invoice..." className="pl-8 h-9 text-xs bg-gray-50 border-gray-200 rounded-lg focus-visible:ring-gray-300" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          
          <Button 
            variant={showAnalytics ? "default" : "outline"} 
            className={`h-9 px-4 text-xs font-bold rounded-lg hidden sm:flex transition-all ${showAnalytics ? 'bg-indigo-600 text-white hover:bg-indigo-700 border-indigo-600 shadow-md shadow-indigo-200' : 'border-indigo-200 text-indigo-600 bg-indigo-50/50 hover:bg-indigo-100'}`}
            onClick={() => setShowAnalytics(!showAnalytics)}
          >
            <Sparkles className={`h-3.5 w-3.5 mr-1.5 ${showAnalytics ? 'text-white' : 'text-indigo-500'}`} /> 
            Matrix Analytics
            <span className={`ml-2 px-1.5 py-0.5 rounded text-[8px] uppercase tracking-widest font-black transition-colors ${showAnalytics ? 'bg-white/20 text-white' : 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-sm'}`}>
              BETA
            </span>
          </Button>

          <Select value={filterWarehouse} onValueChange={setFilterWarehouse}>
            <SelectTrigger className="w-[110px] sm:w-[140px] h-9 text-xs font-bold bg-gray-50 border-gray-200 rounded-lg shrink-0">
              <Store className="w-3.5 h-3.5 mr-1.5 text-gray-500 hidden sm:block" />
              <SelectValue placeholder="Location" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Locations</SelectItem>
              {warehouses.map(w => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* Bottom Row: Dates, Payment & Actions */}
        <div className="flex items-center gap-2">
          <div className="flex flex-1 items-center bg-gray-50 border border-gray-200 rounded-lg px-2 h-9 focus-within:ring-1 focus-within:ring-gray-300 min-w-0">
            <Calendar className="w-3.5 h-3.5 text-gray-400 shrink-0 mr-1.5 hidden sm:block" />
            <input type="date" className="bg-transparent text-[10px] sm:text-[11px] font-mono font-bold outline-none flex-1 min-w-0" value={startDate} onChange={e => setStartDate(e.target.value)} />
            <span className="text-gray-300 text-[9px] uppercase font-bold mx-1 shrink-0">to</span>
            <input type="date" className="bg-transparent text-[10px] sm:text-[11px] font-mono font-bold outline-none flex-1 min-w-0 text-right" value={endDate} onChange={e => setEndDate(e.target.value)} />
          </div>
          
          <Select value={filterPayment} onValueChange={setFilterPayment}>
            <SelectTrigger className="w-[90px] sm:w-[130px] h-9 text-xs font-bold bg-gray-50 border-gray-200 rounded-lg shrink-0">
              <SelectValue placeholder="Mode" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Modes</SelectItem>
              <SelectItem value="cash">Cash</SelectItem>
              <SelectItem value="card">Card</SelectItem>
              <SelectItem value="upi">UPI / Bank</SelectItem>
            </SelectContent>
          </Select>

          <Button variant="outline" size="icon" className="h-9 w-9 rounded-lg border-gray-200 shrink-0" onClick={fetchData}>
            <RefreshCw className={`h-3.5 w-3.5 text-gray-600 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          
          <Button onClick={handleExport} disabled={exporting || loading} variant="outline" size="icon" className="h-9 w-9 rounded-lg border-gray-200 shrink-0 sm:hidden">
            {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5 text-gray-600" />}
          </Button>
          
          <Button onClick={handleExport} disabled={exporting || loading} className="h-9 text-xs font-bold rounded-lg hidden sm:flex shrink-0">
            {exporting ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Download className="mr-2 h-3.5 w-3.5" />}
            Export CSV
          </Button>
        </div>
      </div>

      {/* SMART MATRIX ANALYTICS PANEL */}
      {showAnalytics && analytics && (
        <div className="flex flex-col gap-4 animate-in slide-in-from-top-4 duration-300">
          
          {/* WINNERS (TOP TIER) */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Card className="bg-emerald-50 border-emerald-100 shadow-sm rounded-xl">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="h-12 w-12 bg-emerald-100 rounded-full flex items-center justify-center shrink-0 border border-emerald-200 shadow-sm">
                   <Store className="w-6 h-6 text-emerald-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">Top Branch</p>
                  <p className="text-lg font-black text-emerald-900 leading-tight mt-0.5 truncate">{analytics.topBranch?.name || 'N/A'}</p>
                  <p className="text-[10px] font-medium text-emerald-700 mt-1">₹{analytics.topBranch?.revenue.toLocaleString() || '0'} from {analytics.topBranch?.count || 0} invoices</p>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-indigo-50 border-indigo-100 shadow-sm rounded-xl">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="h-12 w-12 bg-indigo-100 rounded-full flex items-center justify-center shrink-0 border border-indigo-200 shadow-sm">
                   <User className="w-6 h-6 text-indigo-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest">Top Rainmaker</p>
                  <p className="text-lg font-black text-indigo-900 leading-tight mt-0.5 truncate">{analytics.topStaff?.name || 'N/A'}</p>
                  <p className="text-[10px] font-medium text-indigo-700 mt-1">₹{analytics.topStaff?.revenue.toLocaleString() || '0'} billed</p>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-blue-50 border-blue-100 shadow-sm rounded-xl hidden lg:block">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center shrink-0 border border-blue-200 shadow-sm">
                   <Target className="w-6 h-6 text-blue-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">Highest AOV Branch</p>
                  <p className="text-lg font-black text-blue-900 leading-tight mt-0.5 truncate">{analytics.topAovBranch?.name || 'N/A'}</p>
                  <p className="text-[10px] font-medium text-blue-700 mt-1">Avg Ticket: ₹{Math.round(analytics.topAovBranch?.revenue / analytics.topAovBranch?.count || 0).toLocaleString()}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* LEADERBOARDS (LOWER TIER) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Branch Leaderboard */}
            <Card className="bg-white border-zinc-200 shadow-sm rounded-2xl overflow-hidden">
              <CardHeader className="p-4 pb-2 border-b border-zinc-100 bg-zinc-50/50">
                <CardTitle className="text-xs font-black uppercase tracking-widest text-zinc-600 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-zinc-400" /> Branch Leaderboard
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {analytics.branchLeaderboard.length === 0 ? (
                  <div className="text-center py-6 text-zinc-400 text-xs font-medium">No sales data available.</div>
                ) : (
                  <div className="divide-y divide-zinc-100 max-h-[220px] overflow-y-auto custom-scrollbar">
                    {analytics.branchLeaderboard.map((b, i) => (
                      <div key={i} className="p-3 hover:bg-zinc-50 transition-colors">
                        <div className="flex justify-between items-end mb-1.5">
                          <span className="text-xs font-bold text-zinc-800">{b.name}</span>
                          <span className="text-xs font-black text-emerald-600">₹{b.revenue.toLocaleString()}</span>
                        </div>
                        <div className="w-full bg-zinc-100 h-1.5 rounded-full overflow-hidden">
                          <div 
                            className="bg-emerald-500 h-full rounded-full transition-all" 
                            style={{ width: `${(b.revenue / analytics.maxBranchRev) * 100}%` }}
                          />
                        </div>
                        <p className="text-[9px] font-medium text-zinc-400 mt-1.5 text-right">{b.count} invoices</p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Staff Leaderboard */}
            <Card className="bg-white border-zinc-200 shadow-sm rounded-2xl overflow-hidden">
              <CardHeader className="p-4 pb-2 border-b border-zinc-100 bg-zinc-50/50">
                <CardTitle className="text-xs font-black uppercase tracking-widest text-zinc-600 flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-zinc-400" /> Rainmaker Leaderboard
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {analytics.staffLeaderboard.length === 0 ? (
                  <div className="text-center py-6 text-zinc-400 text-xs font-medium">No billing data available.</div>
                ) : (
                  <div className="divide-y divide-zinc-100 max-h-[220px] overflow-y-auto custom-scrollbar">
                    {analytics.staffLeaderboard.map((s, i) => (
                      <div key={i} className="p-3 hover:bg-zinc-50 transition-colors">
                        <div className="flex justify-between items-end mb-1.5">
                          <span className="text-xs font-bold text-zinc-800">{s.name}</span>
                          <span className="text-xs font-black text-indigo-600">₹{s.revenue.toLocaleString()}</span>
                        </div>
                        <div className="w-full bg-zinc-100 h-1.5 rounded-full overflow-hidden">
                          <div 
                            className="bg-indigo-500 h-full rounded-full transition-all" 
                            style={{ width: `${(s.revenue / analytics.maxStaffRev) * 100}%` }}
                          />
                        </div>
                        <p className="text-[9px] font-medium text-zinc-400 mt-1.5 text-right">{s.count} transactions</p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

          </div>
        </div>
      )}

      {/* COMPACT KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4">
        <Card className="shadow-none border-gray-200 bg-white rounded-xl">
          <CardContent className="p-3 sm:p-4">
            <p className="text-[9px] sm:text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1 flex items-center gap-1">
              <TrendingUp className="h-3 w-3 text-emerald-500 shrink-0" /> <span className="truncate">Gross Revenue</span>
            </p>
            {loading ? <Skeleton className="h-6 w-20" /> : <p className="text-lg sm:text-xl font-black text-gray-900 truncate">₹{metrics.totalRevenue.toLocaleString()}</p>}
          </CardContent>
        </Card>
        
        <Card className="shadow-none border-gray-200 bg-white rounded-xl">
          <CardContent className="p-3 sm:p-4">
            <p className="text-[9px] sm:text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1 flex items-center gap-1">
              <Receipt className="h-3 w-3 text-blue-500 shrink-0" /> <span className="truncate">Invoices</span>
            </p>
            {loading ? <Skeleton className="h-6 w-12" /> : <p className="text-lg sm:text-xl font-black text-gray-900 truncate">{metrics.invoiceCount}</p>}
          </CardContent>
        </Card>

        <Card className="shadow-none border-gray-200 bg-white rounded-xl">
          <CardContent className="p-3 sm:p-4">
            <p className="text-[9px] sm:text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1 flex items-center gap-1">
              <TrendingUp className="h-3 w-3 text-amber-500 shrink-0" /> <span className="truncate">Avg Order</span>
            </p>
            {loading ? <Skeleton className="h-6 w-16" /> : <p className="text-lg sm:text-xl font-black text-gray-900 truncate">₹{metrics.avgOrderValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>}
          </CardContent>
        </Card>

        <Card className="shadow-none border-emerald-200 bg-emerald-50/50 rounded-xl">
          <CardContent className="p-3 sm:p-4">
            <p className="text-[9px] sm:text-[10px] font-bold text-emerald-600 uppercase tracking-widest mb-1 flex items-center gap-1">
              <CreditCard className="h-3 w-3 shrink-0" /> <span className="truncate">Top Mode</span>
            </p>
            {loading ? <Skeleton className="h-6 w-16" /> : <p className="text-lg sm:text-xl font-black text-emerald-800 truncate">{metrics.topPaymentMode}</p>}
          </CardContent>
        </Card>
      </div>

      {/* DATA TABLE */}
      <Card className="shadow-sm border-border bg-white rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-gray-50/50">
              <TableRow className="hover:bg-transparent border-gray-200">
                <TableHead className="h-10 text-[11px] font-bold uppercase tracking-widest text-gray-500 px-4">Invoice</TableHead>
                <TableHead className="h-10 text-[11px] font-bold uppercase tracking-widest text-gray-500">Customer</TableHead>
                <TableHead className="h-10 text-[11px] font-bold uppercase tracking-widest text-gray-500 hidden md:table-cell">Billed By</TableHead>
                <TableHead className="h-10 text-[11px] font-bold uppercase tracking-widest text-gray-500 hidden sm:table-cell">Location</TableHead>
                <TableHead className="h-10 text-[11px] font-bold uppercase tracking-widest text-gray-500 text-center">Mode</TableHead>
                <TableHead className="h-10 text-[11px] font-bold uppercase tracking-widest text-gray-500 text-right pr-4 sm:pr-6">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i} className="border-gray-100">
                    <TableCell className="px-4 py-3"><Skeleton className="h-4 w-20" /><Skeleton className="h-3 w-24 mt-1.5" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell className="hidden md:table-cell"><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell className="hidden sm:table-cell"><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell className="text-center"><Skeleton className="h-5 w-12 mx-auto rounded-full" /></TableCell>
                    <TableCell className="pr-4 sm:pr-6"><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center text-gray-400">
                    <Receipt className="h-6 w-6 mx-auto mb-2 opacity-30" />
                    <p className="text-xs font-bold uppercase tracking-widest">No sales records</p>
                  </TableCell>
                </TableRow>
              ) : (
                data.map((inv) => {
                  const wName = warehouses.find(w => w.id === inv.warehouse_id)?.name || '--'
                  const staffName = inv.profiles?.full_name || (inv.user_id ? `Staff (${inv.user_id.substring(0, 5).toUpperCase()})` : 'System / Admin')

                  return (
                    <TableRow key={inv.id} className="hover:bg-gray-50/50 transition-colors border-gray-100">
                      <TableCell className="px-4 py-2.5 sm:py-3">
                        <div className="font-mono text-[13px] font-black text-gray-900">{inv.invoice_number}</div>
                        <div className="text-[10px] text-gray-400 font-bold tracking-tighter">{format(new Date(inv.created_at), 'dd MMM yy, HH:mm')}</div>
                      </TableCell>
                      <TableCell>
                        <div className="text-xs font-bold text-gray-700">{inv.customers?.full_name || 'Walk-in'}</div>
                        <div className="text-[10px] text-gray-400 font-medium">{inv.customers?.phone || '--'}</div>
                      </TableCell>
                      <TableCell className="text-xs text-gray-500 font-semibold hidden md:table-cell">
                        <div className="flex items-center gap-1.5">
                           <User className="w-3 h-3 text-gray-400" />
                           {staffName}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-gray-500 font-medium hidden sm:table-cell">
                        {wName}
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="px-2 py-0.5 rounded text-[9px] font-black bg-gray-100 text-gray-600 uppercase tracking-widest">
                          {inv.payment_mode || 'Cash'}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-black text-emerald-600 pr-4 sm:pr-6 text-[13px] sm:text-sm">
                        ₹{inv.final_total?.toLocaleString() || '0'}
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  )
}