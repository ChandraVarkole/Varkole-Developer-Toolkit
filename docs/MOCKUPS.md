# Phase 0 interface mockups

The implemented shell follows these lightweight layouts.

```text
Workspace
┌───────────────┬────────────────────────────────────────┐
│ Brand         │ Org selector       env badge   user    │
│ Build modules ├────────────────────────────────────────┤
│ Admin modules │ Module header                          │
│ AI Agent      │ Editor / identity / results            │
│ Settings      │ Loading, empty, error, success states   │
└───────────────┴────────────────────────────────────────┘

Popup                         Side panel
┌──────────────────────┐      ┌────────────────────────┐
│ Brand       Settings │      │ Brand             Open │
│ Current org + env    │      │ Current org + env      │
│ SOQL      Org Info   │      │ Quick tools            │
│ Open workspace       │      │ Scoped status/callout  │
└──────────────────────┘      └────────────────────────┘
```
