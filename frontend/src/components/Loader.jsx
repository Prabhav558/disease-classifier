import { motion, AnimatePresence } from 'framer-motion'

export default function Loader({ message = 'Processing...' }) {
  return (
    <div className="flex flex-col items-center gap-6">
      {/* Spinner */}
      <div className="relative w-16 h-16">
        <motion.div
          className="absolute inset-0 rounded-full border-4 border-emerald-100"
        />
        <motion.div
          className="absolute inset-0 rounded-full border-4 border-transparent border-t-emerald-600"
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-3 h-3 rounded-full bg-emerald-600 animate-pulse" />
        </div>
      </div>

      {/* Message */}
      <AnimatePresence mode="wait">
        <motion.p
          key={message}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.3 }}
          className="text-slate-600 text-base font-medium"
        >
          {message}
        </motion.p>
      </AnimatePresence>
    </div>
  )
}

export function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 animate-pulse">
      <div className="h-4 bg-slate-200 rounded w-3/4 mb-3" />
      <div className="h-3 bg-slate-100 rounded w-1/2 mb-6" />
      <div className="h-8 bg-slate-200 rounded w-full mb-2" />
      <div className="h-3 bg-slate-100 rounded w-2/3" />
    </div>
  )
}
