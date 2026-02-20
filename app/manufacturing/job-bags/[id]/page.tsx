'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/hooks/useAuth'
import { useParams } from 'next/navigation'
import { Card, CardContent,  } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'

/* COMPONENT IMPORTS */
import OverviewTab from './components/OverviewTab'
import IssueTab from './components/IssueTab'
import ConsumptionTab from './components/ConsumptionTab'
import ReceiveTab from './components/ReceiveTab'
import ReconciliationTab from './components/ReconciliationTab'

export default function JobBagDetailPage() {
  const { id } = useParams()
  const { appUser } = useAuth()

  const [job, setJob] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    if (!appUser || !id) return

    setLoading(true)

    const { data, error } = await supabase
      .from('job_bags')
      .select(`
        *,
        karigars (
          id,
          full_name
        )
      `)
      .eq('id', id)
      .single()

    if (!error) {
      setJob(data)
    }

    setLoading(false)
  }, [appUser, id])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  if (loading) {
    return <div className="p-6">Loading...</div>
  }

  if (!job) {
    return <div className="p-6">Job not found</div>
  }

  return (
    <div className="container mx-auto p-6 max-w-6xl space-y-6">

      {/* HEADER CARD */}
      <Card>
        <CardContent className="p-6 flex flex-col md:flex-row md:justify-between md:items-center gap-4">
          
          <div>
            <h2 className="text-2xl font-bold">
              {job.job_bag_number}
            </h2>
            <p className="text-muted-foreground">
              Karigar: {job.karigars?.full_name}
            </p>
          </div>

          <Badge className="capitalize w-fit">
            {job.status}
          </Badge>

        </CardContent>
      </Card>

      {/* TABS */}
      <Tabs defaultValue="overview" className="w-full">

        <TabsList className="grid grid-cols-2 md:grid-cols-5 w-full">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="issue">Issue</TabsTrigger>
          <TabsTrigger value="consume">Consumption</TabsTrigger>
          <TabsTrigger value="receive">Receive</TabsTrigger>
          <TabsTrigger value="reconcile">Reconciliation</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <OverviewTab job={job} />
        </TabsContent>

        <TabsContent value="issue">
          <IssueTab
            jobId={job.id}
            refresh={fetchData}
          />
        </TabsContent>

        <TabsContent value="consume">
          <ConsumptionTab
            jobId={job.id}
            refresh={fetchData}
          />
        </TabsContent>

        <TabsContent value="receive">
          <ReceiveTab
            jobId={job.id}
            companyId={job.company_id}
            warehouseId={job.warehouse_id}
            refresh={fetchData}
          />
        </TabsContent>

        <TabsContent value="reconcile">
          <ReconciliationTab
            jobId={job.id}
          />
        </TabsContent>

      </Tabs>

    </div>
  )
}
