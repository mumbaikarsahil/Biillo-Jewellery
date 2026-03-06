"use client"

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/hooks/useAuth'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { toast } from 'sonner'
import { Coins, Diamond, Loader2, Send } from 'lucide-react'

type Props = {
  jobId: string
  refresh: () => Promise<void>
}

export default function IssueTab({ jobId, refresh }: Props) {
  const { appUser } = useAuth()

  const [goldBatches, setGoldBatches] = useState<any[]>([])
  const [diamondLots, setDiamondLots] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [selectedGold, setSelectedGold] = useState('')
  const [goldWeight, setGoldWeight] = useState('')

  const [selectedDiamond, setSelectedDiamond] = useState('')
  const [diamondWeight, setDiamondWeight] = useState('')
  const [diamondPieces, setDiamondPieces] = useState('')

  // ---------------- LOAD INVENTORY ----------------
  const loadInventory = useCallback(async () => {
    if (!appUser?.company_id) return
    setLoading(true)

    try {
      const { data: gold, error: goldErr } = await supabase
        .from('inventory_gold_batches')
        .select('*')
        .eq('company_id', appUser.company_id)
        .gt('remaining_weight_g', 0)

      if (goldErr) throw goldErr

      const { data: diamonds, error: diamondErr } = await supabase
        .from('inventory_diamond_lots')
        .select('*')
        .eq('company_id', appUser.company_id)
        .gt('remaining_weight_cts', 0)

      if (diamondErr) throw diamondErr

      setGoldBatches(gold || [])
      setDiamondLots(diamonds || [])
    } catch (err: any) {
      toast.error(`Sync Error: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }, [appUser?.company_id])

  useEffect(() => {
    loadInventory()
  }, [loadInventory])

  // ---------------- ISSUE GOLD ----------------
  async function issueGold() {
    if (!selectedGold || !goldWeight) {
      toast.error('Material Selection Required', { description: 'Select a batch and enter the weight to issue.' })
      return
    }

    try {
      setIsSubmitting(true)
      const { error } = await supabase.rpc('issue_gold_to_job', {
        p_job_bag_id: jobId,
        p_gold_batch_id: selectedGold,
        p_weight_g: Number(goldWeight)
      })

      if (error) throw error

      toast.success('Gold Material Dispatched')
      setSelectedGold('')
      setGoldWeight('')
      await refresh()
      await loadInventory() 
      
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  // ---------------- ISSUE DIAMOND ----------------
  async function issueDiamond() {
    if (!selectedDiamond || !diamondWeight) {
      toast.error('Material Selection Required', { description: 'Select a lot and enter the carat weight to issue.' })
      return
    }

    try {
      setIsSubmitting(true)
      const { error } = await supabase.rpc('issue_diamond_to_job', {
        p_job_bag_id: jobId,
        p_diamond_lot_id: selectedDiamond,
        p_weight_cts: Number(diamondWeight),
        p_pieces: Number(diamondPieces || 0)
      })

      if (error) throw error

      toast.success('Diamond Material Dispatched')
      setSelectedDiamond('')
      setDiamondWeight('')
      setDiamondPieces('')
      await refresh() 
      await loadInventory() 

    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="grid gap-6 md:grid-cols-2">
        <Skeleton className="h-[250px] w-full rounded-xl border border-border/40" />
        <Skeleton className="h-[250px] w-full rounded-xl border border-border/40" />
      </div>
    )
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">

      {/* GOLD ISSUE CARD */}
      <Card className="shadow-none border-border/60 bg-card overflow-hidden h-fit">
        <CardHeader className="bg-amber-500/5 py-3 px-4 border-b border-amber-200/50">
          <div className="flex items-center gap-2">
            <Coins className="h-4 w-4 text-amber-600" />
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-amber-700">Dispatch Gold Material</h3>
          </div>
        </CardHeader>
        <CardContent className="p-5 space-y-5">
          
          <div className="space-y-1.5">
            <Label className="text-[10px] font-bold text-muted-foreground uppercase">Source Batch</Label>
            <Select value={selectedGold} onValueChange={setSelectedGold}>
              <SelectTrigger className="h-9 text-xs border-border bg-muted/20">
                <SelectValue placeholder="Identify Gold Batch..." />
              </SelectTrigger>
              <SelectContent>
                {goldBatches.length === 0 && (
                   <SelectItem value="empty" disabled className="text-xs">Zero inventory available</SelectItem>
                )}
                {goldBatches.map(batch => (
                  <SelectItem key={batch.id} value={batch.id} className="text-xs font-medium">
                    <div className="flex items-center justify-between w-full gap-4">
                      <span>{batch.batch_number} <span className="text-muted-foreground ml-1">({batch.purity_karat})</span></span>
                      <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded uppercase">
                        {batch.remaining_weight_g}g Avail.
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[10px] font-bold text-muted-foreground uppercase">Allocation Weight (g)</Label>
            <Input
              type="number"
              step="0.001"
              placeholder="0.000"
              className="h-9 text-sm font-bold border-border bg-muted/20"
              value={goldWeight}
              onChange={(e) => setGoldWeight(e.target.value)}
            />
          </div>

          <Button 
            onClick={issueGold} 
            disabled={isSubmitting || !selectedGold || !goldWeight} 
            className="w-full h-10 font-bold text-xs uppercase tracking-widest shadow-md bg-amber-600 hover:bg-amber-700 text-white transition-all"
          >
            {isSubmitting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Send className="mr-2 h-4 w-4" />
            )}
            Authorize Transfer
          </Button>
        </CardContent>
      </Card>

      {/* DIAMOND ISSUE CARD */}
      <Card className="shadow-none border-border/60 bg-card overflow-hidden h-fit">
        <CardHeader className="bg-blue-500/5 py-3 px-4 border-b border-blue-200/50">
          <div className="flex items-center gap-2">
            <Diamond className="h-4 w-4 text-blue-600" />
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-blue-700">Dispatch Diamond Material</h3>
          </div>
        </CardHeader>
        <CardContent className="p-5 space-y-5">
          
          <div className="space-y-1.5">
            <Label className="text-[10px] font-bold text-muted-foreground uppercase">Source Lot</Label>
            <Select value={selectedDiamond} onValueChange={setSelectedDiamond}>
              <SelectTrigger className="h-9 text-xs border-border bg-muted/20">
                <SelectValue placeholder="Identify Diamond Lot..." />
              </SelectTrigger>
              <SelectContent>
                {diamondLots.length === 0 && (
                   <SelectItem value="empty" disabled className="text-xs">Zero inventory available</SelectItem>
                )}
                {diamondLots.map(lot => (
                  <SelectItem key={lot.id} value={lot.id} className="text-xs font-medium">
                    <div className="flex items-center justify-between w-full gap-4">
                      <span>{lot.lot_number} <span className="text-muted-foreground ml-1">({lot.shape})</span></span>
                      <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded uppercase">
                        {lot.remaining_weight_cts}ct Avail.
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold text-muted-foreground uppercase">Carat Weight (ct)</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="0.00"
                className="h-9 text-sm font-bold border-border bg-muted/20"
                value={diamondWeight}
                onChange={(e) => setDiamondWeight(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold text-muted-foreground uppercase">Pieces (Optional)</Label>
              <Input
                type="number"
                placeholder="0"
                className="h-9 text-sm border-border bg-muted/20"
                value={diamondPieces}
                onChange={(e) => setDiamondPieces(e.target.value)}
              />
            </div>
          </div>

          <Button 
            onClick={issueDiamond} 
            disabled={isSubmitting || !selectedDiamond || !diamondWeight} 
            className="w-full h-10 font-bold text-xs uppercase tracking-widest shadow-md bg-blue-600 hover:bg-blue-700 text-white transition-all"
          >
            {isSubmitting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Send className="mr-2 h-4 w-4" />
            )}
            Authorize Transfer
          </Button>
        </CardContent>
      </Card>

    </div>
  )
}