"use client";

import React, { useEffect, useState } from "react";
import { format } from "date-fns";
import { 
  Search, CheckCircle2, XCircle, Hammer, MapPin, Package, 
  ChevronRight, ArrowRight, Loader2, AlertCircle, Store, Zap
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
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, 
  DialogHeader, DialogTitle
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

export default function EcommerceOrdersPage() {
  const { appUser } = useAuth();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState("pending_approval");
  const [orders, setOrders] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Routing Engine (Triad Architecture) States
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [nearestWarehouse, setNearestWarehouse] = useState<any>(null);
  const [matchingStock, setMatchingStock] = useState<any[]>([]);
  const [legacySearch, setLegacySearch] = useState("");
  const [isRoutingLoad, setIsRoutingLoad] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);

  const fetchOrders = async () => {
    if (!appUser?.company_id) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("ecommerce_orders")
        .select(`
          *,
          customers(full_name, phone),
          items:ecommerce_order_items(
            quantity,
            total_price,
            product:ecommerce_products(title, sku_reference, legacy_item_no, manufacturing_buffer_days)
          )
        `)
        .eq("company_id", appUser.company_id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setOrders(data || []);
    } catch (err: any) {
      toast({ title: "Fetch Failed", description: err.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [appUser]);

  // Filtering Logic
  const filteredOrders = orders.filter((o) => {
    // Tab Filter
    if (activeTab === "pending_approval" && o.status !== "pending_approval") return false;
    if (activeTab === "in_fulfillment" && !["approved_from_stock", "sent_to_manufacturing", "ready_to_ship"].includes(o.status)) return false;
    if (activeTab === "completed" && !["shipped", "delivered", "cancelled"].includes(o.status)) return false;

    // Search Filter
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!o.order_number.toLowerCase().includes(q) && !o.customers?.full_name?.toLowerCase().includes(q)) {
        return false;
      }
    }
    return true;
  });

  // ==========================================================================
  // TRIAD ARCHITECTURE: ROUTING ENGINE
  // ==========================================================================
  const handleOpenRouting = async (order: any) => {
    setSelectedOrder(order);
    setNearestWarehouse(null);
    setMatchingStock([]);
    setLegacySearch("");
    setIsRoutingLoad(true);

    try {
      const pincode = order.shipping_address?.pincode;
      const targetSku = order.items?.[0]?.product?.sku_reference;

      if (!targetSku) throw new Error("Order item missing SKU reference.");

      // 1. Find Nearest Warehouse via Pincode Engine
      if (pincode) {
        const { data: whMapping } = await supabase
          .from("warehouse_pincode_mapping")
          .select("local_transit_days, warehouse:warehouses(id, name)")
          .eq("company_id", appUser?.company_id)
          .eq("pincode", pincode)
          .maybeSingle();
        
        if (whMapping) setNearestWarehouse(whMapping);
      }

      // 2. Fetch Live Stock (The Physical Asset)
      const { data: stockData, error: stockErr } = await supabase
        .from("inventory_items")
        .select("id, barcode, gross_weight_g, net_weight_g, warehouse:warehouses(id, name)")
        .eq("company_id", appUser?.company_id)
        .eq("status", "in_stock")
        .eq("sku_reference", targetSku);

      if (stockErr) throw stockErr;
      setMatchingStock(stockData || []);

    } catch (err: any) {
      toast({ title: "Routing Error", description: err.message, variant: "destructive" });
    } finally {
      setIsRoutingLoad(false);
    }
  };

  // 3. The Human Fallback (Legacy Search)
  const executeLegacySearch = async () => {
    if (!legacySearch.trim()) return;
    setIsRoutingLoad(true);
    try {
      const { data, error } = await supabase
        .from("inventory_items")
        .select("id, barcode, gross_weight_g, net_weight_g, warehouse:warehouses(id, name)")
        .eq("company_id", appUser?.company_id)
        .eq("status", "in_stock")
        .or(`barcode.ilike.%${legacySearch}%,sku.ilike.%${legacySearch}%`); // Fallback checks

      if (error) throw error;
      setMatchingStock(data || []);
      toast({ description: `Found ${data?.length || 0} items matching legacy search.` });
    } catch (err: any) {
      toast({ variant: "destructive", description: err.message });
    } finally {
      setIsRoutingLoad(false);
    }
  };

  // Execution: Fulfill from existing stock
  const fulfillFromStock = async (inventoryItemId: string, warehouseId: string, transitDays: number) => {
    setIsExecuting(true);
    try {
      // Calculate ETA
      const eta = new Date();
      eta.setDate(eta.getDate() + transitDays);

      // 1. Reserve the physical item
      const { error: invErr } = await supabase
        .from("inventory_items")
        .update({ status: "reserved" })
        .eq("id", inventoryItemId);
      if (invErr) throw invErr;

      // 2. Update the e-commerce order
      const { error: ordErr } = await supabase
        .from("ecommerce_orders")
        .update({
          status: "approved_from_stock",
          fulfillment_type: "from_stock",
          warehouse_id: warehouseId,
          linked_inventory_item_id: inventoryItemId,
          expected_delivery_date: eta.toISOString().split("T")[0]
        })
        .eq("id", selectedOrder.id);
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

  // Execution: Make to Order (Job Bag / Karigar Route)
  const routeToManufacturing = async () => {
    setIsExecuting(true);
    try {
      const product = selectedOrder.items?.[0]?.product;
      const bufferDays = product?.manufacturing_buffer_days || 14;
      
      const eta = new Date();
      eta.setDate(eta.getDate() + bufferDays + 2); // Buffer + standard transit

      // 1. Create Custom Order entry
      const { data: coData, error: coErr } = await supabase
        .from("custom_orders")
        .insert({
          company_id: appUser?.company_id,
          origin_warehouse_id: nearestWarehouse?.warehouse?.id || appUser?.warehouse_id, // Fallback to current user's WH
          customer_id: selectedOrder.customer_id,
          order_number: `CUST-WEB-${selectedOrder.order_number}`,
          design_reference: product?.sku_reference,
          status: "pending_manufacturing",
          base_estimated_value: selectedOrder.final_total,
          advance_paid: selectedOrder.final_total // Assuming full payment online
        })
        .select()
        .single();
      
      if (coErr) throw coErr;

      // 2. Update e-commerce order
      const { error: ordErr } = await supabase
        .from("ecommerce_orders")
        .update({
          status: "sent_to_manufacturing",
          fulfillment_type: "made_to_order",
          linked_custom_order_id: coData.id,
          expected_delivery_date: eta.toISOString().split("T")[0]
        })
        .eq("id", selectedOrder.id);
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

  // Visual Helpers
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending_approval": return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 border-none uppercase tracking-widest text-[9px] font-bold shadow-none">Awaiting Route</Badge>;
      case "approved_from_stock": return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 border-none uppercase tracking-widest text-[9px] font-bold shadow-none">Picking List</Badge>;
      case "sent_to_manufacturing": return <Badge className="bg-purple-100 text-purple-700 hover:bg-purple-100 border-none uppercase tracking-widest text-[9px] font-bold shadow-none">In Fabrication</Badge>;
      case "ready_to_ship": return <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-none uppercase tracking-widest text-[9px] font-bold shadow-none">Ready to Ship</Badge>;
      default: return <Badge className="bg-gray-100 text-gray-700 hover:bg-gray-100 border-none uppercase tracking-widest text-[9px] font-bold shadow-none">{status.replace(/_/g, ' ')}</Badge>;
    }
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-[1600px] w-full mx-auto space-y-6 animate-in fade-in duration-500 pb-20">
      
      {/* HEADER & FILTERS */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-zinc-900">Orders Approval Queue</h1>
          <p className="text-sm font-medium text-zinc-500 mt-1">Route online orders to physical branches or manufacturing pipelines.</p>
        </div>
        
        <div className="relative w-full md:w-[300px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
          <Input 
            placeholder="Search Order No / Customer..." 
            className="pl-9 h-10 bg-white border-zinc-200 focus-visible:ring-indigo-500 rounded-xl font-medium shadow-sm"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* TABS */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-white border border-zinc-200/60 rounded-xl h-12 px-1 flex w-full max-w-max shadow-sm">
          <TabsTrigger value="pending_approval" className="rounded-lg px-6 text-xs font-bold uppercase tracking-widest data-[state=active]:bg-indigo-50 data-[state=active]:text-indigo-700">Action Required</TabsTrigger>
          <TabsTrigger value="in_fulfillment" className="rounded-lg px-6 text-xs font-bold uppercase tracking-widest data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700">In Fulfillment</TabsTrigger>
          <TabsTrigger value="completed" className="rounded-lg px-6 text-xs font-bold uppercase tracking-widest data-[state=active]:bg-emerald-50 data-[state=active]:text-emerald-700">Settled / Closed</TabsTrigger>
        </TabsList>

        <div className="mt-4">
          <Card className="shadow-sm border-zinc-200/80 bg-white rounded-2xl overflow-hidden">
            <div className="overflow-x-auto custom-scrollbar">
              <Table className="whitespace-nowrap">
                <TableHeader className="bg-zinc-50/80">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-[11px] font-bold uppercase text-zinc-500 tracking-widest px-6 h-12">Order / Date</TableHead>
                    <TableHead className="text-[11px] font-bold uppercase text-zinc-500 tracking-widest px-4 h-12">Customer & Pincode</TableHead>
                    <TableHead className="text-[11px] font-bold uppercase text-zinc-500 tracking-widest px-4 h-12">Product SKU</TableHead>
                    <TableHead className="text-[11px] font-bold uppercase text-zinc-500 tracking-widest px-4 h-12">Status</TableHead>
                    <TableHead className="text-[11px] font-bold uppercase text-zinc-500 tracking-widest px-6 h-12 text-right">Value (₹)</TableHead>
                    <TableHead className="w-[100px] h-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-12"><Loader2 className="w-6 h-6 animate-spin mx-auto text-zinc-300" /></TableCell></TableRow>
                  ) : filteredOrders.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-12 text-sm font-medium text-zinc-400 uppercase tracking-widest">No orders found in this view.</TableCell></TableRow>
                  ) : (
                    filteredOrders.map(order => (
                      <TableRow key={order.id} className="hover:bg-zinc-50/50 transition-colors group">
                        <TableCell className="px-6 py-4">
                          <div className="font-mono font-bold text-sm text-zinc-900">{order.order_number}</div>
                          <div className="text-[11px] font-medium text-zinc-500 mt-0.5">{format(new Date(order.created_at), 'dd MMM yyyy, hh:mm a')}</div>
                        </TableCell>
                        <TableCell className="px-4">
                          <div className="font-bold text-sm text-zinc-800">{order.customers?.full_name || 'Online Guest'}</div>
                          <div className="flex items-center gap-1.5 text-[11px] font-medium text-zinc-500 mt-1">
                            <MapPin className="w-3 h-3" /> Pincode: <span className="font-mono">{order.shipping_address?.pincode}</span>
                          </div>
                        </TableCell>
                        <TableCell className="px-4">
                          <div className="font-bold text-xs text-zinc-800 truncate max-w-[200px]">{order.items?.[0]?.product?.title || 'Unknown Product'}</div>
                          <div className="text-[11px] font-mono font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded inline-block mt-1">
                            {order.items?.[0]?.product?.sku_reference || 'NO-SKU'}
                          </div>
                        </TableCell>
                        <TableCell className="px-4">
                          {getStatusBadge(order.status)}
                        </TableCell>
                        <TableCell className="px-6 text-right">
                          <div className="font-black text-sm text-zinc-900">₹{order.final_total.toLocaleString()}</div>
                          {order.tax_amount > 0 && <div className="text-[10px] font-bold text-zinc-400 mt-0.5 uppercase tracking-widest">Inc. Tax</div>}
                        </TableCell>
                        <TableCell className="px-6 text-right">
                          {activeTab === "pending_approval" ? (
                            <Button 
                              size="sm" 
                              onClick={() => handleOpenRouting(order)}
                              className="bg-zinc-900 hover:bg-zinc-800 text-white font-bold text-[10px] uppercase tracking-widest shadow-sm rounded-lg h-8"
                            >
                              <Zap className="w-3.5 h-3.5 mr-1.5" /> Route
                            </Button>
                          ) : (
                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-zinc-400 group-hover:text-indigo-600 group-hover:bg-indigo-50">
                              <ChevronRight className="w-4 h-4" />
                            </Button>
                          )}
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

      {/* ========================================================================== */}
      {/* ROUTING MODAL (THE LOGISTICS ENGINE) */}
      {/* ========================================================================== */}
      <Dialog open={!!selectedOrder} onOpenChange={(o) => !o && setSelectedOrder(null)}>
        <DialogContent className="sm:max-w-[700px] p-0 border-none shadow-2xl rounded-2xl bg-zinc-50 overflow-hidden flex flex-col max-h-[90vh]">
          
          <DialogHeader className="bg-white p-6 border-b border-zinc-200 shrink-0">
            <div className="flex justify-between items-start">
              <div>
                <DialogTitle className="text-xl font-black text-zinc-900 tracking-tight flex items-center gap-2">
                  <Package className="w-5 h-5 text-indigo-600" /> Route Online Order
                </DialogTitle>
                <DialogDescription className="text-xs font-medium text-zinc-500 mt-1">
                  Order <strong className="font-mono text-zinc-800">{selectedOrder?.order_number}</strong>
                </DialogDescription>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 block mb-1">Target Master SKU</span>
                <span className="font-mono text-sm font-black text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-1 rounded">
                  {selectedOrder?.items?.[0]?.product?.sku_reference}
                </span>
              </div>
            </div>
          </DialogHeader>

          <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-6">
            
            {/* DISTANCE ENGINE RESULT */}
            <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-4 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-indigo-400 mb-1 flex items-center gap-1.5"><MapPin className="w-3 h-3"/> Logistics Engine</p>
                <p className="text-sm font-bold text-indigo-900">
                  Customer Pincode: <span className="font-mono">{selectedOrder?.shipping_address?.pincode}</span>
                </p>
                {nearestWarehouse ? (
                  <p className="text-xs font-medium text-indigo-700 mt-1">
                    Nearest Branch: <strong>{nearestWarehouse.warehouse.name}</strong> ({nearestWarehouse.local_transit_days} Day Transit)
                  </p>
                ) : (
                  <p className="text-xs font-medium text-amber-600 mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" /> Pincode not mapped to a local branch.
                  </p>
                )}
              </div>
            </div>

            {/* LIVE PHYSICAL STOCK (TRIAD ARCHITECTURE) */}
            <div className="space-y-3">
              <div className="flex justify-between items-end">
                <Label className="text-[11px] font-black text-zinc-600 uppercase tracking-widest">Live Physical Stock Match</Label>
                
                {/* THE HUMAN FALLBACK */}
                <div className="flex items-center gap-1">
                  <Input 
                    placeholder="Legacy Tag Search..." 
                    className="h-8 text-[10px] bg-white border-zinc-200 w-[140px]"
                    value={legacySearch}
                    onChange={(e) => setLegacySearch(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && executeLegacySearch()}
                  />
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
                          <TableRow key={stock.id} className={`${isNearest ? 'bg-indigo-50/30' : ''}`}>
                            <TableCell className="py-2">
                              <span className="text-xs font-bold text-zinc-800 flex items-center gap-1.5">
                                <Store className="w-3.5 h-3.5 text-zinc-400" /> {stock.warehouse?.name}
                              </span>
                              {isNearest && <span className="text-[9px] font-black text-indigo-600 uppercase tracking-widest mt-0.5 block">Recommended</span>}
                            </TableCell>
                            <TableCell className="py-2 font-mono text-xs font-bold text-zinc-600">{stock.barcode}</TableCell>
                            <TableCell className="py-2 text-right text-xs font-medium text-zinc-600">{stock.net_weight_g}g</TableCell>
                            <TableCell className="py-2 text-right">
                              <Button 
                                size="sm" 
                                className="h-7 text-[10px] font-bold uppercase tracking-widest bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
                                disabled={isExecuting}
                                onClick={() => fulfillFromStock(stock.id, stock.warehouse?.id, nearestWarehouse?.local_transit_days || 4)}
                              >
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

            {/* MANUFACTURING ROUTE */}
            <div className="flex items-center justify-between bg-zinc-50 border border-zinc-200 p-4 rounded-xl">
              <div>
                <p className="text-sm font-bold text-zinc-800">Route to Manufacturing</p>
                <p className="text-[11px] font-medium text-zinc-500 mt-0.5">Push to Custom Orders & Karigar Job Bags queue.</p>
                <p className="text-[10px] font-bold uppercase tracking-widest text-amber-600 mt-1">
                  Buffer: {selectedOrder?.items?.[0]?.product?.manufacturing_buffer_days || 14} Days
                </p>
              </div>
              <Button 
                variant="outline" 
                className="h-10 border-zinc-300 text-zinc-800 font-bold text-xs uppercase tracking-widest hover:bg-amber-50 hover:text-amber-700 hover:border-amber-200 transition-colors shadow-sm"
                disabled={isExecuting}
                onClick={routeToManufacturing}
              >
                <Hammer className="w-4 h-4 mr-2" />
                Make to Order
              </Button>
            </div>

          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}