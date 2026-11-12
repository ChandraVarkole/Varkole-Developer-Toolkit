# Chrome Web Store submission worksheet

This worksheet contains the proposed dashboard entries for **Varkole Developer Toolkit BETA**
version 0.7.19. Re-check every entry against the uploaded ZIP before submission.

## Submission gate

Do not select **Submit for review** until all of these are true:

- The privacy-policy, homepage, and support URLs open in a signed-out/incognito browser.
- The manual release checks in `docs/TESTING.md` have been completed against the exact ZIP.
- At least one current 1280x800 or 640x400 screenshot and the required store graphics are uploaded.
- The dashboard privacy answers match the policy and extension behavior described below.
- The publisher Google Account has two-step verification enabled.

## Package

- File: `apps/extension/varkole-developer-toolkit-v0.7.19-beta.zip`
- Manifest version: `0.7.19`
- Expected SHA-256:
  `28f316636f293e4df0218eb10f97a57d28310d34a779fe112255d12f09071e8b`
- `manifest.json` is at the ZIP root.

## Store listing

**Name**

Varkole Developer Toolkit BETA

**Summary**

THIS EXTENSION IS FOR BETA TESTING. Salesforce developer tools using your current authorized
browser session.

**Category**

Developer Tools

**Language**

English

**Detailed description**

> THIS EXTENSION IS FOR BETA TESTING.
>
> Varkole Developer Toolkit helps authorized Salesforce developers and administrators work with
> the org already open in Chrome. It uses the current user's Salesforce session and effective
> permissions; it does not provide additional access or ask for a Salesforce password.
>
> Included tools:
>
> - Automatic current-record inspection for Lightning and Classic
> - SOQL with object and field suggestions, history, sortable results, and record links
> - Execute Anonymous Apex with explicit Production safeguards
> - Inline debug-log viewing and search
> - Org-wide and per-file Apex code coverage with guarded test execution
> - CSV export and guided create, update, and delete imports with confirmations
> - Users, access assignments, packages, Flows, schema, integrations, org information, and app navigation
> - Optional provider-direct AI Agent for grounded, read-only Salesforce assistance
>
> AI Agent is optional. Users provide their own OpenAI, Anthropic, Gemini, or Amazon Bedrock key.
> Before Salesforce context is sent directly to the selected provider, Varkole displays a
> provider-specific disclosure and requires affirmative consent. Varkole does not operate an AI
> relay server, sell data, serve advertising, or install analytics.
>
> Write-capable tools require explicit user action and additional Production confirmations. AI
> Agent cannot write Salesforce records or execute Apex.
>
> Varkole Developer Toolkit is an independent product and is not affiliated with or endorsed by
> Salesforce.

## Public URLs

These URLs currently work only after the repository is made public. Verify them in an incognito
window before entering them in the dashboard.

- Homepage: `https://github.com/ChandraVarkole/Varkole-Developer-Toolkit`
- Support: `https://github.com/ChandraVarkole/Varkole-Developer-Toolkit/issues`
- Privacy policy:
  `https://github.com/ChandraVarkole/Varkole-Developer-Toolkit/blob/main/docs/PRIVACY_POLICY.md`

## Privacy practices

**Single purpose**

Provide Salesforce development and administration tools within the user's currently authorized
Salesforce session, with an optional provider-direct AI assistant grounded in Salesforce data the
user can access.

**Permission justifications**

- `activeTab`: Identifies the user-invoked active Salesforce tab and toggles Varkole's visible
  drawer. It is not used to collect background browsing history.
- `cookies`: Reads only the Salesforce `sid` cookie on declared Salesforce domains so user-requested
  Salesforce API operations can use the user's existing session. The value is not exposed to the UI
  or persisted by Varkole.
- `identity`: Supports the optional Salesforce OAuth Authorization Code with PKCE fallback and its
  Chrome redirect URL for orgs that enforce API Access Control.
- `storage`: Stores non-secret org labels/settings and per-org SOQL history locally. Salesforce
  credentials, provider keys, and AI consent are held in trusted Chrome session storage; provider
  keys expire after at most eight hours.
- `sidePanel`: Provides the Chrome side-panel entry point and its action behavior for the toolkit.
- Salesforce host access: Runs the visible drawer and authorized Salesforce REST, Tooling, UI, and
  Metadata API requests across supported Lightning, Classic, Setup, Force.com, and Visualforce
  domains.
- Optional AI-provider host access: Requested only when the user connects that provider. It sends
  the user's key and, after a separate affirmative disclosure, the question and bounded relevant
  Salesforce context directly to the selected provider.

**Recommended data-type disclosures**

Based on the current behavior, disclose at least:

- Personally identifiable information: Salesforce user identity and accessible record values can
  contain names, usernames, email addresses, or other identifiers.
- Authentication information: Salesforce session/OAuth credentials and user-supplied AI provider
  keys are processed temporarily.
- Personal communications: User-entered AI questions and recent chat context are sent to the
  selected AI provider after consent.
- Website content: The current Salesforce record context plus user-requested Salesforce metadata,
  records, logs, query results, and source can be processed.

Do not select advertising, creditworthiness, or data-sale uses. If the dashboard asks about a data
category not listed here, answer from actual extension behavior rather than minimizing the
disclosure. Salesforce records can contain customer-defined sensitive fields, so keep the public
privacy policy and the dashboard wording broad and consistent.

**Limited-use certifications**

Certify only after confirming each statement in the dashboard. Current design supports stating
that data is used only for the disclosed single purpose, is not sold or used for advertising or
creditworthiness, and is transferred only to Salesforce and the user-selected AI provider as needed
for user-requested functionality. The public privacy policy contains the required Limited Use
statement.

## Listing images

- Store icon: use the packaged 128x128 Varkole icon.
- Screenshots: upload one to five current, full-bleed images at 1280x800 or 640x400.
- Small promotional tile: 440x280.
- Marquee image, if supplied: 1400x560.
- Use only a sandbox or Developer Edition with synthetic data. Redact usernames, emails, org IDs,
  record IDs, customer data, logs, queries, and API keys.

Recommended screenshot order:

1. Record Inspector automatically showing a synthetic current record.
2. SOQL object/field assistance and sortable results.
3. Debug Logs inline viewer or Code Coverage overall/per-file view.
4. Admin inventories such as Flows, packages, and integrations.
5. AI Agent disclosure and a grounded response using synthetic Salesforce data.

## Distribution and submission

- Choose **Public** to create a searchable, publicly installable beta listing. Keeping `BETA` in the
  name and `THIS EXTENSION IS FOR BETA TESTING` in the description follows Chrome's testing-version
  guidance.
- Choose all regions only if support and the privacy policy are intended for all regions.
- On the final confirmation, disable automatic publishing to use deferred publishing. After
  approval, perform a final dashboard/package check and publish manually within Chrome's staging
  window.
- Paste `docs/CHROME_WEB_STORE_REVIEWER_NOTES.md` into the reviewer-notes field, adjusting only for
  the exact reviewer account and test data supplied.
