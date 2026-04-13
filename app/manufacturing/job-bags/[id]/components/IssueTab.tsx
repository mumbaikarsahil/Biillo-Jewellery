"use client"

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/hooks/useAuth'
import { Card, CardContent } from '@/components/ui/card'
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
import { Coins, Diamond, Loader2, ArrowLeft, ArrowRight } from 'lucide-react'

export interface JobBagItem {
  id: string;
  sku_reference: string;
  ornament_type: string;
}

type Props = {
  jobId: string
  refresh: () => Promise<void>
}

export default function IssueTab({ jobId, refresh }: Props) {
  const { appUser } = useAuth()

  const [goldBatches, setGoldBatches] = useState<any[]>([])
  const [diamondLots, setDiamondLots] = useState<any[]>([])
  const [jobBagItems, setJobBagItems] = useState<JobBagItem[]>([])
  const [loading, setLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Gold State
  const [selectedGold, setSelectedGold] = useState('')
  const [goldWeight, setGoldWeight] = useState('')
  const [selectedGoldItem, setSelectedGoldItem] = useState('unassigned')

  // Diamond State
  const [selectedDiamond, setSelectedDiamond] = useState('')
  const [diamondWeight, setDiamondWeight] = useState('')
  const [diamondPieces, setDiamondPieces] = useState('')
  const [selectedDiamondItem, setSelectedDiamondItem] = useState('unassigned')

  // ---------------- LOAD INVENTORY & SKUS ----------------
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

      const { data: items, error: itemsErr } = await supabase
        .from('job_bag_items')
        .select('id, sku_reference, ornament_type')
        .eq('job_bag_id', jobId)
        .order('created_at', { ascending: true })

      if (itemsErr) throw itemsErr

      setGoldBatches(gold || [])
      setDiamondLots(diamonds || [])
      setJobBagItems(items || [])
    } catch (err: any) {
      toast.error(`Sync Error: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }, [appUser?.company_id, jobId])

  useEffect(() => {
    loadInventory()
  }, [loadInventory])

  // ---------------- UNIFIED DISPATCH ----------------
  async function handleDispatchAll() {
    let goldSuccess = false
    let diamondSuccess = false

    if (!selectedGold && !selectedDiamond) {
      return toast.error('No Material Selected', { description: 'Please select either Gold or Diamonds to dispatch.' })
    }

    setIsSubmitting(true)

    try {
      if (selectedGold && goldWeight) {
        const { error: goldErr } = await supabase.rpc('issue_gold_to_job', {
          p_job_bag_id: jobId,
          p_gold_batch_id: selectedGold,
          p_weight_g: Number(goldWeight),
          p_job_bag_item_id: selectedGoldItem === 'unassigned' ? null : selectedGoldItem
        })
        if (goldErr) throw new Error(`Gold Error: ${goldErr.message}`)
        goldSuccess = true
      }

      if (selectedDiamond && diamondWeight) {
        const { error: diaErr } = await supabase.rpc('issue_diamond_to_job', {
          p_job_bag_id: jobId,
          p_diamond_lot_id: selectedDiamond,
          p_weight_cts: Number(diamondWeight),
          p_pieces: Number(diamondPieces || 0),
          p_job_bag_item_id: selectedDiamondItem === 'unassigned' ? null : selectedDiamondItem
        })
        if (diaErr) throw new Error(`Diamond Error: ${diaErr.message}`)
        diamondSuccess = true
      }

      if (goldSuccess || diamondSuccess) {
        toast.success('Materials Successfully Dispatched!')
        
        if (goldSuccess) {
          setSelectedGold('')
          setGoldWeight('')
          setSelectedGoldItem('unassigned')
        }
        if (diamondSuccess) {
          setSelectedDiamond('')
          setDiamondWeight('')
          setDiamondPieces('')
          setSelectedDiamondItem('unassigned')
        }

        // Only reload local data so the user STAYS on this page
        await loadInventory() 
      } else {
        toast.error('Incomplete form. Please enter weights for the selected materials.')
      }

    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between"><Skeleton className="h-8 w-48" /><Skeleton className="h-8 w-32" /></div>
        <div className="grid gap-4 md:grid-cols-2"><Skeleton className="h-[250px] rounded-xl" /><Skeleton className="h-[250px] rounded-xl" /></div>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300 max-w-5xl mx-auto">
      
      {/* HEADER: Sleek & Minimal */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-border/40">
         <div>
           <h2 className="text-lg font-bold tracking-tight text-foreground">Material Dispatch</h2>
           <p className="text-xs text-muted-foreground mt-1">Allocate raw vault materials securely to the active Job Bag.</p>
         </div>
         <Button variant="outline" size="sm" onClick={refresh} className="h-8 text-xs font-bold">
           <ArrowLeft className="w-3.5 h-3.5 mr-1.5" /> Return to Overview
         </Button>
      </div>

      {/* FORM GRID */}
      <div className="grid gap-4 md:grid-cols-2 items-start">
        
        {/* GOLD PANEL */}
        <Card className="shadow-sm border-border/60 overflow-hidden">
          <div className="bg-secondary/30 py-2.5 px-4 border-b border-border/40 flex items-center gap-2">
            <Coins className="h-3.5 w-3.5 text-amber-500" />
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-foreground">Gold Allocation</h3>
          </div>
          <CardContent className="p-4 space-y-4">
            
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold text-muted-foreground uppercase">Target SKU / Item</Label>
              <Select value={selectedGoldItem} onValueChange={setSelectedGoldItem}>
                <SelectTrigger className="h-8 text-xs bg-background">
                  <SelectValue placeholder="Select SKU to assign to..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned" className="text-xs italic text-muted-foreground">Bag Level (Unassigned)</SelectItem>
                  {jobBagItems.map(item => (
                    <SelectItem key={item.id} value={item.id} className="text-xs font-medium">
                      {item.sku_reference} {item.ornament_type ? `(${item.ornament_type})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold text-muted-foreground uppercase">Source Batch</Label>
              <Select value={selectedGold} onValueChange={setSelectedGold}>
                <SelectTrigger className="h-8 text-xs bg-background">
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
                        <span className="text-[10px] font-bold text-muted-foreground uppercase">
                          {batch.remaining_weight_g}g Avail
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold text-muted-foreground uppercase">Issue Weight (g)</Label>
              <Input
                type="number" step="0.001" placeholder="0.000"
                className="h-8 text-xs font-bold bg-background focus-visible:ring-primary shadow-sm"
                value={goldWeight} onChange={(e) => setGoldWeight(e.target.value)}
              />
            </div>

          </CardContent>
        </Card>

        {/* DIAMOND PANEL */}
        <Card className="shadow-sm border-border/60 overflow-hidden">
          <div className="bg-secondary/30 py-2.5 px-4 border-b border-border/40 flex items-center gap-2">
            <Diamond className="h-3.5 w-3.5 text-blue-500" />
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-foreground">Diamond Allocation</h3>
          </div>
          <CardContent className="p-4 space-y-4">
            
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold text-muted-foreground uppercase">Target SKU / Item</Label>
              <Select value={selectedDiamondItem} onValueChange={setSelectedDiamondItem}>
                <SelectTrigger className="h-8 text-xs bg-background">
                  <SelectValue placeholder="Select SKU to assign to..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned" className="text-xs italic text-muted-foreground">Bag Level (Unassigned)</SelectItem>
                  {jobBagItems.map(item => (
                    <SelectItem key={item.id} value={item.id} className="text-xs font-medium">
                      {item.sku_reference} {item.ornament_type ? `(${item.ornament_type})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold text-muted-foreground uppercase">Source Lot</Label>
              <Select value={selectedDiamond} onValueChange={setSelectedDiamond}>
                <SelectTrigger className="h-8 text-xs bg-background">
                  <SelectValue placeholder="Identify Diamond Lot..." />
                </SelectTrigger>
                <SelectContent>
                  {diamondLots.length === 0 && (
                     <SelectItem value="empty" disabled className="text-xs">Zero inventory available</SelectItem>
                  )}
                  {diamondLots.map(lot => {
                    // Combine the specs for the UI display
                    const specs = [lot.shape, lot.color, lot.clarity, lot.sieve_size].filter(Boolean).join(', ')
                    
                    return (
                      <SelectItem key={lot.id} value={lot.id} className="text-xs font-medium">
                        <div className="flex items-center justify-between w-full gap-4">
                          <div className="flex flex-col text-left">
                            <span>{lot.lot_number}</span>
                            {specs && <span className="text-[9px] text-muted-foreground">{specs}</span>}
                          </div>
                          <span className="text-[10px] font-bold text-muted-foreground uppercase shrink-0">
                            {lot.remaining_weight_cts}ct Avail
                          </span>
                        </div>
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold text-muted-foreground uppercase">Weight (ct)</Label>
                <Input
                  type="number" step="0.01" placeholder="0.00"
                  className="h-8 text-xs font-bold bg-background focus-visible:ring-primary shadow-sm"
                  value={diamondWeight} onChange={(e) => setDiamondWeight(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold text-muted-foreground uppercase">Pieces (Opt)</Label>
                <Input
                  type="number" placeholder="0"
                  className="h-8 text-xs bg-background shadow-sm"
                  value={diamondPieces} onChange={(e) => setDiamondPieces(e.target.value)}
                />
              </div>
            </div>

          </CardContent>
        </Card>

      </div>

      {/* ACTION BAR: Vercel Style */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
         <p className="text-[11px] text-muted-foreground">
           Fill out one or both material panels, then dispatch simultaneously.
         </p>
         <Button 
           onClick={handleDispatchAll} 
           disabled={isSubmitting || (!selectedGold && !selectedDiamond)} 
           className="w-full sm:w-auto h-9 px-8 font-bold text-xs shadow-md bg-foreground text-background hover:bg-foreground/90 transition-transform active:scale-[0.98]"
         >
           {isSubmitting ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <ArrowRight className="mr-2 h-3.5 w-3.5" />}
           Execute Transfer
         </Button>
      </div>

    </div>
  )
}