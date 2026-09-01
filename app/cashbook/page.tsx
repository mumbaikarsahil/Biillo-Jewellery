"use client";

import React, { useState, useEffect } from "react";
import { format } from "date-fns";
import { Save, RefreshCw, Store, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input"; // ✨ FIX: Imported missing Input component
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/hooks/useAuth"; // Adjust path to your auth hook if needed
import { toast } from "sonner";

// ✨ FIX: Added TypeScript Interfaces for the custom input
interface SheetInputProps {
  value: string | number;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void; // Made optional
  className?: string;
  type?: string;
  align?: "left" | "center" | "right";
  readOnly?: boolean;
}

const SheetInput = ({ 
  value, 
  onChange, 
  className = "", 
  type = "text", 
  align = "left", 
  readOnly = false 
}: SheetInputProps) => (
  <input
    type={type}
    value={value}
    onChange={onChange}
    readOnly={readOnly}
    className={`w-full h-full min-h-[24px] px-1 border-none bg-transparent focus:ring-1 focus:ring-blue-500 focus:outline-none outline-none ${
      align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left"
    } ${readOnly ? "text-slate-700" : ""} ${className}`}
  />
);

// Define type for denominations to fix the key mapping error
type Denominations = {
  "500": string; "200": string; "100": string; "50": string; 
  "20": string; "10": string; "5": string; "2": string; "1": string;
};

export default function DailyCashbook() {
  const { appUser } = useAuth();
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<string>("");
  
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Manual States
  const [yesterdayCash, setYesterdayCash] = useState<string>("");
  const [cashInOut, setCashInOut] = useState(Array(6).fill({ particulars: "", amount: "" }));
  const [expenses, setExpenses] = useState(Array(10).fill({ particulars: "", amount: "" }));
  
  // ✨ FIX: Strictly typed denominations state
  const [denominations, setDenominations] = useState<Denominations>({
    "500": "", "200": "", "100": "", "50": "", "20": "", "10": "", "5": "", "2": "", "1": ""
  });

  // Auto-Fetched States
  const [transactions, setTransactions] = useState<any[]>([]);
  const [summary, setSummary] = useState<Record<string, number>>({});

  const isManagerOrOwner = appUser?.role === 'owner' || appUser?.role === 'manager';

  // Fetch Warehouses on Load
  useEffect(() => {
    if (!appUser?.company_id) return;
    const fetchLocations = async () => {
      const { data } = await supabase.from('warehouses').select('*').eq('company_id', appUser.company_id);
      if (data) {
        setWarehouses(data);
        if (!isManagerOrOwner && appUser?.warehouse_id) {
          setSelectedLocation(appUser.warehouse_id);
        } else if (data.length > 0) {
          setSelectedLocation(data[0].id);
        }
      }
    };
    fetchLocations();
  }, [appUser, isManagerOrOwner]);

  // Fetch Data when Date or Location Changes
  useEffect(() => {
    if (selectedLocation && date) {
      fetchCashbookData();
    }
  }, [selectedLocation, date]);

  const fetchCashbookData = async () => {
    setIsLoading(true);
    try {
      const startOfDay = `${date}T00:00:00.000Z`;
      const endOfDay = `${date}T23:59:59.999Z`;

      // 1. Fetch Auto-Transactions (Invoices)
      const { data: invData } = await supabase.from('invoices')
        .select('invoice_number, final_total, payment_mode, split_payments, customers(full_name)')
        .eq('warehouse_id', selectedLocation)
        .gte('created_at', startOfDay)
        .lte('created_at', endOfDay)
        .neq('status', 'CANCELLED');

      // 2. Fetch Auto-Transactions (Advances/Orders)
      const { data: ordData } = await supabase.from('custom_orders')
        .select('order_number, advance_paid, customers(full_name)')
        .eq('origin_warehouse_id', selectedLocation)
        .gt('advance_paid', 0)
        .gte('created_at', startOfDay)
        .lte('created_at', endOfDay);

      let parsedTx: any[] = [];
      let calcSummary: Record<string, number> = { CASH: 0, CARD: 0, GPAY: 0, ADV: 0, HP: 0 };

      // Parse Invoices (Handle Split Payments)
      invData?.forEach(inv => {
        // ✨ FIX: Typed 'as any' to prevent array/object mismatch from Supabase relations
        const partyName = (inv.customers as any)?.full_name || 'Walk-in';
        
        if (inv.split_payments && Object.keys(inv.split_payments).length > 0) {
          Object.entries(inv.split_payments).forEach(([mode, amt]) => {
            const numAmt = Number(amt);
            if (numAmt > 0) {
              parsedTx.push({ bno: inv.invoice_number, party: partyName, amount: numAmt, payment: mode, tag: "", clt: "SI" });
              calcSummary[mode] = (calcSummary[mode] || 0) + numAmt;
            }
          });
        } else {
          const numAmt = Number(inv.final_total);
          parsedTx.push({ bno: inv.invoice_number, party: partyName, amount: numAmt, payment: inv.payment_mode, tag: "", clt: "SI" });
          calcSummary[inv.payment_mode] = (calcSummary[inv.payment_mode] || 0) + numAmt;
        }
      });

      // Parse Custom Order Advances
      ordData?.forEach(ord => {
        const numAmt = Number(ord.advance_paid);
        const partyName = (ord.customers as any)?.full_name || 'Walk-in';
        parsedTx.push({ bno: ord.order_number, party: partyName, amount: numAmt, payment: 'ADV', tag: "", clt: "ORD" });
        calcSummary['ADV'] = (calcSummary['ADV'] || 0) + numAmt;
      });

      // Fill remaining rows to maintain spreadsheet look (min 15 rows)
      const minRows = 15;
      if (parsedTx.length < minRows) {
        parsedTx = [...parsedTx, ...Array(minRows - parsedTx.length).fill({ bno: "", party: "", amount: "", payment: "", tag: "", clt: "" })];
      }

      setTransactions(parsedTx);
      setSummary(calcSummary);

      // 3. Fetch Manual Cashbook Entries
      const { data: cbData } = await supabase.from('daily_cashbooks')
        .select('*')
        .eq('warehouse_id', selectedLocation)
        .eq('record_date', date)
        .maybeSingle();

      if (cbData) {
        setYesterdayCash(cbData.yesterday_cash?.toString() || "");
        setCashInOut([...(cbData.cash_in_out || []), ...Array(6).fill({ particulars: "", amount: "" })].slice(0, 6));
        setExpenses([...(cbData.expenses || []), ...Array(10).fill({ particulars: "", amount: "" })].slice(0, 10));
        setDenominations({ ...denominations, ...(cbData.denominations || {}) });
      } else {
        setCashInOut(Array(6).fill({ particulars: "", amount: "" }));
        setExpenses(Array(10).fill({ particulars: "", amount: "" }));
        setDenominations({ "500": "", "200": "", "100": "", "50": "", "20": "", "10": "", "5": "", "2": "", "1": "" });
        
        // Auto-fetch yesterday's closing cash
        const prevDate = new Date(date);
        prevDate.setDate(prevDate.getDate() - 1);
        const { data: prevCb } = await supabase.from('daily_cashbooks').select('denominations').eq('warehouse_id', selectedLocation).eq('record_date', format(prevDate, "yyyy-MM-dd")).maybeSingle();
        
        if (prevCb && prevCb.denominations) {
           const prevTotal = Object.entries(prevCb.denominations).reduce((sum, [note, pcs]) => sum + (Number(note) * Number(pcs)), 0);
           setYesterdayCash(prevTotal.toString());
        } else {
           setYesterdayCash("");
        }
      }
    } catch (error) {
      toast.error("Failed to load cashbook data.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!selectedLocation || !appUser?.company_id) return toast.error("Location or Company context missing.");
    setIsSaving(true);
    try {
      const payload = {
        company_id: appUser.company_id,
        warehouse_id: selectedLocation,
        record_date: date,
        yesterday_cash: Number(yesterdayCash) || 0,
        cash_in_out: cashInOut.filter(r => r.particulars || r.amount),
        expenses: expenses.filter(r => r.particulars || r.amount),
        denominations: denominations,
        created_by: appUser.id || appUser.user_id,
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase.from('daily_cashbooks').upsert(payload, { onConflict: 'warehouse_id, record_date' });
      if (error) throw error;
      toast.success("Cashbook saved successfully.");
    } catch (error: any) {
      toast.error(`Save failed: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Calculations
  const totalCashInOut = cashInOut.reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
  const totalExpense = expenses.reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
  const totalDenominations = Object.entries(denominations).reduce((sum, [note, pieces]) => sum + (Number(note) * (Number(pieces) || 0)), 0);
  const totalTransactions = transactions.reduce((sum, row) => sum + (Number(row.amount) || 0), 0);

  const handleUpdateArray = (setter: any, array: any[], index: number, field: string, value: string) => {
    const newArray = [...array];
    newArray[index] = { ...newArray[index], [field]: value };
    setter(newArray);
  };

  return (
    <div className="p-4 md:p-6 max-w-[1200px] mx-auto font-sans min-h-screen">
      
      {/* Header Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div className="flex items-center gap-3">
          <Select value={selectedLocation} onValueChange={setSelectedLocation} disabled={!isManagerOrOwner}>
            <SelectTrigger className="h-9 w-[220px] bg-white font-semibold">
              <Store className="w-4 h-4 mr-2 text-slate-500" />
              <SelectValue placeholder="Select Branch" />
            </SelectTrigger>
            <SelectContent>
              {warehouses.map(w => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input 
            type="date" 
            value={date} 
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDate(e.target.value)} 
            className="h-9 w-[160px] font-semibold bg-white" 
          />
        </div>
        
        <div className="flex gap-2 w-full sm:w-auto">
          <Button variant="outline" size="sm" className="h-9 font-bold flex-1 sm:flex-none" onClick={fetchCashbookData} disabled={isLoading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} /> Sync ERP
          </Button>
          <Button size="sm" className="h-9 font-bold bg-slate-900 text-white hover:bg-slate-800 flex-1 sm:flex-none" onClick={handleSave} disabled={isSaving}>
            {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />} Save Sheet
          </Button>
        </div>
      </div>

      {/* SPREADSHEET CONTAINER */}
      <div className="bg-white border-2 border-black overflow-x-auto text-[11px] sm:text-xs select-none shadow-sm">
        
        {/* SPREADSHEET TITLE ROW */}
        <div className="flex justify-center items-center font-bold p-1.5 border-b-2 border-black bg-[#fff2cc]">
          {format(new Date(date), "dd/MM/yyyy")}
        </div>

        {/* TOP SECTION: IN/OUT, EXPENSE, DENOMINATIONS */}
        <div className="flex flex-col lg:flex-row border-b-2 border-black items-stretch min-w-[800px]">
          
          {/* LEFT: YESTERDAY CASH + IN/OUT + EXPENSES */}
          <div className="flex-1 flex flex-col border-r-2 border-black">
            
            {/* Yesterday Cash Row */}
            <div className="flex border-b-2 border-black bg-white">
              <div className="w-[140px] font-bold p-1 border-r-2 border-black pl-2 flex items-center">YESTERDAY CASH</div>
              <div className="w-[120px] p-0 border-r-2 border-black">
                <SheetInput 
                  type="number" 
                  align="right" 
                  value={yesterdayCash} 
                  onChange={(e) => setYesterdayCash(e.target.value)} 
                  className="bg-transparent" 
                />
              </div>
              <div className="flex-1"></div>
            </div>

            <div className="flex flex-1">
              {/* CASH IN AND OUT */}
              <div className="flex-1 border-r-2 border-black flex flex-col">
                <div className="text-center font-bold border-b border-black bg-[#fff2cc] p-1">CASH IN AND OUT</div>
                <div className="flex border-b border-black bg-white">
                  <div className="w-8 border-r border-black flex items-center justify-center font-bold">-</div>
                  <div className="flex-1 border-r border-black text-center font-bold py-1">OPENING</div>
                  <div className="w-24 text-center font-bold py-1">-</div>
                </div>
                <div className="flex flex-1 flex-col">
                  {cashInOut.map((row, i) => (
                    <div key={i} className="flex border-b border-slate-300 bg-white flex-1 min-h-[24px]">
                      <div className="w-8 border-r border-slate-300"></div>
                      <div className="flex-1 border-r border-slate-300">
                        <SheetInput value={row.particulars} onChange={(e) => handleUpdateArray(setCashInOut, cashInOut, i, "particulars", e.target.value)} />
                      </div>
                      <div className="w-24">
                        <SheetInput type="number" align="right" value={row.amount} onChange={(e) => handleUpdateArray(setCashInOut, cashInOut, i, "amount", e.target.value)} />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex border-t-2 border-black font-bold">
                  <div className="w-8 bg-[#ffff00] border-r border-black flex items-center justify-center">-</div>
                  <div className="flex-1 p-1 text-center border-r border-black bg-[#ffff00]">BALANCE</div>
                  <div className="w-24 p-1 text-right font-mono bg-[#ffff00]">{totalCashInOut || "-"}</div>
                </div>
              </div>

              {/* EXPENSE */}
              <div className="flex-[1.5] flex flex-col">
                <div className="text-center font-bold border-b border-black bg-[#fff2cc] p-1">EXPENSE</div>
                <div className="flex flex-1 flex-col">
                  {expenses.map((row, i) => (
                    <div key={i} className="flex border-b border-slate-300 bg-white flex-1 min-h-[24px]">
                      <div className="flex-1 border-r border-slate-300">
                        <SheetInput value={row.particulars} onChange={(e) => handleUpdateArray(setExpenses, expenses, i, "particulars", e.target.value)} />
                      </div>
                      <div className="w-24 border-r border-black">
                        <SheetInput type="number" align="right" value={row.amount} onChange={(e) => handleUpdateArray(setExpenses, expenses, i, "amount", e.target.value)} />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex border-t-2 border-black font-bold">
                  <div className="flex-1 p-1 text-center border-r border-black bg-[#ffff00]">TOTAL</div>
                  <div className="w-24 p-1 text-right font-mono bg-[#ffff00] border-r border-black">{totalExpense || "0"}</div>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT: DENOMINATIONS */}
          <div className="w-full lg:w-[320px] flex flex-col bg-white">
            <div className="flex font-bold border-b border-black bg-[#fff2cc]">
              <div className="flex-1 p-1 text-center border-r border-black">NOTES</div>
              <div className="flex-1 p-1 text-center border-r border-black">PIECES</div>
              <div className="flex-1 p-1 text-center">VALUE</div>
            </div>
            {Object.keys(denominations).sort((a,b) => Number(b) - Number(a)).map((noteKey) => {
              // ✨ FIX: Typed key mapping
              const note = noteKey as keyof Denominations;
              const pcs = Number(denominations[note]) || 0;
              const val = Number(note) * pcs;
              return (
                <div key={note} className="flex border-b border-slate-300 min-h-[24px]">
                  <div className="flex-1 p-1 text-center font-bold border-r border-black bg-[#fff2cc]">{note}</div>
                  <div className="flex-1 border-r border-black bg-white">
                    <SheetInput 
                      type="number" 
                      align="center" 
                      value={denominations[note]} 
                      onChange={(e) => setDenominations({...denominations, [note]: e.target.value})} 
                    />
                  </div>
                  <div className="flex-1 p-1 text-right font-mono bg-white flex items-center justify-end pr-2">{val > 0 ? val.toLocaleString() : "0"}</div>
                </div>
              )
            })}
            <div className="flex border-t-2 border-black font-bold">
              <div className="w-[66.66%] p-1 text-left pl-2 border-r border-black bg-[#ffff00]">TOTAL</div>
              <div className="flex-1 p-1 text-right font-mono bg-white">{totalDenominations || "0"}</div>
            </div>
          </div>
        </div>

        {/* BOTTOM SECTION: TRANSACTIONS & SUMMARY */}
        <div className="flex flex-col lg:flex-row items-stretch min-w-[800px]">
          
          {/* TRANSACTIONS TABLE */}
          <div className="flex-[3] flex flex-col border-r-2 border-black">
            <div className="flex font-bold bg-[#ffff00] border-b-2 border-black">
              <div className="w-24 p-1 text-center border-r border-black">B.NO</div>
              <div className="flex-[2] p-1 text-center border-r border-black">PARTY NAME</div>
              <div className="w-24 p-1 text-center border-r border-black">AMOUNT</div>
              <div className="flex-[1.5] p-1 text-center border-r border-black">PAYMENT</div>
              <div className="w-20 p-1 text-center border-r border-black">TAG NO</div>
              <div className="w-16 p-1 text-center">CLT</div>
            </div>
            
            {transactions.map((row, i) => (
              <div key={i} className="flex border-b border-slate-300 bg-[#fff2cc]/20 min-h-[24px]">
                <div className="w-24 border-r border-black"><SheetInput readOnly value={row.bno} /></div>
                <div className="flex-[2] border-r border-black"><SheetInput readOnly value={row.party} /></div>
                <div className="w-24 border-r border-black"><SheetInput readOnly type="number" align="right" value={row.amount || ""} /></div>
                <div className="flex-[1.5] border-r border-black"><SheetInput readOnly align="center" value={row.payment} /></div>
                <div className="w-20 border-r border-black"><SheetInput align="center" value={row.tag} onChange={(e) => handleUpdateArray(setTransactions, transactions, i, "tag", e.target.value)} /></div>
                <div className="w-16"><SheetInput readOnly align="center" value={row.clt} /></div>
              </div>
            ))}

            <div className="flex border-t-2 border-black font-bold h-8">
              <div className="w-24 border-r border-black bg-[#fff2cc]"></div>
              <div className="flex-[2] border-r border-black bg-[#fff2cc]"></div>
              <div className="w-24 p-1 text-right border-r border-black bg-[#ffff00] font-mono">{totalTransactions || "-"}</div>
              <div className="flex-[1.5] border-r border-black bg-[#fff2cc]"></div>
              <div className="w-20 border-r border-black bg-[#fff2cc]"></div>
              <div className="w-16 bg-[#fff2cc]"></div>
            </div>
          </div>

          {/* RIGHT BOTTOM SUMMARY */}
          <div className="w-[320px] flex flex-col justify-end">
            <div className="w-full flex">
              <div className="flex-1 border-r border-black"></div>
              <div className="w-[180px] border-2 border-black border-r-0 border-b-0 bg-[#fff2cc]/50">
                {['CASH', 'CARD', 'GPAY'].map((type) => (
                  <div key={type} className="flex border-b border-black min-h-[24px]">
                    <div className="flex-1 p-1 border-r border-black font-medium text-center">{type}</div>
                    <div className="w-24 p-1 text-right font-mono bg-white flex items-center justify-end pr-1">{(summary[type] || 0).toLocaleString()}</div>
                  </div>
                ))}
                <div className="flex border-b-2 border-black font-bold min-h-[24px]">
                  <div className="flex-1 p-1 border-r border-black text-center">TOTAL</div>
                  <div className="w-24 p-1 text-right font-mono bg-white flex items-center justify-end pr-1">
                    {((summary['CASH'] || 0) + (summary['CARD'] || 0) + (summary['GPAY'] || 0) + (summary['UPI'] || 0)).toLocaleString() || "-"}
                  </div>
                </div>
                {['ADV', 'HP'].map(type => (
                  <div key={type} className="flex border-b border-black min-h-[24px]">
                    <div className="flex-1 p-1 border-r border-black font-medium text-center">{type}</div>
                    <div className="w-24 p-1 text-right font-mono bg-white flex items-center justify-end pr-1">{(summary[type] || 0).toLocaleString()}</div>
                  </div>
                ))}
                <div className="flex font-bold min-h-[24px] bg-[#fff2cc]">
                  <div className="flex-1 p-1 border-r border-black text-center">TOTAL</div>
                  <div className="w-24 p-1 text-right font-mono bg-white flex items-center justify-end pr-1">
                    {(summary['ADV'] || 0).toLocaleString() || "-"}
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}