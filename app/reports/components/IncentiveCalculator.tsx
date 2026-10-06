"use client"

import React, { useEffect, useState, useMemo } from 'react'
import { format } from 'date-fns'
import { 
  Calculator, Download, Loader2, Plus, Trash2, 
  TrendingUp, Calendar, User, Settings2, IndianRupee, FileText
} from 'lucide-react'

import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabaseClient'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'
import { Label } from '@/components/ui/label' // ✨ FIX: Corrected Import
import {
  Select, SelectContent, SelectItem, 
  SelectTrigger, SelectValue 
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, 
  TableHeader, TableRow
} from '@/components/ui/table'

interface IncentiveRule {
  id: string;
  minAmount: number;
  maxAmount: number;
  percentage: number;
}

export function IncentiveCalculator() {
  const { appUser } = useAuth()
  const { toast } = useToast()
  
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [invoices, setInvoices] = useState<any[]>([])
  const [staffList, setStaffList] = useState<any[]>([])
  
  // Filters
  const [selectedStaff, setSelectedStaff] = useState<string>('all')
  const [startDate, setStartDate] = useState(() => {
    const d = new Date(); d.setDate(1); return d.toISOString().split('T')[0]; // First day of current month
  })
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0])
  
  // Calculation Toggles
  const [baseCalculation, setBaseCalculation] = useState<'taxable_value' | 'subtotal'>('taxable_value')

  // Dynamic Rules Engine (Pre-filled with your custom logic)
  const [rules, setRules] = useState<IncentiveRule[]>([
    { id: '1', minAmount: 0, maxAmount: 21999, percentage: 1 },
    { id: '2', minAmount: 22000, maxAmount: 51999, percentage: 1.5 },
    { id: '3', minAmount: 52000, maxAmount: 99999999, percentage: 2 }
  ])

  // 1. Fetch Staff List
  useEffect(() => {
    async function fetchStaff() {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, role')
        .eq('is_active', true)
      
      if (!error && data) setStaffList(data)
    }
    fetchStaff()
  }, [])

  // 2. Fetch Invoices whenever filters change
  const fetchInvoices = async () => {
    if (!appUser?.company_id) return
    setLoading(true)

    try {
      const safeEndDate = new Date(endDate)
      safeEndDate.setDate(safeEndDate.getDate() + 1)
      const safeEndDateStr = safeEndDate.toISOString().split('T')[0]

      let q = supabase.from('invoices')
        .select(`
          id, invoice_number, created_at, subtotal, taxable_value, final_total, status, user_id,
          profiles(full_name)
        `)
        .eq('company_id', appUser.company_id)
        .eq('status', 'VALID') // Only calculate incentives on Valid invoices
        .gte('created_at', startDate)
        .lt('created_at', safeEndDateStr)
        .order('created_at', { ascending: true })

      if (selectedStaff !== 'all') {
        q = q.eq('user_id', selectedStaff)
      }

      const { data, error } = await q
      if (error) throw error

      setInvoices(data || [])
    } catch (err: any) {
      toast({ title: "Fetch Failed", description: err.message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const delay = setTimeout(() => { fetchInvoices() }, 300)
    return () => clearTimeout(delay)
  }, [appUser, selectedStaff, startDate, endDate])


  // 3. Process Data against Rules Engine
  const processedData = useMemo(() => {
    let totalBase = 0;
    let totalIncentive = 0;

    const detailedInvoices = invoices.map(inv => {
      // Choose base value: Taxable (After Discounts) OR Subtotal (Before Discounts)
      const baseAmt = baseCalculation === 'taxable_value' 
        ? (Number(inv.taxable_value) || 0) 
        : (Number(inv.subtotal) || 0);

      // Find the applicable tier rule
      const applicableRule = rules.find(r => baseAmt >= r.minAmount && baseAmt <= r.maxAmount);
      const appliedPercent = applicableRule ? applicableRule.percentage : 0;
      
      const earnedIncentive = (baseAmt * appliedPercent) / 100;

      totalBase += baseAmt;
      totalIncentive += earnedIncentive;

      return {
        ...inv,
        staffName: inv.profiles?.full_name || 'Unknown Staff',
        baseAmt,
        appliedPercent,
        earnedIncentive
      }
    });

    return {
      details: detailedInvoices,
      totalBase,
      totalIncentive,
      invoiceCount: detailedInvoices.length
    }
  }, [invoices, rules, baseCalculation])


  // Rule Management Handlers
  const addRule = () => {
    const newId = Math.random().toString(36).substring(2, 9);
    setRules([...rules, { id: newId, minAmount: 0, maxAmount: 0, percentage: 0 }]);
  }

  const removeRule = (id: string) => {
    setRules(rules.filter(r => r.id !== id));
  }

  const updateRule = (id: string, field: keyof IncentiveRule, value: number) => {
    setRules(rules.map(r => r.id === id ? { ...r, [field]: value } : r));
  }

  // Export to CSV
  const handleExport = () => {
    if (processedData.details.length === 0) {
      return toast({ title: "Empty Data", description: "No calculations to export.", variant: "destructive" })
    }
    setExporting(true)

    const headers = [
      "Date", "Invoice Number", "Billed By", 
      `Base Amount (${baseCalculation === 'taxable_value' ? 'Post-Discount' : 'Pre-Discount'})`, 
      "Applied Rate (%)", "Incentive Earned (Rs)"
    ];

    const csvRows = processedData.details.map(inv => [
      format(new Date(inv.created_at), 'yyyy-MM-dd HH:mm'),
      inv.invoice_number,
      inv.staffName,
      inv.baseAmt.toFixed(2),
      inv.appliedPercent.toFixed(2),
      inv.earnedIncentive.toFixed(2)
    ]);

    // Add Summary Row at bottom
    csvRows.push([]);
    csvRows.push(["TOTALS", "", "", processedData.totalBase.toFixed(2), "", processedData.totalIncentive.toFixed(2)]);

    const csvContent = [
      headers.join(","),
      ...csvRows.map(row => row.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `Staff_Incentive_Report_${startDate}_to_${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    setExporting(false)
    toast({ title: "Export Complete", description: "Incentive Report downloaded securely." })
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      
      {/* --- TOP FILTERS BAR --- */}
      <div className="flex flex-col sm:flex-row gap-3 bg-white p-4 rounded-2xl border border-gray-200 shadow-sm items-end">
        
        <div className="space-y-1.5 flex-1 w-full">
          <Label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest pl-1">Target Staff</Label>
          <Select value={selectedStaff} onValueChange={setSelectedStaff}>
            <SelectTrigger className="h-10 text-sm font-semibold bg-gray-50 border-gray-200 rounded-xl">
              <User className="w-4 h-4 mr-2 text-gray-500" />
              <SelectValue placeholder="Select Staff" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sales Staff</SelectItem>
              {staffList.map(staff => (
                <SelectItem key={staff.id} value={staff.id}>{staff.full_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5 flex-1 w-full">
          <Label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest pl-1">Date Range</Label>
          <div className="flex items-center bg-gray-50 border border-gray-200 rounded-xl px-3 h-10 focus-within:ring-1 focus-within:ring-gray-300">
            <Calendar className="w-4 h-4 text-gray-400 shrink-0 mr-2" />
            <input type="date" className="bg-transparent text-xs font-mono font-bold outline-none flex-1" value={startDate} onChange={e => setStartDate(e.target.value)} />
            <span className="text-gray-300 text-[10px] uppercase font-bold mx-2">to</span>
            <input type="date" className="bg-transparent text-xs font-mono font-bold outline-none flex-1 text-right" value={endDate} onChange={e => setEndDate(e.target.value)} />
          </div>
        </div>

        <Button onClick={handleExport} disabled={exporting || processedData.invoiceCount === 0} className="h-10 px-6 text-sm font-bold rounded-xl bg-gray-900 text-white hover:bg-gray-800 shadow-sm w-full sm:w-auto">
          {exporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
          Export CSV
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* --- LEFT: RULE CONFIGURATION ENGINE --- */}
        <div className="lg:col-span-1 space-y-4">
          <Card className="bg-white border-gray-200 shadow-sm rounded-2xl">
            <CardHeader className="p-5 border-b border-gray-100 bg-gray-50/50 rounded-t-2xl">
              <CardTitle className="text-sm font-bold text-gray-800 flex items-center gap-2">
                <Settings2 className="w-4 h-4 text-[#0078D7]" /> Calculation Engine
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-5">
              
              <div className="space-y-2">
                <Label className="text-xs font-bold text-gray-700">Calculate Incentives On:</Label>
                <Select value={baseCalculation} onValueChange={(val: any) => setBaseCalculation(val)}>
                  <SelectTrigger className="h-10 text-xs font-semibold border-gray-200">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="taxable_value">Taxable Value (After Discounts applied)</SelectItem>
                    <SelectItem value="subtotal">Gross Subtotal (Before any discounts)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold text-gray-700">Performance Tiers</Label>
                  <Button variant="ghost" size="sm" onClick={addRule} className="h-7 text-[10px] font-bold text-[#0078D7] hover:bg-blue-50">
                    <Plus className="w-3 h-3 mr-1" /> Add Tier
                  </Button>
                </div>
                
                <div className="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar pr-1">
                  {rules.map((rule, index) => (
                    <div key={rule.id} className="p-3 bg-gray-50 border border-gray-200 rounded-xl relative group">
                      <div className="text-[10px] font-bold text-gray-400 mb-2 uppercase tracking-widest">Tier {index + 1}</div>
                      
                      <div className="grid grid-cols-2 gap-2 mb-2">
                        <div>
                          <Label className="text-[9px] text-gray-500 font-semibold uppercase">Min Amount (₹)</Label>
                          <Input type="number" className="h-8 text-xs font-mono" value={rule.minAmount} onChange={(e) => updateRule(rule.id, 'minAmount', Number(e.target.value))} />
                        </div>
                        <div>
                          <Label className="text-[9px] text-gray-500 font-semibold uppercase">Max Amount (₹)</Label>
                          <Input type="number" className="h-8 text-xs font-mono" value={rule.maxAmount} onChange={(e) => updateRule(rule.id, 'maxAmount', Number(e.target.value))} />
                        </div>
                      </div>
                      
                      <div>
                        <Label className="text-[9px] text-gray-500 font-semibold uppercase">Incentive Rate (%)</Label>
                        <div className="relative">
                          <Input type="number" step="0.1" className="h-8 text-xs font-mono font-bold text-[#0078D7] bg-white border-blue-100 pr-8" value={rule.percentage} onChange={(e) => updateRule(rule.id, 'percentage', Number(e.target.value))} />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">%</span>
                        </div>
                      </div>

                      {rules.length > 1 && (
                        <button onClick={() => removeRule(rule.id)} className="absolute top-2 right-2 p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors opacity-0 group-hover:opacity-100">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

            </CardContent>
          </Card>
        </div>

        {/* --- RIGHT: LIVE RESULTS & DASHBOARD --- */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          
          {/* KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="shadow-sm border-gray-200 rounded-2xl overflow-hidden bg-white">
              <CardContent className="p-5">
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5 text-gray-400" /> Eligible Invoices
                </p>
                {loading ? <div className="h-8 w-16 bg-gray-100 rounded animate-pulse" /> : <p className="text-3xl font-bold text-gray-900">{processedData.invoiceCount}</p>}
              </CardContent>
            </Card>
            <Card className="shadow-sm border-gray-200 rounded-2xl overflow-hidden bg-white">
              <CardContent className="p-5">
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                  <IndianRupee className="h-3.5 w-3.5 text-gray-400" /> Total Base Value
                </p>
                {loading ? <div className="h-8 w-24 bg-gray-100 rounded animate-pulse" /> : <p className="text-3xl font-bold text-gray-900">₹{processedData.totalBase.toLocaleString()}</p>}
              </CardContent>
            </Card>
            <Card className="shadow-sm border-emerald-200 rounded-2xl overflow-hidden bg-emerald-50/50">
              <CardContent className="p-5">
                <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                  <Calculator className="h-3.5 w-3.5" /> Total Earned
                </p>
                {loading ? <div className="h-8 w-24 bg-emerald-100 rounded animate-pulse" /> : <p className="text-3xl font-bold text-emerald-700">₹{processedData.totalIncentive.toLocaleString()}</p>}
              </CardContent>
            </Card>
          </div>

          {/* Detailed Ledger Table */}
          <Card className="shadow-sm border-gray-200 rounded-2xl flex-1 flex flex-col overflow-hidden bg-white">
            <div className="overflow-x-auto max-h-[500px] custom-scrollbar">
              <Table>
                <TableHeader className="bg-gray-50/90 sticky top-0 z-10 backdrop-blur-sm">
                  <TableRow className="border-gray-200 hover:bg-transparent">
                    <TableHead className="h-10 text-[10px] font-bold uppercase tracking-widest text-gray-500">Invoice</TableHead>
                    <TableHead className="h-10 text-[10px] font-bold uppercase tracking-widest text-gray-500">Billed By</TableHead>
                    <TableHead className="h-10 text-[10px] font-bold uppercase tracking-widest text-gray-500 text-right">Base Amt</TableHead>
                    <TableHead className="h-10 text-[10px] font-bold uppercase tracking-widest text-gray-500 text-center">Rate</TableHead>
                    <TableHead className="h-10 text-[10px] font-bold uppercase tracking-widest text-emerald-600 text-right pr-6">Earned</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-12"><Loader2 className="w-5 h-5 animate-spin mx-auto text-gray-400" /></TableCell></TableRow>
                  ) : processedData.details.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-16 text-gray-400 text-sm font-medium">No eligible invoices found in this period.</TableCell></TableRow>
                  ) : (
                    processedData.details.map((inv) => (
                      <TableRow key={inv.id} className="hover:bg-gray-50/50 transition-colors border-gray-100">
                        <TableCell className="py-3">
                          <p className="font-mono text-xs font-bold text-gray-900">{inv.invoice_number}</p>
                          <p className="text-[10px] text-gray-400 mt-0.5">{format(new Date(inv.created_at), 'dd MMM yy')}</p>
                        </TableCell>
                        <TableCell className="py-3">
                          <span className="text-xs font-semibold text-gray-700">{inv.staffName}</span>
                        </TableCell>
                        <TableCell className="text-right py-3 font-mono text-xs text-gray-600">
                          ₹{inv.baseAmt.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-center py-3">
                          <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-[#0078D7]">
                            {inv.appliedPercent}%
                          </span>
                        </TableCell>
                        <TableCell className="text-right py-3 pr-6 font-mono text-sm font-bold text-emerald-600">
                          ₹{inv.earnedIncentive.toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </div>

      </div>
    </div>
  )
}