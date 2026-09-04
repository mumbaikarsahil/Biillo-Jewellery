"use client";

import React, { useState } from "react";
import { 
  Plus, X, RefreshCw, Maximize2, Minimize2, 
  BarChart3, PieChart, TrendingUp, LayoutDashboard, ArrowRightLeft, Trophy, BookOpen,
  Hammer
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

// ============================================================================
// 1. REGISTRY: Define available reports here
// ============================================================================
const REPORT_TYPES = [
    { id: "sales_summary", name: "Daily Sales Summary", icon: TrendingUp, defaultSpan: "col-span-1 md:col-span-2 lg:col-span-2" },
    { id: "custom_orders", name: "Custom Orders Pipeline", icon: Hammer, defaultSpan: "col-span-1 md:col-span-2 lg:col-span-2" }, // ✨ ADDED THIS
    { id: "buybacks", name: "Returns & Intake Ledger", icon: ArrowRightLeft, defaultSpan: "col-span-1 md:col-span-2 lg:col-span-2" }, // ✨ Added
    { id: "branch_rankings", name: "Branch Rankings", icon: Trophy, defaultSpan: "col-span-1 md:col-span-2 lg:col-span-2" }, // ✨ ADDED
    { id: "daily_cashbook", name: "Daily Cashbook Logs", icon: BookOpen, defaultSpan: "col-span-1 md:col-span-2 lg:col-span-2" }, // ✨ ADDED
];

interface WidgetConfig {
  instanceId: string;
  typeId: string;
  isExpanded: boolean;
}

// ============================================================================
// 2. THE STANDARD WRAPPER: Ensures every report looks uniform
// ============================================================================
const ReportWrapper = ({ 
  widget, 
  onRemove, 
  onToggleExpand 
}: { 
  widget: WidgetConfig; 
  onRemove: (id: string) => void;
  onToggleExpand: (id: string) => void;
}) => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const reportDef = REPORT_TYPES.find(r => r.id === widget.typeId);

  const handleRefresh = () => {
    setIsRefreshing(true);
    // TODO: Trigger child component re-fetch
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  if (!reportDef) return null;
  const Icon = reportDef.icon;

  return (
    <Card className={`flex flex-col bg-white border-zinc-200 shadow-sm transition-all duration-300 ${widget.isExpanded ? 'col-span-1 md:col-span-2 lg:col-span-3 row-span-2 z-10' : reportDef.defaultSpan}`}>
      <CardHeader className="flex flex-row items-center justify-between p-3 sm:p-4 border-b border-zinc-100 bg-zinc-50/50">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-md">
            <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <CardTitle className="text-xs sm:text-sm font-bold text-zinc-800 tracking-tight">
            {reportDef.name}
          </CardTitle>
        </div>
        
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7 sm:h-8 sm:w-8 text-zinc-400 hover:text-indigo-600" onClick={handleRefresh}>
            <RefreshCw className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 sm:h-8 sm:w-8 text-zinc-400 hover:text-zinc-900 hidden sm:flex" onClick={() => onToggleExpand(widget.instanceId)}>
            {widget.isExpanded ? <Minimize2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> : <Maximize2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 sm:h-8 sm:w-8 text-zinc-400 hover:text-red-600 hover:bg-red-50" onClick={() => onRemove(widget.instanceId)}>
            <X className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="p-4 sm:p-6 flex-1 min-h-[250px] flex flex-col bg-zinc-50/20 relative">
        {/* ========================================================= */}
        {/* 3. COMPONENT INJECTION: Actual report component goes here */}
        {/* ========================================================= */}
        {widget.typeId === "sales_summary" && <SalesSummaryWidget />}
        {widget.typeId === "custom_orders" && <CustomOrdersWidget />}
        {widget.typeId === "buybacks" && <BuybacksWidget />}
        {widget.typeId === "branch_rankings" && <BranchRankingsWidget />}
        {widget.typeId === "daily_cashbook" && <DailyCashbookWidget />}

        
        {widget.typeId !== "sales_summary" && widget.typeId !== "custom_orders" && (
           <div className="m-auto text-center">
             <p className="text-xs text-zinc-400 font-mono">[{widget.typeId}] component rendering here...</p>
           </div>
        )}
      </CardContent>
    </Card>
  );
};


// ============================================================================
// 4. MAIN DASHBOARD PAGE
// ============================================================================
export default function ModularReportsDashboard() {
  // Start with a default report so the screen isn't empty
  const [activeWidgets, setActiveWidgets] = useState<WidgetConfig[]>([
    { instanceId: `inst-${Date.now()}`, typeId: "sales_summary", isExpanded: false }
  ]);

  const addWidget = (typeId: string) => {
    const newWidget: WidgetConfig = {
      instanceId: `inst-${Date.now()}`, // unique ID allows multiple instances of the same report
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

  return (
    <div className="flex flex-col min-h-screen bg-zinc-100/50 font-sans pb-20 sm:pb-8 w-full max-w-[100vw] overflow-x-hidden">
      
      {/* HEADER */}
      <header className="sticky top-0 z-30 w-full bg-white/80 backdrop-blur-md border-b border-zinc-200 px-4 h-14 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-indigo-600 flex items-center justify-center">
            <LayoutDashboard className="h-4 w-4 text-white" />
          </div>
          <nav className="flex items-center gap-1.5 text-sm font-medium">
            <span className="font-bold text-zinc-900 tracking-tight">Intelligence Workspace</span>
          </nav>
        </div>

        {/* ADD REPORT BUTTON (Desktop) */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" className="h-8 sm:h-9 bg-zinc-900 text-white hover:bg-zinc-800 rounded-full font-semibold px-4 shadow-sm hidden sm:flex">
              <Plus className="w-4 h-4 mr-1.5" /> Add Report
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 rounded-xl border-zinc-200 shadow-xl">
            <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-zinc-400">Available Modules</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {REPORT_TYPES.map(report => {
              const Icon = report.icon;
              return (
                <DropdownMenuItem key={report.id} onClick={() => addWidget(report.id)} className="cursor-pointer py-2.5 font-medium text-sm text-zinc-700">
                  <Icon className="w-4 h-4 mr-2 text-zinc-400" /> {report.name}
                </DropdownMenuItem>
              )
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      {/* DASHBOARD WORKSPACE */}
      <main className="p-3 sm:p-6 md:p-8 max-w-[1800px] w-full mx-auto animate-in fade-in duration-500">
        
        {activeWidgets.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
            <div className="w-16 h-16 bg-zinc-100 rounded-full flex items-center justify-center mb-4 border border-zinc-200">
              <LayoutDashboard className="w-6 h-6 text-zinc-400" />
            </div>
            <h2 className="text-lg font-bold text-zinc-900">Your workspace is empty</h2>
            <p className="text-sm text-zinc-500 mt-1 max-w-sm mb-6">Add modules from the registry to build your custom reporting dashboard.</p>
            {/* Mobile-friendly Add Button for empty state */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-full font-bold shadow-sm px-6">
                  <Plus className="w-4 h-4 mr-2" /> Add Your First Report
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="center" className="w-56 rounded-xl border-zinc-200">
                {REPORT_TYPES.map(report => {
                  const Icon = report.icon;
                  return (
                    <DropdownMenuItem key={report.id} onClick={() => addWidget(report.id)} className="cursor-pointer py-2.5 font-medium text-sm text-zinc-700">
                      <Icon className="w-4 h-4 mr-2 text-zinc-400" /> {report.name}
                    </DropdownMenuItem>
                  )
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 auto-rows-max">
            {activeWidgets.map(widget => (
              <ReportWrapper 
                key={widget.instanceId} 
                widget={widget} 
                onRemove={removeWidget} 
                onToggleExpand={toggleExpand}
              />
            ))}
          </div>
        )}

      </main>

      {/* MOBILE FLOATING ACTION BUTTON */}
      <div className="sm:hidden fixed bottom-20 right-4 z-40">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon" className="h-12 w-12 rounded-full bg-zinc-900 text-white shadow-xl border-2 border-white">
              <Plus className="w-5 h-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side="top" className="w-56 rounded-xl border-zinc-200 shadow-2xl mb-2">
            <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-zinc-400">Available Modules</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {REPORT_TYPES.map(report => {
              const Icon = report.icon;
              return (
                <DropdownMenuItem key={report.id} onClick={() => addWidget(report.id)} className="cursor-pointer py-3 font-semibold text-sm text-zinc-700">
                  <Icon className="w-4 h-4 mr-2 text-indigo-500" /> {report.name}
                </DropdownMenuItem>
              )
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

    </div>
  );
}