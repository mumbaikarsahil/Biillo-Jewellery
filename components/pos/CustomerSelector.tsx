import React, { useState } from 'react'
import { Search, Plus, X, IndianRupee, Gem, Info } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabaseClient' 

interface CustomerSelectorProps {
  mode: string
  customers: any[]
  setCustomers: React.Dispatch<React.SetStateAction<any[]>>
  selectedCustomer: any
  setSelectedCustomer: (customer: any) => void
  appUser?: any 
  selectedLocation?: string
  subtotal?: number 
  // CHANGED: Added planId parameter to the callback
  onApplyWallet?: (type: 'credit' | 'kitty', availableAmount: number, planId?: string) => void 
}

export function CustomerSelector({ 
  mode, customers, setCustomers, selectedCustomer, setSelectedCustomer, appUser, selectedLocation, subtotal = 0, onApplyWallet 
}: CustomerSelectorProps) {
  
  const [searchCustomer, setSearchCustomer] = useState('')
  const [isAddCustomerOpen, setIsAddCustomerOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [newCustForm, setNewCustForm] = useState({ 
    full_name: '', phone: '', city: '', address: '', pan_no: '', birth_date: '' 
  })

  // Filter logic for the dropdown
  const filteredCustomers = searchCustomer.trim() === '' ? [] : customers.filter(c => 
    c.full_name.toLowerCase().includes(searchCustomer.toLowerCase()) || 
    c.phone.includes(searchCustomer)
  )

  const handleAddCustomer = async () => {
    if (!newCustForm.full_name || !newCustForm.phone) {
      return toast.error('Name and Phone are required.')
    }
    if (!selectedLocation || selectedLocation === 'ALL') {
      return toast.error('Please select a specific branch terminal first.')
    }

    setIsSaving(true)
    try {
      // Execute DB Insert
      const { data, error } = await supabase.from('customers').insert([{
        company_id: appUser?.company_id,
        warehouse_id: selectedLocation,
        full_name: newCustForm.full_name,
        phone: newCustForm.phone,
        city: newCustForm.city || null,
        address: newCustForm.address || null,
        pan_no: newCustForm.pan_no?.toUpperCase() || null,
        birth_date: newCustForm.birth_date || null
      }]).select().single()

      if (error) throw error

      // Update local state
      setCustomers(prev => [...prev, data])
      setSelectedCustomer(data)
      setIsAddCustomerOpen(false)
      setSearchCustomer('')
      setNewCustForm({ full_name: '', phone: '', city: '', address: '', pan_no: '', birth_date: '' })
      toast.success('New client registered successfully.')
    } catch (err: any) {
      toast.error(err.message || 'Failed to save customer.')
    } finally {
      setIsSaving(false)
    }
  }

  // --- UPDATED: SPECIFIC KITTY PLAN REDEMPTION HELPER ---
  const handleKittyRedemption = (plan: any) => {
    const monthlyAmt = Number(plan.plan_amount) || 0;
    const monthsPaid = Number(plan.months_paid) || 0;
    const totalMonths = Number(plan.total_months) || 12;
    
    // Base amount is what they actually paid
    let totalRedemptionValue = monthsPaid * monthlyAmt;
    
    // Add the Jeweler's Bonus ONLY if the plan is fully matured
    let bonusApplied = false;
    if (monthsPaid >= totalMonths) {
      totalRedemptionValue += monthlyAmt; 
      bonusApplied = true;
    }

    if (totalRedemptionValue <= 0) {
      return toast.error("No kitty funds available to redeem.");
    }

    if (subtotal < totalRedemptionValue) {
      toast.error(`Bill amount (₹${subtotal.toLocaleString()}) must be greater than Harvesting Value (₹${totalRedemptionValue.toLocaleString()}) to redeem.`);
      return;
    }

    if (bonusApplied) {
      toast.success("Maturity Bonus Applied!");
    } else {
      toast.info(`Early Redemption: Applied ${monthsPaid} months of paid value.`);
    }

    // NEW: Passing the specific plan.id back up to useCheckout
    onApplyWallet?.('kitty', totalRedemptionValue, plan.id);
  }

  // --- UPDATED: STORE CREDIT WITH 20% DEDUCTION ---
  const handleCreditRedemption = () => {
    const rawCredit = Number(selectedCustomer.store_credit_balance) || 0;
    if (rawCredit <= 0) return;

    // Apply the strict 20% processing/handling fee reduction
    const netUsableCredit = Math.floor(rawCredit * 0.80);
    const deduction = rawCredit - netUsableCredit;

    toast.info("Wallet Applied (Post-Handling Fee)", {
      description: `Original Wallet: ₹${rawCredit.toLocaleString()} | Handling Charge (-20%): ₹${deduction.toLocaleString()} | Usable Discount: ₹${netUsableCredit.toLocaleString()}`
    });

    onApplyWallet?.('credit', netUsableCredit);
  }

  // Check if they have ANY active plan to show the badge
  const hasActivePlan = selectedCustomer?.kitty_plans && selectedCustomer.kitty_plans.some((p: any) => p.status === 'active');

  return (
    <div className="space-y-1.5 relative">
      <Label className="text-xs font-semibold text-slate-700">
        {mode === 'challan' ? 'SIS Partner / Destination' : 'Customer Account'}
      </Label>
      
      {/* STATE A: Customer is Selected */}
      {selectedCustomer ? (
        <div className="flex flex-col bg-white border border-[#0078D7] p-2.5 rounded-sm shadow-sm transition-all relative overflow-hidden">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <div className="h-9 w-9 mt-0.5 rounded-sm bg-[#0078D7] text-white flex items-center justify-center font-bold text-sm uppercase shadow-inner shrink-0">
                {selectedCustomer.full_name.charAt(0)}
              </div>
              <div className="flex flex-col">
                <p className="text-sm font-bold text-slate-900 leading-none">{selectedCustomer.full_name}</p>
                <p className="text-[10px] font-mono text-slate-500 mt-1">{selectedCustomer.phone}</p>
                
                {/* NEW: Badge logic uses hasActivePlan */}
                {(selectedCustomer.customer_status === 'Kitty Member' || hasActivePlan) && (
                  <Badge className="bg-purple-50 text-purple-700 border-purple-200 text-[9px] px-1.5 py-0 h-4 rounded-sm flex items-center gap-1 font-bold mt-1.5 w-max">
                    <Gem className="w-2.5 h-2.5" /> Active Kitty Member
                  </Badge>
                )}
              </div>
            </div>
            <Button 
              size="icon" 
              variant="ghost" 
              className="h-6 w-6 rounded-sm text-slate-400 hover:text-red-500 hover:bg-red-50 shrink-0" 
              onClick={() => setSelectedCustomer(null)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* --- INTERACTIVE WALLET REDEMPTION BUTTONS --- */}
          {(Number(selectedCustomer.store_credit_balance) > 0 || hasActivePlan) && (
            <div className="flex flex-col gap-1.5 mt-3 pt-3 border-t border-slate-100 w-full">
              
              {/* 1. Kitty Plan Redeemers (Maps over all active plans) */}
              {selectedCustomer.kitty_plans?.filter((p: any) => p.status === 'active' && p.months_paid > 0).map((plan: any) => {
                const isMatured = plan.months_paid >= plan.total_months;
                const valueToDisplay = isMatured 
                  ? (plan.total_months * plan.plan_amount) + plan.plan_amount 
                  : plan.months_paid * plan.plan_amount;

                return (
                  <div 
                    key={plan.id}
                    onClick={() => handleKittyRedemption(plan)}
                    className="flex items-center justify-between w-full bg-purple-50 border border-purple-200 rounded-sm p-2 cursor-pointer hover:bg-purple-100 transition-colors group"
                    title="Redeem Harvesting Plan"
                  >
                    <div className="flex flex-col gap-0.5 text-purple-700">
                      <div className="flex items-center gap-1.5">
                        <Gem className="w-3.5 h-3.5" />
                        <span className="text-[10px] font-bold uppercase tracking-wider">{plan.plan_name}</span>
                      </div>
                      {!isMatured && (
                         <span className="text-[8px] font-semibold text-purple-500 flex items-center gap-1">
                           <Info className="w-2.5 h-2.5" /> Early Redemption ({plan.months_paid} Mths)
                         </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black text-purple-700 tabular-nums">
                        ₹{valueToDisplay.toLocaleString()}
                      </span>
                      <span className="bg-purple-600 text-white text-[9px] font-bold uppercase px-2 py-0.5 rounded-sm opacity-90 group-hover:opacity-100 group-hover:shadow-sm transition-all">Redeem</span>
                    </div>
                  </div>
                );
              })}

              {/* 2. Store Credit Redeemer */}
              {Number(selectedCustomer.store_credit_balance) > 0 && (
                <div 
                  onClick={handleCreditRedemption}
                  className="flex items-center justify-between w-full bg-emerald-50 border border-emerald-200 rounded-sm p-2 cursor-pointer hover:bg-emerald-100 transition-colors group"
                  title="Click to apply credit (Note: 20% processing fee applies)"
                >
                  <div className="flex flex-col gap-0.5 text-emerald-700">
                    <div className="flex items-center gap-1.5">
                      <IndianRupee className="w-3.5 h-3.5" />
                      <span className="text-[10px] font-bold uppercase tracking-wider">Wallet Credit</span>
                    </div>
                    <span className="text-[8px] font-semibold text-emerald-600 flex items-center gap-1">
                      <Info className="w-2.5 h-2.5" /> 20% Processing Fee Applies
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex flex-col items-end">
                      <span className="text-xs font-black text-emerald-700 tabular-nums leading-none">
                        ₹{Math.floor(Number(selectedCustomer.store_credit_balance) * 0.80).toLocaleString()}
                      </span>
                      <span className="text-[8px] text-emerald-500 line-through">₹{Number(selectedCustomer.store_credit_balance).toLocaleString()}</span>
                    </div>
                    <span className="bg-emerald-600 text-white text-[9px] font-bold uppercase px-2 py-0.5 rounded-sm opacity-90 group-hover:opacity-100 group-hover:shadow-sm transition-all">Redeem</span>
                  </div>
                </div>
              )}

            </div>
          )}
        </div>
      ) : (
        /* STATE B: No Customer Selected (Search Mode) */
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <Input 
              placeholder="Search phone or name..." 
              value={searchCustomer} 
              onChange={(e) => setSearchCustomer(e.target.value)} 
              className="h-9 pl-8 text-xs rounded-sm border-slate-300 bg-white focus-visible:ring-[#0078D7]" 
            />
          </div>
          <Button 
            variant="outline" 
            className="h-9 px-3 rounded-sm border-slate-300 bg-white hover:bg-slate-50 hover:text-[#0078D7]" 
            onClick={() => setIsAddCustomerOpen(true)}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* DROPDOWN RESULTS */}
      {searchCustomer && !selectedCustomer && (
        <div className="absolute top-full left-0 w-full bg-white border border-slate-300 shadow-lg z-50 max-h-[250px] overflow-y-auto rounded-sm mt-1 custom-scrollbar">
          {filteredCustomers.length > 0 ? (
            filteredCustomers.map(c => {
              const cHasActivePlan = c.kitty_plans && c.kitty_plans.some((p: any) => p.status === 'active');
              
              return (
                <div 
                  key={c.id} 
                  className="p-2.5 border-b border-slate-100 hover:bg-slate-50 cursor-pointer flex justify-between items-center transition-colors" 
                  onClick={() => { setSelectedCustomer(c); setSearchCustomer(''); }}
                >
                  <div className="flex flex-col">
                    <span className="font-semibold text-xs text-slate-700">{c.full_name}</span>
                    <div className="flex gap-1 mt-0.5">
                      <span className="text-[10px] font-mono text-slate-500">{c.phone}</span>
                      {Number(c.store_credit_balance) > 0 && <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-1 rounded-sm ml-1">Credits</span>}
                      {(c.customer_status === 'Kitty Member' || cHasActivePlan) && <span className="text-[9px] font-bold text-purple-600 bg-purple-50 px-1 rounded-sm ml-0.5">Kitty</span>}
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="p-3 text-center text-xs text-slate-500">No matching records found.</div>
          )}
          <div 
            className="p-2.5 text-center text-xs font-bold text-[#0078D7] cursor-pointer hover:bg-blue-50 bg-slate-50 border-t border-slate-100 transition-colors" 
            onClick={() => setIsAddCustomerOpen(true)}
          >
            + Create New Customer Profile
          </div>
        </div>
      )}

      {/* ADD NEW CUSTOMER MODAL */}
      <Dialog open={isAddCustomerOpen} onOpenChange={setIsAddCustomerOpen}>
        <DialogContent className="sm:max-w-[450px] border border-slate-300 shadow-xl p-0 rounded-sm overflow-hidden bg-white w-[95vw] sm:w-full">
          <DialogHeader className="bg-slate-100 p-4 border-b border-slate-200">
            <DialogTitle className="text-base font-semibold text-slate-800">Add New Customer</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 sm:p-5 max-h-[60vh] overflow-y-auto custom-scrollbar">
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs font-semibold text-slate-700">Full Name *</Label>
              <Input className="h-9 rounded-sm border-slate-300" value={newCustForm.full_name} onChange={(e) => setNewCustForm({...newCustForm, full_name: e.target.value})} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Phone *</Label>
              <Input className="h-9 rounded-sm border-slate-300" value={newCustForm.phone} onChange={(e) => setNewCustForm({...newCustForm, phone: e.target.value})} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Date of Birth</Label>
              <Input type="date" className="h-9 rounded-sm border-slate-300" value={newCustForm.birth_date} onChange={(e) => setNewCustForm({...newCustForm, birth_date: e.target.value})} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs font-semibold text-slate-700">Address</Label>
              <Input className="h-9 rounded-sm border-slate-300" value={newCustForm.address} onChange={(e) => setNewCustForm({...newCustForm, address: e.target.value})} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">City</Label>
              <Input className="h-9 rounded-sm border-slate-300" value={newCustForm.city} onChange={(e) => setNewCustForm({...newCustForm, city: e.target.value})} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">PAN Number</Label>
              <Input className="h-9 rounded-sm border-slate-300 uppercase" value={newCustForm.pan_no} onChange={(e) => setNewCustForm({...newCustForm, pan_no: e.target.value})} />
            </div>
          </div>
          <DialogFooter className="p-4 bg-slate-50 border-t border-slate-200">
            <Button variant="ghost" className="rounded-sm text-sm w-full sm:w-auto" onClick={() => setIsAddCustomerOpen(false)}>Cancel</Button>
            <Button 
              onClick={handleAddCustomer} 
              disabled={isSaving}
              className="rounded-sm text-sm bg-[#0078D7] hover:bg-[#005A9E] text-white px-6 w-full sm:w-auto mt-2 sm:mt-0"
            >
              {isSaving ? 'Saving...' : 'Save Customer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}