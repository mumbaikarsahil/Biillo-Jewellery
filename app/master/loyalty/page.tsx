import React from 'react'
import Link from 'next/link'
import { Award, ArrowLeft } from 'lucide-react'
import LoyaltySettingsPanel from '@/components/loyalty/LoyaltySettingsPanel' // Adjust import path if needed

export default function LoyaltySettingsPage() {
  return (
    <div className="flex flex-col min-h-screen bg-[#fafafa] font-sans selection:bg-indigo-100 pb-20">
      
      {/* GLOBAL HEADER */}
      <header className="h-14 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center sticky top-0 z-40 shadow-sm box-border">
        <div className="w-full max-w-4xl mx-auto flex items-center gap-4">
          <Link 
            href="/master-config" // Adjust this to match your actual Master Settings route
            className="h-8 w-8 flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          
          <div className="w-px h-4 bg-slate-200 mx-1" />
          
          <div className="flex items-center gap-2.5">
            <div className="h-7 w-7 bg-emerald-50 border border-emerald-100 text-emerald-600 flex items-center justify-center rounded text-xs shadow-sm shrink-0">
              <Award className="w-3.5 h-3.5" />
            </div>
            <h1 className="text-sm font-semibold text-slate-900 tracking-tight leading-none">
              Loyalty Program Configuration
            </h1>
          </div>
        </div>
      </header>

      {/* MAIN CONTENT */}
      <main className="p-4 md:p-6 w-full max-w-4xl mx-auto space-y-6 animate-in fade-in duration-300">
        
        {/* PAGE TITLE & DESCRIPTION */}
        <div className="flex flex-col gap-1">
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            Pavitram Celebration Plan
          </h2>
          <p className="text-sm text-slate-500 font-medium">
            Manage global reward caps, define earning rules, and configure automated WhatsApp messaging for the loyalty program.
          </p>
        </div>

        {/* SETTINGS COMPONENT */}
        <div className="w-full">
          <LoyaltySettingsPanel />
        </div>
        
      </main>
    </div>
  )
}