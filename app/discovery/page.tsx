'use client'

import React, { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { 
  Select, SelectContent, SelectItem, 
  SelectTrigger, SelectValue 
} from '@/components/ui/select'
import { supabase } from '@/lib/supabaseClient'
import { useToast } from '@/hooks/use-toast'
import { 
  ScanLine, Camera, Search, Gem, 
  Info, Store, Scale, X, Sparkles
} from 'lucide-react'

interface ProductDiscovery {
  id: string
  barcode: string
  metal_type: string
  purity_karat: string
  gross_weight_g: number
  net_weight_g: number
  total_stone_weight_cts: number
  item_category: string
  mrp: number
  status: string
  is_exchanged: boolean
}

export default function DiscoveryPage() {
  const { appUser, loading: authLoading } = useAuth()
  const { toast } = useToast()
  
  // Core State
  const [warehouses, setWarehouses] = useState<{id: string, name: string}[]>([])
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('')
  const [searchInput, setSearchInput] = useState('')
  const [isScanning, setIsScanning] = useState(false)
  
  // Found Product State
  const [product, setProduct] = useState<ProductDiscovery | null>(null)
  const [fetching, setFetching] = useState(false)

  // 1. Initial Load: Fetch Warehouses
  useEffect(() => {
    const init = async () => {
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
          setSelectedWarehouseId(whData[0].id)
        }
      } catch (err) {
        toast({ title: 'Connection Error', variant: 'destructive' })
      }
    }
    init()
  }, [appUser])

  // 2. Search/Scan Logic
  const handleDiscovery = async (barcode: string) => {
    if (!barcode.trim()) return
    if (!selectedWarehouseId) {
        return toast({ title: "Select Branch First", description: "Select your current location.", variant: "destructive" })
    }

    setFetching(true)
    try {
      const { data, error } = await supabase
        .from('inventory_items')
        .select('*')
        .ilike('barcode', barcode.trim())
        .eq('company_id', appUser?.company_id)
        .maybeSingle()

      if (error) throw error
      if (!data) {
        toast({ title: "Item Not Found", description: "This barcode does not exist in the system.", variant: "destructive" })
        setProduct(null)
      } else {
        setProduct(data)
        setSearchInput('')
      }
    } catch (err) {
      toast({ title: "Discovery Failed", variant: "destructive" })
    } finally {
      setFetching(false)
    }
  }

  if (authLoading || !appUser) return null

  // 3. Price Math
  const gstAmount = product ? (product.mrp * 0.03) : 0
  const finalPrice = product ? (product.mrp + gstAmount) : 0

  return (
    <div className="min-h-screen bg-slate-50 p-4 pb-20 md:p-8">
      
      {/* Top Header */}
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex flex-col gap-1">
            <h1 className="text-3xl font-black tracking-tight text-slate-900 flex items-center gap-2">
               <Sparkles className="w-6 h-6 text-indigo-500" /> Product Discovery
            </h1>
            <p className="text-slate-500 text-sm">Instantly retrieve details and quotes for any ornament.</p>
        </div>

        {/* 1. Branch Selector (High Priority) */}
        <Card className="border-slate-200 shadow-sm overflow-hidden">
          <CardHeader className="py-3 px-4 bg-slate-50/50 border-b">
            <CardTitle className="text-xs font-bold uppercase tracking-widest text-slate-500 flex items-center gap-2">
              <Store className="w-3.5 h-3.5" /> Current Location
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <Select value={selectedWarehouseId} onValueChange={setSelectedWarehouseId}>
              <SelectTrigger className="h-12 text-base font-bold bg-white border-slate-300">
                <SelectValue placeholder="Select Branch..." />
              </SelectTrigger>
              <SelectContent>
                {warehouses.map(w => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* 2. Scanning / Input Area */}
        <div className="grid grid-cols-12 gap-3">
            <div className="col-span-9 relative">
                <Input 
                    placeholder="Enter Barcode Number..."
                    className="h-14 pl-12 text-lg font-mono tracking-widest border-slate-300 shadow-sm uppercase"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleDiscovery(searchInput)}
                />
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
            </div>
            <Button 
                onClick={() => setIsScanning(!isScanning)}
                className={`col-span-3 h-14 ${isScanning ? 'bg-red-500 hover:bg-red-600' : 'bg-indigo-600 hover:bg-indigo-700'}`}
            >
                {isScanning ? <X /> : <Camera className="w-6 h-6" />}
            </Button>
        </div>

        {/* 3. Result Area */}
        {product ? (
           <Card className="border-indigo-200 shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-300">
             <div className="bg-indigo-600 p-4 text-white flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-white/20 rounded-lg"><Gem className="w-5 h-5" /></div>
                    <div>
                        <p className="text-[10px] font-bold uppercase tracking-tighter opacity-80">Barcode Number</p>
                        <h2 className="text-xl font-black tracking-widest leading-none">{product.barcode}</h2>
                    </div>
                </div>
                <Badge className="bg-white text-indigo-700 font-black uppercase text-[10px]">{product.status.replace('_',' ')}</Badge>
             </div>

             <CardContent className="p-6 space-y-6">
                
                {/* Visual Metadata Grid */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Category</label>
                        <p className="font-bold text-slate-800 flex items-center gap-1.5"><Info className="w-3.5 h-3.5 text-indigo-400" /> {product.item_category}</p>
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Metal & Purity</label>
                        <p className="font-bold text-slate-800 flex items-center gap-1.5"><Gem className="w-3.5 h-3.5 text-yellow-500" /> {product.metal_type} ({product.purity_karat})</p>
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Gross Weight</label>
                        <p className="font-bold text-slate-800 flex items-center gap-1.5"><Scale className="w-3.5 h-3.5 text-slate-400" /> {product.gross_weight_g}g</p>
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Net Weight</label>
                        <p className="font-bold text-slate-800 flex items-center gap-1.5"><Scale className="w-3.5 h-3.5 text-slate-400" /> {product.net_weight_g}g</p>
                    </div>
                </div>

                <div className="h-px bg-slate-100 w-full" />

                {/* PRICE CALCULATION BLOCK */}
                <div className="bg-slate-50 rounded-2xl p-6 space-y-4 border border-slate-100">
                    <div className="flex justify-between items-center text-slate-500">
                        <span className="text-sm font-medium">Billed Price (Before Tax)</span>
                        <span className="font-bold text-slate-700 font-mono text-lg">₹{product.mrp.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center text-slate-500 pb-2 border-b border-dashed border-slate-300">
                        <span className="text-sm font-medium">GST (3%)</span>
                        <span className="font-bold text-green-600 font-mono">+ ₹{gstAmount.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-end pt-2">
                        <div>
                            <p className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.2em]">Estimated Quote</p>
                            <span className="text-slate-400 text-xs italic">Inclusive of all taxes</span>
                        </div>
                        <span className="text-4xl font-black text-slate-900 tracking-tighter font-mono">₹{finalPrice.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                    </div>
                </div>

                <Button 
                  onClick={() => setProduct(null)} 
                  variant="ghost" 
                  className="w-full text-slate-400 hover:text-red-500"
                >
                  Clear Result
                </Button>
             </CardContent>
           </Card>
        ) : (
            <div className="flex flex-col items-center justify-center py-20 text-slate-300 space-y-4">
                <div className="w-20 h-20 bg-white rounded-full border-2 border-dashed border-slate-200 flex items-center justify-center">
                    <ScanLine className="w-10 h-10" />
                </div>
                <div className="text-center">
                    <p className="font-bold text-slate-400">Ready to Discover</p>
                    <p className="text-xs">Scan a barcode or type it in to get a live quote.</p>
                </div>
            </div>
        )}
      </div>

      {/* FIXED FOOTER STATUS */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-3 flex justify-center">
        <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            Live Cloud Sync: Active
        </div>
      </div>

    </div>
  )
}