import React from 'react'
import { Search, Camera, ShoppingCart, Trash2, Box, Plus, Minus } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { 
  Select, SelectContent, SelectItem, 
  SelectTrigger, SelectValue 
} from '@/components/ui/select'
import { BillingMode } from '@/app/pos/page' // Adjust this import path if your types are elsewhere

// ✨ NEW: Define the structure for selected packaging items
export interface SelectedPackaging {
  id: string;
  item_name: string;
  quantity: number;
  stock_count: number;
}

interface CartPanelProps {
  mode: BillingMode
  cart: any[]
  itemSearchTerm: string
  setItemSearchTerm: (term: string) => void
  searchResults: any[]
  processScannedItem: (item: any) => void
  removeFromCart: (index: number) => void
  onOpenScanner: () => void
  
  // ✨ NEW: Packaging Props (Made optional to prevent immediate crashes before hooks are updated)
  availablePackaging?: any[]
  selectedPackaging?: SelectedPackaging[]
  onAddPackaging?: (packId: string) => void
  onRemovePackaging?: (packId: string) => void
  onUpdatePackagingQty?: (packId: string, qty: number) => void
}

export function CartPanel({ 
  mode, 
  cart, 
  itemSearchTerm, 
  setItemSearchTerm, 
  searchResults, 
  processScannedItem, 
  removeFromCart, 
  onOpenScanner,
  availablePackaging = [],
  selectedPackaging = [],
  onAddPackaging,
  onRemovePackaging,
  onUpdatePackagingQty
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
      <div className="flex-1 overflow-y-auto bg-white custom-scrollbar flex flex-col justify-between">
         {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-6 text-slate-400">
               <ShoppingCart className="h-12 w-12 mb-3 text-slate-200" />
               <p className="text-sm font-semibold text-slate-400">Cart is empty</p>
               <p className="text-xs text-slate-400 mt-1">Search an SKU or scan a QR code to begin billing</p>
            </div>
         ) : (
            <div className="flex flex-col flex-1">
              <div className="flex-1">
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

              {/* ✨ NEW: Packaging Materials Section */}
              <div className="p-3 bg-slate-50 border-t border-slate-200 mt-auto">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                    <Box className="w-3.5 h-3.5" /> Packaging Used
                  </h3>
                  <Select onValueChange={onAddPackaging} value="">
                    <SelectTrigger className="h-7 w-[160px] text-[10px] bg-white font-semibold">
                      <SelectValue placeholder="Add Material..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availablePackaging.length === 0 ? (
                        <SelectItem value="empty" disabled className="text-xs italic text-slate-400">No packaging available</SelectItem>
                      ) : (
                        availablePackaging.map(p => (
                          <SelectItem key={p.id} value={p.id} disabled={p.stock_count <= 0}>
                            {p.item_name} <span className="text-slate-400 ml-1">({p.stock_count})</span>
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>

                {/* Selected Packaging List */}
                {selectedPackaging.length > 0 && (
                  <div className="flex flex-col gap-2">
                    {selectedPackaging.map(sp => (
                      <div key={sp.id} className="flex items-center justify-between bg-white border border-slate-200 p-2 rounded-md shadow-sm">
                        <span className="text-xs font-semibold text-slate-700 pl-1">{sp.item_name}</span>
                        <div className="flex items-center gap-3">
                          <div className="flex items-center border border-slate-200 rounded-sm bg-slate-50">
                            <button 
                              onClick={() => onUpdatePackagingQty?.(sp.id, sp.quantity - 1)} 
                              className="px-2 py-1 text-slate-500 hover:text-slate-800 hover:bg-slate-200 transition-colors"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="text-xs font-mono font-bold w-6 text-center">{sp.quantity}</span>
                            <button 
                              onClick={() => onUpdatePackagingQty?.(sp.id, sp.quantity + 1)} 
                              disabled={sp.quantity >= sp.stock_count} 
                              className="px-2 py-1 text-slate-500 hover:text-slate-800 hover:bg-slate-200 transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                          <button onClick={() => onRemovePackaging?.(sp.id)} className="text-slate-400 hover:text-red-500 p-1">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
         )}
      </div>
    </>
  )
}