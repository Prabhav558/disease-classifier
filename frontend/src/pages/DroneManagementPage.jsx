import { useEffect, useRef, useState } from 'react'
import api from '../api/client'

function UploadForm({ onUploaded }) {
  const [sensors, setSensors] = useState([])
  const [zoneId, setZoneId] = useState('')
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [fields, setFields] = useState({ n: '', p: '', k: '', soil_moisture: '' })
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const fileRef = useRef()

  useEffect(() => {
    api.get('/sensors').then(res => {
      setSensors(res.data)
      if (res.data.length > 0) setZoneId(String(res.data[0].id))
    }).catch(console.error)
  }, [])

  const handleFile = (e) => {
    const f = e.target.files[0]
    if (!f) return
    setFile(f)
    setPreview(URL.createObjectURL(f))
  }

  const handleField = (e) => setFields(prev => ({ ...prev, [e.target.name]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!file) { setError('Please select an image.'); return }
    if (!zoneId) { setError('Please select a zone.'); return }

    setLoading(true)
    setError(null)
    setResult(null)

    const form = new FormData()
    form.append('zone_id', zoneId)
    form.append('image', file)
    form.append('n', fields.n || '0')
    form.append('p', fields.p || '0')
    form.append('k', fields.k || '0')
    form.append('soil_moisture', fields.soil_moisture || '0')

    try {
      const res = await api.post('/drone/upload', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setResult(res.data)
      onUploaded()
    } catch (err) {
      setError(err.response?.data?.detail || 'Upload failed.')
    } finally {
      setLoading(false)
    }
  }

  const predColor = (p) => {
    if (!p) return 'text-gray-300'
    if (p === 'healthy') return 'text-green-400'
    if (p === 'disease_stress') return 'text-orange-400'
    return 'text-yellow-400'
  }

  return (
    <div className="bg-gray-800 rounded p-4 mb-6">
      <h3 className="text-lg font-semibold mb-4">Upload Drone Image</h3>
      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          {/* Left: image + zone */}
          <div className="space-y-3">
            {/* Image picker */}
            <div
              className="border-2 border-dashed border-gray-600 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-gray-400 transition-colors"
              style={{ minHeight: '180px' }}
              onClick={() => fileRef.current.click()}
            >
              {preview ? (
                <img src={preview} alt="preview" className="max-h-44 rounded object-contain" />
              ) : (
                <div className="text-center text-gray-500 p-6">
                  <div className="text-3xl mb-2">📷</div>
                  <p className="text-sm">Click to select image</p>
                  <p className="text-xs mt-1">JPEG or PNG</p>
                </div>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />

            {/* Zone selector */}
            <div>
              <label className="block text-xs text-gray-400 mb-1">Zone</label>
              <select
                value={zoneId}
                onChange={e => setZoneId(e.target.value)}
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm text-white"
              >
                {sensors.map(s => (
                  <option key={s.id} value={s.id}>
                    Zone {s.zone_index + 1} (ID {s.id}) — {s.status}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Right: sensor values */}
          <div className="space-y-3">
            <p className="text-xs text-gray-400">Sensor readings at time of capture</p>
            {[
              { name: 'n', label: 'Nitrogen (N)', unit: 'mg/kg', placeholder: '0–100' },
              { name: 'p', label: 'Phosphorus (P)', unit: 'mg/kg', placeholder: '0–100' },
              { name: 'k', label: 'Potassium (K)', unit: 'mg/kg', placeholder: '0–100' },
              { name: 'soil_moisture', label: 'Soil Moisture', unit: '%', placeholder: '0–100' },
            ].map(({ name, label, unit, placeholder }) => (
              <div key={name}>
                <label className="block text-xs text-gray-400 mb-1">
                  {label} <span className="text-gray-600">({unit})</span>
                </label>
                <input
                  type="number"
                  name={name}
                  value={fields[name]}
                  onChange={handleField}
                  placeholder={placeholder}
                  min="0" max="100" step="0.1"
                  className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm text-white placeholder-gray-500"
                />
              </div>
            ))}
          </div>
        </div>

        {error && (
          <div className="mt-3 text-sm text-red-400 bg-red-900/30 border border-red-700 rounded px-3 py-2">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !file}
          className="mt-4 w-full bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded transition-colors"
        >
          {loading ? 'Analysing…' : 'Upload & Analyse'}
        </button>
      </form>

      {/* Result */}
      {result && (
        <div className="mt-4 bg-gray-900 rounded p-4 border border-gray-700">
          <p className="text-xs text-gray-500 mb-2 uppercase tracking-wide">Analysis Result</p>
          <div className="flex items-center gap-3 mb-3">
            <span className={`text-lg font-bold capitalize ${predColor(result.analysis?.prediction)}`}>
              {result.analysis?.prediction?.replace(/_/g, ' ') ?? '—'}
            </span>
            <span className="text-gray-400 text-sm">
              {result.analysis?.confidence?.toFixed(1)}% confidence
            </span>
          </div>
          <div className="space-y-1">
            {result.analysis?.all_probs_json && Object.entries(result.analysis.all_probs_json)
              .sort(([, a], [, b]) => b - a)
              .map(([label, prob]) => (
                <div key={label} className="flex items-center gap-2 text-xs">
                  <span className="text-gray-400 w-36 capitalize">{label.replace(/_/g, ' ')}</span>
                  <div className="flex-1 bg-gray-700 rounded-full h-1.5">
                    <div
                      className="bg-blue-500 h-1.5 rounded-full"
                      style={{ width: `${prob}%` }}
                    />
                  </div>
                  <span className="text-gray-400 w-10 text-right">{prob.toFixed(1)}%</span>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default function DroneManagementPage() {
  const [status, setStatus] = useState(null)
  const [flights, setFlights] = useState([])

  const fetchFlights = () => {
    api.get('/drone/flights').then(res => setFlights(res.data)).catch(console.error)
  }

  useEffect(() => {
    api.get('/drone/status').then(res => setStatus(res.data)).catch(console.error)
    fetchFlights()
  }, [])

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">Drone Management</h2>

      <UploadForm onUploaded={fetchFlights} />

      {/* Status */}
      <div className="bg-gray-800 rounded p-4 mb-6">
        <h3 className="text-lg font-semibold mb-2">Drone Status</h3>
        {status ? (
          <div className="space-y-1 text-sm">
            <p>Status: <span className="text-yellow-400 font-medium">{status.status}</span></p>
            <p className="text-gray-400">{status.mode}</p>
          </div>
        ) : (
          <p className="text-gray-400">Loading...</p>
        )}
      </div>

      {/* Flight History */}
      <div className="bg-gray-800 rounded p-4">
        <h3 className="text-lg font-semibold mb-3">Upload History</h3>
        {flights.length === 0 ? (
          <p className="text-gray-400 text-sm">No uploads yet</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-700 text-gray-400">
                  <th className="text-left py-2 px-3">ID</th>
                  <th className="text-left py-2 px-3">Zone</th>
                  <th className="text-left py-2 px-3">Image</th>
                  <th className="text-left py-2 px-3">Captured At</th>
                </tr>
              </thead>
              <tbody>
                {flights.map(f => (
                  <tr key={f.id} className="border-b border-gray-700/50">
                    <td className="py-2 px-3">{f.id}</td>
                    <td className="py-2 px-3">{f.sensor_id}</td>
                    <td className="py-2 px-3 text-gray-400">{f.image_path}</td>
                    <td className="py-2 px-3">{new Date(f.captured_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
