"use client"

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Scale, Coins, Diamond, AlertTriangle, CheckCircle2, ArrowRightLeft, Loader2, History } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { toast } from 'sonner'

interface Props {
  jobId: string
}

export default function ReconciliationTab({ jobId }: Props) {
  const [loading, setLoading] = useState(true)
  const [summary, setSummary] = useState<any>(null)
  
  // Detailed Logs State
  const [goldLogs, setGoldLogs] = useState<any[]>([])
  const [diamondLogs, setDiamondLogs] = useState<any[]>([])

  // Modals & Return State
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false)
  const [isReturning, setIsReturning] = useState(false)
  const [issuedGoldBatches, setIssuedGoldBatches] = useState<any[]>([])
  const [issuedDiamondLots, setIssuedDiamondLots] = useState<any[]>([])

  // Gold Return Form
  const [returnGoldBatchId, setReturnGoldBatchId] = useState('')
  const [returnGoldWt, setReturnGoldWt] = useState('')

  // Diamond Return Form
  const [returnDiaLotId, setReturnDiaLotId] = useState('')
  const [returnDiaCts, setReturnDiaCts] = useState('')
  const [returnDiaPcs, setReturnDiaPcs] = useState('')

  const fetchSummary = useCallback(async () => {
    setLoading(true)
    try {
      // 1. --- FETCH ISSUES ---
      const { data: goldIssues } = await supabase
        .from('job_bag_gold_issues')
        .select(`
          created_at, gold_batch_id, issued_weight_g,
          inventory_gold_batches ( batch_number, purity_percent, purity_karat )
        `)
        .eq('job_bag_id', jobId)

      const uniqueGold = Array.from(new Map(goldIssues?.filter((i: any) => i.gold_batch_id).map((i: any) => [
        i.gold_batch_id, 
        { id: i.gold_batch_id, batch_number: i.inventory_gold_batches?.batch_number, purity: i.inventory_gold_batches?.purity_karat, purity_percent: i.inventory_gold_batches?.purity_percent }
      ])).values())
      setIssuedGoldBatches(uniqueGold)

      const { data: diamondIssues } = await supabase
        .from('job_bag_diamond_issues')
        .select(`
          created_at, diamond_lot_id, issued_weight_cts, issued_pieces,
          inventory_diamond_lots ( lot_number, shape )
        `)
        .eq('job_bag_id', jobId)

      const uniqueDiamonds = Array.from(new Map(diamondIssues?.filter((i: any) => i.diamond_lot_id).map((i: any) => [
        i.diamond_lot_id, 
        { id: i.diamond_lot_id, lot_number: i.inventory_diamond_lots?.lot_number, shape: i.inventory_diamond_lots?.shape }
      ])).values())
      setIssuedDiamondLots(uniqueDiamonds)

      // 2. --- FETCH CONSUMPTION & RETURNS ---
      // We added sku_reference and created_at to build the detailed logs
      const { data: finishedItems } = await supabase
        .from('inventory_items')
        .select('sku_reference, created_at, net_weight_g, wastage_weight_g, purity_percent, purity_karat, total_stone_weight_cts, total_stone_pieces')
        .eq('created_from_job_bag_id', jobId)

      const { data: diamondReturns } = await supabase
        .from('job_bag_diamond_returns')
        .select(`
          created_at, returned_weight_cts, returned_pieces,
          inventory_diamond_lots ( lot_number )
        `)
        .eq('job_bag_id', jobId)

      // --- CALCULATE FINE MATH & BUILD DETAILED LOGS ---
      let gLogs: any[] = []
      let dLogs: any[] = []

      // Process Gold Issues
      const totalFineIssued = goldIssues?.reduce((sum, issue: any) => {
        const purity = Number(issue.inventory_gold_batches?.purity_percent || 100) / 100
        const fine = Number(issue.issued_weight_g) * purity
        
        // Log it if it's a positive issue (Negative issues are handled as returns mathematically)
        if (Number(issue.issued_weight_g) > 0) {
          gLogs.push({
            type: 'ISSUED', date: issue.created_at, ref: `Batch: ${issue.inventory_gold_batches?.batch_number}`,
            gross: Number(issue.issued_weight_g), loss: 0, purityStr: issue.inventory_gold_batches?.purity_karat,
            purityPct: purity * 100, fine: fine, isReturn: false
          })
        } else if (Number(issue.issued_weight_g) < 0) {
           gLogs.push({
            type: 'RETURNED', date: issue.created_at, ref: `Batch: ${issue.inventory_gold_batches?.batch_number}`,
            gross: Math.abs(Number(issue.issued_weight_g)), loss: 0, purityStr: issue.inventory_gold_batches?.purity_karat,
            purityPct: purity * 100, fine: Math.abs(fine), isReturn: true
          })
        }
        return sum + fine
      }, 0) || 0

      // Process Gold Consumption
      const totalFineConsumed = finishedItems?.reduce((sum, item: any) => {
        const purity = Number(item.purity_percent || 100) / 100
        const fineConsumed = Number(item.net_weight_g) * purity
        return sum + fineConsumed
      }, 0) || 0

      const totalFineLoss = finishedItems?.reduce((sum, item: any) => {
        const purity = Number(item.purity_percent || 100) / 100
        const fineLoss = Number(item.wastage_weight_g) * purity
        return sum + fineLoss
      }, 0) || 0

      // Add Finished Items to Logs
      finishedItems?.forEach((item: any) => {
         const purity = Number(item.purity_percent || 100) / 100
         const gross = Number(item.net_weight_g)
         const loss = Number(item.wastage_weight_g)
         const totalUsed = gross + loss
         
         if (totalUsed > 0) {
           gLogs.push({
             type: 'CONSUMED', date: item.created_at, ref: `SKU: ${item.sku_reference}`,
             gross: gross, loss: loss, purityStr: item.purity_karat,
             purityPct: purity * 100, fine: totalUsed * purity, isReturn: false
           })
         }

         if (Number(item.total_stone_weight_cts) > 0) {
           dLogs.push({
             type: 'CONSUMED', date: item.created_at, ref: `SKU: ${item.sku_reference}`,
             cts: Number(item.total_stone_weight_cts), pcs: Number(item.total_stone_pieces), isReturn: false
           })
         }
      })

      const remainingFineGold = totalFineIssued - totalFineConsumed - totalFineLoss

      // Process Diamond Logs
      const diaIssuedCts = diamondIssues?.reduce((sum, issue: any) => {
         dLogs.push({
           type: 'ISSUED', date: issue.created_at, ref: `Lot: ${issue.inventory_diamond_lots?.lot_number}`,
           cts: Number(issue.issued_weight_cts), pcs: Number(issue.issued_pieces), isReturn: false
         })
         return sum + Number(issue.issued_weight_cts)
      }, 0) || 0
      const diaIssuedPcs = diamondIssues?.reduce((a, b) => a + Number(b.issued_pieces), 0) || 0

      const diaConsumedCts = finishedItems?.reduce((a, b) => a + Number(b.total_stone_weight_cts), 0) || 0
      const diaConsumedPcs = finishedItems?.reduce((a, b) => a + Number(b.total_stone_pieces), 0) || 0

      const diaReturnedCts = diamondReturns?.reduce((sum, ret: any) => {
         dLogs.push({
           type: 'RETURNED', date: ret.created_at, ref: `Lot: ${ret.inventory_diamond_lots?.lot_number}`,
           cts: Number(ret.returned_weight_cts), pcs: Number(ret.returned_pieces), isReturn: true
         })
         return sum + Number(ret.returned_weight_cts)
      }, 0) || 0
      const diaReturnedPcs = diamondReturns?.reduce((a, b) => a + Number(b.returned_pieces), 0) || 0

      const remainingDiaCts = diaIssuedCts - diaConsumedCts - diaReturnedCts
      const remainingDiaPcs = diaIssuedPcs - diaConsumedPcs - diaReturnedPcs

      // Sort Logs chronologically
      gLogs.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      dLogs.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

      setGoldLogs(gLogs)
      setDiamondLogs(dLogs)

      setSummary({
        gold: { issued: totalFineIssued, consumed: totalFineConsumed, loss: totalFineLoss, remaining: remainingFineGold },
        diamond: { issuedCts: diaIssuedCts, issuedPcs: diaIssuedPcs, consumedCts: diaConsumedCts, consumedPcs: diaConsumedPcs, returnedCts: diaReturnedCts, remainingCts: remainingDiaCts, remainingPcs: remainingDiaPcs }
      })
    } catch (error: any) {
      toast.error('Failed to load reconciliation data')
    } finally {
      setLoading(false)
    }
  }, [jobId])

  useEffect(() => { fetchSummary() }, [fetchSummary])

  // --- SMART AUTO-LOAD HANDLERS ---
  const handleOpenReturnModal = () => {
    if (issuedGoldBatches.length > 0) {
      const defaultBatch = issuedGoldBatches[0]
      setReturnGoldBatchId(defaultBatch.id)
      
      if (summary?.gold?.remaining > 0.005) {
        const purity = Number(defaultBatch.purity_percent) || 100
        const grossGoldNeeded = summary.gold.remaining / (purity / 100)
        setReturnGoldWt(grossGoldNeeded.toFixed(3))
      } else {
        setReturnGoldWt('')
      }
    }

    if (issuedDiamondLots.length > 0) {
      const defaultLot = issuedDiamondLots[0]
      setReturnDiaLotId(defaultLot.id)
      setReturnDiaCts(summary?.diamond?.remainingCts > 0.005 ? summary.diamond.remainingCts.toFixed(2) : '')
      setReturnDiaPcs(summary?.diamond?.remainingPcs > 0 ? summary.diamond.remainingPcs.toString() : '')
    }

    setIsReturnModalOpen(true)
  }

  const handleGoldBatchChange = (batchId: string) => {
    setReturnGoldBatchId(batchId)
    const selectedBatch = issuedGoldBatches.find(b => b.id === batchId)
    
    if (selectedBatch && summary?.gold?.remaining > 0.005) {
      const purity = Number(selectedBatch.purity_percent) || 100
      const grossGoldNeeded = summary.gold.remaining / (purity / 100)
      setReturnGoldWt(grossGoldNeeded.toFixed(3))
    }
  }

  const handleDiamondLotChange = (lotId: string) => {
    setReturnDiaLotId(lotId)
    if (summary?.diamond?.remainingCts > 0.005) setReturnDiaCts(summary.diamond.remainingCts.toFixed(2))
    if (summary?.diamond?.remainingPcs > 0) setReturnDiaPcs(summary.diamond.remainingPcs.toString())
  }

  // --- SUBMIT ACTIONS ---
  const handleReturnGold = async () => {
    if (!returnGoldBatchId || !returnGoldWt || Number(returnGoldWt) <= 0) return toast.error('Enter valid batch and weight')
    setIsReturning(true)
    try {
      const { error } = await supabase.rpc('return_gold_from_job', {
        p_job_bag_id: jobId,
        p_gold_batch_id: returnGoldBatchId,
        p_weight_g: Number(returnGoldWt)
      })
      if (error) throw error
      toast.success('Gold successfully returned to Vault')
      setReturnGoldWt('')
      setReturnGoldBatchId('')
      setIsReturnModalOpen(false)
      fetchSummary()
    } catch (err: any) {
      toast.error(`Return Failed: ${err.message}`)
    } finally { setIsReturning(false) }
  }

  const handleReturnDiamond = async () => {
    if (!returnDiaLotId || !returnDiaCts || Number(returnDiaCts) <= 0) return toast.error('Enter valid lot and carats')
    setIsReturning(true)
    try {
      const { error } = await supabase.rpc('return_diamond_from_job', {
        p_job_bag_id: jobId,
        p_diamond_lot_id: returnDiaLotId,
        p_weight_cts: Number(returnDiaCts),
        p_pieces: Number(returnDiaPcs) || 0
      })
      if (error) throw error
      toast.success('Diamonds successfully returned to Vault')
      setReturnDiaCts(''); setReturnDiaPcs(''); setReturnDiaLotId('')
      setIsReturnModalOpen(false)
      fetchSummary()
    } catch (err: any) {
      toast.error(`Return Failed: ${err.message}`)
    } finally { setIsReturning(false) }
  }

  if (loading || !summary) {
    return (
      <div className="grid gap-4 md:grid-cols-2 max-w-5xl mx-auto">
        <Skeleton className="h-[250px] w-full rounded-xl border border-border/40" />
        <Skeleton className="h-[250px] w-full rounded-xl border border-border/40" />
      </div>
    )
  }

  const isGoldSettled = Math.abs(summary.gold.remaining) < 0.005; 
  const isDiamondSettled = Math.abs(summary.diamond.remainingCts) < 0.005 && summary.diamond.remainingPcs <= 0;
  const isFullySettled = isGoldSettled && isDiamondSettled;

  return (
    <div className="space-y-6 animate-in fade-in duration-300 max-w-5xl mx-auto">
      
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-border/40">
         <div>
           <div className="flex items-center gap-2">
             <Scale className="w-5 h-5 text-foreground" />
             <h2 className="text-lg font-bold tracking-tight text-foreground">Material Reconciliation</h2>
           </div>
           <p className="text-xs text-muted-foreground mt-1">Ledgers balance based on 24K Fine Metal equivalents.</p>
         </div>
         
         <div className="flex items-center gap-3">
           {!isFullySettled && (
             <Button onClick={handleOpenReturnModal} className="h-8 text-xs font-bold shadow-sm bg-foreground text-background hover:bg-foreground/90 transition-all active:scale-[0.98]">
               <ArrowRightLeft className="w-3.5 h-3.5 mr-2" /> Process Returns
             </Button>
           )}

           {isFullySettled ? (
             <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 px-3 py-1.5 text-[11px] uppercase tracking-widest font-bold">
               <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> Fully Reconciled
             </Badge>
           ) : (
             <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200 px-3 py-1.5 text-[11px] uppercase tracking-widest font-bold">
               <AlertTriangle className="w-3.5 h-3.5 mr-1.5" /> Outstanding Liability
             </Badge>
           )}
         </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 items-start">
        
        {/* GOLD SUMMARY */}
        <Card className={`shadow-sm overflow-hidden border ${isGoldSettled ? 'border-border/60' : 'border-amber-300 shadow-amber-500/10'}`}>
          <div className="bg-secondary/30 py-2.5 px-4 border-b border-border/40 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Coins className="h-3.5 w-3.5 text-amber-500" />
              <h3 className="text-[11px] font-bold uppercase tracking-widest text-foreground">Fine Gold (24K) Ledger</h3>
            </div>
            {isGoldSettled ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <AlertTriangle className="w-4 h-4 text-amber-500" />}
          </div>
          <CardContent className="p-0">
            <div className="divide-y divide-border/40">
              <div className="flex justify-between items-center p-4">
                <span className="text-xs font-medium text-muted-foreground">Total Issued (Fine)</span>
                <span className="text-sm font-bold text-foreground">{summary.gold.issued.toFixed(3)} g</span>
              </div>
              <div className="flex justify-between items-center p-4">
                <span className="text-xs font-medium text-muted-foreground">Consumed in Jewelry (Fine)</span>
                <span className="text-sm font-bold text-foreground">{summary.gold.consumed.toFixed(3)} g</span>
              </div>
              <div className="flex justify-between items-center p-4">
                <span className="text-xs font-medium text-muted-foreground">Recorded Melt Loss (Fine)</span>
                <span className="text-sm font-bold text-rose-600">{summary.gold.loss.toFixed(3)} g</span>
              </div>
              <div className={`flex justify-between items-center p-4 bg-secondary/10 ${!isGoldSettled && 'bg-amber-50/50'}`}>
                <span className="text-xs font-black uppercase tracking-widest text-foreground">Pending Fine Liability</span>
                <span className={`text-lg font-black tracking-tighter ${isGoldSettled ? 'text-emerald-600' : 'text-amber-600'}`}>
                  {summary.gold.remaining.toFixed(3)} g
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* DIAMOND SUMMARY */}
        <Card className={`shadow-sm overflow-hidden border ${isDiamondSettled ? 'border-border/60' : 'border-blue-300 shadow-blue-500/10'}`}>
          <div className="bg-secondary/30 py-2.5 px-4 border-b border-border/40 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Diamond className="h-3.5 w-3.5 text-blue-500" />
              <h3 className="text-[11px] font-bold uppercase tracking-widest text-foreground">Diamond Ledger</h3>
            </div>
            {isDiamondSettled ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <AlertTriangle className="w-4 h-4 text-blue-500" />}
          </div>
          <CardContent className="p-0">
            <div className="divide-y divide-border/40">
              <div className="flex justify-between items-center p-4">
                <span className="text-xs font-medium text-muted-foreground">Total Issued</span>
                <span className="text-sm font-bold text-foreground">
                  {summary.diamond.issuedCts.toFixed(2)} ct <span className="text-[10px] font-normal text-muted-foreground">({summary.diamond.issuedPcs} pcs)</span>
                </span>
              </div>
              <div className="flex justify-between items-center p-4">
                <span className="text-xs font-medium text-muted-foreground">Consumed (Mounted)</span>
                <span className="text-sm font-bold text-foreground">
                  {summary.diamond.consumedCts.toFixed(2)} ct <span className="text-[10px] font-normal text-muted-foreground">({summary.diamond.consumedPcs} pcs)</span>
                </span>
              </div>
              <div className="flex justify-between items-center p-4">
                <span className="text-xs font-medium text-muted-foreground">Unused Returns</span>
                <div className="text-right">
                  <div className="text-sm font-bold text-emerald-600">{summary.diamond.returnedCts.toFixed(2)} ct <span className="text-[10px] font-normal">Returned</span></div>
                </div>
              </div>
              <div className={`flex justify-between items-center p-4 bg-secondary/10 ${!isDiamondSettled && 'bg-blue-50/50'}`}>
                <span className="text-xs font-black uppercase tracking-widest text-foreground">Pending Liability</span>
                <span className={`text-lg font-black tracking-tighter ${isDiamondSettled ? 'text-emerald-600' : 'text-blue-600'}`}>
                  {summary.diamond.remainingCts.toFixed(2)} ct
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

      </div>

      {/* --- DETAILED AUDIT LOGS (NEW SECTION) --- */}
      <Card className="shadow-sm border-border/60">
        <CardHeader className="bg-secondary/30 py-3 px-4 border-b border-border/40">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <History className="w-4 h-4 text-muted-foreground" />
            Detailed Transaction Ledger
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Tabs defaultValue="gold_logs" className="w-full">
            <TabsList className="w-full grid grid-cols-2 rounded-none border-b h-11 bg-transparent">
              <TabsTrigger value="gold_logs" className="text-xs font-bold uppercase tracking-widest data-[state=active]:border-b-2 data-[state=active]:border-amber-500 rounded-none text-slate-500 data-[state=active]:text-amber-700">Gold Audit Trail</TabsTrigger>
              <TabsTrigger value="diamond_logs" className="text-xs font-bold uppercase tracking-widest data-[state=active]:border-b-2 data-[state=active]:border-blue-500 rounded-none text-slate-500 data-[state=active]:text-blue-700">Diamond Audit Trail</TabsTrigger>
            </TabsList>
            
            {/* GOLD LOGS */}
            <TabsContent value="gold_logs" className="m-0 overflow-x-auto">
              <Table className="text-xs min-w-[700px]">
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead className="w-24 text-[10px] uppercase font-bold text-slate-500">Date</TableHead>
                    <TableHead className="w-24 text-[10px] uppercase font-bold text-slate-500">Type</TableHead>
                    <TableHead className="text-[10px] uppercase font-bold text-slate-500">Reference</TableHead>
                    <TableHead className="text-right text-[10px] uppercase font-bold text-slate-500">Gross Wt</TableHead>
                    <TableHead className="text-right text-[10px] uppercase font-bold text-red-500 bg-red-50/50">Loss Wt</TableHead>
                    <TableHead className="text-center text-[10px] uppercase font-bold text-slate-500 bg-slate-50 border-x">Conversion Logic</TableHead>
                    <TableHead className="text-right text-[10px] uppercase font-black text-amber-700">Fine Impact (24K)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {goldLogs.map((log, idx) => (
                    <TableRow key={idx} className="hover:bg-slate-50/50">
                      <TableCell className="text-muted-foreground">{new Date(log.date).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={
                          log.type === 'ISSUED' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                          log.type === 'CONSUMED' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                          'bg-blue-50 text-blue-700 border-blue-200'
                        }>{log.type}</Badge>
                      </TableCell>
                      <TableCell className="font-mono font-medium">{log.ref}</TableCell>
                      <TableCell className="text-right">{log.gross.toFixed(3)}g</TableCell>
                      <TableCell className="text-right text-red-600 bg-red-50/20">{log.loss > 0 ? `+${log.loss.toFixed(3)}g` : '-'}</TableCell>
                      <TableCell className="text-center font-mono text-[10px] text-slate-500 bg-slate-50/50 border-x">
                         {((log.gross + log.loss)).toFixed(3)}g × {log.purityPct}% ({log.purityStr})
                      </TableCell>
                      <TableCell className={`text-right font-bold ${log.type === 'ISSUED' ? 'text-amber-600' : 'text-emerald-600'}`}>
                        {log.type === 'ISSUED' ? '+' : '-'}{log.fine.toFixed(3)}g
                      </TableCell>
                    </TableRow>
                  ))}
                  {goldLogs.length === 0 && <TableRow><TableCell colSpan={7} className="text-center py-6 text-muted-foreground">No gold transactions found.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </TabsContent>

            {/* DIAMOND LOGS */}
            <TabsContent value="diamond_logs" className="m-0 overflow-x-auto">
              <Table className="text-xs min-w-[500px]">
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead className="w-24 text-[10px] uppercase font-bold text-slate-500">Date</TableHead>
                    <TableHead className="w-24 text-[10px] uppercase font-bold text-slate-500">Type</TableHead>
                    <TableHead className="text-[10px] uppercase font-bold text-slate-500">Reference</TableHead>
                    <TableHead className="text-right text-[10px] uppercase font-bold text-slate-500">Pieces</TableHead>
                    <TableHead className="text-right text-[10px] uppercase font-black text-blue-700">Carat Impact</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {diamondLogs.map((log, idx) => (
                    <TableRow key={idx} className="hover:bg-slate-50/50">
                      <TableCell className="text-muted-foreground">{new Date(log.date).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={
                          log.type === 'ISSUED' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                          log.type === 'CONSUMED' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                          'bg-blue-50 text-blue-700 border-blue-200'
                        }>{log.type}</Badge>
                      </TableCell>
                      <TableCell className="font-mono font-medium">{log.ref}</TableCell>
                      <TableCell className="text-right">{log.pcs}</TableCell>
                      <TableCell className={`text-right font-bold ${log.type === 'ISSUED' ? 'text-amber-600' : 'text-blue-600'}`}>
                        {log.type === 'ISSUED' ? '+' : '-'}{log.cts.toFixed(2)}ct
                      </TableCell>
                    </TableRow>
                  ))}
                  {diamondLogs.length === 0 && <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground">No diamond transactions found.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* --- RETURN MATERIALS MODAL --- */}
      <Dialog open={isReturnModalOpen} onOpenChange={setIsReturnModalOpen}>
        <DialogContent className="sm:max-w-[450px] p-0 overflow-hidden bg-white">
          <DialogHeader className="p-5 border-b border-border/40 bg-secondary/10">
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <ArrowRightLeft className="w-4 h-4 text-primary" /> Return Materials to Vault
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Select the original source batch/lot to restock the unconsumed materials.
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="gold" className="w-full">
            <TabsList className="w-full grid grid-cols-2 rounded-none border-b h-11 bg-transparent">
              <TabsTrigger value="gold" className="text-xs font-bold uppercase tracking-widest data-[state=active]:border-b-2 data-[state=active]:border-amber-500 rounded-none">Gold</TabsTrigger>
              <TabsTrigger value="diamond" className="text-xs font-bold uppercase tracking-widest data-[state=active]:border-b-2 data-[state=active]:border-blue-500 rounded-none">Diamonds</TabsTrigger>
            </TabsList>

            {/* GOLD RETURN FORM */}
            <TabsContent value="gold" className="p-5 space-y-4 m-0">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-600">Original Source Batch</Label>
                <Select value={returnGoldBatchId} onValueChange={handleGoldBatchChange}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Select batch to return to..." /></SelectTrigger>
                  <SelectContent>
                    {issuedGoldBatches.length === 0 && <SelectItem value="none" disabled>No batches found</SelectItem>}
                    {issuedGoldBatches.map(b => (
                      <SelectItem key={b.id} value={b.id}>{b.batch_number} ({b.purity})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-600 flex justify-between">
                  <span>Weight to Return (Gross g)</span>
                  <span className="text-[10px] text-amber-600 font-normal">Auto-calculated from remaining liability</span>
                </Label>
                <Input 
                  type="number" step="0.001" placeholder="e.g. 1.500" 
                  value={returnGoldWt} onChange={(e) => setReturnGoldWt(e.target.value)} 
                />
              </div>
              <Button onClick={handleReturnGold} disabled={isReturning} className="w-full mt-2 font-bold bg-amber-500 hover:bg-amber-600 text-white">
                {isReturning ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Coins className="w-4 h-4 mr-2" />} Submit Gold Return
              </Button>
            </TabsContent>

            {/* DIAMOND RETURN FORM */}
            <TabsContent value="diamond" className="p-5 space-y-4 m-0">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-600">Original Source Lot</Label>
                <Select value={returnDiaLotId} onValueChange={handleDiamondLotChange}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Select lot to return to..." /></SelectTrigger>
                  <SelectContent>
                    {issuedDiamondLots.length === 0 && <SelectItem value="none" disabled>No lots found</SelectItem>}
                    {issuedDiamondLots.map(l => (
                      <SelectItem key={l.id} value={l.id}>{l.lot_number} ({l.shape})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-600">Return Carats</Label>
                  <Input 
                    type="number" step="0.01" placeholder="e.g. 0.50" 
                    value={returnDiaCts} onChange={(e) => setReturnDiaCts(e.target.value)} 
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-600">Return Pieces</Label>
                  <Input 
                    type="number" placeholder="e.g. 2" 
                    value={returnDiaPcs} onChange={(e) => setReturnDiaPcs(e.target.value)} 
                  />
                </div>
              </div>
              <Button onClick={handleReturnDiamond} disabled={isReturning} className="w-full mt-2 font-bold bg-blue-600 hover:bg-blue-700 text-white">
                {isReturning ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Diamond className="w-4 h-4 mr-2" />} Submit Diamond Return
              </Button>
            </TabsContent>
          </Tabs>

        </DialogContent>
      </Dialog>

    </div>
  )
}