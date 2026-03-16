"use client"

import React, { useEffect, useState } from 'react'
import { format } from 'date-fns'
import * as XLSX from 'xlsx'
import { 
  Download, Loader2, RefreshCw, Calendar, 
  ArrowDownToLine, ArrowUpFromLine, AlertTriangle 
} from 'lucide-react'

import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabaseClient'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/hooks/use-toast'
import {
  Table, TableBody, TableCell, TableHead, 
  TableHeader, TableRow
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

interface AgingRecord {
  party_id: string;
  party_name: string;
  total_due: number;
  days_0_30: number;
  days_31_60: number;
  days_61_90: number;
  days_90_plus: number;
}

export function AgingDashboard() {
  const { appUser } = useAuth()
  const { toast } = useToast()
  
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [activeTab, setActiveTab] = useState<'AR' | 'AP'>('AR')
  
  const [asOfDate, setAsOfDate] = useState(() => format(new Date(), 'yyyy-MM-dd'))
  const [records, setRecords] = useState<AgingRecord[]>([])

  const fetchAging = async () => {
    if (!appUser?.company_id) return
    setLoading(true)

    try {
      const rpcName = activeTab === 'AR' ? 'get_ar_aging' : 'get_ap_aging';
      const { data, error } = await supabase.rpc(rpcName, {
        p_company_id: appUser.company_id,
        p_as_of_date: asOfDate
      })

      if (error) throw error
      setRecords(data || [])
    } catch (err: any) {
      toast({ title: "Fetch Failed", description: err.message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchAging() }, [appUser, asOfDate, activeTab])

  const formatCurrency = (val: number) => {
    if (!val || val === 0) return '--';
    return `₹${val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  const totals = records.reduce((acc, curr) => ({
    total_due: acc.total_due + Number(curr.total_due),
    days_0_30: acc.days_0_30 + Number(curr.days_0_30),
    days_31_60: acc.days_31_60 + Number(curr.days_31_60),
    days_61_90: acc.days_61_90 + Number(curr.days_61_90),
    days_90_plus: acc.days_90_plus + Number(curr.days_90_plus)
  }), { total_due: 0, days_0_30: 0, days_31_60: 0, days_61_90: 0, days_90_plus: 0 })

  const handleExport = () => {
    if (records.length === 0) return;
    setExporting(true);

    const formattedData = records.map(r => ({
      'Party Name': r.party_name,
      '0 - 30 Days': r.days_0_30,
      '31 - 60 Days': r.days_31_60,
      '61 - 90 Days': r.days_61_90,
      '90+ Days': r.days_90_plus,
      'Total Outstanding (₹)': r.total_due
    }));

    const worksheet = XLSX.utils.json_to_sheet(formattedData);
    const workbook = XLSX.utils.book_new();
    const typeName = activeTab === 'AR' ? 'Receivables' : 'Payables';
    XLSX.utils.book_append_sheet(workbook, worksheet, "Aging");
    XLSX.writeFile(workbook, `${typeName}_Aging_${format(new Date(asOfDate), 'yyyyMMdd')}.xlsx`);
    
    setExporting(false);
  }

  return (
    <div className="space-y-5 animate-in fade-in duration-500 max-w-6xl mx-auto">
      
      {/* TOOLBAR */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-3 rounded-2xl border border-zinc-200 shadow-sm print:hidden">
        
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'AR' | 'AP')} className="w-full sm:w-auto">
          <TabsList className="bg-zinc-100 rounded-full p-1 h-10 w-full sm:w-auto">
            <TabsTrigger value="AR" className="rounded-full px-6 text-xs font-bold data-[state=active]:bg-white data-[state=active]:text-emerald-700 data-[state=active]:shadow-sm">
              <ArrowDownToLine className="w-3.5 h-3.5 mr-2" /> Receivables
            </TabsTrigger>
            <TabsTrigger value="AP" className="rounded-full px-6 text-xs font-bold data-[state=active]:bg-white data-[state=active]:text-rose-700 data-[state=active]:shadow-sm">
              <ArrowUpFromLine className="w-3.5 h-3.5 mr-2" /> Payables
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="flex items-center bg-zinc-50 border border-zinc-200 rounded-full px-3 h-10 focus-within:border-zinc-400 min-w-0">
            <Calendar className="w-3.5 h-3.5 text-zinc-400 shrink-0 mr-2" />
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mr-2">As Of:</span>
            <input type="date" className="bg-transparent text-[12px] font-mono font-bold outline-none text-zinc-800" value={asOfDate} onChange={e => setAsOfDate(e.target.value)} />
          </div>
          <Button variant="outline" size="icon" className="h-10 w-10 rounded-full border-zinc-200 text-zinc-600" onClick={fetchAging}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button onClick={handleExport} disabled={exporting || loading} className="h-10 text-xs font-medium rounded-full text-zinc-700 border border-zinc-200 bg-white shadow-sm flex-1 sm:flex-none">
            {exporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="sm:mr-2 h-4 w-4" />}
            <span className="hidden sm:inline-block">Export</span>
          </Button>
        </div>
      </div>

      {/* HIGHLIGHT KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <Card className={`shadow-sm rounded-2xl border ${activeTab === 'AR' ? 'bg-emerald-50/50 border-emerald-200' : 'bg-rose-50/50 border-rose-200'} col-span-2 md:col-span-1`}>
          <CardContent className="p-4 sm:p-5">
            <p className={`text-[11px] font-bold uppercase tracking-widest mb-1 ${activeTab === 'AR' ? 'text-emerald-700' : 'text-rose-700'}`}>
              Total {activeTab === 'AR' ? 'Receivable' : 'Payable'}
            </p>
            {loading ? <Skeleton className="h-8 w-24 mt-1" /> : <p className={`text-2xl sm:text-3xl font-black tracking-tighter mt-1 truncate ${activeTab === 'AR' ? 'text-emerald-900' : 'text-rose-900'}`}>₹{totals.total_due.toLocaleString(undefined, {maximumFractionDigits:0})}</p>}
          </CardContent>
        </Card>

        <Card className="shadow-sm border-zinc-200 bg-white rounded-2xl">
          <CardContent className="p-4 sm:p-5">
            <p className="text-[11px] font-medium text-zinc-500 mb-1">Healthy (0-30 Days)</p>
            {loading ? <Skeleton className="h-8 w-24 mt-1" /> : <p className="text-xl font-semibold tracking-tighter text-zinc-900 mt-1 truncate">₹{totals.days_0_30.toLocaleString(undefined, {maximumFractionDigits:0})}</p>}
          </CardContent>
        </Card>

        <Card className="shadow-sm border-zinc-200 bg-white rounded-2xl">
          <CardContent className="p-4 sm:p-5">
            <p className="text-[11px] font-medium text-amber-600 mb-1">Overdue (31-60 Days)</p>
            {loading ? <Skeleton className="h-8 w-24 mt-1" /> : <p className="text-xl font-semibold tracking-tighter text-amber-900 mt-1 truncate">₹{totals.days_31_60.toLocaleString(undefined, {maximumFractionDigits:0})}</p>}
          </CardContent>
        </Card>

        <Card className="shadow-sm border-red-200 bg-red-50/30 rounded-2xl">
          <CardContent className="p-4 sm:p-5">
            <p className="text-[11px] font-medium text-red-600 mb-1 flex items-center gap-1.5"><AlertTriangle className="h-3 w-3" /> Critical (90+ Days)</p>
            {loading ? <Skeleton className="h-8 w-24 mt-1" /> : <p className="text-xl font-semibold tracking-tighter text-red-900 mt-1 truncate">₹{totals.days_90_plus.toLocaleString(undefined, {maximumFractionDigits:0})}</p>}
          </CardContent>
        </Card>
      </div>

      {/* THE AGING TABLE */}
      <Card className="shadow-sm border-zinc-200 bg-white rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-zinc-50/80">
              <TableRow className="hover:bg-transparent border-zinc-200">
                <TableHead className="h-12 text-[11px] font-bold text-zinc-500 uppercase tracking-widest px-4">{activeTab === 'AR' ? 'Customer' : 'Supplier'}</TableHead>
                <TableHead className="h-12 text-[10px] font-bold text-zinc-500 uppercase tracking-widest text-right">0-30 Days</TableHead>
                <TableHead className="h-12 text-[10px] font-bold text-zinc-500 uppercase tracking-widest text-right">31-60 Days</TableHead>
                <TableHead className="h-12 text-[10px] font-bold text-zinc-500 uppercase tracking-widest text-right">61-90 Days</TableHead>
                <TableHead className="h-12 text-[10px] font-bold text-red-500 uppercase tracking-widest text-right bg-red-50/30 border-x border-red-100/50">90+ Days</TableHead>
                <TableHead className="h-12 text-[11px] font-black text-zinc-800 uppercase tracking-widest text-right pr-6">Total Due</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={6} className="h-32 text-center"><Loader2 className="h-6 w-6 animate-spin text-zinc-300 mx-auto" /></TableCell></TableRow>
              ) : records.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="h-32 text-center text-zinc-400 text-sm font-medium">No outstanding balances found.</TableCell></TableRow>
              ) : (
                <>
                  {records.map((r) => (
                    <TableRow key={r.party_id} className="hover:bg-zinc-50/80 transition-colors border-zinc-100 group cursor-pointer">
                      <TableCell className="px-4 py-3 text-[13px] font-bold text-zinc-800 group-hover:text-blue-600 transition-colors">
                        {r.party_name}
                      </TableCell>
                      <TableCell className="text-right text-[13px] font-medium text-zinc-600 bg-zinc-50/30">{formatCurrency(r.days_0_30)}</TableCell>
                      <TableCell className="text-right text-[13px] font-medium text-amber-700/80">{formatCurrency(r.days_31_60)}</TableCell>
                      <TableCell className="text-right text-[13px] font-medium text-orange-700/80 bg-zinc-50/30">{formatCurrency(r.days_61_90)}</TableCell>
                      <TableCell className="text-right text-[13px] font-bold text-red-600 bg-red-50/20 border-x border-red-100/50">{formatCurrency(r.days_90_plus)}</TableCell>
                      <TableCell className="text-right text-[14px] font-black text-zinc-900 pr-6">{formatCurrency(r.total_due)}</TableCell>
                    </TableRow>
                  ))}
                  
                  {/* TOTALS FOOTER */}
                  <TableRow className="bg-zinc-100 hover:bg-zinc-100 border-t-2 border-zinc-300">
                    <TableCell className="px-4 py-4 text-[12px] font-black text-zinc-800 uppercase tracking-widest text-right">
                      Grand Total
                    </TableCell>
                    <TableCell className="text-right text-[13px] font-bold text-zinc-900">{formatCurrency(totals.days_0_30)}</TableCell>
                    <TableCell className="text-right text-[13px] font-bold text-amber-700">{formatCurrency(totals.days_31_60)}</TableCell>
                    <TableCell className="text-right text-[13px] font-bold text-orange-700">{formatCurrency(totals.days_61_90)}</TableCell>
                    <TableCell className="text-right text-[13px] font-bold text-red-600 border-x border-red-200/50">{formatCurrency(totals.days_90_plus)}</TableCell>
                    <TableCell className="text-right text-[15px] font-black text-zinc-900 pr-6">{formatCurrency(totals.total_due)}</TableCell>
                  </TableRow>
                </>
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  )
}