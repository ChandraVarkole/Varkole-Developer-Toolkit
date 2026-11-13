# Varkole Developer Toolkit privacy policy

**Effective date:** November 5, 2026

Varkole Developer Toolkit is developed by Chandra Varkole. Questions and privacy requests can be
submitted through the project's
[GitHub support page](https://github.com/ChandraVarkole/Varkole-Developer-Toolkit/issues).

## Purpose

Varkole provides developer utilities for Salesforce in the user's browser. It uses the Salesforce
session and permissions of the currently signed-in user. It does not create additional Salesforce
access or bypass Salesforce security controls.

## Data handled by the extension

Varkole may handle the following data only to provide user-requested features:

- Salesforce session credentials, including the active `sid` cookie or OAuth fallback tokens.
- Salesforce organization and user identity, object and field metadata, query results, records,
  accessible Apex and component source, debug logs, code coverage, limits, tabs, and permission
  information accessible to the user.
- When the user activates Code Inspector's picker, the selected Salesforce component tag name or
  Aura descriptor. The picker does not read field values, input values, labels, or rendered page
  text.
- SOQL query history saved by the user in the extension.
- AI provider configuration, questions, recent conversation context, and relevant Salesforce data
  selected to answer an AI Agent question.

## Storage and retention

- Salesforce session credentials and AI provider keys are held only in Chrome session storage or
  browser memory. AI provider keys expire after at most eight hours. These credentials are not
  written to local or sync storage.
- AI data-sharing consent is stored only for the current browser session and selected provider.
- Organization labels and identity metadata plus up to 50 successful SOQL history entries per org
  can be stored locally in the user's Chrome profile.
- Query results, Salesforce record values, debug-log bodies, and AI chat answers are not persisted.
- **Forget key**, disconnect controls, clearing query history, disabling/removing the extension, or
  Chrome profile controls let the user delete the corresponding retained data.

## Network disclosures

Salesforce data is sent to Salesforce APIs to perform the operation requested by the user. Varkole
does not operate a server in this path.

AI Agent is optional and uses a key supplied by the user. Before any Salesforce context is sent,
Varkole displays an affirmative disclosure naming the selected provider and the categories of data
that may be shared. If approved, questions, recent messages, org/current-user identity, relevant
object and field metadata, relevant query results or record values, and relevant accessible Apex or
component source for code questions can be sent directly to the selected provider:

- [OpenAI](https://openai.com/policies/privacy-policy/)
- [Anthropic](https://www.anthropic.com/legal/privacy)
- [Google Gemini](https://policies.google.com/privacy)
- [Amazon Bedrock](https://aws.amazon.com/privacy/)

Those providers process data under their own terms and privacy policies. Changing providers or
starting a new browser/extension session requires consent again.

## Data use and sharing

Varkole does not sell personal data, use it for advertising, perform analytics or tracking, or use
Salesforce content to build advertising profiles. Data is disclosed only to Salesforce and, when
the user explicitly enables and approves AI Agent, the selected AI provider, solely to provide the
user-requested functionality.

The use of information received from Google APIs will adhere to the Chrome Web Store User Data
Policy, including the Limited Use requirements. Varkole limits collection, use, transfer, and
retention to what is necessary for its prominent user-facing developer-toolkit features.

## Permissions

Varkole requests Salesforce host, cookie, identity, storage, active-tab, and side-panel permissions
to discover the signed-in Salesforce session and provide the visible developer tools. AI provider
host access is optional and requested only when the user connects that provider.

## Security

Extension pages use a restrictive Manifest V3 content security policy. Credentials remain in the
background service worker or trusted extension storage and are not exposed to Salesforce page
scripts. No system can be guaranteed completely secure; users should revoke provider credentials
and report the issue through the support page if they suspect unauthorized access.

## Changes

Material changes to data handling will be reflected in this policy and, when required, presented to
users for renewed consent before the changed data sharing occurs.
