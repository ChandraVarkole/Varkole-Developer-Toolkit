import { useState } from 'react';

export function CopyButton({
  value,
  label = 'Copy value',
  compact = false,
}: {
  value: string;
  label?: string;
  compact?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1_500);
  }

  return (
    <button
      className={`copy-value-button ${compact ? 'compact' : ''}`}
      type="button"
      onClick={() => void copy()}
      aria-label={label}
      title={copied ? 'Copied' : label}
    >
      {copied ? '✓' : 'Copy'}
    </button>
  );
}
