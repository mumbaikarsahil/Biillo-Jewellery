'use client'

import React, { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useStoreLocation } from '@/hooks/useStoreLocation'
import { supabase } from '@/lib/supabaseClient'
import { toast } from 'sonner'
import { Loader2, Flame, Wrench, PackagePlus, CheckCircle2, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { POSHeader } from '@/components/pos/POSHeader'

export default function TriagePage() {
  const { appUser, loading: authLoading } = useAuth()
  const { isHQ, isLocked, selectedLocation, setSelectedLocation } = useStoreLocation()
  
  const [items, setItems] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [processingId, setProcessingId] = useState<string | null>(null)

  const fetchTriageItems = async () => {
    if (!appUser?.company_id || !selectedLocation) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('inventory_items')
        // ✨ FIX: Updated the select query to use the exact schema column names
        .select(`
          id, sku, barcode, item_category, metal_type, purity_karat, 
          gross_weight_g, net_weight_g, cost_price, acquisition_method, created_at,
          buybacks ( reference_invoice_number ),
          invoices ( invoice_number )
        `)
        .eq('company_id', appUser.company_id)
        .eq('warehouse_id', selectedLocation)
        .eq('is_for_sale', false)
        .in('status', ['in_vault', 'received_at_ho']) // Items waiting for a decision
        .order('created_at', { ascending: false });

      if (error) throw error;
      setItems(data || []);
    } catch (err: any) {
      toast.error(err.message || "Failed to load triage items.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    fetchTriageItems();
  }, [appUser?.company_id, selectedLocation])

  // ==========================================
  // ACTION 1: RESTOCK AS FRESH INVENTORY
  // ==========================================
  const handleRestock = async (item: any) => {
    if (!confirm(`Are you sure you want to move ${item.sku} to the live sales floor?`)) return;
    setProcessingId(item.id);
    try {
      const { error } = await supabase
        .from('inventory_items')
        .update({ 
          is_for_sale: true, 
          status: 'in_stock',
          acquisition_method: 'restocked' // Changes history so we know it was repurposed
        })
        .eq('id', item.id);

      if (error) throw error;
      toast.success(`${item.sku} is now live for sale!`);
      setItems(items.filter(i => i.id !== item.id));
    } catch (err: any) {
      toast.error("Failed to restock item.");
    } finally {
      setProcessingId(null);
    }
  }

  // ==========================================
  // ACTION 2: SEND TO REPAIR (JOB BAG)
  // ==========================================
  const handleSendToRepair = async (item: any) => {
    setProcessingId(item.id);
    try {
      const { error } = await supabase
        .from('inventory_items')
        .update({ status: 'pending_repair' })
        .eq('id', item.id);

      if (error) throw error;
      toast.success(`${item.sku} moved to Repair Queue.`);
      setItems(items.filter(i => i.id !== item.id));
    } catch (err: any) {
      toast.error("Failed to update status.");
    } finally {
      setProcessingId(null);
    }
  }

  // ==========================================
  // ACTION 3: SEND FOR MELTING
  // ==========================================
  const handleSendToMelting = async (item: any) => {
    // ✨ FIX: Updated variables in the prompt to match new schema keys
    if (!confirm(`Mark ${item.gross_weight_g}g of ${item.purity_karat} for melting?`)) return;
    setProcessingId(item.id);
    try {
      const { error } = await supabase
        .from('inventory_items')
        .update({ status: 'pending_melting' })
        .eq('id', item.id);

      if (error) throw error;
      toast.success(`${item.sku} added to Melting Queue.`);
      setItems(items.filter(i => i.id !== item.id));
    } catch (err: any) {
      toast.error("Failed to update status.");
    } finally {
      setProcessingId(null);
    }
  }

  if (authLoading || !appUser) {
    return <div className="h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <POSHeader 
        isHQ={isHQ} isLocked={isLocked} 
        selectedLocation={selectedLocation} setSelectedLocation={setSelectedLocation} 
        onWipeSession={() => {}} 
        onWarehousesLoaded={() => {}} 
      />

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Old Gold & Returns Triage</h1>
            <p className="text-sm text-slate-500 font-medium mt-1">Review and process buybacks and exchanged items.</p>
          </div>
          <Button onClick={fetchTriageItems} variant="outline" className="bg-white">
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
        </div>

        {isLoading ? (
          <div className="h-64 flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
          </div>
        ) : items.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center flex flex-col items-center shadow-sm">
            <div className="w-16 h-16 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mb-4">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">Vault is Clear</h3>
            <p className="text-slate-500 text-sm mt-1">There are no returned or exchanged items waiting for triage at this location.</p>
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase font-bold text-slate-500 tracking-wider">
                  <tr>
                    <th className="px-6 py-4">Item ID & Source</th>
                    <th className="px-6 py-4">Specs</th>
                    <th className="px-6 py-4">Weight</th>
                    <th className="px-6 py-4">Financials</th>
                    <th className="px-6 py-4 text-center">Triage Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((item) => {
                    const isExchange = item.acquisition_method === 'exchange';
                    const sourceRef = isExchange ? item.invoices?.invoice_number : item.buybacks?.reference_invoice_number;

                    return (
                      <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="font-bold text-slate-900">{item.sku}</div>
                          <div className="flex items-center gap-1.5 mt-1">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider ${isExchange ? 'bg-purple-100 text-purple-700' : 'bg-rose-100 text-rose-700'}`}>
                              {isExchange ? 'Exchange' : 'Buyback'}
                            </span>
                            {sourceRef && <span className="text-[10px] font-mono text-slate-500 border border-slate-200 px-1.5 py-0.5 rounded bg-white">Ref: {sourceRef}</span>}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="font-semibold text-slate-800">{item.item_category}</div>
                          {/* ✨ FIX: Updated to purity_karat */}
                          <div className="text-xs text-slate-500 mt-0.5">{item.purity_karat} {item.metal_type}</div>
                        </td>
                        <td className="px-6 py-4">
                          {/* ✨ FIX: Updated to gross_weight_g */}
                          <div className="font-mono font-semibold text-slate-800">{Number(item.gross_weight_g).toFixed(3)}g</div>
                          <div className="text-[10px] text-slate-500 uppercase tracking-widest mt-0.5">Gross Wt</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="font-bold text-slate-900">₹{Number(item.cost_price).toLocaleString()}</div>
                          <div className="text-[10px] text-slate-500 uppercase tracking-widest mt-0.5">Acquisition Cost</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-center gap-2">
                            
                            {/* Action 1: Restock */}
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="h-8 px-3 border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300 text-emerald-600 bg-emerald-50/50"
                              onClick={() => handleRestock(item)}
                              disabled={processingId === item.id}
                            >
                              <PackagePlus className="w-4 h-4 mr-1.5" /> Live Floor
                            </Button>

                            {/* Action 2: Repair */}
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="h-8 px-3 border-amber-200 hover:bg-amber-50 hover:text-amber-700 hover:border-amber-300 text-amber-600 bg-amber-50/50"
                              onClick={() => handleSendToRepair(item)}
                              disabled={processingId === item.id}
                            >
                              <Wrench className="w-4 h-4 mr-1.5" /> Repair
                            </Button>

                            {/* Action 3: Melt */}
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="h-8 px-3 border-rose-200 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-300 text-rose-600 bg-rose-50/50"
                              onClick={() => handleSendToMelting(item)}
                              disabled={processingId === item.id}
                            >
                              <Flame className="w-4 h-4 mr-1.5" /> Melt
                            </Button>

                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}