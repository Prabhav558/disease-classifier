import { motion } from 'framer-motion'

function formatBytes(bytes) {
  if (bytes < 1024)        return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function ImagePreviewCard({ file, previewUrl, onRemove }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.2 }}
      className="relative bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
    >
      <div className="relative">
        <img
          src={previewUrl}
          alt="Uploaded crop"
          className="w-full h-52 object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/40 to-transparent" />
        <button
          onClick={onRemove}
          className="absolute top-3 right-3 w-7 h-7 rounded-full bg-white/90 hover:bg-white shadow flex items-center justify-center text-slate-600 hover:text-red-600 transition-colors text-sm font-bold"
        >
          ×
        </button>
      </div>
      <div className="px-4 py-3 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
          <svg className="w-4 h-4 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
          </svg>
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-800 truncate">{file.name}</p>
          <p className="text-xs text-slate-400">{formatBytes(file.size)}</p>
        </div>
        <span className="ml-auto text-xs text-emerald-600 font-medium bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100 shrink-0">
          Ready
        </span>
      </div>
    </motion.div>
  )
}
