"use client";

import React, { useState } from "react";
import { 
  Plus, X, RefreshCw, Maximize2, Minimize2, 
  BarChart3, PieChart, TrendingUp, LayoutDashboard, ArrowRightLeft, Trophy, BookOpen,
  Hammer, Ticket, Package, Landmark, Truck, AlertTriangle, CheckCircle2, Printer,
  Clock, PackageSearch, AlertCircle, Send, Hourglass, LayoutList, Diamond, Gem, Target, Gift, PackageOpen, Box,
  Layers, ArrowLeftRight, Briefcase, Scissors, CalendarHeart, PhoneCall, Wallet, ShieldCheck, Users, GripHorizontal,
  Wrench,
  RefreshCcw,
  FileText,
  Bike,
  History as HistoryIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { SalesSummaryWidget } from "./components/reports/SalesSummaryWidget";
import { CustomOrdersWidget } from "./components/reports/CustomOrdersWidget";
import { BuybacksWidget } from "./components/reports/BuybacksWidget";
import { BranchRankingsWidget } from "./components/reports/BranchRankingsWidget";
import { DailyCashbookWidget } from "./components/reports/DailyCashbookWidget";
import { VouchersStockWidget } from "./components/reports/VouchersStockWidget";
import { 
  VoucherSalesBookedWidget, VoucherUnderPrintingWidget, VoucherPaymentPendingWidget, 
  VoucherDeliveryPendingWidget, VoucherBookingsWidget, VoucherExpiredWidget, 
  VoucherRedeemedWidget, VoucherNotRedeemedWidget, VoucherInStockWidget, 
  VoucherPaymentReceivedWidget 
} from "./components/reports/VoucherWidgets";
import { 
  InvInStockWidget, InvDeadStockWidget, InvFastMovingWidget, InvBranchRestocksWidget,
  InvDispatchedStoresWidget, InvPendingStoresWidget, InvKaratWiseWidget, InvDiamondWiseWidget,
  InvSolitaireWidget, InvPriceBucketsWidget, InvGiftingStockWidget, InvGiftingConsumptionWidget,
  InvPackagingStockWidget, InvPackagingConsumptionWidget
} from "./components/reports/InventoryWidgets";
import { 
  ProdActiveJobBagsWidget, ProdKarigarPerformanceWidget, ProdGoldConsumptionWidget, 
  ProdDiamondConsumptionWidget, ProdStockTransfersOutWidget, ProdStockTransfersInWidget 
} from "./components/reports/ProductionWidgets";
import { 
  CrmCustomerBaseWidget, CrmUpcomingEventsWidget, CrmFollowupsDueWidget, 
  CrmWalletBalancesWidget, CrmKittyPlansWidget, CrmGiftingHistoryWidget, 
  CrmWhatsAppSequencesWidget 
} from "./components/reports/CrmWidgets";

import { 
  OpsExchangesWidget, OpsDeliveryAgentsWidget, OpsEstimatesWidget, 
  OpsInventoryAuditWidget, OpsRepairTicketsWidget 
} from "./components/reports/OperationalWidgets";

// ============================================================================
// 1. REGISTRY: Categorized for the Add Module Menu
// ============================================================================
type ReportModule = {
  id: string;
  name: string;
  icon: React.ElementType; 
  defaultSpan: string;
};

const REPORT_CATEGORIES: Record<string, ReportModule[]> = {
  "Finance & Operations": [
    { id: "sales_summary", name: "Daily Sales Summary", icon: TrendingUp, defaultSpan: "col-span-1" },
    { id: "custom_orders", name: "Custom Orders Pipeline", icon: Hammer, defaultSpan: "col-span-1 md:col-span-2 lg:col-span-2" },
    { id: "buybacks", name: "Returns & Intake Ledger", icon: ArrowRightLeft, defaultSpan: "col-span-1 md:col-span-2 lg:col-span-2" },
    { id: "branch_rankings", name: "Branch Rankings", icon: Trophy, defaultSpan: "col-span-1" },
    { id: "daily_cashbook", name: "Daily Cashbook Logs", icon: BookOpen, defaultSpan: "col-span-1 md:col-span-2 lg:col-span-2" },
    { id: "ops_exchanges", name: "Exchanges & Trade-Ins", icon: RefreshCcw, defaultSpan: "col-span-1 md:col-span-2 lg:col-span-2" },
    { id: "ops_estimates", name: "Estimates & Quotes", icon: FileText, defaultSpan: "col-span-1 md:col-span-2 lg:col-span-2" },
  ],
  "Voucher Circulation": [
    { id: "voucher_stock", name: "Voucher Summary", icon: Ticket, defaultSpan: "col-span-1" },
    { id: "v_sales_booked", name: "Sales Booked", icon: Ticket, defaultSpan: "col-span-1" },
    { id: "v_under_printing", name: "Under Printing", icon: Printer, defaultSpan: "col-span-1" },
    { id: "v_payment_pending", name: "Dist. Payment Pending", icon: Clock, defaultSpan: "col-span-1" },
    { id: "v_delivery_pending", name: "Dist. Delivery Pending", icon: Truck, defaultSpan: "col-span-1" },
    { id: "v_bookings", name: "Bookings & Fulfillments", icon: BookOpen, defaultSpan: "col-span-1" },
    { id: "v_expired", name: "Expired Vouchers", icon: AlertTriangle, defaultSpan: "col-span-1" },
    { id: "v_redeemed", name: "Redeemed Vouchers", icon: CheckCircle2, defaultSpan: "col-span-1" },
    { id: "v_not_redeemed", name: "Active / Not Redeemed", icon: Ticket, defaultSpan: "col-span-1" },
    { id: "v_in_stock", name: "In Stock (Vault)", icon: Package, defaultSpan: "col-span-1" },
    { id: "v_payment_received", name: "Dist. Payments Received", icon: Landmark, defaultSpan: "col-span-1" },
    { id: "ops_delivery_agents", name: "Delivery Agents Tracking", icon: Bike, defaultSpan: "col-span-1 md:col-span-2 lg:col-span-2" },
  ],
  "Inventory & Stock": [
    { id: "inv_in_stock", name: "Realtime Inventory", icon: PackageSearch, defaultSpan: "col-span-1 md:col-span-2 lg:col-span-2" },
    { id: "inv_dead_stock", name: "Dead Stock (>180 Days)", icon: AlertCircle, defaultSpan: "col-span-1" },
    { id: "inv_fast_moving", name: "Fast Moving (Age)", icon: Clock, defaultSpan: "col-span-1" },
    { id: "inv_branch_restocks", name: "Store Restock Orders", icon: Box, defaultSpan: "col-span-1" },
    { id: "inv_dispatched_stores", name: "Dispatched to Stores", icon: Send, defaultSpan: "col-span-1" },
    { id: "inv_pending_stores", name: "Pending to Stores", icon: Hourglass, defaultSpan: "col-span-1" },
    { id: "inv_karat_wise", name: "Karat Wise Breakdown", icon: LayoutList, defaultSpan: "col-span-1" },
    { id: "inv_diamond_wise", name: "Diamond Spec Breakdown", icon: Diamond, defaultSpan: "col-span-1" },
    { id: "inv_solitaire", name: "Solitaire Inventory", icon: Gem, defaultSpan: "col-span-1" },
    { id: "inv_price_buckets", name: "Price Bracket Matrix", icon: Target, defaultSpan: "col-span-1" },
    { id: "inv_gifting_stock", name: "Gifting Stock", icon: Gift, defaultSpan: "col-span-1" },
    { id: "inv_gifting_consumption", name: "Gifting Consumption", icon: Gift, defaultSpan: "col-span-1" },
    { id: "inv_packaging_stock", name: "Packaging Stock", icon: PackageOpen, defaultSpan: "col-span-1" },
    { id: "inv_packaging_consumption", name: "Packaging Consumption", icon: PackageOpen, defaultSpan: "col-span-1" },
    { id: "ops_inventory_audit", name: "Raw Material Audit Logs", icon: HistoryIcon, defaultSpan: "col-span-1 md:col-span-2 lg:col-span-2" },
  ],
  "Production & Logistics": [
    { id: "prod_job_bags", name: "Active Job Bags Tracker", icon: Briefcase, defaultSpan: "col-span-1 md:col-span-2 lg:col-span-2" },
    { id: "prod_karigar_perf", name: "Karigar Performance", icon: Scissors, defaultSpan: "col-span-1" },
    { id: "prod_gold_consume", name: "Gold Consumption", icon: Layers, defaultSpan: "col-span-1 md:col-span-2 lg:col-span-2" },
    { id: "prod_dia_consume", name: "Diamond Consumption", icon: Diamond, defaultSpan: "col-span-1 md:col-span-2 lg:col-span-2" },
    { id: "prod_transfer_out", name: "Transfers (Outbound)", icon: Truck, defaultSpan: "col-span-1 md:col-span-2 lg:col-span-2" },
    { id: "prod_transfer_in", name: "Transfers (Inbound)", icon: ArrowLeftRight, defaultSpan: "col-span-1 md:col-span-2 lg:col-span-2" },
    { id: "ops_repair_tickets", name: "Repair & Service Tickets", icon: Wrench, defaultSpan: "col-span-1 md:col-span-2 lg:col-span-2" },
  ],
  "CRM & Loyalty": [
    { id: "crm_customer_base", name: "Customer Base & Status", icon: Users, defaultSpan: "col-span-1 md:col-span-2 lg:col-span-2" },
    { id: "crm_upcoming_events", name: "Upcoming Birthdays", icon: CalendarHeart, defaultSpan: "col-span-1" },
    { id: "crm_followups_due", name: "Follow-ups Due", icon: PhoneCall, defaultSpan: "col-span-1" },
    { id: "crm_wallet_balances", name: "Store Credit Liability", icon: Wallet, defaultSpan: "col-span-1" },
    { id: "crm_kitty_plans", name: "Active Kitty Plans", icon: ShieldCheck, defaultSpan: "col-span-1 md:col-span-2 lg:col-span-2" },
    { id: "crm_gifting_history", name: "Gifting History", icon: Gift, defaultSpan: "col-span-1" },
    { id: "crm_wa_sequences", name: "WhatsApp Auto-Sequences", icon: Send, defaultSpan: "col-span-1 md:col-span-2 lg:col-span-2" },
  ]
};

// Flatten for quick lookups
const FLAT_REGISTRY = Object.values(REPORT_CATEGORIES).flat();

interface WidgetConfig {
  instanceId: string;
  typeId: string;
  isExpanded: boolean;
}

// ============================================================================
// 2. THE STANDARD WRAPPER
// ============================================================================
const ReportWrapper = ({ 
  widget, 
  onRemove, 
  onToggleExpand,
  onDragStart,
  onDragEnter,
  onDragEnd,
  isDragging
}: { 
  widget: WidgetConfig; 
  onRemove: (id: string) => void;
  onToggleExpand: (id: string) => void;
  onDragStart: (e: React.DragEvent<HTMLDivElement>, id: string) => void;
  onDragEnter: (e: React.DragEvent<HTMLDivElement>, id: string) => void;
  onDragEnd: (e: React.DragEvent<HTMLDivElement>) => void;
  isDragging: boolean;
}) => {

  const [isRefreshing, setIsRefreshing] = useState(false);
  const reportDef = FLAT_REGISTRY.find(r => r.id === widget.typeId);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  if (!reportDef) return null;
  const Icon = reportDef.icon;

  return (
    <Card 
      draggable
      onDragStart={(e) => onDragStart(e, widget.instanceId)}
      onDragEnter={(e) => onDragEnter(e, widget.instanceId)}
      onDragEnd={onDragEnd}
      onDragOver={(e) => e.preventDefault()}
      className={`flex flex-col bg-white border-zinc-200 shadow-sm transition-all duration-300 ease-in-out ${widget.isExpanded ? 'col-span-1 md:col-span-2 lg:col-span-3 row-span-2 z-10' : reportDef.defaultSpan} ${isDragging ? 'opacity-40 scale-95 border-indigo-400 border-dashed' : 'opacity-100 hover:shadow-md'}`}
    >
      <CardHeader className="flex flex-row items-center justify-between p-2 sm:p-3 border-b border-zinc-100 bg-zinc-50/80 cursor-grab active:cursor-grabbing group">
        <div className="flex items-center gap-2">
          <GripHorizontal className="w-4 h-4 text-zinc-300 group-hover:text-zinc-500 transition-colors hidden sm:block" />
          <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-md">
            <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </div>
          <CardTitle className="text-xs sm:text-sm font-bold text-zinc-800 tracking-tight select-none">
            {reportDef.name}
          </CardTitle>
        </div>
        
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-6 w-6 sm:h-7 sm:w-7 text-zinc-400 hover:text-indigo-600" onClick={handleRefresh}>
            <RefreshCw className={`w-3 h-3 sm:w-3.5 sm:h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6 sm:h-7 sm:w-7 text-zinc-400 hover:text-zinc-900 hidden sm:flex" onClick={() => onToggleExpand(widget.instanceId)}>
            {widget.isExpanded ? <Minimize2 className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> : <Maximize2 className="w-3 h-3 sm:w-3.5 sm:h-3.5" />}
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6 sm:h-7 sm:w-7 text-zinc-400 hover:text-rose-600 hover:bg-rose-50" onClick={() => onRemove(widget.instanceId)}>
            <X className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="p-2 sm:p-4 flex-1 min-h-[250px] flex flex-col bg-zinc-50/10 relative overflow-hidden">
        {widget.typeId === "sales_summary" && <SalesSummaryWidget />}
        {widget.typeId === "custom_orders" && <CustomOrdersWidget />}
        {widget.typeId === "buybacks" && <BuybacksWidget />}
        {widget.typeId === "branch_rankings" && <BranchRankingsWidget />}
        {widget.typeId === "daily_cashbook" && <DailyCashbookWidget />}
        {widget.typeId === "voucher_stock" && <VouchersStockWidget />}
        
        {/* Voucher Suite */}
        {widget.typeId === "v_sales_booked" && <VoucherSalesBookedWidget />}
        {widget.typeId === "v_under_printing" && <VoucherUnderPrintingWidget />}
        {widget.typeId === "v_payment_pending" && <VoucherPaymentPendingWidget />}
        {widget.typeId === "v_delivery_pending" && <VoucherDeliveryPendingWidget />}
        {widget.typeId === "v_bookings" && <VoucherBookingsWidget />}
        {widget.typeId === "v_expired" && <VoucherExpiredWidget />}
        {widget.typeId === "v_redeemed" && <VoucherRedeemedWidget />}
        {widget.typeId === "v_not_redeemed" && <VoucherNotRedeemedWidget />}
        {widget.typeId === "v_in_stock" && <VoucherInStockWidget />}
        {widget.typeId === "v_payment_received" && <VoucherPaymentReceivedWidget />}

        {/* Inventory Suite */}
        {widget.typeId === "inv_in_stock" && <InvInStockWidget />}
        {widget.typeId === "inv_dead_stock" && <InvDeadStockWidget />}
        {widget.typeId === "inv_fast_moving" && <InvFastMovingWidget />}
        {widget.typeId === "inv_branch_restocks" && <InvBranchRestocksWidget />}
        {widget.typeId === "inv_dispatched_stores" && <InvDispatchedStoresWidget />}
        {widget.typeId === "inv_pending_stores" && <InvPendingStoresWidget />}
        {widget.typeId === "inv_karat_wise" && <InvKaratWiseWidget />}
        {widget.typeId === "inv_diamond_wise" && <InvDiamondWiseWidget />}
        {widget.typeId === "inv_solitaire" && <InvSolitaireWidget />}
        {widget.typeId === "inv_price_buckets" && <InvPriceBucketsWidget />}
        {widget.typeId === "inv_gifting_stock" && <InvGiftingStockWidget />}
        {widget.typeId === "inv_gifting_consumption" && <InvGiftingConsumptionWidget />}
        {widget.typeId === "inv_packaging_stock" && <InvPackagingStockWidget />}
        {widget.typeId === "inv_packaging_consumption" && <InvPackagingConsumptionWidget />}

        {/* Production Suite */}
        {widget.typeId === "prod_job_bags" && <ProdActiveJobBagsWidget />}
        {widget.typeId === "prod_karigar_perf" && <ProdKarigarPerformanceWidget />}
        {widget.typeId === "prod_gold_consume" && <ProdGoldConsumptionWidget />}
        {widget.typeId === "prod_dia_consume" && <ProdDiamondConsumptionWidget />}
        {widget.typeId === "prod_transfer_out" && <ProdStockTransfersOutWidget />}
        {widget.typeId === "prod_transfer_in" && <ProdStockTransfersInWidget />}

        {/* CRM Suite */}
        {widget.typeId === "crm_customer_base" && <CrmCustomerBaseWidget />}
        {widget.typeId === "crm_upcoming_events" && <CrmUpcomingEventsWidget />}
        {widget.typeId === "crm_followups_due" && <CrmFollowupsDueWidget />}
        {widget.typeId === "crm_wallet_balances" && <CrmWalletBalancesWidget />}
        {widget.typeId === "crm_kitty_plans" && <CrmKittyPlansWidget />}
        {widget.typeId === "crm_gifting_history" && <CrmGiftingHistoryWidget />}
        {widget.typeId === "crm_wa_sequences" && <CrmWhatsAppSequencesWidget />}

        {/* Operational / Misc Suite */}
        {widget.typeId === "ops_exchanges" && <OpsExchangesWidget />}
        {widget.typeId === "ops_delivery_agents" && <OpsDeliveryAgentsWidget />}
        {widget.typeId === "ops_estimates" && <OpsEstimatesWidget />}
        {widget.typeId === "ops_inventory_audit" && <OpsInventoryAuditWidget />}
        {widget.typeId === "ops_repair_tickets" && <OpsRepairTicketsWidget />}
      </CardContent>
    </Card>
  );
};

// ============================================================================
// 3. MAIN DASHBOARD PAGE
// ============================================================================
export default function ModularReportsDashboard() {
  const [activeWidgets, setActiveWidgets] = useState<WidgetConfig[]>([
    { instanceId: `inst-${Date.now()}-1`, typeId: "sales_summary", isExpanded: false },
    { instanceId: `inst-${Date.now()}-2`, typeId: "custom_orders", isExpanded: false }
  ]);

  // Drag and Drop State
  const [draggedWidgetId, setDraggedWidgetId] = useState<string | null>(null);

  const addWidget = (typeId: string) => {
    const newWidget: WidgetConfig = {
      instanceId: `inst-${Date.now()}`, 
      typeId,
      isExpanded: false
    };
    setActiveWidgets(prev => [newWidget, ...prev]);
  };

  const removeWidget = (instanceId: string) => {
    setActiveWidgets(prev => prev.filter(w => w.instanceId !== instanceId));
  };

  const toggleExpand = (instanceId: string) => {
    setActiveWidgets(prev => prev.map(w => 
      w.instanceId === instanceId ? { ...w, isExpanded: !w.isExpanded } : w
    ));
  };

  // Drag Handlers
  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, id: string) => {
    setDraggedWidgetId(id);
    e.dataTransfer.effectAllowed = "move";
    
    const target = e.currentTarget;
    setTimeout(() => { target.classList.add('opacity-40'); }, 0);
  };

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>, targetId: string) => {
    e.preventDefault();
    if (!draggedWidgetId || draggedWidgetId === targetId) return;

    setActiveWidgets(prev => {
      const draggedIndex = prev.findIndex(w => w.instanceId === draggedWidgetId);
      const targetIndex = prev.findIndex(w => w.instanceId === targetId);
      const newWidgets = [...prev];
      const draggedItem = newWidgets[draggedIndex];
      
      newWidgets.splice(draggedIndex, 1);
      newWidgets.splice(targetIndex, 0, draggedItem);
      return newWidgets;
    });
  };

  const handleDragEnd = (e: React.DragEvent<HTMLDivElement>) => {
    setDraggedWidgetId(null);
    
    const target = e.currentTarget;
    target.classList.remove('opacity-40');
  };

  // Shared Add Button Menu to keep code DRY
  const ModuleMenuContent = () => (
    <DropdownMenuContent align="end" className="w-72 rounded-xl border-zinc-200 shadow-2xl max-h-[70vh] overflow-y-auto custom-scrollbar p-0">
      {Object.entries(REPORT_CATEGORIES).map(([category, reports]) => (
        <div key={category} className="pb-1">
          <div className="sticky top-0 bg-zinc-100/95 backdrop-blur-sm z-10 px-3 py-2 border-b border-zinc-200/60 shadow-sm">
            <span className="text-[10px] uppercase tracking-widest font-black text-zinc-500">{category}</span>
          </div>
          <div className="p-1">
            {reports.map(report => {
              const Icon = report.icon;
              return (
                <DropdownMenuItem key={report.id} onClick={() => addWidget(report.id)} className="cursor-pointer py-2.5 px-3 font-semibold text-xs text-zinc-700 hover:bg-indigo-50 focus:bg-indigo-50 hover:text-indigo-700 rounded-lg mx-1 transition-colors">
                  <Icon className="w-3.5 h-3.5 mr-2.5 text-zinc-400" /> {report.name}
                </DropdownMenuItem>
              )
            })}
          </div>
        </div>
      ))}
    </DropdownMenuContent>
  );

  return (
    <div className="flex flex-col min-h-screen bg-zinc-100/50 font-sans pb-20 sm:pb-8 w-full max-w-[100vw] overflow-x-hidden">
      
      <header className="sticky top-0 z-40 w-full bg-white/80 backdrop-blur-xl border-b border-zinc-200 px-4 h-14 flex items-center justify-between shadow-[0_2px_10px_rgba(0,0,0,0.02)]">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-indigo-600 flex items-center justify-center shadow-inner">
            <LayoutDashboard className="h-4 w-4 text-white" />
          </div>
          <nav className="flex items-center gap-1.5 text-sm font-medium">
            <span className="font-bold text-zinc-900 tracking-tight hidden sm:block">Intelligence Workspace</span>
            <span className="font-bold text-zinc-900 tracking-tight sm:hidden">Workspace</span>
          </nav>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" className="h-8 sm:h-9 bg-zinc-900 text-white hover:bg-zinc-800 rounded-full font-semibold px-4 shadow-md transition-transform active:scale-95 hidden sm:flex">
              <Plus className="w-4 h-4 mr-1.5" /> Add Module
            </Button>
          </DropdownMenuTrigger>
          <ModuleMenuContent />
        </DropdownMenu>
      </header>

      <main className="p-3 sm:p-6 md:p-8 max-w-[2000px] w-full mx-auto animate-in fade-in duration-500">
        {activeWidgets.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
            <div className="w-16 h-16 bg-zinc-100 rounded-full flex items-center justify-center mb-4 border border-zinc-200 shadow-inner">
              <LayoutDashboard className="w-6 h-6 text-zinc-400" />
            </div>
            <h2 className="text-lg font-black text-zinc-900 tracking-tight">Your workspace is empty</h2>
            <p className="text-xs font-medium text-zinc-500 mt-1.5 max-w-sm mb-6">Build your custom intelligence dashboard by adding modules from the registry.</p>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-full font-bold shadow-md px-6 transition-transform active:scale-95">
                  <Plus className="w-4 h-4 mr-2" /> Add Your First Report
                </Button>
              </DropdownMenuTrigger>
              <ModuleMenuContent />
            </DropdownMenu>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6 auto-rows-max">
            {activeWidgets.map(widget => (
              <ReportWrapper 
                key={widget.instanceId} 
                widget={widget} 
                onRemove={removeWidget} 
                onToggleExpand={toggleExpand}
                onDragStart={handleDragStart}
                onDragEnter={handleDragEnter}
                onDragEnd={handleDragEnd}
                isDragging={draggedWidgetId === widget.instanceId}
              />
            ))}
          </div>
        )}
      </main>

      {/* MOBILE FLOATING ACTION BUTTON */}
      <div className="sm:hidden fixed bottom-20 right-4 z-50">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon" className="h-14 w-14 rounded-full bg-zinc-900 text-white shadow-[0_8px_30px_rgb(0,0,0,0.2)] border-2 border-white transition-transform active:scale-90">
              <Plus className="w-6 h-6" />
            </Button>
          </DropdownMenuTrigger>
          <ModuleMenuContent />
        </DropdownMenu>
      </div>

    </div>
  );
}