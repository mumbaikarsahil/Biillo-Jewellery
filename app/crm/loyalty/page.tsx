"use client";

import React, { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabaseClient";
import { 
  Search, Users, TrendingUp, FileImage, Loader2, ArrowUpRight, 
  ArrowDownRight, DownloadCloud, ShieldCheck, CreditCard, 
  PlusCircle, MinusCircle, Hash, Link as LinkIcon, RefreshCw,
  Edit3, Coins
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { format } from "date-fns";
import { toast } from "sonner";

export default function LoyaltyLedgerPage() {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  // Manage Modal State (Unified for Points & Credentials)
  const [isManageModalOpen, setIsManageModalOpen] = useState(false);
  const [modalTab, setModalTab] = useState<"points" | "credentials">("points");
  const [selectedAccount, setSelectedAccount] = useState<any>(null);

  // Points State
  const [manageAction, setManageAction] = useState<"add" | "deduct">("add");
  const [managePoints, setManagePoints] = useState("");
  const [manageReason, setManageReason] = useState("");

  // Credentials State
  const [editMemberId, setEditMemberId] = useState("");
  const [editReferralCode, setEditReferralCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchLedgerData();
  }, []);

  const fetchLedgerData = async () => {
    setIsLoading(true);
    try {
      const { data: config } = await supabase.from("loyalty_settings").select("*").eq("id", 1).single();
      if (config) setSettings(config);

      const { data: accData, error: accErr } = await supabase
        .from("loyalty_accounts")
        .select(`*, customers (full_name, phone)`)
        .order("total_points", { ascending: false });
      
      if (accErr) console.error("Accounts Error:", accErr);
      if (accData) setAccounts(accData);

      const { data: txData, error: txErr } = await supabase
        .from("loyalty_transactions")
        .select(`*, loyalty_accounts (customers (full_name, phone))`)
        .order("transaction_date", { ascending: false }) 
        .limit(500);

      if (txErr) console.error("Transactions Error:", txErr);
      if (txData) setTransactions(txData);

    } catch (error) {
      console.error("Failed to fetch ledger data", error);
      toast.error("Failed to synchronize ledger data.");
    } finally {
      setIsLoading(false);
    }
  };

  // KPI Calculations
  const totalEnrolled = accounts.length;
  const totalLiabilityPoints = accounts.reduce((sum, acc) => sum + (acc.total_points || 0), 0);
  const totalLiabilityValue = totalLiabilityPoints * (settings?.point_value_rs || 1);

  // Filtering
  const filteredAccounts = useMemo(() => {
    if (!searchTerm) return accounts;
    const lower = searchTerm.toLowerCase();
    return accounts.filter(acc => 
      acc.customers?.full_name?.toLowerCase().includes(lower) || 
      acc.customers?.phone?.includes(lower) ||
      acc.member_id?.toLowerCase().includes(lower) ||
      acc.referral_code?.toLowerCase().includes(lower)
    );
  }, [accounts, searchTerm]);

  const filteredTransactions = useMemo(() => {
    if (!searchTerm) return transactions;
    const lower = searchTerm.toLowerCase();
    return transactions.filter(tx => 
      tx.activity_name?.toLowerCase().includes(lower) ||
      tx.loyalty_accounts?.customers?.full_name?.toLowerCase().includes(lower) ||
      tx.loyalty_accounts?.customers?.phone?.includes(lower) 
    );
  }, [transactions, searchTerm]);

  const getEvidenceUrl = (path: string) => {
    if (!path) return null;
    const { data } = supabase.storage.from("loyalty-evidence").getPublicUrl(path);
    return data.publicUrl;
  };

  const handleOpenManageModal = (acc: any, defaultTab: "points" | "credentials" = "points") => {
    setSelectedAccount(acc);
    setModalTab(defaultTab);
    setManageAction("add");
    setManagePoints("");
    setManageReason("");
    setEditMemberId(acc.member_id || "");
    setEditReferralCode(acc.referral_code || "");
    setIsManageModalOpen(true);
  };

  // Generators
  const generateNewMemberId = () => {
    const generated = `PAV-${Math.floor(100000 + Math.random() * 900000)}`;
    setEditMemberId(generated);
    toast.info("Generated new Member ID");
  };

  const generateNewReferralCode = () => {
    const generated = `REF-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    setEditReferralCode(generated);
    toast.info("Generated new Referral Code");
  };

  // Save Credentials (Member ID & Referral Code)
  const handleSaveCredentials = async () => {
    if (!selectedAccount) return;
    setIsSubmitting(true);
    try {
      const finalMemberId = editMemberId.trim() || null;
      const finalReferralCode = editReferralCode.trim() || null;

      const { error } = await supabase
        .from("loyalty_accounts")
        .update({
          member_id: finalMemberId,
          referral_code: finalReferralCode,
          updated_at: new Date().toISOString()
        })
        .eq("id", selectedAccount.id);

      if (error) {
        if (error.code === "23505") {
          throw new Error("This Member ID or Referral Code is already taken by another user.");
        }
        throw error;
      }

      toast.success("Account credentials updated successfully.");
      setIsManageModalOpen(false);
      fetchLedgerData();
    } catch (err: any) {
      toast.error(err.message || "Failed to update credentials.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Execute Manual Points Adjustment
  const handleManualAdjustment = async () => {
    if (!selectedAccount) return;
    const pts = parseInt(managePoints);
    if (!pts || isNaN(pts) || pts <= 0) return toast.error("Please enter a valid number of points.");
    if (!manageReason.trim()) return toast.error("Please provide an audit reason.");

    if (manageAction === "deduct" && pts > selectedAccount.total_points) {
      return toast.error(`Cannot deduct more than balance (${selectedAccount.total_points} Pts).`);
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase.from("loyalty_transactions").insert({
        account_id: selectedAccount.id,
        activity_category: "Manual Adjustment",
        activity_name: `Admin: ${manageReason.trim()}`,
        points_awarded: manageAction === "add" ? pts : 0,
        points_redeemed: manageAction === "deduct" ? pts : 0,
        status: "approved",
      });

      if (error) throw error;
      
      toast.success(`Successfully ${manageAction === "add" ? "added" : "deducted"} ${pts} points.`);
      setIsManageModalOpen(false);
      setManagePoints("");
      setManageReason("");
      fetchLedgerData(); 
    } catch (err: any) {
      toast.error(err.message || "Failed to adjust points.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-[calc(100vh-60px)] flex flex-col items-center justify-center gap-3 bg-[#F8F9FA]">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
        <p className="text-xs text-slate-500 font-medium tracking-widest uppercase animate-pulse">Loading Ledger...</p>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-60px)] bg-[#F8F9FA] p-6 lg:p-8 font-sans text-slate-900 w-full">
      <div className="max-w-[1400px] mx-auto space-y-6">
        
        {/* --- HEADER --- */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#111827] rounded-lg flex items-center justify-center shadow-sm shrink-0">
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">Loyalty Ledger</h1>
              <p className="text-[13px] text-slate-500 font-medium mt-0.5">
                Manage member IDs, referral keys, manual points, and master audit balances.
              </p>
            </div>
          </div>
          <Button variant="outline" className="h-9 text-[13px] font-semibold text-slate-700 bg-white border-slate-200 hover:bg-slate-50 shadow-sm w-full md:w-auto">
            <DownloadCloud className="w-4 h-4 mr-2" /> Export CSV
          </Button>
        </div>

        {/* --- KPI DASHBOARD --- */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6">
          <Card className="rounded-xl border-slate-200 shadow-sm bg-white overflow-hidden">
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-3">
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Active Members</p>
                <div className="w-8 h-8 bg-slate-100 rounded-md flex items-center justify-center">
                  <Users className="w-4 h-4 text-slate-500" />
                </div>
              </div>
              <p className="text-3xl font-bold text-slate-900">{totalEnrolled.toLocaleString()}</p>
            </CardContent>
          </Card>
          
          <Card className="rounded-xl border-slate-200 shadow-sm bg-white overflow-hidden">
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-3">
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Points Liability</p>
                <div className="w-8 h-8 bg-amber-50 rounded-md flex items-center justify-center border border-amber-100/50">
                  <CreditCard className="w-4 h-4 text-amber-500" />
                </div>
              </div>
              <p className="text-3xl font-bold text-[#D97706]">{totalLiabilityPoints.toLocaleString()}</p>
            </CardContent>
          </Card>

          <Card className="rounded-xl border-slate-200 shadow-sm bg-white overflow-hidden">
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-3">
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Financial Equivalent</p>
                <div className="w-8 h-8 bg-emerald-50 rounded-md flex items-center justify-center border border-emerald-100/50">
                  <TrendingUp className="w-4 h-4 text-emerald-500" />
                </div>
              </div>
              <p className="text-3xl font-bold text-[#059669]">₹{totalLiabilityValue.toLocaleString()}</p>
            </CardContent>
          </Card>
        </div>

        {/* --- DATAGRID AREA --- */}
        <div className="rounded-xl border border-slate-200 shadow-sm bg-white overflow-hidden">
          <Tabs defaultValue="members" className="w-full flex flex-col">
            
            {/* Unified Toolbar */}
            <div className="border-b border-slate-200 bg-white px-5 pt-4 pb-0 flex flex-col sm:flex-row justify-between items-end gap-4">
              <TabsList className="bg-transparent border-none p-0 h-auto gap-6 flex">
                <TabsTrigger 
                  value="members" 
                  className="data-[state=active]:border-b-[3px] data-[state=active]:border-slate-900 data-[state=active]:text-slate-900 rounded-none px-1 pb-3 font-semibold text-[13px] text-slate-500 hover:text-slate-700 transition-colors"
                >
                  Member Directory
                </TabsTrigger>
                <TabsTrigger 
                  value="transactions" 
                  className="data-[state=active]:border-b-[3px] data-[state=active]:border-slate-900 data-[state=active]:text-slate-900 rounded-none px-1 pb-3 font-semibold text-[13px] text-slate-500 hover:text-slate-700 transition-colors"
                >
                  Transaction Audit Feed
                </TabsTrigger>
              </TabsList>

              <div className="relative w-full sm:w-[320px] pb-3">
                <Search className="absolute left-3 top-[18px] -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input 
                  placeholder="Search by name, phone, or ID..." 
                  className="h-9 pl-9 text-[13px] rounded-lg border-slate-200 bg-slate-50 focus-visible:ring-1 focus-visible:ring-slate-300 focus-visible:bg-white shadow-none w-full transition-all"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            
            {/* MEMBERS VIEW */}
            <TabsContent value="members" className="m-0 focus-visible:outline-none">
              <div className="overflow-x-auto min-h-[400px] max-h-[600px] custom-scrollbar">
                <Table>
                  <TableHeader className="bg-white sticky top-0 z-10">
                    <TableRow className="hover:bg-transparent border-b border-slate-200">
                      <TableHead className="h-10 py-2 text-[10px] uppercase font-bold tracking-wider text-slate-400 pl-6">Customer</TableHead>
                      <TableHead className="h-10 py-2 text-[10px] uppercase font-bold tracking-wider text-slate-400">Card & Referral Codes</TableHead>
                      <TableHead className="h-10 py-2 text-[10px] uppercase font-bold tracking-wider text-slate-400 text-center">Available Points</TableHead>
                      <TableHead className="h-10 py-2 text-[10px] uppercase font-bold tracking-wider text-slate-400 text-center">Lifetime Earned</TableHead>
                      <TableHead className="h-10 py-2 text-[10px] uppercase font-bold tracking-wider text-slate-400 text-right pr-6">Manage</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAccounts.length === 0 ? (
                      <TableRow><TableCell colSpan={5} className="text-center py-16 text-slate-400 text-sm font-medium">No matching members found.</TableCell></TableRow>
                    ) : (
                      filteredAccounts.map((acc) => (
                        <TableRow key={acc.id} className="hover:bg-slate-50/50 transition-colors border-b border-slate-100 group">
                          <TableCell className="py-3 px-6">
                            <p className="font-semibold text-slate-800 text-[13px]">{acc.customers?.full_name || "Unknown"}</p>
                            <p className="text-[11px] text-slate-500 mt-0.5">{acc.customers?.phone || "--"}</p>
                          </TableCell>
                          <TableCell className="py-3">
                            <div className="flex flex-wrap items-center gap-1.5">
                              {acc.member_id ? (
                                <span className="inline-flex items-center gap-1.5 text-[10px] font-medium font-mono text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                                  <Hash className="w-3 h-3 text-slate-400" /> {acc.member_id}
                                </span>
                              ) : (
                                <button
                                  onClick={() => handleOpenManageModal(acc, "credentials")}
                                  className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-2 py-0.5 rounded transition-colors"
                                >
                                  + Add Member ID
                                </button>
                              )}

                              {acc.referral_code ? (
                                <span className="inline-flex items-center gap-1.5 text-[10px] font-medium font-mono text-[#0078D7] bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                                  <LinkIcon className="w-3 h-3 text-[#0078D7]/60" /> {acc.referral_code}
                                </span>
                              ) : (
                                <button
                                  onClick={() => handleOpenManageModal(acc, "credentials")}
                                  className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#0078D7] bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2 py-0.5 rounded transition-colors"
                                >
                                  + Add Ref Code
                                </button>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-center py-3">
                            <span className="inline-flex items-center justify-center font-bold text-[#D97706] bg-[#FFFBEB] px-3 py-1 rounded border border-[#FEF3C7] text-xs">
                              {acc.total_points?.toLocaleString() || 0}
                            </span>
                          </TableCell>
                          <TableCell className="text-center py-3 text-[13px] font-medium text-slate-600">
                            {acc.lifetime_earned?.toLocaleString() || 0}
                          </TableCell>
                          <TableCell className="text-right py-3 pr-6">
                            <div className="flex justify-end gap-2">
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-8 px-2.5 text-[11px] font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                                onClick={() => handleOpenManageModal(acc, "credentials")}
                                title="Edit Codes"
                              >
                                <Edit3 className="w-3.5 h-3.5 mr-1 text-slate-400" /> Codes
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-8 px-2.5 text-[11px] font-semibold text-[#0078D7] hover:text-[#005A9E] hover:bg-blue-50 transition-colors"
                                onClick={() => handleOpenManageModal(acc, "points")}
                              >
                                <Coins className="w-3.5 h-3.5 mr-1" /> Points
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            {/* TRANSACTIONS VIEW */}
            <TabsContent value="transactions" className="m-0 focus-visible:outline-none">
              <div className="overflow-x-auto min-h-[400px] max-h-[600px] custom-scrollbar">
                <Table>
                  <TableHeader className="bg-white sticky top-0 z-10">
                    <TableRow className="hover:bg-transparent border-b border-slate-200">
                      <TableHead className="h-10 py-2 text-[10px] uppercase font-bold tracking-wider text-slate-400 pl-6">Timestamp</TableHead>
                      <TableHead className="h-10 py-2 text-[10px] uppercase font-bold tracking-wider text-slate-400">Customer</TableHead>
                      <TableHead className="h-10 py-2 text-[10px] uppercase font-bold tracking-wider text-slate-400">Activity</TableHead>
                      <TableHead className="h-10 py-2 text-[10px] uppercase font-bold tracking-wider text-slate-400 text-center">Audit Evidence</TableHead>
                      <TableHead className="h-10 py-2 text-[10px] uppercase font-bold tracking-wider text-slate-400 text-right pr-6">Ledger Impact</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTransactions.length === 0 ? (
                      <TableRow><TableCell colSpan={5} className="text-center py-16 text-slate-400 text-sm font-medium">No matching transactions found.</TableCell></TableRow>
                    ) : (
                      filteredTransactions.map((tx) => {
                        const isPositive = tx.points_awarded > 0;
                        const isManual = tx.activity_category === "Manual Adjustment";
                        const publicUrl = getEvidenceUrl(tx.evidence_url);

                        return (
                          <TableRow key={tx.id} className="hover:bg-slate-50/50 transition-colors border-b border-slate-100">
                            <TableCell className="text-[11px] text-slate-500 font-medium py-3 pl-6 whitespace-nowrap">
                              {tx.transaction_date ? format(new Date(tx.transaction_date), "dd MMM yyyy, HH:mm") : "--"}
                            </TableCell>
                            <TableCell className="py-3">
                              <p className="font-semibold text-slate-800 text-[13px]">{tx.loyalty_accounts?.customers?.full_name || "Unknown"}</p>
                              <p className="text-[11px] text-slate-500 mt-0.5">{tx.loyalty_accounts?.customers?.phone || "--"}</p>
                            </TableCell>
                            <TableCell className="py-3 max-w-[250px]">
                              <p className="text-[13px] font-semibold text-slate-800 truncate" title={tx.activity_name}>{tx.activity_name}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <span className={`text-[10px] font-bold uppercase tracking-wider ${isManual ? "text-[#0078D7]" : "text-slate-400"}`}>
                                  {tx.activity_category}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="text-center py-3">
                              {publicUrl ? (
                                <a 
                                  href={publicUrl} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center justify-center gap-1.5 px-3 py-1 bg-white border border-slate-200 text-[#0078D7] hover:bg-blue-50 rounded text-[11px] font-bold transition-all shadow-sm"
                                >
                                  <FileImage className="w-3.5 h-3.5" /> View
                                </a>
                              ) : (
                                <span className="text-xs text-slate-300 font-medium">—</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right py-3 pr-6">
                              <div className={`inline-flex items-center gap-1 font-bold text-[13px] ${isPositive ? "text-[#059669]" : "text-[#E11D48]"}`}>
                                {isPositive ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                                {isPositive ? "+" : "-"}{Math.abs(tx.points_awarded || tx.points_redeemed)}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* --- UNIFIED MANAGE ACCOUNT MODAL (Codes & Points) --- */}
      <Dialog open={isManageModalOpen} onOpenChange={(open) => !isSubmitting && setIsManageModalOpen(open)}>
        <DialogContent className="sm:max-w-[460px] p-0 border-slate-200 shadow-xl rounded-xl overflow-hidden bg-white">
          <DialogHeader className="bg-slate-50/80 px-6 py-4 border-b border-slate-100">
            <DialogTitle className="text-lg font-semibold text-slate-900">Account Management</DialogTitle>
            <DialogDescription className="text-xs text-slate-500 mt-1">
              Member: <span className="font-bold text-slate-800">{selectedAccount?.customers?.full_name}</span> (+91 {selectedAccount?.customers?.phone})
            </DialogDescription>
          </DialogHeader>

          {/* Sub Navigation */}
          <div className="flex border-b border-slate-200 bg-slate-50/50 px-6">
            <button
              onClick={() => setModalTab("points")}
              className={`py-2.5 px-3 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 ${
                modalTab === "points"
                  ? "border-slate-900 text-slate-900 bg-white"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              <Coins className="w-3.5 h-3.5" /> Adjust Balance
            </button>
            <button
              onClick={() => setModalTab("credentials")}
              className={`py-2.5 px-3 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 ${
                modalTab === "credentials"
                  ? "border-slate-900 text-slate-900 bg-white"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              <Hash className="w-3.5 h-3.5" /> Member & Referral ID
            </button>
          </div>
          
          {modalTab === "points" ? (
            /* TAB 1: POINTS ADJUSTMENT */
            <div className="p-6 space-y-5">
              <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200/60 shadow-inner">
                <button
                  type="button"
                  onClick={() => setManageAction("add")}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 text-[13px] font-semibold rounded-md transition-all ${
                    manageAction === "add" 
                      ? "bg-white text-[#059669] shadow-sm border border-slate-200/50" 
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  <PlusCircle className="w-4 h-4" /> Add Points
                </button>
                <button
                  type="button"
                  onClick={() => setManageAction("deduct")}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 text-[13px] font-semibold rounded-md transition-all ${
                    manageAction === "deduct" 
                      ? "bg-white text-[#E11D48] shadow-sm border border-slate-200/50" 
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  <MinusCircle className="w-4 h-4" /> Deduct Points
                </button>
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <Label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Points Amount</Label>
                    <span className="text-[11px] text-slate-400 font-mono">Current: {selectedAccount?.total_points || 0} Pts</span>
                  </div>
                  <Input 
                    type="number" 
                    placeholder="e.g. 500" 
                    value={managePoints} 
                    onChange={(e) => setManagePoints(e.target.value.replace(/\D/g, ""))}
                    className="h-11 text-base font-bold bg-white border-slate-200 shadow-sm focus-visible:ring-[#0078D7] rounded-lg"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Audit Reason</Label>
                  <Input 
                    placeholder="e.g. In-store courtesy reward, order dispute..." 
                    value={manageReason} 
                    onChange={(e) => setManageReason(e.target.value)}
                    className="h-10 text-[13px] bg-white border-slate-200 shadow-sm focus-visible:ring-[#0078D7] rounded-lg"
                  />
                </div>
              </div>

              <DialogFooter className="pt-2 flex flex-row justify-end gap-2 border-t border-slate-100">
                <Button variant="ghost" onClick={() => setIsManageModalOpen(false)} disabled={isSubmitting} className="h-9 rounded-md text-[13px] font-semibold text-slate-600">
                  Cancel
                </Button>
                <Button 
                  onClick={handleManualAdjustment} 
                  disabled={isSubmitting || !managePoints || !manageReason}
                  className={`h-9 rounded-md text-[13px] font-bold px-5 text-white shadow-sm transition-all ${
                    manageAction === "add" ? "bg-[#059669] hover:bg-[#047857]" : "bg-[#E11D48] hover:bg-[#BE123C]"
                  }`}
                >
                  {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  Confirm {manageAction === "add" ? "Addition" : "Deduction"}
                </Button>
              </DialogFooter>
            </div>
          ) : (
            /* TAB 2: CREDENTIALS EDIT & GENERATE */
            <div className="p-6 space-y-5">
              <div className="space-y-4">
                
                {/* Member ID Field */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <Label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Card / Member ID</Label>
                    <button
                      type="button"
                      onClick={generateNewMemberId}
                      className="text-[11px] font-semibold text-[#0078D7] hover:underline flex items-center gap-1"
                    >
                      <RefreshCw className="w-3 h-3" /> Auto-Generate
                    </button>
                  </div>
                  <Input 
                    placeholder="e.g. PAV-123456" 
                    value={editMemberId} 
                    onChange={(e) => setEditMemberId(e.target.value.toUpperCase())}
                    className="h-10 text-[13px] font-mono uppercase bg-white border-slate-200 shadow-sm focus-visible:ring-[#0078D7] rounded-lg"
                  />
                </div>

                {/* Referral Code Field */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <Label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Referral Code</Label>
                    <button
                      type="button"
                      onClick={generateNewReferralCode}
                      className="text-[11px] font-semibold text-[#0078D7] hover:underline flex items-center gap-1"
                    >
                      <RefreshCw className="w-3 h-3" /> Auto-Generate
                    </button>
                  </div>
                  <Input 
                    placeholder="e.g. REF-ABC123" 
                    value={editReferralCode} 
                    onChange={(e) => setEditReferralCode(e.target.value.toUpperCase())}
                    className="h-10 text-[13px] font-mono uppercase bg-white border-slate-200 shadow-sm focus-visible:ring-[#0078D7] rounded-lg"
                  />
                </div>

              </div>

              <DialogFooter className="pt-2 flex flex-row justify-end gap-2 border-t border-slate-100">
                <Button variant="ghost" onClick={() => setIsManageModalOpen(false)} disabled={isSubmitting} className="h-9 rounded-md text-[13px] font-semibold text-slate-600">
                  Cancel
                </Button>
                <Button 
                  onClick={handleSaveCredentials} 
                  disabled={isSubmitting}
                  className="h-9 rounded-md text-[13px] font-bold px-5 bg-slate-900 hover:bg-slate-800 text-white shadow-sm"
                >
                  {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  Save Identifiers
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

    </div>
  );
}