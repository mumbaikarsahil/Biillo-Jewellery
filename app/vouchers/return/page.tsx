"use client"

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/hooks/useAuth'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import { 
  Loader2, CheckCircle2, Store, Hash, ArrowLeft, ChevronRight, RefreshCw, Undo2, AlertCircle, Search, Trash2, QrCode, ChevronLeft
} from 'lucide-react'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'

export default function ReturnVouchersPage() {
  const { appUser } = useAuth()
  
  // Data States
  const [distributors, setDistributors] = useState<any[]>([])
  const [recentLogs, setRecentLogs] = useState<any[]>([])
  
  // Tab State
  const [activeTab, setActiveTab] = useState<'distributed' | 'unclaimed'>('distributed')

  // Form States
  const [distributorId, setDistributorId] = useState('all')
  const [startCode, setStartCode] = useState('')
  const [endCode, setEndCode] = useState('')
  
  // Processing States
  const [isSearching, setIsSearching] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  
  // Selection & Pagination States
  const [fetchedVouchers, setFetchedVouchers] = useState<any[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [hitLimit, setHitLimit] = useState(false)
  
  // Pagination States
  const [currentPage, setCurrentPage] = useState(1)
  const [rowsPerPage, setRowsPerPage] = useState(50)

  const fetchData = async () => {
    if (!appUser?.company_id) return
    setIsLoading(true)
    try {
      const { data: dists } = await supabase
        .from('voucher_distributors')
        .select('id, distributor_name')
        .eq('company_id', appUser.company_id)
        .order('distributor_name')
      
      if (dists) setDistributors(dists)

      // 2. Fetch Recent Logs
      const { data: returns } = await supabase
        .from('vouchers')
        .select('id, code, updated_at, status, distribution_id, voucher_batches!inner(company_id)')
        .eq('voucher_batches.company_id', appUser.company_id)
        .in('status', ['in_stock', 'voided']) 
        .order('updated_at', { ascending: false })
        .limit(200)
      
      if (returns) {
        // ✨ FIX: Only show "in_stock" items if they have a distribution_id (meaning they were returned)
        const validLogs = returns.filter(v => 
          v.status === 'voided' || (v.status === 'in_stock' && v.distribution_id !== null)
        ).slice(0, 50); // Keep it to the most recent 50
        
        setRecentLogs(validLogs)
      }

    } catch (err) {
      toast.error('Failed to load data')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [appUser])

  const handleSearchVouchers = async () => {
    setIsSearching(true)
    setFetchedVouchers([])
    setSelectedIds(new Set())
    setHitLimit(false)
    setCurrentPage(1)

    try {
      let q = supabase
        .from('vouchers')
        .select('id, code, status, distributor_id, distribution_id, voucher_distributors(distributor_name), voucher_batches!inner(company_id)')
        .eq('voucher_batches.company_id', appUser?.company_id)

      if (activeTab === 'distributed') {
        q = q.eq('status', 'distributed')
        if (distributorId && distributorId !== 'all') {
          q = q.eq('distributor_id', distributorId)
        }
      } else {
        q = q.eq('status', 'unclaimed')
      }

      if (startCode) q = q.gte('code', startCode.trim().toUpperCase())
      if (endCode) q = q.lte('code', endCode.trim().toUpperCase())

      q = q.order('code', { ascending: true }).limit(1000)

      const { data, error } = await q

      if (error) throw error

      if (!data || data.length === 0) {
        toast.error("No vouchers found matching your criteria.")
        return
      }

      if (data.length === 1000) {
        setHitLimit(true)
        toast.warning("Displaying exactly 1000 results. Please narrow your sequence range to see specific batches.")
      } else {
        toast.success(`Found ${data.length} vouchers ready for processing.`)
      }

      setFetchedVouchers(data)
      setSelectedIds(new Set(data.map(v => v.id)))

    } catch (err: any) {
      toast.error(err.message || "Failed to search vouchers")
    } finally {
      setIsSearching(false)
    }
  }

  const toggleSelection = (id: string) => {
    const newSet = new Set(selectedIds)
    if (newSet.has(id)) newSet.delete(id)
    else newSet.add(id)
    setSelectedIds(newSet)
  }

  const toggleAll = () => {
    if (selectedIds.size === currentVouchers.length) {
      const newSet = new Set(selectedIds)
      currentVouchers.forEach(v => newSet.delete(v.id))
      setSelectedIds(newSet)
    } else {
      const newSet = new Set(selectedIds)
      currentVouchers.forEach(v => newSet.add(v.id))
      setSelectedIds(newSet)
    }
  }

  const handleProcessAction = async () => {
    if (selectedIds.size === 0) return toast.error("Please select at least one voucher.")

    setIsSubmitting(true)
    try {
      const idsArray = Array.from(selectedIds)

      if (activeTab === 'distributed') {
        const { error } = await supabase
          .from('vouchers')
          .update({
            status: 'in_stock',
            distributor_id: null,
            distributed_at: null,
            is_birthday_redemption: false,
            expiry_date: null,
            updated_at: new Date().toISOString() // ✨ FIX: Force timestamp to NOW
          })
          .in('id', idsArray)

        if (error) throw error
        toast.success(`Successfully returned ${idsArray.length} vouchers to central stock!`)
      } else {
        // Soft Delete for Unclaimed Event Vouchers
        const { error } = await supabase
          .from('vouchers')
          .update({
            status: 'voided',
            distributor_id: null,
            distributed_at: null,
            expiry_date: null,
            updated_at: new Date().toISOString() // ✨ FIX: Force timestamp to NOW
          })
          .in('id', idsArray)

        if (error) throw error
        toast.success(`Permanently voided ${idsArray.length} unclaimed event vouchers!`)
      }
      
      setFetchedVouchers([])
      setSelectedIds(new Set())
      setCurrentPage(1)
      fetchData()

    } catch (err: any) {
      toast.error(err.message || "Failed to process vouchers")
    } finally {
      setIsSubmitting(false)
    }
  }

  const totalItems = fetchedVouchers.length;
  const totalPages = Math.ceil(totalItems / rowsPerPage);
  const startIndex = (currentPage - 1) * rowsPerPage;
  const endIndex = Math.min(startIndex + rowsPerPage, totalItems);
  const currentVouchers = fetchedVouchers.slice(startIndex, endIndex);

  const getDistributorName = (v: any) => {
    if (!v.voucher_distributors) return null;
    if (Array.isArray(v.voucher_distributors)) return v.voucher_distributors[0]?.distributor_name;
    return v.voucher_distributors.distributor_name;
  }

  if (isLoading) {
    return <div className="p-8 flex justify-center min-h-screen bg-[#fafafa] items-center"><Loader2 className="w-8 h-8 animate-spin text-slate-400" /></div>
  }

  return (
    <div className="flex flex-col min-h-screen bg-[#fafafa]">
      
      <header className="sticky top-0 z-40 w-full bg-white/80 backdrop-blur-md border-b border-slate-200 px-4 h-12 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3 overflow-hidden">
          <Link href="/vouchers">
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-md hover:bg-slate-100 transition-colors">
              <ArrowLeft className="h-4 w-4 text-slate-500" />
            </Button>
          </Link>
          
          <Separator orientation="vertical" className="h-4 hidden sm:block" />
          
          <nav className="hidden sm:flex items-center gap-1.5 text-[13px] whitespace-nowrap overflow-hidden">
            <Link href="/vouchers" className="text-slate-500 hover:text-slate-900 transition-colors font-medium">Vouchers</Link>
            <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
            <span className="font-bold text-slate-900 select-none">Returns & Recovery</span>
            
            <div className="ml-3 hidden md:flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-rose-50 border border-rose-200">
              <div className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse" />
              <span className="text-[10px] font-bold text-rose-700 uppercase tracking-tighter">Stock Recovery</span>
            </div>
          </nav>
        </div>

        <Button variant="ghost" size="sm" className="h-8 px-2 text-xs font-medium text-slate-500 hover:text-slate-900" onClick={fetchData}>
          <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">Refresh</span>
        </Button>
      </header>

      <main className="p-3 sm:p-4 md:p-6 lg:p-6 max-w-[1400px] w-full mx-auto animate-in fade-in duration-500">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-6 items-start">
          
          <Card className="lg:col-span-6 border-slate-200/60 shadow-sm bg-white lg:sticky lg:top-16 flex flex-col overflow-hidden h-[calc(100vh-6rem)]">
            
            <Tabs value={activeTab} onValueChange={(v: any) => { setActiveTab(v); setFetchedVouchers([]); setSelectedIds(new Set()); setCurrentPage(1); }} className="w-full flex flex-col flex-1 min-h-0">
              <CardHeader className="bg-slate-50/80 border-b border-slate-100 p-4 shrink-0">
                <TabsList className="w-full grid grid-cols-2 bg-slate-200/50 p-1 rounded-xl">
                  <TabsTrigger value="distributed" className="text-xs font-bold data-[state=active]:bg-white data-[state=active]:text-rose-700 data-[state=active]:shadow-sm rounded-lg">
                    <Store className="w-3.5 h-3.5 mr-1.5" /> Return Partner Stock
                  </TabsTrigger>
                  <TabsTrigger value="unclaimed" className="text-xs font-bold data-[state=active]:bg-white data-[state=active]:text-red-600 data-[state=active]:shadow-sm rounded-lg">
                    <QrCode className="w-3.5 h-3.5 mr-1.5" /> Event Cleanup
                  </TabsTrigger>
                </TabsList>
              </CardHeader>
              
              <CardContent className="p-0 flex flex-col flex-1 min-h-0">
                
                {/* Search Filters */}
                <div className="p-5 space-y-4 bg-white border-b border-slate-100 shrink-0">
                  {activeTab === 'distributed' && (
                    <div className="space-y-2">
                      <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Filter by Distributor</Label>
                      <Select value={distributorId} onValueChange={setDistributorId}>
                        <SelectTrigger className="h-10 text-sm font-semibold bg-slate-50 border-slate-200 focus:ring-rose-500 rounded-xl">
                          <SelectValue placeholder="All Distributors" />
                        </SelectTrigger>
                        <SelectContent className="border-slate-200 rounded-xl">
                          <SelectItem value="all" className="font-bold text-slate-500">All Distributors</SelectItem>
                          {distributors.map(d => (
                            <SelectItem key={d.id} value={d.id} className="cursor-pointer font-medium">
                              {d.distributor_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                      <Hash className="w-3.5 h-3.5" /> Sequence Target (Optional)
                    </Label>
                    <div className="grid grid-cols-2 gap-3">
                      <Input 
                        placeholder="Start Code" 
                        value={startCode} 
                        onChange={(e) => setStartCode(e.target.value)}
                        className="h-10 text-sm font-bold uppercase font-mono bg-white border-slate-200 focus-visible:ring-rose-500 rounded-xl shadow-sm"
                      />
                      <Input 
                        placeholder="End Code" 
                        value={endCode} 
                        onChange={(e) => setEndCode(e.target.value)}
                        className="h-10 text-sm font-bold uppercase font-mono bg-white border-slate-200 focus-visible:ring-rose-500 rounded-xl shadow-sm"
                      />
                    </div>
                  </div>

                  <Button 
                    variant="outline" 
                    className="w-full h-10 text-xs font-bold text-slate-700 border-slate-300 bg-white hover:bg-slate-50 rounded-xl shadow-sm"
                    onClick={handleSearchVouchers}
                    disabled={isSearching}
                  >
                    {isSearching ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Search className="w-4 h-4 mr-2 text-slate-500" />}
                    Fetch Target Vouchers
                  </Button>
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-0 bg-slate-50/30 relative">
                  {fetchedVouchers.length > 0 ? (
                    <table className="w-full text-left border-collapse relative">
                      <thead className="bg-slate-50 sticky top-0 z-10 shadow-[0_1px_2px_rgba(0,0,0,0.05)] border-b border-slate-200">
                        <tr>
                          <th className="px-4 py-2 w-12 text-center">
                            <input 
                              type="checkbox" 
                              className="w-4 h-4 rounded border-slate-300 text-rose-600 focus:ring-rose-500 cursor-pointer"
                              checked={selectedIds.size > 0 && currentVouchers.every(v => selectedIds.has(v.id))}
                              onChange={toggleAll}
                              title="Select/Deselect Visible Page"
                            />
                          </th>
                          <th className="px-2 py-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">Code</th>
                          <th className="px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-slate-500 text-right">Assignment</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {currentVouchers.map(v => {
                          const distName = getDistributorName(v);
                          
                          return (
                            <tr key={v.id} className="hover:bg-white transition-colors cursor-pointer" onClick={() => toggleSelection(v.id)}>
                              <td className="px-4 py-3 text-center">
                                {/* ✨ FIX: Changed empty onChange to toggleSelection so the checkbox itself is clickable */}
                                <input 
                                  type="checkbox" 
                                  className="w-4 h-4 rounded border-slate-300 text-rose-600 focus:ring-rose-500 cursor-pointer"
                                  checked={selectedIds.has(v.id)}
                                  onChange={() => toggleSelection(v.id)} 
                                  onClick={e => e.stopPropagation()} 
                                />
                              </td>
                              <td className="px-2 py-3 font-mono font-bold text-sm text-slate-800">{v.code}</td>
                              <td className="px-4 py-3 text-right">
                                {v.status === 'unclaimed' ? (
                                  <Badge variant="outline" className="text-[8px] bg-indigo-50 text-indigo-600 uppercase tracking-widest border-none shadow-sm">Event Pool</Badge>
                                ) : distName ? (
                                  <span className="text-xs font-semibold text-slate-600 truncate max-w-[120px] block float-right">
                                    {distName}
                                  </span>
                                ) : (
                                  <span className="text-[10px] font-bold text-red-500 uppercase tracking-widest">Unknown Vendor</span>
                                )}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 p-8 text-center">
                      <Search className="w-10 h-10 opacity-20 mb-3" />
                      <p className="text-sm font-semibold">Enter criteria and fetch vouchers to begin selection.</p>
                    </div>
                  )}
                </div>

                {/* Pagination Control Bar */}
                {fetchedVouchers.length > 0 && (
                  <div className="flex items-center justify-between px-4 py-2 bg-slate-50 border-t border-slate-200 shrink-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest hidden sm:inline">Rows:</span>
                      <Select value={rowsPerPage.toString()} onValueChange={(val) => { setRowsPerPage(Number(val)); setCurrentPage(1); }}>
                        <SelectTrigger className="h-7 w-16 text-xs font-bold bg-white border-slate-200 rounded-md shadow-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="50" className="text-xs font-medium">50</SelectItem>
                          <SelectItem value="100" className="text-xs font-medium">100</SelectItem>
                          <SelectItem value="200" className="text-xs font-medium">200</SelectItem>
                          <SelectItem value="500" className="text-xs font-medium">500</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                      {startIndex + 1} - {endIndex} of {totalItems}
                    </span>

                    <div className="flex items-center gap-1">
                      <Button variant="outline" size="icon" className="h-7 w-7 border-slate-200" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}>
                        <ChevronLeft className="w-4 h-4 text-slate-600" />
                      </Button>
                      <Button variant="outline" size="icon" className="h-7 w-7 border-slate-200" disabled={currentPage === totalPages || totalPages === 0} onClick={() => setCurrentPage(p => p + 1)}>
                        <ChevronRight className="w-4 h-4 text-slate-600" />
                      </Button>
                    </div>
                  </div>
                )}

                {/* Footer Action */}
                <div className="p-4 border-t border-slate-200 bg-white shrink-0 shadow-[0_-4px_10px_rgba(0,0,0,0.02)]">
                  {hitLimit && (
                    <p className="text-[10px] text-amber-600 font-bold uppercase tracking-widest mb-3 text-center flex items-center justify-center gap-1.5 bg-amber-50 py-1.5 rounded-lg border border-amber-200">
                      <AlertCircle className="w-3.5 h-3.5" /> 1000 Record limit reached
                    </p>
                  )}
                  
                  <Button 
                    className={cn(
                      "w-full h-12 font-bold uppercase tracking-widest text-xs shadow-md transition-all disabled:opacity-50 rounded-xl",
                      activeTab === 'distributed' 
                        ? "bg-rose-600 hover:bg-rose-700 text-white shadow-rose-200" 
                        : "bg-red-600 hover:bg-red-700 text-white shadow-red-200"
                    )}
                    onClick={handleProcessAction}
                    disabled={isSubmitting || selectedIds.size === 0}
                  >
                    {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : 
                     activeTab === 'distributed' ? <Undo2 className="w-4 h-4 mr-2" /> : <Trash2 className="w-4 h-4 mr-2" />}
                     
                    {activeTab === 'distributed' 
                      ? `Return Selected (${selectedIds.size}) to Stock` 
                      : `Permanently Delete (${selectedIds.size}) Vouchers`
                    }
                  </Button>
                </div>
              </CardContent>
            </Tabs>
          </Card>

          {/* ============================================== */}
          {/* RIGHT: RETURN HISTORY LOG                      */}
          {/* ============================================== */}
          <Card className="lg:col-span-6 border-slate-200/60 shadow-sm bg-white overflow-hidden flex flex-col h-[calc(100vh-6rem)]">
            <CardHeader className="bg-slate-50/80 border-b border-slate-100 p-4 shrink-0 flex flex-row items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Recent System Logs</h3>
                <p className="text-[11px] font-medium text-slate-500 mt-0.5">Showing last 50 processed actions</p>
              </div>
              <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-widest text-slate-500 bg-white border-slate-200 rounded-lg">
                Inventory Trail
              </Badge>
            </CardHeader>

            <CardContent className="p-0 flex-1 overflow-auto custom-scrollbar">
              <Table>
                <TableHeader className="bg-slate-50/80 sticky top-0 backdrop-blur-sm z-10 border-b border-slate-200">
                  <TableRow className="hover:bg-transparent border-none">
                    <TableHead className="text-[10px] uppercase font-black tracking-widest text-slate-500 h-10 px-6 w-[150px]">Time</TableHead>
                    <TableHead className="text-[10px] uppercase font-black tracking-widest text-slate-500 h-10">Voucher Code</TableHead>
                    <TableHead className="text-[10px] uppercase font-black tracking-widest text-slate-500 h-10 text-right pr-6">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentLogs.map((v) => (
                    <TableRow key={v.id} className="hover:bg-slate-50/50 transition-colors border-b border-slate-100">
                      <TableCell className="text-[11px] font-bold text-slate-500 px-6 py-3">
                        {format(new Date(v.updated_at), 'dd MMM, HH:mm')}
                      </TableCell>
                      <TableCell className="py-3">
                        <span className="font-mono font-bold text-sm text-slate-900">{v.code}</span>
                      </TableCell>
                      <TableCell className="text-right pr-6 py-3">
                        {v.status === 'in_stock' ? (
                          <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 shadow-none text-[9px] uppercase tracking-widest font-bold">
                            Stock Restored
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 shadow-none text-[9px] uppercase tracking-widest font-bold">
                            Deleted/Voided
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  
                  {recentLogs.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center py-24 text-slate-400">
                        <div className="flex flex-col items-center justify-center gap-3">
                          <AlertCircle className="w-8 h-8 opacity-20" />
                          <span className="text-xs font-bold uppercase tracking-widest italic">No recent logs found.</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

        </div>
      </main>
    </div>
  )
}