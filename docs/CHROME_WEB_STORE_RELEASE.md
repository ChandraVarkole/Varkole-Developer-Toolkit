# Chrome Web Store release review

## Current recommendation

Version 0.6.4 is suitable for continued local testing and, after the disclosure work below, a
private or unlisted beta. Do not submit it as a public production release yet.

## Public-release blockers

1. Add an affirmative in-product disclosure before Salesforce schema or record values are sent to
   an AI provider. The disclosure must identify the selected provider, the categories of data sent,
   the purpose, and that Varkole has no server in the provider-direct path.
2. Remove the eight-hour `chrome.storage.local` API-key option or replace it with a reviewed,
   OS-backed secret-storage design. Chrome local storage is not encrypted and is not appropriate for
   confidential authentication material.
3. Publish an accurate privacy policy at a stable public HTTPS URL. Add developer identity, support
   contact, deletion/retention instructions, every third-party AI provider, Salesforce session-cookie
   use, query-history storage, and the Chrome Web Store Limited Use statement.
4. Complete and record the manual tests in `docs/TESTING.md`, especially two-org isolation,
   production guards, OAuth/API Access Control, permission-denied personas, provider failures,
   incognito behavior, and extension update/reload behavior.
5. Complete Chrome Web Store listing assets and declarations: single purpose, permission
   justifications, data-use categories, privacy certifications, screenshots, support URL, and
   reviewer test instructions.
6. Resolve or accept the development-only `minimatch` advisory reported by `npm audit`; production
   dependencies currently report no known vulnerabilities.

## Suggested rollout

1. Address the blockers and build a new package with a higher manifest version.
2. Submit with deferred publishing and Private visibility for trusted testers.
3. Run the real-org acceptance matrix against the reviewed store build.
4. Move to Unlisted for a broader beta if needed.
5. Publish publicly only after privacy, security, support, and acceptance evidence are complete.

Private, unlisted, and public items all go through Chrome Web Store policy review.
