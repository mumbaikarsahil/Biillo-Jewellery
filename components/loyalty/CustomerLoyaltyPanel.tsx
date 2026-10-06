"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Loader2, UploadCloud, Award, UserPlus, FileImage, Hash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

const compressImage = (file: File, maxWidth = 1000, quality = 0.7): Promise<File> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            if (blob) {
              const newFileName = file.name.replace(/\.[^/.]+$/, "") + "_compressed.jpg";
              resolve(new File([blob], newFileName, { type: 'image/jpeg', lastModified: Date.now() }));
            } else reject(new Error('Compression failed'));
          },
          'image/jpeg', quality
        );
      };
      img.onerror = (error) => reject(error);
    };
    reader.onerror = (error) => reject(error);
  });
};

interface CustomerLoyaltyPanelProps {
  customerId: string;
  customerPhone?: string;
  customerName?: string;
  userId?: string;
  warehouseId?: string;
}

export default function CustomerLoyaltyPanel({ customerId, customerPhone, customerName, userId, warehouseId }: CustomerLoyaltyPanelProps) {
  const [isEnrolled, setIsEnrolled] = useState(false);
  const [balance, setBalance] = useState(0);
  const [accountDetails, setAccountDetails] = useState<any>(null);
  const [settings, setSettings] = useState<any>(null);
  const [activities, setActivities] = useState<any[]>([]);
  
  const [manualMemberId, setManualMemberId] = useState("");
  const [selectedActivityId, setSelectedActivityId] = useState("");
  const [dynamicAmount, setDynamicAmount] = useState("");
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const selectedActivity = activities.find(a => a.id === selectedActivityId);

  useEffect(() => { fetchData(); }, [customerId]);

  const fetchData = async () => {
    setIsLoading(true);
    const [configRes, activitiesRes, accRes] = await Promise.all([
      supabase.from("loyalty_settings").select("*").eq("id", 1).single(),
      supabase.from("loyalty_activities").select("*").eq("is_active", true).eq("update_method", "Manual"),
      supabase.from("loyalty_accounts").select("total_points, member_id, referral_code").eq("customer_id", customerId).maybeSingle()
    ]);

    if (configRes.data) setSettings(configRes.data);
    if (activitiesRes.data) setActivities(activitiesRes.data);
    
    if (accRes.data) {
      setIsEnrolled(true);
      setBalance(accRes.data.total_points);
      setAccountDetails(accRes.data);
    } else {
      setIsEnrolled(false);
    }
    setIsLoading(false);
  };

  const sendWhatsAppNotification = async (templateName: string, mappingString: string, specificContext: any) => {
    if (!settings?.is_wa_enabled || !templateName || !customerPhone) return;

    let formattedPhone = customerPhone.replace(/\D/g, '');
    if (formattedPhone.length === 10) formattedPhone = '91' + formattedPhone;

    try {
      try {
        await fetch("/api/whatsapp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "subscriber.createByPhone",
            payload: { phone: formattedPhone, name: customerName || "Pavitram Customer" }
          })
        });
      } catch (resolveError) {
        console.warn("Auto-resolve skipped or failed:", resolveError);
      }

      const baseContext = {
        customer_name: customerName || 'Customer',
        customer_phone: formattedPhone,
        total_balance: specificContext.total_balance ?? balance,
        activity_name: specificContext.activity_name ?? 'Loyalty Update',
        points_awarded: specificContext.points_awarded ?? 0,
        points_redeemed: specificContext.points_redeemed ?? 0,
        member_id: specificContext.member_id || accountDetails?.member_id || "N/A",
        referral_code: specificContext.referral_code || accountDetails?.referral_code || "N/A",
      };

      const mappedParams = mappingString
        ? mappingString.split(',').map(v => baseContext[v.trim() as keyof typeof baseContext]?.toString() || "0")
        : [];

      await fetch("/api/whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "message.sendDirect",
          payload: {
            user_id: formattedPhone,
            template_name: templateName,
            lang: "en",
            namespace: "bfbb14c4_778e_453b_97c2_92f60bb9e978", 
            parameters: mappedParams
          }
        })
      });
    } catch (error) {
      console.error("WhatsApp trigger failed", error);
    }
  };

  const handleEnrollCustomer = async () => {
    setIsSubmitting(true);
    try {
      // Auto-generate ID if manual input is empty
      const finalMemberId = manualMemberId.trim() || `PAV-${Math.floor(100000 + Math.random() * 900000)}`;
      const refCode = `REF-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

      const { error } = await supabase.from('loyalty_accounts').insert({ 
        customer_id: customerId,
        enrolled_by: userId || null,
        enrolled_at_store: warehouseId && warehouseId !== 'ALL' ? warehouseId : null,
        member_id: finalMemberId,
        referral_code: refCode
      });
      
      if (error) throw error;
      
      toast.success("Customer Enrolled in Loyalty Points Program");
      setIsEnrolled(true);
      fetchData(); // Refresh to grab the newly created details
      
      await sendWhatsAppNotification(
        settings?.wa_template_enrollment, 
        settings?.wa_mapping_enrollment, 
        { activity_name: 'Loyalty Points Enrollment', member_id: finalMemberId, referral_code: refCode }
      );
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAwardPoints = async () => {
    if (!selectedActivity || !settings) return toast.error("Configuration missing");
    if (selectedActivity.requires_evidence && !evidenceFile) return toast.error(`Evidence required: Please upload the ${selectedActivity.evidence_type}`);

    setIsSubmitting(true);
    try {
      let pointsToAward = 0;
      if (selectedActivity.is_dynamic) {
        if (!dynamicAmount || isNaN(Number(dynamicAmount))) throw new Error("Enter valid base amount");
        pointsToAward = Number(dynamicAmount) * 0.05; 
      } else {
        pointsToAward = selectedActivity.points;
      }

      if (balance + pointsToAward > settings.max_points_cap) {
        throw new Error(`Exceeds limit! Customer can only receive ${settings.max_points_cap - balance} more points.`);
      }

      let evidenceUrl = null;
      if (evidenceFile) {
        let fileToUpload = evidenceFile;
        if (evidenceFile.type.startsWith('image/')) {
          toast.loading("Compressing image...", { id: 'upload-toast' });
          try { fileToUpload = await compressImage(evidenceFile); } catch (err) {}
        } else toast.loading("Uploading evidence...", { id: 'upload-toast' });

        const fileExt = fileToUpload.name.split('.').pop() || 'jpg';
        const fileName = `${customerId}-${Date.now()}.${fileExt}`;
        
        const { data: uploadData, error: uploadError } = await supabase.storage.from('loyalty-evidence').upload(fileName, fileToUpload);
        if (uploadError) throw uploadError;
        evidenceUrl = uploadData.path;
        toast.dismiss('upload-toast');
      }

      const expiryDate = new Date();
      expiryDate.setMonth(expiryDate.getMonth() + settings.expiry_months);

      const { data: account } = await supabase.from('loyalty_accounts').select('id').eq('customer_id', customerId).single();
      const { error: txError } = await supabase.from('loyalty_transactions').insert({
        account_id: account?.id,
        activity_category: selectedActivity.category,
        activity_name: selectedActivity.name,
        points_awarded: pointsToAward,
        evidence_url: evidenceUrl,
        expires_at: expiryDate.toISOString(),
        status: 'approved',
        recorded_by: userId || null 
      });

      if (txError) throw txError;

      toast.success(`${pointsToAward} points awarded successfully`);
      const newBalance = balance + pointsToAward;
      setBalance(newBalance);

      await sendWhatsAppNotification(
        settings?.wa_template_points_earned, 
        settings?.wa_mapping_points_earned, 
        { points_awarded: pointsToAward, total_balance: newBalance, activity_name: selectedActivity.name }
      );
      
      setSelectedActivityId(""); setDynamicAmount(""); setEvidenceFile(null);
    } catch (error: any) {
      toast.dismiss('upload-toast'); toast.error(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) return <div className="p-8 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-zinc-400" /></div>;

  if (!isEnrolled) {
    return (
      <Card className="w-full bg-white shadow-sm border border-zinc-200 rounded-xl overflow-hidden">
        <CardContent className="p-8 text-center flex flex-col items-center justify-center">
          <div className="w-12 h-12 bg-zinc-50 rounded-full flex items-center justify-center border border-zinc-200 mb-4">
            <Award className="w-5 h-5 text-zinc-400" />
          </div>
          <h3 className="text-base font-semibold text-zinc-900 mb-1">Loyalty Points Program</h3>
          <p className="text-xs text-zinc-500 mb-6 max-w-sm font-medium leading-relaxed">
            This customer is not yet enrolled. Enroll them to start tracking points and generate their Referral Code.
          </p>
          
          <div className="w-full max-w-xs space-y-2 text-left mb-6">
            <Label className="text-[11px] font-bold text-zinc-600 uppercase tracking-widest">Card / Member ID (Optional)</Label>
            <Input 
              placeholder="Leave blank to auto-generate" 
              value={manualMemberId} 
              onChange={e => setManualMemberId(e.target.value.toUpperCase())}
              className="h-10 border-zinc-200 bg-zinc-50 text-center font-mono"
            />
          </div>

          <Button className="bg-zinc-900 hover:bg-zinc-800 text-white font-medium px-6 h-10 shadow-sm w-full max-w-xs" onClick={handleEnrollCustomer} disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <UserPlus className="w-4 h-4 mr-2" />} Enroll Customer
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full bg-white shadow-sm border border-zinc-200 rounded-xl overflow-hidden">
      <CardHeader className="bg-zinc-50/50 border-b border-zinc-100 py-4 px-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <CardTitle className="text-sm font-semibold text-zinc-900 flex items-center gap-2">
            <Award className="w-4 h-4 text-emerald-600" /> Loyalty Points
          </CardTitle>
          {accountDetails && (
            <div className="flex gap-3 mt-2">
              <span className="text-[10px] font-mono bg-zinc-100 border border-zinc-200 px-2 py-0.5 rounded text-zinc-600 flex items-center gap-1">
                <Hash className="w-3 h-3" /> ID: {accountDetails.member_id}
              </span>
              <span className="text-[10px] font-mono bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded text-indigo-700 flex items-center gap-1">
                Ref: {accountDetails.referral_code}
              </span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-[10px] font-medium text-zinc-500 uppercase tracking-widest">Balance</p>
            <p className="text-base font-semibold text-zinc-900">{balance.toLocaleString()} Pts</p>
          </div>
          <div className="border-l border-zinc-200 pl-4 text-right">
            <p className="text-[10px] font-medium text-zinc-500 uppercase tracking-widest">Value</p>
            <p className="text-base font-semibold text-emerald-600">₹{(balance * (settings?.point_value_rs || 1)).toLocaleString()}</p>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="p-5 space-y-5">
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-zinc-700">Select Activity</Label>
          <Select value={selectedActivityId} onValueChange={(val) => { setSelectedActivityId(val); setEvidenceFile(null); }}>
            <SelectTrigger className="w-full h-9 bg-white border-zinc-200 text-sm shadow-sm relative z-50">
              <SelectValue placeholder="Choose an action to award points..." />
            </SelectTrigger>
            <SelectContent position="popper" side="bottom" sideOffset={4} className="max-h-[250px] z-[100] border-zinc-200 shadow-xl rounded-md">
              {activities.map(activity => (
                <SelectItem key={activity.id} value={activity.id} className="text-sm py-2 cursor-pointer">
                  {activity.name} 
                  <span className="text-zinc-400 ml-1 font-medium">({activity.is_dynamic ? '5%' : `${activity.points} Pts`})</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedActivity?.is_dynamic && (
          <div className="space-y-1.5 animate-in fade-in slide-in-from-top-2 duration-300">
            <Label className="text-xs font-medium text-zinc-700">Base Amount (₹)</Label>
            <Input type="number" placeholder="Enter amount to calculate points" value={dynamicAmount} onChange={e => setDynamicAmount(e.target.value)} className="h-9 border-zinc-200 text-sm shadow-sm" />
          </div>
        )}

        {selectedActivity?.requires_evidence && (
          <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium text-zinc-700">Proof of Action Required</Label>
              <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">{selectedActivity.evidence_type}</span>
            </div>
            
            {evidenceFile ? (
               <div className="flex items-center justify-between p-3 border border-emerald-200 bg-emerald-50 rounded-lg">
                 <div className="flex items-center gap-3">
                   <FileImage className="w-5 h-5 text-emerald-600" />
                   <div>
                     <p className="text-xs font-bold text-emerald-800 truncate max-w-[200px]">{evidenceFile.name}</p>
                     <p className="text-[10px] font-medium text-emerald-600">{(evidenceFile.size / 1024).toFixed(1)} KB</p>
                   </div>
                 </div>
                 <Button variant="ghost" size="sm" onClick={() => setEvidenceFile(null)} className="h-7 text-[10px] text-emerald-700 hover:bg-emerald-100 font-bold">Remove</Button>
               </div>
            ) : (
              <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-zinc-300 rounded-lg cursor-pointer bg-zinc-50 hover:bg-zinc-100 hover:border-indigo-300 transition-colors group">
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <UploadCloud className="w-6 h-6 mb-2 text-zinc-400 group-hover:text-indigo-500 transition-colors" />
                  <p className="text-xs font-medium text-zinc-500">Click to upload <span className="font-bold text-zinc-700">{selectedActivity.evidence_type}</span></p>
                </div>
                <input type="file" className="hidden" accept="image/*,.pdf" onChange={e => setEvidenceFile(e.target.files?.[0] || null)} />
              </label>
            )}
          </div>
        )}

        <div className="pt-2">
          <Button className="w-full bg-zinc-900 hover:bg-zinc-800 text-white font-medium h-9 shadow-sm" disabled={!selectedActivityId || isSubmitting || (selectedActivity?.requires_evidence && !evidenceFile)} onClick={handleAwardPoints}>
            {isSubmitting ? <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" /> : <Award className="w-3.5 h-3.5 mr-2" />} Commit Points to Ledger
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}