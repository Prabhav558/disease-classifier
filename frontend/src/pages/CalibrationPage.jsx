import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api/client'
import PageTransition from '../components/PageTransition'

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">{label}</label>
      {children}
    </div>
  )
}

const inputCls = 'w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition'
const selectCls = inputCls

export default function CalibrationPage({ onConfigured }) {
  const navigate = useNavigate()
  const [form, setForm] = useState({
    field_width: 8, field_height: 14, sensor_spacing: 2,
    crop_type: 'Corn', soil_type: 'Loamy', region: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]           = useState('')

  const gridRows    = Math.ceil(form.field_width  / form.sensor_spacing) || 0
  const gridCols    = Math.ceil(form.field_height / form.sensor_spacing) || 0
  const totalSensors = gridRows * gridCols

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm(prev => ({
      ...prev,
      [name]: ['field_width', 'field_height', 'sensor_spacing'].includes(name)
        ? parseFloat(value) || 0
        : value,
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.region.trim()) { setError('Please enter your region / city.'); return }
    setSubmitting(true); setError('')
    try {
      await api.post('/config', form)
      await onConfigured()
      navigate('/dashboard')
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to save configuration.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <PageTransition>
      <div className="max-w-xl mx-auto">
        <div className="mb-6">
          <h2 className="text-2xl font-extrabold text-slate-900">Farm Setup</h2>
          <p className="text-sm text-slate-500 mt-1">Configure your field dimensions and sensor grid.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Field Dimensions</p>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Width (m)">
                <input type="number" name="field_width"  value={form.field_width}  onChange={handleChange} min="1" step="0.5" className={inputCls} />
              </Field>
              <Field label="Height (m)">
                <input type="number" name="field_height" value={form.field_height} onChange={handleChange} min="1" step="0.5" className={inputCls} />
              </Field>
            </div>
            <Field label="Sensor Spacing (m)">
              <input type="number" name="sensor_spacing" value={form.sensor_spacing} onChange={handleChange} min="0.5" step="0.5" className={inputCls} />
            </Field>
          </div>

          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Crop & Location</p>
            <Field label="Crop Type">
              <select name="crop_type" value={form.crop_type} onChange={handleChange} className={selectCls}>
                {['Corn','Potato','Rice','Wheat'].map(c => <option key={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Soil Type">
              <select name="soil_type" value={form.soil_type} onChange={handleChange} className={selectCls}>
                {['Alluvial','Black','Clay','Loamy','Red','Sandy'].map(s => <option key={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="Region (City / Pincode)">
              <input type="text" name="region" value={form.region} onChange={handleChange} placeholder="e.g. Delhi, 110001" className={inputCls} />
            </Field>
          </div>

          {/* Grid preview */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 text-center">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Sensor Grid Preview</p>
            <p className="text-2xl font-extrabold text-emerald-600">
              {gridRows} × {gridCols} = <span className="text-slate-900">{totalSensors} zones</span>
            </p>
            {totalSensors > 0 && totalSensors <= 200 && (
              <div className="inline-grid gap-1 mt-4" style={{ gridTemplateColumns: `repeat(${gridCols}, 1fr)` }}>
                {Array.from({ length: totalSensors }).map((_, i) => (
                  <div key={i} className="w-5 h-5 bg-emerald-400 rounded-sm flex items-center justify-center">
                    <div className="w-1 h-1 bg-white rounded-full" />
                  </div>
                ))}
              </div>
            )}
          </div>

          {error && (
            <p className="text-sm text-red-600 flex items-center gap-1.5">
              <span>⚠</span> {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting || totalSensors === 0}
            className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white font-semibold py-3.5 rounded-xl transition-colors"
          >
            {submitting ? 'Saving...' : 'Save Configuration'}
          </button>
        </form>
      </div>
    </PageTransition>
  )
}
