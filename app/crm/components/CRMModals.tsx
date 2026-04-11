import React from 'react'
import { format } from "date-fns"
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
  UserPlus, Building2, MapPin, Calendar, MessageCircle, Wallet, Gift, Users
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { CRMCustomer, Warehouse } from '../types'

interface CRMModalsProps {
  isImportModalOpen: boolean; setIsImportModalOpen: (v: boolean) => void;
  isPreviewModalOpen: boolean; setIsPreviewModalOpen: (v: boolean) => void;
  isProfileModalOpen: boolean; setIsProfileModalOpen: (v: boolean) => void;
  isLoyaltyModalOpen: boolean; setIsLoyaltyModalOpen: (v: boolean) => void;
  isAddModalOpen: boolean; setIsAddModalOpen: (v: boolean) => void;
  isAddKittyModalOpen: boolean; setIsAddKittyModalOpen: (v: boolean) => void;
  isFollowupModalOpen: boolean; setIsFollowupModalOpen: (v: boolean) => void;
  isWhatsAppModalOpen: boolean; setIsWhatsAppModalOpen: (v: boolean) => void;

  importFile: File | null; setImportFile: (f: File | null) => void;
  previewData: any[]; 
  selectedCustomer: CRMCustomer | null;
  selectedLocation: string;
  warehouses: Warehouse[];
  activeAiFilter: string;
  dynamicTemplates: any[]; 
  customers: CRMCustomer[]; // Passed to populate referral dropdown
  
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
  handleRecordKittyPayment: (c: CRMCustomer) => void;
  handleUpdateFollowup: () => void;
  handleTemplateChange: (id: string) => void;
  handleSendWhatsApp: () => void;
  openWhatsAppModal: (c: CRMCustomer, templateId?: string) => void;
}

export function CRMModals(props: CRMModalsProps) {
  const {
    isImportModalOpen, setIsImportModalOpen, isPreviewModalOpen, setIsPreviewModalOpen,
    isProfileModalOpen, setIsProfileModalOpen, isLoyaltyModalOpen, setIsLoyaltyModalOpen,
    isAddModalOpen, setIsAddModalOpen, isAddKittyModalOpen, setIsAddKittyModalOpen,
    isFollowupModalOpen, setIsFollowupModalOpen, isWhatsAppModalOpen, setIsWhatsAppModalOpen,
    importFile, setImportFile, previewData, selectedCustomer, selectedLocation, warehouses, activeAiFilter, dynamicTemplates, customers,
    newCustForm, setNewCustForm, newKittyForm, setNewKittyForm, loyaltyForm, setLoyaltyForm,
    waTemplateId, customMessage, setCustomMessage, followupReason, setFollowupReason, followupDate, setFollowupDate,
    interactionNotes, setInteractionNotes, isImporting, isSubmitting,
    handleDownloadSample, handleParseFile, removePreviewRow, updatePreviewRow, handleCommitImport,
    handleAddCustomer, handleAddKittyMember, handleUpdateLoyalty, handleRecordKittyPayment,
    handleUpdateFollowup, handleTemplateChange, handleSendWhatsApp, openWhatsAppModal
  } = props;

  const getCustomerCategory = () => {
    if (!selectedCustomer) return 'Lead'
    if (selectedCustomer.customer_status === 'Purchased') return 'Purchased'
    if (selectedCustomer.customer_status === 'Kitty Member' || selectedCustomer.kitty_plan_name) return 'Kitty'
    return 'Lead'
  }

  const currentCategory = getCustomerCategory()
  const availableTemplates = dynamicTemplates.filter(t => t.category === currentCategory)

  // Auto-calculate 5% B2P Referral
  const handleBilledAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const billed = e.target.value;
    const bonus = Number(billed) * 0.05;
    setLoyaltyForm({ ...loyaltyForm, billedAmount: billed, amount: bonus.toString() });
  };

  return (
    <>
      {/* 0. IMPORT CSV MODAL */}
      <Dialog open={isImportModalOpen} onOpenChange={setIsImportModalOpen}>
        <DialogContent className="sm:max-w-[450px] border-slate-200 rounded-xl bg-white shadow-2xl p-0 overflow-hidden">
          <DialogHeader className="bg-emerald-50 p-5 border-b border-emerald-100">
            <DialogTitle className="text-base font-bold flex items-center gap-2 text-emerald-800">
              <UploadCloud className="w-4 h-4" /> Bulk Import Customers
            </DialogTitle>
            <DialogDescription className="text-xs text-emerald-600/80 mt-1">
              Upload a `.csv` file to instantly populate your CRM database.
            </DialogDescription>
          </DialogHeader>

          <div className="p-6 space-y-6">
            <div className="bg-emerald-50/50 border border-emerald-100 p-4 rounded-lg flex flex-col sm:flex-row gap-3 items-center justify-between text-sm">
              <div className="flex flex-col">
                <span className="font-bold text-slate-700 text-xs">Need the exact format?</span>
                <span className="text-[10px] text-slate-500">Download the required template.</span>
              </div>
              <Button variant="outline" size="sm" onClick={handleDownloadSample} className="h-8 border-emerald-200 text-emerald-700 bg-white hover:bg-emerald-50 shrink-0">
                <Download className="w-3.5 h-3.5 mr-1.5" /> Sample CSV
              </Button>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Select File (.CSV)</label>
              <label className={`
                flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-xl cursor-pointer transition-colors
                ${importFile ? 'border-emerald-300 bg-emerald-50/50' : 'border-slate-300 hover:bg-slate-50 bg-white'}
              `}>
                <div className="flex flex-col items-center justify-center pt-5 pb-6 text-center px-4">
                  {isImporting ? (
                     <Loader2 className="w-8 h-8 text-emerald-500 animate-spin mb-2" />
                  ) : importFile ? (
                     <FileSpreadsheet className="w-8 h-8 text-emerald-500 mb-2" />
                  ) : (
                     <UploadCloud className="w-8 h-8 text-slate-400 mb-2" />
                  )}
                  <p className="text-sm font-semibold text-slate-700 truncate w-full">{importFile ? importFile.name : "Click or drag file here"}</p>
                </div>
                <input type="file" accept=".csv" className="hidden" onChange={(e) => setImportFile(e.target.files?.[0] || null)} />
              </label>
            </div>
            <p className="text-[10px] text-slate-400 leading-relaxed">
              * The system uses Phone Numbers to prevent duplicates. Existing profiles will be securely updated if they share the same number.
            </p>
          </div>

          <DialogFooter className="bg-slate-50 p-4 border-t border-slate-100 flex-row gap-3">
            <Button variant="outline" className="flex-1 h-10 text-xs font-semibold rounded-lg border-slate-300 text-slate-700 bg-white hover:bg-slate-50" onClick={() => setIsImportModalOpen(false)}>Cancel</Button>
            <Button disabled={isImporting || !importFile} className="flex-[2] h-10 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm" onClick={handleParseFile}>
              {isImporting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Review Data'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 0.5 IMPORT PREVIEW MODAL */}
      <Dialog open={isPreviewModalOpen} onOpenChange={setIsPreviewModalOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-[90vw] h-[90vh] flex flex-col border-slate-200 rounded-xl bg-slate-50 shadow-2xl p-0 overflow-hidden">
          <DialogHeader className="bg-emerald-50 p-5 border-b border-emerald-100 shrink-0">
            <div className="flex justify-between items-center">
              <div>
                <DialogTitle className="text-base font-bold flex items-center gap-2 text-emerald-800">
                  <Database className="w-5 h-5" /> Import Staging Area
                </DialogTitle>
                <DialogDescription className="text-xs text-emerald-600/80 mt-1">
                  Review and edit the {previewData.length} records parsed from your CSV before committing them to the database.
                </DialogDescription>
              </div>
              <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100 font-mono">
                {previewData.length} Valid Rows
              </Badge>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-auto bg-white custom-scrollbar p-2">
            <Table className="w-max min-w-full">
              <TableHeader className="bg-slate-50 sticky top-0 z-10 shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
                <TableRow>
                  <TableHead className="w-10"></TableHead>
                  <TableHead className="text-[10px] font-bold uppercase w-[150px]">Full Name</TableHead>
                  <TableHead className="text-[10px] font-bold uppercase w-[120px]">Phone</TableHead>
                  <TableHead className="text-[10px] font-bold uppercase w-[130px]">Status</TableHead>
                  <TableHead className="text-[10px] font-bold uppercase w-[120px]">City</TableHead>
                  <TableHead className="text-[10px] font-bold uppercase w-[100px]">Credit(₹)</TableHead>
                  <TableHead className="text-[10px] font-bold uppercase w-[120px] text-purple-600 bg-purple-50/50">Kitty Status</TableHead>
                  <TableHead className="text-[10px] font-bold uppercase w-[100px] text-purple-600 bg-purple-50/50">Mths Paid</TableHead>
                  <TableHead className="text-[10px] font-bold uppercase w-[100px] text-purple-600 bg-purple-50/50">Inst. (₹)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {previewData.map((row, index) => (
                  <TableRow key={row._id} className="group">
                    <TableCell className="p-1 text-center">
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-400 hover:text-red-500" onClick={() => removePreviewRow(index)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </TableCell>
                    <TableCell className="p-1">
                      <Input className="h-8 text-xs border-transparent hover:border-slate-200 focus-visible:ring-emerald-500 rounded px-2" value={row.full_name} onChange={(e) => updatePreviewRow(index, 'full_name', e.target.value)} />
                    </TableCell>
                    <TableCell className="p-1">
                      <Input className="h-8 text-xs font-mono border-transparent hover:border-slate-200 focus-visible:ring-emerald-500 rounded px-2" value={row.phone} onChange={(e) => updatePreviewRow(index, 'phone', e.target.value.replace(/\D/g, ''))} />
                    </TableCell>
                    <TableCell className="p-1">
                      <Select value={row.customer_status} onValueChange={(val) => updatePreviewRow(index, 'customer_status', val)}>
                        <SelectTrigger className="h-8 text-xs border-transparent hover:border-slate-200 bg-transparent focus:ring-emerald-500 shadow-none">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Lead" className="text-xs">Lead</SelectItem>
                          <SelectItem value="Purchased" className="text-xs">Purchased</SelectItem>
                          <SelectItem value="Kitty Member" className="text-xs text-purple-600 font-bold">Kitty Member</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="p-1">
                      <Input className="h-8 text-xs border-transparent hover:border-slate-200 focus-visible:ring-emerald-500 rounded px-2" value={row.city} onChange={(e) => updatePreviewRow(index, 'city', e.target.value)} />
                    </TableCell>
                    <TableCell className="p-1">
                      <Input type="number" className="h-8 text-xs font-mono border-transparent hover:border-slate-200 focus-visible:ring-emerald-500 rounded px-2 text-emerald-700 bg-emerald-50/30" value={row.store_credit_balance} onChange={(e) => updatePreviewRow(index, 'store_credit_balance', e.target.value)} />
                    </TableCell>
                    <TableCell className="p-1 bg-purple-50/30">
                      <Select value={row.kitty_plan_status} onValueChange={(val) => updatePreviewRow(index, 'kitty_plan_status', val)}>
                        <SelectTrigger className="h-8 text-xs border-transparent hover:border-purple-200 bg-transparent focus:ring-purple-500 shadow-none text-purple-700 font-semibold">
                          <SelectValue placeholder="None" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value=" " className="text-xs text-slate-400">None</SelectItem>
                          <SelectItem value="Active" className="text-xs text-purple-600 font-bold">Active</SelectItem>
                          <SelectItem value="Inactive" className="text-xs text-slate-500">Inactive</SelectItem>
                          <SelectItem value="Matured" className="text-xs text-emerald-600 font-bold">Matured</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="p-1 bg-purple-50/30">
                      <Input type="number" className="h-8 text-xs font-mono border-transparent hover:border-purple-200 focus-visible:ring-purple-500 rounded px-2 text-purple-700" value={row.kitty_months_paid} onChange={(e) => updatePreviewRow(index, 'kitty_months_paid', e.target.value)} />
                    </TableCell>
                    <TableCell className="p-1 bg-purple-50/30">
                      <Input type="number" className="h-8 text-xs font-mono border-transparent hover:border-purple-200 focus-visible:ring-purple-500 rounded px-2 text-purple-700" value={row.kitty_installment_amount} onChange={(e) => updatePreviewRow(index, 'kitty_installment_amount', e.target.value)} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <DialogFooter className="bg-emerald-50 p-4 border-t border-emerald-100 flex-row justify-between shrink-0">
            <Button variant="outline" className="h-10 text-xs font-semibold rounded-lg border-emerald-200 text-emerald-800 bg-white hover:bg-emerald-100" onClick={() => setIsPreviewModalOpen(false)}>Cancel & Discard</Button>
            <Button disabled={isSubmitting || previewData.length === 0} className="h-10 px-8 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm" onClick={handleCommitImport}>
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Database className="w-4 h-4 mr-2" />}
              Confirm & Import Database
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 1. CUSTOMER PROFILE MODAL */}
      <Dialog open={isProfileModalOpen} onOpenChange={setIsProfileModalOpen}>
        <DialogContent className="sm:max-w-[700px] border-slate-200 rounded-xl bg-slate-50 shadow-2xl p-0 overflow-hidden">
          {selectedCustomer && (
            <>
              <DialogHeader className="bg-white p-6 border-b border-slate-100">
                <div className="flex items-start justify-between">
                  <div>
                    <DialogTitle className="text-xl font-bold text-slate-900">{selectedCustomer.full_name}</DialogTitle>
                    <div className="flex items-center gap-3 mt-2 text-sm text-slate-500 font-mono">
                      <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5"/> {selectedCustomer.phone}</span>
                      <span className="text-slate-300">|</span>
                      <span className="font-sans">{selectedCustomer.city || 'Unknown City'}</span>
                    </div>
                  </div>
                  <Badge variant="outline" className={cn(
                    "uppercase tracking-widest text-[10px] font-bold px-2.5 py-1 rounded-md",
                    selectedCustomer.customer_status === 'Kitty Member' ? "bg-purple-50 text-purple-700 border-purple-200" :
                    selectedCustomer.customer_status === 'Purchased' ? "bg-emerald-50 text-emerald-700 border-emerald-200" : 
                    "bg-slate-100 text-slate-600 border-slate-200"
                  )}>
                    {selectedCustomer.customer_status || 'Lead'}
                  </Badge>
                </div>
              </DialogHeader>

              <div className="p-6 overflow-y-auto max-h-[70vh] custom-scrollbar space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* --- NEW UNIFIED PAVITRAM WALLET CARD --- */}
                  <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-100 rounded-xl p-5 shadow-sm flex flex-col justify-center relative overflow-hidden group">
                    <div className="flex justify-between items-center mb-2 relative z-10">
                      <h3 className="text-xs font-bold text-emerald-800 uppercase tracking-widest flex items-center gap-1.5">
                        <Wallet className="w-4 h-4" /> Pavitram Credits
                      </h3>
                      <Button 
                        size="icon" variant="ghost" 
                        className="h-7 w-7 text-emerald-600 hover:bg-emerald-100 hover:text-emerald-800 rounded shadow-sm bg-white/50 border border-emerald-200/50" 
                        onClick={() => setIsLoyaltyModalOpen(true)} title="Adjust Credits"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                    <p className="text-4xl font-black text-emerald-600 relative z-10 tracking-tight mt-1">
                      ₹{(selectedCustomer.store_credit_balance || 0).toLocaleString()}
                    </p>
                    {/* Decorative Background Icon */}
                    <Wallet className="absolute -right-4 -bottom-4 w-24 h-24 text-emerald-500 opacity-10 -rotate-12 group-hover:scale-110 transition-transform duration-500" />
                  </div>

                  {/* Context Card */}
                  <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col justify-center space-y-3">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-500 font-medium">Birth Date</span>
                      <span className="font-bold text-slate-800">{selectedCustomer.birth_date ? new Date(selectedCustomer.birth_date).toLocaleDateString() : 'Not Set'}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-500 font-medium">Anniversary</span>
                      <span className="font-bold text-slate-800">{selectedCustomer.anniversary_date ? new Date(selectedCustomer.anniversary_date).toLocaleDateString() : 'Not Set'}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm pt-2 border-t border-slate-100">
                      <span className="text-slate-500 font-medium">Customer Since</span>
                      <span className="font-bold text-slate-800">{new Date(selectedCustomer.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>

                {/* THE DIAMOND KITTY HARVESTING DASHBOARD */}
                <div className="bg-white border border-purple-100 rounded-xl shadow-sm overflow-hidden">
                  <div className="bg-purple-50 border-b border-purple-100 p-4 flex justify-between items-center">
                    <h3 className="text-xs font-bold text-purple-800 uppercase tracking-widest flex items-center gap-1.5">
                      <Gem className="w-4 h-4" /> Harvesting Plan (Diamond Kitty)
                    </h3>
                    <Badge variant="outline" className={cn(
                      "text-[9px] uppercase tracking-wider font-bold", 
                      (selectedCustomer.kitty_plan_status === 'Active' || selectedCustomer.customer_status === 'Kitty Member') ? 'bg-purple-100 text-purple-700 border-purple-200' : 'bg-slate-100 text-slate-500 border-slate-200'
                    )}>
                      {selectedCustomer.kitty_plan_status || (selectedCustomer.customer_status === 'Kitty Member' ? 'Active' : 'Inactive')}
                    </Badge>
                  </div>
                  
                  <div className="p-5 space-y-6">
                    {(selectedCustomer.kitty_plan_status === 'Active' || selectedCustomer.customer_status === 'Kitty Member') ? (
                      <>
                        <div className="flex justify-between items-end">
                          <div>
                            <p className="text-sm font-bold text-slate-900">{selectedCustomer.kitty_plan_name || 'Pavitram Diamond Kitty'}</p>
                            <p className="text-xs text-slate-500 mt-0.5">12 Months Plan + 1 Month Jeweler Bonus</p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs font-bold text-purple-600 uppercase tracking-widest">Months Paid</p>
                            <p className="text-2xl font-black text-purple-700">{selectedCustomer.kitty_months_paid || 0} <span className="text-sm text-purple-400 font-medium">/ 12</span></p>
                          </div>
                        </div>

                        <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                          <div 
                            className="bg-purple-500 h-full rounded-full transition-all duration-500" 
                            style={{ width: `${Math.min(((selectedCustomer.kitty_months_paid || 0) / 12) * 100, 100)}%` }}
                          />
                        </div>

                        <div>
                          <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Installment Tracker</h4>
                          <div className="grid grid-cols-4 md:grid-cols-6 gap-2 sm:gap-3">
                            {Array.from({length: 12}).map((_, i) => {
                              const monthNum = i + 1;
                              const monthsPaid = selectedCustomer.kitty_months_paid || 0;
                              const isPaid = monthNum <= monthsPaid;
                              const isCurrent = monthNum === monthsPaid + 1;

                              return (
                                <div key={i} className={cn(
                                  "rounded-lg border p-2 flex flex-col items-center justify-center gap-1.5 transition-all relative overflow-hidden",
                                  isPaid ? "bg-emerald-50/50 border-emerald-200" :
                                  isCurrent ? "bg-blue-50 border-blue-300 shadow-sm ring-1 ring-blue-100" :
                                  "bg-slate-50 border-slate-100 opacity-60"
                                )}>
                                  <span className={cn("text-[9px] font-bold uppercase", isPaid ? "text-emerald-600" : isCurrent ? "text-blue-700" : "text-slate-400")}>
                                    Month {monthNum}
                                  </span>
                                  {isPaid ? <CheckCircle2 className="w-5 h-5 text-emerald-500" /> : 
                                   isCurrent ? <Clock className="w-5 h-5 text-blue-500" /> : 
                                   <Lock className="w-4 h-4 text-slate-300" />}
                                  {isCurrent && (
                                    <div className="absolute inset-x-0 bottom-0 top-0 flex flex-col">
                                      <button 
                                        className="flex-1 bg-blue-600/90 text-white text-[9px] font-bold opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center"
                                        onClick={() => handleRecordKittyPayment(selectedCustomer)}
                                      >
                                        MARK PAID
                                      </button>
                                      <button 
                                        className="h-1/3 bg-green-500/90 text-white text-[8px] font-bold opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center gap-1"
                                        onClick={() => {
                                          setIsProfileModalOpen(false);
                                          setTimeout(() => openWhatsAppModal(selectedCustomer, 'kitty_reminder'), 300);
                                        }}
                                      >
                                        REMIND
                                      </button>
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-4 p-4 bg-slate-50 rounded-lg border border-slate-100 mt-4">
                          <div className="space-y-1">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Paid</p>
                            <p className="text-sm font-bold text-slate-800">
                              ₹{((selectedCustomer.kitty_months_paid || 0) * (selectedCustomer.kitty_installment_amount || 0)).toLocaleString()}
                            </p>
                          </div>
                          <div className="space-y-1 border-l border-slate-200 pl-4">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                              <Gift className="w-3 h-3 text-emerald-500"/> Jeweler Bonus
                            </p>
                            <p className="text-sm font-bold text-emerald-600">
                              + ₹{(selectedCustomer.kitty_installment_amount || 0).toLocaleString()}
                            </p>
                          </div>
                          <div className="space-y-1 border-l border-slate-200 pl-4">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                              <Wallet className="w-3 h-3 text-purple-500"/> Est. Maturity
                            </p>
                            <p className="text-lg font-black text-purple-700 leading-none">
                              ₹{((12 * (selectedCustomer.kitty_installment_amount || 0)) + (selectedCustomer.kitty_installment_amount || 0)).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="text-center py-6">
                        <p className="text-sm font-medium text-slate-500">Customer is not currently enrolled in a Kitty Plan.</p>
                        <Button 
                          variant="outline" 
                          className="mt-4 border-purple-200 text-purple-700 hover:bg-purple-50 font-bold"
                          onClick={() => {
                            setIsProfileModalOpen(false);
                            setNewKittyForm({ 
                              ...newKittyForm, 
                              full_name: selectedCustomer.full_name || '', 
                              phone: selectedCustomer.phone || '', 
                              city: selectedCustomer.city || '' 
                            });
                            setTimeout(() => setIsAddKittyModalOpen(true), 300);
                          }}
                        >
                          <Gem className="w-4 h-4 mr-2" /> Start Kitty Plan Now
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* --- NEW UNIFIED CREDITS ADJUSTMENT MODAL --- */}
      <Dialog open={isLoyaltyModalOpen} onOpenChange={setIsLoyaltyModalOpen}>
        <DialogContent className="sm:max-w-[450px] border-emerald-200 rounded-xl bg-white shadow-2xl p-0 overflow-hidden">
          <DialogHeader className="bg-gradient-to-r from-emerald-50 to-teal-50 p-5 border-b border-emerald-100">
            <DialogTitle className="text-base font-bold text-emerald-800 flex items-center gap-2">
              <Wallet className="w-4 h-4" /> Manage Pavitram Credits
            </DialogTitle>
            <DialogDescription className="text-xs text-emerald-600/80 mt-1">Adjust wallet balance for <span className="font-bold text-emerald-800">{selectedCustomer?.full_name}</span></DialogDescription>
          </DialogHeader>
          
          <div className="p-5 space-y-5">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Reason / Trigger</label>
              <Select value={loyaltyForm.actionType} onValueChange={(val) => {
                let defaultAmt = '';
                if (val === 'exhibition') defaultAmt = '500';
                setLoyaltyForm({...loyaltyForm, actionType: val, amount: defaultAmt, billedAmount: ''});
              }}>
                <SelectTrigger className="h-10 text-sm font-semibold bg-white border-slate-200 shadow-sm rounded-lg focus:ring-emerald-500">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-lg border-slate-200 shadow-lg">
                  <SelectItem value="exhibition" className="text-emerald-700 font-bold">Exhibition Hosting (+₹500)</SelectItem>
                  <SelectItem value="b2p_referral" className="text-emerald-700 font-bold">B2P Purchase Referral (+5%)</SelectItem>
                  <SelectItem value="wedding_intro" className="text-emerald-700 font-bold">Wedding House Introduction</SelectItem>
                  <SelectItem value="manual_add" className="text-slate-700 font-medium">Custom Manual Addition (+)</SelectItem>
                  <SelectItem value="manual_deduct" className="text-red-600 font-bold">Custom Manual Deduction (-)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Dynamic Inputs based on Action Type */}
            {loyaltyForm.actionType === 'b2p_referral' && (
              <div className="space-y-1.5 p-3 bg-emerald-50/50 border border-emerald-100 rounded-lg">
                <label className="text-[10px] font-bold text-emerald-700 uppercase tracking-widest">Referred Billed Amount (₹)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₹</span>
                  <Input 
                    type="number"
                    className="h-10 text-sm font-bold border-emerald-200 focus-visible:ring-emerald-500 rounded-lg bg-white pl-8" 
                    placeholder="e.g. 50000"
                    value={loyaltyForm.billedAmount} 
                    onChange={handleBilledAmountChange} 
                  />
                </div>
                <p className="text-[10px] text-emerald-600 font-medium mt-1">Automatically calculates 5% for the wallet.</p>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                {loyaltyForm.actionType === 'manual_deduct' ? 'Amount to Deduct' : 'Amount to Credit'}
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₹</span>
                <Input 
                  type="number"
                  readOnly={loyaltyForm.actionType === 'exhibition' || loyaltyForm.actionType === 'b2p_referral'}
                  className={cn(
                    "h-12 text-xl font-black border-slate-200 focus-visible:ring-emerald-500 rounded-lg shadow-sm bg-white pl-8", 
                    loyaltyForm.actionType === 'manual_deduct' ? 'text-red-600' : 'text-emerald-600'
                  )} 
                  placeholder="0"
                  value={loyaltyForm.amount} 
                  onChange={(e) => setLoyaltyForm({...loyaltyForm, amount: e.target.value})} 
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Internal Note (Optional)</label>
              <Input 
                className="h-9 text-sm border-slate-200 focus-visible:ring-emerald-500 rounded-lg shadow-sm" 
                placeholder="E.g. Referral for Invoice #1024" 
                value={loyaltyForm.notes} 
                onChange={(e) => setLoyaltyForm({...loyaltyForm, notes: e.target.value})} 
              />
            </div>
            
            {selectedCustomer && loyaltyForm.amount && (
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 flex justify-between items-center text-sm">
                <span className="text-slate-500">Resulting Wallet Balance:</span>
                <span className="font-bold text-slate-900">
                  ₹{loyaltyForm.actionType === 'manual_deduct' 
                    ? Math.max(0, (Number(selectedCustomer.store_credit_balance) || 0) - Number(loyaltyForm.amount)).toLocaleString()
                    : ((Number(selectedCustomer.store_credit_balance) || 0) + Number(loyaltyForm.amount)).toLocaleString()
                  }
                </span>
              </div>
            )}
          </div>
          <DialogFooter className="bg-emerald-50/50 p-4 border-t border-emerald-100 flex-row gap-3">
            <Button variant="outline" className="flex-1 h-10 text-xs font-semibold rounded-lg border-emerald-200 text-emerald-800 bg-white hover:bg-emerald-50" onClick={() => setIsLoyaltyModalOpen(false)}>Cancel</Button>
            <Button disabled={isSubmitting || !loyaltyForm.amount} className="flex-[2] h-10 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm" onClick={handleUpdateLoyalty}>
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirm Update'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ADD LEAD MODAL */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="sm:max-w-[500px] border-slate-200 rounded-xl bg-white shadow-2xl p-0 overflow-hidden">
          <DialogHeader className="bg-slate-50 p-5 border-b border-slate-100">
            <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-slate-500" /> Add New Customer
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500 mt-1">Branch Context: <span className="font-bold text-slate-700">{selectedLocation === 'ALL' ? 'GLOBAL HQ' : warehouses.find(w => w.id === selectedLocation)?.name}</span></DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 p-5 max-h-[60vh] overflow-y-auto custom-scrollbar">
            <div className="space-y-1.5 col-span-2">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Full Name *</label>
              <Input className="h-9 text-sm border-slate-200 focus-visible:ring-indigo-500 rounded-md shadow-sm" placeholder="E.g. Rahul Sharma" value={newCustForm.full_name} onChange={(e) => setNewCustForm({...newCustForm, full_name: e.target.value})} />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Phone *</label>
              <Input className="h-9 text-sm font-mono border-slate-200 focus-visible:ring-indigo-500 rounded-md shadow-sm" placeholder="10 digits" value={newCustForm.phone} onChange={(e) => setNewCustForm({...newCustForm, phone: e.target.value})} />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">City</label>
              <Input className="h-9 text-sm border-slate-200 focus-visible:ring-indigo-500 rounded-md shadow-sm" placeholder="Mumbai" value={newCustForm.city} onChange={(e) => setNewCustForm({...newCustForm, city: e.target.value})} />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">D.O.B (Optional)</label>
              <Input type="date" className="h-9 text-xs border-slate-200 focus-visible:ring-indigo-500 rounded-md shadow-sm bg-white" value={newCustForm.birth_date} onChange={(e) => setNewCustForm({...newCustForm, birth_date: e.target.value})} />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Anniversary (Optional)</label>
              <Input type="date" className="h-9 text-xs border-slate-200 focus-visible:ring-indigo-500 rounded-md shadow-sm bg-white" value={newCustForm.anniversary_date} onChange={(e) => setNewCustForm({...newCustForm, anniversary_date: e.target.value})} />
            </div>
            <div className="col-span-2 border-t border-slate-100 pt-4 mt-2">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 block">Initial Follow-up Strategy</label>
              <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-1.5">
                   <label className="text-[9px] font-bold text-slate-400 uppercase">Date to contact</label>
                   <Input type="date" className="h-9 text-xs border-slate-200 focus-visible:ring-indigo-500 rounded-md shadow-sm bg-white" value={newCustForm.next_followup_date} onChange={(e) => setNewCustForm({...newCustForm, next_followup_date: e.target.value})} />
                 </div>
                 <div className="space-y-1.5">
                   <label className="text-[9px] font-bold text-slate-400 uppercase">Reason / Goal</label>
                   <Input className="h-9 text-sm border-slate-200 focus-visible:ring-indigo-500 rounded-md shadow-sm" placeholder="E.g. Wants bridal sets" value={newCustForm.followup_reason} onChange={(e) => setNewCustForm({...newCustForm, followup_reason: e.target.value})} />
                 </div>
              </div>
            </div>
          </div>
          <DialogFooter className="bg-slate-50 p-4 border-t border-slate-100 flex-row gap-3">
            <Button variant="outline" className="flex-1 h-10 text-xs font-semibold rounded-lg border-slate-300 text-slate-700 bg-white hover:bg-slate-50" onClick={() => setIsAddModalOpen(false)}>Cancel</Button>
            <Button disabled={isSubmitting} className="flex-[2] h-10 text-xs font-bold rounded-lg bg-slate-900 hover:bg-slate-800 text-white shadow-sm" onClick={handleAddCustomer}>
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Profile'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* KITTY REGISTRATION MODAL WITH REFERRAL SYSTEM */}
      <Dialog open={isAddKittyModalOpen} onOpenChange={setIsAddKittyModalOpen}>
        <DialogContent className="sm:max-w-[500px] border-slate-200 rounded-xl bg-white shadow-2xl p-0 overflow-hidden">
          <DialogHeader className="bg-purple-50 p-5 border-b border-purple-100">
            <DialogTitle className="text-base font-bold flex items-center gap-2 text-purple-700">
              <Gem className="w-4 h-4" /> Start Diamond Kitty Plan
            </DialogTitle>
            <DialogDescription className="text-xs text-purple-600/70 mt-1">Enroll a new member and assign referral bonuses.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 p-5 max-h-[60vh] overflow-y-auto custom-scrollbar">
            <div className="space-y-1.5 col-span-2">
              <label className="text-[10px] font-bold text-purple-800 uppercase tracking-widest">Full Name *</label>
              <Input className="h-9 text-sm border-purple-200 focus-visible:ring-purple-500 rounded-md shadow-sm" placeholder="Member Name" value={newKittyForm.full_name} onChange={(e) => setNewKittyForm({...newKittyForm, full_name: e.target.value})} />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-purple-800 uppercase tracking-widest">Phone *</label>
              <Input className="h-9 text-sm font-mono border-purple-200 focus-visible:ring-purple-500 rounded-md shadow-sm" placeholder="10 digits" value={newKittyForm.phone} onChange={(e) => setNewKittyForm({...newKittyForm, phone: e.target.value})} />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-purple-800 uppercase tracking-widest">City</label>
              <Input className="h-9 text-sm border-purple-200 focus-visible:ring-purple-500 rounded-md shadow-sm" placeholder="Mumbai" value={newKittyForm.city} onChange={(e) => setNewKittyForm({...newKittyForm, city: e.target.value})} />
            </div>

            {/* --- NEW REFERRAL SYSTEM BLOCK --- */}
            <div className="col-span-2 bg-indigo-50/50 p-4 rounded-xl border border-indigo-100 mt-2 space-y-4">
              <label className="text-[10px] font-black text-indigo-900 uppercase block tracking-widest flex items-center gap-2">
                <Users className="w-3 h-3 text-indigo-500" /> Referral Injection
              </label>
              
              <div className="space-y-1.5">
                <label className="text-[9px] font-bold text-indigo-700 uppercase tracking-wider">Referred By (Existing Customer)</label>
                <Select value={newKittyForm.referred_by_id} onValueChange={(val) => setNewKittyForm({...newKittyForm, referred_by_id: val})}>
                   <SelectTrigger className="h-9 bg-white border-indigo-200 font-semibold text-xs rounded-md shadow-sm focus:ring-indigo-500">
                     <SelectValue placeholder="No Referral" />
                   </SelectTrigger>
                   <SelectContent className="rounded-md border-indigo-100 shadow-lg max-h-60">
                     <SelectItem value="none" className="text-xs italic text-gray-500">No Referral</SelectItem>
                     {customers.map(c => (
                       <SelectItem key={c.id} value={c.id} className="text-xs font-bold text-slate-800">{c.full_name} ({c.phone.slice(-4)})</SelectItem>
                     ))}
                   </SelectContent>
                </Select>
              </div>

              {newKittyForm.referred_by_id !== 'none' && (
                <div className="space-y-1.5 animate-in fade-in slide-in-from-top-1">
                  <label className="text-[9px] font-bold text-indigo-700 uppercase tracking-wider">Bonus Credit for Referrer</label>
                  <Select value={newKittyForm.referral_bonus} onValueChange={(val) => setNewKittyForm({...newKittyForm, referral_bonus: val})}>
                     <SelectTrigger className="h-9 bg-white border-indigo-200 font-bold text-indigo-700 text-xs rounded-md shadow-sm">
                       <SelectValue />
                     </SelectTrigger>
                     <SelectContent className="rounded-md border-indigo-100 shadow-lg">
                       <SelectItem value="500" className="text-xs font-bold text-emerald-600">₹500 (1st to 6th Referral)</SelectItem>
                       <SelectItem value="1000" className="text-xs font-bold text-emerald-600">₹1000 (7th Referral Onwards)</SelectItem>
                     </SelectContent>
                  </Select>
                  <p className="text-[9px] text-indigo-500 font-medium">Credits will be instantly deposited into the referrer's wallet upon save.</p>
                </div>
              )}
            </div>

            <div className="col-span-2 bg-purple-50/50 p-4 rounded-xl border border-purple-100 mt-2 space-y-4">
               <label className="text-[10px] font-black text-purple-900 uppercase block tracking-widest flex items-center gap-2">
                 <Database className="w-3 h-3 text-purple-500" /> Scheme Parameters
               </label>
               <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-1.5">
                   <label className="text-[9px] font-bold text-purple-700 uppercase tracking-wider">Monthly Amount (₹)</label>
                   <Select value={newKittyForm.monthly_amount} onValueChange={(val) => setNewKittyForm({...newKittyForm, monthly_amount: val})}>
                      <SelectTrigger className="h-9 bg-white border-purple-200 font-semibold text-xs rounded-md shadow-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-md border-purple-100 shadow-lg">
                        <SelectItem value="2000" className="text-xs">₹ 2,000 / month</SelectItem>
                        <SelectItem value="3000" className="text-xs">₹ 3,000 / month</SelectItem>
                        <SelectItem value="5000" className="text-xs font-bold text-purple-700">₹ 5,000 / month</SelectItem>
                        <SelectItem value="10000" className="text-xs">₹ 10,000 / month</SelectItem>
                      </SelectContent>
                   </Select>
                 </div>
                 <div className="space-y-1.5">
                   <label className="text-[9px] font-bold text-purple-700 uppercase tracking-wider">Enrollment Date</label>
                   <Input type="date" className="h-9 text-xs bg-white border-purple-200 rounded-md shadow-sm" value={newKittyForm.start_date} onChange={(e) => setNewKittyForm({...newKittyForm, start_date: e.target.value})} />
                 </div>
               </div>
            </div>
          </div>
          <DialogFooter className="bg-purple-50 p-4 border-t border-purple-100 flex-row gap-3">
            <Button variant="outline" className="flex-1 h-10 text-xs font-semibold rounded-lg border-purple-200 text-purple-700 bg-white hover:bg-purple-50" onClick={() => setIsAddKittyModalOpen(false)}>Cancel</Button>
            <Button disabled={isSubmitting} className="flex-[2] h-10 text-xs font-bold rounded-lg bg-purple-600 hover:bg-purple-700 text-white shadow-sm" onClick={handleAddKittyMember}>
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirm Enrollment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 4. SCHEDULE MODAL */}
      <Dialog open={isFollowupModalOpen} onOpenChange={setIsFollowupModalOpen}>
        <DialogContent className="sm:max-w-[400px] border-slate-200 rounded-xl bg-white shadow-2xl p-0 overflow-hidden">
          <DialogHeader className="bg-slate-50 p-5 border-b border-slate-100">
            <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-indigo-500" /> Schedule Follow-up
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500 mt-1">For <span className="font-bold text-slate-700">{selectedCustomer?.full_name}</span></DialogDescription>
          </DialogHeader>
          <div className="space-y-4 p-5">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">1. Goal / Reason</label>
              <Input 
                className="h-9 text-sm border-slate-200 rounded-md shadow-sm focus-visible:ring-indigo-500" 
                placeholder="E.g. Wants to buy a bridal set" 
                value={followupReason} onChange={(e) => setFollowupReason(e.target.value)} 
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">2. Next Action Date</label>
              <Input type="date" className="h-9 text-sm border-slate-200 rounded-md shadow-sm focus-visible:ring-indigo-500 bg-white" value={followupDate} onChange={(e) => setFollowupDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">3. Notes (Optional)</label>
              <textarea 
                className="w-full min-h-[80px] p-3 text-sm border border-slate-200 rounded-md focus:ring-1 focus:ring-indigo-500 outline-none resize-none shadow-sm"
                placeholder="Any previous context..." 
                value={interactionNotes} onChange={(e) => setInteractionNotes(e.target.value)} 
              />
            </div>
          </div>
          <DialogFooter className="bg-slate-50 p-4 border-t border-slate-100 flex-row gap-3">
            <Button variant="outline" className="flex-1 h-10 text-xs font-semibold rounded-lg border-slate-300 text-slate-700 bg-white hover:bg-slate-50" onClick={() => setIsFollowupModalOpen(false)}>Cancel</Button>
            <Button disabled={isSubmitting} className="flex-[2] h-10 text-xs font-bold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm" onClick={handleUpdateFollowup}>
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Schedule'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 5. WHATSAPP MODAL */}
      <Dialog open={isWhatsAppModalOpen} onOpenChange={setIsWhatsAppModalOpen}>
        <DialogContent className="sm:max-w-[500px] border-slate-200 rounded-xl bg-white shadow-2xl p-0 overflow-hidden">
          <DialogHeader className="bg-[#25D366]/5 p-5 border-b border-[#25D366]/20">
            <DialogTitle className="text-base font-bold flex items-center gap-2 text-[#1DA851]">
              <MessageCircle className="w-4 h-4" /> Campaign Message
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500 mt-1">To: <span className="font-bold text-slate-700">{selectedCustomer?.full_name}</span> ({selectedCustomer?.phone})</DialogDescription>
          </DialogHeader>
          
          <div className="space-y-5 p-5">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center justify-between">
                <span>1. Select Template</span>
                {activeAiFilter !== 'none' && <Badge className="text-[9px] font-bold h-5 bg-indigo-50 text-indigo-600 border-indigo-200 uppercase tracking-wider rounded-md">Auto-Selected</Badge>}
              </label>
              <Select value={waTemplateId} onValueChange={handleTemplateChange}>
                <SelectTrigger className="h-10 text-sm font-semibold bg-white border-slate-200 shadow-sm rounded-lg">
                  <SelectValue placeholder="Choose a template" />
                </SelectTrigger>
                <SelectContent className="rounded-lg border-slate-200 shadow-lg">
                  {availableTemplates.length === 0 ? (
                    <SelectItem value="none" disabled className="text-xs italic text-gray-500 py-2">No templates configured.</SelectItem>
                  ) : (
                    availableTemplates.map(t => (
                      <SelectItem key={t.template_id} value={t.template_id} className="text-xs font-medium py-2">{t.label}</SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex justify-between items-end">
                <span>2. Customize Message</span>
                <span className="text-slate-400 font-semibold lowercase text-[10px]">Editable</span>
              </label>
              <div className="relative">
                <textarea 
                  className="w-full min-h-[160px] p-4 text-sm font-medium border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#25D366]/20 focus:border-[#25D366] outline-none shadow-inner resize-none leading-relaxed text-slate-800 bg-slate-50/50"
                  placeholder="Type your message here..."
                  value={customMessage}
                  onChange={(e) => setCustomMessage(e.target.value)}
                />
              </div>
            </div>
          </div>

          <DialogFooter className="bg-slate-50 p-4 border-t border-slate-100 flex-row gap-3">
            <Button variant="outline" className="flex-1 h-10 text-xs font-semibold rounded-lg border-slate-300 text-slate-700 bg-white hover:bg-slate-50" onClick={() => setIsWhatsAppModalOpen(false)}>Cancel</Button>
            <Button className="flex-[2] h-10 text-xs font-bold rounded-lg bg-[#25D366] hover:bg-[#1DA851] text-white shadow-sm" onClick={handleSendWhatsApp}>
              <MessageCircle className="w-4 h-4 mr-2" /> Send via WhatsApp
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}