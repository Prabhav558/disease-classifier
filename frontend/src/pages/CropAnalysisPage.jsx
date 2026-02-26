import { useEffect, useState } from 'react'
import api from '../api/client'

function ProbBar({ label, value }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="w-28 text-gray-400 truncate">{label}</span>
      <div className="flex-1 bg-gray-700 rounded-full h-3">
        <div
          className="bg-teal-500 h-3 rounded-full transition-all"
          style={{ width: `${value}%` }}
        />
      </div>
      <span className="w-14 text-right text-gray-300">{value.toFixed(1)}%</span>
    </div>
  )
}

function ZoneCard({ zone }) {
  const [expanded, setExpanded] = useState(false)

  const predColor = {
    healthy: 'bg-green-600',
    disease_stress: 'bg-orange-600',
    nutrient_stress: 'bg-yellow-600',
    water_stress: 'bg-blue-600',
  }

  if (!zone.prediction) {
    return (
      <div className="bg-gray-800 rounded p-4">
        <div className="flex items-center justify-between">
          <span className="font-medium">Zone {zone.zone_index + 1}</span>
          <span className="text-xs text-gray-500">No analysis yet</span>
        </div>
      </div>
    )
  }

  return (
    <div
      className="bg-gray-800 rounded p-4 cursor-pointer hover:bg-gray-750 transition-colors"
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {zone.image_path && (
            <img
              src={`/api/dashboard/images/${zone.sensor_id}/file`}
              alt=""
              className="w-12 h-12 rounded object-cover"
              onError={(e) => { e.target.style.display = 'none' }}
            />
          )}
          <div>
            <span className="font-medium">Zone {zone.zone_index + 1}</span>
            <p className="text-xs text-gray-400">Row {zone.zone_row + 1}, Col {zone.zone_col + 1}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`${predColor[zone.prediction] || 'bg-gray-600'} px-2 py-1 rounded text-xs font-medium`}>
            {zone.prediction.replace('_', ' ')}
          </span>
          <span className="text-sm text-gray-300">{zone.confidence?.toFixed(1)}%</span>
        </div>
      </div>

      {expanded && zone.all_probs && (
        <div className="mt-4 space-y-2 border-t border-gray-700 pt-3">
          {Object.entries(zone.all_probs).map(([label, prob]) => (
            <ProbBar key={label} label={label.replace('_', ' ')} value={prob} />
          ))}
          {zone.analyzed_at && (
            <p className="text-xs text-gray-500 mt-2">
              Analyzed: {new Date(zone.analyzed_at).toLocaleString()}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

export default function CropAnalysisPage({ config }) {
  const [zones, setZones] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/analysis/crop')
      .then(res => setZones(res.data))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <p className="text-gray-400">Loading analysis results...</p>

  const analyzed = zones.filter(z => z.prediction)
  const stressCount = analyzed.filter(z => z.prediction !== 'healthy').length

  return (
    <div>
      <h2 className="text-2xl font-bold mb-2">Crop Analysis</h2>
      <p className="text-sm text-gray-400 mb-4">
        Multimodal model (image + sensors) | {analyzed.length}/{zones.length} zones analyzed
        {stressCount > 0 && <span className="text-orange-400"> | {stressCount} zones with stress</span>}
      </p>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {zones.map(zone => (
          <ZoneCard key={zone.sensor_id} zone={zone} />
        ))}
      </div>
    </div>
  )
}
