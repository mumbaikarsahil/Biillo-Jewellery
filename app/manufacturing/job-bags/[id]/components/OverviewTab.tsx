'use client'

import { useState, useEffect } from 'react'
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
import { Trash2, Plus, Save, ListPlus, AlertCircle } from 'lucide-react'

interface Props {
  job: JobBag
}

// Temporary type for the staging grid
type DraftItem = {
  id: string // temporary internal id
  sku_reference: string
  ornament_type: string
  expected_gold_weight_g: string
  expected_diamond_weight_cts: string
}

export default function OverviewTab({ job }: Props) {
  const [items, setItems] = useState<JobBagItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const { toast } = useToast()

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
      // Auto-sequence the SKU if creating multiples (e.g., R-101-01, R-101-02)
      const suffix = qty > 1 ? `-${(i + 1).toString().padStart(2, '0')}` : ''
      
      newDrafts.push({
        id: Math.random().toString(36).substring(7), // Random temp ID
        sku_reference: `${skuReference}${suffix}`,
        ornament_type: ornamentType,
        expected_gold_weight_g: expectedGold,
        expected_diamond_weight_cts: expectedDiamond
      })
    }

    setDraftItems([...draftItems, ...newDrafts])
    
    // Reset only the SKU and Quantity to allow fast repetitive entry for the same product type
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
        status: 'pending'
      }))

      const { error } = await supabase.from('job_bag_items').insert(payload)
      if (error) throw error

      toast({ title: "Success", description: `Added ${draftItems.length} items to job bag.` })
      setDraftItems([])
      fetchItems()
    } catch (error: any) {
      toast({ title: "Database Error", description: error.message, variant: "destructive" })
    } finally {
      setIsSaving(false)
    }
  }

  // --- 3. DELETE SAVED ITEM (If mistakes were made) ---
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
      <Card className="border-primary/20 shadow-sm overflow-hidden">
        <CardHeader className="bg-primary/5 py-4 border-b border-primary/10">
          <CardTitle className="text-sm flex items-center gap-2">
            <ListPlus className="w-4 h-4 text-primary" />
            Fast SKU Entry Grid
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          
          {/* Quick Add Form Row */}
          <form onSubmit={handleAddDrafts} className="flex flex-wrap md:flex-nowrap items-end gap-3 p-4 bg-muted/10 border-b">
            <div className="w-full md:w-20 space-y-1.5">
              <Label className="text-[10px] font-bold uppercase text-muted-foreground">Qty</Label>
              <Input type="number" min="1" required className="h-9 text-xs font-bold" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
            </div>
            <div className="w-full md:flex-1 space-y-1.5">
              <Label className="text-[10px] font-bold uppercase text-muted-foreground">Base SKU / Style *</Label>
              <Input required placeholder="e.g. RNG-101" className="h-9 text-xs" value={skuReference} onChange={(e) => setSkuReference(e.target.value)} />
            </div>
            <div className="w-full md:flex-1 space-y-1.5">
              <Label className="text-[10px] font-bold uppercase text-muted-foreground">Type</Label>
              <Input placeholder="e.g. Ring" className="h-9 text-xs" value={ornamentType} onChange={(e) => setOrnamentType(e.target.value)} />
            </div>
            <div className="w-full md:w-32 space-y-1.5">
              <Label className="text-[10px] font-bold uppercase text-muted-foreground">Exp. Gold (g)</Label>
              <Input type="number" step="0.001" placeholder="0.000" className="h-9 text-xs" value={expectedGold} onChange={(e) => setExpectedGold(e.target.value)} />
            </div>
            <div className="w-full md:w-32 space-y-1.5">
              <Label className="text-[10px] font-bold uppercase text-muted-foreground">Exp. Dia (ct)</Label>
              <Input type="number" step="0.001" placeholder="0.000" className="h-9 text-xs" value={expectedDiamond} onChange={(e) => setExpectedDiamond(e.target.value)} />
            </div>
            <Button type="submit" className="w-full md:w-auto h-9 text-xs font-bold">
              <Plus className="w-4 h-4 mr-1" /> Add to Grid
            </Button>
          </form>

          {/* Draft Items Grid */}
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
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {draftItems.map((draft) => (
                      <TableRow key={draft.id} className="bg-amber-50/10">
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
                  <TableHead className="text-[10px] font-bold uppercase text-muted-foreground text-right">Expected Gold</TableHead>
                  <TableHead className="text-[10px] font-bold uppercase text-muted-foreground text-right">Expected Diamond</TableHead>
                  <TableHead className="text-[10px] font-bold uppercase text-muted-foreground">Status</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-bold text-xs">{item.sku_reference}</TableCell>
                    <TableCell className="text-xs">{item.ornament_type || '-'}</TableCell>
                    <TableCell className="text-xs text-right text-amber-600 font-medium">{item.expected_gold_weight_g ? `${item.expected_gold_weight_g} g` : '-'}</TableCell>
                    <TableCell className="text-xs text-right text-blue-600 font-medium">{item.expected_diamond_weight_cts ? `${item.expected_diamond_weight_cts} cts` : '-'}</TableCell>
                    <TableCell>
                      <Badge variant={item.status === 'pending' ? 'outline' : 'secondary'} className="text-[10px] uppercase">
                        {item.status}
                      </Badge>
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