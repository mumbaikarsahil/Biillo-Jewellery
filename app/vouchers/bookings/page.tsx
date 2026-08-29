"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { 
  Plus, Loader2, ArrowLeft, ChevronRight, RefreshCw, 
  Search, BookmarkPlus, CalendarClock, Building2, CheckCircle2, CircleDashed
} from "lucide-react";

import { supabase } from "@/lib/supabaseClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

interface Booking {
  id: string;
  booking_ref: string;
  distributor_id: string;
  requested_quantity: number;
  fulfilled_quantity: number;
  status: string;
  notes: string;
  created_at: string;
  distributor?: {
    distributor_name: string;
    distributor_type: string;
  };
}

export default function BookingsPage() {
  const { toast } = useToast();
  const { appUser } = useAuth();

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [distributors, setDistributors] = useState<{ id: string; distributor_name: string }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    distributor_id: "",
    requested_quantity: 1000,
    notes: "",
  });

  const fetchData = async () => {
    setIsLoading(true);
    try {
      if (!appUser?.company_id) return;

      // Fetch Bookings with linked distributor data
      const { data: bookingsData, error: bError } = await supabase
        .from("voucher_bookings")
        .select("*, distributor:distributor_id(distributor_name, distributor_type)")
        .eq("company_id", appUser.company_id)
        .order("created_at", { ascending: false });
      if (bError) throw bError;
      setBookings(bookingsData || []);

      // Fetch Distributors for the dropdown
      const { data: distData, error: dError } = await supabase
        .from("voucher_distributors")
        .select("id, distributor_name")
        .eq("company_id", appUser.company_id)
        .order("distributor_name", { ascending: true });
      if (dError) throw dError;
      setDistributors(distData || []);

    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [appUser]);

  const handleCreateBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.distributor_id) {
      return toast({ title: "Validation", description: "Please select a partner.", variant: "destructive" });
    }
    
    setIsSubmitting(true);
    try {
      const bookingRef = `BK-${Date.now().toString().slice(-6)}`;

      const { error } = await supabase.from("voucher_bookings").insert({
        company_id: appUser?.company_id,
        booking_ref: bookingRef,
        distributor_id: formData.distributor_id,
        requested_quantity: Number(formData.requested_quantity),
        notes: formData.notes,
        status: "pending"
      });

      if (error) throw error;
      
      toast({ title: "Booking Created", description: `${bookingRef} has been successfully logged.` });
      setIsDialogOpen(false);
      setFormData({ distributor_id: "", requested_quantity: 1000, notes: "" });
      fetchData();
    } catch (error: any) {
      toast({ title: "Failed to Book", description: error.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredBookings = bookings.filter(b => 
    b.booking_ref.toLowerCase().includes(searchTerm.toLowerCase()) || 
    b.distributor?.distributor_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="bg-amber-50 text-amber-600 border-amber-200 text-[10px] font-bold uppercase"><CircleDashed className="w-3 h-3 mr-1" /> Pending</Badge>;
      case 'partially_fulfilled':
        return <Badge variant="outline" className="bg-blue-50 text-blue-600 border-blue-200 text-[10px] font-bold uppercase"><RefreshCw className="w-3 h-3 mr-1" /> Partial</Badge>;
      case 'completed':
        return <Badge variant="outline" className="bg-emerald-50 text-emerald-600 border-emerald-200 text-[10px] font-bold uppercase"><CheckCircle2 className="w-3 h-3 mr-1" /> Completed</Badge>;
      case 'cancelled':
        return <Badge variant="secondary" className="text-[10px] font-bold uppercase">Cancelled</Badge>;
      default:
        return <Badge variant="secondary" className="text-[10px] uppercase">{status}</Badge>;
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#fafafa]">
      
      {/* Header */}
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
            <span className="font-bold text-gray-900 select-none">Fulfillment Bookings</span>
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="h-8 px-2 text-xs font-medium text-gray-500 hover:text-gray-900" onClick={fetchData}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isLoading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
        </div>
      </header>

      <main className="p-4 md:p-8 max-w-[1300px] w-full mx-auto animate-in fade-in duration-500">
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-xl font-serif font-bold text-gray-900 tracking-tight">Voucher Pre-Orders</h2>
            <p className="text-xs text-gray-500 mt-1">Manage requested allocations before physical distribution.</p>
          </div>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="h-10 px-6 font-bold text-xs uppercase tracking-tight shadow-md bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl">
                <BookmarkPlus className="w-4 h-4 mr-2" /> New Booking
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[450px] p-0 overflow-hidden border-none shadow-2xl rounded-2xl">
              <DialogHeader className="bg-indigo-50/50 p-6 border-b border-indigo-100/50">
                <DialogTitle className="text-lg font-bold text-gray-900">Create New Request</DialogTitle>
                <DialogDescription className="text-xs font-medium text-gray-500">Book vouchers to fulfill later.</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreateBooking} className="p-6 space-y-5">
                
                <div className="space-y-2">
                  <Label className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Select Partner</Label>
                  <Select value={formData.distributor_id} onValueChange={(v) => setFormData({...formData, distributor_id: v})}>
                    <SelectTrigger className="h-11 text-sm border-gray-200 rounded-xl bg-gray-50/50">
                      <SelectValue placeholder="Search or select a partner..." />
                    </SelectTrigger>
                    <SelectContent>
                      {distributors.length === 0 && <SelectItem value="none" disabled>No partners available</SelectItem>}
                      {distributors.map(d => (
                        <SelectItem key={d.id} value={d.id}>{d.distributor_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Requested Quantity</Label>
                  <Input 
                    type="number" 
                    min="1"
                    className="h-11 text-sm font-bold border-gray-200 rounded-xl bg-gray-50/50" 
                    value={formData.requested_quantity} 
                    onChange={(e) => setFormData({...formData, requested_quantity: e.target.valueAsNumber})} 
                    required 
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Internal Notes</Label>
                  <Input 
                    placeholder="e.g., Needed for Diwali Campaign" 
                    className="h-11 text-sm border-gray-200 rounded-xl bg-gray-50/50" 
                    value={formData.notes} 
                    onChange={(e) => setFormData({...formData, notes: e.target.value})} 
                  />
                </div>

                <DialogFooter className="pt-2">
                  <Button type="button" variant="ghost" className="rounded-xl text-xs font-bold" onClick={() => setIsDialogOpen(false)} disabled={isSubmitting}>Cancel</Button>
                  <Button type="submit" className="rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-md" disabled={isSubmitting}>
                    {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : "Confirm Booking"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card className="shadow-sm border-gray-200/60 overflow-hidden bg-white rounded-2xl">
          <div className="p-4 border-b border-gray-100 bg-gray-50/30">
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <Input 
                placeholder="Search by Reference ID or Partner..." 
                className="pl-9 h-10 text-sm border-gray-200 shadow-sm rounded-xl bg-white"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex justify-center items-center py-20"><Loader2 className="h-8 w-8 animate-spin text-indigo-400" /></div>
            ) : filteredBookings.length === 0 ? (
              <div className="text-center py-20 bg-gray-50/30">
                <CalendarClock className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p className="text-sm font-bold text-gray-500 tracking-tight">No open bookings found.</p>
                <p className="text-xs text-gray-400 mt-1">Create a pre-order to start tracking demand.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-gray-50/80">
                    <TableRow className="hover:bg-transparent border-b border-gray-200">
                      <TableHead className="text-[10px] font-black uppercase tracking-widest text-gray-500 h-11 px-6">Booking Ref</TableHead>
                      <TableHead className="text-[10px] font-black uppercase tracking-widest text-gray-500 h-11 px-4">Partner</TableHead>
                      <TableHead className="text-[10px] font-black uppercase tracking-widest text-gray-500 h-11 px-4 text-center">Fulfillment Progress</TableHead>
                      <TableHead className="text-[10px] font-black uppercase tracking-widest text-gray-500 h-11 px-4">Status</TableHead>
                      <TableHead className="text-[10px] font-black uppercase tracking-widest text-gray-500 h-11 px-4">Date Logged</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredBookings.map((booking) => {
                      const progressPercentage = Math.round((booking.fulfilled_quantity / booking.requested_quantity) * 100);
                      const isComplete = booking.status === 'completed';

                      return (
                        <TableRow key={booking.id} className="hover:bg-gray-50/50 transition-colors border-b border-gray-100 h-16">
                          <TableCell className="px-6">
                            <span className="font-mono font-bold text-sm text-gray-900 bg-gray-100 px-2 py-1 rounded-md">{booking.booking_ref}</span>
                          </TableCell>
                          
                          <TableCell className="px-4">
                            <div className="flex items-center gap-3">
                              <div className="h-8 w-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-500 shrink-0">
                                <Building2 className="h-4 w-4" />
                              </div>
                              <div className="flex flex-col">
                                <span className="font-bold text-sm text-gray-900 line-clamp-1">{booking.distributor?.distributor_name}</span>
                                <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">{booking.distributor?.distributor_type.replace(/_/g, ' ')}</span>
                              </div>
                            </div>
                          </TableCell>

                          <TableCell className="px-4 min-w-[200px]">
                            <div className="flex flex-col gap-1.5">
                              <div className="flex justify-between text-xs font-bold">
                                <span className={isComplete ? "text-emerald-600" : "text-indigo-600"}>{booking.fulfilled_quantity} Issued</span>
                                <span className="text-gray-500">of {booking.requested_quantity}</span>
                              </div>
                              <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                                <div 
                                  className={`h-full transition-all duration-500 ${isComplete ? 'bg-emerald-500' : 'bg-indigo-500'}`} 
                                  style={{ width: `${progressPercentage}%` }}
                                />
                              </div>
                            </div>
                          </TableCell>

                          <TableCell className="px-4">
                            {getStatusBadge(booking.status)}
                          </TableCell>

                          <TableCell className="px-4">
                            <div className="flex flex-col">
                              <span className="text-[11px] font-bold text-gray-700">{format(new Date(booking.created_at), "dd MMM yyyy")}</span>
                              <span className="text-[10px] text-gray-500">{format(new Date(booking.created_at), "hh:mm a")}</span>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}
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