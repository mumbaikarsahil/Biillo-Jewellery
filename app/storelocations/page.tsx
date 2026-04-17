"use client"

import React from 'react'
import { MapPin, Phone, Clock, MessageCircle } from 'lucide-react'

// Static store data based on the provided JSON
const STORE_LOCATIONS = [
  {
    name: "Chhatrapati Sambhajinagar",
    address: "Veer Marg, Keli Bazar, Chhatrapati Sambhajinagar (Aurangabad), Maharashtra",
    phone: null,
    working_hours: null
  },
  {
    name: "Pimpri - Chinchwad",
    address: "Shop No. 3, Sant Krupa Plaza, Krishna Chowk, New Sangavi, Pune, Maharashtra 411061",
    phone: null,
    working_hours: null
  },
  {
    name: "Parbhani",
    address: "Near Gandhi Park Main Gate, Gandhi Park, Parbhani 431401, Maharashtra",
    phone: null,
    working_hours: null
  },
  {
    name: "Chakan",
    address: "Wafgaonkar Rajlaxmi Jewellers, Main Road, Manik Chowk, Chakan, Maharashtra 410501",
    phone: null,
    working_hours: null
  },
  {
    name: "Uran (Navi Mumbai)",
    address: "Opp. Purnima Matching Centre, Bazaar Peth, Uran, Navi Mumbai - 400702, Maharashtra",
    phone: null,
    working_hours: null
  },
  {
    name: "Dombivli",
    address: "Inside M/s ShreeShri Devi Jewels India Pvt. Ltd., Shop No. 1, Ground Floor, Rakhi Apartment, Near Sarvesh H. Tilak Road, Dombivli, Thane - 421201",
    phone: "8657003848",
    working_hours: "11:00 AM to 8:00 PM (All days open)"
  },
  {
    name: "Sangamner",
    address: "Bus Stand Complex, Sangamner - 422605",
    phone: null,
    working_hours: null
  },
  {
    name: "Parel",
    address: "Inside Navaratna Jewellers, Shop No. 1, Saraf Building, Near Maharani Sarees, Dr. B. Ambedkar Road, Parel (E), Mumbai - 400012",
    phone: "8657003835",
    working_hours: "11:00 AM to 8:00 PM (Monday closed)"
  },
  {
    name: "Badlapur",
    address: "Inside Bhagirathi Jewellers, Shop No. 4, Deepmani Apartment, Opp. Railway Gate, Badlapur, Thane, Maharashtra - 421503",
    phone: "8657000961",
    working_hours: "11:00 AM to 8:00 PM (Monday closed)"
  },
  {
    name: "Thane",
    address: "Inside Mahavir Jewellers, Pathare Bldg CHS, Near Canara Bank, Gokhale Road, Naupada, Thane (W) - 400602",
    phone: "8657003834",
    working_hours: "11:00 AM to 8:00 PM (All days open)"
  },
  {
    name: "Kurla",
    address: "Inside Ratnadeep Jewellers, 318, Yashodabai Shivkumar Chawl, Shop No. 1 & 2, Opp. New Mill Road, Kurla West, Mumbai - 400070",
    phone: "8657003830",
    working_hours: "11:00 AM to 8:00 PM (Thursday closed)"
  },
  {
    name: "Kamothe",
    address: "Inside Kalash Jewellers, Shop No. 15, Uma Shiv Corner CHS, Plot No. 22A, Sector 19, Kamothe, Navi Mumbai - 410209",
    phone: "8657000965",
    working_hours: "11:00 AM to 8:00 PM (Friday closed)"
  },
  {
    name: "Navi Mumbai Vashi",
    address: "Shop No. 3, A Wing, Gagangiri CHS, Opp. Peshwai Sarees, Abhyudaya Bank Marg, Plot No. 47, Sector 17, Vashi, Navi Mumbai - 400703",
    phone: "8657003817",
    working_hours: "11:00 AM to 8:00 PM (All days open)"
  },
  {
    name: "Borivali (W)",
    address: "Shop No. 16, Sundar Vichar, Opp. Amar Jyoti Building & Bank of Baroda, Shimpoli Road, Kastur Park, Borivali (W), Mumbai - 400092",
    phone: "8657003816",
    working_hours: "11:00 AM to 8:00 PM (All days open)"
  },
  {
    name: "Virar (W)",
    address: "Siddhi Manora, Near Desai Hospital, Beside Kamal Medical, Virar West, Maharashtra",
    phone: "8657003819",
    working_hours: "11:00 AM to 8:00 PM (All days open)"
  },
  {
    name: "Andheri (W)",
    address: "Viral Apartment, A Wing, 3rd Floor (No Lift), S.V. Road, Opp. Andheri Shoppers Stop, Above Hotel Radha Krishna, Andheri West, Mumbai - 400058",
    phone: "+91 8657003815",
    working_hours: "11:00 AM to 8:00 PM (All days open)"
  },
  {
    name: "Breach Candy",
    address: "43, Bhulabhai Desai Marg, Breach Candy, Cumballa Hill, Mumbai, Maharashtra - 400026",
    phone: "8657003833",
    working_hours: "11:30 AM to 8:00 PM (All days open)"
  },
  {
    name: "Ghatkopar (E)",
    address: "Shop No. 2, Madhav Apt., Jawahar Road, Next to Samrat Hotel, Ghatkopar East, Mumbai - 400077",
    phone: "+91 8657003849",
    working_hours: "11:00 AM to 8:00 PM (All days open)"
  }
];

// Helper to format phone numbers for WhatsApp and Dial links
const formatPhoneNumber = (phone: string | null) => {
  if (!phone) return '';
  const cleaned = phone.replace(/\D/g, '');
  // If it's a 10 digit Indian number, append 91 for WhatsApp compatibility
  return cleaned.length === 10 ? `91${cleaned}` : cleaned;
};

export default function StoreLocationsPage() {
  return (
    <div className="min-h-screen bg-[#5c1644] text-white selection:bg-[#dda74f] selection:text-[#5c1644] font-sans">
      
      {/* HEADER SECTION - Clean White Design */}
      <header className="bg-white pt-8 pb-6 px-4 text-center border-b-4 border-[#dda74f] shadow-lg sticky top-0 z-40">
        <div className="max-w-7xl mx-auto flex flex-col items-center justify-center">
          <img 
            src="/pavitram-logo.png" 
            alt="Pavitram Diamond Jewellery" 
            className="h-16 md:h-20 object-contain mb-3"
            onError={(e) => e.currentTarget.style.display = 'none'} 
          />
          <h1 className="text-xl md:text-2xl font-serif font-bold text-[#5c1644] tracking-[0.2em] uppercase">
            Store Locator
          </h1>
        </div>
      </header>

      {/* LOCATIONS GRID */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
          {STORE_LOCATIONS.map((store, idx) => {
            const waNumber = formatPhoneNumber(store.phone);

            return (
              <div 
                key={idx} 
                className="flex flex-col items-center text-center group p-6 md:p-8 rounded-2xl bg-[#6c1a50]/80 hover:bg-[#7a1e5a] transition-colors duration-300 border border-[#dda74f]/20 hover:border-[#dda74f]/50 shadow-xl"
              >
                {/* STORE NAME */}
                <h2 className="text-2xl md:text-3xl font-serif font-bold text-[#dda74f] uppercase tracking-[0.1em] mb-4">
                  {store.name}
                </h2>
                
                {/* SEPARATOR LINE */}
                <div className="w-16 h-[2px] bg-[#dda74f]/60 mb-5 group-hover:w-24 transition-all duration-500"></div>
                
                {/* ADDRESS */}
                <p className="text-[15px] md:text-base leading-relaxed text-white/95 mb-6 flex-1 font-medium tracking-wide">
                  {store.address}
                </p>
                
                {/* CONTACT & HOURS */}
                <div className="w-full mt-auto space-y-4">
                  {store.working_hours && (
                    <div className="flex items-center justify-center gap-2 text-white/80 text-[13px] md:text-sm bg-black/10 py-2 px-3 rounded-lg">
                      <Clock className="w-4 h-4 text-[#dda74f] shrink-0" />
                      <span>{store.working_hours}</span>
                    </div>
                  )}
                  
                  {store.phone ? (
                    <div className="flex flex-row gap-3 w-full">
                      {/* CALL BUTTON */}
                      <a 
                        href={`tel:+${waNumber}`} 
                        className="flex-1 flex items-center justify-center gap-2 bg-white text-[#5c1644] hover:bg-[#dda74f] hover:text-white py-2.5 rounded-xl transition-all duration-300 text-xs sm:text-sm font-bold shadow-md uppercase tracking-wider"
                      >
                        <Phone className="w-4 h-4" /> 
                        <span className="hidden sm:inline">Call</span>
                        <span className="sm:hidden">Call</span>
                      </a>
                      
                      {/* WHATSAPP BUTTON */}
                      <a 
                        href={`https://wa.me/${waNumber}`} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="flex-1 flex items-center justify-center gap-2 bg-[#25D366]/10 text-[#4ade80] hover:bg-[#25D366] hover:text-white py-2.5 rounded-xl transition-all duration-300 text-xs sm:text-sm font-bold border border-[#25D366]/40 shadow-md uppercase tracking-wider"
                      >
                        <MessageCircle className="w-4 h-4" /> 
                        <span className="hidden sm:inline">WhatsApp</span>
                        <span className="sm:hidden">Message</span>
                      </a>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-2 text-white/50 text-[13px] italic py-2">
                      <MapPin className="w-4 h-4" />
                      <span>Visit us in-store</span>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </main>

      {/* FOOTER */}
      <footer className="py-8 px-4 text-center border-t border-[#dda74f]/20 bg-[#451032]">
        <p className="text-xs md:text-sm text-white/70 tracking-widest uppercase leading-loose">
          Pavitram Diamond Jewellery <br className="md:hidden" />
          <span className="hidden md:inline mx-2">|</span> 
          Powered By <a href="https://biillo.com" target="_blank" rel="noopener noreferrer" className="text-[#dda74f] hover:text-white font-bold transition-colors underline underline-offset-4">biillo systems</a>
        </p>
      </footer>
    </div>
  )
}