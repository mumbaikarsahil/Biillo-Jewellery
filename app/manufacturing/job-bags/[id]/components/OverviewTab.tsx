'use client'

import { JobBag } from '../types'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface Props {
  job: JobBag
}

export default function OverviewTab({ job }: Props) {
  return (
    <Card>
      <CardContent className="p-6 space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold">{job.job_bag_number}</h2>
          <Badge>{job.status}</Badge>
        </div>

        <div className="grid md:grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">Product Category</p>
            <p>{job.product_category || '-'}</p>
          </div>

          <div>
            <p className="text-muted-foreground">Design Code</p>
            <p>{job.design_code || '-'}</p>
          </div>

          <div>
            <p className="text-muted-foreground">Expected Gold</p>
            <p>{job.gold_expected_weight_g || 0} g</p>
          </div>

          <div>
            <p className="text-muted-foreground">Expected Diamond</p>
            <p>{job.diamond_expected_weight_cts || 0} cts</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
