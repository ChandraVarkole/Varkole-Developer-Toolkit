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

export function AiAgentPage({ org }: { org?: OrgIdentity | undefined }) {
  const [status, setStatus] = useState<AiConnectionStatus>({ configured: false });
  const [statusLoaded, setStatusLoaded] = useState(false);
  const [showConnection, setShowConnection] = useState(false);
  const [provider, setProvider] = useState<AiProvider>('openai');
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState(PROVIDERS[0]!.model);
  const [region, setRegion] = useState('us-east-1');
  const [consentChecked, setConsentChecked] = useState(false);
  const [grantingConsent, setGrantingConsent] = useState(false);
  const [messages, setMessages] = useState<AiChatMessage[]>([]);
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
    const thread = threadRef.current;
    if (!thread) return;
    const frame = window.requestAnimationFrame(() => {
      thread.scrollTo({ top: thread.scrollHeight, behavior: 'smooth' });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [messages, asking]);

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
    const userMessage: AiChatMessage = { role: 'user', content: question };
    const conversation = [...messages, userMessage].slice(-9);
    const planningTranscript = conversation
      .map((message) => `${message.role === 'user' ? 'User' : 'AI Agent'}: ${message.content}`)
      .join('\n')
      .slice(-7_000);
    setMessages(conversation);
    setPrompt('');
    setAsking(true);
    setError(undefined);
    try {
      setProgress('Reading your accessible org metadata…');
      const [objects, orgInfo] = await Promise.all([
        sendMessage<SalesforceObjectSummary[]>({
          type: 'GET_OBJECTS',
          payload: { key: org.key },
        }),
        sendMessage<OrgInfo>({ type: 'GET_ORG_INFO', payload: { key: org.key } }).catch(
          () => undefined,
        ),
      ]);

      setProgress('Planning safe read-only lookups…');
      const planResponse = await sendMessage<string>({
        type: 'ASK_AI',
        payload: {
          messages: [
            {
              role: 'user',
              content: `Create the minimum read-only Salesforce retrieval plan needed for the latest request, using the full conversation for references and follow-ups:\n${planningTranscript}`,
            },
          ],
          salesforceContext: buildAiPlanningContext(org, objects, planningTranscript),
          maxOutputTokens: 500,
        },
      });
      const plan = parseAiReadPlan(planResponse, objects);

      setProgress('Running permitted Salesforce lookups…');
      const describes = (
        await Promise.all(
          plan.objects.map((objectApiName) =>
            sendMessage<SalesforceObjectDescribe>({
              type: 'DESCRIBE_OBJECT',
              payload: { key: org.key, objectApiName },
            }).catch(() => undefined),
          ),
        )
      ).filter((describe): describe is SalesforceObjectDescribe => Boolean(describe));
      const accessQueries = /\b(access|permission|profile|admin|privilege|authoriz)/i.test(
        planningTranscript,
      )
        ? currentUserAccessQueries(org.userId)
        : [];
      const queries = [...new Set([...accessQueries, ...plan.queries])].slice(0, 5);
      const observations: AiQueryObservation[] = await Promise.all(
        queries.map(async (query) => {
          try {
            const result = await sendMessage<QueryPage>({
              type: 'RUN_QUERY',
              payload: {
                key: org.key,
                soql: query,
                mode: 'rest',
                requestId: crypto.randomUUID(),
              },
            });
            return { query, result };
          } catch (cause) {
            return {
              query,
              error:
                cause instanceof Error
                  ? cause.message
                  : 'The current Salesforce user could not run this lookup.',
            };
          }
        }),
      );

      setProgress('Writing an answer from the accessible results…');
      const answer = await sendMessage<string>({
        type: 'ASK_AI',
        payload: {
          messages: conversation,
          salesforceContext: buildAutomaticAiContext({
            org,
            orgInfo,
            objects,
            describes,
            observations,
            focus: planningTranscript,
          }),
          maxOutputTokens: 2_000,
        },
      });
      const assistantMessage: AiChatMessage = { role: 'assistant', content: answer };
      setMessages([...conversation, assistantMessage].slice(-10));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'AI Agent could not answer.');
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
            <small>Key kept only for this browser session</small>
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
              <p>The key is kept only in temporary browser-session storage.</p>
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
              <button className="button button-ghost" type="button" onClick={() => setMessages([])}>
                Clear chat
              </button>
            )}
          </div>
          {messages.length === 0 ? (
            <div className="ai-starters">
              {[
                'Summarize this org and flag anything I should review.',
                'Which custom objects can I access and what are they for?',
                'Review recent records for likely data quality issues.',
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
                    <MarkdownMessage content={message.content} />
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
          {!status.configured && (
            <p className="muted ai-chat-note">Connect a provider once to start asking questions.</p>
          )}
          <p className="muted ai-chat-note">
            Answers are not stored. Relevant accessible results are sent directly to your selected
            provider; AI Agent cannot write records or run Apex.
          </p>
        </section>
      )}
    </div>
  );
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
