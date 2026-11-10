import { useEffect, useMemo, useRef, useState } from 'react';
import type {
  AiChatMessage,
  AiConnectionStatus,
  AiProvider,
  OrgIdentity,
  OrgInfo,
  QueryPage,
  SalesforceObjectDescribe,
  SalesforceObjectSummary,
} from '@varkole/shared';
import { sendMessage } from '../api';
import { providerOrigin } from '../ai-provider';
import { MarkdownMessage } from '../components/MarkdownMessage';
import { EmptyState, InlineError } from '../components/Status';
import {
  buildAiPlanningContext,
  buildAutomaticAiContext,
  parseAiReadPlan,
  type AiQueryObservation,
} from './ai-context';
import {
  evidenceAnswerIssue,
  mergeAiEvidence,
  mergeQueryPages,
  relatedDescribeNames,
  relationshipEvidenceForQuery,
  selectRelevantAiObjects,
  shouldRequestDataGapPlan,
  shouldRequestRelationshipGapPlan,
} from './ai-evidence';

const MAX_CHAT_MESSAGES = 18;
const MAX_PROMPT_CHARACTERS = 7_000;

const PROVIDERS: {
  id: AiProvider;
  label: string;
  model: string;
  hint: string;
}[] = [
  {
    id: 'openai',
    label: 'OpenAI · GPT / Codex models',
    model: 'gpt-6-luna',
    hint: 'Use an OpenAI Platform API key. ChatGPT billing is separate.',
  },
  {
    id: 'anthropic',
    label: 'Anthropic · Claude',
    model: 'claude-sonnet-5-5',
    hint: 'Use an Anthropic Console API key and an enabled model.',
  },
  {
    id: 'gemini',
    label: 'Google · Gemini',
    model: 'gemini-3.8-flash',
    hint: 'Use a Gemini API key from Google AI Studio.',
  },
  {
    id: 'bedrock',
    label: 'Amazon Bedrock',
    model: 'us.anthropic.claude-sonnet-4-6-v1',
    hint: 'Use a Bedrock API key, AWS region, and enabled model.',
  },
];

const transientChatByOrg = new Map<string, AiChatMessage[]>();
const orgFoundationCache = new Map<
  string,
  Promise<{ objects: SalesforceObjectSummary[]; orgInfo?: OrgInfo | undefined }>
>();
const describeCache = new Map<string, Promise<SalesforceObjectDescribe>>();
const transientEvidenceByOrg = new Map<string, AiQueryObservation[]>();

export function AiAgentPage({
  org,
  currentRecordId,
  settingsRequest = 0,
}: {
  org?: OrgIdentity | undefined;
  currentRecordId?: string | undefined;
  settingsRequest?: number;
}) {
  const [status, setStatus] = useState<AiConnectionStatus>({ configured: false });
  const [statusLoaded, setStatusLoaded] = useState(false);
  const [showConnection, setShowConnection] = useState(false);
  const [provider, setProvider] = useState<AiProvider>('openai');
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState(PROVIDERS[0]!.model);
  const [region, setRegion] = useState('us-east-1');
  const [consentChecked, setConsentChecked] = useState(false);
  const [grantingConsent, setGrantingConsent] = useState(false);
  const [messages, setMessages] = useState<AiChatMessage[]>(() =>
    org ? (transientChatByOrg.get(org.key) ?? []) : [],
  );
  const [prompt, setPrompt] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [asking, setAsking] = useState(false);
  const [progress, setProgress] = useState('');
  const [copiedMessage, setCopiedMessage] = useState<number>();
  const [error, setError] = useState<string>();
  const threadRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void sendMessage<AiConnectionStatus>({ type: 'GET_AI_STATUS' })
      .then((next) => {
        setStatus(next);
        setShowConnection(!next.configured);
        if (next.provider) setProvider(next.provider);
        if (next.model) setModel(next.model);
        if (next.region) setRegion(next.region);
      })
      .catch((cause: unknown) => {
        setShowConnection(true);
        setError(cause instanceof Error ? cause.message : 'AI provider status could not load.');
      })
      .finally(() => setStatusLoaded(true));
  }, []);

  useEffect(() => {
    if (settingsRequest > 0) setShowConnection(true);
  }, [settingsRequest]);

  useEffect(() => {
    const thread = threadRef.current;
    if (!thread) return;
    const frame = window.requestAnimationFrame(() => {
      thread.scrollTo({ top: thread.scrollHeight, behavior: 'smooth' });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [messages, asking]);

  useEffect(() => {
    if (org) transientChatByOrg.set(org.key, messages);
  }, [messages, org]);

  const providerInfo = useMemo(
    () => PROVIDERS.find((candidate) => candidate.id === provider) ?? PROVIDERS[0]!,
    [provider],
  );
  const canReuseSessionKey = status.configured && status.provider === provider;

  function changeProvider(next: AiProvider) {
    setProvider(next);
    setModel(PROVIDERS.find((candidate) => candidate.id === next)?.model ?? '');
    setApiKey('');
    setConsentChecked(false);
    setError(undefined);
  }

  async function connectProvider() {
    setConnecting(true);
    setError(undefined);
    try {
      const origin = providerOrigin({ provider, region });
      const allowed = await chrome.permissions.request({ origins: [origin] });
      if (!allowed) throw new Error('Provider access was not granted.');
      const next = await sendMessage<AiConnectionStatus>({
        type: 'CONFIGURE_AI',
        payload: {
          provider,
          apiKey,
          model,
          ...(provider === 'bedrock' ? { region } : {}),
        },
      });
      setStatus(next);
      setApiKey('');
      setConsentChecked(false);
      setMessages([]);
      if (org) transientEvidenceByOrg.delete(org.key);
      setShowConnection(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The AI provider could not connect.');
    } finally {
      setConnecting(false);
    }
  }

  async function disconnectProvider() {
    setError(undefined);
    try {
      setStatus(await sendMessage<AiConnectionStatus>({ type: 'DISCONNECT_AI' }));
      setMessages([]);
      if (org) transientEvidenceByOrg.delete(org.key);
      setConsentChecked(false);
      setShowConnection(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The AI provider could not disconnect.');
    }
  }

  async function grantDataConsent() {
    if (!consentChecked || grantingConsent) return;
    setGrantingConsent(true);
    setError(undefined);
    try {
      setStatus(await sendMessage<AiConnectionStatus>({ type: 'GRANT_AI_DATA_CONSENT' }));
      setConsentChecked(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'AI data sharing could not be approved.');
    } finally {
      setGrantingConsent(false);
    }
  }

  async function askAgent() {
    const question = prompt.trim();
    if (!question || !org || !status.configured || !status.dataConsentGranted || asking) return;
    if (messages.length >= MAX_CHAT_MESSAGES) {
      setError(
        'This chat has reached its context limit. Click Clear Chat and start a new chat, then ask a narrower question.',
      );
      return;
    }
    if (question.length > MAX_PROMPT_CHARACTERS) {
      setError(
        `This question is over the ${MAX_PROMPT_CHARACTERS.toLocaleString()}-character limit. Shorten it, or click Clear Chat and start a focused chat.`,
      );
      return;
    }
    const userMessage: AiChatMessage = { role: 'user', content: question };
    const conversation = [...messages, userMessage].slice(-19);
    const planningTranscript = conversation
      .map((message) => `${message.role === 'user' ? 'User' : 'AI Agent'}: ${message.content}`)
      .join('\n')
      .slice(-20_000);
    const userTranscript = conversation
      .filter((message) => message.role === 'user')
      .map((message) => message.content)
      .join('\n')
      .slice(-12_000);
    setMessages(conversation);
    setPrompt('');
    setAsking(true);
    setError(undefined);
    try {
      setProgress('Reading your accessible org metadata…');
      const { objects, orgInfo } = await loadOrgFoundation(org);
      const currentRecordObject = currentRecordId
        ? objects.find((object) => object.keyPrefix === currentRecordId.slice(0, 3))
        : undefined;
      const pageContextRequested = /\b(this|current|record|it|summarize|related|page)\b/i.test(
        planningTranscript,
      );
      const lookupTranscript =
        currentRecordObject && pageContextRequested
          ? `${planningTranscript}\nPage context verified by Varkole: the current Salesforce page is ${currentRecordObject.label} (${currentRecordObject.name}) record ${currentRecordId}.`
          : planningTranscript;

      const retainedEvidence = transientEvidenceByOrg.get(org.key) ?? [];
      const seedNames = [
        ...new Set([
          ...selectRelevantAiObjects(objects, lookupTranscript),
          ...(currentRecordObject && pageContextRequested ? [currentRecordObject.name] : []),
        ]),
      ].slice(0, 5);
      const seedDescribes = await loadDescribes(org, seedNames);
      const planningDescribeNames = relatedDescribeNames(seedDescribes, objects, seedNames, 6);
      let describes = await loadDescribes(org, planningDescribeNames);

      setProgress('Planning safe read-only lookups…');
      const planResponse = await sendMessage<string>({
        type: 'ASK_AI',
        payload: {
          messages: [
            {
              role: 'user',
              content: `Create the minimum read-only Salesforce retrieval plan needed for the latest request, using the full conversation and verified page context for references and follow-ups:\n${lookupTranscript}`,
            },
          ],
          salesforceContext: buildAiPlanningContext(
            org,
            objects,
            lookupTranscript,
            describes,
            retainedEvidence,
            userTranscript,
          ),
          maxOutputTokens: 700,
        },
      });
      const plan = parseAiReadPlan(planResponse, objects);

      setProgress('Running permitted Salesforce lookups…');
      describes = mergeDescribes(describes, await loadDescribes(org, plan.objects));
      const accessQueries = /\b(access|permission|profile|admin|privilege|authoriz)/i.test(
        lookupTranscript,
      )
        ? currentUserAccessQueries(org.userId)
        : [];
      const analyticsQueries = analyticsDiscoveryQueries(lookupTranscript);
      const pageQueries = currentRecordQueries(
        currentRecordId,
        currentRecordObject?.name,
        planningTranscript,
      );
      const queries = [
        ...new Set([...accessQueries, ...pageQueries, ...analyticsQueries, ...plan.queries]),
      ].slice(0, 8);
      let currentEvidence = await Promise.all(queries.map((query) => runAiQuery(org, query)));

      if (shouldRequestRelationshipGapPlan(lookupTranscript, currentEvidence)) {
        setProgress('Checking direct Salesforce relationships…');
        const gapPlanResponse = await sendMessage<string>({
          type: 'ASK_AI',
          payload: {
            messages: [
              {
                role: 'user',
                content:
                  'Return only the additional read-only Salesforce plan needed to close relationship evidence gaps. Do not repeat completed queries. For Case relationships, Case.ContactId is required; CaseContactRole alone is insufficient.',
              },
            ],
            salesforceContext: buildAiPlanningContext(
              org,
              objects,
              lookupTranscript,
              describes,
              mergeAiEvidence(retainedEvidence, currentEvidence),
              userTranscript,
            ),
            maxOutputTokens: 700,
          },
        });
        const gapPlan = parseAiReadPlan(gapPlanResponse, objects);
        describes = mergeDescribes(describes, await loadDescribes(org, gapPlan.objects));
        const completed = new Set(currentEvidence.map((item) => item.query.toLowerCase()));
        const gapQueries = gapPlan.queries
          .filter((query) => !completed.has(query.toLowerCase()))
          .slice(0, Math.max(0, 10 - currentEvidence.length));
        currentEvidence = [
          ...currentEvidence,
          ...(await Promise.all(gapQueries.map((query) => runAiQuery(org, query)))),
        ];
      }

      if (shouldRequestDataGapPlan(lookupTranscript, currentEvidence)) {
        setProgress('Closing Salesforce evidence gaps…');
        const gapPlanResponse = await sendMessage<string>({
          type: 'ASK_AI',
          payload: {
            messages: [
              {
                role: 'user',
                content:
                  'Return only the additional read-only Salesforce plan required to answer the latest data question completely. Do not repeat completed queries. Use aggregate SOQL for calculations, Report or Dashboard for analytics discovery, and exact object/field names from the supplied schemas.',
              },
            ],
            salesforceContext: buildAiPlanningContext(
              org,
              objects,
              lookupTranscript,
              describes,
              mergeAiEvidence(retainedEvidence, currentEvidence),
              userTranscript,
            ),
            maxOutputTokens: 700,
          },
        });
        const gapPlan = parseAiReadPlan(gapPlanResponse, objects);
        describes = mergeDescribes(describes, await loadDescribes(org, gapPlan.objects));
        const completed = new Set(currentEvidence.map((item) => item.query.toLowerCase()));
        const gapQueries = gapPlan.queries
          .filter((query) => !completed.has(query.toLowerCase()))
          .slice(0, Math.max(0, 10 - currentEvidence.length));
        currentEvidence = [
          ...currentEvidence,
          ...(await Promise.all(gapQueries.map((query) => runAiQuery(org, query)))),
        ];
      }

      if (shouldLoadAnalyticsResults(lookupTranscript)) {
        setProgress('Reading accessible report and dashboard results…');
        currentEvidence = [
          ...currentEvidence,
          ...(await loadAnalyticsEvidence(org, currentEvidence, lookupTranscript)),
        ];
      }

      const evidence = mergeAiEvidence(retainedEvidence, currentEvidence);
      transientEvidenceByOrg.set(org.key, evidence);

      setProgress('Writing an answer from the accessible results…');
      const salesforceContext = buildAutomaticAiContext({
        org,
        orgInfo,
        objects,
        describes,
        observations: evidence,
        focus: lookupTranscript,
        userFocus: userTranscript,
      });
      let answer = await sendMessage<string>({
        type: 'ASK_AI',
        payload: {
          messages: conversation,
          salesforceContext,
          maxOutputTokens: 4_000,
        },
      });
      const evidenceIssue = evidenceAnswerIssue(answer, evidence);
      if (evidenceIssue) {
        setProgress('Validating Salesforce evidence…');
        answer = await sendMessage<string>({
          type: 'ASK_AI',
          payload: {
            messages: [
              ...conversation,
              {
                role: 'user' as const,
                content: `Rewrite the answer to satisfy this evidence validation failure: ${evidenceIssue} Cite factual Salesforce claims only with supplied [E#] evidence. Clearly label anything not inspected, partial, or errored.`,
              },
            ].slice(-20),
            salesforceContext,
            maxOutputTokens: 4_000,
          },
        });
        const remainingIssue = evidenceAnswerIssue(answer, evidence);
        if (remainingIssue) {
          throw new Error(
            `AI Agent withheld an ungrounded response. ${remainingIssue} Please retry the question.`,
          );
        }
      }
      const assistantMessage: AiChatMessage = { role: 'assistant', content: answer };
      setMessages([...conversation, assistantMessage].slice(-20));
    } catch (cause) {
      setError(friendlyAiError(cause));
    } finally {
      setProgress('');
      setAsking(false);
    }
  }

  async function copyResponse(content: string, index: number) {
    await navigator.clipboard.writeText(content);
    setCopiedMessage(index);
    window.setTimeout(
      () => setCopiedMessage((current) => (current === index ? undefined : current)),
      1_500,
    );
  }

  return (
    <div className="page-stack ai-agent-page">
      <header className="page-header ai-agent-header">
        <div>
          <div className="eyebrow">Provider-direct · automatically grounded · read-only</div>
          <h1>AI Agent</h1>
          <p>Ask about your org without preparing queries or context.</p>
        </div>
        {status.configured && (
          <div className="ai-connected-badge">
            <span>Connected</span>
            <strong>{PROVIDERS.find((item) => item.id === status.provider)?.label}</strong>
            <code>{status.model}</code>
            <small>Key kept for up to 8 hours in this browser session</small>
            <button type="button" onClick={() => setShowConnection((current) => !current)}>
              {showConnection ? 'Hide settings' : 'Change'}
            </button>
          </div>
        )}
      </header>

      {!org && <InlineError message={error} />}

      {statusLoaded && showConnection && (
        <section className="section-card ai-connection-card">
          <div className="section-title">
            <div>
              <h2>{status.configured ? 'Provider settings' : 'Connect your model'}</h2>
              <p>The key is kept in temporary browser-session storage for up to 8 hours.</p>
            </div>
            {status.configured && (
              <button
                className="button button-ghost danger-text"
                type="button"
                onClick={() => void disconnectProvider()}
              >
                Forget key
              </button>
            )}
          </div>
          <div className="ai-provider-grid">
            <label>
              <span>Provider</span>
              <select
                value={provider}
                onChange={(event) => changeProvider(event.target.value as AiProvider)}
              >
                {PROVIDERS.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Model</span>
              <input
                value={model}
                onChange={(event) => setModel(event.target.value)}
                autoComplete="off"
              />
            </label>
            {provider === 'bedrock' && (
              <label>
                <span>AWS region</span>
                <input
                  value={region}
                  onChange={(event) => setRegion(event.target.value)}
                  placeholder="us-east-1"
                  autoComplete="off"
                />
              </label>
            )}
            <label className="ai-key-field">
              <span>API key</span>
              <input
                type="password"
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
                placeholder={canReuseSessionKey ? 'Current session key will be reused' : 'API key'}
                autoComplete="off"
                spellCheck={false}
              />
            </label>
            <button
              className="button button-primary"
              type="button"
              disabled={connecting || (!apiKey.trim() && !canReuseSessionKey) || !model.trim()}
              onClick={() => void connectProvider()}
            >
              {connecting ? 'Testing…' : status.configured ? 'Save changes' : 'Save & test'}
            </button>
          </div>
          <p className="ai-provider-hint">{providerInfo.hint}</p>
        </section>
      )}

      {!org ? (
        <EmptyState
          title="Open a Salesforce org"
          description="AI Agent answers from the current Salesforce browser session."
        />
      ) : status.configured && !status.dataConsentGranted ? (
        <section className="section-card ai-consent-card" aria-labelledby="ai-consent-title">
          <div className="ai-consent-icon" aria-hidden="true">
            ✓
          </div>
          <div className="ai-consent-content">
            <div className="eyebrow">Approval required</div>
            <h2 id="ai-consent-title">Approve AI data sharing for this browser session</h2>
            <p>
              When you ask a question, Varkole sends it directly to{' '}
              <strong>
                {PROVIDERS.find((item) => item.id === status.provider)?.label ??
                  'your selected provider'}
              </strong>{' '}
              together with only the accessible Salesforce context needed to answer it.
            </p>
            <ul>
              <li>Org and current-user identity</li>
              <li>Relevant object and field metadata</li>
              <li>Relevant query results and record values</li>
              <li>Recent messages needed to understand follow-up questions</li>
            </ul>
            <p>
              Data goes from this extension to the selected provider—no Varkole server is in the
              path. The provider handles it under its own terms and privacy policy. AI Agent remains
              read-only and cannot write Salesforce records or run Apex.
            </p>
            <label className="ai-consent-check">
              <input
                type="checkbox"
                checked={consentChecked}
                onChange={(event) => setConsentChecked(event.target.checked)}
              />
              <span>
                I understand and approve this data sharing with the selected provider for this
                browser session.
              </span>
            </label>
            <button
              className="button button-primary"
              type="button"
              disabled={!consentChecked || grantingConsent}
              onClick={() => void grantDataConsent()}
            >
              {grantingConsent ? 'Approving…' : 'Approve and continue'}
            </button>
            {error && <InlineError message={error} />}
          </div>
        </section>
      ) : (
        <section className="section-card ai-chat-card ai-chat-primary">
          <div className="section-title">
            <div>
              <h2>Ask about {org.organizationName}</h2>
              <p>
                Varkole automatically reads the schema and records needed for each question using
                your current Salesforce access.
              </p>
            </div>
            {messages.length > 0 && (
              <button
                className="button button-ghost"
                type="button"
                onClick={() => {
                  setMessages([]);
                  transientEvidenceByOrg.delete(org.key);
                  setError(undefined);
                }}
              >
                Clear Chat
              </button>
            )}
          </div>
          {messages.length === 0 ? (
            <div className="ai-starters">
              {[
                'Summarize this org and flag anything I should review.',
                'Show the reports and dashboards I can access, then explain the most relevant one.',
                'Help me design a Flow using the real fields on an object in this org.',
              ].map((starter) => (
                <button key={starter} type="button" onClick={() => setPrompt(starter)}>
                  {starter}
                </button>
              ))}
            </div>
          ) : (
            <div className="ai-thread" aria-live="polite" ref={threadRef}>
              {messages.map((message, index) => (
                <article className={`ai-message ${message.role}`} key={`${message.role}-${index}`}>
                  <div className="ai-message-header">
                    <strong>{message.role === 'assistant' ? 'AI Agent' : 'You'}</strong>
                    {message.role === 'assistant' && (
                      <button
                        type="button"
                        onClick={() => void copyResponse(message.content, index)}
                      >
                        {copiedMessage === index ? 'Copied' : 'Copy'}
                      </button>
                    )}
                  </div>
                  {message.role === 'assistant' ? (
                    <MarkdownMessage
                      content={message.content}
                      allowedOrigin={new URL(org.instanceUrl).origin}
                    />
                  ) : (
                    <p>{message.content}</p>
                  )}
                </article>
              ))}
              {asking && (
                <div className="ai-thinking">
                  <span className="spinner" /> {progress || 'Working…'}
                </div>
              )}
            </div>
          )}
          {error && (
            <div className="ai-composer-error" role="alert">
              <span aria-hidden="true">!</span>
              <div>
                <strong>Could not complete the request</strong>
                <p>{error}</p>
              </div>
              <button type="button" aria-label="Dismiss error" onClick={() => setError(undefined)}>
                ×
              </button>
            </div>
          )}
          <div className={`ai-composer ${error ? 'has-error' : ''}`}>
            <textarea
              value={prompt}
              onChange={(event) => {
                setPrompt(event.target.value);
                if (error) setError(undefined);
              }}
              onKeyDown={(event) => {
                if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
                  event.preventDefault();
                  void askAgent();
                }
              }}
              placeholder="Ask anything about this Salesforce org…"
            />
            <button
              className="button button-primary"
              type="button"
              disabled={
                !status.configured || !status.dataConsentGranted || !prompt.trim() || asking
              }
              onClick={() => void askAgent()}
            >
              {asking ? 'Working…' : 'Ask AI Agent'}
            </button>
          </div>
          <div className="ai-composer-meta">
            <span>
              {prompt.length.toLocaleString()} / {MAX_PROMPT_CHARACTERS.toLocaleString()} characters
            </span>
            {messages.length >= MAX_CHAT_MESSAGES - 2 && (
              <strong>This chat is nearly full. Use Clear Chat before starting a new topic.</strong>
            )}
          </div>
          {!status.configured && (
            <p className="muted ai-chat-note">Connect a provider once to start asking questions.</p>
          )}
          <p className="muted ai-chat-note">
            Answers are not stored. Relevant accessible results are sent directly to your selected
            provider; AI Agent cannot write records or run Apex.
          </p>
          <p className="muted ai-chat-note ai-disclaimer">
            AI can make mistakes. Verify important Salesforce data, calculations, and
            recommendations before taking action.
          </p>
        </section>
      )}
    </div>
  );
}

async function loadOrgFoundation(
  org: OrgIdentity,
): Promise<{ objects: SalesforceObjectSummary[]; orgInfo?: OrgInfo | undefined }> {
  const cached = orgFoundationCache.get(org.key);
  if (cached) return cached;
  const request = Promise.all([
    sendMessage<SalesforceObjectSummary[]>({
      type: 'GET_OBJECTS',
      payload: { key: org.key },
    }),
    sendMessage<OrgInfo>({ type: 'GET_ORG_INFO', payload: { key: org.key } }).catch(
      () => undefined,
    ),
  ])
    .then(([objects, orgInfo]) => ({ objects, orgInfo }))
    .catch((cause: unknown) => {
      orgFoundationCache.delete(org.key);
      throw cause;
    });
  orgFoundationCache.set(org.key, request);
  return request;
}

async function loadObjectDescribe(
  org: OrgIdentity,
  objectApiName: string,
): Promise<SalesforceObjectDescribe> {
  const key = `${org.key}:${objectApiName}`;
  const cached = describeCache.get(key);
  if (cached) return cached;
  const request = sendMessage<SalesforceObjectDescribe>({
    type: 'DESCRIBE_OBJECT',
    payload: { key: org.key, objectApiName },
  }).catch((cause: unknown) => {
    describeCache.delete(key);
    throw cause;
  });
  describeCache.set(key, request);
  return request;
}

async function loadDescribes(
  org: OrgIdentity,
  objectApiNames: string[],
): Promise<SalesforceObjectDescribe[]> {
  return (
    await Promise.all(
      [...new Set(objectApiNames)].map((objectApiName) =>
        loadObjectDescribe(org, objectApiName).catch(() => undefined),
      ),
    )
  ).filter((describe): describe is SalesforceObjectDescribe => Boolean(describe));
}

function mergeDescribes(
  current: SalesforceObjectDescribe[],
  additional: SalesforceObjectDescribe[],
): SalesforceObjectDescribe[] {
  return [
    ...new Map([...current, ...additional].map((describe) => [describe.name, describe])).values(),
  ];
}

async function runAiQuery(org: OrgIdentity, query: string): Promise<AiQueryObservation> {
  const maxRecords = 500;
  const maxPages = 3;
  const retrievedAt = new Date().toISOString();
  try {
    const pages: QueryPage[] = [
      await sendMessage<QueryPage>({
        type: 'RUN_QUERY',
        payload: {
          key: org.key,
          soql: query,
          mode: 'rest',
          requestId: crypto.randomUUID(),
        },
      }),
    ];
    while (
      pages.length < maxPages &&
      pages.reduce((count, page) => count + page.records.length, 0) < maxRecords &&
      pages.at(-1)?.nextRecordsUrl
    ) {
      pages.push(
        await sendMessage<QueryPage>({
          type: 'QUERY_NEXT',
          payload: {
            key: org.key,
            nextRecordsUrl: pages.at(-1)!.nextRecordsUrl!,
            requestId: crypto.randomUUID(),
          },
        }),
      );
    }
    const last = pages.at(-1)!;
    const totalRetrieved = pages.reduce((count, page) => count + page.records.length, 0);
    const capped = Boolean(last.nextRecordsUrl) || totalRetrieved > maxRecords;
    return {
      query,
      result: mergeQueryPages(pages, maxRecords),
      retrievedAt,
      pages: pages.length,
      capped,
      relationships: relationshipEvidenceForQuery(query),
    };
  } catch (cause) {
    return {
      query,
      retrievedAt,
      relationships: relationshipEvidenceForQuery(query),
      error:
        cause instanceof Error
          ? cause.message
          : 'The current Salesforce user could not run this lookup.',
    };
  }
}

function currentUserAccessQueries(userId: string): string[] {
  if (!/^005[a-zA-Z0-9]{12,15}$/.test(userId)) return [];
  const userQuery =
    `SELECT Name, Username, UserType, IsActive, Profile.Name, ` +
    `Profile.PermissionsViewAllData, Profile.PermissionsModifyAllData, ` +
    `Profile.PermissionsManageUsers, Profile.PermissionsCustomizeApplication ` +
    `FROM User WHERE Id = '${userId}' LIMIT 1`;
  const assignmentsQuery =
    `SELECT PermissionSet.Label, PermissionSet.IsOwnedByProfile, ` +
    `PermissionSet.PermissionsViewAllData, PermissionSet.PermissionsModifyAllData, ` +
    `PermissionSet.PermissionsManageUsers, PermissionSet.PermissionsCustomizeApplication ` +
    `FROM PermissionSetAssignment WHERE AssigneeId = '${userId}' LIMIT 20`;
  return [userQuery, assignmentsQuery];
}

function analyticsDiscoveryQueries(conversation: string): string[] {
  const queries: string[] = [];
  if (/\breports?\b/i.test(conversation)) {
    queries.push('SELECT FIELDS(STANDARD) FROM Report LIMIT 100');
  }
  if (/\bdashboards?\b/i.test(conversation)) {
    queries.push('SELECT FIELDS(STANDARD) FROM Dashboard LIMIT 100');
  }
  return queries;
}

function currentRecordQueries(
  recordId: string | undefined,
  objectApiName: string | undefined,
  conversation: string,
): string[] {
  if (
    !recordId ||
    !objectApiName ||
    !/^[A-Za-z0-9]{15}(?:[A-Za-z0-9]{3})?$/.test(recordId) ||
    !/\b(this|current|record|it|summarize|related|page)\b/i.test(conversation)
  ) {
    return [];
  }
  return [`SELECT FIELDS(STANDARD) FROM ${objectApiName} WHERE Id = '${recordId}' LIMIT 1`];
}

function shouldLoadAnalyticsResults(conversation: string): boolean {
  return (
    /\b(reports?|dashboards?)\b/i.test(conversation) &&
    /\b(analy[sz]e|explain|run|results?|data|details?|metrics?|summary|summarize|calculate|insights?)\b/i.test(
      conversation,
    )
  );
}

async function loadAnalyticsEvidence(
  org: OrgIdentity,
  observations: AiQueryObservation[],
  conversation: string,
): Promise<AiQueryObservation[]> {
  const candidates = observations
    .flatMap((observation) => observation.result?.records ?? [])
    .flatMap((record) => {
      const id = typeof record.Id === 'string' ? record.Id : '';
      const kind: 'report' | 'dashboard' | undefined = id.startsWith('00O')
        ? 'report'
        : id.startsWith('01Z')
          ? 'dashboard'
          : undefined;
      if (!kind) return [];
      const label = [record.Name, record.Title, record.DeveloperName]
        .filter((value): value is string => typeof value === 'string')
        .join(' ');
      const score = label && conversation.toLowerCase().includes(label.toLowerCase()) ? 10 : 0;
      return [{ id, kind, label, score }];
    })
    .filter((candidate, index, all) => all.findIndex((item) => item.id === candidate.id) === index)
    .sort((left, right) => right.score - left.score || left.label.localeCompare(right.label))
    .slice(0, 2);
  return Promise.all(
    candidates.map((candidate) => runAiAnalytics(org, candidate.kind, candidate.id)),
  );
}

async function runAiAnalytics(
  org: OrgIdentity,
  kind: 'report' | 'dashboard',
  id: string,
): Promise<AiQueryObservation> {
  const retrievedAt = new Date().toISOString();
  const started = performance.now();
  const query = `ANALYTICS ${kind.toUpperCase()} ${id}`;
  try {
    const data = await sendMessage<Record<string, unknown>>(
      kind === 'report'
        ? { type: 'GET_REPORT_RESULT', payload: { key: org.key, reportId: id } }
        : { type: 'GET_DASHBOARD_RESULT', payload: { key: org.key, dashboardId: id } },
    );
    return {
      query,
      retrievedAt,
      pages: 1,
      capped: false,
      relationships: [],
      result: {
        totalSize: 1,
        done: true,
        records: [{ analyticsType: kind, resourceId: id, ...data }],
        elapsedMs: Math.round(performance.now() - started),
      },
    };
  } catch (cause) {
    return {
      query,
      retrievedAt,
      relationships: [],
      error:
        cause instanceof Error
          ? cause.message
          : `Salesforce could not read this ${kind} with the current user's access.`,
    };
  }
}

function friendlyAiError(cause: unknown): string {
  const message = cause instanceof Error ? cause.message : 'AI Agent could not answer.';
  if (
    /(?:context|token|message).*(?:limit|length|large|maximum)|(?:too large|under 8,000|between 1 and 20)/i.test(
      message,
    )
  ) {
    return 'This chat has reached the model context limit. Click Clear Chat and start a new chat, then ask a narrower question.';
  }
  return message;
}
