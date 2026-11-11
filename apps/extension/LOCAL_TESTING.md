# Local extension updates

Load `apps/extension/dist` in `chrome://extensions` one time.

For later versions:

1. Run `npm run build` from the repository root.
2. In Varkole, select **Reload latest build** (or select **Reload** in
   `chrome://extensions`).
3. Refresh open Salesforce tabs once so the new content script is installed.

Do not load a `varkole-developer-toolkit-vX.Y.Z-beta` folder for owner development. Those
versioned folders and ZIP files are immutable release snapshots for external testers and do not
change when a newer version is built.
