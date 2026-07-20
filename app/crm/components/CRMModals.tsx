import React, { useState, useEffect } from 'react'
import { format } from "date-fns"
import { supabase } from '@/lib/supabaseClient'
import { toast } from 'sonner'
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, 
  DialogFooter, DialogDescription 
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { 
  UploadCloud, Download, FileSpreadsheet, Loader2, Database, Trash2, 
  Phone, Star, IndianRupee, Edit2, Gem, CheckCircle2, Clock, Lock, 
  UserPlus, Building2, MapPin, Calendar, MessageCircle, Wallet, Gift, Users, Mail, CheckCircle,
  Bot, Ticket, Settings2,
  Hammer,
  Wrench,
  FileText, History
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { CRMCustomer, Warehouse } from '../types'
import { Separator } from '@radix-ui/react-separator'

interface CRMModalsProps {
  isImportModalOpen: boolean; setIsImportModalOpen: (v: boolean) => void;
  isPreviewModalOpen: boolean; setIsPreviewModalOpen: (v: boolean) => void;
  isProfileModalOpen: boolean; setIsProfileModalOpen: (v: boolean) => void;
  isLoyaltyModalOpen: boolean; setIsLoyaltyModalOpen: (v: boolean) => void;
  isAddModalOpen: boolean; setIsAddModalOpen: (v: boolean) => void;
  isAddKittyModalOpen: boolean; setIsAddKittyModalOpen: (v: boolean) => void;
  isFollowupModalOpen: boolean; setIsFollowupModalOpen: (v: boolean) => void;
  isWhatsAppModalOpen: boolean; setIsWhatsAppModalOpen: (v: boolean) => void;
  isHistoryModalOpen: boolean; setIsHistoryModalOpen: (val: boolean) => void;
  customerHistory: any[];
  isHistoryLoading: boolean;

  isCallModalOpen: boolean; setIsCallModalOpen: (v: boolean) => void;
  callForm: {
    outcome: string;
    notes: string;
    next_call_date: string;
    next_call_time: string;
  };
  setCallForm: React.Dispatch<React.SetStateAction<{
    outcome: string;
    notes: string;
    next_call_date: string;
    next_call_time: string;
  }>>;
  handleLogCall: () => void;

  importFile: File | null; setImportFile: (f: File | null) => void;
  previewData: any[]; 
  selectedCustomer: CRMCustomer | null;
  selectedLocation: string;
  warehouses: Warehouse[];
  activeAiFilter: string;
  dynamicTemplates: any[]; 
  customers: CRMCustomer[]; 
  kittyConfigs: any[]; 
  
  newCustForm: any; setNewCustForm: (f: any) => void;
  newKittyForm: any; setNewKittyForm: (f: any) => void;
  loyaltyForm: any; setLoyaltyForm: (f: any) => void;
  waTemplateId: string; setWaTemplateId: (id: string) => void;
  customMessage: string; setCustomMessage: (m: string) => void;
  followupReason: string; setFollowupReason: (r: string) => void;
  followupDate: string; setFollowupDate: (d: string) => void;
  interactionNotes: string; setInteractionNotes: (n: string) => void;

  isImporting: boolean;
  isSubmitting: boolean;

  handleDownloadSample: () => void;
  handleParseFile: () => void;
  removePreviewRow: (idx: number) => void;
  updatePreviewRow: (idx: number, field: string, val: string) => void;
  handleCommitImport: () => void;
  handleAddCustomer: () => void;
  handleAddKittyMember: () => void;
  handleUpdateLoyalty: () => void;
  handleRecordKittyPayment: (c: CRMCustomer, planId: string) => void;
  handleUpdateFollowup: () => void;
  handleTemplateChange: (id: string) => void;
  handleSendWhatsApp: () => void;
  openWhatsAppModal: (c: CRMCustomer, templateId?: string) => void;
}

// ✨ UNIFIED CLASS FOR ALL MODALS TO FIX POSITIONING
const DIALOG_CONTENT_CLASS = "w-full border-none sm:rounded-2xl rounded-t-2xl rounded-b-none bg-white shadow-2xl p-0 overflow-hidden flex flex-col !top-auto !bottom-0 !translate-y-0 sm:!top-[10vh] sm:!bottom-auto max-h-[90vh] sm:max-h-[85vh]";

export function CRMModals(props: CRMModalsProps) {
  const {
    // Add these alongside your other destructured props
    isHistoryModalOpen, setIsHistoryModalOpen, customerHistory, isHistoryLoading,
    isImportModalOpen, setIsImportModalOpen, isPreviewModalOpen, setIsPreviewModalOpen,
    isProfileModalOpen, setIsProfileModalOpen, isLoyaltyModalOpen, setIsLoyaltyModalOpen,
    isAddModalOpen, setIsAddModalOpen, isAddKittyModalOpen, setIsAddKittyModalOpen,
    isFollowupModalOpen, setIsFollowupModalOpen, isWhatsAppModalOpen, setIsWhatsAppModalOpen,
    
    isCallModalOpen, setIsCallModalOpen, callForm, setCallForm, handleLogCall,

    importFile, setImportFile, previewData, selectedCustomer, selectedLocation, warehouses, activeAiFilter, dynamicTemplates, customers, kittyConfigs,
    newCustForm, setNewCustForm, newKittyForm, setNewKittyForm, loyaltyForm, setLoyaltyForm,
    waTemplateId, customMessage, setCustomMessage, followupReason, setFollowupReason, followupDate, setFollowupDate,
    interactionNotes, setInteractionNotes, isImporting, isSubmitting,
    handleDownloadSample, handleParseFile, removePreviewRow, updatePreviewRow, handleCommitImport,
    handleAddCustomer, handleAddKittyMember, handleUpdateLoyalty, handleRecordKittyPayment,
    handleUpdateFollowup, handleTemplateChange, handleSendWhatsApp, openWhatsAppModal
  } = props;

  const isKittyMember = selectedCustomer?.kitty_plans && selectedCustomer.kitty_plans.length > 0;
  
  const activeSequence = selectedCustomer?.voucher_message_sequences?.find(s => ['active', 'paused'].includes(s.status));
  const [sequenceForm, setSequenceForm] = useState({ status: '', interval_hours: 96, current_step: 1 });
  const [isUpdatingSequence, setIsUpdatingSequence] = useState(false);

  useEffect(() => {
    if (isFollowupModalOpen && activeSequence) {
      setSequenceForm({ 
        status: activeSequence.status, 
        interval_hours: activeSequence.interval_hours || 96, 
        current_step: activeSequence.current_step || 1 
      });
    }
  }, [isFollowupModalOpen, activeSequence]);

  const handleUpdateSequence = async () => {
    if (!activeSequence) return;
    setIsUpdatingSequence(true);
    try {
      const { error } = await supabase.from('voucher_message_sequences').update({
        status: sequenceForm.status,
        interval_hours: Number(sequenceForm.interval_hours),
        current_step: Number(sequenceForm.current_step)
      }).eq('id', activeSequence.id);

      if (error) throw error;
      toast.success("Voucher Automation Updated!");
      setIsFollowupModalOpen(false);
    } catch (err: any) {
      toast.error(`Failed to update sequence: ${err.message}`);
    } finally {
      setIsUpdatingSequence(false);
    }
  };

  const getCustomerCategory = () => {
    if (!selectedCustomer) return 'Lead'
    if (selectedCustomer.customer_status === 'Purchased') return 'Purchased'
    if (selectedCustomer.customer_status === 'Kitty Member' || isKittyMember) return 'Kitty'
    return 'Lead'
  }

  const currentCategory = getCustomerCategory()
  const availableTemplates = dynamicTemplates.filter(t => t.category === currentCategory)

  const handleBilledAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const billed = e.target.value;
    const bonus = Number(billed) * 0.05;
    setLoyaltyForm({ ...loyaltyForm, billedAmount: billed, amount: bonus.toString() });
  };

  return (
    <>
      {/* 0. IMPORT CSV MODAL */}
      <Dialog open={isImportModalOpen} onOpenChange={setIsImportModalOpen}>
        <DialogContent className={cn(DIALOG_CONTENT_CLASS, "sm:max-w-[450px]")}>
          <DialogHeader className="bg-emerald-50/50 p-6 border-b border-emerald-100/50 shrink-0">
            <DialogTitle className="text-lg font-bold flex items-center gap-2.5 text-emerald-900 tracking-tight">
              <UploadCloud className="w-5 h-5 text-emerald-600" strokeWidth={2} /> Bulk Import
            </DialogTitle>
            <DialogDescription className="text-xs font-medium text-emerald-700/70 mt-1">
              Upload a `.csv` file to instantly populate your CRM database.
            </DialogDescription>
          </DialogHeader>

          <div className="p-6 space-y-5 bg-white overflow-y-auto custom-scrollbar flex-1">
            <div className="bg-emerald-50/30 border border-emerald-100 p-4 rounded-xl flex flex-col sm:flex-row gap-3 items-center justify-between">
              <div className="flex flex-col text-center sm:text-left">
                <span className="font-bold text-slate-800 text-sm">Need the exact format?</span>
                <span className="text-[11px] font-medium text-slate-500">Download the required template.</span>
              </div>
              <Button variant="outline" size="sm" onClick={handleDownloadSample} className="h-8 px-4 rounded-lg border-emerald-200 text-emerald-700 bg-white hover:bg-emerald-50 text-[10px] font-bold uppercase tracking-widest shrink-0 transition-colors w-full sm:w-auto">
                <Download className="w-3.5 h-3.5 mr-1.5" /> Sample
              </Button>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Select File (.CSV)</label>
              <label className={cn(
                "flex flex-col items-center justify-center w-full h-32 border border-dashed rounded-xl cursor-pointer transition-all",
                importFile ? 'border-emerald-400 bg-emerald-50/50' : 'border-slate-200 hover:bg-slate-50 hover:border-slate-300 bg-white'
              )}>
                <div className="flex flex-col items-center justify-center pt-5 pb-6 text-center px-4">
                  {isImporting ? (
                     <Loader2 className="w-8 h-8 text-emerald-500 animate-spin mb-3" />
                  ) : importFile ? (
                     <FileSpreadsheet className="w-8 h-8 text-emerald-500 mb-3" strokeWidth={1.5} />
                  ) : (
                     <UploadCloud className="w-8 h-8 text-slate-300 mb-3" strokeWidth={1.5} />
                  )}
                  <p className="text-sm font-bold text-slate-700 truncate w-full max-w-[200px]">{importFile ? importFile.name : "Click or drag file here"}</p>
                </div>
                <input type="file" accept=".csv" className="hidden" onChange={(e) => setImportFile(e.target.files?.[0] || null)} />
              </label>
            </div>
            <p className="text-[10px] font-medium text-slate-400 leading-relaxed text-center sm:text-left">
              * The system uses Phone Numbers to prevent duplicates. Existing profiles will be securely updated if they share the same number.
            </p>
          </div>

          <DialogFooter className="bg-slate-50/80 p-4 border-t border-slate-100 flex flex-col sm:flex-row gap-3 shrink-0 pb-safe">
            <Button variant="ghost" className="w-full sm:flex-1 h-10 rounded-xl text-xs font-bold uppercase tracking-widest text-slate-500 hover:bg-slate-200 transition-colors px-6" onClick={() => setIsImportModalOpen(false)}>Cancel</Button>
            <Button disabled={isImporting || !importFile} className="w-full sm:flex-[2] h-10 rounded-xl text-xs font-bold uppercase tracking-widest bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-all active:scale-95" onClick={handleParseFile}>
              {isImporting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : 'Review Data'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 0.5 IMPORT PREVIEW MODAL */}
      <Dialog open={isPreviewModalOpen} onOpenChange={setIsPreviewModalOpen}>
        <DialogContent className={cn(DIALOG_CONTENT_CLASS, "sm:max-w-[95vw]")}>
          <DialogHeader className="bg-emerald-50/50 p-5 border-b border-emerald-100/50 shrink-0">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 pt-safe">
              <div>
                <DialogTitle className="text-lg font-bold flex items-center gap-2.5 text-emerald-900 tracking-tight">
                  <Database className="w-5 h-5 text-emerald-600" strokeWidth={2} /> Import Staging Area
                </DialogTitle>
                <DialogDescription className="text-xs font-medium text-emerald-700/70 mt-1 hidden sm:block">
                  Review and edit the {previewData.length} records parsed from your CSV before committing them to the database.
                </DialogDescription>
              </div>
              <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-md shrink-0 w-fit self-start sm:self-auto">
                {previewData.length} Valid Rows
              </Badge>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-auto bg-white custom-scrollbar p-2 sm:p-4">
            <div className="border border-slate-200/60 rounded-xl overflow-hidden shadow-sm h-full">
              <Table className="w-max min-w-full">
                <TableHeader className="bg-slate-50/80 sticky top-0 z-10 shadow-[0_1px_2px_rgba(0,0,0,0.05)] border-b border-slate-200/60">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-10"></TableHead>
                    <TableHead className="text-[10px] font-bold uppercase tracking-widest text-slate-500 h-10 w-[180px]">Full Name</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase tracking-widest text-slate-500 h-10 w-[140px]">Phone</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase tracking-widest text-slate-500 h-10 w-[150px]">Status</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase tracking-widest text-slate-500 h-10 w-[140px]">City</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase tracking-widest text-slate-500 h-10 w-[120px]">Credit(₹)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewData.map((row, index) => (
                    <TableRow key={row._id} className="group hover:bg-slate-50/50 transition-colors border-b border-slate-100 last:border-0">
                      <TableCell className="p-2 text-center">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:bg-red-50 hover:text-red-500 rounded-lg transition-colors" onClick={() => removePreviewRow(index)}>
                          <Trash2 className="w-4 h-4" strokeWidth={1.5} />
                        </Button>
                      </TableCell>
                      <TableCell className="p-2">
                        <Input className="h-9 rounded-lg text-sm font-semibold border-transparent hover:border-slate-200 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 px-3 transition-all" value={row.full_name} onChange={(e) => updatePreviewRow(index, 'full_name', e.target.value)} />
                      </TableCell>
                      <TableCell className="p-2">
                        <Input className="h-9 rounded-lg text-sm font-mono font-bold border-transparent hover:border-slate-200 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 px-3 transition-all" value={row.phone} onChange={(e) => updatePreviewRow(index, 'phone', e.target.value.replace(/\D/g, ''))} />
                      </TableCell>
                      <TableCell className="p-2">
                        <Select value={row.customer_status} onValueChange={(val) => updatePreviewRow(index, 'customer_status', val)}>
                          <SelectTrigger className="h-9 rounded-lg text-sm font-semibold border-transparent hover:border-slate-200 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 px-3 transition-all bg-transparent">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="rounded-lg shadow-lg border-slate-100 p-1">
                            <SelectItem value="Lead" className="text-sm font-medium rounded-md py-2 cursor-pointer">Lead</SelectItem>
                            <SelectItem value="Purchased" className="text-sm font-medium rounded-md py-2 cursor-pointer">Purchased</SelectItem>
                            <SelectItem value="Kitty Member" className="text-sm font-bold text-purple-600 rounded-md py-2 cursor-pointer">Kitty Member</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="p-2">
                        <Input className="h-9 rounded-lg text-sm font-medium border-transparent hover:border-slate-200 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 px-3 transition-all" value={row.city} onChange={(e) => updatePreviewRow(index, 'city', e.target.value)} />
                      </TableCell>
                      <TableCell className="p-2">
                        <Input type="number" className="h-9 rounded-lg text-sm font-mono font-bold border-transparent hover:border-slate-200 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 px-3 text-emerald-700 bg-emerald-50/50 transition-all" value={row.store_credit_balance} onChange={(e) => updatePreviewRow(index, 'store_credit_balance', e.target.value)} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          <DialogFooter className="bg-slate-50/80 p-4 sm:p-5 border-t border-slate-100 flex flex-col sm:flex-row gap-3 shrink-0 pb-safe">
            <Button variant="ghost" className="w-full sm:w-auto sm:flex-1 h-10 rounded-xl text-xs font-bold uppercase tracking-widest text-slate-500 hover:bg-slate-200 transition-colors px-6" onClick={() => setIsPreviewModalOpen(false)}>Cancel & Discard</Button>
            <Button disabled={isSubmitting || previewData.length === 0} className="w-full sm:w-auto sm:flex-[2] h-10 rounded-xl text-xs font-bold uppercase tracking-widest bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-all active:scale-95" onClick={handleCommitImport}>
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Database className="w-4 h-4 mr-2" strokeWidth={2}/>}
              Confirm & Import
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 1. CUSTOMER PROFILE MODAL */}
      <Dialog open={isProfileModalOpen} onOpenChange={setIsProfileModalOpen}>
        <DialogContent className={cn(DIALOG_CONTENT_CLASS, "sm:max-w-[750px]")}>
          {selectedCustomer && (
            <>
              <DialogHeader className="bg-slate-50/80 p-5 sm:p-6 border-b border-slate-100 shrink-0 pt-safe">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <DialogTitle className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">{selectedCustomer.full_name}</DialogTitle>
                    <div className="flex flex-wrap items-center gap-2 sm:gap-3 mt-1 text-[11px] sm:text-xs text-slate-500 font-medium">
                      <span className="flex items-center gap-1 sm:gap-1.5 font-mono font-bold text-slate-700"><Phone className="w-3.5 h-3.5 text-slate-400"/> {selectedCustomer.phone}</span>
                      <span className="text-slate-300 hidden sm:inline">|</span>
                      <span className="flex items-center gap-1 sm:gap-1.5"><MapPin className="w-3.5 h-3.5 text-slate-400"/> {selectedCustomer.city || 'Unknown City'}</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Button 
                      size="icon" 
                      variant="ghost" 
                      className="h-8 w-8 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg shrink-0" 
                      title="Edit Customer Profile"
                      onClick={() => {
                        setIsProfileModalOpen(false);
                        setNewCustForm({
                          id: selectedCustomer.id,
                          full_name: selectedCustomer.full_name || '',
                          phone: selectedCustomer.phone || '',
                          email: selectedCustomer.email || '',
                          city: selectedCustomer.city || '',
                          address: selectedCustomer.address || '',
                          pan_no: selectedCustomer.pan_no || '',
                          customer_status: selectedCustomer.customer_status || 'Lead',
                          birth_date: selectedCustomer.birth_date ? selectedCustomer.birth_date.split('T')[0] : '',
                          anniversary_date: selectedCustomer.anniversary_date ? selectedCustomer.anniversary_date.split('T')[0] : '',
                          next_followup_date: selectedCustomer.next_followup_date ? selectedCustomer.next_followup_date.split('T')[0] : '',
                          followup_reason: selectedCustomer.followup_reason || ''
                        });
                        setTimeout(() => setIsAddModalOpen(true), 300);
                      }}
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Badge variant="outline" className={cn(
                      "uppercase tracking-widest text-[9px] sm:text-[10px] font-bold px-2.5 py-1 rounded-lg border-none shadow-sm",
                      selectedCustomer.customer_status === 'Kitty Member' || isKittyMember ? "bg-purple-50 text-purple-700" :
                      selectedCustomer.customer_status === 'Purchased' ? "bg-emerald-50 text-emerald-700" : 
                      "bg-slate-100 text-slate-600"
                    )}>
                      {selectedCustomer.customer_status || 'Lead'}
                    </Badge>
                  </div>
                </div>
              </DialogHeader>

              <div className="p-4 sm:p-6 overflow-y-auto custom-scrollbar space-y-6 sm:space-y-8 bg-white flex-1">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                  <div className="bg-emerald-600 rounded-2xl p-5 shadow-sm flex flex-col justify-center relative overflow-hidden group">
                    <div className="flex justify-between items-center mb-2 relative z-10">
                      <h3 className="text-[10px] sm:text-[11px] font-bold text-emerald-100 uppercase tracking-widest flex items-center gap-1.5">
                        <Wallet className="w-3.5 h-3.5" strokeWidth={2}/> Pavitram Credits
                      </h3>
                      <Button 
                        size="icon" variant="ghost" 
                        className="h-7 w-7 text-white hover:bg-emerald-500 hover:text-white rounded-lg transition-colors bg-white/10 backdrop-blur-sm border border-white/20" 
                        onClick={() => setIsLoyaltyModalOpen(true)} title="Adjust Credits"
                      >
                        <Edit2 className="w-3.5 h-3.5" strokeWidth={2}/>
                      </Button>
                    </div>
                    <p className="text-3xl sm:text-4xl font-bold text-white relative z-10 tracking-tight">
                      ₹{(selectedCustomer.store_credit_balance || 0).toLocaleString()}
                    </p>
                    <Wallet className="absolute -right-4 -bottom-4 w-24 h-24 text-emerald-700 opacity-50 -rotate-12 group-hover:scale-110 group-hover:opacity-40 transition-all duration-500" />
                  </div>

                  <div className="bg-slate-50/80 border border-slate-100 rounded-2xl p-5 flex flex-col justify-center space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Birth Date</span>
                      <span className="text-xs font-bold text-slate-800">
                        {selectedCustomer.birth_date ? format(new Date(selectedCustomer.birth_date), 'dd-MM-yyyy') : 'Not Set'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Anniversary</span>
                      <span className="text-xs font-bold text-slate-800">
                        {selectedCustomer.anniversary_date ? format(new Date(selectedCustomer.anniversary_date), 'dd-MM-yyyy') : 'Not Set'}
                      </span>
                    </div>
                    <Separator className="bg-slate-200/60" />
                    <div className="flex justify-between items-center pt-1">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Customer Since</span>
                      <span className="text-xs font-bold text-slate-800">
                        {format(new Date(selectedCustomer.created_at), 'dd-MM-yyyy')}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="bg-white border border-slate-200/60 rounded-2xl shadow-sm overflow-hidden mt-6">
                  <div className="bg-slate-50/80 border-b border-slate-100 p-4 sm:p-5 flex justify-between items-center">
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-widest flex items-center gap-1.5 sm:gap-2">
                      <Gem className="w-4 h-4 text-purple-500" strokeWidth={2.5}/> Harvesting Plans
                    </h3>
                    
                    <Button 
                      variant="outline" size="sm" 
                      className="h-8 rounded-lg text-[10px] font-bold uppercase tracking-widest border-purple-200 text-purple-600 hover:bg-purple-50"
                      onClick={() => {
                        setIsProfileModalOpen(false);
                        setNewKittyForm({ 
                          ...newKittyForm, 
                          full_name: selectedCustomer.full_name || '', 
                          phone: selectedCustomer.phone || '', 
                          email: selectedCustomer.email || '',
                          city: selectedCustomer.city || '',
                          address: selectedCustomer.address || '',
                          pan_no: selectedCustomer.pan_no || '',
                          birth_date: selectedCustomer.birth_date || '',
                          anniversary_date: selectedCustomer.anniversary_date || ''
                        });
                        setTimeout(() => setIsAddKittyModalOpen(true), 300);
                      }}
                    >
                      + New Plan
                    </Button>
                  </div>
                  
                  <div className="p-4 sm:p-6 space-y-8">
                    {selectedCustomer.kitty_plans && selectedCustomer.kitty_plans.length > 0 ? (
                      selectedCustomer.kitty_plans.map((plan: any, planIndex: number) => {
                        const dynamicBonus = Number(plan.bonus_amount) || 0;
                        const maturedValue = (plan.total_months * plan.plan_amount) + dynamicBonus;
                        const isRedeemed = plan.status?.toLowerCase() === 'redeemed';

                        if (isRedeemed) {
                          return (
                            <div key={plan.id} className={cn("relative opacity-80", planIndex > 0 ? "pt-6 border-t border-dashed border-slate-200" : "")}>
                              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                <div>
                                  <div className="flex items-center gap-2 mb-1">
                                    <p className="text-sm font-bold text-slate-600">{plan.plan_name}</p>
                                    <Badge variant="outline" className="text-[8px] uppercase tracking-widest font-bold px-2 py-0.5 rounded-md border-none bg-slate-200 text-slate-600 shadow-none flex items-center gap-1">
                                      <CheckCircle className="w-2.5 h-2.5" /> Completed
                                    </Badge>
                                  </div>
                                  <p className="text-[11px] font-medium text-slate-500">Total Contribution: ₹{(plan.total_months * plan.plan_amount).toLocaleString()} + Bonus: ₹{dynamicBonus.toLocaleString()}</p>
                                </div>
                                <div className="text-left sm:text-right">
                                   <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Value Claimed</p>
                                   <p className="text-lg font-bold text-slate-600 tracking-tight leading-none">₹{maturedValue.toLocaleString()}</p>
                                </div>
                              </div>
                            </div>
                          )
                        }

                        return (
                          <div key={plan.id} className={cn("relative", planIndex > 0 ? "pt-8 border-t border-dashed border-slate-200" : "")}>
                            
                            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-3 sm:gap-4 mb-6">
                              <div>
                                <div className="flex items-center gap-2 mb-1">
                                  <p className="text-base font-bold text-slate-800 tracking-tight">{plan.plan_name}</p>
                                  <Badge variant="outline" className={cn(
                                    "text-[8px] uppercase tracking-widest font-bold px-2 py-0.5 rounded-md border-none shadow-sm", 
                                    plan.status === 'active' ? 'bg-purple-50 text-purple-700' : 'bg-slate-100 text-slate-500'
                                  )}>
                                    {plan.status}
                                  </Badge>
                                </div>
                                <p className="text-[11px] sm:text-xs font-medium text-slate-500">₹{plan.plan_amount.toLocaleString()} / month • {plan.total_months} Months Plan</p>
                              </div>
                              <div className="text-left sm:text-right">
                                <p className="text-[9px] font-bold text-purple-600 uppercase tracking-widest mb-0.5">Months Paid</p>
                                <p className="text-2xl font-bold text-purple-700 tracking-tight leading-none">{plan.months_paid} <span className="text-xs text-purple-400 font-bold tracking-normal">/ {plan.total_months}</span></p>
                              </div>
                            </div>

                            <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden shadow-inner mb-6">
                              <div 
                                className="bg-purple-500 h-full rounded-full transition-all duration-700 ease-out" 
                                style={{ width: `${Math.min((plan.months_paid / plan.total_months) * 100, 100)}%` }}
                              />
                            </div>

                            <div>
                              <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Installment Tracker</h4>
                              <div className="grid grid-cols-4 md:grid-cols-6 gap-2 sm:gap-3">
                                {Array.from({length: plan.total_months}).map((_, i) => {
                                  const monthNum = i + 1;
                                  const isPaid = monthNum <= plan.months_paid;
                                  const isCurrent = monthNum === plan.months_paid + 1 && plan.status === 'active';

                                  return (
                                    <div key={i} className={cn(
                                      "rounded-xl p-2 sm:p-3 flex flex-col items-center justify-center gap-1.5 transition-all relative overflow-hidden h-[60px] sm:h-[70px]",
                                      isPaid ? "bg-emerald-50 border border-emerald-100" :
                                      isCurrent ? "bg-white border border-blue-400 shadow-sm" :
                                      "bg-slate-50 border border-slate-100 opacity-70"
                                    )}>
                                      <span className={cn("text-[9px] font-bold uppercase tracking-widest", isPaid ? "text-emerald-700" : isCurrent ? "text-blue-700" : "text-slate-400")}>
                                        Mon {monthNum}
                                      </span>
                                      {isPaid ? <CheckCircle2 className="w-4 h-4 text-emerald-500" strokeWidth={2.5}/> : 
                                       isCurrent ? <Clock className="w-4 h-4 text-blue-500" strokeWidth={2.5}/> : 
                                       <Lock className="w-3.5 h-3.5 text-slate-300" strokeWidth={2}/>}
                                      
                                      {isCurrent && (
                                        <div className="absolute inset-x-0 bottom-0 top-0 flex flex-col">
                                          <button 
                                            className="flex-1 bg-blue-600/95 backdrop-blur-sm text-white text-[9px] font-bold tracking-widest uppercase opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center"
                                            onClick={() => handleRecordKittyPayment(selectedCustomer, plan.id)}
                                          >
                                            Mark Paid
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  )
                                })}
                              </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 sm:p-5 bg-slate-50/80 rounded-xl border border-slate-200/60 mt-5">
                              <div className="space-y-1 flex flex-col sm:block items-center sm:items-start text-center sm:text-left">
                                <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Total Paid</p>
                                <p className="text-sm font-bold text-slate-800 tracking-tight">
                                  ₹{(plan.months_paid * plan.plan_amount).toLocaleString()}
                                </p>
                              </div>
                              <div className="space-y-1 flex flex-col sm:block items-center sm:items-start text-center sm:text-left sm:border-l sm:border-slate-200 sm:pl-4">
                                <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                                  <Gift className="w-3 h-3 text-emerald-500"/> Jeweler Bonus
                                </p>
                                <p className="text-sm font-bold text-emerald-600 tracking-tight">
                                  + ₹{dynamicBonus.toLocaleString()}
                                </p>
                              </div>
                              <div className="space-y-1 flex flex-col sm:block items-center sm:items-start text-center sm:text-left sm:border-l sm:border-slate-200 sm:pl-4 pt-3 sm:pt-0 border-t border-slate-200 sm:border-t-0 mt-1 sm:mt-0">
                                <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                                  <Wallet className="w-3 h-3 text-purple-500"/> Est. Maturity
                                </p>
                                <p className="text-base font-bold text-purple-700 tracking-tight pt-0.5">
                                  ₹{maturedValue.toLocaleString()}
                                </p>
                              </div>
                            </div>
                          </div>
                        )
                      })
                    ) : (
                      <div className="text-center py-8 px-4">
                        <div className="h-12 w-12 rounded-xl bg-purple-50 flex items-center justify-center mx-auto mb-3 border border-purple-100">
                          <Gem className="w-5 h-5 text-purple-400" strokeWidth={1.5} />
                        </div>
                        <p className="text-xs font-semibold text-slate-500">Customer is not currently enrolled in any Kitty Plans.</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="bg-white border border-slate-200/60 rounded-2xl shadow-sm overflow-hidden mt-6">
                  <div className="bg-slate-50/80 border-b border-slate-100 p-4 sm:p-5">
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-widest flex items-center gap-1.5 sm:gap-2">
                      <Ticket className="w-4 h-4 text-blue-500" strokeWidth={2.5}/> Vouchers & Automations
                    </h3>
                  </div>
                  
                  <div className="p-4 sm:p-6 space-y-6">
                    <div>
                      <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">Assigned Vouchers</h4>
                      {selectedCustomer.vouchers && selectedCustomer.vouchers.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {selectedCustomer.vouchers.map((voucher: any) => (
                            <div key={voucher.id} className="flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-lg py-1.5 px-3">
                              <span className="font-mono text-xs font-bold text-blue-900">{voucher.code}</span>
                              <Badge variant="outline" className={cn(
                                "text-[9px] uppercase tracking-widest font-bold px-1.5 py-0 border-none",
                                voucher.status === 'registered' ? "bg-emerald-100 text-emerald-700" :
                                voucher.status === 'redeemed' ? "bg-slate-200 text-slate-600" :
                                "bg-amber-100 text-amber-700"
                              )}>
                                {voucher.status}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs font-medium text-slate-400 italic">No vouchers assigned.</p>
                      )}
                    </div>

                    <Separator className="bg-slate-100" />

                    <div>
                      <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                        <Bot className="w-3 h-3"/> Active WhatsApp Sequences
                      </h4>
                      {selectedCustomer.voucher_message_sequences && selectedCustomer.voucher_message_sequences.length > 0 ? (
                        <div className="space-y-3">
                          {selectedCustomer.voucher_message_sequences.map((seq: any) => (
                            <div key={seq.id} className="bg-white border border-slate-200 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
                              <div>
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="font-bold text-sm text-slate-800">Voucher Flow: {seq.voucher_code}</span>
                                  <Badge variant="outline" className={cn(
                                    "text-[8px] uppercase tracking-widest font-bold px-1.5 py-0 border-none",
                                    seq.status === 'active' ? "bg-[#25D366]/20 text-[#1DA851]" : 
                                    seq.status === 'paused' ? "bg-amber-100 text-amber-700" :
                                    "bg-slate-100 text-slate-500"
                                  )}>
                                    {seq.status}
                                  </Badge>
                                </div>
                                <p className="text-[11px] font-medium text-slate-500">Currently on Step {seq.current_step}</p>
                              </div>
                              
                              {seq.status === 'active' && seq.next_send_at && (
                                <div className="text-left sm:text-right bg-slate-50 rounded-lg p-2 border border-slate-100">
                                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1 sm:justify-end">
                                    <Clock className="w-2.5 h-2.5"/> Next Message At
                                  </p>
                                  <p className="text-xs font-bold text-slate-700 mt-0.5">
                                    {format(new Date(seq.next_send_at), 'dd MMM, hh:mm a')}
                                  </p>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs font-medium text-slate-400 italic">No active automations running.</p>
                      )}
                    </div>
                  </div>
                </div>

              </div>
              <div className="bg-white p-4 sm:hidden border-t border-slate-100 pb-safe shrink-0">
                <Button variant="outline" className="w-full h-10 rounded-xl text-xs font-bold text-slate-500" onClick={() => setIsProfileModalOpen(false)}>Close</Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* --- CREDITS ADJUSTMENT MODAL --- */}
      <Dialog open={isLoyaltyModalOpen} onOpenChange={setIsLoyaltyModalOpen}>
        <DialogContent className={cn(DIALOG_CONTENT_CLASS, "sm:max-w-[450px]")}>
          <DialogHeader className="bg-emerald-600 p-6 border-b border-emerald-700/50 shrink-0">
            <DialogTitle className="text-lg font-bold text-white flex items-center gap-2.5 tracking-tight">
              <Wallet className="w-5 h-5 text-emerald-200" strokeWidth={2}/> Manage Pavitram Credits
            </DialogTitle>
            <DialogDescription className="text-xs font-medium text-emerald-100/80 mt-1">Adjust wallet balance for <span className="font-bold text-white">{selectedCustomer?.full_name}</span></DialogDescription>
          </DialogHeader>
          
          <div className="p-6 space-y-5 bg-white overflow-y-auto custom-scrollbar flex-1">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Reason / Trigger</label>
              <Select value={loyaltyForm.actionType} onValueChange={(val) => {
                let defaultAmt = '';
                if (val === 'exhibition') defaultAmt = '500';
                setLoyaltyForm({...loyaltyForm, actionType: val, amount: defaultAmt, billedAmount: ''});
              }}>
                <SelectTrigger className="h-10 text-sm font-semibold bg-slate-50 hover:bg-slate-100 border-slate-200/60 shadow-sm rounded-xl focus:ring-emerald-500 focus:bg-white transition-colors">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl shadow-lg border-slate-100 p-1">
                  <SelectItem value="exhibition" className="text-sm text-emerald-700 font-bold rounded-lg py-2 cursor-pointer focus:bg-emerald-50">Exhibition Hosting (+₹500)</SelectItem>
                  <SelectItem value="b2p_referral" className="text-sm text-emerald-700 font-bold rounded-lg py-2 cursor-pointer focus:bg-emerald-50">B2P Purchase Referral (+5%)</SelectItem>
                  <SelectItem value="wedding_intro" className="text-sm text-emerald-700 font-bold rounded-lg py-2 cursor-pointer focus:bg-emerald-50">Wedding House Introduction</SelectItem>
                  <Separator className="my-1.5 bg-slate-100" />
                  <SelectItem value="manual_add" className="text-sm text-slate-700 font-bold rounded-lg py-2 cursor-pointer focus:bg-slate-50">Custom Manual Addition (+)</SelectItem>
                  <SelectItem value="manual_deduct" className="text-sm text-red-600 font-bold rounded-lg py-2 cursor-pointer focus:bg-red-50">Custom Manual Deduction (-)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {loyaltyForm.actionType === 'b2p_referral' && (
              <div className="space-y-2 p-4 bg-emerald-50/50 border border-emerald-100 rounded-xl animate-in fade-in slide-in-from-top-2">
                <label className="text-[10px] font-bold text-emerald-800 uppercase tracking-widest">Referred Billed Amount</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-600/50 font-bold text-sm">₹</span>
                  <Input 
                    type="number"
                    className="h-10 text-sm font-bold border-emerald-200 focus-visible:ring-emerald-500 rounded-xl bg-white pl-9 shadow-sm" 
                    placeholder="e.g. 50000"
                    value={loyaltyForm.billedAmount} 
                    onChange={handleBilledAmountChange} 
                  />
                </div>
                <p className="text-[9px] text-emerald-600 font-semibold mt-2 flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5"/> Automatically calculates 5% for the wallet.</p>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                {loyaltyForm.actionType === 'manual_deduct' ? 'Amount to Deduct' : 'Amount to Credit'}
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-lg">₹</span>
                <Input 
                  type="number"
                  readOnly={loyaltyForm.actionType === 'exhibition' || loyaltyForm.actionType === 'b2p_referral'}
                  className={cn(
                    "h-12 text-lg font-bold border-slate-200/60 focus-visible:ring-emerald-500 rounded-xl shadow-sm bg-slate-50 pl-9 transition-colors", 
                    loyaltyForm.actionType === 'manual_deduct' ? 'text-red-600 focus:bg-white' : 'text-emerald-600 focus:bg-white'
                  )} 
                  placeholder="0"
                  value={loyaltyForm.amount} 
                  onChange={(e) => setLoyaltyForm({...loyaltyForm, amount: e.target.value})} 
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Internal Note (Optional)</label>
              <Input 
                className="h-10 text-sm font-medium border-slate-200/60 bg-slate-50 hover:bg-slate-100 focus:bg-white focus-visible:ring-emerald-500 rounded-xl shadow-sm transition-colors" 
                placeholder="E.g. Referral for Invoice #1024" 
                value={loyaltyForm.notes} 
                onChange={(e) => setLoyaltyForm({...loyaltyForm, notes: e.target.value})} 
              />
            </div>
            
            {selectedCustomer && loyaltyForm.amount && (
              <div className="p-4 bg-slate-50/80 rounded-xl border border-slate-200/60 flex justify-between items-center text-sm animate-in fade-in mt-4">
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Resulting Balance:</span>
                <span className="text-base font-bold text-slate-900 tracking-tight">
                  ₹{loyaltyForm.actionType === 'manual_deduct' 
                    ? Math.max(0, (Number(selectedCustomer.store_credit_balance) || 0) - Number(loyaltyForm.amount)).toLocaleString()
                    : ((Number(selectedCustomer.store_credit_balance) || 0) + Number(loyaltyForm.amount)).toLocaleString()
                  }
                </span>
              </div>
            )}
          </div>
          <DialogFooter className="bg-slate-50/80 p-5 border-t border-slate-100 flex flex-col sm:flex-row gap-3 shrink-0 pb-safe">
            <Button variant="ghost" className="w-full sm:flex-1 h-10 rounded-xl text-xs font-bold uppercase tracking-widest text-slate-500 hover:bg-slate-200 transition-colors px-6" onClick={() => setIsLoyaltyModalOpen(false)}>Cancel</Button>
            <Button disabled={isSubmitting || !loyaltyForm.amount} className="w-full sm:flex-[2] h-10 rounded-xl text-xs font-bold uppercase tracking-widest bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-all active:scale-95" onClick={handleUpdateLoyalty}>
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : 'Confirm Update'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ADD/EDIT CUSTOMER MODAL */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className={cn(DIALOG_CONTENT_CLASS, "sm:max-w-[550px]")}>
          <DialogHeader className="bg-slate-50/80 p-6 border-b border-slate-100 shrink-0">
            <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2.5 tracking-tight">
              <UserPlus className="w-5 h-5 text-blue-600" strokeWidth={2} /> 
              {newCustForm.id ? 'Edit Customer Details' : 'Add New Customer'}
            </DialogTitle>
            <DialogDescription className="text-xs font-medium text-slate-500 mt-1">Branch Context: <span className="font-bold text-slate-800">{selectedLocation === 'ALL' ? 'GLOBAL HQ' : warehouses.find(w => w.id === selectedLocation)?.name}</span></DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5 p-6 overflow-y-auto custom-scrollbar bg-white flex-1">
            <div className="space-y-2 col-span-1 sm:col-span-2">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Full Name <span className="text-red-500">*</span></label>
              <Input className="h-10 rounded-xl text-sm font-semibold bg-slate-50 border border-slate-200/60 hover:bg-slate-100 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all px-4" placeholder="E.g. Rahul Sharma" value={newCustForm.full_name} onChange={(e) => setNewCustForm({...newCustForm, full_name: e.target.value})} />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Phone <span className="text-red-500">*</span></label>
              <Input className="h-10 rounded-xl text-sm font-bold font-mono bg-slate-50 border border-slate-200/60 hover:bg-slate-100 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all px-4" placeholder="10 digits" value={newCustForm.phone} onChange={(e) => setNewCustForm({...newCustForm, phone: e.target.value})} />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5"><Mail className="w-3.5 h-3.5"/> Email (Optional)</label>
              <Input type="email" className="h-10 rounded-xl text-sm font-medium bg-slate-50 border border-slate-200/60 hover:bg-slate-100 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all px-4" placeholder="email@example.com" value={newCustForm.email || ''} onChange={(e) => setNewCustForm({...newCustForm, email: e.target.value})} />
            </div>
            <div className="space-y-2 col-span-1 sm:col-span-2">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Address</label>
              <Input className="h-10 rounded-xl text-sm font-medium bg-slate-50 border border-slate-200/60 hover:bg-slate-100 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all px-4" placeholder="Flat No, Building, Street..." value={newCustForm.address || ''} onChange={(e) => setNewCustForm({...newCustForm, address: e.target.value})} />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">City</label>
              <Input className="h-10 rounded-xl text-sm font-medium bg-slate-50 border border-slate-200/60 hover:bg-slate-100 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all px-4" placeholder="Mumbai" value={newCustForm.city} onChange={(e) => setNewCustForm({...newCustForm, city: e.target.value})} />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">PAN Number</label>
              <Input className="h-10 rounded-xl text-sm font-medium bg-slate-50 border border-slate-200/60 hover:bg-slate-100 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all px-4 uppercase" placeholder="ABCDE1234F" value={newCustForm.pan_no || ''} onChange={(e) => setNewCustForm({...newCustForm, pan_no: e.target.value})} />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5"/> D.O.B <span className="text-red-500">*</span></label>
              <Input type="date" className="h-10 rounded-xl text-xs font-medium text-slate-700 bg-white border border-slate-200/60 hover:bg-slate-50 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all px-4" value={newCustForm.birth_date} onChange={(e) => setNewCustForm({...newCustForm, birth_date: e.target.value})} />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5"/> Anniversary (Optional)</label>
              <Input type="date" className="h-10 rounded-xl text-xs font-medium text-slate-700 bg-white border border-slate-200/60 hover:bg-slate-50 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all px-4" value={newCustForm.anniversary_date} onChange={(e) => setNewCustForm({...newCustForm, anniversary_date: e.target.value})} />
            </div>
          </div>
          <DialogFooter className="bg-slate-50/80 p-5 border-t border-slate-100 flex flex-col sm:flex-row gap-3 shrink-0 pb-safe">
            <Button variant="ghost" className="w-full sm:flex-1 h-10 rounded-xl text-xs font-bold uppercase tracking-widest text-slate-500 hover:bg-slate-200 transition-colors px-6" onClick={() => setIsAddModalOpen(false)}>Cancel</Button>
            <Button disabled={isSubmitting || !newCustForm.full_name || !newCustForm.phone} className="w-full sm:flex-[2] h-10 rounded-xl text-xs font-bold uppercase tracking-widest bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-all active:scale-95" onClick={handleAddCustomer}>
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : 'Save Profile'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* KITTY REGISTRATION MODAL */}
      <Dialog open={isAddKittyModalOpen} onOpenChange={setIsAddKittyModalOpen}>
        <DialogContent className={cn(DIALOG_CONTENT_CLASS, "sm:max-w-[550px]")}>
          <DialogHeader className="bg-purple-50/80 p-6 border-b border-purple-100 shrink-0">
            <DialogTitle className="text-lg font-bold flex items-center gap-2.5 text-purple-900 tracking-tight">
              <Gem className="w-5 h-5 text-purple-600" strokeWidth={2}/> Start Diamond Kitty Plan
            </DialogTitle>
            <DialogDescription className="text-xs font-medium text-purple-700/70 mt-1">Enroll a new member and assign referral bonuses.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-6 overflow-y-auto custom-scrollbar bg-white flex-1">
            
            {selectedCustomer && newKittyForm.phone === selectedCustomer.phone ? (
              <div className="col-span-1 sm:col-span-2 bg-slate-50 border border-slate-200/60 rounded-xl p-4 mb-2 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Enrolling Member</p>
                  <p className="text-base font-bold text-slate-900 tracking-tight">{newKittyForm.full_name}</p>
                  <div className="flex items-center gap-3 mt-1 text-xs font-medium text-slate-500">
                    <span className="font-mono">{newKittyForm.phone}</span>
                    {newKittyForm.city && <span>• {newKittyForm.city}</span>}
                  </div>
                </div>
                <Badge className="bg-purple-100 text-purple-700 hover:bg-purple-100 border-none shadow-sm uppercase tracking-widest text-[9px] font-bold">
                  Existing Profile
                </Badge>
              </div>
            ) : (
              <>
                <div className="space-y-2 col-span-1 sm:col-span-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Full Name <span className="text-red-500">*</span></label>
                  <Input className="h-10 rounded-xl text-sm font-semibold bg-slate-50 border border-slate-200/60 hover:bg-slate-100 focus:bg-white focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all px-4" placeholder="Member Name" value={newKittyForm.full_name} onChange={(e) => setNewKittyForm({...newKittyForm, full_name: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Phone <span className="text-red-500">*</span></label>
                  <Input className="h-10 rounded-xl text-sm font-bold font-mono bg-slate-50 border border-slate-200/60 hover:bg-slate-100 focus:bg-white focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all px-4" placeholder="10 digits" value={newKittyForm.phone} onChange={(e) => setNewKittyForm({...newKittyForm, phone: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5"><Mail className="w-3.5 h-3.5"/> Email</label>
                  <Input type="email" className="h-10 rounded-xl text-sm font-medium bg-slate-50 border border-slate-200/60 hover:bg-slate-100 focus:bg-white focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all px-4" placeholder="email@example.com" value={newKittyForm.email || ''} onChange={(e) => setNewKittyForm({...newKittyForm, email: e.target.value})} />
                </div>
                <div className="space-y-2 col-span-1 sm:col-span-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Address</label>
                  <Input className="h-10 rounded-xl text-sm font-medium bg-slate-50 border border-slate-200/60 hover:bg-slate-100 focus:bg-white focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all px-4" placeholder="Flat No, Building, Street..." value={newKittyForm.address || ''} onChange={(e) => setNewKittyForm({...newKittyForm, address: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">City</label>
                  <Input className="h-10 rounded-xl text-sm font-medium bg-slate-50 border border-slate-200/60 hover:bg-slate-100 focus:bg-white focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all px-4" placeholder="Mumbai" value={newKittyForm.city} onChange={(e) => setNewKittyForm({...newKittyForm, city: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">PAN Number</label>
                  <Input className="h-10 rounded-xl text-sm font-medium bg-slate-50 border border-slate-200/60 hover:bg-slate-100 focus:bg-white focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all px-4 uppercase" placeholder="ABCDE1234F" value={newKittyForm.pan_no || ''} onChange={(e) => setNewKittyForm({...newKittyForm, pan_no: e.target.value})} />
                </div>
              </>
            )}

            <div className="col-span-1 sm:col-span-2 bg-purple-50/80 p-4 rounded-xl border border-purple-100 mt-2 space-y-4">
               <label className="text-[10px] font-bold text-purple-900 uppercase block tracking-widest flex items-center gap-2">
                 <Database className="w-4 h-4 text-purple-500" /> Scheme Parameters
               </label>
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                 <div className="space-y-2">
                   <label className="text-[10px] font-bold text-purple-700 uppercase tracking-widest">Plan Tier (₹)</label>
                   <Select value={newKittyForm.config_id} onValueChange={(val) => setNewKittyForm({...newKittyForm, config_id: val})}>
                      <SelectTrigger className="h-10 bg-white border-purple-200 font-bold text-sm rounded-xl focus:ring-2 focus:ring-purple-500/20 px-4">
                        <SelectValue placeholder="Select Plan Tier" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl border-purple-100 shadow-xl p-1">
                        {kittyConfigs.map(c => (
                          <SelectItem key={c.id} value={c.id} className="text-sm font-bold text-purple-700 py-2 rounded-md focus:bg-purple-50 cursor-pointer">
                            ₹ {c.monthly_amount.toLocaleString()} / mo ({c.duration_months} Mths)
                          </SelectItem>
                        ))}
                      </SelectContent>
                   </Select>
                 </div>
                 <div className="space-y-2">
                   <label className="text-[10px] font-bold text-purple-700 uppercase tracking-widest flex items-center gap-1.5"><Calendar className="w-3 h-3"/> Enrollment Date</label>
                   <Input type="date" className="h-10 text-xs font-medium text-slate-700 bg-white border-purple-200 rounded-xl focus:ring-2 focus:ring-purple-500/20 px-4" value={newKittyForm.start_date} onChange={(e) => setNewKittyForm({...newKittyForm, start_date: e.target.value})} />
                 </div>
               </div>
            </div>
          </div>
          <DialogFooter className="bg-slate-50/80 p-5 border-t border-slate-100 flex flex-col sm:flex-row gap-3 shrink-0 pb-safe">
            <Button variant="ghost" className="w-full sm:flex-1 h-10 rounded-xl text-xs font-bold uppercase tracking-widest text-slate-500 hover:bg-slate-200 transition-colors px-6" onClick={() => setIsAddKittyModalOpen(false)}>Cancel</Button>
            <Button disabled={isSubmitting || !newKittyForm.full_name || !newKittyForm.phone} className="w-full sm:flex-[2] h-10 rounded-xl text-xs font-bold uppercase tracking-widest bg-purple-600 hover:bg-purple-700 text-white shadow-sm transition-all active:scale-95" onClick={handleAddKittyMember}>
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Gem className="w-4 h-4 mr-2" strokeWidth={2.5}/>}
              Confirm Enrollment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* PURCHASE HISTORY MODAL */}
<Dialog open={isHistoryModalOpen} onOpenChange={setIsHistoryModalOpen}>
  <DialogContent className="sm:max-w-[500px] bg-white p-0 overflow-hidden border-none shadow-2xl rounded-2xl">
    <DialogHeader className="bg-slate-50 p-5 border-b border-slate-100">
      <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
        <History className="w-5 h-5 text-amber-500" /> Activity History
      </DialogTitle>
      <DialogDescription className="text-xs">
        Past purchases, repairs, and orders for <b>{selectedCustomer?.full_name}</b>
      </DialogDescription>
    </DialogHeader>

    <div className="p-5 max-h-[60vh] overflow-y-auto custom-scrollbar bg-slate-50/50">
      {isHistoryLoading ? (
        <div className="flex justify-center items-center py-10">
          <Loader2 className="w-6 h-6 animate-spin text-slate-300" />
        </div>
      ) : customerHistory.length === 0 ? (
        <div className="text-center py-10 text-slate-400 text-sm font-medium">
          No previous transactions found for this customer.
        </div>
      ) : (
        <div className="space-y-3 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-200 before:to-transparent">
          {customerHistory.map((item: any, idx: number) => (
            <div key={idx} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
              <div className="flex items-center justify-center w-10 h-10 rounded-full border border-white bg-slate-100 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
                {item.type === 'Invoice' && <IndianRupee className="w-4 h-4 text-emerald-500" />}
                {item.type === 'Custom Order' && <Hammer className="w-4 h-4 text-blue-500" />}
                {item.type === 'Repair' && <Wrench className="w-4 h-4 text-orange-500" />}
                {item.type === 'Estimate' && <FileText className="w-4 h-4 text-slate-500" />}
              </div>
              <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-xl border border-slate-100 bg-white shadow-sm">
                <div className="flex items-center justify-between space-x-2 mb-1">
                  <div className="font-bold text-slate-900 text-sm">{item.type}</div>
                  <time className="text-[10px] font-mono font-medium text-slate-500">{new Date(item.date).toLocaleDateString('en-IN')}</time>
                </div>
                <div className="text-xs text-slate-600 mb-2 font-mono bg-slate-50 px-2 py-1 rounded inline-block">Ref: {item.ref}</div>
                <div className="flex justify-between items-center text-sm font-black text-slate-800 border-t border-slate-50 pt-2">
                  <span>Value:</span>
                  <span>₹ {Number(item.amt || 0).toLocaleString()}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
    
    <DialogFooter className="bg-white p-4 border-t border-slate-100">
      <Button variant="outline" className="w-full h-10 rounded-xl text-xs font-bold uppercase tracking-widest text-slate-500" onClick={() => setIsHistoryModalOpen(false)}>
        Close Timeline
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>

      {/* CALL LOGGER MODAL */}
      <Dialog open={isCallModalOpen} onOpenChange={setIsCallModalOpen}>
        <DialogContent className={cn(DIALOG_CONTENT_CLASS, "sm:max-w-[450px]")}>
          <DialogHeader className="bg-slate-50/80 p-6 border-b border-slate-100 shrink-0">
            <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2.5 tracking-tight">
              <Phone className="w-5 h-5 text-blue-600" strokeWidth={2} /> Log Call Outcome
            </DialogTitle>
            <DialogDescription className="text-xs font-medium text-slate-500 mt-1">For <span className="font-bold text-slate-800">{selectedCustomer?.full_name}</span></DialogDescription>
          </DialogHeader>

          <div className="space-y-5 p-6 bg-white overflow-y-auto custom-scrollbar flex-1">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Call Outcome <span className="text-red-500">*</span></label>
              <Select value={callForm.outcome} onValueChange={(val) => setCallForm({ ...callForm, outcome: val })}>
                <SelectTrigger className="h-10 rounded-xl text-sm font-semibold bg-slate-50 border border-slate-200/60 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all px-4">
                  <SelectValue placeholder="Select outcome..." />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-slate-100 shadow-xl p-1">
                  <SelectItem value="Connected / Spoke to Customer" className="text-sm font-medium py-2 rounded-md">Connected / Spoke to Customer</SelectItem>
                  <SelectItem value="Ringing / No Answer" className="text-sm font-medium py-2 rounded-md">Ringing / No Answer</SelectItem>
                  <SelectItem value="Switched Off" className="text-sm font-medium py-2 rounded-md">Switched Off</SelectItem>
                  <SelectItem value="Out of Service / Not Reachable" className="text-sm font-medium py-2 rounded-md">Out of Service / Not Reachable</SelectItem>
                  <SelectItem value="Wrong Number" className="text-sm font-medium py-2 rounded-md">Wrong Number</SelectItem>
                  <SelectItem value="Busy / Call Waiting" className="text-sm font-medium py-2 rounded-md">Busy / Call Waiting</SelectItem>
                  <SelectItem value="Call After Some Time" className="text-sm font-medium py-2 rounded-md">Call After Some Time</SelectItem>
                  <Separator className="bg-slate-100 my-1"/>
                  <SelectItem value="Not Interested (Do Not Disturb)" className="text-sm font-bold text-red-600 py-2 rounded-md focus:bg-red-50 focus:text-red-700">
                    Not Interested (Do Not Disturb)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Interaction Notes <span className="text-red-500">*</span></label>
              <textarea
                placeholder="What was discussed? / Why didn't they answer?"
                className="w-full min-h-[100px] p-3 text-sm font-medium bg-slate-50 border border-slate-200/60 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none resize-none shadow-sm transition-all text-slate-800"
                value={callForm.notes}
                onChange={(e) => setCallForm({ ...callForm, notes: e.target.value })}
              />
            </div>

            {callForm.outcome !== 'Not Interested (Do Not Disturb)' && (
              <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-100">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Next Call Date</label>
                  <Input type="date" className="h-10 rounded-xl text-xs font-medium text-slate-700 bg-white border border-slate-200/60 focus:ring-2 focus:ring-blue-500/20 px-4" value={callForm.next_call_date} onChange={(e) => setCallForm({ ...callForm, next_call_date: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Next Call Time</label>
                  <Input type="time" className="h-10 rounded-xl text-xs font-medium text-slate-700 bg-white border border-slate-200/60 focus:ring-2 focus:ring-blue-500/20 px-4" value={callForm.next_call_time} onChange={(e) => setCallForm({ ...callForm, next_call_time: e.target.value })} />
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="bg-slate-50/80 p-5 border-t border-slate-100 flex flex-col sm:flex-row gap-3 shrink-0 pb-safe">
            <Button variant="ghost" className="w-full sm:flex-1 h-10 rounded-xl text-xs font-bold uppercase tracking-widest text-slate-500 hover:bg-slate-200 transition-colors px-6" onClick={() => setIsCallModalOpen(false)}>Cancel</Button>
            <Button disabled={isSubmitting || !callForm.outcome || !callForm.notes.trim()} className="w-full sm:flex-[2] h-10 rounded-xl text-xs font-bold uppercase tracking-widest bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-all active:scale-95" onClick={handleLogCall}>
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : 'Save Call Log'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ✨ UPDATED: SCHEDULE / AUTOMATION CONTROL MODAL */}
      <Dialog open={isFollowupModalOpen} onOpenChange={setIsFollowupModalOpen}>
        <DialogContent className={cn(DIALOG_CONTENT_CLASS, "sm:max-w-[400px]")}>
          <DialogHeader className="bg-slate-50/80 p-6 border-b border-slate-100 shrink-0">
            <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2.5 tracking-tight">
              {activeSequence ? <Settings2 className="w-5 h-5 text-indigo-600" /> : <Calendar className="w-5 h-5 text-blue-600" />}
              {activeSequence ? 'Manage Automation' : 'Schedule Follow-up'}
            </DialogTitle>
            <DialogDescription className="text-xs font-medium text-slate-500 mt-1">For <span className="font-bold text-slate-800">{selectedCustomer?.full_name}</span></DialogDescription>
          </DialogHeader>
          
          <div className="space-y-5 p-6 bg-white overflow-y-auto custom-scrollbar flex-1">
            
            {activeSequence ? (
              // ✨ AUTOMATION MANAGER VIEW
              <div className="space-y-5">
                <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4">
                  <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest mb-1">Active Voucher Flow</p>
                  <p className="font-mono text-sm font-bold text-indigo-900">{activeSequence.voucher_code}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Status</label>
                    <Select value={sequenceForm.status} onValueChange={(val) => setSequenceForm({ ...sequenceForm, status: val })}>
                      <SelectTrigger className="h-10 text-sm bg-white border-slate-200 rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="paused">Paused</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Wait Interval (Hrs)</label>
                    <Input 
                      type="number" 
                      className="h-10 text-sm bg-white border-slate-200 rounded-xl font-mono" 
                      value={sequenceForm.interval_hours} 
                      onChange={(e) => setSequenceForm({ ...sequenceForm, interval_hours: Number(e.target.value) })} 
                    />
                  </div>
                </div>
              </div>
            ) : (
              // STANDARD MANUAL FOLLOW-UP VIEW
              <>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">1. Goal / Reason</label>
                  <Input 
                    className="h-10 rounded-xl text-sm font-semibold bg-slate-50 border border-slate-200/60 focus:bg-white focus:ring-2 focus:ring-blue-500/20 px-4" 
                    placeholder="E.g. Wants to buy a bridal set" 
                    value={followupReason} onChange={(e) => setFollowupReason(e.target.value)} 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">2. Next Action Date</label>
                  <Input type="date" className="h-10 rounded-xl text-xs font-medium text-slate-700 bg-white border border-slate-200/60 focus:ring-2 focus:ring-blue-500/20 px-4" value={followupDate} onChange={(e) => setFollowupDate(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">3. Notes (Optional)</label>
                  <textarea 
                    className="w-full min-h-[80px] p-3 text-sm font-medium bg-slate-50 border border-slate-200/60 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500/20 outline-none resize-none shadow-sm transition-all text-slate-800"
                    placeholder="Any previous context..." 
                    value={interactionNotes} onChange={(e) => setInteractionNotes(e.target.value)} 
                  />
                </div>
              </>
            )}

          </div>
          <DialogFooter className="bg-slate-50/80 p-5 border-t border-slate-100 flex flex-col sm:flex-row gap-3 shrink-0 pb-safe">
            <Button variant="ghost" className="w-full sm:flex-1 h-10 rounded-xl text-xs font-bold uppercase tracking-widest text-slate-500 hover:bg-slate-200 transition-colors px-6" onClick={() => setIsFollowupModalOpen(false)}>Cancel</Button>
            
            {activeSequence ? (
              <Button disabled={isUpdatingSequence} className="w-full sm:flex-[2] h-10 rounded-xl text-xs font-bold uppercase tracking-widest bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-all active:scale-95" onClick={handleUpdateSequence}>
                {isUpdatingSequence ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : 'Save Sequence'}
              </Button>
            ) : (
              <Button disabled={isSubmitting} className="w-full sm:flex-[2] h-10 rounded-xl text-xs font-bold uppercase tracking-widest bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-all active:scale-95" onClick={handleUpdateFollowup}>
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : 'Save Schedule'}
              </Button>
            )}

          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 5. WHATSAPP MODAL */}
      <Dialog open={isWhatsAppModalOpen} onOpenChange={setIsWhatsAppModalOpen}>
        <DialogContent className={cn(DIALOG_CONTENT_CLASS, "sm:max-w-[500px]")}>
          <DialogHeader className="bg-[#25D366]/5 p-6 border-b border-[#25D366]/20 shrink-0">
            <DialogTitle className="text-lg font-bold flex items-center gap-2.5 text-[#1DA851] tracking-tight">
              <MessageCircle className="w-5 h-5" strokeWidth={2.5} /> Campaign Message
            </DialogTitle>
            <DialogDescription className="text-xs font-medium text-slate-500 mt-1">To: <span className="font-bold text-slate-800">{selectedCustomer?.full_name}</span> ({selectedCustomer?.phone})</DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 p-6 bg-white overflow-y-auto custom-scrollbar flex-1">
            <div className="space-y-2.5">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center justify-between">
                <span>1. Select Template</span>
                {activeAiFilter !== 'none' && <Badge variant="outline" className="text-[9px] font-bold h-5 bg-blue-50 text-blue-600 border-none uppercase tracking-wider rounded-md px-2 py-0">Auto-Selected</Badge>}
              </label>
              <Select value={waTemplateId} onValueChange={handleTemplateChange}>
                <SelectTrigger className="h-10 rounded-xl text-sm font-semibold bg-slate-50 border border-slate-200/60 hover:bg-slate-100 focus:bg-white focus:ring-2 focus:ring-[#25D366]/20 focus:border-[#25D366] transition-all px-4">
                  <SelectValue placeholder="Choose a template" />
                </SelectTrigger>
                <SelectContent className="rounded-xl shadow-lg border-slate-100 p-1">
                  {availableTemplates.length === 0 ? (
                    <SelectItem value="none" disabled className="text-sm italic text-slate-400 py-2 rounded-md">No templates configured.</SelectItem>
                  ) : (
                    availableTemplates.map(t => (
                      <SelectItem key={t.template_id} value={t.template_id} className="text-sm font-semibold py-2 rounded-md cursor-pointer focus:bg-[#25D366]/10 focus:text-[#1DA851]">{t.label}</SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2.5">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex justify-between items-end">
                <span>2. Customize Message</span>
                <span className="text-slate-400 font-semibold lowercase text-[9px]">Editable</span>
              </label>
              <div className="relative">
                <textarea 
                  className="w-full min-h-[150px] p-4 text-sm font-medium bg-slate-50 border border-slate-200/60 rounded-xl focus:bg-white focus:ring-2 focus:ring-[#25D366]/20 focus:border-[#25D366] outline-none shadow-sm resize-none leading-relaxed text-slate-800 transition-all"
                  placeholder="Type your message here..."
                  value={customMessage}
                  onChange={(e) => setCustomMessage(e.target.value)}
                />
              </div>
            </div>
          </div>

          <DialogFooter className="bg-slate-50/80 p-5 border-t border-slate-100 flex flex-col sm:flex-row gap-3 shrink-0 pb-safe">
            <Button variant="ghost" className="w-full sm:flex-1 h-10 rounded-xl text-xs font-bold uppercase tracking-widest text-slate-500 hover:bg-slate-200 transition-colors px-6" onClick={() => setIsWhatsAppModalOpen(false)}>Cancel</Button>
            <Button className="w-full sm:flex-[2] h-10 rounded-xl text-xs font-bold uppercase tracking-widest bg-[#25D366] hover:bg-[#1DA851] text-white shadow-sm transition-all active:scale-95" onClick={handleSendWhatsApp}>
              <MessageCircle className="w-4 h-4 mr-2" strokeWidth={2.5}/> Send via WhatsApp
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}