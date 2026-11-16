# Chrome Web Store release review

## Current recommendation

Version 1.0 is prepared as a production listing package. Complete the dashboard and final manual
checks below before selecting **Submit for review**.

## Automated release checks completed — November 15, 2026

- Exact package: `VARKOLE-v1.0-UPLOAD-THIS-TO-CHROME-WEB-STORE.zip`
- SHA-256: `26a16936f271616219ca94a445d4800d2c62775c595bd7da9c1042b99841b7dc`
- ZIP integrity passed; `manifest.json` is at the ZIP root and declares version `1.0`.
- Manifest description is below Chrome's 132-character limit.
- Prettier checks for changed source, ESLint, strict TypeScript, 38 test files / 160 tests, and the
  production build passed.
- `npm audit --omit=dev` reports zero production vulnerabilities.
- The full audit reports seven moderate development-only `minimatch` findings reached through
  `typescript-eslint`; those packages are not shipped in the extension ZIP.
- Static checks found no bundled credentials, private keys, remotely imported scripts, `eval`, or
  `new Function` usage in the extension source.
- The package contains 25 files and is approximately 550 KB compressed.

## Completed in 0.6.5

- Provider keys are session-only; the service worker removes legacy locally remembered keys.
- AI Agent presents a provider-specific disclosure before Salesforce context is shared.
- The background rejects AI requests without current, versioned affirmative consent.
- A privacy-policy draft and reviewer test instructions are included in `docs/`.

## Public-release blockers

1. Confirm the repository homepage, privacy-policy URL, and Issues support URL open in a signed-out
   or incognito browser.
2. Complete and record the manual tests in `docs/TESTING.md`, especially two-org isolation,
   production guards, OAuth/API Access Control, permission-denied personas, provider failures,
   incognito behavior, and extension update/reload behavior.
3. Complete Chrome Web Store listing assets and declarations: single purpose, permission
   justifications, data-use categories, privacy certifications, at least one 1280x800 screenshot,
   and support URL. Exact draft entries are in `docs/CHROME_WEB_STORE_SUBMISSION.md`; reviewer
   instructions are in `docs/CHROME_WEB_STORE_REVIEWER_NOTES.md`.
4. Keep the dependency-audit decision documented. `npm audit --omit=dev` reports zero production
   vulnerabilities. The full audit reports seven moderate development-only findings flowing from
   `typescript-eslint` to `minimatch`; those packages are not included in the extension ZIP.
5. Register/configure the publisher account, enable two-step verification, and prepare a dedicated
   Salesforce Developer Edition or sandbox reviewer user containing synthetic data. Put credentials
   only in the dashboard's private Test instructions fields, never in the repository.

## Suggested rollout

1. Address the owner-controlled blockers and re-run `npm run verify`.
2. Upload the v1.0 production ZIP. If source changes again, increase the manifest version and
   build a fresh ZIP.
3. Select Public visibility with deferred publishing for the production launch.
4. Submit for review, complete reviewer follow-up promptly, and publish only after approval and a
   final smoke test of the exact uploaded build.

Private, unlisted, and public items all go through Chrome Web Store policy review.
