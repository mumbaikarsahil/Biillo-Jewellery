"use client"

import React, { useEffect, useState } from 'react'
import { format } from 'date-fns'
import * as XLSX from 'xlsx'
import { 
  Download, Loader2, RefreshCw, Calendar, 
  Landmark, ArrowRightLeft, Scale, CheckCircle2
} from 'lucide-react'

import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabaseClient'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/hooks/use-toast'

interface BSAccount {
  account_id: string;
  account_code: string;
  account_name: string;
  account_type: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'INCOME' | 'EXPENSE';
  account_category: string;
  balance: number;
}

export function BalanceSheetReport() {
  const { appUser } = useAuth()
  const { toast } = useToast()
  
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  
  // Balance Sheet is a snapshot in time (As Of Date)
  const [asOfDate, setAsOfDate] = useState(() => format(new Date(), 'yyyy-MM-dd'))
  const [accounts, setAccounts] = useState<BSAccount[]>([])

  const fetchBalanceSheet = async () => {
    if (!appUser?.company_id) return
    setLoading(true)

    try {
      const { data, error } = await supabase.rpc('get_balance_sheet', {
        p_company_id: appUser.company_id,
        p_as_of_date: asOfDate
      })

      if (error) throw error
      setAccounts(data || [])
    } catch (err: any) {
      toast({ title: "Fetch Failed", description: err.message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchBalanceSheet() }, [appUser, asOfDate])

  const formatCurrency = (val: number) => {
    return `₹${val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  // --- ACCOUNTING AGGREGATIONS ---
  const assetAccounts = accounts.filter(a => a.account_type === 'ASSET');
  const liabilityAccounts = accounts.filter(a => a.account_type === 'LIABILITY');
  const equityAccounts = accounts.filter(a => a.account_type === 'EQUITY');
  
  // Calculate Net Profit (Income - Expenses) up to this date
  const totalIncome = accounts.filter(a => a.account_type === 'INCOME').reduce((sum, a) => sum + Number(a.balance), 0);
  const totalExpense = accounts.filter(a => a.account_type === 'EXPENSE').reduce((sum, a) => sum + Number(a.balance), 0);
  const netProfit = totalIncome - totalExpense;

  const totalAssets = assetAccounts.reduce((sum, a) => sum + Number(a.balance), 0);
  const totalLiabilities = liabilityAccounts.reduce((sum, a) => sum + Number(a.balance), 0);
  const totalEquity = equityAccounts.reduce((sum, a) => sum + Number(a.balance), 0);
  
  // THE GOLDEN RULE
  const totalLiabilitiesAndEquity = totalLiabilities + totalEquity + netProfit;
  const isBalanced = totalAssets.toFixed(2) === totalLiabilitiesAndEquity.toFixed(2);
  const diff = Math.abs(totalAssets - totalLiabilitiesAndEquity);

  // --- EXCEL EXPORT ---
  const handleExport = () => {
    if (accounts.length === 0) return;
    setExporting(true);

    const formattedData = [
      { 'Particulars': 'ASSETS', 'Amount (₹)': '' },
      ...assetAccounts.map(a => ({ 'Particulars': `  ${a.account_name} (${a.account_code})`, 'Amount (₹)': a.balance })),
      { 'Particulars': 'TOTAL ASSETS', 'Amount (₹)': totalAssets },
      { 'Particulars': '', 'Amount (₹)': '' },
      { 'Particulars': 'LIABILITIES', 'Amount (₹)': '' },
      ...liabilityAccounts.map(a => ({ 'Particulars': `  ${a.account_name} (${a.account_code})`, 'Amount (₹)': a.balance })),
      { 'Particulars': 'TOTAL LIABILITIES', 'Amount (₹)': totalLiabilities },
      { 'Particulars': '', 'Amount (₹)': '' },
      { 'Particulars': 'EQUITY & RETAINED EARNINGS', 'Amount (₹)': '' },
      ...equityAccounts.map(a => ({ 'Particulars': `  ${a.account_name} (${a.account_code})`, 'Amount (₹)': a.balance })),
      { 'Particulars': `  Current Period Net Profit`, 'Amount (₹)': netProfit },
      { 'Particulars': 'TOTAL EQUITY', 'Amount (₹)': totalEquity + netProfit },
      { 'Particulars': '', 'Amount (₹)': '' },
      { 'Particulars': 'TOTAL LIABILITIES & EQUITY', 'Amount (₹)': totalLiabilitiesAndEquity },
    ];

    const worksheet = XLSX.utils.json_to_sheet(formattedData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Balance_Sheet");
    XLSX.writeFile(workbook, `Balance_Sheet_AsOf_${format(new Date(asOfDate), 'yyyyMMdd')}.xlsx`);
    
    setExporting(false);
  }

  const SectionRow = ({ acc }: { acc: BSAccount }) => (
    <div className="flex justify-between items-center py-2 border-b border-zinc-100 hover:bg-zinc-50/50 transition-colors px-2">
      <div className="flex items-center gap-2">
        <span className="font-mono text-[11px] text-zinc-400">{acc.account_code}</span>
        <span className="text-[13px] font-medium text-zinc-700">{acc.account_name}</span>
      </div>
      <span className="text-[13px] font-medium text-zinc-900">{formatCurrency(acc.balance)}</span>
    </div>
  )

  return (
    <div className="space-y-5 animate-in fade-in duration-500 max-w-5xl mx-auto">
      
      {/* TOOLBAR */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-3 rounded-2xl border border-zinc-200 shadow-sm print:hidden">
        <div className="flex items-center bg-zinc-50 border border-zinc-200 rounded-full px-4 h-9 focus-within:border-zinc-400 min-w-0">
          <Calendar className="w-3.5 h-3.5 text-zinc-400 shrink-0 mr-2" />
          <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-widest mr-2">As Of:</span>
          <input type="date" className="bg-transparent text-[12px] font-mono font-bold outline-none w-auto text-zinc-800" value={asOfDate} onChange={e => setAsOfDate(e.target.value)} />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button variant="outline" size="icon" className="h-9 w-9 rounded-full border-zinc-200 text-zinc-600" onClick={fetchBalanceSheet}>
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button onClick={handleExport} disabled={exporting || loading} className="h-9 text-xs font-medium rounded-full text-zinc-700 border border-zinc-200 bg-white shadow-sm flex-1 sm:flex-none">
            {exporting ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Download className="sm:mr-2 h-3.5 w-3.5" />}
            <span className="hidden sm:inline-block">Export Balance Sheet</span>
          </Button>
        </div>
      </div>

      {/* HIGHLIGHT KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
        <Card className="shadow-sm border-zinc-200 bg-white rounded-2xl">
          <CardContent className="p-4 sm:p-5">
            <p className="text-[11px] font-medium text-zinc-500 mb-1 flex items-center gap-1.5"><Landmark className="h-3.5 w-3.5 text-zinc-400" /> Total Assets</p>
            {loading ? <Skeleton className="h-8 w-32 mt-1" /> : <p className="text-xl sm:text-3xl font-semibold tracking-tighter text-zinc-900 mt-1 truncate">{formatCurrency(totalAssets)}</p>}
          </CardContent>
        </Card>
        
        <Card className="shadow-sm border-zinc-200 bg-white rounded-2xl">
          <CardContent className="p-4 sm:p-5">
            <p className="text-[11px] font-medium text-zinc-500 mb-1 flex items-center gap-1.5"><ArrowRightLeft className="h-3.5 w-3.5 text-zinc-400" /> Liabilities & Equity</p>
            {loading ? <Skeleton className="h-8 w-32 mt-1" /> : <p className="text-xl sm:text-3xl font-semibold tracking-tighter text-zinc-900 mt-1 truncate">{formatCurrency(totalLiabilitiesAndEquity)}</p>}
          </CardContent>
        </Card>

        <Card className={`shadow-sm rounded-2xl border md:col-span-1 col-span-2 ${isBalanced ? 'border-emerald-200 bg-emerald-50/50' : 'border-rose-200 bg-rose-50/50'}`}>
          <CardContent className="p-4 sm:p-5 flex flex-col justify-center h-full">
            <p className={`text-[11px] font-bold uppercase tracking-widest mb-1 flex items-center gap-1.5 ${isBalanced ? 'text-emerald-700' : 'text-rose-700'}`}>
              {isBalanced ? <CheckCircle2 className="h-4 w-4" /> : <Scale className="h-4 w-4" />}
              {isBalanced ? 'Balance Sheet is Balanced' : 'Imbalance Detected'}
            </p>
            {!loading && !isBalanced && (
              <p className="text-lg font-black text-rose-900 mt-1 tracking-tight">Off by {formatCurrency(diff)}</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* THE BALANCE SHEET (2-Column Grid on Desktop) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-start">
        
        {/* LEFT COLUMN: ASSETS */}
        <Card className="shadow-sm border-zinc-200 bg-white rounded-2xl overflow-hidden">
          <div className="p-4 bg-zinc-50/80 border-b border-zinc-200 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
            <h2 className="text-xs font-black uppercase tracking-widest text-zinc-800">Assets</h2>
          </div>
          <div className="p-2 sm:p-4">
            {loading ? (
              <div className="space-y-4"><Skeleton className="h-6 w-full" /><Skeleton className="h-6 w-full" /></div>
            ) : assetAccounts.length === 0 ? (
              <p className="text-xs text-zinc-400 italic py-4 text-center">No assets found.</p>
            ) : (
              assetAccounts.map(acc => <SectionRow key={acc.account_id} acc={acc} />)
            )}
            
            <div className="flex justify-between items-center mt-6 pt-4 border-t-2 border-zinc-200">
              <span className="text-[13px] font-bold uppercase tracking-widest text-zinc-500">Total Assets</span>
              <span className="text-[16px] font-black text-emerald-800 bg-emerald-50 px-3 py-1 rounded-lg border border-emerald-100">{formatCurrency(totalAssets)}</span>
            </div>
          </div>
        </Card>

        {/* RIGHT COLUMN: LIABILITIES & EQUITY */}
        <div className="space-y-5">
          
          <Card className="shadow-sm border-zinc-200 bg-white rounded-2xl overflow-hidden">
            <div className="p-4 bg-zinc-50/80 border-b border-zinc-200 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-rose-500"></div>
              <h2 className="text-xs font-black uppercase tracking-widest text-zinc-800">Liabilities</h2>
            </div>
            <div className="p-2 sm:p-4">
              {loading ? (
                <div className="space-y-4"><Skeleton className="h-6 w-full" /><Skeleton className="h-6 w-full" /></div>
              ) : liabilityAccounts.length === 0 ? (
                <p className="text-xs text-zinc-400 italic py-4 text-center">No liabilities found.</p>
              ) : (
                liabilityAccounts.map(acc => <SectionRow key={acc.account_id} acc={acc} />)
              )}
              
              <div className="flex justify-between items-center mt-4 pt-3 border-t border-zinc-100">
                <span className="text-[12px] font-bold text-zinc-500">Total Liabilities</span>
                <span className="text-[14px] font-bold text-zinc-900">{formatCurrency(totalLiabilities)}</span>
              </div>
            </div>
          </Card>

          <Card className="shadow-sm border-zinc-200 bg-white rounded-2xl overflow-hidden">
            <div className="p-4 bg-zinc-50/80 border-b border-zinc-200 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-purple-500"></div>
              <h2 className="text-xs font-black uppercase tracking-widest text-zinc-800">Equity & Retained Earnings</h2>
            </div>
            <div className="p-2 sm:p-4">
              {loading ? (
                <div className="space-y-4"><Skeleton className="h-6 w-full" /></div>
              ) : (
                <>
                  {equityAccounts.map(acc => <SectionRow key={acc.account_id} acc={acc} />)}
                  
                  {/* Dynamic Net Profit Injection */}
                  <div className="flex justify-between items-center py-2 border-b border-zinc-100 hover:bg-zinc-50/50 px-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[11px] text-zinc-400">SYS</span>
                      <span className="text-[13px] font-medium text-zinc-700">Current Period Net Profit</span>
                    </div>
                    <span className={`text-[13px] font-bold ${netProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {formatCurrency(netProfit)}
                    </span>
                  </div>
                </>
              )}
              
              <div className="flex justify-between items-center mt-6 pt-4 border-t-2 border-zinc-200">
                <span className="text-[13px] font-bold uppercase tracking-widest text-zinc-500">Total Liab & Equity</span>
                <span className={`text-[16px] font-black px-3 py-1 rounded-lg border ${isBalanced ? 'text-emerald-800 bg-emerald-50 border-emerald-100' : 'text-rose-800 bg-rose-50 border-rose-100'}`}>
                  {formatCurrency(totalLiabilitiesAndEquity)}
                </span>
              </div>
            </div>
          </Card>

        </div>
      </div>
    </div>
  )
}