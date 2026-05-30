Paywave Express — Deployment & Webhook Steps

1) Vercel Environment Variables (add these in Project → Settings → Environment Variables):

- PAYWAVE_MERCHANT_EMAIL : brianmwichigi@gmail.com (Sensitive) — do NOT prefix with NEXT_PUBLIC_
- NEXT_PUBLIC_BASE_URL : https://lipapata.co.ke (Public) — used to build callback/webhook URLs

Notes:
- `PAYWAVE_MERCHANT_EMAIL` must match the email you registered on Paywave/OpenFloat.
- Set the scope to apply to Production (and Preview if you want preview deploys to work).

2) Add Paywave Webhook URL in Paywave Dashboard:

- Webhook URL (server-to-server): https://lipapata.co.ke/api/webhooks/paywave
- Use POST notifications. If Paywave provides a signature secret, add it and implement verification in `app/api/webhooks/paywave/route.js`.

3) Redeploy your Vercel project so server code picks up the new environment variables.

4) Quick tests

- Trigger a real payment from your frontend to create a transaction (you'll receive `reference` in the response).

- Or manually POST a test payload (replace reference):

```bash
curl -X POST https://lipapata.co.ke/api/webhooks/paywave \
  -H "Content-Type: application/json" \
  -d '{"reference":"LIPA-123456789","status":"success","transaction_id":"PWX-987654"}'
```

- Or use the included Node script:

```bash
node scripts/test-paywave-webhook.js https://lipapata.co.ke/api/webhooks/paywave LIPA-123456789
```

5) Local testing with ngrok

- Run your dev server: `npm run dev` (or your usual command).
- Expose it: `ngrok http 3000` and copy the HTTPS URL.
- In Paywave dashboard, set the webhook to `https://<your-ngrok-id>.ngrok.io/api/webhooks/paywave`.
- Run the node test script against the ngrok URL or use Paywave's dashboard test feature.

Security recommendations

- Keep `PAYWAVE_MERCHANT_EMAIL` and `PAYWAVE_API_KEY` as server-only vars (do not expose them as `NEXT_PUBLIC_`).
- Validate incoming webhook payloads: if Paywave sends an HMAC or signature header, verify it before processing.

If you'd like, I can:
- Provide code to verify a Paywave signature header in `app/api/webhooks/paywave/route.js` (if Paywave supports signatures).
- Open a PR with the `scripts/` file and `DEPLOY_PAYWAVE.md` added.
