"use client"

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Scale, Coins, Diamond, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'

interface Props {
  jobId: string
}

export default function ReconciliationTab({ jobId }: Props) {
  const [loading, setLoading] = useState(true)
  const [summary, setSummary] = useState<any>(null)

  const fetchSummary = useCallback(async () => {
    setLoading(true)
    try {
      // --- FETCH GOLD ---
      const { data: goldIssues } = await supabase.from('job_bag_gold_issues').select('issued_weight_g').eq('job_bag_id', jobId)
      const { data: goldConsumption } = await supabase.from('job_bag_gold_consumption').select('consumed_weight_g, loss_weight_g').eq('job_bag_id', jobId)

      const totalGoldIssued = goldIssues?.reduce((a, b) => a + Number(b.issued_weight_g), 0) || 0
      const totalGoldConsumed = goldConsumption?.reduce((a, b) => a + Number(b.consumed_weight_g), 0) || 0
      const totalGoldLoss = goldConsumption?.reduce((a, b) => a + Number(b.loss_weight_g), 0) || 0
      const remainingGold = totalGoldIssued - totalGoldConsumed - totalGoldLoss

      // --- FETCH DIAMONDS ---
      const { data: diamondIssues } = await supabase.from('job_bag_diamond_issues').select('issued_weight_cts, issued_pieces').eq('job_bag_id', jobId)
      const { data: diamondConsumption } = await supabase.from('job_bag_diamond_consumption').select('consumed_weight_cts, consumed_pieces, breakage_weight_cts').eq('job_bag_id', jobId)
      const { data: diamondReturns } = await supabase.from('job_bag_diamond_returns').select('returned_weight_cts, returned_pieces').eq('job_bag_id', jobId)

      const diaIssuedCts = diamondIssues?.reduce((a, b) => a + Number(b.issued_weight_cts), 0) || 0
      const diaIssuedPcs = diamondIssues?.reduce((a, b) => a + Number(b.issued_pieces), 0) || 0

      const diaConsumedCts = diamondConsumption?.reduce((a, b) => a + Number(b.consumed_weight_cts), 0) || 0
      const diaBreakageCts = diamondConsumption?.reduce((a, b) => a + Number(b.breakage_weight_cts), 0) || 0
      const diaConsumedPcs = diamondConsumption?.reduce((a, b) => a + Number(b.consumed_pieces), 0) || 0

      const diaReturnedCts = diamondReturns?.reduce((a, b) => a + Number(b.returned_weight_cts), 0) || 0
      const diaReturnedPcs = diamondReturns?.reduce((a, b) => a + Number(b.returned_pieces), 0) || 0

      const remainingDiaCts = diaIssuedCts - diaConsumedCts - diaReturnedCts - diaBreakageCts
      const remainingDiaPcs = diaIssuedPcs - diaConsumedPcs - diaReturnedPcs

      setSummary({
        gold: {
          issued: totalGoldIssued,
          consumed: totalGoldConsumed,
          loss: totalGoldLoss,
          remaining: remainingGold
        },
        diamond: {
          issuedCts: diaIssuedCts,
          issuedPcs: diaIssuedPcs,
          consumedCts: diaConsumedCts,
          consumedPcs: diaConsumedPcs,
          returnedCts: diaReturnedCts,
          breakageCts: diaBreakageCts,
          remainingCts: remainingDiaCts,
          remainingPcs: remainingDiaPcs
        }
      })
    } catch (error: any) {
      toast.error('Failed to load reconciliation data', { description: error.message })
    } finally {
      setLoading(false)
    }
  }, [jobId])

  useEffect(() => {
    fetchSummary()
  }, [fetchSummary])

  if (loading || !summary) {
    return (
      <div className="grid gap-4 md:grid-cols-2 max-w-5xl mx-auto">
        <Skeleton className="h-[250px] w-full rounded-xl border border-border/40" />
        <Skeleton className="h-[250px] w-full rounded-xl border border-border/40" />
      </div>
    )
  }

  const isGoldSettled = Math.abs(summary.gold.remaining) < 0.005; // Account for floating point rounding
  const isDiamondSettled = Math.abs(summary.diamond.remainingCts) < 0.005 && summary.diamond.remainingPcs === 0;
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
           <p className="text-xs text-muted-foreground mt-1">Verify that all issued materials have been consumed, lost, or returned.</p>
         </div>
         
         {isFullySettled ? (
           <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 px-3 py-1 text-[11px] uppercase tracking-widest font-bold">
             <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> Fully Reconciled
           </Badge>
         ) : (
           <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200 px-3 py-1 text-[11px] uppercase tracking-widest font-bold">
             <AlertTriangle className="w-3.5 h-3.5 mr-1.5" /> Outstanding Liability
           </Badge>
         )}
      </div>

      <div className="grid gap-4 md:grid-cols-2 items-start">
        
        {/* GOLD RECONCILIATION */}
        <Card className={`shadow-sm overflow-hidden border ${isGoldSettled ? 'border-border/60' : 'border-amber-300 shadow-amber-500/10'}`}>
          <div className="bg-secondary/30 py-2.5 px-4 border-b border-border/40 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Coins className="h-3.5 w-3.5 text-amber-500" />
              <h3 className="text-[11px] font-bold uppercase tracking-widest text-foreground">Gold Ledger</h3>
            </div>
            {isGoldSettled ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <AlertTriangle className="w-4 h-4 text-amber-500" />}
          </div>
          <CardContent className="p-0">
            <div className="divide-y divide-border/40">
              <div className="flex justify-between items-center p-4">
                <span className="text-xs font-medium text-muted-foreground">Total Issued</span>
                <span className="text-sm font-bold text-foreground">{summary.gold.issued.toFixed(3)} g</span>
              </div>
              <div className="flex justify-between items-center p-4">
                <span className="text-xs font-medium text-muted-foreground">Consumed (Mounted)</span>
                <span className="text-sm font-bold text-foreground">{summary.gold.consumed.toFixed(3)} g</span>
              </div>
              <div className="flex justify-between items-center p-4">
                <span className="text-xs font-medium text-muted-foreground">Recorded Melt Loss</span>
                <span className="text-sm font-bold text-rose-600">{summary.gold.loss.toFixed(3)} g</span>
              </div>
              <div className={`flex justify-between items-center p-4 bg-secondary/10 ${!isGoldSettled && 'bg-amber-50/50'}`}>
                <span className="text-xs font-black uppercase tracking-widest text-foreground">Pending Liability</span>
                <span className={`text-lg font-black tracking-tighter ${isGoldSettled ? 'text-emerald-600' : 'text-amber-600'}`}>
                  {summary.gold.remaining.toFixed(3)} g
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* DIAMOND RECONCILIATION */}
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
                <span className="text-xs font-medium text-muted-foreground">Unused Returns & Breakage</span>
                <div className="text-right">
                  <div className="text-sm font-bold text-emerald-600">{summary.diamond.returnedCts.toFixed(2)} ct <span className="text-[10px] font-normal">Returned</span></div>
                  {summary.diamond.breakageCts > 0 && <div className="text-xs font-bold text-rose-600 mt-0.5">{summary.diamond.breakageCts.toFixed(2)} ct <span className="text-[9px] font-normal">Broken</span></div>}
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

      {!isFullySettled && (
        <div className="p-4 bg-secondary/20 border border-border/60 rounded-xl flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
          <div>
            <h4 className="text-xs font-bold text-foreground uppercase tracking-widest">Reconciliation Pending</h4>
            <p className="text-[11px] text-muted-foreground mt-1">
              This Job Bag cannot be closed yet. The Karigar must either return the remaining raw materials to the vault or report them as officially lost/broken to balance the ledger.
            </p>
          </div>
        </div>
      )}

    </div>
  )
}