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
  Loader2, FileText, CheckCircle2, CalendarDays, IndianRupee, Send, X,
  Store, Package, ListOrdered, Hash, Info, ArrowLeft, ChevronRight, RefreshCw, Database, User, Eye, Truck, Gift, Printer, QrCode as QrCodeIcon, Download, PlusCircle, Search, Calendar
} from 'lucide-react'
import { addMonths, format, isWithinInterval, parseISO, startOfDay, endOfDay } from 'date-fns'

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
  
  // Filter States
  const [dateFrom, setDateFrom] = useState<string>('')
  const [dateTo, setDateTo] = useState<string>('')
  const [activeTab, setActiveTab] = useState('pending')

  // Sequence Tracking States
  const [availableVouchers, setAvailableVouchers] = useState<VoucherCode[]>([]);
  const [isLoadingVouchers, setIsLoadingVouchers] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  // Custom Sequence States
  const [sequenceMode, setSequenceMode] = useState<'auto' | 'custom'>('auto')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')

  // Add Distributor States
  const [isNewDistModalOpen, setIsNewDistModalOpen] = useState(false)
  const [isSubmittingDist, setIsSubmittingDist] = useState(false)
  const [newDistData, setNewDistData] = useState({
    distributor_name: '', contact_person: '', phone: '', address: '', distributor_type: 'external_shop'
  })

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

  // --- UPGRADED PDF REPORT LOGIC ---
  const tablePrintRef = useRef<HTMLDivElement>(null)
  const [isPreparingPrint, setIsPreparingPrint] = useState(false)
  const [reportSequences, setReportSequences] = useState<Record<string, {start: string, end: string}>>({})

  const executePrint = useReactToPrint({
    contentRef: tablePrintRef,
    documentTitle: `Distribution_Report_${activeTab}_${format(new Date(), 'dd-MM-yyyy')}`
  })

  const handlePrepareAndPrint = async () => {
    if (filteredChallans.length === 0) return toast.error("No data to print.");
    
    setIsPreparingPrint(true);
    const loadingToast = toast.loading("Preparing PDF Report...");

    try {
      // Fetch sequences in bulk
      const challanIds = filteredChallans.map(c => c.id);
      const { data: voucherData, error } = await supabase
        .from('vouchers')
        .select('code, distribution_id')
        .in('distribution_id', challanIds)
        .order('code', { ascending: true });

      if (error) throw error;

      const sequenceMap: Record<string, { start: string, end: string }> = {};
      filteredChallans.forEach(c => {
        const challanVouchers = (voucherData || []).filter(v => v.distribution_id === c.id);
        if (challanVouchers.length > 0) {
          sequenceMap[c.id] = {
            start: challanVouchers[0].code,
            end: challanVouchers[challanVouchers.length - 1].code
          };
        } else {
          sequenceMap[c.id] = { start: 'N/A', end: 'N/A' };
        }
      });
      
      setReportSequences(sequenceMap);
      toast.dismiss(loadingToast);
      
      // Allow a brief moment for the hidden template DOM to update before triggering the print
      setTimeout(() => {
          executePrint();
          setIsPreparingPrint(false);
      }, 300);

    } catch (err) {
      console.error(err);
      toast.dismiss(loadingToast);
      toast.error("Failed to prepare PDF.");
      setIsPreparingPrint(false);
    }
  };

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

      const { data: batchData } = await supabase
        .from("voucher_batches")
        .select(`id, batch_no, prefix, discount_value, handling_fee, status`)
        .eq('company_id', appUser.company_id)
        .order('created_at', { ascending: false }); 

      if (batchData) {
        const formattedBatchesRaw = await Promise.all(
          batchData.map(async (b) => {
            const { count } = await supabase
              .from('vouchers')
              .select('id', { count: 'exact', head: true })
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

  // Paginated Sequence Auto-Fetcher
  useEffect(() => {
    if (!selectedBatch) {
      setAvailableVouchers([]);
      setQuantity("");
      setCustomStart("");
      setCustomEnd("");
      return;
    }

    const fetchVoucherSequence = async () => {
      setIsLoadingVouchers(true);
      try {
        let allData: VoucherCode[] = [];
        let hasMore = true;
        let page = 0;
        const limit = 1000;

        while (hasMore) {
          const { data, error } = await supabase
            .from("vouchers")
            .select("id, code")
            .eq("batch_id", selectedBatch)
            .eq("status", "in_stock")
            .order("code", { ascending: true })
            .range(page * limit, (page + 1) * limit - 1); 

          if (error) throw error;
          
          if (data && data.length > 0) {
            allData = [...allData, ...data];
            page++;
            if (data.length < limit) hasMore = false;
          } else {
            hasMore = false;
          }
        }

        setAvailableVouchers(allData);
        setQuantity(""); 
        setCustomStart("");
        setCustomEnd("");
      } catch (error: any) {
        toast.error("Error fetching sequence: " + error.message);
      } finally {
        setIsLoadingVouchers(false);
      }
    };

    fetchVoucherSequence();
  }, [selectedBatch]);

  // Auto-Calculate Custom Sequence based on Quantity Changes
  useEffect(() => {
    if (sequenceMode === 'custom' && customStart && parseInt(quantity) > 0) {
      const idx = availableVouchers.findIndex(v => v.code.toLowerCase() === customStart.toLowerCase());
      if (idx !== -1 && idx + parseInt(quantity) <= availableVouchers.length) {
        setCustomEnd(availableVouchers[idx + parseInt(quantity) - 1].code);
      } else {
        setCustomEnd('');
      }
    }
  }, [quantity, sequenceMode, customStart, availableVouchers]);

  // Filter Logic
  const filteredChallans = useMemo(() => {
    let result = challans.filter(c => c.payment_status === activeTab);

    if (dateFrom || dateTo) {
      result = result.filter((challan) => {
        const itemDate = parseISO(challan.created_at);
        const start = dateFrom ? startOfDay(parseISO(dateFrom)) : new Date('2000-01-01');
        const end = dateTo ? endOfDay(parseISO(dateTo)) : new Date('2100-01-01');
        return isWithinInterval(itemDate, { start, end });
      });
    }

    return result;
  }, [challans, activeTab, dateFrom, dateTo]);


  const exportToCSV = async () => {
    if (filteredChallans.length === 0) return toast.error("No data to export");

    const loadingToast = toast.loading("Fetching sequences and preparing export...");

    try {
      // 1. Fetch the sequence codes for all filtered challans in one bulk request
      const challanIds = filteredChallans.map(c => c.id);
      const { data: voucherData, error } = await supabase
        .from('vouchers')
        .select('code, distribution_id')
        .in('distribution_id', challanIds)
        .order('code', { ascending: true });

      if (error) throw error;

      // 2. Map the start and end sequences to their respective challan IDs
      const sequenceMap: Record<string, { start: string, end: string }> = {};
      filteredChallans.forEach(c => {
        const challanVouchers = (voucherData || []).filter(v => v.distribution_id === c.id);
        if (challanVouchers.length > 0) {
          sequenceMap[c.id] = {
            start: challanVouchers[0].code,
            end: challanVouchers[challanVouchers.length - 1].code
          };
        } else {
          sequenceMap[c.id] = { start: 'N/A', end: 'N/A' };
        }
      });

      // 3. Define the comprehensive headers
      const headers = [
        'Date', 
        'Distributor', 
        'Quantity', 
        'Fee Amount (₹)', 
        'Status', 
        'Expiry Date', 
        'Delivery Agent', 
        'Sequence Start', 
        'Sequence End'
      ];

      // 4. Map the data including the newly fetched sequences
      const csvData = filteredChallans.map(c => [
        format(new Date(c.created_at), 'dd-MM-yyyy'),
        `"${c.voucher_distributors?.distributor_name || 'N/A'}"`, 
        c.quantity,
        c.total_amount,
        c.payment_status.toUpperCase(),
        c.expiry_date ? format(new Date(c.expiry_date), 'dd-MM-yyyy') : 'N/A',
        `"${c.delivery_agent || 'Self Pickup'}"`,
        sequenceMap[c.id]?.start || 'N/A',
        sequenceMap[c.id]?.end || 'N/A'
      ]);

      // 5. Append the branding to the bottom of the CSV
      csvData.push([]); 
      csvData.push([]); 
      csvData.push(['Powered By Biillo ERP']);

      // 6. Generate and Download
      const csvContent = [headers.join(','), ...csvData.map(row => row.join(','))].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", `Distributions_${activeTab}_${format(new Date(), 'dd-MM-yyyy')}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.dismiss(loadingToast);
      toast.success("Export downloaded successfully!");

    } catch (err) {
      console.error(err);
      toast.dismiss(loadingToast);
      toast.error("Failed to generate export data.");
    }
  };

  const handleQuantityChange = (val: string) => {
    if (!val) {
      setQuantity("");
      return;
    }
    const num = parseInt(val);
    const maxAvailable = availableVouchers.length;
    
    if (sequenceMode === 'auto') {
      if (num > maxAvailable) {
        setQuantity(maxAvailable.toString());
        toast.info(`Quantity auto-adjusted to max available stock (${maxAvailable}).`);
      } else {
        setQuantity(val);
      }
    } else {
      setQuantity(val); 
    }
  };

  const handleCustomStartChange = (val: string) => {
    setCustomStart(val);
    const idx = availableVouchers.findIndex(v => v.code.toLowerCase() === val.toLowerCase());
    const num = parseInt(quantity) || 0;
    if (idx !== -1 && num > 0 && idx + num <= availableVouchers.length) {
        setCustomEnd(availableVouchers[idx + num - 1].code);
    } else {
        setCustomEnd('');
    }
  }

  const handleCustomEndChange = (val: string) => {
    setCustomEnd(val);
    const idx = availableVouchers.findIndex(v => v.code.toLowerCase() === val.toLowerCase());
    const num = parseInt(quantity) || 0;
    if (idx !== -1 && num > 0 && idx - num + 1 >= 0) {
        setCustomStart(availableVouchers[idx - num + 1].code);
    } else {
        setCustomStart('');
    }
  }

  const { numQuantity, isValidQuantity, startCode, endCode, vouchersToUpdate, sequenceError } = useMemo(() => {
    const num = parseInt(quantity) || 0;
    if (num <= 0) return { numQuantity: num, isValidQuantity: false, startCode: "---", endCode: "---", vouchersToUpdate: [], sequenceError: "Enter a valid quantity." };
    
    if (sequenceMode === 'auto') {
        if (num > availableVouchers.length) return { numQuantity: num, isValidQuantity: false, startCode: "---", endCode: "---", vouchersToUpdate: [], sequenceError: "Quantity exceeds available stock." };
        const toUpdate = availableVouchers.slice(0, num);
        return { numQuantity: num, isValidQuantity: true, startCode: toUpdate[0]?.code, endCode: toUpdate[toUpdate.length - 1]?.code, vouchersToUpdate: toUpdate, sequenceError: "" };
    } else {
        const idx = availableVouchers.findIndex(v => v.code.toLowerCase() === customStart.toLowerCase());
        if (idx === -1) return { numQuantity: num, isValidQuantity: false, startCode: "---", endCode: "---", vouchersToUpdate: [], sequenceError: "Start code not found in available stock." };
        if (idx + num > availableVouchers.length) return { numQuantity: num, isValidQuantity: false, startCode: "---", endCode: "---", vouchersToUpdate: [], sequenceError: "Not enough contiguous stock from this start code." };
        
        const toUpdate = availableVouchers.slice(idx, idx + num);
        return { numQuantity: num, isValidQuantity: true, startCode: toUpdate[0]?.code, endCode: toUpdate[toUpdate.length - 1]?.code, vouchersToUpdate: toUpdate, sequenceError: "" };
    }
  }, [quantity, availableVouchers, sequenceMode, customStart]);

  const handleProcessAllocation = async () => {
    if (!selectedBatch) return toast.error("Select a source batch")
    if (!isValidQuantity) return toast.error(sequenceError || `Please check the quantity and sequence range.`)

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

      setQuantity('')
      setTotalFee('')
      setDistributorId('')
      setSelectedBatch('')
      setDeliveryAgent('')
      setCustomStart('')
      setCustomEnd('')
      setSequenceMode('auto')
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

  const handleCreateDistributor = async () => {
    if (!newDistData.distributor_name.trim()) return toast.error("Distributor name is required");
    setIsSubmittingDist(true);
    try {
      const { data, error } = await supabase.from('voucher_distributors').insert({
        company_id: appUser?.company_id,
        ...newDistData
      }).select().single();
      
      if (error) throw error;
      
      toast.success("Distributor added successfully!");
      setDistributors(prev => [...prev, data].sort((a,b) => a.distributor_name.localeCompare(b.distributor_name)));
      setDistributorId(data.id);
      setIsNewDistModalOpen(false);
      setNewDistData({ distributor_name: '', contact_person: '', phone: '', address: '', distributor_type: 'external_shop' });
    } catch (e: any) {
      toast.error(e.message || "Failed to create distributor");
    } finally {
      setIsSubmittingDist(false);
    }
  }

  if (isLoading) {
    return <div className="p-8 flex justify-center min-h-screen bg-[#fafafa] items-center"><Loader2 className="w-8 h-8 animate-spin text-zinc-400" /></div>
  }

  return (
    <div className="flex flex-col min-h-screen bg-[#fafafa] font-sans">
      
      {/* HEADER */}
      <header className="sticky top-0 z-40 w-full bg-white/80 backdrop-blur-md border-b border-zinc-200 px-4 h-12 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3 overflow-hidden">
          <Link href="/vouchers">
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-md hover:bg-zinc-100 transition-colors">
              <ArrowLeft className="h-4 w-4 text-zinc-500" />
            </Button>
          </Link>
          
          <Separator orientation="vertical" className="h-4 hidden sm:block" />
          
          <nav className="hidden sm:flex items-center gap-1.5 text-[13px] whitespace-nowrap overflow-hidden">
            <Link href="/vouchers" className="text-zinc-500 hover:text-zinc-900 transition-colors font-medium">Vouchers</Link>
            <ChevronRight className="h-3.5 w-3.5 text-zinc-400" />
            <span className="font-semibold text-zinc-900 select-none">Distribution Allocation</span>
          </nav>
          
          <span className="sm:hidden font-semibold text-zinc-900 text-sm">Distribute Vouchers</span>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="h-8 px-2 text-xs font-medium text-zinc-500 hover:text-zinc-900" onClick={fetchData}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
        </div>
      </header>

      <main className="p-3 sm:p-4 md:p-6 lg:p-6 max-w-[1400px] w-full mx-auto animate-in fade-in duration-500">
        
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-6 items-start">
          
          {/* ============================================== */}
          {/* LEFT: ALLOCATION & SEQUENCE FORM               */}
          {/* ============================================== */}
          <Card className="lg:col-span-5 xl:col-span-4 border-zinc-200/60 shadow-sm bg-white lg:sticky lg:top-16 flex flex-col h-auto lg:max-h-[calc(100vh-5rem)] overflow-hidden">
            
            <CardHeader className="bg-zinc-50/50 border-b border-zinc-100 p-4 shrink-0">
              <Tabs value={allocationType} onValueChange={(v: any) => setAllocationType(v)} className="w-full">
                <TabsList className="w-full grid grid-cols-2 bg-zinc-200/50 p-1">
                  <TabsTrigger value="vendor" className="text-xs font-semibold data-[state=active]:bg-white data-[state=active]:shadow-sm">
                    <Store className="w-3.5 h-3.5 mr-1.5" /> Vendor
                  </TabsTrigger>
                  <TabsTrigger value="event" className="text-xs font-semibold data-[state=active]:bg-white data-[state=active]:shadow-sm">
                    <QrCodeIcon className="w-3.5 h-3.5 mr-1.5" /> Event (QR)
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </CardHeader>
            
            <CardContent className="p-4 space-y-4 overflow-y-auto custom-scrollbar flex-1 pb-6">
              
              {allocationType === 'vendor' && (
                <div className="space-y-1.5 animate-in fade-in slide-in-from-top-2">
                  <Label className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">Distributor</Label>
                  <Select value={distributorId} onValueChange={(val) => {
                    if (val === 'ADD_NEW') setIsNewDistModalOpen(true)
                    else setDistributorId(val)
                  }}>
                    <SelectTrigger className="h-10 text-sm bg-zinc-50 border-zinc-200"><SelectValue placeholder="Select partner..." /></SelectTrigger>
                    <SelectContent className="border-zinc-200 max-h-[300px]">
                      {distributors.map(d => (
                        <SelectItem key={d.id} value={d.id}>
                          <div className="flex items-center gap-2 font-medium">
                            <Store className="w-3.5 h-3.5 text-zinc-400" /> {d.distributor_name}
                          </div>
                        </SelectItem>
                      ))}
                      <div className="p-1 mt-1 border-t border-zinc-100">
                        <SelectItem value="ADD_NEW" className="text-indigo-600 font-semibold bg-indigo-50/50 focus:bg-indigo-100 rounded-md cursor-pointer">
                          <span className="flex items-center gap-1.5"><PlusCircle className="w-3.5 h-3.5"/> Add New Distributor</span>
                        </SelectItem>
                      </div>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {allocationType === 'event' && (
                <div className="bg-indigo-50 border border-indigo-100 p-3 rounded-lg flex items-start gap-2.5 animate-in fade-in slide-in-from-top-2">
                  <QrCodeIcon className="w-4 h-4 text-indigo-500 mt-0.5 shrink-0" />
                  <p className="text-[11px] font-medium text-indigo-800 leading-snug">
                    <strong className="block text-xs font-semibold text-indigo-900 mb-0.5">Digital Event Pool</strong>
                    These vouchers will bypass physical delivery and instantly become available for customers to claim themselves via the public QR code.
                  </p>
                </div>
              )}

              <div className="space-y-1.5 pt-1">
                <Label className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">Source Batch</Label>
                <Select value={selectedBatch} onValueChange={setSelectedBatch}>
                  <SelectTrigger className="h-10 text-sm bg-zinc-50 border-zinc-200"><SelectValue placeholder="Choose batch from stock..." /></SelectTrigger>
                  <SelectContent className="border-zinc-200 max-h-[300px]">
                    {batches.length === 0 && <SelectItem value="none" disabled>Insufficient inventory across all batches</SelectItem>}
                    {batches.map(batch => (
                      <SelectItem key={batch.id} value={batch.id} className="text-sm font-medium py-2">
                        <div className="flex justify-between items-center w-full min-w-[300px]">
                          <span className="flex items-center gap-2 font-semibold text-zinc-800">
                            <Package className="w-3.5 h-3.5 text-indigo-500" /> 
                            {batch.batch_no} {batch.prefix && <span className="text-indigo-400">({batch.prefix})</span>}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-semibold text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-100 hidden sm:inline-block">
                               ₹{batch.discount_value} Val / ₹{batch.handling_fee} Fee
                            </span>
                            <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">
                              {batch.available_stock} Avail.
                            </span>
                          </div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3 pt-3 border-t border-zinc-100">
                <div className="flex items-center justify-between">
                  <Label className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider flex items-center gap-1.5">
                    <ListOrdered className="w-3.5 h-3.5" /> Issue Quantity
                  </Label>
                  {isLoadingVouchers && <Loader2 className="h-3.5 w-3.5 animate-spin text-zinc-400" />}
                </div>
                
                <div className="relative">
                  <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                  <Input
                    type="number"
                    min="1"
                    max={availableVouchers.length || 1}
                    placeholder={selectedBatch ? `Max: ${availableVouchers.length}` : "Select batch first"}
                    value={quantity}
                    onChange={(e) => handleQuantityChange(e.target.value)}
                    className="h-10 pl-9 text-sm font-semibold bg-white border-zinc-200 focus-visible:ring-indigo-500"
                    disabled={!selectedBatch || isLoadingVouchers}
                  />
                </div>

                <div className="bg-zinc-50 p-3 rounded border border-zinc-200">
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-[9px] font-semibold text-zinc-500 uppercase tracking-wider">Generated Sequence</Label>
                    
                    <div className="flex items-center bg-zinc-200/50 p-0.5 rounded border border-zinc-200">
                      <button 
                        className={`text-[9px] font-semibold px-2 py-0.5 rounded-sm uppercase tracking-wider transition-all ${sequenceMode === 'auto' ? 'bg-white text-indigo-600 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'}`}
                        onClick={() => { setSequenceMode('auto'); setCustomStart(''); setCustomEnd(''); }}
                      >
                        Auto
                      </button>
                      <button 
                        className={`text-[9px] font-semibold px-2 py-0.5 rounded-sm uppercase tracking-wider transition-all ${sequenceMode === 'custom' ? 'bg-white text-indigo-600 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'}`}
                        onClick={() => { setSequenceMode('custom'); setCustomStart(startCode !== '---' ? startCode : ''); setCustomEnd(endCode !== '---' ? endCode : ''); }}
                        disabled={!selectedBatch || availableVouchers.length === 0}
                      >
                        Custom Range
                      </button>
                    </div>
                  </div>
                  
                  {sequenceMode === 'auto' ? (
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-9 bg-white border border-zinc-200 rounded flex items-center justify-center font-mono text-xs font-medium text-zinc-800 shadow-sm">
                        {startCode}
                      </div>
                      <span className="text-zinc-400 text-xs font-medium">to</span>
                      <div className="flex-1 h-9 bg-white border border-zinc-200 rounded flex items-center justify-center font-mono text-xs font-medium text-zinc-800 shadow-sm">
                        {endCode}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Input 
                        placeholder="Start Code" 
                        value={customStart} 
                        onChange={(e) => handleCustomStartChange(e.target.value)}
                        className={`flex-1 h-9 font-mono text-xs font-medium shadow-sm uppercase ${sequenceError && !isValidQuantity ? 'border-red-300 bg-red-50 text-red-900 focus-visible:ring-red-400' : 'bg-white border-indigo-200 focus-visible:ring-indigo-500'}`}
                      />
                      <span className="text-zinc-400 text-xs font-medium">to</span>
                      <Input 
                        placeholder="End Code" 
                        value={customEnd} 
                        onChange={(e) => handleCustomEndChange(e.target.value)}
                        className={`flex-1 h-9 font-mono text-xs font-medium shadow-sm uppercase ${sequenceError && !isValidQuantity ? 'border-red-300 bg-red-50 text-red-900 focus-visible:ring-red-400' : 'bg-white border-indigo-200 focus-visible:ring-indigo-500'}`}
                      />
                    </div>
                  )}
                  
                  {sequenceError && sequenceMode === 'custom' && (
                    <p className="text-[10px] text-red-500 font-semibold uppercase tracking-wider mt-2">{sequenceError}</p>
                  )}

                  {isValidQuantity && allocationType === 'event' && (
                    <p className="text-[10px] text-emerald-600 mt-2 font-semibold uppercase tracking-wider text-center pt-1 border-t border-zinc-200">
                      Auto-Prefix URL: /event/{startCode.replace(/[0-9]/g, '') || startCode.substring(0, 1)}
                    </p>
                  )}
                </div>
              </div>

              <div className={`grid grid-cols-1 gap-4 pt-3 border-t border-zinc-100 ${allocationType === 'vendor' ? 'sm:grid-cols-2' : ''}`}>
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider flex items-center gap-1.5">
                    <CalendarDays className="w-3.5 h-3.5" /> Validity
                  </Label>
                  <Select value={validityMonths} onValueChange={setValidityMonths}>
                    <SelectTrigger className="h-10 text-sm bg-zinc-50 border-zinc-200"><SelectValue /></SelectTrigger>
                    <SelectContent className="border-zinc-200">
                      <SelectItem value="1">1 Month</SelectItem>
                      <SelectItem value="2">2 Months</SelectItem>
                      <SelectItem value="3">3 Months</SelectItem>
                      <SelectItem value="6">6 Months</SelectItem>
                      <SelectItem value="custom">Custom Date...</SelectItem>
                    </SelectContent>
                  </Select>
                  {validityMonths === 'custom' && (
                    <Input type="date" value={customExpiry} onChange={e => setCustomExpiry(e.target.value)} className="h-10 mt-2 bg-white border-zinc-200 text-sm font-mono" />
                  )}
                </div>

                {allocationType === 'vendor' && (
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider flex items-center gap-1.5">
                      <IndianRupee className="w-3.5 h-3.5" /> Handover Fee
                    </Label>
                    <Input 
                      type="number" placeholder="Total (₹)" 
                      value={totalFee} onChange={e => setTotalFee(e.target.value)}
                      className="h-10 text-sm font-semibold text-zinc-900 bg-white border-zinc-200"
                    />
                  </div>
                )}
              </div>

              {allocationType === 'vendor' && (
                <div className="space-y-1.5 pt-3 border-t border-zinc-100">
                  <Label className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider flex items-center gap-1.5">
                    <Truck className="w-3.5 h-3.5" /> Delivery Agent / Courier
                  </Label>
                  <Select value={deliveryAgent} onValueChange={setDeliveryAgent}>
                    <SelectTrigger className="h-10 text-sm bg-white border-zinc-200">
                      <SelectValue placeholder="Assign delivery personnel (Optional)" />
                    </SelectTrigger>
                    <SelectContent className="border-zinc-200 max-h-[300px]">
                      <SelectItem value="none" className="text-zinc-500 italic">Self Pickup / No Agent</SelectItem>
                      {agents.map(a => (
                        <SelectItem key={a.id} value={a.name}>
                          <div className="flex items-center gap-2 font-medium text-zinc-900">
                            <User className="w-3.5 h-3.5 text-zinc-400" /> 
                            {a.name} <span className="text-[10px] text-zinc-400 font-normal">{a.agency_details ? `(${a.agency_details})` : ''}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-1.5 pt-3 border-t border-zinc-100 flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-[11px] font-semibold text-zinc-700 uppercase tracking-wider flex items-center gap-1.5 cursor-pointer" htmlFor="birthday-toggle">
                    <Gift className="w-4 h-4 text-pink-500" /> Birthday Month Rule
                  </Label>
                  <p className="text-[10px] text-zinc-500 leading-tight pr-4">
                    If enabled, these vouchers can ONLY be redeemed during the customer's registered birth month.
                  </p>
                </div>
                <input 
                  id="birthday-toggle"
                  type="checkbox" 
                  className="w-5 h-5 rounded border-zinc-300 text-pink-600 focus:ring-pink-500 cursor-pointer shrink-0"
                  checked={isBirthdayRedemption}
                  onChange={(e) => setIsBirthdayRedemption(e.target.checked)}
                />
              </div>

            </CardContent>

            <div className="p-4 border-t border-zinc-100 bg-white shrink-0">
              <Button 
                className={`w-full h-11 font-semibold uppercase tracking-wider text-xs shadow-sm text-white transition-all shrink-0 ${allocationType === 'vendor' ? 'bg-zinc-900 hover:bg-zinc-800' : 'bg-indigo-600 hover:bg-indigo-700'}`}
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
          <Card className="lg:col-span-7 xl:col-span-8 border-zinc-200/60 shadow-sm bg-white overflow-hidden flex flex-col min-h-[500px] lg:h-[calc(100vh-5rem)]">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full flex-1 flex flex-col overflow-hidden">
              <CardHeader className="bg-zinc-50/80 border-b border-zinc-100 pb-0 pt-4 px-4 shrink-0">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-2">
                  <TabsList className="bg-transparent border-none p-0 h-auto gap-6 flex justify-start overflow-x-auto custom-scrollbar">
                    <TabsTrigger value="pending" className="data-[state=active]:border-b-2 data-[state=active]:border-amber-500 rounded-none px-1 py-2 text-xs font-semibold uppercase tracking-wider text-zinc-400 data-[state=active]:text-amber-700 shadow-none transition-all whitespace-nowrap">
                      Pending Payment ({challans.filter(c => c.payment_status === 'pending').length})
                    </TabsTrigger>
                    <TabsTrigger value="paid" className="data-[state=active]:border-b-2 data-[state=active]:border-emerald-500 rounded-none px-1 py-2 text-xs font-semibold uppercase tracking-wider text-zinc-400 data-[state=active]:text-emerald-700 shadow-none transition-all whitespace-nowrap">
                      Completed / Paid ({challans.filter(c => c.payment_status === 'paid').length})
                    </TabsTrigger>
                  </TabsList>
                  
                  {/* ✨ DATE FILTERS & EXPORT ROW */}
                  {/* ✨ DATE FILTERS & EXPORT ROW */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pb-3 mt-3 sm:mt-0 w-full sm:w-auto">
                    
                    {/* Unified Date Range Picker */}
                    <div className="flex items-center w-full sm:w-auto bg-white border border-zinc-200 rounded-lg shadow-sm overflow-hidden focus-within:ring-1 focus-within:ring-indigo-500 focus-within:border-indigo-500 transition-all">
                      <div className="flex items-center justify-center px-3 bg-zinc-50 border-r border-zinc-200 h-9 shrink-0">
                        <Calendar className="w-4 h-4 text-zinc-500" />
                      </div>
                      
                      <div className="flex items-center flex-1 sm:flex-none h-9 bg-white">
                        <input 
                          type="date" 
                          value={dateFrom} 
                          onChange={(e) => setDateFrom(e.target.value)} 
                          className="h-full w-full sm:w-[125px] text-xs font-medium border-none shadow-none focus:ring-0 px-2.5 bg-transparent text-zinc-700 outline-none cursor-pointer uppercase tracking-wide [color-scheme:light] [&::-webkit-calendar-picker-indicator]:opacity-40 [&::-webkit-calendar-picker-indicator]:hover:opacity-80"
                          title="Start Date"
                        />
                        <div className="h-4 w-px bg-zinc-200 shrink-0" />
                        <input 
                          type="date" 
                          value={dateTo} 
                          onChange={(e) => setDateTo(e.target.value)} 
                          className="h-full w-full sm:w-[125px] text-xs font-medium border-none shadow-none focus:ring-0 px-2.5 bg-transparent text-zinc-700 outline-none cursor-pointer uppercase tracking-wide [color-scheme:light] [&::-webkit-calendar-picker-indicator]:opacity-40 [&::-webkit-calendar-picker-indicator]:hover:opacity-80"
                          title="End Date"
                        />
                      </div>

                      {/* Clear Button - Only shows when a date is selected */}
                      {(dateFrom || dateTo) && (
                        <button 
                          onClick={() => { setDateFrom(''); setDateTo(''); }}
                          className="h-9 px-2.5 flex items-center justify-center border-l border-zinc-200 hover:bg-red-50 hover:text-red-600 transition-colors text-zinc-400 shrink-0"
                          title="Clear dates"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {/* Export Buttons */}
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <Button variant="outline" size="sm" onClick={exportToCSV} className="flex-1 sm:flex-none h-9 px-3 text-xs font-medium shadow-sm border-zinc-200 text-zinc-600 hover:text-zinc-900 bg-white hover:bg-zinc-50">
                        <Download className="w-3.5 h-3.5 mr-1.5" /> CSV
                      </Button>
                      <Button disabled={isPreparingPrint} variant="outline" size="sm" onClick={handlePrepareAndPrint} className="flex-1 sm:flex-none h-9 px-3 text-xs font-medium shadow-sm border-zinc-200 text-zinc-600 hover:text-zinc-900 bg-white hover:bg-zinc-50">
    {isPreparingPrint ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Printer className="w-3.5 h-3.5 mr-1.5" />}
    PDF / Print
  </Button>
                    </div>
                  </div>
                  </div>
              </CardHeader>

              <CardContent className="p-0 flex-1 overflow-hidden relative">
                
                {/* PENDING TAB */}
                <TabsContent value="pending" className="m-0 h-full absolute inset-0 overflow-y-auto custom-scrollbar">
                  <div ref={activeTab === 'pending' ? tablePrintRef : null} className="w-full">
                    {/* Print Header (Visible only when printing) */}
                    <div className="hidden print:block p-8 pb-4">
                      <h2 className="text-xl font-bold text-zinc-900">Pending Distribution Challans</h2>
                      <p className="text-sm text-zinc-500">Printed on {format(new Date(), 'dd MMM yyyy')}</p>
                    </div>
                    <Table>
                      <TableHeader className="bg-zinc-50/80 sticky top-0 backdrop-blur-sm z-10 border-b border-zinc-200">
                        <TableRow className="hover:bg-transparent border-none">
                          <TableHead className="text-[10px] uppercase font-bold tracking-wider text-zinc-500 h-10 px-4 md:px-6 whitespace-nowrap">Date</TableHead>
                          <TableHead className="text-[10px] uppercase font-bold tracking-wider text-zinc-500 h-10 whitespace-nowrap">Distributor</TableHead>
                          <TableHead className="text-[10px] uppercase font-bold tracking-wider text-zinc-500 h-10 text-center whitespace-nowrap">Qty</TableHead>
                          <TableHead className="text-[10px] uppercase font-bold tracking-wider text-zinc-500 h-10 text-right whitespace-nowrap">Fee Due</TableHead>
                          <TableHead className="text-[10px] uppercase font-bold tracking-wider text-zinc-500 h-10 text-right pr-4 md:pr-6 whitespace-nowrap print:hidden">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredChallans.map(c => (
                          <TableRow key={c.id} className="hover:bg-zinc-50/50 transition-colors border-b border-zinc-100">
                            <TableCell className="text-xs font-medium text-zinc-600 px-4 md:px-6 py-4 whitespace-nowrap">{format(new Date(c.created_at), 'dd MMM yy')}</TableCell>
                            <TableCell className="py-4 min-w-[120px]">
                              <span className="font-semibold text-xs text-zinc-900 block">{c.voucher_distributors?.distributor_name}</span>
                              {c.is_birthday_redemption && <span className="text-[9px] font-semibold text-pink-600 uppercase tracking-wider block mt-0.5">Birthday Rule</span>}
                            </TableCell>
                            <TableCell className="text-center font-medium text-xs py-4">{c.quantity}</TableCell>
                            <TableCell className="text-right font-semibold text-sm text-amber-600 py-4 whitespace-nowrap">₹{c.total_amount.toLocaleString()}</TableCell>
                            <TableCell className="text-right pr-4 md:pr-6 py-4 print:hidden">
                              <div className="flex justify-end gap-2">
                                <Button size="icon" variant="ghost" onClick={() => handleViewChallan(c)} className="h-8 w-8 text-zinc-400 hover:text-indigo-600 hover:bg-indigo-50" title="View Details">
                                  <Eye className="w-4 h-4" />
                                </Button>
                                <Button size="sm" onClick={() => handleMarkPaid(c.id)} className="h-8 px-3 text-[10px] font-semibold uppercase tracking-wider bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200 shadow-sm transition-colors whitespace-nowrap">
                                  Mark Paid
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                        {filteredChallans.length === 0 && (
                          <TableRow><TableCell colSpan={6} className="text-center py-20 text-zinc-400 text-xs font-medium italic">No pending challans found.</TableCell></TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </TabsContent>

                {/* PAID TAB */}
                <TabsContent value="paid" className="m-0 h-full absolute inset-0 overflow-y-auto custom-scrollbar">
                  <div ref={activeTab === 'paid' ? tablePrintRef : null} className="w-full">
                    {/* Print Header (Visible only when printing) */}
                    <div className="hidden print:block p-8 pb-4">
                      <h2 className="text-xl font-bold text-zinc-900">Completed Distribution Challans</h2>
                      <p className="text-sm text-zinc-500">Printed on {format(new Date(), 'dd MMM yyyy')}</p>
                    </div>
                    <Table>
                      <TableHeader className="bg-zinc-50/80 sticky top-0 backdrop-blur-sm z-10 border-b border-zinc-200">
                        <TableRow className="hover:bg-transparent border-none">
                          <TableHead className="text-[10px] uppercase font-bold tracking-wider text-zinc-500 h-10 px-4 md:px-6 whitespace-nowrap">Paid On</TableHead>
                          <TableHead className="text-[10px] uppercase font-bold tracking-wider text-zinc-500 h-10 whitespace-nowrap">Distributor</TableHead>
                          <TableHead className="text-[10px] uppercase font-bold tracking-wider text-zinc-500 h-10 text-center whitespace-nowrap">Qty</TableHead>
                          <TableHead className="text-[10px] uppercase font-bold tracking-wider text-zinc-500 h-10 text-right pr-4 md:pr-6 whitespace-nowrap">Fee & Details</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredChallans.map(c => (
                          <TableRow key={c.id} className="hover:bg-zinc-50/50 transition-colors border-b border-zinc-100">
                            <TableCell className="text-xs font-medium text-zinc-600 px-4 md:px-6 py-4 whitespace-nowrap">{c.payment_received_at ? format(new Date(c.payment_received_at), 'dd MMM yy') : '---'}</TableCell>
                            <TableCell className="py-4 min-w-[120px]">
                              <span className="font-semibold text-xs text-zinc-900 block">{c.voucher_distributors?.distributor_name}</span>
                              {c.is_birthday_redemption && <span className="text-[9px] font-semibold text-pink-600 uppercase tracking-wider block mt-0.5">Birthday Rule</span>}
                            </TableCell>
                            <TableCell className="text-center font-medium text-xs py-4">{c.quantity}</TableCell>
                            <TableCell className="text-right pr-4 md:pr-6 py-4">
                              <div className="flex items-center justify-end gap-3">
                                <span className="font-semibold text-sm text-emerald-600 flex items-center gap-1.5">
                                  <CheckCircle2 className="w-3.5 h-3.5" /> ₹{c.total_amount.toLocaleString()}
                                </span>
                                <Button size="icon" variant="ghost" onClick={() => handleViewChallan(c)} className="h-8 w-8 text-zinc-400 hover:text-indigo-600 hover:bg-indigo-50 border border-zinc-200 bg-white shadow-sm print:hidden" title="View Details">
                                  <Eye className="w-4 h-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                        {filteredChallans.length === 0 && (
                          <TableRow><TableCell colSpan={4} className="text-center py-20 text-zinc-400 text-xs font-medium italic">No completed distributions found.</TableCell></TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </TabsContent>

              </CardContent>
            </Tabs>
          </Card>
        </div>
      </main>

      {/* --- ADD NEW DISTRIBUTOR MODAL --- */}
      <Dialog open={isNewDistModalOpen} onOpenChange={setIsNewDistModalOpen}>
        <DialogContent className="sm:max-w-[425px] p-0 border-none shadow-2xl rounded-2xl bg-white overflow-hidden">
          <DialogHeader className="bg-zinc-50 p-6 border-b border-zinc-100">
            <DialogTitle className="text-lg font-bold text-zinc-900 flex items-center gap-2">
              <Store className="w-5 h-5 text-indigo-600" /> Add New Distributor
            </DialogTitle>
            <DialogDescription className="text-xs font-medium text-zinc-500 mt-1">
              Register a new partner or internal branch for allocations.
            </DialogDescription>
          </DialogHeader>

          <div className="p-6 space-y-4">
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Business/Distributor Name *</Label>
              <Input 
                className="h-10 text-sm font-semibold border-zinc-200 rounded-xl"
                value={newDistData.distributor_name}
                onChange={e => setNewDistData({...newDistData, distributor_name: e.target.value})}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Contact Person</Label>
                <Input 
                  className="h-10 text-sm border-zinc-200 rounded-xl"
                  value={newDistData.contact_person}
                  onChange={e => setNewDistData({...newDistData, contact_person: e.target.value})}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Phone</Label>
                <Input 
                  type="tel"
                  className="h-10 text-sm border-zinc-200 rounded-xl"
                  value={newDistData.phone}
                  onChange={e => setNewDistData({...newDistData, phone: e.target.value})}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Address</Label>
              <Input 
                className="h-10 text-sm border-zinc-200 rounded-xl"
                value={newDistData.address}
                onChange={e => setNewDistData({...newDistData, address: e.target.value})}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Distributor Type</Label>
              <Select value={newDistData.distributor_type} onValueChange={v => setNewDistData({...newDistData, distributor_type: v})}>
                <SelectTrigger className="h-10 text-sm border-zinc-200 rounded-xl bg-white"><SelectValue/></SelectTrigger>
                <SelectContent className="rounded-xl border-zinc-200">
                  <SelectItem value="external_shop">External Shop</SelectItem>
                  <SelectItem value="corporate_partner">Corporate Partner</SelectItem>
                  <SelectItem value="internal_branch">Internal Branch</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="bg-zinc-50 p-4 border-t border-zinc-100">
            <Button variant="outline" className="h-11 rounded-xl text-xs font-bold uppercase tracking-widest text-zinc-500 hover:bg-zinc-100" onClick={() => setIsNewDistModalOpen(false)}>Cancel</Button>
            <Button className="h-11 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs uppercase tracking-widest" onClick={handleCreateDistributor} disabled={isSubmittingDist}>
              {isSubmittingDist ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />} Save Distributor
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
            <div className="bg-white p-4 rounded-xl border border-zinc-200 shadow-sm mb-4">
              <QRCode id="event-qr-code" value={eventQrData?.url || ''} size={180} level="Q" />
            </div>
            
            <div className="w-full bg-zinc-50 border border-zinc-200 rounded-lg p-3 mb-6">
              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1 text-left">Claim URL</p>
              <p className="text-xs font-mono text-indigo-600 text-left truncate select-all">
                {eventQrData?.url}
              </p>
            </div>
            
            <div className="w-full flex gap-3">
              <Button variant="outline" className="flex-1 border-zinc-200" onClick={() => setEventQrData(null)}>Close</Button>
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
          <DialogHeader className="bg-zinc-50 p-6 border-b border-zinc-200">
            <DialogTitle className="text-lg font-bold text-zinc-900 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-600" />
                Delivery Challan
              </span>
              <Button size="sm" variant="outline" className="h-8 px-3 text-[10px] font-bold uppercase tracking-widest text-indigo-700 bg-indigo-50 border-indigo-200 hover:bg-indigo-100" onClick={handlePrintChallan}>
                <Printer className="w-3.5 h-3.5 mr-1.5" /> Print
              </Button>
            </DialogTitle>
            <DialogDescription className="text-xs font-medium text-zinc-500 mt-1">
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

              <div className="flex justify-between items-center py-2 border-b border-dashed border-zinc-200">
                <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Distributor</span>
                <span className="font-semibold text-sm text-zinc-900">{viewChallan.voucher_distributors?.distributor_name}</span>
              </div>
              
              <div className="flex justify-between items-center py-2 border-b border-dashed border-zinc-200">
                <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Quantity</span>
                <span className="font-bold text-sm text-zinc-900">{viewChallan.quantity} Vouchers</span>
              </div>

              <div className="flex justify-between items-center py-2 border-b border-dashed border-zinc-200">
                <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Expiry Date</span>
                <span className="font-semibold text-sm text-zinc-900">{format(new Date(viewChallan.expiry_date), 'dd MMM yyyy')}</span>
              </div>

              <div className="flex justify-between items-center py-2 border-b border-dashed border-zinc-200">
                <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider flex items-center gap-1.5"><User className="w-3.5 h-3.5"/> Agent</span>
                <span className="font-semibold text-sm text-zinc-900">{viewChallan.delivery_agent || 'Self Pickup'}</span>
              </div>

              <div className="bg-zinc-50 p-3 rounded border border-zinc-200 mt-4">
                <Label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider block mb-2">Attached Sequence</Label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-9 bg-white border border-zinc-200 rounded flex items-center justify-center font-mono text-sm font-medium text-zinc-800 shadow-sm">
                    {isLoadingSequence ? <Loader2 className="w-4 h-4 animate-spin text-zinc-400" /> : viewSequence?.start}
                  </div>
                  <span className="text-zinc-400 text-xs font-medium">to</span>
                  <div className="flex-1 h-9 bg-white border border-zinc-200 rounded flex items-center justify-center font-mono text-sm font-medium text-zinc-800 shadow-sm">
                    {isLoadingSequence ? <Loader2 className="w-4 h-4 animate-spin text-zinc-400" /> : viewSequence?.end}
                  </div>
                </div>
              </div>

            </div>
          )}
          <DialogFooter className="bg-zinc-50 p-4 border-t border-zinc-200">
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
                  <h1 className="text-3xl font-black uppercase tracking-widest text-zinc-900">{companyData.trade_name || companyData.legal_name || "COMPANY NAME"}</h1>
                  <p className="text-sm font-medium text-zinc-600 mt-1 max-w-sm">{companyData.address_line1 || "Head Office / Central Dispatch"}</p>
                  <p className="text-sm font-bold text-zinc-600 mt-1">GSTIN: {companyData.gstin || "NOT PROVIDED"}</p>
                </div>
                <div className="text-right">
                  <h2 className="text-2xl font-bold uppercase tracking-widest text-zinc-400 mb-2">Delivery Challan</h2>
                  <p className="text-sm font-bold"><span className="text-zinc-500 mr-2">CHALLAN NO:</span> {viewChallan.id.slice(0, 8).toUpperCase()}</p>
                  <p className="text-sm font-bold"><span className="text-zinc-500 mr-2">DATE:</span> {format(new Date(viewChallan.created_at), 'dd MMM yyyy')}</p>
                </div>
              </div>

              {/* Parties */}
              <div className="grid grid-cols-2 gap-12 mb-10">
                <div>
                  <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2 border-b border-zinc-200 pb-1">Issued To (Distributor)</h3>
                  <p className="text-lg font-bold text-zinc-900">{viewChallan.voucher_distributors?.distributor_name}</p>
                  <p className="text-sm font-medium text-zinc-600 mt-1">{viewChallan.voucher_distributors?.contact_person || ""}</p>
                  <p className="text-sm font-medium text-zinc-600">{viewChallan.voucher_distributors?.phone || "No contact provided"}</p>
                </div>
                <div>
                  <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2 border-b border-zinc-200 pb-1">Delivery Agent</h3>
                  <p className="text-lg font-bold text-zinc-900">{viewChallan.delivery_agent || "Self Pickup"}</p>
                  <p className="text-sm font-medium text-zinc-600 mt-1">Assigned for secure transport.</p>
                </div>
              </div>

              {/* Items Table */}
              <div className="mb-10">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-y-2 border-black">
                      <th className="py-3 px-2 text-left text-xs font-bold uppercase tracking-widest text-zinc-500 w-16">Item</th>
                      <th className="py-3 px-2 text-left text-xs font-bold uppercase tracking-widest text-zinc-500">Description</th>
                      <th className="py-3 px-2 text-center text-xs font-bold uppercase tracking-widest text-zinc-500">Qty</th>
                      <th className="py-3 px-2 text-right text-xs font-bold uppercase tracking-widest text-zinc-500">Handling Fee</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-zinc-200">
                      <td className="py-4 px-2 font-bold text-zinc-900">01</td>
                      <td className="py-4 px-2">
                        <p className="font-bold text-zinc-900 text-lg">Physical Vouchers (Gift/Discount Booklets)</p>
                        <p className="text-sm text-zinc-600 mt-1 font-mono">Sequence: {viewSequence?.start} to {viewSequence?.end}</p>
                        <p className="text-sm text-zinc-600 mt-1">Valid Until: {format(new Date(viewChallan.expiry_date), 'dd MMM yyyy')}</p>
                        {viewChallan.is_birthday_redemption && (
                          <p className="text-xs font-bold text-pink-600 uppercase tracking-widest mt-2 border border-pink-200 bg-pink-50 inline-block px-2 py-1 rounded">
                            Restricted: Birthday Month Redemption Only
                          </p>
                        )}
                      </td>
                      <td className="py-4 px-2 text-center font-black text-xl text-zinc-900">{viewChallan.quantity}</td>
                      <td className="py-4 px-2 text-right font-bold text-lg text-zinc-900">₹{viewChallan.total_amount.toLocaleString()}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Total & Terms */}
              <div className="flex justify-between items-start mb-20">
                <div className="w-2/3 pr-12">
                  <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2">Terms & Conditions</h3>
                  <p className="text-[10px] text-zinc-500 text-justify leading-relaxed">
                    1. The goods/vouchers listed above are securely handed over to the distributor/agent. <br/>
                    2. The distributor agrees to safely handle and distribute these sequence-tracked vouchers. <br/>
                    3. Loss or theft of physical booklets must be immediately reported to HQ to void the sequence. <br/>
                    4. This challan is for internal stock movement tracking and is not a tax invoice for goods sold.
                  </p>
                </div>
                <div className="w-1/3">
                  <div className="flex justify-between items-center py-2 border-b-2 border-black">
                    <span className="font-bold text-zinc-600 uppercase tracking-widest">Total Due:</span>
                    <span className="font-black text-2xl text-zinc-900">₹{viewChallan.total_amount.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 text-xs">
                    <span className="font-bold text-zinc-500 uppercase tracking-widest">Status:</span>
                    <span className="font-bold text-zinc-900 uppercase">{viewChallan.payment_status}</span>
                  </div>
                </div>
              </div>

              {/* Signatures */}
              <div className="grid grid-cols-3 gap-8 mt-auto pt-20 border-t border-zinc-200">
                <div className="text-center">
                  <div className="h-16 border-b border-zinc-300 mb-2"></div>
                  <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">Issuer Signature</p>
                  <p className="text-[10px] text-zinc-400 mt-1">Authorized Store Rep</p>
                </div>
                <div className="text-center">
                  <div className="h-16 border-b border-zinc-300 mb-2"></div>
                  <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">Agent Signature</p>
                  <p className="text-[10px] text-zinc-400 mt-1">{viewChallan.delivery_agent || 'N/A'}</p>
                </div>
                <div className="text-center">
                  <div className="h-16 border-b border-zinc-300 mb-2"></div>
                  <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">Receiver Signature</p>
                  <p className="text-[10px] text-zinc-400 mt-1">Distributor Stamp / Sign</p>
                </div>
              </div>
            </>
          )}
        </div>
        {/* --- HIDDEN PRINT TEMPLATE FOR FULL MASTER REPORT --- */}
      <div className="hidden">
        <div ref={tablePrintRef} className="bg-white text-black p-8 font-sans" style={{ width: '297mm', minHeight: '210mm', margin: 0, padding: '40px' }}>
          
          {/* Header */}
          <div className="flex justify-between items-end border-b-2 border-black pb-4 mb-6">
            <div>
              <h1 className="text-2xl font-black uppercase tracking-widest text-zinc-900">{companyData?.trade_name || companyData?.legal_name || "COMPANY NAME"}</h1>
              <h2 className="text-lg font-bold text-zinc-600 mt-1 uppercase">Distribution Report - {activeTab}</h2>
            </div>
            <div className="text-right text-xs font-semibold text-zinc-500 space-y-1">
              <p>Date Range: <span className="text-zinc-900">{dateFrom ? format(new Date(dateFrom), 'dd MMM yyyy') : 'Start'} to {dateTo ? format(new Date(dateTo), 'dd MMM yyyy') : 'Present'}</span></p>
              <p>Printed On: <span className="text-zinc-900">{format(new Date(), 'dd MMM yyyy, hh:mm a')}</span></p>
            </div>
          </div>
          
          {/* Data Table */}
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="border-y-2 border-black text-left">
                <th className="py-3 px-2 font-bold uppercase tracking-wider text-zinc-500 w-[10%]">Date</th>
                <th className="py-3 px-2 font-bold uppercase tracking-wider text-zinc-500 w-[20%]">Distributor</th>
                <th className="py-3 px-2 font-bold uppercase tracking-wider text-zinc-500 w-[15%]">Agent / Delivery</th>
                <th className="py-3 px-2 text-center font-bold uppercase tracking-wider text-zinc-500 w-[5%]">Qty</th>
                <th className="py-3 px-2 font-bold uppercase tracking-wider text-zinc-500 w-[10%]">Expiry</th>
                <th className="py-3 px-2 font-bold uppercase tracking-wider text-zinc-500 w-[20%]">Sequence Range</th>
                <th className="py-3 px-2 text-right font-bold uppercase tracking-wider text-zinc-500 w-[10%]">Fee (₹)</th>
                <th className="py-3 px-2 text-center font-bold uppercase tracking-wider text-zinc-500 w-[10%]">Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredChallans.map(c => (
                <tr key={c.id} className="border-b border-zinc-200">
                  <td className="py-3 px-2 text-zinc-700 font-medium">{format(new Date(c.created_at), 'dd-MM-yy')}</td>
                  <td className="py-3 px-2 font-bold text-zinc-900">{c.voucher_distributors?.distributor_name}</td>
                  <td className="py-3 px-2 text-zinc-700">{c.delivery_agent || 'Self Pickup'}</td>
                  <td className="py-3 px-2 text-center font-bold text-zinc-900">{c.quantity}</td>
                  <td className="py-3 px-2 text-zinc-700">{c.expiry_date ? format(new Date(c.expiry_date), 'dd-MM-yy') : 'N/A'}</td>
                  <td className="py-3 px-2 font-mono text-[10px] text-zinc-600 bg-zinc-50">
                    {reportSequences[c.id]?.start} <span className="text-zinc-400 mx-1">to</span> {reportSequences[c.id]?.end}
                  </td>
                  <td className="py-3 px-2 text-right font-bold text-zinc-900">₹{c.total_amount.toLocaleString()}</td>
                  <td className="py-3 px-2 text-center text-[10px] font-bold uppercase tracking-wider text-zinc-500">{c.payment_status}</td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {/* Footer Branding */}
          <div className="mt-8 pt-4 border-t border-zinc-200 text-center flex items-center justify-center gap-2">
            <div className="h-4 w-4 bg-zinc-900 rounded-sm" /> {/* Tiny dummy logo box for Biillo */}
            <p className="text-[10px] font-bold text-zinc-400 tracking-widest uppercase">Powered By Biillo ERP</p>
          </div>
          
        </div>
      </div>
      </div>

    </div>
  )
}