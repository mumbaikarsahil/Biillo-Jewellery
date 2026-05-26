"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  X, MessageCircle, Loader2, Search,
  Phone, FileText, CheckCircle2, AlertCircle, UserPlus, Send
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
  /** Convo360's internal user_id — resolved during pre-flight if absent */
  user_id?: string;
  /** The Supabase customers.id — needed to write user_id back to DB */
  customer_db_id?: string;
  voucher_code?: string;
  expiry_date?: string;
  templateParams?: string[];
}

interface WhatsAppSenderModalProps {
  isOpen: boolean;
  onClose: () => void;
  recipients: Recipient[];
  defaultTemplateName?: string;
}

// Step in the modal flow
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
        body: JSON.stringify({ action: "template.list" }),
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

  // --- Derived ---
  const activeTemplate = useMemo(
    () => templates.find(t => t.name === selectedTemplateName) || null,
    [templates, selectedTemplateName]
  );

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

  // Only count missing IDs among currently SELECTED recipients
  const missingCount = useMemo(
    () => recipients.filter(r => selectedPhones.has(r.phone) && !r.user_id).length,
    [recipients, selectedPhones]
  );

  const resolvedMissingCount = useMemo(
    () => resolvedRecipients.filter(r => selectedPhones.has(r.phone) && !r.user_id).length,
    [resolvedRecipients, selectedPhones]
  );

  const resolveVariables = (recipient: Recipient) => {
    if (recipient.templateParams && recipient.templateParams.length > 0) {
      return recipient.templateParams;
    }
    return [
      recipient.name || "Valued Customer",
      recipient.expiry_date || "soon",
      recipient.voucher_code || "",
    ];
  };

  const getPreviewText = () => {
    if (!activeTemplate) return "No template selected.";
    const body = activeTemplate.components?.find((c: any) => c.type === "BODY");
    if (!body) return activeTemplate.name;
    let text = body.text || "";
    const preview =
      recipients.find(r => selectedPhones.has(r.phone)) || recipients[0];
    if (!preview) return text;
    const vars = resolveVariables(preview);
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

  // ─────────────────────────────────────────────────────────────
  // STEP 1 — Resolve missing Convo360 user_ids
  // For each recipient without a user_id:
  //   1. Call subscriber.createByPhone (creates in Convo360 or returns existing)
  //   2. Save the returned user_id back to customers table in Supabase
  // ─────────────────────────────────────────────────────────────
  const handleResolveIds = async () => {
    const targets = recipients.filter(r => selectedPhones.has(r.phone));
    const needsResolve = targets.filter(r => !r.user_id);

    if (needsResolve.length === 0) {
      // Everyone already has an ID — skip straight to sending
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
            // 1. Create subscriber in Convo360
            const res = await fetch("/api/whatsapp", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                action: "subscriber.createByPhone",
                payload: { phone: recipient.phone, name: recipient.name },
              }),
            });

            const json = await res.json();

            if (!res.ok) {
              console.error(`Convo360 create failed for ${recipient.phone}:`, json);
              failed++;
              return;
            }

            // Convo360 returns the subscriber's user_id after creation.
            // Try every known response shape; fall back to phone as last resort.
            const convo360UserId: string =
              json.user_id          // direct top-level
              || json.data?.user_id // nested under data
              || json.subscriber?.user_id
              || json.id
              || recipient.phone;   // safe fallback — phone IS the user_id in Convo360

            // 2. Write user_id back to Supabase customers table
            if (recipient.customer_db_id) {
              const { error: dbError } = await supabase
                .from("customers")
                .update({ convo360_user_id: convo360UserId })
                .eq("id", recipient.customer_db_id);

              if (dbError) {
                console.error(`Supabase update failed for customer ${recipient.customer_db_id}:`, dbError);
                // Non-fatal: we still have the ID in memory for this session
              }
            }

            // 3. Patch our in-memory copy
            const idx = updated.findIndex(r => r.phone === recipient.phone);
            if (idx !== -1) updated[idx].user_id = convo360UserId;

          } catch (e: any) {
            console.error(`Network error resolving ${recipient.phone}:`, e);
            failed++;
          }
        })
      );

      setResolveProgress(prev => ({
        current: Math.min(prev.current + chunk.length, needsResolve.length),
        total: needsResolve.length,
        failed,
      }));

      if (i + chunkSize < needsResolve.length) {
        await new Promise(r => setTimeout(r, 300));
      }
    }

    setResolvedRecipients(updated);
    setStep("ready");

    if (failed > 0) {
      toast({
        title: `${failed} subscriber${failed > 1 ? "s" : ""} could not be created`,
        description: "They will be skipped during broadcast. Check the console for details.",
        variant: "destructive",
      });
    } else {
      toast({
        title: "All subscribers resolved",
        description: `${needsResolve.length} new subscriber${needsResolve.length > 1 ? "s" : ""} created in Convo360 and saved to your database.`,
      });
    }
  };

  // ─────────────────────────────────────────────────────────────
  // STEP 2 — Broadcast
  // ─────────────────────────────────────────────────────────────
  const handleBroadcast = async () => {
    if (!activeTemplate) return toast({ title: "No template selected", variant: "destructive" });

    const targets = resolvedRecipients.filter(
      r => selectedPhones.has(r.phone) && r.user_id
    );

    if (targets.length === 0) {
      return toast({ title: "No valid recipients", description: "All selected recipients are missing a Convo360 user_id.", variant: "destructive" });
    }

    setStep("sending");
    setSendProgress({ current: 0, total: targets.length });

    let successCount = 0;
    let failCount = 0;
    let lastError = "";

    const chunkSize = 10;
    for (let i = 0; i < targets.length; i += chunkSize) {
      const chunk = targets.slice(i, i + chunkSize);

      await Promise.all(
        chunk.map(async (recipient) => {
          const variables = resolveVariables(recipient);
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
                  parameters: variables,
                },
              }),
            });

            if (!res.ok) {
              const err = await res.json().catch(() => ({}));
              console.error(`Send failed for user_id ${recipient.user_id}:`, err);
              failCount++;
              lastError = err.message || err.details?.message || JSON.stringify(err);
            } else {
              successCount++;
            }
          } catch (e: any) {
            console.error(`Network crash for user_id ${recipient.user_id}:`, e);
            failCount++;
            lastError = e.message;
          }
        })
      );

      setSendProgress(prev => ({
        current: Math.min(prev.current + chunk.length, targets.length),
        total: targets.length,
      }));

      if (i + chunkSize < targets.length) {
        await new Promise(r => setTimeout(r, 500));
      }
    }

    if (failCount > 0) {
      toast({
        title: "Broadcast finished with errors",
        description: `${successCount} sent. ${failCount} failed. Last error: ${lastError}`,
        variant: "destructive",
      });
      setStep("ready");
    } else {
      toast({
        title: "Broadcast complete",
        description: `Successfully sent to ${successCount} recipient${successCount !== 1 ? "s" : ""}.`,
      });
      setTimeout(onClose, 1500);
    }
  };

  const isBusy = step === "resolving" || step === "sending";

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !isBusy && !open && onClose()}>
      <DialogContent className="sm:max-w-5xl h-[80vh] max-h-[680px] mt-10 flex flex-col p-0 overflow-hidden bg-slate-50 border-slate-200 shadow-2xl rounded-2xl">

        {/* HEADER */}
        <DialogHeader className="bg-white border-b border-slate-200 px-6 py-4 shrink-0 flex flex-row items-center justify-between">
          <div>
            <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-[#25D366]" />
              WhatsApp Broadcast Studio
            </DialogTitle>
            <DialogDescription className="text-xs font-medium text-slate-500 mt-1">
              Select a template, resolve subscriber IDs, then broadcast.
            </DialogDescription>
          </div>
      
        </DialogHeader>

        {/* RESOLVE PROGRESS OVERLAY */}
        {step === "resolving" && (
          <div className="absolute inset-0 z-50 bg-white/90 backdrop-blur-sm flex flex-col items-center justify-center gap-6 rounded-2xl">
            <div className="flex flex-col items-center gap-3 text-center px-8">
              <UserPlus className="w-10 h-10 text-indigo-500 animate-pulse" />
              <p className="text-base font-bold text-slate-900">Creating Convo360 Subscribers</p>
              <p className="text-xs text-slate-500 font-medium max-w-xs">
                Registering {resolveProgress.total} new contacts and saving their IDs to your database. Do not close this window.
              </p>
            </div>
            <div className="w-72 bg-slate-100 rounded-full h-2.5 overflow-hidden">
              <div
                className="bg-indigo-500 h-2.5 rounded-full transition-all duration-300"
                style={{ width: `${resolveProgress.total ? (resolveProgress.current / resolveProgress.total) * 100 : 0}%` }}
              />
            </div>
            <p className="text-sm font-bold text-slate-700">
              {resolveProgress.current} / {resolveProgress.total}
              {resolveProgress.failed > 0 && (
                <span className="text-rose-500 ml-2">({resolveProgress.failed} failed)</span>
              )}
            </p>
          </div>
        )}

        {/* WARNING BANNER — missing IDs in compose step */}
        {step === "compose" && missingCount > 0 && (
          <div className="bg-amber-50 border-b border-amber-200 px-6 py-2.5 flex items-start gap-2 shrink-0">
            <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <p className="text-xs font-semibold text-amber-700">
              <span className="font-black">{missingCount} of your {selectedPhones.size} selected recipient{missingCount !== 1 ? "s" : ""}</span> have no Convo360 ID yet.
              Click <span className="font-black">Resolve & Continue</span> — they'll be auto-created and saved to your database before sending.
            </p>
          </div>
        )}

        {/* SUCCESS BANNER — all IDs resolved */}
        {step === "ready" && resolvedMissingCount === 0 && (
          <div className="bg-emerald-50 border-b border-emerald-200 px-6 py-2.5 flex items-center gap-2 shrink-0">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            <p className="text-xs font-semibold text-emerald-700">
              All subscribers resolved. Ready to broadcast to{" "}
              <span className="font-black">{resolvedRecipients.filter(r => selectedPhones.has(r.phone) && r.user_id).length}</span> recipients.
            </p>
          </div>
        )}

        {/* SPLIT CONTENT */}
        <div className="flex flex-col md:flex-row flex-1 overflow-hidden">

          {/* LEFT PANE — Template & Preview */}
          <div className="w-full md:w-[40%] bg-white border-r border-slate-200 flex flex-col overflow-y-auto">
            <div className="p-6 flex-1 space-y-6">

              <div className="space-y-2.5">
                <Label className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5" /> 1. Select Template
                </Label>
                {isLoadingTemplates ? (
                  <div className="h-10 border border-slate-200 rounded-lg flex items-center px-3 bg-slate-50">
                    <Loader2 className="w-4 h-4 animate-spin text-slate-400 mr-2" />
                    <span className="text-xs text-slate-500">Syncing with WhatsApp...</span>
                  </div>
                ) : (
                  <Select value={selectedTemplateName} onValueChange={setSelectedTemplateName} disabled={isBusy}>
                    <SelectTrigger className="h-10 bg-white border-slate-200 shadow-sm font-semibold text-sm">
                      <SelectValue placeholder="Select a template" />
                    </SelectTrigger>
                    <SelectContent>
                      {templates.map(t => (
                        <SelectItem key={t.name} value={t.name} className="font-medium text-sm">
                          {t.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

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
                <div className="bg-blue-50 border border-blue-100 p-3 rounded-lg flex gap-2">
                  <AlertCircle className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                  <p className="text-[10px] text-blue-700 font-medium leading-tight">
                    Variables are mapped from each recipient's Name and Expiry Date automatically.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT PANE — Recipient Table */}
          <div className="w-full md:w-[60%] flex flex-col bg-slate-50">
            <div className="p-4 border-b border-slate-200 bg-white shrink-0 flex items-center justify-between gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Search name, phone, or code..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-9 text-xs bg-slate-50 border-slate-200 focus-visible:ring-[#25D366]"
                />
              </div>
              <Badge variant="secondary" className="bg-[#25D366]/10 text-[#25D366] border-[#25D366]/20 font-bold shrink-0">
                {selectedPhones.size} / {filteredRecipients.length} Selected
              </Badge>
            </div>

            <div className="flex-1 overflow-y-auto p-2">
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                <table className="w-full text-left text-xs">
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
                      <th className="p-3 font-bold text-slate-500 uppercase tracking-widest">Variables</th>
                      <th className="p-3 font-bold text-slate-500 uppercase tracking-widest text-center">ID Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRecipients.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="p-8 text-center text-slate-400 font-medium">No recipients found.</td>
                      </tr>
                    ) : (
                      filteredRecipients.map(r => {
                        const isSelected = selectedPhones.has(r.phone);
                        const vars = resolveVariables(r);
                        // In "ready"/"sending" step show resolved data
                        const displayRecipient = step !== "compose"
                          ? resolvedRecipients.find(rr => rr.phone === r.phone) || r
                          : r;
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
                            <td className="p-3">
                              <div className="flex flex-col gap-1">
                                {vars.map((v, idx) => (
                                  <span key={idx} className="inline-flex max-w-[150px] truncate text-[9px] font-bold uppercase tracking-widest text-indigo-600 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded">
                                    {`{{${idx + 1}}}: `}<span className="text-slate-700 ml-1 truncate">{v}</span>
                                  </span>
                                ))}
                              </div>
                            </td>
                            <td className="p-3 text-center">
                              {hasId ? (
                                <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase bg-emerald-50 text-emerald-600 border border-emerald-200 px-1.5 py-0.5 rounded">
                                  <CheckCircle2 className="w-3 h-3" /> Ready
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase bg-amber-50 text-amber-600 border border-amber-200 px-1.5 py-0.5 rounded">
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

        {/* FOOTER */}
        <DialogFooter className="bg-white border-t border-slate-200 px-6 py-4 shrink-0 sm:justify-between items-center flex-row">
          <Button variant="ghost" onClick={onClose} disabled={isBusy} className="text-slate-500 font-semibold text-xs">
            Cancel
          </Button>

          <div className="flex items-center gap-3">
            {/* STEP 1 button — shown when in compose and there are missing IDs */}
            {step === "compose" && missingCount > 0 && (
              <Button
                onClick={handleResolveIds}
                disabled={selectedPhones.size === 0 || !activeTemplate}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-10 px-6 rounded-xl shadow-md text-xs uppercase tracking-widest"
              >
                <UserPlus className="w-4 h-4 mr-2" />
                Resolve & Continue ({missingCount} of {selectedPhones.size} pending)
              </Button>
            )}

            {/* STEP 1 skip — shown when compose and no missing IDs */}
            {step === "compose" && missingCount === 0 && (
              <Button
                onClick={handleResolveIds}
                disabled={selectedPhones.size === 0 || !activeTemplate}
                className="bg-[#25D366] hover:bg-[#20bd5a] text-white font-bold h-10 px-6 rounded-xl shadow-md text-xs uppercase tracking-widest"
              >
                <Send className="w-4 h-4 mr-2" />
                Continue to Broadcast
              </Button>
            )}

            {/* STEP 2 button — shown when ready */}
            {step === "ready" && (
              <Button
                onClick={handleBroadcast}
                disabled={resolvedRecipients.filter(r => selectedPhones.has(r.phone) && r.user_id).length === 0}
                className="bg-[#25D366] hover:bg-[#20bd5a] text-white font-bold h-10 px-6 rounded-xl shadow-md text-xs uppercase tracking-widest min-w-[200px]"
              >
                <MessageCircle className="w-4 h-4 mr-2" />
                Broadcast to {resolvedRecipients.filter(r => selectedPhones.has(r.phone) && r.user_id).length}
              </Button>
            )}

            {/* Sending progress */}
            {step === "sending" && (
              <Button disabled className="bg-[#25D366] text-white font-bold h-10 px-6 rounded-xl min-w-[200px] text-xs">
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Sending {sendProgress.current} / {sendProgress.total}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}