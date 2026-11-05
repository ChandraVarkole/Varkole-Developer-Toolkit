# Security and threat model

## Protected assets

Salesforce session IDs/OAuth tokens, org/user boundaries, query results, record values, API limits, and user intent.

| Threat                                          | Control in Phase 1                                                                                                               | Residual risk / follow-up                                                                                                    |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Malicious page calls privileged extension logic | Content script exposes only drawer toggling; privileged runtime messages require the extension sender ID                         | Review every future content-script/message path                                                                              |
| Salesforce page reaches drawer internals        | Drawer runs in a cross-origin extension iframe placed inside a closed shadow root                                                | Close messages contain no sensitive data; review future page-context integration                                             |
| Session cookie theft or disclosure              | Cookie access stays in the service worker; values are never returned to UI, logged, or persisted by Varkole                      | A compromised extension has equivalent access to the current Salesforce user; store review and least privilege are mandatory |
| OAuth interception or CSRF                      | S256 PKCE, random state, exact redirect origin/path validation                                                                   | Real-org security test required                                                                                              |
| Custom domain redirects to attacker             | HTTPS only; userinfo/ports/paths rejected; Salesforce-owned suffix allowlist                                                     | Review new official Salesforce domain families before adding                                                                 |
| Cross-org pagination/token confusion            | Org key is `orgId:userId`; pagination origin pinned to selected instance                                                         | Add integration test with two real orgs                                                                                      |
| Token leak in persistence/logs                  | Browser `sid` is read live; OAuth tokens only in `storage.session`; no token logging or analytics                                | Browser-memory compromise is outside extension control                                                                       |
| Provider key persistence                        | Provider keys are stored only in trusted-context `storage.session`; v0.6.5 removes legacy locally remembered keys                | User must reconnect after the browser session or extension reload                                                            |
| AI data sent without informed consent           | Background rejects AI requests until the user approves the versioned provider-specific disclosure in the current browser session | Re-consent is required after provider changes, extension reloads, and disclosure revisions                                   |
| Stale/expired token                             | Browser cookie reread per operation; OAuth gets one refresh-and-retry                                                            | Real-org session and rotation tests remain                                                                                   |
| Runaway query                                   | Abort controller and Stop action; current page only retained                                                                     | Salesforce may finish server-side request after client abort                                                                 |
| XSS from Salesforce data                        | React text rendering; no raw HTML                                                                                                | Audit future markdown/code viewers                                                                                           |
| Overbroad site access                           | Static host permissions are restricted to supported Salesforce domain families                                                   | Required for zero-login discovery but still broad; disclose clearly in the store listing                                     |
| Dependency/remote code risk                     | Minimal dependencies; MV3 CSP; no remote scripts/eval                                                                            | CI vulnerability/secret scanning to expand before release                                                                    |

## Logging rules

Do not log tokens, authorization codes, refresh tokens, Salesforce responses, query text/results, or record payloads. User-facing errors expose mapped messages, not raw HTML proxy responses.

## Security test gates still open

Real browser-session discovery, API Access Control fallback, OAuth refresh rotation, multiple simultaneous orgs, incognito split behavior, Chrome permission warnings, AI data-sharing consent, and provider-key session clearing require manual security testing before release.
