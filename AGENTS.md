# Repository agent rules

Read the supplied `PRODUCT_REQUIREMENTS.md` and `CODEX_START_HERE.md` before changing code.

- Work phase by phase with a runnable testable deliverable.
- Never claim a module is complete without integration and acceptance tests.
- All Salesforce utilities must work without a paid product account.
- Default to the current authorized Salesforce browser session by reading only the `sid` cookie
  through the Chrome cookies API. Use OAuth PKCE as a fallback for API Access Control; never collect
  passwords or scrape Salesforce UI content.
- Never hardcode or log Salesforce tokens, AWS keys, Stripe secrets, or record payloads.
- AI must never auto-execute writes or privileged operations.
- Prefer strict TypeScript, clear contracts, abortable clients, security tests, and clear errors.
- Test, lint, typecheck, and build after each phase.
- Do not publish or provision paid resources without explicit approval.
