"use client"

import React, { useEffect, useState } from 'react'
import { format, startOfMonth, startOfYear } from 'date-fns'
import * as XLSX from 'xlsx'
import { 
  Download, Loader2, RefreshCw, Calendar, 
  TrendingUp, TrendingDown, DollarSign, PieChart
} from 'lucide-react'

import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabaseClient'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/hooks/use-toast'

interface PLAccount {
  account_id: string;
  account_code: string;
  account_name: string;
  account_type: 'INCOME' | 'EXPENSE';
  account_category: string;
  net_amount: number;
}

export function ProfitAndLossReport() {
  const { appUser } = useAuth()
  const { toast } = useToast()
  
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  
  // Default to Current Financial Year
  const [startDate, setStartDate] = useState(() => {
    const today = new Date();
    // Assuming Indian FY (April to March). Adjust if standard Jan-Dec.
    const startYear = today.getMonth() >= 3 ? today.getFullYear() : today.getFullYear() - 1;
    return `${startYear}-04-01`; 
  })
  const [endDate, setEndDate] = useState(() => format(new Date(), 'yyyy-MM-dd'))

  const [accounts, setAccounts] = useState<PLAccount[]>([])

  const fetchPL = async () => {
    if (!appUser?.company_id) return
    setLoading(true)

    try {
      const { data, error } = await supabase.rpc('get_profit_and_loss', {
        p_company_id: appUser.company_id,
        p_start_date: startDate,
        p_end_date: endDate
      })

      if (error) throw error
      setAccounts(data || [])
    } catch (err: any) {
      toast({ title: "Fetch Failed", description: err.message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchPL() }, [appUser, startDate, endDate])

  const formatCurrency = (val: number) => {
    return `₹${val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  const setDatePreset = (preset: 'month' | 'year') => {
    const today = new Date();
    if (preset === 'month') {
      setStartDate(format(startOfMonth(today), 'yyyy-MM-dd'));
      setEndDate(format(today, 'yyyy-MM-dd'));
    } else if (preset === 'year') {
      const startYear = today.getMonth() >= 3 ? today.getFullYear() : today.getFullYear() - 1;
      setStartDate(`${startYear}-04-01`);
      setEndDate(format(today, 'yyyy-MM-dd'));
    }
  }

  // --- ACCOUNTING AGGREGATIONS ---
  const revenueAccounts = accounts.filter(a => a.account_type === 'INCOME' && a.account_category === 'REVENUE');
  const directExpenseAccounts = accounts.filter(a => a.account_type === 'EXPENSE' && a.account_category === 'DIRECT_EXPENSE');
  const indirectExpenseAccounts = accounts.filter(a => a.account_type === 'EXPENSE' && a.account_category === 'INDIRECT_EXPENSE');

  const totalRevenue = revenueAccounts.reduce((sum, a) => sum + Number(a.net_amount), 0);
  const totalDirectExpense = directExpenseAccounts.reduce((sum, a) => sum + Number(a.net_amount), 0);
  const grossProfit = totalRevenue - totalDirectExpense;
  
  const totalIndirectExpense = indirectExpenseAccounts.reduce((sum, a) => sum + Number(a.net_amount), 0);
  const netProfit = grossProfit - totalIndirectExpense;

  const grossMarginPct = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;
  const netMarginPct = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

  // --- EXCEL EXPORT ---
  const handleExport = () => {
    if (accounts.length === 0) return;
    setExporting(true);

    const formattedData = [
      { 'Particulars': 'REVENUE', 'Amount (₹)': '' },
      ...revenueAccounts.map(a => ({ 'Particulars': `  ${a.account_name} (${a.account_code})`, 'Amount (₹)': a.net_amount })),
      { 'Particulars': 'TOTAL REVENUE', 'Amount (₹)': totalRevenue },
      { 'Particulars': '', 'Amount (₹)': '' },
      { 'Particulars': 'COST OF GOODS SOLD (DIRECT EXPENSES)', 'Amount (₹)': '' },
      ...directExpenseAccounts.map(a => ({ 'Particulars': `  ${a.account_name} (${a.account_code})`, 'Amount (₹)': a.net_amount })),
      { 'Particulars': 'TOTAL COGS', 'Amount (₹)': totalDirectExpense },
      { 'Particulars': '', 'Amount (₹)': '' },
      { 'Particulars': 'GROSS PROFIT', 'Amount (₹)': grossProfit },
      { 'Particulars': '', 'Amount (₹)': '' },
      { 'Particulars': 'OPERATING EXPENSES (INDIRECT)', 'Amount (₹)': '' },
      ...indirectExpenseAccounts.map(a => ({ 'Particulars': `  ${a.account_name} (${a.account_code})`, 'Amount (₹)': a.net_amount })),
      { 'Particulars': 'TOTAL OPERATING EXPENSES', 'Amount (₹)': totalIndirectExpense },
      { 'Particulars': '', 'Amount (₹)': '' },
      { 'Particulars': 'NET PROFIT', 'Amount (₹)': netProfit },
    ];

    const worksheet = XLSX.utils.json_to_sheet(formattedData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Profit_And_Loss");
    XLSX.writeFile(workbook, `P_and_L_${format(new Date(), 'yyyyMMdd')}.xlsx`);
    
    setExporting(false);
  }

  // Helper component to render section rows
  const SectionRow = ({ acc }: { acc: PLAccount }) => (
    <div className="flex justify-between items-center py-2 border-b border-zinc-100 hover:bg-zinc-50/50 transition-colors px-2">
      <div className="flex items-center gap-2">
        <span className="font-mono text-[11px] text-zinc-400">{acc.account_code}</span>
        <span className="text-[13px] font-medium text-zinc-700">{acc.account_name}</span>
      </div>
      <span className="text-[13px] font-medium text-zinc-900">{formatCurrency(acc.net_amount)}</span>
    </div>
  )

  return (
    <div className="space-y-5 animate-in fade-in duration-500 max-w-4xl mx-auto">
      
      {/* TOOLBAR */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-3 rounded-2xl border border-zinc-200 shadow-sm print:hidden">
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <div className="hidden sm:flex items-center bg-zinc-50 rounded-full p-1 border border-zinc-200">
            <Button variant="ghost" size="sm" className="h-7 text-[11px] rounded-full px-3" onClick={() => setDatePreset('month')}>This Mth</Button>
            <Button variant="ghost" size="sm" className="h-7 text-[11px] rounded-full px-3" onClick={() => setDatePreset('year')}>This FY</Button>
          </div>

          <div className="flex items-center bg-zinc-50 border border-zinc-200 rounded-full px-3 h-9 focus-within:border-zinc-400 min-w-0">
            <Calendar className="w-3.5 h-3.5 text-zinc-400 shrink-0 mr-1.5" />
            <input type="date" className="bg-transparent text-[11px] font-mono font-medium outline-none w-24 sm:w-auto text-zinc-700" value={startDate} onChange={e => setStartDate(e.target.value)} />
            <span className="text-zinc-300 text-[10px] uppercase font-bold mx-1 shrink-0">-</span>
            <input type="date" className="bg-transparent text-[11px] font-mono font-medium outline-none w-24 sm:w-auto text-right text-zinc-700" value={endDate} onChange={e => setEndDate(e.target.value)} />
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button variant="outline" size="icon" className="h-9 w-9 rounded-full border-zinc-200 text-zinc-600" onClick={fetchPL}>
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button onClick={handleExport} disabled={exporting || loading} className="h-9 text-xs font-medium rounded-full text-zinc-700 border border-zinc-200 bg-white shadow-sm flex-1 sm:flex-none">
            {exporting ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Download className="sm:mr-2 h-3.5 w-3.5" />}
            <span className="hidden sm:inline-block">Export P&L</span>
          </Button>
        </div>
      </div>

      {/* HIGHLIGHT KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <Card className="shadow-sm border-zinc-200 bg-white rounded-2xl">
          <CardContent className="p-4 sm:p-5">
            <p className="text-[11px] font-medium text-zinc-500 mb-1 flex items-center gap-1.5"><DollarSign className="h-3.5 w-3.5 text-zinc-400" /> Revenue</p>
            {loading ? <Skeleton className="h-8 w-24 mt-1" /> : <p className="text-xl sm:text-2xl font-semibold tracking-tighter text-zinc-900 mt-1 truncate">₹{totalRevenue.toLocaleString(undefined, {maximumFractionDigits:0})}</p>}
          </CardContent>
        </Card>
        <Card className="shadow-sm border-zinc-200 bg-white rounded-2xl">
          <CardContent className="p-4 sm:p-5">
            <p className="text-[11px] font-medium text-zinc-500 mb-1 flex items-center gap-1.5"><PieChart className="h-3.5 w-3.5 text-zinc-400" /> Gross Profit</p>
            {loading ? <Skeleton className="h-8 w-24 mt-1" /> : (
              <div className="flex items-baseline gap-2 mt-1">
                <p className="text-xl sm:text-2xl font-semibold tracking-tighter text-zinc-900 truncate">₹{grossProfit.toLocaleString(undefined, {maximumFractionDigits:0})}</p>
                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">{grossMarginPct.toFixed(1)}%</span>
              </div>
            )}
          </CardContent>
        </Card>
        <Card className={`shadow-sm rounded-2xl border ${netProfit >= 0 ? 'border-emerald-200 bg-emerald-50/40' : 'border-rose-200 bg-rose-50/40'} col-span-2`}>
          <CardContent className="p-4 sm:p-5">
            <p className={`text-[11px] font-medium mb-1 flex items-center gap-1.5 ${netProfit >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
              {netProfit >= 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />} 
              Net Profit / (Loss)
            </p>
            {loading ? <Skeleton className="h-8 w-32 mt-1" /> : (
              <div className="flex items-baseline gap-2 mt-1">
                <p className={`text-2xl sm:text-3xl font-semibold tracking-tighter truncate ${netProfit >= 0 ? 'text-emerald-900' : 'text-rose-900'}`}>
                  {formatCurrency(netProfit)}
                </p>
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded ${netProfit >= 0 ? 'text-emerald-700 bg-emerald-100/50' : 'text-rose-700 bg-rose-100/50'}`}>
                  {netMarginPct.toFixed(1)}% Margin
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* THE FINANCIAL STATEMENT */}
      <Card className="shadow-sm border-zinc-200 bg-white rounded-2xl overflow-hidden print:shadow-none print:border-none">
        {loading ? (
          <div className="p-8 space-y-6">
            <Skeleton className="h-6 w-1/3" /><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-full" />
            <Skeleton className="h-6 w-1/3" /><Skeleton className="h-4 w-full" />
          </div>
        ) : (
          <div className="p-1">
            
            {/* 1. REVENUE SECTION */}
            <div className="p-4">
              <h3 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-3 border-b border-zinc-100 pb-2">Revenue (Income)</h3>
              {revenueAccounts.length === 0 ? <p className="text-xs text-zinc-400 italic py-2">No revenue posted.</p> : revenueAccounts.map(acc => <SectionRow key={acc.account_id} acc={acc} />)}
              <div className="flex justify-between items-center pt-3 mt-2 border-t-2 border-zinc-200">
                <span className="text-[13px] font-bold text-zinc-800">Total Revenue</span>
                <span className="text-[14px] font-bold text-zinc-900">{formatCurrency(totalRevenue)}</span>
              </div>
            </div>

            {/* 2. COGS SECTION */}
            <div className="p-4 bg-zinc-50/50">
              <h3 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-3 border-b border-zinc-200 pb-2">Cost of Goods Sold (Direct Expenses)</h3>
              {directExpenseAccounts.length === 0 ? <p className="text-xs text-zinc-400 italic py-2">No direct expenses posted.</p> : directExpenseAccounts.map(acc => <SectionRow key={acc.account_id} acc={acc} />)}
              <div className="flex justify-between items-center pt-3 mt-2 border-t-2 border-zinc-200">
                <span className="text-[13px] font-bold text-zinc-800">Total COGS</span>
                <span className="text-[14px] font-bold text-zinc-900">{formatCurrency(totalDirectExpense)}</span>
              </div>
            </div>

            {/* 3. GROSS PROFIT TOTAL */}
            <div className="p-5 bg-zinc-900 text-white flex justify-between items-center shadow-inner">
              <span className="text-[14px] font-bold tracking-wide uppercase">Gross Profit</span>
              <span className="text-[18px] font-semibold tracking-tighter">{formatCurrency(grossProfit)}</span>
            </div>

            {/* 4. INDIRECT EXPENSES */}
            <div className="p-4">
              <h3 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-3 border-b border-zinc-100 pb-2">Operating Expenses (Indirect)</h3>
              {indirectExpenseAccounts.length === 0 ? <p className="text-xs text-zinc-400 italic py-2">No operating expenses posted.</p> : indirectExpenseAccounts.map(acc => <SectionRow key={acc.account_id} acc={acc} />)}
              <div className="flex justify-between items-center pt-3 mt-2 border-t-2 border-zinc-200">
                <span className="text-[13px] font-bold text-zinc-800">Total Operating Expenses</span>
                <span className="text-[14px] font-bold text-zinc-900">{formatCurrency(totalIndirectExpense)}</span>
              </div>
            </div>

            {/* 5. NET PROFIT TOTAL */}
            <div className={`p-6 flex justify-between items-center shadow-inner border-t-4 ${netProfit >= 0 ? 'bg-emerald-50 border-emerald-500 text-emerald-900' : 'bg-rose-50 border-rose-500 text-rose-900'}`}>
              <span className="text-[16px] font-black uppercase tracking-widest">Net Profit</span>
              <span className="text-[24px] font-black tracking-tighter">{formatCurrency(netProfit)}</span>
            </div>

          </div>
        )}
      </Card>
    </div>
  )
}