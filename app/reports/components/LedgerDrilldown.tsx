"use client"

import React, { useEffect, useState } from 'react'
import { format, startOfMonth, startOfYear } from 'date-fns'
import { ArrowLeft, Calendar, Download, Loader2, ExternalLink } from 'lucide-react'
import * as XLSX from 'xlsx'

import { supabase } from '@/lib/supabaseClient'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table, TableBody, TableCell, TableHead, 
  TableHeader, TableRow
} from '@/components/ui/table'
import { toast } from '@/hooks/use-toast'

interface LedgerDrilldownProps {
  companyId: string;
  account: {
    account_id: string;
    account_code: string;
    account_name: string;
    account_type: string;
  };
  onBack: () => void;
}

export function LedgerDrilldown({ companyId, account, onBack }: LedgerDrilldownProps) {
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  
  const [startDate, setStartDate] = useState(() => format(startOfMonth(new Date()), 'yyyy-MM-dd'))
  const [endDate, setEndDate] = useState(() => format(new Date(), 'yyyy-MM-dd'))

  const [rows, setRows] = useState<any[]>([])
  
  const [totals, setTotals] = useState({ opening: 0, periodDr: 0, periodCr: 0, closing: 0 })

  const fetchStatement = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase.rpc('get_ledger_statement_rows', {
        p_company_id: companyId,
        p_account_id: account.account_id,
        p_start_date: startDate,
        p_end_date: endDate
      })

      if (error) throw error

      setRows(data || [])

      // Calculate Footer Totals
      if (data && data.length > 0) {
        const openingRow = data.find((r: any) => r.is_opening)
        const closingRow = data[data.length - 1]
        
        let pDr = 0
        let pCr = 0
        data.forEach((r: any) => {
          if (!r.is_opening) {
            pDr += Number(r.debit)
            pCr += Number(r.credit)
          }
        })

        setTotals({
          opening: openingRow ? Number(openingRow.running_balance) : 0,
          periodDr: pDr,
          periodCr: pCr,
          closing: Number(closingRow.running_balance)
        })
      }
    } catch (err: any) {
      toast({ title: "Fetch Failed", description: err.message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchStatement() }, [companyId, account.account_id, startDate, endDate])

  // Formatting Helper for strict Dr/Cr display
  const formatDrCr = (val: number) => {
    if (val === 0) return '₹0.00';
    const isDr = val > 0;
    const absVal = Math.abs(val).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return (
      <span className={isDr ? 'text-emerald-700' : 'text-rose-700'}>
        ₹{absVal} <span className="text-[10px] font-bold opacity-80">{isDr ? 'Dr' : 'Cr'}</span>
      </span>
    );
  }

  const setDatePreset = (preset: 'month' | 'year') => {
    const today = new Date();
    setEndDate(format(today, 'yyyy-MM-dd'));
    if (preset === 'month') setStartDate(format(startOfMonth(today), 'yyyy-MM-dd'));
    if (preset === 'year') setStartDate(format(startOfYear(today), 'yyyy-MM-dd')); // Or April 1st for Indian FY
  }

  const handleExport = () => {
    if (rows.length === 0) return;
    setExporting(true);

    const formattedData = rows.map(tx => ({
      'Date': format(new Date(tx.entry_date), 'dd-MMM-yyyy'),
      'Voucher': tx.entry_number,
      'Description': tx.description,
      'Debit (₹)': tx.debit > 0 ? tx.debit : '',
      'Credit (₹)': tx.credit > 0 ? tx.credit : '',
      'Balance (₹)': Math.abs(tx.running_balance),
      'Dr/Cr': tx.running_balance > 0 ? 'Dr' : 'Cr'
    }));

    const worksheet = XLSX.utils.json_to_sheet(formattedData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Ledger");
    XLSX.writeFile(workbook, `Ledger_${account.account_code}_${format(new Date(), 'yyyyMMdd')}.xlsx`);
    
    setExporting(false);
  }

  return (
    <div className="space-y-4 animate-in slide-in-from-right-4 duration-300">
      
      {/* HEADER & FILTERS */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 bg-white p-3 sm:p-4 rounded-2xl border border-zinc-200 shadow-sm">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" onClick={onBack} className="h-9 w-9 rounded-full border-zinc-200 text-zinc-600 hover:bg-zinc-100">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h2 className="text-sm font-bold text-zinc-900 tracking-tight flex items-center gap-2">
              <span className="font-mono text-zinc-400 font-medium">{account.account_code}</span> 
              {account.account_name}
            </h2>
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">{account.account_type} LEDGER</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full xl:w-auto">
          {/* Quick Filters */}
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
          <Button onClick={handleExport} disabled={exporting || loading} className="h-9 text-xs font-medium rounded-full shrink-0 text-zinc-700 border border-zinc-200 bg-white shadow-sm">
            {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin sm:mr-2" /> : <Download className="h-3.5 w-3.5 sm:mr-2" />}
            <span className="hidden sm:inline-block">Export</span>
          </Button>
        </div>
      </div>

      {/* TRANSACTION TABLE */}
      <Card className="shadow-sm border-zinc-200 bg-white rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-zinc-50/80 border-b border-zinc-200">
              <TableRow className="hover:bg-transparent border-none">
                <TableHead className="h-10 text-[10px] font-bold text-zinc-500 uppercase tracking-widest px-4 w-28">Date</TableHead>
                <TableHead className="h-10 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Particulars</TableHead>
                <TableHead className="h-10 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Vch Type</TableHead>
                <TableHead className="h-10 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Vch No.</TableHead>
                <TableHead className="h-10 text-[10px] font-bold text-zinc-500 uppercase tracking-widest text-right bg-emerald-50/30">Debit</TableHead>
                <TableHead className="h-10 text-[10px] font-bold text-zinc-500 uppercase tracking-widest text-right bg-rose-50/30 border-r border-zinc-100">Credit</TableHead>
                <TableHead className="h-10 text-[10px] font-bold text-zinc-500 uppercase tracking-widest text-right pr-6">Balance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={7} className="h-32 text-center"><Loader2 className="h-6 w-6 animate-spin text-zinc-300 mx-auto" /></TableCell></TableRow>
              ) : rows.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="h-24 text-center text-xs font-medium text-zinc-400">No transactions in this period.</TableCell></TableRow>
              ) : (
                <>
                  {rows.map((tx, idx) => (
                    <TableRow 
                      key={idx} 
                      className={`hover:bg-zinc-50/80 transition-colors border-zinc-100 ${tx.is_opening ? 'bg-zinc-50/50' : ''}`}
                    >
                      <TableCell className="px-4 py-2.5 text-[12px] font-medium text-zinc-600 whitespace-nowrap">
                        {format(new Date(tx.entry_date), 'dd MMM yy')}
                      </TableCell>
                      <TableCell className="text-[13px] font-medium text-zinc-800 max-w-[300px] truncate">
                        {tx.description}
                      </TableCell>
                      <TableCell>
                        <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest">{tx.is_opening ? '--' : tx.reference_type?.replace('_', ' ')}</span>
                      </TableCell>
                      <TableCell>
                        {!tx.is_opening && (
                          <button 
                            className="font-mono text-[11px] font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100 hover:bg-blue-100 transition-colors flex items-center gap-1 group"
                            onClick={() => toast({ title: "Opening Voucher...", description: `Navigating to ${tx.entry_number}` })}
                          >
                            {tx.entry_number}
                            <ExternalLink className="h-2.5 w-2.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </button>
                        )}
                      </TableCell>
                      <TableCell className="text-right text-[13px] font-medium text-zinc-900 bg-emerald-50/10">
                        {tx.debit > 0 ? tx.debit.toLocaleString('en-IN', {minimumFractionDigits:2}) : ''}
                      </TableCell>
                      <TableCell className="text-right text-[13px] font-medium text-zinc-900 bg-rose-50/10 border-r border-zinc-100/50">
                        {tx.credit > 0 ? tx.credit.toLocaleString('en-IN', {minimumFractionDigits:2}) : ''}
                      </TableCell>
                      <TableCell className="text-right text-[13px] font-bold pr-6">
                        {formatDrCr(tx.running_balance)}
                      </TableCell>
                    </TableRow>
                  ))}
                  
                  {/* RUNNING TOTALS FOOTER */}
                  <TableRow className="bg-zinc-100/60 hover:bg-zinc-100/60 border-t-2 border-zinc-200">
                    <TableCell colSpan={4} className="px-4 py-4 text-[11px] font-bold text-zinc-500 uppercase tracking-widest text-right">
                      Period Totals & Closing Balance
                    </TableCell>
                    <TableCell className="text-right text-[13px] font-bold text-emerald-800 bg-emerald-50/30">
                      ₹{totals.periodDr.toLocaleString('en-IN', {minimumFractionDigits: 2})}
                    </TableCell>
                    <TableCell className="text-right text-[13px] font-bold text-rose-800 bg-rose-50/30 border-r border-zinc-200">
                      ₹{totals.periodCr.toLocaleString('en-IN', {minimumFractionDigits: 2})}
                    </TableCell>
                    <TableCell className="text-right text-[14px] font-black text-zinc-900 pr-6">
                      {formatDrCr(totals.closing)}
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