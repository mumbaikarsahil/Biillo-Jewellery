import React from 'react'
import { format } from "date-fns"
import { Phone, User, MessageCircle, Calendar, IndianRupee, Star, AlertCircle, Users, PhoneCall, Ticket, Store, History, MessageSquare, Gift, MapPin, FileText, Zap, Clock, Send } from 'lucide-react'
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
  onViewHistory: (c: CRMCustomer) => void
  onViewWaActivity: (c: CRMCustomer) => void 
}

export function CustomerList({ data, loading, emptyMessage, onMessage, onSchedule, onViewProfile, onLogCall, onViewHistory, onViewWaActivity, isKitty = false }: Props) {
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
        {reason && <p className="text-[10px] font-medium text-slate-600 truncate max-w-[200px] mt-0.5">Goal: {reason}</p>}
      </div>
    )
  }

  const getDistributorName = (voucher: any) => {
    if (!voucher) return "Direct Event / Campaign";
    const distData = voucher.voucher_distributors;
    if (Array.isArray(distData)) return distData[0]?.distributor_name || "Direct Event / Campaign";
    return distData?.distributor_name || "Direct Event / Campaign";
  }

  const getInteractionDetails = (text: string | null) => {
    if (!text) return { type: 'NONE' };
    const lower = text.toLowerCase();
    if (lower.includes('walk-in') || lower.includes('checkin') || lower.includes('check-in') || lower.includes('discovery') || lower.includes('visited')) {
      return { type: 'WALKIN' };
    }
    if (lower.includes('[call')) {
      return { type: 'CALL' };
    }
    return { type: 'MANUAL' };
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
              <TableHead className="text-[10px] font-bold uppercase tracking-wider text-slate-500 h-10">Last Note / Chat</TableHead>
              <TableHead className="w-[340px] text-right px-6"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row) => {
              const activeVoucher = row.vouchers?.find((v: any) => v.status === 'registered') 
                                 || row.vouchers?.find((v: any) => v.status === 'redeemed') 
                                 || row.vouchers?.[0];

              // ✨ Grab the Sequence Data
              const activeSequence = row.voucher_message_sequences?.find((s: any) => s.status === 'active') || row.voucher_message_sequences?.[0];

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
              const formattedExpiry = activeVoucher?.expiry_date ? format(new Date(activeVoucher.expiry_date), 'dd MMM yyyy') : null;
              
              const interaction = getInteractionDetails(row.last_interaction);
              const isWalkinActivity = interaction.type === 'WALKIN' || row.customer_status === 'Walk-in';

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
                      
                      {isWalkinActivity && (
                        <Badge className="bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200 text-[8px] h-4 px-1 uppercase tracking-widest flex items-center gap-0.5">
                          <MapPin className="w-2.5 h-2.5" /> Store Visit
                        </Badge>
                      )}
                      {row.gift_given && (
                        <Badge className="bg-rose-50 text-rose-600 border-rose-200 text-[8px] h-4 px-1.5 uppercase tracking-widest flex items-center gap-1 shadow-sm">
                          <Gift className="w-2.5 h-2.5" /> Gift: {row.gift_given}
                        </Badge>
                      )}
                    </div>

                    <span className="text-[10px] text-slate-500 font-mono mt-1 flex items-center gap-1"><Phone className="w-2.5 h-2.5"/> {row.phone}</span>

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
                        <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                          <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1">
                            <Store className="w-2.5 h-2.5" /> Via: {distributorName}
                          </span>
                          {formattedExpiry && (
                            <span className="text-[9px] text-rose-500 font-bold uppercase tracking-wider flex items-center gap-1 border-l border-slate-200 pl-1.5">
                              <Clock className="w-2.5 h-2.5" /> Voucher Exp: {formattedExpiry}
                            </span>
                          )}
                        </div>

                        {/* ✨ NEW: Drip Campaign Sequence Information */}
                        {activeSequence && (
                          <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                            <span className="text-[9px] text-indigo-500 font-bold uppercase tracking-wider flex items-center gap-1">
                              <Send className="w-2.5 h-2.5" /> Auto msg Step: {activeSequence.current_step}
                            </span>
                            <span className="text-[9px] text-indigo-500 font-bold uppercase tracking-wider flex items-center gap-1 border-l border-indigo-100 pl-1.5">
                              <Clock className="w-2.5 h-2.5" /> Next msg at: {activeSequence.next_send_at ? format(new Date(activeSequence.next_send_at), 'dd MMM, HH:mm') : '--'}
                            </span>
                            <Badge className={cn("border-none text-[8px] h-4 px-1.5 uppercase tracking-widest ml-1", activeSequence.status === 'active' ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-500")}>
                              {activeSequence.status}
                            </Badge>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </TableCell>
                
                <TableCell className="py-3">
                  {renderFollowup(row.next_followup_date, row.followup_reason)}
                </TableCell>
                
                <TableCell className="py-3">
                  <div className="flex flex-col gap-2">
                    <div className="text-[10px] p-1.5 rounded-md border bg-blue-50 border-blue-100 text-blue-700 flex items-start gap-1.5 max-w-[220px]">
                      <User className="w-3 h-3 shrink-0 mt-0.5" />
                      <span className="leading-tight line-clamp-2" title={row.last_interaction || 'No manual notes'}>
                        {row.last_interaction || 'No manual notes logged.'}
                      </span>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      {(row as any).crm_webhook_events && (row as any).crm_webhook_events.length > 0 && (
                        <button 
                          onClick={() => onViewWaActivity(row)} 
                          className="inline-flex items-center gap-1.5 text-[#1DA851] bg-[#25D366]/10 hover:bg-[#25D366]/20 transition-colors font-medium px-2 py-1 rounded-md max-w-[220px] overflow-hidden text-left border border-[#25D366]/20 shadow-sm"
                        >
                          <MessageCircle className="w-3.5 h-3.5 shrink-0" /> 
                          <span className="truncate text-[10px]">
                            {(row as any).crm_webhook_events.sort((a: any, b: any) => new Date(b.event_time).getTime() - new Date(a.event_time).getTime())[0].message}
                          </span>
                        </button>
                      )}

                      {row.activity_timeline && Array.isArray(row.activity_timeline) && row.activity_timeline.length > 0 && (
                        <div className="flex flex-col gap-1">
                          {row.activity_timeline.slice(0, 2).map((event: any, idx: number) => (
                            <span key={idx} className="text-[9px] text-slate-500 bg-slate-50 border border-slate-200 px-1.5 py-0.5 rounded-md flex items-center gap-1.5 w-max max-w-[220px] truncate">
                              {event.type === 'WALKIN' || event.type === 'WALK-IN' ? <Store className="w-2.5 h-2.5 text-fuchsia-500" /> : <Zap className="w-2.5 h-2.5 text-amber-500" />}
                              <span className="truncate">{event.type}: {event.description}</span>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                  </div>
                </TableCell>
                
                <TableCell className="text-right px-6 py-3">
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" size="icon" className="h-8 w-8 text-amber-600 border-amber-200 bg-amber-50 hover:bg-amber-100 shrink-0" onClick={() => onViewHistory(row)} title="Purchase History">
                      <History className="w-3.5 h-3.5 sm:mr-0" />
                    </Button>

                    <Button variant="outline" size="icon" className="h-8 w-8 text-[#1DA851] border-[#25D366]/30 bg-[#25D366]/5 hover:bg-[#25D366]/20 shrink-0" onClick={() => onViewWaActivity(row)} title="WhatsApp Activity Log">
                      <MessageSquare className="w-3.5 h-3.5" /> 
                    </Button>
                    
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
          const activeVoucher = row.vouchers?.find((v: any) => v.status === 'registered') 
                             || row.vouchers?.find((v: any) => v.status === 'redeemed') 
                             || row.vouchers?.[0];

          // ✨ Grab the Sequence Data
          const activeSequence = row.voucher_message_sequences?.find((s: any) => s.status === 'active') || row.voucher_message_sequences?.[0];

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
          const formattedExpiry = activeVoucher?.expiry_date ? format(new Date(activeVoucher.expiry_date), 'dd MMM yyyy') : null;
          const interaction = getInteractionDetails(row.last_interaction);
          const isWalkinActivity = interaction.type === 'WALKIN' || row.customer_status === 'Walk-in';

          return (
          <div key={row.id} className={cn("bg-white border rounded-xl p-4 shadow-sm flex flex-col gap-3", isKitty ? "border-purple-100" : "border-slate-200")}>
            <div className="flex justify-between items-start">
              <div className="flex-1">
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
                  
                  {isWalkinActivity && (
                    <Badge className="bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200 text-[8px] h-4 px-1 uppercase tracking-widest flex items-center gap-0.5">
                      <MapPin className="w-2.5 h-2.5" /> Store Visit
                    </Badge>
                  )}
                  {row.gift_given && (
                    <Badge className="bg-rose-50 text-rose-600 border-rose-200 text-[8px] h-4 px-1.5 uppercase tracking-widest flex items-center gap-1 shadow-sm">
                      <Gift className="w-2.5 h-2.5" /> Gift: {row.gift_given}
                    </Badge>
                  )}
                </div>
                <p className="text-[11px] font-mono text-slate-500 mt-1.5 flex items-center gap-1"><Phone className="w-3 h-3"/> {row.phone}</p>

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
                    <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                      <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1">
                        <Store className="w-2.5 h-2.5" /> Via: {distributorName}
                      </span>
                      {formattedExpiry && (
                        <span className="text-[9px] text-rose-500 font-bold uppercase tracking-wider flex items-center gap-1 border-l border-slate-200 pl-1.5">
                          <Clock className="w-2.5 h-2.5" /> Voucher Exp: {formattedExpiry}
                        </span>
                      )}
                    </div>
                    
                    {/* ✨ NEW: Mobile Drip Campaign Sequence Information */}
                    {activeSequence && (
                      <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                        <span className="text-[9px] text-indigo-500 font-bold uppercase tracking-wider flex items-center gap-1">
                          <Send className="w-2.5 h-2.5" /> Seq Step: {activeSequence.current_step}
                        </span>
                        <span className="text-[9px] text-indigo-500 font-bold uppercase tracking-wider flex items-center gap-1 border-l border-indigo-100 pl-1.5">
                          <Clock className="w-2.5 h-2.5" /> Next: {activeSequence.next_send_at ? format(new Date(activeSequence.next_send_at), 'dd MMM, HH:mm') : '--'}
                        </span>
                        <Badge className={cn("border-none text-[8px] h-4 px-1.5 uppercase tracking-widest ml-1", activeSequence.status === 'active' ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-500")}>
                          {activeSequence.status}
                        </Badge>
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="flex gap-1.5 flex-wrap justify-end max-w-[80px]">
                <Button size="icon" variant="outline" className="h-8 w-8 text-amber-600 border-amber-200 rounded-lg hover:bg-amber-100 shrink-0" onClick={() => onViewHistory(row)}>
                  <History className="h-4 w-4" />
                </Button>

                <Button size="icon" variant="outline" className="h-8 w-8 text-[#1DA851] border-[#25D366]/30 bg-[#25D366]/5 rounded-lg hover:bg-[#25D366]/20 shrink-0" onClick={() => onViewWaActivity(row)}>
                  <MessageSquare className="h-4 w-4" />
                </Button>

                <Button size="icon" variant="outline" className="h-8 w-8 text-[#1DA851] border-slate-200 rounded-lg hover:bg-[#25D366]/10 shrink-0" onClick={() => onMessage(row)}>
                  <MessageCircle className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="outline" className="h-8 w-8 text-slate-500 border-slate-200 rounded-lg hover:bg-slate-100 shrink-0" onClick={() => onViewProfile(row)}>
                  <User className="h-4 w-4" />
                </Button>
              </div>
            </div>
            
            <div className="bg-slate-50 rounded-lg p-3 border border-slate-100 mt-1 flex flex-col gap-2">
              {renderFollowup(row.next_followup_date, row.followup_reason)}
              
              <div className="flex flex-col gap-1.5 mt-1 border-t border-slate-200 pt-2">
                {(row as any).crm_webhook_events && (row as any).crm_webhook_events.length > 0 && (
                  <button 
                    onClick={() => onViewWaActivity(row)} 
                    className="w-full inline-flex items-center gap-1.5 text-[#1DA851] bg-[#25D366]/10 border border-[#25D366]/20 font-medium px-2 py-1.5 rounded-md overflow-hidden text-left"
                  >
                    <MessageCircle className="w-3.5 h-3.5 shrink-0" /> 
                    <span className="truncate text-[11px]">
                      {(row as any).crm_webhook_events.sort((a: any, b: any) => new Date(b.event_time).getTime() - new Date(a.event_time).getTime())[0].message}
                    </span>
                  </button>
                )}

                {row.activity_timeline && Array.isArray(row.activity_timeline) && row.activity_timeline.length > 0 && (
                  <div className="flex flex-col gap-1">
                    {row.activity_timeline.slice(0, 2).map((event: any, idx: number) => (
                      <span key={idx} className="text-[9px] text-slate-500 bg-white border border-slate-200 px-1.5 py-1 rounded-md flex items-center gap-1.5 w-full truncate">
                        {event.type === 'WALKIN' || event.type === 'WALK-IN' ? <Store className="w-3 h-3 text-fuchsia-500 shrink-0" /> : <Zap className="w-3 h-3 text-amber-500 shrink-0" />}
                        <span className="truncate">{event.type}: {event.description}</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
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