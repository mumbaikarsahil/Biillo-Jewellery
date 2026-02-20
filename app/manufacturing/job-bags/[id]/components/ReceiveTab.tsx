'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'

interface Props {
  jobId: string
  companyId: string
  warehouseId: string
  refresh: () => void
}

export default function ReceiveTab({
  jobId,
  companyId,
  warehouseId,
  refresh
}: Props) {

  const [barcode, setBarcode] = useState('')
  const [metalType, setMetalType] = useState('Gold')
  const [purityKarat, setPurityKarat] = useState('22K')
  const [purityPercent, setPurityPercent] = useState('91.6')
  const [grossWeight, setGrossWeight] = useState('')
  const [netWeight, setNetWeight] = useState('')
  const [stoneWeight, setStoneWeight] = useState('0')
  const [costMaking, setCostMaking] = useState('0')

  async function receiveItem() {
    const { error } = await supabase
      .from('inventory_items')
      .insert({
        company_id: companyId,
        barcode,
        warehouse_id: warehouseId,
        metal_type: metalType,
        purity_karat: purityKarat,
        purity_percent: Number(purityPercent),
        gross_weight_g: Number(grossWeight),
        net_weight_g: Number(netWeight),
        total_stone_weight_cts: Number(stoneWeight),
        cost_making: Number(costMaking),
        created_from_job_bag_id: jobId,
        status: 'in_stock'
      })

    if (error) toast.error(error.message)
    else {
      toast.success('Finished item created')
      refresh()
    }
  }

  return (
    <Card>
      <CardContent className="p-6 space-y-4">

        <h3 className="font-semibold">Receive Finished Item</h3>

        <Input
          placeholder="Barcode"
          value={barcode}
          onChange={(e) => setBarcode(e.target.value)}
        />

        <Input
          placeholder="Gross Weight (g)"
          type="number"
          value={grossWeight}
          onChange={(e) => setGrossWeight(e.target.value)}
        />

        <Input
          placeholder="Net Weight (g)"
          type="number"
          value={netWeight}
          onChange={(e) => setNetWeight(e.target.value)}
        />

        <Input
          placeholder="Stone Weight (cts)"
          type="number"
          value={stoneWeight}
          onChange={(e) => setStoneWeight(e.target.value)}
        />

        <Input
          placeholder="Making Cost"
          type="number"
          value={costMaking}
          onChange={(e) => setCostMaking(e.target.value)}
        />

        <Button onClick={receiveItem}>
          Create Inventory Item
        </Button>

      </CardContent>
    </Card>
  )
}
