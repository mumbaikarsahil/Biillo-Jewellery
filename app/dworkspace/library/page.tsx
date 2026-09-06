"use client";

import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";
import { Loader2, Calendar, Filter, Database, Download } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

// 1. Standalone Finance & Sales Widgets
import { SalesSummaryWidget } from "../components/reports/SalesSummaryWidget";
import { BranchRankingsWidget } from "../components/reports/BranchRankingsWidget";
import { CustomOrdersWidget } from "../components/reports/CustomOrdersWidget";
import { DailyCashbookWidget } from "../components/reports/DailyCashbookWidget";
import { BuybacksWidget } from "../components/reports/BuybacksWidget";

// 2. Inventory Widgets
import { 
  InvInStockWidget, InvDeadStockWidget, InvFastMovingWidget, 
  InvBranchRestocksWidget, InvDispatchedStoresWidget, InvPendingStoresWidget, 
  InvKaratWiseWidget, InvDiamondWiseWidget, InvSolitaireWidget, 
  InvPriceBucketsWidget, InvGiftingStockWidget, InvGiftingConsumptionWidget, 
  InvPackagingStockWidget, InvPackagingConsumptionWidget 
} from "../components/reports/InventoryWidgets";

// 3. CRM Widgets
import { 
  CrmCustomerBaseWidget, CrmUpcomingEventsWidget, CrmFollowupsDueWidget, 
  CrmWalletBalancesWidget, CrmKittyPlansWidget, CrmGiftingHistoryWidget, 
  CrmWhatsAppSequencesWidget 
} from "../components/reports/CrmWidgets";

// 4. Voucher Widgets
import { 
  VoucherSalesBookedWidget, VoucherUnderPrintingWidget, VoucherPaymentPendingWidget, 
  VoucherDeliveryPendingWidget, VoucherBookingsWidget, VoucherExpiredWidget, 
  VoucherRedeemedWidget, VoucherNotRedeemedWidget, VoucherInStockWidget, 
  VoucherPaymentReceivedWidget 
} from "../components/reports/VoucherWidgets";

// 5. Operational Widgets
import { 
  OpsExchangesWidget, OpsDeliveryAgentsWidget, OpsEstimatesWidget, 
  OpsInventoryAuditWidget, OpsRepairTicketsWidget 
} from "../components/reports/OperationalWidgets";

// 6. Production Widgets
import { 
  ProdActiveJobBagsWidget, ProdKarigarPerformanceWidget, ProdGoldConsumptionWidget, 
  ProdDiamondConsumptionWidget, ProdStockTransfersOutWidget, ProdStockTransfersInWidget 
} from "../components/reports/ProductionWidgets";


export default function ReportLibraryPage() {
  const { appUser } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [snapshots, setSnapshots] = useState<any[]>([]);
  
  // Filters
  const [frequencyFilter, setFrequencyFilter] = useState("daily");
  const [dateFilter, setDateFilter] = useState<string>("");
  const [availableDates, setAvailableDates] = useState<string[]>([]);

  // Fetch the headers/metadata first to build the date menu
  useEffect(() => {
    if (!appUser?.company_id) return;

    const loadLibraryIndex = async () => {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('report_snapshots')
        .select('id, report_type, frequency, period_start, period_end, summary_metrics')
        .eq('company_id', appUser.company_id)
        .eq('frequency', frequencyFilter)
        .order('period_start', { ascending: false });

      if (data) {
        const uniqueDates = Array.from(new Set(data.map(d => d.period_start.split('T')[0])));
        setAvailableDates(uniqueDates as string[]);
        if (uniqueDates.length > 0 && !dateFilter) setDateFilter(uniqueDates[0] as string);
      }
      setIsLoading(false);
    };

    loadLibraryIndex();
  }, [appUser, frequencyFilter]);

  // When a specific date is selected, fetch the heavy JSON raw_data array
  useEffect(() => {
    if (!appUser?.company_id || !dateFilter) return;

    const loadSnapshotData = async () => {
      setIsLoading(true);
      const { data } = await supabase
        .from('report_snapshots')
        .select('*')
        .eq('company_id', appUser.company_id)
        .eq('frequency', frequencyFilter)
        .gte('period_start', `${dateFilter}T00:00:00Z`)
        .lte('period_start', `${dateFilter}T23:59:59Z`);

      setSnapshots(data || []);
      setIsLoading(false);
    };

    loadSnapshotData();
  }, [appUser, frequencyFilter, dateFilter]);

  const getRawData = (reportType: string) => {
    const snap = snapshots.find(s => s.report_type === reportType);
    return snap?.raw_data || null;
  };

  const handleExportJson = () => {
    const dataStr = JSON.stringify(snapshots, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Biillo_Backup_${frequencyFilter}_${dateFilter}.json`;
    a.click();
  };

  return (
    <div className="flex flex-col min-h-screen bg-zinc-50 font-sans pb-20 w-full">
      <header className="sticky top-0 z-40 w-full bg-white/80 backdrop-blur-xl border-b border-zinc-200 px-6 h-16 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-zinc-900 flex items-center justify-center shadow-inner">
            <Database className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="font-black text-zinc-900 tracking-tight text-lg leading-tight">Report Library</h1>
            <p className="text-[11px] font-bold text-zinc-500 uppercase tracking-widest">Immutable JSON Archives</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={handleExportJson} className="hidden sm:flex font-bold text-zinc-600 border-zinc-300">
            <Download className="w-4 h-4 mr-2" /> Export Raw JSON
          </Button>
        </div>
      </header>

      <main className="p-6 max-w-7xl mx-auto w-full flex-1 flex flex-col gap-6">
        
        {/* Filter Bar */}
        <div className="bg-white p-4 rounded-xl border border-zinc-200 shadow-sm flex flex-wrap gap-4 items-end">
          <div className="space-y-1.5 flex-1 min-w-[200px]">
            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-1.5"><Filter className="w-3 h-3"/> Snapshot Frequency</label>
            <Select value={frequencyFilter} onValueChange={setFrequencyFilter}>
              <SelectTrigger className="font-bold border-zinc-300 shadow-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily End-of-Day Snapshots</SelectItem>
                <SelectItem value="weekly">Weekly Roll-ups</SelectItem>
                <SelectItem value="monthly">Monthly Audits</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5 flex-1 min-w-[200px]">
            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-1.5"><Calendar className="w-3 h-3"/> Snapshot Date</label>
            <Select value={dateFilter} onValueChange={setDateFilter} disabled={availableDates.length === 0}>
              <SelectTrigger className="font-bold border-zinc-300 shadow-sm">
                <SelectValue placeholder={availableDates.length === 0 ? "No archives found" : "Select date..."} />
              </SelectTrigger>
              <SelectContent>
                {availableDates.map(date => (
                  <SelectItem key={date} value={date}>{format(new Date(date), 'EEEE, MMMM do, yyyy')}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Content Area */}
        {isLoading ? (
          <div className="flex-1 flex flex-col items-center justify-center text-zinc-400 py-20">
            <Loader2 className="w-8 h-8 animate-spin mb-4" />
            <span className="text-xs font-bold uppercase tracking-widest">Retrieving Immutable Records...</span>
          </div>
        ) : snapshots.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center py-20 text-center bg-white rounded-xl border border-zinc-200 border-dashed">
            <Database className="w-12 h-12 text-zinc-300 mb-4" />
            <h2 className="text-xl font-black text-zinc-800">No Archives Found</h2>
            <p className="text-sm font-medium text-zinc-500 mt-2 max-w-md">There are no scheduled {frequencyFilter} JSON snapshots for the selected parameters.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 animate-in fade-in duration-500">
            
            {/* === 1. FINANCE & SALES === */}
            {getRawData('sales_summary') && <div className="h-[450px]"><SalesSummaryWidget overrideData={getRawData('sales_summary')} /></div>}
            {getRawData('branch_rankings') && <div className="h-[450px]"><BranchRankingsWidget overrideData={getRawData('branch_rankings')} /></div>}
            {getRawData('custom_orders') && <div className="h-[450px]"><CustomOrdersWidget overrideData={getRawData('custom_orders')} /></div>}
            {getRawData('daily_cashbook') && <div className="h-[450px]"><DailyCashbookWidget overrideData={getRawData('daily_cashbook')} /></div>}
            {getRawData('buybacks') && <div className="h-[450px]"><BuybacksWidget overrideData={getRawData('buybacks')} /></div>}

            {/* === 2. INVENTORY === */}
            {getRawData('in_stock') && <div className="h-[450px]"><InvInStockWidget overrideData={getRawData('in_stock')} /></div>}
            {getRawData('dead_stock') && <div className="h-[450px]"><InvDeadStockWidget overrideData={getRawData('dead_stock')} /></div>}
            {getRawData('solitaire') && <div className="h-[450px]"><InvSolitaireWidget overrideData={getRawData('solitaire')} /></div>}
            {getRawData('fast_moving') && <div className="h-[450px]"><InvFastMovingWidget overrideData={getRawData('fast_moving')} /></div>}
            {getRawData('branch_restocks') && <div className="h-[450px]"><InvBranchRestocksWidget overrideData={getRawData('branch_restocks')} /></div>}
            {getRawData('karat_wise') && <div className="h-[450px]"><InvKaratWiseWidget overrideData={getRawData('karat_wise')} /></div>}
            {getRawData('diamond_wise') && <div className="h-[450px]"><InvDiamondWiseWidget overrideData={getRawData('diamond_wise')} /></div>}
            {getRawData('price_buckets') && <div className="h-[450px]"><InvPriceBucketsWidget overrideData={getRawData('price_buckets')} /></div>}
            {getRawData('gifting_stock') && <div className="h-[450px]"><InvGiftingStockWidget overrideData={getRawData('gifting_stock')} /></div>}
            {getRawData('packaging_stock') && <div className="h-[450px]"><InvPackagingStockWidget overrideData={getRawData('packaging_stock')} /></div>}
            {getRawData('gifting_consumption') && <div className="h-[450px]"><InvGiftingConsumptionWidget overrideData={getRawData('gifting_consumption')} /></div>}
            {getRawData('packaging_consumption') && <div className="h-[450px]"><InvPackagingConsumptionWidget overrideData={getRawData('packaging_consumption')} /></div>}

            {/* === 3. CRM === */}
            {getRawData('customer_base') && <div className="h-[450px]"><CrmCustomerBaseWidget overrideData={getRawData('customer_base')} /></div>}
            {getRawData('upcoming_events') && <div className="h-[450px]"><CrmUpcomingEventsWidget overrideData={getRawData('upcoming_events')} /></div>}
            {getRawData('followups_due') && <div className="h-[450px]"><CrmFollowupsDueWidget overrideData={getRawData('followups_due')} /></div>}
            {getRawData('wallet_balances') && <div className="h-[450px]"><CrmWalletBalancesWidget overrideData={getRawData('wallet_balances')} /></div>}
            {getRawData('kitty_plans') && <div className="h-[450px]"><CrmKittyPlansWidget overrideData={getRawData('kitty_plans')} /></div>}
            {getRawData('gifting_history') && <div className="h-[450px]"><CrmGiftingHistoryWidget overrideData={getRawData('gifting_history')} /></div>}
            {getRawData('whatsapp_sequences') && <div className="h-[450px]"><CrmWhatsAppSequencesWidget overrideData={getRawData('whatsapp_sequences')} /></div>}

            {/* === 4. VOUCHERS === */}
            {getRawData('v_sales_booked') && <div className="h-[450px]"><VoucherSalesBookedWidget overrideData={getRawData('v_sales_booked')} /></div>}
            {getRawData('v_under_printing') && <div className="h-[450px]"><VoucherUnderPrintingWidget overrideData={getRawData('v_under_printing')} /></div>}
            {getRawData('v_payment_pending') && <div className="h-[450px]"><VoucherPaymentPendingWidget overrideData={getRawData('v_payment_pending')} /></div>}
            {getRawData('v_delivery_pending') && <div className="h-[450px]"><VoucherDeliveryPendingWidget overrideData={getRawData('v_delivery_pending')} /></div>}
            {getRawData('v_payment_received') && <div className="h-[450px]"><VoucherPaymentReceivedWidget overrideData={getRawData('v_payment_received')} /></div>}
            {getRawData('v_bookings') && <div className="h-[450px]"><VoucherBookingsWidget overrideData={getRawData('v_bookings')} /></div>}
            {getRawData('v_expired') && <div className="h-[450px]"><VoucherExpiredWidget overrideData={getRawData('v_expired')} /></div>}
            {getRawData('v_redeemed') && <div className="h-[450px]"><VoucherRedeemedWidget overrideData={getRawData('v_redeemed')} /></div>}
            {getRawData('v_not_redeemed') && <div className="h-[450px]"><VoucherNotRedeemedWidget overrideData={getRawData('v_not_redeemed')} /></div>}
            {getRawData('v_in_stock') && <div className="h-[450px]"><VoucherInStockWidget overrideData={getRawData('v_in_stock')} /></div>}

            {/* === 5. OPERATIONS === */}
            {getRawData('ops_exchanges') && <div className="h-[450px]"><OpsExchangesWidget overrideData={getRawData('ops_exchanges')} /></div>}
            {getRawData('ops_delivery_agents') && <div className="h-[450px]"><OpsDeliveryAgentsWidget overrideData={getRawData('ops_delivery_agents')} /></div>}
            {getRawData('ops_estimates') && <div className="h-[450px]"><OpsEstimatesWidget overrideData={getRawData('ops_estimates')} /></div>}
            {getRawData('ops_inventory_audit') && <div className="h-[450px]"><OpsInventoryAuditWidget overrideData={getRawData('ops_inventory_audit')} /></div>}
            {getRawData('ops_repair_tickets') && <div className="h-[450px]"><OpsRepairTicketsWidget overrideData={getRawData('ops_repair_tickets')} /></div>}

            {/* === 6. PRODUCTION === */}
            {getRawData('prod_active_job_bags') && <div className="h-[450px]"><ProdActiveJobBagsWidget overrideData={getRawData('prod_active_job_bags')} /></div>}
            {getRawData('prod_karigar_performance') && <div className="h-[450px]"><ProdKarigarPerformanceWidget overrideData={getRawData('prod_karigar_performance')} /></div>}
            {getRawData('prod_gold_consumption') && <div className="h-[450px]"><ProdGoldConsumptionWidget overrideData={getRawData('prod_gold_consumption')} /></div>}
            {getRawData('prod_diamond_consumption') && <div className="h-[450px]"><ProdDiamondConsumptionWidget overrideData={getRawData('prod_diamond_consumption')} /></div>}
            {getRawData('prod_transfer_out') && <div className="h-[450px]"><ProdStockTransfersOutWidget overrideData={getRawData('prod_transfer_out')} /></div>}
            {getRawData('prod_transfer_in') && <div className="h-[450px]"><ProdStockTransfersInWidget overrideData={getRawData('prod_transfer_in')} /></div>}

          </div>
        )}
      </main>
    </div>
  );
}