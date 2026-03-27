import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import Loader from '../components/Loader'
import useAppStore from '../store/useAppStore'
import api from '../api/client'

const MESSAGES = [
  'Preparing image...',
  'Extracting visual features...',
  'Running Vision Transformer...',
  'Classifying disease patterns...',
  'Calculating confidence scores...',
  'Compiling results...',
]

export default function ProcessingPage() {
  const navigate = useNavigate()
  const {
    uploadedImage, zoneId, sensorData,
    setPredictionResult, setError, addToast, reset,
  } = useAppStore()

  const [msgIdx, setMsgIdx] = useState(0)
  const hasRun = useRef(false)

  // Cycle through messages
  useEffect(() => {
    const id = setInterval(() => {
      setMsgIdx(i => (i + 1) % MESSAGES.length)
    }, 900)
    return () => clearInterval(id)
  }, [])

  // Guard: if no image, go back to analyze
  useEffect(() => {
    if (!uploadedImage) { navigate('/analyze'); return }
    if (hasRun.current) return
    hasRun.current = true
    runAnalysis()
  }, [])

  const runAnalysis = async () => {
    try {
      // 1. Upload image via drone endpoint
      const form = new FormData()
      form.append('zone_id', zoneId || 1)
      form.append('image', uploadedImage)
      form.append('n',             sensorData.n             || '40')
      form.append('p',             sensorData.p             || '30')
      form.append('k',             sensorData.k             || '35')
      form.append('soil_moisture', sensorData.soil_moisture || '35')

      const uploadRes = await api.post('/drone/upload', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })

      const droneImageId  = uploadRes.data.drone_image?.id
      const droneAnalysis = uploadRes.data.analysis  // multimodal result

      if (!droneImageId) throw new Error('Upload did not return an image ID.')

      // 2. Run disease (ViT) classification
      const diseaseRes = await api.post('/analysis/disease', { drone_image_id: droneImageId })

      setPredictionResult({
        prediction:      diseaseRes.data.prediction,
        confidence:      diseaseRes.data.confidence,
        all_probs_json:  diseaseRes.data.all_probs_json,
        droneAnalysis,
      })

      navigate('/results')
    } catch (err) {
      const msg = err.response?.data?.detail || err.message || 'Analysis failed.'
      addToast(msg, 'error')
      setError(msg)
      navigate('/analyze')
    }
  }

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center gap-10 p-6">
      {/* Logo */}
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-emerald-600 flex items-center justify-center">
          <span className="text-white text-xs font-bold">A</span>
        </div>
        <span className="font-bold text-slate-900">AgriSense</span>
      </div>

      <Loader message={MESSAGES[msgIdx]} />

      <div className="text-center max-w-xs">
        <p className="text-xs text-slate-400">
          Our Vision Transformer is analyzing your crop image.<br />
          This usually takes a few seconds.
        </p>
      </div>

      {/* Step indicators */}
      <div className="flex gap-2">
        {MESSAGES.map((_, i) => (
          <motion.div
            key={i}
            className={`h-1.5 rounded-full transition-all duration-500 ${
              i === msgIdx ? 'w-6 bg-emerald-600' : i < msgIdx ? 'w-1.5 bg-emerald-300' : 'w-1.5 bg-slate-200'
            }`}
          />
        ))}
      </div>
    </div>
  )
}
