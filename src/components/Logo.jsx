export function Logo({ className = '' }) {
  return (
    <span className={`inline-flex items-center gap-2 font-extrabold text-xl tracking-tight text-ink-900 dark:text-white ${className}`}
      style={{ letterSpacing: '-0.035em' }}>
      <svg width="32" height="32" viewBox="0 0 32 32" className="flex-shrink-0">
        <rect width="32" height="32" rx="9" fill="#20D4B8"/>
        <path d="M8 9 L12 6 L12 24 L8 24 Z" fill="#0D1B1A"/>
        <path d="M20 6 L24 9 L24 24 L20 24 Z" fill="#0D1B1A"/>
        <rect x="12" y="14" width="8" height="4" fill="#0D1B1A"/>
      </svg>
      HomeFix
    </span>
  )
}
