import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import UploadDropzone from '../components/UploadDropzone'
import ImagePreviewCard from '../components/ImagePreviewCard'
import PageTransition from '../components/PageTransition'
import useAppStore from '../store/useAppStore'
import api from '../api/client'

export default function AnalyzePage() {
  const navigate = useNavigate()
  const {
    uploadedImage, imagePreviewUrl,
    setUploadedImage, setZoneId, setSensorData,
    sensorData, zoneId, reset,
  } = useAppStore()

  const [sensors, setSensors]           = useState([])
  const [configMissing, setConfigMissing] = useState(false)
  const [showSensors, setShowSensors]   = useState(false)

  useEffect(() => {
    reset()
    api.get('/sensors')
      .then(res => {
        if (res.data.length === 0) { setConfigMissing(true); return }
        setSensors(res.data)
        setZoneId(res.data[0].id)
      })
      .catch(() => setConfigMissing(true))
  }, [])

  const handleFile = (file, url) => setUploadedImage(file, url)
  const handleRemove = () => setUploadedImage(null, null)

  const handleSensor = (e) =>
    setSensorData({ ...sensorData, [e.target.name]: e.target.value })

  const handleSubmit = () => {
    if (!uploadedImage) return
    navigate('/processing')
  }

  if (configMissing) {
    return (
      <PageTransition className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-10 max-w-md text-center">
          <div className="w-14 h-14 rounded-2xl bg-amber-100 flex items-center justify-center text-2xl mx-auto mb-4">⚙</div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Farm not configured</h2>
          <p className="text-slate-500 text-sm mb-6">
            Set up your farm and sensor grid first before running disease analysis.
          </p>
          <button
            onClick={() => navigate('/calibration')}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-6 py-2.5 rounded-xl transition-colors text-sm"
          >
            Go to Setup
          </button>
        </div>
      </PageTransition>
    )
  }

  return (
    <PageTransition className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="w-full max-w-lg">

        {/* Back */}
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 mb-6 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
          {/* Header */}
          <div className="mb-7">
            <div className="flex items-center gap-2.5 mb-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center">
                <span className="text-white text-sm font-bold">A</span>
              </div>
              <span className="font-bold text-slate-900">AgriSense</span>
            </div>
            <h1 className="text-2xl font-extrabold text-slate-900">Analyze Crop Image</h1>
            <p className="text-slate-500 text-sm mt-1">Upload a clear photo of your crop leaf or field zone.</p>
          </div>

          {/* Upload or preview */}
          {uploadedImage ? (
            <ImagePreviewCard
              file={uploadedImage}
              previewUrl={imagePreviewUrl}
              onRemove={handleRemove}
            />
          ) : (
            <UploadDropzone onFile={handleFile} />
          )}

          {/* Zone selector */}
          {sensors.length > 0 && (
            <div className="mt-5">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                Field Zone
              </label>
              <select
                value={zoneId || ''}
                onChange={e => setZoneId(Number(e.target.value))}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              >
                {sensors.map(s => (
                  <option key={s.id} value={s.id}>
                    Zone {s.zone_index + 1} (ID {s.id}) — {s.status}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Optional sensor data */}
          <div className="mt-4">
            <button
              type="button"
              onClick={() => setShowSensors(v => !v)}
              className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 transition-colors"
            >
              <svg className={`w-3.5 h-3.5 transition-transform ${showSensors ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              Sensor readings (optional)
            </button>

            {showSensors && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="mt-3 grid grid-cols-2 gap-3"
              >
                {[
                  { name: 'n',            label: 'Nitrogen (N)',    unit: 'mg/kg' },
                  { name: 'p',            label: 'Phosphorus (P)',  unit: 'mg/kg' },
                  { name: 'k',            label: 'Potassium (K)',   unit: 'mg/kg' },
                  { name: 'soil_moisture',label: 'Soil Moisture',   unit: '%'     },
                ].map(({ name, label, unit }) => (
                  <div key={name}>
                    <label className="block text-xs text-slate-500 mb-1">
                      {label} <span className="text-slate-300">({unit})</span>
                    </label>
                    <input
                      type="number" name={name}
                      value={sensorData[name]} onChange={handleSensor}
                      placeholder="0–100" min="0" max="100" step="0.1"
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent"
                    />
                  </div>
                ))}
              </motion.div>
            )}
          </div>

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={!uploadedImage}
            className="mt-7 w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white font-semibold py-3.5 rounded-xl transition-colors text-base"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            Run Disease Analysis
          </button>

          <p className="text-center text-xs text-slate-400 mt-3">
            Powered by Vision Transformer · 93% accuracy
          </p>
        </div>
      </div>
    </PageTransition>
  )
}
