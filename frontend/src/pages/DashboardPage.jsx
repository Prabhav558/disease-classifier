import { useEffect, useState } from 'react'
import api from '../api/client'

function GridCell({ cell }) {
  const getColor = () => {
    if (cell.status === 'error' || cell.status === 'offline') return 'bg-red-500'
    if (!cell.latest_prediction) return 'bg-green-500'
    switch (cell.latest_prediction) {
      case 'healthy': return 'bg-green-500'
      case 'disease_stress': return 'bg-orange-500'
      case 'nutrient_stress': return 'bg-yellow-500'
      case 'water_stress': return 'bg-yellow-500'
      default: return 'bg-green-500'
    }
  }

  return (
    <div
      className={`${getColor()} rounded aspect-square flex items-center justify-center relative group cursor-pointer border border-gray-700`}
      title={`Zone ${cell.zone_index + 1}${cell.latest_prediction ? ` - ${cell.latest_prediction} (${cell.latest_confidence?.toFixed(1)}%)` : ''}`}
    >
      <div className="w-2 h-2 bg-gray-900 rounded-full" />
      {cell.has_alert && (
        <div className="absolute top-0.5 right-0.5 w-2 h-2 bg-red-700 rounded-full animate-pulse" />
      )}
    </div>
  )
}

function AlertsPanel({ alerts, onAcknowledge }) {
  if (alerts.length === 0) {
    return (
      <div className="bg-gray-800 rounded p-4 mt-6">
        <h3 className="text-lg font-semibold mb-2">Alerts</h3>
        <p className="text-gray-400 text-sm">No active alerts</p>
      </div>
    )
  }

  return (
    <div className="bg-gray-800 rounded p-4 mt-6">
      <h3 className="text-lg font-semibold mb-3">Alerts</h3>
      <div className="space-y-2 max-h-60 overflow-auto">
        {alerts.map(alert => (
          <div
            key={alert.id}
            className={`flex items-center justify-between px-3 py-2 rounded text-sm ${
              alert.severity === 'critical' ? 'bg-red-900/50 border border-red-700' : 'bg-yellow-900/50 border border-yellow-700'
            }`}
          >
            <span>
              <span className="font-medium">Zone {alert.sensor_id}:</span> {alert.message}
            </span>
            <button
              onClick={() => onAcknowledge(alert.id)}
              className="text-xs bg-gray-700 hover:bg-gray-600 px-2 py-1 rounded ml-2 shrink-0"
            >
              Dismiss
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function DashboardPage({ config }) {
  const [grid, setGrid] = useState([])
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
      console.error('Failed to fetch dashboard data', err)
    }
  }

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 30000)
    return () => clearInterval(interval)
  }, [])

  const handleAcknowledge = async (alertId) => {
    try {
      await api.put(`/alerts/${alertId}/acknowledge`)
      setAlerts(prev => prev.filter(a => a.id !== alertId))
    } catch (err) {
      console.error('Failed to acknowledge alert', err)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold">Field Overview</h2>
        <span className="text-sm text-gray-400">
          {config.crop_type} | {config.grid_rows}x{config.grid_cols} grid | {config.region}
        </span>
      </div>

      {/* Field grid */}
      <div className="bg-gray-800 rounded p-4 inline-block">
        <div
          className="grid gap-1"
          style={{ gridTemplateColumns: `repeat(${config.grid_cols}, minmax(40px, 60px))` }}
        >
          {grid.map(cell => (
            <GridCell key={cell.sensor_id} cell={cell} />
          ))}
        </div>
      </div>

      <AlertsPanel alerts={alerts} onAcknowledge={handleAcknowledge} />
    </div>
  )
}
