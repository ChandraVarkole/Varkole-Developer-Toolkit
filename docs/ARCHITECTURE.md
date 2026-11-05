# Architecture

## Phase 1 scope

The repository contains a Chrome Manifest V3 extension and small framework-neutral TypeScript packages. The extension is the entire runtime; free Salesforce utilities have no dependency on a Varkole account or hosted backend.

```text
Salesforce content script → extension-owned drawer iframe
Popup / Full Workspace / Side Panel (React, no UI framework)
                    |
          typed chrome.runtime messages
                    |
          MV3 extension service worker
           |                      |
 live Salesforce `sid`       chrome.storage.local
 cookie or OAuth fallback    non-secret org metadata
           |
 Salesforce REST / Tooling API
```

## Trust boundaries

1. The content script only creates/toggles an isolated extension iframe and never reads Salesforce page content. UI pages are extension-owned and do not receive session IDs or OAuth tokens.
2. The service worker matches the active tab's `sid` to the correct org and API-capable Salesforce domain. OAuth state/PKCE validation applies only to the fallback.
3. Salesforce remains the authorization authority. The extension does not elevate or bypass CRUD, FLS, sharing, API, or Tooling permissions.
4. No Varkole backend is in the Phase 1 data path.

## Packages

- `apps/extension`: manifest, UI surfaces, and privileged service worker.
- `packages/shared`: message contracts, org identity, query and error types.
- `packages/salesforce-client`: host validation, OAuth helpers, abortable REST transport, REST and Tooling clients.

## Request lifecycle

Clicking the toolbar icon messages the Salesforce content script, which toggles a fixed right-side iframe running `workspace.html?embedded=1`. The embedded workspace uses compact horizontal navigation and can close itself through a narrowly scoped parent-window message. The service worker reads the tab's `sid`, matches its organization ID to the API-capable My Domain cookie, and retrieves the current user identity. Missing service-worker session pointers are reconstructed from non-secret org/instance metadata and the live cookie. If browser-session API use is blocked, the user can explicitly use OAuth PKCE.

## Lightweight budget

Only React/React DOM are runtime dependencies. There is no UI kit, router, editor, state framework, table framework, analytics SDK, content script, or backend client. Large future modules must be lazy-loaded. The Phase 1 build reports its actual bundle sizes during `npm run build`.

## ADRs

- [ADR-001: MV3 and UI framework](adr/001-mv3-react-vite.md)
- [ADR-002: Salesforce OAuth PKCE](adr/002-salesforce-oauth-pkce.md)
- [ADR-003: Session-only token storage](adr/003-session-token-storage.md)
- [ADR-004: BYOK transport boundary](adr/004-byok-transport.md)
- [ADR-005: Managed backend tenancy](adr/005-managed-tenancy.md)
