import React, { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { Building, Trash2, CalendarDays, UserCircle } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabaseClient'

interface POSHeaderProps {
  isHQ: boolean
  isLocked: boolean
  selectedLocation: string
  setSelectedLocation: (val: string) => void
  onWipeSession: () => void
  onWarehousesLoaded?: (warehouses: any[]) => void
  
  isAdmin?: boolean
  userRole?: string 
  billingDate?: string
  setBillingDate?: (date: string) => void
  
  // NEW PROPS FOR BILLED BY
  billedBy?: string
  setBilledBy?: (userId: string) => void
}

export function POSHeader({ 
  isHQ, 
  isLocked, 
  selectedLocation, 
  setSelectedLocation, 
  onWipeSession, 
  onWarehousesLoaded,
  isAdmin,
  userRole,
  billingDate,
  setBillingDate,
  billedBy,
  setBilledBy
}: POSHeaderProps) {
  const { appUser } = useAuth()
  
  const [warehouses, setWarehouses] = useState<{
    id: string, 
    name: string, 
    address?: string, 
    contact_number?: string, 
    gstin?: string
    exchange_policy_text?: string,  // ✨ ADDED
    invoice_banner_url?: string     // ✨ ADDED
  }[]>([])

  const [staffMembers, setStaffMembers] = useState<{ id: string, full_name: string }[]>([])

  // ✨ Define explicit permissions for who can change the "Billed By" user
  const canChangeBilledBy = isAdmin || isHQ || ['owner', 'manager', 'operations_manager', 'branch_manager'].includes(userRole || '')

  useEffect(() => {
    const fetchWarehouses = async () => {
      if (!appUser?.company_id) return
      try {
        const { data, error } = await supabase
          .from('warehouses')
          // ✨ FIX: Added the new columns to the select query
          .select('id, name, address, contact_number, gstin, exchange_policy_text, invoice_banner_url')
          .eq('company_id', appUser.company_id)
          .eq('is_active', true)
          .order('name')
        
        if (error) throw error
        
        if (data) {
          setWarehouses(data)
          if (onWarehousesLoaded) onWarehousesLoaded(data)
        }

      } catch (err) {
        console.error('Failed to load branches:', err)
      }
    }
    fetchWarehouses()
  }, [appUser, onWarehousesLoaded])

  // Fetch Sales Staff for the "Billed By" dropdown
  useEffect(() => {
    const fetchStaff = async () => {
      try {
        // Start building the query
        let query = supabase
          .from('profiles')
          .select('id, full_name')
          .in('role', ['sales_person', 'branch_manager', 'owner', 'operations_manager'])
          .order('full_name');

        // ✨ FIX: Only fetch staff assigned to the currently selected warehouse
        if (selectedLocation && selectedLocation !== 'ALL') {
          query = query.eq('warehouse_id', selectedLocation);
        }

        const { data, error } = await query;
          
        if (error) throw error;
        if (data) setStaffMembers(data);
        
      } catch (err) {
        console.error('Failed to load staff members:', err)
      }
    }
    
    // Only fetch if the user has permission to change the billed by person
    if (canChangeBilledBy) {
       fetchStaff()
    }
  }, [canChangeBilledBy, selectedLocation]) // ✨ Added selectedLocation to the dependency array
  return (
    <header className="z-40 w-full bg-white border-b border-slate-200 px-4 h-14 flex items-center justify-between shrink-0 sticky top-0 lg:static">
      
      {/* LEFT SECTION: Branch Selector & Billed By */}
      <div className="flex items-center gap-2">
        <Building className="w-4 h-4 text-slate-400 hidden sm:block" />
        <Select value={selectedLocation} onValueChange={setSelectedLocation} disabled={isLocked}>
          <SelectTrigger className="h-9 bg-slate-50 hover:bg-slate-100 border-slate-200 focus:ring-slate-200 text-xs font-semibold px-3 w-[160px] sm:w-[200px] rounded-lg transition-colors text-slate-700 shadow-sm outline-none">
            <SelectValue placeholder="Identify Node..." />
          </SelectTrigger>
          <SelectContent className="rounded-xl border-slate-200 shadow-xl bg-white">
            {isHQ && (
              <SelectItem value="ALL" className="text-xs font-bold text-blue-600 rounded-md focus:bg-blue-50 focus:text-blue-700">
                All Branches (HQ)
              </SelectItem>
            )}
            
            {warehouses.map((w) => (
              <SelectItem key={w.id} value={w.id} className="text-xs font-medium text-slate-700 uppercase rounded-md focus:bg-slate-50">
                {w.name}
              </SelectItem>
            ))}

            {warehouses.length === 0 && selectedLocation && selectedLocation !== 'ALL' && (
               <SelectItem value={selectedLocation} className="text-xs uppercase font-medium text-slate-500">Loading...</SelectItem>
            )}
          </SelectContent>
        </Select>

        {/* NEW: Billed By Dropdown for Managers/Admins */}
        {canChangeBilledBy && setBilledBy && (
          <>
            <div className="w-px h-5 bg-slate-200 mx-1 hidden sm:block"></div>
            <UserCircle className="w-4 h-4 text-indigo-400 hidden sm:block" />
            <Select value={billedBy || appUser?.id} onValueChange={setBilledBy}>
              <SelectTrigger className="h-9 bg-indigo-50/50 hover:bg-indigo-50 border-indigo-100 focus:ring-indigo-200 text-xs font-semibold px-3 w-[140px] sm:w-[160px] rounded-lg transition-colors text-indigo-700 shadow-sm outline-none">
                <SelectValue placeholder="Billed By..." />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-slate-200 shadow-xl bg-white">
                <SelectItem value={appUser?.id || ''} className="text-xs font-bold text-slate-700">
                  Self (Logged In)
                </SelectItem>
                {staffMembers.filter(s => s.id !== appUser?.id).map((staff) => (
                  <SelectItem key={staff.id} value={staff.id} className="text-xs font-medium text-slate-700">
                    {staff.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        )}
      </div>
      
      {/* RIGHT SECTION: Date & Actions */}
      <div className="flex items-center gap-3 sm:gap-6">
        
        {isAdmin && setBillingDate && billingDate !== undefined ? (
          <div className="hidden md:flex flex-col items-end justify-center">
            <span className="text-[9px] font-bold uppercase tracking-wider text-indigo-500 leading-tight mb-1 flex items-center gap-1">
              <CalendarDays className="w-3 h-3" /> Backdate Invoice
            </span>
            <input 
              type="date" 
              value={billingDate}
              onChange={(e) => setBillingDate(e.target.value)}
              className="text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded-md px-2 py-0.5 outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer h-7"
            />
          </div>
        ) : (
          <div className="hidden md:flex flex-col items-end justify-center mt-0.5">
            <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 leading-tight">Terminal Active</span>
            <span className="text-xs font-semibold text-slate-700 tracking-tight leading-tight">{format(new Date(), 'EEEE, dd MMM yyyy')}</span>
          </div>
        )}

        {/* Wipe Session Button */}
        <Button 
          variant="outline" 
          size="sm" 
          onClick={onWipeSession}
          className="h-9 px-4 rounded-lg border-red-200 bg-red-50 text-red-600 hover:bg-red-600 hover:text-white hover:border-red-600 transition-all shadow-sm font-semibold text-xs" 
        >
          <span className="hidden sm:inline">Wipe Session</span>
          <Trash2 className="h-4 w-4 sm:hidden" />
        </Button>
      </div>
    </header>
  )
}