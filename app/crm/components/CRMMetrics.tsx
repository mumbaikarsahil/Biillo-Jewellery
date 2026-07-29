import React from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Users, AlertCircle, Gem, MessageSquare, ArrowUpRight } from 'lucide-react'
import Link from 'next/link'

interface CRMMetricsProps {
  totalCustomers: number
  reminders: {
    dueToday: number
    overdue: number
  }
  activeKittyCount: number
  sequences: {
    total: number
    today: number
  }
}

export function CRMMetrics({
  totalCustomers,
  reminders,
  activeKittyCount,
  sequences,
}: CRMMetricsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 shrink-0">
      {/* 1. Total Database */}
      <Card className="border-zinc-200/80 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] rounded-lg">
        <CardContent className="p-4 flex flex-col justify-between h-full">
          <div className="flex items-center justify-between text-zinc-500 mb-3">
            <span className="text-xs font-medium tracking-normal">Total Database</span>
            <Users className="h-4 w-4 text-zinc-400" />
          </div>
          <div>
            <div className="text-2xl font-semibold tracking-tight text-zinc-900">
              {totalCustomers.toLocaleString()}
            </div>
            <p className="text-[11px] text-zinc-400 mt-1">Registered customer records</p>
          </div>
        </CardContent>
      </Card>

      {/* 2. Action Board */}
      <Card className="border-zinc-200/80 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] rounded-lg">
        <CardContent className="p-4 flex flex-col justify-between h-full">
          <div className="flex items-center justify-between text-zinc-500 mb-3">
            <span className="text-xs font-medium tracking-normal">Action Board</span>
            <AlertCircle className="h-4 w-4 text-zinc-400" />
          </div>
          <div className="flex items-baseline gap-6">
            <div>
              <div className="text-2xl font-semibold tracking-tight text-zinc-900">
                {reminders.dueToday}
              </div>
              <p className="text-[11px] text-zinc-500 mt-1 font-medium">Due today</p>
            </div>
            <div className="h-7 w-px bg-zinc-200" />
            <div>
              <div className="text-2xl font-semibold tracking-tight text-red-600">
                {reminders.overdue}
              </div>
              <p className="text-[11px] text-red-600/80 mt-1 font-medium">Overdue</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 3. Active Kitty Plans */}
      <Card className="border-zinc-200/80 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] rounded-lg">
        <CardContent className="p-4 flex flex-col justify-between h-full">
          <div className="flex items-center justify-between text-zinc-500 mb-3">
            <span className="text-xs font-medium tracking-normal">Active Kitty Plans</span>
            <Gem className="h-4 w-4 text-zinc-400" />
          </div>
          <div>
            <div className="text-2xl font-semibold tracking-tight text-zinc-900">
              {activeKittyCount.toLocaleString()}
            </div>
            <p className="text-[11px] text-zinc-400 mt-1">Ongoing savings accounts</p>
          </div>
        </CardContent>
      </Card>

      {/* 4. Voucher Sequences */}
      <Card className="border-zinc-200/80 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] rounded-lg">
        <CardContent className="p-4 flex flex-col justify-between h-full">
          <div className="flex items-center justify-between text-zinc-500 mb-3">
            <span className="text-xs font-medium tracking-normal">Message Sequences</span>
            <MessageSquare className="h-4 w-4 text-zinc-400" />
          </div>
          <div className="flex items-end justify-between">
            <div className="flex items-baseline gap-5">
              <div>
                <div className="text-2xl font-semibold tracking-tight text-zinc-900">
                  {sequences.total.toLocaleString()}
                </div>
                <p className="text-[11px] text-zinc-400 mt-1">Total sent</p>
              </div>
              <div className="h-7 w-px bg-zinc-200" />
              <div>
                <div className="text-2xl font-semibold tracking-tight text-zinc-900">
                  +{sequences.today}
                </div>
                <p className="text-[11px] text-emerald-600 font-medium mt-1">Today</p>
              </div>
            </div>
            <Link
              href="/campaigns"
              className="text-[11px] font-medium text-zinc-500 hover:text-zinc-900 flex items-center gap-0.5 transition-colors mb-0.5"
            >
              <span>More</span>
              <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}