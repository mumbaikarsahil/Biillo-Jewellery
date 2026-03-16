"use client"

import React, { useEffect, useState } from 'react'
import { format } from 'date-fns'
import * as XLSX from 'xlsx'
import { 
  Download, Filter, Loader2, Search, 
  RefreshCw, Briefcase, Hammer, Clock, CheckCircle2,
  FileText
} from 'lucide-react'

import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabaseClient'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/hooks/use-toast'
import {
  Select, SelectContent, SelectItem, 
  SelectTrigger, SelectValue 
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, 
  TableHeader, TableRow
} from '@/components/ui/table'

export function FactoryWipReport() {
  const { appUser } = useAuth()
  const { toast } = useToast()
  
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [data, setData] = useState<any[]>([])
  const [karigars, setKarigars] = useState<any[]>([])
  
  // Mobile UI Toggle
  const [showFilters, setShowFilters] = useState(false)

  // Filters
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterKarigar, setFilterKarigar] = useState('all')
  
  const [startDate, setStartDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().split('T')[0];
  })
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0])

  const [metrics, setMetrics] = useState({
    activeBags: 0,
    totalGoldPending: 0,
    totalDiamondPending: 0,
    completedRecently: 0
  })

  // Fetch Karigars for the dropdown
  useEffect(() => {
    async function fetchKarigars() {
      if (!appUser?.company_id) return
      const { data } = await supabase.from('karigars')
        .select('id, full_name, karigar_code')
        .eq('company_id', appUser.company_id)
        .eq('is_active', true)
      if (data) setKarigars(data)
    }
    fetchKarigars()
  }, [appUser])

  const fetchData = async () => {
    if (!appUser?.company_id) return
    setLoading(true)

    try {
      const safeEndDate = new Date(endDate)
      safeEndDate.setDate(safeEndDate.getDate() + 1)
      const safeEndDateStr = safeEndDate.toISOString().split('T')[0]

      let q = supabase.from('job_bags')
        .select(`
          id, job_bag_number, product_category, status, issue_date, expected_return_date,
          gold_expected_weight_g, diamond_expected_weight_cts,
          karigars(full_name)
        `)
        .eq('company_id', appUser.company_id)
        .gte('created_at', startDate)
        .lt('created_at', safeEndDateStr)
        .order('created_at', { ascending: false })

      if (filterStatus !== 'all') q = q.eq('status', filterStatus)
      if (filterKarigar !== 'all') q = q.eq('karigar_id', filterKarigar)
      if (search.trim()) q = q.ilike('job_bag_number', `%${search.trim()}%`)

      const { data: resData, error } = await q
      if (error) throw error

      setData(resData || [])

      // Calculate Metrics
      let active = 0
      let goldPending = 0
      let diamondPending = 0
      let completed = 0

      resData?.forEach(job => {
        if (job.status === 'completed' || job.status === 'closed') {
          completed++
        } else {
          active++
          goldPending += (Number(job.gold_expected_weight_g) || 0)
          diamondPending += (Number(job.diamond_expected_weight_cts) || 0)
        }
      })

      setMetrics({
        activeBags: active,
        totalGoldPending: goldPending,
        totalDiamondPending: diamondPending,
        completedRecently: completed
      })

    } catch (err: any) {
      toast({ title: "Fetch Failed", description: err.message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const delay = setTimeout(() => { fetchData() }, 300)
    return () => clearTimeout(delay)
  }, [appUser, filterStatus, filterKarigar, startDate, endDate, search])

  const handleExport = () => {
    if (data.length === 0) {
      toast({ title: "Empty Data", description: "No records to export.", variant: "destructive" })
      return
    }
    setExporting(true)

    const formattedData = data.map((d) => ({
      'Bag No': d.job_bag_number,
      'Category': d.product_category || '--',
      'Artisan (Karigar)': d.karigars?.full_name || '--',
      'Expected Gold (g)': d.gold_expected_weight_g || 0,
      'Expected Diamonds (cts)': d.diamond_expected_weight_cts || 0,
      'Status': d.status.replace('_', ' ').toUpperCase(),
      'Issue Date': d.issue_date ? format(new Date(d.issue_date), 'dd-MMM-yyyy') : '--',
      'Target Return': d.expected_return_date ? format(new Date(d.expected_return_date), 'dd-MMM-yyyy') : '--'
    }))

    const worksheet = XLSX.utils.json_to_sheet(formattedData)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, "WIP_Ledger")

    XLSX.writeFile(workbook, `Factory_WIP_${startDate}_to_${endDate}.xlsx`)
    
    setExporting(false)
    toast({ title: "Export Complete", description: "WIP ledger downloaded." })
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed': return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-200 uppercase tracking-widest">Completed</span>
      case 'in_progress': return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-600 border border-amber-200 uppercase tracking-widest">In Progress</span>
      case 'issued': return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-600 border border-blue-200 uppercase tracking-widest">Issued</span>
      case 'open': return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-zinc-100 text-zinc-600 border border-zinc-200 uppercase tracking-widest">Open</span>
      default: return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-zinc-100 text-zinc-500 border border-zinc-200 uppercase tracking-widest">{status.replace('_', ' ')}</span>
    }
  }

  return (
    <div className="space-y-5 animate-in fade-in duration-500">
      
      {/* MOBILE-FIRST CAPSULE FILTERS */}
      <div className="flex flex-col gap-2.5 bg-white p-2.5 rounded-2xl border border-zinc-200 shadow-sm print:hidden">
        
        <div className="flex items-center gap-2 w-full">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
            <Input 
              placeholder="Search Job Bag..." 
              className="pl-9 h-9 text-xs rounded-full bg-zinc-50 border-zinc-200 focus-visible:ring-zinc-400 font-medium text-zinc-800" 
              value={search} 
              onChange={(e) => setSearch(e.target.value)} 
            />
          </div>
          
          <Button 
            variant={showFilters ? "default" : "outline"} 
            size="icon" 
            className={`h-9 w-9 rounded-full sm:hidden shrink-0 transition-colors ${showFilters ? 'bg-zinc-900 text-white' : 'border-zinc-200 text-zinc-600 hover:bg-zinc-100'}`}
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="h-4 w-4" />
          </Button>

          <Button variant="outline" size="icon" className="h-9 w-9 rounded-full border-zinc-200 shrink-0 hidden sm:flex text-zinc-600 hover:bg-zinc-100" onClick={fetchData}>
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button onClick={handleExport} disabled={exporting || loading} className="h-9 text-xs font-medium rounded-full hidden sm:flex shrink-0 text-zinc-700 border border-zinc-200 hover:bg-zinc-50 bg-white">
            {exporting ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <FileText className="mr-2 h-3.5 w-3.5 text-zinc-500" />}
            Export CSV
          </Button>
        </div>

        <div className={`flex-col sm:flex-row flex-wrap items-center gap-2 ${showFilters ? 'flex' : 'hidden sm:flex'} animate-in slide-in-from-top-2 duration-200`}>
          
          {/* Dates */}
          <div className="flex w-full sm:w-auto items-center bg-zinc-50 border border-zinc-200 rounded-full px-3 h-9 focus-within:border-zinc-400 transition-colors min-w-0">
            <Clock className="w-3.5 h-3.5 text-zinc-400 shrink-0 mr-1.5" />
            <input type="date" className="bg-transparent text-[11px] font-mono font-medium outline-none flex-1 min-w-0 text-zinc-700" value={startDate} onChange={e => setStartDate(e.target.value)} />
            <span className="text-zinc-300 text-[10px] uppercase font-bold mx-1 shrink-0">-</span>
            <input type="date" className="bg-transparent text-[11px] font-mono font-medium outline-none flex-1 min-w-0 text-right text-zinc-700" value={endDate} onChange={e => setEndDate(e.target.value)} />
          </div>

          <div className="flex w-full sm:w-auto gap-2">
            <Select value={filterKarigar} onValueChange={setFilterKarigar}>
              <SelectTrigger className="h-9 text-[11px] font-bold bg-zinc-50 border-zinc-200 rounded-full flex-1 sm:w-[150px] focus:ring-0">
                <Hammer className="w-3 h-3 mr-1.5 text-zinc-500" />
                <SelectValue placeholder="Artisan" />
              </SelectTrigger>
              <SelectContent className="rounded-xl shadow-xl border-zinc-200">
                <SelectItem value="all" className="text-xs font-medium rounded-lg">All Artisans</SelectItem>
                {karigars.map(k => <SelectItem key={k.id} value={k.id} className="text-xs font-medium rounded-lg">{k.full_name}</SelectItem>)}
              </SelectContent>
            </Select>

            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="h-9 text-[11px] font-bold bg-zinc-50 border-zinc-200 rounded-full flex-1 sm:w-[130px] focus:ring-0">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent className="rounded-xl shadow-xl border-zinc-200">
                <SelectItem value="all" className="text-xs font-medium rounded-lg">All Statuses</SelectItem>
                <SelectItem value="open" className="text-xs font-medium rounded-lg">Open</SelectItem>
                <SelectItem value="issued" className="text-xs font-medium rounded-lg">Issued</SelectItem>
                <SelectItem value="in_progress" className="text-xs font-medium rounded-lg">In Progress</SelectItem>
                <SelectItem value="completed" className="text-xs font-medium rounded-lg">Completed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-2 w-full sm:hidden mt-1">
            <Button variant="outline" className="flex-1 h-9 text-xs font-medium rounded-full border-zinc-200 text-zinc-700" onClick={fetchData}>
              <RefreshCw className={`h-3.5 w-3.5 mr-2 text-zinc-500 ${loading ? 'animate-spin' : ''}`} /> Sync
            </Button>
            <Button variant="outline" className="flex-1 h-9 text-xs font-medium rounded-full border-zinc-200 text-zinc-700" onClick={handleExport} disabled={exporting || loading}>
              {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" /> : <FileText className="h-3.5 w-3.5 mr-2 text-zinc-500" />} CSV
            </Button>
          </div>
        </div>
      </div>

      {/* MODERN KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <Card className="shadow-sm border-zinc-200 bg-white rounded-2xl">
          <CardContent className="p-4 sm:p-5">
            <p className="text-[11px] font-medium text-zinc-500 mb-1 flex items-center gap-1.5">
              <Briefcase className="h-3.5 w-3.5 text-zinc-400" /> Active Bags
            </p>
            {loading ? <Skeleton className="h-8 w-16 mt-1" /> : <p className="text-2xl sm:text-3xl font-semibold tracking-tighter text-zinc-900 mt-1">{metrics.activeBags}</p>}
          </CardContent>
        </Card>

        <Card className="shadow-sm border-amber-200 bg-amber-50/30 rounded-2xl">
          <CardContent className="p-4 sm:p-5">
            <p className="text-[11px] font-medium text-amber-600 mb-1">Gold in WIP</p>
            {loading ? <Skeleton className="h-8 w-24 mt-1" /> : <p className="text-2xl sm:text-3xl font-semibold tracking-tighter text-zinc-900 mt-1">{metrics.totalGoldPending.toFixed(2)}<span className="text-sm font-medium text-amber-600/70 ml-1 tracking-normal">g</span></p>}
          </CardContent>
        </Card>

        <Card className="shadow-sm border-blue-200 bg-blue-50/30 rounded-2xl">
          <CardContent className="p-4 sm:p-5">
            <p className="text-[11px] font-medium text-blue-600 mb-1">Diamonds in WIP</p>
            {loading ? <Skeleton className="h-8 w-24 mt-1" /> : <p className="text-2xl sm:text-3xl font-semibold tracking-tighter text-zinc-900 mt-1">{metrics.totalDiamondPending.toFixed(2)}<span className="text-sm font-medium text-blue-600/70 ml-1 tracking-normal">ct</span></p>}
          </CardContent>
        </Card>

        <Card className="shadow-sm border-zinc-200 bg-white rounded-2xl">
          <CardContent className="p-4 sm:p-5">
            <p className="text-[11px] font-medium text-zinc-500 mb-1 flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> Completed
            </p>
            {loading ? <Skeleton className="h-8 w-16 mt-1" /> : <p className="text-2xl sm:text-3xl font-semibold tracking-tighter text-zinc-900 mt-1">{metrics.completedRecently}</p>}
          </CardContent>
        </Card>
      </div>

      {/* DATA VIEW (Responsive: List on Mobile, Table on Desktop) */}
      <Card className="shadow-sm border-zinc-200 bg-white rounded-2xl overflow-hidden">
        
        {/* === MOBILE LIST VIEW === */}
        <div className="block sm:hidden divide-y divide-zinc-100">
          {loading ? (
             Array.from({ length: 5 }).map((_, i) => (
               <div key={i} className="p-4 space-y-3">
                 <div className="flex justify-between"><Skeleton className="h-4 w-24" /><Skeleton className="h-5 w-16 rounded-full" /></div>
                 <div className="flex gap-4"><Skeleton className="h-3 w-16" /><Skeleton className="h-3 w-16" /></div>
               </div>
             ))
          ) : data.length === 0 ? (
            <div className="py-12 text-center text-zinc-400">
              <Hammer className="h-8 w-8 mx-auto mb-3 opacity-30" />
              <p className="text-sm font-semibold tracking-tight">No active jobs found</p>
            </div>
          ) : (
            data.map((job) => (
              <div key={job.id} className="p-4 hover:bg-zinc-50 transition-colors">
                <div className="flex justify-between items-start mb-2.5">
                  <div>
                    <div className="font-mono text-[13px] font-bold text-zinc-900 tracking-tight">{job.job_bag_number}</div>
                    <div className="text-[11px] font-medium text-zinc-500 mt-0.5 flex items-center gap-1.5">
                      {job.product_category || '--'} 
                      <span className="w-1 h-1 rounded-full bg-zinc-300" />
                      {job.karigars?.full_name || 'Unassigned'}
                    </div>
                  </div>
                  <div>{getStatusBadge(job.status)}</div>
                </div>
                
                <div className="flex justify-between items-end mt-3 pt-3 border-t border-zinc-100/80">
                  <div className="flex gap-4">
                    <div>
                      <p className="text-[9px] font-bold uppercase tracking-widest text-amber-500 mb-0.5">Exp. Gold</p>
                      <p className="text-xs font-semibold text-zinc-800">{job.gold_expected_weight_g || 0}g</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-bold uppercase tracking-widest text-blue-500 mb-0.5">Exp. Diamond</p>
                      <p className="text-xs font-semibold text-zinc-800">{job.diamond_expected_weight_cts || 0}ct</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-400 mb-0.5">Due Date</p>
                    <p className="text-[11px] font-medium text-zinc-600">{job.expected_return_date ? format(new Date(job.expected_return_date), 'dd MMM') : '--'}</p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* === DESKTOP TABLE VIEW === */}
        <div className="hidden sm:block overflow-x-auto">
          <Table>
            <TableHeader className="bg-zinc-50/80">
              <TableRow className="hover:bg-transparent border-zinc-200">
                <TableHead className="h-11 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider px-4">Bag Details</TableHead>
                <TableHead className="h-11 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">Artisan</TableHead>
                <TableHead className="h-11 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider text-right">Gold (g)</TableHead>
                <TableHead className="h-11 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider text-right">Diamond (ct)</TableHead>
                <TableHead className="h-11 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider text-center">Status</TableHead>
                <TableHead className="h-11 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider text-right pr-6">Due Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i} className="border-zinc-100">
                    <TableCell className="px-4 py-3"><Skeleton className="h-4 w-24" /><Skeleton className="h-3 w-16 mt-1.5" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-12 ml-auto" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-12 ml-auto" /></TableCell>
                    <TableCell className="text-center"><Skeleton className="h-5 w-16 mx-auto rounded-full" /></TableCell>
                    <TableCell className="pr-6"><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-40 text-center text-zinc-400">
                    <Hammer className="h-6 w-6 mx-auto mb-2 opacity-30" />
                    <p className="text-xs font-semibold tracking-tight">No active jobs found</p>
                  </TableCell>
                </TableRow>
              ) : (
                data.map((job) => (
                  <TableRow key={job.id} className="hover:bg-zinc-50/50 transition-colors border-zinc-100">
                    <TableCell className="px-4 py-2.5 sm:py-3">
                      <div className="font-mono text-xs sm:text-[13px] font-semibold text-zinc-900 tracking-tight">{job.job_bag_number}</div>
                      <div className="text-[10px] text-zinc-400 font-medium mt-0.5">{job.product_category || '--'}</div>
                    </TableCell>
                    <TableCell>
                      <div className="text-xs font-semibold text-zinc-700">{job.karigars?.full_name || '--'}</div>
                    </TableCell>
                    <TableCell className="text-right text-[13px] font-medium text-zinc-800">{job.gold_expected_weight_g || 0}</TableCell>
                    <TableCell className="text-right text-[13px] font-medium text-zinc-800">{job.diamond_expected_weight_cts || 0}</TableCell>
                    <TableCell className="text-center">{getStatusBadge(job.status)}</TableCell>
                    <TableCell className="text-right text-[11px] font-medium text-zinc-500 pr-6">
                      {job.expected_return_date ? format(new Date(job.expected_return_date), 'dd MMM yyyy') : '--'}
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