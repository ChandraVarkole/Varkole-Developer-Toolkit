# ADR-005: Managed backend tenancy

**Status:** Deferred to Phase 5

Managed AI will use server-authoritative user entitlements and per-user usage partitions. Salesforce OAuth tokens never enter that backend. No Stripe, Cognito, AWS, or managed AI runtime is provisioned in Phase 1.
