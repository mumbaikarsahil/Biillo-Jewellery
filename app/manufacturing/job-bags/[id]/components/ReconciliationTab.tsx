'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Card, CardContent } from '@/components/ui/card'

interface Props {
  jobId: string
}

export default function ReconciliationTab({ jobId }: Props) {

  const [summary, setSummary] = useState<any>(null)

  useEffect(() => {
    fetchSummary()
  }, [])

  async function fetchSummary() {
    const { data: goldIssues } = await supabase
      .from('job_bag_gold_issues')
      .select('issued_weight_g')
      .eq('job_bag_id', jobId)

    const { data: goldConsumption } = await supabase
      .from('job_bag_gold_consumption')
      .select('consumed_weight_g, loss_weight_g')
      .eq('job_bag_id', jobId)

    const totalIssued = goldIssues?.reduce((a, b) => a + Number(b.issued_weight_g), 0) || 0
    const totalConsumed = goldConsumption?.reduce((a, b) => a + Number(b.consumed_weight_g), 0) || 0
    const totalLoss = goldConsumption?.reduce((a, b) => a + Number(b.loss_weight_g), 0) || 0

    setSummary({
      totalIssued,
      totalConsumed,
      totalLoss,
      remaining: totalIssued - totalConsumed - totalLoss
    })
  }

  if (!summary) return null

  return (
    <Card>
      <CardContent className="p-6 space-y-4">

        <h3 className="text-lg font-semibold">Gold Reconciliation</h3>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>Total Issued</div>
          <div>{summary.totalIssued.toFixed(3)} g</div>

          <div>Total Consumed</div>
          <div>{summary.totalConsumed.toFixed(3)} g</div>

          <div>Total Loss</div>
          <div>{summary.totalLoss.toFixed(3)} g</div>

          <div className="font-semibold">Remaining</div>
          <div className="font-semibold">
            {summary.remaining.toFixed(3)} g
          </div>
        </div>

      </CardContent>
    </Card>
  )
}
