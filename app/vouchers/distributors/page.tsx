"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { 
  Store, 
  Plus, 
  Loader2, 
  MoreHorizontal, 
  Building2, 
  MapPin, 
  Phone,
  ChevronRight,
  ArrowLeft,
  RefreshCw,
  Database,
  User,
  Truck,
  IdCard,
  Search,
  Filter,
  TrendingUp,
  Users,
  Calendar,
  Settings,
  Edit2,
  X
} from "lucide-react";

import { supabase } from "@/lib/supabaseClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@radix-ui/react-dropdown-menu";

interface DistributorMetrics {
  registered: number;
  redeemed: number;
  conversionRate: number;
}

interface Distributor {
  id: string;
  distributor_name: string;
  contact_person: string;
  phone: string;
  address: string;
  distributor_type: string;
  area_location?: string;
  business_category?: string;
  partner_level?: string;
  created_at: string;
  metrics?: DistributorMetrics;
}

interface DeliveryAgent {
  id: string;
  name: string;
  phone: string;
  agency_details: string;
  created_at: string;
}

interface ReferencePerson {
  id: string;
  name: string;
  phone: string;
  details: string;
  linked_distributor_id: string | null;
  created_at: string;
  linked_distributor?: {
    distributor_name: string;
  };
}

interface EventSummary {
  event_name: string;
  voucher_count: number;
  last_generated: string;
}

export default function DistributorsPage() {
  const { toast } = useToast();
  const { appUser } = useAuth();

  const [distributors, setDistributors] = useState<Distributor[]>([]);
  const [agents, setAgents] = useState<DeliveryAgent[]>([]);
  const [referencePersons, setReferencePersons] = useState<ReferencePerson[]>([]); 
  const [events, setEvents] = useState<EventSummary[]>([]);
  
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");

  const [isPartnerDialogOpen, setIsPartnerDialogOpen] = useState(false);
  const [isAgentDialogOpen, setIsAgentDialogOpen] = useState(false);
  const [isRefPersonDialogOpen, setIsRefPersonDialogOpen] = useState(false); 
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ✨ Edit State
  const [isEditMode, setIsEditMode] = useState(false);
  const [editPartnerId, setEditPartnerId] = useState<string | null>(null);

  const defaultCategories = [
    "external_shop", 
    "internal_branch", 
    "corporate_partner", 
    "voucher_printing_press", 
    "sales_person",
    "campaign",
    "retail_associates",
    "institute_retail"
  ];
  const [availableCategories, setAvailableCategories] = useState<string[]>(defaultCategories);
  const [isAddingNewCategory, setIsAddingNewCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");

  const [partnerFormData, setPartnerFormData] = useState({
    distributor_name: "",
    contact_person: "",
    phone: "",
    address: "",
    distributor_type: "external_shop",
    area_location: "",
    business_category: "",
    partner_level: "Standard",
  });

  const [agentFormData, setAgentFormData] = useState({
    name: "",
    phone: "",
    agency_details: "",
  });

  const [refPersonFormData, setRefPersonFormData] = useState({
    name: "",
    phone: "",
    details: "",
    linked_distributor_id: "none",
  });

  const fetchRegistries = async () => {
    // ✨ FIX 1: Strict guard to prevent Supabase from throwing an "undefined filter" JS Error
    if (!appUser?.company_id) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      // 1. Fetch Partners
      const { data: distData, error: distErr } = await supabase
        .from("voucher_distributors")
        .select("*, vouchers(status)")
        .eq("company_id", appUser.company_id)
        .order("created_at", { ascending: false });

      if (distErr) throw distErr;

      // Extract any custom categories
      if (distData) {
        const dbCategories = Array.from(new Set(distData.map(d => d.distributor_type).filter(Boolean)));
        const combinedCategories = Array.from(new Set([...defaultCategories, ...dbCategories]));
        setAvailableCategories(combinedCategories);
      }

      const enrichedDistributors = (distData || []).map((distributor) => {
        let registeredCount = 0;
        let redeemedCount = 0;

        if (distributor.vouchers && Array.isArray(distributor.vouchers)) {
          distributor.vouchers.forEach((v: any) => {
            if (v.status === 'registered') {
              registeredCount += 1;
            } else if (v.status === 'redeemed') {
              registeredCount += 1; 
              redeemedCount += 1;
            }
          });
        }
        const conversionRate = registeredCount > 0 ? (redeemedCount / registeredCount) * 100 : 0;
        return {
          ...distributor,
          metrics: { registered: registeredCount, redeemed: redeemedCount, conversionRate }
        };
      });

      setDistributors(enrichedDistributors);

      // 2. Fetch Delivery Agents
      const { data: agentData, error: agentErr } = await supabase
        .from("delivery_agents")
        .select("*")
        .eq("company_id", appUser.company_id)
        .order("created_at", { ascending: false });
      if (agentErr) throw agentErr;
      setAgents(agentData || []);

      // 3. Fetch Reference Persons
      const { data: refData, error: refErr } = await supabase
        .from("voucher_reference_persons")
        .select("*, linked_distributor:linked_distributor_id(distributor_name)")
        .eq("company_id", appUser.company_id)
        .order("created_at", { ascending: false });
      if (refErr) throw refErr;
      setReferencePersons(refData || []);

      // 4. Fetch Event Summaries from Vouchers
      const { data: eventData, error: eventErr } = await supabase
        .from("vouchers")
        .select("event_name, updated_at")
        .eq("is_event_voucher", true); // Removed the company_id filter that caused the crash
      
      if (eventErr) throw eventErr;

      if (eventData) {
        const eventMap = new Map<string, { count: number, latest: string }>();
        eventData.forEach((v: any) => {
          if (!v.event_name) return; 
          
          const name = v.event_name;
          const current = eventMap.get(name) || { count: 0, latest: v.updated_at };
          eventMap.set(name, {
            count: current.count + 1,
            latest: new Date(v.updated_at) > new Date(current.latest) ? v.updated_at : current.latest
          });
        });

        const formattedEvents: EventSummary[] = Array.from(eventMap.entries()).map(([name, data]) => ({
          event_name: name,
          voucher_count: data.count,
          last_generated: data.latest
        })).sort((a, b) => new Date(b.last_generated).getTime() - new Date(a.last_generated).getTime());

        setEvents(formattedEvents);
      }

    } catch (error: any) {
      // ✨ FIX 3: Force extraction of the message so native JS errors don't show up as {}
      const errorMessage = error instanceof Error ? error.message : error?.message || "An unknown error occurred.";
      console.error("Error fetching registries:", errorMessage, error);
      toast({ title: "Load Error", description: errorMessage, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (appUser) fetchRegistries();
  }, [appUser]);

  const handleCreateCategory = () => {
    if (!newCategoryName.trim()) return;
    const formattedName = newCategoryName.trim().toLowerCase().replace(/\s+/g, '_');
    
    if (!availableCategories.includes(formattedName)) {
      setAvailableCategories(prev => [...prev, formattedName]);
    }
    
    setPartnerFormData(prev => ({ ...prev, distributor_type: formattedName }));
    setNewCategoryName("");
    setIsAddingNewCategory(false);
    toast({ title: "Category Added", description: "You can now use this category for the partner." });
  };

  const resetPartnerForm = () => {
    setPartnerFormData({
      distributor_name: "",
      contact_person: "",
      phone: "",
      address: "",
      distributor_type: "external_shop",
      area_location: "",
      business_category: "",
      partner_level: "Standard",
    });
    setIsEditMode(false);
    setEditPartnerId(null);
  };

  const handleEditPartner = (distributor: Distributor) => {
    setPartnerFormData({
      distributor_name: distributor.distributor_name || "",
      contact_person: distributor.contact_person || "",
      phone: distributor.phone || "",
      address: distributor.address || "",
      distributor_type: distributor.distributor_type || "external_shop",
      area_location: distributor.area_location || "",
      business_category: distributor.business_category || "",
      partner_level: distributor.partner_level || "Standard",
    });
    setIsEditMode(true);
    setEditPartnerId(distributor.id);
    setIsPartnerDialogOpen(true);
  };

  const handlePartnerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const payload = {
        company_id: appUser?.company_id,
        distributor_name: partnerFormData.distributor_name,
        contact_person: partnerFormData.contact_person,
        phone: partnerFormData.phone,
        address: partnerFormData.address,
        distributor_type: partnerFormData.distributor_type,
        area_location: partnerFormData.area_location,
        business_category: partnerFormData.business_category,
        partner_level: partnerFormData.partner_level,
      };

      if (isEditMode && editPartnerId) {
        const { error } = await supabase.from("voucher_distributors").update(payload).eq("id", editPartnerId);
        if (error) throw error;
        toast({ title: "Partner Updated", description: `${partnerFormData.distributor_name} details modified.` });
      } else {
        const { error } = await supabase.from("voucher_distributors").insert(payload);
        if (error) throw error;
        toast({ title: "Partner Registered", description: `${partnerFormData.distributor_name} added to ledger.` });
      }

      resetPartnerForm();
      setIsPartnerDialogOpen(false);
      fetchRegistries();
    } catch (error: any) {
      toast({ title: isEditMode ? "Update Failed" : "Registration Failed", description: error.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAgentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const { error } = await supabase.from("delivery_agents").insert({
        company_id: appUser?.company_id,
        name: agentFormData.name,
        phone: agentFormData.phone,
        agency_details: agentFormData.agency_details,
      });

      if (error) throw error;
      toast({ title: "Agent Registered", description: `${agentFormData.name} added to logistics team.` });
      setAgentFormData({ name: "", phone: "", agency_details: "" });
      setIsAgentDialogOpen(false);
      fetchRegistries();
    } catch (error: any) {
      toast({ title: "Registration Failed", description: error.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRefPersonSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const payload = {
        company_id: appUser?.company_id,
        name: refPersonFormData.name,
        phone: refPersonFormData.phone,
        details: refPersonFormData.details,
        linked_distributor_id: refPersonFormData.linked_distributor_id === "none" ? null : refPersonFormData.linked_distributor_id,
      };

      const { error } = await supabase.from("voucher_reference_persons").insert(payload);

      if (error) throw error;
      toast({ title: "Agent Registered", description: `${refPersonFormData.name} added as an Introduction Agent.` });
      setRefPersonFormData({ name: "", phone: "", details: "", linked_distributor_id: "none" });
      setIsRefPersonDialogOpen(false);
      fetchRegistries();
    } catch (error: any) {
      toast({ title: "Registration Failed", description: error.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'internal_branch':
        return <Badge variant="outline" className="bg-blue-50 text-blue-600 border-blue-200 text-[10px] font-bold h-5 uppercase">Internal</Badge>;
      case 'external_shop':
        return <Badge variant="outline" className="bg-gray-100 text-gray-600 border-gray-200 text-[10px] font-bold h-5 uppercase">External</Badge>;
      case 'corporate_partner':
        return <Badge variant="outline" className="bg-purple-50 text-purple-600 border-purple-200 text-[10px] font-bold h-5 uppercase">Corporate</Badge>;
      case 'voucher_printing_press':
        return <Badge variant="outline" className="bg-orange-50 text-orange-600 border-orange-200 text-[10px] font-bold h-5 uppercase">Printing Press</Badge>;
      case 'sales_person':
        return <Badge variant="outline" className="bg-indigo-50 text-indigo-600 border-indigo-200 text-[10px] font-bold h-5 uppercase">Sales Person</Badge>;
      case 'campaign':
        return <Badge variant="outline" className="bg-rose-50 text-rose-600 border-rose-200 text-[10px] font-bold h-5 uppercase">Campaign</Badge>;
      case 'retail_associates':
        return <Badge variant="outline" className="bg-teal-50 text-teal-600 border-teal-200 text-[10px] font-bold h-5 uppercase">Retail Associate</Badge>;
      case 'institute_retail':
        return <Badge variant="outline" className="bg-cyan-50 text-cyan-600 border-cyan-200 text-[10px] font-bold h-5 uppercase">Institute</Badge>;
      default:
        return <Badge variant="secondary" className="text-[10px] h-5 uppercase">{(type || "Unknown").replace(/_/g, ' ')}</Badge>;
    }
  };

  const getPartnerLevelBadge = (level: string) => {
    switch (level?.toLowerCase()) {
      case 'gold': return "bg-amber-100 text-amber-700 border-amber-300";
      case 'silver': return "bg-slate-100 text-slate-700 border-slate-300";
      case 'platinum': return "bg-sky-100 text-sky-700 border-sky-300";
      default: return "bg-gray-50 text-gray-600 border-gray-200";
    }
  }

  const filteredDistributors = distributors.filter((d) => {
    const matchesSearch = d.distributor_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          d.contact_person?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          d.area_location?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          d.phone?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = typeFilter === "all" || d.distributor_type === typeFilter;
    return matchesSearch && matchesType;
  });

  return (
    <div className="flex flex-col min-h-screen bg-[#fafafa]">
      <header className="sticky top-0 z-40 w-full bg-white/80 backdrop-blur-md border-b border-gray-200 px-4 h-12 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3 overflow-hidden">
          <Link href="/vouchers">
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-md hover:bg-gray-100 transition-colors">
              <ArrowLeft className="h-4 w-4 text-gray-500" />
            </Button>
          </Link>
          
          <Separator orientation="vertical" className="h-4" />
          
          <nav className="flex items-center gap-1.5 text-[13px] whitespace-nowrap overflow-hidden">
            <Link href="/vouchers" className="text-gray-500 hover:text-gray-900 transition-colors font-medium">Vouchers</Link>
            <ChevronRight className="h-3.5 w-3.5 text-gray-400" />
            <span className="font-bold text-gray-900 select-none">Logistics Registry</span>
            
            <div className="ml-3 hidden md:flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-gray-100 border border-gray-200">
              <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-tighter">Live Directory</span>
            </div>
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="h-8 px-2 text-xs font-medium text-gray-500 hover:text-gray-900" onClick={fetchRegistries}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Separator orientation="vertical" className="h-4 mx-1" />
          <Button variant="outline" size="sm" className="h-8 text-xs font-bold px-3 shadow-sm border-gray-200">
            <Database className="h-3.5 w-3.5 mr-1.5 text-gray-400" />
            Master DB
          </Button>
        </div>
      </header>

      <main className="p-4 md:p-8 max-w-[1300px] w-full mx-auto animate-in fade-in duration-500">
        
        <Tabs defaultValue="partners" className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-widest text-gray-500">B2B Partner & Agent Registry</h2>
              <p className="text-xs text-gray-400 mt-1">Authorized entities for voucher circulation and secure delivery</p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Dialog open={isRefPersonDialogOpen} onOpenChange={setIsRefPersonDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9 px-4 font-bold text-xs uppercase tracking-tight shadow-sm border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:text-emerald-800">
                    <Users className="w-3.5 h-3.5 mr-2" />
                    New Intro Agent
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px] p-0 overflow-hidden border-none shadow-2xl">
                  <DialogHeader className="bg-emerald-50 p-6 border-b border-emerald-100">
                    <DialogTitle className="text-lg font-bold text-emerald-900">Add Business Intro Agent</DialogTitle>
                    <DialogDescription className="text-xs font-medium text-emerald-700">Register a person who brings in new business.</DialogDescription>
                  </DialogHeader>
                  <form className="p-6 space-y-4">
                    <div className="space-y-1.5">
                      <Label className="text-[11px] font-bold text-gray-400 uppercase">Agent Name</Label>
                      <div className="relative">
                        <User className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                        <Input placeholder="e.g. John Doe" className="pl-9 h-9 text-sm border-gray-200" value={refPersonFormData.name} onChange={(e) => setRefPersonFormData({...refPersonFormData, name: e.target.value})} required />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[11px] font-bold text-gray-400 uppercase">Phone</Label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                        <Input placeholder="+91..." className="pl-9 h-9 text-sm border-gray-200 font-mono" value={refPersonFormData.phone} onChange={(e) => setRefPersonFormData({...refPersonFormData, phone: e.target.value})} required />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[11px] font-bold text-gray-400 uppercase">Link to Distributor (Optional)</Label>
                      <Select value={refPersonFormData.linked_distributor_id} onValueChange={(v) => setRefPersonFormData({...refPersonFormData, linked_distributor_id: v})}>
                        <SelectTrigger className="h-9 text-sm border-gray-200"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none" className="text-gray-400 italic">No direct affiliation</SelectItem>
                          {distributors.map(d => (
                            <SelectItem key={d.id} value={d.id}>{d.distributor_name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[11px] font-bold text-gray-400 uppercase">Notes / Details</Label>
                      <div className="relative">
                        <IdCard className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                        <Input placeholder="Any specific terms..." className="pl-9 h-9 text-sm border-gray-200" value={refPersonFormData.details} onChange={(e) => setRefPersonFormData({...refPersonFormData, details: e.target.value})} />
                      </div>
                    </div>
                  </form>
                  <DialogFooter className="bg-gray-50 p-4 border-t gap-2">
                    <Button type="button" variant="ghost" size="sm" className="text-xs font-bold uppercase" onClick={() => setIsRefPersonDialogOpen(false)} disabled={isSubmitting}>Cancel</Button>
                    <Button type="button" size="sm" className="text-xs font-bold uppercase px-6 bg-emerald-600 hover:bg-emerald-700 text-white" disabled={isSubmitting} onClick={handleRefPersonSubmit}>
                      {isSubmitting ? <Loader2 className="w-3 h-3 mr-2 animate-spin" /> : null} Save Agent
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              {/* Add / Edit Partner Dialog */}
              <Dialog open={isPartnerDialogOpen} onOpenChange={(open) => {
                if (!open) resetPartnerForm();
                setIsPartnerDialogOpen(open);
              }}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9 px-4 font-bold text-xs uppercase tracking-tight shadow-sm border-gray-200 bg-white" onClick={() => setIsEditMode(false)}>
                    <Store className="w-3.5 h-3.5 mr-2 text-gray-400" />
                    New Partner
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden border-none shadow-2xl">
                  <DialogHeader className="bg-gray-50 p-6 border-b">
                    <DialogTitle className="text-lg font-bold text-gray-900">{isEditMode ? "Edit B2B Partner" : "Add B2B Partner"}</DialogTitle>
                    <DialogDescription className="text-xs font-medium text-gray-500">{isEditMode ? "Update partner details and classification." : "Configure a new distribution point."}</DialogDescription>
                  </DialogHeader>
                  <form id="partner-form" className="p-6 space-y-4 max-h-[65vh] overflow-y-auto custom-scrollbar">
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5 col-span-2 sm:col-span-1">
                        <Label className="text-[11px] font-bold text-gray-400 uppercase">Business Name</Label>
                        <div className="relative">
                          <Building2 className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                          <Input placeholder="e.g. Metro Jewelry Hub" className="pl-9 h-9 text-sm border-gray-200" value={partnerFormData.distributor_name} onChange={(e) => setPartnerFormData({...partnerFormData, distributor_name: e.target.value})} required />
                        </div>
                      </div>
                      <div className="space-y-1.5 col-span-2 sm:col-span-1">
                        <Label className="text-[11px] font-bold text-gray-400 uppercase">Partner Level</Label>
                        <Select value={partnerFormData.partner_level} onValueChange={(v) => setPartnerFormData({...partnerFormData, partner_level: v})}>
                          <SelectTrigger className="h-9 text-sm border-gray-200"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Standard">Standard</SelectItem>
                            <SelectItem value="Bronze">Bronze</SelectItem>
                            <SelectItem value="Silver">Silver</SelectItem>
                            <SelectItem value="Gold">Gold</SelectItem>
                            <SelectItem value="Platinum">Platinum</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5 col-span-2 sm:col-span-1">
                        <div className="flex items-center justify-between">
                          <Label className="text-[11px] font-bold text-gray-400 uppercase">Partner Type</Label>
                          {(appUser?.role === 'owner' || appUser?.role === 'manager') && !isAddingNewCategory && (
                            <Button type="button" variant="ghost" size="sm" className="h-5 px-1.5 text-[10px] text-blue-600 font-bold p-0 uppercase tracking-widest hover:bg-transparent" onClick={() => setIsAddingNewCategory(true)}>
                              <Settings className="w-3 h-3 mr-1" /> Custom
                            </Button>
                          )}
                        </div>
                        {isAddingNewCategory ? (
                          <div className="flex gap-2">
                            <Input placeholder="New..." className="h-9 text-sm border-blue-200 focus-visible:ring-blue-500" value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} autoFocus />
                            <Button type="button" size="icon" onClick={handleCreateCategory} className="bg-blue-600 text-white h-9 w-9"><Plus className="w-4 h-4"/></Button>
                            <Button type="button" variant="ghost" size="icon" className="h-9 w-9" onClick={() => setIsAddingNewCategory(false)}><X className="w-4 h-4"/></Button>
                          </div>
                        ) : (
                          <Select value={partnerFormData.distributor_type} onValueChange={(v) => setPartnerFormData({...partnerFormData, distributor_type: v})}>
                            <SelectTrigger className="h-9 text-sm border-gray-200"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {availableCategories.map(cat => (
                                <SelectItem key={cat} value={cat}>
                                  {cat.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                      
                      <div className="space-y-1.5 col-span-2 sm:col-span-1">
                        <Label className="text-[11px] font-bold text-gray-400 uppercase">Business Category</Label>
                        <Input placeholder="e.g. Retail Jeweler, Salon..." className="h-9 text-sm border-gray-200" value={partnerFormData.business_category} onChange={(e) => setPartnerFormData({...partnerFormData, business_category: e.target.value})} />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-[11px] font-bold text-gray-400 uppercase">Contact Rep</Label>
                        <Input placeholder="Full name" className="h-9 text-sm border-gray-200" value={partnerFormData.contact_person} onChange={(e) => setPartnerFormData({...partnerFormData, contact_person: e.target.value})} />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[11px] font-bold text-gray-400 uppercase">Phone</Label>
                        <div className="relative">
                          <Phone className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                          <Input placeholder="+91..." className="pl-9 h-9 text-sm border-gray-200 font-mono" value={partnerFormData.phone} onChange={(e) => setPartnerFormData({...partnerFormData, phone: e.target.value})} />
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-[11px] font-bold text-gray-400 uppercase">Area / Location</Label>
                        <Input placeholder="e.g. Bandra West" className="h-9 text-sm border-gray-200" value={partnerFormData.area_location} onChange={(e) => setPartnerFormData({...partnerFormData, area_location: e.target.value})} />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[11px] font-bold text-gray-400 uppercase">Full Address</Label>
                        <div className="relative">
                          <MapPin className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                          <Input placeholder="Complete Address" className="pl-9 h-9 text-sm border-gray-200" value={partnerFormData.address} onChange={(e) => setPartnerFormData({...partnerFormData, address: e.target.value})} />
                        </div>
                      </div>
                    </div>
                  </form>
                  <DialogFooter className="bg-gray-50 p-4 border-t gap-2">
                    <Button type="button" variant="ghost" size="sm" className="text-xs font-bold uppercase" onClick={() => setIsPartnerDialogOpen(false)} disabled={isSubmitting}>Cancel</Button>
                    <Button type="button" size="sm" className="text-xs font-bold uppercase px-6 bg-gray-900 text-white" disabled={isSubmitting} onClick={handlePartnerSubmit}>
                      {isSubmitting ? <Loader2 className="w-3 h-3 mr-2 animate-spin" /> : null} {isEditMode ? "Save Changes" : "Commit Partner"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <Dialog open={isAgentDialogOpen} onOpenChange={setIsAgentDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="h-9 px-4 font-bold text-xs uppercase tracking-tight shadow-md bg-black text-white hover:bg-indigo-600">
                    <Truck className="w-3.5 h-3.5 mr-2" />
                    New Agent
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px] p-0 overflow-hidden border-none shadow-2xl">
                  <DialogHeader className="bg-gray-50 p-6 border-b">
                    <DialogTitle className="text-lg font-bold text-gray-900">Add Delivery Agent</DialogTitle>
                    <DialogDescription className="text-xs font-medium text-gray-500">Register a secure courier or staff member.</DialogDescription>
                  </DialogHeader>
                  <form id="add-agent-form" className="p-6 space-y-4">
                    <div className="space-y-1.5">
                      <Label className="text-[11px] font-bold text-gray-400 uppercase">Agent Full Name</Label>
                      <div className="relative">
                        <User className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                        <Input placeholder="e.g. Ramesh Kumar" className="pl-9 h-9 text-sm border-gray-200" value={agentFormData.name} onChange={(e) => setAgentFormData({...agentFormData, name: e.target.value})} required />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[11px] font-bold text-gray-400 uppercase">Primary Phone</Label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                        <Input placeholder="+91..." className="pl-9 h-9 text-sm border-gray-200 font-mono" value={agentFormData.phone} onChange={(e) => setAgentFormData({...agentFormData, phone: e.target.value})} required />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[11px] font-bold text-gray-400 uppercase">Agency / ID Notes</Label>
                      <div className="relative">
                        <IdCard className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                        <Input placeholder="e.g. BlueDart / ID: BD-4921" className="pl-9 h-9 text-sm border-gray-200" value={agentFormData.agency_details} onChange={(e) => setAgentFormData({...agentFormData, agency_details: e.target.value})} />
                      </div>
                    </div>
                  </form>
                  <DialogFooter className="bg-gray-50 p-4 border-t gap-2">
                    <Button type="button" variant="ghost" size="sm" className="text-xs font-bold uppercase" onClick={() => setIsAgentDialogOpen(false)} disabled={isSubmitting}>Cancel</Button>
                    <Button type="button" size="sm" className="text-xs font-bold uppercase px-6 bg-indigo-600 text-white hover:bg-indigo-700" disabled={isSubmitting} onClick={handleAgentSubmit}>
                      {isSubmitting ? <Loader2 className="w-3 h-3 mr-2 animate-spin" /> : null} Commit Agent
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          <Card className="shadow-sm border-gray-200/60 overflow-hidden bg-white">
            <TabsList className="bg-gray-50/80 border-b border-gray-100 rounded-none w-full justify-start h-12 px-4 gap-6 overflow-x-auto custom-scrollbar">
              <TabsTrigger value="partners" className="data-[state=active]:border-b-2 data-[state=active]:border-gray-900 rounded-none px-1 py-3 text-xs font-bold uppercase tracking-widest text-gray-400 data-[state=active]:text-gray-900 shadow-none transition-all bg-transparent whitespace-nowrap">
                B2B Partners ({filteredDistributors.length})
              </TabsTrigger>
              <TabsTrigger value="reference_persons" className="data-[state=active]:border-b-2 data-[state=active]:border-emerald-600 rounded-none px-1 py-3 text-xs font-bold uppercase tracking-widest text-gray-400 data-[state=active]:text-emerald-700 shadow-none transition-all bg-transparent whitespace-nowrap">
                Intro Agents ({referencePersons.length})
              </TabsTrigger>
              <TabsTrigger value="agents" className="data-[state=active]:border-b-2 data-[state=active]:border-indigo-600 rounded-none px-1 py-3 text-xs font-bold uppercase tracking-widest text-gray-400 data-[state=active]:text-indigo-700 shadow-none transition-all bg-transparent whitespace-nowrap">
                Delivery Agents ({agents.length})
              </TabsTrigger>
              <TabsTrigger value="events" className="data-[state=active]:border-b-2 data-[state=active]:border-rose-600 rounded-none px-1 py-3 text-xs font-bold uppercase tracking-widest text-gray-400 data-[state=active]:text-rose-700 shadow-none transition-all bg-transparent whitespace-nowrap">
                Digital Events ({events.length})
              </TabsTrigger>
            </TabsList>

            <CardContent className="p-0">
              
              <TabsContent value="partners" className="m-0">
                <div className="flex flex-col sm:flex-row gap-3 p-4 bg-white border-b border-gray-100">
                  <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                    <Input 
                      placeholder="Search by name, location, phone..." 
                      className="pl-9 h-9 text-sm border-gray-200 shadow-sm"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                  <div className="w-full sm:w-[220px]">
                    <Select value={typeFilter} onValueChange={setTypeFilter}>
                      <SelectTrigger className="h-9 text-sm border-gray-200 shadow-sm">
                        <Filter className="w-4 h-4 mr-2 text-gray-400" />
                        <SelectValue placeholder="Filter by type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Categories</SelectItem>
                        {availableCategories.map(cat => (
                          <SelectItem key={`filter-${cat}`} value={cat}>
                            {cat.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {isLoading ? (
                  <div className="flex justify-center items-center py-20"><Loader2 className="h-8 w-8 animate-spin text-gray-200" /></div>
                ) : filteredDistributors.length === 0 ? (
                  <div className="text-center py-20 bg-gray-50/30">
                    <Store className="w-12 h-12 mx-auto mb-4 text-gray-200" />
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-tighter italic font-sans">
                      {distributors.length > 0 ? "No partners match your filters" : "No distribution partners found"}
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-gray-50/50 border-b">
                        <TableRow className="hover:bg-transparent">
                          <TableHead className="text-[10px] font-black uppercase tracking-widest text-gray-400 px-6 h-10">Entity Name</TableHead>
                          <TableHead className="text-[10px] font-black uppercase tracking-widest text-gray-400 px-4 h-10">Classification</TableHead>
                          <TableHead className="text-[10px] font-black uppercase tracking-widest text-gray-400 px-4 h-10 text-center">Registered</TableHead>
                          <TableHead className="text-[10px] font-black uppercase tracking-widest text-gray-400 px-4 h-10 text-center">Redeemed</TableHead>
                          <TableHead className="text-[10px] font-black uppercase tracking-widest text-gray-400 px-4 h-10 text-center">Conversion</TableHead>
                          <TableHead className="text-[10px] font-black uppercase tracking-widest text-gray-400 px-4 h-10">Created</TableHead>
                          <TableHead className="w-[50px]"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredDistributors.map((distributor) => (
                          <TableRow key={distributor.id} className="hover:bg-gray-50/50 transition-colors border-b border-gray-100">
                            <TableCell className="px-6 py-3">
                              <div className="flex items-center gap-3">
                                <div className="h-8 w-8 rounded bg-gray-100 flex items-center justify-center text-gray-400">
                                  <Building2 className="h-4 w-4" />
                                </div>
                                <div className="flex flex-col">
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold text-sm text-gray-900">{distributor.distributor_name}</span>
                                    {distributor.partner_level && distributor.partner_level !== 'Standard' && (
                                      <Badge variant="outline" className={`text-[9px] h-4 px-1.5 uppercase font-bold tracking-widest ${getPartnerLevelBadge(distributor.partner_level)}`}>
                                        {distributor.partner_level}
                                      </Badge>
                                    )}
                                  </div>
                                  <span className="text-[10px] font-medium text-gray-500 mt-0.5">
                                    {distributor.phone} • {distributor.contact_person}
                                    {distributor.area_location && ` • ${distributor.area_location}`}
                                  </span>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="px-4">
                              <div className="flex flex-col gap-1 items-start">
                                {getTypeBadge(distributor.distributor_type)}
                                {distributor.business_category && <span className="text-[10px] text-gray-500 font-medium truncate max-w-[120px]">{distributor.business_category}</span>}
                              </div>
                            </TableCell>
                            
                            <TableCell className="px-4 text-center">
                              <Badge variant="secondary" className="bg-blue-50 text-blue-700 hover:bg-blue-100 font-bold border-blue-200">
                                {distributor.metrics?.registered || 0}
                              </Badge>
                            </TableCell>
                            <TableCell className="px-4 text-center">
                              <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-bold border-emerald-200">
                                {distributor.metrics?.redeemed || 0}
                              </Badge>
                            </TableCell>
                            <TableCell className="px-4 text-center">
                              <div className="flex items-center justify-center gap-1.5 font-bold text-xs text-gray-700">
                                {distributor.metrics?.conversionRate.toFixed(1)}%
                                {(distributor.metrics?.conversionRate || 0) > 0 && <TrendingUp className="w-3 h-3 text-emerald-500" />}
                              </div>
                            </TableCell>

                            <TableCell className="px-4">
                              <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">{format(new Date(distributor.created_at), "dd MMM yy")}</span>
                            </TableCell>
                            <TableCell className="px-4 text-right">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-400 hover:text-gray-900">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-40 rounded-xl shadow-lg border-gray-100 p-1 bg-white">
                                  <DropdownMenuItem 
                                    onClick={() => handleEditPartner(distributor)} 
                                    className="cursor-pointer flex items-center p-2 rounded-lg text-xs font-semibold text-gray-700 focus:text-blue-700 focus:bg-blue-50"
                                  >
                                    <Edit2 className="w-3.5 h-3.5 mr-2 text-amber-500" />
                                    Edit Details
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="reference_persons" className="m-0">
                {isLoading ? (
                  <div className="flex justify-center items-center py-20"><Loader2 className="h-8 w-8 animate-spin text-gray-200" /></div>
                ) : referencePersons.length === 0 ? (
                  <div className="text-center py-20 bg-gray-50/30">
                    <Users className="w-12 h-12 mx-auto mb-4 text-emerald-200" />
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-tighter italic font-sans">No introduction agents found</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-gray-50/50 border-b">
                        <TableRow className="hover:bg-transparent">
                          <TableHead className="text-[10px] font-black uppercase tracking-widest text-gray-400 px-6 h-10">Agent Name</TableHead>
                          <TableHead className="text-[10px] font-black uppercase tracking-widest text-gray-400 px-4 h-10">Contact Info</TableHead>
                          <TableHead className="text-[10px] font-black uppercase tracking-widest text-gray-400 px-4 h-10">Linked Partner</TableHead>
                          <TableHead className="text-[10px] font-black uppercase tracking-widest text-gray-400 px-4 h-10">Notes</TableHead>
                          <TableHead className="text-[10px] font-black uppercase tracking-widest text-gray-400 px-4 h-10">Registered On</TableHead>
                          <TableHead className="w-[50px]"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {referencePersons.map((person) => (
                          <TableRow key={person.id} className="hover:bg-gray-50/50 transition-colors border-b border-gray-100">
                            <TableCell className="px-6 py-3">
                              <div className="flex items-center gap-3">
                                <div className="h-8 w-8 rounded bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-500">
                                  <Users className="h-4 w-4" />
                                </div>
                                <span className="font-bold text-sm text-gray-900">{person.name}</span>
                              </div>
                            </TableCell>
                            <TableCell className="px-4">
                              <div className="flex items-center gap-2">
                                <Phone className="h-3.5 w-3.5 text-gray-400" />
                                <span className="text-xs font-mono font-bold text-gray-600">{person.phone}</span>
                              </div>
                            </TableCell>
                            <TableCell className="px-4">
                              {person.linked_distributor_id ? (
                                <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200">
                                  <Building2 className="w-3 h-3 mr-1.5"/>
                                  {person.linked_distributor?.distributor_name}
                                </Badge>
                              ) : (
                                <span className="text-xs text-gray-400 italic">Independent</span>
                              )}
                            </TableCell>
                            <TableCell className="px-4">
                              <span className="text-xs font-medium text-gray-700">{person.details || "---"}</span>
                            </TableCell>
                            <TableCell className="px-4">
                              <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">{format(new Date(person.created_at), "dd MMM yy")}</span>
                            </TableCell>
                            <TableCell className="px-4 text-right">
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-md transition-colors">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="agents" className="m-0">
                {isLoading ? (
                  <div className="flex justify-center items-center py-20"><Loader2 className="h-8 w-8 animate-spin text-gray-200" /></div>
                ) : agents.length === 0 ? (
                  <div className="text-center py-20 bg-gray-50/30">
                    <Truck className="w-12 h-12 mx-auto mb-4 text-gray-200" />
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-tighter italic font-sans">No delivery agents found</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-gray-50/50 border-b">
                        <TableRow className="hover:bg-transparent">
                          <TableHead className="text-[10px] font-black uppercase tracking-widest text-gray-400 px-6 h-10">Agent Name</TableHead>
                          <TableHead className="text-[10px] font-black uppercase tracking-widest text-gray-400 px-4 h-10">Phone Contact</TableHead>
                          <TableHead className="text-[10px] font-black uppercase tracking-widest text-gray-400 px-4 h-10">Agency / Details</TableHead>
                          <TableHead className="text-[10px] font-black uppercase tracking-widest text-gray-400 px-4 h-10">Registered On</TableHead>
                          <TableHead className="w-[50px]"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {agents.map((agent) => (
                          <TableRow key={agent.id} className="hover:bg-gray-50/50 transition-colors border-b border-gray-100">
                            <TableCell className="px-6 py-3">
                              <div className="flex items-center gap-3">
                                <div className="h-8 w-8 rounded bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-500">
                                  <User className="h-4 w-4" />
                                </div>
                                <span className="font-bold text-sm text-gray-900">{agent.name}</span>
                              </div>
                            </TableCell>
                            <TableCell className="px-4">
                              <div className="flex items-center gap-2">
                                <Phone className="h-3.5 w-3.5 text-gray-400" />
                                <span className="text-xs font-mono font-bold text-gray-600">{agent.phone}</span>
                              </div>
                            </TableCell>
                            <TableCell className="px-4">
                              <div className="flex items-center gap-2">
                                <IdCard className="h-3.5 w-3.5 text-gray-400" />
                                <span className="text-xs font-medium text-gray-700">{agent.agency_details || "---"}</span>
                              </div>
                            </TableCell>
                            <TableCell className="px-4">
                              <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">{format(new Date(agent.created_at), "dd MMM yy")}</span>
                            </TableCell>
                            <TableCell className="px-4 text-right">
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </TabsContent>

              {/* ✨ NEW: EVENTS TAB CONTENT */}
              <TabsContent value="events" className="m-0">
                {isLoading ? (
                  <div className="flex justify-center items-center py-20"><Loader2 className="h-8 w-8 animate-spin text-gray-200" /></div>
                ) : events.length === 0 ? (
                  <div className="text-center py-20 bg-gray-50/30">
                    <Calendar className="w-12 h-12 mx-auto mb-4 text-rose-200" />
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-tighter italic font-sans">No digital events generated yet</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-gray-50/50 border-b">
                        <TableRow className="hover:bg-transparent">
                          <TableHead className="text-[10px] font-black uppercase tracking-widest text-gray-400 px-6 h-10">Event Name</TableHead>
                          <TableHead className="text-[10px] font-black uppercase tracking-widest text-gray-400 px-4 h-10 text-center">Vouchers Generated</TableHead>
                          <TableHead className="text-[10px] font-black uppercase tracking-widest text-gray-400 px-4 h-10">Last Batch Created</TableHead>
                          <TableHead className="w-[50px]"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {events.map((event, idx) => (
                          <TableRow key={`evt-${idx}`} className="hover:bg-gray-50/50 transition-colors border-b border-gray-100">
                            <TableCell className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className="h-8 w-8 rounded bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-500">
                                  <Calendar className="h-4 w-4" />
                                </div>
                                <span className="font-bold text-sm text-gray-900">{event.event_name}</span>
                              </div>
                            </TableCell>
                            <TableCell className="px-4 text-center">
                              <Badge variant="secondary" className="bg-rose-50 text-rose-700 hover:bg-rose-100 font-bold border-rose-200">
                                {event.voucher_count} Vouchers
                              </Badge>
                            </TableCell>
                            <TableCell className="px-4">
                              <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">
                                {format(new Date(event.last_generated), "dd MMM yyyy, hh:mm a")}
                              </span>
                            </TableCell>
                            <TableCell className="px-4 text-right">
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </TabsContent>

            </CardContent>
          </Card>
        </Tabs>
      </main>
    </div>
  );
}