"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  X, MessageCircle, Loader2, Search,
  Phone, FileText, CheckCircle2, AlertCircle, UserPlus, Send, Link as LinkIcon
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabaseClient";

interface Recipient {
  phone: string;
  name: string;
  user_id?: string;
  customer_db_id?: string;
  voucher_code?: string;
  expiry_date?: string;
}

interface WhatsAppSenderModalProps {
  isOpen: boolean;
  onClose: () => void;
  recipients: Recipient[];
  defaultTemplateName?: string;
}

type ModalStep = "compose" | "resolving" | "ready" | "sending";

export function WhatsAppSenderModal({
  isOpen,
  onClose,
  recipients,
  defaultTemplateName,
}: WhatsAppSenderModalProps) {
  const { toast } = useToast();

  // --- Template state ---
  const [templates, setTemplates] = useState<any[]>([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
  const [selectedTemplateName, setSelectedTemplateName] = useState<string>("");

  // --- Variable Mapping State ---
  const [paramMapping, setParamMapping] = useState<Record<number, string>>({
    1: "name",
    2: "voucher_code",
    3: "expiry_date"
  });

  // --- Recipient state ---
  const [resolvedRecipients, setResolvedRecipients] = useState<Recipient[]>([]);
  const [selectedPhones, setSelectedPhones] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");

  // --- Flow step state ---
  const [step, setStep] = useState<ModalStep>("compose");
  const [resolveProgress, setResolveProgress] = useState({ current: 0, total: 0, failed: 0 });
  const [sendProgress, setSendProgress] = useState({ current: 0, total: 0 });

  // --- Init ---
  useEffect(() => {
    if (isOpen) {
      fetchTemplates();
      setResolvedRecipients(recipients.map(r => ({ ...r })));
      setSelectedPhones(new Set(recipients.filter(r => r.phone).map(r => r.phone)));
      setSearchQuery("");
      setStep("compose");
      setResolveProgress({ current: 0, total: 0, failed: 0 });
      setSendProgress({ current: 0, total: 0 });
    }
  }, [isOpen, recipients]);

  const fetchTemplates = async () => {
    setIsLoadingTemplates(true);
    try {
      const res = await fetch("/api/whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // 👇 ADDED: payload: { limit: 100 } to fetch all templates
        body: JSON.stringify({ 
          action: "template.list", 
          payload: { limit: 100 } 
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Failed to fetch templates");
      
      const fetched = Array.isArray(json.data) ? json.data : (json.templates || []);
      setTemplates(fetched);
      
      if (defaultTemplateName && fetched.find((t: any) => t.name === defaultTemplateName)) {
        setSelectedTemplateName(defaultTemplateName);
      } else if (fetched.length > 0) {
        setSelectedTemplateName(fetched[0].name);
      }
    } catch (error: any) {
      toast({ title: "Template Error", description: error.message, variant: "destructive" });
    } finally {
      setIsLoadingTemplates(false);
    }
  };

  // --- Derived Data ---
  const activeTemplate = useMemo(
    () => templates.find(t => t.name === selectedTemplateName) || null,
    [templates, selectedTemplateName]
  );

  // Auto-detect the number of required parameters via Regex
  const expectedVarCount = useMemo(() => {
    if (!activeTemplate) return 0;
    const texts = [
      activeTemplate.components?.find((c: any) => c.type === "BODY")?.text || "",
      activeTemplate.components?.find((c: any) => c.type === "HEADER")?.text || "",
    ].join(" ");
    
    const matches = [...texts.matchAll(/\{\{(\d+)\}\}/g)];
    if (matches.length === 0) return 0;
    return Math.max(...matches.map(m => parseInt(m[1], 10)));
  }, [activeTemplate]);

  const filteredRecipients = useMemo(() => {
    const list = step === "compose" ? recipients : resolvedRecipients;
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter(r =>
      r.name.toLowerCase().includes(q) ||
      r.phone.includes(q) ||
      (r.voucher_code && r.voucher_code.toLowerCase().includes(q))
    );
  }, [recipients, resolvedRecipients, searchQuery, step]);

  const missingCount = useMemo(
    () => recipients.filter(r => selectedPhones.has(r.phone) && !r.user_id).length,
    [recipients, selectedPhones]
  );

  const resolvedMissingCount = useMemo(
    () => resolvedRecipients.filter(r => selectedPhones.has(r.phone) && !r.user_id).length,
    [resolvedRecipients, selectedPhones]
  );

  // Resolves the exact array needed for the current template
  const resolveDynamicVariables = (recipient: Recipient) => {
    const vars: string[] = [];
    for (let i = 1; i <= expectedVarCount; i++) {
      const mappedField = paramMapping[i];
      if (mappedField === "name") vars.push(recipient.name || "Customer");
      else if (mappedField === "voucher_code") vars.push(recipient.voucher_code || "N/A");
      else if (mappedField === "expiry_date") vars.push(recipient.expiry_date || "N/A");
      else if (mappedField === "phone") vars.push(recipient.phone || "N/A");
      else vars.push("N/A");
    }
    return vars;
  };

  const getPreviewText = () => {
    if (!activeTemplate) return "No template selected.";
    const body = activeTemplate.components?.find((c: any) => c.type === "BODY");
    let text = body?.text || activeTemplate.name;

    const preview = recipients.find(r => selectedPhones.has(r.phone)) || recipients[0];
    if (!preview || expectedVarCount === 0) return text;

    const vars = resolveDynamicVariables(preview);
    return text.replace(/\{\{(\d+)\}\}/g, (_: string, n: string) => {
      const i = parseInt(n, 10) - 1;
      return vars[i] !== undefined ? `[${vars[i]}]` : `{{${n}}}`;
    });
  };

  // --- Checkbox actions ---
  const toggleRecipient = (phone: string) => {
    const s = new Set(selectedPhones);
    s.has(phone) ? s.delete(phone) : s.add(phone);
    setSelectedPhones(s);
  };

  const toggleAll = () => {
    if (selectedPhones.size === filteredRecipients.length) setSelectedPhones(new Set());
    else setSelectedPhones(new Set(filteredRecipients.map(r => r.phone)));
  };

  // --- Broadcast Engine ---
  const handleResolveIds = async () => {
    const targets = recipients.filter(r => selectedPhones.has(r.phone));
    const needsResolve = targets.filter(r => !r.user_id);

    if (needsResolve.length === 0) {
      setResolvedRecipients(targets);
      setStep("ready");
      return;
    }

    setStep("resolving");
    setResolveProgress({ current: 0, total: needsResolve.length, failed: 0 });

    const updated = [...recipients.map(r => ({ ...r }))];
    let failed = 0;
    const chunkSize = 5;

    for (let i = 0; i < needsResolve.length; i += chunkSize) {
      const chunk = needsResolve.slice(i, i + chunkSize);

      await Promise.all(
        chunk.map(async (recipient) => {
          try {
            const res = await fetch("/api/whatsapp", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                action: "subscriber.createByPhone",
                payload: { phone: recipient.phone, name: recipient.name },
              }),
            });

            const json = await res.json();
            if (!res.ok) { failed++; return; }

            const convo360UserId: string = json.user_id || json.data?.user_id || json.subscriber?.user_id || json.id || recipient.phone;

            if (recipient.customer_db_id) {
              await supabase.from("customers").update({ convo360_user_id: convo360UserId }).eq("id", recipient.customer_db_id);
            }

            const idx = updated.findIndex(r => r.phone === recipient.phone);
            if (idx !== -1) updated[idx].user_id = convo360UserId;
          } catch (e: any) {
            failed++;
          }
        })
      );

      setResolveProgress(prev => ({
        current: Math.min(prev.current + chunk.length, needsResolve.length),
        total: needsResolve.length,
        failed,
      }));

      if (i + chunkSize < needsResolve.length) await new Promise(r => setTimeout(r, 300));
    }

    setResolvedRecipients(updated);
    setStep("ready");
    if (failed > 0) toast({ title: `${failed} subscribers failed creation`, variant: "destructive" });
  };

  const handleBroadcast = async () => {
    if (!activeTemplate) return toast({ title: "No template selected", variant: "destructive" });

    const targets = resolvedRecipients.filter(r => selectedPhones.has(r.phone) && r.user_id);
    if (targets.length === 0) return toast({ title: "No valid recipients", variant: "destructive" });

    setStep("sending");
    setSendProgress({ current: 0, total: targets.length });

    let successCount = 0, failCount = 0, lastError = "";
    const chunkSize = 10;

    for (let i = 0; i < targets.length; i += chunkSize) {
      const chunk = targets.slice(i, i + chunkSize);

      await Promise.all(
        chunk.map(async (recipient) => {
          const variables = resolveDynamicVariables(recipient); // Resolves exact count
          try {
            const res = await fetch("/api/whatsapp", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                action: "message.sendDirect",
                payload: {
                  user_id: recipient.user_id,
                  template_name: activeTemplate.name,
                  lang: activeTemplate.language || "en",
                  namespace: activeTemplate.namespace || "",
                  parameters: variables, // If count is 0, this sends []
                },
              }),
            });

            if (!res.ok) {
              const err = await res.json().catch(() => ({}));
              failCount++;
              lastError = err.message || JSON.stringify(err);
            } else {
              successCount++;
            }
          } catch (e: any) {
            failCount++;
            lastError = e.message;
          }
        })
      );

      setSendProgress(prev => ({ current: Math.min(prev.current + chunk.length, targets.length), total: targets.length }));
      if (i + chunkSize < targets.length) await new Promise(r => setTimeout(r, 500));
    }

    if (failCount > 0) {
      toast({ title: "Broadcast finished with errors", description: `${successCount} sent. ${failCount} failed.`, variant: "destructive" });
      setStep("ready");
    } else {
      toast({ title: "Broadcast complete", description: `Successfully sent to ${successCount} recipients.` });
      setTimeout(onClose, 1500);
    }
  };

  const isBusy = step === "resolving" || step === "sending";

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !isBusy && !open && onClose()}>
      {/* MOBILE-OPTIMIZED CONTAINER */}
      <DialogContent className="w-full max-w-5xl h-[100dvh] sm:h-[85vh] sm:max-h-[800px] m-0 sm:m-auto rounded-none sm:rounded-2xl flex flex-col p-0 overflow-hidden bg-slate-50 border-slate-200 shadow-2xl">

        {/* HEADER */}
        <DialogHeader className="bg-white border-b border-slate-200 px-4 sm:px-6 py-4 shrink-0 flex flex-row items-center justify-between z-10">
          <div>
            <DialogTitle className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-[#25D366]" />
              WhatsApp Broadcast
            </DialogTitle>
            <DialogDescription className="text-[11px] sm:text-xs font-medium text-slate-500 mt-1 hidden sm:block">
              Select a template, map variables, resolve IDs, and broadcast.
            </DialogDescription>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} disabled={isBusy} className="text-slate-400 hover:text-slate-700 h-8 w-8">
            <X className="w-5 h-5" />
          </Button>
        </DialogHeader>

        {/* PROGRESS OVERLAYS */}
        {step === "resolving" && (
          <div className="absolute inset-0 z-50 bg-white/95 backdrop-blur-sm flex flex-col items-center justify-center gap-6">
            <div className="flex flex-col items-center gap-3 text-center px-8">
              <UserPlus className="w-10 h-10 text-indigo-500 animate-pulse" />
              <p className="text-base font-black text-slate-900">Creating Subscribers</p>
              <p className="text-xs text-slate-500 font-medium max-w-xs">
                Registering {resolveProgress.total} contacts. Do not close this window.
              </p>
            </div>
            <div className="w-64 sm:w-72 bg-slate-100 rounded-full h-2.5 overflow-hidden">
              <div className="bg-indigo-500 h-2.5 rounded-full transition-all duration-300" style={{ width: `${resolveProgress.total ? (resolveProgress.current / resolveProgress.total) * 100 : 0}%` }} />
            </div>
            <p className="text-sm font-bold text-slate-700">{resolveProgress.current} / {resolveProgress.total}</p>
          </div>
        )}

        {/* BANNERS */}
        {step === "compose" && missingCount > 0 && (
          <div className="bg-amber-50 border-b border-amber-200 px-4 sm:px-6 py-2.5 flex items-start gap-2 shrink-0 z-10">
            <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <p className="text-[11px] sm:text-xs font-semibold text-amber-700 leading-tight">
              <span className="font-black">{missingCount} of {selectedPhones.size}</span> selected recipients need a Convo360 ID. Click Resolve & Continue to auto-generate them.
            </p>
          </div>
        )}
        {step === "ready" && resolvedMissingCount === 0 && (
          <div className="bg-emerald-50 border-b border-emerald-200 px-4 sm:px-6 py-2.5 flex items-center gap-2 shrink-0 z-10">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            <p className="text-[11px] sm:text-xs font-semibold text-emerald-700 leading-tight">
              All subscribers resolved. Ready to broadcast to <span className="font-black">{resolvedRecipients.filter(r => selectedPhones.has(r.phone) && r.user_id).length}</span> recipients.
            </p>
          </div>
        )}

        {/* SPLIT CONTENT FOR DESKTOP / STACKED FOR MOBILE */}
        <div className="flex flex-col md:flex-row flex-1 overflow-y-auto md:overflow-hidden">

          {/* LEFT PANE — Template & Mapping */}
          <div className="w-full md:w-[40%] bg-white border-b md:border-b-0 md:border-r border-slate-200 shrink-0 md:flex md:flex-col overflow-y-auto">
            <div className="p-4 sm:p-6 space-y-6">

              {/* 1. Template Selection */}
              <div className="space-y-2.5">
                <Label className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5" /> 1. Select Template
                </Label>
                {isLoadingTemplates ? (
                  <div className="h-10 border border-slate-200 rounded-lg flex items-center px-3 bg-slate-50">
                    <Loader2 className="w-4 h-4 animate-spin text-slate-400 mr-2" />
                    <span className="text-xs text-slate-500">Syncing with Meta...</span>
                  </div>
                ) : (
                  <Select value={selectedTemplateName} onValueChange={setSelectedTemplateName} disabled={isBusy}>
                    <SelectTrigger className="h-10 bg-white border-slate-200 shadow-sm font-semibold text-sm">
                      <SelectValue placeholder="Select a template" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[300px] overflow-y-auto custom-scrollbar">
                      {templates.map(t => (
                        <SelectItem key={t.name} value={t.name} className="font-medium text-sm">{t.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {/* 2. Live Preview */}
              <div className="space-y-2.5">
                <Label className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> 2. Live Preview
                </Label>
                <div className="bg-[#EFEAE2] rounded-xl p-4 shadow-inner relative overflow-hidden">
                  <div className="bg-white rounded-lg rounded-tl-none p-3 shadow-sm relative z-10 text-sm text-[#111B21] leading-relaxed whitespace-pre-wrap border border-slate-100">
                    {getPreviewText()}
                    <span className="block text-right text-[9px] text-slate-400 mt-2">Just now</span>
                  </div>
                </div>
              </div>

              {/* 3. Variable Mapping (Only shown if template has parameters) */}
              {expectedVarCount > 0 ? (
                <div className="space-y-3 pt-4 border-t border-slate-100">
                  <div className="flex justify-between items-center">
                    <Label className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                      <LinkIcon className="w-3.5 h-3.5 text-indigo-500" /> 3. Map Variables
                    </Label>
                    <Badge variant="outline" className="text-[9px] bg-slate-50">{expectedVarCount} Required</Badge>
                  </div>
                  
                  <div className="space-y-2.5 bg-slate-50/50 p-3 rounded-xl border border-slate-200 border-dashed">
                    {Array.from({ length: expectedVarCount }).map((_, idx) => {
                      const varIndex = idx + 1;
                      return (
                        <div key={varIndex} className="flex items-center gap-3">
                          <Badge variant="secondary" className="bg-slate-200/50 text-slate-600 font-mono shrink-0 shadow-none border border-slate-200">
                            {`{{${varIndex}}}`}
                          </Badge>
                          <Select
                            value={paramMapping[varIndex] || ""}
                            onValueChange={(val) => setParamMapping(prev => ({ ...prev, [varIndex]: val }))}
                            disabled={isBusy}
                          >
                            <SelectTrigger className="h-8 text-xs bg-white border-slate-200 shadow-sm">
                              <SelectValue placeholder="Select data field" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="name">Customer Name</SelectItem>
                              <SelectItem value="voucher_code">Voucher Code</SelectItem>
                              <SelectItem value="expiry_date">Expiry Date</SelectItem>
                              <SelectItem value="phone">Phone Number</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="bg-emerald-50 border border-emerald-100 p-3 rounded-lg flex items-center gap-2 mt-4">
                   <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                   <p className="text-[10px] text-emerald-700 font-medium">This template requires no variables. It is ready to send as-is.</p>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT PANE — Recipient Table */}
          <div className="w-full md:w-[60%] flex flex-col bg-slate-50 shrink-0 min-h-[400px] md:min-h-0">
            <div className="p-3 sm:p-4 border-b border-slate-200 bg-white shrink-0 flex items-center justify-between gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Search name, phone..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-9 text-xs sm:text-sm bg-slate-50 border-slate-200 focus-visible:ring-[#25D366]"
                />
              </div>
              <Badge variant="secondary" className="bg-[#25D366]/10 text-[#25D366] border-[#25D366]/20 font-bold shrink-0 shadow-none text-[10px] sm:text-xs py-1">
                {selectedPhones.size} / {filteredRecipients.length} Selected
              </Badge>
            </div>

            <div className="flex-1 overflow-y-auto p-2 sm:p-3">
              <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto shadow-sm">
                <table className="w-full text-left text-xs whitespace-nowrap">
                  <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                    <tr>
                      <th className="p-3 w-10 text-center">
                        <Checkbox
                          checked={selectedPhones.size === filteredRecipients.length && filteredRecipients.length > 0}
                          onCheckedChange={toggleAll}
                          disabled={isBusy}
                          className="border-slate-300 data-[state=checked]:bg-[#25D366] data-[state=checked]:border-[#25D366]"
                        />
                      </th>
                      <th className="p-3 font-bold text-slate-500 uppercase tracking-widest">Recipient</th>
                      {expectedVarCount > 0 && <th className="p-3 font-bold text-slate-500 uppercase tracking-widest hidden sm:table-cell">Variables Preview</th>}
                      <th className="p-3 font-bold text-slate-500 uppercase tracking-widest text-center border-l border-slate-100">ID Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRecipients.length === 0 ? (
                      <tr><td colSpan={4} className="p-8 text-center text-slate-400 font-medium">No recipients found.</td></tr>
                    ) : (
                      filteredRecipients.map(r => {
                        const isSelected = selectedPhones.has(r.phone);
                        const vars = resolveDynamicVariables(r);
                        const displayRecipient = step !== "compose" ? resolvedRecipients.find(rr => rr.phone === r.phone) || r : r;
                        const hasId = Boolean(displayRecipient.user_id);

                        return (
                          <tr
                            key={r.phone}
                            className={`border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors cursor-pointer ${isSelected ? "bg-emerald-50/30" : ""}`}
                            onClick={() => !isBusy && toggleRecipient(r.phone)}
                          >
                            <td className="p-3 text-center">
                              <Checkbox
                                checked={isSelected}
                                disabled={isBusy}
                                className="border-slate-300 data-[state=checked]:bg-[#25D366] data-[state=checked]:border-[#25D366]"
                                onClick={e => e.stopPropagation()}
                                onCheckedChange={() => toggleRecipient(r.phone)}
                              />
                            </td>
                            <td className="p-3">
                              <p className="font-bold text-slate-900">{r.name}</p>
                              <p className="font-medium text-slate-500 mt-0.5 flex items-center gap-1">
                                <Phone className="w-3 h-3" /> {r.phone}
                              </p>
                            </td>
                            {expectedVarCount > 0 && (
                              <td className="p-3 hidden sm:table-cell">
                                <div className="flex flex-col gap-1">
                                  {vars.map((v, idx) => (
                                    <span key={idx} className="inline-flex max-w-[120px] truncate text-[9px] font-bold uppercase tracking-widest text-indigo-600 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded">
                                      {`{{${idx + 1}}}: `}<span className="text-slate-700 ml-1 truncate">{v}</span>
                                    </span>
                                  ))}
                                </div>
                              </td>
                            )}
                            <td className="p-3 text-center border-l border-slate-100">
                              {hasId ? (
                                <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase bg-emerald-50 text-emerald-600 border border-emerald-200 px-1.5 py-0.5 rounded shadow-none">
                                  <CheckCircle2 className="w-3 h-3" /> Ready
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase bg-amber-50 text-amber-600 border border-amber-200 px-1.5 py-0.5 rounded shadow-none">
                                  <UserPlus className="w-3 h-3" /> Pending
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        {/* FOOTER ACTIONS */}
        <DialogFooter className="bg-white border-t border-slate-200 p-3 sm:px-6 sm:py-4 shrink-0 sm:justify-between items-center flex-row flex-wrap gap-2 z-10">
          <Button variant="outline" onClick={onClose} disabled={isBusy} className="h-9 sm:h-10 text-slate-500 font-bold text-xs bg-white">
            Cancel
          </Button>

          <div className="flex items-center gap-2 sm:gap-3 flex-1 sm:flex-none justify-end">
            {step === "compose" && missingCount > 0 && (
              <Button
                onClick={handleResolveIds}
                disabled={selectedPhones.size === 0 || !activeTemplate}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-9 sm:h-10 px-4 sm:px-6 rounded-lg sm:rounded-xl shadow-md text-[10px] sm:text-xs uppercase tracking-widest w-full sm:w-auto"
              >
                <UserPlus className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">Resolve & Continue ({missingCount})</span>
                <span className="sm:hidden ml-1.5">Resolve ({missingCount})</span>
              </Button>
            )}

            {step === "compose" && missingCount === 0 && (
              <Button
                onClick={handleResolveIds}
                disabled={selectedPhones.size === 0 || !activeTemplate}
                className="bg-[#25D366] hover:bg-[#20bd5a] text-white font-bold h-9 sm:h-10 px-4 sm:px-6 rounded-lg sm:rounded-xl shadow-md text-[10px] sm:text-xs uppercase tracking-widest w-full sm:w-auto"
              >
                <Send className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">Continue to Broadcast</span>
                <span className="sm:hidden ml-1.5">Broadcast</span>
              </Button>
            )}

            {step === "ready" && (
              <Button
                onClick={handleBroadcast}
                disabled={resolvedRecipients.filter(r => selectedPhones.has(r.phone) && r.user_id).length === 0}
                className="bg-[#25D366] hover:bg-[#20bd5a] text-white font-bold h-9 sm:h-10 px-4 sm:px-6 rounded-lg sm:rounded-xl shadow-md text-[10px] sm:text-xs uppercase tracking-widest w-full sm:w-auto min-w-0 sm:min-w-[200px]"
              >
                <MessageCircle className="w-4 h-4 mr-1.5 sm:mr-2" />
                Send ({resolvedRecipients.filter(r => selectedPhones.has(r.phone) && r.user_id).length})
              </Button>
            )}

            {step === "sending" && (
              <Button disabled className="bg-[#25D366] text-white font-bold h-9 sm:h-10 px-4 sm:px-6 rounded-lg sm:rounded-xl text-[10px] sm:text-xs w-full sm:w-auto min-w-0 sm:min-w-[200px]">
                <Loader2 className="w-4 h-4 animate-spin mr-1.5 sm:mr-2" />
                Sending {sendProgress.current} / {sendProgress.total}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}