# Chrome Web Store release review

## Current recommendation

Version 0.7.27 is correctly labeled as a beta and its package is structurally ready for Chrome Web
Store upload. It is not yet ready to submit for public review until the owner-controlled blockers
below are completed.

## Completed in 0.6.5

- Provider keys are session-only; the service worker removes legacy locally remembered keys.
- AI Agent presents a provider-specific disclosure before Salesforce context is shared.
- The background rejects AI requests without current, versioned affirmative consent.
- A privacy-policy draft and reviewer test instructions are included in `docs/`.

## Public-release blockers

1. Make the repository public or publish the same privacy policy on a stable public site. As of
   November 11, 2026, the repository, privacy-policy URL, and Issues support URL return HTTP 404 to
   unauthenticated visitors.
2. Complete and record the manual tests in `docs/TESTING.md`, especially two-org isolation,
   production guards, OAuth/API Access Control, permission-denied personas, provider failures,
   incognito behavior, and extension update/reload behavior.
3. Complete Chrome Web Store listing assets and declarations: single purpose, permission
   justifications, data-use categories, privacy certifications, screenshots, and support URL. Exact
   draft entries are in `docs/CHROME_WEB_STORE_SUBMISSION.md`; reviewer instructions are in
   `docs/CHROME_WEB_STORE_REVIEWER_NOTES.md`.
4. Keep the dependency-audit decision documented. `npm audit --omit=dev` reports zero production
   vulnerabilities. The full audit reports seven moderate development-only findings flowing from
   `typescript-eslint` to `minimatch`; those packages are not included in the extension ZIP.

## Suggested rollout

1. Address the owner-controlled blockers and re-run `npm run verify`.
2. Upload the existing v0.7.27 ZIP unless source code changes are made. If source changes, increase
   the manifest version and build a fresh ZIP.
3. Select Public visibility with deferred publishing if the goal is a publicly listed beta; select
   Private first if another trusted-tester review cycle is desired.
4. Submit for review, complete reviewer follow-up promptly, and publish only after approval and a
   final smoke test of the exact uploaded build.

Private, unlisted, and public items all go through Chrome Web Store policy review.
