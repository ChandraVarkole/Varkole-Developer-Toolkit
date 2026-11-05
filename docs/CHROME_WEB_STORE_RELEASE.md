# Chrome Web Store release review

## Current recommendation

Version 0.6.5 is suitable for continued local testing and a private trusted-tester submission after
the remaining checklist items below are completed. Do not submit it as a public production release
until the real-org acceptance evidence is recorded.

## Completed in 0.6.5

- Provider keys are session-only; the service worker removes legacy locally remembered keys.
- AI Agent presents a provider-specific disclosure before Salesforce context is shared.
- The background rejects AI requests without current, versioned affirmative consent.
- A privacy-policy draft and reviewer test instructions are included in `docs/`.

## Public-release blockers

1. Confirm the repository is public and use the HTTPS URL for `docs/PRIVACY_POLICY.md` as the store
   privacy-policy URL, or publish the same policy on a stable first-party site.
2. Complete and record the manual tests in `docs/TESTING.md`, especially two-org isolation,
   production guards, OAuth/API Access Control, permission-denied personas, provider failures,
   incognito behavior, and extension update/reload behavior.
3. Complete Chrome Web Store listing assets and declarations: single purpose, permission
   justifications, data-use categories, privacy certifications, screenshots, and support URL. The
   owner will prepare screenshots; reviewer instructions are in `docs/CHROME_WEB_STORE_REVIEWER_NOTES.md`.
4. Resolve or accept the development-only `minimatch` advisory reported by `npm audit`; production
   dependencies currently report no known vulnerabilities.

## Suggested rollout

1. Address the blockers and build a new package with a higher manifest version.
2. Submit with deferred publishing and Private visibility for trusted testers.
3. Run the real-org acceptance matrix against the reviewed store build.
4. Move to Unlisted for a broader beta if needed.
5. Publish publicly only after privacy, security, support, and acceptance evidence are complete.

Private, unlisted, and public items all go through Chrome Web Store policy review.
