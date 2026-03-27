import { motion, AnimatePresence } from 'framer-motion'

export default function Modal({ open, onClose, title, children }) {
  if (!open) return null
  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
          onClick={onClose}
        />
        {/* Panel */}
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 16 }}
          animate={{ scale: 1,    opacity: 1, y: 0  }}
          exit={{    scale: 0.95, opacity: 0, y: 8  }}
          transition={{ duration: 0.2 }}
          className="relative bg-white rounded-2xl shadow-2xl border border-slate-100 max-w-md w-full p-6 z-10"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 transition-colors text-lg"
            >
              ×
            </button>
          </div>
          <div className="text-sm text-slate-600 leading-relaxed">{children}</div>
          <button
            onClick={onClose}
            className="mt-6 w-full bg-slate-900 hover:bg-slate-800 text-white font-medium py-2.5 rounded-xl transition-colors text-sm"
          >
            I Understand
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
