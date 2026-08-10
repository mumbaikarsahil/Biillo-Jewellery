import Groq from "groq-sdk";
import { supabaseAdmin as supabase } from "@/lib/supabaseAdmin";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// 🚀 DATE RANGE HELPER FOR MANAGEMENT REPORTS
// Translates human-readable frequencies into strict ISO timestamps
function calculateDateRange(frequency?: string, daysBack?: number): { start: string, end: string } {
  const now = new Date();
  let start = new Date(now.getFullYear(), now.getMonth(), now.getDate()); // Default to Start of Today
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999); // End of Today

  if (daysBack) {
    if (daysBack === 2) { // Yesterday
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
      end.setDate(end.getDate() - 1);
    } else {
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysBack + 1);
    }
    return { start: start.toISOString(), end: end.toISOString() };
  }

  if (!frequency) return { start: start.toISOString(), end: end.toISOString() };

  const freq = frequency.toLowerCase();
  if (freq.includes('week')) {
    start.setDate(now.getDate() - 7);
  } else if (freq.includes('month')) {
    start.setMonth(now.getMonth() - 1);
  } else if (freq.includes('quarter')) {
    start.setMonth(now.getMonth() - 3);
  } else if (freq.includes('half')) {
    start.setMonth(now.getMonth() - 6);
  } else if (freq.includes('annual') || freq.includes('year')) {
    start.setFullYear(now.getFullYear() - 1);
  }

  return { start: start.toISOString(), end: end.toISOString() };
}

// 🚀 SELF-HEALING RELATIONAL WAREHOUSE RESOLVER
async function resolveWarehouses(warehouseName?: string): Promise<{ id: string; name: string; code: string }[]> {
  if (!warehouseName) return [];

  const STORE_REGISTRY = [
    { id: '008980fd-0081-4b4e-9a43-87e048aba13b', code: 'PNCK', name: 'Pune Chakan Branch', aliases: ['chakan', 'rajlaxmi', 'pune chakan'] },
    { id: '0561155e-e8e9-4399-aab6-e405c4d5b4b0', code: 'VIR', name: 'Virar Branch', aliases: ['virar', 'siddhi manora'] },
    { id: '1db77ad6-15b7-423a-9d6e-cf8da2cbe51e', code: 'PNSV', name: 'Pune Sanghvi', aliases: ['pimpri', 'chinchwad', 'sanghvi', 'sangavi'] },
    { id: '219a58d4-4c8e-4a50-a643-4ce63598b142', code: 'THN', name: 'Thane Branch', aliases: ['thane', 'naupada', 'mahavir'] },
    { id: '2bf8629e-d9ec-4d67-bd18-1fe7a013d08e', code: 'BRCD', name: 'Breach Candy Branch', aliases: ['breach candy', 'cumballa', 'bhulabhai'] },
    { id: '468ba9d3-9a86-46da-8ff7-77eec8657524', code: 'BOR', name: 'Borivali Branch', aliases: ['borivali', 'shimpoli', 'sundar vichar'] },
    { id: '55ca2068-91c5-40e4-b86a-6a4e56df322c', code: 'GHK', name: 'GHATKOPAR branch', aliases: ['ghatkopar', 'jawahar'] },
    { id: '5ad230e3-f680-44ba-b750-f2cf90412171', code: 'KRL', name: 'Kurla Branch', aliases: ['kurla', 'ratnadeep', 'new mill'] },
    { id: '5c039e03-2344-4426-bfd0-da94b8b8b245', code: 'URN', name: 'Uran Branch', aliases: ['uran'] },
    { id: '7e428aca-6d27-4046-83fb-39ef69928fbe', code: 'MUDK', name: 'MUNDLIK JEWELLERS', aliases: ['sambhajinagar', 'aurangabad', 'mundlik', 'keli bazaar'] },
    { id: '88e7b63e-4666-468e-b7a0-67f559570bda', code: 'MOANW', name: 'Pavitram main Office Andheri', aliases: ['andheri office', 'moanw', 'pavitram main'] },
    { id: '8fb0afbf-37ad-4d8c-b5a9-b2e54ba0f9b7', code: 'ANW', name: 'Andheri West', aliases: ['andheri west', 'andheri west store', 'anw', 'andheri', 'shoppers stop'] },
    { id: 'a73b05e9-7167-4f70-9e8b-2131ec50565e', code: 'DOM', name: 'Dombivali Branch', aliases: ['dombivli', 'dombivali', 'tilak road'] },
    { id: 'b6cb26c4-3d34-4799-8e99-4451a5f17553', code: 'VSH', name: 'Vashi Branch', aliases: ['vashi', 'gagangiri'] },
    { id: 'c89ce25b-85ed-4a99-b457-74f921c497e0', code: 'BDLR', name: 'Badlapur branch', aliases: ['badlapur', 'bhagirathi'] },
    { id: 'daf6bc99-077f-4d16-8b20-4608fa3fa7a1', code: 'SGM', name: 'Sangamner', aliases: ['sangamner'] },
    { id: 'e4472a36-3e33-4305-8fc0-54fbd691fd56', code: 'KMTH', name: 'Kamothe Branch', aliases: ['kamothe', 'kalash'] },
    { id: 'e911ff8c-47d9-4e07-a152-ae6eb1e9ddaa', code: 'PRL', name: 'Parel Branch', aliases: ['parel', 'navaratna', 'ambedkar'] }
  ];

  const qLower = warehouseName.toLowerCase().trim();

  for (const store of STORE_REGISTRY) {
    if (store.aliases.some(alias => qLower.includes(alias))) {
      return [{ id: store.id, name: store.name, code: store.code }];
    }
  }

  const matched = STORE_REGISTRY.filter(store => 
    store.name.toLowerCase().includes(qLower) || 
    qLower.includes(store.name.toLowerCase()) || 
    store.code.toLowerCase() === qLower
  );

  return matched;
}

export const ERP_INTENTS = {
  // ---------------------------------------------------------------------------
  // 1. INVENTORY MASTER (Includes Price Buckets, Dead Stock, Clarity)
  // ---------------------------------------------------------------------------
  query_inventory_master: {
    description: "Searches inventory items, price buckets (under 25k, 50k, 1L), dead stock, 14K/18K purity, and clarity-wise filters.",
    parameters: {
      warehouse_name: "string (optional)",
      search_term: "string (optional, e.g., 'tops', 'ring')",
      metal_type: "string (optional, e.g., 'Gold', 'Silver')",
      purity: "string (optional, e.g., '14K', '18K', '22K')",
      status: "string (optional, default 'in_stock')",
      price_bucket: "number (optional, e.g., 25000, 50000, 100000)",
      is_dead_stock: "boolean (optional, true for items older than 180 days)"
    },
    execute: async (params: any, companyId: string) => {
      let query = supabase
        .from('inventory_items')
        .select('barcode, item_category, net_weight_g, mrp, cost_total, purity_karat, metal_type, diamond_clarity, created_at, status, warehouses(name)')
        .eq('company_id', companyId);

      if (params.status) query = query.eq('status', params.status);
      else query = query.eq('status', 'in_stock');

      let matchedStoreNames = "All Locations";
      if (params.warehouse_name) {
        const matchedWhs = await resolveWarehouses(params.warehouse_name);
        if (matchedWhs.length > 0) {
          query = query.in('warehouse_id', matchedWhs.map(w => w.id));
          matchedStoreNames = matchedWhs.map(w => w.name).join(", ");
        }
      }

      if (params.metal_type) query = query.ilike('metal_type', `%${params.metal_type}%`);
      if (params.purity) query = query.ilike('purity_karat', `%${params.purity}%`);
      if (params.price_bucket) query = query.lte('mrp', params.price_bucket);

      if (params.is_dead_stock) {
        const deadStockDate = new Date();
        deadStockDate.setDate(deadStockDate.getDate() - 180);
        query = query.lte('created_at', deadStockDate.toISOString());
      }

      if (params.search_term) {
        const term = params.search_term.trim();
        query = query.or(`item_category.ilike.%${term}%,remarks.ilike.%${term}%,barcode.ilike.%${term}%,sku_reference.ilike.%${term}%`);
      }

      const { data, error } = await query.limit(500);
      if (error) return { error: error.message };

      const count = data?.length || 0;
      const totalWeight = data?.reduce((sum, item) => sum + Number(item.net_weight_g || 0), 0) || 0;
      const totalValuation = data?.reduce((sum, item) => sum + (Number(item.mrp) || Number(item.cost_total) || 0), 0) || 0;

      return {
        module: "Inventory Analytics",
        location_filter: matchedStoreNames,
        category_filter: params.search_term || "All Categories",
        items_found: count,
        total_net_weight: `${totalWeight.toFixed(3)} g`,
        total_valuation: `₹${totalValuation.toLocaleString('en-IN')}`,
        sample_records: data?.slice(0, 8)
      };
    }
  },

  // ---------------------------------------------------------------------------
  // 2. SALES & COMMERCE MASTER (Includes Management Frequencies & Modes)
  // ---------------------------------------------------------------------------
  query_sales_master: {
    description: "Retrieves billing data, revenue totals, collection modes, store rankings, and stock returns/buybacks across timeframes (Daily, Weekly, Monthly, etc).",
    parameters: {
      warehouse_name: "string (optional)",
      frequency: "string (optional, 'Daily', 'Weekly', 'Monthly', 'Quarterly', 'Half Yearly', 'Annually')",
      days_back: "number (optional)",
      invoice_number: "string (optional)",
      metric: "string (optional, 'turnover', 'collection_mode', 'store_ranking', 'buybacks')"
    },
    execute: async (params: any, companyId: string) => {
      let targetWarehouseIds: string[] = [];
      let locationLabel = "All Branches Combined";

      if (params.warehouse_name) {
        const matchedWhs = await resolveWarehouses(params.warehouse_name);
        if (matchedWhs.length > 0) {
          targetWarehouseIds = matchedWhs.map(w => w.id);
          locationLabel = matchedWhs.map(w => `${w.name} (${w.code})`).join(", ");
        }
      }

      const dateFilter = calculateDateRange(params.frequency, params.days_back);

      // Handle specific management request for Stock Returns (Buybacks)
      if (params.metric === 'buybacks') {
        let bbQuery = supabase.from('buybacks').select('net_refund, created_at, warehouses(name)').eq('company_id', companyId).gte('created_at', dateFilter.start).lte('created_at', dateFilter.end);
        if (targetWarehouseIds.length > 0) bbQuery = bbQuery.in('warehouse_id', targetWarehouseIds);
        
        const { data: buybacks } = await bbQuery;
        const totalRefund = buybacks?.reduce((sum, b) => sum + Number(b.net_refund || 0), 0) || 0;
        return { 
          module: "Stock Returns / Buybacks", 
          timeframe: params.frequency || "Specific Date Range",
          count: buybacks?.length || 0, 
          total_refund_value: `₹${totalRefund.toLocaleString('en-IN')}`,
          data: buybacks?.slice(0, 10) 
        };
      }

      // Base Query for Invoices
      let query = supabase
        .from('invoices')
        .select('invoice_number, final_total, payment_mode, created_at, status, warehouse_id, warehouses(name), customers(full_name, phone)')
        .eq('company_id', companyId)
        .eq('status', 'VALID');

      if (targetWarehouseIds.length > 0) {
        query = query.in('warehouse_id', targetWarehouseIds);
      }

      if (params.invoice_number) {
        query = query.ilike('invoice_number', `%${params.invoice_number}%`);
      } else {
        query = query.gte('created_at', dateFilter.start).lte('created_at', dateFilter.end);
      }

      const { data, error } = await query.order('created_at', { ascending: false }).limit(500);
      if (error) return { error: error.message };

      const invoiceCount = data?.length || 0;
      const totalRevenue = data?.reduce((sum, inv) => sum + Number(inv.final_total || 0), 0) || 0;

      // PRE-FORMAT collection modes into strings to stop AI math hallucinations
      const rawCollectionModes = data?.reduce((acc: any, inv: any) => {
        acc[inv.payment_mode] = (acc[inv.payment_mode] || 0) + Number(inv.final_total || 0);
        return acc;
      }, {});

      const formattedCollectionModes: any = {};
      for (const [mode, amount] of Object.entries(rawCollectionModes || {})) {
        formattedCollectionModes[mode] = `₹${Number(amount).toLocaleString('en-IN')}`;
      }

      // PRE-FORMAT store rankings and add fallback for RLS null blocks
      const rawStoreRankings = data?.reduce((acc: any, inv: any) => {
        const storeName = inv.warehouses?.name || `Branch (${inv.warehouse_id?.substring(0,8)})`;
        acc[storeName] = (acc[storeName] || 0) + Number(inv.final_total || 0);
        return acc;
      }, {});

      const formattedStoreRankings = Object.entries(rawStoreRankings || {})
        .sort((a: any, b: any) => b[1] - a[1])
        .map(([store, amount]) => [store, `₹${Number(amount).toLocaleString('en-IN')}`]);

      return {
        module: "Sales & Revenue Analytics",
        timeframe: params.frequency || (params.days_back ? `Last ${params.days_back} Days` : "Today"),
        store_location_queried: locationLabel,
        invoices_generated: invoiceCount,
        total_turnover: `₹${totalRevenue.toLocaleString('en-IN')}`,
        collection_by_mode: formattedCollectionModes,
        store_ranking: formattedStoreRankings,
        recent_invoices: data?.slice(0, 5)
      };
    }
  },

 // ---------------------------------------------------------------------------
  // 3. VOUCHER & CAMPAIGN MASTER
  // ---------------------------------------------------------------------------
  query_vouchers_master: {
    description: "Tracks promotional vouchers, stock, distributors (parties), distribution payments/delivery agents, call assignments, and WhatsApp queue.",
    parameters: {
      voucher_code: "string (optional)",
      frequency: "string (optional)",
      party_name: "string (optional)",
      metric: "string (optional, 'ready_in_stock', 'pending_print', 'delivered', 'redeemed', 'distributions', 'calls')",
      check_whatsapp_queue: "boolean (optional)"
    },
    execute: async (params: any, companyId: string) => {
      const dateFilter = calculateDateRange(params.frequency);

      // 1. WhatsApp Sequence Check
      if (params.check_whatsapp_queue) {
        const { data: sequences, error } = await supabase
          .from('voucher_message_sequences')
          .select('voucher_code, current_step, next_send_at, status, customers(full_name, phone)')
          .eq('status', 'active')
          .limit(50);
        if (error) return { error: error.message };
        return { module: "WhatsApp Voucher Automation", active_sequences_in_queue: sequences?.length || 0, queue_preview: sequences?.slice(0, 5) };
      }

      // 2. Specific Voucher Code Search
      if (params.voucher_code) {
        const { data, error } = await supabase
          .from('vouchers')
          .select('code, status, updated_at, voucher_distributors(distributor_name), customers(full_name, phone), voucher_batches!inner(company_id)')
          .ilike('code', `%${params.voucher_code}%`)
          .eq('voucher_batches.company_id', companyId)
          .limit(10);
        if (error) return { error: error.message };
        return { module: "Voucher Search", results: data };
      }

      // ✨ FIX: Advanced "Fuzzy" Search to catch A-1, A1, and A 1 variations
      let matchedDistributorIds: string[] = [];
      let actualPartyName = "All Parties";

      if (params.party_name) {
        // Converts "A 1 Dress" into a highly forgiving SQL wildcard: "%A%1%Dress%"
        // This ignores spaces, dashes, dots, and commas.
        const fuzzySearchTerm = params.party_name.split(/[\s\-.,]+/).filter(Boolean).join('%');
        
        const { data: distData, error: distErr } = await supabase
          .from('voucher_distributors')
          .select('id, distributor_name')
          .ilike('distributor_name', `%${fuzzySearchTerm}%`);

        if (distErr) return { error: distErr.message };

        // If it STILL fails, give a clear error back to the AI
        if (!distData || distData.length === 0) {
          return {
            module: "Voucher Operations",
            status: "Search Failed",
            reason: `Could not find any distributor matching "${params.party_name}". Please verify the exact name in the Master Config.`
          };
        }
        
        matchedDistributorIds = distData.map(d => d.id);
        actualPartyName = distData.map(d => d.distributor_name).join(', ');
      }

      // 3. Voucher Distributions Tracking (Payments & Delivery Agents)
      if (params.metric === 'distributions') {
        let q = supabase
          .from('voucher_distributions')
          .select('quantity, total_amount, payment_status, delivery_agent, created_at, voucher_distributors(distributor_name)')
          .eq('company_id', companyId);

        // Apply the resolved IDs
        if (matchedDistributorIds.length > 0) {
          q = q.in('distributor_id', matchedDistributorIds);
        }
        if (params.frequency) {
          q = q.gte('created_at', dateFilter.start).lte('created_at', dateFilter.end);
        }

        const { data, error } = await q.limit(500);
        if (error) return { error: error.message };

        const paymentSummary = data?.reduce((acc: any, curr: any) => {
          const status = curr.payment_status || 'Unknown';
          acc[status] = (acc[status] || 0) + Number(curr.total_amount || 0);
          return acc;
        }, {});

        const formattedPaymentSummary: any = {};
        for (const [status, amount] of Object.entries(paymentSummary)) {
          formattedPaymentSummary[status] = `₹${Number(amount).toLocaleString('en-IN')}`;
        }

        return {
          module: "Voucher Distributions & Payments",
          timeframe: params.frequency || "All Time",
          party_filter: actualPartyName,
          total_distribution_batches: data?.length || 0,
          total_vouchers_distributed: data?.reduce((sum, d) => sum + Number(d.quantity || 0), 0) || 0,
          payment_summary: formattedPaymentSummary,
          recent_deliveries: data?.slice(0, 10)
        };
      }

      // 4. Voucher Call Assignments Tracking
      if (params.metric === 'calls') {
        let q = supabase
          .from('voucher_call_assignments')
          .select('status, call_outcome, interest_level, created_at')
          .eq('company_id', companyId);

        if (params.frequency) {
          q = q.gte('created_at', dateFilter.start).lte('created_at', dateFilter.end);
        }

        const { data, error } = await q.limit(1000);
        if (error) return { error: error.message };

        const statusCount = data?.reduce((acc: any, curr: any) => {
          acc[curr.status] = (acc[curr.status] || 0) + 1;
          return acc;
        }, {});

        const outcomes = data?.reduce((acc: any, curr: any) => {
          if (curr.call_outcome) {
            acc[curr.call_outcome] = (acc[curr.call_outcome] || 0) + 1;
          }
          return acc;
        }, {});

        return {
          module: "Voucher Call Assignments",
          timeframe: params.frequency || "All Time",
          total_assignments: data?.length || 0,
          assignment_statuses: statusCount,
          call_outcomes: outcomes
        };
      }

      // 5. Ultra-Fast Parallel Counting Function
      const getExactCount = async (statusFilter: string | string[]) => {
        let q = supabase.from('vouchers')
          .select('id, voucher_batches!inner(company_id)', { count: 'exact', head: true }) 
          .eq('voucher_batches.company_id', companyId);

        // ✨ Use the resolved IDs directly on the root table instead of doing nested inner joins
        if (matchedDistributorIds.length > 0) {
          q = q.in('distributor_id', matchedDistributorIds);
        }

        if (Array.isArray(statusFilter)) {
          q = q.in('status', statusFilter);
        } else {
          q = q.eq('status', statusFilter);
        }

        if (params.frequency) {
          q = q.gte('updated_at', dateFilter.start).lte('updated_at', dateFilter.end);
        }

        const { count, error } = await q;
        if (error) console.error("Voucher Count Error:", error);
        return count || 0;
      };

      const [inStockCount, pendingPrintCount, deliveredCount, redeemedCount] = await Promise.all([
        getExactCount(['in_stock', 'unclaimed']), 
        getExactCount('pending_print'),
        getExactCount('distributed'),
        getExactCount('redeemed')
      ]);

      return {
        module: "Voucher Operations & General Stock",
        timeframe: params.frequency || "All Time",
        party_filter: actualPartyName,
        vouchers_in_stock: inStockCount,
        vouchers_pending_print: pendingPrintCount,
        vouchers_delivered: deliveredCount,
        vouchers_redeemed: redeemedCount,
        vouchers_not_redeemed: deliveredCount - redeemedCount
      };
    }
  },
  // ---------------------------------------------------------------------------
  // 4. CRM & KITTY MASTER
  // ---------------------------------------------------------------------------
  query_crm_master: {
    description: "Searches customer profiles, past buyers, kitty members, unconverted leads, and telecaller activities.",
    parameters: {
      phone_number: "string (optional)",
      customer_name: "string (optional)",
      frequency: "string (optional)",
      metric: "string (optional, 'kitty_members', 'unconverted_leads', 'telecalling_stats', 'past_buyers')"
    },
    execute: async (params: any, companyId: string) => {
      const dateFilter = calculateDateRange(params.frequency);

      if (params.phone_number || params.customer_name) {
        let q = supabase.from('customers').select('full_name, phone, email, store_credit_balance, pavitram_points, customer_status, next_followup_date, city').eq('company_id', companyId);
        if (params.phone_number) q = q.eq('phone', params.phone_number);
        if (params.customer_name) q = q.ilike('full_name', `%${params.customer_name}%`);
        const { data } = await q.limit(10);
        return { module: "CRM & Profiles", profiles_matched: data?.length || 0, customer_data: data };
      }

      if (params.metric === 'kitty_members') {
         const { data } = await supabase.from('kitty_plans').select('status, customers(full_name)').eq('company_id', companyId);
         const active = data?.filter(k => k.status === 'active').length || 0;
         const past = data?.filter(k => k.status !== 'active').length || 0;
         return { module: "Kitty / Celebration Members", active_members: active, past_members: past };
      }

      if (params.metric === 'unconverted_leads') {
         const { data } = await supabase.from('customer_leads').select('status').eq('company_id', companyId).neq('status', 'converted').gte('created_at', dateFilter.start).lte('created_at', dateFilter.end);
         return { module: "Lead Tracking", timeframe: params.frequency, unconverted_leads_count: data?.length || 0 };
      }

      if (params.metric === 'telecalling_stats') {
         const { data } = await supabase.from('call_records').select('outcome, user_id').eq('company_id', companyId).gte('call_time', dateFilter.start).lte('call_time', dateFilter.end);
         return { module: "Telecalling Stats", timeframe: params.frequency, actual_calls_logged: data?.length || 0 };
      }

      if (params.metric === 'past_buyers') {
        const { data: buyers } = await supabase.from('customers').select('id').eq('company_id', companyId).eq('customer_status', 'Converted').gte('updated_at', dateFilter.start).lte('updated_at', dateFilter.end);
        return { module: "CRM Overview", timeframe: params.frequency, total_past_buyers: buyers?.length || 0 };
      }

      return { error: "Please specify a metric to query (kitty_members, unconverted_leads, telecalling_stats, past_buyers) or provide a customer phone/name." };
    }
  },

  // ---------------------------------------------------------------------------
  // 5. MANUFACTURING MASTER
  // ---------------------------------------------------------------------------
  query_manufacturing_master: {
    description: "Tracks artisan/karigar manufacturing job bags (placed, received, pending), repair tickets, and custom orders.",
    parameters: {
      job_bag_number: "string (optional)",
      karigar_name: "string (optional)",
      repair_ticket: "string (optional)",
      frequency: "string (optional)"
    },
    execute: async (params: any, companyId: string) => {
      if (params.repair_ticket) {
        const { data: repair } = await supabase.from('repair_tickets').select('ticket_number, item_description, gross_weight_g, estimated_cost, status, expected_delivery_date, customers(full_name, phone)').ilike('ticket_number', `%${params.repair_ticket}%`).eq('company_id', companyId).maybeSingle();
        return repair || { error: `Repair ticket '${params.repair_ticket}' not found.` };
      }
      if (params.job_bag_number) {
        const { data: bag } = await supabase.from('job_bags').select('job_bag_number, product_category, status, issue_date, expected_return_date, gold_expected_weight_g, karigars(full_name)').ilike('job_bag_number', `%${params.job_bag_number}%`).eq('company_id', companyId).maybeSingle();
        return bag || { error: `Job bag '${params.job_bag_number}' not found.` };
      }

      const dateFilter = calculateDateRange(params.frequency);
      let query = supabase.from('job_bags').select('status, issue_date, karigars(full_name)').eq('company_id', companyId).gte('created_at', dateFilter.start).lte('created_at', dateFilter.end);

      if (params.karigar_name) {
        const { data: k } = await supabase.from('karigars').select('id').ilike('full_name', `%${params.karigar_name}%`).eq('company_id', companyId).maybeSingle();
        if (k) query = query.eq('karigar_id', k.id);
      }

      const { data, error } = await query;
      if (error) return { error: error.message };

      const statusCounts = data.reduce((acc: any, job: any) => {
        acc[job.status] = (acc[job.status] || 0) + 1;
        return acc;
      }, {});

      return {
        module: "Production & Karigar Operations",
        timeframe: params.frequency || "Overall",
        orders_placed_to_karigar: (statusCounts['issued'] || 0) + (statusCounts['in_progress'] || 0),
        orders_received_from_karigar: statusCounts['completed'] || 0,
        orders_pending_from_karigar: statusCounts['in_progress'] || 0,
        orders_dispatched_to_inventory: statusCounts['closed'] || 0
      };
    }
  },

  // ---------------------------------------------------------------------------
  // 6. OPERATIONS MASTER
  // ---------------------------------------------------------------------------
  query_operations_master: {
    description: "Monitors inter-store stock transfers, branch restock requests, estimates, suppliers, and warehouse/branch topology.",
    parameters: {
      operation_type: "string (optional, 'transfers', 'restocks', 'estimates', 'suppliers', 'branches')",
      warehouse_name: "string (optional)",
      reference_number: "string (optional)"
    },
    execute: async (params: any, companyId: string) => {
      
      // ✨ LIVE DATABASE QUERY FOR BRANCHES
      if (params.operation_type === 'branches' || !params.operation_type) {
        const { data, error } = await supabase
          .from('warehouses')
          .select('name, warehouse_code, warehouse_type, is_active, contact_number')
          .eq('company_id', companyId)
          .order('warehouse_type', { ascending: true });

        if (error) return { error: error.message };

        const activeLocations = data?.filter(w => w.is_active) || [];
        
        // Group them by type (branch, main_safe, factory, transit)
        const typeBreakdown = activeLocations.reduce((acc: any, w: any) => {
          const type = w.warehouse_type.replace('_', ' ').toUpperCase();
          acc[type] = (acc[type] || 0) + 1;
          return acc;
        }, {});

        return { 
          module: "Store & Branch Topology", 
          total_locations_in_database: data?.length || 0,
          active_locations: activeLocations.length,
          breakdown_by_type: typeBreakdown,
          // Map out a clean list for the AI to read
          location_list: activeLocations.map(w => `[${w.warehouse_code}] ${w.name} (${w.warehouse_type})`) 
        };
      }

      // -----------------------------------------------------------------------
      // (The rest of your existing logic stays exactly the same)
      const matchedWhs = params.warehouse_name ? await resolveWarehouses(params.warehouse_name) : [];
      const whIds = matchedWhs.map(w => w.id);

      if (params.operation_type === 'transfers') {
        let q = supabase.from('stock_transfers').select('transfer_number, status, transfer_date, transfer_category, from_warehouse_id, to_warehouse_id').eq('company_id', companyId);
        if (params.reference_number) q = q.ilike('transfer_number', `%${params.reference_number}%`);
        const { data } = await q.limit(20);
        return { module: "Inter-Store Stock Transfers", count: data?.length || 0, transfers: data };
      }

      if (params.operation_type === 'restocks') {
        let q = supabase.from('branch_restock_requests').select('sku_reference, quantity, status, required_by_date, remarks, warehouses(name)').eq('company_id', companyId);
        if (whIds.length > 0) q = q.in('warehouse_id', whIds);
        const { data } = await q.eq('status', 'pending_ho').limit(30);
        return { module: "Branch Restock Requests (Pending HO)", open_requests: data?.length || 0, requests: data };
      }

      if (params.operation_type === 'estimates') {
        let q = supabase.from('estimates').select('estimate_number, total_amount, valid_until, status, customers(full_name, phone), warehouses(name)').eq('company_id', companyId);
        if (params.reference_number) q = q.ilike('estimate_number', `%${params.reference_number}%`);
        const { data } = await q.limit(15);
        return { module: "Active Billing Estimates", count: data?.length || 0, estimates: data };
      }

      return { error: "Invalid operation type. Specify transfers, restocks, estimates, suppliers, or branches." };
    }
  }
};

const SYSTEM_PROMPT = `You are the executive AI routing engine for Biillo, an enterprise jewelry ERP system.
Your only job is to analyze user natural language requests and map them to one of our master query intents.

====================================================================
CRITICAL ROUTING RULES (MUST FOLLOW):
1. NEVER return null if the question is about Sales, Revenue, Invoices, Billing, or Money -> ALWAYS map to "query_sales_master".
2. NEVER return null if the question is about Stock, Tops, Rings, Items, Barcodes, or Valuation -> ALWAYS map to "query_inventory_master".
3. NEVER return null if the question is about Job bags, Karigars, Artisans, or Repairs -> ALWAYS map to "query_manufacturing_master".
4. NEVER return null if the question is about Customers, Points, Credit, or Kitty plans -> ALWAYS map to "query_crm_master".
5. If a parameter (like warehouse_name or invoice_number) is not explicitly mentioned by the user, leave it null/undefined. Do NOT fail the intent!

====================================================================
EXPLICIT FEW-SHOT EXAMPLES (Memorize these routing patterns):
User: "What is our total sales revenue today?"
Output: {"intent": "query_sales_master", "parameters": {"frequency": "Daily"}}

User: "How much did we make this week across all branches?"
Output: {"intent": "query_sales_master", "parameters": {"frequency": "Weekly"}}

User: "Show me stock valuation for Chakan"
Output: {"intent": "query_inventory_master", "parameters": {"warehouse_name": "Chakan"}}

User: "How many active kitty members do we have?"
Output: {"intent": "query_crm_master", "parameters": {"metric": "kitty_members"}}
====================================================================

Analyze the latest user request in context. Respond ONLY with a valid JSON object containing:
1. "intent": The matched key string from the available intents (or null ONLY if completely unrelated to jewelry/ERP).
2. "parameters": An object containing the extracted variables matching the parameter schema.`;

export async function POST(req: Request) {
  try {
    const { message, companyId, history = [] } = await req.json();

    if (!message || !companyId) {
      return Response.json({ text: "Missing message or tenant company ID." }, { status: 400 });
    }

    const intentDefinitions = Object.entries(ERP_INTENTS)
      .map(([key, val]) => `Intent: "${key}"\nDescription: ${val.description}\nParameters: ${JSON.stringify(val.parameters)}`)
      .join("\n\n");

    const formattedHistory = history.slice(-6).map((msg: { role: string, content: string }) => ({
      role: msg.role === 'user' ? 'user' : 'assistant',
      content: msg.content
    }));

    // Step 1: Intent & Parameter Extraction via Groq
    const parseCompletion = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      response_format: { type: "json_object" },
      temperature: 0.1, 
      messages: [
        { role: "system", content: `${SYSTEM_PROMPT}\n\nAVAILABLE INTENTS:\n${intentDefinitions}` },
        ...formattedHistory,
        { role: "user", content: message }
      ]
    });

    const parsedContent = JSON.parse(parseCompletion.choices[0]?.message?.content || "{}");
    console.log("[AI Router Matched]:", parsedContent);

    const intentKey = parsedContent.intent as keyof typeof ERP_INTENTS;
    const parameters = parsedContent.parameters || {};

    // Step 2: Execute Hardcoded Database Logic
    if (intentKey && ERP_INTENTS[intentKey]) {
      const dbResult = await ERP_INTENTS[intentKey].execute(parameters, companyId);
      
      // ✨ FIX: REWRITTEN SUMMARY PROMPT
      // This strictly forces the AI to output all arrays/objects using markdown lists, preventing truncation.
      const summaryCompletion = await groq.chat.completions.create({
        model: "llama-3.1-8b-instant",
        temperature: 0.2, // Lower temp for more deterministic formatting
        messages: [
          { 
            role: "system", 
            content: `You are an AI Executive Assistant for a jewelry brand owner. Formulate a professional, insightful summary of the raw database results provided below.
            
            CRITICAL FORMATTING RULES:
            1. NEVER omit any data from 'collection_by_mode' or 'store_ranking'. If the payload contains 4 payment modes, list ALL 4. If it contains 10 branches, list ALL 10.
            2. Use Markdown bullet points to clearly present lists and rankings.
            3. Do not round numbers or change currencies. Use the exact pre-formatted strings provided in the payload (e.g., '₹6,68,018').
            4. Keep your opening summary sentence concise, then immediately provide the bulleted breakdowns.`
          },
          { 
            role: "user", 
            content: `User Question: "${message}"\nDatabase Execution Payload:\n${JSON.stringify(dbResult, null, 2)}` 
          }
        ]
      });

      return Response.json({ 
        text: summaryCompletion.choices[0]?.message?.content || "Data retrieved successfully.", 
        data: dbResult 
      });
    }

    // Fallback: Smart clarification if the query falls outside active modules
    const clarification = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: [
        { 
          role: "system", 
          content: "The user asked a question that falls outside our active ERP query modules (Inventory, Sales, Vouchers, CRM/Kitty, Manufacturing, Operations). Write a polite, concise 1-sentence response explaining which modules you can check." 
        },
        ...formattedHistory,
        { role: "user", content: message }
      ]
    });

    return Response.json({ 
      text: clarification.choices[0]?.message?.content || "Please specify if you are querying Inventory, Sales, Karigars, Vouchers, or Store Operations.", 
      data: null 
    });

  } catch (error: any) {
    console.error("AI Routing Failure:", error);
    return Response.json({ text: "A system error occurred while scanning the ERP database.", error: error.message }, { status: 500 });
  }
}