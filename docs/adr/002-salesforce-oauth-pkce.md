# ADR-002: Browser session first, OAuth PKCE fallback

**Status:** Accepted

Default to the active Salesforce tab's authenticated `sid`, read by the MV3 service worker using Chrome's cookies API and Salesforce-only host permissions. Match the cookie's org ID to an API-capable My Domain cookie and use it only for local Salesforce API requests. Never expose or persist the value.

When Salesforce API Access Control rejects that session, offer Authorization Code + S256 PKCE through `chrome.identity.launchWebAuthFlow`. The consumer key is public configuration; no client secret ships. OAuth state, exact redirect origin/path, HTTPS, and Salesforce host suffixes are validated.
