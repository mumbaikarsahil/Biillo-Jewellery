import React from 'react'
import { format } from "date-fns"
import { Phone, User, MessageCircle, Calendar, IndianRupee, Star, AlertCircle, Users, PhoneCall, Ticket, Store } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { CRMCustomer } from '../types'

interface Props {
  data: CRMCustomer[]
  loading: boolean
  emptyMessage: string
  onMessage: (c: CRMCustomer) => void
  onSchedule: (c: CRMCustomer) => void
  onViewProfile: (c: CRMCustomer) => void
  onLogCall: (c: CRMCustomer) => void 
  isKitty?: boolean
}

export function CustomerList({ data, loading, emptyMessage, onMessage, onSchedule, onViewProfile, onLogCall, isKitty = false }: Props) {
  if (loading) {
    return (
      <div className="p-5 space-y-3">
        {[1,2,3,4].map(i => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-16 text-center">
        <div className="h-12 w-12 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center mb-3">
          <Users className="w-6 h-6 text-slate-300" />
        </div>
        <p className="text-sm font-semibold text-slate-500">{emptyMessage}</p>
      </div>
    )
  }

  const renderFollowup = (val: string | null, reason: string | null) => {
    if (!val) return <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Unscheduled</span>
    
    const today = new Date(); today.setHours(0,0,0,0);
    const fDate = new Date(val); fDate.setHours(0,0,0,0);
    
    let statusColor = 'text-blue-600 bg-blue-50 border-blue-200' 
    let icon = <Calendar className="w-3 h-3" />
    
    if (fDate.getTime() === today.getTime()) {
       statusColor = 'text-orange-700 bg-orange-50 border-orange-200' 
       icon = <AlertCircle className="w-3 h-3" />
    } else if (fDate.getTime() < today.getTime()) {
       statusColor = 'text-red-700 bg-red-50 border-red-200' 
       icon = <AlertCircle className="w-3 h-3" />
    }

    return (
      <div className="flex flex-col gap-1">
        <div className={cn("flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded-md border w-max", statusColor)}>
          {icon} {format(fDate, 'dd-MM-yyyy')}
        </div>
        {reason && <p className="text-[10px] font-medium text-slate-600 truncate max-w-[200px] mt-0.5">Goal/Status: {reason}</p>}
      </div>
    )
  }

  // ✨ HELPER: Safely extracts the distributor name from the Supabase Join
  const getDistributorName = (voucher: any) => {
    if (!voucher) return "Direct Event / Campaign";
    
    const distData = voucher.voucher_distributors;
    
    if (Array.isArray(distData)) {
      return distData[0]?.distributor_name || "Direct Event / Campaign";
    }
    return distData?.distributor_name || "Direct Event / Campaign";
  }
  
  return (
    <div className="h-full flex flex-col">
      {/* DESKTOP VIEW */}
      <div className="hidden md:block overflow-x-auto flex-1 custom-scrollbar">
        <Table>
          <TableHeader className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
            <TableRow className="hover:bg-transparent border-none">
              <TableHead className="text-[10px] font-bold uppercase tracking-wider text-slate-500 h-10 px-6">Client Profile</TableHead>
              <TableHead className="text-[10px] font-bold uppercase tracking-wider text-slate-500 h-10">Follow-up Details</TableHead>
              <TableHead className="text-[10px] font-bold uppercase tracking-wider text-slate-500 h-10">Last Note</TableHead>
              <TableHead className="w-[340px] text-right px-6"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row) => {
              // ✨ LOGIC: Smart Voucher Status Check
              const activeVoucher = row.vouchers?.find(v => v.status === 'registered') 
                                 || row.vouchers?.find(v => v.status === 'redeemed') 
                                 || row.vouchers?.[0];

              let voucherText = "";
              let voucherColor = "";

              if (activeVoucher) {
                if (activeVoucher.status === 'registered') {
                  voucherText = "Voucher Registered";
                  voucherColor = "bg-blue-600 text-white"; 
                } else if (activeVoucher.status === 'redeemed') {
                  voucherText = "Claimed Voucher";
                  voucherColor = "bg-slate-100 text-slate-500"; 
                } else {
                  voucherText = "Voucher Active";
                  voucherColor = "bg-blue-600 text-white";
                }
              }

              const distributorName = getDistributorName(activeVoucher);
              
              return (
              <TableRow key={row.id} className={cn("transition-colors border-b border-slate-100 hover:bg-slate-50/50", isKitty && "hover:bg-purple-50/50")}>
                <TableCell className="px-6 py-3">
                  <div className="flex flex-col">
                    <div className="flex flex-wrap items-center gap-2">
                      <button onClick={() => onViewProfile(row)} className="font-semibold text-indigo-600 hover:text-indigo-800 hover:underline text-sm leading-tight transition-colors text-left">
                        {row.full_name}
                      </button>

                      {Number(row.store_credit_balance) > 0 && (
                        <Badge className="bg-emerald-50 text-emerald-600 border-emerald-200 text-[8px] h-4 px-1 uppercase tracking-widest flex items-center gap-0.5">
                          <IndianRupee className="w-2.5 h-2.5" /> Credit
                        </Badge>
                      )}
                      {Number(row.pavitram_points) > 0 && (
                        <Badge className="bg-amber-50 text-amber-600 border-amber-200 text-[8px] h-4 px-1 uppercase tracking-widest flex items-center gap-0.5">
                          <Star className="w-2.5 h-2.5" /> Points
                        </Badge>
                      )}
                    </div>

                    <span className="text-[10px] text-slate-500 font-mono mt-0.5 flex items-center gap-1"><Phone className="w-2.5 h-2.5"/> {row.phone}</span>

                    {/* ✨ NEW: Detailed Voucher Block */}
                    {activeVoucher && voucherText && (
                      <div className="mt-1.5 flex flex-col gap-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <Badge className={cn("border-none text-[8px] h-4 px-1.5 uppercase tracking-widest flex items-center gap-1 shadow-sm w-max", voucherColor)}>
                            <Ticket className="w-2.5 h-2.5" /> {voucherText}
                          </Badge>
                          <span className="text-[10px] font-mono font-bold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                            {activeVoucher.code}
                          </span>
                        </div>
                        <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1 mt-0.5">
                          <Store className="w-2.5 h-2.5" /> Via: {distributorName}
                        </span>
                      </div>
                    )}
                  </div>
                </TableCell>
                <TableCell className="py-3">
                  {renderFollowup(row.next_followup_date, row.followup_reason)}
                </TableCell>
                <TableCell className="py-3">
                  <span className="text-[11px] font-medium text-slate-500 truncate max-w-[200px] block" title={row.last_interaction || ''}>{row.last_interaction || '--'}</span>
                </TableCell>
                <TableCell className="text-right px-6 py-3">
                  <div className="flex justify-end gap-2">
                    
                    <Button variant="outline" size="sm" className="h-8 px-3 text-[10px] font-bold uppercase text-blue-700 border-blue-200 bg-blue-50 hover:bg-blue-100 hover:text-blue-800" onClick={() => onLogCall(row)}>
                      <PhoneCall className="w-3.5 h-3.5 sm:mr-1.5" /> <span className="hidden sm:inline">Log Call</span>
                    </Button>

                    <Button variant="outline" size="sm" className="h-8 px-3 text-[10px] font-bold uppercase text-[#1DA851] border-slate-200 bg-white hover:bg-[#25D366]/10" onClick={() => onMessage(row)}>
                      <MessageCircle className="w-3.5 h-3.5 sm:mr-1.5" /> <span className="hidden sm:inline">Message</span>
                    </Button>
                    
                    <Button variant="outline" size="sm" className="h-8 px-3 text-[10px] font-bold uppercase text-indigo-600 border-slate-200 bg-white hover:bg-indigo-50" onClick={() => onSchedule(row)}>
                      <Calendar className="w-3.5 h-3.5 sm:mr-1.5" /> <span className="hidden sm:inline">Schedule</span>
                    </Button>

                    <Button variant="outline" size="icon" className="h-8 w-8 text-slate-500 border-slate-200 hover:bg-slate-100 shrink-0" onClick={() => onViewProfile(row)} title="View Profile">
                      <User className="w-4 h-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            )})}
          </TableBody>
        </Table>
      </div>

      {/* MOBILE VIEW */}
      <div className="md:hidden flex flex-col gap-3 p-3 bg-slate-50/50 flex-1 overflow-y-auto custom-scrollbar">
        {data.map((row) => {
          // ✨ LOGIC: Smart Voucher Status Check (Mobile)
          const activeVoucher = row.vouchers?.find(v => v.status === 'registered') 
                             || row.vouchers?.find(v => v.status === 'redeemed') 
                             || row.vouchers?.[0];

          let voucherText = "";
          let voucherColor = "";

          if (activeVoucher) {
            if (activeVoucher.status === 'registered') {
              voucherText = "Voucher Registered";
              voucherColor = "bg-blue-600 text-white"; 
            } else if (activeVoucher.status === 'redeemed') {
              voucherText = "Claimed Voucher";
              voucherColor = "bg-slate-100 text-slate-500"; 
            } else {
              voucherText = "Voucher Active";
              voucherColor = "bg-blue-600 text-white";
            }
          }

          const distributorName = getDistributorName(activeVoucher);

          return (
          <div key={row.id} className={cn("bg-white border rounded-xl p-4 shadow-sm flex flex-col gap-3", isKitty ? "border-purple-100" : "border-slate-200")}>
            <div className="flex justify-between items-start">
              <div>
                <button onClick={() => onViewProfile(row)} className="font-bold text-indigo-600 hover:underline text-sm flex items-center gap-2 text-left">
                  {row.full_name}
                </button>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {Number(row.store_credit_balance) > 0 && (
                    <Badge className="bg-emerald-50 text-emerald-600 border-emerald-200 text-[8px] h-4 px-1 uppercase tracking-widest flex items-center gap-0.5">
                      <IndianRupee className="w-2.5 h-2.5" /> Credit
                    </Badge>
                  )}
                  {Number(row.pavitram_points) > 0 && (
                    <Badge className="bg-amber-50 text-amber-600 border-amber-200 text-[8px] h-4 px-1 uppercase tracking-widest flex items-center gap-0.5">
                      <Star className="w-2.5 h-2.5" /> Points
                    </Badge>
                  )}
                </div>
                <p className="text-[11px] font-mono text-slate-500 mt-1.5 flex items-center gap-1"><Phone className="w-3 h-3"/> {row.phone}</p>

                {/* ✨ NEW: Detailed Voucher Block (Mobile) */}
                {activeVoucher && voucherText && (
                  <div className="mt-2.5 flex flex-col gap-1.5 p-2 bg-slate-50 rounded-lg border border-slate-100">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Badge className={cn("border-none text-[8px] h-4 px-1.5 uppercase tracking-widest flex items-center gap-1 shadow-sm w-max", voucherColor)}>
                        <Ticket className="w-2.5 h-2.5" /> {voucherText}
                      </Badge>
                      <span className="text-[10px] font-mono font-bold text-slate-700 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                        {activeVoucher.code}
                      </span>
                    </div>
                    <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1">
                      <Store className="w-2.5 h-2.5" /> Via: {distributorName}
                    </span>
                  </div>
                )}
              </div>
              <div className="flex gap-1.5">
                <Button size="icon" variant="outline" className="h-8 w-8 text-[#1DA851] border-slate-200 rounded-lg hover:bg-[#25D366]/10 shrink-0" onClick={() => onMessage(row)}>
                  <MessageCircle className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="outline" className="h-8 w-8 text-slate-500 border-slate-200 rounded-lg hover:bg-slate-100 shrink-0" onClick={() => onViewProfile(row)}>
                  <User className="h-4 w-4" />
                </Button>
              </div>
            </div>
            
            <div className="bg-slate-50 rounded-lg p-3 border border-slate-100 mt-1">
              {renderFollowup(row.next_followup_date, row.followup_reason)}
            </div>

            <div className="grid grid-cols-2 gap-2 mt-1">
              <Button variant="outline" className="w-full h-9 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border-blue-200 rounded-lg" onClick={() => onLogCall(row)}>
                <PhoneCall className="w-3.5 h-3.5 mr-2" /> Log Call
              </Button>
              <Button variant="outline" className="w-full h-9 text-xs font-bold text-indigo-600 border-slate-200 rounded-lg" onClick={() => onSchedule(row)}>
                <Calendar className="w-3.5 h-3.5 mr-2" /> Schedule
              </Button>
            </div>
          </div>
        )})}
      </div>
    </div>
  )
}