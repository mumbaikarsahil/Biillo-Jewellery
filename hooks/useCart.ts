import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { toast } from 'sonner'

export function useCart(companyId: string | undefined, selectedLocation: string, mode: string) {
  const [cart, setCart] = useState<any[]>([])
  const [itemSearchTerm, setItemSearchTerm] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])

  // Derived state
  const subtotal = cart.reduce((sum, item) => sum + (item.mrp || 0), 0)

  // Real-time search
  useEffect(() => {
    const searchItems = async () => {
      if (!itemSearchTerm.trim() || !companyId || !selectedLocation) return setSearchResults([])
      
      let query = supabase.from('inventory_items')
        // ✨ UPDATED: Added is_sp_item and is_custom_order to the select list
        .select('id, barcode, sku_reference, metal_type, mrp, status, warehouse_id, purity_karat, hsn_code, gross_weight_g, net_weight_g, total_stone_weight_cts, is_custom_order, is_sp_item')
        .eq('company_id', companyId)
        .eq('status', 'in_stock') 
        .eq('is_custom_order', false)
        .or(`barcode.ilike.%${itemSearchTerm.trim()}%,sku_reference.ilike.%${itemSearchTerm.trim()}%`)
        .limit(15)

      if (selectedLocation !== 'ALL') {
        query = query.eq('warehouse_id', selectedLocation)
      }

      // ✨ NEW: HIDE SP ITEMS FROM SEARCH (Unless we are making a transfer/challan)
      if (mode !== 'challan') {
        query = query.eq('is_sp_item', false)
      }

      const { data, error } = await query
      if (error) console.error("Search Error:", error)
      setSearchResults(data || [])
    }

    const timeoutId = setTimeout(() => searchItems(), 300)
    return () => clearTimeout(timeoutId)
  }, [itemSearchTerm, companyId, selectedLocation, mode]) // Added mode to dependencies

  const processScannedItem = (item: any) => {
    if (cart.find(c => c.barcode === item.barcode)) {
      return toast.error(`Item ${item.barcode} is already in the cart.`)
    }
    
    if (selectedLocation !== 'ALL' && item.warehouse_id !== selectedLocation) {
       return toast.error(`Cross-Branch Error: Item resides in a different location.`)
    }
    
    if (mode !== 'challan' && item.status !== 'in_stock') {
      return toast.error(`Cannot sell item. Current status is: ${item.status?.replace('_', ' ').toUpperCase()}`)
    }
    
    if (item.is_custom_order) {
      return toast.error("This is a custom order item. Please use the Custom Order Pickup tab to bill it.")
    }

    // ✨ NEW: EXTRA SAFETY NET FOR DIRECT QR SCANNING
    if (item.is_sp_item && mode !== 'challan') {
      return toast.error("This is a Sample/Display (SP) item and cannot be billed/sold.")
    }

    setCart(prev => [{...item, tax_percent: 3, mrp: item.mrp || 0}, ...prev])
    toast.success(`${item.barcode} added to bill.`)
    setItemSearchTerm('')
    setSearchResults([]) 
  }

  const handleScanResult = async (barcode: string) => {
    if (!barcode.trim()) return toast.error('No barcode detected.')
    if (!selectedLocation || selectedLocation === 'ALL') return toast.error('Select a Vault Location first.')

    try {
      const { data: item, error } = await supabase.from('inventory_items')
        .select('*') 
        .ilike('barcode', barcode.trim())
        .eq('company_id', companyId)
        // We do not filter `is_custom_order` or `is_sp_item` out at the DB level here, 
        // so that processScannedItem can show a helpful error message instead of a generic "doesn't exist" message.
        .maybeSingle()

      if (error) throw error
      if (!item) return toast.error(`Barcode doesn't exist in registry.`)

      processScannedItem(item)
    } catch (err) {
      toast.error('Database query failed.')
    }
  }

  const clearCart = () => setCart([])
  const removeFromCart = (index: number) => setCart(cart.filter((_, i) => i !== index))

  return {
    cart, subtotal, itemSearchTerm, setItemSearchTerm, searchResults,
    processScannedItem, handleScanResult, clearCart, removeFromCart, setCart
  }
}