'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/hooks/useAuth'
import { 
  Plus, Search, Filter, ChevronLeft, ChevronRight,
  Users, TrendingUp, Wallet, CheckCircle, XCircle
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
  const [stats, setStats] = useState({ total: 0, active: 0, avgRate: 0 })
  const [loading, setLoading] = useState(true)
  
  // Filter & Search State
  const [page, setPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all') // 'all', 'active', 'inactive'
  const [typeFilter, setTypeFilter] = useState('all') // 'all', 'PER_GRAM', 'PER_PIECE'
  
  const [isSheetOpen, setIsSheetOpen] = useState(false)

  // Form Setup
  const form = useForm<z.infer<typeof karigarSchema>>({
    resolver: zodResolver(karigarSchema),
    defaultValues: { karigar_code: '', labor_type: 'PER_GRAM', default_labor_rate: 0, is_active: true }
  })

  // --- 1. Fetch Summary Stats (Runs once or on mutation) ---
  const fetchStats = useCallback(async () => {
    if (!appUser) return
    
    // Get basic stats
    const { data } = await supabase
      .from('karigars')
      .select('is_active, default_labor_rate')
      .eq('company_id', appUser.company_id)

    if (data) {
      const active = data.filter(k => k.is_active).length
      const totalRate = data.reduce((acc, curr) => acc + (curr.default_labor_rate || 0), 0)
      const avg = data.length > 0 ? (totalRate / data.length).toFixed(2) : 0
      setStats({ total: data.length, active, avgRate: Number(avg) })
    }
  }, [appUser])

  // --- 2. Fetch Filtered Data (Runs on page/filter change) ---
  const fetchKarigars = useCallback(async () => {
    if (!appUser) return
    setLoading(true)

    let query = supabase
      .from('karigars')
      .select('*', { count: 'exact' })
      .eq('company_id', appUser.company_id)
      .order('karigar_code', { ascending: true })

    // Apply Search (Name OR Code)
    if (search) {
      query = query.or(`full_name.ilike.%${search}%,karigar_code.ilike.%${search}%`)
    }

    // Apply Filters
    if (statusFilter !== 'all') {
      query = query.eq('is_active', statusFilter === 'active')
    }
    if (typeFilter !== 'all') {
      query = query.eq('labor_type', typeFilter)
    }

    // Apply Pagination
    const from = (page - 1) * PAGE_SIZE
    const to = from + PAGE_SIZE - 1
    query = query.range(from, to)

    const { data, count, error } = await query

    if (error) {
      toast.error('Failed to load data')
    } else {
      setKarigars(data || [])
      setTotalCount(count || 0)
    }
    setLoading(false)
  }, [appUser, page, search, statusFilter, typeFilter])

  // Trigger fetches
  useEffect(() => { fetchStats() }, [fetchStats])
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
      fetchStats()
    } catch (err: any) {
      toast.error(err.message.includes('unique') ? 'Code already exists' : err.message)
    }
  }

  return (
    <div className="container mx-auto py-6 px-4 md:px-6 max-w-7xl space-y-6">
      
      {/* 1. Summary Cards (Auto-Updating) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-blue-50/50 border-blue-100">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-blue-600 flex items-center gap-2">
              <Users className="h-4 w-4" /> Total Workforce
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-900">{stats.total}</div>
            <p className="text-xs text-blue-600/80">Registered Artisans</p>
          </CardContent>
        </Card>

        <Card className="bg-green-50/50 border-green-100">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-green-600 flex items-center gap-2">
              <CheckCircle className="h-4 w-4" /> Active Available
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-900">{stats.active}</div>
            <p className="text-xs text-green-600/80">Ready for job allocation</p>
          </CardContent>
        </Card>

        <Card className="bg-amber-50/50 border-amber-100">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-amber-600 flex items-center gap-2">
              <TrendingUp className="h-4 w-4" /> Avg Labor Cost
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-900">₹{stats.avgRate}</div>
            <p className="text-xs text-amber-600/80">Per unit across all types</p>
          </CardContent>
        </Card>
      </div>

      {/* 2. Advanced Toolbar */}
      <div className="flex flex-col md:flex-row justify-between gap-4 items-end md:items-center bg-white p-4 rounded-lg border shadow-sm">
        <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto flex-1">
          {/* Search */}
          <div className="relative w-full md:w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search Code or Name..." 
              className="pl-9" 
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }} 
            />
          </div>

          {/* Filters */}
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
            <SelectTrigger className="w-full md:w-32">
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

          <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setPage(1); }}>
            <SelectTrigger className="w-full md:w-40">
               <SelectValue placeholder="Labor Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="PER_GRAM">Per Gram</SelectItem>
              <SelectItem value="PER_PIECE">Per Piece</SelectItem>
              <SelectItem value="FIXED">Fixed Pay</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Add Button */}
        <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
          <SheetTrigger asChild>
            <Button className="w-full md:w-auto"><Plus className="mr-2 h-4 w-4" /> Add Karigar</Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-[100%] sm:w-[500px] overflow-y-auto">
             <SheetHeader>
                <SheetTitle>New Karigar</SheetTitle>
                <SheetDescription>Register artisan details and standard rates.</SheetDescription>
             </SheetHeader>
             <KarigarForm form={form} onSubmit={onSubmit} />
          </SheetContent>
        </Sheet>
      </div>

      {/* 3. Data Table with Live Preview */}
      <div className="rounded-md border bg-white shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-gray-50/50">
            <TableRow>
              <TableHead className="w-[100px]">Code</TableHead>
              <TableHead>Details</TableHead>
              <TableHead>Specialization</TableHead>
              <TableHead className="text-right">Live Rate Preview</TableHead>
              <TableHead className="text-right">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              [...Array(5)].map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-32 mb-2" /><Skeleton className="h-3 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell className="text-right"><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                  <TableCell className="text-right"><Skeleton className="h-5 w-16 ml-auto" /></TableCell>
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
                <TableRow key={k.id} className="group hover:bg-gray-50/50 transition-colors">
                  <TableCell className="font-mono font-medium text-primary">
                    {k.karigar_code}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium text-gray-900">{k.full_name}</span>
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        {k.phone || 'No phone'}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {k.specialization ? (
                      <Badge variant="outline" className="bg-slate-50">{k.specialization}</Badge>
                    ) : '-'}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex flex-col items-end">
                      <span className="font-bold text-gray-900">₹{k.default_labor_rate}</span>
                      <span className="text-[10px] uppercase text-muted-foreground font-medium tracking-wide">
                        {k.labor_type.replace('_', ' ')}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge variant={k.is_active ? 'default' : 'secondary'} className={k.is_active ? "bg-green-600" : ""}>
                      {k.is_active ? 'Active' : 'Inactive'}
                    </Badge>
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
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1 || loading}
          >
            <ChevronLeft className="h-4 w-4" /> Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(p => p + 1)}
            disabled={page * PAGE_SIZE >= totalCount || loading}
          >
            Next <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

    </div>
  )
}

// --- Subcomponent: Form (Extracted for cleanliness) ---
function KarigarForm({ form, onSubmit }: { form: any, onSubmit: any }) {
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5 mt-6">
        <div className="grid grid-cols-2 gap-4">
          <FormField control={form.control} name="karigar_code" render={({ field }) => (
            <FormItem>
              <FormLabel>Code</FormLabel>
              <FormControl><Input placeholder="K-001" className="uppercase" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="full_name" render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl><Input placeholder="Full Name" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </div>

        <FormField control={form.control} name="phone" render={({ field }) => (
          <FormItem>
            <FormLabel>Phone</FormLabel>
            <FormControl><Input placeholder="+91..." {...field} /></FormControl>
          </FormItem>
        )} />

        <div className="p-4 bg-slate-50 rounded-lg border">
          <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
            <Wallet className="h-4 w-4" /> Cost Configuration
          </h4>
          <div className="grid grid-cols-2 gap-4">
             <FormField control={form.control} name="labor_type" render={({ field }) => (
              <FormItem>
                <FormLabel>Type</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl><SelectTrigger className="bg-white"><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent>
                    <SelectItem value="PER_GRAM">Per Gram</SelectItem>
                    <SelectItem value="PER_PIECE">Per Piece</SelectItem>
                    <SelectItem value="FIXED">Fixed</SelectItem>
                  </SelectContent>
                </Select>
              </FormItem>
            )} />
            <FormField control={form.control} name="default_labor_rate" render={({ field }) => (
              <FormItem>
                <FormLabel>Rate (₹)</FormLabel>
                <FormControl><Input type="number" className="bg-white" {...field} /></FormControl>
              </FormItem>
            )} />
          </div>
        </div>

        <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? "Saving..." : "Register Karigar"}
        </Button>
      </form>
    </Form>
  )
}