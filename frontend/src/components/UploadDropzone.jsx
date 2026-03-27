import { useRef, useState } from 'react'
import { motion } from 'framer-motion'

const MAX_SIZE_MB = 10
const ACCEPTED = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']

export default function UploadDropzone({ onFile, disabled = false }) {
  const [dragging, setDragging] = useState(false)
  const [error, setError]       = useState('')
  const inputRef = useRef()

  const validate = (file) => {
    if (!file) return 'No file selected.'
    if (!ACCEPTED.includes(file.type)) return 'Invalid file type. Please upload a JPEG or PNG image.'
    if (file.size > MAX_SIZE_MB * 1024 * 1024) return `File too large. Maximum size is ${MAX_SIZE_MB} MB.`
    return null
  }

  const process = (file) => {
    const err = validate(file)
    if (err) { setError(err); return }
    setError('')
    const url = URL.createObjectURL(file)
    onFile(file, url)
  }

  const onDrop = (e) => {
    e.preventDefault()
    setDragging(false)
    if (disabled) return
    process(e.dataTransfer.files[0])
  }

  const onInputChange = (e) => process(e.target.files[0])

  return (
    <div>
      <motion.div
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => !disabled && inputRef.current.click()}
        animate={{ scale: dragging ? 1.02 : 1 }}
        transition={{ duration: 0.15 }}
        className={`
          relative flex flex-col items-center justify-center gap-4
          rounded-2xl border-2 border-dashed cursor-pointer
          py-14 px-8 transition-colors duration-200
          ${dragging
            ? 'border-emerald-500 bg-emerald-50'
            : 'border-slate-300 bg-slate-50 hover:border-emerald-400 hover:bg-emerald-50/40'
          }
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        <div className="w-14 h-14 rounded-2xl bg-emerald-100 flex items-center justify-center">
          <svg className="w-7 h-7 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
          </svg>
        </div>
        <div className="text-center">
          <p className="text-slate-700 font-semibold">
            {dragging ? 'Drop image here' : 'Drag & drop a crop image'}
          </p>
          <p className="text-slate-400 text-sm mt-1">or <span className="text-emerald-600 font-medium">browse files</span></p>
          <p className="text-slate-400 text-xs mt-2">JPEG, PNG, WebP · Max {MAX_SIZE_MB} MB</p>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED.join(',')}
          className="hidden"
          onChange={onInputChange}
        />
      </motion.div>

      {error && (
        <motion.p
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-2 text-sm text-red-600 flex items-center gap-1.5"
        >
          <span>⚠</span> {error}
        </motion.p>
      )}
    </div>
  )
}
