'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { useStoreLocation } from '@/hooks/useStoreLocation'
import { format } from 'date-fns'
import QRCode from 'react-qr-code'
import { toast } from 'sonner'
import { 
  Search, 
  QrCode, 
  PackageCheck, 
  Truck, 
  MapPin, 
  Printer, 
  Warehouse, 
  Lock, 
  History,
  ChevronRight,
  ArrowLeft,
  LayoutDashboard,
  RefreshCw,
  Database,
  ArrowRightLeft,
  ShieldAlert,
  CheckCircle2,
  AlertOctagon,
  Ghost,
  Info
} from 'lucide-react'

import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabaseClient'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { 
  Tabs, TabsContent, TabsList, TabsTrigger 
} from '@/components/ui/tabs'
import { 
  Select, SelectContent, SelectItem, 
  SelectTrigger, SelectValue 
} from '@/components/ui/select'
import { 
  Table, TableBody, TableCell, TableHead, 
  TableHeader, TableRow 
} from '@/components/ui/table'
import { 
  Dialog, DialogContent, DialogHeader, 
  DialogTitle, DialogDescription, DialogFooter
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

interface Transfer {
  id: string
  transfer_number: string
  from_warehouse_id: string
  to_warehouse_id: string
  status: 'draft' | 'in_transit' | 'completed' | 'cancelled' | 'disputed' | 'seal_verified' | 'partially_received'
  created_at: string
  notes: string
  from_warehouse: { name: string }
  to_warehouse: { name: string }
}

export default function TransferPage() {
  const { appUser } = useAuth()
  
  const [transfers, setTransfers] = useState<Transfer[]>([])
  const [disputedItems, setDisputedItems] = useState<any[]>([]) 
  const [warehouses, setWarehouses] = useState<{id: string, name: string}[]>([])
  const { isHQ, isLocked, selectedLocation, setSelectedLocation } = useStoreLocation()
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedQR, setSelectedQR] = useState<Transfer | null>(null)

  const [resolveModalOpen, setResolveModalOpen] = useState(false)
  const [resolvingItem, setResolvingItem] = useState<any>(null)
  const [selectedDestWarehouse, setSelectedDestWarehouse] = useState<string>('')

  const fetchWarehouses = async () => {
    if (!appUser) return
    try {
      const { data: whData } = await supabase
        .from('warehouses')
        .select('id, name')
        .eq('company_id', appUser.company_id)
        .eq('is_active', true)
        .order('name')

      if (whData && whData.length > 0) {
        setWarehouses(whData)
      }
    } catch (err) {
      toast.error("Error loading warehouses")
    }
  }

  const fetchTransfers = async () => {
    if (!appUser || !selectedLocation) {
       if (!appUser) setLoading(false);
       return; 
    }
    
    setLoading(true)
    try {
      let query = supabase
        .from('stock_transfers')
        .select(`
          id, transfer_number, status, created_at, notes,
          from_warehouse_id, 
          to_warehouse_id,
          from_warehouse:from_warehouse_id(name),
          to_warehouse:to_warehouse_id(name)
        `)
        .eq('company_id', appUser.company_id)
      
      if (selectedLocation !== 'ALL') {
        query = query.or(`from_warehouse_id.eq.${selectedLocation},to_warehouse_id.eq.${selectedLocation}`)
      }

      const { data: trData, error } = await query.order('created_at', { ascending: false })
      
      if (error) throw error;
      if (trData) setTransfers(trData as any)

      if (isHQ || appUser.role === 'owner' || appUser.role === 'manager') {
        const { data: dItems, error: dError } = await supabase
          .from('inventory_items')
          .select(`
            id, barcode, item_category, net_weight_g, status, warehouse_id,
            warehouses:warehouse_id(name)
          `)
          .eq('company_id', appUser.company_id)
          .eq('status', 'disputed')
        
        if (!dError && dItems) {
          setDisputedItems(dItems)
        }
      }

    } catch (err) {
      toast.error("Error loading transfer data")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchWarehouses() }, [appUser])
  useEffect(() => { fetchTransfers() }, [appUser, selectedLocation])

  const handleResolveDispute = async (itemId: string, resolution: 'origin' | 'destination' | 'lost', originId?: string, destinationId?: string) => {
    if (resolution !== 'destination' && !confirm(`Are you sure you want to mark this item as ${resolution.toUpperCase()}? This will update the inventory ledger.`)) return;

    try {
      let updatePayload: any = { status: 'in_stock' };

      if (resolution === 'origin' && originId) {
        updatePayload.warehouse_id = originId;
        updatePayload.remarks = `Recovered: Left at Origin by Admin on ${format(new Date(), 'dd-MMM-yy')}`;
      } else if (resolution === 'destination' && destinationId) {
        updatePayload.warehouse_id = destinationId;
        updatePayload.remarks = `Recovered: Found at Destination by Admin on ${format(new Date(), 'dd-MMM-yy')}`;
      } else if (resolution === 'lost') {
        updatePayload.status = 'written_off_lost';
        updatePayload.remarks = `Written Off: Lost in Transit logged by Admin on ${format(new Date(), 'dd-MMM-yy')}`;
      } else {
        throw new Error("Invalid resolution parameters.");
      }

      // 1. Update the Item Status
      const { error: itemError } = await supabase
        .from('inventory_items')
        .update(updatePayload)
        .eq('id', itemId);

      if (itemError) throw itemError;

      // 2. Find the transfer this item belonged to safely via the junction table
      const { data: lineData } = await supabase
        .from('stock_transfer_item_lines')
        .select('transfer_id')
        .eq('item_id', itemId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (lineData?.transfer_id) {
        const transferId = lineData.transfer_id;

        // Fetch all item IDs associated with this transfer
        const { data: transferLines } = await supabase
          .from('stock_transfer_item_lines')
          .select('item_id')
          .eq('transfer_id', transferId);

        if (transferLines && transferLines.length > 0) {
          const itemIds = transferLines.map(l => l.item_id);
          
          // 3. Check if ANY of those items are still actively disputed
          const { data: stillDisputed } = await supabase
            .from('inventory_items')
            .select('id')
            .in('id', itemIds)
            .eq('status', 'disputed');

          const isFullyResolved = !stillDisputed || stillDisputed.length === 0;

          // 4. Update the transfer notes & status
          const { data: trData } = await supabase.from('stock_transfers').select('notes').eq('id', transferId).single();
          
          const actionText = resolution === 'lost' ? 'Lost' : resolution === 'origin' ? 'At Origin' : 'At Dest';
          const resolutionLog = `[Exception Cleared: ${actionText}]`;
          const newNotes = trData?.notes && trData.notes !== 'null' ? `${trData.notes} • ${resolutionLog}` : resolutionLog;

          const { error: trError } = await supabase
            .from('stock_transfers')
            .update({ 
              status: isFullyResolved ? 'completed' : 'disputed', // Safe DB Enum Status
              notes: newNotes
            })
            .eq('id', transferId);

          if (trError) throw trError;
        }
      }

      toast.success(`Dispute resolved. Item status updated to ${updatePayload.status.replace(/_/g, ' ')}.`);
      fetchTransfers(); 
    } catch (err: any) {
      toast.error(`Resolution Failed: ${err.message}`);
    }
  }

  const filteredBySearch = transfers.filter(t => 
    t.transfer_number.toLowerCase().includes(searchTerm.toLowerCase())
  )
  
  const loc = selectedLocation || 'ALL';
  const activeStatuses = ['draft', 'in_transit', 'seal_verified'];
  const closedStatuses = ['completed', 'cancelled', 'disputed', 'partially_received'];

  const incomingTransfers = filteredBySearch.filter(t => 
    (loc === 'ALL' || t.to_warehouse_id === loc) && 
    activeStatuses.includes(t.status)
  )
  
  const outgoingTransfers = filteredBySearch.filter(t => 
    (loc === 'ALL' || t.from_warehouse_id === loc) && 
    activeStatuses.includes(t.status)
  )
  
  const historyTransfers = filteredBySearch.filter(t => {
    const matchesLocation = loc === 'ALL' || t.to_warehouse_id === loc || t.from_warehouse_id === loc;
    return matchesLocation && closedStatuses.includes(t.status);
  })

  const canResolveDisputes = isHQ || appUser?.role === 'owner' || appUser?.role === 'manager';

  if (!appUser) return null

  return (
    <div className="flex flex-col min-h-screen bg-[#fafafa]">
      <header className="sticky top-0 z-40 w-full bg-white/80 backdrop-blur-md border-b border-gray-200 px-4 h-14 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3 overflow-hidden">
          <Link href="/dashboard">
            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl hover:bg-gray-100 text-gray-500 transition-colors">
              <LayoutDashboard className="h-[18px] w-[18px]" strokeWidth={1.5} />
            </Button>
          </Link>
          <Separator orientation="vertical" className="h-5 bg-gray-200" />
          <nav className="flex items-center gap-1.5 text-[13px] whitespace-nowrap overflow-hidden">
            <span className="text-gray-500 font-medium">Inventory</span>
            <ChevronRight className="h-3.5 w-3.5 text-gray-400" strokeWidth={1.5} />
            <span className="font-bold text-gray-900 tracking-tight">Stock Transfers</span>
          </nav>
        </div>

        <div className="flex items-center gap-2.5">
          <Button variant="ghost" size="sm" className="h-9 px-3 text-[13px] font-medium text-gray-500 hover:text-gray-900 rounded-xl" onClick={fetchTransfers}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} strokeWidth={1.5} />
            Refresh
          </Button>
          <Separator orientation="vertical" className="h-5 mx-1" />
          <Button variant="outline" size="sm" className="h-9 text-xs font-bold px-4 shadow-sm border-gray-200 hidden sm:flex rounded-xl">
            <Database className="h-3.5 w-3.5 mr-2 text-gray-400" strokeWidth={1.5} />
            Ledger
          </Button>
        </div>
      </header>

      <main className="p-4 md:p-6 lg:p-8 max-w-[1400px] w-full mx-auto space-y-6 animate-in fade-in duration-500">
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex flex-wrap gap-2 w-full md:w-auto">
            <Button asChild variant="outline" size="sm" className="flex-1 sm:flex-none h-10 font-bold text-xs uppercase tracking-widest bg-white border-gray-200 shadow-sm hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 rounded-[14px] transition-all">
              <Link href="/transfer/receive">
                <PackageCheck className="w-4 h-4 mr-2 text-emerald-600" strokeWidth={2} /> Secure Receive
              </Link>
            </Button>
            <Button asChild size="sm" className="flex-1 md:flex-none h-10 font-bold text-xs uppercase tracking-widest shadow-md bg-gray-900 text-white hover:bg-gray-800 rounded-[14px] transition-all">
              <Link href="/inventory">
                <Truck className="w-4 h-4 mr-2" strokeWidth={2} /> New Dispatch
              </Link>
            </Button>
            
            {canResolveDisputes && (
              <Button asChild variant="outline" size="sm" className="flex-1 sm:flex-none h-10 font-bold text-xs uppercase tracking-widest bg-red-50/40 border-red-200 text-red-700 hover:bg-red-100/50 shadow-sm transition-colors rounded-[14px]">
                <Link href="/transfer/direct">
                  <ArrowRightLeft className="w-3.5 h-3.5 mr-2 text-red-600" strokeWidth={2.5} /> Direct Transfer
                </Link>
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2.5 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" strokeWidth={2} />
              <Input 
                placeholder="Search Transfer ID..." 
                className="pl-10 h-10 text-[13px] font-medium bg-white border-gray-200 rounded-[14px] focus-visible:ring-blue-500 shadow-sm"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Select 
              value={selectedLocation || ''} 
              onValueChange={setSelectedLocation}
              disabled={isLocked}
            >
              <SelectTrigger className="w-[180px] h-10 text-[13px] font-bold border-gray-200 bg-white focus:ring-blue-500 rounded-[14px] shadow-sm">
                <SelectValue placeholder="Select Vault" />
              </SelectTrigger>
              <SelectContent className="rounded-[16px] shadow-xl border-gray-100 p-1">
                {isHQ && (
                  <SelectItem value="ALL" className="text-xs font-bold text-blue-600 py-2.5 rounded-lg focus:bg-blue-50">
                    All Vaults (HQ)
                  </SelectItem>
                )}
                {warehouses.map(w => (
                  <SelectItem key={w.id} value={w.id} className="text-[13px] font-medium py-2.5 rounded-lg cursor-pointer focus:bg-gray-50">
                    {w.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Tabs defaultValue="incoming" className="w-full">
          <TabsList className="bg-transparent border-b border-gray-200/60 rounded-none h-12 w-full justify-start p-0 gap-8 mb-6 overflow-x-auto overflow-y-hidden custom-scrollbar">
            <TabsTrigger value="incoming" className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:bg-transparent shadow-none h-full px-1 text-[13px] font-bold transition-all whitespace-nowrap text-gray-500 data-[state=active]:text-blue-700">
              Active Incoming ({incomingTransfers.length})
            </TabsTrigger>
            <TabsTrigger value="outgoing" className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:bg-transparent shadow-none h-full px-1 text-[13px] font-bold transition-all whitespace-nowrap text-gray-500 data-[state=active]:text-blue-700">
              Active Outgoing ({outgoingTransfers.length})
            </TabsTrigger>
            <TabsTrigger value="history" className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:bg-transparent shadow-none h-full px-1 text-[13px] font-bold transition-all whitespace-nowrap text-gray-500 data-[state=active]:text-blue-700">
              History ({historyTransfers.length})
            </TabsTrigger>
            {canResolveDisputes && (
              <TabsTrigger value="disputes" className="rounded-none border-b-2 border-transparent data-[state=active]:border-red-500 data-[state=active]:text-red-600 data-[state=active]:bg-transparent shadow-none h-full px-1 text-[13px] font-bold transition-all whitespace-nowrap text-gray-500 flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4" strokeWidth={2}/> Exceptions <Badge variant="secondary" className="ml-1 text-[10px] bg-red-100 text-red-700 px-1.5 rounded-md border-none">{disputedItems.length}</Badge>
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="incoming" className="mt-0">
            <TransferList items={incomingTransfers} loading={loading} onShowQR={setSelectedQR} type="incoming" />
          </TabsContent>
          <TabsContent value="outgoing" className="mt-0">
            <TransferList items={outgoingTransfers} loading={loading} onShowQR={setSelectedQR} type="outgoing" />
          </TabsContent>
          <TabsContent value="history" className="mt-0">
            <TransferList items={historyTransfers} loading={loading} onShowQR={setSelectedQR} type="history" />
          </TabsContent>

          {canResolveDisputes && (
            <TabsContent value="disputes" className="mt-0">
              {loading ? (
                <div className="space-y-3">
                  {[1,2,3].map(i => <Skeleton key={i} className="h-16 w-full rounded-[24px] border border-gray-100 bg-white" />)}
                </div>
              ) : disputedItems.length === 0 ? (
                <div className="text-center py-24 bg-emerald-50/30 border border-emerald-100 border-dashed rounded-[24px]">
                  <CheckCircle2 className="w-12 h-12 mx-auto mb-4 text-emerald-400" strokeWidth={1.5} />
                  <p className="text-xs font-bold text-emerald-700 uppercase tracking-widest">No transit exceptions detected</p>
                  <p className="text-[13px] font-medium text-emerald-600/70 mt-1.5">All recent stock transfers have been perfectly reconciled.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {disputedItems.map(item => (
                    <Card key={item.id} className="border-red-200/60 bg-white shadow-sm overflow-hidden rounded-[20px] hover:border-red-300 transition-colors group">
                      <CardContent className="p-0">
                        <div className="flex flex-col md:flex-row items-center justify-between p-5 gap-4">
                           
                           <div className="flex items-center gap-4 w-full md:w-auto">
                             <div className="h-12 w-12 rounded-[14px] bg-red-50 flex items-center justify-center shrink-0 border border-red-100 group-hover:bg-red-100 transition-colors">
                                <AlertOctagon className="w-6 h-6 text-red-500" strokeWidth={1.5} />
                             </div>
                             <div>
                                <h4 className="text-[15px] font-black font-mono text-gray-900 tracking-tight">{item.barcode}</h4>
                                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mt-1">{item.item_category} • {item.net_weight_g}g</p>
                                <p className="text-[10px] font-bold uppercase tracking-widest text-red-500 mt-1.5 flex items-center gap-1.5">
                                  <MapPin className="w-3 h-3" strokeWidth={2}/> Origin/Transit: {item.warehouses?.name || 'Unknown'}
                                </p>
                             </div>
                           </div>

                           <div className="flex flex-wrap gap-2.5 w-full md:w-auto justify-start md:justify-end">
                              <Button 
                                variant="outline" 
                                className="h-10 rounded-[12px] text-[11px] font-bold uppercase tracking-widest border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors px-4"
                                onClick={() => handleResolveDispute(item.id, 'origin', item.warehouse_id, undefined)}
                              >
                                Left at Origin
                              </Button>
                              
                              <Button 
                                variant="outline" 
                                className="h-10 rounded-[12px] text-[11px] font-bold uppercase tracking-widest border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:border-emerald-300 transition-colors px-4"
                                onClick={() => {
                                   setResolvingItem(item);
                                   setResolveModalOpen(true);
                                }}
                              >
                                Found at Dest
                              </Button>

                              <Button 
                                className="h-10 rounded-[12px] text-[11px] font-bold uppercase tracking-widest bg-gray-900 text-white hover:bg-black shadow-sm transition-colors px-5"
                                onClick={() => handleResolveDispute(item.id, 'lost')}
                              >
                                <Ghost className="w-3.5 h-3.5 mr-1.5" strokeWidth={2} /> Lost
                              </Button>
                           </div>

                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          )}
        </Tabs>
      </main>

      {/* --- DESTINATION RESOLUTION MODAL --- */}
      <Dialog open={resolveModalOpen} onOpenChange={setResolveModalOpen}>
        <DialogContent className="sm:max-w-[400px] p-0 border-none shadow-[0_24px_60px_-15px_rgba(0,0,0,0.2)] rounded-[28px] overflow-hidden bg-white">
          <DialogHeader className="bg-emerald-50/50 p-6 sm:p-8 border-b border-emerald-100/50 shrink-0">
            <DialogTitle className="flex items-center gap-2.5 text-emerald-900 font-black text-xl tracking-tight">
              <PackageCheck className="h-6 w-6 text-emerald-600" strokeWidth={2.5}/> Found at Destination
            </DialogTitle>
            <DialogDescription className="text-xs font-medium text-emerald-700/70 mt-1.5">
              Select the warehouse vault where this item was physically located to reinstate its stock status.
            </DialogDescription>
          </DialogHeader>
          
          <div className="p-6 sm:p-8 space-y-4 bg-white">
            <div className="space-y-2">
              <Label className="text-[11px] font-bold uppercase tracking-widest text-gray-500">Target Vault / Location</Label>
              <Select value={selectedDestWarehouse} onValueChange={setSelectedDestWarehouse}>
                <SelectTrigger className="h-12 rounded-[14px] text-[13px] font-semibold bg-gray-50 border-gray-200/60 hover:bg-gray-100 focus:bg-white focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 shadow-sm transition-all px-4">
                  <SelectValue placeholder="Select Warehouse..." />
                </SelectTrigger>
                <SelectContent className="rounded-[16px] shadow-xl border-gray-100 p-1">
                  {warehouses.map(w => (
                    <SelectItem key={w.id} value={w.id} className="text-[13px] font-medium rounded-[10px] py-2.5 cursor-pointer focus:bg-emerald-50 focus:text-emerald-700">
                      {w.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <DialogFooter className="bg-gray-50/80 p-5 sm:p-6 border-t border-gray-100 flex flex-col sm:flex-row gap-3 shrink-0 pb-safe">
            <Button variant="ghost" className="w-full sm:flex-1 h-12 rounded-[16px] text-xs uppercase font-bold text-gray-500 hover:text-gray-900 hover:bg-gray-200 px-6 transition-colors" 
              onClick={() => { 
                setResolveModalOpen(false); 
                setResolvingItem(null); 
                setSelectedDestWarehouse(''); 
              }}>
              Cancel
            </Button>
            <Button 
              className="w-full sm:flex-[2] h-12 rounded-[16px] text-xs uppercase font-bold px-6 bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-200 transition-all active:scale-95" 
              disabled={!selectedDestWarehouse}
              onClick={() => {
                if (resolvingItem && selectedDestWarehouse) {
                  handleResolveDispute(resolvingItem.id, 'destination', undefined, selectedDestWarehouse);
                  setResolveModalOpen(false);
                  setResolvingItem(null);
                  setSelectedDestWarehouse('');
                }
              }}
            >
              Confirm Recovery
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* QR DIALOG (Compact) */}
      <Dialog open={!!selectedQR} onOpenChange={() => setSelectedQR(null)}>
        <DialogContent className="sm:max-w-[360px] p-0 overflow-hidden border-none shadow-2xl rounded-[32px] bg-white">
          <DialogHeader className="bg-gray-50/80 p-6 sm:p-8 border-b border-gray-100 shrink-0">
            <DialogTitle className="text-xl font-black text-gray-900 tracking-tight">Transfer Key</DialogTitle>
            <DialogDescription className="text-[13px] font-medium text-gray-500 mt-1">Physical verification required at destination.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center justify-center p-8 bg-white">
            <div className="p-4 rounded-[20px] border border-gray-100 shadow-sm bg-gray-50/50 mb-6">
              {selectedQR && <QRCode value={selectedQR.id} size={180} level="H" />}
            </div>
            <p className="font-mono text-[17px] font-black tracking-widest text-gray-900 uppercase">{selectedQR?.transfer_number}</p>
          </div>
          <DialogFooter className="bg-gray-50/80 p-5 border-t border-gray-100 flex flex-col sm:flex-row gap-3 pb-safe shrink-0">
            <Button variant="ghost" className="w-full sm:flex-1 h-12 rounded-[16px] text-xs font-bold uppercase tracking-widest text-gray-500 hover:bg-gray-200 transition-colors" onClick={() => setSelectedQR(null)}>Close</Button>
            <Button className="w-full sm:flex-1 h-12 rounded-[16px] text-xs font-bold uppercase tracking-widest bg-gray-900 text-white hover:bg-black shadow-sm transition-all active:scale-95" onClick={() => window.open(`/transfer/voucher/${selectedQR?.id}`, '_blank')}>
              <Printer className="w-4 h-4 mr-2" strokeWidth={2.5} /> Print
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function TransferList({ items, loading, onShowQR, type }: { items: Transfer[], loading: boolean, onShowQR: (t: Transfer) => void, type: string }) {
  if (loading) {
    return (
      <div className="space-y-3">
        {[1,2,3].map(i => <Skeleton key={i} className="h-20 w-full rounded-[20px] border border-gray-100 bg-white" />)}
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-20 bg-gray-50/30 border border-gray-200 border-dashed rounded-[24px]">
        <History className="w-10 h-10 mx-auto mb-4 text-gray-300" strokeWidth={1.5} />
        <p className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">No transfers found in this queue</p>
      </div>
    )
  }

  return (
    <>
      {/* DESKTOP TABLE VIEW */}
      <div className="hidden md:block overflow-hidden border border-gray-200/60 rounded-[24px] bg-white shadow-sm">
        <Table>
          <TableHeader className="bg-gray-50/80 border-b border-gray-100">
            <TableRow className="hover:bg-transparent border-none">
              <TableHead className="text-[11px] font-bold uppercase tracking-widest text-gray-500 px-6 h-14">Identifier & Status</TableHead>
              <TableHead className="text-[11px] font-bold uppercase tracking-widest text-gray-500 px-4 h-14">Timestamp</TableHead>
              <TableHead className="text-[11px] font-bold uppercase tracking-widest text-gray-500 px-4 h-14 text-center">Route</TableHead>
              <TableHead className="w-[120px] text-right px-6 h-14"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((t) => {
              const isBlind = type === 'incoming' && t.status === 'in_transit';
              
              // Intelligent Badge Logic checking the DB notes
              let badgeColor = "bg-gray-100 text-gray-600";
              let badgeLabel = t.status.replace(/_/g, ' ');
              
              if (t.status === 'completed') {
                 if (t.notes && t.notes.includes('[Exception Cleared')) {
                    badgeColor = "bg-amber-50 text-amber-700 border border-amber-200";
                    badgeLabel = "DISPUTED BUT SOLVED";
                 } else {
                    badgeColor = "bg-emerald-50 text-emerald-700";
                 }
              } else if (t.status === 'partially_received' || t.status === 'disputed') {
                 badgeColor = "bg-red-50 text-red-600 border border-red-200";
                 badgeLabel = "DISPUTED (PENDING)";
              }

              return (
                <TableRow key={t.id} className="hover:bg-gray-50/50 transition-colors border-b border-gray-100 last:border-0 group">
                  <TableCell className="px-6 py-4 min-w-[250px]">
                    <div className="flex flex-col gap-1.5 items-start">
                      {isBlind ? (
                        <span className="flex items-center text-[10px] font-black text-gray-400 uppercase tracking-widest italic">
                          <Lock className="w-3.5 h-3.5 mr-1.5" strokeWidth={2} /> Secure Parcel
                        </span>
                      ) : (
                        <span className="font-mono font-bold text-[14px] text-gray-900 tracking-tight">{t.transfer_number}</span>
                      )}
                      
                      <Badge variant="outline" className={cn("text-[9px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-md border-none", badgeColor)}>
                         {badgeLabel}
                      </Badge>

                      {/* --- EXCEPTION RESOLUTION LOG DISPLAY --- */}
                      {t.notes && t.notes.includes('[Exception Cleared') && (
                        <div className="mt-1 flex items-start gap-1.5 text-amber-600 max-w-[300px]">
                          <Info className="w-3 h-3 shrink-0 mt-0.5 opacity-80" strokeWidth={2.5}/>
                          <span className="text-[10px] font-semibold leading-snug whitespace-normal break-words" title={t.notes}>
                            {t.notes.split(' • ').map((n, i) => (
                              <React.Fragment key={i}>
                                {n} <br/>
                              </React.Fragment>
                            ))}
                          </span>
                        </div>
                      )}
                    </div>
                  </TableCell>
                  
                  <TableCell className="px-4 align-top pt-5">
                    <span className="text-[13px] font-medium text-gray-600">{format(new Date(t.created_at), "dd MMM yy · HH:mm")}</span>
                  </TableCell>
                  
                  <TableCell className="px-4 align-top pt-5">
                    <div className="flex items-center justify-center gap-3">
                       <span className="text-[11px] font-bold text-gray-700 bg-gray-100 px-2.5 py-1 rounded-lg">{t.from_warehouse?.name || 'Unknown'}</span>
                       <ChevronRight className="w-3.5 h-3.5 text-gray-300" strokeWidth={2} />
                       <span className="text-[11px] font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg">{t.to_warehouse?.name || 'Unknown'}</span>
                    </div>
                  </TableCell>
                  
                  <TableCell className="px-6 text-right align-top pt-4">
                    <div className="flex justify-end gap-2">
                      {type === 'outgoing' && t.status === 'in_transit' && (
                        <Button variant="outline" size="icon" className="h-9 w-9 rounded-xl text-gray-400 border-gray-200 hover:bg-gray-50 hover:text-gray-900 transition-colors" onClick={() => onShowQR(t)}>
                          <QrCode className="h-4.5 w-4.5" strokeWidth={1.5} />
                        </Button>
                      )}
                      {!isBlind && (
                        <Button variant="outline" size="icon" className="h-9 w-9 rounded-xl text-gray-400 border-gray-200 hover:bg-gray-50 hover:text-gray-900 transition-colors" asChild>
                          <Link href={`/transfer/voucher/${t.id}`}><Printer className="h-4.5 w-4.5" strokeWidth={1.5} /></Link>
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      {/* MOBILE CARD VIEW */}
      <div className="md:hidden space-y-3 pb-20">
        {items.map((t) => {
          const isBlind = type === 'incoming' && t.status === 'in_transit';
          
          let badgeColor = "bg-gray-100 text-gray-600";
          let badgeLabel = t.status.replace(/_/g, ' ');
          
          if (t.status === 'completed') {
             if (t.notes && t.notes.includes('[Exception Cleared')) {
                badgeColor = "bg-amber-50 text-amber-700 border border-amber-200";
                badgeLabel = "DISPUTED BUT SOLVED";
             } else {
                badgeColor = "bg-emerald-50 text-emerald-700";
             }
          } else if (t.status === 'partially_received' || t.status === 'disputed') {
             badgeColor = "bg-red-50 text-red-600 border border-red-200";
             badgeLabel = "DISPUTED (PENDING)";
          }

          return (
            <Card key={t.id} className="shadow-sm border-gray-200/60 overflow-hidden bg-white rounded-[20px]">
              <CardContent className="p-4 sm:p-5 space-y-4">
                <div className="flex justify-between items-start">
                   <div className="space-y-1">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none">Reference</p>
                      {isBlind ? (
                        <span className="flex items-center text-xs font-bold text-gray-400 italic mt-1.5">
                          <Lock className="w-3.5 h-3.5 mr-1" strokeWidth={2} /> SECURE PARCEL
                        </span>
                      ) : (
                        <p className="text-[15px] font-mono font-black text-gray-900 mt-1 tracking-tight">{t.transfer_number}</p>
                      )}
                   </div>
                   <div className="flex flex-col items-end gap-1.5">
                     <Badge variant="outline" className={cn("text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md border-none", badgeColor)}>
                        {badgeLabel}
                     </Badge>
                     <span className="text-[10px] font-medium text-gray-400">{format(new Date(t.created_at), "dd MMM · HH:mm")}</span>
                   </div>
                </div>

                <div className="flex items-center justify-between p-3.5 rounded-[14px] bg-gray-50 border border-gray-100">
                   <div className="text-center flex-1 min-w-0">
                      <p className="text-[8px] font-bold text-gray-400 uppercase tracking-widest mb-1">Source</p>
                      <p className="text-[11px] font-bold text-gray-700 truncate px-1">{t.from_warehouse?.name || 'Unknown'}</p>
                   </div>
                   <div className="px-1 sm:px-3 shrink-0">
                      <ChevronRight className="w-3.5 h-3.5 text-gray-300" strokeWidth={2} />
                   </div>
                   <div className="text-center flex-1 min-w-0">
                      <p className="text-[8px] font-bold text-gray-400 uppercase tracking-widest mb-1">Destination</p>
                      <p className="text-[11px] font-bold text-blue-600 truncate px-1">{t.to_warehouse?.name || 'Unknown'}</p>
                   </div>
                </div>

                {/* MOBILE EXCEPTION NOTES */}
                {t.notes && t.notes.includes('[Exception Cleared') && (
                  <div className="bg-amber-50/50 border border-amber-100 rounded-xl p-3 flex items-start gap-2.5">
                     <Info className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" strokeWidth={2.5} />
                     <p className="text-[10px] text-amber-700 font-semibold leading-relaxed break-words">
                        {t.notes.split(' • ').map((n, i) => (
                           <React.Fragment key={i}>
                             {n} <br/>
                           </React.Fragment>
                        ))}
                     </p>
                  </div>
                )}

                <div className="flex items-center justify-end gap-2 pt-1 border-t border-gray-100 mt-2">
                   {type === 'outgoing' && t.status === 'in_transit' && (
                     <Button variant="outline" size="sm" className="h-9 rounded-xl px-4 text-[10px] font-bold uppercase tracking-widest text-gray-600 border-gray-200 hover:bg-gray-50" onClick={() => onShowQR(t)}>
                       <QrCode className="h-3.5 w-3.5 mr-1.5" strokeWidth={2} /> Key
                     </Button>
                   )}
                   {!isBlind && (
                     <Button variant="secondary" size="sm" className="h-9 rounded-xl px-4 text-[10px] font-bold uppercase tracking-widest bg-gray-100 text-gray-700 hover:bg-gray-200" asChild>
                       <Link href={`/transfer/voucher/${t.id}`}>Voucher</Link>
                     </Button>
                   )}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </>
  )
}