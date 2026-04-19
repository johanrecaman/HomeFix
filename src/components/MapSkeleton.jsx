export function MapSkeleton() {
  return (
    <div
      className="flex-1 rounded-xl overflow-hidden border border-ink-900/10 dark:border-white/10 animate-pulse bg-ink-900/5 dark:bg-white/5"
      style={{ minHeight: '400px' }}
    >
      <div className="h-full w-full bg-gradient-to-br from-ink-900/5 to-teal-400/5 dark:from-white/5 dark:to-teal-400/10" />
    </div>
  )
}
