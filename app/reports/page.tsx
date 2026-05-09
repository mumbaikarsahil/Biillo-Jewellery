"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  BarChart3,
  LayoutDashboard,
  ChevronRight,
  Package,
  TrendingUp,
  ArrowRightLeft,
  Briefcase,
  ChevronDown,
  ShoppingCart,
  Scale,
  Activity,
  Landmark,
  FileEdit,
  Clock,
  BookOpen,
  Database,
  GitCommit,
  FileText,
  Lock
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge"; 
import { useStoreLocation } from "@/hooks/useStoreLocation"; 


// --- IMPORT OUR MASTER MODULES ---
import { OverviewDashboard } from "./components/OverviewDashboard";
import { InventoryRegistryReport } from "./components/InventoryRegistryReport";
import { SalesVelocityReport } from "./components/SalesVelocityReport";
import { TransitReconciliationReport } from "./components/TransitReconciliationReport";
import { FactoryWipReport } from './components/FactoryWipReport'
import { ProcurementLedgerReport } from './components/ProcurementLedgerReport'

// --- IMPORT NEW ENTERPRISE ACCOUNTING & COMPLIANCE MODULES ---
import { ManualJournalForm } from './components/ManualJournalForm'
import { DayBookReport } from './components/DayBookReport'
import { TrialBalanceReport } from './components/TrialBalanceReport'
import { ProfitAndLossReport } from './components/ProfitAndLossReport'
import { BalanceSheetReport } from './components/BalanceSheetReport'
import { AgingDashboard } from './components/AgingDashboard'
import { MetalAccountingReport } from './components/MetalAccountingReport'
import { MetalMovementLog } from './components/MetalMovementLog'
import { GstComplianceHub } from './components/GstComplianceHub'

const TABS_CONFIG = [
  // Operational 
  { id: "overview", label: "Overview", icon: BarChart3 },
  { id: "inventory", label: "Asset Registry", icon: Package },
  { id: "sales", label: "Sales Ledger", icon: TrendingUp },
  { id: 'procurement', label: 'Procurement', icon: ShoppingCart },
  { id: "transit", label: "Logistics", icon: ArrowRightLeft },
  { id: "wip", label: "Factory WIP", icon: Briefcase },

  // Financial & Accounting
  { id: "manual_journal", label: "Journal Entry", icon: FileEdit },
  { id: "day_book", label: "Day Book", icon: BookOpen, isComingSoon: true },
  { id: "trial_balance", label: "Trial Balance", icon: Scale, isComingSoon: true },
  { id: "profit_loss", label: "Profit & Loss", icon: Activity, isComingSoon: true },
  { id: "balance_sheet", label: "Balance Sheet", icon: Landmark, isComingSoon: true },
  { id: "aging", label: "AR/AP Aging", icon: Clock, isComingSoon: true },

  // Jewelry Specific & Compliance
  { id: "metal_ledger", label: "Metal Vault", icon: Database },
  { id: "metal_movements", label: "Metal Flow", icon: GitCommit },
  { id: "gst_hub", label: "GST Compliance", icon: FileText },
];

export default function ReportsMasterPage() {
  const { role, isHQ, selectedLocation } = useStoreLocation();
  
  const [activeTab, setActiveTab] = useState("overview");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Filter the tabs based on the role we just pulled
  const visibleTabs = TABS_CONFIG.filter((tab) => {
    if (role === 'branch_manager') {
      return tab.id === 'overview' || tab.id === 'inventory';
    }
    return true; 
  });

  // ✨ FIX: Fallback to visibleTabs instead of the master config
  const currentTab = visibleTabs.find((t) => t.id === activeTab) || visibleTabs[0];

  // Failsafe: if somehow the role isn't loaded yet and visibleTabs is empty
  if (!currentTab) return null;

  return (
    <div className="flex flex-col min-h-screen bg-muted/20 font-sans">
      {/* HEADER */}
      <header className="sticky top-0 z-30 w-full bg-background/80 backdrop-blur-md border-b border-border px-4 h-14 flex items-center justify-between shadow-sm print:hidden">
        <div className="flex items-center gap-3 overflow-hidden">
          <Link href="/dashboard">
            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-lg hover:bg-secondary transition-colors">
              <LayoutDashboard className="h-4 w-4 text-muted-foreground" />
            </Button>
          </Link>
          <Separator orientation="vertical" className="h-5 bg-border hidden sm:block" />
          <nav className="flex items-center gap-1.5 text-sm whitespace-nowrap overflow-hidden">
            <span className="text-muted-foreground font-medium hidden sm:inline-block">ERP</span>
            <ChevronRight className="h-4 w-4 text-muted-foreground/50 hidden sm:inline-block" />
            <span className="font-semibold text-foreground select-none">Intelligence Center</span>
          </nav>
        </div>
      </header>

      <main className="p-3 sm:p-6 md:p-8 max-w-[1400px] w-full mx-auto animate-in fade-in duration-500 print:p-0 print:m-0 print:w-full print:block">
        {/* Page Title Area */}
        <div className="space-y-1.5 print:hidden px-1 sm:px-0 mb-4 sm:mb-6">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground hidden sm:block">Intelligence Center</h1>
          <p className="text-xs sm:text-sm text-muted-foreground hidden sm:block">Generate comprehensive data exports, track asset lifecycles, and analyze financial health.</p>
        </div>

        {/* --- MAIN TABS WRAPPER --- */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          {/* DESKTOP VIEW: WRAPPING TABS */}
          <div className="hidden sm:block w-full pb-4 print:hidden">
            <TabsList className="bg-transparent border-none p-0 h-auto flex flex-wrap justify-start gap-2.5 pb-1">
              {/* ✨ FIX: Map over visibleTabs instead of TABS_CONFIG */}
              {visibleTabs.map((tab) => (
                <TabsTrigger
                  key={tab.id}
                  value={tab.id}
                  disabled={tab.isComingSoon}
                  className={`
                    relative rounded-full h-9 text-xs font-bold px-4 py-0 transition-all shrink-0 border
                    ${tab.isComingSoon 
                      ? "bg-secondary/40 border-dashed border-border text-muted-foreground/60 cursor-not-allowed" 
                      : "bg-secondary/60 border-border data-[state=active]:bg-foreground data-[state=active]:text-background data-[state=active]:shadow-md"
                    }
                  `}
                >
                  <tab.icon className={`w-3.5 h-3.5 mr-2 ${tab.isComingSoon ? "opacity-40" : ""}`} /> 
                  {tab.label}
                  
                  {tab.isComingSoon && (
                    <span className="absolute -top-2 -right-1 flex h-4 items-center rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 px-1.5 text-[8px] font-black uppercase tracking-tighter text-white shadow-sm ring-1 ring-white">
                      Soon
                    </span>
                  )}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          {/* MOBILE VIEW: COMPACT PILL DROPDOWN */}
          <div className="relative sm:hidden mb-4 print:hidden z-40 px-1">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="w-full h-10 bg-white border border-gray-200 shadow-sm rounded-full px-4 flex items-center justify-between active:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <currentTab.icon className="h-4 w-4 text-gray-500" />
                <span className="text-xs font-bold text-gray-800">{currentTab.label}</span>
              </div>
              <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform duration-200 ${isMobileMenuOpen ? "rotate-180" : ""}`} />
            </button>

            {/* DROPDOWN POPUP MENU */}
            {isMobileMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-30"
                  onClick={() => setIsMobileMenuOpen(false)}
                />
                <div className="absolute top-[calc(100%+6px)] left-1 right-1 z-50 bg-white border border-gray-200 shadow-lg rounded-xl p-1 animate-in fade-in slide-in-from-top-1 duration-150 max-h-[60vh] overflow-y-auto">
                  {/* ✨ FIX: Map over visibleTabs instead of TABS_CONFIG */}
                  {visibleTabs.map((tab) => {
                    const isActive = activeTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        disabled={tab.isComingSoon}
                        onClick={() => {
                          if (tab.isComingSoon) return;
                          setActiveTab(tab.id);
                          setIsMobileMenuOpen(false);
                        }}
                        className={`w-full flex items-center gap-2.5 p-2.5 rounded-lg transition-colors text-left ${
                          isActive
                            ? "bg-gray-100/80 text-gray-900"
                            : tab.isComingSoon 
                              ? "opacity-50 grayscale bg-transparent text-gray-400 cursor-not-allowed" 
                              : "bg-transparent text-gray-600 hover:bg-gray-50"
                        }`}
                      >
                        <tab.icon className={`h-3.5 w-3.5 ${isActive ? "text-gray-900" : "text-gray-400"}`} />
                        <span className={`text-xs flex-1 ${isActive ? "font-bold" : "font-medium"}`}>
                          {tab.label}
                        </span>
                        
                        {tab.isComingSoon ? (
                          <Badge variant="outline" className="text-[8px] h-4 font-black uppercase px-1 border-indigo-200 text-indigo-500">Coming Soon</Badge>
                        ) : isActive && (
                          <div className="h-1.5 w-1.5 rounded-full bg-gray-900 mr-1" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {/* TAB CONTENTS */}
          <div className="print:mt-0 relative z-10">
            {/* Operational */}
            <TabsContent value="overview" className="m-0 border-none outline-none"><OverviewDashboard /></TabsContent>
            <TabsContent value="inventory" className="m-0 border-none outline-none"><InventoryRegistryReport /></TabsContent>
            
            {/* Financial & Accounting - We can keep these rendered in the DOM, 
                they just won't be accessible because the triggers are hidden */}
            <TabsContent value="sales" className="m-0 border-none outline-none"><SalesVelocityReport /></TabsContent>
            <TabsContent value="procurement" className="m-0 border-none outline-none"><ProcurementLedgerReport /></TabsContent>
            <TabsContent value="transit" className="m-0 border-none outline-none"><TransitReconciliationReport /></TabsContent>
            <TabsContent value="wip" className="m-0 border-none outline-none"><FactoryWipReport /></TabsContent>
            <TabsContent value="manual_journal" className="m-0 border-none outline-none"><ManualJournalForm /></TabsContent>
            
            {!currentTab.isComingSoon && (
              <>
                <TabsContent value="day_book" className="m-0 border-none outline-none"><DayBookReport /></TabsContent>
                <TabsContent value="trial_balance" className="m-0 border-none outline-none"><TrialBalanceReport /></TabsContent>
                <TabsContent value="profit_loss" className="m-0 border-none outline-none"><ProfitAndLossReport /></TabsContent>
                <TabsContent value="balance_sheet" className="m-0 border-none outline-none"><BalanceSheetReport /></TabsContent>
                <TabsContent value="aging" className="m-0 border-none outline-none"><AgingDashboard /></TabsContent>
              </>
            )}

            <TabsContent value="metal_ledger" className="m-0 border-none outline-none"><MetalAccountingReport /></TabsContent>
            <TabsContent value="metal_movements" className="m-0 border-none outline-none"><MetalMovementLog /></TabsContent>
            <TabsContent value="gst_hub" className="m-0 border-none outline-none"><GstComplianceHub /></TabsContent>
          </div>
        </Tabs>
      </main>

      <style dangerouslySetInnerHTML={{__html:`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}} />
    </div>
  );
}