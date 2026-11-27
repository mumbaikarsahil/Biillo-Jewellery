import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://www.biillojewel.co.in';

export async function dispatchEventMessage({
  companyId,
  customer,
  eventType,
  eventYear,
  templateName,
  templateLang = 'en',
  templateNamespace = 'bfbb14c4_778e_453b_97c2_92f60bb9e978',
  paramMapping = 'customer_name',
  modeUsed,
  triggerType,
}: {
  companyId: string;
  customer: any;
  eventType: 'birthday' | 'anniversary';
  eventYear: number;
  templateName: string;
  templateLang?: string;
  templateNamespace?: string;
  paramMapping?: string;
  modeUsed: 'auto' | 'manual';
  triggerType: 'event_month' | 'exact_day' | 'days_before';
}) {
  let phone = String(customer.phone || '').replace(/\D/g, '');
  if (phone.length === 10) phone = `91${phone}`;
  if (!phone) return { ok: false, error: 'Missing phone number' };

  const rawDate = eventType === 'birthday' ? customer.birth_date : customer.anniversary_date;
  const parsedDate = rawDate ? new Date(rawDate) : new Date();
  const formattedDate = parsedDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
  const eventMonth = parsedDate.toLocaleDateString('en-IN', { month: 'long' });

  const context: Record<string, string> = {
    customer_name: customer.full_name || 'Valued Customer',
    event_date: formattedDate,
    event_month: eventMonth,
    event_type: eventType === 'birthday' ? 'Birthday' : 'Anniversary',
  };

  const parameters = paramMapping
    ? paramMapping.split(',').map((k) => context[k.trim()] ?? k.trim()).filter(Boolean)
    : [];

  try {
    // 1. Ensure Convo360 subscriber exists
    let userId = customer.convo360_user_id || phone;
    if (!customer.convo360_user_id) {
      const subRes = await fetch(`${BASE_URL}/api/whatsapp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'subscriber.createByPhone',
          payload: { phone, name: customer.full_name || 'Customer' },
        }),
      });
      if (subRes.ok) {
        const subJson = await subRes.json();
        userId = subJson.user_id || subJson.data?.user_id || subJson.id || phone;
      }
    }

    // 2. Send WhatsApp Template
    const sendRes = await fetch(`${BASE_URL}/api/whatsapp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'message.sendDirect',
        payload: {
          user_id: userId,
          template_name: templateName,
          lang: templateLang,
          namespace: templateNamespace,
          parameters,
        },
      }),
    });

    if (!sendRes.ok) {
      const errText = await sendRes.text();
      throw new Error(errText || 'WhatsApp API failed');
    }

    // 3. Log success (prevents duplicate sends this year per trigger rule)
    await supabase.from('event_message_logs').upsert(
      {
        company_id: companyId,
        customer_id: customer.id,
        event_type: eventType,
        trigger_type: triggerType,
        event_year: eventYear,
        template_name: templateName,
        mode_used: modeUsed,
        status: 'sent',
        error_message: null,
        sent_at: new Date().toISOString(),
      },
      { onConflict: 'company_id,customer_id,event_type,trigger_type,event_year' }
    );

    return { ok: true };
  } catch (err: any) {
    await supabase.from('event_message_logs').upsert(
      {
        company_id: companyId,
        customer_id: customer.id,
        event_type: eventType,
        trigger_type: triggerType,
        event_year: eventYear,
        template_name: templateName,
        mode_used: modeUsed,
        status: 'failed',
        error_message: err?.message || 'Unknown error',
        sent_at: new Date().toISOString(),
      },
      { onConflict: 'company_id,customer_id,event_type,trigger_type,event_year' }
    );
    return { ok: false, error: err?.message };
  }
}

export async function POST(req: Request) {
  try {
    const {
      companyId,
      eventType,
      triggerType,
      customerIds,
      templateName,
      templateLang,
      templateNamespace,
      paramMapping,
    } = await req.json();

    if (!companyId || !eventType || !Array.isArray(customerIds) || customerIds.length === 0 || !templateName) {
      return NextResponse.json({ success: false, message: 'Missing required fields' }, { status: 400 });
    }

    const { data: customers, error } = await supabase
      .from('customers')
      .select('id, full_name, phone, birth_date, anniversary_date, convo360_user_id')
      .eq('company_id', companyId)
      .in('id', customerIds);

    if (error) throw error;

    const currentYear = new Date().getFullYear();
    let sent = 0;
    let failed = 0;

    for (const customer of customers || []) {
      const res = await dispatchEventMessage({
        companyId,
        customer,
        eventType,
        eventYear: currentYear,
        templateName,
        templateLang,
        templateNamespace,
        paramMapping,
        modeUsed: 'manual',
        triggerType: triggerType || 'exact_day',
      });
      if (res.ok) sent++;
      else failed++;
    }

    return NextResponse.json({ success: true, sent, failed });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}