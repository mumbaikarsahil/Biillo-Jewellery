"use client";

import React, { useEffect, useState, useRef } from "react";
import { format, isToday } from "date-fns";
import { 
  Search, CheckCircle2, XCircle, Hammer, MapPin, Package, 
  ChevronRight, ArrowRight, Loader2, AlertCircle, Store, Zap,
  MessageCircle, Globe, TrendingUp, Clock, PhoneCall, Printer, FileText, Send, Ban, Receipt, Download
} from "lucide-react";

import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { InvoicePrintTemplate } from "@/components/InvoicePrintTemplate";
import { WhatsAppSenderModal } from "@/components/WhatsAppSenderModal";

const DEFAULT_RETURN_ADDRESS = "Viral Apartment, (A) Wing, 3rd Floor, S.V. Road, Opp. Andheri Shoppers Stop,\nAbove Hotel Radha Krishna, Andheri West, Mumbai - 400058";

export default function EcommerceOrdersPage() {
  const { appUser } = useAuth();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState("pending_approval");
  const [orders, setOrders] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Modals & Context States
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [voidModal, setVoidModal] = useState<{isOpen: boolean, order: any, reason: string}>({ isOpen: false, order: null, reason: "" });
  const [waModalConfig, setWaModalConfig] = useState<{isOpen: boolean, phone: string, contextData: any}>({ isOpen: false, phone: '', contextData: {} });
  
  // E-Receipt State
  const [receiptOrder, setReceiptOrder] = useState<any>(null);
  const [isGeneratingReceipt, setIsGeneratingReceipt] = useState(false);

  // Shipping Label State
  const [labelModal, setLabelModal] = useState<{isOpen: boolean, order: any}>({ isOpen: false, order: null });
  const [returnAddress, setReturnAddress] = useState(DEFAULT_RETURN_ADDRESS);
  
// Editable Invoice State
const [invoiceOrder, setInvoiceOrder] = useState<any>(null);
const [invoiceWeights, setInvoiceWeights] = useState<Record<number, {gw: string, dw: string}>>({});

// Print Engine State
const [printMode, setPrintMode] = useState<'label' | 'invoice' | null>(null);
const printContainerRef = useRef<HTMLDivElement>(null); // ✨ ADD THIS LINE
  
  // Routing Engine States
  const [nearestWarehouse, setNearestWarehouse] = useState<any>(null);
  const [matchingStock, setMatchingStock] = useState<any[]>([]);
  const [legacySearch, setLegacySearch] = useState("");
  const [isRoutingLoad, setIsRoutingLoad] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);

  // KPI Metrics
  const [metrics, setMetrics] = useState({ awaiting: 0, fabrication: 0, todaySales: 0 });

  // 1. Initial Script Load for Receipt Generation
  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js";
    script.async = true;
    document.body.appendChild(script);
  }, []);

  const fetchOrders = async () => {
    if (!appUser?.company_id) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("ecommerce_orders")
        .select(`
          *,
          items:ecommerce_order_items(
            quantity,
            total_price,
            product:ecommerce_products(title, sku_reference, legacy_item_no, manufacturing_buffer_days)
          )
        `)
        .eq("company_id", appUser.company_id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      
      const fetchedOrders = data || [];
      setOrders(fetchedOrders);

      const awaiting = fetchedOrders.filter(o => o.status === "pending_approval").length;
      const fabrication = fetchedOrders.filter(o => o.status === "sent_to_manufacturing").length;
      const todaySales = fetchedOrders
        .filter(o => isToday(new Date(o.created_at)) && o.payment_status === 'paid')
        .reduce((sum, o) => sum + (Number(o.total_amount) || Number(o.final_total) || 0), 0);

      setMetrics({ awaiting, fabrication, todaySales });
    } catch (err: any) {
      toast({ title: "Fetch Failed", description: err.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchOrders(); }, [appUser]);

  const filteredOrders = orders.filter((o) => {
    if (activeTab === "pending_approval" && o.status !== "pending_approval") return false;
    if (activeTab === "in_fulfillment" && !["approved_from_stock", "sent_to_manufacturing", "ready_to_ship"].includes(o.status)) return false;
    if (activeTab === "completed" && !["shipped", "delivered", "cancelled", "void"].includes(o.status)) return false;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!o.order_number.toLowerCase().includes(q) && !o.customer_name?.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  // ==========================================
  // VOID / CANCEL ENGINE
  // ==========================================
  const executeVoidOrder = async () => {
    if (!voidModal.reason.trim()) {
      toast({ title: "Reason Required", description: "Please provide a reason for cancellation.", variant: "destructive" });
      return;
    }
    setIsExecuting(true);
    try {
      const { error } = await supabase.from('ecommerce_orders').update({
        status: 'cancelled',
        cancellation_reason: voidModal.reason,
        cancelled_by: appUser?.full_name || appUser?.id,
      }).eq('id', voidModal.order.id);
      
      if (error) throw error;

      toast({ title: "Order Voided", description: `Order ${voidModal.order.order_number} has been safely cancelled.` });
      setVoidModal({ isOpen: false, order: null, reason: "" });
      if (selectedOrder?.id === voidModal.order.id) setSelectedOrder(null);
      fetchOrders();
    } catch (err: any) {
      toast({ title: "Void Failed", description: err.message, variant: "destructive" });
    } finally {
      setIsExecuting(false);
    }
  };

  // ==========================================
  // COMMUNICATION ENGINE
  // ==========================================
  const handleDialerCall = (e: React.MouseEvent, phone: string) => {
    e.stopPropagation();
    if (!phone) return toast({ title: "Error", description: "No phone number.", variant: "destructive" });
    window.location.href = `tel:${phone}`;
  };

  const handleManualWhatsApp = (e: React.MouseEvent, phone: string, orderNo: string, customerName: string) => {
    e.stopPropagation();
    if (!phone) return toast({ title: "Error", description: "No phone number.", variant: "destructive" });
    const finalPhone = phone.replace(/\D/g, '').length === 10 ? `91${phone.replace(/\D/g, '')}` : phone.replace(/\D/g, '');
    const message = encodeURIComponent(`Namaskar ${customerName},\n\nRegarding your Pavitram order *${orderNo}*: We are currently processing your request.`);
    window.open(`https://wa.me/${finalPhone}?text=${message}`, '_blank');
  };

  const handleApiWhatsApp = async (e: React.MouseEvent, order: any) => {
    e.stopPropagation();
    setWaModalConfig({ isOpen: true, phone: order?.customer_phone, contextData: order });
  };

  // ==========================================
  // SHIPPING & INVOICING ENGINE
  // ==========================================
  const handleOpenLabelModal = (e: React.MouseEvent, order: any) => {
    e.stopPropagation();
    setLabelModal({ isOpen: true, order });
  };

  const executeLabelPrint = () => {
    setPrintMode('label');
    setTimeout(() => window.print(), 100);
  };

  const handleViewInvoice = (e: React.MouseEvent, order: any) => {
    e.stopPropagation();
    setInvoiceOrder(order);
    setInvoiceWeights({}); // Reset weights for new invoice
  };

  const executeInvoicePrint = () => {
    setPrintMode('invoice');
    setTimeout(() => window.print(), 100);
  };

  const handleOpenReceiptModal = (e: React.MouseEvent, order: any) => {
    e.stopPropagation();
    setReceiptOrder(order);
  };

  const executeReceiptDownload = () => {
    if (!(window as any).html2pdf) {
      toast({ title: "Please wait", description: "Receipt engine is loading.", variant: "destructive" });
      return;
    }
    setIsGeneratingReceipt(true);
    const element = document.getElementById("pdf-receipt-preview-content");
    
    const opt = {
      margin: 0.5,
      filename: `Receipt_${receiptOrder?.order_number}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, logging: false },
      jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' }
    };

    (window as any).html2pdf().set(opt).from(element).save().then(() => {
      setIsGeneratingReceipt(false);
      toast({ title: "Success!", description: "E-Receipt downloaded successfully." });
    });
  };

  // Maps Ecommerce DB structure to POS InvoiceTemplate structure (with editable weights injected)
  const mappedInvoiceData = invoiceOrder ? {
    mode: 'normal',
    date: invoiceOrder.created_at,
    invoice_number: invoiceOrder.order_number.replace('ORD', 'INV'),
    paymentMode: "Razorpay (Paid Online)",
    customer: {
      full_name: invoiceOrder.customer_name || 'Online Guest',
      phone: invoiceOrder.customer_phone || '-',
      pan_no: 'UNREGISTERED',
      address: `${invoiceOrder.shipping_address?.addressLine1 || ''} ${invoiceOrder.shipping_address?.city || ''}`.trim() || 'Mumbai',
    },
    subtotal: invoiceOrder.subtotal || 0,
    discountAmount: invoiceOrder.discount_amount || 0,
    taxableValue: invoiceOrder.taxable_value || 0,
    cgstAmount: invoiceOrder.cgst_amount || 0,
    sgstAmount: invoiceOrder.sgst_amount || 0,
    handlingFee: invoiceOrder.handling_fee || 0,
    finalTotal: invoiceOrder.total_amount || invoiceOrder.final_total || 0,
    items: invoiceOrder.items?.map((item: any, idx: number) => ({
      mrp: item.total_price, 
      quantity: item.quantity,
      purity_karat: '22K', 
      hsn_code: '7113',
      net_weight_g: invoiceWeights[idx]?.gw || '', // Inject editable gold weight
      total_stone_weight_cts: invoiceWeights[idx]?.dw || '', // Inject editable diamond weight
      ecommerce_products: { title: item.product?.title || 'Jewellery Item' }
    }))
  } : null;

  // ==========================================
  // ROUTING ENGINE (Live Stock & Manufacturing)
  // ==========================================
  const handleOpenRouting = async (order: any) => {
    setSelectedOrder(order);
    setNearestWarehouse(null);
    setMatchingStock([]);
    setIsRoutingLoad(true);

    try {
      const pincode = order.shipping_address?.pincode;
      const targetSku = order.items?.[0]?.product?.sku_reference;

      if (!targetSku) throw new Error("Order item missing SKU reference.");

      if (pincode) {
        const { data: whMapping } = await supabase.from("warehouse_pincode_mapping").select("local_transit_days, warehouse:warehouses(id, name)").eq("company_id", appUser?.company_id).eq("pincode", pincode).maybeSingle();
        if (whMapping) setNearestWarehouse(whMapping);
      }

      const { data: stockData } = await supabase.from("inventory_items").select("id, barcode, gross_weight_g, net_weight_g, warehouse:warehouses(id, name)").eq("company_id", appUser?.company_id).eq("status", "in_stock").eq("sku_reference", targetSku);
      setMatchingStock(stockData || []);
    } catch (err: any) {
      toast({ title: "Routing Alert", description: err.message, variant: "destructive" });
    } finally {
      setIsRoutingLoad(false);
    }
  };

  const executeLegacySearch = async () => {
    if (!legacySearch.trim()) return;
    setIsRoutingLoad(true);
    try {
      const { data, error } = await supabase.from("inventory_items").select("id, barcode, gross_weight_g, net_weight_g, warehouse:warehouses(id, name)").eq("company_id", appUser?.company_id).eq("status", "in_stock").or(`barcode.ilike.%${legacySearch}%,sku.ilike.%${legacySearch}%`);
      if (error) throw error;
      setMatchingStock(data || []);
      toast({ description: `Found ${data?.length || 0} items matching legacy search.` });
    } catch (err: any) {
      toast({ variant: "destructive", description: err.message });
    } finally {
      setIsRoutingLoad(false);
    }
  };

  const fulfillFromStock = async (invId: string, whId: string, days: number) => {
    setIsExecuting(true);
    try {
      const eta = new Date();
      eta.setDate(eta.getDate() + days);

      const { error: invErr } = await supabase.from("inventory_items").update({ status: "reserved" }).eq("id", invId);
      if (invErr) throw invErr;

      const { error: ordErr } = await supabase.from("ecommerce_orders").update({
        status: "approved_from_stock", fulfillment_type: "from_stock", warehouse_id: whId, linked_inventory_item_id: invId, expected_delivery_date: eta.toISOString().split("T")[0]
      }).eq("id", selectedOrder.id);
      if (ordErr) throw ordErr;

      toast({ title: "Order Routed!", description: "Item reserved from physical stock." });
      setSelectedOrder(null);
      fetchOrders();
    } catch (err: any) {
      toast({ title: "Execution Failed", description: err.message, variant: "destructive" });
    } finally {
      setIsExecuting(false);
    }
  };

  const routeToManufacturing = async () => {
    setIsExecuting(true);
    try {
      const product = selectedOrder.items?.[0]?.product;
      const bufferDays = product?.manufacturing_buffer_days || 14;
      const eta = new Date();
      eta.setDate(eta.getDate() + bufferDays + 2); 

      const { data: coData, error: coErr } = await supabase.from("custom_orders").insert({
        company_id: appUser?.company_id, origin_warehouse_id: nearestWarehouse?.warehouse?.id || appUser?.warehouse_id, 
        customer_name: selectedOrder.customer_name, customer_phone: selectedOrder.customer_phone,
        order_number: `CUST-WEB-${selectedOrder.order_number}`, design_reference: product?.sku_reference || 'CUSTOM-WEB',
        status: "pending_manufacturing", base_estimated_value: selectedOrder.total_amount || selectedOrder.final_total, advance_paid: selectedOrder.total_amount || selectedOrder.final_total 
      }).select().single();
      if (coErr) throw coErr;

      const { error: ordErr } = await supabase.from("ecommerce_orders").update({
        status: "sent_to_manufacturing", fulfillment_type: "made_to_order", linked_custom_order_id: coData.id, expected_delivery_date: eta.toISOString().split("T")[0]
      }).eq("id", selectedOrder.id);
      if (ordErr) throw ordErr;

      toast({ title: "Routed to Workshop", description: `Added to Custom Orders queue. ETA: ${bufferDays} days.` });
      setSelectedOrder(null);
      fetchOrders();
    } catch (err: any) {
      toast({ title: "Execution Failed", description: err.message, variant: "destructive" });
    } finally {
      setIsExecuting(false);
    }
  };

  const getStatusBadge = (status: string | undefined | null) => {
    if (!status) return <Badge className="bg-gray-100 text-gray-700 border-none uppercase tracking-widest text-[9px] font-bold shadow-none">Unknown</Badge>;
    switch (status) {
      case "pending_approval": return <Badge className="bg-amber-100 text-amber-700 border-none uppercase tracking-widest text-[9px] font-bold shadow-none">Awaiting Route</Badge>;
      case "approved_from_stock": return <Badge className="bg-blue-100 text-blue-700 border-none uppercase tracking-widest text-[9px] font-bold shadow-none">Picking List</Badge>;
      case "sent_to_manufacturing": return <Badge className="bg-purple-100 text-purple-700 border-none uppercase tracking-widest text-[9px] font-bold shadow-none">In Fabrication</Badge>;
      case "ready_to_ship": return <Badge className="bg-emerald-100 text-emerald-700 border-none uppercase tracking-widest text-[9px] font-bold shadow-none">Ready to Ship</Badge>;
      case "cancelled": return <Badge className="bg-red-100 text-red-700 border-none uppercase tracking-widest text-[9px] font-bold shadow-none">Voided</Badge>;
      default: return <Badge className="bg-gray-100 text-gray-700 border-none uppercase tracking-widest text-[9px] font-bold shadow-none">{status.replace(/_/g, ' ')}</Badge>;
    }
  };

  return (
    <>
      {/* 🚀 DYNAMIC PRINT CSS ENGINE */}
      <style type="text/css" media="print">
        {`
          @page {
            size: ${printMode === 'label' ? '4in 6in' : 'A4 portrait'};
            margin: 0;
          }
          html, body { background: white !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        `}
      </style>

      {/* MAIN APP CONTAINER (HIDDEN DURING PRINT) */}
      <div className="p-4 lg:p-6 max-w-[1600px] w-full mx-auto space-y-4 animate-in fade-in duration-500 pb-20 bg-zinc-50/50 min-h-screen print:hidden">
        
        {/* COMPACT HEADER & KPI CARDS */}
        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
          <div className="shrink-0">
            <h1 className="text-xl font-black tracking-tight text-zinc-900">E-Commerce Orders Center</h1>
            <p className="text-xs font-medium text-zinc-500">Digital Storefront & Routing Engine</p>
          </div>
          
          <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
            <Card className="shadow-sm border-zinc-200/80 rounded-xl flex-1 xl:flex-none min-w-[140px]">
              <CardContent className="p-3">
                <div className="flex justify-between items-center mb-1"><span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Awaiting Route</span><Clock className="w-3.5 h-3.5 text-zinc-400" /></div>
                <span className="text-xl font-black text-zinc-900">{metrics.awaiting}</span>
              </CardContent>
            </Card>
            <Card className="shadow-sm border-zinc-200/80 rounded-xl flex-1 xl:flex-none min-w-[140px]">
              <CardContent className="p-3">
                <div className="flex justify-between items-center mb-1"><span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">In Fabrication</span><Hammer className="w-3.5 h-3.5 text-zinc-400" /></div>
                <span className="text-xl font-black text-zinc-900">{metrics.fabrication}</span>
              </CardContent>
            </Card>
            <Card className="shadow-sm border-zinc-200/80 rounded-xl flex-1 xl:flex-none min-w-[140px]">
              <CardContent className="p-3">
                <div className="flex justify-between items-center mb-1"><span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Today's Sales</span><TrendingUp className="w-3.5 h-3.5 text-zinc-400" /></div>
                <span className="text-xl font-black text-zinc-900">₹{metrics.todaySales.toLocaleString('en-IN')}</span>
              </CardContent>
            </Card>
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
              <Input placeholder="Search orders..." className="pl-8 h-10 text-sm bg-white border-zinc-200 focus-visible:ring-[#4A1F58] rounded-xl shadow-sm w-full" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            </div>
          </div>
        </div>

        {/* FULL WIDTH DATA TABLE */}
        <div className="space-y-4">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="bg-white border border-zinc-200/60 rounded-xl h-10 px-1 flex w-full max-w-max shadow-sm">
              <TabsTrigger value="pending_approval" className="rounded-lg px-6 text-[10px] font-bold uppercase tracking-widest data-[state=active]:bg-[#4A1F58] data-[state=active]:text-white">All Pending</TabsTrigger>
              <TabsTrigger value="in_fulfillment" className="rounded-lg px-6 text-[10px] font-bold uppercase tracking-widest data-[state=active]:bg-[#4A1F58] data-[state=active]:text-white">In Fulfillment</TabsTrigger>
              <TabsTrigger value="completed" className="rounded-lg px-6 text-[10px] font-bold uppercase tracking-widest data-[state=active]:bg-[#4A1F58] data-[state=active]:text-white">Settled & Voided</TabsTrigger>
            </TabsList>

            <div className="mt-3">
              <Card className="shadow-sm border-zinc-200/80 bg-white rounded-2xl overflow-hidden min-h-[500px]">
                <div className="overflow-x-auto custom-scrollbar">
                  <Table className="whitespace-nowrap">
                    <TableHeader className="bg-zinc-50/80 border-b border-zinc-100">
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="text-[10px] font-bold uppercase text-zinc-500 tracking-widest px-6 h-10">Order No</TableHead>
                        <TableHead className="text-[10px] font-bold uppercase text-zinc-500 tracking-widest px-4 h-10">Customer & Contact</TableHead>
                        <TableHead className="text-[10px] font-bold uppercase text-zinc-500 tracking-widest px-4 h-10">Product SKU</TableHead>
                        <TableHead className="text-[10px] font-bold uppercase text-zinc-500 tracking-widest px-4 h-10">Status</TableHead>
                        <TableHead className="text-[10px] font-bold uppercase text-zinc-500 tracking-widest px-4 h-10 text-right">Value (₹)</TableHead>
                        <TableHead className="w-[200px] h-10 text-center">Quick Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isLoading ? (
                        <TableRow><TableCell colSpan={6} className="text-center py-12"><Loader2 className="w-6 h-6 animate-spin mx-auto text-zinc-300" /></TableCell></TableRow>
                      ) : filteredOrders.length === 0 ? (
                        <TableRow><TableCell colSpan={6} className="text-center py-12 text-sm font-medium text-zinc-400 uppercase tracking-widest">No orders found.</TableCell></TableRow>
                      ) : (
                        filteredOrders.map(order => (
                          <TableRow key={order.id} className="hover:bg-zinc-50/50 transition-colors group cursor-pointer" onClick={() => handleOpenRouting(order)}>
                            
                            <TableCell className="px-6 py-3">
                              <div className="font-mono font-bold text-sm text-zinc-900">{order.order_number}</div>
                              <div className="text-[10px] font-medium text-zinc-500 mt-0.5">{format(new Date(order.created_at), 'dd MMM yyyy, hh:mm a')}</div>
                            </TableCell>
                            
                            <TableCell className="px-4 py-3">
                              <div className="font-bold text-sm text-zinc-800">{order.customer_name || 'Online Guest'}</div>
                              <div className="text-[10px] text-zinc-500 mt-0.5 truncate max-w-[200px]">{order.shipping_address?.pincode} - {order.shipping_address?.city}</div>
                              
                              <div className="flex items-center gap-1.5 mt-1.5">
                                <button onClick={(e) => handleDialerCall(e, order.customer_phone)} className="flex items-center justify-center w-5 h-5 rounded-full bg-zinc-100 hover:bg-blue-100 hover:text-blue-700 text-zinc-500 transition-colors" title="Call">
                                  <PhoneCall className="w-2.5 h-2.5" />
                                </button>
                                <button onClick={(e) => handleManualWhatsApp(e, order.customer_phone, order.order_number, order.customer_name)} className="flex items-center justify-center w-5 h-5 rounded-full bg-zinc-100 hover:bg-green-100 hover:text-green-700 text-zinc-500 transition-colors" title="Manual WhatsApp">
                                  <MessageCircle className="w-2.5 h-2.5" />
                                </button>
                                <button onClick={(e) => handleApiWhatsApp(e, order)} className="flex items-center justify-center w-5 h-5 rounded-full bg-zinc-100 hover:bg-emerald-100 hover:text-emerald-700 text-zinc-500 transition-colors" title="API WhatsApp Auto-Template">
                                  <Send className="w-2.5 h-2.5" />
                                </button>
                              </div>
                            </TableCell>
                            
                            <TableCell className="px-4 py-3">
                              <div className="font-bold text-xs text-zinc-800 truncate max-w-[200px]">{order.items?.[0]?.product?.title || 'Unknown Product'}</div>
                              <div className="text-[10px] font-mono font-bold text-[#4A1F58] bg-purple-50 border border-purple-100 px-1.5 py-0.5 rounded inline-block mt-1">
                                {order.items?.[0]?.product?.sku_reference || 'NO-SKU'}
                              </div>
                            </TableCell>
                            
                            <TableCell className="px-4 py-3">
                              {getStatusBadge(order.status)}
                            </TableCell>
                            
                            <TableCell className="px-4 py-3 text-right">
                              <div className="font-black text-sm text-zinc-900">₹{(order.total_amount || order.final_total || 0).toLocaleString('en-IN')}</div>
                              {order.taxable_value > 0 && <div className="text-[9px] font-bold text-zinc-400 mt-0.5 uppercase tracking-widest">Inc. ₹{(order.cgst_amount + order.sgst_amount).toLocaleString('en-IN')} GST</div>}
                            </TableCell>
                            
                            <TableCell className="px-4 py-3 text-right">
                              {/* 🔥 ALWAYS-VISIBLE QUICK ACTIONS */}
                              <div className="flex justify-end items-center gap-1.5">
                                {activeTab === "pending_approval" && order.status !== "cancelled" && (
                                  <Button size="sm" onClick={(e) => { e.stopPropagation(); handleOpenRouting(order); }} className="bg-zinc-900 hover:bg-zinc-800 text-white font-bold text-[10px] uppercase tracking-widest h-7 px-2">
                                    <Zap className="w-3 h-3 mr-1" /> Route
                                  </Button>
                                )}
                                
                                {order.status !== "cancelled" && (
                                  <>
                                    <Button variant="outline" size="icon" onClick={(e) => handleOpenReceiptModal(e, order)} className="h-7 w-7 text-zinc-500 hover:text-blue-600 hover:bg-blue-50 border-zinc-200" title="Preview E-Receipt">
                                      <Receipt className="w-3.5 h-3.5" />
                                    </Button>
                                    <Button variant="outline" size="icon" onClick={(e) => handleViewInvoice(e, order)} className="h-7 w-7 text-zinc-500 hover:text-emerald-600 hover:bg-emerald-50 border-zinc-200" title="Generate Official Tax Invoice">
                                      <FileText className="w-3.5 h-3.5" />
                                    </Button>
                                    <Button variant="outline" size="icon" onClick={(e) => handleOpenLabelModal(e, order)} className="h-7 w-7 text-zinc-500 hover:text-indigo-600 hover:bg-indigo-50 border-zinc-200" title="Print Shipping Label">
                                      <Printer className="w-3.5 h-3.5" />
                                    </Button>
                                  </>
                                )}

                                {order.status !== "cancelled" && (
                                  <Button variant="outline" size="icon" onClick={(e) => { e.stopPropagation(); setVoidModal({ isOpen: true, order, reason: "" }); }} className="h-7 w-7 text-red-400 hover:text-red-700 hover:bg-red-50 border-red-200" title="Void Order">
                                    <Ban className="w-3.5 h-3.5" />
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </Card>
            </div>
          </Tabs>
        </div>
      </div>

      {/* ========================================================================== */}
      {/* ROUTING MODAL (THE LOGISTICS ENGINE) */}
      {/* ========================================================================== */}
      <Dialog open={!!selectedOrder} onOpenChange={(o) => !o && setSelectedOrder(null)}>
        <DialogContent className="sm:max-w-[700px] p-0 border-none shadow-2xl rounded-2xl bg-zinc-50 overflow-hidden flex flex-col max-h-[90vh] print:hidden">
          <DialogHeader className="bg-white p-5 border-b border-zinc-200 shrink-0">
            <div className="flex justify-between items-start mb-4">
              <div>
                <DialogTitle className="text-xl font-black text-zinc-900 flex items-center gap-2">
                  <Package className="w-5 h-5 text-[#4A1F58]" /> Order Control Center
                </DialogTitle>
                <DialogDescription className="text-xs font-medium mt-1 text-zinc-500">
                  <strong className="font-mono text-zinc-800 text-sm">{selectedOrder?.order_number}</strong> • {selectedOrder?.customer_name}
                </DialogDescription>
              </div>
              <div className="text-right flex items-center gap-2">
                 {getStatusBadge(selectedOrder?.status)}
              </div>
            </div>

            {selectedOrder?.status !== "cancelled" && (
              <div className="flex flex-wrap items-center gap-2 bg-zinc-50 p-2 rounded-lg border border-zinc-200">
                <Button size="sm" variant="outline" className="h-8 text-[10px] uppercase tracking-widest font-bold text-emerald-700 border-emerald-200 hover:bg-emerald-50" onClick={(e) => handleApiWhatsApp(e, selectedOrder)}>
                  <Send className="w-3 h-3 mr-1.5" /> Auto WA
                </Button>
                <Button size="sm" variant="outline" className="h-8 text-[10px] uppercase tracking-widest font-bold text-blue-700 border-blue-200 hover:bg-blue-50" onClick={(e) => handleOpenReceiptModal(e, selectedOrder)}>
                  <Receipt className="w-3 h-3 mr-1.5" /> E-Receipt
                </Button>
                <Button size="sm" variant="outline" className="h-8 text-[10px] uppercase tracking-widest font-bold text-indigo-700 border-indigo-200 hover:bg-indigo-50" onClick={(e) => handleViewInvoice(e, selectedOrder)}>
                  <FileText className="w-3 h-3 mr-1.5" /> Tax Invoice
                </Button>
                <Button size="sm" variant="outline" className="h-8 text-[10px] uppercase tracking-widest font-bold text-zinc-700 border-zinc-200 hover:bg-zinc-100" onClick={(e) => handleOpenLabelModal(e, selectedOrder)}>
                  <Printer className="w-3 h-3 mr-1.5" /> Ship Label
                </Button>
                <div className="flex-1" />
                <Button size="sm" variant="outline" className="h-8 text-[10px] uppercase tracking-widest font-bold text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700" onClick={() => setVoidModal({ isOpen: true, order: selectedOrder, reason: "" })}>
                  <Ban className="w-3 h-3 mr-1.5" /> Void Order
                </Button>
              </div>
            )}
          </DialogHeader>

          <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-6">
            {selectedOrder?.status !== "cancelled" ? (
              <>
                <div className="bg-[#4A1F58]/5 border border-[#4A1F58]/10 rounded-xl p-4 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-[#4A1F58] mb-1 flex items-center gap-1.5"><MapPin className="w-3 h-3"/> Logistics Engine</p>
                    <p className="text-sm font-bold text-zinc-900">Customer Pincode: <span className="font-mono">{selectedOrder?.shipping_address?.pincode || 'N/A'}</span></p>
                    {nearestWarehouse ? (
                      <p className="text-xs font-medium text-[#4A1F58] mt-1">Nearest Branch: <strong>{nearestWarehouse.warehouse.name}</strong> ({nearestWarehouse.local_transit_days} Day Transit)</p>
                    ) : (
                      <p className="text-xs font-medium text-amber-600 mt-1 flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5" /> No local branch mapping found.</p>
                    )}
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 block mb-1">Target SKU</span>
                    <span className="font-mono text-sm font-black text-[#4A1F58] bg-white border border-purple-100 px-2 py-1 rounded shadow-sm">
                      {selectedOrder?.items?.[0]?.product?.sku_reference}
                    </span>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between items-end">
                    <Label className="text-[11px] font-black text-zinc-600 uppercase tracking-widest">Live Physical Stock Match</Label>
                    <div className="flex items-center gap-1">
                      <Input placeholder="Legacy Tag Search..." className="h-8 text-[10px] w-[140px]" value={legacySearch} onChange={(e) => setLegacySearch(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && executeLegacySearch()} />
                      <Button size="sm" variant="secondary" className="h-8 text-[10px] font-bold" onClick={executeLegacySearch}>Search</Button>
                    </div>
                  </div>

                  <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden shadow-sm">
                    <Table>
                      <TableHeader className="bg-zinc-50">
                        <TableRow>
                          <TableHead className="text-[10px] font-bold text-zinc-500 uppercase h-9">Branch Location</TableHead>
                          <TableHead className="text-[10px] font-bold text-zinc-500 uppercase h-9">Exact Barcode</TableHead>
                          <TableHead className="text-[10px] font-bold text-zinc-500 uppercase h-9 text-right">Net Wt.</TableHead>
                          <TableHead className="h-9 w-[120px]"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {isRoutingLoad ? (
                          <TableRow><TableCell colSpan={4} className="text-center py-6"><Loader2 className="w-5 h-5 animate-spin mx-auto text-zinc-300" /></TableCell></TableRow>
                        ) : matchingStock.length === 0 ? (
                          <TableRow><TableCell colSpan={4} className="text-center py-6 text-[11px] font-bold text-zinc-400 uppercase tracking-widest">No stock found for this design.</TableCell></TableRow>
                        ) : (
                          matchingStock.map(stock => {
                            const isNearest = nearestWarehouse?.warehouse?.id === stock.warehouse?.id;
                            return (
                              <TableRow key={stock.id} className={`${isNearest ? 'bg-purple-50/50' : ''}`}>
                                <TableCell className="py-2">
                                  <span className="text-xs font-bold text-zinc-800 flex items-center gap-1.5"><Store className="w-3.5 h-3.5 text-zinc-400" /> {stock.warehouse?.name}</span>
                                  {isNearest && <span className="text-[9px] font-black text-[#4A1F58] uppercase tracking-widest mt-0.5 block">Recommended</span>}
                                </TableCell>
                                <TableCell className="py-2 font-mono text-xs font-bold text-zinc-600">{stock.barcode}</TableCell>
                                <TableCell className="py-2 text-right text-xs font-medium text-zinc-600">{stock.net_weight_g}g</TableCell>
                                <TableCell className="py-2 text-right">
                                  <Button size="sm" className="h-7 text-[10px] font-bold uppercase tracking-widest bg-[#4A1F58] hover:bg-[#302832] text-white" disabled={isExecuting} onClick={() => fulfillFromStock(stock.id, stock.warehouse?.id, nearestWarehouse?.local_transit_days || 4)}>
                                    {isExecuting ? <Loader2 className="w-3 h-3 animate-spin" /> : "Pick & Fulfill"}
                                  </Button>
                                </TableCell>
                              </TableRow>
                            )
                          })
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                <Separator className="bg-zinc-200" />

                <div className="flex items-center justify-between bg-zinc-50 border border-zinc-200 p-4 rounded-xl">
                  <div>
                    <p className="text-sm font-bold text-zinc-800">Route to Manufacturing</p>
                    <p className="text-[11px] font-medium text-zinc-500 mt-0.5">Push to Custom Orders queue.</p>
                  </div>
                  <Button variant="outline" className="h-10 border-zinc-300 text-zinc-800 font-bold text-xs uppercase tracking-widest hover:bg-amber-50 hover:text-amber-700" disabled={isExecuting} onClick={routeToManufacturing}>
                    <Hammer className="w-4 h-4 mr-2" /> Make to Order
                  </Button>
                </div>
              </>
            ) : (
              <div className="bg-red-50 border border-red-100 p-6 rounded-xl text-center">
                <Ban className="w-10 h-10 text-red-400 mx-auto mb-3" />
                <h3 className="text-lg font-bold text-red-800 mb-1">Order Cancelled</h3>
                <p className="text-sm text-red-600 mb-3">Reason: {selectedOrder.cancellation_reason || "No reason provided"}</p>
                <span className="text-[10px] font-bold uppercase tracking-widest text-red-500 bg-red-100 px-2 py-1 rounded">Voided By: {selectedOrder.cancelled_by || "System"}</span>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ========================================================================== */}
      {/* VOID ORDER MODAL */}
      {/* ========================================================================== */}
      <Dialog open={voidModal.isOpen} onOpenChange={(o) => !o && setVoidModal({ isOpen: false, order: null, reason: "" })}>
        <DialogContent className="sm:max-w-[400px] print:hidden">
          <DialogHeader>
            <DialogTitle className="text-red-600 flex items-center gap-2"><Ban className="w-5 h-5"/> Void Order</DialogTitle>
            <DialogDescription>
              This will safely cancel order <strong>{voidModal.order?.order_number}</strong>. This action cannot be reversed.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-widest text-zinc-600">Cancellation Reason <span className="text-red-500">*</span></Label>
              <Input 
                placeholder="e.g. Customer requested cancellation" 
                value={voidModal.reason}
                onChange={(e) => setVoidModal({ ...voidModal, reason: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setVoidModal({ isOpen: false, order: null, reason: "" })}>Cancel</Button>
            <Button variant="destructive" onClick={executeVoidOrder} disabled={isExecuting || !voidModal.reason.trim()}>
              {isExecuting ? <Loader2 className="w-4 h-4 animate-spin mr-2"/> : null} Confirm Void
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========================================================================== */}
      {/* WHATSAPP API SENDER MODAL */}
      {/* ========================================================================== */}
      <WhatsAppSenderModal 
        isOpen={waModalConfig.isOpen} 
        onClose={() => setWaModalConfig({ isOpen: false, phone: '', contextData: {} })} 
        recipients={waModalConfig.phone ? [{ phone: waModalConfig.phone, name: waModalConfig.contextData?.customer_name || 'Customer' }] : []}
        defaultTemplateName="order_update"
        templateVariables={[
          waModalConfig.contextData?.customer_name || "Customer",
          waModalConfig.contextData?.order_number || "",
          waModalConfig.contextData?.status || "Processing"
        ]}
      />

      {/* ========================================================================== */}
      {/* EDITABLE INVOICE VIEW MODAL */}
      {/* ========================================================================== */}
      <Dialog open={!!invoiceOrder} onOpenChange={(o) => !o && setInvoiceOrder(null)}>
        <DialogContent className="sm:max-w-[900px] w-full p-0 overflow-hidden bg-zinc-100 flex flex-col h-[90vh] print:hidden">
          <div className="p-4 bg-white border-b border-zinc-200 flex justify-between items-center shrink-0">
            <div>
              <h2 className="text-lg font-black text-zinc-900 flex items-center gap-2"><FileText className="w-5 h-5 text-indigo-600"/> Official Tax Invoice</h2>
              <p className="text-xs text-zinc-500">Order: {invoiceOrder?.order_number}</p>
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={(e) => handleApiWhatsApp(e, invoiceOrder)} variant="outline" size="sm" className="h-8 border-green-200 text-green-700 hover:bg-green-50">
                <MessageCircle className="w-4 h-4 mr-2" /> Send via WA
              </Button>
              <Button onClick={executeInvoicePrint} size="sm" className="h-8 bg-[#4A1F58] hover:bg-[#302832] text-white">
                <Printer className="w-4 h-4 mr-2" /> Print Invoice
              </Button>
            </div>
          </div>
          
          {/* Quick Editor for Invoice Weights */}
          {invoiceOrder?.items?.length > 0 && (
            <div className="px-8 py-3 bg-white border-b border-zinc-200 shrink-0">
              <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2">Pre-Print Adjustments</p>
              <div className="flex flex-wrap gap-4">
                {invoiceOrder.items.map((item: any, idx: number) => (
                  <div key={idx} className="flex items-center gap-3 bg-zinc-50 p-2 rounded-lg border border-zinc-200">
                    <span className="text-xs font-medium text-zinc-700 w-24 truncate">{item.product?.title}</span>
                    <div className="flex items-center gap-1">
                      <Label className="text-[10px]">Gold Wt (g):</Label>
                      <Input className="h-7 w-20 text-xs px-2" value={invoiceWeights[idx]?.gw || ''} onChange={(e) => setInvoiceWeights(prev => ({...prev, [idx]: {...prev[idx], gw: e.target.value}}))} placeholder="e.g. 10.5" />
                    </div>
                    <div className="flex items-center gap-1">
                      <Label className="text-[10px]">Dia Wt (cts):</Label>
                      <Input className="h-7 w-20 text-xs px-2" value={invoiceWeights[idx]?.dw || ''} onChange={(e) => setInvoiceWeights(prev => ({...prev, [idx]: {...prev[idx], dw: e.target.value}}))} placeholder="e.g. 1.2" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex-1 overflow-y-auto p-8 custom-scrollbar flex justify-center items-start">
            <div className="shadow-2xl ring-1 ring-black/5 bg-white shrink-0" style={{ transform: "scale(0.9)", transformOrigin: "top center" }}>
              {mappedInvoiceData && <InvoicePrintTemplate data={mappedInvoiceData} />}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ========================================================================== */}
      {/* EDITABLE SHIPPING LABEL MODAL */}
      {/* ========================================================================== */}
      <Dialog open={labelModal.isOpen} onOpenChange={(o) => !o && setLabelModal({ isOpen: false, order: null })}>
        <DialogContent className="sm:max-w-[500px] print:hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Printer className="w-5 h-5 text-[#4A1F58]" /> Print Shipping Label</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-widest text-zinc-600">Return Address Override</Label>
              <Textarea 
                className="text-xs font-mono resize-none h-24" 
                value={returnAddress}
                onChange={(e) => setReturnAddress(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setLabelModal({ isOpen: false, order: null })}>Cancel</Button>
            <Button className="bg-[#4A1F58] hover:bg-[#302832] text-white" onClick={executeLabelPrint}>
              <Printer className="w-4 h-4 mr-2"/> Print Label
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========================================================================== */}
      {/* E-RECEIPT PREVIEW MODAL */}
      {/* ========================================================================== */}
      <Dialog open={!!receiptOrder} onOpenChange={(o) => !o && setReceiptOrder(null)}>
        <DialogContent className="sm:max-w-[700px] print:hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Receipt className="w-5 h-5 text-[#4A1F58]" /> E-Receipt Preview</DialogTitle>
          </DialogHeader>
          
          <div className="max-h-[60vh] overflow-y-auto border border-zinc-200 rounded-lg p-4 bg-zinc-50 custom-scrollbar">
            {/* THIS HTML BLOCK IS USED BY HTML2PDF */}
            <div id="pdf-receipt-preview-content" style={{ padding: '40px', fontFamily: 'monospace', fontSize: '14px', color: '#000000', backgroundColor: '#ffffff', boxSizing: 'border-box' }}>
              <div style={{ textAlign: 'center', borderBottom: '2px solid #000000', paddingBottom: '24px', marginBottom: '30px' }}>
                <h1 style={{ fontSize: '36px', fontFamily: 'serif', fontWeight: 'bold', letterSpacing: '0.2em', color: '#4A1F58', margin: '0 0 16px 0' }}>PAVITRAM</h1>
                <h2 style={{ fontSize: '24px', fontWeight: 'bold', margin: '0 0 4px 0' }}>E-RECEIPT</h2>
                <p style={{ color: '#6b7280', margin: '0' }}>{receiptOrder?.created_at ? new Date(receiptOrder.created_at).toLocaleString() : new Date().toLocaleString()}</p>
                <p style={{ fontWeight: 'bold', fontSize: '20px', margin: '16px 0 0 0' }}>Order No: {receiptOrder?.order_number}</p>
              </div>
              <div style={{ borderBottom: '2px solid #000000', paddingBottom: '24px', marginBottom: '30px' }}>
                <p style={{ fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.1em', borderBottom: '1px solid #000000', display: 'inline-block', paddingBottom: '4px', margin: '0 0 16px 0' }}>Billed To:</p>
                <p style={{ fontSize: '18px', margin: '0 0 4px 0' }}>{receiptOrder?.customer_name || 'Guest'}</p>
                <p style={{ margin: '0 0 4px 0' }}>{receiptOrder?.customer_email || 'N/A'}</p>
                <p style={{ margin: '0' }}>{receiptOrder?.customer_phone || 'N/A'}</p>
              </div>
              <div style={{ borderBottom: '2px solid #000000', paddingBottom: '24px', marginBottom: '30px' }}>
                <p style={{ fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.1em', borderBottom: '1px solid #000000', display: 'inline-block', paddingBottom: '4px', margin: '0 0 16px 0' }}>Items Purchased:</p>
                <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                  <thead><tr style={{ borderBottom: '1px solid #000000' }}><th style={{ padding: '8px 0', width: '66%' }}>Item</th><th style={{ padding: '8px 0', textAlign: 'right' }}>Qty</th><th style={{ padding: '8px 0', textAlign: 'right' }}>Price</th></tr></thead>
                  <tbody>
                    {receiptOrder?.items?.length > 0 ? receiptOrder.items.map((item: any, idx: number) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #d1d5db' }}>
                        <td style={{ padding: '16px 16px 16px 0' }}>{item.product?.title || "Jewellery Item"}</td>
                        <td style={{ padding: '16px 0', textAlign: 'right' }}>{item.quantity}</td>
                        <td style={{ padding: '16px 0', textAlign: 'right', fontWeight: 'bold' }}>₹{(item.total_price || 0).toLocaleString('en-IN')}</td>
                      </tr>
                    )) : <tr><td colSpan={3} style={{ padding: '16px 0', fontStyle: 'italic', color: '#6b7280' }}>No item details available.</td></tr>}
                  </tbody>
                </table>
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '20px', marginBottom: '16px' }}>
                  <span style={{ fontWeight: 'bold' }}>Total Amount Paid:</span>
                  <span style={{ fontWeight: 'bold', color: '#4A1F58' }}>₹{(receiptOrder?.final_total || receiptOrder?.total_amount || 0).toLocaleString('en-IN')}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#4b5563' }}>Payment Status:</span>
                  <span style={{ fontWeight: 'bold', textTransform: 'uppercase', color: '#15803d' }}>{receiptOrder?.payment_status || "Processing"}</span>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setReceiptOrder(null)}>Close</Button>
            <Button onClick={executeReceiptDownload} disabled={isGeneratingReceipt} className="bg-[#4A1F58] hover:bg-[#302832] text-white">
              {isGeneratingReceipt ? <Loader2 className="w-4 h-4 animate-spin mr-2"/> : <Download className="w-4 h-4 mr-2" />} Download PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      {/* ========================================================================== */}
      {/* 🖨️ THE PRINT-ONLY RENDER LAYER (Absolutely hidden unless window.print() is called) */}
      {/* ========================================================================== */}
      <div className="hidden print:block w-full h-full absolute top-0 left-0 bg-white z-[9999] m-0 p-0">
        
        {/* 1. SHIPPING LABEL (4x6 format with tamper warnings) */}
        {printMode === 'label' && labelModal.order && (
          <div className="w-[4in] h-[6in] text-black p-4 font-sans overflow-hidden border-2 border-black box-border flex flex-col mx-auto">
            
            <div className="flex justify-between items-start border-b-4 border-black pb-2 mb-3">
              <h1 className="text-2xl font-black uppercase tracking-tighter leading-none">Standard<br/>Delivery</h1>
              <div className="text-right">
                <p className="font-bold text-lg leading-none">{labelModal.order.shipping_address?.pincode || "000000"}</p>
                <p className="font-bold text-xs mt-1 uppercase border border-black px-1 py-0.5 inline-block">{labelModal.order.shipping_address?.state || "IND"}</p>
              </div>
            </div>

            <div className="border-b-2 border-black pb-3 mb-3 flex-1">
              <p className="font-bold text-[10px] uppercase tracking-widest mb-1 text-zinc-600">Ship To:</p>
              <p className="font-bold text-2xl leading-tight mb-1">{labelModal.order.customer_name}</p>
              <p className="text-sm leading-snug font-medium max-w-[90%]">{labelModal.order.shipping_address?.addressLine1}</p>
              {labelModal.order.shipping_address?.addressLine2 && <p className="text-sm leading-snug font-medium max-w-[90%]">{labelModal.order.shipping_address?.addressLine2}</p>}
              <p className="text-sm leading-snug mt-1 font-bold">{labelModal.order.shipping_address?.city}, {labelModal.order.shipping_address?.state} {labelModal.order.shipping_address?.pincode}</p>
              <p className="text-sm mt-2 font-mono font-bold">PH: {labelModal.order.customer_phone}</p>
            </div>

            <div className="text-center py-4 border-b-2 border-black shrink-0">
              <div className="h-14 w-full flex items-center justify-center gap-0.5 px-4 mb-2">
                <div className="h-full w-2 bg-black"></div><div className="h-full w-1 bg-black"></div><div className="h-full w-3 bg-black"></div><div className="h-full w-1 bg-black"></div>
                <div className="h-full w-4 bg-black"></div><div className="h-full w-1 bg-black"></div><div className="h-full w-2 bg-black"></div><div className="h-full w-2 bg-black"></div>
                <div className="h-full w-1 bg-black"></div><div className="h-full w-3 bg-black"></div><div className="h-full w-1 bg-black"></div><div className="h-full w-4 bg-black"></div>
                <div className="h-full w-2 bg-black"></div><div className="h-full w-1 bg-black"></div><div className="h-full w-3 bg-black"></div><div className="h-full w-1 bg-black"></div>
              </div>
              <p className="font-mono font-bold text-sm tracking-[0.2em] uppercase">{labelModal.order.order_number}</p>
            </div>

            <div className="pt-2 flex justify-between items-start shrink-0">
              <div className="w-[65%]">
                <p className="font-bold text-[8px] uppercase text-zinc-500 mb-0.5">Return Address:</p>
                <div className="text-[9px] font-bold leading-tight whitespace-pre-wrap">{returnAddress}</div>
              </div>
              <div className="text-right">
                <p className="font-bold text-lg leading-none mt-1">Pre-Paid</p>
              </div>
            </div>

            {/* TAMPER WARNING FOOTER */}
            <div className="mt-3 pt-2 border-t-2 border-black text-center shrink-0">
              <p className="font-black text-[12px] uppercase tracking-widest">*** Handle With Care ***</p>
              <p className="font-black text-[10px] uppercase text-black bg-zinc-200 px-1 mt-0.5">Do Not Accept If Seal Is Tampered</p>
            </div>
          </div>
        )}

        {/* 2. A4 TAX INVOICE PRINT LAYOUT (Strict 297mm height to prevent blank 2nd pages) */}
        {printMode === 'invoice' && mappedInvoiceData && (
          <div className="w-[210mm] h-[297mm] overflow-hidden bg-white mx-auto relative box-border" ref={printContainerRef}>
            <InvoicePrintTemplate data={mappedInvoiceData} />
          </div>
        )}

      </div>
    </>
  );
}