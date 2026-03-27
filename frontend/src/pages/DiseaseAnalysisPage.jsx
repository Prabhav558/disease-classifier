import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api/client'
import PageTransition from '../components/PageTransition'
import ConfidenceBar from '../components/ConfidenceBar'

export default function DiseaseAnalysisPage() {
  const navigate   = useNavigate()
  const [images,    setImages]    = useState([])
  const [selected,  setSelected]  = useState(null)
  const [result,    setResult]    = useState(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [loading,   setLoading]   = useState(true)

  useEffect(() => {
    api.get('/dashboard/images')
      .then(res => setImages(res.data))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const handleAnalyze = async () => {
    if (!selected) return
    setAnalyzing(true); setResult(null)
    try {
      const res = await api.post('/analysis/disease', { drone_image_id: selected.id })
      setResult(res.data)
    } catch (err) {
      console.error(err)
    } finally {
      setAnalyzing(false)
    }
  }

  const sortedProbs = result?.all_probs_json
    ? Object.entries(result.all_probs_json).sort((a, b) => b[1] - a[1])
    : []

  return (
    <PageTransition>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900">Disease Analysis</h2>
          <p className="text-sm text-slate-500 mt-1">ViT model (image-only) · 13 disease classes · Images from last 2 days</p>
        </div>
        <button
          onClick={() => navigate('/analyze')}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
        >
          + Upload New Image
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Image browser */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Select Image</h3>
          {loading ? (
            <div className="flex items-center gap-2 text-slate-400 text-sm">
              <div className="w-3.5 h-3.5 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
              Loading images...
            </div>
          ) : images.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-2xl mx-auto mb-3">📷</div>
              <p className="text-slate-500 text-sm mb-3">No images uploaded in the last 2 days.</p>
              <button
                onClick={() => navigate('/analyze')}
                className="text-sm text-emerald-600 font-semibold hover:underline"
              >
                Upload your first image →
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2 max-h-96 overflow-auto">
              {images.map(img => (
                <div
                  key={img.id}
                  onClick={() => { setSelected(img); setResult(null) }}
                  className={`cursor-pointer rounded-xl overflow-hidden border-2 transition-all ${
                    selected?.id === img.id
                      ? 'border-emerald-500 shadow-md'
                      : 'border-transparent hover:border-slate-200'
                  }`}
                >
                  <img
                    src={`/api/dashboard/images/${img.id}/file`}
                    alt={`Zone ${img.sensor_id}`}
                    className="w-full aspect-square object-cover"
                  />
                  <p className="text-xs text-center py-1 bg-slate-50 text-slate-500">Zone {img.sensor_id}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Analysis panel */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          {selected ? (
            <>
              <h3 className="text-sm font-semibold text-slate-700 mb-4">Analysis</h3>
              <img
                src={`/api/dashboard/images/${selected.id}/file`}
                alt="Selected"
                className="w-full max-w-xs rounded-xl mb-3 shadow-sm"
              />
              <p className="text-xs text-slate-400 mb-4">
                Zone {selected.sensor_id} · {new Date(selected.captured_at).toLocaleString()}
              </p>

              <button
                onClick={handleAnalyze}
                disabled={analyzing}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-semibold px-5 py-2.5 rounded-xl transition-colors text-sm mb-5"
              >
                {analyzing ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Analyzing...
                  </>
                ) : 'Run Disease Analysis'}
              </button>

              {result && (
                <div className="border border-slate-100 rounded-2xl p-4">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Result</p>
                  <p className="text-lg font-extrabold text-slate-900 mb-1 capitalize">
                    {result.prediction.replace(/___/g, ' › ').replace(/_/g, ' ')}
                  </p>
                  <div className="mb-4">
                    <ConfidenceBar value={result.confidence} />
                  </div>
                  <div className="space-y-2">
                    {sortedProbs.slice(0, 8).map(([label, prob]) => (
                      <div key={label} className="flex items-center gap-2 text-xs">
                        <span className="w-36 text-slate-500 truncate capitalize">{label.replace(/___/g, ' › ').replace(/_/g, ' ')}</span>
                        <div className="flex-1 bg-slate-100 rounded-full h-1.5">
                          <div className="bg-orange-400 h-1.5 rounded-full" style={{ width: `${prob}%` }} />
                        </div>
                        <span className="w-12 text-right text-slate-500 font-medium">{prob.toFixed(1)}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center py-10">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center text-2xl mb-3">⬡</div>
              <p className="text-slate-400 text-sm">Select an image from the left to analyze</p>
            </div>
          )}
        </div>
      </div>
    </PageTransition>
  )
}
