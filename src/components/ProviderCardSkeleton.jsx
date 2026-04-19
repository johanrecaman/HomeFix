function SingleCardSkeleton() {
  return (
    <div className="bg-white dark:bg-[#11222A] rounded-xl border border-ink-900/10 dark:border-white/10 p-4 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-ink-900/10 dark:bg-white/10 flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-3 bg-ink-900/10 dark:bg-white/10 rounded w-3/4" />
          <div className="h-3 bg-ink-900/10 dark:bg-white/10 rounded w-1/2" />
        </div>
      </div>
    </div>
  )
}

export function ProviderCardSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      <SingleCardSkeleton />
      <SingleCardSkeleton />
      <SingleCardSkeleton />
    </div>
  )
}
