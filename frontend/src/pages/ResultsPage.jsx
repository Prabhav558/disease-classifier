import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import ResultCard from '../components/ResultCard'
import PageTransition from '../components/PageTransition'
import useAppStore from '../store/useAppStore'

export default function ResultsPage() {
  const navigate   = useNavigate()
  const { predictionResult, imagePreviewUrl, reset } = useAppStore()

  // Guard
  if (!predictionResult) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-500 mb-4">No results to display.</p>
          <button onClick={() => navigate('/analyze')}
            className="bg-emerald-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold">
            Start Analysis
          </button>
        </div>
      </div>
    )
  }

  const { prediction, confidence, all_probs_json, droneAnalysis } = predictionResult

  const handleTryAgain = () => { reset(); navigate('/analyze') }
  const handleNew      = () => { reset(); navigate('/analyze') }

  return (
    <PageTransition className="min-h-screen bg-slate-50 py-10 px-4">
      <div className="max-w-xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-600 flex items-center justify-center">
              <span className="text-white text-xs font-bold">A</span>
            </div>
            <span className="font-bold text-slate-900">AgriSense</span>
          </div>
          <button onClick={() => navigate('/dashboard')}
            className="text-sm text-slate-500 hover:text-slate-800 border border-slate-200 hover:border-slate-300 px-3 py-1.5 rounded-lg transition-colors">
            Dashboard
          </button>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="mb-3"
        >
          <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">Analysis Complete</span>
          <h1 className="text-2xl font-extrabold text-slate-900 mt-0.5">Disease Detection Results</h1>
        </motion.div>

        {/* Image + multimodal summary strip */}
        {(imagePreviewUrl || droneAnalysis) && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.05 }}
            className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mb-4 flex gap-0"
          >
            {imagePreviewUrl && (
              <img src={imagePreviewUrl} alt="Analyzed crop" className="w-28 h-28 object-cover shrink-0" />
            )}
            {droneAnalysis && (
              <div className="flex-1 px-4 py-3 flex flex-col justify-center">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Multimodal Health</p>
                <p className="text-sm font-bold text-slate-800 capitalize">
                  {droneAnalysis.prediction?.replace(/_/g, ' ')}
                </p>
                <p className="text-xs text-slate-400">{droneAnalysis.confidence?.toFixed(1)}% confidence</p>
              </div>
            )}
          </motion.div>
        )}

        {/* Main result card */}
        <ResultCard
          prediction={prediction}
          confidence={confidence}
          allProbs={all_probs_json}
        />

        {/* Actions */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.5 }}
          className="flex gap-3 mt-6"
        >
          <button
            onClick={handleTryAgain}
            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 rounded-xl transition-colors text-sm"
          >
            Analyze Another Image
          </button>
          <button
            onClick={() => navigate('/dashboard')}
            className="flex-1 bg-white hover:bg-slate-50 text-slate-700 font-semibold py-3 rounded-xl border border-slate-200 hover:border-slate-300 transition-colors text-sm"
          >
            Go to Dashboard
          </button>
        </motion.div>

        <p className="text-center text-xs text-slate-400 mt-4">
          Results are AI-generated. Consult an agronomist before taking action.
        </p>
      </div>
    </PageTransition>
  )
}
