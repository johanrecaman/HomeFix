function SkeletonRow() {
  return (
    <div className="bg-white dark:bg-[#11222A] rounded-xl border border-ink-900/10 dark:border-white/10 p-5 animate-pulse">
      <div className="flex items-center gap-4">
        <div className="w-11 h-11 rounded-full bg-ink-900/10 dark:bg-white/10 flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-3 bg-ink-900/10 dark:bg-white/10 rounded w-1/3" />
          <div className="h-3 bg-ink-900/10 dark:bg-white/10 rounded w-1/2" />
        </div>
        <div className="w-16 h-7 bg-ink-900/10 dark:bg-white/10 rounded-lg flex-shrink-0" />
      </div>
    </div>
  )
}

export function AdminTableSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)}
    </div>
  )
}
