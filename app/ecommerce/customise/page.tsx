"use client";

import React, { useState, useEffect } from "react";
import { 
  Globe, Plus, Image as ImageIcon, Link as LinkIcon, 
  Clock, MoreVertical, Edit2, Trash2, CheckCircle2, XCircle, 
  Loader2, Save, X, Type, Search, Mail, CalendarDays,
  LayoutTemplate, Star, UploadCloud, FileText, LayoutGrid,
  Gift, Truck
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/lib/supabaseClient"; // adjust to your actual path
import { toast } from "sonner";
// --- TYPES ---
interface Banner { id: string; desktop_image_url: string; mobile_image_url: string; link: string; duration_ms: number; sort_order: number; is_active: boolean; }
interface Ticker { id: string; text: string; icon_name: string; sort_order: number; is_active: boolean; }
interface CmsSection { section_key: string; image_url: string; heading: string; subheading: string; }
interface Subscriber { id: string; email: string; subscribed_at: string; }

// --- UTILITIES ---
const AVAILABLE_ICONS = ["Diamond", "Gem", "Heart", "RefreshCw", "Shield", "CheckCircle2", "Star", "Gift", "Calendar", "Infinity"];

// Removed 'export' to fix Next.js Error (ts 71002)
const convertToWebP = (file: File): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0);
        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error("WebP conversion failed"));
        }, "image/webp", 0.85);
      };
      img.onerror = (error) => reject(error);
    };
  });
};

const uploadToSupabase = async (file: File, folder: string): Promise<string | null> => {
  try {
    const webpBlob = await convertToWebP(file);
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.webp`;
    const filePath = `${folder}/${fileName}`;
    
    const { error } = await supabase.storage.from('ecommerce-assets').upload(filePath, webpBlob, { contentType: 'image/webp' });
    if (error) throw error;
    
    const { data } = supabase.storage.from('ecommerce-assets').getPublicUrl(filePath);
    return data.publicUrl;
  } catch (error) {
    console.error("Upload error:", error);
    toast.error("Failed to upload image.");
    return null;
  }
};

// --- MAIN COMPONENT ---
export default function StorefrontSettings() {
  const [activeTab, setActiveTab] = useState("banners");

  const tabs = [
    { id: "banners", label: "Hero Banners", icon: ImageIcon },
    { id: "ticker", label: "Highlight Ticker", icon: Type },
    { id: "category-grid", label: "Category Grid", icon: LayoutGrid },
    { id: "promises", label: "Why Pavitram", icon: CheckCircle2 },
    { id: "cms", label: "Static Sections", icon: LayoutTemplate },
    { id: "occasions", label: "Occasions", icon: Gift },
    { id: "reviews", label: "Client Stories", icon: Star },
    { id: "policies", label: "Legal Pages", icon: FileText }, // ✨ NEW TAB
    { id: "checkout", label: "Checkout & Shipping", icon: Truck },
    { id: "newsletter", label: "Subscribers", icon: Mail },
  ];

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-slate-800 p-4 md:p-8 font-sans w-full">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-8 h-8 bg-[#4A1F58] text-white flex items-center justify-center rounded-md shrink-0 shadow-sm">
          <Globe className="w-4 h-4" />
        </div>
        <h1 className="text-lg font-medium text-slate-900">
          E-Commerce OS <span className="text-slate-400 font-normal">/ Digital Storefront Settings</span>
        </h1>
      </div>

      <div className="flex overflow-x-auto border-b border-slate-200 mb-8 hide-scrollbar gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-all duration-200 flex items-center gap-2 ${
              activeTab === tab.id
                ? "border-[#4A1F58] text-[#4A1F58] bg-slate-100/50 rounded-t-lg"
                : "border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50 rounded-t-lg"
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "banners" && <BannersManager />}
      {activeTab === "ticker" && <TickerManager />}
      {activeTab === "category-grid" && <CategoryGridManager />}
      {activeTab === "promises" && <PromisesManager />}
      {activeTab === "cms" && <CMSManager />}
      {activeTab === "occasions" && <OccasionsManager />}
      {activeTab === "reviews" && <ReviewsManager />}
      {activeTab === "policies" && <PolicyManager />}
      {activeTab === "checkout" && <CheckoutSettingsManager />}
      {activeTab === "newsletter" && <NewsletterViewer />}
    </div>
  );
}

// ==========================================
// 1. BANNERS MANAGER (WITH IMAGE UPLOAD)
// ==========================================
function BannersManager() {
  const [banners, setBanners] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<any>({});

  const fetchBanners = async () => {
    setIsLoading(true);
    const { data } = await supabase.from("ecommerce_banners").select("*").order("sort_order");
    if (data) setBanners(data);
    setIsLoading(false);
  };

  useEffect(() => { fetchBanners(); }, []);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, field: string) => {
    const file = e.target.files?.[0];
    if (!file) return;
    toast.info("Uploading & converting to WebP...");
    const url = await uploadToSupabase(file, 'banner_images');
    if (url) setFormData({ ...formData, [field]: url });
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      if (editingId) await supabase.from("ecommerce_banners").update(formData).eq("id", editingId);
      else await supabase.from("ecommerce_banners").insert([formData]);
      toast.success("Banner saved.");
      setIsModalOpen(false);
      fetchBanners();
    } catch (e) { toast.error("Failed to save."); }
    setIsSaving(false);
  };

  return (
    <div className="w-full flex flex-col gap-6 animate-in fade-in duration-300">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold text-slate-900 tracking-tight">Hero Banners</h2>
          <p className="text-sm text-slate-500 mt-1">Manage desktop and mobile carousel banners.</p>
        </div>
        <button onClick={() => { setEditingId(null); setFormData({ link: '/', duration_ms: 5000, sort_order: banners.length + 1, is_active: true }); setIsModalOpen(true); }} className="bg-[#4A1F58] hover:bg-[#302832] text-white px-4 py-2.5 rounded-lg text-sm flex items-center gap-2">
          <Plus className="w-4 h-4" /> Add Banner
        </button>
      </div>

      {isLoading ? <Loader2 className="w-6 h-6 animate-spin text-slate-400 mx-auto mt-10" /> : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {banners.map((b) => (
            <div key={b.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm flex flex-col">
              <div className="relative aspect-[21/9] bg-slate-100 border-b border-slate-200">
                <img src={b.desktop_image_url} className="w-full h-full object-cover" alt="Desktop" />
                <div className="absolute bottom-2 right-2 w-[40px] aspect-[3/4] bg-white border border-slate-200 rounded shadow-md overflow-hidden z-10">
                  <img src={b.mobile_image_url} className="w-full h-full object-cover" alt="Mobile" />
                </div>
              </div>
              <div className="p-4 flex items-center justify-between bg-white">
                <span className="text-xs font-semibold text-slate-500">Order: {b.sort_order} | {b.is_active ? 'Live' : 'Hidden'}</span>
                <div className="flex gap-2">
                  <button onClick={() => { setEditingId(b.id); setFormData(b); setIsModalOpen(true); }} className="text-blue-600"><Edit2 className="w-4 h-4"/></button>
                  <button onClick={async () => { await supabase.from("ecommerce_banners").delete().eq("id", b.id); fetchBanners(); }} className="text-rose-600"><Trash2 className="w-4 h-4"/></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-4">
            <h3 className="text-lg font-semibold">{editingId ? "Edit Banner" : "New Banner"}</h3>
            
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-500 mb-1 block">Desktop Image (1920x800)</label>
                {formData.desktop_image_url && <img src={formData.desktop_image_url} className="w-full h-24 object-cover rounded-md mb-2 border" />}
                <input type="file" accept="image/*" onChange={(e) => handleImageUpload(e, 'desktop_image_url')} className="text-sm" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 mb-1 block">Mobile Image (1080x1440)</label>
                {formData.mobile_image_url && <img src={formData.mobile_image_url} className="w-16 h-24 object-cover rounded-md mb-2 border" />}
                <input type="file" accept="image/*" onChange={(e) => handleImageUpload(e, 'mobile_image_url')} className="text-sm" />
              </div>
            </div>

            <input type="text" placeholder="Link Route (/category/all)" value={formData.link} onChange={e => setFormData({...formData, link: e.target.value})} className="w-full border p-2 rounded text-sm" />
            <div className="flex gap-4">
              <input type="number" placeholder="Sort Order" value={formData.sort_order} onChange={e => setFormData({...formData, sort_order: Number(e.target.value)})} className="w-full border p-2 rounded text-sm" />
              <input type="number" placeholder="Duration (ms)" value={formData.duration_ms} onChange={e => setFormData({...formData, duration_ms: Number(e.target.value)})} className="w-full border p-2 rounded text-sm" />
            </div>
            
            <div className="flex justify-end gap-2 pt-4 border-t">
              <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm text-slate-600">Cancel</button>
              <button onClick={handleSave} disabled={isSaving} className="bg-[#4A1F58] text-white px-4 py-2 rounded text-sm flex items-center gap-2">
                {isSaving && <Loader2 className="w-3 h-3 animate-spin"/>} Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ==========================================
// 2. TICKER MANAGER
// ==========================================
function TickerManager() {
  const [items, setItems] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState<any>({});

  const fetchTickers = async () => {
    setIsLoading(true);
    const { data } = await supabase.from("ecommerce_highlight_ticker").select("*").order("sort_order");
    if (data) setItems(data);
    setIsLoading(false);
  };
  useEffect(() => { fetchTickers(); }, []);

  const handleSave = async () => {
    if (formData.id) await supabase.from("ecommerce_highlight_ticker").update(formData).eq("id", formData.id);
    else await supabase.from("ecommerce_highlight_ticker").insert([formData]);
    toast.success("Ticker saved.");
    setIsModalOpen(false);
    fetchTickers();
  };

  return (
    <div className="w-full flex flex-col gap-6 animate-in fade-in duration-300">
      <div className="flex justify-between items-center">
        <div><h2 className="text-xl font-semibold">Highlight Ticker</h2><p className="text-sm text-slate-500">Scrolling announcements.</p></div>
        <button onClick={() => { setFormData({ sort_order: items.length + 1, icon_name: 'Diamond' }); setIsModalOpen(true); }} className="bg-[#4A1F58] text-white px-4 py-2 rounded-lg text-sm"><Plus className="w-4 h-4 inline mr-1"/> Add Item</button>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm">
        <table className="w-full text-left text-sm text-slate-600">
          <thead className="bg-slate-50 border-b"><tr><th className="px-6 py-3">Text</th><th className="px-6 py-3">Icon</th><th className="px-6 py-3 text-right">Actions</th></tr></thead>
          <tbody className="divide-y">
            {isLoading ? <tr><td colSpan={3} className="p-4 text-center">Loading...</td></tr> : items.map((item) => (
              <tr key={item.id} className="hover:bg-slate-50">
                <td className="px-6 py-4 font-medium text-slate-900">{item.text}</td>
                <td className="px-6 py-4">{item.icon_name}</td>
                <td className="px-6 py-4 flex justify-end gap-3">
                  <button onClick={() => { setFormData(item); setIsModalOpen(true); }} className="text-blue-600"><Edit2 className="w-4 h-4"/></button>
                  <button onClick={async () => { await supabase.from("ecommerce_highlight_ticker").delete().eq("id", item.id); fetchTickers(); }} className="text-rose-600"><Trash2 className="w-4 h-4"/></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40">
          <div className="bg-white rounded-xl p-6 w-full max-w-md space-y-4">
            <h3 className="font-bold">Edit Ticker</h3>
            <input type="text" placeholder="Announcement Text" value={formData.text || ""} onChange={e => setFormData({...formData, text: e.target.value})} className="w-full border p-2 rounded text-sm" />
            <select value={formData.icon_name || "Diamond"} onChange={e => setFormData({...formData, icon_name: e.target.value})} className="w-full border p-2 rounded text-sm">
              {AVAILABLE_ICONS.map(icon => <option key={icon} value={icon}>{icon}</option>)}
            </select>
            <input type="number" placeholder="Sort Order" value={formData.sort_order || 0} onChange={e => setFormData({...formData, sort_order: Number(e.target.value)})} className="w-full border p-2 rounded text-sm" />
            <div className="flex justify-end gap-2"><button onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm">Cancel</button><button onClick={handleSave} className="bg-[#4A1F58] text-white px-4 py-2 rounded text-sm">Save</button></div>
          </div>
        </div>
      )}
    </div>
  );
}

// ==========================================
// 3. PROMISES MANAGER
// ==========================================
function PromisesManager() {
  const [items, setItems] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState<any>({});

  const fetchItems = async () => {
    const { data } = await supabase.from("ecommerce_promises").select("*").order("sort_order");
    if (data) setItems(data);
  };
  useEffect(() => { fetchItems(); }, []);

  const handleSave = async () => {
    if (formData.id) await supabase.from("ecommerce_promises").update(formData).eq("id", formData.id);
    else await supabase.from("ecommerce_promises").insert([formData]);
    setIsModalOpen(false); fetchItems();
  };

  return (
    <div className="w-full flex flex-col gap-6 animate-in fade-in duration-300">
      <div className="flex justify-between items-center">
        <div><h2 className="text-xl font-semibold">Brand Promises</h2><p className="text-sm text-slate-500">USPs shown in Why Pavitram.</p></div>
        <button onClick={() => { setFormData({ sort_order: items.length + 1, icon_name: 'CheckCircle2' }); setIsModalOpen(true); }} className="bg-[#4A1F58] text-white px-4 py-2 rounded-lg text-sm"><Plus className="w-4 h-4 inline mr-1"/> Add Promise</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {items.map((item) => (
          <div key={item.id} className="bg-white border rounded-xl p-5 shadow-sm">
            <div className="flex justify-between items-start mb-2">
              <span className="text-xs bg-slate-100 px-2 py-1 rounded font-mono">{item.icon_name}</span>
              <div className="flex gap-2">
                <button onClick={() => { setFormData(item); setIsModalOpen(true); }} className="text-blue-600"><Edit2 className="w-4 h-4"/></button>
                <button onClick={async () => { await supabase.from("ecommerce_promises").delete().eq("id", item.id); fetchItems(); }} className="text-rose-600"><Trash2 className="w-4 h-4"/></button>
              </div>
            </div>
            <h4 className="font-bold text-slate-900 mt-2">{item.title}</h4>
            <p className="text-sm text-slate-500 mt-1 line-clamp-2">{item.description}</p>
          </div>
        ))}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40">
          <div className="bg-white rounded-xl p-6 w-full max-w-md space-y-4">
            <h3 className="font-bold">Edit Promise</h3>
            <input type="text" placeholder="Title" value={formData.title || ""} onChange={e => setFormData({...formData, title: e.target.value})} className="w-full border p-2 rounded text-sm" />
            <textarea placeholder="Description" value={formData.description || ""} onChange={e => setFormData({...formData, description: e.target.value})} className="w-full border p-2 rounded text-sm h-20" />
            <select value={formData.icon_name || "CheckCircle2"} onChange={e => setFormData({...formData, icon_name: e.target.value})} className="w-full border p-2 rounded text-sm">
              {AVAILABLE_ICONS.map(icon => <option key={icon} value={icon}>{icon}</option>)}
            </select>
            <input type="number" placeholder="Sort Order" value={formData.sort_order || 0} onChange={e => setFormData({...formData, sort_order: Number(e.target.value)})} className="w-full border p-2 rounded text-sm" />
            <div className="flex justify-end gap-2"><button onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm">Cancel</button><button onClick={handleSave} className="bg-[#4A1F58] text-white px-4 py-2 rounded text-sm">Save</button></div>
          </div>
        </div>
      )}
    </div>
  );
}

// ==========================================
// 4. CMS STATIC SECTIONS (WITH IMAGE UPLOAD)
// ==========================================
function CMSManager() {
  const [sections, setSections] = useState<CmsSection[]>([]);
  const [isSaving, setIsSaving] = useState<string | null>(null);

  const fetchCMS = async () => {
    const { data } = await supabase.from("ecommerce_cms_sections").select("*");
    if (data) setSections(data);
  };
  useEffect(() => { fetchCMS(); }, []);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, idx: number) => {
    const file = e.target.files?.[0];
    if (!file) return;
    toast.info("Uploading Image...");
    const url = await uploadToSupabase(file, 'banner_images');
    if (url) {
      const newSecs = [...sections];
      newSecs[idx].image_url = url;
      setSections(newSecs);
    }
  };

  const handleUpdate = async (section: CmsSection) => {
    setIsSaving(section.section_key);
    await supabase.from("ecommerce_cms_sections").update({ heading: section.heading, subheading: section.subheading, image_url: section.image_url }).eq("section_key", section.section_key);
    toast.success("Section updated.");
    setIsSaving(null);
  };

  return (
    <div className="w-full flex flex-col gap-6 animate-in fade-in duration-300">
      <div><h2 className="text-xl font-semibold">Static Sections</h2><p className="text-sm text-slate-500">Update Why Pavitram & Harvesting imagery.</p></div>

      <div className="grid grid-cols-1 gap-8">
        {sections.map((sec, idx) => (
          <div key={sec.section_key} className="bg-white border rounded-xl p-6 shadow-sm flex flex-col md:flex-row gap-6">
            <div className="w-full md:w-1/3 space-y-3">
              <div className="aspect-[4/3] bg-slate-100 rounded-lg overflow-hidden border relative group">
                <img src={sec.image_url} className="w-full h-full object-cover" alt="Section" />
              </div>
              <input type="file" accept="image/*" onChange={(e) => handleImageUpload(e, idx)} className="text-xs" />
            </div>
            <div className="flex-1 flex flex-col gap-4">
              <h3 className="text-sm font-bold uppercase border-b pb-2">{sec.section_key.replace('_', ' ')}</h3>
              <input type="text" value={sec.heading} onChange={(e) => { const newSecs = [...sections]; newSecs[idx].heading = e.target.value; setSections(newSecs); }} className="border rounded-lg px-3 py-2 text-sm" />
              <textarea value={sec.subheading} onChange={(e) => { const newSecs = [...sections]; newSecs[idx].subheading = e.target.value; setSections(newSecs); }} className="border rounded-lg px-3 py-2 text-sm h-20 resize-none" />
              <button onClick={() => handleUpdate(sec)} disabled={isSaving === sec.section_key} className="bg-slate-900 text-white px-5 py-2 rounded-lg text-sm mt-auto self-end">
                {isSaving === sec.section_key ? 'Saving...' : 'Save Content'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ==========================================
// 5. OCCASIONS MANAGER (WITH UPLOAD)
// ==========================================
function OccasionsManager() {
  const [items, setItems] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState<any>({});

  const fetchItems = async () => {
    const { data } = await supabase.from("ecommerce_occasions").select("*").order("sort_order");
    if (data) setItems(data);
  };
  useEffect(() => { fetchItems(); }, []);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    toast.info("Uploading Image...");
    const url = await uploadToSupabase(file, 'banner_images');
    if (url) setFormData({ ...formData, image_url: url });
  };

  const handleSave = async () => {
    if (formData.id) await supabase.from("ecommerce_occasions").update(formData).eq("id", formData.id);
    else await supabase.from("ecommerce_occasions").insert([formData]);
    setIsModalOpen(false); fetchItems();
  };

  return (
    <div className="w-full flex flex-col gap-6 animate-in fade-in duration-300">
      <div className="flex justify-between items-center">
        <div><h2 className="text-xl font-semibold">Occasions</h2><p className="text-sm text-slate-500">Manage categories shown in Shop By Occasion.</p></div>
        <button onClick={() => { setFormData({ sort_order: items.length + 1 }); setIsModalOpen(true); }} className="bg-[#4A1F58] text-white px-4 py-2 rounded-lg text-sm"><Plus className="w-4 h-4 inline mr-1"/> Add Occasion</button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {items.map((item) => (
          <div key={item.id} className="bg-white border rounded-xl overflow-hidden shadow-sm relative group">
            <img src={item.image_url} className="aspect-[4/5] object-cover w-full" />
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
              <button onClick={() => { setFormData(item); setIsModalOpen(true); }} className="bg-white p-2 rounded-full"><Edit2 className="w-4 h-4 text-slate-800"/></button>
              <button onClick={async () => { await supabase.from("ecommerce_occasions").delete().eq("id", item.id); fetchItems(); }} className="bg-white p-2 rounded-full"><Trash2 className="w-4 h-4 text-rose-600"/></button>
            </div>
            <div className="p-3 bg-white text-center font-semibold text-sm">{item.title}</div>
          </div>
        ))}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40">
          <div className="bg-white rounded-xl p-6 w-full max-w-md space-y-4">
            <h3 className="font-bold">Edit Occasion</h3>
            {formData.image_url && <img src={formData.image_url} className="w-full h-32 object-cover rounded border" />}
            <input type="file" accept="image/*" onChange={handleImageUpload} className="text-sm" />
            <input type="text" placeholder="Title (e.g. Wedding)" value={formData.title || ""} onChange={e => setFormData({...formData, title: e.target.value})} className="w-full border p-2 rounded text-sm" />
            <input type="text" placeholder="Slug Route (e.g. wedding)" value={formData.slug || ""} onChange={e => setFormData({...formData, slug: e.target.value.toLowerCase()})} className="w-full border p-2 rounded text-sm" />
            <input type="number" placeholder="Sort Order" value={formData.sort_order || 0} onChange={e => setFormData({...formData, sort_order: Number(e.target.value)})} className="w-full border p-2 rounded text-sm" />
            <div className="flex justify-end gap-2"><button onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm">Cancel</button><button onClick={handleSave} className="bg-[#4A1F58] text-white px-4 py-2 rounded text-sm">Save</button></div>
          </div>
        </div>
      )}
    </div>
  );
}

// ==========================================
// 6. CLIENT STORIES (REVIEWS) MANAGER
// ==========================================
function ReviewsManager() {
  const [items, setItems] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState<any>({});

  const fetchItems = async () => {
    const { data } = await supabase.from("ecommerce_client_reviews").select("*").order("sort_order");
    if (data) setItems(data);
  };
  useEffect(() => { fetchItems(); }, []);

  const handleSave = async () => {
    if (formData.id) await supabase.from("ecommerce_client_reviews").update(formData).eq("id", formData.id);
    else await supabase.from("ecommerce_client_reviews").insert([formData]);
    setIsModalOpen(false); fetchItems();
  };

  return (
    <div className="w-full flex flex-col gap-6 animate-in fade-in duration-300">
      <div className="flex justify-between items-center">
        <div><h2 className="text-xl font-semibold">Client Stories</h2><p className="text-sm text-slate-500">Manage hand-picked reviews.</p></div>
        <button onClick={() => { setFormData({ sort_order: items.length + 1, rating: 5 }); setIsModalOpen(true); }} className="bg-[#4A1F58] text-white px-4 py-2 rounded-lg text-sm"><Plus className="w-4 h-4 inline mr-1"/> Add Review</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {items.map((item) => (
          <div key={item.id} className="bg-white border rounded-xl p-5 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-start mb-2">
                <span className="font-bold text-slate-900">{item.author_name} <span className="text-xs text-slate-400 font-normal ml-2">{item.time_ago}</span></span>
                <div className="flex gap-2">
                  <button onClick={() => { setFormData(item); setIsModalOpen(true); }} className="text-blue-600"><Edit2 className="w-4 h-4"/></button>
                  <button onClick={async () => { await supabase.from("ecommerce_client_reviews").delete().eq("id", item.id); fetchItems(); }} className="text-rose-600"><Trash2 className="w-4 h-4"/></button>
                </div>
              </div>
              <p className="text-sm text-slate-500 italic">"{item.review_text}"</p>
            </div>
          </div>
        ))}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40">
          <div className="bg-white rounded-xl p-6 w-full max-w-md space-y-4">
            <h3 className="font-bold">Edit Review</h3>
            <input type="text" placeholder="Author Name" value={formData.author_name || ""} onChange={e => setFormData({...formData, author_name: e.target.value})} className="w-full border p-2 rounded text-sm" />
            <input type="text" placeholder="Time Ago (e.g., 2 weeks ago)" value={formData.time_ago || ""} onChange={e => setFormData({...formData, time_ago: e.target.value})} className="w-full border p-2 rounded text-sm" />
            <textarea placeholder="Review Text" value={formData.review_text || ""} onChange={e => setFormData({...formData, review_text: e.target.value})} className="w-full border p-2 rounded text-sm h-24" />
            <div className="flex justify-end gap-2"><button onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm">Cancel</button><button onClick={handleSave} className="bg-[#4A1F58] text-white px-4 py-2 rounded text-sm">Save</button></div>
          </div>
        </div>
      )}
    </div>
  );
}

// ==========================================
// 7. NEWSLETTER SUBSCRIBERS VIEWER
// ==========================================
function NewsletterViewer() {
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);

  useEffect(() => {
    const fetchSubs = async () => {
      const { data } = await supabase.from("ecommerce_newsletter_subscribers").select("*").order("subscribed_at", { ascending: false });
      if (data) setSubscribers(data);
    };
    fetchSubs();
  }, []);

  return (
    <div className="w-full flex flex-col gap-6 animate-in fade-in duration-300">
      <div className="flex justify-between items-center">
        <div><h2 className="text-xl font-semibold text-slate-900">Newsletter Audience</h2><p className="text-sm text-slate-500">Total Active Subscribers: {subscribers.length}</p></div>
      </div>
      <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-left text-sm text-slate-600">
          <thead className="bg-slate-50 border-b"><tr><th className="px-6 py-3">Email</th><th className="px-6 py-3">Date</th></tr></thead>
          <tbody className="divide-y">
            {subscribers.map((sub) => (
  <tr key={sub.id} className="hover:bg-slate-50">
    <td className="px-6 py-4 font-medium text-slate-900 flex items-center gap-3">
      <Mail className="w-4 h-4 text-slate-400" /> 
      {sub.email}
    </td>
    <td className="px-6 py-4 text-slate-500">
      <CalendarDays className="w-4 h-4 inline mr-2" />
      {new Date(sub.subscribed_at).toLocaleDateString()}
    </td>
  </tr>
))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ==========================================
// 8. LEGAL & POLICY PAGES MANAGER
// ==========================================
function PolicyManager() {
  const [policies, setPolicies] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState<any>({ blocks: [] });

  const fetchPolicies = async () => {
    setIsLoading(true);
    const { data } = await supabase.from("ecommerce_policies").select("*").order("page_title");
    if (data) setPolicies(data);
    setIsLoading(false);
  };
  useEffect(() => { fetchPolicies(); }, []);

  const handleSave = async () => {
    const { error } = await supabase.from("ecommerce_policies").update({
      page_title: formData.page_title,
      subtitle: formData.subtitle,
      hero_icon: formData.hero_icon,
      support_email: formData.support_email,
      support_phone: formData.support_phone,
      blocks: formData.blocks,
      is_active: formData.is_active
    }).eq("slug", formData.slug);
    
    if (error) {
      toast.error("Failed to update policy.");
    } else {
      toast.success("Policy updated successfully.");
      setIsModalOpen(false);
      fetchPolicies();
    }
  };

  const addBlock = () => {
    setFormData({ ...formData, blocks: [...formData.blocks, { title: "New Section", icon: "Info", content: "<p>Content goes here...</p>" }] });
  };

  const removeBlock = (index: number) => {
    const newBlocks = [...formData.blocks];
    newBlocks.splice(index, 1);
    setFormData({ ...formData, blocks: newBlocks });
  };

  const updateBlock = (index: number, field: string, value: string) => {
    const newBlocks = [...formData.blocks];
    newBlocks[index][field] = value;
    setFormData({ ...formData, blocks: newBlocks });
  };

  return (
    <div className="w-full flex flex-col gap-6 animate-in fade-in duration-300">
      <div>
        <h2 className="text-xl font-semibold text-slate-900 tracking-tight">Legal & Policy Pages</h2>
        <p className="text-sm text-slate-500 mt-1">Manage content, icons, and structures for dynamic policy pages.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? <Loader2 className="w-6 h-6 animate-spin text-slate-400 mx-auto col-span-full" /> : policies.map((policy) => (
          <div key={policy.slug} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-mono font-bold bg-slate-100 text-slate-500 px-2 py-1 rounded">/{policy.slug}</span>
              <div className={`w-2 h-2 rounded-full ${policy.is_active ? 'bg-emerald-500' : 'bg-slate-300'}`} />
            </div>
            <h3 className="font-bold text-slate-900">{policy.page_title}</h3>
            <p className="text-xs text-slate-500 mt-1 mb-4 line-clamp-1">{policy.subtitle}</p>
            <button onClick={() => { setFormData(policy); setIsModalOpen(true); }} className="mt-auto flex items-center justify-center w-full py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-sm font-medium transition-colors">
              <Edit2 className="w-3.5 h-3.5 mr-2" /> Edit Layout & Content
            </button>
          </div>
        ))}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-lg text-slate-900">Editing: {formData.page_title}</h3>
              <button onClick={() => setIsModalOpen(false)}><X className="w-5 h-5 text-slate-400 hover:text-slate-900" /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
              {/* Header Settings */}
              <div className="grid grid-cols-2 gap-4">
                <div><Label className="text-xs mb-1 block">Page Title</Label><Input value={formData.page_title} onChange={e => setFormData({...formData, page_title: e.target.value})} /></div>
                <div><Label className="text-xs mb-1 block">Subtitle</Label><Input value={formData.subtitle} onChange={e => setFormData({...formData, subtitle: e.target.value})} /></div>
                <div>
                  <Label className="text-xs mb-1 block">Hero Icon</Label>
                  <select value={formData.hero_icon} onChange={e => setFormData({...formData, hero_icon: e.target.value})} className="w-full border p-2 rounded-md text-sm">
                    {AVAILABLE_ICONS.concat(["Truck", "Scale", "FileText", "Lock", "AlertCircle", "Package", "Clock", "Coins", "Info", "Gift"]).map(icon => <option key={icon} value={icon}>{icon}</option>)}
                  </select>
                </div>
                <div className="flex items-center gap-4 mt-6">
                  <Label className="text-xs font-semibold">Active Status</Label>
                  <Switch checked={formData.is_active} onCheckedChange={(v) => setFormData({...formData, is_active: v})} />
                </div>
              </div>

              <Separator />

              {/* Dynamic Content Blocks */}
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h4 className="font-bold text-slate-900">Content Blocks</h4>
                  <Button onClick={addBlock} size="sm" variant="outline" className="h-8"><Plus className="w-4 h-4 mr-1"/> Add Section</Button>
                </div>
                
                <div className="space-y-4">
                  {formData.blocks.map((block: any, idx: number) => (
                    <div key={idx} className="bg-slate-50 border border-slate-200 p-4 rounded-xl relative group">
                      <button onClick={() => removeBlock(idx)} className="absolute top-4 right-4 text-rose-400 hover:text-rose-600"><Trash2 className="w-4 h-4"/></button>
                      <div className="grid grid-cols-3 gap-4 mb-3 pr-8">
                        <div className="col-span-2"><Label className="text-[10px] uppercase block mb-1">Section Heading</Label><Input value={block.title} onChange={e => updateBlock(idx, 'title', e.target.value)} className="h-8 text-sm" /></div>
                        <div>
                          <Label className="text-[10px] uppercase block mb-1">Icon</Label>
                          <select value={block.icon} onChange={e => updateBlock(idx, 'icon', e.target.value)} className="w-full border p-1.5 rounded-md text-sm bg-white">
                            {AVAILABLE_ICONS.concat(["Truck", "Scale", "FileText", "Lock", "AlertCircle", "Package", "Clock", "Coins", "Info", "Gift"]).map(icon => <option key={icon} value={icon}>{icon}</option>)}
                          </select>
                        </div>
                      </div>
                      <div>
                        <Label className="text-[10px] uppercase block mb-1">HTML Content</Label>
                        <textarea value={block.content} onChange={e => updateBlock(idx, 'content', e.target.value)} className="w-full h-32 p-3 border border-slate-200 rounded-md text-sm font-mono focus:ring-1 focus:ring-slate-900 outline-none resize-y" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-5 border-t border-slate-100 bg-white flex justify-end gap-3 shrink-0">
              <Button variant="ghost" onClick={() => setIsModalOpen(false)}>Cancel</Button>
              <Button onClick={handleSave} className="bg-slate-900 text-white hover:bg-slate-800"><Save className="w-4 h-4 mr-2" /> Save Layout</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ==========================================
// 9. CATEGORY GRID LAYOUT MANAGER
// ==========================================
function CategoryGridManager() {
  const [categories, setCategories] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const fetchCategories = async () => {
    setIsLoading(true);
    // Fetch only Top-Level categories (parent_id is null) that are active
    const { data } = await supabase
      .from("ecommerce_categories")
      .select("*")
      .is("parent_id", null)
      .eq("is_active", true)
      .order("sort_order", { ascending: true });
      
    if (data) setCategories(data);
    setIsLoading(false);
  };

  useEffect(() => { fetchCategories(); }, []);

  const handleOrderChange = (index: number, newOrder: number) => {
    const updated = [...categories];
    updated[index].sort_order = newOrder;
    // Sort array locally so the UI updates the position descriptions immediately
    updated.sort((a, b) => a.sort_order - b.sort_order);
    setCategories(updated);
  };

  const handleSaveSequence = async () => {
    setIsSaving(true);
    try {
      // Update all categories at once
      await Promise.all(
        categories.map((cat) =>
          supabase
            .from("ecommerce_categories")
            .update({ sort_order: cat.sort_order })
            .eq("id", cat.id)
        )
      );
      toast.success("Category layout sequence updated!");
      fetchCategories();
    } catch (error) {
      toast.error("Failed to update sequence.");
    } finally {
      setIsSaving(false);
    }
  };

  // Helper function to tell the admin exactly what shape the category will take
  const getSlotDescription = (idx: number) => {
    const pattern = idx % 7;
    switch (pattern) {
      case 0: return { shape: "Massive Square (2x2)", desc: "Takes up two rows and two columns. Best for Hero Category.", color: "text-indigo-600 bg-indigo-50" };
      case 1: return { shape: "Small Square (1x1)", desc: "Standard grid block.", color: "text-zinc-600 bg-zinc-100" };
      case 2: return { shape: "Tall Portrait (1x2)", desc: "Takes up two vertical rows.", color: "text-emerald-600 bg-emerald-50" };
      case 3: return { shape: "Small Square (1x1)", desc: "Standard grid block.", color: "text-zinc-600 bg-zinc-100" };
      case 4: return { shape: "Small Square (1x1)", desc: "Standard grid block.", color: "text-zinc-600 bg-zinc-100" };
      case 5: return { shape: "Wide Landscape (2x1)", desc: "Takes up two horizontal columns.", color: "text-amber-600 bg-amber-50" };
      case 6: return { shape: "Small Square (1x1)", desc: "Standard grid block.", color: "text-zinc-600 bg-zinc-100" };
      default: return { shape: "Standard", desc: "", color: "text-zinc-600 bg-zinc-100" };
    }
  };

  return (
    <div className="w-full flex flex-col gap-6 animate-in fade-in duration-300">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-xl font-semibold text-slate-900 tracking-tight">Category Grid Layout</h2>
          <p className="text-sm text-slate-500 mt-1 max-w-2xl">
            Control exactly where each category appears on the storefront homepage. 
            The layout uses a repeating 7-block pattern. Adjust the Sort Order below to map categories to their specific geometric shapes.
          </p>
        </div>
        <Button 
          onClick={handleSaveSequence} 
          disabled={isSaving} 
          className="bg-[#4A1F58] hover:bg-[#302832] text-white shadow-sm h-10 px-6 shrink-0"
        >
          {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          Save Sequence
        </Button>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-left text-sm text-slate-600">
          <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
            <tr>
              <th className="px-6 py-4 font-medium w-24">Sequence</th>
              <th className="px-6 py-4 font-medium">Category Detail</th>
              <th className="px-6 py-4 font-medium">Resulting Storefront Layout Shape</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? (
              <tr><td colSpan={3} className="py-12 text-center"><Loader2 className="w-6 h-6 animate-spin text-slate-400 mx-auto" /></td></tr>
            ) : categories.length === 0 ? (
              <tr><td colSpan={3} className="py-12 text-center text-slate-500">No active top-level categories found.</td></tr>
            ) : (
              categories.map((cat, idx) => {
                const slot = getSlotDescription(idx);
                return (
                  <tr key={cat.id} className="hover:bg-slate-50 transition-colors">
                    
                    {/* Sort Order Input */}
                    <td className="px-6 py-4">
                      <Input 
                        type="number" 
                        value={cat.sort_order} 
                        onChange={(e) => handleOrderChange(idx, parseInt(e.target.value) || 0)}
                        className="w-20 text-center font-bold font-mono h-10 border-slate-300 focus-visible:ring-[#4A1F58]"
                      />
                    </td>

                    {/* Category Details */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-4">
                        {cat.image_url ? (
                          <img src={cat.image_url} className="w-12 h-12 object-cover rounded-md border border-slate-200 shadow-sm" alt={cat.name} />
                        ) : (
                          <div className="w-12 h-12 rounded-md bg-slate-100 border border-slate-200 flex items-center justify-center">
                            <ImageIcon className="w-4 h-4 text-slate-300" />
                          </div>
                        )}
                        <div>
                          <div className="font-bold text-slate-900 text-base">{cat.name}</div>
                          <div className="text-[11px] font-mono text-slate-400 mt-0.5">/{cat.slug}</div>
                        </div>
                      </div>
                    </td>

                    {/* Storefront Layout Position Hint */}
                    <td className="px-6 py-4">
                      <div className="flex flex-col items-start gap-1">
                        <span className={`text-xs font-bold px-2.5 py-1 rounded border border-current/20 ${slot.color}`}>
                          {slot.shape}
                        </span>
                        <span className="text-[11px] text-slate-500 max-w-[200px] leading-tight">
                          {slot.desc}
                        </span>
                      </div>
                    </td>

                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ==========================================
// 10. CHECKOUT & SHIPPING SETTINGS MANAGER
// ==========================================
function CheckoutSettingsManager() {
  const [settings, setSettings] = useState<any>({
    flat_rate: 0,
    free_shipping_threshold: 0,
    is_active: false,
    gst_percentage: 3 // Default to 3% for jewellery
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const fetchSettings = async () => {
    setIsLoading(true);
    const { data } = await supabase
      .from("ecommerce_store_config")
      .select("config_value")
      .eq("config_key", "shipping_settings")
      .single();
    
    if (data && data.config_value) {
      setSettings({
        ...data.config_value,
        gst_percentage: data.config_value.gst_percentage ?? 3
      });
    }
    setIsLoading(false);
  };

  useEffect(() => { fetchSettings(); }, []);

  const handleSave = async () => {
    setIsSaving(true);
    const { error } = await supabase
      .from("ecommerce_store_config")
      .update({ 
        config_value: settings, 
        updated_at: new Date().toISOString() 
      })
      .eq("config_key", "shipping_settings");
      
    if (error) {
      toast.error("Failed to save settings.");
    } else {
      toast.success("Checkout & Tax rules updated successfully.");
    }
    setIsSaving(false);
  };

  if (isLoading) return <Loader2 className="w-6 h-6 animate-spin text-slate-400 mx-auto mt-10" />;

  return (
    <div className="w-full flex flex-col gap-6 animate-in fade-in duration-300 max-w-3xl">
      <div>
        <h2 className="text-xl font-semibold text-slate-900 tracking-tight">Checkout, Tax & Shipping</h2>
        <p className="text-sm text-slate-500 mt-1">Configure global delivery charges and GST rates applied during customer checkout.</p>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-6">
        
        {/* Tax Settings */}
        <div className="border-b border-slate-100 pb-6">
          <Label className="text-sm font-bold text-slate-900 mb-4 block">Global Tax Settings (GST)</Label>
          <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 max-w-sm">
            <Label className="text-xs font-bold text-slate-700 mb-2 block uppercase tracking-wider">
              Total GST Percentage (%)
            </Label>
            <Input 
              type="number" 
              step="0.1"
              value={settings.gst_percentage} 
              onChange={e => setSettings({...settings, gst_percentage: Number(e.target.value)})} 
              className="h-10 text-sm font-bold bg-white"
            />
            <p className="text-[10px] text-slate-500 mt-2 leading-relaxed">
              Standard is 3% for Diamond Jewellery. The system will automatically split this equally into CGST (1.5%) and SGST (1.5%) on the final invoice.
            </p>
          </div>
        </div>

        {/* Shipping Settings */}
        <div className="pt-2">
          <div className="flex items-center justify-between mb-5">
            <div>
              <Label className="text-sm font-bold text-slate-900">Enable Shipping Charges</Label>
              <p className="text-xs text-slate-500 mt-1">If disabled, all orders will automatically receive Free Shipping.</p>
            </div>
            <Switch 
              checked={settings.is_active} 
              onCheckedChange={(v) => setSettings({...settings, is_active: v})} 
              className="data-[state=checked]:bg-[#4A1F58]"
            />
          </div>

          {settings.is_active && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                <Label className="text-xs font-bold text-slate-700 mb-2 block uppercase tracking-wider">
                  Flat Delivery Rate (₹)
                </Label>
                <Input 
                  type="number" 
                  value={settings.flat_rate} 
                  onChange={e => setSettings({...settings, flat_rate: Number(e.target.value)})} 
                  className="h-10 text-sm font-bold bg-white"
                />
              </div>
              
              <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                <Label className="text-xs font-bold text-slate-700 mb-2 block uppercase tracking-wider">
                  Free Shipping Threshold (₹)
                </Label>
                <Input 
                  type="number" 
                  value={settings.free_shipping_threshold} 
                  onChange={e => setSettings({...settings, free_shipping_threshold: Number(e.target.value)})} 
                  className="h-10 text-sm font-bold bg-white"
                />
              </div>
            </div>
          )}
        </div>

        <div className="pt-4 flex justify-end border-t border-slate-100">
          <Button 
            onClick={handleSave} 
            disabled={isSaving} 
            className="bg-[#4A1F58] hover:bg-[#302832] text-white shadow-sm px-6 h-10"
          >
            {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Save Checkout Settings
          </Button>
        </div>

      </div>
    </div>
  );
}