import { useEffect, useState } from 'react'
import api from '../api/client'

export default function DroneManagementPage() {
  const [status, setStatus] = useState(null)
  const [flights, setFlights] = useState([])

  useEffect(() => {
    api.get('/drone/status').then(res => setStatus(res.data)).catch(console.error)
    api.get('/drone/flights').then(res => setFlights(res.data)).catch(console.error)
  }, [])

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">Drone Management</h2>

      {/* Status */}
      <div className="bg-gray-800 rounded p-4 mb-6">
        <h3 className="text-lg font-semibold mb-2">Drone Status</h3>
        {status ? (
          <div className="space-y-1 text-sm">
            <p>
              Status: <span className="text-yellow-400 font-medium">{status.status}</span>
            </p>
            <p className="text-gray-400">{status.mode}</p>
          </div>
        ) : (
          <p className="text-gray-400">Loading...</p>
        )}
      </div>

      {/* API Reference */}
      <div className="bg-gray-800 rounded p-4 mb-6">
        <h3 className="text-lg font-semibold mb-2">Data Ingestion API</h3>
        <p className="text-sm text-gray-400 mb-3">
          Use this endpoint to upload drone images and sensor data for analysis.
        </p>

        <div className="bg-gray-900 rounded p-3 text-sm font-mono overflow-x-auto">
          <p className="text-green-400 mb-2">POST /api/drone/upload</p>
          <p className="text-gray-400 mb-1">Content-Type: multipart/form-data</p>
          <div className="text-gray-300 mt-3 space-y-1">
            <p>Parameters:</p>
            <p className="pl-4">zone_id: int (sensor/zone ID)</p>
            <p className="pl-4">image: file (JPEG/PNG)</p>
            <p className="pl-4">n: float (Nitrogen)</p>
            <p className="pl-4">p: float (Phosphorus)</p>
            <p className="pl-4">k: float (Potassium)</p>
            <p className="pl-4">soil_moisture: float (%)</p>
          </div>
        </div>

        {status?.curl_example && (
          <div className="mt-3">
            <p className="text-sm text-gray-400 mb-1">Example:</p>
            <pre className="bg-gray-900 rounded p-3 text-xs text-gray-300 overflow-x-auto whitespace-pre-wrap">
              {status.curl_example}
            </pre>
          </div>
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
