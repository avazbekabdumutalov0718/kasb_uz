# WORDRUSH Telegram TASKS bot — Render service

This folder is the bot bridge; the main WORDRUSH site stays on Vercel.

## Render free web service
- Source: `https://github.com/avazbekabdumutalov0718/kasb_uz`
- Branch: `main`
- Runtime: Node
- Build command: `cd render-bot && npm install --omit=dev`
- Start command: `node render-bot/server.mjs`
- Region: Frankfurt
- Health endpoint: `/health`
- Env: `TELEGRAM_BOT_TOKEN` (new secret, never committed); `TELEGRAM_WEBHOOK_SECRET` (random 32+ character string).
- Telegram BotFather: /setmenubutton > Web App > `https://wordrush-chi.vercel.app/tasks.html?miniapp=1` (only after Telegram auth/sync is implemented).
- /start or /tasks: TASKS Mini App link. /sayt: public WORDRUSH link.

**Current phase:** The service can deploy without secrets but deliberately does NOT activate the bot or upload/send proof until the new token, channel ID, proof storage, secure login, and shared TASKS API are configured. `GET /health` reports `proofSyncReady:false` for this reason.

**Security:** The previously posted token must be revoked in @BotFather. All proof uploads and private user files require authenticated access; do not share unrestricted blob links or put tokens in client JavaScript.
