"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { 
  MessageSquare, RefreshCw, Plus, Trash2, Loader2,
  Layers, CheckCircle, Clock, XCircle, Eye, Sparkles 
} from 'lucide-react';

export default function WhatsAppAutomationPage() {
  // Lists & State
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [activeTab, setActiveTab] = useState<'manager' | 'creator'>('manager');

  // Creator Form State (AiSensy/WATI style)
  const [templateName, setTemplateName] = useState('');
  const [category, setCategory] = useState('UTILITY');
  const [language, setLanguage] = useState('en');
  const [headerType, setHeaderType] = useState('NONE');
  const [headerText, setHeaderText] = useState('');
  const [bodyText, setBodyText] = useState('Hi {{1}}, your validation code is {{2}}.');
  const [footerText, setFooterText] = useState('Regards, Pavitram Team');

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/whatsapp', {
        method: 'POST',
        body: JSON.stringify({ action: 'template.list', payload: {} })
      });
      const data = await res.json();
      setTemplates(data.data || []);
    } catch (err) {
      toast.error("Failed to load templates from Convo360 node registry.");
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      await fetch('/api/whatsapp', {
        method: 'POST',
        body: JSON.stringify({ action: 'template.sync', payload: {} })
      });
      toast.success("Meta Network Schema Synced successfully.");
      fetchTemplates();
    } catch (err) {
      toast.error("Network sync command failed.");
    } finally {
      setSyncing(false);
    }
  };

  const handleDelete = async (name: string) => {
    if (!confirm(`Are you sure you want to delete template: ${name}?`)) return;
    try {
      await fetch('/api/whatsapp', {
        method: 'POST',
        body: JSON.stringify({ action: 'template.delete', payload: { name } })
      });
      toast.info("Delete matrix payload emitted.");
      fetchTemplates();
    } catch (err) {
      toast.error("Failed to flag item for deletion.");
    }
  };

  const handleCreateTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!templateName) return toast.error("Template name is mandatory.");
    
    // Clean string template format validation (lowercase, underscores only)
    const cleanName = templateName.toLowerCase().trim().replace(/[^a-z0-9_]/g, '_');

    // Build components array payload structural blueprint matching Meta's native API guidelines
    const components: any[] = [];

    if (headerType === 'TEXT' && headerText) {
      components.push({ type: 'HEADER', format: 'TEXT', text: headerText });
    }
    
    components.push({ type: 'BODY', text: bodyText });

    if (footerText) {
      components.push({ type: 'FOOTER', text: footerText });
    }

    try {
      setLoading(true);
      const res = await fetch('/api/whatsapp', {
        method: 'POST',
        body: JSON.stringify({
          action: 'template.create',
          payload: {
            name: cleanName,
            category,
            language,
            components
          }
        })
      });
      const data = await res.json();

      if (data.status === 'ok') {
        toast.success("Template submitted to Meta pipeline for review!");
        setActiveTab('manager');
        fetchTemplates();
      } else {
        throw new Error(data.message || "Template submission failure.");
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Helper template runtime preview string formatter parser
  const renderPreviewText = (text: string) => {
    return text.replace(/\{\{(\d+)\}\}/g, (match, number) => `[Variable ${number}]`);
  };

  return (
    <div className="min-h-screen bg-slate-50/50 p-6 sm:p-8 font-sans pb-24">
      {/* Top Header Control Bar */}
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 uppercase flex items-center gap-2">
            <MessageSquare className="h-6 w-6 text-emerald-600" /> WhatsApp Campaign Hub
          </h1>
          <p className="text-slate-500 font-medium text-xs mt-1">Manage, design, and sync automated message frameworks directly linked into Meta Business Suite.</p>
        </div>
        
        <div className="flex items-center gap-2 self-start sm:self-center bg-white border rounded-xl p-1 shadow-sm shrink-0">
          <Button 
            variant={activeTab === 'manager' ? 'default' : 'ghost'} 
            size="sm" 
            className="rounded-lg font-bold text-xs"
            onClick={() => setActiveTab('manager')}
          >
            <Layers className="w-3.5 h-3.5 mr-1.5" /> Template Manager
          </Button>
          <Button 
            variant={activeTab === 'creator' ? 'default' : 'ghost'} 
            size="sm" 
            className="rounded-lg font-bold text-xs"
            onClick={() => setActiveTab('creator')}
          >
            <Plus className="w-3.5 h-3.5 mr-1.5" /> Interactive Studio
          </Button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto">
        {/* VIEW A: TEMPLATE MANAGER GRID */}
        {activeTab === 'manager' && (
          <div className="space-y-6">
            <div className="flex justify-end gap-2">
              <Button onClick={handleSync} disabled={syncing} variant="outline" className="h-10 bg-white shadow-sm font-bold text-xs rounded-xl border-slate-200">
                <RefreshCw className={`w-3.5 h-3.5 mr-2 ${syncing ? 'animate-spin' : ''}`} />
                {syncing ? 'Syncing Schema...' : 'Sync Meta Portal'}
              </Button>
            </div>

            <Card className="rounded-2xl overflow-hidden bg-white border border-slate-200/60 shadow-sm">
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow className="border-slate-200/60">
                    <TableHead className="font-bold text-[10px] uppercase tracking-wider h-11">Template Signature Name</TableHead>
                    <TableHead className="font-bold text-[10px] uppercase tracking-wider h-11">Category Core</TableHead>
                    <TableHead className="font-bold text-[10px] uppercase tracking-wider h-11">Language Profile</TableHead>
                    <TableHead className="font-bold text-[10px] uppercase tracking-wider h-11">Meta Approval State</TableHead>
                    <TableHead className="font-bold text-[10px] uppercase tracking-wider h-11 text-right px-6">Terminal</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-8 text-xs font-medium text-slate-400">Querying active routing registry arrays...</TableCell></TableRow>
                  ) : templates.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-12">
                        <MessageSquare className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                        <p className="text-sm font-bold text-slate-700">No message blueprints verified yet</p>
                        <p className="text-xs text-slate-400 mt-1">Open the Interactive Studio to build your first template payload node.</p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    templates.map((t: any) => {
                      // Custom dynamic status mapping parser logic 
                      const status = t.status?.toLowerCase() || 'approved';
                      return (
                        <TableRow key={t.name} className="hover:bg-slate-50/50 border-slate-100">
                          <TableCell className="font-mono font-bold text-xs text-slate-900">{t.name}</TableCell>
                          <TableCell><Badge variant="secondary" className="bg-slate-100 border-none font-bold text-[10px] text-slate-600">{t.category}</Badge></TableCell>
                          <TableCell className="font-semibold text-xs text-slate-600 uppercase font-mono">{t.language}</TableCell>
                          <TableCell>
                            {status === 'approved' && <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 font-bold uppercase text-[9px] tracking-widest gap-1"><CheckCircle className="w-3 h-3"/> Approved</Badge>}
                            {status === 'pending' && <Badge className="bg-amber-50 text-amber-700 border-amber-200 font-bold uppercase text-[9px] tracking-widest gap-1 animate-pulse"><Clock className="w-3 h-3"/> Pending Meta</Badge>}
                            {status === 'rejected' && <Badge className="bg-rose-50 text-rose-700 border-rose-200 font-bold uppercase text-[9px] tracking-widest gap-1"><XCircle className="w-3 h-3"/> Rejected</Badge>}
                          </TableCell>
                          <TableCell className="text-right px-6">
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors" onClick={() => handleDelete(t.name)}>
                              <Trash2 className="h-4 w-4" strokeWidth={1.5} />
                            </Button>
                          </TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            </Card>
          </div>
        )}

        {/* VIEW B: INTERACTIVE STUDIO (AiSensy & WATI Style split-pane) */}
        {activeTab === 'creator' && (
          <form onSubmit={handleCreateTemplate} className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start animate-in fade-in duration-300">
            {/* Left Control Workspace */}
            <div className="lg:col-span-7 space-y-6">
              <Card className="rounded-2xl border-slate-200/60 shadow-sm bg-white p-5 sm:p-6 space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider border-b pb-2 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-emerald-500"/> Configuration Properties
                  </h3>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[11px] font-bold uppercase tracking-widest text-slate-500">Template Identifier Name *</Label>
                  <Input 
                    required 
                    placeholder="e.g. instant_voucher_alert" 
                    className="h-11 rounded-xl text-sm font-medium bg-slate-50/50 focus:bg-white transition-all font-mono lowercase"
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value.replace(/\s+/g, '_'))}
                  />
                  <span className="text-[10px] font-medium text-slate-400 block mt-1">Lowercase strings and underscores only. Spaces are parsed out automatically.</span>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-bold uppercase tracking-widest text-slate-500">Business Category</Label>
                    <Select value={category} onValueChange={setCategory}>
                      <SelectTrigger className="h-11 rounded-xl text-sm bg-slate-50/50">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        <SelectItem value="UTILITY" className="cursor-pointer text-xs font-semibold py-2">UTILITY (Transactional / Alerts)</SelectItem>
                        <SelectItem value="MARKETING" className="cursor-pointer text-xs font-semibold py-2">MARKETING (Promos / Offers)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-bold uppercase tracking-widest text-slate-500">Locale Language</Label>
                    <Select value={language} onValueChange={setLanguage}>
                      <SelectTrigger className="h-11 rounded-xl text-sm bg-slate-50/50">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        <SelectItem value="en" className="cursor-pointer text-xs font-semibold py-2">English (en)</SelectItem>
                        <SelectItem value="hi" className="cursor-pointer text-xs font-semibold py-2">Hindi (hi)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </Card>

              <Card className="rounded-2xl border-slate-200/60 shadow-sm bg-white p-5 sm:p-6 space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider border-b pb-2 flex items-center gap-1.5">
                    <MessageSquare className="w-4 h-4 text-emerald-500"/> Message Template Blueprint Component Structure
                  </h3>
                </div>

                {/* Header Content Config */}
                <div className="space-y-2 border-b pb-4">
                  <Label className="text-[11px] font-bold uppercase tracking-widest text-slate-500">Header Enrichment</Label>
                  <Select value={headerType} onValueChange={setHeaderType}>
                    <SelectTrigger className="h-10 rounded-xl text-xs bg-slate-50/50">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="NONE" className="text-xs py-2">No Header Content</SelectItem>
                      <SelectItem value="TEXT" className="text-xs py-2">Plain Text Headline</SelectItem>
                    </SelectContent>
                  </Select>
                  {headerType === 'TEXT' && (
                    <Input 
                      placeholder="Enter bold title header text..." 
                      className="h-10 rounded-xl text-xs font-bold mt-2" 
                      value={headerText} 
                      onChange={(e) => setHeaderText(e.target.value)}
                      maxLength={60}
                    />
                  )}
                </div>

                {/* Body Component text string context builder */}
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-bold uppercase tracking-widest text-slate-500">Primary Core Body Copy *</Label>
                  <Textarea 
                    required 
                    rows={5} 
                    className="rounded-xl text-xs font-medium leading-relaxed resize-none custom-scrollbar p-3"
                    value={bodyText}
                    onChange={(e) => setBodyText(e.target.value)}
                  />
                  <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 pt-1">
                    <span>Use brackets like <code className="text-emerald-600 bg-emerald-50 font-mono px-1 rounded">{"{{1}}"}</code>, <code className="text-emerald-600 bg-emerald-50 font-mono px-1 rounded">{"{{2}}"}</code> to insert values dynamically.</span>
                    <span className="font-mono">{bodyText.length}/1024</span>
                  </div>
                </div>

                {/* Footer Copy Field */}
                <div className="space-y-1.5 pt-2">
                  <Label className="text-[11px] font-bold uppercase tracking-widest text-slate-500">Footer Text Signature (Optional)</Label>
                  <Input 
                    placeholder="e.g. Reply STOP to opt-out" 
                    className="h-10 rounded-xl text-xs text-slate-500 font-medium" 
                    value={footerText}
                    onChange={(e) => setFooterText(e.target.value)}
                    maxLength={60}
                  />
                </div>
              </Card>

              <Button type="submit" disabled={loading} className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white font-bold uppercase text-xs tracking-wider rounded-xl shadow-md transition-all active:scale-[0.98]">
                {loading ? <Loader2 className="w-4 h-4 animate-spin text-white" /> : 'Deploy Framework to Meta Registry'}
              </Button>
            </div>

            {/* Right Interactive WhatsApp Device Preview Box (WATI/AiSensy style) */}
            <div className="lg:col-span-5 lg:sticky lg:top-24 space-y-4">
              <p className="text-[11px] font-black uppercase tracking-widest text-slate-400 text-center flex items-center justify-center gap-1.5">
                <Eye className="w-3.5 h-3.5"/> Real-Time Network Simulator Preview
              </p>
              
              {/* iPhone Container View frame mock wrapper layout markup shell UI component structure design system standard theme properties block elements hierarchy layer container view display box layout block structure element row flow widget model mapping canvas layer style definition asset */}
              <div className="w-full max-w-[340px] mx-auto bg-[#efeae2] border-[8px] border-slate-900 shadow-2xl rounded-[40px] overflow-hidden aspect-[9/16] relative flex flex-col p-4">
                 
                 {/* Top Status Island bar */}
                 <div className="absolute top-0 inset-x-0 h-6 bg-slate-900 flex items-center justify-between px-6 z-20 text-[9px] font-bold text-white font-mono">
                   <span>7:40</span>
                   <div className="w-20 h-4 bg-black rounded-b-xl mx-auto absolute inset-x-0 top-0"></div>
                   <span className="tracking-tighter">5G</span>
                 </div>

                 {/* Simulated Messaging Bubble Content wrapper container view element block markup flow stack layout canvas */}
                 <div className="flex-1 flex flex-col justify-start pt-8 space-y-4 overflow-y-auto hide-scroll relative z-10">
                   
                   {/* Date Stamp Badge line widget */}
                   <div className="mx-auto bg-white/70 text-slate-600 text-[10px] font-bold uppercase px-3 py-1 rounded-md shadow-sm select-none">
                     Today
                   </div>

                   {/* Active Bubble Component Layout mapping live parameters text arrays */}
                   <div className="w-[85%] bg-white rounded-2xl rounded-tl-none p-3 shadow-[0_1px_2px_rgba(0,0,0,0.15)] space-y-1 animate-in zoom-in-95 duration-200">
                     {headerType === 'TEXT' && headerText && (
                       <div className="font-bold text-slate-900 text-xs tracking-tight mb-1 border-b border-slate-100 pb-1">
                         {headerText}
                       </div>
                     )}
                     
                     <div className="text-xs text-slate-800 font-medium whitespace-pre-wrap leading-relaxed tracking-tight">
                       {renderPreviewText(bodyText)}
                     </div>

                     {footerText && (
                       <div className="text-[10px] text-slate-400 font-semibold pt-0.5 uppercase tracking-wide">
                         {footerText}
                       </div>
                     )}

                     <div className="text-[9px] font-mono text-slate-400 text-right font-medium select-none pt-0.5">
                       7:40 PM ✓✓
                     </div>
                   </div>

                 </div>

                 {/* Bottom keyboard layout placeholder mask background element layout node shadow */}
                 <div className="h-10 bg-white border-t border-slate-200 -mx-4 -mb-4 flex items-center px-4 justify-between text-slate-300 relative z-20 shrink-0">
                    <span className="text-xs font-semibold text-slate-400">Message...</span>
                    <div className="h-6 w-6 rounded-full bg-slate-100"></div>
                 </div>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}