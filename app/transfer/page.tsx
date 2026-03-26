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
  ArrowUpRight,
  ArrowDownLeft,
  MoreVertical
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

interface Transfer {
  id: string
  transfer_number: string
  from_warehouse_id: string
  to_warehouse_id: string
  status: 'draft' | 'in_transit' | 'completed' | 'cancelled'
  created_at: string
  notes: string
  from_warehouse: { name: string }
  to_warehouse: { name: string }
}

export default function TransferPage() {
  const { appUser } = useAuth()
  
  const [transfers, setTransfers] = useState<Transfer[]>([])
  const [warehouses, setWarehouses] = useState<{id: string, name: string}[]>([])
  const { isHQ, isLocked, selectedLocation, setSelectedLocation } = useStoreLocation()
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedQR, setSelectedQR] = useState<Transfer | null>(null)

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
        // ✅ REMOVED: setSelectedWarehouseId(whData[0].id) 
        // The hook handles the initial selection logic now.
      }
    } catch (err) {
      toast.error("Error loading warehouses")
    }
  }

  const fetchTransfers = async () => {
    // ✅ Use selectedLocation from hook
    if (!appUser || !selectedLocation) return 
    setLoading(true)
    try {
      let query = supabase
        .from('stock_transfers')
        .select(`
          *,
          from_warehouse:from_warehouse_id(name),
          to_warehouse:to_warehouse_id(name)
        `)
        .eq('company_id', appUser.company_id)
      
      // ✅ SECURITY: If not HQ/ALL, filter by the locked location
      if (selectedLocation !== 'ALL') {
        query = query.or(`from_warehouse_id.eq.${selectedLocation},to_warehouse_id.eq.${selectedLocation}`)
      }

      const { data: trData } = await query.order('created_at', { ascending: false })

      if (trData) setTransfers(trData as any)
    } catch (err) {
      toast.error("Error loading transfer data")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchWarehouses() }, [appUser])
  // ✅ Sync effect with the global location
  useEffect(() => { fetchTransfers() }, [appUser, selectedLocation])

  const filteredBySearch = transfers.filter(t => 
    t.transfer_number.toLowerCase().includes(searchTerm.toLowerCase())
  )
  
  // Logic: If 'ALL' is selected, show everything. Otherwise, filter by the specific ID.
  const incomingTransfers = filteredBySearch.filter(t => 
    (selectedLocation === 'ALL' || t.to_warehouse_id === selectedLocation) && 
    t.status !== 'completed'
  )
  
  const outgoingTransfers = filteredBySearch.filter(t => 
    (selectedLocation === 'ALL' || t.from_warehouse_id === selectedLocation) && 
    t.status !== 'completed'
  )
  
  const historyTransfers = filteredBySearch.filter(t => {
    const matchesLocation = selectedLocation === 'ALL' || 
                            t.to_warehouse_id === selectedLocation || 
                            t.from_warehouse_id === selectedLocation;
    return matchesLocation && t.status === 'completed';
  })

  if (!appUser) return null

  return (
    <div className="flex flex-col min-h-screen bg-[#fafafa]">
      {/* --- IDE TOOLBAR HEADER --- */}
      <header className="sticky top-0 z-40 w-full bg-white/80 backdrop-blur-md border-b border-gray-200 px-4 h-12 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3 overflow-hidden">
          <Link href="/dashboard">
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-md">
              <LayoutDashboard className="h-4 w-4 text-gray-500" />
            </Button>
          </Link>
          <Separator orientation="vertical" className="h-4" />
          <nav className="flex items-center gap-1.5 text-[13px] whitespace-nowrap overflow-hidden">
            <span className="text-gray-500 font-medium">Inventory</span>
            <ChevronRight className="h-3.5 w-3.5 text-gray-400" />
            <span className="font-bold text-gray-900 select-none">Stock Transfers</span>
            <div className="ml-3 hidden md:flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-gray-100 border border-gray-200">
              <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-tighter">Vault Sync</span>
            </div>
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="h-8 px-2 text-xs font-medium text-gray-500 hover:text-gray-900" onClick={fetchTransfers}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Separator orientation="vertical" className="h-4 mx-1" />
          <Button variant="outline" size="sm" className="h-8 text-xs font-bold px-3 shadow-sm border-gray-200 hidden sm:flex">
            <Database className="h-3.5 w-3.5 mr-1.5 text-gray-400" />
            Ledger
          </Button>
        </div>
      </header>

      <main className="p-4 md:p-6 lg:p-8 max-w-[1400px] w-full mx-auto space-y-6 animate-in fade-in duration-500">
        
        {/* ACTION BAR */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex gap-2 w-full md:w-auto">
            <Button asChild variant="outline" size="sm" className="flex-1 sm:flex-none h-9 font-bold text-xs uppercase tracking-tight bg-white border-gray-200 shadow-sm">
              <Link href="/transfer/receive">
                <PackageCheck className="w-3.5 h-3.5 mr-2 text-emerald-600" /> Secure Receive
              </Link>
            </Button>
            <Button asChild size="sm" className="flex-1 md:flex-none h-9 font-bold text-xs uppercase tracking-tight shadow-md">
              <Link href="/inventory">
                <Truck className="w-3.5 h-3.5 mr-2" /> New Dispatch
              </Link>
            </Button>
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <Input 
                placeholder="Search Transfer ID..." 
                className="pl-9 h-9 text-xs bg-white border-gray-200"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Select 
  value={selectedLocation || ''} 
  onValueChange={setSelectedLocation}
  disabled={isLocked} // ✅ Prevents branch users from switching vaults
>
  <SelectTrigger className="w-[180px] h-9 text-xs font-bold border-gray-200 bg-white">
    <SelectValue placeholder="Select Vault" />
  </SelectTrigger>
  <SelectContent>
    {/* ✅ Add ALL option for HQ users */}
    {isHQ && (
      <SelectItem value="ALL" className="text-xs font-bold text-indigo-600">
        All Vaults (HQ)
      </SelectItem>
    )}
    {warehouses.map(w => (
      <SelectItem key={w.id} value={w.id} className="text-xs font-medium">
        {w.name}
      </SelectItem>
    ))}
  </SelectContent>
</Select>
          </div>
        </div>

        <Tabs defaultValue="incoming" className="w-full">
          <TabsList className="bg-transparent border-b rounded-none h-11 w-full justify-start p-0 gap-6 mb-6">
            <TabsTrigger value="incoming" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent shadow-none h-full px-1 text-xs font-bold transition-all">
              Active Incoming ({incomingTransfers.length})
            </TabsTrigger>
            <TabsTrigger value="outgoing" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent shadow-none h-full px-1 text-xs font-bold transition-all">
              Active Outgoing ({outgoingTransfers.length})
            </TabsTrigger>
            <TabsTrigger value="history" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent shadow-none h-full px-1 text-xs font-bold transition-all">
              History ({historyTransfers.length})
            </TabsTrigger>
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
        </Tabs>
      </main>

      {/* QR DIALOG (Compact) */}
      <Dialog open={!!selectedQR} onOpenChange={() => setSelectedQR(null)}>
        <DialogContent className="sm:max-w-[360px] p-0 overflow-hidden border-none shadow-2xl">
          <DialogHeader className="bg-gray-50 p-6 border-b text-center">
            <DialogTitle className="text-lg font-bold">Transfer Key</DialogTitle>
            <DialogDescription className="text-xs">Physical verification required at destination.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center justify-center p-8 bg-white">
            <div className="p-4 rounded-xl border border-gray-100 shadow-inner bg-[#fafafa] mb-6">
              {selectedQR && <QRCode value={selectedQR.id} size={160} level="H" />}
            </div>
            <p className="font-mono text-sm font-black tracking-widest text-gray-900 uppercase">{selectedQR?.transfer_number}</p>
          </div>
          <DialogFooter className="bg-gray-50 p-4 border-t flex-row gap-2">
            <Button variant="ghost" className="flex-1 text-xs font-bold uppercase" onClick={() => setSelectedQR(null)}>Close</Button>
            <Button className="flex-1 text-xs font-bold uppercase" onClick={() => window.open(`/transfer/voucher/${selectedQR?.id}`, '_blank')}>
              <Printer className="w-3.5 h-3.5 mr-2" /> Print
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
        {[1,2,3].map(i => <Skeleton key={i} className="h-16 w-full rounded-lg border border-gray-100" />)}
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-20 bg-gray-50/50 border border-dashed rounded-xl">
        <History className="w-10 h-10 mx-auto mb-4 text-gray-200" />
        <p className="text-xs font-bold text-gray-400 uppercase tracking-tighter">No transfers found in this queue</p>
      </div>
    )
  }

  return (
    <>
      {/* DESKTOP TABLE VIEW */}
      <div className="hidden md:block overflow-hidden border border-gray-200/60 rounded-xl bg-white shadow-sm">
        <Table>
          <TableHeader className="bg-gray-50/50 border-b">
            <TableRow>
              <TableHead className="text-[10px] font-black uppercase text-gray-400 px-6 h-10">Identifier</TableHead>
              <TableHead className="text-[10px] font-black uppercase text-gray-400 px-4 h-10">Timestamp</TableHead>
              <TableHead className="text-[10px] font-black uppercase text-gray-400 px-4 h-10 text-center">Route</TableHead>
              <TableHead className="text-[10px] font-black uppercase text-gray-400 px-4 h-10">Status</TableHead>
              <TableHead className="w-[120px] text-right px-6"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((t) => {
              const isBlind = type === 'incoming' && t.status === 'in_transit';
              return (
                <TableRow key={t.id} className="hover:bg-gray-50/50 transition-colors border-b last:border-0">
                  <TableCell className="px-6 py-4">
                    {isBlind ? (
                      <span className="flex items-center text-[10px] font-black text-gray-300 uppercase tracking-[0.2em] italic">
                        <Lock className="w-3 h-3 mr-1.5" /> Secure Parcel
                      </span>
                    ) : (
                      <span className="font-mono font-bold text-xs text-gray-900">{t.transfer_number}</span>
                    )}
                  </TableCell>
                  <TableCell className="px-4">
                    <span className="text-[11px] font-bold text-gray-400 uppercase">{format(new Date(t.created_at), "dd MMM yy · HH:mm")}</span>
                  </TableCell>
                  <TableCell className="px-4">
                    <div className="flex items-center justify-center gap-3">
                       <span className="text-[11px] font-bold text-gray-600 bg-gray-100 px-2 py-0.5 rounded">{t.from_warehouse.name}</span>
                       <ChevronRight className="w-3 h-3 text-gray-300" />
                       <span className="text-[11px] font-bold text-primary bg-primary/5 px-2 py-0.5 rounded">{t.to_warehouse.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="px-4">
                     <Badge variant="outline" className={`text-[9px] font-black uppercase h-5 px-1.5 ${t.status === 'completed' ? 'border-emerald-200 text-emerald-600' : 'border-gray-200 text-gray-500'}`}>
                        {t.status.replace('_', ' ')}
                     </Badge>
                  </TableCell>
                  <TableCell className="px-6 text-right">
                    <div className="flex justify-end gap-2">
                      {type === 'outgoing' && t.status === 'in_transit' && (
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-400 hover:text-gray-900" onClick={() => onShowQR(t)}>
                          <QrCode className="h-4 w-4" />
                        </Button>
                      )}
                      {!isBlind && (
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-400 hover:text-gray-900" asChild>
                          <Link href={`/transfer/voucher/${t.id}`}><Printer className="h-4 w-4" /></Link>
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
          return (
            <Card key={t.id} className="shadow-sm border-gray-200/60 overflow-hidden bg-white">
              <CardContent className="p-4 space-y-4">
                <div className="flex justify-between items-start">
                   <div className="space-y-1">
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none">Reference</p>
                      {isBlind ? (
                        <span className="flex items-center text-xs font-bold text-gray-400 italic mt-1">
                          <Lock className="w-3 h-3 mr-1" /> SECURE PARCEL
                        </span>
                      ) : (
                        <p className="text-sm font-mono font-bold text-gray-900 mt-1">{t.transfer_number}</p>
                      )}
                   </div>
                   <Badge variant="outline" className={`text-[9px] font-black uppercase px-1.5 ${t.status === 'completed' ? 'border-emerald-200 text-emerald-600' : 'border-gray-200 text-gray-500'}`}>
                      {t.status}
                   </Badge>
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50 border border-gray-100">
                   <div className="text-center flex-1">
                      <p className="text-[8px] font-black text-gray-400 uppercase mb-1">Source</p>
                      <p className="text-[11px] font-bold text-gray-700 truncate">{t.from_warehouse.name}</p>
                   </div>
                   <div className="px-2">
                      <ChevronRight className="w-3 h-3 text-gray-300" />
                   </div>
                   <div className="text-center flex-1">
                      <p className="text-[8px] font-black text-gray-400 uppercase mb-1">Destination</p>
                      <p className="text-[11px] font-bold text-primary truncate">{t.to_warehouse.name}</p>
                   </div>
                </div>

                <div className="flex items-center justify-between gap-3 pt-1">
                   <span className="text-[10px] font-bold text-gray-400 uppercase">{format(new Date(t.created_at), "dd MMM · HH:mm")}</span>
                   <div className="flex gap-2">
                      {type === 'outgoing' && t.status === 'in_transit' && (
                        <Button variant="outline" size="sm" className="h-8 px-3 text-[10px] font-bold uppercase" onClick={() => onShowQR(t)}>
                          <QrCode className="h-3.5 w-3.5 mr-1.5" /> Key
                        </Button>
                      )}
                      {!isBlind && (
                        <Button variant="secondary" size="sm" className="h-8 px-3 text-[10px] font-bold uppercase" asChild>
                          <Link href={`/transfer/voucher/${t.id}`}>Voucher</Link>
                        </Button>
                      )}
                   </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </>
  )
}