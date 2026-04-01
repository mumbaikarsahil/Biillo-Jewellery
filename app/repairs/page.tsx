'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { 
  Wrench, Hammer, ArrowLeft, Loader2, CheckCircle2, 
  Truck, Search, AlertCircle, IndianRupee, Store, PlusCircle, Database
} from 'lucide-react'
import { toast } from 'sonner'

import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/hooks/useAuth'
import { useStoreLocation } from '@/hooks/useStoreLocation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export default function RepairsDashboard() {
  const { appUser } = useAuth()
  const router = useRouter()
  
  const { isHQ, isLocked, selectedLocation, setSelectedLocation } = useStoreLocation()
  const [warehouses, setWarehouses] = useState<any[]>([])
  
  const [activeTab, setActiveTab] = useState<'store' | 'workshop'>('store')
  const [tickets, setTickets] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  
  // Real Database References for the Job Bag
  const [karigars, setKarigars] = useState<any[]>([])
  const [goldBatches, setGoldBatches] = useState<any[]>([])
  const [diamondLots, setDiamondLots] = useState<any[]>([])

  // Processing Modal & Job Bag State
  const [selectedTicket, setSelectedTicket] = useState<any>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  
  const [jobBagForm, setJobBagForm] = useState({
    artisan_id: '',
    gold_batch_id: '',
    issued_gold: '',
    diamond_lot_id: '',
    issued_diamond: '',
    labor_charges: '',
    final_cost: ''
  })

  // 1. Fetch Warehouses
  useEffect(() => {
    if (!appUser) return
    const fetchWarehouses = async () => {
      const { data } = await supabase.from('warehouses').select('*').eq('company_id', appUser.company_id)
      if (data) setWarehouses(data)
    }
    fetchWarehouses()
  }, [appUser])

  // 2. Fetch Job Bag Reference Data (Karigars & Raw Materials)
  useEffect(() => {
    if (!appUser || !selectedLocation) return
    const fetchReferences = async () => {
      const [kRes, gRes, dRes] = await Promise.all([
         supabase.from('karigars').select('id, name').eq('company_id', appUser.company_id),
         // Only fetch batches with actual weight left in the current workshop
         supabase.from('inventory_gold_batches').select('*').eq('warehouse_id', selectedLocation).gt('current_weight_g', 0),
         supabase.from('inventory_diamond_lots').select('*').eq('warehouse_id', selectedLocation).gt('current_weight_cts', 0)
      ])
      if (kRes.data) setKarigars(kRes.data)
      if (gRes.data) setGoldBatches(gRes.data)
      if (dRes.data) setDiamondLots(dRes.data)
    }
    fetchReferences()
  }, [appUser, selectedLocation])

  // 3. Fetch Repair Tickets based on Tab & Location
  useEffect(() => {
    fetchTickets()
  }, [activeTab, appUser, selectedLocation])

  const fetchTickets = async () => {
    if (!appUser || !selectedLocation) return
    setIsLoading(true)

    let query = supabase
      .from('repair_tickets')
      .select('*, origin:origin_warehouse_id(name)')
      .order('created_at', { ascending: false })

    if (activeTab === 'workshop') {
      // Workshop only cares about what is physically sitting with them
      query = query.in('status', ['received_at_ho', 'in_repair_at_ho', 'with_artisan', 'fixed_ready_for_dispatch'])
      if (selectedLocation !== 'ALL') {
         query = query.eq('current_warehouse_id', selectedLocation)
      }
    } else {
      // Branches only care about what they sent out
      if (selectedLocation !== 'ALL') {
         query = query.eq('origin_warehouse_id', selectedLocation)
      }
    }

    const { data, error } = await query
    if (!error && data) setTickets(data)
    setIsLoading(false)
  }

  // --- JOB BAG ACTIONS ---

  const handleOpenJobBag = (ticket: any) => {
    setSelectedTicket(ticket)
    setJobBagForm({
      artisan_id: ticket.artisan_id || '', 
      gold_batch_id: '',
      issued_gold: ticket.issued_gold_g ? ticket.issued_gold_g.toString() : '',
      diamond_lot_id: '',
      issued_diamond: ticket.issued_diamond_cts ? ticket.issued_diamond_cts.toString() : '',
      labor_charges: ticket.labor_charges ? ticket.labor_charges.toString() : '',
      final_cost: ticket.actual_cost ? ticket.actual_cost.toString() : ''
    })
  }

  const handleIssueMaterials = async () => {
    if (!selectedTicket || !jobBagForm.artisan_id) return toast.error("Please select a Karigar.")
    setIsProcessing(true)

    try {
      // 1. Deduct Gold from Batch (if selected)
      const issuedGold = Number(jobBagForm.issued_gold) || 0
      if (jobBagForm.gold_batch_id && issuedGold > 0) {
        const batch = goldBatches.find(b => b.id === jobBagForm.gold_batch_id)
        if (batch) {
          const { error: gErr } = await supabase.from('inventory_gold_batches')
            .update({ current_weight_g: batch.current_weight_g - issuedGold })
            .eq('id', batch.id)
          if (gErr) throw new Error("Failed to deduct from Gold Batch")
        }
      }

      // 2. Deduct Diamond from Lot (if selected)
      const issuedDia = Number(jobBagForm.issued_diamond) || 0
      if (jobBagForm.diamond_lot_id && issuedDia > 0) {
        const lot = diamondLots.find(l => l.id === jobBagForm.diamond_lot_id)
        if (lot) {
          const { error: dErr } = await supabase.from('inventory_diamond_lots')
            .update({ current_weight_cts: lot.current_weight_cts - issuedDia })
            .eq('id', lot.id)
          if (dErr) throw new Error("Failed to deduct from Diamond Lot")
        }
      }

      // 3. Update the Repair Ticket
      const { error: tErr } = await supabase
        .from('repair_tickets')
        .update({ 
          status: 'with_artisan',
          artisan_id: jobBagForm.artisan_id,
          issued_gold_g: issuedGold,
          issued_diamond_cts: issuedDia,
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedTicket.id)

      if (tErr) throw tErr

      toast.success(`Materials deducted from vault. Ticket assigned to Karigar.`)
      setSelectedTicket(null)
      fetchTickets() 
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleReceiveAndFinalize = async () => {
    if (!selectedTicket) return
    setIsProcessing(true)

    try {
      const { error } = await supabase
        .from('repair_tickets')
        .update({ 
          status: 'fixed_ready_for_dispatch',
          labor_charges: Number(jobBagForm.labor_charges) || 0,
          actual_cost: Number(jobBagForm.final_cost) || 0,
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedTicket.id)

      if (error) throw error

      toast.success(`Ticket Finalized! Ready for Logistics dispatch.`)
      setSelectedTicket(null)
      fetchTickets() 
    } catch (err: any) {
      toast.error("Error finalizing ticket: " + err.message)
    } finally {
      setIsProcessing(false)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'received_at_store': return <Badge className="bg-slate-100 text-slate-700 border-slate-200">At Store</Badge>
      case 'in_transit_to_ho': return <Badge className="bg-orange-100 text-orange-700 border-orange-200">In Transit ➔ HO</Badge>
      case 'received_at_ho': return <Badge className="bg-indigo-100 text-indigo-700 border-indigo-200">Queue @ HO</Badge>
      case 'in_repair_at_ho': 
      case 'with_artisan': return <Badge className="bg-purple-100 text-purple-700 border-purple-200">With Artisan</Badge>
      case 'fixed_ready_for_dispatch': return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">Fixed & Ready</Badge>
      case 'in_transit_to_store': return <Badge className="bg-orange-100 text-orange-700 border-orange-200">In Transit ➔ Store</Badge>
      case 'delivered': return <Badge className="bg-slate-800 text-white border-slate-900">Returned to Customer</Badge>
      default: return <Badge variant="outline">{status}</Badge>
    }
  }

  const filteredTickets = tickets.filter(t => 
    t.ticket_number?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    t.item_description?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="flex flex-col min-h-screen bg-[#fafafa]">
      
      {/* HEADER */}
      <header className="h-14 bg-white border-b border-slate-200 px-4 flex items-center justify-between sticky top-0 z-40 shadow-sm">
        <div className="flex items-center gap-3">
          <Link href="/">
            <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="h-4 w-px bg-slate-200" />
          <Wrench className="w-4 h-4 text-indigo-600" />
          <h1 className="text-sm font-semibold text-slate-900 tracking-tight">Repairs & Services</h1>
        </div>
      </header>

      <main className="max-w-[1200px] mx-auto w-full p-4 sm:p-8 space-y-6">
        
        {/* TOP TOOLBAR: TABS & LOCATION */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex p-1 bg-slate-200/50 rounded-lg w-fit">
            <button 
              onClick={() => setActiveTab('store')}
              className={`px-6 py-2 text-xs font-bold uppercase tracking-widest rounded-md transition-all ${activeTab === 'store' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Branch View
            </button>
            <button 
              onClick={() => setActiveTab('workshop')}
              className={`px-6 py-2 text-xs font-bold uppercase tracking-widest rounded-md transition-all ${activeTab === 'workshop' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Workshop (HO)
            </button>
          </div>

          <div className="flex items-center gap-2 bg-white p-1.5 rounded-xl border border-slate-200 shadow-sm">
             <div className="pl-2 pr-2 border-r border-slate-100 flex items-center gap-2">
               <Store className="w-4 h-4 text-slate-400" />
               <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                 {activeTab === 'store' ? 'Origin Branch:' : 'Workshop:'}
               </span>
             </div>
             <Select value={selectedLocation} onValueChange={setSelectedLocation} disabled={isLocked}>
               <SelectTrigger className="h-8 border-none bg-transparent shadow-none text-xs font-semibold text-slate-700 w-[180px] focus:ring-0">
                 <SelectValue placeholder="Select Location..." />
               </SelectTrigger>
               <SelectContent className="rounded-md border-slate-200 shadow-lg">
                 {isHQ && <SelectItem value="ALL" className="text-xs font-bold text-indigo-600">All Locations</SelectItem>}
                 {warehouses.map(w => <SelectItem key={w.id} value={w.id} className="text-xs font-medium">{w.name}</SelectItem>)}
               </SelectContent>
             </Select>
          </div>
        </div>

        {/* DATA TABLE */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden h-[700px] flex flex-col">
          <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 shrink-0">
            <div className="relative w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input 
                placeholder="Search Ticket or Description..." 
                className="pl-9 h-9 text-sm bg-white" 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
            {activeTab === 'store' && (
              <Link href="/sales/new?tab=repair">
                <Button className="h-9 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-sm">
                  <PlusCircle className="w-4 h-4 mr-2"/> New Repair Intake
                </Button>
              </Link>
            )}
          </div>

          <div className="flex-1 overflow-auto custom-scrollbar">
            <table className="w-full text-left border-collapse whitespace-nowrap">
              <thead className="sticky top-0 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.05)] z-10">
                <tr>
                  <th className="py-3 px-4 text-[10px] font-bold uppercase tracking-widest text-slate-400 w-32">Ticket #</th>
                  <th className="py-3 px-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">Item Details</th>
                  <th className="py-3 px-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">Origin</th>
                  <th className="py-3 px-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">Status</th>
                  <th className="py-3 px-4 text-[10px] font-bold uppercase tracking-widest text-slate-400 text-right pr-6">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto text-indigo-500" />
                    </td>
                  </tr>
                ) : filteredTickets.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-sm font-medium text-slate-400">
                      No repair tickets found in this view.
                    </td>
                  </tr>
                ) : (
                  filteredTickets.map((ticket) => (
                    <tr key={ticket.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900 text-xs">{ticket.ticket_number}</td>
                      <td className="py-3 px-4">
                        <p className="text-sm font-semibold text-slate-800 truncate max-w-[250px]">{ticket.item_description}</p>
                        <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wider mt-0.5">
                          Gross: {ticket.gross_weight_g}g • {ticket.purity || 'Unknown Purity'}
                        </p>
                      </td>
                      <td className="py-3 px-4 text-xs font-semibold text-slate-600">{ticket.origin?.name || 'Unknown'}</td>
                      <td className="py-3 px-4">{getStatusBadge(ticket.status)}</td>
                      <td className="py-3 px-4 text-right pr-6">
                        
                        {/* BRANCH ACTION: Send to HO */}
                        {activeTab === 'store' && ticket.status === 'received_at_store' && (
                          <Link href={`/transfer/new?repair_ids=${ticket.id}&type=repair`}>
                            <Button size="sm" variant="outline" className="h-8 text-xs font-bold text-indigo-600 border-indigo-200 hover:bg-indigo-50 shadow-sm">
                              <Truck className="w-3.5 h-3.5 mr-1.5" /> Transfer to HO
                            </Button>
                          </Link>
                        )}

                        {/* WORKSHOP ACTION: Process Job Bag */}
                        {activeTab === 'workshop' && (ticket.status === 'received_at_ho' || ticket.status === 'with_artisan') && (
                          <Button 
                            size="sm" 
                            className={`h-8 text-xs font-bold shadow-sm ${ticket.status === 'with_artisan' ? 'bg-amber-500 hover:bg-amber-600 text-white' : 'bg-slate-900 hover:bg-slate-800 text-white'}`}
                            onClick={() => handleOpenJobBag(ticket)}
                          >
                            <Hammer className="w-3.5 h-3.5 mr-1.5" /> {ticket.status === 'with_artisan' ? 'Receive & Finalize' : 'Open Job Bag'}
                          </Button>
                        )}
                        
                        {/* WORKSHOP ACTION: Return to Store */}
                        {activeTab === 'workshop' && ticket.status === 'fixed_ready_for_dispatch' && (
                          <Link href={`/transfer/new?repair_ids=${ticket.id}&type=repair`}>
                            <Button size="sm" className="h-8 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm">
                              <Truck className="w-3.5 h-3.5 mr-1.5" /> Return to Branch
                            </Button>
                          </Link>
                        )}

                        {/* BRANCH ACTION: Handover to Customer */}
                        {activeTab === 'store' && ticket.status === 'in_transit_to_store' && (
                          <span className="text-[10px] font-bold text-orange-500 uppercase tracking-widest">Awaiting Receipt</span>
                        )}

                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* PROCESSING MODAL OVERLAY: THE REPAIR JOB BAG */}
        {selectedTicket && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
            <Card className="max-w-2xl w-full shadow-2xl border-0 overflow-hidden animate-in zoom-in-95 duration-200">
              
              <div className="bg-indigo-900 p-5 flex justify-between items-center text-white">
                <div>
                  <h2 className="font-black tracking-widest uppercase text-xs flex items-center gap-2 text-indigo-200">
                    <Hammer className="w-4 h-4" /> Repair Job Bag
                  </h2>
                  <p className="text-xl font-mono font-bold mt-1">{selectedTicket.ticket_number}</p>
                </div>
                <button onClick={() => setSelectedTicket(null)} className="text-white/50 hover:text-white bg-white/10 p-2 rounded-md transition-colors">&times;</button>
              </div>

              <CardContent className="p-0">
                <div className="p-6 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                  <div>
                    <p className="text-sm font-bold text-slate-800">{selectedTicket.item_description}</p>
                    <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mt-1">
                      Gross Wt: {selectedTicket.gross_weight_g}g | {selectedTicket.purity}
                    </p>
                  </div>
                  {getStatusBadge(selectedTicket.status)}
                </div>

                {/* PHASE 1: ASSIGN & ISSUE MATERIALS */}
                {(selectedTicket.status === 'received_at_ho' || selectedTicket.status === 'in_repair_at_ho') && (
                  <div className="p-6 space-y-5">
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 font-medium">
                      <strong className="uppercase tracking-widest text-[10px] block mb-1 text-amber-700">Customer Defect Notes:</strong>
                      {selectedTicket.defect_notes || 'No notes provided. Inspect manually.'}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      {/* Select Karigar */}
                      <div className="space-y-2 col-span-2">
                        <Label className="text-xs font-bold text-slate-700 uppercase tracking-widest">Assign Artisan (Karigar)</Label>
                        <Select value={jobBagForm.artisan_id} onValueChange={(val) => setJobBagForm({...jobBagForm, artisan_id: val})}>
                          <SelectTrigger className="h-10 border-slate-300">
                            <SelectValue placeholder="Select Karigar..." />
                          </SelectTrigger>
                          <SelectContent>
                            {karigars.length === 0 ? (
                              <SelectItem value="none" disabled>No Karigars found in system</SelectItem>
                            ) : (
                              karigars.map(k => <SelectItem key={k.id} value={k.id}>{k.name}</SelectItem>)
                            )}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Issue Gold from Actual Batches */}
                      <div className="space-y-2 border border-slate-200 p-3 rounded-xl bg-slate-50/50">
                        <Label className="text-[10px] font-bold text-amber-600 uppercase tracking-widest flex items-center gap-1.5"><Database className="w-3 h-3"/> Raw Gold</Label>
                        <Select value={jobBagForm.gold_batch_id} onValueChange={(val) => setJobBagForm({...jobBagForm, gold_batch_id: val})}>
                          <SelectTrigger className="h-9 text-xs border-slate-300 bg-white">
                            <SelectValue placeholder="Select Vault Batch..." />
                          </SelectTrigger>
                          <SelectContent>
                            {goldBatches.map(b => <SelectItem key={b.id} value={b.id}>{b.batch_number} ({b.current_weight_g}g avl)</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <Input 
                          type="number" placeholder="Issue Weight (g)" className="h-9 text-xs font-mono" 
                          value={jobBagForm.issued_gold}
                          onChange={(e) => setJobBagForm({...jobBagForm, issued_gold: e.target.value})}
                        />
                      </div>

                      {/* Issue Diamonds from Actual Lots */}
                      <div className="space-y-2 border border-slate-200 p-3 rounded-xl bg-slate-50/50">
                        <Label className="text-[10px] font-bold text-blue-600 uppercase tracking-widest flex items-center gap-1.5"><Database className="w-3 h-3"/> Diamond Lot</Label>
                        <Select value={jobBagForm.diamond_lot_id} onValueChange={(val) => setJobBagForm({...jobBagForm, diamond_lot_id: val})}>
                          <SelectTrigger className="h-9 text-xs border-slate-300 bg-white">
                            <SelectValue placeholder="Select Vault Lot..." />
                          </SelectTrigger>
                          <SelectContent>
                            {diamondLots.map(d => <SelectItem key={d.id} value={d.id}>{d.lot_number} ({d.current_weight_cts}cts avl)</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <Input 
                          type="number" placeholder="Issue Carats (cts)" className="h-9 text-xs font-mono" 
                          value={jobBagForm.issued_diamond}
                          onChange={(e) => setJobBagForm({...jobBagForm, issued_diamond: e.target.value})}
                        />
                      </div>
                    </div>

                    <div className="pt-4 flex gap-3 border-t border-slate-100">
                      <Button variant="outline" className="flex-1" onClick={() => setSelectedTicket(null)}>Cancel</Button>
                      <Button 
                        className="flex-1 bg-indigo-600 hover:bg-indigo-700 font-bold uppercase tracking-widest text-xs"
                        onClick={handleIssueMaterials}
                        disabled={isProcessing || !jobBagForm.artisan_id}
                      >
                        {isProcessing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                        Issue Materials & Assign
                      </Button>
                    </div>
                  </div>
                )}

                {/* PHASE 2: RECEIVE FROM ARTISAN & CLOSE */}
                {selectedTicket.status === 'with_artisan' && (
                  <div className="p-6 space-y-5 bg-indigo-50/30">
                    <div className="flex items-center gap-3 p-3 bg-white border border-indigo-100 rounded-lg shadow-sm">
                      <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-xs">
                        <Hammer className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-900">Assigned to Karigar</p>
                        <p className="text-[10px] text-slate-500 font-medium tracking-wide mt-0.5">
                          Issued: <strong className="text-amber-600">{selectedTicket.issued_gold_g || '0'}g Gold</strong> • <strong className="text-blue-600">{selectedTicket.issued_diamond_cts || '0'}cts Dia</strong>
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-xs font-bold text-slate-700 uppercase tracking-widest">Labor Charges (₹)</Label>
                        <div className="relative">
                          <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                          <Input 
                            type="number" placeholder="0.00" className="pl-9 font-bold h-10 border-indigo-200" 
                            value={jobBagForm.labor_charges}
                            onChange={(e) => setJobBagForm({...jobBagForm, labor_charges: e.target.value})}
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-bold text-slate-700 uppercase tracking-widest">Final Total Cost (₹)</Label>
                        <div className="relative">
                          <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                          <Input 
                            type="number" placeholder="0" className="pl-9 font-bold h-10 bg-white" 
                            value={jobBagForm.final_cost}
                            onChange={(e) => setJobBagForm({...jobBagForm, final_cost: e.target.value})}
                          />
                        </div>
                        <p className="text-[9px] text-slate-500">Material + Labor total</p>
                      </div>
                    </div>

                    <div className="pt-4 flex gap-3 border-t border-slate-200 mt-4">
                      <Button variant="outline" className="flex-1" onClick={() => setSelectedTicket(null)}>Cancel</Button>
                      <Button 
                        className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold uppercase tracking-widest text-xs"
                        onClick={handleReceiveAndFinalize}
                        disabled={isProcessing}
                      >
                        {isProcessing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                        Receive & Finalize
                      </Button>
                    </div>
                  </div>
                )}

              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  )
}