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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { 
  MessageSquare, RefreshCw, Plus, Trash2, Loader2,
  Layers, CheckCircle, Clock, XCircle, Eye, Sparkles,
  Image as ImageIcon, FileText, Video, MapPin, Type,
  Phone, Link as LinkIcon, MessageCircle,
  X
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
    <div className="min-h-screen bg-slate-50/50 p-6 sm:p-8 font-sans pb-24">
      {/* Top Header */}
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 flex items-center gap-2">
            <MessageSquare className="h-6 w-6 text-[#25D366]" /> WhatsApp Studio
          </h1>
          <p className="text-slate-500 font-medium text-xs mt-1">Design, sync, and manage conversational flows connected directly to Meta.</p>
        </div>
        
        <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl p-1 shadow-sm shrink-0">
          <Button 
            variant={activeTab === 'manager' ? 'default' : 'ghost'} 
            size="sm" 
            className={`rounded-lg font-bold text-xs ${activeTab === 'manager' ? 'bg-slate-900 text-white' : 'text-slate-600'}`}
            onClick={() => setActiveTab('manager')}
          >
            <Layers className="w-3.5 h-3.5 mr-1.5" /> Template Manager
          </Button>
          <Button 
            variant={activeTab === 'creator' ? 'default' : 'ghost'} 
            size="sm" 
            className={`rounded-lg font-bold text-xs ${activeTab === 'creator' ? 'bg-slate-900 text-white' : 'text-slate-600'}`}
            onClick={() => setActiveTab('creator')}
          >
            <Plus className="w-3.5 h-3.5 mr-1.5" /> Create Template
          </Button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto">
        {/* VIEW A: TEMPLATE MANAGER GRID */}
        {activeTab === 'manager' && (
          <div className="space-y-6 animate-in fade-in">
            <div className="flex justify-end gap-2">
              <Button onClick={handleSync} disabled={syncing} variant="outline" className="h-10 bg-white shadow-sm font-bold text-xs rounded-xl border-slate-200 text-[#25D366] hover:bg-[#25D366]/5">
                <RefreshCw className={`w-3.5 h-3.5 mr-2 ${syncing ? 'animate-spin' : ''}`} />
                {syncing ? 'Syncing...' : 'Sync with Meta'}
              </Button>
            </div>

            <Card className="rounded-2xl overflow-hidden bg-white border border-slate-200 shadow-sm">
              <Table>
                <TableHeader className="bg-slate-50/80">
                  <TableRow className="border-slate-200/60">
                    <TableHead className="font-bold text-[10px] uppercase tracking-widest text-slate-500">Name</TableHead>
                    <TableHead className="font-bold text-[10px] uppercase tracking-widest text-slate-500">Category</TableHead>
                    <TableHead className="font-bold text-[10px] uppercase tracking-widest text-slate-500">Language</TableHead>
                    <TableHead className="font-bold text-[10px] uppercase tracking-widest text-slate-500">Status</TableHead>
                    <TableHead className="font-bold text-[10px] uppercase tracking-widest text-slate-500 text-right px-6">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-12"><Loader2 className="w-6 h-6 animate-spin text-slate-300 mx-auto" /></TableCell></TableRow>
                  ) : templates.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-12">
                        <MessageSquare className="h-8 w-8 text-slate-200 mx-auto mb-3" />
                        <p className="text-sm font-bold text-slate-700">No templates found</p>
                        <p className="text-xs text-slate-400 mt-1">Create your first template to get started.</p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    templates.map((t: any) => {
                      const status = t.status?.toLowerCase() || 'approved';
                      return (
                        <TableRow key={t.name} className="hover:bg-slate-50/50">
                          <TableCell className="font-mono font-bold text-sm text-slate-900">{t.name}</TableCell>
                          <TableCell><Badge variant="secondary" className="bg-slate-100 text-slate-600 font-semibold">{t.category}</Badge></TableCell>
                          <TableCell className="font-medium text-slate-500 uppercase">{t.language}</TableCell>
                          <TableCell>
                            {status === 'approved' && <Badge className="bg-[#25D366]/10 text-[#25D366] border-[#25D366]/20 shadow-none"><CheckCircle className="w-3 h-3 mr-1"/> Approved</Badge>}
                            {status === 'pending' && <Badge className="bg-amber-100 text-amber-700 border-amber-200 shadow-none animate-pulse"><Clock className="w-3 h-3 mr-1"/> Pending</Badge>}
                            {status === 'rejected' && <Badge className="bg-rose-100 text-rose-700 border-rose-200 shadow-none"><XCircle className="w-3 h-3 mr-1"/> Rejected</Badge>}
                          </TableCell>
                          <TableCell className="text-right px-6">
                            <div className="flex items-center justify-end gap-2">
                              {/* ✨ NEW: View Preview Button */}
                              <Button variant="ghost" size="sm" className="h-8 text-xs font-bold text-indigo-600 hover:bg-indigo-50" onClick={() => setViewTemplate(t)}>
                                <Eye className="w-3.5 h-3.5 mr-1" /> View
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-500 hover:bg-red-50" onClick={() => handleDelete(t.name)}>
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

        {/* VIEW B: PROFESSIONAL INTERACTIVE STUDIO */}
        {activeTab === 'creator' && (
          <form onSubmit={handleCreateTemplate} className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start animate-in fade-in duration-300">
            
            {/* Left Workspace */}
            <div className="lg:col-span-7 space-y-6">
              
              {/* Block 1: Config */}
              <Card className="rounded-2xl border-slate-200 shadow-sm bg-white p-6 space-y-5">
                <div className="flex gap-4 items-start">
                   <div className="w-full space-y-1.5">
                     <Label className="text-xs font-bold text-slate-700 flex items-center gap-1.5"><Type className="w-3.5 h-3.5 text-rose-500" /> Template Name *</Label>
                     <Input required placeholder="enter_message_template_name" className="h-11 bg-slate-50 font-mono text-sm lowercase" value={templateName} onChange={(e) => setTemplateName(e.target.value.replace(/\s+/g, '_'))}/>
                   </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-700">Category / Type *</Label>
                    <Select value={category} onValueChange={setCategory}>
                      <SelectTrigger className="h-11 bg-slate-50"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="MARKETING">MARKETING (Promotions, Offers)</SelectItem>
                        <SelectItem value="UTILITY">UTILITY (Alerts, Updates)</SelectItem>
                        <SelectItem value="AUTHENTICATION">AUTHENTICATION (OTPs)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-700">Language *</Label>
                    <Select value={language} onValueChange={setLanguage}>
                      <SelectTrigger className="h-11 bg-slate-50"><SelectValue /></SelectTrigger>
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
              <Card className="rounded-2xl border-slate-200 shadow-sm bg-white p-6 space-y-6">
                
                {/* Header Selector */}
                <div className="space-y-3">
                  <Label className="text-xs font-bold text-slate-700">Header (Optional)</Label>
                  <Select value={headerType} onValueChange={setHeaderType}>
                    <SelectTrigger className="h-11 bg-slate-50"><SelectValue /></SelectTrigger>
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
                    <Input placeholder="Enter bold header text..." className="h-10 bg-slate-50 font-bold text-sm" value={headerText} onChange={(e) => setHeaderText(e.target.value)} maxLength={60} />
                  )}
                  {['IMAGE', 'VIDEO', 'DOCUMENT'].includes(headerType) && (
                    <div className="bg-blue-50/50 p-3 rounded-lg border border-blue-100 flex gap-2">
                       <ImageIcon className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                       <p className="text-[11px] text-blue-800 font-medium leading-tight">When broadcasting, you will pass the actual media URL. Meta requires standard validation for media headers upon creation.</p>
                    </div>
                  )}
                </div>

                {/* Body Textarea */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700 flex items-center gap-1.5"><FileText className="w-3.5 h-3.5 text-rose-500" /> Body *</Label>
                  <Textarea required rows={6} className="bg-slate-50 text-sm p-4 resize-none" value={bodyText} onChange={(e) => setBodyText(e.target.value)} />
                  <div className="flex justify-between items-center text-[11px] text-slate-500 font-medium pt-1">
                    <span>Use brackets like <code className="text-[#00a884] bg-[#00a884]/10 px-1 rounded font-bold">{"{{1}}"}</code> for variables.</span>
                    <span>{bodyText.length}/1024</span>
                  </div>
                </div>

                {/* Footer Input */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700">Footer</Label>
                  <Input placeholder="Add a short line of text to the bottom of your message template." className="h-10 bg-slate-50 text-sm" value={footerText} onChange={(e) => setFooterText(e.target.value)} maxLength={60} />
                </div>

                {/* Buttons Array Builder */}
                <div className="space-y-3 pt-2">
                  <Label className="text-xs font-bold text-slate-700">Buttons</Label>
                  <div className="flex flex-wrap gap-2 p-4 border border-dashed border-slate-300 rounded-xl bg-slate-50/50">
                     {buttons.map((btn, i) => (
                       <div key={i} className="w-full bg-white border border-slate-200 rounded-lg p-3 space-y-3 relative">
                          <button type="button" onClick={() => removeButton(i)} className="absolute right-2 top-2 text-slate-400 hover:text-rose-500"><XCircle className="w-4 h-4" /></button>
                          
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="text-[10px]">{btn.type}</Badge>
                            <Input className="h-8 text-xs font-bold" placeholder="Button Text" value={btn.text} onChange={(e) => updateButton(i, 'text', e.target.value)} />
                          </div>

                          {btn.type === 'URL' && (
                            <Input className="h-8 text-xs bg-slate-50" placeholder="https://example.com" value={btn.url} onChange={(e) => updateButton(i, 'url', e.target.value)} />
                          )}
                          {btn.type === 'PHONE_NUMBER' && (
                            <Input className="h-8 text-xs bg-slate-50" placeholder="+91..." value={btn.phone_number} onChange={(e) => updateButton(i, 'phone_number', e.target.value)} />
                          )}
                       </div>
                     ))}
                     
                     {buttons.length < 3 && (
                       <div className="flex gap-2 w-full justify-between items-center text-slate-500">
                         <Button type="button" variant="outline" size="sm" onClick={() => addButton('PHONE_NUMBER')} className="text-xs border-dashed flex-1 bg-white hover:text-slate-900"><Plus className="w-3 h-3 mr-1" /> Phone</Button>
                         <Button type="button" variant="outline" size="sm" onClick={() => addButton('URL')} className="text-xs border-dashed flex-1 bg-white hover:text-slate-900"><Plus className="w-3 h-3 mr-1" /> URL</Button>
                         <Button type="button" variant="outline" size="sm" onClick={() => addButton('QUICK_REPLY')} className="text-xs border-dashed flex-1 bg-white hover:text-slate-900"><Plus className="w-3 h-3 mr-1" /> Quick Reply</Button>
                       </div>
                     )}
                  </div>
                </div>

              </Card>

              <Button type="submit" disabled={loading} className="w-full h-12 bg-[#25D366] hover:bg-[#20bd5a] text-white font-bold text-sm shadow-md transition-all">
                {loading ? <Loader2 className="w-4 h-4 animate-spin text-white" /> : 'Submit Template for Meta Approval'}
              </Button>
            </div>

            {/* Right Live Preview Sticky */}
            <div className="lg:col-span-5 lg:sticky lg:top-24">
              <MobilePreviewMockup />
            </div>
          </form>
        )}
      </div>

      {/* ✨ VIEW TEMPLATE MODAL */}
      <Dialog open={!!viewTemplate} onOpenChange={(o) => !o && setViewTemplate(null)}>
        <DialogContent className="sm:max-w-[400px] p-0 overflow-hidden bg-transparent border-none shadow-none">
           <div className="bg-slate-900 rounded-t-2xl p-4 flex justify-between items-center text-white border-b border-slate-700">
             <div>
               <DialogTitle className="text-sm font-bold truncate max-w-[200px]">{viewTemplate?.name}</DialogTitle>
               <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-widest">{viewTemplate?.language} • {viewTemplate?.category}</p>
             </div>
             <Button variant="ghost" size="icon" className="hover:bg-slate-800 text-slate-400" onClick={() => setViewTemplate(null)}>
               <X className="w-4 h-4" />
             </Button>
           </div>
           <div className="bg-slate-800 p-6 flex items-center justify-center rounded-b-2xl">
             <MobilePreviewMockup template={viewTemplate} />
           </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}