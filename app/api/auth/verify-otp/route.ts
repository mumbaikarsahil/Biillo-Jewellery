import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const schema = z.object({
  phone: z.string(),
  otp: z.string().length(6),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { phone, otp } = schema.parse(body);

    const rawDigits = phone.replace(/\D/g, '');
    const phoneWith91 = `91${(rawDigits.startsWith('91') && rawDigits.length === 12) ? rawDigits.substring(2) : rawDigits}`;
    const phoneWithout91 = phoneWith91.substring(2);
    const companyId = process.env.PAVITRAM_COMPANY_ID;

    const { data: record, error: otpFetchError } = await supabaseAdmin
      .from('otp_verifications').select('*').eq('phone', phoneWith91).eq('is_verified', false)
      .order('created_at', { ascending: false }).limit(1).maybeSingle();

    if (otpFetchError || !record) return NextResponse.json({ error: "No active OTP request found." }, { status: 400 });
    if (new Date() > new Date(record.expires_at)) return NextResponse.json({ error: "OTP has expired." }, { status: 400 });
    
    if (record.otp_code !== otp.trim()) {
      await supabaseAdmin.from('otp_verifications').update({ attempts: record.attempts + 1 }).eq('id', record.id);
      return NextResponse.json({ error: "Invalid code." }, { status: 400 });
    }

    await supabaseAdmin.from('otp_verifications').update({ is_verified: true }).eq('id', record.id);

    let { data: customer } = await supabaseAdmin
      .from('customers').select('id, company_id, full_name, phone, email, birth_date, anniversary_date')
      .eq('company_id', companyId).or(`phone.eq.${phoneWith91},phone.eq.${phoneWithout91}`)
      .order('created_at', { ascending: false }).limit(1).maybeSingle();

    if (!customer) {
      const { data: newCustomer } = await supabaseAdmin.from('customers').insert({
        company_id: companyId, phone: phoneWith91, full_name: '', customer_status: 'Lead',
      }).select().single();
      customer = newCustomer;
    }

    return NextResponse.json({ success: true, customer });

  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}