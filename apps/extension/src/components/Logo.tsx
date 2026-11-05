export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="brand">
      <img className="brand-logo" src="/icons/icon-48.png" alt="" />
      {!compact && (
        <div>
          <strong>Varkole</strong>
          <span>Developer Toolkit</span>
        </div>
      )}
    </div>
  );
}
