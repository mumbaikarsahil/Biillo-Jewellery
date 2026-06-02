"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { 
  MessageSquare, RefreshCw, Plus, Trash2, Loader2,
  Layers, CheckCircle, Clock, XCircle, Eye, Sparkles,
  Image as ImageIcon, FileText, Video, MapPin, Type,
  Phone, Link as LinkIcon, MessageCircle, CalendarClock,
  X, Send, ArrowRight
} from 'lucide-react';

export default function WhatsAppAutomationPage() {
  // --- STATE: Lists & UI ---
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [activeTab, setActiveTab] = useState<'manager' | 'creator'>('manager');
  const [viewTemplate, setViewTemplate] = useState<any | null>(null);

  // --- STATE: Creator Form (AiSensy/WATI style) ---
  const [templateName, setTemplateName] = useState('');
  const [category, setCategory] = useState('MARKETING');
  const [language, setLanguage] = useState('en');
  
  const [headerType, setHeaderType] = useState('NONE');
  const [headerText, setHeaderText] = useState('');
  
  const [bodyText, setBodyText] = useState('Hi {{1}}, welcome to Pavitram Diamond Jewellery! 💎\n\nYour exclusive offer code is {{2}}.');
  const [footerText, setFooterText] = useState('Regards, Pavitram Team');
  
  // Buttons State
  const [buttons, setButtons] = useState<any[]>([]);

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'template.list', payload: {} })
      });
      const data = await res.json();
      setTemplates(Array.isArray(data.data) ? data.data : (data.templates || []));
    } catch (err) {
      toast({ title: "Sync Error", description: "Failed to load templates from Convo360.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      await fetch('/api/whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'template.sync', payload: {} })
      });
      toast({ title: "Success", description: "Meta Network Schema Synced successfully." });
      fetchTemplates();
    } catch (err) {
      toast({ title: "Error", description: "Network sync command failed.", variant: "destructive" });
    } finally {
      setSyncing(false);
    }
  };

  const handleDelete = async (name: string) => {
    if (!confirm(`Are you sure you want to delete template: ${name}?`)) return;
    try {
      await fetch('/api/whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'template.delete', payload: { name } })
      });
      toast({ title: "Deleted", description: "Template deleted successfully." });
      fetchTemplates();
    } catch (err) {
      toast({ title: "Error", description: "Failed to delete template.", variant: "destructive" });
    }
  };

  // --- BUTTON BUILDERS ---
  const addButton = (type: string) => {
    if (buttons.length >= 3) return toast({ title: "Limit Reached", description: "Max 3 buttons allowed." });
    
    let newBtn: any = { type };
    if (type === 'PHONE_NUMBER') newBtn = { type, text: 'Call Us', phone_number: '+91' };
    if (type === 'URL') newBtn = { type, text: 'Visit Website', url: 'https://' };
    if (type === 'QUICK_REPLY') newBtn = { type, text: 'Yes, I am interested!' };
    
    setButtons([...buttons, newBtn]);
  };

  const updateButton = (index: number, key: string, value: string) => {
    const updated = [...buttons];
    updated[index][key] = value;
    setButtons(updated);
  };

  const removeButton = (index: number) => {
    setButtons(buttons.filter((_, i) => i !== index));
  };

  // --- PAYLOAD SUBMISSION ---
  const handleCreateTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!templateName) return toast({ title: "Required", description: "Template name is mandatory.", variant: "destructive" });
    if (!bodyText) return toast({ title: "Required", description: "Body text is mandatory.", variant: "destructive" });
    
    const cleanName = templateName.toLowerCase().trim().replace(/[^a-z0-9_]/g, '_');
    const components: any[] = [];

    // 1. Header (Format matches Meta API Requirements)
    if (headerType !== 'NONE') {
      const headerObj: any = { type: 'HEADER', format: headerType };
      if (headerType === 'TEXT') headerObj.text = headerText || "Headline";
      components.push(headerObj);
    }
    
    // 2. Body
    components.push({ type: 'BODY', text: bodyText });

    // 3. Footer
    if (footerText) {
      components.push({ type: 'FOOTER', text: footerText });
    }

    // 4. Buttons
    if (buttons.length > 0) {
      components.push({ type: 'BUTTONS', buttons: buttons });
    }

    try {
      setLoading(true);
      const res = await fetch('/api/whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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

      if (res.ok && (data.status === 'ok' || data.id)) {
        toast({ title: "Success", description: "Template submitted to Meta for review!" });
        setActiveTab('manager');
        fetchTemplates();
        
        // Reset Form
        setTemplateName('');
        setButtons([]);
      } else {
        throw new Error(data.message || data.error?.message || "Template submission failure.");
      }
    } catch (err: any) {
      toast({ title: "Submission Failed", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // --- PREVIEW RENDERERS ---
  const renderPreviewText = (text: string) => {
    if (!text) return "";
    return text.replace(/\{\{(\d+)\}\}/g, (match, number) => `[Var ${number}]`);
  };

  const MobilePreviewMockup = ({ template }: { template?: any }) => {
    // Determine preview sources (either active form state, or passed template for 'View' modal)
    const isLive = !template;
    
    let currentHeaderType = isLive ? headerType : 'NONE';
    let currentHeaderText = isLive ? headerText : '';
    let currentBodyText = isLive ? bodyText : '';
    let currentFooterText = isLive ? footerText : '';
    let currentButtons = isLive ? buttons : [];

    if (template) {
      const h = template.components?.find((c: any) => c.type === 'HEADER');
      if (h) { currentHeaderType = h.format; currentHeaderText = h.text || ''; }
      
      const b = template.components?.find((c: any) => c.type === 'BODY');
      if (b) { currentBodyText = b.text || ''; }
      
      const f = template.components?.find((c: any) => c.type === 'FOOTER');
      if (f) { currentFooterText = f.text || ''; }

      const btns = template.components?.find((c: any) => c.type === 'BUTTONS');
      if (btns && btns.buttons) { currentButtons = btns.buttons; }
    }

    return (
      <div className="w-full max-w-[340px] mx-auto bg-[#efeae2] border-[8px] border-slate-900 shadow-2xl rounded-[40px] overflow-hidden aspect-[9/18] relative flex flex-col p-4">
        {/* Status Bar */}
        <div className="absolute top-0 inset-x-0 h-6 bg-slate-900 flex items-center justify-between px-6 z-20 text-[9px] font-bold text-white font-mono">
          <span>7:40</span>
          <div className="w-20 h-4 bg-black rounded-b-xl mx-auto absolute inset-x-0 top-0"></div>
          <span className="tracking-tighter">5G</span>
        </div>

        {/* WhatsApp Background */}
        <div className="absolute inset-0 opacity-[0.05] pointer-events-none" style={{ backgroundImage: 'url("https://w0.peakpx.com/wallpaper/508/606/HD-wallpaper-whatsapp-background-solid-color-texture.jpg")', backgroundSize: 'cover' }}></div>

        <div className="flex-1 flex flex-col justify-start pt-8 space-y-4 overflow-y-auto hide-scroll relative z-10">
          <div className="mx-auto bg-white/80 text-slate-600 text-[10px] font-bold uppercase px-3 py-1 rounded-md shadow-sm backdrop-blur-sm select-none">
            Today
          </div>

          <div className="w-[85%] animate-in zoom-in-95 duration-200">
            {/* Bubble */}
            <div className="bg-white rounded-2xl rounded-tl-none p-2 shadow-[0_1px_2px_rgba(0,0,0,0.15)] space-y-2">
              
              {/* Media Header Previews */}
              {currentHeaderType !== 'NONE' && (
                <div className="w-full rounded-xl overflow-hidden bg-slate-100 flex items-center justify-center border border-slate-200/60 relative">
                  {currentHeaderType === 'TEXT' ? (
                    <div className="p-2 w-full font-bold text-slate-900 text-[13px] tracking-tight border-b border-slate-100 bg-white">
                      {currentHeaderText || "Headline Text"}
                    </div>
                  ) : (
                    <div className="h-28 w-full flex flex-col items-center justify-center text-slate-400 gap-2">
                      {currentHeaderType === 'IMAGE' && <ImageIcon className="w-8 h-8 opacity-50" />}
                      {currentHeaderType === 'VIDEO' && <Video className="w-8 h-8 opacity-50" />}
                      {currentHeaderType === 'DOCUMENT' && <FileText className="w-8 h-8 opacity-50" />}
                      {currentHeaderType === 'LOCATION' && <MapPin className="w-8 h-8 opacity-50" />}
                      <span className="text-[10px] font-bold uppercase tracking-widest">{currentHeaderType} Media</span>
                    </div>
                  )}
                </div>
              )}
              
              {/* Body */}
              <div className="text-[13px] text-[#111B21] font-normal whitespace-pre-wrap leading-relaxed tracking-tight px-1">
                {renderPreviewText(currentBodyText)}
              </div>

              {/* Footer & Timestamp */}
              <div className="flex items-end justify-between px-1 pt-1">
                <span className="text-[11px] text-slate-400 font-normal truncate max-w-[70%]">
                  {currentFooterText}
                </span>
                <span className="text-[10px] text-slate-400 text-right shrink-0 relative top-1">
                  7:40 PM ✓✓
                </span>
              </div>
            </div>

            {/* Buttons Render */}
            {currentButtons.length > 0 && (
              <div className="flex flex-col gap-1 mt-1.5">
                {currentButtons.map((btn: any, i: number) => (
                  <div key={i} className="bg-white rounded-xl shadow-[0_1px_2px_rgba(0,0,0,0.15)] p-2.5 text-center text-[13px] font-medium text-[#00a884] flex items-center justify-center gap-2 cursor-pointer hover:bg-slate-50 transition-colors">
                    {btn.type === 'URL' && <LinkIcon className="w-4 h-4" />}
                    {btn.type === 'PHONE_NUMBER' && <Phone className="w-4 h-4" />}
                    {btn.type === 'QUICK_REPLY' && <MessageCircle className="w-4 h-4" />}
                    {btn.text || 'Action Button'}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Keyboard Input Bar */}
        <div className="h-10 bg-[#f0f2f5] -mx-4 -mb-4 flex items-center px-4 justify-between text-slate-400 relative z-20 shrink-0">
          <span className="text-[13px] font-normal">Type a message...</span>
          <div className="flex gap-3">
             <div className="w-4 h-4 rounded-full bg-slate-300"></div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#fafafa] font-sans pb-24">
      {/* ── TOP HEADER / NAV ── */}
      <div className="sticky top-0 z-40 w-full bg-white/80 backdrop-blur-md border-b border-slate-200 shadow-sm px-6 py-4 mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <MessageSquare className="h-6 w-6 text-[#25D366]" /> WhatsApp Studio
          </h1>
          <p className="text-slate-500 font-medium text-xs mt-1">Automated Business Management • Design and sync conversational flows.</p>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Main Segmented Toggle */}
          <div className="flex items-center bg-slate-100/80 p-1 rounded-xl shadow-inner border border-slate-200/50">
            <Button 
              variant={activeTab === 'manager' ? 'default' : 'ghost'} 
              size="sm" 
              className={`rounded-lg font-bold text-xs h-9 px-4 transition-all ${activeTab === 'manager' ? 'bg-white text-slate-900 shadow-sm border border-slate-200/60' : 'text-slate-500 hover:text-slate-900'}`}
              onClick={() => setActiveTab('manager')}
            >
              <Layers className="w-4 h-4 mr-2" /> Templates
            </Button>
            
            <Button 
              variant={activeTab === 'creator' ? 'default' : 'ghost'} 
              size="sm" 
              className={`rounded-lg font-bold text-xs h-9 px-4 transition-all ${activeTab === 'creator' ? 'bg-white text-slate-900 shadow-sm border border-slate-200/60' : 'text-slate-500 hover:text-slate-900'}`}
              onClick={() => setActiveTab('creator')}
            >
              <Plus className="w-4 h-4 mr-2" /> New Setup
            </Button>
          </div>

          <div className="w-px h-8 bg-slate-200 mx-1 hidden md:block"></div>

          {/* Dedicated Drip Campaign Entry Point */}
          <Link href="/campaigns">
            <Button className="h-11 bg-indigo-600 hover:bg-indigo-700 text-white shadow-md font-bold text-xs rounded-xl border border-indigo-500 transition-all hover:scale-[1.02]">
              <CalendarClock className="w-4 h-4 mr-2" />
              Drip Campaigns
            </Button>
          </Link>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        {/* ── VIEW A: TEMPLATE MANAGER GRID ── */}
        {activeTab === 'manager' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className="flex justify-end gap-2">
              <Button onClick={handleSync} disabled={syncing} variant="outline" className="h-10 bg-white shadow-sm font-bold text-xs rounded-xl border-slate-200 text-[#25D366] hover:bg-[#25D366]/5">
                <RefreshCw className={`w-3.5 h-3.5 mr-2 ${syncing ? 'animate-spin' : ''}`} />
                {syncing ? 'Syncing...' : 'Sync with Meta'}
              </Button>
            </div>

            <Card className="rounded-2xl overflow-hidden bg-white border-slate-200 shadow-sm">
              <Table>
                <TableHeader className="bg-slate-50/80 border-b border-slate-200">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="font-black text-[10px] uppercase tracking-widest text-slate-400 h-12">Name</TableHead>
                    <TableHead className="font-black text-[10px] uppercase tracking-widest text-slate-400 h-12">Category</TableHead>
                    <TableHead className="font-black text-[10px] uppercase tracking-widest text-slate-400 h-12">Language</TableHead>
                    <TableHead className="font-black text-[10px] uppercase tracking-widest text-slate-400 h-12">Status</TableHead>
                    <TableHead className="font-black text-[10px] uppercase tracking-widest text-slate-400 h-12 text-right px-6">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-16"><Loader2 className="w-6 h-6 animate-spin text-slate-300 mx-auto" /></TableCell></TableRow>
                  ) : templates.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-16">
                        <div className="mx-auto w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4 border border-slate-100">
                          <MessageSquare className="h-8 w-8 text-slate-300" />
                        </div>
                        <p className="text-base font-bold text-slate-700">No templates found</p>
                        <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">Create your first automated message template to start engaging with your customers.</p>
                        <Button variant="outline" className="mt-6" onClick={() => setActiveTab('creator')}>
                          <Plus className="w-4 h-4 mr-2" /> Create Template
                        </Button>
                      </TableCell>
                    </TableRow>
                  ) : (
                    templates.map((t: any) => {
                      const status = t.status?.toLowerCase() || 'approved';
                      return (
                        <TableRow key={t.name} className="hover:bg-slate-50/50 transition-colors">
                          <TableCell className="font-mono font-bold text-sm text-slate-900 py-4">{t.name}</TableCell>
                          <TableCell className="py-4"><Badge variant="secondary" className="bg-slate-100 text-slate-600 font-bold tracking-wide">{t.category}</Badge></TableCell>
                          <TableCell className="font-bold text-slate-500 uppercase tracking-widest text-xs py-4">{t.language}</TableCell>
                          <TableCell className="py-4">
                            {status === 'approved' && <Badge className="bg-[#25D366]/10 text-[#25D366] border border-[#25D366]/20 shadow-none"><CheckCircle className="w-3.5 h-3.5 mr-1.5"/> Approved</Badge>}
                            {status === 'pending' && <Badge className="bg-amber-50 text-amber-600 border border-amber-200 shadow-none animate-pulse"><Clock className="w-3.5 h-3.5 mr-1.5"/> Pending</Badge>}
                            {status === 'rejected' && <Badge className="bg-rose-50 text-rose-600 border border-rose-200 shadow-none"><XCircle className="w-3.5 h-3.5 mr-1.5"/> Rejected</Badge>}
                          </TableCell>
                          <TableCell className="text-right px-6 py-4">
                            <div className="flex items-center justify-end gap-2">
                              <Button variant="ghost" size="sm" className="h-8 text-xs font-bold text-indigo-600 hover:bg-indigo-50 border border-transparent hover:border-indigo-100 transition-colors" onClick={() => setViewTemplate(t)}>
                                <Eye className="w-3.5 h-3.5 mr-1.5" /> View
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-rose-600 hover:bg-rose-50 hover:border-rose-100 border border-transparent transition-colors" onClick={() => handleDelete(t.name)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
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

        {/* ── VIEW B: PROFESSIONAL INTERACTIVE STUDIO ── */}
        {activeTab === 'creator' && (
          <form onSubmit={handleCreateTemplate} className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start animate-in fade-in slide-in-from-bottom-2 duration-500">
            
            {/* Left Workspace */}
            <div className="xl:col-span-8 space-y-6">
              
              {/* Block 1: Config */}
              <Card className="rounded-2xl border-slate-200 shadow-sm bg-white p-6 space-y-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-6 pointer-events-none opacity-5">
                  <Sparkles className="w-24 h-24" />
                </div>
                
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Template Details</h3>
                  <p className="text-xs text-slate-500 font-medium">Define the core settings for Meta review.</p>
                </div>

                <div className="space-y-1.5 relative z-10">
                  <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5"><Type className="w-3.5 h-3.5 text-indigo-500" /> Template Name *</Label>
                  <Input required placeholder="e.g. birthday_promo_offer" className="h-12 bg-slate-50 font-mono text-sm lowercase border-slate-200 focus-visible:ring-indigo-500" value={templateName} onChange={(e) => setTemplateName(e.target.value.replace(/\s+/g, '_'))}/>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 relative z-10">
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Category / Type *</Label>
                    <Select value={category} onValueChange={setCategory}>
                      <SelectTrigger className="h-12 bg-slate-50 border-slate-200 font-medium text-sm focus:ring-indigo-500"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="MARKETING">MARKETING (Promotions, Offers)</SelectItem>
                        <SelectItem value="UTILITY">UTILITY (Alerts, Updates)</SelectItem>
                        <SelectItem value="AUTHENTICATION">AUTHENTICATION (OTPs)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Language *</Label>
                    <Select value={language} onValueChange={setLanguage}>
                      <SelectTrigger className="h-12 bg-slate-50 border-slate-200 font-medium text-sm focus:ring-indigo-500"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="en">English (en)</SelectItem>
                        <SelectItem value="hi">Hindi (hi)</SelectItem>
                        <SelectItem value="mr">Marathi (mr)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </Card>

              {/* Block 2: Components */}
              <Card className="rounded-2xl border-slate-200 shadow-sm bg-white p-6 space-y-8">
                
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Message Content</h3>
                  <p className="text-xs text-slate-500 font-medium">Design what your customers will see.</p>
                </div>

                {/* Header Selector */}
                <div className="space-y-3">
                  <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Header (Optional)</Label>
                  <Select value={headerType} onValueChange={setHeaderType}>
                    <SelectTrigger className="h-12 bg-slate-50 border-slate-200 font-medium text-sm focus:ring-indigo-500"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NONE">None</SelectItem>
                      <SelectItem value="TEXT">Text</SelectItem>
                      <SelectItem value="IMAGE">Image</SelectItem>
                      <SelectItem value="VIDEO">Video</SelectItem>
                      <SelectItem value="DOCUMENT">Document</SelectItem>
                      <SelectItem value="LOCATION">Location</SelectItem>
                    </SelectContent>
                  </Select>
                  {headerType === 'TEXT' && (
                    <Input placeholder="Enter bold header text..." className="h-12 bg-slate-50 border-slate-200 font-bold text-sm focus-visible:ring-indigo-500 mt-2" value={headerText} onChange={(e) => setHeaderText(e.target.value)} maxLength={60} />
                  )}
                  {['IMAGE', 'VIDEO', 'DOCUMENT'].includes(headerType) && (
                    <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100 flex gap-3 mt-2">
                       <ImageIcon className="w-5 h-5 text-indigo-500 shrink-0 mt-0.5" />
                       <p className="text-[11px] text-indigo-900 font-medium leading-relaxed">
                         <strong>Dynamic Media Selected.</strong> When broadcasting, your system will pass the actual media URL. Meta requires standard validation for media headers upon creation.
                       </p>
                    </div>
                  )}
                </div>

                {/* Body Textarea */}
                <div className="space-y-1.5 pt-2">
                  <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5"><FileText className="w-3.5 h-3.5 text-indigo-500" /> Body Content *</Label>
                  <Textarea required rows={7} className="bg-slate-50 text-sm p-4 resize-none border-slate-200 focus-visible:ring-indigo-500 leading-relaxed" value={bodyText} onChange={(e) => setBodyText(e.target.value)} />
                  <div className="flex justify-between items-center text-[11px] text-slate-500 font-medium pt-2 px-1">
                    <span>Use brackets like <code className="text-[#00a884] bg-[#00a884]/10 px-1.5 py-0.5 rounded border border-[#00a884]/20 font-bold">{"{{1}}"}</code> for dynamic variables.</span>
                    <span className="font-mono">{bodyText.length}/1024</span>
                  </div>
                </div>

                {/* Footer Input */}
                <div className="space-y-1.5 pt-2">
                  <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Footer Signature</Label>
                  <Input placeholder="Add a short line of text to the bottom of your message template." className="h-11 bg-slate-50 border-slate-200 text-sm focus-visible:ring-indigo-500 text-slate-500" value={footerText} onChange={(e) => setFooterText(e.target.value)} maxLength={60} />
                </div>

                {/* Buttons Array Builder */}
                <div className="space-y-3 pt-6 border-t border-slate-100">
                  <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Interactive Buttons</Label>
                  <div className="flex flex-col gap-3 p-5 border border-dashed border-slate-300 rounded-2xl bg-slate-50/50">
                     {buttons.map((btn, i) => (
                       <div key={i} className="w-full bg-white border border-slate-200 shadow-sm rounded-xl p-4 space-y-4 relative group">
                          <button type="button" onClick={() => removeButton(i)} className="absolute right-3 top-3 text-slate-300 hover:text-rose-500 transition-colors"><XCircle className="w-5 h-5" /></button>
                          
                          <div className="flex items-center gap-3 pr-8">
                            <Badge variant="secondary" className="text-[10px] tracking-widest uppercase bg-slate-100 text-slate-500 border border-slate-200">{btn.type}</Badge>
                            <Input className="h-10 text-sm font-bold border-slate-200 focus-visible:ring-indigo-500" placeholder="Button Label" value={btn.text} onChange={(e) => updateButton(i, 'text', e.target.value)} />
                          </div>

                          {btn.type === 'URL' && (
                            <Input className="h-10 text-sm bg-slate-50 border-slate-200 font-mono text-indigo-600 focus-visible:ring-indigo-500" placeholder="https://example.com" value={btn.url} onChange={(e) => updateButton(i, 'url', e.target.value)} />
                          )}
                          {btn.type === 'PHONE_NUMBER' && (
                            <Input className="h-10 text-sm bg-slate-50 border-slate-200 font-mono text-indigo-600 focus-visible:ring-indigo-500" placeholder="+91..." value={btn.phone_number} onChange={(e) => updateButton(i, 'phone_number', e.target.value)} />
                          )}
                       </div>
                     ))}
                     
                     {buttons.length < 3 && (
                       <div className="flex flex-wrap sm:flex-nowrap gap-3 w-full justify-between items-center mt-1">
                         <Button type="button" variant="outline" onClick={() => addButton('PHONE_NUMBER')} className="h-11 text-xs font-bold border-dashed flex-1 bg-white hover:border-slate-400 text-slate-600"><Plus className="w-3.5 h-3.5 mr-1.5" /> Call Button</Button>
                         <Button type="button" variant="outline" onClick={() => addButton('URL')} className="h-11 text-xs font-bold border-dashed flex-1 bg-white hover:border-slate-400 text-slate-600"><Plus className="w-3.5 h-3.5 mr-1.5" /> Link Button</Button>
                         <Button type="button" variant="outline" onClick={() => addButton('QUICK_REPLY')} className="h-11 text-xs font-bold border-dashed flex-1 bg-white hover:border-slate-400 text-slate-600"><Plus className="w-3.5 h-3.5 mr-1.5" /> Quick Reply</Button>
                       </div>
                     )}
                  </div>
                </div>

              </Card>

              <Button type="submit" disabled={loading} className="w-full h-14 rounded-2xl bg-[#25D366] hover:bg-[#20bd5a] text-white font-bold text-sm shadow-[0_8px_30px_rgb(37,211,102,0.2)] hover:shadow-[0_8px_30px_rgb(37,211,102,0.3)] transition-all">
                {loading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                {loading ? 'Submitting...' : 'Submit Template for Meta Approval'}
              </Button>
            </div>

            {/* Right Live Preview Sticky */}
            <div className="xl:col-span-4 xl:sticky xl:top-24 hidden md:block">
              <div className="mb-4 text-center">
                <h3 className="text-sm font-bold text-slate-700">Live Device Preview</h3>
                <p className="text-[10px] uppercase tracking-widest text-slate-400 mt-1">iOS Rendering Match</p>
              </div>
              <MobilePreviewMockup />
            </div>
          </form>
        )}
      </div>

      {/* ✨ VIEW TEMPLATE MODAL */}
      <Dialog open={!!viewTemplate} onOpenChange={(o) => !o && setViewTemplate(null)}>
        <DialogContent className="sm:max-w-[400px] p-0 overflow-hidden bg-transparent border-none shadow-none">
           <div className="bg-slate-900 rounded-t-3xl p-5 flex justify-between items-center text-white border-b border-slate-700">
             <div>
               <DialogTitle className="text-base font-bold truncate max-w-[200px]">{viewTemplate?.name}</DialogTitle>
               <p className="text-[10px] text-slate-400 mt-1.5 uppercase tracking-widest font-bold">{viewTemplate?.language} • {viewTemplate?.category}</p>
             </div>
             <Button variant="ghost" size="icon" className="hover:bg-slate-800 text-slate-400 rounded-full" onClick={() => setViewTemplate(null)}>
               <X className="w-5 h-5" />
             </Button>
           </div>
           <div className="bg-slate-800/95 backdrop-blur-xl p-8 flex items-center justify-center rounded-b-3xl shadow-2xl">
             <MobilePreviewMockup template={viewTemplate} />
           </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}