"use client"

import React, { useState } from 'react'
import { Camera, Scale, Sparkles, AlertCircle, Calendar, IndianRupee, FileText, Loader2, X, Search, Wrench, Store, CheckCircle2 } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface RepairIntakeProps {
  details: any;
  setDetails: (details: any) => void;
  currentLocationId?: string;
  onAddToBill?: (finalItemData: any) => void;
}

export function RepairIntakeForm({ details, setDetails, currentLocationId, onAddToBill }: RepairIntakeProps) {
  const [activeTab, setActiveTab] = useState<'new' | 'pickup'>('new')
  const [isUploading, setIsUploading] = useState(false)

  // Pickup Tab State
  const [searchQuery, setSearchQuery] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [searchError, setSearchError] = useState('')
  const [foundOrder, setFoundOrder] = useState<any>(null)

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setDetails({ ...details, [e.target.name]: e.target.value })
  }

  // Real Supabase Cloud Upload Handler
  const handlePhotoCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `repair_${Date.now()}.${fileExt}`

      const { data, error } = await supabase.storage.from('repairs').upload(fileName, file)
      if (error) throw error

      const { data: { publicUrl } } = supabase.storage.from('repairs').getPublicUrl(fileName)

      setDetails({ ...details, conditionPhotoUrl: publicUrl })
      toast.success("Photo uploaded securely to cloud.")
    } catch (err: any) {
      console.error('Upload Error:', err)
      toast.error("Upload failed. Showing local preview instead. (Create a 'repairs' bucket in Supabase).")
      const localUrl = URL.createObjectURL(file)
      setDetails({ ...details, conditionPhotoUrl: localUrl })
    } finally {
      setIsUploading(false)
    }
  }

  const handleSearchOrder = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!searchQuery.trim()) return

    setIsSearching(true)
    setSearchError('')
    setFoundOrder(null)

    try {
      const { data: orderData, error: orderErr } = await supabase
        .from('repair_tickets')
        .select('*')
        .eq('ticket_number', searchQuery.trim())
        .single()

      if (orderErr || !orderData) {
        setSearchError('Repair ticket not found. Please check the ticket number.')
        setIsSearching(false)
        return
      }

      setFoundOrder(orderData)
    } catch (err: any) {
      setSearchError('An error occurred while fetching the repair ticket.')
    } finally {
      setIsSearching(false)
    }
  }

  return (
    <div className="flex-1 p-3 sm:p-4 custom-scrollbar flex flex-col h-full bg-slate-50/50">
      <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 max-w-4xl mx-auto shadow-sm w-full">
        
        {/* HEADER & TAB SWITCHER */}
        <div className="border-b border-slate-100 pb-3 mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-[#E3008C] flex items-center gap-1.5">
              <Wrench className="h-4 w-4" /> Repair Center & Pickups
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">Log new repairs or process final billing for completed items.</p>
          </div>

          <div className="flex bg-slate-100 p-1 rounded-lg self-start sm:self-auto shrink-0 border border-slate-200">
            <button 
              className={cn("px-3 py-1 text-xs font-bold rounded-md transition-all", activeTab === 'new' ? "bg-white text-[#E3008C] shadow-sm" : "text-slate-500 hover:text-slate-700")}
              onClick={() => setActiveTab('new')}
            >
              New Repair Intake
            </button>
            <button 
              className={cn("px-3 py-1 text-xs font-bold rounded-md transition-all", activeTab === 'pickup' ? "bg-white text-[#E3008C] shadow-sm" : "text-slate-500 hover:text-slate-700")}
              onClick={() => setActiveTab('pickup')}
            >
              Pickup / Final Bill
            </button>
          </div>
        </div>

        {/* TAB 1: NEW REPAIR INTAKE */}
        {activeTab === 'new' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in duration-300">
            
            {/* LEFT COLUMN: Physical Item Details */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-1 pb-1.5 border-b border-slate-100">
                <div className="h-6 w-6 rounded-md bg-slate-100 flex items-center justify-center text-slate-600">
                  <FileText className="h-3.5 w-3.5" />
                </div>
                <h3 className="text-xs font-bold uppercase tracking-widest text-slate-700">Item Specifications</h3>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700 uppercase tracking-wide">Description *</Label>
                <Input name="itemDescription" value={details?.itemDescription || ''} onChange={handleInputChange} placeholder="e.g. Gold chain with broken lock" className="h-9 text-sm rounded-lg border-slate-300 focus-visible:ring-[#E3008C]" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700 uppercase flex items-center gap-1.5 tracking-wide"><Scale className="h-3.5 w-3.5" /> Gross Wt (g)</Label>
                  <Input name="grossWeight" type="number" step="0.001" value={details?.grossWeight || ''} onChange={handleInputChange} placeholder="0.000" className="h-9 text-sm rounded-lg border-slate-300 focus-visible:ring-[#E3008C]" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700 uppercase flex items-center gap-1.5 tracking-wide"><Sparkles className="h-3.5 w-3.5" /> Purity</Label>
                  <Select value={details?.purity || '22K'} onValueChange={(val) => setDetails({ ...details, purity: val })}>
                    <SelectTrigger className="h-9 text-sm rounded-lg border-slate-300 focus:ring-[#E3008C]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-slate-200">
                      <SelectItem value="24K">24K Gold</SelectItem>
                      <SelectItem value="22K">22K Gold</SelectItem>
                      <SelectItem value="18K">18K Gold</SelectItem>
                      <SelectItem value="14K">14K Gold</SelectItem>
                      <SelectItem value="925">925 Silver</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700 uppercase flex items-center gap-1.5 tracking-wide"><AlertCircle className="h-3.5 w-3.5" /> Defect Notes / Instructions</Label>
                <Textarea name="defectNotes" value={details?.defectNotes || ''} onChange={handleInputChange} placeholder="Specific instructions for the factory..." className="min-h-[80px] text-sm rounded-lg border-slate-300 resize-none focus-visible:ring-[#E3008C]" />
              </div>
            </div>

            {/* RIGHT COLUMN: Financials & Media */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-1 pb-1.5 border-b border-slate-100">
                <div className="h-6 w-6 rounded-md bg-slate-100 flex items-center justify-center text-slate-600">
                  <IndianRupee className="h-3.5 w-3.5" />
                </div>
                <h3 className="text-xs font-bold uppercase tracking-widest text-slate-700">Financials & Media</h3>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700 uppercase tracking-wide">Estimated Cost</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">₹</span>
                    <Input name="estimatedCost" type="number" value={details?.estimatedCost || ''} onChange={handleInputChange} placeholder="0" className="h-9 text-sm pl-7 rounded-lg border-slate-300 focus-visible:ring-[#E3008C]" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-[#E3008C] uppercase tracking-wide">Advance Paid</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">₹</span>
                    <Input name="advancePaid" type="number" value={details?.advancePaid || ''} onChange={handleInputChange} placeholder="0" className="h-9 text-sm pl-7 rounded-lg border-[#E3008C] ring-1 ring-[#E3008C]/20 focus-visible:ring-[#E3008C] font-bold text-[#E3008C]" />
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700 uppercase flex items-center gap-1.5 tracking-wide"><Calendar className="h-3.5 w-3.5" /> Expected Delivery</Label>
                <Input name="expectedDelivery" type="date" value={details?.expectedDelivery || ''} onChange={handleInputChange} className="h-9 text-sm rounded-lg border-slate-300 focus-visible:ring-[#E3008C]" />
              </div>

              {/* Photo Evidence */}
              <div className="space-y-1.5 pt-1">
                <Label className="text-xs font-bold text-slate-700 uppercase tracking-wide">Condition Photo (Optional)</Label>
                
                {isUploading ? (
                  <div className="w-full h-24 rounded-xl border-2 border-slate-200 bg-slate-50 flex flex-col items-center justify-center gap-2">
                    <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
                    <span className="text-[10px] font-semibold text-slate-500">Uploading...</span>
                  </div>
                ) : details?.conditionPhotoUrl ? (
                  <div className="relative w-full h-24 rounded-xl border border-slate-200 overflow-hidden group">
                    <img src={details.conditionPhotoUrl} alt="Item Condition" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Button type="button" variant="destructive" size="sm" onClick={() => setDetails({...details, conditionPhotoUrl: null})} className="h-7 text-[10px] rounded-lg">
                        <X className="w-3 h-3 mr-1"/> Remove
                      </Button>
                    </div>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-slate-300 rounded-xl bg-slate-50/50 hover:bg-slate-100 hover:border-slate-400 transition-all cursor-pointer group">
                    <div className="flex flex-col items-center justify-center pt-3 pb-3">
                      <div className="h-8 w-8 bg-white shadow-sm text-slate-400 group-hover:text-slate-600 rounded-full flex items-center justify-center mb-1.5 transition-colors border border-slate-200">
                        <Camera className="h-4 w-4" />
                      </div>
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Tap to capture</p>
                    </div>
                    <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhotoCapture} />
                  </label>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: PICKUP & FINAL BILLING */}
        {activeTab === 'pickup' && (
          <div className="space-y-4 animate-in fade-in duration-300 max-w-2xl mx-auto">
            <form onSubmit={handleSearchOrder} className="flex gap-2.5">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input 
                  placeholder="Scan or enter Repair Ticket No. (e.g. REP-8371)"
                  className="pl-9 h-10 border-slate-300 font-mono text-sm focus-visible:ring-[#E3008C]"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Button type="submit" disabled={isSearching} className="h-10 px-5 bg-[#E3008C] hover:bg-[#b80072] text-white font-bold text-xs">
                {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Fetch Ticket'}
              </Button>
            </form>

            {searchError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2 text-red-700">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <p className="text-xs font-medium">{searchError}</p>
              </div>
            )}

            {foundOrder && (
              <div className="bg-slate-50 border border-slate-200 rounded-xl overflow-hidden">
                <div className="p-3 border-b border-slate-200 bg-white flex justify-between items-start">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 font-mono">{foundOrder.ticket_number}</h3>
                    <p className="text-[10px] text-slate-500 font-medium mt-0.5 uppercase tracking-widest">{foundOrder.item_description}</p>
                  </div>
                  {foundOrder.status === 'fixed_ready_for_dispatch' || foundOrder.status === 'delivered' ? (
                    <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-[10px] py-0">Ready for Pickup</Badge>
                  ) : (
                    <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-[10px] py-0">In Repair</Badge>
                  )}
                </div>

                <div className="p-4 space-y-3">
                  {foundOrder.status !== 'fixed_ready_for_dispatch' && foundOrder.status !== 'delivered' ? (
                    <div className="text-center py-4">
                      <Wrench className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                      <p className="text-xs font-semibold text-slate-700">Item is still being repaired.</p>
                      <p className="text-[10px] text-slate-500 mt-1">Final billing cannot be processed until the factory marks it as ready.</p>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-3 p-2.5 rounded-lg border bg-white border-slate-200">
                        <Store className="h-4 w-4 text-slate-400" />
                        <div className="flex-1">
                          <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Current Location</p>
                          <p className="text-xs font-semibold text-slate-900">
                            {foundOrder.current_warehouse_id === currentLocationId ? 'In Store (Ready for Pickup)' : 'In Transit / At Different Branch'}
                          </p>
                        </div>
                        {foundOrder.current_warehouse_id === currentLocationId ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                        ) : (
                          <AlertCircle className="h-4 w-4 text-amber-500" />
                        )}
                      </div>

                      <div className="bg-white rounded-lg border border-slate-200 p-3 space-y-2">
                        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-1.5 mb-1.5">Final Settlement</h4>
                        
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-slate-600 font-medium">Service Billable (Actual Cost)</span>
                          <span className="font-semibold text-slate-900">₹{(foundOrder.actual_cost || 0).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-slate-600 font-medium">Estimated GST (3%)</span>
                          <span className="font-semibold text-slate-900">₹{((foundOrder.actual_cost || 0) * 0.03).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center text-xs text-emerald-600 font-medium">
                          <span>Advance Paid</span>
                          <span>- ₹{(foundOrder.advance_paid || 0).toLocaleString()}</span>
                        </div>
                        
                        <div className="border-t border-slate-200 pt-2 mt-2 flex justify-between items-center">
                          <span className="text-xs font-bold text-[#E3008C]">Balance Payable</span>
                          <span className="text-base font-black text-[#E3008C]">
                            ₹{(((foundOrder.actual_cost || 0) * 1.03) - (foundOrder.advance_paid || 0)).toLocaleString()}
                          </span>
                        </div>
                      </div>

                      <Button 
                        disabled={foundOrder.current_warehouse_id !== currentLocationId}
                        className="w-full h-10 bg-[#E3008C] hover:bg-[#b80072] text-white font-bold text-xs shadow-sm mt-1"
                        onClick={() => {
                          if (onAddToBill) {
                            onAddToBill({
                              inventory_id: foundOrder.id, // Pseudo ID for the cart
                              barcode: foundOrder.ticket_number,
                              mrp: foundOrder.actual_cost || 0,
                              advance_paid: foundOrder.advance_paid || 0,
                              repair_ticket_id: foundOrder.id,
                              item_category: 'Repair Service',
                              net_weight_g: foundOrder.issued_gold_g || 0,
                              total_stone_weight_cts: foundOrder.issued_diamond_cts || 0,
                            })
                          }
                        }}
                      >
                        <IndianRupee className="h-3.5 w-3.5 mr-1.5" />
                        Process Final Invoice
                      </Button>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  )
}