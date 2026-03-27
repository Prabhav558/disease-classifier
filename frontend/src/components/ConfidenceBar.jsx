import { motion } from 'framer-motion'

function getConfidenceLevel(pct) {
  if (pct >= 80) return { label: 'High Confidence', color: 'bg-emerald-500', text: 'text-emerald-700', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200' }
  if (pct >= 50) return { label: 'Medium Confidence', color: 'bg-amber-500', text: 'text-amber-700', badge: 'bg-amber-50 text-amber-700 border-amber-200' }
  return { label: 'Low Confidence', color: 'bg-red-500', text: 'text-red-700', badge: 'bg-red-50 text-red-700 border-red-200' }
}

export default function ConfidenceBar({ value, showLabel = true, height = 'h-3' }) {
  const level = getConfidenceLevel(value)
  return (
    <div className="w-full">
      <div className={`w-full bg-slate-100 rounded-full ${height} overflow-hidden`}>
        <motion.div
          className={`${height} rounded-full ${level.color}`}
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 0.8, ease: 'easeOut', delay: 0.2 }}
        />
      </div>
      {showLabel && (
        <div className="flex items-center justify-between mt-1.5">
          <span className={`text-xs font-medium ${level.text}`}>{level.label}</span>
          <span className="text-xs font-bold text-slate-700">{value.toFixed(1)}%</span>
        </div>
      )}
    </div>
  )
}

export function ConfidenceBadge({ value }) {
  const level = getConfidenceLevel(value)
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${level.badge}`}>
      {level.label}
    </span>
  )
}

export { getConfidenceLevel }
