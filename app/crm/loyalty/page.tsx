"use client";

import React, { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabaseClient";
import { 
  Search, History, Users, TrendingUp, 
  FileImage, Loader2, ArrowUpRight, ArrowDownRight,
  DownloadCloud, ShieldCheck, CreditCard
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import { toast } from "sonner";

export default function LoyaltyLedgerPage() {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    fetchLedgerData();
  }, []);

  const fetchLedgerData = async () => {
    setIsLoading(true);
    try {
      // 1. Get Global Settings
      const { data: config } = await supabase.from("loyalty_settings").select("*").eq("id", 1).single();
      if (config) setSettings(config);

      // 2. Fetch all accounts (Using correct 'phone' column)
      const { data: accData, error: accErr } = await supabase
        .from("loyalty_accounts")
        .select(`
          *,
          customers (full_name, phone)
        `)
        .order("total_points", { ascending: false });
      
      if (accErr) console.error("Accounts Error:", accErr);
      if (accData) setAccounts(accData);

      // 3. Fetch all transactions
      const { data: txData, error: txErr } = await supabase
        .from("loyalty_transactions")
        .select(`
          *,
          loyalty_accounts (
            customers (full_name, phone)
          )
        `)
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

  // KPIs
  const totalEnrolled = accounts.length;
  const totalLiabilityPoints = accounts.reduce((sum, acc) => sum + (acc.total_points || 0), 0);
  const totalLiabilityValue = totalLiabilityPoints * (settings?.point_value_rs || 1);

  // Filtering
  const filteredAccounts = useMemo(() => {
    if (!searchTerm) return accounts;
    const lower = searchTerm.toLowerCase();
    return accounts.filter(acc => 
      acc.customers?.full_name?.toLowerCase().includes(lower) || 
      acc.customers?.phone?.includes(lower) 
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
    const { data } = supabase.storage.from('loyalty-evidence').getPublicUrl(path);
    return data.publicUrl;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50/50 p-4 md:p-6 lg:p-8 font-sans">
      <div className="max-w-[1600px] mx-auto space-y-6">
        
        {/* --- HEADER --- */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 pb-2 border-b border-zinc-200">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-zinc-900 tracking-tight flex items-center gap-2">
              <ShieldCheck className="w-6 h-6 text-indigo-600" />
              Celebration Plan Ledger
            </h1>
            <p className="text-xs text-zinc-500 font-medium mt-1.5">
              Master audit trail, liability oversight, and member directory.
            </p>
          </div>
          <div className="flex gap-2 w-full md:w-auto">
            <button className="flex-1 md:flex-none inline-flex items-center justify-center gap-2 px-4 py-2 bg-white border border-zinc-200 rounded-md text-xs font-semibold text-zinc-700 hover:bg-zinc-50 transition-colors shadow-sm">
              <DownloadCloud className="w-3.5 h-3.5" /> Export CSV
            </button>
          </div>
        </div>

        {/* --- KPI DASHBOARD --- */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="rounded-lg border-zinc-200 shadow-sm bg-white">
            <CardContent className="p-4 md:p-5 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Active Members</p>
                <p className="text-2xl font-black text-zinc-900 tracking-tight">{totalEnrolled.toLocaleString()}</p>
              </div>
              <div className="w-10 h-10 bg-zinc-100 rounded-md flex items-center justify-center border border-zinc-200">
                <Users className="w-4 h-4 text-zinc-600" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="rounded-lg border-zinc-200 shadow-sm bg-white">
            <CardContent className="p-4 md:p-5 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Points Liability</p>
                <p className="text-2xl font-black text-amber-600 tracking-tight">{totalLiabilityPoints.toLocaleString()}</p>
              </div>
              <div className="w-10 h-10 bg-amber-50 rounded-md flex items-center justify-center border border-amber-100">
                <CreditCard className="w-4 h-4 text-amber-600" />
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-lg border-zinc-200 shadow-sm bg-white">
            <CardContent className="p-4 md:p-5 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Financial Equivalent</p>
                <p className="text-2xl font-black text-emerald-600 tracking-tight">₹{totalLiabilityValue.toLocaleString()}</p>
              </div>
              <div className="w-10 h-10 bg-emerald-50 rounded-md flex items-center justify-center border border-emerald-100">
                <TrendingUp className="w-4 h-4 text-emerald-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* --- DATAGRID AREA --- */}
        <Card className="rounded-lg border-zinc-200 shadow-sm bg-white overflow-hidden">
          <Tabs defaultValue="members" className="w-full flex flex-col">
            
            {/* Unified Toolbar */}
            <div className="border-b border-zinc-200 bg-zinc-50/50 px-4 py-3 flex flex-col sm:flex-row justify-between items-center gap-4">
              <TabsList className="bg-transparent border-none p-0 h-8 gap-6 flex">
                <TabsTrigger 
                  value="members" 
                  className="data-[state=active]:border-b-2 data-[state=active]:border-indigo-600 data-[state=active]:text-indigo-700 rounded-none px-1 pb-2 font-bold text-xs text-zinc-500 hover:text-zinc-700 transition-colors"
                >
                  Member Directory
                </TabsTrigger>
                <TabsTrigger 
                  value="transactions" 
                  className="data-[state=active]:border-b-2 data-[state=active]:border-indigo-600 data-[state=active]:text-indigo-700 rounded-none px-1 pb-2 font-bold text-xs text-zinc-500 hover:text-zinc-700 transition-colors"
                >
                  Transaction Audit Feed
                </TabsTrigger>
              </TabsList>

              <div className="relative w-full sm:w-72">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
                <Input 
                  placeholder="Search records by name, phone..." 
                  className="h-8 pl-8 text-xs rounded-md border-zinc-200 bg-white focus-visible:ring-1 focus-visible:ring-indigo-500 shadow-sm w-full"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            
            {/* MEMBERS VIEW */}
            <TabsContent value="members" className="m-0 focus-visible:outline-none">
              <div className="overflow-x-auto min-h-[500px] max-h-[700px] custom-scrollbar">
                <Table>
                  <TableHeader className="bg-zinc-50/90 sticky top-0 z-10 shadow-sm backdrop-blur-sm">
                    <TableRow className="hover:bg-transparent border-b border-zinc-200">
                      <TableHead className="h-9 py-2 text-[10px] uppercase font-bold tracking-widest text-zinc-500">Customer Details</TableHead>
                      <TableHead className="h-9 py-2 text-[10px] uppercase font-bold tracking-widest text-zinc-500 text-right">Available Points</TableHead>
                      <TableHead className="h-9 py-2 text-[10px] uppercase font-bold tracking-widest text-zinc-500 text-right">Lifetime Earned</TableHead>
                      <TableHead className="h-9 py-2 text-[10px] uppercase font-bold tracking-widest text-zinc-500 text-right pr-6">Enrolled Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAccounts.length === 0 ? (
                      <TableRow><TableCell colSpan={4} className="text-center py-12 text-zinc-400 text-xs">No matching members found.</TableCell></TableRow>
                    ) : (
                      filteredAccounts.map((acc) => (
                        <TableRow key={acc.id} className="hover:bg-zinc-50 transition-colors border-b border-zinc-100/80">
                          <TableCell className="py-2.5 px-4">
                            <p className="font-semibold text-zinc-900 text-xs">{acc.customers?.full_name || 'Unknown'}</p>
                            <p className="text-[11px] text-zinc-500 font-mono mt-0.5">{acc.customers?.phone || '--'}</p>
                          </TableCell>
                          <TableCell className="text-right py-2.5">
                            <span className="inline-flex items-center justify-center min-w-[3rem] font-mono font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-100/50 text-xs">
                              {acc.total_points?.toLocaleString() || 0}
                            </span>
                          </TableCell>
                          <TableCell className="text-right py-2.5 text-xs font-mono font-medium text-zinc-600">
                            {acc.lifetime_earned?.toLocaleString() || 0}
                          </TableCell>
                          <TableCell className="text-right py-2.5 text-xs text-zinc-500 pr-6">
                            {format(new Date(acc.created_at), 'dd MMM yyyy')}
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
              <div className="overflow-x-auto min-h-[500px] max-h-[700px] custom-scrollbar">
                <Table>
                  <TableHeader className="bg-zinc-50/90 sticky top-0 z-10 shadow-sm backdrop-blur-sm">
                    <TableRow className="hover:bg-transparent border-b border-zinc-200">
                      <TableHead className="h-9 py-2 text-[10px] uppercase font-bold tracking-widest text-zinc-500">Timestamp</TableHead>
                      <TableHead className="h-9 py-2 text-[10px] uppercase font-bold tracking-widest text-zinc-500">Customer Reference</TableHead>
                      <TableHead className="h-9 py-2 text-[10px] uppercase font-bold tracking-widest text-zinc-500">Activity</TableHead>
                      <TableHead className="h-9 py-2 text-[10px] uppercase font-bold tracking-widest text-zinc-500 text-center">Audit Evidence</TableHead>
                      <TableHead className="h-9 py-2 text-[10px] uppercase font-bold tracking-widest text-zinc-500 text-right pr-6">Ledger Impact</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTransactions.length === 0 ? (
                      <TableRow><TableCell colSpan={5} className="text-center py-12 text-zinc-400 text-xs">No matching transactions found.</TableCell></TableRow>
                    ) : (
                      filteredTransactions.map((tx) => {
                        const isPositive = tx.points_awarded > 0;
                        const publicUrl = getEvidenceUrl(tx.evidence_url);

                        return (
                          <TableRow key={tx.id} className="hover:bg-zinc-50 transition-colors border-b border-zinc-100/80">
                            <TableCell className="text-[11px] text-zinc-500 font-medium py-2.5 whitespace-nowrap">
                              {tx.transaction_date ? format(new Date(tx.transaction_date), 'dd MMM yyyy, HH:mm') : '--'}
                            </TableCell>
                            <TableCell className="py-2.5">
                              <p className="font-semibold text-zinc-900 text-xs">{tx.loyalty_accounts?.customers?.full_name || 'Unknown'}</p>
                              <p className="text-[10px] text-zinc-500 font-mono mt-0.5">{tx.loyalty_accounts?.customers?.phone || '--'}</p>
                            </TableCell>
                            <TableCell className="py-2.5 max-w-[250px]">
                              <p className="text-xs font-semibold text-zinc-800 truncate" title={tx.activity_name}>{tx.activity_name}</p>
                              <p className="text-[9px] uppercase tracking-wider text-zinc-400 mt-0.5 truncate">{tx.activity_category}</p>
                            </TableCell>
                            <TableCell className="text-center py-2.5">
                              {publicUrl ? (
                                <a 
                                  href={publicUrl} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center justify-center gap-1.5 px-2.5 py-1 bg-white border border-zinc-200 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 hover:border-indigo-200 rounded text-[10px] font-bold transition-all shadow-sm"
                                >
                                  <FileImage className="w-3 h-3" /> View
                                </a>
                              ) : (
                                <span className="text-[10px] text-zinc-400 font-medium">—</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right py-2.5 pr-6">
                              <div className={`inline-flex items-center gap-1 font-mono font-bold text-xs ${isPositive ? 'text-emerald-600' : 'text-rose-600'}`}>
                                {isPositive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                                {isPositive ? '+' : '-'}{Math.abs(tx.points_awarded || tx.points_redeemed)}
                              </div>
                            </TableCell>
                          </TableRow>
                        )
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
          </Tabs>
        </Card>

      </div>
    </div>
  );
}