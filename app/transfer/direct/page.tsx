'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { 
  ArrowLeft, ShieldAlert, ArrowRightLeft, 
  Warehouse, Search, Loader2, CheckSquare, 
  Square, AlertTriangle, CheckCircle2
} from 'lucide-react'

import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabaseClient'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Label } from 'recharts'

export default function AdminDirectTransferPage() {
  const { appUser } = useAuth()
  const router = useRouter()
  
  const [warehouses, setWarehouses] = useState<any[]>([])
  const [sourceId, setSourceId] = useState<string>('')
  const [destId, setDestId] = useState<string>('')
  
  const [availableItems, setAvailableItems] = useState<any[]>([])
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())
  const [searchTerm, setSearchTerm] = useState('')
  
  const [isLoading, setIsLoading] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)

  // SECURITY CHECK: Only allow owners or managers
  const isAdmin = appUser?.role === 'owner' || appUser?.role === 'manager'

  useEffect(() => {
    if (!appUser || !isAdmin) return;
    
    const fetchWarehouses = async () => {
      const { data } = await supabase
        .from('warehouses')
        .select('id, name')
        .eq('company_id', appUser.company_id)
        .eq('is_active', true)
        .order('name')
      
      if (data) setWarehouses(data)
    }
    fetchWarehouses()
  }, [appUser, isAdmin])

  useEffect(() => {
    if (!sourceId || !appUser) {
      setAvailableItems([])
      setSelectedItems(new Set())
      return
    }

    const fetchInventory = async () => {
      setIsLoading(true)
      const { data, error } = await supabase
        .from('inventory_items')
        .select('id, barcode, item_category, net_weight_g, status')
        .eq('warehouse_id', sourceId)
        .eq('status', 'in_stock')
        .eq('company_id', appUser.company_id)
        
      if (!error && data) {
        setAvailableItems(data)
      }
      setSelectedItems(new Set())
      setIsLoading(false)
    }

    fetchInventory()
  }, [sourceId, appUser])

  const toggleItem = (id: string) => {
    const next = new Set(selectedItems)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelectedItems(next)
  }

  const toggleAll = () => {
    if (selectedItems.size === filteredItems.length) {
      setSelectedItems(new Set())
    } else {
      setSelectedItems(new Set(filteredItems.map(i => i.id)))
    }
  }

  const handleDirectTransfer = async () => {
    if (!sourceId || !destId) return toast.error("Please select both source and destination vaults.")
    if (sourceId === destId) return toast.error("Source and destination cannot be the same.")
    if (selectedItems.size === 0) return toast.error("Select at least one item to transfer.")
    
    const confirmTransfer = confirm(`WARNING: You are about to instantly bypass all transit protocols and move ${selectedItems.size} items. Proceed?`)
    if (!confirmTransfer) return

    setIsProcessing(true)
    try {
      const itemsArray = Array.from(selectedItems)
      const sourceName = warehouses.find(w => w.id === sourceId)?.name
      const destName = warehouses.find(w => w.id === destId)?.name

      // 1. Instantly update the inventory location (No 'in_transit' status)
      const { error: invError } = await supabase
        .from('inventory_items')
        .update({ 
          warehouse_id: destId,
          remarks: `Admin Direct Transfer from ${sourceName} to ${destName} on ${new Date().toLocaleDateString()}`
        })
        .in('id', itemsArray)

      if (invError) throw invError

      // 2. Create a "completed" dummy transfer record for the audit log
      const transferNumber = `DIR-${Date.now().toString().slice(-6)}`
      const { data: trData, error: trError } = await supabase
        .from('stock_transfers')
        .insert({
          company_id: appUser?.company_id,
          transfer_number: transferNumber,
          from_warehouse_id: sourceId,
          to_warehouse_id: destId,
          status: 'completed', // Skips draft/in_transit entirely
          transfer_category: 'inventory',
          notes: 'ADMIN OVERRIDE: Direct vault-to-vault transfer. QR/Seal protocols bypassed.',
          created_by: appUser?.user_id,
          received_at: new Date().toISOString()
        })
        .select('id')
        .single()

      if (trError) throw trError

      // 3. Link the items to the log
      const lineItems = itemsArray.map(itemId => ({
        transfer_id: trData.id,
        item_id: itemId
      }))
      await supabase.from('stock_transfer_item_lines').insert(lineItems)

      toast.success(`Successfully teleported ${selectedItems.size} items to ${destName}.`)
      
      // Reset state
      setSourceId('')
      setDestId('')
      setSelectedItems(new Set())
      setAvailableItems([])
      
    } catch (err: any) {
      toast.error(`Transfer Failed: ${err.message}`)
    } finally {
      setIsProcessing(false)
    }
  }

  const filteredItems = availableItems.filter(item => 
    item.barcode.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.item_category?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (!appUser) return null

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAFAFA] p-4">
        <div className="text-center max-w-md bg-white p-8 rounded-3xl border border-red-100 shadow-xl shadow-red-500/5">
          <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-red-100">
            <ShieldAlert className="w-8 h-8 text-red-500" strokeWidth={1.5} />
          </div>
          <h1 className="text-xl font-black text-gray-900 mb-2">Access Restricted</h1>
          <p className="text-[13px] text-gray-500 mb-6">You do not have the required administrative privileges to perform unverified direct transfers.</p>
          <Button onClick={() => router.back()} variant="outline" className="h-11 rounded-xl text-xs font-bold uppercase tracking-widest px-8">Go Back</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen bg-[#FAFAFA] font-sans">
      
      {/* HEADER */}
      <header className="sticky top-0 z-40 w-full bg-white/80 backdrop-blur-md border-b border-gray-200/60 px-4 h-14 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.back()} className="h-9 w-9 rounded-xl hover:bg-gray-100 text-gray-500">
            <ArrowLeft className="h-[18px] w-[18px]" strokeWidth={1.5} />
          </Button>
          <h1 className="text-[15px] font-bold text-gray-900 tracking-tight">Admin Override: Direct Transfer</h1>
        </div>
        <Badge variant="outline" className="bg-red-50 text-red-600 border-none font-bold uppercase tracking-widest text-[9px] px-2.5 py-1 rounded-lg flex items-center gap-1.5">
          <AlertTriangle className="w-3 h-3" /> QA Bypass Mode
        </Badge>
      </header>

      <main className="flex-1 p-4 sm:p-6 md:p-8 max-w-[1000px] w-full mx-auto space-y-6 animate-in fade-in duration-500">
        
        {/* ROUTING CONTROLS */}
        <Card className="border border-gray-200/60 rounded-[24px] shadow-sm bg-white overflow-hidden">
          <CardContent className="p-6 sm:p-8">
            <div className="flex flex-col md:flex-row items-center gap-4 sm:gap-6">
              
              <div className="flex-1 w-full space-y-2.5">
                <Label className="text-[11px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1.5">
                  <Warehouse className="w-3.5 h-3.5" /> Source Vault
                </Label>
                <Select value={sourceId} onValueChange={(val) => { setSourceId(val); if(val === destId) setDestId(''); }}>
                  <SelectTrigger className="h-14 rounded-[16px] text-sm font-semibold bg-gray-50 border-gray-200 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 shadow-inner px-4 transition-all">
                    <SelectValue placeholder="Select Origin..." />
                  </SelectTrigger>
                  <SelectContent className="rounded-[16px] border-gray-100 shadow-xl p-1">
                    {warehouses.map(w => (
                      <SelectItem key={w.id} value={w.id} className="text-[13px] font-medium rounded-lg py-2.5 cursor-pointer">{w.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="h-10 w-10 rounded-full bg-gray-50 flex items-center justify-center shrink-0 border border-gray-200 text-gray-400 rotate-90 md:rotate-0 mt-4 md:mt-6">
                <ArrowRightLeft className="w-4 h-4" strokeWidth={1.5} />
              </div>

              <div className="flex-1 w-full space-y-2.5">
                <Label className="text-[11px] font-bold text-blue-600 uppercase tracking-widest flex items-center gap-1.5">
                  <Warehouse className="w-3.5 h-3.5" /> Destination Vault
                </Label>
                <Select value={destId} onValueChange={setDestId}>
                  <SelectTrigger className="h-14 rounded-[16px] text-sm font-semibold bg-blue-50/50 border-blue-200 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 shadow-inner px-4 text-blue-900 transition-all">
                    <SelectValue placeholder="Select Destination..." />
                  </SelectTrigger>
                  <SelectContent className="rounded-[16px] border-gray-100 shadow-xl p-1">
                    {warehouses.filter(w => w.id !== sourceId).map(w => (
                      <SelectItem key={w.id} value={w.id} className="text-[13px] font-medium rounded-lg py-2.5 cursor-pointer focus:bg-blue-50 focus:text-blue-700">{w.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

            </div>
          </CardContent>
        </Card>

        {/* ITEM SELECTION */}
        {sourceId && (
          <Card className="border border-gray-200/60 rounded-[24px] shadow-sm bg-white overflow-hidden animate-in fade-in slide-in-from-bottom-4">
            <div className="p-5 sm:p-6 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-gray-50/50">
              <div>
                <h2 className="text-[15px] font-bold text-gray-900 tracking-tight">Select Items to Force Transfer</h2>
                <p className="text-xs text-gray-500 mt-1 font-medium">{availableItems.length} items available at origin.</p>
              </div>
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" strokeWidth={2} />
                <Input 
                  placeholder="Filter by SKU or Category..." 
                  className="h-10 pl-9 text-[13px] bg-white border-gray-200 rounded-[12px] shadow-sm focus-visible:ring-blue-500"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            <div className="p-0">
              {isLoading ? (
                <div className="p-12 flex justify-center"><Loader2 className="w-6 h-6 text-gray-400 animate-spin" /></div>
              ) : filteredItems.length === 0 ? (
                <div className="p-12 text-center text-[13px] font-medium text-gray-500">No available stock found matching criteria.</div>
              ) : (
                <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
                  <Table>
                    <TableHeader className="bg-white sticky top-0 z-10 shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
                      <TableRow className="border-gray-100 hover:bg-transparent">
                        <TableHead className="w-14 text-center">
                          <Button variant="ghost" size="sm" onClick={toggleAll} className="h-8 w-8 p-0 text-gray-500">
                            {selectedItems.size === filteredItems.length && filteredItems.length > 0 ? <CheckSquare className="w-4 h-4 text-blue-600" /> : <Square className="w-4 h-4" />}
                          </Button>
                        </TableHead>
                        <TableHead className="text-[10px] font-bold uppercase tracking-widest text-gray-500 h-11">SKU / Barcode</TableHead>
                        <TableHead className="text-[10px] font-bold uppercase tracking-widest text-gray-500 h-11">Category</TableHead>
                        <TableHead className="text-[10px] font-bold uppercase tracking-widest text-gray-500 h-11 text-right">Net Wt. (g)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredItems.map((item) => {
                        const isSelected = selectedItems.has(item.id)
                        return (
                          <TableRow 
                            key={item.id} 
                            onClick={() => toggleItem(item.id)}
                            className={cn(
                              "cursor-pointer transition-colors border-gray-100",
                              isSelected ? "bg-blue-50/50" : "hover:bg-gray-50"
                            )}
                          >
                            <TableCell className="text-center">
                              {isSelected ? <CheckSquare className="w-4 h-4 text-blue-600 mx-auto" /> : <Square className="w-4 h-4 text-gray-300 mx-auto" />}
                            </TableCell>
                            <TableCell className="font-mono text-[13px] font-bold text-gray-900">{item.barcode}</TableCell>
                            <TableCell className="text-[13px] font-medium text-gray-600">{item.item_category || '-'}</TableCell>
                            <TableCell className="text-[13px] font-semibold text-gray-900 text-right">{item.net_weight_g}</TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>

            {/* STICKY ACTION FOOTER */}
            <div className="bg-gray-50/80 p-5 sm:p-6 border-t border-gray-200/60 flex flex-col sm:flex-row items-center justify-between gap-4 shrink-0">
              <div className="text-[13px] font-medium text-gray-600 w-full sm:w-auto text-center sm:text-left">
                <span className="font-black text-gray-900 text-lg">{selectedItems.size}</span> items selected
              </div>
              <Button 
                disabled={isProcessing || selectedItems.size === 0 || !destId} 
                className="w-full sm:w-auto h-12 rounded-[16px] text-[11px] font-bold uppercase tracking-widest bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-200 transition-all active:scale-95 px-8" 
                onClick={handleDirectTransfer}
              >
                {isProcessing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" strokeWidth={2.5}/>}
                Force Transfer to Destination
              </Button>
            </div>
          </Card>
        )}
      </main>
    </div>
  )
}