import { useState } from 'react';
import type { ConnectOrgInput, ExtensionState } from '@varkole/shared';
import { sendMessage } from '../api';
import { InlineError } from './Status';

export function ConnectDialog({
  state,
  onClose,
  onConnected,
}: {
  state: ExtensionState;
  onClose: () => void;
  onConnected: (state: ExtensionState) => void;
}) {
  const [environment, setEnvironment] = useState<ConnectOrgInput['environment']>('sandbox');
  const [customDomain, setCustomDomain] = useState('');
  const [alias, setAlias] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function connect() {
    setBusy(true);
    setError(undefined);
    try {
      const next = await sendMessage<ExtensionState>({
        type: 'CONNECT_ORG',
        payload: {
          environment,
          ...(customDomain ? { customDomain } : {}),
          ...(alias ? { alias } : {}),
        },
      });
      onConnected(next);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not connect Salesforce.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="connect-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button
          className="icon-button dialog-close"
          type="button"
          onClick={onClose}
          aria-label="Close"
        >
          ×
        </button>
        <div className="dialog-kicker">Optional fallback</div>
        <h1 id="connect-title">Connect with OAuth</h1>
        <p className="muted">
          Normally Varkole uses the current Salesforce tab automatically. OAuth is needed only when
          your org blocks API use of the browser session or you want to add an org without opening
          it first.
        </p>

        {!state.configured && (
          <div className="alert alert-warning">
            <span aria-hidden="true">i</span>
            <div>
              <strong>OAuth fallback is not configured</strong>
              <p>
                Add the public consumer key to <code>VITE_SALESFORCE_CLIENT_ID</code> and rebuild.
              </p>
            </div>
          </div>
        )}

        <fieldset className="choice-grid">
          <legend>Environment</legend>
          {(['sandbox', 'production', 'custom'] as const).map((option) => (
            <label className={`choice ${environment === option ? 'selected' : ''}`} key={option}>
              <input
                type="radio"
                name="environment"
                value={option}
                checked={environment === option}
                onChange={() => setEnvironment(option)}
              />
              <span>
                <strong>{option === 'custom' ? 'My Domain' : capitalize(option)}</strong>
                <small>
                  {option === 'sandbox'
                    ? 'test.salesforce.com'
                    : option === 'production'
                      ? 'login.salesforce.com'
                      : 'Your Salesforce-owned domain'}
                </small>
              </span>
            </label>
          ))}
        </fieldset>

        {environment === 'custom' && (
          <label className="field">
            <span>Salesforce domain</span>
            <input
              value={customDomain}
              onChange={(event) => setCustomDomain(event.target.value)}
              placeholder="acme.my.salesforce.com"
              inputMode="url"
              autoComplete="off"
            />
          </label>
        )}

        <label className="field">
          <span>
            Friendly name <small>(optional)</small>
          </span>
          <input
            value={alias}
            onChange={(event) => setAlias(event.target.value)}
            placeholder="Dev sandbox"
          />
        </label>

        <div className="redirect-note">
          <span>OAuth redirect URL</span>
          <code>{state.redirectUrl}</code>
        </div>

        <InlineError message={error} />
        <div className="dialog-actions">
          <button className="button button-ghost" type="button" onClick={onClose}>
            Cancel
          </button>
          <button
            className="button button-primary"
            type="button"
            disabled={busy || !state.configured || (environment === 'custom' && !customDomain)}
            onClick={() => void connect()}
          >
            {busy ? 'Opening Salesforce…' : 'Continue to Salesforce'}
          </button>
        </div>
      </section>
    </div>
  );
}

function capitalize(value: string): string {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}
