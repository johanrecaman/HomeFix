import { Calendar, X } from 'lucide-react'

export function DateTimeFilter({ value, onChange, onClear }) {
  return (
    <div className="flex items-center gap-2 mt-3">
      <div className="flex-1 relative">
        <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none"/>
        <input
          type="datetime-local"
          value={value}
          onChange={e => onChange(e.target.value)}
          min={new Date().toISOString().slice(0, 16)}
          className="w-full pl-9 pr-3 py-2 rounded-lg border border-ink-900/15 dark:border-white/15 bg-transparent text-ink-900 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-teal-400"
        />
      </div>
      {value && (
        <button
          onClick={onClear}
          className="w-8 h-8 rounded-lg grid place-items-center text-ink-400 hover:text-ink-700 dark:hover:text-ink-300 hover:bg-ink-900/5 dark:hover:bg-white/5 transition-colors flex-shrink-0"
        >
          <X size={14}/>
        </button>
      )}
    </div>
  )
}
