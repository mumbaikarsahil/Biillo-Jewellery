import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Use the Service Role Key to bypass Row Level Security (RLS) 
// because webhooks do not have an active browser user session.
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    
    // These variables must match the JSON keys you send from Convo360
    const { 
      convo360_user_id, 
      phone, 
      code, 
      name, 
      email, // ✨ NEW: Extract email from the webhook payload
      branch, 
      dob, 
      anniversary 
    } = body;

    if (!code || !phone || !name) {
      return NextResponse.json({ success: false, message: "Missing required fields" }, { status: 400 });
    }

    const cleanCode = code.toUpperCase().trim();
    const cleanPhone = phone.replace(/\D/g, '').slice(-10); // Extract last 10 digits

    // ── 1. Register voucher via stored procedure ──────────────────────
    const { data: rpcData, error: rpcError } = await supabase.rpc('register_voucher_public', {
      p_code: cleanCode,
      p_name: name,
      p_phone: cleanPhone,
      p_branch: branch,
      p_email: email ? email.trim() : null, // ✨ NEW: Pass email to the database
      p_dob: dob,
      p_anniversary: anniversary || null
    });

    if (rpcError) {
      console.error("Voucher Registration Error:", rpcError.message);
      return NextResponse.json({ success: false, message: rpcError.message }, { status: 400 });
    }

    // ── 2. Fetch fresh expiry date ──────────────────────────────────────
    const { data: updatedVoucher } = await supabase
      .from('vouchers')
      .select('expiry_date')
      .eq('code', cleanCode)
      .single();

    const expiryDate = updatedVoucher?.expiry_date ? new Date(updatedVoucher.expiry_date) : new Date();
    if (!updatedVoucher?.expiry_date) expiryDate.setMonth(expiryDate.getMonth() + 1);

    const formattedExpiry = expiryDate.toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric'
    });

    // ── 3. Persist Convo360 ID to DB ────────────────────────────────────
    const customerId = rpcData?.customer_id;
    if (customerId && convo360_user_id) {
      await supabase
        .from('customers')
        .update({ convo360_user_id: convo360_user_id })
        .eq('id', customerId);
    }

    // ── 4. Initialize Drip Campaign ─────────────────────────────────────
    if (customerId) {
      const interval_hours = 96;
      const nextSendDate = new Date();
      nextSendDate.setHours(nextSendDate.getHours() + interval_hours);

      await supabase.from('voucher_message_sequences').insert({
        customer_id: customerId,
        voucher_code: cleanCode,
        convo360_user_id: convo360_user_id,
        current_step: 2,
        interval_hours: interval_hours,
        next_send_at: nextSendDate.toISOString(),
        status: 'active'
      });
    }

    // ── 5. Trigger Final Confirmation Templates ─────────────────────────
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://www.biillojewel.co.in';
    const namespace = 'bfbb14c4_778e_453b_97c2_92f60bb9e978';

    // Fire the personalized welcome template
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
          parameters: [name, cleanCode, formattedExpiry]
        }
      })
    });

    // Wait 5 seconds, then fire the utility template
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

    // Return success to Convo360 so it moves to the next node in the visual builder
    return NextResponse.json({ 
      success: true, 
      voucher_code: cleanCode,
      expiry_date: formattedExpiry 
    });

  } catch (err: any) {
    console.error('Webhook Error:', err);
    return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
  }
}