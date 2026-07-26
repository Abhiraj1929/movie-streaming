import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import crypto from 'crypto';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = await req.json();

    const secret = process.env.RAZORPAY_KEY_SECRET || '';
    const expectedSign = crypto
      .createHmac('sha256', secret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (expectedSign !== razorpay_signature) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    const { data: purchase, error: fetchError } = await supabaseAdmin
      .from('room_purchases')
      .select('id, duration_hours')
      .eq('razorpay_order_id', razorpay_order_id)
      .eq('user_id', user.id)
      .single();

    if (fetchError || !purchase) {
      return NextResponse.json({ error: 'Purchase not found' }, { status: 404 });
    }

    const expiresAt = new Date(Date.now() + purchase.duration_hours * 60 * 60 * 1000).toISOString();

    const { error: updateError } = await supabaseAdmin
      .from('room_purchases')
      .update({
        payment_status: 'completed',
        razorpay_payment_id,
        razorpay_signature,
        expires_at: expiresAt,
      })
      .eq('id', purchase.id);

    if (updateError) {
      return NextResponse.json({ error: 'Failed to update purchase' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      purchaseId: purchase.id,
      expiresAt,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
