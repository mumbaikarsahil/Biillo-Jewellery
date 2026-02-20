'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/hooks/useAuth'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Loader2 } from 'lucide-react'
import { toast } from '@/hooks/use-toast'

export default function JobBagDetailPage() {
  const params = useParams()
  const id = params?.id as string
  const { appUser } = useAuth()

  const [jobBag, setJobBag] = useState<any>(null)
  const [goldBatches, setGoldBatches] = useState<any[]>([])
  const [diamondLots, setDiamondLots] = useState<any[]>([])
  const [issuedGold, setIssuedGold] = useState<any[]>([])
  const [issuedDiamonds, setIssuedDiamonds] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)

  // Consumption state
  const [consumeGoldWeight, setConsumeGoldWeight] = useState('')
  const [consumeGoldLoss, setConsumeGoldLoss] = useState('')
  const [consumeDiamondWeight, setConsumeDiamondWeight] = useState('')
  const [consumeDiamondPieces, setConsumeDiamondPieces] = useState('')
  const [consumeDiamondBreakage, setConsumeDiamondBreakage] = useState('')

  // Receive state
  const [barcode, setBarcode] = useState('')
  const [sku, setSku] = useState('')
  const [mrp, setMrp] = useState('')

  // ================= LOAD DATA =================
  const loadData = async () => {
    if (!appUser || !id) return

    setLoading(true)

    const [bagRes, goldRes, diaRes, issuedGoldRes, issuedDiaRes] =
      await Promise.all([
        supabase.from('job_bags').select('*').eq('id', id).single(),
        supabase
          .from('inventory_gold_batches')
          .select('*')
          .eq('company_id', appUser.company_id)
          .gt('remaining_weight_g', 0),
        supabase
          .from('inventory_diamond_lots')
          .select('*')
          .eq('company_id', appUser.company_id)
          .gt('remaining_weight_cts', 0),
        supabase
          .from('job_bag_gold_issues')
          .select('*')
          .eq('job_bag_id', id),
        supabase
          .from('job_bag_diamond_issues')
          .select('*')
          .eq('job_bag_id', id)
      ])

    setJobBag(bagRes.data)
    setGoldBatches(goldRes.data || [])
    setDiamondLots(diaRes.data || [])
    setIssuedGold(issuedGoldRes.data || [])
    setIssuedDiamonds(issuedDiaRes.data || [])
    setLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [appUser, id])

  // ================= ISSUE GOLD =================
  const issueGold = async (batchId: string, weight: number) => {
    if (!appUser) return

    setProcessing(true)

    const { error } = await supabase.rpc('issue_gold_to_job_bag', {
      _job_bag_id: id,
      _gold_batch_id: batchId,
      _weight: weight,
      _user_id: appUser.user_id
    })

    if (error) {
      toast({ title: error.message, variant: 'destructive' })
    } else {
      toast({ title: 'Gold Issued' })
      loadData()
    }

    setProcessing(false)
  }

  // ================= RECORD GOLD CONSUMPTION =================
  const recordGoldConsumption = async () => {
    if (!appUser || !consumeGoldWeight) return

    const batchId = issuedGold[0]?.gold_batch_id
    if (!batchId) return

    setProcessing(true)

    const { error } = await supabase.rpc('record_gold_consumption', {
      _job_bag_id: id,
      _gold_batch_id: batchId,
      _consumed_weight: parseFloat(consumeGoldWeight),
      _loss_weight: parseFloat(consumeGoldLoss || '0'),
      _user_id: appUser.user_id
    })

    if (error) {
      toast({ title: error.message, variant: 'destructive' })
    } else {
      toast({ title: 'Gold Consumption Recorded' })
      loadData()
    }

    setProcessing(false)
  }

  // ================= RECEIVE FINISHED GOODS =================
  const receiveFinished = async () => {
    if (!appUser || !barcode || !mrp) return

    setProcessing(true)

    const { error } = await supabase.rpc('receive_finished_goods', {
      _job_bag_id: id,
      _barcode: barcode,
      _sku: sku,
      _mrp: parseFloat(mrp),
      _warehouse_id: jobBag?.warehouse_id,
      _user_id: appUser.user_id
    })

    if (error) {
      toast({ title: error.message, variant: 'destructive' })
    } else {
      toast({ title: 'Finished Goods Received' })
      loadData()
    }

    setProcessing(false)
  }

  // ================= CLOSE JOB =================
  const closeJob = async () => {
    if (!appUser) return

    setProcessing(true)

    const { error } = await supabase.rpc('close_job_bag', {
      _job_bag_id: id,
      _user_id: appUser.user_id
    })

    if (error) {
      toast({ title: error.message, variant: 'destructive' })
    } else {
      toast({ title: 'Job Closed Successfully' })
      loadData()
    }

    setProcessing(false)
  }

  if (loading)
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="animate-spin" />
      </div>
    )

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">
        Job Bag: {jobBag?.job_bag_number}
      </h1>

      <Badge variant="outline">
        Status: {jobBag?.status}
      </Badge>

      <Tabs defaultValue="issue">

        <TabsList>
          <TabsTrigger value="issue">Issue</TabsTrigger>
          <TabsTrigger value="view">Issued</TabsTrigger>
          <TabsTrigger value="consume">Consumption</TabsTrigger>
          <TabsTrigger value="receive">Receive</TabsTrigger>
          <TabsTrigger value="close">Close</TabsTrigger>
        </TabsList>

        {/* ================= ISSUE ================= */}
        <TabsContent value="issue" className="space-y-4">
          {goldBatches.map((g) => (
            <Card key={g.id} className="p-4 flex justify-between">
              <div>
                {g.batch_number} (Available: {g.remaining_weight_g}g)
              </div>
              <Button
                disabled={processing}
                onClick={() => issueGold(g.id, 1)}
              >
                Issue 1g
              </Button>
            </Card>
          ))}
        </TabsContent>

        {/* ================= VIEW ================= */}
        <TabsContent value="view">
          <Card className="p-4">
            {issuedGold.map((g) => (
              <div key={g.id}>
                Gold Batch: {g.gold_batch_id} | {g.issued_weight_g}g
              </div>
            ))}
          </Card>
        </TabsContent>

        {/* ================= CONSUMPTION ================= */}
        <TabsContent value="consume" className="space-y-4">
          <Card className="p-4 space-y-3">
            <Input
              placeholder="Consumed Gold (g)"
              type="number"
              value={consumeGoldWeight}
              onChange={(e) => setConsumeGoldWeight(e.target.value)}
            />
            <Input
              placeholder="Loss (g)"
              type="number"
              value={consumeGoldLoss}
              onChange={(e) => setConsumeGoldLoss(e.target.value)}
            />
            <Button onClick={recordGoldConsumption}>
              Record Gold Consumption
            </Button>
          </Card>
        </TabsContent>

        {/* ================= RECEIVE ================= */}
        <TabsContent value="receive" className="space-y-4">
          <Card className="p-4 space-y-3">
            <Input
              placeholder="Barcode"
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
            />
            <Input
              placeholder="SKU"
              value={sku}
              onChange={(e) => setSku(e.target.value)}
            />
            <Input
              placeholder="MRP"
              type="number"
              value={mrp}
              onChange={(e) => setMrp(e.target.value)}
            />
            <Button onClick={receiveFinished}>
              Receive Finished Goods
            </Button>
          </Card>
        </TabsContent>

        {/* ================= CLOSE ================= */}
        <TabsContent value="close">
          <Card className="p-4">
            <Button
              variant="destructive"
              onClick={closeJob}
              disabled={processing}
            >
              Close Job Bag
            </Button>
          </Card>
        </TabsContent>

      </Tabs>
    </div>
  )
}
