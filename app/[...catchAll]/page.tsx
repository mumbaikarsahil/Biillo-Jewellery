"use client"

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Home, AlertCircle } from 'lucide-react'

// This catch-all route replaces not-found.tsx to prevent static build errors
// caused by Supabase auth cookies in the root layout.
export default function CatchAllNotFound() {
  return (
    <div className="min-h-[calc(100vh-60px)] bg-[#f8f9fb] flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-[24px] p-8 sm:p-10 text-center shadow-[0_8px_30px_rgba(0,0,0,0.04)] border border-slate-200/60">
        
        <div className="w-16 h-16 bg-blue-50 text-[#0052FF] rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-inner">
          <AlertCircle className="w-8 h-8" strokeWidth={2} />
        </div>
        
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mb-3">
          Page not found
        </h1>
        
        <p className="text-[13px] text-slate-500 mb-8 leading-relaxed font-medium">
          We couldn't find the page you're looking for. It might have been moved, deleted, or perhaps the URL is incorrect.
        </p>
        
        <Button asChild className="w-full bg-[#0052FF] hover:bg-blue-700 text-white font-bold text-[14px] h-12 rounded-xl shadow-[0_4px_14px_rgba(0,82,255,0.25)] transition-all active:scale-[0.98]">
          <Link href="/dashboard">
            <Home className="w-4 h-4 mr-2" strokeWidth={2.5} />
            Return to Dashboard
          </Link>
        </Button>
        
      </div>
    </div>
  )
}