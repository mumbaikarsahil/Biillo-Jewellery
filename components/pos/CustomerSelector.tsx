import React, { useState } from 'react'
import { Search, Plus, X, IndianRupee, Star, Gem } from 'lucide-react'
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
}

export function CustomerSelector({ 
  mode, customers, setCustomers, selectedCustomer, setSelectedCustomer, appUser, selectedLocation 
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

  return (
    <div className="space-y-1.5 relative">
      <Label className="text-xs font-semibold text-slate-700">
        {mode === 'challan' ? 'SIS Partner / Destination' : 'Customer Account'}
      </Label>
      
      {/* STATE A: Customer is Selected */}
      {selectedCustomer ? (
        <div className="flex items-start justify-between bg-white border border-[#0078D7] p-2.5 rounded-sm shadow-sm transition-all">
          <div className="flex items-start gap-3">
            <div className="h-9 w-9 mt-0.5 rounded-sm bg-[#0078D7] text-white flex items-center justify-center font-bold text-sm uppercase shadow-inner shrink-0">
              {selectedCustomer.full_name.charAt(0)}
            </div>
            <div className="flex flex-col">
              <p className="text-sm font-bold text-slate-900 leading-none">{selectedCustomer.full_name}</p>
              <p className="text-[10px] font-mono text-slate-500 mt-1">{selectedCustomer.phone}</p>
              
              {/* --- NEW: FINANCIAL & LOYALTY BADGES --- */}
              <div className="flex flex-wrap gap-1 mt-2">
                {Number(selectedCustomer.store_credit_balance) > 0 && (
                  <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[9px] px-1.5 py-0 h-4 rounded-sm flex items-center gap-1 font-bold">
                    <IndianRupee className="w-2.5 h-2.5" /> 
                    Credit: ₹{Number(selectedCustomer.store_credit_balance).toLocaleString()}
                  </Badge>
                )}
                {Number(selectedCustomer.pavitram_points) > 0 && (
                  <Badge className="bg-amber-50 text-amber-700 border-amber-200 text-[9px] px-1.5 py-0 h-4 rounded-sm flex items-center gap-1 font-bold">
                    <Star className="w-2.5 h-2.5" /> 
                    {selectedCustomer.pavitram_points} Pts
                  </Badge>
                )}
                {selectedCustomer.customer_status === 'Kitty Member' && (
                  <Badge className="bg-purple-50 text-purple-700 border-purple-200 text-[9px] px-1.5 py-0 h-4 rounded-sm flex items-center gap-1 font-bold">
                    <Gem className="w-2.5 h-2.5" /> 
                    Active Kitty
                  </Badge>
                )}
              </div>
              {/* -------------------------------------- */}
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
            filteredCustomers.map(c => (
              <div 
                key={c.id} 
                className="p-2.5 border-b border-slate-100 hover:bg-slate-50 cursor-pointer flex justify-between items-center transition-colors" 
                onClick={() => { setSelectedCustomer(c); setSearchCustomer(''); }}
              >
                <div className="flex flex-col">
                  <span className="font-semibold text-xs text-slate-700">{c.full_name}</span>
                  {/* --- NEW: COMPACT SEARCH RESULT BADGES --- */}
                  <div className="flex gap-1 mt-0.5">
                    <span className="text-[10px] font-mono text-slate-500">{c.phone}</span>
                    {Number(c.store_credit_balance) > 0 && <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-1 rounded-sm ml-1">₹Credit</span>}
                    {Number(c.pavitram_points) > 0 && <span className="text-[9px] font-bold text-amber-600 bg-amber-50 px-1 rounded-sm ml-0.5">Pts</span>}
                  </div>
                </div>
              </div>
            ))
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