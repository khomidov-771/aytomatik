# Meta / Instagram Unified Login setup

This checklist documents the application configuration; it is not proof of Meta approval or a successful live integration.

## Configuration supplied by Meta

- Product: `Instagram API (Unified Login)`
- Compatibility label: `Instagram Login Compatible`
- Configuration ID: `2331645327602552`
- Application setting: `META_LOGIN_MODE=unified`
- Application setting: `META_LOGIN_CONFIG_ID=2331645327602552`

The Configuration ID is public OAuth configuration metadata. It is safe in `.env.example`; it is not the Meta App Secret. Never put `META_APP_SECRET`, webhook secrets or access tokens in the frontend, logs or repository.

## Meta dashboard

- [ ] The correct Meta App owns configuration `2331645327602552`.
- [ ] Facebook Login for Business / Instagram API Unified Login is enabled for that app.
- [ ] Add the exact production redirect URI: `https://<domain>/api/v1/instagram/callback`.
- [ ] For local live testing, add the exact local redirect only if Meta permits it; otherwise use a trusted HTTPS tunnel and set the same URI in `META_REDIRECT_URI`.
- [ ] Add only the Instagram Professional assets needed by the test business.
- [ ] During this product’s current OAuth flow, share exactly one Business or Creator account. The backend rejects zero or multiple assigned accounts rather than choosing one silently.
- [ ] Enable the required permissions for basic account identity, comment management and Instagram messaging in this Unified Login configuration. Confirm their exact current names in the Meta dashboard before App Review.
- [ ] Configure webhook callback: `https://<domain>/api/v1/webhooks/instagram`.
- [ ] Set a strong verify token in Meta and the same value in `META_WEBHOOK_VERIFY_TOKEN`.
- [ ] Subscribe the app to supported `comments`, `messages` and `messaging_postbacks` fields. The OAuth callback also calls `/{ig-id}/subscribed_apps` for the selected account and refuses to save the connection if subscription is not confirmed.
- [ ] Add approved test users/businesses and a real Instagram Professional test account.
- [ ] Complete the required App Review / Advanced Access before onboarding external customers.
- [ ] Publish reachable privacy policy, terms and data-deletion instructions, and prepare Meta’s requested screencast.

## Production environment

```dotenv
INSTAGRAM_PROVIDER=meta
META_APP_ID=<meta-app-id>
META_APP_SECRET=<server-only-app-secret>
META_API_VERSION=<currently-supported-version>
META_LOGIN_MODE=unified
META_LOGIN_CONFIG_ID=2331645327602552
META_REDIRECT_URI=https://<domain>/api/v1/instagram/callback
META_WEBHOOK_VERIFY_TOKEN=<random-server-only-token>
META_WEBHOOK_APP_SECRET=<server-only-signature-secret>
```

`META_REDIRECT_URI` must match Meta character-for-character. Production startup refuses an incomplete real-provider configuration.

## Implemented server flow

1. Generate a single-use, ten-minute OAuth state bound to the user and workspace.
2. Open `https://www.facebook.com/dialog/oauth` with the Meta App ID, supplied Configuration ID, redirect URI and state.
3. Exchange the authorization code through the versioned Facebook Graph API.
4. Page through the assigned Instagram accounts with cursor-loop and 100-page safety guards.
5. Require exactly one shared Professional account and subscribe its webhook fields.
6. Encrypt the access token with AES-256-GCM before storage; never return it from an API response.
7. Resolve signed webhook events through the active `(provider, instagram_user_id)` mapping.
8. Send allowed private replies and manual messages through versioned `graph.facebook.com` endpoints in Unified Login mode.

## Live acceptance check — still required

- [ ] OAuth finishes with one permitted Professional account.
- [ ] Denied access, invalid state, zero assets and multiple assets fail safely.
- [ ] The stored token is encrypted and is absent from frontend responses and logs.
- [ ] Meta accepts `subscribed_apps` and sends signed comment/message webhook samples.
- [ ] Invalid signatures and duplicate event IDs are rejected/idempotent.
- [ ] One policy-eligible comment receives exactly one private reply.
- [ ] One inbound DM opens the server-enforced 24-hour manual reply window.
- [ ] Expired/revoked tokens, rate limits and permission failures surface as reconnect/operator errors without blind resend.

Real Meta verification is currently **NOT TESTED live**: App ID/App Secret, approved account and App Review evidence were not supplied. Controlled Unified provider tests pass, but they are not external verification. Do not label the integration live-verified until every acceptance item has recorded evidence.
