# ADR-001: Chrome MV3 with React and Vite

**Status:** Accepted for Phase 1

Use Manifest V3, a module service worker, Vite, React, and strict TypeScript. React is limited to UI surfaces; platform/auth/client logic is framework-neutral. This keeps the extension small while supporting accessible stateful screens. No remote code, `eval`, content script, or large UI framework is included.
