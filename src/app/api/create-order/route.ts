import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const { default: Razorpay } = await import('razorpay');
    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID || '',
      key_secret: process.env.RAZORPAY_KEY_SECRET || '',
    });

    const authHeader = req.headers.get('authorization');
    if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await getSupabaseAdmin().auth.getUser(token);
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { roomName, durationHours } = await req.json();
    if (!roomName || typeof roomName !== 'string') {
      return NextResponse.json({ error: 'Room name is required' }, { status: 400 });
    }
    if (!durationHours || durationHours < 1 || durationHours > 24) {
      return NextResponse.json({ error: 'Duration must be 1-24 hours' }, { status: 400 });
    }

    const sanitizedName = roomName.trim().toUpperCase().replace(/[<>"&]/g, '').substring(0, 10);
    if (sanitizedName.length < 2) {
      return NextResponse.json({ error: 'Room name must be at least 2 characters' }, { status: 400 });
    }

    const amountPaise = durationHours * 5 * 100;

    const order = await razorpay.orders.create({
      amount: amountPaise,
      currency: 'INR',
      receipt: `room_${sanitizedName}_${Date.now()}`,
    });

    const { error: insertError } = await getSupabaseAdmin().from('room_purchases').insert({
      user_id: user.id,
      room_name: sanitizedName,
      duration_hours: durationHours,
      amount_paid: amountPaise,
      payment_status: 'pending',
      razorpay_order_id: order.id,
    });

    if (insertError) {
      return NextResponse.json({ error: 'Failed to create purchase record' }, { status: 500 });
    }

    return NextResponse.json({
      orderId: order.id,
      amount: amountPaise,
      currency: 'INR',
      key: process.env.RAZORPAY_KEY_ID,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
