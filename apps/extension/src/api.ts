import type { UiRequest, UiResponse } from '@varkole/shared';

export async function sendMessage<T>(request: UiRequest): Promise<T> {
  const response: UiResponse<T> | undefined = await chrome.runtime.sendMessage(request);
  if (!response) throw new Error('The extension service worker did not respond.');
  if (!response.ok) {
    const error = new Error(response.error.message);
    Object.assign(error, { data: response.error });
    throw error;
  }
  return response.data;
}

export function openWorkspace(
  module = '',
  context?: { recordId?: string | undefined; pageUrl?: string | undefined },
): void {
  const search = new URLSearchParams();
  if (context?.recordId) search.set('recordId', context.recordId);
  if (context?.pageUrl) search.set('pageUrl', context.pageUrl);
  const query = search.size ? `?${search.toString()}` : '';
  const suffix = module ? `#${module}` : '';
  void chrome.tabs.create({ url: chrome.runtime.getURL(`workspace.html${query}${suffix}`) });
}
