# Changelog

## 0.7.18 — Org-wide coverage and expanded inventories

- Added Salesforce's org-wide Apex coverage percentage above the per-file coverage table, including
  a compact 75% deployment-baseline indicator.
- Removed the fixed internal table-height limit from Code Coverage, Users, Access Assignments,
  Installed Packages, and Flows so their result grids continue naturally down the page.

## 0.7.17 — Direct record retrieval

- Replaced the Record Inspector's multi-effect `FIELDS(ALL)` sequence with one background
  inspection operation that resolves the object, retrieves all accessible record fields through
  Salesforce sObject Rows, and loads Describe metadata.
- Added a global key-prefix fallback when UI API object resolution is unavailable.
- Made pasted record IDs use the same reliable inspection operation as current-page records.

## 0.7.16 — Custom-object record inspection

- Added a permission-aware Salesforce UI API fallback that resolves an object API name directly
  from the current record ID when the global object key-prefix list is incomplete.
- Custom and namespaced records now continue through the same Describe metadata and bounded
  `FIELDS(ALL)` inspection used for standard records.
- Added regression coverage for custom-object resolution without weakening current-user access.

## 0.7.15 — Simplified sidebar

- Removed the AI Setup and Reload latest build controls from the sidebar footer.
- Kept provider configuration inside AI Agent and documented Chrome's standard extension reload
  flow for unpacked development builds.

## 0.7.14 — Classic record inspection and compact Setup actions

- Promoted Record Inspector to the first Build module and made it the default workspace view.
- Added current-record detection for direct Classic URLs, encoded Classic Console routes, and
  supported record-ID query parameters while continuing to exclude Salesforce org IDs.
- Kept the inspector synchronized with Salesforce URL changes and automatically loads all fields
  visible to the current user through Salesforce APIs in both Classic and Lightning.
- Reduced the new Flow and Integration Setup/Refresh actions to compact controls.

## 0.7.13 — Setup navigation and test-run compatibility

- Added same-org Salesforce Setup links for Flows, External Client Apps, Connected Apps, Named
  Credentials, and External Credentials using a strict allowlist of known Setup routes.
- Moved View log beside the row number so it remains immediately accessible in compact tables.
- Normalized both documented string and object-shaped Apex test job responses, and replaced the raw
  missing-job JavaScript error with clear reload guidance when an older service worker is active.

## 0.7.12 — Run all Apex tests

- Added a guarded Run All Tests action to Code Coverage using Salesforce's asynchronous Tooling
  Test Runner API with Apex-only execution and coverage collection enabled.
- Added live queued/completed/failed progress, failed-test details, and automatic coverage refresh
  after Salesforce finishes the run.
- Added a separate Production confirmation and protected the internal polling queries with strict
  Salesforce ID validation.

## 0.7.11 — Compatible setup inventory fields

- Removed the unsupported `SubscriberPackageVersion.ContainerOptions` field and now classifies
  installed packages once as Managed or Unmanaged using Salesforce's `IsManaged` value.
- Replaced the unsupported Named Credential authorization-header field with the supported credential
  type and callout status fields.
- Reordered Integrations to External Client Apps, Connected Apps, Named Credentials, then External
  Credentials.
- Removed duplicate package/manageable-state columns from Flows and External Client Apps while
  preserving a single human-friendly Package type column.
- Added a regression test that prevents the invalid Named Credential field from returning.

## 0.7.10 — Reliable local build reloads

- Added a Reload latest build action that restarts the unpacked extension from its originally
  installed directory, with a warning that temporary UI state and the session-only AI key reset.
- Documented `apps/extension/dist` as the single stable owner-development installation path and
  clarified that version-numbered beta folders are immutable tester snapshots.
- Added a local-testing guide beside the extension project so the stable-folder update steps remain
  easy to find without adding development files to the published package.

## 0.7.9 — Setup inventories

- Added Installed Packages with package name, namespace prefix, managed/unmanaged/unlocked type,
  four-part version, release state, and installed/deprecated status.
- Added Flows with label, API name, namespace, managed/unmanaged type, active/inactive status, and
  manageable state.
- Added an Integrations inventory for Connected Apps, External Client Apps, Named Credentials, and
  External Credentials. Each category loads independently and reports its own Salesforce permission
  error without blocking the others; credential secrets are never requested.
- Added a narrowly scoped read-only Metadata API client for External Client Application names and
  package metadata, with same-org URL pinning, session-expiry handling, and permission-aware faults.
- Fixed read-only Tooling pages to preserve Tooling mode when loading subsequent query pages.

## 0.7.8 — Navigation, data import, and org release details

- Added secure same-org hyperlinks to every available Salesforce tab in App Navigation.
- Simplified Run Anonymous Apex by removing its duplicate inline log viewer and directing users to
  the dedicated Debug Logs tab when debug logging is enabled.
- Replaced Import Preview with a guarded CSV data loader for create, update and delete operations,
  including object/field discovery, label/API-name mapping, type validation, a 2,000-row browser
  limit, 200-row Salesforce collection batches, explicit irreversible and Production confirmations,
  and per-row results. Writes are processed once and are never automatically retried or rolled back.
- Added the Salesforce release label and latest platform API version to Org Info using Salesforce's
  Versions resource.
- Added regression coverage for import coercion, composite write endpoints, no-retry writes,
  release detection, and same-org navigation links.

## 0.7.7 — Flow inventory retrieval

- Added a deterministic, permission-bound Tooling API query for requests to list accessible Flow
  definitions, including flow labels, API names, descriptions, active/latest version references,
  namespaces, and package state.
- Required successful FlowDefinition evidence before a Flow inventory request can be treated as
  grounded; unrelated records and permission evidence no longer satisfy the request.
- Added Flow-specific answer guidance and regression coverage while keeping the operation strictly
  read-only.

## 0.7.6 — Reliable simple record lookups

- Added deterministic read-only SOQL for straightforward oldest, newest, list, and count questions
  using the requested object's live describe metadata.
- Fixed evidence-gap detection so successful but irrelevant earlier lookups cannot suppress a
  required query for the object named in the current request.
- Kept conversational follow-ups useful by resolving simple requests from the two most recent user
  messages without treating prior assistant prose as verified Salesforce data.
- Prevented provider responses from describing internal model tool availability; final answers now
  report the actual Salesforce lookup result, error, or missing evidence.

## 0.7.5 — Read-only Apex and component inspection

- Added permission-bound Salesforce Tooling API retrieval for local/unmanaged Apex classes,
  triggers, Lightning web component bundles and resources, Aura bundles and definitions, and
  Visualforce pages/components.
- Added safe component-name discovery, bounded source retrieval, Tooling pagination, source
  truncation disclosure, and explicit handling for no-match, permission, and protected-package
  outcomes.
- Kept code inspection strictly read-only; no AI-generated Apex, JavaScript, metadata changes, or
  arbitrary API endpoints can execute.
- Kept evidence IDs for internal grounding validation but removed `[E#]` markers before displaying
  or copying an AI Agent response.

## 0.7.4 — Compact layout and logo correction

- Fixed AI Agent horizontal overflow in the embedded Salesforce drawer, including the connection
  badge, Clear Chat action, messages, tables, and long API names.
- Corrected the compact top bar to constrain long organization names and keep record/actions inside
  the drawer.
- Increased the visible cloud/V artwork inside extension icons and removed the rectangular shadow
  around the transparent in-app logo.
- Rebuilt the floating launcher as a 34 px borderless transparent control with an alpha-aware icon
  shadow, removing the white rounded button surface shown over Salesforce pages.

## 0.7.3 — Org-aware AI and transparent launcher

- Expanded AI Agent retrieval for natural-language records, aggregate calculations, reports,
  dashboards, permissions, relationships, and org-specific Salesforce Flow guidance.
- Added read-only Salesforce Reports and Dashboards REST API results, bounded by the current
  user's session and Salesforce access.
- Added verified current-page record context so questions about “this” record retrieve the active
  Salesforce record and its relevant relationships instead of relying on assumptions.
- Added a second evidence-gap planning pass, report/dashboard discovery, aggregate-query guidance,
  effective-access guidance, safe Salesforce record links, and readable Markdown tables.
- Added an AI accuracy disclaimer, character/context-limit guidance, Clear Chat capitalization,
  automatic latest-message scrolling, and 8-hour browser-session key expiry.
- Replaced the broken Settings route with AI Setup and made the popup gear open AI Agent.
- Removed the logo's white canvas, regenerated transparent padded extension icons, and reduced the
  floating Salesforce launcher to 42 px with a lighter transparent treatment.

## 0.7.2 — Compact Salesforce launcher

- Reduced the floating Salesforce-page launcher from 52 px to 44 px and tightened its border,
  radius, page-edge spacing, and shadow without changing toolbar or in-app branding sizes.

## 0.7.1 — Grounded relationships and safer SOQL building

- Made AI retrieval relationship-aware by loading relevant Salesforce Describe metadata before
  planning, including reference fields and bounded child relationships discovered from the org.
- Added a controlled second read-only planning pass when relationship evidence is incomplete. Case
  questions now require direct `Case.ContactId` inspection; `CaseContactRole` remains optional
  additional evidence and cannot prove the direct relationship is empty.
- Added in-memory structured evidence across follow-ups: query, object, records, retrieval time,
  pagination/completeness, inspected relationships, errors, and user-supplied identifiers. Prior AI
  prose is explicitly unverified and is never promoted into Salesforce evidence.
- Added evidence states and response validation for successful records, successful zero rows, API
  errors, partial/capped results, missing lookups, and evidence citations. Ungrounded answers receive
  one correction pass and are withheld if they still fail validation.
- Preserved text identifiers such as `Case.CaseNumber` with leading zeros and added bounded
  pagination for AI lookups.
- Fixed SOQL field building: selecting a different object clears the old query and results; adding
  fields to the same object preserves manually written fields, filters, ordering, and limits.
- Enforced A–Z ordering in Schema Explorer after filtering and clarified the active sort in its UI.
- Replaced the toolbar, launcher, and in-app artwork with the supplied Gradient Cloud V logo and
  regenerated optimized 16, 32, 48, and 128 px extension icons.

## 0.7.0 — Developer workflow refinement

- Made object selection type-ahead only: suggestions begin after two characters, match labels and
  API names, and sort alphabetically without placing missing-label objects first.
- Reworked Current Record inspection to load automatically from the active Salesforce page, show
  every accessible described field including blank values, and support searching by label, API
  name, type, or value. Added an explicit Refresh inspection action.
- Added the matching Execute Anonymous debug log below each Apex result, including status, timing,
  size, inline body display, and text search. A clear trace-flag message appears when Salesforce
  does not create a log.
- Strengthened AI Agent as a Salesforce-specific architect, developer, administrator, and analyst
  across all supported providers. Retrieval now uses recent chat history, supports broader bounded
  read-only evidence gathering, produces more detailed responses, and caches schema foundations to
  speed up follow-up questions without persisting chats or Salesforce results.
- Improved compact embedded-header alignment so long organization names and record controls remain
  contained in the drawer.
- Deferred GitHub, Azure Repos, and Bitbucket authorization until after the initial Chrome Web Store
  review to keep this beta's permissions and data disclosure unchanged.

## 0.6.6 — Private beta package

- Added the required **BETA** suffix to the extension name and toolbar title.
- Added the explicit **THIS EXTENSION IS FOR BETA TESTING** statement to the manifest description.
- Updated the in-product version label for the private trusted-tester submission.

## 0.6.5 — AI consent and session-only secrets

- Removed the eight-hour provider-key option. AI credentials now exist only in trusted-context
  Chrome session storage and are cleared by browser-session or extension reload boundaries.
- Added upgrade cleanup that deletes provider keys locally remembered by earlier preview builds.
- Added a provider-specific disclosure listing the Salesforce and conversation data categories that
  may be shared, the provider-direct path, and the read-only limitation.
- Added background enforcement so AI requests are rejected until the disclosure is affirmatively
  approved for the configured provider and current browser session.
- Added consent validation tests and public privacy-policy/reviewer-note templates for store review.

## 0.6.4 — Release-review hardening

- Restricted local and session extension storage to trusted extension contexts so Salesforce pages
  and content scripts cannot access stored configuration.
- Restricted privileged background requests to extension-owned pages instead of accepting requests
  from content scripts that share the extension ID.
- Added security tests for the privileged message boundary and expanded repository exclusions for
  generated packages and TypeScript build artifacts.
- Updated privacy, security, testing, and feature documentation to match the implemented automatic
  AI context flow and optional eight-hour provider-key behavior.
- Added a Chrome Web Store release checklist with remaining public-release blockers and a staged
  rollout recommendation.

## 0.6.3 — AI chat usability and eight-hour key option

- AI chat now scrolls smoothly to the latest user message, progress state, and completed response.
- AI request and provider errors now appear beside the composer with a highlighted input and a
  dismiss control instead of interrupting the top of the page.
- Added an explicit “Remember key for 8 hours” option. When selected, the provider configuration is
  stored only in the current Chrome profile, restored after extension reloads, and removed from
  local and session storage when it expires.
- Session-only storage remains the default, and Forget key immediately clears both storage modes.
- The connected-provider badge shows the expiration time for an eight-hour key.

## 0.6.2 — Complete list answers and formatted responses

- Fixed automatic context reduction prioritizing background object metadata over requested query
  records. Small and medium result sets are now preserved before metadata is reduced.
- Increased explicit complete-list and roster lookups to a maximum of 200 read-only records while
  retaining a 20-record default for ordinary questions.
- Added returned, included, and truncated record counts so AI Agent can accurately explain whether
  an answer contains the complete retrieved result.
- Increased final-answer capacity for more detailed responses.
- Added a lightweight, HTML-safe Markdown renderer for headings, paragraphs, bold text, numbered
  and bulleted lists, inline code, and code blocks.

## 0.6.1 — Conversation-aware AI retrieval

- Fixed follow-up questions losing the earlier object or request when the latest message was short,
  such as “I'm an admin.” The retrieval planner now uses the recent conversation.
- Added conservative object-name resolution so conversational or abbreviated names map to the real
  accessible Salesforce API name before Describe and query calls run.
- Automatically describes every object used by a planned query, even when the provider omits it
  from the separate object list.
- Access-related questions now include a read-only snapshot of the current user's profile and
  assigned permission sets when Salesforce permits those lookups.
- Prioritized relevant accessible objects in the final context and instructed the model to
  distinguish “not inspected” from an actual permission or query error.
- All lookups continue to run through the current Salesforce browser session; no privileges are
  added or bypassed.

## 0.6.0 — Automatic read-only AI Agent

- Removed the manual schema, record, SOQL, preview, and consent setup from every question.
- AI Agent now creates a bounded read-only retrieval plan automatically, using at most three object
  descriptions and three validated `SELECT` queries capped at 20 records each.
- Every Salesforce lookup runs through the current browser session, so object, field, sharing, and
  record access remain limited to the signed-in user's effective permissions.
- Provider settings collapse after connection, model-only changes can reuse the session key, and
  OpenAI defaults to the low-cost `gpt-6-luna` model.
- Added progress feedback for metadata, planning, Salesforce lookups, and answer generation.
- Added Copy controls to AI responses. Chat messages remain in page memory only and are discarded
  when the extension page reloads or closes.
- Improved provider errors to distinguish exhausted API credits and spend limits from temporary
  request-rate limits.

## 0.5.1 — Lightweight labels and user-led starting states

- Restored the Varkole name and Developer Toolkit caption in the embedded vertical sidebar.
- Removed the Record Inspector guidance and generated-query panels, tightened embedded spacing,
  and simplified redundant page descriptions and status text.
- Replaced API-oriented object and field text with Salesforce labels where the UI has Describe
  metadata, while keeping API names internal for requests.
- Removed default Account queries, fields, CSV data, and placeholders so SOQL, Record Inspector,
  Export, Import Preview, Schema Explorer, and AI Agent start ready for the user's choice.
- Removed permission-set assignment IDs and other internal tab metadata from result tables.
- Reordered Code Coverage to show File, Coverage, Covered, Uncovered, and Total lines, with the
  percentage immediately beside the file name.
- Added consistent human-readable, sortable column headings across shared result tables.

## 0.5.0 — Compact drawer and current-record inspection

- Rebuilt the embedded Salesforce drawer with vertical module navigation so every tool remains
  visible without horizontal scrolling.
- Reduced the drawer to a responsive 660–980 px width instead of covering most of Salesforce.
- Replaced the red close button with a persistent chevron on the drawer's left edge; Escape also
  hides the drawer and the floating Varkole launcher restores it.
- Added first-class current-record detection. Opening Varkole on a Salesforce record page now
  switches directly to Record Inspector, infers the object from its key prefix, and loads all
  accessible fields automatically.
- Added a prominent current-record shortcut and detected-record status throughout the embedded UI.

## 0.4.2 — Salesforce record navigation

- Added an Open action to every query-result row that exposes a Salesforce record ID, including
  rows where the ID is available only through the REST response metadata.
- Record and lookup ID fields such as `Id`, `OwnerId`, and relationship `Account.Id` now link
  directly to their corresponding records in the selected Salesforce org.
- Links open in a separate tab so developers can take action in Salesforce without losing their
  Varkole query or results.

## 0.4.1 — Persistent SOQL history and navigation refresh

- Added per-org query history for successful manual SOQL and Tooling queries, stored locally without
  query results, deduplicated by query and mode, and capped at the latest 50 entries.
- Query history can restore the editor and API mode, delete individual entries, or clear an org's
  full history.
- Reordered the primary tools to SOQL, Run-Apex, Debug Logs, and Org Info before the remaining tabs.
- Renamed Org Sage to AI Agent and added a highlighted navigation treatment so the feature is easy
  to discover.

## 0.4.0 — AI Agent multi-provider AI

- Added the AI Agent read-only assistant with BYOK support for OpenAI GPT/Codex API models,
  Anthropic Claude, Google Gemini, and Amazon Bedrock.
- Provider keys live only in Chrome session storage and provider network access is requested as an
  optional permission when the user connects.
- Added a review-first Salesforce context builder for org identity, object schema, and an optional
  bounded read-only SOQL query of at most 20 records.
- The exact provider payload is previewed locally and requires explicit consent before every active
  context can be used in chat; Salesforce content is treated as untrusted data.
- Added provider-direct multi-turn chat with strict size bounds and no AI-triggered Salesforce
  writes, Apex execution, or metadata changes.

## 0.3.1 — Debug Log viewer and coverage percentages

- Debug Logs now open inside Varkole through the Tooling API instead of navigating to Salesforce
  record pages that can report insufficient privileges.
- Added metadata filtering, an in-log viewer with line numbers and search, local download, and a
  bounded search across the latest 50 loaded log bodies with progress and a 12 MB safety limit.
- Code Coverage now calculates and displays each class or trigger percentage as covered lines
  divided by total executable lines.

## 0.3.0 — Record Inspector and Schema Explorer

- Records now detects record IDs from Salesforce record pages, infers the object from its key
  prefix, retrieves all accessible fields for a single record, and displays an FLS-aware field
  inspector with object capabilities and a Salesforce record link.
- Metadata is now a searchable Schema Explorer using live REST Describe data, with object
  capabilities, field types, required/writable/formula status, relationships, picklist values,
  schema metrics, filtering, and sorting.
- Both tools remain read-only and use only the current authorized Salesforce browser session.

## 0.2.5 — Logs and Records guidance

- Added an Apex Logs notice explaining that Salesforce debug logging and a valid trace flag must
  be enabled before logs are generated.
- Clarified Records as a guided record inspector for object browsing, field selection, and direct
  record-ID lookup, while SOQL remains the advanced query tool.

## 0.2.4 — Live-session automatic loading fix

- Fixed automatic tab loading when cached connection state is stale after an extension reload.
- Read-only tabs now ask the background worker to recover the current Salesforce browser session
  instead of skipping their request based on the cached connection flag.
- Org Info and SOQL now use the same live-session recovery path as the other read-only tools.

## 0.2.3 — Automatic tab loading and sortable tables

- Safe read-only tabs now load their default data automatically when opened: Records, SOQL,
  Export Preview, Logs, Code Coverage, Users, Access, Metadata, Org Info, and App Tabs.
- Import Preview automatically analyzes its local sample without sending anything to Salesforce.
- Run-Apex remains manual because it can modify data and invoke business logic.
- Added accessible ascending and descending sorting to every results table. Sorting applies only to
  the rows currently loaded in the browser.

## 0.2.2 — Automatic Records loading

- Records now load automatically when the Records tab opens.
- The manual action remains available as Refresh records after the initial result loads.
- Automatic loading is guarded so normal re-renders do not issue duplicate queries.

## 0.2.1 — Extension icon refresh

- Replaced the extension, toolbar, launcher, and in-app icon with the supplied Cloud Guru V artwork.
- Added a transparent-background master and regenerated alpha-enabled 16, 32, 48, and 128 px Chrome icon assets.

## 0.2.0 — Developer productivity preview

- Added live Salesforce object autocomplete and Describe-based field suggestions to SOQL, Records, and Export.
- Added selectable field chips with field types and editable generated SOQL.
- Added a read-only Records browser with bounded queries, optional record-ID lookup, pagination, filtering, and Salesforce record links.
- Added local CSV/JSON export with relationship flattening, correct escaping, spreadsheet-formula neutralization, and a 5,000-loaded-row browser cap.
- Added real API-backed preview pages for Apex Logs, Code Coverage, Users, Permission Set Assignments, Metadata objects, and App Tabs.
- Added Run Anonymous Apex with explicit acknowledgement, typed Production confirmation, compile/runtime results, and no automatic retries.
- Added a local-only Import Preview with quoted CSV parsing, structural validation, field-selection assistance, mapping checks, and a 200-row preview cap; Salesforce writes remain disabled.
- Added request timing, API usage, mode, instance-host diagnostics, copyable safe org diagnostics, and source maps for DevTools inspection.
- Kept Import write execution and AI unavailable until their write confirmations, provider configuration, and acceptance tests are complete.

## 0.1.6 — Chrome REST request fix

- Bind the browser `fetch` API to its global worker scope so Chrome can execute Salesforce REST requests instead of throwing `TypeError: Illegal invocation`.
- Preserve the underlying browser error as safe diagnostic detail without exposing session tokens.

## 0.1.5 — Simple browser-session host resolution

- Resolve the Salesforce REST hostname directly from the live API-capable `sid` cookie on every request.
- Normalize Lightning and Setup hostnames to their My Domain API hostname, avoiding redirects that can drop authorization.
- Never use Lightning, Visualforce, Help, or Setup UI cookies as an API-session fallback.

## 0.1.4 — Salesforce session ID compatibility

- Recognize the same Salesforce org when its browser session cookie uses the 15-character org ID and the Identity API returns the corresponding 18-character org ID.
- Preserve strict per-org cookie isolation while recovering active browser sessions.

## 0.1.3 — Brand caption

- Renamed the visible product caption from Cloud Code Guru to Developer Toolkit.

## 0.1.2 — Live cookie resolution

- Resolve the current org session by organization ID across all Salesforce cookies available to the
  extension instead of relying on one exact cookie URL.
- Refresh the non-secret cookie-domain pointer when Salesforce rotates or relocates the session.
- Replace the misleading signed-out message with actionable session diagnostics.

## 0.1.1 — In-page drawer and session recovery

- Replaced the primary full-tab launch with a modern right-side Salesforce drawer and floating launcher.
- Added compact horizontal module navigation, close control, and optional full-page expansion.
- Recover browser-session orgs from the live Salesforce cookie after worker/extension session resets.

## 0.1.0 — Phase 0 + initial Phase 1

- Initialized strict TypeScript monorepo, CI, documentation, threat model, ADRs and feature matrix.
- Added installable MV3 popup, workspace, side panel and supplied Varkole branding.
- Added Salesforce OAuth PKCE, session token storage and multi-org selection.
- Added typed REST/Tooling clients, Org Info and SOQL Explorer.
- Switched the default authentication path to automatic active-tab Salesforce session reuse, with
  OAuth PKCE retained only as an API Access Control fallback.
