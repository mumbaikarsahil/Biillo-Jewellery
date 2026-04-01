import React from 'react'
import { Search, Camera, ShoppingCart, Trash2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { BillingMode } from '@/app/pos/page' // Adjust this import path if your types are elsewhere

// 1. We strictly define the individual props coming from POSPage
interface CartPanelProps {
  mode: BillingMode
  cart: any[]
  itemSearchTerm: string
  setItemSearchTerm: (term: string) => void
  searchResults: any[]
  processScannedItem: (item: any) => void
  removeFromCart: (index: number) => void
  onOpenScanner: () => void
}

// 2. We destructure them directly in the component signature (no more 'cartHook')
export function CartPanel({ 
  mode, 
  cart, 
  itemSearchTerm, 
  setItemSearchTerm, 
  searchResults, 
  processScannedItem, 
  removeFromCart, 
  onOpenScanner 
}: CartPanelProps) {
  
  return (
    <>
      {/* Search Bar & Camera Button */}
      <div className="p-3 bg-slate-100 border-b border-slate-300 flex gap-2 relative">
        <div className="relative flex-1 group z-20">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <Input 
            placeholder="Search by Barcode, Name, or SKU..." 
            className="h-9 pl-9 rounded-sm border-slate-300 text-sm bg-white"
            value={itemSearchTerm} 
            onChange={(e) => setItemSearchTerm(e.target.value)}
          />
          
          {/* Real-time Search Dropdown */}
          {searchResults.length > 0 && itemSearchTerm && (
            <div className="absolute top-full left-0 mt-1 w-full bg-white border border-slate-300 shadow-lg max-h-[300px] overflow-y-auto rounded-sm">
              {searchResults.map((item) => {
                const isAvailable = item.status === 'in_stock'
                return (
                  <div 
                    key={item.id} 
                    className="p-2 border-b border-slate-100 hover:bg-slate-50 cursor-pointer flex items-center justify-between" 
                    onClick={() => processScannedItem(item)}
                  >
                    <div className="flex flex-col">
                      <span className="font-mono text-sm font-bold text-slate-800">{item.barcode}</span>
                      <span className="text-[10px] text-slate-500 uppercase">{item.sku_reference || item.metal_type} · {item.purity_karat}</span>
                    </div>
                    <div className="flex flex-col items-end">
                      <div className="text-sm font-bold text-slate-800">₹{(item.mrp || 0).toLocaleString()}</div>
                      {!isAvailable && <span className="text-[9px] text-red-600 font-bold uppercase">{item.status?.replace('_', ' ')}</span>}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
        <Button onClick={onOpenScanner} className="h-9 bg-[#0078D7] text-white rounded-sm w-[160px] hover:bg-[#005A9E] shadow-sm">
          <Camera className="h-4 w-4 mr-2" /> SCAN QR
        </Button>
      </div>

      {/* Cart Items Table */}
      <div className="flex-1 overflow-y-auto bg-white custom-scrollbar">
         {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-6 text-slate-400">
               <ShoppingCart className="h-12 w-12 mb-3 text-slate-200" />
               <p className="text-sm font-semibold text-slate-400">Cart is empty</p>
               <p className="text-xs text-slate-400 mt-1">Search an SKU or scan a QR code to begin billing</p>
            </div>
         ) : (
            <div className="flex flex-col">
              {cart.map((item, idx) => (
                <div key={idx} className="flex justify-between p-3 border-b border-slate-100 items-center hover:bg-slate-50 transition-colors">
                   <div className="flex items-center gap-3">
                      <Button variant="ghost" size="icon" onClick={() => removeFromCart(idx)} className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-sm">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                      <div>
                        <p className="font-mono text-sm font-bold text-slate-800">{item.barcode}</p>
                        <p className="text-[10px] text-slate-500 uppercase mt-0.5 tracking-tight">
                          {item.sku_reference} | {item.net_weight_g}g {mode !== 'challan' && `| ${item.tax_percent}% Tax`}
                        </p>
                      </div>
                   </div>
                   <div className="text-right">
                     <p className="font-bold text-sm text-slate-800">₹{mode === 'challan' ? '-' : (item.mrp || 0).toLocaleString()}</p>
                   </div>
                </div>
              ))}
            </div>
         )}
      </div>
    </>
  )
}