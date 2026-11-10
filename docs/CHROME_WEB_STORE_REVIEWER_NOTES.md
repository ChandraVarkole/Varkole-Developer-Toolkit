# Chrome Web Store reviewer notes

## Single purpose

Varkole Developer Toolkit provides read-only Salesforce inspection and developer utilities in the
current signed-in Salesforce browser session, plus clearly guarded developer actions such as
execute-anonymous Apex.

## Basic review path

1. Install the extension and open a Salesforce Developer Edition or sandbox org in the same Chrome
   profile.
2. Sign in to Salesforce normally. Varkole never asks for the Salesforce password.
3. Refresh that Salesforce tab once, click the Varkole toolbar icon, and verify the right-side drawer
   opens without navigating away.
4. Open **SOQL**, enter a query available to the test user, and run it. Results should respect that
   user's Salesforce object, field, sharing, and record access.
5. Open **Record Inspector** from a Salesforce record page and verify the current record is detected.
6. Review **Org Info**, **Debug Logs**, **Code Coverage**, and the remaining read-only tabs. Results
   vary with the Salesforce permissions assigned to the reviewer account.

## Authentication behavior

The normal path reads the active Salesforce `sid` cookie through Chrome's cookies API and uses it
only for Salesforce API requests. The value is never returned to the UI or persisted by Varkole.
OAuth PKCE is an optional fallback for Salesforce orgs that enforce API Access Control.

## AI Agent review path

AI Agent is optional and requires a provider API key supplied by the reviewer. Provider host access
is requested only after the reviewer selects **Save & test**.

1. Connect OpenAI, Anthropic, Gemini, or Amazon Bedrock with a valid test key/model.
2. Confirm that the connection test states no Salesforce data is included.
3. Verify that Varkole displays a disclosure naming the provider and listing the Salesforce and
   conversation data categories before the chat becomes available.
4. Do not approve the disclosure; verify AI questions cannot be sent.
5. Approve the checkbox and select **Approve and continue**. Ask a read-only org question and verify
   the answer is based on data accessible to the current Salesforce user.
6. Optionally ask about a named Apex class or Lightning component. Verify Varkole reads only source
   returned by Salesforce's Tooling API for the current user and does not execute the code.
7. Select **Forget key** and verify the AI connection and consent are removed.

Provider keys and consent are stored only in trusted-context Chrome session storage. No AI provider
key, Salesforce record value, query result, or AI answer is persisted in local or sync storage.

## Production safety

Read-only tools identify production clearly. Execute-anonymous Apex is guarded by explicit
production acknowledgement and typed confirmation. Reviewers should use a sandbox and must not run
write operations in a production org.

## Support and privacy

- Privacy policy: `docs/PRIVACY_POLICY.md` in the public repository
- Support: https://github.com/ChandraVarkole/Varkole-Developer-Toolkit/issues
