// Simple script to POST a test Paywave webhook payload
// Usage: node scripts/test-paywave-webhook.js <webhookUrl> <reference>
// Example: node scripts/test-paywave-webhook.js https://lipapata.co.ke/api/webhooks/paywave LIPA-12345

const [,, webhookUrl, reference = `LIPA-${Date.now()}`] = process.argv;

if (!webhookUrl) {
  console.error('Usage: node scripts/test-paywave-webhook.js <webhookUrl> <reference>');
  process.exit(1);
}

const payload = {
  reference,
  status: 'success',
  transaction_id: `PWX-${Math.random().toString(36).slice(2, 10).toUpperCase()}`,
};

async function run() {
  // Use builtin fetch on Node 18+, otherwise ask the user to install node-fetch
  let fetchFn = globalThis.fetch;
  if (!fetchFn) {
    try {
      fetchFn = (await import('node-fetch')).default;
    } catch (err) {
      console.error('Node fetch not available. Run with Node 18+ or `npm install node-fetch`');
      process.exit(1);
    }
  }

  try {
    const res = await fetchFn(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const text = await res.text();
    console.log('Status:', res.status);
    console.log('Response body:', text);
  } catch (err) {
    console.error('Request failed:', err);
    process.exit(1);
  }
}

run();
