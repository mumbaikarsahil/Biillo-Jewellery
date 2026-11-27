"use client";

import React, { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  Cake, Heart, Send, Save, Loader2, CheckCircle2, Clock, Sparkles, RefreshCw
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type EventType = "birthday" | "anniversary";

type TriggerType = "event_month" | "days_before" | "exact_day";


const DEFAULT_CONFIG = {
  is_enabled: false,
  mode: "manual" as "auto" | "manual",
  trigger_type: "event_month" as "event_month" | "exact_day" | "days_before",
  days_before: 3,
  template_name: "",
  template_lang: "en",
  template_namespace: "bfbb14c4_778e_453b_97c2_92f60bb9e978",
  param_mapping: "customer_name",
};

export default function WishesPage() {
  const { appUser } = useAuth();
  const [activeTab, setActiveTab] = useState<EventType>("birthday");
  const [activeTrigger, setActiveTrigger] = useState<TriggerType>("event_month");
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [templates, setTemplates] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [sentLogIds, setSentLogIds] = useState<Set<string>>(new Set());
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const currentYear = new Date().getFullYear();

  // 1. Fetch Convo360 Templates once
  useEffect(() => {
    fetch("/api/whatsapp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "template.list", payload: {} }),
    })
      .then((r) => r.json())
      .then((res) => {
        const list = res?.data || res?.templates || (Array.isArray(res) ? res : []);
        setTemplates(list);
      })
      .catch(() => {});
  }, []);

  // 2. Load settings, customers, and this year's sent logs for the active tab
  const loadTabData = async () => {
    if (!appUser?.company_id) return;
    setIsLoading(true);
    setSelectedIds([]);
    try {
      const dateCol = activeTab === "birthday" ? "birth_date" : "anniversary_date";

      const [cfgRes, custRes, logRes] = await Promise.all([
        supabase
        .from("event_automation_settings")
        .select("*")
        .eq("company_id", appUser.company_id) // 👈 added back
        .eq("event_type", activeTab)
        .eq("trigger_type", activeTrigger)
        .maybeSingle(),
        supabase
          .from("customers")
          .select("id, full_name, phone, birth_date, anniversary_date")
          .eq("company_id", appUser.company_id)
          .not(dateCol, "is", null),
          supabase
          .from("event_message_logs")
          .select("customer_id")
          .eq("company_id", appUser.company_id) // 👈 added back
          .eq("event_type", activeTab)
          .eq("trigger_type", activeTrigger)
          .eq("event_year", currentYear)
          .eq("status", "sent"),
      ]);

      setConfig(cfgRes.data ? { ...DEFAULT_CONFIG, ...cfgRes.data } : DEFAULT_CONFIG);
      setCustomers(custRes.data || []);
      setSentLogIds(new Set((logRes.data || []).map((l) => l.customer_id)));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTabData();
  }, [appUser?.company_id, activeTab, activeTrigger]);

  // 3. Filter customers based on the selected trigger condition
  const matchingCustomers = useMemo(() => {
    const now = new Date();
    const todayMonth = now.getMonth() + 1;
    const todayDay = now.getDate();

    const target = new Date(now);
    if (activeTrigger=== "days_before") {
      target.setDate(target.getDate() + (Number(config.days_before) || 0));
    }
    const targetMonth = target.getMonth() + 1;
    const targetDay = target.getDate();
    const dateCol = activeTab === "birthday" ? "birth_date" : "anniversary_date";

    return customers
      .filter((c) => {
        const raw = c[dateCol];
        if (!raw) return false;
        const [, m, d] = String(raw).split("-").map(Number);
        if (activeTrigger === "event_month") return m === todayMonth; // 👈 was config.trigger_type
        return m === targetMonth && d === targetDay;
      })
      .sort((a, b) => {
        const dA = Number(String(a[dateCol]).split("-")[2]);
        const dB = Number(String(b[dateCol]).split("-")[2]);
        return dA - dB;
      });
    }, [customers, activeTrigger, config.days_before, activeTab]); // 👈 was config.trigger_type

  const handleSaveSettings = async () => {
    if (!appUser?.company_id) return;
    setIsSaving(true);
    try {
      const { error } = await supabase.from("event_automation_settings").upsert(
        {
          company_id: appUser.company_id,
          event_type: activeTab,
          is_enabled: config.is_enabled,
          mode: config.mode,
          trigger_type: activeTrigger,
          days_before: Number(config.days_before) || 0,
          template_name: config.template_name || null,
          template_lang: config.template_lang,
          template_namespace: config.template_namespace,
          param_mapping: config.param_mapping,
          updated_at: new Date().toISOString(),
          
        },
        { onConflict: "company_id,event_type,trigger_type" }
      );
      if (error) throw error;
      toast.success(`${activeTab === "birthday" ? "Birthday" : "Anniversary"} settings saved.`);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleManualSend = async () => {
    if (!config.template_name) return toast.error("Please select a WhatsApp template first.");
    if (selectedIds.length === 0) return toast.error("Select at least one customer.");

    setIsSending(true);
    try {
      const res = await fetch("/api/crm/events/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId: appUser?.company_id,
          eventType: activeTab,
          customerIds: selectedIds,
          templateName: config.template_name,
          templateLang: config.template_lang,
          templateNamespace: config.template_namespace,
          paramMapping: config.param_mapping,
          triggerType: activeTrigger
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);

      toast.success(`Sent ${json.sent} message(s)${json.failed ? `, ${json.failed} failed` : ""}.`);
      loadTabData();
    } catch (err: any) {
      toast.error(err.message || "Failed to send messages.");
    } finally {
      setIsSending(false);
    }
  };

  const unsentIds = matchingCustomers.filter((c) => !sentLogIds.has(c.id)).map((c) => c.id);

  return (
    <div className="space-y-6">
      {/* EVENT TYPE SWITCHER */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="inline-flex bg-slate-100 p-1 rounded-xl border border-slate-200">
          <button
            onClick={() => setActiveTab("birthday")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === "birthday" ? "bg-white text-rose-600 shadow-sm" : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <Cake className="w-4 h-4" /> Birthday Campaigns
          </button>
          <button
            onClick={() => setActiveTab("anniversary")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === "anniversary" ? "bg-white text-purple-600 shadow-sm" : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <Heart className="w-4 h-4" /> Anniversary Campaigns
          </button>
        </div>

        <Button variant="outline" size="sm" onClick={loadTabData} disabled={isLoading}>
          <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isLoading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      {/* CONFIGURATION CARD */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-600" />
            {activeTab === "birthday" ? "Birthday" : "Anniversary"} Dispatch Configuration
          </CardTitle>
          <div className="flex items-center gap-2">
            <Label className="text-xs font-semibold text-slate-600">Active</Label>
            <Switch
              checked={config.is_enabled}
              onCheckedChange={(v) => setConfig({ ...config, is_enabled: v })}
            />
          </div>
        </CardHeader>

        <CardContent className="p-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* 1. MODE */}
          <div className="space-y-1.5">
            <Label className="text-[10px] font-bold uppercase text-slate-500">Dispatch Mode</Label>
            <Select value={config.mode} onValueChange={(v: any) => setConfig({ ...config, mode: v })}>
              <SelectTrigger className="h-9 text-xs font-semibold">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Auto Mode (Daily 9 AM IST)</SelectItem>
                <SelectItem value="manual">Manual Mode (Select & Send)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 2. CONDITION */}
          <div className="flex flex-wrap gap-2">
  {[
    { id: "event_month", label: "1. In Event Month" },
    { id: "days_before", label: "2. X Days Before" },
    { id: "exact_day", label: "3. Exact Event Day" },
  ].map((t) => (
    <Button
      key={t.id}
      type="button"
      size="sm"
      variant={activeTrigger === t.id ? "default" : "outline"}
      className={activeTrigger === t.id ? "bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold" : "text-xs font-semibold"}
      onClick={() => setActiveTrigger(t.id as TriggerType)}
    >
      {t.label}
    </Button>
  ))}
</div>

          {/* 3. DAYS BEFORE (Conditional) */}
          {activeTrigger === "days_before" && ( // 👈 was config.trigger_type
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold uppercase text-slate-500">Days Before</Label>
              <Input
                type="number"
                min={1}
                max={30}
                className="h-9 text-xs font-bold"
                value={config.days_before}
                onChange={(e) => setConfig({ ...config, days_before: Number(e.target.value) })}
              />
            </div>
          )}

          {/* 4. TEMPLATE PICKER */}
          <div className="space-y-1.5">
            <Label className="text-[10px] font-bold uppercase text-slate-500">WhatsApp Template</Label>
            {templates.length > 0 ? (
              <Select
                value={config.template_name}
                onValueChange={(v) => setConfig({ ...config, template_name: v })}
              >
                <SelectTrigger className="h-9 text-xs font-mono">
                  <SelectValue placeholder="Choose template..." />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((t: any) => {
                    const name = t.name || t.template_name;
                    return (
                      <SelectItem key={name} value={name} className="text-xs font-mono">
                        {name}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            ) : (
              <Input
                placeholder="e.g. birthday_wish_offer"
                className="h-9 text-xs font-mono"
                value={config.template_name}
                onChange={(e) => setConfig({ ...config, template_name: e.target.value })}
              />
            )}
          </div>

          {/* 5. VARIABLE MAPPING */}
          <div className="space-y-1.5 md:col-span-2">
            <Label className="text-[10px] font-bold uppercase text-slate-500">
              Template Variables (comma-separated: customer_name, event_date, event_month)
            </Label>
            <Input
              className="h-9 text-xs font-mono"
              placeholder="customer_name, event_date"
              value={config.param_mapping}
              onChange={(e) => setConfig({ ...config, param_mapping: e.target.value })}
            />
          </div>

          <div className="flex items-end md:col-span-2 justify-end">
            <Button onClick={handleSaveSettings} disabled={isSaving} className="h-9 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-6">
              {isSaving ? <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-2" />}
              Save Settings
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ELIGIBLE CUSTOMERS LIST (MANUAL SEND & PREVIEW) */}
      <Card className="border-slate-200 shadow-sm overflow-hidden">
        <CardHeader className="py-3 px-5 bg-slate-50 border-b border-slate-200 flex flex-row items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Matching Customers ({matchingCustomers.length})
            </CardTitle>
            <Badge variant="secondary" className="text-[10px]">
              {unsentIds.length} Pending
            </Badge>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              disabled={unsentIds.length === 0}
              onClick={() => setSelectedIds(selectedIds.length === unsentIds.length ? [] : unsentIds)}
            >
              {selectedIds.length === unsentIds.length && unsentIds.length > 0 ? "Deselect All" : "Select All Pending"}
            </Button>
            <Button
              size="sm"
              className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold"
              disabled={isSending || selectedIds.length === 0}
              onClick={handleManualSend}
            >
              {isSending ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Send className="w-3.5 h-3.5 mr-1.5" />}
              Send Selected ({selectedIds.length})
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-50/70 border-b border-slate-200 text-[10px] uppercase text-slate-500">
              <tr>
                <th className="p-3 w-10 text-center"></th>
                <th className="p-3 text-left">Customer</th>
                <th className="p-3 text-left">Phone</th>
                <th className="p-3 text-left">{activeTab === "birthday" ? "Birth Date" : "Anniversary Date"}</th>
                <th className="p-3 text-center">{currentYear} Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {matchingCustomers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-400">
                  No customers match this {activeTrigger.replace("_", " ")} rule.
                  </td>
                </tr>
              ) : (
                matchingCustomers.map((c) => {
                  const isSent = sentLogIds.has(c.id);
                  const isChecked = selectedIds.includes(c.id);
                  const rawDate = activeTab === "birthday" ? c.birth_date : c.anniversary_date;

                  return (
                    <tr key={c.id} className={isChecked ? "bg-indigo-50/40" : "hover:bg-slate-50"}>
                      <td className="p-3 text-center">
                        <Checkbox
                          disabled={isSent}
                          checked={isChecked}
                          onCheckedChange={() =>
                            setSelectedIds((prev) => (prev.includes(c.id) ? prev.filter((id) => id !== c.id) : [...prev, c.id]))
                          }
                        />
                      </td>
                      <td className="p-3 font-bold text-slate-800">{c.full_name}</td>
                      <td className="p-3 font-mono text-slate-600">{c.phone}</td>
                      <td className="p-3 font-medium text-slate-700">
                        {rawDate ? format(new Date(rawDate), "dd MMM yyyy") : "-"}
                      </td>
                      <td className="p-3 text-center">
                        {isSent ? (
                          <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]">
                            <CheckCircle2 className="w-3 h-3 mr-1" /> Sent
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50 text-[10px]">
                            <Clock className="w-3 h-3 mr-1" /> Pending
                          </Badge>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}