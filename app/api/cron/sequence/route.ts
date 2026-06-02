import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient'; // Ensure you use a Service Role key if RLS blocks this

// Force Node.js runtime for API calls
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
  // 1. Security Check: Ensure only Vercel Cron can trigger this
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const now = new Date().toISOString();

    // 2. Fetch all active sequences that are due for a message
    const { data: sequences, error: seqError } = await supabase
      .from('voucher_message_sequences')
      .select('*')
      .eq('status', 'active')
      .lte('next_send_at', now);

    if (seqError) throw seqError;
    if (!sequences || sequences.length === 0) {
      return NextResponse.json({ message: 'No sequences due.' });
    }

    let processed = 0;

    // 3. Process each sequence
    for (const seq of sequences) {
      // Check voucher status to ensure we shouldn't abort
      const { data: voucher } = await supabase
        .from('vouchers')
        .select('status, expiry_date')
        .eq('code', seq.voucher_code)
        .single();

      // 🛑 KILL SWITCH 1: Is the voucher expired?
      const isExpired = voucher?.expiry_date && 
        new Date(voucher.expiry_date).getTime() <= new Date().getTime();

      // 🛑 KILL SWITCH 2: Is the voucher redeemed or voided?
      const isRedeemedOrVoided = voucher?.status === 'redeemed' || voucher?.status === 'voided';

      // If missing, redeemed, voided, or expired -> Mark completed and SKIP sending
      if (!voucher || isRedeemedOrVoided || isExpired) {
        await supabase.from('voucher_message_sequences').update({ status: 'completed' }).eq('id', seq.id);
        continue;
      }

      // 4. Send the message via Convo360
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
        // 5. Advance the sequence OR terminate it
        if (seq.current_step >= 7) {
          // 🛑 KILL SWITCH 3: Sequence reached the final message (Step 7)
          await supabase
            .from('voucher_message_sequences')
            .update({ status: 'completed' })
            .eq('id', seq.id);
        } else {
          // Advance to the next step in the sequence
          const nextStep = seq.current_step + 1;
          const nextSendDate = new Date();
          
          nextSendDate.setHours(nextSendDate.getHours() + seq.interval_hours);

          await supabase
            .from('voucher_message_sequences')
            .update({
              current_step: nextStep,
              next_send_at: nextSendDate.toISOString()
            })
            .eq('id', seq.id);
        }
          
        processed++;
      }
    }

    return NextResponse.json({ message: `Processed ${processed} sequences successfully.` });

  } catch (error: any) {
    console.error('Cron Sequence Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}