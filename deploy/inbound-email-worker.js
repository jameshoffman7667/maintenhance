// Cloudflare Email Worker for MaintEnhance (v2.9): sends each message that arrives
// at the request address (for example requests@hoffmanhouse.ca) to the app.
//
// Setup (Cloudflare dashboard, once):
//  1. Email > Email Routing: turn it on for the domain (adds the MX records; only
//     do this when the domain has no other inbound mail).
//  2. Workers & Pages > Create > Worker: paste this file, then Deploy.
//  3. The Worker's Settings > Variables and Secrets:
//       APP_URL         (text)    https://<your-app-hostname>   no trailing slash
//       INBOUND_SECRET  (secret)  the same value as INBOUND_EMAIL_SECRET in the app's stack .env
//  4. Email > Email Routing > Routing rules: Custom address requests@<domain>
//     -> Action "Send to a Worker" -> choose this Worker.
// The app must be reachable at APP_URL from the internet (the Cloudflare Tunnel hostname).
// Cloudflare Access, if used on that hostname, needs a Bypass policy for /api/inbound/email;
// the shared secret protects the route.
export default {
  async email(message, env) {
    if (message.rawSize > 10 * 1024 * 1024) {
      message.setReject("This message is too large (10 MB limit).");
      return;
    }
    const raw = await new Response(message.raw).arrayBuffer();
    let res;
    try {
      res = await fetch(String(env.APP_URL).replace(/\/+$/, "") + "/api/inbound/email", {
        method: "POST",
        headers: {
          "Content-Type": "message/rfc822",
          "X-Inbound-Secret": env.INBOUND_SECRET,
          "X-Envelope-From": message.from,
        },
        body: raw,
      });
    } catch (e) {
      message.setReject("The maintenance app could not be reached. Please try again later.");
      return;
    }
    // 200 covers accepted, duplicate and "sender not allowed" (dropped quietly on purpose).
    if (!res.ok) message.setReject("The maintenance app could not accept this message.");
  },
};
