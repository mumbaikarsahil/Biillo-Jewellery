'use client'

import React, { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { Plus, Search } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger
} from '@/components/ui/sheet'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { toast } from 'sonner'

export default function JobBagPage() {
  const { appUser } = useAuth()
  const router = useRouter()

  const [jobBags, setJobBags] = useState<any[]>([])
  const [karigars, setKarigars] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [isOpen, setIsOpen] = useState(false)

  const [form, setForm] = useState({
    job_bag_number: '',
    product_category: '',
    design_code: '',
    gold_expected_weight_g: '',
    diamond_expected_weight_cts: '',
    karigar_id: '',
    issue_date: '',
    expected_return_date: ''
  })

  // ---------------- FETCH ----------------

  async function fetchData() {
    if (!appUser) return
    setLoading(true)

    const { data } = await supabase
      .from('job_bags')
      .select('*, karigars(full_name)')
      .eq('company_id', appUser.company_id)
      .order('created_at', { ascending: false })

    const { data: kData } = await supabase
      .from('karigars')
      .select('id, full_name')
      .eq('company_id', appUser.company_id)
      .eq('is_active', true)

    setJobBags(data || [])
    setKarigars(kData || [])
    setLoading(false)
  }

  useEffect(() => {
    fetchData()
  }, [appUser])

  // ---------------- CREATE ----------------

  async function handleCreate() {
    if (!appUser) return

    try {
      const { data, error } = await supabase.rpc('create_job_bag', {
        p_company_id: appUser.company_id,
        p_job_bag_number: form.job_bag_number,
        p_product_category: form.product_category,
        p_design_code: form.design_code,
        p_gold_expected_weight_g: Number(form.gold_expected_weight_g) || 0,
        p_diamond_expected_weight_cts:
          Number(form.diamond_expected_weight_cts) || 0,
        p_karigar_id: form.karigar_id,
        p_issue_date: form.issue_date,
        p_expected_return_date: form.expected_return_date,
        p_created_by: appUser.user_id
      })

      if (error) throw error

      toast.success('Job Bag Created')
      setIsOpen(false)
      fetchData()

      router.push(`/manufacturing/job-bags/${data}`)
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  // ---------------- FILTER ----------------

  const filtered = jobBags.filter((j) => {
    const matchSearch = j.job_bag_number
      .toLowerCase()
      .includes(search.toLowerCase())

    const matchStatus =
      statusFilter === 'all' ? true : j.status === statusFilter

    return matchSearch && matchStatus
  })

  // ---------------- SUMMARY ----------------

  const openCount = jobBags.filter((j) => j.status === 'open').length
  const inProgressCount = jobBags.filter(
    (j) => j.status === 'in_progress'
  ).length
  const completedCount = jobBags.filter(
    (j) => j.status === 'completed'
  ).length

  // ==========================================================
  return (
    <div className="container mx-auto py-6 px-4 max-w-7xl">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between mb-6 gap-4">
        <div>
          <h1 className="text-3xl font-bold">Job Bags</h1>
          <p className="text-muted-foreground text-sm">
            Manage manufacturing workflow
          </p>
        </div>

        <Sheet open={isOpen} onOpenChange={setIsOpen}>
          <SheetTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Create Job Bag
            </Button>
          </SheetTrigger>

          <SheetContent className="w-full sm:w-[500px] overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Create Job Bag</SheetTitle>
            </SheetHeader>

            <div className="space-y-4 mt-6">
              <Input
                placeholder="Job Bag Number"
                value={form.job_bag_number}
                onChange={(e) =>
                  setForm({ ...form, job_bag_number: e.target.value })
                }
              />

              <Input
                placeholder="Product Category"
                value={form.product_category}
                onChange={(e) =>
                  setForm({ ...form, product_category: e.target.value })
                }
              />

              <Input
                placeholder="Design Code"
                value={form.design_code}
                onChange={(e) =>
                  setForm({ ...form, design_code: e.target.value })
                }
              />

              <Input
                type="number"
                placeholder="Expected Gold (g)"
                value={form.gold_expected_weight_g}
                onChange={(e) =>
                  setForm({
                    ...form,
                    gold_expected_weight_g: e.target.value
                  })
                }
              />

              <Input
                type="number"
                placeholder="Expected Diamond (cts)"
                value={form.diamond_expected_weight_cts}
                onChange={(e) =>
                  setForm({
                    ...form,
                    diamond_expected_weight_cts: e.target.value
                  })
                }
              />

              <Select
                onValueChange={(v) =>
                  setForm({ ...form, karigar_id: v })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select Karigar" />
                </SelectTrigger>
                <SelectContent>
                  {karigars.map((k) => (
                    <SelectItem key={k.id} value={k.id}>
                      {k.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Input
                type="date"
                onChange={(e) =>
                  setForm({ ...form, issue_date: e.target.value })
                }
              />

              <Input
                type="date"
                onChange={(e) =>
                  setForm({
                    ...form,
                    expected_return_date: e.target.value
                  })
                }
              />

              <Button className="w-full" onClick={handleCreate}>
                Save Job Bag
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* SUMMARY CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <SummaryCard title="Open" value={openCount} />
        <SummaryCard title="In Progress" value={inProgressCount} />
        <SummaryCard title="Completed" value={completedCount} />
      </div>

      {/* SEARCH + FILTER */}
      <div className="flex flex-col md:flex-row gap-4 mb-4">
        <div className="relative w-full md:w-72">
          <Search className="absolute left-2 top-2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search Job Bag..."
            className="pl-8"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <Select onValueChange={(v) => setStatusFilter(v)}>
          <SelectTrigger className="w-full md:w-48">
            <SelectValue placeholder="Filter Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="issued">Issued</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* LIST */}
      <div className="space-y-4">
        {loading ? (
          <p>Loading...</p>
        ) : filtered.length === 0 ? (
          <p>No Job Bags found.</p>
        ) : (
          filtered.map((job) => (
            <Card
              key={job.id}
              className="cursor-pointer hover:shadow-md"
              onClick={() =>
                router.push(`/manufacturing/job-bags/${job.id}`)
              }
            >
              <CardContent className="p-4 flex justify-between items-center">
                <div>
                  <p className="font-semibold">
                    {job.job_bag_number}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {job.product_category} | Karigar:{' '}
                    {job.karigars?.full_name}
                  </p>
                </div>
                <Badge>{job.status}</Badge>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}

function SummaryCard({ title, value }: any) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-sm text-muted-foreground">{title}</p>
        <p className="text-2xl font-bold">{value}</p>
      </CardContent>
    </Card>
  )
}
