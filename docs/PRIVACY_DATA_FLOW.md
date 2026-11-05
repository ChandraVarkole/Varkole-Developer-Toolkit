# Privacy and data flow

Varkole has no hosted service in this flow. Salesforce data normally moves only between the user's
browser and Salesforce. When a user asks AI Agent a question, Varkole automatically retrieves a
bounded set of Salesforce metadata and record values relevant to that question and sends them
directly from the extension to the provider selected by the user.

- Chrome cookie store: Varkole reads the active org's `sid` through the cookies API. It is used locally as a Salesforce API bearer session and is not copied into persistent storage.
- Session storage: browser-session domain/source metadata, OAuth fallback access/refresh tokens,
  and the selected AI provider key/model configuration. This is the default for provider keys and
  is cleared with the Chrome session or extension reload.
- Local storage: org/user IDs, username/display name, org label, environment, instance URL, API
  version, timestamps, and up to 50 successful query-history entries per org. Query results are not
  stored. If the user explicitly selects **Remember key for 8 hours**, the provider key and model
  configuration are also stored locally with an expiration timestamp and deleted after eight hours
  or immediately when **Forget key** is selected. Chrome local storage is not encrypted, so this
  option is intended only for trusted, non-shared Chrome profiles.
- In memory/UI: current query text and current result page. Results are not persisted.
- Network: Salesforce identity and REST/Tooling requests; OAuth only when the fallback is selected.
  When AI Agent is configured and the user explicitly sends a question, the automatically selected context and
  recent chat messages go directly to OpenAI, Anthropic, Google Gemini, or Amazon Bedrock. Varkole
  infrastructure is not in that path.

Disconnecting a browser-session org only forgets it in Varkole and does not log the user out of Salesforce. Disconnecting OAuth attempts token revocation. No analytics or telemetry is installed.

Before a public release, the extension must add an affirmative in-product AI data-sharing consent
that names the selected provider and explains that Salesforce schema and record values can be sent.
The public privacy policy and Chrome Web Store privacy declarations must match this document.
