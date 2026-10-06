import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const schema = z.object({ phone: z.string() });

function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return req.headers.get('x-real-ip') || '127.0.0.1';
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { phone } = schema.parse(body);
    const clientIp = getClientIp(req);

    // 1. Normalize phone
    const rawDigits = phone.replace(/\D/g, '');
    const basePhone = (rawDigits.startsWith('91') && rawDigits.length === 12) 
      ? rawDigits.substring(2) 
      : rawDigits;
    const formattedPhone = `91${basePhone}`;

    if (basePhone.length !== 10) {
      return NextResponse.json({ error: "Invalid mobile number. Please enter a valid 10-digit number." }, { status: 400 });
    }

    const now = new Date();
    const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000).toISOString();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const oneMinuteAgo = new Date(now.getTime() - 60 * 1000).toISOString();

    // 🛡️ ANTI-FRAUD LAYER 1: IP Rate Limit (Max 3 OTPs / 10 mins per IP)
    const { count: ipRecentRequests } = await supabaseAdmin
      .from('otp_rate_limits')
      .select('id', { count: 'exact', head: true })
      .eq('ip_address', clientIp)
      .gte('created_at', tenMinutesAgo);

    if (ipRecentRequests && ipRecentRequests >= 3) {
      return NextResponse.json({ error: "Too many verification attempts from this network. Please wait 10 minutes." }, { status: 429 });
    }

    // 🛡️ ANTI-FRAUD LAYER 2: IP 24-Hour Cap (Max 12 OTPs / 24 hours per IP)
    const { count: ipDailyRequests } = await supabaseAdmin
      .from('otp_rate_limits')
      .select('id', { count: 'exact', head: true })
      .eq('ip_address', clientIp)
      .gte('created_at', oneDayAgo);

    if (ipDailyRequests && ipDailyRequests >= 12) {
      return NextResponse.json({ error: "Daily verification limit reached for this device. Please try again tomorrow." }, { status: 429 });
    }

    // 🛡️ ANTI-FRAUD LAYER 3: Phone 60-Second Cooldown
    const { data: recentOtp } = await supabaseAdmin
      .from('otp_verifications')
      .select('created_at')
      .eq('phone', formattedPhone)
      .gte('created_at', oneMinuteAgo)
      .maybeSingle();

    if (recentOtp) return NextResponse.json({ error: "Please wait 60 seconds before requesting a new code." }, { status: 429 });

    // 🛡️ ANTI-FRAUD LAYER 4: Phone 24-Hour Cap (Max 5 requests per number)
    const { count: dailyPhoneRequests } = await supabaseAdmin
      .from('otp_verifications')
      .select('id', { count: 'exact', head: true })
      .eq('phone', formattedPhone)
      .gte('created_at', oneDayAgo);

    if (dailyPhoneRequests && dailyPhoneRequests >= 5) {
      return NextResponse.json({ error: "Maximum daily OTP requests reached for this number. Try again tomorrow." }, { status: 429 });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(now.getTime() + 5 * 60 * 1000).toISOString();

    // Log IP usage for toll fraud protection
    await supabaseAdmin.from('otp_rate_limits').insert({
      ip_address: clientIp,
      phone: formattedPhone
    });

    // Invalidate prior pending OTPs
    await supabaseAdmin.from('otp_verifications').delete().eq('phone', formattedPhone);

    // Save active OTP
    const { error: dbError } = await supabaseAdmin.from('otp_verifications').insert({
      phone: formattedPhone,
      otp_code: otp,
      expires_at: expiresAt,
    });

    if (dbError) throw new Error("Database error while generating OTP.");

    // Dispatch WhatsApp template via your internal API or external provider
    const baseUrl = req.nextUrl.origin;
    const waRes = await fetch(`${baseUrl}/api/whatsapp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'message.sendDirect',
        payload: {
          user_id: formattedPhone,
          template_name: 'otp_verification',
          lang: 'en',
          namespace: 'bfbb14c4_778e_453b_97c2_92f60bb9e978',
          parameters: [otp],
          button_parameters: [otp]
        }
      })
    });

    if (!waRes.ok) {
      const errData = await waRes.json().catch(() => ({}));
      return NextResponse.json({ error: errData.message || "Failed to deliver WhatsApp verification code." }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: "Verification code sent to your WhatsApp." });

  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}