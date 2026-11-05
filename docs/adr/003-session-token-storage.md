# ADR-003: Session-only token storage

**Status:** Accepted for Phase 1; review before public release

Do not store browser `sid` values: retain only the cookie domain/source and reread the protected cookie for each operation. OAuth fallback access and refresh tokens use `chrome.storage.session`, accessible only to trusted extension contexts. Store only non-secret org identity metadata in local storage. No credential is written to sync or local storage.
