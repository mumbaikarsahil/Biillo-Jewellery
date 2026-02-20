'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'

interface Props {
  jobId: string
  refresh: () => void
}

export default function ConsumptionTab({ jobId, refresh }: Props) {
  const [goldBatchId, setGoldBatchId] = useState('')
  const [goldConsumed, setGoldConsumed] = useState('')
  const [goldLoss, setGoldLoss] = useState('0')

  const [diamondLotId, setDiamondLotId] = useState('')
  const [diamondConsumed, setDiamondConsumed] = useState('')
  const [diamondBreakage, setDiamondBreakage] = useState('0')
  const [diamondPieces, setDiamondPieces] = useState('')

  async function recordGoldConsumption() {
    const { error } = await supabase
      .from('job_bag_gold_consumption')
      .insert({
        job_bag_id: jobId,
        gold_batch_id: goldBatchId,
        consumed_weight_g: Number(goldConsumed),
        loss_weight_g: Number(goldLoss)
      })

    if (error) toast.error(error.message)
    else {
      toast.success('Gold consumption recorded')
      refresh()
    }
  }

  async function recordDiamondConsumption() {
    const { error } = await supabase
      .from('job_bag_diamond_consumption')
      .insert({
        job_bag_id: jobId,
        diamond_lot_id: diamondLotId,
        consumed_weight_cts: Number(diamondConsumed),
        breakage_weight_cts: Number(diamondBreakage),
        consumed_pieces: Number(diamondPieces)
      })

    if (error) toast.error(error.message)
    else {
      toast.success('Diamond consumption recorded')
      refresh()
    }
  }

  return (
    <div className="grid md:grid-cols-2 gap-6">

      {/* GOLD */}
      <Card>
        <CardContent className="p-6 space-y-4">
          <h3 className="font-semibold">Gold Consumption</h3>

          <Input
            placeholder="Gold Batch ID"
            value={goldBatchId}
            onChange={(e) => setGoldBatchId(e.target.value)}
          />

          <Input
            type="number"
            placeholder="Consumed Weight (g)"
            value={goldConsumed}
            onChange={(e) => setGoldConsumed(e.target.value)}
          />

          <Input
            type="number"
            placeholder="Loss Weight (g)"
            value={goldLoss}
            onChange={(e) => setGoldLoss(e.target.value)}
          />

          <Button onClick={recordGoldConsumption}>
            Record Gold Consumption
          </Button>
        </CardContent>
      </Card>

      {/* DIAMOND */}
      <Card>
        <CardContent className="p-6 space-y-4">
          <h3 className="font-semibold">Diamond Consumption</h3>

          <Input
            placeholder="Diamond Lot ID"
            value={diamondLotId}
            onChange={(e) => setDiamondLotId(e.target.value)}
          />

          <Input
            type="number"
            placeholder="Consumed Weight (cts)"
            value={diamondConsumed}
            onChange={(e) => setDiamondConsumed(e.target.value)}
          />

          <Input
            type="number"
            placeholder="Breakage (cts)"
            value={diamondBreakage}
            onChange={(e) => setDiamondBreakage(e.target.value)}
          />

          <Input
            type="number"
            placeholder="Consumed Pieces"
            value={diamondPieces}
            onChange={(e) => setDiamondPieces(e.target.value)}
          />

          <Button onClick={recordDiamondConsumption}>
            Record Diamond Consumption
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
