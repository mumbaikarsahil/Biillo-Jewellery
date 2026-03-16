"use client"

import React, { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { 
  Save, Plus, Trash2, Calendar, FileText, Loader2, AlertCircle, Scale, FileEdit 
} from 'lucide-react'

import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabaseClient'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'
import {
  Select, SelectContent, SelectItem, 
  SelectTrigger, SelectValue 
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, 
  TableHeader, TableRow
} from '@/components/ui/table'

interface Account {
  id: string;
  account_code: string;
  account_name: string;
  account_type: string;
}

interface JournalLine {
  id: string;
  account_id: string;
  debit: string;
  credit: string;
}

export function ManualJournalForm() {
  const { appUser } = useAuth()
  const { toast } = useToast()
  
  const [loading, setLoading] = useState(false)
  const [drafting, setDrafting] = useState(false)
  const [accounts, setAccounts] = useState<Account[]>([])
  
  const [entryDate, setEntryDate] = useState(() => format(new Date(), 'yyyy-MM-dd'))
  const [description, setDescription] = useState('')
  
  const [lines, setLines] = useState<JournalLine[]>([
    { id: crypto.randomUUID(), account_id: '', debit: '', credit: '' },
    { id: crypto.randomUUID(), account_id: '', debit: '', credit: '' }
  ])

  useEffect(() => {
    async function fetchAccounts() {
      if (!appUser?.company_id) return
      const { data } = await supabase
        .from('accounts')
        .select('id, account_code, account_name, account_type')
        .eq('company_id', appUser.company_id)
        .eq('is_active', true)
        .eq('allow_manual_posting', true) // ENTERPRISE RULE: Hide system accounts!
        .order('account_code', { ascending: true })
      
      if (data) setAccounts(data)
    }
    fetchAccounts()
  }, [appUser])

  const addLine = () => {
    setLines([...lines, { id: crypto.randomUUID(), account_id: '', debit: '', credit: '' }])
  }

  const removeLine = (id: string) => {
    if (lines.length <= 2) return 
    setLines(lines.filter(l => l.id !== id))
  }

  const updateLine = (id: string, field: keyof JournalLine, value: string) => {
    // Enforce positive numbers only
    if ((field === 'debit' || field === 'credit') && Number(value) < 0) return;

    setLines(lines.map(l => {
      if (l.id !== id) return l;
      
      const updatedLine = { ...l, [field]: value };
      
      // Mutual Exclusivity: Clear credit if debit is typed, and vice versa
      if (field === 'debit' && value !== '') updatedLine.credit = '';
      if (field === 'credit' && value !== '') updatedLine.debit = '';
      
      return updatedLine;
    }))
  }

  const totalDebit = lines.reduce((sum, l) => sum + (Number(l.debit) || 0), 0)
  const totalCredit = lines.reduce((sum, l) => sum + (Number(l.credit) || 0), 0)
  const isBalanced = totalDebit.toFixed(2) === totalCredit.toFixed(2) && totalDebit > 0
  const diff = Math.abs(totalDebit - totalCredit)

  const handleSubmit = async (status: 'DRAFT' | 'POSTED') => {
    if (status === 'POSTED' && !isBalanced) {
      return toast({ title: "Validation Error", description: "Debits must exactly equal Credits to post.", variant: "destructive" })
    }
    if (!description.trim()) {
      return toast({ title: "Validation Error", description: "Narration/Description is strictly required.", variant: "destructive" })
    }

    const validLines = lines.filter(l => l.account_id && (Number(l.debit) > 0 || Number(l.credit) > 0)).map(l => ({
      account_id: l.account_id,
      debit: Number(l.debit) || 0,
      credit: Number(l.credit) || 0
    }))

    if (validLines.length < 2 && status === 'POSTED') {
      return toast({ title: "Validation Error", description: "Journal requires at least 2 lines.", variant: "destructive" })
    }

    // Check for duplicates in UI before hitting DB
    const uniqueAccounts = new Set(validLines.map(l => l.account_id));
    if (uniqueAccounts.size !== validLines.length) {
       return toast({ title: "Validation Error", description: "Duplicate accounts detected. Please consolidate them into one line.", variant: "destructive" })
    }

    status === 'DRAFT' ? setDrafting(true) : setLoading(true)
    
    try {
      const { data, error } = await supabase.rpc('post_manual_journal', {
        p_company_id: appUser?.company_id,
        p_user_id: appUser?.user_id,
        p_entry_date: entryDate,
        p_description: description.trim(),
        p_status: status,
        p_lines: validLines
      })

      if (error) throw error

      toast({ 
        title: status === 'POSTED' ? "Journal Posted Successfully" : "Draft Saved", 
        description: `Entry ${data.entry_number} has been ${status === 'POSTED' ? 'recorded to the ledger.' : 'saved as a draft.'}` 
      })
      
      // Reset Form on success
      setDescription('')
      setLines([
        { id: crypto.randomUUID(), account_id: '', debit: '', credit: '' },
        { id: crypto.randomUUID(), account_id: '', debit: '', credit: '' }
      ])

    } catch (err: any) {
      toast({ title: "Operation Failed", description: err.message, variant: "destructive" })
    } finally {
      setLoading(false)
      setDrafting(false)
    }
  }

  return (
    <div className="space-y-5 animate-in fade-in duration-500 max-w-4xl mx-auto">
      
      {/* HEADER SECTION */}
      <Card className="shadow-sm border-zinc-200 bg-white rounded-2xl">
        <CardContent className="p-4 sm:p-6 space-y-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-8 w-8 rounded-lg bg-zinc-100 flex items-center justify-center">
              <FileText className="h-4 w-4 text-zinc-600" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-zinc-900 tracking-tight">Manual Journal Voucher</h2>
              <p className="text-[11px] text-zinc-500 font-medium">Record direct ledger adjustments, expenses, or equity.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-zinc-100">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-1.5">
                <Calendar className="h-3 w-3" /> Posting Date
              </label>
              <Input 
                type="date" 
                value={entryDate} 
                onChange={e => setEntryDate(e.target.value)}
                className="h-10 text-xs bg-zinc-50 border-zinc-200 focus-visible:ring-zinc-400 font-medium"
              />
            </div>
            <div className="md:col-span-2 space-y-1.5">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-1.5">
                <FileText className="h-3 w-3" /> Narration / Description <span className="text-rose-500">*</span>
              </label>
              <Input 
                placeholder="e.g., Office Rent for March 2026 paid via Bank Transfer" 
                value={description}
                onChange={e => setDescription(e.target.value)}
                className="h-10 text-xs bg-zinc-50 border-zinc-200 focus-visible:ring-zinc-400 font-medium"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* LINES SECTION */}
      <Card className="shadow-sm border-zinc-200 bg-white rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-zinc-50/80">
              <TableRow className="hover:bg-transparent border-zinc-200">
                <TableHead className="h-11 text-[10px] font-bold text-zinc-500 uppercase tracking-widest px-4 w-[40%]">Ledger Account</TableHead>
                <TableHead className="h-11 text-[10px] font-bold text-zinc-500 uppercase tracking-widest text-right bg-emerald-50/30">Debit (Dr)</TableHead>
                <TableHead className="h-11 text-[10px] font-bold text-zinc-500 uppercase tracking-widest text-right bg-rose-50/30">Credit (Cr)</TableHead>
                <TableHead className="h-11 w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lines.map((line, index) => (
                <TableRow key={line.id} className="border-zinc-100 hover:bg-zinc-50/30">
                  <TableCell className="px-4 py-2">
                    <Select value={line.account_id} onValueChange={(val) => updateLine(line.id, 'account_id', val)}>
                      <SelectTrigger className="h-9 text-xs bg-white border-zinc-200 focus:ring-zinc-400 w-full font-medium">
                        <SelectValue placeholder="Select Account..." />
                      </SelectTrigger>
                      <SelectContent className="max-h-[300px]">
                        {accounts.map(acc => (
                          <SelectItem key={acc.id} value={acc.id} className="text-xs font-medium">
                            <span className="font-mono text-zinc-400 mr-2">{acc.account_code}</span> 
                            {acc.account_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="p-2 bg-emerald-50/10">
                    <Input 
                      type="number" 
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      value={line.debit}
                      onChange={e => updateLine(line.id, 'debit', e.target.value)}
                      className="h-9 text-right font-mono text-xs border-zinc-200 focus-visible:ring-emerald-400"
                      disabled={Number(line.credit) > 0} 
                    />
                  </TableCell>
                  <TableCell className="p-2 bg-rose-50/10">
                    <Input 
                      type="number" 
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      value={line.credit}
                      onChange={e => updateLine(line.id, 'credit', e.target.value)}
                      className="h-9 text-right font-mono text-xs border-zinc-200 focus-visible:ring-rose-400"
                      disabled={Number(line.debit) > 0} 
                    />
                  </TableCell>
                  <TableCell className="p-2 text-center">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => removeLine(line.id)}
                      disabled={lines.length <= 2}
                      className="h-8 w-8 text-zinc-400 hover:text-rose-600 hover:bg-rose-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        
        <div className="p-3 border-t border-zinc-100 bg-zinc-50/50">
          <Button variant="outline" size="sm" onClick={addLine} className="text-[11px] font-bold text-zinc-600 border-zinc-200 rounded-full bg-white shadow-sm h-8 px-4">
            <Plus className="h-3.5 w-3.5 mr-1" /> Add Row
          </Button>
        </div>
      </Card>

      {/* FOOTER & VALIDATION */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-zinc-900 rounded-2xl p-4 shadow-lg text-white">
        
        <div className="flex items-center gap-6 w-full sm:w-auto">
          <div>
            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Total Debit</p>
            <p className="text-lg font-mono font-bold">₹{totalDebit.toLocaleString('en-IN', {minimumFractionDigits: 2})}</p>
          </div>
          <div className="h-8 w-px bg-zinc-700"></div>
          <div>
            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Total Credit</p>
            <p className="text-lg font-mono font-bold">₹{totalCredit.toLocaleString('en-IN', {minimumFractionDigits: 2})}</p>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
          {totalDebit > 0 && !isBalanced && (
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-rose-400 bg-rose-400/10 px-3 py-1.5 rounded-full border border-rose-400/20 mr-2">
              <AlertCircle className="h-3.5 w-3.5" />
              Off by ₹{diff.toLocaleString('en-IN', {minimumFractionDigits: 2})}
            </div>
          )}
          {isBalanced && (
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-400 bg-emerald-400/10 px-3 py-1.5 rounded-full border border-emerald-400/20 mr-2">
              <Scale className="h-3.5 w-3.5" />
              Balanced
            </div>
          )}
          
          <Button 
            variant="outline"
            onClick={() => handleSubmit('DRAFT')} 
            disabled={loading || drafting || totalDebit === 0}
            className="h-10 rounded-full px-5 font-bold text-xs bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700 hover:text-white"
          >
            {drafting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <FileEdit className="h-4 w-4 mr-2" />}
            Save Draft
          </Button>

          <Button 
            onClick={() => handleSubmit('POSTED')} 
            disabled={!isBalanced || loading || drafting}
            className={`h-10 rounded-full px-6 font-bold text-xs shadow-md transition-all ${isBalanced ? 'bg-white text-zinc-900 hover:bg-zinc-100' : 'bg-zinc-800 text-zinc-600 cursor-not-allowed'}`}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            Post Journal
          </Button>
        </div>
      </div>

    </div>
  )
}