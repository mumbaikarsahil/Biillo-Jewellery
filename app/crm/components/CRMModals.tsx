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
  UserPlus, Building2, MapPin, Calendar, MessageCircle, Wallet, Gift, Users, Mail
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

  importFile: File | null; setImportFile: (f: File | null) => void;
  previewData: any[]; 
  selectedCustomer: CRMCustomer | null;
  selectedLocation: string;
  warehouses: Warehouse[];
  activeAiFilter: string;
  dynamicTemplates: any[]; 
  customers: CRMCustomer[]; 
  
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

  const handleBilledAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const billed = e.target.value;
    const bonus = Number(billed) * 0.05;
    setLoyaltyForm({ ...loyaltyForm, billedAmount: billed, amount: bonus.toString() });
  };

  return (
    <>
      {/* 0. IMPORT CSV MODAL */}
      <Dialog open={isImportModalOpen} onOpenChange={setIsImportModalOpen}>
        <DialogContent className="w-full sm:max-w-[450px] border-none sm:rounded-[28px] rounded-t-[28px] rounded-b-none sm:rounded-b-[28px] bg-white shadow-[0_-10px_40px_rgba(0,0,0,0.1)] sm:shadow-[0_24px_60px_-15px_rgba(0,0,0,0.15)] p-0 overflow-hidden flex flex-col mt-auto sm:mt-0 mb-0 sm:mb-auto max-h-[90vh]">
          <DialogHeader className="bg-emerald-50/50 p-6 sm:p-8 border-b border-emerald-100/50 shrink-0">
            <DialogTitle className="text-xl font-black flex items-center gap-2.5 text-emerald-900 tracking-tight">
              <UploadCloud className="w-6 h-6 text-emerald-600" strokeWidth={2} /> Bulk Import
            </DialogTitle>
            <DialogDescription className="text-xs font-medium text-emerald-700/70 mt-1.5">
              Upload a `.csv` file to instantly populate your CRM database.
            </DialogDescription>
          </DialogHeader>

          <div className="p-6 sm:p-8 space-y-6 bg-white overflow-y-auto custom-scrollbar flex-1">
            <div className="bg-emerald-50/30 border border-emerald-100 p-4 rounded-2xl flex flex-col sm:flex-row gap-3 items-center justify-between">
              <div className="flex flex-col text-center sm:text-left">
                <span className="font-bold text-gray-900 text-sm">Need the exact format?</span>
                <span className="text-[11px] font-medium text-gray-500">Download the required template.</span>
              </div>
              <Button variant="outline" size="sm" onClick={handleDownloadSample} className="h-9 px-4 rounded-xl border-emerald-200 text-emerald-700 bg-white hover:bg-emerald-50 text-[11px] font-bold uppercase tracking-widest shrink-0 transition-colors w-full sm:w-auto">
                <Download className="w-3.5 h-3.5 mr-1.5" /> Sample
              </Button>
            </div>

            <div className="space-y-2.5">
              <label className="text-[11px] font-bold text-gray-500 uppercase tracking-widest block">Select File (.CSV)</label>
              <label className={cn(
                "flex flex-col items-center justify-center w-full h-36 border-2 border-dashed rounded-[20px] cursor-pointer transition-all",
                importFile ? 'border-emerald-400 bg-emerald-50/50' : 'border-gray-200 hover:bg-gray-50 hover:border-gray-300 bg-white'
              )}>
                <div className="flex flex-col items-center justify-center pt-5 pb-6 text-center px-4">
                  {isImporting ? (
                     <Loader2 className="w-8 h-8 text-emerald-500 animate-spin mb-3" />
                  ) : importFile ? (
                     <FileSpreadsheet className="w-8 h-8 text-emerald-500 mb-3" strokeWidth={1.5} />
                  ) : (
                     <UploadCloud className="w-8 h-8 text-gray-300 mb-3" strokeWidth={1.5} />
                  )}
                  <p className="text-sm font-bold text-gray-700 truncate w-full max-w-[200px]">{importFile ? importFile.name : "Click or drag file here"}</p>
                </div>
                <input type="file" accept=".csv" className="hidden" onChange={(e) => setImportFile(e.target.files?.[0] || null)} />
              </label>
            </div>
            <p className="text-[11px] font-medium text-gray-400 leading-relaxed text-center sm:text-left">
              * The system uses Phone Numbers to prevent duplicates. Existing profiles will be securely updated if they share the same number.
            </p>
          </div>

          <DialogFooter className="bg-gray-50/80 p-5 sm:p-6 border-t border-gray-100 flex flex-col sm:flex-row gap-3 shrink-0 pb-safe">
            <Button variant="ghost" className="w-full sm:flex-1 h-12 rounded-[16px] text-xs font-bold uppercase tracking-widest text-gray-500 hover:bg-gray-200 transition-colors px-6" onClick={() => setIsImportModalOpen(false)}>Cancel</Button>
            <Button disabled={isImporting || !importFile} className="w-full sm:flex-[2] h-12 rounded-[16px] text-xs font-bold uppercase tracking-widest bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-200 transition-all active:scale-95" onClick={handleParseFile}>
              {isImporting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : 'Review Data'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 0.5 IMPORT PREVIEW MODAL */}
      <Dialog open={isPreviewModalOpen} onOpenChange={setIsPreviewModalOpen}>
        <DialogContent className="max-w-[100vw] h-[100vh] sm:max-w-[95vw] sm:h-[90vh] flex flex-col border-none sm:rounded-[28px] rounded-none bg-white shadow-[0_24px_60px_-15px_rgba(0,0,0,0.15)] p-0 overflow-hidden">
          <DialogHeader className="bg-emerald-50/50 p-5 sm:p-6 border-b border-emerald-100/50 shrink-0">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 pt-safe">
              <div>
                <DialogTitle className="text-xl font-black flex items-center gap-2.5 text-emerald-900 tracking-tight">
                  <Database className="w-6 h-6 text-emerald-600" strokeWidth={2} /> Import Staging Area
                </DialogTitle>
                <DialogDescription className="text-xs font-medium text-emerald-700/70 mt-1.5 hidden sm:block">
                  Review and edit the {previewData.length} records parsed from your CSV before committing them to the database.
                </DialogDescription>
              </div>
              <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[11px] font-bold uppercase tracking-widest px-3 py-1 rounded-lg shrink-0 w-fit self-start sm:self-auto">
                {previewData.length} Valid Rows
              </Badge>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-auto bg-white custom-scrollbar p-2 sm:p-4">
            <div className="border border-gray-200/60 rounded-xl sm:rounded-2xl overflow-hidden shadow-sm h-full">
              <Table className="w-max min-w-full">
                <TableHeader className="bg-gray-50/80 sticky top-0 z-10 shadow-[0_1px_2px_rgba(0,0,0,0.05)] border-b border-gray-200/60">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-12"></TableHead>
                    <TableHead className="text-[11px] font-bold uppercase tracking-widest text-gray-500 h-12 w-[180px]">Full Name</TableHead>
                    <TableHead className="text-[11px] font-bold uppercase tracking-widest text-gray-500 h-12 w-[140px]">Phone</TableHead>
                    <TableHead className="text-[11px] font-bold uppercase tracking-widest text-gray-500 h-12 w-[150px]">Status</TableHead>
                    <TableHead className="text-[11px] font-bold uppercase tracking-widest text-gray-500 h-12 w-[140px]">City</TableHead>
                    <TableHead className="text-[11px] font-bold uppercase tracking-widest text-gray-500 h-12 w-[120px]">Credit(₹)</TableHead>
                    <TableHead className="text-[11px] font-bold uppercase tracking-widest text-purple-600 bg-purple-50/50 h-12 w-[140px]">Kitty Status</TableHead>
                    <TableHead className="text-[11px] font-bold uppercase tracking-widest text-purple-600 bg-purple-50/50 h-12 w-[100px]">Mths Paid</TableHead>
                    <TableHead className="text-[11px] font-bold uppercase tracking-widest text-purple-600 bg-purple-50/50 h-12 w-[120px]">Inst. (₹)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewData.map((row, index) => (
                    <TableRow key={row._id} className="group hover:bg-gray-50/50 transition-colors border-b border-gray-100 last:border-0">
                      <TableCell className="p-2 text-center">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:bg-red-50 hover:text-red-500 rounded-[10px] transition-colors" onClick={() => removePreviewRow(index)}>
                          <Trash2 className="w-4 h-4" strokeWidth={1.5} />
                        </Button>
                      </TableCell>
                      <TableCell className="p-2">
                        <Input className="h-10 rounded-xl text-sm font-semibold border-transparent hover:border-gray-200 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 px-3 transition-all" value={row.full_name} onChange={(e) => updatePreviewRow(index, 'full_name', e.target.value)} />
                      </TableCell>
                      <TableCell className="p-2">
                        <Input className="h-10 rounded-xl text-sm font-mono font-bold border-transparent hover:border-gray-200 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 px-3 transition-all" value={row.phone} onChange={(e) => updatePreviewRow(index, 'phone', e.target.value.replace(/\D/g, ''))} />
                      </TableCell>
                      <TableCell className="p-2">
                        <Select value={row.customer_status} onValueChange={(val) => updatePreviewRow(index, 'customer_status', val)}>
                          <SelectTrigger className="h-10 rounded-xl text-sm font-semibold border-transparent hover:border-gray-200 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 px-3 transition-all bg-transparent">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl shadow-lg border-gray-100 p-1">
                            <SelectItem value="Lead" className="text-sm font-medium rounded-lg py-2 cursor-pointer">Lead</SelectItem>
                            <SelectItem value="Purchased" className="text-sm font-medium rounded-lg py-2 cursor-pointer">Purchased</SelectItem>
                            <SelectItem value="Kitty Member" className="text-sm font-bold text-purple-600 rounded-lg py-2 cursor-pointer">Kitty Member</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="p-2">
                        <Input className="h-10 rounded-xl text-sm font-medium border-transparent hover:border-gray-200 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 px-3 transition-all" value={row.city} onChange={(e) => updatePreviewRow(index, 'city', e.target.value)} />
                      </TableCell>
                      <TableCell className="p-2">
                        <Input type="number" className="h-10 rounded-xl text-sm font-mono font-bold border-transparent hover:border-gray-200 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 px-3 text-emerald-700 bg-emerald-50/50 transition-all" value={row.store_credit_balance} onChange={(e) => updatePreviewRow(index, 'store_credit_balance', e.target.value)} />
                      </TableCell>
                      <TableCell className="p-2 bg-purple-50/30">
                        <Select value={row.kitty_plan_status} onValueChange={(val) => updatePreviewRow(index, 'kitty_plan_status', val)}>
                          <SelectTrigger className="h-10 rounded-xl text-sm font-bold border-transparent hover:border-purple-200 focus:bg-white focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 px-3 text-purple-700 bg-transparent transition-all">
                            <SelectValue placeholder="None" />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl shadow-lg border-gray-100 p-1">
                            <SelectItem value=" " className="text-sm font-medium text-gray-400 rounded-lg py-2 cursor-pointer">None</SelectItem>
                            <SelectItem value="Active" className="text-sm font-bold text-purple-600 rounded-lg py-2 cursor-pointer">Active</SelectItem>
                            <SelectItem value="Inactive" className="text-sm font-medium text-gray-500 rounded-lg py-2 cursor-pointer">Inactive</SelectItem>
                            <SelectItem value="Matured" className="text-sm font-bold text-emerald-600 rounded-lg py-2 cursor-pointer">Matured</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="p-2 bg-purple-50/30">
                        <Input type="number" className="h-10 rounded-xl text-sm font-mono font-bold border-transparent hover:border-purple-200 focus:bg-white focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 px-3 text-purple-700 transition-all" value={row.kitty_months_paid} onChange={(e) => updatePreviewRow(index, 'kitty_months_paid', e.target.value)} />
                      </TableCell>
                      <TableCell className="p-2 bg-purple-50/30">
                        <Input type="number" className="h-10 rounded-xl text-sm font-mono font-bold border-transparent hover:border-purple-200 focus:bg-white focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 px-3 text-purple-700 transition-all" value={row.kitty_installment_amount} onChange={(e) => updatePreviewRow(index, 'kitty_installment_amount', e.target.value)} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          <DialogFooter className="bg-gray-50/80 p-4 sm:p-6 border-t border-gray-100 flex flex-col sm:flex-row gap-3 shrink-0 pb-safe">
            <Button variant="ghost" className="w-full sm:w-auto sm:flex-1 h-12 rounded-[16px] text-xs font-bold uppercase tracking-widest text-gray-500 hover:bg-gray-200 transition-colors px-6" onClick={() => setIsPreviewModalOpen(false)}>Cancel & Discard</Button>
            <Button disabled={isSubmitting || previewData.length === 0} className="w-full sm:w-auto sm:flex-[2] h-12 rounded-[16px] text-xs font-bold uppercase tracking-widest bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-200 transition-all active:scale-95" onClick={handleCommitImport}>
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Database className="w-4 h-4 mr-2" strokeWidth={2}/>}
              Confirm & Import
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 1. CUSTOMER PROFILE MODAL */}
      <Dialog open={isProfileModalOpen} onOpenChange={setIsProfileModalOpen}>
        <DialogContent className="w-full h-full sm:h-auto sm:max-w-[750px] border-none sm:rounded-[28px] rounded-none bg-white shadow-[0_24px_60px_-15px_rgba(0,0,0,0.15)] p-0 overflow-hidden flex flex-col">
          {selectedCustomer && (
            <>
              <DialogHeader className="bg-gray-50/80 p-5 sm:p-8 border-b border-gray-100 shrink-0 pt-safe">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <DialogTitle className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight">{selectedCustomer.full_name}</DialogTitle>
                    <div className="flex flex-wrap items-center gap-2 sm:gap-3 mt-1.5 sm:mt-2 text-[11px] sm:text-[13px] text-gray-500 font-medium">
                      <span className="flex items-center gap-1 sm:gap-1.5 font-mono font-bold text-gray-700"><Phone className="w-3 sm:w-3.5 h-3 sm:h-3.5 text-gray-400"/> {selectedCustomer.phone}</span>
                      <span className="text-gray-300 hidden sm:inline">|</span>
                      <span className="flex items-center gap-1 sm:gap-1.5"><MapPin className="w-3 sm:w-3.5 h-3 sm:h-3.5 text-gray-400"/> {selectedCustomer.city || 'Unknown City'}</span>
                    </div>
                  </div>
                  <Badge variant="outline" className={cn(
                    "uppercase tracking-widest text-[9px] sm:text-[10px] font-bold px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg sm:rounded-xl border-none shadow-sm",
                    selectedCustomer.customer_status === 'Kitty Member' ? "bg-purple-50 text-purple-700" :
                    selectedCustomer.customer_status === 'Purchased' ? "bg-emerald-50 text-emerald-700" : 
                    "bg-gray-100 text-gray-600"
                  )}>
                    {selectedCustomer.customer_status || 'Lead'}
                  </Badge>
                </div>
              </DialogHeader>

              <div className="p-4 sm:p-8 overflow-y-auto custom-scrollbar space-y-6 sm:space-y-8 bg-white flex-1">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                  {/* --- UNIFIED PAVITRAM WALLET CARD --- */}
                  <div className="bg-emerald-600 rounded-[20px] sm:rounded-[24px] p-5 sm:p-6 shadow-md shadow-emerald-200 flex flex-col justify-center relative overflow-hidden group">
                    <div className="flex justify-between items-center mb-2 sm:mb-3 relative z-10">
                      <h3 className="text-[10px] sm:text-[11px] font-black text-emerald-100 uppercase tracking-widest flex items-center gap-1.5">
                        <Wallet className="w-3.5 sm:w-4 h-3.5 sm:h-4" strokeWidth={2}/> Pavitram Credits
                      </h3>
                      <Button 
                        size="icon" variant="ghost" 
                        className="h-7 w-7 sm:h-8 sm:w-8 text-white hover:bg-emerald-500 hover:text-white rounded-lg sm:rounded-[10px] transition-colors bg-white/10 backdrop-blur-sm border border-white/20" 
                        onClick={() => setIsLoyaltyModalOpen(true)} title="Adjust Credits"
                      >
                        <Edit2 className="w-3 sm:w-3.5 h-3 sm:h-3.5" strokeWidth={2}/>
                      </Button>
                    </div>
                    <p className="text-3xl sm:text-5xl font-black text-white relative z-10 tracking-tighter">
                      ₹{(selectedCustomer.store_credit_balance || 0).toLocaleString()}
                    </p>
                    {/* Decorative Background Icon */}
                    <Wallet className="absolute -right-4 -bottom-4 sm:-right-6 sm:-bottom-6 w-24 h-24 sm:w-32 sm:h-32 text-emerald-700 opacity-50 -rotate-12 group-hover:scale-110 group-hover:opacity-40 transition-all duration-500" />
                  </div>

                  {/* Context Card */}
                  <div className="bg-gray-50/80 border border-gray-100 rounded-[20px] sm:rounded-[24px] p-5 sm:p-6 flex flex-col justify-center space-y-3 sm:space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-widest text-gray-500">Birth Date</span>
                      <span className="text-xs sm:text-[13px] font-bold text-gray-900">{selectedCustomer.birth_date ? new Date(selectedCustomer.birth_date).toLocaleDateString() : 'Not Set'}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-widest text-gray-500">Anniversary</span>
                      <span className="text-xs sm:text-[13px] font-bold text-gray-900">{selectedCustomer.anniversary_date ? new Date(selectedCustomer.anniversary_date).toLocaleDateString() : 'Not Set'}</span>
                    </div>
                    <Separator className="bg-gray-200/60" />
                    <div className="flex justify-between items-center pt-1">
                      <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-widest text-gray-500">Customer Since</span>
                      <span className="text-xs sm:text-[13px] font-bold text-gray-900">{new Date(selectedCustomer.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>

                {/* THE DIAMOND KITTY HARVESTING DASHBOARD */}
                <div className="bg-white border border-gray-200/60 rounded-[20px] sm:rounded-[24px] shadow-sm overflow-hidden">
                  <div className="bg-gray-50/80 border-b border-gray-100 p-4 sm:p-5 sm:px-6 flex justify-between items-center">
                    <h3 className="text-xs sm:text-[13px] font-black text-gray-900 uppercase tracking-widest flex items-center gap-1.5 sm:gap-2">
                      <Gem className="w-3.5 sm:w-4 h-3.5 sm:h-4 text-purple-500" strokeWidth={2.5}/> Harvesting Plan
                    </h3>
                    <Badge variant="outline" className={cn(
                      "text-[8px] sm:text-[9px] uppercase tracking-widest font-bold px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-md sm:rounded-lg border-none shadow-sm", 
                      (selectedCustomer.kitty_plan_status === 'Active' || selectedCustomer.customer_status === 'Kitty Member') ? 'bg-purple-50 text-purple-700' : 'bg-gray-100 text-gray-500'
                    )}>
                      {selectedCustomer.kitty_plan_status || (selectedCustomer.customer_status === 'Kitty Member' ? 'Active' : 'Inactive')}
                    </Badge>
                  </div>
                  
                  <div className="p-4 sm:p-6 sm:px-8 space-y-6 sm:space-y-8">
                    {(selectedCustomer.kitty_plan_status === 'Active' || selectedCustomer.customer_status === 'Kitty Member') ? (
                      <>
                        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-3 sm:gap-4">
                          <div>
                            <p className="text-base sm:text-lg font-black text-gray-900 tracking-tight">{selectedCustomer.kitty_plan_name || 'Pavitram Diamond Kitty'}</p>
                            <p className="text-[11px] sm:text-[13px] font-medium text-gray-500 mt-0.5 sm:mt-1">12 Months Plan + 1 Month Jeweler Bonus</p>
                          </div>
                          <div className="text-left sm:text-right">
                            <p className="text-[9px] sm:text-[10px] font-bold text-purple-600 uppercase tracking-widest mb-0.5 sm:mb-1">Months Paid</p>
                            <p className="text-2xl sm:text-3xl font-black text-purple-700 tracking-tighter leading-none">{selectedCustomer.kitty_months_paid || 0} <span className="text-xs sm:text-[15px] text-purple-400 font-bold tracking-normal">/ 12</span></p>
                          </div>
                        </div>

                        <div className="w-full bg-gray-100 h-2.5 sm:h-3 rounded-full overflow-hidden shadow-inner">
                          <div 
                            className="bg-purple-500 h-full rounded-full transition-all duration-700 ease-out" 
                            style={{ width: `${Math.min(((selectedCustomer.kitty_months_paid || 0) / 12) * 100, 100)}%` }}
                          />
                        </div>

                        <div>
                          <h4 className="text-[10px] sm:text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3 sm:mb-4">Installment Tracker</h4>
                          <div className="grid grid-cols-4 md:grid-cols-6 gap-2 sm:gap-3 md:gap-4">
                            {Array.from({length: 12}).map((_, i) => {
                              const monthNum = i + 1;
                              const monthsPaid = selectedCustomer.kitty_months_paid || 0;
                              const isPaid = monthNum <= monthsPaid;
                              const isCurrent = monthNum === monthsPaid + 1;

                              return (
                                <div key={i} className={cn(
                                  "rounded-xl sm:rounded-[16px] p-2 sm:p-3 flex flex-col items-center justify-center gap-1.5 sm:gap-2 transition-all relative overflow-hidden h-[60px] sm:h-[72px]",
                                  isPaid ? "bg-emerald-50 border border-emerald-100" :
                                  isCurrent ? "bg-white border-2 border-blue-400 shadow-sm" :
                                  "bg-gray-50 border border-gray-100 opacity-70"
                                )}>
                                  <span className={cn("text-[9px] sm:text-[10px] font-black uppercase tracking-widest", isPaid ? "text-emerald-700" : isCurrent ? "text-blue-700" : "text-gray-400")}>
                                    Mon {monthNum}
                                  </span>
                                  {isPaid ? <CheckCircle2 className="w-4 sm:w-5 h-4 sm:h-5 text-emerald-500" strokeWidth={2.5}/> : 
                                   isCurrent ? <Clock className="w-4 sm:w-5 h-4 sm:h-5 text-blue-500" strokeWidth={2.5}/> : 
                                   <Lock className="w-3.5 sm:w-4 h-3.5 sm:h-4 text-gray-300" strokeWidth={2}/>}
                                  
                                  {isCurrent && (
                                    <div className="absolute inset-x-0 bottom-0 top-0 flex flex-col">
                                      <button 
                                        className="flex-1 bg-blue-600/95 backdrop-blur-sm text-white text-[9px] sm:text-[10px] font-bold tracking-widest uppercase opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center"
                                        onClick={() => handleRecordKittyPayment(selectedCustomer)}
                                      >
                                        Mark Paid
                                      </button>
                                      <button 
                                        className="h-1/3 bg-emerald-500/95 backdrop-blur-sm text-white text-[8px] sm:text-[9px] font-bold tracking-widest uppercase opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center gap-1"
                                        onClick={() => {
                                          setIsProfileModalOpen(false);
                                          setTimeout(() => openWhatsAppModal(selectedCustomer, 'kitty_reminder'), 300);
                                        }}
                                      >
                                        Remind
                                      </button>
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 p-4 sm:p-5 md:p-6 bg-gray-50/80 rounded-xl sm:rounded-[20px] border border-gray-200/60 mt-4 sm:mt-6">
                          <div className="space-y-1 sm:space-y-1.5 flex flex-col sm:block items-center sm:items-start text-center sm:text-left">
                            <p className="text-[9px] sm:text-[10px] font-bold text-gray-500 uppercase tracking-widest">Total Paid</p>
                            <p className="text-sm sm:text-[15px] font-black text-gray-900 tracking-tight">
                              ₹{((selectedCustomer.kitty_months_paid || 0) * (selectedCustomer.kitty_installment_amount || 0)).toLocaleString()}
                            </p>
                          </div>
                          <div className="space-y-1 sm:space-y-1.5 flex flex-col sm:block items-center sm:items-start text-center sm:text-left sm:border-l sm:border-gray-200 sm:pl-4 md:pl-6">
                            <p className="text-[9px] sm:text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1.5">
                              <Gift className="w-3 sm:w-3.5 h-3 sm:h-3.5 text-emerald-500"/> Jeweler Bonus
                            </p>
                            <p className="text-sm sm:text-[15px] font-black text-emerald-600 tracking-tight">
                              + ₹{(selectedCustomer.kitty_installment_amount || 0).toLocaleString()}
                            </p>
                          </div>
                          <div className="space-y-1 sm:space-y-1.5 flex flex-col sm:block items-center sm:items-start text-center sm:text-left sm:border-l sm:border-gray-200 sm:pl-4 md:pl-6 pt-3 sm:pt-0 border-t border-gray-200 sm:border-t-0 mt-1 sm:mt-0">
                            <p className="text-[9px] sm:text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1.5">
                              <Wallet className="w-3 sm:w-3.5 h-3 sm:h-3.5 text-purple-500"/> Est. Maturity
                            </p>
                            <p className="text-lg sm:text-xl font-black text-purple-700 tracking-tighter leading-none pt-0.5">
                              ₹{((12 * (selectedCustomer.kitty_installment_amount || 0)) + (selectedCustomer.kitty_installment_amount || 0)).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="text-center py-6 sm:py-10 px-4">
                        <div className="h-12 sm:h-14 w-12 sm:w-14 rounded-2xl bg-purple-50 flex items-center justify-center mx-auto mb-3 sm:mb-4 border border-purple-100">
                          <Gem className="w-5 sm:w-6 h-5 sm:h-6 text-purple-400" strokeWidth={1.5} />
                        </div>
                        <p className="text-xs sm:text-[13px] font-semibold text-gray-600">Customer is not currently enrolled in a Kitty Plan.</p>
                        <Button 
                          className="mt-4 sm:mt-6 h-10 sm:h-12 px-6 sm:px-8 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-[10px] sm:text-xs uppercase tracking-widest shadow-md shadow-purple-200 transition-all active:scale-95"
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
                          <Gem className="w-3.5 sm:w-4 h-3.5 sm:h-4 mr-2" strokeWidth={2}/> Start Kitty Plan Now
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="bg-white p-4 sm:hidden border-t border-gray-100 pb-safe shrink-0">
                <Button variant="outline" className="w-full h-12 rounded-xl text-xs font-bold text-gray-500" onClick={() => setIsProfileModalOpen(false)}>Close</Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* --- NEW UNIFIED CREDITS ADJUSTMENT MODAL --- */}
      <Dialog open={isLoyaltyModalOpen} onOpenChange={setIsLoyaltyModalOpen}>
        <DialogContent className="w-full sm:max-w-[450px] border-none sm:rounded-[28px] rounded-t-[28px] rounded-b-none sm:rounded-b-[28px] bg-white shadow-[0_-10px_40px_rgba(0,0,0,0.1)] sm:shadow-[0_24px_60px_-15px_rgba(0,0,0,0.15)] p-0 overflow-hidden flex flex-col mt-auto sm:mt-0 mb-0 sm:mb-auto max-h-[90vh]">
          <DialogHeader className="bg-emerald-600 p-6 sm:p-8 border-b border-emerald-700/50 shrink-0">
            <DialogTitle className="text-lg sm:text-xl font-black text-white flex items-center gap-2.5 tracking-tight">
              <Wallet className="w-5 sm:w-6 h-5 sm:h-6 text-emerald-200" strokeWidth={2}/> Manage Pavitram Credits
            </DialogTitle>
            <DialogDescription className="text-xs font-medium text-emerald-100/80 mt-1.5">Adjust wallet balance for <span className="font-bold text-white">{selectedCustomer?.full_name}</span></DialogDescription>
          </DialogHeader>
          
          <div className="p-6 sm:p-8 space-y-5 sm:space-y-6 bg-white overflow-y-auto custom-scrollbar flex-1">
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Reason / Trigger</label>
              <Select value={loyaltyForm.actionType} onValueChange={(val) => {
                let defaultAmt = '';
                if (val === 'exhibition') defaultAmt = '500';
                setLoyaltyForm({...loyaltyForm, actionType: val, amount: defaultAmt, billedAmount: ''});
              }}>
                <SelectTrigger className="h-12 text-sm font-semibold bg-gray-50 hover:bg-gray-100 border-gray-200/60 shadow-sm rounded-xl focus:ring-emerald-500 focus:bg-white transition-colors">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-[16px] shadow-xl border-gray-100 p-1">
                  <SelectItem value="exhibition" className="text-sm text-emerald-700 font-bold rounded-lg py-2.5 cursor-pointer focus:bg-emerald-50">Exhibition Hosting (+₹500)</SelectItem>
                  <SelectItem value="b2p_referral" className="text-sm text-emerald-700 font-bold rounded-lg py-2.5 cursor-pointer focus:bg-emerald-50">B2P Purchase Referral (+5%)</SelectItem>
                  <SelectItem value="wedding_intro" className="text-sm text-emerald-700 font-bold rounded-lg py-2.5 cursor-pointer focus:bg-emerald-50">Wedding House Introduction</SelectItem>
                  <Separator className="my-1.5 bg-gray-100" />
                  <SelectItem value="manual_add" className="text-sm text-gray-700 font-bold rounded-lg py-2.5 cursor-pointer focus:bg-gray-50">Custom Manual Addition (+)</SelectItem>
                  <SelectItem value="manual_deduct" className="text-sm text-red-600 font-bold rounded-lg py-2.5 cursor-pointer focus:bg-red-50">Custom Manual Deduction (-)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Dynamic Inputs based on Action Type */}
            {loyaltyForm.actionType === 'b2p_referral' && (
              <div className="space-y-2 p-4 sm:p-5 bg-emerald-50/50 border border-emerald-100 rounded-2xl animate-in fade-in slide-in-from-top-2">
                <label className="text-[10px] sm:text-[11px] font-bold text-emerald-800 uppercase tracking-widest">Referred Billed Amount</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-600/50 font-bold text-sm">₹</span>
                  <Input 
                    type="number"
                    className="h-11 sm:h-12 text-sm font-bold border-emerald-200 focus-visible:ring-emerald-500 rounded-xl bg-white pl-9 shadow-sm" 
                    placeholder="e.g. 50000"
                    value={loyaltyForm.billedAmount} 
                    onChange={handleBilledAmountChange} 
                  />
                </div>
                <p className="text-[9px] sm:text-[10px] text-emerald-600 font-semibold mt-2 flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5"/> Automatically calculates 5% for the wallet.</p>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">
                {loyaltyForm.actionType === 'manual_deduct' ? 'Amount to Deduct' : 'Amount to Credit'}
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-xl">₹</span>
                <Input 
                  type="number"
                  readOnly={loyaltyForm.actionType === 'exhibition' || loyaltyForm.actionType === 'b2p_referral'}
                  className={cn(
                    "h-14 sm:h-16 text-xl sm:text-2xl font-black border-gray-200/60 focus-visible:ring-emerald-500 rounded-2xl shadow-sm bg-gray-50 pl-10 transition-colors", 
                    loyaltyForm.actionType === 'manual_deduct' ? 'text-red-600 focus:bg-white' : 'text-emerald-600 focus:bg-white'
                  )} 
                  placeholder="0"
                  value={loyaltyForm.amount} 
                  onChange={(e) => setLoyaltyForm({...loyaltyForm, amount: e.target.value})} 
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Internal Note (Optional)</label>
              <Input 
                className="h-11 sm:h-12 text-sm font-medium border-gray-200/60 bg-gray-50 hover:bg-gray-100 focus:bg-white focus-visible:ring-emerald-500 rounded-xl shadow-sm transition-colors" 
                placeholder="E.g. Referral for Invoice #1024" 
                value={loyaltyForm.notes} 
                onChange={(e) => setLoyaltyForm({...loyaltyForm, notes: e.target.value})} 
              />
            </div>
            
            {selectedCustomer && loyaltyForm.amount && (
              <div className="p-4 sm:p-5 bg-gray-50/80 rounded-2xl border border-gray-200/60 flex justify-between items-center text-sm animate-in fade-in mt-4">
                <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-widest text-gray-500">Resulting Balance:</span>
                <span className="text-base sm:text-lg font-black text-gray-900 tracking-tight">
                  ₹{loyaltyForm.actionType === 'manual_deduct' 
                    ? Math.max(0, (Number(selectedCustomer.store_credit_balance) || 0) - Number(loyaltyForm.amount)).toLocaleString()
                    : ((Number(selectedCustomer.store_credit_balance) || 0) + Number(loyaltyForm.amount)).toLocaleString()
                  }
                </span>
              </div>
            )}
          </div>
          <DialogFooter className="bg-gray-50/80 p-5 sm:p-6 border-t border-gray-100 flex flex-col sm:flex-row gap-3 shrink-0 pb-safe">
            <Button variant="ghost" className="w-full sm:flex-1 h-12 rounded-[16px] text-xs font-bold uppercase tracking-widest text-gray-500 hover:bg-gray-200 transition-colors px-6" onClick={() => setIsLoyaltyModalOpen(false)}>Cancel</Button>
            <Button disabled={isSubmitting || !loyaltyForm.amount} className="w-full sm:flex-[2] h-12 rounded-[16px] text-xs font-bold uppercase tracking-widest bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-200 transition-all active:scale-95" onClick={handleUpdateLoyalty}>
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : 'Confirm Update'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ADD LEAD / CUSTOMER REGISTRATION MODAL */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="w-full sm:max-w-[550px] border-none sm:rounded-[28px] rounded-t-[28px] rounded-b-none sm:rounded-b-[28px] bg-white shadow-[0_-10px_40px_rgba(0,0,0,0.1)] sm:shadow-[0_24px_60px_-15px_rgba(0,0,0,0.15)] p-0 overflow-hidden flex flex-col mt-auto sm:mt-0 mb-0 sm:mb-auto max-h-[90vh]">
          <DialogHeader className="bg-gray-50/80 p-6 sm:p-8 border-b border-gray-100 shrink-0">
            <DialogTitle className="text-xl font-black text-gray-900 flex items-center gap-2.5 tracking-tight">
              <UserPlus className="w-5 h-5 text-blue-600" strokeWidth={2} /> Add New Customer
            </DialogTitle>
            <DialogDescription className="text-xs font-medium text-gray-500 mt-1.5">Branch Context: <span className="font-bold text-gray-800">{selectedLocation === 'ALL' ? 'GLOBAL HQ' : warehouses.find(w => w.id === selectedLocation)?.name}</span></DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 p-6 sm:p-8 overflow-y-auto custom-scrollbar bg-white flex-1">
            <div className="space-y-2 col-span-1 sm:col-span-2">
              <label className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Full Name <span className="text-red-500">*</span></label>
              <Input className="h-11 sm:h-12 rounded-[14px] text-sm font-semibold bg-gray-50 border border-gray-200/60 hover:bg-gray-100 focus:bg-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all shadow-sm px-4" placeholder="E.g. Rahul Sharma" value={newCustForm.full_name} onChange={(e) => setNewCustForm({...newCustForm, full_name: e.target.value})} />
            </div>
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Phone <span className="text-red-500">*</span></label>
              <Input className="h-11 sm:h-12 rounded-[14px] text-sm font-bold font-mono bg-gray-50 border border-gray-200/60 hover:bg-gray-100 focus:bg-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all shadow-sm px-4" placeholder="10 digits" value={newCustForm.phone} onChange={(e) => setNewCustForm({...newCustForm, phone: e.target.value})} />
            </div>
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1.5"><Mail className="w-3.5 h-3.5"/> Email (Optional)</label>
              <Input type="email" className="h-11 sm:h-12 rounded-[14px] text-sm font-medium bg-gray-50 border border-gray-200/60 hover:bg-gray-100 focus:bg-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all shadow-sm px-4" placeholder="email@example.com" value={newCustForm.email || ''} onChange={(e) => setNewCustForm({...newCustForm, email: e.target.value})} />
            </div>
            <div className="space-y-2 col-span-1 sm:col-span-2">
              <label className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">City</label>
              <Input className="h-11 sm:h-12 rounded-[14px] text-sm font-medium bg-gray-50 border border-gray-200/60 hover:bg-gray-100 focus:bg-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all shadow-sm px-4" placeholder="Mumbai" value={newCustForm.city} onChange={(e) => setNewCustForm({...newCustForm, city: e.target.value})} />
            </div>
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5"/> D.O.B <span className="text-red-500">*</span></label>
              <Input type="date" required className="h-11 sm:h-12 rounded-[14px] text-[13px] font-medium text-gray-700 bg-white border border-gray-200/60 hover:bg-gray-50 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all shadow-sm px-4" value={newCustForm.birth_date} onChange={(e) => setNewCustForm({...newCustForm, birth_date: e.target.value})} />
            </div>
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5"/> Anniversary (Optional)</label>
              <Input type="date" className="h-11 sm:h-12 rounded-[14px] text-[13px] font-medium text-gray-700 bg-white border border-gray-200/60 hover:bg-gray-50 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all shadow-sm px-4" value={newCustForm.anniversary_date} onChange={(e) => setNewCustForm({...newCustForm, anniversary_date: e.target.value})} />
            </div>
            <div className="col-span-1 sm:col-span-2 bg-blue-50/50 border border-blue-100 rounded-[20px] p-4 sm:p-5 mt-2">
              <label className="text-[10px] font-black text-blue-900 uppercase tracking-widest mb-3 sm:mb-4 block flex items-center gap-2"><Clock className="w-3.5 h-3.5 text-blue-500" strokeWidth={2.5}/> Initial Follow-up Strategy</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-5">
                 <div className="space-y-2">
                   <label className="text-[10px] font-bold text-blue-700 uppercase tracking-widest">Date to contact</label>
                   <Input type="date" className="h-11 sm:h-12 rounded-[14px] text-[13px] font-medium text-gray-700 bg-white border border-blue-200 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all shadow-sm px-4" value={newCustForm.next_followup_date} onChange={(e) => setNewCustForm({...newCustForm, next_followup_date: e.target.value})} />
                 </div>
                 <div className="space-y-2">
                   <label className="text-[10px] font-bold text-blue-700 uppercase tracking-widest">Reason / Goal</label>
                   <Input className="h-11 sm:h-12 rounded-[14px] text-sm font-medium bg-white border border-blue-200 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all shadow-sm px-4" placeholder="E.g. Wants bridal sets" value={newCustForm.followup_reason} onChange={(e) => setNewCustForm({...newCustForm, followup_reason: e.target.value})} />
                 </div>
              </div>
            </div>
          </div>
          <DialogFooter className="bg-gray-50/80 p-5 sm:p-6 border-t border-gray-100 flex flex-col sm:flex-row gap-3 shrink-0 pb-safe">
            <Button variant="ghost" className="w-full sm:flex-1 h-12 rounded-[16px] text-xs font-bold uppercase tracking-widest text-gray-500 hover:bg-gray-200 transition-colors px-6" onClick={() => setIsAddModalOpen(false)}>Cancel</Button>
            <Button disabled={isSubmitting || !newCustForm.full_name || !newCustForm.phone || !newCustForm.birth_date} className="w-full sm:flex-[2] h-12 rounded-[16px] text-xs font-bold uppercase tracking-widest bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-200 transition-all active:scale-95" onClick={handleAddCustomer}>
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : 'Save Profile'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* KITTY REGISTRATION MODAL WITH REFERRAL SYSTEM */}
      <Dialog open={isAddKittyModalOpen} onOpenChange={setIsAddKittyModalOpen}>
        <DialogContent className="w-full sm:max-w-[550px] border-none sm:rounded-[28px] rounded-t-[28px] rounded-b-none sm:rounded-b-[28px] bg-white shadow-[0_-10px_40px_rgba(0,0,0,0.1)] sm:shadow-[0_24px_60px_-15px_rgba(0,0,0,0.15)] p-0 overflow-hidden flex flex-col mt-auto sm:mt-0 mb-0 sm:mb-auto max-h-[90vh]">
          <DialogHeader className="bg-purple-50/80 p-6 sm:p-8 border-b border-purple-100 shrink-0">
            <DialogTitle className="text-xl font-black flex items-center gap-2.5 text-purple-900 tracking-tight">
              <Gem className="w-5 h-5 text-purple-600" strokeWidth={2}/> Start Diamond Kitty Plan
            </DialogTitle>
            <DialogDescription className="text-xs font-medium text-purple-700/70 mt-1.5">Enroll a new member and assign referral bonuses.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 p-6 sm:p-8 overflow-y-auto custom-scrollbar bg-white flex-1">
            <div className="space-y-2 col-span-1 sm:col-span-2">
              <label className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Full Name <span className="text-red-500">*</span></label>
              <Input className="h-11 sm:h-12 rounded-[14px] text-sm font-semibold bg-gray-50 border border-gray-200/60 hover:bg-gray-100 focus:bg-white focus:ring-4 focus:ring-purple-500/10 focus:border-purple-500 transition-all shadow-sm px-4" placeholder="Member Name" value={newKittyForm.full_name} onChange={(e) => setNewKittyForm({...newKittyForm, full_name: e.target.value})} />
            </div>
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Phone <span className="text-red-500">*</span></label>
              <Input className="h-11 sm:h-12 rounded-[14px] text-sm font-bold font-mono bg-gray-50 border border-gray-200/60 hover:bg-gray-100 focus:bg-white focus:ring-4 focus:ring-purple-500/10 focus:border-purple-500 transition-all shadow-sm px-4" placeholder="10 digits" value={newKittyForm.phone} onChange={(e) => setNewKittyForm({...newKittyForm, phone: e.target.value})} />
            </div>
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1.5"><Mail className="w-3.5 h-3.5"/> Email (Optional)</label>
              <Input type="email" className="h-11 sm:h-12 rounded-[14px] text-sm font-medium bg-gray-50 border border-gray-200/60 hover:bg-gray-100 focus:bg-white focus:ring-4 focus:ring-purple-500/10 focus:border-purple-500 transition-all shadow-sm px-4" placeholder="email@example.com" value={newKittyForm.email || ''} onChange={(e) => setNewKittyForm({...newKittyForm, email: e.target.value})} />
            </div>
            <div className="space-y-2 col-span-1 sm:col-span-2">
              <label className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">City</label>
              <Input className="h-11 sm:h-12 rounded-[14px] text-sm font-medium bg-gray-50 border border-gray-200/60 hover:bg-gray-100 focus:bg-white focus:ring-4 focus:ring-purple-500/10 focus:border-purple-500 transition-all shadow-sm px-4" placeholder="Mumbai" value={newKittyForm.city} onChange={(e) => setNewKittyForm({...newKittyForm, city: e.target.value})} />
            </div>
            
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5"/> D.O.B <span className="text-red-500">*</span></label>
              <Input type="date" required className="h-11 sm:h-12 rounded-[14px] text-[13px] font-medium text-gray-700 bg-white border border-gray-200/60 hover:bg-gray-50 focus:ring-4 focus:ring-purple-500/10 focus:border-purple-500 transition-all shadow-sm px-4" value={newKittyForm.birth_date || ''} onChange={(e) => setNewKittyForm({...newKittyForm, birth_date: e.target.value})} />
            </div>
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5"/> Anniversary (Optional)</label>
              <Input type="date" className="h-11 sm:h-12 rounded-[14px] text-[13px] font-medium text-gray-700 bg-white border border-gray-200/60 hover:bg-gray-50 focus:ring-4 focus:ring-purple-500/10 focus:border-purple-500 transition-all shadow-sm px-4" value={newKittyForm.anniversary_date || ''} onChange={(e) => setNewKittyForm({...newKittyForm, anniversary_date: e.target.value})} />
            </div>

            {/* --- REFERRAL SYSTEM BLOCK --- */}
            <div className="col-span-1 sm:col-span-2 bg-indigo-50/80 p-4 sm:p-5 rounded-[20px] border border-indigo-100 mt-2 space-y-4 sm:space-y-5">
              <label className="text-[11px] font-black text-indigo-900 uppercase block tracking-widest flex items-center gap-2">
                <Users className="w-4 h-4 text-indigo-500" /> Referral Injection
              </label>
              
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-indigo-700 uppercase tracking-widest">Referred By (Existing Customer)</label>
                <Select value={newKittyForm.referred_by_id} onValueChange={(val) => setNewKittyForm({...newKittyForm, referred_by_id: val})}>
                   <SelectTrigger className="h-11 sm:h-12 bg-white border-indigo-200 font-bold text-sm rounded-[14px] shadow-sm focus:ring-4 focus:ring-indigo-500/10 px-4">
                     <SelectValue placeholder="No Referral" />
                   </SelectTrigger>
                   <SelectContent className="rounded-[16px] border-indigo-100 shadow-xl max-h-60 p-1">
                     <SelectItem value="none" className="text-sm font-medium italic text-gray-400 py-2.5 rounded-lg">No Referral</SelectItem>
                     <Separator className="bg-indigo-50 my-1"/>
                     {customers.map(c => (
                       <SelectItem key={c.id} value={c.id} className="text-sm font-bold text-gray-800 py-2.5 rounded-lg focus:bg-indigo-50 focus:text-indigo-700">{c.full_name} ({c.phone.slice(-4)})</SelectItem>
                     ))}
                   </SelectContent>
                </Select>
              </div>

              {newKittyForm.referred_by_id !== 'none' && (
                <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                  <label className="text-[10px] font-bold text-indigo-700 uppercase tracking-widest">Bonus Credit for Referrer</label>
                  <Select value={newKittyForm.referral_bonus} onValueChange={(val) => setNewKittyForm({...newKittyForm, referral_bonus: val})}>
                     <SelectTrigger className="h-11 sm:h-12 bg-white border-indigo-200 font-black text-indigo-700 text-sm rounded-[14px] shadow-sm focus:ring-4 focus:ring-indigo-500/10 px-4">
                       <SelectValue />
                     </SelectTrigger>
                     <SelectContent className="rounded-[16px] border-indigo-100 shadow-xl p-1">
                       <SelectItem value="500" className="text-sm font-bold text-emerald-600 py-2.5 rounded-lg focus:bg-emerald-50">₹500 (1st to 6th Referral)</SelectItem>
                       <SelectItem value="1000" className="text-sm font-bold text-emerald-600 py-2.5 rounded-lg focus:bg-emerald-50">₹1000 (7th Referral Onwards)</SelectItem>
                     </SelectContent>
                  </Select>
                  <p className="text-[10px] text-indigo-600/70 font-semibold mt-1.5 flex items-center gap-1.5"><CheckCircle2 className="w-3 h-3"/> Credits will be instantly deposited into the referrer's wallet.</p>
                </div>
              )}
            </div>

            {/* SCHEME PARAMETERS */}
            <div className="col-span-1 sm:col-span-2 bg-purple-50/80 p-4 sm:p-5 rounded-[20px] border border-purple-100 mt-2 space-y-4 sm:space-y-5">
               <label className="text-[11px] font-black text-purple-900 uppercase block tracking-widest flex items-center gap-2">
                 <Database className="w-4 h-4 text-purple-500" /> Scheme Parameters
               </label>
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
                 <div className="space-y-2">
                   <label className="text-[10px] font-bold text-purple-700 uppercase tracking-widest">Monthly Amount (₹)</label>
                   <Select value={newKittyForm.monthly_amount} onValueChange={(val) => setNewKittyForm({...newKittyForm, monthly_amount: val})}>
                      <SelectTrigger className="h-11 sm:h-12 bg-white border-purple-200 font-bold text-sm rounded-[14px] shadow-sm focus:ring-4 focus:ring-purple-500/10 px-4">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-[16px] border-purple-100 shadow-xl p-1">
                        <SelectItem value="2000" className="text-sm font-medium py-2.5 rounded-lg focus:bg-purple-50">₹ 2,000 / month</SelectItem>
                        <SelectItem value="3000" className="text-sm font-medium py-2.5 rounded-lg focus:bg-purple-50">₹ 3,000 / month</SelectItem>
                        <SelectItem value="5000" className="text-sm font-black text-purple-700 py-2.5 rounded-lg bg-purple-50/50 focus:bg-purple-100">₹ 5,000 / month</SelectItem>
                        <SelectItem value="10000" className="text-sm font-medium py-2.5 rounded-lg focus:bg-purple-50">₹ 10,000 / month</SelectItem>
                      </SelectContent>
                   </Select>
                 </div>
                 <div className="space-y-2">
                   <label className="text-[10px] font-bold text-purple-700 uppercase tracking-widest flex items-center gap-1.5"><Calendar className="w-3 h-3"/> Enrollment Date</label>
                   <Input type="date" className="h-11 sm:h-12 text-[13px] font-medium text-gray-700 bg-white border-purple-200 rounded-[14px] shadow-sm focus:ring-4 focus:ring-purple-500/10 px-4" value={newKittyForm.start_date} onChange={(e) => setNewKittyForm({...newKittyForm, start_date: e.target.value})} />
                 </div>
               </div>
            </div>
          </div>
          <DialogFooter className="bg-gray-50/80 p-5 sm:p-6 border-t border-gray-100 flex flex-col sm:flex-row gap-3 shrink-0 pb-safe">
            <Button variant="ghost" className="w-full sm:flex-1 h-12 rounded-[16px] text-xs font-bold uppercase tracking-widest text-gray-500 hover:bg-gray-200 transition-colors px-6" onClick={() => setIsAddKittyModalOpen(false)}>Cancel</Button>
            <Button disabled={isSubmitting || !newKittyForm.full_name || !newKittyForm.phone || !newKittyForm.birth_date} className="w-full sm:flex-[2] h-12 rounded-[16px] text-xs font-bold uppercase tracking-widest bg-purple-600 hover:bg-purple-700 text-white shadow-md shadow-purple-200 transition-all active:scale-95" onClick={handleAddKittyMember}>
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Gem className="w-4 h-4 mr-2" strokeWidth={2.5}/>}
              Confirm Enrollment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 4. SCHEDULE MODAL */}
      <Dialog open={isFollowupModalOpen} onOpenChange={setIsFollowupModalOpen}>
        <DialogContent className="w-full sm:max-w-[400px] border-none sm:rounded-[28px] rounded-t-[28px] rounded-b-none sm:rounded-b-[28px] bg-white shadow-[0_-10px_40px_rgba(0,0,0,0.1)] sm:shadow-[0_24px_60px_-15px_rgba(0,0,0,0.15)] p-0 overflow-hidden flex flex-col mt-auto sm:mt-0 mb-0 sm:mb-auto max-h-[90vh]">
          <DialogHeader className="bg-gray-50/80 p-6 sm:p-8 border-b border-gray-100 shrink-0">
            <DialogTitle className="text-xl font-black text-gray-900 flex items-center gap-2.5 tracking-tight">
              <Calendar className="w-5 h-5 text-blue-600" strokeWidth={2} /> Schedule Follow-up
            </DialogTitle>
            <DialogDescription className="text-xs font-medium text-gray-500 mt-1.5">For <span className="font-bold text-gray-800">{selectedCustomer?.full_name}</span></DialogDescription>
          </DialogHeader>
          <div className="space-y-5 p-6 sm:p-8 bg-white overflow-y-auto custom-scrollbar flex-1">
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">1. Goal / Reason</label>
              <Input 
                className="h-12 rounded-[14px] text-sm font-semibold bg-gray-50 border border-gray-200/60 focus:bg-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all shadow-sm px-4" 
                placeholder="E.g. Wants to buy a bridal set" 
                value={followupReason} onChange={(e) => setFollowupReason(e.target.value)} 
              />
            </div>
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">2. Next Action Date</label>
              <Input type="date" className="h-12 rounded-[14px] text-[13px] font-medium text-gray-700 bg-white border border-gray-200/60 hover:bg-gray-50 focus:bg-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all shadow-sm px-4" value={followupDate} onChange={(e) => setFollowupDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">3. Notes (Optional)</label>
              <textarea 
                className="w-full min-h-[100px] p-4 text-sm font-medium bg-gray-50 border border-gray-200/60 rounded-[16px] focus:bg-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none resize-none shadow-sm transition-all text-gray-800"
                placeholder="Any previous context..." 
                value={interactionNotes} onChange={(e) => setInteractionNotes(e.target.value)} 
              />
            </div>
          </div>
          <DialogFooter className="bg-gray-50/80 p-5 sm:p-6 border-t border-gray-100 flex flex-col sm:flex-row gap-3 shrink-0 pb-safe">
            <Button variant="ghost" className="w-full sm:flex-1 h-12 rounded-[16px] text-xs font-bold uppercase tracking-widest text-gray-500 hover:bg-gray-200 transition-colors px-6" onClick={() => setIsFollowupModalOpen(false)}>Cancel</Button>
            <Button disabled={isSubmitting} className="w-full sm:flex-[2] h-12 rounded-[16px] text-xs font-bold uppercase tracking-widest bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-200 transition-all active:scale-95" onClick={handleUpdateFollowup}>
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : 'Save Schedule'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 5. WHATSAPP MODAL */}
      <Dialog open={isWhatsAppModalOpen} onOpenChange={setIsWhatsAppModalOpen}>
        <DialogContent className="w-full sm:max-w-[500px] border-none sm:rounded-[28px] rounded-t-[28px] rounded-b-none sm:rounded-b-[28px] bg-white shadow-[0_-10px_40px_rgba(0,0,0,0.1)] sm:shadow-[0_24px_60px_-15px_rgba(0,0,0,0.15)] p-0 overflow-hidden flex flex-col mt-auto sm:mt-0 mb-0 sm:mb-auto max-h-[90vh]">
          <DialogHeader className="bg-[#25D366]/5 p-6 sm:p-8 border-b border-[#25D366]/20 shrink-0">
            <DialogTitle className="text-xl font-black flex items-center gap-2.5 text-[#1DA851] tracking-tight">
              <MessageCircle className="w-5 h-5" strokeWidth={2.5} /> Campaign Message
            </DialogTitle>
            <DialogDescription className="text-xs font-medium text-gray-500 mt-1.5">To: <span className="font-bold text-gray-800">{selectedCustomer?.full_name}</span> ({selectedCustomer?.phone})</DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 p-6 sm:p-8 bg-white overflow-y-auto custom-scrollbar flex-1">
            <div className="space-y-2.5">
              <label className="text-[11px] font-bold text-gray-500 uppercase tracking-widest flex items-center justify-between">
                <span>1. Select Template</span>
                {activeAiFilter !== 'none' && <Badge variant="outline" className="text-[9px] font-bold h-5 bg-blue-50 text-blue-600 border-none uppercase tracking-wider rounded-md px-2 py-0">Auto-Selected</Badge>}
              </label>
              <Select value={waTemplateId} onValueChange={handleTemplateChange}>
                <SelectTrigger className="h-12 rounded-[14px] text-sm font-semibold bg-gray-50 border border-gray-200/60 hover:bg-gray-100 focus:bg-white focus:ring-4 focus:ring-[#25D366]/10 focus:border-[#25D366] transition-all shadow-sm px-4">
                  <SelectValue placeholder="Choose a template" />
                </SelectTrigger>
                <SelectContent className="rounded-[16px] shadow-xl border-gray-100 p-1">
                  {availableTemplates.length === 0 ? (
                    <SelectItem value="none" disabled className="text-sm italic text-gray-400 py-3 rounded-lg">No templates configured.</SelectItem>
                  ) : (
                    availableTemplates.map(t => (
                      <SelectItem key={t.template_id} value={t.template_id} className="text-sm font-semibold py-2.5 rounded-lg cursor-pointer focus:bg-[#25D366]/10 focus:text-[#1DA851]">{t.label}</SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2.5">
              <label className="text-[11px] font-bold text-gray-500 uppercase tracking-widest flex justify-between items-end">
                <span>2. Customize Message</span>
                <span className="text-gray-400 font-semibold lowercase text-[10px]">Editable</span>
              </label>
              <div className="relative">
                <textarea 
                  className="w-full min-h-[180px] p-5 text-sm font-medium bg-gray-50 border border-gray-200/60 rounded-[16px] focus:bg-white focus:ring-4 focus:ring-[#25D366]/10 focus:border-[#25D366] outline-none shadow-inner resize-none leading-relaxed text-gray-800 transition-all"
                  placeholder="Type your message here..."
                  value={customMessage}
                  onChange={(e) => setCustomMessage(e.target.value)}
                />
              </div>
            </div>
          </div>

          <DialogFooter className="bg-gray-50/80 p-5 sm:p-6 border-t border-gray-100 flex flex-col sm:flex-row gap-3 shrink-0 pb-safe">
            <Button variant="ghost" className="w-full sm:flex-1 h-12 rounded-[16px] text-xs font-bold uppercase tracking-widest text-gray-500 hover:bg-gray-200 transition-colors px-6" onClick={() => setIsWhatsAppModalOpen(false)}>Cancel</Button>
            <Button className="w-full sm:flex-[2] h-12 rounded-[16px] text-xs font-bold uppercase tracking-widest bg-[#25D366] hover:bg-[#1DA851] text-white shadow-md shadow-[#25D366]/20 transition-all active:scale-95" onClick={handleSendWhatsApp}>
              <MessageCircle className="w-4 h-4 mr-2" strokeWidth={2.5}/> Send via WhatsApp
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}