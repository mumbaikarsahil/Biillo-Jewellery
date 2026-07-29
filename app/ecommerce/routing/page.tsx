"use client";

import React, { useEffect, useState } from "react";
import { 
  MapPin, Plus, Search, Edit2, Trash2, 
  Loader2, CheckCircle2, AlertTriangle, Truck, X
} from "lucide-react";

import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

export default function EcommerceRoutingPage() {
  const { appUser } = useAuth();
  const { toast } = useToast();

  const [mappings, setMappings] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [mappingForm, setMappingForm] = useState({
    id: "",
    pincode: "",
    warehouse_id: "",
    local_transit_days: "2"
  });
  const [mappingToDelete, setMappingToDelete] = useState<any>(null);

  // Pagination States
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);

  // ==========================================================================
  // DATA FETCHING
  // ==========================================================================
  const fetchData = async () => {
    if (!appUser?.company_id) return;
    setIsLoading(true);
    try {
      // 1. Fetch Warehouses for the dropdown
      const { data: whData, error: whError } = await supabase
        .from("warehouses")
        .select("id, name, warehouse_type")
        .eq("company_id", appUser.company_id)
        .eq("is_active", true)
        .order("name", { ascending: true });

      if (whError) throw whError;
      setWarehouses(whData || []);

      // 2. Fetch Pincode Mappings
      const { data: mapData, error: mapError } = await supabase
        .from("warehouse_pincode_mapping")
        .select(`
          *,
          warehouse:warehouses(name, warehouse_type)
        `)
        .eq("company_id", appUser.company_id)
        .order("pincode", { ascending: true });

      if (mapError) throw mapError;
      setMappings(mapData || []);

    } catch (err: any) {
      toast({ title: "Failed to load data", description: err.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [appUser]);

  // ==========================================================================
  // CRUD OPERATIONS
  // ==========================================================================
  const handleSaveMapping = async () => {
    if (!mappingForm.pincode.trim() || !mappingForm.warehouse_id || !appUser) {
      toast({ title: "Validation Error", description: "Pincode and Target Branch are required.", variant: "destructive" });
      return;
    }

    // Basic Pincode Validation (6 digits for India)
    if (!/^\d{6}$/.test(mappingForm.pincode.trim())) {
      toast({ title: "Invalid Format", description: "Please enter a valid 6-digit Pincode.", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        company_id: appUser.company_id,
        pincode: mappingForm.pincode.trim(),
        warehouse_id: mappingForm.warehouse_id,
        local_transit_days: Number(mappingForm.local_transit_days) || 2
      };

      if (mappingForm.id) {
        // Check for duplicates before updating
        const duplicateCheck = mappings.find(m => m.pincode === payload.pincode && m.id !== mappingForm.id);
        if (duplicateCheck) throw new Error("This pincode is already mapped to another branch.");

        const { error } = await supabase.from("warehouse_pincode_mapping").update(payload).eq("id", mappingForm.id);
        if (error) throw error;
        toast({ title: "Mapping Updated", description: `Pincode ${payload.pincode} has been updated.` });
      } else {
        const { error } = await supabase.from("warehouse_pincode_mapping").insert(payload);
        if (error) {
          if (error.code === '23505') throw new Error("This pincode is already mapped to a branch.");
          throw error;
        }
        toast({ title: "Mapping Created", description: `Pincode ${payload.pincode} successfully mapped.` });
      }

      setIsModalOpen(false);
      fetchData();
    } catch (err: any) {
      toast({ title: "Operation Failed", description: err.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteMapping = async () => {
    if (!mappingToDelete) return;
    setIsSubmitting(true);
    try {
      const { error } = await supabase.from("warehouse_pincode_mapping").delete().eq("id", mappingToDelete.id);
      if (error) throw error;
      toast({ title: "Mapping Removed", description: `Pincode ${mappingToDelete.pincode} is no longer mapped.` });
      setIsDeleteDialogOpen(false);
      setMappingToDelete(null);
      fetchData();
    } catch (err: any) {
      toast({ title: "Deletion Failed", description: err.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditModal = (map: any) => {
    setMappingForm({
      id: map.id,
      pincode: map.pincode,
      warehouse_id: map.warehouse_id,
      local_transit_days: map.local_transit_days?.toString() || "2"
    });
    setIsModalOpen(true);
  };

  // ==========================================================================
  // FILTERING & PAGINATION
  // ==========================================================================
  const filteredMappings = mappings.filter(m => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return m.pincode.includes(q) || m.warehouse?.name?.toLowerCase().includes(q);
  });

  const totalPages = Math.ceil(filteredMappings.length / itemsPerPage);
  const paginatedMappings = filteredMappings.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // Reset to page 1 on search
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, itemsPerPage]);

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-[1200px] w-full mx-auto space-y-6 animate-in fade-in duration-500 pb-20">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-zinc-900">Pincode Routing Engine</h1>
          <p className="text-sm font-medium text-zinc-500 mt-1">Map service areas to your nearest physical branches for dynamic ETA calculations.</p>
        </div>
        
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-[250px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
            <Input 
              placeholder="Search Pincode or Branch..." 
              className="pl-9 h-10 bg-white border-zinc-200 focus-visible:ring-rose-500 rounded-xl font-medium shadow-sm"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Button 
            className="h-10 px-5 bg-zinc-900 hover:bg-zinc-800 text-white font-bold text-xs uppercase tracking-widest rounded-xl shadow-sm"
            onClick={() => {
              setMappingForm({ id: "", pincode: "", warehouse_id: "", local_transit_days: "2" });
              setIsModalOpen(true);
            }}
          >
            <Plus className="w-4 h-4 mr-1.5" /> Add Map
          </Button>
        </div>
      </div>

      {/* DATA TABLE */}
      <Card className="shadow-sm border-zinc-200/80 bg-white rounded-2xl overflow-hidden">
        <div className="overflow-x-auto custom-scrollbar">
          <Table className="whitespace-nowrap">
            <TableHeader className="bg-zinc-50/80">
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-[11px] font-bold uppercase text-zinc-500 tracking-widest px-6 h-12 w-[150px]">Pincode</TableHead>
                <TableHead className="text-[11px] font-bold uppercase text-zinc-500 tracking-widest px-4 h-12">Assigned Fulfillment Branch</TableHead>
                <TableHead className="text-[11px] font-bold uppercase text-zinc-500 tracking-widest px-4 h-12 text-center">Local Transit</TableHead>
                <TableHead className="text-[11px] font-bold uppercase text-zinc-500 tracking-widest px-6 h-12 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={4} className="text-center py-12"><Loader2 className="w-6 h-6 animate-spin mx-auto text-zinc-300" /></TableCell></TableRow>
              ) : filteredMappings.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-16">
                    <MapPin className="w-10 h-10 text-zinc-200 mx-auto mb-3" />
                    <p className="text-sm font-bold text-zinc-400 uppercase tracking-widest">No mapping zones configured.</p>
                  </TableCell>
                </TableRow>
              ) : (
                paginatedMappings.map(map => (
                  <TableRow key={map.id} className="hover:bg-zinc-50/50 transition-colors group">
                    <TableCell className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-rose-500" />
                        <span className="font-mono font-black text-sm text-zinc-900">{map.pincode}</span>
                      </div>
                    </TableCell>
                    <TableCell className="px-4">
                      <div className="font-bold text-sm text-zinc-800">{map.warehouse?.name || "Unassigned"}</div>
                      <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mt-0.5">{map.warehouse?.warehouse_type?.replace('_', ' ')}</div>
                    </TableCell>
                    <TableCell className="px-4 text-center">
                      <Badge variant="outline" className="bg-zinc-50 text-zinc-600 border-zinc-200 text-[10px] font-bold uppercase tracking-widest">
                        {map.local_transit_days} Days
                      </Badge>
                    </TableCell>
                    <TableCell className="px-6 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-zinc-400 hover:text-indigo-600 hover:bg-indigo-50" onClick={() => openEditModal(map)}>
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-zinc-400 hover:text-rose-600 hover:bg-rose-50" onClick={() => { setMappingToDelete(map); setIsDeleteDialogOpen(true); }}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* PAGINATION CONTROLS */}
        {filteredMappings.length > 0 && (
          <div className="flex items-center justify-between border-t border-zinc-100 bg-white p-4">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Show</span>
              <Select value={itemsPerPage.toString()} onValueChange={(val) => setItemsPerPage(Number(val))}>
                <SelectTrigger className="h-8 w-[70px] text-xs font-bold bg-zinc-50 border-zinc-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                  <SelectItem value="500">500</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest hidden sm:block">
                Pg {currentPage} of {totalPages || 1}
              </span>
              <div className="flex items-center gap-1.5">
                <Button variant="outline" size="sm" className="h-8 text-[10px] font-bold uppercase tracking-widest" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>Prev</Button>
                <Button variant="outline" size="sm" className="h-8 text-[10px] font-bold uppercase tracking-widest" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages || totalPages === 0}>Next</Button>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* ========================================================================== */}
      {/* ADD / EDIT MAPPING MODAL */}
      {/* ========================================================================== */}
      <Dialog open={isModalOpen} onOpenChange={(o) => !o && setIsModalOpen(false)}>
        <DialogContent className="sm:max-w-[450px] p-0 border-none shadow-2xl rounded-2xl overflow-hidden bg-zinc-50">
          <DialogHeader className="bg-white p-6 border-b border-zinc-200">
            <DialogTitle className="text-xl font-black text-zinc-900 tracking-tight flex items-center gap-2">
              <MapPin className="w-5 h-5 text-rose-600" /> 
              {mappingForm.id ? "Edit Pincode Mapping" : "New Pincode Map"}
            </DialogTitle>
            <DialogDescription className="text-xs font-medium text-zinc-500 mt-1">
              Link a regional pincode to the nearest physical branch.
            </DialogDescription>
          </DialogHeader>
          
          <div className="p-6 space-y-5">
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Pincode *</Label>
              <Input 
                className="h-11 font-mono font-black text-lg bg-white border-zinc-200 tracking-widest shadow-sm" 
                placeholder="e.g. 400001"
                maxLength={6}
                value={mappingForm.pincode}
                onChange={e => setMappingForm({...mappingForm, pincode: e.target.value.replace(/\D/g, '')})}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Assign Fulfillment Branch *</Label>
              <Select value={mappingForm.warehouse_id} onValueChange={v => setMappingForm({...mappingForm, warehouse_id: v})}>
                <SelectTrigger className="h-11 bg-white border-zinc-200 font-bold text-sm shadow-sm focus:ring-rose-500/20 focus:border-rose-500">
                  <SelectValue placeholder="Select target branch..." />
                </SelectTrigger>
                <SelectContent className="rounded-xl shadow-lg border-zinc-100 p-1">
                  {warehouses.map(w => (
                    <SelectItem key={w.id} value={w.id} className="py-2.5 font-medium">{w.name} <span className="text-[9px] text-zinc-400 uppercase ml-2">({w.warehouse_type?.replace('_', ' ')})</span></SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="bg-indigo-50/50 border border-indigo-100 p-4 rounded-xl space-y-3">
              <div>
                <Label className="text-[10px] font-bold uppercase tracking-widest text-indigo-600 flex items-center gap-1.5 mb-1.5">
                  <Truck className="w-3.5 h-3.5" /> Local Transit Time (Days)
                </Label>
                <Input 
                  type="number"
                  min="0"
                  className="h-10 font-bold bg-white border-indigo-200 shadow-sm w-1/2" 
                  value={mappingForm.local_transit_days}
                  onChange={e => setMappingForm({...mappingForm, local_transit_days: e.target.value})}
                />
              </div>
              <p className="text-[10px] font-medium text-indigo-400/80 leading-tight">
                This value is added to the manufacturing buffer to calculate the final delivery ETA for the customer.
              </p>
            </div>
          </div>

          <DialogFooter className="bg-white p-5 border-t border-zinc-200">
            <Button variant="outline" className="h-11 rounded-xl text-xs font-bold uppercase tracking-widest w-full border-zinc-200 text-zinc-600" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button className="h-11 rounded-xl w-full bg-zinc-900 hover:bg-zinc-800 text-white font-bold text-xs uppercase tracking-widest shadow-md" onClick={handleSaveMapping} disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
              Save Mapping
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========================================================================== */}
      {/* DELETE CONFIRMATION MODAL */}
      {/* ========================================================================== */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={(o) => !o && setIsDeleteDialogOpen(false)}>
        <DialogContent className="sm:max-w-[400px] p-6 border-none shadow-2xl rounded-2xl bg-white text-center flex flex-col items-center">
          <div className="w-14 h-14 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mb-4 border border-rose-100">
            <AlertTriangle className="w-7 h-7" />
          </div>
          <DialogTitle className="text-xl font-black text-zinc-900 tracking-tight mb-2">Remove Mapping?</DialogTitle>
          <DialogDescription className="text-sm font-medium text-zinc-500 mb-6">
            Orders from <strong className="font-mono text-zinc-800">{mappingToDelete?.pincode}</strong> will no longer be routed to <strong className="text-zinc-800">{mappingToDelete?.warehouse?.name}</strong>.
          </DialogDescription>
          <div className="flex gap-3 w-full">
            <Button variant="outline" className="flex-1 h-11 rounded-xl text-xs font-bold uppercase tracking-widest border-zinc-200 text-zinc-600" onClick={() => setIsDeleteDialogOpen(false)}>Cancel</Button>
            <Button className="flex-1 h-11 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs uppercase tracking-widest shadow-md" onClick={handleDeleteMapping} disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
              Remove
            </Button>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}