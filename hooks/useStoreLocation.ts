'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'

export function useStoreLocation() {
  const { appUser, loading: authLoading } = useAuth()
  
  // 1. Determine if the user has HQ / Unrestricted access
  // They are HQ if they have no specific warehouse assigned OR their role is owner/manager
  const isHQ = !appUser?.warehouse_id || ['owner', 'manager'].includes(appUser?.role || '')
  
  // 2. Determine the default selection for dropdowns
  // If HQ, default to 'ALL' (or whatever your "all branches" value is). If branch, default to their specific ID.
  const defaultLocation = isHQ ? 'ALL' : appUser?.warehouse_id || ''

  // 3. State to hold the currently selected location on the page
  const [selectedLocation, setSelectedLocation] = useState<string>(defaultLocation)

  // Ensure state updates if the auth context loads slightly after the page
  useEffect(() => {
    if (!authLoading && appUser) {
      setSelectedLocation(isHQ ? 'ALL' : appUser.warehouse_id || '')
    }
  }, [appUser, authLoading, isHQ])

  return {
    isHQ,                       // Boolean: true if Main Office
    isLocked: !isHQ,            // Boolean: true if we should disable the dropdown
    selectedLocation,           // The current value to pass to your database queries
    setSelectedLocation,        // Function to change location (only works if !isLocked)
    userWarehouseId: appUser?.warehouse_id // The raw ID if needed
  }
}