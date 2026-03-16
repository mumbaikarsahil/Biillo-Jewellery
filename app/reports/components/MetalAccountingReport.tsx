"use client"

import React, { useEffect, useState } from 'react'
import { format } from 'date-fns'
import * as XLSX from 'xlsx'
import { 
  Download, Loader2, RefreshCw, 
  Database, Hammer, Flame, AlertTriangle, Diamond, Cuboid
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

interface KarigarWip {
  karigar_id: string;
  karigar_name: string;
  metal_type: string;
  issued_gross: number;
  issued_fine: number;
  returned_gross: number;
  returned_fine: number;
  loss_fine: number;
}

export function MetalAccountingReport() {
  const { appUser } = useAuth()
  const { toast } = useToast()
  
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  
  const [metrics, setMetrics] = useState({
    vault_fine_gold_g: 0,
    vault_diamonds_cts: 0,
    total_wip_gold_g: 0,
    total_wip_diamonds_cts: 0,
    total_melt_loss_g: 0,
    total_diamond_loss_cts: 0,
    karigar_ledgers: [] as KarigarWip[]
  })

  const fetchMetalData = async () => {
    if (!appUser?.company_id) return
    setLoading(true)

    try {
      const { data, error } = await supabase.rpc('get_metal_accounting_summary', {
        p_company_id: appUser.company_id
      })

      if (error) throw error
      if (data) setMetrics(data as any)
        
    } catch (err: any) {
      toast({ title: "Fetch Failed", description: err.message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchMetalData() }, [appUser])

  const handleExport = () => {
    if (metrics.karigar_ledgers.length === 0) return;
    setExporting(true);

    const formattedData = metrics.karigar_ledgers.map(k => {
      const isGold = k.metal_type === 'GOLD';
      const issuedPurity = k.issued_gross > 0 && isGold ? (k.issued_fine / k.issued_gross) * 100 : 100;
      const returnedPurity = k.returned_gross > 0 && isGold ? (k.returned_fine / k.returned_gross) * 100 : 100;
      const currentWipFine = k.issued_fine - k.returned_fine - k.loss_fine;

      return {
        'Artisan Name': k.karigar_name,
        'Material Type': k.metal_type,
        'Issued Gross': k.issued_gross,
        'Issued Avg Purity (%)': isGold ? issuedPurity.toFixed(2) : 'N/A',
        'Issued Fine': k.issued_fine,
        'Returned Gross': k.returned_gross,
        'Returned Avg Purity (%)': isGold ? returnedPurity.toFixed(2) : 'N/A',
        'Returned Fine': k.returned_fine,
        'Recorded Loss': k.loss_fine,
        'Current Liability': currentWipFine
      }
    });

    const worksheet = XLSX.utils.json_to_sheet(formattedData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Karigar_Metal_Ledger");
    XLSX.writeFile(workbook, `Asset_Ledger_${format(new Date(), 'yyyyMMdd')}.xlsx`);
    
    setExporting(false);
  }

  return (
    <div className="space-y-5 animate-in fade-in duration-500 max-w-6xl mx-auto">
      
      {/* TOOLBAR */}
      <div className="flex justify-between items-center bg-white p-3 rounded-2xl border border-zinc-200 shadow-sm print:hidden">
        <div>
          <h2 className="text-sm font-bold text-zinc-900 tracking-tight">Vault & Karigar Ledgers</h2>
          <p className="text-[11px] text-zinc-500 font-medium">Track fine gold weights, diamond carats, and artisan holdings.</p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="h-9 w-9 rounded-full border-zinc-200 text-zinc-600" onClick={fetchMetalData}>
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button onClick={handleExport} disabled={exporting || loading} className="h-9 text-xs font-medium rounded-full text-zinc-700 border border-zinc-200 bg-white shadow-sm flex-1 sm:flex-none">
            {exporting ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Download className="sm:mr-2 h-3.5 w-3.5" />}
            <span className="hidden sm:inline-block">Export Ledger</span>
          </Button>
        </div>
      </div>

      {/* HIGHLIGHT KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
        
        {/* VAULT BALANCE */}
        <Card className="shadow-sm border-zinc-200 bg-white rounded-2xl">
          <CardContent className="p-4 sm:p-5">
            <p className="text-[11px] font-bold text-zinc-500 uppercase tracking-widest mb-3 flex items-center gap-1.5"><Database className="h-3.5 w-3.5 text-zinc-400" /> Secure Vault Balances</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[10px] text-zinc-400 font-bold mb-0.5">GOLD (FINE)</p>
                {loading ? <Skeleton className="h-6 w-20" /> : <p className="text-xl font-bold tracking-tighter text-zinc-900">{metrics.vault_fine_gold_g.toFixed(3)}<span className="text-[11px] font-medium text-zinc-400 ml-1">g</span></p>}
              </div>
              <div>
                <p className="text-[10px] text-zinc-400 font-bold mb-0.5">DIAMONDS</p>
                {loading ? <Skeleton className="h-6 w-20" /> : <p className="text-xl font-bold tracking-tighter text-zinc-900">{metrics.vault_diamonds_cts.toFixed(3)}<span className="text-[11px] font-medium text-zinc-400 ml-1">ct</span></p>}
              </div>
            </div>
          </CardContent>
        </Card>
        
        {/* KARIGAR WIP */}
        <Card className="shadow-sm border-blue-200 bg-blue-50/40 rounded-2xl">
          <CardContent className="p-4 sm:p-5">
            <p className="text-[11px] font-bold text-blue-600 uppercase tracking-widest mb-3 flex items-center gap-1.5"><Hammer className="h-3.5 w-3.5" /> Total Active WIP</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[10px] text-blue-400 font-bold mb-0.5">GOLD (FINE)</p>
                {loading ? <Skeleton className="h-6 w-20" /> : <p className="text-xl font-bold tracking-tighter text-blue-900">{metrics.total_wip_gold_g.toFixed(3)}<span className="text-[11px] font-medium text-blue-400 ml-1">g</span></p>}
              </div>
              <div>
                <p className="text-[10px] text-blue-400 font-bold mb-0.5">DIAMONDS</p>
                {loading ? <Skeleton className="h-6 w-20" /> : <p className="text-xl font-bold tracking-tighter text-blue-900">{metrics.total_wip_diamonds_cts.toFixed(3)}<span className="text-[11px] font-medium text-blue-400 ml-1">ct</span></p>}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* MELT / BREAKAGE LOSS */}
        <Card className="shadow-sm border-rose-200 bg-rose-50/40 rounded-2xl">
          <CardContent className="p-4 sm:p-5">
            <p className="text-[11px] font-bold text-rose-600 uppercase tracking-widest mb-3 flex items-center gap-1.5"><Flame className="h-3.5 w-3.5" /> YTD Loss & Breakage</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[10px] text-rose-400 font-bold mb-0.5">GOLD DUST</p>
                {loading ? <Skeleton className="h-6 w-20" /> : <p className="text-xl font-bold tracking-tighter text-rose-900">{metrics.total_melt_loss_g.toFixed(3)}<span className="text-[11px] font-medium text-rose-400 ml-1">g</span></p>}
              </div>
              <div>
                <p className="text-[10px] text-rose-400 font-bold mb-0.5">STONE DAMAGE</p>
                {loading ? <Skeleton className="h-6 w-20" /> : <p className="text-xl font-bold tracking-tighter text-rose-900">{metrics.total_diamond_loss_cts.toFixed(3)}<span className="text-[11px] font-medium text-rose-400 ml-1">ct</span></p>}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* KARIGAR LEDGER TABLE */}
      <Card className="shadow-sm border-zinc-200 bg-white rounded-2xl overflow-hidden">
        <div className="p-4 bg-zinc-50/80 border-b border-zinc-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-blue-500"></div>
            <h2 className="text-xs font-black uppercase tracking-widest text-zinc-800">Artisan Master Register</h2>
          </div>
          {(metrics.total_melt_loss_g > 50 || metrics.total_diamond_loss_cts > 5) && (
             <div className="flex items-center gap-1 text-[10px] font-bold text-rose-600 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded">
               <AlertTriangle className="w-3 h-3" /> High Loss Alert
             </div>
          )}
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-white">
              <TableRow className="hover:bg-transparent border-zinc-200">
                <TableHead className="h-11 text-[10px] font-bold text-zinc-500 uppercase tracking-widest px-4">Artisan / Karigar</TableHead>
                <TableHead className="h-11 text-[10px] font-bold text-zinc-500 uppercase tracking-widest bg-zinc-50/50">Issued (Sent)</TableHead>
                <TableHead className="h-11 text-[10px] font-bold text-zinc-500 uppercase tracking-widest bg-zinc-50/50">Consumed (Returned)</TableHead>
                <TableHead className="h-11 text-[10px] font-bold text-zinc-500 uppercase tracking-widest text-right bg-rose-50/30">Loss / Breakage</TableHead>
                <TableHead className="h-11 text-[10px] font-bold text-zinc-500 uppercase tracking-widest text-right pr-6 bg-blue-50/30">WIP Liability</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={5} className="h-32 text-center"><Loader2 className="h-6 w-6 animate-spin text-zinc-300 mx-auto" /></TableCell></TableRow>
              ) : metrics.karigar_ledgers.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="h-32 text-center text-zinc-400 text-sm font-medium">No active material held by artisans.</TableCell></TableRow>
              ) : (
                metrics.karigar_ledgers.map((k, idx) => {
                  
                  const isGold = k.metal_type === 'GOLD';
                  const unit = isGold ? 'g' : 'ct';
                  
                  // Math to calculate Weighted Average Purity (Gold Only)
                  const issuedPurity = k.issued_gross > 0 && isGold ? (k.issued_fine / k.issued_gross) * 100 : null;
                  const returnedPurity = k.returned_gross > 0 && isGold ? (k.returned_fine / k.returned_gross) * 100 : null;
                  const currentWipFine = k.issued_fine - k.returned_fine - k.loss_fine;

                  return (
                    <TableRow key={`${k.karigar_id}-${idx}`} className="hover:bg-zinc-50/80 transition-colors border-zinc-100">
                      
                      {/* Artisan Identity */}
                      <TableCell className="px-4 py-3">
                        <div className="text-[13px] font-bold text-zinc-800">{k.karigar_name}</div>
                        <div className="flex items-center gap-1 mt-1">
                          {isGold ? <Cuboid className="w-3 h-3 text-amber-500" /> : <Diamond className="w-3 h-3 text-blue-500" />}
                          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{k.metal_type}</span>
                        </div>
                      </TableCell>

                      {/* ISSUED COLUMN (Gross, Purity, Fine) */}
                      <TableCell className="bg-zinc-50/30 border-l border-zinc-100">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[13px] font-semibold text-zinc-700">{Number(k.issued_gross).toFixed(3)}{unit} <span className="text-[10px] font-normal text-zinc-500">Gross</span></span>
                          {isGold && <span className="text-[11px] font-mono font-medium text-amber-600">{issuedPurity?.toFixed(2)}% Purity</span>}
                          {isGold && <span className="text-[12px] font-bold text-zinc-900 mt-1">{Number(k.issued_fine).toFixed(3)}g <span className="text-[10px] text-zinc-500">Fine</span></span>}
                        </div>
                      </TableCell>

                      {/* RETURNED COLUMN (Gross, Purity, Fine) */}
                      <TableCell className="bg-zinc-50/30 border-r border-l border-zinc-100">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[13px] font-semibold text-zinc-700">{Number(k.returned_gross).toFixed(3)}{unit} <span className="text-[10px] font-normal text-zinc-500">Gross</span></span>
                          {isGold && <span className="text-[11px] font-mono font-medium text-emerald-600">{returnedPurity?.toFixed(2)}% Purity</span>}
                          {isGold && <span className="text-[12px] font-bold text-zinc-900 mt-1">{Number(k.returned_fine).toFixed(3)}g <span className="text-[10px] text-zinc-500">Fine</span></span>}
                        </div>
                      </TableCell>

                      {/* MELT LOSS / BREAKAGE */}
                      <TableCell className="text-right text-[13px] font-bold text-rose-600 bg-rose-50/20 border-r border-zinc-100 align-bottom pb-4">
                        {Number(k.loss_fine).toFixed(3)}{unit}
                      </TableCell>

                      {/* CURRENT LIABILITY */}
                      <TableCell className="text-right text-[14px] font-black text-blue-900 pr-6 bg-blue-50/20 align-bottom pb-4">
                        {currentWipFine.toFixed(3)}{unit}
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