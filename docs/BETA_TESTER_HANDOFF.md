# Varkole private beta tester handoff

## What the owner shares

Share only the versioned beta ZIP through a private file-sharing channel. Do not share Salesforce
credentials, session cookies, OAuth tokens, provider API keys, `.env` files, or source directories
that may contain local configuration.

## First-time installation

1. Download the ZIP and extract it to a permanent folder. Do not run the extension from inside the
   ZIP.
2. Open `chrome://extensions` in Google Chrome.
3. Enable **Developer mode**.
4. Select **Load unpacked**.
5. Select the extracted folder that directly contains `manifest.json`.
6. Pin **Varkole Developer Toolkit BETA** from Chrome's Extensions menu.
7. Open Salesforce and sign in normally with your own account.
8. Refresh the Salesforce tab once, then click the Varkole toolbar icon.

Varkole uses the tester's current Salesforce session and effective Salesforce permissions. It does
not require or accept a separate Varkole login.

## Installing an updated beta ZIP

Keep the same permanent extension folder. Extract the new ZIP and replace the old files in that
folder, then select **Reload** for Varkole on `chrome://extensions` and refresh open Salesforce tabs.
Loading each version from a different path can create a separate unpacked extension installation and
reset extension-scoped settings.

## AI Agent testing

Each tester supplies their own supported AI-provider key. Keys remain in temporary Chrome session
storage and must never be sent to the extension owner. Before Salesforce context is shared, verify
that Varkole displays the provider-specific consent disclosure.

## Reporting a problem

Include:

- Varkole version, Chrome version, and operating system.
- Salesforce environment type and page URL with record IDs or sensitive query parameters removed.
- Steps to reproduce and the expected versus observed result.
- A screenshot with customer, user, record, session, and API-key information redacted.
- **Settings → Developer diagnostics** output when available; review it before sharing.

Never include passwords, session IDs, OAuth tokens, API keys, complete debug logs, or Salesforce
record values in a bug report.

## Removal

Select **Remove** for Varkole on `chrome://extensions`, then delete the extracted folder and ZIP.
