import { useEffect, useState } from 'react'
import api from '../api/client'
import PageTransition from '../components/PageTransition'
import ConfidenceBar from '../components/ConfidenceBar'

const PRED_STYLES = {
  healthy:         { bg: 'bg-emerald-50  border-emerald-200', badge: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
  disease_stress:  { bg: 'bg-orange-50   border-orange-200',  badge: 'bg-orange-100  text-orange-700',  dot: 'bg-orange-500'  },
  nutrient_stress: { bg: 'bg-amber-50    border-amber-200',   badge: 'bg-amber-100   text-amber-700',   dot: 'bg-amber-500'   },
  water_stress:    { bg: 'bg-blue-50     border-blue-200',    badge: 'bg-blue-100    text-blue-700',    dot: 'bg-blue-500'    },
}

function ProbRow({ label, value }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-28 text-slate-500 truncate capitalize">{label.replace(/_/g, ' ')}</span>
      <div className="flex-1 bg-slate-100 rounded-full h-1.5">
        <div className="bg-emerald-500 h-1.5 rounded-full transition-all" style={{ width: `${value}%` }} />
      </div>
      <span className="w-12 text-right text-slate-600 font-medium">{value.toFixed(1)}%</span>
    </div>
  )
}

function ZoneCard({ zone }) {
  const [expanded, setExpanded] = useState(false)
  const style = PRED_STYLES[zone.prediction] || PRED_STYLES.healthy

  if (!zone.prediction) {
    return (
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-slate-700">Zone {zone.zone_index + 1}</span>
          <span className="text-xs text-slate-400">No data yet</span>
        </div>
      </div>
    )
  }

  return (
    <div
      className={`rounded-2xl border shadow-sm p-4 cursor-pointer hover:shadow-md transition-shadow ${style.bg}`}
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {zone.image_path && (
            <img
              src={`/api/dashboard/images/${zone.sensor_id}/file`}
              alt=""
              className="w-10 h-10 rounded-xl object-cover shrink-0 border border-white shadow-sm"
              onError={e => { e.target.style.display = 'none' }}
            />
          )}
          <div>
            <p className="text-sm font-bold text-slate-900">Zone {zone.zone_index + 1}</p>
            <p className="text-xs text-slate-400">Row {zone.zone_row + 1}, Col {zone.zone_col + 1}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-xs font-semibold px-2 py-1 rounded-full capitalize ${style.badge}`}>
            {zone.prediction.replace(/_/g, ' ')}
          </span>
          <span className="text-xs font-bold text-slate-600">{zone.confidence?.toFixed(1)}%</span>
        </div>
      </div>

      {zone.confidence && (
        <div className="mt-3">
          <ConfidenceBar value={zone.confidence} showLabel={false} height="h-1.5" />
        </div>
      )}

      {expanded && zone.all_probs && (
        <div className="mt-4 space-y-2 border-t border-white/60 pt-3">
          {Object.entries(zone.all_probs).map(([label, prob]) => (
            <ProbRow key={label} label={label} value={prob} />
          ))}
          {zone.analyzed_at && (
            <p className="text-xs text-slate-400 mt-1">
              Analyzed: {new Date(zone.analyzed_at).toLocaleString()}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

export default function CropAnalysisPage() {
  const [zones,   setZones]   = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/analysis/crop')
      .then(res => setZones(res.data))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="flex items-center gap-3 text-slate-500 p-4">
      <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      Loading analysis results...
    </div>
  )

  const analyzed    = zones.filter(z => z.prediction)
  const stressCount = analyzed.filter(z => z.prediction !== 'healthy').length

  return (
    <PageTransition>
      <div className="mb-6">
        <h2 className="text-2xl font-extrabold text-slate-900">Crop Analysis</h2>
        <p className="text-sm text-slate-500 mt-1">
          Multimodal model (image + sensors + weather) · {analyzed.length}/{zones.length} zones analyzed
          {stressCount > 0 && <span className="ml-2 text-orange-600 font-medium">· {stressCount} zones with stress</span>}
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {zones.map(zone => <ZoneCard key={zone.sensor_id} zone={zone} />)}
      </div>
    </PageTransition>
  )
}
