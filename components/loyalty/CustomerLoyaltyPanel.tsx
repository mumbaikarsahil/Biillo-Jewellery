"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Loader2, UploadCloud, Award, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

interface CustomerLoyaltyPanelProps {
  customerId: string;
  customerPhone?: string;
  customerName?: string;
  userId?: string;       // ✨ Added for tracking
  warehouseId?: string;  // ✨ Added for tracking
}

export default function CustomerLoyaltyPanel({ customerId, customerPhone, customerName, userId, warehouseId }: CustomerLoyaltyPanelProps) {
  const [isEnrolled, setIsEnrolled] = useState(false);
  const [balance, setBalance] = useState(0);
  const [settings, setSettings] = useState<any>(null);
  const [activities, setActivities] = useState<any[]>([]);
  
  const [selectedActivityId, setSelectedActivityId] = useState("");
  const [dynamicAmount, setDynamicAmount] = useState("");
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const selectedActivity = activities.find(a => a.id === selectedActivityId);

  useEffect(() => {
    fetchData();
  }, [customerId]);

  const fetchData = async () => {
    setIsLoading(true);
    
    const [configRes, activitiesRes, accRes] = await Promise.all([
      supabase.from("loyalty_settings").select("*").eq("id", 1).single(),
      supabase.from("loyalty_activities").select("*").eq("is_active", true).eq("update_method", "Manual"),
      supabase.from("loyalty_accounts").select("total_points").eq("customer_id", customerId).maybeSingle()
    ]);

    if (configRes.data) setSettings(configRes.data);
    if (activitiesRes.data) setActivities(activitiesRes.data);
    
    if (accRes.data) {
      setIsEnrolled(true);
      setBalance(accRes.data.total_points);
    } else {
      setIsEnrolled(false);
    }
    
    setIsLoading(false);
  };

  // Add `mappingString` to the arguments
const sendWhatsAppNotification = async (templateName: string, mappingString: string, specificContext: any) => {
  if (!settings?.is_wa_enabled || !templateName || !customerPhone) return;

  try {
    // 1. Build the full context dictionary of ALL available variables
    const baseContext = {
      customer_name: customerName || 'Customer',
      customer_phone: customerPhone,
      total_balance: specificContext.total_balance || balance,
      activity_name: specificContext.activity_name || 'Loyalty Update',
      points_awarded: specificContext.points_awarded || 0,
      points_redeemed: specificContext.points_redeemed || 0,
    };

    // 2. Parse the mapping string from settings (e.g., "customer_name, points_awarded, total_balance")
    //    and create the exact ordered array required by Meta for {{1}}, {{2}}, {{3}}
    const mappedParams = mappingString
      ? mappingString.split(',').map(v => baseContext[v.trim() as keyof typeof baseContext]?.toString() || "")
      : [];

    // NOTE: Replace this endpoint with your actual WhatsApp API route
    await fetch("/api/whatsapp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phone: customerPhone,
        template: templateName,
        parameters: mappedParams, // 👈 Passes the ordered array directly to the Meta API
        data: baseContext         // Keeps the full payload for webhook logging or debugging
      })
    });
  } catch (error) {
    console.error("WhatsApp trigger failed", error);
  }
};

  const handleEnrollCustomer = async () => {
    setIsSubmitting(true);
    try {
      // ✨ Attach User ID and Store ID to the enrollment record
      const { error } = await supabase.from('loyalty_accounts').insert({ 
        customer_id: customerId,
        enrolled_by: userId || null,
        enrolled_at_store: warehouseId && warehouseId !== 'ALL' ? warehouseId : null
      });
      if (error) throw error;
      
      toast.success("Customer Enrolled Successfully");
      setIsEnrolled(true);
      
      await sendWhatsAppNotification(
        settings?.wa_template_enrollment, 
        settings?.wa_mapping_enrollment, 
        { activity_name: 'Celebration Plan Enrollment' }
      );
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAwardPoints = async () => {
    if (!selectedActivity || !settings) return toast.error("Configuration missing");
    if (selectedActivity.requires_evidence && !evidenceFile) return toast.error(`Evidence required: ${selectedActivity.evidence_type}`);

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
        const fileExt = evidenceFile.name.split('.').pop();
        const fileName = `${customerId}-${Date.now()}.${fileExt}`;
        const { data: uploadData, error: uploadError } = await supabase.storage.from('loyalty-evidence').upload(fileName, evidenceFile);
        if (uploadError) throw uploadError;
        evidenceUrl = uploadData.path;
      }

      const expiryDate = new Date();
      expiryDate.setMonth(expiryDate.getMonth() + settings.expiry_months);

      const { data: account } = await supabase.from('loyalty_accounts').select('id').eq('customer_id', customerId).single();
      
      // ✨ Attach recorded_by User ID to the transaction
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

      // Trigger Earned WA Message
await sendWhatsAppNotification(
  settings?.wa_template_points_earned, 
  settings?.wa_mapping_points_earned, 
  {
    points_awarded: pointsToAward,
    total_balance: newBalance,
    activity_name: selectedActivity.name
  }
);
      setSelectedActivityId("");
      setDynamicAmount("");
      setEvidenceFile(null);

    } catch (error: any) {
      toast.error(error.message);
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
          <h3 className="text-base font-semibold text-zinc-900 mb-1">Pavitram Celebration Plan</h3>
          <p className="text-xs text-zinc-500 mb-6 max-w-sm font-medium leading-relaxed">
            This customer is not yet enrolled in the loyalty program. Enroll them to start tracking and awarding points.
          </p>
          <Button 
            className="bg-zinc-900 hover:bg-zinc-800 text-white font-medium px-6 h-9 shadow-sm" 
            onClick={handleEnrollCustomer} 
            disabled={isSubmitting}
          >
            {isSubmitting ? <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" /> : <UserPlus className="w-3.5 h-3.5 mr-2" />} 
            Enroll Customer
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full bg-white shadow-sm border border-zinc-200 rounded-xl overflow-hidden">
      <CardHeader className="bg-zinc-50/50 border-b border-zinc-100 py-4 px-5 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-semibold text-zinc-900 flex items-center gap-2">
          <Award className="w-4 h-4 text-emerald-600" /> Loyalty Program
        </CardTitle>
        <div className="flex items-center gap-4 text-right">
          <div>
            <p className="text-[10px] font-medium text-zinc-500 uppercase tracking-widest">Balance</p>
            <p className="text-base font-semibold text-zinc-900">{balance.toLocaleString()} Pts</p>
          </div>
          <div className="border-l border-zinc-200 pl-4">
            <p className="text-[10px] font-medium text-zinc-500 uppercase tracking-widest">Value</p>
            <p className="text-base font-semibold text-emerald-600">₹{(balance * (settings?.point_value_rs || 1)).toLocaleString()}</p>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="p-5 space-y-5">
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-zinc-700">Select Activity</Label>
          <Select value={selectedActivityId} onValueChange={setSelectedActivityId}>
  <SelectTrigger className="w-full h-9 bg-white border-zinc-200 text-sm shadow-sm relative z-50">
    <SelectValue placeholder="Choose an action to award points..." />
  </SelectTrigger>
  
  {/* Update this SelectContent component */}
  <SelectContent 
    position="popper" 
    side="bottom" 
    sideOffset={4} 
    className="max-h-[250px] z-[100] border-zinc-200 shadow-xl rounded-md"
  >
    {activities.map(activity => (
      <SelectItem key={activity.id} value={activity.id} className="text-sm py-2 cursor-pointer">
        {activity.name} 
        <span className="text-zinc-400 ml-1 font-medium">
          ({activity.is_dynamic ? '5%' : `${activity.points} Pts`})
        </span>
      </SelectItem>
    ))}
  </SelectContent>
</Select>
        </div>

        {selectedActivity?.is_dynamic && (
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-zinc-700">Purchase / Referral Amount (₹)</Label>
            <Input 
              type="number" 
              placeholder="Enter base amount to calculate 5%" 
              value={dynamicAmount} 
              onChange={e => setDynamicAmount(e.target.value)}
              className="h-9 border-zinc-200 text-sm shadow-sm"
            />
          </div>
        )}

        {selectedActivity?.requires_evidence && (
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-zinc-700 flex items-center gap-1.5">
              Evidence Required: <span className="text-zinc-500">{selectedActivity.evidence_type}</span>
            </Label>
            <label className="flex flex-col items-center justify-center w-full h-24 border border-dashed border-zinc-300 rounded-lg cursor-pointer bg-zinc-50 hover:bg-zinc-100 transition-colors">
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                <UploadCloud className="w-5 h-5 mb-2 text-zinc-400" />
                <p className="text-xs font-medium text-zinc-500">{evidenceFile ? evidenceFile.name : "Click to upload image"}</p>
              </div>
              <input type="file" className="hidden" accept="image/*" onChange={e => setEvidenceFile(e.target.files?.[0] || null)} />
            </label>
          </div>
        )}

        <div className="pt-2">
          <Button 
            className="w-full bg-zinc-900 hover:bg-zinc-800 text-white font-medium h-9 shadow-sm" 
            disabled={!selectedActivityId || isSubmitting}
            onClick={handleAwardPoints}
          >
            {isSubmitting ? <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" /> : <Award className="w-3.5 h-3.5 mr-2" />}
            Commit Points to Ledger
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}