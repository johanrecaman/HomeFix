const variants = {
  primary: 'bg-teal-400 hover:bg-teal-500 text-ink-900 font-bold shadow-teal hover:-translate-y-px active:translate-y-0',
  dark: 'bg-ink-900 hover:opacity-90 text-white font-semibold dark:bg-white dark:text-ink-900',
  outline: 'border border-ink-400 hover:border-ink-900 dark:border-ink-600 dark:hover:border-teal-400 text-ink-900 dark:text-white font-semibold',
  ghost: 'text-ink-800 dark:text-ink-400 hover:bg-ink-900/5 dark:hover:bg-white/10 font-medium',
}

const sizes = {
  sm: 'px-4 py-2 text-sm rounded-md',
  md: 'px-5 py-3 text-sm rounded-md',
  lg: 'px-6 py-4 text-base rounded-lg',
}

export function Button({ variant = 'primary', size = 'md', className = '', disabled, loading, children, ...props }) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"/>}
      {children}
    </button>
  )
}
