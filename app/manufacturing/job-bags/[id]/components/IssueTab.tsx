'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/hooks/useAuth'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { toast } from 'sonner'

type Props = {
  jobId: string
  refresh: () => Promise<void>
}

export default function IssueTab({ jobId, refresh }: Props) {
  const { appUser } = useAuth()

  const [goldBatches, setGoldBatches] = useState<any[]>([])
  const [diamondLots, setDiamondLots] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  const [selectedGold, setSelectedGold] = useState('')
  const [goldWeight, setGoldWeight] = useState('')

  const [selectedDiamond, setSelectedDiamond] = useState('')
  const [diamondWeight, setDiamondWeight] = useState('')
  const [diamondPieces, setDiamondPieces] = useState('')

  // ---------------- LOAD INVENTORY ----------------
  useEffect(() => {
    if (!appUser) return

    async function loadInventory() {
      const { data: gold } = await supabase
        .from('inventory_gold_batches')
        .select('*')
        .eq('company_id', appUser?.company_id)
        .gt('remaining_weight_g', 0)

      const { data: diamonds } = await supabase
        .from('inventory_diamond_lots')
        .select('*')
        .eq('company_id', appUser?.company_id)
        .gt('remaining_weight_cts', 0)

      setGoldBatches(gold || [])
      setDiamondLots(diamonds || [])
    }

    loadInventory()
  }, [appUser])

  // ---------------- ISSUE GOLD ----------------
  async function issueGold() {
    if (!selectedGold || !goldWeight) {
      toast.error('Select batch and weight')
      return
    }

    try {
      setLoading(true)

      const { error } = await supabase.rpc('issue_gold_to_job', {
        p_job_bag_id: jobId,
        p_gold_batch_id: selectedGold,
        p_weight_g: Number(goldWeight)
      })

      if (error) throw error

      toast.success('Gold Issued Successfully')

      setSelectedGold('')
      setGoldWeight('')
      await refresh()
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  // ---------------- ISSUE DIAMOND ----------------
  async function issueDiamond() {
    if (!selectedDiamond || !diamondWeight) {
      toast.error('Select lot and weight')
      return
    }

    try {
      setLoading(true)

      const { error } = await supabase.rpc('issue_diamond_to_job', {
        p_job_bag_id: jobId,
        p_diamond_lot_id: selectedDiamond,
        p_weight_cts: Number(diamondWeight),
        p_pieces: Number(diamondPieces || 0)
      })

      if (error) throw error

      toast.success('Diamond Issued Successfully')

      setSelectedDiamond('')
      setDiamondWeight('')
      setDiamondPieces('')
      await refresh()
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">

      {/* GOLD ISSUE */}
      <Card>
        <CardContent className="p-6 space-y-4">
          <h3 className="text-lg font-semibold">Issue Gold</h3>

          <Select value={selectedGold} onValueChange={setSelectedGold}>
            <SelectTrigger>
              <SelectValue placeholder="Select Gold Batch" />
            </SelectTrigger>
            <SelectContent>
              {goldBatches.map(batch => (
                <SelectItem key={batch.id} value={batch.id}>
                  {batch.batch_number} (Remaining: {batch.remaining_weight_g}g)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Input
            type="number"
            placeholder="Weight (g)"
            value={goldWeight}
            onChange={(e) => setGoldWeight(e.target.value)}
          />

          <Button onClick={issueGold} disabled={loading}>
            {loading ? 'Processing...' : 'Issue Gold'}
          </Button>
        </CardContent>
      </Card>

      {/* DIAMOND ISSUE */}
      <Card>
        <CardContent className="p-6 space-y-4">
          <h3 className="text-lg font-semibold">Issue Diamond</h3>

          <Select value={selectedDiamond} onValueChange={setSelectedDiamond}>
            <SelectTrigger>
              <SelectValue placeholder="Select Diamond Lot" />
            </SelectTrigger>
            <SelectContent>
              {diamondLots.map(lot => (
                <SelectItem key={lot.id} value={lot.id}>
                  {lot.lot_number} ({lot.remaining_weight_cts} cts)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Input
            type="number"
            placeholder="Weight (cts)"
            value={diamondWeight}
            onChange={(e) => setDiamondWeight(e.target.value)}
          />

          <Input
            type="number"
            placeholder="Pieces (optional)"
            value={diamondPieces}
            onChange={(e) => setDiamondPieces(e.target.value)}
          />

          <Button onClick={issueDiamond} disabled={loading}>
            {loading ? 'Processing...' : 'Issue Diamond'}
          </Button>
        </CardContent>
      </Card>

    </div>
  )
}
