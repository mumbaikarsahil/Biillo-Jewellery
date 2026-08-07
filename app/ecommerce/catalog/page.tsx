"use client";

import React, { useEffect, useState, useRef } from "react";
import { 
  Plus, Search, Edit2, Image as ImageIcon, CheckCircle2, 
  XCircle, Globe, PackageSearch, Layers, FolderTree, 
  Loader2, Settings2, CornerDownRight, UploadCloud, X,
  ArrowLeft, ArrowRight, Trash2, Video, Gem, Ruler
} from "lucide-react";

import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter,
} from "@/components/ui/sheet";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";

export default function EcommerceCatalogPage() {
  const { appUser } = useAuth();
  const { toast } = useToast();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const productImageInputRef = useRef<HTMLInputElement>(null);
  const productVideoInputRef = useRef<HTMLInputElement>(null);

  // Data States
  const [categories, setCategories] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | "all">("all");
  const [isLoading, setIsLoading] = useState(true);
  const [isProductsLoading, setIsProductsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Modal / Sheet States
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [isProductSheetOpen, setIsProductSheetOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isVideoUploading, setIsVideoUploading] = useState(false);

  // Form States
  const [categoryForm, setCategoryForm] = useState({ id: "", name: "", is_active: true, parent_id: "none", image_url: "" });
  
  // Expanded Product State matching the DB schema
  const [productForm, setProductForm] = useState({
    id: "",
    title: "",
    category_id: "",
    sku_reference: "",
    legacy_item_no: "",
    description: "",
    mrp: "",
    gallery_images: [] as string[],
    video_url: "",
    manufacturing_buffer_days: "14",
    is_live: false,
    
    // Metal & Dimensions
    metal_type: "Gold",
    metal_color: "Yellow",
    purity_karat: "18K",
    item_size: "",
    gross_weight_g: "",
    net_weight_g: "",
    
    // Diamond Specs
    diamond_shape: "",
    diamond_color: "",
    diamond_clarity: "",
    
    // Stone Breakdowns
    stone_weight_cts: "", // Total
    solitaire_weight_cts: "",
    solitaire_pieces: "",
    melee_weight_cts: "",
    melee_pieces: "",
    color_stone_weight_cts: "",
    color_stone_pieces: "",
  });

  // ==========================================================================
  // UPLOAD LOGIC
  // ==========================================================================
  const handleCategoryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !appUser?.company_id) return;

    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `${appUser.company_id}/categories/${fileName}`;

      const { error: uploadError } = await supabase.storage.from('ecommerce-assets').upload(filePath, file);
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('ecommerce-assets').getPublicUrl(filePath);
      setCategoryForm(prev => ({ ...prev, image_url: data.publicUrl }));
    } catch (err: any) {
      toast({ title: "Upload Failed", description: err.message, variant: "destructive" });
    } finally {
      setIsUploading(false);
      if (e.target) e.target.value = ''; 
    }
  };

  const handleProductImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !appUser?.company_id) return;

    setIsUploading(true);
    try {
      const uploadedUrls: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `${appUser.company_id}/products/${fileName}`;

        const { error: uploadError } = await supabase.storage.from('ecommerce-assets').upload(filePath, file);
        if (uploadError) throw uploadError;

        const { data } = supabase.storage.from('ecommerce-assets').getPublicUrl(filePath);
        uploadedUrls.push(data.publicUrl);
      }
      setProductForm(prev => ({ ...prev, gallery_images: [...prev.gallery_images, ...uploadedUrls] }));
    } catch (err: any) {
      toast({ title: "Image Upload Failed", description: err.message, variant: "destructive" });
    } finally {
      setIsUploading(false);
      if (e.target) e.target.value = ''; 
    }
  };

  const handleProductVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !appUser?.company_id) return;

    if (file.size > 10 * 1024 * 1024) { 
      toast({ title: "File too large", description: "Please upload a short video under 10MB.", variant: "destructive" });
      return;
    }

    setIsVideoUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `vid-${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `${appUser.company_id}/products/${fileName}`;

      const { error: uploadError } = await supabase.storage.from('ecommerce-assets').upload(filePath, file);
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('ecommerce-assets').getPublicUrl(filePath);
      setProductForm(prev => ({ ...prev, video_url: data.publicUrl }));
    } catch (err: any) {
      toast({ title: "Video Upload Failed", description: err.message, variant: "destructive" });
    } finally {
      setIsVideoUploading(false);
      if (e.target) e.target.value = ''; 
    }
  };

  const moveImage = (index: number, direction: 'left' | 'right') => {
    const newImages = [...productForm.gallery_images];
    if (direction === 'left' && index > 0) {
      [newImages[index - 1], newImages[index]] = [newImages[index], newImages[index - 1]];
    } else if (direction === 'right' && index < newImages.length - 1) {
      [newImages[index + 1], newImages[index]] = [newImages[index], newImages[index + 1]];
    }
    setProductForm({ ...productForm, gallery_images: newImages });
  };

  const removeImage = (index: number) => {
    setProductForm({
      ...productForm,
      gallery_images: productForm.gallery_images.filter((_, i) => i !== index)
    });
  };

  // ==========================================================================
  // DATA FETCHING
  // ==========================================================================
  const fetchCategories = async () => {
    if (!appUser?.company_id) return;
    try {
      const { data, error } = await supabase
        .from("ecommerce_categories")
        .select("*")
        .eq("company_id", appUser.company_id)
        .order("name", { ascending: true });

      if (error) throw error;
      setCategories(data || []);
    } catch (err: any) {
      toast({ title: "Failed to load categories", description: err.message, variant: "destructive" });
    }
  };

  const fetchProducts = async () => {
    if (!appUser?.company_id) return;
    setIsProductsLoading(true);
    try {
      let query = supabase
        .from("ecommerce_products")
        .select(`*, category:ecommerce_categories(name)`)
        .eq("company_id", appUser.company_id)
        .order("created_at", { ascending: false });

      if (selectedCategoryId !== "all") {
        query = query.eq("category_id", selectedCategoryId);
      }

      const { data, error } = await query;
      if (error) throw error;
      setProducts(data || []);
    } catch (err: any) {
      toast({ title: "Failed to load products", description: err.message, variant: "destructive" });
    } finally {
      setIsProductsLoading(false);
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, [appUser]);

  useEffect(() => {
    fetchProducts();
  }, [appUser, selectedCategoryId]);

  // ==========================================================================
  // CATEGORY MANAGEMENT
  // ==========================================================================
  const generateSlug = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');

  const handleSaveCategory = async () => {
    if (!categoryForm.name.trim() || !appUser) return;
    setIsSubmitting(true);
    try {
      // ✨ NEW LOGIC: Find the parent category to get its slug
      let parentSlug = "";
      if (categoryForm.parent_id !== "none") {
        const parentCategory = categories.find(c => c.id === categoryForm.parent_id);
        if (parentCategory && parentCategory.slug) {
          parentSlug = parentCategory.slug;
        }
      }

      // ✨ NEW LOGIC: Combine parent slug with new category name
      const cleanNameSlug = generateSlug(categoryForm.name);
      const finalSlug = parentSlug ? `${parentSlug}-${cleanNameSlug}` : cleanNameSlug;

      const payload: any = {
        company_id: appUser.company_id,
        name: categoryForm.name.trim(),
        slug: finalSlug, // ✨ Saves as "rings-casual" instead of just "casual"
        is_active: categoryForm.is_active,
        parent_id: categoryForm.parent_id === "none" ? null : categoryForm.parent_id,
        image_url: categoryForm.image_url || null
      };

      if (categoryForm.id) {
        if (categoryForm.id === payload.parent_id) throw new Error("A category cannot be its own parent.");
        const { error } = await supabase.from("ecommerce_categories").update(payload).eq("id", categoryForm.id);
        if (error) throw error;
        toast({ title: "Category Updated" });
      } else {
        const { error } = await supabase.from("ecommerce_categories").insert(payload);
        if (error) throw error;
        toast({ title: "Category Created" });
      }

      setIsCategoryModalOpen(false);
      setCategoryForm({ id: "", name: "", is_active: true, parent_id: "none", image_url: "" });
      fetchCategories();
    } catch (err: any) {
      toast({ title: "Error saving category", description: err.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderCategoryTree = (parentId: string | null = null, depth: number = 0) => {
    const children = categories.filter(c => c.parent_id === parentId);
    return children.map(cat => (
      <React.Fragment key={cat.id}>
        <div className="flex items-center gap-1" style={{ paddingLeft: `${depth * 16}px` }}>
          <button
            onClick={() => setSelectedCategoryId(cat.id)}
            className={`flex-1 flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
              selectedCategoryId === cat.id ? "bg-zinc-100 text-zinc-900" : "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50"
            }`}
          >
            {depth > 0 && <CornerDownRight className="w-3.5 h-3.5 text-zinc-300 shrink-0" />}
            <span className="truncate">{cat.name}</span>
            {!cat.is_active && <XCircle className="w-3 h-3 text-zinc-400 shrink-0 ml-1" />}
          </button>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-7 w-7 text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 rounded-md shrink-0"
            onClick={() => {
              setCategoryForm({ 
                id: cat.id, name: cat.name, is_active: cat.is_active, 
                parent_id: cat.parent_id || "none", image_url: cat.image_url || "" 
              });
              setIsCategoryModalOpen(true);
            }}
          >
            <Settings2 className="w-3.5 h-3.5" />
          </Button>
        </div>
        {renderCategoryTree(cat.id, depth + 1)}
      </React.Fragment>
    ));
  };

  const renderCategoryOptions = (parentId: string | null = null, depth: number = 0) => {
    const children = categories.filter(c => c.parent_id === parentId);
    return children.map(cat => (
      <React.Fragment key={cat.id}>
        <option value={cat.id} disabled={!cat.is_active} className={!cat.is_active ? "text-zinc-300" : ""}>
          {"\u00A0\u00A0\u00A0".repeat(depth)}{depth > 0 ? "↳ " : ""}{cat.name} {!cat.is_active ? "(Hidden)" : ""}
        </option>
        {renderCategoryOptions(cat.id, depth + 1)}
      </React.Fragment>
    ));
  };

  // ==========================================================================
  // PRODUCT MANAGEMENT
  // ==========================================================================
  const handleSaveProduct = async () => {
    if (!productForm.title || !productForm.mrp || !productForm.category_id || !appUser) {
      toast({ title: "Missing Fields", description: "Title, Category, and Base MRP are required.", variant: "destructive" });
      return;
    }
    
    setIsSubmitting(true);
    try {
      const payload = {
        company_id: appUser.company_id,
        category_id: productForm.category_id,
        title: productForm.title.trim(),
        slug: generateSlug(productForm.title),
        sku_reference: productForm.sku_reference?.trim().toUpperCase() || null,
        legacy_item_no: productForm.legacy_item_no?.trim() || null,
        description: productForm.description?.trim() || null,
        
        // Media
        gallery_images: productForm.gallery_images,
        cover_image_url: productForm.gallery_images.length > 0 ? productForm.gallery_images[0] : null,
        video_url: productForm.video_url?.trim() || null,
        
        // Metal & Dimensions
        metal_type: productForm.metal_type?.trim() || null,
        metal_color: productForm.metal_color?.trim() || null,
        purity_karat: productForm.purity_karat?.trim() || null,
        item_size: productForm.item_size?.trim() || null,
        gross_weight_g: Number(productForm.gross_weight_g) || 0,
        net_weight_g: Number(productForm.net_weight_g) || 0,
        
        // Diamond Specs
        diamond_shape: productForm.diamond_shape?.trim() || null,
        diamond_color: productForm.diamond_color?.trim() || null,
        diamond_clarity: productForm.diamond_clarity?.trim() || null,
        
        // Stone Breakdowns
        stone_weight_cts: Number(productForm.stone_weight_cts) || 0,
        solitaire_weight_cts: Number(productForm.solitaire_weight_cts) || 0,
        solitaire_pieces: Number(productForm.solitaire_pieces) || 0,
        melee_weight_cts: Number(productForm.melee_weight_cts) || 0,
        melee_pieces: Number(productForm.melee_pieces) || 0,
        color_stone_weight_cts: Number(productForm.color_stone_weight_cts) || 0,
        color_stone_pieces: Number(productForm.color_stone_pieces) || 0,

        // Financial & Fulfillment
        mrp: Number(productForm.mrp),
        manufacturing_buffer_days: Number(productForm.manufacturing_buffer_days) || 14,
        is_live: productForm.is_live
      };

      if (productForm.id) {
        const { error } = await supabase.from("ecommerce_products").update(payload).eq("id", productForm.id);
        if (error) throw error;
        toast({ title: "Product Updated successfully" });
      } else {
        const { error } = await supabase.from("ecommerce_products").insert(payload);
        if (error) throw error;
        toast({ title: "Product Added to Catalog" });
      }

      setIsProductSheetOpen(false);
      fetchProducts();
    } catch (err: any) {
      toast({ title: "Error saving product", description: err.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleProductLiveStatus = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase.from("ecommerce_products").update({ is_live: !currentStatus }).eq("id", id);
      if (error) throw error;
      setProducts(products.map(p => p.id === id ? { ...p, is_live: !currentStatus } : p));
      toast({ title: !currentStatus ? "Product Published to Site" : "Product Hidden from Site" });
    } catch (err: any) {
      toast({ title: "Status Update Failed", description: err.message, variant: "destructive" });
    }
  };

  const openEditProduct = (prod: any) => {
    setProductForm({
      id: prod.id,
      title: prod.title || "",
      category_id: prod.category_id || "",
      sku_reference: prod.sku_reference || "",
      legacy_item_no: prod.legacy_item_no || "",
      description: prod.description || "",
      mrp: prod.mrp?.toString() || "",
      gallery_images: prod.gallery_images || (prod.cover_image_url ? [prod.cover_image_url] : []),
      video_url: prod.video_url || "",
      manufacturing_buffer_days: prod.manufacturing_buffer_days?.toString() || "14",
      is_live: prod.is_live || false,
      
      metal_type: prod.metal_type || "Gold",
      metal_color: prod.metal_color || "Yellow",
      purity_karat: prod.purity_karat || "18K",
      item_size: prod.item_size || "",
      gross_weight_g: prod.gross_weight_g?.toString() || "",
      net_weight_g: prod.net_weight_g?.toString() || "",
      
      diamond_shape: prod.diamond_shape || "",
      diamond_color: prod.diamond_color || "",
      diamond_clarity: prod.diamond_clarity || "",
      
      stone_weight_cts: prod.stone_weight_cts?.toString() || "",
      solitaire_weight_cts: prod.solitaire_weight_cts?.toString() || "",
      solitaire_pieces: prod.solitaire_pieces?.toString() || "",
      melee_weight_cts: prod.melee_weight_cts?.toString() || "",
      melee_pieces: prod.melee_pieces?.toString() || "",
      color_stone_weight_cts: prod.color_stone_weight_cts?.toString() || "",
      color_stone_pieces: prod.color_stone_pieces?.toString() || "",
    });
    setIsProductSheetOpen(true);
  };

  const resetProductForm = () => {
    setProductForm({
      id: "", title: "", category_id: selectedCategoryId !== "all" ? selectedCategoryId : "", 
      sku_reference: "", legacy_item_no: "", description: "", mrp: "", 
      gallery_images: [], video_url: "", manufacturing_buffer_days: "14", is_live: false,
      metal_type: "Gold", metal_color: "Yellow", purity_karat: "18K", item_size: "", gross_weight_g: "", net_weight_g: "",
      diamond_shape: "", diamond_color: "", diamond_clarity: "", stone_weight_cts: "",
      solitaire_weight_cts: "", solitaire_pieces: "", melee_weight_cts: "", melee_pieces: "", 
      color_stone_weight_cts: "", color_stone_pieces: ""
    });
  };

  const filteredProducts = products.filter(p => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return p.title.toLowerCase().includes(q) || 
           (p.sku_reference && p.sku_reference.toLowerCase().includes(q)) || 
           (p.legacy_item_no && p.legacy_item_no.toLowerCase().includes(q));
  });

  return (
    <div className="p-4 md:p-8 max-w-[1600px] w-full mx-auto space-y-8 animate-in fade-in duration-500 pb-20 font-sans text-zinc-900">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl tracking-tight font-semibold text-zinc-900">Catalog</h1>
          <p className="text-sm text-zinc-500 mt-1">Manage website display products and media sequences.</p>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        
        {/* LEFT PANE: NESTED CATEGORIES */}
        <div className="w-full lg:w-64 shrink-0 space-y-4">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500 flex items-center gap-1.5">
              <FolderTree className="w-3.5 h-3.5" /> Product Lines
            </h2>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-6 w-6 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 rounded-md"
              onClick={() => {
                setCategoryForm({ id: "", name: "", is_active: true, parent_id: "none", image_url: "" });
                setIsCategoryModalOpen(true);
              }}
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>

          <div className="flex flex-col gap-0.5">
            <button
              onClick={() => setSelectedCategoryId("all")}
              className={`w-full flex items-center justify-between px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                selectedCategoryId === "all" ? "bg-zinc-900 text-white" : "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100/50"
              }`}
            >
              All Products
            </button>
            
            {/* RENDER HIERARCHY */}
            <div className="flex flex-col gap-0.5 mt-2">
               {renderCategoryTree(null, 0)}
            </div>
          </div>
        </div>

        {/* RIGHT PANE: PRODUCTS */}
        <div className="flex-1 space-y-4 min-w-0">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-white p-2 rounded-xl border border-zinc-200/60 shadow-sm">
            <div className="relative w-full sm:max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
              <Input 
                placeholder="Search Title, SKU or Legacy No..." 
                className="pl-9 h-9 border-none shadow-none focus-visible:ring-0 bg-transparent text-sm"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Button 
              className="w-full sm:w-auto h-9 px-4 bg-zinc-900 hover:bg-zinc-800 text-white font-medium text-sm rounded-lg shadow-sm transition-all"
              onClick={() => {
                resetProductForm();
                setIsProductSheetOpen(true);
              }}
            >
              <Plus className="w-4 h-4 mr-1.5" /> New Product
            </Button>
          </div>

          <Card className="shadow-sm border-zinc-200/60 bg-white rounded-xl overflow-hidden">
            <div className="overflow-x-auto custom-scrollbar">
              <Table className="whitespace-nowrap">
                <TableHeader className="bg-zinc-50/50 border-b border-zinc-100">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-[60px]"></TableHead>
                    <TableHead className="text-xs font-medium text-zinc-500 px-4 h-11">Product</TableHead>
                    <TableHead className="text-xs font-medium text-zinc-500 px-4 h-11">References</TableHead>
                    <TableHead className="text-xs font-medium text-zinc-500 px-4 h-11 text-right">Base MRP</TableHead>
                    <TableHead className="text-xs font-medium text-zinc-500 px-4 h-11 text-center">Buffer</TableHead>
                    <TableHead className="text-xs font-medium text-zinc-500 px-4 h-11 text-center">Status</TableHead>
                    <TableHead className="w-[80px] text-right px-6"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading || isProductsLoading ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-12"><Loader2 className="w-5 h-5 animate-spin mx-auto text-zinc-400" /></TableCell></TableRow>
                  ) : filteredProducts.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-16 text-sm text-zinc-500">No master products found.</TableCell></TableRow>
                  ) : (
                    filteredProducts.map(product => (
                      <TableRow key={product.id} className="hover:bg-zinc-50/50 transition-colors border-zinc-100/50">
                        <TableCell className="px-4 py-3">
                          {product.cover_image_url || (product.gallery_images && product.gallery_images.length > 0) ? (
                            <img src={product.cover_image_url || product.gallery_images[0]} alt="Cover" className="w-10 h-10 rounded-md object-cover border border-zinc-200 shadow-sm" />
                          ) : (
                            <div className="w-10 h-10 rounded-md bg-zinc-100 border border-zinc-200/60 flex items-center justify-center">
                              <ImageIcon className="w-4 h-4 text-zinc-300" />
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="px-4 py-3">
                          <div className="font-medium text-sm text-zinc-900 truncate max-w-[250px]">{product.title}</div>
                          <div className="text-xs text-zinc-500 mt-0.5">{product.category?.name || "Uncategorized"}</div>
                        </TableCell>
                        <TableCell className="px-4 py-3">
                          <div className="flex flex-col gap-1 items-start">
                            {product.sku_reference ? (
                              <span className="text-[11px] font-mono font-medium text-zinc-700 bg-zinc-100 px-1.5 py-0.5 rounded flex items-center gap-1">
                                <PackageSearch className="w-3 h-3 text-zinc-400" /> {product.sku_reference}
                              </span>
                            ) : (
                              <span className="text-[11px] text-zinc-400 italic">No SKU</span>
                            )}
                            {product.legacy_item_no && (
                              <span className="text-[10px] font-mono text-zinc-500 flex items-center gap-1 pl-1">
                                <Layers className="w-3 h-3 opacity-50" /> {product.legacy_item_no}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="px-4 py-3 text-right">
                          <div className="font-medium text-sm text-zinc-900">₹{Number(product.mrp).toLocaleString()}</div>
                        </TableCell>
                        <TableCell className="px-4 py-3 text-center">
                          <span className="text-xs text-zinc-600">{product.manufacturing_buffer_days}d</span>
                        </TableCell>
                        <TableCell className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <Switch 
                              checked={product.is_live} 
                              onCheckedChange={() => toggleProductLiveStatus(product.id, product.is_live)} 
                              className="data-[state=checked]:bg-zinc-900 scale-90"
                            />
                            {product.is_live ? (
                              <Globe className="w-4 h-4 text-zinc-900" />
                            ) : (
                              <Globe className="w-4 h-4 text-zinc-300" />
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="px-6 text-right">
                          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-md text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100" onClick={() => openEditProduct(product)}>
                            <Edit2 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </div>
      </div>

      {/* ========================================================================== */}
      {/* CATEGORY DIALOG */}
      {/* ========================================================================== */}
      <Dialog open={isCategoryModalOpen} onOpenChange={(o) => !o && setIsCategoryModalOpen(false)}>
        <DialogContent className="sm:max-w-[425px] p-0 border-none shadow-xl rounded-2xl overflow-hidden">
          <DialogHeader className="bg-white p-6 border-b border-zinc-100">
            <DialogTitle className="text-lg font-semibold tracking-tight text-zinc-900 flex items-center gap-2">
              <FolderTree className="w-4 h-4 text-zinc-400" /> 
              {categoryForm.id ? "Edit Category" : "Create Category"}
            </DialogTitle>
          </DialogHeader>
          <div className="p-6 space-y-5 bg-zinc-50/30">
            
            {/* IMAGE UPLOAD */}
            <div className="flex flex-col items-center justify-center">
              <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleCategoryUpload} />
              <div 
                className="w-24 h-24 rounded-full border border-dashed border-zinc-300 bg-white flex flex-col items-center justify-center cursor-pointer hover:border-zinc-400 hover:bg-zinc-50 transition-all relative overflow-hidden shadow-sm"
                onClick={() => fileInputRef.current?.click()}
              >
                {isUploading ? (
                  <Loader2 className="w-5 h-5 animate-spin text-zinc-400" />
                ) : categoryForm.image_url ? (
                  <img src={categoryForm.image_url} alt="Category" className="w-full h-full object-cover" />
                ) : (
                  <>
                    <UploadCloud className="w-5 h-5 text-zinc-400 mb-1" />
                    <span className="text-[9px] font-medium text-zinc-500 uppercase">Upload</span>
                  </>
                )}
              </div>
              {categoryForm.image_url && !isUploading && (
                <button onClick={() => setCategoryForm({...categoryForm, image_url: ""})} className="text-[10px] text-red-500 hover:underline mt-2">Remove Image</button>
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-medium text-zinc-700">Category Name</Label>
              <Input 
                placeholder="e.g. Diamond Rings" 
                className="h-9 bg-white border-zinc-200 text-sm focus-visible:ring-zinc-900"
                value={categoryForm.name}
                onChange={e => setCategoryForm({...categoryForm, name: e.target.value})}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-medium text-zinc-700">Parent Category</Label>
              <select 
                className="w-full h-9 px-3 border border-zinc-200 rounded-md text-sm bg-white focus:ring-1 focus:ring-zinc-900 outline-none"
                value={categoryForm.parent_id}
                onChange={e => setCategoryForm({...categoryForm, parent_id: e.target.value})}
              >
                <option value="none">-- Top Level (No Parent) --</option>
                {renderCategoryOptions(null, 0).filter((node: any) => node.key !== categoryForm.id)}
              </select>
            </div>

            <div className="flex items-center justify-between bg-white border border-zinc-200 p-3 rounded-lg shadow-sm">
              <div>
                <p className="text-sm font-medium text-zinc-900">Visibility</p>
                <p className="text-[11px] text-zinc-500">Show on storefront menu</p>
              </div>
              <Switch checked={categoryForm.is_active} onCheckedChange={v => setCategoryForm({...categoryForm, is_active: v})} className="data-[state=checked]:bg-zinc-900" />
            </div>
          </div>
          <DialogFooter className="p-4 bg-white border-t border-zinc-100 flex items-center justify-between">
            <Button variant="ghost" onClick={() => setIsCategoryModalOpen(false)} className="rounded-lg h-9 font-medium text-zinc-500">Cancel</Button>
            <Button onClick={handleSaveCategory} disabled={isSubmitting || isUploading} className="rounded-lg h-9 bg-zinc-900 hover:bg-zinc-800 text-white font-medium shadow-sm px-6">
              {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========================================================================== */}
      {/* MASTER PRODUCT SHEET */}
      {/* ========================================================================== */}
      <Sheet open={isProductSheetOpen} onOpenChange={(o) => !o && setIsProductSheetOpen(false)}>
        <SheetContent className="w-full sm:max-w-[550px] p-0 border-l border-zinc-200 shadow-2xl flex flex-col bg-white">
          <SheetHeader className="p-6 border-b border-zinc-100 shrink-0">
            <SheetTitle className="text-lg font-semibold tracking-tight text-zinc-900 flex items-center gap-2">
              <PackageSearch className="w-4 h-4 text-zinc-400" /> 
              {productForm.id ? "Edit Product Profile" : "Create Product Profile"}
            </SheetTitle>
          </SheetHeader>
          
          <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-8 bg-zinc-50/30">
            
            {/* MEDIA GALLERY SECTION */}
            <div className="space-y-4 bg-white p-5 rounded-xl border border-zinc-200/60 shadow-sm">
              <h3 className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500 flex items-center gap-1.5 border-b border-zinc-100 pb-3">
                <ImageIcon className="w-3.5 h-3.5" /> Media Gallery
              </h3>
              
              {/* Images Array */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                   <Label className="text-xs font-medium text-zinc-700">Images (Sequence matters)</Label>
                   <span className="text-[10px] text-zinc-400">{productForm.gallery_images.length} added</span>
                </div>
                <input type="file" ref={productImageInputRef} className="hidden" accept="image/*" multiple onChange={handleProductImageUpload} />
                <div className="grid grid-cols-4 gap-3">
                  {productForm.gallery_images.map((url, idx) => (
                    <div key={idx} className="relative aspect-square border border-zinc-200 rounded-lg group overflow-hidden bg-zinc-50">
                      <img src={url} alt={`Preview ${idx+1}`} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1">
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" className="h-6 w-6 text-white hover:bg-white/20" onClick={() => moveImage(idx, 'left')} disabled={idx === 0}>
                            <ArrowLeft className="w-3 h-3" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-6 w-6 text-white hover:bg-white/20" onClick={() => moveImage(idx, 'right')} disabled={idx === productForm.gallery_images.length - 1}>
                            <ArrowRight className="w-3 h-3" />
                          </Button>
                        </div>
                        <Button size="icon" variant="ghost" className="h-6 w-6 text-white hover:bg-white/20" onClick={() => removeImage(idx)}>
                          <Trash2 className="w-3 h-3 text-red-400" />
                        </Button>
                      </div>
                      <Badge className="absolute top-1 left-1 bg-black/70 text-white border-none text-[9px] px-1 py-0 shadow-none">#{idx + 1}</Badge>
                    </div>
                  ))}
                  <div 
                    className="aspect-square rounded-lg border border-dashed border-zinc-300 bg-zinc-50 flex flex-col items-center justify-center cursor-pointer hover:border-zinc-400 hover:bg-zinc-100 transition-colors"
                    onClick={() => productImageInputRef.current?.click()}
                  >
                    {isUploading ? (
                      <Loader2 className="w-5 h-5 animate-spin text-zinc-400" />
                    ) : (
                      <>
                        <Plus className="w-5 h-5 text-zinc-400 mb-1" />
                        <span className="text-[9px] text-zinc-500 font-medium">Add Image</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <Separator className="bg-zinc-100" />

              {/* Video Uploader */}
              <div className="space-y-3">
                <Label className="text-xs font-medium text-zinc-700 flex items-center justify-between">
                  <span>Short Video Clip (2-4 sec)</span>
                  <span className="text-[10px] text-zinc-400 font-normal">Optional</span>
                </Label>
                <input type="file" ref={productVideoInputRef} className="hidden" accept="video/mp4,video/quicktime,video/webm" onChange={handleProductVideoUpload} />
                {productForm.video_url ? (
                  <div className="relative w-full h-32 rounded-xl border border-zinc-200 overflow-hidden bg-black flex justify-center">
                    <video src={productForm.video_url} autoPlay loop muted playsInline className="h-full object-cover" />
                    <Button 
                      size="icon" 
                      variant="destructive" 
                      className="absolute top-2 right-2 h-7 w-7 opacity-80 hover:opacity-100 rounded-md"
                      onClick={() => setProductForm({ ...productForm, video_url: "" })}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ) : (
                  <div 
                    className="w-full h-16 rounded-xl border border-dashed border-zinc-300 bg-zinc-50/50 flex flex-col items-center justify-center cursor-pointer hover:border-zinc-400 hover:bg-zinc-100 transition-all"
                    onClick={() => productVideoInputRef.current?.click()}
                  >
                    {isVideoUploading ? (
                      <Loader2 className="w-5 h-5 animate-spin text-zinc-400" />
                    ) : (
                      <div className="flex items-center gap-2 text-zinc-500">
                        <Video className="w-4 h-4" />
                        <span className="text-[11px] font-medium">Upload Video File</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* BASIC INFO */}
            <div className="space-y-4 bg-white p-5 rounded-xl border border-zinc-200/60 shadow-sm">
              <h3 className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500 border-b border-zinc-100 pb-3">Basic Info</h3>
              <div className="space-y-4">
                <div>
                  <Label className="text-xs font-medium text-zinc-700 mb-1.5 block">Display Title <span className="text-red-500">*</span></Label>
                  <Input className="h-9 font-medium border-zinc-200 text-sm focus-visible:ring-zinc-900" value={productForm.title} onChange={e => setProductForm({...productForm, title: e.target.value})} placeholder="e.g. Classic Solitaire Ring" />
                </div>
                <div>
                  <Label className="text-xs font-medium text-zinc-700 mb-1.5 block">Category Assignment <span className="text-red-500">*</span></Label>
                  <select 
                    className="w-full h-9 px-3 border border-zinc-200 rounded-md text-sm bg-white focus:ring-1 focus:ring-zinc-900 outline-none"
                    value={productForm.category_id}
                    onChange={e => setProductForm({...productForm, category_id: e.target.value})}
                  >
                    <option value="" disabled>Select Target Category...</option>
                    {renderCategoryOptions(null, 0)}
                  </select>
                </div>
                <div>
                  <Label className="text-xs font-medium text-zinc-700 mb-1.5 block">Description</Label>
                  <textarea 
                    className="w-full h-20 p-3 border border-zinc-200 rounded-md text-sm bg-white focus:ring-1 focus:ring-zinc-900 outline-none resize-none custom-scrollbar"
                    value={productForm.description}
                    onChange={e => setProductForm({...productForm, description: e.target.value})}
                    placeholder="Provide details about the design, inspiration, etc."
                  />
                </div>
              </div>
            </div>

            {/* METAL & DIMENSIONS */}
            <div className="space-y-4 bg-white p-5 rounded-xl border border-zinc-200/60 shadow-sm">
              <h3 className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500 flex items-center gap-1.5 border-b border-zinc-100 pb-3">
                <Ruler className="w-3.5 h-3.5" /> Metal & Dimensions
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs font-medium text-zinc-700 mb-1.5 block">Metal Type</Label>
                  <Input className="h-9 text-sm border-zinc-200" value={productForm.metal_type} onChange={e => setProductForm({...productForm, metal_type: e.target.value})} placeholder="e.g. Gold" />
                </div>
                <div>
                  <Label className="text-xs font-medium text-zinc-700 mb-1.5 block">Metal Color</Label>
                  <Input className="h-9 text-sm border-zinc-200" value={productForm.metal_color} onChange={e => setProductForm({...productForm, metal_color: e.target.value})} placeholder="e.g. Rose Gold" />
                </div>
                <div>
                  <Label className="text-xs font-medium text-zinc-700 mb-1.5 block">Purity (Karat)</Label>
                  <Input className="h-9 text-sm border-zinc-200" value={productForm.purity_karat} onChange={e => setProductForm({...productForm, purity_karat: e.target.value})} placeholder="e.g. 18K" />
                </div>
                <div>
                  <Label className="text-xs font-medium text-zinc-700 mb-1.5 block">Item Size / Dimensions</Label>
                  <Input className="h-9 text-sm border-zinc-200" value={productForm.item_size} onChange={e => setProductForm({...productForm, item_size: e.target.value})} placeholder="e.g. Ring Size 12" />
                </div>
                <div>
                  <Label className="text-xs font-medium text-zinc-700 mb-1.5 block">Gross Wt (g)</Label>
                  <Input type="number" step="0.01" className="h-9 text-sm border-zinc-200" value={productForm.gross_weight_g} onChange={e => setProductForm({...productForm, gross_weight_g: e.target.value})} placeholder="0.00" />
                </div>
                <div>
                  <Label className="text-xs font-medium text-zinc-700 mb-1.5 block">Net Wt (g)</Label>
                  <Input type="number" step="0.01" className="h-9 text-sm border-zinc-200" value={productForm.net_weight_g} onChange={e => setProductForm({...productForm, net_weight_g: e.target.value})} placeholder="0.00" />
                </div>
              </div>
            </div>

            {/* DIAMONDS & STONES */}
            <div className="space-y-4 bg-white p-5 rounded-xl border border-zinc-200/60 shadow-sm">
              <h3 className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500 flex items-center gap-1.5 border-b border-zinc-100 pb-3">
                <Gem className="w-3.5 h-3.5" /> Diamond & Stone Specs
              </h3>
              
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className="text-[10px] text-zinc-500 mb-1 block">Shape</Label>
                  <Input className="h-8 text-xs border-zinc-200" value={productForm.diamond_shape} onChange={e => setProductForm({...productForm, diamond_shape: e.target.value})} placeholder="Round" />
                </div>
                <div>
                  <Label className="text-[10px] text-zinc-500 mb-1 block">Color</Label>
                  <Input className="h-8 text-xs border-zinc-200" value={productForm.diamond_color} onChange={e => setProductForm({...productForm, diamond_color: e.target.value})} placeholder="E-F" />
                </div>
                <div>
                  <Label className="text-[10px] text-zinc-500 mb-1 block">Clarity</Label>
                  <Input className="h-8 text-xs border-zinc-200" value={productForm.diamond_clarity} onChange={e => setProductForm({...productForm, diamond_clarity: e.target.value})} placeholder="VVS" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-x-4 gap-y-3 pt-3 border-t border-zinc-50">
                <div>
                  <Label className="text-[10px] text-zinc-500 mb-1 block">Solitaire Weight (cts)</Label>
                  <Input type="number" step="0.01" className="h-8 text-xs border-zinc-200" value={productForm.solitaire_weight_cts} onChange={e => setProductForm({...productForm, solitaire_weight_cts: e.target.value})} />
                </div>
                <div>
                  <Label className="text-[10px] text-zinc-500 mb-1 block">Solitaire Pieces</Label>
                  <Input type="number" className="h-8 text-xs border-zinc-200" value={productForm.solitaire_pieces} onChange={e => setProductForm({...productForm, solitaire_pieces: e.target.value})} />
                </div>
                <div>
                  <Label className="text-[10px] text-zinc-500 mb-1 block">Melee Weight (cts)</Label>
                  <Input type="number" step="0.01" className="h-8 text-xs border-zinc-200" value={productForm.melee_weight_cts} onChange={e => setProductForm({...productForm, melee_weight_cts: e.target.value})} />
                </div>
                <div>
                  <Label className="text-[10px] text-zinc-500 mb-1 block">Melee Pieces</Label>
                  <Input type="number" className="h-8 text-xs border-zinc-200" value={productForm.melee_pieces} onChange={e => setProductForm({...productForm, melee_pieces: e.target.value})} />
                </div>
                <div>
                  <Label className="text-[10px] text-zinc-500 mb-1 block">Color Stone (cts)</Label>
                  <Input type="number" step="0.01" className="h-8 text-xs border-zinc-200" value={productForm.color_stone_weight_cts} onChange={e => setProductForm({...productForm, color_stone_weight_cts: e.target.value})} />
                </div>
                <div>
                  <Label className="text-[10px] text-zinc-500 mb-1 block">Color Stone Pieces</Label>
                  <Input type="number" className="h-8 text-xs border-zinc-200" value={productForm.color_stone_pieces} onChange={e => setProductForm({...productForm, color_stone_pieces: e.target.value})} />
                </div>
                <div className="col-span-2 pt-2">
                  <Label className="text-[10px] font-bold text-zinc-700 mb-1 block">Total Stone Weight (cts)</Label>
                  <Input type="number" step="0.01" className="h-8 text-xs border-zinc-200 bg-zinc-50" value={productForm.stone_weight_cts} onChange={e => setProductForm({...productForm, stone_weight_cts: e.target.value})} />
                </div>
              </div>
            </div>

            {/* ERP MAPPING LOGIC */}
            <div className="bg-amber-50/50 border border-amber-100 p-5 rounded-xl space-y-4 shadow-sm">
              <h3 className="text-[11px] font-semibold uppercase tracking-widest text-amber-700 flex items-center gap-1.5">
                <Settings2 className="w-3.5 h-3.5" /> ERP Integration Mapping
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs font-medium text-amber-900 mb-1.5 block">Master SKU (Optional)</Label>
                  <Input className="h-9 font-mono text-xs border-amber-200 uppercase bg-white" value={productForm.sku_reference} onChange={e => setProductForm({...productForm, sku_reference: e.target.value})} placeholder="RNG-042" />
                </div>
                <div>
                  <Label className="text-xs font-medium text-amber-900 mb-1.5 block">Legacy Item No (Fallback)</Label>
                  <Input className="h-9 font-mono text-xs border-amber-200 uppercase bg-white" value={productForm.legacy_item_no} onChange={e => setProductForm({...productForm, legacy_item_no: e.target.value})} placeholder="OLD-TAG" />
                </div>
              </div>
            </div>

            {/* FINANCIAL & FULFILLMENT */}
            <div className="space-y-4 bg-white p-5 rounded-xl border border-zinc-200/60 shadow-sm">
              <h3 className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500 border-b border-zinc-100 pb-3">Financials & Fulfillment</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs font-medium text-zinc-700 mb-1.5 block">Base MRP (₹) <span className="text-red-500">*</span></Label>
                  <Input type="number" className="h-9 text-sm font-medium border-zinc-200 focus-visible:ring-zinc-900" value={productForm.mrp} onChange={e => setProductForm({...productForm, mrp: e.target.value})} />
                </div>
                <div>
                  <Label className="text-xs font-medium text-zinc-700 mb-1.5 block">Buffer (Days)</Label>
                  <Input type="number" className="h-9 text-sm font-medium border-zinc-200 focus-visible:ring-zinc-900" value={productForm.manufacturing_buffer_days} onChange={e => setProductForm({...productForm, manufacturing_buffer_days: e.target.value})} />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between bg-zinc-50 border border-zinc-200 p-4 rounded-xl shadow-sm">
              <div>
                <p className="text-sm font-semibold text-zinc-900">Publish to Web</p>
                <p className="text-[11px] text-zinc-500 mt-0.5">Allow customers to view and order.</p>
              </div>
              <Switch checked={productForm.is_live} onCheckedChange={v => setProductForm({...productForm, is_live: v})} className="data-[state=checked]:bg-zinc-900" />
            </div>

          </div>

          <SheetFooter className="p-4 border-t border-zinc-100 shrink-0 bg-white">
            <Button onClick={handleSaveProduct} disabled={isSubmitting || isUploading || isVideoUploading} className="w-full h-10 bg-zinc-900 hover:bg-zinc-800 text-white font-medium text-sm rounded-lg shadow-sm transition-all">
              {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
              {productForm.id ? "Update Profile" : "Save to Catalog"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

    </div>
  );
}