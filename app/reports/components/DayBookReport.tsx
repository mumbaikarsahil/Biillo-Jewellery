"use client"

import React, { useEffect, useState } from 'react'
import { format, subDays, addDays } from 'date-fns'
import * as XLSX from 'xlsx'
import { 
  Download, Loader2, RefreshCw, Calendar, 
  BookOpen, ChevronLeft, ChevronRight, Clock
} from 'lucide-react'

import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabaseClient'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/hooks/use-toast'
import {
  Table, TableBody, TableCell, TableHead, 
  TableHeader, TableRow
} from '@/components/ui/table'

interface DayBookLine {
  journal_id: string;
  created_at: string;
  entry_number: string;
  reference_type: string;
  description: string;
  account_code: string;
  account_name: string;
  account_type: string;
  debit: number;
  credit: number;
}

interface GroupedVoucher {
  journal_id: string;
  entry_number: string;
  created_at: string;
  reference_type: string;
  description: string;
  lines: DayBookLine[];
}

export function DayBookReport() {
  const { appUser } = useAuth()
  const { toast } = useToast()
  
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  
  const [targetDate, setTargetDate] = useState(() => format(new Date(), 'yyyy-MM-dd'))
  const [vouchers, setVouchers] = useState<GroupedVoucher[]>([])
  
  const [totals, setTotals] = useState({ debit: 0, credit: 0, voucherCount: 0 })

  const fetchDayBook = async () => {
    if (!appUser?.company_id) return
    setLoading(true)

    try {
      const { data, error } = await supabase.rpc('get_day_book', {
        p_company_id: appUser.company_id,
        p_date: targetDate
      })

      if (error) throw error

      // Group the flat lines into Vouchers
      const grouped = (data || []).reduce((acc: any[], line: DayBookLine) => {
        let voucher = acc.find(v => v.journal_id === line.journal_id);
        if (!voucher) {
          voucher = {
            journal_id: line.journal_id,
            entry_number: line.entry_number,
            created_at: line.created_at,
            reference_type: line.reference_type,
            description: line.description,
            lines: []
          };
          acc.push(voucher);
        }
        voucher.lines.push(line);
        return acc;
      }, []);

      setVouchers(grouped);

      // Calculate Totals for the Day
      let dr = 0; let cr = 0;
      data?.forEach((l: DayBookLine) => {
        dr += Number(l.debit);
        cr += Number(l.credit);
      });

      setTotals({ debit: dr, credit: cr, voucherCount: grouped.length });

    } catch (err: any) {
      toast({ title: "Fetch Failed", description: err.message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchDayBook() }, [appUser, targetDate])

  const formatCurrency = (val: number) => {
    if (!val || val === 0) return '';
    return `₹${val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  const changeDate = (days: number) => {
    const newDate = addDays(new Date(targetDate), days);
    setTargetDate(format(newDate, 'yyyy-MM-dd'));
  }

  const handleExport = () => {
    if (vouchers.length === 0) return;
    setExporting(true);

    const formattedData: any[] = [];

    vouchers.forEach(v => {
      // Add a header row for the voucher
      formattedData.push({
        'Time': format(new Date(v.created_at), 'HH:mm'),
        'Voucher No': v.entry_number,
        'Particulars': `[${v.reference_type.replace(/_/g, ' ').toUpperCase()}] ${v.description}`,
        'Debit (₹)': '',
        'Credit (₹)': ''
      });
      
      // Add the ledger lines
      v.lines.forEach(l => {
        formattedData.push({
          'Time': '',
          'Voucher No': '',
          'Particulars': `   ${l.account_name} (${l.account_code})`,
          'Debit (₹)': l.debit > 0 ? l.debit : '',
          'Credit (₹)': l.credit > 0 ? l.credit : ''
        });
      });
    });

    // Add totals
    formattedData.push({
      'Time': '',
      'Voucher No': '',
      'Particulars': 'TOTAL FOR THE DAY',
      'Debit (₹)': totals.debit,
      'Credit (₹)': totals.credit
    });

    const worksheet = XLSX.utils.json_to_sheet(formattedData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Day_Book");
    XLSX.writeFile(workbook, `Day_Book_${format(new Date(targetDate), 'yyyyMMdd')}.xlsx`);
    
    setExporting(false);
  }

  return (
    <div className="space-y-5 animate-in fade-in duration-500 max-w-5xl mx-auto">
      
      {/* TOOLBAR */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-3 rounded-2xl border border-zinc-200 shadow-sm print:hidden">
        
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => changeDate(-1)} className="h-9 w-9 rounded-full border-zinc-200 text-zinc-600">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          
          <div className="flex items-center bg-zinc-50 border border-zinc-200 rounded-full px-4 h-9 focus-within:border-zinc-400 min-w-0">
            <Calendar className="w-3.5 h-3.5 text-zinc-400 shrink-0 mr-2" />
            <input type="date" className="bg-transparent text-[12px] font-mono font-bold outline-none text-zinc-800" value={targetDate} onChange={e => setTargetDate(e.target.value)} />
          </div>

          <Button variant="outline" size="icon" onClick={() => changeDate(1)} className="h-9 w-9 rounded-full border-zinc-200 text-zinc-600" disabled={targetDate === format(new Date(), 'yyyy-MM-dd')}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button variant="outline" size="icon" className="h-9 w-9 rounded-full border-zinc-200 text-zinc-600" onClick={fetchDayBook}>
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button onClick={handleExport} disabled={exporting || loading} className="h-9 text-xs font-medium rounded-full text-zinc-700 border border-zinc-200 bg-white shadow-sm flex-1 sm:flex-none">
            {exporting ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Download className="sm:mr-2 h-3.5 w-3.5" />}
            <span className="hidden sm:inline-block">Export Day Book</span>
          </Button>
        </div>
      </div>

      {/* DAILY SUMMARY KPIs */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        <Card className="shadow-sm border-zinc-200 bg-white rounded-2xl">
          <CardContent className="p-4 sm:p-5">
            <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Total Vouchers</p>
            {loading ? <Skeleton className="h-8 w-16 mt-1" /> : <p className="text-2xl font-black tracking-tighter text-zinc-900 mt-1">{totals.voucherCount}</p>}
          </CardContent>
        </Card>
        
        <Card className="shadow-sm border-emerald-200 bg-emerald-50/50 rounded-2xl">
          <CardContent className="p-4 sm:p-5">
            <p className="text-[11px] font-bold text-emerald-600 uppercase tracking-widest mb-1">Daily Debit Volume</p>
            {loading ? <Skeleton className="h-8 w-24 mt-1" /> : <p className="text-2xl font-black tracking-tighter text-emerald-900 mt-1 truncate">₹{totals.debit.toLocaleString(undefined, {maximumFractionDigits:0})}</p>}
          </CardContent>
        </Card>

        <Card className="shadow-sm border-rose-200 bg-rose-50/50 rounded-2xl">
          <CardContent className="p-4 sm:p-5">
            <p className="text-[11px] font-bold text-rose-600 uppercase tracking-widest mb-1">Daily Credit Volume</p>
            {loading ? <Skeleton className="h-8 w-24 mt-1" /> : <p className="text-2xl font-black tracking-tighter text-rose-900 mt-1 truncate">₹{totals.credit.toLocaleString(undefined, {maximumFractionDigits:0})}</p>}
          </CardContent>
        </Card>
      </div>

      {/* CHRONOLOGICAL LEDGER (DAY BOOK) */}
      <Card className="shadow-sm border-zinc-200 bg-white rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-zinc-50/80">
              <TableRow className="hover:bg-transparent border-zinc-200">
                <TableHead className="h-11 text-[10px] font-bold text-zinc-500 uppercase tracking-widest px-4 w-24">Time</TableHead>
                <TableHead className="h-11 text-[10px] font-bold text-zinc-500 uppercase tracking-widest w-40">Vch No.</TableHead>
                <TableHead className="h-11 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Particulars (Ledger Account)</TableHead>
                <TableHead className="h-11 text-[10px] font-bold text-zinc-500 uppercase tracking-widest text-right bg-emerald-50/30 w-32">Debit (₹)</TableHead>
                <TableHead className="h-11 text-[10px] font-bold text-zinc-500 uppercase tracking-widest text-right bg-rose-50/30 w-32 pr-6">Credit (₹)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={5} className="h-32 text-center"><Loader2 className="h-6 w-6 animate-spin text-zinc-300 mx-auto" /></TableCell></TableRow>
              ) : vouchers.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="h-40 text-center text-zinc-400">
                  <BookOpen className="h-8 w-8 mx-auto mb-3 opacity-30" />
                  <p className="text-sm font-semibold tracking-tight">No transactions recorded on this date.</p>
                </TableCell></TableRow>
              ) : (
                vouchers.map((v, vIndex) => (
                  <React.Fragment key={v.journal_id}>
                    {/* Voucher Header Row */}
                    <TableRow className={`border-none ${vIndex !== 0 ? 'border-t border-zinc-200/60' : ''} bg-zinc-50/30 hover:bg-zinc-50/30`}>
                      <TableCell className="px-4 py-2.5">
                        <div className="flex items-center gap-1.5 text-[11px] font-mono text-zinc-500">
                          <Clock className="h-3 w-3" /> {format(new Date(v.created_at), 'HH:mm')}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="font-mono text-[11px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                          {v.entry_number}
                        </span>
                      </TableCell>
                      <TableCell colSpan={3} className="text-[12px] font-semibold text-zinc-700">
                        {v.description} <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-2 bg-zinc-100 px-1.5 py-0.5 rounded">{v.reference_type.replace(/_/g, ' ')}</span>
                      </TableCell>
                    </TableRow>

                    {/* Voucher Lines (Ledgers) */}
                    {v.lines.map((l, lIndex) => (
                      <TableRow key={`${v.journal_id}-${lIndex}`} className="border-none hover:bg-zinc-50/50">
                        <TableCell colSpan={2}></TableCell>
                        <TableCell className="py-2">
                          <div className="flex items-center gap-2">
                            {/* Indent Credits slightly, classic accounting style */}
                            {Number(l.credit) > 0 && <span className="w-4"></span>}
                            <span className="text-[10px] font-mono text-zinc-400">{l.account_code}</span>
                            <span className="text-[13px] font-medium text-zinc-800">{l.account_name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right text-[13px] font-bold text-emerald-700 bg-emerald-50/10">
                          {formatCurrency(l.debit)}
                        </TableCell>
                        <TableCell className="text-right text-[13px] font-bold text-rose-700 bg-rose-50/10 pr-6">
                          {formatCurrency(l.credit)}
                        </TableCell>
                      </TableRow>
                    ))}
                    
                    {/* Add a tiny visual gap between vouchers */}
                    <TableRow className="h-2 border-none hover:bg-transparent"><TableCell colSpan={5} className="p-0"></TableCell></TableRow>
                  </React.Fragment>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  )
}