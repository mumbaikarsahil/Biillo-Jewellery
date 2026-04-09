import React, { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { Building, Trash2 } from 'lucide-react'
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
  onWarehousesLoaded?: (warehouses: any[]) => void // <--- NEW: Passes the rich data up to the main page
}

export function POSHeader({ isHQ, isLocked, selectedLocation, setSelectedLocation, onWipeSession, onWarehousesLoaded }: POSHeaderProps) {
  const { appUser } = useAuth()
  
  // Expanded state to hold the new address and contact columns
  const [warehouses, setWarehouses] = useState<{
    id: string, 
    name: string, 
    address?: string, 
    contact_number?: string, 
    gstin?: string
  }[]>([])

  // Fetch branches specific to this company
  useEffect(() => {
    const fetchWarehouses = async () => {
      if (!appUser?.company_id) return
      try {
        // Now fetching the new columns from the database
        const { data, error } = await supabase
          .from('warehouses')
          .select('id, name, address, contact_number, gstin')
          .eq('company_id', appUser.company_id)
          .eq('is_active', true)
          .order('name')
        
        if (error) throw error
        
        if (data) {
          setWarehouses(data)
          // Pass the rich data payload up to the parent component
          if (onWarehousesLoaded) onWarehousesLoaded(data)
        }

      } catch (err) {
        console.error('Failed to load branches:', err)
      }
    }
    fetchWarehouses()
  }, [appUser, onWarehousesLoaded])

  return (
    // Height snapped back to h-14 to perfectly align with the sidebar
    <header className="z-40 w-full bg-white border-b border-slate-200 px-4 h-14 flex items-center justify-between shrink-0 sticky top-0 lg:static">
      
      {/* LEFT SECTION: Branch Selector ONLY */}
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
            
            {/* Dynamically mapped warehouses from Supabase */}
            {warehouses.map((w) => (
              <SelectItem key={w.id} value={w.id} className="text-xs font-medium text-slate-700 uppercase rounded-md focus:bg-slate-50">
                {w.name}
              </SelectItem>
            ))}

            {/* Fallback while loading */}
            {warehouses.length === 0 && selectedLocation && selectedLocation !== 'ALL' && (
               <SelectItem value={selectedLocation} className="text-xs uppercase font-medium text-slate-500">Loading...</SelectItem>
            )}
          </SelectContent>
        </Select>
      </div>
      
      {/* RIGHT SECTION: Date & Actions */}
      <div className="flex items-center gap-3 sm:gap-6">
        
        {/* Current Date */}
        <div className="hidden md:flex flex-col items-end justify-center mt-0.5">
          <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 leading-tight">Terminal Active</span>
          <span className="text-xs font-semibold text-slate-700 tracking-tight leading-tight">{format(new Date(), 'EEEE, dd MMM yyyy')}</span>
        </div>

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