import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    
    // These variables come from the Convo360 Event Form
    const { 
      convo360_user_id, 
      phone, 
      prefix, // The user types "EXPO" or "SHAHA"
      name, 
      email,  // ✨ NEW: Extract email from the webhook payload
      branch, 
      dob, 
      anniversary 
    } = body;

    if (!prefix || !phone || !name) {
      return NextResponse.json({ success: false, message: "Missing required fields" }, { status: 400 });
    }

    const cleanPrefix = prefix.toUpperCase().trim();
    const cleanPhone = phone.replace(/\D/g, '').slice(-10); // Extract 10-digit number
    const cleanName = name.trim();

    // ── 1. Claim an available event voucher via RPC ─────────────────────
    const { data: rpcData, error: rpcError } = await supabase.rpc('claim_event_voucher', {
      p_full_name: cleanName,
      p_phone: cleanPhone,
      p_prefix: cleanPrefix,
      p_branch: branch || 'Unspecified',
      p_email: email ? email.trim() : null, // ✨ NEW: Pass email to the database
      p_dob: dob || null,
      p_anniversary: anniversary || null
    });

    if (rpcError) {
      console.error("Event Claim Error:", rpcError.message);
      // Example errors: "Invalid event prefix", "No vouchers left for this event"
      return NextResponse.json({ success: false, message: rpcError.message }, { status: 400 });
    }

    // Extract the newly assigned code from the RPC output!
    const newlyAssignedCode = rpcData.voucher_code;
    const customerId = rpcData.customer_id;

    // Calculate/Format Expiry
    const expiryDate = rpcData.expiry_date ? new Date(rpcData.expiry_date) : new Date();
    if (!rpcData.expiry_date) expiryDate.setMonth(expiryDate.getMonth() + 1);
    
    const formattedExpiry = expiryDate.toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric'
    });

    // ── 2. Persist Convo360 ID to DB ────────────────────────────────────
    if (customerId && convo360_user_id) {
      await supabase
        .from('customers')
        .update({ convo360_user_id: convo360_user_id })
        .eq('id', customerId);
    }

    // ── 3. Initialize Drip Campaign ─────────────────────────────────────
    if (customerId) {
      const interval_hours = 96;
      const nextSendDate = new Date();
      nextSendDate.setHours(nextSendDate.getHours() + interval_hours);

      await supabase.from('voucher_message_sequences').insert({
        customer_id: customerId,
        voucher_code: newlyAssignedCode, // Use the generated code
        convo360_user_id: convo360_user_id,
        current_step: 2,
        interval_hours: interval_hours,
        next_send_at: nextSendDate.toISOString(),
        status: 'active'
      });
    }

    // ── 4. Trigger Final Confirmation Templates ─────────────────────────
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://www.biillojewel.co.in';
    const namespace = 'bfbb14c4_778e_453b_97c2_92f60bb9e978';

    // Fire the personalized welcome template with their NEW code
    await fetch(`${baseUrl}/api/whatsapp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'message.sendDirect',
        payload: {
          user_id: convo360_user_id,
          template_name: 'voucher_resgistration_sucess',
          lang: 'en',
          namespace: namespace,
          parameters: [cleanName, newlyAssignedCode, formattedExpiry]
        }
      })
    });

    // Fire Utility Template 8 seconds later
    setTimeout(async () => {
      await fetch(`${baseUrl}/api/whatsapp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'message.sendDirect',
          payload: {
            user_id: convo360_user_id,
            template_name: 'voucher_utility',
            lang: 'en',
            namespace: namespace,
            parameters: []
          }
        })
      });
    }, 5000);

    return NextResponse.json({ 
      success: true, 
      assigned_code: newlyAssignedCode,
      expiry_date: formattedExpiry 
    });

  } catch (err: any) {
    console.error('Event Webhook Error:', err);
    return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
  }
}