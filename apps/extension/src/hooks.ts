import { useCallback, useEffect, useState } from 'react';
import type { ExtensionState } from '@varkole/shared';
import { sendMessage } from './api';

export function useExtensionState() {
  const [state, setState] = useState<ExtensionState>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      setState(await sendMessage<ExtensionState>({ type: 'GET_STATE' }));
      setError(undefined);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load extension state.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { state, setState, error, loading, refresh };
}
