const fs = require('fs');
const https = require('https');

function fetchJson(url, options, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { resolve(data); }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

const env = fs.readFileSync('.env.local', 'utf8').split('\n').reduce((acc, line) => {
  const [k, ...v] = line.split('=');
  if (k && v) acc[k.trim()] = v.join('=').trim().replace(/^['"]|['"]$/g, '');
  return acc;
}, {});

async function run() {
  const apiKey = env.PAYWAVE_API_KEY;
  console.log('API Key present:', !!apiKey);
  const email = 'test@example.com';
  const phone = '254759221095';
  const reference = 'LIPA-TEST-' + Date.now();
  
  const payload = {
    api_key: apiKey,
    email: env.PAYWAVE_MERCHANT_EMAIL || email,
    amount: '1',
    msisdn: phone,
    reference: reference
  };
  
  console.log('Initiating STK Push...');
  const data = await fetchJson('https://paywavexpress.co.ke/v1/stkpush', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey }
  }, payload);
  
  console.log('STK push response:', data);
  
  if (data.transaction_request_id || data.id || data.TransactionId) {
    const txReqId = data.transaction_request_id || data.id || data.TransactionId;
    console.log('Waiting 10s before status check...');
    await new Promise(r => setTimeout(r, 10000));
    
    console.log('Checking status for', txReqId);
    const statusPayload = {
      api_key: apiKey,
      email: env.PAYWAVE_MERCHANT_EMAIL || email,
      transaction_request_id: txReqId
    };
    const sData = await fetchJson('https://paywavexpress.co.ke/v1/tstatus', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey }
    }, statusPayload);
    
    console.log('Raw tstatus response:', JSON.stringify(sData, null, 2));
  }
}
run().catch(console.error);
