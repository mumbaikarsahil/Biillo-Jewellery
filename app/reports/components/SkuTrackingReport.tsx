"use client"

import React, { useEffect, useState } from 'react'
import { format } from 'date-fns'
import * as XLSX from 'xlsx'
import { 
  Download, Loader2, RefreshCw, 
  PackageSearch, Clock, AlertCircle, CheckCircle2, Factory
} from 'lucide-react'

import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabaseClient'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import {
  Table, TableBody, TableCell, TableHead, 
  TableHeader, TableRow
} from '@/components/ui/table'

export function SkuTrackingReport() {
  const { appUser } = useAuth()
  
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  
  const [data, setData] = useState({
    items: [] as any[],
    stats: { total_in_pipeline: 0, total_received: 0, total_delayed: 0 }
  })

  const fetchData = async () => {
    if (!appUser?.company_id) return
    setLoading(true)
    try {
      const { data: rpcData, error } = await supabase.rpc('get_job_bag_item_tracking', {
        p_company_id: appUser.company_id
      })
      if (error) throw error
      if (rpcData) setData(rpcData)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [appUser])

  const filteredItems = data.items.filter(item => {
    if (statusFilter === 'all') return true;
    if (statusFilter === 'delayed') return item.is_delayed;
    return item.status === statusFilter;
  });

  const handleExport = () => {
    if (filteredItems.length === 0) return;
    setExporting(true);

    const exportData = filteredItems.map(i => ({
      'Job Bag No': i.job_bag_number,
      'SKU / Style': i.sku_reference,
      'Ornament Type': i.ornament_type,
      'Assigned Karigar': i.karigar_name,
      'Current Status': i.status.toUpperCase(),
      'Issue Date': i.issue_date ? format(new Date(i.issue_date), 'dd-MMM-yyyy') : 'N/A',
      'Target Delivery': i.expected_return_date ? format(new Date(i.expected_return_date), 'dd-MMM-yyyy') : 'N/A',
      'Overdue?': i.is_delayed ? 'YES' : 'NO',
      'Expected Gold (g)': i.expected_gold_g,
      'Expected Diamonds (ct)': i.expected_diamonds_cts,
      'Actual Final Gross (g)': i.actual_gross_g,
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "SKU_Pipeline");
    XLSX.writeFile(wb, `SKU_Production_Tracker_${format(new Date(), 'yyyyMMdd')}.xlsx`);
    setExporting(false);
  }

  const getStatusBadge = (status: string, isDelayed: boolean) => {
    if (isDelayed) return <Badge variant="destructive" className="text-[10px] uppercase font-bold tracking-widest bg-rose-500">Delayed</Badge>;
    switch (status) {
      case 'pending': return <Badge variant="outline" className="text-[10px] uppercase font-bold tracking-widest text-zinc-500 bg-zinc-50">Pending</Badge>;
      case 'issued': return <Badge variant="outline" className="text-[10px] uppercase font-bold tracking-widest text-blue-600 bg-blue-50 border-blue-200">Issued</Badge>;
      case 'in_progress': return <Badge variant="outline" className="text-[10px] uppercase font-bold tracking-widest text-amber-600 bg-amber-50 border-amber-200">In Progress</Badge>;
      case 'received': return <Badge variant="outline" className="text-[10px] uppercase font-bold tracking-widest text-emerald-600 bg-emerald-50 border-emerald-200">Received (Inv)</Badge>;
      case 'cancelled': return <Badge variant="outline" className="text-[10px] uppercase font-bold tracking-widest text-rose-600 bg-rose-50 border-rose-200">Cancelled</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  }

  return (
    <div className="space-y-5 animate-in fade-in duration-500 max-w-6xl mx-auto">
      
      {/* TOOLBAR */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white p-3 rounded-2xl border border-zinc-200 shadow-sm gap-4">
        <div>
          <h2 className="text-sm font-bold text-zinc-900 tracking-tight">SKU Production Pipeline</h2>
          <p className="text-[11px] text-zinc-500 font-medium">Track jewelry manufacturing from design commitment to physical inventory.</p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-2 sm:pb-0">
          <div className="flex bg-zinc-100 p-1 rounded-xl shrink-0">
            {['all', 'in_progress', 'received', 'delayed'].map(f => (
              <Button key={f} variant={statusFilter === f ? 'default' : 'ghost'} size="sm" 
                className={`h-8 px-3 text-[11px] font-bold rounded-lg transition-all capitalize ${statusFilter === f ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500'}`} 
                onClick={() => setStatusFilter(f)}>
                {f.replace('_', ' ')}
              </Button>
            ))}
          </div>

          <Button variant="outline" size="icon" className="h-10 w-10 shrink-0 rounded-xl border-zinc-200 text-zinc-600" onClick={fetchData}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button onClick={handleExport} disabled={exporting || loading} className="h-10 px-4 text-xs font-bold rounded-xl text-zinc-700 border border-zinc-200 bg-white shadow-sm shrink-0">
            {exporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
            Export Pipeline
          </Button>
        </div>
      </div>

      {/* HIGHLIGHT KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
        <Card className="shadow-sm border-zinc-200 bg-white rounded-2xl">
          <CardContent className="p-4 sm:p-5">
            <p className="text-[11px] font-bold text-zinc-500 uppercase tracking-widest mb-1 flex items-center gap-1.5"><Factory className="h-3.5 w-3.5" /> Active WIP Pipeline</p>
            {loading ? <Skeleton className="h-8 w-20 mt-1" /> : <p className="text-2xl sm:text-3xl font-semibold tracking-tighter text-zinc-900 mt-1 truncate">{data.stats.total_in_pipeline} <span className="text-sm text-zinc-400 font-medium tracking-normal">SKUs</span></p>}
          </CardContent>
        </Card>
        
        <Card className="shadow-sm border-emerald-200 bg-emerald-50/40 rounded-2xl">
          <CardContent className="p-4 sm:p-5">
            <p className="text-[11px] font-bold text-emerald-600 uppercase tracking-widest mb-1 flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5" /> Received & Inventoried</p>
            {loading ? <Skeleton className="h-8 w-20 mt-1" /> : <p className="text-2xl sm:text-3xl font-semibold tracking-tighter text-emerald-900 mt-1 truncate">{data.stats.total_received} <span className="text-sm text-emerald-600/70 font-medium tracking-normal">SKUs</span></p>}
          </CardContent>
        </Card>

        <Card className="shadow-sm border-rose-200 bg-rose-50/40 rounded-2xl">
          <CardContent className="p-4 sm:p-5">
            <p className="text-[11px] font-bold text-rose-600 uppercase tracking-widest mb-1 flex items-center gap-1.5"><AlertCircle className="h-3.5 w-3.5" /> Overdue for Delivery</p>
            {loading ? <Skeleton className="h-8 w-20 mt-1" /> : <p className="text-2xl sm:text-3xl font-semibold tracking-tighter text-rose-900 mt-1 truncate">{data.stats.total_delayed} <span className="text-sm text-rose-600/70 font-medium tracking-normal">SKUs</span></p>}
          </CardContent>
        </Card>
      </div>

      {/* SKU TRACKING TABLE */}
      <Card className="shadow-sm border-zinc-200 bg-white rounded-2xl overflow-hidden">
        <div className="p-4 bg-zinc-50/80 border-b border-zinc-200 flex items-center gap-2">
          <PackageSearch className="w-4 h-4 text-blue-600" />
          <h2 className="text-xs font-black uppercase tracking-widest text-zinc-800">Job Bag Line Items ({filteredItems.length})</h2>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-white">
              <TableRow className="hover:bg-transparent border-zinc-200">
                <TableHead className="h-11 text-[10px] font-bold text-zinc-500 uppercase tracking-widest px-4">SKU / Job Bag</TableHead>
                <TableHead className="h-11 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Assigned Karigar</TableHead>
                <TableHead className="h-11 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Expected Materials</TableHead>
                <TableHead className="h-11 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Timeline</TableHead>
                <TableHead className="h-11 text-[10px] font-bold text-zinc-500 uppercase tracking-widest text-right pr-4">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={5} className="h-32 text-center"><Loader2 className="h-6 w-6 animate-spin text-zinc-300 mx-auto" /></TableCell></TableRow>
              ) : filteredItems.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="h-32 text-center text-zinc-400 text-sm font-medium">No items match the current filter.</TableCell></TableRow>
              ) : (
                filteredItems.map((item) => (
                  <TableRow key={item.item_id} className={`transition-colors border-zinc-100 ${item.is_delayed ? 'bg-rose-50/30 hover:bg-rose-50/50' : 'hover:bg-zinc-50/80'}`}>
                    
                    {/* SKU Info */}
                    <TableCell className="px-4 py-3">
                      <div className="text-[13px] font-black tracking-tight text-zinc-800">{item.sku_reference}</div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] font-medium text-zinc-500">{item.ornament_type}</span>
                        <span className="text-[9px] font-mono text-zinc-400 border border-zinc-200 rounded px-1">{item.job_bag_number}</span>
                      </div>
                    </TableCell>

                    {/* Karigar */}
                    <TableCell className="text-[13px] font-semibold text-zinc-700">
                      {item.karigar_name}
                    </TableCell>

                    {/* Expected Materials */}
                    <TableCell>
                      <div className="flex flex-col gap-0.5">
                        {item.expected_gold_g > 0 && <span className="text-[11px] font-medium text-amber-600">Gold: {item.expected_gold_g}g</span>}
                        {item.expected_diamonds_cts > 0 && <span className="text-[11px] font-medium text-blue-600">Dia: {item.expected_diamonds_cts}ct</span>}
                        {item.status === 'received' && (
                          <span className="text-[11px] font-bold text-zinc-900 mt-1 border-t border-zinc-200 pt-1 w-max">
                            Final: {item.actual_gross_g}g
                          </span>
                        )}
                      </div>
                    </TableCell>

                    {/* Timelines */}
                    <TableCell>
                       <div className="flex flex-col gap-1">
                          <span className="text-[11px] text-zinc-500">Issued: {item.issue_date ? format(new Date(item.issue_date), 'dd MMM yyyy') : '--'}</span>
                          <span className={`text-[11px] font-bold flex items-center gap-1 ${item.is_delayed ? 'text-rose-600' : 'text-zinc-700'}`}>
                            <Clock className="w-3 h-3" /> Target: {item.expected_return_date ? format(new Date(item.expected_return_date), 'dd MMM') : '--'}
                          </span>
                       </div>
                    </TableCell>

                    {/* Status Badge */}
                    <TableCell className="text-right pr-4">
                      {getStatusBadge(item.status, item.is_delayed)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  )
}