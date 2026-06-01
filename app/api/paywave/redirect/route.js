import { NextResponse } from 'next/server';

const PAYWAVE_PAYMENT_URL = process.env.PAYWAVE_PAYMENT_URL || 'https://paywavexpress.co.ke/pay/lipapata';
const PAYWAVE_API_KEY = process.env.PAYWAVE_API_KEY;
const PAYWAVE_MERCHANT_EMAIL = process.env.PAYWAVE_MERCHANT_EMAIL;
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXTAUTH_URL || process.env.VERCEL_URL || '';

export async function POST(request) {
  try {
    if (!PAYWAVE_API_KEY || !PAYWAVE_MERCHANT_EMAIL) {
      return NextResponse.json({ error: 'Server misconfiguration: missing Paywave credentials' }, { status: 500 });
    }

    const body = await request.json();
    const {
      amount,
      reference,
      phoneNumber,
      customerEmail,
      description,
      callbackUrl,
    } = body || {};

    if (!amount || !reference) {
      return NextResponse.json({ error: 'Missing required fields: amount and reference' }, { status: 400 });
    }

    const callback = callbackUrl || (BASE_URL ? `${BASE_URL.replace(/\/$/, '')}/api/webhooks/paywave` : '');

    const params = new URLSearchParams({
      api_key: PAYWAVE_API_KEY,
      amount: Math.round(amount),
      email: PAYWAVE_MERCHANT_EMAIL,
      customer_email: customerEmail || '',
      phone: phoneNumber || '',
      reference: reference,
      desc: description || 'Lipapata Digital Content',
      callback: callback,
    });

    const redirectUrl = `${PAYWAVE_PAYMENT_URL}?${params.toString()}`;
    return NextResponse.redirect(redirectUrl);
  } catch (err) {
    console.error('paywave redirect error', err);
    return NextResponse.json({ error: 'Failed to build redirect URL' }, { status: 500 });
  }
}

export async function GET(request) {
  // Optional: allow simple GET with query params for quick testing
  const url = new URL(request.url);
  const amount = url.searchParams.get('amount');
  const reference = url.searchParams.get('reference');
  const phoneNumber = url.searchParams.get('phone');
  const customerEmail = url.searchParams.get('customer_email');
  const description = url.searchParams.get('desc');
  const callbackUrl = url.searchParams.get('callback');

  if (!amount || !reference) {
    return NextResponse.json({ error: 'Missing amount or reference' }, { status: 400 });
  }

  const params = new URLSearchParams({
    api_key: PAYWAVE_API_KEY || '',
    amount: Math.round(Number(amount)),
    email: PAYWAVE_MERCHANT_EMAIL || '',
    customer_email: customerEmail || '',
    phone: phoneNumber || '',
    reference: reference,
    desc: description || 'Lipapata Digital Content',
    callback: callbackUrl || ''
  });

  const redirectUrl = `${PAYWAVE_PAYMENT_URL}?${params.toString()}`;
  return NextResponse.redirect(redirectUrl);
}
