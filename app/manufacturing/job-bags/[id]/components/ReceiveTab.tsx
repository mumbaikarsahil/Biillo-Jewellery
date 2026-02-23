'use client'

import { useState, useEffect } from 'react'
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

  // --- THE MAGIC HAPPENS HERE ---
  // Auto-calculate Net Weight whenever Gross Weight or Stone Weight changes
  useEffect(() => {
    const gw = parseFloat(grossWeight) || 0
    const sw = parseFloat(stoneWeight) || 0

    if (gw > 0) {
      // Formula: Gross Weight - (Stone Carats * 0.2)
      const calculatedNet = gw - (sw * 0.2)
      // Ensure it doesn't go below 0 and round to 3 decimal places
      setNetWeight(Math.max(0, calculatedNet).toFixed(3))
    } else {
      setNetWeight('')
    }
  }, [grossWeight, stoneWeight])

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
      // Optional: Clear form after successful submit
      setBarcode('')
      setGrossWeight('')
      setStoneWeight('0')
      setCostMaking('0')
    }
  }

  return (
    <Card>
      <CardContent className="p-6 space-y-4">

        <h3 className="font-semibold">Receive Finished Item</h3>

        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Barcode</label>
          <Input
            placeholder="Scan or type barcode"
            value={barcode}
            onChange={(e) => setBarcode(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Gross Weight (g)</label>
            <Input
              placeholder="0.000"
              type="number"
              step="0.001"
              value={grossWeight}
              onChange={(e) => setGrossWeight(e.target.value)}
            />
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Stone Weight (cts)</label>
            <Input
              placeholder="0.00"
              type="number"
              step="0.01"
              value={stoneWeight}
              onChange={(e) => setStoneWeight(e.target.value)}
            />
          </div>
        </div>

        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Auto-Calculated Net Weight (g)</label>
          <Input
            placeholder="0.000"
            type="number"
            value={netWeight}
            readOnly // Prevents the user from manually messing up the math
            className="bg-gray-50 text-gray-500 cursor-not-allowed font-medium"
          />
        </div>

        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Making Cost (₹)</label>
          <Input
            placeholder="0"
            type="number"
            value={costMaking}
            onChange={(e) => setCostMaking(e.target.value)}
          />
        </div>

        <Button className="w-full mt-2" onClick={receiveItem}>
          Create Inventory Item
        </Button>

      </CardContent>
    </Card>
  )
}