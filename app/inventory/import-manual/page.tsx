"use client"

import React, { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { 
  AlertCircle, CheckCircle2, ArrowLeft, Database, 
  Warehouse, ChevronLeft, ChevronRight, Search, Filter,
  Plus, Trash2, Keyboard, UserCircle, Loader2
} from 'lucide-react'
import { toast } from 'sonner'

import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Select as UISelect, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'

// --- PREDEFINED OPTIONS FOR DATALISTS ---
const CATEGORIES = [
  "Necklace", "Ring", "Earring", "Bangle", "Bracelet", "Chain", 
  "Pendant", "Mangalsutra", "Nosepin", "Set", "Coin", "Other"
]
const DIAMOND_SHAPES = [
  "Round", "Princess", "Cushion", "Emerald", "Oval", "Radiant", 
  "Pear", "Marquise", "Asscher", "Heart", "Mixed", "None"
]
const DIAMOND_COLORS = [
  "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "Fancy", "None"
]
const DIAMOND_CLARITIES = [
  "FL", "IF", "VVS1", "VVS2", "VS1", "VS2", "SI1", "SI2", "I1", "I2", "I3", "None"
]

// --- EXTENDED SCHEMA INTERFACE ---
interface ManualJewelleryItem {
  temp_id: string; 
  item_category: string;
  barcode: string;
  sku_reference?: string; 
  metal_type: string;
  metal_color: string;
  purity_karat: string;
  quantity: number;
  gross_weight_g: number | string;
  net_weight_g: number | string;
  
  solitaire_pcs: number | string;
  solitaire_cts: number | string;
  melee_pcs: number | string;
  melee_cts: number | string;
  
  shape: string;
  color: string;
  clarity: string;
  
  hsn_code: string;
  remarks: string;
  total_amount: number | string;
}

const getCategoryPrefix = (category: string): string => {
  if (!category) return 'UNK';
  const c = category.toUpperCase();
  if (c.includes('NECKLACE')) return 'NEC';
  if (c.includes('RING')) return 'RNG';
  if (c.includes('EARRING')) return 'EAR';
  if (c.includes('BANGLE')) return 'BAN';
  if (c.includes('BRACELET')) return 'BRA';
  if (c.includes('CHAIN')) return 'CHN';
  if (c.includes('PENDANT')) return 'PND';
  if (c.includes('MANGALSUTRA')) return 'MGL';
  if (c.includes('NOSE')) return 'NOS';
  if (c.includes('SET')) return 'SET';
  if (c.includes('COIN')) return 'COIN';
  
  return c.substring(0, 3).replace(/[^A-Z]/g, '').padEnd(3, 'X');
};

const EditableCell = ({ value, onChange, type = "text", align = "left", className = "", placeholder = "", tabIndex }: any) => (
  <input 
    type={type}
    value={value ?? ''}
    onChange={onChange}
    placeholder={placeholder}
    tabIndex={tabIndex}
    className={`w-full bg-transparent border border-transparent hover:border-slate-300 focus:border-indigo-500 focus:bg-white rounded px-1.5 py-1 text-xs outline-none transition-colors text-${align} ${className}`}
  />
)

const ComboCell = ({ value, onChange, listId, align = "left", className = "", placeholder = "", tabIndex }: any) => (
  <input 
    type="text"
    list={listId}
    value={value ?? ''}
    onChange={onChange}
    placeholder={placeholder}
    tabIndex={tabIndex}
    className={`w-full bg-transparent border border-transparent hover:border-slate-300 focus:border-indigo-500 focus:bg-white rounded px-1.5 py-1 text-xs outline-none transition-colors text-${align} placeholder:text-slate-400 ${className}`}
  />
)

export default function ManualImportPage() {
  const { appUser } = useAuth()
  
  const [warehouses, setWarehouses] = useState<any[]>([])
  const [karigars, setKarigars] = useState<any[]>([])
  const [targetWarehouse, setTargetWarehouse] = useState('')
  const [targetKarigar, setTargetKarigar] = useState('')
  
  const [items, setItems] = useState<ManualJewelleryItem[]>([])
  const [isCommitting, setIsCommitting] = useState(false)
  const [commitSuccess, setCommitSuccess] = useState(false)

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [currentPage, setCurrentPage] = useState(1)
  const [searchTerm, setSearchTerm] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('ALL')
  const itemsPerPage = 100

  useEffect(() => {
    if (!appUser) return
    const fetchConfigData = async () => {
      const { data: wData } = await supabase.from('warehouses').select('*').eq('company_id', appUser.company_id)
      if (wData) setWarehouses(wData)

      const { data: kData } = await supabase
        .from('karigars')
        .select('id, full_name, karigar_code')
        .eq('company_id', appUser.company_id)
        .eq('is_active', true)
        
      if (kData) setKarigars(kData)
    }
    fetchConfigData()
  }, [appUser])

  const handleAddRow = () => {
    const newItem: ManualJewelleryItem = {
      temp_id: crypto.randomUUID(),
      item_category: '', 
      barcode: '',
      metal_type: 'Gold',
      metal_color: 'Yellow',
      purity_karat: '18K',
      quantity: 1,
      gross_weight_g: '',
      net_weight_g: '',
      solitaire_pcs: '',
      solitaire_cts: '',
      melee_pcs: '',
      melee_cts: '',
      shape: '',
      color: '',
      clarity: '',
      hsn_code: '7113', 
      remarks: '',
      total_amount: '',
    }
    
    setItems([newItem, ...items])
    setSelectedIds(new Set([...selectedIds, newItem.temp_id]))
  }

  const handleRemoveRow = (tempId: string) => {
    setItems(items.filter(item => item.temp_id !== tempId))
    const newSelected = new Set(selectedIds)
    newSelected.delete(tempId)
    setSelectedIds(newSelected)
  }

  const handleItemEdit = (tempId: string, field: keyof ManualJewelleryItem, value: string | number) => {
    setItems(prev => prev.map(item => 
      item.temp_id === tempId ? { ...item, [field]: value } : item
    ))
  }

  const previewSkus = useMemo(() => {
    const skus: Record<string, string> = {};
    const counters: Record<string, number> = {};

    [...items].reverse().forEach(item => {
      const prefix = getCategoryPrefix(item.item_category);
      if (!counters[prefix]) counters[prefix] = 1;
      skus[item.temp_id] = `${prefix}-NEW-${counters[prefix]}`;
      counters[prefix]++;
    });

    return skus;
  }, [items]);

  const uniqueCategories = useMemo(() => {
    return Array.from(new Set(items.map(item => item.item_category).filter(Boolean))).sort()
  }, [items])

  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const matchesSearch = item.barcode.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            item.item_category.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesCategory = categoryFilter === 'ALL' || item.item_category === categoryFilter
      return matchesSearch && matchesCategory
    })
  }, [items, searchTerm, categoryFilter])

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const newSelected = new Set(selectedIds)
      filteredItems.forEach(item => newSelected.add(item.temp_id))
      setSelectedIds(newSelected)
    } else {
      const newSelected = new Set(selectedIds)
      filteredItems.forEach(item => newSelected.delete(item.temp_id))
      setSelectedIds(newSelected)
    }
  }

  const handleSelectRow = (id: string) => {
    const newSet = new Set(selectedIds)
    if (newSet.has(id)) newSet.delete(id)
    else newSet.add(id)
    setSelectedIds(newSet)
  }

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / itemsPerPage))
  const currentItems = filteredItems.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)

  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, categoryFilter])

  const isAllFilteredSelected = filteredItems.length > 0 && filteredItems.every(item => selectedIds.has(item.temp_id))

  // =========================================================================
  // THE DATABASE COMMIT LOGIC
  // =========================================================================
  const handleCommitToDatabase = async () => {
    if (!targetWarehouse || !appUser) return toast.error("Please select a target vault first.")
    if (!targetKarigar) return toast.error("Please select an assigning Karigar.")
    if (selectedIds.size === 0) return toast.error("No items selected to commit.")

    const itemsToCommit = items.filter(item => selectedIds.has(item.temp_id))
    
    for (const item of itemsToCommit) {
      if (!item.item_category.trim()) return toast.error("All selected items must have a category.")
      if (!item.barcode.trim()) return toast.error("All selected items must have a barcode.")
    }

    setIsCommitting(true)
    
    try {
      const groupedByPrefix: Record<string, typeof itemsToCommit> = {};
      
      [...itemsToCommit].reverse().forEach(item => {
        const prefix = getCategoryPrefix(item.item_category);
        if (!groupedByPrefix[prefix]) groupedByPrefix[prefix] = [];
        groupedByPrefix[prefix].push(item);
      });

      const prefixCounters: Record<string, number> = {};
      
      for (const prefix of Object.keys(groupedByPrefix)) {
        const { data: existingSkus } = await supabase
          .from('inventory_items')
          .select('sku_reference')
          .eq('company_id', appUser.company_id)
          .ilike('sku_reference', `${prefix}-%`)
          
        let maxSeq = 100;
        if (existingSkus && existingSkus.length > 0) {
          existingSkus.forEach(row => {
            if (row.sku_reference) {
              const numPart = row.sku_reference.split('-')[1];
              const num = parseInt(numPart, 10);
              if (!isNaN(num) && num > maxSeq) {
                maxSeq = num;
              }
            }
          });
        }
        prefixCounters[prefix] = maxSeq + 1; 
      }

      const inventoryPayload: any[] = [];
      
      for (const prefix of Object.keys(groupedByPrefix)) {
        let currentCounter = prefixCounters[prefix];
        
        for (const item of groupedByPrefix[prefix]) {
          const guaranteedUniqueSku = `${prefix}-${currentCounter}`;
          currentCounter++; 
          
          const solPcs = Number(item.solitaire_pcs) || 0;
          const solCts = Number(item.solitaire_cts) || 0;
          const melPcs = Number(item.melee_pcs) || 0;
          const melCts = Number(item.melee_cts) || 0;
          
          inventoryPayload.push({
            company_id: appUser.company_id,
            warehouse_id: targetWarehouse,
            
            // --- NEW: Mapped directly to your new karigar_id column ---
            karigar_id: targetKarigar, 
            // ----------------------------------------------------------

            barcode: item.barcode,
            sku_reference: guaranteedUniqueSku,
            item_category: item.item_category,
            metal_type: item.metal_type,
            metal_color: item.metal_color,
            purity_karat: item.purity_karat,
            purity_percent: 100, 
            quantity: Number(item.quantity) || 1,
            gross_weight_g: Number(item.gross_weight_g) || 0,
            net_weight_g: Number(item.net_weight_g) || 0,
            
            solitaire_pieces: solPcs,
            solitaire_weight_cts: solCts,
            melee_pieces: melPcs,
            melee_weight_cts: melCts,
            color_stone_pieces: 0,
            color_stone_weight_cts: 0,
            
            total_stone_pieces: solPcs + melPcs,
            total_stone_weight_cts: solCts + melCts,
            
            diamond_shape: item.shape === 'None' ? '' : item.shape,
            diamond_color: item.color === 'None' ? '' : item.color,
            diamond_clarity: item.clarity === 'None' ? '' : item.clarity,
            hsn_code: item.hsn_code,
            remarks: item.remarks,
            mrp: Number(item.total_amount) || 0, 
            status: 'in_stock' 
          });
        }
      }

      const chunkSize = 100;
      for (let i = 0; i < inventoryPayload.length; i += chunkSize) {
        const chunk = inventoryPayload.slice(i, i + chunkSize);
        
        const { error } = await supabase
          .from('inventory_items')
          .upsert(chunk, { 
            onConflict: 'barcode', 
            ignoreDuplicates: true 
          });
          
        if (error) throw new Error(`Failed to insert batch ${i}. Error: ${error.message}`);
      }

      setCommitSuccess(true)
      toast.success(`Successfully committed ${itemsToCommit.length} detailed items to inventory.`)
    } catch (err: any) {
      toast.error("Database Error: " + err.message)
    } finally {
      setIsCommitting(false)
    }
  }

  return (
    <div className="flex flex-col min-h-screen bg-[#fafafa]">
      <header className="h-14 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center sticky top-0 z-40 shadow-sm">
        <div className="flex items-center gap-3">
          <Link href="/inventory">
            <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="h-4 w-px bg-slate-200" />
          <Keyboard className="w-4 h-4 text-indigo-600" />
          <h1 className="text-sm font-semibold text-slate-900 tracking-tight">Detailed Manual Entry</h1>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto w-full p-4 sm:p-8 space-y-6">
        
        {commitSuccess ? (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-8 text-center space-y-4 animate-in fade-in zoom-in-95">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-emerald-800 tracking-tight">Entry Complete</h2>
              <p className="text-emerald-600 font-medium mt-1">Successfully ingested manual assets with auto-generated SKUs.</p>
            </div>
            <div className="pt-4 flex justify-center gap-4">
              <Button onClick={() => window.location.reload()} variant="outline" className="border-emerald-200 text-emerald-700 hover:bg-emerald-100">
                Start New Batch
              </Button>
              <Link href="/inventory">
                <Button className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold">
                  View Live Inventory
                </Button>
              </Link>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              
              <Card className="shadow-sm border-slate-200 lg:col-span-3">
                <CardContent className="p-5 grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
                  <div className="w-full">
                    <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block">1. Target Vault</Label>
                    <UISelect onValueChange={setTargetWarehouse} value={targetWarehouse}>
                      <SelectTrigger className="h-10 border-slate-300 bg-white">
                        <SelectValue placeholder="Select Destination" />
                      </SelectTrigger>
                      <SelectContent>
                        {warehouses.map((wh) => (
                          <SelectItem key={wh.id} value={wh.id} className="font-medium">
                            <div className="flex items-center gap-2">
                              <Warehouse className="w-3.5 h-3.5 text-slate-400" />
                              {wh.name}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </UISelect>
                  </div>

                  <div className="w-full">
                    <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block">2. Assign Karigar</Label>
                    <UISelect onValueChange={setTargetKarigar} value={targetKarigar}>
                      <SelectTrigger className="h-10 border-slate-300 bg-white">
                        <SelectValue placeholder="Select Maker" />
                      </SelectTrigger>
                      <SelectContent>
                        {karigars.map((k) => (
                          <SelectItem key={k.id} value={k.id} className="font-medium">
                            <div className="flex items-center gap-2">
                              <UserCircle className="w-3.5 h-3.5 text-slate-400" />
                              {k.full_name} {k.karigar_code ? `(${k.karigar_code})` : ''}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </UISelect>
                  </div>

                  <div className="w-full">
                    <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block">3. Data Entry</Label>
                    <Button 
                      onClick={handleAddRow}
                      variant="outline"
                      className="w-full h-10 border-dashed border-2 border-indigo-200 text-indigo-600 bg-indigo-50 hover:bg-indigo-100 hover:border-indigo-300 font-bold"
                    >
                      <Plus className="w-4 h-4 mr-2" /> Add Empty Row
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {items.length > 0 ? (
                <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-5 flex flex-col gap-3 justify-center animate-in fade-in h-full">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Database className="w-4 h-4 text-indigo-600" />
                      <span className="text-sm font-bold text-indigo-900">Ready: {selectedIds.size} Items</span>
                    </div>
                  </div>
                  <Button 
                    onClick={handleCommitToDatabase} 
                    disabled={isCommitting || !targetWarehouse || !targetKarigar || selectedIds.size === 0}
                    className="w-full h-10 bg-indigo-600 hover:bg-indigo-700 text-white font-bold tracking-widest text-xs shadow-md"
                  >
                    {isCommitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : 'Commit to Database'}
                  </Button>
                </div>
              ) : (
                <div className="border border-dashed border-slate-200 rounded-xl flex items-center justify-center text-slate-400 text-sm font-medium h-full min-h-[100px]">
                  Add rows to begin
                </div>
              )}
            </div>

            <Card className="shadow-sm border-slate-200 flex flex-col overflow-hidden h-[75vh] bg-white">
              
              <div className="p-3 border-b border-slate-100 bg-slate-50/80 flex flex-col sm:flex-row justify-between gap-4 shrink-0">
                <div className="flex items-center gap-3 flex-1">
                  <div className="relative w-full max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input 
                      placeholder="Search Barcode or Category..." 
                      className="pl-9 h-8 text-xs bg-white"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                  <div className="relative w-full max-w-[200px] hidden sm:block">
                    <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                    <select 
                      className="w-full h-8 pl-9 pr-8 text-xs font-medium border border-slate-200 rounded-md bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 appearance-none"
                      value={categoryFilter}
                      onChange={(e) => setCategoryFilter(e.target.value)}
                    >
                      <option value="ALL">All Categories</option>
                      {uniqueCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                    </select>
                  </div>
                </div>
                
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant="outline" className="bg-white text-slate-600 border-slate-200">{filteredItems.length} Entries</Badge>
                </div>
              </div>
              
              <div className="flex-1 overflow-auto custom-scrollbar relative">
                {items.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-4">
                    <Keyboard className="w-12 h-12 text-slate-200" />
                    <p className="text-sm font-medium">No items yet. Click "Add Empty Row".</p>
                  </div>
                ) : filteredItems.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-2">
                    <Search className="w-8 h-8 text-slate-300" />
                    <p className="text-sm font-medium">No items match your search.</p>
                  </div>
                ) : (
                  <table className="w-full text-left text-sm whitespace-nowrap table-fixed">
                    <thead className="sticky top-0 bg-slate-50 shadow-[0_1px_2px_rgba(0,0,0,0.05)] z-10 border-b border-slate-200">
                      <tr>
                        <th className="py-2 px-2 w-10 text-center border-r border-slate-200">
                          <input 
                            type="checkbox" 
                            className="w-3.5 h-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-600 cursor-pointer"
                            checked={isAllFilteredSelected}
                            onChange={(e) => handleSelectAll(e.target.checked)}
                          />
                        </th>
                        <th className="py-2 px-2 text-[10px] font-bold uppercase text-slate-600 w-32 border-r border-slate-200">Category *</th>
                        <th className="py-2 px-2 text-[10px] font-bold uppercase text-slate-600 w-36 border-r border-slate-200">Barcode *</th>
                        <th className="py-2 px-2 text-[10px] font-bold uppercase text-slate-600 text-center w-24 border-r border-slate-200">Purity & Color</th>
                        <th className="py-2 px-2 text-[10px] font-bold uppercase text-slate-600 text-center w-20 border-r border-slate-200">Gross (g)</th>
                        <th className="py-2 px-2 text-[10px] font-bold uppercase text-slate-600 text-center w-20 border-r border-slate-200">Net (g)</th>
                        
                        <th className="py-2 px-2 text-[10px] font-bold uppercase text-indigo-700 bg-indigo-50/50 text-center w-24 border-r border-slate-200">Solitaire<br/><span className="text-[8px] font-medium text-slate-400">Pcs | Cts</span></th>
                        <th className="py-2 px-2 text-[10px] font-bold uppercase text-indigo-700 bg-indigo-50/50 text-center w-24 border-r border-slate-200">Melee<br/><span className="text-[8px] font-medium text-slate-400">Pcs | Cts</span></th>
                        
                        <th className="py-2 px-2 text-[10px] font-bold uppercase text-emerald-700 bg-emerald-50/50 text-center w-24 border-r border-slate-200">Total Dia<br/><span className="text-[8px] font-medium text-emerald-600/70">Pcs | Cts</span></th>
                        
                        <th className="py-2 px-2 text-[10px] font-bold uppercase text-slate-600 text-center w-28 border-r border-slate-200">Dia Specs<br/><span className="text-[8px] font-medium text-slate-400">Shp | Clr | Col</span></th>
                        <th className="py-2 px-2 text-[10px] font-bold uppercase text-emerald-700 text-right w-24 border-r border-slate-200">MRP (₹)</th>
                        <th className="py-2 px-2 text-[10px] font-bold uppercase text-slate-600 w-20 border-r border-slate-200">HSN</th>
                        <th className="py-2 px-2 text-[10px] font-bold uppercase text-slate-600 w-32 border-r border-slate-200">Remarks</th>
                        <th className="py-2 px-2 w-10 text-center"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {currentItems.map((item) => {
                        const isSelected = selectedIds.has(item.temp_id)
                        
                        const solPcs = Number(item.solitaire_pcs) || 0;
                        const solCts = Number(item.solitaire_cts) || 0;
                        const melPcs = Number(item.melee_pcs) || 0;
                        const melCts = Number(item.melee_cts) || 0;
                        const totalPcs = solPcs + melPcs;
                        const totalCts = solCts + melCts;

                        return (
                          <tr key={item.temp_id} className={`transition-colors ${isSelected ? 'bg-indigo-50/20' : 'hover:bg-slate-50/50'}`}>
                            <td className="py-1 px-2 text-center align-top pt-2.5 border-r border-slate-100">
                              <input 
                                type="checkbox" 
                                className="w-3.5 h-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-600 cursor-pointer"
                                checked={isSelected}
                                onChange={() => handleSelectRow(item.temp_id)}
                              />
                            </td>
                            <td className="py-1 px-1 align-top pt-2 border-r border-slate-100">
                              <ComboCell 
                                listId="category-list"
                                value={item.item_category} 
                                onChange={(e: any) => handleItemEdit(item.temp_id, 'item_category', e.target.value)} 
                                className="font-semibold uppercase"
                                placeholder="Category"
                              />
                            </td>
                            <td className="py-1 px-1 align-top pt-1.5 border-r border-slate-100">
                              <EditableCell 
                                value={item.barcode} 
                                onChange={(e: any) => handleItemEdit(item.temp_id, 'barcode', e.target.value)} 
                                className="font-mono font-bold text-slate-900 leading-none uppercase"
                                placeholder="Scan Barcode"
                              />
                              <div className="text-[9px] font-mono font-bold text-indigo-400 px-1.5 mt-0.5">
                                {previewSkus[item.temp_id]}
                              </div>
                            </td>
                            <td className="py-1 px-1 flex flex-col justify-center border-r border-slate-100 h-full">
                              <EditableCell 
                                value={item.purity_karat} 
                                onChange={(e: any) => handleItemEdit(item.temp_id, 'purity_karat', e.target.value)} 
                                align="center"
                                className="font-bold text-amber-600 py-0"
                                placeholder="18K"
                              />
                              <EditableCell 
                                value={item.metal_color} 
                                onChange={(e: any) => handleItemEdit(item.temp_id, 'metal_color', e.target.value)} 
                                align="center"
                                className="text-[10px] text-slate-500 py-0"
                                placeholder="Yellow"
                              />
                            </td>
                            <td className="py-1 px-1 align-top pt-2 border-r border-slate-100">
                              <EditableCell 
                                type="number"
                                value={item.gross_weight_g} 
                                onChange={(e: any) => handleItemEdit(item.temp_id, 'gross_weight_g', e.target.value)} 
                                align="center"
                                className="font-medium text-slate-700"
                                placeholder="0.000"
                              />
                            </td>
                            <td className="py-1 px-1 align-top pt-2 border-r border-slate-100">
                              <EditableCell 
                                type="number"
                                value={item.net_weight_g} 
                                onChange={(e: any) => handleItemEdit(item.temp_id, 'net_weight_g', e.target.value)} 
                                align="center"
                                className="font-bold text-slate-900"
                                placeholder="0.000"
                              />
                            </td>
                            
                            <td className="py-1 px-1 border-r border-slate-100 bg-indigo-50/20">
                              <div className="flex gap-1 h-full items-center">
                                <EditableCell type="number" value={item.solitaire_pcs} onChange={(e: any) => handleItemEdit(item.temp_id, 'solitaire_pcs', e.target.value)} align="center" className="w-1/2 bg-white/50" placeholder="Pcs" />
                                <EditableCell type="number" value={item.solitaire_cts} onChange={(e: any) => handleItemEdit(item.temp_id, 'solitaire_cts', e.target.value)} align="center" className="w-1/2 bg-white/50 font-semibold text-indigo-700" placeholder="Cts" />
                              </div>
                            </td>
                            <td className="py-1 px-1 border-r border-slate-100 bg-indigo-50/20">
                              <div className="flex gap-1 h-full items-center">
                                <EditableCell type="number" value={item.melee_pcs} onChange={(e: any) => handleItemEdit(item.temp_id, 'melee_pcs', e.target.value)} align="center" className="w-1/2 bg-white/50" placeholder="Pcs" />
                                <EditableCell type="number" value={item.melee_cts} onChange={(e: any) => handleItemEdit(item.temp_id, 'melee_cts', e.target.value)} align="center" className="w-1/2 bg-white/50 font-semibold text-indigo-700" placeholder="Cts" />
                              </div>
                            </td>

                            <td className="py-1 px-1 border-r border-slate-100 bg-emerald-50/20 text-center select-none">
                              <div className="flex gap-1 h-full items-center justify-center">
                                <div className="w-1/2 text-xs font-medium text-slate-600">{totalPcs > 0 ? totalPcs : '-'}</div>
                                <div className="w-1/2 text-xs font-bold text-emerald-700">{totalCts > 0 ? totalCts.toFixed(2) : '-'}</div>
                              </div>
                            </td>

                            <td className="py-1 px-1 align-top border-r border-slate-100">
                              <div className="flex flex-col gap-1 justify-center w-full mt-0.5">
                                <ComboCell 
                                  listId="shape-list"
                                  value={item.shape} 
                                  onChange={(e: any) => handleItemEdit(item.temp_id, 'shape', e.target.value)} 
                                  align="center"
                                  className="w-full"
                                  placeholder="Shape"
                                />
                                <div className="flex gap-1">
                                  <ComboCell 
                                    listId="clarity-list"
                                    value={item.clarity} 
                                    onChange={(e: any) => handleItemEdit(item.temp_id, 'clarity', e.target.value)} 
                                    align="center"
                                    className="w-1/2 text-[10px] px-0.5"
                                    placeholder="Clr"
                                  />
                                  <ComboCell 
                                    listId="color-list"
                                    value={item.color} 
                                    onChange={(e: any) => handleItemEdit(item.temp_id, 'color', e.target.value)} 
                                    align="center"
                                    className="w-1/2 text-[10px] px-0.5"
                                    placeholder="Col"
                                  />
                                </div>
                              </div>
                            </td>
                            
                            <td className="py-1 px-1 align-top pt-2 border-r border-slate-100 pr-2">
                              <EditableCell 
                                type="number"
                                value={item.total_amount} 
                                onChange={(e: any) => handleItemEdit(item.temp_id, 'total_amount', e.target.value)} 
                                align="right"
                                className="font-mono font-bold text-emerald-700 bg-emerald-50/30"
                                placeholder="0"
                              />
                            </td>
                            
                            <td className="py-1 px-1 align-top pt-2 border-r border-slate-100">
                              <EditableCell 
                                value={item.hsn_code} 
                                onChange={(e: any) => handleItemEdit(item.temp_id, 'hsn_code', e.target.value)} 
                                align="center"
                                className="text-slate-500 font-mono"
                                placeholder="7113"
                              />
                            </td>
                            <td className="py-1 px-1 align-top pt-2 border-r border-slate-100">
                              <EditableCell 
                                value={item.remarks} 
                                onChange={(e: any) => handleItemEdit(item.temp_id, 'remarks', e.target.value)} 
                                className="text-slate-500 italic"
                                placeholder="Notes..."
                              />
                            </td>
                            <td className="py-1 px-1 align-top pt-2 text-center">
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-6 w-6 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-md"
                                onClick={() => handleRemoveRow(item.temp_id)}
                                title="Remove Row"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                )}
              </div>

              <div className="p-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between shrink-0 shadow-[0_-1px_2px_rgba(0,0,0,0.02)]">
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest hidden sm:block">
                  Showing {(currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, filteredItems.length)} of {filteredItems.length}
                </p>
                <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="h-7 px-2 text-xs"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  >
                    <ChevronLeft className="w-3.5 h-3.5 mr-1" /> Prev
                  </Button>
                  <Badge variant="secondary" className="px-2 h-7 flex items-center bg-white border-slate-200 text-slate-600 text-xs">
                    Page {currentPage} of {totalPages}
                  </Badge>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="h-7 px-2 text-xs"
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  >
                    Next <ChevronRight className="w-3.5 h-3.5 ml-1" />
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        )}
      </main>

      {/* --- GLOBAL DATALISTS FOR AUTOCOMPLETE --- */}
      <datalist id="category-list">
        {CATEGORIES.map(c => <option key={c} value={c} />)}
      </datalist>
      <datalist id="shape-list">
        {DIAMOND_SHAPES.map(s => <option key={s} value={s} />)}
      </datalist>
      <datalist id="color-list">
        {DIAMOND_COLORS.map(c => <option key={c} value={c} />)}
      </datalist>
      <datalist id="clarity-list">
        {DIAMOND_CLARITIES.map(c => <option key={c} value={c} />)}
      </datalist>

      <style dangerouslySetInnerHTML={{__html:`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background-color: #cbd5e1; border-radius: 10px; }
      `}} />
    </div>
  )
}