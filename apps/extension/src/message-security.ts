export function isTrustedExtensionPageSender(
  extensionId: string,
  senderId: string | undefined,
  senderUrl: string | undefined,
): boolean {
  if (senderId !== extensionId || !senderUrl) return false;
  try {
    const url = new URL(senderUrl);
    return url.protocol === 'chrome-extension:' && url.hostname === extensionId;
  } catch {
    return false;
  }
}
