import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// ✨ Initialize the Admin Client to bypass all RLS policies safely
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
  // 1. Security Check
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
      
      // ✨ NEW: Wrap each task in its own try/catch so one failure doesn't stop the queue!
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
      // SCENARIO B: Global Inventory Asset Registry Report (Lean Format)
      // ---------------------------------------------------------
      else if (task.task_name === 'daily_inventory_report') {
        let allItems: any[] = [];
        let isFetching = true;
        let step = 0;
        const limit = 1000;

        // Fetch ALL active inventory across ALL branches
        while (isFetching) {
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

        const locationSummary: Record<string, { count: number, value: number, categories: Record<string, number> }> = {};

        allItems.forEach(item => {
           const locName = item.warehouses?.name || 'HQ';
           
           // Ultra-short shorthand nomenclature
           let cat = item.item_category ? item.item_category.trim().toLowerCase() : 'oth';
           if (cat.includes('ladies ring')) cat = 'LR';
           else if (cat.includes('gents ring')) cat = 'GR';
           else if (cat.includes('pendant')) cat = 'Pend';
           else if (cat.includes('tops')) cat = 'Top';
           else if (cat.includes('tanmania')) cat = 'Tan';
           else if (cat.includes('bracelet')) cat = 'Brc';
           else if (cat.includes('necklace')) cat = 'Ncl';
           else if (cat.includes('nosepin') || cat.includes('nose pin')) cat = 'Nsp';
           else if (cat.includes('ring')) cat = 'Rng';
           else cat = cat.substring(0, 3).toUpperCase(); // Fallback short code

           const mrp = Number(item.mrp) || 0;

           if (!locationSummary[locName]) {
               locationSummary[locName] = { count: 0, value: 0, categories: {} };
           }
           locationSummary[locName].count += 1;
           locationSummary[locName].value += mrp;

           if (!locationSummary[locName].categories[cat]) {
               locationSummary[locName].categories[cat] = 0;
           }
           locationSummary[locName].categories[cat] += 1;
        });

        let breakdownArr: string[] = [];
        const sortedLocs = Object.entries(locationSummary).sort((a, b) => b[1].value - a[1].value);

        sortedLocs.forEach(([loc, locStats]) => {
           // Sort categories by highest quantity first
           const sortedCats = Object.entries(locStats.categories).sort((a, b) => b[1] - a[1]);
           const catDetails = sortedCats.map(([cat, qty]) => `${cat}:${qty}`);
           
           // Format: *Andheri*(191p,₹118.9L): LR:43, Pend:56, Top:35
           breakdownArr.push(`*${loc}*(${locStats.count}p,₹${(locStats.value / 100000).toFixed(1)}L): ${catDetails.join(', ')}`);
        });

        let breakdownStr = breakdownArr.join(' | ');

        // Safety fallback if it somehow exceeds limits with massive branch counts
        if (breakdownStr.length > 950) {
            breakdownStr = breakdownStr.substring(0, 930) + '... [Check Dashboard]';
        }
        if (sortedLocs.length === 0) breakdownStr = "No active inventory found.";
        
        breakdownStr = breakdownStr.replace(/\s{2,}/g, ' ').trim();

        const dateStr = new Date().toLocaleString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });

        sendVariables = [
          dateStr,                                       
          `${totalItems} pcs`,                         
          `₹${totalValue.toLocaleString('en-IN')}`,      
          breakdownStr                            
        ];

        task.payload.template_name = "erp_utility2";
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

          const sendRes = await fetch('https://www.biillojewel.co.in/api/whatsapp', {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "message.sendDirect",
              payload: { user_id: userId, template_name: task.payload.template_name, lang: "en", namespace: "bfbb14c4_778e_453b_97c2_92f60bb9e978", parameters: sendVariables },
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
             throw new Error("Failed to send WhatsApp message.");
          }
        }
      } catch (taskErr: any) {
        // ✨ NEW: Logs the specific task failure but lets the loop continue!
        console.error(`Task ${task.task_name} failed:`, taskErr);
        logs.push(`Task ${task.task_name} failed: ${taskErr.message}`);
      }
    }
    logs.push(`Processed ${tasksProcessed} generic system tasks.`);

    // =========================================================================
    // TASK 2: MESSAGE SEQUENCES
    // =========================================================================
    const { data: sequences, error: seqError } = await supabaseAdmin
      .from('voucher_message_sequences')
      .select('*')
      .eq('status', 'active')
      .lte('next_send_at', nowISO);

    if (seqError) throw seqError;

    let seqProcessed = 0;

    for (const seq of sequences || []) {
      // ✨ NEW: Wrapped each sequence dispatch in try/catch for resilience
      try {
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