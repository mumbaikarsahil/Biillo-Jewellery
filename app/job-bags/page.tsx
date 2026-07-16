'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/hooks/useAuth'
import { 
  Plus, Search, Filter, ChevronLeft, ChevronRight,
  Users, TrendingUp, Wallet, CheckCircle, Briefcase, Scale, IndianRupee
} from 'lucide-react'

// UI Components
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { Skeleton } from '@/components/ui/skeleton'

// --- Types & Schema ---
const karigarSchema = z.object({
  karigar_code: z.string().min(2).toUpperCase(),
  full_name: z.string().min(2),
  phone: z.string().optional(),
  specialization: z.string().optional(),
  labor_type: z.enum(['PER_GRAM', 'PER_PIECE', 'FIXED']),
  default_labor_rate: z.coerce.number().min(0),
  is_active: z.boolean().default(true)
})

const PAGE_SIZE = 10

export default function KarigarPage() {
  const { appUser } = useAuth()
  
  // Data State
  const [karigars, setKarigars] = useState<any[]>([])
  const [stats, setStats] = useState({ total: 0, active: 0, totalPendingPay: 0 })
  const [loading, setLoading] = useState(true)
  
  // Filter & Search State
  const [page, setPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all') // 'all', 'active', 'inactive'
  
  const [isSheetOpen, setIsSheetOpen] = useState(false)

  // Form Setup
  const form = useForm<z.infer<typeof karigarSchema>>({
    resolver: zodResolver(karigarSchema),
    defaultValues: { karigar_code: '', labor_type: 'PER_GRAM', default_labor_rate: 0, is_active: true }
  })

  // --- 2. Fetch Data with Workload & Payroll Calculations ---
  const fetchKarigars = useCallback(async () => {
    if (!appUser) return
    setLoading(true)

    // Fetch Karigars ALONG WITH their assigned job bags to calculate workload
    let query = supabase
      .from('karigars')
      .select(`
        *,
        job_bags (
          id,
          status,
          gold_expected_weight_g
        )
      `, { count: 'exact' })
      .eq('company_id', appUser.company_id)
      .order('karigar_code', { ascending: true })

    if (search) {
      query = query.or(`full_name.ilike.%${search}%,karigar_code.ilike.%${search}%`)
    }
    if (statusFilter !== 'all') {
      query = query.eq('is_active', statusFilter === 'active')
    }

    const from = (page - 1) * PAGE_SIZE
    const to = from + PAGE_SIZE - 1
    query = query.range(from, to)

    const { data, count, error } = await query

    if (error) {
      toast.error('Failed to load data')
    } else if (data) {
      // Process Payroll & Workload Calculations in memory
      let totalPendingSystemPay = 0;
      let activeCount = 0;

      const processedData = data.map((k: any) => {
        if (k.is_active) activeCount++;

        // Filter for active/pending jobs assigned to this karigar
        const activeJobs = k.job_bags?.filter((jb: any) => 
          jb.status !== 'Completed' && jb.status !== 'Cancelled' && jb.status !== 'Received'
        ) || [];

        const pendingJobsCount = activeJobs.length;
        const pendingGoldWeight = activeJobs.reduce((sum: number, jb: any) => sum + Number(jb.gold_expected_weight_g || 0), 0);

        // Calculate Estimated Pay based on their specific rate profile
        let estimatedPay = 0;
        if (k.labor_type === 'PER_GRAM') {
          estimatedPay = pendingGoldWeight * Number(k.default_labor_rate || 0);
        } else if (k.labor_type === 'PER_PIECE') {
          estimatedPay = pendingJobsCount * Number(k.default_labor_rate || 0);
        } else {
          estimatedPay = Number(k.default_labor_rate || 0); // Fixed salary
        }

        totalPendingSystemPay += estimatedPay;

        return {
          ...k,
          pendingJobsCount,
          pendingGoldWeight,
          estimatedPay
        };
      });

      setKarigars(processedData);
      setTotalCount(count || 0);
      setStats({ total: count || 0, active: activeCount, totalPendingPay: totalPendingSystemPay });
    }
    setLoading(false)
  }, [appUser, page, search, statusFilter])

  // Trigger fetches
  useEffect(() => { fetchKarigars() }, [fetchKarigars])

  // --- Handlers ---
  async function onSubmit(values: z.infer<typeof karigarSchema>) {
    if (!appUser) return
    try {
      const { error } = await supabase.from('karigars').insert({
        company_id: appUser.company_id,
        ...values
      })
      if (error) throw error
      toast.success('Karigar Registered')
      setIsSheetOpen(false)
      form.reset()
      fetchKarigars()
    } catch (err: any) {
      toast.error(err.message.includes('unique') ? 'Code already exists' : err.message)
    }
  }

  return (
    <div className="container mx-auto py-6 px-4 md:px-6 max-w-7xl space-y-6">
      
      {/* 1. Summary Cards (Auto-Updating Payroll Stats) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-white border-slate-200 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
              <Users className="h-4 w-4 text-blue-500" /> Total Artisans
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-slate-900">{stats.total}</div>
            <p className="text-xs text-slate-500 mt-1 font-medium"><span className="text-green-600 font-bold">{stats.active} Active</span> in network</p>
          </CardContent>
        </Card>

        <Card className="bg-white border-slate-200 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
              <Briefcase className="h-4 w-4 text-amber-500" /> Factory Workload
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-slate-900">
              {karigars.reduce((acc, curr) => acc + curr.pendingJobsCount, 0)} <span className="text-lg text-slate-400">Bags</span>
            </div>
            <p className="text-xs text-slate-500 mt-1 font-medium">Currently out for manufacturing</p>
          </CardContent>
        </Card>

        <Card className="bg-emerald-50 border-emerald-100 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold text-emerald-700 uppercase tracking-wider flex items-center gap-2">
              <Wallet className="h-4 w-4" /> Pending Payroll Est.
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-emerald-900">₹{stats.totalPendingPay.toLocaleString('en-IN')}</div>
            <p className="text-xs text-emerald-600/80 mt-1 font-medium">Estimated pay for pending bags</p>
          </CardContent>
        </Card>
      </div>

      {/* 2. Advanced Toolbar */}
      <div className="flex flex-col md:flex-row justify-between gap-4 items-end md:items-center bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
        <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto flex-1">
          {/* Search */}
          <div className="relative w-full md:w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search Karigar..." 
              className="pl-9 h-9" 
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }} 
            />
          </div>

          {/* Filters */}
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
            <SelectTrigger className="w-full md:w-32 h-9">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Filter className="h-3 w-3" />
                <SelectValue placeholder="Status" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Add Button */}
        <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
          <SheetTrigger asChild>
            <Button className="w-full md:w-auto h-9 bg-slate-900 hover:bg-slate-800"><Plus className="mr-2 h-4 w-4" /> Register Karigar</Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-[100%] sm:w-[500px] overflow-y-auto">
             <SheetHeader>
                <SheetTitle>New Karigar</SheetTitle>
                <SheetDescription>Register artisan details and configure their payout rates.</SheetDescription>
             </SheetHeader>
             <KarigarForm form={form} onSubmit={onSubmit} />
          </SheetContent>
        </Sheet>
      </div>

      {/* 3. Data Table with Workload & Payroll */}
      <div className="rounded-md border border-slate-200 bg-white shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-slate-50/80">
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[120px] font-bold text-xs uppercase tracking-wider text-slate-500">Artisan</TableHead>
              <TableHead className="font-bold text-xs uppercase tracking-wider text-slate-500">Contact</TableHead>
              <TableHead className="text-center font-bold text-xs uppercase tracking-wider text-slate-500">Workload</TableHead>
              <TableHead className="text-right font-bold text-xs uppercase tracking-wider text-slate-500">Pay Structure</TableHead>
              <TableHead className="text-right font-bold text-xs uppercase tracking-wider text-slate-500 pr-6">Est. Payout</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              [...Array(5)].map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-12 mb-1" /><Skeleton className="h-3 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                  <TableCell className="text-center"><Skeleton className="h-8 w-24 mx-auto" /></TableCell>
                  <TableCell className="text-right"><Skeleton className="h-4 w-20 ml-auto mb-1" /><Skeleton className="h-3 w-16 ml-auto" /></TableCell>
                  <TableCell className="text-right pr-6"><Skeleton className="h-5 w-24 ml-auto" /></TableCell>
                </TableRow>
              ))
            ) : karigars.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                  No artisans found matching your filters.
                </TableCell>
              </TableRow>
            ) : (
              karigars.map((k) => (
                <TableRow key={k.id} className="group hover:bg-slate-50/50 transition-colors">
                  
                  {/* Name & Code */}
                  <TableCell className="py-3">
                    <div className="flex flex-col">
                      <span className="font-bold text-slate-900">{k.full_name}</span>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="font-mono text-xs font-semibold text-slate-500">{k.karigar_code}</span>
                        {!k.is_active && <Badge variant="secondary" className="text-[9px] h-4 px-1 absolute">Inactive</Badge>}
                      </div>
                    </div>
                  </TableCell>
                  
                  {/* Contact & Skill */}
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-slate-700">{k.phone || '---'}</span>
                      <span className="text-xs text-slate-400 mt-0.5">{k.specialization || 'General Worker'}</span>
                    </div>
                  </TableCell>
                  
                  {/* Active Workload Indicator */}
                  <TableCell className="text-center">
                    {k.pendingJobsCount > 0 ? (
                      <div className="inline-flex flex-col items-center justify-center bg-amber-50 border border-amber-200 rounded-md px-3 py-1">
                        <div className="flex items-center gap-1.5 text-amber-700 font-bold text-sm">
                          <Briefcase className="h-3.5 w-3.5" />
                          {k.pendingJobsCount} Bags
                        </div>
                        <div className="flex items-center gap-1 text-amber-600/80 text-[10px] font-bold mt-0.5">
                          <Scale className="h-3 w-3" />
                          {k.pendingGoldWeight.toFixed(3)}g Metal
                        </div>
                      </div>
                    ) : (
                      <span className="text-xs font-bold text-slate-300 uppercase tracking-widest">Idle</span>
                    )}
                  </TableCell>
                  
                  {/* Pay Rate Structure */}
                  <TableCell className="text-right">
                    <div className="flex flex-col items-end">
                      <span className="font-bold text-slate-800">₹{k.default_labor_rate}</span>
                      <Badge variant="outline" className="text-[9px] bg-white text-slate-500 border-slate-200 mt-1 uppercase tracking-widest">
                        {k.labor_type.replace('_', ' ')}
                      </Badge>
                    </div>
                  </TableCell>
                  
                  {/* Estimated Pending Payout */}
                  <TableCell className="text-right pr-6">
                    {k.estimatedPay > 0 ? (
                      <div className="flex items-center justify-end gap-1.5 text-emerald-700 font-black text-base">
                        <IndianRupee className="h-4 w-4" />
                        {k.estimatedPay.toLocaleString('en-IN')}
                      </div>
                    ) : (
                      <span className="text-slate-300 font-medium text-sm">₹0</span>
                    )}
                  </TableCell>
                  
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* 4. Pagination Controls */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Showing <strong>{(page - 1) * PAGE_SIZE + 1}</strong> to <strong>{Math.min(page * PAGE_SIZE, totalCount)}</strong> of <strong>{totalCount}</strong>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1 || loading}>
            <ChevronLeft className="h-4 w-4" /> Previous
          </Button>
          <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)} disabled={page * PAGE_SIZE >= totalCount || loading}>
            Next <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

    </div>
  )
}

// --- Subcomponent: Form (Unchanged functionality, slightly improved UI) ---
function KarigarForm({ form, onSubmit }: { form: any, onSubmit: any }) {
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5 mt-6">
        <div className="grid grid-cols-2 gap-4">
          <FormField control={form.control} name="karigar_code" render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-bold uppercase text-slate-500">Code</FormLabel>
              <FormControl><Input placeholder="K-001" className="uppercase" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="full_name" render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-bold uppercase text-slate-500">Name</FormLabel>
              <FormControl><Input placeholder="Full Name" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </div>

        <FormField control={form.control} name="phone" render={({ field }) => (
          <FormItem>
            <FormLabel className="text-xs font-bold uppercase text-slate-500">Phone</FormLabel>
            <FormControl><Input placeholder="+91..." {...field} /></FormControl>
          </FormItem>
        )} />

        <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
          <h4 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2 uppercase tracking-wide">
            <Wallet className="h-4 w-4 text-emerald-600" /> Pay Configuration
          </h4>
          <div className="grid grid-cols-2 gap-4">
             <FormField control={form.control} name="labor_type" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs font-bold uppercase text-slate-500">Rate Basis</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl><SelectTrigger className="bg-white"><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent>
                    <SelectItem value="PER_GRAM">Per Gram of Metal</SelectItem>
                    <SelectItem value="PER_PIECE">Per Job Bag (Piece)</SelectItem>
                    <SelectItem value="FIXED">Fixed Base Salary</SelectItem>
                  </SelectContent>
                </Select>
              </FormItem>
            )} />
            <FormField control={form.control} name="default_labor_rate" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs font-bold uppercase text-slate-500">Amount (₹)</FormLabel>
                <FormControl><Input type="number" className="bg-white" {...field} /></FormControl>
              </FormItem>
            )} />
          </div>
        </div>

        <Button type="submit" className="w-full bg-slate-900" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? "Saving..." : "Register Artisan"}
        </Button>
      </form>
    </Form>
  )
}