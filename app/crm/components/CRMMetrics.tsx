import React from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Users, AlertCircle, Gem } from 'lucide-react'

interface CRMMetricsProps {
  totalCustomers: number
  reminders: {
    dueToday: number
    overdue: number
  }
  activeKittyCount: number
}

export function CRMMetrics({ totalCustomers, reminders, activeKittyCount }: CRMMetricsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 shrink-0">
      <Card className="border-slate-200 shadow-sm rounded-xl">
        <CardContent className="p-4 flex justify-between items-center">
          <div>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Total Database</p>
            <div className="text-2xl font-extrabold tracking-tight text-slate-900 leading-none">{totalCustomers}</div>
          </div>
          <div className="h-10 w-10 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center">
            <Users className="h-5 w-5 text-slate-400" />
          </div>
        </CardContent>
      </Card>

      <Card className="border-orange-200 shadow-sm bg-orange-50/30 rounded-xl">
        <CardContent className="p-4 flex justify-between items-center">
          <div>
            <p className="text-[10px] font-bold text-orange-600 uppercase tracking-widest mb-1.5">Action Board</p>
            <div className="flex gap-4">
              <div className="flex flex-col">
                <span className="text-xl font-extrabold text-orange-600 leading-none tracking-tight">{reminders.dueToday}</span>
                <span className="text-[9px] font-bold text-orange-500 uppercase mt-0.5 tracking-wider">Due Today</span>
              </div>
              <div className="w-px bg-orange-200 h-8 my-auto"></div>
              <div className="flex flex-col">
                <span className="text-xl font-extrabold text-red-600 leading-none tracking-tight">{reminders.overdue}</span>
                <span className="text-[9px] font-bold text-red-500 uppercase mt-0.5 tracking-wider">Overdue</span>
              </div>
            </div>
          </div>
          <div className="h-10 w-10 rounded-full bg-orange-100/50 border border-orange-100 flex items-center justify-center">
            <AlertCircle className="h-5 w-5 text-orange-500" />
          </div>
        </CardContent>
      </Card>

      <Card className="border-purple-200 shadow-sm bg-purple-50/30 rounded-xl">
        <CardContent className="p-4 flex justify-between items-center">
          <div>
            <p className="text-[10px] font-bold text-purple-600 uppercase tracking-widest mb-1">Active Kitty Plans</p>
            <div className="text-2xl font-extrabold tracking-tight text-purple-700 leading-none">{activeKittyCount}</div>
          </div>
          <div className="h-10 w-10 rounded-full bg-purple-100/50 border border-purple-100 flex items-center justify-center">
            <Gem className="h-5 w-5 text-purple-500" />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}