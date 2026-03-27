import { useEffect, useRef, useState } from 'react'
import api from '../api/client'
import PageTransition from '../components/PageTransition'
const inputCls = 'w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent'

function UploadForm({ onUploaded }) {
  const [sensors, setSensors] = useState([])
  const [zoneId,  setZoneId]  = useState('')
  const [file,    setFile]    = useState(null)
  const [preview, setPreview] = useState(null)
  const [fields,  setFields]  = useState({ n: '', p: '', k: '', soil_moisture: '' })
  const [loading, setLoading] = useState(false)
  const [result,  setResult]  = useState(null)
  const [error,   setError]   = useState(null)
  const fileRef = useRef()

  useEffect(() => {
    api.get('/sensors').then(res => {
      setSensors(res.data)
      if (res.data.length > 0) setZoneId(String(res.data[0].id))
    }).catch(console.error)
  }, [])

  const handleFile = (e) => {
    const f = e.target.files[0]; if (!f) return
    setFile(f); setPreview(URL.createObjectURL(f))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!file)   { setError('Please select an image.');  return }
    if (!zoneId) { setError('Please select a zone.');    return }
    setLoading(true); setError(null); setResult(null)
    const form = new FormData()
    form.append('zone_id', zoneId); form.append('image', file)
    form.append('n', fields.n || '0'); form.append('p', fields.p || '0')
    form.append('k', fields.k || '0'); form.append('soil_moisture', fields.soil_moisture || '0')
    try {
      const res = await api.post('/drone/upload', form, { headers: { 'Content-Type': 'multipart/form-data' } })
      setResult(res.data); onUploaded()
    } catch (err) {
      setError(err.response?.data?.detail || 'Upload failed.')
    } finally { setLoading(false) }
  }

  const predColor = (p) => {
    if (!p) return 'text-slate-600'
    if (p === 'healthy')        return 'text-emerald-600'
    if (p === 'disease_stress') return 'text-orange-600'
    return 'text-amber-600'
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 mb-6">
      <h3 className="text-base font-bold text-slate-900 mb-5">Upload Drone Image</h3>
      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Left */}
          <div className="space-y-3">
            <div
              className="border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center cursor-pointer hover:border-emerald-400 hover:bg-emerald-50/30 transition-colors"
              style={{ minHeight: 180 }}
              onClick={() => fileRef.current.click()}
            >
              {preview ? (
                <img src={preview} alt="preview" className="max-h-44 rounded-xl object-contain" />
              ) : (
                <div className="text-center text-slate-400 p-6">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-xl mx-auto mb-2">📷</div>
                  <p className="text-sm font-medium">Click to select image</p>
                  <p className="text-xs mt-1">JPEG or PNG</p>
                </div>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Zone</label>
              <select value={zoneId} onChange={e => setZoneId(e.target.value)} className={inputCls}>
                {sensors.map(s => (
                  <option key={s.id} value={s.id}>Zone {s.zone_index + 1} (ID {s.id}) — {s.status}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Right */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Sensor readings at capture</p>
            {[
              { name: 'n',             label: 'Nitrogen (N)',   unit: 'mg/kg' },
              { name: 'p',             label: 'Phosphorus (P)', unit: 'mg/kg' },
              { name: 'k',             label: 'Potassium (K)',  unit: 'mg/kg' },
              { name: 'soil_moisture', label: 'Soil Moisture',  unit: '%'     },
            ].map(({ name, label, unit }) => (
              <div key={name}>
                <label className="block text-xs text-slate-500 mb-1">
                  {label} <span className="text-slate-300">({unit})</span>
                </label>
                <input
                  type="number" name={name}
                  value={fields[name]}
                  onChange={e => setFields(p => ({ ...p, [e.target.name]: e.target.value }))}
                  placeholder="0–100" min="0" max="100" step="0.1"
                  className={inputCls}
                />
              </div>
            ))}
          </div>
        </div>

        {error && (
          <div className="mt-4 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-2.5 text-sm">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !file}
          className="mt-5 w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors"
        >
          {loading ? 'Analysing…' : 'Upload & Analyse'}
        </button>
      </form>

      {result && (
        <div className="mt-5 bg-slate-50 rounded-2xl border border-slate-100 p-5">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Analysis Result</p>
          <div className="flex items-center gap-3 mb-4">
            <span className={`text-base font-extrabold capitalize ${predColor(result.analysis?.prediction)}`}>
              {result.analysis?.prediction?.replace(/_/g, ' ') ?? '—'}
            </span>
            <span className="text-slate-400 text-sm">{result.analysis?.confidence?.toFixed(1)}% confidence</span>
          </div>
          {result.analysis?.all_probs_json && (
            <div className="space-y-1.5">
              {Object.entries(result.analysis.all_probs_json).sort(([,a],[,b])=>b-a).map(([label, prob]) => (
                <div key={label} className="flex items-center gap-2 text-xs">
                  <span className="text-slate-500 w-36 capitalize">{label.replace(/_/g, ' ')}</span>
                  <div className="flex-1 bg-slate-200 rounded-full h-1.5">
                    <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${prob}%` }} />
                  </div>
                  <span className="text-slate-400 w-10 text-right">{prob.toFixed(1)}%</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function DroneManagementPage() {
  const [status,  setStatus]  = useState(null)
  const [flights, setFlights] = useState([])
  const fetchFlights = () => api.get('/drone/flights').then(res => setFlights(res.data)).catch(console.error)
  useEffect(() => {
    api.get('/drone/status').then(res => setStatus(res.data)).catch(console.error)
    fetchFlights()
  }, [])

  return (
    <PageTransition>
      <div className="mb-6">
        <h2 className="text-2xl font-extrabold text-slate-900">Drone Management</h2>
        <p className="text-sm text-slate-500 mt-1">Upload images and trigger multimodal analysis.</p>
      </div>

      <UploadForm onUploaded={fetchFlights} />

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 mb-6">
        <h3 className="text-sm font-bold text-slate-800 mb-3">Drone Status</h3>
        {status ? (
          <div className="text-sm space-y-1">
            <p>Status: <span className="font-semibold text-amber-600">{status.status}</span></p>
            <p className="text-slate-500">{status.mode}</p>
          </div>
        ) : <p className="text-slate-400 text-sm">Loading...</p>}
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h3 className="text-sm font-bold text-slate-800">Upload History</h3>
        </div>
        {flights.length === 0 ? (
          <div className="text-center text-slate-400 text-sm py-8">No uploads yet</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="text-left py-3 px-5">ID</th>
                  <th className="text-left py-3 px-5">Zone</th>
                  <th className="text-left py-3 px-5">Image Path</th>
                  <th className="text-left py-3 px-5">Captured At</th>
                </tr>
              </thead>
              <tbody>
                {flights.map(f => (
                  <tr key={f.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                    <td className="py-3 px-5 text-slate-600">{f.id}</td>
                    <td className="py-3 px-5 font-medium text-slate-800">Zone {f.sensor_id}</td>
                    <td className="py-3 px-5 text-slate-400 text-xs font-mono truncate max-w-xs">{f.image_path}</td>
                    <td className="py-3 px-5 text-slate-500">{new Date(f.captured_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </PageTransition>
  )
}
