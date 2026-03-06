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
  LayoutDashboard,
  User
} from "lucide-react";

import { supabase } from "@/lib/supabaseClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
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
  distributor_type: 'internal_branch' | 'external_shop' | 'corporate_partner';
  created_at: string;
}

export default function DistributorsPage() {
  const { toast } = useToast();
  const { appUser } = useAuth();

  const [distributors, setDistributors] = useState<Distributor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    distributor_name: "",
    contact_person: "",
    phone: "",
    address: "",
    distributor_type: "external_shop",
  });

  const fetchDistributors = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("voucher_distributors")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setDistributors(data || []);
    } catch (error: any) {
      console.error("Error fetching distributors:", error);
      toast({
        title: "Load Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDistributors();
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (value: string) => {
    setFormData((prev) => ({ ...prev, distributor_type: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      if (!appUser || !appUser.company_id) {
        throw new Error("Authentication error: Could not verify company profile.");
      }

      const { error } = await supabase
        .from("voucher_distributors")
        .insert({
          company_id: appUser.company_id,
          distributor_name: formData.distributor_name,
          contact_person: formData.contact_person,
          phone: formData.phone,
          address: formData.address,
          distributor_type: formData.distributor_type,
        });

      if (error) throw error;

      toast({
        title: "Partner Registered",
        description: `${formData.distributor_name} added to ledger.`,
      });

      setFormData({
        distributor_name: "",
        contact_person: "",
        phone: "",
        address: "",
        distributor_type: "external_shop",
      });
      setIsDialogOpen(false);
      fetchDistributors();
    } catch (error: any) {
      console.error("Error creating distributor:", error);
      toast({
        title: "Registration Failed",
        description: error.message || "An error occurred.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getTypeBadge = (type: Distributor['distributor_type']) => {
    switch (type) {
      case 'internal_branch':
        return <Badge variant="outline" className="bg-blue-500/5 text-blue-600 border-blue-200/50 text-[10px] font-bold h-5 uppercase">Internal</Badge>;
      case 'external_shop':
        return <Badge variant="outline" className="bg-slate-500/5 text-slate-600 border-slate-200/50 text-[10px] font-bold h-5 uppercase">External</Badge>;
      case 'corporate_partner':
        return <Badge variant="outline" className="bg-purple-500/5 text-purple-600 border-purple-200/50 text-[10px] font-bold h-5 uppercase">Corporate</Badge>;
      default:
        return <Badge variant="secondary" className="text-[10px] h-5 uppercase">{type}</Badge>;
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
            <span className="font-bold text-gray-900 select-none">Distributors</span>
            
            <div className="ml-3 hidden md:flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-gray-100 border border-gray-200">
              <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-tighter">Live Directory</span>
            </div>
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="h-8 px-2 text-xs font-medium text-gray-500 hover:text-gray-900" onClick={fetchDistributors}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Separator orientation="vertical" className="h-4 mx-1" />
          <Button variant="outline" size="sm" className="h-8 text-xs font-bold px-3 shadow-sm border-gray-200">
            <Database className="h-3.5 w-3.5 mr-1.5 text-gray-400" />
            Partner DB
          </Button>
        </div>
      </header>

      <main className="p-4 md:p-8 max-w-[1200px] w-full mx-auto space-y-6 animate-in fade-in duration-500">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-widest text-gray-500">B2B Partner Registry</h2>
            <p className="text-xs text-gray-400 mt-1">Authorized entities for voucher circulation</p>
          </div>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="h-9 px-4 font-bold text-xs uppercase tracking-tight shadow-md">
                <Plus className="w-3.5 h-3.5 mr-2" />
                Register Partner
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px] p-0 overflow-hidden border-none shadow-2xl">
              <DialogHeader className="bg-gray-50 p-6 border-b">
                <DialogTitle className="text-lg font-bold text-gray-900">Add New Partner</DialogTitle>
                <DialogDescription className="text-xs font-medium text-gray-500">
                  Configure a new distribution point in the system.
                </DialogDescription>
              </DialogHeader>
              <form id="add-distributor-form" onSubmit={handleSubmit} className="p-6 space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="distributor_name" className="text-[11px] font-bold text-gray-400 uppercase">Business Name</Label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                    <Input id="distributor_name" name="distributor_name" placeholder="e.g. Metro Jewelry Hub" className="pl-9 h-9 text-sm border-gray-200" value={formData.distributor_name} onChange={handleInputChange} required />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[11px] font-bold text-gray-400 uppercase">Partner Category</Label>
                  <Select value={formData.distributor_type} onValueChange={handleSelectChange}>
                    <SelectTrigger className="h-9 text-sm border-gray-200">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="external_shop">External Vendor</SelectItem>
                      <SelectItem value="internal_branch">Internal Branch</SelectItem>
                      <SelectItem value="corporate_partner">Corporate Account</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="contact_person" className="text-[11px] font-bold text-gray-400 uppercase">Contact Rep</Label>
                    <Input id="contact_person" name="contact_person" placeholder="Full name" className="h-9 text-sm border-gray-200" value={formData.contact_person} onChange={handleInputChange} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="phone" className="text-[11px] font-bold text-gray-400 uppercase">Phone</Label>
                    <Input id="phone" name="phone" placeholder="+91..." className="h-9 text-sm border-gray-200 font-mono" value={formData.phone} onChange={handleInputChange} />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="address" className="text-[11px] font-bold text-gray-400 uppercase">Operating Address</Label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                    <Input id="address" name="address" placeholder="Locality, City" className="pl-9 h-9 text-sm border-gray-200" value={formData.address} onChange={handleInputChange} />
                  </div>
                </div>
              </form>
              <DialogFooter className="bg-gray-50 p-4 border-t gap-2">
                <Button type="button" variant="ghost" size="sm" className="text-xs font-bold uppercase" onClick={() => setIsDialogOpen(false)} disabled={isSubmitting}>Cancel</Button>
                <Button type="submit" form="add-distributor-form" size="sm" className="text-xs font-bold uppercase px-6" disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="w-3 h-3 mr-2 animate-spin" /> : null}
                  Commit to Registry
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <Card className="shadow-sm border-gray-200/60 overflow-hidden bg-white">
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex justify-center items-center py-20"><Loader2 className="h-8 w-8 animate-spin text-gray-200" /></div>
            ) : distributors.length === 0 ? (
              <div className="text-center py-20 bg-gray-50/30">
                <Store className="w-12 h-12 mx-auto mb-4 text-gray-200" />
                <p className="text-xs font-bold text-gray-400 uppercase tracking-tighter italic font-sans">No distribution partners found in directory</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-gray-50/50 border-b">
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="text-[10px] font-black uppercase text-gray-400 px-6 h-10">Entity Name</TableHead>
                      <TableHead className="text-[10px] font-black uppercase text-gray-400 px-4 h-10">Classification</TableHead>
                      <TableHead className="text-[10px] font-black uppercase text-gray-400 px-4 h-10">Primary Contact</TableHead>
                      <TableHead className="text-[10px] font-black uppercase text-gray-400 px-4 h-10">Phone / Comms</TableHead>
                      <TableHead className="text-[10px] font-black uppercase text-gray-400 px-4 h-10">Created</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {distributors.map((distributor) => (
                      <TableRow key={distributor.id} className="hover:bg-gray-50/50 transition-colors border-b">
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
                             <User className="h-3 w-3 text-gray-300" />
                             <span className="text-[13px] font-medium text-gray-600">{distributor.contact_person || "N/A"}</span>
                           </div>
                        </TableCell>
                        <TableCell className="px-4">
                           <div className="flex items-center gap-2">
                             <Phone className="h-3 w-3 text-gray-300" />
                             <span className="text-[12px] font-mono text-gray-500">{distributor.phone || "---"}</span>
                           </div>
                        </TableCell>
                        <TableCell className="px-4">
                          <span className="text-[11px] font-bold text-gray-400 uppercase">{format(new Date(distributor.created_at), "dd MMM yy")}</span>
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
          </CardContent>
        </Card>
      </main>
    </div>
  );
}