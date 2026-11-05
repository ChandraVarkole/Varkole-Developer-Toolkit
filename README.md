# Varkole Developer Toolkit

Phase 0 plus the first Phase 1 vertical slice of a Salesforce developer-toolkit Chrome extension. The extension automatically uses the authenticated user session from the active Salesforce tab, matching the Salesforce Inspector interaction model. OAuth 2.0 Authorization Code + PKCE is an optional fallback for orgs with API Access Control.

## Prerequisites

- Node.js 22 or newer
- Chrome 114 or newer (Side Panel API)
- A Salesforce sandbox or Developer Edition org with API access
- A signed-in Salesforce tab
- Optional: a Salesforce External Client App consumer key for the OAuth fallback

## Local setup

```bash
npm install
npm run verify
```

An `.env` file is not required for normal browser-session use. To enable the OAuth fallback, copy `.env.example` to `.env` and set `VITE_SALESFORCE_CLIENT_ID` to the public consumer key. No client secret belongs in this repository or extension.

Load `apps/extension/dist` from `chrome://extensions` using **Load unpacked**. Pin the extension,
open a signed-in Salesforce tab, refresh that tab once after installation, and click Varkole. A
compact right-side drawer with vertical navigation opens over Salesforce and immediately uses the
current user's existing access. On a Salesforce record page it opens Record Inspector and loads the
current record automatically. The left-edge chevron hides the drawer, the small Varkole launcher
restores it, and the expand control offers the secondary full-page workspace.

## Optional Salesforce External Client App registration

1. Build/load the unpacked extension once and copy the redirect URL shown on its connection screen. It has the form `https://<extension-id>.chromiumapp.org/salesforce`.
2. In Salesforce Setup, open **External Client Apps Manager** and create an External Client App.
3. Enable OAuth. Add the exact redirect URL from step 1.
4. Enable Authorization Code and PKCE for a public client; do not require or embed a client secret.
5. Grant the minimum scopes required for this slice: `api`, `refresh_token`, and `openid` (Salesforce may display `refresh_token` as “Perform requests at any time”).
6. Configure permitted users/admin pre-authorization according to your org policy and assign only authorized test users.
7. Put the consumer key in `.env`, rebuild, and reload the extension.

Salesforce policy names can vary by release. This setup is unnecessary unless your org blocks API use of the browser session or you choose the explicit OAuth connection.

## Security model in this phase

- The normal path reads the active Salesforce `sid` cookie only when needed; its value is not persisted by Varkole.
- The in-page drawer runs inside an extension-owned iframe; the Salesforce page cannot read its UI or credentials.
- The extension declares `cookies` plus Salesforce-only host permissions. It cannot read cookies from unrelated sites.
- OAuth fallback access and refresh tokens live only in `chrome.storage.session`, never sync/local storage.
- Persistent local data contains org/user IDs, labels, environment, username, instance URL, and up
  to 50 successful SOQL history entries per org—no tokens or query results.
- OAuth state and redirect URI are validated; PKCE uses SHA-256.
- Only allowlisted HTTPS Salesforce host suffixes are accepted.
- UI pages request operations through the service worker and never receive access tokens.
- AI Agent supports provider-direct BYOK for OpenAI, Anthropic, Gemini, and Bedrock. Provider host
  access is optional and requested only when connecting. Keys use `chrome.storage.session` by
  default. The optional eight-hour convenience setting temporarily persists the key in this Chrome
  profile and must not be used on a shared or untrusted device.
- When the user asks a question, AI Agent automatically retrieves a bounded set of accessible
  Salesforce metadata and records and sends that context directly to the selected provider. Varkole
  has no hosted service in that path. The agent has no Salesforce write or Apex-execution tools.

## Commands

```bash
npm run dev
npm run format
npm run lint
npm run typecheck
npm test
npm run build
npm run verify
```

## Known Phase 1 limitations

- Browser-session discovery and API use still require manual testing in a real signed-in Salesforce org.
- Existing Salesforce tabs must be refreshed once after installing or updating the unpacked extension so the content script is present.
- Records includes guided object browsing, record-ID inference, and detailed read-only field
  inspection. Record writes remain disabled until the guarded Phase 2 workflow is implemented.
- Orgs with API Access Control can require the optional OAuth fallback and External Client App.
- Chrome is the tested target; Edge/Firefox adapters are not yet verified.
- Public Chrome Web Store release remains blocked on the items in
  [docs/CHROME_WEB_STORE_RELEASE.md](docs/CHROME_WEB_STORE_RELEASE.md).

See [docs/PHASE_1_ACCEPTANCE.md](docs/PHASE_1_ACCEPTANCE.md) for exact status.
