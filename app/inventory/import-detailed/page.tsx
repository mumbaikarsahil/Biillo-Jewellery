'use client'

import React, { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { 
  UploadCloud, FileSpreadsheet, AlertCircle, CheckCircle2, 
  ArrowLeft, Database, Loader2, Warehouse,
  ChevronLeft, ChevronRight, Search, Filter
} from 'lucide-react'
import Papa from 'papaparse'
import { toast } from 'sonner'

import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'

interface ParsedJewelleryItem {
  temp_id: string; 
  item_category: string;
  barcode: string;
  metal_type: string;
  purity_karat: string;
  quantity: number;
  gross_weight_g: number;
  net_weight_g: number;
  shape: string;
  color: string;
  clarity: string;
  diamond_pcs: number;
  diamond_weight_cts: number;
  total_amount: number;
}

export default function DetailedImportPage() {
  const { appUser } = useAuth()
  
  const [warehouses, setWarehouses] = useState<any[]>([])
  const [targetWarehouse, setTargetWarehouse] = useState('')
  const [file, setFile] = useState<File | null>(null)
  
  const [parsedItems, setParsedItems] = useState<ParsedJewelleryItem[]>([])
  const [isParsing, setIsParsing] = useState(false)
  const [isCommitting, setIsCommitting] = useState(false)
  const [commitSuccess, setCommitSuccess] = useState(false)

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [currentPage, setCurrentPage] = useState(1)
  const [searchTerm, setSearchTerm] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('ALL')
  const itemsPerPage = 100

  useEffect(() => {
    if (!appUser) return
    const fetchWarehouses = async () => {
      const { data } = await supabase.from('warehouses').select('*').eq('company_id', appUser.company_id)
      if (data) setWarehouses(data)
    }
    fetchWarehouses()
  }, [appUser])

  // --- BULLETPROOF FORMAT 2 PARSER ---
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return
    
    setFile(selectedFile)
    setIsParsing(true)
    setParsedItems([])
    setSelectedIds(new Set())
    setCurrentPage(1)
    setSearchTerm('')
    setCategoryFilter('ALL')
    setCommitSuccess(false)

    Papa.parse(selectedFile, {
      skipEmptyLines: true,
      complete: (results) => {
        const rows = results.data as string[][]
        const cleanInventory: ParsedJewelleryItem[] = []
        
        let currentCategory = 'UNCLASSIFIED'
        let currentItem: ParsedJewelleryItem | null = null

        for (let i = 0; i < rows.length; i++) {
          const row = rows[i]
          const rowText = row.join(' ').toLowerCase() 
          
          // 1. Skip completely empty rows
          if (!rowText.trim()) continue;

          // 2. STRICT HEADER SKIPPING
          if (
            rowText.includes('item no') || 
            rowText.includes('certificate no') || 
            rowText.includes('m / t') || 
            rowText.includes('item group') ||
            rowText.includes('gross wt')
          ) {
            continue;
          }
          
          // 3. STRICT TOTAL SKIPPING
          if (rowText.includes('total') || rowText.includes('opening balance')) {
            if (currentItem) {
              cleanInventory.push(currentItem)
              currentItem = null
            }
            continue;
          }

          const col0 = row[0]?.trim() || ''
          const col1 = row[1]?.trim() || ''

          // 4. Handle Category Grouping Row
          if (col0 !== '' && col1 === '') {
            currentCategory = col0;
            continue;
          }

          // 5. Detect Main Item Row (Col1 has the Barcode)
          if (col1 !== '') {
            if (currentItem) cleanInventory.push(currentItem)

            if (col0 !== '') currentCategory = col0; 

            const barcode = col1
            const karat = row[8]?.trim() || '' // Column 9
            
            const grossWt = parseFloat(row[10]?.replace(/,/g, '')) || 0 // Column 11
            const netWt = parseFloat(row[11]?.replace(/,/g, '')) || 0   // Column 12
            
            // --- NEW: Calculate Diamond Carats (Gross - Net) * 5 ---
            const calculatedCts = Math.max(0, parseFloat(((grossWt - netWt) * 5).toFixed(3)))

            // --- NEW: Fetch MRP from Column 22 or 23 (indices 21 or 22) ---
            const amountStr = row[22] || row[21] || '0'
            const amount = parseFloat(amountStr.replace(/,/g, '')) || 0

            currentItem = {
              temp_id: crypto.randomUUID(),
              item_category: currentCategory,
              barcode: barcode,
              metal_type: 'Gold',
              purity_karat: karat,
              quantity: 1,
              gross_weight_g: grossWt,
              net_weight_g: netWt,
              shape: '',
              color: '',
              clarity: '',
              diamond_pcs: 0,
              diamond_weight_cts: calculatedCts, // Assigned instantly from math calculation
              total_amount: amount
            }
            continue
          }

          // 6. Detect Sub-Rows (Diamonds / Stones)
          if (currentItem && col0 === '' && col1 === '') {
            const material = row[12]?.trim() || '' // Column 13: Shape
            
            if (material.toUpperCase().includes('GOLD') || material === '') continue

            const color = row[14]?.trim() || ''   // Column 15: Color
            const clarity = row[15]?.trim() || '' // Column 16: Clarity
            const pcs = parseFloat(row[17]?.replace(/,/g, '')) || 0 // Column 18: Pieces
            
            // Extract Column 20 (index 19) as a fallback for carats
            const subCts = parseFloat(row[19]?.replace(/,/g, '')) || 0 

            if (material && !currentItem.shape.includes(material)) {
              currentItem.shape = currentItem.shape ? `${currentItem.shape}, ${material}` : material;
            }
            if (color && !currentItem.color.includes(color)) {
              currentItem.color = currentItem.color ? `${currentItem.color}, ${color}` : color;
            }
            if (clarity && !currentItem.clarity.includes(clarity)) {
              currentItem.clarity = currentItem.clarity ? `${currentItem.clarity}, ${clarity}` : clarity;
            }
            
            currentItem.diamond_pcs += pcs;

            // Fallback: If math yielded 0, grab the explicit carat reading from column 20
            if (currentItem.diamond_weight_cts === 0 && subCts > 0) {
              currentItem.diamond_weight_cts += subCts;
            }
          }
        }
        
        if (currentItem) cleanInventory.push(currentItem)

        setParsedItems(cleanInventory)
        setSelectedIds(new Set(cleanInventory.map(item => item.temp_id)))
        setIsParsing(false)
        
        if (cleanInventory.length > 0) {
          toast.success(`Successfully mapped ${cleanInventory.length} detailed assets!`)
        } else {
          toast.error("No items found. Ensure the file matches the Detailed Format 2 structure.")
        }
      },
      error: (error) => {
        toast.error("Failed to parse file: " + error.message)
        setIsParsing(false)
      }
    })
  }

  // --- FILTERING LOGIC ---
  const uniqueCategories = useMemo(() => {
    return Array.from(new Set(parsedItems.map(item => item.item_category))).sort()
  }, [parsedItems])

  const filteredItems = useMemo(() => {
    return parsedItems.filter(item => {
      const matchesSearch = item.barcode.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            item.item_category.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesCategory = categoryFilter === 'ALL' || item.item_category === categoryFilter
      return matchesSearch && matchesCategory
    })
  }, [parsedItems, searchTerm, categoryFilter])

  // --- EDITING LOGIC ---
  const handleItemEdit = (tempId: string, field: keyof ParsedJewelleryItem, value: string | number) => {
    setParsedItems(prev => prev.map(item => 
      item.temp_id === tempId ? { ...item, [field]: value } : item
    ))
  }

  // --- SELECTION LOGIC ---
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

  // --- PAGINATION LOGIC ---
  const totalPages = Math.max(1, Math.ceil(filteredItems.length / itemsPerPage))
  const currentItems = filteredItems.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)

  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, categoryFilter])

  const isAllFilteredSelected = filteredItems.length > 0 && filteredItems.every(item => selectedIds.has(item.temp_id))

  // --- THE DATABASE COMMIT LOGIC ---
  const handleCommitToDatabase = async () => {
    if (!targetWarehouse) return toast.error("Please select a target warehouse first.")
    if (selectedIds.size === 0) return toast.error("No items selected to commit.")

    setIsCommitting(true)
    
    try {
      const itemsToCommit = parsedItems.filter(item => selectedIds.has(item.temp_id))

      const inventoryPayload = itemsToCommit.map(item => ({
        company_id: appUser?.company_id,
        warehouse_id: targetWarehouse,
        barcode: item.barcode,
        item_category: item.item_category,
        metal_type: item.metal_type,
        purity_karat: item.purity_karat,
        purity_percent: 100, 
        quantity: Number(item.quantity) || 1,
        gross_weight_g: Number(item.gross_weight_g) || 0,
        net_weight_g: Number(item.net_weight_g) || 0,
        total_stone_weight_cts: Number(item.diamond_weight_cts) || 0,
        total_stone_pieces: Number(item.diamond_pcs) || 0,
        diamond_shape: item.shape,
        diamond_color: item.color,
        diamond_clarity: item.clarity,
        mrp: Number(item.total_amount) || 0, 
        status: 'in_stock' 
      }))

      const chunkSize = 100
      for (let i = 0; i < inventoryPayload.length; i += chunkSize) {
        const chunk = inventoryPayload.slice(i, i + chunkSize)
        const { error } = await supabase.from('inventory_items').insert(chunk)
        if (error) throw error
      }

      setCommitSuccess(true)
      toast.success(`Successfully committed ${itemsToCommit.length} items to inventory!`)
    } catch (err: any) {
      toast.error("Database Error: " + err.message)
    } finally {
      setIsCommitting(false)
    }
  }

  // --- INLINE EDIT INPUT COMPONENT ---
  const EditableCell = ({ value, onChange, type = "text", align = "left", className = "" }: any) => (
    <input 
      type={type}
      value={value}
      onChange={onChange}
      className={`w-full bg-transparent border border-transparent hover:border-slate-300 focus:border-indigo-500 focus:bg-white rounded px-1.5 py-1 text-xs outline-none transition-colors text-${align} ${className}`}
    />
  )

  return (
    <div className="flex flex-col min-h-screen bg-[#fafafa]">
      {/* HEADER */}
      <header className="h-14 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center sticky top-0 z-40 shadow-sm">
        <div className="flex items-center gap-3">
          <Link href="/inventory">
            <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="h-4 w-px bg-slate-200" />
          <Database className="w-4 h-4 text-emerald-600" />
          <h1 className="text-sm font-semibold text-slate-900 tracking-tight">Detailed Stock Importer (Format 2)</h1>
        </div>
      </header>

      <main className="max-w-[1500px] mx-auto w-full p-4 sm:p-8 space-y-6">
        
        {commitSuccess ? (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-8 text-center space-y-4 animate-in fade-in zoom-in-95">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-emerald-800 tracking-tight">Migration Complete</h2>
              <p className="text-emerald-600 font-medium mt-1">Successfully ingested {selectedIds.size} detailed inventory assets.</p>
            </div>
            <div className="pt-4 flex justify-center gap-4">
              <Button onClick={() => window.location.reload()} variant="outline" className="border-emerald-200 text-emerald-700 hover:bg-emerald-100">
                Upload Another File
              </Button>
              <Link href="/inventory">
                <Button className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold">
                  View Live Inventory
                </Button>
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
            
            {/* LEFT COLUMN: UPLOAD & CONFIG */}
            <div className="xl:col-span-3 space-y-6">
              
              <Card className="shadow-sm border-slate-200">
                <CardContent className="p-6 space-y-6">
                  
                  {/* STEP 1: WAREHOUSE */}
                  <div>
                    <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">1. Select Target Vault</Label>
                    <Select onValueChange={setTargetWarehouse} value={targetWarehouse}>
                      <SelectTrigger className="h-12 border-slate-300">
                        <SelectValue placeholder="Where is this stock physically?" />
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
                    </Select>
                  </div>

                  {/* STEP 2: FILE UPLOAD */}
                  <div>
                    <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">2. Upload Detailed Report (.csv)</Label>
                    <label className={`
                      flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-xl cursor-pointer transition-colors
                      ${file ? 'border-emerald-300 bg-emerald-50/50' : 'border-slate-300 hover:bg-slate-50 bg-white'}
                    `}>
                      <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        {isParsing ? (
                           <Loader2 className="w-8 h-8 text-emerald-500 animate-spin mb-2" />
                        ) : file ? (
                           <FileSpreadsheet className="w-8 h-8 text-emerald-500 mb-2" />
                        ) : (
                           <UploadCloud className="w-8 h-8 text-slate-400 mb-2" />
                        )}
                        <p className="text-sm font-semibold text-slate-700 text-center px-2 truncate w-full">{file ? file.name : "Click or drag file here"}</p>
                        {!file && <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-widest">Format 2 Configured</p>}
                      </div>
                      <input type="file" accept=".csv, .xls, .xlsx" className="hidden" onChange={handleFileUpload} />
                    </label>
                  </div>
                </CardContent>
              </Card>

              {parsedItems.length > 0 && (
                <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-5 flex flex-col gap-3">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <h3 className="text-sm font-bold text-emerald-900">Ready to Commit</h3>
                      <p className="text-xs text-emerald-700 mt-1 leading-relaxed">
                        You have selected <strong className="text-slate-900 bg-emerald-200 px-1 rounded">{selectedIds.size} of {parsedItems.length}</strong> items to ingest into the vault.
                      </p>
                    </div>
                  </div>
                  <Button 
                    onClick={handleCommitToDatabase} 
                    disabled={isCommitting || !targetWarehouse || selectedIds.size === 0}
                    className="w-full mt-2 h-12 bg-emerald-600 hover:bg-emerald-700 text-white font-bold uppercase tracking-widest text-xs shadow-md"
                  >
                    {isCommitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Database className="w-4 h-4 mr-2" />}
                    {isCommitting ? 'Committing Data...' : `Commit ${selectedIds.size} Items`}
                  </Button>
                </div>
              )}
            </div>

            {/* RIGHT COLUMN: PREVIEW TABLE WITH PAGINATION & EDITING */}
            <div className="xl:col-span-9">
              <Card className="shadow-sm border-slate-200 flex flex-col overflow-hidden h-[750px] bg-white">
                
                {/* TOOLBAR: SEARCH & FILTER */}
                <div className="p-4 border-b border-slate-100 bg-slate-50/80 flex flex-col sm:flex-row justify-between gap-4 shrink-0">
                  <div className="flex items-center gap-3 flex-1">
                    <div className="relative w-full max-w-sm">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <Input 
                        placeholder="Search Barcode or Category..." 
                        className="pl-9 h-9 text-sm bg-white"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                      />
                    </div>
                    <div className="relative w-full max-w-[200px] hidden sm:block">
                      <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                      <select 
                        className="w-full h-9 pl-9 pr-8 text-sm border border-slate-200 rounded-md bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent appearance-none"
                        value={categoryFilter}
                        onChange={(e) => setCategoryFilter(e.target.value)}
                      >
                        <option value="ALL">All Categories</option>
                        {uniqueCategories.map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded">{selectedIds.size} Selected</span>
                    <Badge variant="outline" className="bg-white text-slate-600 border-slate-200 font-bold">{filteredItems.length} Results</Badge>
                  </div>
                </div>
                
                <div className="flex-1 overflow-auto custom-scrollbar relative">
                  {parsedItems.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-4">
                      <FileSpreadsheet className="w-12 h-12 text-slate-200" />
                      <p className="text-sm font-medium">Upload a file to preview parsed data.</p>
                    </div>
                  ) : filteredItems.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-2">
                      <Search className="w-8 h-8 text-slate-300" />
                      <p className="text-sm font-medium">No items match your search.</p>
                    </div>
                  ) : (
                    <table className="w-full text-left text-sm whitespace-nowrap table-fixed">
                      <thead className="sticky top-0 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.05)] z-10">
                        <tr>
                          <th className="py-2 px-3 w-10 text-center">
                            <input 
                              type="checkbox" 
                              className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-600 cursor-pointer"
                              checked={isAllFilteredSelected}
                              onChange={(e) => handleSelectAll(e.target.checked)}
                              title="Select all filtered items"
                            />
                          </th>
                          <th className="py-2 px-2 text-[10px] font-bold uppercase text-slate-500 w-32">Category</th>
                          <th className="py-2 px-2 text-[10px] font-bold uppercase text-slate-500 w-28">Barcode</th>
                          <th className="py-2 px-2 text-[10px] font-bold uppercase text-slate-500 text-center w-16">Purity</th>
                          <th className="py-2 px-2 text-[10px] font-bold uppercase text-slate-500 text-center w-24">Shape/Clr/Col</th>
                          <th className="py-2 px-2 text-[10px] font-bold uppercase text-slate-500 text-right w-16">Dia Pcs</th>
                          <th className="py-2 px-2 text-[10px] font-bold uppercase text-slate-500 text-right w-20">Gross (g)</th>
                          <th className="py-2 px-2 text-[10px] font-bold uppercase text-slate-500 text-right w-20">Net (g)</th>
                          <th className="py-2 px-2 text-[10px] font-bold uppercase text-slate-500 text-right w-20 text-emerald-600">Dia (cts)</th>
                          <th className="py-2 px-2 text-[10px] font-bold uppercase text-slate-500 text-right w-28 text-emerald-600">Amount (₹)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {currentItems.map((item) => {
                          const isSelected = selectedIds.has(item.temp_id)
                          return (
                            <tr key={item.temp_id} className={`transition-colors ${isSelected ? 'bg-emerald-50/30' : 'hover:bg-slate-50/50'}`}>
                              <td className="py-1 px-3 text-center">
                                <input 
                                  type="checkbox" 
                                  className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-600 cursor-pointer"
                                  checked={isSelected}
                                  onChange={() => handleSelectRow(item.temp_id)}
                                />
                              </td>
                              <td className="py-1 px-1">
                                <EditableCell 
                                  value={item.item_category} 
                                  onChange={(e: any) => handleItemEdit(item.temp_id, 'item_category', e.target.value)} 
                                  className="font-semibold text-slate-600 truncate"
                                />
                              </td>
                              <td className="py-1 px-1">
                                <EditableCell 
                                  value={item.barcode} 
                                  onChange={(e: any) => handleItemEdit(item.temp_id, 'barcode', e.target.value)} 
                                  className="font-mono font-bold text-slate-900"
                                />
                              </td>
                              <td className="py-1 px-1">
                                <EditableCell 
                                  value={item.purity_karat} 
                                  onChange={(e: any) => handleItemEdit(item.temp_id, 'purity_karat', e.target.value)} 
                                  align="center"
                                  className="font-bold text-amber-600"
                                />
                              </td>
                              <td className="py-1 px-1 flex flex-col gap-0.5 justify-center mt-1">
                                <EditableCell 
                                  value={item.shape} 
                                  onChange={(e: any) => handleItemEdit(item.temp_id, 'shape', e.target.value)} 
                                  align="center"
                                  className="placeholder:text-slate-300 truncate w-full py-0 leading-tight"
                                  placeholder="Shp"
                                />
                                <div className="flex gap-1">
                                  <EditableCell 
                                    value={item.clarity} 
                                    onChange={(e: any) => handleItemEdit(item.temp_id, 'clarity', e.target.value)} 
                                    align="center"
                                    className="w-1/2 placeholder:text-slate-300 py-0 text-[10px]"
                                    placeholder="Clr"
                                  />
                                  <EditableCell 
                                    value={item.color} 
                                    onChange={(e: any) => handleItemEdit(item.temp_id, 'color', e.target.value)} 
                                    align="center"
                                    className="w-1/2 placeholder:text-slate-300 py-0 text-[10px]"
                                    placeholder="Col"
                                  />
                                </div>
                              </td>
                              <td className="py-1 px-1">
                                <EditableCell 
                                  type="number"
                                  value={item.diamond_pcs} 
                                  onChange={(e: any) => handleItemEdit(item.temp_id, 'diamond_pcs', e.target.value)} 
                                  align="right"
                                  className="text-slate-500 font-medium"
                                />
                              </td>
                              <td className="py-1 px-1">
                                <EditableCell 
                                  type="number"
                                  value={item.gross_weight_g} 
                                  onChange={(e: any) => handleItemEdit(item.temp_id, 'gross_weight_g', e.target.value)} 
                                  align="right"
                                  className="font-medium"
                                />
                              </td>
                              <td className="py-1 px-1">
                                <EditableCell 
                                  type="number"
                                  value={item.net_weight_g} 
                                  onChange={(e: any) => handleItemEdit(item.temp_id, 'net_weight_g', e.target.value)} 
                                  align="right"
                                  className="font-bold text-slate-800"
                                />
                              </td>
                              <td className="py-1 px-1">
                                <EditableCell 
                                  type="number"
                                  value={item.diamond_weight_cts} 
                                  onChange={(e: any) => handleItemEdit(item.temp_id, 'diamond_weight_cts', e.target.value)} 
                                  align="right"
                                  className="font-black text-emerald-600 bg-emerald-50/50"
                                />
                              </td>
                              <td className="py-1 px-1 pr-3">
                                <EditableCell 
                                  type="number"
                                  value={item.total_amount} 
                                  onChange={(e: any) => handleItemEdit(item.temp_id, 'total_amount', e.target.value)} 
                                  align="right"
                                  className="font-mono font-bold text-slate-800 bg-slate-50/50"
                                />
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  )}
                </div>

                {/* PAGINATION FOOTER */}
                {filteredItems.length > 0 && (
                  <div className="p-3 border-t border-slate-200 bg-white flex items-center justify-between shrink-0 shadow-[0_-1px_2px_rgba(0,0,0,0.02)]">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest hidden sm:block">
                      Showing {(currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, filteredItems.length)} of {filteredItems.length}
                    </p>
                    <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="h-8 px-2"
                        disabled={currentPage === 1}
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      >
                        <ChevronLeft className="w-4 h-4 mr-1" /> Prev
                      </Button>
                      <Badge variant="secondary" className="px-3 h-8 flex items-center bg-slate-100 text-slate-700">
                        Page {currentPage} of {totalPages}
                      </Badge>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="h-8 px-2"
                        disabled={currentPage === totalPages}
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      >
                        Next <ChevronRight className="w-4 h-4 ml-1" />
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            </div>
            
          </div>
        )}
      </main>
    </div>
  )
}