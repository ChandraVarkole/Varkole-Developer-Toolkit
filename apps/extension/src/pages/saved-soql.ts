import type { ApiMode } from '@varkole/shared';

export interface SavedSoqlQuery {
  id: string;
  name: string;
  soql: string;
  mode: ApiMode;
  savedAt: string;
}

const PREFIX = 'saved-soql-v1:';

export async function loadSavedSoql(orgKey: string): Promise<SavedSoqlQuery[]> {
  const key = `${PREFIX}${orgKey}`;
  const value = (await chrome.storage.local.get(key))[key];
  return Array.isArray(value) ? (value as SavedSoqlQuery[]) : [];
}

export async function saveSoqlQuery(
  orgKey: string,
  input: Omit<SavedSoqlQuery, 'id' | 'savedAt'>,
): Promise<SavedSoqlQuery[]> {
  const existing = await loadSavedSoql(orgKey);
  const entry: SavedSoqlQuery = {
    ...input,
    id: crypto.randomUUID(),
    savedAt: new Date().toISOString(),
  };
  const next = [entry, ...existing.filter((item) => item.name !== input.name)].slice(0, 100);
  await chrome.storage.local.set({ [`${PREFIX}${orgKey}`]: next });
  return next;
}

export async function deleteSavedSoql(orgKey: string, id: string): Promise<SavedSoqlQuery[]> {
  const next = (await loadSavedSoql(orgKey)).filter((item) => item.id !== id);
  await chrome.storage.local.set({ [`${PREFIX}${orgKey}`]: next });
  return next;
}
