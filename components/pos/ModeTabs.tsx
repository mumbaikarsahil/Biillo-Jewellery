// components/pos/ModeTabs.tsx
import React from 'react'
import { ShoppingCart, Hammer, Truck, PenTool, Undo2 } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

export function ModeTabs({ mode, setMode }: any) {
  return (
    <div className="bg-white border-b border-slate-300 px-2 pt-2 shrink-0 overflow-x-auto hide-scroll">
      <Tabs value={mode} onValueChange={(v) => setMode(v)} className="w-full min-w-max">
        <TabsList className="flex h-auto bg-transparent p-0 gap-1 justify-start">
          <TabsTrigger value="normal" className="rounded-t-sm rounded-b-none border border-b-0 border-transparent data-[state=active]:border-slate-300 data-[state=active]:bg-slate-100 data-[state=active]:text-[#0078D7] text-slate-600 px-3 sm:px-4 py-2 font-semibold text-xs transition-none hover:bg-slate-50">
            <ShoppingCart className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2" /> Tax Invoice
          </TabsTrigger>
          {/* ESTIMATE TAB REMOVED FROM HERE */}
          <TabsTrigger value="custom" className="rounded-t-sm rounded-b-none border border-b-0 border-transparent data-[state=active]:border-slate-300 data-[state=active]:bg-slate-100 data-[state=active]:text-[#881798] text-slate-600 px-3 sm:px-4 py-2 font-semibold text-xs transition-none hover:bg-slate-50">
            <Hammer className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2" /> Custom Order
          </TabsTrigger>
          <TabsTrigger value="return" className="rounded-t-sm rounded-b-none border border-b-0 border-transparent data-[state=active]:border-slate-300 data-[state=active]:bg-slate-100 data-[state=active]:text-[#E30000] text-slate-600 px-3 sm:px-4 py-2 font-semibold text-xs transition-none hover:bg-slate-50">
            <Undo2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2" /> Buyback / Return
          </TabsTrigger>
          <TabsTrigger value="repair" className="rounded-t-sm rounded-b-none border border-b-0 border-transparent data-[state=active]:border-slate-300 data-[state=active]:bg-slate-100 data-[state=active]:text-[#E3008C] text-slate-600 px-3 sm:px-4 py-2 font-semibold text-xs transition-none hover:bg-slate-50">
            <PenTool className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2" /> Repair Module
          </TabsTrigger>
        </TabsList>
      </Tabs>
    </div>
  )
}