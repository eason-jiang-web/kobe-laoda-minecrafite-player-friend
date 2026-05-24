// The diagonal ↗ glyph used throughout the source as a large decorative mark
// and inline link affordance.
export function Arrow({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 100"
      fill="none"
      stroke="currentColor"
      className={className}
      aria-hidden
    >
      <path d="M22 78 L78 22" strokeWidth="6" />
      <path d="M34 22 L78 22 L78 66" strokeWidth="6" />
    </svg>
  );
}
