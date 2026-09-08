"use client";

import React, { useEffect, useState, useRef } from "react";
import { 
  Plus, Search, Edit2, Image as ImageIcon, CheckCircle2, 
  XCircle, Globe, PackageSearch, Layers, FolderTree, 
  Loader2, Settings2, CornerDownRight, UploadCloud, X,
  ArrowLeft, ArrowRight, Trash2, Video, Gem, Ruler, FileSpreadsheet, PlayCircle, ChevronLeft, ChevronRight, Save, EyeOff
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
  
  // Migration Preview Pagination & Edit State
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
  });

  // ==========================================================================
  // CLIENT-SIDE WEBP CONVERTER UTILITY FOR MANUAL UPLOADS
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

  // ==========================================================================
  // MANUAL IMAGE & VIDEO UPLOADS
  // ==========================================================================

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

        const { error: uploadError } = await supabase.storage
          .from("ecommerce-assets")
          .upload(filePath, webpBlob, { contentType: "image/webp" });

        if (uploadError) throw uploadError;

        const { data } = supabase.storage.from("ecommerce-assets").getPublicUrl(filePath);
        uploadedUrls.push(data.publicUrl);
      }
      setProductForm((prev) => ({
        ...prev,
        gallery_images: [...prev.gallery_images, ...uploadedUrls],
      }));
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

      const { error: uploadError } = await supabase.storage
        .from("ecommerce-assets")
        .upload(filePath, webpBlob, { contentType: "image/webp" });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from("ecommerce-assets").getPublicUrl(filePath);
      setCategoryForm((prev) => ({ ...prev, image_url: data.publicUrl }));
      toast({ title: "Category Image Uploaded (WebP)" });
    } catch (err: any) {
      toast({ title: "Upload Failed", description: err.message, variant: "destructive" });
    } finally {
      setIsUploading(false);
      if (e.target) e.target.value = "";
    }
  };

  const handleProductVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !appUser?.company_id) return;
    if (file.size > 15 * 1024 * 1024) {
      toast({ title: "File too large", description: "Please upload a video under 15MB.", variant: "destructive" });
      return;
    }
    setIsVideoUploading(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `vid-${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `${appUser.company_id}/products/${fileName}`;

      const { error: uploadError } = await supabase.storage.from("ecommerce-assets").upload(filePath, file);
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from("ecommerce-assets").getPublicUrl(filePath);
      setProductForm((prev) => ({ ...prev, video_url: data.publicUrl }));
      toast({ title: "Video Uploaded" });
    } catch (err: any) {
      toast({ title: "Video Upload Failed", description: err.message, variant: "destructive" });
    } finally {
      setIsVideoUploading(false);
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
    setProductForm({
      ...productForm,
      gallery_images: productForm.gallery_images.filter((_, i) => i !== index),
    });
  };

  // ==========================================================================
  // BULK MIGRATION ENGINE
  // ==========================================================================

  const parseCSV = (str: string) => {
    const arr: any[] = [];
    let quote = false;
    let col = 0, row = 0;
    for (let c = 0; c < str.length; c++) {
      const cc = str[c];
      const nc = str[c + 1];
      arr[row] = arr[row] || [];
      arr[row][col] = arr[row][col] || "";
      if (cc === '"' && quote && nc === '"') { arr[row][col] += cc; ++c; continue; }
      if (cc === '"') { quote = !quote; continue; }
      if (cc === "," && !quote) { ++col; continue; }
      if (cc === "\r" && nc === "\n" && !quote) { ++row; col = 0; ++c; continue; }
      if (cc === "\n" && !quote) { ++row; col = 0; continue; }
      if (cc === "\r" && !quote) { ++row; col = 0; continue; }
      arr[row][col] += cc;
    }
    return arr;
  };
  
  const extractSmartDetails = (text: string) => {
    const defaults = {
      purity_karat: "18K", metal_color: "Yellow", gross_weight_g: 0, stone_weight_cts: 0,
      diamond_color: "", diamond_clarity: "", manufacturing_buffer_days: 14, clean_description: ""
    };
    if (!text) return defaults;
    
    const cleanText = text.replace(/<[^>]*>?/gm, " ");
    const karatMatch = cleanText.match(/(10|14|18|22|24)\s*k[t]?\s*(yellow|rose|white)?/i);
    if (karatMatch) {
      defaults.purity_karat = karatMatch[1].toUpperCase() + "K";
      if (karatMatch[2]) defaults.metal_color = karatMatch[2].charAt(0).toUpperCase() + karatMatch[2].slice(1).toLowerCase();
    }

    const weightMatches = [...cleanText.matchAll(/([\d.]+)\s*(?:gms|gm|g)\b/gi)];
    if (weightMatches.length > 0) defaults.gross_weight_g = weightMatches.reduce((sum, m) => sum + Number(m[1]), 0);

    const caratMatches = [...cleanText.matchAll(/(?:dia[a-z]*)[^\d]*?([\d.]+)\s*(?:cts|ct)\b/gi)];
    if (caratMatches.length > 0) defaults.stone_weight_cts = caratMatches.reduce((sum, m) => sum + Number(m[1]), 0);

    const clarityMatch = cleanText.match(/\b([a-zA-Z]{1,2})\s*[-\/]\s*([VvSsIiFf12\-\/]+)\b/i);
    if (clarityMatch) {
      defaults.diamond_color = clarityMatch[1].toUpperCase();
      defaults.diamond_clarity = clarityMatch[2].toUpperCase().replace(/\s+/g, "");
    }

    const deliveryMatch = cleanText.match(/(?:in\s+)?(\d+)\s*(?:to|-)\s*(\d+)\s*working\s*days/i) || cleanText.match(/(\d+)\s*working\s*days/i);
    if (deliveryMatch) defaults.manufacturing_buffer_days = Number(deliveryMatch[2] || deliveryMatch[1]);

    defaults.clean_description = text.replace(/<[^>]*>?/gm, "").replace(/&nbsp;/g, " ").replace(/\n\s*\n/g, "\n").trim();
    return defaults;
  };

  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const rows = parseCSV(text);
      if (rows.length < 2) return toast({ title: "CSV Error", description: "File seems empty or malformed." });

      const headers = rows[0].map((h: string) => h.trim());
      const parsed = rows.slice(1).map((row: string[]) => {
        const obj: any = {};
        headers.forEach((h: string, i: number) => { obj[h] = row[i] ? row[i].trim() : ""; });
        return obj;
      });

      const previewData = parsed.filter((p) => p["Name"]).map((p) => {
        const desc = p["Short description"] || p["Description"] || "";
        const smartSpecs = extractSmartDetails(desc);
        return {
          title: p["Name"] || "Unknown Product",
          sku_reference: p["SKU"] || null,
          mrp: Number(p["Regular price"] || p["Price"]) || 0, 
          description: smartSpecs.clean_description,
          legacy_categories: p["Categories"] || "",
          legacy_images: p["Images"] ? p["Images"].split(",").map((u: string) => u.trim()).filter(Boolean) : [],
          purity_karat: smartSpecs.purity_karat,
          metal_color: smartSpecs.metal_color,
          gross_weight_g: (smartSpecs.gross_weight_g || 0) > 0 ? smartSpecs.gross_weight_g : (Number(p["Weight (kg)"]) * 1000 || 0),
          stone_weight_cts: smartSpecs.stone_weight_cts,
          diamond_color: smartSpecs.diamond_color,
          diamond_clarity: smartSpecs.diamond_clarity,
          manufacturing_buffer_days: smartSpecs.manufacturing_buffer_days
        };
      });

      setParsedCsvData(previewData);
      setPreviewPage(1);
      setIsMigrationModalOpen(true);
    };
    reader.readAsText(file);
    if (csvInputRef.current) csvInputRef.current.value = "";
  };

  const removePreviewItem = (indexToRemove: number) => {
    const absoluteIndex = ((previewPage - 1) * previewPageSize) + indexToRemove;
    const newData = [...parsedCsvData];
    newData.splice(absoluteIndex, 1);
    setParsedCsvData(newData);
    const newTotalPages = Math.ceil(newData.length / previewPageSize);
    if (previewPage > newTotalPages && newTotalPages > 0) setPreviewPage(newTotalPages);
  };

  const startEditPreviewItem = (indexToEdit: number) => {
    const absoluteIndex = ((previewPage - 1) * previewPageSize) + indexToEdit;
    setEditingPreviewIndex(absoluteIndex);
    setEditingPreviewItem({ ...parsedCsvData[absoluteIndex] });
  };

  const savePreviewItem = () => {
    if (editingPreviewIndex !== null && editingPreviewItem) {
      const newData = [...parsedCsvData];
      newData[editingPreviewIndex] = { 
        ...editingPreviewItem,
        mrp: Number(editingPreviewItem.mrp) || 0,
        gross_weight_g: Number(editingPreviewItem.gross_weight_g) || 0,
        stone_weight_cts: Number(editingPreviewItem.stone_weight_cts) || 0,
        manufacturing_buffer_days: Number(editingPreviewItem.manufacturing_buffer_days) || 14
      };
      setParsedCsvData(newData);
    }
    setEditingPreviewIndex(null);
    setEditingPreviewItem(null);
  };

  const convertAndUploadImage = async (imageUrl: string, companyId: string): Promise<string | null> => {
    try {
      const proxyUrl = `https://wsrv.nl/?url=${encodeURIComponent(imageUrl)}&output=webp&q=85`;
      const response = await fetch(proxyUrl);
      if (!response.ok) throw new Error(`CDN Error: ${response.status}`);
      const webpBlob = await response.blob();
      const fileName = `migrated-${Date.now()}-${Math.random().toString(36).substring(7)}.webp`;
      const filePath = `${companyId}/products/${fileName}`;
      const { error: uploadError } = await supabase.storage.from("ecommerce-assets").upload(filePath, webpBlob);
      if (uploadError) return null;
      const { data } = supabase.storage.from("ecommerce-assets").getPublicUrl(filePath);
      return data.publicUrl;
    } catch {
      return null;
    }
  };

  const processMigration = async () => {
    if (!appUser?.company_id || parsedCsvData.length === 0) return;
    setIsProcessingMigration(true);
    setMigrationProgress({ total: parsedCsvData.length, current: 0, failed: 0 });
    const currentCategories = [...categories];

    for (let i = 0; i < parsedCsvData.length; i++) {
      const item = parsedCsvData[i];
      try {
        let matchedCategoryId = null;
        if (item.legacy_categories) {
          const paths = item.legacy_categories.split(",");
          const specificCategories = paths.map((p: string) => p.split(">").pop()?.trim() || "");
          for (const targetName of specificCategories) {
            const found = currentCategories.find((c) => c.name.toLowerCase() === targetName.toLowerCase());
            if (found) { matchedCategoryId = found.id; break; }
          }
          if (!matchedCategoryId && specificCategories.length > 0) {
            const primaryCategoryName = specificCategories[0];
            const newSlug = primaryCategoryName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "") + `-${Math.floor(Math.random() * 1000)}`;
            const newCatPayload = { company_id: appUser.company_id, name: primaryCategoryName, slug: newSlug, is_active: true, parent_id: null };
            const { data: newCat, error: newCatErr } = await supabase.from("ecommerce_categories").insert([newCatPayload]).select().single();
            if (!newCatErr && newCat) { matchedCategoryId = newCat.id; currentCategories.push(newCat); }
          }
        }

        const convertedImageUrls: string[] = [];
        for (const legacyUrl of item.legacy_images) {
          if (!legacyUrl) continue;
          const newUrl = await convertAndUploadImage(legacyUrl, appUser.company_id);
          if (newUrl) convertedImageUrls.push(newUrl);
        }

        const payload = {
          company_id: appUser.company_id,
          category_id: matchedCategoryId,
          title: item.title,
          slug: item.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "") + `-${Math.floor(Math.random() * 1000)}`, 
          sku_reference: item.sku_reference,
          description: item.description,
          mrp: item.mrp,
          gallery_images: convertedImageUrls,
          cover_image_url: convertedImageUrls.length > 0 ? convertedImageUrls[0] : null,
          is_live: false,
          metal_type: "Gold",
          purity_karat: item.purity_karat,
          metal_color: item.metal_color,
          gross_weight_g: item.gross_weight_g,
          stone_weight_cts: item.stone_weight_cts,
          diamond_color: item.diamond_color,
          diamond_clarity: item.diamond_clarity,
          manufacturing_buffer_days: item.manufacturing_buffer_days
        };

        const { error } = await supabase.from("ecommerce_products").insert(payload);
        if (error) throw error;
        setMigrationProgress((p) => ({ ...p, current: p.current + 1 }));
        await new Promise((resolve) => setTimeout(resolve, 300));
      } catch {
        setMigrationProgress((p) => ({ ...p, failed: p.failed + 1, current: p.current + 1 }));
      }
    }
    toast({ title: "Migration Complete", description: `Successfully processed ${parsedCsvData.length} items.` });
    setIsProcessingMigration(false);
    setIsMigrationModalOpen(false);
    fetchProducts();
    fetchCategories();
  };

  // ==========================================================================
  // STANDARD CRUD LOGIC & FETCHING
  // ==========================================================================
  
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
      let query = supabase.from("ecommerce_products").select(`*, category:ecommerce_categories(name)`).eq("company_id", appUser.company_id).order("created_at", { ascending: false });
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

  useEffect(() => { fetchCategories(); }, [appUser]);
  useEffect(() => { 
    fetchProducts(); 
    setCurrentPage(1); 
  }, [appUser, selectedCategoryId]);

  useEffect(() => { setCurrentPage(1); }, [searchQuery, statusFilter]);

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
      setCategoryForm({ id: "", name: "", is_active: true, parent_id: "none", image_url: "" });
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

      if (productForm.id) {
        const { error } = await supabase.from("ecommerce_products").update(payload).eq("id", productForm.id);
        if (error) throw error;
        toast({ title: "Product Updated Successfully" });
      } else {
        payload.slug = productForm.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "") + `-${Math.floor(Math.random() * 1000)}`;
        const { error } = await supabase.from("ecommerce_products").insert(payload);
        if (error) throw error;
        toast({ title: "Product Created Successfully" });
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
      setProducts(products.map((p) => (p.id === id ? { ...p, is_live: !currentStatus } : p)));
    } catch (err: any) {
      toast({ title: "Status Update Failed", description: err.message, variant: "destructive" });
    }
  };

  // ==========================================================================
  // BULK DASHBOARD ACTIONS
  // ==========================================================================

  const toggleSelectAll = (currentPageIds: string[]) => {
    const newSelection = new Set(selectedIds);
    const allSelected = currentPageIds.every((id) => newSelection.has(id));
    if (allSelected) {
      currentPageIds.forEach((id) => newSelection.delete(id));
    } else {
      currentPageIds.forEach((id) => newSelection.add(id));
    }
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
      toast({ title: "Bulk Update Successful", description: `${idsArray.length} items updated.` });
    } catch (err: any) {
      toast({ title: "Bulk Update Failed", description: err.message, variant: "destructive" });
    } finally {
      setIsBulkProcessing(false);
    }
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
      toast({ title: "Products Deleted", description: `${idsArray.length} items permanently removed.` });
    } catch (err: any) {
      toast({ title: "Deletion Failed", description: err.message, variant: "destructive" });
    } finally {
      setIsBulkProcessing(false);
    }
  };

  const handleBulkMove = async () => {
    if (!bulkMoveTargetCategory || selectedIds.size === 0) return;
    setIsBulkProcessing(true);
    try {
      const idsArray = Array.from(selectedIds);
      const { error } = await supabase.from("ecommerce_products").update({ category_id: bulkMoveTargetCategory }).in("id", idsArray);
      if (error) throw error;
      
      toast({ title: "Products Moved", description: `Successfully moved ${idsArray.length} items.` });
      setSelectedIds(new Set());
      setIsBulkMoveModalOpen(false);
      setBulkMoveTargetCategory("");
      fetchProducts(); // Refresh to reflect new structure
    } catch (err: any) {
      toast({ title: "Move Failed", description: err.message, variant: "destructive" });
    } finally {
      setIsBulkProcessing(false);
    }
  };

  // ==========================================================================
  // RENDER HELPERS
  // ==========================================================================

  const filteredProducts = products.filter((p) => {
    let match = true;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      match = p.title.toLowerCase().includes(q) || (p.sku_reference && p.sku_reference.toLowerCase().includes(q)) || (p.legacy_item_no && p.legacy_item_no.toLowerCase().includes(q));
    }
    if (match && statusFilter !== "all") {
      match = statusFilter === "live" ? p.is_live : !p.is_live;
    }
    return match;
  });

  const totalPages = Math.ceil(filteredProducts.length / pageSize);
  const paginatedProducts = filteredProducts.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const paginatedIds = paginatedProducts.map((p) => p.id);
  const isCurrentPageAllSelected = paginatedIds.length > 0 && paginatedIds.every((id) => selectedIds.has(id));

  // Renders the side-bar category tree
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
          
          {/* Quick Edit / Move Category Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setCategoryForm({
                id: cat.id, name: cat.name, is_active: cat.is_active, 
                parent_id: cat.parent_id || "none", image_url: cat.image_url || ""
              });
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

  // Renders the select dropdown options for parent/category selections
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
      
      {/* HEADER */}
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
              <input type="file" ref={csvInputRef} className="hidden" accept=".csv" onChange={handleCsvUpload} />
              <Button onClick={() => csvInputRef.current?.click()} className="flex-1 sm:flex-none h-9 bg-white text-zinc-700 hover:bg-zinc-50 border border-zinc-200 font-medium tracking-tight shadow-sm rounded-lg">
                <FileSpreadsheet className="w-4 h-4 mr-1.5 text-emerald-600" /> Bulk Import CSV
              </Button>
              <Button onClick={() => { 
                setProductForm({ id: "", title: "", category_id: selectedCategoryId !== "all" ? selectedCategoryId : "", sku_reference: "", legacy_item_no: "", description: "", mrp: "", gallery_images: [], video_url: "", manufacturing_buffer_days: "14", is_live: false, metal_type: "Gold", metal_color: "Yellow", purity_karat: "18K", item_size: "", gross_weight_g: "", net_weight_g: "", diamond_shape: "", diamond_color: "", diamond_clarity: "", stone_weight_cts: "", solitaire_weight_cts: "", solitaire_pieces: "", melee_weight_cts: "", melee_pieces: "", color_stone_weight_cts: "", color_stone_pieces: "" }); 
                setIsProductSheetOpen(true); 
              }} className="flex-1 sm:flex-none h-9 bg-zinc-900 hover:bg-zinc-800 text-white font-medium tracking-tight rounded-lg shadow-sm">
                <Plus className="w-4 h-4 mr-1.5" /> New Product
              </Button>
            </div>
          </div>

          {/* BULK ACTIONS BAR */}
          {selectedIds.size > 0 && (
            <div className="flex items-center justify-between bg-indigo-50 border border-indigo-200 p-3 rounded-xl animate-in slide-in-from-bottom-2 duration-200 shadow-sm flex-wrap gap-3">
              <div className="flex items-center gap-2 text-indigo-700">
                <span className="flex h-5 w-5 bg-white rounded items-center justify-center text-xs font-bold shadow-sm">{selectedIds.size}</span>
                <span className="text-sm font-semibold tracking-tight">Products Selected</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button disabled={isBulkProcessing} size="sm" variant="outline" className="h-8 bg-white border-blue-200 text-blue-700 hover:bg-blue-100" onClick={() => setIsBulkMoveModalOpen(true)}>
                  <FolderTree className="w-3.5 h-3.5 mr-1.5"/> Move
                </Button>
                <Button disabled={isBulkProcessing} size="sm" variant="outline" className="h-8 bg-white border-indigo-200 text-indigo-700 hover:bg-indigo-100" onClick={() => handleBulkStatusChange(true)}>
                  <Globe className="w-3.5 h-3.5 mr-1.5"/> Make Live
                </Button>
                <Button disabled={isBulkProcessing} size="sm" variant="outline" className="h-8 bg-white border-amber-200 text-amber-700 hover:bg-amber-100" onClick={() => handleBulkStatusChange(false)}>
                  <EyeOff className="w-3.5 h-3.5 mr-1.5"/> Set to Draft
                </Button>
                <Button disabled={isBulkProcessing} size="sm" variant="outline" className="h-8 bg-white border-rose-200 text-rose-700 hover:bg-rose-100" onClick={handleBulkDelete}>
                  <Trash2 className="w-3.5 h-3.5 mr-1.5"/> Delete
                </Button>
              </div>
            </div>
          )}

          {/* DATA TABLE */}
          <Card className="shadow-sm border-zinc-200 bg-white rounded-xl overflow-hidden flex flex-col">
            <div className="overflow-x-auto custom-scrollbar flex-1 min-h-[400px]">
              <Table className="whitespace-nowrap">
                <TableHeader className="bg-zinc-50/80 border-b border-zinc-200 sticky top-0 z-10 backdrop-blur-sm">
                  <TableRow className="hover:bg-transparent border-none">
                    <TableHead className="w-[40px] px-4">
                      <input type="checkbox" className="rounded border-zinc-300 w-3.5 h-3.5 accent-indigo-600 cursor-pointer" 
                        checked={isCurrentPageAllSelected} onChange={() => toggleSelectAll(paginatedIds)} 
                      />
                    </TableHead>
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
                          <TableCell className="px-4">
                            <input type="checkbox" className="rounded border-zinc-300 w-3.5 h-3.5 accent-indigo-600 cursor-pointer" 
                              checked={isSelected} onChange={() => toggleSelect(product.id)} 
                            />
                          </TableCell>
                          <TableCell className="px-2 py-3">
                            {product.cover_image_url || (product.gallery_images && product.gallery_images.length > 0) ? (
                              <img src={product.cover_image_url || product.gallery_images[0]} alt="Cover" className="w-10 h-10 rounded-md object-cover border border-zinc-200 shadow-sm" />
                            ) : (
                              <div className="w-10 h-10 rounded-md bg-zinc-50 border border-zinc-200 flex items-center justify-center"><ImageIcon className="w-4 h-4 text-zinc-300" /></div>
                            )}
                          </TableCell>
                          <TableCell className="px-4 py-3">
                            <div className="font-semibold tracking-tight text-sm text-zinc-900 truncate max-w-[280px]">{product.title}</div>
                            <div className="text-xs font-medium text-zinc-500 mt-0.5">{product.category?.name || "Uncategorized"}</div>
                          </TableCell>
                          <TableCell className="px-4 py-3">
                            <div className="flex flex-col gap-1 items-start">
                              {product.sku_reference ? (
                                <span className="text-[10px] font-mono font-semibold text-zinc-700 bg-zinc-100 px-1.5 py-0.5 rounded flex items-center gap-1 border border-zinc-200/60">
                                  <PackageSearch className="w-3 h-3 text-zinc-400" /> {product.sku_reference}
                                </span>
                              ) : <span className="text-[10px] font-medium text-zinc-400 italic">No SKU</span>}
                              {product.legacy_item_no && (
                                <span className="text-[9px] font-mono text-zinc-500 flex items-center gap-1 pl-1"><Layers className="w-2.5 h-2.5 opacity-50" /> {product.legacy_item_no}</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="px-4 py-3 text-right">
                            <div className="font-semibold text-sm text-zinc-900 tracking-tight">₹{Number(product.mrp).toLocaleString()}</div>
                          </TableCell>
                          <TableCell className="px-4 py-3 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <Switch checked={product.is_live} onCheckedChange={() => toggleProductLiveStatus(product.id, product.is_live)} className="data-[state=checked]:bg-emerald-600 scale-90" />
                              {product.is_live ? <Globe className="w-4 h-4 text-emerald-600" /> : <EyeOff className="w-4 h-4 text-zinc-300" />}
                            </div>
                          </TableCell>
                          <TableCell className="px-4 text-right">
                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-md text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 transition-colors" 
                              onClick={() => {
                                setProductForm({
                                  id: product.id, title: product.title || "", category_id: product.category_id || "", sku_reference: product.sku_reference || "",
                                  legacy_item_no: product.legacy_item_no || "", description: product.description || "", mrp: product.mrp?.toString() || "",
                                  gallery_images: product.gallery_images || (product.cover_image_url ? [product.cover_image_url] : []), video_url: product.video_url || "",
                                  manufacturing_buffer_days: product.manufacturing_buffer_days?.toString() || "14", is_live: product.is_live || false,
                                  metal_type: product.metal_type || "Gold", metal_color: product.metal_color || "Yellow", purity_karat: product.purity_karat || "18K",
                                  item_size: product.item_size || "", gross_weight_g: product.gross_weight_g?.toString() || "", net_weight_g: product.net_weight_g?.toString() || "",
                                  diamond_shape: product.diamond_shape || "", diamond_color: product.diamond_color || "", diamond_clarity: product.diamond_clarity || "",
                                  stone_weight_cts: product.stone_weight_cts?.toString() || "", solitaire_weight_cts: product.solitaire_weight_cts?.toString() || "",
                                  solitaire_pieces: product.solitaire_pieces?.toString() || "", melee_weight_cts: product.melee_weight_cts?.toString() || "",
                                  melee_pieces: product.melee_pieces?.toString() || "", color_stone_weight_cts: product.color_stone_weight_cts?.toString() || "", color_stone_pieces: product.color_stone_pieces?.toString() || "",
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
            
            {/* PAGINATION CONTROLS */}
            {totalPages > 1 && (
              <div className="p-3 bg-zinc-50 border-t border-zinc-200 flex items-center justify-between">
                <span className="text-xs font-medium text-zinc-500 px-2">
                  Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, filteredProducts.length)} of <span className="font-bold text-zinc-900">{filteredProducts.length}</span> results
                </span>
                <div className="flex gap-1.5">
                  <Button variant="outline" size="sm" className="h-8 text-xs px-3 shadow-sm bg-white" disabled={currentPage === 1} onClick={() => setCurrentPage((p) => p - 1)}>
                    <ChevronLeft className="w-3.5 h-3.5 mr-1"/> Prev
                  </Button>
                  <Button variant="outline" size="sm" className="h-8 text-xs px-3 shadow-sm bg-white" disabled={currentPage === totalPages} onClick={() => setCurrentPage((p) => p + 1)}>
                    Next <ChevronRight className="w-3.5 h-3.5 ml-1"/>
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </div>
      </main>

      {/* ========================================================================== */}
      {/* BULK MOVE MODAL */}
      {/* ========================================================================== */}
      <Dialog open={isBulkMoveModalOpen} onOpenChange={setIsBulkMoveModalOpen}>
        <DialogContent className="sm:max-w-[425px] border-zinc-200 shadow-xl rounded-2xl overflow-hidden bg-white p-0">
          <DialogHeader className="p-6 border-b border-zinc-100 bg-white">
            <DialogTitle className="text-lg font-semibold tracking-tight text-zinc-900 flex items-center gap-2">
              <FolderTree className="w-5 h-5 text-indigo-600" /> Move {selectedIds.size} Products
            </DialogTitle>
            <DialogDescription className="text-sm font-medium text-zinc-500 mt-1">
              Select the destination category to transfer the selected products into.
            </DialogDescription>
          </DialogHeader>
          <div className="p-6 bg-zinc-50/50">
            <Label className="text-xs font-semibold tracking-tight text-zinc-700 block mb-2">Target Category</Label>
            <select 
              className="w-full h-10 px-3 border border-zinc-200 rounded-md text-sm font-medium bg-white focus:ring-1 focus:ring-indigo-600 outline-none" 
              value={bulkMoveTargetCategory} 
              onChange={(e) => setBulkMoveTargetCategory(e.target.value)}
            >
              <option value="" disabled>Select Target Category...</option>
              {renderCategoryOptions(null, 0)}
            </select>
          </div>
          <DialogFooter className="p-4 bg-white border-t border-zinc-100 flex items-center justify-between">
            <Button variant="ghost" onClick={() => setIsBulkMoveModalOpen(false)} className="rounded-lg h-9 font-medium text-zinc-500">Cancel</Button>
            <Button onClick={handleBulkMove} disabled={!bulkMoveTargetCategory || isBulkProcessing} className="rounded-lg h-9 bg-indigo-600 hover:bg-indigo-700 text-white font-medium shadow-sm px-6">
              {isBulkProcessing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Move Items
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========================================================================== */}
      {/* BULK MIGRATION PREVIEW WIZARD */}
      {/* ========================================================================== */}
      <Dialog open={isMigrationModalOpen} onOpenChange={(o) => {
        if (!o && !isProcessingMigration) {
          setIsMigrationModalOpen(false);
          setParsedCsvData([]);
          setEditingPreviewIndex(null);
        }
      }}>
        <DialogContent className="max-w-7xl border-zinc-200 shadow-2xl p-0 rounded-2xl overflow-hidden bg-[#fafafa]">
          <DialogHeader className="bg-white p-6 border-b border-zinc-200 flex flex-row items-center justify-between sticky top-0 z-10">
            <div>
              <DialogTitle className="text-lg font-semibold tracking-tight text-zinc-900 flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-emerald-600" /> Legacy CSV Migration Preview
              </DialogTitle>
              <p className="text-sm font-medium text-zinc-500 mt-1">
                {editingPreviewIndex !== null ? "Edit extracted information before migration." : "Review mapped data and initiate WebP media conversion. Do not close this window during processing."}
              </p>
            </div>
            {isProcessingMigration && (
              <div className="flex items-center gap-3">
                <Loader2 className="w-5 h-5 animate-spin text-zinc-400" />
                <div className="flex flex-col text-right">
                  <span className="text-sm font-bold text-zinc-900 tracking-tight">{migrationProgress.current} / {migrationProgress.total}</span>
                  <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-widest">Processed</span>
                </div>
              </div>
            )}
          </DialogHeader>

          <div className="p-6 max-h-[60vh] overflow-y-auto custom-scrollbar relative">
            {editingPreviewIndex !== null && editingPreviewItem ? (
              <div className="space-y-6 animate-in fade-in zoom-in-95 duration-200">
                <div className="bg-white border border-zinc-200 rounded-xl p-5 shadow-sm space-y-4">
                  <div className="flex justify-between items-center border-b border-zinc-100 pb-3">
                    <h3 className="text-sm font-semibold text-zinc-900">Edit Extracted Metadata</h3>
                    <Button variant="ghost" size="icon" onClick={() => setEditingPreviewIndex(null)} className="h-6 w-6"><X className="w-4 h-4"/></Button>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><Label className="text-xs text-zinc-600 mb-1 block">Title</Label><Input className="h-9 text-sm" value={editingPreviewItem.title} onChange={(e) => setEditingPreviewItem({ ...editingPreviewItem, title: e.target.value })} /></div>
                    <div><Label className="text-xs text-zinc-600 mb-1 block">SKU</Label><Input className="h-9 text-sm font-mono" value={editingPreviewItem.sku_reference || ""} onChange={(e) => setEditingPreviewItem({ ...editingPreviewItem, sku_reference: e.target.value })} /></div>
                    <div><Label className="text-xs text-zinc-600 mb-1 block">Base MRP (₹)</Label><Input type="number" className="h-9 text-sm" value={editingPreviewItem.mrp} onChange={(e) => setEditingPreviewItem({ ...editingPreviewItem, mrp: e.target.value })} /></div>
                    <div><Label className="text-xs text-zinc-600 mb-1 block">Category Logic</Label><Input className="h-9 text-sm" value={editingPreviewItem.legacy_categories} onChange={(e) => setEditingPreviewItem({ ...editingPreviewItem, legacy_categories: e.target.value })} /></div>
                  </div>
                  <div className="grid grid-cols-3 gap-4 pt-2">
                    <div><Label className="text-xs text-zinc-600 mb-1 block">Purity & Color</Label><div className="flex gap-2"><Input className="h-9 text-xs" value={editingPreviewItem.purity_karat} onChange={(e) => setEditingPreviewItem({ ...editingPreviewItem, purity_karat: e.target.value })} /><Input className="h-9 text-xs" value={editingPreviewItem.metal_color} onChange={(e) => setEditingPreviewItem({ ...editingPreviewItem, metal_color: e.target.value })} /></div></div>
                    <div><Label className="text-xs text-zinc-600 mb-1 block">Gross Wt (g)</Label><Input type="number" className="h-9 text-xs" value={editingPreviewItem.gross_weight_g} onChange={(e) => setEditingPreviewItem({ ...editingPreviewItem, gross_weight_g: e.target.value })} /></div>
                    <div><Label className="text-xs text-zinc-600 mb-1 block">Diamond (Cts / Color / Clarity)</Label><div className="flex gap-2"><Input type="number" className="h-9 text-xs w-1/3" value={editingPreviewItem.stone_weight_cts} onChange={(e) => setEditingPreviewItem({ ...editingPreviewItem, stone_weight_cts: e.target.value })} /><Input className="h-9 text-xs w-1/3" value={editingPreviewItem.diamond_color} onChange={(e) => setEditingPreviewItem({ ...editingPreviewItem, diamond_color: e.target.value })} /><Input className="h-9 text-xs w-1/3" value={editingPreviewItem.diamond_clarity} onChange={(e) => setEditingPreviewItem({ ...editingPreviewItem, diamond_clarity: e.target.value })} /></div></div>
                  </div>
                  <div>
                    <Label className="text-xs text-zinc-600 mb-1 block">Cleaned Description</Label>
                    <textarea className="w-full h-24 p-3 border border-zinc-200 rounded-md text-sm focus:ring-1 focus:ring-zinc-900 outline-none resize-none" value={editingPreviewItem.description} onChange={(e) => setEditingPreviewItem({ ...editingPreviewItem, description: e.target.value })} />
                  </div>
                  <div className="flex justify-end pt-2">
                    <Button onClick={savePreviewItem} className="bg-zinc-900 hover:bg-zinc-800 text-white font-medium h-9"><Save className="w-4 h-4 mr-2"/> Save Changes</Button>
                  </div>
                </div>
              </div>
            ) : (
              <Card className="border border-zinc-200 shadow-sm overflow-hidden bg-white">
                <Table className="whitespace-nowrap">
                  <TableHeader className="bg-zinc-50 border-b border-zinc-200">
                    <TableRow className="border-none">
                      <TableHead className="text-xs font-semibold tracking-tight text-zinc-500 w-[50px]">Legacy Images</TableHead>
                      <TableHead className="text-xs font-semibold tracking-tight text-zinc-500">Title & SKU</TableHead>
                      <TableHead className="text-xs font-semibold tracking-tight text-zinc-500">Category Logic</TableHead>
                      <TableHead className="text-xs font-semibold tracking-tight text-zinc-500">Smart Extraction Specs</TableHead>
                      <TableHead className="text-xs font-semibold tracking-tight text-zinc-500 text-right">MRP</TableHead>
                      <TableHead className="text-xs font-semibold tracking-tight text-zinc-500 text-right w-[80px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedCsvData.slice((previewPage - 1) * previewPageSize, previewPage * previewPageSize).map((row, relativeIdx) => (
                      <TableRow key={relativeIdx} className="border-zinc-100 hover:bg-transparent">
                        <TableCell className="px-4 py-2">
                          <div className="flex items-center gap-1">
                            {row.legacy_images[0] ? (
                              <div className="relative group cursor-pointer">
                                <img src={row.legacy_images[0]} className="w-8 h-8 object-cover rounded border border-zinc-200" alt="pre" />
                                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center rounded">
                                  <span className="text-[8px] font-bold text-white uppercase tracking-widest leading-tight text-center px-1">WebP</span>
                                </div>
                              </div>
                            ) : <div className="w-8 h-8 rounded bg-zinc-100 border border-zinc-200 flex items-center justify-center"><ImageIcon className="w-3 h-3 text-zinc-300" /></div>}
                            {row.legacy_images.length > 1 && <Badge className="h-4 px-1 text-[8px] bg-zinc-100 text-zinc-500 border-none shadow-none">+{row.legacy_images.length - 1}</Badge>}
                          </div>
                        </TableCell>
                        <TableCell className="px-4 py-2">
                          <div className="font-semibold text-xs tracking-tight text-zinc-900 truncate max-w-[200px]">{row.title}</div>
                          <div className="text-[10px] font-mono text-zinc-500 mt-0.5">{row.sku_reference || "NO-SKU"}</div>
                        </TableCell>
                        <TableCell className="px-4 py-2">
                          {(() => {
                            const raw = row.legacy_categories;
                            if (!raw) return <span className="text-[10px] font-medium text-zinc-500 bg-zinc-50 px-2 py-1 rounded border border-zinc-200">Uncategorized</span>;
                            const paths = raw.split(",");
                            const specifics = paths.map((p: string) => p.split(">").pop()?.trim() || "");
                            const existing = specifics.find((s: string) => categories.some((c) => c.name.toLowerCase() === s.toLowerCase()));
                            if (existing) {
                              return <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded inline-block truncate max-w-[150px]">✓ Match: {existing}</span>;
                            } else {
                              return <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-1 rounded inline-block truncate max-w-[150px]">+ Create: {specifics[0]}</span>;
                            }
                          })()}
                        </TableCell>
                        <TableCell className="px-4 py-2">
                          <div className="text-[10px] font-medium text-zinc-700 bg-zinc-50 px-2 py-1 rounded border border-zinc-200 inline-block">
                            <span className="font-bold">{row.purity_karat} {row.metal_color}</span> | {row.gross_weight_g}g | <span className="font-bold text-indigo-700">{row.stone_weight_cts}ct ({row.diamond_color}-{row.diamond_clarity})</span> | Buffer: {row.manufacturing_buffer_days}d
                          </div>
                        </TableCell>
                        <TableCell className="px-4 py-2 text-right">
                          <div className="font-semibold text-xs text-zinc-900">₹{row.mrp.toLocaleString()}</div>
                        </TableCell>
                        <TableCell className="px-4 py-2 text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-zinc-400 hover:text-indigo-600 hover:bg-indigo-50" onClick={() => startEditPreviewItem(relativeIdx)}><Edit2 className="w-3.5 h-3.5"/></Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-zinc-400 hover:text-rose-600 hover:bg-rose-50" onClick={() => removePreviewItem(relativeIdx)}><Trash2 className="w-3.5 h-3.5"/></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                
                {parsedCsvData.length > previewPageSize && (
                  <div className="p-3 bg-zinc-50 border-t border-zinc-200 flex items-center justify-between">
                    <span className="text-[11px] font-medium text-zinc-500">
                      Showing {((previewPage - 1) * previewPageSize) + 1} to {Math.min(previewPage * previewPageSize, parsedCsvData.length)} of <span className="font-bold text-zinc-900">{parsedCsvData.length}</span> items
                    </span>
                    <div className="flex gap-1">
                      <Button variant="outline" size="sm" className="h-7 text-xs px-2" disabled={previewPage === 1} onClick={() => setPreviewPage((p) => p - 1)}><ChevronLeft className="w-3 h-3 mr-1"/> Prev</Button>
                      <Button variant="outline" size="sm" className="h-7 text-xs px-2" disabled={previewPage === Math.ceil(parsedCsvData.length / previewPageSize)} onClick={() => setPreviewPage((p) => p + 1)}>Next <ChevronRight className="w-3 h-3 ml-1"/></Button>
                    </div>
                  </div>
                )}
              </Card>
            )}
          </div>

          <DialogFooter className="bg-white p-5 border-t border-zinc-200 flex items-center justify-between">
            <Button variant="ghost" disabled={isProcessingMigration || editingPreviewIndex !== null} onClick={() => { setIsMigrationModalOpen(false); setParsedCsvData([]); }} className="font-medium text-sm text-zinc-500">Cancel</Button>
            <Button disabled={isProcessingMigration || parsedCsvData.length === 0 || editingPreviewIndex !== null} onClick={processMigration} className="bg-zinc-900 hover:bg-zinc-800 text-white font-semibold text-sm h-10 px-8 shadow-sm">
              {isProcessingMigration ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <PlayCircle className="w-4 h-4 mr-2" />}
              {isProcessingMigration ? "Converting & Uploading..." : `Process & Import ${parsedCsvData.length} Items`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========================================================================== */}
      {/* CATEGORY MODAL */}
      {/* ========================================================================== */}
      <Dialog open={isCategoryModalOpen} onOpenChange={(o) => !o && setIsCategoryModalOpen(false)}>
        <DialogContent className="sm:max-w-[425px] p-0 border border-zinc-200 shadow-xl rounded-2xl overflow-hidden bg-white">
          <DialogHeader className="p-6 border-b border-zinc-100 bg-white">
            <DialogTitle className="text-lg font-semibold tracking-tight text-zinc-900 flex items-center gap-2">
              <FolderTree className="w-4 h-4 text-zinc-400" /> {categoryForm.id ? "Edit & Nest Category" : "Create Category"}
            </DialogTitle>
          </DialogHeader>
          <div className="p-6 space-y-5 bg-zinc-50/50">
            <div className="flex flex-col items-center justify-center">
              <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleCategoryUpload} />
              <div onClick={() => fileInputRef.current?.click()} className="w-24 h-24 rounded-full border border-dashed border-zinc-300 bg-white flex flex-col items-center justify-center cursor-pointer hover:border-zinc-400 hover:bg-zinc-50 transition-all relative overflow-hidden shadow-sm">
                {isUploading ? <Loader2 className="w-5 h-5 animate-spin text-zinc-400" /> : categoryForm.image_url ? (
                  <img src={categoryForm.image_url} alt="Category" className="w-full h-full object-cover" />
                ) : (
                  <><UploadCloud className="w-5 h-5 text-zinc-400 mb-1" /><span className="text-[9px] font-semibold tracking-tight text-zinc-500">UPLOAD</span></>
                )}
              </div>
              {categoryForm.image_url && !isUploading && (
                <button onClick={() => setCategoryForm({ ...categoryForm, image_url: "" })} className="text-[10px] font-medium text-rose-500 hover:underline mt-2 tracking-tight">Remove Image</button>
              )}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold tracking-tight text-zinc-700">Category Name</Label>
              <Input placeholder="e.g. Diamond Rings" className="h-9 bg-white border-zinc-200 text-sm font-medium focus-visible:ring-zinc-900" value={categoryForm.name} onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold tracking-tight text-zinc-700">Parent Category (Nesting)</Label>
              <select className="w-full h-9 px-3 border border-zinc-200 rounded-md text-sm font-medium bg-white focus:ring-1 focus:ring-zinc-900 outline-none" value={categoryForm.parent_id} onChange={(e) => setCategoryForm({ ...categoryForm, parent_id: e.target.value })}>
                <option value="none">-- Top Level (No Parent) --</option>
                {renderCategoryOptions(null, 0).filter((node: any) => node.key !== categoryForm.id)}
              </select>
            </div>
            <div className="flex items-center justify-between bg-white border border-zinc-200 p-3 rounded-lg shadow-sm">
              <div>
                <p className="text-sm font-semibold tracking-tight text-zinc-900">Visibility</p>
                <p className="text-xs font-medium text-zinc-500">Show on storefront menu</p>
              </div>
              <Switch checked={categoryForm.is_active} onCheckedChange={(v) => setCategoryForm({ ...categoryForm, is_active: v })} className="data-[state=checked]:bg-zinc-900" />
            </div>
          </div>
          <DialogFooter className="p-4 bg-white border-t border-zinc-100 flex items-center justify-between">
            <Button variant="ghost" onClick={() => setIsCategoryModalOpen(false)} className="rounded-lg h-9 font-medium text-zinc-500">Cancel</Button>
            <Button onClick={handleSaveCategory} disabled={isSubmitting || isUploading} className="rounded-lg h-9 bg-zinc-900 hover:bg-zinc-800 text-white font-medium shadow-sm px-6">
              {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Save Category
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

              <Separator className="bg-zinc-100" />

              {/* Video Section */}
              <div className="space-y-3">
                <Label className="text-xs font-medium text-zinc-700 flex items-center justify-between">
                  <span>Short Video Clip (2-4 sec)</span>
                  <span className="text-[10px] text-zinc-400 font-normal">Optional</span>
                </Label>
                <input type="file" ref={productVideoInputRef} className="hidden" accept="video/mp4,video/quicktime,video/webm" onChange={handleProductVideoUpload} />
                {productForm.video_url ? (
                  <div className="relative w-full h-32 rounded-xl border border-zinc-200 overflow-hidden bg-black flex justify-center">
                    <video src={productForm.video_url} autoPlay loop muted playsInline className="h-full object-cover" />
                    <Button size="icon" variant="destructive" className="absolute top-2 right-2 h-7 w-7 opacity-80 hover:opacity-100 rounded-md" onClick={() => setProductForm({ ...productForm, video_url: "" })}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ) : (
                  <div className="w-full h-16 rounded-xl border border-dashed border-zinc-300 bg-zinc-50/50 flex flex-col items-center justify-center cursor-pointer hover:border-zinc-400 hover:bg-zinc-100 transition-all" onClick={() => productVideoInputRef.current?.click()}>
                    {isVideoUploading ? <Loader2 className="w-5 h-5 animate-spin text-zinc-400" /> : <div className="flex items-center gap-2 text-zinc-500"><Video className="w-4 h-4" /><span className="text-[11px] font-medium">Upload Video File</span></div>}
                  </div>
                )}
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