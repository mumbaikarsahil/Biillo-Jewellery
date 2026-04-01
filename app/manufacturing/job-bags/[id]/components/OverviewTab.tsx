'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { JobBag, JobBagItem } from '../types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { supabase } from '@/lib/supabaseClient'
import { useToast } from '@/components/ui/use-toast'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Trash2, Plus, Save, ListPlus, AlertCircle, Hammer, Wrench } from 'lucide-react'

interface Props {
  job: JobBag
}

// Temporary type for the staging grid
type DraftItem = {
  id: string 
  sku_reference: string
  ornament_type: string
  expected_gold_weight_g: string
  expected_diamond_weight_cts: string
  custom_order_id?: string // Tracks the origin custom order
  repair_ticket_id?: string // Tracks the origin repair ticket
  is_repair?: boolean
}

export default function OverviewTab({ job }: Props) {
  const [items, setItems] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const { toast } = useToast()

  // --- ROUTING STATE (CUSTOM ORDERS & REPAIRS) ---
  const searchParams = useSearchParams()
  const customOrderId = searchParams.get('custom_order')
  const repairTicketId = searchParams.get('repair_ticket')
  
  const [activeCustomOrderId, setActiveCustomOrderId] = useState<string | null>(null)
  const [activeRepairTicketId, setActiveRepairTicketId] = useState<string | null>(null)

  // Draft Grid State
  const [draftItems, setDraftItems] = useState<DraftItem[]>([])
  const [isSaving, setIsSaving] = useState(false)

  // Quick-Add Form State
  const [quantity, setQuantity] = useState('1')
  const [skuReference, setSkuReference] = useState('')
  const [ornamentType, setOrnamentType] = useState('')
  const [expectedGold, setExpectedGold] = useState('')
  const [expectedDiamond, setExpectedDiamond] = useState('')

  useEffect(() => {
    fetchItems()
  }, [job.id])

  // --- AUTOMATIC PRE-FILL FROM CUSTOM ORDER ---
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
          
          toast({ 
            title: "Store Request Loaded", 
            description: "Custom order specifications have been populated in the grid." 
          })
        }
      }
      fetchCustomOrderDetails()
    }
  }, [customOrderId, toast])

  // --- AUTOMATIC PRE-FILL FROM REPAIR TICKET ---
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
          
          toast({ 
            title: "Repair Ticket Loaded", 
            description: "Repair specifications have been populated in the grid." 
          })
        }
      }
      fetchRepairDetails()
    }
  }, [repairTicketId, toast])

  const fetchItems = async () => {
    try {
      setIsLoading(true)
      const { data, error } = await supabase
        .from('job_bag_items')
        .select('*')
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

  // --- 1. DRAFTING LOGIC ---
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
        is_repair: !!activeRepairTicketId
      })
    }

    setDraftItems([...draftItems, ...newDrafts])
    
    // Clear active links so subsequent manual additions aren't linked to the same customer
    setActiveCustomOrderId(null)
    setActiveRepairTicketId(null)
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

  // --- 2. COMMITTING LOGIC ---
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
        is_repair: draft.is_repair || false,
        status: 'pending'
      }))

      const { error } = await supabase.from('job_bag_items').insert(payload)
      if (error) throw error

      // Update Custom Order Statuses to 'in_production' if any were linked
      const linkedOrderIds = draftItems.filter(d => d.custom_order_id).map(d => d.custom_order_id)
      if (linkedOrderIds.length > 0) {
        await supabase
          .from('custom_orders')
          .update({ status: 'in_production' })
          .in('id', linkedOrderIds)
      }

      // Update Repair Ticket Statuses to 'in_repair' if any were linked
      const linkedRepairIds = draftItems.filter(d => d.repair_ticket_id).map(d => d.repair_ticket_id)
      if (linkedRepairIds.length > 0) {
        await supabase
          .from('repair_tickets')
          .update({ status: 'in_repair' })
          .in('id', linkedRepairIds)
      }

      toast({ title: "Success", description: `Added ${draftItems.length} items to job bag.` })
      setDraftItems([])
      fetchItems()
      
      // Clean up URL so a page refresh doesn't trigger the auto-fill again
      window.history.replaceState(null, '', window.location.pathname)

    } catch (error: any) {
      toast({ title: "Database Error", description: error.message, variant: "destructive" })
    } finally {
      setIsSaving(false)
    }
  }

  // --- 3. DELETE SAVED ITEM ---
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

  // Styling Helpers based on what is actively loaded
  const isCustomLoaded = !!activeCustomOrderId;
  const isRepairLoaded = !!activeRepairTicketId;
  const cardBorderClass = isCustomLoaded ? 'border-purple-300 ring-2 ring-purple-100' : isRepairLoaded ? 'border-amber-300 ring-2 ring-amber-100' : 'border-primary/20';
  const headerBgClass = isCustomLoaded ? 'bg-purple-50/80 border-purple-200' : isRepairLoaded ? 'bg-amber-50/80 border-amber-200' : 'bg-primary/5 border-primary/10';
  const headerIconClass = isCustomLoaded ? 'text-purple-800' : isRepairLoaded ? 'text-amber-800' : 'text-primary';
  const formBgClass = (isCustomLoaded || isRepairLoaded) ? 'bg-white/50' : 'bg-muted/10';
  const buttonClass = isCustomLoaded ? 'bg-purple-600 hover:bg-purple-700' : isRepairLoaded ? 'bg-amber-600 hover:bg-amber-700 text-white' : '';

  return (
    <div className="space-y-6">
      
      {/* 1. Job Bag Summary Card */}
      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold">Job Bag: {job.job_bag_number}</h2>
            <Badge>{job.status}</Badge>
          </div>

          <div className="grid md:grid-cols-4 gap-4 text-sm mt-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Product Category</p>
              <p className="font-medium mt-1">{job.product_category || '-'}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Design Code</p>
              <p className="font-medium mt-1">{job.design_code || '-'}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Total Expected Gold</p>
              <p className="font-medium mt-1">{job.gold_expected_weight_g || 0} g</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Total Expected Diamond</p>
              <p className="font-medium mt-1">{job.diamond_expected_weight_cts || 0} cts</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 2. Fast Entry System (Drafting) */}
      <Card className={`shadow-sm overflow-hidden ${cardBorderClass}`}>
        <CardHeader className={`py-4 border-b flex flex-row items-center justify-between ${headerBgClass}`}>
          <CardTitle className={`text-sm flex items-center gap-2 ${headerIconClass}`}>
            <ListPlus className="w-4 h-4" />
            Fast SKU Entry Grid
          </CardTitle>
          <div className="flex gap-2">
            {isCustomLoaded && (
              <Badge className="bg-purple-600 text-white font-bold tracking-widest uppercase text-[10px] flex items-center gap-1.5">
                <Hammer className="w-3 h-3"/> Custom Order Loaded
              </Badge>
            )}
            {isRepairLoaded && (
              <Badge className="bg-amber-600 text-white font-bold tracking-widest uppercase text-[10px] flex items-center gap-1.5">
                <Wrench className="w-3 h-3"/> Repair Ticket Loaded
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          
          <form onSubmit={handleAddDrafts} className={`flex flex-wrap md:flex-nowrap items-end gap-3 p-4 border-b ${formBgClass}`}>
            <div className="w-full md:w-20 space-y-1.5">
              <Label className="text-[10px] font-bold uppercase text-muted-foreground">Qty</Label>
              <Input type="number" min="1" required className="h-9 text-xs font-bold bg-white" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
            </div>
            <div className="w-full md:flex-1 space-y-1.5">
              <Label className="text-[10px] font-bold uppercase text-muted-foreground">Base SKU / Style *</Label>
              <Input required placeholder="e.g. RNG-101" className="h-9 text-xs bg-white" value={skuReference} onChange={(e) => setSkuReference(e.target.value)} />
            </div>
            <div className="w-full md:flex-1 space-y-1.5">
              <Label className="text-[10px] font-bold uppercase text-muted-foreground">Type</Label>
              <Input placeholder="e.g. Ring" className="h-9 text-xs bg-white" value={ornamentType} onChange={(e) => setOrnamentType(e.target.value)} />
            </div>
            <div className="w-full md:w-32 space-y-1.5">
              <Label className="text-[10px] font-bold uppercase text-muted-foreground">Exp. Gold (g)</Label>
              <Input type="number" step="0.001" placeholder="0.000" className="h-9 text-xs bg-white" value={expectedGold} onChange={(e) => setExpectedGold(e.target.value)} />
            </div>
            <div className="w-full md:w-32 space-y-1.5">
              <Label className="text-[10px] font-bold uppercase text-muted-foreground">Exp. Dia (ct)</Label>
              <Input type="number" step="0.001" placeholder="0.000" className="h-9 text-xs bg-white" value={expectedDiamond} onChange={(e) => setExpectedDiamond(e.target.value)} />
            </div>
            <Button type="submit" className={`w-full md:w-auto h-9 text-xs font-bold ${buttonClass}`}>
              <Plus className="w-4 h-4 mr-1" /> Add to Grid
            </Button>
          </form>

          {draftItems.length > 0 && (
            <div className="p-0 animate-in fade-in slide-in-from-top-2">
              <div className="max-h-[300px] overflow-y-auto">
                <Table>
                  <TableHeader className="bg-secondary/40 sticky top-0">
                    <TableRow>
                      <TableHead className="w-[40px]"></TableHead>
                      <TableHead className="text-[10px] font-bold uppercase text-muted-foreground">SKU / Style</TableHead>
                      <TableHead className="text-[10px] font-bold uppercase text-muted-foreground">Ornament Type</TableHead>
                      <TableHead className="text-[10px] font-bold uppercase text-muted-foreground">Exp. Gold (g)</TableHead>
                      <TableHead className="text-[10px] font-bold uppercase text-muted-foreground">Exp. Dia (ct)</TableHead>
                      <TableHead className="text-[10px] font-bold uppercase text-muted-foreground">Tags</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {draftItems.map((draft) => (
                      <TableRow key={draft.id} className={draft.is_repair ? "bg-amber-50/20" : draft.custom_order_id ? "bg-purple-50/20" : "bg-slate-50/50"}>
                        <TableCell className="p-2">
                          <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-red-500" onClick={() => removeDraftItem(draft.id)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </TableCell>
                        <TableCell className="p-2">
                          <Input className="h-8 text-xs font-semibold bg-white border-border/50" value={draft.sku_reference} onChange={(e) => updateDraftItem(draft.id, 'sku_reference', e.target.value)} />
                        </TableCell>
                        <TableCell className="p-2">
                          <Input className="h-8 text-xs bg-white border-border/50" value={draft.ornament_type} onChange={(e) => updateDraftItem(draft.id, 'ornament_type', e.target.value)} />
                        </TableCell>
                        <TableCell className="p-2">
                          <Input type="number" step="0.001" className="h-8 text-xs bg-white border-border/50" value={draft.expected_gold_weight_g} onChange={(e) => updateDraftItem(draft.id, 'expected_gold_weight_g', e.target.value)} />
                        </TableCell>
                        <TableCell className="p-2">
                          <Input type="number" step="0.001" className="h-8 text-xs bg-white border-border/50" value={draft.expected_diamond_weight_cts} onChange={(e) => updateDraftItem(draft.id, 'expected_diamond_weight_cts', e.target.value)} />
                        </TableCell>
                        <TableCell className="p-2">
                          <div className="flex gap-1">
                            {draft.custom_order_id && (
                              <Badge className="bg-purple-100 text-purple-700 text-[9px] uppercase tracking-widest border-purple-200">Custom</Badge>
                            )}
                            {draft.is_repair && (
                              <Badge className="bg-amber-100 text-amber-700 text-[9px] uppercase tracking-widest border-amber-200">Repair</Badge>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="p-4 bg-primary/5 border-t border-primary/10 flex justify-between items-center">
                <p className="text-xs font-medium text-primary flex items-center"><AlertCircle className="w-3.5 h-3.5 mr-1.5" /> {draftItems.length} uncommitted item(s) in grid.</p>
                <Button onClick={saveDraftsToDatabase} disabled={isSaving} className="h-9 text-xs font-bold shadow-md">
                  <Save className="w-4 h-4 mr-2" /> Commit {draftItems.length} Items to Job Bag
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 3. Database Saved Items */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Committed Job Bag SKUs</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground text-center py-4">Loading items...</p>
          ) : items.length === 0 ? (
            <div className="text-center py-10 border-2 border-dashed rounded-lg bg-muted/5">
              <p className="text-sm text-muted-foreground">No items in this job bag yet.</p>
              <p className="text-xs text-muted-foreground mt-1">Use the fast entry grid above to add SKUs.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-[10px] font-bold uppercase text-muted-foreground">SKU Reference</TableHead>
                  <TableHead className="text-[10px] font-bold uppercase text-muted-foreground">Type</TableHead>
                  <TableHead className="text-[10px] font-bold uppercase text-muted-foreground text-right">Exp Gold</TableHead>
                  <TableHead className="text-[10px] font-bold uppercase text-muted-foreground text-right">Exp Dia</TableHead>
                  <TableHead className="text-[10px] font-bold uppercase text-muted-foreground">Status / Tags</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item: any) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-bold text-xs">{item.sku_reference}</TableCell>
                    <TableCell className="text-xs">{item.ornament_type || '-'}</TableCell>
                    <TableCell className="text-xs text-right text-amber-600 font-medium">
                      {item.expected_gold_weight_g ? `${item.expected_gold_weight_g} g` : '-'}
                    </TableCell>
                    <TableCell className="text-xs text-right text-blue-600 font-medium">
                      {item.expected_diamond_weight_cts ? `${item.expected_diamond_weight_cts} cts` : '-'}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Badge variant={item.status === 'pending' ? 'outline' : 'secondary'} className="text-[10px] uppercase">
                          {item.status}
                        </Badge>
                        {item.custom_order_id && (
                          <Badge className="bg-purple-100 text-purple-700 text-[9px] uppercase tracking-widest border-purple-200">
                            Custom
                          </Badge>
                        )}
                        {item.is_repair && (
                          <Badge className="bg-amber-100 text-amber-700 text-[9px] uppercase tracking-widest border-amber-200">
                            Repair
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {item.status === 'pending' && (
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-red-500" onClick={() => deleteSavedItem(item.id, item.status)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}