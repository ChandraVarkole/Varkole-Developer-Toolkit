# ADR-004: BYOK runtime transport

**Status:** Accepted and implemented in 0.4.0

BYOK never passes through Varkole infrastructure. The MV3 service worker calls official provider
endpoints directly for OpenAI, Anthropic, Google Gemini, and Amazon Bedrock. Provider host access is
an optional Chrome permission requested at connection time. The key and provider configuration live
only in `chrome.storage.session` after setup. The extension-owned setup form holds the typed key only
long enough to pass it to the service worker; Salesforce pages and content scripts never receive it.

Salesforce context is built locally, bounded, displayed as an exact preview, and gated by explicit
consent. Record sharing accepts only a read-only SOQL `SELECT` with at most 20 records. Provider
responses are advisory: the agent has no write tools and cannot execute Apex or mutate records or
metadata.
