# Testing

## Automated Phase 1 checks

- `npm run format`: repository formatting.
- `npm run lint`: type-aware ESLint.
- `npm run typecheck`: strict project-reference TypeScript.
- `npm test`: host allowlist, OAuth callback/state, cross-org pagination and error mapping.
- `npm run build`: production MV3 bundle and manifest/assets.

## Manual sandbox acceptance

1. Reload the unpacked extension, refresh the Salesforce tab once, and click Varkole; confirm a right-side drawer opens without navigating away.
2. Close and reopen it using both the drawer close control and floating Varkole launcher.
3. Confirm the org appears without any Varkole login or OAuth prompt, then verify the selected `sid` is not persisted or exposed.
4. Run a valid REST query, an empty query, invalid field query, relationship query, and a query over 2,000 rows; page once and Stop a slow request.
5. Run a valid and unauthorized Tooling query.
6. Open Org Info and compare organization ID/name/environment/API version and limits with Salesforce.
7. Connect a second org/user and switch repeatedly; verify no data/result/token crosses org boundaries.
8. Suspend/restart the MV3 service worker and verify the live browser session is recovered without reconnecting.
9. Disconnect a browser-session org and verify Salesforce itself stays signed in. Separately verify OAuth fallback revocation.
10. Enable API Access Control and confirm Varkole offers the OAuth fallback rather than repeatedly prompting or silently failing.
11. In SOQL, type an object API name, verify live field suggestions, select fields, build the query and run it.
12. In Records, test a standard object, custom object and 15/18-character record ID; verify inaccessible fields return a Salesforce permission error.
13. In Export, preview a query and download CSV/JSON; verify relationship fields are flattened, CSV quotes are escaped and formula-like values are prefixed safely.
14. Open Logs, Coverage, Users, Access, Metadata and App Tabs; verify supported pages load and insufficient permissions are reported without crashing.
15. Open Settings → Developer diagnostics, copy the safe context, then inspect the Varkole frame and verify source maps and `services/data` Network requests.
16. In a sandbox, run benign anonymous Apex, a compile error and a runtime exception. In Production, verify acknowledgement and exact typed confirmation are both required; do not test production writes.
17. In Import Preview, test quoted commas/newlines, duplicate headers, uneven rows and unmapped fields. Confirm no Salesforce network request is made.
18. Connect every supported AI provider with a test key; verify optional host permission denial,
    invalid key, invalid model, quota/rate-limit, offline, and successful responses.
19. Ask AI questions that require schema, records, permissions, follow-ups, and lists over 20 rows.
    Verify Salesforce access is respected, transmitted context is bounded, responses are formatted,
    and no chat or query result is persisted.
20. Verify provider keys exist only in session storage, are removed by Forget key and extension
    reload, and cannot be read by content scripts. Upgrade from v0.6.4 and verify any legacy locally
    remembered key is deleted.
21. Connect each provider and verify no Salesforce context is sent before the provider-specific
    disclosure is affirmatively approved. Verify consent is cleared by provider changes, Forget key,
    extension reload, and disclosure-version changes.

Do read-only production validation only after explicit approval. Never use production writes during Phase 1.
