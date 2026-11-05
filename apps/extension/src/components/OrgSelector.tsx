import type { ExtensionState } from '@varkole/shared';
import { sendMessage } from '../api';
import { orgName } from '../org';
import { EnvironmentBadge } from './Status';

export function OrgSelector({
  state,
  onChange,
  onConnect,
  compact = false,
}: {
  state: ExtensionState;
  onChange: (state: ExtensionState) => void;
  onConnect: () => void;
  compact?: boolean;
}) {
  const selected = state.orgs.find((org) => org.key === state.selectedOrgKey);

  async function select(key: string) {
    if (key === '__connect') return onConnect();
    onChange(await sendMessage<ExtensionState>({ type: 'SELECT_ORG', payload: { key } }));
  }

  if (compact) {
    return (
      <button className="org-compact" type="button" onClick={onConnect}>
        <span className={`org-avatar ${selected?.environment ?? ''}`}>
          {(selected ? orgName(selected) : 'S').slice(0, 1).toUpperCase()}
        </span>
        <span>
          <strong>{selected ? orgName(selected) : 'Connect Salesforce'}</strong>
          <small>{selected?.connected ? selected.username : 'No active connection'}</small>
        </span>
        <span aria-hidden="true">›</span>
      </button>
    );
  }

  return (
    <div className="org-selector-wrap">
      <label htmlFor="org-selector">Current org</label>
      <div className="org-selector-row">
        <select
          id="org-selector"
          value={selected?.key ?? ''}
          onChange={(event) => void select(event.target.value)}
        >
          {state.orgs.length === 0 && <option value="">No org connected</option>}
          {state.orgs.map((org) => (
            <option key={org.key} value={org.key}>
              {orgName(org)} · {org.connected ? org.username : 'Reconnect required'}
            </option>
          ))}
          <option value="__connect">＋ Connect another org</option>
        </select>
        {selected && <EnvironmentBadge org={selected} />}
      </div>
    </div>
  );
}
