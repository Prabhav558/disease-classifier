import { useEffect, useState } from 'react'
import api from '../api/client'
import PageTransition from '../components/PageTransition'

function formatDuration(started, stopped) {
  const end  = stopped ? new Date(stopped) : new Date()
  const secs = Math.floor((end - new Date(started)) / 1000)
  if (secs < 60)   return `${secs}s`
  if (secs < 3600) return `${Math.floor(secs / 60)}m ${secs % 60}s`
  return `${Math.floor(secs / 3600)}h ${Math.floor((secs % 3600) / 60)}m`
}

const STATUS_STYLES = {
  active:    'bg-blue-50 text-blue-700 border-blue-200',
  stopped:   'bg-slate-100 text-slate-500 border-slate-200',
  scheduled: 'bg-amber-50 text-amber-700 border-amber-200',
}

function WaterLogRow({ log, onStop }) {
  const [elapsed, setElapsed] = useState(formatDuration(log.started_at, log.stopped_at))
  useEffect(() => {
    if (log.status !== 'active') return
    const id = setInterval(() => setElapsed(formatDuration(log.started_at, null)), 1000)
    return () => clearInterval(id)
  }, [log])

  return (
    <tr className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
      <td className="py-3 px-4 text-sm font-medium text-slate-800">Zone {log.sensor_id}</td>
      <td className="py-3 px-4">
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border capitalize ${STATUS_STYLES[log.status] || STATUS_STYLES.stopped}`}>
          {log.status}
        </span>
      </td>
      <td className="py-3 px-4 text-xs text-slate-500">{new Date(log.started_at).toLocaleString()}</td>
      <td className="py-3 px-4 text-xs font-mono text-slate-600">{elapsed}</td>
      <td className="py-3 px-4 text-xs text-slate-400">{log.triggered_by}</td>
      <td className="py-3 px-4">
        {log.status === 'active' && (
          <button
            onClick={() => onStop(log.sensor_id)}
            className="text-xs bg-red-50 hover:bg-red-100 border border-red-200 text-red-600 px-2.5 py-1 rounded-lg transition-colors"
          >
            Stop
          </button>
        )}
      </td>
    </tr>
  )
}

const ACTION_LABELS = {
  water_start: '💧 Start water',
  water_stop:  '🚱 Stop water',
  sensor_read: '📡 Sensor read',
  scan:        '🔍 Run scan',
}

function ScheduleRow({ schedule, onToggle, onDelete }) {
  return (
    <tr className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
      <td className="py-3 px-4 text-sm font-semibold text-slate-800">{schedule.name}</td>
      <td className="py-3 px-4 text-sm text-slate-500">{ACTION_LABELS[schedule.action_type] || schedule.action_type}</td>
      <td className="py-3 px-4 text-sm text-slate-500">{schedule.zone_id ? `Zone ${schedule.zone_id}` : 'All zones'}</td>
      <td className="py-3 px-4 text-sm font-mono text-emerald-600 font-semibold">{schedule.time_of_day}</td>
      <td className="py-3 px-4 text-xs text-slate-400 capitalize">{schedule.repeat}</td>
      <td className="py-3 px-4">
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${schedule.enabled ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>
          {schedule.enabled ? 'Active' : 'Paused'}
        </span>
      </td>
      <td className="py-3 px-4 flex gap-2">
        <button onClick={() => onToggle(schedule.id)} className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 px-2.5 py-1 rounded-lg transition-colors">
          {schedule.enabled ? 'Pause' : 'Resume'}
        </button>
        <button onClick={() => onDelete(schedule.id)} className="text-xs bg-red-50 hover:bg-red-100 border border-red-200 text-red-600 px-2.5 py-1 rounded-lg transition-colors">
          Delete
        </button>
      </td>
    </tr>
  )
}

const EMPTY = { name: '', action_type: 'water_start', zone_id: '', time_of_day: '06:00', repeat: 'daily' }
const inputCls = 'w-full border border-slate-200 rounded-xl px-3 py-1.5 text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent'

export default function WaterSupplyPage() {
  const [logs,             setLogs]             = useState([])
  const [schedules,        setSchedules]        = useState([])
  const [loadingLogs,      setLoadingLogs]      = useState(true)
  const [loadingSchedules, setLoadingSchedules] = useState(true)
  const [actionLoading,    setActionLoading]    = useState(false)
  const [newSchedule,      setNewSchedule]      = useState(EMPTY)
  const [showForm,         setShowForm]         = useState(false)
  const [error,            setError]            = useState('')

  const fetchLogs      = async () => { try { const { data } = await api.get('/water');     setLogs(data)      } catch {} finally { setLoadingLogs(false)      } }
  const fetchSchedules = async () => { try { const { data } = await api.get('/schedules'); setSchedules(data) } catch {} finally { setLoadingSchedules(false) } }

  useEffect(() => {
    fetchLogs(); fetchSchedules()
    const id = setInterval(fetchLogs, 10000)
    return () => clearInterval(id)
  }, [])

  const startAll = async () => {
    setActionLoading(true); setError('')
    try { await api.post('/water/start-all', { triggered_by: 'manual' }); await fetchLogs() }
    catch (e) { setError(e.response?.data?.detail || 'Failed to start irrigation') }
    finally { setActionLoading(false) }
  }
  const stopAll = async () => {
    setActionLoading(true); setError('')
    try { await api.post('/water/stop-all'); await fetchLogs() }
    catch (e) { setError(e.response?.data?.detail || 'Failed to stop irrigation') }
    finally { setActionLoading(false) }
  }
  const stopZone = async (id) => {
    try { await api.post(`/water/stop/${id}`); await fetchLogs() }
    catch (e) { setError(e.response?.data?.detail || `Failed to stop zone ${id}`) }
  }
  const createSchedule = async (e) => {
    e.preventDefault(); setError('')
    try {
      await api.post('/schedules', { ...newSchedule, zone_id: newSchedule.zone_id ? parseInt(newSchedule.zone_id) : null })
      setNewSchedule(EMPTY); setShowForm(false); await fetchSchedules()
    } catch (e) { setError(e.response?.data?.detail || 'Failed to create schedule') }
  }
  const toggleSchedule = async (id) => { try { await api.patch(`/schedules/${id}/toggle`); await fetchSchedules() } catch {} }
  const deleteSchedule = async (id) => { try { await api.delete(`/schedules/${id}`);         await fetchSchedules() } catch {} }

  const activeLogs = logs.filter(l => l.status === 'active')

  return (
    <PageTransition>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900">Water Supply</h2>
          <p className="text-sm text-slate-500 mt-1">
            Monitor and control irrigation.
            {activeLogs.length > 0 && (
              <span className="ml-2 text-blue-600 font-semibold">
                💧 {activeLogs.length} zone{activeLogs.length > 1 ? 's' : ''} irrigating
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={startAll} disabled={actionLoading}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors">
            💧 Start All
          </button>
          <button onClick={stopAll} disabled={actionLoading}
            className="bg-red-500 hover:bg-red-600 disabled:bg-slate-200 disabled:text-slate-400 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors">
            🚱 Stop All
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-2.5 text-sm">{error}</div>
      )}

      {/* Irrigation log */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden mb-6">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-800">Irrigation Log</h3>
          <button onClick={fetchLogs} className="text-xs text-slate-400 hover:text-slate-700 transition-colors">↻ Refresh</button>
        </div>
        {loadingLogs ? (
          <div className="text-center text-slate-400 text-sm py-8">Loading…</div>
        ) : logs.length === 0 ? (
          <div className="text-center text-slate-400 text-sm py-8">No irrigation activity yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  {['Zone','Status','Started','Duration','Triggered By','Action'].map(h => (
                    <th key={h} className="py-2.5 px-4">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {logs.map(log => <WaterLogRow key={log.id} log={log} onStop={stopZone} />)}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Schedules */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-800">Schedules</h3>
          <button
            onClick={() => setShowForm(v => !v)}
            className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg font-semibold transition-colors"
          >
            + New Schedule
          </button>
        </div>

        {showForm && (
          <form onSubmit={createSchedule} className="p-5 border-b border-slate-100 bg-slate-50/60 grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-500 mb-1 block uppercase tracking-wider">Name</label>
              <input required value={newSchedule.name} onChange={e => setNewSchedule(p => ({...p, name: e.target.value}))} className={inputCls} placeholder="Morning watering" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 mb-1 block uppercase tracking-wider">Action</label>
              <select value={newSchedule.action_type} onChange={e => setNewSchedule(p => ({...p, action_type: e.target.value}))} className={inputCls}>
                <option value="water_start">Start water</option>
                <option value="water_stop">Stop water</option>
                <option value="sensor_read">Sensor read</option>
                <option value="scan">Run scan</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 mb-1 block uppercase tracking-wider">Zone (blank = all)</label>
              <input type="number" min="1" value={newSchedule.zone_id} onChange={e => setNewSchedule(p => ({...p, zone_id: e.target.value}))} className={inputCls} placeholder="e.g. 3" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 mb-1 block uppercase tracking-wider">Time</label>
              <input required type="time" value={newSchedule.time_of_day} onChange={e => setNewSchedule(p => ({...p, time_of_day: e.target.value}))} className={inputCls} />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 mb-1 block uppercase tracking-wider">Repeat</label>
              <select value={newSchedule.repeat} onChange={e => setNewSchedule(p => ({...p, repeat: e.target.value}))} className={inputCls}>
                <option value="daily">Daily</option>
                <option value="weekdays">Weekdays only</option>
                <option value="once">Once</option>
              </select>
            </div>
            <div className="flex items-end gap-2">
              <button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold px-4 py-1.5 rounded-xl transition-colors">Create</button>
              <button type="button" onClick={() => setShowForm(false)} className="text-sm text-slate-400 hover:text-slate-700 px-3 py-1.5 transition-colors">Cancel</button>
            </div>
          </form>
        )}

        {loadingSchedules ? (
          <div className="text-center text-slate-400 text-sm py-8">Loading…</div>
        ) : schedules.length === 0 ? (
          <div className="text-center text-slate-400 text-sm py-8">No schedules configured.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  {['Name','Action','Zone','Time','Repeat','Status','Actions'].map(h => (
                    <th key={h} className="py-2.5 px-4">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {schedules.map(s => <ScheduleRow key={s.id} schedule={s} onToggle={toggleSchedule} onDelete={deleteSchedule} />)}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </PageTransition>
  )
}
