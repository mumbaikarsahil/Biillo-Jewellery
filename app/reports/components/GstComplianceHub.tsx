"use client"

import React, { useEffect, useState } from 'react'
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns'
import * as XLSX from 'xlsx'
import { 
  Download, Loader2, RefreshCw, Calendar, 
  Scale, ArrowRightLeft, FileText, CheckCircle2, AlertTriangle
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

export function GstComplianceHub() {
  const { appUser } = useAuth()
  const { toast } = useToast()
  
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [activeTab, setActiveTab] = useState<'3B' | 'GSTR1' | 'GSTR2'>('3B')
  
  // Date State
  const [datePreset, setDatePreset] = useState<'this_month' | 'last_month' | 'custom'>('this_month')
  const [startDate, setStartDate] = useState(() => format(startOfMonth(new Date()), 'yyyy-MM-dd'))
  const [endDate, setEndDate] = useState(() => format(endOfMonth(new Date()), 'yyyy-MM-dd'))

  const [data, setData] = useState<any>({ gstr1: [], gstr2: [], summary: {} })

  const fetchGstData = async () => {
    if (!appUser?.company_id) return
    setLoading(true)

    try {
      const { data: rpcData, error } = await supabase.rpc('get_gst_compliance_data', {
        p_company_id: appUser.company_id,
        p_start_date: startDate,
        p_end_date: endDate
      })

      if (error) throw error
      setData(rpcData)
    } catch (err: any) {
      toast({ title: "Fetch Failed", description: err.message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchGstData() }, [appUser, startDate, endDate])

  const formatCurrency = (val: number) => {
    return `₹${Math.abs(val || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  const handlePresetSelect = (preset: 'this_month' | 'last_month') => {
    setDatePreset(preset);
    const offset = preset === 'this_month' ? 0 : 1;
    const targetDate = subMonths(new Date(), offset);
    setStartDate(format(startOfMonth(targetDate), 'yyyy-MM-dd'));
    setEndDate(format(endOfMonth(targetDate), 'yyyy-MM-dd'));
  }

  const handleManualDateChange = (type: 'start' | 'end', val: string) => {
    setDatePreset('custom');
    if (type === 'start') setStartDate(val);
    if (type === 'end') setEndDate(val);
  }

  const handleExport = () => {
    setExporting(true);
    const workbook = XLSX.utils.book_new();

    if (data.gstr1.length > 0) {
      const ws1 = XLSX.utils.json_to_sheet(data.gstr1.map((r: any) => ({
        'Date': format(new Date(r.invoice_date), 'dd-MMM-yyyy'),
        'Invoice No': r.invoice_number,
        'Party Name': r.customer_name,
        'GSTIN/URD': r.gstin,
        'Type': r.type,
        'Taxable Value': r.taxable_value,
        'Tax Amount': r.tax_amount,
        'Total Invoice': r.total_amount
      })));
      XLSX.utils.book_append_sheet(workbook, ws1, "GSTR-1 (Sales)");
    }

    if (data.gstr2.length > 0) {
      const ws2 = XLSX.utils.json_to_sheet(data.gstr2.map((r: any) => ({
        'Date': format(new Date(r.invoice_date), 'dd-MMM-yyyy'),
        'Bill No': r.invoice_number,
        'Supplier Name': r.supplier_name,
        'GSTIN': r.gstin,
        'Taxable Value': r.taxable_value,
        'ITC (Input Tax)': r.tax_amount,
        'Total Bill': r.total_amount
      })));
      XLSX.utils.book_append_sheet(workbook, ws2, "GSTR-2 (Purchases)");
    }

    XLSX.writeFile(workbook, `GST_Returns_${format(new Date(startDate), 'MMM_yyyy')}.xlsx`);
    setExporting(false);
  }

  const summary = data.summary || {};
  const isPayable = summary.net_payable > 0;

  return (
    <div className="space-y-5 animate-in fade-in duration-500 max-w-6xl mx-auto">
      
      {/* HEADER TOOLBAR - REDESIGNED */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 bg-white p-2.5 rounded-2xl border border-zinc-200 shadow-sm overflow-x-auto no-scrollbar">
        
        {/* Left Side: Report Tabs */}
        <div className="flex items-center gap-1.5 bg-zinc-100 p-1 rounded-xl shrink-0 w-full sm:w-auto overflow-x-auto">
          <Button variant={activeTab === '3B' ? 'default' : 'ghost'} size="sm" className={`h-8 px-4 text-xs font-bold rounded-lg shrink-0 ${activeTab === '3B' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500'}`} onClick={() => setActiveTab('3B')}>GSTR-3B Summary</Button>
          <Button variant={activeTab === 'GSTR1' ? 'default' : 'ghost'} size="sm" className={`h-8 px-4 text-xs font-bold rounded-lg shrink-0 ${activeTab === 'GSTR1' ? 'bg-white text-blue-700 shadow-sm' : 'text-zinc-500'}`} onClick={() => setActiveTab('GSTR1')}>GSTR-1 (Sales)</Button>
          <Button variant={activeTab === 'GSTR2' ? 'default' : 'ghost'} size="sm" className={`h-8 px-4 text-xs font-bold rounded-lg shrink-0 ${activeTab === 'GSTR2' ? 'bg-white text-emerald-700 shadow-sm' : 'text-zinc-500'}`} onClick={() => setActiveTab('GSTR2')}>GSTR-2 (Purchases)</Button>
        </div>

        {/* Right Side: Filters & Actions aligned in a single row */}
        <div className="flex items-center gap-2.5 shrink-0 w-full sm:w-auto overflow-x-auto pb-1 xl:pb-0">
          
          {/* Preset Buttons - Now with active state logic */}
          <div className="flex items-center bg-zinc-100 p-1 rounded-xl shrink-0">
            <Button variant={datePreset === 'last_month' ? 'default' : 'ghost'} size="sm" className={`h-8 px-3 text-[11px] font-bold rounded-lg transition-all ${datePreset === 'last_month' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500'}`} onClick={() => handlePresetSelect('last_month')}>Last Mth</Button>
            <Button variant={datePreset === 'this_month' ? 'default' : 'ghost'} size="sm" className={`h-8 px-3 text-[11px] font-bold rounded-lg transition-all ${datePreset === 'this_month' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500'}`} onClick={() => handlePresetSelect('this_month')}>This Mth</Button>
          </div>

          {/* Date Range Picker */}
          <div className="flex items-center bg-zinc-50 border border-zinc-200 rounded-xl px-3 h-10 focus-within:border-zinc-400 shrink-0">
            <Calendar className="w-3.5 h-3.5 text-zinc-400 shrink-0 mr-1.5" />
            <input type="date" className="bg-transparent text-[11px] font-mono font-medium outline-none text-zinc-700 w-[100px]" value={startDate} onChange={e => handleManualDateChange('start', e.target.value)} />
            <span className="text-zinc-300 mx-1">-</span>
            <input type="date" className="bg-transparent text-[11px] font-mono font-medium outline-none text-zinc-700 w-[100px]" value={endDate} onChange={e => handleManualDateChange('end', e.target.value)} />
          </div>

          {/* Action Buttons */}
          <Button variant="outline" size="icon" className="h-10 w-10 shrink-0 rounded-xl border-zinc-200 text-zinc-600 hover:bg-zinc-100" onClick={fetchGstData}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button onClick={handleExport} disabled={exporting || loading} className="h-10 px-4 text-xs font-bold rounded-xl text-zinc-700 border border-zinc-200 bg-white hover:bg-zinc-50 shadow-sm shrink-0">
            {exporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
            Export Returns
          </Button>
        </div>
      </div>

      {/* GSTR-3B SUMMARY TAB */}
      {activeTab === '3B' && (
        <div className="space-y-4 animate-in slide-in-from-bottom-2">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            
            <Card className="shadow-sm border-zinc-200 bg-white rounded-2xl">
              <CardContent className="p-5 space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest">Output Tax (Sales)</p>
                    {loading ? <Skeleton className="h-8 w-32 mt-1" /> : <p className="text-3xl font-black tracking-tighter text-blue-900 mt-1">{formatCurrency(summary.outward_tax)}</p>}
                  </div>
                  <div className="bg-blue-50 p-2 rounded-lg"><ArrowRightLeft className="h-5 w-5 text-blue-500" /></div>
                </div>
                <div className="pt-3 border-t border-zinc-100 flex justify-between">
                  <span className="text-xs font-medium text-zinc-500">Taxable Value</span>
                  <span className="text-xs font-bold text-zinc-800">{formatCurrency(summary.outward_taxable)}</span>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm border-zinc-200 bg-white rounded-2xl">
              <CardContent className="p-5 space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest">Input Tax Credit (ITC)</p>
                    {loading ? <Skeleton className="h-8 w-32 mt-1" /> : <p className="text-3xl font-black tracking-tighter text-emerald-700 mt-1">{formatCurrency(summary.inward_tax)}</p>}
                  </div>
                  <div className="bg-emerald-50 p-2 rounded-lg"><FileText className="h-5 w-5 text-emerald-500" /></div>
                </div>
                <div className="pt-3 border-t border-zinc-100 flex justify-between">
                  <span className="text-xs font-medium text-zinc-500">Taxable Purchases</span>
                  <span className="text-xs font-bold text-zinc-800">{formatCurrency(summary.inward_taxable)}</span>
                </div>
              </CardContent>
            </Card>

            <Card className={`shadow-sm rounded-2xl border ${isPayable ? 'border-rose-200 bg-rose-50/50' : 'border-emerald-200 bg-emerald-50/50'}`}>
              <CardContent className="p-5 space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <p className={`text-[11px] font-bold uppercase tracking-widest ${isPayable ? 'text-rose-600' : 'text-emerald-700'}`}>
                      {isPayable ? 'Net GST Payable' : 'ITC Carry Forward'}
                    </p>
                    {loading ? <Skeleton className="h-8 w-32 mt-1" /> : <p className={`text-3xl font-black tracking-tighter mt-1 ${isPayable ? 'text-rose-900' : 'text-emerald-900'}`}>{formatCurrency(summary.net_payable)}</p>}
                  </div>
                  <div className={`${isPayable ? 'bg-rose-100/50' : 'bg-emerald-100/50'} p-2 rounded-lg`}>
                    <Scale className={`h-5 w-5 ${isPayable ? 'text-rose-600' : 'text-emerald-600'}`} />
                  </div>
                </div>
                <div className="pt-3 border-t border-zinc-200/50 flex items-center gap-2">
                  {isPayable ? <AlertTriangle className="h-4 w-4 text-rose-500" /> : <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
                  <span className={`text-xs font-bold ${isPayable ? 'text-rose-700' : 'text-emerald-800'}`}>
                    {isPayable ? 'Payment required to Gov.' : 'No tax payment required.'}
                  </span>
                </div>
              </CardContent>
            </Card>

          </div>
        </div>
      )}

      {/* GSTR-1 / GSTR-2 TABLES */}
      {(activeTab === 'GSTR1' || activeTab === 'GSTR2') && (
        <Card className="shadow-sm border-zinc-200 bg-white rounded-2xl overflow-hidden animate-in slide-in-from-bottom-2">
          <div className="p-3 bg-zinc-50/80 border-b border-zinc-200 flex justify-between items-center">
            <h2 className="text-xs font-black uppercase tracking-widest text-zinc-800">
              {activeTab === 'GSTR1' ? 'B2B & B2C Sales Register' : 'Purchase & ITC Register'}
            </h2>
            <span className="text-[10px] font-bold text-zinc-500 bg-white px-2 py-1 rounded border border-zinc-200">
              {data[activeTab === 'GSTR1' ? 'gstr1' : 'gstr2']?.length || 0} Records
            </span>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-white">
                <TableRow className="hover:bg-transparent border-zinc-200">
                  <TableHead className="h-11 text-[10px] font-bold text-zinc-500 uppercase tracking-widest px-4">Date & Invoice</TableHead>
                  <TableHead className="h-11 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Party Name</TableHead>
                  <TableHead className="h-11 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">GSTIN / Type</TableHead>
                  <TableHead className="h-11 text-[10px] font-bold text-zinc-500 uppercase tracking-widest text-right bg-zinc-50">Taxable Val</TableHead>
                  <TableHead className="h-11 text-[10px] font-bold text-zinc-500 uppercase tracking-widest text-right bg-blue-50/30">Tax Amt</TableHead>
                  <TableHead className="h-11 text-[10px] font-bold text-zinc-500 uppercase tracking-widest text-right pr-6 bg-zinc-50">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={6} className="h-32 text-center"><Loader2 className="h-6 w-6 animate-spin text-zinc-300 mx-auto" /></TableCell></TableRow>
                ) : data[activeTab === 'GSTR1' ? 'gstr1' : 'gstr2']?.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="h-32 text-center text-zinc-400 text-sm font-medium">No records filed in this period.</TableCell></TableRow>
                ) : (
                  data[activeTab === 'GSTR1' ? 'gstr1' : 'gstr2'].map((row: any, idx: number) => (
                    <TableRow key={idx} className="hover:bg-zinc-50/80 transition-colors border-zinc-100">
                      <TableCell className="px-4 py-2.5">
                        <div className="text-[12px] font-semibold text-zinc-800">{format(new Date(row.invoice_date), 'dd MMM yyyy')}</div>
                        <div className="text-[10px] font-mono text-zinc-400 mt-0.5">{row.invoice_number}</div>
                      </TableCell>
                      <TableCell className="text-[13px] font-medium text-zinc-700 max-w-[200px] truncate">
                        {row.customer_name || row.supplier_name}
                      </TableCell>
                      <TableCell>
                        <div className="font-mono text-[11px] font-medium text-zinc-600">{row.gstin}</div>
                        {row.type && (
                          <span className={`inline-block mt-1 px-1.5 py-0.5 rounded text-[9px] font-bold tracking-widest border ${row.type === 'B2B' ? 'bg-blue-50 text-blue-600 border-blue-200' : 'bg-zinc-100 text-zinc-500 border-zinc-200'}`}>
                            {row.type}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right text-[13px] font-medium text-zinc-700 bg-zinc-50/30">
                        {formatCurrency(row.taxable_value)}
                      </TableCell>
                      <TableCell className="text-right text-[13px] font-bold text-blue-700 bg-blue-50/10">
                        {formatCurrency(row.tax_amount)}
                      </TableCell>
                      <TableCell className="text-right text-[13px] font-black text-zinc-900 pr-6 bg-zinc-50/30">
                        {formatCurrency(row.total_amount)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {/* Global Style to hide scrollbars on the newly scrollable header toolbar */}
      <style dangerouslySetInnerHTML={{__html:`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}} />
    </div>
  )
}