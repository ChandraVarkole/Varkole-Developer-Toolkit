# Privacy and data flow

Varkole has no hosted service in this flow. Salesforce data normally moves only between the user's
browser and Salesforce. When a user asks AI Agent a question, Varkole automatically retrieves a
bounded set of Salesforce metadata and record values relevant to that question and sends them
directly from the extension to the provider selected by the user.

- Chrome cookie store: Varkole reads the active org's `sid` through the cookies API. It is used locally as a Salesforce API bearer session and is not copied into persistent storage.
- Session storage: browser-session domain/source metadata, OAuth fallback access/refresh tokens,
  the selected AI provider key/model configuration, and the user's provider-specific AI data-sharing
  consent. AI provider keys expire after at most eight hours. Session values are also cleared by
  the applicable disconnect/forget controls and can be cleared by Chrome or an extension reload.
- Local storage: org/user IDs, username/display name, org label, environment, instance URL, API
  version, timestamps, and up to 50 successful query-history entries per org. Query results are not
  stored. Provider API keys are never written to local or sync storage. Version 0.6.5 also deletes
  provider keys that an earlier preview may have saved locally.
- In memory/UI: current query text and result page, recent AI chat messages, and bounded structured
  AI lookup evidence used for follow-up grounding. Evidence can include queries, retrieved records,
  timestamps, relationship coverage, completeness, and errors. It is cleared with the extension
  page/reload and is never written to local or sync storage.
- Network: Salesforce identity and REST/Tooling requests; OAuth only when the fallback is selected.
  After the user affirmatively approves the provider-specific disclosure and sends a question, the
  automatically selected context and recent chat messages go directly to OpenAI, Anthropic, Google
  Gemini, or Amazon Bedrock. Varkole infrastructure is not in that path.

Disconnecting a browser-session org only forgets it in Varkole and does not log the user out of Salesforce. Disconnecting OAuth attempts token revocation. No analytics or telemetry is installed.

The public privacy policy and Chrome Web Store privacy declarations must match this document.
