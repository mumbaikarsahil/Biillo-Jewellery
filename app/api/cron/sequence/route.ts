import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { jsPDF } from 'jspdf'; // ✨ New PDF Generator
import autoTable from 'jspdf-autotable'; // ✨ New Table Formatter
import { startOfDay } from 'date-fns';

// Initialize the Admin Client to bypass all RLS policies safely
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! 
);

export const runtime = 'nodejs';

const SEQUENCE_TEMPLATES: Record<number, string> = {
  2: 'personalized_jewellery_assistance',
  3: 'a_small_gift_for_yourself',
  4: 'active_voucher_reminder',
  5: 'expiring_soon',
  6: 'once_in_a_lifetime_opportunity',
  7: 'final_reminder',
};

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const now = new Date();
    const nowISO = now.toISOString();
    let logs: string[] = [];

    // =========================================================================
    // TASK 1: GENERIC SCHEDULED TASKS (The Master Queue)
    // =========================================================================
    const { data: scheduledTasks, error: taskError } = await supabaseAdmin
      .from('system_scheduled_tasks')
      .select('*')
      .eq('status', 'active')
      .lte('next_run_at', nowISO);

    if (taskError) throw taskError;

    let tasksProcessed = 0;
    for (const task of scheduledTasks || []) {
      
      try {
        const payload = task.payload || {};
        const ownerPhone = payload.owner_phone;
        const templateName = payload.template_name;
        
        let sendVariables: string[] = [];

        // ---------------------------------------------------------
        // SCENARIO A: CRM Operations Report
        // ---------------------------------------------------------
        if (task.task_name === 'daily_owner_report') {
          const startOfDay = new Date();
          startOfDay.setHours(0, 0, 0, 0);
          const startOfDayISO = startOfDay.toISOString();

          const { count: activeCount } = await supabaseAdmin.from('voucher_message_sequences').select('*', { count: 'exact', head: true }).eq('status', 'active');
          const { count: completedCount } = await supabaseAdmin.from('voucher_message_sequences').select('*', { count: 'exact', head: true }).eq('status', 'completed').gte('updated_at', startOfDayISO);
          const { count: overdueCount } = await supabaseAdmin.from('voucher_message_sequences').select('*', { count: 'exact', head: true }).eq('status', 'active').lt('next_send_at', nowISO);
          const { count: totalReplies } = await supabaseAdmin.from('crm_webhook_events').select('*', { count: 'exact', head: true }).gte('created_at', startOfDayISO);
          const { count: pendingWebhooks } = await supabaseAdmin.from('crm_webhook_events').select('*', { count: 'exact', head: true }).eq('processed_status', 'pending');

          const dateStr = new Date().toLocaleString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
          
          sendVariables = [
            dateStr,                               
            (activeCount || 0).toString(),         
            (completedCount || 0).toString(),  
            (overdueCount || 0).toString(),        
            (totalReplies || 0).toString(),    
            (pendingWebhooks || 0).toString()       
          ];

          task.payload.template_name = "erp_utliltiy1";
        }

        // ---------------------------------------------------------
        // SCENARIO B: Global Inventory PDF Generator 
        // ---------------------------------------------------------
        else if (task.task_name === 'daily_inventory_report') {
          let allItems: any[] = [];
          let isFetching = true;
          let step = 0;
          const limit = 1000;

          while (isFetching && step < 20) {
            const { data, error } = await supabaseAdmin.from('inventory_items')
              .select('item_category, mrp, status, warehouse_id, warehouses(name)')
              .eq('status', 'in_stock') 
              .range(step * limit, (step + 1) * limit - 1);

            if (error) throw error;
            if (data && data.length > 0) {
              allItems.push(...data);
              if (data.length < limit) isFetching = false;
              else step++;
            } else {
              isFetching = false;
            }
          }

          const totalItems = allItems.length;
          const totalValue = allItems.reduce((acc, curr) => acc + (Number(curr.mrp) || 0), 0);
          const locationSummary: Record<string, { count: number, value: number, categories: Record<string, { count: number, value: number }> }> = {};

          allItems.forEach(item => {
             // Use full warehouse names and categories since space is unlimited in the PDF
             let locName = 'HQ';
             if (item.warehouses) {
               const wh = Array.isArray(item.warehouses) ? item.warehouses[0] : item.warehouses;
               locName = wh?.name || 'HQ';
             }
             
             let cat = item.item_category ? item.item_category.trim() : 'Uncategorized';
             const mrp = Number(item.mrp) || 0;

             if (!locationSummary[locName]) locationSummary[locName] = { count: 0, value: 0, categories: {} };
             locationSummary[locName].count += 1;
             locationSummary[locName].value += mrp;

             if (!locationSummary[locName].categories[cat]) locationSummary[locName].categories[cat] = { count: 0, value: 0 };
             locationSummary[locName].categories[cat].count += 1;
             locationSummary[locName].categories[cat].value += mrp;
          });

          // ✨ BUILD THE PDF DOCUMENT
          const doc = new jsPDF();
          const dateStr = new Date().toLocaleString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });

          doc.setFontSize(18);
          doc.text(`Biillo ERP - Asset Registry Report`, 14, 15);
          doc.setFontSize(11);
          doc.text(`Date: ${dateStr}`, 14, 23);
          doc.text(`Total Active Assets: ${totalItems} pcs`, 14, 29);
          doc.text(`Global Valuation: Rs. ${totalValue.toLocaleString('en-IN')}`, 14, 35);

          const tableBody: any[] = [];
          
          const sortedLocs = Object.entries(locationSummary).sort((a, b) => b[1].value - a[1].value);
          sortedLocs.forEach(([loc, stats]) => {
             // Dark Branch Header Row
             tableBody.push([{ content: `Branch: ${loc}`, colSpan: 4, styles: { fillColor: [230, 230, 230], fontStyle: 'bold', textColor: [0,0,0] } }]);

             // Category Rows
             const sortedCats = Object.entries(stats.categories).sort((a, b) => b[1].value - a[1].value);
             sortedCats.forEach(([cat, catStats]) => {
                 tableBody.push(['', cat, `${catStats.count} pcs`, `Rs. ${catStats.value.toLocaleString('en-IN')}`]);
             });

             // Subtotal Row
             tableBody.push([
                 '', 
                 { content: 'Subtotal', styles: { fontStyle: 'bold' } }, 
                 { content: `${stats.count} pcs`, styles: { fontStyle: 'bold' } }, 
                 { content: `Rs. ${stats.value.toLocaleString('en-IN')}`, styles: { fontStyle: 'bold' } }
             ]);
          });

          autoTable(doc, {
              startY: 40,
              head: [['', 'Category', 'Quantity', 'Valuation']],
              body: tableBody,
              theme: 'grid',
              headStyles: { fillColor: [41, 128, 185] },
              styles: { fontSize: 9 }
          });

          // Output PDF to buffer
          const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
          const fileName = `Asset_Registry_${Date.now()}.pdf`;

          // ✨ UPLOAD PDF TO SUPABASE
          const { error: uploadError } = await supabaseAdmin.storage
              .from('daily_reports')
              .upload(fileName, pdfBuffer, { contentType: 'application/pdf', upsert: true });

          if (uploadError) throw new Error(`PDF Upload Failed: ${uploadError.message}`);
          const { data: { publicUrl } } = supabaseAdmin.storage.from('daily_reports').getPublicUrl(fileName);

          // ✨ Generate dynamic executive summary for the 4th template parameter
          let shortBreakdownArr: string[] = [];
          
          // Grab the top 4 locations by value to fit beautifully in the WhatsApp text bubble
          const topLocs = Object.entries(locationSummary).sort((a, b) => b[1].value - a[1].value);
          
          topLocs.slice(0, 4).forEach(([loc, stats]) => {
             let formattedVal = stats.value >= 10000000 
               ? `₹${(stats.value / 10000000).toFixed(2)}Cr` 
               : `₹${(stats.value / 100000).toFixed(2)}L`;
             shortBreakdownArr.push(`*${loc}*: ${stats.count}p (${formattedVal})`);
          });

          let actualDataString = shortBreakdownArr.join(' | ');
          
          // Add a helpful tag if there are more than 4 branches
          if (topLocs.length > 4) {
             actualDataString += ` +${topLocs.length - 4} more stores (See PDF)`;
          }

          if (topLocs.length === 0) actualDataString = "No active inventory found.";

          // ✨ SET UP DOCUMENT VARIABLES (Strictly 4 variables with ACTUAL data)
          sendVariables = [
            dateStr,                                       
            `${totalItems} pcs`,                         
            `₹${totalValue.toLocaleString('en-IN')}`,
            actualDataString // This acts as variable {{4}} in the WhatsApp message body
          ];

          task.payload.template_name = "erp_utility4"; 	
          
          task.payload.document_link = publicUrl;
          task.payload.document_name = `Biillo_Inventory_${dateStr.replace(/,/g,'').replace(/ /g,'_')}.pdf`;
        }
        // ---------------------------------------------------------
        // SCENARIO C: Daily Revenue & Accounts Summary
        // ---------------------------------------------------------
        else if (task.task_name === 'daily_revenue_report') {
          const startOfDay = new Date();
          startOfDay.setHours(0, 0, 0, 0);
          const startOfDayISO = startOfDay.toISOString();

          const { data: whData } = await supabaseAdmin.from('warehouses').select('id, name');
          const whMap = Object.fromEntries(whData?.map(w => [w.id, w.name]) || []);

          const [invRes, coRes, bbRes, repRes] = await Promise.all([
            supabaseAdmin.from('invoices').select('final_total, status, warehouse_id').gte('created_at', startOfDayISO).neq('status', 'CANCELLED'),
            supabaseAdmin.from('custom_orders').select('estimated_value, advance_paid, status, origin_warehouse_id').gte('created_at', startOfDayISO).neq('status', 'CANCELLED'),
            supabaseAdmin.from('buybacks').select('net_refund, warehouse_id').gte('created_at', startOfDayISO),
            supabaseAdmin.from('repair_tickets').select('advance_paid, origin_warehouse_id').gte('created_at', startOfDayISO)
          ]);

          const branchStats: Record<string, { sales: number, adv: number, refunds: number }> = {};
          
          const initBranch = (id: string | null) => {
              const name = id ? (whMap[id] || 'Unassigned Node') : 'Unassigned Node';
              if (!branchStats[name]) branchStats[name] = { sales: 0, adv: 0, refunds: 0 };
              return name;
          };

          let globalSales = 0;
          let globalAdvances = 0;

          invRes.data?.forEach(inv => {
              const name = initBranch(inv.warehouse_id);
              const val = Number(inv.final_total) || 0;
              branchStats[name].sales += val;
              globalSales += val;
          });

          coRes.data?.forEach(co => {
              const name = initBranch(co.origin_warehouse_id);
              const val = Number(co.estimated_value) || 0;
              const adv = Number(co.advance_paid) || 0;
              branchStats[name].sales += val; 
              branchStats[name].adv += adv;
              globalSales += val;
              globalAdvances += adv;
          });

          repRes.data?.forEach(rep => {
              const name = initBranch(rep.origin_warehouse_id);
              const adv = Number(rep.advance_paid) || 0;
              branchStats[name].adv += adv;
              globalAdvances += adv;
          });

          bbRes.data?.forEach(bb => {
              const name = initBranch(bb.warehouse_id);
              const refund = Number(bb.net_refund) || 0;
              branchStats[name].refunds += refund;
          });

          let breakdownArr: string[] = [];
          const sortedBranches = Object.entries(branchStats).sort((a, b) => (b[1].sales + b[1].adv) - (a[1].sales + a[1].adv));

          sortedBranches.forEach(([loc, stats]) => {
              breakdownArr.push(`📍 *${loc}* ➼ Sales: ₹${stats.sales.toLocaleString('en-IN')} • Adv: ₹${stats.adv.toLocaleString('en-IN')} • Refunds: ₹${stats.refunds.toLocaleString('en-IN')}`);
          });

          let breakdownStr = breakdownArr.join(' | ');

          if (!breakdownStr) breakdownStr = "No financial transactions recorded today.";
          else if (breakdownStr.length > 950) breakdownStr = breakdownStr.substring(0, 950) + '...[Truncated]';
          
          // Strip out any accidental consecutive spaces
          breakdownStr = breakdownStr.replace(/\s{2,}/g, ' ');

          const dateStr = new Date().toLocaleString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });

          sendVariables = [
            dateStr,                                       
          `₹${globalSales.toLocaleString('en-IN')}`,     
          `₹${globalAdvances.toLocaleString('en-IN')}`,  
          breakdownStr.trim()                            
          ];

          task.payload.template_name = "erp_utility3";
        }

        // ---------------------------------------------------------
        // SCENARIO D: 🚀 AUTOMATED JSON WIDGET SNAPSHOTS (ALL MODULES)
        // ---------------------------------------------------------
        else if (task.task_name.startsWith('generate_json_snapshots')) {
          const frequency = task.payload.frequency || 'daily'; 
          const companyId = task.payload.company_id;
          if (!companyId) throw new Error("Missing company_id for snapshot generation");

          // 1. Timeframe Definitions
          let startDate = new Date();
          let endDate = new Date();
          let futureEndDate = new Date(); // For forward-looking reports (Follow-ups, Events)
          
          if (frequency === 'daily') {
            startDate.setHours(0, 0, 0, 0); 
            futureEndDate.setHours(23, 59, 59, 999);
          } else if (frequency === 'weekly') {
            startDate.setDate(startDate.getDate() - 7);
            startDate.setHours(0, 0, 0, 0);
            futureEndDate.setDate(futureEndDate.getDate() + 7);
            futureEndDate.setHours(23, 59, 59, 999);
          } else if (frequency === 'monthly') {
            startDate.setMonth(startDate.getMonth() - 1);
            startDate.setHours(0, 0, 0, 0);
            futureEndDate.setMonth(futureEndDate.getMonth() + 1);
            futureEndDate.setHours(23, 59, 59, 999);
          }
          
          const startISO = startDate.toISOString();
          const endISO = endDate.toISOString();
          const futureEndISO = futureEndDate.toISOString();
          const todayStr = new Date().toISOString().split('T')[0];

          // 2. PARALLEL BATCH 1: Finance, Operations & Custom Orders
          const [
            { data: invoices },
            { data: customOrders },
            { data: buybacks },
            { data: cashbooks },
            { data: estimates },
            { data: repairTickets }
          ] = await Promise.all([
            supabaseAdmin.from('invoices').select('id, invoice_number, final_total, taxable_value, cgst_amount, sgst_amount, discount_amount, voucher_discount, payment_mode, split_payments, created_at, status, warehouse_id, exchange_value, exchange_notes, voucher_code, warehouses(name), profiles!user_id(full_name), customers(full_name)').eq('company_id', companyId).neq('status', 'CANCELLED').gte('created_at', startISO).lte('created_at', endISO),
            supabaseAdmin.from('custom_orders').select('id, order_number, estimated_value, advance_paid, status, created_at, voucher_code, voucher_amount, voucher_discount, customers(full_name)').eq('company_id', companyId).neq('status', 'CANCELLED').gte('created_at', startISO).lte('created_at', endISO),
            supabaseAdmin.from('buybacks').select('id, status, is_external_item, item_category, purity_karat, gross_weight_g, gross_value, deduction_amount, net_refund, created_at, customers(full_name), warehouse_id').eq('company_id', companyId).gte('created_at', startISO).lte('created_at', endISO),
            supabaseAdmin.from('daily_cashbooks').select('id, record_date, yesterday_cash, closing_balance, cash_in_out, expenses, warehouses(name)').eq('company_id', companyId).gte('record_date', startISO.split('T')[0]).lte('record_date', endISO.split('T')[0]),
            supabaseAdmin.from('estimates').select('id, created_at, estimate_number, status, subtotal, discount_amount, total_amount, customers(full_name)').eq('company_id', companyId).gte('created_at', startISO).lte('created_at', endISO),
            supabaseAdmin.from('repair_tickets').select('id, created_at, ticket_number, item_description, status, estimated_cost, advance_paid, customers(full_name)').eq('company_id', companyId).gte('created_at', startISO).lte('created_at', endISO)
          ]);

          // 3. PARALLEL BATCH 2: CRM, Customers & Vouchers
          const [
            { data: custBase },
            { data: custFollowups },
            { data: custWallet },
            { data: custEventsRaw },
            { data: kittyPlans },
            { data: waSequences },
            { data: callAssign },
            { data: giftingHistory }
          ] = await Promise.all([
            supabaseAdmin.from('customers').select('id, created_at, full_name, phone, customer_status, last_interaction, warehouses(name)').eq('company_id', companyId).gte('created_at', startISO).lte('created_at', endISO),
            supabaseAdmin.from('customers').select('id, full_name, phone, next_followup_date, followup_reason, customer_status').eq('company_id', companyId).gte('next_followup_date', todayStr).lte('next_followup_date', futureEndISO.split('T')[0]),
            supabaseAdmin.from('customers').select('id, full_name, phone, store_credit_balance, pavitram_points').eq('company_id', companyId).or('store_credit_balance.gt.0,pavitram_points.gt.0'), // Snapshot of current liabilities
            supabaseAdmin.from('customers').select('id, full_name, phone, birth_date, anniversary_date').eq('company_id', companyId).or('birth_date.not.is.null,anniversary_date.not.is.null'),
            supabaseAdmin.from('kitty_plans').select('id, start_date, plan_amount, total_months, months_paid, status, customers(full_name, phone)').eq('company_id', companyId).gte('created_at', startISO).lte('created_at', endISO),
            supabaseAdmin.from('voucher_message_sequences').select('id, next_send_at, voucher_code, current_step, status, customers(full_name, phone)').gte('next_send_at', startISO).lte('next_send_at', futureEndISO),
            supabaseAdmin.from('voucher_call_assignments').select('id, created_at, status, call_outcome, attempt_count, interest_level, customers(full_name, phone), vouchers(code)').eq('company_id', companyId).gte('created_at', startISO).lte('created_at', endISO),
            supabaseAdmin.from('customer_gifts_history').select('id, created_at, gift_name, warehouses(name), customers(full_name, phone)').eq('company_id', companyId).gte('created_at', startISO).lte('created_at', endISO)
          ]);

          // 4. PARALLEL BATCH 3: Production, Audit & Logistics
          const [
            { data: vBatches },
            { data: vDistributions },
            { data: vBookings },
            { data: vouchers },
            { data: jobBags },
            { data: goldCons },
            { data: diaCons },
            { data: goldMovs },
            { data: diaMovs },
            { data: stockTransfers }
          ] = await Promise.all([
            supabaseAdmin.from('voucher_batches').select('id, created_at, batch_no, printer_name, quantity, discount_value').eq('company_id', companyId).gte('created_at', startISO).lte('created_at', endISO),
            supabaseAdmin.from('voucher_distributions').select('id, created_at, quantity, total_amount, payment_status, delivery_status, delivery_agent, voucher_distributors(distributor_name)').eq('company_id', companyId).gte('created_at', startISO).lte('created_at', endISO),
            supabaseAdmin.from('voucher_bookings').select('id, created_at, booking_ref, requested_quantity, fulfilled_quantity, status, voucher_distributors(distributor_name)').eq('company_id', companyId).gte('created_at', startISO).lte('created_at', endISO),
            supabaseAdmin.from('vouchers').select('id, updated_at, code, discount_value, status, expiry_date').gte('updated_at', startISO).lte('updated_at', endISO),
            supabaseAdmin.from('job_bags').select('id, created_at, job_bag_number, status, gold_expected_weight_g, diamond_expected_weight_cts, issue_date, expected_return_date, karigars(full_name, specialization, is_active)').eq('company_id', companyId).gte('created_at', startISO).lte('created_at', endISO),
            supabaseAdmin.from('job_bag_gold_consumption').select('id, created_at, consumed_weight_g, loss_weight_g, job_bags(job_bag_number, karigars(full_name)), inventory_gold_batches(batch_number)').gte('created_at', startISO).lte('created_at', endISO),
            supabaseAdmin.from('job_bag_diamond_consumption').select('id, created_at, consumed_weight_cts, consumed_pieces, breakage_weight_cts, job_bags(job_bag_number, karigars(full_name)), inventory_diamond_lots(lot_number)').gte('created_at', startISO).lte('created_at', endISO),
            supabaseAdmin.from('gold_lot_movements').select('created_at, movement_type, movement_weight_g, reference_type, notes').eq('company_id', companyId).gte('created_at', startISO).lte('created_at', endISO),
            supabaseAdmin.from('diamond_lot_movements').select('created_at, movement_type, movement_weight_cts, reference_type, notes').eq('company_id', companyId).gte('created_at', startISO).lte('created_at', endISO),
            supabaseAdmin.from('stock_transfers').select('id, transfer_number, status, transfer_date, transfer_category, from_warehouse_id, to_warehouse_id').eq('company_id', companyId).gte('created_at', startISO).lte('created_at', endISO)
          ]);

          // 5. IN-MEMORY DATA TRANSFORMATIONS
          
          // A. Inventory Audit Combiner
          const gMap = (goldMovs || []).map((g: any) => ({ ...g, material: 'Gold', weight: g.movement_weight_g, unit: 'g' }));
          const dMap = (diaMovs || []).map((d: any) => ({ ...d, material: 'Diamond', weight: d.movement_weight_cts, unit: 'cts' }));
          const invAuditData = [...gMap, ...dMap].sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

          // B. Voucher Sales Booked Combiner
          const mappedInv = (invoices || []).filter((i: any) => i.voucher_code).map((i: any) => ({ 
            id: i.invoice_number, date: i.created_at, doc_type: 'Tax Invoice', doc_no: i.invoice_number, customer: Array.isArray(i.customers) ? i.customers[0]?.full_name : i.customers?.full_name, v_code: i.voucher_code, v_discount: i.voucher_discount, total: i.final_total 
          }));
          const mappedCust = (customOrders || []).filter((c: any) => c.voucher_code).map((c: any) => ({ 
            id: c.order_number, date: c.created_at, doc_type: 'Custom Order', doc_no: c.order_number, customer: Array.isArray(c.customers) ? c.customers[0]?.full_name : c.customers?.full_name, v_code: c.voucher_code, v_discount: c.voucher_amount || c.voucher_discount, total: c.estimated_value 
          }));
          const vSalesBookedData = [...mappedInv, ...mappedCust].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());

          // C. Upcoming Events Projector
          const upcomingEvents: any[] = [];
          (custEventsRaw || []).forEach((c: any) => {
            ['birth_date', 'anniversary_date'].forEach(field => {
              if (c[field]) {
                const evtDate = new Date(c[field]);
                const projectedDate = new Date(startDate.getFullYear(), evtDate.getMonth(), evtDate.getDate());
                if (projectedDate < startOfDay(startDate)) projectedDate.setFullYear(startDate.getFullYear() + 1);
                
                if (projectedDate >= startDate && projectedDate <= futureEndDate) {
                  upcomingEvents.push({ ...c, event_type: field === 'birth_date' ? 'Birthday' : 'Anniversary', projected_date: projectedDate.toISOString(), original_date: c[field] });
                }
              }
            });
          });
          upcomingEvents.sort((a,b) => new Date(a.projected_date).getTime() - new Date(b.projected_date).getTime());

          // 6. BUILD THE SNAPSHOTS ARRAY
          const snapshotsToInsert = [
            // Finance & Sales
            { report_type: 'sales_summary', raw_data: invoices },
            { report_type: 'branch_rankings', raw_data: invoices },
            { report_type: 'custom_orders', raw_data: customOrders },
            { report_type: 'buybacks', raw_data: buybacks },
            { report_type: 'daily_cashbook', raw_data: cashbooks },
            
            // CRM
            { report_type: 'customer_base', raw_data: custBase },
            { report_type: 'upcoming_events', raw_data: upcomingEvents },
            { report_type: 'followups_due', raw_data: custFollowups },
            { report_type: 'wallet_balances', raw_data: custWallet },
            { report_type: 'kitty_plans', raw_data: kittyPlans },
            { report_type: 'gifting_history', raw_data: giftingHistory },
            { report_type: 'whatsapp_sequences', raw_data: waSequences },
            { report_type: 'call_assignments', raw_data: callAssign },

            // Vouchers
            { report_type: 'v_sales_booked', raw_data: vSalesBookedData },
            { report_type: 'v_under_printing', raw_data: vBatches },
            { report_type: 'v_payment_pending', raw_data: (vDistributions || []).filter((d: any) => d.payment_status === 'pending') },
            { report_type: 'v_delivery_pending', raw_data: (vDistributions || []).filter((d: any) => d.delivery_status === 'pending') },
            { report_type: 'v_payment_received', raw_data: (vDistributions || []).filter((d: any) => d.payment_status === 'paid') },
            { report_type: 'v_bookings', raw_data: vBookings },
            { report_type: 'v_expired', raw_data: (vouchers || []).filter((v: any) => v.status !== 'redeemed' && v.expiry_date && v.expiry_date < todayStr) },
            { report_type: 'v_redeemed', raw_data: (vouchers || []).filter((v: any) => v.status === 'redeemed') },
            { report_type: 'v_not_redeemed', raw_data: (vouchers || []).filter((v: any) => v.status !== 'redeemed' && (!v.expiry_date || v.expiry_date >= todayStr)) },
            { report_type: 'v_in_stock', raw_data: (vouchers || []).filter((v: any) => v.status === 'in_stock') },

            // Operations
            { report_type: 'ops_exchanges', raw_data: (invoices || []).filter((i: any) => i.exchange_value > 0) },
            { report_type: 'ops_delivery_agents', raw_data: (vDistributions || []).filter((d: any) => d.delivery_agent != null) },
            { report_type: 'ops_estimates', raw_data: estimates },
            { report_type: 'ops_repair_tickets', raw_data: repairTickets },
            { report_type: 'ops_inventory_audit', raw_data: invAuditData },

            // Production
            { report_type: 'prod_active_job_bags', raw_data: jobBags },
            { report_type: 'prod_karigar_performance', raw_data: jobBags },
            { report_type: 'prod_gold_consumption', raw_data: goldCons },
            { report_type: 'prod_diamond_consumption', raw_data: diaCons },
            { report_type: 'prod_transfer_out', raw_data: stockTransfers },
            { report_type: 'prod_transfer_in', raw_data: stockTransfers }
          ].map(snap => ({
             company_id: companyId,
             frequency: frequency,
             period_start: startISO,
             period_end: endISO,
             report_type: snap.report_type,
             raw_data: snap.raw_data || [],
             summary_metrics: { total_records: snap.raw_data?.length || 0 }
          }));

          // 7. BATCH INSERT INTO SNAPSHOTS TABLE
          const { error: snapError } = await supabaseAdmin.from('report_snapshots').insert(snapshotsToInsert);
          if (snapError) throw snapError;

          logs.push(`Successfully generated 33 ${frequency} JSON snapshots for Company ${companyId}`);
          
          // Fast-forward cron timer to run again tomorrow (or next interval)
          const nextRunDate = new Date(task.next_run_at);
          nextRunDate.setHours(nextRunDate.getHours() + (task.interval_hours || 24));
          
          while(nextRunDate < new Date()) {
            nextRunDate.setHours(nextRunDate.getHours() + (task.interval_hours || 24));
          }

          await supabaseAdmin.from('system_scheduled_tasks').update({
            last_run_at: nowISO,
            next_run_at: nextRunDate.toISOString()
          }).eq('id', task.id);
          
          tasksProcessed++;
          continue; 
        }

        // ---------------------------------------------------------
        // SEND THE MESSAGE & ADVANCE THE CRON TIMER
        // ---------------------------------------------------------
        // ---------------------------------------------------------
        // SEND THE MESSAGE & ADVANCE THE CRON TIMER
        // ---------------------------------------------------------
        if (sendVariables.length > 0) {
          
          const resolveRes = await fetch('https://www.biillojewel.co.in/api/whatsapp', {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "subscriber.createByPhone", payload: { phone: ownerPhone, name: "Admin" } }),
          });
          const resolveJson = await resolveRes.json();
          const userId = resolveJson.user_id || resolveJson.data?.user_id || resolveJson.id || ownerPhone;

          await new Promise(resolve => setTimeout(resolve, 1500));

          // ✨ Route EVERYTHING safely through your internal wrapper, passing the document details in the payload!
          const sendRes = await fetch('https://www.biillojewel.co.in/api/whatsapp', {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "message.sendDirect",
              payload: { 
                user_id: userId, 
                template_name: task.payload.template_name, 
                lang: "en", 
                namespace: "bfbb14c4_778e_453b_97c2_92f60bb9e978", 
                parameters: sendVariables,
                document_link: task.payload.document_link, // ✨ Tells wrapper to attach PDF
                document_name: task.payload.document_name  
              },
            }),
          });

          if (sendRes.ok) {
            const nextRunDate = new Date(task.next_run_at);
            nextRunDate.setHours(nextRunDate.getHours() + (task.interval_hours || 24));
            
            while(nextRunDate < new Date()) {
              nextRunDate.setHours(nextRunDate.getHours() + (task.interval_hours || 24));
            }

            await supabaseAdmin.from('system_scheduled_tasks').update({
              last_run_at: nowISO,
              next_run_at: nextRunDate.toISOString()
            }).eq('id', task.id);

            tasksProcessed++;
          } else {
             const errorBody = await sendRes.json().catch(() => ({}));
             throw new Error(`Meta/Convo360 Error: ${JSON.stringify(errorBody)}`);
          }
        }
      } catch (taskErr: any) {
        console.error(`Task ${task.task_name} failed:`, taskErr);
        logs.push(`Task ${task.task_name} failed: ${taskErr.message}`);
      }
    }
    logs.push(`Processed ${tasksProcessed} generic system tasks.`);

    // =========================================================================
    // TASK 2: MESSAGE SEQUENCES (Keep existing Rate-Limited & Batched block)
    // =========================================================================
    // ...
    
    // ✨ 1. Limit to 60 sequences per run. This ensures the loop finishes in ~1 minute, 
    // keeping you safely under Vercel's maximum execution timeout!
    const { data: sequences, error: seqError } = await supabaseAdmin
      .from('voucher_message_sequences')
      .select('*')
      .eq('status', 'active')
      .lte('next_send_at', nowISO)
      .limit(60);

    if (seqError) throw seqError;

    let seqProcessed = 0;

    for (const seq of sequences || []) {
      try {
        // ✨ 2. The Golden Rule: Pause for 1 second before EVERY message.
        // This completely eliminates the "429 Too Many Attempts" Convo360 bombardment error.
        await new Promise(resolve => setTimeout(resolve, 1000));

        const { data: voucher } = await supabaseAdmin.from('vouchers').select('status, expiry_date').eq('code', seq.voucher_code).single();

        const isExpired = voucher?.expiry_date && new Date(voucher.expiry_date).getTime() <= new Date().getTime();
        const isRedeemedOrVoided = voucher?.status === 'redeemed' || voucher?.status === 'voided';

        if (!voucher || isRedeemedOrVoided || isExpired) {
          await supabaseAdmin.from('voucher_message_sequences').update({ status: 'completed' }).eq('id', seq.id);
          continue;
        }

        const templateName = SEQUENCE_TEMPLATES[seq.current_step] || SEQUENCE_TEMPLATES[2];
        
        const convoRes = await fetch('https://www.biillojewel.co.in/api/whatsapp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'message.sendDirect',
            payload: {
              user_id: seq.convo360_user_id,
              template_name: templateName,
              lang: 'en',
              namespace: 'bfbb14c4_778e_453b_97c2_92f60bb9e978',
              parameters: [] 
            }
          })
        });

        if (convoRes.ok) {
          if (seq.current_step >= 7) {
            await supabaseAdmin.from('voucher_message_sequences').update({ status: 'completed' }).eq('id', seq.id);
          } else {
            const nextStep = seq.current_step + 1;
            const nextSendDate = new Date();
            nextSendDate.setHours(nextSendDate.getHours() + seq.interval_hours);

            await supabaseAdmin.from('voucher_message_sequences').update({
              current_step: nextStep,
              next_send_at: nextSendDate.toISOString()
            }).eq('id', seq.id);
          }
          seqProcessed++;
        }
      } catch (seqErr: any) {
        console.error(`Sequence ${seq.id} failed:`, seqErr);
      }
    }
    logs.push(`Processed ${seqProcessed} sequences successfully.`);

    return NextResponse.json({ message: 'Cron execution completed', details: logs });

  } catch (error: any) {
    console.error('Cron Execution Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}