import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Use service role key ONLY if you need to bypass client-side RLS limits for background automation
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! 
);

export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate the third-party server
    const apiKey = req.headers.get('x-api-key');

    if (!apiKey || apiKey !== process.env.THIRD_PARTY_WEBHOOK_SECRET) {
      return NextResponse.json({ error: 'Unauthorized credentials' }, { status: 401 });
    }

    // 2. Parse incoming payload fields
    const body = await req.json();
    const { userid, phone, message, workflow, event_time } = body;

    if (!phone || !userid) {
      return NextResponse.json({ error: 'Missing mandatory fields: userid and phone' }, { status: 400 });
    }

    // 3. Clean and normalize the phone number (Strip spaces, country code checks)
    let cleanPhone = String(phone).replace(/\D/g, '');
    if (cleanPhone.length === 10) {
      cleanPhone = '91' + cleanPhone; // Default to India prefix if pure 10 digit
    }

    // 4. Extract target company context (Pass it as part of a query param or hardcode it to your core system tenant ID)
    const companyId = req.nextUrl.searchParams.get('company_id'); 
    if (!companyId) {
      return NextResponse.json({ error: 'Missing tenant context' }, { status: 400 });
    }

    // 5. Query if the customer already exists in your CRM using the phone index
    const { data: matchedCustomer } = await supabaseAdmin
      .from('customers')
      .select('id')
      .eq('phone', cleanPhone)
      .eq('company_id', companyId)
      .maybeSingle();

    // 6. Write the payload directly to your events ledger table
    const { error: insertError } = await supabaseAdmin
      .from('crm_webhook_events')
      .insert({
        company_id: companyId,
        third_party_user_id: String(userid),
        phone: cleanPhone,
        message: message || null,
        workflow: workflow || null,
        event_time: event_time ? new Date(event_time).toISOString() : new Date().toISOString(),
        matched_customer_id: matchedCustomer?.id || null,
        processed_status: matchedCustomer ? 'mapped' : 'pending',
        raw_payload: body
      });

    if (insertError) throw insertError;

    // 7. Return immediate speed response to stop their server from timing out
    return NextResponse.json({ 
      success: true, 
      status: matchedCustomer ? 'mapped_to_crm' : 'logged_for_review',
      matched_id: matchedCustomer?.id || null
    }, { status: 200 });

  } catch (err: any) {
    console.error('Webhook processing failure:', err);
    return NextResponse.json({ error: 'Internal Server Processing Error', details: err.message }, { status: 500 });
  }
}