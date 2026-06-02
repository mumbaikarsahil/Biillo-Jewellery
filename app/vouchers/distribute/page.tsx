"use client"

import React, { useEffect, useState, useMemo, useRef } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/hooks/useAuth'
import { useReactToPrint } from 'react-to-print'
import QRCode from 'react-qr-code' 
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter 
} from "@/components/ui/dialog"
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import { 
  Loader2, FileText, CheckCircle2, CalendarDays, IndianRupee, Send, 
  Store, Package, ListOrdered, Hash, Info, ArrowLeft, ChevronRight, RefreshCw, Database, User, Eye, Truck, Gift, Printer, QrCode as QrCodeIcon, Download
} from 'lucide-react'
import { addMonths, format } from 'date-fns'

interface VoucherCode {
  id: string;
  code: string;
}

export default function DistributeVouchersPage() {
  const { appUser } = useAuth()
  
  // Data States
  const [distributors, setDistributors] = useState<any[]>([])
  const [batches, setBatches] = useState<any[]>([])
  const [challans, setChallans] = useState<any[]>([])
  const [agents, setAgents] = useState<any[]>([]) 
  const [companyData, setCompanyData] = useState<any>(null)
  
  // Form States
  const [allocationType, setAllocationType] = useState<'vendor' | 'event'>('vendor')
  const [distributorId, setDistributorId] = useState('')
  const [selectedBatch, setSelectedBatch] = useState('')
  const [quantity, setQuantity] = useState('')
  const [validityMonths, setValidityMonths] = useState('1')
  const [customExpiry, setCustomExpiry] = useState('')
  const [totalFee, setTotalFee] = useState('')
  const [deliveryAgent, setDeliveryAgent] = useState('')
  const [isBirthdayRedemption, setIsBirthdayRedemption] = useState(false) 
  
  // Sequence Tracking States
  const [availableVouchers, setAvailableVouchers] = useState<VoucherCode[]>([]);
  const [isLoadingVouchers, setIsLoadingVouchers] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  // View Details & Print Modal State
  const [viewChallan, setViewChallan] = useState<any>(null)
  const [viewSequence, setViewSequence] = useState<{start: string, end: string} | null>(null)
  const [isLoadingSequence, setIsLoadingSequence] = useState(false)
  
  // Event QR Modal State
  const [eventQrData, setEventQrData] = useState<{ url: string, prefix: string, count: number } | null>(null)

  const printRef = useRef<HTMLDivElement>(null)
  const handlePrintChallan = useReactToPrint({ 
    contentRef: printRef,
    documentTitle: viewChallan ? `Delivery_Challan_${viewChallan.id.slice(0,8)}` : 'Delivery_Challan'
  })

  const fetchData = async () => {
    if (!appUser?.company_id) return
    setIsLoading(true)
    try {
      const { data: comp } = await supabase.from('companies').select('*').eq('id', appUser.company_id).single()
      if (comp) setCompanyData(comp)

      const { data: dists } = await supabase.from('voucher_distributors').select('*').eq('company_id', appUser.company_id).order('distributor_name')
      if (dists) setDistributors(dists)

      const { data: agentData } = await supabase.from('delivery_agents').select('*').eq('company_id', appUser.company_id).order('name')
      if (agentData) setAgents(agentData)

      // ─── ✨ UPDATED BATCH FETCHING LOGIC ✨ ───
      // Removed nested `vouchers(status)` array query to avoid the 1000 row truncation
      const { data: batchData } = await supabase
        .from("voucher_batches")
        .select(`id, batch_no, prefix, discount_value, handling_fee, status`)
        .eq('company_id', appUser.company_id)
        .order('created_at', { ascending: false }); 

      if (batchData) {
        // Run a fast exact count query per batch to bypass any limits
        const formattedBatchesRaw = await Promise.all(
          batchData.map(async (b) => {
            const { count } = await supabase
              .from('vouchers')
              .select('id', { count: 'exact', head: true }) // head: true means do not download the rows, just return the number
              .eq('batch_id', b.id)
              .eq('status', 'in_stock');

            return {
              id: b.id,
              batch_no: b.batch_no,
              prefix: b.prefix,
              discount_value: b.discount_value,
              handling_fee: b.handling_fee || 0,
              available_stock: count || 0
            };
          })
        );
        
        const formattedBatches = formattedBatchesRaw.filter(b => b.available_stock > 0); 
        setBatches(formattedBatches);
      }

      const { data: records } = await supabase
        .from('voucher_distributions')
        .select('*, voucher_distributors(*)')
        .eq('company_id', appUser.company_id)
        .order('created_at', { ascending: false })
      if (records) setChallans(records)

    } catch (err) {
      toast.error('Failed to load data')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [appUser])

  // --- SEQUENCE AUTO-FETCHER ---
  useEffect(() => {
    if (!selectedBatch) {
      setAvailableVouchers([]);
      setQuantity("");
      return;
    }

    const fetchVoucherSequence = async () => {
      setIsLoadingVouchers(true);
      try {
        const { data, error } = await supabase
          .from("vouchers")
          .select("id, code")
          .eq("batch_id", selectedBatch)
          .eq("status", "in_stock")
          .order("code", { ascending: true }); 

        if (error) throw error;
        setAvailableVouchers(data || []);
        setQuantity(""); 
      } catch (error: any) {
        toast.error("Error fetching sequence: " + error.message);
      } finally {
        setIsLoadingVouchers(false);
      }
    };

    fetchVoucherSequence();
  }, [selectedBatch]);

  const handleQuantityChange = (val: string) => {
    if (!val) {
      setQuantity("");
      return;
    }
    const num = parseInt(val);
    const maxAvailable = availableVouchers.length;
    
    if (num > maxAvailable) {
      setQuantity(maxAvailable.toString());
      toast.info(`Quantity auto-adjusted to max available stock (${maxAvailable}).`);
    } else {
      setQuantity(val);
    }
  };

  const { numQuantity, isValidQuantity, startCode, endCode, vouchersToUpdate } = useMemo(() => {
    const num = parseInt(quantity) || 0;
    const isValid = num > 0 && num <= availableVouchers.length;
    const toUpdate = isValid ? availableVouchers.slice(0, num) : [];
    
    return {
      numQuantity: num,
      isValidQuantity: isValid,
      startCode: isValid ? toUpdate[0].code : "---",
      endCode: isValid ? toUpdate[toUpdate.length - 1].code : "---",
      vouchersToUpdate: toUpdate
    };
  }, [quantity, availableVouchers]);

  const handleProcessAllocation = async () => {
    if (!selectedBatch) return toast.error("Select a source batch")
    if (!isValidQuantity) return toast.error(`Please enter a valid quantity between 1 and ${availableVouchers.length}.`)

    if (allocationType === 'vendor') {
      if (!distributorId) return toast.error("Select a distributor")
      if (!totalFee || parseFloat(totalFee) < 0) return toast.error("Enter a valid total handling fee")
    }

    let finalExpiryDate = ''
    if (validityMonths === 'custom') {
      if (!customExpiry) return toast.error("Select a custom expiry date")
      finalExpiryDate = customExpiry
    } else {
      const months = parseInt(validityMonths)
      finalExpiryDate = format(addMonths(new Date(), months), 'yyyy-MM-dd')
    }

    setIsSubmitting(true)
    try {
      const voucherIds = vouchersToUpdate.map(v => v.id);

      if (allocationType === 'vendor') {
        // --- 1. PHYSICAL VENDOR LOGIC ---
        const { data: challan, error: challanErr } = await supabase
          .from('voucher_distributions')
          .insert({
            company_id: appUser?.company_id,
            distributor_id: distributorId,
            quantity: numQuantity,
            total_amount: parseFloat(totalFee),
            payment_status: 'pending',
            expiry_date: finalExpiryDate,
            delivery_agent: (deliveryAgent && deliveryAgent !== 'none') ? deliveryAgent : null,
            is_birthday_redemption: isBirthdayRedemption
          })
          .select('*, voucher_distributors(*)')
          .single()

        if (challanErr) throw challanErr

        const { error: updateErr } = await supabase
          .from('vouchers')
          .update({
            status: 'distributed',
            distributor_id: distributorId,
            distribution_id: challan.id, 
            expiry_date: finalExpiryDate,
            distributed_at: new Date().toISOString(),
            is_birthday_redemption: isBirthdayRedemption
          })
          .in('id', voucherIds)

        if (updateErr) throw updateErr

        toast.success("Delivery Challan Generated!", {
          description: `Successfully issued ${numQuantity} vouchers (${startCode} to ${endCode}).`
        })
        
        setViewChallan(challan)
        setViewSequence({ start: startCode, end: endCode })
        
      } else {
        // --- 2. DIGITAL EVENT (QR) LOGIC ---
        const { error: updateErr } = await supabase
          .from('vouchers')
          .update({
            status: 'unclaimed', 
            expiry_date: finalExpiryDate,
            is_birthday_redemption: isBirthdayRedemption
          })
          .in('id', voucherIds)

        if (updateErr) throw updateErr

        const detectedPrefix = startCode.replace(/[0-9]/g, '') || startCode.substring(0, 1);
        const eventUrl = `${window.location.origin}/event/${detectedPrefix}`;

        toast.success("Allocated to Digital Event Pool!", {
          description: `${numQuantity} vouchers are now live for QR claims.`
        })

        setEventQrData({
          url: eventUrl,
          prefix: detectedPrefix,
          count: numQuantity
        })
      }

      // Reset Form
      setQuantity('')
      setTotalFee('')
      setDistributorId('')
      setSelectedBatch('')
      setDeliveryAgent('')
      setIsBirthdayRedemption(false)
      fetchData()

    } catch (err: any) {
      toast.error(err.message || "Failed to process allocation")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDownloadQr = () => {
    const svg = document.getElementById("event-qr-code");
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();
    
    img.onload = () => {
      const padding = 24; 
      canvas.width = img.width + (padding * 2);
      canvas.height = img.height + (padding * 2);
      
      if(ctx) {
        ctx.fillStyle = "white";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, padding, padding);
      }
      
      const pngFile = canvas.toDataURL("image/png");
      const downloadLink = document.createElement("a");
      downloadLink.download = `Ossam_Event_QR_${eventQrData?.prefix}.png`;
      downloadLink.href = pngFile;
      downloadLink.click();
    };
    img.src = `data:image/svg+xml;base64,${btoa(svgData)}`;
  };

  const handleMarkPaid = async (challanId: string) => {
    try {
      const { error } = await supabase
        .from('voucher_distributions')
        .update({
          payment_status: 'paid',
          payment_received_at: new Date().toISOString()
        })
        .eq('id', challanId)

      if (error) throw error
      toast.success("Payment Recorded! Vouchers handed over.")
      fetchData()
    } catch (err) {
      toast.error("Failed to update payment status")
    }
  }

  const handleViewChallan = async (challan: any) => {
    setViewChallan(challan);
    setViewSequence(null);
    setIsLoadingSequence(true);
    try {
      const { data, error } = await supabase
        .from('vouchers')
        .select('code')
        .eq('distribution_id', challan.id)
        .order('code', { ascending: true });
        
      if (error) throw error;

      if (data && data.length > 0) {
        setViewSequence({
          start: data[0].code,
          end: data[data.length - 1].code
        });
      } else {
        setViewSequence({ start: 'N/A', end: 'N/A' });
      }
    } catch (err) {
      toast.error("Could not load voucher sequence.");
    } finally {
      setIsLoadingSequence(false);
    }
  }

  if (isLoading) {
    return <div className="p-8 flex justify-center min-h-screen bg-[#fafafa] items-center"><Loader2 className="w-8 h-8 animate-spin text-gray-400" /></div>
  }

  return (
    <div className="flex flex-col min-h-screen bg-[#fafafa]">
      
      {/* HEADER */}
      <header className="sticky top-0 z-40 w-full bg-white/80 backdrop-blur-md border-b border-gray-200 px-4 h-12 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3 overflow-hidden">
          <Link href="/vouchers">
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-md hover:bg-gray-100 transition-colors">
              <ArrowLeft className="h-4 w-4 text-gray-500" />
            </Button>
          </Link>
          
          <Separator orientation="vertical" className="h-4 hidden sm:block" />
          
          <nav className="hidden sm:flex items-center gap-1.5 text-[13px] whitespace-nowrap overflow-hidden">
            <Link href="/vouchers" className="text-gray-500 hover:text-gray-900 transition-colors font-medium">Vouchers</Link>
            <ChevronRight className="h-3.5 w-3.5 text-gray-400" />
            <span className="font-bold text-gray-900 select-none">Distribution Allocation</span>
            
            <div className="ml-3 hidden md:flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-gray-100 border border-gray-200">
              <div className="h-1.5 w-1.5 rounded-full bg-orange-500" />
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-tighter">Live Allocation</span>
            </div>
          </nav>
          
          <span className="sm:hidden font-bold text-gray-900 text-sm">Distribute Vouchers</span>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="h-8 px-2 text-xs font-medium text-gray-500 hover:text-gray-900" onClick={fetchData}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
          <Separator orientation="vertical" className="h-4 mx-1 hidden sm:block" />
          <Button variant="outline" size="sm" className="h-8 text-xs font-bold px-3 shadow-sm border-gray-200 hidden md:flex">
            <Database className="h-3.5 w-3.5 mr-1.5 text-gray-400" />
            Ledger View
          </Button>
        </div>
      </header>

      <main className="p-3 sm:p-4 md:p-6 lg:p-6 max-w-[1400px] w-full mx-auto animate-in fade-in duration-500">
        
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-6 items-start">
          
          {/* ============================================== */}
          {/* LEFT: ALLOCATION & SEQUENCE FORM               */}
          {/* ============================================== */}
          <Card className="lg:col-span-5 xl:col-span-4 border-gray-200/60 shadow-sm bg-white lg:sticky lg:top-16 flex flex-col h-auto lg:max-h-[calc(100vh-5rem)] overflow-hidden">
            
            <CardHeader className="bg-gray-50/50 border-b border-gray-100 p-4 shrink-0">
              <Tabs value={allocationType} onValueChange={(v: any) => setAllocationType(v)} className="w-full">
                <TabsList className="w-full grid grid-cols-2 bg-gray-200/50 p-1">
                  <TabsTrigger value="vendor" className="text-xs font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm">
                    <Store className="w-3.5 h-3.5 mr-1.5" /> Vendor
                  </TabsTrigger>
                  <TabsTrigger value="event" className="text-xs font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm">
                    <QrCodeIcon className="w-3.5 h-3.5 mr-1.5" /> Event (QR)
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </CardHeader>
            
            <CardContent className="p-4 space-y-4 overflow-y-auto custom-scrollbar flex-1 pb-6">
              
              {allocationType === 'vendor' && (
                <div className="space-y-1.5 animate-in fade-in slide-in-from-top-2">
                  <Label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Distributor</Label>
                  <Select value={distributorId} onValueChange={setDistributorId}>
                    <SelectTrigger className="h-10 text-sm bg-gray-50 border-gray-200"><SelectValue placeholder="Select partner..." /></SelectTrigger>
                    <SelectContent className="border-gray-200 max-h-[300px]">
                      {distributors.map(d => (
                        <SelectItem key={d.id} value={d.id}>
                          <div className="flex items-center gap-2 font-medium">
                            <Store className="w-3.5 h-3.5 text-gray-400" /> {d.distributor_name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {allocationType === 'event' && (
                <div className="bg-indigo-50 border border-indigo-100 p-3 rounded-lg flex items-start gap-2.5 animate-in fade-in slide-in-from-top-2">
                  <QrCodeIcon className="w-4 h-4 text-indigo-500 mt-0.5 shrink-0" />
                  <p className="text-[11px] font-medium text-indigo-800 leading-snug">
                    <strong className="block text-xs text-indigo-900 mb-0.5">Digital Event Pool</strong>
                    These vouchers will bypass physical delivery and instantly become available for customers to claim themselves via the public QR code.
                  </p>
                </div>
              )}

              <div className="space-y-1.5 pt-1">
                <Label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Source Batch</Label>
                <Select value={selectedBatch} onValueChange={setSelectedBatch}>
                  <SelectTrigger className="h-10 text-sm bg-gray-50 border-gray-200"><SelectValue placeholder="Choose batch from stock..." /></SelectTrigger>
                  <SelectContent className="border-gray-200 max-h-[300px]">
                    {batches.length === 0 && <SelectItem value="none" disabled>Insufficient inventory across all batches</SelectItem>}
                    {batches.map(batch => (
                      <SelectItem key={batch.id} value={batch.id} className="text-sm font-medium py-2">
                        <div className="flex justify-between items-center w-full min-w-[300px]">
                          <span className="flex items-center gap-2 font-bold text-slate-800">
                            <Package className="w-3.5 h-3.5 text-indigo-500" /> 
                            {batch.batch_no} {batch.prefix && <span className="text-indigo-400">({batch.prefix})</span>}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-100 hidden sm:inline-block">
                               ₹{batch.discount_value} Val / ₹{batch.handling_fee} Fee
                            </span>
                            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">
                              {batch.available_stock} Avail.
                            </span>
                          </div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3 pt-3 border-t border-gray-100">
                <div className="flex items-center justify-between">
                  <Label className="text-[11px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1.5">
                    <ListOrdered className="w-3.5 h-3.5" /> Issue Quantity
                  </Label>
                  {isLoadingVouchers && <Loader2 className="h-3.5 w-3.5 animate-spin text-gray-400" />}
                </div>
                
                <div className="relative">
                  <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    type="number"
                    min="1"
                    max={availableVouchers.length || 1}
                    placeholder={selectedBatch ? `Max: ${availableVouchers.length}` : "Select batch first"}
                    value={quantity}
                    onChange={(e) => handleQuantityChange(e.target.value)}
                    className="h-10 pl-9 text-sm font-bold bg-white border-gray-200 focus-visible:ring-indigo-500"
                    disabled={!selectedBatch || isLoadingVouchers}
                  />
                </div>

                <div className="bg-gray-50 p-3 rounded border border-gray-200">
                  <Label className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block mb-2">Generated Sequence</Label>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-9 bg-white border border-gray-200 rounded flex items-center justify-center font-mono text-xs font-bold text-gray-800 shadow-sm">
                      {startCode}
                    </div>
                    <span className="text-gray-400 text-xs font-medium">to</span>
                    <div className="flex-1 h-9 bg-white border border-gray-200 rounded flex items-center justify-center font-mono text-xs font-bold text-gray-800 shadow-sm">
                      {endCode}
                    </div>
                  </div>
                  
                  {isValidQuantity && allocationType === 'event' && (
                    <p className="text-[10px] text-emerald-600 mt-2 font-bold uppercase tracking-widest text-center pt-1 border-t border-gray-200">
                      Auto-Prefix URL: /event/{startCode.replace(/[0-9]/g, '') || startCode.substring(0, 1)}
                    </p>
                  )}
                </div>
              </div>

              <div className={`grid grid-cols-1 gap-4 pt-3 border-t border-gray-100 ${allocationType === 'vendor' ? 'sm:grid-cols-2' : ''}`}>
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                    <CalendarDays className="w-3.5 h-3.5" /> Validity
                  </Label>
                  <Select value={validityMonths} onValueChange={setValidityMonths}>
                    <SelectTrigger className="h-10 text-sm bg-gray-50 border-gray-200"><SelectValue /></SelectTrigger>
                    <SelectContent className="border-gray-200">
                      <SelectItem value="1">1 Month</SelectItem>
                      <SelectItem value="2">2 Months</SelectItem>
                      <SelectItem value="3">3 Months</SelectItem>
                      <SelectItem value="6">6 Months</SelectItem>
                      <SelectItem value="custom">Custom Date...</SelectItem>
                    </SelectContent>
                  </Select>
                  {validityMonths === 'custom' && (
                    <Input type="date" value={customExpiry} onChange={e => setCustomExpiry(e.target.value)} className="h-10 mt-2 bg-white border-gray-200 text-sm font-mono" />
                  )}
                </div>

                {allocationType === 'vendor' && (
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                      <IndianRupee className="w-3.5 h-3.5" /> Handover Fee
                    </Label>
                    <Input 
                      type="number" placeholder="Total (₹)" 
                      value={totalFee} onChange={e => setTotalFee(e.target.value)}
                      className="h-10 text-sm font-bold text-gray-900 bg-white border-gray-200"
                    />
                  </div>
                )}
              </div>

              {allocationType === 'vendor' && (
                <div className="space-y-1.5 pt-3 border-t border-gray-100">
                  <Label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                    <Truck className="w-3.5 h-3.5" /> Delivery Agent / Courier
                  </Label>
                  <Select value={deliveryAgent} onValueChange={setDeliveryAgent}>
                    <SelectTrigger className="h-10 text-sm bg-white border-gray-200">
                      <SelectValue placeholder="Assign delivery personnel (Optional)" />
                    </SelectTrigger>
                    <SelectContent className="border-gray-200 max-h-[300px]">
                      <SelectItem value="none" className="text-gray-500 italic">Self Pickup / No Agent</SelectItem>
                      {agents.map(a => (
                        <SelectItem key={a.id} value={a.name}>
                          <div className="flex items-center gap-2 font-medium text-gray-900">
                            <User className="w-3.5 h-3.5 text-gray-400" /> 
                            {a.name} <span className="text-[10px] text-gray-400 font-normal">{a.agency_details ? `(${a.agency_details})` : ''}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-1.5 pt-3 border-t border-gray-100 flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-[11px] font-bold text-gray-700 uppercase tracking-widest flex items-center gap-1.5 cursor-pointer" htmlFor="birthday-toggle">
                    <Gift className="w-4 h-4 text-pink-500" /> Birthday Month Rule
                  </Label>
                  <p className="text-[10px] text-gray-500 leading-tight pr-4">
                    If enabled, these vouchers can ONLY be redeemed during the customer's registered birth month.
                  </p>
                </div>
                <input 
                  id="birthday-toggle"
                  type="checkbox" 
                  className="w-5 h-5 rounded border-gray-300 text-pink-600 focus:ring-pink-500 cursor-pointer shrink-0"
                  checked={isBirthdayRedemption}
                  onChange={(e) => setIsBirthdayRedemption(e.target.checked)}
                />
              </div>

            </CardContent>

            <div className="p-4 border-t border-gray-100 bg-white shrink-0">
              <Button 
                className={`w-full h-11 font-bold uppercase tracking-widest text-[11px] shadow-md text-white transition-all shrink-0 ${allocationType === 'vendor' ? 'bg-gray-900 hover:bg-gray-800' : 'bg-indigo-600 hover:bg-indigo-700'}`}
                onClick={handleProcessAllocation}
                disabled={isSubmitting || !isValidQuantity}
              >
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : (allocationType === 'vendor' ? <FileText className="w-4 h-4 mr-2" /> : <QrCodeIcon className="w-4 h-4 mr-2" />)}
                {allocationType === 'vendor' ? 'Generate Delivery Challan' : 'Push to Live QR Pool'}
              </Button>
            </div>
          </Card>

          {/* ============================================== */}
          {/* RIGHT: CHALLANS TRACKER                        */}
          {/* ============================================== */}
          <Card className="lg:col-span-7 xl:col-span-8 border-gray-200/60 shadow-sm bg-white overflow-hidden flex flex-col min-h-[500px] lg:h-[calc(100vh-5rem)]">
            <Tabs defaultValue="pending" className="w-full flex-1 flex flex-col overflow-hidden">
              <CardHeader className="bg-gray-50/80 border-b border-gray-100 pb-0 pt-4 px-4 shrink-0">
                <TabsList className="bg-transparent border-none p-0 h-auto gap-6 flex justify-start overflow-x-auto custom-scrollbar">
                  <TabsTrigger value="pending" className="data-[state=active]:border-b-2 data-[state=active]:border-amber-500 rounded-none px-1 py-2 text-xs font-bold uppercase tracking-widest text-gray-400 data-[state=active]:text-amber-700 shadow-none transition-all whitespace-nowrap">
                    Pending Payment ({challans.filter(c => c.payment_status === 'pending').length})
                  </TabsTrigger>
                  <TabsTrigger value="paid" className="data-[state=active]:border-b-2 data-[state=active]:border-emerald-500 rounded-none px-1 py-2 text-xs font-bold uppercase tracking-widest text-gray-400 data-[state=active]:text-emerald-700 shadow-none transition-all whitespace-nowrap">
                    Completed / Paid ({challans.filter(c => c.payment_status === 'paid').length})
                  </TabsTrigger>
                </TabsList>
              </CardHeader>

              <CardContent className="p-0 flex-1 overflow-hidden relative">
                
                {/* PENDING TAB */}
                <TabsContent value="pending" className="m-0 h-full absolute inset-0 overflow-y-auto custom-scrollbar">
                  <Table>
                    <TableHeader className="bg-gray-50/80 sticky top-0 backdrop-blur-sm z-10 border-b border-gray-200">
                      <TableRow className="hover:bg-transparent border-none">
                        <TableHead className="text-[10px] uppercase font-black tracking-widest text-gray-400 h-10 px-4 md:px-6 whitespace-nowrap">Date</TableHead>
                        <TableHead className="text-[10px] uppercase font-black tracking-widest text-gray-400 h-10 whitespace-nowrap">Distributor</TableHead>
                        <TableHead className="text-[10px] uppercase font-black tracking-widest text-gray-400 h-10 text-center whitespace-nowrap">Qty</TableHead>
                        <TableHead className="text-[10px] uppercase font-black tracking-widest text-gray-400 h-10 text-right whitespace-nowrap">Fee Due</TableHead>
                        <TableHead className="text-[10px] uppercase font-black tracking-widest text-gray-400 h-10 text-right pr-4 md:pr-6 whitespace-nowrap">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {challans.filter(c => c.payment_status === 'pending').map(c => (
                        <TableRow key={c.id} className="hover:bg-gray-50/50 transition-colors border-b border-gray-100">
                          <TableCell className="text-[11px] font-bold text-gray-400 uppercase px-4 md:px-6 py-4 whitespace-nowrap">{format(new Date(c.created_at), 'dd MMM yy')}</TableCell>
                          <TableCell className="py-4 min-w-[120px]">
                            <span className="font-bold text-xs text-gray-900 block">{c.voucher_distributors?.distributor_name}</span>
                            {c.is_birthday_redemption && <span className="text-[9px] font-bold text-pink-600 uppercase tracking-widest block mt-0.5">Birthday Rule</span>}
                          </TableCell>
                          <TableCell className="text-center font-bold text-xs py-4">{c.quantity}</TableCell>
                          <TableCell className="text-right font-black text-sm text-amber-600 py-4 whitespace-nowrap">₹{c.total_amount.toLocaleString()}</TableCell>
                          <TableCell className="text-right pr-4 md:pr-6 py-4">
                            <div className="flex justify-end gap-2">
                              <Button size="icon" variant="ghost" onClick={() => handleViewChallan(c)} className="h-8 w-8 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50" title="View Details">
                                <Eye className="w-4 h-4" />
                              </Button>
                              <Button size="sm" onClick={() => handleMarkPaid(c.id)} className="h-8 px-3 text-[10px] font-bold uppercase tracking-widest bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200 shadow-sm transition-colors whitespace-nowrap">
                                Mark Paid
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                      {challans.filter(c => c.payment_status === 'pending').length === 0 && (
                        <TableRow><TableCell colSpan={6} className="text-center py-20 text-gray-400 text-xs font-bold uppercase tracking-widest italic">No pending challans.</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TabsContent>

                {/* PAID TAB */}
                <TabsContent value="paid" className="m-0 h-full absolute inset-0 overflow-y-auto custom-scrollbar">
                  <Table>
                    <TableHeader className="bg-gray-50/80 sticky top-0 backdrop-blur-sm z-10 border-b border-gray-200">
                      <TableRow className="hover:bg-transparent border-none">
                        <TableHead className="text-[10px] uppercase font-black tracking-widest text-gray-400 h-10 px-4 md:px-6 whitespace-nowrap">Paid On</TableHead>
                        <TableHead className="text-[10px] uppercase font-black tracking-widest text-gray-400 h-10 whitespace-nowrap">Distributor</TableHead>
                        <TableHead className="text-[10px] uppercase font-black tracking-widest text-gray-400 h-10 text-center whitespace-nowrap">Qty</TableHead>
                        <TableHead className="text-[10px] uppercase font-black tracking-widest text-gray-400 h-10 text-right pr-4 md:pr-6 whitespace-nowrap">Fee & Details</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {challans.filter(c => c.payment_status === 'paid').map(c => (
                        <TableRow key={c.id} className="hover:bg-gray-50/50 transition-colors border-b border-gray-100">
                          <TableCell className="text-[11px] font-bold text-gray-400 uppercase px-4 md:px-6 py-4 whitespace-nowrap">{c.payment_received_at ? format(new Date(c.payment_received_at), 'dd MMM yy') : '---'}</TableCell>
                          <TableCell className="py-4 min-w-[120px]">
                            <span className="font-bold text-xs text-gray-900 block">{c.voucher_distributors?.distributor_name}</span>
                            {c.is_birthday_redemption && <span className="text-[9px] font-bold text-pink-600 uppercase tracking-widest block mt-0.5">Birthday Rule</span>}
                          </TableCell>
                          <TableCell className="text-center font-bold text-xs py-4">{c.quantity}</TableCell>
                          <TableCell className="text-right pr-4 md:pr-6 py-4">
                            <div className="flex items-center justify-end gap-3">
                              <span className="font-black text-sm text-emerald-600 flex items-center gap-1.5">
                                <CheckCircle2 className="w-3.5 h-3.5" /> ₹{c.total_amount.toLocaleString()}
                              </span>
                              <Button size="icon" variant="ghost" onClick={() => handleViewChallan(c)} className="h-8 w-8 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 border border-gray-200 bg-white shadow-sm" title="View Details">
                                <Eye className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                      {challans.filter(c => c.payment_status === 'paid').length === 0 && (
                        <TableRow><TableCell colSpan={4} className="text-center py-20 text-gray-400 text-xs font-bold uppercase tracking-widest italic">No completed distributions yet.</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TabsContent>

              </CardContent>
            </Tabs>
          </Card>
        </div>
      </main>

      {/* --- EVENT QR DOWNLOAD MODAL --- */}
      <Dialog open={!!eventQrData} onOpenChange={(open) => !open && setEventQrData(null)}>
        <DialogContent className="sm:max-w-sm text-center flex flex-col items-center bg-white shadow-2xl rounded-2xl overflow-hidden p-0 border-none">
          <div className="w-full bg-indigo-600 p-6 flex flex-col items-center relative overflow-hidden">
            <div className="absolute inset-0 bg-[url('/noise.png')] opacity-10 mix-blend-overlay"></div>
            <QrCodeIcon className="w-10 h-10 text-white mb-2 relative z-10" />
            <DialogTitle className="text-xl font-bold text-white relative z-10">Event QR Code Ready!</DialogTitle>
            <DialogDescription className="text-indigo-100 mt-1 relative z-10">
              {eventQrData?.count} vouchers allocated to series <strong className="text-white">{eventQrData?.prefix}</strong>.
            </DialogDescription>
          </div>
          
          <div className="p-6 flex flex-col items-center w-full">
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm mb-4">
              <QRCode id="event-qr-code" value={eventQrData?.url || ''} size={180} level="Q" />
            </div>
            
            <div className="w-full bg-gray-50 border border-gray-200 rounded-lg p-3 mb-6">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1 text-left">Claim URL</p>
              <p className="text-xs font-mono text-indigo-600 text-left truncate select-all">
                {eventQrData?.url}
              </p>
            </div>
            
            <div className="w-full flex gap-3">
              <Button variant="outline" className="flex-1 border-gray-200" onClick={() => setEventQrData(null)}>Close</Button>
              <Button className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white shadow-md" onClick={handleDownloadQr}>
                <Download className="w-4 h-4 mr-2" /> Download
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* --- VIEW DETAILS DIALOG --- */}
      <Dialog open={!!viewChallan} onOpenChange={(open) => !open && setViewChallan(null)}>
        <DialogContent className="sm:max-w-[450px] p-0 overflow-hidden border-none shadow-2xl">
          <DialogHeader className="bg-gray-50 p-6 border-b border-gray-200">
            <DialogTitle className="text-lg font-bold text-gray-900 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-600" />
                Delivery Challan
              </span>
              <Button size="sm" variant="outline" className="h-8 px-3 text-[10px] font-bold uppercase tracking-widest text-indigo-700 bg-indigo-50 border-indigo-200 hover:bg-indigo-100" onClick={handlePrintChallan}>
                <Printer className="w-3.5 h-3.5 mr-1.5" /> Print
              </Button>
            </DialogTitle>
            <DialogDescription className="text-xs font-medium text-gray-500 mt-1">
              Ref: {viewChallan?.id?.slice(0, 8).toUpperCase()}
            </DialogDescription>
          </DialogHeader>

          {viewChallan && (
            <div className="p-6 space-y-5">
              
              {viewChallan.is_birthday_redemption && (
                <div className="bg-pink-50 border border-pink-200 p-3 rounded-lg flex items-center gap-3">
                  <Gift className="w-6 h-6 text-pink-500 shrink-0" />
                  <p className="text-[11px] font-medium text-pink-800 leading-snug">
                    <strong className="block text-xs text-pink-900">Birthday Restricted</strong>
                    These vouchers can only be redeemed during the registered customer's birth month.
                  </p>
                </div>
              )}

              <div className="flex justify-between items-center py-2 border-b border-dashed border-gray-200">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Distributor</span>
                <span className="font-bold text-sm text-gray-900">{viewChallan.voucher_distributors?.distributor_name}</span>
              </div>
              
              <div className="flex justify-between items-center py-2 border-b border-dashed border-gray-200">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Quantity</span>
                <span className="font-black text-sm text-gray-900">{viewChallan.quantity} Vouchers</span>
              </div>

              <div className="flex justify-between items-center py-2 border-b border-dashed border-gray-200">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Expiry Date</span>
                <span className="font-bold text-sm text-gray-900">{format(new Date(viewChallan.expiry_date), 'dd MMM yyyy')}</span>
              </div>

              <div className="flex justify-between items-center py-2 border-b border-dashed border-gray-200">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1.5"><User className="w-3.5 h-3.5"/> Agent</span>
                <span className="font-bold text-sm text-gray-900">{viewChallan.delivery_agent || 'Self Pickup'}</span>
              </div>

              <div className="bg-gray-50 p-3 rounded border border-gray-200 mt-4">
                <Label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block mb-2">Attached Sequence</Label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-9 bg-white border border-gray-200 rounded flex items-center justify-center font-mono text-sm font-bold text-gray-800 shadow-sm">
                    {isLoadingSequence ? <Loader2 className="w-4 h-4 animate-spin text-gray-400" /> : viewSequence?.start}
                  </div>
                  <span className="text-gray-400 text-xs font-medium">to</span>
                  <div className="flex-1 h-9 bg-white border border-gray-200 rounded flex items-center justify-center font-mono text-sm font-bold text-gray-800 shadow-sm">
                    {isLoadingSequence ? <Loader2 className="w-4 h-4 animate-spin text-gray-400" /> : viewSequence?.end}
                  </div>
                </div>
              </div>

            </div>
          )}
          <DialogFooter className="bg-gray-50 p-4 border-t border-gray-200">
            <Button variant="outline" className="w-full h-10 font-bold uppercase tracking-widest text-[11px]" onClick={() => setViewChallan(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* --- HIDDEN PRINT TEMPLATE FOR DELIVERY CHALLAN --- */}
      <div className="hidden">
        <div ref={printRef} className="bg-white text-black p-10 font-sans" style={{ width: '210mm', minHeight: '297mm', margin: 0, padding: '40px' }}>
          {viewChallan && companyData && (
            <>
              {/* Header */}
              <div className="flex justify-between items-start border-b-2 border-black pb-6 mb-8">
                <div>
                  <h1 className="text-3xl font-black uppercase tracking-widest text-gray-900">{companyData.trade_name || companyData.legal_name || "COMPANY NAME"}</h1>
                  <p className="text-sm font-medium text-gray-600 mt-1 max-w-sm">{companyData.address_line1 || "Head Office / Central Dispatch"}</p>
                  <p className="text-sm font-bold text-gray-600 mt-1">GSTIN: {companyData.gstin || "NOT PROVIDED"}</p>
                </div>
                <div className="text-right">
                  <h2 className="text-2xl font-bold uppercase tracking-widest text-gray-400 mb-2">Delivery Challan</h2>
                  <p className="text-sm font-bold"><span className="text-gray-500 mr-2">CHALLAN NO:</span> {viewChallan.id.slice(0, 8).toUpperCase()}</p>
                  <p className="text-sm font-bold"><span className="text-gray-500 mr-2">DATE:</span> {format(new Date(viewChallan.created_at), 'dd MMM yyyy')}</p>
                </div>
              </div>

              {/* Parties */}
              <div className="grid grid-cols-2 gap-12 mb-10">
                <div>
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 border-b border-gray-200 pb-1">Issued To (Distributor)</h3>
                  <p className="text-lg font-bold text-gray-900">{viewChallan.voucher_distributors?.distributor_name}</p>
                  <p className="text-sm font-medium text-gray-600 mt-1">{viewChallan.voucher_distributors?.contact_person || ""}</p>
                  <p className="text-sm font-medium text-gray-600">{viewChallan.voucher_distributors?.phone || "No contact provided"}</p>
                </div>
                <div>
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 border-b border-gray-200 pb-1">Delivery Agent</h3>
                  <p className="text-lg font-bold text-gray-900">{viewChallan.delivery_agent || "Self Pickup"}</p>
                  <p className="text-sm font-medium text-gray-600 mt-1">Assigned for secure transport.</p>
                </div>
              </div>

              {/* Items Table */}
              <div className="mb-10">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-y-2 border-black">
                      <th className="py-3 px-2 text-left text-xs font-bold uppercase tracking-widest text-gray-500 w-16">Item</th>
                      <th className="py-3 px-2 text-left text-xs font-bold uppercase tracking-widest text-gray-500">Description</th>
                      <th className="py-3 px-2 text-center text-xs font-bold uppercase tracking-widest text-gray-500">Qty</th>
                      <th className="py-3 px-2 text-right text-xs font-bold uppercase tracking-widest text-gray-500">Handling Fee</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-gray-200">
                      <td className="py-4 px-2 font-bold text-gray-900">01</td>
                      <td className="py-4 px-2">
                        <p className="font-bold text-gray-900 text-lg">Physical Vouchers (Gift/Discount Booklets)</p>
                        <p className="text-sm text-gray-600 mt-1 font-mono">Sequence: {viewSequence?.start} to {viewSequence?.end}</p>
                        <p className="text-sm text-gray-600 mt-1">Valid Until: {format(new Date(viewChallan.expiry_date), 'dd MMM yyyy')}</p>
                        {viewChallan.is_birthday_redemption && (
                          <p className="text-xs font-bold text-pink-600 uppercase tracking-widest mt-2 border border-pink-200 bg-pink-50 inline-block px-2 py-1 rounded">
                            Restricted: Birthday Month Redemption Only
                          </p>
                        )}
                      </td>
                      <td className="py-4 px-2 text-center font-black text-xl text-gray-900">{viewChallan.quantity}</td>
                      <td className="py-4 px-2 text-right font-bold text-lg text-gray-900">₹{viewChallan.total_amount.toLocaleString()}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Total & Terms */}
              <div className="flex justify-between items-start mb-20">
                <div className="w-2/3 pr-12">
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Terms & Conditions</h3>
                  <p className="text-[10px] text-gray-500 text-justify leading-relaxed">
                    1. The goods/vouchers listed above are securely handed over to the distributor/agent. <br/>
                    2. The distributor agrees to safely handle and distribute these sequence-tracked vouchers. <br/>
                    3. Loss or theft of physical booklets must be immediately reported to HQ to void the sequence. <br/>
                    4. This challan is for internal stock movement tracking and is not a tax invoice for goods sold.
                  </p>
                </div>
                <div className="w-1/3">
                  <div className="flex justify-between items-center py-2 border-b-2 border-black">
                    <span className="font-bold text-gray-600 uppercase tracking-widest">Total Due:</span>
                    <span className="font-black text-2xl text-gray-900">₹{viewChallan.total_amount.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 text-xs">
                    <span className="font-bold text-gray-500 uppercase tracking-widest">Status:</span>
                    <span className="font-bold text-gray-900 uppercase">{viewChallan.payment_status}</span>
                  </div>
                </div>
              </div>

              {/* Signatures */}
              <div className="grid grid-cols-3 gap-8 mt-auto pt-20 border-t border-gray-200">
                <div className="text-center">
                  <div className="h-16 border-b border-gray-300 mb-2"></div>
                  <p className="text-xs font-bold uppercase tracking-widest text-gray-500">Issuer Signature</p>
                  <p className="text-[10px] text-gray-400 mt-1">Authorized Store Rep</p>
                </div>
                <div className="text-center">
                  <div className="h-16 border-b border-gray-300 mb-2"></div>
                  <p className="text-xs font-bold uppercase tracking-widest text-gray-500">Agent Signature</p>
                  <p className="text-[10px] text-gray-400 mt-1">{viewChallan.delivery_agent || 'N/A'}</p>
                </div>
                <div className="text-center">
                  <div className="h-16 border-b border-gray-300 mb-2"></div>
                  <p className="text-xs font-bold uppercase tracking-widest text-gray-500">Receiver Signature</p>
                  <p className="text-[10px] text-gray-400 mt-1">Distributor Stamp / Sign</p>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

    </div>
  )
}