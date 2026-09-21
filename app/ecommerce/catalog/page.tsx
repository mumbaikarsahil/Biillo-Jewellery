"use client";

import React, { useEffect, useState, useRef } from "react";
import { 
  Plus, Search, Edit2, Image as ImageIcon, CheckCircle2, 
  XCircle, Globe, PackageSearch, Layers, FolderTree, 
  Loader2, Settings2, CornerDownRight, UploadCloud, X,
  ArrowLeft, ArrowRight, Trash2, Video, Gem, Ruler, FileSpreadsheet, PlayCircle, ChevronLeft, ChevronRight, Save, EyeOff, Gift
} from "lucide-react";

import { supabase } from "@/lib/supabaseClient"; // Adjust to your actual path
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";

export default function EcommerceCatalogPage() {
  const { appUser } = useAuth();
  const { toast } = useToast();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const productImageInputRef = useRef<HTMLInputElement>(null);
  const productVideoInputRef = useRef<HTMLInputElement>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);

  // Data States
  const [categories, setCategories] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [occasions, setOccasions] = useState<any[]>([]); // ✨ NEW: Occasions State
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | "all">("all");
  const [isLoading, setIsLoading] = useState(true);
  const [isProductsLoading, setIsProductsLoading] = useState(false);
  
  // Dashboard Filters & Pagination
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "live" | "draft">("all");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

  // Bulk Actions State
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);
  const [isBulkMoveModalOpen, setIsBulkMoveModalOpen] = useState(false);
  const [bulkMoveTargetCategory, setBulkMoveTargetCategory] = useState("");

  // Modal / Sheet States
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [isProductSheetOpen, setIsProductSheetOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isVideoUploading, setIsVideoUploading] = useState(false);

  // Migration Wizard States
  const [isMigrationModalOpen, setIsMigrationModalOpen] = useState(false);
  const [parsedCsvData, setParsedCsvData] = useState<any[]>([]);
  const [isProcessingMigration, setIsProcessingMigration] = useState(false);
  const [migrationProgress, setMigrationProgress] = useState({ total: 0, current: 0, failed: 0 });
  
  const [previewPage, setPreviewPage] = useState(1);
  const previewPageSize = 20;
  const [editingPreviewIndex, setEditingPreviewIndex] = useState<number | null>(null);
  const [editingPreviewItem, setEditingPreviewItem] = useState<any>(null);

  // Form States
  const [categoryForm, setCategoryForm] = useState({ id: "", name: "", is_active: true, parent_id: "none", image_url: "" });
  const [productForm, setProductForm] = useState({
    id: "", title: "", category_id: "", sku_reference: "", legacy_item_no: "", description: "", mrp: "", 
    gallery_images: [] as string[], video_url: "", manufacturing_buffer_days: "14", is_live: false,
    metal_type: "Gold", metal_color: "Yellow", purity_karat: "18K", item_size: "", gross_weight_g: "", net_weight_g: "",
    diamond_shape: "", diamond_color: "", diamond_clarity: "", stone_weight_cts: "", solitaire_weight_cts: "", 
    solitaire_pieces: "", melee_weight_cts: "", melee_pieces: "", color_stone_weight_cts: "", color_stone_pieces: "",
    occasion_ids: [] as string[] // ✨ NEW: Assigned Occasions
  });

  // ==========================================================================
  // CLIENT-SIDE WEBP CONVERTER UTILITY
  // ==========================================================================
  const convertFileToWebP = async (file: File, quality = 0.85): Promise<Blob> => {
    if (file.type === "image/webp") return file;
    try {
      const bitmap = await createImageBitmap(file);
      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas context unavailable");
      ctx.drawImage(bitmap, 0, 0);

      return new Promise((resolve, reject) => {
        canvas.toBlob(
          (blob) => (blob ? resolve(blob) : reject(new Error("WebP conversion failed"))),
          "image/webp",
          quality
        );
      });
    } catch {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement("canvas");
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext("2d");
            ctx?.drawImage(img, 0, 0);
            canvas.toBlob(
              (blob) => (blob ? resolve(blob) : reject(new Error("WebP conversion failed"))),
              "image/webp",
              quality
            );
          };
          img.onerror = () => reject(new Error("Failed to load image file"));
          img.src = e.target?.result as string;
        };
        reader.onerror = () => reject(new Error("Failed to read image file"));
        reader.readAsDataURL(file);
      });
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
        const webpBlob = await convertFileToWebP(file, 0.85);
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.webp`;
        const filePath = `${appUser.company_id}/products/${fileName}`;

        const { error: uploadError } = await supabase.storage.from("ecommerce-assets").upload(filePath, webpBlob, { contentType: "image/webp" });
        if (uploadError) throw uploadError;

        const { data } = supabase.storage.from("ecommerce-assets").getPublicUrl(filePath);
        uploadedUrls.push(data.publicUrl);
      }
      setProductForm((prev) => ({ ...prev, gallery_images: [...prev.gallery_images, ...uploadedUrls] }));
      toast({ title: "Images Uploaded", description: `Converted ${files.length} image(s) to WebP.` });
    } catch (err: any) {
      toast({ title: "Image Upload Failed", description: err.message, variant: "destructive" });
    } finally {
      setIsUploading(false);
      if (e.target) e.target.value = "";
    }
  };

  const handleCategoryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !appUser?.company_id) return;
    setIsUploading(true);
    try {
      const webpBlob = await convertFileToWebP(file, 0.85);
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.webp`;
      const filePath = `${appUser.company_id}/categories/${fileName}`;
      const { error: uploadError } = await supabase.storage.from("ecommerce-assets").upload(filePath, webpBlob, { contentType: "image/webp" });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from("ecommerce-assets").getPublicUrl(filePath);
      setCategoryForm((prev) => ({ ...prev, image_url: data.publicUrl }));
      toast({ title: "Category Image Uploaded" });
    } catch (err: any) {
      toast({ title: "Upload Failed", description: err.message, variant: "destructive" });
    } finally {
      setIsUploading(false);
      if (e.target) e.target.value = "";
    }
  };

  const moveImage = (index: number, direction: "left" | "right") => {
    const newImages = [...productForm.gallery_images];
    if (direction === "left" && index > 0) {
      [newImages[index - 1], newImages[index]] = [newImages[index], newImages[index - 1]];
    } else if (direction === "right" && index < newImages.length - 1) {
      [newImages[index + 1], newImages[index]] = [newImages[index], newImages[index + 1]];
    }
    setProductForm({ ...productForm, gallery_images: newImages });
  };

  const removeImage = (index: number) => {
    setProductForm({ ...productForm, gallery_images: productForm.gallery_images.filter((_, i) => i !== index) });
  };

  // ==========================================================================
  // FETCHING LOGIC
  // ==========================================================================
  
  const fetchOccasions = async () => {
    const { data } = await supabase.from("ecommerce_occasions").select("*").eq("is_active", true).order("sort_order");
    if (data) setOccasions(data);
  };

  const fetchCategories = async () => {
    if (!appUser?.company_id) return;
    try {
      const { data, error } = await supabase.from("ecommerce_categories").select("*").eq("company_id", appUser.company_id).order("name", { ascending: true });
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
      // ✨ NEW: Included ecommerce_product_occasions in the fetch query
      let query = supabase.from("ecommerce_products")
        .select(`*, category:ecommerce_categories(name), product_occasions:ecommerce_product_occasions(occasion_id)`)
        .eq("company_id", appUser.company_id)
        .order("created_at", { ascending: false });
        
      if (selectedCategoryId !== "all") query = query.eq("category_id", selectedCategoryId);
      
      const { data, error } = await query;
      if (error) throw error;
      setProducts(data || []);
      setSelectedIds(new Set());
    } catch (err: any) {
      toast({ title: "Failed to load products", description: err.message, variant: "destructive" });
    } finally {
      setIsProductsLoading(false);
      setIsLoading(false);
    }
  };

  useEffect(() => { 
    if (appUser) {
      fetchCategories(); 
      fetchOccasions();
    }
  }, [appUser]);

  useEffect(() => { 
    fetchProducts(); 
    setCurrentPage(1); 
  }, [appUser, selectedCategoryId]);

  useEffect(() => { setCurrentPage(1); }, [searchQuery, statusFilter]);

  // ==========================================================================
  // SAVE LOGIC
  // ==========================================================================

  const handleSaveCategory = async () => {
    if (!categoryForm.name.trim() || !appUser) return;
    setIsSubmitting(true);
    try {
      let parentSlug = "";
      if (categoryForm.parent_id !== "none") {
        const parentCategory = categories.find((c) => c.id === categoryForm.parent_id);
        if (parentCategory && parentCategory.slug) parentSlug = parentCategory.slug;
      }
      const cleanNameSlug = categoryForm.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "");
      const finalSlug = parentSlug ? `${parentSlug}-${cleanNameSlug}` : cleanNameSlug;

      const payload: any = {
        company_id: appUser.company_id,
        name: categoryForm.name.trim(),
        slug: finalSlug,
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
      fetchCategories();
    } catch (err: any) {
      toast({ title: "Error saving category", description: err.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveProduct = async () => {
    if (!productForm.title || !productForm.mrp || !productForm.category_id || !appUser) {
      toast({ title: "Missing Fields", description: "Title, Category, and Base MRP are required.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    try {
      const payload: any = {
        company_id: appUser.company_id,
        category_id: productForm.category_id,
        title: productForm.title.trim(),
        sku_reference: productForm.sku_reference?.trim().toUpperCase() || null,
        legacy_item_no: productForm.legacy_item_no?.trim() || null,
        description: productForm.description?.trim() || null,
        gallery_images: productForm.gallery_images,
        cover_image_url: productForm.gallery_images.length > 0 ? productForm.gallery_images[0] : null,
        video_url: productForm.video_url?.trim() || null,
        metal_type: productForm.metal_type?.trim() || null,
        metal_color: productForm.metal_color?.trim() || null,
        purity_karat: productForm.purity_karat?.trim() || null,
        item_size: productForm.item_size?.trim() || null,
        gross_weight_g: Number(productForm.gross_weight_g) || 0,
        net_weight_g: Number(productForm.net_weight_g) || 0,
        diamond_shape: productForm.diamond_shape?.trim() || null,
        diamond_color: productForm.diamond_color?.trim() || null,
        diamond_clarity: productForm.diamond_clarity?.trim() || null,
        stone_weight_cts: Number(productForm.stone_weight_cts) || 0,
        solitaire_weight_cts: Number(productForm.solitaire_weight_cts) || 0,
        solitaire_pieces: Number(productForm.solitaire_pieces) || 0,
        melee_weight_cts: Number(productForm.melee_weight_cts) || 0,
        melee_pieces: Number(productForm.melee_pieces) || 0,
        color_stone_weight_cts: Number(productForm.color_stone_weight_cts) || 0,
        color_stone_pieces: Number(productForm.color_stone_pieces) || 0,
        mrp: Number(productForm.mrp),
        manufacturing_buffer_days: Number(productForm.manufacturing_buffer_days) || 14,
        is_live: productForm.is_live
      };

      let savedProductId = productForm.id;

      if (productForm.id) {
        const { error } = await supabase.from("ecommerce_products").update(payload).eq("id", productForm.id);
        if (error) throw error;
      } else {
        payload.slug = productForm.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "") + `-${Math.floor(Math.random() * 1000)}`;
        const { data, error } = await supabase.from("ecommerce_products").insert(payload).select().single();
        if (error) throw error;
        savedProductId = data.id;
      }

      // ✨ NEW: Save Product Occasion Links
      if (savedProductId) {
        await supabase.from("ecommerce_product_occasions").delete().eq("product_id", savedProductId);
        if (productForm.occasion_ids.length > 0) {
          const links = productForm.occasion_ids.map(oid => ({ product_id: savedProductId, occasion_id: oid }));
          await supabase.from("ecommerce_product_occasions").insert(links);
        }
      }

      toast({ title: productForm.id ? "Product Updated" : "Product Created" });
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
      setProducts(products.map((p) => (p.id === id ? { ...p, is_live: !currentStatus } : p)));
    } catch (err: any) {
      toast({ title: "Status Update Failed", description: err.message, variant: "destructive" });
    }
  };

  // Bulk Actions
  const toggleSelectAll = (currentPageIds: string[]) => {
    const newSelection = new Set(selectedIds);
    const allSelected = currentPageIds.every((id) => newSelection.has(id));
    if (allSelected) currentPageIds.forEach((id) => newSelection.delete(id));
    else currentPageIds.forEach((id) => newSelection.add(id));
    setSelectedIds(newSelection);
  };
  const toggleSelect = (id: string) => {
    const newSelection = new Set(selectedIds);
    if (newSelection.has(id)) newSelection.delete(id);
    else newSelection.add(id);
    setSelectedIds(newSelection);
  };

  const handleBulkStatusChange = async (makeLive: boolean) => {
    if (selectedIds.size === 0) return;
    setIsBulkProcessing(true);
    try {
      const idsArray = Array.from(selectedIds);
      const { error } = await supabase.from("ecommerce_products").update({ is_live: makeLive }).in("id", idsArray);
      if (error) throw error;
      setProducts(products.map((p) => (selectedIds.has(p.id) ? { ...p, is_live: makeLive } : p)));
      setSelectedIds(new Set());
      toast({ title: "Bulk Update Successful" });
    } catch (err: any) { toast({ title: "Bulk Update Failed", description: err.message, variant: "destructive" }); } 
    finally { setIsBulkProcessing(false); }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Are you sure you want to permanently delete ${selectedIds.size} products?`)) return;
    setIsBulkProcessing(true);
    try {
      const idsArray = Array.from(selectedIds);
      const { error } = await supabase.from("ecommerce_products").delete().in("id", idsArray);
      if (error) throw error;
      setProducts(products.filter((p) => !selectedIds.has(p.id)));
      setSelectedIds(new Set());
      toast({ title: "Products Deleted" });
    } catch (err: any) { toast({ title: "Deletion Failed", description: err.message, variant: "destructive" }); } 
    finally { setIsBulkProcessing(false); }
  };

  const handleBulkMove = async () => {
    if (!bulkMoveTargetCategory || selectedIds.size === 0) return;
    setIsBulkProcessing(true);
    try {
      const idsArray = Array.from(selectedIds);
      const { error } = await supabase.from("ecommerce_products").update({ category_id: bulkMoveTargetCategory }).in("id", idsArray);
      if (error) throw error;
      toast({ title: "Products Moved" });
      setSelectedIds(new Set());
      setIsBulkMoveModalOpen(false);
      setBulkMoveTargetCategory("");
      fetchProducts();
    } catch (err: any) { toast({ title: "Move Failed", description: err.message, variant: "destructive" }); } 
    finally { setIsBulkProcessing(false); }
  };

  // Rendering
  const filteredProducts = products.filter((p) => {
    let match = true;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      match = p.title.toLowerCase().includes(q) || (p.sku_reference && p.sku_reference.toLowerCase().includes(q)) || (p.legacy_item_no && p.legacy_item_no.toLowerCase().includes(q));
    }
    if (match && statusFilter !== "all") match = statusFilter === "live" ? p.is_live : !p.is_live;
    return match;
  });

  const totalPages = Math.ceil(filteredProducts.length / pageSize);
  const paginatedProducts = filteredProducts.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const paginatedIds = paginatedProducts.map((p) => p.id);
  const isCurrentPageAllSelected = paginatedIds.length > 0 && paginatedIds.every((id) => selectedIds.has(id));

  const renderCategoryTree = (parentId: string | null = null, depth = 0) => {
    const children = categories.filter((c) => c.parent_id === parentId);
    return children.map((cat) => (
      <React.Fragment key={cat.id}>
        <div className="flex items-center gap-1 group" style={{ paddingLeft: `${depth * 16}px` }}>
          <button
            onClick={() => setSelectedCategoryId(cat.id)}
            className={`flex-1 flex items-center justify-between px-3 py-1.5 rounded-md text-sm font-medium transition-all tracking-tight ${selectedCategoryId === cat.id ? "bg-zinc-100 text-zinc-900" : "text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50"}`}
          >
            <div className="flex items-center gap-2 truncate">
              {depth > 0 && <CornerDownRight className="w-3.5 h-3.5 text-zinc-300 shrink-0" />}
              <span className="truncate">{cat.name}</span>
              {!cat.is_active && <XCircle className="w-3 h-3 text-zinc-400 shrink-0 ml-1" />}
            </div>
          </button>
          
          <button
            onClick={(e) => {
              e.stopPropagation();
              setCategoryForm({ id: cat.id, name: cat.name, is_active: cat.is_active, parent_id: cat.parent_id || "none", image_url: cat.image_url || "" });
              setIsCategoryModalOpen(true);
            }}
            className="p-1.5 text-zinc-400 hover:text-zinc-900 hover:bg-zinc-200 rounded-md transition-colors opacity-0 group-hover:opacity-100"
            title="Edit / Move Category"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>
        </div>
        {renderCategoryTree(cat.id, depth + 1)}
      </React.Fragment>
    ));
  };

  const renderCategoryOptions = (parentId: string | null = null, depth = 0) => {
    const children = categories.filter((c) => c.parent_id === parentId);
    return children.map((cat) => (
      <React.Fragment key={cat.id}>
        <option value={cat.id} disabled={!cat.is_active} className={!cat.is_active ? "text-zinc-300" : ""}>
          {"\u00A0\u00A0\u00A0".repeat(depth)}{depth > 0 ? "↳ " : ""}{cat.name} {!cat.is_active ? "(Hidden)" : ""}
        </option>
        {renderCategoryOptions(cat.id, depth + 1)}
      </React.Fragment>
    ));
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#fafafa] font-sans pb-20 w-full">
      
      <header className="sticky top-0 z-40 w-full bg-white/80 backdrop-blur-md border-b border-zinc-200 px-6 h-14 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="h-7 w-7 rounded-md bg-zinc-900 flex items-center justify-center shadow-sm border border-zinc-800">
            <PackageSearch className="h-4 w-4 text-white" />
          </div>
          <div className="flex items-center gap-2">
            <h1 className="font-semibold text-zinc-900 tracking-tight text-sm">E-Commerce OS</h1>
            <span className="text-zinc-300">/</span>
            <p className="text-sm font-medium text-zinc-500">Master Catalog</p>
          </div>
        </div>
      </header>

      <main className="p-6 max-w-[1600px] mx-auto w-full flex-1 animate-in fade-in duration-500 flex flex-col lg:flex-row gap-8">
        
        {/* LEFT PANE */}
        <div className="w-full lg:w-64 shrink-0 space-y-4">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-[11px] font-semibold uppercase tracking-widest text-zinc-400 flex items-center gap-1.5">
              <FolderTree className="w-3.5 h-3.5" /> Product Lines
            </h2>
            <Button variant="ghost" size="icon" className="h-6 w-6 text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 rounded-md"
              onClick={() => { setCategoryForm({ id: "", name: "", is_active: true, parent_id: "none", image_url: "" }); setIsCategoryModalOpen(true); }}
            ><Plus className="w-4 h-4" /></Button>
          </div>
          <div className="flex flex-col gap-0.5">
            <button onClick={() => setSelectedCategoryId("all")}
              className={`w-full flex items-center justify-between px-3 py-1.5 rounded-md text-sm font-medium transition-all tracking-tight ${selectedCategoryId === "all" ? "bg-zinc-900 text-white" : "text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100/50"}`}
            >All Products</button>
            <div className="flex flex-col gap-0.5 mt-2">
               {renderCategoryTree(null, 0)}
            </div>
          </div>
        </div>

        {/* RIGHT PANE */}
        <div className="flex-1 space-y-4 min-w-0">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-white p-3 rounded-xl border border-zinc-200 shadow-sm">
            <div className="relative w-full sm:flex-1 flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                <Input 
                  placeholder="Search Title, SKU or Legacy No..." 
                  className="pl-9 h-9 border-zinc-200 focus-visible:ring-0 bg-transparent text-sm tracking-tight font-medium text-zinc-900 placeholder:text-zinc-400"
                  value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <select 
                className="h-9 px-3 border border-zinc-200 rounded-md text-sm font-medium bg-zinc-50 focus:ring-1 focus:ring-zinc-900 outline-none text-zinc-600"
                value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)}
              >
                <option value="all">All Status</option>
                <option value="live">Live Web</option>
                <option value="draft">Drafts / Hidden</option>
              </select>
            </div>
            
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <input type="file" ref={csvInputRef} className="hidden" accept=".csv" />
              <Button onClick={() => csvInputRef.current?.click()} className="flex-1 sm:flex-none h-9 bg-white text-zinc-700 hover:bg-zinc-50 border border-zinc-200 font-medium tracking-tight shadow-sm rounded-lg">
                <FileSpreadsheet className="w-4 h-4 mr-1.5 text-emerald-600" /> Bulk Import
              </Button>
              <Button onClick={() => { 
                setProductForm({ id: "", title: "", category_id: selectedCategoryId !== "all" ? selectedCategoryId : "", sku_reference: "", legacy_item_no: "", description: "", mrp: "", gallery_images: [], video_url: "", manufacturing_buffer_days: "14", is_live: false, metal_type: "Gold", metal_color: "Yellow", purity_karat: "18K", item_size: "", gross_weight_g: "", net_weight_g: "", diamond_shape: "", diamond_color: "", diamond_clarity: "", stone_weight_cts: "", solitaire_weight_cts: "", solitaire_pieces: "", melee_weight_cts: "", melee_pieces: "", color_stone_weight_cts: "", color_stone_pieces: "", occasion_ids: [] }); 
                setIsProductSheetOpen(true); 
              }} className="flex-1 sm:flex-none h-9 bg-zinc-900 hover:bg-zinc-800 text-white font-medium tracking-tight rounded-lg shadow-sm">
                <Plus className="w-4 h-4 mr-1.5" /> New Product
              </Button>
            </div>
          </div>

          {selectedIds.size > 0 && (
            <div className="flex items-center justify-between bg-indigo-50 border border-indigo-200 p-3 rounded-xl animate-in slide-in-from-bottom-2 duration-200 shadow-sm flex-wrap gap-3">
              <div className="flex items-center gap-2 text-indigo-700">
                <span className="flex h-5 w-5 bg-white rounded items-center justify-center text-xs font-bold shadow-sm">{selectedIds.size}</span>
                <span className="text-sm font-semibold tracking-tight">Products Selected</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button disabled={isBulkProcessing} size="sm" variant="outline" className="h-8 bg-white border-blue-200 text-blue-700 hover:bg-blue-100" onClick={() => setIsBulkMoveModalOpen(true)}><FolderTree className="w-3.5 h-3.5 mr-1.5"/> Move</Button>
                <Button disabled={isBulkProcessing} size="sm" variant="outline" className="h-8 bg-white border-indigo-200 text-indigo-700 hover:bg-indigo-100" onClick={() => handleBulkStatusChange(true)}><Globe className="w-3.5 h-3.5 mr-1.5"/> Make Live</Button>
                <Button disabled={isBulkProcessing} size="sm" variant="outline" className="h-8 bg-white border-amber-200 text-amber-700 hover:bg-amber-100" onClick={() => handleBulkStatusChange(false)}><EyeOff className="w-3.5 h-3.5 mr-1.5"/> Set to Draft</Button>
                <Button disabled={isBulkProcessing} size="sm" variant="outline" className="h-8 bg-white border-rose-200 text-rose-700 hover:bg-rose-100" onClick={handleBulkDelete}><Trash2 className="w-3.5 h-3.5 mr-1.5"/> Delete</Button>
              </div>
            </div>
          )}

          <Card className="shadow-sm border-zinc-200 bg-white rounded-xl overflow-hidden flex flex-col">
            <div className="overflow-x-auto custom-scrollbar flex-1 min-h-[400px]">
              <Table className="whitespace-nowrap">
                <TableHeader className="bg-zinc-50/80 border-b border-zinc-200 sticky top-0 z-10 backdrop-blur-sm">
                  <TableRow className="hover:bg-transparent border-none">
                    <TableHead className="w-[40px] px-4"><input type="checkbox" className="rounded border-zinc-300 w-3.5 h-3.5 accent-indigo-600 cursor-pointer" checked={isCurrentPageAllSelected} onChange={() => toggleSelectAll(paginatedIds)} /></TableHead>
                    <TableHead className="w-[60px]"></TableHead>
                    <TableHead className="text-xs font-semibold tracking-tight text-zinc-500 h-10">Product Info</TableHead>
                    <TableHead className="text-xs font-semibold tracking-tight text-zinc-500 h-10">Identifiers</TableHead>
                    <TableHead className="text-xs font-semibold tracking-tight text-zinc-500 h-10 text-right">Base MRP</TableHead>
                    <TableHead className="text-xs font-semibold tracking-tight text-zinc-500 h-10 text-center">Web Status</TableHead>
                    <TableHead className="w-[60px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading || isProductsLoading ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-20"><Loader2 className="w-6 h-6 animate-spin mx-auto text-zinc-300" /></TableCell></TableRow>
                  ) : paginatedProducts.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-20 text-sm text-zinc-500 font-medium">No master products match this criteria.</TableCell></TableRow>
                  ) : (
                    paginatedProducts.map((product) => {
                      const isSelected = selectedIds.has(product.id);
                      return (
                        <TableRow key={product.id} className={`transition-colors border-zinc-100/60 ${isSelected ? "bg-indigo-50/30" : "hover:bg-zinc-50/50"}`}>
                          <TableCell className="px-4"><input type="checkbox" className="rounded border-zinc-300 w-3.5 h-3.5 accent-indigo-600 cursor-pointer" checked={isSelected} onChange={() => toggleSelect(product.id)} /></TableCell>
                          <TableCell className="px-2 py-3">
                            {product.cover_image_url || (product.gallery_images && product.gallery_images.length > 0) ? (
                              <img src={product.cover_image_url || product.gallery_images[0]} alt="Cover" className="w-10 h-10 rounded-md object-cover border border-zinc-200 shadow-sm" />
                            ) : <div className="w-10 h-10 rounded-md bg-zinc-50 border border-zinc-200 flex items-center justify-center"><ImageIcon className="w-4 h-4 text-zinc-300" /></div>}
                          </TableCell>
                          <TableCell className="px-4 py-3">
                            <div className="font-semibold tracking-tight text-sm text-zinc-900 truncate max-w-[280px]">{product.title}</div>
                            <div className="text-xs font-medium text-zinc-500 mt-0.5">{product.category?.name || "Uncategorized"}</div>
                          </TableCell>
                          <TableCell className="px-4 py-3">
                            <div className="flex flex-col gap-1 items-start">
                              {product.sku_reference ? <span className="text-[10px] font-mono font-semibold text-zinc-700 bg-zinc-100 px-1.5 py-0.5 rounded flex items-center gap-1 border border-zinc-200/60"><PackageSearch className="w-3 h-3 text-zinc-400" /> {product.sku_reference}</span> : <span className="text-[10px] font-medium text-zinc-400 italic">No SKU</span>}
                              {product.legacy_item_no && <span className="text-[9px] font-mono text-zinc-500 flex items-center gap-1 pl-1"><Layers className="w-2.5 h-2.5 opacity-50" /> {product.legacy_item_no}</span>}
                            </div>
                          </TableCell>
                          <TableCell className="px-4 py-3 text-right"><div className="font-semibold text-sm text-zinc-900 tracking-tight">₹{Number(product.mrp).toLocaleString()}</div></TableCell>
                          <TableCell className="px-4 py-3 text-center"><div className="flex items-center justify-center gap-2"><Switch checked={product.is_live} onCheckedChange={() => toggleProductLiveStatus(product.id, product.is_live)} className="data-[state=checked]:bg-emerald-600 scale-90" />{product.is_live ? <Globe className="w-4 h-4 text-emerald-600" /> : <EyeOff className="w-4 h-4 text-zinc-300" />}</div></TableCell>
                          <TableCell className="px-4 text-right">
                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-md text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 transition-colors" 
                              onClick={() => {
                                // Extract the occasion_ids from the joined table
                                const currentOccasionIds = product.product_occasions?.map((po: any) => po.occasion_id) || [];
                                setProductForm({
                                  id: product.id, title: product.title || "", category_id: product.category_id || "", sku_reference: product.sku_reference || "", legacy_item_no: product.legacy_item_no || "", description: product.description || "", mrp: product.mrp?.toString() || "", gallery_images: product.gallery_images || (product.cover_image_url ? [product.cover_image_url] : []), video_url: product.video_url || "", manufacturing_buffer_days: product.manufacturing_buffer_days?.toString() || "14", is_live: product.is_live || false, metal_type: product.metal_type || "Gold", metal_color: product.metal_color || "Yellow", purity_karat: product.purity_karat || "18K", item_size: product.item_size || "", gross_weight_g: product.gross_weight_g?.toString() || "", net_weight_g: product.net_weight_g?.toString() || "", diamond_shape: product.diamond_shape || "", diamond_color: product.diamond_color || "", diamond_clarity: product.diamond_clarity || "", stone_weight_cts: product.stone_weight_cts?.toString() || "", solitaire_weight_cts: product.solitaire_weight_cts?.toString() || "", solitaire_pieces: product.solitaire_pieces?.toString() || "", melee_weight_cts: product.melee_weight_cts?.toString() || "", melee_pieces: product.melee_pieces?.toString() || "", color_stone_weight_cts: product.color_stone_weight_cts?.toString() || "", color_stone_pieces: product.color_stone_pieces?.toString() || "", 
                                  occasion_ids: currentOccasionIds
                                });
                                setIsProductSheetOpen(true);
                              }}>
                              <Edit2 className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
            
            {totalPages > 1 && (
              <div className="p-3 bg-zinc-50 border-t border-zinc-200 flex items-center justify-between">
                <span className="text-xs font-medium text-zinc-500 px-2">
                  Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, filteredProducts.length)} of <span className="font-bold text-zinc-900">{filteredProducts.length}</span> results
                </span>
                <div className="flex gap-1.5">
                  <Button variant="outline" size="sm" className="h-8 text-xs px-3 shadow-sm bg-white" disabled={currentPage === 1} onClick={() => setCurrentPage((p) => p - 1)}><ChevronLeft className="w-3.5 h-3.5 mr-1"/> Prev</Button>
                  <Button variant="outline" size="sm" className="h-8 text-xs px-3 shadow-sm bg-white" disabled={currentPage === totalPages} onClick={() => setCurrentPage((p) => p + 1)}>Next <ChevronRight className="w-3.5 h-3.5 ml-1"/></Button>
                </div>
              </div>
            )}
          </Card>
        </div>
      </main>

      {/* ========================================================================== */}
      {/* BULK MOVE MODAL (Omitted to keep code length reasonable, unchanged) */}
      {/* ========================================================================== */}

      {/* ========================================================================== */}
      {/* CATEGORY MODAL (Omitted to keep code length reasonable, unchanged) */}
      {/* ========================================================================== */}

      {/* ========================================================================== */}
      {/* PRODUCT PROFILE SHEET (EDIT & CREATE) */}
      {/* ========================================================================== */}
      <Sheet open={isProductSheetOpen} onOpenChange={(o) => !o && setIsProductSheetOpen(false)}>
        <SheetContent className="w-full sm:max-w-[550px] p-0 border-l border-zinc-200 shadow-2xl flex flex-col bg-[#fafafa]">
          <SheetHeader className="p-6 border-b border-zinc-200 bg-white shrink-0">
            <SheetTitle className="text-lg font-semibold tracking-tight text-zinc-900 flex items-center gap-2">
              <PackageSearch className="w-4 h-4 text-zinc-400" /> {productForm.id ? "Edit Product Profile" : "Create Product Profile"}
            </SheetTitle>
          </SheetHeader>
          
          <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
            
            {/* Gallery Section */}
            <div className="space-y-4 bg-white p-5 rounded-xl border border-zinc-200 shadow-sm">
              <h3 className="text-xs font-semibold tracking-tight text-zinc-900 border-b border-zinc-100 pb-3 flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-zinc-400" /> Media Gallery
              </h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-medium text-zinc-600">Images (Sequence matters)</Label>
                  <span className="text-[10px] font-medium text-zinc-400">{productForm.gallery_images.length} added</span>
                </div>
                <input type="file" ref={productImageInputRef} className="hidden" accept="image/*" multiple onChange={handleProductImageUpload} />
                <div className="grid grid-cols-4 gap-3">
                  {productForm.gallery_images.map((url, idx) => (
                    <div key={idx} className="relative aspect-square border border-zinc-200 rounded-lg group overflow-hidden bg-zinc-50">
                      <img src={url} alt={`Preview ${idx + 1}`} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1">
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" className="h-6 w-6 text-white hover:bg-white/20" onClick={() => moveImage(idx, "left")} disabled={idx === 0}><ArrowLeft className="w-3 h-3" /></Button>
                          <Button size="icon" variant="ghost" className="h-6 w-6 text-white hover:bg-white/20" onClick={() => moveImage(idx, "right")} disabled={idx === productForm.gallery_images.length - 1}><ArrowRight className="w-3 h-3" /></Button>
                        </div>
                        <Button size="icon" variant="ghost" className="h-6 w-6 text-white hover:bg-white/20" onClick={() => removeImage(idx)}><Trash2 className="w-3 h-3 text-red-400" /></Button>
                      </div>
                      <Badge className="absolute top-1 left-1 bg-white text-zinc-900 border-none text-[9px] px-1.5 py-0 shadow-sm font-semibold tracking-tight">#{idx + 1}</Badge>
                    </div>
                  ))}
                  <div onClick={() => productImageInputRef.current?.click()} className="aspect-square rounded-lg border border-dashed border-zinc-300 bg-zinc-50 flex flex-col items-center justify-center cursor-pointer hover:border-zinc-400 hover:bg-zinc-100 transition-colors">
                    {isUploading ? <Loader2 className="w-5 h-5 animate-spin text-zinc-400" /> : <><Plus className="w-5 h-5 text-zinc-400 mb-1" /><span className="text-[9px] text-zinc-500 font-medium">Add Image</span></>}
                  </div>
                </div>
              </div>
            </div>

            {/* Basic Info */}
            <div className="space-y-4 bg-white p-5 rounded-xl border border-zinc-200 shadow-sm">
              <h3 className="text-xs font-semibold tracking-tight text-zinc-900 border-b border-zinc-100 pb-3">Basic Info</h3>
              <div className="space-y-4">
                <div>
                  <Label className="text-xs font-medium text-zinc-700 mb-1.5 block">Display Title <span className="text-red-500">*</span></Label>
                  <Input className="h-9 font-medium border-zinc-200 text-sm focus-visible:ring-zinc-900" value={productForm.title} onChange={(e) => setProductForm({ ...productForm, title: e.target.value })} placeholder="e.g. Classic Solitaire Ring" />
                </div>
                <div>
                  <Label className="text-xs font-medium text-zinc-700 mb-1.5 block">Category Assignment <span className="text-red-500">*</span></Label>
                  <select className="w-full h-9 px-3 border border-zinc-200 rounded-md text-sm font-medium bg-white focus:ring-1 focus:ring-zinc-900 outline-none" value={productForm.category_id} onChange={(e) => setProductForm({ ...productForm, category_id: e.target.value })}>
                    <option value="" disabled>Select Target Category...</option>
                    {renderCategoryOptions(null, 0)}
                  </select>
                </div>
                <div>
                  <Label className="text-xs font-medium text-zinc-700 mb-1.5 block">Description</Label>
                  <textarea className="w-full h-20 p-3 border border-zinc-200 rounded-md text-sm font-medium bg-white focus:ring-1 focus:ring-zinc-900 outline-none resize-none custom-scrollbar" value={productForm.description} onChange={(e) => setProductForm({ ...productForm, description: e.target.value })} placeholder="Provide details about the design, inspiration, etc." />
                </div>
              </div>
            </div>

            {/* ✨ NEW: OCCASIONS ASSIGNMENT */}
            {occasions.length > 0 && (
              <div className="space-y-4 bg-white p-5 rounded-xl border border-zinc-200 shadow-sm">
                <h3 className="text-xs font-semibold tracking-tight text-zinc-900 border-b border-zinc-100 pb-3 flex items-center gap-2">
                  <Gift className="w-4 h-4 text-zinc-400" /> Storefront Collections & Occasions
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  {occasions.map(occ => (
                    <label key={occ.id} className="flex items-center gap-2 text-sm text-zinc-700 cursor-pointer bg-zinc-50 border border-zinc-200 p-2 rounded-md hover:bg-zinc-100 transition-colors">
                      <input 
                        type="checkbox" 
                        className="rounded border-zinc-300 w-3.5 h-3.5 accent-indigo-600"
                        checked={productForm.occasion_ids.includes(occ.id)}
                        onChange={(e) => {
                          const newIds = e.target.checked 
                            ? [...productForm.occasion_ids, occ.id]
                            : productForm.occasion_ids.filter(id => id !== occ.id);
                          setProductForm({ ...productForm, occasion_ids: newIds });
                        }} 
                      />
                      {occ.title}
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Metal & Diamonds Grid */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-4 bg-white p-4 rounded-xl border border-zinc-200 shadow-sm">
                <h3 className="text-xs font-semibold tracking-tight text-zinc-900 border-b border-zinc-100 pb-2">Metal</h3>
                <div className="space-y-3">
                  <div><Label className="text-[10px] font-medium text-zinc-500">Type</Label><Input className="h-8 text-xs border-zinc-200" value={productForm.metal_type} onChange={(e) => setProductForm({ ...productForm, metal_type: e.target.value })} /></div>
                  <div><Label className="text-[10px] font-medium text-zinc-500">Color</Label><Input className="h-8 text-xs border-zinc-200" value={productForm.metal_color} onChange={(e) => setProductForm({ ...productForm, metal_color: e.target.value })} /></div>
                  <div><Label className="text-[10px] font-medium text-zinc-500">Purity</Label><Input className="h-8 text-xs border-zinc-200" value={productForm.purity_karat} onChange={(e) => setProductForm({ ...productForm, purity_karat: e.target.value })} /></div>
                  <div><Label className="text-[10px] font-medium text-zinc-500">Gross Wt (g)</Label><Input type="number" step="0.01" className="h-8 text-xs border-zinc-200" value={productForm.gross_weight_g} onChange={(e) => setProductForm({ ...productForm, gross_weight_g: e.target.value })} /></div>
                </div>
              </div>
              <div className="space-y-4 bg-white p-4 rounded-xl border border-zinc-200 shadow-sm">
                <h3 className="text-xs font-semibold tracking-tight text-zinc-900 border-b border-zinc-100 pb-2">Diamonds</h3>
                <div className="space-y-3">
                  <div><Label className="text-[10px] font-medium text-zinc-500">Shape</Label><Input className="h-8 text-xs border-zinc-200" value={productForm.diamond_shape} onChange={(e) => setProductForm({ ...productForm, diamond_shape: e.target.value })} /></div>
                  <div><Label className="text-[10px] font-medium text-zinc-500">Color / Clarity</Label><div className="flex gap-2"><Input className="h-8 text-xs border-zinc-200 w-1/2" value={productForm.diamond_color} onChange={(e) => setProductForm({ ...productForm, diamond_color: e.target.value })} /><Input className="h-8 text-xs border-zinc-200 w-1/2" value={productForm.diamond_clarity} onChange={(e) => setProductForm({ ...productForm, diamond_clarity: e.target.value })} /></div></div>
                  <div><Label className="text-[10px] font-medium text-zinc-500">Total Stone Wt (cts)</Label><Input type="number" step="0.01" className="h-8 text-xs border-zinc-200 font-bold" value={productForm.stone_weight_cts} onChange={(e) => setProductForm({ ...productForm, stone_weight_cts: e.target.value })} /></div>
                </div>
              </div>
            </div>

            {/* Identity Mapping */}
            <div className="bg-zinc-50 border border-zinc-200 p-5 rounded-xl space-y-4 shadow-sm">
              <h3 className="text-xs font-semibold tracking-tight text-zinc-900 flex items-center gap-1.5">
                <Settings2 className="w-4 h-4 text-zinc-400" /> Identity Mapping
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-[11px] font-semibold text-zinc-700 mb-1 block">Master SKU</Label>
                  <Input className="h-9 font-mono font-semibold tracking-tight text-xs border-zinc-300 uppercase bg-white" value={productForm.sku_reference} onChange={(e) => setProductForm({ ...productForm, sku_reference: e.target.value })} placeholder="RNG-042" />
                </div>
                <div>
                  <Label className="text-[11px] font-semibold text-zinc-700 mb-1 block">Legacy Tag</Label>
                  <Input className="h-9 font-mono text-xs border-zinc-300 uppercase bg-white" value={productForm.legacy_item_no} onChange={(e) => setProductForm({ ...productForm, legacy_item_no: e.target.value })} placeholder="OLD-TAG" />
                </div>
              </div>
            </div>

            {/* Pricing & Visibility */}
            <div className="space-y-4 bg-white p-5 rounded-xl border border-zinc-200 shadow-sm">
              <h3 className="text-xs font-semibold tracking-tight text-zinc-900 border-b border-zinc-100 pb-3">Pricing & Visibility</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs font-medium text-zinc-700 mb-1.5 block">Base MRP (₹) <span className="text-red-500">*</span></Label>
                  <Input type="number" className="h-9 text-sm font-semibold tracking-tight border-zinc-200 focus-visible:ring-zinc-900" value={productForm.mrp} onChange={(e) => setProductForm({ ...productForm, mrp: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs font-medium text-zinc-700 mb-1.5 block">Buffer (Days)</Label>
                  <Input type="number" className="h-9 text-sm font-medium border-zinc-200 focus-visible:ring-zinc-900" value={productForm.manufacturing_buffer_days} onChange={(e) => setProductForm({ ...productForm, manufacturing_buffer_days: e.target.value })} />
                </div>
              </div>
              <div className="flex items-center justify-between bg-zinc-50 border border-zinc-200 p-4 rounded-xl mt-4">
                <div>
                  <p className="text-sm font-semibold tracking-tight text-zinc-900">Publish to Web</p>
                  <p className="text-[11px] font-medium text-zinc-500 mt-0.5">Allow customers to view and purchase.</p>
                </div>
                <Switch checked={productForm.is_live} onCheckedChange={(v) => setProductForm({ ...productForm, is_live: v })} className="data-[state=checked]:bg-zinc-900" />
              </div>
            </div>

          </div>

          <SheetFooter className="p-4 border-t border-zinc-200 shrink-0 bg-white">
            <Button onClick={handleSaveProduct} disabled={isSubmitting || isUploading || isVideoUploading} className="w-full h-10 bg-zinc-900 hover:bg-zinc-800 text-white font-semibold tracking-tight text-sm rounded-lg shadow-sm transition-all">
              {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
              {productForm.id ? "Update Profile" : "Save to Catalog"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

    </div>
  );
}