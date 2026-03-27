import { useEffect, useState } from 'react'
import api from '../api/client'
import PageTransition from '../components/PageTransition'

function GridCell({ cell }) {
  const getColor = () => {
    if (cell.status === 'error' || cell.status === 'offline') return 'bg-red-400'
    if (!cell.latest_prediction) return 'bg-emerald-400'
    switch (cell.latest_prediction) {
      case 'healthy':         return 'bg-emerald-400'
      case 'disease_stress':  return 'bg-orange-400'
      case 'nutrient_stress': return 'bg-amber-400'
      case 'water_stress':    return 'bg-blue-400'
      default:                return 'bg-emerald-400'
    }
  }

  const formatLastSeen = (ts) => {
    if (!ts) return 'Never'
    const d       = new Date(ts + 'Z')
    const diffSec = Math.floor((Date.now() - d.getTime()) / 1000)
    if (diffSec < 60)   return `${diffSec}s ago`
    const diffMin = Math.floor(diffSec / 60)
    if (diffMin < 60)   return `${diffMin}m ago`
    return d.toLocaleTimeString()
  }

  const statusLabel = cell.status === 'offline' ? 'OFFLINE'
    : cell.status === 'error'  ? 'ERROR'
    : cell.latest_prediction
    ? `${cell.latest_prediction.replace(/_/g, ' ')} (${cell.latest_confidence?.toFixed(1)}%)`
    : 'No data yet'

  return (
    <div className={`${getColor()} rounded-lg aspect-square flex items-center justify-center relative group cursor-pointer border-2 border-white shadow-sm`}>
      <div className="w-2 h-2 bg-white/70 rounded-full" />
      {cell.has_alert && (
        <div className="absolute top-0.5 right-0.5 w-2 h-2 bg-red-600 rounded-full animate-pulse" />
      )}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-10 pointer-events-none">
        <div className="bg-slate-900 rounded-xl shadow-xl px-3 py-2 text-xs text-white whitespace-nowrap">
          <div className="font-semibold mb-0.5">Zone {cell.zone_index + 1}</div>
          <div className="text-slate-300">{statusLabel}</div>
          <div className="mt-1 text-slate-400">Last: {formatLastSeen(cell.last_reading_at)}</div>
        </div>
        <div className="w-2 h-2 bg-slate-900 rotate-45 mx-auto -mt-1" />
      </div>
    </div>
  )
}

function AlertsPanel({ alerts, onAcknowledge }) {
  if (alerts.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 mt-6">
        <h3 className="text-sm font-semibold text-slate-700 mb-1">Alerts</h3>
        <p className="text-slate-400 text-sm flex items-center gap-1.5">
          <span className="text-emerald-500">✓</span> No active alerts
        </p>
      </div>
    )
  }
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 mt-6">
      <h3 className="text-sm font-semibold text-slate-700 mb-3">
        Alerts <span className="ml-1 bg-red-100 text-red-600 text-xs px-1.5 py-0.5 rounded-full">{alerts.length}</span>
      </h3>
      <div className="space-y-2 max-h-56 overflow-auto">
        {alerts.map(alert => (
          <div
            key={alert.id}
            className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-sm border ${
              alert.severity === 'critical'
                ? 'bg-red-50 border-red-200 text-red-800'
                : 'bg-amber-50 border-amber-200 text-amber-800'
            }`}
          >
            <span>
              <span className="font-semibold">Zone {alert.sensor_id}:</span>{' '}
              <span className="font-normal">{alert.message}</span>
            </span>
            <button
              onClick={() => onAcknowledge(alert.id)}
              className="text-xs bg-white hover:bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-lg ml-3 shrink-0 text-slate-600 transition-colors"
            >
              Dismiss
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

const LEGEND = [
  { color: 'bg-emerald-400', label: 'Healthy'         },
  { color: 'bg-orange-400',  label: 'Disease stress'  },
  { color: 'bg-amber-400',   label: 'Nutrient stress' },
  { color: 'bg-blue-400',    label: 'Water stress'    },
  { color: 'bg-red-400',     label: 'Offline / Error' },
]

export default function DashboardPage({ config }) {
  const [grid,   setGrid]   = useState([])
  const [alerts, setAlerts] = useState([])

  const fetchData = async () => {
    try {
      const [gridRes, alertsRes] = await Promise.all([
        api.get('/dashboard/grid'),
        api.get('/alerts', { params: { acknowledged: false } }),
      ])
      setGrid(gridRes.data)
      setAlerts(alertsRes.data)
    } catch (err) {
      console.error('Dashboard fetch failed', err)
    }
  }

  useEffect(() => {
    fetchData()
    const id = setInterval(fetchData, 10000)
    return () => clearInterval(id)
  }, [])

  const handleAcknowledge = async (alertId) => {
    try {
      await api.put(`/alerts/${alertId}/acknowledge`)
      setAlerts(prev => prev.filter(a => a.id !== alertId))
    } catch (err) {
      console.error(err)
    }
  }

  return (
    <PageTransition>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900">Field Overview</h2>
          <p className="text-sm text-slate-400 mt-0.5">
            {config.crop_type} · {config.grid_rows}×{config.grid_cols} grid · {config.region}
          </p>
        </div>
        <span className="flex items-center gap-1.5 text-xs text-slate-400 bg-slate-100 px-3 py-1.5 rounded-full">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          Live · 10s refresh
        </span>
      </div>

      {/* Grid */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 inline-block">
        <div
          className="grid gap-1.5"
          style={{ gridTemplateColumns: `repeat(${config.grid_cols}, minmax(36px, 52px))` }}
        >
          {grid.map(cell => (
            <GridCell key={cell.sensor_id} cell={cell} />
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 mt-4">
        {LEGEND.map(l => (
          <div key={l.label} className="flex items-center gap-1.5 text-xs text-slate-500">
            <div className={`w-3 h-3 rounded-sm ${l.color}`} />
            {l.label}
          </div>
        ))}
      </div>

      <AlertsPanel alerts={alerts} onAcknowledge={handleAcknowledge} />
    </PageTransition>
  )
}
