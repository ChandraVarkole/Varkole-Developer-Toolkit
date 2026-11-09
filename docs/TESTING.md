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
11. In SOQL, type fewer than two object-name characters and verify no suggestions appear. Type a
    second character, verify matching objects are alphabetized by label, select fields, build the
    query and run it.
12. Open Varkole from a standard and custom Salesforce record page. Verify Record Inspector opens
    automatically, shows every accessible field including blank values, searches label/API
    name/type/value, and Refresh inspection reloads changes. Also test a pasted 15/18-character ID
    and an inaccessible record.
13. In Export, preview a query and download CSV/JSON; verify relationship fields are flattened, CSV quotes are escaped and formula-like values are prefixed safely.
14. Open Logs, Coverage, Users, Access, Metadata and App Tabs; verify supported pages load and insufficient permissions are reported without crashing.
15. Open Settings → Developer diagnostics, copy the safe context, then inspect the Varkole frame and verify source maps and `services/data` Network requests.
16. In a sandbox with a current trace flag, run benign anonymous Apex, a compile error and a runtime
    exception. Verify the corresponding Execute Anonymous log opens below the result and its search
    works. Disable the trace flag and verify the enable-logging message. In Production, verify
    acknowledgement and exact typed confirmation are both required; do not test production writes.
17. In Import Preview, test quoted commas/newlines, duplicate headers, uneven rows and unmapped fields. Confirm no Salesforce network request is made.
18. Connect every supported AI provider with a test key; verify optional host permission denial,
    invalid key, invalid model, quota/rate-limit, offline, and successful responses.
19. Ask AI questions that require schema, records, permissions, implementation recommendations,
    follow-ups referring to earlier messages, and lists over 20 rows. Verify each provider stays
    Salesforce-specific, current-user access is respected, transmitted context is bounded,
    responses are detailed and formatted, follow-ups do not require repeated details, and no chat
    or query result is persisted after the extension page reloads.
20. Verify provider keys exist only in session storage, are removed by Forget key and extension
    reload, and cannot be read by content scripts. Upgrade from v0.6.4 and verify any legacy locally
    remembered key is deleted.
21. Connect each provider and verify no Salesforce context is sent before the provider-specific
    disclosure is affirmatively approved. Verify consent is cleared by provider changes, Forget key,
    extension reload, and disclosure-version changes.
22. In the embedded drawer, test long org/user names at narrow Salesforce viewport widths. Verify
    the selector, Inspect current record, Help, user, and expand controls remain aligned and do not
    overflow the drawer.

Do read-only production validation only after explicit approval. Never use production writes during Phase 1.
