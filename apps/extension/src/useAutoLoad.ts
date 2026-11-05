import { useEffect, useRef } from 'react';

/** Runs a safe read-only loader once for each non-empty activation key. */
export function useAutoLoad(load: () => void | Promise<void>, activationKey?: string) {
  const loadRef = useRef(load);
  const loadedKeyRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    loadRef.current = load;
  }, [load]);

  useEffect(() => {
    if (!activationKey || loadedKeyRef.current === activationKey) return;
    loadedKeyRef.current = activationKey;
    void loadRef.current();
  }, [activationKey]);
}
