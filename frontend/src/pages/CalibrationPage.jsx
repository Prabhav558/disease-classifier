import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api/client'

export default function CalibrationPage({ onConfigured }) {
  const navigate = useNavigate()
  const [form, setForm] = useState({
    field_width: 8,
    field_height: 14,
    sensor_spacing: 2,
    crop_type: 'Corn',
    region: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const gridRows = Math.ceil(form.field_width / form.sensor_spacing) || 0
  const gridCols = Math.ceil(form.field_height / form.sensor_spacing) || 0
  const totalSensors = gridRows * gridCols

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm(prev => ({
      ...prev,
      [name]: ['field_width', 'field_height', 'sensor_spacing'].includes(name) ? parseFloat(value) || 0 : value,
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.region.trim()) {
      setError('Please enter your region/city')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      await api.post('/config', form)
      await onConfigured()
      navigate('/')
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to save configuration')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-xl mx-auto">
      <h2 className="text-2xl font-bold mb-6">Farm Setup & Sensor Calibration</h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Field Width (m)</label>
            <input
              type="number" name="field_width" value={form.field_width} onChange={handleChange}
              min="1" step="0.5"
              className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Field Height (m)</label>
            <input
              type="number" name="field_height" value={form.field_height} onChange={handleChange}
              min="1" step="0.5"
              className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-1">Sensor Spacing (m)</label>
          <input
            type="number" name="sensor_spacing" value={form.sensor_spacing} onChange={handleChange}
            min="0.5" step="0.5"
            className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white"
          />
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-1">Crop Type</label>
          <select
            name="crop_type" value={form.crop_type} onChange={handleChange}
            className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white"
          >
            <option value="Corn">Corn</option>
            <option value="Potato">Potato</option>
            <option value="Rice">Rice</option>
            <option value="Wheat">Wheat</option>
          </select>
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-1">Region (City / Pincode)</label>
          <input
            type="text" name="region" value={form.region} onChange={handleChange}
            placeholder="e.g. Delhi, 110001"
            className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white"
          />
        </div>

        {/* Grid preview */}
        <div className="bg-gray-800 rounded p-4 text-center">
          <p className="text-sm text-gray-400">Grid Preview</p>
          <p className="text-lg font-bold text-green-400">
            {gridRows} x {gridCols} = {totalSensors} zones
          </p>
          {totalSensors > 0 && totalSensors <= 200 && (
            <div
              className="inline-grid gap-1 mt-3"
              style={{ gridTemplateColumns: `repeat(${gridCols}, 1fr)` }}
            >
              {Array.from({ length: totalSensors }).map((_, i) => (
                <div key={i} className="w-6 h-6 bg-green-500 rounded-sm flex items-center justify-center">
                  <div className="w-1.5 h-1.5 bg-gray-900 rounded-full" />
                </div>
              ))}
            </div>
          )}
        </div>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <button
          type="submit"
          disabled={submitting || totalSensors === 0}
          className="w-full bg-teal-600 hover:bg-teal-700 disabled:bg-gray-600 text-white font-medium py-2 rounded transition-colors"
        >
          {submitting ? 'Saving...' : 'Save Configuration'}
        </button>
      </form>
    </div>
  )
}
