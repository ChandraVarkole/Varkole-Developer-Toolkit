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
6. Open Org Info and compare organization ID/name/environment/API version, limits, and user-license
   used/available totals with Salesforce Setup. Repeat with a user without View Setup and
   Configuration and confirm only the license card becomes unavailable.
7. Open AI Agent → How AI Agent works away from a record page and confirm it explains how to supply
   an ID. Open the embedded extension on a record and confirm the guide reports current-record
   detection and explains “this record” behavior.
8. Connect a second org/user and switch repeatedly; verify no data/result/token crosses org boundaries.
9. Suspend/restart the MV3 service worker and verify the live browser session is recovered without reconnecting.
10. Disconnect a browser-session org and verify Salesforce itself stays signed in. Separately verify OAuth fallback revocation.
11. Enable API Access Control and confirm Varkole offers the OAuth fallback rather than repeatedly prompting or silently failing.
12. In SOQL, type fewer than two object-name characters and verify no suggestions appear. Type a
    second character, verify matching objects are alphabetized by label, select fields, build the
    query and run it. After results load, select another object and verify the old query and results
    clear. For the same object, add fields and verify existing manually typed fields, `WHERE`,
    `ORDER BY`, and `LIMIT` clauses remain intact.
13. Open Varkole from standard, custom, and namespaced custom record pages in Lightning, Salesforce
    Classic, and the Classic Console. Verify Record Inspector is the first Build module, opens
    automatically, shows every accessible field including blank values, searches label/API
    name/type/value, and Refresh inspection reloads changes. Navigate between records while the
    drawer is open and verify the inspector follows the URL. Also test a pasted 15/18-character ID
    and an inaccessible record. Confirm the detail list appears without requiring Load or Refresh.
14. In Export, preview a query and download CSV/JSON; verify relationship fields are flattened, CSV quotes are escaped and formula-like values are prefixed safely.
15. Open Code Inspector in an org with local Apex, LWC, Aura, and Visualforce resources. Verify
    inventory search/type filtering, source retrieval, source/name copy, related-code links, and
    partial availability when one Tooling object is inaccessible. On a record page, confirm the
    current object is shown and its matching triggers sort first. Confirm managed-package source is
    not presented as readable local source.
16. Open Logs, Coverage, Users, Access, Installed Packages, Flows, Metadata, Integrations and App
    Tabs. Verify supported pages auto-load and insufficient permissions are reported without
    crashing. In Integrations, confirm one denied category does not block the other categories and
    no credential secret/token is displayed. Verify the Flow and Integration Setup links stay on
    the selected Salesforce org and open the corresponding Setup page. In Logs, verify View log is
    the first data action beside the row number.
17. Open Settings → Developer diagnostics, copy the safe context, then inspect the Varkole frame and verify source maps and `services/data` Network requests.
18. In a sandbox, run benign anonymous Apex, a compile error and a runtime exception. Verify the
    result shows compile/runtime details and directs the user to the Debug Logs tab. With a trace
    flag enabled, open Debug Logs and verify the latest log appears there. In Production, verify
    acknowledgement and exact typed confirmation are both required; do not test production writes.
19. In Code Coverage, click Run All Tests in a disposable sandbox, acknowledge the org-wide run,
    and verify queued/running progress updates without reloading. Confirm failed methods appear
    inline and coverage refreshes after a terminal status. Compare the displayed overall percentage
    with Salesforce's org-wide coverage and verify the per-file table continues down the page.
    Verify Production requires the exact `RUN ALL TESTS` confirmation; do not start a Production
    test run during routine validation.
20. In Import, use disposable sandbox records to test CSV upload and paste, quoted commas/newlines,
    duplicate headers, uneven rows, unmapped fields, automatic label/API-name mapping, `#NULL!`,
    create, update and delete. Verify CRUD/FLS, validation and automation errors appear per row;
    successful rows are not automatically retried or rolled back. Verify delete requires `DELETE N`
    and Production requires `IMPORT N`. Never use production data for this test.
21. Connect every supported AI provider with a test key; verify optional host permission denial,
    invalid key, invalid model, quota/rate-limit, offline, and successful responses.
22. Ask AI questions that require schema, records, permissions, implementation recommendations,
    follow-ups referring to earlier messages, and lists over 20 rows. Verify each provider stays
    Salesforce-specific, current-user access is respected, transmitted context is bounded,
    responses are detailed and formatted, follow-ups do not require repeated details, and no chat
    or query result is persisted after the extension page reloads.
    Specifically verify a Contact with a direct Case but no Case Contact Roles, two Contacts with
    the same name, `CaseNumber = '00001029'`, a follow-up whose prior assistant message has no
    retained evidence, zero rows versus an API error, multi-page related records, and malicious
    instructions stored in a Salesforce text field. Factual record claims must cite `[E#]` evidence.
23. Verify provider keys exist only in session storage, are removed by Forget key and extension
    reload, and cannot be read by content scripts. Upgrade from v0.6.4 and verify any legacy locally
    remembered key is deleted.
24. Connect each provider and verify no Salesforce context is sent before the provider-specific
    disclosure is affirmatively approved. Verify consent is cleared by provider changes, Forget key,
    extension reload, and disclosure-version changes.
25. In the embedded drawer, test long org/user names at narrow Salesforce viewport widths. Verify
    the selector, Inspect current record, Help, user, and expand controls remain aligned and do not
    overflow the drawer. Drag the drawer's left edge narrower and wider, use the arrow keys on the
    resize separator, double-click to reset, close/reopen it, and verify the saved width remains
    usable.
26. In Schema Explorer, verify objects remain A–Z after initial load, refresh, and filtering, and
    objects with absent or “Missing Label” labels sort under their API-name fallback.
27. In App Navigation, verify tabs sort A–Z, search matches label/API/object names, every available
    link opens on the selected Salesforce org, and a returned absolute URL for another host is not
    rendered as a link. Verify usernames, technical IDs/API names/URLs/JSON, and the Org Info
    instance URL can be copied while names and email cells remain uncluttered.

Do read-only production validation only after explicit approval. Never use production writes during Phase 1.
