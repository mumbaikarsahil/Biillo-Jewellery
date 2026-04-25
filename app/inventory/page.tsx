"use client"

import React, { useEffect, useState, useMemo, useRef, useCallback } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { useReactToPrint } from "react-to-print"
import html2canvas from "html2canvas"
import QRCode from "react-qr-code"
import { Badge } from "@/components/ui/badge"

import { 
  Search, Printer, Edit2, Check, X, Store, Truck, 
  RefreshCw, Database, Package, Calculator, Gem, Hammer, 
  Upload, Eye, Image as ImageIcon, CheckCircle2, Box, Layers, Wrench, Clock, CalendarDays,
  Loader2, Filter, IndianRupee, UserCircle, CheckSquare, Sparkles, Mic, ChevronDown, Download, FileText, History, ArrowRightLeft
} from "lucide-react"

import { useAuth } from "@/hooks/useAuth"
import { useStoreLocation } from "@/hooks/useStoreLocation"
import { supabase } from "@/lib/supabaseClient"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { 
  Table, TableBody, TableCell, TableHead, 
  TableHeader, TableRow 
} from "@/components/ui/table"
import { 
  Dialog, DialogContent, DialogHeader, 
  DialogTitle, DialogDescription, DialogFooter
} from "@/components/ui/dialog"
import { 
  Select, SelectContent, SelectItem, 
  SelectTrigger, SelectValue 
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { ItemTagPreview } from "@/components/ItemTagPreview"

// ===========================================================================
// ✨ GLOBAL HELPER: SMART STONE FALLBACK
// ===========================================================================
const getStoneTotals = (item: any) => {
  if (!item) return { solWt: 0, solPcs: 0, meleeWt: 0, meleePcs: 0, aggWt: 0, aggPcs: 0, stnWt: 0, stnPcs: 0 };

  const solWt = Number(item.solitaire_weight_cts || 0);
  const solPcs = Number(item.solitaire_pieces || 0);
  const meleeWt = Number(item.melee_weight_cts || 0);
  const meleePcs = Number(item.melee_pieces || 0);
  const fallbackWt = Number(item.total_stone_weight_cts || 0);
  const fallbackPcs = Number(item.total_stone_pieces || 0);

  const aggWt = (solWt > 0 || meleeWt > 0) ? (solWt + meleeWt) : fallbackWt;
  const aggPcs = (solPcs > 0 || meleePcs > 0) ? (solPcs + meleePcs) : fallbackPcs;

  let stnWt = meleeWt;
  let stnPcs = meleePcs;
  if (meleeWt === 0 && meleePcs === 0 && (fallbackWt > 0 || fallbackPcs > 0)) {
     stnWt = fallbackWt;
     stnPcs = fallbackPcs;
  }

  return { solWt, solPcs, meleeWt, meleePcs, aggWt, aggPcs, stnWt, stnPcs };
}

const formatDateTime = (isoString: string) => {
  if (!isoString) return "Unknown"
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  }).format(new Date(isoString))
}

const formatDateShort = (isoString: string) => {
  if (!isoString) return "Unknown"
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit', month: 'short', year: '2-digit'
  }).format(new Date(isoString))
}

export interface AuditLogEntry {
  timestamp: string;
  user_name: string;
  reason: string;
  changes: string;
}

interface InventoryItem {
  id: string
  _type: 'inventory' | 'repair' 
  barcode: string
  sku_reference: string
  item_category: string
  item_size: string
  metal_type: string
  purity_karat: string
  purity_percent: number
  gross_weight_g: number
  net_weight_g: number
  total_stone_weight_cts: number
  total_stone_pieces: number
  solitaire_weight_cts: number
  solitaire_pieces: number
  melee_weight_cts: number
  melee_pieces: number
  color_stone_weight_cts: number
  color_stone_pieces: number
  mrp: number | null
  status: string
  warehouse_id: string
  is_exchanged: boolean
  is_custom_order: boolean
  is_repair_ticket: boolean
  custom_order_id: string | null
  origin_name?: string
  custom_orders?: { id: string; order_number: string; origin?: { name: string } }
  karigars?: { full_name: string; karigar_code: string } | null
  created_from_job_bag?: { karigar_id?: string; karigars?: { full_name: string; karigar_code: string } } | null
  huid_code: string | null
  hsn_code: string | null
  image_url: string | null
  remarks: string | null
  audit_history?: AuditLogEntry[] | null 
  metal_color: string | null
  diamond_shape: string | null
  diamond_color: string | null
  diamond_clarity: string | null
  cost_metal: number
  cost_stone: number
  cost_making: number
  cost_total: number
  wastage_weight_g: number
  created_at: string
  updated_at: string
  last_status_change_at: string
  expected_delivery_date?: string | null;
}

const GeminiLoader = () => (
  <div className="absolute inset-0 z-10 bg-white/70 backdrop-blur-sm flex flex-col items-center justify-center animate-in fade-in duration-300">
    <div className="relative flex items-center justify-center gap-1.5 mb-3">
      <Sparkles className="w-5 h-5 text-[#4285F4] animate-pulse" style={{ animationDelay: '0ms', animationDuration: '1.5s' }} />
      <Sparkles className="w-8 h-8 text-[#9b72cb] animate-pulse" style={{ animationDelay: '200ms', animationDuration: '1.5s' }} />
      <Sparkles className="w-5 h-5 text-[#d96570] animate-pulse" style={{ animationDelay: '400ms', animationDuration: '1.5s' }} />
      <div className="absolute inset-0 bg-gradient-to-r from-[#4285F4] via-[#9b72cb] to-[#d96570] blur-xl opacity-30 animate-pulse" />
    </div>
    <span className="text-[11px] font-black uppercase tracking-[0.2em] text-transparent bg-clip-text bg-gradient-to-r from-[#4285F4] to-[#d96570] animate-pulse">
      AI Syncing Vault...
    </span>
  </div>
)

// ===========================================================================
// MAIN PAGE COMPONENT
// ===========================================================================
export default function InventoryPage() {
  const { appUser } = useAuth()
  const router = useRouter()
  
  const [items, setItems] = useState<InventoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [warehouses, setWarehouses] = useState<any[]>([])
  const { isHQ, isLocked, selectedLocation, setSelectedLocation } = useStoreLocation()
  
  const [userRole, setUserRole] = useState<string>('sales_person') 
  const canEdit = ['owner', 'manager', 'operations_manager'].includes(userRole)
  
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [editingMrpId, setEditingId] = useState<string | null>(null)
  const [editingMrpVal, setEditingMrpVal] = useState<string>('')
  
  const [editWeightItem, setEditWeightItem] = useState<InventoryItem | null>(null)
  const [weightForm, setWeightForm] = useState({ 
    gross: '', net: '', stone: '', 
    diamond_clarity: '', diamond_color: '', diamond_shape: '',
    reason: '' 
  })
  const [isSavingWeights, setIsSavingWeights] = useState(false)

  const [tagItem, setTagItem] = useState<InventoryItem | null>(null)
  const [viewItem, setViewItem] = useState<InventoryItem | null>(null)

  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('') 
  const [filterStatus, setFilterStatus] = useState<string[]>([])
  const [filterCategory, setFilterCategory] = useState<string[]>([])
  const [filterPurity, setFilterPurity] = useState<string[]>([])
  const [filterClarity, setFilterClarity] = useState<string[]>([])
  const [activeTab, setActiveTab] = useState<string>("active")
  
  const [maxCatalogPrice, setMaxCatalogPrice] = useState(1000000)
  const [priceRange, setPriceRange] = useState<number[]>([0, 1000000])
  const [debouncedPriceRange, setDebouncedPriceRange] = useState<number[]>([0, 1000000]) 
  const [isPriceFilterActive, setIsPriceFilterActive] = useState(false)

  const [openDropdown, setOpenDropdown] = useState<string | null>(null)

  const [globalTotalCount, setGlobalTotalCount] = useState<number>(0)
  const [globalSoldCount, setGlobalSoldCount] = useState<number>(0)
  const [isFetchingGlobal, setIsFetchingGlobal] = useState(false)

  const [diamondRates, setDiamondRates] = useState<Record<string, number>>({})

  const [isCalcModalOpen, setCalcModalOpen] = useState(false)
  const [calcStep, setCalcStep] = useState<'params' | 'preview'>('params')
  const [isCalculating, setIsCalculating] = useState(false)
  const [base24kRate, setBase24kRate] = useState<number>(7250) 
  const [goldRates, setGoldRates] = useState<Record<string, number>>({}) 
  const [previewData, setPreviewData] = useState<any[]>([])
  const [isUploadingImage, setIsUploadingImage] = useState(false)
  const [calcParams, setCalcParams] = useState({ diamondRatePerCt: 25000, markupPercent: 80, flatCharge: 8000, roundUpTo: 50 })

  const printRef = useRef<HTMLDivElement>(null)
  
  const handleBulkPrint = useReactToPrint({ 
    contentRef: printRef, 
    documentTitle: `Bulk-Inventory-Tags` 
  })
  
  const itemsToPrint = items.filter(i => selectedIds.includes(i.id))

  const uniqueCategories = useMemo(() => Array.from(new Set(items.map(c => c.item_category))).filter(Boolean).sort(), [items]);
  const uniquePurities = useMemo(() => Array.from(new Set(items.map(c => c.purity_karat))).filter(Boolean).sort(), [items]);
  // ✨ FIX: Standardizes everything to uppercase and removes stray spaces
  // ✨ FIX: Standardizes everything to uppercase and removes stray spaces
  const uniqueClaritiesFilter = useMemo(() => {
    const rawClarities = items.map(c => c.diamond_clarity).filter(Boolean) as string[];
    const cleanClarities = rawClarities.map(c => c.trim().toUpperCase());
    return Array.from(new Set(cleanClarities)).sort();
  }, [items]);
  const executeSmartSearch = useCallback(() => {
    if (!searchTerm.trim()) {
      // 🐛 FIX: Only clear the text search string, do NOT wipe out user's explicit location or manual filters
      setDebouncedSearch('')
      return
    }

    let q = searchTerm.toLowerCase()
    let magicalUpdate = false
    let isSoldContext = false

    const rangeMatch = q.match(/(?:between|from)?\s*(?:rs\.?|inr|₹)?\s*(\d+)\s*(?:to|-|and)\s*(?:rs\.?|inr|₹)?\s*(\d+)/i)
    if (rangeMatch) {
      setPriceRange([parseInt(rangeMatch[1], 10), parseInt(rangeMatch[2], 10)])
      setIsPriceFilterActive(true); magicalUpdate = true; q = q.replace(rangeMatch[0], '')
    } else {
      const underMatch = q.match(/(?:under|below|less than)\s*(?:rs\.?|inr|₹)?\s*(\d+)/i)
      if (underMatch) {
        setPriceRange([0, parseInt(underMatch[1], 10)])
        setIsPriceFilterActive(true); magicalUpdate = true; q = q.replace(underMatch[0], '')
      } else {
        const overMatch = q.match(/(?:over|above|more than)\s*(?:rs\.?|inr|₹)?\s*(\d+)/i)
        if (overMatch) {
          setPriceRange([parseInt(overMatch[1], 10), maxCatalogPrice])
          setIsPriceFilterActive(true); magicalUpdate = true; q = q.replace(overMatch[0], '')
        }
      }
    }

    const karatMatch = q.match(/\b(24|22|18|14|10|9)\s*(?:k|karat|ct|carats?|karats?)\b/i)
    if (karatMatch) {
      const kVal = karatMatch[1] + "K"
      setFilterPurity(prev => { if (!prev.includes(kVal)) { magicalUpdate = true; return [...prev, kVal]; } return prev; });
      q = q.replace(karatMatch[0], '')
    }

    const clarityMatch = q.match(/\b(VVS|VS|VVS-VS|VVS1|VVS2|VS1|VS2|SI|SI1|SI2|I1|I2|I3)\b/i)
    if (clarityMatch) {
      const cVal = clarityMatch[1].toUpperCase()
      setFilterClarity(prev => { if (!prev.includes(cVal)) { magicalUpdate = true; return [...prev, cVal]; } return prev; });
      q = q.replace(clarityMatch[0], '')
    }

    setFilterStatus(prev => {
      let updated = [...prev]; let changed = false;
      const statusMap = [
        { words: ['in stock', 'available', 'instock'], id: 'in_stock' },
        { words: ['sold', 'delivered', 'archive'], id: 'sold' },
        { words: ['repair', 'repairs', 'fixing'], id: 'repairs' },
        { words: ['exchange', 'exchanged', 'buyback', 'buybacks'], id: 'exchanged' },
        { words: ['transit', 'in transit'], id: 'transit' }
      ]
      for (const s of statusMap) {
        for (const word of s.words) {
          const regex = new RegExp(`\\b${word}\\b`, 'gi')
          if (regex.test(q)) {
            if (!updated.includes(s.id)) { updated.push(s.id); changed = true; magicalUpdate = true; }
            if (s.id === 'sold') isSoldContext = true; 
            q = q.replace(regex, '')
          }
        }
      }
      return changed ? updated : prev
    })

    for (const w of warehouses) {
      const wName = w.name.toLowerCase();
      const keys = wName.replace(/(branch|main office|jewellers)/g, '').trim().split(' ').filter((k: string) => k.length > 3);
      if (wName.includes('ghaktopar')) keys.push('ghatkopar');
      if (wName.includes('dombivali')) keys.push('dombivli');
      if (wName.includes('andheri')) keys.push('andheri');
      if (wName.includes('pavitran')) keys.push('pavitram');

      const matchedKey = keys.find((k: string) => new RegExp(`\\b${k}\\b`, 'i').test(q));
      if (matchedKey) {
        if (w.id !== selectedLocation) { setSelectedLocation(w.id); magicalUpdate = true; }
        q = q.replace(new RegExp(`\\b${matchedKey}\\b`, 'gi'), '');
        break;
      }
    }

    setFilterCategory(prev => {
      let updated = [...prev]; let changed = false;
      const catMappings: Record<string, string[]> = {
        'PENDANT': ['pendant', 'pendants'],
        'BANGLE': ['bangle', 'bangles'],
        'BRACELET': ['bracelet', 'bracelets'],
        'TANMANIA': ['tanmania', 'tanmanias'],
        'NOSEPIN': ['nosepin', 'nosepins', 'nose pin', 'nose pins'],
        'TOPS': ['top', 'tops', 'earring', 'earrings'],
        'NECKLACE SET': ['necklace', 'necklaces', 'set', 'sets'],
        'LADIES RING': ['ring', 'rings', 'ladies ring'],
        'GENTS RING': ['ring', 'rings', 'gents ring', 'mens ring'],
        'GENTS STUD': ['stud', 'studs']
      }
      for (const [dbCategory, aliases] of Object.entries(catMappings)) {
        for (const alias of aliases) {
          const regex = new RegExp(`\\b${alias}\\b`, 'gi')
          if (regex.test(q)) {
            if (alias === 'ring' || alias === 'rings') {
              if (q.includes('gent') || q.includes('men')) { if (!updated.includes('GENTS RING')) { updated.push('GENTS RING'); changed = true; magicalUpdate = true; } }
              else if (q.includes('lad') || q.includes('women')) { if (!updated.includes('LADIES RING')) { updated.push('LADIES RING'); changed = true; magicalUpdate = true; } }
              else {
                if (!updated.includes('GENTS RING')) { updated.push('GENTS RING'); changed = true; magicalUpdate = true; }
                if (!updated.includes('LADIES RING')) { updated.push('LADIES RING'); changed = true; magicalUpdate = true; }
              }
            } else {
              if (!updated.includes(dbCategory)) { updated.push(dbCategory); changed = true; magicalUpdate = true; }
            }
            q = q.replace(regex, '')
          }
        }
      }
      return changed ? updated : prev
    })

    if (magicalUpdate) toast.success("✨ AI Search extracted your parameters & applied filters!")
    if (isSoldContext) setActiveTab("sold")

    const cleanSearch = q.replace(/\b(in|at|from|find|show|me|the|all|branch|store|where|are|with|price|cost|under|over|above|below)\b/gi, '').replace(/\s+/g, ' ').trim()
    setDebouncedSearch(cleanSearch)

  }, [searchTerm, warehouses, selectedLocation, uniqueCategories, maxCatalogPrice, isHQ, setSelectedLocation])

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault(); executeSmartSearch();
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => { executeSmartSearch() }, 1500)
    return () => clearTimeout(timer)
  }, [searchTerm, executeSmartSearch])

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedPriceRange(priceRange), 500)
    return () => clearTimeout(timer)
  }, [priceRange])

  useEffect(() => {
    const fetchInitialData = async () => {
      if (!appUser) return
      try {
        const { data: profile } = await supabase.from('profiles').select('role').eq('id', appUser.user_id || appUser.id).maybeSingle()
        if (profile) setUserRole(profile.role)

        const { data: whData } = await supabase.from('warehouses').select('*').eq('company_id', appUser.company_id).eq('is_active', true).order('name')
        if (whData && whData.length > 0) {
          setWarehouses(whData)
          if (!selectedLocation && isHQ) setSelectedLocation(whData[0].id)
        }

        const { data: companyData } = await supabase.from('companies').select('current_rate_24k, current_rate_diamond').eq('id', appUser.company_id).maybeSingle()
        if (companyData) {
          if (companyData.current_rate_24k) setBase24kRate(companyData.current_rate_24k)
          if (companyData.current_rate_diamond) setCalcParams(prev => ({ ...prev, diamondRatePerCt: companyData.current_rate_diamond }))
        }
      } catch (err) { toast.error('Error loading initial data') }
    }
    fetchInitialData()
  }, [appUser, isHQ, selectedLocation, setSelectedLocation])

  useEffect(() => {
    if (!appUser) return;
    const fetchCounts = async () => {
      let activeQuery = supabase.from('inventory_items').select('*', { count: 'exact', head: true }).eq('company_id', appUser.company_id)
      
      if (selectedLocation !== 'ALL') activeQuery = activeQuery.eq('warehouse_id', selectedLocation)
      if (debouncedSearch) activeQuery = activeQuery.or(`barcode.ilike.%${debouncedSearch}%,sku_reference.ilike.%${debouncedSearch}%,item_category.ilike.%${debouncedSearch}%`)
      if (filterCategory.length > 0) activeQuery = activeQuery.in('item_category', filterCategory)
      if (filterPurity.length > 0) activeQuery = activeQuery.in('purity_karat', filterPurity)
      if (filterClarity.length > 0) activeQuery = activeQuery.in('diamond_clarity', filterClarity)
      
      if (filterStatus.length > 0) {
        const validStatuses = filterStatus.filter(s => s !== 'repairs' && s !== 'exchanged');
        let orStrings = [];
        if (validStatuses.length > 0) orStrings.push(`status.in.(${validStatuses.join(',')})`);
        if (filterStatus.includes('exchanged')) orStrings.push(`is_exchanged.eq.true`);
        if (orStrings.length > 0) activeQuery = activeQuery.or(orStrings.join(','));
      } else {
        activeQuery = activeQuery.in('status', ['in_stock', 'transit'])
      }

      if (isPriceFilterActive && debouncedPriceRange[0] > 0) activeQuery = activeQuery.gte('mrp', debouncedPriceRange[0])
      if (isPriceFilterActive && debouncedPriceRange[1] < maxCatalogPrice) activeQuery = activeQuery.lte('mrp', debouncedPriceRange[1])

      const { count: activeCount } = await activeQuery
      if (activeCount !== null) setGlobalTotalCount(activeCount)

      let soldQuery = supabase.from('inventory_items').select('*', { count: 'exact', head: true }).eq('company_id', appUser.company_id)
      
      if (filterStatus.includes('sold')) {
        soldQuery = soldQuery.in('status', ['sold', 'delivered'])
      } else {
        soldQuery = soldQuery.in('status', ['sold', 'delivered'])
      }
      
      if (selectedLocation !== 'ALL') soldQuery = soldQuery.eq('warehouse_id', selectedLocation)
      if (debouncedSearch) soldQuery = soldQuery.or(`barcode.ilike.%${debouncedSearch}%,sku_reference.ilike.%${debouncedSearch}%,item_category.ilike.%${debouncedSearch}%`)
      if (filterCategory.length > 0) soldQuery = soldQuery.in('item_category', filterCategory)
      if (filterPurity.length > 0) soldQuery = soldQuery.in('purity_karat', filterPurity)
      if (isPriceFilterActive && debouncedPriceRange[0] > 0) soldQuery = soldQuery.gte('mrp', debouncedPriceRange[0])
      if (isPriceFilterActive && debouncedPriceRange[1] < maxCatalogPrice) soldQuery = soldQuery.lte('mrp', debouncedPriceRange[1])

      const { count: soldCount } = await soldQuery
      if (soldCount !== null) setGlobalSoldCount(soldCount)
    }
    fetchCounts()
  }, [appUser, selectedLocation, debouncedSearch, filterCategory, filterPurity, filterStatus, debouncedPriceRange, maxCatalogPrice, isPriceFilterActive])

  const fetchItems = async () => {
    if (!appUser || !selectedLocation) return
    setLoading(true)
    try {
      let invQuery = supabase.from('inventory_items')
        .select(`*, custom_orders (id, order_number, origin:origin_warehouse_id(name)), karigars:karigar_id (full_name, karigar_code), created_from_job_bag:job_bags (karigar_id, karigars:karigar_id (full_name, karigar_code))`)
        .eq('company_id', appUser.company_id).limit(2500)
      
      if (selectedLocation !== 'ALL') invQuery = invQuery.eq('warehouse_id', selectedLocation)
      if (debouncedSearch) invQuery = invQuery.or(`barcode.ilike.%${debouncedSearch}%,sku_reference.ilike.%${debouncedSearch}%`)

      let repQuery = supabase.from('repair_tickets').select(`*, origin:warehouses!repair_tickets_origin_warehouse_id_fkey(name)`).eq('company_id', appUser.company_id)
      if (debouncedSearch) repQuery = repQuery.or(`ticket_number.ilike.%${debouncedSearch}%,item_description.ilike.%${debouncedSearch}%`)

      const [invRes, repRes] = await Promise.all([invQuery, repQuery])
      if (invRes.error) throw invRes.error
      if (repRes.error) throw repRes.error

      const inventoryList = (invRes.data || []).map(item => ({ ...item, _type: 'inventory' as const, is_repair_ticket: false }))
      const repairList = (repRes.data || []).map(rep => ({
        id: rep.id, _type: 'repair' as const, barcode: rep.ticket_number, sku_reference: 'REPAIR TICKET', item_category: rep.item_description || 'Repair Service',
        item_size: 'N/A', metal_type: 'Mixed', purity_karat: rep.purity || 'N/A', purity_percent: 0, gross_weight_g: rep.gross_weight_g || 0, 
        net_weight_g: rep.issued_gold_g || 0, total_stone_weight_cts: rep.issued_diamond_cts || 0, total_stone_pieces: 0, solitaire_weight_cts: 0, solitaire_pieces: 0, melee_weight_cts: 0,
        melee_pieces: 0, color_stone_weight_cts: 0, color_stone_pieces: 0, mrp: rep.actual_cost || 0, status: rep.status,
        warehouse_id: rep.status === 'fixed_ready_for_dispatch' && warehouses.find(w => w.name.includes('HQ'))?.id ? warehouses.find(w => w.name.includes('HQ'))?.id || rep.origin_warehouse_id : rep.origin_warehouse_id, 
        is_exchanged: false, is_custom_order: false, is_repair_ticket: true, custom_order_id: null, origin_name: rep.origin?.name || 'Unknown Branch', 
        karigars: null, created_from_job_bag: null, huid_code: null, hsn_code: '9987', image_url: rep.condition_photo_url || null, remarks: rep.issue_description || '', metal_color: 'N/A', diamond_shape: rep.stone_shape || null, diamond_color: null,
        diamond_clarity: null, cost_metal: 0, cost_stone: 0, cost_making: rep.labor_charges || 0, cost_total: rep.actual_cost || 0, wastage_weight_g: 0,
        created_at: rep.created_at, updated_at: rep.updated_at, expected_delivery_date: rep.expected_delivery_date, last_status_change_at: rep.updated_at,
        audit_history: null 
      }))

      const filteredRepairs = selectedLocation === 'ALL' ? repairList : repairList.filter(r => r.warehouse_id === selectedLocation || (r.status === 'fixed_ready_for_dispatch' && isHQ));
      const combined = [...inventoryList, ...filteredRepairs].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      setItems(combined)

      if (!debouncedSearch && filterCategory.length === 0 && filterPurity.length === 0 && !isPriceFilterActive) {
        const highestPrice = Math.max(...combined.map(c => c.mrp || 0), 100000);
        setMaxCatalogPrice(highestPrice);
        setPriceRange([0, highestPrice]);
      }

    } catch (error) { toast.error('Failed to load inventory') } 
    finally { setLoading(false) }
  }

  useEffect(() => { fetchItems() }, [appUser, selectedLocation, debouncedSearch])

  const handleSelectAllGlobal = async () => {
    if (!appUser) return;
    setIsFetchingGlobal(true)
    try {
      let allFetchedData: any[] = [];
      let start = 0; const limit = 1000; let hasMore = true;

      while (hasMore) {
        let globalQuery = supabase.from('inventory_items')
          .select('id, barcode, sku_reference, item_category, metal_type, purity_karat, purity_percent, gross_weight_g, net_weight_g, total_stone_weight_cts, mrp, status, warehouse_id, is_exchanged, diamond_shape, diamond_color, diamond_clarity, audit_history')
          .eq('company_id', appUser.company_id).range(start, start + limit - 1)
        
        if (selectedLocation !== 'ALL') globalQuery = globalQuery.eq('warehouse_id', selectedLocation)
        if (debouncedSearch) globalQuery = globalQuery.or(`barcode.ilike.%${debouncedSearch}%,sku_reference.ilike.%${debouncedSearch}%,item_category.ilike.%${debouncedSearch}%`)
        if (filterCategory.length > 0) globalQuery = globalQuery.in('item_category', filterCategory)
        if (filterPurity.length > 0) globalQuery = globalQuery.in('purity_karat', filterPurity)
        
        if (filterStatus.length > 0) {
          const validStatuses = filterStatus.filter(s => s !== 'repairs' && s !== 'exchanged');
          let orStrings = [];
          if (validStatuses.length > 0) orStrings.push(`status.in.(${validStatuses.join(',')})`);
          if (filterStatus.includes('exchanged')) orStrings.push(`is_exchanged.eq.true`);
          if (orStrings.length > 0) globalQuery = globalQuery.or(orStrings.join(','));
        } else {
          globalQuery = globalQuery.in('status', ['in_stock', 'transit'])
        }

        if (isPriceFilterActive && debouncedPriceRange[0] > 0) globalQuery = globalQuery.gte('mrp', debouncedPriceRange[0])
        if (isPriceFilterActive && debouncedPriceRange[1] < maxCatalogPrice) globalQuery = globalQuery.lte('mrp', debouncedPriceRange[1])

        const { data, error } = await globalQuery
        if (error) throw error

        if (data && data.length > 0) allFetchedData = [...allFetchedData, ...data];
        if (!data || data.length < limit) hasMore = false; else start += limit;
      }

      const existingIds = new Set(items.map(i => i.id))
      const newItems = allFetchedData.filter(d => !existingIds.has(d.id)).map(d => ({ ...d, _type: 'inventory' as const, is_repair_ticket: false } as InventoryItem))
      if (newItems.length > 0) setItems(prev => [...prev, ...newItems])
      
      setSelectedIds(allFetchedData.map(item => item.id))
      toast.success(`Selected all ${allFetchedData.length} items matching your filters.`)
    } catch (error) {
      toast.error("Failed to fetch global database items.")
    } finally {
      setIsFetchingGlobal(false)
    }
  }

  const { activeItemsFiltered, soldItemsFiltered } = useMemo(() => {
    let active = [], sold = [];
    for (const item of items) {
      const isSold = item.status === 'sold' || item.status === 'delivered';
      
      if (debouncedSearch) {
        const q = debouncedSearch.toLowerCase()
        if (!(item.barcode?.toLowerCase().includes(q) || item.sku_reference?.toLowerCase().includes(q))) continue;
      }

      if (filterCategory.length > 0 && !filterCategory.includes(item.item_category)) continue;
      if (filterPurity.length > 0 && !filterPurity.includes(item.purity_karat)) continue;
      
      // ✨ BULLETPROOF CLARITY FILTER
      if (filterClarity.length > 0) {
        const itemClarity = item.diamond_clarity ? item.diamond_clarity.trim().toUpperCase() : "";
        if (!itemClarity || !filterClarity.includes(itemClarity)) {
          continue; // Skip this item if it doesn't match the selected clarities
        }
      }
      
      if (filterStatus.length > 0) {
        let match = false;
        if (filterStatus.includes('repairs') && item._type === 'repair') match = true;
        if (filterStatus.includes('exchanged') && item.is_exchanged) match = true;
        if (filterStatus.includes(item.status)) match = true;
        if (!match) continue;
      }

      if (isPriceFilterActive && ((item.mrp || 0) < priceRange[0] || (item.mrp || 0) > priceRange[1])) continue;

      if (isSold) sold.push(item); else active.push(item);
    }
    return { activeItemsFiltered: active, soldItemsFiltered: sold }
    
  // ✨ CRITICAL FIX: filterClarity MUST be in this array below for React to update the table instantly
  }, [items, debouncedSearch, filterCategory, filterPurity, filterStatus, priceRange, isPriceFilterActive, filterClarity]);
  
  const toggleArrayItem = (arr: string[], setArr: any, item: string) => {
    if (arr.includes(item)) setArr(arr.filter((i: string) => i !== item));
    else setArr([...arr, item]);
  }

  const clearAllFilters = () => {
    setFilterCategory([]); setFilterPurity([]); setFilterStatus([]);setFilterClarity([]);
    setIsPriceFilterActive(false); setPriceRange([0, maxCatalogPrice]); 
    setSearchTerm(""); setDebouncedSearch("");
    setActiveTab("active");
    // 🐛 FIX: Removed location reset here so it stays persistent
  }

  const handleSaveMrp = async (id: string) => { 
    if (!canEdit) return toast.error("Unauthorized to edit prices");
    const item = items.find(i => i.id === id);
    if (!item) return;

    const newMrp = editingMrpVal ? Number(editingMrpVal) : null;

    if (item._type === 'repair') {
      const { error } = await supabase.from('repair_tickets').update({ actual_cost: newMrp }).eq('id', id);
      if (error) return toast.error('Failed to update repair cost');
    } else {
      const { error } = await supabase.from('inventory_items').update({ mrp: newMrp }).eq('id', id);
      if (error) return toast.error('Failed to update price');
    }
    
    setItems(items.map(i => i.id === id ? { ...i, mrp: newMrp } : i))
    setEditingId(null)
    toast.success('Price updated')
  }

  const handleOpenWeightEdit = (item: InventoryItem) => {
    if (!canEdit) return toast.error("Unauthorized to edit master weights");
    setEditWeightItem(item);
    
    const { aggWt } = getStoneTotals(item);
    
    setWeightForm({
      gross: item.gross_weight_g?.toString() || '0',
      net: item.net_weight_g?.toString() || '0',
      stone: aggWt.toString() || '0',
      // ✨ ADDED: Load existing diamond details
      diamond_clarity: item.diamond_clarity || '',
      diamond_color: item.diamond_color || '',
      diamond_shape: item.diamond_shape || '',
      reason: ''
    });
  }

  const handleSaveWeights = async () => {
    if (!editWeightItem || !appUser) return;
    if (!weightForm.reason.trim()) return toast.error("Reason is required for the audit log.");

    const newGross = parseFloat(weightForm.gross);
    const newNet = parseFloat(weightForm.net);
    const newStone = parseFloat(weightForm.stone);

    if (isNaN(newGross) || isNaN(newNet) || isNaN(newStone)) return toast.error("Invalid weight values entered.");
    if (newNet <= 0 || newGross <= 0) return toast.error("Gross and Net weights must be greater than 0.");
    if (newGross < newNet) return toast.error("Gross weight cannot be less than Net weight.");

    setIsSavingWeights(true);

    try {
      const currentStone = getStoneTotals(editWeightItem).aggWt;
      
      // ✨ NEW: Clean the diamond inputs
      const dClarity = weightForm.diamond_clarity.trim() || null;
      const dColor = weightForm.diamond_color.trim() || null;
      const dShape = weightForm.diamond_shape.trim() || null;

      const newLogEntry: AuditLogEntry = {
        timestamp: new Date().toISOString(),
        user_name: appUser.full_name || 'System User',
        reason: weightForm.reason.trim(),
        // ✨ NEW: Audit log now tracks diamond clarity changes
        changes: `Gross: ${editWeightItem.gross_weight_g}g ➝ ${newGross}g | Net: ${editWeightItem.net_weight_g}g ➝ ${newNet}g | Stone: ${currentStone}ct ➝ ${newStone}ct | Clarity: ${editWeightItem.diamond_clarity || 'None'} ➝ ${dClarity || 'None'}`
      };

      const currentHistory = Array.isArray(editWeightItem.audit_history) ? editWeightItem.audit_history : [];
      const updatedHistory = [newLogEntry, ...currentHistory];

      if (editWeightItem._type === 'repair') {
         toast.error("Weight editing for repairs is not supported in this view.");
         setIsSavingWeights(false);
         return;
      }

      const { error } = await supabase.from('inventory_items').update({
        gross_weight_g: newGross,
        net_weight_g: newNet,
        total_stone_weight_cts: newStone,
        solitaire_weight_cts: 0, 
        melee_weight_cts: 0,
        // ✨ NEW: Save diamond specs to DB
        diamond_clarity: dClarity,
        diamond_color: dColor,
        diamond_shape: dShape,
        audit_history: updatedHistory,
        updated_by: appUser.user_id || appUser.id
      }).eq('id', editWeightItem.id);

      if (error) throw error;

      setItems(items.map(i => i.id === editWeightItem.id ? { 
        ...i, 
        gross_weight_g: newGross, 
        net_weight_g: newNet, 
        total_stone_weight_cts: newStone,
        solitaire_weight_cts: 0,
        melee_weight_cts: 0,
        // ✨ NEW: Update Local UI State
        diamond_clarity: dClarity,
        diamond_color: dColor,
        diamond_shape: dShape,
        audit_history: updatedHistory
      } : i));

      toast.success("Details & Audit Log updated successfully");
      setEditWeightItem(null);
    } catch (e: any) {
      toast.error(e.message || "Failed to update item details");
    } finally {
      setIsSavingWeights(false);
    }
  }
  
  const handleOpenCalc = () => {
    if (!canEdit) return toast.error("Unauthorized to use bulk calculator");
    const selectedItems = items.filter(i => selectedIds.includes(i.id) && i._type === 'inventory')
    if (selectedItems.length === 0) return toast.error("No valid items selected.", { description: "Repairs cannot be bulk-calculated. Select standard inventory." })

    const uniqueKarats = Array.from(new Set(selectedItems.map(i => i.purity_karat || '24K')))
    const initialRates: Record<string, number> = {}
    uniqueKarats.forEach(k => {
      const kNum = parseInt(k.replace(/\D/g, '')) || 24
      initialRates[k] = Math.round(base24kRate * (kNum / 24))
    })
    setGoldRates(initialRates)

    // ✨ FIX: Strip spaces and standardize to uppercase to prevent duplicate 'SI' keys
    const rawClarities = selectedItems.map(i => i.diamond_clarity);
    const uniqueClarities = Array.from(new Set(
      rawClarities.map(c => (c ? c.trim().toUpperCase() : 'DEFAULT'))
    ));
    
    const initialDiamondRates: Record<string, number> = {}
    uniqueClarities.forEach(clarity => {
      initialDiamondRates[clarity] = calcParams.diamondRatePerCt 
    })
    setDiamondRates(initialDiamondRates)

    setCalcStep('params')
    setCalcModalOpen(true)
  }
  
  const handleGeneratePreview = () => {
    const selectedItems = items.filter(i => selectedIds.includes(i.id) && i._type === 'inventory')
    const previews = selectedItems.map(item => {
      const k = item.purity_karat || '24K'
      const gRate = goldRates[k] || 0
      const goldCost = (item.net_weight_g || 0) * gRate
      
      // ✨ NEW: Apply specific diamond rate
      const dClarity = item.diamond_clarity || 'Default'
      const dRate = diamondRates[dClarity] || calcParams.diamondRatePerCt
      const diamondCost = (item.total_stone_weight_cts || 0) * dRate

      const baseCost = goldCost + diamondCost
      const markupAmount = baseCost * (calcParams.markupPercent / 100)
      const subtotal = baseCost + markupAmount
      
      const exactMrp = subtotal + calcParams.flatCharge
      
      // ✨ NEW: Round UP to the nearest target (e.g., nearest 50). Never subtracts.
      // e.g., 11512 / 50 = 230.24 -> ceil(230.24) = 231 -> 231 * 50 = 11550
      const roundTarget = calcParams.roundUpTo || 10;
      const finalMrp = Math.ceil(exactMrp / roundTarget) * roundTarget;
      
      return { ...item, newMrp: finalMrp }
    })
    setPreviewData(previews)
    setCalcStep('preview')
  }

  const handleApplyBulkMrp = async () => {
    setIsCalculating(true)
    try {
      await Promise.all(previewData.map(p => supabase.from('inventory_items').update({ mrp: p.newMrp }).eq('id', p.id)))
      setItems(prev => prev.map(item => {
        const update = previewData.find(px => px.id === item.id)
        return update ? { ...item, mrp: update.newMrp } : item
      }))
      toast.success(`Successfully applied new MRP to ${previewData.length} items.`)
      setCalcModalOpen(false)
      setSelectedIds([]) 
    } catch (e) {
      toast.error("Failed to update inventory.")
    } finally {
      setIsCalculating(false)
    }
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, itemId: string, itemType: string) => {
    if (!canEdit) return toast.error("Unauthorized to update images");
    const file = e.target.files?.[0]
    if (!file || !appUser) return

    setIsUploadingImage(true)
    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `${itemId}-${Date.now()}.${fileExt}`
      const filePath = `${appUser.company_id}/${fileName}`

      const { error: uploadError } = await supabase.storage.from('inventory-images').upload(filePath, file)
      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage.from('inventory-images').getPublicUrl(filePath)

      if (itemType === 'repair') {
        const { error: dbErr } = await supabase.from('repair_tickets').update({ condition_photo_url: publicUrl }).eq('id', itemId)
        if (dbErr) throw dbErr
      } else {
        const { error: dbErr } = await supabase.from('inventory_items').update({ image_url: publicUrl }).eq('id', itemId)
        if (dbErr) throw dbErr
      }

      setItems(prev => prev.map(i => i.id === itemId ? { ...i, image_url: publicUrl } : i))
      if (viewItem && viewItem.id === itemId) setViewItem({ ...viewItem, image_url: publicUrl })
      
      toast.success("Image updated successfully!")
    } catch (error: any) {
      toast.error(error.message || "Failed to upload image")
    } finally {
      setIsUploadingImage(false)
      e.target.value = '' 
    }
  }

  const handleSingleTransfer = (item: InventoryItem) => router.push(`/transfer/new?ids=${item.id}&from=${item.warehouse_id}`)
  
  const handleBulkTransfer = () => {
    if (selectedIds.length === 0) return
    const whIds = new Set(items.filter(i => selectedIds.includes(i.id)).map(i => i.warehouse_id))
    if (whIds.size > 1) return toast.error("Items must be from same warehouse.")
    router.push(`/transfer/new?ids=${selectedIds.join(',')}&from=${Array.from(whIds)[0]}`)
  }

  if (!appUser) return null

  return (
    <div className="flex flex-col min-h-screen bg-[#fafafa] font-sans selection:bg-indigo-100 pb-20">
      
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes geminiGlow { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }
        .gemini-bg { background: linear-gradient(90deg, #4285F4, #9b72cb, #d96570, #4285F4); background-size: 300% 100%; animation: geminiGlow 6s linear infinite; }
      `}} />

      {/* HEADER */}
      <header className="h-14 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center sticky top-0 z-40 shadow-sm box-border">
        <div className="w-full max-w-7xl mx-auto flex justify-between items-center gap-4">
          <div className="flex items-center gap-2.5">
            <div className="h-7 w-7 bg-emerald-50 border border-emerald-100 text-emerald-600 flex items-center justify-center rounded text-xs shadow-sm">
              <Package className="w-3.5 h-3.5" />
            </div>
            <h1 className="text-sm font-semibold text-slate-900 tracking-tight leading-none hidden sm:block">Vault Inventory</h1>
          </div>
          <div className="flex items-center gap-2">
            {/* ✨ NEW: Admin Buttons */}
            {canEdit && (
              <>
                <Link href="/inventory/import-manual">
                  <Button variant="outline" size="sm" className="h-8 px-3 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border-slate-200 shadow-sm hidden md:flex">
                    <Upload className="w-3.5 h-3.5 mr-1.5 text-slate-500" />
                    Import Manual
                  </Button>
                </Link>
                <Link href="/transfer/direct">
                  <Button size="sm" className="h-8 px-3 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 shadow-sm hidden md:flex">
                    <ArrowRightLeft className="w-3.5 h-3.5 mr-1.5" />
                    Direct Transfer
                  </Button>
                </Link>
                <Link href="/inventory/returns">
                  <Button size="sm" className="h-8 px-3 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 shadow-sm hidden md:flex">
                    <ArrowRightLeft className="w-3.5 h-3.5 mr-1.5" />
                    Returns & Buybacks items
                  </Button>
                </Link>
                <div className="w-px h-4 bg-slate-200 mx-1 hidden md:block" />
              </>
            )}

            <Button variant="ghost" size="sm" className="h-8 px-2 text-xs font-semibold text-slate-500 hover:text-slate-900 hover:bg-slate-100" onClick={fetchItems}>
              <RefreshCw className={`h-3.5 w-3.5 sm:mr-1.5 ${loading ? 'animate-spin text-indigo-500' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="p-4 md:p-6 max-w-7xl w-full mx-auto space-y-6 animate-in fade-in duration-300">
        
        {/* GEMINI SEARCH & SMART FILTERS */}
        <div className="flex flex-col gap-4 w-full">
          
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 w-full">
            
            {/* Clean AI Search Bar */}
            <div className="relative w-full max-w-2xl group">
              <div className="absolute -inset-[2px] rounded-full bg-gradient-to-r from-[#4285F4] via-[#9b72cb] to-[#d96570] blur-md opacity-0 group-focus-within:opacity-20 transition-opacity duration-500"></div>
              
              <div className="relative flex items-center bg-white rounded-full ring-1 ring-slate-200 shadow-sm p-1.5 z-10 transition-all focus-within:ring-0 focus-within:border-transparent">
                <div className="pl-3 pr-2 text-indigo-500">
                  <Sparkles className="w-5 h-5" />
                </div>
                <Input 
                  placeholder="Ask Vault... (e.g. 'show me rings from 5000 to 30000 in Andheri')" 
                  className="flex-1 h-10 border-0 outline-none ring-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 bg-transparent text-[15px] font-medium placeholder:text-slate-400"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  onKeyDown={handleSearchKeyDown}
                />
                <div className="pr-2 flex items-center gap-2">
                  {searchTerm && (
                    <div 
                      className="p-1.5 text-slate-400 hover:text-rose-500 bg-slate-50 hover:bg-rose-50 rounded-full cursor-pointer transition-colors"
                      onClick={() => {
                        setSearchTerm('');
                        setDebouncedSearch('');
                      }}
                      title="Clear Search"
                    >
                      <X className="w-3.5 h-3.5" />
                    </div>
                  )}

                  <Mic className="w-4 h-4 cursor-pointer text-slate-400 hover:text-indigo-500 transition-colors mx-1" />
                  
                  <Button size="sm" variant="ghost" className="h-8 rounded-full text-indigo-600 bg-indigo-50 font-bold px-3 hidden sm:block hover:bg-indigo-100" onClick={executeSmartSearch}>
                    Search
                  </Button>
                </div>
              </div>
            </div>

            {/* Vault Context Selector */}
            <div className="flex flex-col items-end w-full md:w-auto shrink-0 bg-white p-1.5 rounded-2xl border border-slate-200 shadow-sm">
              <Select value={selectedLocation} onValueChange={setSelectedLocation} disabled={isLocked}>
                <SelectTrigger className="h-10 border-none bg-slate-50 hover:bg-slate-100 transition-colors rounded-xl shadow-none text-xs font-bold text-slate-700 w-full md:w-[220px] focus:ring-0">
                  <Store className="w-4 h-4 mr-2 text-indigo-500" />
                  <SelectValue placeholder="Select Location..." />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-slate-200 shadow-xl">
                  {isHQ && <SelectItem value="ALL" className="text-xs font-bold text-indigo-600">All Branches (Global)</SelectItem>}
                  {warehouses.map(w => <SelectItem key={w.id} value={w.id} className="text-xs font-medium">{w.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 relative z-20">
            <div className="text-xs font-bold uppercase tracking-widest text-slate-400 mr-2 flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5" /> Filter By:
            </div>

            <div className="relative">
              <Button variant="outline" size="sm" onClick={() => setOpenDropdown(openDropdown === 'cat' ? null : 'cat')} className={cn("h-8 rounded-full text-xs font-semibold border-slate-200 transition-colors", filterCategory.length > 0 || openDropdown === 'cat' ? "bg-indigo-50 text-indigo-700 border-indigo-200" : "bg-white text-slate-600 hover:bg-slate-50")}>
                Category {filterCategory.length > 0 && <span className="ml-1.5 bg-indigo-600 text-white rounded-full px-1.5 py-0.5 text-[9px]">{filterCategory.length}</span>} <ChevronDown className="w-3 h-3 ml-1.5 opacity-50" />
              </Button>
              {openDropdown === 'cat' && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setOpenDropdown(null)}></div>
                  <div className="absolute top-full left-0 mt-2 w-56 bg-white rounded-xl shadow-2xl border border-slate-100 z-50 p-2 max-h-64 overflow-y-auto animate-in fade-in slide-in-from-top-2">
                    {uniqueCategories.length === 0 ? <p className="text-xs text-slate-400 p-2 text-center">No categories found</p> : uniqueCategories.map(c => (
                      <label key={c} className="flex items-center gap-3 p-2 hover:bg-slate-50 rounded-lg cursor-pointer transition-colors">
                        <Checkbox checked={filterCategory.includes(c)} onCheckedChange={() => toggleArrayItem(filterCategory, setFilterCategory, c)} className="rounded border-slate-300 data-[state=checked]:bg-indigo-600" />
                        <span className="text-xs font-medium text-slate-700">{c}</span>
                      </label>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div className="relative">
              <Button variant="outline" size="sm" onClick={() => setOpenDropdown(openDropdown === 'pur' ? null : 'pur')} className={cn("h-8 rounded-full text-xs font-semibold border-slate-200 transition-colors", filterPurity.length > 0 || openDropdown === 'pur' ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-white text-slate-600 hover:bg-slate-50")}>
                Purity {filterPurity.length > 0 && <span className="ml-1.5 bg-amber-500 text-white rounded-full px-1.5 py-0.5 text-[9px]">{filterPurity.length}</span>} <ChevronDown className="w-3 h-3 ml-1.5 opacity-50" />
              </Button>
              {openDropdown === 'pur' && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setOpenDropdown(null)}></div>
                  <div className="absolute top-full left-0 mt-2 w-48 bg-white rounded-xl shadow-2xl border border-slate-100 z-50 p-2 max-h-64 overflow-y-auto animate-in fade-in slide-in-from-top-2">
                    {uniquePurities.map(p => (
                      <label key={p} className="flex items-center gap-3 p-2 hover:bg-slate-50 rounded-lg cursor-pointer transition-colors">
                        <Checkbox checked={filterPurity.includes(p)} onCheckedChange={() => toggleArrayItem(filterPurity, setFilterPurity, p)} className="rounded border-slate-300 data-[state=checked]:bg-amber-500" />
                        <span className="text-xs font-medium text-slate-700">{p}</span>
                      </label>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div className="relative">
              <Button variant="outline" size="sm" onClick={() => setOpenDropdown(openDropdown === 'stat' ? null : 'stat')} className={cn("h-8 rounded-full text-xs font-semibold border-slate-200 transition-colors", filterStatus.length > 0 || openDropdown === 'stat' ? "bg-rose-50 text-rose-700 border-rose-200" : "bg-white text-slate-600 hover:bg-slate-50")}>
                Lifecycle {filterStatus.length > 0 && <span className="ml-1.5 bg-rose-500 text-white rounded-full px-1.5 py-0.5 text-[9px]">{filterStatus.length}</span>} <ChevronDown className="w-3 h-3 ml-1.5 opacity-50" />
              </Button>
              {openDropdown === 'stat' && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setOpenDropdown(null)}></div>
                  <div className="absolute top-full left-0 mt-2 w-56 bg-white rounded-xl shadow-2xl border border-slate-100 z-50 p-2 animate-in fade-in slide-in-from-top-2">
                    {[
                      { id: 'in_stock', label: 'Available (In Stock)' },
                      { id: 'transit', label: 'In Transit' },
                      { id: 'repairs', label: 'Repairs Only' },
                      { id: 'exchanged', label: 'Buybacks Only' },
                      { id: 'sold', label: 'Sold / Delivered' }
                    ].map(s => (
                      <label key={s.id} className="flex items-center gap-3 p-2 hover:bg-slate-50 rounded-lg cursor-pointer transition-colors">
                        <Checkbox checked={filterStatus.includes(s.id)} onCheckedChange={() => toggleArrayItem(filterStatus, setFilterStatus, s.id)} className="rounded border-slate-300 data-[state=checked]:bg-rose-500" />
                        <span className="text-xs font-medium text-slate-700">{s.label}</span>
                      </label>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* ✨ NEW CLARITY DROPDOWN */}
            <div className="relative">
              <Button variant="outline" size="sm" onClick={() => setOpenDropdown(openDropdown === 'clarity' ? null : 'clarity')} className={cn("h-8 rounded-full text-xs font-semibold border-slate-200 transition-colors", filterClarity.length > 0 || openDropdown === 'clarity' ? "bg-cyan-50 text-cyan-700 border-cyan-200" : "bg-white text-slate-600 hover:bg-slate-50")}>
                Clarity {filterClarity.length > 0 && <span className="ml-1.5 bg-cyan-500 text-white rounded-full px-1.5 py-0.5 text-[9px]">{filterClarity.length}</span>} <ChevronDown className="w-3 h-3 ml-1.5 opacity-50" />
              </Button>
              {openDropdown === 'clarity' && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setOpenDropdown(null)}></div>
                  <div className="absolute top-full left-0 mt-2 w-48 bg-white rounded-xl shadow-2xl border border-slate-100 z-50 p-2 max-h-64 overflow-y-auto animate-in fade-in slide-in-from-top-2">
                    {uniqueClaritiesFilter.map(c => (
                      <label key={c} className="flex items-center gap-3 p-2 hover:bg-slate-50 rounded-lg cursor-pointer transition-colors">
                        <Checkbox checked={filterClarity.includes(c)} onCheckedChange={() => toggleArrayItem(filterClarity, setFilterClarity, c)} className="rounded border-slate-300 data-[state=checked]:bg-cyan-500" />
                        <span className="text-xs font-medium text-slate-700">{c}</span>
                      </label>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div className="relative">
              <Button variant="outline" size="sm" onClick={() => setOpenDropdown(openDropdown === 'price' ? null : 'price')} className={cn("h-8 rounded-full text-xs font-semibold border-slate-200 transition-colors", isPriceFilterActive || openDropdown === 'price' ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-white text-slate-600 hover:bg-slate-50")}>
                Price Range {isPriceFilterActive && <span className="ml-1.5 w-2 h-2 rounded-full bg-emerald-500 block"></span>} <ChevronDown className="w-3 h-3 ml-1.5 opacity-50" />
              </Button>
              {openDropdown === 'price' && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setOpenDropdown(null)}></div>
                  <div className="absolute top-full left-0 mt-2 w-[320px] bg-white rounded-xl shadow-2xl border border-slate-100 z-50 p-5 animate-in fade-in slide-in-from-top-2">
                    <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1 mb-4">
                      <IndianRupee className="w-3 h-3"/> Drag to set range
                    </Label>
                    <div className="flex items-center gap-3 mb-5">
                      <div className="relative flex-1">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">₹</span>
                        <Input type="number" className="h-9 pl-6 text-xs font-mono font-bold bg-slate-50 border-slate-200 rounded-lg" value={priceRange[0]} onChange={e => { setPriceRange([Number(e.target.value), priceRange[1]]); setIsPriceFilterActive(true); }} />
                      </div>
                      <span className="text-slate-300 font-black">-</span>
                      <div className="relative flex-1">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">₹</span>
                        <Input type="number" className="h-9 pl-6 text-xs font-mono font-bold bg-slate-50 border-slate-200 rounded-lg" value={priceRange[1]} onChange={e => { setPriceRange([priceRange[0], Number(e.target.value)]); setIsPriceFilterActive(true); }} />
                      </div>
                    </div>
                    <Slider min={0} max={maxCatalogPrice} step={1000} value={priceRange} onValueChange={(val) => { setPriceRange(val); setIsPriceFilterActive(true); }} className="mt-2 mb-2" />
                    <div className="flex justify-end mt-4">
                      <Button size="sm" variant="ghost" onClick={() => { setIsPriceFilterActive(false); setPriceRange([0, maxCatalogPrice]); setOpenDropdown(null); }} className="h-8 text-[11px] font-bold text-slate-500 hover:text-slate-900">Clear</Button>
                      <Button size="sm" onClick={() => setOpenDropdown(null)} className="h-8 text-[11px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg ml-2">Apply Range</Button>
                    </div>
                  </div>
                </>
              )}
            </div>

            {(filterCategory.length > 0 || filterPurity.length > 0 || filterStatus.length > 0 || isPriceFilterActive || debouncedSearch) && (
              <Button variant="ghost" size="sm" onClick={clearAllFilters} className="h-8 rounded-full text-xs font-bold text-slate-400 hover:text-red-600 hover:bg-red-50 ml-auto transition-colors z-10">
                Clear All
              </Button>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            {filterCategory.map(c => (
              <Badge key={`cat-${c}`} className="bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border-indigo-100 rounded-full px-3 py-1 flex items-center gap-1.5 text-[11px] font-semibold transition-all shadow-none">
                {c} <X className="w-3 h-3 cursor-pointer hover:text-indigo-900" onClick={() => toggleArrayItem(filterCategory, setFilterCategory, c)} />
              </Badge>
            ))}
            {filterPurity.map(p => (
              <Badge key={`pur-${p}`} className="bg-amber-50 text-amber-700 hover:bg-amber-100 border-amber-100 rounded-full px-3 py-1 flex items-center gap-1.5 text-[11px] font-semibold transition-all shadow-none">
                {p} <X className="w-3 h-3 cursor-pointer hover:text-amber-900" onClick={() => toggleArrayItem(filterPurity, setFilterPurity, p)} />
              </Badge>
            ))}
            
            {filterStatus.map(s => (
              <Badge key={`stat-${s}`} className="bg-rose-50 text-rose-700 hover:bg-rose-100 border-rose-100 rounded-full px-3 py-1 flex items-center gap-1.5 text-[11px] font-semibold transition-all shadow-none">
                {s.replace(/_/g, ' ')} <X className="w-3 h-3 cursor-pointer hover:text-rose-900" onClick={() => toggleArrayItem(filterStatus, setFilterStatus, s)} />
              </Badge>
            ))}
            {isPriceFilterActive && (
              <Badge className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-100 rounded-full px-3 py-1 flex items-center gap-1.5 text-[11px] font-semibold transition-all shadow-none font-mono">
                ₹{priceRange[0].toLocaleString()} - ₹{priceRange[1].toLocaleString()} 
                <X className="w-3 h-3 cursor-pointer hover:text-emerald-900" onClick={() => { setIsPriceFilterActive(false); setPriceRange([0, maxCatalogPrice]); }} />
              </Badge>
            )}
          </div>

        </div>

        {/* TABS & TABLE CARD */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="bg-transparent border-b border-slate-200 rounded-none h-11 w-full justify-start p-0 gap-6 mb-2">
            <TabsTrigger value="active" className="rounded-none border-b-2 border-transparent data-[state=active]:border-indigo-600 data-[state=active]:text-indigo-600 data-[state=active]:bg-transparent shadow-none h-full px-1 text-xs font-bold uppercase tracking-widest text-slate-500 transition-all hover:text-slate-800">
              Live Stock <span className="ml-1.5 px-2 py-0.5 rounded-full bg-slate-100 text-[10px] text-slate-600">{Math.max(globalTotalCount, activeItemsFiltered.length)}</span>
            </TabsTrigger>
            <TabsTrigger value="sold" className="rounded-none border-b-2 border-transparent data-[state=active]:border-slate-800 data-[state=active]:bg-transparent shadow-none h-full px-1 text-xs font-bold uppercase tracking-widest text-slate-400 hover:text-slate-600 data-[state=active]:text-slate-800 transition-all">
              Archive / Sold <span className="ml-1.5 px-2 py-0.5 rounded-full bg-slate-100 text-[10px] text-slate-600">{Math.max(globalSoldCount, soldItemsFiltered.length)}</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="active">
             <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden min-h-[400px] relative">
                {loading && <GeminiLoader />}
                <InventoryTable data={activeItemsFiltered} warehouses={warehouses} selectedIds={selectedIds} setSelectedIds={setSelectedIds} editingMrpId={editingMrpId} setEditingId={setEditingId} editingMrpVal={editingMrpVal} setEditingMrpVal={setEditingMrpVal} handleSaveMrp={handleSaveMrp} handleOpenWeightEdit={handleOpenWeightEdit} setTagItem={setTagItem} handleSingleTransfer={handleSingleTransfer} setViewItem={setViewItem} canEdit={canEdit} />
             </div>
          </TabsContent>

          <TabsContent value="sold">
             <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden min-h-[400px] relative">
                {loading && <GeminiLoader />}
                <InventoryTable data={soldItemsFiltered} warehouses={warehouses} isSoldTab selectedIds={[]} setSelectedIds={()=>{}} editingMrpId={null} setEditingId={()=>{}} editingMrpVal="" setEditingMrpVal={()=>{}} handleSaveMrp={async()=>{}} handleOpenWeightEdit={()=>{}} setTagItem={setTagItem} handleSingleTransfer={()=>{}} setViewItem={setViewItem} canEdit={canEdit} />
             </div>
          </TabsContent>
        </Tabs>

        {/* FLOATING BULK BAR */}
        {selectedIds.length > 0 && (
          <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white p-1.5 rounded-[1.25rem] shadow-2xl flex items-center gap-2 border border-slate-700/50 animate-in slide-in-from-bottom-8">
            <div className="flex items-center gap-2 pl-3 pr-4 border-r border-slate-700">
              <div className="h-7 w-7 bg-indigo-500 rounded-lg flex items-center justify-center text-[11px] font-bold shadow-inner">
                {selectedIds.length}
              </div>
              <span className="text-xs font-medium text-slate-300 whitespace-nowrap">Selected</span>
            </div>
            
            <div className="flex items-center gap-1 pr-1">
              {globalTotalCount > activeItemsFiltered.length && selectedIds.length === activeItemsFiltered.length ? (
                <Button 
                  size="sm" 
                  onClick={handleSelectAllGlobal} 
                  disabled={isFetchingGlobal}
                  className="h-8 px-3 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-sm transition-none"
                >
                  {isFetchingGlobal ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Database className="w-3.5 h-3.5 mr-1.5" />}
                  Select all {globalTotalCount} items in Database
                </Button>
              ) : (
                <Button 
                  size="sm" 
                  onClick={() => setSelectedIds(activeItemsFiltered.map(i => i.id))} 
                  className="h-8 px-3 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-white rounded-xl shadow-sm transition-none hidden sm:flex"
                >
                  <CheckSquare className="w-3.5 h-3.5 mr-1.5 text-indigo-400" /> Select Loaded ({activeItemsFiltered.length})
                </Button>
              )}

              {canEdit && (
                <>
                  <Button size="sm" onClick={handleOpenCalc} className="h-8 px-4 text-xs font-semibold bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl shadow-sm transition-none whitespace-nowrap border border-emerald-400/50">
                    <Calculator className="w-3.5 h-3.5 mr-1.5" /> Calc MRP
                  </Button>
                  
                  <Button size="sm" onClick={handleBulkPrint} className="h-8 px-4 text-xs font-semibold bg-blue-500 hover:bg-blue-600 text-white rounded-xl shadow-sm transition-none whitespace-nowrap border border-blue-400/50">
                    <Printer className="w-3.5 h-3.5 mr-1.5" /> Print Tags
                  </Button>
                </>
              )}
              
              <Button size="sm" onClick={handleBulkTransfer} className="h-8 px-4 text-xs font-semibold bg-white text-slate-900 hover:bg-slate-100 rounded-xl shadow-sm transition-none whitespace-nowrap">
                <Truck className="w-3.5 h-3.5 mr-1.5" /> Transfer
              </Button>
              
              <Button size="icon" variant="ghost" onClick={() => setSelectedIds([])} className="h-8 w-8 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl ml-1 transition-none shrink-0">
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </main>

      {/* HIDDEN BULK PRINT CONTAINER */}
      <div className="hidden">
        <div ref={printRef} className="print:p-0 flex flex-col">
           {itemsToPrint.map((invItem) => (
             <ItemTagPreview key={invItem.id} item={invItem} isPrintOnly={true} />
           ))}
        </div>
      </div>

      {/* ✨ EDIT WEIGHTS MODAL ✨ */}
      <Dialog open={!!editWeightItem} onOpenChange={(val) => !val && setEditWeightItem(null)}>
        <DialogContent className="sm:max-w-[450px] border-slate-200 shadow-2xl rounded-xl p-0 overflow-hidden bg-white">
          <DialogHeader className="bg-slate-50 border-b border-slate-100 p-5">
            <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Edit2 className="w-5 h-5 text-indigo-600" />
              Edit Master Weights
            </DialogTitle>
            <DialogDescription className="text-xs mt-1">
              Adjust physical attributes for <strong className="text-slate-700">{editWeightItem?.barcode}</strong>. All changes are logged permanently.
            </DialogDescription>
          </DialogHeader>

          <div className="p-5 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Gross Weight (g)</Label>
                <Input 
                  type="number" 
                  step="0.001"
                  className="font-mono font-bold border-slate-300"
                  value={weightForm.gross}
                  onChange={(e) => setWeightForm({...weightForm, gross: e.target.value})}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">Net Weight (g)</Label>
                <Input 
                  type="number" 
                  step="0.001"
                  className="font-mono font-bold border-emerald-300 bg-emerald-50 text-emerald-900 focus-visible:ring-emerald-500"
                  value={weightForm.net}
                  onChange={(e) => setWeightForm({...weightForm, net: e.target.value})}
                />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">Total Stone Weight (cts)</Label>
                <Input 
                  type="number" 
                  step="0.001"
                  className="font-mono font-bold border-blue-300 bg-blue-50 text-blue-900 focus-visible:ring-blue-500"
                  value={weightForm.stone}
                  onChange={(e) => setWeightForm({...weightForm, stone: e.target.value})}
                />
              </div>

              {/* ✨ NEW: Diamond Specifications Fields */}
              <div className="col-span-2 border-t border-slate-100 pt-3 mt-1 space-y-3">
                <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                  <Gem className="w-3 h-3 text-slate-400" /> Diamond Specifications
                </Label>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-[9px] font-bold text-slate-500 uppercase">Clarity</Label>
                    <Input 
                      className="border-slate-300 h-8 text-xs font-semibold uppercase"
                      placeholder="VVS-VS"
                      value={weightForm.diamond_clarity}
                      onChange={(e) => setWeightForm({...weightForm, diamond_clarity: e.target.value})}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[9px] font-bold text-slate-500 uppercase">Color</Label>
                    <Input 
                      className="border-slate-300 h-8 text-xs font-semibold uppercase"
                      placeholder="E-F"
                      value={weightForm.diamond_color}
                      onChange={(e) => setWeightForm({...weightForm, diamond_color: e.target.value})}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[9px] font-bold text-slate-500 uppercase">Shape</Label>
                    <Input 
                      className="border-slate-300 h-8 text-xs font-semibold"
                      placeholder="Round"
                      value={weightForm.diamond_shape}
                      onChange={(e) => setWeightForm({...weightForm, diamond_shape: e.target.value})}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100">
              <Label className="text-[10px] font-bold text-rose-500 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                <FileText className="w-3 h-3" /> Reason for Update (Required)
              </Label>
              <textarea 
                className="w-full min-h-[80px] p-3 text-sm rounded-md border border-rose-200 bg-rose-50/50 focus:outline-none focus:ring-2 focus:ring-rose-500 transition-shadow resize-none"
                placeholder="e.g., Typo in original entry, Recalculated after stone replacement..."
                value={weightForm.reason}
                onChange={(e) => setWeightForm({...weightForm, reason: e.target.value})}
              />
            </div>
          </div>

          <DialogFooter className="bg-slate-50 p-4 border-t border-slate-100 flex gap-2">
            <Button variant="outline" className="flex-1 rounded-xl h-11 font-bold text-slate-500 hover:text-slate-800" onClick={() => setEditWeightItem(null)}>
              Cancel
            </Button>
            <Button 
              className="flex-1 rounded-xl h-11 font-bold bg-indigo-600 hover:bg-indigo-700 text-white" 
              onClick={handleSaveWeights}
              disabled={isSavingWeights || !weightForm.reason.trim()}
            >
              {isSavingWeights ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
              Save & Log Audit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* BULK MRP CALCULATOR MODAL */}
      <Dialog open={isCalcModalOpen} onOpenChange={setCalcModalOpen}>
        {/* ✨ FIX: Widened to 800px */}
        <DialogContent className="sm:max-w-[800px] border-slate-200 shadow-2xl rounded-xl p-0 overflow-hidden bg-white">
          <DialogHeader className="bg-slate-50 border-b border-slate-100 p-5">
            <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Calculator className="w-5 h-5 text-indigo-600" />
              Bulk MRP Calculator
            </DialogTitle>
            <DialogDescription className="text-xs mt-1">
              Calculate retail prices for {selectedIds.length} selected items based on current metal rates.
            </DialogDescription>
          </DialogHeader>

          {calcStep === 'params' ? (
            <div className="space-y-5 p-5 bg-slate-50/50">
              {/* ✨ FIX: Side-by-side grid with internal scrolling (max-h-[35vh]) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-start">
                
                {/* Gold Section */}
                <div className="space-y-3 bg-white p-4 rounded-xl border border-slate-200 shadow-sm max-h-[35vh] overflow-y-auto custom-scrollbar">
                  <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest sticky top-0 bg-white z-10 pb-2 block">Gold Rates (Per Gram)</Label>
                  {Object.keys(goldRates).map(k => (
                    <div key={k} className="flex items-center justify-between gap-3">
                      <span className="text-sm font-semibold text-slate-700">{k}</span>
                      <Input 
                        type="number" 
                        value={goldRates[k]} 
                        onChange={e => setGoldRates({...goldRates, [k]: Number(e.target.value)})}
                        className="h-9 w-28 bg-slate-50 text-right font-mono font-bold"
                      />
                    </div>
                  ))}
                </div>

                {/* Diamond Section */}
                <div className="space-y-3 bg-blue-50/30 p-4 rounded-xl border border-blue-100 shadow-sm max-h-[35vh] overflow-y-auto custom-scrollbar">
                  <Label className="text-[10px] font-bold text-blue-500 uppercase tracking-widest sticky top-0 bg-blue-50/90 backdrop-blur-sm z-10 pb-2 block">Diamond Rates (Per Ct)</Label>
                  {Object.keys(diamondRates).map(clarity => (
                    <div key={clarity} className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-slate-700 truncate max-w-[100px]">{clarity}</span>
                      <Input 
                        type="number" 
                        value={diamondRates[clarity]} 
                        onChange={e => setDiamondRates({...diamondRates, [clarity]: Number(e.target.value)})}
                        className="h-9 w-28 bg-white text-right border-blue-200 font-mono font-bold"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Bottom Params */}
              <div className="grid grid-cols-3 gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Markup (%)</Label>
                  <Input type="number" className="font-mono font-bold" value={calcParams.markupPercent} onChange={e => setCalcParams({...calcParams, markupPercent: Number(e.target.value)})} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Flat Add-on (₹)</Label>
                  <Input type="number" className="font-mono font-bold" value={calcParams.flatCharge} onChange={e => setCalcParams({...calcParams, flatCharge: Number(e.target.value)})} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">Round Up To</Label>
                  <Select value={calcParams.roundUpTo.toString()} onValueChange={(val) => setCalcParams({...calcParams, roundUpTo: Number(val)})}>
                    <SelectTrigger className="h-10 bg-emerald-50 border-emerald-200 text-emerald-700 font-bold focus:ring-emerald-500">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">Next ₹10</SelectItem>
                      <SelectItem value="50">Next ₹50</SelectItem>
                      <SelectItem value="100">Next ₹100</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button onClick={handleGeneratePreview} className="w-full h-11 rounded-xl font-bold bg-indigo-600 hover:bg-indigo-700 text-white uppercase tracking-widest text-xs shadow-md">
                Generate Preview
              </Button>
            </div>
          ) : (
            <div className="space-y-4 py-4">
              <div className="max-h-[300px] overflow-y-auto border border-slate-200 rounded-lg mx-5 custom-scrollbar">
                <Table>
                  <TableHeader className="bg-slate-50 sticky top-0">
                    <TableRow>
                      <TableHead className="text-[10px] font-bold h-8">Item</TableHead>
                      <TableHead className="text-[10px] font-bold h-8 text-right">Current</TableHead>
                      <TableHead className="text-[10px] font-bold h-8 text-right text-emerald-600">New MRP</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewData.map(p => (
                      <TableRow key={p.id}>
                        <TableCell className="py-2 text-xs font-mono">{p.barcode}</TableCell>
                        <TableCell className="py-2 text-xs text-right text-slate-500">{p.mrp ? `₹${p.mrp}` : '-'}</TableCell>
                        <TableCell className="py-2 text-xs text-right font-bold text-emerald-600">₹{p.newMrp}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="flex gap-3 px-5">
                <Button variant="outline" className="flex-1 rounded-xl h-11 text-xs font-bold text-gray-500 uppercase tracking-widest" onClick={() => setCalcStep('params')}>Back to Edit</Button>
                <Button 
                  className="flex-1 rounded-xl h-11 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs uppercase tracking-widest" 
                  onClick={handleApplyBulkMrp}
                  disabled={isCalculating}
                >
                  {isCalculating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                  Apply to Database
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* VIEW DETAILS MODAL */}
      <Dialog open={!!viewItem} onOpenChange={(val) => !val && setViewItem(null)}>
        <DialogContent className="sm:max-w-[700px] p-0 overflow-hidden border-none shadow-2xl rounded-2xl bg-white">
          {viewItem && (
            <>
              <DialogHeader className="bg-slate-50 p-6 border-b border-slate-100 flex flex-row items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <DialogTitle className="text-xl font-black text-slate-900 font-mono tracking-tight flex items-center gap-2">
                      {viewItem._type === 'repair' ? <Wrench className="w-5 h-5 text-amber-500" /> : <Package className="w-5 h-5 text-indigo-600" />}
                      {viewItem.barcode}
                    </DialogTitle>
                  </div>
                  
                  <div className="mt-2 flex items-center gap-3">
                    <Badge variant="outline" className="bg-white text-slate-600 border-slate-200 text-[10px] uppercase tracking-widest font-semibold px-2 py-0.5">
                      Design SKU: {viewItem.sku_reference}
                    </Badge>
                    <span className="text-xs font-medium text-slate-500 uppercase tracking-widest">
                      {viewItem.item_category}
                    </span>
                  </div>
                </div>
                
                <div className="flex flex-col items-end gap-1.5">
                   <Badge className={cn("text-[10px] uppercase tracking-widest border", 
                      viewItem._type === 'repair' ? "bg-amber-50 text-amber-700 border-amber-200" :
                      viewItem.status === 'in_stock' ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-100 text-slate-600 border-slate-200")}>
                     {viewItem.status.replace(/_/g, ' ')}
                   </Badge>
                   {viewItem.is_custom_order && <Badge className="bg-purple-100 text-purple-700 border-purple-200 text-[9px] uppercase tracking-widest">Custom: {viewItem.custom_orders?.origin?.name || 'Branch'}</Badge>}
                   {viewItem.is_repair_ticket && <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-[9px] uppercase tracking-widest">Repair: {viewItem.origin_name}</Badge>}
                </div>
              </DialogHeader>
              
              <div className="p-6 overflow-y-auto max-h-[70vh] custom-scrollbar space-y-6">
                
                {/* Manufacturing / Karigar Details Header */}
                {(viewItem.karigars || viewItem.created_from_job_bag?.karigars) && (
                  <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-4 shadow-sm flex justify-between items-center">
                    <div>
                      <p className="text-[10px] font-bold text-indigo-800 uppercase tracking-widest flex items-center gap-1.5 mb-1">
                        <UserCircle className="w-3.5 h-3.5" /> Maker / Karigar
                      </p>
                      <p className="text-xs font-semibold text-slate-900">
                        {(viewItem.karigars || viewItem.created_from_job_bag?.karigars)?.full_name} 
                        <span className="text-slate-500">({(viewItem.karigars || viewItem.created_from_job_bag?.karigars)?.karigar_code})</span>
                      </p>
                    </div>
                  </div>
                )}

                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 shadow-sm">
                  <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" /> Vault Status & Timeline
                  </h3>
                  <div className="flex gap-8">
                    <div>
                      <p className="text-[10px] text-slate-400 uppercase font-semibold mb-0.5">Manufactured / Added On</p>
                      <p className="text-xs font-mono font-medium text-slate-900">{formatDateTime(viewItem.created_at)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 uppercase font-semibold mb-0.5">Last Moved / Received</p>
                      <div className="flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                        <p className="text-xs font-mono font-bold text-emerald-700">{formatDateTime(viewItem.last_status_change_at || viewItem.updated_at)}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col md:flex-row gap-6">
                  
                  {/* INTERACTIVE IMAGE UPLOAD OVERLAY */}
                  <div className="relative w-full md:w-48 h-48 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-center shrink-0 overflow-hidden shadow-sm group">
                    {isUploadingImage ? (
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 z-10">
                        <Loader2 className="w-6 h-6 animate-spin text-indigo-600 mb-2" />
                        <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-600">Uploading...</span>
                      </div>
                    ) : viewItem.image_url ? (
                      <img src={viewItem.image_url} alt="Item" className="w-full h-full object-cover" />
                    ) : (
                      <div className="text-center text-slate-400">
                        <ImageIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <span className="text-[10px] font-bold uppercase tracking-widest">No Image</span>
                      </div>
                    )}
                  </div>

                  <div className="flex-1 grid grid-cols-2 gap-4">
                    <div className="bg-white p-4 border border-slate-200 rounded-xl shadow-sm space-y-1">
                      <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5"><Database className="w-3 h-3 text-amber-500"/> Metal Info</Label>
                      <p className="text-sm font-bold text-slate-900">{viewItem.metal_type} {viewItem.purity_karat !== 'N/A' ? `(${viewItem.purity_karat})` : ''}</p>
                      <p className="text-xs text-slate-500">{viewItem.purity_percent}% Purity • {viewItem.metal_color || 'Std Color'}</p>
                    </div>
                    
                    <div className="bg-white p-4 border border-slate-200 rounded-xl shadow-sm space-y-3">
                      <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                        <Gem className="w-3 h-3 text-blue-500"/> Stone Details
                      </Label>
                      <div>
                         <p className="text-lg font-black text-slate-900 leading-none">{getStoneTotals(viewItem).aggWt.toFixed(2)} <span className="text-xs text-slate-500 font-medium">cts</span></p>
                         <p className="text-xs font-semibold text-slate-500 mt-1">{getStoneTotals(viewItem).aggPcs} Total Pieces</p>
                      </div>
                      
                      {(getStoneTotals(viewItem).solWt > 0 || getStoneTotals(viewItem).meleeWt > 0) && (
                        <div className="pt-3 border-t border-slate-100 flex justify-between">
                           {getStoneTotals(viewItem).solWt > 0 && (
                             <div>
                               <p className="text-[9px] uppercase tracking-widest font-bold text-slate-400">Solitaire</p>
                               <p className="text-xs font-bold text-slate-700">{getStoneTotals(viewItem).solWt.toFixed(2)}ct <span className="text-[10px] font-normal">({getStoneTotals(viewItem).solPcs}p)</span></p>
                             </div>
                           )}
                           {getStoneTotals(viewItem).meleeWt > 0 && (
                             <div className="text-right">
                               <p className="text-[9px] uppercase tracking-widest font-bold text-slate-400">Melee / Side</p>
                               <p className="text-xs font-bold text-slate-700">{getStoneTotals(viewItem).meleeWt.toFixed(2)}ct <span className="text-[10px] font-normal">({getStoneTotals(viewItem).meleePcs}p)</span></p>
                             </div>
                           )}
                        </div>
                      )}
                    </div>
                    
                    <div className="bg-white p-4 border border-slate-200 rounded-xl shadow-sm space-y-1 col-span-2">
                      <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                        <Box className="w-3 h-3 text-emerald-500"/> 
                        {viewItem._type === 'repair' ? 'Added Materials (Consumed)' : 'Physical Weights'}
                      </Label>
                      <div className="flex justify-between items-end mt-1">
                        <div>
                           <p className="text-[10px] text-slate-400 font-medium">{viewItem._type === 'repair' ? 'Customer Gross' : 'Gross'}</p>
                           <p className="text-sm font-semibold">{viewItem.gross_weight_g}g</p>
                        </div>
                        <div>
                           <p className="text-[10px] text-slate-400 font-medium text-center">{viewItem._type === 'repair' ? 'Gold Added' : 'Net'}</p>
                           <p className="text-sm font-bold text-emerald-700">{viewItem.net_weight_g}g</p>
                        </div>
                        <div className="text-right">
                           <p className="text-[10px] text-slate-400 font-medium">Wastage</p>
                           <p className="text-sm font-semibold text-red-600">{viewItem.wastage_weight_g || 0}g</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                  <div className="bg-slate-50 border-b border-slate-200 px-4 py-2">
                    <h3 className="text-xs font-bold text-slate-600 uppercase tracking-widest">Compliance & Specs</h3>
                  </div>
                  <div className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">HUID Code</p>
                      <p className="text-xs font-mono font-bold text-slate-900 mt-0.5">{viewItem.huid_code || '---'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">HSN Code</p>
                      <p className="text-xs font-mono font-bold text-slate-900 mt-0.5">{viewItem.hsn_code || '---'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Item Size</p>
                      <p className="text-xs font-semibold text-slate-900 mt-0.5">{viewItem.item_size || 'Standard'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Diamond Quality</p>
                      <p className="text-xs font-semibold text-slate-900 mt-0.5">
                        {viewItem.diamond_shape ? `${viewItem.diamond_shape} ` : ''}
                        {viewItem.diamond_color ? `${viewItem.diamond_color}/` : ''}
                        {viewItem.diamond_clarity || '---'}
                      </p>
                    </div>
                  </div>
                  {viewItem.remarks && (
                    <div className="p-4 pt-0 border-t border-slate-100 mt-2">
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-2 mt-3">General Remarks</p>
                      <div className="text-xs text-slate-700 bg-slate-50 p-3 rounded-md border border-slate-200">
                        {viewItem.remarks}
                      </div>
                    </div>
                  )}
                </div>

                {/* ✨ DEDICATED AUDIT HISTORY TIMELINE ✨ */}
                {viewItem.audit_history && viewItem.audit_history.length > 0 && (
                  <div className="bg-white border border-rose-200 rounded-xl overflow-hidden shadow-sm">
                    <div className="bg-rose-50 border-b border-rose-200 px-4 py-2 flex items-center gap-2">
                      <History className="w-3.5 h-3.5 text-rose-600" />
                      <h3 className="text-xs font-bold text-rose-800 uppercase tracking-widest">Weight Audit History</h3>
                    </div>
                    <div className="p-4 space-y-3">
                      {viewItem.audit_history.map((log, idx) => (
                        <div key={idx} className="bg-rose-50/30 border border-rose-100 p-3 rounded-lg text-xs">
                          <div className="flex justify-between items-center mb-2 border-b border-rose-100 pb-2">
                            <span className="font-bold text-slate-800">{log.user_name}</span>
                            <span className="text-[10px] font-mono text-slate-500">{log.timestamp}</span>
                          </div>
                          <p className="font-medium text-slate-700 mb-1">Reason: <span className="font-normal">{log.reason}</span></p>
                          <p className="font-mono text-[10px] text-slate-500 bg-white p-2 rounded border border-slate-100">{log.changes}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                  <div className="bg-slate-50 border-b border-slate-200 px-4 py-2">
                    <h3 className="text-xs font-bold text-slate-600 uppercase tracking-widest">Costing Ledger</h3>
                  </div>
                  <div className="p-4 space-y-3">
                    {viewItem._type !== 'repair' && (
                      <>
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-slate-500 font-medium">Metal Base Cost</span>
                          <span className="font-mono font-semibold">₹{(viewItem.cost_metal || 0).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-slate-500 font-medium">Stone Cost</span>
                          <span className="font-mono font-semibold">₹{(viewItem.cost_stone || 0).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-slate-500 font-medium">Making / Labor</span>
                          <span className="font-mono font-semibold">₹{(viewItem.cost_making || 0).toLocaleString()}</span>
                        </div>
                        <div className="border-t border-slate-100 pt-3 flex justify-between items-center">
                          <span className="text-[10px] font-bold text-slate-800 uppercase tracking-widest">Total Sourcing Cost</span>
                          <span className="font-mono font-bold text-sm">₹{(viewItem.cost_total || 0).toLocaleString()}</span>
                        </div>
                      </>
                    )}
                    <div className="border-t border-slate-200 pt-3 flex justify-between items-center bg-indigo-50/50 -mx-4 px-4 pb-1">
                      <span className="text-[10px] font-black text-indigo-800 uppercase tracking-widest">{viewItem._type === 'repair' ? 'Service Billable' : 'Retail MRP'}</span>
                      <span className="font-mono font-black text-lg text-indigo-700">₹{(viewItem.mrp || 0).toLocaleString()}</span>
                    </div>
                  </div>
                </div>

              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ITEM TAG PRINT PREVIEW */}
      <ItemTagPreview item={tagItem} onClose={() => setTagItem(null)} />

    </div>
  )
}

// --- HYBRID RENDER TABLE ---
function InventoryTable({ data, warehouses, isSoldTab, selectedIds, setSelectedIds, editingMrpId, setEditingId, editingMrpVal, setEditingMrpVal, handleSaveMrp, handleOpenWeightEdit, setTagItem, handleSingleTransfer, setViewItem, canEdit }: any) {
  const [visibleCount, setVisibleCount] = useState(50)
  
  const observer = useRef<IntersectionObserver | null>(null)
  const observerRef = useCallback((node: HTMLDivElement | null) => {
    if (observer.current) observer.current.disconnect()
    if (node) {
      observer.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting) {
          setVisibleCount((prev) => prev + 50)
        }
      }, { threshold: 0.1 })
      observer.current.observe(node)
    }
  }, [])

  useEffect(() => {
    setVisibleCount(50)
  }, [data])

  const getWarehouseName = (wId: string) => warehouses.find((w: any) => w.id === wId)?.name || 'Unknown Vault'
  const visibleData = data.slice(0, visibleCount)

  return (
    <div className="h-full flex flex-col">
      {/* DESKTOP VIEW */}
      <div className="hidden md:block overflow-x-auto custom-scrollbar">
        <Table>
          <TableHeader className="bg-slate-50/80 border-b border-slate-200">
            <TableRow className="hover:bg-transparent border-none">
              {!isSoldTab && (
                <TableHead className="w-[40px] px-4 h-10">
                  <Checkbox 
                    checked={selectedIds.length === data.length && data.length > 0} 
                    onCheckedChange={() => setSelectedIds(selectedIds.length === data.length ? [] : data.map((i: any) => i.id))} 
                    className="rounded-[4px] border-slate-300 data-[state=checked]:bg-indigo-600 data-[state=checked]:border-indigo-600"
                  />
                </TableHead>
              )}
              <TableHead className="text-[10px] font-bold uppercase tracking-wider text-slate-500 h-10">Item Code / Design SKU</TableHead>
              <TableHead className="text-[10px] font-bold uppercase tracking-wider text-slate-500 h-10">Specs</TableHead>
              <TableHead className="text-[10px] font-bold uppercase tracking-wider text-slate-500 h-10 text-right px-4 w-[160px]">Weights</TableHead>
              <TableHead className="text-[10px] font-bold uppercase tracking-wider text-slate-500 h-10">Vault Timeline</TableHead>
              <TableHead className="text-[10px] font-bold uppercase tracking-wider text-slate-500 h-10 text-center">Status / Location</TableHead>
              <TableHead className="text-[10px] font-bold uppercase tracking-wider text-slate-500 h-10 w-[140px] text-right">Price/Value</TableHead>
              <TableHead className="w-[120px] text-right px-6"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleData.map((item: any) => {
              const { aggWt, stnWt, aggPcs } = getStoneTotals(item);
              const karigar = item.karigars || item.created_from_job_bag?.karigars;
              
              return (
                <TableRow key={item.id} className={cn("transition-colors border-b border-slate-100 last:border-0 hover:bg-slate-50/80", selectedIds.includes(item.id) && "bg-indigo-50/30")}>
                  {!isSoldTab && (
                    <TableCell className="px-4 py-3">
                      <Checkbox 
                        checked={selectedIds.includes(item.id)} 
                        onCheckedChange={() => setSelectedIds((prev: any) => prev.includes(item.id) ? prev.filter((i: any) => i !== item.id) : [...prev, item.id])} 
                        disabled={item.status === 'sold'} 
                        className="rounded-[4px] border-slate-300 data-[state=checked]:bg-indigo-600 data-[state=checked]:border-indigo-600 disabled:opacity-30"
                      />
                    </TableCell>
                  )}
                  <TableCell className="py-3">
                    <div className="flex flex-col items-start">
                       <div className="flex items-center gap-1.5 mb-1">
                          <Package className="w-3 h-3 text-indigo-500" />
                          <span className="font-mono font-bold text-sm text-indigo-900 tracking-tight leading-tight">{item.barcode}</span>
                       </div>
                       <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">SKU:</span>
                          <span className="text-xs text-slate-700 font-semibold">{item.sku_reference || 'NO SKU'}</span>
                       </div>
                       
                       <div className="flex gap-1 mt-1.5 flex-wrap">
                         {karigar && <Badge className="bg-indigo-50 text-indigo-700 border-indigo-200 text-[9px] uppercase tracking-widest px-1 py-0 h-4" title={karigar.full_name}>Mkr: {karigar.karigar_code || karigar.full_name}</Badge>}
                         {item.is_exchanged && <Badge className="bg-rose-100 text-rose-700 border-rose-200 text-[9px] uppercase tracking-widest px-1 py-0 h-4">Buyback</Badge>}
                         {item.is_custom_order && <Badge className="bg-purple-100 text-purple-700 border-purple-200 text-[9px] uppercase tracking-widest px-1 py-0 h-4">Custom: {item.custom_orders?.origin?.name || 'Branch'}</Badge>}
                         {item.is_repair_ticket && <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-[9px] uppercase tracking-widest px-1 py-0 h-4">Repair: {item.origin_name}</Badge>}
                       </div>
                    </div>
                  </TableCell>
                  <TableCell className="py-3">
                     <div className="text-xs font-semibold text-slate-900">{item.item_category}</div>
                     <div className="text-[10px] text-slate-500 font-medium uppercase tracking-wider mt-0.5">{item.metal_type} {item.purity_karat !== 'N/A' ? `(${item.purity_karat})` : ''}</div>
                     
                     {/* ✨ NEW: Diamond Specs Display */}
                     {(item.diamond_shape || item.diamond_color || item.diamond_clarity) && (
                       <div className="text-[9px] text-blue-600 font-bold uppercase tracking-widest mt-1.5 flex items-center gap-1">
                         <Gem className="w-2.5 h-2.5 shrink-0" />
                         <span className="truncate max-w-[120px]" title={[item.diamond_shape, item.diamond_color, item.diamond_clarity].filter(Boolean).join(' • ')}>
                           {[item.diamond_shape, item.diamond_color, item.diamond_clarity].filter(Boolean).join(' • ')}
                         </span>
                       </div>
                     )}
                  </TableCell>

                  <TableCell className="text-right px-4 py-3">
                     <div className="flex flex-col items-end group relative pr-2">
                        <span className="text-xs font-semibold text-slate-900">
                          {item.net_weight_g?.toFixed(3)}g 
                          <span className={cn("text-[9px] font-bold ml-1", item._type === 'repair' ? "text-amber-500" : "text-slate-400")}>
                            {item._type === 'repair' ? 'ADDED' : 'NET'}
                          </span>
                        </span>
                        <span className="text-[10px] text-blue-600 font-semibold uppercase mt-0.5">
                          {aggWt.toFixed(2)}ct 
                          <span className={cn("text-[9px] font-bold ml-1", item._type === 'repair' ? "text-amber-500" : "text-slate-400")}>
                            {item._type === 'repair' ? 'ADDED' : 'STN'}
                          </span>
                        </span>

                        {canEdit && !isSoldTab && !item.is_repair_ticket && (
                           <button 
                             onClick={() => handleOpenWeightEdit(item)}
                             className="absolute -right-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-all"
                             title="Edit Master Weights"
                           >
                             <Edit2 className="w-3.5 h-3.5" />
                           </button>
                        )}
                     </div>
                  </TableCell>
                  
                  <TableCell className="py-3">
                     <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1.5" title="Last Updated / Received in Vault">
                           <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                           <span className="text-[10px] font-mono font-bold text-emerald-700">{formatDateShort(item.last_status_change_at || item.updated_at)}</span>
                        </div>
                        <div className="flex items-center gap-1.5 opacity-60" title="Manufactured Date">
                           <CalendarDays className="w-3 h-3 text-slate-400" />
                           <span className="text-[9px] font-mono text-slate-500">{formatDateShort(item.created_at)}</span>
                        </div>
                     </div>
                  </TableCell>

                  <TableCell className="text-center py-3">
                     <span className={cn("inline-flex items-center justify-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border", 
                        item._type === 'repair' ? "bg-amber-50 text-amber-700 border-amber-200" :
                        item.status === 'in_stock' ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-50 text-slate-500 border-slate-200")}>
                       {item.status.replace(/_/g, ' ')}
                     </span>
                     <div className="mt-1 flex items-center justify-center gap-1 text-[9px] font-bold uppercase tracking-widest text-slate-400">
                       <Store className="w-2.5 h-2.5" />
                       {getWarehouseName(item.warehouse_id)}
                     </div>
                  </TableCell>
                  
                  <TableCell className="text-right py-3 pr-4">
                     {editingMrpId === item.id && canEdit ? (
                       <div className="flex items-center justify-end gap-1.5">
                         <Input className="h-8 w-20 text-xs font-semibold rounded-md border-slate-300 focus-visible:ring-indigo-500" value={editingMrpVal} onChange={e => setEditingMrpVal(e.target.value)} autoFocus />
                         <Button size="icon" variant="ghost" className="h-8 w-8 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 rounded-md shadow-sm border border-emerald-100 shrink-0" onClick={() => handleSaveMrp(item.id)}>
                           <Check className="w-4 h-4" />
                         </Button>
                       </div>
                     ) : (
                       <div className={`group flex items-center justify-end gap-2 ${canEdit ? 'cursor-pointer' : ''}`} onClick={() => { if(canEdit && !isSoldTab && !item.is_repair_ticket) { setEditingId(item.id); setEditingMrpVal(item.mrp?.toString() || '') }}}>
                         <span className="text-xs font-bold text-slate-900">
                            {item.mrp ? `₹${item.mrp.toLocaleString()}` : 'TBD'}
                         </span>
                         {canEdit && !isSoldTab && !item.is_repair_ticket && <Edit2 className="w-3 h-3 opacity-0 group-hover:opacity-100 text-slate-400 hover:text-indigo-600 transition-all" />}
                       </div>
                     )}
                  </TableCell>
                  
                  <TableCell className="text-right px-6 py-3">
                     <div className="flex justify-end gap-1.5">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors" onClick={() => setViewItem(item)} title="View Full Details">
                          <Eye className="h-4 w-4" />
                        </Button>
                        
                        {canEdit && (
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors" onClick={() => setTagItem(item)} title="Print Label">
                            <Printer className="h-4 w-4" />
                          </Button>
                        )}
                        
                        {!isSoldTab && (item.status === 'in_stock' || item.status === 'fixed_ready_for_dispatch') && (
                           <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors" onClick={() => handleSingleTransfer(item)} title="Transfer">
                          <Truck className="h-4 w-4" />
                        </Button>
                        )}
                     </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      {/* MOBILE VIEW */}
      <div className="md:hidden flex flex-col gap-3 bg-slate-50/50 p-3 flex-1 overflow-y-auto custom-scrollbar">
        {visibleData.map((item: any) => {
           const { aggWt, stnWt } = getStoneTotals(item);
           const karigar = item.karigars || item.created_from_job_bag?.karigars;
           
           return (
            <div key={item.id} className={cn("bg-white border rounded-xl p-4 shadow-sm flex flex-col gap-3", selectedIds.includes(item.id) ? "border-indigo-300 ring-1 ring-indigo-100" : "border-slate-200")}>
              <div className="flex justify-between items-start">
                 <div className="flex items-start gap-3">
                   {!isSoldTab && (
                     <Checkbox 
                       checked={selectedIds.includes(item.id)} 
                       onCheckedChange={() => setSelectedIds((prev: any) => prev.includes(item.id) ? prev.filter((i: any) => i !== item.id) : [...prev, item.id])} 
                       disabled={item.status === 'sold'}
                       className="mt-1 rounded-[4px] border-slate-300 data-[state=checked]:bg-indigo-600 data-[state=checked]:border-indigo-600 disabled:opacity-30"
                     />
                   )}
                   <div>
                     <div className="flex items-center gap-1.5 mb-0.5">
                        <Package className="w-3 h-3 text-indigo-500" />
                        <span className="font-mono font-bold text-sm text-indigo-900 tracking-tight leading-tight">{item.barcode}</span>
                     </div>
                     <div className="flex items-center gap-1 mb-1">
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">SKU:</span>
                        <span className="text-[11px] text-slate-700 font-semibold">{item.sku_reference || 'NO SKU'}</span>
                     </div>
                     
                     <div className="flex items-center gap-2 mt-1">
                       <div className="flex items-center gap-1 text-[10px] text-slate-500 font-mono">
                         <Clock className="w-3 h-3" /> {formatDateShort(item.last_status_change_at || item.updated_at)}
                       </div>
                       <span className="text-slate-300">|</span>
                       <div className="flex items-center gap-1 text-[10px] text-slate-500 font-semibold">
                         <Store className="w-3 h-3" /> {getWarehouseName(item.warehouse_id)}
                       </div>
                     </div>

                     {karigar && <span className="block text-[9px] font-bold text-indigo-600 uppercase tracking-widest mt-1.5">Maker: {karigar.full_name}</span>}
                     {item.is_custom_order && <span className="block text-[9px] font-bold text-purple-600 uppercase tracking-widest mt-1">Custom: {item.custom_orders?.origin?.name || 'Branch'}</span>}
                     {item.is_repair_ticket && <span className="block text-[9px] font-bold text-amber-600 uppercase tracking-widest mt-1">Repair: {item.origin_name}</span>}
                   </div>
                 </div>
                 
                 <div className="flex gap-2 items-center">
                   <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-indigo-600 bg-slate-50" onClick={() => setViewItem(item)}>
                      <Eye className="h-3.5 w-3.5" />
                   </Button>
                 </div>
              </div>
              
              <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-lg border border-slate-100 mt-1">
              <div>
                   <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Specs</p>
                   <p className="text-xs font-semibold text-slate-900">{item.item_category}</p>
                   <p className="text-[10px] text-slate-500">{item.metal_type} {item.purity_karat !== 'N/A' ? `(${item.purity_karat})` : ''}</p>
                   
                   {/* ✨ NEW: Diamond Specs Display */}
                   {(item.diamond_shape || item.diamond_color || item.diamond_clarity) && (
                     <div className="text-[9px] text-blue-600 font-bold uppercase tracking-widest mt-1.5 flex items-center gap-1">
                       <Gem className="w-2.5 h-2.5 shrink-0" />
                       <span className="truncate max-w-[120px]" title={[item.diamond_shape, item.diamond_color, item.diamond_clarity].filter(Boolean).join(' • ')}>
                         {[item.diamond_shape, item.diamond_color, item.diamond_clarity].filter(Boolean).join(' • ')}
                       </span>
                     </div>
                   )}
                 </div>

                 <div className="text-right group relative pr-2" onClick={() => { if(canEdit && !isSoldTab && !item.is_repair_ticket) handleOpenWeightEdit(item) }}>
                   <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5 flex justify-end items-center gap-1">
                     {item._type === 'repair' ? 'Materials Added' : 'Weights'}
                     {canEdit && !isSoldTab && !item.is_repair_ticket && <Edit2 className="w-2.5 h-2.5 text-slate-300 group-hover:text-indigo-500" />}
                   </p>
                   <p className="text-xs font-semibold text-slate-900">
                     {item.net_weight_g?.toFixed(3)}g 
                     <span className={cn("text-[9px] font-bold ml-1", item._type === 'repair' ? "text-amber-500" : "text-slate-400")}>
                       {item._type === 'repair' ? 'ADDED' : 'NET'}
                     </span>
                   </p>
                   <p className="text-[10px] text-blue-600 font-semibold">
                     {aggWt.toFixed(2)}ct 
                     <span className={cn("text-[9px] font-bold ml-1", item._type === 'repair' ? "text-amber-500" : "text-slate-400")}>
                       {item._type === 'repair' ? 'ADDED' : 'STN'}
                     </span>
                   </p>
                 </div>
              </div>

              <div className="flex justify-between items-end pt-1">
                 <div>
                   <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Retail Price</p>
                   {editingMrpId === item.id && canEdit ? (
                     <div className="flex items-center gap-1.5">
                       <Input className="h-8 w-24 text-xs font-semibold rounded-md border-slate-300 focus-visible:ring-indigo-500" value={editingMrpVal} onChange={e => setEditingMrpVal(e.target.value)} autoFocus />
                       <Button size="icon" variant="ghost" className="h-8 w-8 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 rounded-md shadow-sm border border-emerald-100" onClick={() => handleSaveMrp(item.id)}>
                         <Check className="w-4 h-4" />
                       </Button>
                     </div>
                   ) : (
                     <div className={`group flex items-center gap-2 w-max ${canEdit ? 'cursor-pointer' : ''}`} onClick={() => { if(canEdit && !isSoldTab && !item.is_repair_ticket) { setEditingId(item.id); setEditingMrpVal(item.mrp?.toString() || '') }}}>
                       <span className="text-sm font-bold text-slate-900">{item.mrp ? `₹${item.mrp.toLocaleString()}` : 'TBD'}</span>
                       {canEdit && !isSoldTab && !item.is_repair_ticket && <Edit2 className="w-3.5 h-3.5 text-slate-400" />}
                     </div>
                   )}
                 </div>
                 <div className="flex gap-1.5">
                   
                   {canEdit && (
                     <Button variant="outline" size="icon" className="h-8 w-8 text-slate-500 border-slate-200 bg-white" onClick={() => setTagItem(item)}>
                       <Printer className="h-3.5 w-3.5" />
                     </Button>
                   )}

                   {!isSoldTab && (item.status === 'in_stock' || item.status === 'fixed_ready_for_dispatch') && (
                     <Button variant="outline" size="icon" className="h-8 w-8 text-indigo-600 border-indigo-200 bg-indigo-50" onClick={() => handleSingleTransfer(item)}>
                    <Truck className="h-3.5 w-3.5" />
                  </Button>
                   )}
                 </div>
              </div>
            </div>
           )
        })}
      </div>

      {/* GEMINI INFINITE SCROLL TARGET */}
      {visibleCount < data.length && (
        <div ref={observerRef} className="h-16 w-full flex items-center justify-center my-4 relative">
          <div className="flex items-center gap-1.5 opacity-60">
            <Sparkles className="w-4 h-4 text-[#4285F4] animate-pulse" />
            <Sparkles className="w-5 h-5 text-[#9b72cb] animate-pulse" style={{ animationDelay: '200ms' }} />
            <Sparkles className="w-4 h-4 text-[#d96570] animate-pulse" style={{ animationDelay: '400ms' }} />
          </div>
        </div>
      )}
    </div>
  )
}