"use client"

import React, { useEffect, useState } from 'react'
import { format } from 'date-fns'
import * as XLSX from 'xlsx'
import { 
  Download, Loader2, Search, RefreshCw, 
  BookOpen, Scale, AlertCircle, Hash
} from 'lucide-react'

import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabaseClient'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/hooks/use-toast'
import {
  Table, TableBody, TableCell, TableHead, 
  TableHeader, TableRow
} from '@/components/ui/table'

interface AccountBalance {
  account_id: string;
  account_code: string;
  account_name: string;
  account_type: string;
  category: string;
  opening_balance: number;
  debit_movement: number;
  credit_movement: number;
  closing_debit: number;
  closing_credit: number;
}

export function TrialBalanceReport() {
  const { appUser } = useAuth()
  const { toast } = useToast()
  
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [search, setSearch] = useState('')
  
  const [accounts, setAccounts] = useState<AccountBalance[]>([])
  
  const [totals, setTotals] = useState({
    debit: 0,
    credit: 0,
    accountCount: 0
  })

  const formatCurrency = (val: number) => {
    if (!val || val === 0) return '--';
    return `₹${val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  const fetchTrialBalance = async () => {
    if (!appUser?.company_id) return
    setLoading(true)

    try {
      // Call the optimized PostgreSQL function
      const { data, error } = await supabase.rpc('get_trial_balance', {
        p_company_id: appUser.company_id,
        p_search: search.trim()
      })

      if (error) throw error

      let totalDr = 0
      let totalCr = 0

      const processedData: AccountBalance[] = (data || []).map((acc: any) => {
        totalDr += Number(acc.closing_debit)
        totalCr += Number(acc.closing_credit)
        return acc
      })

      setAccounts(processedData)
      setTotals({ 
        debit: totalDr, 
        credit: totalCr, 
        accountCount: processedData.length 
      })

    } catch (err: any) {
      toast({ title: "Fetch Failed", description: err.message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  // Debounced search
  useEffect(() => {
    const delay = setTimeout(() => { fetchTrialBalance() }, 300)
    return () => clearTimeout(delay)
  }, [appUser, search])

  const handleExport = () => {
    if (accounts.length === 0) return
    setExporting(true)

    const formattedData = accounts.map((a) => ({
      'Code': a.account_code,
      'Account Name': a.account_name,
      'Type': a.account_type,
      'Opening Balance': a.opening_balance || 0,
      'Period Dr': a.debit_movement || 0,
      'Period Cr': a.credit_movement || 0,
      'Closing Dr': a.closing_debit || 0,
      'Closing Cr': a.closing_credit || 0
    }))

    formattedData.push({
      'Code': '',
      'Account Name': 'GRAND TOTAL',
      'Type': '',
      'Opening Balance': 0,
      'Period Dr': 0,
      'Period Cr': 0,
      'Closing Dr': totals.debit,
      'Closing Cr': totals.credit
    })

    const worksheet = XLSX.utils.json_to_sheet(formattedData)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, "Trial_Balance")
    XLSX.writeFile(workbook, `Trial_Balance_${format(new Date(), 'yyyyMMdd')}.xlsx`)
    
    setExporting(false)
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'ASSET': return 'bg-emerald-50 text-emerald-700 border-emerald-200'
      case 'LIABILITY': return 'bg-rose-50 text-rose-700 border-rose-200'
      case 'EQUITY': return 'bg-purple-50 text-purple-700 border-purple-200'
      case 'INCOME': return 'bg-blue-50 text-blue-700 border-blue-200'
      case 'EXPENSE': return 'bg-amber-50 text-amber-700 border-amber-200'
      default: return 'bg-zinc-100 text-zinc-600 border-zinc-200'
    }
  }

  const isBalanced = totals.debit.toFixed(2) === totals.credit.toFixed(2)

  return (
    <div className="space-y-5 animate-in fade-in duration-500">
      
      {/* TOOLBAR */}
      <div className="flex flex-col sm:flex-row gap-2.5 bg-white p-2.5 rounded-2xl border border-zinc-200 shadow-sm print:hidden">
        <div className="relative flex-1 min-w-[250px]">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
          <Input 
            placeholder="Search Ledger (e.g. 1000 or Cash)..." 
            className="pl-9 h-9 text-xs rounded-full bg-zinc-50 border-zinc-200 focus-visible:ring-zinc-400 font-medium text-zinc-800" 
            value={search} 
            onChange={(e) => setSearch(e.target.value)} 
          />
        </div>
        
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="h-9 w-9 rounded-full border-zinc-200 text-zinc-600" onClick={fetchTrialBalance}>
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button onClick={handleExport} disabled={exporting || loading} className="h-9 text-xs font-medium rounded-full text-zinc-700 border border-zinc-200 bg-white shadow-sm flex-1 sm:flex-none">
            {exporting ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Download className="mr-2 h-3.5 w-3.5" />}
            Export Excel
          </Button>
        </div>
      </div>

      {/* ACCOUNTING KPIs (Corrected to show only TB relevant metrics) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <Card className="shadow-sm border-zinc-200 bg-zinc-900 text-white rounded-2xl">
          <CardContent className="p-4 sm:p-5">
            <p className="text-[11px] font-medium text-zinc-400 mb-1 flex items-center gap-1.5">
              <Scale className="h-3.5 w-3.5" /> Total Debits
            </p>
            {loading ? <Skeleton className="h-8 w-24 mt-1 bg-zinc-800" /> : <p className="text-2xl sm:text-3xl font-semibold tracking-tighter mt-1 truncate">₹{totals.debit.toLocaleString(undefined, {minimumFractionDigits: 2})}</p>}
          </CardContent>
        </Card>
        
        <Card className="shadow-sm border-zinc-200 bg-zinc-900 text-white rounded-2xl">
          <CardContent className="p-4 sm:p-5">
            <p className="text-[11px] font-medium text-zinc-400 mb-1 flex items-center gap-1.5">
              <Scale className="h-3.5 w-3.5" /> Total Credits
            </p>
            {loading ? <Skeleton className="h-8 w-24 mt-1 bg-zinc-800" /> : <p className="text-2xl sm:text-3xl font-semibold tracking-tighter mt-1 truncate">₹{totals.credit.toLocaleString(undefined, {minimumFractionDigits: 2})}</p>}
          </CardContent>
        </Card>

        <Card className={`shadow-sm rounded-2xl border ${isBalanced ? 'border-emerald-200 bg-emerald-50/50' : 'border-rose-200 bg-rose-50/50'}`}>
          <CardContent className="p-4 sm:p-5">
            <p className={`text-[11px] font-medium mb-1 flex items-center gap-1.5 ${isBalanced ? 'text-emerald-700' : 'text-rose-700'}`}>
              {isBalanced ? <Scale className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
              Imbalance
            </p>
            {loading ? <Skeleton className="h-8 w-24 mt-1" /> : <p className={`text-2xl sm:text-3xl font-semibold tracking-tighter mt-1 truncate ${isBalanced ? 'text-emerald-900' : 'text-rose-900'}`}>
              ₹{Math.abs(totals.debit - totals.credit).toLocaleString(undefined, {minimumFractionDigits: 2})}
            </p>}
          </CardContent>
        </Card>

        <Card className="shadow-sm border-zinc-200 bg-white rounded-2xl">
          <CardContent className="p-4 sm:p-5">
            <p className="text-[11px] font-medium text-zinc-500 mb-1 flex items-center gap-1.5">
              <Hash className="h-3.5 w-3.5 text-zinc-400" /> Active Accounts
            </p>
            {loading ? <Skeleton className="h-8 w-12 mt-1" /> : <p className="text-2xl sm:text-3xl font-semibold tracking-tighter text-zinc-900 mt-1">{totals.accountCount}</p>}
          </CardContent>
        </Card>
      </div>

      {/* DATA VIEW */}
      <Card className="shadow-sm border-zinc-200 bg-white rounded-2xl overflow-hidden">
        
        {/* === MOBILE LIST VIEW === */}
        <div className="block sm:hidden divide-y divide-zinc-100">
          {loading ? (
             Array.from({ length: 5 }).map((_, i) => (
               <div key={i} className="p-4 space-y-3">
                 <div className="flex justify-between"><Skeleton className="h-4 w-32" /><Skeleton className="h-5 w-16 rounded-full" /></div>
                 <div className="flex justify-between"><Skeleton className="h-3 w-20" /><Skeleton className="h-3 w-20" /></div>
               </div>
             ))
          ) : accounts.length === 0 ? (
            <div className="py-12 text-center text-zinc-400">
              <BookOpen className="h-8 w-8 mx-auto mb-3 opacity-30" />
              <p className="text-sm font-semibold tracking-tight">No ledgers matched search</p>
            </div>
          ) : (
            accounts.map((acc) => (
              <div key={`${acc.account_id}-${acc.account_code}`} className="p-4 hover:bg-zinc-50 cursor-pointer transition-colors active:bg-zinc-100">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <div className="font-semibold text-[13px] text-zinc-900 flex items-center gap-2">
                      <span className="font-mono text-zinc-400">{acc.account_code}</span> 
                      {acc.account_name}
                    </div>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-widest border ${getTypeColor(acc.account_type)}`}>
                    {acc.account_type}
                  </span>
                </div>
                
                <div className="flex justify-between items-end mt-2 pt-3 border-t border-zinc-100/80">
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-400">Debit</p>
                    <p className="text-xs font-semibold text-zinc-800">{formatCurrency(acc.closing_debit)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-400">Credit</p>
                    <p className="text-xs font-semibold text-zinc-800">{formatCurrency(acc.closing_credit)}</p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* === DESKTOP TABLE VIEW === */}
        <div className="hidden sm:block overflow-x-auto">
          <Table>
            <TableHeader className="bg-zinc-50/80">
              <TableRow className="hover:bg-transparent border-zinc-200">
                <TableHead className="h-11 text-[10px] font-bold text-zinc-500 uppercase tracking-widest px-4 w-20">Code</TableHead>
                <TableHead className="h-11 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Ledger Account</TableHead>
                <TableHead className="h-11 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Type</TableHead>
                <TableHead className="h-11 text-[10px] font-bold text-zinc-500 uppercase tracking-widest text-right bg-zinc-100/50">Opening</TableHead>
                <TableHead className="h-11 text-[10px] font-bold text-zinc-500 uppercase tracking-widest text-right">Period Dr</TableHead>
                <TableHead className="h-11 text-[10px] font-bold text-zinc-500 uppercase tracking-widest text-right border-r border-zinc-100">Period Cr</TableHead>
                <TableHead className="h-11 text-[10px] font-bold text-zinc-500 uppercase tracking-widest text-right bg-zinc-100/50">Closing Dr</TableHead>
                <TableHead className="h-11 text-[10px] font-bold text-zinc-500 uppercase tracking-widest text-right pr-6 bg-zinc-100/50">Closing Cr</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i} className="border-zinc-100">
                    <TableCell className="px-4 py-3"><Skeleton className="h-4 w-10" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-16 rounded-full" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                    <TableCell className="pr-6"><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : accounts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-40 text-center text-zinc-400">
                    <BookOpen className="h-6 w-6 mx-auto mb-2 opacity-30" />
                    <p className="text-xs font-semibold tracking-tight">No ledgers matched criteria</p>
                  </TableCell>
                </TableRow>
              ) : (
                <>
                  {accounts.map((acc) => (
                    <TableRow key={`${acc.account_id}-${acc.account_code}`} className="hover:bg-zinc-50/80 transition-colors border-zinc-100 cursor-pointer group">
                      <TableCell className="px-4 py-2.5">
                        <span className="font-mono text-[12px] font-medium text-zinc-400 group-hover:text-zinc-600 transition-colors">{acc.account_code}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-[13px] font-semibold text-zinc-800">{acc.account_name}</span>
                      </TableCell>
                      <TableCell>
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-widest border ${getTypeColor(acc.account_type)}`}>
                          {acc.account_type}
                        </span>
                      </TableCell>
                      <TableCell className="text-right text-[13px] font-medium text-zinc-400 bg-zinc-50/30">
                        {acc.opening_balance !== 0 ? acc.opening_balance.toLocaleString(undefined, {minimumFractionDigits: 2}) : '--'}
                      </TableCell>
                      <TableCell className="text-right text-[13px] font-medium text-zinc-600">
                        {formatCurrency(acc.debit_movement)}
                      </TableCell>
                      <TableCell className="text-right text-[13px] font-medium text-zinc-600 border-r border-zinc-100/50">
                        {formatCurrency(acc.credit_movement)}
                      </TableCell>
                      <TableCell className="text-right text-[13px] font-bold text-zinc-900 bg-zinc-50/30">
                        {formatCurrency(acc.closing_debit)}
                      </TableCell>
                      <TableCell className="text-right text-[13px] font-bold text-zinc-900 pr-6 bg-zinc-50/30">
                        {formatCurrency(acc.closing_credit)}
                      </TableCell>
                    </TableRow>
                  ))}
                  
                  {/* GRAND TOTAL ROW */}
                  <TableRow className="bg-zinc-50 hover:bg-zinc-50 border-t-2 border-zinc-200">
                    <TableCell colSpan={6} className="px-4 py-4 text-[11px] font-bold text-zinc-500 uppercase tracking-widest text-right">
                      Closing Balances Total
                    </TableCell>
                    <TableCell className={`text-right text-[14px] font-bold ${!isBalanced ? 'text-rose-600' : 'text-zinc-900'}`}>
                      ₹{totals.debit.toLocaleString(undefined, {minimumFractionDigits: 2})}
                    </TableCell>
                    <TableCell className={`text-right text-[14px] font-bold pr-6 ${!isBalanced ? 'text-rose-600' : 'text-zinc-900'}`}>
                      ₹{totals.credit.toLocaleString(undefined, {minimumFractionDigits: 2})}
                    </TableCell>
                  </TableRow>
                </>
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  )
}