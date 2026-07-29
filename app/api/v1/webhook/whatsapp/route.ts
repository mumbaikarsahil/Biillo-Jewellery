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

    // 3. Extract pure digits and grab exactly the last 10 digits
    const rawDigits = String(phone).replace(/\D/g, '');
    const last10Digits = rawDigits.slice(-10);

    if (last10Digits.length !== 10) {
      return NextResponse.json({ error: 'Invalid phone number length' }, { status: 400 });
    }

    // Standardize saved format to start with 91 for new entries
    const cleanPhone = '91' + last10Digits;

    // 4. Extract target company context (Pass it as part of a query param or hardcode it to your core system tenant ID)
    const companyId = req.nextUrl.searchParams.get('company_id'); 
    if (!companyId) {
      return NextResponse.json({ error: 'Missing tenant context' }, { status: 400 });
    }

    // 5. Query using LIKE %last10Digits to match both "9876543210" and "919876543210" in your DB
    const { data: matchedCustomer } = await supabaseAdmin
      .from('customers')
      .select('id')
      .like('phone', `%${last10Digits}`)
      .eq('company_id', companyId)
      .limit(1)
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