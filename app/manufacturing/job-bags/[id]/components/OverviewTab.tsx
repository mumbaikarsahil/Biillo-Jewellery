"use client"

import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { useReactToPrint } from 'react-to-print'
import { JobBag, JobBagItem } from '../types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { supabase } from '@/lib/supabaseClient'
import { useToast } from '@/components/ui/use-toast'
import { format } from 'date-fns'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { 
  Trash2, Plus, Save, ListPlus, AlertCircle, Hammer, 
  Wrench, Check, ArrowLeft, Box, LayoutGrid, Loader2, 
  Printer, CheckSquare, Square
} from 'lucide-react'

// Adjust import path as needed based on your folder structure
import { ItemTagPreview } from '@/components/ItemTagPreview'

interface Props {
  job: JobBag & { 
    karigars?: { full_name: string }; 
    created_at?: string;
  }
}

type DraftItem = {
  id: string 
  sku_reference: string
  ornament_type: string
  expected_gold_weight_g: string
  expected_diamond_weight_cts: string
  custom_order_id?: string
  repair_ticket_id?: string
  store_restock_id?: string
  is_repair?: boolean
}

export default function OverviewTab({ job }: Props) {
  const [items, setItems] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const { toast } = useToast()

  const searchParams = useSearchParams()
  const customOrderId = searchParams.get('custom_order')
  const repairTicketId = searchParams.get('repair_ticket')
  const storeRestockId = searchParams.get('store_restock')
  
  const [activeCustomOrderId, setActiveCustomOrderId] = useState<string | null>(null)
  const [activeRepairTicketId, setActiveRepairTicketId] = useState<string | null>(null)
  const [activeStoreRestockId, setActiveStoreRestockId] = useState<string | null>(null)

  const [draftItems, setDraftItems] = useState<DraftItem[]>([])
  const [isSaving, setIsSaving] = useState(false)

  // Quick-Add Form State
  const [quantity, setQuantity] = useState('1')
  const [skuReference, setSkuReference] = useState('')
  const [ornamentType, setOrnamentType] = useState('')
  const [expectedGold, setExpectedGold] = useState('')
  const [expectedDiamond, setExpectedDiamond] = useState('')

  // --- CATEGORY & SKU AUTOCOMPLETE STATE ---
  const [categories, setCategories] = useState<string[]>([
    'LADIES RING', 'NECKLACE', 'GENTS RING', 'TOPS','BRACELET', 'PENDANT', 'GENTS STUD', 'TANMANIA','BANGLE', 'NOSE PIN'
  ])
  const [showCustomType, setShowCustomType] = useState(false)
  
  const [skuSuggestions, setSkuSuggestions] = useState<string[]>([])
  const [showSkuSuggestions, setShowSkuSuggestions] = useState(false)

  // --- PRINTING STATE & REFS ---
  const [selectedPrintIds, setSelectedPrintIds] = useState<Set<string>>(new Set())
  const printRef = useRef<HTMLDivElement>(null)
  
  // ✨ ADDED: Ref and handler for the full document/ledger
  const documentPrintRef = useRef<HTMLDivElement>(null)

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `JobBag-Tags-${job.job_bag_number}`,
  })

  // ✨ ADDED: Print handler for the ledger document
  const handlePrintDocument = useReactToPrint({
    contentRef: documentPrintRef,
    documentTitle: `JobBag-Ledger-${job.job_bag_number}`,
  })

  useEffect(() => {
    fetchItems()
    fetchExistingCategories()
  }, [job.id])

  // --- FETCH CATEGORIES ON MOUNT ---
  const fetchExistingCategories = async () => {
    const { data } = await supabase
      .from('job_bag_items')
      .select('ornament_type')
      .neq('ornament_type', null)
      .limit(300)
    
    if (data) {
      const uniqueCategories = Array.from(new Set(data.map(d => d.ornament_type))).filter(Boolean) as string[]
      setCategories(prev => {
        const combined = new Set([...prev, ...uniqueCategories])
        return Array.from(combined).sort()
      })
    }
  }

  // --- FETCH SKU SUGGESTIONS ---
  const handleSkuSearch = async (val: string) => {
    setSkuReference(val)
    if (val.length < 2) {
      setSkuSuggestions([])
      return
    }

    const { data } = await supabase
      .from('job_bag_items')
      .select('sku_reference')
      .ilike('sku_reference', `%${val}%`)
      .limit(10)
    
    if (data) {
      const uniqueSkus = Array.from(new Set(data.map(d => d.sku_reference))) as string[]
      setSkuSuggestions(uniqueSkus)
    }
  }

  useEffect(() => {
    if (customOrderId) {
      const fetchCustomOrderDetails = async () => {
        const { data, error } = await supabase
          .from('custom_orders')
          .select('*')
          .eq('id', customOrderId)
          .single()

        if (!error && data) {
          setSkuReference(data.design_reference || '')
          setOrnamentType(data.item_category || '')
          setExpectedGold(data.expected_gold_g?.toString() || '')
          setExpectedDiamond(data.expected_diamond_cts?.toString() || '')
          setActiveCustomOrderId(data.id)
          
          if (data.item_category && !categories.includes(data.item_category)) {
            setCategories(prev => [...prev, data.item_category])
          }

          toast({ title: "Store Request Loaded", description: "Custom order specifications have been populated in the grid." })
        }
      }
      fetchCustomOrderDetails()
    }
  }, [customOrderId])

  useEffect(() => {
    if (repairTicketId) {
      const fetchRepairDetails = async () => {
        const { data, error } = await supabase
          .from('repair_tickets')
          .select('*')
          .eq('id', repairTicketId)
          .single()

        if (!error && data) {
          setSkuReference(data.ticket_number || '')
          setOrnamentType(data.item_description || 'Repair')
          setExpectedGold(data.gross_weight_g?.toString() || '') 
          setActiveRepairTicketId(data.id)
          
          if (!categories.includes('Repair')) setCategories(prev => [...prev, 'Repair'])

          toast({ title: "Repair Ticket Loaded", description: "Repair specifications have been populated in the grid." })
        }
      }
      fetchRepairDetails()
    }
  }, [repairTicketId])

  useEffect(() => {
    if (storeRestockId) {
      const fetchRestockDetails = async () => {
        const { data, error } = await supabase
          .from('branch_restock_requests')
          .select('*')
          .eq('id', storeRestockId)
          .single()

        if (!error && data) {
          setSkuReference(data.sku_reference || data.design_reference || '')
          setOrnamentType(data.item_category || data.category || 'Restock')
          setExpectedGold(data.expected_gold_g?.toString() || '')
          setExpectedDiamond(data.expected_diamond_cts?.toString() || '')
          setActiveStoreRestockId(data.id)
          
          const cat = data.item_category || data.category
          if (cat && !categories.includes(cat)) {
            setCategories(prev => [...prev, cat])
          }

          toast({ title: "Store Restock Loaded", description: "Restock specifications have been populated in the grid." })
        }
      }
      fetchRestockDetails()
    }
  }, [storeRestockId])

  const fetchItems = async () => {
    try {
      setIsLoading(true)
      const { data, error } = await supabase
        .from('job_bag_items')
        .select('*, inventory_items(*)')
        .eq('job_bag_id', job.id)
        .order('created_at', { ascending: true })

      if (error) throw error
      setItems(data || [])
    } catch (error: any) {
      toast({ title: "Error fetching items", description: error.message, variant: "destructive" })
    } finally {
      setIsLoading(false)
    }
  }

  const handleAddDrafts = (e: React.FormEvent) => {
    e.preventDefault()
    if (!skuReference) {
      toast({ title: "Missing Data", description: "SKU/Style reference is required.", variant: "destructive" })
      return
    }

    const qty = parseInt(quantity) || 1
    const newDrafts: DraftItem[] = []

    for (let i = 0; i < qty; i++) {
      const suffix = qty > 1 ? `-${(i + 1).toString().padStart(2, '0')}` : ''
      
      newDrafts.push({
        id: Math.random().toString(36).substring(7), 
        sku_reference: `${skuReference}${suffix}`,
        ornament_type: ornamentType,
        expected_gold_weight_g: expectedGold,
        expected_diamond_weight_cts: expectedDiamond,
        custom_order_id: activeCustomOrderId || undefined,
        repair_ticket_id: activeRepairTicketId || undefined,
        store_restock_id: activeStoreRestockId || undefined,
        is_repair: !!activeRepairTicketId
      })
    }

    setDraftItems([...draftItems, ...newDrafts])
    
    setActiveCustomOrderId(null)
    setActiveRepairTicketId(null)
    setActiveStoreRestockId(null)
    setSkuReference('')
    setQuantity('1')
  }

  const updateDraftItem = (id: string, field: keyof DraftItem, value: string) => {
    setDraftItems(drafts => drafts.map(draft => 
      draft.id === id ? { ...draft, [field]: value } : draft
    ))
  }

  const removeDraftItem = (id: string) => {
    setDraftItems(drafts => drafts.filter(draft => draft.id !== id))
  }

  const saveDraftsToDatabase = async () => {
    if (draftItems.length === 0) return

    setIsSaving(true)
    try {
      const payload = draftItems.map(draft => ({
        job_bag_id: job.id,
        sku_reference: draft.sku_reference,
        ornament_type: draft.ornament_type || null,
        expected_gold_weight_g: draft.expected_gold_weight_g ? parseFloat(draft.expected_gold_weight_g) : null,
        expected_diamond_weight_cts: draft.expected_diamond_weight_cts ? parseFloat(draft.expected_diamond_weight_cts) : null,
        custom_order_id: draft.custom_order_id || null,
        repair_ticket_id: draft.repair_ticket_id || null,
        store_restock_id: draft.store_restock_id || null,
        is_repair: draft.is_repair || false,
        status: 'pending'
      }))

      const { error } = await supabase.from('job_bag_items').insert(payload)
      if (error) throw error

      const linkedOrderIds = draftItems.filter(d => d.custom_order_id).map(d => d.custom_order_id)
      if (linkedOrderIds.length > 0) {
        await supabase.from('custom_orders').update({ status: 'in_production' }).in('id', linkedOrderIds)
      }

      const linkedRepairIds = draftItems.filter(d => d.repair_ticket_id).map(d => d.repair_ticket_id)
      if (linkedRepairIds.length > 0) {
        await supabase.from('repair_tickets').update({ status: 'in_repair' }).in('id', linkedRepairIds)
      }

      const linkedRestockIds = draftItems.filter(d => d.store_restock_id).map(d => d.store_restock_id)
      if (linkedRestockIds.length > 0) {
        await supabase.from('branch_restock_requests').update({ status: 'in_production' }).in('id', linkedRestockIds)
      }

      toast({ title: "Success", description: `Added ${draftItems.length} items to job bag.` })
      setDraftItems([])
      fetchItems()
      fetchExistingCategories() 
      
      window.history.replaceState(null, '', window.location.pathname)

    } catch (error: any) {
      toast({ title: "Database Error", description: error.message, variant: "destructive" })
    } finally {
      setIsSaving(false)
    }
  }

  const deleteSavedItem = async (itemId: string, status: string) => {
    if (status !== 'pending') {
      return toast({ title: "Cannot Delete", description: "Only pending items can be deleted.", variant: "destructive" })
    }

    if (!confirm("Are you sure you want to remove this item from the job bag?")) return

    try {
      const { error } = await supabase.from('job_bag_items').delete().eq('id', itemId)
      if (error) throw error
      toast({ title: "Removed", description: "Item successfully removed." })
      fetchItems()
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" })
    }
  }

  // --- PRINTING LOGIC ---
  const receivedItems = items.filter(i => i.status === 'received')
  const isAllReceivedSelected = receivedItems.length > 0 && receivedItems.every(i => selectedPrintIds.has(i.id))
  
  const togglePrintSelectAll = () => {
    if (isAllReceivedSelected) {
      setSelectedPrintIds(new Set())
    } else {
      setSelectedPrintIds(new Set(receivedItems.map(i => i.id)))
    }
  }

  const togglePrintSelect = (id: string) => {
    const newSet = new Set(selectedPrintIds)
    if (newSet.has(id)) newSet.delete(id)
    else newSet.add(id)
    setSelectedPrintIds(newSet)
  }

  // Get the actual inventory records to print
  const itemsToPrint = items
    .filter(i => selectedPrintIds.has(i.id))
    .map(i => i.inventory_items?.[0]) 
    .filter(Boolean)

  // UI Theme Logic based on active loaded items
  const isCustomLoaded = !!activeCustomOrderId;
  const isRepairLoaded = !!activeRepairTicketId;
  const isRestockLoaded = !!activeStoreRestockId;

  const cardBorderClass = isCustomLoaded ? 'border-purple-200' : isRepairLoaded ? 'border-amber-200' : isRestockLoaded ? 'border-blue-200' : 'border-gray-200/60';
  const buttonClass = isCustomLoaded ? 'bg-purple-600 hover:bg-purple-700 text-white' : isRepairLoaded ? 'bg-amber-600 hover:bg-amber-700 text-white' : isRestockLoaded ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-gray-900 hover:bg-gray-800 text-white';

  return (
    <div className="space-y-6">
      
      {/* HEADER METADATA CARD */}
      <Card className="shadow-sm border-gray-200/60 rounded-2xl overflow-hidden bg-white">
        <CardContent className="p-5 sm:p-6">
          <div className="flex justify-between items-center mb-5 border-b border-gray-100 pb-4">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-1">Job Bag Reference</p>
              <h2 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight">{job.job_bag_number}</h2>
            </div>
            
            {/* ✨ UPDATED: Grouped Badge and Print Ledger Button */}
            <div className="flex items-center gap-3">
              <Button 
                onClick={handlePrintDocument} 
                variant="outline" 
                size="sm" 
                className="h-8 px-4 text-xs font-bold uppercase shadow-sm bg-white hover:bg-gray-50 text-gray-700 transition-colors hidden sm:flex border-gray-300"
              >
                <Printer className="w-3.5 h-3.5 mr-1.5" /> Print Ledger
              </Button>
              <Badge variant="secondary" className="bg-gray-100 text-gray-600 uppercase tracking-widest text-[10px] font-bold px-2.5 py-1 rounded-lg">
                {job.status}
              </Badge>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Category</p>
              <p className="text-sm font-semibold text-gray-800">{job.product_category || 'Unspecified'}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Design Code</p>
              <p className="text-sm font-semibold text-gray-800">{job.design_code || 'N/A'}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Est. Gold</p>
              <p className="text-sm font-semibold text-gray-800">{job.gold_expected_weight_g || 0} <span className="text-gray-400 font-medium">g</span></p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Est. Diamond</p>
              <p className="text-sm font-semibold text-gray-800">{job.diamond_expected_weight_cts || 0} <span className="text-gray-400 font-medium">cts</span></p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* FAST SKU ENTRY CARD */}
      <Card className={`shadow-sm overflow-visible rounded-2xl bg-white transition-colors border ${cardBorderClass}`}>
        <CardHeader className="py-4 px-5 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gray-50/50">
          <CardTitle className="text-[13px] font-bold text-gray-700 flex items-center gap-2">
            <LayoutGrid className="w-4 h-4 text-gray-400" strokeWidth={2} />
            Fast SKU Entry Grid
          </CardTitle>
          <div className="flex flex-wrap gap-2">
            {isCustomLoaded && (
              <Badge variant="secondary" className="bg-purple-50 text-purple-700 border-purple-200/50 text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-lg flex items-center gap-1.5">
                <Hammer className="w-3 h-3" strokeWidth={2}/> Custom Order Linked
              </Badge>
            )}
            {isRepairLoaded && (
              <Badge variant="secondary" className="bg-amber-50 text-amber-700 border-amber-200/50 text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-lg flex items-center gap-1.5">
                <Wrench className="w-3 h-3" strokeWidth={2}/> Repair Ticket Linked
              </Badge>
            )}
            {isRestockLoaded && (
              <Badge variant="secondary" className="bg-blue-50 text-blue-700 border-blue-200/50 text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-lg flex items-center gap-1.5">
                <Box className="w-3 h-3" strokeWidth={2}/> Restock Linked
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-visible">
          
          <form onSubmit={handleAddDrafts} className="flex flex-col md:flex-row md:items-end gap-3 p-5 border-b border-gray-100 overflow-visible">
            
            <div className="w-full md:w-20 space-y-1.5">
              <Label className="text-[11px] font-bold uppercase tracking-widest text-gray-500">Qty</Label>
              <Input 
                type="number" min="1" required 
                className="h-10 rounded-xl text-sm font-semibold bg-gray-50 border-gray-200/60 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-sm transition-all" 
                value={quantity} 
                onChange={(e) => setQuantity(e.target.value)} 
              />
            </div>
            
            <div className="w-full md:flex-1 space-y-1.5 relative">
              <Label className="text-[11px] font-bold uppercase tracking-widest text-gray-500">Base SKU / Style <span className="text-red-400">*</span></Label>
              <Input 
                required 
                placeholder="e.g. RNG-101" 
                className="h-10 rounded-xl text-sm font-semibold bg-gray-50 border-gray-200/60 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-sm transition-all font-mono uppercase" 
                value={skuReference} 
                onChange={(e) => handleSkuSearch(e.target.value)} 
                onFocus={() => setShowSkuSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSkuSuggestions(false), 200)}
              />
              {showSkuSuggestions && skuSuggestions.length > 0 && (
                <div className="absolute top-full left-0 w-full mt-2 bg-white border border-gray-200 shadow-xl rounded-xl z-50 max-h-48 overflow-y-auto p-1">
                  {skuSuggestions.map(sku => (
                    <div 
                      key={sku} 
                      className="px-3 py-2.5 text-sm font-medium hover:bg-gray-50 hover:text-blue-600 cursor-pointer rounded-lg transition-colors"
                      onClick={() => {
                        setSkuReference(sku)
                        setSkuSuggestions([])
                        setShowSkuSuggestions(false)
                      }}
                    >
                      {sku}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="w-full md:flex-1 space-y-1.5">
              <Label className="text-[11px] font-bold uppercase tracking-widest text-gray-500">Category Type</Label>
              {!showCustomType ? (
                <Select value={ornamentType} onValueChange={(val) => {
                  if (val === 'NEW') {
                    setShowCustomType(true)
                    setOrnamentType('')
                  } else {
                    setOrnamentType(val)
                  }
                }}>
                  <SelectTrigger className="h-10 rounded-xl text-sm font-medium bg-gray-50 border-gray-200/60 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-sm transition-all">
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl shadow-xl border-gray-100 p-1">
                    {categories.map(c => <SelectItem key={c} value={c} className="text-sm font-medium rounded-lg py-2 cursor-pointer">{c}</SelectItem>)}
                    <SelectItem value="NEW" className="text-sm font-bold text-blue-600 rounded-lg py-2 cursor-pointer">+ Add Custom Type</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <div className="flex gap-1.5 h-10">
                  <Input 
                    placeholder="Custom Type" 
                    className="h-10 rounded-xl text-sm font-medium bg-white border-blue-300 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-sm transition-all" 
                    value={ornamentType} 
                    onChange={(e) => setOrnamentType(e.target.value)} 
                  />
                  <Button 
                    type="button" 
                    className="h-10 w-10 shrink-0 bg-blue-600 text-white hover:bg-blue-700 rounded-xl shadow-sm" 
                    size="icon" 
                    onClick={() => {
                      setShowCustomType(false);
                      if (ornamentType && !categories.includes(ornamentType)) {
                        setCategories(prev => [...prev, ornamentType].sort());
                      }
                    }}
                  >
                    <Check className="h-4 w-4" strokeWidth={2.5} />
                  </Button>
                  <Button 
                    type="button" 
                    variant="ghost"
                    className="h-10 w-10 shrink-0 text-gray-400 rounded-xl hover:bg-gray-100" 
                    size="icon" 
                    onClick={() => {
                      setShowCustomType(false);
                      setOrnamentType('');
                    }}
                  >
                    <ArrowLeft className="h-4 w-4" strokeWidth={2} />
                  </Button>
                </div>
              )}
            </div>

            <div className="w-full md:w-32 space-y-1.5">
              <Label className="text-[11px] font-bold uppercase tracking-widest text-gray-500">Exp. Gold</Label>
              <div className="relative">
                <Input type="number" step="0.001" placeholder="0.00" className="h-10 rounded-xl text-sm font-semibold bg-gray-50 border-gray-200/60 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-sm transition-all pr-6" value={expectedGold} onChange={(e) => setExpectedGold(e.target.value)} />
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-gray-400">g</span>
              </div>
            </div>
            <div className="w-full md:w-32 space-y-1.5">
              <Label className="text-[11px] font-bold uppercase tracking-widest text-gray-500">Exp. Dia</Label>
              <div className="relative">
                <Input type="number" step="0.01" placeholder="0.00" className="h-10 rounded-xl text-sm font-semibold bg-gray-50 border-gray-200/60 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-sm transition-all pr-6" value={expectedDiamond} onChange={(e) => setExpectedDiamond(e.target.value)} />
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-gray-400">ct</span>
              </div>
            </div>
            <Button type="submit" className={`w-full md:w-auto h-10 px-5 rounded-xl text-[13px] font-bold shadow-sm transition-all active:scale-95 ${buttonClass}`}>
              <Plus className="w-4 h-4 mr-1.5" strokeWidth={2} /> Stage
            </Button>
          </form>

          {/* DRAFT ITEMS GRID */}
          {draftItems.length > 0 && (
            <div className="p-0 animate-in fade-in duration-300">
              <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
                <Table>
                  <TableHeader className="bg-gray-50/50 sticky top-0 z-10 backdrop-blur-md">
                    <TableRow className="border-gray-200/60 hover:bg-transparent">
                      <TableHead className="w-[50px]"></TableHead>
                      <TableHead className="text-[10px] font-bold uppercase tracking-widest text-gray-500 h-10">SKU / Style Ref</TableHead>
                      <TableHead className="text-[10px] font-bold uppercase tracking-widest text-gray-500 h-10">Category</TableHead>
                      <TableHead className="text-[10px] font-bold uppercase tracking-widest text-gray-500 h-10">Exp. Gold (g)</TableHead>
                      <TableHead className="text-[10px] font-bold uppercase tracking-widest text-gray-500 h-10">Exp. Dia (ct)</TableHead>
                      <TableHead className="text-[10px] font-bold uppercase tracking-widest text-gray-500 h-10">Context Tags</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {draftItems.map((draft) => (
                      <TableRow key={draft.id} className={draft.is_repair ? "bg-amber-50/30" : draft.custom_order_id ? "bg-purple-50/30" : draft.store_restock_id ? "bg-blue-50/30" : "bg-white hover:bg-gray-50/50 border-gray-100"}>
                        <TableCell className="p-2 text-center">
                          <Button type="button" variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors" onClick={() => removeDraftItem(draft.id)}>
                            <Trash2 className="w-4 h-4" strokeWidth={1.5} />
                          </Button>
                        </TableCell>
                        <TableCell className="p-2">
                          <Input className="h-9 rounded-lg text-xs font-bold bg-white border-gray-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" value={draft.sku_reference} onChange={(e) => updateDraftItem(draft.id, 'sku_reference', e.target.value)} />
                        </TableCell>
                        <TableCell className="p-2">
                          <Input className="h-9 rounded-lg text-xs font-medium bg-white border-gray-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" value={draft.ornament_type} onChange={(e) => updateDraftItem(draft.id, 'ornament_type', e.target.value)} />
                        </TableCell>
                        <TableCell className="p-2">
                          <Input type="number" step="0.001" className="h-9 rounded-lg text-xs font-medium bg-white border-gray-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" value={draft.expected_gold_weight_g} onChange={(e) => updateDraftItem(draft.id, 'expected_gold_weight_g', e.target.value)} />
                        </TableCell>
                        <TableCell className="p-2">
                          <Input type="number" step="0.001" className="h-9 rounded-lg text-xs font-medium bg-white border-gray-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" value={draft.expected_diamond_weight_cts} onChange={(e) => updateDraftItem(draft.id, 'expected_diamond_weight_cts', e.target.value)} />
                        </TableCell>
                        <TableCell className="p-2">
                          <div className="flex flex-wrap gap-1.5">
                            {draft.custom_order_id && (
                              <Badge variant="secondary" className="bg-purple-50 text-purple-700 text-[9px] uppercase tracking-widest font-bold border-purple-200/60 px-2 rounded-md">Custom</Badge>
                            )}
                            {draft.is_repair && (
                              <Badge variant="secondary" className="bg-amber-50 text-amber-700 text-[9px] uppercase tracking-widest font-bold border-amber-200/60 px-2 rounded-md">Repair</Badge>
                            )}
                            {draft.store_restock_id && (
                              <Badge variant="secondary" className="bg-blue-50 text-blue-700 text-[9px] uppercase tracking-widest font-bold border-blue-200/60 px-2 rounded-md">Restock</Badge>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="p-4 bg-gray-50/50 border-t border-gray-100 flex flex-col sm:flex-row justify-between items-center gap-4">
                <p className="text-xs font-semibold text-gray-500 flex items-center"><AlertCircle className="w-4 h-4 mr-1.5 text-gray-400" strokeWidth={1.5} /> {draftItems.length} uncommitted item(s) in staging grid.</p>
                <Button onClick={saveDraftsToDatabase} disabled={isSaving} className="h-10 px-6 rounded-xl text-[13px] font-bold shadow-sm bg-gray-900 text-white hover:bg-gray-800 transition-all w-full sm:w-auto">
                  {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" strokeWidth={2} />} 
                  Commit to Job Bag
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* COMMITTED SKUS LIST */}
      <Card className="shadow-sm border-gray-200/60 rounded-2xl overflow-hidden bg-white">
        <CardHeader className="py-4 px-5 border-b border-gray-100 bg-white flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <CardTitle className="text-[13px] font-bold text-gray-800">Committed Job Bag SKUs</CardTitle>
          
          {/* PRINT CONTROLS */}
          <div className="flex items-center gap-3">
            <span className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">
               {selectedPrintIds.size} Tags Selected
            </span>
            <Button 
               onClick={handlePrint} 
               disabled={selectedPrintIds.size === 0} 
               size="sm" 
               className="h-8 px-4 text-xs font-bold uppercase shadow-sm bg-blue-600 hover:bg-blue-700 text-white transition-colors"
            >
               <Printer className="w-3.5 h-3.5 mr-1.5" /> Print Tags
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <p className="text-sm font-medium text-gray-400 text-center py-8">Loading items...</p>
          ) : items.length === 0 ? (
            <div className="text-center py-12 bg-gray-50/30">
              <div className="h-12 w-12 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-3">
                 <ListPlus className="w-6 h-6 text-gray-300" strokeWidth={1.5} />
              </div>
              <p className="text-sm font-bold text-gray-600">No items committed yet.</p>
              <p className="text-xs font-medium text-gray-400 mt-1">Use the fast entry grid above to stage and add SKUs.</p>
            </div>
          ) : (
            <div className="overflow-x-auto custom-scrollbar">
              <Table>
                <TableHeader className="bg-gray-50/80">
                  <TableRow className="border-gray-200/60 hover:bg-transparent">
                    {/* CHECKBOX HEADER */}
                    <TableHead className="w-[50px] text-center px-2">
                       <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={togglePrintSelectAll} 
                          disabled={receivedItems.length === 0}
                          className="h-8 w-8 p-0 text-gray-500 hover:text-blue-600"
                       >
                          {isAllReceivedSelected && receivedItems.length > 0 ? <CheckSquare className="w-4 h-4 text-blue-600" /> : <Square className="w-4 h-4" />}
                       </Button>
                    </TableHead>
                    <TableHead className="text-[11px] font-bold uppercase tracking-widest text-gray-500 h-11 px-2">SKU Reference</TableHead>
                    <TableHead className="text-[11px] font-bold uppercase tracking-widest text-gray-500 h-11">Category</TableHead>
                    <TableHead className="text-[11px] font-bold uppercase tracking-widest text-gray-500 h-11 text-right">Exp Gold</TableHead>
                    <TableHead className="text-[11px] font-bold uppercase tracking-widest text-gray-500 h-11 text-right">Exp Dia</TableHead>
                    <TableHead className="text-[11px] font-bold uppercase tracking-widest text-gray-500 h-11">Status / Tags</TableHead>
                    <TableHead className="w-[60px] h-11"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item: any) => {
                    const isReceived = item.status === 'received';
                    const isSelectedForPrint = selectedPrintIds.has(item.id);

                    return (
                      <TableRow key={item.id} className={`${isSelectedForPrint ? 'bg-blue-50/40' : 'hover:bg-gray-50/50'} border-gray-100 transition-colors`}>
                        {/* CHECKBOX CELL */}
                        <TableCell className="p-2 text-center align-middle">
                           {isReceived ? (
                             <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => togglePrintSelect(item.id)} 
                                className="h-8 w-8 p-0 hover:bg-transparent"
                             >
                                {isSelectedForPrint ? <CheckSquare className="w-4 h-4 text-blue-600" /> : <Square className="w-4 h-4 text-gray-300" />}
                             </Button>
                           ) : (
                             <span title="Item not received yet" className="inline-block px-2 opacity-30"><Square className="w-4 h-4 text-gray-200" /></span>
                           )}
                        </TableCell>
                        
                        <TableCell className="px-2 py-3.5">
                          <div className="font-mono font-bold text-[13px] text-gray-900">{item.sku_reference}</div>
                        </TableCell>
                        <TableCell className="py-3.5">
                          <div className="text-[13px] font-medium text-gray-700">{item.ornament_type || '-'}</div>
                        </TableCell>
                        <TableCell className="text-[13px] text-right font-semibold text-gray-700 py-3.5">
                          {item.expected_gold_weight_g ? `${item.expected_gold_weight_g} g` : '-'}
                        </TableCell>
                        <TableCell className="text-[13px] text-right font-semibold text-gray-700 py-3.5">
                          {item.expected_diamond_weight_cts ? `${item.expected_diamond_weight_cts} cts` : '-'}
                        </TableCell>
                        <TableCell className="py-3.5">
                          <div className="flex flex-wrap gap-1.5">
                            <Badge variant={item.status === 'pending' ? 'outline' : 'secondary'} className={`text-[9px] font-bold uppercase tracking-widest px-2 rounded-md ${item.status === 'received' ? 'bg-emerald-50 text-emerald-700 border-none' : 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                              {item.status}
                            </Badge>
                            {item.custom_order_id && (
                              <Badge variant="secondary" className="bg-purple-50 text-purple-700 text-[9px] uppercase tracking-widest font-bold border-none px-2 rounded-md">
                                Custom
                              </Badge>
                            )}
                            {item.is_repair && (
                              <Badge variant="secondary" className="bg-amber-50 text-amber-700 text-[9px] uppercase tracking-widest font-bold border-none px-2 rounded-md">
                                Repair
                              </Badge>
                            )}
                            {item.store_restock_id && (
                              <Badge variant="secondary" className="bg-blue-50 text-blue-700 text-[9px] uppercase tracking-widest font-bold border-none px-2 rounded-md">
                                Restock
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="py-3.5 text-right px-4">
                          {item.status === 'pending' && (
                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors" onClick={() => deleteSavedItem(item.id, item.status)}>
                              <Trash2 className="w-4 h-4" strokeWidth={1.5} />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* HIDDEN PRINT CONTAINER (TAGS) */}
      <div className="hidden">
        <div ref={printRef} className="print:p-0 flex flex-col">
           {itemsToPrint.map((invItem) => (
             <ItemTagPreview 
               key={invItem.id} 
               item={invItem} 
               isPrintOnly={true} 
               onClose={() => {}} 
             />
           ))}
        </div>
      </div>

      {/* ✨ ADDED: HIDDEN PRINT CONTAINER (FULL LEDGER DOCUMENT) */}
      <div className="hidden">
        <div ref={documentPrintRef} className="print:block p-6 bg-white font-sans w-[210mm] min-h-[297mm]">
           
           {/* Document Header */}
           <div className="text-center mb-2">
              <h1 className="text-4xl font-black uppercase tracking-widest text-[#b91c1c]">OSSAM JEWELS</h1>
              <p className="text-[13px] font-bold text-[#b91c1c] tracking-wide">Diamonds-n-Jewellery</p>
              <p className="text-[11px] font-bold text-[#b91c1c] mt-1">Issue to Karigar and Jewellery Receipt Mfg. Memo.</p>
           </div>

           {/* Metadata Details */}
           <div className="flex justify-between items-end mb-3">
              <div className="flex flex-col gap-2">
                 <div className="flex items-end gap-2 text-sm font-bold text-[#b91c1c]">
                    <span className="w-20">MEMO No.:</span>
                    <span className="border-b border-[#b91c1c] min-w-[150px] inline-block text-black px-2 pb-0.5">{job.job_bag_number}</span>
                 </div>
                 <div className="flex items-end gap-2 text-sm font-bold text-[#b91c1c]">
                    <span className="w-20">Name :</span>
                    <span className="border-b border-[#b91c1c] min-w-[250px] inline-block text-black px-2 pb-0.5">{job.karigars?.full_name || ''}</span>
                 </div>
              </div>
              <div className="flex flex-col gap-2 items-end">
                 <div className="flex items-end gap-2 text-sm font-bold text-[#b91c1c]">
                    <span>Date :</span>
                    <span className="border-b border-[#b91c1c] min-w-[120px] inline-block text-black px-2 text-center pb-0.5">{format(new Date(job.created_at || new Date()), 'dd/MM/yyyy')}</span>
                 </div>
                 <div className="text-xs font-bold mt-1 text-[#b91c1c]">
                    GST NO: <span className="text-black ml-1">27AAOPM1004A1ZB</span> {/* Replace with actual warehouse GST if dynamic */}
                 </div>
              </div>
           </div>

           {/* Banner */}
           <div className="w-full text-center border-y-2 border-[#b91c1c] py-1 mb-0 bg-red-50/10">
              <p className="text-[10px] font-bold text-[#b91c1c]">Please receive the following Diamonds and Metal on approval and for setting in jewellery or to show.</p>
           </div>

           {/* Items Table Grid */}
           <table className="w-full border-collapse border-2 border-t-0 border-[#b91c1c] text-[10px] text-center table-fixed">
              <thead>
                 <tr className="text-[#b91c1c]">
                   <th className="border-b-2 border-r border-[#b91c1c] p-1 font-bold w-8" rowSpan={2}>Qty</th>
                   <th className="border-b-2 border-r border-[#b91c1c] p-1 font-bold w-10" rowSpan={2}>Sr.no</th>
                   <th className="border-b-2 border-r border-[#b91c1c] p-1 font-bold w-[90px]" rowSpan={2}>Jewellery<br/>Design</th>
                   <th className="border-b border-r border-[#b91c1c] p-1 font-bold" colSpan={6}>Studding Details</th>
                   <th className="border-b-2 border-r border-[#b91c1c] p-1 font-bold w-14 leading-tight" rowSpan={2}>Jewellery<br/>Recieved<br/>Date</th>
                   <th className="border-b border-r border-[#b91c1c] p-1 font-bold" colSpan={2}>Remark</th>
                   <th className="border-b-2 p-1 font-bold w-12 text-center" rowSpan={2}>Remark<br/><span className="font-normal text-[9px]">size</span></th>
                 </tr>
                 <tr className="border-b-2 border-[#b91c1c] text-[#b91c1c]">
                   <th className="border-r border-[#b91c1c] p-1 font-bold w-10 leading-tight">Type of<br/>Dia.</th>
                   <th className="border-r border-[#b91c1c] p-1 font-bold w-8 leading-tight">Dia.<br/>Pcs.</th>
                   <th className="border-r border-[#b91c1c] p-1 font-bold w-12 leading-tight">Dia.<br/>Carats</th>
                   <th className="border-r border-[#b91c1c] p-1 font-bold w-8 leading-tight">G.<br/>KT</th>
                   <th className="border-r border-[#b91c1c] p-1 font-bold w-10">14K</th>
                   <th className="border-r border-[#b91c1c] p-1 font-bold w-10">18K</th>
                   <th className="border-r border-[#b91c1c] p-1 font-normal w-14">Party name</th>
                   <th className="border-r border-[#b91c1c] p-1 font-normal w-14">Party Place</th>
                 </tr>
              </thead>
              <tbody className="text-black font-semibold">
                 {/* Render Actual Items */}
                 {items.map((item, idx) => {
                   const tags = [
                     item.custom_order_id && 'Custom', 
                     item.is_repair && 'Repair', 
                     item.store_restock_id && 'Restock'
                   ].filter(Boolean).join(', ');

                   return (
                     <tr key={item.id} className="border-b border-[#b91c1c] h-8">
                       <td className="border-r border-[#b91c1c] p-1">1</td>
                       <td className="border-r border-[#b91c1c] p-1">{idx + 1}</td>
                       <td className="border-r border-[#b91c1c] p-1 text-[9px] leading-tight break-words">{item.sku_reference} <br/><span className="font-medium text-[8px]">{item.ornament_type}</span></td>
                       <td className="border-r border-[#b91c1c] p-1"></td>
                       <td className="border-r border-[#b91c1c] p-1"></td>
                       <td className="border-r border-[#b91c1c] p-1">{item.expected_diamond_weight_cts || ''}</td>
                       <td className="border-r border-[#b91c1c] p-1"></td>
                       <td className="border-r border-[#b91c1c] p-1"></td>
                       <td className="border-r border-[#b91c1c] p-1">{item.expected_gold_weight_g || ''}</td>
                       <td className="border-r border-[#b91c1c] p-1"></td>
                       <td className="border-r border-[#b91c1c] p-1 text-[8px] leading-tight break-words">{tags}</td>
                       <td className="border-r border-[#b91c1c] p-1"></td>
                       <td className="p-1"></td>
                     </tr>
                   )
                 })}
                 
                 {/* Empty grid rows for manual writing to replicate the physical book design */}
                 {Array.from({ length: Math.max(0, 10 - items.length) }).map((_, idx) => (
                    <tr key={`empty-${idx}`} className="border-b border-[#b91c1c] h-[34px]">
                       <td className="border-r border-[#b91c1c] p-1"></td>
                       <td className="border-r border-[#b91c1c] p-1"></td>
                       <td className="border-r border-[#b91c1c] p-1"></td>
                       <td className="border-r border-[#b91c1c] p-1"></td>
                       <td className="border-r border-[#b91c1c] p-1"></td>
                       <td className="border-r border-[#b91c1c] p-1"></td>
                       <td className="border-r border-[#b91c1c] p-1"></td>
                       <td className="border-r border-[#b91c1c] p-1"></td>
                       <td className="border-r border-[#b91c1c] p-1"></td>
                       <td className="border-r border-[#b91c1c] p-1"></td>
                       <td className="border-r border-[#b91c1c] p-1"></td>
                       <td className="border-r border-[#b91c1c] p-1"></td>
                       <td className="p-1"></td>
                     </tr>
                 ))}
              </tbody>
           </table>

           {/* Footer Signatures Area */}
           <div className="w-full border-2 border-t-0 border-[#b91c1c] flex flex-col text-[#b91c1c]">
              <div className="flex border-b-2 border-[#b91c1c] bg-red-50/10">
                 <div className="flex-1 py-1.5 px-2 text-center text-[10px] font-bold border-r-2 border-[#b91c1c] leading-tight">
                    Acknowledgement of entrustment<br/>as per the conditions on reverse
                 </div>
                 <div className="flex-1 py-1.5 px-2 text-center text-[10px] font-bold flex items-center justify-center">
                    Subject to Mumbai Jurisdiction
                 </div>
              </div>
              <div className="flex h-20">
                 <div className="flex-1 p-2 text-center text-[10px] font-bold border-r-2 border-[#b91c1c] flex items-end justify-center">
                    Receiver's Signature
                 </div>
                 <div className="flex-1 p-2 text-center text-[10px] font-bold flex items-end justify-center">
                    For BIILLO JEWELS
                 </div>
              </div>
           </div>

        </div>
      </div>

    </div>
  )
}