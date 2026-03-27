import { useEffect, useState } from 'react'
import api from '../api/client'

const STATUS_COLORS = {
  active: 'text-blue-400 bg-blue-900/30 border-blue-700',
  stopped: 'text-gray-400 bg-gray-800 border-gray-700',
  scheduled: 'text-yellow-400 bg-yellow-900/30 border-yellow-700',
}

function formatDuration(started, stopped) {
  const end = stopped ? new Date(stopped) : new Date()
  const secs = Math.floor((end - new Date(started)) / 1000)
  if (secs < 60) return `${secs}s`
  if (secs < 3600) return `${Math.floor(secs / 60)}m ${secs % 60}s`
  return `${Math.floor(secs / 3600)}h ${Math.floor((secs % 3600) / 60)}m`
}

function WaterLogRow({ log, onStop }) {
  const [elapsed, setElapsed] = useState(formatDuration(log.started_at, log.stopped_at))

  useEffect(() => {
    if (log.status !== 'active') return
    const id = setInterval(() => setElapsed(formatDuration(log.started_at, null)), 1000)
    return () => clearInterval(id)
  }, [log])

  return (
    <tr className="border-b border-gray-700 hover:bg-gray-800/50">
      <td className="py-3 px-4 text-sm">Zone {log.sensor_id}</td>
      <td className="py-3 px-4">
        <span className={`text-xs font-medium px-2 py-0.5 rounded border ${STATUS_COLORS[log.status] || STATUS_COLORS.stopped}`}>
          {log.status.toUpperCase()}
        </span>
      </td>
      <td className="py-3 px-4 text-sm text-gray-300">
        {new Date(log.started_at).toLocaleString()}
      </td>
      <td className="py-3 px-4 text-sm text-gray-300 font-mono">{elapsed}</td>
      <td className="py-3 px-4 text-sm text-gray-400">{log.triggered_by}</td>
      <td className="py-3 px-4">
        {log.status === 'active' && (
          <button
            onClick={() => onStop(log.sensor_id)}
            className="text-xs bg-red-900/50 hover:bg-red-800 border border-red-700 text-red-300 px-3 py-1 rounded transition-colors"
          >
            Stop
          </button>
        )}
      </td>
    </tr>
  )
}

function ScheduleRow({ schedule, onToggle, onDelete }) {
  const ACTION_LABELS = {
    water_start: '💧 Start water',
    water_stop: '🚱 Stop water',
    sensor_read: '📡 Sensor read',
    scan: '🔍 Run scan',
  }
  return (
    <tr className="border-b border-gray-700 hover:bg-gray-800/50">
      <td className="py-3 px-4 text-sm font-medium">{schedule.name}</td>
      <td className="py-3 px-4 text-sm text-gray-300">{ACTION_LABELS[schedule.action_type] || schedule.action_type}</td>
      <td className="py-3 px-4 text-sm text-gray-300">{schedule.zone_id ? `Zone ${schedule.zone_id}` : 'All zones'}</td>
      <td className="py-3 px-4 text-sm font-mono text-teal-400">{schedule.time_of_day}</td>
      <td className="py-3 px-4 text-sm text-gray-400 capitalize">{schedule.repeat}</td>
      <td className="py-3 px-4">
        <span className={`text-xs px-2 py-0.5 rounded ${schedule.enabled ? 'bg-green-900/40 text-green-400' : 'bg-gray-700 text-gray-500'}`}>
          {schedule.enabled ? 'Active' : 'Paused'}
        </span>
      </td>
      <td className="py-3 px-4 flex gap-2">
        <button
          onClick={() => onToggle(schedule.id)}
          className="text-xs bg-gray-700 hover:bg-gray-600 px-2 py-1 rounded transition-colors"
        >
          {schedule.enabled ? 'Pause' : 'Resume'}
        </button>
        <button
          onClick={() => onDelete(schedule.id)}
          className="text-xs bg-red-900/40 hover:bg-red-800 border border-red-800 text-red-400 px-2 py-1 rounded transition-colors"
        >
          Delete
        </button>
      </td>
    </tr>
  )
}

const EMPTY_SCHEDULE = {
  name: '',
  action_type: 'water_start',
  zone_id: '',
  time_of_day: '06:00',
  repeat: 'daily',
}

export default function WaterSupplyPage() {
  const [logs, setLogs] = useState([])
  const [schedules, setSchedules] = useState([])
  const [loadingLogs, setLoadingLogs] = useState(true)
  const [loadingSchedules, setLoadingSchedules] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [newSchedule, setNewSchedule] = useState(EMPTY_SCHEDULE)
  const [showScheduleForm, setShowScheduleForm] = useState(false)
  const [error, setError] = useState('')

  const fetchLogs = async () => {
    try {
      const { data } = await api.get('/water')
      setLogs(data)
    } catch {
      // ignore
    } finally {
      setLoadingLogs(false)
    }
  }

  const fetchSchedules = async () => {
    try {
      const { data } = await api.get('/schedules')
      setSchedules(data)
    } catch {
      // ignore
    } finally {
      setLoadingSchedules(false)
    }
  }

  useEffect(() => {
    fetchLogs()
    fetchSchedules()
    const id = setInterval(fetchLogs, 10000)
    return () => clearInterval(id)
  }, [])

  const startAll = async () => {
    setActionLoading(true)
    setError('')
    try {
      await api.post('/water/start-all', { triggered_by: 'manual' })
      await fetchLogs()
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to start irrigation')
    } finally {
      setActionLoading(false)
    }
  }

  const stopAll = async () => {
    setActionLoading(true)
    setError('')
    try {
      await api.post('/water/stop-all')
      await fetchLogs()
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to stop irrigation')
    } finally {
      setActionLoading(false)
    }
  }

  const stopZone = async (zoneId) => {
    try {
      await api.post(`/water/stop/${zoneId}`)
      await fetchLogs()
    } catch (e) {
      setError(e.response?.data?.detail || `Failed to stop zone ${zoneId}`)
    }
  }

  const createSchedule = async (e) => {
    e.preventDefault()
    setError('')
    try {
      const payload = {
        ...newSchedule,
        zone_id: newSchedule.zone_id ? parseInt(newSchedule.zone_id) : null,
      }
      await api.post('/schedules', payload)
      setNewSchedule(EMPTY_SCHEDULE)
      setShowScheduleForm(false)
      await fetchSchedules()
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to create schedule')
    }
  }

  const toggleSchedule = async (id) => {
    try {
      await api.patch(`/schedules/${id}/toggle`)
      await fetchSchedules()
    } catch {
      // ignore
    }
  }

  const deleteSchedule = async (id) => {
    try {
      await api.delete(`/schedules/${id}`)
      await fetchSchedules()
    } catch {
      // ignore
    }
  }

  const activeLogs = logs.filter(l => l.status === 'active')

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Water Supply</h2>
          <p className="text-sm text-gray-400 mt-1">
            Monitor and control irrigation across all zones.
            {activeLogs.length > 0 && (
              <span className="ml-2 text-blue-400 font-medium">
                💧 {activeLogs.length} zone{activeLogs.length > 1 ? 's' : ''} irrigating
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={startAll}
            disabled={actionLoading}
            className="bg-blue-700 hover:bg-blue-600 disabled:bg-gray-600 text-white text-sm font-medium px-4 py-2 rounded transition-colors"
          >
            💧 Start All
          </button>
          <button
            onClick={stopAll}
            disabled={actionLoading}
            className="bg-red-800 hover:bg-red-700 disabled:bg-gray-600 text-white text-sm font-medium px-4 py-2 rounded transition-colors"
          >
            🚱 Stop All
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-900/40 border border-red-700 text-red-300 rounded px-4 py-2 text-sm">
          {error}
        </div>
      )}

      {/* Status table */}
      <div className="bg-gray-800 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-700 flex items-center justify-between">
          <h3 className="font-semibold">Irrigation Log</h3>
          <button onClick={fetchLogs} className="text-xs text-gray-400 hover:text-white">↻ Refresh</button>
        </div>
        {loadingLogs ? (
          <div className="text-center text-gray-500 py-8">Loading…</div>
        ) : logs.length === 0 ? (
          <div className="text-center text-gray-500 py-8">No irrigation activity yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="text-xs text-gray-400 uppercase bg-gray-900/50">
                <tr>
                  <th className="py-2 px-4">Zone</th>
                  <th className="py-2 px-4">Status</th>
                  <th className="py-2 px-4">Started</th>
                  <th className="py-2 px-4">Duration</th>
                  <th className="py-2 px-4">Triggered By</th>
                  <th className="py-2 px-4">Action</th>
                </tr>
              </thead>
              <tbody>
                {logs.map(log => (
                  <WaterLogRow key={log.id} log={log} onStop={stopZone} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Schedules */}
      <div className="bg-gray-800 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-700 flex items-center justify-between">
          <h3 className="font-semibold">Schedules</h3>
          <button
            onClick={() => setShowScheduleForm(v => !v)}
            className="text-xs bg-teal-700 hover:bg-teal-600 text-white px-3 py-1 rounded transition-colors"
          >
            + New Schedule
          </button>
        </div>

        {showScheduleForm && (
          <form onSubmit={createSchedule} className="p-4 border-b border-gray-700 bg-gray-900/40 grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Name</label>
              <input
                required value={newSchedule.name}
                onChange={e => setNewSchedule(p => ({ ...p, name: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-1.5 text-sm text-white"
                placeholder="Morning watering"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Action</label>
              <select
                value={newSchedule.action_type}
                onChange={e => setNewSchedule(p => ({ ...p, action_type: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-1.5 text-sm text-white"
              >
                <option value="water_start">Start water</option>
                <option value="water_stop">Stop water</option>
                <option value="sensor_read">Sensor read</option>
                <option value="scan">Run scan</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Zone (blank = all)</label>
              <input
                type="number" min="1" value={newSchedule.zone_id}
                onChange={e => setNewSchedule(p => ({ ...p, zone_id: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-1.5 text-sm text-white"
                placeholder="e.g. 3"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Time (HH:MM)</label>
              <input
                required type="time" value={newSchedule.time_of_day}
                onChange={e => setNewSchedule(p => ({ ...p, time_of_day: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-1.5 text-sm text-white"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Repeat</label>
              <select
                value={newSchedule.repeat}
                onChange={e => setNewSchedule(p => ({ ...p, repeat: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-1.5 text-sm text-white"
              >
                <option value="daily">Daily</option>
                <option value="weekdays">Weekdays only</option>
                <option value="once">Once</option>
              </select>
            </div>
            <div className="flex items-end gap-2">
              <button type="submit" className="bg-teal-700 hover:bg-teal-600 text-white text-sm px-4 py-1.5 rounded">
                Create
              </button>
              <button type="button" onClick={() => setShowScheduleForm(false)} className="text-sm text-gray-400 hover:text-white px-3 py-1.5">
                Cancel
              </button>
            </div>
          </form>
        )}

        {loadingSchedules ? (
          <div className="text-center text-gray-500 py-8">Loading…</div>
        ) : schedules.length === 0 ? (
          <div className="text-center text-gray-500 py-8">No schedules configured. Create one above or ask AgriBot.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="text-xs text-gray-400 uppercase bg-gray-900/50">
                <tr>
                  <th className="py-2 px-4">Name</th>
                  <th className="py-2 px-4">Action</th>
                  <th className="py-2 px-4">Zone</th>
                  <th className="py-2 px-4">Time</th>
                  <th className="py-2 px-4">Repeat</th>
                  <th className="py-2 px-4">Status</th>
                  <th className="py-2 px-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {schedules.map(s => (
                  <ScheduleRow key={s.id} schedule={s} onToggle={toggleSchedule} onDelete={deleteSchedule} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
