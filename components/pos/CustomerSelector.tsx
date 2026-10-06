"use client"

import React, { useState, useEffect, useMemo } from 'react'
import { Search, Plus, X, IndianRupee, Gem, Info, Loader2, AlertCircle, Edit2, Award, MessageCircle } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabaseClient' 

interface CustomerSelectorProps {
  mode: string
  customers: any[] 
  setCustomers: React.Dispatch<React.SetStateAction<any[]>>
  selectedCustomer: any
  setSelectedCustomer: (customer: any) => void
  appUser?: any 
  selectedLocation?: string
  subtotal?: number 
  loyaltySettings?: any 
  liveLoyaltyData?: { id: string, total_points: number } | null 
  onApplyWallet?: (type: 'credit' | 'kitty' | 'points', availableAmount: number, planId?: string, rawAmount?: number) => void 
}

const formatToDBDate = (dateStr?: string) => {
  if (!dateStr) return null;
  const parts = dateStr.split('-');
  if (parts.length === 3) {
     const d = parts[0].padStart(2, '0');
     const m = parts[1].padStart(2, '0');
     let y = parts[2];
     if (y.length === 2) y = parseInt(y) > 30 ? `19${y}` : `20${y}`;
     if (y.length === 4) return `${y}-${m}-${d}`;
  }
  return null; 
};

const formatToDisplayDate = (dbDateStr?: string) => {
  if (!dbDateStr) return '';
  const parts = dbDateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }
  return dbDateStr;
};

export function CustomerSelector({ 
  mode, setCustomers, selectedCustomer, setSelectedCustomer, appUser, selectedLocation, subtotal = 0, loyaltySettings, liveLoyaltyData, onApplyWallet 
}: CustomerSelectorProps) {
  
  const [searchCustomer, setSearchCustomer] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [isSearching, setIsSearching] = useState(false)
  
  const [isAddCustomerOpen, setIsAddCustomerOpen] = useState(false)
  const [isEditMode, setIsEditMode] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  
  const [newCustForm, setNewCustForm] = useState({ 
    full_name: '', phone: '', email: '', city: '', address: '', pan_no: '', birth_date: '', anniversary_date: '' 
  })

  // ✨ OTP & Claim State Management
  const [showOtpModal, setShowOtpModal] = useState(false)
  const [otpStep, setOtpStep] = useState<'send' | 'verify'>('send')
  const [otpCode, setOtpCode] = useState('')
  const [otpTimer, setOtpTimer] = useState(0)
  const [isOtpLoading, setIsOtpLoading] = useState(false)
  const [pendingRedemption, setPendingRedemption] = useState<{ neededRs: number, id: string | undefined, pointsToBurn: number } | null>(null)
  
  // Track if points have already been verified and claimed for this transaction
  const [isLoyaltyClaimed, setIsLoyaltyClaimed] = useState(false)

  // Reset claim state if a new customer is selected
  useEffect(() => {
    setIsLoyaltyClaimed(false);
    setOtpTimer(0);
    setOtpCode('');
  }, [selectedCustomer?.id]);

  useEffect(() => {
    const searchDatabase = async () => {
      const term = searchCustomer.trim();
      if (!term || !appUser?.company_id) {
        searchResults.length > 0 && setSearchResults([]);
        setIsSearching(false);
        return;
      }

      setIsSearching(true);
      try {
        const { data, error } = await supabase
          .from('customers')
          .select('*, kitty_plans(*)')
          .eq('company_id', appUser.company_id)
          .or(`full_name.ilike.%${term}%,phone.ilike.%${term}%`)
          .limit(15); 

        if (error) throw error;
        setSearchResults(data || []);
      } catch (err) {
        console.error("Search failed:", err);
      } finally {
        setIsSearching(false);
      }
    };

    const timer = setTimeout(() => searchDatabase(), 300);
    return () => clearTimeout(timer);
  }, [searchCustomer, appUser]);

  const completionStats = useMemo(() => {
    if (!selectedCustomer) return { percentage: 0, missing: [] };
    
    const fields = [
      { key: 'full_name', label: 'Name' },
      { key: 'phone', label: 'Phone' },
      { key: 'email', label: 'Email' },
      { key: 'birth_date', label: 'Birthday' },
      { key: 'anniversary_date', label: 'Anniversary' },
      { key: 'city', label: 'City' },
      { key: 'address', label: 'Address' },
      { key: 'pan_no', label: 'PAN Number' }
    ];

    const filled = fields.filter(f => !!selectedCustomer[f.key]);
    const missing = fields.filter(f => !selectedCustomer[f.key]);
    
    return {
      percentage: Math.round((filled.length / fields.length) * 100),
      missing: missing.map(m => m.label)
    };
  }, [selectedCustomer]);

  const handleDateInput = (field: 'birth_date' | 'anniversary_date', value: string) => {
    if (newCustForm[field].length > value.length) {
      setNewCustForm(prev => ({ ...prev, [field]: value }));
      return;
    }
    const digits = value.replace(/\D/g, ''); 
    let formatted = digits;
    if (digits.length > 2 && digits.length <= 4) {
      formatted = `${digits.slice(0, 2)}-${digits.slice(2)}`;
    } else if (digits.length > 4) {
      formatted = `${digits.slice(0, 2)}-${digits.slice(2, 4)}-${digits.slice(4, 8)}`;
    }
    setNewCustForm(prev => ({ ...prev, [field]: formatted }));
  }

  const openNewCustomerModal = () => {
    setIsEditMode(false);
    setNewCustForm({ full_name: '', phone: '', email: '', city: '', address: '', pan_no: '', birth_date: '', anniversary_date: '' });
    setIsAddCustomerOpen(true);
  }

  const openEditCustomerModal = () => {
    if (!selectedCustomer) return;
    setIsEditMode(true);
    setNewCustForm({
      full_name: selectedCustomer.full_name || '',
      phone: selectedCustomer.phone || '',
      email: selectedCustomer.email || '',
      city: selectedCustomer.city || '',
      address: selectedCustomer.address || '',
      pan_no: selectedCustomer.pan_no || '',
      birth_date: formatToDisplayDate(selectedCustomer.birth_date),
      anniversary_date: formatToDisplayDate(selectedCustomer.anniversary_date)
    });
    setIsAddCustomerOpen(true);
  }

  const handleSaveCustomer = async () => {
    if (!newCustForm.full_name || !newCustForm.phone) {
      return toast.error('Name and Phone are required.')
    }
    if (!selectedLocation || selectedLocation === 'ALL') {
      return toast.error('Please select a specific branch terminal first.')
    }

    const finalBirthDate = formatToDBDate(newCustForm.birth_date);
    if (newCustForm.birth_date && !finalBirthDate) return toast.error('Invalid Birth Date. Please use DD-MM-YYYY format.');

    const finalAnnivDate = formatToDBDate(newCustForm.anniversary_date);
    if (newCustForm.anniversary_date && !finalAnnivDate) return toast.error('Invalid Anniversary Date. Please use DD-MM-YYYY format.');

    setIsSaving(true)
    try {
      const payload: any = {
        full_name: newCustForm.full_name,
        phone: newCustForm.phone,
        email: newCustForm.email || null,
        city: newCustForm.city || null,
        address: newCustForm.address || null,
        pan_no: newCustForm.pan_no?.toUpperCase() || null,
        birth_date: finalBirthDate,
        anniversary_date: finalAnnivDate
      };

      if (isEditMode && selectedCustomer?.id) {
        const { data, error } = await supabase
          .from('customers')
          .update(payload)
          .eq('id', selectedCustomer.id)
          .select('*, kitty_plans(*)')
          .single();

        if (error) throw error;
        setSelectedCustomer(data);
        toast.success('Customer profile updated successfully.');
      } else {
        payload.company_id = appUser?.company_id;
        payload.warehouse_id = selectedLocation;
        
        const { data, error } = await supabase
          .from('customers')
          .insert([payload])
          .select('*, kitty_plans(*)')
          .single();

        if (error) throw error;
        setCustomers(prev => [...prev, data]);
        setSelectedCustomer(data);
        setSearchCustomer('');
        toast.success('New client registered successfully.');
      }
      
      setIsAddCustomerOpen(false)
    } catch (err: any) {
      toast.error(err.message || 'Failed to save customer.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleKittyRedemption = (plan: any) => {
    const monthlyAmt = Number(plan.plan_amount) || 0;
    const monthsPaid = Number(plan.months_paid) || 0;
    const totalMonths = Number(plan.total_months) || 12;
    
    const rawBonus = Number(plan.bonus_amount);
    const planBonus = !isNaN(rawBonus) ? rawBonus : (monthlyAmt >= 3000 ? monthlyAmt : 0);
    
    let totalRedemptionValue = monthsPaid * monthlyAmt;
    
    let bonusApplied = false;
    if (monthsPaid >= totalMonths) {
      totalRedemptionValue += planBonus; 
      bonusApplied = true;
    }

    if (totalRedemptionValue <= 0) {
      return toast.error("No kitty funds available to redeem.");
    }

    if (subtotal < totalRedemptionValue) {
      toast.error(`Bill amount (₹${subtotal.toLocaleString()}) must be greater than Harvesting Value (₹${totalRedemptionValue.toLocaleString()}) to redeem.`);
      return;
    }

    if (bonusApplied) {
      toast.success("Maturity Bonus Applied!");
    } else {
      toast.info(`Early Redemption: Applied ${monthsPaid} months of paid value.`);
    }

    onApplyWallet?.('kitty', totalRedemptionValue, plan.id);
  }

  const handleCreditRedemption = () => {
    const rawCredit = Number(selectedCustomer.store_credit_balance) || 0;
    if (rawCredit <= 0) return;

    const netUsableCredit = Math.floor(rawCredit * 0.80);
    const deduction = rawCredit - netUsableCredit;

    toast.info("Wallet Applied (Post-Handling Fee)", {
      description: `Original Wallet: ₹${rawCredit.toLocaleString()} | Handling Charge (-20%): ₹${deduction.toLocaleString()} | Usable Discount: ₹${netUsableCredit.toLocaleString()}`
    });

    onApplyWallet?.('credit', netUsableCredit);
  }

  // ✨ Global OTP Timer Logic (Survives modal close)
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (otpTimer > 0) {
      interval = setInterval(() => setOtpTimer((t) => t - 1), 1000);
    }
    return () => clearInterval(interval);
  }, [otpTimer]);

  // ✨ Send OTP via Next.js API
  const handleSendLoyaltyOtp = async () => {
    if (!selectedCustomer?.phone) return toast.error("No valid phone number on customer profile.");
    if (otpTimer > 0) return toast.error(`Please wait ${otpTimer} seconds before requesting a new OTP.`);
    
    setIsOtpLoading(true);
    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: selectedCustomer.phone })
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send OTP");

      setOtpStep('verify');
      setOtpTimer(60);
      setOtpCode('');
      toast.success("Verification code sent via WhatsApp.");
    } catch (error: any) {
      toast.error(error.message || "Failed to send verification code.");
      setShowOtpModal(false);
    } finally {
      setIsOtpLoading(false);
    }
  }

  // ✨ Verify OTP via Next.js API
  const handleVerifyLoyaltyOtp = async () => {
    if (otpCode.length !== 6) return toast.error("Please enter the 6-digit code.");
    setIsOtpLoading(true);
    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: selectedCustomer.phone, otp: otpCode })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Invalid verification code");

      setShowOtpModal(false);
      setOtpCode('');
      
      if (pendingRedemption) {
        onApplyWallet?.('points', pendingRedemption.neededRs, pendingRedemption.id, pendingRedemption.pointsToBurn);
        setIsLoyaltyClaimed(true); // ✨ Lock the button state globally
        toast.success("Identity verified. Loyalty Points applied!", {
          description: `Burning ${pendingRedemption.pointsToBurn.toLocaleString()} Pts | Usable Value: ₹${pendingRedemption.neededRs.toLocaleString()}`
        });
      }
    } catch (error: any) {
      toast.error(error.message || "Invalid verification code.");
    } finally {
      setIsOtpLoading(false);
    }
  }

  // ✨ Global Click Handler for the Button
  const handleLoyaltyRedemptionClick = () => {
    const rawPoints = Number(liveLoyaltyData?.total_points) || 0;
    if (rawPoints <= 0) return;

    const feePct = Number(loyaltySettings?.redemption_fee_pct) || 0;
    const pointValue = Number(loyaltySettings?.point_value_rs) || 1;

    const maxGrossValueRs = rawPoints * pointValue;
    const maxFeeAmountRs = maxGrossValueRs * (feePct / 100);
    const maxUsableRs = Math.floor(maxGrossValueRs - maxFeeAmountRs);

    const neededRs = Math.min(subtotal, maxUsableRs); 

    const multiplier = pointValue * (1 - (feePct / 100));
    const pointsToBurn = Math.ceil(neededRs / multiplier);

    setPendingRedemption({ neededRs, id: liveLoyaltyData?.id, pointsToBurn });
    setShowOtpModal(true);

    // ✨ Enforce the 60s rule gracefully
    if (otpTimer > 0) {
      setOtpStep('verify'); // Just open modal to let them type existing code
    } else {
      setOtpStep('send');
      handleSendLoyaltyOtp();
    }
  }

  const hasActivePlan = selectedCustomer?.kitty_plans && selectedCustomer.kitty_plans.some((p: any) => ['active', 'matured'].includes(p.status));
  const hasLoyaltyPoints = Number(liveLoyaltyData?.total_points) > 0;

  return (
    <div className="space-y-1.5 relative">
      <Label className="text-xs font-semibold text-slate-700">
        {mode === 'challan' ? 'SIS Partner / Destination' : 'Customer Account'}
      </Label>
      
      {selectedCustomer ? (
        <div className="flex flex-col bg-white border border-[#0078D7] p-2.5 rounded-sm shadow-sm transition-all relative overflow-hidden">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <div className="h-9 w-9 mt-0.5 rounded-sm bg-[#0078D7] text-white flex items-center justify-center font-bold text-sm uppercase shadow-inner shrink-0 cursor-pointer hover:bg-[#005A9E] transition-colors" onClick={openEditCustomerModal} title="Edit Customer">
                <Edit2 className="w-4 h-4" />
              </div>
              <div className="flex flex-col">
                <p className="text-sm font-bold text-slate-900 leading-none">{selectedCustomer.full_name || 'Unknown Name'}</p>
                <p className="text-[10px] font-mono text-slate-500 mt-1">{selectedCustomer.phone} {selectedCustomer.email ? `• ${selectedCustomer.email}` : ''}</p>
                
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {(selectedCustomer.customer_status === 'Kitty Member' || hasActivePlan) && (
                    <Badge className="bg-purple-50 text-purple-700 border-purple-200 text-[9px] px-1.5 py-0 h-4 rounded-sm flex items-center gap-1 font-bold">
                      <Gem className="w-2.5 h-2.5" /> Active Kitty
                    </Badge>
                  )}
                  {hasLoyaltyPoints && (
                    <Badge className="bg-amber-50 text-amber-700 border-amber-200 text-[9px] px-1.5 py-0 h-4 rounded-sm flex items-center gap-1 font-bold">
                      <Award className="w-2.5 h-2.5" /> Loyalty Program
                    </Badge>
                  )}
                </div>
              </div>
            </div>
            <Button 
              size="icon" 
              variant="ghost" 
              className="h-6 w-6 rounded-sm text-slate-400 hover:text-red-500 hover:bg-red-50 shrink-0" 
              onClick={() => setSelectedCustomer(null)}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>

          {completionStats.percentage < 100 && (
            <div className="mt-3 pt-2.5 border-t border-orange-100 flex items-center justify-between bg-orange-50/50 -mx-2.5 -mb-2.5 px-3 py-2">
               <div className="flex flex-col gap-0.5">
                  <span className="text-[10px] font-bold text-orange-700 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> Profile {completionStats.percentage}% Complete
                  </span>
                  <span className="text-[9px] font-medium text-orange-600 truncate max-w-[200px]">
                    Missing: {completionStats.missing.slice(0,3).join(', ')}{completionStats.missing.length > 3 ? '...' : ''}
                  </span>
               </div>
               <Button 
                 size="sm" 
                 variant="outline" 
                 className="h-6 text-[10px] font-bold border-orange-200 text-orange-700 bg-white hover:bg-orange-100 shadow-sm" 
                 onClick={openEditCustomerModal}
               >
                 Complete Profile
               </Button>
            </div>
          )}

          {(Number(selectedCustomer.store_credit_balance) > 0 || hasActivePlan || hasLoyaltyPoints) && (
            <div className="flex flex-col gap-1.5 mt-3 pt-3 border-t border-slate-100 w-full">
              
              {selectedCustomer.kitty_plans?.filter((p: any) => ['active', 'matured'].includes(p.status) && p.months_paid > 0).map((plan: any) => {
                const isMatured = plan.months_paid >= plan.total_months;
                const rawBonus = Number(plan.bonus_amount);
                const planBonus = !isNaN(rawBonus) ? rawBonus : (plan.plan_amount >= 3000 ? plan.plan_amount : 0);
                
                const valueToDisplay = isMatured 
                  ? (plan.total_months * plan.plan_amount) + planBonus 
                  : plan.months_paid * plan.plan_amount;

                return (
                  <div 
                    key={plan.id}
                    onClick={() => handleKittyRedemption(plan)}
                    className="flex items-center justify-between w-full bg-purple-50 border border-purple-200 rounded-sm p-2 cursor-pointer hover:bg-purple-100 transition-colors group"
                    title="Redeem Harvesting Plan"
                  >
                    <div className="flex flex-col gap-0.5 text-purple-700">
                      <div className="flex items-center gap-1.5">
                        <Gem className="w-3.5 h-3.5" />
                        <span className="text-[10px] font-bold uppercase tracking-wider">{plan.plan_name}</span>
                      </div>
                      {!isMatured && (
                         <span className="text-[8px] font-semibold text-purple-500 flex items-center gap-1">
                           <Info className="w-2.5 h-2.5" /> Early Redemption ({plan.months_paid} Mths)
                         </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black text-purple-700 tabular-nums">
                        ₹{valueToDisplay.toLocaleString()}
                      </span>
                      <span className="bg-purple-600 text-white text-[9px] font-bold uppercase px-2 py-0.5 rounded-sm opacity-90 group-hover:opacity-100 group-hover:shadow-sm transition-all">Redeem</span>
                    </div>
                  </div>
                );
              })}

              {Number(selectedCustomer.store_credit_balance) > 0 && (
                <div 
                  onClick={handleCreditRedemption}
                  className="flex items-center justify-between w-full bg-emerald-50 border border-emerald-200 rounded-sm p-2 cursor-pointer hover:bg-emerald-100 transition-colors group"
                  title="Click to apply credit (Note: 20% processing fee applies)"
                >
                  <div className="flex flex-col gap-0.5 text-emerald-700">
                    <div className="flex items-center gap-1.5">
                      <IndianRupee className="w-3.5 h-3.5" />
                      <span className="text-[10px] font-bold uppercase tracking-wider">Wallet Credit</span>
                    </div>
                    <span className="text-[8px] font-semibold text-emerald-600 flex items-center gap-1">
                      <Info className="w-2.5 h-2.5" /> 20% Processing Fee Applies
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex flex-col items-end">
                      <span className="text-xs font-black text-emerald-700 tabular-nums leading-none">
                        ₹{Math.floor(Number(selectedCustomer.store_credit_balance) * 0.80).toLocaleString()}
                      </span>
                      <span className="text-[8px] text-emerald-500 line-through">₹{Number(selectedCustomer.store_credit_balance).toLocaleString()}</span>
                    </div>
                    <span className="bg-emerald-600 text-white text-[9px] font-bold uppercase px-2 py-0.5 rounded-sm opacity-90 group-hover:opacity-100 group-hover:shadow-sm transition-all">Redeem</span>
                  </div>
                </div>
              )}

              {/* ✨ UPDATED LOYALTY BUTTON */}
              {hasLoyaltyPoints && (
                <div 
                  onClick={handleLoyaltyRedemptionClick}
                  className={`flex items-center justify-between w-full rounded-sm p-2 cursor-pointer transition-colors group ${
                    isLoyaltyClaimed 
                      ? 'bg-slate-50 border border-slate-200 hover:bg-slate-100' 
                      : 'bg-amber-50 border border-amber-200 hover:bg-amber-100'
                  }`}
                  title={isLoyaltyClaimed ? "Points Applied. Click to re-verify if needed." : "Verify and Redeem Loyalty Points"}
                >
                  <div className={`flex flex-col gap-0.5 ${isLoyaltyClaimed ? 'text-slate-500' : 'text-amber-700'}`}>
                    <div className="flex items-center gap-1.5">
                      <Award className="w-3.5 h-3.5" />
                      <span className="text-[10px] font-bold uppercase tracking-wider">Loyalty Points</span>
                    </div>
                    {Number(loyaltySettings?.redemption_fee_pct) > 0 && (
                      <span className={`text-[8px] font-semibold flex items-center gap-1 ${isLoyaltyClaimed ? 'text-slate-400' : 'text-amber-600'}`}>
                        <Info className="w-2.5 h-2.5" /> {loyaltySettings?.redemption_fee_pct}% Processing Fee Applies
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex flex-col items-end">
                      <span className={`text-xs font-black tabular-nums leading-none ${isLoyaltyClaimed ? 'text-slate-500' : 'text-amber-700'}`}>
                        {Number(liveLoyaltyData?.total_points).toLocaleString()} Pts
                      </span>
                    </div>
                    <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-sm transition-all ${
                      isLoyaltyClaimed 
                        ? 'bg-slate-400 text-white shadow-none' 
                        : 'bg-amber-600 text-white opacity-90 group-hover:opacity-100 group-hover:shadow-sm'
                    }`}>
                      {isLoyaltyClaimed ? 'Claimed' : 'Claim'}
                    </span>
                  </div>
                </div>
              )}

            </div>
          )}
        </div>
      ) : (
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <Input 
              placeholder="Search phone or name..." 
              value={searchCustomer} 
              onChange={(e) => setSearchCustomer(e.target.value)} 
              className="h-9 pl-8 text-xs rounded-sm border-slate-300 bg-white focus-visible:ring-[#0078D7]" 
            />
            {isSearching && (
               <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#0078D7] animate-spin" />
            )}
          </div>
          <Button 
            variant="outline" 
            className="h-9 px-3 rounded-sm border-slate-300 bg-white hover:bg-slate-50 hover:text-[#0078D7]" 
            onClick={openNewCustomerModal}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      )}

      {searchCustomer && !selectedCustomer && !isSearching && (
        <div className="absolute top-full left-0 w-full bg-white border border-slate-300 shadow-lg z-50 max-h-[250px] overflow-y-auto rounded-sm mt-1 custom-scrollbar">
          {searchResults.length > 0 ? (
            searchResults.map(c => {
              const cHasActivePlan = c.kitty_plans && c.kitty_plans.some((p: any) => ['active', 'matured'].includes(p.status));
              
              return (
                <div 
                  key={c.id} 
                  className="p-2.5 border-b border-slate-100 hover:bg-slate-50 cursor-pointer flex justify-between items-center transition-colors" 
                  onClick={() => { setSelectedCustomer(c); setSearchCustomer(''); }}
                >
                  <div className="flex flex-col">
                    <span className="font-semibold text-xs text-slate-700">{c.full_name || 'Unknown Name'}</span>
                    <div className="flex gap-1 mt-0.5">
                      <span className="text-[10px] font-mono text-slate-500">{c.phone || 'No Phone'}</span>
                      {Number(c.store_credit_balance) > 0 && <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-1 rounded-sm ml-1">Credits</span>}
                      {(c.customer_status === 'Kitty Member' || cHasActivePlan) && <span className="text-[9px] font-bold text-purple-600 bg-purple-50 px-1 rounded-sm ml-0.5">Kitty</span>}
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="p-3 text-center text-xs text-slate-500">No matching records found.</div>
          )}
          <div 
            className="p-2.5 text-center text-xs font-bold text-[#0078D7] cursor-pointer hover:bg-blue-50 bg-slate-50 border-t border-slate-100 transition-colors" 
            onClick={openNewCustomerModal}
          >
            + Create New Customer Profile
          </div>
        </div>
      )}

      <Dialog open={isAddCustomerOpen} onOpenChange={setIsAddCustomerOpen}>
        <DialogContent className="sm:max-w-[450px] border border-slate-300 shadow-xl p-0 rounded-sm overflow-hidden bg-white w-[95vw] sm:w-full">
          <DialogHeader className="bg-slate-100 p-4 border-b border-slate-200">
            <DialogTitle className="text-base font-semibold text-slate-800">
              {isEditMode ? 'Update Customer Profile' : 'Add New Customer'}
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 sm:p-5 max-h-[65vh] overflow-y-auto custom-scrollbar">
            
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs font-semibold text-slate-700">Full Name *</Label>
              <Input className="h-9 rounded-sm border-slate-300" value={newCustForm.full_name} onChange={(e) => setNewCustForm({...newCustForm, full_name: e.target.value})} />
            </div>
            
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Phone *</Label>
              <Input className="h-9 rounded-sm border-slate-300" value={newCustForm.phone} onChange={(e) => setNewCustForm({...newCustForm, phone: e.target.value})} />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Email (Optional)</Label>
              <Input type="email" className="h-9 rounded-sm border-slate-300" value={newCustForm.email} onChange={(e) => setNewCustForm({...newCustForm, email: e.target.value})} />
            </div>
            
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">D.O.B (DD-MM-YYYY)</Label>
              <Input 
                type="text" 
                inputMode="numeric"
                placeholder="15-08-1990"
                className="h-9 rounded-sm border-slate-300 font-mono tracking-widest text-sm" 
                value={newCustForm.birth_date} 
                onChange={(e) => handleDateInput('birth_date', e.target.value)} 
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Anniversary (DD-MM-YYYY)</Label>
              <Input 
                type="text" 
                inputMode="numeric"
                placeholder="25-12-2015"
                className="h-9 rounded-sm border-slate-300 font-mono tracking-widest text-sm" 
                value={newCustForm.anniversary_date} 
                onChange={(e) => handleDateInput('anniversary_date', e.target.value)} 
              />
            </div>

            <div className="space-y-1.5 sm:col-span-2 border-t border-slate-100 pt-3">
              <Label className="text-xs font-semibold text-slate-700">Address</Label>
              <Input className="h-9 rounded-sm border-slate-300" value={newCustForm.address} onChange={(e) => setNewCustForm({...newCustForm, address: e.target.value})} />
            </div>
            
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">City</Label>
              <Input className="h-9 rounded-sm border-slate-300" value={newCustForm.city} onChange={(e) => setNewCustForm({...newCustForm, city: e.target.value})} />
            </div>
            
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">PAN Number</Label>
              <Input className="h-9 rounded-sm border-slate-300 uppercase" value={newCustForm.pan_no} onChange={(e) => setNewCustForm({...newCustForm, pan_no: e.target.value})} />
            </div>
          </div>
          <DialogFooter className="p-4 bg-slate-50 border-t border-slate-200">
            <Button variant="ghost" className="rounded-sm text-sm w-full sm:w-auto" onClick={() => setIsAddCustomerOpen(false)}>Cancel</Button>
            <Button 
              onClick={handleSaveCustomer} 
              disabled={isSaving}
              className="rounded-sm text-sm bg-[#0078D7] hover:bg-[#005A9E] text-white px-6 w-full sm:w-auto mt-2 sm:mt-0 shadow-sm"
            >
              {isSaving ? 'Saving...' : (isEditMode ? 'Update Profile' : 'Save Customer')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ✨ Secure OTP Verification Dialog */}
      <Dialog open={showOtpModal} onOpenChange={(open) => !isOtpLoading && setShowOtpModal(open)}>
        <DialogContent className="sm:max-w-[400px] border border-slate-200 shadow-2xl p-6 rounded-xl bg-white">
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="w-12 h-12 bg-amber-50 rounded-full flex items-center justify-center mb-2">
              <MessageCircle className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">Secure Verification</h3>
              <p className="text-sm text-slate-500 mt-1">
                A verification code has been sent to <br />
                <span className="font-bold text-slate-800">+91 {selectedCustomer?.phone}</span>
              </p>
            </div>

            <div className="w-full space-y-4 pt-4">
              <Input 
                type="text" 
                maxLength={6}
                autoFocus
                placeholder="000000" 
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                className="h-12 text-center text-2xl tracking-[0.5em] font-mono font-bold bg-slate-50 border-slate-200"
              />
              
              <Button 
                onClick={handleVerifyLoyaltyOtp} 
                disabled={otpCode.length !== 6 || isOtpLoading}
                className="w-full h-11 bg-amber-600 hover:bg-amber-700 text-white font-bold tracking-wider uppercase"
              >
                {isOtpLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Verify & Claim Points'}
              </Button>

              <div className="text-center pt-2">
                {otpTimer > 0 ? (
                  <span className="text-xs text-slate-400 font-medium">Resend code in {otpTimer}s</span>
                ) : (
                  <button 
                    onClick={handleSendLoyaltyOtp}
                    disabled={isOtpLoading}
                    className="text-xs font-bold text-[#0078D7] hover:underline"
                  >
                    Resend WhatsApp Code
                  </button>
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}