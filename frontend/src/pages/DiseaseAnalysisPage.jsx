import { useEffect, useState } from 'react'
import api from '../api/client'

export default function DiseaseAnalysisPage() {
  const [images, setImages] = useState([])
  const [selected, setSelected] = useState(null)
  const [result, setResult] = useState(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/dashboard/images')
      .then(res => setImages(res.data))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const handleAnalyze = async () => {
    if (!selected) return
    setAnalyzing(true)
    setResult(null)
    try {
      const res = await api.post('/analysis/disease', { drone_image_id: selected.id })
      setResult(res.data)
    } catch (err) {
      console.error('Disease analysis failed', err)
    } finally {
      setAnalyzing(false)
    }
  }

  // Sort probabilities descending
  const sortedProbs = result?.all_probs_json
    ? Object.entries(result.all_probs_json).sort((a, b) => b[1] - a[1])
    : []

  return (
    <div>
      <h2 className="text-2xl font-bold mb-2">Disease Analysis</h2>
      <p className="text-sm text-gray-400 mb-4">
        Original ViT model (image-only, 13 disease classes) | Images from last 2 days
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Image browser */}
        <div>
          <h3 className="text-lg font-semibold mb-3">Select Image</h3>
          {loading ? (
            <p className="text-gray-400">Loading images...</p>
          ) : images.length === 0 ? (
            <p className="text-gray-400">No images uploaded in the last 2 days. Use the drone upload endpoint to add images.</p>
          ) : (
            <div className="grid grid-cols-3 gap-2 max-h-96 overflow-auto">
              {images.map(img => (
                <div
                  key={img.id}
                  onClick={() => { setSelected(img); setResult(null) }}
                  className={`cursor-pointer rounded overflow-hidden border-2 transition-colors ${
                    selected?.id === img.id ? 'border-teal-500' : 'border-transparent'
                  }`}
                >
                  <img
                    src={`/api/dashboard/images/${img.id}/file`}
                    alt={`Zone ${img.sensor_id}`}
                    className="w-full aspect-square object-cover"
                  />
                  <p className="text-xs text-center py-1 bg-gray-800">Zone {img.sensor_id}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: Analysis panel */}
        <div>
          {selected ? (
            <div>
              <h3 className="text-lg font-semibold mb-3">Analysis</h3>
              <img
                src={`/api/dashboard/images/${selected.id}/file`}
                alt="Selected"
                className="w-full max-w-sm rounded mb-4"
              />
              <p className="text-sm text-gray-400 mb-2">
                Zone {selected.sensor_id} | {new Date(selected.captured_at).toLocaleString()}
              </p>

              <button
                onClick={handleAnalyze}
                disabled={analyzing}
                className="bg-teal-600 hover:bg-teal-700 disabled:bg-gray-600 text-white font-medium px-4 py-2 rounded transition-colors mb-4"
              >
                {analyzing ? 'Analyzing...' : 'Run Disease Analysis'}
              </button>

              {result && (
                <div className="bg-gray-800 rounded p-4 mt-4">
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-xl font-bold text-orange-400">
                      {result.prediction}
                    </span>
                    <span className="text-gray-400">({result.confidence.toFixed(1)}%)</span>
                  </div>

                  <div className="space-y-2">
                    {sortedProbs.slice(0, 10).map(([label, prob]) => (
                      <div key={label} className="flex items-center gap-2 text-sm">
                        <span className="w-44 text-gray-400 truncate">{label}</span>
                        <div className="flex-1 bg-gray-700 rounded-full h-2.5">
                          <div
                            className="bg-orange-500 h-2.5 rounded-full"
                            style={{ width: `${prob}%` }}
                          />
                        </div>
                        <span className="w-14 text-right text-gray-300">{prob.toFixed(1)}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500">
              Select an image from the left to analyze
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
