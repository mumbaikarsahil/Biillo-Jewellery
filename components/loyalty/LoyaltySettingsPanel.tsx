"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Loader2, Settings2, Save, Plus, MessageCircle, Code2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";

export default function LoyaltySettingsPanel() {
  const [settings, setSettings] = useState({
    max_points_cap: 25000,
    expiry_months: 24,
    point_value_rs: 1,
    redemption_fee_pct: 20,
    is_wa_enabled: true,
    wa_template_enrollment: "",
    wa_template_points_earned: "",
    wa_template_points_redeemed: "",
    wa_mapping_enrollment: "",
    wa_mapping_points_earned: "",
    wa_mapping_points_redeemed: ""
  });
  const [activities, setActivities] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isActivityModalOpen, setIsActivityModalOpen] = useState(false);

  // ✨ Added evidence types from the document
  const EVIDENCE_OPTIONS = [
    "Screen Shot",
    "Profile update record",
    "Picture in showroom",
    "Attendance record",
    "Completed enrollment form",
    "Purchase record",
    "Event details and attendance record"
  ];

  const [newActivity, setNewActivity] = useState({
    category: "Social & Digital Engagement", 
    name: "", 
    is_dynamic: "false", 
    points: "", 
    requires_evidence: "true", // Default to true based on doc
    evidence_type: EVIDENCE_OPTIONS[0], 
    update_method: "Manual upload in ERP"
  });

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setIsLoading(true);
    const [settingsRes, activitiesRes] = await Promise.all([
      supabase.from("loyalty_settings").select("*").eq("id", 1).single(),
      supabase.from("loyalty_activities").select("*").order("category")
    ]);
    if (settingsRes.data) setSettings(settingsRes.data);
    if (activitiesRes.data) setActivities(activitiesRes.data);
    setIsLoading(false);
  };

  const handleSaveSettings = async () => {
    setIsSaving(true);
    try {
      const { error } = await supabase.from("loyalty_settings").update({
        max_points_cap: Number(settings.max_points_cap),
        expiry_months: Number(settings.expiry_months),
        point_value_rs: Number(settings.point_value_rs),
        redemption_fee_pct: Number(settings.redemption_fee_pct),
        is_wa_enabled: settings.is_wa_enabled,
        wa_template_enrollment: settings.wa_template_enrollment,
        wa_template_points_earned: settings.wa_template_points_earned,
        wa_template_points_redeemed: settings.wa_template_points_redeemed,
        wa_mapping_enrollment: settings.wa_mapping_enrollment,
        wa_mapping_points_earned: settings.wa_mapping_points_earned,
        wa_mapping_points_redeemed: settings.wa_mapping_points_redeemed,
        updated_at: new Date().toISOString()
      }).eq("id", 1);
      
      if (error) throw error;
      toast.success("Settings updated successfully.");
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddActivity = async () => {
    if (!newActivity.name) return toast.error("Activity name is required");
    setIsSaving(true);
    try {
      const { error } = await supabase.from("loyalty_activities").insert({
        category: newActivity.category,
        name: newActivity.name,
        is_dynamic: newActivity.is_dynamic === "true",
        points: Number(newActivity.points) || 0,
        requires_evidence: newActivity.requires_evidence === "true",
        evidence_type: newActivity.requires_evidence === "true" ? newActivity.evidence_type : null,
        update_method: newActivity.update_method
      });
      if (error) throw error;
      toast.success("New earning rule created.");
      setIsActivityModalOpen(false);
      setNewActivity({ category: "Social & Digital Engagement", name: "", is_dynamic: "false", points: "", requires_evidence: "true", evidence_type: EVIDENCE_OPTIONS[0], update_method: "Manual upload in ERP" });
      fetchData();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const toggleActivityStatus = async (id: string, currentStatus: boolean) => {
    await supabase.from("loyalty_activities").update({ is_active: !currentStatus }).eq("id", id);
    fetchData();
  };

  if (isLoading) return <div className="p-8 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-zinc-400" /></div>;

  return (
    <Card className="w-full mx-auto bg-white shadow-sm border border-zinc-200 rounded-xl overflow-hidden">
      <Tabs defaultValue="rules" className="w-full">
        <CardHeader className="bg-zinc-50/80 border-b border-zinc-100 p-0 sm:px-6 shrink-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-4 px-4 sm:px-0">
            <CardTitle className="text-sm font-semibold text-zinc-900 flex items-center gap-2">
              <Settings2 className="w-4 h-4 text-zinc-500" />
              Program Configuration
            </CardTitle>
            <TabsList className="bg-transparent border-none p-0 h-auto gap-4 flex justify-start overflow-x-auto hide-scrollbar">
              <TabsTrigger value="rules" className="data-[state=active]:border-b-2 data-[state=active]:border-zinc-900 rounded-none px-1 pb-2 font-medium text-xs">
                Global Rules
              </TabsTrigger>
              <TabsTrigger value="activities" className="data-[state=active]:border-b-2 data-[state=active]:border-zinc-900 rounded-none px-1 pb-2 font-medium text-xs">
                Earning Engine
              </TabsTrigger>
              <TabsTrigger value="automations" className="data-[state=active]:border-b-2 data-[state=active]:border-zinc-900 rounded-none px-1 pb-2 font-medium text-xs">
                Automations
              </TabsTrigger>
            </TabsList>
          </div>
        </CardHeader>
        
        <CardContent className="p-0">
          {/* TAB 1: GLOBAL RULES (Unchanged) */}
          <TabsContent value="rules" className="m-0 p-4 sm:p-6 space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-6">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-zinc-600">Maximum Point Cap</Label>
                <Input type="number" value={settings.max_points_cap} onChange={e => setSettings({...settings, max_points_cap: Number(e.target.value)})} className="h-9 border-zinc-200 shadow-sm" />
                <p className="text-[11px] text-zinc-400">Maximum accumulated points per customer.</p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-zinc-600">Expiry Window (Months)</Label>
                <Input type="number" value={settings.expiry_months} onChange={e => setSettings({...settings, expiry_months: Number(e.target.value)})} className="h-9 border-zinc-200 shadow-sm" />
                <p className="text-[11px] text-zinc-400">Validity period from the date earned.</p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-zinc-600">Point Value (₹)</Label>
                <Input type="number" value={settings.point_value_rs} onChange={e => setSettings({...settings, point_value_rs: Number(e.target.value)})} className="h-9 border-zinc-200 shadow-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-zinc-600">Redemption Fee (%)</Label>
                <Input type="number" value={settings.redemption_fee_pct} onChange={e => setSettings({...settings, redemption_fee_pct: Number(e.target.value)})} className="h-9 border-zinc-200 shadow-sm" />
              </div>
            </div>
            <div className="pt-2">
              <Button className="w-full sm:w-auto bg-zinc-900 hover:bg-zinc-800 text-white font-medium h-9 px-6 shadow-sm" onClick={handleSaveSettings} disabled={isSaving}>
                {isSaving ? <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-2" />} Save Rules
              </Button>
            </div>
          </TabsContent>

          {/* TAB 2: ACTIVITIES ENGINE */}
          <TabsContent value="activities" className="m-0">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 sm:p-6 border-b border-zinc-100">
              <div>
                <h3 className="text-sm font-semibold text-zinc-900">Earning Rules</h3>
                <p className="text-xs text-zinc-500 mt-0.5">Define actions that award points globally.</p>
              </div>
              <Dialog open={isActivityModalOpen} onOpenChange={setIsActivityModalOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="h-9 px-4 mt-3 sm:mt-0 text-xs bg-zinc-900 text-white hover:bg-zinc-800 shadow-sm font-medium w-full sm:w-auto">
                    <Plus className="w-3.5 h-3.5 mr-1.5" /> Add Rule
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[550px] p-0 border-none shadow-xl rounded-xl w-[95vw]">
                  <DialogHeader className="bg-zinc-50/80 p-5 border-b border-zinc-100">
                    <DialogTitle className="text-sm font-semibold text-zinc-900">Create Earning Rule</DialogTitle>
                  </DialogHeader>
                  <div className="p-5 space-y-4 max-h-[65vh] overflow-y-auto custom-scrollbar">
                    
                    {/* ✨ Add Rule Form: Updated to match document spec */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium text-zinc-700">Category</Label>
                        <Select value={newActivity.category} onValueChange={v => setNewActivity({...newActivity, category: v})}>
                          <SelectTrigger className="h-9 border-zinc-200 text-sm shadow-sm"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Social & Digital Engagement">Social & Digital Engagement</SelectItem>
                            <SelectItem value="Customer Profile Capture">Customer Profile Capture</SelectItem>
                            <SelectItem value="In-store Engagement">In-store Engagement</SelectItem>
                            <SelectItem value="Event Participation">Event Participation</SelectItem>
                            <SelectItem value="Program Enrollment">Program Enrollment</SelectItem>
                            <SelectItem value="Purchase & Referral">Purchase & Referral</SelectItem>
                            <SelectItem value="Community Outreach">Community Outreach</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium text-zinc-700">Update Method</Label>
                        <Select value={newActivity.update_method} onValueChange={v => setNewActivity({...newActivity, update_method: v})}>
                          <SelectTrigger className="h-9 border-zinc-200 text-sm shadow-sm"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Manual upload in ERP">Manual (Staff Appears in POS)</SelectItem>
                            <SelectItem value="Auto update in ERP">Auto (System Background)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-zinc-700">Action Name</Label>
                      <Input placeholder="e.g. Visit showroom on Birthday" value={newActivity.name} onChange={e => setNewActivity({...newActivity, name: e.target.value})} className="h-9 border-zinc-200 text-sm" />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium text-zinc-700">Point System</Label>
                        <Select value={newActivity.is_dynamic} onValueChange={v => setNewActivity({...newActivity, is_dynamic: v})}>
                          <SelectTrigger className="h-9 border-zinc-200 text-sm shadow-sm"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="false">Fixed Points</SelectItem>
                            <SelectItem value="true">Dynamic (5%)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium text-zinc-700">Points Awarded</Label>
                        <Input type="number" disabled={newActivity.is_dynamic === "true"} placeholder={newActivity.is_dynamic === "true" ? "Calculated at checkout" : "e.g. 500"} value={newActivity.points} onChange={e => setNewActivity({...newActivity, points: e.target.value})} className="h-9 border-zinc-200 text-sm shadow-sm" />
                      </div>
                    </div>

                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-3 mt-2">
                      <div className="flex items-center gap-2 mb-2">
                        <AlertCircle className="w-4 h-4 text-amber-600" />
                        <span className="text-xs font-bold text-amber-800">Evidence Configuration</span>
                      </div>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <Label className="text-xs font-medium text-amber-900">Requires Evidence?</Label>
                          <Select value={newActivity.requires_evidence} onValueChange={v => setNewActivity({...newActivity, requires_evidence: v})}>
                            <SelectTrigger className="h-9 border-amber-200 bg-white text-sm shadow-sm"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="true">Yes</SelectItem>
                              <SelectItem value="false">No</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs font-medium text-amber-900">Evidence Type</Label>
                          <Select disabled={newActivity.requires_evidence === "false"} value={newActivity.evidence_type} onValueChange={v => setNewActivity({...newActivity, evidence_type: v})}>
                            <SelectTrigger className="h-9 border-amber-200 bg-white text-sm shadow-sm"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {EVIDENCE_OPTIONS.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                    
                  </div>
                  <DialogFooter className="p-4 bg-zinc-50 border-t border-zinc-100 flex flex-col sm:flex-row gap-2 shrink-0">
                    <Button variant="outline" className="h-9 text-xs font-medium w-full sm:w-auto" onClick={() => setIsActivityModalOpen(false)}>Cancel</Button>
                    <Button className="h-9 text-xs bg-zinc-900 text-white font-medium w-full sm:w-auto shadow-sm" onClick={handleAddActivity} disabled={isSaving}>
                      {isSaving ? <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" /> : null} Save Rule
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
            
            <div className="max-h-[500px] overflow-y-auto custom-scrollbar">
              <Table>
                <TableHeader className="bg-zinc-50/80 sticky top-0 z-10 border-b border-zinc-100">
                  <TableRow className="hover:bg-transparent border-none">
                    <TableHead className="text-[11px] font-medium text-zinc-500 py-3 px-4 sm:px-6">Category / Action</TableHead>
                    <TableHead className="text-[11px] font-medium text-zinc-500 py-3 px-4">Reward</TableHead>
                    <TableHead className="text-[11px] font-medium text-zinc-500 py-3 px-4">Evidence Required</TableHead>
                    <TableHead className="text-[11px] font-medium text-zinc-500 py-3 px-4 text-center">Active</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activities.map(activity => (
                    <TableRow key={activity.id} className={`hover:bg-zinc-50/50 transition-colors border-b border-zinc-100 ${!activity.is_active ? 'opacity-50' : ''}`}>
                      <TableCell className="py-3.5 px-4 sm:px-6">
                        <p className="text-[13px] font-medium text-zinc-900">{activity.name}</p>
                        <p className="text-[11px] text-zinc-500 mt-1">{activity.category} • {activity.update_method === 'Manual upload in ERP' ? 'POS Manual' : 'Auto'}</p>
                      </TableCell>
                      <TableCell className="py-3.5 px-4">
                        <span className="inline-flex px-2 py-0.5 rounded text-[11px] font-medium bg-zinc-100 text-zinc-700 border border-zinc-200">
                          {activity.is_dynamic ? 'Dynamic 5%' : `${activity.points} Pts`}
                        </span>
                      </TableCell>
                      <TableCell className="py-3.5 px-4">
                        {activity.requires_evidence ? (
                          <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 uppercase tracking-widest">
                            {activity.evidence_type}
                          </span>
                        ) : (
                          <span className="text-[11px] text-zinc-400 font-medium">None</span>
                        )}
                      </TableCell>
                      <TableCell className="py-3.5 px-4 text-center">
                        <div className="flex justify-center items-center h-full">
                          <input
                            type="checkbox"
                            checked={activity.is_active}
                            onChange={() => toggleActivityStatus(activity.id, activity.is_active)}
                            className="w-4 h-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900 cursor-pointer"
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          {/* TAB 3: AUTOMATIONS (Unchanged) */}
          <TabsContent value="automations" className="m-0 p-4 sm:p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-zinc-100 pb-4">
              <div>
                <h3 className="text-sm font-semibold text-zinc-900">WhatsApp Integrations</h3>
                <p className="text-xs text-zinc-500 mt-1">Map dynamic variables to your Meta templates.</p>
              </div>
              <div className="flex items-center gap-3 mt-4 sm:mt-0">
                <Label className="text-xs font-medium text-zinc-600">Enable Automation</Label>
                <input
                  type="checkbox"
                  checked={settings.is_wa_enabled}
                  onChange={(e) => setSettings({...settings, is_wa_enabled: e.target.checked})}
                  className="w-4 h-4 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                />
              </div>
            </div>

            <div className={`space-y-8 transition-opacity ${!settings.is_wa_enabled ? 'opacity-40 pointer-events-none' : ''}`}>
              
              {/* VARIABLE CHEATSHEET */}
              <div className="bg-zinc-50 p-4 rounded-lg border border-zinc-200">
                <h4 className="text-[11px] font-bold text-zinc-600 uppercase tracking-widest mb-3 flex items-center gap-1.5"><Code2 className="w-3.5 h-3.5" /> Available Context Variables</h4>
                <div className="flex flex-wrap gap-2">
                  {['customer_name', 'customer_phone', 'points_awarded', 'points_redeemed', 'total_balance', 'activity_name'].map(v => (
                    <span key={v} className="bg-white border border-zinc-200 text-zinc-700 text-[10px] font-mono px-2 py-1 rounded shadow-sm select-all">
                      {v}
                    </span>
                  ))}
                </div>
                <p className="text-[11px] text-zinc-500 mt-3">Separate variables by commas to map them to <span className="font-mono text-zinc-700">{'{{1}}, {{2}}, {{3}}'}</span> in your exact template order.</p>
              </div>

              {/* ENROLLMENT */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-white border border-zinc-100 p-4 rounded-xl shadow-sm">
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-medium text-zinc-600 uppercase tracking-widest flex items-center gap-1.5">
                    <MessageCircle className="w-3.5 h-3.5" /> Enrollment Template Name
                  </Label>
                  <Input placeholder="e.g., loyalty_welcome_01" value={settings.wa_template_enrollment || ""} onChange={e => setSettings({...settings, wa_template_enrollment: e.target.value})} className="h-9 border-zinc-200 font-mono text-sm shadow-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-medium text-zinc-600 uppercase tracking-widest">Ordered Variables Map</Label>
                  <Input placeholder="e.g., customer_name" value={settings.wa_mapping_enrollment || ""} onChange={e => setSettings({...settings, wa_mapping_enrollment: e.target.value})} className="h-9 border-zinc-200 font-mono text-sm text-indigo-700 shadow-sm" />
                </div>
              </div>

              {/* EARNED */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-white border border-zinc-100 p-4 rounded-xl shadow-sm">
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-medium text-zinc-600 uppercase tracking-widest flex items-center gap-1.5">
                    <MessageCircle className="w-3.5 h-3.5" /> Points Earned Template
                  </Label>
                  <Input placeholder="e.g., loyalty_points_awarded" value={settings.wa_template_points_earned || ""} onChange={e => setSettings({...settings, wa_template_points_earned: e.target.value})} className="h-9 border-zinc-200 font-mono text-sm shadow-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-medium text-zinc-600 uppercase tracking-widest">Ordered Variables Map</Label>
                  <Input placeholder="e.g., customer_name, points_awarded, total_balance" value={settings.wa_mapping_points_earned || ""} onChange={e => setSettings({...settings, wa_mapping_points_earned: e.target.value})} className="h-9 border-zinc-200 font-mono text-sm text-indigo-700 shadow-sm" />
                </div>
              </div>

              {/* REDEEMED */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-white border border-zinc-100 p-4 rounded-xl shadow-sm">
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-medium text-zinc-600 uppercase tracking-widest flex items-center gap-1.5">
                    <MessageCircle className="w-3.5 h-3.5" /> Points Redeemed Template
                  </Label>
                  <Input placeholder="e.g., loyalty_points_redeemed" value={settings.wa_template_points_redeemed || ""} onChange={e => setSettings({...settings, wa_template_points_redeemed: e.target.value})} className="h-9 border-zinc-200 font-mono text-sm shadow-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-medium text-zinc-600 uppercase tracking-widest">Ordered Variables Map</Label>
                  <Input placeholder="e.g., customer_name, points_redeemed, total_balance" value={settings.wa_mapping_points_redeemed || ""} onChange={e => setSettings({...settings, wa_mapping_points_redeemed: e.target.value})} className="h-9 border-zinc-200 font-mono text-sm text-indigo-700 shadow-sm" />
                </div>
              </div>

            </div>

            <div className="pt-2">
              <Button className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white font-medium h-9 px-6 shadow-sm transition-all" onClick={handleSaveSettings} disabled={isSaving}>
                {isSaving ? <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-2" />} Save Automations
              </Button>
            </div>
          </TabsContent>
        </CardContent>
      </Tabs>
    </Card>
  );
}