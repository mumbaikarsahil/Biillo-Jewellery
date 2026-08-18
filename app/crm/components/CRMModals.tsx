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
  isWaActivityModalOpen: boolean; setIsWaActivityModalOpen: (val: boolean) => void;
  customerHistory: any[];
  isHistoryLoading: boolean;

  isCallModalOpen: boolean; setIsCallModalOpen: (v: boolean) => void;
  callForm: {
    caller_profile_id: string;
    outcome: string;
    interest_level?: string; 
    notes: string;
    next_call_date: string;
    next_call_time: string;
  };
  setCallForm: React.Dispatch<React.SetStateAction<{
    caller_profile_id: string;
      outcome: string;
    interest_level?: string; 
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

const DIALOG_CONTENT_CLASS = "w-full border sm:border-zinc-200 sm:rounded-xl rounded-t-xl rounded-b-none bg-white shadow-xl p-0 overflow-hidden flex flex-col !top-auto !bottom-0 !translate-y-0 sm:!top-[10vh] sm:!bottom-auto max-h-[90vh] sm:max-h-[85vh]";

export function CRMModals(props: CRMModalsProps) {
  const {
    isHistoryModalOpen, setIsHistoryModalOpen, customerHistory, isHistoryLoading,
    isImportModalOpen, setIsImportModalOpen, isPreviewModalOpen, setIsPreviewModalOpen,
    isProfileModalOpen, setIsProfileModalOpen, isLoyaltyModalOpen, setIsLoyaltyModalOpen,
    isAddModalOpen, setIsAddModalOpen, isAddKittyModalOpen, setIsAddKittyModalOpen,
    isFollowupModalOpen, setIsFollowupModalOpen, isWhatsAppModalOpen, setIsWhatsAppModalOpen,
    isWaActivityModalOpen, setIsWaActivityModalOpen,
    
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
  
  const activeSequence = selectedCustomer?.voucher_message_sequences?.find((s: any) => ['active', 'paused'].includes(s.status)) as any;
  const [sequenceForm, setSequenceForm] = useState({ status: '', interval_hours: 96, current_step: 1 });
  const [isUpdatingSequence, setIsUpdatingSequence] = useState(false);

  // 1. Add the state to hold the fetched profiles
const [profilesList, setProfilesList] = useState<any[]>([]);

// 2. Add this useEffect to fetch the active users from Supabase
useEffect(() => {
  const fetchProfiles = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, role')
        .eq('is_active', true) // Only show active employees
        .order('full_name', { ascending: true });

      if (error) throw error;
      
      if (data) {
        setProfilesList(data);
      }
    } catch (error) {
      console.error("Error fetching profiles:", error);
    }
  };

  fetchProfiles();
}, []);

  // ✨ Separate Activity Arrays for clean rendering
  const waActivity = customerHistory?.filter((item: any) => item.type === 'WhatsApp Webhook') || [];
  const purchaseActivity = customerHistory?.filter((item: any) => item.type !== 'WhatsApp Webhook') || [];

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
          <DialogHeader className="bg-white p-5 border-b border-zinc-200 shrink-0">
            <DialogTitle className="text-base font-semibold flex items-center gap-2 text-zinc-900">
              <UploadCloud className="w-4 h-4 text-zinc-500" /> Bulk Import Customers
            </DialogTitle>
            <DialogDescription className="text-sm text-zinc-500 mt-1">
              Upload a .csv file to import records into the CRM.
            </DialogDescription>
          </DialogHeader>

          <div className="p-5 space-y-5 bg-white overflow-y-auto custom-scrollbar flex-1">
            <div className="bg-zinc-50 border border-zinc-200 p-4 rounded-lg flex flex-col sm:flex-row gap-3 items-center justify-between">
              <div className="flex flex-col text-center sm:text-left">
                <span className="font-medium text-zinc-900 text-sm">Need the format?</span>
                <span className="text-xs text-zinc-500">Download the blank template.</span>
              </div>
              <Button variant="outline" size="sm" onClick={handleDownloadSample} className="h-8 px-4 rounded-md border-zinc-200 text-zinc-700 bg-white hover:bg-zinc-100 text-xs font-medium w-full sm:w-auto shadow-sm">
                <Download className="w-3.5 h-3.5 mr-1.5" /> Sample
              </Button>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-zinc-700">Select File (.CSV)</label>
              <label className={cn(
                "flex flex-col items-center justify-center w-full h-32 border border-dashed rounded-lg cursor-pointer transition-all",
                importFile ? 'border-zinc-900 bg-zinc-50' : 'border-zinc-300 hover:bg-zinc-50 bg-white'
              )}>
                <div className="flex flex-col items-center justify-center pt-5 pb-6 text-center px-4">
                  {isImporting ? (
                     <Loader2 className="w-6 h-6 text-zinc-900 animate-spin mb-3" />
                  ) : importFile ? (
                     <FileSpreadsheet className="w-6 h-6 text-zinc-900 mb-3" />
                  ) : (
                     <UploadCloud className="w-6 h-6 text-zinc-400 mb-3" />
                  )}
                  <p className="text-sm font-medium text-zinc-700 truncate w-full max-w-[200px]">{importFile ? importFile.name : "Click or drag file here"}</p>
                </div>
                <input type="file" accept=".csv" className="hidden" onChange={(e) => setImportFile(e.target.files?.[0] || null)} />
              </label>
            </div>
            <p className="text-xs text-zinc-500 leading-relaxed">
              Phone numbers are used to prevent duplicates. Existing profiles with the same number will be updated.
            </p>
          </div>

          <DialogFooter className="bg-zinc-50 p-4 border-t border-zinc-200 flex flex-col sm:flex-row gap-3 shrink-0">
            <Button variant="outline" className="w-full sm:flex-1 h-9 rounded-md text-sm font-medium text-zinc-700 bg-white border-zinc-200 hover:bg-zinc-100 shadow-sm" onClick={() => setIsImportModalOpen(false)}>Cancel</Button>
            <Button disabled={isImporting || !importFile} className="w-full sm:flex-[2] h-9 rounded-md text-sm font-medium bg-zinc-900 hover:bg-zinc-800 text-white shadow-sm transition-all" onClick={handleParseFile}>
              {isImporting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : 'Review Data'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 0.5 IMPORT PREVIEW MODAL */}
      <Dialog open={isPreviewModalOpen} onOpenChange={setIsPreviewModalOpen}>
        <DialogContent className={cn(DIALOG_CONTENT_CLASS, "sm:max-w-[95vw]")}>
          <DialogHeader className="bg-white p-5 border-b border-zinc-200 shrink-0">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
              <div>
                <DialogTitle className="text-base font-semibold flex items-center gap-2 text-zinc-900">
                  <Database className="w-4 h-4 text-zinc-500" /> Import Staging Area
                </DialogTitle>
                <DialogDescription className="text-sm text-zinc-500 mt-1 hidden sm:block">
                  Review and edit {previewData.length} parsed records before committing.
                </DialogDescription>
              </div>
              <Badge variant="outline" className="bg-zinc-100 text-zinc-800 border-zinc-200 text-xs font-medium px-2.5 py-1 rounded-md shrink-0 w-fit self-start sm:self-auto">
                {previewData.length} Records
              </Badge>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-auto bg-zinc-50 custom-scrollbar p-4">
            <div className="border border-zinc-200 bg-white rounded-lg shadow-sm h-full overflow-hidden">
              <Table className="w-max min-w-full">
                <TableHeader className="bg-zinc-50/80 sticky top-0 z-10 border-b border-zinc-200">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-10"></TableHead>
                    <TableHead className="text-xs font-medium text-zinc-500 h-10 w-[180px]">Full Name</TableHead>
                    <TableHead className="text-xs font-medium text-zinc-500 h-10 w-[140px]">Phone</TableHead>
                    <TableHead className="text-xs font-medium text-zinc-500 h-10 w-[150px]">Status</TableHead>
                    <TableHead className="text-xs font-medium text-zinc-500 h-10 w-[140px]">City</TableHead>
                    <TableHead className="text-xs font-medium text-zinc-500 h-10 w-[120px]">Credit(₹)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewData.map((row, index) => (
                    <TableRow key={row._id} className="hover:bg-zinc-50 border-b border-zinc-100 last:border-0">
                      <TableCell className="p-2 text-center">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-400 hover:text-red-600 rounded-md" onClick={() => removePreviewRow(index)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                      <TableCell className="p-2">
                        <Input className="h-8 rounded-md text-sm border-transparent hover:border-zinc-200 focus:bg-white focus:ring-1 focus:ring-zinc-900 focus:border-zinc-900 transition-all shadow-none" value={row.full_name} onChange={(e) => updatePreviewRow(index, 'full_name', e.target.value)} />
                      </TableCell>
                      <TableCell className="p-2">
                        <Input className="h-8 rounded-md text-sm font-mono border-transparent hover:border-zinc-200 focus:bg-white focus:ring-1 focus:ring-zinc-900 focus:border-zinc-900 transition-all shadow-none" value={row.phone} onChange={(e) => updatePreviewRow(index, 'phone', e.target.value.replace(/\D/g, ''))} />
                      </TableCell>
                      <TableCell className="p-2">
                        <Select value={row.customer_status} onValueChange={(val) => updatePreviewRow(index, 'customer_status', val)}>
                          <SelectTrigger className="h-8 rounded-md text-sm border-transparent hover:border-zinc-200 focus:bg-white focus:ring-1 focus:ring-zinc-900 focus:border-zinc-900 transition-all bg-transparent shadow-none">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="rounded-md shadow-lg border-zinc-200">
                            <SelectItem value="Lead" className="text-sm">Lead</SelectItem>
                            <SelectItem value="Purchased" className="text-sm">Purchased</SelectItem>
                            <SelectItem value="Kitty Member" className="text-sm">Kitty Member</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="p-2">
                        <Input className="h-8 rounded-md text-sm border-transparent hover:border-zinc-200 focus:bg-white focus:ring-1 focus:ring-zinc-900 focus:border-zinc-900 transition-all shadow-none" value={row.city} onChange={(e) => updatePreviewRow(index, 'city', e.target.value)} />
                      </TableCell>
                      <TableCell className="p-2">
                        <Input type="number" className="h-8 rounded-md text-sm font-mono border-transparent hover:border-zinc-200 focus:bg-white focus:ring-1 focus:ring-zinc-900 focus:border-zinc-900 transition-all shadow-none" value={row.store_credit_balance} onChange={(e) => updatePreviewRow(index, 'store_credit_balance', e.target.value)} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          <DialogFooter className="bg-zinc-50 p-4 border-t border-zinc-200 flex flex-col sm:flex-row gap-3 shrink-0">
            <Button variant="outline" className="w-full sm:w-auto sm:flex-1 h-9 rounded-md text-sm font-medium text-zinc-700 bg-white border-zinc-200 hover:bg-zinc-100 shadow-sm" onClick={() => setIsPreviewModalOpen(false)}>Discard</Button>
            <Button disabled={isSubmitting || previewData.length === 0} className="w-full sm:w-auto sm:flex-[2] h-9 rounded-md text-sm font-medium bg-zinc-900 hover:bg-zinc-800 text-white shadow-sm transition-all" onClick={handleCommitImport}>
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Database className="w-4 h-4 mr-2" />}
              Confirm & Import
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 1. CUSTOMER PROFILE MODAL */}
      <Dialog open={isProfileModalOpen} onOpenChange={setIsProfileModalOpen}>
        <DialogContent className={cn(DIALOG_CONTENT_CLASS, "sm:max-w-[700px]")}>
          {selectedCustomer && (
            <>
              <DialogHeader className="bg-white p-5 border-b border-zinc-200 shrink-0">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <DialogTitle className="text-lg font-semibold text-zinc-900">{selectedCustomer.full_name}</DialogTitle>
                    <div className="flex flex-wrap items-center gap-3 mt-1.5 text-sm text-zinc-500">
                      <span className="flex items-center gap-1.5 font-mono"><Phone className="w-3.5 h-3.5"/> {selectedCustomer.phone}</span>
                      <span className="text-zinc-300">|</span>
                      <span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5"/> {selectedCustomer.city || 'Unknown City'}</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Button 
                      size="icon" variant="ghost" 
                      className="h-8 w-8 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 rounded-md" 
                      title="Edit Profile"
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
                      "text-xs font-medium px-2.5 py-0.5 rounded-md border",
                      selectedCustomer.customer_status === 'Kitty Member' || isKittyMember ? "bg-purple-50 text-purple-700 border-purple-200" :
                      selectedCustomer.customer_status === 'Purchased' ? "bg-emerald-50 text-emerald-700 border-emerald-200" : 
                      "bg-zinc-100 text-zinc-700 border-zinc-200"
                    )}>
                      {selectedCustomer.customer_status || 'Lead'}
                    </Badge>
                  </div>
                </div>
              </DialogHeader>

              <div className="p-5 overflow-y-auto custom-scrollbar space-y-6 bg-zinc-50 flex-1">
                {/* Top Row: Wallet & Base Info */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-zinc-900 rounded-lg p-5 shadow-sm flex flex-col justify-center relative overflow-hidden">
                    <div className="flex justify-between items-center mb-3 relative z-10">
                      <h3 className="text-sm font-medium text-zinc-400 flex items-center gap-1.5">
                        <Wallet className="w-4 h-4"/> Pavitram Credits
                      </h3>
                      <Button 
                        size="icon" variant="ghost" 
                        className="h-7 w-7 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-md" 
                        onClick={() => setIsLoyaltyModalOpen(true)} title="Adjust Credits"
                      >
                        <Edit2 className="w-3.5 h-3.5"/>
                      </Button>
                    </div>
                    <p className="text-3xl font-semibold text-white relative z-10 font-mono">
                      ₹{(selectedCustomer.store_credit_balance || 0).toLocaleString()}
                    </p>
                  </div>

                  <div className="bg-white border border-zinc-200 rounded-lg p-5 flex flex-col justify-center space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-zinc-500">Birth Date</span>
                      <span className="text-sm font-medium text-zinc-900">
                        {selectedCustomer.birth_date ? format(new Date(selectedCustomer.birth_date), 'dd MMM yyyy') : 'Not Set'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-zinc-500">Anniversary</span>
                      <span className="text-sm font-medium text-zinc-900">
                        {selectedCustomer.anniversary_date ? format(new Date(selectedCustomer.anniversary_date), 'dd MMM yyyy') : 'Not Set'}
                      </span>
                    </div>
                    <Separator className="bg-zinc-100" />
                    <div className="flex justify-between items-center pt-1">
                      <span className="text-sm text-zinc-500">Customer Since</span>
                      <span className="text-sm font-medium text-zinc-900">
                        {format(new Date(selectedCustomer.created_at), 'dd MMM yyyy')}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Harvesting Plans */}
                <div className="bg-white border border-zinc-200 rounded-lg shadow-sm overflow-hidden">
                  <div className="border-b border-zinc-200 p-4 flex justify-between items-center">
                    <h3 className="text-sm font-medium text-zinc-900 flex items-center gap-2">
                      <Gem className="w-4 h-4 text-zinc-500"/> Harvesting Plans
                    </h3>
                    <Button 
                      variant="outline" size="sm" 
                      className="h-8 rounded-md text-xs font-medium border-zinc-200 text-zinc-900 bg-white hover:bg-zinc-50"
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
                  
                  <div className="p-5 space-y-6">
                    {selectedCustomer.kitty_plans && selectedCustomer.kitty_plans.length > 0 ? (
                      selectedCustomer.kitty_plans.map((plan: any, planIndex: number) => {
                        const dynamicBonus = Number(plan.bonus_amount) || 0;
                        const maturedValue = (plan.total_months * plan.plan_amount) + dynamicBonus;
                        const isRedeemed = plan.status?.toLowerCase() === 'redeemed';

                        if (isRedeemed) {
                          return (
                            <div key={plan.id} className={cn("relative opacity-70", planIndex > 0 ? "pt-5 border-t border-zinc-100" : "")}>
                              <div className="bg-zinc-50 border border-zinc-200 rounded-lg p-4 flex justify-between items-center">
                                <div>
                                  <div className="flex items-center gap-2 mb-1">
                                    <p className="text-sm font-medium text-zinc-900">{plan.plan_name}</p>
                                    <Badge variant="outline" className="text-[10px] px-2 py-0.5 rounded bg-zinc-200 border-none text-zinc-700">Completed</Badge>
                                  </div>
                                  <p className="text-xs text-zinc-500">Value Claimed: ₹{maturedValue.toLocaleString()}</p>
                                </div>
                              </div>
                            </div>
                          )
                        }

                        return (
                          <div key={plan.id} className={cn("relative", planIndex > 0 ? "pt-6 border-t border-zinc-100" : "")}>
                            <div className="flex justify-between items-end mb-4">
                              <div>
                                <div className="flex items-center gap-2 mb-1">
                                  <p className="text-sm font-medium text-zinc-900">{plan.plan_name}</p>
                                  <Badge variant="outline" className={cn(
                                    "text-[10px] px-2 py-0.5 rounded border-none", 
                                    plan.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-zinc-100 text-zinc-600'
                                  )}>
                                    {plan.status}
                                  </Badge>
                                </div>
                                <p className="text-xs text-zinc-500">₹{plan.plan_amount.toLocaleString()} / month • {plan.total_months} Months</p>
                              </div>
                              <div className="text-right">
                                <p className="text-xs text-zinc-500 mb-0.5">Months Paid</p>
                                <p className="text-xl font-medium text-zinc-900 font-mono">{plan.months_paid} <span className="text-sm text-zinc-400">/ {plan.total_months}</span></p>
                              </div>
                            </div>

                            <div className="w-full bg-zinc-100 h-2 rounded-full overflow-hidden mb-5">
                              <div 
                                className="bg-zinc-900 h-full rounded-full transition-all duration-500" 
                                style={{ width: `${Math.min((plan.months_paid / plan.total_months) * 100, 100)}%` }}
                              />
                            </div>

                            <div className="mb-5">
                              <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                                {Array.from({length: plan.total_months}).map((_, i) => {
                                  const monthNum = i + 1;
                                  const isPaid = monthNum <= plan.months_paid;
                                  const isCurrent = monthNum === plan.months_paid + 1 && plan.status === 'active';

                                  return (
                                    <div key={i} className={cn(
                                      "rounded-md p-2 flex flex-col items-center justify-center gap-1.5 transition-all relative overflow-hidden h-[56px]",
                                      isPaid ? "bg-zinc-100 border border-zinc-200" :
                                      isCurrent ? "bg-white border border-zinc-900 shadow-sm" :
                                      "bg-zinc-50 border border-zinc-100 opacity-60"
                                    )}>
                                      <span className={cn("text-[10px] font-medium", isPaid ? "text-zinc-600" : isCurrent ? "text-zinc-900" : "text-zinc-400")}>
                                        M{monthNum}
                                      </span>
                                      {isPaid ? <CheckCircle2 className="w-3.5 h-3.5 text-zinc-600"/> : 
                                       isCurrent ? <Clock className="w-3.5 h-3.5 text-zinc-900"/> : 
                                       <Lock className="w-3 h-3 text-zinc-300"/>}
                                      
                                      {isCurrent && (
                                        <div className="absolute inset-0 flex flex-col">
                                          <button 
                                            className="flex-1 bg-zinc-900 text-white text-[10px] font-medium opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center"
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

                            <div className="flex gap-4 p-4 bg-zinc-50 rounded-lg border border-zinc-200">
                              <div className="flex-1">
                                <p className="text-xs text-zinc-500 mb-0.5">Total Paid</p>
                                <p className="text-sm font-medium text-zinc-900 font-mono">₹{(plan.months_paid * plan.plan_amount).toLocaleString()}</p>
                              </div>
                              <div className="flex-1 border-l border-zinc-200 pl-4">
                                <p className="text-xs text-zinc-500 mb-0.5 flex items-center gap-1">Bonus</p>
                                <p className="text-sm font-medium text-emerald-600 font-mono">+ ₹{dynamicBonus.toLocaleString()}</p>
                              </div>
                              <div className="flex-1 border-l border-zinc-200 pl-4">
                                <p className="text-xs text-zinc-500 mb-0.5">Maturity</p>
                                <p className="text-sm font-medium text-zinc-900 font-mono">₹{maturedValue.toLocaleString()}</p>
                              </div>
                            </div>
                          </div>
                        )
                      })
                    ) : (
                      <div className="text-center py-6">
                        <p className="text-sm text-zinc-500">No active Harvesting Plans.</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Vouchers & Automations */}
                <div className="bg-white border border-zinc-200 rounded-lg shadow-sm overflow-hidden">
                  <div className="border-b border-zinc-200 p-4">
                    <h3 className="text-sm font-medium text-zinc-900 flex items-center gap-2">
                      <Ticket className="w-4 h-4 text-zinc-500"/> Vouchers & Automations
                    </h3>
                  </div>
                  
                  <div className="p-5 space-y-6">
                    <div>
                      <h4 className="text-xs font-medium text-zinc-500 mb-3">Assigned Vouchers</h4>
                      {selectedCustomer.vouchers && selectedCustomer.vouchers.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {selectedCustomer.vouchers.map((voucher: any) => (
                            <div key={voucher.id} className="flex items-center gap-2 bg-zinc-50 border border-zinc-200 rounded-md py-1 px-2.5">
                              <span className="font-mono text-xs font-medium text-zinc-900">{voucher.code}</span>
                              <Badge variant="outline" className={cn(
                                "text-[10px] px-1.5 py-0 border-none rounded",
                                voucher.status === 'registered' ? "bg-emerald-100 text-emerald-700" :
                                voucher.status === 'redeemed' ? "bg-zinc-200 text-zinc-600" :
                                "bg-amber-100 text-amber-700"
                              )}>
                                {voucher.status}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-zinc-500">No vouchers assigned.</p>
                      )}
                    </div>

                    <Separator className="bg-zinc-100" />

                    <div>
                      <h4 className="text-xs font-medium text-zinc-500 mb-3 flex items-center gap-1.5">
                        <Bot className="w-3.5 h-3.5"/> Active Sequences
                      </h4>
                      {selectedCustomer.voucher_message_sequences && selectedCustomer.voucher_message_sequences.length > 0 ? (
                        <div className="space-y-3">
                          {selectedCustomer.voucher_message_sequences.map((seq: any) => (
                            <div key={seq.id} className="bg-white border border-zinc-200 rounded-lg p-3 flex justify-between items-center">
                              <div>
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="font-medium text-sm text-zinc-900">{seq.voucher_code}</span>
                                  <Badge variant="outline" className={cn(
                                    "text-[10px] px-1.5 py-0 border-none rounded",
                                    seq.status === 'active' ? "bg-emerald-100 text-emerald-700" : 
                                    seq.status === 'paused' ? "bg-amber-100 text-amber-700" :
                                    "bg-zinc-100 text-zinc-600"
                                  )}>
                                    {seq.status}
                                  </Badge>
                                </div>
                                <p className="text-xs text-zinc-500">Step {seq.current_step}</p>
                              </div>
                              
                              {seq.status === 'active' && seq.next_send_at && (
                                <div className="text-right">
                                  <p className="text-[10px] text-zinc-500 flex items-center gap-1 justify-end">
                                    <Clock className="w-3 h-3"/> Next Msg
                                  </p>
                                  <p className="text-xs font-medium text-zinc-900 mt-0.5">
                                    {format(new Date(seq.next_send_at), 'dd MMM, hh:mm a')}
                                  </p>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-zinc-500">No active automations.</p>
                      )}
                    </div>
                  </div>
                </div>

              </div>
              <div className="bg-zinc-50 p-4 border-t border-zinc-200 shrink-0 hidden sm:flex justify-end">
                <Button variant="outline" className="h-9 px-6 rounded-md text-sm font-medium text-zinc-700 bg-white border-zinc-200 hover:bg-zinc-100" onClick={() => setIsProfileModalOpen(false)}>Close</Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* --- CREDITS ADJUSTMENT MODAL --- */}
      <Dialog open={isLoyaltyModalOpen} onOpenChange={setIsLoyaltyModalOpen}>
        <DialogContent className={cn(DIALOG_CONTENT_CLASS, "sm:max-w-[400px]")}>
          <DialogHeader className="bg-white p-5 border-b border-zinc-200 shrink-0">
            <DialogTitle className="text-base font-semibold text-zinc-900 flex items-center gap-2">
              <Wallet className="w-4 h-4 text-zinc-500" /> Manage Credits
            </DialogTitle>
            <DialogDescription className="text-sm text-zinc-500 mt-1">Adjust wallet balance for {selectedCustomer?.full_name}</DialogDescription>
          </DialogHeader>
          
          <div className="p-5 space-y-4 bg-zinc-50 overflow-y-auto custom-scrollbar flex-1">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-zinc-700">Action Type</label>
              <Select value={loyaltyForm.actionType} onValueChange={(val) => {
                let defaultAmt = '';
                if (val === 'exhibition') defaultAmt = '500';
                setLoyaltyForm({...loyaltyForm, actionType: val, amount: defaultAmt, billedAmount: ''});
              }}>
                <SelectTrigger className="h-9 bg-white text-sm border-zinc-200 rounded-md focus:ring-1 focus:ring-zinc-900">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-md border-zinc-200 shadow-md">
                  <SelectItem value="exhibition" className="text-sm">Exhibition (+₹500)</SelectItem>
                  <SelectItem value="b2p_referral" className="text-sm">B2P Purchase Referral (+5%)</SelectItem>
                  <SelectItem value="wedding_intro" className="text-sm">Wedding House Intro</SelectItem>
                  <Separator className="my-1 bg-zinc-100" />
                  <SelectItem value="manual_add" className="text-sm text-emerald-600">Manual Addition (+)</SelectItem>
                  <SelectItem value="manual_deduct" className="text-sm text-red-600">Manual Deduction (-)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {loyaltyForm.actionType === 'b2p_referral' && (
              <div className="space-y-1.5 p-4 bg-white border border-zinc-200 rounded-lg">
                <label className="text-sm font-medium text-zinc-700">Referred Billed Amount</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-sm font-mono">₹</span>
                  <Input 
                    type="number"
                    className="h-9 text-sm font-mono border-zinc-200 rounded-md bg-white pl-7" 
                    placeholder="50000"
                    value={loyaltyForm.billedAmount} 
                    onChange={handleBilledAmountChange} 
                  />
                </div>
                <p className="text-xs text-zinc-500 mt-1">Automatically calculates 5% for the wallet.</p>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-zinc-700">
                {loyaltyForm.actionType === 'manual_deduct' ? 'Amount to Deduct' : 'Amount to Credit'}
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 font-mono text-base">₹</span>
                <Input 
                  type="number"
                  readOnly={loyaltyForm.actionType === 'exhibition' || loyaltyForm.actionType === 'b2p_referral'}
                  className={cn(
                    "h-10 text-base font-mono border-zinc-200 rounded-md bg-white pl-8", 
                    loyaltyForm.actionType === 'manual_deduct' ? 'text-red-600' : 'text-emerald-600'
                  )} 
                  placeholder="0"
                  value={loyaltyForm.amount} 
                  onChange={(e) => setLoyaltyForm({...loyaltyForm, amount: e.target.value})} 
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-zinc-700">Internal Note (Optional)</label>
              <Input 
                className="h-9 text-sm border-zinc-200 bg-white rounded-md" 
                placeholder="Reason for adjustment..." 
                value={loyaltyForm.notes} 
                onChange={(e) => setLoyaltyForm({...loyaltyForm, notes: e.target.value})} 
              />
            </div>
            
            {selectedCustomer && loyaltyForm.amount && (
              <div className="p-3 bg-white rounded-lg border border-zinc-200 flex justify-between items-center text-sm mt-2">
                <span className="text-zinc-500 font-medium">New Balance:</span>
                <span className="font-medium text-zinc-900 font-mono">
                  ₹{loyaltyForm.actionType === 'manual_deduct' 
                    ? Math.max(0, (Number(selectedCustomer.store_credit_balance) || 0) - Number(loyaltyForm.amount)).toLocaleString()
                    : ((Number(selectedCustomer.store_credit_balance) || 0) + Number(loyaltyForm.amount)).toLocaleString()
                  }
                </span>
              </div>
            )}
          </div>
          <DialogFooter className="bg-white p-4 border-t border-zinc-200 flex flex-col sm:flex-row gap-3 shrink-0">
            <Button variant="outline" className="w-full sm:flex-1 h-9 rounded-md text-sm font-medium text-zinc-700 border-zinc-200 bg-white hover:bg-zinc-50" onClick={() => setIsLoyaltyModalOpen(false)}>Cancel</Button>
            <Button disabled={isSubmitting || !loyaltyForm.amount} className="w-full sm:flex-[2] h-9 rounded-md text-sm font-medium bg-zinc-900 hover:bg-zinc-800 text-white shadow-sm" onClick={handleUpdateLoyalty}>
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : 'Confirm'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ADD/EDIT CUSTOMER MODAL */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className={cn(DIALOG_CONTENT_CLASS, "sm:max-w-[500px]")}>
          <DialogHeader className="bg-white p-5 border-b border-zinc-200 shrink-0">
            <DialogTitle className="text-base font-semibold text-zinc-900 flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-zinc-500" /> 
              {newCustForm.id ? 'Edit Profile' : 'New Customer'}
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-5 overflow-y-auto custom-scrollbar bg-zinc-50 flex-1">
            <div className="space-y-1.5 col-span-1 sm:col-span-2">
              <label className="text-sm font-medium text-zinc-700">Full Name <span className="text-red-500">*</span></label>
              <Input className="h-9 rounded-md text-sm border-zinc-200 bg-white focus:ring-1 focus:ring-zinc-900" value={newCustForm.full_name} onChange={(e) => setNewCustForm({...newCustForm, full_name: e.target.value})} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-zinc-700">Phone <span className="text-red-500">*</span></label>
              <Input className="h-9 rounded-md text-sm font-mono border-zinc-200 bg-white focus:ring-1 focus:ring-zinc-900" value={newCustForm.phone} onChange={(e) => setNewCustForm({...newCustForm, phone: e.target.value})} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-zinc-700 flex items-center gap-1"><Mail className="w-3.5 h-3.5"/> Email</label>
              <Input type="email" className="h-9 rounded-md text-sm border-zinc-200 bg-white focus:ring-1 focus:ring-zinc-900" value={newCustForm.email || ''} onChange={(e) => setNewCustForm({...newCustForm, email: e.target.value})} />
            </div>
            <div className="space-y-1.5 col-span-1 sm:col-span-2">
              <label className="text-sm font-medium text-zinc-700">Address</label>
              <Input className="h-9 rounded-md text-sm border-zinc-200 bg-white focus:ring-1 focus:ring-zinc-900" value={newCustForm.address || ''} onChange={(e) => setNewCustForm({...newCustForm, address: e.target.value})} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-zinc-700">City</label>
              <Input className="h-9 rounded-md text-sm border-zinc-200 bg-white focus:ring-1 focus:ring-zinc-900" value={newCustForm.city} onChange={(e) => setNewCustForm({...newCustForm, city: e.target.value})} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-zinc-700">PAN Number</label>
              <Input className="h-9 rounded-md text-sm border-zinc-200 bg-white focus:ring-1 focus:ring-zinc-900 uppercase" value={newCustForm.pan_no || ''} onChange={(e) => setNewCustForm({...newCustForm, pan_no: e.target.value})} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-zinc-700 flex items-center gap-1"><Calendar className="w-3.5 h-3.5"/> D.O.B</label>
              <Input type="date" className="h-9 rounded-md text-sm text-zinc-700 border-zinc-200 bg-white focus:ring-1 focus:ring-zinc-900" value={newCustForm.birth_date} onChange={(e) => setNewCustForm({...newCustForm, birth_date: e.target.value})} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-zinc-700 flex items-center gap-1"><Calendar className="w-3.5 h-3.5"/> Anniversary</label>
              <Input type="date" className="h-9 rounded-md text-sm text-zinc-700 border-zinc-200 bg-white focus:ring-1 focus:ring-zinc-900" value={newCustForm.anniversary_date} onChange={(e) => setNewCustForm({...newCustForm, anniversary_date: e.target.value})} />
            </div>
          </div>
          <DialogFooter className="bg-white p-4 border-t border-zinc-200 flex flex-col sm:flex-row gap-3 shrink-0">
            <Button variant="outline" className="w-full sm:flex-1 h-9 rounded-md text-sm font-medium text-zinc-700 border-zinc-200 bg-white hover:bg-zinc-50" onClick={() => setIsAddModalOpen(false)}>Cancel</Button>
            <Button disabled={isSubmitting || !newCustForm.full_name || !newCustForm.phone} className="w-full sm:flex-[2] h-9 rounded-md text-sm font-medium bg-zinc-900 hover:bg-zinc-800 text-white shadow-sm" onClick={handleAddCustomer}>
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : 'Save Profile'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* KITTY REGISTRATION MODAL */}
      <Dialog open={isAddKittyModalOpen} onOpenChange={setIsAddKittyModalOpen}>
        <DialogContent className={cn(DIALOG_CONTENT_CLASS, "sm:max-w-[500px]")}>
          <DialogHeader className="bg-white p-5 border-b border-zinc-200 shrink-0">
            <DialogTitle className="text-base font-semibold flex items-center gap-2 text-zinc-900">
              <Gem className="w-4 h-4 text-zinc-500" /> Start Harvesting Plan
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-5 overflow-y-auto custom-scrollbar bg-zinc-50 flex-1">
            
            {selectedCustomer && newKittyForm.phone === selectedCustomer.phone ? (
              <div className="col-span-1 sm:col-span-2 bg-white border border-zinc-200 rounded-lg p-4 flex items-center justify-between shadow-sm">
                <div>
                  <p className="text-sm font-medium text-zinc-900">{newKittyForm.full_name}</p>
                  <div className="flex items-center gap-2 mt-0.5 text-xs text-zinc-500">
                    <span className="font-mono">{newKittyForm.phone}</span>
                  </div>
                </div>
                <Badge variant="outline" className="bg-zinc-100 text-zinc-700 border-zinc-200 px-2 py-0.5 rounded text-xs font-medium">
                  Existing Profile
                </Badge>
              </div>
            ) : (
              <>
                <div className="space-y-1.5 col-span-1 sm:col-span-2">
                  <label className="text-sm font-medium text-zinc-700">Full Name <span className="text-red-500">*</span></label>
                  <Input className="h-9 rounded-md text-sm border-zinc-200 bg-white" value={newKittyForm.full_name} onChange={(e) => setNewKittyForm({...newKittyForm, full_name: e.target.value})} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-zinc-700">Phone <span className="text-red-500">*</span></label>
                  <Input className="h-9 rounded-md text-sm font-mono border-zinc-200 bg-white" value={newKittyForm.phone} onChange={(e) => setNewKittyForm({...newKittyForm, phone: e.target.value})} />
                </div>
              </>
            )}

            <div className="col-span-1 sm:col-span-2 bg-white p-4 rounded-lg border border-zinc-200 space-y-4 shadow-sm mt-2">
               <label className="text-sm font-medium text-zinc-900 flex items-center gap-2 border-b border-zinc-100 pb-2">
                 <Database className="w-4 h-4 text-zinc-400" /> Scheme Parameters
               </label>
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                 <div className="space-y-1.5">
                   <label className="text-sm font-medium text-zinc-700">Plan Tier (₹)</label>
                   <Select value={newKittyForm.config_id} onValueChange={(val) => setNewKittyForm({...newKittyForm, config_id: val})}>
                      <SelectTrigger className="h-9 bg-white border-zinc-200 text-sm rounded-md focus:ring-1 focus:ring-zinc-900">
                        <SelectValue placeholder="Select Plan" />
                      </SelectTrigger>
                      <SelectContent className="rounded-md border-zinc-200 shadow-md">
                        {kittyConfigs.map(c => (
                          <SelectItem key={c.id} value={c.id} className="text-sm py-2 rounded-sm cursor-pointer">
                            ₹ {c.monthly_amount.toLocaleString()} / mo ({c.duration_months} Mths)
                          </SelectItem>
                        ))}
                      </SelectContent>
                   </Select>
                 </div>
                 <div className="space-y-1.5">
                   <label className="text-sm font-medium text-zinc-700 flex items-center gap-1"><Calendar className="w-3 h-3"/> Enrollment Date</label>
                   <Input type="date" className="h-9 text-sm text-zinc-700 bg-white border-zinc-200 rounded-md focus:ring-1 focus:ring-zinc-900" value={newKittyForm.start_date} onChange={(e) => setNewKittyForm({...newKittyForm, start_date: e.target.value})} />
                 </div>
               </div>
            </div>
          </div>
          <DialogFooter className="bg-white p-4 border-t border-zinc-200 flex flex-col sm:flex-row gap-3 shrink-0">
            <Button variant="outline" className="w-full sm:flex-1 h-9 rounded-md text-sm font-medium text-zinc-700 border-zinc-200 bg-white hover:bg-zinc-50" onClick={() => setIsAddKittyModalOpen(false)}>Cancel</Button>
            <Button disabled={isSubmitting || !newKittyForm.full_name || !newKittyForm.phone} className="w-full sm:flex-[2] h-9 rounded-md text-sm font-medium bg-zinc-900 hover:bg-zinc-800 text-white shadow-sm" onClick={handleAddKittyMember}>
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : 'Confirm Enrollment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ✨ PURCHASE HISTORY MODAL */}
      <Dialog open={isHistoryModalOpen} onOpenChange={setIsHistoryModalOpen}>
        <DialogContent className={cn(DIALOG_CONTENT_CLASS, "sm:max-w-[450px]")}>
          <DialogHeader className="bg-white p-5 border-b border-zinc-200 shrink-0">
            <DialogTitle className="text-base font-semibold text-zinc-900 flex items-center gap-2">
              <History className="w-4 h-4 text-zinc-500" /> Purchase & Activity History
            </DialogTitle>
          </DialogHeader>

          <div className="p-5 overflow-y-auto custom-scrollbar bg-zinc-50 flex-1">
            {isHistoryLoading ? (
              <div className="flex justify-center items-center py-10">
                <Loader2 className="w-5 h-5 animate-spin text-zinc-400" />
              </div>
            ) : purchaseActivity.length === 0 ? (
              <div className="text-center py-10 text-zinc-500 text-sm">
                No previous purchase or order history found.
              </div>
            ) : (
              <div className="space-y-3 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px before:h-full before:w-px before:bg-zinc-200">
                {purchaseActivity.map((item: any, idx: number) => (
                  <div key={idx} className="relative flex items-start gap-4">
                    <div className="flex items-center justify-center w-10 h-10 rounded-full border border-zinc-200 bg-white shadow-sm shrink-0 z-10">
                      {item.type === 'Invoice' && <IndianRupee className="w-4 h-4 text-zinc-600" />}
                      {item.type === 'Custom Order' && <Hammer className="w-4 h-4 text-zinc-600" />}
                      {item.type === 'Repair' && <Wrench className="w-4 h-4 text-zinc-600" />}
                      {item.type === 'Estimate' && <FileText className="w-4 h-4 text-zinc-600" />}
                    </div>
                    <div className="flex-1 p-3 rounded-lg border border-zinc-200 bg-white shadow-sm mt-1">
                      <div className="flex items-center justify-between mb-1">
                        <div className="font-medium text-zinc-900 text-sm">{item.type}</div>
                        <time className="text-xs text-zinc-500">{new Date(item.date).toLocaleDateString('en-IN')}</time>
                      </div>
                      <div className="text-[11px] text-zinc-400 mb-2 font-mono uppercase tracking-widest">Ref: {item.ref}</div>
                      
                      {item.amt > 0 && (
                        <div className="text-sm font-medium text-zinc-900 border-t border-zinc-100 pt-2">
                          ₹ {Number(item.amt || 0).toLocaleString()}
                        </div>
                      )}

                      {item.notes && (
                        <div className="text-xs font-medium text-zinc-700 bg-zinc-50 border border-zinc-100 p-2.5 rounded-md mt-2 leading-relaxed">
                          "{item.notes}"
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          <DialogFooter className="bg-white p-4 border-t border-zinc-200 shrink-0">
            <Button variant="outline" className="w-full h-9 rounded-md text-sm font-medium text-zinc-700 bg-white hover:bg-zinc-50 border-zinc-200" onClick={() => setIsHistoryModalOpen(false)}>
              Close Timeline
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ✨ WHATSAPP ACTIVITY MODAL (Now using Vertical Timeline UI) */}
      <Dialog open={isWaActivityModalOpen} onOpenChange={setIsWaActivityModalOpen}>
        <DialogContent className={cn(DIALOG_CONTENT_CLASS, "sm:max-w-[450px]")}>
          <DialogHeader className="bg-white p-5 border-b border-zinc-200 shrink-0">
            <DialogTitle className="text-base font-semibold flex items-center gap-2 text-zinc-900">
              <MessageCircle className="w-5 h-5 text-[#25D366]" /> WhatsApp Activity
            </DialogTitle>
            <DialogDescription className="text-sm text-zinc-500 mt-1">
              Conversation timeline for {selectedCustomer?.full_name}
            </DialogDescription>
          </DialogHeader>

          <div className="p-5 overflow-y-auto custom-scrollbar bg-zinc-50 flex-1 max-h-[60vh]">
            {isHistoryLoading ? (
              <div className="flex justify-center items-center py-10">
                <Loader2 className="w-5 h-5 animate-spin text-zinc-400" />
              </div>
            ) : waActivity.length === 0 ? (
              <div className="text-center py-10 text-zinc-500 text-sm">
                No WhatsApp activity found for this customer.
              </div>
            ) : (
              <div className="space-y-3 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px before:h-full before:w-px before:bg-zinc-200">
                {waActivity.map((item: any, idx: number) => (
                  <div key={idx} className="relative flex items-start gap-4">
                    <div className="flex items-center justify-center w-10 h-10 rounded-full border border-zinc-200 bg-white shadow-sm shrink-0 z-10">
                      <MessageCircle className="w-5 h-5 text-[#25D366]" />
                    </div>
                    <div className="flex-1 p-3 rounded-lg border border-zinc-200 bg-white shadow-sm mt-1">
                      <div className="flex items-center justify-between mb-1">
                        <div className="font-semibold text-sm text-[#25D366]">
                          {item.ref || 'Inbound Msg'}
                        </div>
                        <time className="text-xs text-zinc-500">
                          {new Date(item.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </time>
                      </div>
                      
                      {item.notes && (
                        <div className="text-[11px] font-medium text-zinc-700 bg-zinc-50 border border-zinc-100 p-2.5 rounded-md mt-2 leading-relaxed whitespace-pre-wrap">
                          {item.notes}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter className="bg-white p-4 border-t border-zinc-200 shrink-0">
            <Button variant="outline" className="w-full h-9 rounded-md text-sm font-medium text-zinc-700 bg-white hover:bg-zinc-50 border-zinc-200" onClick={() => setIsWaActivityModalOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CALL LOGGER MODAL */}
      <Dialog open={isCallModalOpen} onOpenChange={setIsCallModalOpen}>
        <DialogContent className={cn(DIALOG_CONTENT_CLASS, "sm:max-w-[450px]")}>
          <DialogHeader className="bg-white p-5 border-b border-zinc-200 shrink-0">
            <DialogTitle className="text-base font-semibold text-zinc-900 flex items-center gap-2">
              <Phone className="w-4 h-4 text-zinc-500" /> Log Call Outcome
            </DialogTitle>
            <DialogDescription className="text-sm text-zinc-500 mt-1">For {selectedCustomer?.full_name}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 p-5 bg-zinc-50 overflow-y-auto custom-scrollbar flex-1">
            
            {/* NEW: USER / CALLER SELECTOR */}
            <div className="space-y-1.5 animate-in fade-in slide-in-from-top-1">
              <label className="text-sm font-medium text-zinc-700">Logged By (Caller) <span className="text-red-500">*</span></label>
              <Select value={callForm.caller_profile_id || ''} onValueChange={(val) => setCallForm({ ...callForm, caller_profile_id: val })}>
                <SelectTrigger className="h-9 rounded-md text-sm bg-white border-zinc-200 focus:ring-1 focus:ring-zinc-900">
                  <SelectValue placeholder="Select user..." />
                </SelectTrigger>
                <SelectContent className="rounded-md border-zinc-200 shadow-md">
                  {/* Ensure profilesList is fetched in your parent component containing { id, full_name, role } */}
                  {profilesList?.map((profile: any) => (
                    <SelectItem key={profile.id} value={profile.id} className="text-sm">
                      {profile.full_name} <span className="text-zinc-400 capitalize">({profile.role?.replace('_', ' ')})</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5 animate-in fade-in slide-in-from-top-1 delay-75">
              <label className="text-sm font-medium text-zinc-700">Call Outcome <span className="text-red-500">*</span></label>
              <Select value={callForm.outcome} onValueChange={(val) => setCallForm({ ...callForm, outcome: val, interest_level: undefined })}>
                <SelectTrigger className="h-9 rounded-md text-sm bg-white border-zinc-200 focus:ring-1 focus:ring-zinc-900">
                  <SelectValue placeholder="Select outcome..." />
                </SelectTrigger>
                <SelectContent className="rounded-md border-zinc-200 shadow-md">
                  <SelectItem value="Connected / Spoke to Customer" className="text-sm">Connected / Spoke to Customer</SelectItem>
                  <SelectItem value="Ringing / No Answer" className="text-sm">Ringing / No Answer</SelectItem>
                  <SelectItem value="Switched Off" className="text-sm">Switched Off</SelectItem>
                  <SelectItem value="Out of Service / Not Reachable" className="text-sm">Out of Service / Not Reachable</SelectItem>
                  <SelectItem value="Wrong Number" className="text-sm">Wrong Number</SelectItem>
                  <SelectItem value="Busy / Call Waiting" className="text-sm">Busy / Call Waiting</SelectItem>
                  <SelectItem value="Call After Some Time" className="text-sm">Call After Some Time</SelectItem>
                  <Separator className="bg-zinc-100 my-1"/>
                  <SelectItem value="Not Interested (Do Not Disturb)" className="text-sm text-red-600 focus:bg-red-50">
                    Not Interested (Do Not Disturb)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* ✨ UPDATED: CONDITIONAL INTEREST LEVEL DROPDOWN */}
            {['Connected / Spoke to Customer', 'Not Interested (Do Not Disturb)', 'Wrong Number'].includes(callForm.outcome) && (
              <div className="space-y-1.5 animate-in fade-in slide-in-from-top-1">
                <label className="text-sm font-medium text-zinc-700">Customer Interest Level <span className="text-red-500">*</span></label>
                <Select value={callForm.interest_level || ''} onValueChange={(val) => setCallForm({ ...callForm, interest_level: val })}>
                  <SelectTrigger className="h-9 rounded-md text-sm bg-white border-zinc-200 focus:ring-1 focus:ring-zinc-900">
                    <SelectValue placeholder="Select level..." />
                  </SelectTrigger>
                  <SelectContent className="rounded-md border-zinc-200 shadow-md">
                    <SelectItem value="High" className="text-sm font-medium text-emerald-700 focus:bg-emerald-50">High Interest</SelectItem>
                    <SelectItem value="Moderate" className="text-sm font-medium text-blue-700 focus:bg-blue-50">Moderate Interest</SelectItem>
                    <SelectItem value="Not Interested" className="text-sm font-medium text-red-700 focus:bg-red-50">Not Interested</SelectItem>
                    <SelectItem value="Already Claimed Voucher" className="text-sm font-medium text-purple-700 focus:bg-purple-50">Already Claimed Voucher</SelectItem>
                    <SelectItem value="Other" className="text-sm font-medium text-zinc-700">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-1.5 animate-in fade-in slide-in-from-top-1 delay-150">
              <label className="text-sm font-medium text-zinc-700">Interaction Notes <span className="text-red-500">*</span></label>
              <textarea
                placeholder="Details of the interaction..."
                className="w-full min-h-[100px] p-3 text-sm bg-white border border-zinc-200 rounded-md focus:ring-1 focus:ring-zinc-900 outline-none resize-none transition-all shadow-sm"
                value={callForm.notes}
                onChange={(e) => setCallForm({ ...callForm, notes: e.target.value })}
              />
            </div>

            {callForm.outcome !== 'Not Interested (Do Not Disturb)' && (
              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-zinc-200 animate-in fade-in slide-in-from-top-1 delay-200">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-zinc-700">Next Call Date</label>
                  <Input type="date" className="h-9 rounded-md text-sm bg-white border-zinc-200 focus:ring-1 focus:ring-zinc-900" value={callForm.next_call_date} onChange={(e) => setCallForm({ ...callForm, next_call_date: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-zinc-700">Next Call Time</label>
                  <Input type="time" className="h-9 rounded-md text-sm bg-white border-zinc-200 focus:ring-1 focus:ring-zinc-900" value={callForm.next_call_time} onChange={(e) => setCallForm({ ...callForm, next_call_time: e.target.value })} />
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="bg-white p-4 border-t border-zinc-200 flex flex-col sm:flex-row gap-3 shrink-0">
            <Button variant="outline" className="w-full sm:flex-1 h-9 rounded-md text-sm font-medium text-zinc-700 bg-white hover:bg-zinc-50 border-zinc-200 shadow-sm" onClick={() => setIsCallModalOpen(false)}>Cancel</Button>
            <Button 
              disabled={
                isSubmitting ||
                !callForm.caller_profile_id || 
                !callForm.outcome || 
                !callForm.notes.trim() || 
                // ✨ UPDATED: Validates interest level only if those 3 outcomes are selected
                (['Connected / Spoke to Customer', 'Not Interested (Do Not Disturb)', 'Wrong Number'].includes(callForm.outcome) && !callForm.interest_level)
              } 
              className="w-full sm:flex-[2] h-9 rounded-md text-sm font-medium bg-zinc-900 hover:bg-zinc-800 text-white shadow-sm" 
              onClick={handleLogCall}
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : 'Save Call Log'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      {/* SCHEDULE / AUTOMATION CONTROL MODAL */}
      <Dialog open={isFollowupModalOpen} onOpenChange={setIsFollowupModalOpen}>
        <DialogContent className={cn(DIALOG_CONTENT_CLASS, "sm:max-w-[400px]")}>
          <DialogHeader className="bg-white p-5 border-b border-zinc-200 shrink-0">
            <DialogTitle className="text-base font-semibold text-zinc-900 flex items-center gap-2">
              {activeSequence ? <Settings2 className="w-4 h-4 text-zinc-500" /> : <Calendar className="w-4 h-4 text-zinc-500" />}
              {activeSequence ? 'Manage Automation' : 'Schedule Follow-up'}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 p-5 bg-zinc-50 overflow-y-auto custom-scrollbar flex-1">
            {activeSequence ? (
              <div className="space-y-4">
                <div className="bg-white border border-zinc-200 rounded-lg p-3 shadow-sm">
                  <p className="text-xs text-zinc-500 mb-1">Active Voucher Flow</p>
                  <p className="font-mono text-sm font-semibold text-zinc-900">{activeSequence.voucher_code}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-zinc-700">Status</label>
                    <Select value={sequenceForm.status} onValueChange={(val) => setSequenceForm({ ...sequenceForm, status: val })}>
                      <SelectTrigger className="h-9 text-sm bg-white border-zinc-200 rounded-md focus:ring-1 focus:ring-zinc-900">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-md border-zinc-200 shadow-md">
                        <SelectItem value="active" className="text-sm">Active</SelectItem>
                        <SelectItem value="paused" className="text-sm">Paused</SelectItem>
                        <SelectItem value="completed" className="text-sm">Completed</SelectItem>
                        <SelectItem value="cancelled" className="text-sm">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-zinc-700">Wait Interval (Hrs)</label>
                    <Input 
                      type="number" 
                      className="h-9 text-sm bg-white border-zinc-200 rounded-md focus:ring-1 focus:ring-zinc-900" 
                      value={sequenceForm.interval_hours} 
                      onChange={(e) => setSequenceForm({ ...sequenceForm, interval_hours: Number(e.target.value) })} 
                    />
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-zinc-700">Reason</label>
                  <Input 
                    className="h-9 rounded-md text-sm bg-white border-zinc-200 focus:ring-1 focus:ring-zinc-900 px-3 shadow-sm" 
                    placeholder="E.g. Wants to buy a bridal set" 
                    value={followupReason} onChange={(e) => setFollowupReason(e.target.value)} 
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-zinc-700">Next Action Date</label>
                  <Input type="date" className="h-9 rounded-md text-sm bg-white border-zinc-200 focus:ring-1 focus:ring-zinc-900 px-3 shadow-sm" value={followupDate} onChange={(e) => setFollowupDate(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-zinc-700">Notes (Optional)</label>
                  <textarea 
                    className="w-full min-h-[80px] p-3 text-sm bg-white border border-zinc-200 rounded-md focus:ring-1 focus:ring-zinc-900 outline-none resize-none shadow-sm transition-all"
                    placeholder="Previous context..." 
                    value={interactionNotes} onChange={(e) => setInteractionNotes(e.target.value)} 
                  />
                </div>
              </>
            )}
          </div>
          <DialogFooter className="bg-white p-4 border-t border-zinc-200 flex flex-col sm:flex-row gap-3 shrink-0">
            <Button variant="outline" className="w-full sm:flex-1 h-9 rounded-md text-sm font-medium text-zinc-700 hover:bg-zinc-50 border-zinc-200 shadow-sm" onClick={() => setIsFollowupModalOpen(false)}>Cancel</Button>
            {activeSequence ? (
              <Button disabled={isUpdatingSequence} className="w-full sm:flex-[2] h-9 rounded-md text-sm font-medium bg-zinc-900 hover:bg-zinc-800 text-white shadow-sm" onClick={handleUpdateSequence}>
                {isUpdatingSequence ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : 'Save Sequence'}
              </Button>
            ) : (
              <Button disabled={isSubmitting} className="w-full sm:flex-[2] h-9 rounded-md text-sm font-medium bg-zinc-900 hover:bg-zinc-800 text-white shadow-sm" onClick={handleUpdateFollowup}>
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : 'Save Schedule'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* WHATSAPP MESSAGE SENDER MODAL */}
      <Dialog open={isWhatsAppModalOpen} onOpenChange={setIsWhatsAppModalOpen}>
        <DialogContent className={cn(DIALOG_CONTENT_CLASS, "sm:max-w-[450px]")}>
          <DialogHeader className="bg-white p-5 border-b border-zinc-200 shrink-0">
            <DialogTitle className="text-base font-semibold flex items-center gap-2 text-zinc-900">
              <MessageCircle className="w-4 h-4 text-zinc-500" /> WhatsApp Message
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 p-5 bg-zinc-50 overflow-y-auto custom-scrollbar flex-1">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-zinc-700 flex justify-between">
                <span>Select Template</span>
                {activeAiFilter !== 'none' && <span className="text-xs text-zinc-500">(Auto-Selected)</span>}
              </label>
              <Select value={waTemplateId} onValueChange={handleTemplateChange}>
                <SelectTrigger className="h-9 rounded-md text-sm bg-white border-zinc-200 focus:ring-1 focus:ring-zinc-900 shadow-sm">
                  <SelectValue placeholder="Choose a template" />
                </SelectTrigger>
                <SelectContent className="rounded-md shadow-md border-zinc-200">
                  {availableTemplates.length === 0 ? (
                    <SelectItem value="none" disabled className="text-sm italic">No templates configured.</SelectItem>
                  ) : (
                    availableTemplates.map(t => (
                      <SelectItem key={t.template_id} value={t.template_id} className="text-sm py-2 rounded-sm cursor-pointer">{t.label}</SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-zinc-700 flex justify-between">
                <span>Customize Message</span>
                <span className="text-xs text-zinc-400">Editable</span>
              </label>
              <textarea 
                className="w-full min-h-[150px] p-3 text-sm bg-white border border-zinc-200 rounded-md focus:ring-1 focus:ring-zinc-900 outline-none shadow-sm resize-none leading-relaxed transition-all"
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter className="bg-white p-4 border-t border-zinc-200 flex flex-col sm:flex-row gap-3 shrink-0">
            <Button variant="outline" className="w-full sm:flex-1 h-9 rounded-md text-sm font-medium text-zinc-700 hover:bg-zinc-50 border-zinc-200 shadow-sm" onClick={() => setIsWhatsAppModalOpen(false)}>Cancel</Button>
            <Button className="w-full sm:flex-[2] h-9 rounded-md text-sm font-medium bg-zinc-900 hover:bg-zinc-800 text-white shadow-sm" onClick={handleSendWhatsApp}>
              <MessageCircle className="w-4 h-4 mr-2" /> Send Message
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}