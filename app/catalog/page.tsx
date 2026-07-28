"use client";

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { 
  Search, Package, Loader2, ArrowLeft, ChevronRight, ChevronLeft, RefreshCw, 
  Image as ImageIcon, Filter, Plus, Store, Building2, Gem, Coins, IndianRupee, X,
  FileText
} from "lucide-react";

import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/hooks/useAuth";
import { useStoreLocation } from "@/hooks/useStoreLocation";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface CatalogItem {
  sku: string;
  category: string;
  metalType: string;
  metalPurity: string;
  metalDisplay: string;
  stoneCts: number;
  image: string | null;
  approx_mrp: number;
  global_stock: number;
  local_stock: number;
}

export default function CatalogPage() {
  const { toast } = useToast();
  const { appUser } = useAuth();
  const { selectedLocation, setSelectedLocation, isHQ } = useStoreLocation();

  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Search & Filter States
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterMetal, setFilterMetal] = useState("all");
  const [filterPurity, setFilterPurity] = useState("all");
  const [filterStones, setFilterStones] = useState("all");
  const [filterStock, setFilterStock] = useState("all");
  
  // Price Range Slider States
  const [maxCatalogPrice, setMaxCatalogPrice] = useState(1000000);
  const [priceRange, setPriceRange] = useState<number[]>([0, 1000000]);

  // Pagination States 
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);

  // Modal States
  const [selectedSku, setSelectedSku] = useState<CatalogItem | null>(null);
  const [zoomImg, setZoomImg] = useState<string | null>(null); // State for full-res image
  const [quantity, setQuantity] = useState("1");
  const [requiredDate, setRequiredDate] = useState("");
  const [remarks, setRemarks] = useState("");
  const [targetBranch, setTargetBranch] = useState(""); 
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchCatalog = async () => {
    if (!appUser?.company_id) return;
    setIsLoading(true);
    try {
      // 1. Fetch Catalog Data - ✨ ADDED WAREHOUSE FILTER LOGIC HERE
      let query = supabase
        .from("inventory_items")
        .select("sku_reference, item_category, metal_type, purity_karat, image_url, mrp, warehouse_id, status, total_stone_weight_cts")
        .eq("company_id", appUser.company_id)
        .neq("sku_reference", null);

      // If a specific branch is selected, strictly filter the data to only return items associated with that branch
      if (selectedLocation && selectedLocation !== 'ALL') {
        query = query.eq('warehouse_id', selectedLocation);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Group individual items into Catalog SKUs
      const grouped = (data || []).reduce((acc: Record<string, CatalogItem>, item) => {
        const sku = item.sku_reference.trim().toUpperCase();
        if (!sku) return acc;

        if (!acc[sku]) {
          acc[sku] = {
            sku,
            category: item.item_category || "Uncategorized",
            metalType: item.metal_type || "Unknown",
            metalPurity: item.purity_karat || "Unknown",
            metalDisplay: `${item.metal_type || ''} ${item.purity_karat || ''}`.trim(),
            stoneCts: item.total_stone_weight_cts || 0,
            image: item.image_url,
            approx_mrp: item.mrp || 0,
            global_stock: 0,
            local_stock: 0,
          };
        }

        if (item.status === 'in_stock') {
          acc[sku].global_stock += 1;
          if (item.warehouse_id === selectedLocation) acc[sku].local_stock += 1;
        }

        if (!acc[sku].image && item.image_url) acc[sku].image = item.image_url;
        if (item.mrp > acc[sku].approx_mrp) acc[sku].approx_mrp = item.mrp;
        if (item.total_stone_weight_cts > acc[sku].stoneCts) acc[sku].stoneCts = item.total_stone_weight_cts;

        return acc;
      }, {});

      // Sort: Items with Images FIRST, then alphabetical by SKU
      const processedCatalog = Object.values(grouped).sort((a, b) => {
        if (a.image && !b.image) return -1;
        if (!a.image && b.image) return 1;
        return a.sku.localeCompare(b.sku);
      });
      
      setCatalog(processedCatalog);

      // Calibrate max price for the slider
      const highestPrice = Math.max(...processedCatalog.map(c => c.approx_mrp), 100000);
      setMaxCatalogPrice(highestPrice);
      setPriceRange([0, highestPrice]);

      // 2. Fetch Warehouses for HQ ordering/switching context
      if (isHQ) {
        const { data: whData } = await supabase
          .from("warehouses")
          .select("id, name")
          .eq("company_id", appUser.company_id)
          .eq("is_active", true)
          .order("name");
        if (whData) setWarehouses(whData);
      }

    } catch (err: any) {
      toast({ title: "Catalog Error", description: err.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCatalog();
  }, [appUser, selectedLocation]);

  // Derive unique lists for dropdowns
  const uniqueCategories = useMemo(() => Array.from(new Set(catalog.map(c => c.category))).filter(Boolean).sort(), [catalog]);
  const uniqueMetals = useMemo(() => Array.from(new Set(catalog.map(c => c.metalType))).filter(Boolean).sort(), [catalog]);
  const uniquePurities = useMemo(() => Array.from(new Set(catalog.map(c => c.metalPurity))).filter(Boolean).sort(), [catalog]);

  const filteredCatalog = useMemo(() => {
    return catalog.filter(c => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        if (!c.sku.toLowerCase().includes(q) && !c.category.toLowerCase().includes(q)) return false;
      }
      // Exact Matches
      if (filterCategory !== "all" && c.category !== filterCategory) return false;
      if (filterMetal !== "all" && c.metalType !== filterMetal) return false;
      if (filterPurity !== "all" && c.metalPurity !== filterPurity) return false;
      
      // Dynamic Price Range
      if (c.approx_mrp < priceRange[0] || c.approx_mrp > priceRange[1]) return false;

      // Stone Filters
      if (filterStones === "diamonds" && c.stoneCts === 0) return false;
      if (filterStones === "plain" && c.stoneCts > 0) return false;

      // Stock Filters
      if (filterStock === "in_stock_local" && c.local_stock === 0) return false;
      if (filterStock === "in_stock_global" && c.global_stock === 0) return false;
      if (filterStock === "out_of_stock_local" && c.local_stock > 0) return false;

      return true;
    });
  }, [catalog, searchQuery, filterCategory, filterMetal, filterPurity, priceRange, filterStones, filterStock]);

  // Reset to page 1 whenever a filter or itemsPerPage changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterCategory, filterMetal, filterPurity, priceRange, filterStones, filterStock, itemsPerPage]);

  // Derive Paginated Data
  const totalPages = Math.ceil(filteredCatalog.length / itemsPerPage);
  const paginatedCatalog = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredCatalog.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredCatalog, currentPage, itemsPerPage]);

  const activeFilterCount = [filterCategory, filterMetal, filterPurity, filterStones, filterStock].filter(f => f !== 'all').length + (priceRange[0] > 0 || priceRange[1] < maxCatalogPrice ? 1 : 0);

  const clearFilters = () => {
    setFilterCategory("all");
    setFilterMetal("all");
    setFilterPurity("all");
    setPriceRange([0, maxCatalogPrice]);
    setFilterStones("all");
    setFilterStock("all");
    setSearchQuery("");
  }

  const handleRequestRestock = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalBranchId = selectedLocation === 'ALL' ? targetBranch : selectedLocation;

    if (!selectedSku || !appUser || !finalBranchId || finalBranchId === 'ALL') {
      toast({ title: "Validation Error", description: "Please select a valid branch.", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase.from("branch_restock_requests").insert({
        company_id: appUser.company_id,
        warehouse_id: finalBranchId,
        sku_reference: selectedSku.sku,
        quantity: parseInt(quantity),
        required_by_date: requiredDate || null,
        remarks: remarks.trim() || null,
        created_by: appUser.id
      });

      if (error) throw error;

      toast({ title: "Indent Submitted", description: `${quantity}x ${selectedSku.sku} requested.` });
      setSelectedSku(null);
      setQuantity("1");
      setRequiredDate("");
      setRemarks("");
      setTargetBranch("");
    } catch (err: any) {
      toast({ title: "Submission Failed", description: err.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatPrice = (val: number) => `₹${(val / 1000).toFixed(0)}k`;

  return (
    <div className="flex flex-col min-h-screen bg-[#fafafa]">
      {/* HEADER */}
      <header className="sticky top-0 z-40 w-full bg-white/80 backdrop-blur-md border-b border-gray-200 px-4 h-12 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3 overflow-hidden">
          <Link href="/dashboard">
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-md hover:bg-gray-100 transition-colors">
              <ArrowLeft className="h-4 w-4 text-gray-500" />
            </Button>
          </Link>
          <Separator orientation="vertical" className="h-4" />
          <nav className="flex items-center gap-1.5 text-[13px] whitespace-nowrap overflow-hidden">
            <span className="font-bold text-gray-900 select-none">Internal Catalog</span>
            <div className="ml-3 hidden md:flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-gray-100 border border-gray-200">
              <div className="h-1.5 w-1.5 rounded-full bg-gray-800" />
              <span className="text-[10px] font-bold text-gray-600 uppercase tracking-tighter">Live Inventory & Indents</span>
            </div>
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="h-8 px-2 text-xs font-medium text-gray-500 hover:text-gray-900" onClick={fetchCatalog}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </header>

      <main className="p-4 md:p-6 lg:p-8 max-w-[1600px] w-full mx-auto space-y-6 animate-in fade-in duration-500">
        
        {/* SEARCH AND FILTERS BAR */}
        <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-sm flex flex-col gap-3 transition-all">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-3">
            <div className="relative w-full sm:max-w-md flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input 
                  placeholder="Search SKU or Category..." 
                  className="pl-9 h-10 bg-gray-50 border-gray-200 focus-visible:bg-white focus-visible:ring-gray-300 transition-all font-medium text-sm"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
              </div>
              <Button 
                variant={showFilters ? "default" : "outline"} 
                className={`h-10 px-4 transition-all ${showFilters ? "bg-gray-900 hover:bg-gray-800 text-white" : "text-gray-600 bg-white"}`}
                onClick={() => setShowFilters(!showFilters)}
              >
                <Filter className="w-4 h-4 mr-2" /> 
                Filters 
                {activeFilterCount > 0 && (
                  <span className="ml-2 bg-gray-100 text-gray-900 text-[10px] font-black px-1.5 py-0.5 rounded-full">
                    {activeFilterCount}
                  </span>
                )}
              </Button>
            </div>

            <div className="flex flex-col items-end w-full sm:w-auto px-2">
              <span className="text-[10px] font-black uppercase text-gray-400 tracking-widest mb-1">Active Context</span>
              {isHQ ? (
                <Select value={selectedLocation} onValueChange={setSelectedLocation}>
                  <SelectTrigger className="h-8 w-full sm:w-[220px] text-xs font-bold bg-gray-100 border-transparent focus:ring-gray-300">
                    <div className="flex items-center gap-2 text-gray-700">
                      <Building2 className="w-3.5 h-3.5" />
                      <SelectValue placeholder="Select Context..." />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL" className="text-xs font-bold text-gray-900">Global View (HQ)</SelectItem>
                    {warehouses.map(w => (
                      <SelectItem key={w.id} value={w.id} className="text-xs font-medium">{w.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <span className="text-xs font-bold text-gray-700 flex items-center gap-1.5 h-8 px-3 bg-gray-100 rounded-md">
                  <Store className="w-3.5 h-3.5 text-gray-500" /> Branch Restock Mode
                </span>
              )}
            </div>
          </div>

          {showFilters && (
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-8 gap-4 pt-3 border-t border-gray-100 animate-in slide-in-from-top-2">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1"><Package className="w-3 h-3"/> Category</Label>
                <Select value={filterCategory} onValueChange={setFilterCategory}>
                  <SelectTrigger className="h-9 text-xs bg-gray-50 border-gray-200"><SelectValue placeholder="All Categories" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {uniqueCategories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1"><Coins className="w-3 h-3"/> Metal</Label>
                <Select value={filterMetal} onValueChange={setFilterMetal}>
                  <SelectTrigger className="h-9 text-xs bg-gray-50 border-gray-200"><SelectValue placeholder="All Metals" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Metals</SelectItem>
                    {uniqueMetals.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1"><Badge className="w-3 h-3 p-0 bg-transparent text-gray-400 shadow-none hover:bg-transparent">K</Badge> Purity</Label>
                <Select value={filterPurity} onValueChange={setFilterPurity}>
                  <SelectTrigger className="h-9 text-xs bg-gray-50 border-gray-200"><SelectValue placeholder="All Purities" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Purities</SelectItem>
                    {uniquePurities.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1"><Gem className="w-3 h-3"/> Stones</Label>
                <Select value={filterStones} onValueChange={setFilterStones}>
                  <SelectTrigger className="h-9 text-xs bg-gray-50 border-gray-200"><SelectValue placeholder="Any Style" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Any Style</SelectItem>
                    <SelectItem value="diamonds">Has Diamonds</SelectItem>
                    <SelectItem value="plain">Plain Gold (No Stones)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1"><Store className="w-3 h-3"/> Availability</Label>
                <Select value={filterStock} onValueChange={setFilterStock}>
                  <SelectTrigger className="h-9 text-xs bg-gray-50 border-gray-200"><SelectValue placeholder="All Stock" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Stock States</SelectItem>
                    <SelectItem value="in_stock_global">In Stock (Globally)</SelectItem>
                    {!isHQ && <SelectItem value="in_stock_local">In Stock (My Branch)</SelectItem>}
                    {!isHQ && <SelectItem value="out_of_stock_local">Out of Stock (My Branch)</SelectItem>}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3 col-span-2 md:col-span-3 xl:col-span-2 bg-gray-50/50 p-2.5 rounded-lg border border-gray-100">
                <div className="flex justify-between items-center">
                  <Label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1">
                    <IndianRupee className="w-3 h-3"/> Price Range
                  </Label>
                  <span className="text-[10px] font-black text-gray-700 font-mono tracking-tighter">
                    {formatPrice(priceRange[0])} - {formatPrice(priceRange[1])}
                  </span>
                </div>
                <div className="px-2">
                  <Slider 
                    min={0} 
                    max={maxCatalogPrice} 
                    step={1000} 
                    value={priceRange} 
                    onValueChange={setPriceRange} 
                    className="mt-1.5"
                  />
                </div>
              </div>

              {(activeFilterCount > 0 || searchQuery) && (
                <div className="flex items-center justify-end h-full">
                  <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9 text-xs font-bold text-red-500 hover:bg-red-50 hover:text-red-600 w-full sm:w-auto">
                    <X className="w-3.5 h-3.5 mr-1" /> Clear All
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* CATALOG GRID */}
        {isLoading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-gray-300" /></div>
        ) : filteredCatalog.length === 0 ? (
          <div className="text-center py-20 bg-white border border-gray-200 rounded-xl shadow-sm">
            <Package className="w-12 h-12 mx-auto mb-4 text-gray-200" />
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">No SKUs match your criteria</p>
            <Button variant="outline" className="mt-4 text-xs font-bold text-gray-500" onClick={clearFilters}>Reset Filters</Button>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6">
              {paginatedCatalog.map(item => {
                const isLowStock = item.local_stock === 0 && !isHQ;
                
                return (
                  <Card key={item.sku} className="overflow-hidden border-gray-200/60 shadow-sm hover:shadow-md transition-all group bg-white flex flex-col">
                    
                    {/* IMAGE CONTAINER WITH ZOOM OVERLAY */}
                    <div 
                      className="aspect-square bg-gray-50 relative border-b border-gray-100 flex items-center justify-center overflow-hidden cursor-pointer group/img"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (item.image) setZoomImg(item.image);
                      }}
                    >
                      {item.image ? (
                        <>
                          <img src={item.image} alt={item.sku} className="w-full h-full object-cover group-hover/img:scale-105 transition-transform duration-500" />
                          
                          {/* Hover Overlay */}
                          <div className="absolute inset-0 bg-black/10 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center z-20">
                            <div className="bg-white/90 backdrop-blur-sm text-gray-900 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5 shadow-lg transform translate-y-2 group-hover/img:translate-y-0 transition-all">
                              <Search className="w-3 h-3" /> View
                            </div>
                          </div>
                        </>
                      ) : (
                        <div className="flex flex-col items-center text-gray-300">
                          <ImageIcon className="w-8 h-8 mb-2" />
                          <span className="text-[10px] font-bold uppercase tracking-widest">No Image</span>
                        </div>
                      )}

                      {/* Stock Badges */}
                      <div className="absolute top-2 left-2 flex flex-col gap-1 z-30 pointer-events-none">
                        <Badge variant="secondary" className="bg-white/95 backdrop-blur-md text-gray-700 border-gray-200 text-[9px] uppercase tracking-widest shadow-sm">
                          Global: {item.global_stock}
                        </Badge>
                        {!isHQ && (
                          <Badge variant="secondary" className={`backdrop-blur-md text-[9px] uppercase tracking-widest shadow-sm ${isLowStock ? 'bg-red-500/95 text-white border-transparent' : 'bg-emerald-500/95 text-white border-transparent'}`}>
                            Local: {item.local_stock}
                          </Badge>
                        )}
                      </div>
                    </div>

                    <CardContent className="p-4 flex-1 flex flex-col justify-between">
                      <div>
                        <div className="flex justify-between items-start mb-1">
                          <h3 className="font-mono font-black text-gray-900 text-sm truncate pr-2" title={item.sku}>{item.sku}</h3>
                          <span className="font-bold text-gray-900 text-xs">~₹{(item.approx_mrp / 1000).toFixed(1)}k</span>
                        </div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest truncate">{item.category}</p>
                        
                        <div className="flex items-center gap-2 mt-2">
                           <span className="text-[10px] font-semibold text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded truncate">{item.metalDisplay}</span>
                           {item.stoneCts > 0 && (
                             <span className="text-[10px] font-semibold text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded truncate flex items-center gap-1">
                               <Gem className="w-2.5 h-2.5 text-gray-400" /> {item.stoneCts.toFixed(2)}ct
                             </span>
                           )}
                        </div>
                      </div>

                      <div className="mt-4 pt-3 border-t border-gray-100">
                        <Button 
                          className="w-full h-8 text-[10px] font-bold uppercase tracking-widest bg-gray-900 text-white hover:bg-gray-800 transition-colors shadow-sm"
                          onClick={() => setSelectedSku(item)}
                        >
                          <Plus className="w-3 h-3 mr-1.5" /> Request Restock
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>

            {/* PAGINATION CONTROLS */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 rounded-xl border border-gray-200 shadow-sm mt-8">
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Show</span>
                <Select value={itemsPerPage.toString()} onValueChange={(val) => setItemsPerPage(Number(val))}>
                  <SelectTrigger className="h-8 w-[80px] text-xs font-bold bg-gray-50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                    <SelectItem value="200">200</SelectItem>
                    <SelectItem value="500">500</SelectItem>
                  </SelectContent>
                </Select>
                <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Items</span>
              </div>
              
              <div className="flex items-center gap-6">
                <span className="text-xs font-bold text-gray-500">
                  Showing <span className="text-gray-900">{(currentPage - 1) * itemsPerPage + 1}</span> to <span className="text-gray-900">{Math.min(currentPage * itemsPerPage, filteredCatalog.length)}</span> of <span className="text-gray-900">{filteredCatalog.length}</span>
                </span>
                
                <div className="flex items-center gap-1.5">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="h-8 w-8 p-0" 
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="h-8 w-8 p-0" 
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* FULL RESOLUTION IMAGE MODAL */}
      <Dialog open={zoomImg !== null} onOpenChange={(open) => !open && setZoomImg(null)}>
        <DialogContent className="max-w-[90vw] md:max-w-[800px] p-0 bg-transparent border-none shadow-none flex justify-center items-center overflow-visible">
          <DialogHeader className="sr-only">
            <DialogTitle>Full Resolution View</DialogTitle>
          </DialogHeader>
          
          {zoomImg && (
            <div className="relative w-full flex justify-center mt-6">
              <img 
                src={zoomImg} 
                alt="Full resolution view" 
                className="max-w-full max-h-[80vh] object-contain rounded-xl drop-shadow-2xl" 
              />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* RESTOCK MODAL */}
      <Dialog open={!!selectedSku} onOpenChange={(open) => !open && setSelectedSku(null)}>
        <DialogContent className="sm:max-w-[400px] p-0 overflow-hidden border-none shadow-2xl">
          <DialogHeader className="bg-gray-50 p-5 border-b border-gray-200">
            <DialogTitle className="text-lg font-bold text-gray-900 flex items-center gap-2">
               <FileText className="w-4 h-4 text-gray-500" /> Branch Restock Indent
            </DialogTitle>
            <DialogDescription className="text-xs font-medium text-gray-500 mt-1">
              Send a manufacturing request to Head Office.
            </DialogDescription>
          </DialogHeader>

          {selectedSku && (
            <form id="restock-form" onSubmit={handleRequestRestock} className="p-5 space-y-4">
              <div className="bg-gray-100 p-3 rounded border border-gray-200 flex items-center justify-between mb-2">
                <div>
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Target SKU</p>
                  <p className="font-mono font-black text-gray-900 text-base">{selectedSku.sku}</p>
                </div>
                <Package className="text-gray-400 w-6 h-6" />
              </div>

              {isHQ && selectedLocation === 'ALL' && (
                <div className="space-y-1.5 pb-2">
                  <Label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Target Branch</Label>
                  <Select value={targetBranch} onValueChange={setTargetBranch} required>
                    <SelectTrigger className="h-9 text-sm bg-white border-gray-200 shadow-sm focus:ring-gray-300">
                      <SelectValue placeholder="Select branch to receive order..." />
                    </SelectTrigger>
                    <SelectContent>
                      {warehouses.map(w => (
                        <SelectItem key={w.id} value={w.id} className="text-xs font-medium">{w.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Quantity</Label>
                  <Input type="number" min="1" value={quantity} onChange={e => setQuantity(e.target.value)} className="h-9 text-sm font-bold bg-white border-gray-200 focus-visible:ring-gray-300 shadow-sm" required />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Need By</Label>
                  <Input type="date" value={requiredDate} onChange={e => setRequiredDate(e.target.value)} className="h-9 text-sm bg-white border-gray-200 focus-visible:ring-gray-300 shadow-sm" />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Remarks / Details</Label>
                <Input placeholder="e.g. Need ring sizes 12 and 14" value={remarks} onChange={e => setRemarks(e.target.value)} className="h-9 text-sm bg-white border-gray-200 focus-visible:ring-gray-300 shadow-sm" />
              </div>
            </form>
          )}

          <DialogFooter className="bg-gray-50 p-4 border-t border-gray-200 gap-2 flex flex-row justify-end">
            <Button type="button" variant="outline" size="sm" className="text-xs font-bold uppercase border-gray-200 text-gray-600" onClick={() => setSelectedSku(null)} disabled={isSubmitting}>Cancel</Button>
            <Button type="submit" form="restock-form" size="sm" className="text-xs font-bold uppercase px-6 bg-gray-900 hover:bg-gray-800 text-white shadow-md" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="w-3 h-3 mr-2 animate-spin" /> : null} Submit to HO
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}