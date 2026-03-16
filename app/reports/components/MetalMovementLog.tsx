"use client"

import React, { useEffect, useState } from 'react'
import { format, startOfMonth } from 'date-fns'
import * as XLSX from 'xlsx'
import { 
  Download, Loader2, RefreshCw, Calendar, 
  ArrowRight, Box, Hammer, Store, Flame, Activity
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

interface MetalMovement {
  id: string;
  transaction_date: string;
  reference_type: string;
  karigar_name: string;
  from_location: string;
  to_location: string;
  gross_weight_g: number;
  purity_pct: number;
  fine_weight_g: number;
  description: string;
}

export function MetalMovementLog() {
  const { appUser } = useAuth()
  const { toast } = useToast()
  
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  
  const [startDate, setStartDate] = useState(() => format(startOfMonth(new Date()), 'yyyy-MM-dd'))
  const [endDate, setEndDate] = useState(() => format(new Date(), 'yyyy-MM-dd'))

  const [movements, setMovements] = useState<MetalMovement[]>([])
  
  // Quick KPIs based on the fetched period
  const [totals, setTotals] = useState({ issued: 0, received: 0, loss: 0 })

  const fetchMovements = async () => {
    if (!appUser?.company_id) return
    setLoading(true)

    try {
      const { data, error } = await supabase.rpc('get_metal_movement_ledger', {
        p_company_id: appUser.company_id,
        p_start_date: startDate,
        p_end_date: endDate
      })

      if (error) throw error
      
      const rows = data || []
      setMovements(rows)

      // Calculate Period KPIs
      let issued = 0, received = 0, loss = 0;
      rows.forEach((r: MetalMovement) => {
        if (r.from_location === 'VAULT' && r.to_location === 'KARIGAR') issued += Number(r.fine_weight_g);
        if (r.from_location === 'KARIGAR' && r.to_location === 'SHOWROOM') received += Number(r.fine_weight_g);
        if (r.to_location === 'MELT_LOSS') loss += Number(r.fine_weight_g);
      });
      setTotals({ issued, received, loss });

    } catch (err: any) {
      toast({ title: "Fetch Failed", description: err.message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchMovements() }, [appUser, startDate, endDate])

  const handleExport = () => {
    if (movements.length === 0) return;
    setExporting(true);

    const formattedData = movements.map(m => ({
      'Date': format(new Date(m.transaction_date), 'dd-MMM-yyyy HH:mm'),
      'Type': m.reference_type.replace(/_/g, ' '),
      'Karigar': m.karigar_name,
      'From': m.from_location,
      'To': m.to_location,
      'Gross Wt (g)': m.gross_weight_g,
      'Purity (%)': m.purity_pct,
      'Fine Wt (g)': m.fine_weight_g,
      'Description': m.description
    }));

    const worksheet = XLSX.utils.json_to_sheet(formattedData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Metal_Movements");
    XLSX.writeFile(workbook, `Metal_Movements_${format(new Date(), 'yyyyMMdd')}.xlsx`);
    
    setExporting(false);
  }

  const getLocationBadge = (loc: string) => {
    switch (loc) {
      case 'VAULT': return <span className="flex items-center gap-1 text-[10px] font-bold text-zinc-600 bg-zinc-100 border border-zinc-200 px-2 py-0.5 rounded uppercase tracking-widest"><Box className="w-3 h-3"/> Vault</span>
      case 'KARIGAR': return <span className="flex items-center gap-1 text-[10px] font-bold text-blue-600 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded uppercase tracking-widest"><Hammer className="w-3 h-3"/> Karigar</span>
      case 'SHOWROOM': return <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded uppercase tracking-widest"><Store className="w-3 h-3"/> Showroom</span>
      case 'MELT_LOSS': return <span className="flex items-center gap-1 text-[10px] font-bold text-rose-600 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded uppercase tracking-widest"><Flame className="w-3 h-3"/> Melt Loss</span>
      default: return <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">{loc}</span>
    }
  }

  return (
    <div className="space-y-5 animate-in fade-in duration-500 max-w-6xl mx-auto">
      
      {/* TOOLBAR */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-3 rounded-2xl border border-zinc-200 shadow-sm print:hidden">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-zinc-900 flex items-center justify-center">
            <Activity className="h-4 w-4 text-white" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-zinc-900 tracking-tight">Metal Movement Log</h2>
            <p className="text-[11px] text-zinc-500 font-medium">Trace every gram from Vault to Showroom to Loss.</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <div className="flex items-center bg-zinc-50 border border-zinc-200 rounded-full px-3 h-9 focus-within:border-zinc-400 min-w-0">
            <Calendar className="w-3.5 h-3.5 text-zinc-400 shrink-0 mr-1.5" />
            <input type="date" className="bg-transparent text-[11px] font-mono font-medium outline-none w-24 sm:w-auto text-zinc-700" value={startDate} onChange={e => setStartDate(e.target.value)} />
            <span className="text-zinc-300 text-[10px] uppercase font-bold mx-1 shrink-0">-</span>
            <input type="date" className="bg-transparent text-[11px] font-mono font-medium outline-none w-24 sm:w-auto text-right text-zinc-700" value={endDate} onChange={e => setEndDate(e.target.value)} />
          </div>
          
          <Button variant="outline" size="icon" className="h-9 w-9 rounded-full border-zinc-200 text-zinc-600" onClick={fetchMovements}>
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button onClick={handleExport} disabled={exporting || loading} className="h-9 text-xs font-medium rounded-full text-zinc-700 border border-zinc-200 bg-white shadow-sm flex-1 sm:flex-none">
            {exporting ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Download className="sm:mr-2 h-3.5 w-3.5" />}
            <span className="hidden sm:inline-block">Export Log</span>
          </Button>
        </div>
      </div>

      {/* PERIOD KPIs */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        <Card className="shadow-sm border-zinc-200 bg-white rounded-2xl">
          <CardContent className="p-4">
            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Period Issued (To Karigars)</p>
            {loading ? <Skeleton className="h-6 w-24" /> : <p className="text-xl font-bold tracking-tighter text-zinc-900">{totals.issued.toFixed(3)} g</p>}
          </CardContent>
        </Card>
        <Card className="shadow-sm border-zinc-200 bg-white rounded-2xl">
          <CardContent className="p-4">
            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Period Received (To Showroom)</p>
            {loading ? <Skeleton className="h-6 w-24" /> : <p className="text-xl font-bold tracking-tighter text-emerald-700">{totals.received.toFixed(3)} g</p>}
          </CardContent>
        </Card>
        <Card className="shadow-sm border-rose-200 bg-rose-50/50 rounded-2xl">
          <CardContent className="p-4">
            <p className="text-[10px] font-bold text-rose-600 uppercase tracking-widest mb-1">Period Melt Loss Booked</p>
            {loading ? <Skeleton className="h-6 w-24" /> : <p className="text-xl font-bold tracking-tighter text-rose-800">{totals.loss.toFixed(3)} g</p>}
          </CardContent>
        </Card>
      </div>

      {/* THE MOVEMENT LEDGER */}
      <Card className="shadow-sm border-zinc-200 bg-white rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-zinc-50/80">
              <TableRow className="hover:bg-transparent border-zinc-200">
                <TableHead className="h-11 text-[10px] font-bold text-zinc-500 uppercase tracking-widest px-4 w-32">Date & Time</TableHead>
                <TableHead className="h-11 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Route (From → To)</TableHead>
                <TableHead className="h-11 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Party / Karigar</TableHead>
                <TableHead className="h-11 text-[10px] font-bold text-zinc-500 uppercase tracking-widest text-right">Gross Wt</TableHead>
                <TableHead className="h-11 text-[10px] font-bold text-zinc-500 uppercase tracking-widest text-right">Purity</TableHead>
                <TableHead className="h-11 text-[10px] font-bold text-zinc-500 uppercase tracking-widest text-right pr-6 bg-amber-50/30">Fine Weight</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={6} className="h-32 text-center"><Loader2 className="h-6 w-6 animate-spin text-zinc-300 mx-auto" /></TableCell></TableRow>
              ) : movements.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="h-32 text-center text-zinc-400 text-sm font-medium">No metal movements in this period.</TableCell></TableRow>
              ) : (
                movements.map((m) => (
                  <TableRow key={m.id} className="hover:bg-zinc-50/80 transition-colors border-zinc-100">
                    <TableCell className="px-4 py-3">
                      <div className="text-[12px] font-medium text-zinc-800">{format(new Date(m.transaction_date), 'dd MMM yyyy')}</div>
                      <div className="text-[10px] font-mono text-zinc-400">{format(new Date(m.transaction_date), 'HH:mm')}</div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getLocationBadge(m.from_location)}
                        <ArrowRight className="h-3 w-3 text-zinc-300" />
                        {getLocationBadge(m.to_location)}
                      </div>
                      <div className="text-[10px] font-medium text-zinc-400 mt-1 uppercase tracking-widest">{m.reference_type.replace(/_/g, ' ')}</div>
                    </TableCell>
                    <TableCell>
                      <span className="text-[12px] font-semibold text-zinc-700">{m.karigar_name}</span>
                    </TableCell>
                    <TableCell className="text-right text-[13px] font-medium text-zinc-600">
                      {Number(m.gross_weight_g).toFixed(3)}g
                    </TableCell>
                    <TableCell className="text-right text-[12px] font-medium text-zinc-400">
                      {Number(m.purity_pct).toFixed(2)}%
                    </TableCell>
                    <TableCell className="text-right text-[13px] font-bold text-amber-700 pr-6 bg-amber-50/10">
                      {Number(m.fine_weight_g).toFixed(3)}g
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