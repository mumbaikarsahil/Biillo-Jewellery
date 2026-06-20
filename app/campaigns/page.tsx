"use client"

import React, { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table"
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter 
} from "@/components/ui/dialog"
import { 
  Loader2, Clock, CheckCircle2, PlayCircle, StopCircle, Edit3, MessageCircle, Settings2, CalendarClock,
  Search, ChevronLeft, ChevronRight, Mail, Users, Filter, ArrowUpDown, X,
  RefreshCw
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Separator } from '@/components/ui/separator'

export default function CampaignManagerPage() {
  const [sequences, setSequences] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  
  // Modal states
  const [editingSeq, setEditingSeq] = useState<any | null>(null)
  const [newInterval, setNewInterval] = useState<string>('')
  const [newStep, setNewStep] = useState<string>('2')
  const [newNextSendAt, setNewNextSendAt] = useState<string>('')
  const [isUpdating, setIsUpdating] = useState(false)

  // ✨ NEW: Advanced Filtering & Sorting States
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'completed' | 'overdue'>('all')
  const [sortOrder, setSortOrder] = useState<'next_send_asc' | 'next_send_desc' | 'newest'>('next_send_asc')

  // ✨ NEW: Pagination States
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState<number>(50)
  const [totalCount, setTotalCount] = useState(0)

  // Search Debouncer
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm)
      setPage(0) 
    }, 500)
    return () => clearTimeout(timer)
  }, [searchTerm])

  const fetchSequences = async () => {
    setIsLoading(true)
    try {
      let query = supabase
        .from('voucher_message_sequences')
        .select(`
          *,
          customers ( full_name, phone )
        `, { count: 'exact' })

      // Apply Search
      if (debouncedSearch) {
        query = query.ilike('voucher_code', `%${debouncedSearch}%`)
      }

      // Apply Status Filters
      if (filterStatus === 'active') query = query.eq('status', 'active');
      if (filterStatus === 'completed') query = query.eq('status', 'completed');
      if (filterStatus === 'overdue') {
        query = query.eq('status', 'active').lt('next_send_at', new Date().toISOString());
      }

      // Apply Sorting
      if (sortOrder === 'next_send_asc') query = query.order('next_send_at', { ascending: true, nullsFirst: false });
      else if (sortOrder === 'next_send_desc') query = query.order('next_send_at', { ascending: false, nullsFirst: false });
      else if (sortOrder === 'newest') query = query.order('created_at', { ascending: false });

      // Apply Pagination
      query = query.range(page * pageSize, (page + 1) * pageSize - 1)

      const { data, error, count } = await query

      if (error) throw error
      setSequences(data || [])
      setTotalCount(count || 0)
    } catch (err: any) {
      toast.error('Failed to load sequences: ' + err.message)
    } finally {
      setIsLoading(false)
    }
  }

  // Refetch whenever dependencies change
  useEffect(() => {
    fetchSequences()
  }, [debouncedSearch, filterStatus, sortOrder, page, pageSize])

  // ── Actions ──────────────────────────────────────────────
  const handleStopSequence = async (id: string) => {
    if (!confirm("Are you sure you want to stop this drip campaign?")) return;
    try {
      const { error } = await supabase.from('voucher_message_sequences').update({ status: 'completed' }).eq('id', id)
      if (error) throw error
      toast.success("Sequence successfully stopped.")
      fetchSequences()
    } catch (err: any) {
      toast.error("Failed to stop sequence: " + err.message)
    }
  }

  const handleResumeSequence = async (id: string) => {
    try {
      const { error } = await supabase.from('voucher_message_sequences').update({ status: 'active' }).eq('id', id)
      if (error) throw error
      toast.success("Sequence is active again.")
      fetchSequences()
    } catch (err: any) {
      toast.error("Failed to resume sequence: " + err.message)
    }
  }

  const handleUpdateSequence = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingSeq) return

    const hours = parseInt(newInterval)
    const step = parseInt(newStep)

    if (isNaN(hours) || hours <= 0) return toast.error("Please enter a valid number of hours.")
    if (isNaN(step) || step < 2 || step > 7) return toast.error("Step must be between 2 and 7.")
    if (!newNextSendAt) return toast.error("Please select a valid next send date.")

    setIsUpdating(true)
    try {
      const nextSendAtISO = new Date(newNextSendAt).toISOString()

      const { error } = await supabase
        .from('voucher_message_sequences')
        .update({ interval_hours: hours, current_step: step, next_send_at: nextSendAtISO })
        .eq('id', editingSeq.id)

      if (error) throw error

      toast.success("Sequence configuration updated!")
      setEditingSeq(null)
      fetchSequences()
    } catch (err: any) {
      toast.error("Failed to update sequence: " + err.message)
    } finally {
      setIsUpdating(false)
    }
  }

  const openEditModal = (seq: any) => {
    setEditingSeq(seq)
    setNewInterval(seq.interval_hours.toString())
    setNewStep(seq.current_step.toString())
    
    const d = new Date(seq.next_send_at)
    const tzOffset = d.getTimezoneOffset() * 60000
    const localISOTime = (new Date(d.getTime() - tzOffset)).toISOString().slice(0,16)
    setNewNextSendAt(localISOTime)
  }

  const formatStep = (step: number) => {
    if (step >= 7) return "Completed"
    return `Msg ${step - 1} (Step ${step})`
  }

  const formatDate = (dateString: string) => {
    return new Intl.DateTimeFormat('en-IN', {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
    }).format(new Date(dateString))
  }

  return (
    <div className="flex flex-col min-h-screen bg-[#fafafa] font-sans pb-20">
      {/* GLOBAL HEADER */}
      <header className="h-14 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between sticky top-0 z-40 shadow-sm box-border">
        <div className="flex items-center gap-2.5">
          <div className="h-7 w-7 bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center rounded text-xs shadow-sm">
            <Mail className="w-3.5 h-3.5" />
          </div>
          <div>
             <h1 className="text-sm font-bold text-slate-800 tracking-tight leading-none">Drip Campaigns</h1>
             <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mt-0.5 hidden sm:block">Automated Message Sequences</p>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={fetchSequences} className="h-8 px-2 text-xs font-bold text-slate-500 hover:text-slate-800">
          <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isLoading ? 'animate-spin text-indigo-500' : ''}`} />
          Refresh
        </Button>
      </header>

      <main className="p-4 md:p-6 max-w-7xl w-full mx-auto space-y-6">
        
        {/* ✨ REDESIGNED: Compact Command Bar */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col">
          <div className="bg-slate-50/80 border-b border-slate-100 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
             <div className="flex items-center gap-2">
               <div className="bg-indigo-100 p-1.5 rounded text-indigo-600 hidden sm:block"><Filter className="w-4 h-4" /></div>
               <span className="text-xs font-bold text-slate-700 uppercase tracking-widest hidden sm:block">Command Bar</span>
               <span className="text-[11px] font-bold text-slate-500 uppercase tracking-widest sm:hidden flex items-center gap-1.5"><Filter className="w-3.5 h-3.5" /> Filters</span>
             </div>
             
             <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 w-full sm:w-auto justify-end">
                <div className="relative w-full sm:w-[220px]">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <Input 
                    placeholder="Search codes..." 
                    className="pl-8 h-8 text-[11px] font-bold bg-white border-slate-200 shadow-sm rounded-lg"
                    value={searchTerm} 
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
             </div>
          </div>

          <div className="p-3 bg-white grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2">
            <Select value={filterStatus} onValueChange={(val: any) => setFilterStatus(val)}>
              <SelectTrigger className="h-8 w-full sm:w-[140px] text-[11px] font-bold bg-white border-slate-200 text-slate-700 shadow-sm rounded">
                <SelectValue placeholder="Status Filter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs font-bold text-indigo-600">All Statuses</SelectItem>
                <SelectItem value="active" className="text-xs font-bold">Active</SelectItem>
                <SelectItem value="completed" className="text-xs font-bold">Completed</SelectItem>
                <SelectItem value="overdue" className="text-xs font-bold text-rose-600">Overdue</SelectItem>
              </SelectContent>
            </Select>

            <Select value={sortOrder} onValueChange={(val: any) => setSortOrder(val)}>
              <SelectTrigger className="h-8 w-full sm:w-[160px] text-[11px] font-bold bg-white border-slate-200 text-slate-700 shadow-sm rounded">
                 <div className="flex items-center gap-1.5"><ArrowUpDown className="w-3.5 h-3.5 text-slate-400" /> <span className="truncate"><SelectValue placeholder="Sort By" /></span></div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="next_send_asc" className="text-xs font-bold">Next Send: Soonest</SelectItem>
                <SelectItem value="next_send_desc" className="text-xs font-bold">Next Send: Latest</SelectItem>
                <SelectItem value="newest" className="text-xs font-bold">Recently Added</SelectItem>
              </SelectContent>
            </Select>

            {(filterStatus !== 'all' || sortOrder !== 'next_send_asc' || debouncedSearch) && (
              <Button variant="ghost" size="sm" onClick={() => { setFilterStatus('all'); setSortOrder('next_send_asc'); setSearchTerm(''); }} className="h-8 px-2 text-[10px] font-bold text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded col-span-2 sm:col-span-1 sm:ml-auto">
                <X className="w-3 h-3 mr-1" /> Clear Filters
              </Button>
            )}
          </div>
        </div>

        {/* MAIN LIST AREA */}
        <Card className="flex-1 flex flex-col border-slate-200 shadow-sm overflow-hidden bg-white rounded-xl">
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex justify-center items-center py-24"><Loader2 className="w-6 h-6 animate-spin text-indigo-500" /></div>
            ) : sequences.length === 0 ? (
              <div className="text-center py-20 bg-slate-50/50">
                <Mail className="w-10 h-10 mx-auto mb-3 text-slate-300" />
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">No sequences found matching filters.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table className="hidden sm:table">
                  <TableHeader className="bg-slate-50/80 sticky top-0 z-10 border-b border-slate-200 shadow-sm">
                    <TableRow className="border-none hover:bg-transparent">
                      <TableHead className="text-[10px] uppercase font-bold tracking-widest text-slate-500 h-9 px-6">Customer / Voucher</TableHead>
                      <TableHead className="text-[10px] uppercase font-bold tracking-widest text-slate-500 h-9 text-center">Progress</TableHead>
                      <TableHead className="text-[10px] uppercase font-bold tracking-widest text-slate-500 h-9 text-center">Next Send</TableHead>
                      <TableHead className="text-[10px] uppercase font-bold tracking-widest text-slate-500 h-9 text-center">Interval</TableHead>
                      <TableHead className="text-[10px] uppercase font-bold tracking-widest text-slate-500 h-9 text-center">Status</TableHead>
                      <TableHead className="text-[10px] uppercase font-bold tracking-widest text-slate-500 h-9 text-right pr-6">Controls</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sequences.map((seq) => (
                      <TableRow key={seq.id} className="hover:bg-slate-50/50 transition-colors border-b border-slate-100">
                        <TableCell className="px-6 py-3">
                          <div className="font-bold text-[13px] text-slate-800 flex items-center gap-2">
                            {seq.customers?.full_name || "Unknown User"} 
                            <span className="text-[9px] font-mono bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 text-slate-600 uppercase tracking-wider">{seq.voucher_code}</span>
                          </div>
                          <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5 font-bold">
                            <MessageCircle className="w-3 h-3 text-emerald-500" /> {seq.customers?.phone || "No Phone"}
                          </div>
                        </TableCell>
                        
                        <TableCell className="text-center py-3">
                          <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2.5 py-1 rounded-full whitespace-nowrap">
                            {formatStep(seq.current_step)}
                          </span>
                        </TableCell>

                        <TableCell className="text-center py-3">
                          {seq.status === 'completed' ? (
                            <span className="text-slate-400 text-[11px] font-bold">---</span>
                          ) : (
                            <div className="flex flex-col items-center justify-center">
                              <span className="text-[11px] font-bold text-slate-800 whitespace-nowrap">{formatDate(seq.next_send_at)}</span>
                              {new Date(seq.next_send_at) < new Date() && (
                                <span className="text-[8px] font-bold uppercase tracking-widest text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-100 mt-0.5">Overdue</span>
                              )}
                            </div>
                          )}
                        </TableCell>

                        <TableCell className="text-center py-3">
                          <span className="font-mono text-[10px] font-bold bg-slate-100 px-2 py-0.5 rounded text-slate-600">{seq.interval_hours}H</span>
                        </TableCell>

                        <TableCell className="text-center py-3">
                          {seq.status === 'active' ? (
                            <Badge variant="secondary" className="bg-emerald-50 text-emerald-600 border-emerald-200 shadow-none text-[9px] uppercase font-bold tracking-widest px-1.5">
                              <PlayCircle className="w-3 h-3 mr-1" /> Active
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="bg-slate-100 text-slate-500 border-slate-200 shadow-none text-[9px] uppercase font-bold tracking-widest px-1.5">
                              <CheckCircle2 className="w-3 h-3 mr-1" /> Stopped
                            </Badge>
                          )}
                        </TableCell>

                        <TableCell className="text-right pr-6 py-3">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button size="icon" variant="outline" className="h-7 w-7 text-indigo-600 border-indigo-200 hover:bg-indigo-50 rounded" onClick={() => openEditModal(seq)}>
                              <Settings2 className="w-3.5 h-3.5" />
                            </Button>

                            {seq.status === 'active' ? (
                              <Button size="sm" variant="outline" className="h-7 px-2 border-rose-200 text-rose-600 hover:bg-rose-50 font-bold uppercase tracking-widest text-[9px] rounded" onClick={() => handleStopSequence(seq.id)}>
                                <StopCircle className="w-3 h-3 mr-1" /> Stop
                              </Button>
                            ) : (
                              <Button size="sm" variant="outline" className="h-7 px-2 border-slate-200 text-slate-500 hover:bg-slate-50 font-bold uppercase tracking-widest text-[9px] rounded" onClick={() => handleResumeSequence(seq.id)}>
                                <PlayCircle className="w-3 h-3 mr-1" /> Resume
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {/* ✨ COMPACT MOBILE CARD VIEW */}
                <div className="sm:hidden flex flex-col divide-y divide-slate-100">
                  {sequences.map(seq => (
                     <div key={seq.id} className="p-3 bg-white hover:bg-slate-50 transition-colors">
                        <div className="flex justify-between items-start mb-2">
                           <div>
                             <h3 className="font-bold text-[13px] text-slate-800 leading-none">{seq.customers?.full_name || "Unknown User"}</h3>
                             <div className="flex items-center gap-1.5 mt-1.5">
                               <p className="text-[10px] font-mono text-slate-500 bg-slate-100 px-1 rounded uppercase tracking-wider">{seq.voucher_code}</p>
                               <span className="text-[10px] text-slate-400 font-bold flex items-center gap-0.5"><MessageCircle className="w-2.5 h-2.5 text-emerald-500"/> {seq.customers?.phone}</span>
                             </div>
                           </div>
                           {seq.status === 'active' ? (
                              <Badge variant="secondary" className="bg-emerald-50 text-emerald-600 border-emerald-200 shadow-none text-[8px] uppercase font-bold tracking-widest px-1"><PlayCircle className="w-2.5 h-2.5 mr-1" /> Active</Badge>
                           ) : (
                              <Badge variant="secondary" className="bg-slate-100 text-slate-500 border-slate-200 shadow-none text-[8px] uppercase font-bold tracking-widest px-1"><CheckCircle2 className="w-2.5 h-2.5 mr-1" /> Stopped</Badge>
                           )}
                        </div>
                        
                        <div className="grid grid-cols-2 gap-2 mb-3 bg-slate-50 rounded p-2 border border-slate-100">
                           <div>
                              <p className="text-[8px] font-bold uppercase tracking-widest text-slate-400 mb-0.5">Progress</p>
                              <p className="text-[11px] font-bold text-indigo-700">{formatStep(seq.current_step)}</p>
                           </div>
                           <div>
                              <p className="text-[8px] font-bold uppercase tracking-widest text-slate-400 mb-0.5">Next Send</p>
                              {seq.status === 'completed' ? (
                                <p className="text-[11px] font-bold text-slate-400">---</p>
                              ) : (
                                <div className="flex flex-col">
                                  <span className="text-[11px] font-bold text-slate-800">{formatDate(seq.next_send_at)}</span>
                                  {new Date(seq.next_send_at) < new Date() && <span className="text-[8px] font-bold text-rose-600 uppercase tracking-widest mt-0.5">Overdue</span>}
                                </div>
                              )}
                           </div>
                        </div>

                        <div className="flex gap-1.5">
                           <Button size="sm" variant="outline" className="flex-1 h-7 text-indigo-600 border-indigo-200 hover:bg-indigo-50 font-bold text-[10px] rounded" onClick={() => openEditModal(seq)}>
                              <Settings2 className="w-3 h-3 mr-1" /> Edit
                           </Button>
                           {seq.status === 'active' ? (
                              <Button size="sm" variant="outline" className="flex-1 h-7 border-rose-200 text-rose-600 hover:bg-rose-50 font-bold text-[10px] rounded uppercase tracking-widest" onClick={() => handleStopSequence(seq.id)}>
                                <StopCircle className="w-3 h-3 mr-1" /> Stop
                              </Button>
                            ) : (
                              <Button size="sm" variant="outline" className="flex-1 h-7 border-slate-200 text-slate-500 hover:bg-slate-50 font-bold text-[10px] rounded uppercase tracking-widest" onClick={() => handleResumeSequence(seq.id)}>
                                <PlayCircle className="w-3 h-3 mr-1" /> Resume
                              </Button>
                            )}
                        </div>
                     </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>

          {/* ✨ PAGINATION FOOTER */}
          {totalCount > 0 && (
            <div className="bg-slate-50 border-t border-slate-200 p-3 sm:p-4 flex flex-col sm:flex-row items-center justify-between gap-3 rounded-b-xl">
              <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-start">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Rows per page:</span>
                <Select value={pageSize.toString()} onValueChange={(val) => { setPageSize(Number(val)); setPage(0); }}>
                  <SelectTrigger className="h-7 w-[70px] text-[11px] font-bold bg-white border-slate-200 shadow-sm rounded">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-lg border-slate-200">
                    <SelectItem value="50" className="text-xs font-bold">50</SelectItem>
                    <SelectItem value="100" className="text-xs font-bold">100</SelectItem>
                    <SelectItem value="200" className="text-xs font-bold">200</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                  Showing <span className="text-indigo-600">{sequences.length > 0 ? page * pageSize + 1 : 0}</span> to <span className="text-indigo-600">{Math.min((page + 1) * pageSize, totalCount)}</span> of <span className="text-indigo-600">{totalCount}</span>
                </span>
                <div className="flex items-center gap-1.5 w-full sm:w-auto">
                  <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0 || isLoading} className="flex-1 sm:flex-none h-7 px-3 text-[10px] font-bold bg-white text-slate-600 shadow-sm rounded border-slate-200 hover:bg-slate-50 uppercase tracking-widest">
                    <ChevronLeft className="w-3.5 h-3.5 mr-1"/> Prev
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)} disabled={(page + 1) * pageSize >= totalCount || isLoading} className="flex-1 sm:flex-none h-7 px-3 text-[10px] font-bold bg-white text-slate-600 shadow-sm rounded border-slate-200 hover:bg-slate-50 uppercase tracking-widest">
                    Next <ChevronRight className="w-3.5 h-3.5 ml-1"/>
                  </Button>
                </div>
              </div>
            </div>
          )}
        </Card>
      </main>

      {/* ── Edit Sequence Configuration Modal ── */}
      <Dialog open={!!editingSeq} onOpenChange={(open) => !open && setEditingSeq(null)}>
        <DialogContent className="sm:max-w-[450px] p-0 border-none shadow-2xl rounded-2xl bg-white overflow-hidden">
          <DialogHeader className="bg-slate-50 p-6 border-b border-slate-100">
            <DialogTitle className="flex items-center gap-2 text-indigo-900 text-lg font-bold">
              <CalendarClock className="w-5 h-5 text-indigo-600" /> Sequence Configuration
            </DialogTitle>
            <DialogDescription className="text-xs font-bold text-slate-500 mt-1">
              Modify the queue behavior for voucher <span className="font-mono font-bold text-indigo-600 bg-indigo-50 px-1 rounded uppercase tracking-wider">{editingSeq?.voucher_code}</span>.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleUpdateSequence}>
            <div className="p-6 space-y-5">
              {/* Row 1: Next Step and Interval */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Next Step (Msg #)</Label>
                  <Select value={newStep} onValueChange={setNewStep}>
                    <SelectTrigger className="h-10 rounded-lg bg-white border-slate-200 text-xs font-bold focus:ring-indigo-500 shadow-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-lg border-slate-200">
                      <SelectItem value="2" className="text-xs font-bold">Step 2 (Msg 1)</SelectItem>
                      <SelectItem value="3" className="text-xs font-bold">Step 3 (Msg 2)</SelectItem>
                      <SelectItem value="4" className="text-xs font-bold">Step 4 (Msg 3)</SelectItem>
                      <SelectItem value="5" className="text-xs font-bold">Step 5 (Msg 4)</SelectItem>
                      <SelectItem value="6" className="text-xs font-bold">Step 6 (Msg 5)</SelectItem>
                      <SelectItem value="7" className="text-xs font-bold">Step 7 (Final Msg)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Interval (Hours)</Label>
                  <Input 
                    type="number" 
                    min="1" 
                    required 
                    value={newInterval} 
                    onChange={(e) => setNewInterval(e.target.value)} 
                    className="font-mono text-sm font-bold h-10 border-slate-200 rounded-lg focus-visible:ring-indigo-500 shadow-sm"
                  />
                </div>
              </div>

              {/* Row 2: Next Send Date Picker */}
              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Next Send Date & Time</Label>
                <Input 
                  type="datetime-local" 
                  required 
                  value={newNextSendAt} 
                  onChange={(e) => setNewNextSendAt(e.target.value)} 
                  className="h-10 text-xs font-bold border-slate-200 rounded-lg focus-visible:ring-indigo-500 shadow-sm"
                />
              </div>
            </div>

            <DialogFooter className="bg-slate-50 p-4 border-t border-slate-100 flex-row gap-3">
              <Button type="button" variant="outline" className="flex-1 h-10 rounded-lg text-xs font-bold uppercase tracking-widest text-slate-500 border-slate-200 hover:bg-slate-100" onClick={() => setEditingSeq(null)} disabled={isUpdating}>Cancel</Button>
              <Button type="submit" className="flex-[2] h-10 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs uppercase tracking-widest shadow-md" disabled={isUpdating}>
                {isUpdating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Settings2 className="w-4 h-4 mr-2" />}
                Save Config
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}