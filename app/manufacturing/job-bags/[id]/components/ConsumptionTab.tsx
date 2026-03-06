"use client"

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { toast } from 'sonner'
import { Loader2, Calculator, Coins, Diamond, Save } from 'lucide-react'

interface Props {
  jobId: string
  refresh: () => void
}

export default function ConsumptionTab({ jobId, refresh }: Props) {
  const [issuedGold, setIssuedGold] = useState<any[]>([])
  const [issuedDiamonds, setIssuedDiamonds] = useState<any[]>([])
  const [loadingData, setLoadingData] = useState(true)
  const [saving, setSaving] = useState(false)

  // --- GOLD STATE ---
  const [goldBatchId, setGoldBatchId] = useState('')
  const [targetPurityPercent, setTargetPurityPercent] = useState('91.6') // Default 22K
  const [producedWeight, setProducedWeight] = useState('')
  const [wastageWeight, setWastageWeight] = useState('0')
  const [calculatedBatchConsumed, setCalculatedBatchConsumed] = useState('0')
  const [calculatedBatchLoss, setCalculatedBatchLoss] = useState('0')

  // --- DIAMOND STATE ---
  const [diamondLotId, setDiamondLotId] = useState('')
  const [diamondConsumed, setDiamondConsumed] = useState('')
  const [diamondBreakage, setDiamondBreakage] = useState('0')
  const [diamondPieces, setDiamondPieces] = useState('0')

  const loadIssuedMaterials = useCallback(async () => {
    setLoadingData(true)
    try {
      const { data: goldData } = await supabase
        .from('job_bag_gold_issues')
        .select(`gold_batch_id, issued_weight_g, inventory_gold_batches ( batch_number, purity_karat, purity_percent )`)
        .eq('job_bag_id', jobId)

      const { data: diamondData } = await supabase
        .from('job_bag_diamond_issues')
        .select(`diamond_lot_id, issued_weight_cts, issued_pieces, inventory_diamond_lots ( lot_number, shape, color, clarity )`)
        .eq('job_bag_id', jobId)

      setIssuedGold(goldData || [])
      setIssuedDiamonds(diamondData || [])
    } catch (err) {
      toast.error("Failed to load material context")
    } finally {
      setLoadingData(false)
    }
  }, [jobId])

  useEffect(() => { loadIssuedMaterials() }, [loadIssuedMaterials])

  // ==========================================================
  // SMART PURITY CALCULATOR (Runs automatically)
  // ==========================================================
  useEffect(() => {
    if (!goldBatchId) {
      setCalculatedBatchConsumed('0')
      setCalculatedBatchLoss('0')
      return
    }

    const selectedIssue = issuedGold.find(g => g.gold_batch_id === goldBatchId)
    const batchPurity = selectedIssue?.inventory_gold_batches?.purity_percent || 100

    const produced = parseFloat(producedWeight) || 0
    const loss = parseFloat(wastageWeight) || 0
    const targetPurity = parseFloat(targetPurityPercent) || 0

    // 1. Convert to Fine Gold (Pure Gold weight inside the 22K ornament)
    const fineGoldInOrnament = produced * (targetPurity / 100)
    const fineGoldInLoss = loss * (targetPurity / 100)

    // 2. Convert back to the Issued Batch's weight equivalent
    const batchEquivalentConsumed = fineGoldInOrnament / (batchPurity / 100)
    const batchEquivalentLoss = fineGoldInLoss / (batchPurity / 100)

    setCalculatedBatchConsumed(batchEquivalentConsumed.toFixed(3))
    setCalculatedBatchLoss(batchEquivalentLoss.toFixed(3))

  }, [goldBatchId, producedWeight, wastageWeight, targetPurityPercent, issuedGold])

  async function recordGoldConsumption() {
    if (!goldBatchId || parseFloat(calculatedBatchConsumed) <= 0) {
      return toast.error('Validation Error', { description: 'Select a source batch and enter produced weight.' })
    }
    
    setSaving(true)
    try {
      const { error } = await supabase
        .from('job_bag_gold_consumption')
        .insert({
          job_bag_id: jobId,
          gold_batch_id: goldBatchId,
          consumed_weight_g: Number(calculatedBatchConsumed),
          loss_weight_g: Number(calculatedBatchLoss)
        })

      if (error) throw error
      
      toast.success('Gold Consumption Registered')
      setGoldBatchId(''); setProducedWeight(''); setWastageWeight('0')
      refresh()
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function recordDiamondConsumption() {
    if (!diamondLotId || !diamondConsumed) {
      return toast.error('Validation Error', { description: 'Select a source lot and enter consumed carat weight.' })
    }

    setSaving(true)
    try {
      const { error } = await supabase
        .from('job_bag_diamond_consumption')
        .insert({
          job_bag_id: jobId, 
          diamond_lot_id: diamondLotId,
          consumed_weight_cts: Number(diamondConsumed), 
          breakage_weight_cts: Number(diamondBreakage),
          consumed_pieces: Number(diamondPieces)
        })

      if (error) throw error

      toast.success('Diamond Consumption Registered')
      setDiamondLotId(''); setDiamondConsumed(''); setDiamondBreakage('0'); setDiamondPieces('0')
      refresh()
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (loadingData) {
    return (
      <div className="grid gap-6 md:grid-cols-2">
        <Skeleton className="h-[380px] w-full rounded-xl border border-border/40" />
        <Skeleton className="h-[380px] w-full rounded-xl border border-border/40" />
      </div>
    )
  }

  return (
    <div className="grid lg:grid-cols-2 gap-6">

      {/* GOLD CONSUMPTION */}
      <Card className="shadow-none border-border/60 bg-card overflow-hidden h-fit">
        <CardHeader className="bg-amber-500/5 py-3 px-4 border-b border-amber-200/50 flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <Coins className="h-4 w-4 text-amber-600" />
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-amber-700">Record Gold Fabrication</h3>
          </div>
          <Calculator className="h-3.5 w-3.5 text-amber-600/50" />
        </CardHeader>
        <CardContent className="p-5 space-y-6">
          
          <div className="space-y-1.5">
            <Label className="text-[10px] font-bold text-muted-foreground uppercase">Source Batch (Issued)</Label>
            <Select value={goldBatchId} onValueChange={setGoldBatchId}>
              <SelectTrigger className="h-9 text-xs border-border bg-muted/20">
                <SelectValue placeholder="Identify Gold Batch..." />
              </SelectTrigger>
              <SelectContent>
                {issuedGold.length === 0 && <SelectItem value="empty" disabled className="text-xs">No gold issued to this job</SelectItem>}
                {issuedGold.map((issue, idx) => (
                  <SelectItem key={idx} value={issue.gold_batch_id} className="text-xs font-medium">
                    <div className="flex items-center justify-between w-full gap-4">
                      <span>{issue.inventory_gold_batches?.batch_number} <span className="text-muted-foreground ml-1">({issue.inventory_gold_batches?.purity_karat})</span></span>
                      <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded uppercase">
                        Issued: {issue.issued_weight_g}g
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Separator className="bg-border/60" />

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold text-muted-foreground uppercase">Target Output Purity</Label>
              <Select value={targetPurityPercent} onValueChange={setTargetPurityPercent}>
                <SelectTrigger className="h-9 text-xs border-border bg-card">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="99.9" className="text-xs">24K (99.9%)</SelectItem>
                  <SelectItem value="91.6" className="text-xs font-bold text-foreground bg-muted/50">22K (91.6%)</SelectItem>
                  <SelectItem value="75.0" className="text-xs">18K (75.0%)</SelectItem>
                  <SelectItem value="58.3" className="text-xs">14K (58.3%)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold text-muted-foreground uppercase">Produced Weight (g)</Label>
              <Input type="number" step="0.001" placeholder="0.000" className="h-9 text-sm font-bold border-border bg-muted/20" value={producedWeight} onChange={(e) => setProducedWeight(e.target.value)} />
            </div>
            <div className="space-y-1.5 col-span-2 sm:col-span-1">
              <Label className="text-[10px] font-bold text-muted-foreground uppercase">Dust / Wastage (g)</Label>
              <Input type="number" step="0.001" placeholder="0.000" className="h-9 text-sm font-bold border-border bg-muted/20" value={wastageWeight} onChange={(e) => setWastageWeight(e.target.value)} />
            </div>
          </div>

          {/* SMART CALCULATOR UI - IDE STYLE */}
          <div className={`p-4 rounded-xl border transition-all duration-300 ${goldBatchId ? 'bg-amber-50/30 border-amber-200/60' : 'bg-muted/20 border-border/40 opacity-50'}`}>
             <div className="flex items-center gap-2 mb-3">
                <Calculator className="h-3.5 w-3.5 text-amber-600" />
                <span className="text-[9px] font-bold uppercase tracking-widest text-amber-700">Conversion Ledger</span>
             </div>
             <div className="space-y-2">
                <div className="flex justify-between items-center text-xs">
                   <span className="font-medium text-muted-foreground">Source Batch Deduction</span>
                   <span className="font-bold text-foreground font-mono">{calculatedBatchConsumed}g</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                   <span className="font-medium text-muted-foreground">Wastage Deduction</span>
                   <span className="font-bold text-red-600 font-mono">{calculatedBatchLoss}g</span>
                </div>
             </div>
          </div>

          <Button 
            onClick={recordGoldConsumption} 
            disabled={saving || !goldBatchId || parseFloat(calculatedBatchConsumed) <= 0} 
            className="w-full h-10 font-bold text-xs uppercase tracking-widest shadow-md bg-amber-600 hover:bg-amber-700 text-white transition-all"
          >
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Commit Gold Fabrication
          </Button>
        </CardContent>
      </Card>

      {/* DIAMOND CONSUMPTION */}
      <Card className="shadow-none border-border/60 bg-card overflow-hidden h-fit">
        <CardHeader className="bg-blue-500/5 py-3 px-4 border-b border-blue-200/50">
          <div className="flex items-center gap-2">
            <Diamond className="h-4 w-4 text-blue-600" />
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-blue-700">Record Stone Set</h3>
          </div>
        </CardHeader>
        <CardContent className="p-5 space-y-6">
          
          <div className="space-y-1.5">
            <Label className="text-[10px] font-bold text-muted-foreground uppercase">Source Lot (Issued)</Label>
            <Select value={diamondLotId} onValueChange={setDiamondLotId}>
              <SelectTrigger className="h-9 text-xs border-border bg-muted/20">
                <SelectValue placeholder="Identify Diamond Lot..." />
              </SelectTrigger>
              <SelectContent>
                {issuedDiamonds.length === 0 && <SelectItem value="empty" disabled className="text-xs">No stones issued to this job</SelectItem>}
                {issuedDiamonds.map((issue, idx) => (
                  <SelectItem key={idx} value={issue.diamond_lot_id} className="text-xs font-medium">
                    <div className="flex items-center justify-between w-full gap-4">
                      <span>{issue.inventory_diamond_lots?.lot_number} <span className="text-muted-foreground ml-1">({issue.inventory_diamond_lots?.shape})</span></span>
                      <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded uppercase">
                        Issued: {issue.issued_weight_cts}ct
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold text-muted-foreground uppercase">Carats Set</Label>
              <Input type="number" step="0.01" placeholder="0.00" className="h-9 text-sm font-bold border-border bg-muted/20" value={diamondConsumed} onChange={(e) => setDiamondConsumed(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold text-muted-foreground uppercase">Pieces Used</Label>
              <Input type="number" placeholder="0" className="h-9 text-sm border-border bg-muted/20" value={diamondPieces} onChange={(e) => setDiamondPieces(e.target.value)} />
            </div>
            <div className="space-y-1.5 col-span-2 md:col-span-1">
              <Label className="text-[10px] font-bold text-muted-foreground uppercase">Breakage (ct)</Label>
              <Input type="number" step="0.01" placeholder="0.00" className="h-9 text-sm font-bold border-red-200 bg-red-50/30 text-red-700" value={diamondBreakage} onChange={(e) => setDiamondBreakage(e.target.value)} />
            </div>
          </div>

          <Button 
            onClick={recordDiamondConsumption} 
            disabled={saving || !diamondLotId || !diamondConsumed} 
            className="w-full h-10 font-bold text-xs uppercase tracking-widest shadow-md bg-blue-600 hover:bg-blue-700 text-white transition-all mt-4"
          >
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Commit Stone Setting
          </Button>
        </CardContent>
      </Card>

    </div>
  )
}