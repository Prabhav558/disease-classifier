import { AnimatePresence, motion } from 'framer-motion'
import useAppStore from '../store/useAppStore'

function Toast({ toast }) {
  const removeToast = useAppStore((s) => s.removeToast)
  const styles = {
    error:   'bg-red-50 border-red-200 text-red-800',
    success: 'bg-emerald-50 border-emerald-200 text-emerald-800',
    info:    'bg-blue-50 border-blue-200 text-blue-800',
  }
  const icons = { error: '✕', success: '✓', info: 'ℹ' }

  return (
    <motion.div
      initial={{ opacity: 0, x: 60 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 60 }}
      transition={{ duration: 0.25 }}
      className={`flex items-start gap-3 px-4 py-3 rounded-xl border shadow-lg max-w-sm text-sm ${styles[toast.type] || styles.error}`}
    >
      <span className="font-bold mt-0.5 shrink-0">{icons[toast.type] || '!'}</span>
      <span className="flex-1">{toast.message}</span>
      <button
        onClick={() => removeToast(toast.id)}
        className="shrink-0 opacity-60 hover:opacity-100 transition-opacity font-bold"
      >
        ×
      </button>
    </motion.div>
  )
}

export default function ToastContainer() {
  const toasts = useAppStore((s) => s.toasts)
  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      <AnimatePresence>
        {toasts.map((t) => (
          <div key={t.id} className="pointer-events-auto">
            <Toast toast={t} />
          </div>
        ))}
      </AnimatePresence>
    </div>
  )
}
