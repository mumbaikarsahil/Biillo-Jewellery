'use client'

import React, { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useStoreLocation } from '@/hooks/useStoreLocation'
import { useRpc } from '@/hooks/useRpc'
import { Loader2 } from 'lucide-react'
import { fetchCustomers } from '@/lib/api'
import { toast } from 'sonner' // Added for the toast notification

// Hooks
import { useCart } from '@/hooks/useCart'
import { useCheckout } from '@/hooks/useCheckout'

// Components
import { POSHeader } from '@/components/pos/POSHeader'
import { ModeTabs } from '@/components/pos/ModeTabs'
import { CartPanel } from '@/components/pos/CartPanel'
import { CheckoutSidebar } from '@/components/pos/CheckoutSidebar'
import { CustomOrderForm } from '@/components/pos/CustomOrderForm'
import { PosModals } from '@/components/pos/PosModals'
import { ReturnIntakeForm } from '@/components/pos/ReturnIntakeForm'
import { RepairIntakeForm } from '@/components/pos/RepairIntakeForm'

// Strict Types
export type BillingMode = 'normal' | 'custom' | 'challan' | 'repair' | 'return'

export default function POSPage() {
  const { appUser, loading } = useAuth()
  const { callRpc } = useRpc()
  const { isHQ, isLocked, selectedLocation, setSelectedLocation } = useStoreLocation()
  
  // Core UI State
  const [mode, setMode] = useState<BillingMode>('normal')
  const [showScanner, setShowScanner] = useState(false)
  const [showPreviewModal, setShowPreviewModal] = useState(false)
  const [showPrintModal, setShowPrintModal] = useState(false)
  const [lastInvoiceData, setLastInvoiceData] = useState<any>(null)
  const [isEstimateCheckout, setIsEstimateCheckout] = useState(false)
  
  // NEW: State to hold the rich warehouse data (for printing addresses)
  const [allBranches, setAllBranches] = useState<any[]>([])

  const [repairDetails, setRepairDetails] = useState<any>({
    itemDescription: '',
    grossWeight: '',
    purity: '22K',
    defectNotes: '',
    estimatedCost: '',
    advancePaid: '',
    expectedDelivery: '',
    conditionPhotoUrl: null
  })

  // Form & Customer State (Managed here to feed both Sidebar and Checkout Hook)
  const [customers, setCustomers] = useState<any[]>([])
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null)
  const [customOrderDetails, setCustomOrderDetails] = useState({ 
    design_reference: '', 
    item_category: '', 
    expected_gold_g: '', 
    expected_diamond_cts: '', 
    estimated_value: '', 
    advance_paid: '' 
  })
  
  // State for the Buyback/Return form
  const [returnDetails, setReturnDetails] = useState({
    invoiceNo: '', articleCost: '', discountApplied: '', paidValue: 0, returnPercent: '70', calculatedRefund: 0
  })

  // Fetch Customers on Mount
  useEffect(() => {
    const initData = async () => {
      if (!appUser?.company_id) return
      try {
        const { data: custData } = await fetchCustomers(appUser.company_id)
        setCustomers(custData || [])
      } catch (err) {
        console.error("Failed to load customers", err)
      }
    }
    initData()
  }, [appUser])

  // 1. Initialize Cart 
  // IMPORTANT: Ensure `setCart` is exported from your `useCart` hook!
  const {
    cart, setCart, subtotal, itemSearchTerm, setItemSearchTerm, searchResults,
    processScannedItem, handleScanResult, clearCart, removeFromCart
  } = useCart(appUser?.company_id, selectedLocation, mode)

  // 2. Initialize Checkout 
  const checkoutHook = useCheckout({
    appUser, 
    selectedLocation, 
    mode, 
    callRpc, 
    cart, 
    subtotal,
    selectedCustomer, 
    customOrderDetails,
    repairDetails,     
    returnDetails,    
    allBranches       
  })

  // Global Session Wipe
  const handleWipeSession = () => {
    clearCart()
    checkoutHook.resetCheckoutState()
    setSelectedCustomer(null)
    setCustomOrderDetails({ design_reference: '', item_category: '', expected_gold_g: '', expected_diamond_cts: '', estimated_value: '', advance_paid: '' })
    setReturnDetails({ invoiceNo: '', articleCost: '', discountApplied: '', paidValue: 0, returnPercent: '70', calculatedRefund: 0 })
    setRepairDetails({ itemDescription: '', grossWeight: '', purity: '22K', defectNotes: '', estimatedCost: '', advancePaid: '', expectedDelivery: '', conditionPhotoUrl: null })
  }

  // Pre-flight check before showing the preview modal
  const handlePreviewRequest = (isEstimate: boolean = false) => {
    setIsEstimateCheckout(isEstimate) 
    setShowPreviewModal(true)
  }

  if (loading || !appUser) {
    return (
      <div className="h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#0078D7]" />
      </div>
    )
  }

  return (
    <div className="min-h-[100dvh] lg:h-[100dvh] flex flex-col bg-[#E6E6E6] text-slate-900 font-sans overflow-hidden">
      
      <POSHeader 
        isHQ={isHQ} isLocked={isLocked} 
        selectedLocation={selectedLocation} setSelectedLocation={setSelectedLocation} 
        onWipeSession={handleWipeSession} 
        onWarehousesLoaded={setAllBranches} 
      />

      <ModeTabs mode={mode} setMode={setMode} />

      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden p-2 gap-2">
        
        {/* LEFT PANEL */}
        <div className="flex-1 flex flex-col bg-white border border-slate-300 shadow-sm overflow-hidden rounded-sm min-h-[400px] lg:min-h-0">
        {mode === 'custom' ? (
             <CustomOrderForm 
               details={customOrderDetails} 
               setDetails={setCustomOrderDetails} 
               currentLocationId={selectedLocation}
               onAddToBill={(finalItemData: any) => {
                 // 1. Switch back to normal mode
                 setMode('normal');
                 
                 // 2. Clear current cart and add the finished custom item
                 clearCart();
                 if (setCart) {
                   setCart([{
                     id: finalItemData.inventory_id,
                     barcode: finalItemData.barcode,
                     mrp: finalItemData.mrp,
                     quantity: 1,
                     custom_order_id: finalItemData.custom_order_id,
                     advance_paid: finalItemData.advance_paid,
                     // --- INJECT THE SPECS INTO THE CART STATE ---
                     net_weight_g: finalItemData.net_weight_g,
                     gross_weight_g: finalItemData.gross_weight_g,
                     total_stone_weight_cts: finalItemData.total_stone_weight_cts,
                     item_category: finalItemData.item_category,
                     metal_type: finalItemData.metal_type,
                     purity_karat: finalItemData.purity_karat
                   }]);
                   toast.success("Added to cart! Advance payment applied.");
                 } else {
                   toast.error("Cart error: Please ensure setCart is exported from useCart.");
                 }
               }}
             />
          ) : mode === 'return' ? (
             <ReturnIntakeForm 
               details={returnDetails} 
               setDetails={setReturnDetails}
               appUser={appUser} 
             />
            ) : mode === 'repair' ? (
              <RepairIntakeForm 
                details={repairDetails} 
                setDetails={setRepairDetails} 
                currentLocationId={selectedLocation}
                onAddToBill={(finalItemData: any) => {
                  setMode('normal');
                  clearCart();
                  if (setCart) {
                    setCart([{
                      id: finalItemData.inventory_id, // Pseudo ID
                      barcode: finalItemData.barcode,
                      mrp: finalItemData.mrp,
                      quantity: 1,
                      repair_ticket_id: finalItemData.repair_ticket_id, // <--- Key identifier
                      advance_paid: finalItemData.advance_paid,
                      net_weight_g: finalItemData.net_weight_g,
                      total_stone_weight_cts: finalItemData.total_stone_weight_cts,
                      item_category: finalItemData.item_category
                    }]);
                    toast.success("Added to cart! Advance payment applied.");
                  } else {
                    toast.error("Cart error: Please ensure setCart is exported.");
                  }
                }}
              />
           ) : (
             <CartPanel 
               mode={mode} 
               cart={cart}
               itemSearchTerm={itemSearchTerm}
               setItemSearchTerm={setItemSearchTerm}
               searchResults={searchResults}
               processScannedItem={processScannedItem}
               removeFromCart={removeFromCart}
               onOpenScanner={() => setShowScanner(true)} 
             />
          )}
        </div>

        {/* RIGHT PANEL */}
        <CheckoutSidebar 
          mode={mode}
          cartLength={cart.length}
          cart={cart} // <--- PASSED CART SO IT CAN READ ADVANCE PAYMENTS
          subtotal={subtotal}
          customers={customers}
          setCustomers={setCustomers}
          selectedCustomer={selectedCustomer}
          setSelectedCustomer={setSelectedCustomer}
          appUser={appUser}
          selectedLocation={selectedLocation}
          repairDetails={repairDetails}
          customOrderDetails={customOrderDetails}
          returnDetails={returnDetails} 
          onPreviewRequest={handlePreviewRequest}
          setMode={setMode}
          {...checkoutHook}
        />
      </div>

      {/* MODALS */}
      <PosModals 
        mode={mode}
        showScanner={showScanner} 
        setShowScanner={setShowScanner} 
        onScanSuccess={handleScanResult}
        showPreviewModal={showPreviewModal} 
        setShowPreviewModal={setShowPreviewModal}
        showPrintModal={showPrintModal} 
        setShowPrintModal={setShowPrintModal}
        previewData={checkoutHook.generateDraftData(isEstimateCheckout)} 
        lastInvoiceData={lastInvoiceData} 
        setLastInvoiceData={setLastInvoiceData}
        isProcessing={checkoutHook.isProcessing}
        executeCheckout={async () => {
          const result = await checkoutHook.executeCheckout(isEstimateCheckout) 
          if (result.success) {
            setLastInvoiceData(result.draftData)
            setShowPreviewModal(false)
            setShowPrintModal(true)
            handleWipeSession()
          }
        }}
      />
    </div>
  )
}