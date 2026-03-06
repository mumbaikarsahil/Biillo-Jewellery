'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { 
  ArrowLeft, 
  ChevronRight, 
  LayoutDashboard, 
  RefreshCw, 
  Database,
  User,
  Clock,
  Briefcase,
  Activity,
  CheckCircle2,
  AlertCircle,
  Info
} from 'lucide-react'

import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/hooks/useAuth'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
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
  const router = useRouter()
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
        karigars (id, full_name)
      `)
      .eq('id', id)
      .single()

    if (!error) setJob(data)
    setLoading(false)
  }, [appUser, id])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "open": return <Badge variant="outline" className="bg-blue-500/5 text-blue-600 border-blue-200/50 text-[10px] font-bold h-5 uppercase">Awaiting Issue</Badge>;
      case "in_progress": return <Badge variant="outline" className="bg-amber-500/5 text-amber-600 border-amber-200/50 text-[10px] font-bold h-5 uppercase">In Fabrication</Badge>;
      case "completed": return <Badge variant="outline" className="bg-emerald-500/5 text-emerald-600 border-emerald-200/50 text-[10px] font-bold h-5 uppercase">Finished</Badge>;
      default: return <Badge variant="secondary" className="text-[10px] h-5 uppercase">{status}</Badge>;
    }
  };

  // --- SKELETON LOADER ---
  const DetailSkeleton = () => (
    <div className="flex flex-col min-h-screen bg-background">
      <div className="h-12 border-b border-border px-4 flex items-center justify-between">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-8 w-24" />
      </div>
      <div className="p-8 space-y-6 max-w-6xl mx-auto w-full">
        <div className="flex justify-between items-end">
          <div className="space-y-2">
            <Skeleton className="h-8 w-40" />
            <Skeleton className="h-4 w-60" />
          </div>
          <Skeleton className="h-6 w-24 rounded-full" />
        </div>
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    </div>
  )

  if (loading) return <DetailSkeleton />

  if (!job) {
    return (
      <div className="h-screen flex flex-col items-center justify-center space-y-4">
        <AlertCircle className="h-12 w-12 text-muted-foreground/20" />
        <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest">Entry Missing in Registry</p>
        <Button variant="outline" size="sm" onClick={() => router.back()} className="text-xs font-bold uppercase">
          <ArrowLeft className="mr-2 h-4 w-4" /> Go Back
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* --- COMPACT IDE HEADER --- */}
      <header className="sticky top-0 z-40 w-full bg-background border-b border-border px-4 h-12 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3 overflow-hidden">
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-md hover:bg-secondary" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 text-muted-foreground" />
          </Button>
          <Separator orientation="vertical" className="h-4" />
          <nav className="flex items-center gap-1.5 text-sm whitespace-nowrap overflow-hidden">
            <Link href="/manufacturing/job-bags" className="text-muted-foreground hover:text-foreground transition-colors font-medium">Job Bags</Link>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="font-bold text-foreground truncate">{job.job_bag_number}</span>
            <div className="ml-3 hidden md:flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-secondary border border-border">
              <Activity className="h-3 w-3 text-emerald-500" />
              <span className="text-[10px] font-bold text-muted-foreground uppercase">Audit Log Active</span>
            </div>
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="h-8 px-2 text-xs font-medium text-muted-foreground" onClick={fetchData}>
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Sync
          </Button>
          <Separator orientation="vertical" className="h-4 mx-1" />
          <Button variant="outline" size="sm" className="h-8 text-xs font-semibold px-3 border-border hidden sm:flex">
            <Database className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" /> Registry
          </Button>
        </div>
      </header>

      <main className="p-4 md:p-8 max-w-[1200px] w-full mx-auto space-y-6 animate-in fade-in duration-500">
        
        {/* SUMMARY BAR */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
           <div className="space-y-1">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">{job.job_bag_number}</h1>
              <div className="flex items-center gap-3">
                 <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <User className="h-3.5 w-3.5" />
                    <span className="font-medium">Karigar: <span className="text-foreground">{job.karigars?.full_name || 'Unassigned'}</span></span>
                 </div>
                 <Separator orientation="vertical" className="h-3" />
                 <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Briefcase className="h-3.5 w-3.5" />
                    <span className="font-medium uppercase tracking-tight text-[11px]">{job.product_category}</span>
                 </div>
              </div>
           </div>
           <div className="flex items-center gap-4">
              <div className="text-right hidden md:block">
                 <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">Job Status</p>
                 <div className="mt-1">{getStatusBadge(job.status)}</div>
              </div>
              <div className="md:hidden">{getStatusBadge(job.status)}</div>
           </div>
        </div>

        {/* TABS SECTION - IDE STYLE UNDERLINE */}
        <Tabs defaultValue="overview" className="w-full">
          <div className="border-b border-border mb-6">
            <TabsList className="flex items-center gap-6 bg-transparent rounded-none h-11 justify-start p-0 overflow-x-auto no-scrollbar">
              <TabsTrigger value="overview" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent shadow-none h-full px-1 text-xs font-bold transition-all whitespace-nowrap">
                Overview
              </TabsTrigger>
              <TabsTrigger value="issue" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent shadow-none h-full px-1 text-xs font-bold transition-all whitespace-nowrap">
                Issue Stock
              </TabsTrigger>
              <TabsTrigger value="consume" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent shadow-none h-full px-1 text-xs font-bold transition-all whitespace-nowrap">
                Consumption
              </TabsTrigger>
              <TabsTrigger value="receive" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent shadow-none h-full px-1 text-xs font-bold transition-all whitespace-nowrap">
                Receive Finished
              </TabsTrigger>
              <TabsTrigger value="reconcile" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent shadow-none h-full px-1 text-xs font-bold transition-all whitespace-nowrap">
                Reconciliation
              </TabsTrigger>
            </TabsList>
          </div>

          {/* TAB CONTENTS */}
          <div className="focus-visible:outline-none">
            <TabsContent value="overview" className="m-0 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <OverviewTab job={job} />
            </TabsContent>

            <TabsContent value="issue" className="m-0 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <IssueTab jobId={job.id} refresh={fetchData} />
            </TabsContent>

            <TabsContent value="consume" className="m-0 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <ConsumptionTab jobId={job.id} refresh={fetchData} />
            </TabsContent>

            <TabsContent value="receive" className="m-0 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <ReceiveTab jobId={job.id} companyId={job.company_id} warehouseId={job.warehouse_id} refresh={fetchData} />
            </TabsContent>

            <TabsContent value="reconcile" className="m-0 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <ReconciliationTab jobId={job.id} />
            </TabsContent>
          </div>
        </Tabs>

        {/* SYSTEM FOOTER HINT */}
        <div className="flex items-start gap-3 px-4 py-3 rounded-lg bg-secondary/30 border border-border mt-8">
          <Info className="h-4 w-4 text-muted-foreground mt-0.5" />
          <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-tight leading-relaxed">
            All updates to this Job Bag are tracked in the <span className="text-foreground font-bold italic underline">Global Audit Ledger</span>. Changes to gold mass or stone quantities will reflect in transit inventory until reconciled.
          </p>
        </div>

      </main>
    </div>
  )
}