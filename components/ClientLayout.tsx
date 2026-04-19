'use client'

import React, { useState, useEffect } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { Toaster } from '@/components/ui/sonner'
import { AuthProvider, useAuth } from '@/hooks/useAuth' 
import { AppLayout } from '@/components/AppLayout'

const PUBLIC_ROUTES = ['/login', '/register', '/forgot-password', '/claim', '/storelocations']

// ============================================================================
// FIGMA/CANVA STYLE MICRO-ILLUSTRATIONS (Pure CSS/SVG)
// ============================================================================

const InventoryIllustration = () => (
  <div className="relative w-28 h-28 flex items-center justify-center">
    <style dangerouslySetInnerHTML={{__html: `
      @keyframes floatDown {
        0% { transform: translateY(-15px) scale(0.9); opacity: 0; }
        20% { transform: translateY(0) scale(1); opacity: 1; }
        80% { transform: translateY(0) scale(1); opacity: 1; }
        100% { transform: translateY(15px) scale(0.9); opacity: 0; }
      }
      @keyframes boxPulse {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.05); }
      }
    `}} />
    {/* Floating Elements (Jewelry/Assets) */}
    <div className="absolute top-2 flex w-16 justify-between z-0">
      <div className="bg-cyan-100 rounded-md p-1.5 border border-cyan-200 shadow-sm" style={{ animation: 'floatDown 2s cubic-bezier(0.16, 1, 0.3, 1) infinite' }}>
        <div className="w-3 h-3 rounded-full bg-cyan-400"></div>
      </div>
      <div className="bg-emerald-100 rounded-md p-1.5 border border-emerald-200 shadow-sm" style={{ animation: 'floatDown 2s cubic-bezier(0.16, 1, 0.3, 1) infinite 0.6s' }}>
        <div className="w-3 h-3 rotate-45 bg-emerald-400"></div>
      </div>
    </div>
    {/* The "Inventory Box" */}
    <div className="absolute bottom-3 z-10 w-20 h-12 bg-white/80 backdrop-blur-md border-[1.5px] border-slate-200 rounded-xl shadow-lg flex items-center justify-center" style={{ animation: 'boxPulse 2s ease-in-out infinite' }}>
      <div className="w-8 h-1.5 bg-slate-200 rounded-full"></div>
    </div>
  </div>
)

const DashboardIllustration = () => (
  <div className="relative w-28 h-28 flex items-end justify-center pb-4">
    <style dangerouslySetInnerHTML={{__html: `
      @keyframes bounceGrow {
        0%, 100% { transform: scaleY(0.2); }
        50% { transform: scaleY(1); }
      }
      @keyframes floatTooltip {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-6px); }
      }
    `}} />
    {/* Sleek Bar Chart */}
    <div className="flex items-end gap-2.5 absolute z-10 bottom-4 h-14">
      <div className="w-4 bg-emerald-400 rounded-t-md origin-bottom shadow-sm" style={{ animation: 'bounceGrow 1.5s cubic-bezier(0.87, 0, 0.13, 1) infinite 0s', height: '60%' }} />
      <div className="w-4 bg-indigo-400 rounded-t-md origin-bottom shadow-sm" style={{ animation: 'bounceGrow 1.5s cubic-bezier(0.87, 0, 0.13, 1) infinite 0.2s', height: '100%' }} />
      <div className="w-4 bg-cyan-400 rounded-t-md origin-bottom shadow-sm" style={{ animation: 'bounceGrow 1.5s cubic-bezier(0.87, 0, 0.13, 1) infinite 0.4s', height: '40%' }} />
      <div className="w-4 bg-rose-400 rounded-t-md origin-bottom shadow-sm" style={{ animation: 'bounceGrow 1.5s cubic-bezier(0.87, 0, 0.13, 1) infinite 0.6s', height: '75%' }} />
    </div>
    {/* Floating Data Tooltip */}
    <div className="absolute top-2 right-1 bg-white border border-slate-100 shadow-md rounded-lg px-2 py-1 flex items-center gap-1 z-20" style={{ animation: 'floatTooltip 2s ease-in-out infinite' }}>
      <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full"></div>
      <div className="w-4 h-1 bg-slate-200 rounded-full"></div>
    </div>
  </div>
)

const PosIllustration = () => (
  <div className="relative w-28 h-28 flex items-center justify-center">
    <style dangerouslySetInnerHTML={{__html: `
      @keyframes slideCard {
        0% { transform: translateY(-20px) translateX(20px); opacity: 0; }
        30% { transform: translateY(0) translateX(0); opacity: 1; }
        70% { transform: translateY(0) translateX(0); opacity: 1; }
        100% { transform: translateY(20px) translateX(-20px); opacity: 0; }
      }
      @keyframes pulseRing {
        0% { transform: scale(0.8); opacity: 1; }
        100% { transform: scale(1.8); opacity: 0; }
      }
    `}} />
    {/* Terminal Base */}
    <div className="absolute z-0 w-16 h-16 bg-slate-50 border border-slate-200 rounded-[1.5rem] shadow-sm flex items-center justify-center">
      <div className="absolute w-10 h-10 border-[1.5px] border-indigo-500 rounded-full" style={{ animation: 'pulseRing 1.5s cubic-bezier(0.215, 0.61, 0.355, 1) infinite' }}></div>
      <div className="w-2 h-2 bg-indigo-500 rounded-full z-10"></div>
    </div>
    {/* Tapping Card */}
    <div className="absolute z-20 w-14 h-9 bg-gradient-to-tr from-slate-800 to-slate-700 rounded-lg shadow-xl border border-white/20 flex flex-col justify-between p-1.5" style={{ animation: 'slideCard 2s cubic-bezier(0.16, 1, 0.3, 1) infinite' }}>
      <div className="w-3 h-2 bg-amber-200/80 rounded-sm"></div>
      <div className="w-6 h-1 bg-white/20 rounded-full"></div>
    </div>
  </div>
)

const CrmIllustration = () => (
  <div className="relative w-28 h-28 flex items-center justify-center">
    <style dangerouslySetInnerHTML={{__html: `
      @keyframes popIn {
        0%, 100% { transform: scale(0.8); opacity: 0.5; }
        50% { transform: scale(1.1); opacity: 1; }
      }
    `}} />
    {/* Network Nodes */}
    <div className="absolute w-full h-full">
      <div className="absolute top-[20%] left-[20%] w-8 h-8 bg-cyan-100 border-2 border-cyan-400 rounded-full shadow-sm z-10" style={{ animation: 'popIn 2s ease-in-out infinite 0s' }}></div>
      <div className="absolute top-[50%] right-[15%] w-10 h-10 bg-emerald-100 border-2 border-emerald-400 rounded-full shadow-sm z-10" style={{ animation: 'popIn 2s ease-in-out infinite 0.6s' }}></div>
      <div className="absolute bottom-[15%] left-[30%] w-9 h-9 bg-indigo-100 border-2 border-indigo-400 rounded-full shadow-sm z-10" style={{ animation: 'popIn 2s ease-in-out infinite 1.2s' }}></div>
      
      {/* Connecting Lines */}
      <svg className="absolute inset-0 w-full h-full z-0 text-slate-200" style={{ strokeDasharray: '4', animation: 'popIn 2s ease-in-out infinite' }}>
        <line x1="35%" y1="35%" x2="70%" y2="55%" stroke="currentColor" strokeWidth="1.5" />
        <line x1="70%" y1="65%" x2="45%" y2="80%" stroke="currentColor" strokeWidth="1.5" />
        <line x1="40%" y1="75%" x2="35%" y2="40%" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    </div>
  </div>
)

// ============================================================================
// DYNAMIC TEXT SEQUENCES
// ============================================================================

const TEXT_SEQUENCES = {
  dashboard: ["Gathering data...", "Calculating metrics...", "Visualizing insights..."],
  inventory: ["Connecting to vault...", "Fetching latest stock...", "Setting up your inventory..."],
  pos: ["Securing gateway...", "Loading catalog...", "Initializing terminal..."],
  crm: ["Syncing contacts...", "Updating interactions...", "Loading network..."],
  default: ["Connecting to server...", "Loading modules...", "Preparing your workspace..."]
}

// ============================================================================
// THE DYNAMIC ROUTE LOADER (Fixed Fullscreen Overlay)
// ============================================================================
function DynamicTransitionLoader({ pathname }: { pathname: string }) {
  const [textIndex, setTextIndex] = useState(0)

  // Determine Theme
  let Illustration = CrmIllustration; // fallback
  let textArray = TEXT_SEQUENCES.default;

  if (pathname.includes('/dashboard')) {
    Illustration = DashboardIllustration;
    textArray = TEXT_SEQUENCES.dashboard;
  } else if (pathname.includes('/inventory')) {
    Illustration = InventoryIllustration;
    textArray = TEXT_SEQUENCES.inventory;
  } else if (pathname.includes('/pos')) {
    Illustration = PosIllustration;
    textArray = TEXT_SEQUENCES.pos;
  } else if (pathname.includes('/crm')) {
    Illustration = CrmIllustration;
    textArray = TEXT_SEQUENCES.crm;
  }

  // Cycle through the text phrases every 800ms
  useEffect(() => {
    const interval = setInterval(() => {
      setTextIndex((prev) => (prev < textArray.length - 1 ? prev + 1 : prev));
    }, 800);
    return () => clearInterval(interval);
  }, [textArray]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden transition-opacity duration-500 bg-white">
      
      {/* Background: Aurora Gradient + Glassmorphism Blur */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes dynamicGradient { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }
        @keyframes slowDrift { 0%, 100% { transform: translate(0, 0); } 50% { transform: translate(3vw, -3vh); } }
        .bg-aurora { background: linear-gradient(-45deg, #f0f9ff, #ccfbf1, #e0f2fe, #ffffff); background-size: 400% 400%; animation: dynamicGradient 15s ease infinite; }
        
        .fade-up-enter { animation: fadeUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        @keyframes fadeUp { 0% { opacity: 0; transform: translateY(10px); } 100% { opacity: 1; transform: translateY(0); } }
      `}} />

      {/* Base Aurora Background */}
      <div className="absolute inset-0 bg-aurora z-0"></div>
      
      {/* Floating Light Orbs */}
      <div className="absolute top-[10%] left-[20%] w-[50vw] h-[50vw] max-w-[600px] max-h-[600px] bg-cyan-200/50 rounded-full blur-[100px] mix-blend-multiply z-0" style={{ animation: 'slowDrift 10s ease-in-out infinite' }}></div>
      <div className="absolute bottom-[10%] right-[20%] w-[60vw] h-[60vw] max-w-[700px] max-h-[700px] bg-emerald-200/50 rounded-full blur-[120px] mix-blend-multiply z-0" style={{ animation: 'slowDrift 12s ease-in-out infinite reverse' }}></div>
      
      {/* Heavy Frosted Glass Overlay */}
      <div className="absolute inset-0 bg-white/40 backdrop-blur-[30px] z-0 border-t border-white/60"></div>

      {/* ========================================================= */}
      {/* CENTERPIECE: Glass Card & Micro-Animation                   */}
      {/* ========================================================= */}
      <div className="relative z-10 flex flex-col items-center animate-in zoom-in-95 fade-in duration-500">
        
        <div className="flex flex-col items-center justify-center bg-white/70 backdrop-blur-2xl border border-white shadow-[0_8px_32px_rgba(0,0,0,0.06)] px-12 py-10 rounded-[2.5rem] min-w-[340px]">
          
          {/* Dynamic Route-Specific Illustration */}
          <div className="mb-8">
            <Illustration />
          </div>
          
          {/* Dynamic Action Text */}
          <div className="h-6 w-full relative flex justify-center items-center overflow-hidden">
             <span key={textIndex} className="fade-up-enter text-[15px] font-semibold tracking-wide text-slate-700 absolute text-center w-full">
               {textArray[textIndex]}
             </span>
          </div>

        </div>
      </div>

    </div>
  )
}

// ============================================================================
// MAIN LAYOUT WRAPPER
// ============================================================================
function InnerLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { appUser, loading: authLoading } = useAuth()
  
  const [isTransitioning, setIsTransitioning] = useState(false)

  // Trigger loader on ANY route change
  useEffect(() => {
    // Skip artificial delay if we are just verifying auth on initial load
    if (authLoading) return;

    setIsTransitioning(true)

    // Force loader to stay for 2.5 seconds to let animations and text cycling play out
    const timer = setTimeout(() => {
      setIsTransitioning(false)
    }, 2500)

    return () => clearTimeout(timer)
  }, [pathname, searchParams, authLoading])

  const isPublicRoute = PUBLIC_ROUTES.some(route => pathname?.startsWith(route))
  const showLoader = authLoading || isTransitioning;

  return (
    <>
      {/* 1. The Global Overlay Loader */}
      {showLoader && <DynamicTransitionLoader pathname={pathname || ''} />}

      {/* 2. The Actual Application */}
      {isPublicRoute ? (
        <>{children}</>
      ) : (
        <AppLayout appUser={appUser}>
           {children}
        </AppLayout>
      )}
    </>
  )
}

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
       <InnerLayout>{children}</InnerLayout>
       <Toaster position="top-right" richColors />
    </AuthProvider>
  )
}