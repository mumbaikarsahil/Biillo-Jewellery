"use client"

import React, { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { useStoreLocation } from '@/hooks/useStoreLocation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { 
  Select, SelectContent, SelectItem, 
  SelectTrigger, SelectValue 
} from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter 
} from '@/components/ui/dialog'
import { supabase } from '@/lib/supabaseClient'
import { toast } from 'sonner'
import { 
  Search, ArrowRight, Loader2, QrCode, Store, Camera, X, Gem, Image as ImageIcon,
  UserPlus, User, MessageCircle, Phone, MapPin, CheckCircle2, Gift, History, AlertCircle, Edit2, Receipt, Ticket
} from 'lucide-react'
import { Scanner } from '@yudiel/react-qr-scanner'
import { cn } from '@/lib/utils'

import { WhatsAppSenderModal } from '@/components/WhatsAppSenderModal'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'

interface ProductDiscovery {
  id: string
  barcode: string
  metal_type: string
  purity_karat: string
  gross_weight_g: number
  net_weight_g: number
  total_stone_weight_cts: number
  item_category: string
  cost_making: number 
  mrp: number
  status: string
  is_exchanged: boolean
  warehouse_id?: string
  sku_reference: string | null
  total_stone_pieces: number
  
  image_url?: string | null
  metal_color?: string | null
  diamond_shape?: string | null
  diamond_color?: string | null
  diamond_clarity?: string | null
  is_custom_order?: boolean
  solitaire_weight_cts?: number
  solitaire_pieces?: number
  melee_weight_cts?: number
  melee_pieces?: number
  item_size?: string | null
  remarks?: string | null
  huid_code?: string | null
  hsn_code?: string | null
}

interface Customer {
  id: string;
  full_name: string;
  phone: string;
  email?: string | null;
  city?: string | null;
  address?: string | null;
  pan_no?: string | null;
  birth_date?: string | null;
  anniversary_date?: string | null;
  customer_status?: string;
  invoices?: any[];
  vouchers?: any[];
  activity_timeline?: any[];
  [key: string]: any;
}

interface AvailableGift {
  item_name: string;
  stock_count: number;
}

// --- Date Helpers ---
const formatToDBDate = (dateStr?: string) => {
  if (!dateStr) return null;
  const parts = dateStr.split('-');
  if (parts.length === 3) {
     const d = parts[0].padStart(2, '0');
     const m = parts[1].padStart(2, '0');
     let y = parts[2];
     if (y.length === 2) y = parseInt(y) > 30 ? `19${y}` : `20${y}`;
     if (y.length === 4) return `${y}-${m}-${d}`;
  }
  return null; 
};

const formatToDisplayDate = (dbDateStr?: string | null) => {
  if (!dbDateStr) return '';
  const parts = dbDateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}-${parts[1]}-${parts[0]}`; // Convert YYYY-MM-DD to DD-MM-YYYY
  }
  return dbDateStr;
};

export default function DiscoveryPage() {
  const { appUser, loading: authLoading } = useAuth()
  const router = useRouter()
  
  const { isHQ, isLocked, selectedLocation, setSelectedLocation } = useStoreLocation()
  
  const [warehouses, setWarehouses] = useState<{id: string, name: string}[]>([])
  const [searchInput, setSearchInput] = useState('')
  const [product, setProduct] = useState<ProductDiscovery | null>(null)
  const [fetching, setFetching] = useState(false)
  const [showScanner, setShowScanner] = useState(false)

  // Customer & Check-in State
  const [phoneInput, setPhoneInput] = useState('')
  const [isSearchingCust, setIsSearchingCust] = useState(false)
  const [existingCustomer, setExistingCustomer] = useState<Customer | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isCheckedIn, setIsCheckedIn] = useState(false)
  
  // Forms
  const [newCustForm, setNewCustForm] = useState({ 
    full_name: '', phone: '', email: '', city: '', address: '', pan_no: '', birth_date: '', anniversary_date: '' 
  })
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isSavingProfile, setIsSavingProfile] = useState(false)

  // Gifting State
  const [availableGifts, setAvailableGifts] = useState<AvailableGift[]>([])
  const [selectedGift, setSelectedGift] = useState<string>('none')
  const [isCheckingGifts, setIsCheckingGifts] = useState(false)

  // WhatsApp State
  const [isWaModalOpen, setIsWaModalOpen] = useState(false)

  useEffect(() => {
    const init = async () => {
      if (!appUser) return
      try {
        const { data: whData } = await supabase
          .from('warehouses')
          .select('id, name')
          .eq('company_id', appUser.company_id)
          .eq('is_active', true)
          .order('name')

        if (whData) setWarehouses(whData)
      } catch (err) {
        toast.error('Failed to load initial data')
      }
    }
    init()
  }, [appUser])

  useEffect(() => {
    const fetchGifts = async () => {
      if (!appUser || !selectedLocation || selectedLocation === 'ALL') {
        setAvailableGifts([]);
        setSelectedGift('none');
        return;
      }
      setIsCheckingGifts(true);
      try {
        const { data, error } = await supabase
          .from('gifting_inventory')
          .select('item_name, stock_count')
          .eq('company_id', appUser.company_id)
          .eq('warehouse_id', selectedLocation)
          .gt('stock_count', 0)
          .order('item_name');

        if (error) throw error;
        setAvailableGifts(data || []);
        if (data && !data.find(g => g.item_name === selectedGift)) {
          setSelectedGift('none');
        }
      } catch (err) {
        console.error("Error fetching gifts:", err);
      } finally {
        setIsCheckingGifts(false);
      }
    };

    fetchGifts();
  }, [appUser, selectedLocation]);

  const handlePhoneChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const cleanPhone = e.target.value.replace(/\D/g, '');
    setPhoneInput(cleanPhone);
    setNewCustForm(prev => ({ ...prev, phone: cleanPhone }));
    setIsCheckedIn(false); 

    if (cleanPhone.length === 10) {
      setIsSearchingCust(true);
      try {
        // 1. Fetch Core Profile
        const { data: custData } = await supabase
          .from('customers')
          .select('*')
          .eq('company_id', appUser?.company_id)
          .eq('phone', cleanPhone)
          .maybeSingle();
        
        if (custData) {
          // 2. Fetch Insights (Invoices & Vouchers) in parallel
          const [invRes, vouchRes] = await Promise.all([
            supabase.from('invoices').select('final_total, invoice_number').eq('customer_id', custData.id),
            supabase.from('vouchers').select('status, code').eq('customer_id', custData.id)
          ]);

          custData.invoices = invRes.data || [];
          custData.vouchers = vouchRes.data || [];
          setExistingCustomer(custData);
        } else {
          setExistingCustomer(null);
        }
      } catch (error) {
        console.error("Failed to search customer", error);
      } finally {
        setIsSearchingCust(false);
      }
    } else {
      setExistingCustomer(null);
    }
  };

  const handleDateInput = (field: 'birth_date' | 'anniversary_date', value: string) => {
    if (newCustForm[field].length > value.length) {
      setNewCustForm(prev => ({ ...prev, [field]: value }));
      return;
    }
    const digits = value.replace(/\D/g, ''); 
    let formatted = digits;
    if (digits.length > 2 && digits.length <= 4) {
      formatted = `${digits.slice(0, 2)}-${digits.slice(2)}`;
    } else if (digits.length > 4) {
      formatted = `${digits.slice(0, 2)}-${digits.slice(2, 4)}-${digits.slice(4, 8)}`;
    }
    setNewCustForm(prev => ({ ...prev, [field]: formatted }));
  }

  // ✨ PROFILE COMPLETION ENGINE
  const completionStats = useMemo(() => {
    if (!existingCustomer) return { percentage: 0, missing: [] };
    
    const fields = [
      { key: 'full_name', label: 'Name' },
      { key: 'phone', label: 'Phone' },
      { key: 'email', label: 'Email' },
      { key: 'birth_date', label: 'Birthday' },
      { key: 'anniversary_date', label: 'Anniversary' },
      { key: 'city', label: 'City' },
      { key: 'address', label: 'Address' },
      { key: 'pan_no', label: 'PAN Number' }
    ];

    const filled = fields.filter(f => !!existingCustomer[f.key]);
    const missing = fields.filter(f => !existingCustomer[f.key]);
    
    return {
      percentage: Math.round((filled.length / fields.length) * 100),
      missing: missing.map(m => m.label)
    };
  }, [existingCustomer]);

  const openEditModal = () => {
    if (!existingCustomer) return;
    setNewCustForm({
      full_name: existingCustomer.full_name || '',
      phone: existingCustomer.phone || '',
      email: existingCustomer.email || '',
      city: existingCustomer.city || '',
      address: existingCustomer.address || '',
      pan_no: existingCustomer.pan_no || '',
      birth_date: formatToDisplayDate(existingCustomer.birth_date),
      anniversary_date: formatToDisplayDate(existingCustomer.anniversary_date)
    });
    setIsEditModalOpen(true);
  }

  const handleUpdateProfile = async () => {
    if (!existingCustomer) return;
    const finalBirthDate = formatToDBDate(newCustForm.birth_date);
    const finalAnnivDate = formatToDBDate(newCustForm.anniversary_date);

    setIsSavingProfile(true);
    try {
      const payload = {
        full_name: newCustForm.full_name,
        phone: newCustForm.phone,
        email: newCustForm.email || null,
        city: newCustForm.city || null,
        address: newCustForm.address || null,
        pan_no: newCustForm.pan_no?.toUpperCase() || null,
        birth_date: finalBirthDate,
        anniversary_date: finalAnnivDate
      };

      const { data, error } = await supabase
        .from('customers')
        .update(payload)
        .eq('id', existingCustomer.id)
        .select()
        .single();

      if (error) throw error;
      
      // Merge insights back in so UI doesn't drop them
      data.invoices = existingCustomer.invoices;
      data.vouchers = existingCustomer.vouchers;
      
      setExistingCustomer(data);
      setIsEditModalOpen(false);
      toast.success("Profile updated successfully!");
    } catch (err: any) {
      toast.error(err.message || "Failed to update profile.");
    } finally {
      setIsSavingProfile(false);
    }
  }

  const processGiftIssue = async (customerId: string) => {
    if (selectedGift !== 'none' && selectedLocation && selectedLocation !== 'ALL') {
      try {
        const { error: giftErr } = await supabase.rpc('issue_gifting_item', {
          p_company_id: appUser?.company_id,
          p_warehouse_id: selectedLocation,
          p_item_name: selectedGift
        });

        if (giftErr) throw giftErr;

        await supabase.from('customer_gifts_history').insert({
          company_id: appUser?.company_id,
          customer_id: customerId,
          warehouse_id: selectedLocation,
          gift_name: selectedGift
        });

        await supabase.from('customers').update({ 
          gift_given: selectedGift 
        }).eq('id', customerId);

        toast.success(`${selectedGift} successfully issued and logged!`);
        
        setAvailableGifts(prev => prev.map(g => 
          g.item_name === selectedGift ? { ...g, stock_count: g.stock_count - 1 } : g
        ).filter(g => g.stock_count > 0));
        setSelectedGift('none');
        
      } catch (err: any) {
        toast.error(`Failed to issue gift: ${err.message}`);
      }
    }
  };

  const handleAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (phoneInput.length !== 10) return toast.error("Enter a valid 10-digit phone number.");
    if (selectedGift !== 'none' && (!selectedLocation || selectedLocation === 'ALL')) {
      return toast.error("Please select a specific store context to issue a gift.");
    }

    setIsProcessing(true);
    try {
      let activeCustomerId = existingCustomer?.id;

      const newSystemEvent = {
        timestamp: new Date().toISOString(),
        type: 'WALK-IN',
        description: 'Store Visit / Discovery Check-in'
      };

      if (existingCustomer) {
        const existingTimeline = existingCustomer.activity_timeline || [];
        const updatedTimeline = [newSystemEvent, ...existingTimeline];

        await supabase
          .from('customers')
          .update({ 
            customer_status: 'Walk-in',
            activity_timeline: updatedTimeline 
          })
          .eq('id', existingCustomer.id);
        
        toast.success("Walk-in recorded successfully!");
      } else {
        if (!newCustForm.full_name) return toast.error("Name is required for new customers.");
        
        const payload = {
          company_id: appUser?.company_id,
          warehouse_id: selectedLocation === 'ALL' ? null : selectedLocation,
          full_name: newCustForm.full_name.trim(),
          phone: phoneInput,
          email: newCustForm.email.trim() || null,
          city: newCustForm.city.trim() || null,
          address: newCustForm.address.trim() || null,
          pan_no: newCustForm.pan_no.trim().toUpperCase() || null,
          birth_date: formatToDBDate(newCustForm.birth_date),
          anniversary_date: formatToDBDate(newCustForm.anniversary_date),
          customer_status: 'Walk-in', 
          activity_timeline: [newSystemEvent], 
        };

        const { data, error } = await supabase
          .from('customers')
          .insert([payload])
          .select()
          .single();

        if (error) throw error;
        activeCustomerId = data.id;
        
        data.invoices = [];
        data.vouchers = [];
        setExistingCustomer(data);
        toast.success("Customer registered & checked in successfully!");
      }

      if (activeCustomerId) {
        await processGiftIssue(activeCustomerId);
      }

      setIsCheckedIn(true);
    } catch (err: any) {
      toast.error(`Operation failed: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDiscovery = async (qrCodeData: string) => {
    if (!qrCodeData.trim()) return
    if (!selectedLocation) return toast.error("Select your current location first.")

    setFetching(true)
    try {
      let query = supabase
        .from('inventory_items')
        .select('*') 
        .ilike('barcode', qrCodeData.trim())
        .eq('company_id', appUser?.company_id)

      if (selectedLocation !== 'ALL') {
        query = query.eq('warehouse_id', selectedLocation)
      }

      const { data, error } = await query.maybeSingle()

      if (error) throw error
      if (!data) {
        toast.error(selectedLocation !== 'ALL' ? "Item not found in this specific branch." : "Item does not exist in the system.")
        setProduct(null)
      } else {
        setProduct(data)
        setSearchInput(qrCodeData) 
      }
    } catch (err) {
      toast.error("Discovery Failed. Please try again.")
    } finally {
      setFetching(false)
    }
  }

  const handleCheckout = () => {
    const isShadowUser = appUser?.role === 'shadow_manager' || appUser?.role === 'shadow_sales'
    const targetRoute = isShadowUser ? '/shadow-pos' : '/pos'

    if (product) {
      const prodWhId = String(product.warehouse_id || '').toLowerCase().trim();
      const currWhId = String(selectedLocation || '').toLowerCase().trim();
      const custParam = existingCustomer ? `&customer_id=${existingCustomer.id}` : '';

      if (prodWhId && currWhId !== 'all' && currWhId !== prodWhId) {
        if (isLocked) {
          toast.error("Cross-branch sales are not permitted.", {
             description: "This item belongs to a different branch."
          });
          return;
        }

        setSelectedLocation(product.warehouse_id || '');
        toast.info("Context switched to match item branch.");
        
        setTimeout(() => {
          router.push(`${targetRoute}?barcode=${product.barcode}&location=${product.warehouse_id || ''}${custParam}`)
        }, 250);
        return; 
      }

      router.push(`${targetRoute}?barcode=${product.barcode}&location=${product.warehouse_id || ''}${custParam}`)
    } else {
      router.push(targetRoute)
    }
  }

  const onScanSuccess = (detectedCodes: any[]) => {
    if (detectedCodes && detectedCodes.length > 0) {
      setShowScanner(false)
      handleDiscovery(detectedCodes[0].rawValue)
    }
  }

  if (authLoading || !appUser) return null

  let basePrice = 0
  let gstAmount = 0
  let finalPrice = 0

  if (product) {
    basePrice = product.mrp || 0
    gstAmount = basePrice * 0.03
    finalPrice = Math.round(basePrice + gstAmount)
  }

  return (
    <div className="min-h-screen bg-[#fafafa] flex flex-col font-sans selection:bg-indigo-100 pb-20">
      
      {/* CAMERA OVERLAY */}
      {showScanner && (
        <div className="fixed inset-0 z-[60] bg-black flex flex-col">
          <div className="flex justify-between items-center p-4 bg-slate-900 text-white">
            <h2 className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
              <QrCode className="w-4 h-4 text-indigo-400" /> Scan Asset Tag
            </h2>
            <Button variant="ghost" size="icon" onClick={() => setShowScanner(false)} className="text-white hover:bg-white/20 rounded-full">
              <X className="w-6 h-6" />
            </Button>
          </div>
          <div className="flex-1 relative bg-black flex items-center justify-center">
            <Scanner onScan={onScanSuccess} onError={(error) => console.log(error)} components={{ finder: true }} />
          </div>
          <div className="p-6 bg-slate-900 text-center text-xs text-slate-400 uppercase tracking-widest">
            Point camera at the jewelry QR tag
          </div>
        </div>
      )}

      {/* HEADER */}
      <header className="h-14 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center sticky top-0 z-40 shadow-sm box-border">
        <div className="w-full max-w-5xl mx-auto flex justify-between items-center gap-4">
          <div className="flex items-center gap-2.5">
            <div className="h-7 w-7 bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center rounded text-xs shadow-sm">
              <Gem className="w-3.5 h-3.5" />
            </div>
            <h1 className="text-sm font-semibold text-slate-900 tracking-tight leading-none">Product Discovery</h1>
          </div>
          
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Store className="w-4 h-4 text-slate-400 hidden sm:block" />
            <Select value={selectedLocation || ''} onValueChange={setSelectedLocation} disabled={isLocked}>
              <SelectTrigger className="h-8 text-xs font-semibold bg-white border-slate-200 focus:ring-1 focus:ring-indigo-500 w-full sm:w-48 md:w-56 rounded-md shadow-sm">
                <SelectValue placeholder="Select Context Node..." />
              </SelectTrigger>
              <SelectContent className="rounded-md border-slate-200 shadow-lg z-50">
                {isHQ && <SelectItem value="ALL" className="text-xs font-bold text-indigo-600">Global Search (HQ)</SelectItem>}
                {warehouses.map(w => <SelectItem key={w.id} value={w.id} className="text-xs font-medium">{w.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </header>

      {/* MAIN WORKSPACE */}
      <main className="p-4 sm:p-6 flex-1 w-full max-w-5xl mx-auto space-y-6">
        
        {/* CUSTOMER WALK-IN MODULE */}
        <Card className="shadow-sm border-slate-200 bg-white rounded-xl overflow-visible z-30 relative">
          <CardContent className="p-4 sm:p-5">
            <form onSubmit={handleAction} className="flex flex-col gap-4">
              
              <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end w-full">
                
                {/* Phone Input (Primary trigger) */}
                <div className="space-y-1.5 w-full sm:flex-1 relative">
                  <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Customer Phone *</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input 
                      required 
                      type="tel" 
                      maxLength={10} 
                      placeholder="10-digit number" 
                      className={cn("h-10 pl-9 text-sm font-medium transition-colors", 
                        phoneInput.length === 10 && existingCustomer ? "bg-emerald-50 border-emerald-200" : "bg-slate-50 border-slate-200"
                      )} 
                      value={phoneInput} 
                      onChange={handlePhoneChange} 
                    />
                    {isSearchingCust && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-slate-400" />}
                    {phoneInput.length === 10 && !isSearchingCust && existingCustomer && (
                      <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500" />
                    )}
                  </div>
                </div>

                {/* NEW CUSTOMER REGISTRATION FIELDS */}
                {phoneInput.length === 10 && !isSearchingCust && !existingCustomer && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 w-full animate-in fade-in slide-in-from-left-2 mt-2">
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest">New Customer Name *</Label>
                      <Input required placeholder="Full Name" className="h-10 text-sm bg-white border-indigo-200 focus-visible:ring-indigo-500" value={newCustForm.full_name} onChange={e => setNewCustForm({...newCustForm, full_name: e.target.value})} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Email (Optional)</Label>
                      <Input type="email" placeholder="email@address.com" className="h-10 text-sm bg-slate-50" value={newCustForm.email} onChange={e => setNewCustForm({...newCustForm, email: e.target.value})} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Date of Birth (Optional)</Label>
                      <Input type="text" placeholder="DD-MM-YYYY" className="h-10 text-sm bg-white border-slate-200 text-slate-700 font-mono" value={newCustForm.birth_date} onChange={e => handleDateInput('birth_date', e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Anniversary (Optional)</Label>
                      <Input type="text" placeholder="DD-MM-YYYY" className="h-10 text-sm bg-slate-50 text-slate-700 font-mono" value={newCustForm.anniversary_date} onChange={e => handleDateInput('anniversary_date', e.target.value)} />
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Address (Optional)</Label>
                      <Input placeholder="Full Address..." className="h-10 text-sm bg-slate-50" value={newCustForm.address} onChange={e => setNewCustForm({...newCustForm, address: e.target.value})} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">City (Optional)</Label>
                      <Input placeholder="City" className="h-10 text-sm bg-slate-50" value={newCustForm.city} onChange={e => setNewCustForm({...newCustForm, city: e.target.value})} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">PAN Number (Optional)</Label>
                      <Input placeholder="ABCDE1234F" className="h-10 text-sm bg-slate-50 uppercase" value={newCustForm.pan_no} onChange={e => setNewCustForm({...newCustForm, pan_no: e.target.value})} />
                    </div>
                  </div>
                )}

                {/* EXISTING CUSTOMER DISPLAY */}
                {phoneInput.length === 10 && !isSearchingCust && existingCustomer && (
                  <div className="w-full flex flex-col gap-3 animate-in fade-in">
                    
                    <div className="w-full flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-[#0078D7] text-white flex items-center justify-center font-bold text-sm uppercase shadow-inner shrink-0">
                          {(existingCustomer.full_name || 'U').charAt(0)}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-slate-800 leading-tight">{existingCustomer.full_name}</span>
                          <span className="text-xs text-slate-500">{existingCustomer.city || 'No City Logged'}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 uppercase tracking-widest text-[9px]">Existing Client</Badge>
                      </div>
                    </div>

                    {/* ✨ VISITOR INSIGHTS PANEL */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 flex flex-col justify-center items-center text-center">
                        <Receipt className="w-4 h-4 text-indigo-500 mb-1" />
                        <span className="text-sm font-black text-slate-900">
                          ₹{existingCustomer.invoices?.reduce((sum, inv) => sum + (Number(inv.final_total) || 0), 0).toLocaleString() || 0}
                        </span>
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Total Spent</span>
                      </div>
                      <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 flex flex-col justify-center items-center text-center">
                        <History className="w-4 h-4 text-slate-400 mb-1" />
                        <span className="text-sm font-black text-slate-900">
                          {existingCustomer.invoices?.length || 0}
                        </span>
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Purchases</span>
                      </div>
                      <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 flex flex-col justify-center items-center text-center">
                        <Ticket className="w-4 h-4 text-amber-500 mb-1" />
                        <span className="text-sm font-black text-slate-900">
                          {existingCustomer.vouchers?.filter(v => v.status === 'registered').length || 0}
                        </span>
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Active Vouchers</span>
                      </div>
                      <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 flex flex-col justify-center items-center text-center">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 mb-1" />
                        <span className="text-sm font-black text-slate-900">
                          {existingCustomer.vouchers?.filter(v => v.status === 'redeemed').length || 0}
                        </span>
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Redeemed</span>
                      </div>
                    </div>

                    {/* ✨ PROFILE COMPLETION WIDGET */}
                    {completionStats.percentage < 100 && (
                      <div className="flex items-center justify-between bg-orange-50 border border-orange-200 px-3 py-2 rounded-lg">
                         <div className="flex flex-col gap-0.5">
                            <span className="text-[10px] font-bold text-orange-700 flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" /> Profile {completionStats.percentage}% Complete
                            </span>
                            <span className="text-[9px] font-medium text-orange-600 truncate max-w-[200px] sm:max-w-md">
                              Missing: {completionStats.missing.join(', ')}
                            </span>
                         </div>
                         <Button 
                           type="button"
                           size="sm" 
                           variant="outline" 
                           className="h-7 text-[10px] font-bold border-orange-200 text-orange-700 bg-white hover:bg-orange-100 shadow-sm shrink-0" 
                           onClick={openEditModal}
                         >
                           Complete
                         </Button>
                      </div>
                    )}
                  </div>
                )}

                {/* Gifting Selector (Only shows if valid number & store selected) */}
                {phoneInput.length === 10 && (!selectedLocation || selectedLocation === 'ALL' ? (
                  <div className="w-full sm:w-auto h-10 px-4 flex items-center justify-center bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-400 shrink-0 mt-3 sm:mt-0">
                    Select branch to issue gifts
                  </div>
                ) : (
                  <div className="w-full sm:w-48 shrink-0 mt-3 sm:mt-0">
                    <Select value={selectedGift} onValueChange={setSelectedGift}>
                      <SelectTrigger className="h-10 border-slate-200 bg-white focus:ring-amber-500">
                        <Gift className={cn("w-4 h-4 mr-2", selectedGift !== 'none' ? "text-amber-500" : "text-slate-400")} />
                        <SelectValue placeholder="Issue Gift..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none" className="text-xs font-semibold text-slate-500">No Gift</SelectItem>
                        {isCheckingGifts ? (
                          <div className="p-2 flex items-center justify-center"><Loader2 className="w-4 h-4 animate-spin text-slate-400" /></div>
                        ) : availableGifts.length === 0 ? (
                          <SelectItem value="empty" disabled className="text-xs italic text-slate-400">Inventory Empty</SelectItem>
                        ) : (
                          availableGifts.map(gift => (
                            <SelectItem key={gift.item_name} value={gift.item_name} className="text-xs font-bold text-slate-800">
                              {gift.item_name} <span className="text-slate-400 font-normal ml-1">({gift.stock_count} left)</span>
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>

              {/* Action Bar */}
              {phoneInput.length === 10 && !isSearchingCust && (
                <div className="flex gap-2 w-full justify-end mt-2 pt-4 border-t border-slate-100 animate-in fade-in">
                  
                  {existingCustomer ? (
                    <>
                      <Button 
                        type="button"
                        onClick={() => setIsWaModalOpen(true)}
                        className="h-10 bg-[#25D366] hover:bg-[#20bd5a] text-white font-bold text-xs shadow-sm flex-1 sm:flex-none"
                      >
                        <MessageCircle className="w-4 h-4 mr-1.5" /> WhatsApp
                      </Button>
                      <Button 
                        type="submit" 
                        disabled={isProcessing || isCheckedIn} 
                        className={cn("h-10 text-white text-xs font-bold px-6 flex-1 sm:flex-none", 
                          isCheckedIn ? "bg-emerald-600 hover:bg-emerald-700" : "bg-slate-900 hover:bg-slate-800"
                        )}
                      >
                        {isProcessing ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : 
                         isCheckedIn ? <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> : 
                         <Store className="w-3.5 h-3.5 mr-1.5" />}
                        {isCheckedIn ? "Checked In" : "Log Walk-in"}
                      </Button>
                    </>
                  ) : (
                    <Button 
                      type="submit" 
                      disabled={isProcessing} 
                      className="h-10 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-8 w-full sm:w-auto shadow-sm"
                    >
                      {isProcessing ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <UserPlus className="w-3.5 h-3.5 mr-1.5" />}
                      Register & Check In
                    </Button>
                  )}
                </div>
              )}
            </form>
          </CardContent>
        </Card>

        {/* Search Command Bar (For Products) */}
        <div className="bg-white border border-slate-200 rounded-xl p-2 shadow-sm flex flex-col sm:flex-row gap-2 items-center relative z-20">
          <div className="relative flex-1 w-full flex gap-2">
            <div className="relative flex-1">
              <Input 
                placeholder="Search Product SKU or scan tag..."
                className="h-10 pl-9 pr-4 text-sm font-medium bg-slate-50 border-slate-200 focus-visible:bg-white focus-visible:border-slate-400 focus-visible:ring-1 focus-visible:ring-slate-400 rounded-lg w-full transition-all"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleDiscovery(searchInput)}
                disabled={fetching}
              />
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            </div>
            {/* Mobile Camera Button */}
            <Button onClick={() => setShowScanner(true)} className="h-10 w-12 shrink-0 bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 rounded-lg sm:hidden shadow-sm flex items-center justify-center p-0">
              <Camera className="w-5 h-5" />
            </Button>
          </div>

          <div className="flex gap-2 w-full sm:w-auto shrink-0">
            <Button onClick={() => setShowScanner(true)} variant="outline" className="h-10 px-4 font-semibold text-xs border-slate-200 text-slate-700 bg-white hover:bg-slate-50 rounded-lg hidden sm:flex shadow-sm">
              <Camera className="w-4 h-4 mr-2" /> Scan Tag
            </Button>
            <Button onClick={() => handleDiscovery(searchInput)} disabled={fetching || !searchInput.trim()} className="h-10 px-6 font-semibold text-xs bg-slate-900 hover:bg-slate-800 text-white rounded-lg w-full sm:w-auto shadow-sm">
              {fetching ? <Loader2 className="w-4 h-4 animate-spin" /> : "Lookup Asset"}
            </Button>
          </div>
        </div>

        {product ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in duration-300 zoom-in-95">
            
            {/* ========================================= */}
            {/* THERMAL RECEIPT 1: SPECIFICATIONS         */}
            {/* ========================================= */}
            <div className="bg-[#FAFAF9] border-t-4 border-b-4 border-dashed border-slate-300 shadow-md p-6 font-mono text-slate-900 relative">
              
              {/* Receipt Header w/ Image Preview */}
              <div className="flex items-center gap-4 border-b-2 border-dashed border-slate-300 pb-4 mb-4">
                {product.image_url ? (
                  <img src={product.image_url} alt="Item" className="w-16 h-16 rounded-md object-cover border border-slate-200 shadow-sm shrink-0 bg-white" />
                ) : (
                  <div className="w-16 h-16 rounded-md bg-slate-100 border border-slate-200 flex flex-col items-center justify-center shrink-0">
                    <ImageIcon className="w-6 h-6 text-slate-300 mb-1" />
                    <span className="text-[7px] uppercase tracking-widest text-slate-400 font-bold">No Image</span>
                  </div>
                )}
                
                <div className="flex-1 text-left">
                  <h2 className="text-lg font-black uppercase tracking-widest text-slate-900 leading-none">Asset Specs</h2>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <span className="inline-block px-1.5 py-0.5 border border-slate-900 uppercase text-[9px] font-bold tracking-widest">
                      {product.status.replace('_', ' ')}
                    </span>
                    {product.is_custom_order && (
                      <span className="inline-block px-1.5 py-0.5 bg-purple-100 text-purple-800 border border-purple-200 uppercase text-[9px] font-bold tracking-widest">
                        CUSTOM ORDER
                      </span>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Data Rows */}
              <div className="flex flex-col gap-1.5 text-xs">
                
                {/* Identification */}
                <div className="flex justify-between py-1 border-b border-dotted border-slate-300">
                  <span className="text-slate-500 uppercase tracking-wider">Item Code / SKU</span>
                  <span className="font-bold">{product.barcode} <span className="text-slate-400">|</span> {product.sku_reference || 'N/A'}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-dotted border-slate-300">
                  <span className="text-slate-500 uppercase tracking-wider">Category / Size</span>
                  <span className="font-bold">{product.item_category} <span className="text-slate-400">|</span> {product.item_size || 'Std'}</span>
                </div>

                {/* Metal */}
                <div className="flex justify-between py-1 border-b border-dotted border-slate-300">
                  <span className="text-slate-500 uppercase tracking-wider">Metal Profile</span>
                  <span className="font-bold">{product.metal_type} {product.purity_karat} ({product.metal_color || 'Std'})</span>
                </div>
                <div className="flex justify-between py-1 border-b border-dotted border-slate-300">
                  <span className="text-slate-500 uppercase tracking-wider">GW / NW</span>
                  <span className="font-bold">{product.gross_weight_g.toFixed(3)}g / {product.net_weight_g.toFixed(3)}g</span>
                </div>

                {/* Stones Breakdowns */}
                {(product.total_stone_pieces > 0 || product.total_stone_weight_cts > 0) && (
                  <>
                    <div className="flex justify-between py-1 border-b border-dotted border-slate-300">
                      <span className="text-indigo-600 font-bold uppercase tracking-wider">Total Stones (Pcs/Cts)</span>
                      <span className="font-black text-indigo-700">
                        {product.total_stone_pieces || 0} / {Number(product.total_stone_weight_cts).toFixed(2)}ct
                      </span>
                    </div>

                    {Number(product.solitaire_weight_cts) > 0 && (
                      <div className="flex justify-between py-1 border-b border-dotted border-slate-300">
                        <span className="text-slate-500 uppercase tracking-wider">Solitaire (Pcs/Cts)</span>
                        <span className="font-bold">{product.solitaire_pieces || 0} / {Number(product.solitaire_weight_cts).toFixed(2)}ct</span>
                      </div>
                    )}
                    {Number(product.melee_weight_cts) > 0 && (
                      <div className="flex justify-between py-1 border-b border-dotted border-slate-300">
                        <span className="text-slate-500 uppercase tracking-wider">Melee (Pcs/Cts)</span>
                        <span className="font-bold">{product.melee_pieces || 0} / {Number(product.melee_weight_cts).toFixed(2)}ct</span>
                      </div>
                    )}
                    
                    {(product.diamond_shape || product.diamond_color || product.diamond_clarity) && (
                      <div className="flex justify-between py-1 border-b border-dotted border-slate-300">
                        <span className="text-slate-500 uppercase tracking-wider">Diamond Quality</span>
                        <span className="font-bold">
                          {product.diamond_shape ? `${product.diamond_shape} ` : ''}
                          {product.diamond_color ? `${product.diamond_color}/` : ''}
                          {product.diamond_clarity || ''}
                        </span>
                      </div>
                    )}
                  </>
                )}

                {/* Compliance & Remarks */}
                <div className="flex justify-between py-1 border-b border-dotted border-slate-300">
                  <span className="text-slate-500 uppercase tracking-wider">HUID / HSN</span>
                  <span className="font-bold">{product.huid_code || '---'} <span className="text-slate-400">|</span> {product.hsn_code || '---'}</span>
                </div>

                {product.remarks && (
                  <div className="flex flex-col py-1">
                    <span className="text-slate-500 uppercase tracking-wider mb-0.5">Remarks</span>
                    <span className="font-medium text-[11px] leading-tight text-slate-700 bg-slate-100 p-1.5 rounded">{product.remarks}</span>
                  </div>
                )}

              </div>
              
              {/* Receipt Footer */}
              <div className="mt-4 text-center text-[10px] text-slate-500 uppercase tracking-widest border-t-2 border-dashed border-slate-300 pt-3">
                --- END OF SPECIFICATIONS ---
              </div>
            </div>

            {/* ========================================= */}
            {/* THERMAL RECEIPT 2: FINANCIALS             */}
            {/* ========================================= */}
            <div className="flex flex-col gap-6">
              <div className="bg-[#FAFAF9] border-t-4 border-b-4 border-dashed border-slate-300 shadow-md p-6 font-mono text-slate-900 relative">
                
                {/* Receipt Header */}
                <div className="text-center border-b-2 border-dashed border-slate-300 pb-4 mb-4">
                  <h2 className="text-lg font-black uppercase tracking-widest text-slate-900">*** Quotation ***</h2>
                </div>
                
                {/* Data Rows */}
                <div className="flex flex-col gap-2 text-sm">
                  
                  <div className="flex justify-between items-center py-2 text-base">
                    <span className="font-bold uppercase tracking-wider text-slate-500">Base Price</span>
                    <span className="font-black">
                      Rs. {basePrice.toLocaleString(undefined, {maximumFractionDigits: 0})}
                    </span>
                  </div>

                  <div className="flex justify-between py-2 border-b-2 border-slate-900 pb-3">
                    <span className="uppercase tracking-wider text-slate-500">GST (3%)</span>
                    <span className="font-bold">
                      + Rs. {gstAmount.toLocaleString(undefined, {maximumFractionDigits: 0})}
                    </span>
                  </div>

                  {/* Final Total */}
                  <div className="flex justify-between items-end pt-3 pb-1">
                    <span className="text-sm font-black uppercase tracking-widest text-slate-500">Net Total</span>
                    <span className="text-3xl font-black tracking-tighter text-indigo-700">
                      ₹{finalPrice.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                    </span>
                  </div>

                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 w-full">
                <Button 
                  onClick={() => setProduct(null)} 
                  variant="outline" 
                  className="flex-1 h-12 text-sm font-semibold border-slate-300 bg-white text-slate-700 hover:bg-slate-50 rounded-lg shadow-sm"
                >
                  Clear Terminal
                </Button>
                <Button 
                  onClick={handleCheckout} 
                  className="flex-[2] h-12 text-sm font-bold bg-slate-900 hover:bg-slate-800 text-white rounded-lg shadow-sm uppercase tracking-widest"
                >
                  Send to POS {existingCustomer && '(w/ Customer)'} <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </div>

          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-24 text-slate-400 space-y-4 bg-white border border-slate-200 rounded-xl shadow-sm max-w-2xl mx-auto">
            <div className="h-16 w-16 bg-slate-50 rounded-full flex items-center justify-center border border-slate-100">
              <QrCode className="w-8 h-8 text-slate-300" />
            </div>
            <div className="text-center space-y-1.5">
              <p className="text-sm font-bold text-slate-600 uppercase tracking-widest">Awaiting Input</p>
              <p className="text-xs font-medium">Scan a tag or search an SKU to reveal details.</p>
            </div>
          </div>
        )}

      </main>

      {/* EDIT PROFILE MODAL */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="sm:max-w-[450px] border border-slate-300 shadow-xl p-0 rounded-sm overflow-hidden bg-white w-[95vw] sm:w-full">
          <DialogHeader className="bg-slate-100 p-4 border-b border-slate-200">
            <DialogTitle className="text-base font-semibold text-slate-800">Complete Customer Profile</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 sm:p-5 max-h-[65vh] overflow-y-auto custom-scrollbar">
            
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs font-semibold text-slate-700">Full Name *</Label>
              <Input className="h-9 rounded-sm border-slate-300" value={newCustForm.full_name} onChange={(e) => setNewCustForm({...newCustForm, full_name: e.target.value})} />
            </div>
            
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Phone *</Label>
              <Input className="h-9 rounded-sm border-slate-300" value={newCustForm.phone} onChange={(e) => setNewCustForm({...newCustForm, phone: e.target.value})} disabled />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Email</Label>
              <Input type="email" className="h-9 rounded-sm border-slate-300" value={newCustForm.email} onChange={(e) => setNewCustForm({...newCustForm, email: e.target.value})} />
            </div>
            
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">D.O.B (DD-MM-YYYY)</Label>
              <Input 
                type="text" 
                inputMode="numeric"
                placeholder="15-08-1990"
                className="h-9 rounded-sm border-slate-300 font-mono tracking-widest text-sm" 
                value={newCustForm.birth_date} 
                onChange={(e) => handleDateInput('birth_date', e.target.value)} 
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Anniversary (DD-MM-YYYY)</Label>
              <Input 
                type="text" 
                inputMode="numeric"
                placeholder="25-12-2015"
                className="h-9 rounded-sm border-slate-300 font-mono tracking-widest text-sm" 
                value={newCustForm.anniversary_date} 
                onChange={(e) => handleDateInput('anniversary_date', e.target.value)} 
              />
            </div>

            <div className="space-y-1.5 sm:col-span-2 border-t border-slate-100 pt-3">
              <Label className="text-xs font-semibold text-slate-700">Address</Label>
              <Input className="h-9 rounded-sm border-slate-300" value={newCustForm.address} onChange={(e) => setNewCustForm({...newCustForm, address: e.target.value})} />
            </div>
            
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">City</Label>
              <Input className="h-9 rounded-sm border-slate-300" value={newCustForm.city} onChange={(e) => setNewCustForm({...newCustForm, city: e.target.value})} />
            </div>
            
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">PAN Number</Label>
              <Input className="h-9 rounded-sm border-slate-300 uppercase" value={newCustForm.pan_no} onChange={(e) => setNewCustForm({...newCustForm, pan_no: e.target.value})} />
            </div>
          </div>
          <DialogFooter className="p-4 bg-slate-50 border-t border-slate-200">
            <Button variant="ghost" className="rounded-sm text-sm w-full sm:w-auto" onClick={() => setIsEditModalOpen(false)}>Cancel</Button>
            <Button 
              onClick={handleUpdateProfile} 
              disabled={isSavingProfile}
              className="rounded-sm text-sm bg-[#0078D7] hover:bg-[#005A9E] text-white px-6 w-full sm:w-auto mt-2 sm:mt-0 shadow-sm"
            >
              {isSavingProfile ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />} Update Profile
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <WhatsAppSenderModal 
        isOpen={isWaModalOpen}
        onClose={() => setIsWaModalOpen(false)}
        recipients={existingCustomer ? [{ phone: existingCustomer.phone, name: existingCustomer.full_name }] : []}
      />
    </div>
  )
}