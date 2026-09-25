"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Loader2, Settings2, Save, Plus, MessageCircle, Code2, AlertCircle, Repeat, Send, Edit, Trash2 } from "lucide-react";
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
  const [waTemplates, setWaTemplates] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
  
  // Modal State
  const [isActivityModalOpen, setIsActivityModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const EVIDENCE_OPTIONS = [
    "Screen Shot",
    "Profile update record",
    "Picture in showroom",
    "Attendance record",
    "Completed enrollment form",
    "Purchase record",
    "Event details and attendance record"
  ];

  const defaultActivityState = {
    category: "Social & Digital Engagement", 
    name: "", 
    is_dynamic: "false", 
    points: "", 
    requires_evidence: "true",
    evidence_type: EVIDENCE_OPTIONS[0], 
    update_method: "Manual upload in ERP",
    limit_type: "unlimited", 
    limit_count: "1",
    wa_template_name: "",
    wa_mapping: ""
  };

  const [newActivity, setNewActivity] = useState(defaultActivityState);

  useEffect(() => { 
    fetchData(); 
    fetchTemplates();
  }, []);

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

  const fetchTemplates = async () => {
    setIsLoadingTemplates(true);
    try {
      const res = await fetch("/api/whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          action: "template.list", 
          payload: { limit: 100 } 
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Failed to fetch templates");
      
      const fetched = Array.isArray(json.data) ? json.data : (json.templates || []);
      setWaTemplates(fetched);
    } catch (error: any) {
      toast.error(`Template Error: ${error.message}`);
    } finally {
      setIsLoadingTemplates(false);
    }
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

  const openNewActivityModal = () => {
    setEditingId(null);
    setNewActivity(defaultActivityState);
    setIsActivityModalOpen(true);
  };

  const openEditActivityModal = (activity: any) => {
    setEditingId(activity.id);
    setNewActivity({
      category: activity.category,
      name: activity.name,
      is_dynamic: activity.is_dynamic ? "true" : "false",
      points: activity.points?.toString() || "0",
      requires_evidence: activity.requires_evidence ? "true" : "false",
      evidence_type: activity.evidence_type || EVIDENCE_OPTIONS[0],
      update_method: activity.update_method,
      limit_type: activity.limit_type || "unlimited",
      limit_count: activity.limit_count?.toString() || "1",
      wa_template_name: activity.wa_template_name || "",
      wa_mapping: activity.wa_mapping || ""
    });
    setIsActivityModalOpen(true);
  };

  const handleSaveActivity = async () => {
    if (!newActivity.name) return toast.error("Activity name is required");
    setIsSaving(true);
    
    const payload = {
      category: newActivity.category,
      name: newActivity.name,
      is_dynamic: newActivity.is_dynamic === "true",
      points: Number(newActivity.points) || 0,
      requires_evidence: newActivity.requires_evidence === "true",
      evidence_type: newActivity.requires_evidence === "true" ? newActivity.evidence_type : null,
      update_method: newActivity.update_method,
      limit_type: newActivity.limit_type,
      limit_count: newActivity.limit_type === 'custom' ? Number(newActivity.limit_count) : 1,
      wa_template_name: newActivity.wa_template_name.trim() || null,
      wa_mapping: newActivity.wa_mapping.trim() || null
    };

    try {
      if (editingId) {
        const { error } = await supabase.from("loyalty_activities").update(payload).eq("id", editingId);
        if (error) throw error;
        toast.success("Earning rule updated.");
      } else {
        const { error } = await supabase.from("loyalty_activities").insert(payload);
        if (error) throw error;
        toast.success("New earning rule created.");
      }
      
      setIsActivityModalOpen(false);
      setNewActivity(defaultActivityState);
      setEditingId(null);
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
                Global Automations
              </TabsTrigger>
            </TabsList>
          </div>
        </CardHeader>
        
        <CardContent className="p-0">
          {/* TAB 1: GLOBAL RULES */}
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
                <p className="text-xs text-zinc-500 mt-0.5">Define actions, limits, and specific WhatsApp messages.</p>
              </div>
              <Dialog open={isActivityModalOpen} onOpenChange={setIsActivityModalOpen}>
                <Button size="sm" onClick={openNewActivityModal} className="h-9 px-4 mt-3 sm:mt-0 text-xs bg-zinc-900 text-white hover:bg-zinc-800 shadow-sm font-medium w-full sm:w-auto">
                  <Plus className="w-3.5 h-3.5 mr-1.5" /> Add Rule
                </Button>
                
                <DialogContent className="sm:max-w-[600px] p-0 border-none shadow-xl rounded-xl w-[95vw]">
                  <DialogHeader className="bg-zinc-50/80 p-5 border-b border-zinc-100">
                    <DialogTitle className="text-sm font-semibold text-zinc-900">
                      {editingId ? 'Edit Earning Rule' : 'Create Earning Rule'}
                    </DialogTitle>
                  </DialogHeader>
                  <div className="p-5 space-y-5 max-h-[70vh] overflow-y-auto custom-scrollbar">
                    
                    {/* Basic Info */}
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
                      <Input placeholder="e.g. Leave a Google Review" value={newActivity.name} onChange={e => setNewActivity({...newActivity, name: e.target.value})} className="h-9 border-zinc-200 text-sm" />
                    </div>

                    {/* Points & Limits */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 bg-zinc-50 border border-zinc-100 rounded-lg">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium text-zinc-700">Point System</Label>
                        <Select value={newActivity.is_dynamic} onValueChange={v => setNewActivity({...newActivity, is_dynamic: v})}>
                          <SelectTrigger className="h-9 border-zinc-200 text-sm bg-white"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="false">Fixed Points</SelectItem>
                            <SelectItem value="true">Dynamic (5%)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium text-zinc-700">Points Awarded</Label>
                        <Input type="number" disabled={newActivity.is_dynamic === "true"} placeholder={newActivity.is_dynamic === "true" ? "Calculated" : "e.g. 500"} value={newActivity.points} onChange={e => setNewActivity({...newActivity, points: e.target.value})} className="h-9 border-zinc-200 text-sm bg-white shadow-sm" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium text-zinc-700 flex items-center gap-1.5"><Repeat className="w-3 h-3" /> Frequency</Label>
                        <Select value={newActivity.limit_type} onValueChange={v => setNewActivity({...newActivity, limit_type: v})}>
                          <SelectTrigger className="h-9 border-zinc-200 text-sm bg-white"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="unlimited">Unlimited</SelectItem>
                            <SelectItem value="once_lifetime">Once Per Customer</SelectItem>
                            <SelectItem value="custom">Custom Limit</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {newActivity.limit_type === 'custom' && (
                      <div className="space-y-1.5 animate-in fade-in slide-in-from-top-2">
                        <Label className="text-xs font-medium text-zinc-700">Max times customer can complete this</Label>
                        <Input type="number" placeholder="e.g. 3" value={newActivity.limit_count} onChange={e => setNewActivity({...newActivity, limit_count: e.target.value})} className="h-9 border-zinc-200 w-1/3" />
                      </div>
                    )}

                    {/* WhatsApp Override */}
                    <div className="bg-[#25D366]/5 border border-[#25D366]/20 rounded-lg p-4 space-y-3">
                      <div className="flex items-center gap-2 mb-1">
                        <Send className="w-4 h-4 text-[#25D366]" />
                        <span className="text-xs font-bold text-zinc-800">Activity-Specific WhatsApp (Optional)</span>
                      </div>
                      <p className="text-[11px] text-zinc-500 leading-tight">If provided, this template will be sent instead of the global 'Points Earned' template.</p>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                        <div className="space-y-1.5">
                          <Label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Template Name</Label>
                          <Select value={newActivity.wa_template_name} onValueChange={v => setNewActivity({...newActivity, wa_template_name: v})}>
                            <SelectTrigger className="h-9 border-zinc-200 text-sm bg-white">
                              {isLoadingTemplates ? <Loader2 className="w-3 h-3 animate-spin mr-2" /> : null}
                              <SelectValue placeholder="Select Template" />
                            </SelectTrigger>
                            <SelectContent>
                              {waTemplates.map(t => (
                                <SelectItem key={t.name} value={t.name}>{t.name}</SelectItem>
                              ))}
                              <SelectItem value="none" className="text-zinc-400 italic">None (Use Global)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Variables Map</Label>
                          <Input placeholder="e.g. customer_name, points_awarded" value={newActivity.wa_mapping} onChange={e => setNewActivity({...newActivity, wa_mapping: e.target.value})} className="h-9 border-zinc-200 text-sm bg-white font-mono" />
                        </div>
                      </div>
                    </div>

                    {/* Evidence */}
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-3">
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
                    <Button className="h-9 text-xs bg-zinc-900 text-white font-medium w-full sm:w-auto shadow-sm" onClick={handleSaveActivity} disabled={isSaving}>
                      {isSaving ? <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" /> : null} {editingId ? 'Update Rule' : 'Save Rule'}
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
                    <TableHead className="text-[11px] font-medium text-zinc-500 py-3 px-4">Reward & Limits</TableHead>
                    <TableHead className="text-[11px] font-medium text-zinc-500 py-3 px-4">Automation / Evidence</TableHead>
                    <TableHead className="text-[11px] font-medium text-zinc-500 py-3 px-4 text-center">Active</TableHead>
                    <TableHead className="text-[11px] font-medium text-zinc-500 py-3 px-4 text-center">Actions</TableHead>
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
                        <div className="flex flex-col gap-1.5 items-start">
                          <span className="inline-flex px-2 py-0.5 rounded text-[11px] font-medium bg-zinc-100 text-zinc-700 border border-zinc-200">
                            {activity.is_dynamic ? 'Dynamic 5%' : `${activity.points} Pts`}
                          </span>
                          <span className="text-[10px] font-medium text-zinc-500">
                            {activity.limit_type === 'once_lifetime' ? 'Once per customer' : 
                             activity.limit_type === 'custom' ? `Max ${activity.limit_count} times` : 
                             'Unlimited'}
                          </span>
                        </div>
                      </TableCell>

                      <TableCell className="py-3.5 px-4">
                        <div className="flex flex-col gap-1.5 items-start">
                          {activity.wa_template_name ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-[#25D366]/10 text-[#1DA851] border border-[#25D366]/20" title={activity.wa_template_name}>
                              <MessageCircle className="w-3 h-3" /> Custom WA
                            </span>
                          ) : (
                            <span className="text-[10px] text-zinc-400 font-medium">Global WA</span>
                          )}
                          {activity.requires_evidence && (
                            <span className="inline-flex px-2 py-0.5 rounded text-[9px] font-bold bg-amber-50 text-amber-700 border border-amber-200 uppercase tracking-widest">
                              Req. {activity.evidence_type}
                            </span>
                          )}
                        </div>
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

                      <TableCell className="py-3.5 px-4 text-center">
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-zinc-400 hover:text-indigo-600 hover:bg-indigo-50" onClick={() => openEditActivityModal(activity)}>
                          <Edit className="w-3.5 h-3.5" />
                        </Button>
                      </TableCell>

                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          {/* TAB 3: GLOBAL AUTOMATIONS */}
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
                  <Select value={settings.wa_template_enrollment} onValueChange={v => setSettings({...settings, wa_template_enrollment: v})}>
                    <SelectTrigger className="h-9 border-zinc-200 text-sm shadow-sm bg-white">
                      {isLoadingTemplates ? <Loader2 className="w-3 h-3 animate-spin mr-2" /> : null}
                      <SelectValue placeholder="Select Template" />
                    </SelectTrigger>
                    <SelectContent>
                      {waTemplates.map(t => (
                        <SelectItem key={t.name} value={t.name}>{t.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
                    <MessageCircle className="w-3.5 h-3.5" /> Default Points Earned Template
                  </Label>
                  <Select value={settings.wa_template_points_earned} onValueChange={v => setSettings({...settings, wa_template_points_earned: v})}>
                    <SelectTrigger className="h-9 border-zinc-200 text-sm shadow-sm bg-white">
                      {isLoadingTemplates ? <Loader2 className="w-3 h-3 animate-spin mr-2" /> : null}
                      <SelectValue placeholder="Select Template" />
                    </SelectTrigger>
                    <SelectContent>
                      {waTemplates.map(t => (
                        <SelectItem key={t.name} value={t.name}>{t.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
                  <Select value={settings.wa_template_points_redeemed} onValueChange={v => setSettings({...settings, wa_template_points_redeemed: v})}>
                    <SelectTrigger className="h-9 border-zinc-200 text-sm shadow-sm bg-white">
                      {isLoadingTemplates ? <Loader2 className="w-3 h-3 animate-spin mr-2" /> : null}
                      <SelectValue placeholder="Select Template" />
                    </SelectTrigger>
                    <SelectContent>
                      {waTemplates.map(t => (
                        <SelectItem key={t.name} value={t.name}>{t.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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