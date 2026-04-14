'use client'

import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Wrench, ShieldAlert, ArrowLeft } from 'lucide-react'

export default function CompanyPage() {
  const router = useRouter()
  const { appUser, loading } = useAuth()

  if (loading) {
    return <div className="h-screen flex items-center justify-center text-muted-foreground">Loading...</div>
  }

  return (
    <div className="min-h-screen bg-[#fafafa] flex flex-col items-center justify-center p-4 selection:bg-indigo-100">
      
      {/* Background decorative elements */}
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-indigo-100/40 blur-[100px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-amber-100/40 blur-[100px]" />
      </div>

      <div className="w-full max-w-md z-10 animate-in fade-in zoom-in-95 duration-500">
        
        <Card className="border-2 border-dashed border-slate-200 shadow-lg bg-white/80 backdrop-blur-xl rounded-3xl overflow-hidden">
          <CardContent className="pt-12 pb-10 px-8 flex flex-col items-center text-center space-y-6">
            
            <div className="relative">
              <div className="absolute inset-0 bg-amber-100 rounded-full blur-xl animate-pulse"></div>
              <div className="h-20 w-20 bg-amber-50 border border-amber-200 rounded-full flex items-center justify-center relative z-10 shadow-sm">
                <Wrench className="h-10 w-10 text-amber-600" />
              </div>
            </div>

            <div className="space-y-3">
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                Under Construction
              </h1>
              <p className="text-sm text-slate-500 leading-relaxed font-medium">
                We are actively updating the company configuration module to bring you a better, more powerful experience in the near future.
              </p>
            </div>

            <div className="bg-slate-50 border border-slate-100 w-full p-4 rounded-2xl flex items-start gap-3 text-left">
              <ShieldAlert className="w-5 h-5 text-indigo-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-0.5">Access Restricted</p>
                <p className="text-xs text-slate-700 font-medium">
                  During this maintenance period, settings access is strictly limited to the <b>System Manager</b>.
                </p>
              </div>
            </div>

            <Button 
              onClick={() => router.back()} 
              className="w-full h-12 bg-slate-900 hover:bg-slate-800 text-white rounded-xl shadow-md font-bold mt-2"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Return to Dashboard
            </Button>
            
          </CardContent>
        </Card>

      </div>
    </div>
  )
}