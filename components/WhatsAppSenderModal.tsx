"use client";

import React, { useState, useEffect } from 'react';
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Loader2, Send, MessageSquare, AlertCircle } from 'lucide-react';

interface Recipient {
  phone: string;
  name?: string;
  [key: string]: any; // Allow passing extra data like voucher_code, expiry_date
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  recipients: Recipient[];
  defaultTemplateName?: string; // Auto-select a template (useful for the Voucher/Track page)
}

export function WhatsAppSenderModal({ isOpen, onClose, recipients, defaultTemplateName }: Props) {
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [variables, setVariables] = useState<Record<string, string>>({});

  // 1. Fetch templates when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchTemplates();
    }
  }, [isOpen]);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/whatsapp', {
        method: 'POST',
        body: JSON.stringify({ action: 'template.list', payload: {} })
      });
      const data = await res.json();
      const approvedTemplates = (data.data || []).filter((t: any) => t.status !== 'rejected');
      setTemplates(approvedTemplates);

      // Auto-select template if provided via props
      if (defaultTemplateName) {
        const match = approvedTemplates.find((t: any) => t.name === defaultTemplateName);
        if (match) handleTemplateSelect(match);
      }
    } catch (err) {
      toast.error("Failed to load templates.");
    } finally {
      setLoading(false);
    }
  };

  // 2. Parse variables when a template is selected
  const handleTemplateSelect = (template: any) => {
    setSelectedTemplate(template);
    
    // Find the BODY component and extract {{1}}, {{2}}, etc.
    const bodyComponent = template.components?.find((c: any) => c.type === 'BODY');
    const text = bodyComponent?.text || '';
    
    const matches = text.match(/\{\{(\d+)\}\}/g) || [];
    const newVariables: Record<string, string> = {};
    
    matches.forEach((match: string) => {
      const num = match.replace(/[{}]/g, ''); // Extract '1' from '{{1}}'
      // Try to auto-fill based on the first recipient (useful for single-send)
      if (num === '1' && recipients.length === 1) newVariables[num] = recipients[0].name || '';
      else newVariables[num] = '';
    });
    
    setVariables(newVariables);
  };

  const handleVariableChange = (num: string, val: string) => {
    setVariables(prev => ({ ...prev, [num]: val }));
  };

  // 3. Generate Preview Text
  const getPreviewText = () => {
    if (!selectedTemplate) return '';
    const body = selectedTemplate.components?.find((c: any) => c.type === 'BODY')?.text || '';
    return body.replace(/\{\{(\d+)\}\}/g, (match: string, number: string) => {
      return variables[number] ? variables[number] : `[Var ${number}]`;
    });
  };

  // 4. Send Message Logic
  const handleSend = async () => {
    if (!selectedTemplate) return toast.error("Please select a template.");
    if (recipients.length === 0) return toast.error("No recipients selected.");

    setSending(true);

    try {
      // Map state variables to the Convo360 format: {"BODY_{{1}}": "Value"}
      const formattedParams: Record<string, string> = {};
      Object.keys(variables).forEach(key => {
        formattedParams[`BODY_{{${key}}}`] = variables[key];
      });

      // If multiple recipients, use the Bulk Broadcast endpoint
      if (recipients.length > 1) {
        const phoneList = recipients.map(r => r.phone).join(',');
        
        await fetch('/api/whatsapp', {
          method: 'POST',
          body: JSON.stringify({
            action: 'broadcast.bulk',
            payload: {
              user_id_list: phoneList,
              wa_template: {
                namespace: selectedTemplate.namespace || "", // From template data
                name: selectedTemplate.name,
                lang: selectedTemplate.language,
                use_default_values: "yes",
                params: formattedParams
              }
            }
          })
        });
        toast.success(`Broadcast sent to ${recipients.length} contacts!`);
      } 
      // If single recipient, use Direct Send endpoint
      else {
        await fetch('/api/whatsapp', {
          method: 'POST',
          body: JSON.stringify({
            action: 'message.sendDirect',
            payload: {
              user_id: recipients[0].phone,
              create_if_not_found: "yes",
              content: {
                namespace: selectedTemplate.namespace || "",
                name: selectedTemplate.name,
                lang: selectedTemplate.language,
                params: formattedParams
              }
            }
          })
        });
        toast.success(`Message sent to ${recipients[0].name || recipients[0].phone}!`);
      }

      onClose();
    } catch (error) {
      toast.error("Failed to send message(s). Check API connection.");
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[600px] bg-white rounded-2xl border-slate-200">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-bold text-slate-800">
            <MessageSquare className="w-5 h-5 text-emerald-600" /> WhatsApp Messenger
          </DialogTitle>
          <DialogDescription>
            Sending to <strong className="text-slate-800">{recipients.length} recipient(s)</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
          
          {/* LEFT: Controls */}
          <div className="space-y-5">
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Select Template</Label>
              {loading ? (
                <div className="h-10 bg-slate-100 rounded-lg animate-pulse flex items-center px-3 text-xs text-slate-400">Loading templates...</div>
              ) : (
                <Select value={selectedTemplate?.name || ''} onValueChange={(val) => handleTemplateSelect(templates.find(t => t.name === val))}>
                  <SelectTrigger className="h-10 rounded-lg bg-slate-50 text-sm">
                    <SelectValue placeholder="Choose an approved template" />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map(t => (
                      <SelectItem key={t.name} value={t.name} className="text-xs font-mono">{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Dynamic Variable Inputs */}
            {selectedTemplate && Object.keys(variables).length > 0 && (
              <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-100">
                <Label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <AlertCircle className="w-3 h-3" /> Map Template Variables
                </Label>
                {Object.keys(variables).map(num => (
                  <div key={num} className="flex items-center gap-3">
                    <span className="bg-emerald-100 text-emerald-800 font-mono text-[10px] font-bold px-1.5 py-0.5 rounded">
                      {`{{${num}}}`}
                    </span>
                    <Input 
                      className="h-8 text-xs bg-white" 
                      placeholder={`Value for {{${num}}}`}
                      value={variables[num]}
                      onChange={(e) => handleVariableChange(num, e.target.value)}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* RIGHT: Live Preview */}
          <div className="bg-[#efeae2] p-4 rounded-xl border border-slate-200 shadow-inner flex flex-col">
            <Label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-3 text-center">Live Preview</Label>
            
            {selectedTemplate ? (
              <div className="bg-white p-3 rounded-2xl rounded-tl-none shadow-sm text-sm text-slate-800 font-medium whitespace-pre-wrap leading-snug">
                {selectedTemplate.components?.find((c: any) => c.type === 'HEADER')?.text && (
                  <div className="font-bold mb-1">{selectedTemplate.components.find((c: any) => c.type === 'HEADER').text}</div>
                )}
                
                {getPreviewText()}
                
                <div className="text-[9px] text-right text-slate-400 mt-2">10:42 AM ✓✓</div>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-xs font-medium text-slate-400 text-center">
                Select a template to view how it will appear on the customer's phone.
              </div>
            )}
          </div>

        </div>

        <DialogFooter className="border-t pt-4">
          <Button variant="ghost" onClick={onClose} className="text-slate-500">Cancel</Button>
          <Button onClick={handleSend} disabled={sending || !selectedTemplate} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold">
            {sending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
            {sending ? 'Sending...' : 'Send Message'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}