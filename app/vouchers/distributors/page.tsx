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
  IdCard
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
  CardHeader,
  CardTitle,
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

interface Distributor {
  id: string;
  distributor_name: string;
  contact_person: string;
  phone: string;
  address: string;
  // ✨ Updated Interface to support new types
  distributor_type: 'internal_branch' | 'external_shop' | 'corporate_partner' | 'voucher_printing_press' | 'business_introduction_agent' | 'sales_person';
  created_at: string;
}

interface DeliveryAgent {
  id: string;
  name: string;
  phone: string;
  agency_details: string;
  created_at: string;
}

export default function DistributorsPage() {
  const { toast } = useToast();
  const { appUser } = useAuth();

  const [distributors, setDistributors] = useState<Distributor[]>([]);
  const [agents, setAgents] = useState<DeliveryAgent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Modals & Submit States
  const [isPartnerDialogOpen, setIsPartnerDialogOpen] = useState(false);
  const [isAgentDialogOpen, setIsAgentDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [partnerFormData, setPartnerFormData] = useState({
    distributor_name: "",
    contact_person: "",
    phone: "",
    address: "",
    distributor_type: "external_shop",
  });

  const [agentFormData, setAgentFormData] = useState({
    name: "",
    phone: "",
    agency_details: "",
  });

  const fetchRegistries = async () => {
    setIsLoading(true);
    try {
      // 1. Fetch Partners
      const { data: distData, error: distErr } = await supabase
        .from("voucher_distributors")
        .select("*")
        .eq("company_id", appUser?.company_id)
        .order("created_at", { ascending: false });

      if (distErr) throw distErr;
      setDistributors(distData || []);

      // 2. Fetch Agents
      const { data: agentData, error: agentErr } = await supabase
        .from("delivery_agents")
        .select("*")
        .eq("company_id", appUser?.company_id)
        .order("created_at", { ascending: false });

      if (agentErr) throw agentErr;
      setAgents(agentData || []);

    } catch (error: any) {
      console.error("Error fetching registries:", error);
      toast({ title: "Load Error", description: error.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (appUser) fetchRegistries();
  }, [appUser]);

  // --- Partner Logic ---
  const handlePartnerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const { error } = await supabase.from("voucher_distributors").insert({
        company_id: appUser?.company_id,
        distributor_name: partnerFormData.distributor_name,
        contact_person: partnerFormData.contact_person,
        phone: partnerFormData.phone,
        address: partnerFormData.address,
        distributor_type: partnerFormData.distributor_type,
      });

      if (error) throw error;
      toast({ title: "Partner Registered", description: `${partnerFormData.distributor_name} added to ledger.` });
      setPartnerFormData({ distributor_name: "", contact_person: "", phone: "", address: "", distributor_type: "external_shop" });
      setIsPartnerDialogOpen(false);
      fetchRegistries();
    } catch (error: any) {
      toast({ title: "Registration Failed", description: error.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- Agent Logic ---
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

  // ✨ Added badge styles for the 3 new roles
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
      case 'business_introduction_agent':
        return <Badge variant="outline" className="bg-emerald-50 text-emerald-600 border-emerald-200 text-[10px] font-bold h-5 uppercase">Intro Agent</Badge>;
      case 'sales_person':
        return <Badge variant="outline" className="bg-indigo-50 text-indigo-600 border-indigo-200 text-[10px] font-bold h-5 uppercase">Sales Person</Badge>;
      default:
        return <Badge variant="secondary" className="text-[10px] h-5 uppercase">{type.replace(/_/g, ' ')}</Badge>;
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#fafafa]">
      {/* --- COMPACT IDE-STYLE TOOLBAR HEADER --- */}
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

      <main className="p-4 md:p-8 max-w-[1200px] w-full mx-auto animate-in fade-in duration-500">
        
        <Tabs defaultValue="partners" className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-widest text-gray-500">B2B Partner & Agent Registry</h2>
              <p className="text-xs text-gray-400 mt-1">Authorized entities for voucher circulation and secure delivery</p>
            </div>

            <div className="flex gap-2">
              {/* Add Partner Dialog */}
              <Dialog open={isPartnerDialogOpen} onOpenChange={setIsPartnerDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9 px-4 font-bold text-xs uppercase tracking-tight shadow-sm border-gray-200 bg-white">
                    <Store className="w-3.5 h-3.5 mr-2 text-gray-400" />
                    New Partner
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px] p-0 overflow-hidden border-none shadow-2xl">
                  <DialogHeader className="bg-gray-50 p-6 border-b">
                    <DialogTitle className="text-lg font-bold text-gray-900">Add B2B Partner</DialogTitle>
                    <DialogDescription className="text-xs font-medium text-gray-500">Configure a new distribution point.</DialogDescription>
                  </DialogHeader>
                  <form id="add-partner-form" onSubmit={handlePartnerSubmit} className="p-6 space-y-4">
                    <div className="space-y-1.5">
                      <Label className="text-[11px] font-bold text-gray-400 uppercase">Business Name</Label>
                      <div className="relative">
                        <Building2 className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                        <Input placeholder="e.g. Metro Jewelry Hub" className="pl-9 h-9 text-sm border-gray-200" value={partnerFormData.distributor_name} onChange={(e) => setPartnerFormData({...partnerFormData, distributor_name: e.target.value})} required />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[11px] font-bold text-gray-400 uppercase">Partner Category</Label>
                      <Select value={partnerFormData.distributor_type} onValueChange={(v) => setPartnerFormData({...partnerFormData, distributor_type: v})}>
                        <SelectTrigger className="h-9 text-sm border-gray-200"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="external_shop">External Vendor</SelectItem>
                          <SelectItem value="internal_branch">Internal Branch</SelectItem>
                          <SelectItem value="corporate_partner">Corporate Account</SelectItem>
                          {/* ✨ Added 3 new roles here */}
                          <SelectItem value="voucher_printing_press">Voucher Printing Press</SelectItem>
                          <SelectItem value="business_introduction_agent">Business Introduction Agent</SelectItem>
                          <SelectItem value="sales_person">Sales Person</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-[11px] font-bold text-gray-400 uppercase">Contact Rep</Label>
                        <Input placeholder="Full name" className="h-9 text-sm border-gray-200" value={partnerFormData.contact_person} onChange={(e) => setPartnerFormData({...partnerFormData, contact_person: e.target.value})} />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[11px] font-bold text-gray-400 uppercase">Phone</Label>
                        <Input placeholder="+91..." className="h-9 text-sm border-gray-200 font-mono" value={partnerFormData.phone} onChange={(e) => setPartnerFormData({...partnerFormData, phone: e.target.value})} />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[11px] font-bold text-gray-400 uppercase">Operating Address</Label>
                      <div className="relative">
                        <MapPin className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                        <Input placeholder="Locality, City" className="pl-9 h-9 text-sm border-gray-200" value={partnerFormData.address} onChange={(e) => setPartnerFormData({...partnerFormData, address: e.target.value})} />
                      </div>
                    </div>
                  </form>
                  <DialogFooter className="bg-gray-50 p-4 border-t gap-2">
                    <Button type="button" variant="ghost" size="sm" className="text-xs font-bold uppercase" onClick={() => setIsPartnerDialogOpen(false)} disabled={isSubmitting}>Cancel</Button>
                    <Button type="submit" form="add-partner-form" size="sm" className="text-xs font-bold uppercase px-6 bg-gray-900" disabled={isSubmitting}>
                      {isSubmitting ? <Loader2 className="w-3 h-3 mr-2 animate-spin" /> : null} Commit Partner
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              {/* Add Agent Dialog */}
              <Dialog open={isAgentDialogOpen} onOpenChange={setIsAgentDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="h-9 px-4 font-bold text-xs uppercase tracking-tight shadow-md bg-black hover:bg-indigo-600">
                    <Truck className="w-3.5 h-3.5 mr-2" />
                    New Agent
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px] p-0 overflow-hidden border-none shadow-2xl">
                  <DialogHeader className="bg-gray-50 p-6 border-b">
                    <DialogTitle className="text-lg font-bold text-gray-900">Add Delivery Agent</DialogTitle>
                    <DialogDescription className="text-xs font-medium text-gray-500">Register a secure courier or staff member.</DialogDescription>
                  </DialogHeader>
                  <form id="add-agent-form" onSubmit={handleAgentSubmit} className="p-6 space-y-4">
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
                    <Button type="submit" form="add-agent-form" size="sm" className="text-xs font-bold uppercase px-6 bg-indigo-600 hover:bg-indigo-700" disabled={isSubmitting}>
                      {isSubmitting ? <Loader2 className="w-3 h-3 mr-2 animate-spin" /> : null} Commit Agent
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          <Card className="shadow-sm border-gray-200/60 overflow-hidden bg-white">
            <TabsList className="bg-gray-50/80 border-b border-gray-100 rounded-none w-full justify-start h-12 px-4 gap-6">
              <TabsTrigger value="partners" className="data-[state=active]:border-b-2 data-[state=active]:border-gray-900 rounded-none px-1 py-3 text-xs font-bold uppercase tracking-widest text-gray-400 data-[state=active]:text-gray-900 shadow-none transition-all bg-transparent">
                B2B Partners ({distributors.length})
              </TabsTrigger>
              <TabsTrigger value="agents" className="data-[state=active]:border-b-2 data-[state=active]:border-indigo-600 rounded-none px-1 py-3 text-xs font-bold uppercase tracking-widest text-gray-400 data-[state=active]:text-indigo-700 shadow-none transition-all bg-transparent">
                Delivery Agents ({agents.length})
              </TabsTrigger>
            </TabsList>

            <CardContent className="p-0">
              
              {/* PARTNERS TABLE */}
              <TabsContent value="partners" className="m-0">
                {isLoading ? (
                  <div className="flex justify-center items-center py-20"><Loader2 className="h-8 w-8 animate-spin text-gray-200" /></div>
                ) : distributors.length === 0 ? (
                  <div className="text-center py-20 bg-gray-50/30">
                    <Store className="w-12 h-12 mx-auto mb-4 text-gray-200" />
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-tighter italic font-sans">No distribution partners found</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-gray-50/50 border-b">
                        <TableRow className="hover:bg-transparent">
                          <TableHead className="text-[10px] font-black uppercase tracking-widest text-gray-400 px-6 h-10">Entity Name</TableHead>
                          <TableHead className="text-[10px] font-black uppercase tracking-widest text-gray-400 px-4 h-10">Classification</TableHead>
                          <TableHead className="text-[10px] font-black uppercase tracking-widest text-gray-400 px-4 h-10">Primary Contact</TableHead>
                          <TableHead className="text-[10px] font-black uppercase tracking-widest text-gray-400 px-4 h-10">Phone / Comms</TableHead>
                          <TableHead className="text-[10px] font-black uppercase tracking-widest text-gray-400 px-4 h-10">Created</TableHead>
                          <TableHead className="w-[50px]"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {distributors.map((distributor) => (
                          <TableRow key={distributor.id} className="hover:bg-gray-50/50 transition-colors border-b border-gray-100">
                            <TableCell className="px-6 py-3">
                              <div className="flex items-center gap-3">
                                <div className="h-8 w-8 rounded bg-gray-100 flex items-center justify-center text-gray-400">
                                  <Building2 className="h-4 w-4" />
                                </div>
                                <span className="font-bold text-sm text-gray-900">{distributor.distributor_name}</span>
                              </div>
                            </TableCell>
                            <TableCell className="px-4">{getTypeBadge(distributor.distributor_type)}</TableCell>
                            <TableCell className="px-4">
                              <div className="flex items-center gap-2">
                                <User className="h-3.5 w-3.5 text-gray-400" />
                                <span className="text-xs font-semibold text-gray-700">{distributor.contact_person || "N/A"}</span>
                              </div>
                            </TableCell>
                            <TableCell className="px-4">
                              <div className="flex items-center gap-2">
                                <Phone className="h-3.5 w-3.5 text-gray-400" />
                                <span className="text-xs font-mono font-bold text-gray-600">{distributor.phone || "---"}</span>
                              </div>
                            </TableCell>
                            <TableCell className="px-4">
                              <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">{format(new Date(distributor.created_at), "dd MMM yy")}</span>
                            </TableCell>
                            <TableCell className="px-4 text-right">
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-400 hover:text-gray-900">
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

              {/* AGENTS TABLE */}
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

            </CardContent>
          </Card>
        </Tabs>
      </main>
    </div>
  );
}