// app/crm/components/CustomerList.tsx
import React from 'react'
import { format } from "date-fns"
import { Phone, User, MessageCircle, Calendar, IndianRupee, Star, AlertCircle, Users } from 'lucide-react'
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
  isKitty?: boolean
}

export function CustomerList({ data, loading, emptyMessage, onMessage, onSchedule, onViewProfile, isKitty = false }: Props) {
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
          {/* ✨ FIX: Forced Strict DD-MM-YYYY format instead of relying on browser locales */}
          {icon} {format(fDate, 'dd-MM-yyyy')}
        </div>
        {reason && <p className="text-[10px] font-medium text-slate-600 truncate max-w-[200px] mt-0.5">Goal: {reason}</p>}
      </div>
    )
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
              <TableHead className="w-[240px] text-right px-6"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row) => (
              <TableRow key={row.id} className={cn("transition-colors border-b border-slate-100 hover:bg-slate-50/50", isKitty && "hover:bg-purple-50/50")}>
                <TableCell className="px-6 py-3">
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
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
                    <Button variant="outline" size="icon" className="h-8 w-8 text-slate-500 border-slate-200 hover:bg-slate-100" onClick={() => onViewProfile(row)} title="View Profile">
                      <User className="w-4 h-4" />
                    </Button>
                    <Button variant="outline" size="sm" className="h-8 px-3 text-[10px] font-bold uppercase text-[#1DA851] border-slate-200 bg-white hover:bg-[#25D366]/10" onClick={() => onMessage(row)}>
                      <MessageCircle className="w-3.5 h-3.5 sm:mr-1.5" /> <span className="hidden sm:inline">Message</span>
                    </Button>
                    <Button variant="outline" size="sm" className="h-8 px-3 text-[10px] font-bold uppercase text-indigo-600 border-slate-200 bg-white hover:bg-indigo-50" onClick={() => onSchedule(row)}>
                      <Calendar className="w-3.5 h-3.5 sm:mr-1.5" /> <span className="hidden sm:inline">Schedule</span>
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* MOBILE VIEW */}
      <div className="md:hidden flex flex-col gap-3 p-3 bg-slate-50/50 flex-1 overflow-y-auto custom-scrollbar">
        {data.map((row) => (
          <div key={row.id} className={cn("bg-white border rounded-xl p-4 shadow-sm flex flex-col gap-3", isKitty ? "border-purple-100" : "border-slate-200")}>
            <div className="flex justify-between items-start">
              <div>
                <button onClick={() => onViewProfile(row)} className="font-bold text-indigo-600 hover:underline text-sm flex items-center gap-2 text-left">
                  {row.full_name}
                </button>
                <div className="flex gap-1 mt-1">
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
                <p className="text-[11px] font-mono text-slate-500 mt-1 flex items-center gap-1"><Phone className="w-3 h-3"/> {row.phone}</p>
              </div>
              <div className="flex gap-1.5">
                <Button size="icon" variant="outline" className="h-8 w-8 text-slate-500 border-slate-200 rounded-lg hover:bg-slate-100 shrink-0" onClick={() => onViewProfile(row)}>
                  <User className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="outline" className="h-8 w-8 text-[#1DA851] border-slate-200 rounded-lg hover:bg-[#25D366]/10 shrink-0" onClick={() => onMessage(row)}>
                  <MessageCircle className="h-4 w-4" />
                </Button>
              </div>
            </div>
            
            <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
              {renderFollowup(row.next_followup_date, row.followup_reason)}
            </div>

            <Button variant="outline" className="w-full h-9 text-xs font-bold text-indigo-600 border-slate-200 rounded-lg" onClick={() => onSchedule(row)}>
              <Calendar className="w-3.5 h-3.5 mr-2" /> Schedule Follow-up
            </Button>
          </div>
        ))}
      </div>
    </div>
  )
}