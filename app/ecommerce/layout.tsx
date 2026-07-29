"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  ArrowLeft, 
  ShoppingCart, 
  PackageSearch, 
  MapPin, 
  Globe 
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

export default function EcommerceLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Navigation schema for the E-Commerce Control Center
  const navItems = [
    { 
      name: "Orders & Approval", 
      href: "/ecommerce/orders", 
      icon: ShoppingCart,
      activeColor: "text-indigo-600" 
    },
    { 
      name: "Master Catalog", 
      href: "/ecommerce/catalog", 
      icon: PackageSearch,
      activeColor: "text-emerald-600"
    },
    { 
      name: "Pincode Engine", 
      href: "/ecommerce/routing", 
      icon: MapPin,
      activeColor: "text-rose-600"
    },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-zinc-50/50 font-sans">
      
      {/* SHARED E-COMMERCE HEADER */}
      <header className="sticky top-0 z-40 w-full bg-white/80 backdrop-blur-md border-b border-zinc-200 px-4 h-14 flex items-center justify-between shadow-sm">
        
        {/* Left Side: Branding & Back Navigation */}
        <div className="flex items-center gap-3 overflow-hidden">
          <Link href="/dashboard">
            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl hover:bg-zinc-100 transition-colors">
              <ArrowLeft className="h-4 w-4 text-zinc-500" />
            </Button>
          </Link>
          
          <Separator orientation="vertical" className="h-5 bg-zinc-200 hidden sm:block" />
          
          <nav className="flex items-center gap-2 text-sm font-medium whitespace-nowrap">
            <div className="h-7 w-7 rounded-md bg-indigo-50 border border-indigo-100 flex items-center justify-center shadow-sm">
              <Globe className="h-3.5 w-3.5 text-indigo-600" />
            </div>
            <span className="font-bold text-zinc-900 tracking-tight hidden sm:inline-block">E-Commerce Control</span>
          </nav>
        </div>

        {/* Right Side: Dynamic Tab Navigation */}
        <div className="flex items-center gap-1 bg-zinc-100/70 p-1 rounded-lg border border-zinc-200/50 overflow-x-auto custom-scrollbar">
          {navItems.map((item) => {
            // Check if the current URL matches the nav item href
            const isActive = pathname.startsWith(item.href);
            const Icon = item.icon;
            
            return (
              <Link key={item.name} href={item.href}>
                <div 
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[10px] sm:text-xs font-bold uppercase tracking-widest transition-all whitespace-nowrap ${
                    isActive 
                      ? `bg-white shadow-sm border border-zinc-200/50 ${item.activeColor}` 
                      : 'text-zinc-500 hover:text-zinc-800 hover:bg-zinc-200/50'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {item.name}
                </div>
              </Link>
            );
          })}
        </div>
      </header>

      {/* DYNAMIC PAGE CONTENT AREA */}
      <main className="flex-1 w-full flex flex-col">
        {children}
      </main>

    </div>
  );
}