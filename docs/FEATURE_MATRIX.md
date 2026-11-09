# Feature and permission matrix

“Shell” means the module is visible but deliberately unavailable; it is not complete.

| Module / capability          | Salesforce API                        | Typical access needed                      | Phase 1 status                                                                 |
| ---------------------------- | ------------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------ |
| Current-session identity     | `sid` cookie / Identity / REST        | Signed-in Salesforce tab and API access    | Implemented; real-org verification pending                                     |
| OAuth fallback               | OAuth 2.0 / Identity                  | External Client App authorization          | Implemented; API Access Control test pending                                   |
| Multi-org selector/isolation | Local extension + org/user identity   | Current browser sessions or OAuth          | Implemented; two-real-org test pending                                         |
| Org Info identity            | REST Query `Organization`             | API Enabled; readable Organization fields  | Implemented                                                                    |
| Org limits                   | REST `/limits`                        | API Enabled; returned limits vary          | Implemented with unavailable state                                             |
| SOQL query                   | REST `/query`                         | API Enabled plus object/field access       | Implemented                                                                    |
| SOQL pagination              | REST query locator                    | Same as original query                     | Implemented; origin pinned                                                     |
| Tooling query                | Tooling `/query`                      | API Enabled and Tooling/object permissions | Implemented                                                                    |
| Records inspect/search       | REST Query / sObject Describe         | Object, record, field permissions          | Implemented: automatic current-record lookup, all accessible fields and search |
| Records writes               | REST/UI API                           | CRUD/FLS/sharing plus confirmations        | Phase 2                                                                        |
| Export                       | REST Query                            | Object and field permissions               | Preview: CSV/JSON up to 5,000 loaded rows                                      |
| Import                       | Local CSV / future REST/Bulk API 2.0  | CRUD/FLS plus Bulk permissions             | Preview: parse/mapping; writes disabled                                        |
| Run-Apex                     | Tooling execute anonymous / ApexLog   | Author Apex, API Enabled and trace flag    | Preview: guarded execution with matching inline debug log                      |
| Debug Logs                   | Tooling Query / ApexLog Body          | Apex/log visibility varies                 | Implemented: inline viewer and bounded body search                             |
| Code Coverage                | Tooling ApexCodeCoverageAggregate     | Apex/test visibility varies                | Implemented: line totals and calculated percentages                            |
| Users / Access               | REST Query                            | Setup/user/permission visibility varies    | Preview: read-only lists                                                       |
| Metadata                     | REST `/sobjects` and Describe         | Object and field visibility                | Implemented: A–Z object/field schema plus child-relationship metadata          |
| App Tabs                     | REST `/tabs`                          | Tabs visible to current user               | Preview: read-only available-tab list                                          |
| AI Agent                     | OpenAI / Anthropic / Gemini / Bedrock | Provider key plus Salesforce access        | Preview: relationship-aware retrieval with retained evidence and answer gating |
| Repository context           | Future GitHub / Azure / Bitbucket API | Separate repository authorization          | Deferred until after initial store review                                      |
